import { RunService } from "@rbxts/services";

/**
 * Admin Configuration and validation utilities.
 */

export const AdminConfig = {
	/**
	 * Explicit Game Owner User ID.
	 */
	OWNER_USER_ID: 8895971048, // Fleurizze (Game Owner)

	/**
	 * Explicit list of User IDs with Admin privileges.
	 * Add User IDs here to grant music & system control.
	 */
	ADMIN_USER_IDS: [
		8895971048, // Fleurizze (Game Owner)
		8922570594, // Lowlow
		5777565121, // ohmyrayy0
	] as number[],

	/** Minimum rank required if game is owned by a Group */
	MIN_GROUP_RANK_FOR_ADMIN: 254,

	/** Maximum songs a single regular player can have in the queue at one time */
	MAX_QUEUE_PER_PLAYER: 3,

	/** Cooldown in seconds between queuing songs */
	QUEUE_COOLDOWN_SECONDS: 10,
};

/**
 * Checks whether a given player is the Game Owner.
 * Critical operations (like Server Restart / Reboot) are strictly restricted to the Game Owner.
 */
export function isPlayerOwner(player: Player): boolean {
	// 0. Studio Developer Testing
	if (RunService.IsStudio() && (player.UserId === game.CreatorId || player.UserId <= 0 || player.UserId === AdminConfig.OWNER_USER_ID)) {
		return true;
	}

	// 1. Explicit Game Owner User ID
	if (player.UserId === AdminConfig.OWNER_USER_ID) {
		return true;
	}

	// 2. Game Creator (User)
	if (game.CreatorType === Enum.CreatorType.User && player.UserId === game.CreatorId) {
		return true;
	}

	// 3. Group Owner (Rank 255)
	if (game.CreatorType === Enum.CreatorType.Group) {
		const rank = player.GetRankInGroup(game.CreatorId);
		if (rank === 255) {
			return true;
		}
	}

	return false;
}

/**
 * Checks whether a given player has Admin privileges in the current game.
 * Admins include:
 * 1. Place / Universe Owner
 * 2. Members of ADMIN_USER_IDS
 * 3. Group Owners / High Ranks if Group-owned
 */
export function isPlayerAdmin(player: Player): boolean {
	// 0. Studio Developer Testing
	if (RunService.IsStudio() && (player.UserId === game.CreatorId || player.UserId <= 0)) {
		return true;
	}

	// 1. Explicit Admin User ID list
	if (AdminConfig.ADMIN_USER_IDS.includes(player.UserId)) {
		return true;
	}

	// 2. Game Owner (User)
	if (game.CreatorType === Enum.CreatorType.User) {
		if (player.UserId === game.CreatorId) {
			return true;
		}
	} else if (game.CreatorType === Enum.CreatorType.Group) {
		// 3. Group Owner / High Rank
		const rank = player.GetRankInGroup(game.CreatorId);
		if (rank >= AdminConfig.MIN_GROUP_RANK_FOR_ADMIN) {
			return true;
		}
	}

	return false;
}
