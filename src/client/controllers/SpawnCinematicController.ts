import { ContextActionService, Players, RunService, TweenService, Workspace } from "@rbxts/services";
import { GameConfig } from "shared/config";
import { CinematicOverlayView } from "client/ui/views/CinematicOverlayView";

/**
 * OOP Singleton Controller responsible for playing a dramatic cinematic camera
 * orbit sequence on first spawn, freezing the character during the sequence,
 * and restoring full player control once complete.
 */
export class SpawnCinematicController {
	private static instance?: SpawnCinematicController;

	private hasPlayed = false;
	private isSequenceFinished = false;
	private finishCallbacks: Array<() => void> = [];
	private overlayView: CinematicOverlayView;
	private activeConnection?: RBXScriptConnection;

	private constructor() {
		this.overlayView = new CinematicOverlayView();
	}

	public static getInstance(): SpawnCinematicController {
		if (!SpawnCinematicController.instance) {
			SpawnCinematicController.instance = new SpawnCinematicController();
		}
		return SpawnCinematicController.instance;
	}

	public init(): void {
		const localPlayer = Players.LocalPlayer;

		localPlayer.CharacterAdded.Connect((character) => {
			this.onCharacterAdded(character);
		});

		if (localPlayer.Character) {
			task.defer(() => this.onCharacterAdded(localPlayer.Character!));
		}

		print("[SpawnCinematicController] Initialized with on-demand trigger support.");
	}

	private onCharacterAdded(character: Model): void {
		const rootPart = character.WaitForChild("HumanoidRootPart", 10) as BasePart | undefined;
		const humanoid = character.WaitForChild("Humanoid", 10) as Humanoid | undefined;
		if (!rootPart || !humanoid) return;

		if (this.hasPlayed) {
			// Karakter baru saat respawn harus langsung bebas bergerak
			rootPart.Anchored = false;
			humanoid.AutoRotate = true;
			humanoid.WalkSpeed = GameConfig.PLAYER.DEFAULT_WALKSPEED;
			humanoid.JumpPower = GameConfig.PLAYER.DEFAULT_JUMPPOWER;
			ContextActionService.UnbindAction("SpawnCinematicFreeze");
			return;
		}

		// Freeze karakter selama loading & pemilihan gender awal berlangsung
		rootPart.Anchored = true;
		humanoid.WalkSpeed = 0;
		humanoid.JumpPower = 0;
		humanoid.AutoRotate = false;
	}

	public startCinematic(customCharacter?: Model): void {
		if (this.hasPlayed) return;

		const character = customCharacter ?? Players.LocalPlayer.Character;
		if (!character) return;

		const rootPart = character.WaitForChild("HumanoidRootPart", 10) as BasePart | undefined;
		const humanoid = character.WaitForChild("Humanoid", 10) as Humanoid | undefined;

		if (!rootPart || !humanoid) return;

		this.hasPlayed = true;
		print("[SpawnCinematicController] startCinematic invoked. Playing sequence now...");

		task.wait(0.1);
		this.playCinematicSequence(character, rootPart, humanoid);
	}

