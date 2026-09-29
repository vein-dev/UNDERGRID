import { CollectionService } from "@rbxts/services";
import { DRUM_SEAT_CONFIG, isDrumstickTool, isGuitarTool } from "shared/config";

export type PerformerRole = "guitarist" | "drummer" | "none";

export interface PlayerPerformerStatus {
	readonly role: PerformerRole;
	readonly isPerforming: boolean;
	readonly instrumentName: string;
	readonly iconName: string;
	readonly badgeColor: string;
	readonly strokeColor: string;
	readonly bgColor: string;
}

const DEFAULT_STATUS: PlayerPerformerStatus = {
	role: "none",
	isPerforming: false,
	instrumentName: "",
	iconName: "user",
	badgeColor: "#64748b",
	strokeColor: "#374151",
	bgColor: "#1f2937",
};

/**
 * Mendeteksi apakah seorang player sedang memainkan instrumen musik di atas panggung:
 * 1. Gitar: Memegang tool Gitar ("Strato", "Gibson", "Bass").
 * 2. Drum: Memegang tool "Drumstick" atau sedang menduduki kursi drum throne ("drum_seat").
 */
export function getPlayerPerformerStatus(player: Player): PlayerPerformerStatus {
	const character = player.Character;
	if (!character) return DEFAULT_STATUS;

	// 1. Periksa Tool di tangan karakter
	for (const child of character.GetChildren()) {
		if (child.IsA("Tool")) {
			if (isGuitarTool(child.Name)) {
				return {
					role: "guitarist",
					isPerforming: true,
					instrumentName: child.Name,
					iconName: "guitar",
					badgeColor: "#f59e0b", // Amber Gold
					strokeColor: "#f59e0b",
					bgColor: "#291d09",
				};
			}
			if (isDrumstickTool(child.Name)) {
				return {
					role: "drummer",
					isPerforming: true,
					instrumentName: "Drum",
					iconName: "drumstick",
					badgeColor: "#ec4899", // Neon Pink
					strokeColor: "#ec4899",
					bgColor: "#2d1020",
				};
			}
		}
	}

	// 2. Periksa apakah karakter sedang duduk di drum throne
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	const seatPart = humanoid?.SeatPart;
	if (seatPart) {
		const isDrumSeat =
			CollectionService.HasTag(seatPart, DRUM_SEAT_CONFIG.TAG) ||
			seatPart.FindFirstAncestor("Drum") !== undefined ||
			seatPart.Name.lower().find("drum")[0] !== undefined ||
			seatPart.Parent?.Name.lower().find("drum")[0] !== undefined;

		if (isDrumSeat) {
			return {
				role: "drummer",
				isPerforming: true,
				instrumentName: "Drum",
				iconName: "drumstick",
				badgeColor: "#ec4899",
				strokeColor: "#ec4899",
				bgColor: "#2d1020",
			};
		}
	}

	return DEFAULT_STATUS;
}
