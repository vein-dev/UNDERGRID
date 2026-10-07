import { Debris, Players, RunService, TweenService, Workspace } from "@rbxts/services";
import { ARCZIS_COMBAT_CONFIG } from "shared/types";

interface RagdollSession {
	character: Model;
	token: number;
	motors: Motor6D[];
	createdInstances: Instance[];
}

/**
 * ServerRagdollService - Authoritative dynamic ragdoll system for combat impacts:
 * handles transitions between rigid Motor6D joints and dynamic physics BallSocketConstraints,
 * with smooth upright recovery to eliminate stiff snapping.
 */
export class ServerRagdollService {
	private static instance?: ServerRagdollService;
	private activeSessions = new Map<Model, RagdollSession>();
	private currentToken = 0;

	private constructor() {}

	public static getInstance(): ServerRagdollService {
		if (!ServerRagdollService.instance) {
			ServerRagdollService.instance = new ServerRagdollService();
		}
		return ServerRagdollService.instance;
	}

	public init(): void {
		print("[ServerRagdollService] Initialized successfully.");
	}

	/**
	 * Checks if a character is currently in a ragdoll state.
	 */
	public isRagdolled(character: Model): boolean {
		return this.activeSessions.has(character);
	}

	/**
	 * Applies a dynamic ragdoll state to the specified character for a set duration.
	 * @param character Target character model
	 * @param duration Duration in seconds
	 * @param pushVelocity Optional physical impulse vector
	 */
	public applyRagdoll(character: Model, duration: number, pushVelocity?: Vector3): void {
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid) return;

