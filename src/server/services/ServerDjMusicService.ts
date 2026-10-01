import { Players, SoundService, Workspace } from "@rbxts/services";
import { AdminConfig, DEFAULT_DJ_PLAYLIST, DJ_MUSIC_CONFIG, isPlayerAdmin } from "shared/config";
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

/**
 * ServerDjMusicService
 * Layanan server otoritatif untuk mengelola pemutaran musik khusus Panggung DJ (Rooftop).
 * - Beroperasi secara independen dari ServerMusicService (Main Stage).
 * - Mengelola antrean lagu, sinkronisasi waktu pemutaran, dan kontrol admin/DJ.
 */
export class ServerDjMusicService {
	private static instance?: ServerDjMusicService;

	private playlist: TrackData[];
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

	private constructor(playlist: TrackData[] = DEFAULT_DJ_PLAYLIST) {
		this.playlist = playlist;
		this.currentTrack = this.playlist[0];

		// Server sound instance khusus DJ untuk pelacakan durasi dan event Ended
		this.sound = new Instance("Sound");
		this.sound.Name = "ServerDjMusic";
		this.sound.SoundId = this.currentTrack ? this.currentTrack.soundId : "";
		this.sound.Volume = 0; // Silent on server
		this.sound.Looped = false;
		this.sound.Parent = SoundService;

		// Remotes khusus DJ
		this.syncEvent = getRemoteEvent("DjMusicSyncEvent");
		this.controlEvent = getRemoteEvent("DjMusicControlEvent");
		this.queueFunction = getRemoteFunction("DjQueueSongFunction");
		this.voteSkipFunction = getRemoteFunction("DjVoteSkipFunction");
		this.removeQueueFunction = getRemoteFunction("DjRemoveQueueFunction");

		this.init();
	}

	public static getInstance(playlist: TrackData[] = DEFAULT_DJ_PLAYLIST): ServerDjMusicService {
		if (!ServerDjMusicService.instance) {
			ServerDjMusicService.instance = new ServerDjMusicService(playlist);
		}
		return ServerDjMusicService.instance;
	}

	private init(): void {
		this.sound.Ended.Connect(() => {
			this.onTrackEnded();
		});

		// Server fallback timer untuk pemutaran otomatis
		task.spawn(() => {
			while (true) {
				task.wait(1);
				if (this.state === MusicPlayerState.Playing && this.currentTrack) {
					const elapsed = Workspace.GetServerTimeNow() - this.playbackStartedTimestamp;
					const maxTrackDuration = this.sound.TimeLength > 0 ? this.sound.TimeLength : 180;
					if (elapsed >= maxTrackDuration) {
						warn(
							`[ServerDjMusicService] Track "${this.currentTrack.title}" reached duration limit (${maxTrackDuration}s). Advancing...`,
						);
						this.onTrackEnded();
					} else if (this.sound.TimeLength === 0 && elapsed >= 15 && this.sound.IsLoaded) {
						warn(
							`[ServerDjMusicService] Track "${this.currentTrack.title}" has 0s length. Skipping to next...`,
						);
						this.onTrackEnded();
					}
				}
			}
		});

		// Network remote handlers
		this.controlEvent.OnServerEvent.Connect((player, action, ...args) => {
			if (!isPlayerAdmin(player)) {
				warn(
					`[ServerDjMusicService] Unauthorized DJ music control action '${tostring(action)}' attempted by ${player.Name}`,
				);
				return;
			}
			this.handleControlAction(action as MusicControlAction, ...args);
		});

		this.queueFunction.OnServerInvoke = (player: Player, trackData: unknown) => {
			return this.handleQueueRequest(player, trackData as TrackData);
		};

		this.voteSkipFunction.OnServerInvoke = (player: Player, queueIndex: unknown) => {
			return this.handleVoteSkip(player, queueIndex as number);
		};

		this.removeQueueFunction.OnServerInvoke = (player: Player, queueIndex: unknown) => {
			return this.handleRemoveQueue(player, queueIndex as number);
		};

		// Sinkronisasi untuk pemain baru yang bergabung
		Players.PlayerAdded.Connect((player) => {
			task.defer(() => {
				this.broadcastSyncToPlayer(player);
			});
		});

		// Mulai pemutaran lagu pertama DJ secara otomatis
		task.defer(() => {
			if (this.currentTrack) {
				this.play();
			}
		});

		print("[ServerDjMusicService] Initialized successfully for Rooftop DJ Stage.");
	}

