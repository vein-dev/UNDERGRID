import { Players, RunService, SoundService, Workspace } from "@rbxts/services";
import { isPlayerAdmin } from "shared/config";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import {
	DEFAULT_SMARTPHONE_CONFIG,
	GlobalMusicSyncData,
	MusicControlAction,
	MusicPlayerState,
	MusicQueueItem,
	QueueSongResult,
	SmartphoneConfig,
	TrackData,
	VoteSkipResult,
} from "shared/types";

type TrackChangedCallback = (track: TrackData) => void;
type StateChangedCallback = (state: MusicPlayerState) => void;
type ProgressCallback = (position: number, duration: number) => void;
type QueueUpdatedCallback = (queue: MusicQueueItem[]) => void;
type VolumeChangedCallback = (volume: number) => void;

/**
 * Singleton client service synchronizing music playback with ServerMusicService.
 * - Audio playback is strictly synchronized across all clients via SoundService.
 * - Playback control (Play, Pause, Skip, Prev, Seek) is routed to server and authorized for Admins.
 * - All players can enqueue songs and adjust personal volume.
 */
export class MusicPlayerService {
	private static instance?: MusicPlayerService;

	private config: SmartphoneConfig;
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

	private constructor(config: SmartphoneConfig) {
		this.config = config;
		this.currentTrack = this.config.playlist[0];
		this.isUserAdmin = isPlayerAdmin(Players.LocalPlayer);

		this.setupSoundInstance(0.5);

		// Remotes
		this.syncEvent = getRemoteEvent("MusicSyncEvent");
		this.controlEvent = getRemoteEvent("MusicControlEvent");
		this.queueFunction = getRemoteFunction("QueueSongFunction");
		this.voteSkipFunction = getRemoteFunction("VoteSkipFunction");
		this.removeQueueFunction = getRemoteFunction("RemoveQueueFunction");

		this.initNetworkSync();
		this.initProgressLoop();
	}

	public static getInstance(config: SmartphoneConfig = DEFAULT_SMARTPHONE_CONFIG): MusicPlayerService {
		if (!MusicPlayerService.instance) {
			MusicPlayerService.instance = new MusicPlayerService(config);
		}
		return MusicPlayerService.instance;
	}

	private setupSoundInstance(volume = 0.5): void {
		if (this.sound) {
			this.sound.Stop();
			this.sound.Destroy();
		}
		for (const old of SoundService.GetChildren()) {
			if (old.Name === "SmartphoneMusic") {
				old.Destroy();
			}
		}

		this.sound = new Instance("Sound");
		this.sound.Name = "SmartphoneMusic";
		this.sound.Volume = volume;
		this.sound.Looped = false;
		this.sound.Parent = SoundService;

		// Pitch correction effect for Audacity-bypassed audio
		this.pitchEffect = new Instance("PitchShiftSoundEffect");
		this.pitchEffect.Name = "BypassPitchCorrection";
		this.pitchEffect.Octave = 1.0;
		this.pitchEffect.Enabled = false;
		this.pitchEffect.Parent = this.sound;

		// Equalizer effect to restore bass lost by PitchShiftSoundEffect phase cancellation
		this.equalizerEffect = new Instance("EqualizerSoundEffect");
		this.equalizerEffect.Name = "BypassBassCorrection";
		this.equalizerEffect.LowGain = 0;
		this.equalizerEffect.MidGain = 0;
		this.equalizerEffect.HighGain = 0;
		this.equalizerEffect.Enabled = false;
		this.equalizerEffect.Parent = this.sound;

		// When sound finishes loading asset from Roblox CDN, sync position and play
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

		this.applyTrackPitch(this.currentTrack);
	}

	/**
	 * Manually refreshes and resyncs the music audio playback.
	 * Re-creates the local Sound instance and requests fresh server synchronization.
	 */
	public refreshAudio(): void {
		print("[MusicPlayerService] User triggered audio refresh. Recreating sound instance...");
		const currentVol = this.sound ? this.sound.Volume : 0.5;
		this.setupSoundInstance(currentVol);

		if (this.currentTrack) {
			this.sound.SoundId = this.currentTrack.soundId;
			if (this.state === MusicPlayerState.Playing) {
				const expected = this.getEstimatedServerPosition();
				if (this.sound.IsLoaded && this.sound.TimeLength > 0) {
					this.sound.TimePosition = math.clamp(expected, 0, this.sound.TimeLength);
				}
				this.sound.Play();
			}
		}

		// Request fresh sync from server
		this.syncEvent.FireServer("RequestSync");
		print("[MusicPlayerService] Audio refreshed successfully and server resync requested.");
	}

