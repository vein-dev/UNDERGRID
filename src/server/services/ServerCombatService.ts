import { Debris, KeyframeSequenceProvider, Players, ReplicatedStorage, Workspace } from "@rbxts/services";
import { getBindableEvent, getRemoteEvent } from "shared/network";
import {
	ARCZIS_COMBAT_CONFIG,
	ActiveClashSession,
	CombatActionType,
	CombatPlayerData,
	WeaponConfig,
	WOODEN_SWORD_CONFIG,
} from "shared/types";
import { MovementConfig } from "shared/config/MovementConfig";

/**
 * ServerCombatService - Complete authoritative combat system
 * Features:
 * - Arczis Combat mechanics: M1 combo, Heavy punch (Push), Block/Guard, Guard Break, Clash Duel
 * - Stamina system with regeneration and depletion penalties
 * - Spatial query hitboxes with knockback and hit reactions
 * - Compatibility with training dummies (Normal, Blocking, Attacking)
 * - Legacy weapon support (Wooden Sword)
 */
export class ServerCombatService {
	private static instance?: ServerCombatService;

	private playerData = new Map<Player, CombatPlayerData>();
	private pendingM1s = new Map<Player, { timestamp: number; character: Model }>();
	private activeClashes = new Map<string, ActiveClashSession>();

	// Legacy weapon registry
	private weaponConfigs = new Map<string, WeaponConfig>();
	private playerWeaponCooldowns = new Map<number, number>();

	// Remotes
	private combatEvent!: RemoteEvent;
	private blockEvent!: RemoteEvent;
	private hitReactionEvent!: RemoteEvent;
	private soundEvent!: RemoteEvent;
	private clashEvent!: RemoteEvent;
	private dummyHitEvent!: BindableEvent;

	private constructor() {
		this.registerWeapon(WOODEN_SWORD_CONFIG);
	}

	public static getInstance(): ServerCombatService {
		if (!ServerCombatService.instance) {
			ServerCombatService.instance = new ServerCombatService();
		}
		return ServerCombatService.instance;
	}

