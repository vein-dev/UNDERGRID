import React from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { SoundService } from "@rbxts/services";
import { AppNotificationOptions, ChatMessage } from "shared/types";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export type BannerClickCallback = (message: ChatMessage) => void;

export interface NotificationBannerProps {
	visible: boolean;
	options?: AppNotificationOptions;
	onActionClick: () => void;
}

export function NotificationBannerComponent({ visible, options, onActionClick }: NotificationBannerProps) {
	if (!visible || !options) return <></>;

	const title = options.title ?? "";
	const message = options.message ?? "";
	const subtext = options.subtext ?? "";
	const icon = options.icon;
	const badgeIcon = options.badgeIcon ?? "bell";
	const badgeColor = options.badgeColor ?? Color3.fromHex("#2a2a2a");
	const actionText = options.actionText;
	const actionColor = options.actionColor ?? Color3.fromHex("#ffffff");

	return (
		<frame
			key="NotificationBanner"
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, 10)}
			Size={new UDim2(0.85, 0, 0, 52)}
			BackgroundColor3={Color3.fromHex("#0c0c0c")}
			BackgroundTransparency={0.05}
			ClipsDescendants={true}
			ZIndex={200}
		>
			<uicorner CornerRadius={new UDim(0, 16)} />
			<uistroke
				Color={Color3.fromHex("#2a2a2a")}
				Transparency={0.3}
				Thickness={1}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>

			{/* Left: Avatar */}
			<frame
				key="AvatarContainer"
				Position={new UDim2(0, 10, 0.5, 0)}
				AnchorPoint={new Vector2(0, 0.5)}
				Size={new UDim2(0, 34, 0, 34)}
				BackgroundTransparency={1}
				ZIndex={201}
			>
				{icon && icon !== "" ? (
					<imagelabel
						key="Avatar"
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundColor3={Color3.fromHex("#181818")}
						Image={icon}
						ZIndex={202}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
					</imagelabel>
				) : (
					<frame
						key="AvatarPlaceholder"
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundColor3={Color3.fromHex("#1c1c1c")}
						ZIndex={202}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<LucideIcon
							name={badgeIcon}
							size={new UDim2(0, 16, 0, 16)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#888888")}
							zIndex={203}
						/>
					</frame>
				)}

				{/* App Badge Pill (hanya tampil jika ada icon/avatar dan hideBadge tidak aktif) */}
				{icon && icon !== "" && !options.hideBadge ? (
					<frame
						key="AppBadge"
						AnchorPoint={new Vector2(1, 1)}
						Position={new UDim2(1, 2, 1, 2)}
						Size={new UDim2(0, 14, 0, 14)}
						BackgroundColor3={badgeColor}
						ZIndex={204}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<uistroke Color={Color3.fromHex("#000000")} Thickness={1.5} />
						<LucideIcon
							name={badgeIcon}
							size={new UDim2(0, 8, 0, 8)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#ffffff")}
							zIndex={205}
						/>
					</frame>
				) : undefined}
			</frame>

			{/* Center: Text details */}
			<frame
				key="TextContainer"
				Position={new UDim2(0, 52, 0.5, 0)}
				AnchorPoint={new Vector2(0, 0.5)}
				Size={new UDim2(1, actionText ? -112 : -60, 1, -12)}
				BackgroundTransparency={1}
				ZIndex={201}
			>
				<frame key="TitleRow" Size={new UDim2(1, 0, 0, 16)} BackgroundTransparency={1}>
					<textlabel
						key="SenderName"
						Size={new UDim2(1, subtext !== "" ? -55 : 0, 1, 0)}
						BackgroundTransparency={1}
						Text={title}
						TextColor3={Color3.fromHex("#ffffff")}
						Font={Fonts.Bold}
						TextScaled={true}
						TextTruncate={Enum.TextTruncate.AtEnd}
						TextXAlignment={Enum.TextXAlignment.Left}
						ZIndex={202}
					>
						<uitextsizeconstraint MaxTextSize={12} MinTextSize={9} />
					</textlabel>
					{subtext !== "" ? (
						<textlabel
							key="TimeLabel"
							AnchorPoint={new Vector2(1, 0)}
							Position={new UDim2(1, 0, 0, 0)}
							Size={new UDim2(0, 50, 1, 0)}
							BackgroundTransparency={1}
							Text={subtext}
							TextColor3={Color3.fromHex("#666666")}
							Font={Fonts.Regular}
							TextScaled={true}
							TextXAlignment={Enum.TextXAlignment.Right}
							ZIndex={202}
						>
							<uitextsizeconstraint MaxTextSize={9} MinTextSize={7} />
						</textlabel>
					) : undefined}
				</frame>

				<textlabel
					key="MessagePreview"
					Position={new UDim2(0, 0, 0, 18)}
					Size={new UDim2(1, 0, 1, -18)}
					BackgroundTransparency={1}
					Text={message}
					TextColor3={Color3.fromHex("#a0a0a0")}
					Font={Fonts.Regular}
					TextScaled={true}
					TextTruncate={Enum.TextTruncate.AtEnd}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={202}
				>
					<uitextsizeconstraint MaxTextSize={11} MinTextSize={8} />
				</textlabel>
			</frame>

			{/* Right: Open Tag */}
			{actionText ? (
				<frame
					key="OpenTag"
					AnchorPoint={new Vector2(1, 0.5)}
					Position={new UDim2(1, -8, 0.5, 0)}
					Size={new UDim2(0, 50, 0, 22)}
					BackgroundColor3={Color3.fromHex("#1a1a1a")}
					ZIndex={202}
				>
					<uicorner CornerRadius={new UDim(0, 11)} />
					<uistroke Color={Color3.fromHex("#3a3a3a")} Thickness={1} />
					<textlabel
						key="TagLabel"
						Position={new UDim2(0, 5, 0, 0)}
						Size={new UDim2(1, -18, 1, 0)}
						BackgroundTransparency={1}
						Text={actionText}
						TextColor3={actionColor}
						Font={Fonts.Bold}
						TextScaled={true}
						ZIndex={203}
					>
						<uitextsizeconstraint MaxTextSize={9} MinTextSize={7} />
					</textlabel>
					<LucideIcon
						name="arrow-up-right"
						size={new UDim2(0, 8, 0, 8)}
						anchorPoint={new Vector2(1, 0.5)}
						position={new UDim2(1, -5, 0.5, 0)}
						color={actionColor}
						zIndex={203}
					/>
				</frame>
			) : undefined}

			{/* Invisible Full Click Button */}
			<textbutton
				key="ClickButton"
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundTransparency={1}
				Text=""
				AutoButtonColor={false}
				ZIndex={209}
				Event={{
					MouseButton1Click: onActionClick,
				}}
			/>
		</frame>
	);
}

