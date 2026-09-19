import { Players, StarterGui, UserInputService } from "@rbxts/services";
import { HotbarView, SlotData } from "client/ui/views/HotbarView";

/**
 * Client singleton controller managing standard 9-slot Hotbar,
 * Backpack synchronization, keyboard shortcuts (1-9), and tool equipping.
 */
export class HotbarController {
	private static instance?: HotbarController;

	private player = Players.LocalPlayer;
	private hotbarView?: HotbarView;

	// Slot number (1-9) -> Tool instance
	private toolSlots = new Map<number, Tool>();
	private toolConnections = new Map<Tool, RBXScriptConnection[]>();

	private characterConnections: RBXScriptConnection[] = [];
	private backpackConnections: RBXScriptConnection[] = [];

	private static readonly KEY_MAP = new Map<Enum.KeyCode, number>([
		[Enum.KeyCode.One, 1],
		[Enum.KeyCode.KeypadOne, 1],
		[Enum.KeyCode.Two, 2],
		[Enum.KeyCode.KeypadTwo, 2],
		[Enum.KeyCode.Three, 3],
		[Enum.KeyCode.KeypadThree, 3],
		[Enum.KeyCode.Four, 4],
		[Enum.KeyCode.KeypadFour, 4],
		[Enum.KeyCode.Five, 5],
		[Enum.KeyCode.KeypadFive, 5],
	]);

	private constructor() {}

	public static getInstance(): HotbarController {
		if (!HotbarController.instance) {
			HotbarController.instance = new HotbarController();
		}
		return HotbarController.instance;
	}

	public init(): void {
		// 1. Disable default Roblox backpack CoreGui
		this.disableDefaultBackpack();

		// 2. Initialize visual View
		this.hotbarView = new HotbarView();
		this.hotbarView.onSlotClicked((slotNumber) => {
			this.toggleSlot(slotNumber);
		});

		// 3. Register Keybinds (1-9)
		this.setupInputListener();

		// 4. Track Character lifecycle
		if (this.player.Character) {
			this.onCharacterAdded(this.player.Character);
		}
		this.player.CharacterAdded.Connect((char) => this.onCharacterAdded(char));
		this.player.CharacterRemoving.Connect(() => this.onCharacterRemoving());

		// 5. Track Backpack lifecycle
		const existingBackpack = this.player.FindFirstChildOfClass("Backpack");
		if (existingBackpack) {
			this.setupBackpackListener(existingBackpack);
		}
		this.player.ChildAdded.Connect((child) => {
			if (child.IsA("Backpack")) {
				this.setupBackpackListener(child);
			}
		});

		// 6. Initial sync
		this.syncTools();

		print("[HotbarController] Standard Hotbar initialized successfully.");
	}

