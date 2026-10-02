import { Players, RunService, SoundService, Workspace } from "@rbxts/services";
import { DEFAULT_DJ_PLAYLIST, isPlayerAdmin } from "shared/config";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import {
	GlobalMusicSyncData,
	MusicControlAction,
	MusicPlayerState,
	MusicQueueItem,
	QueueSongResult,
	TrackData,
	VoteSkipResult,
} from "shared/types";

type TrackChangedCallback = (track: TrackData) => void;
type StateChangedCallback = (state: MusicPlayerState) => void;
type ProgressCallback = (position: number, duration: number) => void;
type QueueUpdatedCallback = (queue: MusicQueueItem[]) => void;
type VolumeChangedCallback = (volume: number) => void;
type QueueLockedChangedCallback = (locked: boolean) => void;

/**
 * DjMusicPlayerService
 * Singleton client service yang menyinkronkan pemutaran musik khusus Panggung DJ (Rooftop).
 * - Menggunakan instans Sound "DjMusic" di SoundService.
 * - Volume fisik dimodulasi oleh ZoneAudioController (crossfade saat masuk/keluar DJArea).
 */
export class DjMusicPlayerService {
	private static instance?: DjMusicPlayerService;

	private playlist: TrackData[];
	private currentTrack: TrackData;
	private state: MusicPlayerState = MusicPlayerState.Idle;
	private queue: MusicQueueItem[] = [];
	private isQueueLocked = false;
	private sound!: Sound;
	private pitchEffect!: PitchShiftSoundEffect;
	private equalizerEffect!: EqualizerSoundEffect;
	private heartbeatConn?: RBXScriptConnection;

	private isUserAdmin = false;

	private syncEvent: RemoteEvent;
	private controlEvent: RemoteEvent;
	private queueFunction: RemoteFunction;
	private voteSkipFunction: RemoteFunction;
	private removeQueueFunction: RemoteFunction;

	private trackChangedCallbacks: TrackChangedCallback[] = [];
	private stateChangedCallbacks: StateChangedCallback[] = [];
	private progressCallbacks: ProgressCallback[] = [];
	private queueUpdatedCallbacks: QueueUpdatedCallback[] = [];
	private volumeChangedCallbacks: VolumeChangedCallback[] = [];
	private queueLockedCallbacks: QueueLockedChangedCallback[] = [];

	private lastServerTimePosition = 0;
	private lastServerTimestamp = 0;
	private userMasterVolume = 1.0;
	private currentPhysicalVolume = 0.0;

	/**
	 * Menghitung pengali volume untuk mengompensasi atenuasi desibel bypass (-4 dB = 1.585x)
	 * atau menggunakan konfigurasi volume/amplification kustom dari TrackData.
	 */
	public getTrackVolumeMultiplier(track?: TrackData): number {
		if (!track) return 1.0;
		if (track.volume !== undefined && track.volume > 0) {
			return track.volume;
		}
		if (track.amplification !== undefined) {
			return math.pow(10, -track.amplification / 20);
		}
		// Default otomatis untuk lagu hasil bypass kecepatan (standar tool bypass: -4 dB)
		if (track.speed !== undefined && track.speed > 1) {
			return 1.585; // +4 dB kompensasi penuh (10^(4/20) ≈ 1.585)
		}
		return 1.0;
	}

	private constructor(playlist: TrackData[] = DEFAULT_DJ_PLAYLIST) {
		this.playlist = playlist;
		this.currentTrack = this.playlist[0];
		this.isUserAdmin = isPlayerAdmin(Players.LocalPlayer);

		this.setupSoundInstance(0); // Mulai silent, diatur oleh ZoneAudioController

		this.syncEvent = getRemoteEvent("DjMusicSyncEvent");
		this.controlEvent = getRemoteEvent("DjMusicControlEvent");
		this.queueFunction = getRemoteFunction("DjQueueSongFunction");
		this.voteSkipFunction = getRemoteFunction("DjVoteSkipFunction");
		this.removeQueueFunction = getRemoteFunction("DjRemoveQueueFunction");

		this.initNetworkSync();
		this.initProgressLoop();

		// Request sync langsung ke server saat client boot
		task.defer(() => {
			this.syncEvent.FireServer("RequestSync");
		});
	}

