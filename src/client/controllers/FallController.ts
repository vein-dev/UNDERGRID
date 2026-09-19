import { Players, RunService, Workspace } from "@rbxts/services";
import { MovementConfig } from "shared/config/MovementConfig";
import { getRemoteEvent } from "shared/network/Remotes";

export class FallController {
	private static instance?: FallController;

	private readonly player: Player;
	private humanoid?: Humanoid;
	private hrp?: BasePart;

	private isFalling = false;
	private previousHeight?: number;

	// Animation Tracks
	private fallLongTrack?: AnimationTrack;
	private fallShortTrack?: AnimationTrack;
	private landNormalTrack?: AnimationTrack;

	// Active camera shake connection
	private shakeConnection?: RBXScriptConnection;

	private constructor() {
		this.player = Players.LocalPlayer;
		this.init();
	}

	public static getInstance(): FallController {
		if (!FallController.instance) {
			FallController.instance = new FallController();
		}
		return FallController.instance;
	}

	private init(): void {
		if (this.player.Character) {
			this.onCharacterAdded(this.player.Character);
		}
		this.player.CharacterAdded.Connect((char) => this.onCharacterAdded(char));

		print("[FallController] Ultimate R6 Fall System Controller initialized successfully.");
	}

	private onCharacterAdded(char: Model): void {
		this.isFalling = false;
		this.previousHeight = undefined;

		this.humanoid = char.WaitForChild("Humanoid", 5) as Humanoid | undefined;
		this.hrp = char.WaitForChild("HumanoidRootPart", 5) as BasePart | undefined;

		if (!this.humanoid || !this.hrp) return;

		const animator = this.humanoid.WaitForChild("Animator", 5) as Animator | undefined;
		if (animator) {
			const anims = MovementConfig.ANIMATIONS;
			this.fallLongTrack = this.loadAnimationTrack(animator, anims.fallLong);
			this.fallShortTrack = this.loadAnimationTrack(animator, anims.fallShort);
			this.landNormalTrack = this.loadAnimationTrack(animator, anims.landNormal);
		}

		this.humanoid.StateChanged.Connect((_oldState, newState) => {
			this.onStateChanged(newState);
		});
	}

	private loadAnimationTrack(animator: Animator, animId: string): AnimationTrack | undefined {
		if (!animId) return undefined;
		try {
			const anim = new Instance("Animation");
			anim.AnimationId = animId;
			const track = animator.LoadAnimation(anim);
			track.Priority = Enum.AnimationPriority.Action;
			track.Looped = false;
			return track;
		} catch (e) {
			warn(`[FallController] Failed to load animation: ${animId}`);
			return undefined;
		}
	}

	private onStateChanged(newState: Enum.HumanoidStateType): void {
		if (!this.hrp || !this.humanoid || this.humanoid.Health <= 0 || this.hrp.GetAttribute("IsSkating") === true) return;

		if (newState === Enum.HumanoidStateType.Jumping) {
			// Saat melompat kembali, hentikan semua track landing seketika agar tidak menimpa animasi jump
			this.stopLandingTracks();
			this.isFalling = false;
			this.previousHeight = undefined;
		} else if (newState === Enum.HumanoidStateType.Freefall) {
			if (!this.isFalling) {
				this.isFalling = true;
				this.previousHeight = this.hrp.Position.Y;
			}
		} else if (
			this.isFalling &&
			(newState === Enum.HumanoidStateType.Landed ||
				newState === Enum.HumanoidStateType.Running ||
				newState === Enum.HumanoidStateType.RunningNoPhysics)
		) {
			this.isFalling = false;
			const landingHeight = this.hrp.Position.Y;
			const fallDistance = this.previousHeight !== undefined ? math.max(0, this.previousHeight - landingHeight) : 0;
			this.previousHeight = undefined;

			this.handleLanding(fallDistance);
		}
	}

	private stopLandingTracks(): void {
		if (this.landNormalTrack && this.landNormalTrack.IsPlaying) {
			this.landNormalTrack.Stop(0.1);
		}
		if (this.fallShortTrack && this.fallShortTrack.IsPlaying) {
			this.fallShortTrack.Stop(0.1);
		}
		if (this.fallLongTrack && this.fallLongTrack.IsPlaying) {
			this.fallLongTrack.Stop(0.1);
		}
		if (this.hrp) {
			this.hrp.SetAttribute("IsLanding", false);
		}
	}

