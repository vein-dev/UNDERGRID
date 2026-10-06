import { Players, Workspace } from "@rbxts/services";
import { isPlayerAdmin, ROOFTOP_DOOR_CONFIG } from "shared/config";
import { getRemoteEvent } from "shared/network";
import { RollupDoorSyncData } from "shared/types";

/**
 * RooftopDoorController - Client controller for the admin-only rooftop roll-up door.
 * - Creates the ProximityPrompt locally, only if the local player is an Admin.
 * - Updates prompt text/state from server sync data.
 * - Sends toggle requests to ServerRooftopDoorService (re-validated on the server).
 */
export class RooftopDoorController {
	private static instance?: RooftopDoorController;
	private player = Players.LocalPlayer;

	private toggleEvent: RemoteEvent;
	private syncEvent: RemoteEvent;

	private prompt?: ProximityPrompt;
	private promptAnchor?: BasePart;
	private isOpen = false;

	private constructor() {
		this.toggleEvent = getRemoteEvent("RooftopDoorToggleEvent");
		this.syncEvent = getRemoteEvent("RooftopDoorSyncEvent");
	}

	public static getInstance(): RooftopDoorController {
		if (!RooftopDoorController.instance) {
			RooftopDoorController.instance = new RooftopDoorController();
		}
		return RooftopDoorController.instance;
	}

	public init(): void {
		if (!isPlayerAdmin(this.player)) return;

		task.spawn(() => {
			const container = Workspace.WaitForChild(ROOFTOP_DOOR_CONFIG.CONTAINER_NAME, 10);
			const door = container?.WaitForChild(ROOFTOP_DOOR_CONFIG.DOOR_NAME, 10);
			if (door && door.IsA("BasePart")) {
				this.setupAdminPrompt(door);
				this.syncEvent.FireServer("RequestSync");
			} else {
				warn(`[RooftopDoorController] Could not find ${ROOFTOP_DOOR_CONFIG.DOOR_NAME} in Workspace.`);
			}
		});

		this.syncEvent.OnClientEvent.Connect((data: unknown) => {
			if (typeIs(data, "table")) {
				this.applySyncData(data as unknown as RollupDoorSyncData);
			}
		});
	}

	private setupAdminPrompt(door: BasePart): void {
		this.promptAnchor?.Destroy();

		// World-space half height of the door (the mesh is rotated)
		const cf = door.CFrame;
		const size = door.Size;
		const halfHeight =
			(math.abs(cf.RightVector.Y) * size.X + math.abs(cf.UpVector.Y) * size.Y + math.abs(cf.LookVector.Y) * size.Z) /
			2;
		const bottomY = door.Position.Y - halfHeight;

		// Static anchor (not attached to the door) so the prompt stays reachable while the door is open
		const anchor = new Instance("Part");
		anchor.Name = "RooftopDoorPromptAnchor";
		anchor.Size = new Vector3(1, 1, 1);
		anchor.Position = new Vector3(door.Position.X, bottomY + ROOFTOP_DOOR_CONFIG.PROMPT_HEIGHT_OFFSET, door.Position.Z);
		anchor.Transparency = 1;
		anchor.CanCollide = false;
		anchor.CanTouch = false;
		anchor.CanQuery = false;
		anchor.Anchored = true;
		anchor.Parent = Workspace;
		this.promptAnchor = anchor;

		const prompt = new Instance("ProximityPrompt");
		prompt.Name = "AdminRooftopDoorPrompt";
		prompt.ObjectText = ROOFTOP_DOOR_CONFIG.PROMPT.OBJECT_TEXT;
		prompt.ActionText = this.isOpen ? ROOFTOP_DOOR_CONFIG.PROMPT.ACTION_CLOSE : ROOFTOP_DOOR_CONFIG.PROMPT.ACTION_OPEN;
		prompt.HoldDuration = ROOFTOP_DOOR_CONFIG.PROMPT.HOLD_DURATION;
		prompt.MaxActivationDistance = ROOFTOP_DOOR_CONFIG.PROMPT.MAX_ACTIVATION_DISTANCE;
		prompt.KeyboardKeyCode = ROOFTOP_DOOR_CONFIG.PROMPT.KEY_CODE;
		prompt.RequiresLineOfSight = ROOFTOP_DOOR_CONFIG.PROMPT.REQUIRES_LINE_OF_SIGHT;
		prompt.Exclusivity = Enum.ProximityPromptExclusivity.OnePerButton;
		prompt.Parent = anchor;
		this.prompt = prompt;

		prompt.Triggered.Connect(() => {
			if (this.prompt?.Enabled) {
				this.toggleEvent.FireServer();
			}
		});
	}

	private applySyncData(data: RollupDoorSyncData): void {
		this.isOpen = data.isOpen;
		if (!this.prompt) return;

		if (data.state === "Opening" || data.state === "Closing") {
			this.prompt.Enabled = false;
		} else {
			this.prompt.Enabled = true;
			this.prompt.ActionText = this.isOpen
				? ROOFTOP_DOOR_CONFIG.PROMPT.ACTION_CLOSE
				: ROOFTOP_DOOR_CONFIG.PROMPT.ACTION_OPEN;
		}
	}
}
