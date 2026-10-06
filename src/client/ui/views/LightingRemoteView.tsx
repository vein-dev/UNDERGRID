import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, UserInputService } from "@rbxts/services";
import { AdminService } from "client/services/AdminService";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";
import {
	StageLightMode,
	StageLightingControlPayload,
	StageTarget,
} from "shared/types";
import { BACKDROP_GIF_PRESETS } from "shared/config";
import { StageCameraTab } from "./StageCameraTab";

type RemoteTab = "modes" | "colors" | "beam" | "fog" | "backdrop" | "camera";

export interface LightingRemoteComponentProps {
	visible: boolean;
	onClose?: () => void;
}

export function LightingRemoteComponent({ visible, onClose }: LightingRemoteComponentProps) {
	const adminService = AdminService.getInstance();
	const [adminState, setAdminState] = useState(() => adminService.getState());
	const [selectedStage, setSelectedStage] = useState<StageTarget>("main");
	const [activeTab, setActiveTab] = useState<RemoteTab>("modes");
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isMobile, setIsMobile] = useState(() => UserInputService.TouchEnabled);

	useEffect(() => {
		const conn = UserInputService.LastInputTypeChanged.Connect(() => {
			setIsMobile(UserInputService.TouchEnabled);
		});
		return () => conn.Disconnect();
	}, []);

	const [isFogDragging, setIsFogDragging] = useState(false);
	const [fogIntensityVal, setFogIntensityVal] = useState<number | undefined>(undefined);
	const fogTrackRef = useRef<Frame>();
	const lastSentFogRef = useRef<number>(0.5);

	const [isBackdropBrightnessDragging, setIsBackdropBrightnessDragging] = useState(false);
	const [backdropBrightnessPercentVal, setBackdropBrightnessPercentVal] = useState<number | undefined>(undefined);
	const backdropBrightnessTrackRef = useRef<Frame>();
	const lastSentBackdropBrightnessRef = useRef<number>(2.0);

	const [isBrightnessDragging, setIsBrightnessDragging] = useState(false);
	const [brightnessPercentVal, setBrightnessPercentVal] = useState<number | undefined>(undefined);
	const brightnessTrackRef = useRef<Frame>();
	const lastSentBrightnessRef = useRef<number>(2.5);

	const MAX_BRIGHTNESS = 6.0;

	const updateBrightnessFromInput = (inputX: number, forceSend = false) => {
		const track = brightnessTrackRef.current;
		if (!track) return;
		const trackX = track.AbsolutePosition.X;
		const trackWidth = track.AbsoluteSize.X;
		if (trackWidth <= 0) return;

		const relativeX = inputX - trackX;
		const ratio = math.clamp(relativeX / trackWidth, 0, 1);
		const newPercent = math.clamp(math.floor(ratio * 100 + 0.5), 1, 100);
		setBrightnessPercentVal(newPercent);

		const targetBrightnessVal = math.floor(((newPercent / 100) * MAX_BRIGHTNESS) * 100 + 0.5) / 100;
		if (forceSend || math.abs(targetBrightnessVal - lastSentBrightnessRef.current) >= 0.05) {
			lastSentBrightnessRef.current = targetBrightnessVal;
			adminService.setStageLighting({ brightness: targetBrightnessVal }, selectedStage);
		}
	};

	useEffect(() => {
		if (!isBrightnessDragging) return;

		const moveConn = UserInputService.InputChanged.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseMovement ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				updateBrightnessFromInput(input.Position.X, false);
			}
		});

		const endConn = UserInputService.InputEnded.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseButton1 ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				setIsBrightnessDragging(false);
				updateBrightnessFromInput(input.Position.X, true);
				setBrightnessPercentVal(undefined);
			}
		});

		return () => {
			moveConn.Disconnect();
			endConn.Disconnect();
		};
	}, [isBrightnessDragging]);

	const updateFogFromInput = (inputX: number, forceSend = false) => {
		const track = fogTrackRef.current;
		if (!track) return;
		const trackX = track.AbsolutePosition.X;
		const trackWidth = track.AbsoluteSize.X;
		if (trackWidth <= 0) return;

		const relativeX = inputX - trackX;
		const ratio = math.clamp(relativeX / trackWidth, 0, 1);
		const newIntensity = math.floor(ratio * 100 + 0.5) / 100;
		setFogIntensityVal(newIntensity);

		if (forceSend || math.abs(newIntensity - lastSentFogRef.current) >= 0.02) {
			lastSentFogRef.current = newIntensity;
			adminService.setStageLighting({ fogIntensity: newIntensity }, selectedStage);
		}
	};

	useEffect(() => {
		if (!isFogDragging) return;

		const moveConn = UserInputService.InputChanged.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseMovement ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				updateFogFromInput(input.Position.X, false);
			}
		});

		const endConn = UserInputService.InputEnded.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseButton1 ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				setIsFogDragging(false);
				updateFogFromInput(input.Position.X, true);
				setFogIntensityVal(undefined);
			}
		});

		return () => {
			moveConn.Disconnect();
			endConn.Disconnect();
		};
	}, [isFogDragging]);

	const updateBackdropBrightnessFromInput = (inputX: number, forceSend = false) => {
		const track = backdropBrightnessTrackRef.current;
		if (!track) return;
		const trackX = track.AbsolutePosition.X;
		const trackWidth = track.AbsoluteSize.X;
		if (trackWidth <= 0) return;

		const relativeX = inputX - trackX;
		const ratio = math.clamp(relativeX / trackWidth, 0, 1);
		const newPercent = math.clamp(math.floor(ratio * 100 + 0.5), 0, 100);
		setBackdropBrightnessPercentVal(newPercent);

		const targetVal = math.floor(((newPercent / 100) * 4.0) * 100 + 0.5) / 100;
		if (forceSend || math.abs(targetVal - lastSentBackdropBrightnessRef.current) >= 0.1) {
			lastSentBackdropBrightnessRef.current = targetVal;
			adminService.setStageLighting({ backdropBrightness: targetVal }, selectedStage);
		}
	};

	useEffect(() => {
		if (!isBackdropBrightnessDragging) return;

		const moveConn = UserInputService.InputChanged.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseMovement ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				updateBackdropBrightnessFromInput(input.Position.X, false);
			}
		});

		const endConn = UserInputService.InputEnded.Connect((input) => {
			if (
				input.UserInputType === Enum.UserInputType.MouseButton1 ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				setIsBackdropBrightnessDragging(false);
				updateBackdropBrightnessFromInput(input.Position.X, true);
				setBackdropBrightnessPercentVal(undefined);
			}
		});

		return () => {
			moveConn.Disconnect();
			endConn.Disconnect();
		};
	}, [isBackdropBrightnessDragging]);

	useEffect(() => {
		const unsub = adminService.onStateUpdated((newState) => {
			setAdminState({ ...newState });
		});
		return () => unsub();
	}, []);

	if (!visible) return <></>;

	const stageLighting: StageLightingControlPayload =
		(selectedStage === "dj" ? adminState.djStageLighting : adminState.stageLighting) ?? {
			mode: StageLightMode.Off,
			panAngle: 0,
			tiltAngle: 0,
			motorSpeed: 0.04,
			color: selectedStage === "dj" ? Color3.fromRGB(0, 255, 255) : Color3.fromRGB(180, 240, 255),
			brightness: selectedStage === "dj" ? 3.5 : 4.5,
			beamEnabled: false,
			strobeSpeed: 0,
			isRainbow: false,
			isPulse: false,
			isMusicSync: false,
			fogEnabled: false,
			fogIntensity: 0.6,
		};

	const currentFogIntensity = fogIntensityVal ?? stageLighting.fogIntensity ?? 0.5;
	const currentBrightnessPercent =
		brightnessPercentVal ??
		math.clamp(math.floor(((stageLighting.brightness ?? 2.5) / MAX_BRIGHTNESS) * 100 + 0.5), 1, 100);

	const motionModes: Array<{ mode: StageLightMode; label: string; icon: string }> = [
		{ mode: StageLightMode.MusicSync, label: "Sync Musik", icon: "music" },
		{
			mode: StageLightMode.SpotlightCenter,
			label: selectedStage === "dj" ? "Fokus DJ" : "Fokus Stage",
			icon: "target",
		},
		{ mode: StageLightMode.Wave, label: "Wave", icon: "activity" },
		{ mode: StageLightMode.Circle, label: "Orbit", icon: "compass" },
		{ mode: StageLightMode.Ballyhoo, label: "Ballyhoo", icon: "sparkles" },
		{ mode: StageLightMode.CrossFire, label: "CrossFire", icon: "scissors" },
		{ mode: StageLightMode.FanSpread, label: "Fan Wings", icon: "sun" },
		{ mode: StageLightMode.Searchlight, label: "Searchlight", icon: "radar" },
		{ mode: StageLightMode.Off, label: "Standby", icon: "circle-stop" },
	];

	const colorPalette: Array<{ name: string; hex: string; color: Color3 }> = [
		{ name: "Putih", hex: "#ffffff", color: Color3.fromRGB(255, 255, 255) },
		{ name: "Cyan", hex: "#00ffff", color: Color3.fromRGB(0, 255, 255) },
		{ name: "Magenta", hex: "#d946ef", color: Color3.fromRGB(217, 70, 239) },
		{ name: "Hijau", hex: "#22c55e", color: Color3.fromRGB(34, 197, 94) },
		{ name: "Kuning", hex: "#eab308", color: Color3.fromRGB(234, 179, 8) },
		{ name: "Merah", hex: "#ef4444", color: Color3.fromRGB(239, 68, 68) },
		{ name: "Oranye", hex: "#f97316", color: Color3.fromRGB(249, 115, 22) },
		{ name: "Pink", hex: "#ec4899", color: Color3.fromRGB(236, 72, 153) },
	];

	const speedPresets = [
		{ label: "Kalem", val: 0.02 },
		{ label: "Normal", val: 0.04 },
		{ label: "Cepat", val: 0.08 },
	];



	const strobePresets = [
		{ label: "Off", speed: 0 },
		{ label: "Beat (1/4)", speed: 1 },
		{ label: "1/8", speed: 2 },
		{ label: "1/16", speed: 3 },
		{ label: "32nd", speed: 4 },
	];

	// ─── Render Minimized Status Pill ──────────────────────────────────────────
	if (isCollapsed) {
		return (
			<textbutton
				key="LightingRemotePill"
				Position={isMobile ? new UDim2(1, -12, 0.72, 0) : new UDim2(1, -24, 0.75, 0)}
				AnchorPoint={new Vector2(1, 0.5)}
				Size={isMobile ? new UDim2(0, 190, 0, 38) : new UDim2(0, 230, 0, 44)}
				BackgroundColor3={Color3.fromHex("#0a0a0a")}
				BackgroundTransparency={0.25}
				Text=""
				AutoButtonColor={false}
				Event={{
					MouseButton1Click: () => setIsCollapsed(false),
				}}
			>
				<uicorner CornerRadius={new UDim(0, isMobile ? 19 : 22)} />
				<uistroke
					Color={stageLighting.color}
					Transparency={0.4}
					Thickness={1.5}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				<uipadding
					PaddingLeft={new UDim(0, isMobile ? 10 : 12)}
					PaddingRight={new UDim(0, isMobile ? 10 : 12)}
					PaddingTop={new UDim(0, 4)}
					PaddingBottom={new UDim(0, 4)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					HorizontalAlignment={Enum.HorizontalAlignment.Left}
					Padding={new UDim(0, isMobile ? 6 : 8)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>

				{/* Dot color indicator */}
				<frame
					LayoutOrder={1}
					Size={new UDim2(0, isMobile ? 10 : 12, 0, isMobile ? 10 : 12)}
					BackgroundColor3={stageLighting.color}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(1, 0)} />
				</frame>

				{/* Info Text */}
				<frame LayoutOrder={2} Size={new UDim2(1, isMobile ? -42 : -54, 1, 0)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<textlabel
						LayoutOrder={1}
						Size={new UDim2(1, 0, 0, isMobile ? 12 : 14)}
						BackgroundTransparency={1}
						Text={selectedStage === "dj" ? "STAGE DJ LIVE" : "MAIN STAGE LIVE"}
						TextColor3={selectedStage === "dj" ? Color3.fromHex("#38bdf8") : Color3.fromHex("#94a3b8")}
						TextSize={isMobile ? 8 : 9}
						Font={Fonts.Bold}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<textlabel
						LayoutOrder={2}
						Size={new UDim2(1, 0, 0, isMobile ? 14 : 16)}
						BackgroundTransparency={1}
						Text={
							stageLighting.mode === StageLightMode.SpotlightCenter
								? selectedStage === "dj"
									? "Fokus DJ"
									: "Fokus Stage"
								: stageLighting.mode
						}
						TextColor3={Color3.fromHex("#ffffff")}
						TextSize={isMobile ? 10.5 : 12}
						Font={Fonts.Medium}
						TextXAlignment={Enum.TextXAlignment.Left}
						TextTruncate={Enum.TextTruncate.AtEnd}
					/>
				</frame>

				{/* Expand Icon */}
				<frame LayoutOrder={3} Size={new UDim2(0, isMobile ? 16 : 20, 0, isMobile ? 16 : 20)} BackgroundTransparency={1}>
					<LucideIcon name="maximize-2" size={UDim2.fromOffset(isMobile ? 14 : 16, isMobile ? 14 : 16)} color={Color3.fromHex("#ffffff")} />
				</frame>
			</textbutton>
		);
	}

	// ─── Render Full Floating HUD ──────────────────────────────────────────────
	return (
		<frame
			key="LightingRemoteHUD"
			Position={isMobile ? new UDim2(1, -12, 0.5, 0) : new UDim2(1, -24, 0.5, 0)}
			AnchorPoint={new Vector2(1, 0.5)}
			Size={isMobile ? new UDim2(0, 270, 0.92, 0) : new UDim2(0, 310, 0, 450)}
			BackgroundColor3={Color3.fromHex("#0a0a0a")}
			BackgroundTransparency={0.2}
			BorderSizePixel={0}
			Active={true}
		>
			<uisizeconstraint MaxSize={new Vector2(310, 450)} MinSize={new Vector2(250, 260)} />
			<uicorner CornerRadius={new UDim(0, isMobile ? 14 : 18)} />
			<uistroke
				Color={Color3.fromRGB(255, 255, 255)}
				Transparency={0.86}
				Thickness={1}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>
			<uipadding
				PaddingLeft={new UDim(0, isMobile ? 10 : 14)}
				PaddingRight={new UDim(0, isMobile ? 10 : 14)}
				PaddingTop={new UDim(0, isMobile ? 8 : 14)}
				PaddingBottom={new UDim(0, isMobile ? 8 : 14)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Vertical}
				SortOrder={Enum.SortOrder.LayoutOrder}
				Padding={new UDim(0, isMobile ? 6 : 10)}
			/>

			{/* ─── Header ─── */}
			<frame LayoutOrder={1} Size={new UDim2(1, 0, 0, isMobile ? 28 : 34)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>

				<frame LayoutOrder={1} Size={new UDim2(1, isMobile ? -56 : -70, 1, 0)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, isMobile ? 6 : 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<frame LayoutOrder={1} Size={new UDim2(0, isMobile ? 24 : 28, 0, isMobile ? 24 : 28)} BackgroundColor3={stageLighting.color} BackgroundTransparency={0.2}>
						<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
						<LucideIcon
							name={selectedStage === "dj" ? "headphones" : "activity"}
							size={UDim2.fromOffset(isMobile ? 13 : 16, isMobile ? 13 : 16)}
							color={Color3.fromRGB(255, 255, 255)}
						/>
					</frame>
					<frame LayoutOrder={2} Size={new UDim2(1, isMobile ? -30 : -36, 1, 0)} BackgroundTransparency={1}>
						<uilistlayout FillDirection={Enum.FillDirection.Vertical} VerticalAlignment={Enum.VerticalAlignment.Center} />
						<textlabel
							Size={new UDim2(1, 0, 0, isMobile ? 14 : 16)}
							BackgroundTransparency={1}
							Text={selectedStage === "dj" ? "DJ STAGE CONTROLLER" : "STAGE CONTROLLER"}
							TextColor3={Color3.fromHex("#ffffff")}
							TextSize={isMobile ? 10.5 : 12}
							Font={Fonts.Bold}
							TextXAlignment={Enum.TextXAlignment.Left}
							TextTruncate={Enum.TextTruncate.AtEnd}
						/>
						<textlabel
							Size={new UDim2(1, 0, 0, isMobile ? 10 : 12)}
							BackgroundTransparency={1}
							Text={selectedStage === "dj" ? "Fokus Objek FocusDJLighting" : "Live Concert Stage & DMX"}
							TextColor3={selectedStage === "dj" ? Color3.fromHex("#38bdf8") : Color3.fromHex("#94a3b8")}
							TextSize={isMobile ? 8 : 9}
							Font={Fonts.Regular}
							TextXAlignment={Enum.TextXAlignment.Left}
							TextTruncate={Enum.TextTruncate.AtEnd}
						/>
					</frame>
				</frame>

				{/* Header Actions: Minimize & Close */}
				<frame LayoutOrder={2} Size={new UDim2(0, isMobile ? 54 : 64, 0, isMobile ? 24 : 28)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Right}
						Padding={new UDim(0, isMobile ? 4 : 6)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{/* Minimize Button */}
					<textbutton
						LayoutOrder={1}
						Size={new UDim2(0, isMobile ? 24 : 28, 0, isMobile ? 24 : 28)}
						BackgroundColor3={Color3.fromHex("#1f2937")}
						BackgroundTransparency={0.4}
						Text=""
						AutoButtonColor={true}
						Event={{
							MouseButton1Click: () => setIsCollapsed(true),
						}}
					>
						<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
						<LucideIcon name="minimize-2" size={UDim2.fromOffset(isMobile ? 12 : 14, isMobile ? 12 : 14)} color={Color3.fromHex("#d1d5db")} />
					</textbutton>
					{/* Close Button */}
					<textbutton
						LayoutOrder={2}
						Size={new UDim2(0, isMobile ? 24 : 28, 0, isMobile ? 24 : 28)}
						BackgroundColor3={Color3.fromHex("#1f2937")}
						BackgroundTransparency={0.4}
						Text=""
						AutoButtonColor={true}
						Event={{
							MouseButton1Click: () => {
								if (onClose) onClose();
							},
						}}
					>
						<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
						<LucideIcon name="x" size={UDim2.fromOffset(isMobile ? 12 : 14, isMobile ? 12 : 14)} color={Color3.fromHex("#ef4444")} />
					</textbutton>
				</frame>
			</frame>

			{/* ─── Stage Target Selector (Main Stage vs DJ Stage) ─── */}
			<frame
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, isMobile ? 26 : 30)}
				BackgroundColor3={Color3.fromHex("#111827")}
				BackgroundTransparency={0.5}
			>
				<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, 4)}
				/>
				<uipadding
					PaddingLeft={new UDim(0, 3)}
					PaddingRight={new UDim(0, 3)}
					PaddingTop={new UDim(0, 2)}
					PaddingBottom={new UDim(0, 2)}
				/>
				{/* Main Stage Option */}
				<textbutton
					LayoutOrder={1}
					Size={new UDim2(0.5, -2, 1, 0)}
					BackgroundColor3={selectedStage === "main" ? Color3.fromHex("#2563eb") : Color3.fromRGB(0, 0, 0)}
					BackgroundTransparency={selectedStage === "main" ? 0.2 : 1}
					Text=""
					AutoButtonColor={true}
					Event={{
						MouseButton1Click: () => setSelectedStage("main"),
					}}
				>
					<uicorner CornerRadius={new UDim(0, isMobile ? 5 : 6)} />
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, isMobile ? 4 : 6)}
					/>
					<LucideIcon
						name="mic"
						size={UDim2.fromOffset(isMobile ? 11 : 13, isMobile ? 11 : 13)}
						color={selectedStage === "main" ? Color3.fromRGB(255, 255, 255) : Color3.fromHex("#94a3b8")}
					/>
					<textlabel
						Size={new UDim2(0, isMobile ? 70 : 85, 1, 0)}
						BackgroundTransparency={1}
						Text="MAIN STAGE"
						TextColor3={selectedStage === "main" ? Color3.fromRGB(255, 255, 255) : Color3.fromHex("#94a3b8")}
						Font={selectedStage === "main" ? Fonts.Bold : Fonts.Medium}
						TextSize={isMobile ? 9 : 10}
						TextXAlignment={Enum.TextXAlignment.Center}
					/>
				</textbutton>

				{/* DJ Stage Option */}
				<textbutton
					LayoutOrder={2}
					Size={new UDim2(0.5, -2, 1, 0)}
					BackgroundColor3={selectedStage === "dj" ? Color3.fromHex("#0891b2") : Color3.fromRGB(0, 0, 0)}
					BackgroundTransparency={selectedStage === "dj" ? 0.2 : 1}
					Text=""
					AutoButtonColor={true}
					Event={{
						MouseButton1Click: () => setSelectedStage("dj"),
					}}
				>
					<uicorner CornerRadius={new UDim(0, isMobile ? 5 : 6)} />
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						Padding={new UDim(0, isMobile ? 4 : 6)}
					/>
					<LucideIcon
						name="headphones"
						size={UDim2.fromOffset(isMobile ? 11 : 13, isMobile ? 11 : 13)}
						color={selectedStage === "dj" ? Color3.fromRGB(255, 255, 255) : Color3.fromHex("#94a3b8")}
					/>
					<textlabel
						Size={new UDim2(0, isMobile ? 70 : 85, 1, 0)}
						BackgroundTransparency={1}
						Text="STAGE DJ"
						TextColor3={selectedStage === "dj" ? Color3.fromRGB(255, 255, 255) : Color3.fromHex("#94a3b8")}
						Font={selectedStage === "dj" ? Fonts.Bold : Fonts.Medium}
						TextSize={isMobile ? 9 : 10}
						TextXAlignment={Enum.TextXAlignment.Center}
					/>
				</textbutton>
			</frame>

			{/* ─── Navigation Tabs ─── */}
			<frame
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, isMobile ? 26 : 32)}
				BackgroundColor3={Color3.fromHex("#111827")}
				BackgroundTransparency={0.5}
			>
				<uicorner CornerRadius={new UDim(0, isMobile ? 8 : 10)} />
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{(
					[
						{ id: "modes", label: "Modes", icon: "activity" },
						{ id: "colors", label: "Colors", icon: "palette" },
						{ id: "beam", label: "Beam", icon: "sun" },
						{ id: "fog", label: "Fog", icon: "cloud" },
						{ id: "backdrop", label: "Screen", icon: "image" },
						{ id: "camera", label: "Cam", icon: "camera" },
					] as Array<{ id: RemoteTab; label: string; icon: string }>
				).map((tab, idx) => {
					const isActive = activeTab === tab.id;
					return (
						<textbutton
							key={`tab_${tab.id}`}
							LayoutOrder={idx}
							Size={new UDim2(1 / 6, 0, 1, 0)}
							BackgroundColor3={isActive ? Color3.fromHex("#3b82f6") : Color3.fromRGB(0, 0, 0)}
							BackgroundTransparency={isActive ? 0.2 : 1}
							Text={tab.label}
							TextColor3={isActive ? Color3.fromHex("#ffffff") : Color3.fromHex("#94a3b8")}
							Font={isActive ? Fonts.Bold : Fonts.Medium}
							TextSize={isMobile ? 7.5 : 8.5}
							Event={{
								MouseButton1Click: () => setActiveTab(tab.id),
							}}
						>
							<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
						</textbutton>
					);
				})}
			</frame>

			{/* ─── Content Body ─── */}
			<scrollingframe
				LayoutOrder={4}
				Size={new UDim2(1, 0, 1, isMobile ? -94 : -126)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ScrollBarThickness={isMobile ? 2 : 3}
				ScrollBarImageColor3={Color3.fromHex("#4b5563")}
				CanvasSize={new UDim2(0, 0, 0, 0)}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, isMobile ? 6 : 10)}
				/>

				{/* ───────── TAB 1: MODES ───────── */}
				{activeTab === "modes" && (
					<>
						<textlabel
							LayoutOrder={1}
							Size={new UDim2(1, 0, 0, isMobile ? 12 : 14)}
							BackgroundTransparency={1}
							Text="KOREOGRAFI PANGGUNG"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={isMobile ? 8.5 : 10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						{/* 2-Column Grid for Modes */}
						<frame LayoutOrder={2} AutomaticSize={Enum.AutomaticSize.Y} Size={new UDim2(1, 0, 0, 0)} BackgroundTransparency={1}>
							<uigridlayout
								CellSize={new UDim2(0.5, -4, 0, isMobile ? 34 : 42)}
								CellPadding={new UDim2(0, isMobile ? 6 : 8, 0, isMobile ? 6 : 8)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{motionModes.map((item, idx) => {
								const isSelected = stageLighting.mode === item.mode;
								return (
									<textbutton
										key={`mode_${item.mode}`}
										LayoutOrder={idx}
										BackgroundColor3={isSelected ? Color3.fromHex("#2563eb") : Color3.fromHex("#1f2937")}
										BackgroundTransparency={isSelected ? 0.2 : 0.6}
										Text=""
										AutoButtonColor={true}
										Event={{
											MouseButton1Click: () => {
												adminService.setStageLighting({ mode: item.mode }, selectedStage);
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, isMobile ? 8 : 10)} />
										<uistroke
											Color={isSelected ? Color3.fromHex("#60a5fa") : Color3.fromRGB(255, 255, 255)}
											Transparency={isSelected ? 0.3 : 0.9}
											Thickness={1}
										/>
										<uipadding PaddingLeft={new UDim(0, isMobile ? 6 : 8)} PaddingRight={new UDim(0, isMobile ? 6 : 8)} />
										<uilistlayout
											FillDirection={Enum.FillDirection.Horizontal}
											VerticalAlignment={Enum.VerticalAlignment.Center}
											Padding={new UDim(0, isMobile ? 5 : 6)}
											SortOrder={Enum.SortOrder.LayoutOrder}
										/>
										<LucideIcon
											name={item.icon}
											size={UDim2.fromOffset(isMobile ? 12 : 14, isMobile ? 12 : 14)}
											color={isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#94a3b8")}
										/>
										<textlabel
											Size={new UDim2(1, isMobile ? -18 : -22, 1, 0)}
											BackgroundTransparency={1}
											Text={item.label}
											TextColor3={isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#d1d5db")}
											Font={isSelected ? Fonts.Bold : Fonts.Medium}
											TextSize={isMobile ? 8.5 : 10}
											TextXAlignment={Enum.TextXAlignment.Left}
											TextTruncate={Enum.TextTruncate.AtEnd}
										/>
									</textbutton>
								);
							})}
						</frame>

						{/* Motor Speed Presets */}
						<textlabel
							LayoutOrder={3}
							Size={new UDim2(1, 0, 0, isMobile ? 12 : 14)}
							BackgroundTransparency={1}
							Text="KECEPATAN GERAK MOTOR"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={isMobile ? 8.5 : 10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<frame LayoutOrder={4} Size={new UDim2(1, 0, 0, isMobile ? 26 : 32)} BackgroundTransparency={1}>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								Padding={new UDim(0, isMobile ? 5 : 6)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{speedPresets.map((sp, idx) => {
								const isCurrent = math.abs(stageLighting.motorSpeed - sp.val) < 0.005;
								return (
									<textbutton
										key={`speed_${sp.label}`}
										LayoutOrder={idx}
										Size={new UDim2(0.333, -4, 1, 0)}
										BackgroundColor3={isCurrent ? Color3.fromHex("#059669") : Color3.fromHex("#1f2937")}
										BackgroundTransparency={isCurrent ? 0.2 : 0.6}
										Text={sp.label}
										TextColor3={Color3.fromHex("#ffffff")}
										Font={isCurrent ? Fonts.Bold : Fonts.Regular}
										TextSize={isMobile ? 8.5 : 10}
										Event={{
											MouseButton1Click: () => {
												adminService.setStageLighting({ motorSpeed: sp.val }, selectedStage);
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
										<uistroke
											Color={isCurrent ? Color3.fromHex("#34d399") : Color3.fromRGB(255, 255, 255)}
											Transparency={isCurrent ? 0.3 : 0.9}
											Thickness={1}
										/>
									</textbutton>
								);
							})}
						</frame>
					</>
				)}

				{/* ───────── TAB 2: COLORS & ATMOSPHERE ───────── */}
				{activeTab === "colors" && (
					<>
						<textlabel
							LayoutOrder={1}
							Size={new UDim2(1, 0, 0, isMobile ? 12 : 14)}
							BackgroundTransparency={1}
							Text="PALET WARNA LAMPU (8 WARNA)"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={isMobile ? 8.5 : 10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						{/* 4-Column Grid for Colors */}
						<frame LayoutOrder={2} Size={new UDim2(1, 0, 0, isMobile ? 58 : 72)} BackgroundTransparency={1}>
							<uigridlayout
								CellSize={new UDim2(0.25, -6, 0, isMobile ? 25 : 32)}
								CellPadding={new UDim2(0, isMobile ? 6 : 8, 0, isMobile ? 6 : 8)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{colorPalette.map((cp, idx) => {
								const isSelected =
									math.floor(stageLighting.color.R * 255) === math.floor(cp.color.R * 255) &&
									math.floor(stageLighting.color.G * 255) === math.floor(cp.color.G * 255) &&
									math.floor(stageLighting.color.B * 255) === math.floor(cp.color.B * 255);
								return (
									<textbutton
										key={`color_${cp.name}`}
										LayoutOrder={idx}
										BackgroundColor3={cp.color}
										Text=""
										AutoButtonColor={true}
										Event={{
											MouseButton1Click: () => {
												adminService.setStageLighting(
													{
														color: cp.color,
														isRainbow: false,
													},
													selectedStage,
												);
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
										{isSelected && (
											<uistroke
												Color={Color3.fromHex("#ffffff")}
												Thickness={isMobile ? 2 : 2.5}
												ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
											/>
										)}
									</textbutton>
								);
							})}
						</frame>

						{/* Rainbow & Beat Pulse Toggles */}
						<textlabel
							LayoutOrder={3}
							Size={new UDim2(1, 0, 0, isMobile ? 12 : 14)}
							BackgroundTransparency={1}
							Text="EFEK WARNA DINAMIS"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={isMobile ? 8.5 : 10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<frame LayoutOrder={4} Size={new UDim2(1, 0, 0, isMobile ? 28 : 34)} BackgroundTransparency={1}>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								Padding={new UDim(0, isMobile ? 6 : 8)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{/* Rainbow Toggle */}
							<textbutton
								LayoutOrder={1}
								Size={new UDim2(0.5, -4, 1, 0)}
								BackgroundColor3={stageLighting.isRainbow ? Color3.fromHex("#9333ea") : Color3.fromHex("#1f2937")}
								BackgroundTransparency={stageLighting.isRainbow ? 0.2 : 0.6}
								Text={stageLighting.isRainbow ? "Rainbow: ON" : "Rainbow: OFF"}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={isMobile ? 8.5 : 10}
								Event={{
									MouseButton1Click: () => {
										adminService.setStageLighting(
											{ isRainbow: !stageLighting.isRainbow },
											selectedStage,
										);
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
							</textbutton>
							{/* Beat Pulse Toggle */}
							<textbutton
								LayoutOrder={2}
								Size={new UDim2(0.5, -4, 1, 0)}
								BackgroundColor3={stageLighting.isPulse ? Color3.fromHex("#d97706") : Color3.fromHex("#1f2937")}
								BackgroundTransparency={stageLighting.isPulse ? 0.2 : 0.6}
								Text={stageLighting.isPulse ? "Pulse: ON" : "Pulse: OFF"}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={isMobile ? 8.5 : 10}
								Event={{
									MouseButton1Click: () => {
										adminService.setStageLighting({ isPulse: !stageLighting.isPulse }, selectedStage);
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
							</textbutton>
						</frame>

					</>
				)}

				{/* ───────── TAB 3: BEAM & INTENSITY ───────── */}
				{activeTab === "beam" && (
					<>
						{/* Beam On/Off Switch */}
						<textlabel
							LayoutOrder={1}
							Size={new UDim2(1, 0, 0, isMobile ? 12 : 14)}
							BackgroundTransparency={1}
							Text="BEAM LAMPU SOROT"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={isMobile ? 8.5 : 10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<textbutton
							LayoutOrder={2}
							Size={new UDim2(1, 0, 0, isMobile ? 30 : 36)}
							BackgroundColor3={stageLighting.beamEnabled ? Color3.fromHex("#16a34a") : Color3.fromHex("#dc2626")}
							BackgroundTransparency={0.25}
							Text={stageLighting.beamEnabled ? "BEAM NYALA (VISIBLE)" : "BEAM MATI (HIDDEN)"}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={isMobile ? 9.5 : 11}
							Event={{
								MouseButton1Click: () => {
									adminService.setStageLighting(
										{ beamEnabled: !stageLighting.beamEnabled },
										selectedStage,
									);
								},
							}}
						>
							<uicorner CornerRadius={new UDim(0, isMobile ? 8 : 10)} />
						</textbutton>

						{/* Brightness Slider (Intensitas 1 - 100) */}
						<frame LayoutOrder={3} Size={new UDim2(1, 0, 0, isMobile ? 12 : 14)} BackgroundTransparency={1}>
							<uilistlayout FillDirection={Enum.FillDirection.Horizontal} />
							<textlabel
								Size={new UDim2(0.7, 0, 1, 0)}
								BackgroundTransparency={1}
								Text="TINGKAT KECERAHAN (BRIGHTNESS)"
								TextColor3={Color3.fromHex("#94a3b8")}
								Font={Fonts.Bold}
								TextSize={isMobile ? 8.5 : 10}
								TextXAlignment={Enum.TextXAlignment.Left}
							/>
							<textlabel
								Size={new UDim2(0.3, 0, 1, 0)}
								BackgroundTransparency={1}
								Text={`${currentBrightnessPercent}%`}
								TextColor3={Color3.fromHex("#eab308")}
								Font={Fonts.Bold}
								TextSize={isMobile ? 8.5 : 10}
								TextXAlignment={Enum.TextXAlignment.Right}
							/>
						</frame>

						{/* Slider Track and Thumb */}
						<frame LayoutOrder={4} Size={new UDim2(1, 0, 0, isMobile ? 22 : 28)} BackgroundTransparency={1}>
							<frame
								key="RemoteBrightnessTrack"
								ref={brightnessTrackRef}
								AnchorPoint={new Vector2(0, 0.5)}
								Position={new UDim2(0, 0, 0.5, 0)}
								Size={new UDim2(1, 0, 0, isMobile ? 6 : 8)}
								BackgroundColor3={Color3.fromHex("#1f2937")}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
								<frame
									key="RemoteBrightnessFill"
									Size={new UDim2(currentBrightnessPercent / 100, 0, 1, 0)}
									BackgroundColor3={Color3.fromHex("#ca8a04")}
								>
									<uicorner CornerRadius={new UDim(1, 0)} />
								</frame>
								<frame
									key="RemoteBrightnessThumb"
									AnchorPoint={new Vector2(0.5, 0.5)}
									Position={new UDim2(currentBrightnessPercent / 100, 0, 0.5, 0)}
									Size={new UDim2(0, isMobile ? 14 : 18, 0, isMobile ? 14 : 18)}
									BackgroundColor3={Color3.fromHex("#ffffff")}
								>
									<uicorner CornerRadius={new UDim(1, 0)} />
									<uistroke Color={Color3.fromHex("#ca8a04")} Thickness={isMobile ? 1.5 : 2} />
								</frame>
							</frame>

							{/* Hitbox Button for Drag & Click */}
							<textbutton
								key="RemoteBrightnessHitbox"
								Position={new UDim2(0, 0, 0, 0)}
								Size={new UDim2(1, 0, 1, 0)}
								BackgroundTransparency={1}
								Text=""
								AutoButtonColor={false}
								ZIndex={5}
								Event={{
									InputBegan: (_, input) => {
										if (
											input.UserInputType === Enum.UserInputType.MouseButton1 ||
											input.UserInputType === Enum.UserInputType.Touch
										) {
											setIsBrightnessDragging(true);
											updateBrightnessFromInput(input.Position.X, true);
										}
									},
								}}
							/>
						</frame>

						{/* Strobe Speed Presets */}
						<textlabel
							LayoutOrder={5}
							Size={new UDim2(1, 0, 0, isMobile ? 12 : 14)}
							BackgroundTransparency={1}
							Text="KEDIP STROBE SPEED:"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={isMobile ? 8 : 9}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<frame LayoutOrder={6} Size={new UDim2(1, 0, 0, isMobile ? 24 : 30)} BackgroundTransparency={1}>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								Padding={new UDim(0, isMobile ? 4 : 5)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{strobePresets.map((stp, idx) => {
								const isSelected = stageLighting.strobeSpeed === stp.speed;
								return (
									<textbutton
										key={`strobe_${stp.speed}`}
										LayoutOrder={idx}
										Size={new UDim2(0.2, -4, 1, 0)}
										BackgroundColor3={
											isSelected ? Color3.fromHex("#ffcc00") : Color3.fromHex("#202020")
										}
										BackgroundTransparency={isSelected ? 0 : 0.4}
										Text={stp.label}
										TextColor3={
											isSelected ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")
										}
										Font={Fonts.Bold}
										TextSize={isMobile ? 7.5 : 9}
										AutoButtonColor={false}
										Event={{
											MouseButton1Click: () => {
												adminService.setStageLighting({ strobeSpeed: stp.speed }, selectedStage);
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
										{isSelected && (
											<uistroke
												Color={Color3.fromHex("#ffe066")}
												Thickness={1.2}
												ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
											/>
										)}
									</textbutton>
								);
							})}
						</frame>
					</>
				)}

				{/* ───────── TAB 4: FOG MACHINE ───────── */}
				{activeTab === "fog" && (
					<>
						<textlabel
							LayoutOrder={1}
							Size={new UDim2(1, 0, 0, isMobile ? 12 : 14)}
							BackgroundTransparency={1}
							Text="MESIN ASAP PANGGUNG (FOG MACHINE)"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={isMobile ? 8.5 : 10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>

						{/* On/Off and Burst Buttons */}
						<frame LayoutOrder={2} Size={new UDim2(1, 0, 0, isMobile ? 30 : 36)} BackgroundTransparency={1}>
							<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, isMobile ? 6 : 8)} />
							{/* Toggle Fog On/Off */}
							<textbutton
								LayoutOrder={1}
								Size={new UDim2(0.5, -4, 1, 0)}
								BackgroundColor3={
									stageLighting.fogEnabled
										? Color3.fromHex("#0284c7")
										: Color3.fromHex("#1f2937")
								}
								BackgroundTransparency={stageLighting.fogEnabled ? 0.2 : 0.6}
								Text={stageLighting.fogEnabled ? "FOG: AKTIF" : "FOG: MATI"}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={isMobile ? 9.5 : 11}
								AutoButtonColor={true}
								Event={{
									MouseButton1Click: () => {
										adminService.setStageLighting(
											{
												fogEnabled: !stageLighting.fogEnabled,
											},
											selectedStage,
										);
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, isMobile ? 8 : 10)} />
								<uistroke
									Color={stageLighting.fogEnabled ? Color3.fromHex("#38bdf8") : Color3.fromRGB(255, 255, 255)}
									Transparency={stageLighting.fogEnabled ? 0.3 : 0.9}
									Thickness={1}
								/>
							</textbutton>

							{/* Trigger Burst */}
							<textbutton
								LayoutOrder={2}
								Size={new UDim2(0.5, -4, 1, 0)}
								BackgroundColor3={Color3.fromHex("#7c3aed")}
								BackgroundTransparency={0.2}
								Text="BURST ASAP"
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={isMobile ? 9.5 : 11}
								AutoButtonColor={true}
								Event={{
									MouseButton1Click: () => {
										adminService.triggerFogBurst(selectedStage);
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, isMobile ? 8 : 10)} />
								<uistroke
									Color={Color3.fromHex("#a78bfa")}
									Transparency={0.4}
									Thickness={1}
								/>
							</textbutton>
						</frame>

						{/* Fog Intensity Label & Value */}
						<frame LayoutOrder={3} Size={new UDim2(1, 0, 0, isMobile ? 12 : 14)} BackgroundTransparency={1}>
							<uilistlayout FillDirection={Enum.FillDirection.Horizontal} />
							<textlabel
								Size={new UDim2(0.7, 0, 1, 0)}
								BackgroundTransparency={1}
								Text="INTENSITAS ASAP"
								TextColor3={Color3.fromHex("#94a3b8")}
								Font={Fonts.Bold}
								TextSize={isMobile ? 8.5 : 10}
								TextXAlignment={Enum.TextXAlignment.Left}
							/>
							<textlabel
								Size={new UDim2(0.3, 0, 1, 0)}
								BackgroundTransparency={1}
								Text={`${math.floor(currentFogIntensity * 100 + 0.5)}%`}
								TextColor3={Color3.fromHex("#38bdf8")}
								Font={Fonts.Bold}
								TextSize={isMobile ? 8.5 : 10}
								TextXAlignment={Enum.TextXAlignment.Right}
							/>
						</frame>

						{/* Slider Track and Thumb */}
						<frame LayoutOrder={4} Size={new UDim2(1, 0, 0, isMobile ? 22 : 28)} BackgroundTransparency={1}>
							<frame
								key="RemoteFogTrack"
								ref={fogTrackRef}
								AnchorPoint={new Vector2(0, 0.5)}
								Position={new UDim2(0, 0, 0.5, 0)}
								Size={new UDim2(1, 0, 0, isMobile ? 6 : 8)}
								BackgroundColor3={Color3.fromHex("#1f2937")}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
								<frame
									key="RemoteFogFill"
									Size={new UDim2(currentFogIntensity, 0, 1, 0)}
									BackgroundColor3={Color3.fromHex("#0284c7")}
								>
									<uicorner CornerRadius={new UDim(1, 0)} />
								</frame>
								<frame
									key="RemoteFogThumb"
									AnchorPoint={new Vector2(0.5, 0.5)}
									Position={new UDim2(currentFogIntensity, 0, 0.5, 0)}
									Size={new UDim2(0, isMobile ? 14 : 18, 0, isMobile ? 14 : 18)}
									BackgroundColor3={Color3.fromHex("#ffffff")}
								>
									<uicorner CornerRadius={new UDim(1, 0)} />
									<uistroke Color={Color3.fromHex("#0284c7")} Thickness={isMobile ? 1.5 : 2} />
								</frame>
							</frame>

							{/* Hitbox Button for Drag & Click */}
							<textbutton
								key="RemoteFogHitbox"
								Position={new UDim2(0, 0, 0, 0)}
								Size={new UDim2(1, 0, 1, 0)}
								BackgroundTransparency={1}
								Text=""
								AutoButtonColor={false}
								ZIndex={5}
								Event={{
									InputBegan: (_, input) => {
										if (
											input.UserInputType === Enum.UserInputType.MouseButton1 ||
											input.UserInputType === Enum.UserInputType.Touch
										) {
											setIsFogDragging(true);
											updateFogFromInput(input.Position.X, true);
										}
									},
								}}
							/>
						</frame>
					</>
				)}

				{/* ─── TAB 5: BACKDROP (ANIMATED GIF / SCREEN) ─── */}
				{activeTab === "backdrop" && (
					<>
						{/* Info / Title Header */}
						<frame LayoutOrder={1} Size={new UDim2(1, 0, 0, isMobile ? 18 : 22)} BackgroundTransparency={1}>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							<textlabel
								Size={new UDim2(0.7, 0, 1, 0)}
								BackgroundTransparency={1}
								Text="STAGE BACKDROP (ANIMATED GIF)"
								TextColor3={Color3.fromHex("#94a3b8")}
								Font={Fonts.Bold}
								TextSize={isMobile ? 8.5 : 10}
								TextXAlignment={Enum.TextXAlignment.Left}
							/>
							<textlabel
								Size={new UDim2(0.3, 0, 1, 0)}
								BackgroundTransparency={1}
								Text="INSTANT SWITCH"
								TextColor3={Color3.fromHex("#38bdf8")}
								Font={Fonts.Bold}
								TextSize={isMobile ? 8 : 9}
								TextXAlignment={Enum.TextXAlignment.Right}
							/>
						</frame>

						{/* Grid Preset Buttons */}
						<frame
							LayoutOrder={2}
							Size={new UDim2(1, 0, 0, 0)}
							AutomaticSize={Enum.AutomaticSize.Y}
							BackgroundTransparency={1}
						>
							<uigridlayout
								CellSize={new UDim2(0.485, 0, 0, isMobile ? 40 : 48)}
								CellPadding={new UDim2(0.03, 0, 0, isMobile ? 4 : 6)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{BACKDROP_GIF_PRESETS.map((preset, idx) => {
								const currentPresetId = stageLighting.backdropPreset ?? "gif_cyber_grid";
								const isSelected = currentPresetId === preset.id;
								const accent = preset.accentColor ?? Color3.fromHex("#00e5ff");

								return (
									<textbutton
										key={`backdrop_${preset.id}`}
										LayoutOrder={idx + 1}
										BackgroundColor3={isSelected ? Color3.fromHex("#0f172a") : Color3.fromHex("#111827")}
										BackgroundTransparency={0.25}
										Text=""
										AutoButtonColor={false}
										Event={{
											MouseButton1Click: () => {
												adminService.setStageLighting({ backdropPreset: preset.id }, selectedStage);
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
										<uistroke
											Color={isSelected ? accent : Color3.fromHex("#374151")}
											Transparency={isSelected ? 0.2 : 0.6}
											Thickness={isSelected ? 1.5 : 1}
										/>
										<uipadding
											PaddingLeft={new UDim(0, isMobile ? 6 : 8)}
											PaddingRight={new UDim(0, isMobile ? 6 : 8)}
											PaddingTop={new UDim(0, isMobile ? 3 : 4)}
											PaddingBottom={new UDim(0, isMobile ? 3 : 4)}
										/>
										<uilistlayout
											FillDirection={Enum.FillDirection.Vertical}
											VerticalAlignment={Enum.VerticalAlignment.Center}
											SortOrder={Enum.SortOrder.LayoutOrder}
										/>
										<frame Size={new UDim2(1, 0, 0, isMobile ? 14 : 16)} BackgroundTransparency={1}>
											<uilistlayout
												FillDirection={Enum.FillDirection.Horizontal}
												VerticalAlignment={Enum.VerticalAlignment.Center}
												Padding={new UDim(0, 4)}
											/>
											<frame
												Size={new UDim2(0, isMobile ? 6 : 8, 0, isMobile ? 6 : 8)}
												BackgroundColor3={isSelected ? accent : Color3.fromHex("#6b7280")}
												BorderSizePixel={0}
											>
												<uicorner CornerRadius={new UDim(1, 0)} />
											</frame>
											<textlabel
												Size={new UDim2(1, -12, 1, 0)}
												BackgroundTransparency={1}
												Text={preset.name}
												TextColor3={isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#d1d5db")}
												Font={Fonts.Bold}
												TextSize={isMobile ? 9.5 : 11}
												TextXAlignment={Enum.TextXAlignment.Left}
											/>
										</frame>
										<textlabel
											Size={new UDim2(1, 0, 0, isMobile ? 10 : 12)}
											BackgroundTransparency={1}
											Text={`${preset.totalFrames} F • ${preset.fps} FPS`}
											TextColor3={Color3.fromHex("#94a3b8")}
											Font={Fonts.Regular}
											TextSize={isMobile ? 8 : 9}
											TextXAlignment={Enum.TextXAlignment.Left}
										/>
									</textbutton>
								);
							})}

							{/* Tombol Blackout / OFF */}
							{(() => {
								const currentPresetId = stageLighting.backdropPreset ?? "gif_cyber_grid";
								const isOff = currentPresetId === "off";

								return (
									<textbutton
										key="backdrop_off"
										LayoutOrder={99}
										BackgroundColor3={isOff ? Color3.fromHex("#450a0a") : Color3.fromHex("#111827")}
										BackgroundTransparency={0.25}
										Text=""
										AutoButtonColor={false}
										Event={{
											MouseButton1Click: () => {
												adminService.setStageLighting({ backdropPreset: "off" }, selectedStage);
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, isMobile ? 6 : 8)} />
										<uistroke
											Color={isOff ? Color3.fromHex("#ef4444") : Color3.fromHex("#374151")}
											Transparency={isOff ? 0.2 : 0.6}
											Thickness={isOff ? 1.5 : 1}
										/>
										<uipadding
											PaddingLeft={new UDim(0, isMobile ? 6 : 8)}
											PaddingRight={new UDim(0, isMobile ? 6 : 8)}
											PaddingTop={new UDim(0, isMobile ? 3 : 4)}
											PaddingBottom={new UDim(0, isMobile ? 3 : 4)}
										/>
										<uilistlayout
											FillDirection={Enum.FillDirection.Vertical}
											VerticalAlignment={Enum.VerticalAlignment.Center}
											SortOrder={Enum.SortOrder.LayoutOrder}
										/>
										<frame Size={new UDim2(1, 0, 0, isMobile ? 14 : 16)} BackgroundTransparency={1}>
											<uilistlayout
												FillDirection={Enum.FillDirection.Horizontal}
												VerticalAlignment={Enum.VerticalAlignment.Center}
												Padding={new UDim(0, 4)}
											/>
											<frame
												Size={new UDim2(0, isMobile ? 6 : 8, 0, isMobile ? 6 : 8)}
												BackgroundColor3={isOff ? Color3.fromHex("#ef4444") : Color3.fromHex("#6b7280")}
												BorderSizePixel={0}
											>
												<uicorner CornerRadius={new UDim(1, 0)} />
											</frame>
											<textlabel
												Size={new UDim2(1, -12, 1, 0)}
												BackgroundTransparency={1}
												Text="Screen Off"
												TextColor3={isOff ? Color3.fromHex("#ffffff") : Color3.fromHex("#d1d5db")}
												Font={Fonts.Bold}
												TextSize={isMobile ? 9.5 : 11}
												TextXAlignment={Enum.TextXAlignment.Left}
											/>
										</frame>
										<textlabel
											Size={new UDim2(1, 0, 0, isMobile ? 10 : 12)}
											BackgroundTransparency={1}
											Text="Blackout Display"
											TextColor3={Color3.fromHex("#94a3b8")}
											Font={Fonts.Regular}
											TextSize={isMobile ? 8 : 9}
											TextXAlignment={Enum.TextXAlignment.Left}
										/>
									</textbutton>
								);
							})()}
						</frame>

						{/* Brightness Section Header */}
						{(() => {
							const currentBrightness = stageLighting.backdropBrightness ?? 2.0;
							const currentPercent =
								backdropBrightnessPercentVal !== undefined
									? backdropBrightnessPercentVal
									: math.clamp(math.floor((currentBrightness / 4.0) * 100 + 0.5), 0, 100);

							return (
								<>
									<frame LayoutOrder={3} Size={new UDim2(1, 0, 0, isMobile ? 18 : 22)} BackgroundTransparency={1}>
										<uilistlayout
											FillDirection={Enum.FillDirection.Horizontal}
											VerticalAlignment={Enum.VerticalAlignment.Center}
											SortOrder={Enum.SortOrder.LayoutOrder}
										/>
										<textlabel
											Size={new UDim2(0.7, 0, 1, 0)}
											BackgroundTransparency={1}
											Text="KECERAHAN EMISI LED BACKDROP"
											TextColor3={Color3.fromHex("#94a3b8")}
											Font={Fonts.Bold}
											TextSize={isMobile ? 8.5 : 10}
											TextXAlignment={Enum.TextXAlignment.Left}
										/>
										<textlabel
											Size={new UDim2(0.3, 0, 1, 0)}
											BackgroundTransparency={1}
											Text={`${currentPercent}%`}
											TextColor3={Color3.fromHex("#38bdf8")}
											Font={Fonts.Bold}
											TextSize={isMobile ? 8.5 : 10}
											TextXAlignment={Enum.TextXAlignment.Right}
										/>
									</frame>

									{/* Backdrop Brightness Slider Track and Thumb */}
									<frame LayoutOrder={4} Size={new UDim2(1, 0, 0, isMobile ? 22 : 28)} BackgroundTransparency={1}>
										<frame
											key="RemoteBackdropBrightnessTrack"
											ref={backdropBrightnessTrackRef}
											AnchorPoint={new Vector2(0, 0.5)}
											Position={new UDim2(0, 0, 0.5, 0)}
											Size={new UDim2(1, 0, 0, isMobile ? 6 : 8)}
											BackgroundColor3={Color3.fromHex("#1f2937")}
										>
											<uicorner CornerRadius={new UDim(1, 0)} />
											<frame
												key="RemoteBackdropBrightnessFill"
												Size={new UDim2(currentPercent / 100, 0, 1, 0)}
												BackgroundColor3={Color3.fromHex("#0284c7")}
											>
												<uicorner CornerRadius={new UDim(1, 0)} />
											</frame>
											<frame
												key="RemoteBackdropBrightnessThumb"
												AnchorPoint={new Vector2(0.5, 0.5)}
												Position={new UDim2(currentPercent / 100, 0, 0.5, 0)}
												Size={new UDim2(0, isMobile ? 14 : 18, 0, isMobile ? 14 : 18)}
												BackgroundColor3={Color3.fromHex("#ffffff")}
											>
												<uicorner CornerRadius={new UDim(1, 0)} />
												<uistroke Color={Color3.fromHex("#0284c7")} Thickness={isMobile ? 1.5 : 2} />
											</frame>
										</frame>

										{/* Hitbox Button for Drag & Click */}
										<textbutton
											key="RemoteBackdropBrightnessHitbox"
											Position={new UDim2(0, 0, 0, 0)}
											Size={new UDim2(1, 0, 1, 0)}
											BackgroundTransparency={1}
											Text=""
											AutoButtonColor={false}
											ZIndex={5}
											Event={{
												InputBegan: (_, input) => {
													if (
														input.UserInputType === Enum.UserInputType.MouseButton1 ||
														input.UserInputType === Enum.UserInputType.Touch
													) {
														setIsBackdropBrightnessDragging(true);
														updateBackdropBrightnessFromInput(input.Position.X, true);
													}
												},
											}}
										/>
									</frame>
								</>
							);
						})()}
					</>
				)}

				{/* ───────── TAB 6: CAMERA CONTROLLER ───────── */}
				{activeTab === "camera" && (
					<StageCameraTab stageTarget={selectedStage === "all" ? "main" : selectedStage} />
				)}
			</scrollingframe>
		</frame>
	);
}

/**
 * OOP Class Adapter for LightingRemoteView.
 * Provides singleton lifecycle methods for ToolController and components.
 */
export class LightingRemoteView {
	private static instance?: LightingRemoteView;
	private root: Root;
	private screenGui?: ScreenGui;
	private isVisible = false;
	private onOpenCallbacks: Array<() => void> = [];
	private onCloseCallbacks: Array<() => void> = [];

	constructor(targetContainer?: Instance) {
		let container = targetContainer;
		if (!container) {
			const player = Players.LocalPlayer;
			const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

			const existing = playerGui.FindFirstChild("LightingRemoteGui") as ScreenGui | undefined;
			if (existing) {
				existing.Destroy();
			}

			const gui = new Instance("ScreenGui");
			gui.Name = "LightingRemoteGui";
			gui.ResetOnSpawn = false;
			gui.DisplayOrder = 200;
			gui.IgnoreGuiInset = true;
			gui.Parent = playerGui;
			this.screenGui = gui;
			container = gui;
		}

		this.root = ReactRoblox.createRoot(container);
		this.render();
	}

	public static getInstance(): LightingRemoteView {
		if (!LightingRemoteView.instance) {
			LightingRemoteView.instance = new LightingRemoteView();
		}
		return LightingRemoteView.instance;
	}

	private render(): void {
		this.root.render(
			<LightingRemoteComponent
				visible={this.isVisible}
				onClose={() => this.hide()}
			/>,
		);
	}

	public show(): void {
		if (this.isVisible) return;
		this.isVisible = true;
		this.render();
		this.onOpenCallbacks.forEach((cb) => cb());
	}

	public hide(): void {
		if (!this.isVisible) return;
		this.isVisible = false;
		this.render();
		this.onCloseCallbacks.forEach((cb) => cb());
	}

	public toggle(forceState?: boolean): void {
		const targetState = forceState !== undefined ? forceState : !this.isVisible;
		if (targetState) {
			this.show();
		} else {
			this.hide();
		}
	}

	public getVisible(): boolean {
		return this.isVisible;
	}

	public onOpen(cb: () => void): void {
		this.onOpenCallbacks.push(cb);
	}

	public onClose(cb: () => void): void {
		this.onCloseCallbacks.push(cb);
	}

	public destroy(): void {
		this.isVisible = false;
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
			this.screenGui = undefined;
		}
		this.onOpenCallbacks = [];
		this.onCloseCallbacks = [];
		if (LightingRemoteView.instance === this) {
			LightingRemoteView.instance = undefined;
		}
	}
}
