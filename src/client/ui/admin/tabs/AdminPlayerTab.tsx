import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { AdminService } from "client/services/AdminService";
import { Fonts } from "client/ui/Typography";
import { PlayerEntryInfo } from "shared/types";

export interface AdminPlayerTabProps {
	visible: boolean;
}

export function AdminPlayerTabComponent({ visible }: AdminPlayerTabProps) {
	const adminService = AdminService.getInstance();
	const [playersList, setPlayersList] = useState<PlayerEntryInfo[]>([]);

	const refreshList = () => {
		const list: PlayerEntryInfo[] = [];
		for (const p of Players.GetPlayers()) {
			list.push({
				userId: p.UserId,
				name: p.Name,
				displayName: p.DisplayName || p.Name,
			});
		}
		setPlayersList(list);
	};

	useEffect(() => {
		if (visible) {
			refreshList();
		}
		const connAdd = Players.PlayerAdded.Connect(() => refreshList());
		const connRem = Players.PlayerRemoving.Connect(() => refreshList());

		return () => {
			connAdd.Disconnect();
			connRem.Disconnect();
		};
	}, [visible]);

	if (!visible) return <></>;

	return (
		<scrollingframe
			key="AdminPlayerTab"
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

			{/* Card Container */}
			<frame
				key="PlayerManagementCard"
				Size={new UDim2(1, 0, 0, 360)}
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

				{/* Header Row */}
				<frame
					key="Header"
					Size={new UDim2(1, 0, 0, 22)}
					BackgroundTransparency={1}
					ZIndex={12}
				>
					<textlabel
						key="Title"
						Size={new UDim2(0.6, 0, 1, 0)}
						BackgroundTransparency={1}
						Text="ACTIVE PLAYERS IN SERVER"
						TextColor3={Color3.fromHex("#888888")}
						Font={Fonts.Bold}
						TextSize={11}
						TextXAlignment={Enum.TextXAlignment.Left}
						ZIndex={12}
					/>
					<textlabel
						key="CountLabel"
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, 0, 0.5, 0)}
						Size={new UDim2(0.35, 0, 1, 0)}
						BackgroundTransparency={1}
						Text={`Total: ${playersList.size()}`}
						TextColor3={Color3.fromHex("#888888")}
						Font={Fonts.Regular}
						TextSize={11}
						TextXAlignment={Enum.TextXAlignment.Right}
						ZIndex={12}
					/>
				</frame>

				{/* Inner Scrollable List */}
				<scrollingframe
					key="PlayerListScroll"
					Position={new UDim2(0, 0, 0, 28)}
					Size={new UDim2(1, 0, 1, -28)}
					BackgroundTransparency={1}
					ScrollBarThickness={2}
					ScrollBarImageColor3={Color3.fromHex("#383838")}
					CanvasSize={new UDim2(0, 0, 0, 0)}
					AutomaticCanvasSize={Enum.AutomaticSize.Y}
					ZIndex={12}
				>
					<uilistlayout Padding={new UDim(0, 8)} SortOrder={Enum.SortOrder.LayoutOrder} />

					{playersList.map((info, idx) => (
						<frame
							key={`Row_${info.userId}`}
							LayoutOrder={idx}
							Size={new UDim2(1, 0, 0, 48)}
							BackgroundColor3={Color3.fromHex("#1a1a1a")}
							ZIndex={13}
						>
							<uicorner CornerRadius={new UDim(0, 8)} />

							{/* Avatar circle */}
							<imagelabel
								key="Avatar"
								Position={new UDim2(0, 8, 0.5, -16)}
								Size={new UDim2(0, 32, 0, 32)}
								BackgroundColor3={Color3.fromHex("#242424")}
								Image={`rbxthumb://type=AvatarHeadShot&id=${info.userId}&w=150&h=150`}
								ZIndex={14}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
							</imagelabel>

							{/* Name Info */}
							<frame
								key="NameBox"
								Position={new UDim2(0, 48, 0, 6)}
								Size={new UDim2(0.38, 0, 1, -12)}
								BackgroundTransparency={1}
								ZIndex={14}
							>
								<textlabel
									key="DisplayName"
									Size={new UDim2(1, 0, 0.55, 0)}
									BackgroundTransparency={1}
									Text={info.displayName}
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Bold}
									TextSize={12}
									TextXAlignment={Enum.TextXAlignment.Left}
									TextTruncate={Enum.TextTruncate.AtEnd}
									ZIndex={14}
								/>
								<textlabel
									key="Username"
									Position={new UDim2(0, 0, 0.55, 0)}
									Size={new UDim2(1, 0, 0.45, 0)}
									BackgroundTransparency={1}
									Text={`@${info.name}`}
									TextColor3={Color3.fromHex("#888888")}
									Font={Fonts.Regular}
									TextSize={10}
									TextXAlignment={Enum.TextXAlignment.Left}
									TextTruncate={Enum.TextTruncate.AtEnd}
									ZIndex={14}
								/>
							</frame>

							{/* Action Buttons */}
							<frame
								key="Actions"
								AnchorPoint={new Vector2(1, 0.5)}
								Position={new UDim2(1, -8, 0.5, 0)}
								Size={new UDim2(0.52, 0, 0, 32)}
								BackgroundTransparency={1}
								ZIndex={14}
							>
								<uilistlayout
									FillDirection={Enum.FillDirection.Horizontal}
									HorizontalAlignment={Enum.HorizontalAlignment.Right}
									Padding={new UDim(0, 6)}
								/>

								{/* Teleport To Button */}
								<textbutton
									key="TpBtn"
									Size={new UDim2(0.48, 0, 1, 0)}
									BackgroundColor3={Color3.fromHex("#ffffff")}
									Text="Teleport"
									TextColor3={Color3.fromHex("#000000")}
									Font={Fonts.Bold}
									TextSize={11}
									AutoButtonColor={false}
									ZIndex={15}
									Event={{
										MouseButton1Click: () => {
											adminService.teleportTo(info.userId);
										},
									}}
								>
									<uicorner CornerRadius={new UDim(0, 6)} />
								</textbutton>

								{/* Bring Button */}
								<textbutton
									key="BringBtn"
									Size={new UDim2(0.48, 0, 1, 0)}
									BackgroundColor3={Color3.fromHex("#262626")}
									Text="Bring"
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Bold}
									TextSize={11}
									AutoButtonColor={false}
									ZIndex={15}
									Event={{
										MouseButton1Click: () => {
											adminService.bringPlayer(info.userId);
										},
									}}
								>
									<uicorner CornerRadius={new UDim(0, 6)} />
								</textbutton>
							</frame>
						</frame>
					))}
				</scrollingframe>
			</frame>
		</scrollingframe>
	);
}

/**
 * Backward-compatible OOP adapter for AdminPlayerTab.
 */
export class AdminPlayerTab {
	public readonly container: Frame;
	private root: Root;
	private isVisible = false;

	constructor(parent: Frame) {
		this.container = new Instance("Frame");
		this.container.Name = "AdminPlayerTabWrapper";
		this.container.Size = new UDim2(1, 0, 1, 0);
		this.container.BackgroundTransparency = 1;
		this.container.Visible = false;
		this.container.Parent = parent;

		this.root = ReactRoblox.createRoot(this.container);
		this.render();
	}

	private render(): void {
		this.root.render(<AdminPlayerTabComponent visible={this.isVisible} />);
	}

	public refreshPlayerList(): void {
		this.render();
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
