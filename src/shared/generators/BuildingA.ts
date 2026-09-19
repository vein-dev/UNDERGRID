import {
	BuildingAAttributes,
	GeneratorModuleDefinition,
	ModularVariant,
	Skin,
} from "shared/types/ProceduralTypes";
import {
	chooseVariant,
	emitModel,
	generatePalette,
	getVariants,
	resolveSource,
} from "shared/procedural/ProceduralUtils";

const defaultAttributes: BuildingAAttributes = {
	Source: "Mall.BuildingA",
	Step: new Vector3(7.5, 15, 7.5),
	Seed: 1,
	Recolor: true,
	Foundation: true,
	FoundationHeight: 4,
	Roof: true,
	RoofHeight: 2,
	ConcreteColor: Color3.fromRGB(160, 160, 160),
};

// Fill a linear span of tiles between two corners by picking variants that fit.
function fillSpan(
	startPos: number,
	endPos: number,
	variants: ModularVariant[],
	angleDeg: number,
	origin: Vector3,
	stepper: Vector3,
	rng: Random,
	skin: Skin,
	target: Instance,
): void {
	let tilesRemaining = endPos - startPos + 1;
	let position = startPos;
	while (tilesRemaining > 0) {
		const [model, numTiles] = chooseVariant(variants, tilesRemaining, rng);
		if (!model) {
			return;
		}
		let offset = 0;
		if (numTiles > 1) {
			offset = numTiles / 2 - 0.5;
		}
		const cf = new CFrame(origin.add(stepper.mul(position + offset))).mul(
			CFrame.fromEulerAngles(0, math.rad(angleDeg), 0),
		);
		emitModel(model, cf, skin, target);
		tilesRemaining -= numTiles;
		position += numTiles;
	}
}

// Place 4 corners + 4 wall spans for a single floor at the given vertical step index.
function fillRow(
	size: Vector3,
	step: Vector3,
	height: number,
	yOffset: number,
	corners: ModularVariant[],
	walls: ModularVariant[],
	rng: Random,
	skin: Skin,
	target: Instance,
): void {
	const halfSize = size.div(2);
	const origin = new Vector3(-halfSize.X, -halfSize.Y, -halfSize.Z)
		.add(new Vector3(step.X * 0.5, 0, step.Z * 0.5))
		.add(new Vector3(0, step.Y * height + yOffset, 0));

	const sx = math.floor(size.X / step.X) - 1;
	const sz = math.floor(size.Z / step.Z) - 1;

	// 4 corners
	const placements = [
		{ pos: new Vector3(sx, 0, 0).mul(step), angle: 0 },
		{ pos: new Vector3(0, 0, 0).mul(step), angle: 90 },
		{ pos: new Vector3(0, 0, sz).mul(step), angle: 180 },
		{ pos: new Vector3(sx, 0, sz).mul(step), angle: 270 },
	];
	for (const place of placements) {
		const [model] = chooseVariant(corners, 1, rng);
		const cf = new CFrame(origin.add(place.pos)).mul(
			CFrame.fromEulerAngles(0, math.rad(place.angle), 0),
		);
		emitModel(model, cf, skin, target);
	}

	// 4 wall spans
	fillSpan(1, sx - 1, walls, 90, origin, new Vector3(step.X, 0, 0), rng, skin, target);
	fillSpan(
		1,
		sx - 1,
		walls,
		270,
		origin.add(new Vector3(0, 0, sz * step.Z)),
		new Vector3(step.X, 0, 0),
		rng,
		skin,
		target,
	);
	fillSpan(
		1,
		sz - 1,
		walls,
		0,
		origin.add(new Vector3(sx * step.X, 0, 0)),
		new Vector3(0, 0, step.Z),
		rng,
		skin,
		target,
	);
	fillSpan(1, sz - 1, walls, 180, origin, new Vector3(0, 0, step.Z), rng, skin, target);
}

// Emit a single concrete slab at the given Y center spanning the building footprint.
function emitSlab(
	name: string,
	centerY: number,
	size: Vector3,
	step: Vector3,
	height: number,
	inset: number,
	color: Color3,
	target: Instance,
): void {
	const sx = math.floor(size.X / step.X);
	const sz = math.floor(size.Z / step.Z);
	const part = new Instance("Part");
	part.Name = name;
	part.Size = new Vector3(sx * step.X - 2 * inset, height, sz * step.Z - 2 * inset);
	part.CFrame = new CFrame(0, centerY, 0);
	part.Anchored = true;
	part.CanCollide = true;
	part.Color = color;
	part.Material = Enum.Material.Concrete;
	part.Parent = target;
}

