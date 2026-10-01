import { Players } from "@rbxts/services";
import { AfkService } from "../services/AfkService";

/**
 * AfkController - Client controller managing input & chat-based triggers for AFK mode.
 */
export class AfkController {
	private static instance?: AfkController;
	private player = Players.LocalPlayer;

	private constructor() {}

	public static getInstance(): AfkController {
		if (!AfkController.instance) {
			AfkController.instance = new AfkController();
		}
		return AfkController.instance;
	}

	public init(): void {
		// Initialize AfkService
		AfkService.getInstance().init();

		print("[AfkController] Initialized with command /afk support.");
	}

	public toggleAfk(): void {
		AfkService.getInstance().toggleAfk();
	}
}
