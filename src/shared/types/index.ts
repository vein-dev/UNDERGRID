/**
 * Common types, interfaces, and enums shared across client and server.
 */

export enum PlayerRole {
	Guest = "Guest",
	Player = "Player",
	Moderator = "Moderator",
	Developer = "Developer",
}

export interface PlayerData {
	userId: number;
	role: PlayerRole;
	level: number;
	coins: number;
}

export interface ItemData {
	id: string;
	name: string;
	description?: string;
	amount: number;
}

export * from "./WeaponTypes";
export * from "./SmartphoneTypes";
export * from "./AdminTypes";
export * from "./NotificationTypes";
export * from "./FightTypes";
export * from "./EmoteTypes";
export * from "./ProceduralTypes";
export * from "./MovementTypes";
export * from "./SkateboardTypes";
export * from "./TimeTypes";
