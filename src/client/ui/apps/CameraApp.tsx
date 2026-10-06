import React, { useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { FreecamController } from "client/controllers/FreecamController";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export interface CameraComponentProps {
	visible: boolean;
	onBack: () => void;
}

const SPEED_OPTIONS = [
	{ label: "Slow", multiplier: 0.5, icon: "wind" },
	{ label: "Normal", multiplier: 1.0, icon: "gauge" },
	{ label: "Fast", multiplier: 2.5, icon: "zap" },
];

const FOV_OPTIONS = [
	{ label: "0.5x (95°)", fov: 95 },
	{ label: "1x (70°)", fov: 70 },
	{ label: "2x (45°)", fov: 45 },
	{ label: "5x (25°)", fov: 25 },
];

export function CameraComponent({ visible, onBack }: CameraComponentProps) {
	const controller = FreecamController.getInstance();
	const [selectedSpeed, setSelectedSpeed] = useState(1.0);
	const [selectedFov, setSelectedFov] = useState(70);

	if (!visible) return <></>;

	const launchFreecam = () => {
		controller.setSpeedMultiplier(selectedSpeed);
		controller.setFov(selectedFov);
		controller.startFreecam();
	};

	return (
		<frame
			key="CameraApp"
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

			{/* Global Header */}
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
					Text="Camera"
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
				key="CameraContent"
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
					Padding={new UDim(0, 10)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>

				{/* Section: Mode */}
				<textlabel
					key="SectionMode"
					LayoutOrder={0}
					Size={new UDim2(1, 0, 0, 22)}
					BackgroundTransparency={1}
					Text="CAPTURE MODE"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>

				{/* Primary Launch Card */}
				<frame
					key="LaunchCard"
					LayoutOrder={1}
					Size={new UDim2(1, 0, 0, 150)}
					BackgroundColor3={Color3.fromHex("#171717")}
				>
					<uicorner CornerRadius={new UDim(0, 14)} />
					<uistroke Color={Color3.fromHex("#262626")} Thickness={1} />
					<uipadding
						PaddingTop={new UDim(0, 14)}
						PaddingBottom={new UDim(0, 14)}
						PaddingLeft={new UDim(0, 14)}
						PaddingRight={new UDim(0, 14)}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						SortOrder={Enum.SortOrder.LayoutOrder}
						Padding={new UDim(0, 10)}
					/>

					<frame
						key="HeaderInfo"
						LayoutOrder={0}
						Size={new UDim2(1, 0, 0, 48)}
						BackgroundTransparency={1}
					>
						<frame
							key="IconBadge"
							Size={new UDim2(0, 44, 0, 44)}
							BackgroundColor3={Color3.fromHex("#222222")}
							AnchorPoint={new Vector2(0, 0.5)}
							Position={new UDim2(0, 0, 0.5, 0)}
						>
							<uicorner CornerRadius={new UDim(0, 10)} />
							<LucideIcon
								name="camera"
								size={new UDim2(0, 24, 0, 24)}
								color={Color3.fromHex("#38bdf8")}
								anchorPoint={new Vector2(0.5, 0.5)}
								position={new UDim2(0.5, 0, 0.5, 0)}
							/>
						</frame>

						<frame
							key="TextWrapper"
							Position={new UDim2(0, 54, 0, 0)}
							Size={new UDim2(1, -54, 1, 0)}
							BackgroundTransparency={1}
						>
							<textlabel
								Text="Free-Flight Camera"
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={14}
								TextXAlignment={Enum.TextXAlignment.Left}
								Size={new UDim2(1, 0, 0, 20)}
								BackgroundTransparency={1}
							/>
							<textlabel
								Text="Cinematic drone freecam with touch controls."
								TextColor3={Color3.fromHex("#94a3b8")}
								Font={Fonts.Regular}
								TextSize={11}
								TextWrapped={true}
								TextXAlignment={Enum.TextXAlignment.Left}
								Size={new UDim2(1, 0, 0, 24)}
								BackgroundTransparency={1}
							/>
						</frame>
					</frame>

					{/* Launch Button */}
					<textbutton
						key="LaunchButton"
						LayoutOrder={1}
						Size={new UDim2(1, 0, 0, 42)}
						BackgroundColor3={Color3.fromHex("#38bdf8")}
						Text=""
						AutoButtonColor={true}
						Event={{
							Activated: launchFreecam,
							MouseButton1Click: launchFreecam,
						}}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
						<frame
							Size={new UDim2(1, 0, 1, 0)}
							BackgroundTransparency={1}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 8)}
							/>
							<LucideIcon
								name="video"
								size={new UDim2(0, 18, 0, 18)}
								color={Color3.fromHex("#082f49")}
							/>
							<textlabel
								Text="Open Freecam Viewfinder"
								TextColor3={Color3.fromHex("#082f49")}
								Font={Fonts.Bold}
								TextSize={13}
								Size={new UDim2(0, 160, 1, 0)}
								BackgroundTransparency={1}
							/>
						</frame>
					</textbutton>
				</frame>

				{/* Section: Drone Speed */}
				<textlabel
					key="SectionSpeed"
					LayoutOrder={2}
					Size={new UDim2(1, 0, 0, 22)}
					BackgroundTransparency={1}
					Text="DRONE FLIGHT SPEED"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>

				<frame
					key="SpeedCard"
					LayoutOrder={3}
					Size={new UDim2(1, 0, 0, 52)}
					BackgroundColor3={Color3.fromHex("#171717")}
				>
					<uicorner CornerRadius={new UDim(0, 12)} />
					<uistroke Color={Color3.fromHex("#262626")} Thickness={1} />
					<uipadding
						PaddingTop={new UDim(0, 6)}
						PaddingBottom={new UDim(0, 6)}
						PaddingLeft={new UDim(0, 6)}
						PaddingRight={new UDim(0, 6)}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 6)}
					/>

					{SPEED_OPTIONS.map((opt, idx) => {
						const isSelected = selectedSpeed === opt.multiplier;
						return (
							<textbutton
								key={`Speed_${opt.label}`}
								LayoutOrder={idx}
								Size={new UDim2(1 / 3, -4, 1, 0)}
								BackgroundColor3={isSelected ? Color3.fromHex("#262626") : Color3.fromHex("#121212")}
								BackgroundTransparency={isSelected ? 0 : 0.6}
								Text=""
								AutoButtonColor={true}
								Event={{
									Activated: () => setSelectedSpeed(opt.multiplier),
									MouseButton1Click: () => setSelectedSpeed(opt.multiplier),
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
								{isSelected && (
									<uistroke Color={Color3.fromHex("#38bdf8")} Thickness={1.5} />
								)}
								<frame
									Size={new UDim2(1, 0, 1, 0)}
									BackgroundTransparency={1}
								>
									<uilistlayout
										FillDirection={Enum.FillDirection.Horizontal}
										HorizontalAlignment={Enum.HorizontalAlignment.Center}
										VerticalAlignment={Enum.VerticalAlignment.Center}
										Padding={new UDim(0, 6)}
									/>
									<LucideIcon
										name={opt.icon}
										size={new UDim2(0, 14, 0, 14)}
										color={isSelected ? Color3.fromHex("#38bdf8") : Color3.fromHex("#94a3b8")}
									/>
									<textlabel
										Text={opt.label}
										TextColor3={isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#94a3b8")}
										Font={isSelected ? Fonts.Bold : Fonts.Medium}
										TextSize={12}
										Size={new UDim2(0, 48, 1, 0)}
										BackgroundTransparency={1}
									/>
								</frame>
							</textbutton>
						);
					})}
				</frame>

				{/* Section: FOV */}
				<textlabel
					key="SectionFov"
					LayoutOrder={4}
					Size={new UDim2(1, 0, 0, 22)}
					BackgroundTransparency={1}
					Text="DEFAULT ZOOM & FOV"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>

				<frame
					key="FovCard"
					LayoutOrder={5}
					Size={new UDim2(1, 0, 0, 52)}
					BackgroundColor3={Color3.fromHex("#171717")}
				>
					<uicorner CornerRadius={new UDim(0, 12)} />
					<uistroke Color={Color3.fromHex("#262626")} Thickness={1} />
					<uipadding
						PaddingTop={new UDim(0, 6)}
						PaddingBottom={new UDim(0, 6)}
						PaddingLeft={new UDim(0, 6)}
						PaddingRight={new UDim(0, 6)}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 5)}
					/>

					{FOV_OPTIONS.map((opt, idx) => {
						const isSelected = selectedFov === opt.fov;
						return (
							<textbutton
								key={`Fov_${opt.label}`}
								LayoutOrder={idx}
								Size={new UDim2(1 / 4, -4, 1, 0)}
								BackgroundColor3={isSelected ? Color3.fromHex("#262626") : Color3.fromHex("#121212")}
								BackgroundTransparency={isSelected ? 0 : 0.6}
								Text=""
								AutoButtonColor={true}
								Event={{
									Activated: () => setSelectedFov(opt.fov),
									MouseButton1Click: () => setSelectedFov(opt.fov),
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
								{isSelected && (
									<uistroke Color={Color3.fromHex("#38bdf8")} Thickness={1.5} />
								)}
								<textlabel
									Text={opt.label}
									TextColor3={isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#94a3b8")}
									Font={isSelected ? Fonts.Bold : Fonts.Medium}
									TextSize={11}
									Size={new UDim2(1, 0, 1, 0)}
									BackgroundTransparency={1}
								/>
							</textbutton>
						);
					})}
				</frame>

				{/* Section: Tips */}
				<textlabel
					key="SectionTips"
					LayoutOrder={6}
					Size={new UDim2(1, 0, 0, 22)}
					BackgroundTransparency={1}
					Text="QUICK GUIDE"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
				/>

				<frame
					key="TipsCard"
					LayoutOrder={7}
					Size={new UDim2(1, 0, 0, 96)}
					BackgroundColor3={Color3.fromHex("#171717")}
				>
					<uicorner CornerRadius={new UDim(0, 12)} />
					<uistroke Color={Color3.fromHex("#262626")} Thickness={1} />
					<uipadding
						PaddingTop={new UDim(0, 10)}
						PaddingBottom={new UDim(0, 10)}
						PaddingLeft={new UDim(0, 12)}
						PaddingRight={new UDim(0, 12)}
					/>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						Padding={new UDim(0, 6)}
					/>

					<frame Size={new UDim2(1, 0, 0, 18)} BackgroundTransparency={1}>
						<LucideIcon name="move" size={new UDim2(0, 14, 0, 14)} color={Color3.fromHex("#38bdf8")} />
						<textlabel
							Position={new UDim2(0, 22, 0, 0)}
							Size={new UDim2(1, -22, 1, 0)}
							BackgroundTransparency={1}
							Text="Left Screen: Translucent virtual thumbstick"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Regular}
							TextSize={11}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
					</frame>

					<frame Size={new UDim2(1, 0, 0, 18)} BackgroundTransparency={1}>
						<LucideIcon name="eye" size={new UDim2(0, 14, 0, 14)} color={Color3.fromHex("#38bdf8")} />
						<textlabel
							Position={new UDim2(0, 22, 0, 0)}
							Size={new UDim2(1, -22, 1, 0)}
							BackgroundTransparency={1}
							Text="Right Screen: Touch drag to pan & rotate"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Regular}
							TextSize={11}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
					</frame>

					<frame Size={new UDim2(1, 0, 0, 18)} BackgroundTransparency={1}>
						<LucideIcon name="aperture" size={new UDim2(0, 14, 0, 14)} color={Color3.fromHex("#38bdf8")} />
						<textlabel
							Position={new UDim2(0, 22, 0, 0)}
							Size={new UDim2(1, -22, 1, 0)}
							BackgroundTransparency={1}
							Text="Right Edge: iOS Camera Shutter & Zoom presets"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Regular}
							TextSize={11}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
					</frame>
				</frame>
			</scrollingframe>
		</frame>
	);
}

/**
 * OOP Class Adapter for CameraApp.
 */
export class CameraApp {
	private hostInstance: Instance;
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
			<CameraComponent
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