	public static getInstance(playlist: TrackData[] = DEFAULT_DJ_PLAYLIST): DjMusicPlayerService {
		if (!DjMusicPlayerService.instance) {
			DjMusicPlayerService.instance = new DjMusicPlayerService(playlist);
		}
		return DjMusicPlayerService.instance;
	}

	private setupSoundInstance(volume = 0): void {
		if (this.sound) {
			this.sound.Stop();
			this.sound.Destroy();
		}
		for (const old of SoundService.GetChildren()) {
			if (old.Name === "DjMusic") {
				old.Destroy();
			}
		}

		this.sound = new Instance("Sound");
		this.sound.Name = "DjMusic";
		this.sound.SoundId = this.currentTrack ? this.currentTrack.soundId : "";
		this.sound.Volume = volume;
		this.sound.Looped = false;
		this.sound.Parent = SoundService;

		this.pitchEffect = new Instance("PitchShiftSoundEffect");
		this.pitchEffect.Name = "DjPitchCorrection";
		this.pitchEffect.Octave = 1.0;
		this.pitchEffect.Enabled = false;
		this.pitchEffect.Parent = this.sound;

		this.equalizerEffect = new Instance("EqualizerSoundEffect");
		this.equalizerEffect.Name = "DjEqualizer";
		this.equalizerEffect.HighGain = 0;
		this.equalizerEffect.MidGain = 0;
		this.equalizerEffect.LowGain = 0;
		this.equalizerEffect.Enabled = false;
		this.equalizerEffect.Parent = this.sound;

		// Saat audio selesai dimuat dari Roblox CDN, sinkronkan posisi dan mulai putar
		this.sound.Loaded.Connect(() => {
			if (this.state === MusicPlayerState.Playing) {
				const expectedPosition = this.getEstimatedServerPosition();
				if (this.sound.TimeLength > 0 && expectedPosition < this.sound.TimeLength) {
					this.sound.TimePosition = math.max(0, expectedPosition);
				}
				if (!this.sound.IsPlaying) {
					this.sound.Play();
				}
			}
		});

		this.applyTrackAudioCorrection(this.currentTrack);
	}

	/**
	 * Manually refreshes and resyncs the DJ audio playback.
	 * Re-creates the local Sound instance and requests fresh server synchronization.
	 */
	public refreshAudio(): void {
		print("[DjMusicPlayerService] User triggered DJ audio refresh. Recreating sound instance...");
		const currentVol = this.currentPhysicalVolume;
		this.setupSoundInstance(currentVol);

		if (this.currentTrack) {
			this.sound.SoundId = this.currentTrack.soundId;
			this.applyTrackAudioCorrection(this.currentTrack);
			if (this.state === MusicPlayerState.Playing) {
				const expected = this.getEstimatedServerPosition();
				if (this.sound.IsLoaded && this.sound.TimeLength > 0) {
					this.sound.TimePosition = math.clamp(expected, 0, this.sound.TimeLength);
				}
				this.sound.Play();
			}
		}

		// Ensure current physical volume is restored with track gain compensation
		this.setPhysicalVolume(this.currentPhysicalVolume);

		// Request fresh sync from server
		this.syncEvent.FireServer("RequestSync");
		print("[DjMusicPlayerService] DJ audio refreshed successfully and server resync requested.");
	}

