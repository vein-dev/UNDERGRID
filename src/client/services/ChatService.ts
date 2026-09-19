import { Players } from "@rbxts/services";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import { ChatMessage, ContactInfo } from "shared/types";

type MessageReceivedCallback = (message: ChatMessage) => void;

/**
 * Singleton client service managing chat communication with ServerChatService.
 */
export class ChatService {
	private static instance?: ChatService;

	private messages: ChatMessage[] = [];
	private messageReceivedCallbacks: MessageReceivedCallback[] = [];
	private incomingMessageCallbacks: Array<(message: ChatMessage) => void> = [];
	private unreadCountChangedCallbacks: Array<(count: number) => void> = [];
	private unreadCount = 0;

	private sendChatEvent: RemoteEvent;
	private newChatEvent: RemoteEvent;
	private getHistoryFunction: RemoteFunction;

	private constructor() {
		this.sendChatEvent = getRemoteEvent("SendChatMessageEvent");
		this.newChatEvent = getRemoteEvent("NewChatMessageEvent");
		this.getHistoryFunction = getRemoteFunction("GetChatHistoryFunction");

		this.initNetwork();
	}

	public static getInstance(): ChatService {
		if (!ChatService.instance) {
			ChatService.instance = new ChatService();
		}
		return ChatService.instance;
	}

	private initNetwork(): void {
		this.newChatEvent.OnClientEvent.Connect((data: unknown) => {
			if (typeIs(data, "table")) {
				const message = data as unknown as ChatMessage;
				this.messages.push(message);

				const isIncoming = message.senderUserId !== Players.LocalPlayer.UserId;
				if (isIncoming) {
					this.unreadCount++;
					for (const cb of this.unreadCountChangedCallbacks) {
						cb(this.unreadCount);
					}
					for (const cb of this.incomingMessageCallbacks) {
						cb(message);
					}
				}

				for (const cb of this.messageReceivedCallbacks) {
					cb(message);
				}
			}
		});
	}

	/**
	 * Sends a chat message to the server, optionally targeted as a DM to recipientUserId.
	 */
	public sendMessage(content: string, recipientUserId?: number): void {
		if (content.size() === 0) return;
		this.sendChatEvent.FireServer(content, recipientUserId);
	}

	/**
	 * Fetches the recent chat history from the server.
	 */
	public async fetchHistory(): Promise<ChatMessage[]> {
		try {
			const history = this.getHistoryFunction.InvokeServer() as ChatMessage[];
			if (typeIs(history, "table")) {
				this.messages = history;
				return history;
			}
		} catch (err) {
			warn(`[ChatService] Failed to fetch history: ${tostring(err)}`);
		}
		return this.messages;
	}

