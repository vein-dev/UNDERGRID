import { ContextActionService, Debris, Players, ReplicatedStorage, RunService, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { CombatHudView } from "client/ui/views/CombatHudView";
import { getRemoteEvent } from "shared/network";
import { ARCZIS_COMBAT_CONFIG } from "shared/types";
import { MovementConfig } from "shared/config/MovementConfig";

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

	private constructor() {}

	public static getInstance(): CombatController {
		if (!CombatController.instance) {
			CombatController.instance = new CombatController();
		}
		return CombatController.instance;
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
			this.updateShiftLock();
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
		}
		UserInputService.MouseBehavior = Enum.MouseBehavior.Default;

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
	// PROCEDURAL R6 JOINT ANIMATION FALLBACK
	// ═══════════════════════════════════════════════════════

	public isTrackUsable(name: string): boolean {
		const track = this.animTracks.get(name);
		return track !== undefined && track.Length > 0;
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
		this.lastActionDebug = "Fists Dipegang: Combat Aktif (Shift Lock ON)";
		this.combatEvent.FireServer("Equip", true);

		// Enable Shift Lock mode
		if (this.humanoid) {
			this.humanoid.AutoRotate = false;
			this.humanoid.CameraOffset = new Vector3(1.75, 0.25, 0);
			// Disable Jump while in fight mode
			this.humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, false);
			this.humanoid.JumpPower = 0;
			this.humanoid.JumpHeight = 0;
		}
		UserInputService.MouseBehavior = Enum.MouseBehavior.LockCenter;

		this.combatHud.setVisible(true);
		this.combatHud.setCombatStates(this.isBlocking, this.isSprinting);

		this.updateDebugHUD();

		// Play equip animation & sound
		const equipTrack = this.animTracks.get("Equip");
		if (equipTrack && this.isTrackUsable("Equip")) {
			equipTrack.Play(0.1);
			this.playLocalSound(ARCZIS_COMBAT_CONFIG.Sounds.Equip);
			task.delay(math.max(0.3, equipTrack.Length * 0.7), () => {
				if (
					this.isEquipped &&
					!this.isAttacking &&
					!this.isBlocking &&
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
		this.lastActionDebug = "Fists Dilepas: Combat Nonaktif (Shift Lock OFF)";
		this.combatEvent.FireServer("Equip", false);
		this.blockEvent.FireServer(false);

		// Disable Shift Lock mode & restore Jump
		if (this.humanoid) {
			this.humanoid.AutoRotate = true;
			this.humanoid.CameraOffset = new Vector3(0, 0, 0);
			this.humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, true);
			this.humanoid.UseJumpPower = true;
			this.humanoid.JumpPower = MovementConfig.JUMP.jumpPower;
		}
		UserInputService.MouseBehavior = Enum.MouseBehavior.Default;

		this.combatHud.setVisible(false);

		if (this.humanoid) {
			this.humanoid.WalkSpeed = ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed;
		}

		this.isBlocking = false;
		this.isAttacking = false;
		this.isSprinting = false;
		this.isInClash = false;
		this.unbindClashSpace();
		this.combatHud.setCombatStates(false, false);
		this.destroyClashUI();

		this.updateDebugHUD();
		this.stopAllCombatAnims();
		this.setProceduralBlock(false);
	}

	public setPaused(paused: boolean): void {
		this.isPaused = paused;
		if (paused) {
			this.isBlocking = false;
			this.isAttacking = false;
			this.isSprinting = false;
			this.combatHud.setVisible(false);
			this.stopAllCombatAnims();
			this.setProceduralBlock(false);
		}
	}

	private updateShiftLock(): void {
		if (this.isPaused || !this.isEquipped || !this.humanoid || !this.humanoidRootPart) return;
		if (this.isInClash) return;

		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		// Lock mouse to center of screen unless player is typing in chat/input
		const isTyping = UserInputService.GetFocusedTextBox() !== undefined;
		if (!isTyping) {
			UserInputService.MouseBehavior = Enum.MouseBehavior.LockCenter;
		}

		// Rotate character horizontally to match camera view direction (Shift Lock orientation)
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

			task.delay(0.5, () => {
				if (track.Length === 0) {
					this.studioWarn(
						`[CombatController] PERINGATAN: Animasi '${name}' (ID: ${id}) memiliki panjang 0 detik! Ini biasanya karena Roblox memblokir izin aset ini (Asset Ownership Restriction).`,
					);
				}
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

	private stopAllCombatAnims(): void {
		this.stopAnim("CombatIdle", 0.1);
		this.stopAnim("CombatWalk", 0.1);
		this.stopAnim("CombatRun", 0.1);
		this.stopAnim("Block", 0.1);
		this.stopAttackAnims();
		this.stopClashAnims();
	}

	// ═══════════════════════════════════════════════════════
	// MOVEMENT & SPRINT
	// ═══════════════════════════════════════════════════════

	private updateMovement(): void {
		if (!this.isEquipped || !this.humanoid || !this.humanoidRootPart) return;
		if (this.isAttacking || this.isGuardBroken || this.isInClash || this.isInClashWinAnimation || this.isStunned) return;

		if (this.isBlocking) {
			this.stopAnim("CombatIdle", 0.1);
			this.stopAnim("CombatWalk", 0.1);
			this.stopAnim("CombatRun", 0.1);
			this.playAnim("Block", 0.1);
			return;
		}

		this.stopAnim("Block", 0.1);

		const velocity = this.humanoidRootPart.AssemblyLinearVelocity;
		const horizontalSpeed = new Vector3(velocity.X, 0, velocity.Z).Magnitude;

		if (horizontalSpeed > 1) {
			this.stopAnim("CombatIdle", 0.15);
			const currentSpeed = this.humanoid.WalkSpeed;
			const isRunning = currentSpeed > ARCZIS_COMBAT_CONFIG.RunSpeedThreshold || this.isSprinting;

			if (isRunning) {
				this.stopAnim("CombatWalk", 0.1);
				this.playAnim("CombatRun", 0.15);
			} else {
				this.stopAnim("CombatRun", 0.1);
				this.playAnim("CombatWalk", 0.15);
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
		if (this.humanoid && this.isEquipped && !this.isBlocking && !this.isStunned && !this.isGuardBroken) {
			this.humanoid.WalkSpeed = sprint ? ARCZIS_COMBAT_CONFIG.SprintSpeed : ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed;
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
			!this.isBlocking
		);
	}

	private canBlock(): boolean {
		return (
			!this.isInClash &&
			!this.isInClashWinAnimation &&
			!this.isGuardBroken &&
			(!this.isStunned || this.canBlockWhileStunned) &&
			!this.isAttacking
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

		this.stopAnim("CombatIdle", 0.05);
		this.stopAnim("CombatWalk", 0.05);
		this.stopAnim("CombatRun", 0.05);

		const animName = `M1_Punch${this.comboIndex}`;
		if (this.isTrackUsable(animName)) {
			this.playAnim(animName, 0.05);
		} else {
			this.playProceduralM1(this.comboIndex);
		}

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

		this.stopAnim("CombatIdle", 0.05);
		this.stopAnim("CombatWalk", 0.05);
		this.stopAnim("CombatRun", 0.05);
		this.stopAttackAnims();

		if (this.isTrackUsable("HeavyPunch")) {
			this.playAnim("HeavyPunch", 0.05);
		} else {
			this.playProceduralHeavy();
		}

		this.playLocalSound(ARCZIS_COMBAT_CONFIG.Sounds.SwingHeavy);
		this.combatEvent.FireServer("Heavy");
	}

	private doDash(): void {
		if (!this.isEquipped || !this.canAttack() || !this.hasStamina(ARCZIS_COMBAT_CONFIG.DashStaminaCost)) return;

		const now = os.clock();
		if (now - this.lastDashTime < ARCZIS_COMBAT_CONFIG.DashCooldown) return;
		this.lastDashTime = now;

		this.lastActionDebug = "Q: Dash / Menghindar";
		this.updateDebugHUD();

		if (this.rootJoint && this.defaultRootJointC0) {
			TweenService.Create(
				this.rootJoint,
				new TweenInfo(0.08, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ C0: this.defaultRootJointC0.mul(CFrame.Angles(math.rad(12), 0, 0)) },
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

		this.combatEvent.FireServer("Dash");
	}

	private startBlock(): void {
		if (!this.isEquipped || !this.canBlock() || !this.hasStamina(ARCZIS_COMBAT_CONFIG.MinStaminaToAct)) return;

		this.isBlocking = true;
		this.combatHud.setCombatStates(this.isBlocking, this.isSprinting);
		this.lastActionDebug = "E: Guard / Block Aktif";
		this.updateDebugHUD();
		this.blockEvent.FireServer(true);

		this.stopAnim("CombatIdle", 0.1);
		this.stopAnim("CombatWalk", 0.1);
		this.stopAnim("CombatRun", 0.1);

		if (this.isTrackUsable("Block")) {
			this.playAnim("Block", 0.1);
		} else {
			this.setProceduralBlock(true);
		}
	}

	private stopBlock(): void {
		if (!this.isBlocking) return;

		this.isBlocking = false;
		this.combatHud.setCombatStates(this.isBlocking, this.isSprinting);
		this.lastActionDebug = "E: Guard Dilepas";
		this.updateDebugHUD();
		this.blockEvent.FireServer(false);

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

				this.isAttacking = true;
				this.stopAttackAnims();

				const animName = attackType === "Heavy" ? "HeavyPunch" : `M1_Punch${comboNum}`;
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
					if (track && track.IsPlaying) {
						track.Stop(0.1);
					}
					if (
						this.isEquipped &&
						!this.isBlocking &&
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
				if (this.isTrackUsable("GuardBreak")) {
					this.playAnim("GuardBreak", 0.05);
				} else {
					this.setProceduralBlock(false);
				}
			} else if (eventType === "GuardBroken" || eventType === "CannotBlock") {
				this.isBlocking = false;
				this.setProceduralBlock(false);
			} else if (eventType === "NoStamina") {
				this.isBlocking = false;
				this.stopAnim("Block", 0.15);
				this.setProceduralBlock(false);
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
		this.isInClash = false;
		this.isInClashWinAnimation = false;
		this.unbindClashSpace();

		this.stopAnim("GuardBreak", 0.1);
		this.stopAnim("HitReactionM1_1", 0.1);
		this.stopAnim("HitReactionM1_2", 0.1);
		this.stopAnim("HitReactionHeavy", 0.1);

		if (this.isEquipped && !this.isBlocking) {
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
