/**
 * DuelTypes - Type definitions for 1v1 PvP Duel System.
 */

export type DuelState = "Idle" | "Pending" | "Intro" | "Countdown" | "Active" | "Ended";

export interface DuelInviteData {
	challengerUserId: number;
	challengerName: string;
	challengerDisplayName: string;
	durationSeconds: number;
}

export interface DuelIntroData {
	opponentUserId: number;
	opponentName: string;
	opponentDisplayName: string;
	player1UserId: number;
	player2UserId: number;
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
	IntroSeconds: number;
	CountdownSeconds: number;
	MaxDuelDurationSeconds: number;
	MaxChallengeDistance: number;
	ForfeitDistance: number;
}

export const DUEL_CONFIG: DuelConfig = {
	InviteTimeoutSeconds: 15,
	IntroSeconds: 8.0,
	CountdownSeconds: 3,
	MaxDuelDurationSeconds: 180,
	MaxChallengeDistance: 50,
	ForfeitDistance: 120,
};
