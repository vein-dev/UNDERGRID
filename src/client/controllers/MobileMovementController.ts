import { Players, RunService, UserInputService, Workspace } from "@rbxts/services";
import { CrouchController } from "./CrouchController";
import { FreecamController } from "./FreecamController";
import { SkateboardController } from "./SkateboardController";
import { SpawnCinematicController } from "./SpawnCinematicController";
import { MobileMovementView } from "client/ui/views/MobileMovementView";

/**
 * MobileMovementController
 * Client controller mengelola kontrol sentuh gerak mobile (Jump, Sprint, Crouch, Crawl).
 * Meng-override tombol Jump bawaan Roblox dengan custom Jump button dalam kluster 2x2.
 */
export class MobileMovementController {
	private static instance?: MobileMovementController;

	private readonly player: Player;
	private crouchController: CrouchController;
	private mobileMovementView: MobileMovementView;

	private currentCharacter?: Model;
	private currentHumanoid?: Humanoid;
	private currentRootPart?: BasePart;

	private charConnections: RBXScriptConnection[] = [];
	private jumpSuppressConnections: RBXScriptConnection[] = [];

	private isJumpHeld = false;
	private lastJumpTime = 0;

	private constructor() {
		this.player = Players.LocalPlayer;
		this.crouchController = CrouchController.getInstance();
		this.mobileMovementView = MobileMovementView.getInstance();
	}

	public static getInstance(): MobileMovementController {
		if (!MobileMovementController.instance) {
			MobileMovementController.instance = new MobileMovementController();
		}
		return MobileMovementController.instance;
	}

	public init(): void {
		// 1. Hubungkan callbacks aktivasi tombol ke CrouchController dan Jump handler
		this.mobileMovementView.setCallbacks({
			onToggleSprint: () => {
				this.crouchController.toggleSprint();
			},
			onToggleCrouch: () => {
				this.crouchController.toggleCrouchAction();
			},
			onToggleCrawl: () => {
				this.crouchController.toggleCrawlAction();
			},
			onJumpStart: () => {
				this.handleJumpStart();
			},
			onJumpEnd: () => {
				this.isJumpHeld = false;
			},
		});

		// 2. Dengarkan perubahan status gerakan (sprint, crouch, crawl) agar tampilan tombol selalu tersinkronisasi
		this.crouchController.onMovementStateChanged((state) => {
			this.mobileMovementView.setMovementStates(
				state.isSprinting,
				state.isCrouching,
				state.isCrawling,
			);
		});

		// 3. Deteksi input touch vs non-touch secara dinamis
		UserInputService.LastInputTypeChanged.Connect(() => {
			this.updateVisibility();
		});

		// 4. Dengarkan status Freecam
		FreecamController.getInstance().onStateChanged(() => {
			this.updateVisibility();
		});

		// 5. Override tombol Jump bawaan Roblox
		this.setupJumpButtonSuppression();

		// 6. Hubungkan lifecycle karakter
		this.player.CharacterAdded.Connect((char) => this.bindCharacter(char));
		if (this.player.Character) {
			this.bindCharacter(this.player.Character);
		}

		// 6. Dengarkan selesainya Cinematic Spawn
		SpawnCinematicController.getInstance().onFinished(() => {
			this.updateVisibility();
		});

		// 7. Pemeriksaan status berkala untuk sinkronisasi skateboard, status lainnya, dan continuous jump
		RunService.Heartbeat.Connect(() => {
			this.updateVisibility();
			if (this.isJumpHeld && this.isGrounded() && os.clock() - this.lastJumpTime >= 0.3) {
				this.lastJumpTime = os.clock();
				this.currentHumanoid!.Jump = true;
				this.currentHumanoid!.ChangeState(Enum.HumanoidStateType.Jumping);
			}
		});

		print("[MobileMovementController] Initialized successfully with 2x2 movement cluster and custom Jump override.");
	}

