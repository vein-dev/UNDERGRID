import { ContextActionService, Players, StarterGui } from "@rbxts/services";
import { LoadingScreenView } from "client/ui/views/LoadingScreenView";
import { SpawnCinematicController } from "./SpawnCinematicController";

/**
 * Controller yang mengatur seluruh urutan onboarding pembuka game:
 * 1. Custom Loading Screen (Layar Hitam Pekat, Handshake Data, & Progress Bar Halus)
 * 2. Cinematic Spawn Camera Orbit (8 Detik)
 * 3. Gameplay dimulai dengan kontrol penuh.
 */
export class OnboardingController {
	private static instance?: OnboardingController;
	private loadingView?: LoadingScreenView;
	private charAddedConn?: RBXScriptConnection;
	private hasCompleted = false;

	private constructor() {}

	public static getInstance(): OnboardingController {
		if (!OnboardingController.instance) {
			OnboardingController.instance = new OnboardingController();
		}
		return OnboardingController.instance;
	}

	public init(): void {
		// A. TAHAN GAME DARI AWAL: Nonaktifkan CoreGui default Roblox
		pcall(() => {
			StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.All, true);
		});

		// B. FREEZE INPUT & FISIKA PEMAIN SECARA TOTAL (Hanya pada join pertama)
		this.freezePlayerMovement();

		this.loadingView = LoadingScreenView.getInstance();

		// 1. TAMPILKAN CUSTOM LOADING SCREEN HITAM PEKAT SAAT PERTAMA JOIN
		this.loadingView.show();

		// 2. KETIKA LOADING SCREEN SELESAI
		this.loadingView.onFinished(() => {
			this.hasCompleted = true;
			this.loadingView?.hide();

			// Putus koneksi lock karakter agar saat respawn tidak pernah terkunci lagi
			this.charAddedConn?.Disconnect();
			this.charAddedConn = undefined;

			// Lepaskan lock input onboarding
			ContextActionService.UnbindAction("OnboardingFreeze");

			// Langsung jalankan sinematik spawn kamera (8 detik orbit)
			task.defer(() => {
				SpawnCinematicController.getInstance().startCinematic();
			});
		});

		print("[OnboardingController] Initialized: Loading -> Cinematic Spawn -> Gameplay.");
	}

	private freezePlayerMovement(): void {
		if (this.hasCompleted) return;

		ContextActionService.BindActionAtPriority(
			"OnboardingFreeze",
			() => Enum.ContextActionResult.Sink,
			false,
			20000,
			Enum.KeyCode.W,
			Enum.KeyCode.A,
			Enum.KeyCode.S,
			Enum.KeyCode.D,
			Enum.KeyCode.Space,
			Enum.KeyCode.Up,
			Enum.KeyCode.Down,
			Enum.KeyCode.Left,
			Enum.KeyCode.Right,
			Enum.KeyCode.G,
			Enum.KeyCode.P,
			Enum.KeyCode.M,
			Enum.KeyCode.One,
			Enum.KeyCode.Two,
			Enum.KeyCode.Three,
			Enum.KeyCode.Four,
			Enum.KeyCode.Five,
			Enum.KeyCode.Six,
		);

		const localPlayer = Players.LocalPlayer;
		const lockChar = (character: Model) => {
			if (this.hasCompleted) return;

			const rootPart = character.WaitForChild("HumanoidRootPart", 10) as BasePart | undefined;
			const humanoid = character.WaitForChild("Humanoid", 10) as Humanoid | undefined;
			if (rootPart && humanoid) {
				rootPart.Anchored = true;
				humanoid.WalkSpeed = 0;
				humanoid.JumpPower = 0;
				humanoid.AutoRotate = false;
			}
		};

		if (localPlayer.Character) {
			lockChar(localPlayer.Character);
		}
		this.charAddedConn = localPlayer.CharacterAdded.Connect(lockChar);
	}
}
