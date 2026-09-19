import { Players, RunService, UserInputService, Workspace } from "@rbxts/services";
import { MovementConfig } from "shared/config/MovementConfig";
import { PlayerTiltState, R6JointData } from "shared/types";
import { SpawnCinematicController } from "./SpawnCinematicController";

interface CharacterLocomotionTracks {
	idle: AnimationTrack;
	walk: AnimationTrack;
	run: AnimationTrack;
	jump: AnimationTrack;
	fall: AnimationTrack;
	climb: AnimationTrack;
}

export class MovementController {
	private static instance?: MovementController;

	private readonly player: Player;
	private characterJointData = new Map<Model, R6JointData>();
	private characterLocomotion = new Map<Model, CharacterLocomotionTracks>();
	private playerTiltStates = new Map<Player, PlayerTiltState>();
	private trackedPlayers: Player[] = [];

	// Local player sprint punch state
	private localTiltState?: PlayerTiltState;

	// Camera bobbing state
	private isCameraBobbingEnabled = true;
	private isLeanEnabled = true;

	private bobbingFunc1 = 0;
	private bobbingFunc2 = 0;
	private bobbingFunc3 = 0;
	private bobbingFunc4 = 0;
	private bobbingVal = 0;
	private bobbingVal2 = 0;
	private bobbingInt = 5;
	private bobbingInt2 = 5;

	private constructor() {
		this.player = Players.LocalPlayer;
		this.init();
	}

	public static getInstance(): MovementController {
		if (!MovementController.instance) {
			MovementController.instance = new MovementController();
		}
		return MovementController.instance;
	}

	private init(): void {
		if (this.player.Character) {
			this.onCharacterAdded(this.player.Character);
		}
		this.player.CharacterAdded.Connect((char) => {
			this.onCharacterAdded(char);
		});

		RunService.RenderStepped.Connect((dt) => {
			this.onRenderStepped(dt);
		});

		print("[MovementController] Ultimate R6 Movement System initialized successfully.");
	}

	private onCharacterAdded(char: Model): void {
		this.applyCharacterAnimations(char);

		// Bersihkan cache joint data karakter lama
		for (const [c] of this.characterJointData) {
			if (!c.Parent || c === char) {
				this.characterJointData.delete(c);
			}
		}

		// Reset total tilt state lokal agar karakter baru tidak mewarisi rotasi rusak / NaN
		const freshTiltState: PlayerTiltState = {
			currentAngles: [0, 0, 0],
			currentMomentumFactor: MovementConfig.TILT.walkMomentumFactor,
			punchAmount: 0,
			punchActive: false,
		};
		this.playerTiltStates.set(this.player, freshTiltState);
		this.localTiltState = freshTiltState;

		const humanoid = char.WaitForChild("Humanoid", 5) as Humanoid | undefined;
		const hrp = char.WaitForChild("HumanoidRootPart", 5) as BasePart | undefined;

		if (char === this.player.Character && hrp && humanoid) {
			humanoid.UseJumpPower = true;
			humanoid.JumpPower = MovementConfig.JUMP.jumpPower;

			if (SpawnCinematicController.getInstance().isFinished()) {
				hrp.Anchored = false;
				humanoid.AutoRotate = true;
			}

			this.initLocomotionTracks(char, humanoid);
		}

		if (humanoid) {
			humanoid.GetPropertyChangedSignal("WalkSpeed").Connect(() => {
				const threshold = MovementConfig.TURNING.sprintSpeedThreshold;
				if (humanoid.WalkSpeed >= threshold) {
					if (this.localTiltState) {
						this.localTiltState.punchAmount = MovementConfig.SPRINT_PUNCH.punchStrength;
						this.localTiltState.punchActive = true;
					}
				} else {
					if (this.localTiltState) {
						this.localTiltState.punchActive = false;
						this.localTiltState.punchAmount = 0;
					}
				}
			});
		}
	}

