/**
 * AvatarContextMenuTypes - Defines interfaces for Custom Avatar Context Menu.
 */

export interface AvatarTargetPlayer {
	player: Player;
	userId: number;
	displayName: string;
	username: string;
	isFriend: boolean;
	isSyncing: boolean;
	distance?: number;
}

export type AvatarContextMenuAction = "sync" | "friend" | "inspect";
