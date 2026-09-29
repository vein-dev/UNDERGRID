import { Players, RunService, Workspace } from "@rbxts/services";
import { AdminService } from "client/services/AdminService";
import { StageCameraControlPayload, StageCameraMode, StageCameraShake } from "shared/types";
import { HotbarController } from "./HotbarController";

export { StageCameraMode, StageCameraShake };

export interface StageCameraState {
	mode: StageCameraMode;
	shake: StageCameraShake;
	targetUserId?: number;
	targetName?: string;
	faceDistance: number;
	fov: number;
	orbitSpeed: number;
	fixedCamIndex?: number;
	broadcastEnabled: boolean;
}

/**
 * StageCameraController
 *
 * OOP Singleton Client Controller that manages cinematic stage camera modes:
 * - Face-to-Face / Front Face View: Positions camera directly in front of target player's head.
 * - Cinematic 360 Orbit: Smooth continuous orbital rotation around the performer.
 * - Drone / Crane: Wide swaying concert crane motion.
 * - Low-Angle Stage: Dramatic concert ground view looking up at the performer.
 * - Stage Rig Cam 1-7 (STAGECAM): Fixed concert camera angles aiming at CamTarget.
 * - Dynamic Shake: Handheld, beat-synced shake, or bass-drop heavy shake.
 * - Live Server Broadcast: Replicates stage camera control from Admin to all clients.
 */
export class StageCameraController {
	private static instance?: StageCameraController;

	private camera = Workspace.CurrentCamera ?? (Workspace.WaitForChild("Camera") as Camera);
	private localPlayer = Players.LocalPlayer;

	private state: StageCameraState = {
		mode: "default",
		shake: "none",
		targetUserId: undefined,
		targetName: undefined,
		faceDistance: 4.0,
		fov: 70,
		orbitSpeed: 0.5,
		fixedCamIndex: 1,
		broadcastEnabled: true,
	};

	private isOptedOut = false;
	private isControlsSuppressed = false;
	private touchGuiConn?: RBXScriptConnection;
	private renderConnection?: RBXScriptConnection;
	private stateListeners: Array<(state: StageCameraState) => void> = [];

	private orbitAngle = 0;
	private droneTime = 0;
	private shakeTime = 0;

	private originalCameraType: Enum.CameraType = Enum.CameraType.Custom;
	private originalFov = 70;

	private constructor() {
		if (this.camera) {
			this.originalCameraType = this.camera.CameraType;
			this.originalFov = this.camera.FieldOfView;
		}

		Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(() => {
			if (Workspace.CurrentCamera) {
				this.camera = Workspace.CurrentCamera;
			}
		});

		this.localPlayer.CharacterAdded.Connect(() => {
			if (this.state.mode === "default") {
				task.defer(() => this.restoreCamera());
			}
		});
	}

	public static getInstance(): StageCameraController {
		if (!StageCameraController.instance) {
			StageCameraController.instance = new StageCameraController();
		}
		return StageCameraController.instance;
	}

	public init(): void {
		print("[StageCameraController] Initialized with Live Broadcast sync.");

		// Listen for real-time camera updates from ServerAdminService
		AdminService.getInstance().onStateUpdated((adminState) => {
			if (adminState.stageCamera) {
				this.applyBroadcastState(adminState.stageCamera);
			}
		});
	}

	public getState(): StageCameraState {
		return { ...this.state };
	}

	public onStateChanged(listener: (state: StageCameraState) => void): () => void {
		this.stateListeners.push(listener);
		listener(this.getState());
		return () => {
			const idx = this.stateListeners.indexOf(listener);
			if (idx !== -1) {
				this.stateListeners.remove(idx);
			}
		};
	}

	private notifyState(): void {
		const current = this.getState();
		for (const listener of this.stateListeners) {
			listener(current);
		}
	}

