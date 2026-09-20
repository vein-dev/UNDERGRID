/**
 * SkateboardTypes.ts
 * Kontrak tipe data untuk sistem skateboard R6.
 */

export type SkateboardState =
	| "OffBoard"
	| "Mounting"
	| "Idle"
	| "Pushing"
	| "FakiePush"
	| "FakieIdle"
	| "TurningLeft"
	| "TurningRight"
	| "Crouching"
	| "InAir"
	| "Trick"
	| "Landing"
	| "Stopping"
	| "Grinding";

export type SkateboardStance = "Regular" | "Fakie";

export type SkateboardGrindType = "50-50" | "Boardslide";

export interface SkateboardGrindData {
	railPart: BasePart;
	railOrigin: Vector3;
	railDirection: Vector3;
	railHalfLength: number;
	railRadius: number;
	direction: number; // 1 atau -1
	currentDistance: number;
	grindType: SkateboardGrindType;
}

export type SkateboardTrickName =
	| "Ollie"
	| "Kickflip"
	| "Heelflip"
	| "Treflip"
	| "Shuv"
	| "VarialHeel"
	| "Dolphin"
	| "Hosp"
	| "NollieHardflip"
	| "NollieTreFlip";

export interface SkateboardMountPayload {
	mount: boolean;
}

export interface SkateboardTrickPayload {
	trickName: SkateboardTrickName;
	duration?: number;
}
