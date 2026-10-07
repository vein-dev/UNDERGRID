import {
	ContentProvider,
	ContextActionService,
	Debris,
	Players,
	ReplicatedStorage,
	RunService,
	TweenService,
	UserInputService,
	Workspace,
} from "@rbxts/services";
import { AvatarContextMenuView } from "client/ui/views/AvatarContextMenuView";
import { CombatHudView } from "client/ui/views/CombatHudView";
import { DuelService } from "../services/DuelService";
import { getRemoteEvent } from "shared/network";
import { ARCZIS_COMBAT_CONFIG } from "shared/types";
import { MovementConfig } from "shared/config/MovementConfig";
import { GetIconUri } from "shared/utils";

/**
 * CombatController - Client combat controller implementing the Arczis combat system.
 * Keybinds:
 * - LMB: Punch / Combo M1
 * - RMB: Push / Heavy Punch
 * - E: Block / Guard
 * - Q: Dash / Dodge
 * - Left Shift: Sprint
 * - Space: Clash Duel Mash
 */
export class CombatController {
	private static instance?: CombatController;
	private player = Players.LocalPlayer;

	// Enemy / Avatar Lock references
	private currentLockTarget?: Model;
	private lockReticleGui?: BillboardGui;
	private lockReticleImage?: ImageLabel;

	// Character references
	private character?: Model;
	private humanoid?: Humanoid;
	private humanoidRootPart?: BasePart;
	private animator?: Animator;

	// R6 Motor6D joints cache for guaranteed procedural animation fallback
	private rightShoulder?: Motor6D;
	private leftShoulder?: Motor6D;
	private rootJoint?: Motor6D;
	private neck?: Motor6D;
	private defaultRightShoulderC0?: CFrame;
	private defaultLeftShoulderC0?: CFrame;
	private defaultRootJointC0?: CFrame;
	private defaultNeckC0?: CFrame;
	private isProceduralPunching = false;
	private isProceduralBlocking = false;

	// Animation tracks map
	private animTracks = new Map<string, AnimationTrack>();

	// States (Combat is active ONLY when holding Fists tool)
	private isEquipped = false;
	private isBlocking = false;
	private isStunned = false;
	private isGuardBroken = false;
	private isAttacking = false;
	private canBlockWhileStunned = false;
	private isInClash = false;
	private isInClashWinAnimation = false;
	private isSprinting = false;
	private isDashing = false;
	private isTargetLocked = false;
	private isPaused = false;

	private lastM1Time = 0;
	private lastHeavyTime = 0;
	private lastDashTime = 0;
	private comboIndex = 1;

	private currentClashId?: string;
	private clashOpponentUserId?: number;

	// Combat HUD (Stamina & Clash UI)
	private combatHud = CombatHudView.getInstance();

	// Debug HUD
	private debugGui?: ScreenGui;
	private debugLabel?: TextLabel;
	private lastActionDebug = "Pegang Fists untuk bertarung";

	// Remotes
	private combatEvent!: RemoteEvent;
	private blockEvent!: RemoteEvent;
	private clashEvent!: RemoteEvent;
	private hitReactionEvent!: RemoteEvent;
	private soundEvent!: RemoteEvent;

	// Connections
	private connections: RBXScriptConnection[] = [];
	private toolAnimConnections: RBXScriptConnection[] = [];

	private constructor() {}

	public static getInstance(): CombatController {
		if (!CombatController.instance) {
			CombatController.instance = new CombatController();
		}
		return CombatController.instance;
	}

	public isCombatActive(): boolean {
		return this.isEquipped && !this.isPaused;
	}

	public init(): void {
		// Fetch Remotes
		this.combatEvent = getRemoteEvent("CombatEvent");
		this.blockEvent = getRemoteEvent("BlockEvent");
		this.clashEvent = getRemoteEvent("ClashEvent");
		this.hitReactionEvent = getRemoteEvent("HitReactionEvent");
		this.soundEvent = getRemoteEvent("SoundEvent");

		// Setup character handling
		this.player.CharacterAdded.Connect((char) => this.onCharacterAdded(char));
		if (this.player.Character) {
			this.onCharacterAdded(this.player.Character);
		}

		// Sound event listener (from SoundHandler.luau)
		this.soundEvent.OnClientEvent.Connect((eventType: unknown, ...args: unknown[]) => {
			if (eventType === "PlaySound") {
				const [pos, soundId, vol] = args as [Vector3, string, number?];
				this.playSpatialSound(pos, soundId, vol);
			}
		});

		// Server response listeners
		this.setupRemoteListeners();

		// Auto-bind tool equip/unequip events
		this.setupCombatToolWatcher();

		// Mobile Virtual Buttons Callback Setup
		this.combatHud.setCallbacks({
			onM1: () => {
				if (this.isEquipped && !this.isInClash && !this.isInClashWinAnimation) {
					this.doM1();
				}
			},
			onHeavy: () => {
				if (this.isEquipped && !this.isInClash && !this.isInClashWinAnimation) {
					this.doHeavy();
				}
			},
			onBlockStart: () => {
				if (this.isEquipped && !this.isInClash && !this.isInClashWinAnimation) {
					this.startBlock();
				}
			},
			onBlockEnd: () => {
				if (this.isEquipped) {
					this.stopBlock();
				}
			},
			onDash: () => {
				if (this.isEquipped && !this.isInClash && !this.isInClashWinAnimation) {
					this.doDash();
				}
			},
			onSprintToggle: () => {
				if (this.isEquipped) {
					this.setSprint(!this.isSprinting);
				}
			},
			onClashMash: () => {
				if (this.isEquipped && this.isInClash && this.currentClashId) {
					this.clashEvent.FireServer("ButtonPress", this.currentClashId);
				}
			},
			onTargetLockToggle: () => {
				if (this.isEquipped && !this.isInClash && !this.isInClashWinAnimation) {
					this.toggleTargetLock();
				}
			},
		});

		// Dynamic mobile touch detection
		this.combatHud.setMobile(UserInputService.TouchEnabled);
		UserInputService.LastInputTypeChanged.Connect(() => {
			this.combatHud.setMobile(UserInputService.TouchEnabled);
		});

		// PERMANENT INPUT LISTENERS - Connected once and always listening!
		UserInputService.InputBegan.Connect((input, processed) => this.onInputBegan(input, processed));
		UserInputService.InputEnded.Connect((input, processed) => this.onInputEnded(input, processed));
		RunService.RenderStepped.Connect(() => {
			if (this.isEquipped && !this.isPaused) {
				const isTouchDevice = UserInputService.TouchEnabled && !UserInputService.KeyboardEnabled;

				// Di mobile: Jangan pernah paksa mouse terkunci ke tengah agar sentuhan layar leluasa
				if (isTouchDevice) {
					if (UserInputService.MouseBehavior !== Enum.MouseBehavior.Default) {
						UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
					}
					UserInputService.MouseIconEnabled = true;
				}

				let target = this.isTargetLocked ? this.currentLockTarget : undefined;

				// Validasi target aktif saat sistem lock sedang dinyalakan
				if (this.isTargetLocked) {
					if (!target || !target.Parent) {
						target = this.getLockTarget();
						this.currentLockTarget = target;
						if (!target) {
							this.isTargetLocked = false;
							this.combatHud.setTargetLocked(false);
						}
					} else {
						const targetHum = target.FindFirstChildOfClass("Humanoid");
						const targetHrp = target.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
						const myPos = this.humanoidRootPart?.Position;
						if (
							!targetHum ||
							targetHum.Health <= 0 ||
							!targetHrp ||
							(myPos && targetHrp.Position.sub(myPos).Magnitude > 55)
						) {
							// Target mati atau terlalu jauh (> 55 studs), auto-unlock atau cari target terdekat lain
							const nextTarget = this.getLockTarget();
							if (nextTarget && nextTarget !== target) {
								target = nextTarget;
								this.currentLockTarget = nextTarget;
							} else {
								target = undefined;
								this.isTargetLocked = false;
								this.currentLockTarget = undefined;
								this.combatHud.setTargetLocked(false);
							}
						}
					}
				}

				this.updateLockReticle(target);

				if (this.humanoidRootPart && this.humanoid && this.humanoid.Health > 0) {
					if (target && this.isTargetLocked) {
						// ─── TARGET LOCK-ON (DUELING GROUNDS STYLE) ───
						const targetHrp = target.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
						if (targetHrp) {
							const myPos = this.humanoidRootPart.Position;
							const toTarget = new Vector3(
								targetHrp.Position.X - myPos.X,
								0,
								targetHrp.Position.Z - myPos.Z,
							);

							// 1. Karakter selalu menghadap lurus ke musuh (Orientasi presisi untuk strafe & dodge)
							if (toTarget.Magnitude > 0.4) {
								const targetRot = CFrame.lookAt(myPos, myPos.add(toTarget));
								this.humanoidRootPart.CFrame = this.humanoidRootPart.CFrame.Lerp(targetRot, 0.22);
							}

							// 2. Kamera mengunci musuh di tengah layar (Dueling Grounds Lock Camera)
							const camera = Workspace.CurrentCamera;
							if (camera) {
								const camPos = camera.CFrame.Position;
								const focusPoint = targetHrp.Position.add(new Vector3(0, 1.3, 0));
								const desiredCamRot = CFrame.lookAt(camPos, focusPoint);
								camera.CFrame = camera.CFrame.Lerp(desiredCamRot, isTouchDevice ? 0.10 : 0.15);
							}
						}
					} else {
						// ─── FREE CAMERA MODE (NON-LOCK) ───
						// Karakter berputar menghadap arah horizontal kamera hanya jika sedang berjalan
						const camera = Workspace.CurrentCamera;
						if (camera && this.humanoid.MoveDirection.Magnitude > 0.05) {
							const [, yaw] = camera.CFrame.ToOrientation();
							const currentPos = this.humanoidRootPart.Position;
							const camRot = new CFrame(currentPos).mul(CFrame.Angles(0, yaw, 0));
							this.humanoidRootPart.CFrame = this.humanoidRootPart.CFrame.Lerp(camRot, 0.18);
						}
					}
				}
			} else {
				this.updateLockReticle(undefined);
			}
			this.updateMovement();
		});

		this.studioPrint("[CombatController] Initialized successfully with Arczis system bindings & procedural fallback.");
	}

