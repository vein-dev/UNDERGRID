import { CollectionService, HttpService, ReplicatedStorage, Workspace } from "@rbxts/services";

/**
 * Visual Theme Configuration for Voxel Modular Kit
 */
export interface VoxelThemeConfig {
	setName: string;
	brickColor: Color3;
	trimColor: Color3;
	roofColor: Color3;
	wallMaterial: Enum.Material;
	trimMaterial: Enum.Material;
	roofMaterial: Enum.Material;
}

export const CLASSIC_BRICK_THEME: VoxelThemeConfig = {
	setName: "ClassicBrick",
	brickColor: Color3.fromRGB(150, 60, 44), // Bata Merah Klasik
	trimColor: Color3.fromRGB(245, 242, 235), // Lis Mahkota Putih Halus
	roofColor: Color3.fromRGB(55, 55, 60), // Beton Abu-Abu Gelap
	wallMaterial: Enum.Material.Brick,
	trimMaterial: Enum.Material.SmoothPlastic,
	roofMaterial: Enum.Material.Concrete,
};

/**
 * Creates a standard BasePart with common properties.
 */
function createVoxelPart(
	name: string,
	size: Vector3,
	cf: CFrame,
	color: Color3,
	material: Enum.Material,
	parent: Instance,
	transparency = 0,
): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Size = size;
	part.CFrame = cf;
	part.Color = color;
	part.Material = material;
	part.Transparency = transparency;
	part.Anchored = true;
	part.CanCollide = true;
	part.Parent = parent;
	return part;
}

/**
 * Builds the 7 complete modular models inside ReplicatedStorage.Mall.[setName]
 * with locked WorldPivot (0,0,0) and anti-hole 4x4 roof slabs.
 */
