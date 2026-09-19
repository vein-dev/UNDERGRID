import { DataStoreService, Players, TextService, Workspace } from "@rbxts/services";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import { ChatMessage } from "shared/types";

const MAX_HISTORY_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 200;
const CHAT_COOLDOWN_SECONDS = 0.5;
const OFFLINE_CHAT_COOLDOWN_SECONDS = 5.0; // Anti-spam rate limit for DataStore writes

/**
 * Server service managing in-game smartphone chat messages, moderation, and offline inbox.
 * Includes rate limiting and DataStore budget safeguards against DoS/exhaustion exploits.
 */
export class ServerChatService {
	private static instance?: ServerChatService;

	private messageHistory: ChatMessage[] = [];
	private playerLastChatTimestamps = new Map<number, number>();
	private playerLastOfflineChatTimestamps = new Map<number, number>();
	private offlineInboxStore?: DataStore;

	private sendChatEvent: RemoteEvent;
	private newChatEvent: RemoteEvent;
	private getHistoryFunction: RemoteFunction;

	private constructor() {
		this.sendChatEvent = getRemoteEvent("SendChatMessageEvent");
		this.newChatEvent = getRemoteEvent("NewChatMessageEvent");
		this.getHistoryFunction = getRemoteFunction("GetChatHistoryFunction");

		pcall(() => {
			this.offlineInboxStore = DataStoreService.GetDataStore("PlayerOfflineChatInbox_v1");
		});

		this.init();
	}

	public static getInstance(): ServerChatService {
		if (!ServerChatService.instance) {
			ServerChatService.instance = new ServerChatService();
		}
		return ServerChatService.instance;
	}

	private init(): void {
		// Return history relevant to requesting player (direct messages only)
		this.getHistoryFunction.OnServerInvoke = (player: Player) => {
			return this.messageHistory.filter((msg) => {
				return (
					msg.recipientUserId === player.UserId ||
					msg.senderUserId === player.UserId
				);
			});
		};

		// Listen to incoming messages from players
		this.sendChatEvent.OnServerEvent.Connect((player, rawContent, recipientUserId) => {
			this.handleIncomingMessage(player, rawContent, recipientUserId as number | undefined);
		});

		// Check and deliver offline messages when players join
		Players.PlayerAdded.Connect((player) => {
			this.deliverOfflineMessages(player);
		});

		// Cleanup memory maps when players leave
		Players.PlayerRemoving.Connect((player) => {
			this.playerLastChatTimestamps.delete(player.UserId);
			this.playerLastOfflineChatTimestamps.delete(player.UserId);
		});

		for (const p of Players.GetPlayers()) {
			this.deliverOfflineMessages(p);
		}

		print("[ServerChatService] Initialized successfully with DataStore security safeguards.");
	}

