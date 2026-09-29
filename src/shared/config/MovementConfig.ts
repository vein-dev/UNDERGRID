/**
 * MovementConfig.ts
 * Konfigurasi terpusat untuk Ultimate R6 Movement System:
 * R6 Procedural Joint Turning, Tilt, Sprint Punch, Crouch & Crawl, Fall System, Stamina, dan Camera Bobbing.
 * Seluruh nilai diambil dan disesuaikan dari template Ultimate R6 Movement System.
 */

export const MovementConfig = {
	TURNING: {
		rangeOfMotion: 40,
		rangeOfMotionTorso: 40,
		rangeOfMotionXZ: 40 / 140,
		lerpSpeed: 0.005,
		minMomentum: 0,
		maxMomentum: 2.0,
		smoothSpeed: 5,
		momentumBlendSpeed: 4,
		sprintSpeedThreshold: 20,
	},

	TILT: {
		walkMomentumFactor: 0.02,
		sprintMomentumFactor: 0.007,
		crouchMomentumFactor: 0.025,
	},

	SPRINT_PUNCH: {
		punchStrength: 0.6, // radians forward slam
		decaySpeed: 4.0, // recovery speed
	},

	JUMP: {
		jumpPower: 35, // Tinggi lompatan R6 terpusat
	},

	CROUCH: {
		crouchKey: Enum.KeyCode.C,
		crawlKey: Enum.KeyCode.Z,
		sprintKeys: [Enum.KeyCode.LeftShift, Enum.KeyCode.RightShift],

		normalSpeed: 12,
		sprintSpeed: 27,
		crouchSpeed: 6,
		crawlSpeed: 3,
		jumpPower: 35,

		walkAnimSpeed: 0.8,
		runAnimSpeed: 1.4,
		crouchIdleAnimSpeed: 1.0,
		crouchWalkAnimSpeed: 1.0,
		crawlIdleAnimSpeed: 1.0,
		crawlWalkAnimSpeed: 1.0,

		defaultFOV: 70,
		sprintFOV: 90,
		crouchFOV: 62,
		crawlFOV: 55,

		sprintFOVTime: 0.35,
		crouchFOVTime: 0.4,
		crawlFOVTime: 0.4,
		defaultFOVTime: 0.5,

		crouchCamOffset: -1.5,
		crawlCamOffset: -2.8,

		crouchCooldown: 0.2,
		crawlCooldown: 0.2,
		maxFreefallTime: 0.5,
	},

	FALL: {
		minFallThreshold: 3.8, // Ambang batas jarak jatuh minimal untuk landing animation (di atas tinggi loncat ~3.1 studs)
		minDamageHeight: 4,
		highFallThreshold: 15,
		damageMultiplier: 1.5,

		normalLandAnimDuration: 0.6,
		smallFallAnimDuration: 0.5,
		largeFallAnimDuration: 0.1, // 0.1 for R6

		shortFallShakeMagnitude: 0.15,
		shortFallShakeDuration: 0.35,

		baseShakeDuration: 0.3,
		baseShakeMagnitude: 0.2,
		maxShakeMagnitude: 2.0,
		maxShakeDuration: 0.7,
		noiseSpeed: 8,
	},

	STAMINA: {
		maxStamina: 100,
		drainRate: 22,
		regenRate: 14,
		regenDelay: 1.2,
		minStaminaSprint: 15,
		sprintSpeedThreshold: 20,
	},

	BOBBING: {
		enabled: true,
		intensity: 1.0,
		swaySmoothness: 0.125,
	},

	FOOTSTEPS: {
		footstepsPerSecond: 2.5,
		maxDistance: 250,
	},

	ANIMATIONS: {
		// R6 Base animations
		idle: "rbxassetid://98502254031730",
		walk: "rbxassetid://93676361732445",
		run: "rbxassetid://132956755463516",
		jump: "rbxassetid://133537718100543",
		fall: "rbxassetid://113848701423355",
		climb: "rbxassetid://72046625508272",

		// Crouch & Crawl animations
		crouchIdle: "rbxassetid://79385348364790",
		crouchWalk: "rbxassetid://128074595372165",
		crouchToCrawl: "rbxassetid://122788344590464",
		crawlIdle: "rbxassetid://83036588622212",
		crawlWalk: "rbxassetid://123261234628587",
		crawlToCrouch: "rbxassetid://88304366062605",

		// Fall & Landing animations
		fallLong: "rbxassetid://127369603008939",
		fallShort: "rbxassetid://128028461513676",
		landNormal: "rbxassetid://81334385289012",
	},

	SOUNDS: {
		crouch: "rbxassetid://3746956704",
		getUp: "rbxassetid://9113468907",
		heartBeat: "rbxassetid://72495845036245",
		fallSmall: "", // Menggunakan suara landing bawaan Roblox
		fallMedium: "", // Menggunakan suara landing bawaan Roblox
		fallLarge: "", // Menggunakan suara landing bawaan Roblox
		death: "rbxassetid://140695149439373",
	},
} as const;