	/**
	 * Mencegah kebocoran memori dengan menonaktifkan script Animate kuno bawaan Roblox
	 * dan membersihkan track default lama agar track kustom ter-cache beroperasi mulus.
	 */
	public applyCharacterAnimations(char: Model): void {
		// 1. Musnahkan script Animate bawaan seketika agar seluruh koneksi event listener internalnya terputus
		const killAnimateScript = (child: Instance) => {
			if (child.Name === "Animate" && (child.IsA("LocalScript") || child.IsA("Script"))) {
				child.Destroy();
			}
		};

		const existing = char.FindFirstChild("Animate");
		if (existing) {
			killAnimateScript(existing);
		}
		char.ChildAdded.Connect(killAnimateScript);

		task.spawn(() => {
			const humanoid = char.WaitForChild("Humanoid", 5) as Humanoid | undefined;
			const animator = humanoid?.WaitForChild("Animator", 5) as Animator | undefined;

			if (!animator) return;

			const isJunkTrack = (track: AnimationTrack): boolean => {
				const animId = track.Animation?.AnimationId ?? "";
				return (
					animId.find("roblox.com")[0] !== undefined ||
					animId.find("431048404")[0] !== undefined ||
					animId.find("519927093")[0] !== undefined ||
					animId.find("519919949")[0] !== undefined
				);
			};

			// 2. Hentikan dan musnahkan track default Roblox lama yang sempat aktif
			for (const track of animator.GetPlayingAnimationTracks()) {
				if (isJunkTrack(track)) {
					track.Stop(0);
					track.Destroy();
				}
			}

			// 3. FAIL-SAFE AUTO-PRUNER: Cegah akumulasi track liar tak terdaftar dari Roblox CoreScripts
			animator.AnimationPlayed.Connect((track) => {
				if (isJunkTrack(track)) {
					track.Stop(0);
					track.Destroy();
				}
			});
		});
	}