	public init(): void {
		// Initialize Remotes
		this.combatEvent = getRemoteEvent("CombatEvent");
		this.blockEvent = getRemoteEvent("BlockEvent");
		this.hitReactionEvent = getRemoteEvent("HitReactionEvent");
		this.soundEvent = getRemoteEvent("SoundEvent");
		this.clashEvent = getRemoteEvent("ClashEvent");
		this.dummyHitEvent = getBindableEvent("DummyHitEvent");

		// Register server KeyframeSequences to ReplicatedStorage
		this.registerKeyframeSequences();

		// Player lifecycle
		Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player));
		Players.PlayerRemoving.Connect((player) => this.onPlayerRemoving(player));

		for (const player of Players.GetPlayers()) {
			this.onPlayerAdded(player);
		}

		// Remote listeners
		this.combatEvent.OnServerEvent.Connect((player, action, ...args) => {
			this.handleCombatEvent(player, action as CombatActionType, ...args);
		});

		this.blockEvent.OnServerEvent.Connect((player, isBlocking) => {
			this.handleBlockEvent(player, isBlocking as boolean);
		});

		this.clashEvent.OnServerEvent.Connect((player, action, clashId) => {
			this.handleClashEvent(player, action as string, clashId as string);
		});

		// Legacy weapon support
		const legacyAttackEvent = getRemoteEvent("WeaponAttack");
		legacyAttackEvent.OnServerEvent.Connect((player, toolInstance) => {
			if (toolInstance && typeIs(toolInstance, "Instance") && toolInstance.IsA("Tool")) {
				this.processLegacyWeaponAttack(player, toolInstance);
			}
		});

		// Authoritative Stamina & state sync loop
		task.spawn(() => this.staminaUpdateLoop());

		print("[ServerCombatService] Initialized successfully with Arczis Combat & Clash system.");
	}

	public registerWeapon(config: WeaponConfig): void {
		this.weaponConfigs.set(config.name, config);
	}

	private registerKeyframeSequences(): void {
		const kfsMapping = new Map<string, string[]>([
			["Idle", ["CombatIdle"]],
			["walking", ["CombatWalk"]],
			["Running", ["CombatRun"]],
			["Punch1_Optimized", ["M1_Punch1"]],
			["Punch2_Optimized", ["M1_Punch2"]],
			["Fists_Lunge_Optimized_Optimized", ["HeavyPunch"]],
			["Blocking", ["Block"]],
			["Blocking(hit)", ["BlockHit"]],
			["Equip", ["Equip"]],
			["Blockbroken", ["GuardBreak"]],
			["Player1Clash_Optimized", ["ClashLoop"]],
			["Player1ClashWin", ["ClashWin"]],
			["hurt_1", ["HitReactionM1_1"]],
			["hurt_2", ["HitReactionM1_2", "HitReactionHeavy"]],
		]);

		let animFolder = ReplicatedStorage.FindFirstChild("CombatAnimationIds") as Folder | undefined;
		if (!animFolder) {
			animFolder = new Instance("Folder");
			animFolder.Name = "CombatAnimationIds";
			animFolder.Parent = ReplicatedStorage;
		}

		let animInstanceFolder = ReplicatedStorage.FindFirstChild("CombatAnimations") as Folder | undefined;
		if (!animInstanceFolder) {
			animInstanceFolder = new Instance("Folder");
			animInstanceFolder.Name = "CombatAnimations";
			animInstanceFolder.Parent = ReplicatedStorage;
		}

		const registeredKfs = new Set<Instance>();

		const scanAndRegister = () => {
			const containers: Instance[] = [Workspace, ReplicatedStorage];
			const serverStorage = game.GetService("ServerStorage") as Instance | undefined;
			if (serverStorage) containers.push(serverStorage);

			for (const container of containers) {
				for (const inst of container.GetDescendants()) {
					if (inst.IsA("KeyframeSequence") && !registeredKfs.has(inst)) {
						const targets = kfsMapping.get(inst.Name);
						if (targets) {
							const [success, registeredId] = pcall(() =>
								KeyframeSequenceProvider.RegisterKeyframeSequence(inst),
							);
							if (success && registeredId) {
								registeredKfs.add(inst);
								for (const targetName of targets) {
									let val = animFolder!.FindFirstChild(targetName) as StringValue | undefined;
									if (!val) {
										val = new Instance("StringValue");
										val.Name = targetName;
										val.Parent = animFolder!;
									}
									val.Value = registeredId;

									// Also create Animation instance
									let animInst = animInstanceFolder!.FindFirstChild(targetName) as
										Animation | undefined;
									if (!animInst) {
										animInst = new Instance("Animation");
										animInst.Name = targetName;
										animInst.Parent = animInstanceFolder!;
									}
									animInst.AnimationId = registeredId;
								}
								print(
									`[ServerCombatService] KeyframeSequence '${inst.Name}' (${inst.GetFullName()}) terdaftar -> ${registeredId}`,
								);
							} else {
								warn(`[ServerCombatService] Gagal mendaftarkan KFS '${inst.Name}':`, registeredId);
							}
						}
					}
				}
			}

			if (registeredKfs.size() > 0) {
				print(
					`[ServerCombatService] Total ${registeredKfs.size()} KeyframeSequence berhasil didaftarkan ke ReplicatedStorage.`,
				);
			}
		};

		// Scan immediately and repeat at intervals to ensure late-loaded models are detected
		task.spawn(() => {
			scanAndRegister();
			task.wait(1);
			scanAndRegister();
			task.wait(2);
			scanAndRegister();
			task.wait(3);
			scanAndRegister();
		});

		Workspace.DescendantAdded.Connect((inst) => {
			if (inst.IsA("KeyframeSequence")) {
				scanAndRegister();
			}
		});
	}

	// ═══════════════════════════════════════════════════════
	// PLAYER DATA & LIFECYCLE
	// ═══════════════════════════════════════════════════════

	private initPlayerData(player: Player): void {
		this.playerData.set(player, {
			Stamina: ARCZIS_COMBAT_CONFIG.MaxStamina,
			IsBlocking: false,
			IsStunned: false,
			IsGuardBroken: false,
			CanBlockWhileStunned: false,
			IsAttacking: false,
			IsInClash: false,
			LastM1Time: 0,
			LastHeavyTime: 0,
			LastDashTime: 0,
			NextCombo: 1,
			LastStaminaUse: 0,
			HitReactionCount: 1,
			HasAnimateScript: false,
			BaseWalkSpeed: ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed,
			IsClashImmune: false,
			ClashImmuneUntil: 0,
			IsClashWinner: false,
			IsEquipped: false,
		});
	}

	private onPlayerAdded(player: Player): void {
		this.initPlayerData(player);

		player.CharacterAdded.Connect((character) => {
			this.setupCharacter(player, character);
		});

		if (player.Character) {
			this.setupCharacter(player, player.Character);
		}
	}

	private setupCharacter(player: Player, character: Model): void {
		this.initPlayerData(player);
		const humanoid = character.WaitForChild("Humanoid") as Humanoid;

		const data = this.playerData.get(player);
		if (data) {
			data.BaseWalkSpeed = ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed;
		}

		const createValue = (name: string, className: "NumberValue" | "BoolValue", defaultValue: number | boolean) => {
			let v = character.FindFirstChild(name) as ValueBase | undefined;
			if (!v) {
				const val = new Instance(className);
				val.Name = name;
				(val as unknown as { Value: number | boolean }).Value = defaultValue;
				val.Parent = character;
			}
		};

		createValue("Stamina", "NumberValue", ARCZIS_COMBAT_CONFIG.MaxStamina);
		createValue("IsBlocking", "BoolValue", false);
		createValue("IsStunned", "BoolValue", false);
		createValue("IsGuardBroken", "BoolValue", false);
		createValue("CombatEquipped", "BoolValue", false);
		createValue("IsAttacking", "BoolValue", false);
		createValue("IsInHitReaction", "BoolValue", false);
		createValue("CanBlockWhileStunned", "BoolValue", false);
		createValue("SpeedMultiplier", "NumberValue", 1);
		createValue("IsInClash", "BoolValue", false);
		createValue("HasAnimateSpeedHandling", "BoolValue", false);

		// Guarantee Fists tool exists for combat
		this.ensureFistsTool(player);

		task.delay(1, () => {
			if (character.Parent && this.playerData.has(player)) {
				const animate = character.FindFirstChild("Animate");
				const hasAnimate = animate !== undefined && animate.IsA("LocalScript");
				const hasAnimateVal = character.FindFirstChild("HasAnimateSpeedHandling") as BoolValue | undefined;
				if (hasAnimateVal) {
					hasAnimateVal.Value = hasAnimate;
				}
				const pData = this.playerData.get(player);
				if (pData) {
					pData.HasAnimateScript = hasAnimate;
				}
			}
		});

		// Bind character value change listeners
		const staminaVal = character.FindFirstChild("Stamina") as NumberValue | undefined;
		if (staminaVal) {
			staminaVal.Changed.Connect((newValue) => {
				const pData = this.playerData.get(player);
				if (pData) {
					if (newValue < pData.Stamina) {
						pData.LastStaminaUse = os.clock();
					}
					pData.Stamina = newValue;
				}
			});
		}

		const guardBrokenVal = character.FindFirstChild("IsGuardBroken") as BoolValue | undefined;
		if (guardBrokenVal) {
			guardBrokenVal.Changed.Connect((val) => {
				const pData = this.playerData.get(player);
				if (pData) {
					pData.IsGuardBroken = val;
					if (val) {
						pData.LastStaminaUse = os.clock();
						pData.IsBlocking = false;
						pData.Stamina = 0;
					}
					this.applySpeed(character, pData);
				}
			});
		}

		const stunnedVal = character.FindFirstChild("IsStunned") as BoolValue | undefined;
		if (stunnedVal) {
			stunnedVal.Changed.Connect((val) => {
				const pData = this.playerData.get(player);
				if (pData) {
					pData.IsStunned = val;
					if (!val) {
						pData.IsGuardBroken = false;
					}
					this.applySpeed(character, pData);
				}
			});
		}

		const blockingVal = character.FindFirstChild("IsBlocking") as BoolValue | undefined;
		if (blockingVal) {
			blockingVal.Changed.Connect((val) => {
				const pData = this.playerData.get(player);
				if (pData) {
					pData.IsBlocking = val;
					this.applySpeed(character, pData);
				}
			});
		}

		const attackingVal = character.FindFirstChild("IsAttacking") as BoolValue | undefined;
		if (attackingVal) {
			attackingVal.Changed.Connect((val) => {
				const pData = this.playerData.get(player);
				if (pData) {
					pData.IsAttacking = val;
					this.applySpeed(character, pData);
				}
			});
		}

		const clashVal = character.FindFirstChild("IsInClash") as BoolValue | undefined;
		if (clashVal) {
			clashVal.Changed.Connect((val) => {
				const pData = this.playerData.get(player);
				if (pData) {
					pData.IsInClash = val;
					this.applySpeed(character, pData);
				}
			});
		}
	}

	private ensureFistsTool(player: Player): void {
		task.defer(() => {
			const backpack = player.WaitForChild("Backpack") as Backpack | undefined;
			if (!backpack) return;

			const char = player.Character;
			const hasInBackpack = backpack.FindFirstChild("Fists") !== undefined;
			const hasInChar = char !== undefined && char.FindFirstChild("Fists") !== undefined;

			if (!hasInBackpack && !hasInChar) {
				const tool = new Instance("Tool");
				tool.Name = "Fists";
				tool.CanBeDropped = false;
				tool.RequiresHandle = false;
				tool.Parent = backpack;
				print(`[ServerCombatService] Created Fists tool for ${player.Name}`);
			}
		});
	}

	private onPlayerRemoving(player: Player): void {
		this.playerData.delete(player);
		this.pendingM1s.delete(player);

		for (const [clashId, clashData] of this.activeClashes) {
			if (clashData.Player1 === player || clashData.Player2 === player) {
				for (const constraint of clashData.Constraints) {
					if (constraint && constraint.Parent) {
						if (constraint.IsA("BasePart")) {
							constraint.Anchored = false;
						} else {
							constraint.Destroy();
						}
					}
				}
				this.activeClashes.delete(clashId);
			}
		}
	}

	// ═══════════════════════════════════════════════════════
	// STAMINA & MOVEMENT LOOP
	// ═══════════════════════════════════════════════════════

	private staminaUpdateLoop(): void {
		while (true) {
			task.wait(0.1);
			const now = os.clock();

			for (const [player, data] of this.playerData) {
				const char = player.Character;
				if (!char) continue;

				const stamVal = char.FindFirstChild("Stamina") as NumberValue | undefined;
				const isGuardBrokenVal = char.FindFirstChild("IsGuardBroken") as BoolValue | undefined;
				const isStunnedVal = char.FindFirstChild("IsStunned") as BoolValue | undefined;

				if (isGuardBrokenVal) data.IsGuardBroken = isGuardBrokenVal.Value;
				if (isStunnedVal) data.IsStunned = isStunnedVal.Value;

				const timeSinceUse = now - data.LastStaminaUse;
				const canRegen = timeSinceUse >= ARCZIS_COMBAT_CONFIG.StaminaRegenDelay;
				const shouldRegen = canRegen && !data.IsBlocking && !data.IsGuardBroken && !data.IsStunned;

				if (stamVal && shouldRegen) {
					if (data.Stamina < ARCZIS_COMBAT_CONFIG.MaxStamina) {
						data.Stamina = math.min(
							data.Stamina + ARCZIS_COMBAT_CONFIG.StaminaRegenRate * 0.1,
							ARCZIS_COMBAT_CONFIG.MaxStamina,
						);
						stamVal.Value = data.Stamina;
					}
				}

				if (stamVal && stamVal.Value !== data.Stamina) {
					data.Stamina = stamVal.Value;
				}

				const hasAnimateHandling = char.FindFirstChild("HasAnimateSpeedHandling") as BoolValue | undefined;
				if (!hasAnimateHandling || !hasAnimateHandling.Value) {
					this.applySpeed(char, data);
				}

				if (data.IsClashImmune && now >= data.ClashImmuneUntil) {
					data.IsClashImmune = false;
					data.ClashImmuneUntil = 0;
				}
			}
		}
	}

	private getSpeedMultiplier(data: CombatPlayerData): number {
		if (data.IsInClash || data.IsGuardBroken) {
			return 0;
		}
		if (data.IsStunned) {
			return ARCZIS_COMBAT_CONFIG.HitStunWalkSpeedMultiplier;
		}
		if (data.IsBlocking) {
			return ARCZIS_COMBAT_CONFIG.BlockWalkSpeedMultiplier;
		}
		if (data.IsAttacking) {
			return ARCZIS_COMBAT_CONFIG.AttackingWalkSpeedMultiplier;
		}
		return 1;
	}

	private applySpeed(character: Model, data: CombatPlayerData): void {
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid) return;

		const multiplier = this.getSpeedMultiplier(data);
		let speedMult = character.FindFirstChild("SpeedMultiplier") as NumberValue | undefined;
		if (!speedMult) {
			speedMult = new Instance("NumberValue");
			speedMult.Name = "SpeedMultiplier";
			speedMult.Parent = character;
		}
		speedMult.Value = multiplier;

		const hasAnimateHandling = character.FindFirstChild("HasAnimateSpeedHandling") as BoolValue | undefined;
		if (!hasAnimateHandling || !hasAnimateHandling.Value) {
			const baseSpeed = data.IsEquipped
				? (data.BaseWalkSpeed || ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed)
				: MovementConfig.CROUCH.normalSpeed;
			humanoid.WalkSpeed = baseSpeed * multiplier;

			if (data.IsGuardBroken || data.IsInClash || data.IsEquipped) {
				humanoid.JumpPower = 0;
				humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, false);
			} else {
				humanoid.UseJumpPower = true;
				humanoid.JumpPower = MovementConfig.JUMP.jumpPower;
				humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, true);
			}
		}
	}

	private syncCharacterValues(character: Model, data: CombatPlayerData): void {
		const setValue = (name: string, val: number | boolean) => {
			const v = character.FindFirstChild(name) as ValueBase | undefined;
			if (v) {
				(v as unknown as { Value: number | boolean }).Value = val;
			}
		};

		setValue("IsStunned", data.IsStunned);
		setValue("IsGuardBroken", data.IsGuardBroken);
		setValue("IsBlocking", data.IsBlocking);
		setValue("IsAttacking", data.IsAttacking);
		setValue("CanBlockWhileStunned", data.CanBlockWhileStunned);
		setValue("Stamina", data.Stamina);
		setValue("IsInClash", data.IsInClash);
	}

	private playSoundOnCharacter(character: Model, soundId: string | string[], volume?: number): void {
		const hrp = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!hrp) return;

		let finalSoundId = soundId;
		if (typeIs(soundId, "table") && (soundId as string[]).size() > 0) {
			const soundList = soundId as string[];
			finalSoundId = soundList[math.random(0, soundList.size() - 1)];
		}

		if (typeIs(finalSoundId, "string") && finalSoundId.find("YOUR_")[0] !== undefined) {
			return;
		}

		this.soundEvent.FireAllClients(
			"PlaySound",
			hrp.Position,
			finalSoundId,
			volume ?? ARCZIS_COMBAT_CONFIG.SoundVolume,
		);
	}

	private isPlayerDamageImmune(player: Player): boolean {
		const data = this.playerData.get(player);
		if (!data) return false;

		const now = os.clock();
		if (data.IsClashImmune) {
			if (now < data.ClashImmuneUntil) {
				return true;
			}
			data.IsClashImmune = false;
			data.ClashImmuneUntil = 0;
		}

		return data.IsClashWinner || data.IsInClash;
	}

	// ═══════════════════════════════════════════════════════
	// HIT DETECTION & REACTION
	// ═══════════════════════════════════════════════════════

	private performHitbox(attackerChar: Model, excludeCharacters?: Model[]): Model[] {
		const hrp = attackerChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!hrp) return [];

		const hitboxCFrame = hrp.CFrame.mul(new CFrame(0, 0, -ARCZIS_COMBAT_CONFIG.HitboxOffset));
		const hits: Model[] = [];

		const params = new OverlapParams();
		params.FilterType = Enum.RaycastFilterType.Exclude;
		const filterList: Instance[] = [attackerChar];
		if (excludeCharacters) {
			for (const char of excludeCharacters) {
				filterList.push(char);
			}
		}
		params.FilterDescendantsInstances = filterList;

		const parts = Workspace.GetPartBoundsInBox(hitboxCFrame, ARCZIS_COMBAT_CONFIG.HitboxSize, params);
		const seen = new Set<Model>();

		for (const part of parts) {
			const char = part.Parent;
			if (char && char.IsA("Model") && char !== attackerChar && !seen.has(char)) {
				const hum = char.FindFirstChildOfClass("Humanoid");
				if (hum && hum.Health > 0) {
					seen.add(char);
					hits.push(char);
				}
			}
		}

		return hits;
	}

	private applyKnockback(targetChar: Model, attackerChar: Model, force: number): void {
		const targetHRP = targetChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const attackerHRP = attackerChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (targetHRP && attackerHRP) {
			let dir = targetHRP.Position.sub(attackerHRP.Position);
			dir = new Vector3(dir.X, 0, dir.Z);
			const unitDir = dir.Magnitude > 0.1 ? dir.Unit : attackerHRP.CFrame.LookVector;

			const bv = new Instance("BodyVelocity");
			bv.MaxForce = new Vector3(math.huge, 0, math.huge);
			bv.Velocity = unitDir.mul(force);
			bv.Parent = targetHRP;
			Debris.AddItem(bv, 0.2);
		}
	}

	private applyHitStun(targetChar: Model, duration: number, hitType: "M1" | "Heavy"): void {
		const targetPlayer = Players.GetPlayerFromCharacter(targetChar);
		if (!targetPlayer) return;
		const data = this.playerData.get(targetPlayer);
		if (!data || this.isPlayerDamageImmune(targetPlayer)) return;

		const humanoid = targetChar.FindFirstChildOfClass("Humanoid");
		if (!humanoid || humanoid.Health <= 0) return;

		const canBlock =
			hitType === "Heavy" ? ARCZIS_COMBAT_CONFIG.HeavyStunCanBlock : ARCZIS_COMBAT_CONFIG.M1StunCanBlock;
		data.IsStunned = true;
		data.IsGuardBroken = false;
		data.CanBlockWhileStunned = canBlock;
		data.IsBlocking = false;
		data.IsAttacking = false;

		this.syncCharacterValues(targetChar, data);
		this.applySpeed(targetChar, data);

		const hitReactionVal = targetChar.FindFirstChild("IsInHitReaction") as BoolValue | undefined;
		if (hitReactionVal) hitReactionVal.Value = true;

		let reactionType: string;
		if (hitType === "Heavy") {
			reactionType = "HitReactionHeavy";
		} else {
			reactionType = `HitReactionM1_${data.HitReactionCount}`;
			data.HitReactionCount = data.HitReactionCount === 1 ? 2 : 1;
		}

		this.hitReactionEvent.FireClient(targetPlayer, reactionType, duration, canBlock);

		task.delay(duration, () => {
			if (targetPlayer.Character === targetChar && this.playerData.has(targetPlayer)) {
				data.IsStunned = false;
				data.CanBlockWhileStunned = false;
				this.syncCharacterValues(targetChar, data);
				this.applySpeed(targetChar, data);
				if (hitReactionVal) hitReactionVal.Value = false;
			}
		});
	}

	private applyGuardBreak(targetChar: Model, duration: number): void {
		const targetPlayer = Players.GetPlayerFromCharacter(targetChar);
		if (!targetPlayer) return;
		const data = this.playerData.get(targetPlayer);
		if (!data || this.isPlayerDamageImmune(targetPlayer)) return;

		data.IsStunned = true;
		data.IsGuardBroken = true;
		data.CanBlockWhileStunned = false;
		data.IsBlocking = false;
		data.IsAttacking = false;
		data.Stamina = 0;
		data.LastStaminaUse = os.clock();

		this.syncCharacterValues(targetChar, data);
		this.applySpeed(targetChar, data);

		const hitReactionVal = targetChar.FindFirstChild("IsInHitReaction") as BoolValue | undefined;
		if (hitReactionVal) hitReactionVal.Value = true;

		this.playSoundOnCharacter(targetChar, ARCZIS_COMBAT_CONFIG.Sounds.GuardBreak, 1.0);
		this.hitReactionEvent.FireClient(targetPlayer, "GuardBreak", duration, false);
		this.blockEvent.FireClient(targetPlayer, "GuardBreak");

		task.delay(duration, () => {
			if (targetPlayer.Character === targetChar && this.playerData.has(targetPlayer)) {
				data.IsStunned = false;
				data.IsGuardBroken = false;
				data.LastStaminaUse = os.clock();
				this.syncCharacterValues(targetChar, data);
				this.applySpeed(targetChar, data);
				if (hitReactionVal) hitReactionVal.Value = false;
				this.hitReactionEvent.FireClient(targetPlayer, "StunEnded", 0, false);
			}
		});
	}

	private handleDummyHit(dummyModel: Model, damage: number, attackType: string, attackerChar: Model): void {
		let dummyType = dummyModel.GetAttribute("DummyType") as string | undefined;
		if (!dummyType) {
			if (dummyModel.Name.find("Blocking")[0] !== undefined) dummyType = "Blocking";
			else if (dummyModel.Name.find("Attacking")[0] !== undefined) dummyType = "Attacking";
			else dummyType = "Normal";
		}
		const humanoid = dummyModel.FindFirstChildOfClass("Humanoid");
		const hrp = dummyModel.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!humanoid || !hrp || humanoid.Health <= 0) return;

		const knockback =
			attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.HeavyKnockback : ARCZIS_COMBAT_CONFIG.M1Knockback;

		if (dummyType === "Blocking") {
			const staminaVal = dummyModel.FindFirstChild("Stamina") as NumberValue | undefined;
			const isBlocking = dummyModel.FindFirstChild("IsBlocking") as BoolValue | undefined;
			const isGuardBroken = dummyModel.FindFirstChild("IsGuardBroken") as BoolValue | undefined;
			const isStunned = dummyModel.FindFirstChild("IsStunned") as BoolValue | undefined;

			if (isGuardBroken && isGuardBroken.Value) {
				humanoid.TakeDamage(damage);
				this.playSoundOnCharacter(
					dummyModel,
					attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.Sounds.HitHeavy : ARCZIS_COMBAT_CONFIG.Sounds.Hit,
					0.9,
				);
				this.applyKnockback(dummyModel, attackerChar, knockback);
				this.dummyHitEvent.Fire(dummyModel, attackType, attackerChar, "Hit");
				return;
			}

			if (isBlocking && isBlocking.Value && staminaVal) {
				const blockDrain =
					attackType === "Heavy"
						? ARCZIS_COMBAT_CONFIG.BlockStaminaDrainPerHeavy
						: ARCZIS_COMBAT_CONFIG.BlockStaminaDrainPerHit;
				staminaVal.Value = staminaVal.Value - blockDrain;

				if (staminaVal.Value <= 0) {
					// Guard Break
					staminaVal.Value = 0;
					isBlocking.Value = false;
					if (isGuardBroken) isGuardBroken.Value = true;
					if (isStunned) isStunned.Value = true;

					humanoid.TakeDamage(damage);
					this.applyKnockback(dummyModel, attackerChar, ARCZIS_COMBAT_CONFIG.GuardBreakKnockback);
					this.dummyHitEvent.Fire(dummyModel, attackType, attackerChar, "GuardBreak");

					task.delay(ARCZIS_COMBAT_CONFIG.GuardBreakStunDuration, () => {
						if (!dummyModel.Parent) return;
						if (isGuardBroken) isGuardBroken.Value = false;
						if (isStunned) isStunned.Value = false;
						task.delay(1, () => {
							if (!dummyModel.Parent) return;
							staminaVal.Value = 100;
							isBlocking.Value = true;
						});
					});
				} else {
					// Blocked
					const reducedDamage = damage * (1 - ARCZIS_COMBAT_CONFIG.BlockedDamageReduction);
					humanoid.TakeDamage(reducedDamage);
					this.applyKnockback(dummyModel, attackerChar, knockback * 0.2);
					this.dummyHitEvent.Fire(dummyModel, attackType, attackerChar, "BlockHit");
				}
			} else {
				humanoid.TakeDamage(damage);
				this.playSoundOnCharacter(
					dummyModel,
					attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.Sounds.HitHeavy : ARCZIS_COMBAT_CONFIG.Sounds.Hit,
					0.9,
				);
				this.applyKnockback(dummyModel, attackerChar, knockback);
				this.dummyHitEvent.Fire(dummyModel, attackType, attackerChar, "Hit");
			}
		} else {
			humanoid.TakeDamage(damage);
			this.playSoundOnCharacter(dummyModel, ARCZIS_COMBAT_CONFIG.Sounds.Hit, 0.9);
			this.applyKnockback(dummyModel, attackerChar, knockback);
			this.dummyHitEvent.Fire(dummyModel, attackType, attackerChar, "Hit");
		}
	}

	// ═══════════════════════════════════════════════════════
	// CLASH DUEL SYSTEM
	// ═══════════════════════════════════════════════════════

	private checkForClash(player: Player, timestamp: number): Player | undefined {
		for (const [otherPlayer, pendingData] of this.pendingM1s) {
			if (otherPlayer !== player && pendingData) {
				const timeDiff = math.abs(timestamp - pendingData.timestamp);
				if (timeDiff <= ARCZIS_COMBAT_CONFIG.ClashDetectionWindow) {
					const char1 = player.Character;
					const char2 = otherPlayer.Character;
					if (char1 && char2) {
						const hrp1 = char1.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
						const hrp2 = char2.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
						if (hrp1 && hrp2) {
							const distance = hrp1.Position.sub(hrp2.Position).Magnitude;
							if (distance <= ARCZIS_COMBAT_CONFIG.HitboxSize.Z + ARCZIS_COMBAT_CONFIG.HitboxOffset + 2) {
								return otherPlayer;
							}
						}
					}
				}
			}
		}
		return undefined;
	}

	private positionPlayersForClash(char1: Model, char2: Model): Instance[] {
		const hrp1 = char1.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const hrp2 = char2.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!hrp1 || !hrp2) return [];

		const midpoint = hrp1.Position.add(hrp2.Position).div(2);

		let direction = hrp2.Position.sub(hrp1.Position);
		direction = new Vector3(direction.X, 0, direction.Z);
		const unitDir = direction.Magnitude > 0.1 ? direction.Unit : hrp1.CFrame.LookVector;

		const targetPos1 = new Vector3(
			midpoint.X - unitDir.X * (ARCZIS_COMBAT_CONFIG.ClashDistance / 2),
			hrp1.Position.Y,
			midpoint.Z - unitDir.Z * (ARCZIS_COMBAT_CONFIG.ClashDistance / 2),
		);
		const targetPos2 = new Vector3(
			midpoint.X + unitDir.X * (ARCZIS_COMBAT_CONFIG.ClashDistance / 2),
			hrp2.Position.Y,
			midpoint.Z + unitDir.Z * (ARCZIS_COMBAT_CONFIG.ClashDistance / 2),
		);

		const lookAt1 = CFrame.lookAt(targetPos1, targetPos2);
		const lookAt2 = CFrame.lookAt(targetPos2, targetPos1);

		// Hentikan akumulasi momentum/velocity fisik sebelum duel clash
		hrp1.AssemblyLinearVelocity = Vector3.zero;
		hrp1.AssemblyAngularVelocity = Vector3.zero;
		hrp2.AssemblyLinearVelocity = Vector3.zero;
		hrp2.AssemblyAngularVelocity = Vector3.zero;

		// Posisikan saling berhadapan secara presisi
		hrp1.CFrame = lookAt1;
		hrp2.CFrame = lookAt2;

		// Anchor kedua karakter untuk mengeliminasi benturan collision solver dan fling physics bug
		hrp1.Anchored = true;
		hrp2.Anchored = true;

		return [hrp1, hrp2];
	}

	private lockPlayerMovement(character: Model, locked: boolean): void {
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid) return;

		if (locked) {
			humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, false);
			humanoid.WalkSpeed = 0;
			humanoid.JumpPower = 0;
		} else {
			const combatVal = character.FindFirstChild("CombatEquipped") as BoolValue | undefined;
			const isCombat = combatVal ? combatVal.Value : false;
			if (!isCombat) {
				humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, true);
				humanoid.UseJumpPower = true;
				humanoid.JumpPower = MovementConfig.JUMP.jumpPower;
			} else {
				humanoid.SetStateEnabled(Enum.HumanoidStateType.Jumping, false);
				humanoid.JumpPower = 0;
			}
			humanoid.WalkSpeed = ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed;
		}
	}

	private startClash(player1: Player, player2: Player): void {
		const data1 = this.playerData.get(player1);
		const data2 = this.playerData.get(player2);
		if (!data1 || !data2) return;

		const char1 = player1.Character;
		const char2 = player2.Character;
		if (!char1 || !char2) return;

		data1.IsInClash = true;
		data2.IsInClash = true;
		data1.IsAttacking = false;
		data2.IsAttacking = false;
		data1.IsBlocking = false;
		data2.IsBlocking = false;
		data1.IsClashImmune = true;
		data2.IsClashImmune = true;
		data1.ClashImmuneUntil = os.clock() + 999;
		data2.ClashImmuneUntil = os.clock() + 999;

		this.syncCharacterValues(char1, data1);
		this.syncCharacterValues(char2, data2);
		this.applySpeed(char1, data1);
		this.applySpeed(char2, data2);

		this.lockPlayerMovement(char1, true);
		this.lockPlayerMovement(char2, true);

		this.pendingM1s.delete(player1);
		this.pendingM1s.delete(player2);

		const clashId = `${player1.UserId}_${player2.UserId}_${os.clock()}`;
		const constraints = this.positionPlayersForClash(char1, char2);

		const buttonPresses = new Map<Player, number>();
		buttonPresses.set(player1, 0);
		buttonPresses.set(player2, 0);

		this.activeClashes.set(clashId, {
			Player1: player1,
			Player2: player2,
			StartTime: os.clock(),
			ButtonPresses: buttonPresses,
			Constraints: constraints,
		});

		this.clashEvent.FireClient(player1, "ClashStart", player2.UserId, clashId);
		this.clashEvent.FireClient(player2, "ClashStart", player1.UserId, clashId);
		this.playSoundOnCharacter(char1, ARCZIS_COMBAT_CONFIG.Sounds.ClashStart, 1.0);

		// Periodic pulse updates of button presses to clients
		task.spawn(() => {
			while (this.activeClashes.has(clashId) && !this.activeClashes.get(clashId)?.Winner) {
				task.wait(0.1);
				const clash = this.activeClashes.get(clashId);
				if (!clash) break;

				const p1Presses = clash.ButtonPresses.get(player1) ?? 0;
				const p2Presses = clash.ButtonPresses.get(player2) ?? 0;
				this.clashEvent.FireClient(player1, "UpdatePresses", p1Presses, p2Presses);
				this.clashEvent.FireClient(player2, "UpdatePresses", p2Presses, p1Presses);
			}
		});

		// Timeout resolution
		task.delay(ARCZIS_COMBAT_CONFIG.ClashButtonPressWindow, () => {
			if (this.activeClashes.has(clashId) && !this.activeClashes.get(clashId)?.Winner) {
				this.resolveClash(clashId);
			}
		});
	}

	private resolveClash(clashId: string): void {
		const clashData = this.activeClashes.get(clashId);
		if (!clashData) return;

		const { Player1: player1, Player2: player2, ButtonPresses: presses, Constraints: constraints } = clashData;
		const data1 = this.playerData.get(player1);
		const data2 = this.playerData.get(player2);

		if (!data1 || !data2) {
			for (const c of constraints) c?.Destroy();
			this.activeClashes.delete(clashId);
			return;
		}

		const p1P = presses.get(player1) ?? 0;
		const p2P = presses.get(player2) ?? 0;

		let winner: Player;
		let loser: Player;
		if (p1P > p2P) {
			winner = player1;
			loser = player2;
		} else if (p2P > p1P) {
			winner = player2;
			loser = player1;
		} else {
			if (math.random() > 0.5) {
				winner = player1;
				loser = player2;
			} else {
				winner = player2;
				loser = player1;
			}
		}

		clashData.Winner = winner;

		const winnerData = this.playerData.get(winner);
		const loserData = this.playerData.get(loser);
		const winnerChar = winner.Character;
		const loserChar = loser.Character;

		if (!winnerChar || !loserChar || !winnerData || !loserData) {
			for (const c of constraints) {
				if (c.IsA("BasePart")) {
					c.Anchored = false;
				} else {
					c?.Destroy();
				}
			}
			this.activeClashes.delete(clashId);
			return;
		}

		winnerData.IsInClash = false;
		winnerData.IsAttacking = true;
		winnerData.IsStunned = false;
		winnerData.IsGuardBroken = false;
		winnerData.IsClashWinner = true;
		winnerData.IsClashImmune = true;
		winnerData.ClashImmuneUntil = os.clock() + 999;

		loserData.IsInClash = false;
		loserData.IsStunned = true;
		loserData.IsAttacking = false;
		loserData.CanBlockWhileStunned = false;
		loserData.IsClashImmune = false;
		loserData.ClashImmuneUntil = 0;
		loserData.IsClashWinner = false;

		this.syncCharacterValues(winnerChar, winnerData);
		this.syncCharacterValues(loserChar, loserData);
		this.lockPlayerMovement(loserChar, true);
		this.lockPlayerMovement(winnerChar, true);

		this.clashEvent.FireClient(winner, "ClashWin", loser.UserId);
		this.clashEvent.FireClient(loser, "ClashLose", winner.UserId);
		this.playSoundOnCharacter(winnerChar, ARCZIS_COMBAT_CONFIG.Sounds.ClashWin, 1.0);

		this.activeClashes.delete(clashId);

		task.delay(ARCZIS_COMBAT_CONFIG.ClashWinPunchDelay, () => {
			for (const c of constraints) {
				if (c.IsA("BasePart")) {
					c.Anchored = false;
				} else {
					c?.Destroy();
				}
			}

			const winnerHRP = winnerChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			const loserHRP = loserChar.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

			if (!winnerHRP || !loserHRP) return;

			// Lepas anchor dan bersihkan sisa gaya fisika sebelum meluncurkan knockback
			winnerHRP.Anchored = false;
			winnerHRP.AssemblyLinearVelocity = Vector3.zero;
			winnerHRP.AssemblyAngularVelocity = Vector3.zero;

			loserHRP.Anchored = false;
			loserHRP.AssemblyLinearVelocity = Vector3.zero;
			loserHRP.AssemblyAngularVelocity = Vector3.zero;

			let knockbackDir = loserHRP.Position.sub(winnerHRP.Position);
			knockbackDir = new Vector3(knockbackDir.X, 0, knockbackDir.Z);
			const unitKnockback = knockbackDir.Magnitude > 0.1 ? knockbackDir.Unit : winnerHRP.CFrame.LookVector;

			const loserHum = loserChar.FindFirstChildOfClass("Humanoid");
			if (loserHum && loserHum.Health > 0) {
				loserHum.TakeDamage(ARCZIS_COMBAT_CONFIG.ClashWinDamage);
				this.playSoundOnCharacter(loserChar, ARCZIS_COMBAT_CONFIG.Sounds.Hit, 1.0);

				const loserKnockback = new Instance("BodyVelocity");
				loserKnockback.Name = "ClashKnockback";
				// Gunakan batas gaya terukur (bukan math.huge) agar tidak memicu physics fling bug
				loserKnockback.MaxForce = new Vector3(1e5, 1e5, 1e5);
				loserKnockback.Velocity = unitKnockback
					.mul(ARCZIS_COMBAT_CONFIG.ClashWinKnockback)
					.add(new Vector3(0, 10, 0));
				loserKnockback.Parent = loserHRP;
				Debris.AddItem(loserKnockback, 0.25);

				loserData.IsStunned = true;
				loserData.CanBlockWhileStunned = true;
				this.syncCharacterValues(loserChar, loserData);
				this.applySpeed(loserChar, loserData);

				this.hitReactionEvent.FireClient(
					loser,
					"HitReactionM1_1",
					ARCZIS_COMBAT_CONFIG.ClashWinStunDuration,
					true,
				);

				task.delay(ARCZIS_COMBAT_CONFIG.ClashWinStunDuration, () => {
					if (loser.Parent && this.playerData.has(loser)) {
						loserData.IsStunned = false;
						loserData.CanBlockWhileStunned = false;
						this.syncCharacterValues(loserChar, loserData);
						this.applySpeed(loserChar, loserData);
						this.lockPlayerMovement(loserChar, false);
					}
				});
			}

			// Winner slide back slightly
			const winnerKnockback = new Instance("BodyVelocity");
			winnerKnockback.Name = "ClashSlide";
			// Batasi MaxForce terukur untuk mencegah lonjakan fisika
			winnerKnockback.MaxForce = new Vector3(1e5, 0, 1e5);
			winnerKnockback.Velocity = unitKnockback.mul(-ARCZIS_COMBAT_CONFIG.ClashWinnerSlideBack);
			winnerKnockback.Parent = winnerHRP;
			Debris.AddItem(winnerKnockback, 0.2);

			task.delay(0.3, () => {
				if (winner.Parent && this.playerData.has(winner)) {
					winnerData.IsAttacking = false;
					winnerData.IsStunned = false;
					winnerData.IsGuardBroken = false;
					winnerData.IsClashWinner = false;
					winnerData.IsClashImmune = false;
					winnerData.ClashImmuneUntil = 0;
					this.syncCharacterValues(winnerChar, winnerData);
					this.applySpeed(winnerChar, winnerData);
					this.lockPlayerMovement(winnerChar, false);
				}
			});
		});
	}

	// ═══════════════════════════════════════════════════════
	// EVENT HANDLERS
	// ═══════════════════════════════════════════════════════

	private handleCombatEvent(player: Player, action: CombatActionType, ...args: unknown[]): void {
		const data = this.playerData.get(player);
		if (!data) return;

		const character = player.Character;
		if (!character) return;
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid || humanoid.Health <= 0) return;

		if (action === "Equip") {
			const isEquipped = args[0] as boolean;
			data.IsEquipped = isEquipped;
			const combatVal = character.FindFirstChild("CombatEquipped") as BoolValue | undefined;
			if (combatVal) combatVal.Value = isEquipped;

			if (isEquipped) {
				data.IsAttacking = false;
				data.IsBlocking = false;
				data.IsStunned = false;
				data.IsGuardBroken = false;
				data.IsInClash = false;
				data.IsClashImmune = false;
				data.ClashImmuneUntil = 0;
				data.IsClashWinner = false;
				data.BaseWalkSpeed = ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed;
				this.syncCharacterValues(character, data);
				this.applySpeed(character, data);
				this.playSoundOnCharacter(character, ARCZIS_COMBAT_CONFIG.Sounds.Equip, 1.0);
			} else {
				data.BaseWalkSpeed = MovementConfig.CROUCH.normalSpeed;
				this.applySpeed(character, data);
			}
			return;
		}

		if (action === "Sprint") {
			const isSprinting = args[0] as boolean;
			data.BaseWalkSpeed = isSprinting
				? ARCZIS_COMBAT_CONFIG.SprintSpeed
				: ARCZIS_COMBAT_CONFIG.DefaultWalkSpeed;
			this.applySpeed(character, data);
			return;
		}

		if (action === "Dash") {
			const now = os.clock();
			if (now - data.LastDashTime < ARCZIS_COMBAT_CONFIG.DashCooldown) return;
			if (data.Stamina < ARCZIS_COMBAT_CONFIG.DashStaminaCost) return;
			if (data.IsInClash || data.IsGuardBroken || data.IsStunned || data.IsAttacking) return;

			data.LastDashTime = now;
			data.Stamina = math.max(0, data.Stamina - ARCZIS_COMBAT_CONFIG.DashStaminaCost);
			data.LastStaminaUse = now;
			const stamVal = character.FindFirstChild("Stamina") as NumberValue | undefined;
			if (stamVal) stamVal.Value = data.Stamina;

			// Quick impulse forward/directional
			const hrp = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (hrp) {
				const moveDir = humanoid.MoveDirection.Magnitude > 0.1 ? humanoid.MoveDirection : hrp.CFrame.LookVector;
				const dashVel = new Instance("BodyVelocity");
				dashVel.MaxForce = new Vector3(math.huge, 0, math.huge);
				dashVel.Velocity = moveDir.mul(25);
				dashVel.Parent = hrp;
				Debris.AddItem(dashVel, 0.2);
				this.playSoundOnCharacter(character, ARCZIS_COMBAT_CONFIG.Sounds.SwingHeavy, 0.6);
			}
			return;
		}

		if (action !== "M1" && action !== "Heavy") return;
		const attackType = action;

		if (data.IsInClash || data.IsGuardBroken || data.IsStunned || data.IsAttacking || data.IsBlocking) {
			return;
		}

		const now = os.clock();
		if (attackType === "Heavy") {
			if (now - data.LastHeavyTime < ARCZIS_COMBAT_CONFIG.HeavyCooldown) return;
		} else {
			if (now - data.LastM1Time < ARCZIS_COMBAT_CONFIG.M1Cooldown) return;
		}

		const cost =
			attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.HeavyStaminaCost : ARCZIS_COMBAT_CONFIG.M1StaminaCost;
		if (data.Stamina < cost || data.Stamina < ARCZIS_COMBAT_CONFIG.MinStaminaToAct) {
			this.combatEvent.FireClient(player, "NoStamina");
			return;
		}

		// Clash check for M1
		if (attackType === "M1") {
			this.pendingM1s.set(player, {
				timestamp: now,
				character: character,
			});

			const clashOpponent = this.checkForClash(player, now);
			if (clashOpponent) {
				this.startClash(player, clashOpponent);
				return;
			}

			task.delay(ARCZIS_COMBAT_CONFIG.ClashDetectionWindow, () => {
				const pending = this.pendingM1s.get(player);
				if (pending && pending.timestamp === now) {
					this.pendingM1s.delete(player);
				}
			});
		}

		data.IsAttacking = true;
		this.syncCharacterValues(character, data);
		this.applySpeed(character, data);
		data.Stamina = math.max(0, data.Stamina - cost);
		data.LastStaminaUse = now;

		const stamVal = character.FindFirstChild("Stamina") as NumberValue | undefined;
		if (stamVal) stamVal.Value = data.Stamina;

		let currentCombo = 1;
		if (attackType === "Heavy") {
			data.LastHeavyTime = now;
			currentCombo = 0;
			this.playSoundOnCharacter(character, ARCZIS_COMBAT_CONFIG.Sounds.SwingHeavy, 0.8);
		} else {
			data.LastM1Time = now;
			currentCombo = data.NextCombo;
			data.NextCombo = data.NextCombo === 1 ? 2 : 1;
			this.playSoundOnCharacter(character, ARCZIS_COMBAT_CONFIG.Sounds.Swing, 0.7);
		}

		this.combatEvent.FireClient(player, "PlayAttack", attackType, currentCombo);

		task.delay(ARCZIS_COMBAT_CONFIG.HitboxDelay, () => {
			if (!this.playerData.has(player) || player.Character !== character) return;
			if (data.IsClashWinner || data.IsClashImmune || data.IsInClash) return;

			const damage = attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.HeavyDamage : ARCZIS_COMBAT_CONFIG.M1Damage;
			const stunDur =
				attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.HeavyStunDuration : ARCZIS_COMBAT_CONFIG.M1StunDuration;
			const knockback =
				attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.HeavyKnockback : ARCZIS_COMBAT_CONFIG.M1Knockback;
			const blockDrain =
				attackType === "Heavy"
					? ARCZIS_COMBAT_CONFIG.BlockStaminaDrainPerHeavy
					: ARCZIS_COMBAT_CONFIG.BlockStaminaDrainPerHit;

			const hits = this.performHitbox(character, undefined);

			for (const targetChar of hits) {
				const targetPlayer = Players.GetPlayerFromCharacter(targetChar);
				if (!targetPlayer) {
					const dummyType = targetChar.GetAttribute("DummyType");
					const isDummyName = targetChar.Name.lower().find("dummy")[0] !== undefined;
					if (dummyType !== undefined || isDummyName) {
						this.handleDummyHit(targetChar, damage, attackType, character);
					} else {
						const hum = targetChar.FindFirstChildOfClass("Humanoid");
						if (hum) {
							hum.TakeDamage(damage);
							this.playSoundOnCharacter(targetChar, ARCZIS_COMBAT_CONFIG.Sounds.Hit, 0.9);
							this.applyKnockback(targetChar, character, knockback);
						}
					}
					continue;
				}

				const targetData = this.playerData.get(targetPlayer);
				if (!targetData || targetData.IsInClash || this.isPlayerDamageImmune(targetPlayer)) {
					continue;
				}

				const canBlock =
					!targetData.IsGuardBroken && (!targetData.IsStunned || targetData.CanBlockWhileStunned);
				const isBlocking = targetData.IsBlocking && canBlock;

				if (isBlocking) {
					targetData.Stamina = targetData.Stamina - blockDrain;
					targetData.LastStaminaUse = os.clock();
					const tStamVal = targetChar.FindFirstChild("Stamina") as NumberValue | undefined;
					if (tStamVal) tStamVal.Value = math.max(0, targetData.Stamina);

					if (targetData.Stamina <= 0) {
						this.applyGuardBreak(targetChar, ARCZIS_COMBAT_CONFIG.GuardBreakStunDuration);
						const hum = targetChar.FindFirstChildOfClass("Humanoid");
						if (hum) hum.TakeDamage(damage);
						this.applyKnockback(targetChar, character, ARCZIS_COMBAT_CONFIG.GuardBreakKnockback);
					} else {
						const actualDmg = damage * (1 - ARCZIS_COMBAT_CONFIG.BlockedDamageReduction);
						this.playSoundOnCharacter(targetChar, ARCZIS_COMBAT_CONFIG.Sounds.BlockHit, 0.9);
						this.hitReactionEvent.FireClient(
							targetPlayer,
							"BlockHit",
							ARCZIS_COMBAT_CONFIG.BlockStunDuration,
							true,
						);
						const hum = targetChar.FindFirstChildOfClass("Humanoid");
						if (hum) hum.TakeDamage(actualDmg);
						this.applyKnockback(targetChar, character, knockback * 0.2);
					}
				} else {
					if (attackType === "Heavy") {
						this.playSoundOnCharacter(targetChar, ARCZIS_COMBAT_CONFIG.Sounds.HitHeavy, 1.0);
					} else {
						this.playSoundOnCharacter(targetChar, ARCZIS_COMBAT_CONFIG.Sounds.Hit, 0.9);
					}
					const hum = targetChar.FindFirstChildOfClass("Humanoid");
					if (hum) hum.TakeDamage(damage);
					this.applyHitStun(targetChar, stunDur, attackType as "M1" | "Heavy");
					this.applyKnockback(targetChar, character, knockback);
				}
			}

			this.combatEvent.FireClient(player, "AttackConfirm", hits.size() > 0);
		});

		const lockTime =
			attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.HeavyAnimationLock : ARCZIS_COMBAT_CONFIG.M1AnimationLock;
		task.delay(lockTime, () => {
			if (this.playerData.has(player) && player.Character === character) {
				data.IsAttacking = false;
				this.syncCharacterValues(character, data);
				this.applySpeed(character, data);
			}
		});
	}

	private handleBlockEvent(player: Player, isBlocking: boolean): void {
		const data = this.playerData.get(player);
		if (!data) return;

		const character = player.Character;
		if (!character) return;
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid || humanoid.Health <= 0) return;

		if (data.IsInClash) return;
		if (data.IsGuardBroken) {
			this.blockEvent.FireClient(player, "GuardBroken");
			return;
		}
		if (data.IsStunned && !data.CanBlockWhileStunned) {
			this.blockEvent.FireClient(player, "CannotBlock");
			return;
		}
		if (data.IsAttacking) return;

		if (isBlocking && data.Stamina < ARCZIS_COMBAT_CONFIG.MinStaminaToAct) {
			this.blockEvent.FireClient(player, "NoStamina");
			return;
		}

		data.IsBlocking = isBlocking;
		this.syncCharacterValues(character, data);
		this.applySpeed(character, data);
	}

	private handleClashEvent(player: Player, action: string, clashId: string): void {
		if (action === "ButtonPress") {
			const clashData = this.activeClashes.get(clashId);
			if (clashData && (clashData.Player1 === player || clashData.Player2 === player)) {
				const current = clashData.ButtonPresses.get(player) ?? 0;
				clashData.ButtonPresses.set(player, current + 1);
			}
		}
	}

	// ═══════════════════════════════════════════════════════
	// LEGACY WEAPON SUPPORT
	// ═══════════════════════════════════════════════════════

	private processLegacyWeaponAttack(attacker: Player, tool: Tool): void {
		const character = attacker.Character;
		if (!character || tool.Parent !== character) return;

		const config = this.weaponConfigs.get(tool.Name) ?? WOODEN_SWORD_CONFIG;
		const now = os.clock();
		const lastAttack = this.playerWeaponCooldowns.get(attacker.UserId) ?? 0;
		if (now - lastAttack < config.cooldown - 0.08) return;
		this.playerWeaponCooldowns.set(attacker.UserId, now);

		const hrp = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!hrp) return;

		const attackOrigin = hrp.Position.add(hrp.CFrame.LookVector.mul(config.range / 2));
		const attackBoxSize = new Vector3(4, 5, config.range);

		const overlapParams = new OverlapParams();
		overlapParams.FilterType = Enum.RaycastFilterType.Exclude;
		overlapParams.FilterDescendantsInstances = [character];

		const hitParts = Workspace.GetPartBoundsInBox(
			new CFrame(attackOrigin, attackOrigin.add(hrp.CFrame.LookVector)),
			attackBoxSize,
			overlapParams,
		);

		const hitHumanoids = new Set<Humanoid>();
		for (const part of hitParts) {
			const enemyModel = part.Parent;
			if (!enemyModel) continue;

			const enemyHumanoid = enemyModel.FindFirstChildOfClass("Humanoid");
			if (enemyHumanoid && enemyHumanoid.Health > 0 && !hitHumanoids.has(enemyHumanoid)) {
				hitHumanoids.add(enemyHumanoid);
				enemyHumanoid.TakeDamage(config.damage);

				if (config.hitSoundId) {
					const rootPart = enemyModel.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
					if (rootPart) {
						const hitSound = new Instance("Sound");
						hitSound.SoundId = config.hitSoundId;
						hitSound.Volume = 0.5;
						hitSound.Parent = rootPart;
						hitSound.Play();
						hitSound.Ended.Connect(() => hitSound.Destroy());
					}
				}
			}
		}
	}

	public applyDamageToPlayer(
		targetPlayer: Player,
		damage: number,
		attackType: "M1" | "Heavy",
		attackerModel: Model,
	): void {
		const targetChar = targetPlayer.Character;
		if (!targetChar) return;
		const targetData = this.playerData.get(targetPlayer);
		if (!targetData || targetData.IsInClash || this.isPlayerDamageImmune(targetPlayer)) return;

		const canBlock = !targetData.IsGuardBroken && (!targetData.IsStunned || targetData.CanBlockWhileStunned);
		const isBlocking = targetData.IsBlocking && canBlock;
		const knockback =
			attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.HeavyKnockback : ARCZIS_COMBAT_CONFIG.M1Knockback;
		const stunDur =
			attackType === "Heavy" ? ARCZIS_COMBAT_CONFIG.HeavyStunDuration : ARCZIS_COMBAT_CONFIG.M1StunDuration;
		const blockDrain =
			attackType === "Heavy"
				? ARCZIS_COMBAT_CONFIG.BlockStaminaDrainPerHeavy
				: ARCZIS_COMBAT_CONFIG.BlockStaminaDrainPerHit;

		if (isBlocking) {
			targetData.Stamina = math.max(0, targetData.Stamina - blockDrain);
			targetData.LastStaminaUse = os.clock();
			const tStamVal = targetChar.FindFirstChild("Stamina") as NumberValue | undefined;
			if (tStamVal) tStamVal.Value = targetData.Stamina;

			if (targetData.Stamina <= 0) {
				this.applyGuardBreak(targetChar, ARCZIS_COMBAT_CONFIG.GuardBreakStunDuration);
				const hum = targetChar.FindFirstChildOfClass("Humanoid");
				if (hum) hum.TakeDamage(damage);
				this.applyKnockback(targetChar, attackerModel, ARCZIS_COMBAT_CONFIG.GuardBreakKnockback);
			} else {
				const actualDmg = damage * (1 - ARCZIS_COMBAT_CONFIG.BlockedDamageReduction);
				this.playSoundOnCharacter(targetChar, ARCZIS_COMBAT_CONFIG.Sounds.BlockHit, 0.9);
				this.hitReactionEvent.FireClient(
					targetPlayer,
					"BlockHit",
					ARCZIS_COMBAT_CONFIG.BlockStunDuration,
					true,
				);
				const hum = targetChar.FindFirstChildOfClass("Humanoid");
				if (hum) hum.TakeDamage(actualDmg);
				this.applyKnockback(targetChar, attackerModel, knockback * 0.2);
			}
		} else {
			if (attackType === "Heavy") {
				this.playSoundOnCharacter(targetChar, ARCZIS_COMBAT_CONFIG.Sounds.HitHeavy, 1.0);
			} else {
				this.playSoundOnCharacter(targetChar, ARCZIS_COMBAT_CONFIG.Sounds.Hit, 0.9);
			}
			const hum = targetChar.FindFirstChildOfClass("Humanoid");
			if (hum) hum.TakeDamage(damage);
			this.applyHitStun(targetChar, stunDur, attackType);
			this.applyKnockback(targetChar, attackerModel, knockback);
		}
	}
}
