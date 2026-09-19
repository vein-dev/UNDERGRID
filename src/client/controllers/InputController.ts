import { UserInputService } from "@rbxts/services";

/**
 * Client singleton controller managing global inputs and keybinds.
 */
export class InputController {
	private static instance?: InputController;
	private keybindCallbacks = new Map<Enum.KeyCode, () => void>();

	private constructor() {}

	public static getInstance(): InputController {
		if (!InputController.instance) {
			InputController.instance = new InputController();
		}
		return InputController.instance;
	}

	public init(): void {
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed) return;

			const callback = this.keybindCallbacks.get(input.KeyCode);
			callback?.();
		});

		print("[InputController] Initialized successfully.");
	}

	public bindKey(keyCode: Enum.KeyCode, callback: () => void): void {
		this.keybindCallbacks.set(keyCode, callback);
	}

	public unbindKey(keyCode: Enum.KeyCode): void {
		this.keybindCallbacks.delete(keyCode);
	}
}
