export interface AfkConfig {
	AnimationId: string;
	BillboardOffset: Vector3;
	MaxDistance: number;
	AutoRejoinTimeoutSeconds: number;
}

export const AFK_CONFIG: AfkConfig = {
	AnimationId: "rbxassetid://135277932223226",
	BillboardOffset: new Vector3(0, 2.6, 0),
	MaxDistance: 85,
	AutoRejoinTimeoutSeconds: 19 * 60, // 1.140 detik = 19 menit (sebelum kick 20 menit Roblox)
};
