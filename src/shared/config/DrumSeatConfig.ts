/**
 * DrumSeatConfig - Configuration for Drum Throne seats and drum playing animations.
 */

export interface DrumBeatItem {
	readonly id: string;
	readonly name: string;
	readonly animationId: string;
}

export const DRUM_SEAT_CONFIG = {
	/** CollectionService tag for the drum throne seat */
	TAG: "drum_seat",

	/** Default drum playing pose ID */
	DEFAULT_BEAT_ID: "drum_beat_1",

	/** Available drum playing animations/beats */
	BEATS: [
		{
			id: "drum_beat_1",
			name: "Drum 1",
			animationId: "rbxassetid://71961418473445",
		},
		{
			id: "drum_beat_2",
			name: "Drum 2",
			animationId: "rbxassetid://102343219307610",
		},
	] as readonly DrumBeatItem[],

	/** Priority to cleanly override default sit animation */
	ANIMATION_PRIORITY: Enum.AnimationPriority.Action4,

	/** Fade duration for transition in and out */
	FADE_TIME: 0.25,
} as const;
