import { Players, TweenService } from "@rbxts/services";
import { StageCameraController } from "client/controllers/StageCameraController";

/**
 * OOP Class Adapter for StageCameraOverlayView.
 * Renders cinematic letterbox bars (cinematic frame) at the top and bottom of the screen,
 * identical to the spawn cinematic animation frame, active during stage camera broadcast.
 */
export class StageCameraOverlayView {
	private static instance?: StageCameraOverlayView;
	private screenGui: ScreenGui;
	private topBar: Frame;
	private bottomBar: Frame;
	private topTween?: Tween;
	private bottomTween?: Tween;
	private isVisible = false;
	private unsubController?: () => void;

	constructor(parentContainer?: Instance) {
		this.screenGui = new Instance("ScreenGui");
		this.screenGui.Name = "StageCameraCinematicGui";
		this.screenGui.ResetOnSpawn = false;
		this.screenGui.ScreenInsets = Enum.ScreenInsets.None;
		this.screenGui.IgnoreGuiInset = true;
		this.screenGui.DisplayOrder = 5;
		this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		this.screenGui.Enabled = false;

		if (parentContainer) {
			this.screenGui.Parent = parentContainer;
		} else {
			const localPlayer = Players.LocalPlayer;
			const playerGui =
				localPlayer?.FindFirstChildOfClass("PlayerGui") ??
				localPlayer?.WaitForChild("PlayerGui");
			if (playerGui) {
				const existing = playerGui.FindFirstChild("StageCameraCinematicGui") as ScreenGui | undefined;
				if (existing) {
					existing.Destroy();
				}
				this.screenGui.Parent = playerGui;
			}
		}

		// Top Letterbox Bar: Posisi aktif edge-to-edge
		this.topBar = new Instance("Frame");
		this.topBar.Name = "TopBar";
		this.topBar.Size = new UDim2(1, 200, 0.13, 0);
		this.topBar.Position = new UDim2(0, -100, -0.2, 0);
		this.topBar.BackgroundColor3 = Color3.fromHex("#000000");
		this.topBar.BorderSizePixel = 0;
		this.topBar.ZIndex = 201;
		this.topBar.Parent = this.screenGui;

		// Bottom Letterbox Bar: Posisi aktif edge-to-edge
		this.bottomBar = new Instance("Frame");
		this.bottomBar.Name = "BottomBar";
		this.bottomBar.AnchorPoint = new Vector2(0, 1);
		this.bottomBar.Size = new UDim2(1, 200, 0.13, 0);
		this.bottomBar.Position = new UDim2(0, -100, 1.2, 0);
		this.bottomBar.BackgroundColor3 = Color3.fromHex("#000000");
		this.bottomBar.BorderSizePixel = 0;
		this.bottomBar.ZIndex = 201;
		this.bottomBar.Parent = this.screenGui;

		// Hubungkan listener otomatis ke StageCameraController saat berjalan di client
		if (!parentContainer) {
			const controller = StageCameraController.getInstance();
			this.unsubController = controller.onStateChanged((state) => {
				if (state.mode !== "default") {
					this.show();
				} else {
					this.hide();
				}
			});
		}
	}

	public static getInstance(): StageCameraOverlayView {
		if (!StageCameraOverlayView.instance) {
			StageCameraOverlayView.instance = new StageCameraOverlayView();
		}
		return StageCameraOverlayView.instance;
	}

	public show(): void {
		if (this.isVisible) return;
		this.isVisible = true;

		this.topTween?.Cancel();
		this.bottomTween?.Cancel();

		this.screenGui.Enabled = true;

		const tweenInfo = new TweenInfo(0.6, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out);

		this.topTween = TweenService.Create(this.topBar, tweenInfo, {
			Position: new UDim2(0, -100, 0, 0),
		});
		this.bottomTween = TweenService.Create(this.bottomBar, tweenInfo, {
			Position: new UDim2(0, -100, 1, 0),
		});

		this.topTween.Play();
		this.bottomTween.Play();
	}

	public hide(): void {
		if (!this.isVisible) return;
		this.isVisible = false;

		this.topTween?.Cancel();
		this.bottomTween?.Cancel();

		const tweenInfo = new TweenInfo(0.7, Enum.EasingStyle.Cubic, Enum.EasingDirection.InOut);

		this.topTween = TweenService.Create(this.topBar, tweenInfo, {
			Position: new UDim2(0, -100, -0.2, 0),
		});
		this.bottomTween = TweenService.Create(this.bottomBar, tweenInfo, {
			Position: new UDim2(0, -100, 1.2, 0),
		});

		this.topTween.Completed.Connect((status) => {
			if (status === Enum.PlaybackState.Completed && !this.isVisible) {
				this.screenGui.Enabled = false;
			}
		});

		this.topTween.Play();
		this.bottomTween.Play();
	}

	public destroy(): void {
		if (this.unsubController) {
			this.unsubController();
			this.unsubController = undefined;
		}
		this.topTween?.Cancel();
		this.bottomTween?.Cancel();
		this.screenGui.Destroy();

		if (StageCameraOverlayView.instance === this) {
			StageCameraOverlayView.instance = undefined;
		}
	}
}
