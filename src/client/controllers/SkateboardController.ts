/**
 * SkateboardController.ts
 * Pengendali utama skateboard di client:
 * Menangani input tombol pemain (WASD, Space, Q/R/T/F, G),
 * perhitungan pergerakan fisika (push, turn, ollie, friction),
 * serta sinkronisasi animasi R6.
 */

import {
	CollectionService,
	Debris,
	Players,
	ReplicatedStorage,
	RunService,
	UserInputService,
	Workspace,
} from "@rbxts/services";
import { SkateboardConfig } from "shared/config";
import { getRemoteEvent } from "shared/network";
import {
	SkateboardGrindData,
	SkateboardGrindType,
	SkateboardMountPayload,
	SkateboardStance,
	SkateboardState,
	SkateboardTrickName,
	SkateboardTrickPayload,
} from "shared/types";
import { SkateboardAnimationService } from "../services/SkateboardAnimationService";
import { SkateboardAudioService } from "../services/SkateboardAudioService";
import { MovementController } from "./MovementController";
import { CombatController } from "./CombatController";
import { CrouchController } from "./CrouchController";
import { FootstepController } from "./FootstepController";
import { StaminaController } from "./StaminaController";
import { SkateboardMobileView } from "../ui/views/SkateboardMobileView";

export class SkateboardController {
	private static instance: SkateboardController;

	private mountEvent: RemoteEvent;
	private trickEvent: RemoteEvent;
	private animService: SkateboardAnimationService;
	private audioService: SkateboardAudioService;
	private mobileView: SkateboardMobileView;

	private isMounted = false;
	private currentState: SkateboardState = "OffBoard";
	private currentStance: SkateboardStance = "Regular";
	private onMountStateChangedCallbacks: ((mounted: boolean) => void)[] = [];

	// Rail Grinding state
	private activeGrind?: SkateboardGrindData;
	private lastGrindExitTime = 0;
	private lastGrindedRail?: BasePart;

	// Locomotion flags
	private isPushing = false;
	private isTouchPushing = false;
	private isBraking = false;
	private isHoldingBrake = false;
	private steerDirection = 0; // -1 (kiri), 0 (lurus), 1 (kanan)
	private spacePressedTime = 0;
	private isChargingOllie = false;
	private queuedTrick?: SkateboardTrickName;
	private isPerformingTrick = false;

	// Physics variables
	private currentSpeed = 0;
	private smoothedSteer = 0;
	private currentRoll = 0;
	private lastJumpTime = 0;
	private currentExpectedAirTime = 0.35;
	private wasGrounded = true;
	private timeInAir = 0;
	private raycastParams = new RaycastParams();
	private pushPhase: "Pushing" | "Cruising" | "FakiePushing" | "FakieCruising" | "None" = "None";

	// Animasi Trik Papan Prosedural
	private activeBoardTrick?: {
		name: SkateboardTrickName | "Ollie";
		startTime: number;
		duration: number;
	};
	private trickCFrameOffset = new CFrame();
	private predictedBoard?: Model;
	private boardMotor?: Motor6D;

	// Sinkronisasi rotasi trik papan untuk pemain lain di multiplayer
	private otherPlayerBoardTricks = new Map<
		Player,
		{
			trickName: SkateboardTrickName;
			startTime: number;
			duration: number;
		}
	>();

	private soundEvent: RemoteEvent;

	private constructor() {
		this.mountEvent = getRemoteEvent("SkateboardMountEvent");
		this.trickEvent = getRemoteEvent("SkateboardTrickEvent");
		this.soundEvent = getRemoteEvent("SoundEvent");
		this.animService = SkateboardAnimationService.getInstance();
		this.audioService = SkateboardAudioService.getInstance();
		this.mobileView = SkateboardMobileView.getInstance();
	}

	public static getInstance(): SkateboardController {
		if (!SkateboardController.instance) {
			SkateboardController.instance = new SkateboardController();
		}
		return SkateboardController.instance;
	}

	public init(): void {
		this.setupCharacterLifecycle();
		this.setupRaycast();
		this.setupNetworkListener();
		this.setupInputListener();
		this.setupMobileControls();
		this.setupPhysicsLoop();
		this.setupOtherPlayersBoardLoop();

		print("[SkateboardController] Initialized successfully.");
	}

	/**
	 * Bersihkan state dan predicted board saat karakter respawn agar tidak ada artefak visual yang tersisa
	 */
	private setupCharacterLifecycle(): void {
		Players.LocalPlayer.CharacterAdded.Connect(() => {
			this.cleanupPredictedBoard();
			this.boardMotor = undefined;
			this.activeBoardTrick = undefined;
			if (this.isMounted) {
				this.mobileView.hide();
				this.isMounted = false;
				this.currentState = "OffBoard";
				this.currentStance = "Regular";
				this.currentSpeed = 0;
				this.isPushing = false;
				this.isTouchPushing = false;
				this.isBraking = false;
				this.isHoldingBrake = false;
				this.pushPhase = "None";
				this.steerDirection = 0;
				this.smoothedSteer = 0;
				this.currentRoll = 0;
				this.isChargingOllie = false;
				this.queuedTrick = undefined;
				this.isPerformingTrick = false;
				this.animService.cleanup();
				this.audioService.cleanup();
				for (const cb of this.onMountStateChangedCallbacks) {
					cb(false);
				}
			}
		});
	}

	private setupRaycast(): void {
		this.raycastParams.FilterType = Enum.RaycastFilterType.Exclude;
		this.raycastParams.IgnoreWater = true;
	}

	private setupNetworkListener(): void {
		this.mountEvent.OnClientEvent.Connect((payload) => {
			const data = payload as SkateboardMountPayload | undefined;
			if (!data) return;

			if (data.mount) {
				this.onMountSuccess();
			} else {
				this.onDismountSuccess();
			}
		});

		// Catatan: Audio spasial 3D 'PlaySound' dari server otomatis dikelola oleh CombatController ke seluruh client.

		// Dengarkan trik dari pemain lain (Audio & visual sync 100% identik tanpa delay)
		this.trickEvent.OnClientEvent.Connect((sender: unknown, payload: unknown) => {
			const otherPlayer = sender as Player | undefined;
			const data = payload as SkateboardTrickPayload | undefined;
			if (!data || !otherPlayer || otherPlayer === Players.LocalPlayer) return;

			const char = otherPlayer.Character;
			if (char) {
				// 1. Putar animasi trik karakter pada pemain lain dengan prioritas Action2 agar mengoverride pose lain
				const animator = this.getAnimator(char);
				if (animator) {
					this.animService.playAnimationFor(
						animator,
						data.trickName,
						Enum.AnimationPriority.Action2,
						false,
						0.05,
					);
				}

				// 2. Daftarkan rotasi fisik papan pemain lain agar berputar identik (termasuk Ollie)
				const trickDuration = data.duration ?? (data.trickName === "Treflip" ? 0.42 : 0.36);
				this.otherPlayerBoardTricks.set(otherPlayer, {
					trickName: data.trickName,
					startTime: os.clock(),
					duration: math.max(trickDuration, 0.28),
				});
			}
		});

		// Bersihkan data rotasi jika pemain lain disconnect
		Players.PlayerRemoving.Connect((player) => {
			this.otherPlayerBoardTricks.delete(player);
		});
	}

