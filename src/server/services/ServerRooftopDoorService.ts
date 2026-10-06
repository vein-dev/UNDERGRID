import { Players, TweenService, Workspace } from "@rbxts/services";
import { isPlayerAdmin, ROOFTOP_DOOR_CONFIG } from "shared/config";
import { getRemoteEvent } from "shared/network";
import { RollupDoorState, RollupDoorSyncData } from "shared/types";

/**
 * ServerRooftopDoorService - Authoritative server service for the admin-only rooftop roll-up door.
 * - Validates that only admins can toggle the door.
 * - Rolls the door up into its housing (shrinks height, top edge fixed), manages collision and sound.
 * - Synchronizes door state to all clients (used to update the prompt text).
 */
export class ServerRooftopDoorService {
	private static instance?: ServerRooftopDoorService;

	private doorPart?: BasePart;
	private closedCFrame?: CFrame;
	private openedCFrame?: CFrame;
	private closedSize?: Vector3;
	private openedSize?: Vector3;

	private isOpen = false;
	private isBusy = false;
	private currentState: RollupDoorState = "Closed";

	private toggleEvent: RemoteEvent;
	private syncEvent: RemoteEvent;
	private doorSound?: Sound;

	private constructor() {
		this.toggleEvent = getRemoteEvent("RooftopDoorToggleEvent");
		this.syncEvent = getRemoteEvent("RooftopDoorSyncEvent");
	}

	public static getInstance(): ServerRooftopDoorService {
		if (!ServerRooftopDoorService.instance) {
			ServerRooftopDoorService.instance = new ServerRooftopDoorService();
		}
		return ServerRooftopDoorService.instance;
	}

	public init(): void {
		task.spawn(() => {
			const container = Workspace.WaitForChild(ROOFTOP_DOOR_CONFIG.CONTAINER_NAME, 10);
			const door = container?.WaitForChild(ROOFTOP_DOOR_CONFIG.DOOR_NAME, 10);
			if (door && door.IsA("BasePart")) {
				this.setupDoor(door);
			} else {
				warn(`[ServerRooftopDoorService] Could not find ${ROOFTOP_DOOR_CONFIG.DOOR_NAME} in Workspace.`);
			}
		});

		this.toggleEvent.OnServerEvent.Connect((player) => this.handleToggleRequest(player));

		Players.PlayerAdded.Connect((player) => this.syncToPlayer(player));

		this.syncEvent.OnServerEvent.Connect((player, action) => {
			if (action === "RequestSync") {
				this.syncToPlayer(player);
			}
		});

		print("[ServerRooftopDoorService] Initialized successfully.");
	}

	private setupDoor(part: BasePart): void {
		this.doorPart = part;
		part.Anchored = true;
		part.CanCollide = true;

		const rolled = this.computeRolledState(part);
		this.closedCFrame = part.CFrame;
		this.closedSize = part.Size;
		this.openedCFrame = rolled.cframe;
		this.openedSize = rolled.size;

		const sound = new Instance("Sound");
		sound.Name = "RooftopDoorSound";
		sound.Volume = ROOFTOP_DOOR_CONFIG.SOUNDS.VOLUME;
		sound.RollOffMaxDistance = ROOFTOP_DOOR_CONFIG.SOUNDS.ROLL_OFF_MAX_DISTANCE;
		sound.Parent = part;
		this.doorSound = sound;
	}

	private handleToggleRequest(player: Player): void {
		if (!isPlayerAdmin(player)) {
			warn(`[ServerRooftopDoorService] Unauthorized door toggle attempt by ${player.Name} (${player.UserId})`);
			return;
		}
		this.toggleDoor();
	}

	public toggleDoor(): void {
		if (
			this.isBusy ||
			!this.doorPart ||
			!this.closedCFrame ||
			!this.openedCFrame ||
			!this.closedSize ||
			!this.openedSize
		) {
			return;
		}

		this.isBusy = true;
		const targetOpen = !this.isOpen;
		const targetCFrame = targetOpen ? this.openedCFrame : this.closedCFrame;
		const targetSize = targetOpen ? this.openedSize : this.closedSize;
		this.currentState = targetOpen ? "Opening" : "Closing";

		if (this.doorSound) {
			this.doorSound.SoundId = targetOpen
				? ROOFTOP_DOOR_CONFIG.SOUNDS.OPEN
				: ROOFTOP_DOOR_CONFIG.SOUNDS.CLOSE;
			this.doorSound.Play();
		}

		// When opening, disable collision halfway so players can walk through
		if (targetOpen) {
			task.delay(ROOFTOP_DOOR_CONFIG.ANIMATION_DURATION / 2, () => {
				if (this.doorPart && this.isBusy) {
					this.doorPart.CanCollide = false;
				}
			});
		}

		this.broadcastSync();

		const tween = TweenService.Create(
			this.doorPart,
			new TweenInfo(
				ROOFTOP_DOOR_CONFIG.ANIMATION_DURATION,
				ROOFTOP_DOOR_CONFIG.EASING_STYLE,
				ROOFTOP_DOOR_CONFIG.EASING_DIRECTION,
			),
			{ CFrame: targetCFrame, Size: targetSize },
		);

		tween.Completed.Connect((playbackState) => {
			if (playbackState !== Enum.PlaybackState.Completed) return;

			this.isOpen = targetOpen;
			this.currentState = targetOpen ? "Open" : "Closed";
			this.isBusy = false;

			if (!this.isOpen && this.doorPart) {
				this.doorPart.CanCollide = true;
			}

			this.broadcastSync();
		});

		tween.Play();
	}

	/**
	 * Returns the size and CFrame of the door when fully rolled up.
	 * The door's vertical axis (the local axis most aligned with world Y) is shrunk
	 * while the top edge stays fixed, mimicking a shutter rolling into its housing.
	 */
	private computeRolledState(part: BasePart): { size: Vector3; cframe: CFrame } {
		const cf = part.CFrame;
		const size = part.Size;
		const alignX = math.abs(cf.RightVector.Y);
		const alignY = math.abs(cf.UpVector.Y);
		const alignZ = math.abs(cf.LookVector.Y);

		const rolled = ROOFTOP_DOOR_CONFIG.ROLLED_HEIGHT_STUDS;
		let fullHeight = size.Z;
		let rolledSize = new Vector3(size.X, size.Y, rolled);
		if (alignX >= alignY && alignX >= alignZ) {
			fullHeight = size.X;
			rolledSize = new Vector3(rolled, size.Y, size.Z);
		} else if (alignY >= alignZ) {
			fullHeight = size.Y;
			rolledSize = new Vector3(size.X, rolled, size.Z);
		}

		return {
			size: rolledSize,
			cframe: cf.add(new Vector3(0, (fullHeight - rolled) / 2, 0)),
		};
	}

	private getSyncPayload(): RollupDoorSyncData {
		return {
			isOpen: this.isOpen,
			state: this.currentState,
			timestamp: Workspace.GetServerTimeNow(),
		};
	}

	private broadcastSync(): void {
		this.syncEvent.FireAllClients(this.getSyncPayload());
	}

	private syncToPlayer(player: Player): void {
		this.syncEvent.FireClient(player, this.getSyncPayload());
	}
}
