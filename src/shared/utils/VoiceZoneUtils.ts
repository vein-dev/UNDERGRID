import { Workspace } from "@rbxts/services";

let cachedRooftopZone: BasePart | undefined;
let cachedGarageZone: BasePart | undefined;

/**
 * Mengambil referensi part RooftopVoiceZone
 */
export function getRooftopVoiceZonePart(): BasePart | undefined {
	if (cachedRooftopZone && cachedRooftopZone.IsDescendantOf(Workspace)) {
		return cachedRooftopZone;
	}

	let part = Workspace.FindFirstChild("RooftopVoiceZone") as BasePart | undefined;
	if (!part || !part.IsA("BasePart")) {
		part = Workspace.FindFirstChild("RooftopVoiceZone", true) as BasePart | undefined;
	}

	if (part && part.IsA("BasePart")) {
		cachedRooftopZone = part;
		return part;
	}

	return undefined;
}

/**
 * Mengambil referensi part GarageVoiceZone
 */
export function getGarageVoiceZonePart(): BasePart | undefined {
	if (cachedGarageZone && cachedGarageZone.IsDescendantOf(Workspace)) {
		return cachedGarageZone;
	}

	const model3d = Workspace.FindFirstChild("3dModel");
	let part = model3d?.FindFirstChild("GarageVoiceZone", true) as BasePart | undefined;
	if (!part || !part.IsA("BasePart")) {
		part = Workspace.FindFirstChild("GarageVoiceZone", true) as BasePart | undefined;
	}

	if (part && part.IsA("BasePart")) {
		cachedGarageZone = part;
		return part;
	}

	return undefined;
}

/**
 * Mengecek apakah suatu koordinat Vector3 berada di dalam volume BasePart tertentu.
 * Mendukung toleransi vertikal agar karakter yang melompat atau berdiri di atas permukaan tetap terdeteksi.
 */
export function isPositionInPart(pos: Vector3, part: BasePart, verticalTolerance = 30): boolean {
	const localPos = part.CFrame.PointToObjectSpace(pos);
	const halfSize = part.Size.mul(0.5);

	const withinX = math.abs(localPos.X) <= halfSize.X + 2.0;
	const withinZ = math.abs(localPos.Z) <= halfSize.Z + 2.0;
	// Posisi Y dari batas bawah lantai hingga ketinggian verticalTolerance studs di atas lantai
	const withinY = localPos.Y >= -halfSize.Y - 2.0 && localPos.Y <= halfSize.Y + verticalTolerance;

	return withinX && withinZ && withinY;
}

export interface VoiceZoneCheckResult {
	inZone: boolean;
	zoneName?: "Rooftop" | "Garage";
	zonePart?: BasePart;
}

/**
 * Mengecek apakah koordinat Vector3 berada di salah satu Voice Zone (Rooftop / Garage).
 */
export function checkPositionVoiceZone(pos: Vector3): VoiceZoneCheckResult {
	const rooftop = getRooftopVoiceZonePart();
	if (rooftop && isPositionInPart(pos, rooftop)) {
		return { inZone: true, zoneName: "Rooftop", zonePart: rooftop };
	}

	const garage = getGarageVoiceZonePart();
	if (garage && isPositionInPart(pos, garage)) {
		return { inZone: true, zoneName: "Garage", zonePart: garage };
	}

	return { inZone: false };
}

/**
 * Mengecek apakah karakter Player saat ini berada di salah satu Voice Zone.
 */
export function checkPlayerVoiceZone(player: Player): VoiceZoneCheckResult {
	const char = player.Character;
	if (!char) return { inZone: false };

	const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	if (hrp) {
		return checkPositionVoiceZone(hrp.Position);
	}

	const pivot = char.GetPivot();
	return checkPositionVoiceZone(pivot.Position);
}