	private setupMobileControls(): void {
		// Sinkronisasi otomatis visibilitas saat tipe input berubah (PC mouse vs mobile touch)
		UserInputService.LastInputTypeChanged.Connect(() => {
			if (this.isMounted) {
				this.mobileView.setVisible(UserInputService.TouchEnabled);
			}
		});

		this.mobileView.setCallbacks({
			onPushDown: () => {
				if (!this.isMounted) return;
				this.isTouchPushing = true;
				this.isPushing = true;
				this.mobileView.setPushing(true);
				if (this.currentSpeed < -0.1) {
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakiePush, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieIdle, 0.1);
					this.animService.playAnimation(
						SkateboardConfig.ANIMATIONS.fakieStop,
						Enum.AnimationPriority.Action,
						true,
						0.1,
					);
				} else {
					this.startPushing();
				}
			},
			onPushUp: () => {
				if (!this.isMounted) return;
				this.isTouchPushing = false;
				this.isPushing = false;
				this.mobileView.setPushing(false);
				this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieStop, 0.2);
				this.stopPushing();
			},
			onBrakeDown: () => {
				if (!this.isMounted) return;
				this.isHoldingBrake = true;
				this.mobileView.setBraking(true);
				if (this.currentSpeed > 0.5) {
					this.isBraking = true;
					this.animService.playAnimation(
						SkateboardConfig.ANIMATIONS.stop,
						Enum.AnimationPriority.Action,
						true,
					);
				} else {
					this.isBraking = false;
					this.currentStance = "Fakie";
					this.startFakiePushing();
				}
			},
			onBrakeUp: () => {
				if (!this.isMounted) return;
				this.isHoldingBrake = false;
				this.mobileView.setBraking(false);
				if (this.isBraking) {
					this.isBraking = false;
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.stop, 0.2);
				}
				if (this.pushPhase === "FakiePushing") {
					this.stopFakiePushing();
				}
			},
			onOllieDown: () => {
				if (!this.isMounted) return;
				if (this.currentState === "Grinding") {
					this.exitGrind("Ollie");
					return;
				}
				if (!this.isChargingOllie && this.isGrounded()) {
					this.isChargingOllie = true;
					this.mobileView.setChargingOllie(true);
					this.spacePressedTime = os.clock();
					this.currentState = "Crouching";
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.startPush, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakiePush, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.idle, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieIdle, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.stop, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieStop, 0.1);
					this.stopTurnAnims(0.1);
					if (this.currentStance === "Fakie") {
						this.animService.playAnimation(
							SkateboardConfig.ANIMATIONS.fakieCrouch,
							Enum.AnimationPriority.Action,
							true,
							0.1,
						);
					} else {
						this.animService.playAnimation(
							SkateboardConfig.ANIMATIONS.crouch,
							Enum.AnimationPriority.Action,
							true,
							0.1,
						);
					}
				}
			},
			onOllieUp: () => {
				if (!this.isMounted) return;
				this.mobileView.setChargingOllie(false);
				if (this.isChargingOllie) {
					this.executeOllie();
				}
			},
			onSteerLeftDown: () => {
				if (!this.isMounted) return;
				this.steerDirection = -1;
				this.mobileView.setSteerDirection(-1);
				this.playTurnAnim("Left");
			},
			onSteerLeftUp: () => {
				if (!this.isMounted) return;
				if (this.steerDirection === -1) {
					this.steerDirection = 0;
					this.mobileView.setSteerDirection(0);
					this.stopTurnAnims(0.2);
					if (!this.isPushing && this.pushPhase !== "FakiePushing" && this.currentState !== "InAir") {
						const idleAnim =
							this.currentStance === "Fakie"
								? SkateboardConfig.ANIMATIONS.fakieIdle
								: SkateboardConfig.ANIMATIONS.idle;
						this.animService.playAnimation(idleAnim, Enum.AnimationPriority.Action, true, 0.2);
					}
				}
			},
			onSteerRightDown: () => {
				if (!this.isMounted) return;
				this.steerDirection = 1;
				this.mobileView.setSteerDirection(1);
				this.playTurnAnim("Right");
			},
			onSteerRightUp: () => {
				if (!this.isMounted) return;
				if (this.steerDirection === 1) {
					this.steerDirection = 0;
					this.mobileView.setSteerDirection(0);
					this.stopTurnAnims(0.2);
					if (!this.isPushing && this.pushPhase !== "FakiePushing" && this.currentState !== "InAir") {
						const idleAnim =
							this.currentStance === "Fakie"
								? SkateboardConfig.ANIMATIONS.fakieIdle
								: SkateboardConfig.ANIMATIONS.idle;
						this.animService.playAnimation(idleAnim, Enum.AnimationPriority.Action, true, 0.2);
					}
				}
			},
			onTrick: (trickName) => {
				if (!this.isMounted) return;
				if (this.currentState === "Grinding") {
					this.exitGrind("Ollie");
					this.triggerTrick(trickName);
				} else if (this.currentState === "InAir" || !this.isGrounded()) {
					this.triggerTrick(trickName);
				} else if (this.isChargingOllie) {
					this.queuedTrick = trickName;
				}
			},
			onDismount: () => {
				if (this.isMounted) {
					this.mobileView.hide();
					this.dismount();
				}
			},
		});
	}

	private setupInputListener(): void {
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed) return;
			if (!this.isMounted) return;

			// Tombol Gerak
			if (input.KeyCode === SkateboardConfig.KEYBINDS.push) {
				this.isPushing = true;
				if (this.currentSpeed < -0.1) {
					// Sedang meluncur mundur: hentikan animasi fakie & mainkan fakieStop selama pengereman
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakiePush, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieIdle, 0.1);
					this.animService.playAnimation(
						SkateboardConfig.ANIMATIONS.fakieStop,
						Enum.AnimationPriority.Action,
						true,
						0.1,
					);
				} else {
					this.startPushing();
				}
			} else if (input.KeyCode === SkateboardConfig.KEYBINDS.brake) {
				this.isHoldingBrake = true;
				if (this.currentSpeed > 0.5) {
					// Sedang melaju maju -> lakukan pengereman
					this.isBraking = true;
					this.animService.playAnimation(
						SkateboardConfig.ANIMATIONS.stop,
						Enum.AnimationPriority.Action,
						true,
					);
				} else {
					// Sedang diam -> mulai Fakie Push
					this.isBraking = false;
					this.currentStance = "Fakie";
					this.startFakiePushing();
				}
			} else if (input.KeyCode === SkateboardConfig.KEYBINDS.turnLeft) {
				this.steerDirection = -1;
				this.playTurnAnim("Left");
			} else if (input.KeyCode === SkateboardConfig.KEYBINDS.turnRight) {
				this.steerDirection = 1;
				this.playTurnAnim("Right");
			} else if (input.KeyCode === SkateboardConfig.KEYBINDS.ollie) {
				// Jika sedang grinding, tekan Space seketika memicu Ollie Pop-off dari atas rail
				if (this.currentState === "Grinding") {
					this.exitGrind("Ollie");
					return;
				}

				// Mulai charge Ollie (Crouch Regular atau Fakie)
				if (!this.isChargingOllie && this.isGrounded()) {
					this.isChargingOllie = true;
					this.spacePressedTime = os.clock();
					this.currentState = "Crouching";
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.startPush, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakiePush, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.idle, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieIdle, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.stop, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieStop, 0.1);
					this.stopTurnAnims(0.1);
					if (this.currentStance === "Fakie") {
						this.animService.playAnimation(
							SkateboardConfig.ANIMATIONS.fakieCrouch,
							Enum.AnimationPriority.Action,
							true,
							0.1,
						);
					} else {
						this.animService.playAnimation(
							SkateboardConfig.ANIMATIONS.crouch,
							Enum.AnimationPriority.Action,
							true,
							0.1,
						);
					}
				}
			} else {
				// Cek apakah tombol trik ditekan (Kickflip, Heelflip, Treflip, Shuv)
				const tricks = SkateboardConfig.KEYBINDS.tricks as Record<number, SkateboardTrickName | undefined>;
				const trickName = tricks[input.KeyCode.Value];
				if (trickName) {
					if (this.currentState === "Grinding") {
						this.exitGrind("Ollie");
						this.triggerTrick(trickName);
					} else if (this.currentState === "InAir" || !this.isGrounded()) {
						this.triggerTrick(trickName);
					} else if (this.isChargingOllie) {
						// Pre-input / Trick Queuing saat sedang menahan tombol lompat (Space) di darat
						this.queuedTrick = trickName;
					}
				}
			}
		});

		UserInputService.InputEnded.Connect((input) => {
			if (!this.isMounted) return;

			if (input.KeyCode === SkateboardConfig.KEYBINDS.push) {
				this.isPushing = false;
				this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieStop, 0.2);
				this.stopPushing();
			} else if (input.KeyCode === SkateboardConfig.KEYBINDS.brake) {
				this.isHoldingBrake = false;
				if (this.isBraking) {
					this.isBraking = false;
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.stop, 0.2);
				}
				if (this.pushPhase === "FakiePushing") {
					this.stopFakiePushing();
				}
			} else if (input.KeyCode === SkateboardConfig.KEYBINDS.turnLeft) {
				if (UserInputService.IsKeyDown(SkateboardConfig.KEYBINDS.turnRight)) {
					this.steerDirection = 1;
					this.playTurnAnim("Right");
				} else {
					this.steerDirection = 0;
					this.stopTurnAnims(0.2);
					if (!this.isPushing && this.pushPhase !== "FakiePushing" && this.currentState !== "InAir") {
						const idleAnim =
							this.currentStance === "Fakie"
								? SkateboardConfig.ANIMATIONS.fakieIdle
								: SkateboardConfig.ANIMATIONS.idle;
						this.animService.playAnimation(idleAnim, Enum.AnimationPriority.Action, true, 0.2);
					}
				}
			} else if (input.KeyCode === SkateboardConfig.KEYBINDS.turnRight) {
				if (UserInputService.IsKeyDown(SkateboardConfig.KEYBINDS.turnLeft)) {
					this.steerDirection = -1;
					this.playTurnAnim("Left");
				} else {
					this.steerDirection = 0;
					this.stopTurnAnims(0.2);
					if (!this.isPushing && this.pushPhase !== "FakiePushing" && this.currentState !== "InAir") {
						const idleAnim =
							this.currentStance === "Fakie"
								? SkateboardConfig.ANIMATIONS.fakieIdle
								: SkateboardConfig.ANIMATIONS.idle;
						this.animService.playAnimation(idleAnim, Enum.AnimationPriority.Action, true, 0.2);
					}
				}
			} else if (input.KeyCode === SkateboardConfig.KEYBINDS.ollie) {
				// Lepas Space -> Eksekusi Ollie
				if (this.isChargingOllie) {
					this.executeOllie();
				}
			}
		});
	}

	public isPlayerMounted(): boolean {
		return this.isMounted;
	}

	public mount(): void {
		if (this.isMounted) return;
		print("[Mount Started] Mount requested by client.");

		try {
			this.isMounted = true;
			this.currentState = "Idle";
			this.currentSpeed = 0;
			this.steerDirection = 0;
			this.pushPhase = "None";
			this.activeGrind = undefined;

			if (UserInputService.TouchEnabled) {
				this.mobileView.show();
			}

			const char = Players.LocalPlayer.Character;
			if (char) {
				const hrp = (char.FindFirstChild("HumanoidRootPart") ?? char.FindFirstChild("Torso")) as
					BasePart | undefined;
				if (!hrp) {
					warn("[Mount] HumanoidRootPart/Torso not found on character!");
					return;
				}

				hrp.SetAttribute("IsSkating", true);

				// HANCURKAN RightGrip di Right Arm & RightHand seketika tanpa menunggu frame berikutnya
				this.destroyRightGrips(char);

				// Client-Side Prediction: pasang papan visual instan di frame ke-0 sebelum server membalas
				this.createClientPredictedBoard(char, hrp);
				print("[Predicted Board Created] Client predicted board ready.");

				// Matikan locomotion controller agar animasi idle bawaan berhenti seketika
				MovementController.getInstance().setPaused(true);
				CombatController.getInstance().setPaused(true);
				CrouchController.getInstance().setPaused(true);

				const hum = char.FindFirstChildOfClass("Humanoid");
				if (hum) {
					hum.SetStateEnabled(Enum.HumanoidStateType.Jumping, false);
					hum.UseJumpPower = true;
					hum.JumpPower = 0;
					hum.JumpHeight = 0;
					hum.HipHeight = SkateboardConfig.ATTACHMENT.hipHeightMounted;
					hum.AutoRotate = false;
				}
				const animator = this.getAnimator(char);
				if (animator) {
					// Hentikan seketika seluruh track animasi yang sedang berjalan
					for (const track of animator.GetPlayingAnimationTracks()) {
						track.Stop(0);
					}

					this.animService.setAnimator(animator);
					// Langsung putar pose idle skateboard pada detik ke-0 (0ms delay)
					this.animService.playAnimation(
						SkateboardConfig.ANIMATIONS.idle,
						Enum.AnimationPriority.Action,
						true,
						0,
					);
				}
			}

			// Sembunyikan papan di tangan seketika
			for (const cb of this.onMountStateChangedCallbacks) {
				cb(true);
			}

			this.mountEvent.FireServer({ mount: true });
			print("[Mounted Success] Mount request sent and client-side setup completed.");
		} catch (err) {
			warn(`[Mount] Error during mount: ${tostring(err)}`);
		}
	}

	private destroyRightGrips(char: Model): void {
		// RequiresHandle = false sudah aktif pada tool Skateboard sehingga RightGrip tidak dibuat oleh engine.
		// Menghancurkan RightGrip secara paksa dapat memicu engine Roblox untuk meng-unequip tool.
	}

	public dismount(): void {
		print("[SkateboardController] Dismount requested: false");
		this.mountEvent.FireServer({ mount: false });

		const char = Players.LocalPlayer.Character;
		const hum = char?.FindFirstChildOfClass("Humanoid");
		if (hum) {
			hum.UnequipTools();
		}
	}

	public toggleMount(): void {
		if (this.isMounted) {
			this.dismount();
		} else {
			this.mount();
		}
	}

	public onMountStateChanged(cb: (mounted: boolean) => void): () => void {
		this.onMountStateChangedCallbacks.push(cb);
		return () => {
			const idx = this.onMountStateChangedCallbacks.indexOf(cb);
			if (idx !== -1) {
				this.onMountStateChangedCallbacks.remove(idx);
			}
		};
	}

	private onMountSuccess(): void {
		print("[SkateboardController] Mount berhasil dikonfirmasi dari Server!");

		// 1. Hancurkan papan prediksi client seketika (0ms) agar papan tidak pernah dobel
		this.cleanupPredictedBoard();
		this.boardMotor = undefined;

		const char = Players.LocalPlayer.Character;
		if (char) {
			// Pastikan jika ada duplikat PlayerSkateboard (artefak prediksi/server), sisakan tepat 1
			const skateboards = char.GetChildren().filter((c) => c.Name === "PlayerSkateboard");
			if (skateboards.size() > 1) {
				for (let i = 1; i < skateboards.size(); i++) {
					skateboards[i].Destroy();
				}
			}

			// Bersihkan joint duplikat di HumanoidRootPart jika ada
			const hrp = (char.FindFirstChild("HumanoidRootPart") ?? char.FindFirstChild("Torso")) as
				BasePart | undefined;
			if (hrp) {
				const joints = hrp
					.GetChildren()
					.filter((c) => c.IsA("Motor6D") && c.Name === SkateboardConfig.ATTACHMENT.jointName) as Motor6D[];
				if (joints.size() > 1) {
					for (let i = 1; i < joints.size(); i++) {
						joints[i].Destroy();
					}
				}
			}

			this.boardMotor = this.getBoardMotor();
			print(`[SkateboardController] onMountSuccess - Server Motor6D active: ${this.boardMotor !== undefined}`);
		}

		this.isMounted = true;
		this.currentState = "Idle";
		this.currentSpeed = 0;
		this.smoothedSteer = 0;
		this.currentRoll = 0;
		this.wasGrounded = true;
		this.timeInAir = 0;
		this.isChargingOllie = false;
		this.queuedTrick = undefined;
		this.isPerformingTrick = false;

		if (UserInputService.TouchEnabled) {
			this.mobileView.show();
		}

		if (char) {
			this.raycastParams.FilterDescendantsInstances = [char];

			const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (hrp) {
				hrp.SetAttribute("IsSkating", true);
				this.audioService.init(hrp);
			}

			// Nonaktifkan sistem movement, combat, crouch, footsteps, stamina
			MovementController.getInstance().setPaused(true);
			CombatController.getInstance().setPaused(true);
			CrouchController.getInstance().setPaused(true);
			FootstepController.getInstance().setMuted(true);
			StaminaController.getInstance().setPaused(true);

			// Mute audio HumanoidRootPart default
			if (hrp) {
				for (const child of hrp.GetChildren()) {
					if (child.IsA("Sound")) {
						child.Volume = 0;
					}
				}
			}

			const hum = char.FindFirstChildOfClass("Humanoid");
			if (hum) {
				hum.SetStateEnabled(Enum.HumanoidStateType.Jumping, false);
				hum.UseJumpPower = true;
				hum.JumpPower = 0;
				hum.JumpHeight = 0;
				hum.HipHeight = SkateboardConfig.ATTACHMENT.hipHeightMounted;
			}
			const animator = this.getAnimator(char);
			if (animator) {
				// Pastikan animator dan track idle skateboard tetap aktif kokoh setelah Motor6D terpasang
				for (const track of animator.GetPlayingAnimationTracks()) {
					const anim = track.Animation;
					if (anim && anim.AnimationId !== SkateboardConfig.ANIMATIONS.idle) {
						track.Stop(0);
					}
				}

				this.animService.setAnimator(animator);
				this.animService.playAnimation(
					SkateboardConfig.ANIMATIONS.idle,
					Enum.AnimationPriority.Action,
					true,
					0,
				);
			}

			// Reset joint R6 ke neutral agar postur badan tegak kokoh di atas papan
			const torso = char.FindFirstChild("Torso");
			const rootJoint = hrp?.FindFirstChild("RootJoint") as Motor6D | undefined;
			const neck = torso?.FindFirstChild("Neck") as Motor6D | undefined;
			const rightShoulder = torso?.FindFirstChild("Right Shoulder") as Motor6D | undefined;
			const leftShoulder = torso?.FindFirstChild("Left Shoulder") as Motor6D | undefined;
			const rightHip = torso?.FindFirstChild("Right Hip") as Motor6D | undefined;
			const leftHip = torso?.FindFirstChild("Left Hip") as Motor6D | undefined;

			if (rootJoint) rootJoint.C0 = new CFrame(0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0);
			if (neck) neck.C0 = new CFrame(0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0);
			if (rightShoulder) rightShoulder.C0 = new CFrame(1, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0);
			if (leftShoulder) leftShoulder.C0 = new CFrame(-1, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0);
			if (rightHip) rightHip.C0 = new CFrame(1, -1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0);
			if (leftHip) leftHip.C0 = new CFrame(-1, -1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0);
		}

		for (const cb of this.onMountStateChangedCallbacks) {
			cb(true);
		}

		// Jika pemain sudah menahan tombol W saat mount, langsung mulai meluncur
		if (UserInputService.IsKeyDown(SkateboardConfig.KEYBINDS.push)) {
			this.isPushing = true;
			this.startPushing();
		}
	}

	private onDismountSuccess(): void {
		this.cleanupPredictedBoard();
		this.boardMotor = undefined;
		this.activeBoardTrick = undefined;

		this.mobileView.hide();
		this.isMounted = false;
		this.currentState = "OffBoard";
		this.currentStance = "Regular";
		this.currentSpeed = 0;
		this.isPushing = false;
		this.isTouchPushing = false;
		this.isBraking = false;
		this.isHoldingBrake = false;
		this.pushPhase = "None";
		this.steerDirection = 0;
		this.smoothedSteer = 0;
		this.currentRoll = 0;
		this.wasGrounded = true;
		this.timeInAir = 0;
		this.isChargingOllie = false;
		this.queuedTrick = undefined;
		this.isPerformingTrick = false;
		if (this.activeGrind) {
			this.audioService.stopGrind();
			this.activeGrind = undefined;
		}

		const char = Players.LocalPlayer.Character;
		if (char) {
			const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (hrp) {
				hrp.SetAttribute("IsSkating", false);
				for (const child of hrp.GetChildren()) {
					if (child.IsA("Sound") && child.Name !== "Running") {
						child.Volume = 0.5;
					}
				}
			}

			const hum = char.FindFirstChildOfClass("Humanoid");
			if (hum) {
				hum.UnequipTools();
				hum.SetStateEnabled(Enum.HumanoidStateType.Jumping, true);
				hum.AutoRotate = true;
				hum.JumpPower = 35;
				hum.JumpHeight = 7.2;
				hum.HipHeight = SkateboardConfig.ATTACHMENT.hipHeightDismounted;
				hum.Move(Vector3.zero, false);
			}

			// Reset joint R6 ke default agar gerak karakter normal kembali bersih
			const torso = char.FindFirstChild("Torso");
			const rootJoint = hrp?.FindFirstChild("RootJoint") as Motor6D | undefined;
			const neck = torso?.FindFirstChild("Neck") as Motor6D | undefined;
			const rightShoulder = torso?.FindFirstChild("Right Shoulder") as Motor6D | undefined;
			const leftShoulder = torso?.FindFirstChild("Left Shoulder") as Motor6D | undefined;
			const rightHip = torso?.FindFirstChild("Right Hip") as Motor6D | undefined;
			const leftHip = torso?.FindFirstChild("Left Hip") as Motor6D | undefined;

			if (rootJoint) rootJoint.C0 = new CFrame(0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0);
			if (neck) neck.C0 = new CFrame(0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0);
			if (rightShoulder) rightShoulder.C0 = new CFrame(1, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0);
			if (leftShoulder) leftShoulder.C0 = new CFrame(-1, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0);
			if (rightHip) rightHip.C0 = new CFrame(1, -1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0);
			if (leftHip) leftHip.C0 = new CFrame(-1, -1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0);
		}

		this.stopTurnAnims(0.1);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.crouch, 0.1);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieCrouch, 0.1);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieStop, 0.1);

		// Aktifkan kembali sistem movement, combat, crouch, audio footsteps, dan stamina
		MovementController.getInstance().setPaused(false);
		CombatController.getInstance().setPaused(false);
		CrouchController.getInstance().setPaused(false);
		FootstepController.getInstance().setMuted(false);
		StaminaController.getInstance().setPaused(false);

		this.animService.cleanup();
		this.audioService.cleanup();

		for (const cb of this.onMountStateChangedCallbacks) {
			cb(false);
		}
	}

	private startPushing(): void {
		if (this.isChargingOllie) return;
		this.currentState = "Pushing";
		this.currentStance = "Regular";
		if (this.steerDirection === 0) {
			this.stopTurnAnims(0.15);
		}
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieStop, 0.15);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakiePush, 0.15);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieIdle, 0.15);

		const maxSpeed = SkateboardConfig.PHYSICS.maxSpeed;
		const cruisingThreshold = maxSpeed * 0.88;

		// Jika kecepatan sudah stabil di atas threshold:
		if (this.currentSpeed >= cruisingThreshold) {
			this.pushPhase = "Cruising";
			this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.startPush, 0.2);
			if (this.steerDirection === -1) {
				this.playTurnAnim("Left");
			} else if (this.steerDirection === 1) {
				this.playTurnAnim("Right");
			} else {
				this.animService.playAnimation(
					SkateboardConfig.ANIMATIONS.idle,
					Enum.AnimationPriority.Action,
					true,
					0.2,
				);
			}
		} else {
			// Mulai bergerak / berakselerasi: mainkan animasi startPush dengan looping
			this.pushPhase = "Pushing";
			if (this.currentSpeed < SkateboardConfig.PHYSICS.pushInitialKick) {
				this.currentSpeed = SkateboardConfig.PHYSICS.pushInitialKick;
			}
			this.animService.playAnimation(
				SkateboardConfig.ANIMATIONS.startPush,
				Enum.AnimationPriority.Action,
				true,
				0.25,
				1.0,
			);
			if (this.steerDirection === -1) {
				this.playTurnAnim("Left");
			} else if (this.steerDirection === 1) {
				this.playTurnAnim("Right");
			}
		}
	}

	private stopPushing(): void {
		if (this.pushPhase === "Pushing" || this.pushPhase === "Cruising") {
			this.pushPhase = "None";
			this.stopPushingAnimation();
			if (this.currentState === "Pushing") {
				this.currentState = "Idle";
			}
		}
	}

	private stopPushingAnimation(): void {
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.startPush, 0.25);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakiePush, 0.25);

		// Jika pemain sedang membelok saat melepas W, kembalikan ke animasi belok yang aktif
		if (this.steerDirection === -1) {
			this.playTurnAnim("Left");
		} else if (this.steerDirection === 1) {
			this.playTurnAnim("Right");
		} else {
			// Kembali ke stance idle netral di atas papan
			const idleAnim =
				this.currentStance === "Fakie"
					? SkateboardConfig.ANIMATIONS.fakieIdle
					: SkateboardConfig.ANIMATIONS.idle;
			this.animService.playAnimation(idleAnim, Enum.AnimationPriority.Action, true, 0.25);
		}
	}

	private startFakiePushing(): void {
		if (this.isChargingOllie) return;
		this.pushPhase = "FakiePushing";
		this.currentState = "FakiePush";
		this.currentStance = "Fakie";
		if (this.steerDirection === 0) {
			this.stopTurnAnims(0.15);
		}
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieStop, 0.15);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.idle, 0.15);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.startPush, 0.15);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieIdle, 0.15);
		this.animService.playAnimation(
			SkateboardConfig.ANIMATIONS.fakiePush,
			Enum.AnimationPriority.Action,
			true,
			0.25,
			1.0,
		);
		if (this.steerDirection === -1) {
			this.playTurnAnim("Left");
		} else if (this.steerDirection === 1) {
			this.playTurnAnim("Right");
		}
	}

	private stopFakiePushing(): void {
		if (this.pushPhase === "FakiePushing") {
			this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakiePush, 0.25);
			if (math.abs(this.currentSpeed) > 0.5) {
				this.pushPhase = "FakieCruising";
				this.currentState = "FakieIdle";
				if (this.steerDirection === -1) {
					this.playTurnAnim("Left");
				} else if (this.steerDirection === 1) {
					this.playTurnAnim("Right");
				} else {
					this.animService.playAnimation(
						SkateboardConfig.ANIMATIONS.fakieIdle,
						Enum.AnimationPriority.Action,
						true,
						0.25,
					);
				}
			} else {
				this.pushPhase = "None";
				this.currentStance = "Regular";
				this.currentState = "Idle";
				if (this.steerDirection === -1) {
					this.playTurnAnim("Left");
				} else if (this.steerDirection === 1) {
					this.playTurnAnim("Right");
				} else {
					this.animService.playAnimation(
						SkateboardConfig.ANIMATIONS.idle,
						Enum.AnimationPriority.Action,
						true,
						0.25,
					);
				}
			}
		}
	}

	private playTurnAnim(dir: "Left" | "Right"): void {
		if (this.currentState === "InAir" || this.isChargingOllie) return;
		const isFakie = this.currentStance === "Fakie";
		if (dir === "Left") {
			this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.turnRight, 0.1);
			this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieTurnRight, 0.1);
			const anim = isFakie ? SkateboardConfig.ANIMATIONS.fakieTurnLeft : SkateboardConfig.ANIMATIONS.turnLeft;
			this.animService.playAnimation(anim, Enum.AnimationPriority.Action2, true, 0.15);
		} else {
			this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.turnLeft, 0.1);
			this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieTurnLeft, 0.1);
			const anim = isFakie ? SkateboardConfig.ANIMATIONS.fakieTurnRight : SkateboardConfig.ANIMATIONS.turnRight;
			this.animService.playAnimation(anim, Enum.AnimationPriority.Action2, true, 0.15);
		}
	}

	private stopTurnAnims(fadeTime = 0.2): void {
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.turnLeft, fadeTime);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.turnRight, fadeTime);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieTurnLeft, fadeTime);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieTurnRight, fadeTime);
	}

	private executeOllie(): void {
		if (!this.isChargingOllie) return;
		this.isChargingOllie = false;
		this.lastJumpTime = os.clock();
		this.stopTurnAnims(0.05);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.crouch, 0.05);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieCrouch, 0.05);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.inAir, 0.05);

		// Hitung rasio charge berdasarkan lama tombol spasi ditekan (0.0 sampai 1.0)
		const chargeDuration = os.clock() - this.spacePressedTime;
		const chargeAlpha = math.clamp(chargeDuration / SkateboardConfig.PHYSICS.ollieMaxChargeTime, 0, 1);

		// Hitung target tinggi fisik (studs)
		const targetHeight =
			SkateboardConfig.PHYSICS.ollieMinHeight +
			chargeAlpha * (SkateboardConfig.PHYSICS.ollieMaxHeight - SkateboardConfig.PHYSICS.ollieMinHeight);

		// Hitung kecepatan vertikal takeoff menggunakan rumus kinematika: v_y = sqrt(2 * g * h)
		const grav = Workspace.Gravity > 0 ? Workspace.Gravity : 196.2;
		const jumpVelocity = math.sqrt(2 * grav * targetHeight);

		// Berikan impulse kecepatan vertikal satu kali saat lepas landas dengan menjaga kecepatan horizontal
		const rootPart = this.getRootPart();
		if (rootPart) {
			const forwardVector = rootPart.CFrame.LookVector;
			const moveDirection = this.currentSpeed >= 0 ? forwardVector : forwardVector.mul(-1);
			const airHorizontal = moveDirection.mul(math.abs(this.currentSpeed));
			rootPart.AssemblyLinearVelocity = new Vector3(airHorizontal.X, jumpVelocity, airHorizontal.Z);
		}

		this.currentState = "InAir";
		this.audioService.playPop();

		// Hitung durasi melayang (air time) alami secara presisi: t = (2 * v_y) / g
		const expectedAirTime = (2 * jumpVelocity) / grav;
		this.currentExpectedAirTime = expectedAirTime;
		const animSpeed = math.clamp(0.466 / expectedAirTime, 0.8, 1.3);

		// Jika ada trik yang di-queue saat menahan Space (pre-input), langsung eksekusi trik tersebut saat lepas landas
		if (this.queuedTrick) {
			const queued = this.queuedTrick;
			this.queuedTrick = undefined;
			this.triggerTrick(queued);
		} else {
			// Replikasi suara & rotasi Ollie ke pemain lain via server beserta durasi
			this.trickEvent.FireServer({ trickName: "Ollie", duration: expectedAirTime });
			this.startBoardTrick("Ollie", expectedAirTime);

			this.animService.playAnimation("Ollie", Enum.AnimationPriority.Action2, false, 0.05, animSpeed);
		}
	}

	public triggerTrick(trickName: SkateboardTrickName): void {
		// Trik dapat dilakukan saat berada di udara (InAir atau raycast tidak menyentuh tanah)
		const inAir = this.currentState === "InAir" || !this.isGrounded();
		if (!this.isMounted || this.isPerformingTrick || !inAir) return;

		this.isPerformingTrick = true;
		this.stopTurnAnims(0.05);

		// Hentikan animasi inAir atau Ollie sebelum memutar animasi trik
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.inAir, 0.05);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.ollie, 0.05);

		// Putar animasi trik karakter
		this.animService.playAnimation(trickName, Enum.AnimationPriority.Action2, false, 0.05);
		const track = this.animService.getTrack(trickName);

		// Hitung sisa waktu melayang di udara agar trik selesai sebelum roda menyentuh tanah
		const elapsedAir = os.clock() - this.lastJumpTime;
		const remainingAirTime = math.max(this.currentExpectedAirTime - elapsedAir, 0.28);

		// Tentukan durasi trik secara aman (safeMax mencegah error Luau math.clamp min > max)
		const baseDuration = track && track.Length > 0 ? track.Length : 0.36;
		const safeMax = math.max(remainingAirTime, 0.28);
		const finalDuration = trickName === "Treflip" ? 0.42 : math.clamp(baseDuration, 0.25, safeMax);

		// Sesuaikan kecepatan track animasi agar sinkron sempurna dengan durasi visual papan
		if (track && track.Length > 0) {
			track.AdjustSpeed(track.Length / finalDuration);
		}

		this.startBoardTrick(trickName, finalDuration);

		// Replikasi ke server beserta durasi agar visual di pemain lain tersinkronisasi presisi
		this.trickEvent.FireServer({ trickName, duration: finalDuration });

		const onTrickFinished = () => {
			this.isPerformingTrick = false;
			// Jika masih di udara dan masih mounted, kembalikan pose inAir agar karakter tidak berdiri kaku bawaan Roblox
			if (this.isMounted && !this.isGrounded()) {
				this.animService.playAnimation(
					SkateboardConfig.ANIMATIONS.inAir,
					Enum.AnimationPriority.Action,
					true,
					0.1,
				);
			} else if (this.isMounted && this.isGrounded()) {
				const idleAnim =
					this.currentStance === "Fakie"
						? SkateboardConfig.ANIMATIONS.fakieIdle
						: SkateboardConfig.ANIMATIONS.idle;
				this.animService.playAnimation(idleAnim, Enum.AnimationPriority.Action, true, 0.1);
			}
		};

		if (track && track.Length > 0) {
			let finished = false;
			const conn = track.Stopped.Connect(() => {
				if (finished) return;
				finished = true;
				conn.Disconnect();
				onTrickFinished();
			});
			task.delay(finalDuration + 0.05, () => {
				if (!finished) {
					finished = true;
					conn.Disconnect();
					onTrickFinished();
				}
			});
		} else {
			task.delay(finalDuration, () => {
				onTrickFinished();
			});
		}
	}

	private normalizeTrickName(name: string): SkateboardTrickName | "Ollie" {
		const lower = name.lower();
		if (lower.find("kickflip")[0] !== undefined) return "Kickflip";
		if (lower.find("heelflip")[0] !== undefined) return "Heelflip";
		if (
			lower.find("treflip")[0] !== undefined ||
			lower.find("360flip")[0] !== undefined ||
			lower.find("tre")[0] !== undefined
		)
			return "Treflip";
		if (lower.find("shuv")[0] !== undefined) return "Shuv";
		if (lower.find("ollie")[0] !== undefined) return "Ollie";
		if (lower.find("varial")[0] !== undefined) return "VarialHeel";
		if (lower.find("dolphin")[0] !== undefined) return "Dolphin";
		if (lower.find("hosp")[0] !== undefined) return "Hosp";
		if (lower.find("nolliehardflip")[0] !== undefined || lower.find("hardflip")[0] !== undefined)
			return "NollieHardflip";
		if (lower.find("nollietreflip")[0] !== undefined || lower.find("nollietre")[0] !== undefined)
			return "NollieTreFlip";
		return name as SkateboardTrickName | "Ollie";
	}

	public getBoardMotor(): Motor6D | undefined {
		const char = Players.LocalPlayer.Character;
		if (!char) return undefined;
		const rootPart = (char.FindFirstChild("HumanoidRootPart") ?? char.FindFirstChild("Torso")) as
			BasePart | undefined;
		if (!rootPart) return undefined;

		// 1. Cek apakah cached boardMotor masih valid dan terpasang pada karakter di Workspace
		if (
			this.boardMotor &&
			this.boardMotor.Parent &&
			this.boardMotor.Part0 &&
			this.boardMotor.Part1 &&
			this.boardMotor.Part1.IsDescendantOf(Workspace)
		) {
			return this.boardMotor;
		}

		// 2. Cari Motor6D resmi di rootPart yang Part1-nya valid dan hidup di Workspace
		for (const child of rootPart.GetChildren()) {
			if (child.IsA("Motor6D") && child.Name === SkateboardConfig.ATTACHMENT.jointName) {
				if (child.Part1 && child.Part1.IsDescendantOf(Workspace)) {
					this.boardMotor = child;
					return child;
				}
			}
		}

		// 3. Fallback: Cari di seluruh karakter jika Motor6D berada di part lain
		for (const desc of char.GetDescendants()) {
			if (desc.IsA("Motor6D") && desc.Name === SkateboardConfig.ATTACHMENT.jointName) {
				if (desc.Part1 && desc.Part1.IsDescendantOf(Workspace)) {
					this.boardMotor = desc;
					return desc;
				}
			}
		}

		return undefined;
	}

	private startBoardTrick(name: string, duration: number): void {
		const normalizedName = this.normalizeTrickName(name);
		const motor = this.getBoardMotor();
		print(
			`[BoardTrick] Triggered: ${normalizedName}, Duration: ${duration}, Motor6D Valid: ${motor !== undefined}`,
		);
		if (!motor) {
			warn("[BoardTrick] Motor6D papan tidak ditemukan di karakter!");
		}

		this.activeBoardTrick = {
			name: normalizedName,
			startTime: os.clock(),
			duration: math.max(duration, 0.28),
		};
	}

	public static calculateTrickCFrame(trickName: string, progress: number): CFrame {
		const clampedProgress = math.clamp(progress, 0, 1);
		const lower = trickName.lower();

		if (lower.find("kickflip")[0] !== undefined) {
			// Barrel roll 360 derajat mengelilingi sumbu panjang Z + pop pitch X
			const roll = -math.rad(360) * clampedProgress;
			const pitch = math.sin(clampedProgress * math.pi) * math.rad(16);
			const lift = math.sin(clampedProgress * math.pi) * 0.35;
			return new CFrame(0, lift, 0).mul(CFrame.Angles(pitch, 0, roll));
		} else if (lower.find("heelflip")[0] !== undefined) {
			// Barrel roll 360 derajat arah sebaliknya mengelilingi Z
			const roll = math.rad(360) * clampedProgress;
			const pitch = math.sin(clampedProgress * math.pi) * math.rad(16);
			const lift = math.sin(clampedProgress * math.pi) * 0.35;
			return new CFrame(0, lift, 0).mul(CFrame.Angles(pitch, 0, roll));
		} else if (
			lower.find("treflip")[0] !== undefined ||
			lower.find("360flip")[0] !== undefined ||
			lower.find("tre")[0] !== undefined
		) {
			// 360 Pop Shuvit (putar Y 360) dipadu Kickflip (putar Z 360)
			const roll = -math.rad(360) * clampedProgress;
			const yaw = math.rad(360) * clampedProgress;
			const pitch = math.sin(clampedProgress * math.pi) * math.rad(18);
			const liftY = math.sin(clampedProgress * math.pi) * 0.85;
			return new CFrame(0, liftY, 0).mul(CFrame.Angles(pitch, yaw, roll));
		} else if (lower.find("shuv")[0] !== undefined) {
			// Pop Shuvit: putar 180 derajat mendatar pada sumbu Y
			const yaw = math.rad(180) * clampedProgress;
			const pitch = math.sin(clampedProgress * math.pi) * math.rad(10);
			const lift = math.sin(clampedProgress * math.pi) * 0.25;
			return new CFrame(0, lift, 0).mul(CFrame.Angles(pitch, yaw, 0));
		} else if (lower.find("ollie")[0] !== undefined) {
			// Ollie: angkat nose di paruh pertama (0 -> 0.4), ratakan di paruh kedua (0.4 -> 1.0)
			let pitch = 0;
			if (clampedProgress < 0.4) {
				pitch = math.rad(22) * (clampedProgress / 0.4);
			} else {
				pitch = math.rad(22) * (1 - (clampedProgress - 0.4) / 0.6);
			}
			return CFrame.Angles(pitch, 0, 0);
		} else if (lower.find("varial")[0] !== undefined) {
			const roll = math.rad(360) * clampedProgress;
			const yaw = -math.rad(180) * clampedProgress;
			const pitch = math.sin(clampedProgress * math.pi) * math.rad(14);
			const lift = math.sin(clampedProgress * math.pi) * 0.45;
			return new CFrame(0, lift, 0).mul(CFrame.Angles(pitch, yaw, roll));
		} else if (lower.find("hardflip")[0] !== undefined) {
			const roll = -math.rad(360) * clampedProgress;
			const yaw = -math.rad(180) * clampedProgress;
			const pitch = math.sin(clampedProgress * math.pi) * math.rad(18);
			const lift = math.sin(clampedProgress * math.pi) * 0.5;
			return new CFrame(0, lift, 0).mul(CFrame.Angles(pitch, yaw, roll));
		} else if (lower.find("dolphin")[0] !== undefined) {
			const pitch = -math.rad(360) * clampedProgress;
			const lift = math.sin(clampedProgress * math.pi) * 0.5;
			return new CFrame(0, lift, 0).mul(CFrame.Angles(pitch, 0, 0));
		} else if (lower.find("hosp")[0] !== undefined) {
			const roll = -math.rad(180) * clampedProgress;
			const yaw = math.rad(180) * clampedProgress;
			const lift = math.sin(clampedProgress * math.pi) * 0.4;
			return new CFrame(0, lift, 0).mul(CFrame.Angles(0, yaw, roll));
		}
		return new CFrame();
	}

	/**
	 * Client-Side Prediction: Buat papan visual sementara dan pasang Motor6D instan di frame ke-0
	 * agar pemain lokal langsung melihat papan di bawah kaki tanpa menunggu round-trip server.
	 * Papan prediksi ini akan dihapus begitu server membalas dengan Motor6D resmi.
	 */
	private createClientPredictedBoard(char: Model, rootPart: BasePart): void {
		// Bersihkan joint usang jika ada Part1 yang tidak valid
		for (const child of rootPart.GetChildren()) {
			if (child.IsA("Motor6D") && child.Name === SkateboardConfig.ATTACHMENT.jointName) {
				if (!child.Part1 || !child.Part1.IsDescendantOf(Workspace)) {
					child.Destroy();
				}
			}
		}

		// Jangan buat duplikat jika sudah ada joint resmi dari server atau papan prediksi aktif
		if (
			(this.boardMotor && this.boardMotor.Part1 && this.boardMotor.Part1.IsDescendantOf(Workspace)) ||
			char.FindFirstChild("PlayerSkateboard") ||
			this.predictedBoard
		) {
			return;
		}

		// Cari template papan di ReplicatedStorage atau dari Tool yang sedang dipegang
		let template: Instance | undefined = ReplicatedStorage.FindFirstChild("SkateboardTemplate");
		if (!template) {
			const backpack = Players.LocalPlayer.FindFirstChildOfClass("Backpack");
			const tool = (char.FindFirstChild("Skateboard") ?? backpack?.FindFirstChild("Skateboard")) as
				Tool | undefined;
			if (tool) {
				template = tool.FindFirstChild("Skateboard") ?? tool.FindFirstChild("Trickboard") ?? tool;
			}
		}
		if (!template) return;

		// Clone visual papan ke dalam model sementara
		const boardModel = new Instance("Model");
		boardModel.Name = "PlayerSkateboard";

		if (template.IsA("Model") || template.IsA("Folder") || template.IsA("Tool")) {
			for (const child of template.GetChildren()) {
				// Masukkan semua part mesh papan (termasuk part bernama Handle), jangan skip!
				if (!child.IsA("LuaSourceContainer") && !child.IsA("Weld") && !child.IsA("Motor6D")) {
					const cloned = child.Clone();
					cloned.Parent = boardModel;
				}
			}
		} else if (template.IsA("BasePart")) {
			template.Clone().Parent = boardModel;
		}

		// Temukan part utama papan: prioritaskan Board, BoardMain, Handle, atau BasePart apa saja
		const targetPart = (boardModel.FindFirstChild("Board", true) ??
			boardModel.FindFirstChild("BoardMain", true) ??
			boardModel.FindFirstChild("Handle", true) ??
			boardModel.FindFirstChildWhichIsA("BasePart", true)) as BasePart | undefined;
		if (!targetPart) {
			warn("[SkateboardController] Board part not found in predicted board template!");
			boardModel.Destroy();
			return;
		}
		targetPart.Name = "VisualBoard";

		// Las semua BasePart ke targetPart, konfigurasi fisik & pastikan part visual papan 100% terlihat
		for (const desc of boardModel.GetDescendants()) {
			if (desc.IsA("BasePart")) {
				desc.Anchored = false;
				desc.CanCollide = false;
				desc.Massless = true;
				if (desc.Name === "Handle" || desc.Name === "ToolAnchor" || desc.Name === "Trucks") {
					desc.Transparency = 1;
				} else {
					desc.Transparency = 0;
				}
				if (desc !== targetPart) {
					const weld = new Instance("WeldConstraint");
					weld.Name = `Weld_${desc.Name}`;
					weld.Part0 = targetPart;
					weld.Part1 = desc;
					weld.Parent = targetPart;
				}
			}
		}

		boardModel.Parent = char;
		this.predictedBoard = boardModel;

		// Sambungkan Motor6D prediksi instan (0ms) di client
		const joint = new Instance("Motor6D");
		joint.Name = SkateboardConfig.ATTACHMENT.jointName;
		joint.Part0 = rootPart;
		joint.Part1 = targetPart;
		joint.C0 = SkateboardConfig.ATTACHMENT.boardCFrameOffset;
		joint.C1 = new CFrame();
		joint.Parent = rootPart;
		this.boardMotor = joint;

		print("[Motor6D Attached] Client-predicted board created and attached instantly (0ms).");
	}

	/**
	 * Hapus papan prediksi client setelah server membalas atau saat dismount/respawn
	 */
	private cleanupPredictedBoard(): void {
		if (this.predictedBoard) {
			this.predictedBoard.Destroy();
			this.predictedBoard = undefined;
			print("[SkateboardController] Client-predicted board cleaned up.");
		}

		// Bersihkan Motor6D prediksi client yang Part1-nya sudah hancur
		const char = Players.LocalPlayer.Character;
		const rootPart = (char?.FindFirstChild("HumanoidRootPart") ?? char?.FindFirstChild("Torso")) as
			BasePart | undefined;
		if (rootPart) {
			for (const child of rootPart.GetChildren()) {
				if (child.IsA("Motor6D") && child.Name === SkateboardConfig.ATTACHMENT.jointName) {
					if (!child.Part1 || !child.Part1.IsDescendantOf(Workspace)) {
						child.Destroy();
					}
				}
			}
		}

		if (this.boardMotor && (!this.boardMotor.Part1 || !this.boardMotor.Part1.IsDescendantOf(Workspace))) {
			this.boardMotor = undefined;
		}
	}

	private getAnimator(char?: Model): Animator | undefined {
		const targetChar = char ?? Players.LocalPlayer.Character;
		if (!targetChar) return undefined;

		const humanoid = targetChar.FindFirstChildOfClass("Humanoid");
		if (!humanoid) return undefined;

		// Tunggu Animator resmi buatan server agar replikasi animasi aktif ke seluruh pemain
		const animator =
			humanoid.FindFirstChildOfClass("Animator") ??
			(humanoid.WaitForChild("Animator", 5) as Animator | undefined);
		return animator;
	}

	private getRootPart(): BasePart | undefined {
		const char = Players.LocalPlayer.Character;
		return char?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	}

	private getGroundInfo(): { grounded: boolean; normal: Vector3; material?: Enum.Material } {
		if (this.currentState === "Grinding") {
			return { grounded: false, normal: new Vector3(0, 1, 0) };
		}

		const rootPart = this.getRootPart();
		const char = Players.LocalPlayer.Character;
		const humanoid = char?.FindFirstChildOfClass("Humanoid");
		if (!rootPart || !char) return { grounded: false, normal: new Vector3(0, 1, 0) };

		// Tenggang waktu minimal setelah tombol lompat/trik ditekan (takeoff protection)
		if (os.clock() - this.lastJumpTime < 0.15) {
			return { grounded: false, normal: new Vector3(0, 1, 0) };
		}

		// 1. Raycast ke bawah untuk mendeteksi kontak tanah & normal permukaan tanah
		this.raycastParams.FilterDescendantsInstances = [char];
		const rayOrigin = rootPart.Position;
		const rayDirection = new Vector3(0, -4.6, 0);
		const result = Workspace.Raycast(rayOrigin, rayDirection, this.raycastParams);

		if (result) {
			// Jika mengenai part bertag GrindRail, jangan anggap tanah biasa agar sistem grinding dapat menguncinya
			const hit = result.Instance;
			let isRail = CollectionService.HasTag(hit, SkateboardConfig.GRINDING.tag);
			if (!isRail && hit.Parent) {
				isRail = CollectionService.HasTag(hit.Parent, SkateboardConfig.GRINDING.tag);
			}
			if (!isRail) {
				return { grounded: true, normal: result.Normal, material: result.Material };
			}
		}

		// 2. Deteksi native Roblox Humanoid (FloorMaterial bukan Air = 100% menempel tanah)
		if (humanoid && humanoid.FloorMaterial !== Enum.Material.Air) {
			return { grounded: true, normal: new Vector3(0, 1, 0), material: humanoid.FloorMaterial };
		}

		return { grounded: false, normal: new Vector3(0, 1, 0) };
	}

	private isGrounded(): boolean {
		return this.getGroundInfo().grounded;
	}

	private setupPhysicsLoop(): void {
		RunService.Heartbeat.Connect((dt) => {
			if (!this.isMounted) return;

			const rootPart = this.getRootPart();
			const char = Players.LocalPlayer.Character;
			const humanoid = char?.FindFirstChildOfClass("Humanoid");
			if (!rootPart || !humanoid || humanoid.Health <= 0) return;
			if (humanoid.AutoRotate) {
				humanoid.AutoRotate = false;
			}

			const groundInfo = this.getGroundInfo();
			const grounded = groundInfo.grounded;
			const groundNormal = groundInfo.normal;

			// Fail-safe active polling tombol gerak (W atau Mobile Touch Push) agar respon seketika setelah mount
			const isPushDown = UserInputService.IsKeyDown(SkateboardConfig.KEYBINDS.push) || this.isTouchPushing;
			if (isPushDown && !this.isPushing && !this.isChargingOllie && !this.isPerformingTrick && !this.isBraking) {
				this.isPushing = true;
				if (this.currentSpeed < -0.1) {
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakiePush, 0.1);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieIdle, 0.1);
					this.animService.playAnimation(
						SkateboardConfig.ANIMATIONS.fakieStop,
						Enum.AnimationPriority.Action,
						true,
						0.1,
					);
				} else {
					this.startPushing();
				}
			} else if (!isPushDown && this.isPushing) {
				this.isPushing = false;
				this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieStop, 0.2);
				this.stopPushing();
			}

			// 0. Update audio rolling roda dinamis dengan parameter fisika lengkap
			this.audioService.updateRolling(
				grounded,
				this.currentSpeed,
				SkateboardConfig.PHYSICS.maxSpeed,
				dt,
				groundInfo.material,
				this.isBraking,
			);

			// 0.5 Update Rail Grinding Physics jika sedang di atas rel
			if (this.currentState === "Grinding") {
				this.updateGrindPhysics(dt);
				return;
			}

			// 0.6 Deteksi rel saat di udara atau melompat mendekati GrindRail (Responsif & Sensitif)
			if (this.currentState === "InAir" || this.currentState === "Trick" || !grounded) {
				this.checkRailGrindDetection();
				if ((this.currentState as SkateboardState) === "Grinding") {
					return;
				}
			}

			// 1. Tangani transisi state Air & Land
			if (!grounded) {
				this.timeInAir += dt;

				if (!this.isPerformingTrick && !this.isChargingOllie) {
					if (this.currentState !== "InAir") {
						this.currentState = "InAir";
						this.stopPushingAnimation();
						this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakiePush, 0.15);
					}

					// Pastikan animasi inAir diputar saat melayang di udara dan animasi Ollie telah selesai atau tidak aktif
					const isOlliePlaying =
						this.animService.isPlaying("Ollie") ||
						this.animService.isPlaying(SkateboardConfig.ANIMATIONS.ollie);

					if (!isOlliePlaying && !this.animService.isPlaying(SkateboardConfig.ANIMATIONS.inAir)) {
						this.animService.playAnimation(
							SkateboardConfig.ANIMATIONS.inAir,
							Enum.AnimationPriority.Action,
							true,
							0.1,
						);
					}
				}
			} else {
				// Ketika berada di atas tanah, pastikan animasi inAir & Ollie selalu dihentikan agar tidak nyangkut saat idle
				this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.inAir, 0.1);

				// Touchdown / Landing detection:
				// HANYA trigger landing jika baru saja mendarat dari lompatan/melayang di udara (InAir & timeInAir >= 0.2s)
				if (!this.wasGrounded && this.currentState === "InAir" && this.timeInAir >= 0.2) {
					const fallImpact = math.clamp(this.timeInAir / 0.4, 0.7, 1.2);
					this.audioService.playLanding(fallImpact);

					this.currentState = "Landing";
					this.isPerformingTrick = false;
					this.queuedTrick = undefined;

					// Hentikan kecepatan vertikal ke bawah seketika agar Humanoid tidak memantul (anti-bounce)
					rootPart.AssemblyLinearVelocity = new Vector3(
						rootPart.AssemblyLinearVelocity.X,
						0,
						rootPart.AssemblyLinearVelocity.Z,
					);

					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.ollie, 0.05);
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.inAir, 0.05);
					const landAnim =
						this.currentStance === "Fakie"
							? SkateboardConfig.ANIMATIONS.fakieLand
							: SkateboardConfig.ANIMATIONS.land;
					this.animService.playAnimation(landAnim, Enum.AnimationPriority.Action, false, 0.05);

					task.delay(0.2, () => {
						if (this.isMounted && this.currentState === "Landing") {
							this.currentState = this.currentStance === "Fakie" ? "FakieIdle" : "Idle";
							const idleAnim =
								this.currentStance === "Fakie"
									? SkateboardConfig.ANIMATIONS.fakieIdle
									: SkateboardConfig.ANIMATIONS.idle;
							this.animService.playAnimation(idleAnim, Enum.AnimationPriority.Action, true, 0.2);
						}
					});
				} else if (this.currentState === "InAir") {
					// Jika guncangan/gundukan kecil lewat (< 0.2s), pulihkan state normal tanpa efek audio/landing
					this.currentState = this.currentStance === "Fakie" ? "FakieIdle" : "Idle";
				}
				this.timeInAir = 0;
			}
			this.wasGrounded = grounded;

			// 1.5 Slope Dynamics (Fisika Tanjakan & Turunan Mengikuti Kontur Tanah)
			const forwardVector = rootPart.CFrame.LookVector;
			const slopeAlignment = forwardVector.Dot(groundNormal);
			const grav = Workspace.Gravity > 0 ? Workspace.Gravity : 196.2;
			const isSlope = math.abs(slopeAlignment) > 0.03;

			if (grounded && isSlope && !this.isBraking) {
				// Saat turunan (slopeAlignment > 0): tambahkan akselerasi gravitasi ke currentSpeed
				// Saat tanjakan (slopeAlignment < 0): perlambat laju secara alami
				const slopeAcceleration = slopeAlignment * (grav * 0.35) * dt;
				this.currentSpeed += slopeAcceleration;

				// Toleransi batas maxSpeed ekstra saat menuruni lereng curam (contoh: maxSpeed * 1.35)
				const downhillMax = SkateboardConfig.PHYSICS.maxSpeed * 1.35;
				if (this.currentSpeed > downhillMax) {
					this.currentSpeed = downhillMax;
				} else if (this.currentSpeed < -downhillMax) {
					this.currentSpeed = -downhillMax;
				}
			}

			// 2. Akselerasi Dinamis Maju (Forward Push & Cruising) atau Rem Mundur saat tekan W
			if (this.isPushing && grounded && !this.isChargingOllie && !this.isPerformingTrick && !this.isBraking) {
				if (this.currentSpeed < -0.1) {
					// Sedang meluncur mundur: rem laju mundur cepat & mulus hingga 0, lalu otomatis dorong maju
					this.pushPhase = "None";
					this.currentSpeed = math.min(0, this.currentSpeed + SkateboardConfig.PHYSICS.brakeDecel * 1.5 * dt);
					if (this.currentSpeed >= 0) {
						this.currentSpeed = 0;
						this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieStop, 0.15);
						this.currentStance = "Regular";
						this.startPushing();
					}
				} else {
					const maxSpeed =
						isSlope && slopeAlignment > 0.03
							? SkateboardConfig.PHYSICS.maxSpeed * 1.35
							: SkateboardConfig.PHYSICS.maxSpeed;
					const cruisingThreshold = maxSpeed * 0.88;

					if (this.pushPhase === "Pushing") {
						this.currentSpeed = math.min(
							this.currentSpeed + SkateboardConfig.PHYSICS.pushAcceleration * dt,
							maxSpeed,
						);

						const dynamicPushSpeed = math.clamp(this.currentSpeed / 16, 0.85, 1.35);
						this.animService.adjustSpeed(SkateboardConfig.ANIMATIONS.startPush, dynamicPushSpeed);

						if (this.currentSpeed >= cruisingThreshold) {
							this.pushPhase = "Cruising";
							this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.startPush, 0.3);
							if (this.steerDirection === -1) {
								this.playTurnAnim("Left");
							} else if (this.steerDirection === 1) {
								this.playTurnAnim("Right");
							} else {
								this.animService.playAnimation(
									SkateboardConfig.ANIMATIONS.idle,
									Enum.AnimationPriority.Action,
									true,
									0.25,
								);
							}
						}
					} else if (this.pushPhase === "Cruising") {
						this.currentSpeed = math.min(this.currentSpeed + 2 * dt, maxSpeed);

						if (this.currentSpeed < cruisingThreshold * 0.75) {
							this.pushPhase = "Pushing";
							this.animService.playAnimation(
								SkateboardConfig.ANIMATIONS.startPush,
								Enum.AnimationPriority.Action,
								true,
								0.25,
								1.0,
							);
							if (this.steerDirection === -1) {
								this.playTurnAnim("Left");
							} else if (this.steerDirection === 1) {
								this.playTurnAnim("Right");
							}
						}
					}
				}
			}

			// 3. Pengereman (Brake S) & Akselerasi Fakie Push
			if (this.isBraking) {
				this.pushPhase = "None";
				this.currentSpeed = math.max(0, this.currentSpeed - SkateboardConfig.PHYSICS.brakeDecel * dt);
				if (this.currentSpeed <= 0.1) {
					this.currentSpeed = 0;
					this.isBraking = false;
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.stop, 0.15);
					// Jika tombol S masih ditahan, beralih ke Fakie Push
					if (this.isHoldingBrake) {
						this.currentStance = "Fakie";
						this.startFakiePushing();
					}
				}
			} else if (
				this.pushPhase === "FakiePushing" &&
				grounded &&
				!this.isChargingOllie &&
				!this.isPerformingTrick
			) {
				const maxFakie = SkateboardConfig.PHYSICS.maxFakieSpeed;
				const fakieCruisingThreshold = -maxFakie * 0.85;

				this.currentSpeed = math.max(
					this.currentSpeed - SkateboardConfig.PHYSICS.fakieAcceleration * dt,
					-maxFakie,
				);

				const dynamicFakieSpeed = math.clamp(math.abs(this.currentSpeed) / 16, 0.85, 1.35);
				this.animService.adjustSpeed(SkateboardConfig.ANIMATIONS.fakiePush, dynamicFakieSpeed);

				if (this.currentSpeed <= fakieCruisingThreshold) {
					this.pushPhase = "FakieCruising";
					this.currentState = "FakieIdle";
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakiePush, 0.3);
					if (this.steerDirection === -1) {
						this.playTurnAnim("Left");
					} else if (this.steerDirection === 1) {
						this.playTurnAnim("Right");
					} else {
						this.animService.playAnimation(
							SkateboardConfig.ANIMATIONS.fakieIdle,
							Enum.AnimationPriority.Action,
							true,
							0.25,
						);
					}
				}
			} else if (
				this.pushPhase === "FakieCruising" &&
				grounded &&
				!this.isChargingOllie &&
				!this.isPerformingTrick
			) {
				const maxFakie = SkateboardConfig.PHYSICS.maxFakieSpeed;
				const fakieCruisingThreshold = -maxFakie * 0.85;

				this.currentSpeed = math.max(this.currentSpeed - 2 * dt, -maxFakie);

				if (this.currentSpeed > fakieCruisingThreshold * 0.75) {
					this.pushPhase = "FakiePushing";
					this.currentState = "FakiePush";
					this.animService.playAnimation(
						SkateboardConfig.ANIMATIONS.fakiePush,
						Enum.AnimationPriority.Action,
						true,
						0.25,
						1.0,
					);
					if (this.steerDirection === -1) {
						this.playTurnAnim("Left");
					} else if (this.steerDirection === 1) {
						this.playTurnAnim("Right");
					}
				}
			} else if (
				grounded &&
				!this.isPushing &&
				!this.isHoldingBrake &&
				this.pushPhase !== "FakiePushing" &&
				this.pushPhase !== "FakieCruising" &&
				!isSlope
			) {
				// 3. Framerate-Independent Drag (Normalisasi Hambatan Gesek Sesuai FPS)
				// Hambatan ini hanya aktif jika pemain tidak menekan tombol throttle (W/S) dan sedang di bidang datar.
				const frameNormalizedDrag = math.pow(SkateboardConfig.PHYSICS.dragMultiplier, dt * 60);
				this.currentSpeed *= frameNormalizedDrag;

				if (math.abs(this.currentSpeed) < 0.1) {
					this.currentSpeed = 0;
					this.pushPhase = "None";
					this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieStop, 0.2);
					if (this.currentStance === "Fakie" && !this.isHoldingBrake && !this.isChargingOllie) {
						this.currentStance = "Regular";
						this.currentState = "Idle";
						this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieIdle, 0.25);
						this.animService.playAnimation(
							SkateboardConfig.ANIMATIONS.idle,
							Enum.AnimationPriority.Action,
							true,
							0.25,
						);
					}
				}
			}

			// 4. Fisika Belok & Carving Realistis (Speed-Dependent Steering & Smooth Carving)
			// 4. Fisika Belok & Carving Realistis (Speed-Dependent Steering & Smooth Carving)
			// Catatan: Gunakan hanya this.steerDirection (PC: A/D, Mobile: tombol UI belok)
			// DILARANG membaca humanoid.MoveDirection karena MoveDirection terikat arah kamera/gerak maju yang akan membalikkan arah hadap skateboard secara otomatis!
			const steerTarget = this.steerDirection; // -1: kiri, 1: kanan, 0: netral

			this.smoothedSteer =
				this.smoothedSteer +
				(steerTarget - this.smoothedSteer) *
					math.clamp(SkateboardConfig.PHYSICS.steerResponsiveness * dt, 0, 1);

			// Speed-Dependent Steering: Di kecepatan rendah lincah (full turn speed),
			// di kecepatan tinggi (mendekati maxSpeed) dikurangi hingga ~40% agar kontrol papan tidak oversteer/oleng
			const baseMaxSpeed = SkateboardConfig.PHYSICS.maxSpeed;
			const speedAlpha = math.clamp(math.abs(this.currentSpeed) / baseMaxSpeed, 0, 1);
			const dynamicTurnSpeed = SkateboardConfig.PHYSICS.turnAngularVelocity * (1 - speedAlpha * 0.4);

			// Invert yawDelta saat meluncur mundur agar kemudi kiri/kanan tetap sinkron dengan pandangan pemain
			const steerMultiplier = this.currentSpeed < -0.1 ? 1 : -1;
			const yawDelta = steerMultiplier * this.smoothedSteer * dynamicTurnSpeed * dt;

			if (math.abs(yawDelta) > 0.00005) {
				const [, currentYaw] = rootPart.CFrame.ToOrientation();
				rootPart.CFrame = new CFrame(rootPart.Position).mul(
					CFrame.fromOrientation(0, currentYaw + yawDelta, 0),
				);
			}

			// 6. Kemiringan Badan & Papan (Banking Roll Tilt) & Animasi Trik Papan Prosedural
			const rollSpeedFactor = math.clamp(math.abs(this.currentSpeed) / 15, 0.2, 1.0);
			const targetRoll = -this.smoothedSteer * SkateboardConfig.PHYSICS.maxBankingAngle * rollSpeedFactor;
			this.currentRoll =
				this.currentRoll +
				(targetRoll - this.currentRoll) * math.clamp(SkateboardConfig.PHYSICS.rollSmoothing * dt, 0, 1);

			if (this.activeBoardTrick) {
				const elapsed = os.clock() - this.activeBoardTrick.startTime;
				const progress = elapsed / this.activeBoardTrick.duration;
				if (progress >= 1) {
					this.activeBoardTrick = undefined;
					this.trickCFrameOffset = new CFrame();
				} else {
					this.trickCFrameOffset = SkateboardController.calculateTrickCFrame(
						this.activeBoardTrick.name,
						progress,
					);
				}
			} else {
				this.trickCFrameOffset = new CFrame();
			}

			const boardJoint = this.getBoardMotor();
			if (boardJoint) {
				boardJoint.C0 = SkateboardConfig.ATTACHMENT.boardCFrameOffset
					.mul(this.trickCFrameOffset)
					.mul(CFrame.Angles(0, 0, this.currentRoll));
			}

			// 7. Penggerak Fisika Karakter (Direct Horizontal Velocity & Momentum Support)
			// Hitung arah hadap BARU setelah belokan diterapkan di frame ini
			const currentHeadingForward = rootPart.CFrame.LookVector;
			const moveDir = this.currentSpeed >= 0 ? currentHeadingForward : currentHeadingForward.mul(-1);
			const horiz = moveDir.mul(math.abs(this.currentSpeed));

			humanoid.WalkSpeed = 0; // Tetap 0 agar controller internal Roblox Humanoid tidak mengintervensi

			if (grounded) {
				if (math.abs(this.currentSpeed) > 0.1) {
					// Dorongan linear velocity horizontal langsung mengikuti orientasi belok terbaru
					rootPart.AssemblyLinearVelocity = new Vector3(horiz.X, rootPart.AssemblyLinearVelocity.Y, horiz.Z);
				} else {
					rootPart.AssemblyLinearVelocity = new Vector3(0, rootPart.AssemblyLinearVelocity.Y, 0);
				}
			} else {
				// Jaga momentum horizontal saat melayang di udara agar laju maju tidak mandek / berhenti di tengah trik
				rootPart.AssemblyLinearVelocity = new Vector3(horiz.X, rootPart.AssemblyLinearVelocity.Y, horiz.Z);
			}
		});
	}

	/**
	 * Dedicated Loop untuk sinkronisasi rotasi visual papan pemain lain secara independen.
	 * Berjalan bebas tanpa terikat apakah LocalPlayer sedang menaiki skateboard atau tidak!
	 */
	private setupOtherPlayersBoardLoop(): void {
		RunService.Heartbeat.Connect(() => {
			if (this.otherPlayerBoardTricks.size() === 0) return;

			for (const [otherPlayer, trickData] of this.otherPlayerBoardTricks) {
				const otherChar = otherPlayer.Character;
				if (!otherChar) {
					this.otherPlayerBoardTricks.delete(otherPlayer);
					continue;
				}

				const otherHrp = otherChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
				// Resilient Joint Lookup: cari di HRP, lalu fallback cari di seluruh Character
				const otherJoint = (otherHrp?.FindFirstChild(SkateboardConfig.ATTACHMENT.jointName) ??
					otherChar.FindFirstChild(SkateboardConfig.ATTACHMENT.jointName, true)) as Motor6D | undefined;

				const elapsed = os.clock() - trickData.startTime;
				const progress = elapsed / trickData.duration;

				if (progress >= 1) {
					// Selesai trik: kembalikan C0 papan ke posisi netral
					if (otherJoint) {
						otherJoint.C0 = SkateboardConfig.ATTACHMENT.boardCFrameOffset;
					}
					this.otherPlayerBoardTricks.delete(otherPlayer);
				} else {
					// Sedang berlangsung: update rotasi papan pemain lain secara mulus 60 FPS
					if (otherJoint) {
						const otherOffset = SkateboardController.calculateTrickCFrame(trickData.trickName, progress);
						otherJoint.C0 = SkateboardConfig.ATTACHMENT.boardCFrameOffset.mul(otherOffset);
					}
				}
			}
		});
	}

	/**
	 * Memutar audio 3D spasial di posisi tertentu (persis seperti CombatController)
	 */
	private playSpatialSound(position: Vector3, soundId: string, volume?: number): void {
		if (!soundId || soundId === "") return;

		const part = new Instance("Part");
		part.Anchored = true;
		part.CanCollide = false;
		part.Transparency = 1;
		part.Size = new Vector3(0.1, 0.1, 0.1);
		part.Position = position;
		part.Parent = Workspace;

		const sound = new Instance("Sound");
		sound.SoundId = soundId;
		sound.Volume = volume ?? 0.85;
		sound.RollOffMaxDistance = 120;
		sound.RollOffMinDistance = 5;
		sound.RollOffMode = Enum.RollOffMode.Linear;
		sound.Parent = part;

		sound.Play();
		sound.Ended.Connect(() => part.Destroy());
		Debris.AddItem(part, 5);
	}

	/**
	 * Menghitung parameter geometri rel (origin, direction, up, panjang, radius).
	 * Mendukung Part Cylinder dan Block, serta attribute RailAxis.
	 */
	private getRailGeometry(railPart: BasePart):
		| {
				origin: Vector3;
				direction: Vector3;
				up: Vector3;
				length: number;
				halfLength: number;
				radius: number;
		  }
		| undefined {
		const size = railPart.Size;
		const cf = railPart.CFrame;

		let railDirection = cf.LookVector;
		let railUp = cf.UpVector;
		let railLength = size.Z;
		let railRadius = math.min(size.X, size.Y) / 2;

		const axisAttr = railPart.GetAttribute("RailAxis") as string | undefined;

		if (axisAttr === "X") {
			railDirection = cf.RightVector;
			railLength = size.X;
			railRadius = math.min(size.Y, size.Z) / 2;
		} else if (axisAttr === "Z") {
			railDirection = cf.LookVector;
			railLength = size.Z;
			railRadius = math.min(size.X, size.Y) / 2;
		} else if (axisAttr === "Y") {
			railDirection = cf.UpVector;
			railUp = cf.LookVector;
			railLength = size.Y;
			railRadius = math.min(size.X, size.Z) / 2;
		} else if (railPart.IsA("Part") && railPart.Shape === Enum.PartType.Cylinder) {
			// Sifat unik Cylinder Roblox: sumbu memanjang berada di sumbu lokal X (RightVector)
			railDirection = cf.RightVector;
			railLength = size.X;
			railRadius = size.Y / 2;
		} else {
			// Block umumnya memanjang di sumbu Z atau sumbu horizontal terpanjang
			railDirection = size.Z >= size.X ? cf.LookVector : cf.RightVector;
			railLength = math.max(size.X, size.Z);
			railRadius = size.Y / 2;
		}

		return {
			origin: railPart.Position,
			direction: railDirection.Unit,
			up: railUp.Unit,
			length: railLength,
			halfLength: railLength / 2,
			radius: math.max(railRadius, 0.2),
		};
	}

	/**
	 * Melakukan deteksi raycast/spherecast ke bawah saat berada di udara untuk mengunci ke atas GrindRail.
	 * Menggunakan Spherecast dengan radius 1.8 studs untuk jangkauan lateral yang sensitif dan responsif.
	 */
	private checkRailGrindDetection(): void {
		if (this.activeGrind) return;

		const rootPart = this.getRootPart();
		if (!rootPart) return;

		// 1. Wajib ada cooldown minimal 0.25s sejak lepas rel agar tidak re-snap di udara
		if (os.clock() - this.lastGrindExitTime < 0.25) return;

		// 2. Hanya abaikan jika sedang melesat naik kencang saat lepas landas (takeoff)
		// Toleransi hingga velocity Y <= 3.5 studs/s agar di dekat puncak lompatan (apex) langsung mengunci responsif
		if (rootPart.AssemblyLinearVelocity.Y > 3.5) return;

		const char = Players.LocalPlayer.Character;
		this.raycastParams.FilterDescendantsInstances = char ? [char] : [];
		const rayOrigin = rootPart.Position;
		const rayDirection = new Vector3(0, -SkateboardConfig.GRINDING.raycastDistance, 0);

		// Gunakan Spherecast 1.8 studs untuk area deteksi selebar dek papan (forgiving & responsif)
		let hitInstance: Instance | undefined;
		let hitPosition: Vector3 | undefined;

		const sphereResult = Workspace.Spherecast(rayOrigin, 1.8, rayDirection, this.raycastParams);
		if (sphereResult && sphereResult.Instance) {
			hitInstance = sphereResult.Instance;
			hitPosition = sphereResult.Position;
		} else {
			const rayResult = Workspace.Raycast(rayOrigin, rayDirection, this.raycastParams);
			if (rayResult && rayResult.Instance) {
				hitInstance = rayResult.Instance;
				hitPosition = rayResult.Position;
			}
		}

		if (!hitInstance || !hitPosition) return;

		let railPart: BasePart | undefined;
		if (hitInstance.IsA("BasePart") && CollectionService.HasTag(hitInstance, SkateboardConfig.GRINDING.tag)) {
			railPart = hitInstance;
		} else {
			let current: Instance | undefined = hitInstance.Parent;
			while (current && current !== Workspace) {
				if (CollectionService.HasTag(current, SkateboardConfig.GRINDING.tag)) {
					if (current.IsA("BasePart")) {
						railPart = current;
					} else if (hitInstance.IsA("BasePart")) {
						railPart = hitInstance;
					}
					break;
				}
				current = current.Parent;
			}
		}

		if (railPart) {
			// Abaikan part rel yang baru saja ditinggalkan selama 0.4 detik
			if (railPart === this.lastGrindedRail && os.clock() - this.lastGrindExitTime < 0.4) {
				return;
			}
			this.startGrind(railPart, hitPosition);
		}
	}

	/**
	 * Mengunci karakter dan papan ke atas rel, menentukan arah serta gaya grind (50-50 vs Boardslide).
	 * Mengatur kestabilan Humanoid agar tidak tersandung (tripping) atau masuk status ragdoll.
	 */
	private startGrind(railPart: BasePart, hitPosition: Vector3): void {
		const geom = this.getRailGeometry(railPart);
		if (!geom) return;

		const rootPart = this.getRootPart();
		const char = Players.LocalPlayer.Character;
		const humanoid = char?.FindFirstChildOfClass("Humanoid");
		if (!rootPart || !humanoid) return;

		const toHit = hitPosition.sub(geom.origin);
		const initialT = math.clamp(toHit.Dot(geom.direction), -geom.halfLength, geom.halfLength);

		const velocity = rootPart.AssemblyLinearVelocity;
		const velDot = velocity.Dot(geom.direction);
		let dir = velDot >= 0 ? 1 : -1;
		if (math.abs(velDot) < 2) {
			const lookDot = rootPart.CFrame.LookVector.Dot(geom.direction);
			dir = lookDot >= 0 ? 1 : -1;
		}

		const lookAlignment = math.abs(rootPart.CFrame.LookVector.Dot(geom.direction));
		const grindType: SkateboardGrindType =
			lookAlignment >= SkateboardConfig.GRINDING.boardslideAngleThreshold ? "50-50" : "Boardslide";

		const currentSpeedAbs = math.max(math.abs(this.currentSpeed), math.abs(velDot));
		this.currentSpeed = math.max(currentSpeedAbs, SkateboardConfig.GRINDING.minGrindSpeed);

		this.activeGrind = {
			railPart,
			railOrigin: geom.origin,
			railDirection: geom.direction,
			railHalfLength: geom.halfLength,
			railRadius: geom.radius,
			direction: dir,
			currentDistance: initialT,
			grindType,
		};

		this.currentState = "Grinding";
		this.isPerformingTrick = false;
		this.queuedTrick = undefined;

		// Proteksi Kestabilan Humanoid: Mencegah tripping, ragdoll, atau platform standing
		humanoid.PlatformStand = false;
		humanoid.AutoRotate = false;
		humanoid.SetStateEnabled(Enum.HumanoidStateType.FallingDown, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.Ragdoll, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.GettingUp, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.Freefall, false);
		humanoid.ChangeState(Enum.HumanoidStateType.Physics);

		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.inAir, 0.1);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.ollie, 0.05);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.crouch, 0.05);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.fakieCrouch, 0.05);

		const grindPose = SkateboardConfig.ANIMATIONS.idle;
		this.animService.playAnimation(grindPose, Enum.AnimationPriority.Action, true, 0.1);

		this.audioService.startGrind();
	}

	/**
	 * Memperbarui fisika meluncur di atas rel (translasi t, slope dynamics, penguncian lateral).
	 */
	private updateGrindPhysics(dt: number): void {
		if (!this.activeGrind) return;

		const rootPart = this.getRootPart();
		const char = Players.LocalPlayer.Character;
		const humanoid = char?.FindFirstChildOfClass("Humanoid");
		if (!rootPart || !humanoid || humanoid.Health <= 0) {
			this.exitGrind("Manual");
			return;
		}

		const grind = this.activeGrind;

		if (!grind.railPart || !grind.railPart.IsDescendantOf(Workspace)) {
			this.exitGrind("OffEdge");
			return;
		}

		grind.railOrigin = grind.railPart.Position;

		// 1. Slope dynamics: rel miring memberi akselerasi saat menurun dan deselerasi saat menanjak
		const slope = grind.railDirection.Y * grind.direction;
		const grav = Workspace.Gravity > 0 ? Workspace.Gravity : 196.2;

		if (slope < -0.02) {
			const downhillAccel = math.abs(slope) * grav * SkateboardConfig.GRINDING.slopeBoost * dt;
			this.currentSpeed = math.min(this.currentSpeed + downhillAccel, SkateboardConfig.PHYSICS.maxSpeed * 1.4);
		} else if (slope > 0.02) {
			const uphillDecel = slope * grav * 0.8 * dt;
			this.currentSpeed = math.max(0, this.currentSpeed - uphillDecel);
		}

		// 2. Hambatan gesek rel alami
		this.currentSpeed = math.max(0, this.currentSpeed - SkateboardConfig.GRINDING.friction * dt);

		if (this.currentSpeed < 1.0) {
			this.exitGrind("OffEdge");
			return;
		}

		// 3. Geser posisi parameter t
		grind.currentDistance += grind.direction * this.currentSpeed * dt;

		// 4. Periksa batas rel (mencapai ujung rel -> off edge)
		if (math.abs(grind.currentDistance) >= grind.railHalfLength) {
			this.exitGrind("OffEdge");
			return;
		}

		// 5. Kunci posisi lateral dan ketinggian pas di atas permukaan rel
		const centerLinePos = grind.railOrigin.add(grind.railDirection.mul(grind.currentDistance));
		const moveVec = grind.railDirection.mul(grind.direction);

		// Hitung vektor upward tegak lurus sumbu rel (normal permukaan atas rel)
		const sideVec = moveVec.Cross(Vector3.yAxis);
		let trueRailUp = Vector3.yAxis;
		if (sideVec.Magnitude > 0.001) {
			trueRailUp = sideVec.Unit.Cross(moveVec.Unit);
			if (trueRailUp.Y < 0) {
				trueRailUp = trueRailUp.mul(-1);
			}
		}

		const railTopPos = centerLinePos.add(trueRailUp.mul(grind.railRadius));
		const currentOffset =
			grind.grindType === "Boardslide"
				? SkateboardConfig.GRINDING.boardslideHeightOffset
				: SkateboardConfig.GRINDING.grindHeightOffset;

		const targetPosition = railTopPos.add(trueRailUp.mul(currentOffset));
		let targetCFrame = CFrame.lookAt(targetPosition, targetPosition.add(moveVec), trueRailUp);

		if (grind.grindType === "Boardslide") {
			targetCFrame = targetCFrame.mul(CFrame.Angles(0, math.rad(90), 0));
		}

		rootPart.CFrame = targetCFrame;

		const grindVel = moveVec.mul(this.currentSpeed);
		rootPart.AssemblyLinearVelocity = grindVel;
		humanoid.WalkSpeed = 0;
		humanoid.Move(Vector3.zero, false);

		const boardJoint = this.getBoardMotor();
		if (boardJoint) {
			boardJoint.C0 = SkateboardConfig.ATTACHMENT.boardCFrameOffset;
		}

		this.audioService.updateGrind(this.currentSpeed, SkateboardConfig.PHYSICS.maxSpeed, dt);
	}

	/**
	 * Keluar dari rail grinding (mencapai ujung rel, Ollie pop-off, atau manual dismount).
	 * Mengembalikan status normal Humanoid setelah lepas dari rel.
	 */
	private exitGrind(reason: "OffEdge" | "Ollie" | "Manual"): void {
		if (!this.activeGrind) return;

		const grind = this.activeGrind;
		const rootPart = this.getRootPart();
		const char = Players.LocalPlayer.Character;
		const humanoid = char?.FindFirstChildOfClass("Humanoid");

		this.lastGrindExitTime = os.clock();
		this.lastGrindedRail = grind.railPart;
		this.activeGrind = undefined;
		this.audioService.stopGrind();

		// Pulihkan status normal Humanoid (tetap AutoRotate = false selama mounted!)
		if (humanoid) {
			humanoid.PlatformStand = false;
			humanoid.AutoRotate = false;
			humanoid.SetStateEnabled(Enum.HumanoidStateType.FallingDown, true);
			humanoid.SetStateEnabled(Enum.HumanoidStateType.Ragdoll, true);
			humanoid.SetStateEnabled(Enum.HumanoidStateType.GettingUp, true);
			humanoid.SetStateEnabled(Enum.HumanoidStateType.Freefall, true);
			humanoid.ChangeState(Enum.HumanoidStateType.Freefall);
		}

		if (reason === "OffEdge") {
			if (rootPart) {
				const moveVector = grind.railDirection.mul(grind.direction);
				const forwardSpeed = math.max(this.currentSpeed, SkateboardConfig.GRINDING.minGrindSpeed * 0.8);
				const airHorizontal = moveVector.mul(forwardSpeed);
				rootPart.AssemblyLinearVelocity = new Vector3(airHorizontal.X, 3.5, airHorizontal.Z);
			}
			this.currentState = "InAir";
			this.timeInAir = 0.15;
			this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.idle, 0.05);
			this.animService.playAnimation(SkateboardConfig.ANIMATIONS.inAir, Enum.AnimationPriority.Action, true, 0.1);
		} else if (reason === "Ollie") {
			this.executeGrindOllie(grind);
		} else {
			this.currentState = "InAir";
			this.timeInAir = 0;
			this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.idle, 0.05);
		}
	}

	/**
	 * Melakukan Ollie pop-off keluar dari rail dengan tambahan impuls vertikal.
	 */
	private executeGrindOllie(grind: SkateboardGrindData): void {
		this.lastJumpTime = os.clock();
		this.stopTurnAnims(0.05);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.idle, 0.05);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.crouch, 0.05);
		this.animService.stopAnimation(SkateboardConfig.ANIMATIONS.inAir, 0.05);

		const grav = Workspace.Gravity > 0 ? Workspace.Gravity : 196.2;
		const baseJumpVel = math.sqrt(2 * grav * SkateboardConfig.PHYSICS.ollieMinHeight);
		const totalJumpVel = baseJumpVel + SkateboardConfig.GRINDING.popOffImpulse;

		const rootPart = this.getRootPart();
		if (rootPart) {
			const moveVector = grind.railDirection.mul(grind.direction);
			const forwardSpeed = math.max(this.currentSpeed, SkateboardConfig.GRINDING.minGrindSpeed);
			const airHorizontal = moveVector.mul(forwardSpeed);
			rootPart.AssemblyLinearVelocity = new Vector3(airHorizontal.X, totalJumpVel, airHorizontal.Z);
		}

		this.currentState = "InAir";
		this.audioService.playPop();

		const expectedAirTime = (2 * totalJumpVel) / grav;
		this.currentExpectedAirTime = expectedAirTime;
		const animSpeed = math.clamp(0.466 / expectedAirTime, 0.8, 1.3);

		this.trickEvent.FireServer({ trickName: "Ollie", duration: expectedAirTime });
		this.startBoardTrick("Ollie", expectedAirTime);

		this.animService.playAnimation("Ollie", Enum.AnimationPriority.Action2, false, 0.05, animSpeed);
	}
}
