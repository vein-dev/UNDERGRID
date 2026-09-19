import { AppNotificationOptions, ChatMessage } from "shared/types";
import { ExternalDynamicIslandView } from "../ui/views/ExternalDynamicIslandView";
import { NotificationBannerView } from "../ui/views/NotificationBannerView";

/**
 * Global Notification Service.
 * Centralized singleton service providing a unified interface for displaying iOS Dynamic Island
 * & Notch notifications from ANY client system (Chat, Admin Announcements, Ticketing, Social Media, Music, etc.).
 */
export class GlobalNotificationService {
	private static instance?: GlobalNotificationService;

	private externalView?: ExternalDynamicIslandView;
	private internalView?: NotificationBannerView;
	private isPhoneOpenGetter?: () => boolean;

	private constructor() {
		this.ensureExternalView();
	}

	public static getInstance(): GlobalNotificationService {
		if (!GlobalNotificationService.instance) {
			GlobalNotificationService.instance = new GlobalNotificationService();
		}
		return GlobalNotificationService.instance;
	}

	/**
	 * Ensures that the standalone ExternalDynamicIslandView is instantiated and active in PlayerGui.
	 */
	public ensureExternalView(): ExternalDynamicIslandView {
		if (!this.externalView || !this.externalView.isAlive()) {
			this.externalView = new ExternalDynamicIslandView();
		}
		return this.externalView;
	}

	/**
	 * Returns the active external dynamic island view.
	 */
	public getExternalView(): ExternalDynamicIslandView {
		return this.ensureExternalView();
	}

	/**
	 * Registers the active internal in-phone notification notch banner and phone open state getter.
	 * Called during SmartphoneView initialization.
	 */
	public registerInternalBanner(
		internalView: NotificationBannerView,
		isPhoneOpenGetter: () => boolean,
	): void {
		this.internalView = internalView;
		this.isPhoneOpenGetter = isPhoneOpenGetter;
	}

	/**
	 * Unregisters the internal banner when SmartphoneView is destroyed (e.g. unequipped).
	 */
	public unregisterInternalBanner(): void {
		this.internalView = undefined;
		this.isPhoneOpenGetter = undefined;
	}

	/**
	 * Legacy/backward-compatible view registration.
	 */
	public registerViews(
		_externalView: unknown,
		internalView: NotificationBannerView,
		isPhoneOpenGetter: () => boolean,
	): void {
		this.registerInternalBanner(internalView, isPhoneOpenGetter);
	}

	/**
	 * Shows a custom notification using the unified iOS Dynamic Island template.
	 * Automatically routes to the external Dynamic Island or the in-phone Notch banner
	 * depending on whether the player's smartphone is currently open.
	 */
	public show(options: AppNotificationOptions): void {
		const isPhoneOpen = this.isPhoneOpenGetter ? this.isPhoneOpenGetter() : false;

		if (isPhoneOpen && this.internalView) {
			this.internalView.show(options);
		} else {
			const external = this.ensureExternalView();
			external.show(options);
		}
	}

	/**
	 * Shows an incoming chat message notification.
	 */
	public showChat(message: ChatMessage, onOpenChat?: () => void): void {
		this.show({
			title: message.senderDisplayName || message.senderName,
			message: message.content,
			subtext: "baru saja",
			icon: `rbxthumb://type=AvatarHeadShot&id=${message.senderUserId}&w=48&h=48`,
			badgeIcon: "message-square",
			badgeColor: Color3.fromHex("#2ecc71"),
			onClick: onOpenChat,
		});
	}

	/**
	 * Shows an admin / broadcast announcement (does not open phone).
	 */
	public showAnnouncement(text: string, title = "PENGUMUMAN"): void {
		this.show({
			title: title,
			message: text,
			subtext: "Now",
			badgeIcon: "megaphone",
			badgeColor: Color3.fromHex("#808080"),
			hideBadge: true,
			duration: 15.0,
			isUrgent: true,
			// onClick is intentionally undefined so it only dismisses without opening phone
		});
	}

	/**
	 * Shows an event or ticketing notification (e.g. RSVP success, gate opened).
	 */
	public showTicketAlert(eventName: string, message: string, onOpenTicket?: () => void): void {
		this.show({
			title: eventName,
			message: message,
			subtext: "Event",
			icon: "rbxassetid://10734950309",
			badgeText: "🎟️",
			badgeColor: Color3.fromHex("#a855f7"),
			actionText: onOpenTicket ? "Lihat ↗" : "Info",
			actionColor: Color3.fromHex("#a855f7"),
			duration: 5.0,
			onClick: onOpenTicket,
		});
	}

	/**
	 * Shows a music "Now Playing" track alert.
	 */
	public showMusicNowPlaying(title: string, artist: string, duration = 4.0): void {
		this.show({
			title: "Now Playing 🎵",
			message: `${title} • ${artist}`,
			subtext: "Musik",
			badgeText: "🎸",
			badgeColor: Color3.fromHex("#ec4899"),
			duration: duration,
		});
	}

	/**
	 * Shows a generic info notification.
	 */
	public showInfo(title: string, message: string, icon?: string, onClick?: () => void): void {
		this.show({
			title: title,
			message: message,
			subtext: "Info",
			icon: icon ?? "rbxassetid://10734950309",
			badgeText: "ℹ️",
			badgeColor: Color3.fromHex("#38bdf8"),
			actionText: onClick ? "Buka ↗" : undefined,
			actionColor: Color3.fromHex("#38bdf8"),
			onClick: onClick,
		});
	}

	/**
	 * Shows a warning notification.
	 */
	public showWarning(title: string, message: string, onClick?: () => void): void {
		this.show({
			title: title,
			message: message,
			subtext: "Peringatan",
			badgeText: "⚠️",
			badgeColor: Color3.fromHex("#ef4444"),
			actionText: onClick ? "Lihat" : undefined,
			actionColor: Color3.fromHex("#ef4444"),
			duration: 6.0,
			onClick: onClick,
		});
	}

	/**
	 * Dismisses active notification from both views.
	 */
	public dismiss(): void {
		this.externalView?.dismiss();
		this.internalView?.dismiss();
	}
}
