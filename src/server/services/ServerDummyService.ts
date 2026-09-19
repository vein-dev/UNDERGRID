import { Debris, Players, Workspace } from "@rbxts/services";
import { getBindableEvent } from "shared/network";
import { ARCZIS_COMBAT_CONFIG } from "shared/types";
import { ServerCombatService } from "./ServerCombatService";

interface DummyState {
	model: Model;
	humanoid: Humanoid;
	rootPart: BasePart;
	animator: Animator;
	dummyType: "Normal" | "Blocking" | "Attacking";
	initialCFrame: CFrame;
	animTracks: Map<string, AnimationTrack>;
	isDead: boolean;
	lastAttackTime: number;
}

/**
 * ServerDummyService - Manages training dummies (Normal, Blocking, Attacking).
 * Automatically detects dummy models in Workspace and integrates them with the Arczis combat system.
 */
export class ServerDummyService {
	private static instance?: ServerDummyService;
	private dummies = new Map<Model, DummyState>();
	private dummyHitEvent!: BindableEvent;

	private constructor() {}

	public static getInstance(): ServerDummyService {
		if (!ServerDummyService.instance) {
			ServerDummyService.instance = new ServerDummyService();
		}
		return ServerDummyService.instance;
	}

	public init(): void {
		this.dummyHitEvent = getBindableEvent("DummyHitEvent");

		// Listen to dummy hit events fired by ServerCombatService
		this.dummyHitEvent.Event.Connect((dummyModel, attackType, attackerChar, reactionType) => {
			this.onDummyHit(
				dummyModel as Model,
				attackType as string,
				attackerChar as Model,
				reactionType as string,
			);
		});

		// Initial scan for existing dummies in Workspace
		this.scanWorkspace();

		// Listen for dynamically spawned dummies
		Workspace.DescendantAdded.Connect((inst) => {
			if (inst.IsA("Model") && this.isDummyModel(inst)) {
				task.delay(0.5, () => this.setupDummy(inst));
			}
		});

		// Attacking dummy AI loop
		task.spawn(() => this.attackingDummyLoop());

		print("[ServerDummyService] Initialized successfully. Watching for training dummies.");
	}

	private isDummyModel(model: Model): boolean {
		const name = model.Name.lower();
		return (
			name.find("dummy")[0] !== undefined ||
			model.GetAttribute("DummyType") !== undefined
		);
	}

	private scanWorkspace(): void {
		for (const descendant of Workspace.GetDescendants()) {
			if (descendant.IsA("Model") && this.isDummyModel(descendant)) {
				this.setupDummy(descendant);
			}
		}
	}

	private determineDummyType(model: Model): "Normal" | "Blocking" | "Attacking" {
		const attr = model.GetAttribute("DummyType") as string | undefined;
		if (attr === "Blocking" || model.Name.find("Blocking")[0] !== undefined) {
			return "Blocking";
		}
		if (attr === "Attacking" || model.Name.find("Attacking")[0] !== undefined) {
			return "Attacking";
		}
		return "Normal";
	}

	public setupDummy(model: Model): void {
		if (this.dummies.has(model)) return;

		const humanoid = model.FindFirstChildOfClass("Humanoid");
		const rootPart = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!humanoid || !rootPart) return;

		const dummyType = this.determineDummyType(model);
		model.SetAttribute("DummyType", dummyType);

		// Ensure Animator
		let animator = humanoid.FindFirstChildOfClass("Animator");
		if (!animator) {
			animator = new Instance("Animator");
			animator.Parent = humanoid;
		}

		// Ensure combat state values
		let staminaVal = model.FindFirstChild("Stamina") as NumberValue | undefined;
		if (!staminaVal) {
			staminaVal = new Instance("NumberValue");
			staminaVal.Name = "Stamina";
			staminaVal.Value = 100;
			staminaVal.Parent = model;
		}

		let isBlockingVal = model.FindFirstChild("IsBlocking") as BoolValue | undefined;
		if (!isBlockingVal) {
			isBlockingVal = new Instance("BoolValue");
			isBlockingVal.Name = "IsBlocking";
			isBlockingVal.Value = dummyType === "Blocking";
			isBlockingVal.Parent = model;
		} else {
			isBlockingVal.Value = dummyType === "Blocking";
		}

