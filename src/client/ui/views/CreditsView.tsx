import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import {
	ContentProvider,
	GuiService,
	Players,
	RunService,
	SoundService,
	UserInputService,
	Workspace,
} from "@rbxts/services";
import { Fonts } from "../Typography";

export const DEFAULT_CREDITS_BANNER = "rbxassetid://134317644021810";
export const DEFAULT_CREDITS_LOGO = "rbxassetid://79461853534630";
// Decal 133008767434387 -> Texture Image Asset ID: 111047265380104
export const DEFAULT_CREDITS_TITLE_IMAGE = "rbxassetid://111047265380104";
export const DEFAULT_CREDITS_HOVER_SOUND = "rbxassetid://720166642";

export interface CreditSection {
	category: string;
	names: string[];
}

export const DEFAULT_CREDITS_DATA: CreditSection[] = [
	{
		category: "DEVELOPED BY",
		names: ["TRASH WORLD DIVISION"],
	},
	{
		category: "EXECUTIVE DIRECTION & VISION",
		names: ['FLEUR "FLEE" FLEURIZZE'],
	},
	{
		category: "SPECIAL THANKS FOR OUR PARTNER",
		names: ["A-MOOP!", "PEMUDA PANCASILA ROBLOX", "ON THE GROUND"],
	},
];

export interface CreditsViewProps {
	isOpen: boolean;
	onClose: () => void;
	creditsData?: CreditSection[];
	bannerAssetId?: string;
	logoAssetId?: string;
	titleImageAssetId?: string;
}