	private isGrounded(): boolean {
		if (!this.currentHumanoid || this.currentHumanoid.Health <= 0) return false;

		// 1. Cek state dasar Humanoid
		const state = this.currentHumanoid.GetState();
		if (
			state === Enum.HumanoidStateType.Freefall ||
			state === Enum.HumanoidStateType.FallingDown ||
			state === Enum.HumanoidStateType.Ragdoll ||
			state === Enum.HumanoidStateType.Dead
		) {
			return false;
		}

		// 2. Cek FloorMaterial bawaan
		if (this.currentHumanoid.FloorMaterial !== Enum.Material.Air) {
			return true;
		}

		// 3. Fallback Raycast akurat untuk terrain/platform/mesh custom
		if (this.currentRootPart && this.currentCharacter) {
			const params = new RaycastParams();
			params.FilterDescendantsInstances = [this.currentCharacter];
			params.FilterType = Enum.RaycastFilterType.Exclude;

			const hit = Workspace.Raycast(this.currentRootPart.Position, new Vector3(0, -3.8, 0), params);
			return hit !== undefined;
		}

		return false;
	}

	private handleJumpStart(): void {
		if (!this.currentHumanoid || this.currentHumanoid.Health <= 0) return;

		// Cegah spam jump dalam rentang milidetik yang sama
		const now = os.clock();
		if (now - this.lastJumpTime < 0.25) return;

		// Wajib menjejak tanah (cegah lompat di udara / terbang)
		if (!this.isGrounded()) return;

		// Jika sedang merayap atau jongkok, otomatis berdiri terlebih dahulu
		if (this.crouchController.isCrawlActive()) {
			this.crouchController.stopCrawl();
		}
		if (this.crouchController.isCrouchActive()) {
			this.crouchController.toggleCrouchAction();
		}

		this.lastJumpTime = now;
		this.isJumpHeld = true;
		this.currentHumanoid.Jump = true;
		this.currentHumanoid.ChangeState(Enum.HumanoidStateType.Jumping);
	}

	/**
	 * Menyembunyikan tombol Jump bawaan Roblox (TouchControlFrame.JumpButton)
	 * tanpa mematikan analog stik kiri (DynamicThumbstick).
	 */
	private setupJumpButtonSuppression(): void {
		for (const conn of this.jumpSuppressConnections) {
			conn.Disconnect();
		}
		this.jumpSuppressConnections = [];

		const playerGui = (this.player.FindFirstChild("PlayerGui") as PlayerGui | undefined) ??
			(this.player.WaitForChild("PlayerGui", 10) as PlayerGui | undefined);
		if (!playerGui) return;

		const suppress = (jumpBtn: GuiObject) => {
			jumpBtn.Visible = false;
			jumpBtn.Position = new UDim2(2, 0, 2, 0);

			const conn = jumpBtn.GetPropertyChangedSignal("Visible").Connect(() => {
				if (jumpBtn.Visible) {
					jumpBtn.Visible = false;
					jumpBtn.Position = new UDim2(2, 0, 2, 0);
				}
			});
			this.jumpSuppressConnections.push(conn);
		};

		const scanTouchGui = () => {
			const touchGui = playerGui.FindFirstChild("TouchGui") as ScreenGui | undefined;
			if (!touchGui) return;

			const touchFrame = touchGui.FindFirstChild("TouchControlFrame") as Frame | undefined;
			if (touchFrame) {
				const jumpBtn = touchFrame.FindFirstChild("JumpButton") as GuiObject | undefined;
				if (jumpBtn) {
					suppress(jumpBtn);
				}
				const childConn = touchFrame.ChildAdded.Connect((child) => {
					if (child.Name === "JumpButton" && child.IsA("GuiObject")) {
						suppress(child);
					}
				});
				this.jumpSuppressConnections.push(childConn);
			} else {
				const frameConn = touchGui.ChildAdded.Connect((child) => {
					if (child.Name === "TouchControlFrame") {
						scanTouchGui();
					}
				});
				this.jumpSuppressConnections.push(frameConn);
			}
		};

		scanTouchGui();

		const guiConn = playerGui.ChildAdded.Connect((child) => {
			if (child.Name === "TouchGui") {
				task.defer(() => scanTouchGui());
			}
		});
		this.jumpSuppressConnections.push(guiConn);
	}

