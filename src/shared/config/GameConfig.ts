import { MovementConfig } from "./MovementConfig";

/**
 * Global game constants and configuration parameters.
 */
export const GameConfig = {
	GAME_NAME: "Roblox Game System",
	VERSION: "1.0.0",

	PLAYER: {
		DEFAULT_WALKSPEED: 16,
		DEFAULT_JUMPPOWER: MovementConfig.JUMP.jumpPower,
		MAX_HEALTH: 100,
	},

	INVENTORY: {
		MAX_HOTBAR_SLOTS: 9,
		MAX_BAG_SLOTS: 30,
	},

	CAMERA: {
		MIN_ZOOM_DISTANCE: 0.5,
		MAX_ZOOM_DISTANCE: 32,
	},

	LOADING_SCREEN: {
		/** Roblox Asset ID gambar background loading screen (contoh: "rbxassetid://1234567890" atau "" jika tidak ada) */
		BACKGROUND_IMAGE: "rbxassetid://131049045044389",
		/** Tingkat transparansi overlay gelap di atas gambar (0 = hitam pekat, 1 = transparan penuh) */
		OVERLAY_TRANSPARENCY: 1,
	},
} as const;