	public play(): void {
		if (!this.currentTrack) return;

		this.sound.SoundId = this.currentTrack.soundId;
		this.sound.TimePosition = this.pausedPosition;
		this.sound.Play();

		this.state = MusicPlayerState.Playing;
		this.playbackStartedTimestamp = Workspace.GetServerTimeNow() - this.pausedPosition;

		this.broadcastSync();
		print(`[ServerDjMusicService] Now Playing: ${this.currentTrack.title} (${this.currentTrack.soundId})`);
	}

	public pause(): void {
		if (this.state !== MusicPlayerState.Playing) return;

		this.pausedPosition = Workspace.GetServerTimeNow() - this.playbackStartedTimestamp;
		this.sound.Pause();
		this.state = MusicPlayerState.Paused;

		this.broadcastSync();
		print(`[ServerDjMusicService] Paused at ${this.pausedPosition}s`);
	}

	public togglePlayPause(): void {
		if (this.state === MusicPlayerState.Playing) {
			this.pause();
		} else {
			this.play();
		}
	}

	public playNext(): void {
		if (this.queue.size() > 0) {
			const nextItem = this.queue.shift()!;
			this.currentTrack = nextItem.track;
			this.pausedPosition = 0;
			this.play();
			return;
		}

		if (this.playlist.size() === 0) return;
		this.playlistIndex = (this.playlistIndex + 1) % this.playlist.size();
		this.currentTrack = this.playlist[this.playlistIndex];
		this.pausedPosition = 0;
		this.play();
	}

	public playPrevious(): void {
		if (this.playlist.size() === 0) return;
		this.playlistIndex = (this.playlistIndex - 1 + this.playlist.size()) % this.playlist.size();
		this.currentTrack = this.playlist[this.playlistIndex];
		this.pausedPosition = 0;
		this.play();
	}

	public seek(timePosition: number): void {
		this.pausedPosition = math.max(0, timePosition);
		if (this.state === MusicPlayerState.Playing) {
			this.sound.TimePosition = this.pausedPosition;
			this.playbackStartedTimestamp = Workspace.GetServerTimeNow() - this.pausedPosition;
		}
		this.broadcastSync();
	}

	public playSpecificTrack(track: TrackData): void {
		this.currentTrack = track;
		this.pausedPosition = 0;
		this.play();
	}

	public setQueueLocked(locked: boolean): void {
		this.isQueueLocked = locked;
		this.broadcastSync();
	}

	public clearQueue(): void {
		this.queue.clear();
		this.broadcastSync();
	}

	private onTrackEnded(): void {
		this.pausedPosition = 0;
		this.playNext();
	}

	private handleControlAction(action: MusicControlAction, ...args: unknown[]): void {
		switch (action) {
			case MusicControlAction.Play:
				this.play();
				break;
			case MusicControlAction.Pause:
				this.pause();
				break;
			case MusicControlAction.TogglePlayPause:
				this.togglePlayPause();
				break;
			case MusicControlAction.Next:
				this.playNext();
				break;
			case MusicControlAction.Previous:
				this.playPrevious();
				break;
			case MusicControlAction.Seek: {
				const pos = args[0] as number;
				if (typeIs(pos, "number")) this.seek(pos);
				break;
			}
			case MusicControlAction.PlaySpecific: {
				const track = args[0] as TrackData;
				if (typeIs(track, "table") && track.soundId) {
					this.playSpecificTrack(track);
				}
				break;
			}
		}
	}

