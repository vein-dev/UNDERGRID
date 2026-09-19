import { Players, RunService, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { MovementConfig } from "shared/config/MovementConfig";

export class CrouchController {
	private static instance?: CrouchController;

	private readonly player: Player;
	private humanoid?: Humanoid;
	private rootPart?: BasePart;

	// States
	private isCrouching = false;
	private isCrawling = false;
	private isTransitioning = false;
	private isSprinting = false;
	private sprintKeyHeld = false;
	private crouchDebounce = true;
	private crawlDebounce = true;
	private isOnGround = true;
	private freefallTimer = 0;

	// Animation Tracks
	private crouchIdleTrack?: AnimationTrack;
	private crouchWalkTrack?: AnimationTrack;
	private crouchToCrawlTrack?: AnimationTrack;
	private crawlIdleTrack?: AnimationTrack;
	private crawlWalkTrack?: AnimationTrack;
	private crawlToCrouchTrack?: AnimationTrack;

	private currentCrouchAnim?: "idle" | "walk";
	private currentCrawlAnim?: "idle" | "walk";

	// Tweens
	private fovTween?: Tween;
	private camOffsetTween?: Tween;

	private isPaused = false;

	private constructor() {
		this.player = Players.LocalPlayer;
		this.init();
	}

	public static getInstance(): CrouchController {
		if (!CrouchController.instance) {
			CrouchController.instance = new CrouchController();
		}
		return CrouchController.instance;
	}

	public setPaused(paused: boolean): void {
		this.isPaused = paused;
		if (paused) {
			if (this.isCrawling) {
				this.stopCrawl();
			}
			if (this.isCrouching) {
				this.toggleCrouch();
			}
			if (this.isSprinting) {
				this.stopSprint();
			}
		}
	}

	private init(): void {
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed || this.isPaused) return;

			if (input.KeyCode === MovementConfig.CROUCH.crouchKey) {
				if (this.isCrawling) {
					this.stopCrawl();
				} else {
					this.toggleCrouch();
				}
			} else if (input.KeyCode === MovementConfig.CROUCH.crawlKey) {
				if (this.isCrawling) {
					this.stopCrawl();
				} else if (this.isCrouching) {
					this.doCrawl();
				}
			} else if (this.isSprintKey(input.KeyCode)) {
				this.sprintKeyHeld = true;
				if (!this.isCrouching && !this.isCrawling && !this.isTransitioning) {
					this.startSprint();
				}
			}
		});

		UserInputService.InputEnded.Connect((input, _gameProcessed) => {
			if (this.isPaused) return;
			if (this.isSprintKey(input.KeyCode)) {
				this.sprintKeyHeld = false;
				this.stopSprint();
			}
		});

		if (this.player.Character) {
			this.onCharacterAdded(this.player.Character);
		}
		this.player.CharacterAdded.Connect((char) => this.onCharacterAdded(char));

		RunService.Heartbeat.Connect((dt) => {
			this.onHeartbeat(dt);
		});

		print("[CrouchController] Ultimate R6 Crouch & Crawl System initialized successfully.");
	}

	private isSprintKey(code: Enum.KeyCode): boolean {
		for (const key of MovementConfig.CROUCH.sprintKeys) {
			if (code === key) return true;
		}
		return false;
	}

	private onCharacterAdded(char: Model): void {
		this.isCrouching = false;
		this.isCrawling = false;
		this.isTransitioning = false;
		this.isSprinting = false;
		this.currentCrouchAnim = undefined;
		this.currentCrawlAnim = undefined;

		this.humanoid = char.WaitForChild("Humanoid", 5) as Humanoid | undefined;
		this.rootPart = char.WaitForChild("HumanoidRootPart", 5) as BasePart | undefined;

		if (!this.humanoid || !this.rootPart) return;

		this.rootPart.SetAttribute("IsCrouching", false);
		this.rootPart.SetAttribute("IsCrawling", false);
		this.rootPart.SetAttribute("CrawlLock", false);
		this.humanoid.UseJumpPower = true;
		this.humanoid.JumpPower = MovementConfig.JUMP.jumpPower;
		this.applySpeed();

		const animator = this.humanoid.WaitForChild("Animator", 5) as Animator | undefined;
		if (!animator) return;

		const anims = MovementConfig.ANIMATIONS;
		this.crouchIdleTrack = this.loadAnimationTrack(animator, anims.crouchIdle, true);
		this.crouchWalkTrack = this.loadAnimationTrack(animator, anims.crouchWalk, true);
		this.crouchToCrawlTrack = this.loadAnimationTrack(animator, anims.crouchToCrawl, false);
		this.crawlIdleTrack = this.loadAnimationTrack(animator, anims.crawlIdle, true);
		this.crawlWalkTrack = this.loadAnimationTrack(animator, anims.crawlWalk, true);
		this.crawlToCrouchTrack = this.loadAnimationTrack(animator, anims.crawlToCrouch, false);

		this.humanoid.StateChanged.Connect((_oldState, newState) => {
			if (newState === Enum.HumanoidStateType.Freefall) {
				this.isOnGround = false;
			} else if (
				newState === Enum.HumanoidStateType.Landed ||
				newState === Enum.HumanoidStateType.Running ||
				newState === Enum.HumanoidStateType.RunningNoPhysics
			) {
				this.isOnGround = true;
				this.freefallTimer = 0;
			}
		});

		// Listen to CanSprint attribute change (from StaminaController)
		this.rootPart.GetAttributeChangedSignal("CanSprint").Connect(() => {
			const canSprint = this.rootPart?.GetAttribute("CanSprint") !== false;
			if (!canSprint && this.isSprinting) {
				this.stopSprint();
			} else if (canSprint && this.sprintKeyHeld && !this.isCrouching && !this.isCrawling) {
				this.startSprint();
			}
		});
	}

	private loadAnimationTrack(animator: Animator, animId: string, looped: boolean): AnimationTrack | undefined {
		if (!animId) return undefined;
		try {
			const anim = new Instance("Animation");
			anim.AnimationId = animId;
			const track = animator.LoadAnimation(anim);
			track.Priority = Enum.AnimationPriority.Action;
			track.Looped = looped;
			return track;
		} catch (e) {
			warn(`[CrouchController] Failed to load animation: ${animId}`);
			return undefined;
		}
	}

	private canSprintNow(): boolean {
		if (!this.rootPart) return true;
		const can = this.rootPart.GetAttribute("CanSprint");
		return can !== false;
	}

	private applySpeed(): void {
		if (!this.humanoid) return;
		const cfg = MovementConfig.CROUCH;

		if (this.isTransitioning) {
			this.humanoid.WalkSpeed = 0.001;
		} else if (this.isCrawling) {
			this.humanoid.WalkSpeed = cfg.crawlSpeed;
		} else if (this.isCrouching) {
			this.humanoid.WalkSpeed = cfg.crouchSpeed;
		} else if (this.isSprinting) {
			this.humanoid.WalkSpeed = cfg.sprintSpeed;
		} else {
			this.humanoid.WalkSpeed = cfg.normalSpeed;
		}
	}

	private tweenFOV(targetFOV: number, duration: number): void {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		this.fovTween?.Cancel();
		this.fovTween = TweenService.Create(
			camera,
			new TweenInfo(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
			{ FieldOfView: targetFOV },
		);
		this.fovTween.Play();
	}

	private tweenCamOffset(targetY: number, duration: number): void {
		if (!this.humanoid) return;

		this.camOffsetTween?.Cancel();
		this.camOffsetTween = TweenService.Create(
			this.humanoid,
			new TweenInfo(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
			{ CameraOffset: new Vector3(0, targetY, 0) },
		);
		this.camOffsetTween.Play();
	}

	private isObstructed(height: number): boolean {
		const char = this.player.Character;
		const head = char?.FindFirstChild("Head") as BasePart | undefined;
		if (!char || !head) return false;

		const params = new RaycastParams();
		params.FilterDescendantsInstances = [char];
		params.FilterType = Enum.RaycastFilterType.Exclude;

		const result = Workspace.Raycast(head.Position, new Vector3(0, height, 0), params);
		return result !== undefined;
	}

	// ----------------------------------------------------
	// SPRINT
	// ----------------------------------------------------
	public startSprint(): void {
		if (this.isCrouching || this.isCrawling || this.isTransitioning) return;
		if (this.isSprinting) return;
		if (!this.canSprintNow()) return;

		this.isSprinting = true;
		this.applySpeed();
		this.tweenFOV(MovementConfig.CROUCH.sprintFOV, MovementConfig.CROUCH.sprintFOVTime);
	}

	public stopSprint(): void {
		if (!this.isSprinting) return;
		this.isSprinting = false;
		this.applySpeed();
		if (!this.isCrouching && !this.isCrawling) {
			this.tweenFOV(MovementConfig.CROUCH.defaultFOV, MovementConfig.CROUCH.defaultFOVTime);
		}
	}

	// ----------------------------------------------------
	// CROUCH TOGGLE
	// ----------------------------------------------------
	public toggleCrouch(): void {
		if (!this.crouchDebounce) return;
		if (this.isTransitioning) return;
		if (!this.isOnGround && !this.isCrouching) return;

		const char = this.player.Character;
		if (!char || !this.humanoid || !this.rootPart || this.humanoid.Health <= 0) return;

		if (this.isCrouching) {
			// Check if obstructed above to stand up
			if (this.isObstructed(3.5)) return;

			this.crouchDebounce = false;
			this.isCrouching = false;
			this.rootPart.SetAttribute("IsCrouching", false);

			this.stopCrouchAnims();
			this.playSound(MovementConfig.SOUNDS.getUp, this.rootPart);

			this.humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, true);
			this.tweenCamOffset(0, 0.25);

			if (this.sprintKeyHeld && this.canSprintNow()) {
				this.isSprinting = true;
				this.applySpeed();
				this.tweenFOV(MovementConfig.CROUCH.sprintFOV, MovementConfig.CROUCH.sprintFOVTime);
			} else {
				this.applySpeed();
				this.tweenFOV(MovementConfig.CROUCH.defaultFOV, MovementConfig.CROUCH.defaultFOVTime);
			}

			task.delay(MovementConfig.CROUCH.crouchCooldown, () => {
				this.crouchDebounce = true;
			});
		} else {
			this.crouchDebounce = false;
			this.isSprinting = false;
			this.isCrouching = true;
			this.rootPart.SetAttribute("IsCrouching", true);

			this.playSound(MovementConfig.SOUNDS.crouch, this.rootPart);
			this.applySpeed();
			this.updateCrouchAnims();

			this.humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, false);
			this.tweenCamOffset(MovementConfig.CROUCH.crouchCamOffset, 0.25);
			this.tweenFOV(MovementConfig.CROUCH.crouchFOV, MovementConfig.CROUCH.crouchFOVTime);

			task.delay(MovementConfig.CROUCH.crouchCooldown, () => {
				this.crouchDebounce = true;
			});
		}
	}

	// ----------------------------------------------------
	// CRAWL (Enter from crouch)
	// ----------------------------------------------------
	public doCrawl(): void {
		if (!this.crawlDebounce) return;
		if (this.isCrawling || this.isTransitioning) return;
		if (!this.isCrouching || !this.isOnGround) return;
		if (!this.rootPart) return;

		this.crawlDebounce = false;
		this.isCrawling = true;
		this.isTransitioning = true;

		this.rootPart.SetAttribute("CrawlLock", true);
		this.rootPart.SetAttribute("IsCrawling", true);

		this.stopCrouchAnims();
		this.tweenFOV(MovementConfig.CROUCH.crawlFOV, MovementConfig.CROUCH.crawlFOVTime);
		this.tweenCamOffset(MovementConfig.CROUCH.crawlCamOffset, 0.35);

		this.applySpeed();

		if (this.crouchToCrawlTrack) {
			this.crouchToCrawlTrack.Play(0.1);
			this.crouchToCrawlTrack.AdjustSpeed(1);

			let conn: RBXScriptConnection | undefined;
			conn = this.crouchToCrawlTrack.Stopped.Connect(() => {
				conn?.Disconnect();
				this.isTransitioning = false;
				if (this.isCrawling) {
					this.applySpeed();
					this.updateCrawlAnims();
				}
			});
		} else {
			this.isTransitioning = false;
			this.applySpeed();
			this.updateCrawlAnims();
		}

		task.delay(MovementConfig.CROUCH.crawlCooldown, () => {
			this.crawlDebounce = true;
		});
	}

	// ----------------------------------------------------
	// CRAWL (Exit back to crouch)
	// ----------------------------------------------------
	public stopCrawl(): void {
		if (!this.isCrawling || this.isTransitioning) return;
		if (!this.rootPart) return;

		// Check if obstructed above to crouch
		if (this.isObstructed(2.5)) return;

		this.isCrawling = false;
		this.isTransitioning = true;
		this.rootPart.SetAttribute("IsCrawling", false);

		this.stopCrawlAnims();
		this.tweenFOV(MovementConfig.CROUCH.crouchFOV, MovementConfig.CROUCH.crouchFOVTime);
		this.tweenCamOffset(MovementConfig.CROUCH.crouchCamOffset, 0.35);

		this.applySpeed();

		if (this.crawlToCrouchTrack) {
			this.crawlToCrouchTrack.Play(0.1);
			this.crawlToCrouchTrack.AdjustSpeed(1);

			let conn: RBXScriptConnection | undefined;
			conn = this.crawlToCrouchTrack.Stopped.Connect(() => {
				conn?.Disconnect();
				this.isTransitioning = false;
				if (this.isCrouching && !this.isCrawling) {
					this.applySpeed();
					this.updateCrouchAnims();
					this.rootPart?.SetAttribute("CrawlLock", false);
				}
			});
		} else {
			this.isTransitioning = false;
			this.applySpeed();
			this.updateCrouchAnims();
			this.rootPart.SetAttribute("CrawlLock", false);
		}
	}

	private stopCrouchAnims(): void {
		this.crouchIdleTrack?.Stop(0.2);
		this.crouchWalkTrack?.Stop(0.2);
		this.currentCrouchAnim = undefined;
	}

	private updateCrouchAnims(): void {
		if (!this.isCrouching || this.isCrawling || this.isTransitioning) return;

		const vel = this.rootPart?.AssemblyLinearVelocity ?? new Vector3();
		const speed = new Vector3(vel.X, 0, vel.Z).Magnitude;

		if (speed < 0.5) {
			if (this.currentCrouchAnim !== "idle") {
				this.crouchWalkTrack?.Stop(0.2);
				this.crouchIdleTrack?.Play(0.2);
				this.crouchIdleTrack?.AdjustSpeed(MovementConfig.CROUCH.crouchIdleAnimSpeed);
				this.currentCrouchAnim = "idle";
			}
		} else {
			if (this.currentCrouchAnim !== "walk") {
				this.crouchIdleTrack?.Stop(0.2);
				this.crouchWalkTrack?.Play(0.2);
				this.crouchWalkTrack?.AdjustSpeed(MovementConfig.CROUCH.crouchWalkAnimSpeed);
				this.currentCrouchAnim = "walk";
			}
		}
	}

	private stopCrawlAnims(): void {
		this.crawlIdleTrack?.Stop(0.2);
		this.crawlWalkTrack?.Stop(0.2);
		this.currentCrawlAnim = undefined;
	}

	private updateCrawlAnims(): void {
		if (!this.isCrawling || this.isTransitioning) return;

		const vel = this.rootPart?.AssemblyLinearVelocity ?? new Vector3();
		const speed = new Vector3(vel.X, 0, vel.Z).Magnitude;

		if (speed < 0.5) {
			if (this.currentCrawlAnim !== "idle") {
				this.crawlWalkTrack?.Stop(0.2);
				this.crawlIdleTrack?.Play(0.2);
				this.crawlIdleTrack?.AdjustSpeed(MovementConfig.CROUCH.crawlIdleAnimSpeed);
				this.currentCrawlAnim = "idle";
			}
		} else {
			if (this.currentCrawlAnim !== "walk") {
				this.crawlIdleTrack?.Stop(0.2);
				this.crawlWalkTrack?.Play(0.2);
				this.crawlWalkTrack?.AdjustSpeed(MovementConfig.CROUCH.crawlWalkAnimSpeed);
				this.currentCrawlAnim = "walk";
			}
		}
	}

	private onHeartbeat(dt: number): void {
		if (!this.humanoid || !this.rootPart || this.humanoid.Health <= 0) return;

		// Freefall check
		if (!this.isOnGround) {
			this.freefallTimer += dt;
			if (this.freefallTimer >= MovementConfig.CROUCH.maxFreefallTime) {
				if (this.isCrawling) {
					this.stopCrawl();
				}
				if (this.isCrouching) {
					this.toggleCrouch();
				}
			}
		}

		if (this.isCrawling) {
			this.updateCrawlAnims();
		} else if (this.isCrouching) {
			this.updateCrouchAnims();
		}
	}

	private playSound(soundId: string, parent: Instance): void {
		if (!soundId) return;
		pcall(() => {
			const sound = new Instance("Sound");
			sound.SoundId = soundId;
			sound.Volume = 1.0;
			sound.RollOffMinDistance = 15;
			sound.RollOffMaxDistance = 150;
			sound.Parent = parent;
			sound.Play();
			sound.Ended.Once(() => sound.Destroy());
			task.delay(3, () => {
				if (sound.Parent) sound.Destroy();
			});
		});
	}

	public getIsCrouching(): boolean {
		return this.isCrouching;
	}

	public getIsCrawling(): boolean {
		return this.isCrawling;
	}

	public getIsSprinting(): boolean {
		return this.isSprinting;
	}
}
