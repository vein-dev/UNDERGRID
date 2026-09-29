/**
 * RollupDoorConfig - Configuration parameters for the stage roll-up door.
 */

export const ROLLUP_DOOR_CONFIG = {
	/** Name of the door part in Workspace */
	DOOR_NAME: "RollupDoorStage",

	/** Vertical travel distance in studs for opening */
	TRAVEL_DISTANCE_STUDS: 14.5,

	/** Animation duration in seconds */
	ANIMATION_DURATION: 2.4,

	/** Easing settings for smooth roll */
	EASING_STYLE: Enum.EasingStyle.Quad,
	EASING_DIRECTION: Enum.EasingDirection.InOut,

	/** Proximity Prompt configurations */
	PROMPT: {
		OBJECT_TEXT: "Stage Door",
		ACTION_OPEN: "Open",
		ACTION_CLOSE: "Close",
		HOLD_DURATION: 0.6,
		MAX_ACTIVATION_DISTANCE: 14,
		KEY_CODE: Enum.KeyCode.E,
		REQUIRES_LINE_OF_SIGHT: false,
	},

	/** Audio assets */
	SOUNDS: {
		OPEN: "rbxassetid://72893929956904",
		CLOSE: "rbxassetid://72893929956904",
		VOLUME: 1,
		ROLL_OFF_MAX_DISTANCE: 60,
	},
} as const;
