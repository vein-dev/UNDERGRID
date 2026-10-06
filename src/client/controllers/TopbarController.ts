import { Players } from "@rbxts/services";
import { Icon } from "@rbxts/topbar-plus";
import { AdminPanelView } from "client/ui/admin/AdminPanelView";
import { EmoteModalView } from "client/ui/views/EmoteModalView";
import { LightingRemoteView } from "client/ui/views/LightingRemoteView";
import { SettingsModalView } from "client/ui/views/SettingsModalView";
import { isPlayerAdmin } from "shared/config";
import { GetIconUri } from "shared/utils";
import { BackpackController } from "./BackpackController";
import { HotbarController } from "./HotbarController";

/**
 * Client singleton controller managing TopbarPlus icons.
 */
export class TopbarController {
	private static instance?: TopbarController;
	private icons = new Map<string, Icon>();
	private isTopbarEnabled = true;

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
			.setImage(GetIconUri("backpack"))
			.setCaption("Backpack")
			.autoDeselect(false)
			.bindToggleKey(Enum.KeyCode.B);

		let isSyncing = false;

		backpackIcon.bindEvent("toggled", (_self, isSelected) => {
			if (!this.isTopbarEnabled) return;
			if (isSyncing) return;
			isSyncing = true;
			BackpackController.getInstance().toggle(isSelected);
			isSyncing = false;
		});

