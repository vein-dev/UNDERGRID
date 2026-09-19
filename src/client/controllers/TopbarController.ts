import { Players } from "@rbxts/services";
import { Icon } from "@rbxts/topbar-plus";
import { AdminPanelView } from "client/ui/admin/AdminPanelView";
import { EmoteModalView } from "client/ui/views/EmoteModalView";
import { SettingsModalView } from "client/ui/views/SettingsModalView";
import { isPlayerAdmin } from "shared/config";
import { GetIconUri } from "shared/utils";
import { BackpackController } from "./BackpackController";

/**
 * Client singleton controller managing TopbarPlus icons.
 */
export class TopbarController {
	private static instance?: TopbarController;
	private icons = new Map<string, Icon>();

	private constructor() {}

	public static getInstance(): TopbarController {
		if (!TopbarController.instance) {
			TopbarController.instance = new TopbarController();
		}
		return TopbarController.instance;
	}

	public init(): void {
		// 2. Icon Backpack (Terhubung dengan BackpackController & keybind B)
		const backpackIcon = new Icon()
			.setName("Backpack")
			// .setLabel("Backpack")
			.setImage(GetIconUri("backpack"))
			.setCaption("Backpack")
			.bindToggleKey(Enum.KeyCode.B);

		let isSyncing = false;

		backpackIcon.bindEvent("toggled", (_self, isSelected) => {
			if (isSyncing) return;
			isSyncing = true;
			BackpackController.getInstance().toggle(isSelected);
			isSyncing = false;
		});

		// Sinkronisasi dua arah jika backpack ditutup via UI / Backdrop
		BackpackController.getInstance().onToggle((isOpen) => {
			if (isSyncing) return;
			isSyncing = true;
			if (isOpen && !backpackIcon.isSelected) {
				backpackIcon.select();
			} else if (!isOpen && backpackIcon.isSelected) {
				backpackIcon.deselect();
			}
			isSyncing = false;
		});

		this.icons.set("Backpack", backpackIcon);

		// 3. Icon Emotes & Reactions (Terhubung dengan EmoteModalView & keybind G)
		const emoteView = EmoteModalView.getInstance();
		const emoteIcon = new Icon()
			.setName("Emotes")
			.setImage(GetIconUri("sparkles"))
			.setCaption("Emotes & Reactions (G)")
			.bindToggleKey(Enum.KeyCode.G);

		let isSyncingEmote = false;

		emoteIcon.bindEvent("toggled", (_self, isSelected) => {
			if (isSyncingEmote) return;
			isSyncingEmote = true;
			emoteView.toggle(isSelected);
			isSyncingEmote = false;
		});

		emoteView.onToggle((isOpen) => {
			if (isSyncingEmote) return;
			isSyncingEmote = true;
			if (isOpen && !emoteIcon.isSelected) {
				emoteIcon.select();
			} else if (!isOpen && emoteIcon.isSelected) {
				emoteIcon.deselect();
			}
			isSyncingEmote = false;
		});

		this.icons.set("Emotes", emoteIcon);

		// 3. Icon Admin Panel (Hanya untuk Player berhak Admin)
		if (isPlayerAdmin(Players.LocalPlayer)) {
			const adminView = AdminPanelView.getInstance();

			const adminIcon = new Icon()
				.setName("Admin")
				// .setLabel("Admin")
				.setCaption("Admin")
				.setImage(GetIconUri("shield"))
				.bindToggleKey(Enum.KeyCode.P);

			let isSyncingAdmin = false;

			adminIcon.bindEvent("toggled", (_self, isSelected) => {
				if (isSyncingAdmin) return;
				isSyncingAdmin = true;
				adminView.toggle(isSelected);
				isSyncingAdmin = false;
			});

			adminView.onToggle((isOpen) => {
				if (isSyncingAdmin) return;
				isSyncingAdmin = true;
				if (isOpen && !adminIcon.isSelected) {
					adminIcon.select();
				} else if (!isOpen && adminIcon.isSelected) {
					adminIcon.deselect();
				}
				isSyncingAdmin = false;
			});

			this.icons.set("Admin", adminIcon);
			print("[TopbarController] Admin icon mounted for administrator.");
		}

		// 4. Icon Settings (Terhubung dengan SettingsModalView)
		const settingsView = SettingsModalView.getInstance();
		const settingsIcon = new Icon()
			.setName("Settings")
			.setImage(GetIconUri("settings"))
			.setCaption("Settings (M)")
			.bindToggleKey(Enum.KeyCode.M);

		let isSyncingSettings = false;

		settingsIcon.bindEvent("toggled", (_self, isSelected) => {
			if (isSyncingSettings) return;
			isSyncingSettings = true;
			settingsView.toggle(isSelected);
			isSyncingSettings = false;
		});

		settingsView.onToggle((isOpen) => {
			if (isSyncingSettings) return;
			isSyncingSettings = true;
			if (isOpen && !settingsIcon.isSelected) {
				settingsIcon.select();
			} else if (!isOpen && settingsIcon.isSelected) {
				settingsIcon.deselect();
			}
			isSyncingSettings = false;
		});

		this.icons.set("Settings", settingsIcon);

		print("[TopbarController] Initialized successfully with TopbarPlus icons!");
	}

	public getIcon(name: string): Icon | undefined {
		return this.icons.get(name);
	}
}