// Tile a horizontal grid (e.g., roof) at the given vertical step index.
function fillFloor(
	size: Vector3,
	step: Vector3,
	height: number,
	yOffset: number,
	tiles: ModularVariant[],
	rng: Random,
	skin: Skin,
	target: Instance,
): void {
	const halfSize = size.div(2);
	const origin = new Vector3(-halfSize.X, -halfSize.Y, -halfSize.Z)
		.add(new Vector3(step.X * 0.5, 0, step.Z * 0.5))
		.add(new Vector3(0, step.Y * height + yOffset, 0));

	const sx = math.floor(size.X / step.X) - 1;
	const sz = math.floor(size.Z / step.Z) - 1;

	for (let x = 0; x <= sx; x++) {
		for (let z = 0; z <= sz; z++) {
			const [model] = chooseVariant(tiles, 1, rng);
			const cf = new CFrame(origin.add(new Vector3(x, 0, z).mul(step)));
			emitModel(model, cf, skin, target);
		}
	}
}

const Generator: GeneratorModuleDefinition<BuildingAAttributes> = {
	Attributes: defaultAttributes,

	OnGenerate: (parameters, targetContainer) => {
		const source = resolveSource(parameters.Attributes.Source);
		if (!source) {
			warn(`[BuildingA] could not resolve Source: ${parameters.Attributes.Source}`);
		}

		const botFolder = source ? source.FindFirstChild("bot") : undefined;
		const topFolder = source ? source.FindFirstChild("top") : undefined;
		const capFolder = source ? source.FindFirstChild("cap") : undefined;
		const roofFolder = source ? source.FindFirstChild("roof") : undefined;

		if (source && botFolder && topFolder && capFolder && roofFolder) {

		const rng = new Random(parameters.Attributes.Seed);
		const skin: Skin = {
			recolor: parameters.Attributes.Recolor,
			palette: generatePalette(rng),
		};

		const step = parameters.Attributes.Step;
		const size = parameters.Size;
		const halfSize = size.div(2);

		const foundationDepth = parameters.Attributes.Foundation
			? parameters.Attributes.FoundationHeight
			: 0;
		const rowYOffset = foundationDepth;
		const maxHeight = math.max(0, math.floor((size.Y - foundationDepth) / step.Y) - 1);

		// Bottom floor
		const botCorner = getVariants(botFolder, "corner");
		const botWall = getVariants(botFolder, "wall");
		fillRow(size, step, 0, rowYOffset, botCorner, botWall, rng, skin, targetContainer);
		parameters.Pause();

		// Middle floors
		const topCorner = getVariants(topFolder, "corner");
		const topWall = getVariants(topFolder, "wall");
		for (let height = 1; height <= maxHeight; height++) {
			fillRow(size, step, height, rowYOffset, topCorner, topWall, rng, skin, targetContainer);
			parameters.Pause();
		}

		// Cap floor
		const capCorner = getVariants(capFolder, "corner");
		const capWall = getVariants(capFolder, "wall");
		fillRow(size, step, maxHeight + 1, rowYOffset, capCorner, capWall, rng, skin, targetContainer);
		parameters.Pause();

		// Roof tiles
		fillFloor(
			size,
			step,
			maxHeight + 1,
			rowYOffset,
			getVariants(roofFolder, "roof"),
			rng,
			skin,
			targetContainer,
		);

		// Foundation
		if (parameters.Attributes.Foundation) {
			const fy = parameters.Attributes.FoundationHeight;
			emitSlab(
				"Foundation",
				-halfSize.Y + fy / 2,
				size,
				step,
				fy,
				0,
				parameters.Attributes.ConcreteColor,
				targetContainer,
			);
		}

		// Roof
		if (parameters.Attributes.Roof) {
			const capTopY = -halfSize.Y + foundationDepth + step.Y * (maxHeight + 2);
			const ry = parameters.Attributes.RoofHeight;
			emitSlab(
				"Roof",
				capTopY + ry / 2 - 13,
				size,
				step,
				ry,
				3,
				parameters.Attributes.ConcreteColor,
				targetContainer,
			);
		}
		}
	},
};

export = Generator;
