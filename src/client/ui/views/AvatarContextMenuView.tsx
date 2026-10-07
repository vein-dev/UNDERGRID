import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, TweenService, Workspace } from "@rbxts/services";
import { AvatarContextMenuAction, AvatarTargetPlayer } from "shared/types";
import { LucideIcon } from "../components/LucideIcon";
import { MonochromeTheme } from "../Theme";
import { Fonts } from "../Typography";

export interface AvatarContextMenuProps {
	visible: boolean;
	target?: AvatarTargetPlayer;
	nearbyPlayers?: AvatarTargetPlayer[];
	onAction?: (action: AvatarContextMenuAction, target: AvatarTargetPlayer) => void;
	onSelectTarget?: (target: AvatarTargetPlayer) => void;
	onClose?: () => void;
}

export function AvatarContextMenuComponent({
	visible,
	target,
	nearbyPlayers = [],
	onAction,
	onSelectTarget,
	onClose,
}: AvatarContextMenuProps) {
	const [shouldRender, setShouldRender] = useState(visible);
	const [hoveredAction, setHoveredAction] = useState<string | undefined>();
	const [scale, setScale] = useState(1);

	const containerRef = useRef<CanvasGroup>();
	const isMountedRef = useRef(false);

	// Carousel navigation state
	const playerList = nearbyPlayers.size() > 0 ? nearbyPlayers : target ? [target] : [];
	const currentIndex = target
		? math.max(
				0,
				playerList.findIndex((p) => p.userId === target.userId),
			)
		: 0;

	useEffect(() => {
		isMountedRef.current = true;
	}, []);

	// Responsive scale
	useEffect(() => {
		const updateScale = () => {
			const cam = Workspace.CurrentCamera;
			const vp = cam ? cam.ViewportSize : new Vector2(1280, 720);
			const s = math.clamp(vp.Y / 800, 0.75, 1.05);
			setScale(s);
		};

		updateScale();
		const cam = Workspace.CurrentCamera;
		const vpConn = cam?.GetPropertyChangedSignal("ViewportSize").Connect(updateScale);
		return () => vpConn?.Disconnect();
	}, []);

	// Mount rendering when visible becomes true
	useEffect(() => {
		if (visible && target) {
			setShouldRender(true);
		}
	}, [visible, target]);

	// Open / Close Animation
	useEffect(() => {
		if (!shouldRender) return;

		const container = containerRef.current;
		if (!container) return;

		const targetPos = new UDim2(0.5, 0, 1, -95);
		const offscreenPos = new UDim2(0.5, 0, 1, 80);

		if (visible) {
			container.Position = offscreenPos;
			container.GroupTransparency = 1;

			const tween = TweenService.Create(
				container,
				new TweenInfo(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
				{
					Position: targetPos,
					GroupTransparency: 0,
				},
			);
			tween.Play();
			return () => tween.Cancel();
		} else {
			if (!isMountedRef.current) {
				container.Position = offscreenPos;
				container.GroupTransparency = 1;
				setShouldRender(false);
				return;
			}

			const tween = TweenService.Create(
				container,
				new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{
					Position: offscreenPos,
					GroupTransparency: 1,
				},
			);
			const conn = tween.Completed.Connect((status) => {
				conn.Disconnect();
				if (status === Enum.PlaybackState.Completed) {
					setShouldRender(false);
				}
			});
			tween.Play();
			return () => {
				conn.Disconnect();
				tween.Cancel();
			};
		}
	}, [visible, shouldRender]);

	if (!shouldRender || !target) {
		return <></>;
	}

	const handlePrev = () => {
		if (playerList.size() <= 1) return;
		const nextIdx = (currentIndex - 1 + playerList.size()) % playerList.size();
		onSelectTarget?.(playerList[nextIdx]);
	};

	const handleNext = () => {
		if (playerList.size() <= 1) return;
		const nextIdx = (currentIndex + 1) % playerList.size();
		onSelectTarget?.(playerList[nextIdx]);
	};

	return (
		<canvasgroup
			ref={containerRef}
			AnchorPoint={new Vector2(0.5, 1)}
			Position={new UDim2(0.5, 0, 1, -95)}
			Size={new UDim2(0, 310, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundColor3={MonochromeTheme.Background.DeepCharcoal}
			BackgroundTransparency={0.12}
			ZIndex={90}
		>
			<uiscale Scale={scale} />
			<uicorner CornerRadius={new UDim(0, 14)} />
			<uistroke Color={MonochromeTheme.Border.Subtle} Thickness={1.2} />
			<uilistlayout
				FillDirection={Enum.FillDirection.Vertical}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 0)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>

			{/* ─── Top Header: Carousel & Close ─── */}
			<frame
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 68)}
				BackgroundColor3={MonochromeTheme.Background.Surface}
				BackgroundTransparency={0.3}
				ZIndex={91}
			>
				<uipadding
					PaddingLeft={new UDim(0, 8)}
					PaddingRight={new UDim(0, 8)}
					PaddingTop={new UDim(0, 10)}
					PaddingBottom={new UDim(0, 10)}
				/>

				{/* Left Arrow */}
				<textbutton
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(0, 0, 0.5, 0)}
					Size={new UDim2(0, 28, 0, 42)}
					BackgroundColor3={MonochromeTheme.Background.Card}
					BackgroundTransparency={playerList.size() > 1 ? 0.4 : 0.8}
					AutoButtonColor={false}
					Text=""
					ZIndex={93}
					Event={{
						MouseButton1Click: handlePrev,
					}}
				>
					<uicorner CornerRadius={new UDim(0, 6)} />
					<LucideIcon
						name="chevron-left"
						size={new UDim2(0, 16, 0, 16)}
						color={
							playerList.size() > 1
								? MonochromeTheme.Text.Primary
								: MonochromeTheme.Text.Muted
						}
						anchorPoint={new Vector2(0.5, 0.5)}
						position={new UDim2(0.5, 0, 0.5, 0)}
						zIndex={94}
					/>
				</textbutton>

				{/* Horizontal Avatars Strip */}
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(1, -68, 1, 0)}
					BackgroundTransparency={1}
					ZIndex={92}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{/* Show current player and up to 2 adjacent players */}
					{playerList.map((p, idx) => {
						const isSelected = p.userId === target.userId;
						// Only show items close to current index for a clean carousel preview
						const diff = math.abs(idx - currentIndex);
						if (diff > 2 && playerList.size() > 3) return undefined;

						const headshotUri = `rbxthumb://type=AvatarHeadShot&id=${p.userId}&w=150&h=150`;

						return (
							<textbutton
								key={`avatar_${p.userId}`}
								LayoutOrder={idx}
								Size={new UDim2(0, isSelected ? 46 : 38, 0, isSelected ? 46 : 38)}
								BackgroundColor3={
									isSelected
										? Color3.fromHex("#0084ff")
										: MonochromeTheme.Background.Card
								}
								BackgroundTransparency={isSelected ? 0.3 : 0.5}
								AutoButtonColor={false}
								Text=""
								ZIndex={93}
								Event={{
									MouseButton1Click: () => onSelectTarget?.(p),
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
								<uistroke
									Color={
										isSelected
											? Color3.fromHex("#ffffff")
											: MonochromeTheme.Border.Subtle
									}
									Thickness={isSelected ? 2 : 1}
								/>
								<imagelabel
									Size={new UDim2(1, -4, 1, -4)}
									AnchorPoint={new Vector2(0.5, 0.5)}
									Position={new UDim2(0.5, 0, 0.5, 0)}
									BackgroundTransparency={1}
									Image={headshotUri}
									ScaleType={Enum.ScaleType.Fit}
									ZIndex={94}
								>
									<uicorner CornerRadius={new UDim(0, 6)} />
								</imagelabel>
							</textbutton>
						);
					})}
				</frame>

				{/* Right Arrow */}
				<textbutton
					AnchorPoint={new Vector2(1, 0.5)}
					Position={new UDim2(1, 0, 0.5, 0)}
					Size={new UDim2(0, 28, 0, 42)}
					BackgroundColor3={MonochromeTheme.Background.Card}
					BackgroundTransparency={playerList.size() > 1 ? 0.4 : 0.8}
					AutoButtonColor={false}
					Text=""
					ZIndex={93}
					Event={{
						MouseButton1Click: handleNext,
					}}
				>
					<uicorner CornerRadius={new UDim(0, 6)} />
					<LucideIcon
						name="chevron-right"
						size={new UDim2(0, 16, 0, 16)}
						color={
							playerList.size() > 1
								? MonochromeTheme.Text.Primary
								: MonochromeTheme.Text.Muted
						}
						anchorPoint={new Vector2(0.5, 0.5)}
						position={new UDim2(0.5, 0, 0.5, 0)}
						zIndex={94}
					/>
				</textbutton>
			</frame>

			{/* ─── Separator ─── */}
			<frame
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 1)}
				BackgroundColor3={MonochromeTheme.Border.Subtle}
				BorderSizePixel={0}
				ZIndex={92}
			/>

			{/* ─── Player Identity Header ─── */}
			<frame
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 44)}
				BackgroundColor3={MonochromeTheme.Background.DeepCharcoal}
				BackgroundTransparency={0.2}
				ZIndex={91}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 2)}
				/>
				<textlabel
					Text={target.displayName}
					Font={Fonts.Bold}
					TextSize={14}
					TextColor3={MonochromeTheme.Text.Primary}
					TextTruncate={Enum.TextTruncate.AtEnd}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={92}
				/>
				<textlabel
					Text={`@${target.username}`}
					Font={Fonts.Regular}
					TextSize={11}
					TextColor3={MonochromeTheme.Text.Muted}
					TextTruncate={Enum.TextTruncate.AtEnd}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={92}
				/>
			</frame>

			{/* ─── Separator ─── */}
			<frame
				LayoutOrder={4}
				Size={new UDim2(1, 0, 0, 1)}
				BackgroundColor3={MonochromeTheme.Border.Subtle}
				BorderSizePixel={0}
				ZIndex={92}
			/>

			{/* ─── Action Button 1: Sync / Unsync ─── */}
			<textbutton
				key="Action_Sync"
				LayoutOrder={5}
				Size={new UDim2(1, 0, 0, 44)}
				BackgroundColor3={
					hoveredAction === "sync"
						? MonochromeTheme.Background.CardHover
						: MonochromeTheme.Background.DeepCharcoal
				}
				BackgroundTransparency={hoveredAction === "sync" ? 0.3 : 1}
				AutoButtonColor={false}
				Text=""
				ZIndex={92}
				Event={{
					MouseEnter: () => setHoveredAction("sync"),
					MouseLeave: () => setHoveredAction(undefined),
					MouseButton1Click: () => onAction?.("sync", target),
				}}
			>
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(0, 0, 1, 0)}
					AutomaticSize={Enum.AutomaticSize.X}
					BackgroundTransparency={1}
					ZIndex={93}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 8)}
					/>
					<LucideIcon
						name="refresh-cw"
						size={new UDim2(0, 16, 0, 16)}
						color={
							target.isSyncing
								? Color3.fromHex("#00ff88")
								: MonochromeTheme.Text.Primary
						}
						zIndex={94}
					/>
					<textlabel
						Text={target.isSyncing ? "Unsync" : "Sync"}
						Font={Fonts.Medium}
						TextSize={14}
						TextColor3={
							target.isSyncing
								? Color3.fromHex("#00ff88")
								: MonochromeTheme.Text.Primary
						}
						BackgroundTransparency={1}
						AutomaticSize={Enum.AutomaticSize.XY}
						ZIndex={94}
					/>
				</frame>
			</textbutton>

			{/* ─── Separator ─── */}
			<frame
				LayoutOrder={6}
				Size={new UDim2(1, 0, 0, 1)}
				BackgroundColor3={MonochromeTheme.Border.Subtle}
				BorderSizePixel={0}
				ZIndex={92}
			/>

			{/* ─── Action Button 2: Friends / Add Friend ─── */}
			<textbutton
				key="Action_Friend"
				LayoutOrder={7}
				Size={new UDim2(1, 0, 0, 44)}
				BackgroundColor3={
					hoveredAction === "friend" && !target.isFriend
						? MonochromeTheme.Background.CardHover
						: MonochromeTheme.Background.DeepCharcoal
				}
				BackgroundTransparency={
					hoveredAction === "friend" && !target.isFriend ? 0.3 : 1
				}
				AutoButtonColor={false}
				Text=""
				ZIndex={92}
				Event={{
					MouseEnter: () => setHoveredAction("friend"),
					MouseLeave: () => setHoveredAction(undefined),
					MouseButton1Click: () => {
						if (!target.isFriend) {
							onAction?.("friend", target);
						}
					},
				}}
			>
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(0, 0, 1, 0)}
					AutomaticSize={Enum.AutomaticSize.X}
					BackgroundTransparency={1}
					ZIndex={93}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 8)}
					/>
					<LucideIcon
						name={target.isFriend ? "user-check" : "user-plus"}
						size={new UDim2(0, 16, 0, 16)}
						color={
							target.isFriend
								? MonochromeTheme.Text.Muted
								: MonochromeTheme.Text.Primary
						}
						zIndex={94}
					/>
					<textlabel
						Text={target.isFriend ? "Friends" : "Add Friend"}
						Font={Fonts.Medium}
						TextSize={14}
						TextColor3={
							target.isFriend
								? MonochromeTheme.Text.Muted
								: MonochromeTheme.Text.Primary
						}
						BackgroundTransparency={1}
						AutomaticSize={Enum.AutomaticSize.XY}
						ZIndex={94}
					/>
				</frame>
			</textbutton>

			{/* ─── Separator ─── */}
			<frame
				LayoutOrder={8}
				Size={new UDim2(1, 0, 0, 1)}
				BackgroundColor3={MonochromeTheme.Border.Subtle}
				BorderSizePixel={0}
				ZIndex={92}
			/>

			{/* ─── Action Button 3: Inspect Avatar ─── */}
			<textbutton
				key="Action_Inspect"
				LayoutOrder={9}
				Size={new UDim2(1, 0, 0, 44)}
				BackgroundColor3={
					hoveredAction === "inspect"
						? MonochromeTheme.Background.CardHover
						: MonochromeTheme.Background.DeepCharcoal
				}
				BackgroundTransparency={hoveredAction === "inspect" ? 0.3 : 1}
				AutoButtonColor={false}
				Text=""
				ZIndex={92}
				Event={{
					MouseEnter: () => setHoveredAction("inspect"),
					MouseLeave: () => setHoveredAction(undefined),
					MouseButton1Click: () => onAction?.("inspect", target),
				}}
			>
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(0, 0, 1, 0)}
					AutomaticSize={Enum.AutomaticSize.X}
					BackgroundTransparency={1}
					ZIndex={93}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 8)}
					/>
					<LucideIcon
						name="search"
						size={new UDim2(0, 16, 0, 16)}
						color={MonochromeTheme.Text.Primary}
						zIndex={94}
					/>
					<textlabel
						Text="Inspect Avatar"
						Font={Fonts.Medium}
						TextSize={14}
						TextColor3={MonochromeTheme.Text.Primary}
						BackgroundTransparency={1}
						AutomaticSize={Enum.AutomaticSize.XY}
						ZIndex={94}
					/>
				</frame>
			</textbutton>

			{/* ─── Separator ─── */}
			<frame
				LayoutOrder={10}
				Size={new UDim2(1, 0, 0, 1)}
				BackgroundColor3={MonochromeTheme.Border.Subtle}
				BorderSizePixel={0}
				ZIndex={92}
			/>

			{/* ─── Action Button 4: Fight / Duel ─── */}
			<textbutton
				key="Action_Fight"
				LayoutOrder={11}
				Size={new UDim2(1, 0, 0, 44)}
				BackgroundColor3={
					hoveredAction === "fight"
						? Color3.fromHex("#ef4444")
						: MonochromeTheme.Background.DeepCharcoal
				}
				BackgroundTransparency={hoveredAction === "fight" ? 0.35 : 1}
				AutoButtonColor={false}
				Text=""
				ZIndex={92}
				Event={{
					MouseEnter: () => setHoveredAction("fight"),
					MouseLeave: () => setHoveredAction(undefined),
					MouseButton1Click: () => onAction?.("fight", target),
				}}
			>
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0.5, 0)}
					Size={new UDim2(0, 0, 1, 0)}
					AutomaticSize={Enum.AutomaticSize.X}
					BackgroundTransparency={1}
					ZIndex={93}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, 8)}
					/>
					<LucideIcon
						name="swords"
						size={new UDim2(0, 16, 0, 16)}
						color={
							hoveredAction === "fight"
								? Color3.fromHex("#ffffff")
								: Color3.fromHex("#f87171")
						}
						zIndex={94}
					/>
					<textlabel
						Text="Fight"
						Font={Fonts.Bold}
						TextSize={14}
						TextColor3={
							hoveredAction === "fight"
								? Color3.fromHex("#ffffff")
								: Color3.fromHex("#f87171")
						}
						BackgroundTransparency={1}
						AutomaticSize={Enum.AutomaticSize.XY}
						ZIndex={94}
					/>
				</frame>
			</textbutton>
		</canvasgroup>
	);
}

