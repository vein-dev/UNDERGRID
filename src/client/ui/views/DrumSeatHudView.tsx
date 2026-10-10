import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, Workspace } from "@rbxts/services";
import { DRUM_SEAT_CONFIG, DrumBeatItem } from "shared/config";
import { SpringPresets, useSpring } from "../SpringConfig";
import { usePressSpring } from "../hooks";
import { AnimationSpeedSlider } from "../components/AnimationSpeedSlider";
import { Fonts } from "../Typography";

export interface DrumSeatHudProps {
	visible: boolean;
	beats?: readonly DrumBeatItem[];
	activeBeatId?: string;
	speed?: number;
	onSelectBeat?: (beatId: string) => void;
	onSpeedChange?: (newSpeed: number) => void;
	onStandUp?: () => void;
}

interface DrumBeatButtonItemProps {
	beat: DrumBeatItem;
	idx: number;
	isActive: boolean;
	onSelect: () => void;
}

function DrumBeatButtonItem({ beat, idx, isActive, onSelect }: DrumBeatButtonItemProps) {
	const { scaleBinding, isHovered, eventHandlers } = usePressSpring({
		hoverScale: 1.02,
		pressScale: 0.98,
		springConfig: SpringPresets.snappy,
	});

	return (
		<textbutton
			key={`beat_${beat.id}`}
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
				MouseEnter: eventHandlers.MouseEnter,
				MouseLeave: eventHandlers.MouseLeave,
				MouseButton1Down: eventHandlers.MouseButton1Down,
				MouseButton1Up: eventHandlers.MouseButton1Up,
				MouseButton1Click: onSelect,
			}}
		>
			<uiscale Scale={scaleBinding} />
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
				Text={beat.name}
				Font={isActive ? Fonts.Bold : Fonts.Medium}
				TextSize={12}
				TextColor3={isActive ? Color3.fromHex("#000000") : Color3.fromHex("#d0d0d8")}
				TextXAlignment={Enum.TextXAlignment.Center}
				TextYAlignment={Enum.TextYAlignment.Center}
				BackgroundTransparency={1}
				ZIndex={53}
			/>
		</textbutton>
	);
}

