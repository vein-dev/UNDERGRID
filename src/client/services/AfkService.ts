import { Players, RunService, UserInputService, Workspace } from "@rbxts/services";
import { AFK_CONFIG } from "shared/config";
import { getRemoteEvent } from "shared/network";
import { Fonts } from "../ui/Typography";
import { AfkOverlayView } from "../ui/views/AfkOverlayView";

function formatDuration(seconds: number): string {
	const sec = math.max(0, math.floor(seconds));
	const mins = math.floor(sec / 60);
	const remSecs = sec % 60;
	if (mins >= 60) {
		const hours = math.floor(mins / 60);
		const remMins = mins % 60;
		return string.format("%02d:%02d:%02d", hours, remMins, remSecs);
	}
	return string.format("%02d:%02d", mins, remSecs);
}

interface OverheadEntry {
	billboard: BillboardGui;
	timerLabel: TextLabel;
	startTime: number;
}

/**
 * AfkService - Client service managing local Sleep 2 animation,
 * automatic movement cancel detection, and overhead running timers for all AFK characters.
 */
export class AfkService {
	private static instance?: AfkService;
	private player = Players.LocalPlayer;
	private afkEvent: RemoteEvent;

	private isLocalAfk = false;
	private sleepTrack?: AnimationTrack;
	private moveConnection?: RBXScriptConnection;
	private jumpConnection?: RBXScriptConnection;
	private inputConnection?: RBXScriptConnection;

	// Map of character model to overhead billboard entry
	private overheadBillboards = new Map<Model, OverheadEntry>();
	private updateTimerThread?: thread;

	private constructor() {
		this.afkEvent = getRemoteEvent("AfkEvent");
	}

	public static getInstance(): AfkService {
		if (!AfkService.instance) {
			AfkService.instance = new AfkService();
		}
		return AfkService.instance;
	}

	public init(): void {
		// 1. Listen for server state changes targeting local player
		this.afkEvent.OnClientEvent.Connect((action: unknown, isAfk: unknown, startTime: unknown) => {
			if (action === "AfkStateChanged" && typeIs(isAfk, "boolean")) {
				this.handleLocalAfkState(isAfk, typeIs(startTime, "number") ? startTime : os.time());
			}
		});

		// 2. Setup resume callback from overlay
		AfkOverlayView.getInstance().setOnResume(() => {
			this.setAfk(false);
		});

		// 3. Monitor characters for overhead AFK billboards (for ALL players in Workspace)
		const bindCharacterOverhead = (char: Model) => {
			char.GetAttributeChangedSignal("IsAfk").Connect(() => {
				this.checkCharacterAfk(char);
			});
			char.GetAttributeChangedSignal("AfkStartTime").Connect(() => {
				this.checkCharacterAfk(char);
			});

			this.checkCharacterAfk(char);
		};

		Players.PlayerAdded.Connect((p) => {
			p.CharacterAdded.Connect((c) => bindCharacterOverhead(c));
			if (p.Character) bindCharacterOverhead(p.Character);
		});

		for (const p of Players.GetPlayers()) {
			if (p.Character) bindCharacterOverhead(p.Character);
			p.CharacterAdded.Connect((c) => bindCharacterOverhead(c));
		}

		// Clean up when character leaves workspace
		Workspace.DescendantRemoving.Connect((inst) => {
			if (inst.IsA("Model") && this.overheadBillboards.has(inst)) {
				this.removeOverheadBillboard(inst);
			}
		});

		// 4. Start global tick for updating overhead running timers
		this.startOverheadTick();

		print("[AfkService] Initialized with Sleep2 pose and overhead running timers.");
	}

	public isAfk(): boolean {
		return this.isLocalAfk;
	}

	public toggleAfk(): void {
		this.setAfk(!this.isLocalAfk);
	}

	public setAfk(afk: boolean): void {
		this.afkEvent.FireServer("SetAfk", afk);
		// Update locally right away for instantaneous response
		this.handleLocalAfkState(afk, os.time());
	}

