import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { AdminService } from "client/services/AdminService";
import { Fonts } from "client/ui/Typography";
import { AtmospherePreset } from "shared/types";
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

	const presetsList: Array<{ preset: AtmospherePreset; label: string; icon: string }> = [
		{ preset: AtmospherePreset.Spotlight, label: "Lampu Sorot", icon: "flashlight" },
		{ preset: AtmospherePreset.Strobe, label: "Lampu Strobo", icon: "zap" },
		{ preset: AtmospherePreset.Blackout, label: "Blackout Total", icon: "moon" },
		{ preset: AtmospherePreset.FogMachine, label: "Mesin Asap / Fog", icon: "cloud" },
	];

	const quickTexts = [
		"Rundown Band A dimulai",
		"MC naik panggung",
		"Open Gate 5 Menit Lagi",
	];

	return (
		<scrollingframe
			key="AdminStageFxTab"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			ScrollBarThickness={3}
			ScrollBarImageColor3={Color3.fromHex("#383838")}
			CanvasSize={new UDim2(0, 0, 0, 0)}
			AutomaticCanvasSize={Enum.AutomaticSize.Y}
			ZIndex={10}
		>
			<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 14)} />
			<uipadding
				PaddingTop={new UDim(0, 12)}
				PaddingBottom={new UDim(0, 24)}
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

				{/* Input Box */}
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

				{/* Send Button */}
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

				{/* Quick Presets Label */}
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

				{/* Quick Preset Buttons Row */}
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

			{/* 2. Atmosphere FX Card */}
			<frame
				key="AtmosphereFxCard"
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 170)}
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
					Text="STAGE & ATMOSPHERE PRESETS"
					TextColor3={Color3.fromHex("#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={12}
				/>

				<frame
					key="FxGrid"
					Position={new UDim2(0, 0, 0, 26)}
					Size={new UDim2(1, 0, 1, -26)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<uigridlayout
						CellSize={new UDim2(0.48, 0, 0, 52)}
						CellPadding={new UDim2(0.04, 0, 0, 10)}
					/>

					{presetsList.map((item) => {
						const isActive = adminState.activePresets.includes(item.preset);
						return (
							<textbutton
								key={`FxBtn_${item.preset}`}
								BackgroundColor3={
									isActive ? Color3.fromHex("#ffffff") : Color3.fromHex("#1e1e1e")
								}
								Text=""
								AutoButtonColor={false}
								ZIndex={13}
								Event={{
									MouseButton1Click: () => {
										adminService.toggleAtmospherePreset(item.preset);
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 10)} />
								<uistroke
									Color={
										isActive ? Color3.fromHex("#ffffff") : Color3.fromHex("#333333")
									}
									Thickness={1.1}
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
										name={item.icon}
										size={new UDim2(0, 16, 0, 16)}
										color={
											isActive ? Color3.fromHex("#000000") : Color3.fromHex("#d0d0d0")
										}
										zIndex={14}
										layoutOrder={1}
									/>
									<textlabel
										key="Label"
										Size={new UDim2(0, 110, 1, 0)}
										BackgroundTransparency={1}
										Text={item.label}
										TextColor3={
											isActive ? Color3.fromHex("#000000") : Color3.fromHex("#d0d0d0")
										}
										Font={Fonts.Bold}
										TextSize={11}
										ZIndex={14}
										LayoutOrder={2}
									/>
								</frame>
							</textbutton>
						);
					})}
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