	private bindCharacter(char: Model): void {
		for (const conn of this.charConnections) {
			conn.Disconnect();
		}
		this.charConnections = [];

		this.currentCharacter = char;
		const humanoid = char.WaitForChild("Humanoid", 5) as Humanoid | undefined;
		const rootPart = char.WaitForChild("HumanoidRootPart", 5) as BasePart | undefined;

		this.currentHumanoid = humanoid;
		this.currentRootPart = rootPart;

		if (humanoid) {
			this.charConnections.push(
				humanoid.Died.Connect(() => {
					this.isJumpHeld = false;
					this.updateVisibility();
				}),
			);
		}

		if (rootPart) {
			this.charConnections.push(
				rootPart.GetAttributeChangedSignal("IsFighting").Connect(() => {
					this.updateVisibility();
				}),
			);
			this.charConnections.push(
				rootPart.GetAttributeChangedSignal("IsFlying").Connect(() => {
					this.updateVisibility();
				}),
			);
		}

		this.charConnections.push(
			char.GetAttributeChangedSignal("IsFighting").Connect(() => {
				this.updateVisibility();
			}),
		);

		this.updateVisibility();
		this.setupJumpButtonSuppression();
	}

	private updateVisibility(): void {
		const isTouch = UserInputService.TouchEnabled;
		if (!isTouch) {
			if (this.mobileMovementView.isVisible()) {
				this.mobileMovementView.hide();
			}
			return;
		}

		const isAlive = this.currentHumanoid !== undefined && this.currentHumanoid.Health > 0;
		if (!isAlive) {
			if (this.mobileMovementView.isVisible()) {
				this.mobileMovementView.hide();
			}
			return;
		}

		// Sembunyikan saat sedang cinematic spawn (intro cutscene)
		let isCinematicPlaying = false;
		try {
			isCinematicPlaying = !SpawnCinematicController.getInstance().isFinished();
		} catch {
			isCinematicPlaying = false;
		}

		if (isCinematicPlaying) {
			if (this.mobileMovementView.isVisible()) {
				this.mobileMovementView.hide();
			}
			return;
		}

		// Sembunyikan saat sedang mode pertarungan (karena Combat HUD memiliki tombol tersendiri)
		const isFighting =
			this.currentCharacter?.GetAttribute("IsFighting") === true ||
			this.currentRootPart?.GetAttribute("IsFighting") === true;

		if (isFighting) {
			if (this.mobileMovementView.isVisible()) {
				this.mobileMovementView.hide();
			}
			return;
		}

		// Sembunyikan saat sedang terbang
		const isFlying = this.currentRootPart?.GetAttribute("IsFlying") === true;
		if (isFlying) {
			if (this.mobileMovementView.isVisible()) {
				this.mobileMovementView.hide();
			}
			return;
		}

		// Sembunyikan saat sedang menaiki skateboard
		let isSkating = false;
		try {
			isSkating = SkateboardController.getInstance().isPlayerMounted();
		} catch {
			isSkating = false;
		}

		if (isSkating) {
			if (this.mobileMovementView.isVisible()) {
				this.mobileMovementView.hide();
			}
			return;
		}

		// Sembunyikan saat Freecam aktif
		let isFreecam = false;
		try {
			isFreecam = FreecamController.getInstance().getIsActive();
		} catch {
			isFreecam = false;
		}

		if (isFreecam) {
			if (this.mobileMovementView.isVisible()) {
				this.mobileMovementView.hide();
			}
			return;
		}

		// Tampilkan kluster kontrol gerak jika seluruh kondisi normal terpenuhi
		if (!this.mobileMovementView.isVisible()) {
			this.mobileMovementView.show();
		}
	}
}
