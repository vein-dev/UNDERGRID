import { Workspace } from "@rbxts/services";

let cachedDjAreaPart: BasePart | undefined;

/**
 * Mengambil referensi BasePart DJArea dari Workspace["3dModel"].SkyCrapper.Model.Model.DJArea
 * Menggunakan pencarian rekursif terarah untuk menghindari bug duplikasi nama model "Model"
 */
export function getDjAreaPart(): BasePart | undefined {
	if (cachedDjAreaPart && cachedDjAreaPart.IsDescendantOf(Workspace)) {
		return cachedDjAreaPart;
	}

	const model3d = Workspace.FindFirstChild("3dModel");
	let djArea = model3d?.FindFirstChild("DJArea", true) as BasePart | undefined;
	if (!djArea || !djArea.IsA("BasePart")) {
		djArea = Workspace.FindFirstChild("DJArea", true) as BasePart | undefined;
	}

	if (djArea && djArea.IsA("BasePart")) {
		cachedDjAreaPart = djArea;
		return djArea;
	}

	return undefined;
}

/**
 * Mengecek apakah posisi Vector3 tertentu berada di dalam volume area DJ
 * Mendukung toleransi vertikal untuk pemain yang berdiri atau melompat di atas lantai panggung DJArea
 */
export function isPositionInDjArea(pos: Vector3, verticalTolerance = 40): boolean {
	const part = getDjAreaPart();
	if (!part) return false;

	const localPos = part.CFrame.PointToObjectSpace(pos);
	const halfSize = part.Size.mul(0.5);

	const withinX = math.abs(localPos.X) <= halfSize.X + 3.0;
	const withinZ = math.abs(localPos.Z) <= halfSize.Z + 3.0;
	// Karakter berdiri di atas lantai panggung DJArea (permukaan Y ke atas hingga verticalTolerance studs)
	const withinY = localPos.Y >= -halfSize.Y - 5.0 && localPos.Y <= halfSize.Y + verticalTolerance;

	return withinX && withinZ && withinY;
}

/**
 * Mengecek apakah karakter seorang Player saat ini sedang berada di dalam batas area DJ
 */
export function isPlayerInDjArea(player: Player): boolean {
	const char = player.Character;
	if (!char) return false;

	const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	if (hrp) {
		return isPositionInDjArea(hrp.Position);
	}

	const pivot = char.GetPivot();
	return isPositionInDjArea(pivot.Position);
}
