import { AppId } from "shared/types";
import { ChatApp } from "./apps/ChatApp";
import { EventApp } from "./apps/EventApp";
import { MusicApp } from "./apps/MusicApp";
import { SettingsApp } from "./apps/SettingsApp";
import { SocialApp } from "./apps/SocialApp";

/**
 * Manages navigation between apps on the Smartphone.
 * Responsible for showing/hiding apps and emitting home navigation events.
 */
export class AppRouter {
	private chatApp: ChatApp;
	private musicApp: MusicApp;
	private settingsApp: SettingsApp;
	private socialApp: SocialApp;
	private eventApp: EventApp;
	private activeApp?: AppId;
	private onAppClosedCallbacks: Array<() => void> = [];

	constructor(parent: GuiObject) {
		this.chatApp = new ChatApp(parent);
		this.musicApp = new MusicApp(parent);
		this.settingsApp = new SettingsApp(parent);
		this.socialApp = new SocialApp(parent);
		this.eventApp = new EventApp(parent);

		// Back buttons in apps route through the router
		this.chatApp.onBack(() => this.closeApp());
		this.musicApp.onBack(() => this.closeApp());
		this.settingsApp.onBack(() => this.closeApp());
		this.socialApp.onBack(() => this.closeApp());
		this.eventApp.onBack(() => this.closeApp());
	}

	/** Opens the specified app and hides all others. */
	public openApp(appId: AppId): void {
		this.hideAllApps();
		this.activeApp = appId;

		if (appId === AppId.Messages) {
			this.chatApp.show();
		} else if (appId === AppId.Music) {
			this.musicApp.show();
		} else if (appId === AppId.Settings) {
			this.settingsApp.show();
		} else if (appId === AppId.Social) {
			this.socialApp.show();
		} else if (appId === AppId.Events) {
			this.eventApp.show();
		}

		print(`[AppRouter] Opened: ${appId}`);
	}

	/**
	 * Opens ChatApp directly into a direct message conversation with the target contact.
	 */
	public openChatWith(userId: number, displayName?: string, userName?: string): void {
		this.hideAllApps();
		this.activeApp = AppId.Messages;
		this.chatApp.openConversationWithUserId(userId, displayName, userName);
		this.chatApp.show();
		print(`[AppRouter] Opened Chat with user: ${userId}`);
	}

	public getChatApp(): ChatApp {
		return this.chatApp;
	}

	/**
	 * Returns the userId of the contact currently in room chat with the player,
	 * or undefined if Messages app is not active or user is in contact list.
	 */
	public getActiveChatUserId(): number | undefined {
		if (this.activeApp !== AppId.Messages) return undefined;
		return this.chatApp.getActiveConversationUserId();
	}

	/**
	 * Checks whether the player is currently viewing the chat room with the specified user.
	 */
	public isChatOpenWith(userId: number): boolean {
		return this.getActiveChatUserId() === userId;
	}

	public getSocialApp(): SocialApp {
		return this.socialApp;
	}

	public getEventApp(): EventApp {
		return this.eventApp;
	}

	/**
	 * Closes the active app and fires onAppClosed callbacks
	 * (used by back buttons — returns user to Home Screen).
	 */
	public closeApp(): void {
		this.hideAllApps();
		this.activeApp = undefined;
		for (const cb of this.onAppClosedCallbacks) cb();
		print("[AppRouter] App closed — back to Home.");
	}

	/**
	 * Silently hides all apps without firing callbacks.
	 * Used when the entire phone is closed.
	 */
	public hideAll(): void {
		this.hideAllApps();
		this.activeApp = undefined;
	}

	public onAppClosed(cb: () => void): void {
		this.onAppClosedCallbacks.push(cb);
	}

	public getActiveApp(): AppId | undefined {
		return this.activeApp;
	}

	private hideAllApps(): void {
		this.chatApp.hide();
		this.musicApp.hide();
		this.settingsApp.hide();
		this.socialApp.hide();
		this.eventApp.hide();
	}

	public destroy(): void {
		this.chatApp.destroy();
		this.musicApp.destroy();
		this.settingsApp.destroy();
		this.socialApp.destroy();
		this.eventApp.destroy();
	}
}

