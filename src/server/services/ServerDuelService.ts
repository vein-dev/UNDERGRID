import { Players, ServerStorage } from "@rbxts/services";
import { getRemoteEvent } from "shared/network";
import { DUEL_CONFIG, DuelActiveData, DuelEndData, DuelIntroData, DuelInviteData, DuelState } from "shared/types";
import { ServerRagdollService } from "./ServerRagdollService";

interface ActiveDuelSession {
	duelId: string;
	player1: Player;
	player2: Player;
	state: DuelState;
	startTime: number;
	expiresAt: number;
}

interface PendingInvite {
	challenger: Player;
	target: Player;
	expiresAt: number;
}

/**
 * ServerDuelService - Authoritative 1v1 PvP Duel management system.
 * Handles duel invites, acceptance/decline, countdown, active state isolation,
 * and knockout detection with full HP restore.
 */
export class ServerDuelService {
	private static instance?: ServerDuelService;

	private pendingInvites = new Map<Player, PendingInvite>(); // challenger -> invite
	private invitesByTarget = new Map<Player, PendingInvite>(); // target -> invite
	private activeDuels = new Map<string, ActiveDuelSession>(); // duelId -> session
	private playerToDuel = new Map<Player, ActiveDuelSession>(); // player -> session

	// Network Remotes
	private duelRequestEvent!: RemoteEvent;
	private duelResponseEvent!: RemoteEvent;
	private duelInviteEvent!: RemoteEvent;
	private duelStateEvent!: RemoteEvent;
	private duelFeedbackEvent!: RemoteEvent;

	private constructor() {}

	public static getInstance(): ServerDuelService {
		if (!ServerDuelService.instance) {
			ServerDuelService.instance = new ServerDuelService();
		}
		return ServerDuelService.instance;
	}

	public init(): void {
		// Initialize Remotes
		this.duelRequestEvent = getRemoteEvent("DuelRequestEvent");
		this.duelResponseEvent = getRemoteEvent("DuelResponseEvent");
		this.duelInviteEvent = getRemoteEvent("DuelInviteEvent");
		this.duelStateEvent = getRemoteEvent("DuelStateEvent");
		this.duelFeedbackEvent = getRemoteEvent("DuelFeedbackEvent");

		// Listen to Client Requests
		this.duelRequestEvent.OnServerEvent.Connect((player, targetArg) => {
			if (!targetArg || !typeIs(targetArg, "Instance") || !targetArg.IsA("Player")) {
				return;
			}
			this.handleDuelRequest(player, targetArg);
		});

		this.duelResponseEvent.OnServerEvent.Connect((player, acceptedArg) => {
			this.handleDuelResponse(player, acceptedArg === true);
		});

		// Player removal cleanup
		Players.PlayerRemoving.Connect((player) => {
			this.handlePlayerRemoving(player);
		});

		// Background ticker for invite timeout and distance/timeout tracking
		task.spawn(() => this.maintenanceLoop());

		print("[ServerDuelService] Initialized successfully.");
	}

	/**
	 * Validates whether two players are authorized to engage in combat.
	 * Players can only damage each other if they are participating in the same active duel.
	 */
	public canPlayersFight(attacker: Player, target: Player): boolean {
		if (attacker === target) return false;

		const attackerDuel = this.playerToDuel.get(attacker);
		if (!attackerDuel || attackerDuel.state !== "Active") return false;

		const targetDuel = this.playerToDuel.get(target);
		if (!targetDuel || targetDuel !== attackerDuel) return false;

		return true;
	}

	/**
	 * Checks if a player is currently in any stage of a duel.
	 */
	public isPlayerInDuel(player: Player): boolean {
		return this.playerToDuel.has(player);
	}

	/**
	 * Applies safe damage during a duel.
	 * Returns true if damage resulted in a knockout (duel ended), false otherwise.
	 */
	public applyDuelDamage(attacker: Player, target: Player, targetHumanoid: Humanoid, damage: number): boolean {
		const session = this.playerToDuel.get(attacker);
		if (!session || session.state !== "Active") return false;

		// If current health minus damage is near death (<= 5)
		if (targetHumanoid.Health - damage <= 5) {
			targetHumanoid.Health = 5;
			const targetChar = target.Character;
			if (targetChar) {
				ServerRagdollService.getInstance().applyRagdoll(targetChar, 2.5);
			}
			this.endDuel(session, attacker, target, "Knockout");
			return true;
		}

		targetHumanoid.TakeDamage(damage);
		return false;
	}