	private applyTrackAudioCorrection(track?: TrackData): void {
		if (!this.sound) return;
		if (!track) {
			this.sound.PlaybackSpeed = 1.0;
			if (this.pitchEffect) this.pitchEffect.Enabled = false;
			if (this.equalizerEffect) this.equalizerEffect.Enabled = false;
			return;
		}

		const semitones = track.pitch ?? 0;
		const mode = track.pitchCorrectionMode ?? "pitchShift";

		// 1. Konfigurasi PlaybackSpeed (resampling / koreksi tempo upload)
		if (track.playbackSpeed !== undefined) {
			this.sound.PlaybackSpeed = track.playbackSpeed;
		} else if (track.speed !== undefined && track.speed !== 1) {
			this.sound.PlaybackSpeed = 1 / track.speed;
		} else if (semitones !== 0 && mode === "playbackSpeed") {
			// Mode pure resampling menggunakan semitones
			this.sound.PlaybackSpeed = math.pow(2, -semitones / 12);
		} else {
			this.sound.PlaybackSpeed = 1.0;
		}

		// 2. Konfigurasi PitchShiftSoundEffect (jika semitone disetel dan bukan mode resampling murni)
		if (semitones !== 0 && mode !== "playbackSpeed") {
			this.pitchEffect.Octave = math.clamp(math.pow(2, -semitones / 12), 0.5, 2.0);
			this.pitchEffect.Enabled = true;
		} else {
			this.pitchEffect.Octave = 1.0;
			this.pitchEffect.Enabled = false;
		}

		// 3. Konfigurasi Equalizer boost (mengembalikan kerenyahan nada tinggi yang hilang akibat perlambatan pitch)
		const isSpeedBypassed = track.speed !== undefined && track.speed > 1;
		const defaultTrebleBoost = isSpeedBypassed ? 2.5 : 0;
		const bass = track.bassBoost ?? 0;
		const treble = track.trebleBoost ?? defaultTrebleBoost;

		if (bass !== 0 || treble !== 0) {
			this.equalizerEffect.LowGain = bass;
			this.equalizerEffect.HighGain = treble;
			this.equalizerEffect.MidGain = 0;
			this.equalizerEffect.Enabled = true;
		} else {
			this.equalizerEffect.Enabled = false;
		}

		// Segarkan volume fisik dengan pengali gain lagu saat ini
		this.setPhysicalVolume(this.currentPhysicalVolume);
	}

	private initNetworkSync(): void {
		this.syncEvent.OnClientEvent.Connect((data: unknown) => {
			if (!typeIs(data, "table")) return;
			this.applySyncData(data as GlobalMusicSyncData);
		});
	}

	private getEstimatedServerPosition(): number {
		if (this.state !== MusicPlayerState.Playing) {
			return this.lastServerTimePosition;
		}
		const elapsed = math.max(0, Workspace.GetServerTimeNow() - this.lastServerTimestamp);
		const speed = this.sound.PlaybackSpeed > 0 ? this.sound.PlaybackSpeed : 1.0;
		return this.lastServerTimePosition + elapsed * speed;
	}

	private applySyncData(data: GlobalMusicSyncData): void {
		if (!data || !data.currentTrack) return;

		const trackChanged = !this.currentTrack || this.currentTrack.soundId !== data.currentTrack.soundId;
		this.currentTrack = data.currentTrack;
		this.state = data.state;
		this.queue = data.queue ?? [];

		this.lastServerTimePosition = data.timePosition;
		this.lastServerTimestamp = data.serverTimestamp;

		if (trackChanged) {
			this.sound.SoundId = data.currentTrack.soundId;
			this.applyTrackAudioCorrection(data.currentTrack);
			for (const cb of this.trackChangedCallbacks) cb(this.currentTrack);
		} else {
			this.applyTrackAudioCorrection(data.currentTrack);
		}

		for (const cb of this.queueUpdatedCallbacks) cb(this.queue);
		for (const cb of this.stateChangedCallbacks) cb(this.state);

		if (data.isQueueLocked !== undefined && data.isQueueLocked !== this.isQueueLocked) {
			this.isQueueLocked = data.isQueueLocked;
			for (const cb of this.queueLockedCallbacks) cb(this.isQueueLocked);
		}

		if (this.state === MusicPlayerState.Playing) {
			const expectedPosition = this.getEstimatedServerPosition();

			if (this.sound.SoundId !== data.currentTrack.soundId) {
				this.sound.SoundId = data.currentTrack.soundId;
			}

			if (this.sound.IsLoaded && this.sound.TimeLength > 0) {
				if (math.abs(this.sound.TimePosition - expectedPosition) > 2.0) {
					this.sound.TimePosition = math.clamp(expectedPosition, 0, this.sound.TimeLength);
				}
			}

			if (!this.sound.IsPlaying) {
				this.sound.Play();
			}
		} else if (this.state === MusicPlayerState.Paused) {
			this.sound.Pause();
			this.sound.TimePosition = data.timePosition;
		} else {
			this.sound.Stop();
		}
	}