/**
 * Class Adapter Pattern for AvatarContextMenuView.
 * Allows AvatarContextMenuController to cleanly show, update, and hide the context menu.
 */
export class AvatarContextMenuView {
	private static instance?: AvatarContextMenuView;
	private root: Root;
	private screenGui?: ScreenGui;
	private hostInstance: Instance;

	private _visible = false;
	private _target?: AvatarTargetPlayer;
	private _nearbyPlayers: AvatarTargetPlayer[] = [];
	private _onAction?: (action: AvatarContextMenuAction, target: AvatarTargetPlayer) => void;
	private _onSelectTarget?: (target: AvatarTargetPlayer) => void;
	private _onClose?: () => void;

	public constructor(targetContainer?: Instance) {
		if (targetContainer && targetContainer.IsA("GuiObject")) {
			this.hostInstance = targetContainer;
		} else {
			const player = Players.LocalPlayer;
			const playerGui = (player?.FindFirstChild("PlayerGui") ??
				player?.WaitForChild("PlayerGui")) as PlayerGui;

			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "AvatarContextMenuGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 80;
			this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			this.screenGui.Parent = playerGui;
			this.hostInstance = this.screenGui;
		}

		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	public static getInstance(container?: Instance): AvatarContextMenuView {
		if (!AvatarContextMenuView.instance) {
			AvatarContextMenuView.instance = new AvatarContextMenuView(container);
		}
		return AvatarContextMenuView.instance;
	}

	public show(target: AvatarTargetPlayer, nearbyPlayers: AvatarTargetPlayer[] = []): void {
		this._visible = true;
		this._target = target;
		this._nearbyPlayers = nearbyPlayers;
		this.render();
	}

	public hide(): void {
		if (!this._visible) return;
		this._visible = false;
		this.render();
	}

	public setTarget(target: AvatarTargetPlayer): void {
		this._target = target;
		this.render();
	}

	public setNearbyPlayers(players: AvatarTargetPlayer[]): void {
		this._nearbyPlayers = players;
		this.render();
	}

	public setCallbacks(callbacks: {
		onAction?: (action: AvatarContextMenuAction, target: AvatarTargetPlayer) => void;
		onSelectTarget?: (target: AvatarTargetPlayer) => void;
		onClose?: () => void;
	}): void {
		this._onAction = callbacks.onAction;
		this._onSelectTarget = callbacks.onSelectTarget;
		this._onClose = callbacks.onClose;
		this.render();
	}

	public isVisible(): boolean {
		return this._visible;
	}

	public getTarget(): AvatarTargetPlayer | undefined {
		return this._target;
	}

	private render(): void {
		this.root.render(
			<AvatarContextMenuComponent
				visible={this._visible}
				target={this._target}
				nearbyPlayers={this._nearbyPlayers}
				onAction={this._onAction}
				onSelectTarget={this._onSelectTarget}
				onClose={() => {
					this._onClose?.();
					this.hide();
				}}
			/>,
		);
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		if (AvatarContextMenuView.instance === this) {
			AvatarContextMenuView.instance = undefined;
		}
	}
}
