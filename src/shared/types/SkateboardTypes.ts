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
	| "Stopping";

export type SkateboardStance = "Regular" | "Fakie";

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