	private getSpeedMultiplier(): number {
		if (!this.currentTrack) return 1.0;
		if (this.currentTrack.speed !== undefined && this.currentTrack.speed > 0) {
			return this.currentTrack.speed;
		}
		if (this.currentTrack.playbackSpeed !== undefined && this.currentTrack.playbackSpeed > 0) {
			return 1 / this.currentTrack.playbackSpeed;
		}
		return 1.0;
	}

	private initProgressLoop(): void {
		let lastUpdate = 0;
		this.heartbeatConn = RunService.Heartbeat.Connect(() => {
			const now = os.clock();
			if (now - lastUpdate < 0.25) return;
			lastUpdate = now;

			if (this.state === MusicPlayerState.Playing && this.sound && this.sound.IsPlaying) {
				const mult = this.getSpeedMultiplier();
				const displayPos = this.sound.TimePosition * mult;
				const displayDur = this.sound.TimeLength * mult;
				for (const cb of this.progressCallbacks) {
					cb(displayPos, displayDur);
				}
			}
		});
	}

	public async requestQueueSong(track: TrackData): Promise<QueueSongResult> {
		try {
			const result = this.queueFunction.InvokeServer(track) as QueueSongResult;
			return result;
		} catch (err) {
			return { success: false, message: "Gagal terhubung ke server DJ." };
		}
	}

	public async voteSkip(queueIndex: number): Promise<VoteSkipResult> {
		try {
			const result = this.voteSkipFunction.InvokeServer(queueIndex) as VoteSkipResult;
			return result;
		} catch (err) {
			return { success: false, message: "Gagal mengirim vote skip.", currentVotes: 0, requiredVotes: 0 };
		}
	}

	public async removeQueueItem(queueIndex: number): Promise<{ success: boolean; message: string }> {
		try {
			const result = this.removeQueueFunction.InvokeServer(queueIndex) as { success: boolean; message: string };
			return result;
		} catch (err) {
			return { success: false, message: "Gagal menghapus antrean." };
		}
	}

	public control(action: MusicControlAction, ...args: unknown[]): void {
		this.controlEvent.FireServer(action, ...args);
	}

	public play(): void {
		this.control(MusicControlAction.Play);
	}

	public pause(): void {
		this.control(MusicControlAction.Pause);
	}

	public togglePlayPause(): void {
		this.control(MusicControlAction.TogglePlayPause);
	}

	public next(): void {
		this.control(MusicControlAction.Next);
	}

	public previous(): void {
		this.control(MusicControlAction.Previous);
	}

	public seek(position: number): void {
		const mult = this.getSpeedMultiplier();
		const soundPos = mult > 0 ? position / mult : position;
		this.control(MusicControlAction.Seek, soundPos);
	}

	public playSpecific(track: TrackData): void {
		this.control(MusicControlAction.PlaySpecific, track);
	}

	public requestPlayPause(): void {
		this.togglePlayPause();
	}

	public requestNext(): void {
		this.next();
	}

	public requestPrevious(): void {
		this.previous();
	}

