/**
 * ServerDrumstickService.ts
 * Layanan server otoritatif untuk manajemen equip/unequip Drumstick
 * dan pemasangan stick ke kedua tangan avatar pemain (Right Arm & Left Arm / RightHand & LeftHand).
 */

import { Players } from "@rbxts/services";
import { DrumstickConfig, isDrumstickTool } from "shared/config";

export class ServerDrumstickService {
	private static instance?: ServerDrumstickService;
	private trackedTools = new Map<Tool, RBXScriptConnection[]>();

	private constructor() {}

	public static getInstance(): ServerDrumstickService {
		if (!ServerDrumstickService.instance) {
			ServerDrumstickService.instance = new ServerDrumstickService();
		}
		return ServerDrumstickService.instance;
	}

	public init(): void {
		Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player));
		Players.PlayerRemoving.Connect((player) => this.onPlayerRemoving(player));

		for (const player of Players.GetPlayers()) {
			this.onPlayerAdded(player);
		}

		print("[ServerDrumstickService] Initialized successfully.");
	}

	private onPlayerAdded(player: Player): void {
		const trackContainer = (container: Instance) => {
			container.ChildAdded.Connect((child) => {
				if (child.IsA("Tool") && isDrumstickTool(child.Name)) {
					this.bindDrumstickTool(child);
				}
			});

			for (const child of container.GetChildren()) {
				if (child.IsA("Tool") && isDrumstickTool(child.Name)) {
					this.bindDrumstickTool(child);
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
		// Clean up references jika diperlukan
	}

	private bindDrumstickTool(tool: Tool): void {
		if (this.trackedTools.has(tool)) return;

		const connections: RBXScriptConnection[] = [];

		// Handle when Drumstick is equipped
		connections.push(
			tool.Equipped.Connect(() => {
				this.attachToHands(tool);
			}),
		);

		// Handle when Drumstick is unequipped
		connections.push(
			tool.Unequipped.Connect(() => {
				this.detachFromHands(tool);
			}),
		);

		// Clean up on destroy
		connections.push(
			tool.Destroying.Connect(() => {
				this.unbindDrumstickTool(tool);
			}),
		);

		this.trackedTools.set(tool, connections);

		// If tool is already inside character upon binding
		if (tool.Parent && tool.Parent.IsA("Model") && tool.Parent.FindFirstChildOfClass("Humanoid")) {
			this.attachToHands(tool);
		}
	}

	private unbindDrumstickTool(tool: Tool): void {
		const conns = this.trackedTools.get(tool);
		if (conns) {
			for (const conn of conns) {
				conn.Disconnect();
			}
			this.trackedTools.delete(tool);
		}
		this.detachFromHands(tool);
	}

	private attachToHands(tool: Tool): void {
		const character = tool.Parent as Model | undefined;
		if (!character || !character.IsA("Model")) return;

		const rightArm = (character.FindFirstChild("Right Arm") ?? character.FindFirstChild("RightHand")) as
			| BasePart
			| undefined;
		const leftArm = (character.FindFirstChild("Left Arm") ?? character.FindFirstChild("LeftHand")) as
			| BasePart
			| undefined;
		const torso = (character.FindFirstChild("Torso") ?? character.FindFirstChild("UpperTorso")) as
			| BasePart
			| undefined;

		const handle = tool.FindFirstChild("Handle") as BasePart | undefined;
		const rightStick = tool.FindFirstChild(DrumstickConfig.RIGHT_STICK_NAME) as BasePart | undefined;
		const leftStick = tool.FindFirstChild(DrumstickConfig.LEFT_STICK_NAME) as BasePart | undefined;

		if (!rightArm || !leftArm || !rightStick || !leftStick) return;

		// Clean up any default Roblox RightGrip weld on the right arm
		for (const child of rightArm.GetChildren()) {
			if (child.IsA("Weld") && (child.Name === "RightGrip" || child.Name === "Grip")) {
				child.Destroy();
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

		// Hapus weld lama ke Handle saat di-equip
		const initialRightWeld = rightStick.FindFirstChild("InitialRightWeld");
		if (initialRightWeld) initialRightWeld.Destroy();

		const initialLeftWeld = leftStick.FindFirstChild("InitialLeftWeld");
		if (initialLeftWeld) initialLeftWeld.Destroy();

		// 1. Pasang RightStick ke Right Arm / RightHand
		rightStick.CFrame = rightArm.CFrame.mul(DrumstickConfig.RIGHT_GRIP_OFFSET);
		let rightWeld = rightStick.FindFirstChild("RightHandWeld") as WeldConstraint | undefined;
		if (!rightWeld) {
			rightWeld = new Instance("WeldConstraint");
			rightWeld.Name = "RightHandWeld";
			rightWeld.Part0 = rightArm;
			rightWeld.Part1 = rightStick;
			rightWeld.Parent = rightStick;
		} else {
			rightWeld.Part0 = rightArm;
			rightWeld.Part1 = rightStick;
		}

		// 2. Pasang LeftStick ke Left Arm / LeftHand
		leftStick.CFrame = leftArm.CFrame.mul(DrumstickConfig.LEFT_GRIP_OFFSET);
		let leftWeld = leftStick.FindFirstChild("LeftHandWeld") as WeldConstraint | undefined;
		if (!leftWeld) {
			leftWeld = new Instance("WeldConstraint");
			leftWeld.Name = "LeftHandWeld";
			leftWeld.Part0 = leftArm;
			leftWeld.Part1 = leftStick;
			leftWeld.Parent = leftStick;
		} else {
			leftWeld.Part0 = leftArm;
			leftWeld.Part1 = leftStick;
		}

		// 3. Pasang Handle ke Torso atau Right Arm agar Handle tidak mengambang/tertinggal
		if (handle && torso) {
			handle.CFrame = torso.CFrame;
			let handleWeld = handle.FindFirstChild("TorsoWeld") as WeldConstraint | undefined;
			if (!handleWeld) {
				handleWeld = new Instance("WeldConstraint");
				handleWeld.Name = "TorsoWeld";
				handleWeld.Part0 = torso;
				handleWeld.Part1 = handle;
				handleWeld.Parent = handle;
			} else {
				handleWeld.Part0 = torso;
				handleWeld.Part1 = handle;
			}
		}

		print(`[ServerDrumstickService] Attached drumsticks to both hands of ${character.Name}`);
	}

	private detachFromHands(tool: Tool): void {
		const handle = tool.FindFirstChild("Handle") as BasePart | undefined;
		const rightStick = tool.FindFirstChild(DrumstickConfig.RIGHT_STICK_NAME) as BasePart | undefined;
		const leftStick = tool.FindFirstChild(DrumstickConfig.LEFT_STICK_NAME) as BasePart | undefined;

		// Lepas welds dari tangan
		if (rightStick) {
			const rightWeld = rightStick.FindFirstChild("RightHandWeld");
			if (rightWeld) rightWeld.Destroy();
		}

		if (leftStick) {
			const leftWeld = leftStick.FindFirstChild("LeftHandWeld");
			if (leftWeld) leftWeld.Destroy();
		}

		if (handle) {
			const torsoWeld = handle.FindFirstChild("TorsoWeld");
			if (torsoWeld) torsoWeld.Destroy();

			// Pasang kembali stick ke handle sebagai penyimpanan saat unequipped
			if (rightStick && !rightStick.FindFirstChild("InitialRightWeld")) {
				rightStick.CFrame = handle.CFrame;
				const weld = new Instance("WeldConstraint");
				weld.Name = "InitialRightWeld";
				weld.Part0 = handle;
				weld.Part1 = rightStick;
				weld.Parent = rightStick;
			}

			if (leftStick && !leftStick.FindFirstChild("InitialLeftWeld")) {
				leftStick.CFrame = handle.CFrame;
				const weld = new Instance("WeldConstraint");
				weld.Name = "InitialLeftWeld";
				weld.Part0 = handle;
				weld.Part1 = leftStick;
				weld.Parent = leftStick;
			}
		}
	}
}
