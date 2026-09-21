import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { AdminService } from "client/services/AdminService";
import { Fonts } from "client/ui/Typography";
import { StageLightMode, StageLightingControlPayload } from "shared/types";
import { LucideIcon } from "../../components/LucideIcon";

export interface AdminStageFxTabProps {
	visible: boolean;
}

export function AdminStageFxTabComponent({ visible }: AdminStageFxTabProps) {
	const adminService = AdminService.getInstance();
	const [announcementText, setAnnouncementText] = useState("");
	const [adminState, setAdminState] = useState(() => adminService.getState());

	useEffect(() => {
		const unsub = adminService.onStateUpdated((newState) => {
			setAdminState({ ...newState });
		});
		return () => {
			unsub();
		};
	}, []);

	if (!visible) return <></>;

	const stageLighting: StageLightingControlPayload = adminState.stageLighting ?? {
		mode: StageLightMode.Off,
		panAngle: 0,
		tiltAngle: 0,
		motorSpeed: 0.04,
		color: Color3.fromRGB(255, 255, 255),
		brightness: 2.5,
		beamEnabled: true,
		strobeSpeed: 0,
		isRainbow: false,
		isPulse: false,
		isMusicSync: false,
	};

	const currentPanDeg = math.floor(math.deg(stageLighting.panAngle) + 0.5);
	const currentTiltDeg = math.floor(math.deg(stageLighting.tiltAngle) + 0.5);


	const quickTexts = [
		"Rundown Band A dimulai",
		"MC naik panggung",
		"Open Gate 5 Menit Lagi",
	];

	const motionModes: Array<{ mode: StageLightMode; label: string; icon: string }> = [
		{ mode: StageLightMode.MusicSync, label: "Sync Musik (BPM Locked)", icon: "music" },
		{ mode: StageLightMode.SpotlightCenter, label: "Fokus Panggung", icon: "spotlight" },
		{ mode: StageLightMode.Wave, label: "Gelombang Wave", icon: "activity" },
		{ mode: StageLightMode.Circle, label: "Orbit Panggung", icon: "compass" },
		{ mode: StageLightMode.Ballyhoo, label: "Ballyhoo Rock", icon: "sparkles" },
		{ mode: StageLightMode.Off, label: "Parkir / Standby", icon: "circle-stop" },
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
		{ label: "Tengah (Center)", panDeg: 0, tiltDeg: 0 },
		{ label: "Geser Kiri", panDeg: -12, tiltDeg: 0 },
		{ label: "Geser Kanan", panDeg: 12, tiltDeg: 0 },
		{ label: "Depan Panggung", panDeg: 0, tiltDeg: 6 },
		{ label: "Dalam Panggung", panDeg: 0, tiltDeg: -6 },
	];

	const speedPresets = [
		{ label: "Lambat / Kalem", val: 0.02 },
		{ label: "Normal", val: 0.04 },
		{ label: "Cepat / Reff", val: 0.08 },
	];

	const brightnessPresets = [
		{ label: "Mati (0%)", val: 0 },
		{ label: "Redup (30%)", val: 1.0 },
		{ label: "Sedang (70%)", val: 2.2 },
		{ label: "Maks (100%)", val: 3.5 },
	];

	const strobePresets = [
		{ label: "Off", speed: 0 },
		{ label: "Beat (1/4)", speed: 1 },
		{ label: "1/8", speed: 2 },
		{ label: "1/16", speed: 3 },
		{ label: "32nd", speed: 4 },
	];

	return (
		<scrollingframe
			key="AdminStageFxTab"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			ScrollBarThickness={4}
			ScrollBarImageColor3={Color3.fromHex("#444444")}
			CanvasSize={new UDim2(0, 0, 0, 0)}
			AutomaticCanvasSize={Enum.AutomaticSize.Y}
			ZIndex={10}
		>
			<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 14)} />
			<uipadding
				PaddingTop={new UDim(0, 12)}
				PaddingBottom={new UDim(0, 32)}
				PaddingLeft={new UDim(0, 14)}
				PaddingRight={new UDim(0, 14)}
			/>

			{/* 1. Push Announcement Card */}
			<frame
				key="AnnouncementCard"
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 188)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
					PaddingLeft={new UDim(0, 12)}
					PaddingRight={new UDim(0, 12)}
				/>

				<textlabel
					key="Title"
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text="PUSH ANNOUNCEMENT (SERVER BROADCAST)"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<textbox
					key="AnnounceInput"
					Position={new UDim2(0, 0, 0, 24)}
					Size={new UDim2(1, 0, 0, 42)}
					BackgroundColor3={Color3.fromHex("#101010")}
					PlaceholderText="Ketik pengumuman pop-up kilat..."
					PlaceholderColor3={Color3.fromHex("#666666")}
					Text={announcementText}
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Medium}
					TextSize={12}
					ClearTextOnFocus={false}
					ZIndex={12}
					Change={{
						Text: (rbx) => setAnnouncementText(rbx.Text),
					}}
				>
					<uicorner CornerRadius={new UDim(0, 10)} />
					<uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} />
				</textbox>

				<textbutton
					key="SendBtn"
					Position={new UDim2(0, 0, 0, 72)}
					Size={new UDim2(1, 0, 0, 36)}
					BackgroundColor3={Color3.fromHex("#ffffff")}
					Text=""
					AutoButtonColor={false}
					ZIndex={12}
					Event={{
						MouseButton1Click: () => {
							const text = announcementText.gsub("^%s*(.-)%s*$", "%1")[0];
							if (text.size() > 0) {
								adminService.sendAnnouncement(text);
								setAnnouncementText("");
							}
						},
					}}
				>
					<uicorner CornerRadius={new UDim(0, 10)} />
					<frame
						key="Content"
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundTransparency={1}
						ZIndex={13}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 8)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						<textlabel
							key="Text"
							Size={new UDim2(0, 130, 1, 0)}
							BackgroundTransparency={1}
							Text="Kirim Pengumuman"
							TextColor3={Color3.fromHex("#000000")}
							Font={Fonts.Bold}
							TextSize={12}
							ZIndex={13}
							LayoutOrder={1}
						/>
						<LucideIcon
							name="megaphone"
							size={new UDim2(0, 16, 0, 16)}
							color={Color3.fromHex("#000000")}
							zIndex={13}
							layoutOrder={2}
						/>
					</frame>
				</textbutton>

				<textlabel
					key="PresetsLabel"
					Position={new UDim2(0, 0, 0, 114)}
					Size={new UDim2(1, 0, 0, 16)}
					BackgroundTransparency={1}
					Text="PRESET KILAT:"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={10}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="PresetsRow"
					Position={new UDim2(0, 0, 0, 132)}
					Size={new UDim2(1, 0, 0, 28)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 8)} />
					{quickTexts.map((q, idx) => (
						<textbutton
							key={`quick_${idx}`}
							Size={new UDim2(0.31, 0, 1, 0)}
							BackgroundColor3={Color3.fromHex("#202020")}
							Text={q}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Regular}
							TextSize={10}
							TextTruncate={Enum.TextTruncate.AtEnd}
							AutoButtonColor={false}
							ZIndex={13}
							Event={{
								MouseButton1Click: () => setAnnouncementText(q),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 6)} />
						</textbutton>
					))}
				</frame>
			</frame>


			{/* 2.5 Handheld Lighting Remote Shortcut */}
			<frame
				key="HandheldLightingRemoteCard"
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 68)}
				BackgroundColor3={Color3.fromHex("#131b2e")}
				BackgroundTransparency={0.2}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#3b82f6")} Transparency={0.5} Thickness={1.2} />
				<uipadding
					PaddingTop={new UDim(0, 10)}
					PaddingBottom={new UDim(0, 10)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 14)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				<frame Size={new UDim2(1, -150, 1, 0)} BackgroundTransparency={1} LayoutOrder={1}>
					<uilistlayout FillDirection={Enum.FillDirection.Vertical} VerticalAlignment={Enum.VerticalAlignment.Center} />
					<textlabel
						Size={new UDim2(1, 0, 0, 18)}
						BackgroundTransparency={1}
						Text="HANDHELD LIGHTING CONTROLLER TOOL"
						TextColor3={Color3.fromHex("#60a5fa")}
						Font={Fonts.Bold}
						TextSize={11}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<textlabel
						Size={new UDim2(1, 0, 0, 14)}
						BackgroundTransparency={1}
						Text="Gunakan Tool di tangan untuk kontrol Floating Immersive HUD tanpa menutup layar!"
						TextColor3={Color3.fromHex("#94a3b8")}
						Font={Fonts.Regular}
						TextSize={9}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
				</frame>
				<textbutton
					LayoutOrder={2}
					Size={new UDim2(0, 136, 0, 36)}
					BackgroundColor3={Color3.fromHex("#2563eb")}
					Text="Ambil Remote Tool"
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextSize={11}
					AutoButtonColor={true}
					Event={{
						MouseButton1Click: () => {
							adminService.giveLightingRemote();
						},
					}}
				>
					<uicorner CornerRadius={new UDim(0, 10)} />
				</textbutton>
			</frame>

			{/* 3. Stage Lighting - Motion Mode Selector */}
			<frame
				key="StageLightingMotionCard"
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 260)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
					PaddingLeft={new UDim(0, 12)}
					PaddingRight={new UDim(0, 12)}
				/>

				<textlabel
					key="Title"
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text="CONCERT MOVING LIGHTS - POLA GERAK (PATTERNS)"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="ModeGrid"
					Position={new UDim2(0, 0, 0, 26)}
					Size={new UDim2(1, 0, 1, -26)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uigridlayout
						CellSize={new UDim2(0.31, 0, 0, 64)}
						CellPadding={new UDim2(0.035, 0, 0, 10)}
					/>

					{motionModes.map((item) => {
						const isSelected = stageLighting.mode === item.mode;
						return (
							<textbutton
								key={`ModeBtn_${item.mode}`}
								BackgroundColor3={
									isSelected ? Color3.fromHex("#00e5ff") : Color3.fromHex("#1e1e1e")
								}
								Text=""
								AutoButtonColor={false}
								ZIndex={13}
								Event={{
									MouseButton1Click: () => {
										adminService.setStageLighting({ mode: item.mode });
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 10)} />
								<uistroke
									Color={
										isSelected ? Color3.fromHex("#00e5ff") : Color3.fromHex("#333333")
									}
									Thickness={1.2}
								/>
								<frame
									key="Content"
									Size={new UDim2(1, 0, 1, 0)}
									BackgroundTransparency={1}
									ZIndex={14}
								>
									<uilistlayout
										FillDirection={Enum.FillDirection.Vertical}
										HorizontalAlignment={Enum.HorizontalAlignment.Center}
										VerticalAlignment={Enum.VerticalAlignment.Center}
										Padding={new UDim(0, 4)}
										SortOrder={Enum.SortOrder.LayoutOrder}
									/>
									<LucideIcon
										name={item.icon}
										size={new UDim2(0, 18, 0, 18)}
										color={
											isSelected ? Color3.fromHex("#000000") : Color3.fromHex("#d0d0d0")
										}
										zIndex={14}
										layoutOrder={1}
									/>
									<textlabel
										key="Label"
										Size={new UDim2(1, -6, 0, 16)}
										BackgroundTransparency={1}
										Text={item.label}
										TextColor3={
											isSelected ? Color3.fromHex("#000000") : Color3.fromHex("#d0d0d0")
										}
										Font={Fonts.Bold}
										TextSize={10}
										TextTruncate={Enum.TextTruncate.AtEnd}
										ZIndex={14}
										LayoutOrder={2}
									/>
								</frame>
							</textbutton>
						);
					})}
				</frame>
			</frame>

			{/* 4. Stage Lighting - Stage Trim & Motor Speed */}
			<frame
				key="ManualDirectionCard"
				LayoutOrder={4}
				Size={new UDim2(1, 0, 0, 180)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
					PaddingLeft={new UDim(0, 12)}
					PaddingRight={new UDim(0, 12)}
				/>

				<textlabel
					key="Title"
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text="OFFSET BIDIK PANGGUNG & KECEPATAN MOTOR"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				{/* Stage Trim Row */}
				<textlabel
					key="TrimLabel"
					Position={new UDim2(0, 0, 0, 26)}
					Size={new UDim2(1, 0, 0, 14)}
					BackgroundTransparency={1}
					Text="TRIM POSISI PANGGUNG (TERKALIBRASI AMAN):"
					TextColor3={Color3.fromHex("#666666")}
					Font={Fonts.Bold}
					TextSize={9}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="TrimPresetsRow"
					Position={new UDim2(0, 0, 0, 44)}
					Size={new UDim2(1, 0, 0, 30)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 6)} />
					{stageTrimPresets.map((p) => {
						const isSelected =
							math.abs(currentPanDeg - p.panDeg) < 3 && math.abs(currentTiltDeg - p.tiltDeg) < 3;
						return (
							<textbutton
								key={`trim_${p.label}`}
								Size={new UDim2(0.185, 0, 1, 0)}
								BackgroundColor3={
									isSelected ? Color3.fromHex("#00e5ff") : Color3.fromHex("#202020")
								}
								Text={p.label}
								TextColor3={
									isSelected ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")
								}
								Font={Fonts.Bold}
								TextSize={9}
								TextTruncate={Enum.TextTruncate.AtEnd}
								AutoButtonColor={false}
								ZIndex={13}
								Event={{
									MouseButton1Click: () => {
										adminService.setStageLighting({
											mode: StageLightMode.Manual,
											panAngle: math.rad(p.panDeg),
											tiltAngle: math.rad(p.tiltDeg),
										});
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
							</textbutton>
						);
					})}
				</frame>

				{/* Motor Speed Row */}
				<textlabel
					key="SpeedLabel"
					Position={new UDim2(0, 0, 0, 92)}
					Size={new UDim2(1, 0, 0, 14)}
					BackgroundTransparency={1}
					Text="KECEPATAN MOTOR (SERVO SPEED):"
					TextColor3={Color3.fromHex("#666666")}
					Font={Fonts.Bold}
					TextSize={9}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="SpeedPresetsRow"
					Position={new UDim2(0, 0, 0, 110)}
					Size={new UDim2(1, 0, 0, 28)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 8)} />
					{speedPresets.map((sp) => {
						const isSelected = math.abs(stageLighting.motorSpeed - sp.val) < 0.01;
						return (
							<textbutton
								key={`speed_${sp.val}`}
								Size={new UDim2(0.31, 0, 1, 0)}
								BackgroundColor3={
									isSelected ? Color3.fromHex("#00e5ff") : Color3.fromHex("#202020")
								}
								Text={sp.label}
								TextColor3={
									isSelected ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")
								}
								Font={Fonts.Bold}
								TextSize={11}
								AutoButtonColor={false}
								ZIndex={13}
								Event={{
									MouseButton1Click: () => {
										adminService.setStageLighting({ motorSpeed: sp.val });
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
							</textbutton>
						);
					})}
				</frame>
			</frame>

			{/* 5. Color Palette & RGB Rainbow */}
			<frame
				key="ColorCard"
				LayoutOrder={5}
				Size={new UDim2(1, 0, 0, 150)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
					PaddingLeft={new UDim(0, 12)}
					PaddingRight={new UDim(0, 12)}
				/>

				<textlabel
					key="Title"
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text="WARNA LAMPU & SPECTRUM"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				{/* Color Swatches Grid */}
				<frame
					key="ColorsRow"
					Position={new UDim2(0, 0, 0, 26)}
					Size={new UDim2(1, 0, 0, 34)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 8)} />
					{colorPalette.map((cp) => {
						const isSelected =
							!stageLighting.isRainbow &&
							math.abs(stageLighting.color.R - cp.color.R) < 0.05 &&
							math.abs(stageLighting.color.G - cp.color.G) < 0.05 &&
							math.abs(stageLighting.color.B - cp.color.B) < 0.05;

						return (
							<textbutton
								key={`color_${cp.name}`}
								Size={new UDim2(0.105, 0, 1, 0)}
								BackgroundColor3={Color3.fromHex(cp.hex)}
								Text=""
								AutoButtonColor={false}
								ZIndex={13}
								Event={{
									MouseButton1Click: () => {
										adminService.setStageLighting({
											color: cp.color,
											isRainbow: false,
										});
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 10)} />
								<uistroke
									Color={isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#444444")}
									Thickness={isSelected ? 2.5 : 1}
								/>
							</textbutton>
						);
					})}
				</frame>

				{/* Rainbow Cycle Toggle */}
				<textbutton
					key="RainbowToggle"
					Position={new UDim2(0, 0, 0, 72)}
					Size={new UDim2(1, 0, 0, 36)}
					BackgroundColor3={
						stageLighting.isRainbow ? Color3.fromHex("#ff007f") : Color3.fromHex("#222222")
					}
					Text=""
					AutoButtonColor={false}
					ZIndex={13}
					Event={{
						MouseButton1Click: () => {
							adminService.setStageLighting({
								isRainbow: !stageLighting.isRainbow,
							});
						},
					}}
				>
					<uicorner CornerRadius={new UDim(0, 10)} />
					<uistroke
						Color={
							stageLighting.isRainbow ? Color3.fromHex("#ffffff") : Color3.fromHex("#383838")
						}
						Thickness={1.2}
					/>
					<frame
						key="Content"
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundTransparency={1}
						ZIndex={14}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 8)}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						<LucideIcon
							name="sparkles"
							size={new UDim2(0, 16, 0, 16)}
							color={Color3.fromHex("#ffffff")}
							zIndex={14}
							layoutOrder={1}
						/>
						<textlabel
							key="Text"
							Size={new UDim2(0, 180, 1, 0)}
							BackgroundTransparency={1}
							Text={
								stageLighting.isRainbow
									? "★ RAINBOW RGB CYCLE (AKTIF)"
									: "AKTIFKAN RAINBOW RGB CYCLE"
							}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={11}
							ZIndex={14}
							LayoutOrder={2}
						/>
					</frame>
				</textbutton>
			</frame>

			{/* 6. Dimmer, Strobe & Pulse Effects */}
			<frame
				key="EffectsCard"
				LayoutOrder={6}
				Size={new UDim2(1, 0, 0, 240)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
					PaddingLeft={new UDim(0, 12)}
					PaddingRight={new UDim(0, 12)}
				/>

				<textlabel
					key="Title"
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text="DIMMER, BEAM & SPECIAL EFFECTS"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				{/* Dimmer Presets */}
				<textlabel
					key="DimmerLabel"
					Position={new UDim2(0, 0, 0, 26)}
					Size={new UDim2(1, 0, 0, 14)}
					BackgroundTransparency={1}
					Text="KECERAHAN LAMPU (DIMMER):"
					TextColor3={Color3.fromHex("#666666")}
					Font={Fonts.Bold}
					TextSize={9}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="DimmerRow"
					Position={new UDim2(0, 0, 0, 42)}
					Size={new UDim2(1, 0, 0, 28)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 8)} />
					{brightnessPresets.map((bp) => {
						const isSelected = math.abs(stageLighting.brightness - bp.val) < 0.3;
						return (
							<textbutton
								key={`bright_${bp.val}`}
								Size={new UDim2(0.23, 0, 1, 0)}
								BackgroundColor3={
									isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#202020")
								}
								Text={bp.label}
								TextColor3={
									isSelected ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")
								}
								Font={Fonts.Bold}
								TextSize={10}
								AutoButtonColor={false}
								ZIndex={13}
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

				{/* Strobe Speed */}
				<textlabel
					key="StrobeLabel"
					Position={new UDim2(0, 0, 0, 80)}
					Size={new UDim2(1, 0, 0, 14)}
					BackgroundTransparency={1}
					Text="KEDIP STROBE SPEED:"
					TextColor3={Color3.fromHex("#666666")}
					Font={Fonts.Bold}
					TextSize={9}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="StrobeRow"
					Position={new UDim2(0, 0, 0, 96)}
					Size={new UDim2(1, 0, 0, 28)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 8)} />
					{strobePresets.map((stp) => {
						const isSelected = stageLighting.strobeSpeed === stp.speed;
						return (
							<textbutton
								key={`strobe_${stp.speed}`}
								Size={new UDim2(0.185, 0, 1, 0)}
								BackgroundColor3={
									isSelected ? Color3.fromHex("#ffcc00") : Color3.fromHex("#202020")
								}
								Text={stp.label}
								TextColor3={
									isSelected ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")
								}
								Font={Fonts.Bold}
								TextSize={9}
								AutoButtonColor={false}
								ZIndex={13}
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

				{/* Toggles Row: Beam Volumetrik & Pulse Effect */}
				<frame
					key="TogglesRow"
					Position={new UDim2(0, 0, 0, 138)}
					Size={new UDim2(1, 0, 0, 36)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout FillDirection={Enum.FillDirection.Horizontal} Padding={new UDim(0, 10)} />

					{/* Beam Toggle */}
					<textbutton
						key="BeamToggle"
						Size={new UDim2(0.48, 0, 1, 0)}
						BackgroundColor3={
							stageLighting.beamEnabled
								? Color3.fromHex("#00e5ff")
								: Color3.fromHex("#202020")
						}
						Text={
							stageLighting.beamEnabled
								? "BEAM SOROT: AKTIF"
								: "BEAM SOROT: MATI"
						}
						TextColor3={
							stageLighting.beamEnabled
								? Color3.fromHex("#000000")
								: Color3.fromHex("#888888")
						}
						Font={Fonts.Bold}
						TextSize={11}
						AutoButtonColor={false}
						ZIndex={13}
						Event={{
							MouseButton1Click: () => {
								adminService.setStageLighting({
									beamEnabled: !stageLighting.beamEnabled,
								});
							},
						}}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
					</textbutton>

					{/* Pulse Toggle */}
					<textbutton
						key="PulseToggle"
						Size={new UDim2(0.48, 0, 1, 0)}
						BackgroundColor3={
							stageLighting.isPulse
								? Color3.fromHex("#a855f7")
								: Color3.fromHex("#202020")
						}
						Text={
							stageLighting.isPulse
								? "PULSE EFEK: AKTIF"
								: "PULSE EFEK: MATI"
						}
						TextColor3={
							stageLighting.isPulse
								? Color3.fromHex("#ffffff")
								: Color3.fromHex("#888888")
						}
						Font={Fonts.Bold}
						TextSize={11}
						AutoButtonColor={false}
						ZIndex={13}
						Event={{
							MouseButton1Click: () => {
								adminService.setStageLighting({
									isPulse: !stageLighting.isPulse,
								});
							},
						}}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
					</textbutton>
				</frame>
			</frame>
		</scrollingframe>
	);
}

/**
 * Backward-compatible OOP adapter for AdminStageFxTab.
 */
export class AdminStageFxTab {
	public readonly container: Frame;
	private root: Root;
	private isVisible = false;

	constructor(parent: Frame) {
		this.container = new Instance("Frame");
		this.container.Name = "AdminStageFxTabWrapper";
		this.container.Size = new UDim2(1, 0, 1, 0);
		this.container.BackgroundTransparency = 1;
		this.container.Visible = false;
		this.container.Parent = parent;

		this.root = ReactRoblox.createRoot(this.container);
		this.render();
	}

	private render(): void {
		this.root.render(<AdminStageFxTabComponent visible={this.isVisible} />);
	}

	public setVisible(val: boolean): void {
		this.isVisible = val;
		this.container.Visible = val;
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
		this.container.Destroy();
	}
}
