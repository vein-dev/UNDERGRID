import { Players } from "@rbxts/services";
import { isPlayerAdmin } from "shared/config";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import { AdminStateSync, PlayerEntryInfo, StageLightingControlPayload } from "shared/types";
import { ServerMusicService } from "./ServerMusicService";
import { ServerTimeService } from "./ServerTimeService";
import { ServerStageLightingService } from "./ServerStageLightingService";

/**
 * Server singleton service handling authenticated Admin actions:
 * - Stage lighting visual effects
 * - Push announcements broadcast to all players
 * - Gigs music queue guard (Lock & Clear)
 * - Player management (Teleport To & Bring)
 */
export class ServerAdminService {
	private static instance?: ServerAdminService;

	// Remotes
	private adminControlEvent: RemoteEvent;
	private adminQueryFunction: RemoteFunction;
	private adminAnnouncementBroadcast: RemoteEvent;
	private adminStateUpdatedEvent: RemoteEvent;

	private constructor() {
		// Remotes
		this.adminControlEvent = getRemoteEvent("AdminControlEvent");
		this.adminQueryFunction = getRemoteFunction("AdminQueryFunction");
		this.adminAnnouncementBroadcast = getRemoteEvent("AdminAnnouncementBroadcast");
		this.adminStateUpdatedEvent = getRemoteEvent("AdminStateUpdatedEvent");

		this.initRemotes();
	}

	public static getInstance(): ServerAdminService {
		if (!ServerAdminService.instance) {
			ServerAdminService.instance = new ServerAdminService();
		}
		return ServerAdminService.instance;
	}

	private initRemotes(): void {
		// Handle admin state query & player list
		this.adminQueryFunction.OnServerInvoke = (player: Player) => {
			if (!isPlayerAdmin(player)) {
				return undefined;
			}
			return this.getFullState();
		};

		// Handle admin action commands
		this.adminControlEvent.OnServerEvent.Connect((player, actionName, data) => {
			this.handleAdminAction(player, actionName as string, data);
		});

		// Replikasi state awal saat pemain bergabung
		Players.PlayerAdded.Connect((player) => {
			task.defer(() => {
				this.adminStateUpdatedEvent.FireClient(player, this.getState());
			});
		});

		print("[ServerAdminService] Initialized with strict admin verification.");
	}

	private handleAdminAction(player: Player, action: string, data: unknown): void {
		// Zero-Trust Security Verification
		if (!isPlayerAdmin(player)) {
			warn(`[ServerAdminService] Unauthorized action '${action}' attempted by ${player.Name} (${player.UserId})`);
			return;
		}

		switch (action) {
			case "SendAnnouncement": {
				if (typeIs(data, "string") && (data as string).size() > 0) {
					this.broadcastAnnouncement(data as string);
				}
				break;
			}


			case "SetQueueLocked": {
				if (typeIs(data, "boolean")) {
					ServerMusicService.getInstance().setQueueLocked(data as boolean);
					this.broadcastStateUpdate();
				}
				break;
			}

			case "ClearQueue": {
				ServerMusicService.getInstance().clearQueue();
				this.broadcastStateUpdate();
				break;
			}

			case "TeleportTo": {
				if (typeIs(data, "number")) {
					this.teleportAdminToPlayer(player, data as number);
				}
				break;
			}

			case "BringPlayer": {
				if (typeIs(data, "number")) {
					this.bringPlayerToAdmin(player, data as number);
				}
				break;
			}

			case "SetClockTime": {
				if (typeIs(data, "number")) {
					ServerTimeService.getInstance().setClockTime(data as number);
				}
				break;
			}

			case "SetTimeScale": {
				if (typeIs(data, "number")) {
					ServerTimeService.getInstance().setTimeScale(data as number);
				}
				break;
			}

			case "ToggleTimePause": {
				const timeService = ServerTimeService.getInstance();
				if (typeIs(data, "boolean")) {
					if (data as boolean) timeService.pause();
					else timeService.resume();
				} else {
					const currentPaused =
						(game.GetService("ReplicatedStorage").GetAttribute("IsTimePaused") as boolean | undefined) ?? false;
					if (currentPaused) timeService.resume();
					else timeService.pause();
				}
				break;
			}

			case "SetCycleDuration": {
				if (typeIs(data, "number")) {
					ServerTimeService.getInstance().setCycleDurationMinutes(data as number);
				}
				break;
			}

			case "SetStageLightingControl": {
				if (typeIs(data, "table")) {
					ServerStageLightingService.getInstance().applyControl(data as Partial<StageLightingControlPayload>);
					this.broadcastStateUpdate();
				}
				break;
			}

			case "GiveLightingRemote": {
				this.giveLightingRemote(player);
				break;
			}

			default:
				warn(`[ServerAdminService] Unknown action: ${action}`);
		}
	}

