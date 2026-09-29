import { Players, TweenService, Workspace } from "@rbxts/services";
import { isPlayerAdmin, ROLLUP_DOOR_CONFIG } from "shared/config";
import { getRemoteEvent } from "shared/network";
import { RollupDoorState, RollupDoorSyncData } from "shared/types";

/**
 * ServerRollupDoorService - Authoritative server service managing the stage roll-up door.
 * - Handles admin authorization for toggling the door.
 * - Controls smooth CFrame tweening, collision states, and sound effects.
 * - Synchronizes door status across all connected clients.
 */
export class ServerRollupDoorService {
	private static instance?: ServerRollupDoorService;

	private doorPart?: BasePart;
	private closedCFrame?: CFrame;
	private openedCFrame?: CFrame;

	private isOpen = false;
	private isBusy = false;
	private currentState: RollupDoorState = "Closed";

	private toggleEvent: RemoteEvent;
	private syncEvent: RemoteEvent;
	private doorSound?: Sound;

	private constructor() {
		this.toggleEvent = getRemoteEvent("RollupDoorToggleEvent");
		this.syncEvent = getRemoteEvent("RollupDoorSyncEvent");
	}

	public static getInstance(): ServerRollupDoorService {
		if (!ServerRollupDoorService.instance) {
			ServerRollupDoorService.instance = new ServerRollupDoorService();
		}
		return ServerRollupDoorService.instance;
	}

	public init(): void {
		// Locate the door model / part in Workspace
		const found = Workspace.FindFirstChild(ROLLUP_DOOR_CONFIG.DOOR_NAME) as BasePart | undefined;
		if (found && found.IsA("BasePart")) {
			this.setupDoor(found);
		} else {
			task.spawn(() => {
				const door = Workspace.WaitForChild(ROLLUP_DOOR_CONFIG.DOOR_NAME, 10) as BasePart | undefined;
				if (door && door.IsA("BasePart")) {
					this.setupDoor(door);
				} else {
					warn(`[ServerRollupDoorService] Could not find ${ROLLUP_DOOR_CONFIG.DOOR_NAME} in Workspace.`);
				}
			});
		}

		// Listen for Admin Toggle requests
		this.toggleEvent.OnServerEvent.Connect((player) => {
			this.handleToggleRequest(player);
		});

		// Sync initial state to newly joined players
		Players.PlayerAdded.Connect((player) => {
			this.syncToPlayer(player);
		});

		// Listen for sync requests from clients
		this.syncEvent.OnServerEvent.Connect((player, action) => {
			if (action === "RequestSync") {
				this.syncToPlayer(player);
			}
		});

		print("[ServerRollupDoorService] Initialized successfully with authoritative door controls.");
	}

	private setupDoor(part: BasePart): void {
		this.doorPart = part;
		this.doorPart.Anchored = true;
		this.doorPart.CanCollide = true;

		this.closedCFrame = part.CFrame;
		this.openedCFrame = this.closedCFrame.add(new Vector3(0, ROLLUP_DOOR_CONFIG.TRAVEL_DISTANCE_STUDS, 0));

		// Setup audio instance attached to door
		this.doorSound = new Instance("Sound");
		this.doorSound.Name = "RollupDoorSound";
		this.doorSound.Volume = ROLLUP_DOOR_CONFIG.SOUNDS.VOLUME;
		this.doorSound.RollOffMaxDistance = ROLLUP_DOOR_CONFIG.SOUNDS.ROLL_OFF_MAX_DISTANCE;
		this.doorSound.Parent = this.doorPart;

		print(
			`[ServerRollupDoorService] Door ${part.Name} registered. Closed CFrame: ${this.closedCFrame.Position}, Open Target: ${this.openedCFrame.Position}`,
		);
	}

	private handleToggleRequest(player: Player): void {
		if (!isPlayerAdmin(player)) {
			warn(`[ServerRollupDoorService] Unauthorized door toggle attempt by ${player.Name} (${player.UserId})`);
			return;
		}

		if (this.isBusy || !this.doorPart || !this.closedCFrame || !this.openedCFrame) {
			return;
		}

		this.toggleDoor();
	}

	public toggleDoor(): void {
		if (this.isBusy || !this.doorPart || !this.closedCFrame || !this.openedCFrame) return;

		this.isBusy = true;
		const targetOpen = !this.isOpen;
		const targetCFrame = targetOpen ? this.openedCFrame : this.closedCFrame;
		this.currentState = targetOpen ? "Opening" : "Closing";

		// Play motorized roll sound
		if (this.doorSound) {
			const rawSound = targetOpen ? ROLLUP_DOOR_CONFIG.SOUNDS.OPEN : ROLLUP_DOOR_CONFIG.SOUNDS.CLOSE;
			this.doorSound.SoundId = this.formatSoundId(rawSound);
			this.doorSound.Play();
		}

		// When opening, disable collision halfway so players can walk through seamlessly
		if (targetOpen) {
			task.delay(0.5, () => {
				if (this.doorPart) {
					this.doorPart.CanCollide = false;
				}
			});
		}

		this.broadcastSync();

		const tweenInfo = new TweenInfo(
			ROLLUP_DOOR_CONFIG.ANIMATION_DURATION,
			ROLLUP_DOOR_CONFIG.EASING_STYLE,
			ROLLUP_DOOR_CONFIG.EASING_DIRECTION,
		);

		const tween = TweenService.Create(this.doorPart, tweenInfo, {
			CFrame: targetCFrame,
		});

		tween.Completed.Connect((playbackState) => {
			if (playbackState === Enum.PlaybackState.Completed) {
				this.isOpen = targetOpen;
				this.currentState = this.isOpen ? "Open" : "Closed";
				this.isBusy = false;

				// If now closed, ensure collision is restored
				if (!this.isOpen && this.doorPart) {
					this.doorPart.CanCollide = true;
				}

				this.broadcastSync();
				print(`[ServerRollupDoorService] Door is now ${this.currentState}.`);
			}
		});

		tween.Play();
	}

	private getSyncPayload(): RollupDoorSyncData {
		return {
			isOpen: this.isOpen,
			state: this.currentState,
			timestamp: Workspace.GetServerTimeNow(),
		};
	}

	private broadcastSync(): void {
		const payload = this.getSyncPayload();
		this.syncEvent.FireAllClients(payload);
	}

	private syncToPlayer(player: Player): void {
		const payload = this.getSyncPayload();
		this.syncEvent.FireClient(player, payload);
	}

	public getIsOpen(): boolean {
		return this.isOpen;
	}

	public getState(): RollupDoorState {
		return this.currentState;
	}

	private formatSoundId(id: string): string {
		const trimmed = id.gsub("%s+", "")[0];
		if (trimmed.match("^%d+$")[0]) {
			return `rbxassetid://${trimmed}`;
		}
		if (trimmed.sub(1, 11) === "rbxasset://" && !trimmed.sub(12).find("/")) {
			const num = trimmed.sub(12);
			if (num.match("^%d+$")[0]) {
				return `rbxassetid://${num}`;
			}
		}
		return trimmed;
	}
}
