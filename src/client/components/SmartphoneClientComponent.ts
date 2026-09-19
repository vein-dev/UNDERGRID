import { ContentProvider, Players, RunService, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { DEFAULT_SMARTPHONE_CONFIG, SMARTPHONE_ANIMATIONS } from "shared/types";
import { IToolComponent } from "./IToolComponent";
import { MusicPlayerService } from "client/services/MusicPlayerService";
import { SmartphoneView } from "client/ui/views/SmartphoneView";

/**
 * OOP Client Component bound to the "Smartphone" Tool for LocalPlayer.
 *
 * - Equip Tool   → Pegang tool biasa di tangan & mainkan animasi use (HandleSmartphone).
 * - Klik 1       → Buka UI Smartphone.
 * - Klik 2       → Tutup UI Smartphone.
 * - Unequipped   → Otomatis menutup UI, mainkan animasi unuse (Unhandle), dan membersihkan koneksi.
 */
export class SmartphoneClientComponent implements IToolComponent {
	private connections: RBXScriptConnection[] = [];
	private equippedConnections: RBXScriptConnection[] = [];
	private smartphoneView: SmartphoneView;

	private isPhoneOpened = false;
	private lastToggleTime = 0;

	private useTrack?: AnimationTrack;
	private unuseTrack?: AnimationTrack;

	private ikControl?: IKControl;
	private currentTween?: Tween;

	private originalFOV = 70;
	private fovTween?: Tween;

	constructor(public readonly tool: Tool) {
		// Pastikan klik mouse memicu tool.Activated
		this.tool.ManualActivationOnly = false;

		// Preload animasi di awal agar instan dan tidak ada lag/frame drop
		task.spawn(() => {
			const useAnim = this.getAnimationInstance("UseAnim", SMARTPHONE_ANIMATIONS.USE);
			const unuseAnim = this.getAnimationInstance("UnuseAnim", SMARTPHONE_ANIMATIONS.UNUSE);
			ContentProvider.PreloadAsync([useAnim, unuseAnim]);
		});

		// Ensure the singleton service is ready before the view builds its UI
		MusicPlayerService.getInstance(DEFAULT_SMARTPHONE_CONFIG);

		this.smartphoneView = new SmartphoneView();

		// Saat membuka layar HP: kepala menengok ke HP & kamera sedikit zoom-in
		this.smartphoneView.onOpen(() => {
			this.setHeadLookAtPhone(true);
			this.animateFOV(true);
		});

		// Saat layar HP ditutup dari UI (misal klik di luar bodi HP)
		this.smartphoneView.onClose(() => {
			this.isPhoneOpened = false;
			this.setHeadLookAtPhone(false);
			this.animateFOV(false);
		});

		this.init();
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

		if (this.tool.Parent === Players.LocalPlayer.Character) {
			this.onEquipped();
		}

		print("[SmartphoneClientComponent] Initialized: Toggle Open/Close on click.");
	}

	private setupIKControl(): void {
		// R6 uses procedural joint manipulation instead of R15 IKControl
		this.ikControl = undefined;
	}

	private setHeadLookAtPhone(active: boolean): void {
		if (active) {
			this.setupIKControl();
			if (this.ikControl) {
				this.ikControl.Enabled = true;
			}
		}

		if (!this.ikControl) return;

		this.currentTween?.Cancel();
		const targetWeight = active ? 0.85 : 0;
		const duration = active ? 0.35 : 0.25;

		this.currentTween = TweenService.Create(
			this.ikControl,
			new TweenInfo(duration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
			{ Weight: targetWeight },
		);

		if (!active) {
			this.currentTween.Completed.Connect((status) => {
				if (status === Enum.PlaybackState.Completed && this.ikControl && !this.smartphoneView.isOpen()) {
					this.ikControl.Enabled = false;
				}
			});
		}

		this.currentTween.Play();
	}

	private animateFOV(zoomIn: boolean): void {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		this.fovTween?.Cancel();

		if (zoomIn) {
			this.originalFOV = camera.FieldOfView > 0 ? camera.FieldOfView : 70;
			const targetFOV = math.max(this.originalFOV - 35, 45); // Zoom-in halus ~10 derajat FOV
			this.fovTween = TweenService.Create(
				camera,
				new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ FieldOfView: targetFOV },
			);
		} else {
			this.fovTween = TweenService.Create(
				camera,
				new TweenInfo(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ FieldOfView: this.originalFOV },
			);
		}

		this.fovTween.Play();
	}

	private cleanupIKControl(): void {
		this.currentTween?.Cancel();
		this.currentTween = undefined;
		if (this.ikControl) {
			this.ikControl.Destroy();
			this.ikControl = undefined;
		}
	}

	private cleanupEquippedConnections(): void {
		for (const conn of this.equippedConnections) {
			conn.Disconnect();
		}
		this.equippedConnections = [];
	}

	private getAnimationInstance(name: "UseAnim" | "UnuseAnim", fallbackId: string): Animation {
		const existing = this.tool.FindFirstChild(name);
		if (existing && existing.IsA("Animation")) {
			return existing;
		}
		const anim = new Instance("Animation");
		anim.Name = name;
		anim.AnimationId = fallbackId;
		anim.Parent = this.tool;
		return anim;
	}

	private getAnimator(humanoid: Humanoid): Animator {
		let animator = humanoid.FindFirstChildOfClass("Animator");
		if (!animator) {
			animator = new Instance("Animator");
			animator.Parent = humanoid;
		}
		return animator;
	}

	private playUseAnimation(character: Model): void {
		this.stopAnimations();

		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid) return;
		const animator = this.getAnimator(humanoid);

		const animInstance = this.getAnimationInstance("UseAnim", SMARTPHONE_ANIMATIONS.USE);
		const track = animator.LoadAnimation(animInstance);
		track.Priority = Enum.AnimationPriority.Action4;
		track.Looped = false;
		this.useTrack = track;

		track.Play(0.1);

		// Kunci pose di akhir animasi secara presisi menggunakan RenderStepped
		// agar tidak pernah terlewat atau otomatis stop sendiri
		let holdConn: RBXScriptConnection | undefined;
		holdConn = RunService.RenderStepped.Connect(() => {
			if (!track.IsPlaying || this.useTrack !== track) {
				holdConn?.Disconnect();
				return;
			}
			if (track.TimePosition >= 0.18) {
				track.AdjustSpeed(0);
				track.TimePosition = 0.20;
				holdConn?.Disconnect();
			}
		});

		if (holdConn) {
			this.equippedConnections.push(holdConn);
		}
	}

	private playUnuseAnimation(character: Model): void {
		this.stopUseAnimation();

		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid) return;
		const animator = this.getAnimator(humanoid);

		const animInstance = this.getAnimationInstance("UnuseAnim", SMARTPHONE_ANIMATIONS.UNUSE);
		const track = animator.LoadAnimation(animInstance);
		track.Priority = Enum.AnimationPriority.Action4;
		track.Looped = false;
		this.unuseTrack = track;

		track.Play(0.05);

		const conn = track.Stopped.Connect(() => {
			conn.Disconnect();
			if (this.unuseTrack === track) {
				track.Destroy();
				this.unuseTrack = undefined;
			}
		});
	}

	private stopUseAnimation(): void {
		if (this.useTrack) {
			const track = this.useTrack;
			this.useTrack = undefined;
			track.Stop(0.05);
			track.Destroy();
		}
	}

	private stopAnimations(): void {
		this.stopUseAnimation();
		if (this.unuseTrack) {
			const track = this.unuseTrack;
			this.unuseTrack = undefined;
			track.Stop(0.05);
			track.Destroy();
		}
	}

	private onEquipped(): void {
		this.cleanupEquippedConnections();
		this.isPhoneOpened = false;
		this.lastToggleTime = 0; // Siap langsung diklik seketika setelah equip

		const character = (this.tool.Parent as Model | undefined) ?? Players.LocalPlayer.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");

		if (humanoid) {
			// Hentikan animasi hold bawaan Roblox (toolnone) dan ayunan (slash) agar tidak mengganggu
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

		if (character) {
			this.playUseAnimation(character);
		}

		print("[SmartphoneClientComponent] Smartphone equipped (ready to click).");
	}

	private onUnequipped(): void {
		this.isPhoneOpened = false;
		if (this.smartphoneView.isOpen()) {
			this.smartphoneView.close();
		}
		this.cleanupEquippedConnections();
		this.animateFOV(false);
		this.setHeadLookAtPhone(false);
		this.cleanupIKControl();

		const character = Players.LocalPlayer.Character;
		if (character) {
			this.playUnuseAnimation(character);
		} else {
			this.stopAnimations();
		}

		print("[SmartphoneClientComponent] Smartphone unequipped.");
	}

	private onActivated(): void {
		// Batalkan segera track animasi slash jika sempat terpancing oleh klik mouse
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
		// Debounce 0.25s agar responsif tapi tetap aman dari double click instan
		if (now - this.lastToggleTime < 0.25) {
			return;
		}
		this.lastToggleTime = now;

		if (!this.smartphoneView.isOpen()) {
			// KLIK: Buka smartphone UI
			this.isPhoneOpened = true;
			this.smartphoneView.open();
		} else {
			// KLIK: Tutup smartphone UI
			this.isPhoneOpened = false;
			this.smartphoneView.close();
		}
	}

	public destroy(): void {
		for (const conn of this.connections) conn.Disconnect();
		this.connections = [];
		this.cleanupEquippedConnections();
		this.animateFOV(false);
		this.cleanupIKControl();
		this.stopAnimations();

		this.smartphoneView.destroy();
		print("[SmartphoneClientComponent] Destroyed.");
	}
}
