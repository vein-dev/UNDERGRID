import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { SocialService } from "client/services/SocialService";
import { Fonts } from "../Typography";
import { SOCIAL_CONFIG, StatusPost } from "shared/types";
import { getGMT7TimeInfo } from "shared/utils";
import { LucideIcon } from "../components/LucideIcon";

export interface SocialComponentProps {
	visible: boolean;
	onBack: () => void;
}

export function SocialComponent({ visible, onBack }: SocialComponentProps) {
	const socialService = SocialService.getInstance();
	const localPlayer = Players.LocalPlayer;

	const [posts, setPosts] = useState<StatusPost[]>(() => socialService.getTimeline());
	const [isComposing, setIsComposing] = useState(false);
	const [composeText, setComposeText] = useState("");

	useEffect(() => {
		socialService.fetchTimeline().then((res) => {
			setPosts([...res]);
		});

		const unsubNew = socialService.onNewPost(() => {
			setPosts([...socialService.getTimeline()]);
		});

		const unsubLike = socialService.onLikeUpdated(() => {
			setPosts(socialService.getTimeline().map((p) => ({ ...p, likedByUserIds: [...p.likedByUserIds] })));
		});

		const unsubDel = socialService.onPostDeleted(() => {
			setPosts([...socialService.getTimeline()]);
		});

		return () => {
			unsubNew();
			unsubLike();
			unsubDel();
		};
	}, []);

	if (!visible) return <></>;

	const remainingChars = SOCIAL_CONFIG.MAX_POST_LENGTH - composeText.size();
	const canSubmit = composeText.size() > 0 && remainingChars >= 0;

	return (
		<frame key="SocialApp" Size={new UDim2(1, 0, 1, 0)} BackgroundColor3={Color3.fromHex("#0c0c0c")} ZIndex={8}>
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
					Text="Feed"
					TextColor3={Color3.fromHex("#ffffff")}
					Font={Fonts.Bold}
					TextSize={15}
					ZIndex={10}
				/>

				{/* Compose button */}
				<textbutton
					key="ComposeBtn"
					AnchorPoint={new Vector2(1, 0.5)}
					Position={new UDim2(1, -12, 0.5, 0)}
					Size={new UDim2(0, 32, 0, 32)}
					BackgroundColor3={Color3.fromHex("#1f1f1f")}
					Text=""
					AutoButtonColor={false}
					ZIndex={10}
					Event={{
						Activated: () => setIsComposing(true),
					}}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
					<LucideIcon
						name="square-pen"
						size={new UDim2(0, 16, 0, 16)}
						anchorPoint={new Vector2(0.5, 0.5)}
						position={new UDim2(0.5, 0, 0.5, 0)}
						color={Color3.fromHex("#ffffff")}
						zIndex={11}
					/>
				</textbutton>
			</frame>

			{/* Post Timeline Scroll */}
			<scrollingframe
				key="TimelineScroll"
				Position={new UDim2(0, 0, 0, 52)}
				Size={new UDim2(1, 0, 1, -52)}
				BackgroundTransparency={1}
				ScrollBarThickness={2}
				ScrollBarImageColor3={Color3.fromHex("#333333")}
				CanvasSize={new UDim2(0, 0, 0, 0)}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
				ZIndex={9}
			>
				<uilistlayout Padding={new UDim(0, 8)} SortOrder={Enum.SortOrder.LayoutOrder} />
				<uipadding
					PaddingTop={new UDim(0, 10)}
					PaddingBottom={new UDim(0, 16)}
					PaddingLeft={new UDim(0, 14)}
					PaddingRight={new UDim(0, 14)}
				/>

				{posts.map((post, idx) => {
					const isLiked = localPlayer && post.likedByUserIds.includes(localPlayer.UserId);
					const timeInfo = getGMT7TimeInfo(post.timestamp);

					return (
						<frame
							key={`post_${post.id}`}
							LayoutOrder={idx}
							Size={new UDim2(1, 0, 0, 0)}
							AutomaticSize={Enum.AutomaticSize.Y}
							BackgroundColor3={Color3.fromHex("#141414")}
							ZIndex={10}
						>
							<uicorner CornerRadius={new UDim(0, 12)} />
							<uistroke Color={Color3.fromHex("#222222")} Thickness={1} />
							<uipadding
								PaddingTop={new UDim(0, 12)}
								PaddingBottom={new UDim(0, 12)}
								PaddingLeft={new UDim(0, 12)}
								PaddingRight={new UDim(0, 12)}
							/>
							<uilistlayout
								FillDirection={Enum.FillDirection.Vertical}
								SortOrder={Enum.SortOrder.LayoutOrder}
								Padding={new UDim(0, 8)}
							/>

							{/* Top user row */}
							<frame
								key="UserRow"
								LayoutOrder={1}
								Size={new UDim2(1, 0, 0, 36)}
								BackgroundTransparency={1}
								ZIndex={11}
							>
								<imagelabel
									key="Avatar"
									Size={new UDim2(0, 36, 0, 36)}
									BackgroundColor3={Color3.fromHex("#1f1f1f")}
									Image={`rbxthumb://type=AvatarHeadShot&id=${post.authorUserId}&w=48&h=48`}
									ZIndex={12}
								>
									<uicorner CornerRadius={new UDim(1, 0)} />
								</imagelabel>
								<textlabel
									key="AuthorName"
									Position={new UDim2(0, 44, 0, 2)}
									Size={new UDim2(1, -120, 0, 16)}
									BackgroundTransparency={1}
									Text={post.authorDisplayName || post.authorName}
									TextColor3={Color3.fromHex("#ffffff")}
									Font={Fonts.Bold}
									TextSize={12}
									TextTruncate={Enum.TextTruncate.AtEnd}
									TextXAlignment={Enum.TextXAlignment.Left}
									ZIndex={12}
								/>
								<textlabel
									key="AuthorUsername"
									Position={new UDim2(0, 44, 0, 18)}
									Size={new UDim2(1, -120, 0, 14)}
									BackgroundTransparency={1}
									Text={`@${post.authorName}`}
									TextColor3={Color3.fromHex("#666666")}
									Font={Fonts.Regular}
									TextSize={10}
									TextTruncate={Enum.TextTruncate.AtEnd}
									TextXAlignment={Enum.TextXAlignment.Left}
									ZIndex={12}
								/>
								<textlabel
									key="Time"
									AnchorPoint={new Vector2(1, 0)}
									Position={new UDim2(1, 0, 0, 4)}
									Size={new UDim2(0, 70, 0, 14)}
									BackgroundTransparency={1}
									Text={timeInfo.timeString}
									TextColor3={Color3.fromHex("#555555")}
									Font={Fonts.Regular}
									TextSize={10}
									TextXAlignment={Enum.TextXAlignment.Right}
									ZIndex={12}
								/>
							</frame>

							{/* Post Content */}
							<textlabel
								key="Content"
								LayoutOrder={2}
								Size={new UDim2(1, 0, 0, 0)}
								AutomaticSize={Enum.AutomaticSize.Y}
								BackgroundTransparency={1}
								Text={post.content}
								TextColor3={Color3.fromHex("#d5d5d5")}
								Font={Fonts.Regular}
								TextSize={12}
								TextWrapped={true}
								TextXAlignment={Enum.TextXAlignment.Left}
								ZIndex={11}
							/>

							{/* Action Footer (Likes in bottom right corner) */}
							<frame
								key="Footer"
								LayoutOrder={3}
								Size={new UDim2(1, 0, 0, 20)}
								BackgroundTransparency={1}
								ZIndex={11}
							>
								<textbutton
									key="LikeBtn"
									AnchorPoint={new Vector2(1, 0.5)}
									Position={new UDim2(1, 0, 0.5, 0)}
									AutomaticSize={Enum.AutomaticSize.XY}
									Size={new UDim2(0, 36, 0, 24)}
									BackgroundTransparency={1}
									Text=""
									AutoButtonColor={false}
									Active={true}
									ZIndex={12}
									Event={{
										Activated: () => {
											socialService.toggleLike(post.id);
										},
									}}
								>
									<uipadding
										PaddingLeft={new UDim(0, 6)}
										PaddingRight={new UDim(0, 6)}
										PaddingTop={new UDim(0, 2)}
										PaddingBottom={new UDim(0, 2)}
									/>
									<uilistlayout
										FillDirection={Enum.FillDirection.Horizontal}
										HorizontalAlignment={Enum.HorizontalAlignment.Left}
										VerticalAlignment={Enum.VerticalAlignment.Center}
										Padding={new UDim(0, 5)}
										SortOrder={Enum.SortOrder.LayoutOrder}
									/>
									<LucideIcon
										name="heart"
										size={new UDim2(0, 14, 0, 14)}
										color={isLiked ? Color3.fromHex("#ff4d4d") : Color3.fromHex("#777777")}
										zIndex={13}
										layoutOrder={1}
									/>
									<textlabel
										key="LikeCount"
										BackgroundTransparency={1}
										AutomaticSize={Enum.AutomaticSize.XY}
										Text={tostring(post.likedByUserIds.size())}
										TextColor3={isLiked ? Color3.fromHex("#ff4d4d") : Color3.fromHex("#777777")}
										Font={Fonts.Medium}
										TextSize={11}
										ZIndex={13}
										LayoutOrder={2}
									/>
								</textbutton>
							</frame>
						</frame>
					);
				})}
			</scrollingframe>

			{/* Compose Status Modal */}
			{isComposing ? (
				<frame
					key="ComposeModal"
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={Color3.fromHex("#0c0c0c")}
					ZIndex={20}
				>
					{/* Compose Header */}
					<frame
						key="ComposeHeader"
						Size={new UDim2(1, 0, 0, 52)}
						BackgroundColor3={Color3.fromHex("#121212")}
						ZIndex={21}
					>
						<textbutton
							key="CancelBtn"
							Position={new UDim2(0, 14, 0.5, -12)}
							Size={new UDim2(0, 60, 0, 24)}
							BackgroundTransparency={1}
							Text="Batal"
							TextColor3={Color3.fromHex("#888888")}
							Font={Fonts.Medium}
							TextSize={13}
							ZIndex={22}
							Event={{
								Activated: () => {
									setIsComposing(false);
									setComposeText("");
								},
							}}
						/>
						<textlabel
							key="ComposeTitle"
							Position={new UDim2(0.5, -50, 0, 0)}
							Size={new UDim2(0, 100, 1, 0)}
							BackgroundTransparency={1}
							Text="Status Baru"
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Bold}
							TextSize={14}
							ZIndex={22}
						/>
						<textbutton
							key="SubmitBtn"
							AnchorPoint={new Vector2(1, 0.5)}
							Position={new UDim2(1, -14, 0.5, 0)}
							Size={new UDim2(0, 64, 0, 28)}
							BackgroundColor3={canSubmit ? Color3.fromHex("#ffffff") : Color3.fromHex("#222222")}
							Text="Kirim"
							TextColor3={canSubmit ? Color3.fromHex("#000000") : Color3.fromHex("#666666")}
							Font={Fonts.Bold}
							TextSize={12}
							AutoButtonColor={false}
							ZIndex={22}
							Event={{
								Activated: () => {
									if (canSubmit) {
										socialService.createPost(composeText);
										setIsComposing(false);
										setComposeText("");
									}
								},
							}}
						>
							<uicorner CornerRadius={new UDim(0, 6)} />
						</textbutton>
					</frame>

					{/* Text input */}
					<frame
						key="InputContainer"
						Position={new UDim2(0, 16, 0, 68)}
						Size={new UDim2(1, -32, 0, 140)}
						BackgroundColor3={Color3.fromHex("#141414")}
						ZIndex={21}
					>
						<uicorner CornerRadius={new UDim(0, 10)} />
						<uistroke Color={Color3.fromHex("#262626")} Thickness={1} />
						<uipadding
							PaddingTop={new UDim(0, 10)}
							PaddingBottom={new UDim(0, 10)}
							PaddingLeft={new UDim(0, 12)}
							PaddingRight={new UDim(0, 12)}
						/>
						<textbox
							key="TextBox"
							Size={new UDim2(1, 0, 1, -20)}
							BackgroundTransparency={1}
							PlaceholderText="Apa yang sedang terjadi?"
							PlaceholderColor3={Color3.fromHex("#555555")}
							Text={composeText}
							TextColor3={Color3.fromHex("#ffffff")}
							Font={Fonts.Regular}
							TextSize={13}
							TextWrapped={true}
							TextXAlignment={Enum.TextXAlignment.Left}
							TextYAlignment={Enum.TextYAlignment.Top}
							ClearTextOnFocus={false}
							ZIndex={22}
							Change={{
								Text: (rbx) => setComposeText(rbx.Text),
							}}
						/>
						<textlabel
							key="CharCounter"
							AnchorPoint={new Vector2(1, 1)}
							Position={new UDim2(1, 0, 1, 0)}
							Size={new UDim2(0, 40, 0, 16)}
							BackgroundTransparency={1}
							Text={tostring(remainingChars)}
							TextColor3={remainingChars < 20 ? Color3.fromHex("#ff4d4d") : Color3.fromHex("#666666")}
							Font={Fonts.Regular}
							TextSize={10}
							TextXAlignment={Enum.TextXAlignment.Right}
							ZIndex={22}
						/>
					</frame>
				</frame>
			) : undefined}
		</frame>
	);
}

/**
 * iOS-styled Social Media App.
 * Migrated to React TSX declarative renderer.
 */
export class SocialApp {
	private hostInstance: GuiObject;
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
			<SocialComponent
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
		SocialService.getInstance().markAsRead();
	}

	public hide(): void {
		this.visible = false;
		this.render();
	}

	public destroy(): void {
		this.root.unmount();
	}
}
