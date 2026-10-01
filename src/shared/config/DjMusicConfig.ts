import { TrackData } from "shared/types";

/**
 * Konfigurasi playlist awal khusus Panggung DJ (Rooftop DJ Stage)
 * Menggunakan lagu-lagu beat dinamis, electro, club & synthwave untuk panggung DJ
 */
export const DEFAULT_DJ_PLAYLIST: TrackData[] = [
	{
		id: "dj_track_1",
		title: "Officially Missing You",
		artist: "FARIZKI",
		soundId: "rbxassetid://134873417509549",
		coverColor: Color3.fromHex("#0891b2"),
	},
];

export const DJ_MUSIC_CONFIG = {
	MAX_QUEUE_PER_PLAYER: 3,
	QUEUE_COOLDOWN_SECONDS: 10,
	VOTE_SKIP_THRESHOLD: 5,
};
