/**
 * Types and interfaces for the Admin Panel system.
 */

/** Tab identifiers for the modular Admin Panel. */
export enum AdminTab {
	MusicMaster = "MusicMaster",
	StageFx = "StageFx",
	PlayerManagement = "PlayerManagement",
}

/** Stage and venue atmosphere lighting/effect presets. */
export enum AtmospherePreset {
	Spotlight = "Spotlight",
	Strobe = "Strobe",
	Blackout = "Blackout",
	FogMachine = "FogMachine",
}

/** Synchronized admin state for monitoring and controls. */
export interface AdminStateSync {
	isQueueLocked: boolean;
	activePresets: AtmospherePreset[];
}

/** Player information summary for Admin Player Management tab. */
export interface PlayerEntryInfo {
	userId: number;
	name: string;
	displayName: string;
}

/** Result when performing an admin action. */
export interface AdminActionResult {
	success: boolean;
	message: string;
}
