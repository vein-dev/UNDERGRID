import { Players, RunService, TeleportService } from "@rbxts/services";
import { getRemoteEvent } from "shared/network";
import { AfkTeleportData } from "shared/types";

/**
 * ServerAfkService - Layanan server otoritatif untuk mengelola status AFK seluruh pemain
 * dan auto-rejoin anti-kick 19 menit dengan pemulihan lokasi spawn terakhir.
 */
export class ServerAfkService {
	private static instance?: ServerAfkService;
	private afkEvent: RemoteEvent;

	private constructor() {
		this.afkEvent = getRemoteEvent("AfkEvent");
	}

	public static getInstance(): ServerAfkService {
		if (!ServerAfkService.instance) {
			ServerAfkService.instance = new ServerAfkService();
		}
		return ServerAfkService.instance;
	}

	public init(): void {
		// Menerima request toggle / set AFK / rejoin dari client
		this.afkEvent.OnServerEvent.Connect((player, action, value) => {
			if (action === "ToggleAfk") {
				this.toggleAfk(player);
			} else if (action === "SetAfk" && typeIs(value, "boolean")) {
				this.setAfk(player, value);
			} else if (action === "RequestAfkRejoin") {
				this.triggerAfkRejoin(player, value);
			}
		});

		// Player lifecycle setup
		const handlePlayer = (player: Player) => {
			// Periksa apakah pemain ini baru saja reconnect dari sesi AFK 19 menit
			const joinData = player.GetJoinData();
			const teleportData = joinData?.TeleportData as AfkTeleportData | undefined;

			player.CharacterAdded.Connect((char) => {
				char.SetAttribute("IsAfk", false);
				char.SetAttribute("AfkStartTime", 0);

				const humanoid = char.WaitForChild("Humanoid") as Humanoid | undefined;
				if (humanoid) {
					humanoid.Died.Connect(() => {
						this.setAfk(player, false);
					});
				}

				// Jika ini adalah sesi AFK Reconnect, restore posisi persis ke titik terakhir
				if (teleportData?.isAfkRejoin && teleportData.lastPosition) {
					task.defer(() => {
						const root = char.WaitForChild("HumanoidRootPart", 10) as BasePart | undefined;
						if (root && char.Parent) {
							const [x, y, z, lx, ly, lz] = teleportData.lastPosition;
							const targetCFrame = new CFrame(
								new Vector3(x, y + 0.3, z),
								new Vector3(x + lx, y + 0.3, z + lz),
							);
							char.PivotTo(targetCFrame);
							print(
								`[ServerAfkService] Restored player ${player.Name} to AFK location: (${x}, ${y}, ${z})`,
							);

							// Otomatis aktifkan kembali mode AFK di titik tersebut
							this.setAfk(player, true);
						}
					});
				}
			});
		};

		Players.PlayerAdded.Connect(handlePlayer);
		for (const p of Players.GetPlayers()) {
			handlePlayer(p);
		}

		print("[ServerAfkService] Initialized with 19-minute auto-rejoin & location restore support.");
	}

	/**
	 * Melakukan teleport soft-rejoin ke server yang sama (game.JobId) membawa koordinat posisi terakhir.
	 */
	public triggerAfkRejoin(player: Player, clientCoords?: unknown): void {
		let coords: [number, number, number, number, number, number] | undefined;

		if (typeIs(clientCoords, "table")) {
			const arr = clientCoords as number[];
			if (arr.size() >= 3) {
				coords = [
					arr[0],
					arr[1],
					arr[2],
					arr.size() >= 6 ? arr[3] : 0,
					arr.size() >= 6 ? arr[4] : 0,
					arr.size() >= 6 ? arr[5] : -1,
				];
			}
		}

		if (!coords && player.Character) {
			const cf = player.Character.GetPivot();
			const lv = cf.LookVector;
			coords = [cf.X, cf.Y, cf.Z, lv.X, lv.Y, lv.Z];
		}

		if (!coords) {
			coords = [0, 10, 0, 0, 0, -1];
		}

		const teleportData: AfkTeleportData = {
			isAfkRejoin: true,
			lastPosition: coords,
			timestamp: os.time(),
			placeId: game.PlaceId,
		};

		print(`[ServerAfkService] Initiating 19-min AFK auto-rejoin for ${player.Name}...`);

		if (RunService.IsStudio()) {
			print(
				`[ServerAfkService] (Studio Mode) TeleportService cannot teleport in Play Solo. Simulated rejoin for ${player.Name}.`,
			);
			return;
		}

		const teleportPayload = teleportData as unknown as Parameters<typeof TeleportService.Teleport>[2];

		// Reconnect ke instance server yang sama jika ada JobId aktif
		const jobId = game.JobId;
		if (jobId && jobId !== "") {
			const [success, err] = pcall(() => {
				TeleportService.TeleportToPlaceInstance(game.PlaceId, jobId, player, undefined, teleportPayload);
			});
			if (!success) {
				warn(`[ServerAfkService] TeleportToPlaceInstance failed (${tostring(err)}), falling back to standard Teleport...`);
				pcall(() => {
					TeleportService.Teleport(game.PlaceId, player, teleportPayload);
				});
			}
		} else {
			pcall(() => {
				TeleportService.Teleport(game.PlaceId, player, teleportPayload);
			});
		}
	}

	public isPlayerAfk(player: Player): boolean {
		const char = player.Character;
		if (!char) return false;
		return (char.GetAttribute("IsAfk") as boolean | undefined) ?? false;
	}

	public toggleAfk(player: Player): void {
		const currentState = this.isPlayerAfk(player);
		this.setAfk(player, !currentState);
	}

	public setAfk(player: Player, isAfk: boolean): void {
		const char = player.Character;
		if (!char) return;

		const humanoid = char.FindFirstChildOfClass("Humanoid");
		if (humanoid && humanoid.Health <= 0) return;

		if (isAfk) {
			char.SetAttribute("IsAfk", true);
			char.SetAttribute("AfkStartTime", os.time());
			char.SetAttribute("ActiveEmoteId", "");
			print(`[ServerAfkService] Player ${player.Name} is now AFK.`);
		} else {
			char.SetAttribute("IsAfk", false);
			char.SetAttribute("AfkStartTime", 0);
			print(`[ServerAfkService] Player ${player.Name} returned from AFK.`);
		}

		// Replikasi langsung ke client pemanggil agar state lokal terupdate instan
		this.afkEvent.FireClient(player, "AfkStateChanged", isAfk, isAfk ? os.time() : 0);
	}
}
