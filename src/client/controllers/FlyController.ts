import { Players, RunService, UserInputService, Workspace } from "@rbxts/services";
import { getRemoteEvent } from "shared/network";

/**
 * FlyController
 * Mengendalikan fisika terbang berbasis orientasi kamera untuk Admin.
 * Mendukung kontrol keyboard (WASD, Space naik, Shift turun) serta thumbstick mobile.
 */
export class FlyController {
	private static instance?: FlyController;

	private isFlying = false;
	private flySpeed = 50;
	private bodyVelocity?: BodyVelocity;
	private bodyGyro?: BodyGyro;
	private renderConnection?: RBXScriptConnection;
	private charConnection?: RBXScriptConnection;

	private constructor() {}

	public static getInstance(): FlyController {
		if (!FlyController.instance) {
			FlyController.instance = new FlyController();
		}
		return FlyController.instance;
	}

	public init(): void {
		const adminFlyToggleEvent = getRemoteEvent("AdminFlyToggleEvent");

		adminFlyToggleEvent.OnClientEvent.Connect((active: unknown, speed: unknown) => {
			if (active === true) {
				const newSpeed = typeIs(speed, "number") && speed > 0 ? speed : 50;
				this.startFlight(newSpeed);
			} else {
				this.stopFlight();
			}
		});

		// Bersihkan state saat respawn
		const localPlayer = Players.LocalPlayer;
		localPlayer.CharacterAdded.Connect(() => {
			this.stopFlight();
		});
	}

	public toggleFlight(speed = 50): void {
		if (this.isFlying) {
			this.stopFlight();
		} else {
			this.startFlight(speed);
		}
	}

	public startFlight(speed = 50): void {
		if (this.isFlying) {
			this.flySpeed = speed;
			return;
		}

		const localPlayer = Players.LocalPlayer;
		const character = localPlayer.Character;
		if (!character) return;

		const rootPart = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!rootPart || !humanoid || humanoid.Health <= 0) return;

		this.isFlying = true;
		this.flySpeed = speed;

		this.cleanupPhysics();

		const bv = new Instance("BodyVelocity");
		bv.Name = "AdminFlyVelocity";
		bv.MaxForce = new Vector3(math.huge, math.huge, math.huge);
		bv.Velocity = Vector3.zero;
		bv.Parent = rootPart;
		this.bodyVelocity = bv;

		const bg = new Instance("BodyGyro");
		bg.Name = "AdminFlyGyro";
		bg.MaxTorque = new Vector3(math.huge, math.huge, math.huge);
		bg.P = 15000;
		bg.CFrame = rootPart.CFrame;
		bg.Parent = rootPart;
		this.bodyGyro = bg;

		humanoid.PlatformStand = true;

		// Loop RenderStepped untuk pergerakan halus
		this.renderConnection = RunService.RenderStepped.Connect(() => {
			if (!this.isFlying || !this.bodyVelocity || !this.bodyGyro || !rootPart.Parent) {
				this.stopFlight();
				return;
			}

			const camera = Workspace.CurrentCamera;
			if (!camera) return;

			this.bodyGyro.CFrame = camera.CFrame;

			let moveDir = Vector3.zero;

			// 1. Kontrol Keyboard (PC) saat tidak sedang mengetik teks
			if (UserInputService.GetFocusedTextBox() === undefined) {
				if (UserInputService.IsKeyDown(Enum.KeyCode.W)) {
					moveDir = moveDir.add(camera.CFrame.LookVector);
				}
				if (UserInputService.IsKeyDown(Enum.KeyCode.S)) {
					moveDir = moveDir.sub(camera.CFrame.LookVector);
				}
				if (UserInputService.IsKeyDown(Enum.KeyCode.A)) {
					moveDir = moveDir.sub(camera.CFrame.RightVector);
				}
				if (UserInputService.IsKeyDown(Enum.KeyCode.D)) {
					moveDir = moveDir.add(camera.CFrame.RightVector);
				}
				if (UserInputService.IsKeyDown(Enum.KeyCode.Space)) {
					moveDir = moveDir.add(Vector3.yAxis);
				}
				if (
					UserInputService.IsKeyDown(Enum.KeyCode.LeftShift) ||
					UserInputService.IsKeyDown(Enum.KeyCode.LeftControl)
				) {
					moveDir = moveDir.sub(Vector3.yAxis);
				}
			}

			// 2. Dukungan Thumbstick Mobile / Gamepad
			if (moveDir.Magnitude < 0.1 && humanoid.MoveDirection.Magnitude > 0.1) {
				const camLook = camera.CFrame.LookVector;
				const planarCamLook = new Vector3(camLook.X, 0, camLook.Z).Unit;
				const camRight = camera.CFrame.RightVector;
				const planarCamRight = new Vector3(camRight.X, 0, camRight.Z).Unit;

				const forwardDot = humanoid.MoveDirection.Dot(planarCamLook);
				const rightDot = humanoid.MoveDirection.Dot(planarCamRight);

				moveDir = camera.CFrame.LookVector.mul(forwardDot).add(camera.CFrame.RightVector.mul(rightDot));
			}

			if (moveDir.Magnitude > 0.05) {
				this.bodyVelocity.Velocity = moveDir.Unit.mul(this.flySpeed);
			} else {
				this.bodyVelocity.Velocity = Vector3.zero;
			}
		});

		this.charConnection = humanoid.Died.Connect(() => {
			this.stopFlight();
		});
	}

	public stopFlight(): void {
		if (!this.isFlying) return;
		this.isFlying = false;

		this.cleanupPhysics();

		const localPlayer = Players.LocalPlayer;
		const character = localPlayer.Character;
		if (character) {
			const humanoid = character.FindFirstChildOfClass("Humanoid");
			if (humanoid && humanoid.Health > 0) {
				humanoid.PlatformStand = false;
				humanoid.ChangeState(Enum.HumanoidStateType.GettingUp);
			}
		}
	}

	private cleanupPhysics(): void {
		this.renderConnection?.Disconnect();
		this.renderConnection = undefined;

		this.charConnection?.Disconnect();
		this.charConnection = undefined;

		if (this.bodyVelocity) {
			this.bodyVelocity.Destroy();
			this.bodyVelocity = undefined;
		}

		if (this.bodyGyro) {
			this.bodyGyro.Destroy();
			this.bodyGyro = undefined;
		}
	}
}
