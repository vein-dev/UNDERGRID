import { GeneratorModuleDefinition, NineSliceAttributes } from "shared/types/ProceduralTypes";
import { resolveMaterial, resolveSource } from "shared/procedural/ProceduralUtils";

const defaultAttributes: NineSliceAttributes = {
	Source: "Mall.Concrete",
	Tint: true,
	Color: Color3.fromRGB(220, 220, 220),
	Material: "SmoothPlastic",
	MaterialVariant: "",
};

const SOURCE_FIX: Record<string, CFrame> = {
	Corner: new CFrame(),
	VerticalEdge: new CFrame(),
	TopEdgeAlongX: CFrame.fromEulerAngles(0, math.rad(90), 0),
	TopEdgeAlongZ: CFrame.fromEulerAngles(0, -math.rad(90), 0),
	WallFaceZ: CFrame.fromEulerAngles(0, math.pi / 2, 0),
	WallFaceX: CFrame.fromEulerAngles(0, math.pi / 2, 0),
	TopFace: new CFrame(),
};

interface NineSliceSkin {
	tint: boolean;
	color: Color3;
	material: Enum.Material;
	materialVariant: string;
}

interface Placement {
	name: string;
	fixKey: string;
	cf: CFrame;
}

function emitPiece(
	sourcePiece: Instance,
	placementCF: CFrame,
	fix: CFrame,
	skin: NineSliceSkin,
	target: Instance,
): void {
	const sourceRef = (sourcePiece as Model).GetPivot();

	for (const src of sourcePiece.GetDescendants()) {
		if (!src.IsA("BasePart")) {
			continue;
		}

		const relCF = sourceRef.ToObjectSpace(src.CFrame);
		const partInPlacement = fix.mul(relCF);

		const part = src.Clone();
		part.CFrame = placementCF.mul(partInPlacement);
		part.Anchored = true;
		if (skin.tint) {
			part.Color = skin.color;
			part.Material = skin.material;
			if (skin.materialVariant !== "") {
				part.MaterialVariant = skin.materialVariant;
			}
		}
		part.Parent = target;
	}
}

function flipBottom(horizontalOutward: Vector3): CFrame {
	if (horizontalOutward.Magnitude < 0.001) {
		return CFrame.Angles(math.pi, 0, 0);
	}
	return CFrame.fromAxisAngle(horizontalOutward.Unit, math.pi);
}

function snapDim(value: number, cu: number): number {
	return math.max(2 * cu, math.floor(value / cu + 0.5) * cu);
}

function tileCenter(half: number, cuAxis: number, i: number): number {
	return -half + cuAxis + (i + 0.5) * cuAxis;
}

