import { LightingProfile, TimePeriod } from "../types/TimeTypes";

/**
 * TimeConfig.ts
 * Konfigurasi sistem waktu dinamis (Day/Night Cycle) untuk map game.
 */
export const TimeConfig = {
	/** Durasi 1 siklus hari penuh (24 jam in-game) dalam menit waktu nyata */
	CYCLE_DURATION_MINUTES: 24,

	/** Waktu awal saat server dimulai (13.0 = 13:00 / Siang) */
	STARTING_CLOCK_TIME: 13.0,

	/** Kecepatan waktu standar */
	DEFAULT_TIME_SCALE: 1.0,


	/**
	 * Profil pencahayaan visual berdasarkan periode waktu untuk interpolasi (Lerp).
	 */
	PROFILES: {
		[TimePeriod.Dawn]: {
			brightness: 2.2,
			ambient: Color3.fromRGB(75, 70, 80),
			outdoorAmbient: Color3.fromRGB(150, 125, 115),
			colorShiftTop: Color3.fromRGB(255, 195, 140),
			colorShiftBottom: Color3.fromRGB(130, 105, 120),
			exposureCompensation: 0,
		} as LightingProfile,

		[TimePeriod.Day]: {
			brightness: 3.0,
			ambient: Color3.fromRGB(80, 80, 85),
			outdoorAmbient: Color3.fromRGB(130, 130, 135),
			colorShiftTop: Color3.fromRGB(0, 0, 0),
			colorShiftBottom: Color3.fromRGB(0, 0, 0),
			exposureCompensation: 0,
		} as LightingProfile,

		[TimePeriod.Dusk]: {
			brightness: 1.8,
			ambient: Color3.fromRGB(75, 60, 75),
			outdoorAmbient: Color3.fromRGB(140, 95, 85),
			colorShiftTop: Color3.fromRGB(255, 125, 60),
			colorShiftBottom: Color3.fromRGB(90, 50, 110),
			exposureCompensation: -0.1,
		} as LightingProfile,

		[TimePeriod.Night]: {
			brightness: 1.8,
			ambient: Color3.fromRGB(80, 85, 100),
			outdoorAmbient: Color3.fromRGB(105, 110, 130),
			colorShiftTop: Color3.fromRGB(140, 170, 210),
			colorShiftBottom: Color3.fromRGB(65, 70, 85),
			exposureCompensation: 0.0,
		} as LightingProfile,
	},
} as const;
