import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import {
	ContentProvider,
	GuiService,
	Players,
	RunService,
	SoundService,
	TweenService,
	UserInputService,
	Workspace,
} from "@rbxts/services";
import { CreditsView } from "./CreditsView";
import { GraphicsPresetView } from "./GraphicsPresetView";
import { SettingsModalView } from "./SettingsModalView";

export const DEFAULT_MAIN_MENU_BANNER = "rbxassetid://134317644021810";
export const DEFAULT_MAIN_MENU_LOGO = "rbxassetid://79461853534630";
export const DEFAULT_MENU_HOVER_SOUND = "rbxassetid://720166642";

export const DEFAULT_MENU_IMAGES = {
	START: "rbxassetid://113663983314793",
	GRAPHICS: "rbxassetid://94261985543026",
	CREDITS: "rbxassetid://83171502612200",
} as const;

export interface MainMenuProps {
	isOpen: boolean;
	bannerAssetId?: string;
	logoAssetId?: string;
	onStart?: () => void;
	onGraphics?: () => void;
	onCredits?: () => void;
	onTransitionComplete?: () => void;
}

interface MenuItemData {
	id: string;
	title: string;
	imageAssetId: string;
	width: number;
}

const MENU_ITEMS: MenuItemData[] = [
	{ id: "start", title: "Start", imageAssetId: DEFAULT_MENU_IMAGES.START, width: 225 },
	{ id: "graphics", title: "Graphics", imageAssetId: DEFAULT_MENU_IMAGES.GRAPHICS, width: 225 },
	{ id: "credits", title: "Credits", imageAssetId: DEFAULT_MENU_IMAGES.CREDITS, width: 225 },
];

/**
 * Main Menu View strictly matching the 16:9 widescreen HTML template.
 * Features:
 * - Full high-res 16:9 background banner (rbxassetid://134317644021810)
 * - Left gradient shadow overlay (from-black via-black/85 to-transparent w-7/12)
 * - Top & bottom vignette gradient overlays
 * - High-contrast game title/logo (rbxassetid://79461853534630) pinned tightly to the left margin
 * - Authentic exported Figma PNG typography for Start, Graphics, Credits
 * - Sliding pure white solid diamond indicator
 * - Full mouse hover, click, and W/S/Arrow/Enter keyboard navigation
 */