		// Sinkronisasi dua arah jika backpack ditutup via UI / Backdrop
		BackpackController.getInstance().onToggle((isOpen) => {
			if (!this.isTopbarEnabled) return;
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
			.autoDeselect(false)
			.bindToggleKey(Enum.KeyCode.G);

		let isSyncingEmote = false;

		emoteIcon.bindEvent("toggled", (_self, isSelected) => {
			if (!this.isTopbarEnabled) return;
			if (isSyncingEmote) return;
			isSyncingEmote = true;
			emoteView.toggle(isSelected);
			isSyncingEmote = false;
		});

		emoteView.onToggle((isOpen) => {
			if (!this.isTopbarEnabled) return;
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

		// 3. Icon Toggle Hotbar (Fullscreen mode tanpa Hotbar, keybind H)
		const hotbarController = HotbarController.getInstance();
		const hotbarIcon = new Icon()
			.setName("HotbarToggle")
			.setImage(GetIconUri("eye"), "Deselected")
			.setImage(GetIconUri("eye-off"), "Selected")
			.setCaption("Sembunyikan Hotbar (H)")
			.autoDeselect(false)
			.bindToggleKey(Enum.KeyCode.H);

		let isSyncingHotbar = false;

		hotbarIcon.bindEvent("toggled", (_self, isSelected) => {
			if (isSyncingHotbar) return;
			isSyncingHotbar = true;
			// isSelected = true -> Fullscreen / Hotbar disembunyikan
			// isSelected = false -> Normal / Hotbar ditampilkan
			hotbarController.setVisible(!isSelected);
			hotbarIcon.setCaption(isSelected ? "Tampilkan Hotbar (H)" : "Sembunyikan Hotbar (H)");
			isSyncingHotbar = false;
		});

		hotbarController.onVisibilityChanged((visible) => {
			if (isSyncingHotbar) return;
			isSyncingHotbar = true;
			if (!visible && !hotbarIcon.isSelected) {
				hotbarIcon.select();
				hotbarIcon.setCaption("Tampilkan Hotbar (H)");
			} else if (visible && hotbarIcon.isSelected) {
				hotbarIcon.deselect();
				hotbarIcon.setCaption("Sembunyikan Hotbar (H)");
			}
			isSyncingHotbar = false;
		});

		this.icons.set("HotbarToggle", hotbarIcon);

		// 4. Icon Admin Panel & Stage Controller (Dikelola dinamis untuk Permanent & Temporary Admin)
		this.updateAdminIcons();
		Players.LocalPlayer.GetAttributeChangedSignal("IsTemporaryAdmin").Connect(() => {
			this.updateAdminIcons();
		});


		// 4. Icon Settings (Terhubung dengan SettingsModalView)
		const settingsView = SettingsModalView.getInstance();
		const settingsIcon = new Icon()
			.setName("Settings")
			.setImage(GetIconUri("settings"))
			.setCaption("Settings (M)")
			.autoDeselect(false)
			.bindToggleKey(Enum.KeyCode.M);

		let isSyncingSettings = false;

		settingsIcon.bindEvent("toggled", (_self, isSelected) => {
			if (!this.isTopbarEnabled) return;
			if (isSyncingSettings) return;
			isSyncingSettings = true;
			settingsView.toggle(isSelected);
			isSyncingSettings = false;
		});

		settingsView.onToggle((isOpen) => {
			if (!this.isTopbarEnabled) return;
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

		// Jika setEnabled(false) dipanggil sebelum atau selama init, langsung sembunyikan
		if (!this.isTopbarEnabled) {
			this.setEnabled(false);
		}

		print("[TopbarController] Initialized successfully with TopbarPlus icons!");
	}

	public setEnabled(enabled: boolean): void {
		this.isTopbarEnabled = enabled;

		// 1. Enable/Disable each registered Icon instance
		for (const [_, icon] of this.icons) {
			icon.setEnabled(enabled);
		}

		// 2. Hide/Show all TopbarPlus ScreenGuis in PlayerGui
		const localPlayer = Players.LocalPlayer;
		const playerGui = localPlayer?.FindFirstChildOfClass("PlayerGui");
		if (playerGui) {
			for (const child of playerGui.GetChildren()) {
				if (child.IsA("ScreenGui") && child.Name.find("Topbar")[0] !== undefined) {
					child.Enabled = enabled;
				}
			}
		}
	}

	public getIcon(name: string): Icon | undefined {
		return this.icons.get(name);
	}

	private updateAdminIcons(): void {
		const shouldHaveAdmin = isPlayerAdmin(Players.LocalPlayer);
		const hasAdminIcon = this.icons.has("Admin");

		if (shouldHaveAdmin && !hasAdminIcon) {
			const adminView = AdminPanelView.getInstance();
			const adminIcon = new Icon()
				.setName("Admin")
				.setCaption("Admin (P)")
				.setImage(GetIconUri("shield"))
				.autoDeselect(false)
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

			const stageView = LightingRemoteView.getInstance();
			const stageIcon = new Icon()
				.setName("StageController")
				.setCaption("Stage Controller (L)")
				.setImage(GetIconUri("activity"))
				.autoDeselect(false)
				.bindToggleKey(Enum.KeyCode.L);

			let isSyncingStage = false;

			stageIcon.bindEvent("toggled", (_self, isSelected) => {
				if (!this.isTopbarEnabled) return;
				if (isSyncingStage) return;
				isSyncingStage = true;
				stageView.toggle(isSelected);
				isSyncingStage = false;
			});

			stageView.onOpen(() => {
				if (!this.isTopbarEnabled) return;
				if (isSyncingStage) return;
				isSyncingStage = true;
				if (!stageIcon.isSelected) {
					stageIcon.select();
				}
				isSyncingStage = false;
			});

			stageView.onClose(() => {
				if (!this.isTopbarEnabled) return;
				if (isSyncingStage) return;
				isSyncingStage = true;
				if (stageIcon.isSelected) {
					stageIcon.deselect();
				}
				isSyncingStage = false;
			});

			this.icons.set("StageController", stageIcon);
			print("[TopbarController] Stage Controller icon mounted for administrator.");

			if (!this.isTopbarEnabled) {
				adminIcon.setEnabled(false);
				stageIcon.setEnabled(false);
			}
		} else if (!shouldHaveAdmin && hasAdminIcon) {
			const adminIcon = this.icons.get("Admin");
			if (adminIcon) {
				adminIcon.destroy();
				this.icons.delete("Admin");
			}

			const stageIcon = this.icons.get("StageController");
			if (stageIcon) {
				stageIcon.destroy();
				this.icons.delete("StageController");
			}

			AdminPanelView.getInstance().toggle(false);
			LightingRemoteView.getInstance().toggle(false);
			print("[TopbarController] Admin icons unmounted and views closed.");
		}
	}
}

