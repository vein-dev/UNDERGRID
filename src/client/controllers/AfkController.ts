import { Players, UserInputService } from "@rbxts/services";
import { AFK_CONFIG } from "shared/config";
import { getRemoteEvent } from "shared/network";
import { AfkService } from "../services/AfkService";

/**
 * AfkController - Client controller managing input & chat-based triggers for AFK mode,
 * as well as tracking 19-minute physical inactivity to perform auto-rejoin with last location restoration.
 */
export class AfkController {
	private static instance?: AfkController;
	private player = Players.LocalPlayer;
	private afkEvent: RemoteEvent;

	private lastActivityTimestamp = os.clock();
	private hasTriggeredRejoin = false;
	private checkThread?: thread;

	private constructor() {
		this.afkEvent = getRemoteEvent("AfkEvent");
	}

	public static getInstance(): AfkController {
		if (!AfkController.instance) {
			AfkController.instance = new AfkController();
		}
		return AfkController.instance;
	}

	public init(): void {
		// Initialize AfkService (animations, overlay, and overhead billboards)
		AfkService.getInstance().init();

		// Record initial activity
		this.lastActivityTimestamp = os.clock();

		// Bind player physical inputs to reset the idle timer
		this.bindActivityListeners();

		// Start background inactivity watchdog (checks every 2 seconds)
		this.startInactivityWatchdog();

		print("[AfkController] Initialized with 19-minute auto-rejoin anti-kick protection.");
	}

	public toggleAfk(): void {
		AfkService.getInstance().toggleAfk();
	}

	public recordActivity(): void {
		this.lastActivityTimestamp = os.clock();
		this.hasTriggeredRejoin = false;
	}

	public getIdleSeconds(): number {
		return os.clock() - this.lastActivityTimestamp;
	}

	public getRemainingSeconds(): number {
		return math.max(0, AFK_CONFIG.AutoRejoinTimeoutSeconds - this.getIdleSeconds());
	}

	private bindActivityListeners(): void {
		// 1. Keyboard & Gamepad buttons
		UserInputService.InputBegan.Connect(() => {
			this.recordActivity();
		});

		// 2. Mouse movements & wheel
		UserInputService.InputChanged.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseMovement ||
				input.UserInputType === Enum.UserInputType.MouseWheel
			) {
				this.recordActivity();
			}
		});

		// 3. Mobile touch events
		UserInputService.TouchStarted.Connect(() => {
			this.recordActivity();
		});

		UserInputService.TouchMoved.Connect(() => {
			this.recordActivity();
		});
	}

	private startInactivityWatchdog(): void {
		if (this.checkThread) return;

		this.checkThread = task.spawn(() => {
			while (true) {
				task.wait(2);

				const idleTime = os.clock() - this.lastActivityTimestamp;

				if (idleTime >= AFK_CONFIG.AutoRejoinTimeoutSeconds && !this.hasTriggeredRejoin) {
					this.hasTriggeredRejoin = true;
					this.executeAutoRejoin();
				}
			}
		});
	}

	private executeAutoRejoin(): void {
		const char = this.player.Character;
		const root = char?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

		let coords: [number, number, number, number, number, number];

		if (root) {
			const cf = root.CFrame;
			const lv = cf.LookVector;
			coords = [cf.X, cf.Y, cf.Z, lv.X, lv.Y, lv.Z];
		} else if (char) {
			const cf = char.GetPivot();
			const lv = cf.LookVector;
			coords = [cf.X, cf.Y, cf.Z, lv.X, lv.Y, lv.Z];
		} else {
			coords = [0, 10, 0, 0, 0, -1];
		}

		print(
			`[AfkController] Inactivity limit (${AFK_CONFIG.AutoRejoinTimeoutSeconds}s) reached. Requesting auto-rejoin with coordinates: (${coords[0]}, ${coords[1]}, ${coords[2]})...`,
		);

		this.afkEvent.FireServer("RequestAfkRejoin", coords);
	}
}
