/**
 * ElevatorConfig - Configuration parameters for the elevator teleport system.
 */

export const ELEVATOR_CONFIG = {
	/** Spawn Part Names in Workspace */
	BASEMENT_SPAWN_NAME: "BasementSpawn",
	ROOFTOP_SPAWN_NAME: "RooftopSpawn",

	/** Elevator Door Part Paths in Workspace */
	BOTTOM_DOOR_PATH: ["ElevatorBottom", "ElevatorDoor", "ElevatorBottomDoor"],
	TOP_DOOR_PATH: ["ElevatorTop", "ElevatorDoor", "ElevatorTopDoor"],

	/** Proximity Prompt Settings */
	PROMPT: {
		NAME: "ElevatorPrompt",
		OBJECT_TEXT: "Elevator",
		ACTION_TO_ROOFTOP: "Go to Rooftop",
		ACTION_TO_BASEMENT: "Go to Basement",
		HOLD_DURATION: 0.5,
		MAX_ACTIVATION_DISTANCE: 10,
		KEY_CODE: Enum.KeyCode.E,
		REQUIRES_LINE_OF_SIGHT: false,
	},

	/** Teleport safety height offset above target spawn part in studs */
	VERTICAL_OFFSET: 3.5,

	/** Anti-spam cooldown per player in seconds */
	COOLDOWN_SECONDS: 1.5,
} as const;