	private handleDuelRequest(challenger: Player, target: Player): void {
		if (challenger === target) {
			this.duelFeedbackEvent.FireClient(challenger, "Kamu tidak bisa menantang diri sendiri.");
			return;
		}

		// Check if challenger or target already in a duel
		if (this.playerToDuel.has(challenger)) {
			this.duelFeedbackEvent.FireClient(challenger, "Kamu sedang berada dalam sesi duel.");
			return;
		}

		if (this.playerToDuel.has(target)) {
			this.duelFeedbackEvent.FireClient(challenger, `${target.DisplayName} sedang berduel dengan pemain lain.`);
			return;
		}

		// Check pending invites
		if (this.pendingInvites.has(challenger)) {
			this.duelFeedbackEvent.FireClient(challenger, "Kamu sudah mengirim tantangan duel. Tunggu respons.");
			return;
		}

		if (this.invitesByTarget.has(target)) {
			this.duelFeedbackEvent.FireClient(challenger, `${target.DisplayName} sedang menerima undangan duel lain.`);
			return;
		}

		// Check target character & AFK status
		const targetChar = target.Character;
		const challengerChar = challenger.Character;
		if (!targetChar || !challengerChar) {
			this.duelFeedbackEvent.FireClient(challenger, "Target tidak ditemukan di dunia.");
			return;
		}

		if (targetChar.GetAttribute("IsAfk") === true) {
			this.duelFeedbackEvent.FireClient(challenger, `${target.DisplayName} sedang dalam mode AFK.`);
			return;
		}

		const challengerHrp = challengerChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const targetHrp = targetChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!challengerHrp || !targetHrp) {
			this.duelFeedbackEvent.FireClient(challenger, "Posisi pemain tidak valid.");
			return;
		}

		const distance = challengerHrp.Position.sub(targetHrp.Position).Magnitude;
		if (distance > DUEL_CONFIG.MaxChallengeDistance) {
			this.duelFeedbackEvent.FireClient(challenger, `${target.DisplayName} terlalu jauh untuk ditantang duel.`);
			return;
		}

		// Create pending invite
		const invite: PendingInvite = {
			challenger,
			target,
			expiresAt: os.clock() + DUEL_CONFIG.InviteTimeoutSeconds,
		};

		this.pendingInvites.set(challenger, invite);
		this.invitesByTarget.set(target, invite);

		// Notify target with prompt
		const inviteData: DuelInviteData = {
			challengerUserId: challenger.UserId,
			challengerName: challenger.Name,
			challengerDisplayName: challenger.DisplayName,
			durationSeconds: DUEL_CONFIG.InviteTimeoutSeconds,
		};
		this.duelInviteEvent.FireClient(target, "InviteReceived", inviteData);