	/**
	 * Inisialisasi seluruh track locomotion (idle, walk, run, jump, fall, climb)
	 * secara terpusat dan ter-cache (hanya 1 track per jenis animasi seumur hidup karakter).
	 */
	private initLocomotionTracks(char: Model, humanoid: Humanoid): void {
		if (this.characterLocomotion.has(char)) return;

		const animator = humanoid.WaitForChild("Animator", 5) as Animator | undefined;
		if (!animator) return;

		const anims = MovementConfig.ANIMATIONS;

		const createTrack = (animId: string, priority: Enum.AnimationPriority, looped: boolean): AnimationTrack | undefined => {
			if (!animId) return undefined;
			try {
				const anim = new Instance("Animation");
				anim.AnimationId = animId;
				const track = animator.LoadAnimation(anim);
				track.Priority = priority;
				track.Looped = looped;
				return track;
			} catch (e) {
				warn(`[MovementController] Failed to load locomotion animation ${animId}:`, e);
				return undefined;
			}
		};

		const idleTrack = createTrack(anims.idle, Enum.AnimationPriority.Idle, true);
		const walkTrack = createTrack(anims.walk, Enum.AnimationPriority.Movement, true);
		const runTrack = createTrack(anims.run, Enum.AnimationPriority.Movement, true);
		const jumpTrack = createTrack(anims.jump, Enum.AnimationPriority.Movement, false);
		const fallTrack = createTrack(anims.fall, Enum.AnimationPriority.Movement, true);
		const climbTrack = createTrack(anims.climb, Enum.AnimationPriority.Movement, true);

		if (!idleTrack || !walkTrack || !runTrack || !jumpTrack || !fallTrack || !climbTrack) {
			warn("[MovementController] Some locomotion tracks failed to load.");
			return;
		}

		const trackSet: CharacterLocomotionTracks = {
			idle: idleTrack,
			walk: walkTrack,
			run: runTrack,
			jump: jumpTrack,
			fall: fallTrack,
			climb: climbTrack,
		};

		this.characterLocomotion.set(char, trackSet);

		// Hubungkan transisi state jump, fall, climb
		humanoid.StateChanged.Connect((_oldState, newState) => {
			if (humanoid.Health <= 0) return;

			// Jika sedang bermain skateboard, blokir seluruh animasi locomotion bawaan
			const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (hrp && hrp.GetAttribute("IsSkating") === true) {
				trackSet.jump.Stop(0);
				trackSet.fall.Stop(0);
				trackSet.climb.Stop(0);
				trackSet.walk.Stop(0);
				trackSet.run.Stop(0);
				trackSet.idle.Stop(0);
				return;
			}

			if (newState === Enum.HumanoidStateType.Jumping) {
				trackSet.fall.Stop(0.1);
				trackSet.walk.Stop(0.1);
				trackSet.run.Stop(0.1);
				trackSet.idle.Stop(0.1);
				trackSet.climb.Stop(0.1);
				trackSet.jump.Play(0.05);
			} else if (newState === Enum.HumanoidStateType.Freefall) {
				trackSet.jump.Stop(0.15);
				trackSet.walk.Stop(0.1);
				trackSet.run.Stop(0.1);
				trackSet.idle.Stop(0.1);
				trackSet.climb.Stop(0.1);
				if (!trackSet.fall.IsPlaying) {
					trackSet.fall.Play(0.15);
				}
			} else if (newState === Enum.HumanoidStateType.Climbing) {
				trackSet.jump.Stop(0.1);
				trackSet.fall.Stop(0.1);
				trackSet.walk.Stop(0.1);
				trackSet.run.Stop(0.1);
				trackSet.idle.Stop(0.1);
				if (!trackSet.climb.IsPlaying) {
					trackSet.climb.Play(0.1);
				}
			} else if (
				newState === Enum.HumanoidStateType.Landed ||
				newState === Enum.HumanoidStateType.Running ||
				newState === Enum.HumanoidStateType.RunningNoPhysics
			) {
				trackSet.jump.Stop(0.1);
				trackSet.fall.Stop(0.1);
				trackSet.climb.Stop(0.1);
			}
		});

		humanoid.Died.Connect(() => {
			this.destroyCharacterTracks(char);
		});

		// Langsung putar idle jika sedang diam saat inisialisasi dan tidak sedang bermain skateboard
		const hrpPart = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (
			humanoid.MoveDirection.Magnitude <= 0.05 &&
			humanoid.GetState() !== Enum.HumanoidStateType.Freefall &&
			hrpPart?.GetAttribute("IsSkating") !== true
		) {
			idleTrack.Play(0.1);
		}
	}

	private destroyCharacterTracks(char: Model): void {
		const tracks = this.characterLocomotion.get(char);
		if (tracks) {
			tracks.idle.Stop(0);
			tracks.idle.Destroy();
			tracks.walk.Stop(0);
			tracks.walk.Destroy();
			tracks.run.Stop(0);
			tracks.run.Destroy();
			tracks.jump.Stop(0);
			tracks.jump.Destroy();
			tracks.fall.Stop(0);
			tracks.fall.Destroy();
			tracks.climb.Stop(0);
			tracks.climb.Destroy();
			this.characterLocomotion.delete(char);
		}
	}

	private getR6JointData(char: Model): R6JointData | undefined {
		const cached = this.characterJointData.get(char);
		if (cached) return cached;

		const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const torso = char.FindFirstChild("Torso") as BasePart | undefined;
		if (!hrp || !torso) return undefined;

		const rootJoint = hrp.FindFirstChild("RootJoint") as Motor6D | undefined;
		const neck = torso.FindFirstChild("Neck") as Motor6D | undefined;
		const rightHip = torso.FindFirstChild("Right Hip") as Motor6D | undefined;
		const leftHip = torso.FindFirstChild("Left Hip") as Motor6D | undefined;

		if (!rootJoint || !neck || !rightHip || !leftHip) return undefined;

		const data: R6JointData = {
			rootJointC0: rootJoint.C0,
			neckC0: neck.C0,
			rightHipC0: rightHip.C0,
			leftHipC0: leftHip.C0,
		};

		this.characterJointData.set(char, data);
		return data;
	}

