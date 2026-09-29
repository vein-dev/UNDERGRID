/**
 * DrumstickConfig.ts
 * Konfigurasi posisi dan offset visual instrumen drumstick pada kedua tangan avatar pemain (R6 / R15).
 */

// 1. Grip Stick Kanan (Right Arm / RightHand):
// Stick memanjang pada sumbu X. Pentol/tip berada pada -X, gagang pada +X.
// Tip mengarah ke depan, sedikit ke dalam dan sedikit ke bawah.
const rightTipDir = new Vector3(-0.2, -0.4, -0.9).Unit;
const rightStickX = rightTipDir.mul(-1);
const rightUp = new Vector3(0, 1, 0);
const rightZ = rightStickX.Cross(rightUp).Unit;
const rightY = rightZ.Cross(rightStickX).Unit;
const rightRot = CFrame.fromMatrix(Vector3.zero, rightStickX, rightY, rightZ);
// Geser ke ujung bawah lengan/telapak tangan (-0.95 di Y) dan geser titik pegangan stick (-0.55 di X agar menjulur ke depan)
const RIGHT_GRIP_OFFSET = new CFrame(0, -0.95, -0.1).mul(rightRot).mul(new CFrame(-0.55, 0, 0));

// 2. Grip Stick Kiri (Left Arm / LeftHand):
const leftTipDir = new Vector3(0.2, -0.4, -0.9).Unit;
const leftStickX = leftTipDir.mul(-1);
const leftUp = new Vector3(0, 1, 0);
const leftZ = leftStickX.Cross(leftUp).Unit;
const leftY = leftZ.Cross(leftStickX).Unit;
const leftRot = CFrame.fromMatrix(Vector3.zero, leftStickX, leftY, leftZ);
const LEFT_GRIP_OFFSET = new CFrame(0, -0.95, -0.1).mul(leftRot).mul(new CFrame(-0.55, 0, 0));

export const DrumstickConfig = {
	TOOL_NAME: "Drumstick",
	RIGHT_STICK_NAME: "RightStick",
	LEFT_STICK_NAME: "LeftStick",
	RIGHT_GRIP_OFFSET,
	LEFT_GRIP_OFFSET,
};

export function isDrumstickTool(toolName: string): boolean {
	return toolName === DrumstickConfig.TOOL_NAME;
}
