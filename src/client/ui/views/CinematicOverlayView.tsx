import { Players } from "@rbxts/services";
import { createSpring, Spring, SpringPresets } from "../SpringConfig";

/**
 * OOP Class Adapter for CinematicOverlayView.
 * - Start (show): Letterbox bars stay fixed in place without entrance animation.
 * - End (hide): Bars smoothly and slowly slide away (top slides up, bottom slides down) using spring physics.
 */
export class CinematicOverlayView {
	private screenGui: ScreenGui;
	private topBar: Frame;
	private bottomBar: Frame;
	private offsetSpring: Spring<number>;
	private isVisible = false;

	constructor(parentContainer?: Instance) {
		this.screenGui = new Instance("ScreenGui");
		this.screenGui.Name = "CinematicOverlayGui";
		this.screenGui.ResetOnSpawn = false;
		this.screenGui.ScreenInsets = Enum.ScreenInsets.None;
		this.screenGui.IgnoreGuiInset = true;
		this.screenGui.DisplayOrder = 500;
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
				this.screenGui.Parent = playerGui;
			}
		}

		// Top Letterbox Bar: Posisi aktif default diam di tempat (full bleed edge-to-edge)
		this.topBar = new Instance("Frame");
		this.topBar.Name = "TopBar";
		this.topBar.Size = new UDim2(1, 200, 0.13, 0);
		this.topBar.Position = new UDim2(0, -100, 0, 0);
		this.topBar.BackgroundColor3 = Color3.fromHex("#000000");
		this.topBar.BorderSizePixel = 0;
		this.topBar.ZIndex = 201;
		this.topBar.Parent = this.screenGui;

		// Bottom Letterbox Bar: Posisi aktif default diam di tempat (full bleed edge-to-edge)
		this.bottomBar = new Instance("Frame");
		this.bottomBar.Name = "BottomBar";
		this.bottomBar.AnchorPoint = new Vector2(0, 1);
		this.bottomBar.Size = new UDim2(1, 200, 0.13, 0);
		this.bottomBar.Position = new UDim2(0, -100, 1, 0);
		this.bottomBar.BackgroundColor3 = Color3.fromHex("#000000");
		this.bottomBar.BorderSizePixel = 0;
		this.bottomBar.ZIndex = 201;
		this.bottomBar.Parent = this.screenGui;

		// Offset spring: 0 = on screen, 1 = off screen
		this.offsetSpring = createSpring(0, SpringPresets.gentle);
		this.offsetSpring.onChange((offset: number) => {
			this.topBar.Position = new UDim2(0, -100, -0.2 * offset, 0);
			this.bottomBar.Position = new UDim2(0, -100, 1 + 0.2 * offset, 0);
		});
		this.offsetSpring.onComplete((offset: number) => {
			if (!this.isVisible && offset >= 0.95) {
				this.screenGui.Enabled = false;
			}
		});
	}

	public show(): void {
		this.isVisible = true;
		this.offsetSpring.setPosition(0);
		this.offsetSpring.setGoal(0);
		this.topBar.Position = new UDim2(0, -100, 0, 0);
		this.bottomBar.Position = new UDim2(0, -100, 1, 0);
		this.screenGui.Enabled = true;
	}

	public hide(): void {
		this.isVisible = false;
		// Animasi slide keluar lambat & sangat halus dengan spring physics
		this.offsetSpring.setGoal(1);
	}

	public destroy(): void {
		this.offsetSpring.destroy();
		this.screenGui.Destroy();
	}
}