	private getTargetMomentumFactor(humanoid: Humanoid, hrp: BasePart): number {
		const isCrouching = hrp.GetAttribute("IsCrouching") === true;
		const walkSpeed = humanoid.WalkSpeed;
		const cfg = MovementConfig.TILT;

		if (isCrouching) {
			return cfg.crouchMomentumFactor;
		} else if (walkSpeed >= MovementConfig.TURNING.sprintSpeedThreshold) {
			return cfg.sprintMomentumFactor;
		} else {
			return cfg.walkMomentumFactor;
		}
	}

	private onRenderStepped(dt: number): void {
		// 1. Maintain player tracking list & tilt state
		for (const plr of Players.GetPlayers()) {
			if (!plr.Character) continue;
			if (!this.trackedPlayers.includes(plr)) {
				this.trackedPlayers.push(plr);
			}

			if (!this.playerTiltStates.has(plr)) {
				const state: PlayerTiltState = {
					currentAngles: [0, 0, 0],
					currentMomentumFactor: MovementConfig.TILT.walkMomentumFactor,
					punchAmount: 0,
					punchActive: false,
				};
				this.playerTiltStates.set(plr, state);
				if (plr === this.player) {
					this.localTiltState = state;
				}
			}
		}

		for (let i = this.trackedPlayers.size() - 1; i >= 0; i--) {
			const plr = this.trackedPlayers[i];
			if (!plr || !plr.Parent || !plr.Character) {
				if (plr && plr.Character) {
					this.characterJointData.delete(plr.Character);
					this.destroyCharacterTracks(plr.Character);
				}
				this.playerTiltStates.delete(plr);
				this.trackedPlayers.remove(i);
				continue;
			}

			const hrp = plr.Character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			const humanoid = plr.Character.FindFirstChild("Humanoid") as Humanoid | undefined;
			const torso = plr.Character.FindFirstChild("Torso") as BasePart | undefined;

			if (!hrp || !humanoid || !torso) continue;

			const tiltState = this.playerTiltStates.get(plr);
			if (!tiltState) continue;

			// Locomotion animations dikelola untuk local player dan direplikasi otomatis oleh Roblox
			if (plr === this.player) {
				this.updateLocomotionAnimations(hrp, humanoid, plr.Character);
			}

			// Directional turning & tilt IK
			if (this.isLeanEnabled) {
				this.calculateR6TurningAndTilt(dt, hrp, humanoid, torso, plr.Character, tiltState, plr === this.player);
			}

			// Local player only: Camera Bobbing
			if (plr === this.player && this.isCameraBobbingEnabled && hrp.GetAttribute("IsSkating") !== true) {
				this.calculateCameraBobbing(dt, hrp, humanoid);
			}
		}
	}

