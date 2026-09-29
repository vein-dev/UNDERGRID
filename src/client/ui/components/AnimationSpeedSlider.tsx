import React, { useEffect, useRef } from "@rbxts/react";
import { UserInputService } from "@rbxts/services";
import { Fonts } from "../Typography";

export interface AnimationSpeedSliderProps {
	speed: number;
	onChange: (newSpeed: number) => void;
	onReset?: () => void;
	layoutOrder?: number;
}

export function AnimationSpeedSlider({
	speed,
	onChange,
	onReset,
	layoutOrder,
}: AnimationSpeedSliderProps) {
	const trackRef = useRef<Frame>();
	const isDraggingRef = useRef(false);

	const minSpeed = 0.2;
	const maxSpeed = 2.0;
	const alpha = math.clamp((speed - minSpeed) / (maxSpeed - minSpeed), 0, 1);

	const updateFromPosition = (inputX: number) => {
		const track = trackRef.current;
		if (!track) return;
		const trackPos = track.AbsolutePosition.X;
		const trackWidth = track.AbsoluteSize.X;
		if (trackWidth <= 0) return;

		const rawAlpha = math.clamp((inputX - trackPos) / trackWidth, 0, 1);
		const calcSpeed = minSpeed + rawAlpha * (maxSpeed - minSpeed);
		const rounded = math.clamp(math.round(calcSpeed * 10) / 10, minSpeed, maxSpeed);
		onChange(rounded);
	};

	useEffect(() => {
		const moveConn = UserInputService.InputChanged.Connect((input) => {
			if (isDraggingRef.current) {
				if (
					input.UserInputType === Enum.UserInputType.MouseMovement ||
					input.UserInputType === Enum.UserInputType.Touch
				) {
					updateFromPosition(input.Position.X);
				}
			}
		});

		const endConn = UserInputService.InputEnded.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseButton1 ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				isDraggingRef.current = false;
			}
		});

		return () => {
			moveConn.Disconnect();
			endConn.Disconnect();
		};
	}, []);

	return (
		<frame
			key="SpeedSliderContainer"
			LayoutOrder={layoutOrder}
			Size={new UDim2(1, 0, 0, 34)}
			BackgroundColor3={Color3.fromHex("#141418")}
			BackgroundTransparency={0.2}
			ZIndex={52}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<uistroke
				Color={Color3.fromHex("#26262e")}
				Thickness={1}
				Transparency={0.4}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>
			<uipadding
				PaddingLeft={new UDim(0, 10)}
				PaddingRight={new UDim(0, 8)}
				PaddingTop={new UDim(0, 4)}
				PaddingBottom={new UDim(0, 4)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				VerticalAlignment={Enum.VerticalAlignment.Center}
				Padding={new UDim(0, 8)}
			/>

			{/* Left Label */}
			<textlabel
				Text="SPEED"
				Font={Fonts.Bold}
				TextSize={9}
				TextColor3={speed !== 1.0 ? Color3.fromHex("#ffffff") : Color3.fromHex("#7e7e88")}
				BackgroundTransparency={1}
				AutomaticSize={Enum.AutomaticSize.XY}
				ZIndex={53}
			/>

			{/* Interactive Rail Track */}
			<frame
				key="TrackWrapper"
				Size={new UDim2(1, -78, 1, 0)}
				BackgroundTransparency={1}
				ZIndex={53}
			>
				{/* Rail Background */}
				<frame
					ref={trackRef}
					key="Rail"
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(0, 0, 0.5, 0)}
					Size={new UDim2(1, 0, 0, 4)}
					BackgroundColor3={Color3.fromHex("#262630")}
					ZIndex={53}
				>
					<uicorner CornerRadius={new UDim(1, 0)} />

					{/* Fill Bar */}
					<frame
						key="Fill"
						Size={new UDim2(alpha, 0, 1, 0)}
						BackgroundColor3={Color3.fromHex("#ffffff")}
						ZIndex={54}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
					</frame>

					{/* Knob Thumb */}
					<frame
						key="Knob"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(alpha, 0, 0.5, 0)}
						Size={new UDim2(0, 12, 0, 12)}
						BackgroundColor3={Color3.fromHex("#ffffff")}
						ZIndex={55}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<uistroke
							Color={Color3.fromHex("#000000")}
							Thickness={1}
							Transparency={0.6}
						/>
					</frame>
				</frame>

				{/* Hitbox */}
				<textbutton
					key="Hitbox"
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(0, 0, 0.5, 0)}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundTransparency={1}
					Text=""
					Active={true}
					ZIndex={56}
					AutoButtonColor={false}
					Event={{
						InputBegan: (_, input) => {
							if (
								input.UserInputType === Enum.UserInputType.MouseButton1 ||
								input.UserInputType === Enum.UserInputType.Touch
							) {
								isDraggingRef.current = true;
								updateFromPosition(input.Position.X);
							}
						},
					}}
				/>
			</frame>

			{/* Digital Speed Chip / Reset */}
			<textbutton
				key="ResetBtn"
				Size={new UDim2(0, 36, 0, 22)}
				BackgroundColor3={speed !== 1.0 ? Color3.fromHex("#282832") : Color3.fromHex("#1a1a20")}
				BackgroundTransparency={0.2}
				AutoButtonColor={false}
				Text=""
				ZIndex={53}
				Event={{
					MouseButton1Click: () => {
						if (onReset) {
							onReset();
						} else {
							onChange(1.0);
						}
					},
				}}
			>
				<uicorner CornerRadius={new UDim(0, 6)} />
				<uistroke
					Color={speed !== 1.0 ? Color3.fromHex("#444455") : Color3.fromHex("#262630")}
					Thickness={1}
				/>
				<textlabel
					Size={new UDim2(1, 0, 1, 0)}
					Text={string.format("%.1fx", speed)}
					Font={Fonts.Bold}
					TextSize={10}
					TextColor3={speed !== 1.0 ? Color3.fromHex("#ffffff") : Color3.fromHex("#8e8e98")}
					TextXAlignment={Enum.TextXAlignment.Center}
					TextYAlignment={Enum.TextYAlignment.Center}
					BackgroundTransparency={1}
					ZIndex={54}
				/>
			</textbutton>
		</frame>
	);
}
