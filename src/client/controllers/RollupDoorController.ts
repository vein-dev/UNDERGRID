import { Players, Workspace } from "@rbxts/services";
import { isPlayerAdmin, ROLLUP_DOOR_CONFIG } from "shared/config";
import { getRemoteEvent } from "shared/network";
import { RollupDoorSyncData } from "shared/types";

/**
 * RollupDoorController - Client controller managing admin-only interaction with the stage roll-up door.
 * - Only instantiates and displays ProximityPrompt if the local player is an Admin.
 * - Dynamically updates prompt text ("Buka Pintu Roll Up" vs "Tutup Pintu Roll Up").
 * - Communicates with ServerRollupDoorService via RemoteEvents.
 */
export class RollupDoorController {
	private static instance?: RollupDoorController;
	private player = Players.LocalPlayer;

	private toggleEvent: RemoteEvent;
	private syncEvent: RemoteEvent;

	private prompt?: ProximityPrompt;
	private promptAnchor?: BasePart;
	private isOpen = false;

	private constructor() {
		this.toggleEvent = getRemoteEvent("RollupDoorToggleEvent");
		this.syncEvent = getRemoteEvent("RollupDoorSyncEvent");
	}

	public static getInstance(): RollupDoorController {
		if (!RollupDoorController.instance) {
			RollupDoorController.instance = new RollupDoorController();
		}
		return RollupDoorController.instance;
	}

	public init(): void {
		// Strictly check if LocalPlayer is an Admin
		if (!isPlayerAdmin(this.player)) {
			// Non-admin players will never see or interact with the proximity prompt
			print("[RollupDoorController] Local player is not admin. Rollup door interaction disabled.");
			return;
		}

		// Locate door in Workspace
		task.spawn(() => {
			const door = Workspace.WaitForChild(ROLLUP_DOOR_CONFIG.DOOR_NAME, 10) as BasePart | undefined;
			if (door && door.IsA("BasePart")) {
				this.setupAdminPrompt(door);
			} else {
				warn(`[RollupDoorController] Could not find ${ROLLUP_DOOR_CONFIG.DOOR_NAME} in Workspace.`);
			}
		});

		// Listen for door state synchronization from server
		this.syncEvent.OnClientEvent.Connect((data: unknown) => {
			if (typeIs(data, "table")) {
				this.applySyncData(data as unknown as RollupDoorSyncData);
			}
		});

		// Request initial state from server
		this.syncEvent.FireServer("RequestSync");

		print("[RollupDoorController] Initialized successfully for admin player.");
	}

	private setupAdminPrompt(door: BasePart): void {
		// Clean up existing prompt anchor if any
		if (this.promptAnchor) {
			this.promptAnchor.Destroy();
		}

		// Create static anchor part at chest level so prompt is reachable when door is both open & closed
		const anchor = new Instance("Part");
		anchor.Name = "RollupDoorPromptAnchor";
		anchor.Size = new Vector3(1, 1, 1);
		// Y = -15.5 is chest level between floor (-19.8) and door top (-2.9)
		anchor.Position = new Vector3(door.Position.X, -15.5, door.Position.Z);
		anchor.Transparency = 1;
		anchor.CanCollide = false;
		anchor.CanTouch = false;
		anchor.CanQuery = false;
		anchor.Anchored = true;
		anchor.Parent = door.Parent ?? Workspace;
		this.promptAnchor = anchor;

		// Create ProximityPrompt
		const prompt = new Instance("ProximityPrompt");
		prompt.Name = "AdminRollupDoorPrompt";
		prompt.ObjectText = ROLLUP_DOOR_CONFIG.PROMPT.OBJECT_TEXT;
		prompt.ActionText = this.isOpen
			? ROLLUP_DOOR_CONFIG.PROMPT.ACTION_CLOSE
			: ROLLUP_DOOR_CONFIG.PROMPT.ACTION_OPEN;
		prompt.HoldDuration = ROLLUP_DOOR_CONFIG.PROMPT.HOLD_DURATION;
		prompt.MaxActivationDistance = ROLLUP_DOOR_CONFIG.PROMPT.MAX_ACTIVATION_DISTANCE;
		prompt.KeyboardKeyCode = ROLLUP_DOOR_CONFIG.PROMPT.KEY_CODE;
		prompt.RequiresLineOfSight = ROLLUP_DOOR_CONFIG.PROMPT.REQUIRES_LINE_OF_SIGHT;
		prompt.Exclusivity = Enum.ProximityPromptExclusivity.OnePerButton;
		prompt.Parent = this.promptAnchor;
		this.prompt = prompt;

		prompt.Triggered.Connect(() => {
			this.onPromptTriggered();
		});

		print("[RollupDoorController] Admin ProximityPrompt registered successfully on door anchor.");
	}

	private onPromptTriggered(): void {
		if (!this.prompt || !this.prompt.Enabled) return;
		this.toggleEvent.FireServer();
	}

	private applySyncData(data: RollupDoorSyncData): void {
		if (!data) return;

		this.isOpen = data.isOpen;

		if (!this.prompt) return;

		if (data.state === "Opening" || data.state === "Closing") {
			// Temporarily disable prompt while door is in motion
			this.prompt.Enabled = false;
		} else {
			this.prompt.Enabled = true;
			this.prompt.ActionText = this.isOpen
				? ROLLUP_DOOR_CONFIG.PROMPT.ACTION_CLOSE
				: ROLLUP_DOOR_CONFIG.PROMPT.ACTION_OPEN;
		}
	}
}