export function buildVoxelModularSet(theme: VoxelThemeConfig = CLASSIC_BRICK_THEME): Folder {
	let mallFolder = ReplicatedStorage.FindFirstChild("Mall") as Folder | undefined;
	if (!mallFolder) {
		mallFolder = new Instance("Folder");
		mallFolder.Name = "Mall";
		mallFolder.Parent = ReplicatedStorage;
	}

	let setFolder = mallFolder.FindFirstChild(theme.setName) as Folder | undefined;
	if (setFolder) {
		setFolder.Destroy();
	}
	setFolder = new Instance("Folder");
	setFolder.Name = theme.setName;
	setFolder.Parent = mallFolder;

	const T = 0.5; // Wall thickness in studs
	const originCF = new CFrame(0, 0, 0);

	// Helper to initialize a Model with locked WorldPivot (0,0,0)
	const createModel = (name: string): Model => {
		const m = new Instance("Model");
		m.Name = name;
		m.Parent = setFolder;
		// Critical: Lock WorldPivot to (0,0,0) so Roblox doesn't auto-center to bounding box
		m.WorldPivot = originCF;
		return m;
	};

	// ------------------------------------------------------------------
	// 1. VerticalFace (Dinding Lurus Tengah) - Natural outward is -X
	// ------------------------------------------------------------------
	const verticalFace = createModel("VerticalFace");
	createVoxelPart(
		"Wall",
		new Vector3(T, 4, 4),
		new CFrame(-2 + T / 2, 0, 0),
		theme.brickColor,
		theme.wallMaterial,
		verticalFace,
	);
	verticalFace.WorldPivot = originCF;

	// ------------------------------------------------------------------
	// 2. VerticalEdge (Sudut Luar Tengah) - Outward is (-X, +Z)
	// ------------------------------------------------------------------
	const verticalEdge = createModel("VerticalEdge");
	createVoxelPart(
		"WallX",
		new Vector3(T, 4, 4 - T),
		new CFrame(-2 + T / 2, 0, -T / 2),
		theme.brickColor,
		theme.wallMaterial,
		verticalEdge,
	);
	createVoxelPart(
		"WallZ",
		new Vector3(4, 4, T),
		new CFrame(0, 0, 2 - T / 2),
		theme.brickColor,
		theme.wallMaterial,
		verticalEdge,
	);
	verticalEdge.WorldPivot = originCF;

	// ------------------------------------------------------------------
	// 3. TopFace (Plat Atap Datar Penuh) - 4x4 studs
	// ------------------------------------------------------------------
	const topFace = createModel("TopFace");
	createVoxelPart(
		"RoofPlate",
		new Vector3(4, 0.6, 4),
		new CFrame(0, 2 - 0.3, 0),
		theme.roofColor,
		theme.roofMaterial,
		topFace,
	);
	topFace.WorldPivot = originCF;

	// ------------------------------------------------------------------
	// 4. TopEdge (Dinding Atas + Lis Cornice + Plat Atap 4x4 Anti-Bolong)
	// ------------------------------------------------------------------
	const topEdge = createModel("TopEdge");
	// Dinding utama
	createVoxelPart(
		"Wall",
		new Vector3(T, 4, 4),
		new CFrame(-2 + T / 2, 0, 0),
		theme.brickColor,
		theme.wallMaterial,
		topEdge,
	);
	// Plat atap penuh 4x4 (Anti-Bolong)
	createVoxelPart(
		"RoofPlate",
		new Vector3(4, 0.6, 4),
		new CFrame(0, 2 - 0.3, 0),
		theme.roofColor,
		theme.roofMaterial,
		topEdge,
	);
	// Lis mahkota cornice putih menonjol
	createVoxelPart(
		"CorniceTrim",
		new Vector3(0.5, 0.8, 4),
		new CFrame(-2 - 0.15, 2 - 0.4, 0),
		theme.trimColor,
		theme.trimMaterial,
		topEdge,
	);
	// Parapet dinding atas kecil (1 stud)
	createVoxelPart(
		"Parapet",
		new Vector3(T, 1.0, 4),
		new CFrame(-2 + T / 2, 2 + 0.5, 0),
		theme.brickColor,
		theme.wallMaterial,
		topEdge,
	);
	topEdge.WorldPivot = originCF;

	// ------------------------------------------------------------------
	// 5. Corner (Sudut Luar Atas + Cornice 2 Sisi + Plat Atap 4x4 Anti-Bolong)
	// ------------------------------------------------------------------
	const corner = createModel("Corner");
	// Bounds part (wajib untuk kalkulasi bounding box unit generator)
	const bounds = createVoxelPart(
		"Bounds",
		new Vector3(4, 4, 4),
		new CFrame(0, 0, 0),
		Color3.fromRGB(255, 255, 255),
		Enum.Material.SmoothPlastic,
		corner,
		1,
	);
	bounds.CanCollide = false;

	// Dinding 2 sisi
	createVoxelPart(
		"WallX",
		new Vector3(T, 4, 4 - T),
		new CFrame(-2 + T / 2, 0, -T / 2),
		theme.brickColor,
		theme.wallMaterial,
		corner,
	);
	createVoxelPart(
		"WallZ",
		new Vector3(4, 4, T),
		new CFrame(0, 0, 2 - T / 2),
		theme.brickColor,
		theme.wallMaterial,
		corner,
	);
	// Plat atap penuh 4x4 (Anti-Bolong)
	createVoxelPart(
		"RoofPlate",
		new Vector3(4, 0.6, 4),
		new CFrame(0, 2 - 0.3, 0),
		theme.roofColor,
		theme.roofMaterial,
		corner,
	);
	// Lis Cornice 2 arah
	createVoxelPart(
		"CorniceX",
		new Vector3(0.5, 0.8, 4),
		new CFrame(-2 - 0.15, 2 - 0.4, 0),
		theme.trimColor,
		theme.trimMaterial,
		corner,
	);
	createVoxelPart(
		"CorniceZ",
		new Vector3(4, 0.8, 0.5),
		new CFrame(0, 2 - 0.4, 2 + 0.15),
		theme.trimColor,
		theme.trimMaterial,
		corner,
	);
	corner.WorldPivot = originCF;

	// ------------------------------------------------------------------
	// 6. InteriorEdge (Sudut Dalam Tengah / L-Junction)
	// Cavity opens toward (-X, +Z)
	// ------------------------------------------------------------------
	const interiorEdge = createModel("InteriorEdge");
	createVoxelPart(
		"WallInZ",
		new Vector3(T, 4, 2),
		new CFrame(0, 0, 1),
		theme.brickColor,
		theme.wallMaterial,
		interiorEdge,
	);
	createVoxelPart(
		"WallInX",
		new Vector3(2, 4, T),
		new CFrame(-1, 0, 0),
		theme.brickColor,
		theme.wallMaterial,
		interiorEdge,
	);
	interiorEdge.WorldPivot = originCF;

	// ------------------------------------------------------------------
	// 7. InteriorCorner (Sudut Dalam Atas + Plat Atap 4x4 Anti-Bolong)
	// ------------------------------------------------------------------
	const interiorCorner = createModel("InteriorCorner");
	// Dinding sudut dalam
	createVoxelPart(
		"WallInZ",
		new Vector3(T, 4, 2),
		new CFrame(0, 0, 1),
		theme.brickColor,
		theme.wallMaterial,
		interiorCorner,
	);
	createVoxelPart(
		"WallInX",
		new Vector3(2, 4, T),
		new CFrame(-1, 0, 0),
		theme.brickColor,
		theme.wallMaterial,
		interiorCorner,
	);
	// Plat atap penuh 4x4 (Anti-Bolong di area sambungan L-junction!)
	createVoxelPart(
		"RoofPlate",
		new Vector3(4, 0.6, 4),
		new CFrame(0, 2 - 0.3, 0),
		theme.roofColor,
		theme.roofMaterial,
		interiorCorner,
	);
	// Lis mahkota sudut dalam
	createVoxelPart(
		"CorniceIn",
		new Vector3(2, 0.6, 0.4),
		new CFrame(-1, 2 - 0.3, 0.2),
		theme.trimColor,
		theme.trimMaterial,
		interiorCorner,
	);
	interiorCorner.WorldPivot = originCF;

	print(`[VoxelModuleBuilder] Successfully built 7 modular models in ReplicatedStorage.Mall.${theme.setName}`);
	return setFolder;
}

