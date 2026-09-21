import { Lighting, Players } from "@rbxts/services";
import { isPlayerAdmin } from "shared/config";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import { AdminStateSync, AtmospherePreset, PlayerEntryInfo, StageLightMode, StageLightingControlPayload } from "shared/types";
import { ServerMusicService } from "./ServerMusicService";
import { ServerTimeService } from "./ServerTimeService";
import { ServerStageLightingService } from "./ServerStageLightingService";

/**
 * Server singleton service handling authenticated Admin actions:
 * - Stage & Atmosphere visual effects
 * - Push announcements broadcast to all players
 * - Gigs music queue guard (Lock & Clear)
 * - Player management (Teleport To & Bring)
 */
export class ServerAdminService {
	private static instance?: ServerAdminService;

	private activePresets = new Set<AtmospherePreset>();
	private strobeThread?: thread;

	// Saved initial lighting parameters to restore after Blackout/Strobe
	private originalBrightness: number;
	private originalClockTime: number;
	private originalAmbient: Color3;
	private originalOutdoorAmbient: Color3;

	// Remotes
	private adminControlEvent: RemoteEvent;
	private adminQueryFunction: RemoteFunction;
	private adminAnnouncementBroadcast: RemoteEvent;
	private adminStateUpdatedEvent: RemoteEvent;

	private constructor() {
		// Cache original lighting
		this.originalBrightness = Lighting.Brightness;
		this.originalClockTime = Lighting.ClockTime;
		this.originalAmbient = Lighting.Ambient;
		this.originalOutdoorAmbient = Lighting.OutdoorAmbient;

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

			case "ToggleAtmospherePreset": {
				if (typeIs(data, "string")) {
					this.toggleAtmospherePreset(data as AtmospherePreset);
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

	// ─── Stage & Atmosphere Presets ──────────────────────────────────────────

	private toggleAtmospherePreset(preset: AtmospherePreset): void {
		const isCurrentlyActive = this.activePresets.has(preset);

		if (isCurrentlyActive) {
			this.activePresets.delete(preset);
			this.deactivatePreset(preset);
		} else {
			this.activePresets.add(preset);
			this.activatePreset(preset);
		}

		this.broadcastStateUpdate();
	}

	private activatePreset(preset: AtmospherePreset): void {
		print(`[ServerAdminService] Activating Atmosphere Preset: ${preset}`);
		const stageLighting = ServerStageLightingService.getInstance();

		switch (preset) {
			case AtmospherePreset.Blackout: {
				ServerTimeService.getInstance().setAdminOverride(true);
				Lighting.Brightness = 0;
				Lighting.ClockTime = 0;
				Lighting.Ambient = Color3.fromHex("#020206");
				Lighting.OutdoorAmbient = Color3.fromHex("#000000");
				stageLighting.setMode(StageLightMode.Off);
				break;
			}

			case AtmospherePreset.Strobe: {
				if (this.strobeThread) task.cancel(this.strobeThread);
				stageLighting.setMode(StageLightMode.Strobe);
				this.strobeThread = task.spawn(() => {
					let flag = false;
					while (this.activePresets.has(AtmospherePreset.Strobe)) {
						flag = !flag;
						Lighting.Brightness = flag ? 3 : 0.2;
						Lighting.Ambient = flag ? Color3.fromHex("#b4b4dc") : Color3.fromHex("#0a0a14");
						task.wait(0.12);
					}
				});
				break;
			}

			case AtmospherePreset.Spotlight: {
				Lighting.Brightness = 2.5;
				Lighting.Ambient = Color3.fromHex("#282d4b");
				Lighting.OutdoorAmbient = Color3.fromHex("#141626");
				stageLighting.setMode(StageLightMode.SpotlightCenter);
				break;
			}

			case AtmospherePreset.FogMachine: {
				Lighting.FogStart = 0;
				Lighting.FogEnd = 90;
				Lighting.FogColor = Color3.fromHex("#191c30");
				break;
			}
		}
	}

	private deactivatePreset(preset: AtmospherePreset): void {
		print(`[ServerAdminService] Deactivating Atmosphere Preset: ${preset}`);
		const stageLighting = ServerStageLightingService.getInstance();

		if (preset === AtmospherePreset.Strobe && this.strobeThread) {
			task.cancel(this.strobeThread);
			this.strobeThread = undefined;
			if (!this.activePresets.has(AtmospherePreset.Spotlight)) {
				stageLighting.setMode(StageLightMode.Off);
			}
		}

		if (preset === AtmospherePreset.Spotlight) {
			if (!this.activePresets.has(AtmospherePreset.Strobe)) {
				stageLighting.setMode(StageLightMode.Off);
			}
		}

		if (preset === AtmospherePreset.Blackout) {
			ServerTimeService.getInstance().setAdminOverride(false);
		}

		// Restore lighting defaults if no blackout/strobe is active
		if (!this.activePresets.has(AtmospherePreset.Blackout) && !this.activePresets.has(AtmospherePreset.Strobe)) {
			Lighting.Brightness = this.originalBrightness;
			Lighting.ClockTime = ServerTimeService.getInstance().getClockTime();
			Lighting.Ambient = this.originalAmbient;
			Lighting.OutdoorAmbient = this.originalOutdoorAmbient;
		}

		if (preset === AtmospherePreset.FogMachine) {
			Lighting.FogStart = 0;
			Lighting.FogEnd = 10000;
		}
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
		const presetsArray: AtmospherePreset[] = [];
		for (const p of this.activePresets) {
			presetsArray.push(p);
		}

		return {
			isQueueLocked: ServerMusicService.getInstance().getIsQueueLocked(),
			activePresets: presetsArray,
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
}
