import { DataStoreService, Players, RunService, ServerStorage, TeleportService, TextChatService } from "@rbxts/services";
import { isPlayerAdmin, isPlayerOwner, AdminConfig } from "shared/config";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import {
	AdminStateSync,
	BanRecord,
	PlayerEntryInfo,
	StageCameraControlPayload,
	StageLightingControlPayload,
	StageTarget,
} from "shared/types";
import { ServerMusicService } from "./ServerMusicService";
import { ServerTimeService } from "./ServerTimeService";
import { ServerStageLightingService } from "./ServerStageLightingService";
import { ServerAfkService } from "./ServerAfkService";

/**
 * Server singleton service handling authenticated Admin actions:
 * - Stage lighting visual effects
 * - Push announcements broadcast to all players
 * - Gigs music queue guard (Lock & Clear)
 * - Player management (Teleport To, Bring, Kick, Ban, Unban)
 */
export class ServerAdminService {
	private static instance?: ServerAdminService;

	// Remotes
	private adminControlEvent: RemoteEvent;
	private adminQueryFunction: RemoteFunction;
	private adminAnnouncementBroadcast: RemoteEvent;
	private adminStateUpdatedEvent: RemoteEvent;
	private adminFlyToggleEvent: RemoteEvent;
	private adminBansUpdatedEvent: RemoteEvent;

	// Moderation Ban Storage
	private banDataStore?: DataStore;
	private bannedPlayers = new Map<number, BanRecord>();

	// Cooldown tracker untuk public !re
	private playerLastRefreshTimestamps = new Map<number, number>();

	// Cache timestamp perintah yang sudah dieksekusi oleh TextChatService agar tidak dieksekusi 2x
	private processedCommandTimestamps = new Map<string, number>();

	// Status server restart
	private isServerRestarting = false;

	// Stage Camera broadcast state
	private stageCameraControlState: StageCameraControlPayload = {
		enabled: false,
		mode: "default",
		shake: "none",
		faceDistance: 4.0,
		fov: 70,
		orbitSpeed: 0.5,
		fixedCamIndex: 1,
	};

	private constructor() {
		// Remotes
		this.adminControlEvent = getRemoteEvent("AdminControlEvent");
		this.adminQueryFunction = getRemoteFunction("AdminQueryFunction");
		this.adminAnnouncementBroadcast = getRemoteEvent("AdminAnnouncementBroadcast");
		this.adminStateUpdatedEvent = getRemoteEvent("AdminStateUpdatedEvent");
		this.adminFlyToggleEvent = getRemoteEvent("AdminFlyToggleEvent");
		this.adminBansUpdatedEvent = getRemoteEvent("AdminBansUpdatedEvent");

		this.initDataStore();
		this.initRemotes();
		this.initTextChatService();
	}

	public static getInstance(): ServerAdminService {
		if (!ServerAdminService.instance) {
			ServerAdminService.instance = new ServerAdminService();
		}
		return ServerAdminService.instance;
	}

	private initRemotes(): void {
		// Handle admin state query & player list & banned list
		this.adminQueryFunction.OnServerInvoke = (player: Player, queryType?: unknown) => {
			if (!isPlayerAdmin(player)) {
				return undefined;
			}
			if (queryType === "GetBannedList") {
				return this.getBannedList();
			}
			return this.getFullState();
		};

		// Handle admin action commands
		this.adminControlEvent.OnServerEvent.Connect((player, actionName, data) => {
			this.handleAdminAction(player, actionName as string, data);
		});

		// Periksa apakah server saat ini adalah reserved transit server (penampungan saat restart)
		const isReservedTransitServer = game.PrivateServerId !== "" && game.PrivateServerOwnerId === 0;
		if (isReservedTransitServer) {
			this.handleRestartTransitServer();
		}

		// Replikasi state awal & penanganan LightingRemote khusus Admin / Developer
		const handlePlayerLifecycle = (player: Player) => {
			if (this.isServerRestarting) {
				player.Kick("[SERVER RESTART]\n\nSERVER UPDATE IN PROGRESS...\nPlease join back in a few seconds.");
				return;
			}

			// Moderation Ban Check
			const banInfo = this.bannedPlayers.get(player.UserId);
			if (banInfo) {
				const now = os.time();
				if (banInfo.durationSeconds === 0 || now - banInfo.bannedAt < banInfo.durationSeconds) {
					const remainingSec =
						banInfo.durationSeconds > 0 ? banInfo.bannedAt + banInfo.durationSeconds - now : 0;
					const durMsg =
						banInfo.durationSeconds === 0 ? "Permanen" : `${math.ceil(remainingSec / 60)} menit tersisa`;
					player.Kick(
						`[UNDERGRID SECURITY - BANNED]\n\nAlasan: ${banInfo.reason}\nOleh: ${banInfo.bannedBy}\nDurasi: ${durMsg}`,
					);
					return;
				} else {
					this.bannedPlayers.delete(player.UserId);
					this.saveBansToDataStore();
				}
			}

			task.defer(() => {
				this.adminStateUpdatedEvent.FireClient(player, this.getState());
			});

			player.Chatted.Connect((message) => {
				const cacheKey = `${player.UserId}_${message}`;
				const lastTime = this.processedCommandTimestamps.get(cacheKey);
				if (lastTime && os.clock() - lastTime < 3) {
					return;
				}
				this.handleAdminChatCommand(player, message);
			});

			player.CharacterAdded.Connect(() => {
				task.wait(0.3);
				this.stripStageController(player);
			});
			if (player.Character) {
				task.defer(() => this.stripStageController(player));
			}
			this.stripStageController(player);
		};

		Players.PlayerAdded.Connect(handlePlayerLifecycle);
		for (const p of Players.GetPlayers()) {
			handlePlayerLifecycle(p);
		}

		print("[ServerAdminService] Initialized with strict admin verification.");
	}