export function MainMenuComponent({
	isOpen,
	bannerAssetId = DEFAULT_MAIN_MENU_BANNER,
	logoAssetId = DEFAULT_MAIN_MENU_LOGO,
	onStart,
	onGraphics,
	onCredits,
	onTransitionComplete,
}: MainMenuProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isStarting, setIsStarting] = useState(false);

	const [viewportSize, setViewportSize] = useState(() => {
		const camera = Workspace.CurrentCamera;
		return camera ? camera.ViewportSize : new Vector2(1920, 1080);
	});
	const [safeInset, setSafeInset] = useState(() => {
		const [topLeft] = GuiService.GetGuiInset();
		return topLeft;
	});

	// Reset state jika menu dibuka kembali
	useEffect(() => {
		if (!isOpen) {
			setIsStarting(false);
		}
	}, [isOpen]);

	// Reaktif terhadap perubahan orientasi perangkat & ukuran viewport
	useEffect(() => {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		const updateBounds = () => {
			setViewportSize(camera.ViewportSize);
			const [topLeft] = GuiService.GetGuiInset();
			setSafeInset(topLeft);
		};

		const vpConn = camera.GetPropertyChangedSignal("ViewportSize").Connect(updateBounds);

		return () => {
			vpConn.Disconnect();
		};
	}, []);

	// Skala responsif dinamis dihitung proporsional dari tinggi layar (Base reference: 760p):
	// - PC 1080p: ~1.15x
	// - Tablet 768p: ~0.95x
	// - Mobile 375p: ~0.49x
	const uiScale = math.clamp(viewportSize.Y / 760, 0.46, 1.15);
	// Safe horizontal left margin (menghindari notch / cut-out di sisi kiri HP)
	const safeLeft = math.max(48, safeInset.X + 24);

	const bannerRef = useRef<ImageLabel>();
	const hoverSoundRef = useRef<Sound>();
	const curtainRef = useRef<Frame>();
	const contentWrapperRef = useRef<Frame>();
	const selectedIndexRef = useRef(selectedIndex);
	selectedIndexRef.current = selectedIndex;

	const ITEM_HEIGHT = 52;
	const ITEM_GAP = 16;

	// Animasi Dynamic Ambient Drift + Smooth Mouse Parallax (Speed diperlambat & super halus)
	useEffect(() => {
		if (!isOpen || isStarting) return;
		const banner = bannerRef.current;
		if (!banner) return;

		let currentOffsetX = 0;
		let currentOffsetY = 0;
		let elapsed = 0;

		const renderConn = RunService.RenderStepped.Connect((dt) => {
			elapsed += dt;

			// 1. Interactive Mouse Parallax Tracking (Subtle & berat)
			const mousePos = UserInputService.GetMouseLocation();
			const camera = Workspace.CurrentCamera;
			const vp = camera ? camera.ViewportSize : new Vector2(1920, 1080);
			const normX = (mousePos.X / math.max(1, vp.X) - 0.5) * 2; // Range: -1 s/d 1
			const normY = (mousePos.Y / math.max(1, vp.Y) - 0.5) * 2; // Range: -1 s/d 1

			// Target parallax offset: jangkauan diperkecil (maks 8px horizontal, 5px vertikal)
			const targetOffsetX = -normX * 8;
			const targetOffsetY = -normY * 5;

			// Heavy exponential lerp damping (dt * 1.5): sangat halus, lambat & tidak twitchy/getar
			currentOffsetX += (targetOffsetX - currentOffsetX) * math.clamp(dt * 1.5, 0, 1);
			currentOffsetY += (targetOffsetY - currentOffsetY) * math.clamp(dt * 1.5, 0, 1);

			// 2. Ultra-Slow Ambient Float (Siklus lambat ~28 detik)
			const ambientX = math.sin(elapsed * 0.22) * 7;
			const ambientY = math.cos(elapsed * 0.16) * 4;

			// Gabungkan ambient motion + mouse parallax
			const totalX = currentOffsetX + ambientX;
			const totalY = currentOffsetY + ambientY;

			banner.Position = new UDim2(0.5, totalX, 0.5, totalY);
		});

		return () => {
			renderConn.Disconnect();
		};
	}, [isOpen, isStarting]);

	// Inisialisasi dan lifecycle cleanup audio sound effect hover
	useEffect(() => {
		const sound = new Instance("Sound");
		sound.Name = "MenuHoverSound";
		sound.SoundId = DEFAULT_MENU_HOVER_SOUND;
		sound.Volume = 0.5;
		sound.Parent = SoundService;
		hoverSoundRef.current = sound;

		return () => {
			sound.Destroy();
		};
	}, []);

	const playHoverSound = () => {
		const sound = hoverSoundRef.current;
		if (sound) {
			SoundService.PlayLocalSound(sound);
		}
	};

	const playStartSound = () => {
		const sound = new Instance("Sound");
		sound.Name = "MenuConfirmSound";
		sound.SoundId = DEFAULT_MENU_HOVER_SOUND;
		sound.PlaybackSpeed = 1.35;
		sound.Volume = 0.85;
		sound.Parent = SoundService;
		SoundService.PlayLocalSound(sound);
		task.delay(1, () => sound.Destroy());
	};

	// Preload seluruh aset gambar dan audio menu
	useEffect(() => {
		if (!isOpen) return;

		task.spawn(() => {
			pcall(() => {
				ContentProvider.PreloadAsync([
					bannerAssetId,
					logoAssetId,
					DEFAULT_MENU_IMAGES.START,
					DEFAULT_MENU_IMAGES.GRAPHICS,
					DEFAULT_MENU_IMAGES.CREDITS,
					DEFAULT_MENU_HOVER_SOUND,
				]);
			});
		});
	}, [isOpen, bannerAssetId, logoAssetId]);

	const handleAction = (index: number) => {
		if (isStarting) return;
		const item = MENU_ITEMS[index];
		if (!item) return;

		if (item.id === "start") {
			setIsStarting(true);
			playStartSound();
		} else if (item.id === "graphics") {
			if (onGraphics) {
				onGraphics();
			} else {
				const presetView = GraphicsPresetView.getInstance();
				MainMenuView.getInstance().hide();
				presetView.show();
				presetView.onClose(() => {
					MainMenuView.getInstance().show();
				});
			}
		} else if (item.id === "credits") {
			if (onCredits) {
				onCredits();
			} else {
				const creditsView = CreditsView.getInstance();
				MainMenuView.getInstance().hide();
				creditsView.show();
				creditsView.onClose(() => {
					MainMenuView.getInstance().show();
				});
			}
		}
	};

	// Animasi Transisi Sinematik Swipe ke Kanan saat pemain klik "Start"
	useEffect(() => {
		if (!isStarting) return;

		const curtain = curtainRef.current;
		const contentWrapper = contentWrapperRef.current;
		if (!curtain) return;

		// 1. Posisikan tirai tepat di luar sisi kiri layar dan jadikan Visible
		curtain.Position = new UDim2(-1.08, -60, 0, 0);
		curtain.Visible = true;

		// 2. Berikan dorongan fisik sedikit ke kanan pada menu content untuk momentum visual
		if (contentWrapper) {
			const contentTween = TweenService.Create(
				contentWrapper,
				new TweenInfo(0.70, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out),
				{
					Position: new UDim2(0, 90, 0, 0),
				},
			);
			contentTween.Play();
		}

		// 3. FASE 1: Swipe-in menyapu layar dari kiri ke kanan (Cubic InOut, 0.70 detik - anggun, smooth, dan jelas)
		const wipeInTween = TweenService.Create(
			curtain,
			new TweenInfo(0.70, Enum.EasingStyle.Cubic, Enum.EasingDirection.InOut),
			{
				Position: new UDim2(0, 0, 0, 0),
			},
		);

		const conn = wipeInTween.Completed.Connect((playbackState) => {
			if (playbackState !== Enum.PlaybackState.Completed) return;

			// Layar sekarang 100% tertutup tirai hitam gelap!
			// Sembunyikan layer konten menu di balik tirai
			if (contentWrapper) {
				contentWrapper.Visible = false;
			}

			// Panggil onStart() agar kamera 3D & SpawnCinematicController langsung aktif di balik tirai
			onStart?.();

			// Jeda dramatis (0.18s) di balik layar gelap agar transisi terasa berbobot
			task.delay(0.18, () => {
				// 4. FASE 2: Swipe-out meluncur ke arah kanan membuka pemandangan 3D (Cubic InOut, 0.75 detik)
				const wipeOutTween = TweenService.Create(
					curtain,
					new TweenInfo(0.75, Enum.EasingStyle.Cubic, Enum.EasingDirection.InOut),
					{
						Position: new UDim2(1.08, 60, 0, 0),
					},
				);

				wipeOutTween.Completed.Connect((status) => {
					if (status === Enum.PlaybackState.Completed) {
						curtain.Visible = false;
						// Selesai seluruh transisi: beritahu adapter untuk unmount / hide MainMenuView
						onTransitionComplete?.();
					}
				});

				wipeOutTween.Play();
			});
		});

		wipeInTween.Play();

		return () => {
			conn.Disconnect();
		};
	}, [isStarting]);

	// Keyboard navigation: W / S / Up / Down / Enter / Space
	useEffect(() => {
		if (!isOpen || isStarting) return;

		const inputConn = UserInputService.InputBegan.Connect((input) => {
			if (UserInputService.GetFocusedTextBox() !== undefined) return;

			if (input.KeyCode === Enum.KeyCode.W || input.KeyCode === Enum.KeyCode.Up) {
				setSelectedIndex((prev) => {
					playHoverSound();
					return (prev - 1 + MENU_ITEMS.size()) % MENU_ITEMS.size();
				});
			} else if (input.KeyCode === Enum.KeyCode.S || input.KeyCode === Enum.KeyCode.Down) {
				setSelectedIndex((prev) => {
					playHoverSound();
					return (prev + 1) % MENU_ITEMS.size();
				});
			} else if (input.KeyCode === Enum.KeyCode.Return || input.KeyCode === Enum.KeyCode.Space) {
				handleAction(selectedIndexRef.current);
			}
		});

		return () => {
			inputConn.Disconnect();
		};
	}, [isOpen, isStarting]);

	if (!isOpen) {
		return <></>;
	}

	return (
		<frame
			key="MainMenuViewportContainer"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={Color3.fromRGB(0, 0, 0)}
			BackgroundTransparency={1}
			BorderSizePixel={0}
			Active={!isStarting}
			ClipsDescendants={true}
			ZIndex={1}
		>
			{/* ─── WRAPPER UTAMA KONTEN MENU (Ikut bergeser sedikit ke kanan saat transisi swipe) ─── */}
			<frame
				ref={contentWrapperRef}
				key="MainMenuContentWrapper"
				Position={new UDim2(0, 0, 0, 0)}
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundColor3={Color3.fromRGB(0, 0, 0)}
				BackgroundTransparency={0}
				BorderSizePixel={0}
				ZIndex={2}
			>
				{/* ─── LAYER 1: FULL-BLEED BACKGROUND ARTWORK & GRADIENT OVERLAYS (Edge-to-Edge pada SEMUA Device) ─── */}
				<frame
				key="BackgroundArtworkWrapper"
				Position={new UDim2(0, 0, 0, 0)}
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ClipsDescendants={true}
				ZIndex={2}
			>
				{/* Full-bleed visual artwork banner dengan dynamic ambient float & smooth parallax */}
				<imagelabel
					ref={bannerRef}
					key="BannerArtwork"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(1.08, 0, 1.08, 0)}
					Image={bannerAssetId}
					ScaleType={Enum.ScaleType.Crop}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ZIndex={2}
				/>

				{/* Left gradient shadow overlay for crisp readability (w-7/12 = 58.3%) */}
				<frame
					key="LeftGradientOverlay"
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(0.58, 0, 1, 0)}
					BackgroundColor3={Color3.fromRGB(0, 0, 0)}
					BorderSizePixel={0}
					ZIndex={3}
				>
					<uigradient
						Color={new ColorSequence(Color3.fromRGB(0, 0, 0))}
						Transparency={
							new NumberSequence([
								new NumberSequenceKeypoint(0, 0),
								new NumberSequenceKeypoint(0.42, 0.1),
								new NumberSequenceKeypoint(0.72, 0.45),
								new NumberSequenceKeypoint(1, 1),
							])
						}
					/>
				</frame>

				{/* Full-bleed Vertical Vignette Overlay (Persis HTML: inset-0 from-black/80 via-transparent to-black/40) */}
				<frame
					key="VerticalVignetteOverlay"
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={Color3.fromRGB(0, 0, 0)}
					BorderSizePixel={0}
					ZIndex={3}
				>
					<uigradient
						Color={new ColorSequence(Color3.fromRGB(0, 0, 0))}
						Rotation={90}
						Transparency={
							new NumberSequence([
								new NumberSequenceKeypoint(0, 0.45),
								new NumberSequenceKeypoint(0.25, 0.9),
								new NumberSequenceKeypoint(0.5, 1.0),
								new NumberSequenceKeypoint(0.75, 0.8),
								new NumberSequenceKeypoint(1, 0.2),
							])
						}
					/>
				</frame>
			</frame>

			{/* ─── LAYER 2: FOREGROUND INTERFACE (TITLE LOGO & NAVIGATION) ─── */}
			{/* Posisi aman terhadap notch/cut-out HP & Topbar Roblox, discale secara adaptif via UIScale */}
			<frame
				key="ForegroundInterface"
				AnchorPoint={new Vector2(0, 0.5)}
				Position={new UDim2(0, safeLeft, 0.5, 0)}
				Size={new UDim2(0, 380, 0, 450)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ZIndex={10}
			>
				{/* GPU Transform: Skala otomatis proporsional di PC, Tablet, dan Mobile */}
				<uiscale Scale={uiScale} />

				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					HorizontalAlignment={Enum.HorizontalAlignment.Left}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 30)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>

					{/* BEGIN: TitleLogo - Sejajar 100% vertikal dengan text menu */}
					<frame
						key="TitleLogoHeader"
						LayoutOrder={1}
						Size={new UDim2(0, 280, 0, 170)}
						BackgroundTransparency={1}
						BorderSizePixel={0}
						ZIndex={11}
					>
						<imagelabel
							key="UnderGridLogo"
							AnchorPoint={new Vector2(0, 0)}
							Position={new UDim2(0, 16, 0, 0)}
							Size={new UDim2(1, -16, 1, 0)}
							Image={logoAssetId}
							ScaleType={Enum.ScaleType.Fit}
							BackgroundTransparency={1}
							BorderSizePixel={0}
							ZIndex={12}
						/>
					</frame>

					{/* BEGIN: MainMenuNavigation - Sejajar di bawah logo */}
					<frame
						key="MainMenuNavigation"
						LayoutOrder={2}
						Size={new UDim2(1, 0, 0, 200)}
						BackgroundTransparency={1}
						BorderSizePixel={0}
						ZIndex={11}
					>
						{/* Menu Items List */}
						<frame
							key="MenuItemsList"
							Position={new UDim2(0, 0, 0, 0)}
							Size={new UDim2(1, 0, 1, 0)}
							BackgroundTransparency={1}
							BorderSizePixel={0}
							ZIndex={12}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Vertical}
								HorizontalAlignment={Enum.HorizontalAlignment.Left}
								VerticalAlignment={Enum.VerticalAlignment.Top}
								Padding={new UDim(0, ITEM_GAP)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>

							{MENU_ITEMS.map((item, index) => {
								const isSelected = index === selectedIndex;
								return (
									<textbutton
										key={item.id}
										LayoutOrder={index}
										Size={new UDim2(1, 0, 0, ITEM_HEIGHT)}
										BackgroundTransparency={1}
										BorderSizePixel={0}
										AutoButtonColor={false}
										Text=""
										ZIndex={13}
										Event={{
											MouseEnter: () => {
												if (isStarting) return;
												if (selectedIndex !== index) {
													playHoverSound();
													setSelectedIndex(index);
												}
											},
											Activated: () => {
												if (isStarting) return;
												handleAction(index);
											},
										}}
									>
										{/* Render tipografi grafis PNG seragam dari Figma (UnifrakturMaguntia) */}
										<imagelabel
											key="ItemImageLabel"
											AnchorPoint={new Vector2(0, 0.5)}
											Position={new UDim2(0, 16, 0.5, 0)}
											Size={new UDim2(0, item.width, 0, 48)}
											Image={item.imageAssetId}
											ImageColor3={
												isSelected ? Color3.fromRGB(255, 255, 255) : Color3.fromHex("#8a8a8a")
											}
											ScaleType={Enum.ScaleType.Fit}
											BackgroundTransparency={1}
											BorderSizePixel={0}
											ZIndex={14}
										/>
									</textbutton>
								);
							})}
						</frame>
					</frame>
				</frame>

			</frame>

			{/* ─── LAYER 3: CINEMATIC WIPE CURTAIN TRANSITION (Geser ke Kanan Menutupi & Membuka Layar) ─── */}
			<frame
				ref={curtainRef}
				key="SwipeCurtainWrapper"
				Position={new UDim2(-1.08, -60, 0, 0)}
				Size={new UDim2(1.08, 60, 1, 0)}
				BackgroundColor3={Color3.fromRGB(8, 8, 10)}
				BorderSizePixel={0}
				Visible={false}
				ZIndex={100}
			>
				{/* Leading Edge Accent Glow Line */}
				<frame
					key="LeadingEdgeGlow"
					AnchorPoint={new Vector2(1, 0)}
					Position={new UDim2(1, 0, 0, 0)}
					Size={new UDim2(0, 3, 1, 0)}
					BackgroundColor3={Color3.fromRGB(255, 255, 255)}
					BackgroundTransparency={0.3}
					BorderSizePixel={0}
					ZIndex={101}
				/>
				{/* Soft Edge Gradient Shadow */}
				<frame
					key="LeadingEdgeSoftFade"
					Position={new UDim2(1, 0, 0, 0)}
					Size={new UDim2(0, 60, 1, 0)}
					BackgroundColor3={Color3.fromRGB(8, 8, 10)}
					BorderSizePixel={0}
					ZIndex={100}
				>
					<uigradient
						Transparency={
							new NumberSequence([
								new NumberSequenceKeypoint(0, 0),
								new NumberSequenceKeypoint(1, 1),
							])
						}
					/>
				</frame>
			</frame>
		</frame>
	);
}

