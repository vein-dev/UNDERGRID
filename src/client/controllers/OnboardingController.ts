import { ContextActionService, Players, StarterGui } from "@rbxts/services";
import { LoadingScreenView } from "client/ui/views/LoadingScreenView";
import { MainMenuView } from "client/ui/views/MainMenuView";
import { SpawnCinematicController } from "./SpawnCinematicController";

/**
 * Controller yang mengatur seluruh urutan onboarding pembuka game:
 * 1. Custom Loading Screen (100% Selesai)
 * 2. Main Menu Sinematik (Start / Graphics / Credits)
 * 3. Pemain klik "Start" -> Cinematic Spawn Camera Orbit & Gameplay dimulai.
 */
export class OnboardingController {
	private static instance?: OnboardingController;
	private loadingView?: LoadingScreenView;
	private mainMenuView?: MainMenuView;
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
			StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.All, false);
		});
		pcall(() => {
			StarterGui.SetCore("TopbarEnabled", false);
		});

		// Sembunyikan UI gameplay dari awal
		SpawnCinematicController.getInstance().setCinematicUiVisible(false);

		// B. FREEZE INPUT & FISIKA PEMAIN SECARA TOTAL (Hanya pada join pertama)
		this.freezePlayerMovement();

		this.loadingView = LoadingScreenView.getInstance();
		this.mainMenuView = MainMenuView.getInstance();

		// 1. TAMPILKAN CUSTOM LOADING SCREEN SAAT PERTAMA JOIN
		this.loadingView.show();

		// 2. KETIKA LOADING SCREEN SELESAI (100%) -> BUKA MAIN MENU
		this.loadingView.onFinished(() => {
			this.loadingView?.hide();

			// Tampilkan Main Menu sesuai template HTML
			this.mainMenuView?.show();
		});

		// 3. KETIKA PEMAIN KLIK "START" DI MAIN MENU -> MASUK KE GAMEPLAY
		this.mainMenuView.onStart(() => {
			this.hasCompleted = true;
			// Catatan: MainMenuView mengelola lifecycle animasi transisi swipe-out dan hide secara mandiri

			// Putus koneksi lock karakter agar saat respawn tidak pernah terkunci lagi
			this.charAddedConn?.Disconnect();
			this.charAddedConn = undefined;

			// Lepaskan lock input onboarding
			ContextActionService.UnbindAction("OnboardingFreeze");

			// Langsung jalankan sinematik spawn kamera (orbit) & aktifkan kontrol gameplay
			task.defer(() => {
				SpawnCinematicController.getInstance().startCinematic();
			});
		});

		print("[OnboardingController] Initialized: Loading (100%) -> Main Menu -> Start -> Gameplay.");
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
