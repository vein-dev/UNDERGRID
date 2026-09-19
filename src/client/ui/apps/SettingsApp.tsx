import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { UserInputService } from "@rbxts/services";
import { MusicPlayerService } from "client/services/MusicPlayerService";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export interface SettingsComponentProps {
	visible: boolean;
	onBack: () => void;
}

export function SettingsComponent({ visible, onBack }: SettingsComponentProps) {
	const musicService = MusicPlayerService.getInstance();
	const [volumeValue, setVolumeValue] = useState(() => {
		const v = musicService.getVolume();
		return math.clamp(math.round(v * 100), 1, 100);
	});
	const [isDragging, setIsDragging] = useState(false);
	const trackRef = useRef<Frame>();

	useEffect(() => {
		musicService.onVolumeChanged((vol) => {
			setVolumeValue(math.clamp(math.round(vol * 100), 1, 100));
		});
	}, []);

	const updateFromInput = (inputX: number) => {
		const track = trackRef.current;
		if (!track) return;
		const trackX = track.AbsolutePosition.X;
		const trackWidth = track.AbsoluteSize.X;
		if (trackWidth <= 0) return;

		const relativeX = inputX - trackX;
		const ratio = math.clamp(relativeX / trackWidth, 0, 1);
		const newVol = math.clamp(math.round(ratio * 100), 1, 100);
		setVolumeValue(newVol);
		musicService.setVolume(newVol / 100);
	};

	useEffect(() => {
		if (!isDragging) return;

		const moveConn = UserInputService.InputChanged.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseMovement ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				updateFromInput(input.Position.X);
			}
		});

		const endConn = UserInputService.InputEnded.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseButton1 ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				setIsDragging(false);
			}
		});

		return () => {
			moveConn.Disconnect();
			endConn.Disconnect();
		};
	}, [isDragging]);

	if (!visible) return <></>;

	const volumeRatio = volumeValue / 100;
	const iconName = volumeValue <= 1 ? "volume-x" : volumeValue <= 50 ? "volume-1" : "volume-2";

	return (
		<frame
			key="SettingsApp"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={Color3.fromHex("#0c0c0c")}
			ZIndex={8}
		>
			<uigradient
				Color={
					new ColorSequence([
						new ColorSequenceKeypoint(0, Color3.fromHex("#141414")),
						new ColorSequenceKeypoint(1, Color3.fromHex("#0a0a0a")),
					])
				}
				Rotation={160}
			/>

			{/* Header */}
			<frame
				key="Header"
				Size={new UDim2(1, 0, 0, 54)}
				BackgroundTransparency={1}
				ZIndex={9}
			>
				<textbutton
					key="BackButton"
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(0, 14, 0, 28)}
					Size={new UDim2(0, 36, 0, 36)}
					BackgroundTransparency={1}
					Text=""
					AutoButtonColor={false}
					ZIndex={10}
					Event={{
						Activated: onBack,
						MouseButton1Click: onBack,
					}}
				>
					<LucideIcon
						name="chevron-left"
						size={new UDim2(0, 18, 0, 18)}
						anchorPoint={new Vector2(0.5, 0.5)}
						position={new UDim2(0.5, 0, 0.5, 0)}
						color={Color3.fromHex("#ffffff")}
						zIndex={10}
					/>
				</textbutton>

				<textlabel
					key="Title"
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={new UDim2(0.5, 0, 0, 28)}
					Size={new UDim2(0.55, 0, 0, 28)}
					BackgroundTransparency={1}
					Text="Settings"
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextScaled={true}
					ZIndex={9}
				>
					<uitextsizeconstraint MaxTextSize={17} MinTextSize={11} />
				</textlabel>

				<frame
					key="Separator"
					AnchorPoint={new Vector2(0.5, 0)}
					Position={new UDim2(0.5, 0, 0, 54)}
					Size={new UDim2(1, 0, 0, 1)}
					BackgroundColor3={Color3.fromHex("#262626")}
					ZIndex={9}
				/>
			</frame>

			{/* Scroll content */}
			<scrollingframe
				key="SettingsList"
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0.5, 0, 0, 62)}
				Size={new UDim2(0.92, 0, 1, -70)}
				BackgroundTransparency={1}
				ScrollBarThickness={0}
				CanvasSize={new UDim2(0, 0, 0, 0)}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
				ZIndex={9}
			>
				<uilistlayout
					Padding={new UDim(0, 8)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>

				{/* Section Sound */}
				<textlabel
					key="SectionSound"
					LayoutOrder={0}
					Size={new UDim2(1, 0, 0, 26)}
					BackgroundTransparency={1}
					Text="SOUND"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>

				<frame
					key="VolumeRow"
					LayoutOrder={1}
					Size={new UDim2(1, 0, 0, 74)}
					BackgroundColor3={Color3.fromHex("#161616")}
					ZIndex={10}
				>
					<uicorner CornerRadius={new UDim(0, 12)} />
					<uistroke Color={Color3.fromHex("#262626")} Thickness={1} />
					<LucideIcon
						name={iconName}
						size={new UDim2(0, 16, 0, 16)}
						position={new UDim2(0, 14, 0, 12)}
						color={Color3.fromHex("#ffffff")}
						zIndex={11}
					/>
					<textlabel
						key="VolumeLabel"
						Position={new UDim2(0, 38, 0, 12)}
						Size={new UDim2(0.55, 0, 0, 18)}
						BackgroundTransparency={1}
						Text="Volume"
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Medium}
						TextSize={14}
						TextXAlignment={Enum.TextXAlignment.Left}
						ZIndex={11}
					/>
					<textlabel
						key="VolumePercent"
						AnchorPoint={new Vector2(1, 0)}
						Position={new UDim2(1, -14, 0, 12)}
						Size={new UDim2(0, 48, 0, 18)}
						BackgroundTransparency={1}
						Text={`${volumeValue}`}
						TextColor3={Color3.fromHex("#888888")}
						Font={Fonts.Bold}
						TextSize={13}
						TextXAlignment={Enum.TextXAlignment.Right}
						ZIndex={11}
					/>

					{/* Volume Slider Track */}
					<frame
						key="SliderTrack"
						ref={trackRef}
						AnchorPoint={new Vector2(0.5, 0)}
						Position={new UDim2(0.5, 0, 0, 44)}
						Size={new UDim2(1, -28, 0, 6)}
						BackgroundColor3={Color3.fromHex("#282828")}
						ZIndex={11}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<frame
							key="SliderFill"
							Size={new UDim2(volumeRatio, 0, 1, 0)}
							BackgroundColor3={Color3.fromHex("#ffffff")}
							ZIndex={12}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
						</frame>

						{/* Slider Thumb Knob */}
						<frame
							key="SliderThumb"
							AnchorPoint={new Vector2(0.5, 0.5)}
							Position={new UDim2(volumeRatio, 0, 0.5, 0)}
							Size={new UDim2(0, 14, 0, 14)}
							BackgroundColor3={Color3.fromHex("#ffffff")}
							ZIndex={13}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
							<uistroke Color={Color3.fromHex("#161616")} Thickness={2} />
						</frame>
					</frame>

					{/* Volume Slider Hitbox for dragging / clicking */}
					<textbutton
						key="SliderHitbox"
						AnchorPoint={new Vector2(0.5, 0)}
						Position={new UDim2(0.5, 0, 0, 32)}
						Size={new UDim2(1, -16, 0, 30)}
						BackgroundTransparency={1}
						Text=""
						AutoButtonColor={false}
						ZIndex={14}
						Event={{
							InputBegan: (_, input) => {
								if (
									input.UserInputType === Enum.UserInputType.MouseButton1 ||
									input.UserInputType === Enum.UserInputType.Touch
								) {
									setIsDragging(true);
									updateFromInput(input.Position.X);
								}
							},
						}}
					/>
				</frame>

				{/* Section About */}
				<textlabel
					key="SectionAbout"
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, 26)}
					BackgroundTransparency={1}
					Text="ABOUT"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>

				<frame
					key="RowOS"
					LayoutOrder={3}
					Size={new UDim2(1, 0, 0, 50)}
					BackgroundColor3={Color3.fromHex("#161616")}
					ZIndex={10}
				>
					<uicorner CornerRadius={new UDim(0, 12)} />
					<textlabel
						key="Label"
						Position={new UDim2(0, 14, 0.5, -9)}
						Size={new UDim2(0.5, 0, 0, 18)}
						BackgroundTransparency={1}
						Text="OS Version"
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Medium}
						TextSize={13}
						TextXAlignment={Enum.TextXAlignment.Left}
						ZIndex={11}
					/>
					<textlabel
						key="Value"
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, -14, 0.5, 0)}
						Size={new UDim2(0.4, 0, 0, 18)}
						BackgroundTransparency={1}
						Text="v1.0.0"
						TextColor3={Color3.fromHex("#888888")}
						Font={Fonts.Regular}
						TextSize={13}
						TextXAlignment={Enum.TextXAlignment.Right}
						ZIndex={11}
					/>
				</frame>

				<frame
					key="RowSystem"
					LayoutOrder={4}
					Size={new UDim2(1, 0, 0, 50)}
					BackgroundColor3={Color3.fromHex("#161616")}
					ZIndex={10}
				>
					<uicorner CornerRadius={new UDim(0, 12)} />
					<textlabel
						key="Label"
						Position={new UDim2(0, 14, 0.5, -9)}
						Size={new UDim2(0.5, 0, 0, 18)}
						BackgroundTransparency={1}
						Text="System"
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Medium}
						TextSize={13}
						TextXAlignment={Enum.TextXAlignment.Left}
						ZIndex={11}
					/>
					<textlabel
						key="Value"
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, -14, 0.5, 0)}
						Size={new UDim2(0.4, 0, 0, 18)}
						BackgroundTransparency={1}
						Text="GRID OS"
						TextColor3={Color3.fromHex("#888888")}
						Font={Fonts.Regular}
						TextSize={13}
						TextXAlignment={Enum.TextXAlignment.Right}
						ZIndex={11}
					/>
				</frame>
			</scrollingframe>
		</frame>
	);
}

/**
 * Settings App — iOS-style settings page.
 * Migrated to React TSX declarative renderer.
 */
export class SettingsApp {
	private hostInstance: GuiObject;
	private root: Root;
	private visible = false;
	private onBackCallbacks: Array<() => void> = [];

	constructor(parent: GuiObject) {
		this.hostInstance = parent;
		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	private render(): void {
		this.root.render(
			<SettingsComponent
				visible={this.visible}
				onBack={() => {
					for (const cb of this.onBackCallbacks) cb();
				}}
			/>,
		);
	}

	public onBack(cb: () => void): void {
		this.onBackCallbacks.push(cb);
	}

	public show(): void {
		this.visible = true;
		this.render();
	}

	public hide(): void {
		this.visible = false;
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
	}
}