function buildPlacements(size: Vector3, cu: Vector3): Placement[] {
	const snappedSize = new Vector3(
		snapDim(size.X, cu.X),
		snapDim(size.Y, cu.Y),
		snapDim(size.Z, cu.Z),
	);

	const hW = snappedSize.X / 2;
	const hH = snappedSize.Y / 2;
	const hD = snappedSize.Z / 2;
	const cuX2 = cu.X / 2;
	const cuY2 = cu.Y / 2;
	const cuZ2 = cu.Z / 2;

	const nX = math.floor((snappedSize.X - 2 * cu.X) / cu.X + 0.5);
	const nY = math.floor((snappedSize.Y - 2 * cu.Y) / cu.Y + 0.5);
	const nZ = math.floor((snappedSize.Z - 2 * cu.Z) / cu.Z + 0.5);

	const columns = [
		{ sx: 1, sz: 1, yRot: math.pi / 2 },
		{ sx: -1, sz: 1, yRot: 0 },
		{ sx: -1, sz: -1, yRot: -math.pi / 2 },
		{ sx: 1, sz: -1, yRot: math.pi },
	];

	const p: Placement[] = [];

	// 8 Corners
	for (const col of columns) {
		for (const sy of [-1, 1]) {
			const pos = new Vector3(col.sx * (hW - cuX2), sy * (hH - cuY2), col.sz * (hD - cuZ2));
			let rot = CFrame.Angles(0, col.yRot, 0);
			if (sy === -1) {
				rot = flipBottom(new Vector3(col.sx, 0, col.sz)).mul(rot);
			}
			p.push({ name: "Corner", fixKey: "Corner", cf: new CFrame(pos).mul(rot) });
		}
	}

	// VerticalEdges
	for (const col of columns) {
		for (let iY = 0; iY < nY; iY++) {
			const y = tileCenter(hH, cu.Y, iY);
			const pos = new Vector3(col.sx * (hW - cuX2), y, col.sz * (hD - cuZ2));
			const cf = new CFrame(pos).mul(CFrame.Angles(0, col.yRot, 0));
			p.push({ name: "VerticalEdge", fixKey: "VerticalEdge", cf });
		}
	}

	// TopEdges along X
	for (const sy of [-1, 1]) {
		for (const sz of [-1, 1]) {
			for (let iX = 0; iX < nX; iX++) {
				const x = tileCenter(hW, cu.X, iX);
				const pos = new Vector3(x, sy * (hH - cuY2), sz * (hD - cuZ2));
				let rot = new CFrame();
				if (sz === -1) {
					rot = CFrame.Angles(0, math.pi, 0);
				}
				if (sy === -1) {
					rot = flipBottom(new Vector3(0, 0, sz)).mul(rot);
				}
				p.push({ name: "TopEdge", fixKey: "TopEdgeAlongX", cf: new CFrame(pos).mul(rot) });
			}
		}
		// TopEdges along Z
		for (const sx of [-1, 1]) {
			for (let iZ = 0; iZ < nZ; iZ++) {
				const z = tileCenter(hD, cu.Z, iZ);
				const pos = new Vector3(sx * (hW - cuX2), sy * (hH - cuY2), z);
				let rot = CFrame.Angles(0, math.pi / 2, 0);
				if (sx === 1) {
					rot = rot.mul(CFrame.Angles(0, math.pi, 0));
				}
				if (sy === -1) {
					rot = flipBottom(new Vector3(sx, 0, 0)).mul(rot);
				}
				p.push({ name: "TopEdge", fixKey: "TopEdgeAlongZ", cf: new CFrame(pos).mul(rot) });
			}
		}
	}

	// VerticalFaces facing ±Z
	for (const sz of [-1, 1]) {
		for (let iX = 0; iX < nX; iX++) {
			for (let iY = 0; iY < nY; iY++) {
				const pos = new Vector3(
					tileCenter(hW, cu.X, iX),
					tileCenter(hH, cu.Y, iY),
					sz * (hD - cuZ2),
				);
				let cf = new CFrame(pos);
				if (sz === -1) {
					cf = cf.mul(CFrame.Angles(0, math.pi, 0));
				}
				p.push({ name: "VerticalFace", fixKey: "WallFaceZ", cf });
			}
		}
	}

	// VerticalFaces facing ±X
	for (const sx of [-1, 1]) {
		for (let iZ = 0; iZ < nZ; iZ++) {
			for (let iY = 0; iY < nY; iY++) {
				const pos = new Vector3(
					sx * (hW - cuX2),
					tileCenter(hH, cu.Y, iY),
					tileCenter(hD, cu.Z, iZ),
				);
				let cf = new CFrame(pos).mul(CFrame.Angles(0, math.pi / 2, 0));
				if (sx === -1) {
					cf = cf.mul(CFrame.Angles(0, math.pi, 0));
				}
				p.push({ name: "VerticalFace", fixKey: "WallFaceX", cf });
			}
		}
	}

	// TopFace + BottomFace
	for (const sy of [-1, 1]) {
		for (let iX = 0; iX < nX; iX++) {
			for (let iZ = 0; iZ < nZ; iZ++) {
				const pos = new Vector3(
					tileCenter(hW, cu.X, iX),
					sy * (hH - cuY2),
					tileCenter(hD, cu.Z, iZ),
				);
				let rot = new CFrame();
				if (sy === -1) {
					rot = flipBottom(Vector3.zero).mul(rot);
				}
				p.push({ name: "TopFace", fixKey: "TopFace", cf: new CFrame(pos).mul(rot) });
			}
		}
	}

	return p;
}

const Generator: GeneratorModuleDefinition<NineSliceAttributes> = {
	Attributes: defaultAttributes,

	OnGenerate: (parameters, targetContainer) => {
		const source = resolveSource(parameters.Attributes.Source);
		if (!source) {
			warn(`[9SliceTiled] could not resolve Source: ${parameters.Attributes.Source}`);
		}

		if (source) {
			const sourceMap: Record<string, Instance> = {};
			let missing = false;
			for (const name of ["Corner", "VerticalEdge", "TopEdge", "VerticalFace", "TopFace"]) {
				const piece = source.FindFirstChild(name);
				if (!piece) {
					warn(`[9SliceTiled] missing source piece: ${name}`);
					missing = true;
					break;
				}
				sourceMap[name] = piece;
			}

			const cornerBoundsPart = sourceMap["Corner"]?.FindFirstChild("Bounds");
			if (!missing && cornerBoundsPart && cornerBoundsPart.IsA("BasePart")) {
				const cu = cornerBoundsPart.Size;

		const skin: NineSliceSkin = {
			tint: parameters.Attributes.Tint,
			color: parameters.Attributes.Color,
			material: resolveMaterial(parameters.Attributes.Material),
			materialVariant: parameters.Attributes.MaterialVariant,
		};

		for (const placement of buildPlacements(parameters.Size, cu)) {
			const fix = SOURCE_FIX[placement.fixKey] ?? new CFrame();
			emitPiece(sourceMap[placement.name], placement.cf, fix, skin, targetContainer);
				parameters.Pause();
			}
			}
		}
	},
};

export = Generator;
