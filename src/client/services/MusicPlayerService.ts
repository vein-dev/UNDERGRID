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
	private sound: Sound;
	private pitchEffect: PitchShiftSoundEffect;
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

		// Local synchronized Sound instance
		this.sound = new Instance("Sound");
		this.sound.Name = "SmartphoneMusic";
		this.sound.Volume = 0.5;
		this.sound.Looped = false;
		this.sound.Parent = SoundService;

		// Pitch correction effect for Audacity-bypassed audio
		this.pitchEffect = new Instance("PitchShiftSoundEffect");
		this.pitchEffect.Name = "BypassPitchCorrection";
		this.pitchEffect.Octave = 1.0;
		this.pitchEffect.Enabled = false;
		this.pitchEffect.Parent = this.sound;

		this.applyTrackPitch(this.currentTrack);

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

	private initNetworkSync(): void {
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
		return this.lastServerTimePosition + elapsed;
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

			// Only set TimePosition if sound is already loaded
			if (this.sound.IsLoaded && this.sound.TimeLength > 0) {
				if (math.abs(this.sound.TimePosition - expectedPosition) > 0.8) {
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
	 * Normalizes pitch for tracks that were pitch-shifted in Audacity to bypass copyright filters.
	 * Formula: Octave = 2 ^ (-semitones / 12)
	 */
	private applyTrackPitch(track?: TrackData): void {
		const semitones = track?.pitch ?? 0;
		if (semitones !== 0) {
			this.pitchEffect.Octave = math.clamp(math.pow(2, -semitones / 12), 0.5, 2.0);
			this.pitchEffect.Enabled = true;
		} else {
			this.pitchEffect.Octave = 1.0;
			this.pitchEffect.Enabled = false;
		}
	}

	private initProgressLoop(): void {
		this.heartbeatConn = RunService.Heartbeat.Connect(() => {
			if (this.state === MusicPlayerState.Playing) {
				if (this.sound.IsLoaded && this.sound.TimeLength > 0) {
					const expected = this.getEstimatedServerPosition();
					if (math.abs(this.sound.TimePosition - expected) > 1.0) {
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

	public async requestQueueSong(track: TrackData | { soundId: string; title?: string; artist?: string }): Promise<QueueSongResult> {
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

	// ─── Callbacks ────────────────────────────────────────────────────────────

	public onTrackChanged(cb: TrackChangedCallback): void {
		this.trackChangedCallbacks.push(cb);
	}

	public onStateChanged(cb: StateChangedCallback): void {
		this.stateChangedCallbacks.push(cb);
	}

	public onProgress(cb: ProgressCallback): void {
		this.progressCallbacks.push(cb);
	}

	public onQueueUpdated(cb: QueueUpdatedCallback): void {
		this.queueUpdatedCallbacks.push(cb);
	}

	public onVolumeChanged(cb: VolumeChangedCallback): void {
		this.volumeChangedCallbacks.push(cb);
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

