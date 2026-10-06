import { GuiService, Players, RunService, StarterGui, UserInputService, Workspace } from "@rbxts/services";
import { HotbarController } from "./HotbarController";
import { TopbarController } from "./TopbarController";

export interface FreecamState {
	isActive: boolean;
	speedMultiplier: number;
	fov: number;
	isHudVisible: boolean;
}

export type FreecamStateListener = (state: FreecamState) => void;

/**
 * FreecamController
 *
 * OOP Singleton Client Controller that manages free-flying camera for Mobile & PC.
 * Features:
 * - Scriptable Camera with smooth translation and rotation
 * - Multi-speed flight presets (Slow, Normal, Fast)
 * - Dynamic FOV / Zoom control
 * - Automatic Humanoid & Mobile touch controls suppression
 * - State listeners for reactive UI
 * - Full PC keyboard (WASD, Q/E, Space/Shift) and Mouse look & zoom controls
 */
export class FreecamController {
	private static instance?: FreecamController;

	private camera = Workspace.CurrentCamera ?? (Workspace.WaitForChild("Camera") as Camera);
	private localPlayer = Players.LocalPlayer;

	private isActive = false;
	private speedMultiplier = 1.0;
	private fov = 70;
	private isHudVisible = true;

	private position = Vector3.zero;
	private yaw = 0;
	private pitch = 0;

	private moveVector = Vector3.zero; // X: Strafe, Y: Elevate, Z: Forward/Back
	private lookDelta = Vector2.zero; // X: Yaw, Y: Pitch

	private baseSpeed = 42; // Studs per second at 1.0x
	private lookSensitivity = 0.0035;

	private renderConnection?: RBXScriptConnection;
	private inputBeganConn?: RBXScriptConnection;
	private inputEndedConn?: RBXScriptConnection;
	private inputChangedConn?: RBXScriptConnection;
	private isRightMouseDown = false;
	private touchGuiConn?: RBXScriptConnection;
	private listeners: FreecamStateListener[] = [];

	private savedWalkSpeed?: number;
	private savedJumpPower?: number;
	private savedJumpHeight?: number;

	private constructor() {
		Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(() => {
			if (Workspace.CurrentCamera) {
				this.camera = Workspace.CurrentCamera;
			}
		});

		this.localPlayer.CharacterAdded.Connect(() => {
			if (this.isActive) {
				this.stopFreecam();
			}
		});
	}

	public static getInstance(): FreecamController {
		if (!FreecamController.instance) {
			FreecamController.instance = new FreecamController();
		}
		return FreecamController.instance;
	}

	public init(): void {
		print("[FreecamController] Initialized.");
	}

	public onStateChanged(cb: FreecamStateListener): () => void {
		this.listeners.push(cb);
		cb(this.getState());
		return () => {
			this.listeners = this.listeners.filter((l) => l !== cb);
		};
	}

	public getState(): FreecamState {
		return {
			isActive: this.isActive,
			speedMultiplier: this.speedMultiplier,
			fov: this.fov,
			isHudVisible: this.isHudVisible,
		};
	}

	private emitState(): void {
		const state = this.getState();
		for (const cb of this.listeners) {
			cb(state);
		}
	}

