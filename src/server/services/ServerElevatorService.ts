import { Players, Workspace } from "@rbxts/services";
import { ELEVATOR_CONFIG } from "shared/config";

/**
 * ServerElevatorService - Authoritative server service managing elevator teleports
 * between the Basement and Rooftop spawn points via door ProximityPrompts.
 */
export class ServerElevatorService {
	private static instance?: ServerElevatorService;

	private lastTeleportTime = new Map<number, number>();

	private basementSpawn?: BasePart;
	private rooftopSpawn?: BasePart;
	private bottomDoor?: BasePart;
	private topDoor?: BasePart;

	private constructor() {}

	public static getInstance(): ServerElevatorService {
		if (!ServerElevatorService.instance) {
			ServerElevatorService.instance = new ServerElevatorService();
		}
		return ServerElevatorService.instance;
	}

	public init(): void {
		// Clean up cooldown memory when players leave
		Players.PlayerRemoving.Connect((player) => {
			this.lastTeleportTime.delete(player.UserId);
		});

		task.spawn(() => {
			this.setupElevatorSystem();
		});

		print("[ServerElevatorService] Initialized elevator teleport service.");
	}

	private setupElevatorSystem(): void {
		// 1. Locate spawn parts
		this.basementSpawn = this.findInstanceSafely<BasePart>(Workspace, [ELEVATOR_CONFIG.BASEMENT_SPAWN_NAME]);
		this.rooftopSpawn = this.findInstanceSafely<BasePart>(Workspace, [ELEVATOR_CONFIG.ROOFTOP_SPAWN_NAME]);

		// 2. Locate door parts
		this.bottomDoor = this.findInstanceSafely<BasePart>(Workspace, ELEVATOR_CONFIG.BOTTOM_DOOR_PATH);
		this.topDoor = this.findInstanceSafely<BasePart>(Workspace, ELEVATOR_CONFIG.TOP_DOOR_PATH);

		if (!this.basementSpawn) {
			warn(`[ServerElevatorService] Missing ${ELEVATOR_CONFIG.BASEMENT_SPAWN_NAME} in Workspace!`);
		}
		if (!this.rooftopSpawn) {
			warn(`[ServerElevatorService] Missing ${ELEVATOR_CONFIG.ROOFTOP_SPAWN_NAME} in Workspace!`);
		}

		// 3. Attach ProximityPrompts to doors
		if (this.bottomDoor) {
			this.attachPrompt(
				this.bottomDoor,
				ELEVATOR_CONFIG.PROMPT.ACTION_TO_ROOFTOP,
				() => this.rooftopSpawn,
				"Rooftop",
			);
		} else {
			warn(
				`[ServerElevatorService] Could not find bottom door at path: ${ELEVATOR_CONFIG.BOTTOM_DOOR_PATH.join(".")}`,
			);
		}

		if (this.topDoor) {
			this.attachPrompt(
				this.topDoor,
				ELEVATOR_CONFIG.PROMPT.ACTION_TO_BASEMENT,
				() => this.basementSpawn,
				"Basement",
			);
		} else {
			warn(`[ServerElevatorService] Could not find top door at path: ${ELEVATOR_CONFIG.TOP_DOOR_PATH.join(".")}`);
		}
	}

	/**
	 * Creates or configures a ProximityPrompt on the given door part.
	 */
	private attachPrompt(
		doorPart: BasePart,
		actionText: string,
		getTargetSpawn: () => BasePart | undefined,
		destinationName: string,
	): void {
		let prompt = doorPart.FindFirstChild(ELEVATOR_CONFIG.PROMPT.NAME) as ProximityPrompt | undefined;

		if (!prompt || !prompt.IsA("ProximityPrompt")) {
			prompt = new Instance("ProximityPrompt");
			prompt.Name = ELEVATOR_CONFIG.PROMPT.NAME;
		}

		prompt.ObjectText = ELEVATOR_CONFIG.PROMPT.OBJECT_TEXT;
		prompt.ActionText = actionText;
		prompt.HoldDuration = ELEVATOR_CONFIG.PROMPT.HOLD_DURATION;
		prompt.MaxActivationDistance = ELEVATOR_CONFIG.PROMPT.MAX_ACTIVATION_DISTANCE;
		prompt.KeyboardKeyCode = ELEVATOR_CONFIG.PROMPT.KEY_CODE;
		prompt.RequiresLineOfSight = ELEVATOR_CONFIG.PROMPT.REQUIRES_LINE_OF_SIGHT;
		prompt.Parent = doorPart;

		prompt.Triggered.Connect((player) => {
			const targetSpawn = getTargetSpawn();
			if (!targetSpawn) {
				warn(`[ServerElevatorService] Cannot teleport to ${destinationName}: Target spawn part not found.`);
				return;
			}
			this.teleportPlayer(player, targetSpawn, destinationName);
		});

		print(
			`[ServerElevatorService] Attached '${actionText}' ProximityPrompt to ${doorPart.GetFullName()} -> ${destinationName}.`,
		);
	}

	/**
	 * Authoritatively teleports a player to the target spawn location.
	 */
	private teleportPlayer(player: Player, targetPart: BasePart, destinationName: string): void {
		const now = os.clock();
		const lastTime = this.lastTeleportTime.get(player.UserId) ?? 0;

		// Anti-spam cooldown check
		if (now - lastTime < ELEVATOR_CONFIG.COOLDOWN_SECONDS) {
			return;
		}

		const character = player.Character;
		if (!character) return;

		const humanoid = character.FindFirstChildOfClass("Humanoid");
		const hrp = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

		if (!humanoid || humanoid.Health <= 0 || !hrp) {
			return;
		}

		this.lastTeleportTime.set(player.UserId, now);

		// Calculate target CFrame with vertical offset while preserving player rotation
		const targetPosition = new Vector3(
			targetPart.Position.X,
			targetPart.Position.Y + ELEVATOR_CONFIG.VERTICAL_OFFSET,
			targetPart.Position.Z,
		);
		const currentRotation = character.GetPivot().Rotation;
		const targetCFrame = new CFrame(targetPosition).mul(currentRotation);

		// Reset linear and angular velocities to prevent carries over
		hrp.AssemblyLinearVelocity = Vector3.zero;
		hrp.AssemblyAngularVelocity = Vector3.zero;

		character.PivotTo(targetCFrame);

		print(`[ServerElevatorService] Teleported ${player.Name} to ${destinationName}.`);
	}

	/**
	 * Helper to safely traverse hierarchy using WaitForChild with timeout.
	 */
	private findInstanceSafely<T extends Instance>(root: Instance, pathSegments: readonly string[]): T | undefined {
		let current: Instance | undefined = root;

		for (const segment of pathSegments) {
			if (!current) return undefined;
			let child = current.FindFirstChild(segment);
			if (!child) {
				child = current.WaitForChild(segment, 5);
			}
			current = child;
		}

		return current as T | undefined;
	}
}
