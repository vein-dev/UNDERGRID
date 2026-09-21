import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { AdminService } from "client/services/AdminService";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";
import {
	StageLightMode,
	StageLightingControlPayload,
} from "shared/types";

type RemoteTab = "modes" | "colors" | "beam" | "trim";

export interface LightingRemoteComponentProps {
	visible: boolean;
	onClose?: () => void;
}

export function LightingRemoteComponent({ visible, onClose }: LightingRemoteComponentProps) {
	const adminService = AdminService.getInstance();
	const [adminState, setAdminState] = useState(() => adminService.getState());
	const [activeTab, setActiveTab] = useState<RemoteTab>("modes");
	const [isCollapsed, setIsCollapsed] = useState(false);

	useEffect(() => {
		const unsub = adminService.onStateUpdated((newState) => {
			setAdminState({ ...newState });
		});
		return () => unsub();
	}, []);

	if (!visible) return <></>;

	const stageLighting: StageLightingControlPayload = adminState.stageLighting ?? {
		mode: StageLightMode.MusicSync,
		panAngle: 0,
		tiltAngle: 0,
		motorSpeed: 0.04,
		color: Color3.fromRGB(0, 255, 255),
		brightness: 2.5,
		beamEnabled: true,
		strobeSpeed: 0,
		isRainbow: false,
		isPulse: false,
		isMusicSync: true,
	};

	const currentPanDeg = math.floor(math.deg(stageLighting.panAngle) + 0.5);
	const currentTiltDeg = math.floor(math.deg(stageLighting.tiltAngle) + 0.5);

	const motionModes: Array<{ mode: StageLightMode; label: string; icon: string }> = [
		{ mode: StageLightMode.MusicSync, label: "Sync Musik", icon: "music" },
		{ mode: StageLightMode.SpotlightCenter, label: "Fokus Stage", icon: "target" },
		{ mode: StageLightMode.Wave, label: "Wave", icon: "activity" },
		{ mode: StageLightMode.Circle, label: "Orbit", icon: "compass" },
		{ mode: StageLightMode.Ballyhoo, label: "Ballyhoo", icon: "sparkles" },
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

	const stageTrimPresets = [
		{ label: "Center", panDeg: 0, tiltDeg: 0 },
		{ label: "Kiri", panDeg: -12, tiltDeg: 0 },
		{ label: "Kanan", panDeg: 12, tiltDeg: 0 },
		{ label: "Depan", panDeg: 0, tiltDeg: 6 },
		{ label: "Dalam", panDeg: 0, tiltDeg: -6 },
	];

	const speedPresets = [
		{ label: "Kalem", val: 0.02 },
		{ label: "Normal", val: 0.04 },
		{ label: "Cepat", val: 0.08 },
	];

	const brightnessPresets = [
		{ label: "0%", val: 0 },
		{ label: "30%", val: 1.0 },
		{ label: "70%", val: 2.2 },
		{ label: "100%", val: 3.5 },
	];

	const strobePresets = [
		{ label: "Off", speed: 0 },
		{ label: "Slow", speed: 1 },
		{ label: "Med", speed: 2 },
		{ label: "Fast", speed: 3 },
		{ label: "Hyper", speed: 4 },
	];

	// ─── Render Minimized Status Pill ──────────────────────────────────────────
	if (isCollapsed) {
		return (
			<textbutton
				key="LightingRemotePill"
				Position={new UDim2(1, -24, 0.75, 0)}
				AnchorPoint={new Vector2(1, 0.5)}
				Size={new UDim2(0, 230, 0, 44)}
				BackgroundColor3={Color3.fromHex("#0a0a0a")}
				BackgroundTransparency={0.25}
				Text=""
				AutoButtonColor={false}
				Event={{
					MouseButton1Click: () => setIsCollapsed(false),
				}}
			>
				<uicorner CornerRadius={new UDim(0, 22)} />
				<uistroke
					Color={stageLighting.color}
					Transparency={0.4}
					Thickness={1.5}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				<uipadding
					PaddingLeft={new UDim(0, 12)}
					PaddingRight={new UDim(0, 12)}
					PaddingTop={new UDim(0, 6)}
					PaddingBottom={new UDim(0, 6)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					HorizontalAlignment={Enum.HorizontalAlignment.Left}
					Padding={new UDim(0, 8)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>

				{/* Dot color indicator */}
				<frame
					LayoutOrder={1}
					Size={new UDim2(0, 12, 0, 12)}
					BackgroundColor3={stageLighting.color}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(1, 0)} />
				</frame>

				{/* Info Text */}
				<frame LayoutOrder={2} Size={new UDim2(1, -54, 1, 0)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<textlabel
						LayoutOrder={1}
						Size={new UDim2(1, 0, 0, 14)}
						BackgroundTransparency={1}
						Text="DMX REMOTE LIVE"
						TextColor3={Color3.fromHex("#94a3b8")}
						TextSize={9}
						Font={Fonts.Bold}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<textlabel
						LayoutOrder={2}
						Size={new UDim2(1, 0, 0, 16)}
						BackgroundTransparency={1}
						Text={stageLighting.mode}
						TextColor3={Color3.fromHex("#ffffff")}
						TextSize={12}
						Font={Fonts.Medium}
						TextXAlignment={Enum.TextXAlignment.Left}
						TextTruncate={Enum.TextTruncate.AtEnd}
					/>
				</frame>

				{/* Expand Icon */}
				<frame LayoutOrder={3} Size={new UDim2(0, 20, 0, 20)} BackgroundTransparency={1}>
					<LucideIcon name="maximize-2" size={UDim2.fromOffset(16, 16)} color={Color3.fromHex("#ffffff")} />
				</frame>
			</textbutton>
		);
	}

	// ─── Render Full Floating HUD ──────────────────────────────────────────────
	return (
		<frame
			key="LightingRemoteHUD"
			Position={new UDim2(1, -24, 0.5, 0)}
			AnchorPoint={new Vector2(1, 0.5)}
			Size={new UDim2(0, 310, 0, 420)}
			BackgroundColor3={Color3.fromHex("#0a0a0a")}
			BackgroundTransparency={0.2}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 18)} />
			<uistroke
				Color={Color3.fromRGB(255, 255, 255)}
				Transparency={0.86}
				Thickness={1}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>
			<uipadding
				PaddingLeft={new UDim(0, 14)}
				PaddingRight={new UDim(0, 14)}
				PaddingTop={new UDim(0, 14)}
				PaddingBottom={new UDim(0, 14)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Vertical}
				SortOrder={Enum.SortOrder.LayoutOrder}
				Padding={new UDim(0, 10)}
			/>

			{/* ─── Header ─── */}
			<frame LayoutOrder={1} Size={new UDim2(1, 0, 0, 34)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>

				<frame LayoutOrder={1} Size={new UDim2(1, -70, 1, 0)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					<frame LayoutOrder={1} Size={new UDim2(0, 28, 0, 28)} BackgroundColor3={stageLighting.color} BackgroundTransparency={0.2}>
						<uicorner CornerRadius={new UDim(0, 8)} />
						<LucideIcon name="activity" size={UDim2.fromOffset(16, 16)} color={Color3.fromRGB(255, 255, 255)} />
					</frame>
					<frame LayoutOrder={2} Size={new UDim2(1, -36, 1, 0)} BackgroundTransparency={1}>
						<uilistlayout FillDirection={Enum.FillDirection.Vertical} VerticalAlignment={Enum.VerticalAlignment.Center} />
						<textlabel
							Size={new UDim2(1, 0, 0, 16)}
							BackgroundTransparency={1}
							Text="LIGHTING REMOTE"
							TextColor3={Color3.fromHex("#ffffff")}
							TextSize={12}
							Font={Fonts.Bold}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<textlabel
							Size={new UDim2(1, 0, 0, 12)}
							BackgroundTransparency={1}
							Text="Live Concert DMX Controller"
							TextColor3={Color3.fromHex("#94a3b8")}
							TextSize={9}
							Font={Fonts.Regular}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
					</frame>
				</frame>

				{/* Header Actions: Minimize & Close */}
				<frame LayoutOrder={2} Size={new UDim2(0, 64, 0, 28)} BackgroundTransparency={1}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						HorizontalAlignment={Enum.HorizontalAlignment.Right}
						Padding={new UDim(0, 6)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{/* Minimize Button */}
					<textbutton
						LayoutOrder={1}
						Size={new UDim2(0, 28, 0, 28)}
						BackgroundColor3={Color3.fromHex("#1f2937")}
						BackgroundTransparency={0.4}
						Text=""
						AutoButtonColor={true}
						Event={{
							MouseButton1Click: () => setIsCollapsed(true),
						}}
					>
						<uicorner CornerRadius={new UDim(0, 8)} />
						<LucideIcon name="minimize-2" size={UDim2.fromOffset(14, 14)} color={Color3.fromHex("#d1d5db")} />
					</textbutton>
					{/* Close Button */}
					<textbutton
						LayoutOrder={2}
						Size={new UDim2(0, 28, 0, 28)}
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
						<uicorner CornerRadius={new UDim(0, 8)} />
						<LucideIcon name="x" size={UDim2.fromOffset(14, 14)} color={Color3.fromHex("#ef4444")} />
					</textbutton>
				</frame>
			</frame>

			{/* ─── Navigation Tabs ─── */}
			<frame
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 32)}
				BackgroundColor3={Color3.fromHex("#111827")}
				BackgroundTransparency={0.5}
			>
				<uicorner CornerRadius={new UDim(0, 10)} />
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
						{ id: "trim", label: "Aim", icon: "compass" },
					] as Array<{ id: RemoteTab; label: string; icon: string }>
				).map((tab, idx) => {
					const isActive = activeTab === tab.id;
					return (
						<textbutton
							key={`tab_${tab.id}`}
							LayoutOrder={idx}
							Size={new UDim2(0.25, 0, 1, 0)}
							BackgroundColor3={isActive ? Color3.fromHex("#3b82f6") : Color3.fromRGB(0, 0, 0)}
							BackgroundTransparency={isActive ? 0.2 : 1}
							Text={tab.label}
							TextColor3={isActive ? Color3.fromHex("#ffffff") : Color3.fromHex("#94a3b8")}
							Font={isActive ? Fonts.Bold : Fonts.Medium}
							TextSize={10}
							Event={{
								MouseButton1Click: () => setActiveTab(tab.id),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />
						</textbutton>
					);
				})}
			</frame>

			{/* ─── Content Body ─── */}
			<scrollingframe
				LayoutOrder={3}
				Size={new UDim2(1, 0, 1, -86)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ScrollBarThickness={3}
				ScrollBarImageColor3={Color3.fromHex("#4b5563")}
				CanvasSize={new UDim2(0, 0, 0, 0)}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, 10)}
				/>

				{/* ───────── TAB 1: MODES ───────── */}
				{activeTab === "modes" && (
					<>
						<textlabel
							LayoutOrder={1}
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text="KOREOGRAFI PANGGUNG"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						{/* 2-Column Grid for Modes */}
						<frame LayoutOrder={2} Size={new UDim2(1, 0, 0, 140)} BackgroundTransparency={1}>
							<uigridlayout
								CellSize={new UDim2(0.5, -4, 0, 42)}
								CellPadding={new UDim2(0, 8, 0, 8)}
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
												adminService.setStageLighting({ mode: item.mode });
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, 10)} />
										<uistroke
											Color={isSelected ? Color3.fromHex("#60a5fa") : Color3.fromRGB(255, 255, 255)}
											Transparency={isSelected ? 0.3 : 0.9}
											Thickness={1}
										/>
										<uipadding PaddingLeft={new UDim(0, 8)} PaddingRight={new UDim(0, 8)} />
										<uilistlayout
											FillDirection={Enum.FillDirection.Horizontal}
											VerticalAlignment={Enum.VerticalAlignment.Center}
											Padding={new UDim(0, 6)}
											SortOrder={Enum.SortOrder.LayoutOrder}
										/>
										<LucideIcon
											name={item.icon}
											size={UDim2.fromOffset(14, 14)}
											color={isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#94a3b8")}
										/>
										<textlabel
											Size={new UDim2(1, -22, 1, 0)}
											BackgroundTransparency={1}
											Text={item.label}
											TextColor3={isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#d1d5db")}
											Font={isSelected ? Fonts.Bold : Fonts.Medium}
											TextSize={10}
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
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text="KECEPATAN GERAK MOTOR"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<frame LayoutOrder={4} Size={new UDim2(1, 0, 0, 32)} BackgroundTransparency={1}>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								Padding={new UDim(0, 6)}
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
										TextSize={10}
										Event={{
											MouseButton1Click: () => {
												adminService.setStageLighting({ motorSpeed: sp.val });
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, 8)} />
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
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text="PALET WARNA LAMPU (8 WARNA)"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						{/* 4-Column Grid for Colors */}
						<frame LayoutOrder={2} Size={new UDim2(1, 0, 0, 72)} BackgroundTransparency={1}>
							<uigridlayout
								CellSize={new UDim2(0.25, -6, 0, 32)}
								CellPadding={new UDim2(0, 8, 0, 8)}
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
												adminService.setStageLighting({
													color: cp.color,
													isRainbow: false,
												});
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, 8)} />
										{isSelected && (
											<uistroke
												Color={Color3.fromHex("#ffffff")}
												Thickness={2.5}
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
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text="EFEK WARNA DINAMIS"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<frame LayoutOrder={4} Size={new UDim2(1, 0, 0, 34)} BackgroundTransparency={1}>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								Padding={new UDim(0, 8)}
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
								TextSize={10}
								Event={{
									MouseButton1Click: () => {
										adminService.setStageLighting({ isRainbow: !stageLighting.isRainbow });
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
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
								TextSize={10}
								Event={{
									MouseButton1Click: () => {
										adminService.setStageLighting({ isPulse: !stageLighting.isPulse });
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
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
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text="BEAM LAMPU SOROT"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<textbutton
							LayoutOrder={2}
							Size={new UDim2(1, 0, 0, 36)}
							BackgroundColor3={stageLighting.beamEnabled ? Color3.fromHex("#16a34a") : Color3.fromHex("#dc2626")}
							BackgroundTransparency={0.25}
							Text={stageLighting.beamEnabled ? "BEAM NYALA (VISIBLE)" : "BEAM MATI (HIDDEN)"}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={11}
							Event={{
								MouseButton1Click: () => {
									adminService.setStageLighting({ beamEnabled: !stageLighting.beamEnabled });
								},
							}}
						>
							<uicorner CornerRadius={new UDim(0, 10)} />
						</textbutton>

						{/* Brightness Presets */}
						<textlabel
							LayoutOrder={3}
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text="TINGKAT KECERAHAN (BRIGHTNESS)"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<frame LayoutOrder={4} Size={new UDim2(1, 0, 0, 32)} BackgroundTransparency={1}>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								Padding={new UDim(0, 6)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{brightnessPresets.map((bp, idx) => {
								const isCur = math.abs(stageLighting.brightness - bp.val) < 0.3;
								return (
									<textbutton
										key={`bright_${bp.label}`}
										LayoutOrder={idx}
										Size={new UDim2(0.25, -5, 1, 0)}
										BackgroundColor3={isCur ? Color3.fromHex("#ca8a04") : Color3.fromHex("#1f2937")}
										BackgroundTransparency={isCur ? 0.2 : 0.6}
										Text={bp.label}
										TextColor3={Color3.fromHex("#ffffff")}
										Font={isCur ? Fonts.Bold : Fonts.Regular}
										TextSize={10}
										Event={{
											MouseButton1Click: () => {
												adminService.setStageLighting({ brightness: bp.val });
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, 8)} />
									</textbutton>
								);
							})}
						</frame>

						{/* Strobe Presets */}
						<textlabel
							LayoutOrder={5}
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text="STROBE LIGHT (KEDIP CEPAT)"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<frame LayoutOrder={6} Size={new UDim2(1, 0, 0, 32)} BackgroundTransparency={1}>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								Padding={new UDim(0, 5)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{strobePresets.map((stp, idx) => {
								const isCur = stageLighting.strobeSpeed === stp.speed;
								return (
									<textbutton
										key={`strobe_${stp.label}`}
										LayoutOrder={idx}
										Size={new UDim2(0.2, -4, 1, 0)}
										BackgroundColor3={isCur ? Color3.fromHex("#7c3aed") : Color3.fromHex("#1f2937")}
										BackgroundTransparency={isCur ? 0.2 : 0.6}
										Text={stp.label}
										TextColor3={Color3.fromHex("#ffffff")}
										Font={isCur ? Fonts.Bold : Fonts.Regular}
										TextSize={10}
										Event={{
											MouseButton1Click: () => {
												adminService.setStageLighting({ strobeSpeed: stp.speed });
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, 8)} />
									</textbutton>
								);
							})}
						</frame>
					</>
				)}

				{/* ───────── TAB 4: STAGE TRIM & AIM ───────── */}
				{activeTab === "trim" && (
					<>
						<textlabel
							LayoutOrder={1}
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text="STAGE TRIM PRESETS"
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						{/* Presets */}
						<frame LayoutOrder={2} Size={new UDim2(1, 0, 0, 72)} BackgroundTransparency={1}>
							<uigridlayout
								CellSize={new UDim2(0.333, -5, 0, 32)}
								CellPadding={new UDim2(0, 6, 0, 6)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{stageTrimPresets.map((tp, idx) => {
								return (
									<textbutton
										key={`trim_${tp.label}`}
										LayoutOrder={idx}
										BackgroundColor3={Color3.fromHex("#1f2937")}
										BackgroundTransparency={0.5}
										Text={tp.label}
										TextColor3={Color3.fromHex("#ffffff")}
										Font={Fonts.Medium}
										TextSize={10}
										Event={{
											MouseButton1Click: () => {
												adminService.setStageLighting({
													panAngle: math.rad(tp.panDeg),
													tiltAngle: math.rad(tp.tiltDeg),
												});
											},
										}}
									>
										<uicorner CornerRadius={new UDim(0, 8)} />
									</textbutton>
								);
							})}
						</frame>

						{/* Manual Nudge Direction Pad */}
						<textlabel
							LayoutOrder={3}
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text={`MANUAL NUDGE (Pan: ${currentPanDeg}° | Tilt: ${currentTiltDeg}°)`}
							TextColor3={Color3.fromHex("#94a3b8")}
							Font={Fonts.Bold}
							TextSize={9}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<frame LayoutOrder={4} Size={new UDim2(1, 0, 0, 64)} BackgroundTransparency={1}>
							<uilistlayout
								FillDirection={Enum.FillDirection.Vertical}
								Padding={new UDim(0, 6)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>
							{/* Pan Controls */}
							<frame LayoutOrder={1} Size={new UDim2(1, 0, 0, 28)} BackgroundTransparency={1}>
								<uilistlayout
									FillDirection={Enum.FillDirection.Horizontal}
									Padding={new UDim(0, 6)}
									SortOrder={Enum.SortOrder.LayoutOrder}
								/>
								<textbutton
									LayoutOrder={1}
									Size={new UDim2(0.5, -3, 1, 0)}
									BackgroundColor3={Color3.fromHex("#374151")}
									BackgroundTransparency={0.4}
									Text="◂ Pan Kiri (-5°)"
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Regular}
									TextSize={10}
									Event={{
										MouseButton1Click: () => {
											adminService.setStageLighting({
												panAngle: stageLighting.panAngle - math.rad(5),
											});
										},
									}}
								>
									<uicorner CornerRadius={new UDim(0, 8)} />
								</textbutton>
								<textbutton
									LayoutOrder={2}
									Size={new UDim2(0.5, -3, 1, 0)}
									BackgroundColor3={Color3.fromHex("#374151")}
									BackgroundTransparency={0.4}
									Text="Pan Kanan (+5°) ▸"
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Regular}
									TextSize={10}
									Event={{
										MouseButton1Click: () => {
											adminService.setStageLighting({
												panAngle: stageLighting.panAngle + math.rad(5),
											});
										},
									}}
								>
									<uicorner CornerRadius={new UDim(0, 8)} />
								</textbutton>
							</frame>

							{/* Tilt Controls */}
							<frame LayoutOrder={2} Size={new UDim2(1, 0, 0, 28)} BackgroundTransparency={1}>
								<uilistlayout
									FillDirection={Enum.FillDirection.Horizontal}
									Padding={new UDim(0, 6)}
									SortOrder={Enum.SortOrder.LayoutOrder}
								/>
								<textbutton
									LayoutOrder={1}
									Size={new UDim2(0.5, -3, 1, 0)}
									BackgroundColor3={Color3.fromHex("#374151")}
									BackgroundTransparency={0.4}
									Text="▴ Tilt Atas (-3°)"
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Regular}
									TextSize={10}
									Event={{
										MouseButton1Click: () => {
											adminService.setStageLighting({
												tiltAngle: stageLighting.tiltAngle - math.rad(3),
											});
										},
									}}
								>
									<uicorner CornerRadius={new UDim(0, 8)} />
								</textbutton>
								<textbutton
									LayoutOrder={2}
									Size={new UDim2(0.5, -3, 1, 0)}
									BackgroundColor3={Color3.fromHex("#374151")}
									BackgroundTransparency={0.4}
									Text="▾ Tilt Bawah (+3°)"
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Regular}
									TextSize={10}
									Event={{
										MouseButton1Click: () => {
											adminService.setStageLighting({
												tiltAngle: stageLighting.tiltAngle + math.rad(3),
											});
										},
									}}
								>
									<uicorner CornerRadius={new UDim(0, 8)} />
								</textbutton>
							</frame>
						</frame>
					</>
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
			gui.DisplayOrder = 125;
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

	public toggle(): void {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
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