	/**
	 * Logika R6 Turning & Tilt prosedural sesuai template Ultimate R6 Movement System.
	 */
	private calculateR6TurningAndTilt(
		dt: number,
		hrp: BasePart,
		humanoid: Humanoid,
		torso: BasePart,
		char: Model,
		tiltState: PlayerTiltState,
		isLocalPlayer: boolean,
	): void {
		// 1. CRAWL & SKATE LOCK: Lewati manipulasi joint saat crawling atau skating
		if (hrp.GetAttribute("CrawlLock") === true || hrp.GetAttribute("IsSkating") === true) {
			return;
		}

		const rootJoint = hrp.FindFirstChild("RootJoint") as Motor6D | undefined;
		const neck = torso.FindFirstChild("Neck") as Motor6D | undefined;
		const rightHip = torso.FindFirstChild("Right Hip") as Motor6D | undefined;
		const leftHip = torso.FindFirstChild("Left Hip") as Motor6D | undefined;

		if (!rootJoint || !neck || !rightHip || !leftHip) return;

		const data = this.getR6JointData(char);
		if (!data) return;

		if (hrp.GetAttribute("IsSkating") === true) {
			const lerpFactor = math.clamp(dt * 15, 0, 1);
			rootJoint.C0 = rootJoint.C0.Lerp(data.rootJointC0, lerpFactor);
			neck.C0 = neck.C0.Lerp(data.neckC0, lerpFactor);
			rightHip.C0 = rightHip.C0.Lerp(data.rightHipC0, lerpFactor);
			leftHip.C0 = leftHip.C0.Lerp(data.leftHipC0, lerpFactor);
			return;
		}

		const cfgTurn = MovementConfig.TURNING;
		const cfgPunch = MovementConfig.SPRINT_PUNCH;

		// 2. Sprint punch decay
		if (isLocalPlayer && tiltState.punchActive) {
			tiltState.punchAmount += (0 - tiltState.punchAmount) * math.min(dt * cfgPunch.decaySpeed, 1);
			if (math.abs(tiltState.punchAmount) < 0.0005) {
				tiltState.punchAmount = 0;
				tiltState.punchActive = false;
			}
		}

		// 3. Turning logic
		let vel = hrp.AssemblyLinearVelocity;
		// Jika velocity melebihi batas wajar gameplay (misal terpental keluar map/glitch physics), abaikan
		if (vel.Magnitude > 150 || vel.X !== vel.X || vel.Y !== vel.Y || vel.Z !== vel.Z) {
			vel = Vector3.zero;
		}

		const speed = math.max(humanoid.WalkSpeed, 0.001);
		const rawDir = hrp.CFrame.VectorToObjectSpace(vel);
		let dirX = rawDir.X / speed;
		let dirZ = rawDir.Z / speed;
		if (dirX !== dirX) dirX = 0;
		if (dirZ !== dirZ) dirZ = 0;

		const rangeOfMotionRad = math.rad(cfgTurn.rangeOfMotion);
		const rangeOfMotionTorsoRad = math.rad(cfgTurn.rangeOfMotionTorso);
		const rangeOfMotionXZ = cfgTurn.rangeOfMotionXZ;

		const absZ = math.clamp(math.abs(dirZ), 0, 1.5);
		let xResult = dirX * (rangeOfMotionRad - absZ * (rangeOfMotionRad / 2));
		let xResultTorso = dirX * (rangeOfMotionTorsoRad - absZ * (rangeOfMotionTorsoRad / 2));
		let xResultXZ = dirX * (rangeOfMotionXZ - absZ * (rangeOfMotionXZ / 2));

		if (dirZ > 0.1) {
			xResult *= -1;
			xResultTorso *= -1;
			xResultXZ *= -1;
		}

		// Batasi sudut turning ke rentang aman agar tidak melipat tubuh
		xResult = math.clamp(xResult, -rangeOfMotionRad, rangeOfMotionRad);
		xResultTorso = math.clamp(xResultTorso, -rangeOfMotionTorsoRad, rangeOfMotionTorsoRad);
		xResultXZ = math.clamp(xResultXZ, -0.4, 0.4);

		// 4. Momentum factor blend
		const targetMomentumFactor = this.getTargetMomentumFactor(humanoid, hrp);
		const blendFactor = math.min(dt * cfgTurn.momentumBlendSpeed, 1);
		tiltState.currentMomentumFactor += (targetMomentumFactor - tiltState.currentMomentumFactor) * blendFactor;

		// 5. Tilt logic
		const momentumLocal = hrp.CFrame.VectorToObjectSpace(vel).mul(tiltState.currentMomentumFactor);
		const momentumX = math.clamp(math.abs(momentumLocal.X), cfgTurn.minMomentum, cfgTurn.maxMomentum);
		const momentumZ = math.clamp(math.abs(momentumLocal.Z), cfgTurn.minMomentum, cfgTurn.maxMomentum);

		const moveDirLocal = hrp.CFrame.VectorToObjectSpace(humanoid.MoveDirection);
		const maxTiltAngle = math.rad(30);
		const targetX = math.clamp(moveDirLocal.X * momentumX, -maxTiltAngle, maxTiltAngle);
		const targetZ = math.clamp(moveDirLocal.Z * momentumZ, -maxTiltAngle, maxTiltAngle);
		const targetAngles: [number, number, number] = [-targetZ, -targetX, 0];

		const smoothFactor = math.min(dt * cfgTurn.smoothSpeed, 1);
		for (let i = 0; i < 3; i++) {
			// Anti-NaN check: jika ada nilai corrupt, reset ke 0 seketika
			if (tiltState.currentAngles[i] !== tiltState.currentAngles[i]) {
				tiltState.currentAngles[i] = 0;
			}
			tiltState.currentAngles[i] += (targetAngles[i] - tiltState.currentAngles[i]) * smoothFactor;
			tiltState.currentAngles[i] = math.clamp(tiltState.currentAngles[i], -maxTiltAngle, maxTiltAngle);
		}

		// 6. Sprint punch offset
		const punchOffset = isLocalPlayer ? math.clamp(tiltState.punchAmount, -math.rad(35), math.rad(35)) : 0;
		const tiltCFrame = CFrame.Angles(
			tiltState.currentAngles[0] + punchOffset,
			tiltState.currentAngles[1],
			tiltState.currentAngles[2],
		);

		// 7. Calculate target C0s
		const rootJointResult = data.rootJointC0.mul(CFrame.Angles(0, 0, -xResultTorso)).mul(tiltCFrame);

		const neckResult = data.neckC0
			.mul(CFrame.Angles(0, 0, xResultTorso))
			.mul(
				CFrame.Angles(-tiltState.currentAngles[0] - punchOffset * 0.35, 0, -tiltState.currentAngles[2]),
			);

		const rightHipOffset = -math.abs(xResultXZ) + math.abs(-xResultXZ);
		const rightHipResult = data.rightHipC0
			.mul(new CFrame(-xResultXZ, 0, rightHipOffset))
			.mul(CFrame.Angles(0, -xResult, 0));

		const leftHipOffset = -math.abs(-xResultXZ) + math.abs(-xResultXZ);
		const leftHipResult = data.leftHipC0
			.mul(new CFrame(-xResultXZ, 0, leftHipOffset))
			.mul(CFrame.Angles(0, -xResult, 0));

		// 8. Lerp & Apply
		const lerpTime = 1 - math.pow(cfgTurn.lerpSpeed, dt);
		rightHip.C0 = rightHip.C0.Lerp(rightHipResult, lerpTime);
		leftHip.C0 = leftHip.C0.Lerp(leftHipResult, lerpTime);
		rootJoint.C0 = rootJoint.C0.Lerp(rootJointResult, lerpTime);
		neck.C0 = neck.C0.Lerp(neckResult, lerpTime);
	}