/**
 * Class Adapter Pattern untuk MainMenuView.
 */
export class MainMenuView {
	private static instance?: MainMenuView;
	private root: Root;
	private screenGui?: ScreenGui;
	private _isOpen = false;
	private startCallbacks: Array<() => void> = [];
	private bannerAssetId: string = DEFAULT_MAIN_MENU_BANNER;
	private logoAssetId: string = DEFAULT_MAIN_MENU_LOGO;

	public constructor(targetParent?: Instance) {
		const isGuiObject = targetParent && targetParent.IsA("GuiObject");
		const container =
			targetParent ?? (RunService.IsRunning() ? Players.LocalPlayer?.WaitForChild("PlayerGui") : undefined);

		if (!isGuiObject && container) {
			const gui = new Instance("ScreenGui");
			gui.Name = "CustomMainMenuGui";
			gui.ResetOnSpawn = false;
			gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			gui.DisplayOrder = 900;
			gui.IgnoreGuiInset = true;
			gui.ScreenInsets = Enum.ScreenInsets.None;
			gui.Enabled = false;
			gui.Parent = container;
			this.screenGui = gui;
			this.root = ReactRoblox.createRoot(gui);
		} else if (container) {
			this.root = ReactRoblox.createRoot(container);
		} else {
			const folder = new Instance("Folder");
			this.root = ReactRoblox.createRoot(folder);
		}

		this.render();
	}

