/**
 * Types and interfaces for Concert Stage Lighting system.
 */

export enum StageLightMode {
	Off = "Off",
	Static = "Static",
	SpotlightCenter = "SpotlightCenter",
	Wave = "Wave",
	Ballyhoo = "Ballyhoo",
	Circle = "Circle",
	Manual = "Manual",
	Strobe = "Strobe",
	MusicSync = "MusicSync",
}

export interface StageLightFixture {
	model: Model;
	column: number;
	row: number;
	panMotor: Motor6D;
	tiltMotor: Motor6D;
	initialPanC0: CFrame;
	initialTiltC0: CFrame;
	lensPart?: BasePart;
	spotLight?: SpotLight;
	beam?: Beam;
	basePart?: BasePart;
}

export type StageTarget = "main" | "dj" | "all";

export interface StageLightingControlPayload {
	mode: StageLightMode;
	panAngle: number; // in radians (-2.35 to 2.35, approx -135° to +135°)
	tiltAngle: number; // in radians (0 to 1.57, approx 0° to 90°)
	motorSpeed: number; // 0.01 to 0.08
	color: Color3;
	brightness: number; // 0 to 4
	beamEnabled: boolean;
	strobeSpeed: number; // 0 = off, 1 = slow, 2 = med, 3 = fast
	isRainbow: boolean;
	isPulse: boolean;
	isMusicSync: boolean;
	target?: StageTarget;
	fogEnabled?: boolean; // toggle on/off
	fogIntensity?: number; // 0.0 - 1.0, default 0.5
	backdropPreset?: string; // preset id from BACKDROP_GIF_PRESETS or "off"
	backdropBrightness?: number; // 0 to 5, default 2.0
}

export interface StageLightState {
	currentMode: StageLightMode;
	color: Color3;
	brightness: number;
	beamEnabled: boolean;
}
