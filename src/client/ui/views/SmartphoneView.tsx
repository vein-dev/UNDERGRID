import { Players, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { AppId } from "shared/types";
import { getGMT7TimeInfo, GetIconUri } from "shared/utils";
import { Fonts } from "../Typography";
import { AppRouter } from "../AppRouter";
import { HomeScreenView } from "./HomeScreenView";
import { LockScreenView } from "./LockScreenView";
import { NotificationBannerView } from "./NotificationBannerView";
import { ChatService } from "client/services/ChatService";
import { SocialService } from "client/services/SocialService";
import { GlobalNotificationService } from "client/services/GlobalNotificationService";
import type { ExternalDynamicIslandView } from "./ExternalDynamicIslandView";

/**
 * Main Smartphone shell View.
 * Migrated to React TSX declarative renderer while preserving 100% backward compatibility
 * with SmartphoneClientComponent via its public methods.
 */
export class SmartphoneView {
	private screenGui: ScreenGui;
	private statusBarClock: TextLabel;

	private phoneFrame: Frame;
	private dimOverlay: TextButton;

	private appContainer: Frame;
	private homeContainer: Frame;
	private lockContainer: Frame;

	private lockScreen: LockScreenView;
	private homeScreen: HomeScreenView;
	private appRouter: AppRouter;
	private notificationBanner: NotificationBannerView;

	private isPhoneOpen = false;
	private lastOpenTime = 0;
	private isDestroyed = false;
	private closeCallbacks: Array<() => void> = [];
	private openCallbacks: Array<() => void> = [];
	private slideTween?: Tween;

	constructor(parentContainer?: Instance) {
		const isGuiObject = parentContainer && parentContainer.IsA("GuiObject");

		this.screenGui = new Instance("ScreenGui");
		this.screenGui.Name = "SmartphoneGui";
		this.screenGui.ResetOnSpawn = false;
		this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
		this.screenGui.DisplayOrder = 100;
		this.screenGui.ScreenInsets = Enum.ScreenInsets.None;
		this.screenGui.IgnoreGuiInset = true;
		this.screenGui.Enabled = false;

		let rootParent: Instance;
		if (parentContainer) {
			if (isGuiObject) {
				rootParent = parentContainer;
			} else if (parentContainer.IsA("BasePlayerGui") || parentContainer.IsA("PlayerGui")) {
				this.screenGui.Parent = parentContainer;
				rootParent = this.screenGui;
			} else {
				// UI-Labs storybook target (ScreenGui, Folder, dll)
				const wrapper = new Instance("Frame");
				wrapper.Name = "SmartphoneStoryWrapper";
				wrapper.Size = new UDim2(1, 0, 1, 0);
				wrapper.BackgroundTransparency = 1;
				wrapper.Parent = parentContainer;
				rootParent = wrapper;
			}
		} else {
			const localPlayer = Players.LocalPlayer;
			const playerGui = localPlayer?.FindFirstChildOfClass("PlayerGui");
			if (playerGui) {
				this.screenGui.Parent = playerGui;
			}
			rootParent = this.screenGui;
		}

		// Dimmed world overlay — clicking outside the phone closes it (in gameplay only)
		this.dimOverlay = new Instance("TextButton");
		this.dimOverlay.Name = "DimOverlay";
		this.dimOverlay.Size = new UDim2(1, 0, 1, 0);
		this.dimOverlay.BackgroundColor3 = Color3.fromHex("#000000");
		this.dimOverlay.BackgroundTransparency = 1; // 100% transparan: tidak ada background gelap lagi
		this.dimOverlay.Text = "";
		this.dimOverlay.AutoButtonColor = false;
		this.dimOverlay.ZIndex = 90;
		this.dimOverlay.Visible = false;
		this.dimOverlay.Parent = rootParent;

		const handleDimClick = () => {
			if (parentContainer) return;

			// Mencegah klik pembuka mouse-up langsung memicu penutupan
			if (os.clock() - this.lastOpenTime < 0.4) {
				return;
			}

			// Pastikan klik benar-benar berada di LUAR bodi HP
			const mousePos = UserInputService.GetMouseLocation();
			const phonePos = this.phoneFrame.AbsolutePosition;
			const phoneSize = this.phoneFrame.AbsoluteSize;

			const isInsidePhone =
				mousePos.X >= phonePos.X &&
				mousePos.X <= phonePos.X + phoneSize.X &&
				mousePos.Y >= phonePos.Y &&
				mousePos.Y <= phonePos.Y + phoneSize.Y;

			if (isInsidePhone) {
				return;
			}

			this.close();
		};
		this.dimOverlay.Activated.Connect(handleDimClick);
		this.dimOverlay.MouseButton1Click.Connect(handleDimClick);

		// Physical Phone Frame (Outer Titanium Chassis)
		this.phoneFrame = new Instance("Frame");
		this.phoneFrame.Name = "PhoneChassis";
		this.phoneFrame.AnchorPoint = new Vector2(1, 0.5);
		this.phoneFrame.Position = new UDim2(1, 420, 0.5, 0); // Posisi awal di luar layar sebelah kanan
		this.phoneFrame.Size = new UDim2(0, 318, 0, 652);
		this.phoneFrame.BackgroundColor3 = Color3.fromHex("#141414");
		this.phoneFrame.Active = true;
		this.phoneFrame.Visible = false;
		this.phoneFrame.ZIndex = 95;
		this.phoneFrame.Parent = rootParent;

		const phoneCorner = new Instance("UICorner");
		phoneCorner.CornerRadius = new UDim(0, 50);
		phoneCorner.Parent = this.phoneFrame;

		const phoneStroke = new Instance("UIStroke");
		phoneStroke.Color = Color3.fromHex("#363636");
		phoneStroke.Thickness = 2.0;
		phoneStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
		phoneStroke.Parent = this.phoneFrame;

		// Responsive scaling
		const uiScale = new Instance("UIScale");
		uiScale.Name = "PhoneScale";
		uiScale.Parent = this.phoneFrame;

		const updateScale = () => {
			const camera = Workspace.CurrentCamera;
			const vp = camera ? camera.ViewportSize : new Vector2(1280, 720);
			const scaleY = (vp.Y * 0.9) / 652;
			const scaleX = (vp.X * 0.9) / 318;
			uiScale.Scale = math.clamp(math.min(scaleY, scaleX), 0.45, 1.15);
		};
		updateScale();

		const cam = Workspace.CurrentCamera;
		cam?.GetPropertyChangedSignal("ViewportSize").Connect(updateScale);
		Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(updateScale);

		// Screen Canvas (CanvasGroup that cleanly clips ALL screen content to curved corners)
		const screenCanvas = new Instance("CanvasGroup");
		screenCanvas.Name = "ScreenCanvas";
		screenCanvas.AnchorPoint = new Vector2(0.5, 0.5);
		screenCanvas.Position = new UDim2(0.5, 0, 0.5, 0);
		screenCanvas.Size = new UDim2(1, -8, 1, -8);
		screenCanvas.BackgroundColor3 = Color3.fromHex("#000000");
		screenCanvas.Active = false; // Non-blocking agar touch dapat mengalir ke child buttons
		screenCanvas.ZIndex = 96;
		screenCanvas.Parent = this.phoneFrame;

		const screenCorner = new Instance("UICorner");
		screenCorner.CornerRadius = new UDim(0, 46);
		screenCorner.Parent = screenCanvas;

		// Status Bar
		const statusBar = new Instance("Frame");
		statusBar.Name = "StatusBar";
		statusBar.Size = new UDim2(1, 0, 0, 36);
		statusBar.BackgroundTransparency = 1;
		statusBar.ZIndex = 110;
		statusBar.Parent = screenCanvas;

		this.statusBarClock = new Instance("TextLabel");
		this.statusBarClock.Name = "Clock";
		this.statusBarClock.Position = new UDim2(0, 24, 0.5, -8);
		this.statusBarClock.Size = new UDim2(0, 50, 0, 16);
		this.statusBarClock.BackgroundTransparency = 1;
		this.statusBarClock.Text = "12:00";
		this.statusBarClock.TextColor3 = Color3.fromHex("#ffffff");
		this.statusBarClock.Font = Fonts.Bold;
		this.statusBarClock.TextSize = 13;
		this.statusBarClock.TextXAlignment = Enum.TextXAlignment.Left;
		this.statusBarClock.ZIndex = 111;
		this.statusBarClock.Parent = statusBar;

		// Dynamic Island notch pill
		const notch = new Instance("Frame");
		notch.Name = "Notch";
		notch.AnchorPoint = new Vector2(0.5, 0);
		notch.Position = new UDim2(0.5, 0, 0, 9);
		notch.Size = new UDim2(0, 88, 0, 22);
		notch.BackgroundColor3 = Color3.fromHex("#000000");
		notch.ZIndex = 112;
		notch.Parent = statusBar;

		const notchCorner = new Instance("UICorner");
		notchCorner.CornerRadius = new UDim(1, 0);
		notchCorner.Parent = notch;

		// Front camera lens dot
		const cameraDot = new Instance("Frame");
		cameraDot.Name = "CameraDot";
		cameraDot.AnchorPoint = new Vector2(0.5, 0.5);
		cameraDot.Position = new UDim2(0.72, 0, 0.5, 0);
		cameraDot.Size = new UDim2(0, 8, 0, 8);
		cameraDot.BackgroundColor3 = Color3.fromHex("#0e121a");
		cameraDot.ZIndex = 113;
		cameraDot.Parent = notch;

		const camCorner = new Instance("UICorner");
		camCorner.CornerRadius = new UDim(1, 0);
		camCorner.Parent = cameraDot;

		const camStroke = new Instance("UIStroke");
		camStroke.Color = Color3.fromHex("#1b2230");
		camStroke.Thickness = 1;
		camStroke.Parent = cameraDot;

		// Sensor dot
		const sensorDot = new Instance("Frame");
		sensorDot.Name = "SensorDot";
		sensorDot.AnchorPoint = new Vector2(0.5, 0.5);
		sensorDot.Position = new UDim2(0.35, 0, 0.5, 0);
		sensorDot.Size = new UDim2(0, 5, 0, 5);
		sensorDot.BackgroundColor3 = Color3.fromHex("#080a0f");
		sensorDot.ZIndex = 113;
		sensorDot.Parent = notch;

		const sensorCorner = new Instance("UICorner");
		sensorCorner.CornerRadius = new UDim(1, 0);
		sensorCorner.Parent = sensorDot;

		// Right Status Icons (Battery, Signal Bars, Wi-Fi)
		const statusIcons = new Instance("Frame");
		statusIcons.Name = "StatusIcons";
		statusIcons.AnchorPoint = new Vector2(1, 0.5);
		statusIcons.Position = new UDim2(1, -22, 0.5, 0);
		statusIcons.Size = new UDim2(0, 60, 0, 16);
		statusIcons.BackgroundTransparency = 1;
		statusIcons.ZIndex = 111;
		statusIcons.Parent = statusBar;

		const iconLayout = new Instance("UIListLayout");
		iconLayout.FillDirection = Enum.FillDirection.Horizontal;
		iconLayout.HorizontalAlignment = Enum.HorizontalAlignment.Right;
		iconLayout.VerticalAlignment = Enum.VerticalAlignment.Center;
		iconLayout.Padding = new UDim(0, 5);
		iconLayout.SortOrder = Enum.SortOrder.LayoutOrder;
		iconLayout.Parent = statusIcons;

		// Wi-Fi Icon (LucideIcon wifi)
		const wifiIcon = new Instance("ImageLabel");
		wifiIcon.Name = "WifiIcon";
		wifiIcon.LayoutOrder = 1;
		wifiIcon.Size = new UDim2(0, 13, 0, 13);
		wifiIcon.BackgroundTransparency = 1;
		wifiIcon.Image = GetIconUri("wifi");
		wifiIcon.ImageColor3 = Color3.fromHex("#ffffff");
		wifiIcon.ZIndex = 112;
		wifiIcon.Parent = statusIcons;

		// Signal Bars (4 ascending bars)
		const signalContainer = new Instance("Frame");
		signalContainer.Name = "SignalBars";
		signalContainer.LayoutOrder = 2;
		signalContainer.Size = new UDim2(0, 14, 0, 10);
		signalContainer.BackgroundTransparency = 1;
		signalContainer.ZIndex = 112;
		signalContainer.Parent = statusIcons;

		const barHeights = [3, 5, 7, 9];
		for (let i = 0; i < 4; i++) {
			const bar = new Instance("Frame");
			bar.Name = `Bar${i + 1}`;
			bar.AnchorPoint = new Vector2(0, 1);
			bar.Position = new UDim2(0, i * 3.5, 1, 0);
			bar.Size = new UDim2(0, 2, 0, barHeights[i]);
			bar.BackgroundColor3 = Color3.fromHex("#ffffff");
			bar.ZIndex = 113;
			bar.Parent = signalContainer;

			const barCorner = new Instance("UICorner");
			barCorner.CornerRadius = new UDim(0, 0.5);
			barCorner.Parent = bar;
		}

		// Battery Icon
		const batteryContainer = new Instance("Frame");
		batteryContainer.Name = "BatteryIcon";
		batteryContainer.LayoutOrder = 3;
		batteryContainer.Size = new UDim2(0, 21, 0, 10);
		batteryContainer.BackgroundTransparency = 1;
		batteryContainer.ZIndex = 112;
		batteryContainer.Parent = statusIcons;

		const batteryBody = new Instance("Frame");
		batteryBody.Name = "Body";
		batteryBody.Size = new UDim2(0, 18, 0, 10);
		batteryBody.BackgroundTransparency = 1;
		batteryBody.ZIndex = 113;
		batteryBody.Parent = batteryContainer;

		const bCorner = new Instance("UICorner");
		bCorner.CornerRadius = new UDim(0, 3);
		bCorner.Parent = batteryBody;

		const bStroke = new Instance("UIStroke");
		bStroke.Color = Color3.fromHex("#ffffff");
		bStroke.Thickness = 1;
		bStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
		bStroke.Parent = batteryBody;

		const batteryFill = new Instance("Frame");
		batteryFill.Name = "Fill";
		batteryFill.Position = new UDim2(0, 2, 0, 2);
		batteryFill.Size = new UDim2(0, 11, 0, 6);
		batteryFill.BackgroundColor3 = Color3.fromHex("#ffffff");
		batteryFill.ZIndex = 114;
		batteryFill.Parent = batteryBody;

		const fCorner = new Instance("UICorner");
		fCorner.CornerRadius = new UDim(0, 1.5);
		fCorner.Parent = batteryFill;

		const batteryNub = new Instance("Frame");
		batteryNub.Name = "Nub";
		batteryNub.Position = new UDim2(0, 18.5, 0.5, -2);
		batteryNub.Size = new UDim2(0, 1.5, 0, 4);
		batteryNub.BackgroundColor3 = Color3.fromHex("#ffffff");
		batteryNub.ZIndex = 113;
		batteryNub.Parent = batteryContainer;

		const nCorner = new Instance("UICorner");
		nCorner.CornerRadius = new UDim(0, 1);
		nCorner.Parent = batteryNub;

		// Home Indicator bar
		const homeIndicator = new Instance("TextButton");
		homeIndicator.Name = "HomeIndicator";
		homeIndicator.AnchorPoint = new Vector2(0.5, 1);
		homeIndicator.Position = new UDim2(0.5, 0, 1, -8);
		homeIndicator.Size = new UDim2(0, 140, 0, 20);
		homeIndicator.BackgroundTransparency = 1;
		homeIndicator.Text = "";
		homeIndicator.AutoButtonColor = false;
		homeIndicator.ZIndex = 120;
		homeIndicator.Parent = screenCanvas;

		const homeBar = new Instance("Frame");
		homeBar.AnchorPoint = new Vector2(0.5, 0.5);
		homeBar.Position = new UDim2(0.5, 0, 0.5, 0);
		homeBar.Size = new UDim2(0, 110, 0, 4.5);
		homeBar.BackgroundColor3 = Color3.fromHex("#ffffff");
		homeBar.BackgroundTransparency = 0.25;
		homeBar.ZIndex = 121;
		homeBar.Parent = homeIndicator;

		const barCorner = new Instance("UICorner");
		barCorner.CornerRadius = new UDim(1, 0);
		barCorner.Parent = homeBar;

		// Home indicator tap -> return to home screen
		const goHome = () => {
			this.appRouter.hideAll();
			this.appContainer.Visible = false;
			this.homeContainer.Visible = true;
			this.homeScreen.show();
		};
		homeIndicator.Activated.Connect(goHome);
		homeIndicator.MouseButton1Click.Connect(goHome);

		// Sub-containers inside screenCanvas to isolate React roots and preserve screenCorner & statusBar
		// AppContainer has top safe area inset (38px) so app headers sit cleanly below Dynamic Island / Status Bar,
		// and bottom inset (20px) to prevent bottom action bars from colliding with the Home Indicator.
		// Sub-containers inside screenCanvas to isolate React roots and preserve screenCorner & statusBar
		// AppContainer has top safe area inset (38px) so app headers sit cleanly below Dynamic Island / Status Bar,
		// and bottom inset (20px) to prevent bottom action bars from colliding with the Home Indicator.
		this.appContainer = new Instance("Frame");
		this.appContainer.Name = "AppContainer";
		this.appContainer.Position = new UDim2(0, 0, 0, 38);
		this.appContainer.Size = new UDim2(1, 0, 1, -58);
		this.appContainer.BackgroundTransparency = 1;
		this.appContainer.Active = false; // Non-blocking agar touch dapat mengalir ke elemen UI app
		this.appContainer.ZIndex = 50; // Lebih tinggi dari HomeContainer saat app aktif
		this.appContainer.Visible = false;
		this.appContainer.Parent = screenCanvas;

		this.homeContainer = new Instance("Frame");
		this.homeContainer.Name = "HomeContainer";
		this.homeContainer.Size = new UDim2(1, 0, 1, 0);
		this.homeContainer.BackgroundTransparency = 1;
		this.homeContainer.Active = false; // Non-blocking: mencegah intercept touch saat app dibuka
		this.homeContainer.ZIndex = 20;
		this.homeContainer.Visible = false;
		this.homeContainer.Parent = screenCanvas;

		this.lockContainer = new Instance("Frame");
		this.lockContainer.Name = "LockContainer";
		this.lockContainer.Size = new UDim2(1, 0, 1, 0);
		this.lockContainer.BackgroundTransparency = 1;
		this.lockContainer.Active = false;
		this.lockContainer.ZIndex = 80;
		this.lockContainer.Visible = true;
		this.lockContainer.Parent = screenCanvas;

		const bannerContainer = new Instance("Frame");
		bannerContainer.Name = "BannerContainer";
		bannerContainer.Size = new UDim2(1, 0, 1, 0);
		bannerContainer.BackgroundTransparency = 1;
		bannerContainer.ZIndex = 150;
		bannerContainer.Parent = screenCanvas;

		// Instantiate children inside dedicated containers
		this.notificationBanner = new NotificationBannerView(bannerContainer);

		this.lockScreen = new LockScreenView(this.lockContainer);
		this.homeScreen = new HomeScreenView(this.homeContainer);
		this.appRouter = new AppRouter(this.appContainer);

		// Navigation events
		this.lockScreen.onUnlock(() => {
			this.lockScreen.hide();
			this.lockContainer.Visible = false;
			this.homeContainer.Visible = true;
			this.homeScreen.show();
		});

		this.homeScreen.onAppIconClicked((appId) => {
			this.homeScreen.hide();
			this.homeContainer.Visible = false;
			this.appContainer.Visible = true;
			this.appRouter.openApp(appId);
		});

		this.appRouter.onAppClosed(() => {
			this.appContainer.Visible = false;
			this.homeContainer.Visible = true;
			this.homeScreen.show();
		});

		// Banner click
		this.notificationBanner.onBannerClicked((msg) => {
			this.open();
			this.lockScreen.hide();
			this.lockContainer.Visible = false;
			this.homeScreen.hide();
			this.homeContainer.Visible = false;
			this.appContainer.Visible = true;
			this.appRouter.openChatWith(msg.senderUserId, msg.senderDisplayName, msg.senderName);
		});

		// Unread badges
		ChatService.getInstance().onUnreadCountChanged((count) => {
			this.homeScreen.setBadge(AppId.Messages, count);
		});

		ChatService.getInstance().onIncomingMessage((msg) => {
			// Smart notification: jika pemain sedang membuka room chat pengirim ini, jangan tampilkan notifikasi
			if (this.isPhoneOpen && this.appRouter.isChatOpenWith(msg.senderUserId)) {
				return;
			}

			GlobalNotificationService.getInstance().showChat(msg, () => {
				this.open();
				this.lockScreen.hide();
				this.lockContainer.Visible = false;
				this.homeScreen.hide();
				this.homeContainer.Visible = false;
				this.appContainer.Visible = true;
				this.appRouter.openChatWith(msg.senderUserId, msg.senderDisplayName, msg.senderName);
			});
		});

		SocialService.getInstance().onUnreadCountChanged((count) => {
			this.homeScreen.setBadge(AppId.Social, count);
		});

		GlobalNotificationService.getInstance().registerInternalBanner(
			this.notificationBanner,
			() => this.isPhoneOpen,
		);

		this.startClockLoop();
	}

	private startClockLoop(): void {
		task.spawn(() => {
			while (!this.isDestroyed) {
				this.updateClock();
				task.wait(30);
			}
		});
	}

	private updateClock(): void {
		const info = getGMT7TimeInfo();
		this.statusBarClock.Text = info.timeString;
		this.lockScreen.updateClock();
	}

	public open(): void {
		this.isPhoneOpen = true;
		this.lastOpenTime = os.clock();
		this.notificationBanner.forceHide();
		GlobalNotificationService.getInstance().getExternalView().forceHide();
		this.updateClock();
		this.appRouter.hideAll();
		this.appContainer.Visible = false;
		this.homeScreen.hide();
		this.homeContainer.Visible = false;
		this.lockContainer.Visible = true;
		this.lockScreen.show();
		this.screenGui.Enabled = true;
		this.dimOverlay.Visible = true;
		this.phoneFrame.Visible = true;

		// Animasi slide-in mulus dari sisi kanan layar
		this.slideTween?.Cancel();
		this.slideTween = TweenService.Create(
			this.phoneFrame,
			new TweenInfo(0.38, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
			{ Position: new UDim2(1, -36, 0.5, 0) },
		);
		this.slideTween.Play();

		for (const cb of this.openCallbacks) {
			cb();
		}
	}

	public close(): void {
		this.isPhoneOpen = false;
		this.notificationBanner.forceHide();
		this.dimOverlay.Visible = false;

		// Animasi slide-out mulus ke sisi kanan layar
		this.slideTween?.Cancel();
		this.slideTween = TweenService.Create(
			this.phoneFrame,
			new TweenInfo(0.28, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
			{ Position: new UDim2(1, 420, 0.5, 0) },
		);

		this.slideTween.Completed.Connect((status) => {
			if (status === Enum.PlaybackState.Completed && !this.isPhoneOpen) {
				this.screenGui.Enabled = false;
				this.phoneFrame.Visible = false;
				this.lockScreen.hide();
				this.lockContainer.Visible = false;
				this.homeScreen.hide();
				this.homeContainer.Visible = false;
				this.appRouter.hideAll();
				this.appContainer.Visible = false;
			}
		});

		this.slideTween.Play();

		for (const cb of this.closeCallbacks) {
			cb();
		}
	}

	public isOpen(): boolean {
		return this.isPhoneOpen;
	}

	public onOpen(cb: () => void): void {
		this.openCallbacks.push(cb);
	}

	public onClose(cb: () => void): void {
		this.closeCallbacks.push(cb);
	}

	public getHomeScreen(): HomeScreenView {
		return this.homeScreen;
	}

	public getLockScreen(): LockScreenView {
		return this.lockScreen;
	}

	public getAppRouter(): AppRouter {
		return this.appRouter;
	}

	public getNotificationBanner(): NotificationBannerView {
		return this.notificationBanner;
	}

	public getDynamicIsland(): ExternalDynamicIslandView {
		return GlobalNotificationService.getInstance().getExternalView();
	}

	public destroy(): void {
		this.isDestroyed = true;
		this.slideTween?.Cancel();
		GlobalNotificationService.getInstance().unregisterInternalBanner();
		this.notificationBanner.destroy();
		this.lockScreen.destroy();
		this.homeScreen.destroy();
		this.appRouter.destroy();
		this.phoneFrame.Destroy();
		this.dimOverlay.Destroy();
		this.screenGui.Destroy();
	}
}