export function CreditsViewComponent({
	isOpen,
	onClose,
	creditsData = DEFAULT_CREDITS_DATA,
	bannerAssetId = DEFAULT_CREDITS_BANNER,
	logoAssetId = DEFAULT_CREDITS_LOGO,
	titleImageAssetId = DEFAULT_CREDITS_TITLE_IMAGE,
}: CreditsViewProps) {
	const [isBackHovered, setIsBackHovered] = useState(false);
	const [isRollHovered, setIsRollHovered] = useState(false);

	const [viewportSize, setViewportSize] = useState(() => {
		const camera = Workspace.CurrentCamera;
		return camera ? camera.ViewportSize : new Vector2(1920, 1080);
	});
	const [safeInset, setSafeInset] = useState(() => {
		const [topLeft] = GuiService.GetGuiInset();
		return topLeft;
	});

	const hoverSoundRef = useRef<Sound>();
	const lastHoverSoundTimeRef = useRef<number>(0);

	// Refs untuk animasi 60 FPS Infinite Continuous Roll
	const trackRef = useRef<Frame>();
	const set1Ref = useRef<Frame>();
	const set2Ref = useRef<Frame>();
	const currentOffsetRef = useRef<number>(0);
	const setHeightRef = useRef<number>(0);
	const isHoveredRef = useRef<boolean>(false);
	isHoveredRef.current = isRollHovered;

	// Update bounds reaktif
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

	// Sistem 3-Pilar Responsif: Base scale dihitung proporsional dari tinggi layar 760p
	const uiScale = math.clamp(viewportSize.Y / 760, 0.46, 1.15);
	const safeRight = math.max(48, safeInset.X + 32);
	const safeTop = math.max(24, safeInset.Y + 16);

	// Preload asset gambar
	useEffect(() => {
		const assetsToPreload: Instance[] = [];
		const bannerImg = new Instance("ImageLabel");
		bannerImg.Image = bannerAssetId;
		assetsToPreload.push(bannerImg);

		const logoImg = new Instance("ImageLabel");
		logoImg.Image = logoAssetId;
		assetsToPreload.push(logoImg);

		const titleImg = new Instance("ImageLabel");
		titleImg.Image = titleImageAssetId;
		assetsToPreload.push(titleImg);

		task.spawn(() => {
			pcall(() => {
				ContentProvider.PreloadAsync(assetsToPreload);
			});
		});
	}, [bannerAssetId, logoAssetId, titleImageAssetId]);

	// Inisialisasi Audio SFX Hover
	useEffect(() => {
		const sound = new Instance("Sound");
		sound.Name = "CreditsMenuHoverSound";
		sound.SoundId = DEFAULT_CREDITS_HOVER_SOUND;
		sound.Volume = 0.5;
		sound.Parent = SoundService;
		hoverSoundRef.current = sound;

		return () => {
			sound.Destroy();
		};
	}, []);

	const playSound = (pitch = 1.0) => {
		const now = os.clock();
		if (now - lastHoverSoundTimeRef.current < 0.06) return;
		lastHoverSoundTimeRef.current = now;

		const sound = hoverSoundRef.current;
		if (sound) {
			sound.PlaybackSpeed = pitch;
			sound.Play();
		}
	};

	const handleBack = () => {
		playSound(1.35);
		onClose();
	};

	// Keyboard Shortcut: ESC untuk kembali
	useEffect(() => {
		if (!isOpen) return;

		const inputConn = UserInputService.InputBegan.Connect((input) => {
			if (UserInputService.GetFocusedTextBox() !== undefined) return;
			if (input.KeyCode === Enum.KeyCode.Escape) {
				handleBack();
			}
		});

		return () => {
			inputConn.Disconnect();
		};
	}, [isOpen, onClose]);

	// Hitung jarak loop fisik (Set 1 ke Set 2) secara akurat & bebas distorsi UIScale
	useEffect(() => {
		const s1 = set1Ref.current;
		const s2 = set2Ref.current;
		if (!s1 || !s2) return;

		const updateLoopDistance = () => {
			const s1Pos = s1.AbsolutePosition.Y;
			const s2Pos = s2.AbsolutePosition.Y;
			const distScreen = s2Pos - s1Pos;

			if (distScreen > 0 && uiScale > 0) {
				// Konversi ke koordinat lokal container UDim2 (unscaled)
				setHeightRef.current = distScreen / uiScale;
			}
		};

		updateLoopDistance();
		const conn1 = s1.GetPropertyChangedSignal("AbsolutePosition").Connect(updateLoopDistance);
		const conn2 = s2.GetPropertyChangedSignal("AbsolutePosition").Connect(updateLoopDistance);
		const conn3 = s1.GetPropertyChangedSignal("AbsoluteSize").Connect(updateLoopDistance);

		return () => {
			conn1.Disconnect();
			conn2.Disconnect();
			conn3.Disconnect();
		};
	}, [isOpen, creditsData, uiScale]);

	// ─── 60 FPS Continuous Infinite Roll Engine (Zero React Re-render overhead) ───
	useEffect(() => {
		if (!isOpen) return;

		const SCROLL_SPEED = 42; // Laju pergerakan piksel per detik yang stabil dan terbaca nyaman

		const renderConn = RunService.RenderStepped.Connect((dt) => {
			// Berhenti saat mouse kursor hover atau disentuh
			if (isHoveredRef.current) return;

			const setHeight = setHeightRef.current;
			if (setHeight <= 0) return;

			const clampedDt = math.clamp(dt, 0, 0.05);
			currentOffsetRef.current = (currentOffsetRef.current + SCROLL_SPEED * clampedDt) % setHeight;

			if (trackRef.current) {
				trackRef.current.Position = new UDim2(0, 0, 0, -currentOffsetRef.current);
			}
		});

		return () => {
			renderConn.Disconnect();
		};
	}, [isOpen]);

	if (!isOpen) {
		return <></>;
	}

	const renderCreditsSet = (keyPrefix: string, setRef?: React.Ref<Frame>) => {
		return (
			<frame
				ref={setRef}
				key={keyPrefix}
				Size={new UDim2(1, 0, 0, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
				BorderSizePixel={0}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, 48)}
				/>

				{creditsData.map((section, idx) => (
					<frame
						key={`${keyPrefix}_section_${idx}`}
						LayoutOrder={idx}
						Size={new UDim2(1, 0, 0, 0)}
						AutomaticSize={Enum.AutomaticSize.Y}
						BackgroundTransparency={1}
						BorderSizePixel={0}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Vertical}
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							SortOrder={Enum.SortOrder.LayoutOrder}
							Padding={new UDim(0, 10)}
						/>

						{/* Role / Kategori Header */}
						<textlabel
							LayoutOrder={1}
							Size={new UDim2(1, -20, 0, 18)}
							BackgroundTransparency={1}
							Text={section.category}
							Font={Fonts.Bold}
							TextSize={12}
							TextColor3={Color3.fromRGB(163, 163, 163)}
							TextTransparency={0.15}
							TextXAlignment={Enum.TextXAlignment.Center}
							TextYAlignment={Enum.TextYAlignment.Center}
						/>

						{/* Daftar Nama Kontributor */}
						<frame
							LayoutOrder={2}
							Size={new UDim2(1, 0, 0, 0)}
							AutomaticSize={Enum.AutomaticSize.Y}
							BackgroundTransparency={1}
							BorderSizePixel={0}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Vertical}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								SortOrder={Enum.SortOrder.LayoutOrder}
								Padding={new UDim(0, 8)}
							/>

							{section.names.map((name, nameIdx) => (
								<textlabel
									key={`name_${nameIdx}`}
									LayoutOrder={nameIdx}
									Size={new UDim2(1, -20, 0, 24)}
									BackgroundTransparency={1}
									Text={name}
									Font={Fonts.Bold}
									TextSize={19}
									TextColor3={Color3.fromRGB(255, 255, 255)}
									TextXAlignment={Enum.TextXAlignment.Center}
									TextYAlignment={Enum.TextYAlignment.Center}
								/>
							))}
						</frame>
					</frame>
				))}
			</frame>
		);
	};

	return (
		<frame
			key="CreditsViewportContainer"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={Color3.fromRGB(14, 14, 14)}
			BackgroundTransparency={0}
			BorderSizePixel={0}
			Active={true}
			ZIndex={1}
		>
			{/* ─── PILAR 1: FULL-BLEED BACKGROUND ARTWORK & SHADING ─── */}
			<frame
				key="BackgroundArtworkWrapper"
				Position={new UDim2(0, 0, 0, 0)}
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ClipsDescendants={true}
				ZIndex={2}
			>
				{/* Banner Artwork Redup Monokrom */}
				<imagelabel
					key="BannerArtwork"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(1.08, 0, 1.08, 0)}
					Image={bannerAssetId}
					ImageColor3={Color3.fromRGB(140, 140, 140)}
					ScaleType={Enum.ScaleType.Crop}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ZIndex={2}
				/>

				{/* Lapisan Shading Gelap 65% Hitam */}
				<frame
					key="BackdropShade"
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={Color3.fromRGB(14, 14, 14)}
					BackgroundTransparency={0.3}
					BorderSizePixel={0}
					ZIndex={3}
				/>

				{/* Horizontal Vignette Shadow */}
				<frame
					key="HorizontalShadowOverlay"
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={Color3.fromRGB(14, 14, 14)}
					BorderSizePixel={0}
					ZIndex={4}
				>
					<uigradient
						Color={new ColorSequence(Color3.fromRGB(14, 14, 14))}
						Transparency={
							new NumberSequence([
								new NumberSequenceKeypoint(0, 0.15),
								new NumberSequenceKeypoint(0.5, 0.45),
								new NumberSequenceKeypoint(1, 0.15),
							])
						}
					/>
				</frame>
			</frame>

			{/* ─── PILAR 2: FOREGROUND KONTEN TERPUSAT (HEADER + ROLLING CREDITS) ─── */}
			<frame
				key="CreditsForegroundContainer"
				Position={new UDim2(0.5, 0, 0.5, 0)}
				AnchorPoint={new Vector2(0.5, 0.5)}
				Size={new UDim2(0, 840, 0, 680)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ZIndex={10}
			>
				<uiscale Scale={uiScale} />

				{/* HEADER: LOGO UNDERGRID + GAMBAR JUDUL CREDITS */}
				<frame
					key="CreditsHeader"
					Position={new UDim2(0.5, 0, 0, 12)}
					AnchorPoint={new Vector2(0.5, 0)}
					Size={new UDim2(1, 0, 0, 140)}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ZIndex={11}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
						Padding={new UDim(0, 12)}
					/>

					{/* Logo Under Grid Subculture */}
					<imagelabel
						key="UndergridLogo"
						LayoutOrder={1}
						Size={new UDim2(0, 260, 0, 52)}
						Image={logoAssetId}
						ScaleType={Enum.ScaleType.Fit}
						BackgroundTransparency={1}
						BorderSizePixel={0}
						ZIndex={12}
					/>

					{/* Gambar Judul Credits (Aset Id: 133008767434387) */}
					<imagelabel
						key="CreditsTitleImage"
						LayoutOrder={2}
						Size={new UDim2(0, 220, 0, 52)}
						Image={titleImageAssetId}
						ScaleType={Enum.ScaleType.Fit}
						BackgroundTransparency={1}
						BorderSizePixel={0}
						ZIndex={12}
					/>
				</frame>

				{/* CENTRAL VIEWPORT: INFINITE CONTINUOUS VERTICAL CREDITS ROLL */}
				<frame
					key="CreditsRollViewport"
					Position={new UDim2(0.5, 0, 0, 175)}
					AnchorPoint={new Vector2(0.5, 0)}
					Size={new UDim2(1, 0, 0, 440)}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ClipsDescendants={true}
					Active={true}
					ZIndex={15}
					Event={{
						MouseEnter: () => {
							setIsRollHovered(true);
						},
						MouseLeave: () => {
							setIsRollHovered(false);
						},
					}}
				>
					{/* Jalur Teks Berputar (Moving Track) */}
					<frame
						ref={trackRef}
						key="CreditsMovingTrack"
						Position={new UDim2(0, 0, 0, 0)}
						Size={new UDim2(1, 0, 0, 0)}
						AutomaticSize={Enum.AutomaticSize.Y}
						BackgroundTransparency={1}
						BorderSizePixel={0}
						ZIndex={16}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Vertical}
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							SortOrder={Enum.SortOrder.LayoutOrder}
							Padding={new UDim(0, 64)}
						/>

						{/* Set 1: Primer */}
						{renderCreditsSet("Set1", set1Ref)}

						{/* Set 2: Identik untuk referensi titik sambung loop */}
						{renderCreditsSet("Set2", set2Ref)}

						{/* Set 3: Identik untuk menjamin viewport selalu tertutup penuh tanpa jeda/pop-in */}
						{renderCreditsSet("Set3")}
					</frame>

					{/* ─── GRADIENT VIGNETTE FADES (TOP & BOTTOM) ─── */}
					{/* Top Vignette Fade */}
					<frame
						key="TopVignetteFade"
						Position={new UDim2(0, 0, 0, 0)}
						Size={new UDim2(1, 0, 0, 80)}
						BackgroundColor3={Color3.fromRGB(14, 14, 14)}
						BorderSizePixel={0}
						ZIndex={20}
					>
						<uigradient
							Rotation={90}
							Transparency={
								new NumberSequence([
									new NumberSequenceKeypoint(0, 0),
									new NumberSequenceKeypoint(0.7, 0.4),
									new NumberSequenceKeypoint(1, 1),
								])
							}
						/>
					</frame>

					{/* Bottom Vignette Fade */}
					<frame
						key="BottomVignetteFade"
						Position={new UDim2(0, 0, 1, -80)}
						Size={new UDim2(1, 0, 0, 80)}
						BackgroundColor3={Color3.fromRGB(14, 14, 14)}
						BorderSizePixel={0}
						ZIndex={20}
					>
						<uigradient
							Rotation={-90}
							Transparency={
								new NumberSequence([
									new NumberSequenceKeypoint(0, 0),
									new NumberSequenceKeypoint(0.7, 0.4),
									new NumberSequenceKeypoint(1, 1),
								])
							}
						/>
					</frame>
				</frame>
			</frame>

			{/* ─── PILAR 3: FOOTER NAVIGASI (TOMBOL BACK KANAN BAWAH) ─── */}
			<frame
				key="CreditsFooterContainer"
				Position={new UDim2(1, -safeRight, 1, -38)}
				AnchorPoint={new Vector2(1, 1)}
				Size={new UDim2(0, 92, 0, 32)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ZIndex={30}
			>
				<uiscale Scale={uiScale} />

				{/* Tombol BACK Putih Monokrom Industri */}
				<textbutton
					key="BackButton"
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={
						isBackHovered ? Color3.fromRGB(220, 220, 220) : Color3.fromRGB(255, 255, 255)
					}
					BorderSizePixel={0}
					AutoButtonColor={false}
					Text=""
					ZIndex={31}
					Event={{
						MouseEnter: () => setIsBackHovered(true),
						MouseLeave: () => setIsBackHovered(false),
						Activated: handleBack,
					}}
				>
					<uistroke
						ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
						LineJoinMode={Enum.LineJoinMode.Miter}
						Color={Color3.fromRGB(255, 255, 255)}
						Thickness={1}
					/>
					<textlabel
						Position={new UDim2(0.5, 0, 0.5, 0)}
						AnchorPoint={new Vector2(0.5, 0.5)}
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundTransparency={1}
						Text="BACK"
						Font={Fonts.Bold}
						TextSize={11}
						TextColor3={Color3.fromRGB(0, 0, 0)}
						ZIndex={32}
					/>
				</textbutton>
			</frame>
		</frame>
	);
}