/**
 * iOS-styled Notification Banner that slides down from the top notch of the smartphone screen.
 * Migrated to React TSX declarative renderer.
 */
export class NotificationBannerView {
	private hostInstance: GuiObject;
	private root: Root;

	private currentMessage?: ChatMessage;
	private activeClickCallback?: () => void;
	private legacyClickCallbacks: BannerClickCallback[] = [];
	private dismissThread?: thread;

	private visible = false;
	private options?: AppNotificationOptions;

	constructor(parent: GuiObject) {
		this.hostInstance = parent;
		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	private render(): void {
		this.root.render(
			<NotificationBannerComponent
				visible={this.visible}
				options={this.options}
				onActionClick={() => this.handleClicked()}
			/>,
		);
	}

	private handleClicked(): void {
		if (this.activeClickCallback) {
			this.activeClickCallback();
		}
		if (this.currentMessage) {
			for (const cb of this.legacyClickCallbacks) {
				cb(this.currentMessage);
			}
		}
		this.dismiss();
	}

	public show(options: AppNotificationOptions): void {
		this.activeClickCallback = options.onClick;

		if (options.soundId !== false) {
			this.playSound(typeIs(options.soundId, "string") ? options.soundId : undefined);
		}

		if (this.dismissThread) {
			task.cancel(this.dismissThread);
			this.dismissThread = undefined;
		}

		this.visible = true;
		this.options = options;
		this.render();

		const duration = options.duration ?? 4.5;
		this.dismissThread = task.delay(duration, () => {
			this.dismissThread = undefined;
			this.dismiss();
		});
	}

	public showNotification(message: ChatMessage): void {
		this.currentMessage = message;
		this.show({
			title: message.senderDisplayName || message.senderName,
			message: message.content,
			subtext: "Now",
			icon: `rbxthumb://type=AvatarHeadShot&id=${message.senderUserId}&w=48&h=48`,
			badgeIcon: "message-square",
			badgeColor: Color3.fromHex("#2a2a2a"),
			onClick: () => {
				for (const cb of this.legacyClickCallbacks) {
					cb(message);
				}
			},
		});
	}

	public showAnnouncement(text: string, title = "PENGUMUMAN"): void {
		this.show({
			title: title,
			message: text,
			subtext: "",
			icon: "rbxassetid://10734950309",
			badgeIcon: "megaphone",
			badgeColor: Color3.fromHex("#2a2a2a"),
			duration: 6.0,
			isUrgent: true,
		});
	}

	public dismiss(): void {
		if (this.dismissThread) {
			task.cancel(this.dismissThread);
			this.dismissThread = undefined;
		}
		this.visible = false;
		this.render();
	}

	public forceHide(): void {
		this.dismiss();
	}

	private playSound(soundId = "rbxassetid://17208361335"): void {
		if (!soundId || soundId === "") return;
		task.spawn(() => {
			try {
				const sound = new Instance("Sound");
				sound.SoundId = soundId;
				sound.Volume = 0.55;
				sound.Parent = SoundService;
				sound.Play();
				sound.Ended.Connect(() => sound.Destroy());
				task.delay(5, () => {
					if (sound.Parent) sound.Destroy();
				});
			} catch (err) {
				// Safe catch without console spam
			}
		});
	}

	public onBannerClicked(cb: BannerClickCallback): void {
		this.onClicked(cb);
	}

	public onClicked(cb: BannerClickCallback): void {
		this.legacyClickCallbacks.push(cb);
	}

	public destroy(): void {
		this.forceHide();
		this.root.unmount();
		this.legacyClickCallbacks = [];
		this.activeClickCallback = undefined;
	}
}
