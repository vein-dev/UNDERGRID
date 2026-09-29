/**
 * DrumstickClientComponent.ts
 * OOP Client Component bound to the "Drumstick" Tool for LocalPlayer.
 *
 * - Meredam animasi kaku default Roblox (toolnone / slash) saat drumstick di-equip.
 * - Memastikan kedua lengan avatar bergerak alami saat berjalan, lari, atau diam
 *   sembari kedua drumstick terpasang di masing-masing tangan.
 */

import { Players } from "@rbxts/services";
import { IToolComponent } from "./IToolComponent";

export class DrumstickClientComponent implements IToolComponent {
	private connections: RBXScriptConnection[] = [];
	private equippedConnections: RBXScriptConnection[] = [];

	constructor(public readonly tool: Tool) {
		this.init();
	}

	private init(): void {
		this.connections.push(
			this.tool.Equipped.Connect(() => this.onEquipped()),
			this.tool.Unequipped.Connect(() => this.onUnequipped()),
		);

		if (this.tool.Parent === Players.LocalPlayer.Character) {
			this.onEquipped();
		}

		print("[DrumstickClientComponent] Initialized for Tool:", this.tool.Name);
	}

	private onEquipped(): void {
		this.cleanupEquippedConnections();

		const character = (this.tool.Parent as Model | undefined) ?? Players.LocalPlayer.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");

		if (humanoid) {
			// Hentikan animasi default tool Roblox (toolnone & slash) agar lengan tidak kaku mengacung
			for (const track of humanoid.GetPlayingAnimationTracks()) {
				const name = track.Name.lower();
				const animName = track.Animation?.Name.lower() ?? "";
				if (
					name.find("toolnone")[0] !== undefined ||
					animName.find("toolnone")[0] !== undefined ||
					name.find("slash")[0] !== undefined ||
					animName.find("slash")[0] !== undefined
				) {
					track.Stop(0);
				}
			}

			this.equippedConnections.push(
				humanoid.AnimationPlayed.Connect((track) => {
					const name = track.Name.lower();
					const animName = track.Animation?.Name.lower() ?? "";
					if (
						name.find("toolnone")[0] !== undefined ||
						animName.find("toolnone")[0] !== undefined ||
						name.find("slash")[0] !== undefined ||
						animName.find("slash")[0] !== undefined
					) {
						track.Stop(0);
					}
				}),
			);
		}

		// Bersihkan RightGrip bawaan jika sempat dibuat oleh client
		const rightArm = (character?.FindFirstChild("Right Arm") ?? character?.FindFirstChild("RightHand")) as
			| BasePart
			| undefined;
		if (rightArm) {
			for (const child of rightArm.GetChildren()) {
				if (child.IsA("Weld") && (child.Name === "RightGrip" || child.Name === "Grip")) {
					child.Destroy();
				}
			}
		}

		print("[DrumstickClientComponent] Drumsticks equipped cleanly on both hands.");
	}

	private onUnequipped(): void {
		this.cleanupEquippedConnections();
		print("[DrumstickClientComponent] Drumstick unequipped.");
	}

	private cleanupEquippedConnections(): void {
		for (const conn of this.equippedConnections) {
			conn.Disconnect();
		}
		this.equippedConnections = [];
	}

	public destroy(): void {
		for (const conn of this.connections) {
			conn.Disconnect();
		}
		this.connections = [];
		this.cleanupEquippedConnections();
		print("[DrumstickClientComponent] Destroyed.");
	}
}
