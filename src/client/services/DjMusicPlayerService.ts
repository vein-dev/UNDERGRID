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

	private lastServerTimePosition = 0;
	private lastServerTimestamp = 0;
	private userMasterVolume = 1.0;

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

	private applyTrackAudioCorrection(track?: TrackData): void {
		if (!this.sound || !track) return;

		const mode = track.pitchCorrectionMode ?? "pitchShift";

		if (mode === "playbackSpeed") {
			const desiredSpeed =
				track.playbackSpeed !== undefined
					? track.playbackSpeed
					: track.speed !== undefined && track.speed > 0
						? 1 / track.speed
						: 1.0;

			this.sound.PlaybackSpeed = desiredSpeed;
			if (this.pitchEffect) this.pitchEffect.Enabled = false;
			if (this.equalizerEffect) this.equalizerEffect.Enabled = false;
		} else {
			this.sound.PlaybackSpeed = 1.0;

			if (track.pitch !== undefined && track.pitch !== 0) {
				const semitoneRatio = 2 ** (-track.pitch / 12);
				this.pitchEffect.Octave = math.clamp(semitoneRatio, 0.5, 2.0);
				this.pitchEffect.Enabled = true;
			} else {
				this.pitchEffect.Octave = 1.0;
				this.pitchEffect.Enabled = false;
			}

			const hasBass = track.bassBoost !== undefined && track.bassBoost !== 0;
			const hasTreble = track.trebleBoost !== undefined && track.trebleBoost !== 0;

			if (hasBass || hasTreble) {
				this.equalizerEffect.LowGain = track.bassBoost ?? 0;
				this.equalizerEffect.HighGain = track.trebleBoost ?? 0;
				this.equalizerEffect.MidGain = 0;
				this.equalizerEffect.Enabled = true;
			} else {
				this.equalizerEffect.Enabled = false;
			}
		}
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
		}

		for (const cb of this.queueUpdatedCallbacks) cb(this.queue);
		for (const cb of this.stateChangedCallbacks) cb(this.state);

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

	private initProgressLoop(): void {
		let lastUpdate = 0;
		this.heartbeatConn = RunService.Heartbeat.Connect(() => {
			const now = os.clock();
			if (now - lastUpdate < 0.25) return;
			lastUpdate = now;

			if (this.state === MusicPlayerState.Playing && this.sound && this.sound.IsPlaying) {
				for (const cb of this.progressCallbacks) {
					cb(this.sound.TimePosition, this.sound.TimeLength);
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
		this.control(MusicControlAction.Seek, position);
	}

	public playSpecific(track: TrackData): void {
		this.control(MusicControlAction.PlaySpecific, track);
	}

	public setPhysicalVolume(volume: number): void {
		if (this.sound) {
			this.sound.Volume = math.clamp(volume, 0, 1);
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
