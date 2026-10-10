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
import { GraphicsPreset, GraphicsService } from "client/services/GraphicsService";
import { SpringPresets } from "../SpringConfig";
import { Fonts } from "../Typography";
import { usePressSpring } from "../hooks";

export const DEFAULT_GRAPHICS_BANNER = "rbxassetid://134317644021810";
export const DEFAULT_GRAPHICS_LOGO = "rbxassetid://79461853534630";
export const DEFAULT_GRAPHICS_HOVER_SOUND = "rbxassetid://720166642";

export const GRAPHICS_PRESET_IMAGES = {
	TITLE: "rbxassetid://107653035773388",
	LOW: "rbxassetid://127326521869740",
	MEDIUM: "rbxassetid://81425890155908",
	HIGH: "rbxassetid://89761934528840",
	ULTRA: "rbxassetid://133619992807845",
} as const;

interface PresetOption {
	id: GraphicsPreset;
	imageAssetId: string;
}

const PRESET_OPTIONS: PresetOption[] = [
	{ id: "Low", imageAssetId: GRAPHICS_PRESET_IMAGES.LOW },
	{ id: "Medium", imageAssetId: GRAPHICS_PRESET_IMAGES.MEDIUM },
	{ id: "High", imageAssetId: GRAPHICS_PRESET_IMAGES.HIGH },
	{ id: "Ultra", imageAssetId: GRAPHICS_PRESET_IMAGES.ULTRA },
];

interface PresetCardItemProps {
	preset: PresetOption;
	index: number;
	isSelected: boolean;
	isHovered: boolean;
	onHover: () => void;
	onUnhover: () => void;
	onSelect: () => void;
}

function PresetCardItem({
	preset,
	index,
	isSelected,
	isHovered,
	onHover,
	onUnhover,
	onSelect,
}: PresetCardItemProps) {
	const { scaleBinding: pressScale, eventHandlers } = usePressSpring({
		hoverScale: isSelected ? 1.03 : 1.02,
		pressScale: 0.97,
		springConfig: SpringPresets.snappy,
	});

	return (
		<frame
			key={`CardContainer_${preset.id}`}
			LayoutOrder={index}
			Size={new UDim2(0, 267, 0, 195)}
			BackgroundColor3={Color3.fromRGB(0, 0, 0)}
			BackgroundTransparency={isSelected ? 0.1 : 0.3}
			BorderSizePixel={0}
			ZIndex={12}
		>
			<uiscale Scale={pressScale} />

			{/* Border Stroke tegas dengan ApplyStrokeMode.Border */}
			<uistroke
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				LineJoinMode={Enum.LineJoinMode.Miter}
				Color={
					isSelected
						? Color3.fromRGB(255, 255, 255)
						: isHovered
							? Color3.fromHex("#999999")
							: Color3.fromHex("#585858")
				}
				Thickness={isSelected ? 2 : 1.5}
			/>

			{/* Floating Pill Badge: [ACTIVE PRESET] di atas border kartu aktif */}
			{isSelected && (
				<frame
					key="ActiveBadge"
					Position={new UDim2(0, 14, 0, -10)}
					Size={new UDim2(0, 96, 0, 20)}
					BackgroundColor3={Color3.fromRGB(255, 255, 255)}
					BorderSizePixel={0}
					ZIndex={15}
				>
					<textlabel
						Position={new UDim2(0.5, 0, 0.5, 0)}
						AnchorPoint={new Vector2(0.5, 0.5)}
						Size={new UDim2(1, -6, 1, 0)}
						BackgroundTransparency={1}
						Text="ACTIVE PRESET"
						Font={Fonts.Bold}
						TextSize={10}
						TextColor3={Color3.fromRGB(0, 0, 0)}
						ZIndex={16}
					/>
				</frame>
			)}

			{/* Tipografi Blackletter PNG: Ukuran Box Seragam (Tinggi 58px) agar semua font sama besar & tegas */}
			<imagelabel
				key="PresetNameImage"
				Position={new UDim2(0.5, 0, 0.5, 0)}
				AnchorPoint={new Vector2(0.5, 0.5)}
				Size={new UDim2(0, 210, 0, 58)}
				Image={preset.imageAssetId}
				ImageColor3={
					isSelected || isHovered
						? Color3.fromRGB(255, 255, 255)
						: Color3.fromHex("#8a8a8a")
				}
				ScaleType={Enum.ScaleType.Fit}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ZIndex={13}
			/>

			{/* Invisible Full-Area Click & Hover Handler with Spring Touch Feedback */}
			<textbutton
				key="ClickHandler"
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				AutoButtonColor={false}
				Text=""
				Active={true}
				ZIndex={14}
				Event={{
					MouseEnter: () => {
						eventHandlers.MouseEnter();
						onHover();
					},
					MouseLeave: () => {
						eventHandlers.MouseLeave();
						onUnhover();
					},
					MouseButton1Down: eventHandlers.MouseButton1Down,
					MouseButton1Up: eventHandlers.MouseButton1Up,
					Activated: onSelect,
				}}
			/>
		</frame>
	);
}

