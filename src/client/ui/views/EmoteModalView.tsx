import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { GuiService, Players, RunService, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { EmoteService } from "client/services/EmoteService";
import { Fonts } from "../Typography";
import { EMOTE_CONFIG } from "shared/config";
import { EmoteCategory, EmoteItem } from "shared/types";
import { LucideIcon } from "../components/LucideIcon";

const CATEGORIES: EmoteCategory[] = ["Dance", "Pose", "Reaction"];

export interface EmoteModalProps {
	isOpen: boolean;
	onClose: () => void;
	onAnimationFinished?: () => void;
}

export function EmoteModalComponent({ isOpen, onClose, onAnimationFinished }: EmoteModalProps) {
	const [currentTab, setCurrentTab] = useState<EmoteCategory>("Dance");
	const [searchQuery, setSearchQuery] = useState("");
	const [activeEmoteId, setActiveEmoteId] = useState<string | undefined>(
		EmoteService.getInstance().getActiveEmoteId(),
	);
	const [scale, setScale] = useState(1);
	const [targetPos, setTargetPos] = useState<UDim2>(new UDim2(0, 28, 0.5, 0));
	const [offscreenPos, setOffscreenPos] = useState<UDim2>(new UDim2(0, -360, 0.5, 0));
	const [anchorPoint, setAnchorPoint] = useState<Vector2>(new Vector2(0, 0.5));
	const [topbarHeight, setTopbarHeight] = useState(54);
	const [shouldRender, setShouldRender] = useState(isOpen);

	const panelRef = useRef<Frame>();
	const backdropRef = useRef<TextButton>();
	const isMountedRef = useRef(false);

	useEffect(() => {
		const updateScale = () => {
			const camera = Workspace.CurrentCamera;
			const vp = camera ? camera.ViewportSize : new Vector2(1280, 720);

			const [topInset] = GuiService.GetGuiInset();
			const topHeight = math.max(topInset.Y + 16, 68);
			setTopbarHeight(topHeight);

			const bottomInset = 16;
			const availableHeight = math.max(vp.Y - topHeight - bottomInset, 180);
			const centerY = topHeight + availableHeight / 2;

			const isPortrait = vp.X < vp.Y || vp.X < 640;

			if (isPortrait) {
				const availableWidth = math.max(vp.X - 32, 200);
				const scaleY = (availableHeight * 0.85) / 500;
				const scaleX = (availableWidth * 0.88) / 310;
				const newScale = math.clamp(math.min(scaleY, scaleX), 0.55, 0.88);
				setScale(newScale);

				setAnchorPoint(new Vector2(0.5, 0.5));
				setTargetPos(new UDim2(0.5, 0, 0, centerY));
				setOffscreenPos(new UDim2(0.5, 0, 1.5, 0));
			} else {
				const availableWidth = math.max(vp.X - 40, 300);
				const scaleY = (availableHeight * 0.85) / 500;
				const scaleX = (availableWidth * 0.38) / 310;
				const newScale = math.clamp(math.min(scaleY, scaleX), 0.4, 0.85);
				setScale(newScale);

				const safeLeft = math.max(topInset.X, 16);
				const offset = vp.Y <= 520 ? safeLeft + 20 : 28;

				setAnchorPoint(new Vector2(0, 0.5));
				setTargetPos(new UDim2(0, offset, 0, centerY));
				setOffscreenPos(new UDim2(0, -360, 0, centerY));
			}
		};

		updateScale();
		const cam = Workspace.CurrentCamera;
		const conn = cam?.GetPropertyChangedSignal("ViewportSize").Connect(updateScale);
		const camConn = Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(updateScale);

		const unsubscribeEmote = EmoteService.getInstance().onStateChanged((isPlaying, id) => {
			setActiveEmoteId(isPlaying ? id : undefined);
		});

		return () => {
			conn?.Disconnect();
			camConn.Disconnect();
			unsubscribeEmote();
		};
	}, []);

	useEffect(() => {
		if (isOpen) {
			setShouldRender(true);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!shouldRender) return;

		const panel = panelRef.current;
		const backdrop = backdropRef.current;
		if (!panel || !backdrop) return;

		if (isOpen) {
			panel.Position = offscreenPos;
			backdrop.BackgroundTransparency = 1;

			const openPanelTween = TweenService.Create(
				panel,
				new TweenInfo(0.38, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
				{ Position: targetPos },
			);

			openPanelTween.Play();

			return () => {
				openPanelTween.Cancel();
			};
		} else {
			if (!isMountedRef.current) {
				panel.Position = offscreenPos;
				backdrop.BackgroundTransparency = 1;
				setShouldRender(false);
				return;
			}

			const closePanelTween = TweenService.Create(
				panel,
				new TweenInfo(0.28, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{ Position: offscreenPos },
			);

			const conn = closePanelTween.Completed.Connect((status) => {
				conn.Disconnect();
				if (status === Enum.PlaybackState.Completed) {
					setShouldRender(false);
					onAnimationFinished?.();
				}
			});

			closePanelTween.Play();

			return () => {
				conn.Disconnect();
				closePanelTween.Cancel();
			};
		}
	}, [isOpen, shouldRender, targetPos, offscreenPos]);

	useEffect(() => {
		isMountedRef.current = true;
	}, []);

	if (!shouldRender) return <></>;

	const rawItems: EmoteItem[] =
		currentTab === "Dance"
			? EMOTE_CONFIG.Dances
			: currentTab === "Pose"
				? EMOTE_CONFIG.Poses
				: EMOTE_CONFIG.Reactions;

	// Filter items
	const items = rawItems.filter((item: EmoteItem) => {
		const matchesSearch =
			searchQuery === "" || item.name.lower().find(searchQuery.lower())[0] !== undefined;
		return matchesSearch;
	});

	return (
		<frame key="EmoteModalRoot" Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1} ZIndex={1}>
			{/* Backdrop - Berada di bawah Topbar agar menu Topbar tidak tertutup dan bebas diklik */}
			<textbutton
				ref={backdropRef}
				key="Backdrop"
				Position={new UDim2(0, 0, 0, topbarHeight)}
				Size={new UDim2(1, 0, 1, -topbarHeight)}
				BackgroundColor3={Color3.fromHex("#000000")}
				BackgroundTransparency={1}
				Text=""
				AutoButtonColor={false}
				ZIndex={1}
				Event={{
					MouseButton1Click: () => {
						// Pastikan klik benar-benar berada di LUAR area Emote Panel
						const panel = panelRef.current;
						if (panel) {
							const mousePos = UserInputService.GetMouseLocation();
							const pos = panel.AbsolutePosition;
							const size = panel.AbsoluteSize;
							if (
								mousePos.X >= pos.X &&
								mousePos.X <= pos.X + size.X &&
								mousePos.Y >= pos.Y &&
								mousePos.Y <= pos.Y + size.Y
							) {
								return; // Klik di dalam area panel emote, jangan tutup!
							}
						}
						onClose();
					},
				}}
			/>

			{/* Left Side Panel / Centered on Portrait */}
			<frame
				ref={panelRef}
				key="EmotePanelWrapper"
				AnchorPoint={anchorPoint}
				Position={offscreenPos}
				Size={new UDim2(0, 310, 0, 500)}
				BackgroundColor3={Color3.fromHex("#141414")}
				BackgroundTransparency={0}
				ZIndex={2}
			>
				<uiscale Scale={scale} />
				<uicorner CornerRadius={new UDim(0, 16)} />
				<uistroke
					Color={Color3.fromHex("#2a2a2a")}
					Transparency={0.6}
					Thickness={1.2}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>

				{/* Header */}
				<frame
					key="Header"
					Size={new UDim2(1, 0, 0, 48)}
					BackgroundTransparency={1}
				>
					<LucideIcon
						name="sparkles"
						size={new UDim2(0, 18, 0, 18)}
						position={new UDim2(0, 16, 0.5, -9)}
						color={Color3.fromHex("#ffffff")}
					/>
					<textlabel
						key="Title"
						Position={new UDim2(0, 42, 0, 0)}
						Size={new UDim2(1, -90, 1, 0)}
						BackgroundTransparency={1}
						Text="EMOTES & REAKSI"
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Bold}
						TextSize={14}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<textbutton
						key="CloseBtn"
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, -12, 0.5, 0)}
						Size={new UDim2(0, 28, 0, 28)}
						BackgroundColor3={Color3.fromHex("#222222")}
						BackgroundTransparency={0.4}
						Text=""
						AutoButtonColor={false}
						Event={{
							MouseButton1Click: onClose,
						}}
					>
						<uicorner CornerRadius={new UDim(0, 8)} />
						<LucideIcon
							name="x"
							size={new UDim2(0, 14, 0, 14)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#a0a0a0")}
						/>
					</textbutton>
				</frame>

				{/* Category Tabs */}
				<frame
					key="CategoryBar"
					Position={new UDim2(0, 12, 0, 48)}
					Size={new UDim2(1, -24, 0, 32)}
					BackgroundColor3={Color3.fromHex("#1a1a1a")}
					BackgroundTransparency={0.5}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 4)}
					/>
					<uipadding
						PaddingTop={new UDim(0, 3)}
						PaddingBottom={new UDim(0, 3)}
						PaddingLeft={new UDim(0, 3)}
						PaddingRight={new UDim(0, 3)}
					/>
					{CATEGORIES.map((cat: EmoteCategory) => {
						const isSelected = cat === currentTab;
						return (
							<textbutton
								key={`tab_${cat}`}
								Size={new UDim2(0.33, -3, 1, 0)}
								BackgroundColor3={
									isSelected ? Color3.fromHex("#2a2a2a") : Color3.fromHex("#161616")
								}
								BackgroundTransparency={isSelected ? 0 : 0.6}
								Text={cat.upper()}
								TextColor3={
									isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#888888")
								}
								Font={isSelected ? Fonts.Bold : Fonts.Medium}
								TextSize={10}
								AutoButtonColor={false}
								Event={{
									MouseButton1Click: () => setCurrentTab(cat),
								}}
							>
								<uicorner CornerRadius={new UDim(0, 6)} />
							</textbutton>
						);
					})}
				</frame>

				{/* Search Bar */}
				<frame
					key="SearchBar"
					Position={new UDim2(0, 12, 0, 88)}
					Size={new UDim2(1, -24, 0, 32)}
					BackgroundColor3={Color3.fromHex("#161616")}
					BackgroundTransparency={0.4}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<uistroke
						Color={Color3.fromHex("#282828")}
						Thickness={1}
						Transparency={0.5}
						ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
					/>
					<LucideIcon
						name="search"
						size={new UDim2(0, 14, 0, 14)}
						position={new UDim2(0, 8, 0.5, -7)}
						color={Color3.fromHex("#666666")}
					/>
					<textbox
						key="SearchInput"
						Position={new UDim2(0, 28, 0, 0)}
						Size={new UDim2(1, -34, 1, 0)}
						BackgroundTransparency={1}
						PlaceholderText="Cari emote..."
						PlaceholderColor3={Color3.fromHex("#555555")}
						Text={searchQuery}
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Regular}
						TextSize={12}
						TextXAlignment={Enum.TextXAlignment.Left}
						ClearTextOnFocus={false}
						Change={{
							Text: (rbx) => setSearchQuery(rbx.Text),
						}}
					/>
				</frame>

				{/* Emotes Scrolling List */}
				<scrollingframe
					key="ScrollContent"
					Position={new UDim2(0, 12, 0, 128)}
					Size={new UDim2(1, -24, 1, activeEmoteId ? -180 : -138)}
					BackgroundTransparency={1}
					ScrollBarThickness={3}
					ScrollBarImageColor3={Color3.fromHex("#444444")}
					CanvasSize={new UDim2(0, 0, 0, 0)}
					AutomaticCanvasSize={Enum.AutomaticSize.Y}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						Padding={new UDim(0, 6)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{items.map((item: EmoteItem, idx: number) => {
						const isPlayingThis = activeEmoteId === item.id;
						return (
							<textbutton
								key={`emote_${item.id}`}
								LayoutOrder={idx}
								Size={new UDim2(1, 0, 0, 38)}
								BackgroundColor3={
									isPlayingThis ? Color3.fromHex("#ffffff") : Color3.fromHex("#181818")
								}
								BackgroundTransparency={isPlayingThis ? 0 : 0.4}
								AutoButtonColor={false}
								Text=""
								Event={{
									MouseButton1Click: () => {
										if (isPlayingThis) {
											EmoteService.getInstance().stopEmote();
										} else {
											EmoteService.getInstance().playEmote(item);
										}
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
								<uistroke
									Color={
										isPlayingThis
											? Color3.fromHex("#ffffff")
											: Color3.fromHex("#282828")
									}
									Thickness={1}
									Transparency={0.5}
									ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
								/>
								<frame
									key="Inner"
									Size={new UDim2(1, 0, 1, 0)}
									BackgroundTransparency={1}
								>
									<uilistlayout
										FillDirection={Enum.FillDirection.Horizontal}
										VerticalAlignment={Enum.VerticalAlignment.Center}
										Padding={new UDim(0, 8)}
									/>
									<uipadding PaddingLeft={new UDim(0, 10)} />
									<LucideIcon
										name={item.category === "Reaction" ? "smile" : "activity"}
										size={new UDim2(0, 16, 0, 16)}
										color={
											isPlayingThis
												? Color3.fromHex("#000000")
												: Color3.fromHex("#888888")
										}
									/>
									<textlabel
										key="Label"
										BackgroundTransparency={1}
										AutomaticSize={Enum.AutomaticSize.XY}
										Text={item.name.upper()}
										TextColor3={
											isPlayingThis
												? Color3.fromHex("#000000")
												: Color3.fromHex("#d0d0d0")
										}
										Font={isPlayingThis ? Fonts.Bold : Fonts.Medium}
										TextSize={12}
									/>
								</frame>
							</textbutton>
						);
					})}
				</scrollingframe>

				{/* Stop Button */}
				{activeEmoteId ? (
					<frame
						key="BottomBar"
						Position={new UDim2(0, 12, 1, -44)}
						Size={new UDim2(1, -24, 0, 34)}
						BackgroundTransparency={1}
					>
						<textbutton
							key="StopBtn"
							Size={new UDim2(1, 0, 1, 0)}
							BackgroundColor3={Color3.fromHex("#ff3c3c")}
							BackgroundTransparency={0.15}
							Text="HENTIKAN EMOTE"
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={12}
							AutoButtonColor={false}
							Event={{
								MouseButton1Click: () => {
									EmoteService.getInstance().stopEmote();
								},
							}}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />
						</textbutton>
					</frame>
				) : undefined}
			</frame>
		</frame>
	);
}

/**
 * Visual View representing the Emote Modal panel.
 * Migrated to React TSX declarative renderer while preserving 100% backward compatibility
 * with TopbarController via its public methods.
 */
export class EmoteModalView {
	private static instance?: EmoteModalView;
	private player = Players.LocalPlayer;

	private screenGui?: ScreenGui;
	private hostInstance: Instance;
	private root: Root;
	private _isOpen = false;
	private isGuiObject: boolean;
	private originalFOV = 70;
	private fovTween?: Tween;
	private toggleCallbacks: Array<(isOpen: boolean) => void> = [];

	constructor(parentContainer?: Instance) {
		const isGuiObject = parentContainer && parentContainer.IsA("GuiObject");
		this.isGuiObject = isGuiObject === true;

		if (isGuiObject) {
			this.hostInstance = parentContainer;
		} else {
			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "EmoteSystemGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 200;
			this.screenGui.ScreenInsets = Enum.ScreenInsets.None;
			this.screenGui.IgnoreGuiInset = true;
			this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;

			const playerGui =
				(parentContainer as PlayerGui) ??
				(this.player
					? ((this.player.FindFirstChild("PlayerGui") as PlayerGui) ??
						(this.player.WaitForChild("PlayerGui") as PlayerGui))
					: undefined);
			if (playerGui) {
				this.screenGui.Parent = playerGui;
			}
			this.hostInstance = this.screenGui;
		}

		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	public static getInstance(): EmoteModalView {
		if (!EmoteModalView.instance) {
			EmoteModalView.instance = new EmoteModalView();
		}
		return EmoteModalView.instance;
	}

	private animateFOV(zoomIn: boolean): void {
		if (!RunService.IsRunning() && this.isGuiObject) return;
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		this.fovTween?.Cancel();

		if (zoomIn) {
			this.originalFOV = camera.FieldOfView > 0 ? camera.FieldOfView : 70;
			const targetFOV = math.max(this.originalFOV - 35, 45); // Zoom-in halus seperti saat buka smartphone
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

	private render(): void {
		this.root.render(
			<EmoteModalComponent
				isOpen={this._isOpen}
				onClose={() => this.toggle(false)}
				onAnimationFinished={() => {
					if (!this._isOpen && this.screenGui) {
						this.screenGui.Enabled = false;
					}
				}}
			/>,
		);
	}

	public toggle(visible?: boolean): void {
		const target = visible !== undefined ? visible : !this._isOpen;
		if (this._isOpen === target) return;
		this._isOpen = target;
		if (target && this.screenGui) {
			this.screenGui.Enabled = true;
			this.screenGui.DisplayOrder = 200;
		}
		this.animateFOV(target);
		this.render();

		for (const cb of this.toggleCallbacks) {
			cb(this._isOpen);
		}
	}

	public isVisible(): boolean {
		return this._isOpen;
	}

	public onToggle(callback: (isOpen: boolean) => void): () => void {
		this.toggleCallbacks.push(callback);
		return () => {
			this.toggleCallbacks = this.toggleCallbacks.filter((cb) => cb !== callback);
		};
	}

	public destroy(): void {
		this.fovTween?.Cancel();
		const camera = Workspace.CurrentCamera;
		if (camera && this._isOpen) {
			camera.FieldOfView = this.originalFOV;
		}
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		if (EmoteModalView.instance === this) {
			EmoteModalView.instance = undefined;
		}
	}
}
