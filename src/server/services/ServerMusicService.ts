import { Players, SoundService, Workspace } from "@rbxts/services";
import { AdminConfig, isPlayerAdmin } from "shared/config";
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
	VOTE_SKIP_THRESHOLD,
	VoteSkipResult,
} from "shared/types";

/**
 * Server Singleton Service managing global music playback and player song queues.
 * - Only Admins can directly control playback (Play, Pause, Skip, Prev, Seek).
 * - All players can queue songs and receive synced music playback.
 */
export class ServerMusicService {
	private static instance?: ServerMusicService;

	private config: SmartphoneConfig;
	private playlistIndex = 0;
	private currentTrack: TrackData;
	private state: MusicPlayerState = MusicPlayerState.Idle;
	private queue: MusicQueueItem[] = [];
	private isQueueLocked = false;

	private sound: Sound;
	private playbackStartedTimestamp = 0;
	private pausedPosition = 0;

	private playerQueueTimestamps = new Map<number, number>();

	private syncEvent: RemoteEvent;
	private controlEvent: RemoteEvent;
	private queueFunction: RemoteFunction;
	private voteSkipFunction: RemoteFunction;
	private removeQueueFunction: RemoteFunction;

	private constructor(config: SmartphoneConfig = DEFAULT_SMARTPHONE_CONFIG) {
		this.config = config;
		this.currentTrack = this.config.playlist[0];

		// Server sound instance to track playback duration and Ended events
		this.sound = new Instance("Sound");
		this.sound.Name = "ServerGlobalMusic";
		this.sound.SoundId = this.currentTrack ? this.currentTrack.soundId : "";
		this.sound.Volume = 0; // Silent on server
		this.sound.Looped = false;
		this.sound.Parent = SoundService;

		// Remotes
		this.syncEvent = getRemoteEvent("MusicSyncEvent");
		this.controlEvent = getRemoteEvent("MusicControlEvent");
		this.queueFunction = getRemoteFunction("QueueSongFunction");
		this.voteSkipFunction = getRemoteFunction("VoteSkipFunction");
		this.removeQueueFunction = getRemoteFunction("RemoveQueueFunction");

		this.init();
	}

	public static getInstance(config: SmartphoneConfig = DEFAULT_SMARTPHONE_CONFIG): ServerMusicService {
		if (!ServerMusicService.instance) {
			ServerMusicService.instance = new ServerMusicService(config);
		}
		return ServerMusicService.instance;
	}

	private init(): void {
		// When track finishes naturally, play next from queue or playlist
		this.sound.Ended.Connect(() => {
			this.onTrackEnded();
		});

		// Server timer fallback for dedicated/headless live servers
		task.spawn(() => {
			while (true) {
				task.wait(1);
				if (this.state === MusicPlayerState.Playing && this.currentTrack) {
					const elapsed = Workspace.GetServerTimeNow() - this.playbackStartedTimestamp;
					if (this.sound.TimeLength > 0 && elapsed >= this.sound.TimeLength) {
						this.onTrackEnded();
					}
				}
			}
		});

		// Listen for Admin Control requests
		this.controlEvent.OnServerEvent.Connect((player, action, position) => {
			this.handleControlAction(player, action as MusicControlAction, position as number | undefined);
		});

		// Listen for Player Queue requests
		this.queueFunction.OnServerInvoke = (player: Player, trackOrId: unknown) => {
			return this.handleQueueRequest(player, trackOrId);
		};

		// Listen for Vote-Skip requests (clients only)
		this.voteSkipFunction.OnServerInvoke = (player: Player, queueIndex: unknown) => {
			return this.handleVoteSkip(player, queueIndex as number);
		};

		// Listen for Remove-Queue requests (admin only)
		this.removeQueueFunction.OnServerInvoke = (player: Player, queueIndex: unknown) => {
			return this.handleRemoveQueue(player, queueIndex as number);
		};

		// Sync to newly joined players
		Players.PlayerAdded.Connect((player) => {
			this.syncToPlayer(player);
		});

		// Start playing the initial track automatically
		task.defer(() => {
			this.playCurrentTrack();
		});

		print("[ServerMusicService] Initialized successfully. Global sync & admin control active.");
	}

