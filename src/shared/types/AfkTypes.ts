/**
 * AfkTypes.ts
 * Type definitions for AFK status and 19-minute auto-rejoin session restoration.
 */

export interface AfkTeleportData {
	isAfkRejoin: boolean;
	lastPosition: [number, number, number, number, number, number]; // [x, y, z, lookX, lookY, lookZ]
	timestamp: number;
	placeId: number;
}
