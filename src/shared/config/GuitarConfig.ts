/**
 * GuitarConfig.ts
 * Konfigurasi posisi dan offset visual instrumen gitar & bass (Strato, Gibson, Bass) pada dada avatar pemain.
 */

export interface GuitarModelConfig {
	readonly toolName: string;
	readonly chestOffset: CFrame;
}

// 1. Orientasi Strato di dada avatar:
const stratoNeckDir = new Vector3(0.7, -0.55, 0.1).Unit;
const stratoNormal = new Vector3(0, 0.15, -0.98).Unit;
const stratoWidth = stratoNeckDir.Cross(stratoNormal).Unit;
const stratoOrtho = stratoWidth.Cross(stratoNeckDir).Unit;
const stratoRotCF = CFrame.fromMatrix(Vector3.zero, stratoNeckDir, stratoOrtho, stratoWidth);
const STRATO_CHEST_OFFSET = new CFrame(-0.1, -0.15, -0.83).mul(stratoRotCF);

// 2. Orientasi Gibson di dada avatar:
const gibsonNeckDir = new Vector3(-0.7, 0.55, -0.1).Unit;
const gibsonFaceOut = new Vector3(0, 0.15, -0.98).Unit;
const gibsonHandleZ = gibsonFaceOut.mul(-1);
const gibsonHandleX = gibsonNeckDir.Cross(gibsonHandleZ).Unit;
const gibsonHandleZOrtho = gibsonHandleX.Cross(gibsonNeckDir).Unit;
const gibsonRotCF = CFrame.fromMatrix(Vector3.zero, gibsonHandleX, gibsonNeckDir, gibsonHandleZOrtho);
const GIBSON_CHEST_OFFSET = new CFrame(-0.45, 0.35, -0.83).mul(gibsonRotCF);

// 3. Orientasi Bass di dada avatar:
const BASS_CHEST_OFFSET = new CFrame(-0.1, -0.15, -0.83).mul(stratoRotCF);

export const GUITAR_CONFIGS: ReadonlyMap<string, GuitarModelConfig> = new Map([
	["Strato", { toolName: "Strato", chestOffset: STRATO_CHEST_OFFSET }],
	["Gibson", { toolName: "Gibson", chestOffset: GIBSON_CHEST_OFFSET }],
	["Bass", { toolName: "Bass", chestOffset: BASS_CHEST_OFFSET }],
]);

export function isGuitarTool(toolName: string): boolean {
	return GUITAR_CONFIGS.has(toolName);
}

export function getGuitarChestOffset(toolName: string): CFrame | undefined {
	return GUITAR_CONFIGS.get(toolName)?.chestOffset;
}

export const GuitarConfig = {
	TOOL_NAME: "Strato",
	CHEST_OFFSET: STRATO_CHEST_OFFSET,
	GUITARS: GUITAR_CONFIGS,
};

export interface GuitarAnimationItem {
	readonly id: string;
	readonly name: string;
	readonly animationId: string;
}

export const GUITAR_ANIMATION_CONFIG = {
	DEFAULT_ANIMATION_ID: "guitar_1",
	ANIMATIONS: [
		{
			id: "guitar_1",
			name: "Guitar 1",
			animationId: "rbxassetid://86231853800188",
		},
		{
			id: "guitar_2",
			name: "Guitar 2",
			animationId: "rbxassetid://87611876270730",
		},
		{
			id: "guitar_3",
			name: "Guitar 3",
			animationId: "rbxassetid://85764998378014",
		},
	] as readonly GuitarAnimationItem[],
	ANIMATION_PRIORITY: Enum.AnimationPriority.Action4,
	FADE_TIME: 0.25,
} as const;