	// ─── Playback Controls ────────────────────────────────────────────────────

	private playCurrentTrack(): void {
		if (!this.currentTrack) return;

		this.sound.SoundId = this.currentTrack.soundId;
		this.sound.TimePosition = 0;
		this.sound.Play();

		this.state = MusicPlayerState.Playing;
		this.playbackStartedTimestamp = Workspace.GetServerTimeNow();
		this.pausedPosition = 0;

		this.syncAll();
		print(`[ServerMusicService] Now Playing: ${this.currentTrack.title} (${this.currentTrack.soundId})`);
	}

	public nextTrack(): void {
		this.sound.Stop();

		if (this.queue.size() > 0) {
			// Pull next song from the player queue
			const nextQueueItem = this.queue.shift()!;
			this.currentTrack = nextQueueItem.track;
			print(
				`[ServerMusicService] Advanced to queued track: ${this.currentTrack.title} (Requested by ${nextQueueItem.requestedBy})`,
			);
		} else if (this.config.playlist.size() > 0) {
			// Fallback to default playlist
			this.playlistIndex = (this.playlistIndex + 1) % this.config.playlist.size();
			this.currentTrack = this.config.playlist[this.playlistIndex];
		}

		this.playCurrentTrack();
	}

	public previousTrack(): void {
		this.sound.Stop();
		const len = this.config.playlist.size();
		if (len > 0) {
			this.playlistIndex = (this.playlistIndex - 1 + len) % len;
			this.currentTrack = this.config.playlist[this.playlistIndex];
		}
		this.playCurrentTrack();
	}

	public pause(): void {
		if (this.state !== MusicPlayerState.Playing) return;
		this.sound.Pause();
		this.pausedPosition = this.getCurrentTimePosition();
		this.state = MusicPlayerState.Paused;
		this.syncAll();
		print("[ServerMusicService] Music paused by admin.");
	}

	public resume(): void {
		if (this.state !== MusicPlayerState.Paused) return;
		this.sound.Resume();
		this.playbackStartedTimestamp = Workspace.GetServerTimeNow() - this.pausedPosition;
		this.state = MusicPlayerState.Playing;
		this.syncAll();
		print("[ServerMusicService] Music resumed by admin.");
	}

	public playSpecificTrack(track: TrackData): void {
		this.currentTrack = track;
		this.playCurrentTrack();
	}

	public seek(position: number): void {
		this.sound.TimePosition = position;
		this.pausedPosition = position;
		this.playbackStartedTimestamp = Workspace.GetServerTimeNow() - position;
		this.syncAll();
	}

	private onTrackEnded(): void {
		this.nextTrack();
	}

	// ─── Remote Handlers ──────────────────────────────────────────────────────

	private handleControlAction(player: Player, action: MusicControlAction, data?: unknown): void {
		// Verify Admin Permissions
		if (!isPlayerAdmin(player)) {
			warn(
				`[ServerMusicService] Unauthorized music control attempt by ${player.Name} (UserId: ${player.UserId})`,
			);
			return;
		}

		switch (action) {
			case MusicControlAction.Play:
				if (this.state === MusicPlayerState.Paused) this.resume();
				else this.playCurrentTrack();
				break;
			case MusicControlAction.Pause:
				this.pause();
				break;
			case MusicControlAction.TogglePlayPause:
				if (this.state === MusicPlayerState.Playing) this.pause();
				else this.resume();
				break;
			case MusicControlAction.Next:
				this.nextTrack();
				break;
			case MusicControlAction.Previous:
				this.previousTrack();
				break;
			case MusicControlAction.Seek:
				if (typeIs(data, "number")) this.seek(data);
				break;
			case MusicControlAction.PlaySpecific:
				if (typeIs(data, "table")) {
					this.playSpecificTrack(data as unknown as TrackData);
				}
				break;
		}
	}