	/**
	 * Called when server broadcasts stage camera updates to all clients.
	 */
	public applyBroadcastState(payload: StageCameraControlPayload): void {
		if (this.isOptedOut) return;

		if (payload.enabled && payload.mode !== "default") {
			this.state.targetUserId = payload.targetUserId;
			this.state.targetName = payload.targetName;
			this.state.mode = payload.mode;
			this.state.shake = payload.shake;
			this.state.faceDistance = payload.faceDistance;
			this.state.fov = payload.fov;
			this.state.orbitSpeed = payload.orbitSpeed;
			if (payload.fixedCamIndex !== undefined) {
				this.state.fixedCamIndex = payload.fixedCamIndex;
			}

			if (this.camera) {
				this.camera.FieldOfView = payload.fov;
			}

			this.startRenderLoop();
			this.notifyState();
		} else if (!payload.enabled || payload.mode === "default") {
			const wasBroadcasting = this.state.mode !== "default" || this.renderConnection !== undefined;

			this.state.mode = "default";
			this.state.shake = "none";

			if (wasBroadcasting) {
				this.stopRenderLoop();
				this.restoreCamera();
			}

			this.notifyState();
		}
	}

	/**
	 * Sends current camera state to ServerAdminService to broadcast to all players.
	 */
	public syncBroadcast(): void {
		if (!this.state.broadcastEnabled) return;

		const isBroadcasting = this.state.mode !== "default" || this.state.shake !== "none";
		// Jangan kirim siaran jika kamera panggung belum aktif (mode default)
		if (!isBroadcasting) return;

		AdminService.getInstance().setStageCameraControl({
			enabled: true,
			mode: this.state.mode,
			shake: this.state.shake,
			targetUserId: this.state.targetUserId,
			targetName: this.state.targetName,
			faceDistance: this.state.faceDistance,
			fov: this.state.fov,
			orbitSpeed: this.state.orbitSpeed,
			fixedCamIndex: this.state.fixedCamIndex,
		});
	}

	public setBroadcastEnabled(enabled: boolean): void {
		this.state.broadcastEnabled = enabled;
		this.notifyState();
		if (enabled) {
			this.syncBroadcast();
		} else {
			// Beritahu server untuk menghentikan siaran ke seluruh player biasa
			AdminService.getInstance().setStageCameraControl({
				enabled: false,
				mode: "default",
				shake: "none",
				targetUserId: undefined,
				targetName: undefined,
			});
		}
	}

	public setOptedOut(optedOut: boolean): void {
		this.isOptedOut = optedOut;
		if (optedOut) {
			this.stopRenderLoop();
			this.restoreCamera();
		}
	}

	public setTargetPlayer(userId: number | undefined): void {
		if (userId === undefined) {
			this.state.targetUserId = undefined;
			this.state.targetName = undefined;
		} else {
			const player = Players.GetPlayerByUserId(userId);
			this.state.targetUserId = userId;
			this.state.targetName = player ? player.DisplayName || player.Name : undefined;
		}
		this.notifyState();
		this.syncBroadcast();
	}

	public setMode(mode: StageCameraMode): void {
		if (this.state.mode === mode) return;

		const wasBroadcasting = this.state.mode !== "default" || this.state.shake !== "none";
		this.state.mode = mode;

		if (mode === "default") {
			this.state.shake = "none";
			this.stopRenderLoop();
			this.restoreCamera();
			this.notifyState();

			// Jika sebelumnya sedang menyiarkan, beritahu server untuk stop siaran ke semua penonton
			if (wasBroadcasting && this.state.broadcastEnabled) {
				AdminService.getInstance().setStageCameraControl({
					enabled: false,
					mode: "default",
					shake: "none",
					targetUserId: this.state.targetUserId,
					targetName: this.state.targetName,
					fov: this.state.fov,
					faceDistance: this.state.faceDistance,
				});
			}
		} else {
			// If no target is set, default to LocalPlayer
			if (this.state.targetUserId === undefined) {
				this.state.targetUserId = this.localPlayer.UserId;
				this.state.targetName = this.localPlayer.DisplayName || this.localPlayer.Name;
			}
			this.startRenderLoop();
			this.notifyState();
			this.syncBroadcast();
		}
	}

