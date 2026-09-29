/**
 * ServerGuitarService.ts
 * Layanan server otoritatif untuk manajemen equip/unequip gitar (Strato)
 * dan pemasangan WeldConstraint ke dada avatar (Torso/UpperTorso).
 */

import { Players } from "@rbxts/services";
import { GuitarConfig, getGuitarChestOffset, isGuitarTool } from "shared/config";

export class ServerGuitarService {
	private static instance?: ServerGuitarService;
	private trackedTools = new Map<Tool, RBXScriptConnection[]>();

	private constructor() {}

	public static getInstance(): ServerGuitarService {
		if (!ServerGuitarService.instance) {
			ServerGuitarService.instance = new ServerGuitarService();
		}
		return ServerGuitarService.instance;
	}

	public init(): void {
		Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player));
		Players.PlayerRemoving.Connect((player) => this.onPlayerRemoving(player));

		for (const player of Players.GetPlayers()) {
			this.onPlayerAdded(player);
		}

		print("[ServerGuitarService] Initialized successfully.");
	}

	private onPlayerAdded(player: Player): void {
		const trackContainer = (container: Instance) => {
			container.ChildAdded.Connect((child) => {
				if (child.IsA("Tool") && isGuitarTool(child.Name)) {
					this.bindGuitarTool(child);
				}
			});

			for (const child of container.GetChildren()) {
				if (child.IsA("Tool") && isGuitarTool(child.Name)) {
					this.bindGuitarTool(child);
				}
			}
		};

		player.CharacterAdded.Connect((character) => {
			trackContainer(character);
		});

		if (player.Character) {
			trackContainer(player.Character);
		}

		const backpack = player.FindFirstChildOfClass("Backpack");
		if (backpack) {
			trackContainer(backpack);
		}

		player.ChildAdded.Connect((child) => {
			if (child.IsA("Backpack")) {
				trackContainer(child);
			}
		});
	}

	private onPlayerRemoving(player: Player): void {
		// Clean up any remaining guitar references for this player if needed
	}

	private bindGuitarTool(tool: Tool): void {
		if (this.trackedTools.has(tool)) return;

		const connections: RBXScriptConnection[] = [];

		// Handle when guitar is equipped
		connections.push(
			tool.Equipped.Connect(() => {
				this.attachToChest(tool);
			}),
		);

		// Handle when guitar is unequipped
		connections.push(
			tool.Unequipped.Connect(() => {
				this.detachFromChest(tool);
			}),
		);

		// Clean up on destroy
		connections.push(
			tool.Destroying.Connect(() => {
				this.unbindGuitarTool(tool);
			}),
		);

		this.trackedTools.set(tool, connections);

		// If tool is already inside character upon binding
		if (tool.Parent && tool.Parent.IsA("Model") && tool.Parent.FindFirstChildOfClass("Humanoid")) {
			this.attachToChest(tool);
		}
	}

	private unbindGuitarTool(tool: Tool): void {
		const conns = this.trackedTools.get(tool);
		if (conns) {
			for (const conn of conns) {
				conn.Disconnect();
			}
			this.trackedTools.delete(tool);
		}
		this.detachFromChest(tool);
	}

	private attachToChest(tool: Tool): void {
		const character = tool.Parent as Model | undefined;
		if (!character || !character.IsA("Model")) return;

		const torso = (character.FindFirstChild("UpperTorso") ?? character.FindFirstChild("Torso")) as
			| BasePart
			| undefined;
		const handle = (tool.FindFirstChild("Handle") ?? tool.PrimaryPart) as BasePart | undefined;

		if (!torso || !handle) return;

		// Clean up any default Roblox RightGrip weld on the right arm
		const rightArm = (character.FindFirstChild("Right Arm") ?? character.FindFirstChild("RightHand")) as
			| BasePart
			| undefined;
		if (rightArm) {
			for (const child of rightArm.GetChildren()) {
				if (child.IsA("Weld") && (child.Name === "RightGrip" || child.Name === "Grip")) {
					child.Destroy();
				}
			}
		}

		// Ensure all parts inside tool remain massless and non-collidable
		for (const desc of tool.GetDescendants()) {
			if (desc.IsA("BasePart")) {
				desc.CanCollide = false;
				desc.CanTouch = false;
				desc.CanQuery = false;
				desc.Massless = true;
				desc.Anchored = false;
			}
		}

		// Align handle to chest position and create server WeldConstraint
		const offset = getGuitarChestOffset(tool.Name) ?? GuitarConfig.CHEST_OFFSET;
		handle.CFrame = torso.CFrame.mul(offset);

		let chestWeld = handle.FindFirstChild("ChestWeld") as WeldConstraint | undefined;
		if (!chestWeld) {
			chestWeld = new Instance("WeldConstraint");
			chestWeld.Name = "ChestWeld";
			chestWeld.Part0 = torso;
			chestWeld.Part1 = handle;
			chestWeld.Parent = handle;
		} else {
			chestWeld.Part0 = torso;
			chestWeld.Part1 = handle;
		}

		print(`[ServerGuitarService] Attached ${tool.Name} to chest of ${character.Name}`);
	}

	private detachFromChest(tool: Tool): void {
		const handle = (tool.FindFirstChild("Handle") ?? tool.PrimaryPart) as BasePart | undefined;
		if (handle) {
			const chestWeld = handle.FindFirstChild("ChestWeld");
			if (chestWeld) {
				chestWeld.Destroy();
			}
		}
	}
}
