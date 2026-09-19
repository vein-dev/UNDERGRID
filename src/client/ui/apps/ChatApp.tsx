import React, { useEffect, useRef, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { ChatService } from "client/services/ChatService";
import { Fonts } from "../Typography";
import { ChatMessage, ContactInfo } from "shared/types";
import { getGMT7TimeInfo } from "shared/utils";
import { LucideIcon } from "../components/LucideIcon";

export interface ChatComponentProps {
	visible: boolean;
	onBack: () => void;
	activeContactUserId?: number;
	initialDisplayName?: string;
	initialUserName?: string;
	onActiveConversationChanged?: (userId?: number) => void;
}

export interface ContactStatusInfo {
	statusText: string;
	dotColor: Color3;
	textColor: Color3;
}

/**
 * Returns visual status indicator and label according to 3-state specification:
 * 1. In current server: Green dot (#2ecc71), "Online - Dalam server"
 * 2. Online outside server: Blue dot (#38bdf8), "Online - Di luar server"
 * 3. Offline: Gray dot (#8e8e93), "Offline"
 */
export function getContactStatus(contact: ContactInfo): ContactStatusInfo {
	if (contact.isInServer) {
		return {
			statusText: "Online - Dalam server",
			dotColor: Color3.fromHex("#2ecc71"),
			textColor: Color3.fromHex("#2ecc71"),
		};
	} else if (contact.isOnline) {
		return {
			statusText: "Online - Di luar server",
			dotColor: Color3.fromHex("#38bdf8"),
			textColor: Color3.fromHex("#38bdf8"),
		};
	} else {
		return {
			statusText: "Offline",
			dotColor: Color3.fromHex("#8e8e93"),
			textColor: Color3.fromHex("#8e8e93"),
		};
	}
}

export function ChatComponent({
	visible,
	onBack,
	activeContactUserId,
	initialDisplayName,
	initialUserName,
	onActiveConversationChanged,
}: ChatComponentProps) {
	const chatService = ChatService.getInstance();
	const localPlayer = Players.LocalPlayer;
	const scrollRef = useRef<ScrollingFrame | undefined>(undefined);

	const [contacts, setContacts] = useState<ContactInfo[]>([]);
	const [activeContact, setActiveContact] = useState<ContactInfo | undefined>(() => {
		if (activeContactUserId !== undefined && activeContactUserId > 0) {
			return {
				userId: activeContactUserId,
				userName: initialUserName ?? "User",
				displayName: initialDisplayName ?? "User",
				isOnline: true,
				isInServer: true,
			};
		}
		return undefined;
	});
	const [searchQuery, setSearchQuery] = useState("");
	const [inputText, setInputText] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);

	// Sync contacts and listen for messages
	useEffect(() => {
		chatService.getContacts().then((res) => {
			setContacts(res);
		});

		chatService.fetchHistory().then((hist) => {
			setMessages([...hist]);
		});

		const unsubMsg = chatService.onMessageReceived((msg) => {
			setMessages((prev) => [...prev, msg]);
		});

		const connAdded = Players.PlayerAdded.Connect(() => {
			chatService.getContacts().then((res) => setContacts(res));
		});
		const connRemoved = Players.PlayerRemoving.Connect(() => {
			chatService.getContacts().then((res) => setContacts(res));
		});

		return () => {
			unsubMsg();
			connAdded.Disconnect();
			connRemoved.Disconnect();
		};
	}, []);

	// Sync activeContact with prop changes (e.g. opened from router / notification banner)
	useEffect(() => {
		if (activeContactUserId !== undefined && activeContactUserId > 0) {
			const existing = contacts.find((c) => c.userId === activeContactUserId);
			if (existing) {
				setActiveContact(existing);
			} else {
				setActiveContact({
					userId: activeContactUserId,
					userName: initialUserName ?? "User",
					displayName: initialDisplayName ?? "User",
					isOnline: true,
					isInServer: true,
				});
			}
		}
	}, [activeContactUserId, initialUserName, initialDisplayName, contacts]);

	// Mark as read when viewing messages
	useEffect(() => {
		if (visible && activeContact) {
			chatService.markAsRead();
		}
	}, [visible, activeContact, messages.size()]);

	// Notify parent ChatApp when active contact room changes
	useEffect(() => {
		onActiveConversationChanged?.(activeContact?.userId);
	}, [activeContact, onActiveConversationChanged]);

	// Filter messages for current direct conversation
	const conversationMessages = activeContact
		? messages.filter(
				(m) =>
					(m.senderUserId === activeContact.userId &&
						localPlayer &&
						m.recipientUserId === localPlayer.UserId) ||
					(localPlayer &&
						m.senderUserId === localPlayer.UserId &&
						m.recipientUserId === activeContact.userId),
			)
		: [];

	// Auto-scroll to bottom of conversation
	useEffect(() => {
		if (activeContact && scrollRef.current) {
			task.defer(() => {
				if (scrollRef.current) {
					scrollRef.current.CanvasPosition = new Vector2(0, 99999);
				}
			});
		}
	}, [activeContact, conversationMessages.size()]);

	if (!visible) return <></>;

	const handleSendMessage = () => {
		const trimmed = inputText.gsub("^%s*(.-)%s*$", "%1")[0];
		if (trimmed.size() === 0) return;

		if (activeContact) {
			chatService.sendMessage(trimmed, activeContact.userId);
		}
		setInputText("");
	};

	// Helper to get last message for a contact
	const getLastMessageForContact = (contact: ContactInfo): ChatMessage | undefined => {
		const dms = messages.filter(
			(m) =>
				(m.senderUserId === contact.userId && localPlayer && m.recipientUserId === localPlayer.UserId) ||
				(localPlayer && m.senderUserId === localPlayer.UserId && m.recipientUserId === contact.userId),
		);
		return dms.size() > 0 ? dms[dms.size() - 1] : undefined;
	};

	// Filter and sort contacts:
	// 1. Online - Dalam server (Hijau)
	// 2. Online - Di luar server (Biru)
	// 3. Offline (Abu-abu)
	const filteredContacts = contacts.filter((c) => {
		if (searchQuery === "") return true;
		const q = searchQuery.lower();
		return c.displayName.lower().find(q)[0] !== undefined || c.userName.lower().find(q)[0] !== undefined;
	});

	filteredContacts.sort((a, b) => {
		const getRank = (c: ContactInfo) => {
			if (c.isInServer) return 1;
			if (c.isOnline) return 2;
			return 3;
		};

		const rankA = getRank(a);
		const rankB = getRank(b);
		if (rankA !== rankB) return rankA < rankB;

		const lastA = getLastMessageForContact(a);
		const lastB = getLastMessageForContact(b);

		if (lastA && lastB) {
			return lastA.timestamp > lastB.timestamp;
		}
		if (lastA && !lastB) return true;
		if (!lastA && lastB) return false;

		return a.displayName.lower() < b.displayName.lower();
	});

	// ─── Screen 1: Direct Conversation View ──────────────────────────────────
	if (activeContact) {
		const activeStatus = getContactStatus(activeContact);

		return (
			<frame
				key="ConversationView"
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundColor3={Color3.fromHex("#0c0c0c")}
				ZIndex={8}
			>
				{/* Top Header */}
				<frame
					key="Header"
					Size={new UDim2(1, 0, 0, 56)}
					BackgroundColor3={Color3.fromHex("#121212")}
					ZIndex={9}
				>
					<uistroke Color={Color3.fromHex("#222222")} Thickness={1} />
					<textbutton
						key="BackBtn"
						Position={new UDim2(0, 12, 0.5, -16)}
						Size={new UDim2(0, 32, 0, 32)}
						BackgroundTransparency={1}
						Text=""
						AutoButtonColor={false}
						ZIndex={10}
						Event={{
							Activated: () => setActiveContact(undefined),
							MouseButton1Click: () => setActiveContact(undefined),
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

					{/* Avatar with dynamic StatusDot */}
					<imagelabel
						key="Avatar"
						Position={new UDim2(0, 48, 0.5, -18)}
						Size={new UDim2(0, 36, 0, 36)}
						BackgroundColor3={Color3.fromHex("#1c1c1c")}
						Image={`rbxthumb://type=AvatarHeadShot&id=${activeContact.userId}&w=48&h=48`}
						ZIndex={10}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<frame
							key="StatusDot"
							AnchorPoint={new Vector2(1, 1)}
							Position={new UDim2(1, 2, 1, 2)}
							Size={new UDim2(0, 10, 0, 10)}
							BackgroundColor3={activeStatus.dotColor}
							ZIndex={11}
						>
							<uicorner CornerRadius={new UDim(1, 0)} />
							<uistroke Color={Color3.fromHex("#121212")} Thickness={1.5} />
						</frame>
					</imagelabel>

					<textlabel
						key="Name"
						Position={new UDim2(0, 92, 0, 10)}
						Size={new UDim2(1, -110, 0, 18)}
						BackgroundTransparency={1}
						Text={activeContact.displayName || activeContact.userName}
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Bold}
						TextSize={13}
						TextTruncate={Enum.TextTruncate.AtEnd}
						TextXAlignment={Enum.TextXAlignment.Left}
						ZIndex={10}
					/>

					{/* Keterangan Status Kontak */}
					<textlabel
						key="Status"
						Position={new UDim2(0, 92, 0, 30)}
						Size={new UDim2(1, -110, 0, 14)}
						BackgroundTransparency={1}
						Text={activeStatus.statusText}
						TextColor3={activeStatus.textColor}
						Font={Fonts.Regular}
						TextSize={10}
						TextXAlignment={Enum.TextXAlignment.Left}
						ZIndex={10}
					/>
				</frame>

				{/* Messages Scroll Area */}
				<scrollingframe
					key="MessagesList"
					ref={scrollRef}
					Position={new UDim2(0, 0, 0, 56)}
					Size={new UDim2(1, 0, 1, -112)}
					BackgroundTransparency={1}
					ScrollBarThickness={2}
					ScrollBarImageColor3={Color3.fromHex("#333333")}
					CanvasSize={new UDim2(0, 0, 0, 0)}
					AutomaticCanvasSize={Enum.AutomaticSize.Y}
					ZIndex={9}
				>
					<uilistlayout Padding={new UDim(0, 10)} SortOrder={Enum.SortOrder.LayoutOrder} />
					<uipadding
						PaddingTop={new UDim(0, 12)}
						PaddingBottom={new UDim(0, 12)}
						PaddingLeft={new UDim(0, 14)}
						PaddingRight={new UDim(0, 14)}
					/>

					{conversationMessages.size() === 0 ? (
						<frame key="EmptyConv" Size={new UDim2(1, 0, 0, 160)} BackgroundTransparency={1} ZIndex={10}>
							<uilistlayout
								HorizontalAlignment={Enum.HorizontalAlignment.Center}
								VerticalAlignment={Enum.VerticalAlignment.Center}
								Padding={new UDim(0, 8)}
							/>
							<LucideIcon
								name="message-square"
								size={new UDim2(0, 28, 0, 28)}
								color={Color3.fromHex("#444444")}
								zIndex={11}
							/>
							<textlabel
								key="EmptyTxt"
								BackgroundTransparency={1}
								AutomaticSize={Enum.AutomaticSize.XY}
								Text={`Mulai obrolan dengan @${activeContact.userName}`}
								TextColor3={Color3.fromHex("#777777")}
								Font={Fonts.Regular}
								TextSize={11}
								ZIndex={11}
							/>
						</frame>
					) : (
						conversationMessages.map((msg, idx) => {
							const isMe = localPlayer && msg.senderUserId === localPlayer.UserId;
							const timeInfo = getGMT7TimeInfo(msg.timestamp);

							return (
								<frame
									key={`msg_${msg.id ?? idx}`}
									LayoutOrder={idx}
									Size={new UDim2(1, 0, 0, 0)}
									AutomaticSize={Enum.AutomaticSize.Y}
									BackgroundTransparency={1}
									ZIndex={10}
								>
									<frame
										key="Bubble"
										AnchorPoint={new Vector2(isMe ? 1 : 0, 0)}
										Position={new UDim2(isMe ? 1 : 0, 0, 0, 0)}
										Size={new UDim2(0, 0, 0, 0)}
										AutomaticSize={Enum.AutomaticSize.XY}
										BackgroundColor3={isMe ? Color3.fromHex("#ffffff") : Color3.fromHex("#1a1a1a")}
										ZIndex={11}
									>
										<uicorner CornerRadius={new UDim(0, 12)} />
										<uipadding
											PaddingTop={new UDim(0, 8)}
											PaddingBottom={new UDim(0, 8)}
											PaddingLeft={new UDim(0, 12)}
											PaddingRight={new UDim(0, 12)}
										/>
										<textlabel
											key="Text"
											AutomaticSize={Enum.AutomaticSize.XY}
											BackgroundTransparency={1}
											Text={msg.content}
											TextColor3={isMe ? Color3.fromHex("#000000") : Color3.fromHex("#ffffff")}
											Font={Fonts.Regular}
											TextSize={12}
											TextWrapped={true}
											ZIndex={12}
										>
											<uisizeconstraint MaxSize={new Vector2(210, 2000)} />
										</textlabel>
									</frame>

									<textlabel
										key="Time"
										AnchorPoint={new Vector2(isMe ? 1 : 0, 1)}
										Position={new UDim2(isMe ? 1 : 0, 0, 1, 0)}
										Size={new UDim2(0, 80, 0, 12)}
										BackgroundTransparency={1}
										Text={timeInfo.timeString}
										TextColor3={Color3.fromHex("#555555")}
										Font={Fonts.Regular}
										TextSize={9}
										TextXAlignment={isMe ? Enum.TextXAlignment.Right : Enum.TextXAlignment.Left}
										ZIndex={10}
									/>
								</frame>
							);
						})
					)}
				</scrollingframe>

				{/* Input Bar */}
				<frame
					key="InputBar"
					Position={new UDim2(0, 0, 1, -56)}
					Size={new UDim2(1, 0, 0, 56)}
					BackgroundColor3={Color3.fromHex("#121212")}
					ZIndex={9}
				>
					<uistroke Color={Color3.fromHex("#222222")} Thickness={1} />
					<frame
						key="InputWrapper"
						Position={new UDim2(0, 12, 0.5, -18)}
						Size={new UDim2(1, -72, 0, 36)}
						BackgroundColor3={Color3.fromHex("#1c1c1c")}
						ZIndex={10}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
						<uipadding PaddingLeft={new UDim(0, 12)} PaddingRight={new UDim(0, 12)} />
						<textbox
							key="TextInput"
							Size={new UDim2(1, 0, 1, 0)}
							BackgroundTransparency={1}
							PlaceholderText="Ketik pesan..."
							PlaceholderColor3={Color3.fromHex("#555555")}
							Text={inputText}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Regular}
							TextSize={12}
							ClearTextOnFocus={false}
							ZIndex={11}
							Event={{
								FocusLost: (_rbx, enterPressed) => {
									if (enterPressed) {
										handleSendMessage();
									}
								},
							}}
							Change={{
								Text: (rbx) => setInputText(rbx.Text),
							}}
						/>
					</frame>

					<textbutton
						key="SendBtn"
						AnchorPoint={new Vector2(1, 0.5)}
						Position={new UDim2(1, -12, 0.5, 0)}
						Size={new UDim2(0, 36, 0, 36)}
						BackgroundColor3={inputText.size() > 0 ? Color3.fromHex("#ffffff") : Color3.fromHex("#222222")}
						Text=""
						AutoButtonColor={false}
						ZIndex={10}
						Event={{
							Activated: handleSendMessage,
							MouseButton1Click: handleSendMessage,
						}}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<LucideIcon
							name="arrow-up"
							size={new UDim2(0, 16, 0, 16)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={inputText.size() > 0 ? Color3.fromHex("#000000") : Color3.fromHex("#666666")}
							zIndex={11}
						/>
					</textbutton>
				</frame>
			</frame>
		);
	}

	// ─── Screen 2: Contacts List View ─────────────────────────────────────────

	return (
		<frame key="ChatApp" Size={new UDim2(1, 0, 1, 0)} BackgroundColor3={Color3.fromHex("#0c0c0c")} ZIndex={8}>
			{/* Header */}
			<frame
				key="Header"
				Size={new UDim2(1, 0, 0, 52)}
				BackgroundColor3={Color3.fromHex("#101010")}
				BackgroundTransparency={0.2}
				ZIndex={9}
			>
				<uistroke Color={Color3.fromHex("#222222")} Thickness={1} />
				<textbutton
					key="BackButton"
					AnchorPoint={new Vector2(0, 0.5)}
					Position={new UDim2(0, 12, 0.5, 0)}
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
					Position={new UDim2(0, 48, 0, 0)}
					Size={new UDim2(1, -96, 1, 0)}
					BackgroundTransparency={1}
					Text="Messages"
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextSize={15}
					ZIndex={10}
				/>
			</frame>

			{/* Search input */}
			<frame
				key="SearchWrapper"
				Position={new UDim2(0, 14, 0, 60)}
				Size={new UDim2(1, -28, 0, 34)}
				BackgroundColor3={Color3.fromHex("#161616")}
				ZIndex={9}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<uistroke Color={Color3.fromHex("#262626")} Thickness={1} />
				<LucideIcon
					name="search"
					size={new UDim2(0, 14, 0, 14)}
					position={new UDim2(0, 10, 0.5, -7)}
					color={Color3.fromHex("#666666")}
					zIndex={10}
				/>
				<textbox
					key="SearchInput"
					Position={new UDim2(0, 32, 0, 0)}
					Size={new UDim2(1, -40, 1, 0)}
					BackgroundTransparency={1}
					PlaceholderText="Cari kontak..."
					PlaceholderColor3={Color3.fromHex("#555555")}
					Text={searchQuery}
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Regular}
					TextSize={12}
					ClearTextOnFocus={false}
					ZIndex={10}
					Change={{
						Text: (rbx) => setSearchQuery(rbx.Text),
					}}
				/>
			</frame>

			{/* Channels & Contacts List Scroll */}
			<scrollingframe
				key="ContactsScroll"
				Position={new UDim2(0, 0, 0, 102)}
				Size={new UDim2(1, 0, 1, -102)}
				BackgroundTransparency={1}
				ScrollBarThickness={2}
				ScrollBarImageColor3={Color3.fromHex("#333333")}
				CanvasSize={new UDim2(0, 0, 0, 0)}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
				ZIndex={9}
			>
				<uilistlayout Padding={new UDim(0, 6)} SortOrder={Enum.SortOrder.LayoutOrder} />
				<uipadding
					PaddingTop={new UDim(0, 4)}
					PaddingBottom={new UDim(0, 16)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				{/* Contacts List */}
				{filteredContacts.map((contact, idx) => {
					const status = getContactStatus(contact);
					const lastMsg = getLastMessageForContact(contact);
					const timeInfo = lastMsg ? getGMT7TimeInfo(lastMsg.timestamp) : undefined;
					const isFromMe = lastMsg && localPlayer && lastMsg.senderUserId === localPlayer.UserId;
					const snippet = lastMsg
						? isFromMe
							? `Anda: ${lastMsg.content}`
							: lastMsg.content
						: `@${contact.userName} • Ketuk untuk chat`;

					return (
						<textbutton
							key={`contact_${contact.userId}`}
							LayoutOrder={idx + 1}
							Size={new UDim2(1, 0, 0, 58)}
							BackgroundColor3={Color3.fromHex("#141414")}
							AutoButtonColor={false}
							Text=""
							ZIndex={10}
							Event={{
								Activated: () => setActiveContact(contact),
								MouseButton1Click: () => setActiveContact(contact),
							}}
						>
							<uicorner CornerRadius={new UDim(0, 10)} />
							<uistroke Color={Color3.fromHex("#222222")} Thickness={1} />

							{/* Avatar with 3-state StatusDot */}
							<imagelabel
								key="Avatar"
								Position={new UDim2(0, 10, 0.5, -18)}
								Size={new UDim2(0, 36, 0, 36)}
								BackgroundColor3={Color3.fromHex("#1f1f1f")}
								Image={`rbxthumb://type=AvatarHeadShot&id=${contact.userId}&w=48&h=48`}
								ZIndex={11}
							>
								<uicorner CornerRadius={new UDim(1, 0)} />
								<frame
									key="StatusDot"
									AnchorPoint={new Vector2(1, 1)}
									Position={new UDim2(1, 2, 1, 2)}
									Size={new UDim2(0, 10, 0, 10)}
									BackgroundColor3={status.dotColor}
									ZIndex={12}
								>
									<uicorner CornerRadius={new UDim(1, 0)} />
									<uistroke Color={Color3.fromHex("#141414")} Thickness={1.5} />
								</frame>
							</imagelabel>

							{/* Display Name & Status Label */}
							<frame
								key="NameRow"
								Position={new UDim2(0, 56, 0, 10)}
								Size={new UDim2(1, -120, 0, 16)}
								BackgroundTransparency={1}
								ZIndex={11}
							>
								<uilistlayout
									FillDirection={Enum.FillDirection.Horizontal}
									VerticalAlignment={Enum.VerticalAlignment.Center}
									Padding={new UDim(0, 6)}
									SortOrder={Enum.SortOrder.LayoutOrder}
								/>
								<textlabel
									key="DisplayName"
									LayoutOrder={1}
									AutomaticSize={Enum.AutomaticSize.X}
									Size={new UDim2(0, 0, 1, 0)}
									BackgroundTransparency={1}
									Text={contact.displayName || contact.userName}
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Bold}
									TextSize={13}
									TextTruncate={Enum.TextTruncate.AtEnd}
									ZIndex={11}
								>
									<uisizeconstraint MaxSize={new Vector2(110, 16)} />
								</textlabel>
								<textlabel
									key="StatusLabel"
									LayoutOrder={2}
									AutomaticSize={Enum.AutomaticSize.XY}
									BackgroundTransparency={1}
									Text={`• ${status.statusText}`}
									TextColor3={status.textColor}
									Font={Fonts.Medium}
									TextSize={10}
									TextTruncate={Enum.TextTruncate.AtEnd}
									ZIndex={11}
								/>
							</frame>

							{/* Snippet / Last Message */}
							<textlabel
								key="Snippet"
								Position={new UDim2(0, 56, 0, 30)}
								Size={new UDim2(1, -120, 0, 16)}
								BackgroundTransparency={1}
								Text={snippet}
								TextColor3={lastMsg ? Color3.fromHex("#999999") : Color3.fromHex("#666666")}
								Font={Fonts.Regular}
								TextSize={11}
								TextTruncate={Enum.TextTruncate.AtEnd}
								TextXAlignment={Enum.TextXAlignment.Left}
								ZIndex={11}
							/>

							{/* Timestamp */}
							{timeInfo && (
								<textlabel
									key="Time"
									AnchorPoint={new Vector2(1, 0)}
									Position={new UDim2(1, -10, 0, 10)}
									Size={new UDim2(0, 60, 0, 14)}
									BackgroundTransparency={1}
									Text={timeInfo.timeString}
									TextColor3={Color3.fromHex("#555555")}
									Font={Fonts.Regular}
									TextSize={10}
									TextXAlignment={Enum.TextXAlignment.Right}
									ZIndex={11}
								/>
							)}
						</textbutton>
					);
				})}
			</scrollingframe>
		</frame>
	);
}