		let isGuardBrokenVal = model.FindFirstChild("IsGuardBroken") as BoolValue | undefined;
		if (!isGuardBrokenVal) {
			isGuardBrokenVal = new Instance("BoolValue");
			isGuardBrokenVal.Name = "IsGuardBroken";
			isGuardBrokenVal.Value = false;
			isGuardBrokenVal.Parent = model;
		}

		let isStunnedVal = model.FindFirstChild("IsStunned") as BoolValue | undefined;
		if (!isStunnedVal) {
			isStunnedVal = new Instance("BoolValue");
			isStunnedVal.Name = "IsStunned";
			isStunnedVal.Value = false;
			isStunnedVal.Parent = model;
		}

		// Preload animations
		const animTracks = new Map<string, AnimationTrack>();
		const anims = ARCZIS_COMBAT_CONFIG.Animations;

		const loadTrack = (name: string, id: string, priority: Enum.AnimationPriority, looped = false) => {
			if (!id || id === "" || id.find("YOUR_")[0] !== undefined) return;
			const anim = new Instance("Animation");
			anim.AnimationId = id;
			const [success, track] = pcall(() => animator!.LoadAnimation(anim));
			if (success && track) {
				track.Priority = priority;
				track.Looped = looped;
				animTracks.set(name, track);
			}
		};

		loadTrack("M1_Punch1", anims.M1_Punch1, Enum.AnimationPriority.Action2, false);
		loadTrack("M1_Punch2", anims.M1_Punch2, Enum.AnimationPriority.Action2, false);
		loadTrack("HeavyPunch", anims.HeavyPunch, Enum.AnimationPriority.Action2, false);
		loadTrack("Block", anims.Block, Enum.AnimationPriority.Action3, true);
		loadTrack("BlockHit", anims.BlockHit, Enum.AnimationPriority.Action4, false);
		loadTrack("HitReactionM1_1", anims.HitReactionM1_1, Enum.AnimationPriority.Action4, false);
		loadTrack("HitReactionM1_2", anims.HitReactionM1_2, Enum.AnimationPriority.Action4, false);
		loadTrack("HitReactionHeavy", anims.HitReactionHeavy, Enum.AnimationPriority.Action4, false);
		loadTrack("GuardBreak", anims.GuardBreak, Enum.AnimationPriority.Action4, false);

		const state: DummyState = {
			model,
			humanoid,
			rootPart,
			animator,
			dummyType,
			initialCFrame: rootPart.CFrame,
			animTracks,
			isDead: false,
			lastAttackTime: 0,
		};

		this.dummies.set(model, state);

		// If Blocking dummy, immediately play looping Block animation
		if (dummyType === "Blocking") {
			const blockTrack = animTracks.get("Block");
			if (blockTrack) {
				blockTrack.Play(0.1);
			}
		}

		// Auto respawn when defeated
		humanoid.Died.Connect(() => {
			state.isDead = true;
			task.delay(3, () => {
				if (!model.Parent) return;
				this.resetDummy(state);
			});
		});