	public static getInstance(target?: Instance): MainMenuView {
		if (!MainMenuView.instance) {
			MainMenuView.instance = new MainMenuView(target);
		}
		return MainMenuView.instance;
	}

	private render(): void {
		this.root.render(
			<MainMenuComponent
				isOpen={this._isOpen}
				bannerAssetId={this.bannerAssetId}
				logoAssetId={this.logoAssetId}
				onStart={() => {
					for (const cb of this.startCallbacks) {
						cb();
					}
				}}
				onTransitionComplete={() => {
					this.hide();
				}}
			/>,
		);
	}

	public setBannerAssetId(bannerId: string): void {
		this.bannerAssetId = bannerId;
		this.render();
	}

	public setLogoAssetId(logoId: string): void {
		this.logoAssetId = logoId;
		this.render();
	}

	public show(): void {
		if (this._isOpen) return;
		this._isOpen = true;
		if (this.screenGui) {
			this.screenGui.Enabled = true;
		}
		this.render();
	}

	public hide(): void {
		if (!this._isOpen) return;
		this._isOpen = false;
		if (this.screenGui) {
			this.screenGui.Enabled = false;
		}
		this.render();
	}

	public onStart(callback: () => void): () => void {
		this.startCallbacks.push(callback);
		return () => {
			this.startCallbacks = this.startCallbacks.filter((cb) => cb !== callback);
		};
	}

	public isVisible(): boolean {
		return this._isOpen;
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		if (MainMenuView.instance === this) {
			MainMenuView.instance = undefined;
		}
	}
}