export interface GraphicsPresetProps {
	isOpen: boolean;
	onClose: () => void;
	onApply?: (preset: GraphicsPreset) => void;
}

export function GraphicsPresetComponent({ isOpen, onClose, onApply }: GraphicsPresetProps) {
	const graphicsService = GraphicsService.getInstance();
	const [activePreset, setActivePreset] = useState<GraphicsPreset>(graphicsService.getPreset());
	const [hoveredPreset, setHoveredPreset] = useState<GraphicsPreset | undefined>();
	const {
		scaleBinding: applyScale,
		isHovered: isApplyHovered,
		eventHandlers: applyHandlers,
	} = usePressSpring({
		hoverScale: 1.04,
		pressScale: 0.95,
		springConfig: SpringPresets.snappy,
	});

	const [viewportSize, setViewportSize] = useState(() => {
		const camera = Workspace.CurrentCamera;
		return camera ? camera.ViewportSize : new Vector2(1920, 1080);
	});
	const [safeInset, setSafeInset] = useState(() => {
		const [topLeft] = GuiService.GetGuiInset();
		return topLeft;
	});

	const hoverSoundRef = useRef<Sound>();
	const hoveredPresetRef = useRef<GraphicsPreset | undefined>();
	hoveredPresetRef.current = hoveredPreset;
	const lastHoverSoundTimeRef = useRef<number>(0);

	// Reaktif terhadap perubahan orientasi perangkat & ukuran layar
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

	// Inisialisasi Audio SFX Hover
	useEffect(() => {
		const sound = new Instance("Sound");
		sound.Name = "GraphicsMenuHoverSound";
		sound.SoundId = DEFAULT_GRAPHICS_HOVER_SOUND;
		sound.Volume = 0.5;
		sound.Parent = SoundService;
		hoverSoundRef.current = sound;

		return () => {
			sound.Destroy();
		};
	}, []);

	const playSound = (pitch = 1.0) => {
		const sound = hoverSoundRef.current;
		if (sound) {
			sound.PlaybackSpeed = pitch;
			SoundService.PlayLocalSound(sound);
		}
	};

	const handlePresetHover = (presetId: GraphicsPreset) => {
		if (hoveredPresetRef.current === presetId) return;
		const now = os.clock();
		if (now - lastHoverSoundTimeRef.current < 0.1) return;
		lastHoverSoundTimeRef.current = now;
		hoveredPresetRef.current = presetId;
		setHoveredPreset(presetId);
		playSound(1.0);
	};

	const handlePresetUnhover = (presetId: GraphicsPreset) => {
		if (hoveredPresetRef.current === presetId) {
			hoveredPresetRef.current = undefined;
			setHoveredPreset(undefined);
		}
	};

	// Preload seluruh aset gambar grafis
	useEffect(() => {
		if (!isOpen) return;

		task.spawn(() => {
			pcall(() => {
				ContentProvider.PreloadAsync([
					DEFAULT_GRAPHICS_BANNER,
					DEFAULT_GRAPHICS_LOGO,
					GRAPHICS_PRESET_IMAGES.TITLE,
					GRAPHICS_PRESET_IMAGES.LOW,
					GRAPHICS_PRESET_IMAGES.MEDIUM,
					GRAPHICS_PRESET_IMAGES.HIGH,
					GRAPHICS_PRESET_IMAGES.ULTRA,
					DEFAULT_GRAPHICS_HOVER_SOUND,
				]);
			});
		});
	}, [isOpen]);

	// Sinkronisasi status preset awal
	useEffect(() => {
		if (isOpen) {
			setActivePreset(graphicsService.getPreset());
		}
	}, [isOpen, graphicsService]);

	const handleSelectPreset = (preset: GraphicsPreset) => {
		playSound(1.1);
		setActivePreset(preset);
	};

	const handleApply = () => {
		playSound(1.35);
		graphicsService.setPreset(activePreset);
		onApply?.(activePreset);
		onClose();
	};

	// Keyboard Navigation: Left/Right/A/D, 1-4, Enter (Apply), Escape (Back)
	useEffect(() => {
		if (!isOpen) return;

		const inputConn = UserInputService.InputBegan.Connect((input) => {
			if (UserInputService.GetFocusedTextBox() !== undefined) return;

			if (input.KeyCode === Enum.KeyCode.Escape) {
				onClose();
				return;
			}

			if (input.KeyCode === Enum.KeyCode.Return || input.KeyCode === Enum.KeyCode.Space) {
				handleApply();
				return;
			}

			const currentIndex = PRESET_OPTIONS.findIndex((p) => p.id === activePreset);
			if (currentIndex === -1) return;

			if (input.KeyCode === Enum.KeyCode.Left || input.KeyCode === Enum.KeyCode.A) {
				const nextIndex = (currentIndex - 1 + PRESET_OPTIONS.size()) % PRESET_OPTIONS.size();
				handleSelectPreset(PRESET_OPTIONS[nextIndex].id);
			} else if (input.KeyCode === Enum.KeyCode.Right || input.KeyCode === Enum.KeyCode.D) {
				const nextIndex = (currentIndex + 1) % PRESET_OPTIONS.size();
				handleSelectPreset(PRESET_OPTIONS[nextIndex].id);
			} else if (input.KeyCode === Enum.KeyCode.One) {
				handleSelectPreset("Low");
			} else if (input.KeyCode === Enum.KeyCode.Two) {
				handleSelectPreset("Medium");
			} else if (input.KeyCode === Enum.KeyCode.Three) {
				handleSelectPreset("High");
			} else if (input.KeyCode === Enum.KeyCode.Four) {
				handleSelectPreset("Ultra");
			}
		});

		return () => {
			inputConn.Disconnect();
		};
	}, [isOpen, activePreset]);

	if (!isOpen) {
		return <></>;
	}

	return (
		<frame
			key="GraphicsPresetViewportContainer"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={Color3.fromRGB(0, 0, 0)}
			BackgroundTransparency={0}
			BorderSizePixel={0}
			Active={true}
			ZIndex={1}
		>
			{/* ─── PILAR 1 & 2: FULL-BLEED BACKGROUND ARTWORK (DARK MOODY PERSIS GAMBAR 2) ─── */}
			<frame
				key="BackgroundArtworkWrapper"
				Position={new UDim2(0, 0, 0, 0)}
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ClipsDescendants={true}
				ZIndex={2}
			>
				{/* Visual artwork banner dengan peredam tone sedang agar tidak terlalu terang */}
				<imagelabel
					key="BannerArtwork"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(1.08, 0, 1.08, 0)}
					Image={DEFAULT_GRAPHICS_BANNER}
					ImageColor3={Color3.fromRGB(180, 180, 180)}
					ScaleType={Enum.ScaleType.Crop}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ZIndex={2}
				/>

				{/* Lapisan shading dasar 65% hitam */}
				<frame
					key="BackdropShade"
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={Color3.fromRGB(0, 0, 0)}
					BackgroundTransparency={0.35}
					BorderSizePixel={0}
					ZIndex={3}
				/>

				{/* Horizontal Shadow Gradient Overlay (from-black/85 via-black/55 to-black/75) */}
				<frame
					key="HorizontalShadowOverlay"
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={Color3.fromRGB(0, 0, 0)}
					BorderSizePixel={0}
					ZIndex={4}
				>
					<uigradient
						Color={new ColorSequence(Color3.fromRGB(0, 0, 0))}
						Transparency={
							new NumberSequence([
								new NumberSequenceKeypoint(0, 0.2),
								new NumberSequenceKeypoint(0.5, 0.5),
								new NumberSequenceKeypoint(1, 0.3),
							])
						}
					/>
				</frame>

				{/* Vignette atas & bawah */}
				<frame
					key="VignetteOverlay"
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={Color3.fromRGB(0, 0, 0)}
					BorderSizePixel={0}
					ZIndex={5}
				>
					<uigradient
						Rotation={90}
						Transparency={
							new NumberSequence([
								new NumberSequenceKeypoint(0, 0.4),
								new NumberSequenceKeypoint(0.5, 1.0),
								new NumberSequenceKeypoint(1, 0.3),
							])
						}
					/>
				</frame>
			</frame>

			{/* ─── PILAR 3: FOREGROUND INTERFACE TERPUSAT PERSIS GAMBAR 2 ─── */}
			<frame
				key="ForegroundCenteredContainer"
				AnchorPoint={new Vector2(0.5, 0.5)}
				Position={new UDim2(0.5, 0, 0.48, 0)}
				Size={new UDim2(0, 1140, 0, 390)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ZIndex={10}
			>
				<uiscale Scale={uiScale} />

				{/* ─── ROW 1: HEADER (LOGO DENGAN UKURAN PERSIS MAIN MENU & "Graphics Preset" DI KANAN SEJAJAR) ─── */}
				<frame
					key="HeaderArea"
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(1, 0, 0, 170)}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ZIndex={11}
				>
					{/* Logo Game di Kiri: Ukuran 1:1 persis sama dengan Main Menu (267 x 170 px) sejajar dengan container Low */}
					<imagelabel
						key="GameTitleLogo"
						Position={new UDim2(0, 0, 1, 0)}
						AnchorPoint={new Vector2(0, 1)}
						Size={new UDim2(0, 267, 0, 170)}
						Image={DEFAULT_GRAPHICS_LOGO}
						ScaleType={Enum.ScaleType.Fit}
						BackgroundTransparency={1}
						BorderSizePixel={0}
						ZIndex={12}
					/>

					{/* Judul Tipografi "Graphics Preset" di Kanan Sejajar */}
					<imagelabel
						key="GraphicsPresetTitle"
						Position={new UDim2(1, 0, 1, -22)}
						AnchorPoint={new Vector2(1, 1)}
						Size={new UDim2(0, 240, 0, 48)}
						Image={GRAPHICS_PRESET_IMAGES.TITLE}
						ImageColor3={Color3.fromRGB(255, 255, 255)}
						ScaleType={Enum.ScaleType.Fit}
						BackgroundTransparency={1}
						BorderSizePixel={0}
						ZIndex={12}
					/>
				</frame>

				{/* ─── ROW 2: 4 KARTU PRESET SEBAGAI CONTAINER MANDIRI ─── */}
				<frame
					key="CardsRow"
					Position={new UDim2(0, 0, 0, 190)}
					Size={new UDim2(1, 0, 0, 205)}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ZIndex={11}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 24)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{PRESET_OPTIONS.map((preset, index) => (
						<PresetCardItem
							key={`CardContainer_${preset.id}`}
							preset={preset}
							index={index}
							isSelected={activePreset === preset.id}
							isHovered={hoveredPreset === preset.id}
							onHover={() => handlePresetHover(preset.id)}
							onUnhover={() => handlePresetUnhover(preset.id)}
							onSelect={() => handleSelectPreset(preset.id)}
						/>
					))}
				</frame>
			</frame>

			{/* ─── BOTTOM-RIGHT: TOMBOL APPLY PERSIS GAMBAR 2 ─── */}
			<frame
				key="BottomRightControls"
				Position={new UDim2(1, -safeRight, 1, -38)}
				AnchorPoint={new Vector2(1, 1)}
				Size={new UDim2(0, 88, 0, 32)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ZIndex={15}
			>
				<uiscale Scale={uiScale} />

				{/* Tombol APPLY Tunggal dengan border stroke putih & tactile spring */}
				<textbutton
					key="ApplyButton"
					Position={new UDim2(0, 0, 0, 0)}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={
						isApplyHovered ? Color3.fromRGB(225, 225, 225) : Color3.fromRGB(255, 255, 255)
					}
					BorderSizePixel={0}
					AutoButtonColor={false}
					Text=""
					ZIndex={16}
					Event={{
						MouseEnter: applyHandlers.MouseEnter,
						MouseLeave: applyHandlers.MouseLeave,
						MouseButton1Down: applyHandlers.MouseButton1Down,
						MouseButton1Up: applyHandlers.MouseButton1Up,
						Activated: handleApply,
					}}
				>
					<uiscale Scale={applyScale} />
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
						Text="APPLY"
						Font={Fonts.Bold}
						TextSize={11}
						TextColor3={Color3.fromRGB(0, 0, 0)}
						ZIndex={17}
					/>
				</textbutton>
			</frame>
		</frame>
	);
}