		print(`[ServerDummyService] Registered dummy '${model.Name}' as type: ${dummyType}`);
	}

	private resetDummy(state: DummyState): void {
		const { model, humanoid, rootPart, dummyType, initialCFrame, animTracks } = state;
		humanoid.Health = humanoid.MaxHealth;
		rootPart.CFrame = initialCFrame;
		rootPart.AssemblyLinearVelocity = new Vector3(0, 0, 0);
		rootPart.AssemblyAngularVelocity = new Vector3(0, 0, 0);

		const staminaVal = model.FindFirstChild("Stamina") as NumberValue | undefined;
		if (staminaVal) staminaVal.Value = 100;

		const isBlockingVal = model.FindFirstChild("IsBlocking") as BoolValue | undefined;
		if (isBlockingVal) isBlockingVal.Value = dummyType === "Blocking";

		const isGuardBrokenVal = model.FindFirstChild("IsGuardBroken") as BoolValue | undefined;
		if (isGuardBrokenVal) isGuardBrokenVal.Value = false;

		const isStunnedVal = model.FindFirstChild("IsStunned") as BoolValue | undefined;
		if (isStunnedVal) isStunnedVal.Value = false;

		state.isDead = false;

		if (dummyType === "Blocking") {
			const blockTrack = animTracks.get("Block");
			if (blockTrack) {
				blockTrack.Play(0.1);
			}
		}
	}

	private onDummyHit(
		dummyModel: Model,
		attackType: string,
		_attackerChar: Model,
		reactionType: string,
	): void {
		const state = this.dummies.get(dummyModel);
		if (!state || state.isDead) return;

		const { animTracks, dummyType } = state;

		if (reactionType === "BlockHit") {
			const blockHitTrack = animTracks.get("BlockHit");
			if (blockHitTrack) {
				blockHitTrack.Play(0.05);
			}
		} else if (reactionType === "GuardBreak") {
			const blockTrack = animTracks.get("Block");
			if (blockTrack && blockTrack.IsPlaying) {
				blockTrack.Stop(0.05);
			}

			const gbTrack = animTracks.get("GuardBreak");
			if (gbTrack) {
				gbTrack.Play(0.05);
			}

			task.delay(ARCZIS_COMBAT_CONFIG.GuardBreakStunDuration, () => {
				if (state.isDead || !dummyModel.Parent) return;
				if (dummyType === "Blocking" && blockTrack) {
					blockTrack.Play(0.1);
				}
			});
		} else {
			// Normal hit reaction
			let hitAnimName = "HitReactionM1_1";
			if (attackType === "Heavy") {
				hitAnimName = "HitReactionHeavy";
			} else {
				hitAnimName = math.random() > 0.5 ? "HitReactionM1_1" : "HitReactionM1_2";
			}

			const hitTrack = animTracks.get(hitAnimName) ?? animTracks.get("HitReactionM1_1");
			if (hitTrack) {
				hitTrack.Play(0.05);
			}
		}
	}

	private attackingDummyLoop(): void {
		while (true) {
			task.wait(2.8);

			for (const [, state] of this.dummies) {
				if (state.dummyType !== "Attacking" || state.isDead) continue;

				const isStunned = state.model.FindFirstChild("IsStunned") as BoolValue | undefined;
				const isGuardBroken = state.model.FindFirstChild("IsGuardBroken") as BoolValue | undefined;
				if ((isStunned && isStunned.Value) || (isGuardBroken && isGuardBroken.Value)) continue;

				this.performAttackingDummyAttack(state);
			}
		}
	}

	private performAttackingDummyAttack(state: DummyState): void {
		const { model, rootPart, animTracks } = state;

		// Find closest player in front
		let targetPlayer: Player | undefined;
		let minDistance = 7.5;

		for (const player of Players.GetPlayers()) {
			const char = player.Character;
			if (!char) continue;
			const targetHrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			const targetHum = char.FindFirstChildOfClass("Humanoid");
			if (!targetHrp || !targetHum || targetHum.Health <= 0) continue;

			const offset = targetHrp.Position.sub(rootPart.Position);
			const dist = offset.Magnitude;
			if (dist < minDistance) {
				// Check angle in front (~80 degrees FOV)
				const look = rootPart.CFrame.LookVector;
				const dir = offset.Unit;
				if (look.Dot(dir) > 0.3) {
					targetPlayer = player;
					minDistance = dist;
				}
			}
		}

		if (!targetPlayer) return;

		// Play attack animation
		const punchTrack = animTracks.get("M1_Punch1") ?? animTracks.get("M1_Punch2");
		if (punchTrack) {
			punchTrack.Play(0.05);
		}

		// Play swing sound
		const swingSound = new Instance("Sound");
		swingSound.SoundId = ARCZIS_COMBAT_CONFIG.Sounds.Swing[0];
		swingSound.Volume = 0.7;
		swingSound.Parent = rootPart;
		swingSound.Play();
		Debris.AddItem(swingSound, 2);

		// Windup delay then hit check
		task.delay(ARCZIS_COMBAT_CONFIG.HitboxDelay, () => {
			if (state.isDead || !model.Parent) return;
			const char = targetPlayer?.Character;
			if (!char) return;
			const targetHrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (!targetHrp) return;

			const currentDist = targetHrp.Position.sub(rootPart.Position).Magnitude;
			if (currentDist <= 8.5) {
				ServerCombatService.getInstance().applyDamageToPlayer(
					targetPlayer!,
					ARCZIS_COMBAT_CONFIG.M1Damage,
					"M1",
					model,
				);
			}
		});
	}
}
