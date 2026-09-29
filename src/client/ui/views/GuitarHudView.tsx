import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, TweenService, Workspace } from "@rbxts/services";
import { GUITAR_ANIMATION_CONFIG, GuitarAnimationItem } from "shared/config";
import { AnimationSpeedSlider } from "../components/AnimationSpeedSlider";
import { Fonts } from "../Typography";

export interface GuitarHudProps {
	visible: boolean;
	animations?: readonly GuitarAnimationItem[];
	activeAnimationId?: string;
	isPlaying?: boolean;
	speed?: number;
	onSelectAnimation?: (animId: string) => void;
	onSpeedChange?: (newSpeed: number) => void;
	onStop?: () => void;
}

export function GuitarHudComponent({
	visible,
	animations = GUITAR_ANIMATION_CONFIG.ANIMATIONS,
	activeAnimationId = GUITAR_ANIMATION_CONFIG.DEFAULT_ANIMATION_ID,
	isPlaying = true,
	speed = 1.0,
	onSelectAnimation,
	onSpeedChange,
	onStop,
}: GuitarHudProps) {
	const [shouldRender, setShouldRender] = useState(visible);
	const [hoveredAnimId, setHoveredAnimId] = useState<string | undefined>();
	const [isStopHovered, setIsStopHovered] = useState(false);

	const [scale, setScale] = useState(1);
	const [targetPos, setTargetPos] = useState(new UDim2(0, 24, 0.5, 0));
	const [offscreenPos, setOffscreenPos] = useState(new UDim2(0, -260, 0.5, 0));
	const [anchorPoint, setAnchorPoint] = useState(new Vector2(0, 0.5));

	const containerRef = useRef<Frame>();
	const isMountedRef = useRef(false);

	useEffect(() => {
		isMountedRef.current = true;
	}, []);

	// Responsive placement & scaling listener
	useEffect(() => {
		const updateLayout = () => {
			const cam = Workspace.CurrentCamera;
			const vp = cam ? cam.ViewportSize : new Vector2(1280, 720);
			const isPortrait = vp.X < vp.Y || vp.X < 640;

			if (isPortrait) {
				const s = math.clamp(vp.Y / 720, 0.75, 1.0);
				setScale(s);
				setAnchorPoint(new Vector2(0.5, 0.5));
				setTargetPos(new UDim2(0.5, 0, 0.5, 0));
				setOffscreenPos(new UDim2(0.5, 0, 1.4, 0));
			} else {
				const s = math.clamp(vp.Y / 720, 0.75, 1.0);
				setScale(s);
				setAnchorPoint(new Vector2(0, 0.5));
				setTargetPos(new UDim2(0, 24, 0.5, 0));
				setOffscreenPos(new UDim2(0, -260, 0.5, 0));
			}
		};

		updateLayout();
		const cam = Workspace.CurrentCamera;
		const vpConn = cam?.GetPropertyChangedSignal("ViewportSize").Connect(updateLayout);
		const camConn = Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(updateLayout);

		return () => {
			vpConn?.Disconnect();
			camConn.Disconnect();
		};
	}, []);

	// Trigger render mounting when visible becomes true
	useEffect(() => {
		if (visible) {
			setShouldRender(true);
		}
	}, [visible]);

	// Open / Close Tween animation
	useEffect(() => {
		if (!shouldRender) return;

		const container = containerRef.current;
		if (!container) return;

		if (visible) {
			container.Position = offscreenPos;
			container.BackgroundTransparency = 1;

			const tween = TweenService.Create(
				container,
				new TweenInfo(0.35, Enum.EasingStyle.Quart, Enum.EasingDirection.Out),
				{
					Position: targetPos,
					BackgroundTransparency: 0.15,
				},
			);
			tween.Play();
			return () => tween.Cancel();
		} else {
			if (!isMountedRef.current) {
				container.Position = offscreenPos;
				container.BackgroundTransparency = 1;
				setShouldRender(false);
				return;
			}

			const tween = TweenService.Create(
				container,
				new TweenInfo(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
				{
					Position: offscreenPos,
					BackgroundTransparency: 1,
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
	}, [visible, shouldRender, targetPos, offscreenPos]);

	if (!shouldRender) {
		return <></>;
	}

	return (
		<frame
			ref={containerRef}
			AnchorPoint={anchorPoint}
			Position={offscreenPos}
			Size={new UDim2(0, 200, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundColor3={Color3.fromHex("#0c0c10")}
			BackgroundTransparency={0.15}
			ZIndex={50}
		>
			<uiscale Scale={scale} />
			<uicorner CornerRadius={new UDim(0, 14)} />
			<uistroke Color={Color3.fromHex("#282830")} Thickness={1.2} />
			<uipadding
				PaddingLeft={new UDim(0, 12)}
				PaddingRight={new UDim(0, 12)}
				PaddingTop={new UDim(0, 12)}
				PaddingBottom={new UDim(0, 12)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Vertical}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 8)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>

			{/* Header */}
			<frame
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 22)}
				BackgroundTransparency={1}
				ZIndex={51}
			>
				<textlabel
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(0, 0, 0.5, 0)}
					Text="GUITAR"
					Font={Fonts.Bold}
					TextSize={12}
					TextColor3={Color3.fromHex("#ffffff")}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={52}
				/>
				<textlabel
					AnchorPoint={new Vector2(1, 0.5)}
					Position={new UDim2(1, 0, 0.5, 0)}
					Text="STAGE"
					Font={Fonts.Bold}
					TextSize={10}
					TextColor3={Color3.fromHex("#8e8e98")}
					BackgroundTransparency={1}
					AutomaticSize={Enum.AutomaticSize.XY}
					ZIndex={52}
				/>
			</frame>

			{/* Separator 1 */}
			<frame
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 1)}
				BackgroundColor3={Color3.fromHex("#22222a")}
				BorderSizePixel={0}
				ZIndex={51}
			/>

			{/* Vertical Guitar Animations List */}
			<frame
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
				ZIndex={51}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					Padding={new UDim(0, 6)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{animations.map((anim: GuitarAnimationItem, idx: number) => {
					const isActive = isPlaying && anim.id === activeAnimationId;
					const isHovered = anim.id === hoveredAnimId;

					return (
						<textbutton
							key={`anim_${anim.id}`}
							LayoutOrder={idx}
							Size={new UDim2(1, 0, 0, 36)}
							BackgroundColor3={
								isActive
									? Color3.fromHex("#ffffff")
									: isHovered
										? Color3.fromHex("#1f1f26")
										: Color3.fromHex("#141418")
							}
							BackgroundTransparency={isActive ? 0 : 0.25}
							AutoButtonColor={false}
							Text=""
							ZIndex={52}
							Event={{
								MouseEnter: () => setHoveredAnimId(anim.id),
								MouseLeave: () => setHoveredAnimId(undefined),
								MouseButton1Click: () => onSelectAnimation?.(anim.id),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />
							<uistroke
								Color={
									isActive
										? Color3.fromHex("#ffffff")
										: isHovered
											? Color3.fromHex("#444455")
											: Color3.fromHex("#26262e")
								}
								Thickness={isActive ? 1.5 : 1}
							/>
							<textlabel
								Size={new UDim2(1, 0, 1, 0)}
								Text={anim.name}
								Font={isActive ? Fonts.Bold : Fonts.Medium}
								TextSize={12}
								TextColor3={isActive ? Color3.fromHex("#000000") : Color3.fromHex("#f1f5f9")}
								TextXAlignment={Enum.TextXAlignment.Center}
								TextYAlignment={Enum.TextYAlignment.Center}
								BackgroundTransparency={1}
								ZIndex={53}
							/>
						</textbutton>
					);
				})}
			</frame>

			{/* Animation Speed Slider */}
			<AnimationSpeedSlider
				layoutOrder={4}
				speed={speed}
				onChange={(newSpeed) => onSpeedChange?.(newSpeed)}
				onReset={() => onSpeedChange?.(1.0)}
			/>

			{/* Separator 2 */}
			<frame
				LayoutOrder={5}
				Size={new UDim2(1, 0, 0, 1)}
				BackgroundColor3={Color3.fromHex("#22222a")}
				BorderSizePixel={0}
				ZIndex={51}
			/>

			{/* Stop Playing Button */}
			<textbutton
				key="StopBtn"
				LayoutOrder={6}
				Size={new UDim2(1, 0, 0, 36)}
				BackgroundColor3={
					isStopHovered ? Color3.fromHex("#24242c") : Color3.fromHex("#16161c")
				}
				BackgroundTransparency={0.2}
				AutoButtonColor={false}
				Text=""
				ZIndex={52}
				Event={{
					MouseEnter: () => setIsStopHovered(true),
					MouseLeave: () => setIsStopHovered(false),
					MouseButton1Click: () => onStop?.(),
				}}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<uistroke
					Color={isStopHovered ? Color3.fromHex("#555566") : Color3.fromHex("#33333e")}
					Thickness={1}
				/>
				<textlabel
					Size={new UDim2(1, 0, 1, 0)}
					Text="HENTIKAN MAIN"
					Font={Fonts.Bold}
					TextSize={12}
					TextColor3={Color3.fromHex("#ffffff")}
					TextXAlignment={Enum.TextXAlignment.Center}
					TextYAlignment={Enum.TextYAlignment.Center}
					BackgroundTransparency={1}
					ZIndex={53}
				/>
			</textbutton>
		</frame>
	);
}

/**
 * Class Adapter Pattern for GuitarHudView.
 * Allows client components/controllers to cleanly show, hide, and manage guitar UI state.
 */
export class GuitarHudView {
	private static instance?: GuitarHudView;
	private root: Root;
	private screenGui?: ScreenGui;
	private hostInstance: Instance;

	private _visible = false;
	private _animations: readonly GuitarAnimationItem[] = GUITAR_ANIMATION_CONFIG.ANIMATIONS;
	private _activeAnimationId: string = GUITAR_ANIMATION_CONFIG.DEFAULT_ANIMATION_ID;
	private _isPlaying = true;
	private _speed = 1.0;
	private _onSelectAnimation?: (animId: string) => void;
	private _onSpeedChange?: (newSpeed: number) => void;
	private _onStop?: () => void;

	public constructor(targetContainer?: Instance) {
		if (targetContainer && targetContainer.IsA("GuiObject")) {
			this.hostInstance = targetContainer;
		} else {
			const player = Players.LocalPlayer;
			const playerGui = (player?.FindFirstChild("PlayerGui") ?? player?.WaitForChild("PlayerGui")) as PlayerGui;

			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "GuitarHudGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 65;
			this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			this.screenGui.Parent = playerGui;
			this.hostInstance = this.screenGui;
		}

		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	public static getInstance(container?: Instance): GuitarHudView {
		if (!GuitarHudView.instance) {
			GuitarHudView.instance = new GuitarHudView(container);
		}
		return GuitarHudView.instance;
	}

	public show(
		animations: readonly GuitarAnimationItem[],
		activeAnimationId: string,
		isPlaying: boolean,
		speed = 1.0,
		onSelectAnimation: (animId: string) => void,
		onSpeedChange: (newSpeed: number) => void,
		onStop: () => void,
	): void {
		this._visible = true;
		this._animations = animations;
		this._activeAnimationId = activeAnimationId;
		this._isPlaying = isPlaying;
		this._speed = speed;
		this._onSelectAnimation = onSelectAnimation;
		this._onSpeedChange = onSpeedChange;
		this._onStop = onStop;
		this.render();
	}

	public hide(): void {
		if (!this._visible) return;
		this._visible = false;
		this.render();
	}

	public setActiveAnimationId(animId: string, isPlaying = true): void {
		this._activeAnimationId = animId;
		this._isPlaying = isPlaying;
		this.render();
	}

	public setIsPlaying(isPlaying: boolean): void {
		this._isPlaying = isPlaying;
		this.render();
	}

	public setSpeed(speed: number): void {
		this._speed = speed;
		this.render();
	}

	public isVisible(): boolean {
		return this._visible;
	}

	private render(): void {
		this.root.render(
			<GuitarHudComponent
				visible={this._visible}
				animations={this._animations}
				activeAnimationId={this._activeAnimationId}
				isPlaying={this._isPlaying}
				speed={this._speed}
				onSelectAnimation={this._onSelectAnimation}
				onSpeedChange={this._onSpeedChange}
				onStop={this._onStop}
			/>,
		);
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		if (GuitarHudView.instance === this) {
			GuitarHudView.instance = undefined;
		}
	}
}