/**
 * Class Adapter Pattern untuk GraphicsPresetView (OOP).
 */
export class GraphicsPresetView {
	private static instance?: GraphicsPresetView;
	private root: Root;
	private screenGui?: ScreenGui;
	private _isOpen = false;
	private closeCallbacks: Array<() => void> = [];
	private toggleCallbacks: Array<(isOpen: boolean) => void> = [];

	public constructor(targetParent?: Instance) {
		const isGuiObject = targetParent && targetParent.IsA("GuiObject");
		const container =
			targetParent ?? (RunService.IsRunning() ? Players.LocalPlayer?.WaitForChild("PlayerGui") : undefined);

		if (!isGuiObject && container) {
			const gui = new Instance("ScreenGui");
			gui.Name = "GraphicsPresetGui";
			gui.ResetOnSpawn = false;
			gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			gui.DisplayOrder = 920;
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

	public static getInstance(target?: Instance): GraphicsPresetView {
		if (!GraphicsPresetView.instance) {
			GraphicsPresetView.instance = new GraphicsPresetView(target);
		}
		return GraphicsPresetView.instance;
	}

	private render(): void {
		this.root.render(
			<GraphicsPresetComponent
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
		for (const cb of this.toggleCallbacks) {
			cb(true);
		}
	}

	public hide(): void {
		if (!this._isOpen) return;
		this._isOpen = false;
		if (this.screenGui) {
			this.screenGui.Enabled = false;
		}
		this.render();
		for (const cb of this.toggleCallbacks) {
			cb(false);
		}
	}

	public toggle(forceState?: boolean): void {
		const target = forceState !== undefined ? forceState : !this._isOpen;
		if (target) {
			this.show();
		} else {
			this.hide();
		}
	}

	public onToggle(callback: (isOpen: boolean) => void): () => void {
		this.toggleCallbacks.push(callback);
		return () => {
			this.toggleCallbacks = this.toggleCallbacks.filter((cb) => cb !== callback);
		};
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
		if (GraphicsPresetView.instance === this) {
			GraphicsPresetView.instance = undefined;
		}
	}
}