/**
 * iOS-styled Messages App.
 * Migrated to React TSX declarative renderer.
 */
export class ChatApp {
	private hostInstance: GuiObject;
	private root: Root;
	private visible = false;
	private onBackCallbacks: Array<() => void> = [];

	private activeContactUserId?: number;
	private activeDisplayName?: string;
	private activeUserName?: string;
	private currentConversationUserId?: number;

	constructor(parent: GuiObject) {
		this.hostInstance = parent;
		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	private render(): void {
		this.root.render(
			<ChatComponent
				visible={this.visible}
				onBack={() => {
					for (const cb of this.onBackCallbacks) cb();
				}}
				activeContactUserId={this.activeContactUserId}
				initialDisplayName={this.activeDisplayName}
				initialUserName={this.activeUserName}
				onActiveConversationChanged={(userId) => {
					this.currentConversationUserId = userId;
				}}
			/>,
		);
	}

	public openConversationWithUserId(userId: number, displayName?: string, userName?: string): void {
		this.activeContactUserId = userId;
		this.activeDisplayName = displayName;
		this.activeUserName = userName;
		this.currentConversationUserId = userId;
		this.render();
	}

	public getActiveConversationUserId(): number | undefined {
		return this.visible ? this.currentConversationUserId : undefined;
	}

	public onBack(cb: () => void): void {
		this.onBackCallbacks.push(cb);
	}

	public show(): void {
		this.visible = true;
		this.render();
		ChatService.getInstance().fetchHistory();
		ChatService.getInstance().markAsRead();
	}

	public hide(): void {
		this.visible = false;
		this.activeContactUserId = undefined;
		this.currentConversationUserId = undefined;
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
	}
}
