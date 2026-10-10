import { Players } from "@rbxts/services";
import { StageCameraController } from "client/controllers/StageCameraController";
import { createSpring, Spring, SpringPresets } from "../SpringConfig";

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
	private offsetSpring: Spring<number>;
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

		// Offset spring: 0 = on screen, 1 = off screen
		this.offsetSpring = createSpring(1, SpringPresets.snappy);
		this.offsetSpring.onChange((offset: number) => {
			this.topBar.Position = new UDim2(0, -100, -0.2 * offset, 0);
			this.bottomBar.Position = new UDim2(0, -100, 1 + 0.2 * offset, 0);
		});
		this.offsetSpring.onComplete((offset: number) => {
			if (!this.isVisible && offset >= 0.95) {
				this.screenGui.Enabled = false;
			}
		});

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

		this.screenGui.Enabled = true;
		this.offsetSpring.setGoal(0);
	}

	public hide(): void {
		if (!this.isVisible) return;
		this.isVisible = false;

		this.offsetSpring.setGoal(1);
	}

	public destroy(): void {
		if (this.unsubController) {
			this.unsubController();
			this.unsubController = undefined;
		}
		this.offsetSpring.destroy();
		this.screenGui.Destroy();
		if (StageCameraOverlayView.instance === this) {
			StageCameraOverlayView.instance = undefined;
		}
	}
}