	// ─── Local Player State Handling ──────────────────────────────────────────

	private handleLocalAfkState(isAfk: boolean, startTime: number): void {
		if (this.isLocalAfk === isAfk) return;
		this.isLocalAfk = isAfk;

		if (isAfk) {
			this.startSleepAnimation();
			AfkOverlayView.getInstance().show(startTime);
			this.bindMovementCancel();
		} else {
			this.stopSleepAnimation();
			AfkOverlayView.getInstance().hide();
			this.unbindMovementCancel();
		}
	}

	private startSleepAnimation(): void {
		const char = this.player.Character;
		if (!char) return;
		const humanoid = char.FindFirstChildOfClass("Humanoid");
		if (!humanoid || humanoid.Health <= 0) return;

		let animator = humanoid.FindFirstChildOfClass("Animator");
		if (!animator) {
			animator = new Instance("Animator");
			animator.Parent = humanoid;
		}

		this.stopSleepAnimation();

		const anim = new Instance("Animation");
		anim.AnimationId = AFK_CONFIG.AnimationId;

		const [success, trackOrErr] = pcall(() => {
			const track = animator!.LoadAnimation(anim);
			track.Looped = true;
			track.Priority = Enum.AnimationPriority.Action4;
			track.Play(0.3);
			return track;
		});

		if (success && typeIs(trackOrErr, "Instance")) {
			this.sleepTrack = trackOrErr as AnimationTrack;
		} else {
			warn(`[AfkService] Failed to load Sleep2 animation:`, trackOrErr);
		}
	}

	private stopSleepAnimation(): void {
		if (this.sleepTrack) {
			this.sleepTrack.Stop(0.25);
			this.sleepTrack.Destroy();
			this.sleepTrack = undefined;
		}
	}

	private bindMovementCancel(): void {
		this.unbindMovementCancel();

		const char = this.player.Character;
		if (!char) return;
		const humanoid = char.FindFirstChildOfClass("Humanoid");
		if (!humanoid) return;

		// 1. Gerakan MoveDirection (WASD, mobile virtual thumbstick)
		this.moveConnection = humanoid.GetPropertyChangedSignal("MoveDirection").Connect(() => {
			if (humanoid.MoveDirection.Magnitude > 0.05) {
				this.setAfk(false);
			}
		});

		// 2. Tombol Lompat / Space
		this.jumpConnection = humanoid.Jumping.Connect(() => {
			this.setAfk(false);
		});

		// 3. Input keyboard gerak
		this.inputConnection = UserInputService.InputBegan.Connect((input, processed) => {
			if (processed) return;
			const code = input.KeyCode;
			if (
				code === Enum.KeyCode.W ||
				code === Enum.KeyCode.A ||
				code === Enum.KeyCode.S ||
				code === Enum.KeyCode.D ||
				code === Enum.KeyCode.Space
			) {
				this.setAfk(false);
			}
		});
	}

	private unbindMovementCancel(): void {
		this.moveConnection?.Disconnect();
		this.moveConnection = undefined;
		this.jumpConnection?.Disconnect();
		this.jumpConnection = undefined;
		this.inputConnection?.Disconnect();
		this.inputConnection = undefined;
	}

	// ─── Overhead Running Timers (Multiplayer) ───────────────────────────────

	private checkCharacterAfk(char: Model): void {
		const isAfk = (char.GetAttribute("IsAfk") as boolean | undefined) ?? false;
		const startTime = (char.GetAttribute("AfkStartTime") as number | undefined) ?? os.time();

		if (isAfk) {
			this.createOrUpdateOverheadBillboard(char, startTime);
		} else {
			this.removeOverheadBillboard(char);
		}
	}

