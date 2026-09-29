/**
 * RollupDoorTypes - Shared types and contracts for the Rollup Door system.
 */

export type RollupDoorState = "Closed" | "Opening" | "Open" | "Closing";

export interface RollupDoorSyncData {
	isOpen: boolean;
	state: RollupDoorState;
	timestamp: number;
}
