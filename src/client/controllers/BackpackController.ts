import { Players } from "@rbxts/services";
import { BackpackSlotInfo, BackpackView } from "client/ui/views/BackpackView";
import { HotbarController } from "./HotbarController";

interface SelectedSlot {
	slotType: "pickup" | "storage";
	index: number;
}

/**
 * Client singleton controller managing Backpack & Storage system,
 * including item swapping between Hotbar and Storage, live search, and Topbar integration.
 */
export class BackpackController {
	private static instance?: BackpackController;

	private player = Players.LocalPlayer;
	private backpackView?: BackpackView;
	private storageFolder: Folder;

	// Storage slots: 1 to 20
	private storageTools = new Map<number, Tool>();

	// Currently selected slot for swap
	private selectedSlot?: SelectedSlot;
	private searchQuery = "";

	private onToggleCallbacks: Array<(isOpen: boolean) => void> = [];

	private constructor() {
		// Dedicated folder for tools placed into storage (so they don't appear in default backpack)
		let folder = this.player.FindFirstChild("BackpackStorage") as Folder | undefined;
		if (!folder) {
			folder = new Instance("Folder");
			folder.Name = "BackpackStorage";
			folder.Parent = this.player;
		}
		this.storageFolder = folder;
	}

	public static getInstance(): BackpackController {
		if (!BackpackController.instance) {
			BackpackController.instance = new BackpackController();
		}
		return BackpackController.instance;
	}

	public init(): void {
		// Initialize View
		this.backpackView = new BackpackView();

		this.backpackView.onPickupClicked((slotIndex) => {
			this.handleSlotClicked("pickup", slotIndex);
		});

		this.backpackView.onStorageClicked((slotIndex) => {
			this.handleSlotClicked("storage", slotIndex);
		});

		this.backpackView.onSearchChanged((query) => {
			this.searchQuery = query;
		});

		this.backpackView.onDrop((from, to) => {
			this.selectedSlot = undefined;
			this.swapSlots(from, to);
			this.refreshView();
		});

		this.backpackView.onClose(() => {
			this.toggle(false);
		});

		// Listen to hotbar updates to keep Pickup row synchronized
		HotbarController.getInstance().onSlotsUpdated(() => {
			this.refreshView();
		});

		this.refreshView();
		print("[BackpackController] Backpack & Storage system initialized successfully.");
	}

	public onToggle(callback: (isOpen: boolean) => void): void {
		this.onToggleCallbacks.push(callback);
	}

	public toggle(forceState?: boolean): void {
		if (!this.backpackView) return;

		const nextState = forceState !== undefined ? forceState : !this.backpackView.isVisible();
		if (forceState !== undefined && this.backpackView.isVisible() === forceState) {
			return;
		}

		this.backpackView.setVisible(nextState);

		if (!nextState) {
			this.selectedSlot = undefined;
		}

		this.refreshView();

		for (const cb of this.onToggleCallbacks) {
			cb(nextState);
		}
	}

	public isOpen(): boolean {
		return this.backpackView?.isVisible() ?? false;
	}

	private handleSlotClicked(slotType: "pickup" | "storage", index: number): void {
		const hotbarController = HotbarController.getInstance();

		// Check what tool is in this slot
		const clickedTool =
			slotType === "pickup" ? hotbarController.getToolInSlot(index) : this.storageTools.get(index);

		// 1. If nothing is selected yet
		if (!this.selectedSlot) {
			if (clickedTool) {
				// Select tool to swap
				this.selectedSlot = { slotType, index };
			}
			this.refreshView();
			return;
		}

		// 2. If clicking the exact same slot -> Deselect
		if (this.selectedSlot.slotType === slotType && this.selectedSlot.index === index) {
			this.selectedSlot = undefined;
			this.refreshView();
			return;
		}

		// 3. Perform Swap / Move
		const source = this.selectedSlot;
		this.selectedSlot = undefined;

		this.swapSlots(source, { slotType, index });
		this.refreshView();
	}

	private swapSlots(from: SelectedSlot, to: SelectedSlot): void {
		const hotbar = HotbarController.getInstance();
		const character = this.player.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		const backpack = this.player.WaitForChild("Backpack") as Backpack;

		if (from.slotType === "pickup" && to.slotType === "pickup") {
			// Swap within Pickup / Hotbar
			const toolA = hotbar.getToolInSlot(from.index);
			const toolB = hotbar.getToolInSlot(to.index);

			hotbar.setSlotTool(from.index, toolB);
			hotbar.setSlotTool(to.index, toolA);
		} else if (from.slotType === "storage" && to.slotType === "storage") {
			// Swap within Storage
			const toolA = this.storageTools.get(from.index);
			const toolB = this.storageTools.get(to.index);

			if (toolB) {
				this.storageTools.set(from.index, toolB);
			} else {
				this.storageTools.delete(from.index);
			}

			if (toolA) {
				this.storageTools.set(to.index, toolA);
			} else {
				this.storageTools.delete(to.index);
			}
		} else {
			// Cross swap between Pickup and Storage!
			const pickupIndex = from.slotType === "pickup" ? from.index : to.index;
			const storageIndex = from.slotType === "storage" ? from.index : to.index;

			const pickupTool = hotbar.getToolInSlot(pickupIndex);
			const storageTool = this.storageTools.get(storageIndex);

			// 1. Unequip pickup tool if currently held in hand
			if (pickupTool && character && pickupTool.Parent === character && humanoid) {
				humanoid.UnequipTools();
			}

			// 2. Move pickup tool to Storage
			if (pickupTool) {
				pickupTool.Parent = this.storageFolder;
				this.storageTools.set(storageIndex, pickupTool);
			} else {
				this.storageTools.delete(storageIndex);
			}

			// 3. Move storage tool to Hotbar / Backpack
			if (storageTool) {
				storageTool.Parent = backpack;
				hotbar.setSlotTool(pickupIndex, storageTool);
			} else {
				hotbar.setSlotTool(pickupIndex, undefined);
			}
		}
	}

	public refreshView(): void {
		if (!this.backpackView) return;

		const hotbar = HotbarController.getInstance();
		const character = this.player.Character;

		// 1. Pickup slots
		const pickupSlotData = new Map<number, BackpackSlotInfo>();
		for (let i = 1; i <= BackpackView.PICKUP_SLOT_COUNT; i++) {
			const tool = hotbar.getToolInSlot(i);
			const isSelected =
				this.selectedSlot !== undefined &&
				this.selectedSlot.slotType === "pickup" &&
				this.selectedSlot.index === i;
			const isEquipped = tool !== undefined && character !== undefined && tool.Parent === character;

			pickupSlotData.set(i, { tool, isSelected, isEquipped });
		}
		this.backpackView.updatePickupSlots(pickupSlotData);

		// 2. Storage slots
		const storageSlotData = new Map<number, BackpackSlotInfo>();
		for (let i = 1; i <= BackpackView.STORAGE_SLOT_COUNT; i++) {
			const tool = this.storageTools.get(i);
			const isSelected =
				this.selectedSlot !== undefined &&
				this.selectedSlot.slotType === "storage" &&
				this.selectedSlot.index === i;

			storageSlotData.set(i, { tool, isSelected });
		}
		this.backpackView.updateStorageSlots(storageSlotData, this.searchQuery);
	}
}