		// Notify challenger
		this.duelFeedbackEvent.FireClient(challenger, `Tantangan duel dikirim ke ${target.DisplayName}.`);
	}

	private handleDuelResponse(target: Player, accepted: boolean): void {
		const invite = this.invitesByTarget.get(target);
		if (!invite) return;

		this.clearInvite(invite);

		const challenger = invite.challenger;
		if (!challenger.IsDescendantOf(Players)) return;

		if (!accepted) {
			this.duelFeedbackEvent.FireClient(challenger, `${target.DisplayName} menolak tantangan duel.`);
			this.duelInviteEvent.FireClient(target, "InviteCancelled");
			return;
		}

		// Target accepted -> Start Duel Countdown
		this.startDuelSession(challenger, target);
	}

	private startDuelSession(player1: Player, player2: Player): void {
		const duelId = `duel_${player1.UserId}_${player2.UserId}_${os.clock()}`;
		const session: ActiveDuelSession = {
			duelId,
			player1,
			player2,
			state: "Intro",
			startTime: os.clock(),
			expiresAt:
				os.clock() +
				DUEL_CONFIG.IntroSeconds +
				DUEL_CONFIG.CountdownSeconds +
				DUEL_CONFIG.MaxDuelDurationSeconds,
		};

		this.activeDuels.set(duelId, session);
		this.playerToDuel.set(player1, session);
		this.playerToDuel.set(player2, session);

		// Mark characters with duel opponent attribute
		player1.Character?.SetAttribute("InDuelWith", player2.UserId);
		player2.Character?.SetAttribute("InDuelWith", player1.UserId);

		// Heal both players to full health and lock movement during intro
		const hum1 = player1.Character?.FindFirstChildOfClass("Humanoid");
		const hum2 = player2.Character?.FindFirstChildOfClass("Humanoid");
		if (hum1) {
			hum1.Health = hum1.MaxHealth;
			hum1.WalkSpeed = 0;
			hum1.JumpPower = 0;
		}
		if (hum2) {
			hum2.Health = hum2.MaxHealth;
			hum2.WalkSpeed = 0;
			hum2.JumpPower = 0;
		}

		// Face characters toward each other
		const hrp1 = player1.Character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const hrp2 = player2.Character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (hrp1 && hrp2) {
			const pos1 = hrp1.Position;
			const pos2 = hrp2.Position;
			hrp1.CFrame = CFrame.lookAt(pos1, new Vector3(pos2.X, pos1.Y, pos2.Z));
			hrp2.CFrame = CFrame.lookAt(pos2, new Vector3(pos1.X, pos2.Y, pos1.Z));
		}

		const introData1: DuelIntroData = {
			opponentUserId: player2.UserId,
			opponentName: player2.Name,
			opponentDisplayName: player2.DisplayName,
			player1UserId: player1.UserId,
			player2UserId: player2.UserId,
			durationSeconds: DUEL_CONFIG.IntroSeconds,
		};
		const introData2: DuelIntroData = {
			opponentUserId: player1.UserId,
			opponentName: player1.Name,
			opponentDisplayName: player1.DisplayName,
			player1UserId: player1.UserId,
			player2UserId: player2.UserId,
			durationSeconds: DUEL_CONFIG.IntroSeconds,
		};

		const activeData1: DuelActiveData = {
			opponentUserId: player2.UserId,
			opponentName: player2.Name,
			opponentDisplayName: player2.DisplayName,
			startTime: os.clock(),
		};
		const activeData2: DuelActiveData = {
			opponentUserId: player1.UserId,
			opponentName: player1.Name,
			opponentDisplayName: player1.DisplayName,
			startTime: os.clock(),
		};

		// 1. Fire Intro phase to both clients
		this.duelStateEvent.FireClient(player1, "Intro", introData1);
		this.duelStateEvent.FireClient(player2, "Intro", introData2);

		// 2. After Intro -> Enter Countdown Phase (3... 2... 1... FIGHT!)
		task.delay(DUEL_CONFIG.IntroSeconds, () => {
			if (this.activeDuels.get(duelId) !== session) return;

			session.state = "Countdown";
			this.ensureFistsEquipped(player1);
			this.ensureFistsEquipped(player2);

			this.duelStateEvent.FireClient(player1, "Countdown", activeData1, DUEL_CONFIG.CountdownSeconds);
			this.duelStateEvent.FireClient(player2, "Countdown", activeData2, DUEL_CONFIG.CountdownSeconds);

			// 3. After countdown -> Enter Active State
			task.delay(DUEL_CONFIG.CountdownSeconds, () => {
				if (this.activeDuels.get(duelId) !== session) return;

				session.state = "Active";
				session.startTime = os.clock();

				if (hum1 && hum1.Health > 0) {
					hum1.WalkSpeed = 11;
					hum1.UseJumpPower = true;
					hum1.JumpPower = 50;
				}
				if (hum2 && hum2.Health > 0) {
					hum2.WalkSpeed = 11;
					hum2.UseJumpPower = true;
					hum2.JumpPower = 50;
				}

				this.ensureFistsEquipped(player1);
				this.ensureFistsEquipped(player2);

				this.duelStateEvent.FireClient(player1, "Active", activeData1);
				this.duelStateEvent.FireClient(player2, "Active", activeData2);
			});
		});
	}

	public endDuel(
		session: ActiveDuelSession,
		winner: Player,
		loser: Player,
		reason: "Knockout" | "Forfeit" | "Timeout",
	): void {
		session.state = "Ended";

		this.activeDuels.delete(session.duelId);
		this.playerToDuel.delete(session.player1);
		this.playerToDuel.delete(session.player2);

		// Remove duel attributes
		session.player1.Character?.SetAttribute("InDuelWith", undefined);
		session.player2.Character?.SetAttribute("InDuelWith", undefined);

		// Bersihkan / unequip Fists kedua pemain
		this.cleanupFists(session.player1);
		this.cleanupFists(session.player2);

		// Restore both humanoids to full health safely
		task.delay(0.5, () => {
			const winnerHum = winner.Character?.FindFirstChildOfClass("Humanoid");
			const loserHum = loser.Character?.FindFirstChildOfClass("Humanoid");
			if (winnerHum) winnerHum.Health = winnerHum.MaxHealth;
			if (loserHum) loserHum.Health = loserHum.MaxHealth;
		});

		const result: DuelEndData = {
			winnerUserId: winner.UserId,
			winnerName: winner.DisplayName,
			loserUserId: loser.UserId,
			loserName: loser.DisplayName,
			reason,
		};

		if (session.player1.IsDescendantOf(Players)) {
			this.duelStateEvent.FireClient(session.player1, "Ended", result);
		}
		if (session.player2.IsDescendantOf(Players)) {
			this.duelStateEvent.FireClient(session.player2, "Ended", result);
		}
	}

	private ensureFistsEquipped(player: Player): void {
		const char = player.Character;
		if (!char) return;
		const hum = char.FindFirstChildOfClass("Humanoid");
		if (!hum || hum.Health <= 0) return;

		const backpack = player.FindFirstChildOfClass("Backpack");

		// 1. Cek apakah tool Fists sudah ada di tangan (Character)
		const inChar = char.FindFirstChild("Fists") as Tool | undefined;
		if (inChar && inChar.IsA("Tool")) {
			return;
		}

		// 2. Cek apakah tool Fists ada di Backpack -> pasang ke tangan
		const inBackpack = backpack?.FindFirstChild("Fists") as Tool | undefined;
		if (inBackpack && inBackpack.IsA("Tool")) {
			hum.EquipTool(inBackpack);
			return;
		}

		// 3. Jika belum ada sama sekali, cari template di ServerStorage/Tools/Fists
		let template: Tool | undefined;
		const toolsFolder = ServerStorage.FindFirstChild("Tools") as Folder | undefined;
		if (toolsFolder) {
			const found = toolsFolder.FindFirstChild("Fists") as Tool | undefined;
			if (found && found.IsA("Tool")) template = found;
		}
		if (!template) {
			const found = ServerStorage.FindFirstChild("Fists") as Tool | undefined;
			if (found && found.IsA("Tool")) template = found;
		}

		let tool: Tool;
		if (template) {
			tool = template.Clone();
		} else {
			tool = new Instance("Tool");
			tool.Name = "Fists";
			tool.CanBeDropped = false;
			tool.RequiresHandle = false;
		}

		tool.SetAttribute("DuelTemporaryTool", true);

		// Lepas tool apapun yang sedang dipegang (misal Skateboard/Smartphone)
		hum.UnequipTools();

		// Pasang tool ke karakter secara langsung (otomatis ter-equip di Roblox)
		tool.Parent = char;
	}

	private cleanupFists(player: Player): void {
		const char = player.Character;
		const backpack = player.FindFirstChildOfClass("Backpack");

		const clean = (t: Instance | undefined) => {
			if (t && t.IsA("Tool") && t.Name.lower().find("fist")[0] !== undefined) {
				if (t.GetAttribute("DuelTemporaryTool") === true) {
					t.Destroy();
				} else if (char) {
					const hum = char.FindFirstChildOfClass("Humanoid");
					if (hum) hum.UnequipTools();
				}
			}
		};

		clean(char?.FindFirstChild("Fists"));
		clean(backpack?.FindFirstChild("Fists"));
	}

	private clearInvite(invite: PendingInvite): void {
		this.pendingInvites.delete(invite.challenger);
		this.invitesByTarget.delete(invite.target);
	}

	private handlePlayerRemoving(player: Player): void {
		this.cleanupFists(player);

		// Clean up pending invites
		const outInvite = this.pendingInvites.get(player);
		if (outInvite) {
			this.clearInvite(outInvite);
			this.duelInviteEvent.FireClient(outInvite.target, "InviteCancelled");
		}

		const inInvite = this.invitesByTarget.get(player);
		if (inInvite) {
			this.clearInvite(inInvite);
			this.duelFeedbackEvent.FireClient(inInvite.challenger, `${player.DisplayName} telah meninggalkan permainan.`);
		}

		// Clean up active duel
		const session = this.playerToDuel.get(player);
		if (session) {
			const remaining = session.player1 === player ? session.player2 : session.player1;
			this.endDuel(session, remaining, player, "Forfeit");
		}
	}

	private maintenanceLoop(): void {
		while (true) {
			task.wait(1);
			const now = os.clock();

			// Check expired invites
			for (const [challenger, invite] of this.pendingInvites) {
				if (now >= invite.expiresAt) {
					this.clearInvite(invite);
					this.duelFeedbackEvent.FireClient(challenger, "Tantangan duel kadaluarsa (tidak direspons).");
					this.duelInviteEvent.FireClient(invite.target, "InviteCancelled");
				}
			}

			// Check active duels for distance forfeit or time limit
			for (const [duelId, session] of this.activeDuels) {
				if (session.state !== "Active") continue;

				if (now >= session.expiresAt) {
					// Time limit reached -> determine winner by highest health
					const hum1 = session.player1.Character?.FindFirstChildOfClass("Humanoid");
					const hum2 = session.player2.Character?.FindFirstChildOfClass("Humanoid");
					const hp1 = hum1 ? hum1.Health : 0;
					const hp2 = hum2 ? hum2.Health : 0;

					const winner = hp1 >= hp2 ? session.player1 : session.player2;
					const loser = winner === session.player1 ? session.player2 : session.player1;
					this.endDuel(session, winner, loser, "Timeout");
					continue;
				}

				// Check forfeit distance
				const hrp1 = session.player1.Character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
				const hrp2 = session.player2.Character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
				if (hrp1 && hrp2) {
					const dist = hrp1.Position.sub(hrp2.Position).Magnitude;
					if (dist > DUEL_CONFIG.ForfeitDistance) {
						// The one who ran further away loses or timeout
						this.endDuel(session, session.player1, session.player2, "Forfeit");
					}
				}
			}
		}
	}
}
