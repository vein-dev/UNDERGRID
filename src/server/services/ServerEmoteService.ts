import { Players } from "@rbxts/services";
import { getRemoteEvent } from "shared/network";
import { EMOTE_CONFIG } from "shared/config";

/**
 * ServerEmoteService - Manages emote reactions and broadcasts them across all clients.
 * Enforces rate-limiting to prevent spamming.
 */
export class ServerEmoteService {
	private static instance?: ServerEmoteService;
	private reactionEvent: RemoteEvent;
	private playerLastReaction = new Map<number, number>();

	private constructor() {
		this.reactionEvent = getRemoteEvent("EmoteReactionEvent");
	}

	public static getInstance(): ServerEmoteService {
		if (!ServerEmoteService.instance) {
			ServerEmoteService.instance = new ServerEmoteService();
		}
		return ServerEmoteService.instance;
	}

	public init(): void {
		// Listen for reaction & emote state requests from clients
		this.reactionEvent.OnServerEvent.Connect((player, action, data) => {
			if (action === "SendReaction" && typeIs(data, "string")) {
				this.handleSendReaction(player, data);
			} else if (action === "StartEmote" && typeIs(data, "string")) {
				const char = player.Character;
				if (char) char.SetAttribute("ActiveEmoteId", data);
			} else if (action === "StopEmote") {
				const char = player.Character;
				if (char) char.SetAttribute("ActiveEmoteId", "");
			}
		});

		const bindPlayerChar = (player: Player) => {
			const setupChar = (char: Model) => {
				char.SetAttribute("ActiveEmoteId", "");
				char.ChildAdded.Connect((child) => {
					if (child.IsA("Tool")) {
						char.SetAttribute("ActiveEmoteId", "");
					}
				});
			};

			player.CharacterAdded.Connect(setupChar);
			if (player.Character) setupChar(player.Character);
		};

		Players.PlayerAdded.Connect(bindPlayerChar);
		for (const p of Players.GetPlayers()) {
			bindPlayerChar(p);
		}

		Players.PlayerRemoving.Connect((player) => {
			this.playerLastReaction.delete(player.UserId);
		});

		print("[ServerEmoteService] Initialized successfully with reaction & emote state replication.");
	}

	private handleSendReaction(player: Player, emoji: string): void {
		const character = player.Character;
		if (!character) return;
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid || humanoid.Health <= 0) return;

		// Anti-spam cooldown check
		const now = os.clock();
		const lastTime = this.playerLastReaction.get(player.UserId) ?? 0;
		if (now - lastTime < EMOTE_CONFIG.ReactionCooldown) {
			return;
		}
		this.playerLastReaction.set(player.UserId, now);

		// Broadcast reaction to all clients so everyone sees the floating emoticon
		this.reactionEvent.FireAllClients(
			"PlayReaction",
			player,
			emoji,
			EMOTE_CONFIG.ReactionDuration,
		);
	}
}
