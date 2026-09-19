import { Players, RunService } from "@rbxts/services";
import { MovementConfig } from "shared/config/MovementConfig";
import { MovementStaminaState } from "shared/types";

export class StaminaController {
	private static instance?: StaminaController;

	private readonly player: Player;
	private hrp?: BasePart;
	private humanoid?: Humanoid;

	private stamina: number = MovementConfig.STAMINA.maxStamina;
	private exhausted = false;
	private regenTimer = 0;
	private isPaused = false;

	private heartbeatSound?: Sound;
	private listeners = new Set<(state: MovementStaminaState) => void>();

	private constructor() {
		this.player = Players.LocalPlayer;
		this.init();
	}

	public static getInstance(): StaminaController {
		if (!StaminaController.instance) {
			StaminaController.instance = new StaminaController();
		}
		return StaminaController.instance;
	}

	public setPaused(paused: boolean): void {
		this.isPaused = paused;
		if (paused) {
			this.stopHeartbeatSound();
		}
	}

	private init(): void {
		if (this.player.Character) {
			this.onCharacterAdded(this.player.Character);
		}
		this.player.CharacterAdded.Connect((char) => this.onCharacterAdded(char));

		RunService.Heartbeat.Connect((dt) => {
			this.onHeartbeat(dt);
		});

		print("[StaminaController] Ultimate R6 Stamina System Controller initialized successfully.");
	}

	private onCharacterAdded(char: Model): void {
		this.stamina = MovementConfig.STAMINA.maxStamina;
		this.exhausted = false;
		this.regenTimer = 0;

		this.stopHeartbeatSound();

		this.humanoid = char.WaitForChild("Humanoid", 5) as Humanoid | undefined;
		this.hrp = char.WaitForChild("HumanoidRootPart", 5) as BasePart | undefined;

		if (this.hrp) {
			this.hrp.SetAttribute("CanSprint", true);
		}

		this.notifyStateChanged();
	}

	private onHeartbeat(dt: number): void {
		if (!this.humanoid || !this.hrp || this.humanoid.Health <= 0) return;

		// Jika sistem dijeda atau karakter sedang bermain skateboard, hentikan drain & heartbeat
		if (this.isPaused || this.hrp.GetAttribute("IsSkating") === true) {
			if (this.heartbeatSound) {
				this.stopHeartbeatSound();
			}
			return;
		}

		const cfg = MovementConfig.STAMINA;
		const isMoving = this.hrp.AssemblyLinearVelocity.Magnitude > 0.5;
		const isSprinting = this.humanoid.WalkSpeed >= cfg.sprintSpeedThreshold && isMoving;

		if (isSprinting) {
			this.regenTimer = 0;
			this.stamina = math.max(0, this.stamina - cfg.drainRate * dt);

			if (this.stamina <= 0 && !this.exhausted) {
				this.exhausted = true;
				this.hrp.SetAttribute("CanSprint", false);
				this.playHeartbeatSound();
			}
			this.notifyStateChanged();
		} else {
			this.regenTimer += dt;
			if (this.regenTimer >= cfg.regenDelay && this.stamina < cfg.maxStamina) {
				this.stamina = math.min(cfg.maxStamina, this.stamina + cfg.regenRate * dt);

				if (this.exhausted && this.stamina >= cfg.minStaminaSprint) {
					this.exhausted = false;
					this.hrp.SetAttribute("CanSprint", true);
					this.stopHeartbeatSound();
				}
				this.notifyStateChanged();
			}
		}
	}

	private playHeartbeatSound(): void {
		if (this.heartbeatSound && this.heartbeatSound.IsPlaying) return;
		if (!this.hrp) return;

		const soundId = MovementConfig.SOUNDS.heartBeat;
		if (!soundId) return;

		try {
			if (!this.heartbeatSound) {
				this.heartbeatSound = new Instance("Sound");
				this.heartbeatSound.SoundId = soundId;
				this.heartbeatSound.Volume = 0.8;
				this.heartbeatSound.Looped = true;
				this.heartbeatSound.Parent = this.hrp;
			}
			this.heartbeatSound.Play();
		} catch (e) {
			warn("[StaminaController] Failed to play heartbeat sound:", e);
		}
	}

	private stopHeartbeatSound(): void {
		if (this.heartbeatSound) {
			this.heartbeatSound.Stop();
			this.heartbeatSound.Destroy();
			this.heartbeatSound = undefined;
		}
	}

	public subscribe(listener: (state: MovementStaminaState) => void): () => void {
		this.listeners.add(listener);
		listener(this.getState());
		return () => this.listeners.delete(listener);
	}

	private notifyStateChanged(): void {
		const state = this.getState();
		for (const listener of this.listeners) {
			listener(state);
		}
	}

	public getState(): MovementStaminaState {
		return {
			current: this.stamina,
			max: MovementConfig.STAMINA.maxStamina,
			isExhausted: this.exhausted,
			canSprint: !this.exhausted,
		};
	}

	public getStaminaPercent(): number {
		return this.stamina / MovementConfig.STAMINA.maxStamina;
	}
}
