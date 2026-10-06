/**
 * NpcConfig.ts
 * Konfigurasi percakapan dan parameter interaksi NPC Undergrid.
 */

import { NpcDialogueTree } from "shared/types/NpcDialogueTypes";

export const NPC_CONFIG = {
	PROMPT_MAX_INTERACTION_DISTANCE: 16,

	HEAD_TRACKING: {
		ENABLED: true,
		MAX_DISTANCE: 25,
		MAX_YAW_DEG: 70,
		MAX_PITCH_DEG: 35,
		LERP_SPEED: 8,
	},

	TWINS: {
		NPC_NAME: "Twins",
		NPC_PATH: ["NPC", "Twins"],
		TOOL_NAME: "Skateboard",
		PROMPT: {
			NAME: "TwinsDialoguePrompt",
			ACTION_TEXT: "Bicara",
			OBJECT_TEXT: "Twins",
			HOLD_DURATION: 0.2,
			MAX_ACTIVATION_DISTANCE: 10,
			KEY_CODE: Enum.KeyCode.E,
			REQUIRES_LINE_OF_SIGHT: false,
		},
		DIALOGUE_TREE: {
			npcId: "Twins",
			speakerName: "Twins",
			defaultNodeId: "greeting",
			alreadyHasItemNodeId: "already_has_board",
			nodes: {
				greeting: {
					id: "greeting",
					speakerName: "Twins",
					message: "Yo! Butuh papan buat keliling atau main trik di Undergrid?",
					options: [
						{
							id: "opt_want_board",
							label: "Boleh, pinjam skateboard dong!",
							nextNodeId: "grant_board",
						},
						{
							id: "opt_just_looking",
							label: "Nggak, cuma lagi lihat-lihat.",
							nextNodeId: "goodbye",
						},
					],
				},
				grant_board: {
					id: "grant_board",
					speakerName: "Twins",
					message: "Nih, bawa satu! Jangan sampai rusak ya. Nikmati jalanan Undergrid!",
					options: [
						{
							id: "opt_claim",
							label: "Makasih banyak, Twins!",
							action: "claim_skateboard",
						},
					],
				},
				already_has_board: {
					id: "already_has_board",
					speakerName: "Twins",
					message: "Loh, kan kamu sudah bawa skateboard di tasmu! Pakai yang itu dulu ya.",
					options: [
						{
							id: "opt_got_it",
							label: "Oh iya, siap!",
							action: "close",
						},
					],
				},
				goodbye: {
					id: "goodbye",
					speakerName: "Twins",
					message: "Santai. Kalo butuh papan sewaktu-waktu, balik lagi aja ke sini.",
					options: [
						{
							id: "opt_bye",
							label: "Oke, sampai nanti!",
							action: "close",
						},
					],
				},
			},
		} as NpcDialogueTree,
	},
};
