/**
 * FightTypes - Type definitions and configurations for the Arczis Combat System.
 */

export interface CombatAnimationsConfig {
	Equip: string;
	CombatIdle: string;
	CombatWalk: string;
	CombatRun: string;
	M1_Punch1: string;
	M1_Punch2: string;
	HeavyPunch: string;
	Block: string;
	BlockHit: string;
	HitReactionM1_1: string;
	HitReactionM1_2: string;
	HitReactionHeavy: string;
	GuardBreak: string;
	ClashLoop?: string;
	ClashWin?: string;
}

export interface CombatSoundsConfig {
	Equip: string;
	Swing: string[];
	SwingHeavy: string;
	Hit: string[];
	HitHeavy: string;
	BlockHit: string;
	GuardBreak: string;
	NoStamina: string;
	ClashStart: string;
	ClashWin: string;
}

export interface ArczisCombatConfig {
	// Debug
	DebugHitboxes: boolean;
	DebugHitboxColor: Color3;
	DebugHitboxTransparency: number;
	DebugHitboxDuration: number;

	// Stamina
	MaxStamina: number;
	StaminaRegenRate: number;
	StaminaRegenDelay: number;
	MinStaminaToAct: number;

	// Stamina Costs
	M1StaminaCost: number;
	HeavyStaminaCost: number;
	DashStaminaCost: number;
	BlockStaminaDrainPerHit: number;
	BlockStaminaDrainPerHeavy: number;

	// Damage
	M1Damage: number;
	HeavyDamage: number;
	BlockedDamageReduction: number;
	ClashWinDamage: number;

	// Timings & Cooldowns
	M1Cooldown: number;
	M1AnimationLock: number;
	HeavyCooldown: number;
	HeavyAnimationLock: number;
	DashCooldown: number;

	// Clash
	ClashDetectionWindow: number;
	ClashButtonPressWindow: number;
	ClashWinPunchDelay: number;
	ClashWinStunDuration: number;
	ClashWinKnockback: number;
	ClashWinnerSlideBack: number;
	ClashDistance: number;

	// Stun
	M1StunDuration: number;
	M1StunCanBlock: boolean;
	M1StunCanAttack: boolean;
	HeavyStunDuration: number;
	HeavyStunCanBlock: boolean;
	HeavyStunCanAttack: boolean;
	GuardBreakStunDuration: number;
	GuardBreakCanBlock: boolean;
	GuardBreakCanAttack: boolean;
	BlockStunDuration: number;

	// Hitbox
	HitboxSize: Vector3;
	HitboxOffset: number;
	HitboxDelay: number;

	// Knockback
	M1Knockback: number;
	HeavyKnockback: number;
	GuardBreakKnockback: number;

	// Movement
	BlockWalkSpeedMultiplier: number;
	StunnedWalkSpeed: number;
	HitStunWalkSpeedMultiplier: number;
	AttackingWalkSpeedMultiplier: number;
	DefaultWalkSpeed: number;
	RunSpeedThreshold: number;
	SprintSpeed: number;

	// Audio & Assets
	SoundVolume: number;
	SoundRange: number;
	Animations: CombatAnimationsConfig;
	Sounds: CombatSoundsConfig;
}