	private handleIncomingMessage(player: Player, rawContent: unknown, recipientUserId?: number): void {
		if (!typeIs(rawContent, "string")) return;

		const trimmed = rawContent.gsub("^%s*(.-)%s*$", "%1")[0];
		if (trimmed.size() === 0 || trimmed.size() > MAX_MESSAGE_LENGTH) return;

		// 1. General Chat Cooldown / Anti-spam check
		const now = Workspace.GetServerTimeNow();
		const lastChat = this.playerLastChatTimestamps.get(player.UserId) ?? 0;
		if (now - lastChat < CHAT_COOLDOWN_SECONDS) {
			return;
		}
		this.playerLastChatTimestamps.set(player.UserId, now);

		// 2. Validate recipientUserId (must be valid positive integer and not self)
		let validRecipientId: number | undefined;
		if (typeIs(recipientUserId, "number") && recipientUserId > 0 && math.floor(recipientUserId) === recipientUserId) {
			if (recipientUserId !== player.UserId) {
				validRecipientId = recipientUserId;
			}
		}

		if (validRecipientId === undefined) {
			return;
		}

		// 3. Filter text using Roblox TextService (Safe pcall fallback for Studio local tests)
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

		const message: ChatMessage = {
			id: `msg_${player.UserId}_${os.time()}_${math.random(1000, 9999)}`,
			senderUserId: player.UserId,
			senderName: player.Name,
			senderDisplayName: player.DisplayName || player.Name,
			recipientUserId: validRecipientId,
			content: filteredText,
			timestamp: os.time(),
		};

		// Append to history
		this.messageHistory.push(message);
		if (this.messageHistory.size() > MAX_HISTORY_MESSAGES) {
			this.messageHistory.shift();
		}

		// Route message: Direct Message (local server or offline inbox)
		// Send back to sender
		this.newChatEvent.FireClient(player, message);

		// Send to recipient if currently in this server
		const recipientPlayer = Players.GetPlayerByUserId(validRecipientId);
		if (recipientPlayer && recipientPlayer !== player) {
			this.newChatEvent.FireClient(recipientPlayer, message);
		} else if (!recipientPlayer) {
			// Recipient is outside this server!
			// Apply Offline Chat Rate Limit to prevent DataStore request spam
			const lastOffline = this.playerLastOfflineChatTimestamps.get(player.UserId) ?? 0;
			if (now - lastOffline < OFFLINE_CHAT_COOLDOWN_SECONDS) {
				warn(
					`[ServerChatService] Player ${player.Name} rate-limited on offline message to ${validRecipientId} (cooldown: ${OFFLINE_CHAT_COOLDOWN_SECONDS}s)`,
				);
				return;
			}
			this.playerLastOfflineChatTimestamps.set(player.UserId, now);

			message.isOfflineMessage = true;
			this.saveOfflineMessage(validRecipientId, message);
		}
	}

	private saveOfflineMessage(recipientUserId: number, message: ChatMessage): void {
		const store = this.offlineInboxStore;
		if (!store) return;

		// Check DataStore write budget before calling UpdateAsync
		const budget = DataStoreService.GetRequestBudgetForRequestType(Enum.DataStoreRequestType.UpdateAsync);
		if (budget <= 2) {
			warn(
				`[ServerChatService] DataStore UpdateAsync budget critically low (${budget}), dropping offline message to safeguard data.`,
			);
			return;
		}

		task.spawn(() => {
			const [success, err] = pcall(() => {
				store.UpdateAsync(tostring(recipientUserId), (oldData: unknown) => {
					let list: ChatMessage[] = [];
					if (typeIs(oldData, "table")) {
						list = oldData as ChatMessage[];
					}
					list.push(message);
					if (list.size() > 50) {
						list.shift(); // keep max 50 pending
					}
					return $tuple(list);
				});
			});
			if (!success) {
				warn(`[ServerChatService] Failed to save offline message: ${tostring(err)}`);
			} else {
				print(`[ServerChatService] Saved offline message for UserId: ${recipientUserId}`);
			}
		});
	}

	private deliverOfflineMessages(player: Player): void {
		const store = this.offlineInboxStore;
		if (!store) return;

		task.spawn(() => {
			// Wait slightly to let client UI and network remotes mount
			task.wait(2.5);
			if (!player.IsDescendantOf(Players)) return;

			// Check DataStore read budget
			const budget = DataStoreService.GetRequestBudgetForRequestType(Enum.DataStoreRequestType.GetAsync);
			if (budget <= 1) {
				warn(`[ServerChatService] DataStore GetAsync budget low (${budget}), skipping offline delivery for now.`);
				return;
			}

			const [success, messages] = pcall(() => {
				const [data] = store.GetAsync<ChatMessage[]>(tostring(player.UserId));
				return data;
			});

			if (success && messages && typeIs(messages, "table") && messages.size() > 0) {
				// Remove delivered messages from store
				pcall(() => {
					store.RemoveAsync(tostring(player.UserId));
				});

				for (const msg of messages) {
					this.messageHistory.push(msg);
					if (player.IsDescendantOf(Players)) {
						this.newChatEvent.FireClient(player, msg);
					}
				}
				print(`[ServerChatService] Delivered ${messages.size()} offline message(s) to ${player.Name}`);
			}
		});
	}
}
