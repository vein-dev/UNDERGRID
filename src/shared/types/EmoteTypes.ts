/**
 * EmoteTypes - Defines data structures for the Emote and Emoticon Reaction System.
 */

export type EmoteCategory = "Dance" | "Pose" | "Reaction";

export interface EmoteItem {
	id: string;
	name: string;
	category: EmoteCategory;
	icon?: string;
	animationId?: string;
	color?: Color3;
	description?: string;
}

export interface ReactionPayload {
	senderUserId: number;
	emoji: string;
	duration: number;
}