export const ARCZIS_COMBAT_CONFIG: ArczisCombatConfig = {
	DebugHitboxes: false,
	DebugHitboxColor: Color3.fromHex("#ff0000"),
	DebugHitboxTransparency: 0.5,
	DebugHitboxDuration: 0.3,

	MaxStamina: 100,
	StaminaRegenRate: 15,
	StaminaRegenDelay: 1.2,
	MinStaminaToAct: 15,

	M1StaminaCost: 12,
	HeavyStaminaCost: 35,
	DashStaminaCost: 18,
	BlockStaminaDrainPerHit: 25,
	BlockStaminaDrainPerHeavy: 40,

	M1Damage: 8,
	HeavyDamage: 20,
	BlockedDamageReduction: 0.8,
	ClashWinDamage: 12,

	M1Cooldown: 0.2,
	M1AnimationLock: 0.7,
	HeavyCooldown: 1.2,
	HeavyAnimationLock: 1.0,
	DashCooldown: 1.5,

	ClashDetectionWindow: 0.15,
	ClashButtonPressWindow: 3.0,
	ClashWinPunchDelay: 0.83,
	ClashWinStunDuration: 1.2,
	ClashWinKnockback: 20,
	ClashWinnerSlideBack: 25,
	ClashDistance: 3.5,

	M1StunDuration: 0.4,
	M1StunCanBlock: true,
	M1StunCanAttack: false,

	HeavyStunDuration: 1.2,
	HeavyStunCanBlock: true,
	HeavyStunCanAttack: false,

	GuardBreakStunDuration: 1.5,
	GuardBreakCanBlock: false,
	GuardBreakCanAttack: false,

	BlockStunDuration: 0.2,

	HitboxSize: new Vector3(5, 6, 5),
	HitboxOffset: 3.5,
	HitboxDelay: 0.15,

	M1Knockback: 15,
	HeavyKnockback: 40,
	GuardBreakKnockback: 25,

	BlockWalkSpeedMultiplier: 0.3,
	StunnedWalkSpeed: 0,
	HitStunWalkSpeedMultiplier: 0.3,
	AttackingWalkSpeedMultiplier: 0.3,
	DefaultWalkSpeed: 9,
	RunSpeedThreshold: 11,
	SprintSpeed: 14,

	SoundVolume: 1.0,
	SoundRange: 50,

	Animations: {
		Equip: "rbxassetid://119283951089462",
		CombatIdle: "rbxassetid://110243561658761",
		CombatWalk: "rbxassetid://76100428490444",
		CombatRun: "rbxassetid://138179201505364",
		M1_Punch1: "rbxassetid://71439687143035",
		M1_Punch2: "rbxassetid://110495303777505",
		HeavyPunch: "rbxassetid://102850326398686",
		Block: "rbxassetid://92587763999578",
		BlockHit: "rbxassetid://121583187903605",
		HitReactionM1_1: "rbxassetid://131890085552039",
		HitReactionM1_2: "rbxassetid://83796967198433",
		HitReactionHeavy: "rbxassetid://83796967198433",
		GuardBreak: "rbxassetid://99670245070100",
		ClashLoop: "rbxassetid://92972932799742",
		ClashWin: "rbxassetid://139230394073909",
	},

	Sounds: {
		Equip: "rbxassetid://4549835866",
		Swing: ["rbxassetid://101467914599270", "rbxassetid://74238153433253"],
		SwingHeavy: "rbxassetid://74238153433253",
		Hit: ["rbxassetid://8595980577", "rbxassetid://9117969687"],
		HitHeavy: "rbxassetid://9117969687",
		BlockHit: "rbxassetid://136811265205147",
		GuardBreak: "rbxassetid://4086172420",
		NoStamina: "rbxassetid://4813362917",
		ClashStart: "rbxassetid://8595974357",
		ClashWin: "rbxassetid://8595980577",
	},
};

export interface CombatPlayerData {
	Stamina: number;
	IsBlocking: boolean;
	IsStunned: boolean;
	IsGuardBroken: boolean;
	CanBlockWhileStunned: boolean;
	IsAttacking: boolean;
	IsInClash: boolean;
	LastM1Time: number;
	LastHeavyTime: number;
	LastDashTime: number;
	NextCombo: number;
	LastStaminaUse: number;
	HitReactionCount: number;
	HasAnimateScript: boolean;
	BaseWalkSpeed: number;
	IsClashImmune: boolean;
	ClashImmuneUntil: number;
	IsClashWinner: boolean;
	IsEquipped: boolean;
}

export interface ActiveClashSession {
	Player1: Player;
	Player2: Player;
	StartTime: number;
	Winner?: Player;
	ButtonPresses: Map<Player, number>;
	Constraints: Instance[];
}

export type CombatActionType = "Equip" | "M1" | "Heavy" | "Dash";
export type CombatReactionType =
	"HitReactionM1_1" | "HitReactionM1_2" | "HitReactionHeavy" | "GuardBreak" | "BlockHit" | "StunEnded";
