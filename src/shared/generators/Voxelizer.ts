import { CollectionService } from "@rbxts/services";
import { GeneratorModuleDefinition, VoxelizerAttributes } from "shared/types/ProceduralTypes";
import { resolveSource } from "shared/procedural/ProceduralUtils";

const BOUNDS_TAG = "VOXEL_BOUNDS";
const MAX_VOXELS = 50_000;

const defaultAttributes: VoxelizerAttributes = {
	Source: "Mall.Concrete",
	VoxelSize: 4,
	Priority: 0,
	Version: 1,
};

function rummageSelf(guid: string): ProceduralModel | undefined {
	for (const inst of CollectionService.GetTagged("HAS_GUID")) {
		if (inst.IsA("ProceduralModel") && inst.GetAttribute("Guid") === guid) {
			return inst;
		}
	}
	return undefined;
}

function priorityKey(pm: ProceduralModel): [number, string] {
	return [
		(pm.GetAttribute("Priority") as number | undefined) ?? 0,
		(pm.GetAttribute("Guid") as string | undefined) ?? "",
	];
}

function beats(aP: number, aG: string, bP: number, bG: string): boolean {
	if (aP !== bP) {
		return aP > bP;
	}
	return aG > bG;
}

function obbContains(worldP: Vector3, pm: ProceduralModel): boolean {
	const localP = pm.GetPivot().PointToObjectSpace(worldP);
	const half = pm.Size.mul(0.5);
	return (
		math.abs(localP.X) <= half.X &&
		math.abs(localP.Y) <= half.Y &&
		math.abs(localP.Z) <= half.Z
	);
}

function worldAABB(pm: ProceduralModel): [Vector3, Vector3] {
	const pivot = pm.GetPivot();
	const h = pm.Size.mul(0.5);
	let minP = new Vector3(math.huge, math.huge, math.huge);
	let maxP = minP.mul(-1);

	for (const sx of [-1, 1]) {
		for (const sy of [-1, 1]) {
			for (const sz of [-1, 1]) {
				const corner = pivot.mul(new Vector3(sx * h.X, sy * h.Y, sz * h.Z));
				minP = new Vector3(
					math.min(minP.X, corner.X),
					math.min(minP.Y, corner.Y),
					math.min(minP.Z, corner.Z),
				);
				maxP = new Vector3(
					math.max(maxP.X, corner.X),
					math.max(maxP.Y, corner.Y),
					math.max(maxP.Z, corner.Z),
				);
			}
		}
	}
	return [minP, maxP];
}

function aabbOverlap(aMin: Vector3, aMax: Vector3, bMin: Vector3, bMax: Vector3): boolean {
	return (
		aMax.X >= bMin.X &&
		aMin.X <= bMax.X &&
		aMax.Y >= bMin.Y &&
		aMin.Y <= bMax.Y &&
		aMax.Z >= bMin.Z &&
		aMin.Z <= bMax.Z
	);
}

function emitPieceInstance(
	sourcePiece: Instance,
	cellLocalCF: CFrame,
	target: Instance,
): void {
	const sourcePivot = (sourcePiece as Model).GetPivot();
	for (const src of sourcePiece.GetDescendants()) {
		if (!src.IsA("BasePart")) {
			continue;
		}
		const relCF = sourcePivot.ToObjectSpace(src.CFrame);
		const part = src.Clone();
		part.CFrame = cellLocalCF.mul(relCF);
		part.Anchored = true;
		part.Parent = target;
	}
}