	private playCinematicSequence(character: Model, rootPart: BasePart, humanoid: Humanoid): void {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		print("[SpawnCinematicController] Starting 8-second continuous cinematic spawn orbit...");

		// 1. FREEZE KARAKTER & ANCHOR AGAR POSISI FISIKA STABIL
		humanoid.WalkSpeed = 0;
		humanoid.JumpPower = 0;
		humanoid.AutoRotate = false;
		rootPart.Anchored = true;

		ContextActionService.BindActionAtPriority(
			"SpawnCinematicFreeze",
			() => Enum.ContextActionResult.Sink,
			false,
			10000,
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

		// 2. TAMPILKAN LETTERBOX SINEMATIK (Diam di tempat tanpa animasi masuk)
		this.overlayView.show();

		// 3. SET KAMERA SCRIPTABLE (Tanpa modifikasi FOV buatan)
		camera.CameraType = Enum.CameraType.Scriptable;

		const rootCFrame = rootPart.CFrame;
		const lookVector = rootCFrame.LookVector;
		const rightVector = rootCFrame.RightVector;

		// Titik fokus pada tubuh atas karakter
		const targetFocus = rootPart.Position.add(new Vector3(0, 1.5, 0));

		const duration = 8.0; // Durasi 8 detik penuh
		const startTime = os.clock();

		let letterboxHidden = false;

		this.activeConnection?.Disconnect();
		this.activeConnection = RunService.RenderStepped.Connect(() => {
			const elapsed = os.clock() - startTime;
			const t = math.clamp(elapsed / duration, 0, 1);

			// Di detik 6.0, sembunyikan letterbox bar secara perlahan (2.0 detik) agar pas di detik 8.0 layar terbuka sempurna
			if (elapsed >= 6.0 && !letterboxHidden) {
				letterboxHidden = true;
				this.overlayView.hide();
			}

			// Easing SineInOut mulus dari detik awal hingga detik akhir
			const alpha = TweenService.GetValue(t, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);

			// Orbit berkesinambungan mengitari karakter tanpa dipotong di awal:
			// Mulai dari sudut depan-kanan (25°) memutari tubuh hingga tepat di belakang karakter (180°)
			const angle = math.rad(25) + alpha * math.rad(155);

			// Radius kamera: mulai dari 8.5 stud (hero shot), mengembang di samping,
			// dan berakhir tepat di 12.5 stud (jarak zoom default gameplay Roblox)
			const radius = 8.5 + 4.0 * alpha + 1.2 * math.sin(alpha * math.pi);

			// Ketinggian kamera: naik bertahap hingga 2.0 stud di atas targetFocus (posisi sudut kamera default Roblox)
			const height = 0.2 + 1.8 * alpha + 0.4 * math.sin(alpha * math.pi);

			const cosA = math.cos(angle);
			const sinA = math.sin(angle);

			const orbitOffset = lookVector
				.mul(cosA * radius)
				.add(rightVector.mul(sinA * radius))
				.add(new Vector3(0, height, 0));

			const camPos = targetFocus.add(orbitOffset);
			const currentCFrame = new CFrame(camPos, targetFocus);

			camera.CFrame = currentCFrame;
			camera.Focus = new CFrame(targetFocus);

			if (t >= 1) {
				this.activeConnection?.Disconnect();
				this.activeConnection = undefined;
				this.finishCinematicSequence(character, rootPart, humanoid, currentCFrame, targetFocus);
			}
		});
	}

	private finishCinematicSequence(
		character: Model,
		rootPart: BasePart,
		humanoid: Humanoid,
		finalCFrame: CFrame,
		targetFocus: Vector3,
	): void {
		const camera = Workspace.CurrentCamera;

		// 1. PASTIKAN LETTERBOX BARS SELESAI
		this.overlayView.hide();

		// 2. KEMBALIKAN KAMERA KE DEFAULT GAMEPLAY TEPAT DI FRAME AKHIR (ZERO HENTAKAN)
		if (camera) {
			camera.CameraSubject = humanoid;
			camera.Focus = new CFrame(targetFocus);
			camera.CFrame = finalCFrame;
			camera.CameraType = Enum.CameraType.Custom;
		}

		// 3. UNFREEZE KARAKTER
		rootPart.Anchored = false;
		humanoid.WalkSpeed = GameConfig.PLAYER.DEFAULT_WALKSPEED;
		humanoid.JumpPower = GameConfig.PLAYER.DEFAULT_JUMPPOWER;
		humanoid.AutoRotate = true;
		humanoid.ChangeState(Enum.HumanoidStateType.Landed);

		ContextActionService.UnbindAction("SpawnCinematicFreeze");

		this.isSequenceFinished = true;
		for (const cb of this.finishCallbacks) {
			cb();
		}
		this.finishCallbacks = [];

		print("[SpawnCinematicController] Cinematic spawn finished seamlessly at default gameplay frame.");
	}

	public isFinished(): boolean {
		return this.isSequenceFinished;
	}

	public onFinished(callback: () => void): () => void {
		if (this.isSequenceFinished) {
			task.defer(callback);
			return () => {};
		}
		this.finishCallbacks.push(callback);
		return () => {
			this.finishCallbacks = this.finishCallbacks.filter((cb) => cb !== callback);
		};
	}

	public destroy(): void {
		this.activeConnection?.Disconnect();
		this.activeConnection = undefined;
		ContextActionService.UnbindAction("SpawnCinematicFreeze");
		const character = Players.LocalPlayer?.Character;
		const rootPart = character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (rootPart) {
			rootPart.Anchored = false;
		}
		this.overlayView.destroy();
	}
}