	public setShake(shake: StageCameraShake): void {
		this.state.shake = shake;
		if (shake !== "none" && this.state.mode === "default") {
			// If mode was default but user enabled shake, start render loop to apply shake
			this.startRenderLoop();
		} else if (shake === "none" && this.state.mode === "default") {
			this.stopRenderLoop();
			this.restoreCamera();
		}
		this.notifyState();
		this.syncBroadcast();
	}

	public setFaceDistance(distance: number): void {
		this.state.faceDistance = math.clamp(distance, 2.0, 10.0);
		this.notifyState();
		this.syncBroadcast();
	}

	public setFixedCam(index: number): void {
		const clamped = math.clamp(math.floor(index), 1, 7);
		this.state.fixedCamIndex = clamped;
		if (this.state.mode === "fixed_cam") {
			this.notifyState();
			this.syncBroadcast();
		} else {
			this.setMode("fixed_cam");
		}
	}

	public setFov(fov: number): void {
		const clamped = math.clamp(fov, 25, 100);
		this.state.fov = clamped;
		if (this.camera) {
			this.camera.FieldOfView = clamped;
		}
		this.notifyState();
		this.syncBroadcast();
	}

	public setOrbitSpeed(speed: number): void {
		this.state.orbitSpeed = math.clamp(speed, 0.1, 3.0);
		this.notifyState();
		this.syncBroadcast();
	}

	public resetCamera(): void {
		this.state.mode = "default";
		this.state.shake = "none";
		this.state.targetUserId = undefined;
		this.state.targetName = undefined;
		this.state.fov = 70;
		this.state.faceDistance = 4.0;
		this.state.orbitSpeed = 0.5;
		this.state.fixedCamIndex = 1;

		this.stopRenderLoop();
		this.restoreCamera();
		this.notifyState();

		// Selalu sinkronkan penghentian ke server agar seluruh player biasa kembali normal
		AdminService.getInstance().setStageCameraControl({
			enabled: false,
			mode: "default",
			shake: "none",
			targetUserId: undefined,
			targetName: undefined,
			faceDistance: 4.0,
			fov: 70,
			orbitSpeed: 0.5,
		});
	}

