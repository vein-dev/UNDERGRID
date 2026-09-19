import { CollectionService, Workspace } from "@rbxts/services";
import { GeneratorModuleDefinition, ShrubsAttributes } from "shared/types/ProceduralTypes";
import { resolveSource } from "shared/procedural/ProceduralUtils";

const defaultAttributes: ShrubsAttributes = {
	Source: "Mall.Shrubs",
	Seed: 1,
	Density: 0.7,
	MinSpacing: 6,
	GridStep: 4,
	WallSearchDistance: 6,
	MinWalls: 1,
	GroundPatchSize: 2,
	GroundFlatness: 0.5,
};

function rummageSelf(guid: string): ProceduralModel | undefined {
	for (const inst of CollectionService.GetTagged("HAS_GUID")) {
		if (inst.IsA("ProceduralModel") && inst.GetAttribute("Guid") === guid) {
			return inst;
		}
	}
	return undefined;
}

function emitModel(model: Instance, localCF: CFrame, target: Instance): void {
	const modelPivot = (model as Model).GetPivot();
	for (const src of model.GetDescendants()) {
		if (!src.IsA("BasePart")) {
			continue;
		}
		const relCF = modelPivot.ToObjectSpace(src.CFrame);
		const part = src.Clone();
		part.CFrame = localCF.mul(relCF);
		part.Anchored = true;
		part.Parent = target;
	}
}

const Generator: GeneratorModuleDefinition<ShrubsAttributes> = {
	Attributes: defaultAttributes,

	OnGenerate: (parameters, targetContainer) => {
		const source = resolveSource(parameters.Attributes.Source);
		if (!source) {
			warn(`[Shrubs] could not resolve Source: ${parameters.Attributes.Source}`);
		}

		const models = source ? source.GetChildren() : [];
		if (source && models.size() === 0) {
			warn(`[Shrubs] Source folder is empty`);
		}

		const guidMap = parameters.Attributes as unknown as Record<string, unknown>;
		const guidStr = typeIs(guidMap, "table") ? (guidMap["Guid"] as string | undefined) : undefined;
		const selfPM = (guidStr ? rummageSelf(guidStr) : undefined) ?? targetContainer.FindFirstAncestorWhichIsA("ProceduralModel");
		if (!selfPM) {
			warn(`[Shrubs] tag the PM with HAS_GUID — raycasts need the PM's world transform`);
		}

		if (source && models.size() > 0 && selfPM) {

		const size = parameters.Size;
		const halfX = size.X / 2;
		const halfY = size.Y / 2;
		const halfZ = size.Z / 2;
		const pivot = selfPM.GetPivot();

		const rng = new Random(parameters.Attributes.Seed);

		const rayParams = new RaycastParams();
		rayParams.FilterDescendantsInstances = [selfPM];
		rayParams.FilterType = Enum.RaycastFilterType.Exclude;
		rayParams.RespectCanCollide = true;

		const rayLength = size.Y * 2;
		const placed: Vector3[] = [];

		const gridStep = parameters.Attributes.GridStep;
		const minSpacing = parameters.Attributes.MinSpacing;
		const density = parameters.Attributes.Density;
		const minSpacingSq = minSpacing * minSpacing;
		const wallSearch = parameters.Attributes.WallSearchDistance;
		const minWalls = parameters.Attributes.MinWalls;
		const patchHalf = parameters.Attributes.GroundPatchSize / 2;
		const groundFlatness = parameters.Attributes.GroundFlatness;

		const localCardinals = [
			new Vector3(1, 0, 0),
			new Vector3(-1, 0, 0),
			new Vector3(0, 0, 1),
			new Vector3(0, 0, -1),
		];

		const patchCorners = [
			new Vector3(-patchHalf, 0, -patchHalf),
			new Vector3(patchHalf, 0, -patchHalf),
			new Vector3(-patchHalf, 0, patchHalf),
			new Vector3(patchHalf, 0, patchHalf),
		];

		let x = -halfX + gridStep / 2;
		while (x < halfX) {
			let z = -halfZ + gridStep / 2;
			while (z < halfZ) {
				if (rng.NextNumber() < density) {
					const jx = x + rng.NextNumber(-gridStep / 2, gridStep / 2);
					const jz = z + rng.NextNumber(-gridStep / 2, gridStep / 2);
					const worldOrigin = pivot.mul(new Vector3(jx, halfY, jz));
					const worldDir = pivot.VectorToWorldSpace(new Vector3(0, -rayLength, 0));
					const hit = Workspace.Raycast(worldOrigin, worldDir, rayParams);
					if (hit) {
						let minY = hit.Position.Y;
						let maxY = hit.Position.Y;
						let patchOk = true;

						for (const off of patchCorners) {
							const cornerOrigin = worldOrigin.add(pivot.VectorToWorldSpace(off));
							const cornerHit = Workspace.Raycast(cornerOrigin, worldDir, rayParams);
							if (!cornerHit) {
								patchOk = false;
								break;
							}
							if (cornerHit.Position.Y > maxY) {
								maxY = cornerHit.Position.Y;
							}
							if (cornerHit.Position.Y < minY) {
								minY = cornerHit.Position.Y;
							}
						}

						if (patchOk && maxY - minY <= groundFlatness) {
							const localHit = pivot.PointToObjectSpace(hit.Position);
							let clear = true;

							for (const p of placed) {
								const d = p.sub(localHit);
								if (d.X * d.X + d.Y * d.Y + d.Z * d.Z < minSpacingSq) {
									clear = false;
									break;
								}
							}

							if (clear) {
								const wallOrigin = hit.Position.add(new Vector3(0, 1, 0));
								let wallHits = 0;
								for (const localDir of localCardinals) {
									const wallDir = pivot.VectorToWorldSpace(localDir.mul(wallSearch));
									if (Workspace.Raycast(wallOrigin, wallDir, rayParams)) {
										wallHits++;
									}
								}

								if (wallHits >= minWalls) {
									const model = models[rng.NextInteger(1, models.size()) - 1];
									const yRot = CFrame.fromEulerAngles(
										0,
										rng.NextNumber() * math.pi * 2,
										0,
									);
									emitModel(
										model,
										new CFrame(localHit).mul(yRot),
										targetContainer,
									);
									placed.push(localHit);
								}
								parameters.Pause();
							}
						}
					}
				}
				z += gridStep;
			}
			x += gridStep;
		}
		}
	},
};

export = Generator;
