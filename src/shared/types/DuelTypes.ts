/**
 * DuelTypes - Type definitions for 1v1 PvP Duel System.
 */

export type DuelState = "Idle" | "Pending" | "Countdown" | "Active" | "Ended";

export interface DuelInviteData {
	challengerUserId: number;
	challengerName: string;
	challengerDisplayName: string;
	durationSeconds: number;
}

export interface DuelActiveData {
	opponentUserId: number;
	opponentName: string;
	opponentDisplayName: string;
	startTime: number;
}

export interface DuelEndData {
	winnerUserId: number;
	winnerName: string;
	loserUserId: number;
	loserName: string;
	reason: "Knockout" | "Forfeit" | "Timeout";
}

export interface DuelConfig {
	InviteTimeoutSeconds: number;
	CountdownSeconds: number;
	MaxDuelDurationSeconds: number;
	MaxChallengeDistance: number;
	ForfeitDistance: number;
}

export const DUEL_CONFIG: DuelConfig = {
	InviteTimeoutSeconds: 15,
	CountdownSeconds: 3,
	MaxDuelDurationSeconds: 180,
	MaxChallengeDistance: 50,
	ForfeitDistance: 120,
};
