import { ModularVariant, Palette, Skin } from "shared/types/ProceduralTypes";
import { Workspace, ReplicatedFirst, ReplicatedStorage } from "@rbxts/services";

/**
 * Resolves a dot-separated source path within standard service roots.
 * Example: "Mall.BuildingA" looks inside Workspace, ReplicatedFirst, ReplicatedStorage.
 */
export function resolveSource(path: string): Instance | undefined {
	const segments = path.split(".");
	if (segments.size() === 0) {
		return undefined;
	}

	const roots: Instance[] = [Workspace, ReplicatedFirst, ReplicatedStorage];

	for (const root of roots) {
		let current: Instance | undefined = root;
		for (const segment of segments) {
			if (!current) {
				break;
			}
			current = current.FindFirstChild(segment);
		}
		if (current) {
			return current;
		}
	}
	return undefined;
}

/**
 * Resolves Material enum item from string name.
 */
export function resolveMaterial(name: string): Enum.Material {
	for (const item of Enum.Material.GetEnumItems()) {
		if (item.Name === name) {
			return item;
		}
	}
	return Enum.Material.SmoothPlastic;
}

/**
 * Derives a brick and awning palette from a Random generator seed.
 */
export function generatePalette(rng: Random): Palette {
	if (rng.NextNumber() > 0.5) {
		return {
			brick: new Color3(0.654902, 0.360784, 0.105882).Lerp(
				new Color3(0.776471, 0.568627, 0.470588),
				rng.NextNumber(),
			),
			awning: Color3.fromHSV(rng.NextNumber(), 0.3, 1),
		};
	}
	return {
		brick: new Color3(0.486275, 0.360784, 0.27451).Lerp(
			new Color3(0.419608, 0.176471, 0.0627451),
			rng.NextNumber(),
		),
		awning: Color3.fromHSV(rng.NextNumber(), 0.3, 1),
	};
}

/**
 * Finds all child models inside folder matching a type tag attribute.
 */
export function getVariants(folder: Instance | undefined, tag: string): ModularVariant[] {
	const out: ModularVariant[] = [];
	if (!folder) {
		return out;
	}
	for (const child of folder.GetChildren()) {
		if (child.GetAttribute("type") === tag) {
			out.push({
				model: child,
				tiles: (child.GetAttribute("tiles") as number | undefined) ?? 1,
			});
		}
	}
	return out;
}

/**
 * Chooses a random variant that fits within available tiles budget.
 */
export function chooseVariant(
	variants: ModularVariant[],
	tilesAvailable: number,
	rng: Random,
): [Instance | undefined, number] {
	if (variants.size() === 0) {
		return [undefined, 1];
	}
	let budget = tilesAvailable;
	if (budget < 1) {
		budget = 1;
	}
	const candidates: ModularVariant[] = [];
	for (const v of variants) {
		if (v.tiles <= budget) {
			candidates.push(v);
		}
	}
	if (candidates.size() === 0) {
		return [undefined, 1];
	}
	const pick = candidates[rng.NextInteger(1, candidates.size()) - 1];
	return [pick.model, pick.tiles];
}

/**
 * Emits descendant BaseParts flat into target at the given pivot-local CFrame.
 * Applies palette recoloring to descendants with a palette attribute.
 */
export function emitModel(
	modelTemplate: Instance | undefined,
	placementCF: CFrame,
	skin: Skin,
	target: Instance,
): void {
	if (!modelTemplate) {
		return;
	}
	const modelPivot = (modelTemplate as Model).GetPivot();
	for (const src of modelTemplate.GetDescendants()) {
		if (!src.IsA("BasePart")) {
			continue;
		}
		const relCF = modelPivot.ToObjectSpace(src.CFrame);
		const part = src.Clone();
		part.CFrame = placementCF.mul(relCF);
		part.Anchored = true;
		if (skin.recolor) {
			const paletteKey = src.GetAttribute("palette");
			if (typeIs(paletteKey, "string")) {
				const color = skin.palette[paletteKey];
				if (color) {
					part.Color = color;
				}
			}
		}
		part.Parent = target;
	}
}
