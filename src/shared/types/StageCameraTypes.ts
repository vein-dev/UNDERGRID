/**
 * Types and interfaces for Concert Stage Camera Controller.
 */

export type StageCameraMode = "default" | "face" | "orbit" | "drone" | "low_angle" | "fixed_cam";
export type StageCameraShake = "none" | "subtle" | "beat" | "heavy" | "heartbeat" | "drunk";

export interface StageCameraControlPayload {
	enabled: boolean;
	mode: StageCameraMode;
	shake: StageCameraShake;
	targetUserId?: number;
	targetName?: string;
	faceDistance: number;
	fov: number;
	orbitSpeed: number;
	fixedCamIndex?: number;
}
