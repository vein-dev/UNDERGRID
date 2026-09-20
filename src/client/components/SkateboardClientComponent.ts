import { Players } from "@rbxts/services";
import { IToolComponent } from "./IToolComponent";
import { SkateboardController } from "../controllers/SkateboardController";

/**
 * OOP Client Component bound to the "Skateboard" Tool for LocalPlayer.
 *
 * Mengimplementasikan Instant Mount:
 * - Equip Tool (klik slot hotbar / tombol 1) → Langsung menaiki skateboard seketika (0ms delay).
 * - Tidak ada sistem handle / pegang di tangan (RequiresHandle = false, part visual tool 100% disembunyikan).
 * - Tidak ada mekanisme click-to-use (klik mouse / touch bebas tanpa memicu dismount tak terduga).
 * - Unequipped (tekan slot lagi / ganti tool / klik tombol dismount) → Otomatis dismount dan tersimpan di tas.
 */
export class SkateboardClientComponent implements IToolComponent {
	private connections: RBXScriptConnection[] = [];
	private equippedConnections: RBXScriptConnection[] = [];
	private unsubscribeMountListener?: () => void;

	private isDismounting = false;

	constructor(public readonly tool: Tool) {
		this.tool.ManualActivationOnly = true;
		this.tool.RequiresHandle = false;
		this.hideAllToolParts();
		this.init();
	}

	private hideAllToolParts(): void {
		for (const desc of this.tool.GetDescendants()) {
			if (desc.IsA("BasePart")) {
				desc.Transparency = 1;
				desc.CanCollide = false;
				desc.CanTouch = false;
				desc.CanQuery = false;
				desc.Massless = true;
			}
		}
	}

	private init(): void {
		this.connections.push(
			this.tool.Equipped.Connect(() => this.onEquipped()),
			this.tool.Unequipped.Connect(() => this.onUnequipped()),
			this.tool.DescendantAdded.Connect((desc) => {
				if (desc.IsA("BasePart")) {
					desc.Transparency = 1;
					desc.CanCollide = false;
					desc.CanTouch = false;
					desc.CanQuery = false;
				} else if (desc.IsA("Weld") && (desc.Name === "RightGrip" || desc.Name === "Grip")) {
					desc.Enabled = false;
					desc.Destroy();
				}
			}),
		);

		// Dengarkan event sinkronisasi mount dari SkateboardController
		this.unsubscribeMountListener = SkateboardController.getInstance().onMountStateChanged((mounted) => {
			if (!mounted && !this.isDismounting) {
				this.isDismounting = true;
				// Jika dismount terjadi saat tool masih di karakter (misal dari tombol UI mobile DISMOUNT), unequip tool
				const char = Players.LocalPlayer.Character;
				if (this.tool.Parent === char) {
					const hum = char?.FindFirstChildOfClass("Humanoid");
					if (hum) {
						hum.UnequipTools();
					}
				}
				this.isDismounting = false;
			}
		});

		// Jika tool sudah ada di karakter saat komponen diinstansiasi
		if (this.tool.Parent === Players.LocalPlayer.Character) {
			this.onEquipped();
		}

		print("[SkateboardClientComponent] Initialized: Skateboard instant-mount tool ready.");
	}

	private onEquipped(): void {
		this.cleanupEquippedConnections();

		// Sembunyikan semua part tool agar tangan kanan bersih dan tidak ada papan melayang di tangan
		this.hideAllToolParts();

		const character = (this.tool.Parent as Model | undefined) ?? Players.LocalPlayer.Character;
		const hrp = (character?.FindFirstChild("HumanoidRootPart") ?? character?.FindFirstChild("Torso")) as BasePart | undefined;
		const anchorPart = (this.tool.FindFirstChild("ToolAnchor") ??
			this.tool.FindFirstChild("Handle") ??
			this.tool.FindFirstChildWhichIsA("BasePart")) as BasePart | undefined;

		// Kunci ToolAnchor ke HumanoidRootPart agar part tool tidak jatuh bebas ke void
		if (hrp && anchorPart) {
			anchorPart.Name = "ToolAnchor";
			anchorPart.CFrame = hrp.CFrame;
			let weld = anchorPart.FindFirstChild("ToolRootWeld") as WeldConstraint | undefined;
			if (!weld) {
				weld = new Instance("WeldConstraint");
				weld.Name = "ToolRootWeld";
				weld.Part0 = hrp;
				weld.Part1 = anchorPart;
				weld.Parent = anchorPart;
			}
		}

		// Bersihkan RightGrip di tangan kanan jika pernah ada
		const rightArm = character?.FindFirstChild("Right Arm") as BasePart | undefined;
		if (rightArm) {
			for (const child of rightArm.GetChildren()) {
				if (child.IsA("Weld") && (child.Name === "RightGrip" || child.Name === "Grip")) {
					child.Enabled = false;
					child.Destroy();
				}
			}
		}

		const humanoid = character?.FindFirstChildOfClass("Humanoid");

		if (humanoid) {
			// Hentikan animasi tool default Roblox (toolnone / slash)
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

		// INSTANT MOUNT: Langsung naiki skateboard saat tool dipilih di hotbar tanpa perlu klik layar
		if (!SkateboardController.getInstance().isPlayerMounted()) {
			print("[SkateboardClientComponent] Skateboard tool equipped from hotbar -> Instant Mounting!");
			SkateboardController.getInstance().mount();
		}
	}

	private onUnequipped(): void {
		this.cleanupEquippedConnections();

		if (this.isDismounting) return;
		this.isDismounting = true;

		// Jika pemain menyimpan tool saat sedang skating, otomatis dismount
		if (SkateboardController.getInstance().isPlayerMounted()) {
			print("[SkateboardClientComponent] Tool unequipped from hotbar -> Dismounting...");
			SkateboardController.getInstance().dismount();
		}

		this.isDismounting = false;
		print("[SkateboardClientComponent] Skateboard unequipped.");
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

		print("[SkateboardClientComponent] Destroyed.");
	}
}
