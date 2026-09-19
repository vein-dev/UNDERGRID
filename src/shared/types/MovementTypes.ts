/**
 * MovementTypes.ts
 * Kontrak tipe data terpusat untuk sistem movement R6 (Turning, Tilt, Crouch, Crawl, Fall, Stamina).
 */

export interface R6JointData {
	rootJointC0: CFrame;
	neckC0: CFrame;
	rightHipC0: CFrame;
	leftHipC0: CFrame;
}

export interface PlayerTiltState {
	currentAngles: [number, number, number];
	currentMomentumFactor: number;
	punchAmount: number;
	punchActive: boolean;
}

export interface MovementStaminaState {
	current: number;
	max: number;
	isExhausted: boolean;
	canSprint: boolean;
}

export type FallLandingType = "normal" | "small" | "large";
