import { StageLightingControlPayload } from "./StageLightingTypes";
import { StageCameraControlPayload } from "./StageCameraTypes";

/**
 * Types and interfaces for the Admin Panel system.
 */

/** Tab identifiers for the modular Admin Panel. */
export enum AdminTab {
	MusicMaster = "MusicMaster",
	Announcement = "Announcement",
	TimeControl = "TimeControl",
	PlayerManagement = "PlayerManagement",
}

// SYNC: AtmospherePreset dihapus — kontrol lighting hanya via StageLightMode
// untuk mencegah konflik mode (strobo gagal jalan karena preset override MusicSync).
export interface AdminStateSync {
	isQueueLocked: boolean;
	stageLighting?: StageLightingControlPayload;
	djStageLighting?: StageLightingControlPayload;
	stageCamera?: StageCameraControlPayload;
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

/** Ban record for persistent moderation. */
export interface BanRecord {
	userId: number;
	name: string;
	reason: string;
	bannedBy: string;
	bannedAt: number; // unix timestamp in seconds
	durationSeconds: number; // 0 = permanent
}

/** Payload for kicking a player. */
export interface KickPayload {
	targetUserId: number;
	reason?: string;
}

/** Payload for banning a player. */
export interface BanPayload {
	targetUserId: number;
	reason?: string;
	durationSeconds?: number; // 0 = permanent
}

/** Payload for unbanning a player. */
export interface UnbanPayload {
	targetUserId: number;
}