	public requestPlaySpecific(track: TrackData): void {
		this.playSpecific(track);
	}

	public setQueueLocked(locked: boolean): void {
		this.control("SetQueueLocked" as MusicControlAction, locked);
	}

	public getIsQueueLocked(): boolean {
		return this.isQueueLocked;
	}

	public onQueueLockedChanged(cb: QueueLockedChangedCallback): () => void {
		this.queueLockedCallbacks.push(cb);
		return () => {
			const idx = this.queueLockedCallbacks.indexOf(cb);
			if (idx !== -1) this.queueLockedCallbacks.remove(idx);
		};
	}

	public setPhysicalVolume(volume: number): void {
		this.currentPhysicalVolume = math.clamp(volume, 0, 1);
		if (this.sound) {
			const mult = this.getTrackVolumeMultiplier(this.currentTrack);
			this.sound.Volume = math.clamp(this.currentPhysicalVolume * mult, 0, 10);
		}
	}

	public setUserMasterVolume(vol: number): void {
		this.userMasterVolume = math.clamp(vol, 0, 1);
		for (const cb of this.volumeChangedCallbacks) cb(this.userMasterVolume);
	}

	public getUserMasterVolume(): number {
		return this.userMasterVolume;
	}

	public getVolume(): number {
		return this.userMasterVolume;
	}

	public setVolume(vol: number): void {
		this.setUserMasterVolume(vol);
	}

	public async requestVoteSkip(queueIndex: number): Promise<VoteSkipResult> {
		return this.voteSkip(queueIndex);
	}

	public async requestRemoveQueue(queueIndex: number): Promise<{ success: boolean; message: string }> {
		return this.removeQueueItem(queueIndex);
	}

	public getCurrentTrack(): TrackData | undefined {
		return this.currentTrack;
	}

	public getState(): MusicPlayerState {
		return this.state;
	}

	public getQueue(): MusicQueueItem[] {
		return [...this.queue];
	}

	public getSoundInstance(): Sound | undefined {
		return this.sound;
	}

	public getDefaultPlaylist(): TrackData[] {
		return [...this.playlist];
	}

	public isAdmin(): boolean {
		return this.isUserAdmin;
	}

	public onTrackChanged(cb: TrackChangedCallback): () => void {
		this.trackChangedCallbacks.push(cb);
		return () => {
			const idx = this.trackChangedCallbacks.indexOf(cb);
			if (idx !== -1) this.trackChangedCallbacks.remove(idx);
		};
	}

	public onStateChanged(cb: StateChangedCallback): () => void {
		this.stateChangedCallbacks.push(cb);
		return () => {
			const idx = this.stateChangedCallbacks.indexOf(cb);
			if (idx !== -1) this.stateChangedCallbacks.remove(idx);
		};
	}

	public onProgress(cb: ProgressCallback): () => void {
		this.progressCallbacks.push(cb);
		return () => {
			const idx = this.progressCallbacks.indexOf(cb);
			if (idx !== -1) this.progressCallbacks.remove(idx);
		};
	}

	public onQueueUpdated(cb: QueueUpdatedCallback): () => void {
		this.queueUpdatedCallbacks.push(cb);
		return () => {
			const idx = this.queueUpdatedCallbacks.indexOf(cb);
			if (idx !== -1) this.queueUpdatedCallbacks.remove(idx);
		};
	}

	public onVolumeChanged(cb: VolumeChangedCallback): () => void {
		this.volumeChangedCallbacks.push(cb);
		return () => {
			const idx = this.volumeChangedCallbacks.indexOf(cb);
			if (idx !== -1) this.volumeChangedCallbacks.remove(idx);
		};
	}

	public destroy(): void {
		if (this.heartbeatConn) {
			this.heartbeatConn.Disconnect();
			this.heartbeatConn = undefined;
		}
		if (this.sound) {
			this.sound.Destroy();
		}
	}
}