	private initNetworkSync(): void {
		this.syncEvent.OnClientEvent.Connect((data: unknown) => {
			if (typeIs(data, "table")) {
				this.applyServerSync(data as unknown as GlobalMusicSyncData);
			}
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

	private applyServerSync(payload: GlobalMusicSyncData): void {
		if (!payload || !payload.currentTrack) return;

		const isTrackChanged = !this.currentTrack || this.currentTrack.soundId !== payload.currentTrack.soundId;
		this.currentTrack = payload.currentTrack;
		this.state = payload.state;
		this.queue = payload.queue ?? [];
		this.lastServerTimePosition = payload.timePosition;
		this.lastServerTimestamp = payload.serverTimestamp;

		if (isTrackChanged) {
			this.sound.SoundId = payload.currentTrack.soundId;
			this.applyTrackPitch(payload.currentTrack);
			this.emitTrackChanged(this.currentTrack);
		}

		if (payload.state === MusicPlayerState.Playing) {
			const expectedPosition = this.getEstimatedServerPosition();

			if (this.sound.SoundId !== payload.currentTrack.soundId) {
				this.sound.SoundId = payload.currentTrack.soundId;
			}

			// Only set TimePosition if sound is already loaded and drift exceeds tolerance
			if (this.sound.IsLoaded && this.sound.TimeLength > 0) {
				if (math.abs(this.sound.TimePosition - expectedPosition) > 2.0) {
					this.sound.TimePosition = math.clamp(expectedPosition, 0, this.sound.TimeLength);
				}
			}

			if (!this.sound.IsPlaying) {
				this.sound.Play();
			}
		} else if (payload.state === MusicPlayerState.Paused) {
			this.sound.Pause();
			this.sound.TimePosition = payload.timePosition;
		} else {
			this.sound.Stop();
		}

		this.emitStateChanged(this.state);
		this.emitQueueUpdated(this.queue);
	}

	/**
	 * Normalizes pitch for tracks that were pitch-shifted in Audacity to bypass copyright filters,
	 * or adjusts playback speed for pure resampling bypass (with optional Equalizer compensation).
	 */
	private applyTrackPitch(track?: TrackData): void {
		if (!track) {
			this.sound.PlaybackSpeed = 1.0;
			this.pitchEffect.Octave = 1.0;
			this.pitchEffect.Enabled = false;
			this.equalizerEffect.LowGain = 0;
			this.equalizerEffect.HighGain = 0;
			this.equalizerEffect.Enabled = false;
			return;
		}

		const semitones = track.pitch ?? 0;
		const mode = track.pitchCorrectionMode ?? "pitchShift";

		// 1. Configure PlaybackSpeed (resampling / tempo correction)
		if (track.playbackSpeed !== undefined) {
			this.sound.PlaybackSpeed = track.playbackSpeed;
		} else if (track.speed !== undefined && track.speed !== 1) {
			this.sound.PlaybackSpeed = 1 / track.speed;
		} else if (semitones !== 0 && mode === "playbackSpeed") {
			// Pure resampling mode using semitones
			this.sound.PlaybackSpeed = math.pow(2, -semitones / 12);
		} else {
			this.sound.PlaybackSpeed = 1.0;
		}

		// 2. Configure PitchShiftSoundEffect (if pitch semitones are set and not using pure playbackSpeed mode)
		if (semitones !== 0 && mode !== "playbackSpeed") {
			this.pitchEffect.Octave = math.clamp(math.pow(2, -semitones / 12), 0.5, 2.0);
			this.pitchEffect.Enabled = true;
		} else {
			this.pitchEffect.Octave = 1.0;
			this.pitchEffect.Enabled = false;
		}

		// Apply equalizer compensation if explicitly configured or gentle default if pitchShift is active
		const isPitchShiftActive = this.pitchEffect.Enabled;
		const defaultBassBoost = isPitchShiftActive ? 1 : 0;
		const defaultTrebleBoost = isPitchShiftActive ? 2 : 0;

		const bassBoost = track.bassBoost ?? defaultBassBoost;
		const trebleBoost = track.trebleBoost ?? defaultTrebleBoost;

		if (bassBoost !== 0 || trebleBoost !== 0) {
			this.equalizerEffect.LowGain = bassBoost;
			this.equalizerEffect.HighGain = trebleBoost;
			this.equalizerEffect.Enabled = true;
		} else {
			this.equalizerEffect.LowGain = 0;
			this.equalizerEffect.HighGain = 0;
			this.equalizerEffect.Enabled = false;
		}
	}

	private initProgressLoop(): void {
		this.heartbeatConn = RunService.Heartbeat.Connect(() => {
			if (this.state === MusicPlayerState.Playing) {
				if (this.sound.IsLoaded && this.sound.TimeLength > 0) {
					const expected = this.getEstimatedServerPosition();
					if (math.abs(this.sound.TimePosition - expected) > 2.0) {
						this.sound.TimePosition = math.clamp(expected, 0, this.sound.TimeLength);
					}
					if (!this.sound.IsPlaying) {
						this.sound.Play();
					}
				}
				this.emitProgress();
			}
		});
	}

	// ─── Playback Control Requests (Admin Authorized) ─────────────────────────

	public requestPlayPause(): void {
		this.controlEvent.FireServer(MusicControlAction.TogglePlayPause);
	}

	public requestNext(): void {
		this.controlEvent.FireServer(MusicControlAction.Next);
	}

	public requestPrevious(): void {
		this.controlEvent.FireServer(MusicControlAction.Previous);
	}

	public requestSeek(position: number): void {
		this.controlEvent.FireServer(MusicControlAction.Seek, position);
	}

	public requestPlaySpecific(track: TrackData): void {
		this.controlEvent.FireServer(MusicControlAction.PlaySpecific, track);
	}

	// ─── Song Queueing (Available to all Players) ──────────────────────────────

	public async requestQueueSong(
		track: TrackData | { soundId: string; title?: string; artist?: string },
	): Promise<QueueSongResult> {
		try {
			const result = this.queueFunction.InvokeServer(track) as QueueSongResult;
			return result ?? { success: false, message: "No response from server" };
		} catch (err) {
			return { success: false, message: `Failed to queue: ${tostring(err)}` };
		}
	}

	/**
	 * Client: cast a vote to skip a queued item by its 0-based index.
	 * Server skips automatically when VOTE_SKIP_THRESHOLD is reached.
	 */
	public async requestVoteSkip(queueIndex: number): Promise<VoteSkipResult> {
		try {
			const result = this.voteSkipFunction.InvokeServer(queueIndex) as VoteSkipResult;
			return result ?? { success: false, message: "No response from server", currentVotes: 0, requiredVotes: 10 };
		} catch (err) {
			return { success: false, message: `Error: ${tostring(err)}`, currentVotes: 0, requiredVotes: 10 };
		}
	}

	/**
	 * Admin: forcibly remove a queued item by its 0-based index.
	 */
	public async requestRemoveQueue(queueIndex: number): Promise<VoteSkipResult> {
		try {
			const result = this.removeQueueFunction.InvokeServer(queueIndex) as VoteSkipResult;
			return result ?? { success: false, message: "No response from server", currentVotes: 0, requiredVotes: 0 };
		} catch (err) {
			return { success: false, message: `Error: ${tostring(err)}`, currentVotes: 0, requiredVotes: 0 };
		}
	}

	public setVolume(volume: number): void {
		const clamped = math.clamp(volume, 0, 1);
		this.sound.Volume = clamped;
		for (const cb of this.volumeChangedCallbacks) cb(clamped);
	}

	// ─── Getters ──────────────────────────────────────────────────────────────

	public isAdmin(): boolean {
		return this.isUserAdmin;
	}

	public getState(): MusicPlayerState {
		return this.state;
	}

	public getCurrentTrack(): TrackData {
		return this.currentTrack;
	}

	public getQueue(): MusicQueueItem[] {
		return this.queue;
	}

	public getPosition(): number {
		return this.sound.TimePosition;
	}

	public getDuration(): number {
		return this.sound.TimeLength;
	}

	public getVolume(): number {
		return this.sound.Volume;
	}

	public getDefaultPlaylist(): TrackData[] {
		return this.config.playlist;
	}

	public getSoundInstance(): Sound {
		return this.sound;
	}

	// ─── Callbacks ────────────────────────────────────────────────────────────

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

	private emitTrackChanged(track: TrackData): void {
		for (const cb of this.trackChangedCallbacks) cb(track);
	}

	private emitStateChanged(state: MusicPlayerState): void {
		for (const cb of this.stateChangedCallbacks) cb(state);
	}

	private emitProgress(): void {
		const pos = this.sound.TimePosition;
		const dur = this.sound.TimeLength;
		for (const cb of this.progressCallbacks) cb(pos, dur);
	}

	private emitQueueUpdated(queue: MusicQueueItem[]): void {
		for (const cb of this.queueUpdatedCallbacks) cb(queue);
	}

	public destroy(): void {
		this.heartbeatConn?.Disconnect();
		this.sound.Stop();
		this.sound.Destroy();
		MusicPlayerService.instance = undefined;
	}
}