	/**
	 * Menangani server penampungan sementara (Reserved Transit Server) pada alur Soft Shutdown.
	 * Menunggu beberapa detik hingga server publik lama benar-benar mati di cloud Roblox,
	 * lalu mengembalikan seluruh pemain ke main place publik agar server baru dengan versi update terbuat.
	 */
	private handleRestartTransitServer(): void {
		print(
			"[ServerAdminService] Reserved Transit Server terdeteksi. Mempersiapkan pengembalian pemain ke server publik baru...",
		);
		let isReturning = false;

		const returnPlayersToMain = () => {
			if (isReturning) return;
			isReturning = true;

			// Jeda 2.5 detik agar server publik lama berkesempatan ditutup karena 0 pemain
			task.delay(2.5, () => {
				const players = Players.GetPlayers();
				if (players.size() === 0) return;

				print(`[ServerAdminService] Mengembalikan ${players.size()} pemain ke server publik baru...`);
				this.broadcastAnnouncement("SERVER HAS BEEN UPDATED. CONNECTING YOU TO THE NEW SERVER...");

				const [success, err] = pcall(() => {
					TeleportService.TeleportAsync(game.PlaceId, players);
				});

				if (!success) {
					warn(`[ServerAdminService] Teleport balik gagal: ${tostring(err)}. Mencoba lagi dalam 2 detik...`);
					task.delay(2, () => {
						const remaining = Players.GetPlayers();
						if (remaining.size() > 0) {
							pcall(() => TeleportService.TeleportAsync(game.PlaceId, remaining));
						}
					});
				}
			});
		};

		Players.PlayerAdded.Connect(() => {
			task.defer(() => {
				this.broadcastAnnouncement("RECONNECTING TO NEW SERVER...");
			});
			returnPlayersToMain();
		});

		if (Players.GetPlayers().size() > 0) {
			returnPlayersToMain();
		}
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

			case "KickPlayer": {
				if (typeIs(data, "table")) {
					const payload = data as { targetUserId?: number; reason?: string };
					if (payload.targetUserId !== undefined) {
						this.kickPlayer(player, payload.targetUserId, payload.reason);
					}
				} else if (typeIs(data, "number")) {
					this.kickPlayer(player, data as number);
				}
				break;
			}

			case "BanPlayer": {
				if (typeIs(data, "table")) {
					const payload = data as { targetUserId?: number; reason?: string; durationSeconds?: number };
					if (payload.targetUserId !== undefined) {
						this.banPlayer(player, payload.targetUserId, payload.reason, payload.durationSeconds);
					}
				} else if (typeIs(data, "number")) {
					this.banPlayer(player, data as number);
				}
				break;
			}

			case "UnbanPlayer": {
				if (typeIs(data, "table")) {
					const payload = data as { targetUserId?: number };
					if (payload.targetUserId !== undefined) {
						this.unbanPlayer(player, payload.targetUserId);
					}
				} else if (typeIs(data, "number")) {
					this.unbanPlayer(player, data as number);
				}
				break;
			}

			case "BanByUsername": {
				if (typeIs(data, "table")) {
					const payload = data as { username?: string; reason?: string; durationSeconds?: number };
					if (payload.username !== undefined && payload.username.size() > 0) {
						this.banByUsername(player, payload.username, payload.reason, payload.durationSeconds);
					}
				}
				break;
			}

			case "UnbanByUsername": {
				if (typeIs(data, "table")) {
					const payload = data as { username?: string };
					if (payload.username !== undefined && payload.username.size() > 0) {
						this.unbanByUsername(player, payload.username);
					}
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
						(game.GetService("ReplicatedStorage").GetAttribute("IsTimePaused") as boolean | undefined) ??
						false;
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
					const payload = data as Partial<StageLightingControlPayload>;
					ServerStageLightingService.getInstance().applyControl(payload, payload.target);
					this.broadcastStateUpdate();
				}
				break;
			}

			case "SetStageCameraControl": {
				if (typeIs(data, "table")) {
					const incoming = data as Partial<StageCameraControlPayload>;
					this.stageCameraControlState = {
						...this.stageCameraControlState,
						...incoming,
					};
					if (incoming.enabled === false) {
						this.stageCameraControlState.enabled = false;
						if (incoming.mode === "default") {
							this.stageCameraControlState.mode = "default";
							this.stageCameraControlState.shake = "none";
						}
					}
					this.broadcastStateUpdate();
				}
				break;
			}

			case "TriggerFogBurst": {
				const target =
					typeIs(data, "string")
						? (data as StageTarget)
						: typeIs(data, "table") && "target" in data
							? ((data as { target: StageTarget }).target)
							: "all";
				ServerStageLightingService.getInstance().triggerFogBurst(target);
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

	private kickPlayer(adminPlayer: Player, targetUserId: number, reason?: string): void {
		const targetPlayer = Players.GetPlayerByUserId(targetUserId);
		if (!targetPlayer) return;

		// Security: Owner is always immune to kick
		if (isPlayerOwner(targetPlayer)) {
			warn(`[ServerAdminService] Cannot kick game owner ${targetPlayer.Name}`);
			return;
		}

		// In live game: Regular admins cannot kick other admins unless by Owner
		if (!RunService.IsStudio()) {
			if (isPlayerAdmin(targetPlayer) && !isPlayerOwner(adminPlayer)) {
				warn(`[ServerAdminService] Only game owner can kick another admin: ${targetPlayer.Name}`);
				return;
			}
		}

		const cleanReason = (reason && reason.size() > 0) ? reason : "Dikeluarkan oleh Admin";
		print(`[ServerAdminService] Admin ${adminPlayer.Name} kicked player ${targetPlayer.Name} (${targetUserId}): ${cleanReason}`);
		targetPlayer.Kick(`[Admin Kick]: ${cleanReason}`);
	}

	private banPlayer(adminPlayer: Player, targetUserId: number, reason?: string, durationSeconds = 0): void {
		// Security: Owner is always immune to ban
		if (targetUserId === AdminConfig.OWNER_USER_ID) {
			warn(`[ServerAdminService] Cannot ban game owner userId ${targetUserId}`);
			return;
		}

		// In live game: Only owner can ban another admin
		if (!RunService.IsStudio() && AdminConfig.ADMIN_USER_IDS.includes(targetUserId) && !isPlayerOwner(adminPlayer)) {
			warn(`[ServerAdminService] Only game owner can ban an admin userId ${targetUserId}`);
			return;
		}

		let targetName = `User_${targetUserId}`;
		const onlinePlayer = Players.GetPlayerByUserId(targetUserId);
		if (onlinePlayer) {
			targetName = onlinePlayer.Name;
		} else {
			pcall(() => {
				targetName = Players.GetNameFromUserIdAsync(targetUserId as never);
			});
		}

		const cleanReason = (reason && reason.size() > 0) ? reason : "Melanggar peraturan server";
		const record: BanRecord = {
			userId: targetUserId,
			name: targetName,
			reason: cleanReason,
			bannedBy: adminPlayer.Name,
			bannedAt: os.time(),
			durationSeconds: durationSeconds,
		};

		this.bannedPlayers.set(targetUserId, record);
		this.saveBansToDataStore();

		// Native engine Ban API (fallback wrapped in pcall)
		pcall(() => {
			(Players as unknown as { BanAsync?: (config: unknown) => void }).BanAsync?.({
				UserIds: [targetUserId],
				Duration: durationSeconds > 0 ? durationSeconds : -1,
				DisplayReason: cleanReason,
				PrivateReason: `Banned by admin ${adminPlayer.Name}`,
				ApplyToUniverse: true,
			});
		});

		if (onlinePlayer) {
			const durMsg = durationSeconds > 0 ? `${math.ceil(durationSeconds / 60)} menit` : "Permanen";
			onlinePlayer.Kick(`[UNDERGRID SECURITY - BANNED]\n\nAlasan: ${cleanReason}\nOleh: ${adminPlayer.Name}\nDurasi: ${durMsg}`);
		}

		print(`[ServerAdminService] Admin ${adminPlayer.Name} banned player ${targetName} (${targetUserId})`);
		this.broadcastBannedListUpdate();
	}

	private unbanPlayer(adminPlayer: Player, targetUserId: number): void {
		this.bannedPlayers.delete(targetUserId);
		this.saveBansToDataStore();

		pcall(() => {
			(Players as unknown as { UnbanAsync?: (config: unknown) => void }).UnbanAsync?.({
				UserIds: [targetUserId],
				ApplyToUniverse: true,
			});
		});

		print(`[ServerAdminService] Admin ${adminPlayer.Name} unbanned userId ${targetUserId}`);
		this.broadcastBannedListUpdate();
	}

	private banByUsername(adminPlayer: Player, username: string, reason?: string, durationSeconds = 0): void {
		const [success, userId] = pcall(() => Players.GetUserIdFromNameAsync(username as never));
		if (success && typeIs(userId, "number")) {
			this.banPlayer(adminPlayer, userId, reason, durationSeconds);
		} else {
			warn(`[ServerAdminService] Could not find UserId for username: ${username}`);
		}
	}

	private unbanByUsername(adminPlayer: Player, username: string): void {
		const [success, userId] = pcall(() => Players.GetUserIdFromNameAsync(username as never));
		if (success && typeIs(userId, "number")) {
			this.unbanPlayer(adminPlayer, userId);
		} else {
			warn(`[ServerAdminService] Could not find UserId for username: ${username}`);
		}
	}

	private initDataStore(): void {
		pcall(() => {
			this.banDataStore = DataStoreService.GetDataStore("AdminBans_v1");
		});
		if (this.banDataStore) {
			this.loadBansFromDataStore();
		} else {
			warn("[ServerAdminService] DataStoreService unavailable or disabled in Studio");
		}
	}

	private loadBansFromDataStore(): void {
		const store = this.banDataStore;
		if (!store) return;
		task.spawn(() => {
			const [success, result] = pcall(() => {
				const [data] = store.GetAsync("ActiveBans");
				return data;
			});
			if (success && typeIs(result, "table")) {
				const list = result as BanRecord[];
				const now = os.time();
				for (const item of list) {
					if (item && item.userId) {
						if (item.durationSeconds > 0 && now - item.bannedAt > item.durationSeconds) {
							continue;
						}
						this.bannedPlayers.set(item.userId, item);
					}
				}
				print(`[ServerAdminService] Loaded ${this.bannedPlayers.size()} active ban records from DataStore.`);
			}
		});
	}

	private saveBansToDataStore(): void {
		const store = this.banDataStore;
		if (!store) return;
		task.spawn(() => {
			const list: BanRecord[] = [];
			const now = os.time();
			for (const [_, record] of this.bannedPlayers) {
				if (record.durationSeconds > 0 && now - record.bannedAt > record.durationSeconds) {
					continue;
				}
				list.push(record);
			}
			const [success, err] = pcall(() => {
				store.SetAsync("ActiveBans", list);
			});
			if (!success) {
				warn(`[ServerAdminService] Failed to save bans to DataStore: ${tostring(err)}`);
			}
		});
	}

	public getBannedList(): BanRecord[] {
		const list: BanRecord[] = [];
		const now = os.time();
		const expiredIds: number[] = [];

		for (const [userId, record] of this.bannedPlayers) {
			if (record.durationSeconds > 0 && now - record.bannedAt > record.durationSeconds) {
				expiredIds.push(userId);
			} else {
				list.push(record);
			}
		}

		for (const id of expiredIds) {
			this.bannedPlayers.delete(id);
		}
		if (expiredIds.size() > 0) {
			this.saveBansToDataStore();
		}

		return list;
	}

	private broadcastBannedListUpdate(): void {
		const list = this.getBannedList();
		for (const p of Players.GetPlayers()) {
			if (isPlayerAdmin(p)) {
				this.adminBansUpdatedEvent.FireClient(p, list);
			}
		}
	}

	// ─── Chat Commands Execution ─────────────────────────────────────────────

	private findTargetPlayer(query: string, sender: Player): Player | undefined {
		const q = query.lower();
		if (q === "me" || q === "") {
			return sender;
		}

		const players = Players.GetPlayers();
		// 1. Exact match username
		for (const p of players) {
			if (p.Name.lower() === q) return p;
		}
		// 2. Exact match display name
		for (const p of players) {
			if (p.DisplayName.lower() === q) return p;
		}
		// 3. Substring match
		for (const p of players) {
			if (p.Name.lower().find(q)[0] !== undefined || p.DisplayName.lower().find(q)[0] !== undefined) {
				return p;
			}
		}
		return undefined;
	}

	private refreshCharacter(targetPlayer: Player, keepPosition = true): void {
		const char = targetPlayer.Character;
		let lastCFrame: CFrame | undefined;
		if (char && keepPosition) {
			const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (hrp) {
				lastCFrame = hrp.CFrame;
			} else {
				lastCFrame = char.GetPivot();
			}
		}

		if (lastCFrame) {
			const targetCFrame = lastCFrame;

			const conn = targetPlayer.CharacterAdded.Connect((newChar) => {
				conn.Disconnect();

				task.spawn(() => {
					const root = newChar.WaitForChild("HumanoidRootPart", 10) as BasePart | undefined;
					const hum = newChar.WaitForChild("Humanoid", 10) as Humanoid | undefined;
					if (!root || !hum) return;

					// Kunci: Anchored sementara agar physics client tidak menimpa posisi server kembali ke SpawnLocation
					root.Anchored = true;
					root.AssemblyLinearVelocity = Vector3.zero;
					root.AssemblyAngularVelocity = Vector3.zero;
					newChar.PivotTo(targetCFrame);
					root.CFrame = targetCFrame;

					// Tahan selama beberapa tick Heartbeat
					for (let i = 0; i < 6; i++) {
						RunService.Heartbeat.Wait();
						if (root.Parent) {
							root.AssemblyLinearVelocity = Vector3.zero;
							root.AssemblyAngularVelocity = Vector3.zero;
							newChar.PivotTo(targetCFrame);
							root.CFrame = targetCFrame;
						}
					}

					// Lepas anchor setelah posisi stabil terkonfirmasi
					task.delay(0.2, () => {
						if (root.Parent) {
							root.AssemblyLinearVelocity = Vector3.zero;
							root.AssemblyAngularVelocity = Vector3.zero;
							newChar.PivotTo(targetCFrame);
							root.CFrame = targetCFrame;
							root.Anchored = false;
						}
					});
				});
			});
		}

		targetPlayer.LoadCharacter();
	}

	private rejoinPlayer(player: Player): void {
		if (RunService.IsStudio()) {
			print(`[ServerAdminService] Studio testing: Rejoin simulated for ${player.Name}`);
			this.refreshCharacter(player, false);
			return;
		}

		print(`[ServerAdminService] Rejoining player ${player.Name} to current place (${game.PlaceId})`);
		const [success, err] = pcall(() => {
			TeleportService.TeleportToPlaceInstance(game.PlaceId, game.JobId, player);
		});

		if (!success) {
			warn(`[ServerAdminService] TeleportToPlaceInstance failed for ${player.Name}, falling back to Teleport:`, err);
			pcall(() => {
				TeleportService.Teleport(game.PlaceId, player);
			});
		}
	}

	private restartServer(admin: Player): void {
		if (!isPlayerOwner(admin)) {
			warn(`[ServerAdminService] Restart unauthorized: ${admin.Name} is not Game Owner.`);
			return;
		}

		if (this.isServerRestarting) return;
		this.isServerRestarting = true;

		print(`[ServerAdminService] Server restart initiated by ${admin.Name}`);
		this.broadcastAnnouncement(
			"[SERVER RESTART] Server is restarting to apply the latest update. Please wait...",
		);

		// Jika di Studio Mode:
		if (RunService.IsStudio()) {
			print("[ServerAdminService] Studio testing: Simulated server restart.");
			task.delay(1.5, () => {
				this.broadcastAnnouncement(
					"[STUDIO] Simulated server restart: All players refreshed and ready.",
				);
				for (const p of Players.GetPlayers()) {
					this.refreshCharacter(p, false);
				}
				this.isServerRestarting = false;
			});
			return;
		}

		// Live Server Mode: Soft Shutdown via Reserved Server Intermediary
		task.delay(2, () => {
			const allPlayers = Players.GetPlayers();
			if (allPlayers.size() === 0) return;

			// 1. Coba buat Reserved Server sementara untuk menampung pemain
			const [reserveSuccess, reservedCodeOrErr] = pcall(() => {
				return TeleportService.ReserveServer(game.PlaceId);
			});

			if (reserveSuccess && typeIs(reservedCodeOrErr, "string") && (reservedCodeOrErr as string).size() > 0) {
				const reservedCode = reservedCodeOrErr as string;
				const teleportOptions = new Instance("TeleportOptions");
				teleportOptions.ReservedServerAccessCode = reservedCode;
				teleportOptions.SetTeleportData({ isRestartTransit: true, sourceJobId: game.JobId });

				print(
					`[ServerAdminService] Soft Shutdown: Transferring ${allPlayers.size()} players to Reserved Transit Server.`,
				);
				this.broadcastAnnouncement("TRANSFERRING PLAYERS TO TRANSIT SERVER SO OLD SERVER CAN SHUT DOWN...");

				const [tpSuccess, tpErr] = pcall(() => {
					TeleportService.TeleportAsync(game.PlaceId, allPlayers, teleportOptions);
				});

				if (tpSuccess) {
					return;
				}
				warn(
					`[ServerAdminService] Teleport ke Reserved Server gagal: ${tostring(tpErr)}. Menggunakan fallback graceful kick.`,
				);
			} else {
				warn(
					`[ServerAdminService] Gagal ReserveServer: ${tostring(reservedCodeOrErr)}. Menggunakan fallback graceful kick.`,
				);
			}

			// 2. Fallback Graceful Kick:
			// Jika ReserveServer tidak tersedia atau gagal, lakukan kick terkoordinasi agar server lama segera mati
			// dan pemain mendapatkan prompt tombol 'Reconnect' resmi Roblox untuk masuk ke server baru.
			this.broadcastAnnouncement("UPDATING SERVER TO THE LATEST VERSION... PLEASE CLICK RECONNECT.");
			task.delay(1.5, () => {
				for (const p of Players.GetPlayers()) {
					p.Kick(
						"[SERVER RESTART]\n\nThe server has shut down to apply the latest update.\nPlease click 'Reconnect' to join the updated server!",
					);
				}
			});
		});
	}

	private initTextChatService(): void {
		task.spawn(() => {
			// 1. Setup TextChatCommands folder di TextChatService (Dukungan native untuk / command agar tidak ditolak engine)
			let textCommandsFolder = TextChatService.FindFirstChild("TextChatCommands") as Folder | undefined;
			if (!textCommandsFolder) {
				textCommandsFolder = new Instance("Folder");
				textCommandsFolder.Name = "TextChatCommands";
				textCommandsFolder.Parent = TextChatService;
			}

			const commandDefs: Array<{ name: string; primary: string }> = [
				{ name: "AfkCmd", primary: "/afk" },
				{ name: "ReCmd", primary: "/re" },
				{ name: "RefreshCmd", primary: "/refresh" },
				{ name: "RejoinCmd", primary: "/rejoin" },
				{ name: "RjCmd", primary: "/rj" },
				{ name: "GiveCmd", primary: "/give" },
				{ name: "FlyCmd", primary: "/fly" },
				{ name: "UnflyCmd", primary: "/unfly" },
				{ name: "RestartCmd", primary: "/restart" },
				{ name: "RebootCmd", primary: "/reboot" },
				{ name: "TpCmd", primary: "/tp" },
				{ name: "ToCmd", primary: "/to" },
				{ name: "BringCmd", primary: "/bring" },
				{ name: "KickCmd", primary: "/kick" },
				{ name: "TimeCmd", primary: "/time" },
				{ name: "SpeedCmd", primary: "/speed" },
				{ name: "WsCmd", primary: "/ws" },
				{ name: "AnnounceCmd", primary: "/announce" },
			];

			for (const def of commandDefs) {
				let cmd = textCommandsFolder.FindFirstChild(def.name) as TextChatCommand | undefined;
				if (!cmd) {
					cmd = new Instance("TextChatCommand");
					cmd.Name = def.name;
					cmd.PrimaryAlias = def.primary;
					cmd.SecondaryAlias = "";
					cmd.Parent = textCommandsFolder;
				} else {
					cmd.PrimaryAlias = def.primary;
					cmd.SecondaryAlias = "";
				}

				cmd.Triggered.Connect((originTextSource, message) => {
					const player = Players.GetPlayerByUserId(originTextSource.UserId);
					if (!player) return;

					const parsed = this.parseCommand(message);
					if (parsed) {
						const cacheKey = `${player.UserId}_${message}`;
						this.processedCommandTimestamps.set(cacheKey, os.clock());
						task.delay(5, () => this.processedCommandTimestamps.delete(cacheKey));

						this.executeParsedCommand(player, parsed.commandName, parsed.args);
					}
				});
			}

			// 2. Setup ShouldDeliverCallback pada TextChannels untuk menyembunyikan command dengan prefix slash (/)
			const textChannelsFolder = TextChatService.WaitForChild("TextChannels", 10) as Folder | undefined;
			if (textChannelsFolder) {
				const bindChannel = (channel: Instance) => {
					if (channel.IsA("TextChannel")) {
						channel.ShouldDeliverCallback = (textChatMessage: TextChatMessage) => {
							const source = textChatMessage.TextSource;
							const player = source ? Players.GetPlayerByUserId(source.UserId) : undefined;
							if (!player) return true;

							const parsed = this.parseCommand(textChatMessage.Text);
							if (parsed) {
								const cacheKey = `${player.UserId}_${textChatMessage.Text}`;
								const lastTime = this.processedCommandTimestamps.get(cacheKey);
								if (!lastTime || os.clock() - lastTime > 1) {
									this.processedCommandTimestamps.set(cacheKey, os.clock());
									task.delay(5, () => this.processedCommandTimestamps.delete(cacheKey));
									this.executeParsedCommand(player, parsed.commandName, parsed.args);
								}
								return false; // Sembunyikan command dari chat!
							}

							return true;
						};
					}
				};

				for (const ch of textChannelsFolder.GetChildren()) {
					bindChannel(ch);
				}
				textChannelsFolder.ChildAdded.Connect(bindChannel);
			}

			print("[ServerAdminService] TextChatService native commands & channel interceptors registered with slash (/) prefix.");
		});
	}

	private parseCommand(message: string): { commandName: string; args: string[] } | undefined {
		const trimmed = message.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
		if (trimmed.size() === 0) return undefined;

		const rawArgs = trimmed.split(" ");
		const firstWord = rawArgs[0];
		if (!firstWord || firstWord.size() === 0) return undefined;

		// WAJIB menggunakan prefix slash (/) saja secara umum
		const hasSlashPrefix = firstWord.sub(1, 1) === "/";
		if (!hasSlashPrefix) {
			return undefined;
		}

		let cleanCommand = firstWord.sub(2);
		if (cleanCommand.sub(-1, -1) === "!") {
			cleanCommand = cleanCommand.sub(1, -2);
		}
		const commandName = cleanCommand.lower();
		if (commandName.size() === 0) return undefined;

		// Abaikan command bawaan Roblox (whisper, team) agar tidak mengganggu sistem chat bawaan
		if (commandName === "w" || commandName === "whisper" || commandName === "team" || commandName === "t") {
			return undefined;
		}

		const args: string[] = [];
		for (let i = 1; i < rawArgs.size(); i++) {
			if (rawArgs[i].size() > 0) {
				args.push(rawArgs[i]);
			}
		}

		return { commandName, args };
	}

	private executeParsedCommand(sender: Player, commandName: string, args: string[]): boolean {
		// ─────────────────────────────────────────────────────────────────────
		// 1. COMMAND PUBLIK (Dapat diakses seluruh pemain)
		// ─────────────────────────────────────────────────────────────────────
		if (commandName === "re" || commandName === "refresh") {
			const isAdmin = isPlayerAdmin(sender);
			const targetArg = args[0];

			if (targetArg && targetArg.lower() !== "me" && !isAdmin) {
				return true;
			}

			// Cooldown anti-spam untuk non-admin (5 detik)
			if (!isAdmin) {
				const now = os.clock();
				const lastRefresh = this.playerLastRefreshTimestamps.get(sender.UserId) ?? 0;
				if (now - lastRefresh < 5) {
					return true;
				}
				this.playerLastRefreshTimestamps.set(sender.UserId, now);
			}

			const targetPlayer = targetArg && isAdmin ? this.findTargetPlayer(targetArg, sender) : sender;
			if (targetPlayer) {
				this.refreshCharacter(targetPlayer, true);
				print(`[ServerAdminService] Character refreshed for ${targetPlayer.Name} (by ${sender.Name})`);
			}
			return true;
		}

		if (commandName === "afk") {
			ServerAfkService.getInstance().toggleAfk(sender);
			return true;
		}

		if (commandName === "rejoin" || commandName === "rj") {
			this.rejoinPlayer(sender);
			return true;
		}

		// ─────────────────────────────────────────────────────────────────────
		// 2. COMMAND KHUSUS ADMIN (Validasi Otorisasi Ketat)
		// ─────────────────────────────────────────────────────────────────────
		const validAdminCommands = new Set([
			"fly",
			"unfly",
			"restart",
			"reboot",
			"tp",
			"to",
			"bring",
			"kick",
			"time",
			"speed",
			"ws",
			"m",
			"announce",
			"give",
			"item",
		]);

		if (!validAdminCommands.has(commandName)) {
			return false;
		}

		if (!isPlayerAdmin(sender)) {
			warn(`[ServerAdminService] Unauthorized chat command '${commandName}' attempted by ${sender.Name}`);
			return true; // Sembunyikan command yang gagal agar tidak mengotori chat umum
		}

		switch (commandName) {
			case "fly": {
				const speed = tonumber(args[0]) ?? 50;
				this.adminFlyToggleEvent.FireClient(sender, true, speed);
				print(`[ServerAdminService] Flight enabled for admin ${sender.Name} (Speed: ${speed})`);
				break;
			}

			case "unfly": {
				this.adminFlyToggleEvent.FireClient(sender, false);
				print(`[ServerAdminService] Flight disabled for admin ${sender.Name}`);
				break;
			}

			case "restart":
			case "reboot": {
				if (!isPlayerOwner(sender)) {
					warn(`[ServerAdminService] Restart command denied: ${sender.Name} is not the Game Owner.`);
					return true;
				}
				this.restartServer(sender);
				break;
			}

			case "tp":
			case "to": {
				const targetArg = args[0];
				if (targetArg) {
					const target = this.findTargetPlayer(targetArg, sender);
					if (target && target !== sender) {
						this.teleportAdminToPlayer(sender, target.UserId);
					}
				}
				break;
			}

			case "bring": {
				const targetArg = args[0];
				if (targetArg) {
					if (targetArg.lower() === "all") {
						for (const p of Players.GetPlayers()) {
							if (p !== sender) {
								this.bringPlayerToAdmin(sender, p.UserId);
							}
						}
					} else {
						const target = this.findTargetPlayer(targetArg, sender);
						if (target && target !== sender) {
							this.bringPlayerToAdmin(sender, target.UserId);
						}
					}
				}
				break;
			}

			case "kick": {
				const targetArg = args[0];
				if (targetArg) {
					const target = this.findTargetPlayer(targetArg, sender);
					if (target && !isPlayerAdmin(target)) {
						const reasonParts: string[] = [];
						for (let i = 1; i < args.size(); i++) {
							reasonParts.push(args[i]);
						}
						const reason = reasonParts.size() > 0 ? reasonParts.join(" ") : "Dikeluarkan oleh Admin";
						target.Kick(`[Admin Kick]: ${reason}`);
					}
				}
				break;
			}

			case "time": {
				const hour = tonumber(args[0]);
				if (hour !== undefined) {
					ServerTimeService.getInstance().setClockTime(hour);
				}
				break;
			}

			case "speed":
			case "ws": {
				let target = sender;
				let speedVal = tonumber(args[0]);
				if (speedVal === undefined && args[1] !== undefined) {
					const found = this.findTargetPlayer(args[0], sender);
					if (found) {
						target = found;
						speedVal = tonumber(args[1]);
					}
				}
				if (speedVal !== undefined && target.Character) {
					const hum = target.Character.FindFirstChildOfClass("Humanoid");
					if (hum) {
						hum.WalkSpeed = speedVal;
						print(`[ServerAdminService] WalkSpeed of ${target.Name} set to ${speedVal} by ${sender.Name}`);
					}
				}
				break;
			}

			case "m":
			case "announce": {
				const msg = args.join(" ");
				if (msg.size() > 0) {
					this.broadcastAnnouncement(msg);
				}
				break;
			}

			case "give":
			case "item": {
				const itemQuery = args[0];
				const targetArg = args[1];
				if (itemQuery && itemQuery.size() > 0) {
					this.handleGiveCommand(sender, itemQuery, targetArg);
				} else {
					print(`[ServerAdminService] Usage: !give <itemname> [playername]`);
				}
				break;
			}
		}

		return true;
	}

	private handleAdminChatCommand(sender: Player, message: string): void {
		const parsed = this.parseCommand(message);
		if (parsed) {
			this.executeParsedCommand(sender, parsed.commandName, parsed.args);
		}
	}

	private findToolInStorage(itemQuery: string): Tool | undefined {
		const q = itemQuery.lower();

		// Alias mapper
		let targetName: string | undefined;
		if (q === "skate" || q === "skateboard" || q === "board") {
			targetName = "Skateboard";
		} else if (q === "guitar" || q === "gitar") {
			targetName = "Strato";
		} else if (q === "strato") {
			targetName = "Strato";
		} else if (q === "gibson") {
			targetName = "Gibson";
		} else if (q === "bass") {
			targetName = "Bass";
		} else if (q === "drum" || q === "drumstick" || q === "drumsticks" || q === "stick" || q === "sticks") {
			targetName = "Drumstick";
		} else if (q === "fist" || q === "fists" || q === "tinju" || q === "punch" || q === "combat") {
			targetName = "Fists";
		}

		const toolsFolder = ServerStorage.FindFirstChild("Tools") as Folder | undefined;
		const searchContainers: Instance[] = [];
		if (toolsFolder) searchContainers.push(toolsFolder);
		searchContainers.push(ServerStorage);

		// 1. Cek alias nama terdaftar
		if (targetName) {
			for (const container of searchContainers) {
				const found = container.FindFirstChild(targetName);
				if (found && found.IsA("Tool")) {
					return found;
				}
			}
		}

		// 2. Exact match lowercase
		for (const container of searchContainers) {
			for (const item of container.GetChildren()) {
				if (item.IsA("Tool") && item.Name.lower() === q) {
					return item;
				}
			}
		}

		// 3. Substring match
		for (const container of searchContainers) {
			for (const item of container.GetChildren()) {
				if (item.IsA("Tool") && item.Name.lower().find(q)[0] !== undefined) {
					return item;
				}
			}
		}

		return undefined;
	}

	private handleGiveCommand(admin: Player, itemQuery: string, targetQuery?: string): void {
		const tool = this.findToolInStorage(itemQuery);
		if (!tool) {
			warn(`[ServerAdminService] Tool '${itemQuery}' tidak ditemukan di ServerStorage/Tools!`);
			return;
		}

		let recipients: Player[] = [];
		const tq = targetQuery ? targetQuery.lower() : "me";

		if (tq === "all") {
			recipients = Players.GetPlayers();
		} else if (tq === "me" || tq === "") {
			recipients = [admin];
		} else {
			const target = this.findTargetPlayer(targetQuery!, admin);
			if (target) {
				recipients = [target];
			} else {
				warn(`[ServerAdminService] Target player '${targetQuery}' tidak ditemukan.`);
				return;
			}
		}

		for (const recipient of recipients) {
			const backpack = recipient.FindFirstChildOfClass("Backpack");
			const char = recipient.Character;

			// Hindari duplikasi jika sudah memiliki tool dengan nama yang sama
			const inBackpack = backpack?.FindFirstChild(tool.Name);
			const inChar = char?.FindFirstChild(tool.Name);
			if (inBackpack || inChar) {
				print(`[ServerAdminService] Player ${recipient.Name} sudah memiliki ${tool.Name}.`);
				continue;
			}

			if (backpack) {
				const cloned = tool.Clone();
				cloned.Parent = backpack;
				print(`[ServerAdminService] Gave ${tool.Name} to ${recipient.Name} (by ${admin.Name})`);
			}
		}
	}

	// ─── State Management & Synchronization ──────────────────────────────────

	public getState(): AdminStateSync {
		return {
			isQueueLocked: ServerMusicService.getInstance().getIsQueueLocked(),
			stageLighting: ServerStageLightingService.getInstance().getMainControlState(),
			djStageLighting: ServerStageLightingService.getInstance().getDjControlState(),
			stageCamera: this.stageCameraControlState,
		};
	}

	public getFullState(): {
		state: AdminStateSync;
		players: PlayerEntryInfo[];
		banned: BanRecord[];
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
			banned: this.getBannedList(),
		};
	}

	private broadcastStateUpdate(): void {
		const state = this.getState();
		this.adminStateUpdatedEvent.FireAllClients(state);
	}

	private stripStageController(player: Player): void {
		const backpack = player.FindFirstChildOfClass("Backpack");
		const character = player.Character;

		const toolNames = ["Stage Controller", "LightingRemote", "LightingController"];
		for (const name of toolNames) {
			const inBackpack = backpack?.FindFirstChild(name);
			if (inBackpack) {
				inBackpack.Destroy();
			}

			const inCharacter = character?.FindFirstChild(name);
			if (inCharacter) {
				inCharacter.Destroy();
			}
		}
	}
}
