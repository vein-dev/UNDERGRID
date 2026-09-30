/**
 * StreetlightConfig
 * Konfigurasi terpusat untuk sistem lampu jalan berbasis CollectionService Tag & Attributes.
 */
export const StreetlightConfig = {
	/** Tag CollectionService untuk mendeteksi part/model lampu jalan */
	TAG: "StreetLight",

	/** Nama instance SpotLight default di dalam part */
	SPOTLIGHT_NAME: "StreetSpotLight",

	/** Interval evaluasi status nyala/mati berdasarkan waktu (detik) */
	UPDATE_INTERVAL_SECONDS: 0.5,

	/** Nama-nama Attribute yang didukung pada BasePart */
	ATTRIBUTES: {
		LIGHT_COLOR: "LightColor",
		OFF_COLOR: "OffColor",
		BRIGHTNESS: "Brightness",
		RANGE: "Range",
		ANGLE: "Angle",
		FACE: "Face",
		SHADOWS: "Shadows",
		ON_CLOCK_TIME: "OnClockTime",
		OFF_CLOCK_TIME: "OffClockTime",
		ALWAYS_ON: "AlwaysOn",
		FLICKER: "Flicker",
		ENABLED: "Enabled",
	},

	/** Nilai default jika Attribute tidak diatur secara eksplisit pada Part */
	DEFAULTS: {
		lightColor: Color3.fromRGB(255, 220, 160),
		offColor: Color3.fromRGB(130, 130, 130),
		brightness: 1.5,
		range: 35,
		angle: 90,
		face: "Bottom", // "Bottom" | "Top" | "Front" | "Back" | "Left" | "Right"
		shadows: true,
		onClockTime: 18.0, // 18:00 (Sore/Senja)
		offClockTime: 6.0, // 06:00 (Fajar/Pagi)
		alwaysOn: false,
		flicker: false,
		flickerSpeed: 8.0,
		flickerIntensity: 0.15,
	},
} as const;