	private handleQueueRequest(player: Player, trackData: TrackData): QueueSongResult {
		if (this.isQueueLocked && !isPlayerAdmin(player)) {
			return { success: false, message: "Antrean lagu DJ sedang dikunci oleh DJ/Admin." };
		}

		if (!trackData || !trackData.soundId || trackData.soundId.size() === 0) {
			return { success: false, message: "Sound ID lagu tidak valid." };
		}

		if (!isPlayerAdmin(player)) {
			const lastQueueTime = this.playerQueueTimestamps.get(player.UserId) ?? 0;
			const timeSinceLast = os.time() - lastQueueTime;
			if (timeSinceLast < DJ_MUSIC_CONFIG.QUEUE_COOLDOWN_SECONDS) {
				const wait = DJ_MUSIC_CONFIG.QUEUE_COOLDOWN_SECONDS - timeSinceLast;
				return { success: false, message: `Harap tunggu ${wait} detik sebelum request lagu DJ lagi.` };
			}

			const playerInQueueCount = this.queue.filter((item) => item.requestedByUserId === player.UserId).size();
			if (playerInQueueCount >= DJ_MUSIC_CONFIG.MAX_QUEUE_PER_PLAYER) {
				return {
					success: false,
					message: `Batas antrean maksimal tercapai (${DJ_MUSIC_CONFIG.MAX_QUEUE_PER_PLAYER} lagu per pemain).`,
				};
			}
		}

		const queueItem: MusicQueueItem = {
			track: trackData,
			requestedBy: player.DisplayName || player.Name,
			requestedByUserId: player.UserId,
			queuedAt: os.time(),
			voteSkipUserIds: [],
		};

		this.queue.push(queueItem);
		this.playerQueueTimestamps.set(player.UserId, os.time());
		this.broadcastSync();

		print(`[ServerDjMusicService] ${player.Name} requested DJ song: "${trackData.title}"`);
		return { success: true, message: `Lagu "${trackData.title}" berhasil masuk ke antrean DJ!` };
	}

	private handleVoteSkip(player: Player, queueIndex: number): VoteSkipResult {
		if (queueIndex < 0 || queueIndex >= this.queue.size()) {
			return { success: false, message: "Item antrean tidak ditemukan.", currentVotes: 0, requiredVotes: 0 };
		}

		const item = this.queue[queueIndex];
		if (item.voteSkipUserIds.includes(player.UserId)) {
			return {
				success: false,
				message: "Anda sudah melakukan vote skip untuk lagu ini.",
				currentVotes: item.voteSkipUserIds.size(),
				requiredVotes: DJ_MUSIC_CONFIG.VOTE_SKIP_THRESHOLD,
			};
		}

		item.voteSkipUserIds.push(player.UserId);
		const currentVotes = item.voteSkipUserIds.size();

		if (currentVotes >= DJ_MUSIC_CONFIG.VOTE_SKIP_THRESHOLD) {
			this.queue.remove(queueIndex);
			this.broadcastSync();
			return { success: true, message: "Lagu DJ di-skip berdasarkan vote terbanyak.", currentVotes, requiredVotes: DJ_MUSIC_CONFIG.VOTE_SKIP_THRESHOLD };
		}

		this.broadcastSync();
		return { success: true, message: "Vote skip berhasil dicatat.", currentVotes, requiredVotes: DJ_MUSIC_CONFIG.VOTE_SKIP_THRESHOLD };
	}

	private handleRemoveQueue(player: Player, queueIndex: number): { success: boolean; message: string } {
		if (queueIndex < 0 || queueIndex >= this.queue.size()) {
			return { success: false, message: "Item antrean tidak ditemukan." };
		}

		const item = this.queue[queueIndex];
		const canRemove = isPlayerAdmin(player) || item.requestedByUserId === player.UserId;
		if (!canRemove) {
			return { success: false, message: "Anda tidak berhak menghapus request ini." };
		}

		this.queue.remove(queueIndex);
		this.broadcastSync();
		return { success: true, message: "Lagu berhasil dihapus dari antrean DJ." };
	}

	public getSyncData(): GlobalMusicSyncData {
		const elapsed =
			this.state === MusicPlayerState.Playing
				? Workspace.GetServerTimeNow() - this.playbackStartedTimestamp
				: this.pausedPosition;

		return {
			currentTrack: this.currentTrack,
			state: this.state,
			timePosition: math.max(0, elapsed),
			serverTimestamp: Workspace.GetServerTimeNow(),
			queue: this.queue,
		};
	}

	public broadcastSync(): void {
		const data = this.getSyncData();
		this.syncEvent.FireAllClients(data);
	}

	public broadcastSyncToPlayer(player: Player): void {
		const data = this.getSyncData();
		this.syncEvent.FireClient(player, data);
	}

	public getCurrentTrack(): TrackData | undefined {
		return this.currentTrack;
	}

	public getPlaybackState(): MusicPlayerState {
		return this.state;
	}

	public getQueue(): MusicQueueItem[] {
		return [...this.queue];
	}

	public getIsQueueLocked(): boolean {
		return this.isQueueLocked;
	}
}
