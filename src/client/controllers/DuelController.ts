import { Players } from "@rbxts/services";
import { DuelActiveData, DuelEndData, DuelInviteData } from "shared/types";
import { DuelService } from "../services/DuelService";
import { DuelHudView } from "../ui/views/DuelHudView";
import { DuelInviteView } from "../ui/views/DuelInviteView";

/**
 * DuelController - Controls client-side duel flow:
 * prompts, countdown, HUD state, and auto-equipping combat weapons.
 */
export class DuelController {
	private static instance?: DuelController;
	private duelService = DuelService.getInstance();
	private inviteView = DuelInviteView.getInstance();
	private hudView = DuelHudView.getInstance();
	private localPlayer = Players.LocalPlayer;

	private constructor() {}

	public static getInstance(): DuelController {
		if (!DuelController.instance) {
			DuelController.instance = new DuelController();
		}
		return DuelController.instance;
	}

	public init(): void {
		this.duelService.setCallbacks({
			onInviteReceived: (data) => this.handleInviteReceived(data),
			onInviteCancelled: () => this.handleInviteCancelled(),
			onCountdown: (data, duration) => this.handleCountdown(data, duration),
			onActive: (data) => this.handleActive(data),
			onEnded: (result) => this.handleEnded(result),
		});

		print("[DuelController] Initialized successfully.");
	}

	private handleInviteReceived(data: DuelInviteData): void {
		this.inviteView.show(
			data,
			() => {
				this.duelService.respondDuel(true);
			},
			() => {
				this.duelService.respondDuel(false);
			},
		);
	}

	private handleInviteCancelled(): void {
		this.inviteView.hide();
	}

	private handleCountdown(data: DuelActiveData, duration: number): void {
		this.inviteView.hide();

		// Play countdown (3... 2... 1... FIGHT!)
		this.hudView.startCountdown(duration, () => {
			this.equipCombatTool();
		});
	}

	private handleActive(data: DuelActiveData): void {
		this.equipCombatTool();
		this.hudView.showActive(data);
	}

	private handleEnded(result: DuelEndData): void {
		this.hudView.showEnded(result, () => {
			this.unequipCombatTool();
		});

		// Ensure tools unequipped after a grace period
		task.delay(3.5, () => {
			this.unequipCombatTool();
		});
	}

	/**
	 * Automatically equips Fists from character or backpack.
	 */
	private equipCombatTool(): void {
		const char = this.localPlayer.Character;
		if (!char) return;

		const hum = char.FindFirstChildOfClass("Humanoid");
		if (!hum || hum.Health <= 0) return;

		const tryEquip = (): boolean => {
			// Already equipped in character?
			const currentTool = char.FindFirstChildOfClass("Tool");
			if (currentTool && currentTool.Name.lower().find("fist")[0] !== undefined) {
				return true;
			}

			// In backpack?
			const backpack = this.localPlayer.FindFirstChildOfClass("Backpack");
			if (backpack) {
				for (const tool of backpack.GetChildren()) {
					if (tool.IsA("Tool") && tool.Name.lower().find("fist")[0] !== undefined) {
						hum.EquipTool(tool);
						return true;
					}
				}
			}

			return false;
		};

		if (!tryEquip()) {
			// Jika tool sedang direplikasi dari server, tunggu sejenak hingga tiba
			task.spawn(() => {
				for (let attempt = 0; attempt < 10; attempt++) {
					task.wait(0.2);
					if (tryEquip()) break;
				}
			});
		}
	}

	/**
	 * Unequips any combat tools when duel ends.
	 */
	private unequipCombatTool(): void {
		const char = this.localPlayer.Character;
		if (!char) return;

		const hum = char.FindFirstChildOfClass("Humanoid");
		if (hum) {
			hum.UnequipTools();
		}
	}
}