	private handleQueueRequest(player: Player, trackOrData: unknown): QueueSongResult {
		// Queue Lock check
		if (this.isQueueLocked && !isPlayerAdmin(player)) {
			return {
				success: false,
				message: "Song queue is currently locked for this event.",
			};
		}

		// Cooldown check
		const lastQueued = this.playerQueueTimestamps.get(player.UserId) ?? 0;
		const now = Workspace.GetServerTimeNow();
		if (now - lastQueued < AdminConfig.QUEUE_COOLDOWN_SECONDS && !isPlayerAdmin(player)) {
			const remaining = math.ceil(AdminConfig.QUEUE_COOLDOWN_SECONDS - (now - lastQueued));
			return {
				success: false,
				message: `Please wait ${remaining}s before queueing another song.`,
			};
		}

		// Count songs currently in queue from this player
		let userQueueCount = 0;
		for (const item of this.queue) {
			if (item.requestedByUserId === player.UserId) userQueueCount++;
		}
		if (userQueueCount >= AdminConfig.MAX_QUEUE_PER_PLAYER && !isPlayerAdmin(player)) {
			return {
				success: false,
				message: `Queue limit reached (max ${AdminConfig.MAX_QUEUE_PER_PLAYER} songs per player).`,
			};
		}

		let trackToAdd: TrackData | undefined;

		if (typeIs(trackOrData, "table")) {
			const data = trackOrData as Record<string, unknown>;
			if (typeIs(data.soundId, "string") && (data.soundId as string).size() > 0) {
				trackToAdd = {
					id: `queue_${player.UserId}_${os.time()}`,
					title: typeIs(data.title, "string") ? (data.title as string) : "Custom Track",
					artist: typeIs(data.artist, "string") ? (data.artist as string) : player.DisplayName,
					soundId: data.soundId as string,
					coverColor: Color3.fromHex(string.format("#%02x%02x%02x", math.random(40, 220), math.random(40, 220), math.random(40, 220))),
				};
			}
		}

		if (!trackToAdd) {
			return {
				success: false,
				message: "Invalid sound data or asset ID.",
			};
		}

		const queueItem: MusicQueueItem = {
			track: trackToAdd,
			requestedBy: player.DisplayName,
			requestedByUserId: player.UserId,
			queuedAt: os.time(),
			voteSkipUserIds: [],
		};

		this.queue.push(queueItem);
		this.playerQueueTimestamps.set(player.UserId, now);
		this.syncAll();

		print(
			`[ServerMusicService] ${player.Name} queued: ${trackToAdd.title} (${trackToAdd.soundId}). Queue size: ${this.queue.size()}`,
		);

		return {
			success: true,
			message: `"${trackToAdd.title}" added to queue (#${this.queue.size()})`,
		};
	}