function classify(
	Solid: (x: number, y: number, z: number) => boolean,
	Clear: (x: number, y: number, z: number) => boolean,
	x: number,
	y: number,
	z: number,
): [string | undefined, CFrame] {
	const topClear = Clear(x, y + 1, z);

	// Outer corners
	if (Clear(x + 1, y, z) && Solid(x - 1, y, z) && Solid(x, y, z + 1) && Clear(x, y, z - 1)) {
		return [topClear ? "Corner" : "VerticalEdge", CFrame.Angles(0, math.pi, 0)];
	}
	if (Solid(x + 1, y, z) && Clear(x - 1, y, z) && Solid(x, y, z + 1) && Clear(x, y, z - 1)) {
		return [topClear ? "Corner" : "VerticalEdge", CFrame.Angles(0, -math.pi / 2, 0)];
	}
	if (Clear(x + 1, y, z) && Solid(x - 1, y, z) && Clear(x, y, z + 1) && Solid(x, y, z - 1)) {
		return [topClear ? "Corner" : "VerticalEdge", CFrame.Angles(0, math.pi / 2, 0)];
	}
	if (Solid(x + 1, y, z) && Clear(x - 1, y, z) && Clear(x, y, z + 1) && Solid(x, y, z - 1)) {
		return [topClear ? "Corner" : "VerticalEdge", new CFrame()];
	}

	// Sides
	if (Solid(x + 1, y, z) && Clear(x - 1, y, z) && Solid(x, y, z + 1) && Solid(x, y, z - 1)) {
		return [topClear ? "TopEdge" : "VerticalFace", new CFrame()];
	}
	if (Clear(x + 1, y, z) && Solid(x - 1, y, z) && Solid(x, y, z + 1) && Solid(x, y, z - 1)) {
		return [topClear ? "TopEdge" : "VerticalFace", CFrame.Angles(0, math.pi, 0)];
	}
	if (Solid(x + 1, y, z) && Solid(x - 1, y, z) && Clear(x, y, z + 1) && Solid(x, y, z - 1)) {
		return [topClear ? "TopEdge" : "VerticalFace", CFrame.Angles(0, math.pi / 2, 0)];
	}
	if (Solid(x + 1, y, z) && Solid(x - 1, y, z) && Solid(x, y, z + 1) && Clear(x, y, z - 1)) {
		return [topClear ? "TopEdge" : "VerticalFace", CFrame.Angles(0, -math.pi / 2, 0)];
	}

	// Inner corners
	if (Solid(x + 1, y, z) && Clear(x + 1, y, z - 1) && Solid(x, y, z - 1)) {
		return [topClear ? "InteriorCorner" : "InteriorEdge", CFrame.Angles(0, math.pi, 0)];
	}
	if (Solid(x - 1, y, z) && Clear(x - 1, y, z - 1) && Solid(x, y, z - 1)) {
		return [topClear ? "InteriorCorner" : "InteriorEdge", CFrame.Angles(0, -math.pi / 2, 0)];
	}
	if (Solid(x + 1, y, z) && Clear(x + 1, y, z + 1) && Solid(x, y, z + 1)) {
		return [topClear ? "InteriorCorner" : "InteriorEdge", CFrame.Angles(0, math.pi / 2, 0)];
	}
	if (Solid(x - 1, y, z) && Clear(x - 1, y, z + 1) && Solid(x, y, z + 1)) {
		return [topClear ? "InteriorCorner" : "InteriorEdge", new CFrame()];
	}

	// Top surface
	if (
		Clear(x, y + 1, z) &&
		Solid(x + 1, y, z) &&
		Solid(x - 1, y, z) &&
		Solid(x, y, z + 1) &&
		Solid(x, y, z - 1)
	) {
		if (Clear(x + 1, y, z + 1)) {
			return ["InteriorCorner", CFrame.Angles(0, math.pi / 2, 0)];
		}
		if (Clear(x - 1, y, z + 1)) {
			return ["InteriorCorner", new CFrame()];
		}
		if (Clear(x + 1, y, z - 1)) {
			return ["InteriorCorner", CFrame.Angles(0, math.pi, 0)];
		}
		if (Clear(x - 1, y, z - 1)) {
			return ["InteriorCorner", CFrame.Angles(0, -math.pi / 2, 0)];
		}
		return ["TopFace", new CFrame()];
	}

	// Bottom surface
	if (
		Solid(x, y + 1, z) &&
		Clear(x, y - 1, z) &&
		Solid(x + 1, y, z) &&
		Solid(x - 1, y, z) &&
		Solid(x, y, z + 1) &&
		Solid(x, y, z - 1)
	) {
		return ["TopFace", CFrame.Angles(math.pi, 0, 0)];
	}

	return [undefined, new CFrame()];
}

