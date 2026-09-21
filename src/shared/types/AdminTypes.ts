import { StageLightingControlPayload } from "./StageLightingTypes";

/**
 * Types and interfaces for the Admin Panel system.
 */

/** Tab identifiers for the modular Admin Panel. */
export enum AdminTab {
	MusicMaster = "MusicMaster",
	StageFx = "StageFx",
	TimeControl = "TimeControl",
	PlayerManagement = "PlayerManagement",
}

// SYNC: AtmospherePreset dihapus — kontrol lighting hanya via StageLightMode
// untuk mencegah konflik mode (strobo gagal jalan karena preset override MusicSync).
export interface AdminStateSync {
	isQueueLocked: boolean;
	stageLighting?: StageLightingControlPayload;
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
