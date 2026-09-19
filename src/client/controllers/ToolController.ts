import { Players } from "@rbxts/services";
import { IToolComponent, SkateboardClientComponent, SmartphoneClientComponent } from "client/components";

/**
 * Client singleton controller responsible for binding OOP components
 * to Tools when they are added to the Player or Character.
 *
 * To support a new tool, add a new binding in bindTool().
 */
export class ToolController {
	private static instance?: ToolController;
	private player = Players.LocalPlayer;
	private activeComponents = new Map<Tool, IToolComponent>();

	private constructor() {}

	public static getInstance(): ToolController {
		if (!ToolController.instance) {
			ToolController.instance = new ToolController();
		}
		return ToolController.instance;
	}

	public init(): void {
		// 1. Track Backpack lifecycle dynamically across respawns
		const existingBackpack = this.player.FindFirstChildOfClass("Backpack");
		if (existingBackpack) {
			this.watchContainer(existingBackpack);
		}
		this.player.ChildAdded.Connect((child) => {
			if (child.IsA("Backpack")) {
				this.watchContainer(child);
			}
		});

		// 2. Track Character lifecycle
		this.player.CharacterAdded.Connect((char) => {
			this.watchContainer(char);
		});

		if (this.player.Character) {
			this.watchContainer(this.player.Character);
		}

		print("[ToolController] Initialized successfully. Auto-binding tool components.");
	}

	private watchContainer(container: Instance): void {
		container.ChildAdded.Connect((child) => {
			if (child.IsA("Tool")) {
				this.bindTool(child);
			}
		});

		for (const child of container.GetChildren()) {
			if (child.IsA("Tool")) {
				this.bindTool(child);
			}
		}
	}

	private bindTool(tool: Tool): void {
		if (this.activeComponents.has(tool)) return;

		let component: IToolComponent | undefined;

		if (tool.Name === "Smartphone") {
			component = new SmartphoneClientComponent(tool);
		} else if (tool.Name === "Skateboard") {
			component = new SkateboardClientComponent(tool);
		}

		if (component !== undefined) {
			this.activeComponents.set(tool, component);

			tool.Destroying.Connect(() => {
				this.activeComponents.get(tool)?.destroy();
				this.activeComponents.delete(tool);
			});
		}
	}
}
