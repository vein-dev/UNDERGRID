import { Players } from "@rbxts/services";
import { PlayerData, PlayerRole } from "shared/types";
import { getRemoteFunction, getRemoteEvent } from "shared/network/Remotes";

/**
 * Server singleton service responsible for managing player lifecycle, data, and character rules.
 */
export class ServerPlayerService {
	private static instance?: ServerPlayerService;
	private playerData = new Map<Player, PlayerData>();

	private constructor() {}

	public static getInstance(): ServerPlayerService {
		if (!ServerPlayerService.instance) {
			ServerPlayerService.instance = new ServerPlayerService();
		}
		return ServerPlayerService.instance;
	}

	public init(): void {
		const initialDataFunc = getRemoteFunction("GetInitialPlayerData");
		initialDataFunc.OnServerInvoke = (player) => {
			let data = this.playerData.get(player);
			let attempts = 0;
			while (!data && attempts < 20) {
				task.wait(0.1);
				data = this.playerData.get(player);
				attempts++;
			}
			return {
				isReady: true,
				userId: player.UserId,
				level: data?.level ?? 1,
				coins: data?.coins ?? 100,
				role: data?.role ?? PlayerRole.Player,
			};
		};

		Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player));
		Players.PlayerRemoving.Connect((player) => this.onPlayerRemoving(player));

		// Handle players already in game
		for (const player of Players.GetPlayers()) {
			this.onPlayerAdded(player);
		}

		// Handle authoritative fall damage event
		const fallDamageEvent = getRemoteEvent("FallDamageEvent");
		fallDamageEvent.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
			const damage = typeIs(args[0], "number") ? args[0] : 0;
			if (damage <= 0) return;
			const cappedDamage = math.min(damage, 100);
			const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
			if (humanoid && humanoid.Health > 0) {
				humanoid.TakeDamage(cappedDamage);
			}
		});

		print("[ServerPlayerService] Initialized successfully.");
	}

	private onPlayerAdded(player: Player): void {
		const data: PlayerData = {
			userId: player.UserId,
			role: player.UserId === game.CreatorId ? PlayerRole.Developer : PlayerRole.Player,
			level: 1,
			coins: 100,
		};

		this.playerData.set(player, data);

		// WAJIB: Pastikan Server selalu meng-instansiasi Animator resmi di dalam Humanoid agar replikasi animasi client aktif ke seluruh pemain
		const setupCharacter = (char: Model) => {
			const humanoid = char.WaitForChild("Humanoid", 10) as Humanoid | undefined;
			if (humanoid) {
				let animator = humanoid.FindFirstChildOfClass("Animator");
				if (!animator) {
					animator = new Instance("Animator");
					animator.Name = "Animator";
					animator.Parent = humanoid;
					print(`[ServerPlayerService] Animator resmi berhasil dibuat oleh server untuk ${player.Name}`);
				}
			}
		};

		player.CharacterAdded.Connect(setupCharacter);
		if (player.Character) {
			setupCharacter(player.Character);
		}

		print(`[ServerPlayerService] Player joined: ${player.Name} (Level ${data.level})`);
	}

	private onPlayerRemoving(player: Player): void {
		this.playerData.delete(player);
		print(`[ServerPlayerService] Player left: ${player.Name}`);
	}

	public getData(player: Player): PlayerData | undefined {
		return this.playerData.get(player);
	}
}


