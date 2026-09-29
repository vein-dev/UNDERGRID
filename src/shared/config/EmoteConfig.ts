import { EmoteItem } from "shared/types";

export interface EmoteConfig {
	ReactionDuration: number;
	ReactionCooldown: number;
	ReactionBillboardOffset: Vector3;
	ReactionMaxDistance: number;
	Dances: EmoteItem[];
	Poses: EmoteItem[];
	Reactions: EmoteItem[];
}

export const EMOTE_CONFIG: EmoteConfig = {
	ReactionDuration: 2.5,
	ReactionCooldown: 1.0,
	ReactionBillboardOffset: new Vector3(0, 3.2, 0),
	ReactionMaxDistance: 70,

	Dances: [
		{
			id: "headbang",
			name: "Headbang",
			category: "Dance",
			animationId: "rbxassetid://115811243836422",
			description: "Headbang",
		},
		{
			id: "headbang_2",
			name: "Headbang 2",
			category: "Dance",
			animationId: "rbxassetid://87573617427753",
			description: "Headbang 2",
		},
		{
			id: "headbang_3",
			name: "Headbang 3",
			category: "Dance",
			animationId: "rbxassetid://71100151355042",
			description: "Headbang 3",
		},
		{
			id: "headbang_4",
			name: "Headbang 4",
			category: "Dance",
			animationId: "rbxassetid://70436976834407",
			description: "Headbang 4",
		},
		{
			id: "afro_beat",
			name: "Afro Beat",
			category: "Dance",
			animationId: "rbxassetid://119082464915666",
			description: "Afro Beat",
		},
		{
			id: "afro_beat_2",
			name: "Afro Beat 2",
			category: "Dance",
			animationId: "rbxassetid://84395077255209",
			description: "Afro Beat 2",
		},
		{
			id: "aura_farming",
			name: "Aura Farming",
			category: "Dance",
			animationId: "rbxassetid://138415280000308",
			description: "Aura Farming",
		},
		{
			id: "club",
			name: "Club",
			category: "Dance",
			animationId: "rbxassetid://99791281219189",
			description: "Club",
		},
		{
			id: "club_2",
			name: "Club 2",
			category: "Dance",
			animationId: "rbxassetid://75350969455454",
			description: "Club 2",
		},
		{
			id: "club_3",
			name: "Club 3",
			category: "Dance",
			animationId: "rbxassetid://88305628346060",
			description: "Club 3",
		},
		{
			id: "cute",
			name: "Cute",
			category: "Dance",
			animationId: "rbxassetid://136211077148241",
			description: "Cute",
		},
		{
			id: "drum",
			name: "Drum",
			category: "Dance",
			animationId: "rbxassetid://71961418473445",
			description: "Drum",
		},
		{
			id: "guitar",
			name: "Guitar",
			category: "Dance",
			animationId: "rbxassetid://86231853800188",
			description: "Guitar",
		},
		{
			id: "guitar_2",
			name: "Guitar 2",
			category: "Dance",
			animationId: "rbxassetid://87611876270730",
			description: "Guitar 2",
		},
		{
			id: "guitar_3",
			name: "Guitar 3",
			category: "Dance",
			animationId: "rbxassetid://85764998378014",
			description: "Guitar 3",
		},
		{
			id: "jamal_groove",
			name: "Jamal Groove",
			category: "Dance",
			animationId: "rbxassetid://119774146582647",
			description: "Jamal Groove",
		},
		{
			id: "kicau_mania",
			name: "Kicau Mania",
			category: "Dance",
			animationId: "rbxassetid://133082075993432",
			description: "Kicau Mania",
		},
		{
			id: "mystical",
			name: "Mystical",
			category: "Dance",
			animationId: "rbxassetid://113998852158957",
			description: "Mystical",
		},
		{
			id: "pikiranku",
			name: "Pikiranku",
			category: "Dance",
			animationId: "rbxassetid://84218863081720",
			description: "Pikiranku",
		},
		{
			id: "rakai",
			name: "Rakai",
			category: "Dance",
			animationId: "rbxassetid://113325039007208",
			description: "Rakai",
		},
		{
			id: "reggae",
			name: "Reggae",
			category: "Dance",
			animationId: "rbxassetid://73516860500046",
			description: "Reggae",
		},
		{
			id: "ska",
			name: "Ska",
			category: "Dance",
			animationId: "rbxassetid://112582598050091",
			description: "Ska",
		},
		{
			id: "sway",
			name: "Sway",
			category: "Dance",
			animationId: "rbxassetid://79306819945179",
			description: "Sway",
		},
		{
			id: "two_step",
			name: "Two Step",
			category: "Dance",
			animationId: "rbxassetid://76074206088570",
			description: "Two Step",
		},
		{
			id: "urban",
			name: "Urban",
			category: "Dance",
			animationId: "rbxassetid://89787425028432",
			description: "Urban",
		},
		{
			id: "vibe_flow",
			name: "Vibe Flow",
			category: "Dance",
			animationId: "rbxassetid://135974934723253",
			description: "Vibe Flow",
		},
		{
			id: "vibing",
			name: "Vibing",
			category: "Dance",
			animationId: "rbxassetid://108470234177505",
			description: "Vibing",
		},
		{
			id: "vibing_2",
			name: "Vibing 2",
			category: "Dance",
			animationId: "rbxassetid://72972447879639",
			description: "Vibing 2",
		},
		{
			id: "vibing_3",
			name: "Vibing 3",
			category: "Dance",
			animationId: "rbxassetid://125165259060596",
			description: "Vibing 3",
		},
	],

	Poses: [
		{
			id: "pose_crossed",
			name: "Crossed Arms",
			category: "Pose",
			animationId: "rbxassetid://182435998",
			description: "Melipat kedua tangan di dada",
		},
	],

	Reactions: [
		{ id: "react_laugh", name: "Tertawa", category: "Reaction", icon: "😂" },
		{ id: "react_fire", name: "Semangat", category: "Reaction", icon: "🔥" },
		{ id: "react_love", name: "Cinta", category: "Reaction", icon: "❤️" },
		{ id: "react_skull", name: "Mati Gaya", category: "Reaction", icon: "💀" },
		{ id: "react_cool", name: "Keren", category: "Reaction", icon: "😎" },
		{ id: "react_party", name: "Pesta", category: "Reaction", icon: "🎉" },
		{ id: "react_thumbsup", name: "Mantap", category: "Reaction", icon: "👍" },
		{ id: "react_pleading", name: "Tolong", category: "Reaction", icon: "🥺" },
		{ id: "react_angry", name: "Marah", category: "Reaction", icon: "😡" },
		{ id: "react_question", name: "Bingung", category: "Reaction", icon: "❓" },
		{ id: "react_lightning", name: "Petir", category: "Reaction", icon: "⚡" },
		{ id: "react_diamond", name: "Sultan", category: "Reaction", icon: "💎" },
		{ id: "react_sleep", name: "Ngantuk", category: "Reaction", icon: "💤" },
		{ id: "react_clap", name: "Tepuk Tangan", category: "Reaction", icon: "👏" },
		{ id: "react_wave", name: "Halo", category: "Reaction", icon: "👋" },
		{ id: "react_100", name: "Sempurna", category: "Reaction", icon: "💯" },
	],
};
