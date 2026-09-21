import { Players, UserInputService } from "@rbxts/services";
import { IToolComponent } from "./IToolComponent";
import { LightingRemoteView } from "client/ui/views/LightingRemoteView";

/**
 * Client OOP Component bound to the "LightingRemote" Tool for LocalPlayer.
 *
 * - Equip Tool   → Otomatis memunculkan Floating Immersive HUD.
 * - Unequip Tool → Menyembunyikan Floating HUD secara mulus.
 * - Klik Layar   → Toggle antara Full HUD dan Minimized Status Pill.
 */
export class LightingRemoteClientComponent implements IToolComponent {
	private connections: RBXScriptConnection[] = [];
	private remoteView: LightingRemoteView;

	constructor(public readonly tool: Tool) {
		this.tool.ManualActivationOnly = false;
		this.remoteView = LightingRemoteView.getInstance();

		this.init();
	}

	private init(): void {
		this.connections.push(
			this.tool.Equipped.Connect(() => {
				this.remoteView.show();
			}),
			this.tool.Unequipped.Connect(() => {
				this.remoteView.hide();
			}),
			this.tool.Activated.Connect(() => {
				this.remoteView.toggle();
			}),
			UserInputService.InputBegan.Connect((input, gameProcessed) => {
				if (gameProcessed) return;
				if (
					input.UserInputType === Enum.UserInputType.MouseButton1 ||
					input.UserInputType === Enum.UserInputType.Touch
				) {
					const character = Players.LocalPlayer.Character;
					if (character && this.tool.Parent === character) {
						// Jika tool sedang dipegang di tangan dan klik di luar UI
						if (!this.remoteView.getVisible()) {
							this.remoteView.show();
						}
					}
				}
			}),
		);

		// Jika tool sudah di-equip saat komponen diinstansiasi
		if (this.tool.Parent === Players.LocalPlayer.Character) {
			this.remoteView.show();
		}

		print(`[LightingRemoteClientComponent] Initialized for tool: ${this.tool.Name}`);
	}

	public destroy(): void {
		for (const conn of this.connections) {
			conn.Disconnect();
		}
		this.connections.clear();
		this.remoteView.hide();
		print(`[LightingRemoteClientComponent] Destroyed for tool: ${this.tool.Name}`);
	}
}
