export interface WeaponConfig {
	name: string;
	damage: number;
	cooldown: number; // in seconds
	range: number; // in studs
	animationId?: string;
	swingSoundId?: string;
	hitSoundId?: string;
}

export const WOODEN_SWORD_CONFIG: WeaponConfig = {
	name: "Wooden Sword",
	damage: 25,
	cooldown: 0.6,
	range: 5,
	animationId: "rbxassetid://522635514", // Classic sword slash animation
	swingSoundId: "rbxassetid://12222216", // Sword slash audio
	hitSoundId: "rbxassetid://566593606", // Impact audio
};