/**
 * Spawns a ProceduralModel configured for Voxel Auto-Merge.
 * Ensures 4-stud grid snapping and proper tagging.
 */
export function spawnVoxelBlock(
	snappedPosition: Vector3,
	snappedSize: Vector3,
	sourceSet = "Mall.ClassicBrick",
	priority = 0,
	isHole = false,
): ProceduralModel {
	// 4-Stud Grid Snapping (Ketentuan #4)
	const snap4 = (n: number) => math.floor(n / 4 + 0.5) * 4;
	const sizeX = math.max(4, snap4(snappedSize.X));
	const sizeY = math.max(4, snap4(snappedSize.Y));
	const sizeZ = math.max(4, snap4(snappedSize.Z));

	const posX = snap4(snappedPosition.X);
	const posY = snap4(snappedPosition.Y);
	const posZ = snap4(snappedPosition.Z);

	const pm = new Instance("ProceduralModel");
	pm.Name = isHole ? "VoxelHoleBlock" : "VoxelBuildingBlock";
	pm.Size = new Vector3(sizeX, sizeY, sizeZ);

	const generatorModule = ReplicatedStorage
		.WaitForChild("TS")
		.WaitForChild("generators")
		.WaitForChild("Voxelizer") as ModuleScript;

	pm.Generator = generatorModule;

	// Attributes
	const guid = HttpService.GenerateGUID(false);
	pm.SetAttribute("Source", sourceSet);
	pm.SetAttribute("VoxelSize", 4);
	pm.SetAttribute("Priority", priority);
	pm.SetAttribute("Version", 1);
	pm.SetAttribute("Guid", guid);
	if (isHole) {
		pm.SetAttribute("Hole", true);
	}

	// Tags (Ketentuan #5)
	CollectionService.AddTag(pm, "VOXEL_BOUNDS");
	CollectionService.AddTag(pm, "HAS_GUID");

	// Position in Workspace
	pm.PivotTo(new CFrame(posX, posY, posZ));
	pm.Parent = Workspace;

	pm.ForceGeneration();
	return pm;
}
