import { LightingProfile, TimeAnchor, TimePeriod } from "../types/TimeTypes";

/**
 * TimeConfig.ts
 * Konfigurasi sistem waktu dinamis (Day/Night Cycle) untuk map game.
 * Menggunakan timeline multi-anchor 24-jam bernuansa Los Angeles / New York City
 * dengan interpolasi super mulus dan horizon 100% jernih tanpa garis batas kaku.
 */
export const TimeConfig = {
	/** Durasi 1 siklus hari penuh (24 jam in-game) dalam menit waktu nyata */
	CYCLE_DURATION_MINUTES: 24,

	/** Waktu awal saat server dimulai (13.0 = 13:00 / Siang) */
	STARTING_CLOCK_TIME: 13.0,

	/** Kecepatan waktu standar */
	DEFAULT_TIME_SCALE: 1.0,

	/**
	 * 8 Titik Anchor 24-Jam Realistis (LA / NYC Atmosphere Timeline).
	 * Seluruh anchor menggunakan atmosphereHaze = 0 dan atmosphereOffset = 0
	 * untuk menghilangkan balok/garis kaku di horizon secara permanen.
	 */
	ANCHORS: [
		{
			hour: 0.0,
			name: "Midnight",
			profile: {
				brightness: 2.0,
				ambient: Color3.fromRGB(90, 95, 110),
				outdoorAmbient: Color3.fromRGB(120, 126, 145),
				colorShiftTop: Color3.fromRGB(180, 200, 235),
				colorShiftBottom: Color3.fromRGB(95, 90, 80),
				exposureCompensation: 0.04,
				atmosphereColor: Color3.fromRGB(35, 40, 52),
				atmosphereDecay: Color3.fromRGB(16, 18, 25),
				atmosphereHaze: 0.0,
				atmosphereDensity: 0.05,
				atmosphereOffset: 0.0,
				atmosphereGlare: 0.0,
				environmentDiffuseScale: 0.5,
				environmentSpecularScale: 0.18,
			},
		},
		{
			hour: 4.75, // 04:45
			name: "PreDawn",
			profile: {
				brightness: 1.8,
				ambient: Color3.fromRGB(85, 88, 105),
				outdoorAmbient: Color3.fromRGB(115, 120, 140),
				colorShiftTop: Color3.fromRGB(160, 175, 220),
				colorShiftBottom: Color3.fromRGB(80, 75, 80),
				exposureCompensation: 0.02,
				atmosphereColor: Color3.fromRGB(50, 55, 75),
				atmosphereDecay: Color3.fromRGB(25, 28, 45),
				atmosphereHaze: 0.0,
				atmosphereDensity: 0.08,
				atmosphereOffset: 0.0,
				atmosphereGlare: 0.0,
				environmentDiffuseScale: 0.5,
				environmentSpecularScale: 0.18,
			},
		},
		{
			hour: 6.25, // 06:15
			name: "Sunrise",
			profile: {
				brightness: 2.4,
				ambient: Color3.fromRGB(95, 88, 98),
				outdoorAmbient: Color3.fromRGB(150, 130, 120),
				colorShiftTop: Color3.fromRGB(255, 195, 135),
				colorShiftBottom: Color3.fromRGB(120, 95, 105),
				exposureCompensation: 0.0,
				atmosphereColor: Color3.fromRGB(210, 180, 150),
				atmosphereDecay: Color3.fromRGB(95, 60, 35),
				atmosphereHaze: 0.0,
				atmosphereDensity: 0.12,
				atmosphereOffset: 0.0,
				atmosphereGlare: 0.08,
				environmentDiffuseScale: 0.52,
				environmentSpecularScale: 0.18,
			},
		},
		{
			hour: 8.5, // 08:30
			name: "Morning",
			profile: {
				brightness: 2.8,
				ambient: Color3.fromRGB(105, 105, 110),
				outdoorAmbient: Color3.fromRGB(155, 155, 160),
				colorShiftTop: Color3.fromRGB(255, 245, 230),
				colorShiftBottom: Color3.fromRGB(85, 82, 80),
				exposureCompensation: 0.0,
				atmosphereColor: Color3.fromRGB(190, 205, 225),
				atmosphereDecay: Color3.fromRGB(70, 85, 105),
				atmosphereHaze: 0.0,
				atmosphereDensity: 0.1,
				atmosphereOffset: 0.0,
				atmosphereGlare: 0.05,
				environmentDiffuseScale: 0.5,
				environmentSpecularScale: 0.18,
			},
		},
		{
			hour: 13.0, // 13:00 - Siang penuh stabil
			name: "AfternoonDay",
			profile: {
				brightness: 3.0,
				ambient: Color3.fromRGB(110, 110, 115),
				outdoorAmbient: Color3.fromRGB(160, 160, 165),
				colorShiftTop: Color3.fromRGB(0, 0, 0),
				colorShiftBottom: Color3.fromRGB(0, 0, 0),
				exposureCompensation: 0.0,
				atmosphereColor: Color3.fromRGB(190, 210, 235),
				atmosphereDecay: Color3.fromRGB(65, 80, 100),
				atmosphereHaze: 0.0,
				atmosphereDensity: 0.1,
				atmosphereOffset: 0.0,
				atmosphereGlare: 0.05,
				environmentDiffuseScale: 0.5,
				environmentSpecularScale: 0.18,
			},
		},
		{
			hour: 17.25, // 17:15
			name: "LateAfternoon",
			profile: {
				brightness: 2.6,
				ambient: Color3.fromRGB(105, 90, 95),
				outdoorAmbient: Color3.fromRGB(155, 125, 110),
				colorShiftTop: Color3.fromRGB(255, 180, 110),
				colorShiftBottom: Color3.fromRGB(105, 78, 88),
				exposureCompensation: 0.0,
				atmosphereColor: Color3.fromRGB(220, 165, 120),
				atmosphereDecay: Color3.fromRGB(110, 55, 30),
				atmosphereHaze: 0.0,
				atmosphereDensity: 0.12,
				atmosphereOffset: 0.0,
				atmosphereGlare: 0.08,
				environmentDiffuseScale: 0.52,
				environmentSpecularScale: 0.18,
			},
		},
		{
			hour: 18.5, // 18:30 - Magic Sunset LA / NYC
			name: "SunsetDusk",
			profile: {
				brightness: 2.0,
				ambient: Color3.fromRGB(90, 75, 90),
				outdoorAmbient: Color3.fromRGB(140, 100, 105),
				colorShiftTop: Color3.fromRGB(255, 125, 70),
				colorShiftBottom: Color3.fromRGB(95, 58, 100),
				exposureCompensation: 0.0,
				atmosphereColor: Color3.fromRGB(190, 115, 95),
				atmosphereDecay: Color3.fromRGB(120, 45, 40),
				atmosphereHaze: 0.0,
				atmosphereDensity: 0.1,
				atmosphereOffset: 0.0,
				atmosphereGlare: 0.06,
				environmentDiffuseScale: 0.52,
				environmentSpecularScale: 0.18,
			},
		},
		{
			hour: 19.75, // 19:45 - Blue Hour Twilight
			name: "BlueHour",
			profile: {
				brightness: 1.9,
				ambient: Color3.fromRGB(85, 90, 108),
				outdoorAmbient: Color3.fromRGB(118, 122, 145),
				colorShiftTop: Color3.fromRGB(160, 185, 235),
				colorShiftBottom: Color3.fromRGB(88, 82, 78),
				exposureCompensation: 0.02,
				atmosphereColor: Color3.fromRGB(45, 52, 75),
				atmosphereDecay: Color3.fromRGB(20, 24, 40),
				atmosphereHaze: 0.0,
				atmosphereDensity: 0.06,
				atmosphereOffset: 0.0,
				atmosphereGlare: 0.02,
				environmentDiffuseScale: 0.5,
				environmentSpecularScale: 0.18,
			},
		},
	] as TimeAnchor[],

	/**
	 * Profil fallback berdasarkan periode waktu dasar (kompatibilitas enum)
	 */
	PROFILES: {
		[TimePeriod.Dawn]: {
			brightness: 2.4,
			ambient: Color3.fromRGB(95, 88, 98),
			outdoorAmbient: Color3.fromRGB(150, 130, 120),
			colorShiftTop: Color3.fromRGB(255, 195, 135),
			colorShiftBottom: Color3.fromRGB(120, 95, 105),
			exposureCompensation: 0.0,
			atmosphereColor: Color3.fromRGB(210, 180, 150),
			atmosphereDecay: Color3.fromRGB(95, 60, 35),
			atmosphereHaze: 0.0,
			atmosphereDensity: 0.12,
			atmosphereOffset: 0.0,
			atmosphereGlare: 0.08,
			environmentDiffuseScale: 0.52,
			environmentSpecularScale: 0.18,
		} as LightingProfile,

		[TimePeriod.Day]: {
			brightness: 3.0,
			ambient: Color3.fromRGB(110, 110, 115),
			outdoorAmbient: Color3.fromRGB(160, 160, 165),
			colorShiftTop: Color3.fromRGB(0, 0, 0),
			colorShiftBottom: Color3.fromRGB(0, 0, 0),
			exposureCompensation: 0.0,
			atmosphereColor: Color3.fromRGB(190, 210, 235),
			atmosphereDecay: Color3.fromRGB(65, 80, 100),
			atmosphereHaze: 0.0,
			atmosphereDensity: 0.1,
			atmosphereOffset: 0.0,
			atmosphereGlare: 0.05,
			environmentDiffuseScale: 0.5,
			environmentSpecularScale: 0.18,
		} as LightingProfile,

		[TimePeriod.Dusk]: {
			brightness: 2.0,
			ambient: Color3.fromRGB(90, 75, 90),
			outdoorAmbient: Color3.fromRGB(140, 100, 105),
			colorShiftTop: Color3.fromRGB(255, 125, 70),
			colorShiftBottom: Color3.fromRGB(95, 58, 100),
			exposureCompensation: 0.0,
			atmosphereColor: Color3.fromRGB(190, 115, 95),
			atmosphereDecay: Color3.fromRGB(120, 45, 40),
			atmosphereHaze: 0.0,
			atmosphereDensity: 0.1,
			atmosphereOffset: 0.0,
			atmosphereGlare: 0.06,
			environmentDiffuseScale: 0.52,
			environmentSpecularScale: 0.18,
		} as LightingProfile,

		[TimePeriod.Night]: {
			brightness: 2.0,
			ambient: Color3.fromRGB(90, 95, 110),
			outdoorAmbient: Color3.fromRGB(120, 126, 145),
			colorShiftTop: Color3.fromRGB(180, 200, 235),
			colorShiftBottom: Color3.fromRGB(95, 90, 80),
			exposureCompensation: 0.04,
			atmosphereColor: Color3.fromRGB(35, 40, 52),
			atmosphereDecay: Color3.fromRGB(16, 18, 25),
			atmosphereHaze: 0.0,
			atmosphereDensity: 0.05,
			atmosphereOffset: 0.0,
			atmosphereGlare: 0.0,
			environmentDiffuseScale: 0.5,
			environmentSpecularScale: 0.18,
		} as LightingProfile,
	},
} as const;


