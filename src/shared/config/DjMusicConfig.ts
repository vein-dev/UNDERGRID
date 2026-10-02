import { TrackData } from "shared/types";

/**
 * Konfigurasi playlist awal khusus Panggung DJ (Rooftop DJ Stage)
 * Menggunakan lagu-lagu beat dinamis, electro, club & synthwave untuk panggung DJ
 */
export const DEFAULT_DJ_PLAYLIST: TrackData[] = [
	{
		id: "dj_track_1",
		title: "Beauty and a Beat",
		artist: "Justin Bieber",
		soundId: "rbxassetid://136354717797439",
		coverColor: Color3.fromHex("#3addf3"),
		speed: 2.3,
	},
	{
		id: "dj_track_2",
		title: "Officially Missing You",
		artist: "Tamia",
		soundId: "rbxassetid://134873417509549",
		coverColor: Color3.fromHex("#0891b2"),
	},
	{
		id: "dj_track_3",
		title: "Raindance",
		artist: "Dave, Tems",
		soundId: "rbxassetid://120199157879826",
		coverColor: Color3.fromHex("#d6d84c"),
	},
	{
		id: "dj_track_4",
		title: "Love In The Dark",
		artist: "Adele",
		soundId: "rbxassetid://77854695222945",
		coverColor: Color3.fromHex("#75b1f5"),
	},
	{
		id: "dj_track_5",
		title: "Show Me Love",
		artist: "WizTheMc, Bees & Honey",
		soundId: "rbxassetid://76179227882579",
		coverColor: Color3.fromHex("#ffa2e0"),
	},
	{
		id: "dj_track_6",
		title: "Love",
		artist: "Keyshia Cole",
		soundId: "rbxassetid://120403610844576",
		coverColor: Color3.fromHex("#f3ffa3"),
		speed: 2.3,
	},
	{
		id: "dj_track_7",
		title: "We Found Love",
		artist: "Rihanna",
		soundId: "rbxassetid://129811559045328",
		coverColor: Color3.fromHex("#482d5f"),
		speed: 2.3,
	},
	{
		id: "dj_track_8",
		title: "Sweet Dispotition",
		artist: "The Tamper Trap",
		soundId: "rbxassetid://124077430827960",
		coverColor: Color3.fromHex("#93f3f3"),
		speed: 2.3,
	},
	{
		id: "dj_track_9",
		title: "Paradise",
		artist: "Coldplay",
		soundId: "rbxassetid://76100420099813",
		coverColor: Color3.fromHex("#f7e586"),
		speed: 2.3,
	},
];

export const DJ_MUSIC_CONFIG = {
	MAX_QUEUE_PER_PLAYER: 3,
	QUEUE_COOLDOWN_SECONDS: 10,
	VOTE_SKIP_THRESHOLD: 5,
};
