import React, { useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { AdminService } from "client/services/AdminService";
import { Fonts } from "client/ui/Typography";
import { LucideIcon } from "../../components/LucideIcon";

export interface AdminAnnouncementTabProps {
	visible: boolean;
}

export function AdminAnnouncementTabComponent({ visible }: AdminAnnouncementTabProps) {
	const adminService = AdminService.getInstance();
	const [announcementText, setAnnouncementText] = useState("");

	if (!visible) return <></>;

	const quickTexts = [
		"Rundown Band A dimulai",
		"MC naik panggung",
		"Open Gate 5 Menit Lagi",
	];

	return (
		<scrollingframe
			key="AdminAnnouncementTab"
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

			{/* Push Announcement Card */}
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
		</scrollingframe>
	);
}

/**
 * OOP adapter for AdminAnnouncementTab.
 */
export class AdminAnnouncementTab {
	public readonly container: Frame;
	private root: Root;
	private isVisible = false;

	constructor(parent: Frame) {
		this.container = new Instance("Frame");
		this.container.Name = "AdminAnnouncementTabWrapper";
		this.container.Size = new UDim2(1, 0, 1, 0);
		this.container.BackgroundTransparency = 1;
		this.container.Visible = false;
		this.container.Parent = parent;

		this.root = ReactRoblox.createRoot(this.container);
		this.render();
	}

	private render(): void {
		this.root.render(<AdminAnnouncementTabComponent visible={this.isVisible} />);
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
