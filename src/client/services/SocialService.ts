import { Players } from "@rbxts/services";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import { StatusPost } from "shared/types";

type NewPostCallback = (post: StatusPost) => void;
type LikeUpdatedCallback = (postId: string, likedByUserIds: number[]) => void;
type PostDeletedCallback = (postId: string) => void;
type UnreadCountCallback = (count: number) => void;

/**
 * Singleton client service managing social media state, network events, and caches.
 */
export class SocialService {
	private static instance?: SocialService;

	private timeline: StatusPost[] = [];
	private unreadCount = 0;
	private lastLikeToggleTime = 0;

	private newPostCallbacks: NewPostCallback[] = [];
	private likeUpdatedCallbacks: LikeUpdatedCallback[] = [];
	private postDeletedCallbacks: PostDeletedCallback[] = [];
	private unreadCountCallbacks: UnreadCountCallback[] = [];

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

		this.initNetwork();
	}

	public static getInstance(): SocialService {
		if (!SocialService.instance) {
			SocialService.instance = new SocialService();
		}
		return SocialService.instance;
	}

	private initNetwork(): void {
		// New post received
		this.newPostEvent.OnClientEvent.Connect((data: unknown) => {
			if (typeIs(data, "table")) {
				const post = data as unknown as StatusPost;

				// Avoid duplicates
				const existingIdx = this.timeline.findIndex((p) => p.id === post.id);
				if (existingIdx !== -1) {
					this.timeline[existingIdx] = post;
				} else {
					this.timeline.unshift(post);
				}

				const isFromOther = post.authorUserId !== Players.LocalPlayer.UserId;
				if (isFromOther) {
					this.unreadCount++;
					for (const cb of this.unreadCountCallbacks) cb(this.unreadCount);
				}

				for (const cb of this.newPostCallbacks) cb(post);
			}
		});

		// Like updated
		this.postLikeUpdatedEvent.OnClientEvent.Connect((postId: unknown, likedByUserIds: unknown) => {
			if (typeIs(postId, "string") && typeIs(likedByUserIds, "table")) {
				const post = this.timeline.find((p) => p.id === postId);
				if (post) {
					post.likedByUserIds = likedByUserIds as number[];
				}
				for (const cb of this.likeUpdatedCallbacks) {
					cb(postId, likedByUserIds as number[]);
				}
			}
		});

		// Post deleted
		this.postDeletedEvent.OnClientEvent.Connect((postId: unknown) => {
			if (typeIs(postId, "string")) {
				const idx = this.timeline.findIndex((p) => p.id === postId);
				if (idx !== -1) {
					this.timeline.remove(idx);
				}
				for (const cb of this.postDeletedCallbacks) {
					cb(postId);
				}
			}
		});
	}

	/**
	 * Send a new status update to server.
	 */
	public createPost(content: string): void {
		if (content.size() === 0) return;
		this.createPostEvent.FireServer(content);
	}

	/**
	 * Toggle like on a status post with optimistic local update and debounce.
	 */
	public toggleLike(postId: string): void {
		const now = os.clock();
		if (now - this.lastLikeToggleTime < 0.25) {
			return;
		}
		this.lastLikeToggleTime = now;

		// Optimistic update for instant visual responsiveness
		const localPlayer = Players.LocalPlayer;
		if (localPlayer) {
			const post = this.timeline.find((p) => p.id === postId);
			if (post) {
				const userIndex = post.likedByUserIds.indexOf(localPlayer.UserId);
				if (userIndex !== -1) {
					post.likedByUserIds.unorderedRemove(userIndex);
				} else {
					post.likedByUserIds.push(localPlayer.UserId);
				}
				for (const cb of this.likeUpdatedCallbacks) {
					cb(postId, [...post.likedByUserIds]);
				}
			}
		}

		this.toggleLikeEvent.FireServer(postId);
	}

	/**
	 * Delete a post authored by the local player.
	 */
	public deletePost(postId: string): void {
		this.deletePostEvent.FireServer(postId);
	}

	/**
	 * Fetch latest timeline from server.
	 */
	public async fetchTimeline(): Promise<StatusPost[]> {
		try {
			const data = this.getTimelineFunction.InvokeServer() as StatusPost[];
			if (typeIs(data, "table")) {
				this.timeline = data;
				return this.timeline;
			}
		} catch (err) {
			warn(`[SocialService] Failed to fetch timeline: ${tostring(err)}`);
		}
		return this.timeline;
	}

	public getTimeline(): StatusPost[] {
		return this.timeline;
	}

	public getUnreadCount(): number {
		return this.unreadCount;
	}

	public markAsRead(): void {
		if (this.unreadCount > 0) {
			this.unreadCount = 0;
			for (const cb of this.unreadCountCallbacks) cb(0);
		}
	}

	public onNewPost(cb: NewPostCallback): () => void {
		this.newPostCallbacks.push(cb);
		return () => {
			const idx = this.newPostCallbacks.indexOf(cb);
			if (idx !== -1) this.newPostCallbacks.unorderedRemove(idx);
		};
	}

	public onLikeUpdated(cb: LikeUpdatedCallback): () => void {
		this.likeUpdatedCallbacks.push(cb);
		return () => {
			const idx = this.likeUpdatedCallbacks.indexOf(cb);
			if (idx !== -1) this.likeUpdatedCallbacks.unorderedRemove(idx);
		};
	}

	public onPostDeleted(cb: PostDeletedCallback): () => void {
		this.postDeletedCallbacks.push(cb);
		return () => {
			const idx = this.postDeletedCallbacks.indexOf(cb);
			if (idx !== -1) this.postDeletedCallbacks.unorderedRemove(idx);
		};
	}

	public onUnreadCountChanged(cb: UnreadCountCallback): () => void {
		this.unreadCountCallbacks.push(cb);
		return () => {
			const idx = this.unreadCountCallbacks.indexOf(cb);
			if (idx !== -1) this.unreadCountCallbacks.unorderedRemove(idx);
		};
	}

	public destroy(): void {
		this.newPostCallbacks = [];
		this.likeUpdatedCallbacks = [];
		this.postDeletedCallbacks = [];
		this.unreadCountCallbacks = [];
		SocialService.instance = undefined;
	}
}
