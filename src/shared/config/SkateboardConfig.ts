/**
 * SkateboardConfig.ts
 * Konfigurasi terpusat untuk sistem Skateboard R6:
 * Kontrol keybind, tuning fisika gerak & lompatan, offset joint, serta pemetaan animasi.
 */

import { SkateboardTrickName } from "../types";

export const SkateboardConfig = {
	KEYBINDS: {
		push: Enum.KeyCode.W,
		brake: Enum.KeyCode.S,
		turnLeft: Enum.KeyCode.A,
		turnRight: Enum.KeyCode.D,
		ollie: Enum.KeyCode.Space,
		tricks: {
			[Enum.KeyCode.Q.Value]: "Kickflip" as SkateboardTrickName,
			[Enum.KeyCode.E.Value]: "Heelflip" as SkateboardTrickName,
			[Enum.KeyCode.R.Value]: "Treflip" as SkateboardTrickName,
			[Enum.KeyCode.F.Value]: "Shuv" as SkateboardTrickName,
		},
	},

	PHYSICS: {
		maxSpeed: 38, // studs per second (kecepatan maksimal seimbang & terkendali)
		pushAcceleration: 20, // studs/s^2 laju akselerasi halus & dinamis saat menahan W
		pushInitialKick: 3, // dorongan awal lembut saat pertama kali mulai jalan
		maxFakieSpeed: 28, // kecepatan maksimal saat meluncur mundur (Fakie)
		fakieAcceleration: 16, // laju akselerasi saat Fakie Push
		turnAngularVelocity: 3.0, // rad/s kecepatan belok dasar saat carving
		steerResponsiveness: 7.0, // kelenturan respons kemudi (lerp smoothing)
		maxBankingAngle: 0.22, // radians (~12.6 deg) sudut kemiringan badan & papan saat belok tajam
		rollSmoothing: 9.0, // kecepatan transisi kemiringan roll
		carvingTraction: 14.0, // kelenturan cengkeraman ban melengkung (momentum curve)
		dragMultiplier: 0.992, // perlambatan alami sangat halus saat meluncur stabil tanpa push
		brakeDecel: 36, // perlambatan saat menahan S
		ollieMinHeight: 2.2, // Tinggi lompatan minimum saat tap (studs)
		ollieMaxHeight: 3.8, // Tinggi lompatan maksimum saat tahan spasi (studs)
		ollieMaxChargeTime: 0.45, // Durasi charge (detik) untuk mencapai tinggi maksimum
		trickPopJump: 0, // Pastikan 0 agar tidak ada tendangan ekstra di udara
		airStabilizeDamping: 15, // stabilitas leveling di udara
	},

	ATTACHMENT: {
		// Posisikan papan tepat di bawah telapak kaki R6 sejajar arah hadap karakter (Z-axis)
		boardCFrameOffset: new CFrame(0, -3.05, 0),
		jointName: "VisualBoard",
		visualBoardPartName: "Board",
		hipHeightMounted: 0.66, // Mengangkat kaki R6 agar roda papan menempel rata di atas permukaan tanah (ground flush)
		hipHeightDismounted: 0,
	},

	// Pure Roblox Animation Asset IDs
	ANIMATIONS: {
		// Locomotion & Stance (Regular)
		idle: "rbxassetid://118296088925836",
		startPush: "rbxassetid://106768088460242",
		stop: "rbxassetid://110486689913186",

		// Locomotion & Stance (Fakie / Backward)
		fakiePush: "rbxassetid://102870378801776",
		fakieIdle: "rbxassetid://122753602236712",
		fakieStop: "rbxassetid://135223138834147",
		fakieCrouch: "rbxassetid://82026540588352",
		fakieLand: "rbxassetid://82957005822373",

		// Turns
		turnLeft: "rbxassetid://139049160971597",
		turnRight: "rbxassetid://76222808006967",
		fakieTurnLeft: "rbxassetid://94322692844670",
		fakieTurnRight: "rbxassetid://111298254802472",

		// Jump & Air
		crouch: "rbxassetid://78709238286128",
		inAir: "rbxassetid://75404378565724",
		land: "rbxassetid://99158552626386",
		ollie: "rbxassetid://137102910314442",

		// Tricks
		Kickflip: "rbxassetid://132500229375631",
		Heelflip: "rbxassetid://119227389466237",
		Treflip: "rbxassetid://95633782056544",
		Shuv: "rbxassetid://77727951497887",
	},

	// Pure Roblox Sound Asset IDs
	SOUNDS: {
		rolling: "rbxassetid://9125955982",
		pop: "rbxassetid://135161226700647",
		landing: "rbxassetid://80130417720843",
	},
} as const;
