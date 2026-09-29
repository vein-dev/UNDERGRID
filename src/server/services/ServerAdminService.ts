import { Players, RunService, TeleportService } from "@rbxts/services";
import { isPlayerAdmin } from "shared/config";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import { AdminStateSync, PlayerEntryInfo, StageCameraControlPayload, StageLightingControlPayload } from "shared/types";
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
	private adminFlyToggleEvent: RemoteEvent;

	// Cooldown tracker untuk public !re
	private playerLastRefreshTimestamps = new Map<number, number>();

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

		// Periksa apakah server saat ini adalah reserved transit server (penampungan saat restart)
		const isReservedTransitServer = game.PrivateServerId !== "" && game.PrivateServerOwnerId === 0;
		if (isReservedTransitServer) {
			this.handleRestartTransitServer();
		}

		// Replikasi state awal & penanganan LightingRemote khusus Admin / Developer
		const handlePlayerLifecycle = (player: Player) => {
			if (this.isServerRestarting) {
				player.Kick(
					"[SERVER RESTART]\n\nServer sedang dalam proses restart untuk pembaruan (update).\nSilakan masuk kembali dalam beberapa detik.",
				);
				return;
			}

			task.defer(() => {
				this.adminStateUpdatedEvent.FireClient(player, this.getState());
			});

			player.Chatted.Connect((message) => {
				this.handleAdminChatCommand(player, message);
			});

			if (isPlayerAdmin(player)) {
				player.CharacterAdded.Connect(() => {
					task.wait(0.5);
					this.giveStageController(player);
				});
				if (player.Character) {
					task.defer(() => this.giveStageController(player));
				}
			} else {
				// Pemain biasa (non-admin): bersihkan Stage Controller jika ada
				player.CharacterAdded.Connect(() => {
					task.wait(0.5);
					this.stripStageControllerIfNonAdmin(player);
				});
				this.stripStageControllerIfNonAdmin(player);
			}
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
		print("[ServerAdminService] Reserved Transit Server terdeteksi. Mempersiapkan pengembalian pemain ke server publik baru...");
		let isReturning = false;

		const returnPlayersToMain = () => {
			if (isReturning) return;
			isReturning = true;

			// Jeda 2.5 detik agar server publik lama berkesempatan ditutup karena 0 pemain
			task.delay(2.5, () => {
				const players = Players.GetPlayers();
				if (players.size() === 0) return;

				print(`[ServerAdminService] Mengembalikan ${players.size()} pemain ke server publik baru...`);
				this.broadcastAnnouncement("SERVER TELAH DIPERBARUI. MENGHUBUNGKAN ANDA KE SERVER BARU...");

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
				this.broadcastAnnouncement("MEMPERSIAPKAN SERVER DENGAN UPDATE TERBARU... MOHON TUNGGU.");
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

			case "SetStageCameraControl": {
				if (typeIs(data, "table")) {
					this.stageCameraControlState = {
						...this.stageCameraControlState,
						...(data as Partial<StageCameraControlPayload>),
					};
					this.broadcastStateUpdate();
				}
				break;
			}

			case "GiveStageController":
			case "GiveLightingRemote": {
				this.giveStageController(player);
				break;
			}

			case "TriggerFogBurst": {
				ServerStageLightingService.getInstance().triggerFogBurst();
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
			const targetCFrame = lastCFrame.add(new Vector3(0, 0.5, 0));

			const conn = targetPlayer.CharacterAdded.Connect((newChar) => {
				conn.Disconnect();

				const applyPosition = () => {
					if (!newChar.Parent) return;
					const newHrp = newChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
					if (newHrp) {
						newHrp.AssemblyLinearVelocity = Vector3.zero;
						newHrp.AssemblyAngularVelocity = Vector3.zero;
						newChar.PivotTo(targetCFrame);
						newHrp.CFrame = targetCFrame;
					}
				};

				task.spawn(() => {
					const root = newChar.WaitForChild("HumanoidRootPart", 10) as BasePart | undefined;
					if (!root) return;

					// Terapkan saat root part pertama kali ada
					applyPosition();

					// Frame 1: task.defer untuk mengantisipasi Roblox default spawn placement
					task.defer(applyPosition);

					// Frame 2: Heartbeat wait (post-physics)
					RunService.Heartbeat.Wait();
					applyPosition();

					// Frame 3: Jeda 0.1s dan 0.2s untuk stabilisasi mutlak
					task.delay(0.1, applyPosition);
					task.delay(0.2, applyPosition);
				});
			});
		}

		targetPlayer.LoadCharacter();
	}

	private restartServer(admin: Player): void {
		if (this.isServerRestarting) return;
		this.isServerRestarting = true;

		print(`[ServerAdminService] Server restart initiated by ${admin.Name}`);
		this.broadcastAnnouncement("[SERVER RESTART] Server sedang di-restart untuk menerapkan update terbaru. Mohon tunggu...");

		// Jika di Studio Mode:
		if (RunService.IsStudio()) {
			print("[ServerAdminService] Studio testing: Server restart simulasi.");
			task.delay(1.5, () => {
				this.broadcastAnnouncement("[STUDIO] Server restart simulasi: Seluruh pemain di-refresh dan siap digunakan kembali.");
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

				print(`[ServerAdminService] Soft Shutdown: Memindahkan ${allPlayers.size()} pemain ke Reserved Transit Server.`);
				this.broadcastAnnouncement("MEMINDAHKAN PEMAIN KE TRANSIT SERVER AGAR SERVER LAMA DITUTUP...");

				const [tpSuccess, tpErr] = pcall(() => {
					TeleportService.TeleportAsync(game.PlaceId, allPlayers, teleportOptions);
				});

				if (tpSuccess) {
					return;
				}
				warn(`[ServerAdminService] Teleport ke Reserved Server gagal: ${tostring(tpErr)}. Menggunakan fallback graceful kick.`);
			} else {
				warn(`[ServerAdminService] Gagal ReserveServer: ${tostring(reservedCodeOrErr)}. Menggunakan fallback graceful kick.`);
			}

			// 2. Fallback Graceful Kick:
			// Jika ReserveServer tidak tersedia atau gagal, lakukan kick terkoordinasi agar server lama segera mati
			// dan pemain mendapatkan prompt tombol 'Reconnect' resmi Roblox untuk masuk ke server baru.
			this.broadcastAnnouncement("MEMPERBARUI SERVER KE VERSI TERBARU... SILAKAN KLIK RECONNECT.");
			task.delay(1.5, () => {
				for (const p of Players.GetPlayers()) {
					p.Kick(
						"[SERVER RESTART]\n\nServer telah dimatikan untuk menerapkan pembaruan (update) terbaru.\nSilakan klik tombol 'Reconnect' untuk langsung bergabung ke server versi terbaru!",
					);
				}
			});
		});
	}

	private handleAdminChatCommand(sender: Player, message: string): void {
		const trimmed = message.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
		if (trimmed.size() === 0) return;

		const rawArgs = trimmed.split(" ");
		let firstWord = rawArgs[0];
		if (!firstWord || firstWord.size() === 0) return;

		// Periksa apakah diawali prefix (!, /, :, ;) atau diakhiri suffix (!)
		const hasPrefix =
			firstWord.sub(1, 1) === "!" ||
			firstWord.sub(1, 1) === "/" ||
			firstWord.sub(1, 1) === ":" ||
			firstWord.sub(1, 1) === ";";
		const hasSuffix = firstWord.sub(-1, -1) === "!";

		if (!hasPrefix && !hasSuffix) {
			return;
		}

		// Bersihkan karakter awalan dan akhiran tanda seru/slash/titik dua
		let cleanCommand = firstWord;
		if (hasPrefix) {
			cleanCommand = cleanCommand.sub(2);
		}
		if (cleanCommand.sub(-1, -1) === "!") {
			cleanCommand = cleanCommand.sub(1, -2);
		}
		const commandName = cleanCommand.lower();
		if (commandName.size() === 0) return;

		const args: string[] = [];
		for (let i = 1; i < rawArgs.size(); i++) {
			if (rawArgs[i].size() > 0) {
				args.push(rawArgs[i]);
			}
		}

		// ─────────────────────────────────────────────────────────────────────
		// 1. COMMAND PUBLIK (Dapat diakses seluruh pemain)
		// ─────────────────────────────────────────────────────────────────────
		if (commandName === "re" || commandName === "refresh") {
			const isAdmin = isPlayerAdmin(sender);
			const targetArg = args[0];

			// Jika non-admin mencoba refresh orang lain, batalkan
			if (targetArg && targetArg.lower() !== "me" && !isAdmin) {
				return;
			}

			// Cooldown anti-spam untuk non-admin (5 detik)
			if (!isAdmin) {
				const now = os.clock();
				const lastRefresh = this.playerLastRefreshTimestamps.get(sender.UserId) ?? 0;
				if (now - lastRefresh < 5) {
					return;
				}
				this.playerLastRefreshTimestamps.set(sender.UserId, now);
			}

			const targetPlayer = targetArg && isAdmin ? this.findTargetPlayer(targetArg, sender) : sender;
			if (targetPlayer) {
				this.refreshCharacter(targetPlayer, true);
				print(`[ServerAdminService] Character refreshed for ${targetPlayer.Name} (by ${sender.Name})`);
			}
			return;
		}

		// ─────────────────────────────────────────────────────────────────────
		// 2. COMMAND KHUSUS ADMIN (Validasi Otorisasi Ketat)
		// ─────────────────────────────────────────────────────────────────────
		if (!isPlayerAdmin(sender)) {
			return;
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
		}
	}

	// ─── State Management & Synchronization ──────────────────────────────────

	public getState(): AdminStateSync {
		return {
			isQueueLocked: ServerMusicService.getInstance().getIsQueueLocked(),
			stageLighting: ServerStageLightingService.getInstance().getControlState(),
			stageCamera: this.stageCameraControlState,
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

	private giveStageController(player: Player): void {
		if (!isPlayerAdmin(player)) return;

		const backpack = player.FindFirstChildOfClass("Backpack");
		const character = player.Character;
		if (
			backpack?.FindFirstChild("Stage Controller") ||
			character?.FindFirstChild("Stage Controller") ||
			backpack?.FindFirstChild("LightingRemote") ||
			character?.FindFirstChild("LightingRemote")
		) {
			return;
		}

		const serverStorage = game.GetService("ServerStorage");
		const starterPack = game.GetService("StarterPack");
		const template = (serverStorage.FindFirstChild("Stage Controller") ??
			starterPack.FindFirstChild("Stage Controller") ??
			serverStorage.FindFirstChild("LightingRemote") ??
			starterPack.FindFirstChild("LightingRemote")) as Tool | undefined;

		if (template && backpack) {
			const clone = template.Clone();
			clone.Parent = backpack;
		}
	}

	private stripStageControllerIfNonAdmin(player: Player): void {
		if (isPlayerAdmin(player)) return;

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
