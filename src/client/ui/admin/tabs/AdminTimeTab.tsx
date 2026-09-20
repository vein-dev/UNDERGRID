import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { ReplicatedStorage } from "@rbxts/services";
import { AdminService } from "client/services/AdminService";
import { TimeService } from "client/services/TimeService";
import { Fonts } from "client/ui/Typography";
import { useInterval } from "client/ui/hooks";
import { TimePeriod } from "shared/types";
import { LucideIcon } from "../../components/LucideIcon";

export interface AdminTimeTabProps {
	visible: boolean;
}

export function AdminTimeTabComponent({ visible }: AdminTimeTabProps) {
	const adminService = AdminService.getInstance();
	const timeService = TimeService.getInstance();

	// State internal waktu
	const [clockTime, setClockTimeState] = useState(() => timeService.getClockTime());
	const [isPaused, setIsPaused] = useState(
		() => (ReplicatedStorage.GetAttribute("IsTimePaused") as boolean | undefined) ?? false,
	);
	const [timeScale, setTimeScaleState] = useState(
		() => (ReplicatedStorage.GetAttribute("TimeScale") as number | undefined) ?? 1.0,
	);
	const [cycleDuration, setCycleDurationState] = useState(
		() => (ReplicatedStorage.GetAttribute("CycleDurationMinutes") as number | undefined) ?? 24,
	);

	// Update live clock display setiap 0.5 detik
	useInterval(() => {
		if (visible) {
			setClockTimeState(timeService.getClockTime());
		}
	}, 0.5);

	// Listener atribut ReplicatedStorage
	useEffect(() => {
		const connPause = ReplicatedStorage.GetAttributeChangedSignal("IsTimePaused").Connect(() => {
			setIsPaused((ReplicatedStorage.GetAttribute("IsTimePaused") as boolean | undefined) ?? false);
		});
		const connScale = ReplicatedStorage.GetAttributeChangedSignal("TimeScale").Connect(() => {
			setTimeScaleState((ReplicatedStorage.GetAttribute("TimeScale") as number | undefined) ?? 1.0);
		});
		const connDuration = ReplicatedStorage.GetAttributeChangedSignal("CycleDurationMinutes").Connect(() => {
			setCycleDurationState(
				(ReplicatedStorage.GetAttribute("CycleDurationMinutes") as number | undefined) ?? 24,
			);
		});
		return () => {
			connPause.Disconnect();
			connScale.Disconnect();
			connDuration.Disconnect();
		};
	}, []);

	if (!visible) return <></>;

	// Format jam & menit digital (HH:MM)
	const hours = math.floor(clockTime);
	const minutes = math.floor((clockTime - hours) * 60);
	const formattedTime = string.format("%02d:%02d", hours, minutes);

	// Tentukan periode waktu saat ini & warnanya
	const period = timeService.getTimePeriod();
	let periodLabel = "Siang (Day)";
	let periodIcon = "sun";
	let periodColor = Color3.fromHex("#eab308"); // Kuning cerah

	if (period === TimePeriod.Dawn) {
		periodLabel = "Fajar (Dawn)";
		periodIcon = "sunrise";
		periodColor = Color3.fromHex("#f97316"); // Oranye hangat
	} else if (period === TimePeriod.Dusk) {
		periodLabel = "Senja (Dusk)";
		periodIcon = "sunset";
		periodColor = Color3.fromHex("#ec4899"); // Merah muda / ungu senja
	} else if (period === TimePeriod.Night) {
		periodLabel = "Malam (Night)";
		periodIcon = "moon";
		periodColor = Color3.fromHex("#38bdf8"); // Biru malam
	}

	// Preset jam cepat
	const quickPresets = [
		{ label: "Fajar (Dawn)", hour: 6.0, icon: "sunrise", timeStr: "06:00" },
		{ label: "Siang (Noon)", hour: 12.0, icon: "sun", timeStr: "12:00" },
		{ label: "Senja (Dusk)", hour: 18.0, icon: "sunset", timeStr: "18:00" },
		{ label: "Malam (Night)", hour: 0.0, icon: "moon", timeStr: "00:00" },
	];

	// Pilihan kecepatan waktu
	const speedOptions = [0.5, 1.0, 2.0, 5.0];

	// Pilihan durasi siklus
	const durationOptions = [
		{ label: "12 Menit", value: 12 },
		{ label: "24 Menit", value: 24 },
		{ label: "48 Menit", value: 48 },
	];

	return (
		<scrollingframe
			key="AdminTimeTab"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			ScrollBarThickness={3}
			ScrollBarImageColor3={Color3.fromHex("#383838")}
			CanvasSize={new UDim2(0, 0, 0, 0)}
			AutomaticCanvasSize={Enum.AutomaticSize.Y}
			ZIndex={10}
		>
			<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 12)} />
			<uipadding
				PaddingTop={new UDim(0, 12)}
				PaddingBottom={new UDim(0, 24)}
				PaddingLeft={new UDim(0, 14)}
				PaddingRight={new UDim(0, 14)}
			/>

			{/* 1. Status Display Card */}
			<frame
				key="StatusCard"
				LayoutOrder={1}
				Size={new UDim2(1, 0, 0, 114)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 14)}
					PaddingBottom={new UDim(0, 14)}
					PaddingLeft={new UDim(0, 16)}
					PaddingRight={new UDim(0, 16)}
				/>

				<frame key="TopRow" Size={new UDim2(1, 0, 0, 48)} BackgroundTransparency={1} ZIndex={12}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						VerticalAlignment={Enum.VerticalAlignment.Center}
						Padding={new UDim(0, 12)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{/* Icon Period */}
					<frame
						key="PeriodIconBadge"
						Size={new UDim2(0, 44, 0, 44)}
						BackgroundColor3={Color3.fromHex("#202020")}
						LayoutOrder={1}
						ZIndex={12}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
						<uistroke Color={periodColor} Transparency={0.6} Thickness={1.2} />
						<LucideIcon
							name={periodIcon}
							size={new UDim2(0, 22, 0, 22)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={periodColor}
							zIndex={13}
						/>
					</frame>

					{/* Time Numbers */}
					<frame key="TimeInfo" Size={new UDim2(0.5, 0, 1, 0)} BackgroundTransparency={1} LayoutOrder={2} ZIndex={12}>
						<uilistlayout
							FillDirection={Enum.FillDirection.Vertical}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							SortOrder={Enum.SortOrder.LayoutOrder}
						/>
						<textlabel
							key="TimeText"
							Size={new UDim2(1, 0, 0, 28)}
							BackgroundTransparency={1}
							Text={formattedTime}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={26}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={13}
							LayoutOrder={1}
						/>
						<textlabel
							key="PeriodText"
							Size={new UDim2(1, 0, 0, 16)}
							BackgroundTransparency={1}
							Text={periodLabel}
							TextColor3={periodColor}
							Font={Fonts.Medium}
							TextSize={12}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={13}
							LayoutOrder={2}
						/>
					</frame>

					{/* Status Chip (Paused / Running) */}
					<frame
						key="StatusChip"
						Size={new UDim2(0.4, -60, 0, 28)}
						AnchorPoint={new Vector2(1, 0.5)}
						BackgroundColor3={Color3.fromHex(isPaused ? "#451a03" : "#064e3b")}
						LayoutOrder={3}
						ZIndex={12}
					>
						<uicorner CornerRadius={new UDim(0, 8)} />
						<uistroke
							Color={Color3.fromHex(isPaused ? "#f59e0b" : "#10b981")}
							Transparency={0.5}
							Thickness={1}
						/>
						<textlabel
							key="StatusLabel"
							Size={new UDim2(1, 0, 1, 0)}
							BackgroundTransparency={1}
							Text={isPaused ? "DIJEDA" : "BERJALAN"}
							TextColor3={Color3.fromHex(isPaused ? "#fcd34d" : "#6ee7b7")}
							Font={Fonts.Bold}
							TextSize={11}
							TextXAlignment={Enum.TextXAlignment.Center}
							ZIndex={13}
						/>
					</frame>
				</frame>

				{/* Divider */}
				<frame
					key="StatusDivider"
					Position={new UDim2(0, 0, 0, 68)}
					Size={new UDim2(1, 0, 0, 1)}
					BackgroundColor3={Color3.fromHex("#282828")}
					BackgroundTransparency={0.6}
					ZIndex={12}
				/>

				{/* Metadata Subtext */}
				<textlabel
					key="MetaInfo"
					Position={new UDim2(0, 0, 0, 76)}
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text={`Siklus: ${cycleDuration} menit/hari  •  Kecepatan: ${timeScale}x`}
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Regular}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>
			</frame>

			{/* 2. Quick Preset Jam */}
			<frame
				key="PresetsCard"
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 142)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				<textlabel
					key="PresetsTitle"
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text="PRESET JAM CEPAT (ONE-TAP JUMP)"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="PresetsGrid"
					Position={new UDim2(0, 0, 0, 26)}
					Size={new UDim2(1, 0, 0, 88)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uigridlayout
						CellSize={new UDim2(0.48, 0, 0, 40)}
						CellPadding={new UDim2(0.04, 0, 0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{quickPresets.map((preset, index) => (
						<textbutton
							key={`PresetBtn_${preset.timeStr}`}
							LayoutOrder={index + 1}
							BackgroundColor3={Color3.fromHex("#202020")}
							Text=""
							AutoButtonColor={false}
							ZIndex={13}
							Event={{
								MouseButton1Click: () => {
									adminService.setClockTime(preset.hour);
								},
							}}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />
							<uistroke Color={Color3.fromHex("#2c2c2c")} Thickness={1} />
							<uipadding
								PaddingLeft={new UDim(0, 10)}
								PaddingRight={new UDim(0, 10)}
								PaddingTop={new UDim(0, 4)}
								PaddingBottom={new UDim(0, 4)}
							/>

							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 8)}
								SortOrder={Enum.SortOrder.LayoutOrder}
							/>

							<LucideIcon
								name={preset.icon}
								size={new UDim2(0, 16, 0, 16)}
								color={Color3.fromHex("#ffffff")}
								zIndex={14}
								layoutOrder={1}
							/>

							<textlabel
								key="Label"
								Size={new UDim2(1, -26, 1, 0)}
								BackgroundTransparency={1}
								Text={`${preset.label} [${preset.timeStr}]`}
								TextColor3={Color3.fromHex("#e5e5e5")}
								Font={Fonts.Medium}
								TextSize={11}
								TextXAlignment={Enum.TextXAlignment.Left}
								ZIndex={14}
								LayoutOrder={2}
							/>
						</textbutton>
					))}
				</frame>
			</frame>

			{/* 3. Penyesuaian Waktu & Playback */}
			<frame
				key="AdjustCard"
				LayoutOrder={3}
				Size={new UDim2(1, 0, 0, 102)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				<textlabel
					key="AdjustTitle"
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text="KONTROL PEMUTARAN & STEPPER"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="AdjustButtons"
					Position={new UDim2(0, 0, 0, 26)}
					Size={new UDim2(1, 0, 0, 46)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{/* Tombol Pause/Play */}
					<textbutton
						key="PauseToggleBtn"
						LayoutOrder={1}
						Size={new UDim2(0.48, -4, 1, 0)}
						BackgroundColor3={Color3.fromHex(isPaused ? "#059669" : "#d97706")}
						Text=""
						AutoButtonColor={false}
						ZIndex={13}
						Event={{
							MouseButton1Click: () => {
								adminService.toggleTimePause();
							},
						}}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
						<uipadding
							PaddingLeft={new UDim(0, 10)}
							PaddingRight={new UDim(0, 10)}
						/>
						<uilistlayout
							FillDirection={Enum.FillDirection.Horizontal}
							HorizontalAlignment={Enum.HorizontalAlignment.Center}
							VerticalAlignment={Enum.VerticalAlignment.Center}
							Padding={new UDim(0, 8)}
						/>
						<LucideIcon
							name={isPaused ? "play" : "pause"}
							size={new UDim2(0, 16, 0, 16)}
							color={Color3.fromHex("#ffffff")}
							zIndex={14}
						/>
						<textlabel
							key="BtnText"
							Size={new UDim2(0, 100, 1, 0)}
							BackgroundTransparency={1}
							Text={isPaused ? "Lanjutkan" : "Jeda Waktu"}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={12}
							ZIndex={14}
						/>
					</textbutton>

					{/* Step -1 Jam */}
					<textbutton
						key="StepMinusBtn"
						LayoutOrder={2}
						Size={new UDim2(0.24, -2, 1, 0)}
						BackgroundColor3={Color3.fromHex("#222222")}
						Text="-1 Jam"
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Bold}
						TextSize={12}
						AutoButtonColor={false}
						ZIndex={13}
						Event={{
							MouseButton1Click: () => {
								const target = (clockTime - 1 + 24) % 24;
								adminService.setClockTime(target);
							},
						}}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
						<uistroke Color={Color3.fromHex("#333333")} Thickness={1} />
					</textbutton>

					{/* Step +1 Jam */}
					<textbutton
						key="StepPlusBtn"
						LayoutOrder={3}
						Size={new UDim2(0.24, -2, 1, 0)}
						BackgroundColor3={Color3.fromHex("#222222")}
						Text="+1 Jam"
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Bold}
						TextSize={12}
						AutoButtonColor={false}
						ZIndex={13}
						Event={{
							MouseButton1Click: () => {
								const target = (clockTime + 1) % 24;
								adminService.setClockTime(target);
							},
						}}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
						<uistroke Color={Color3.fromHex("#333333")} Thickness={1} />
					</textbutton>
				</frame>
			</frame>

			{/* 4. Kecepatan Waktu (Time Scale) */}
			<frame
				key="SpeedCard"
				LayoutOrder={4}
				Size={new UDim2(1, 0, 0, 84)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				<textlabel
					key="SpeedTitle"
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text="KECEPATAN SIKLUS (TIME SCALE)"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="SpeedList"
					Position={new UDim2(0, 0, 0, 26)}
					Size={new UDim2(1, 0, 0, 34)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{speedOptions.map((speed, idx) => {
						const isSelected = math.abs(timeScale - speed) < 0.05;
						return (
							<textbutton
								key={`SpeedBtn_${speed}`}
								LayoutOrder={idx + 1}
								Size={new UDim2(0.23, 0, 1, 0)}
								BackgroundColor3={Color3.fromHex(isSelected ? "#3b82f6" : "#202020")}
								Text={`${speed}x`}
								TextColor3={Color3.fromHex(isSelected ? "#ffffff" : "#aaaaaa")}
								Font={Fonts.Bold}
								TextSize={12}
								AutoButtonColor={false}
								ZIndex={13}
								Event={{
									MouseButton1Click: () => {
										adminService.setTimeScale(speed);
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
								<uistroke
									Color={Color3.fromHex(isSelected ? "#60a5fa" : "#2e2e2e")}
									Thickness={1}
								/>
							</textbutton>
						);
					})}
				</frame>
			</frame>

			{/* 5. Durasi Siklus 1 Hari Penuh */}
			<frame
				key="DurationCard"
				LayoutOrder={5}
				Size={new UDim2(1, 0, 0, 84)}
				BackgroundColor3={Color3.fromHex("#161616")}
				BackgroundTransparency={0.25}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uistroke Color={Color3.fromHex("#282828")} Transparency={0.5} Thickness={1.1} />
				<uipadding
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				<textlabel
					key="DurationTitle"
					Size={new UDim2(1, 0, 0, 18)}
					BackgroundTransparency={1}
					Text="DURASI 1 HARI PENUH (CYCLE DURATION)"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="DurationList"
					Position={new UDim2(0, 0, 0, 26)}
					Size={new UDim2(1, 0, 0, 34)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uilistlayout
						FillDirection={Enum.FillDirection.Horizontal}
						Padding={new UDim(0, 8)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>

					{durationOptions.map((opt, idx) => {
						const isSelected = cycleDuration === opt.value;
						return (
							<textbutton
								key={`DurBtn_${opt.value}`}
								LayoutOrder={idx + 1}
								Size={new UDim2(0.31, 0, 1, 0)}
								BackgroundColor3={Color3.fromHex(isSelected ? "#8b5cf6" : "#202020")}
								Text={opt.label}
								TextColor3={Color3.fromHex(isSelected ? "#ffffff" : "#aaaaaa")}
								Font={Fonts.Bold}
								TextSize={12}
								AutoButtonColor={false}
								ZIndex={13}
								Event={{
									MouseButton1Click: () => {
										adminService.setCycleDuration(opt.value);
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 8)} />
								<uistroke
									Color={Color3.fromHex(isSelected ? "#a78bfa" : "#2e2e2e")}
									Thickness={1}
								/>
							</textbutton>
						);
					})}
				</frame>
			</frame>
		</scrollingframe>
	);
}

/**
 * Class Adapter pattern untuk integrasi non-React atau storybook
 */
export class AdminTimeTab {
	private root: Root;
	private isVisible = false;

	constructor(container: Instance) {
		this.root = ReactRoblox.createRoot(container);
		this.render();
	}

	public setVisible(visible: boolean): void {
		this.isVisible = visible;
		this.render();
	}

	public show(): void {
		this.setVisible(true);
	}

	public hide(): void {
		this.setVisible(false);
	}

	public destroy(): void {
		this.root.unmount();
	}

	private render(): void {
		this.root.render(<AdminTimeTabComponent visible={this.isVisible} />);
	}
}
