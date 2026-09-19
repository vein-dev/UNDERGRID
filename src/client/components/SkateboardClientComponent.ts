import { Players, UserInputService } from "@rbxts/services";
import { IToolComponent } from "./IToolComponent";
import { SkateboardController } from "../controllers/SkateboardController";

/**
 * OOP Client Component bound to the "Skateboard" Tool for LocalPlayer.
 *
 * - Equip Tool   → Pegang papan skateboard di tangan kanan secara vertikal, karakter bebas berjalan/lari/lompat.
 * - Klik 1       → Naiki papan (Mount), sembunyikan papan di tangan, aktifkan kontrol skateboard.
 * - Klik 2       → Turun dari papan (Dismount), papan kembali dipegang di tangan.
 * - Unequipped   → Jika sedang menaiki papan, otomatis turun dan papan disimpan kembali ke tas/hotbar.
 */
export class SkateboardClientComponent implements IToolComponent {
	private connections: RBXScriptConnection[] = [];
	private equippedConnections: RBXScriptConnection[] = [];
	private originalTransparencies = new Map<BasePart, number>();
	private unsubscribeMountListener?: () => void;
	private lastActivateTime = 0;

	constructor(public readonly tool: Tool) {
		this.tool.ManualActivationOnly = false;
		this.tool.RequiresHandle = false;
		this.recordOriginalTransparencies();
		this.init();
	}

	private recordOriginalTransparencies(): void {
		for (const desc of this.tool.GetDescendants()) {
			if (desc.IsA("BasePart")) {
				this.originalTransparencies.set(desc, desc.Transparency);
			}
		}

		// Bila ada part baru yang ditambahkan di runtime
		this.connections.push(
			this.tool.DescendantAdded.Connect((desc) => {
				if (desc.IsA("BasePart") && !this.originalTransparencies.has(desc)) {
					this.originalTransparencies.set(desc, desc.Transparency);
					if (SkateboardController.getInstance().isPlayerMounted()) {
						desc.Transparency = 1;
					}
				}
			}),
		);
	}

	private init(): void {
		this.connections.push(
			this.tool.Equipped.Connect(() => this.onEquipped()),
			this.tool.Unequipped.Connect(() => this.onUnequipped()),
			this.tool.Activated.Connect(() => this.onActivated()),
			UserInputService.InputBegan.Connect((input, gameProcessed) => {
				if (gameProcessed) return;
				if (
					input.UserInputType === Enum.UserInputType.MouseButton1 ||
					input.UserInputType === Enum.UserInputType.Touch
				) {
					const character = Players.LocalPlayer.Character;
					if (character && this.tool.Parent === character) {
						this.onActivated();
					}
				}
			}),
		);

		// Dengarkan event sinkronisasi mount dari SkateboardController
		this.unsubscribeMountListener = SkateboardController.getInstance().onMountStateChanged((mounted) => {
			if (this.tool.Parent === Players.LocalPlayer.Character) {
				this.setBoardVisible(!mounted);
				this.setToolGripActive(!mounted);
			}
		});

		// Jika tool sudah ada di karakter saat komponen diinstansiasi
		if (this.tool.Parent === Players.LocalPlayer.Character) {
			this.onEquipped();
		}

		print("[SkateboardClientComponent] Initialized: Skateboard Tool ready.");
	}

