import { Players, TweenService } from "@rbxts/services";
import { StageCameraController, StageCameraState } from "client/controllers/StageCameraController";
import { Fonts } from "client/ui/Typography";

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
	private watermarkLabel?: TextLabel;
	private shotLabel?: TextLabel;
	private liveDot?: Frame;
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
		this.screenGui.DisplayOrder = 130;
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

		// Watermark Container di pojok kiri bawah TopBar
		const watermarkContainer = new Instance("Frame");
		watermarkContainer.Name = "WatermarkContainer";
		watermarkContainer.AnchorPoint = new Vector2(0, 1);
		watermarkContainer.Position = new UDim2(0, 120, 1, -10);
		watermarkContainer.Size = new UDim2(0, 480, 0, 22);
		watermarkContainer.BackgroundTransparency = 1;
		watermarkContainer.ZIndex = 202;
		watermarkContainer.Parent = this.topBar;

		const listLayout = new Instance("UIListLayout");
		listLayout.FillDirection = Enum.FillDirection.Horizontal;
		listLayout.VerticalAlignment = Enum.VerticalAlignment.Center;
		listLayout.Padding = new UDim(0, 8);
		listLayout.SortOrder = Enum.SortOrder.LayoutOrder;
		listLayout.Parent = watermarkContainer;

		// Live Red Dot
		const dot = new Instance("Frame");
		dot.Name = "LiveDot";
		dot.LayoutOrder = 1;
		dot.Size = new UDim2(0, 8, 0, 8);
		dot.BackgroundColor3 = Color3.fromHex("#ef4444");
		dot.BorderSizePixel = 0;
		dot.ZIndex = 203;

		const dotCorner = new Instance("UICorner");
		dotCorner.CornerRadius = new UDim(1, 0);
		dotCorner.Parent = dot;
		dot.Parent = watermarkContainer;
		this.liveDot = dot;

		// Text Live Broadcast
		const liveText = new Instance("TextLabel");
		liveText.Name = "LiveText";
		liveText.LayoutOrder = 2;
		liveText.Size = new UDim2(0, 140, 1, 0);
		liveText.BackgroundTransparency = 1;
		liveText.Text = "LIVE BROADCAST";
		liveText.TextColor3 = Color3.fromHex("#ffffff");
		liveText.Font = Fonts.Bold;
		liveText.TextSize = 10.5;
		liveText.TextXAlignment = Enum.TextXAlignment.Left;
		liveText.ZIndex = 203;
		liveText.Parent = watermarkContainer;
		this.watermarkLabel = liveText;

		// Shot Name Badge
		const shotText = new Instance("TextLabel");
		shotText.Name = "ShotText";
		shotText.LayoutOrder = 3;
		shotText.Size = new UDim2(0, 300, 1, 0);
		shotText.BackgroundTransparency = 1;
		shotText.Text = "";
		shotText.TextColor3 = Color3.fromHex("#a855f7");
		shotText.Font = Fonts.Bold;
		shotText.TextSize = 10;
		shotText.TextXAlignment = Enum.TextXAlignment.Left;
		shotText.TextTruncate = Enum.TextTruncate.AtEnd;
		shotText.ZIndex = 203;
		shotText.Parent = watermarkContainer;
		this.shotLabel = shotText;

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
				this.updateWatermark(state);
				if (state.mode !== "default") {
					this.show();
				} else {
					this.hide();
				}
			});
		}
	}

	private updateWatermark(state: StageCameraState): void {
		if (!this.shotLabel) return;

		if (state.mode === "fixed_cam") {
			this.shotLabel.Text = `[CAM ${state.fixedCamIndex ?? 1}]`;
			this.shotLabel.TextColor3 = Color3.fromHex("#60a5fa");
		} else if (state.mode === "face") {
			const target = state.targetName ?? "Performer";
			this.shotLabel.Text = `[SOLO: ${target}]`;
			this.shotLabel.TextColor3 = Color3.fromHex("#34d399");
		} else if (state.mode === "orbit") {
			this.shotLabel.Text = "[360° ORBIT]";
			this.shotLabel.TextColor3 = Color3.fromHex("#a78bfa");
		} else if (state.mode === "drone") {
			this.shotLabel.Text = "[DRONE CRANE]";
			this.shotLabel.TextColor3 = Color3.fromHex("#38bdf8");
		} else if (state.mode === "low_angle") {
			this.shotLabel.Text = "[ROCKSTAR LOW ANGLE]";
			this.shotLabel.TextColor3 = Color3.fromHex("#f59e0b");
		} else {
			this.shotLabel.Text = "";
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