	// ─── Push Announcement ───────────────────────────────────────────────────

	private broadcastAnnouncement(text: string): void {
		const trimmed = text.sub(1, 150);
		print(`[ServerAdminService] Broadcasting announcement: "${trimmed}"`);
		this.adminAnnouncementBroadcast.FireAllClients(trimmed);
	}


	// ─── Player Management Actions ───────────────────────────────────────────

	private teleportAdminToPlayer(adminPlayer: Player, targetUserId: number): void {
		const targetPlayer = Players.GetPlayerByUserId(targetUserId);
		if (!targetPlayer) return;

		const adminChar = adminPlayer.Character;
		const targetChar = targetPlayer.Character;

		if (adminChar && targetChar) {
			const adminRoot = adminChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			const targetRoot = targetChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

			if (adminRoot && targetRoot) {
				adminRoot.CFrame = targetRoot.CFrame.mul(new CFrame(2, 0, 3));
				print(`[ServerAdminService] Teleported admin ${adminPlayer.Name} to ${targetPlayer.Name}`);
			}
		}
	}

	private bringPlayerToAdmin(adminPlayer: Player, targetUserId: number): void {
		const targetPlayer = Players.GetPlayerByUserId(targetUserId);
		if (!targetPlayer) return;

		const adminChar = adminPlayer.Character;
		const targetChar = targetPlayer.Character;

		if (adminChar && targetChar) {
			const adminRoot = adminChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			const targetRoot = targetChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

			if (adminRoot && targetRoot) {
				targetRoot.CFrame = adminRoot.CFrame.mul(new CFrame(0, 0, -4));
				print(`[ServerAdminService] Brought ${targetPlayer.Name} to admin ${adminPlayer.Name}`);
			}
		}
	}

	// ─── State Management & Synchronization ──────────────────────────────────

	public getState(): AdminStateSync {
		return {
			isQueueLocked: ServerMusicService.getInstance().getIsQueueLocked(),
			stageLighting: ServerStageLightingService.getInstance().getControlState(),
		};
	}

	public getFullState(): {
		state: AdminStateSync;
		players: PlayerEntryInfo[];
	} {
		const players: PlayerEntryInfo[] = [];
		for (const p of Players.GetPlayers()) {
			players.push({
				userId: p.UserId,
				name: p.Name,
				displayName: p.DisplayName || p.Name,
			});
		}

		return {
			state: this.getState(),
			players,
		};
	}

	private broadcastStateUpdate(): void {
		const state = this.getState();
		this.adminStateUpdatedEvent.FireAllClients(state);
	}

	private giveLightingRemote(player: Player): void {
		const backpack = player.FindFirstChildOfClass("Backpack");
		const character = player.Character;
		if (backpack?.FindFirstChild("LightingRemote") || character?.FindFirstChild("LightingRemote")) {
			return;
		}

		const starterPack = game.GetService("StarterPack");
		const template = starterPack.FindFirstChild("LightingRemote") as Tool | undefined;
		if (template && backpack) {
			const clone = template.Clone();
			clone.Parent = backpack;
		}
	}
}