	// Settings states
	public setLeanEnabled(enabled: boolean): void {
		this.isLeanEnabled = enabled;
		if (!enabled) {
			if (this.localTiltState) {
				this.localTiltState.punchAmount = 0;
				this.localTiltState.punchActive = false;
				this.localTiltState.currentAngles = [0, 0, 0];
			}
		}
	}

	public isLeanActive(): boolean {
		return this.isLeanEnabled;
	}

	public setCameraBobbingEnabled(enabled: boolean): void {
		this.isCameraBobbingEnabled = enabled;
		if (!enabled) {
			this.bobbingFunc1 = 0;
			this.bobbingFunc2 = 0;
			this.bobbingFunc3 = 0;
			this.bobbingFunc4 = 0;
			this.bobbingVal = 0;
			this.bobbingVal2 = 0;
		}
	}

	public setPaused(paused: boolean): void {
		if (this.player.Character) {
			const hrp = this.player.Character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (hrp) {
				hrp.SetAttribute("IsSkating", paused);
			}
			const tracks = this.characterLocomotion.get(this.player.Character);
			if (tracks && paused) {
				tracks.walk.Stop(0);
				tracks.run.Stop(0);
				tracks.idle.Stop(0);
				tracks.fall.Stop(0);
				tracks.jump.Stop(0);
				tracks.climb.Stop(0);
			}
		}
	}