	private createOrUpdateOverheadBillboard(char: Model, startTime: number): void {
		const head = (char.FindFirstChild("Head") ?? char.FindFirstChild("HumanoidRootPart")) as BasePart | undefined;
		if (!head) return;

		const existing = this.overheadBillboards.get(char);
		if (existing) {
			existing.startTime = startTime;
			return;
		}

		// Clean up any stale billboard with the same name
		const stale = head.FindFirstChild("AfkOverheadBillboard");
		if (stale) stale.Destroy();

		const billboard = new Instance("BillboardGui");
		billboard.Name = "AfkOverheadBillboard";
		billboard.Adornee = head;
		billboard.Size = new UDim2(0, 130, 0, 42);
		billboard.StudsOffset = new Vector3(0, 3.2, 0);
		billboard.MaxDistance = AFK_CONFIG.MaxDistance;
		billboard.AlwaysOnTop = true;
		billboard.ResetOnSpawn = false;

		const container = new Instance("Frame");
		container.Name = "AfkContainer";
		container.Size = new UDim2(1, 0, 1, 0);
		container.BackgroundTransparency = 1;
		container.BorderSizePixel = 0;

		const layout = new Instance("UIListLayout");
		layout.FillDirection = Enum.FillDirection.Vertical;
		layout.VerticalAlignment = Enum.VerticalAlignment.Center;
		layout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
		layout.Padding = new UDim(0, 2);
		layout.Parent = container;

		// 1. Tulisan "AFK" (Merah, tepat di tengah atas)
		const titleLabel = new Instance("TextLabel");
		titleLabel.Name = "TitleLabel";
		titleLabel.Size = new UDim2(1, 0, 0, 16);
		titleLabel.BackgroundTransparency = 1;
		titleLabel.Text = "AFK";
		titleLabel.TextColor3 = Color3.fromHex("#ef4444"); // Vibrant Red
		titleLabel.Font = Fonts.Bold;
		titleLabel.TextSize = 14;
		titleLabel.TextXAlignment = Enum.TextXAlignment.Center;
		titleLabel.TextYAlignment = Enum.TextYAlignment.Center;

		const titleStroke = new Instance("UIStroke");
		titleStroke.Color = Color3.fromHex("#000000");
		titleStroke.Transparency = 0.4;
		titleStroke.Thickness = 1.2;
		titleStroke.Parent = titleLabel;

		titleLabel.Parent = container;

		// 2. Durasi Waktu AFK (Putih, tepat di bawah tulisan AFK)
		const timerLabel = new Instance("TextLabel");
		timerLabel.Name = "TimerLabel";
		timerLabel.Size = new UDim2(1, 0, 0, 14);
		timerLabel.BackgroundTransparency = 1;
		const initialElapsed = math.max(0, os.time() - startTime);
		timerLabel.Text = formatDuration(initialElapsed);
		timerLabel.TextColor3 = Color3.fromHex("#ffffff"); // Pure White
		timerLabel.Font = Fonts.Medium;
		timerLabel.TextSize = 12;
		timerLabel.TextXAlignment = Enum.TextXAlignment.Center;
		timerLabel.TextYAlignment = Enum.TextYAlignment.Center;

		const timerStroke = new Instance("UIStroke");
		timerStroke.Color = Color3.fromHex("#000000");
		timerStroke.Transparency = 0.5;
		timerStroke.Thickness = 1.2;
		timerStroke.Parent = timerLabel;

		timerLabel.Parent = container;

		container.Parent = billboard;
		billboard.Parent = head;

		this.overheadBillboards.set(char, {
			billboard,
			timerLabel,
			startTime,
		});
	}

	private removeOverheadBillboard(char: Model): void {
		const entry = this.overheadBillboards.get(char);
		if (entry) {
			entry.billboard.Destroy();
			this.overheadBillboards.delete(char);
		}
	}

	private startOverheadTick(): void {
		if (this.updateTimerThread) return;

		this.updateTimerThread = task.spawn(() => {
			while (true) {
				task.wait(1);
				const now = os.time();
				for (const [char, entry] of this.overheadBillboards) {
					if (!char.Parent) {
						this.removeOverheadBillboard(char);
						continue;
					}
					const elapsed = math.max(0, now - entry.startTime);
					entry.timerLabel.Text = formatDuration(elapsed);
				}
			}
		});
	}
}