	/**
	 * Retrieves contacts combining in-server players, online friends, and offline friends.
	 */
	public async getContacts(): Promise<ContactInfo[]> {
		const contactsMap = new Map<number, ContactInfo>();
		const localPlayer = Players.LocalPlayer;

		// 1. Players in current server (Online - Dalam server)
		for (const p of Players.GetPlayers()) {
			if (p !== localPlayer) {
				contactsMap.set(p.UserId, {
					userId: p.UserId,
					displayName: p.DisplayName || p.Name,
					userName: p.Name,
					isOnline: true,
					isInServer: true,
				});
			}
		}

		// 2. Online friends outside this server (Online - Di luar server)
		const [onlineSuccess, onlineFriends] = pcall(() => {
			return localPlayer.GetFriendsOnline(100);
		});

		if (onlineSuccess && typeIs(onlineFriends, "table")) {
			for (const f of onlineFriends as Array<{ VisitorId: number; UserName: string; DisplayName: string; IsOnline: boolean }>) {
				if (!contactsMap.has(f.VisitorId)) {
					contactsMap.set(f.VisitorId, {
						userId: f.VisitorId,
						displayName: f.DisplayName || f.UserName,
						userName: f.UserName,
						isOnline: true,
						isInServer: false,
					});
				}
			}
		}

		// 3. All friends via GetFriendsAsync to include Offline friends
		const [friendsSuccess, friendPages] = pcall(() => {
			return Players.GetFriendsAsync(localPlayer.UserId as unknown as User);
		});

		if (friendsSuccess && friendPages) {
			const page = friendPages.GetCurrentPage() as unknown as Array<{
				Id: number;
				Username: string;
				DisplayName?: string;
				IsOnline?: boolean;
			}>;
			for (const f of page) {
				if (!contactsMap.has(f.Id)) {
					contactsMap.set(f.Id, {
						userId: f.Id,
						displayName: f.DisplayName || f.Username,
						userName: f.Username,
						isOnline: f.IsOnline === true,
						isInServer: false,
					});
				}
			}
		}

		// 4. Include previous direct message conversation partners from history
		for (const msg of this.messages) {
			const otherUserId =
				msg.senderUserId === localPlayer.UserId ? msg.recipientUserId : msg.senderUserId;
			if (otherUserId !== undefined && otherUserId > 0 && !contactsMap.has(otherUserId)) {
				const inServerPlayer = Players.GetPlayerByUserId(otherUserId);
				contactsMap.set(otherUserId, {
					userId: otherUserId,
					displayName: inServerPlayer
						? inServerPlayer.DisplayName || inServerPlayer.Name
						: msg.senderUserId === otherUserId
						? msg.senderDisplayName || msg.senderName
						: `User_${otherUserId}`,
					userName: inServerPlayer
						? inServerPlayer.Name
						: msg.senderUserId === otherUserId
						? msg.senderName
						: `user_${otherUserId}`,
					isOnline: inServerPlayer !== undefined,
					isInServer: inServerPlayer !== undefined,
				});
			}
		}

		const result: ContactInfo[] = [];
		contactsMap.forEach((c) => result.push(c));

		// Sort order:
		// 1. Online - Dalam server (rank 1)
		// 2. Online - Di luar server (rank 2)
		// 3. Offline (rank 3)
		// Secondary: Alphabetical by displayName
		const getRank = (c: ContactInfo) => {
			if (c.isInServer) return 1;
			if (c.isOnline) return 2;
			return 3;
		};

		result.sort((a, b) => {
			const rankA = getRank(a);
			const rankB = getRank(b);
			if (rankA !== rankB) return rankA < rankB;
			return a.displayName.lower() < b.displayName.lower();
		});

		return result;
	}

	public getMessages(): ChatMessage[] {
		return this.messages;
	}

	public getUnreadCount(): number {
		return this.unreadCount;
	}

	public markAsRead(): void {
		if (this.unreadCount > 0) {
			this.unreadCount = 0;
			for (const cb of this.unreadCountChangedCallbacks) {
				cb(0);
			}
		}
	}

	public onUnreadCountChanged(cb: (count: number) => void): () => void {
		this.unreadCountChangedCallbacks.push(cb);
		return () => {
			const idx = this.unreadCountChangedCallbacks.indexOf(cb);
			if (idx !== -1) {
				this.unreadCountChangedCallbacks.unorderedRemove(idx);
			}
		};
	}

	public onIncomingMessage(cb: (message: ChatMessage) => void): () => void {
		this.incomingMessageCallbacks.push(cb);
		return () => {
			const idx = this.incomingMessageCallbacks.indexOf(cb);
			if (idx !== -1) {
				this.incomingMessageCallbacks.unorderedRemove(idx);
			}
		};
	}

	public onMessageReceived(cb: MessageReceivedCallback): () => void {
		this.messageReceivedCallbacks.push(cb);
		return () => {
			const idx = this.messageReceivedCallbacks.indexOf(cb);
			if (idx !== -1) {
				this.messageReceivedCallbacks.unorderedRemove(idx);
			}
		};
	}

	public destroy(): void {
		this.messageReceivedCallbacks = [];
		this.incomingMessageCallbacks = [];
		this.unreadCountChangedCallbacks = [];
		ChatService.instance = undefined;
	}
}