	public isCameraBobbingActive(): boolean {
		return this.isCameraBobbingEnabled;
	}

	/**
	 * Goyangan kamera (*head bobbing*) prosedural saat berjalan dan berlari.
	 */
	private calculateCameraBobbing(dt: number, hrp: BasePart, humanoid: Humanoid): void {
		if (!MovementConfig.BOBBING.enabled || !this.isCameraBobbingEnabled || hrp.GetAttribute("IsSkating") === true) return;
		const camera = Workspace.CurrentCamera;
		if (!camera || humanoid.Health <= 0) return;

		const dtScaled = dt * 30;
		const rootMagnitude = hrp ? new Vector3(hrp.AssemblyLinearVelocity.X, 0, hrp.AssemblyLinearVelocity.Z).Magnitude : 0;
		const calcRootMagnitude = math.min(rootMagnitude, 25);

		if (dtScaled > 1.5) {
			this.bobbingFunc1 = 0;
			this.bobbingFunc2 = 0;
		} else {
			const timeVal = os.clock();
			this.bobbingFunc1 = this.lerp(
				this.bobbingFunc1,
				math.cos(timeVal * 0.5 * 6) * (5 / 100) * dtScaled,
				0.05 * dtScaled,
			);
			this.bobbingFunc2 = this.lerp(
				this.bobbingFunc2,
				math.cos(timeVal * 0.5 * 3.5) * (3 / 100) * dtScaled,
				0.05 * dtScaled,
			);
		}

		const mouseDelta = UserInputService.GetMouseDelta();
		this.bobbingFunc3 = this.lerp(this.bobbingFunc3, math.clamp(mouseDelta.X, -2.5, 2.5), 0.25 * dtScaled);
		this.bobbingFunc4 = this.lerp(
			this.bobbingFunc4,
			(math.sin(os.clock() * this.bobbingInt) / 5) * math.min(1, this.bobbingInt2 / 10),
			0.25 * dtScaled,
		);

		if (rootMagnitude > 1) {
			this.bobbingVal = this.lerp(
				this.bobbingVal,
				math.cos(os.clock() * 0.5 * this.bobbingInt) * (this.bobbingInt / 200),
				0.25 * dtScaled,
			);
		} else {
			this.bobbingVal = this.lerp(this.bobbingVal, 0, 0.05 * dtScaled);
		}

		if (rootMagnitude > 6) {
			this.bobbingInt = 10;
			this.bobbingInt2 = 9;
		} else if (rootMagnitude > 0.1) {
			this.bobbingInt = 6;
			this.bobbingInt2 = 7;
		} else {
			this.bobbingInt2 = 0;
		}

		this.bobbingVal2 = math.clamp(
			this.lerp(
				this.bobbingVal2,
				-camera.CFrame.VectorToObjectSpace(hrp.AssemblyLinearVelocity.div(math.max(humanoid.WalkSpeed, 0.01))).X * 0.04,
				0.1 * dtScaled,
			),
			-0.12,
			0.1,
		);

		const rot1 = CFrame.fromEulerAnglesXYZ(0, 0, math.rad(this.bobbingFunc3));
		const rot2 = CFrame.fromEulerAnglesXYZ(math.rad(this.bobbingFunc4 * dtScaled), math.rad(this.bobbingVal * dtScaled), this.bobbingVal2);
		const rot3 = CFrame.Angles(0, 0, math.rad(this.bobbingFunc4 * dtScaled * (calcRootMagnitude / 5)));
		const rot4 = CFrame.fromEulerAnglesXYZ(math.rad(this.bobbingFunc1), math.rad(this.bobbingFunc2), math.rad(this.bobbingFunc2 * 10));

		camera.CFrame = camera.CFrame.mul(rot1).mul(rot2).mul(rot3).mul(rot4);
	}