export function DrumSeatHudComponent({
	visible,
	beats = DRUM_SEAT_CONFIG.BEATS,
	activeBeatId = DRUM_SEAT_CONFIG.DEFAULT_BEAT_ID,
	speed = 1.0,
	onSelectBeat,
	onSpeedChange,
	onStandUp,
}: DrumSeatHudProps) {
	const [shouldRender, setShouldRender] = useState(visible);
	const [scale, setScale] = useState(1);
	const [targetPos, setTargetPos] = useState(new UDim2(0, 24, 0.5, 0));
	const [offscreenPos, setOffscreenPos] = useState(new UDim2(0, -260, 0.5, 0));
	const [anchorPoint, setAnchorPoint] = useState(new Vector2(0, 0.5));

	const [posBinding, posSpring] = useSpring(visible ? targetPos : offscreenPos, SpringPresets.snappy);
	const [bgTransBinding, bgTransSpring] = useSpring(visible ? 0.15 : 1, SpringPresets.gentle);

	const { scaleBinding: standScale, isHovered: isStandHovered, eventHandlers: standHandlers } = usePressSpring({
		hoverScale: 1.03,
		pressScale: 0.96,
		springConfig: SpringPresets.snappy,
	});

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

	// Spring updates
	useEffect(() => {
		if (visible) {
			setShouldRender(true);
			posSpring.setGoal(targetPos);
			bgTransSpring.setGoal(0.15);
		} else {
			posSpring.setGoal(offscreenPos);
			bgTransSpring.setGoal(1);
		}
	}, [visible, targetPos, offscreenPos]);

	useEffect(() => {
		const unsub = posSpring.onComplete(() => {
			if (!visible) {
				setShouldRender(false);
			}
		});
		return unsub;
	}, [visible]);

	if (!shouldRender) {
		return <></>;
	}

	return (
		<frame
			AnchorPoint={anchorPoint}
			Position={posBinding}
			Size={new UDim2(0, 200, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundColor3={Color3.fromHex("#0c0c10")}
			BackgroundTransparency={bgTransBinding}
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
					Text="DRUM KIT"
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

			{/* Vertical Drum Beats List */}
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
				{beats.map((beat: DrumBeatItem, idx: number) => (
					<DrumBeatButtonItem
						key={`beat_${beat.id}`}
						beat={beat}
						idx={idx}
						isActive={beat.id === activeBeatId}
						onSelect={() => onSelectBeat?.(beat.id)}
					/>
				))}
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

			{/* Stand Up / Stop Playing Button */}
			<textbutton
				key="StandUpBtn"
				LayoutOrder={6}
				Size={new UDim2(1, 0, 0, 36)}
				BackgroundColor3={
					isStandHovered ? Color3.fromHex("#24242c") : Color3.fromHex("#16161c")
				}
				BackgroundTransparency={0.2}
				AutoButtonColor={false}
				Text=""
				ZIndex={52}
				Event={{
					MouseEnter: standHandlers.MouseEnter,
					MouseLeave: standHandlers.MouseLeave,
					MouseButton1Down: standHandlers.MouseButton1Down,
					MouseButton1Up: standHandlers.MouseButton1Up,
					MouseButton1Click: () => onStandUp?.(),
				}}
			>
				<uiscale Scale={standScale} />
				<uicorner CornerRadius={new UDim(0, 8)} />
				<uistroke
					Color={isStandHovered ? Color3.fromHex("#555566") : Color3.fromHex("#33333e")}
					Thickness={1}
				/>
				<textlabel
					Size={new UDim2(1, 0, 1, 0)}
					Text="BERHENTI MAIN"
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
 * Class Adapter Pattern for DrumSeatHudView.
 * Allows client controllers to cleanly show, hide, and manage drum seat UI state.
 */
export class DrumSeatHudView {
	private static instance?: DrumSeatHudView;
	private root: Root;
	private screenGui?: ScreenGui;
	private hostInstance: Instance;

	private _visible = false;
	private _beats: readonly DrumBeatItem[] = DRUM_SEAT_CONFIG.BEATS;
	private _activeBeatId: string = DRUM_SEAT_CONFIG.DEFAULT_BEAT_ID;
	private _speed = 1.0;
	private _onSelectBeat?: (beatId: string) => void;
	private _onSpeedChange?: (newSpeed: number) => void;
	private _onStandUp?: () => void;

	public constructor(targetContainer?: Instance) {
		if (targetContainer && targetContainer.IsA("GuiObject")) {
			this.hostInstance = targetContainer;
		} else {
			const player = Players.LocalPlayer;
			const playerGui = (player?.FindFirstChild("PlayerGui") ?? player?.WaitForChild("PlayerGui")) as PlayerGui;

			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "DrumSeatHudGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.DisplayOrder = 65;
			this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			this.screenGui.Parent = playerGui;
			this.hostInstance = this.screenGui;
		}

		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	public static getInstance(container?: Instance): DrumSeatHudView {
		if (!DrumSeatHudView.instance) {
			DrumSeatHudView.instance = new DrumSeatHudView(container);
		}
		return DrumSeatHudView.instance;
	}

	public show(
		beats: readonly DrumBeatItem[],
		activeBeatId: string,
		speed = 1.0,
		onSelectBeat: (beatId: string) => void,
		onSpeedChange: (newSpeed: number) => void,
		onStandUp: () => void,
	): void {
		this._visible = true;
		this._beats = beats;
		this._activeBeatId = activeBeatId;
		this._speed = speed;
		this._onSelectBeat = onSelectBeat;
		this._onSpeedChange = onSpeedChange;
		this._onStandUp = onStandUp;
		this.render();
	}

	public hide(): void {
		if (!this._visible) return;
		this._visible = false;
		this.render();
	}

	public setActiveBeatId(beatId: string): void {
		this._activeBeatId = beatId;
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
			<DrumSeatHudComponent
				visible={this._visible}
				beats={this._beats}
				activeBeatId={this._activeBeatId}
				speed={this._speed}
				onSelectBeat={this._onSelectBeat}
				onSpeedChange={this._onSpeedChange}
				onStandUp={this._onStandUp}
			/>,
		);
	}

	public destroy(): void {
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		if (DrumSeatHudView.instance === this) {
			DrumSeatHudView.instance = undefined;
		}
	}
}