	private studioPrint(...args: unknown[]): void {
		if (RunService.IsStudio()) {
			print(...args);
		}
	}

	private studioWarn(...args: unknown[]): void {
		if (RunService.IsStudio()) {
			warn(...args);
		}
	}

	// ═══════════════════════════════════════════════════════
	// CHARACTER SETUP
	// ═══════════════════════════════════════════════════════

	private onCharacterAdded(char: Model): void {
		this.character = char;
		this.humanoid = char.WaitForChild("Humanoid") as Humanoid;
		this.humanoidRootPart =
			(char.WaitForChild("HumanoidRootPart", 5) as BasePart | undefined) ??
			(char.FindFirstChild("HumanoidRootPart") as BasePart | undefined);
		this.animator =
			this.humanoid.FindFirstChildOfClass("Animator") ??
			(this.humanoid.WaitForChild("Animator", 5) as Animator | undefined);

		// Cache R6 Motor6D joints
		const torso = char.WaitForChild("Torso", 3) as BasePart | undefined;
		if (torso) {
			this.rightShoulder = torso.FindFirstChild("Right Shoulder") as Motor6D | undefined;
			this.leftShoulder = torso.FindFirstChild("Left Shoulder") as Motor6D | undefined;
			this.neck = torso.FindFirstChild("Neck") as Motor6D | undefined;
		}
		if (this.humanoidRootPart) {
			this.rootJoint = this.humanoidRootPart.FindFirstChild("RootJoint") as Motor6D | undefined;
		}

		if (this.rightShoulder) this.defaultRightShoulderC0 = this.rightShoulder.C0;
		if (this.leftShoulder) this.defaultLeftShoulderC0 = this.leftShoulder.C0;
		if (this.rootJoint) this.defaultRootJointC0 = this.rootJoint.C0;
		if (this.neck) this.defaultNeckC0 = this.neck.C0;

		this.setupCombatBars(char);
		this.createDebugHUD();
		this.loadAllAnimations();

		// Combat is inactive until Fists tool is held
		this.isEquipped = false;
		this.isBlocking = false;
		this.isAttacking = false;
		this.isStunned = false;
		this.isGuardBroken = false;
		this.isInClash = false;
		this.isInClashWinAnimation = false;
		this.isSprinting = false;
		this.unbindClashSpace();
		this.combatHud.setCombatStates(false, false);

		if (this.humanoid) {
			this.humanoid.AutoRotate = true;
			this.humanoid.CameraOffset = new Vector3(0, 0, 0);
			this.humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, true);
			this.humanoid.UseJumpPower = true;
			this.humanoid.JumpPower = MovementConfig.JUMP.jumpPower;

			this.humanoid.GetPropertyChangedSignal("Jump").Connect(() => {
				if (this.isEquipped && this.humanoid && this.humanoid.Jump) {
					this.humanoid.Jump = false;
				}
			});

			this.humanoid.Died.Connect(() => {
				this.onUnequipped();
			});
		}
		UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
		UserInputService.MouseIconEnabled = true;
		this.setCombatCamera(false);

		this.watchCharacterValues();

		this.combatHud.setVisible(false);
		this.destroyClashUI();

		const isCombatTool = (name: string) => {
			const lower = name.lower();
			return lower === "fists" || lower === "fist" || lower === "combatgloves" || lower.find("fist")[0] !== undefined;
		};