	/**
	 * Mengelola transisi animasi jalan (Walk), lari (Run), dan Idle berprioritas Movement secara real-time.
	 * Memastikan animasi berjalan andal dan responsif tanpa duplikasi pemuatan track.
	 */
	private updateLocomotionAnimations(hrp: BasePart, humanoid: Humanoid, char: Model): void {
		const tracks = this.characterLocomotion.get(char);
		if (!tracks) return;

		const isCrouchOrCrawl =
			hrp.GetAttribute("IsCrouching") === true ||
			hrp.GetAttribute("IsCrawling") === true ||
			hrp.GetAttribute("CrawlLock") === true ||
			hrp.GetAttribute("IsSkating") === true;
		const isLanding = hrp.GetAttribute("IsLanding") === true;

		// Jika karakter sedang crouch, crawl, landing, skating, atau mati: serahkan ke controller terkait
		if (isCrouchOrCrawl || isLanding || humanoid.Health <= 0) {
			if (tracks.walk.IsPlaying) tracks.walk.Stop(0);
			if (tracks.run.IsPlaying) tracks.run.Stop(0);
			if (tracks.idle.IsPlaying) tracks.idle.Stop(0);
			if (tracks.fall.IsPlaying) tracks.fall.Stop(0);
			if (tracks.jump.IsPlaying) tracks.jump.Stop(0);
			if (tracks.climb.IsPlaying) tracks.climb.Stop(0);
			return;
		}

		const state = humanoid.GetState();
		const isAirborne = state === Enum.HumanoidStateType.Freefall || state === Enum.HumanoidStateType.Jumping;
		const isClimbing = state === Enum.HumanoidStateType.Climbing;

		if (isAirborne || isClimbing) {
			if (tracks.walk.IsPlaying) tracks.walk.Stop(0.15);
			if (tracks.run.IsPlaying) tracks.run.Stop(0.15);
			if (tracks.idle.IsPlaying) tracks.idle.Stop(0.15);
			return;
		}

		// Karakter berada di tanah
		const isMoving = humanoid.MoveDirection.Magnitude > 0.05;
		const isSprinting = humanoid.WalkSpeed >= MovementConfig.TURNING.sprintSpeedThreshold;

		if (isMoving) {
			if (tracks.idle.IsPlaying) {
				tracks.idle.Stop(0.15);
			}

			if (isSprinting) {
				// Sprinting (Lari)
				if (tracks.walk.IsPlaying) {
					tracks.walk.Stop(0.15);
				}
				if (!tracks.run.IsPlaying) {
					tracks.run.Play(0.15);
				}
				const runSpeed = math.clamp(humanoid.WalkSpeed / 20, 0.8, 1.6);
				tracks.run.AdjustSpeed(runSpeed);
			} else {
				// Walking (Jalan)
				if (tracks.run.IsPlaying) {
					tracks.run.Stop(0.15);
				}
				if (!tracks.walk.IsPlaying) {
					tracks.walk.Play(0.15);
				}
				const walkSpeed = math.clamp(humanoid.WalkSpeed / 14, 0.8, 1.4);
				tracks.walk.AdjustSpeed(walkSpeed);
			}
		} else {
			// Karakter diam di tanah (Idle)
			if (tracks.walk.IsPlaying) {
				tracks.walk.Stop(0.15);
			}
			if (tracks.run.IsPlaying) {
				tracks.run.Stop(0.15);
			}
			if (!tracks.idle.IsPlaying) {
				tracks.idle.Play(0.2);
			}
		}
	}

	private lerp(a: number, b: number, c: number): number {
		return a + (b - a) * c;
	}
}
