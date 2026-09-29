/**
 * SeatConfig - Configuration for seats and custom sit animations.
 */

export interface SitPoseItem {
	readonly id: string;
	readonly name: string;
	readonly animationId: string;
	readonly icon?: string;
}

export const SEAT_CONFIG = {
	/** CollectionService tag for custom animated seats */
	TAG: "seat",

	/** Default selected pose ID */
	DEFAULT_POSE_ID: "pose_1",

	/** Available sit poses list */
	POSES: [
		{
			id: "pose_1",
			name: "Pose 1",
			animationId: "rbxassetid://129069298051425",
		},
		{
			id: "pose_2",
			name: "Pose 2",
			animationId: "rbxassetid://96180643659743",
		},
		{
			id: "pose_3",
			name: "Pose 3",
			animationId: "rbxassetid://77714086840663",
		},
		{
			id: "pose_4",
			name: "Pose 4",
			animationId: "rbxassetid://130355781301070",
		},
		{
			id: "pose_5",
			name: "Pose 5",
			animationId: "rbxassetid://124634232157047",
		},
	] as readonly SitPoseItem[],

	/** Default animation ID for backward compatibility */
	ANIMATION_ID: "rbxassetid://129069298051425",

	/** Priority to cleanly override default Roblox sit pose */
	ANIMATION_PRIORITY: Enum.AnimationPriority.Action4,

	/** Fade duration for transition in and out */
	FADE_TIME: 0.25,
} as const;