		const hrp = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!hrp) return;

		// Cancel any existing active session on the same character to prevent duplicate constraints
		if (this.activeSessions.has(character)) {
			this.removeRagdoll(character, true);
		}

		this.currentToken++;
		const sessionToken = this.currentToken;

		const createdInstances: Instance[] = [];
		const affectedMotors: Motor6D[] = [];

		// Mark character with attribute for client animation / movement controllers
		character.SetAttribute("IsGettingUp", false);
		character.SetAttribute("IsRagdoll", true);

		// Find all humanoid rig Motor6Ds
		for (const desc of character.GetDescendants()) {
			if (desc.IsA("Motor6D")) {
				const part0 = desc.Part0;
				const part1 = desc.Part1;

				if (part0 && part1 && part0.IsDescendantOf(character) && part1.IsDescendantOf(character)) {
					// Disable the Motor6D to allow free physics motion
					desc.Enabled = false;
					affectedMotors.push(desc);

					// Create attachment on Part0
					const att0 = new Instance("Attachment");
					att0.Name = `RagdollAtt0_${desc.Name}`;
					att0.CFrame = desc.C0;
					att0.Parent = part0;
					createdInstances.push(att0);

					// Create attachment on Part1
					const att1 = new Instance("Attachment");
					att1.Name = `RagdollAtt1_${desc.Name}`;
					att1.CFrame = desc.C1;
					att1.Parent = part1;
					createdInstances.push(att1);

					// Create BallSocketConstraint with realistic angular limits
					const socket = new Instance("BallSocketConstraint");
					socket.Name = `RagdollSocket_${desc.Name}`;
					socket.Attachment0 = att0;
					socket.Attachment1 = att1;
					socket.LimitsEnabled = true;
					socket.TwistLimitsEnabled = true;
					socket.UpperAngle = 50;
					socket.TwistLowerAngle = -45;
					socket.TwistUpperAngle = 45;
					socket.Parent = part0;
					createdInstances.push(socket);

					// Create NoCollisionConstraint between connected limbs to prevent jitter
					const noCollide = new Instance("NoCollisionConstraint");
					noCollide.Name = `RagdollNoCollide_${desc.Name}`;
					noCollide.Part0 = part0;
					noCollide.Part1 = part1;
					noCollide.Parent = part0;
					createdInstances.push(noCollide);
				}
			}
		}

		// Configure collisions & humanoid physics state
		hrp.CanCollide = false;
		for (const part of character.GetChildren()) {
			if (part.IsA("BasePart") && part !== hrp) {
				part.CanCollide = true;
			}
		}

		humanoid.AutoRotate = false;
		humanoid.PlatformStand = true;

		// Apply physical momentum / impulse if provided
		if (pushVelocity && pushVelocity.Magnitude > 0.1) {
			const torso = (character.FindFirstChild("Torso") ?? character.FindFirstChild("UpperTorso")) as BasePart | undefined;
			const targetPart = torso ?? hrp;
			targetPart.AssemblyLinearVelocity = pushVelocity;
		}

		const session: RagdollSession = {
			character,
			token: sessionToken,
			motors: affectedMotors,
			createdInstances,
		};
		this.activeSessions.set(character, session);

		// Schedule recovery
		task.delay(duration, () => {
			const currentSession = this.activeSessions.get(character);
			if (currentSession && currentSession.token === sessionToken) {
				this.removeRagdoll(character, false);
			}
		});
	}

	/**
	 * Restores a character from ragdoll back to standard animated movement with smooth upright recovery.
	 * @param character Target character model
	 * @param immediate If true, skips get-up recovery window (e.g. on respawn or new hit)
	 */
	public removeRagdoll(character: Model, immediate = false): void {
		const session = this.activeSessions.get(character);
		if (!session) return;

		this.activeSessions.delete(character);

		// Destroy all temporary constraints and attachments
		for (const inst of session.createdInstances) {
			inst.Destroy();
		}

		// Re-enable Motor6D joints
		for (const motor of session.motors) {
			if (motor.Parent) {
				motor.Enabled = true;
			}
		}

		character.SetAttribute("IsRagdoll", false);

		const humanoid = character.FindFirstChildOfClass("Humanoid");
		const hrp = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const torso = (character.FindFirstChild("Torso") ?? character.FindFirstChild("UpperTorso")) as BasePart | undefined;

		if (hrp) {
			hrp.CanCollide = true;
			hrp.AssemblyLinearVelocity = Vector3.zero;
			hrp.AssemblyAngularVelocity = Vector3.zero;

			// Capture current horizontal facing orientation
			let yaw = 0;
			const [, y] = hrp.CFrame.ToEulerAnglesYXZ();
			yaw = y;

			// Locate ground elevation below the torso to prevent teleport snaps
			const torsoPos = torso?.Position ?? hrp.Position;
			const rayParams = new RaycastParams();
			rayParams.FilterType = Enum.RaycastFilterType.Exclude;
			rayParams.FilterDescendantsInstances = [character];

			const ray = Workspace.Raycast(torsoPos.add(new Vector3(0, 3, 0)), new Vector3(0, -12, 0), rayParams);
			const floorY = ray ? ray.Position.Y : torsoPos.Y - 2.5;

			// Natural standing height for humanoid root
			const standY = floorY + 2.85;
			const targetCFrame = new CFrame(new Vector3(torsoPos.X, standY, torsoPos.Z)).mul(CFrame.Angles(0, yaw, 0));

			if (immediate) {
				hrp.CFrame = targetCFrame;
			} else {
				// Smoothly lift character from floor to upright position over 0.22 seconds
				const tween = TweenService.Create(
					hrp,
					new TweenInfo(0.22, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
					{ CFrame: targetCFrame },
				);
				tween.Play();
			}
		}

		if (humanoid && humanoid.Health > 0) {
			if (immediate) {
				character.SetAttribute("IsGettingUp", false);
				humanoid.PlatformStand = false;
				humanoid.AutoRotate = true;
				humanoid.ChangeState(Enum.HumanoidStateType.GettingUp);
				return;
			}

			character.SetAttribute("IsGettingUp", true);
			humanoid.PlatformStand = false;
			humanoid.AutoRotate = false;
			humanoid.WalkSpeed = 0;
			humanoid.JumpPower = 0;

			// Play Get-Up recovery animation with smooth fade blending
			const animator = humanoid.FindFirstChildOfClass("Animator");
			let getUpTrack: AnimationTrack | undefined;
			if (animator) {
				const animId = ARCZIS_COMBAT_CONFIG.Animations.GetUp;
				if (animId && animId !== "") {
					const anim = new Instance("Animation");
					anim.AnimationId = animId;
					getUpTrack = animator.LoadAnimation(anim);
					getUpTrack.Priority = Enum.AnimationPriority.Action4;
					getUpTrack.Play(0.2);
				}
			}

			// Controlled recovery period (0.65s) before returning full movement control
			task.delay(0.65, () => {
				if (character.Parent && humanoid.Health > 0) {
					character.SetAttribute("IsGettingUp", false);
					humanoid.AutoRotate = true;
					humanoid.WalkSpeed = ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed;
					humanoid.UseJumpPower = true;
					humanoid.JumpPower = 50;
					humanoid.ChangeState(Enum.HumanoidStateType.GettingUp);

					if (getUpTrack && getUpTrack.IsPlaying) {
						getUpTrack.Stop(0.25);
					}
				}
			});
		}
	}
}