	private handleLanding(fallDistance: number): void {
		if (!this.hrp || !this.humanoid) return;
		const cfg = MovementConfig.FALL;
		const sounds = MovementConfig.SOUNDS;

		if (fallDistance > cfg.highFallThreshold) {
			// Large Fall
			const damage = math.floor((fallDistance - cfg.minDamageHeight) * cfg.damageMultiplier);
			if (damage > 0) {
				getRemoteEvent("FallDamageEvent").FireServer(damage);
			}

			this.playSound(sounds.fallLarge, this.hrp);

			if (this.fallLongTrack) {
				this.hrp.SetAttribute("IsLanding", true);
				this.fallLongTrack.Play(0.1);
				task.delay(cfg.largeFallAnimDuration, () => {
					this.fallLongTrack?.Stop(0.2);
					this.hrp?.SetAttribute("IsLanding", false);
				});
			}

			// Scaled camera shake
			const factor = math.clamp(fallDistance / 30, 0.5, 1.5);
			const duration = math.min(cfg.baseShakeDuration * factor, cfg.maxShakeDuration);
			const magnitude = math.min(cfg.baseShakeMagnitude * factor, cfg.maxShakeMagnitude);
			this.shakeCamera(duration, magnitude);
		} else if (fallDistance > cfg.minDamageHeight) {
			// Small Fall
			const damage = math.floor((fallDistance - cfg.minDamageHeight) * cfg.damageMultiplier);
			if (damage > 0) {
				getRemoteEvent("FallDamageEvent").FireServer(damage);
			}

			this.playSound(sounds.fallMedium, this.hrp);

			if (this.fallShortTrack) {
				this.hrp.SetAttribute("IsLanding", true);
				this.fallShortTrack.Play(0.1);
				task.delay(cfg.smallFallAnimDuration, () => {
					this.fallShortTrack?.Stop(0.2);
					this.hrp?.SetAttribute("IsLanding", false);
				});
			}

			this.shakeCamera(cfg.shortFallShakeDuration, cfg.shortFallShakeMagnitude);
		} else if (fallDistance > cfg.minFallThreshold) {
			// Normal tiny land dari ketinggian di atas loncatan biasa (> 3.8 studs)
			this.playSound(sounds.fallSmall, this.hrp);

			if (this.landNormalTrack) {
				this.hrp.SetAttribute("IsLanding", true);
				this.landNormalTrack.Play(0.1);
				task.delay(cfg.normalLandAnimDuration, () => {
					this.landNormalTrack?.Stop(0.2);
					this.hrp?.SetAttribute("IsLanding", false);
				});
			}
		}
	}

	/**
	 * Perlin noise camera shake dengan organic fade-in dan quadratic fade-out.
	 */
	public shakeCamera(duration: number, magnitude: number): void {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		this.shakeConnection?.Disconnect();

		const startTime = os.clock();
		const noiseSpeed = MovementConfig.FALL.noiseSpeed;
		const seedX = math.random(0, 1000);
		const seedY = math.random(0, 1000);
		const seedZ = math.random(0, 1000);
		const rotationMagnitude = math.min(magnitude * 1.2, 4);

		this.shakeConnection = RunService.RenderStepped.Connect(() => {
			const elapsed = os.clock() - startTime;
			if (elapsed < duration) {
				const progress = elapsed / duration;
				const fadeIn = math.min(elapsed / (duration * 0.15), 1);
				const fadeOut = (1 - progress) * (1 - progress);
				const envelope = fadeIn * fadeOut;

				const intensity = magnitude * envelope;
				const rotIntensity = rotationMagnitude * envelope;

				const offsetX = math.noise(elapsed * noiseSpeed, seedX, 0) * 2 * intensity;
				const offsetY = math.noise(elapsed * noiseSpeed, seedY, 0) * 2 * intensity;
				const rotZ = math.noise(elapsed * noiseSpeed, seedZ, 0) * 2 * rotIntensity;

				camera.CFrame = camera.CFrame.mul(new CFrame(offsetX, offsetY, 0)).mul(
					CFrame.Angles(0, 0, math.rad(rotZ)),
				);
			} else {
				this.shakeConnection?.Disconnect();
				this.shakeConnection = undefined;
			}
		});
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
}
