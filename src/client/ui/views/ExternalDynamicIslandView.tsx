import React, { useEffect, useState } from "@rbxts/react";
import ReactRoblox, { Root } from "@rbxts/react-roblox";
import { Players, SoundService, Workspace } from "@rbxts/services";
import { AppNotificationOptions, ChatMessage } from "shared/types";
import { Fonts } from "../Typography";
import { LucideIcon } from "../components/LucideIcon";

export type DynamicIslandClickCallback = (message: ChatMessage) => void;

export interface DynamicIslandState {
	visible: boolean;
	options?: AppNotificationOptions;
}

export function ExternalDynamicIslandComponent({
	visible,
	options,
	onActionClick,
}: {
	visible: boolean;
	options?: AppNotificationOptions;
	onActionClick: () => void;
}) {
	const [scale, setScale] = useState(1);

	useEffect(() => {
		const updateScale = () => {
			const camera = Workspace.CurrentCamera;
			const vp = camera ? camera.ViewportSize : new Vector2(1280, 720);
			const scaleX = (vp.X * 0.85) / 360;
			setScale(math.clamp(scaleX, 0.6, 1.0));
		};
		updateScale();
		const cam = Workspace.CurrentCamera;
		const conn = cam?.GetPropertyChangedSignal("ViewportSize").Connect(updateScale);
		return () => conn?.Disconnect();
	}, []);

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
			key="IslandContainer"
			AnchorPoint={new Vector2(0.5, 0)}
			Position={new UDim2(0.5, 0, 0, 16)}
			Size={new UDim2(0, 360, 0, 68)}
			BackgroundColor3={Color3.fromHex("#0a0a0a")}
			BackgroundTransparency={0.08}
			ZIndex={151}
		>
			<uiscale Scale={scale} />
			<uicorner CornerRadius={new UDim(0, 24)} />
			<uistroke
				Color={Color3.fromHex("#262626")}
				Transparency={0.35}
				Thickness={1.2}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>

			{/* Left: Avatar & App Icon badge */}
			<frame
				key="AvatarContainer"
				Position={new UDim2(0, 16, 0.5, 0)}
				AnchorPoint={new Vector2(0, 0.5)}
				Size={new UDim2(0, 42, 0, 42)}
				BackgroundTransparency={1}
				ZIndex={152}
			>
				{icon && icon !== "" ? (
					<imagelabel
						key="Avatar"
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundColor3={Color3.fromHex("#181818")}
						Image={icon}
						ZIndex={153}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
					</imagelabel>
				) : (
					<frame
						key="AvatarPlaceholder"
						Size={new UDim2(1, 0, 1, 0)}
						BackgroundColor3={Color3.fromHex("#1c1c1c")}
						ZIndex={153}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<LucideIcon
							name={badgeIcon}
							size={new UDim2(0, 20, 0, 20)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#888888")}
							zIndex={154}
						/>
					</frame>
				)}

				{/* App Badge Pill (hanya tampil jika ada icon/avatar dan hideBadge tidak aktif) */}
				{icon && icon !== "" && !options.hideBadge ? (
					<frame
						key="AppBadge"
						AnchorPoint={new Vector2(1, 1)}
						Position={new UDim2(1, 4, 1, 4)}
						Size={new UDim2(0, 18, 0, 18)}
						BackgroundColor3={badgeColor}
						ZIndex={155}
					>
						<uicorner CornerRadius={new UDim(1, 0)} />
						<uistroke Color={Color3.fromHex("#000000")} Thickness={1.5} />
						<LucideIcon
							name={badgeIcon}
							size={new UDim2(0, 10, 0, 10)}
							anchorPoint={new Vector2(0.5, 0.5)}
							position={new UDim2(0.5, 0, 0.5, 0)}
							color={Color3.fromHex("#ffffff")}
							zIndex={156}
						/>
					</frame>
				) : undefined}
			</frame>

			{/* Center: Text Details (Symmetric 16px outer margins on both left and right) */}
			<frame
				key="TextContainer"
				Position={new UDim2(0, 70, 0.5, 0)}
				AnchorPoint={new Vector2(0, 0.5)}
				Size={new UDim2(1, actionText ? -163 : -86, 1, -20)}
				BackgroundTransparency={1}
				ZIndex={152}
			>
				{/* Top line: Sender name + Timestamp */}
				<frame key="TitleRow" Size={new UDim2(1, 0, 0, 18)} BackgroundTransparency={1}>
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
						ZIndex={153}
					>
						<uitextsizeconstraint MaxTextSize={13} MinTextSize={9} />
					</textlabel>
					{subtext !== "" ? (
						<textlabel
							key="TimeLabel"
							AnchorPoint={new Vector2(1, 0)}
							Position={new UDim2(1, 0, 0, 0)}
							Size={new UDim2(0, 50, 1, 0)}
							BackgroundTransparency={1}
							Text={subtext}
							TextColor3={Color3.fromHex("#777777")}
							Font={Fonts.Regular}
							TextScaled={true}
							TextXAlignment={Enum.TextXAlignment.Right}
							ZIndex={153}
						>
							<uitextsizeconstraint MaxTextSize={10} MinTextSize={7} />
						</textlabel>
					) : undefined}
				</frame>

				{/* Bottom line: Message preview */}
				<textlabel
					key="MessagePreview"
					Position={new UDim2(0, 0, 0, 20)}
					Size={new UDim2(1, 0, 1, -20)}
					BackgroundTransparency={1}
					Text={message}
					TextColor3={Color3.fromHex("#a0a0a0")}
					Font={Fonts.Regular}
					TextScaled={true}
					TextTruncate={Enum.TextTruncate.AtEnd}
					TextXAlignment={Enum.TextXAlignment.Left}
					ZIndex={153}
				>
					<uitextsizeconstraint MaxTextSize={12} MinTextSize={8} />
				</textlabel>
			</frame>

			{/* Right Action Tag */}
			{actionText ? (
				<frame
					key="OpenTag"
					AnchorPoint={new Vector2(1, 0.5)}
					Position={new UDim2(1, -16, 0.5, 0)}
					Size={new UDim2(0, 65, 0, 28)}
					BackgroundColor3={Color3.fromHex("#1a1a1a")}
					ZIndex={153}
				>
					<uicorner CornerRadius={new UDim(0, 14)} />
					<uistroke Color={Color3.fromHex("#3a3a3a")} Thickness={1} />
					<textlabel
						key="TagLabel"
						Position={new UDim2(0, 8, 0, 0)}
						Size={new UDim2(1, -26, 1, 0)}
						BackgroundTransparency={1}
						Text={actionText}
						TextColor3={actionColor}
						Font={Fonts.Bold}
						TextScaled={true}
						ZIndex={154}
					>
						<uitextsizeconstraint MaxTextSize={11} MinTextSize={7} />
					</textlabel>
					<LucideIcon
						name="arrow-up-right"
						size={new UDim2(0, 12, 0, 12)}
						anchorPoint={new Vector2(1, 0.5)}
						position={new UDim2(1, -6, 0.5, 0)}
						color={actionColor}
						zIndex={154}
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
				ZIndex={159}
				Event={{
					MouseButton1Click: onActionClick,
				}}
			/>
		</frame>
	);
}

/**
 * Standalone iOS Dynamic Island notification banner.
 * Migrated to React TSX declarative renderer while preserving 100% backward compatibility
 * with GlobalNotificationService via its public methods.
 */
export class ExternalDynamicIslandView {
	private screenGui?: ScreenGui;
	private hostInstance: Instance;
	private root: Root;

	private currentMessage?: ChatMessage;
	private activeClickCallback?: () => void;
	private legacyClickCallbacks: DynamicIslandClickCallback[] = [];
	private dismissThread?: thread;

	private isDestroyed = false;

	private state: DynamicIslandState = {
		visible: false,
		options: undefined,
	};

	constructor(parentContainer?: Instance) {
		const isGuiObject = parentContainer && parentContainer.IsA("GuiObject");

		if (isGuiObject) {
			this.hostInstance = parentContainer;
		} else {
			this.screenGui = new Instance("ScreenGui");
			this.screenGui.Name = "DynamicIslandGui";
			this.screenGui.ResetOnSpawn = false;
			this.screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
			this.screenGui.DisplayOrder = 150;
			this.screenGui.ScreenInsets = Enum.ScreenInsets.None;
			this.screenGui.IgnoreGuiInset = true;

			const localPlayer = Players.LocalPlayer;
			const playerGui =
				(parentContainer as PlayerGui) ??
				(localPlayer
					? ((localPlayer.FindFirstChild("PlayerGui") as PlayerGui) ??
						(localPlayer.WaitForChild("PlayerGui") as PlayerGui))
					: undefined);
			if (playerGui) {
				this.screenGui.Parent = playerGui;
			}
			this.hostInstance = this.screenGui;
		}

		this.root = ReactRoblox.createRoot(this.hostInstance);
		this.render();
	}

	public isAlive(): boolean {
		return !this.isDestroyed;
	}

	private render(): void {
		if (this.isDestroyed) return;
		this.root.render(
			<ExternalDynamicIslandComponent
				visible={this.state.visible}
				options={this.state.options}
				onActionClick={() => {
					this.handleClicked();
				}}
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
		if (this.isDestroyed) return;

		this.activeClickCallback = options.onClick;

		if (options.soundId !== false) {
			this.playSound(typeIs(options.soundId, "string") ? options.soundId : undefined);
		}

		if (this.dismissThread) {
			task.cancel(this.dismissThread);
			this.dismissThread = undefined;
		}

		this.state = {
			visible: true,
			options,
		};
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
			subtext: "baru saja",
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
		this.state = {
			...this.state,
			visible: false,
		};
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

	public onClicked(cb: DynamicIslandClickCallback): void {
		this.legacyClickCallbacks.push(cb);
	}

	public destroy(): void {
		if (this.isDestroyed) return;
		this.isDestroyed = true;
		this.forceHide();
		this.root.unmount();
		if (this.screenGui) {
			this.screenGui.Destroy();
		}
		this.legacyClickCallbacks = [];
		this.activeClickCallback = undefined;
	}
}