	private onEquipped(): void {
		this.cleanupEquippedConnections();

		const isMounted = SkateboardController.getInstance().isPlayerMounted();
		this.setBoardVisible(!isMounted);
		this.setToolGripActive(!isMounted);

		const character = (this.tool.Parent as Model | undefined) ?? Players.LocalPlayer.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		const rightArm = character?.FindFirstChild("Right Arm") as BasePart | undefined;

		if (rightArm) {
			this.equippedConnections.push(
				rightArm.ChildAdded.Connect((child) => {
					if (child.Name === "RightGrip" && SkateboardController.getInstance().isPlayerMounted()) {
						this.setToolGripActive(false);
					}
				}),
			);
		}

		if (humanoid) {
			// Hentikan animasi tool bawaan Roblox (toolnone) agar tangan kanan menggantung santai menenteng papan
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

		print("[SkateboardClientComponent] Skateboard equipped in hand.");
	}

	private onUnequipped(): void {
		this.cleanupEquippedConnections();

		// Jika pemain menyimpan tool saat sedang skating, otomatis dismount
		if (SkateboardController.getInstance().isPlayerMounted()) {
			print("[SkateboardClientComponent] Tool unequipped while mounted. Dismounting...");
			SkateboardController.getInstance().dismount();
		}

		// Pulihkan transparansi & grip saat tool disimpan agar siap ketika di-equip berikutnya
		this.setBoardVisible(true);
		this.setToolGripActive(true);

		print("[SkateboardClientComponent] Skateboard unequipped.");
	}

	private onActivated(): void {
		// Batalkan animasi slash default Roblox jika terpicu klik
		const character = (this.tool.Parent as Model | undefined) ?? Players.LocalPlayer.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			for (const track of humanoid.GetPlayingAnimationTracks()) {
				const name = track.Name.lower();
				const animName = track.Animation?.Name.lower() ?? "";
				if (name.find("slash")[0] !== undefined || animName.find("slash")[0] !== undefined) {
					track.Stop(0);
				}
			}
		}

		const now = os.clock();
		if (now - this.lastActivateTime < 0.25) {
			return;
		}
		this.lastActivateTime = now;

		print("[SkateboardClientComponent] Tool clicked -> Toggling Skateboard Mount!");
		SkateboardController.getInstance().toggleMount();
	}

	private setToolGripActive(active: boolean): void {
		const character = (this.tool.Parent as Model | undefined) ?? Players.LocalPlayer.Character;
		if (!character) return;
		const rightArm = (character.FindFirstChild("Right Arm") ?? character.FindFirstChild("RightHand")) as BasePart | undefined;

		if (!active) {
			if (rightArm) {
				const rightGrip = rightArm.FindFirstChild("RightGrip") as Weld | undefined;
				if (rightGrip) {
					rightGrip.Enabled = false;
					rightGrip.Part1 = undefined;
					rightGrip.Destroy();
				}
				for (const child of rightArm.GetChildren()) {
					if (child.IsA("Weld") && (child.Name === "RightGrip" || child.Name === "Grip")) {
						child.Enabled = false;
						child.Destroy();
					}
				}
			}
			for (const desc of character.GetDescendants()) {
				if (desc.IsA("Weld") && (desc.Name === "RightGrip" || desc.Name === "Grip")) {
					desc.Enabled = false;
					desc.Destroy();
				}
			}
		} else {
			if (!rightArm) return;
			const handle = this.tool.FindFirstChild("Handle") as BasePart | undefined;
			if (handle) {
				const armOffset = rightArm.Name === "RightHand" ? new Vector3(0, 0, 0) : new Vector3(0, -1, 0);
				const defaultGripC0 = new CFrame(armOffset.X, armOffset.Y, armOffset.Z, 1, 0, 0, 0, 0, 1, 0, -1, 0);

				const rightGrip = rightArm.FindFirstChild("RightGrip") as Weld | undefined;
				if (!rightGrip) {
					const newGrip = new Instance("Weld");
					newGrip.Name = "RightGrip";
					newGrip.Part0 = rightArm;
					newGrip.Part1 = handle;
					newGrip.C0 = defaultGripC0;
					newGrip.C1 = this.tool.Grip;
					newGrip.Parent = rightArm;
				} else {
					rightGrip.Part1 = handle;
					rightGrip.C0 = defaultGripC0;
					rightGrip.C1 = this.tool.Grip;
					rightGrip.Enabled = true;
				}
			}
		}
	}

	private setBoardVisible(visible: boolean): void {
		for (const desc of this.tool.GetDescendants()) {
			if (desc.IsA("BasePart")) {
				if (!visible) {
					if (!this.originalTransparencies.has(desc)) {
						this.originalTransparencies.set(desc, desc.Transparency);
					}
					desc.Transparency = 1;
				} else {
					const orig = this.originalTransparencies.get(desc) ?? 0;
					desc.Transparency = orig;
				}
			}
		}
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

		if (this.unsubscribeMountListener) {
			this.unsubscribeMountListener();
			this.unsubscribeMountListener = undefined;
		}

		this.setBoardVisible(true);
		this.setToolGripActive(true);
		print("[SkateboardClientComponent] Destroyed.");
	}
}