		// Check if Fists tool is already equipped
		const currentTool = char.FindFirstChildOfClass("Tool");
		if (currentTool && isCombatTool(currentTool.Name)) {
			this.onEquipped();
		} else {
			this.isEquipped = false;
			this.combatHud.setVisible(false);
			this.updateDebugHUD();
		}
	}

	private createDebugHUD(): void {
		const playerGui = this.player.FindFirstChild("PlayerGui") as PlayerGui | undefined;
		const debugGui = playerGui?.FindFirstChild("CombatDebugHUD");
		if (debugGui) debugGui.Destroy();
		if (this.debugGui) {
			this.debugGui.Destroy();
			this.debugGui = undefined;
		}
		this.debugLabel = undefined;
	}

	private updateDebugHUD(): void {}

	private setupCombatToolWatcher(): void {
		const isCombatTool = (name: string) => {
			const lower = name.lower();
			return lower === "fists" || lower === "fist" || lower === "combatgloves" || lower.find("fist")[0] !== undefined;
		};

		const handleToolAdded = (tool: Tool) => {
			if (isCombatTool(tool.Name)) {
				this.onEquipped();
			} else if (this.isEquipped) {
				this.onUnequipped();
			}
		};

		const handleToolRemoved = (tool: Tool) => {
			if (isCombatTool(tool.Name)) {
				this.onUnequipped();
			}
		};

		const watchCharacter = (char: Model) => {
			char.ChildAdded.Connect((c) => {
				if (c.IsA("Tool")) handleToolAdded(c);
			});
			char.ChildRemoved.Connect((c) => {
				if (c.IsA("Tool")) handleToolRemoved(c);
			});
			for (const c of char.GetChildren()) {
				if (c.IsA("Tool")) handleToolAdded(c);
			}
		};

		this.player.CharacterAdded.Connect(watchCharacter);
		if (this.player.Character) {
			watchCharacter(this.player.Character);
		}
	}

	// ═══════════════════════════════════════════════════════
	// TOOL ANIMATION SUPPRESSION (toolnone / slash)
	// ═══════════════════════════════════════════════════════

	private suppressToolNoneAnimations(): void {
		this.cleanToolNoneListeners();
		if (!this.humanoid) return;

		for (const track of this.humanoid.GetPlayingAnimationTracks()) {
			const name = track.Name.lower();
			const animName = track.Animation?.Name.lower() ?? "";
			if (
				name.find("toolnone")[0] !== undefined ||
				animName.find("toolnone")[0] !== undefined ||
				name.find("slash")[0] !== undefined ||
				animName.find("slash")[0] !== undefined
			) {
				track.Stop(0);
			}
		}

		this.toolAnimConnections.push(
			this.humanoid.AnimationPlayed.Connect((track) => {
				const name = track.Name.lower();
				const animName = track.Animation?.Name.lower() ?? "";
				if (
					name.find("toolnone")[0] !== undefined ||
					animName.find("toolnone")[0] !== undefined ||
					name.find("slash")[0] !== undefined ||
					animName.find("slash")[0] !== undefined
				) {
					track.Stop(0);
				}
			}),
		);
	}

	private cleanToolNoneListeners(): void {
		for (const conn of this.toolAnimConnections) {
			conn.Disconnect();
		}
		this.toolAnimConnections = [];
	}

	// ═══════════════════════════════════════════════════════
	// PROCEDURAL R6 JOINT ANIMATION FALLBACK
	// ═══════════════════════════════════════════════════════

	public isTrackUsable(name: string): boolean {
		const track = this.animTracks.get(name);
		return track !== undefined;
	}

	private playProceduralM1(combo: number): void {
		if (!this.rightShoulder || !this.leftShoulder || !this.defaultRightShoulderC0 || !this.defaultLeftShoulderC0) return;
		this.isProceduralPunching = true;

		if (combo === 1) {
			// Right jab: swing forward
			const targetC0 = this.defaultRightShoulderC0.mul(
				CFrame.Angles(math.rad(85), math.rad(10), math.rad(25)),
			);
			const tweenOut = TweenService.Create(
				this.rightShoulder,
				new TweenInfo(0.08, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ C0: targetC0 },
			);
			tweenOut.Play();
			task.delay(0.09, () => {
				if (this.rightShoulder && this.defaultRightShoulderC0) {
					const tweenIn = TweenService.Create(
						this.rightShoulder,
						new TweenInfo(0.14, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
						{ C0: this.defaultRightShoulderC0 },
					);
					tweenIn.Play();
					tweenIn.Completed.Connect(() => {
						this.isProceduralPunching = false;
					});
				}
			});
		} else {
			// Left straight punch
			const targetC0 = this.defaultLeftShoulderC0.mul(
				CFrame.Angles(math.rad(85), math.rad(-10), math.rad(-25)),
			);
			const tweenOut = TweenService.Create(
				this.leftShoulder,
				new TweenInfo(0.08, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ C0: targetC0 },
			);
			tweenOut.Play();
			task.delay(0.09, () => {
				if (this.leftShoulder && this.defaultLeftShoulderC0) {
					const tweenIn = TweenService.Create(
						this.leftShoulder,
						new TweenInfo(0.14, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
						{ C0: this.defaultLeftShoulderC0 },
					);
					tweenIn.Play();
					tweenIn.Completed.Connect(() => {
						this.isProceduralPunching = false;
					});
				}
			});
		}
	}

	private playProceduralHeavy(): void {
		if (!this.rightShoulder || !this.leftShoulder || !this.defaultRightShoulderC0 || !this.defaultLeftShoulderC0) return;
		this.isProceduralPunching = true;

		// Both arms punch forward with torso lunge
		const rightTarget = this.defaultRightShoulderC0.mul(
			CFrame.Angles(math.rad(95), math.rad(20), math.rad(15)),
		);
		const leftTarget = this.defaultLeftShoulderC0.mul(
			CFrame.Angles(math.rad(95), math.rad(-20), math.rad(-15)),
		);

		TweenService.Create(
			this.rightShoulder,
			new TweenInfo(0.12, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
			{ C0: rightTarget },
		).Play();
		TweenService.Create(
			this.leftShoulder,
			new TweenInfo(0.12, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
			{ C0: leftTarget },
		).Play();

		if (this.rootJoint && this.defaultRootJointC0) {
			TweenService.Create(
				this.rootJoint,
				new TweenInfo(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ C0: this.defaultRootJointC0.mul(CFrame.Angles(math.rad(15), 0, 0)) },
			).Play();
		}

		task.delay(0.25, () => {
			if (this.rightShoulder && this.defaultRightShoulderC0) {
				TweenService.Create(
					this.rightShoulder,
					new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
					{ C0: this.defaultRightShoulderC0 },
				).Play();
			}
			if (this.leftShoulder && this.defaultLeftShoulderC0) {
				TweenService.Create(
					this.leftShoulder,
					new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
					{ C0: this.defaultLeftShoulderC0 },
				).Play();
			}
			if (this.rootJoint && this.defaultRootJointC0) {
				const tr = TweenService.Create(
					this.rootJoint,
					new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
					{ C0: this.defaultRootJointC0 },
				);
				tr.Play();
				tr.Completed.Connect(() => {
					this.isProceduralPunching = false;
				});
			}
		});
	}

	private setProceduralBlock(active: boolean): void {
		if (!this.rightShoulder || !this.leftShoulder || !this.defaultRightShoulderC0 || !this.defaultLeftShoulderC0) return;
		this.isProceduralBlocking = active;

		if (active) {
			// Cross arms in front of chest (Guard pose)
			const rightTarget = this.defaultRightShoulderC0.mul(
				CFrame.Angles(math.rad(70), math.rad(-20), math.rad(-45)),
			);
			const leftTarget = this.defaultLeftShoulderC0.mul(
				CFrame.Angles(math.rad(70), math.rad(20), math.rad(45)),
			);
			TweenService.Create(
				this.rightShoulder,
				new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ C0: rightTarget },
			).Play();
			TweenService.Create(
				this.leftShoulder,
				new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ C0: leftTarget },
			).Play();
		} else {
			// Return to default pose
			TweenService.Create(
				this.rightShoulder,
				new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{ C0: this.defaultRightShoulderC0 },
			).Play();
			TweenService.Create(
				this.leftShoulder,
				new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{ C0: this.defaultLeftShoulderC0 },
			).Play();
		}
	}

	private playLocalSound(soundId: string | string[], volume?: number): void {
		if (!soundId) return;
		let finalId = soundId;
		if (typeIs(soundId, "table") && (soundId as string[]).size() > 0) {
			const arr = soundId as string[];
			finalId = arr[math.random(0, arr.size() - 1)];
		}
		if (typeIs(finalId, "string") && finalId !== "" && !finalId.find("YOUR_")[0]) {
			const sound = new Instance("Sound");
			sound.SoundId = finalId;
			sound.Volume = volume ?? ARCZIS_COMBAT_CONFIG.SoundVolume;
			sound.Parent = this.humanoidRootPart ?? Workspace;
			sound.Play();
			Debris.AddItem(sound, 3);
		}
	}

	public onEquipped(): void {
		if (this.isEquipped) return;
		this.isEquipped = true;
		this.lastActionDebug = "Fists Dipegang: Combat Aktif";
		this.combatEvent.FireServer("Equip", true);

		// Tandai karakter dan HRP dengan atribut IsFighting agar MovementController tidak bentrok
		if (this.character) {
			this.character.SetAttribute("IsFighting", true);
		}
		if (this.humanoidRootPart) {
			this.humanoidRootPart.SetAttribute("IsFighting", true);
		}

		// Pengaturan Kamera & Humanoid saat bertarung
		if (this.humanoid) {
			this.humanoid.AutoRotate = false;
			this.humanoid.CameraOffset = new Vector3(0, 0.5, 0);
			// Disable Jump while in fight mode
			this.humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, false);
			this.humanoid.JumpPower = 0;
			this.humanoid.JumpHeight = 0;
		}
		UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
		UserInputService.MouseIconEnabled = true;
		this.setCombatCamera(false);

		// Tutup Avatar Context Menu jika sedang terbuka saat masuk fight mode
		AvatarContextMenuView.getInstance().hide();

		// Hentikan animasi tool bawaan Roblox (toolnone / slash)
		this.suppressToolNoneAnimations();

		this.combatHud.setVisible(true);
		this.combatHud.setCombatStates(this.isBlocking, this.isSprinting);

		this.updateDebugHUD();

		// Play equip animation & sound
		this.updateWalkSpeed();
		const equipTrack = this.animTracks.get("Equip");
		if (equipTrack && this.isTrackUsable("Equip")) {
			equipTrack.Play(0.1);
			this.playLocalSound(ARCZIS_COMBAT_CONFIG.Sounds.Equip);
			task.delay(math.max(0.3, equipTrack.Length * 0.7), () => {
				if (
					this.isEquipped &&
					!this.isGuardBroken &&
					!this.isInClash &&
					!this.isStunned
				) {
					this.updateMovement();
				}
			});
		} else {
			this.updateMovement();
		}
	}

	public onUnequipped(): void {
		if (!this.isEquipped) return;
		this.isEquipped = false;
		this.lastActionDebug = "Fists Dilepas: Combat Nonaktif";
		this.combatEvent.FireServer("Equip", false);
		this.blockEvent.FireServer(false);

		// Hapus atribut IsFighting
		if (this.character) {
			this.character.SetAttribute("IsFighting", false);
		}
		if (this.humanoidRootPart) {
			this.humanoidRootPart.SetAttribute("IsFighting", false);
		}

		this.cleanToolNoneListeners();

		// Pulihkan ShiftLock, Cursor, Jump & normal WalkSpeed & Health penuh
		if (this.humanoid) {
			this.humanoid.AutoRotate = true;
			this.humanoid.CameraOffset = new Vector3(0, 0, 0);
			this.humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, true);
			this.humanoid.UseJumpPower = true;
			this.humanoid.JumpPower = MovementConfig.JUMP.jumpPower;
			this.humanoid.WalkSpeed = MovementConfig.CROUCH.normalSpeed;
			this.humanoid.Health = this.humanoid.MaxHealth;
		}

		const staminaVal = this.character?.FindFirstChild("Stamina") as NumberValue | undefined;
		if (staminaVal) {
			staminaVal.Value = ARCZIS_COMBAT_CONFIG.MaxStamina;
		}

		UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
		UserInputService.MouseIconEnabled = true;
		this.setCombatCamera(false);

		this.combatHud.setVisible(false);
		this.isBlocking = false;
		this.isAttacking = false;
		this.isSprinting = false;
		this.isDashing = false;
		this.isInClash = false;
		this.unbindClashSpace();
		this.combatHud.setCombatStates(false, false);
		this.destroyClashUI();

		this.updateDebugHUD();
		this.stopAllCombatAnims();
		this.setProceduralBlock(false);
		this.isTargetLocked = false;
		this.combatHud.setTargetLocked(false);
		this.cleanLockReticle();
	}

	public setPaused(paused: boolean): void {
		this.isPaused = paused;
		if (paused) {
			this.isBlocking = false;
			this.isAttacking = false;
			this.isSprinting = false;
			this.isDashing = false;
			this.isTargetLocked = false;
			this.combatHud.setTargetLocked(false);
			this.combatHud.setVisible(false);
			this.stopAllCombatAnims();
			this.setProceduralBlock(false);
			this.cleanToolNoneListeners();
			this.cleanLockReticle();

			// Pulihkan camera, cursor, dan mouse saat paused
			if (this.humanoid) {
				this.humanoid.AutoRotate = true;
				this.humanoid.CameraOffset = new Vector3(0, 0, 0);
				this.humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, true);
				this.humanoid.UseJumpPower = true;
				this.humanoid.JumpPower = MovementConfig.JUMP.jumpPower;
			}
			UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
			UserInputService.MouseIconEnabled = true;
			this.setCombatCamera(false);
		} else if (this.isEquipped) {
			if (this.humanoid) {
				this.humanoid.AutoRotate = false;
				this.humanoid.CameraOffset = new Vector3(0, 0.5, 0);
				this.humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, false);
				this.humanoid.JumpPower = 0;
				this.humanoid.JumpHeight = 0;
			}
			UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
			UserInputService.MouseIconEnabled = true;
			this.setCombatCamera(false);
			this.suppressToolNoneAnimations();
			this.combatHud.setVisible(true);
			this.updateMovement();
		}
	}

	/**
	 * Mengatur mode kamera kombat (Custom untuk kamera standar berorientasi Mouse Lock).
	 */
	private setCombatCamera(follow: boolean): void {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		camera.CameraType = follow ? Enum.CameraType.Follow : Enum.CameraType.Custom;
	}

	/**
	 * Mencari target lawan terbaik untuk Enemy Lock (Lawan duel aktif atau musuh/dummy terdekat).
	 */
	private getLockTarget(): Model | undefined {
		if (!this.humanoidRootPart || !this.humanoid || this.humanoid.Health <= 0) {
			return undefined;
		}

		const myPos = this.humanoidRootPart.Position;

		// 1. Prioritas Utama: Lawan Duel Aktif (dari DuelService / atribut InDuelWith)
		const activeDuel = DuelService.getInstance().getActiveDuel();
		let duelTargetPlayer: Player | undefined;

		if (activeDuel) {
			duelTargetPlayer = Players.GetPlayerByUserId(activeDuel.opponentUserId);
		} else if (this.character) {
			const inDuelWithUserId = this.character.GetAttribute("InDuelWith") as number | undefined;
			if (inDuelWithUserId) {
				duelTargetPlayer = Players.GetPlayerByUserId(inDuelWithUserId);
			}
		}

		if (duelTargetPlayer && duelTargetPlayer.Character) {
			const targetChar = duelTargetPlayer.Character;
			const targetHum = targetChar.FindFirstChildOfClass("Humanoid");
			const targetHrp = targetChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (targetHum && targetHum.Health > 0 && targetHrp) {
				return targetChar;
			}
		}

		// 2. Di Luar Duel: Cari Musuh / Dummy Terdekat (Radius <= 40 studs)
		const MAX_LOCK_RADIUS = 40;
		let closestModel: Model | undefined;
		let closestDist = MAX_LOCK_RADIUS;

		// Cari pemain terdekat
		for (const otherPlayer of Players.GetPlayers()) {
			if (otherPlayer === this.player) continue;
			const char = otherPlayer.Character;
			if (!char) continue;
			const hum = char.FindFirstChildOfClass("Humanoid");
			const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (hum && hum.Health > 0 && hrp) {
				const dist = hrp.Position.sub(myPos).Magnitude;
				if (dist < closestDist) {
					closestDist = dist;
					closestModel = char;
				}
			}
		}

		// Cari Training Dummy terdekat
		const dummyFolder = Workspace.FindFirstChild("Dummies") ?? Workspace.FindFirstChild("NPC");
		const searchContainers: Instance[] = [Workspace];
		if (dummyFolder) searchContainers.push(dummyFolder);

		for (const container of searchContainers) {
			for (const child of container.GetChildren()) {
				if (child.IsA("Model") && child !== this.character) {
					const isDummy =
						child.Name.lower().find("dummy")[0] !== undefined ||
						child.GetAttribute("DummyType") !== undefined;
					if (isDummy) {
						const hum = child.FindFirstChildOfClass("Humanoid");
						const hrp = child.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
						if (hum && hum.Health > 0 && hrp) {
							const dist = hrp.Position.sub(myPos).Magnitude;
							if (dist < closestDist) {
								closestDist = dist;
								closestModel = child;
							}
						}
					}
				}
			}
		}

		return closestModel;
	}

	/**
	 * Memperbarui posisi indikator visual reticle di atas kepala musuh yang di-lock.
	 */
	private updateLockReticle(target?: Model): void {
		if (!target) {
			if (this.lockReticleGui) {
				this.lockReticleGui.Enabled = false;
			}
			return;
		}

		const head =
			(target.FindFirstChild("Head") as BasePart | undefined) ??
			(target.FindFirstChild("HumanoidRootPart") as BasePart | undefined);
		if (!head) {
			if (this.lockReticleGui) this.lockReticleGui.Enabled = false;
			return;
		}

		if (!this.lockReticleGui) {
			const playerGui = this.player.FindFirstChildOfClass("PlayerGui");
			if (!playerGui) return;

			const bbg = new Instance("BillboardGui");
			bbg.Name = "CombatLockReticle";
			bbg.Size = new UDim2(0, 32, 0, 32);
			bbg.StudsOffset = new Vector3(0, 2.4, 0);
			bbg.AlwaysOnTop = true;
			bbg.ResetOnSpawn = false;
			bbg.Parent = playerGui;

			const img = new Instance("ImageLabel");
			img.Name = "Icon";
			img.Size = new UDim2(1, 0, 1, 0);
			img.BackgroundTransparency = 1;
			img.Image = GetIconUri("crosshair") ?? "";
			img.ImageColor3 = Color3.fromHex("#ef4444");
			img.ZIndex = 100;
			img.Parent = bbg;

			this.lockReticleGui = bbg;
			this.lockReticleImage = img;
		}

		this.lockReticleGui.Adornee = head;
		this.lockReticleGui.Enabled = true;
	}

	/**
	 * Menghapus indikator visual reticle saat pertempuran berakhir.
	 */
	private cleanLockReticle(): void {
		if (this.lockReticleGui) {
			this.lockReticleGui.Destroy();
			this.lockReticleGui = undefined;
			this.lockReticleImage = undefined;
		}
	}

	/**
	 * Toggle Target Lock-On (Dueling Grounds Style via tombol T atau Mobile Button).
	 */
	public toggleTargetLock(): void {
		if (!this.isEquipped) return;

		if (this.isTargetLocked) {
			this.isTargetLocked = false;
			this.currentLockTarget = undefined;
			this.updateLockReticle(undefined);
			this.combatHud.setTargetLocked(false);
			this.lastActionDebug = "Target Lock: OFF (Free Camera)";
			this.updateDebugHUD();
		} else {
			const target = this.getLockTarget();
			if (target) {
				this.isTargetLocked = true;
				this.currentLockTarget = target;
				this.updateLockReticle(target);
				this.combatHud.setTargetLocked(true);
				this.lastActionDebug = `Target Lock: ON (${target.Name})`;
				this.updateDebugHUD();
			} else {
				this.lastActionDebug = "Target Lock: Tidak ada target di sekitar";
				this.updateDebugHUD();
			}
		}
	}

	public isLockActive(): boolean {
		return this.isTargetLocked;
	}

	/**
	 * Menghadapkan karakter seketika ke musuh yang di-lock saat melancarkan serangan M1 / Heavy.
	 */
	private faceTarget(): void {
		if (!this.humanoidRootPart) return;

		const target = this.getLockTarget();
		if (target) {
			const targetHrp = target.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (targetHrp) {
				const myPos = this.humanoidRootPart.Position;
				const dir = new Vector3(
					targetHrp.Position.X - myPos.X,
					0,
					targetHrp.Position.Z - myPos.Z,
				);
				if (dir.Magnitude > 0.4) {
					this.humanoidRootPart.CFrame = CFrame.lookAt(myPos, myPos.add(dir));
					return;
				}
			}
		}

		// Fallback arah horizontal kamera jika tidak ada target
		const camera = Workspace.CurrentCamera;
		if (!camera) return;
		const [, yaw] = camera.CFrame.ToOrientation();
		const currentPos = this.humanoidRootPart.Position;
		this.humanoidRootPart.CFrame = new CFrame(currentPos).mul(CFrame.Angles(0, yaw, 0));
	}

	private watchCharacterValues(): void {
		if (!this.character) return;

		const guardBrokenVal = this.character.FindFirstChild("IsGuardBroken") as BoolValue | undefined;
		if (guardBrokenVal) {
			this.connections.push(
				guardBrokenVal.Changed.Connect((val) => {
					this.isGuardBroken = val;
					if (val) {
						this.isBlocking = false;
						this.combatHud.setCombatStates(this.isBlocking, this.isSprinting);
						this.stopAnim("Block", 0.05);
						this.stopAttackAnims();
						this.playAnim("GuardBreak", 0.05);
					} else {
						this.stopAnim("GuardBreak", 0.1);
						if (this.isEquipped && !this.isStunned && !this.isInClash) {
							this.updateMovement();
						}
					}
				}),
			);
		}

		const stunnedVal = this.character.FindFirstChild("IsStunned") as BoolValue | undefined;
		if (stunnedVal) {
			this.connections.push(
				stunnedVal.Changed.Connect((val) => {
					this.isStunned = val;
					if (!val) {
						this.isGuardBroken = false;
						this.stopAnim("GuardBreak", 0.1);
						this.stopAnim("HitReactionM1_1", 0.1);
						this.stopAnim("HitReactionM1_2", 0.1);
						this.stopAnim("HitReactionHeavy", 0.1);
						if (this.isEquipped && !this.isInClash) {
							this.updateMovement();
						}
					}
				}),
			);
		}

		const attackingVal = this.character.FindFirstChild("IsAttacking") as BoolValue | undefined;
		if (attackingVal) {
			this.connections.push(
				attackingVal.Changed.Connect((val) => {
					this.isAttacking = val;
					this.updateWalkSpeed();
					if (!val && this.isEquipped && !this.isGuardBroken && !this.isInClash && !this.isStunned) {
						this.updateMovement();
					}
				}),
			);
		}

		const blockingVal = this.character.FindFirstChild("IsBlocking") as BoolValue | undefined;
		if (blockingVal) {
			this.connections.push(
				blockingVal.Changed.Connect((val) => {
					this.isBlocking = val;
					this.combatHud.setCombatStates(this.isBlocking, this.isSprinting);
					this.updateWalkSpeed();
					if (this.isEquipped && !this.isGuardBroken && !this.isInClash && !this.isStunned) {
						this.updateMovement();
					}
				}),
			);
		}

		const clashVal = this.character.FindFirstChild("IsInClash") as BoolValue | undefined;
		if (clashVal) {
			this.connections.push(
				clashVal.Changed.Connect((val) => {
					this.isInClash = val;
					if (val) {
						this.stopAllCombatAnims();
					} else if (!this.isInClashWinAnimation) {
						this.stopClashAnims();
						this.destroyClashUI();
						this.currentClashId = undefined;
						this.clashOpponentUserId = undefined;
						if (this.isEquipped && !this.isGuardBroken && !this.isStunned) {
							this.updateMovement();
						}
					}
				}),
			);
		}
	}

	// ═══════════════════════════════════════════════════════
	// ANIMATIONS
	// ═══════════════════════════════════════════════════════

	private resolveAnimationIds(): Map<string, string> {
		const resolved = new Map<string, string>();
		const anims = ARCZIS_COMBAT_CONFIG.Animations;

		// 1. Prioritize real published animation IDs from ARCZIS_COMBAT_CONFIG.Animations
		resolved.set("CombatIdle", anims.CombatIdle);
		resolved.set("CombatWalk", anims.CombatWalk);
		resolved.set("CombatRun", anims.CombatRun);
		resolved.set("M1_Punch1", anims.M1_Punch1);
		resolved.set("M1_Punch2", anims.M1_Punch2);
		resolved.set("HeavyPunch", anims.HeavyPunch);
		resolved.set("Block", anims.Block);
		resolved.set("BlockHit", anims.BlockHit);
		resolved.set("Equip", anims.Equip);
		resolved.set("GuardBreak", anims.GuardBreak);
		resolved.set("HitReactionM1_1", anims.HitReactionM1_1);
		resolved.set("HitReactionM1_2", anims.HitReactionM1_2);
		resolved.set("HitReactionHeavy", anims.HitReactionHeavy);
		if (anims.ClashLoop) resolved.set("ClashLoop", anims.ClashLoop);
		if (anims.ClashWin) resolved.set("ClashWin", anims.ClashWin);
		if (anims.DashFront) resolved.set("DashFront", anims.DashFront);
		if (anims.DashBack) resolved.set("DashBack", anims.DashBack);
		if (anims.DashLeft) resolved.set("DashLeft", anims.DashLeft);
		if (anims.DashRight) resolved.set("DashRight", anims.DashRight);

		// Fallback to Server-registered KeyframeSequences only if an entry is missing or empty
		const animFolder = ReplicatedStorage.FindFirstChild("CombatAnimationIds") as Folder | undefined;
		if (animFolder) {
			for (const child of animFolder.GetChildren()) {
				if (child.IsA("StringValue") && child.Value !== "") {
					if (!resolved.has(child.Name) || resolved.get(child.Name) === "") {
						resolved.set(child.Name, child.Value);
					}
				}
			}
		}

		return resolved;
	}

	private loadAnim(name: string, id: string, priority: Enum.AnimationPriority, looped = false): AnimationTrack | undefined {
		if (!this.animator || !id || id === "" || id.find("YOUR_")[0] !== undefined) {
			this.studioWarn(`[CombatController] Lewati '${name}': ID '${id}' tidak valid atau Animator tidak ada.`);
			return undefined;
		}

		const anim = new Instance("Animation");
		anim.AnimationId = id;

		const [success, track] = pcall(() => this.animator!.LoadAnimation(anim));
		if (success && track) {
			track.Priority = priority;
			track.Looped = looped;
			this.animTracks.set(name, track);

			task.spawn(() => {
				pcall(() => ContentProvider.PreloadAsync([anim]));
			});

			return track;
		} else {
			this.studioWarn(`[CombatController] Gagal memuat animasi '${name}' (ID: ${id}):`, track);
		}
		return undefined;
	}

	private loadAllAnimations(): void {
		for (const [, track] of this.animTracks) {
			track.Stop(0);
			track.Destroy();
		}
		this.animTracks.clear();

		if (this.humanoid) {
			this.studioPrint(`[CombatController] Avatar RigType terdeteksi: ${this.humanoid.RigType.Name}`);
			if (this.humanoid.RigType === Enum.HumanoidRigType.R15) {
				this.studioWarn(
					"⚠️ [CombatController] PERINGATAN: Avatar Anda adalah R15! Animasi Arczis Combat dibuat khusus untuk R6. Buka Roblox Studio -> Game Settings -> Avatar -> Ubah Avatar Type menjadi R6 agar animasi dapat bergerak!",
				);
			}
		}

		const animIds = this.resolveAnimationIds();

		// Priority set to Action or higher so that default Roblox tool hold animations do not override them!
		this.loadAnim("CombatIdle", animIds.get("CombatIdle") ?? "", Enum.AnimationPriority.Action, true);
		this.loadAnim("CombatWalk", animIds.get("CombatWalk") ?? "", Enum.AnimationPriority.Action, true);
		this.loadAnim("CombatRun", animIds.get("CombatRun") ?? "", Enum.AnimationPriority.Action, true);
		this.loadAnim("M1_Punch1", animIds.get("M1_Punch1") ?? "", Enum.AnimationPriority.Action2, false);
		this.loadAnim("M1_Punch2", animIds.get("M1_Punch2") ?? "", Enum.AnimationPriority.Action2, false);
		this.loadAnim("HeavyPunch", animIds.get("HeavyPunch") ?? "", Enum.AnimationPriority.Action2, false);
		this.loadAnim("Block", animIds.get("Block") ?? "", Enum.AnimationPriority.Action3, true);
		this.loadAnim("BlockHit", animIds.get("BlockHit") ?? "", Enum.AnimationPriority.Action3, false);
		this.loadAnim("Equip", animIds.get("Equip") ?? "", Enum.AnimationPriority.Action, false);
		this.loadAnim("GuardBreak", animIds.get("GuardBreak") ?? "", Enum.AnimationPriority.Action4, false);
		this.loadAnim("HitReactionM1_1", animIds.get("HitReactionM1_1") ?? "", Enum.AnimationPriority.Action4, false);
		this.loadAnim("HitReactionM1_2", animIds.get("HitReactionM1_2") ?? "", Enum.AnimationPriority.Action4, false);
		this.loadAnim("HitReactionHeavy", animIds.get("HitReactionHeavy") ?? "", Enum.AnimationPriority.Action4, false);

		if (animIds.has("ClashLoop")) {
			this.loadAnim("ClashLoop", animIds.get("ClashLoop") ?? "", Enum.AnimationPriority.Action4, true);
		}
		if (animIds.has("ClashWin")) {
			this.loadAnim("ClashWin", animIds.get("ClashWin") ?? "", Enum.AnimationPriority.Action4, false);
		}
		if (animIds.has("DashFront")) {
			this.loadAnim("DashFront", animIds.get("DashFront") ?? "", Enum.AnimationPriority.Action2, false);
		}
		if (animIds.has("DashBack")) {
			this.loadAnim("DashBack", animIds.get("DashBack") ?? "", Enum.AnimationPriority.Action2, false);
		}
		if (animIds.has("DashLeft")) {
			this.loadAnim("DashLeft", animIds.get("DashLeft") ?? "", Enum.AnimationPriority.Action2, false);
		}
		if (animIds.has("DashRight")) {
			this.loadAnim("DashRight", animIds.get("DashRight") ?? "", Enum.AnimationPriority.Action2, false);
		}
	}

	private playAnim(name: string, fadeTime = 0.1): AnimationTrack | undefined {
		const track = this.animTracks.get(name);
		if (track) {
			if (!track.IsPlaying) {
				track.Play(fadeTime);
				this.studioPrint(`[CombatController] Memainkan animasi: ${name} (Priority: ${track.Priority.Name}, Length: ${track.Length})`);
			}
			return track;
		} else {
			this.studioWarn(`[CombatController] Track '${name}' tidak ditemukan di animTracks!`);
		}
		return undefined;
	}

	private stopAnim(name: string, fadeTime = 0.2): void {
		const track = this.animTracks.get(name);
		if (track && track.IsPlaying) {
			track.Stop(fadeTime);
		}
	}

	private stopAttackAnims(): void {
		this.stopAnim("M1_Punch1", 0.1);
		this.stopAnim("M1_Punch2", 0.1);
		this.stopAnim("HeavyPunch", 0.1);
	}

	private stopClashAnims(): void {
		this.stopAnim("ClashLoop", 0.1);
		this.stopAnim("ClashWin", 0.1);
	}

	private stopDashAnims(): void {
		this.stopAnim("DashFront", 0.1);
		this.stopAnim("DashBack", 0.1);
		this.stopAnim("DashLeft", 0.1);
		this.stopAnim("DashRight", 0.1);
		this.isDashing = false;
	}

	private stopAllCombatAnims(): void {
		this.stopAnim("CombatIdle", 0.1);
		this.stopAnim("CombatWalk", 0.1);
		this.stopAnim("CombatRun", 0.1);
		this.stopAnim("Block", 0.1);
		this.stopAttackAnims();
		this.stopClashAnims();
		this.stopDashAnims();
	}

	// ═══════════════════════════════════════════════════════
	// MOVEMENT & SPRINT
	// ═══════════════════════════════════════════════════════

	private updateWalkSpeed(): void {
		if (!this.humanoid || !this.isEquipped) return;
		if (this.isGuardBroken || this.isInClash) {
			this.humanoid.WalkSpeed = 0;
			return;
		}
		if (this.isStunned) {
			this.humanoid.WalkSpeed = ARCZIS_COMBAT_CONFIG.StunnedWalkSpeed;
			return;
		}

		const baseSpeed = this.isSprinting ? ARCZIS_COMBAT_CONFIG.SprintSpeed : ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed;
		let multiplier = 1;

		if (this.isBlocking) {
			multiplier = ARCZIS_COMBAT_CONFIG.BlockWalkSpeedMultiplier;
		} else if (this.isAttacking) {
			multiplier = ARCZIS_COMBAT_CONFIG.AttackingWalkSpeedMultiplier;
		}

		this.humanoid.WalkSpeed = baseSpeed * multiplier;
	}

	private updateMovement(): void {
		if (!this.isEquipped || !this.humanoid || !this.humanoidRootPart) return;
		if (this.isGuardBroken || this.isInClash || this.isInClashWinAnimation || this.isStunned) {
			this.stopAnim("CombatIdle", 0.1);
			this.stopAnim("CombatWalk", 0.1);
			this.stopAnim("CombatRun", 0.1);
			return;
		}

		// Kelola animasi Guard / Block
		if (this.isBlocking) {
			if (this.isTrackUsable("Block")) {
				this.playAnim("Block", 0.1);
			} else {
				this.setProceduralBlock(true);
			}
		} else {
			this.stopAnim("Block", 0.15);
			this.setProceduralBlock(false);
		}

		// Kelola animasi Locomotion (Walk / Run / Idle) pada kaki
		const velocity = this.humanoidRootPart.AssemblyLinearVelocity;
		const horizontalSpeed = new Vector3(velocity.X, 0, velocity.Z).Magnitude;
		const isMoving = this.humanoid.MoveDirection.Magnitude > 0.05 || horizontalSpeed > 0.5;

		if (isMoving) {
			this.stopAnim("CombatIdle", 0.15);
			const isRunning = this.isSprinting && !this.isBlocking;

			if (isRunning) {
				this.stopAnim("CombatWalk", 0.1);
				const runTrack = this.playAnim("CombatRun", 0.15);
				if (runTrack && runTrack.IsPlaying) {
					const runScale = math.clamp(this.humanoid.WalkSpeed / ARCZIS_COMBAT_CONFIG.SprintSpeed, 0.4, 1.6);
					runTrack.AdjustSpeed(runScale);
				}
			} else {
				this.stopAnim("CombatRun", 0.1);
				const walkTrack = this.playAnim("CombatWalk", 0.15);
				if (walkTrack && walkTrack.IsPlaying) {
					const walkScale = math.clamp(this.humanoid.WalkSpeed / ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed, 0.4, 1.4);
					walkTrack.AdjustSpeed(walkScale);
				}
			}
		} else {
			this.stopAnim("CombatWalk", 0.15);
			this.stopAnim("CombatRun", 0.15);
			this.playAnim("CombatIdle", 0.2);
		}
	}

	// ═══════════════════════════════════════════════════════
	// INPUT BINDINGS
	// ═══════════════════════════════════════════════════════

	private onInputBegan(input: InputObject, processed: boolean): void {
		if (this.isPaused) return;

		// Spacebar untuk Clash Duel Mash: Wajib selalu terdeteksi saat Clash meskipun fungsi lompat dimatikan
		if (input.KeyCode === Enum.KeyCode.Space) {
			if (this.isEquipped && this.isInClash && this.currentClashId) {
				const isTyping = UserInputService.GetFocusedTextBox() !== undefined;
				if (!isTyping) {
					this.clashEvent.FireServer("ButtonPress", this.currentClashId);
				}
			}
			return;
		}

		if (processed) return;

		this.lastActionDebug = `Input: ${input.UserInputType.Name} / ${input.KeyCode.Name}`;
		this.updateDebugHUD();

		if (!this.isEquipped) {
			return;
		}

		// LMB: M1 Punch combo
		if (input.UserInputType === Enum.UserInputType.MouseButton1) {
			if (!this.isInClash && !this.isInClashWinAnimation) {
				this.doM1();
			}
			return;
		}

		// RMB: Heavy Punch / Push (Dorong)
		if (input.UserInputType === Enum.UserInputType.MouseButton2) {
			if (!this.isInClash && !this.isInClashWinAnimation) {
				this.doHeavy();
			}
			return;
		}

		// E: Block / Guard
		if (input.KeyCode === Enum.KeyCode.E) {
			if (!this.isInClash && !this.isInClashWinAnimation) {
				this.startBlock();
			}
			return;
		}

		// Q: Dash / Dodge
		if (input.KeyCode === Enum.KeyCode.Q) {
			if (!this.isInClash && !this.isInClashWinAnimation) {
				this.doDash();
			}
			return;
		}

		// Left Shift: Sprint
		if (input.KeyCode === Enum.KeyCode.LeftShift) {
			this.setSprint(true);
			return;
		}

		// T: Toggle Target Lock (Dueling Grounds Style)
		if (input.KeyCode === Enum.KeyCode.T) {
			if (!this.isInClash && !this.isInClashWinAnimation) {
				this.toggleTargetLock();
			}
			return;
		}

	}

	private onInputEnded(input: InputObject, _processed: boolean): void {
		if (input.KeyCode === Enum.KeyCode.E) {
			this.stopBlock();
		}

		if (input.KeyCode === Enum.KeyCode.LeftShift) {
			this.setSprint(false);
		}
	}

	private setSprint(sprint: boolean): void {
		this.isSprinting = sprint;
		this.combatHud.setCombatStates(this.isBlocking, this.isSprinting);
		this.updateWalkSpeed();
		if (this.isEquipped) {
			this.combatEvent.FireServer("Sprint", sprint);
		}
	}

	// ═══════════════════════════════════════════════════════
	// COMBAT ACTIONS
	// ═══════════════════════════════════════════════════════

	private canAttack(): boolean {
		return (
			!this.isInClash &&
			!this.isInClashWinAnimation &&
			!this.isGuardBroken &&
			!this.isStunned &&
			!this.isAttacking &&
			!this.isBlocking &&
			!this.isDashing
		);
	}

	private canBlock(): boolean {
		return (
			!this.isInClash &&
			!this.isInClashWinAnimation &&
			!this.isGuardBroken &&
			(!this.isStunned || this.canBlockWhileStunned) &&
			!this.isAttacking &&
			!this.isDashing
		);
	}

	private hasStamina(cost: number): boolean {
		const stamVal = this.character?.FindFirstChild("Stamina") as NumberValue | undefined;
		if (stamVal) {
			return stamVal.Value >= cost && stamVal.Value >= ARCZIS_COMBAT_CONFIG.MinStaminaToAct;
		}
		return false;
	}

	private doM1(): void {
		if (!this.isEquipped || !this.canAttack() || !this.hasStamina(ARCZIS_COMBAT_CONFIG.M1StaminaCost)) return;

		const now = os.clock();
		if (now - this.lastM1Time < ARCZIS_COMBAT_CONFIG.M1Cooldown) return;
		this.lastM1Time = now;

		this.comboIndex = this.comboIndex === 1 ? 2 : 1;
		this.lastActionDebug = `LMB: Pukulan M1 Combo ${this.comboIndex}`;
		this.updateDebugHUD();

		this.stopAttackAnims();
		this.faceTarget();

		this.isAttacking = true;
		this.updateWalkSpeed();
		const animName = `M1_Punch${this.comboIndex}`;
		let track: AnimationTrack | undefined;
		if (this.isTrackUsable(animName)) {
			track = this.playAnim(animName, 0.05);
		} else {
			this.playProceduralM1(this.comboIndex);
		}

		task.delay(ARCZIS_COMBAT_CONFIG.M1AnimationLock, () => {
			this.isAttacking = false;
			this.updateWalkSpeed();
			if (
				this.isEquipped &&
				!this.isGuardBroken &&
				!this.isInClash &&
				!this.isInClashWinAnimation &&
				!this.isStunned
			) {
				this.updateMovement();
			}
		});

		this.playLocalSound(ARCZIS_COMBAT_CONFIG.Sounds.Swing);
		this.combatEvent.FireServer("M1");
	}

	private doHeavy(): void {
		if (!this.isEquipped || !this.canAttack() || !this.hasStamina(ARCZIS_COMBAT_CONFIG.HeavyStaminaCost)) return;

		const now = os.clock();
		if (now - this.lastHeavyTime < ARCZIS_COMBAT_CONFIG.HeavyCooldown) return;
		this.lastHeavyTime = now;

		this.lastActionDebug = "RMB: Heavy Punch / Push";
		this.updateDebugHUD();

		this.stopAttackAnims();
		this.faceTarget();

		this.isAttacking = true;
		this.updateWalkSpeed();
		let track: AnimationTrack | undefined;
		if (this.isTrackUsable("HeavyPunch")) {
			track = this.playAnim("HeavyPunch", 0.05);
		} else {
			this.playProceduralHeavy();
		}

		task.delay(ARCZIS_COMBAT_CONFIG.HeavyAnimationLock, () => {
			this.isAttacking = false;
			this.updateWalkSpeed();
			if (
				this.isEquipped &&
				!this.isGuardBroken &&
				!this.isInClash &&
				!this.isInClashWinAnimation &&
				!this.isStunned
			) {
				this.updateMovement();
			}
		});

		this.playLocalSound(ARCZIS_COMBAT_CONFIG.Sounds.SwingHeavy);
		this.combatEvent.FireServer("Heavy");
	}

	private doDash(): void {
		if (!this.isEquipped || !this.canAttack() || !this.hasStamina(ARCZIS_COMBAT_CONFIG.DashStaminaCost)) return;

		const now = os.clock();
		if (now - this.lastDashTime < ARCZIS_COMBAT_CONFIG.DashCooldown) return;
		this.lastDashTime = now;

		// Tentukan arah dash berdasarkan pergerakan karakter saat ini
		let dashAnimName = "DashFront";
		let worldDashDir = this.humanoidRootPart ? this.humanoidRootPart.CFrame.LookVector : new Vector3(0, 0, -1);

		if (this.humanoid && this.humanoidRootPart) {
			const moveDir = this.humanoid.MoveDirection;
			if (moveDir.Magnitude > 0.1) {
				worldDashDir = moveDir.Unit;
				// Ubah ke arah lokal relatif terhadap rotasi HumanoidRootPart
				const localDir = this.humanoidRootPart.CFrame.VectorToObjectSpace(moveDir);

				// localDir.Z < 0 adalah depan, > 0 adalah belakang
				// localDir.X > 0 adalah kanan, < 0 adalah kiri
				if (math.abs(localDir.Z) >= math.abs(localDir.X)) {
					dashAnimName = localDir.Z < 0 ? "DashFront" : "DashBack";
				} else {
					dashAnimName = localDir.X > 0 ? "DashRight" : "DashLeft";
				}
			} else {
				dashAnimName = "DashFront";
				worldDashDir = this.humanoidRootPart.CFrame.LookVector;
			}
		}

		this.lastActionDebug = `Q: Dash (${dashAnimName})`;
		this.updateDebugHUD();

		// Hentikan animasi dash yang sedang berjalan sebelumnya
		this.stopDashAnims();

		this.isDashing = true;
		let playedAnim = false;
		if (this.isTrackUsable(dashAnimName)) {
			const track = this.playAnim(dashAnimName, 0.05);
			if (track) {
				playedAnim = true;
				// Tunggu sampai animasi dash benar-benar selesai secara tuntas
				const fullDuration = track.Length > 0 ? track.Length : 0.6;
				let hasCompleted = false;

				const onDashEnd = () => {
					if (hasCompleted) return;
					hasCompleted = true;
					this.isDashing = false;
					if (this.isEquipped && !this.isStunned && !this.isInClash && !this.isGuardBroken) {
						this.updateMovement();
					}
				};

				track.Stopped.Once(onDashEnd);
				task.delay(fullDuration, onDashEnd);
			}
		}

		if (!playedAnim) {
			task.delay(0.45, () => {
				this.isDashing = false;
				if (this.isEquipped && !this.isStunned && !this.isInClash && !this.isGuardBroken) {
					this.updateMovement();
				}
			});
		}

		// Fallback prosedural jika animasi belum siap / tidak dimainkan
		if (!playedAnim && this.rootJoint && this.defaultRootJointC0) {
			const tiltAngle = dashAnimName === "DashBack" ? math.rad(-12) : math.rad(12);
			TweenService.Create(
				this.rootJoint,
				new TweenInfo(0.08, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ C0: this.defaultRootJointC0.mul(CFrame.Angles(tiltAngle, 0, 0)) },
			).Play();
			task.delay(0.18, () => {
				if (this.rootJoint && this.defaultRootJointC0) {
					TweenService.Create(
						this.rootJoint,
						new TweenInfo(0.14, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
						{ C0: this.defaultRootJointC0 },
					).Play();
				}
			});
		}

		this.playLocalSound(ARCZIS_COMBAT_CONFIG.Sounds.SwingHeavy, 0.6);
		this.combatEvent.FireServer("Dash", worldDashDir);
	}

	private startBlock(): void {
		if (!this.isEquipped || !this.canBlock() || !this.hasStamina(ARCZIS_COMBAT_CONFIG.MinStaminaToAct)) return;

		this.isBlocking = true;
		this.combatHud.setCombatStates(this.isBlocking, this.isSprinting);
		this.lastActionDebug = "E: Guard / Block Aktif";
		this.updateDebugHUD();
		this.blockEvent.FireServer(true);
		this.updateWalkSpeed();

		if (this.isTrackUsable("Block")) {
			this.playAnim("Block", 0.1);
		} else {
			this.setProceduralBlock(true);
		}

		this.updateMovement();
	}

	private stopBlock(): void {
		if (!this.isBlocking) return;

		this.isBlocking = false;
		this.combatHud.setCombatStates(this.isBlocking, this.isSprinting);
		this.lastActionDebug = "E: Guard Dilepas";
		this.updateDebugHUD();
		this.blockEvent.FireServer(false);
		this.updateWalkSpeed();

		this.stopAnim("Block", 0.15);
		this.setProceduralBlock(false);

		if (this.isEquipped && !this.isGuardBroken && !this.isInClash && !this.isInClashWinAnimation && !this.isStunned) {
			this.updateMovement();
		}
	}

	// ═══════════════════════════════════════════════════════
	// REMOTE LISTENERS
	// ═══════════════════════════════════════════════════════

	private setupRemoteListeners(): void {
		// CombatEvent
		this.combatEvent.OnClientEvent.Connect((eventType: unknown, arg1?: unknown, arg2?: unknown) => {
			if (eventType === "PlayAttack") {
				const attackType = arg1 as "M1" | "Heavy";
				const comboNum = arg2 as number;
				const animName = attackType === "Heavy" ? "HeavyPunch" : `M1_Punch${comboNum}`;
				const currentTrack = this.animTracks.get(animName);

				// Jika serangan ini sudah aktif dan sedang diputar oleh client lokal, jangan hentikan / restart!
				if (this.isAttacking && currentTrack && currentTrack.IsPlaying) {
					return;
				}

				this.isAttacking = true;
				this.faceTarget();
				this.stopAttackAnims();

				let track: AnimationTrack | undefined;
				if (this.isTrackUsable(animName)) {
					track = this.playAnim(animName, 0.05);
				} else {
					if (attackType === "Heavy") {
						this.playProceduralHeavy();
					} else {
						this.playProceduralM1(comboNum);
					}
				}

				const lockTime =
					attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.HeavyAnimationLock : ARCZIS_COMBAT_CONFIG.M1AnimationLock;

				task.delay(lockTime, () => {
					this.isAttacking = false;
					this.updateWalkSpeed();
					if (
						this.isEquipped &&
						!this.isGuardBroken &&
						!this.isInClash &&
						!this.isInClashWinAnimation &&
						!this.isStunned
					) {
						this.updateMovement();
					}
				});
			} else if (eventType === "NoStamina") {
				this.isAttacking = false;
				this.updateWalkSpeed();
				if (this.isEquipped && !this.isGuardBroken && !this.isInClash && !this.isStunned) {
					this.updateMovement();
				}
			}
		});

		// BlockEvent
		this.blockEvent.OnClientEvent.Connect((eventType: unknown) => {
			if (eventType === "GuardBreak") {
				this.isBlocking = false;
				this.isGuardBroken = true;
				this.isStunned = true;
				this.stopAnim("Block", 0.05);
				this.stopAttackAnims();
				this.updateWalkSpeed();
				if (this.isTrackUsable("GuardBreak")) {
					this.playAnim("GuardBreak", 0.05);
				} else {
					this.setProceduralBlock(false);
				}
			} else if (eventType === "GuardBroken" || eventType === "CannotBlock") {
				this.isBlocking = false;
				this.setProceduralBlock(false);
				this.updateWalkSpeed();
			} else if (eventType === "NoStamina") {
				this.isBlocking = false;
				this.stopAnim("Block", 0.15);
				this.setProceduralBlock(false);
				this.updateWalkSpeed();
				if (this.isEquipped && !this.isGuardBroken && !this.isInClash && !this.isStunned) {
					this.updateMovement();
				}
			}
		});

		// HitReactionEvent
		this.hitReactionEvent.OnClientEvent.Connect((reactionType: unknown, duration: unknown, canBlock: unknown) => {
			this.canBlockWhileStunned = (canBlock as boolean | undefined) ?? false;
			const rType = reactionType as string;
			const dur = duration as number;

			if (rType === "StunEnded") {
				this.forceResetStates();
				return;
			}

			if (rType === "GuardBreak") {
				this.isGuardBroken = true;
				this.isStunned = true;
				this.isBlocking = false;
				this.stopAnim("Block", 0.05);
				this.stopAttackAnims();
				if (this.isTrackUsable("GuardBreak")) {
					this.playAnim("GuardBreak", 0.05);
				} else {
					this.setProceduralBlock(false);
				}

				task.delay(dur + 0.5, () => {
					if (this.isGuardBroken || this.isStunned) {
						this.forceResetStates();
					}
				});
				return;
			}

			if (rType === "BlockHit") {
				if (this.isTrackUsable("BlockHit")) {
					this.playAnim("BlockHit", 0.05);
					task.delay(0.3, () => this.stopAnim("BlockHit", 0.1));
				}
				return;
			}

			if (rType.find("HitReaction")[0] !== undefined) {
				this.isStunned = true;
				this.stopAttackAnims();
				if (this.isTrackUsable(rType)) {
					this.playAnim(rType, 0.05);
					task.delay(dur, () => {
						this.stopAnim(rType, 0.1);
						if (this.isEquipped && !this.isBlocking && !this.isGuardBroken && !this.isInClash) {
							this.updateMovement();
						}
					});
				} else {
					// Procedural torso flinch
					if (this.rootJoint && this.defaultRootJointC0) {
						TweenService.Create(
							this.rootJoint,
							new TweenInfo(0.08, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
							{ C0: this.defaultRootJointC0.mul(CFrame.Angles(math.rad(-15), math.rad(5), 0)) },
						).Play();
						task.delay(dur * 0.6, () => {
							if (this.rootJoint && this.defaultRootJointC0) {
								TweenService.Create(
									this.rootJoint,
									new TweenInfo(0.14, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
									{ C0: this.defaultRootJointC0 },
								).Play();
							}
							if (this.isEquipped && !this.isBlocking && !this.isGuardBroken && !this.isInClash) {
								this.updateMovement();
							}
						});
					}
				}
			}
		});

		// ClashEvent
		this.clashEvent.OnClientEvent.Connect((eventType: unknown, arg1?: unknown, arg2?: unknown) => {
			if (eventType === "ClashStart") {
				this.isInClash = true;
				this.isAttacking = false;
				this.isBlocking = false;
				this.isInClashWinAnimation = false;
				this.clashOpponentUserId = arg1 as number;
				this.currentClashId = arg2 as string;

				this.bindClashSpace();
				this.stopAllCombatAnims();
				this.playAnim("ClashLoop", 0.05);
				this.createClashUI();
			} else if (eventType === "UpdatePresses") {
				this.updateClashUI(arg1 as number, arg2 as number);
			} else if (eventType === "ClashWin") {
				this.isInClash = false;
				this.isInClashWinAnimation = true;
				this.currentClashId = undefined;
				this.clashOpponentUserId = undefined;

				this.unbindClashSpace();
				this.stopAnim("ClashLoop", 0.05);
				const winTrack = this.playAnim("ClashWin", 0.05);

				this.combatHud.setClashResult("win");

				task.delay(ARCZIS_COMBAT_CONFIG.ClashWinPunchDelay + 0.2, () => {
					this.isInClashWinAnimation = false;
					if (winTrack && winTrack.IsPlaying) {
						winTrack.Stop(0.1);
					}
					if (this.isEquipped && !this.isGuardBroken) {
						this.updateMovement();
					}
				});

				task.delay(1.0, () => this.destroyClashUI());
			} else if (eventType === "ClashLose") {
				this.isInClash = false;
				this.isStunned = true;
				this.isInClashWinAnimation = false;
				this.currentClashId = undefined;
				this.clashOpponentUserId = undefined;

				this.unbindClashSpace();
				this.stopClashAnims();

				this.combatHud.setClashResult("lose");

				task.delay(1.0, () => this.destroyClashUI());
			}
		});
	}

	private forceResetStates(): void {
		this.isStunned = false;
		this.isGuardBroken = false;
		this.isAttacking = false;
		this.isDashing = false;
		this.isInClash = false;
		this.isInClashWinAnimation = false;
		this.unbindClashSpace();

		this.stopAnim("GuardBreak", 0.1);
		this.stopAnim("HitReactionM1_1", 0.1);
		this.stopAnim("HitReactionM1_2", 0.1);
		this.stopAnim("HitReactionHeavy", 0.1);

		if (this.isEquipped) {
			this.updateWalkSpeed();
			this.updateMovement();
		}
	}

	// ═══════════════════════════════════════════════════════
	// 3D AUDIO PLAYBACK
	// ═══════════════════════════════════════════════════════

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
		sound.Volume = volume ?? ARCZIS_COMBAT_CONFIG.SoundVolume;
		sound.RollOffMaxDistance = ARCZIS_COMBAT_CONFIG.SoundRange;
		sound.RollOffMinDistance = 5;
		sound.RollOffMode = Enum.RollOffMode.Linear;
		sound.Parent = part;

		sound.Play();
		sound.Ended.Connect(() => part.Destroy());
		Debris.AddItem(part, 5);
	}

	// ═══════════════════════════════════════════════════════
	// CLASH UI
	// ═══════════════════════════════════════════════════════

	private createClashUI(): void {
		this.combatHud.showClash();
	}

	private updateClashUI(yourPresses: number, oppPresses: number): void {
		this.combatHud.updateClash(yourPresses, oppPresses);
	}

	private destroyClashUI(): void {
		this.combatHud.hideClash();
	}

	private isClashSpaceBound = false;

	private bindClashSpace(): void {
		if (this.isClashSpaceBound) return;
		this.isClashSpaceBound = true;

		ContextActionService.BindActionAtPriority(
			"ClashSpaceSink",
			(_actionName, inputState) => {
				if (inputState === Enum.UserInputState.Begin) {
					if (this.isEquipped && this.isInClash && this.currentClashId) {
						const isTyping = UserInputService.GetFocusedTextBox() !== undefined;
						if (!isTyping) {
							this.clashEvent.FireServer("ButtonPress", this.currentClashId);
						}
					}
				}
				// SINK input agar Roblox PlayerModule tidak memicu impuls jumping
				return Enum.ContextActionResult.Sink;
			},
			false,
			3000,
			Enum.KeyCode.Space,
		);
	}

	private unbindClashSpace(): void {
		if (!this.isClashSpaceBound) return;
		this.isClashSpaceBound = false;
		ContextActionService.UnbindAction("ClashSpaceSink");
	}

	// ═══════════════════════════════════════════════════════
	// COMBAT BARS UI (Health & Stamina)
	// ═══════════════════════════════════════════════════════

	private setupCombatBars(character: Model): void {
		// 1. Health Bar
		if (this.humanoid) {
			this.combatHud.setHealth(this.humanoid.Health, this.humanoid.MaxHealth);
			this.humanoid.HealthChanged.Connect((health) => {
				this.combatHud.setHealth(health, this.humanoid?.MaxHealth);
			});
			this.humanoid.GetPropertyChangedSignal("MaxHealth").Connect(() => {
				if (this.humanoid) {
					this.combatHud.setHealth(this.humanoid.Health, this.humanoid.MaxHealth);
				}
			});
		}

		// 2. Stamina Bar
		const staminaVal = character.WaitForChild("Stamina", 10) as NumberValue | undefined;
		if (staminaVal) {
			const maxStamina = ARCZIS_COMBAT_CONFIG.MaxStamina;
			this.combatHud.setStamina(staminaVal.Value, maxStamina);

			staminaVal.Changed.Connect((val) => {
				this.combatHud.setStamina(val, maxStamina);
			});
		}

		this.combatHud.setVisible(this.isEquipped);
	}
}