	/**
	 * Activates Freecam mode.
	 */
	public startFreecam(): void {
		if (this.isActive) return;
		this.isActive = true;

		if (!this.camera) {
			this.camera = Workspace.CurrentCamera ?? (Workspace.WaitForChild("Camera") as Camera);
		}

		// Initial position & orientation from current camera
		const currentCF = this.camera.CFrame;
		this.position = currentCF.Position;

		const [rx, ry] = currentCF.ToOrientation();
		this.pitch = rx;
		this.yaw = ry;
		this.moveVector = Vector3.zero;
		this.lookDelta = Vector2.zero;
		this.isRightMouseDown = false;

		// Suppress player controls & freeze character
		this.suppressControls(true);

		// Switch camera type
		this.camera.CameraType = Enum.CameraType.Scriptable;
		this.camera.FieldOfView = this.fov;

		// 1. PC Keyboard & Mouse Listeners
		this.inputBeganConn?.Disconnect();
		this.inputBeganConn = UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (input.UserInputType === Enum.UserInputType.MouseButton2) {
				this.isRightMouseDown = true;
				UserInputService.MouseBehavior = Enum.MouseBehavior.LockCurrentPosition;
			} else if (input.KeyCode === Enum.KeyCode.H && !gameProcessed) {
				this.toggleHudVisibility();
			}
		});

		this.inputEndedConn?.Disconnect();
		this.inputEndedConn = UserInputService.InputEnded.Connect((input) => {
			if (input.UserInputType === Enum.UserInputType.MouseButton2) {
				this.isRightMouseDown = false;
				UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
			}
		});

		this.inputChangedConn?.Disconnect();
		this.inputChangedConn = UserInputService.InputChanged.Connect((input) => {
			if (input.UserInputType === Enum.UserInputType.MouseMovement) {
				if (this.isRightMouseDown || UserInputService.IsMouseButtonPressed(Enum.UserInputType.MouseButton2)) {
					this.addLookDelta(new Vector2(input.Delta.X, input.Delta.Y));
				}
			} else if (input.UserInputType === Enum.UserInputType.MouseWheel) {
				const currentFov = this.fov;
				const newFov = math.clamp(currentFov - input.Position.Z * 4, 25, 95);
				this.setFov(newFov);
			}
		});

		// 2. Start RenderStepped flight loop
		this.renderConnection?.Disconnect();
		this.renderConnection = RunService.RenderStepped.Connect((dt) => {
			this.updateCamera(dt);
		});

		this.emitState();
		print("[FreecamController] Freecam activated with Mobile & PC support.");
	}

	/**
	 * Deactivates Freecam mode and returns camera to character.
	 */
	public stopFreecam(): void {
		if (!this.isActive) return;
		this.isActive = false;

		this.renderConnection?.Disconnect();
		this.renderConnection = undefined;

		this.inputBeganConn?.Disconnect();
		this.inputBeganConn = undefined;

		this.inputEndedConn?.Disconnect();
		this.inputEndedConn = undefined;

		this.inputChangedConn?.Disconnect();
		this.inputChangedConn = undefined;

		this.isRightMouseDown = false;
		UserInputService.MouseBehavior = Enum.MouseBehavior.Default;

		this.moveVector = Vector3.zero;
		this.lookDelta = Vector2.zero;

		// Restore camera
		if (this.camera) {
			this.camera.FieldOfView = 70;
			const char = this.localPlayer.Character;
			const hum = char?.FindFirstChildOfClass("Humanoid");
			if (hum) {
				this.camera.CameraSubject = hum;
			}
			this.camera.CameraType = Enum.CameraType.Custom;
		}

		// Restore controls
		this.suppressControls(false);

		this.emitState();
		print("[FreecamController] Freecam deactivated.");
	}

	public toggleFreecam(): void {
		if (this.isActive) {
			this.stopFreecam();
		} else {
			this.startFreecam();
		}
	}

	public getIsActive(): boolean {
		return this.isActive;
	}

	/**
	 * Sets the movement vector from virtual thumbstick & elevation buttons.
	 * @param move Vector3(strafe, elevate, forward) where forward is -Z
	 */
	public setMoveVector(move: Vector3): void {
		this.moveVector = move;
	}

	/**
	 * Adds rotational delta from touch dragging.
	 */
	public addLookDelta(delta: Vector2): void {
		this.lookDelta = this.lookDelta.add(delta);
	}

	public setSpeedMultiplier(multiplier: number): void {
		this.speedMultiplier = math.clamp(multiplier, 0.2, 5.0);
		this.emitState();
	}

	public setFov(newFov: number): void {
		this.fov = math.clamp(math.floor(newFov + 0.5), 25, 95);
		if (this.isActive && this.camera) {
			this.camera.FieldOfView = this.fov;
		}
		this.emitState();
	}

	public toggleHudVisibility(): void {
		this.isHudVisible = !this.isHudVisible;
		this.emitState();
	}

	public setHudVisibility(visible: boolean): void {
		this.isHudVisible = visible;
		this.emitState();
	}

	private updateCamera(dt: number): void {
		if (!this.camera) return;

		// 1. Process Look Delta (Rotation)
		const lookDelta = this.lookDelta;
		this.lookDelta = Vector2.zero;

		this.yaw = (this.yaw - lookDelta.X * this.lookSensitivity) % (math.pi * 2);
		const maxPitch = math.rad(82);
		this.pitch = math.clamp(this.pitch - lookDelta.Y * this.lookSensitivity, -maxPitch, maxPitch);

		const rotationCF = CFrame.Angles(0, this.yaw, 0).mul(CFrame.Angles(this.pitch, 0, 0));

		// 2. Process Translation (Combine Mobile Virtual Thumbstick + PC Keyboard WASD/QE/Space/Shift)
		let kbX = 0;
		let kbY = 0;
		let kbZ = 0;

		if (UserInputService.IsKeyDown(Enum.KeyCode.W) || UserInputService.IsKeyDown(Enum.KeyCode.Up)) kbZ -= 1;
		if (UserInputService.IsKeyDown(Enum.KeyCode.S) || UserInputService.IsKeyDown(Enum.KeyCode.Down)) kbZ += 1;
		if (UserInputService.IsKeyDown(Enum.KeyCode.A) || UserInputService.IsKeyDown(Enum.KeyCode.Left)) kbX -= 1;
		if (UserInputService.IsKeyDown(Enum.KeyCode.D) || UserInputService.IsKeyDown(Enum.KeyCode.Right)) kbX += 1;
		if (UserInputService.IsKeyDown(Enum.KeyCode.E) || UserInputService.IsKeyDown(Enum.KeyCode.Space)) kbY += 1;
		if (UserInputService.IsKeyDown(Enum.KeyCode.Q) || UserInputService.IsKeyDown(Enum.KeyCode.LeftShift)) kbY -= 1;

		const finalMoveX = math.clamp(this.moveVector.X + kbX, -1, 1);
		const finalMoveY = math.clamp(this.moveVector.Y + kbY, -1, 1);
		const finalMoveZ = math.clamp(this.moveVector.Z + kbZ, -1, 1);

		// moveVector.Z is forward (-1) / back (+1)
		// moveVector.X is strafe left (-1) / right (+1)
		// moveVector.Y is elevate down (-1) / up (+1)
		const forwardDir = rotationCF.LookVector.mul(-finalMoveZ);
		const rightDir = rotationCF.RightVector.mul(finalMoveX);
		const upDir = Vector3.yAxis.mul(finalMoveY);

		const combinedDir = forwardDir.add(rightDir).add(upDir);
		const moveSpeed = this.baseSpeed * this.speedMultiplier;

		this.position = this.position.add(combinedDir.mul(moveSpeed * dt));

		// 3. Apply to camera
		this.camera.CFrame = new CFrame(this.position).mul(rotationCF);
	}

	private suppressControls(suppress: boolean): void {
		// 1. Freeze character movement, anchor HRP & unequip any tools
		const char = this.localPlayer.Character;
		const hum = char?.FindFirstChildOfClass("Humanoid");
		const hrp = char?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

		if (suppress) {
			if (hrp) {
				hrp.SetAttribute("IsFreecam", true);
				hrp.Anchored = true;
			}
			if (hum) {
				hum.UnequipTools();
				this.savedWalkSpeed = hum.WalkSpeed;
				this.savedJumpPower = hum.JumpPower;
				this.savedJumpHeight = hum.JumpHeight;
				hum.WalkSpeed = 0;
				hum.JumpPower = 0;
				hum.JumpHeight = 0;
				hum.AutoRotate = false;
			}
		} else {
			if (hrp) {
				hrp.SetAttribute("IsFreecam", false);
				hrp.Anchored = false;
			}
			if (hum) {
				hum.WalkSpeed = this.savedWalkSpeed ?? 16;
				if (this.savedJumpPower !== undefined) {
					hum.JumpPower = this.savedJumpPower;
				}
				if (this.savedJumpHeight !== undefined) {
					hum.JumpHeight = this.savedJumpHeight;
				}
				hum.AutoRotate = true;
			}
		}

		// 2. Suppress Hotbar
		try {
			HotbarController.getInstance().setVisible(!suppress);
		} catch {
			// safe
		}

		// 3. Suppress TopbarPlus & Roblox CoreGui
		try {
			TopbarController.getInstance().setEnabled(!suppress);
		} catch {
			// safe
		}

		pcall(() => {
			StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.All, !suppress);
			if (!suppress) {
				StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false);
			}
		});

		// 3. Suppress default TouchGui
		const playerGui = this.localPlayer.FindFirstChildOfClass("PlayerGui");
		const touchGui = playerGui?.FindFirstChild("TouchGui") as ScreenGui | undefined;
		if (touchGui) {
			touchGui.Enabled = !suppress;
		}

		if (suppress) {
			this.touchGuiConn?.Disconnect();
			if (playerGui) {
				this.touchGuiConn = playerGui.ChildAdded.Connect((child) => {
					if (child.Name === "TouchGui" && child.IsA("ScreenGui")) {
						child.Enabled = false;
					}
				});
			}
		} else {
			this.touchGuiConn?.Disconnect();
			this.touchGuiConn = undefined;
		}

		// 4. Suppress default TouchControls via GuiService
		try {
			GuiService.TouchControlsEnabled = !suppress;
		} catch {
			// safe
		}

		// 5. Suppress PlayerModule controls
		try {
			const playerScripts = this.localPlayer.FindFirstChild("PlayerScripts");
			const playerModule = playerScripts?.FindFirstChild("PlayerModule");
			if (playerModule) {
				const controls = require(playerModule as ModuleScript) as {
					GetControls: () => { Disable: () => void; Enable: (enable?: boolean) => void };
				};
				if (suppress) {
					controls.GetControls().Disable();
				} else {
					controls.GetControls().Enable(true);
				}
			}
		} catch {
			// safe
		}
	}
}