/**
 * Class Adapter Pattern untuk CreditsView (OOP).
 */
export class CreditsView {
	private static instance?: CreditsView;
	private root: Root;
	private screenGui?: ScreenGui;
	private _isOpen = false;
	private closeCallbacks: Array<() => void> = [];

	public constructor(targetParent?: Instance) {
		const isGuiObject = targetParent && targetParent.IsA("GuiObject");
		const container =
			targetParent ?? (RunService.IsRunning() ? Players.LocalPlayer?.WaitForChild("PlayerGui") : undefined);

		if (!isGuiObject && container) {
			const gui = new Instance("ScreenGui");
			gui.Name = "CreditsGui";
			gui.ResetOnSpawn = false;
			gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			gui.DisplayOrder = 925;
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

	public static getInstance(target?: Instance): CreditsView {
		if (!CreditsView.instance) {
			CreditsView.instance = new CreditsView(target);
		}
		return CreditsView.instance;
	}

	private render(): void {
		this.root.render(
			<CreditsViewComponent
				isOpen={this._isOpen}
				onClose={() => {
					this.hide();
					for (const cb of this.closeCallbacks) {
						cb();
					}
				}}
			/>,
		);
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

	public toggle(): void {
		if (this._isOpen) {
			this.hide();
		} else {
			this.show();
		}
	}

	public onClose(callback: () => void): () => void {
		this.closeCallbacks.push(callback);
		return () => {
			this.closeCallbacks = this.closeCallbacks.filter((cb) => cb !== callback);
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
		if (CreditsView.instance === this) {
			CreditsView.instance = undefined;
		}
	}
}