	private disableDefaultBackpack(): void {
		task.spawn(() => {
			let attempts = 0;
			while (attempts < 20) {
				const [success] = pcall(() => {
					StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false);
				});
				if (success) break;
				task.wait(0.2);
				attempts++;
			}
		});
	}

	private setupInputListener(): void {
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed) return;

			const slotNumber = HotbarController.KEY_MAP.get(input.KeyCode);
			if (slotNumber !== undefined) {
				this.toggleSlot(slotNumber);
			}
		});
	}

	private onCharacterAdded(character: Model): void {
		for (const conn of this.characterConnections) {
			conn.Disconnect();
		}
		this.characterConnections = [];

		this.characterConnections.push(
			character.ChildAdded.Connect((child) => {
				if (child.IsA("Tool")) {
					this.assignToolToSlot(child);
					this.refreshView();
				}
			}),
		);

		this.characterConnections.push(
			character.ChildRemoved.Connect((child) => {
				if (child.IsA("Tool")) {
					task.defer(() => this.syncTools());
				}
			}),
		);

		const humanoid = character.WaitForChild("Humanoid") as Humanoid | undefined;
		if (humanoid) {
			this.characterConnections.push(
				humanoid.Died.Connect(() => {
					this.refreshView();
				}),
			);
		}

		task.defer(() => this.syncTools());
	}

	private onCharacterRemoving(): void {
		for (const conn of this.characterConnections) {
			conn.Disconnect();
		}
		this.characterConnections = [];
	}

	private setupBackpackListener(backpack: Backpack): void {
		for (const conn of this.backpackConnections) {
			conn.Disconnect();
		}
		this.backpackConnections = [];

		this.backpackConnections.push(
			backpack.ChildAdded.Connect((child) => {
				if (child.IsA("Tool")) {
					this.assignToolToSlot(child);
					this.refreshView();
				}
			}),
		);

		this.backpackConnections.push(
			backpack.ChildRemoved.Connect((child) => {
				if (child.IsA("Tool")) {
					task.defer(() => {
						const character = this.player.Character;
						const isInChar = character !== undefined && child.Parent === character;
						const isInBp = child.Parent === backpack;

						if (!isInChar && !isInBp) {
							this.removeToolFromSlots(child);
						}
						this.refreshView();
					});
				}
			}),
		);

		task.defer(() => this.syncTools());
	}

	/**
	 * Scans Backpack and Character to ensure all tools are mapped to a slot.
	 */
	public syncTools(): void {
		const character = this.player.Character;
		const backpack = this.player.FindFirstChildOfClass("Backpack");

		const currentTools = new Set<Tool>();

		if (backpack) {
			for (const child of backpack.GetChildren()) {
				if (child.IsA("Tool")) {
					currentTools.add(child);
					this.assignToolToSlot(child);
				}
			}
		}

		if (character) {
			for (const child of character.GetChildren()) {
				if (child.IsA("Tool")) {
					currentTools.add(child);
					this.assignToolToSlot(child);
				}
			}
		}

		// Remove any slot whose tool is no longer owned by player
		for (const [slot, tool] of this.toolSlots) {
			if (!currentTools.has(tool)) {
				this.unbindToolEvents(tool);
				this.toolSlots.delete(slot);
			}
		}

		this.refreshView();
	}

	private assignToolToSlot(tool: Tool): void {
		this.bindToolEvents(tool);

		// If already mapped to a slot, keep it
		for (const [, existingTool] of this.toolSlots) {
			if (existingTool === tool) return;
		}

		// Find first free slot (1-9)
		for (let i = 1; i <= HotbarView.MAX_SLOTS; i++) {
			if (!this.toolSlots.has(i)) {
				this.toolSlots.set(i, tool);
				return;
			}
		}
	}

	private removeToolFromSlots(tool: Tool): void {
		this.unbindToolEvents(tool);
		for (const [slot, existingTool] of this.toolSlots) {
			if (existingTool === tool) {
				this.toolSlots.delete(slot);
				break;
			}
		}
	}

	private bindToolEvents(tool: Tool): void {
		if (this.toolConnections.has(tool)) return;

		const connections: RBXScriptConnection[] = [];

		connections.push(
			tool.Equipped.Connect(() => {
				this.refreshView();
			}),
		);

		connections.push(
			tool.Unequipped.Connect(() => {
				this.refreshView();
			}),
		);

		this.toolConnections.set(tool, connections);
	}

	private unbindToolEvents(tool: Tool): void {
		const conns = this.toolConnections.get(tool);
		if (conns) {
			for (const conn of conns) {
				conn.Disconnect();
			}
			this.toolConnections.delete(tool);
		}
	}

	/**
	 * Equips or unequips the tool in the specified slot.
	 */
	public toggleSlot(slotNumber: number): void {
		const tool = this.toolSlots.get(slotNumber);
		if (!tool) return;

		const character = this.player.Character;
		if (!character) return;

		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid || humanoid.Health <= 0) return;

		if (tool.Parent === character) {
			// Already equipped in hand -> unequip back to backpack
			humanoid.UnequipTools();
		} else {
			// Unequip currently equipped tool and equip selected one
			humanoid.UnequipTools();
			humanoid.EquipTool(tool);
		}

		this.refreshView();
		task.defer(() => this.refreshView());
	}

	/**
	 * Updates the View with current slot and equipped state.
	 */
	public refreshView(): void {
		if (!this.hotbarView) return;

		const character = this.player.Character;
		const slotDataMap = new Map<number, SlotData>();

		for (let i = 1; i <= HotbarView.MAX_SLOTS; i++) {
			const tool = this.toolSlots.get(i);
			if (tool) {
				const isEquipped = character !== undefined && tool.Parent === character;
				slotDataMap.set(i, { tool, isEquipped });
			} else {
				slotDataMap.set(i, { isEquipped: false });
			}
		}

		this.hotbarView.updateSlots(slotDataMap);
		this.onSlotsUpdatedCallback?.();
	}

	private onSlotsUpdatedCallback?: () => void;

	public onSlotsUpdated(callback: () => void): void {
		this.onSlotsUpdatedCallback = callback;
	}

	public getToolSlots(): Map<number, Tool> {
		return this.toolSlots;
	}

	public setSlotTool(slotNumber: number, tool: Tool | undefined): void {
		if (tool) {
			this.bindToolEvents(tool);
			this.toolSlots.set(slotNumber, tool);
		} else {
			const oldTool = this.toolSlots.get(slotNumber);
			if (oldTool) {
				this.unbindToolEvents(oldTool);
			}
			this.toolSlots.delete(slotNumber);
		}
		this.refreshView();
	}

	public getToolInSlot(slotNumber: number): Tool | undefined {
		return this.toolSlots.get(slotNumber);
	}
}
