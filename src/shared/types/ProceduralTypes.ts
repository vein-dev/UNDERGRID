/**
 * Type definitions for Roblox Procedural Model system and generators.
 */

export interface GenerationFunctionParams<T = Record<string, unknown>> {
	Attributes: T;
	Size: Vector3;
	Pause: (this: GenerationFunctionParams<T>) => void;
}

export interface GeneratorModuleDefinition<T = Record<string, unknown>> {
	Attributes: T;
	OnGenerate: (this: void, parameters: GenerationFunctionParams<T>, targetContainer: Instance) => void;
}

export interface BuildingAAttributes {
	Source: string;
	Step: Vector3;
	Seed: number;
	Recolor: boolean;
	Foundation: boolean;
	FoundationHeight: number;
	Roof: boolean;
	RoofHeight: number;
	ConcreteColor: Color3;
}

export interface BronxBuildingAttributes {
	GroundHeight: number;
	FloorHeight: number;
	BrickColor: Color3;
	TrimColor: Color3;
	NeonColor: Color3;
	HasWaterTower: boolean;
	HasRooftopHVAC: boolean;
	HasSkylight: boolean;
	HasWindowAC: boolean;
	HasStripedAwning: boolean;
	HasProduceCrates: boolean;
	HasMailbox: boolean;
	HasCornerEntrance: boolean;
}

export interface BrutalistSupermarketAttributes {
	GroundHeight: number;
	UpperFloorHeight: number;
	ConcretePrimaryColor: Color3;
	ConcreteAccentColor: Color3;
	GlassColor: Color3;
	FrameColor: Color3;
	SignAccentColor: Color3;
	HasRooftopHVAC: boolean;
	HasCartCorral: boolean;
}

export interface NineSliceAttributes {
	Source: string;
	Tint: boolean;
	Color: Color3;
	Material: string;
	MaterialVariant: string;
}

export interface VoxelizerAttributes {
	Source: string;
	VoxelSize: number;
	Priority: number;
	Version: number;
}

export interface ShrubsAttributes {
	Source: string;
	Seed: number;
	Density: number;
	MinSpacing: number;
	GridStep: number;
	WallSearchDistance: number;
	MinWalls: number;
	GroundPatchSize: number;
	GroundFlatness: number;
}

export type Palette = { [key: string]: Color3 };

export interface Skin {
	recolor: boolean;
	palette: Palette;
}

export interface ModularVariant {
	model: Instance;
	tiles: number;
}
