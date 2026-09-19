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
	WallFaceZ: CFrame.fromEulerAngles(0, math.pi, 0),
	WallFaceX: CFrame.fromEulerAngles(0, math.pi, 0),
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
	stretch: Vector3;
}

function stretchedSizeFor(
	originalSize: Vector3,
	partRotInPlacement: CFrame,
	placementStretch: Vector3,
): Vector3 {
	let newX = originalSize.X;
	let newY = originalSize.Y;
	let newZ = originalSize.Z;

	const applyAxis = (placementAxis: Vector3, factor: number) => {
		const partLocalDir = partRotInPlacement.VectorToObjectSpace(placementAxis);
		const ax = math.abs(partLocalDir.X);
		const ay = math.abs(partLocalDir.Y);
		const az = math.abs(partLocalDir.Z);
		if (ax >= ay && ax >= az) {
			newX = newX * factor;
		} else if (ay >= az) {
			newY = newY * factor;
		} else {
			newZ = newZ * factor;
		}
	};

	applyAxis(Vector3.xAxis, placementStretch.X);
	applyAxis(Vector3.yAxis, placementStretch.Y);
	applyAxis(Vector3.zAxis, placementStretch.Z);

	return new Vector3(newX, newY, newZ);
}

function emitPiece(
	sourcePiece: Instance,
	placementCF: CFrame,
	fix: CFrame,
	stretch: Vector3,
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
		const placementPos = partInPlacement.Position;
		const placementRot = partInPlacement.sub(placementPos);

		const stretchedPos = new Vector3(
			placementPos.X * stretch.X,
			placementPos.Y * stretch.Y,
			placementPos.Z * stretch.Z,
		);
		const stretchedSize = stretchedSizeFor(src.Size, placementRot, stretch);
		const stretchedPartInPlacement = placementRot.add(stretchedPos);

		const part = src.Clone();
		part.CFrame = placementCF.mul(stretchedPartInPlacement);
		part.Size = stretchedSize;
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

function buildPlacements(size: Vector3, cu: Vector3): Placement[] {
	const clampedSize = new Vector3(
		math.max(size.X, 2 * cu.X),
		math.max(size.Y, 2 * cu.Y),
		math.max(size.Z, 2 * cu.Z),
	);

	const hW = clampedSize.X / 2;
	const hH = clampedSize.Y / 2;
	const hD = clampedSize.Z / 2;
	const cuX2 = cu.X / 2;
	const cuY2 = cu.Y / 2;
	const cuZ2 = cu.Z / 2;

	const sX = math.max(0.001, (clampedSize.X - 2 * cu.X) / cu.X);
	const sY = math.max(0.001, (clampedSize.Y - 2 * cu.Y) / cu.Y);
	const sZ = math.max(0.001, (clampedSize.Z - 2 * cu.Z) / cu.Z);

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
			p.push({
				name: "Corner",
				fixKey: "Corner",
				cf: new CFrame(pos).mul(rot),
				stretch: Vector3.one,
			});
		}
	}

	// 4 VerticalEdges
	for (const col of columns) {
		const pos = new Vector3(col.sx * (hW - cuX2), 0, col.sz * (hD - cuZ2));
		const cf = new CFrame(pos).mul(CFrame.Angles(0, col.yRot, 0));
		p.push({
			name: "VerticalEdge",
			fixKey: "VerticalEdge",
			cf,
			stretch: new Vector3(1, sY, 1),
		});
	}

	// 8 TopEdges
	for (const sy of [-1, 1]) {
		for (const sz of [-1, 1]) {
			const pos = new Vector3(0, sy * (hH - cuY2), sz * (hD - cuZ2));
			let rot = new CFrame();
			if (sz === -1) {
				rot = CFrame.Angles(0, math.pi, 0);
			}
			if (sy === -1) {
				rot = flipBottom(new Vector3(0, 0, sz)).mul(rot);
			}
			p.push({
				name: "TopEdge",
				fixKey: "TopEdgeAlongX",
				cf: new CFrame(pos).mul(rot),
				stretch: new Vector3(sX, 1, 1),
			});
		}
		for (const sx of [-1, 1]) {
			const pos = new Vector3(sx * (hW - cuX2), sy * (hH - cuY2), 0);
			let rot = CFrame.Angles(0, math.pi / 2, 0);
			if (sx === 1) {
				rot = rot.mul(CFrame.Angles(0, math.pi, 0));
			}
			if (sy === -1) {
				rot = flipBottom(new Vector3(sx, 0, 0)).mul(rot);
			}
			p.push({
				name: "TopEdge",
				fixKey: "TopEdgeAlongZ",
				cf: new CFrame(pos).mul(rot),
				stretch: new Vector3(sZ, 1, 1),
			});
		}
	}

	// 4 VerticalFaces
	for (const sz of [-1, 1]) {
		const pos = new Vector3(0, 0, sz * (hD - cuZ2));
		let cf = new CFrame(pos);
		if (sz === -1) {
			cf = cf.mul(CFrame.Angles(0, math.pi, 0));
		}
		p.push({
			name: "VerticalFace",
			fixKey: "WallFaceZ",
			cf,
			stretch: new Vector3(sX, sY, 1),
		});
	}
	for (const sx of [-1, 1]) {
		const pos = new Vector3(sx * (hW - cuX2), 0, 0);
		let cf = new CFrame(pos).mul(CFrame.Angles(0, math.pi / 2, 0));
		if (sx === -1) {
			cf = cf.mul(CFrame.Angles(0, math.pi, 0));
		}
		p.push({
			name: "VerticalFace",
			fixKey: "WallFaceX",
			cf,
			stretch: new Vector3(sZ, sY, 1),
		});
	}

	// 2 TopFace / BottomFace
	for (const sy of [-1, 1]) {
		const pos = new Vector3(0, sy * (hH - cuY2), 0);
		let rot = new CFrame();
		if (sy === -1) {
			rot = flipBottom(Vector3.zero).mul(rot);
		}
		p.push({
			name: "TopFace",
			fixKey: "TopFace",
			cf: new CFrame(pos).mul(rot),
			stretch: new Vector3(sX, 1, sZ),
		});
	}

	return p;
}

const Generator: GeneratorModuleDefinition<NineSliceAttributes> = {
	Attributes: defaultAttributes,

	OnGenerate: (parameters, targetContainer) => {
		const source = resolveSource(parameters.Attributes.Source);
		if (!source) {
			warn(`[9Slice] could not resolve Source: ${parameters.Attributes.Source}`);
		}

		if (source) {
			const sourceMap: Record<string, Instance> = {};
			let missing = false;
			for (const name of ["Corner", "VerticalEdge", "TopEdge", "VerticalFace", "TopFace"]) {
				const piece = source.FindFirstChild(name);
				if (!piece) {
					warn(`[9Slice] missing source piece: ${name}`);
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
			emitPiece(
				sourceMap[placement.name],
				placement.cf,
				fix,
				placement.stretch,
				skin,
				targetContainer,
			);
				parameters.Pause();
			}
			}
		}
	},
};

export = Generator;
