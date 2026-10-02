import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { AdminService } from "client/services/AdminService";
import { GlobalNotificationService } from "client/services/GlobalNotificationService";
import { Fonts } from "client/ui/Typography";
import { LucideIcon } from "client/ui/components/LucideIcon";
import { BanRecord, PlayerEntryInfo } from "shared/types";

export interface AdminPlayerTabProps {
	visible: boolean;
}

type SubTab = "active" | "banned";

export function AdminPlayerTabComponent({ visible }: AdminPlayerTabProps) {
	const adminService = AdminService.getInstance();
	const [subTab, setSubTab] = useState<SubTab>("active");
	const [playersList, setPlayersList] = useState<PlayerEntryInfo[]>([]);
	const [bannedList, setBannedList] = useState<BanRecord[]>([]);

	// Manual ban/unban input field
	const [manualInput, setManualInput] = useState("");

	// Confirmation modal state for Kick or Ban
	const [modalState, setModalState] = useState<{
		type: "kick" | "ban";
		target: PlayerEntryInfo;
	} | undefined>(undefined);
	const [modalReason, setModalReason] = useState("");
	const [modalDuration, setModalDuration] = useState<number>(0); // 0 = permanent

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
		setBannedList(adminService.getBannedList());
	};

	useEffect(() => {
		if (visible) {
			refreshList();
			task.spawn(async () => {
				const full = await adminService.fetchFullState();
				if (full && full.banned) {
					setBannedList(full.banned);
				}
			});
		}

		const unsubBans = adminService.onBannedListUpdated((updatedBans) => {
			setBannedList(updatedBans);
		});

		const connAdd = Players.PlayerAdded.Connect(() => refreshList());
		const connRem = Players.PlayerRemoving.Connect(() => refreshList());

		return () => {
			unsubBans();
			connAdd.Disconnect();
			connRem.Disconnect();
		};
	}, [visible]);

	if (!visible) return <></>;

	const handleConfirmAction = () => {
		if (!modalState) return;
		const targetName = modalState.target.displayName || modalState.target.name;
		if (modalState.type === "kick") {
			adminService.kickPlayer(modalState.target.userId, modalReason);
			GlobalNotificationService.getInstance().show({
				title: "Kick Berhasil",
				message: `Mengeluarkan ${targetName}`,
				icon: `rbxthumb://type=AvatarHeadShot&id=${modalState.target.userId}&w=48&h=48`,
				badgeIcon: "user-x",
				badgeColor: Color3.fromHex("#f59e0b"),
			});
		} else if (modalState.type === "ban") {
			adminService.banPlayer(modalState.target.userId, modalReason, modalDuration);
			GlobalNotificationService.getInstance().show({
				title: "Ban Berhasil",
				message: `Memblokir ${targetName}`,
				icon: `rbxthumb://type=AvatarHeadShot&id=${modalState.target.userId}&w=48&h=48`,
				badgeIcon: "shield-alert",
				badgeColor: Color3.fromHex("#ef4444"),
			});
		}
		setModalState(undefined);
		setModalReason("");
	};

	const handleManualBan = () => {
		const trimmed = manualInput.gsub("^%s*(.-)%s*$", "%1")[0];
		if (trimmed.size() === 0) return;

		const numId = tonumber(trimmed);
		if (numId !== undefined) {
			adminService.banPlayer(numId, "Manual Ban dari Admin Panel", 0);
		} else {
			adminService.banByUsername(trimmed, "Manual Ban dari Admin Panel", 0);
		}
		setManualInput("");
	};

	const handleManualUnban = () => {
		const trimmed = manualInput.gsub("^%s*(.-)%s*$", "%1")[0];
		if (trimmed.size() === 0) return;

		const numId = tonumber(trimmed);
		if (numId !== undefined) {
			adminService.unbanPlayer(numId);
		} else {
			adminService.unbanByUsername(trimmed);
		}
		setManualInput("");
	};

	return (
		<frame
			key="AdminPlayerTabContainer"
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			ClipsDescendants={false}
			ZIndex={10}
		>
			<scrollingframe
				key="AdminPlayerTabScroll"
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
					PaddingTop={new UDim(0, 10)}
					PaddingBottom={new UDim(0, 24)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

			{/* Sub-Tab Navigation Segmented Pill */}
			<frame
				key="SubTabBar"
				Size={new UDim2(1, 0, 0, 34)}
				BackgroundColor3={Color3.fromHex("#181818")}
				ZIndex={11}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 4)}
				/>
				<uipadding
					PaddingTop={new UDim(0, 3)}
					PaddingBottom={new UDim(0, 3)}
					PaddingLeft={new UDim(0, 4)}
					PaddingRight={new UDim(0, 4)}
				/>

				{/* Active Players Sub-Tab */}
				<textbutton
					key="ActiveSubTab"
					Size={new UDim2(0.5, -2, 1, 0)}
					BackgroundColor3={Color3.fromHex(subTab === "active" ? "#2b2b2b" : "#1a1a1a")}
					BackgroundTransparency={subTab === "active" ? 0 : 1}
					Text={`Active Players (${playersList.size()})`}
					TextColor3={Color3.fromHex(subTab === "active" ? "#ffffff" : "#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					AutoButtonColor={false}
					ZIndex={12}
					Event={{
						MouseButton1Click: () => setSubTab("active"),
					}}
				>
					<uicorner CornerRadius={new UDim(0, 6)} />
				</textbutton>

				{/* Banned List Sub-Tab */}
				<textbutton
					key="BannedSubTab"
					Size={new UDim2(0.5, -2, 1, 0)}
					BackgroundColor3={Color3.fromHex(subTab === "banned" ? "#2b2b2b" : "#1a1a1a")}
					BackgroundTransparency={subTab === "banned" ? 0 : 1}
					Text={`Banned List (${bannedList.size()})`}
					TextColor3={Color3.fromHex(subTab === "banned" ? "#ffffff" : "#888888")}
					Font={Fonts.Bold}
					TextSize={11}
					AutoButtonColor={false}
					ZIndex={12}
					Event={{
						MouseButton1Click: () => setSubTab("banned"),
					}}
				>
					<uicorner CornerRadius={new UDim(0, 6)} />
				</textbutton>
			</frame>

			{/* Main Content Card */}
			<frame
				key="PlayerManagementCard"
				Size={new UDim2(1, 0, 0, 350)}
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

				{/* ──────── ACTIVE PLAYERS SUB-TAB CONTENT ──────── */}
				{subTab === "active" && (
					<>
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
								Text="ONLINE PLAYERS"
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
										Position={new UDim2(0, 46, 0, 6)}
										Size={new UDim2(0.36, 0, 1, -12)}
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

									{/* Action Buttons: TP, Bring, Kick, Ban */}
									<frame
										key="Actions"
										AnchorPoint={new Vector2(1, 0.5)}
										Position={new UDim2(1, -6, 0.5, 0)}
										Size={new UDim2(0.58, 0, 0, 30)}
										BackgroundTransparency={1}
										ZIndex={14}
									>
										<uilistlayout
											FillDirection={Enum.FillDirection.Horizontal}
											HorizontalAlignment={Enum.HorizontalAlignment.Right}
											VerticalAlignment={Enum.VerticalAlignment.Center}
											Padding={new UDim(0, 4)}
										/>

										{/* Teleport To Button */}
										<textbutton
											key="TpBtn"
											Size={new UDim2(0, 48, 0, 28)}
											BackgroundColor3={Color3.fromHex("#ffffff")}
											Text="TP"
											TextColor3={Color3.fromHex("#000000")}
											Font={Fonts.Bold}
											TextSize={10}
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
											Size={new UDim2(0, 50, 0, 28)}
											BackgroundColor3={Color3.fromHex("#282828")}
											Text="Bring"
											TextColor3={Color3.fromHex("#ffffff")}
											Font={Fonts.Bold}
											TextSize={10}
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

										{/* Kick Button */}
										<textbutton
											key="KickBtn"
											Size={new UDim2(0, 48, 0, 28)}
											BackgroundColor3={Color3.fromHex("#854d0e")}
											Text="Kick"
											TextColor3={Color3.fromHex("#fef08a")}
											Font={Fonts.Bold}
											TextSize={10}
											AutoButtonColor={false}
											ZIndex={15}
											Event={{
												MouseButton1Click: () => {
													setModalState({ type: "kick", target: info });
													setModalReason("Melanggar aturan komunitas");
												},
											}}
										>
											<uicorner CornerRadius={new UDim(0, 6)} />
										</textbutton>

										{/* Ban Button */}
										<textbutton
											key="BanBtn"
											Size={new UDim2(0, 46, 0, 28)}
											BackgroundColor3={Color3.fromHex("#881337")}
											Text="Ban"
											TextColor3={Color3.fromHex("#fecdd3")}
											Font={Fonts.Bold}
											TextSize={10}
											AutoButtonColor={false}
											ZIndex={15}
											Event={{
												MouseButton1Click: () => {
													setModalState({ type: "ban", target: info });
													setModalReason("Perilaku exploit / toksik");
													setModalDuration(0);
												},
											}}
										>
											<uicorner CornerRadius={new UDim(0, 6)} />
										</textbutton>
									</frame>
								</frame>
							))}
						</scrollingframe>
					</>
				)}

				{/* ──────── BANNED PLAYERS SUB-TAB CONTENT ──────── */}
				{subTab === "banned" && (
					<>
						{/* Manual Ban/Unban Input Row */}
						<frame
							key="ManualBar"
							Size={new UDim2(1, 0, 0, 34)}
							BackgroundTransparency={1}
							ZIndex={12}
						>
							<textbox
								key="ManualInput"
								Size={new UDim2(0.6, -6, 1, 0)}
								BackgroundColor3={Color3.fromHex("#1a1a1a")}
								PlaceholderText="Username atau UserId..."
								PlaceholderColor3={Color3.fromHex("#666666")}
								Text={manualInput}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Medium}
								TextSize={11}
								ClearTextOnFocus={false}
								ZIndex={13}
								Event={{
									FocusLost: (rbx) => setManualInput(rbx.Text),
								}}
							>
								<uicorner CornerRadius={new UDim(0, 6)} />
								<uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} />
							</textbox>

							<textbutton
								key="ManualBanBtn"
								Position={new UDim2(0.6, 2, 0, 0)}
								Size={new UDim2(0.2, -4, 1, 0)}
								BackgroundColor3={Color3.fromHex("#881337")}
								Text="Ban ID"
								TextColor3={Color3.fromHex("#fecdd3")}
								Font={Fonts.Bold}
								TextSize={10}
								AutoButtonColor={false}
								ZIndex={13}
								Event={{
									MouseButton1Click: handleManualBan,
								}}
							>
								<uicorner CornerRadius={new UDim(0, 6)} />
							</textbutton>

							<textbutton
								key="ManualUnbanBtn"
								Position={new UDim2(0.8, 2, 0, 0)}
								Size={new UDim2(0.2, -4, 1, 0)}
								BackgroundColor3={Color3.fromHex("#065f46")}
								Text="Unban"
								TextColor3={Color3.fromHex("#a7f3d0")}
								Font={Fonts.Bold}
								TextSize={10}
								AutoButtonColor={false}
								ZIndex={13}
								Event={{
									MouseButton1Click: handleManualUnban,
								}}
							>
								<uicorner CornerRadius={new UDim(0, 6)} />
							</textbutton>
						</frame>

						{/* Banned List Scroll */}
						<scrollingframe
							key="BannedListScroll"
							Position={new UDim2(0, 0, 0, 42)}
							Size={new UDim2(1, 0, 1, -42)}
							BackgroundTransparency={1}
							ScrollBarThickness={2}
							ScrollBarImageColor3={Color3.fromHex("#383838")}
							CanvasSize={new UDim2(0, 0, 0, 0)}
							AutomaticCanvasSize={Enum.AutomaticSize.Y}
							ZIndex={12}
						>
							<uilistlayout Padding={new UDim(0, 8)} SortOrder={Enum.SortOrder.LayoutOrder} />

							{bannedList.size() === 0 ? (
								<textlabel
									key="EmptyLabel"
									Size={new UDim2(1, 0, 0, 60)}
									BackgroundTransparency={1}
									Text="Tidak ada pemain yang sedang diblokir."
									TextColor3={Color3.fromHex("#666666")}
									Font={Fonts.Regular}
									TextSize={12}
									ZIndex={13}
								/>
							) : (
								bannedList.map((item, idx) => (
									<frame
										key={`BannedRow_${item.userId}`}
										LayoutOrder={idx}
										Size={new UDim2(1, 0, 0, 52)}
										BackgroundColor3={Color3.fromHex("#1a1a1a")}
										ZIndex={13}
									>
										<uicorner CornerRadius={new UDim(0, 8)} />

										{/* Avatar circle */}
										<imagelabel
											key="Avatar"
											Position={new UDim2(0, 8, 0.5, -18)}
											Size={new UDim2(0, 36, 0, 36)}
											BackgroundColor3={Color3.fromHex("#242424")}
											Image={`rbxthumb://type=AvatarHeadShot&id=${item.userId}&w=150&h=150`}
											ZIndex={14}
										>
											<uicorner CornerRadius={new UDim(1, 0)} />
										</imagelabel>

										{/* Ban info */}
										<frame
											key="BanInfoBox"
											Position={new UDim2(0, 52, 0, 5)}
											Size={new UDim2(0.65, 0, 1, -10)}
											BackgroundTransparency={1}
											ZIndex={14}
										>
											<textlabel
												key="NameId"
												Size={new UDim2(1, 0, 0.36, 0)}
												BackgroundTransparency={1}
												Text={`${item.name} (ID: ${item.userId})`}
												TextColor3={Color3.fromHex("#ffffff")}
												Font={Fonts.Bold}
												TextSize={11}
												TextXAlignment={Enum.TextXAlignment.Left}
												TextTruncate={Enum.TextTruncate.AtEnd}
												ZIndex={14}
											/>
											<textlabel
												key="Reason"
												Position={new UDim2(0, 0, 0.36, 0)}
												Size={new UDim2(1, 0, 0.34, 0)}
												BackgroundTransparency={1}
												Text={`Alasan: ${item.reason}`}
												TextColor3={Color3.fromHex("#f87171")}
												Font={Fonts.Medium}
												TextSize={10}
												TextXAlignment={Enum.TextXAlignment.Left}
												TextTruncate={Enum.TextTruncate.AtEnd}
												ZIndex={14}
											/>
											<textlabel
												key="Meta"
												Position={new UDim2(0, 0, 0.7, 0)}
												Size={new UDim2(1, 0, 0.3, 0)}
												BackgroundTransparency={1}
												Text={`Oleh: @${item.bannedBy} • ${item.durationSeconds === 0 ? "Permanen" : math.ceil(item.durationSeconds / 60) + "m"}`}
												TextColor3={Color3.fromHex("#777777")}
												Font={Fonts.Regular}
												TextSize={9}
												TextXAlignment={Enum.TextXAlignment.Left}
												TextTruncate={Enum.TextTruncate.AtEnd}
												ZIndex={14}
											/>
										</frame>

										{/* Unban Button */}
										<textbutton
											key="UnbanBtn"
											AnchorPoint={new Vector2(1, 0.5)}
											Position={new UDim2(1, -8, 0.5, 0)}
											Size={new UDim2(0, 60, 0, 28)}
											BackgroundColor3={Color3.fromHex("#065f46")}
											Text="Unban"
											TextColor3={Color3.fromHex("#6ee7b7")}
											Font={Fonts.Bold}
											TextSize={10}
											AutoButtonColor={false}
											ZIndex={15}
											Event={{
												MouseButton1Click: () => {
													adminService.unbanPlayer(item.userId);
												},
											}}
										>
											<uicorner CornerRadius={new UDim(0, 6)} />
										</textbutton>
									</frame>
								))
							)}
						</scrollingframe>
					</>
				)}
			</frame>

			</scrollingframe>

			{/* ──────── POP-UP KONFIRMASI MINIMALIS (Kick / Ban) ──────── */}
			{modalState && (
				<frame
					key="ConfirmationModalOverlay"
					Size={new UDim2(1, 0, 1, 0)}
					Position={new UDim2(0, 0, 0, 0)}
					BackgroundColor3={Color3.fromHex("#000000")}
					BackgroundTransparency={0.65}
					Active={true}
					ZIndex={50}
				>
					{/* Pop-up Card Minimalis */}
					<frame
						key="DialogCard"
						AnchorPoint={new Vector2(0.5, 0.5)}
						Position={new UDim2(0.5, 0, 0.5, 0)}
						Size={new UDim2(0, 310, 0, modalState.type === "ban" ? 245 : 185)}
						BackgroundColor3={Color3.fromHex("#141416")}
						Active={true}
						ZIndex={51}
					>
						<uicorner CornerRadius={new UDim(0, 12)} />
						<uistroke
							Color={modalState.type === "kick" ? Color3.fromHex("#f59e0b") : Color3.fromHex("#ef4444")}
							Transparency={0.4}
							Thickness={1}
						/>
						<uipadding
							PaddingTop={new UDim(0, 14)}
							PaddingBottom={new UDim(0, 14)}
							PaddingLeft={new UDim(0, 14)}
							PaddingRight={new UDim(0, 14)}
						/>

						{/* Header Icon + Title */}
						<frame
							key="HeaderRow"
							Size={new UDim2(1, 0, 0, 22)}
							BackgroundTransparency={1}
							ZIndex={52}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 8)}
							/>
							<LucideIcon
								name={modalState.type === "kick" ? "user-x" : "shield-alert"}
								size={new UDim2(0, 16, 0, 16)}
								color={modalState.type === "kick" ? Color3.fromHex("#f59e0b") : Color3.fromHex("#ef4444")}
							/>
							<textlabel
								key="Title"
								Size={new UDim2(1, -24, 1, 0)}
								BackgroundTransparency={1}
								Text={
									modalState.type === "kick"
										? `Kick: ${modalState.target.displayName}`
										: `Ban: ${modalState.target.displayName}`
								}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={12}
								TextXAlignment={Enum.TextXAlignment.Left}
								TextTruncate={Enum.TextTruncate.AtEnd}
								ZIndex={52}
							/>
						</frame>

						{/* Subtitle / Username Info */}
						<textlabel
							key="TargetInfo"
							Position={new UDim2(0, 0, 0, 26)}
							Size={new UDim2(1, 0, 0, 14)}
							BackgroundTransparency={1}
							Text={`@${modalState.target.name} · ID: ${modalState.target.userId}`}
							TextColor3={Color3.fromHex("#71717a")}
							Font={Fonts.Regular}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Left}
							ZIndex={52}
						/>

						{/* Reason Input Box */}
						<frame
							key="ReasonBox"
							Position={new UDim2(0, 0, 0, 46)}
							Size={new UDim2(1, 0, 0, 32)}
							BackgroundColor3={Color3.fromHex("#1c1c1f")}
							ZIndex={52}
						>
							<uicorner CornerRadius={new UDim(0, 6)} />
							<uistroke Color={Color3.fromHex("#2e2e33")} Thickness={1} />
							<textbox
								key="ReasonInput"
								Size={new UDim2(1, 0, 1, 0)}
								BackgroundTransparency={1}
								Text={modalReason}
								TextColor3={Color3.fromHex("#ffffff")}
								PlaceholderText="Alasan (opsional)..."
								PlaceholderColor3={Color3.fromHex("#636366")}
								Font={Fonts.Regular}
								TextSize={11}
								ClearTextOnFocus={false}
								ZIndex={53}
								Event={{
									FocusLost: (rbx) => setModalReason(rbx.Text),
								}}
							>
								<uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} />
							</textbox>
						</frame>

						{/* Duration Picker for BAN only */}
						{modalState.type === "ban" && (
							<frame
								key="BanDurationPicker"
								Position={new UDim2(0, 0, 0, 86)}
								Size={new UDim2(1, 0, 0, 42)}
								BackgroundTransparency={1}
								ZIndex={52}
							>
								<textlabel
									key="DurTitle"
									Size={new UDim2(1, 0, 0, 14)}
									BackgroundTransparency={1}
									Text="DURASI BAN"
									TextColor3={Color3.fromHex("#a1a1aa")}
									Font={Fonts.Bold}
									TextSize={9}
									TextXAlignment={Enum.TextXAlignment.Left}
									ZIndex={52}
								/>
								<frame
									key="PillRow"
									Position={new UDim2(0, 0, 0, 16)}
									Size={new UDim2(1, 0, 0, 24)}
									BackgroundTransparency={1}
									ZIndex={52}
								>
									<uilistlayout
										FillDirection={Enum.FillDirection.Horizontal}
										Padding={new UDim(0, 5)}
									/>
									{[
										{ label: "Permanen", dur: 0 },
										{ label: "1 Hari", dur: 86400 },
										{ label: "7 Hari", dur: 604800 },
										{ label: "30 Hari", dur: 2592000 },
									].map((opt) => {
										const isSelected = modalDuration === opt.dur;
										return (
											<textbutton
												key={`Dur_${opt.dur}`}
												Size={new UDim2(0.235, -2, 1, 0)}
												BackgroundColor3={
													isSelected ? Color3.fromHex("#ef4444") : Color3.fromHex("#222226")
												}
												Text={opt.label}
												TextColor3={isSelected ? Color3.fromHex("#ffffff") : Color3.fromHex("#a1a1aa")}
												Font={Fonts.Medium}
												TextSize={9}
												AutoButtonColor={false}
												ZIndex={53}
												Event={{
													MouseButton1Click: () => setModalDuration(opt.dur),
												}}
											>
												<uicorner CornerRadius={new UDim(0, 5)} />
											</textbutton>
										);
									})}
								</frame>
							</frame>
						)}

						{/* Action Buttons: Batal & Konfirmasi */}
						<frame
							key="ActionRow"
							AnchorPoint={new Vector2(0, 1)}
							Position={new UDim2(0, 0, 1, 0)}
							Size={new UDim2(1, 0, 0, 30)}
							BackgroundTransparency={1}
							ZIndex={52}
						>
							<uilistlayout
								FillDirection={Enum.FillDirection.Horizontal}
								HorizontalAlignment={Enum.HorizontalAlignment.Right}
								Padding={new UDim(0, 8)}
							/>

							{/* Tombol Batal */}
							<textbutton
								key="CancelBtn"
								Size={new UDim2(0, 75, 1, 0)}
								BackgroundColor3={Color3.fromHex("#27272a")}
								Text="Batal"
								TextColor3={Color3.fromHex("#e4e4e7")}
								Font={Fonts.Medium}
								TextSize={11}
								AutoButtonColor={false}
								ZIndex={53}
								Event={{
									MouseButton1Click: () => {
										setModalState(undefined);
										setModalReason("");
									},
								}}
							>
								<uicorner CornerRadius={new UDim(0, 6)} />
							</textbutton>

							{/* Tombol Eksekusi (Kick / Ban) */}
							<textbutton
								key="ConfirmBtn"
								Size={new UDim2(0, 95, 1, 0)}
								BackgroundColor3={
									modalState.type === "kick" ? Color3.fromHex("#d97706") : Color3.fromHex("#ef4444")
								}
								Text={modalState.type === "kick" ? "Kick" : "Ban"}
								TextColor3={Color3.fromHex("#ffffff")}
								Font={Fonts.Bold}
								TextSize={11}
								AutoButtonColor={false}
								ZIndex={53}
								Event={{
									MouseButton1Click: handleConfirmAction,
								}}
							>
								<uicorner CornerRadius={new UDim(0, 6)} />
							</textbutton>
						</frame>
					</frame>
				</frame>
			)}
		</frame>
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
