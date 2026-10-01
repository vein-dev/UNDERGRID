import { Players } from "@rbxts/services";
import { getRemoteEvent } from "shared/network";

/**
 * ServerAfkService - Layanan server otoritatif untuk mengelola status AFK seluruh pemain.
 * Menyimpan status AFK via Character Attributes sehingga otomatis tereplikasi ke seluruh client.
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
		// Menerima request toggle / set AFK dari client
		this.afkEvent.OnServerEvent.Connect((player, action, value) => {
			if (action === "ToggleAfk") {
				this.toggleAfk(player);
			} else if (action === "SetAfk" && typeIs(value, "boolean")) {
				this.setAfk(player, value);
			}
		});

		// Player lifecycle setup
		const handlePlayer = (player: Player) => {

			player.CharacterAdded.Connect((char) => {
				char.SetAttribute("IsAfk", false);
				char.SetAttribute("AfkStartTime", 0);

				const humanoid = char.WaitForChild("Humanoid") as Humanoid | undefined;
				if (humanoid) {
					humanoid.Died.Connect(() => {
						this.setAfk(player, false);
					});
				}
			});
		};

		Players.PlayerAdded.Connect(handlePlayer);
		for (const p of Players.GetPlayers()) {
			handlePlayer(p);
		}

		print("[ServerAfkService] Initialized with public /afk command support.");
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
