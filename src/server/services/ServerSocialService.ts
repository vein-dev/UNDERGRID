import { TextService, Workspace } from "@rbxts/services";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import { SOCIAL_CONFIG, StatusPost } from "shared/types";

/**
 * Server service managing in-game smartphone social media status updates,
 * timeline moderation, like tracking, and deletions.
 */
export class ServerSocialService {
	private static instance?: ServerSocialService;

	private timeline: StatusPost[] = [];
	private playerLastPostTimestamps = new Map<number, number>();
	private playerLastLikeTimestamps = new Map<number, number>();

	private createPostEvent: RemoteEvent;
	private newPostEvent: RemoteEvent;
	private getTimelineFunction: RemoteFunction;
	private toggleLikeEvent: RemoteEvent;
	private postLikeUpdatedEvent: RemoteEvent;
	private deletePostEvent: RemoteEvent;
	private postDeletedEvent: RemoteEvent;

	private constructor() {
		this.createPostEvent = getRemoteEvent("CreateStatusPostEvent");
		this.newPostEvent = getRemoteEvent("NewStatusPostEvent");
		this.getTimelineFunction = getRemoteFunction("GetTimelineFunction");
		this.toggleLikeEvent = getRemoteEvent("ToggleLikePostEvent");
		this.postLikeUpdatedEvent = getRemoteEvent("PostLikeUpdatedEvent");
		this.deletePostEvent = getRemoteEvent("DeleteStatusPostEvent");
		this.postDeletedEvent = getRemoteEvent("PostDeletedEvent");

		this.init();
	}

	public static getInstance(): ServerSocialService {
		if (!ServerSocialService.instance) {
			ServerSocialService.instance = new ServerSocialService();
		}
		return ServerSocialService.instance;
	}

	private init(): void {
		// Return full timeline (most recent first)
		this.getTimelineFunction.OnServerInvoke = (_player: Player) => {
			return this.timeline;
		};

		// Listen to incoming posts
		this.createPostEvent.OnServerEvent.Connect((player, rawContent) => {
			this.handleCreatePost(player, rawContent);
		});

		// Listen to like toggles
		this.toggleLikeEvent.OnServerEvent.Connect((player, postId) => {
			this.handleToggleLike(player, postId);
		});

		// Listen to post deletions
		this.deletePostEvent.OnServerEvent.Connect((player, postId) => {
			this.handleDeletePost(player, postId);
		});

		print("[ServerSocialService] Initialized successfully.");
	}

	private handleCreatePost(player: Player, rawContent: unknown): void {
		if (!typeIs(rawContent, "string")) return;

		const trimmed = rawContent.gsub("^%s*(.-)%s*$", "%1")[0];
		if (trimmed.size() === 0 || trimmed.size() > SOCIAL_CONFIG.MAX_POST_LENGTH) return;

		// Anti-spam / Cooldown check
		const now = Workspace.GetServerTimeNow();
		const lastPost = this.playerLastPostTimestamps.get(player.UserId) ?? 0;
		if (now - lastPost < SOCIAL_CONFIG.POST_COOLDOWN_SECONDS) {
			return;
		}
		this.playerLastPostTimestamps.set(player.UserId, now);

		// Text filtering
		let filteredText = trimmed;
		const [success, filterResult] = pcall(() => {
			return TextService.FilterStringAsync(trimmed, player.UserId);
		});

		if (success && filterResult) {
			const [broadcastSuccess, broadcastString] = pcall(() => {
				return filterResult.GetNonChatStringForBroadcastAsync();
			});
			if (broadcastSuccess && broadcastString) {
				filteredText = broadcastString;
			}
		}

		const post: StatusPost = {
			id: `post_${player.UserId}_${os.time()}_${math.random(1000, 9999)}`,
			authorUserId: player.UserId,
			authorName: player.Name,
			authorDisplayName: player.DisplayName || player.Name,
			content: filteredText,
			timestamp: os.time(),
			likedByUserIds: [],
		};

		// Insert at beginning of timeline
		this.timeline.unshift(post);
		if (this.timeline.size() > SOCIAL_CONFIG.MAX_TIMELINE_POSTS) {
			this.timeline.pop();
		}

		// Broadcast new post to all connected clients
		this.newPostEvent.FireAllClients(post);
	}

	private handleToggleLike(player: Player, postId: unknown): void {
		if (!typeIs(postId, "string")) return;

		// Anti-spam debounce (0.2s)
		const now = Workspace.GetServerTimeNow();
		const lastLike = this.playerLastLikeTimestamps.get(player.UserId) ?? 0;
		if (now - lastLike < 0.2) {
			return;
		}
		this.playerLastLikeTimestamps.set(player.UserId, now);

		const post = this.timeline.find((p) => p.id === postId);
		if (!post) return;

		const userIndex = post.likedByUserIds.indexOf(player.UserId);
		if (userIndex !== -1) {
			// Unlike
			post.likedByUserIds.unorderedRemove(userIndex);
		} else {
			// Like
			post.likedByUserIds.push(player.UserId);
		}

		// Broadcast like update: postId, likedByUserIds
		this.postLikeUpdatedEvent.FireAllClients(post.id, post.likedByUserIds);
	}

	private handleDeletePost(player: Player, postId: unknown): void {
		if (!typeIs(postId, "string")) return;

		const postIndex = this.timeline.findIndex((p) => p.id === postId);
		if (postIndex === -1) return;

		const post = this.timeline[postIndex];
		// Only author can delete their post
		if (post.authorUserId !== player.UserId) return;

		this.timeline.remove(postIndex);

		// Broadcast deletion to all clients
		this.postDeletedEvent.FireAllClients(postId);
	}
}
