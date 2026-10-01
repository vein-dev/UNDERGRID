import { TrackData } from "shared/types";

/**
 * Konfigurasi playlist awal khusus Panggung DJ (Rooftop DJ Stage)
 * Menggunakan lagu-lagu beat dinamis, electro, club & synthwave untuk panggung DJ
 */
export const DEFAULT_DJ_PLAYLIST: TrackData[] = [
	{
		id: "dj_track_1",
		title: "Revival",
		artist: "Lomba Sihir",
		soundId: "rbxassetid://104445798142371",
		coverColor: Color3.fromHex("#0891b2"),
		bpm: 125,
		firstBeatOffset: 0.12,
	},
	{
		id: "dj_track_2",
		title: "Sway",
		artist: "COLORCODE",
		soundId: "rbxassetid://89494358931144",
		coverColor: Color3.fromHex("#06b6d4"),
		bpm: 128,
		firstBeatOffset: 0.08,
	},
	{
		id: "dj_track_3",
		title: "Sunshine",
		artist: "Shewn",
		soundId: "rbxassetid://96012836329936",
		coverColor: Color3.fromHex("#10b981"),
		bpm: 130,
		firstBeatOffset: 0.15,
	},
	{
		id: "dj_track_4",
		title: "Penghujung Cerita",
		artist: "Murphy Radio",
		soundId: "rbxassetid://96255078258346",
		coverColor: Color3.fromHex("#8b5cf6"),
		bpm: 132,
		firstBeatOffset: 0.1,
	},
	{
		id: "dj_track_5",
		title: "Tears Will Be Shed Forever",
		artist: "Modern Guns",
		soundId: "rbxassetid://91875432147760",
		coverColor: Color3.fromHex("#f59e0b"),
		bpm: 135,
		firstBeatOffset: 0.05,
	},
];

export const DJ_MUSIC_CONFIG = {
	MAX_QUEUE_PER_PLAYER: 3,
	QUEUE_COOLDOWN_SECONDS: 10,
	VOTE_SKIP_THRESHOLD: 5,
};