	private setControlsSuppressed(suppressed: boolean): void {
		this.isControlsSuppressed = suppressed;

		// 1. Hotbar (StandardHotbarGui)
		try {
			HotbarController.getInstance().setVisible(!suppressed);
		} catch (e) {
			// Safe fallback
		}

		// 2. Mobile Touch Controls (Analog Thumbstick & Jump Button)
		const playerGui =
			this.localPlayer?.FindFirstChildOfClass("PlayerGui") ??
			(this.localPlayer?.FindFirstChild("PlayerGui") as PlayerGui | undefined);

		const touchGui = playerGui?.FindFirstChild("TouchGui") as ScreenGui | undefined;
		if (touchGui) {
			touchGui.Enabled = !suppressed;
		}

		if (suppressed) {
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

		// 3. PlayerModule ControlModule (Disable / Enable)
		try {
			const playerScripts = this.localPlayer?.FindFirstChild("PlayerScripts");
			const playerModule = playerScripts?.FindFirstChild("PlayerModule");
			if (playerModule) {
				const controls = require(playerModule as ModuleScript) as {
					GetControls: () => { Disable: () => void; Enable: (enable?: boolean) => void };
				};
				if (suppressed) {
					controls.GetControls().Disable();
				} else {
					controls.GetControls().Enable(true);
				}
			}
		} catch (e) {
			// Safe fallback
		}
	}

	private restoreCamera(): void {
		this.setControlsSuppressed(false);
		if (!this.camera) {
			this.camera = Workspace.CurrentCamera ?? (Workspace.WaitForChild("Camera") as Camera);
		}
		if (!this.camera) return;

		this.camera.FieldOfView = 70;

		const char = this.localPlayer.Character;
		const hum = char?.FindFirstChildOfClass("Humanoid");
		const rootPart = (char?.FindFirstChild("HumanoidRootPart") ?? char?.PrimaryPart) as BasePart | undefined;

		// 1. Set CameraSubject DAHULU ke Humanoid pemain lokal sebelum beralih ke CameraType Custom
		if (hum) {
			this.camera.CameraSubject = hum;
		}

		// 2. Reposisi CFrame dan Focus tepat di belakang karakter pemain lokal
		// agar tidak tertinggal di panggung admin atau terjebak oklusi PopperCam
		if (rootPart) {
			const rootCF = rootPart.CFrame;
			const lookDir = rootCF.LookVector;
			const focusPos = rootPart.Position.add(new Vector3(0, 1.5, 0));
			const defaultCamPos = focusPos.sub(lookDir.mul(12)).add(new Vector3(0, 2.5, 0));

			this.camera.Focus = new CFrame(focusPos);
			this.camera.CFrame = new CFrame(defaultCamPos, focusPos);
		} else if (char) {
			const pivot = char.GetPivot();
			this.camera.Focus = pivot;
			this.camera.CFrame = pivot.add(new Vector3(0, 3, 12));
		}

		// 3. Kembalikan CameraType ke Custom bawaan Roblox
		this.camera.CameraType = Enum.CameraType.Custom;

		// 4. Pastikan di frame berikutnya (defer) CameraSubject & CameraType tetap stabil di player lokal
		task.defer(() => {
			if (this.state.mode === "default" && this.camera) {
				const activeChar = this.localPlayer.Character;
				const activeHum = activeChar?.FindFirstChildOfClass("Humanoid");
				if (activeHum && this.camera.CameraSubject !== activeHum) {
					this.camera.CameraSubject = activeHum;
				}
				if (this.camera.CameraType !== Enum.CameraType.Custom) {
					this.camera.CameraType = Enum.CameraType.Custom;
				}
			}
		});
	}

	private getTargetCharacter(): { character?: Model; head?: BasePart; rootPart?: BasePart } {
		const targetPlayer = this.state.targetUserId !== undefined
			? Players.GetPlayerByUserId(this.state.targetUserId)
			: this.localPlayer;

		const char = targetPlayer?.Character;
		if (!char) return {};

		const head = char.FindFirstChild("Head") as BasePart | undefined;
		const rootPart = (char.FindFirstChild("HumanoidRootPart") ?? char.PrimaryPart) as BasePart | undefined;

		return { character: char, head, rootPart };
	}

	private startRenderLoop(): void {
		if (this.state.mode !== "default") {
			this.setControlsSuppressed(true);
		}
		if (this.renderConnection) return;

		this.renderConnection = RunService.RenderStepped.Connect((dt) => {
			this.updateCamera(dt);
		});
	}

	private stopRenderLoop(): void {
		this.setControlsSuppressed(false);
		if (this.renderConnection) {
			this.renderConnection.Disconnect();
			this.renderConnection = undefined;
		}
	}

	private updateCamera(dt: number): void {
		if (!this.camera) return;

		// Calculate shake / global FX offset
		this.shakeTime += dt;
		let shakePosOffset = Vector3.zero;
		let shakeRotOffset = new CFrame();
		let fovOffset = 0;

		if (this.state.shake !== "none") {
			if (this.state.shake === "heartbeat") {
				// Heartbeat: 75 BPM (period 0.8s), double-pulse systole ('lub') & diastole ('dub')
				const period = 0.8;
				const t = (this.shakeTime % period) / period;
				let pulse = 0;
				if (t < 0.18) {
					pulse = math.sin((t / 0.18) * math.pi);
				} else if (t >= 0.22 && t < 0.38) {
					pulse = math.sin(((t - 0.22) / 0.16) * math.pi) * 0.65;
				}

				const recoilY = -pulse * 0.15;
				const recoilZ = -pulse * 0.25;
				shakePosOffset = new Vector3(0, recoilY, recoilZ);
				shakeRotOffset = CFrame.Angles(
					math.rad(pulse * 1.8),
					0,
					math.rad(math.sin(this.shakeTime * 4) * 0.5 * pulse)
				);
				fovOffset = -pulse * 4.0;
			} else if (this.state.shake === "drunk") {
				// Drunk / High / Tripping: slow undulating Dutch tilt, woozy sway, floating figure-8 drift
				const roll = math.sin(this.shakeTime * 1.1) * math.rad(6.5) + math.sin(this.shakeTime * 0.5) * math.rad(3.0);
				const pitch = math.cos(this.shakeTime * 0.85) * math.rad(4.0);
				const yaw = math.sin(this.shakeTime * 0.7) * math.rad(5.0);

				const driftX = math.sin(this.shakeTime * 0.8) * 0.45;
				const driftY = math.cos(this.shakeTime * 1.3) * 0.3 + math.sin(this.shakeTime * 0.5) * 0.2;
				const driftZ = math.sin(this.shakeTime * 1.0) * 0.35;

				shakePosOffset = new Vector3(driftX, driftY, driftZ);
				shakeRotOffset = CFrame.Angles(pitch, yaw, roll);
				fovOffset = math.sin(this.shakeTime * 0.9) * 3.5;
			} else if (this.state.shake === "subtle") {
				// Handheld: organic breathing and slight micro-jitters
				const speed = 6;
				const mult = 0.05;
				const sx = (math.noise(this.shakeTime * speed, 0, 0) - 0.5) * mult;
				const sy = (math.noise(0, this.shakeTime * speed, 0) - 0.5) * mult;
				const sz = (math.noise(0, 0, this.shakeTime * speed) - 0.5) * mult;

				const swayRoll = math.sin(this.shakeTime * 1.5) * math.rad(0.8);
				const swayPitch = math.cos(this.shakeTime * 1.2) * math.rad(0.6);

				shakePosOffset = new Vector3(sx, sy, sz);
				shakeRotOffset = CFrame.Angles(
					math.rad(sy * 6) + swayPitch,
					math.rad(sx * 6),
					math.rad((sx - sy) * 4) + swayRoll
				);
			} else {
				// Beat bump & bass drop
				let mult = 0.18;
				let speed = 28;
				if (this.state.shake === "heavy") {
					mult = 0.45;
					speed = 36;
				}

				const sx = (math.noise(this.shakeTime * speed, 0, 0) - 0.5) * mult;
				const sy = (math.noise(0, this.shakeTime * speed, 0) - 0.5) * mult;
				const sz = (math.noise(0, 0, this.shakeTime * speed) - 0.5) * mult;

				shakePosOffset = new Vector3(sx, sy, sz);
				shakeRotOffset = CFrame.Angles(
					math.rad(sy * 8),
					math.rad(sx * 8),
					math.rad((sx - sy) * 6)
				);

				if (this.state.shake === "beat") {
					fovOffset = math.abs(math.sin(this.shakeTime * 12)) * -2.0;
				} else if (this.state.shake === "heavy") {
					fovOffset = math.abs(math.sin(this.shakeTime * 16)) * -4.5;
				}
			}
		}

		// If mode is default, we only apply shake on top of current Custom camera
		if (this.state.mode === "default") {
			if (this.state.shake !== "none") {
				this.camera.CFrame = this.camera.CFrame.mul(shakeRotOffset).add(shakePosOffset);
				this.camera.FieldOfView = math.clamp(this.state.fov + fovOffset, 25, 110);
			}
			return;
		}

		// Non-default mode: set CameraType to Scriptable
		if (this.camera.CameraType !== Enum.CameraType.Scriptable) {
			this.camera.CameraType = Enum.CameraType.Scriptable;
		}

		// Fixed Stage Rig Cam (STAGECAM 1 - 7): Independent of player character
		if (this.state.mode === "fixed_cam") {
			const camStage = Workspace.FindFirstChild("CamStage") as Folder | undefined;
			const targetPart = camStage?.FindFirstChild("CamTarget") as BasePart | undefined;
			const camIndex = this.state.fixedCamIndex ?? 1;
			const camPart = camStage?.FindFirstChild(`Cam${camIndex}`) as BasePart | undefined;

			let computedCFrame = this.camera.CFrame;
			if (camPart && targetPart) {
				computedCFrame = new CFrame(camPart.Position, targetPart.Position);
			} else if (camPart) {
				computedCFrame = camPart.CFrame;
			}

			if (this.state.shake !== "none") {
				computedCFrame = computedCFrame.mul(shakeRotOffset).add(shakePosOffset);
			}

			this.camera.CFrame = computedCFrame;
			this.camera.FieldOfView = math.clamp(this.state.fov + fovOffset, 25, 110);
			if (targetPart) {
				this.camera.Focus = targetPart.CFrame;
			}
			return;
		}

		const { character, head, rootPart } = this.getTargetCharacter();
		if (!head && !rootPart) {
			// Target missing or dead: revert to normal temporarily
			return;
		}

		const anchorPart = head ?? rootPart!;
		const anchorPos = anchorPart.Position;

		let computedCFrame = this.camera.CFrame;

		switch (this.state.mode) {
			case "face": {
				// Front face view: Camera placed directly in front of the target player's head, looking at their face
				const headCF = anchorPart.CFrame;
				const lookVec = headCF.LookVector;
				const dist = this.state.faceDistance;
				const eyePos = headCF.Position;

				// Camera is in front of the face along LookVector, slightly level with eyes
				const frontPos = eyePos.add(lookVec.mul(dist)).add(new Vector3(0, 0.1, 0));
				computedCFrame = new CFrame(frontPos, eyePos);
				break;
			}

			case "orbit": {
				// Smooth 360 orbit around target
				this.orbitAngle += dt * this.state.orbitSpeed;
				const radius = math.max(this.state.faceDistance + 2.5, 6.0);
				const height = 1.8;

				const x = math.cos(this.orbitAngle) * radius;
				const z = math.sin(this.orbitAngle) * radius;

				const camPos = anchorPos.add(new Vector3(x, height, z));
				const lookTarget = anchorPos.add(new Vector3(0, 0.4, 0));
				computedCFrame = new CFrame(camPos, lookTarget);
				break;
			}

			case "drone": {
				// Sweeping concert crane / drone shot swaying left-right and drifting vertically
				this.droneTime += dt * 0.4;
				const baseDist = 12.0;
				const swayX = math.sin(this.droneTime) * 6.0;
				const swayY = math.cos(this.droneTime * 0.7) * 2.5 + 4.5;
				const swayZ = math.cos(this.droneTime) * 8.0;

				const camPos = anchorPos.add(new Vector3(swayX, swayY, swayZ + baseDist));
				computedCFrame = new CFrame(camPos, anchorPos.add(new Vector3(0, 1.0, 0)));
				break;
			}

			case "low_angle": {
				// Low-angle concert view: dramatic ground shot looking up at the performer
				const rootCF = (rootPart ?? head!).CFrame;
				const lookVec = rootCF.LookVector;
				const lowPos = rootCF.Position.add(lookVec.mul(5.0)).sub(new Vector3(0, 2.2, 0));
				const lookTarget = anchorPos.add(new Vector3(0, 0.8, 0));

				// Slight Dutch tilt (roll)
				const tilt = CFrame.Angles(0, 0, math.rad(-4));
				computedCFrame = new CFrame(lowPos, lookTarget).mul(tilt);
				break;
			}
		}

		// Apply shake offset
		if (this.state.shake !== "none") {
			computedCFrame = computedCFrame.mul(shakeRotOffset).add(shakePosOffset);
		}

		// Smooth lerp or direct assign
		this.camera.CFrame = computedCFrame;
		this.camera.FieldOfView = math.clamp(this.state.fov + fovOffset, 25, 110);
		this.camera.Focus = new CFrame(anchorPos);

		if (character) {
			const hum = character.FindFirstChildOfClass("Humanoid");
			if (hum && this.camera.CameraSubject !== hum) {
				this.camera.CameraSubject = hum;
			}
		}
	}
}
