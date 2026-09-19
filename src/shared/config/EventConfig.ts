import { EventData } from "shared/types";

/**
 * Default events loaded into the Event Ticketing App.
 * Poster images use placeholder asset IDs (rbxassetid://0).
 */
export const DEFAULT_EVENTS: EventData[] = [
	{
		id: "evt_grand_opening",
		title: "Grand Opening Undergrid",
		category: "Music & Concert",
		dateText: "Saturday, Oct 24, 2026",
		timeText: "20:00 - 23:30 GMT+7",
		locationText: "Starlight Main Stage",
		priceText: "FREE ENTRY",
		posterAssetId: "rbxassetid://0",
		description:
			"Get ready for an electrifying night featuring the finest EDM and synthwave DJs! Experience immersive audio-reactive stage lights, exclusive festival glow gear, and special guest performances. Bring your squad and light up the dance floor!",
		organizerName: "Undergrid Collective",
		goingUserIds: [],
		interestedUserIds: [],
	},
	{
		id: "evt_art_showcase_vol_1",
		title: "Undergird Exibition Vol.1",
		category: "Art",
		dateText: "Sunday, Nov 1, 2026",
		timeText: "19:00 - 21:00 GMT+7",
		locationText: "Art Gallery",
		priceText: "FREE ENTRY",
		posterAssetId: "rbxassetid://0",
		description:
			"The ultimate racing showdown! 16 drivers compete across 3 intense circuit tracks. Spectator bleachers feature dynamic multi-angle camera feeds, pit-stop mini-games, and live commentary. RSVP now to reserve your VIP paddock access.",
		organizerName: "Undergrid Collective",
		goingUserIds: [],
		interestedUserIds: [],
	},
];