const Generator: GeneratorModuleDefinition<VoxelizerAttributes> = {
	Attributes: defaultAttributes,

	OnGenerate: (parameters, targetContainer) => {
		const sourceName = parameters.Attributes.Source ?? "Mall.ClassicBrick";
		const source = resolveSource(sourceName) ?? resolveSource("Mall.ClassicBrick") ?? resolveSource("Mall.Concrete");
		if (!source) {
			warn(`[Voxelizer] could not resolve Source: ${sourceName}`);
		}

		const guidMap = parameters.Attributes as unknown as Record<string, unknown>;
		const guidStr = typeIs(guidMap, "table") ? (guidMap["Guid"] as string | undefined) : undefined;
		const selfPM = (guidStr ? rummageSelf(guidStr) : undefined) ?? targetContainer.FindFirstAncestorWhichIsA("ProceduralModel");

		if (source && selfPM) {

		const voxelSize = parameters.Attributes.VoxelSize;
		const [myPriority, myGuid] = priorityKey(selfPM);

		const [selfMin, selfMax] = worldAABB(selfPM);
		const solidNeighbors: ProceduralModel[] = [];
		const holeNeighbors: ProceduralModel[] = [];
		const outranking: ProceduralModel[] = [];

		for (const pm of CollectionService.GetTagged(BOUNDS_TAG)) {
			if (pm !== selfPM && pm.IsA("ProceduralModel")) {
				const [nMin, nMax] = worldAABB(pm);
				if (aabbOverlap(selfMin, selfMax, nMin, nMax)) {
					if (pm.GetAttribute("Hole")) {
						holeNeighbors.push(pm);
					} else {
						solidNeighbors.push(pm);
						const [nP, nG] = priorityKey(pm);
						if (beats(nP, nG, myPriority, myGuid)) {
							outranking.push(pm);
						}
					}
				}
			}
		}

		const size = parameters.Size;
		const half = size.mul(0.5);
		const pivot = selfPM.GetPivot();
		const pivotRotation = pivot.sub(pivot.Position);
		const gridCenter = pivotRotation.PointToObjectSpace(pivot.Position);

		const iMinX = math.floor((gridCenter.X - half.X) / voxelSize);
		const iMaxX = math.floor((gridCenter.X + half.X) / voxelSize);
		const iMinY = math.floor((gridCenter.Y - half.Y) / voxelSize);
		const iMaxY = math.floor((gridCenter.Y + half.Y) / voxelSize);
		const iMinZ = math.floor((gridCenter.Z - half.Z) / voxelSize);
		const iMaxZ = math.floor((gridCenter.Z + half.Z) / voxelSize);

		const voxels = new Map<string, boolean>();
		const toKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

		for (let ix = iMinX - 1; ix <= iMaxX + 1; ix++) {
			for (let iy = iMinY - 1; iy <= iMaxY + 1; iy++) {
				for (let iz = iMinZ - 1; iz <= iMaxZ + 1; iz++) {
					const cellCenter = new Vector3(
						(ix + 0.5) * voxelSize,
						(iy + 0.5) * voxelSize,
						(iz + 0.5) * voxelSize,
					);
					const cellWorld = pivotRotation.PointToWorldSpace(cellCenter);
					let inUnion = false;
					if (obbContains(cellWorld, selfPM)) {
						inUnion = true;
					} else {
						for (const other of solidNeighbors) {
							if (obbContains(cellWorld, other)) {
								inUnion = true;
								break;
							}
						}
					}
					if (inUnion) {
						for (const hole of holeNeighbors) {
							if (obbContains(cellWorld, hole)) {
								inUnion = false;
								break;
							}
						}
					}
					if (inUnion) {
						voxels.set(toKey(ix, iy, iz), true);
					}
				}
				parameters.Pause();
			}
		}

		const Solid = (x: number, y: number, z: number) => voxels.get(toKey(x, y, z)) === true;
		const Clear = (x: number, y: number, z: number) => voxels.get(toKey(x, y, z)) !== true;

		let emitted = 0;
		let truncated = false;

		for (let ix = iMinX; ix <= iMaxX; ix++) {
			for (let iy = iMinY; iy <= iMaxY; iy++) {
				for (let iz = iMinZ; iz <= iMaxZ; iz++) {
					parameters.Pause();
					if (emitted >= MAX_VOXELS) {
						truncated = true;
						break;
					}

					if (!Solid(ix, iy, iz)) {
						continue;
					}

					const cellCenter = new Vector3(
						(ix + 0.5) * voxelSize,
						(iy + 0.5) * voxelSize,
						(iz + 0.5) * voxelSize,
					);
					const offset = cellCenter.sub(gridCenter);
					if (
						math.abs(offset.X) > half.X ||
						math.abs(offset.Y) > half.Y ||
						math.abs(offset.Z) > half.Z
					) {
						continue;
					}

					if (outranking.size() > 0) {
						const cellWorld = pivotRotation.PointToWorldSpace(cellCenter);
						let stolen = false;
						for (const n of outranking) {
							if (obbContains(cellWorld, n)) {
								stolen = true;
								break;
							}
						}
						if (stolen) {
							continue;
						}
					}

					// Interior skip
					if (
						Solid(ix + 1, iy, iz) &&
						Solid(ix - 1, iy, iz) &&
						Solid(ix, iy + 1, iz) &&
						Solid(ix, iy - 1, iz) &&
						Solid(ix, iy, iz + 1) &&
						Solid(ix, iy, iz - 1)
					) {
						continue;
					}

					const [pieceName, rot] = classify(Solid, Clear, ix, iy, iz);
					if (pieceName) {
						const piece = source.FindFirstChild(pieceName);
						if (piece) {
							const cellLocalCF = new CFrame(offset).mul(rot);
							emitPieceInstance(piece, cellLocalCF, targetContainer);
							emitted++;
						}
					}
				}
				if (truncated) {
					break;
				}
			}
			if (truncated) {
				break;
			}
		}

		if (truncated) {
			warn(`[Voxelizer] ${selfPM.Name} truncated at ${MAX_VOXELS} pieces`);
		}

		const existingGenerated = selfPM.FindFirstChild("Generated");
		if (existingGenerated) {
			existingGenerated.ClearAllChildren();
		}
		}
	},
};

export = Generator;