	/** Client: vote to skip a queued song. Triggers skip when VOTE_SKIP_THRESHOLD is reached. */
	private handleVoteSkip(player: Player, queueIndex: number): VoteSkipResult {
		if (!typeIs(queueIndex, "number") || queueIndex < 0 || queueIndex >= this.queue.size()) {
			return {
				success: false,
				message: "Item antrean tidak valid.",
				currentVotes: 0,
				requiredVotes: VOTE_SKIP_THRESHOLD,
			};
		}

		const item = this.queue[queueIndex];
		if (!item) {
			return {
				success: false,
				message: "Item tidak ditemukan.",
				currentVotes: 0,
				requiredVotes: VOTE_SKIP_THRESHOLD,
			};
		}

		// Prevent duplicate votes
		if (item.voteSkipUserIds.includes(player.UserId)) {
			return {
				success: false,
				message: `Kamu sudah vote skip untuk lagu ini. (${item.voteSkipUserIds.size()}/${VOTE_SKIP_THRESHOLD} vote)`,
				currentVotes: item.voteSkipUserIds.size(),
				requiredVotes: VOTE_SKIP_THRESHOLD,
			};
		}

		item.voteSkipUserIds.push(player.UserId);
		const currentVotes = item.voteSkipUserIds.size();

		print(
			`[ServerMusicService] Vote-skip: ${player.Name} voted for "${item.track.title}" (${currentVotes}/${VOTE_SKIP_THRESHOLD})`,
		);

		if (currentVotes >= VOTE_SKIP_THRESHOLD) {
			// Remove from queue and sync
			const removed = this.queue.remove(queueIndex);
			this.syncAll();
			print(`[ServerMusicService] Vote-skip threshold reached! "${removed?.track.title}" removed from queue.`);
			return {
				success: true,
				message: `"${removed?.track.title ?? "Lagu"}" di-skip! Vote tercapai (${VOTE_SKIP_THRESHOLD}/${VOTE_SKIP_THRESHOLD}).`,
				currentVotes: currentVotes,
				requiredVotes: VOTE_SKIP_THRESHOLD,
			};
		}

		this.syncAll();
		return {
			success: true,
			message: `Vote skip tercatat! (${currentVotes}/${VOTE_SKIP_THRESHOLD} vote)`,
			currentVotes: currentVotes,
			requiredVotes: VOTE_SKIP_THRESHOLD,
		};
	}

	/** Admin: forcibly remove a queued song by index. */
	private handleRemoveQueue(player: Player, queueIndex: number): VoteSkipResult {
		if (!isPlayerAdmin(player)) {
			warn(`[ServerMusicService] Unauthorized remove-queue attempt by ${player.Name}`);
			return { success: false, message: "Tidak diizinkan.", currentVotes: 0, requiredVotes: 0 };
		}

		if (!typeIs(queueIndex, "number") || queueIndex < 0 || queueIndex >= this.queue.size()) {
			return { success: false, message: "Index antrean tidak valid.", currentVotes: 0, requiredVotes: 0 };
		}

		const removed = this.queue.remove(queueIndex);
		this.syncAll();
		print(`[ServerMusicService] Admin ${player.Name} removed "${removed?.track.title}" from queue.`);

		return {
			success: true,
			message: `"${removed?.track.title ?? "Lagu"}" dihapus dari antrean.`,
			currentVotes: 0,
			requiredVotes: 0,
		};
	}

	// ─── Synchronization ──────────────────────────────────────────────────────

	private getCurrentTimePosition(): number {
		if (this.state === MusicPlayerState.Paused) {
			return this.pausedPosition;
		}
		if (this.state === MusicPlayerState.Playing) {
			return math.max(0, Workspace.GetServerTimeNow() - this.playbackStartedTimestamp);
		}
		return 0;
	}

	private getSyncPayload(): GlobalMusicSyncData {
		return {
			currentTrack: this.currentTrack,
			state: this.state,
			timePosition: this.getCurrentTimePosition(),
			serverTimestamp: Workspace.GetServerTimeNow(),
			queue: this.queue,
		};
	}

	public syncAll(): void {
		const payload = this.getSyncPayload();
		this.syncEvent.FireAllClients(payload);
	}

	public syncToPlayer(player: Player): void {
		const payload = this.getSyncPayload();
		this.syncEvent.FireClient(player, payload);
	}

	public setQueueLocked(locked: boolean): void {
		this.isQueueLocked = locked;
		print(`[ServerMusicService] Song queue locked: ${locked}`);
	}

	public getIsQueueLocked(): boolean {
		return this.isQueueLocked;
	}

	public clearQueue(): void {
		this.queue = [];
		this.syncAll();
		print("[ServerMusicService] Song queue cleared by admin.");
	}
}
