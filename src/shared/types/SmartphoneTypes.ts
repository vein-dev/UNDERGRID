/**
 * Shared types, interfaces, enums, and config for the Smartphone system.
 */

/** Metadata for a single music track in the playlist. */
export interface TrackData {
	/** Unique identifier */
	id: string;
	/** Display title */
	title: string;
	/** Artist name */
	artist: string;
	/** Roblox Sound asset ID (rbxassetid://...) */
	soundId: string;
	/** Solid color used as cover art placeholder */
	coverColor: Color3;
	/**
	 * Jumlah semitone yang dinaikkan saat bypass di Audacity (misal: 2 untuk +2 semitone).
	 * Client akan otomatis menurunkannya kembali (pitch shift) agar musik terdengar normal.
	 */
	pitch?: number;
	/**
	 * Penguatan frekuensi bass (dalam dB, misal: 5 atau 6 untuk +5 dB / +6 dB via EqualizerSoundEffect).
	 * Berguna untuk mengompensasi hilangnya frekuensi rendah akibat pemrosesan PitchShiftSoundEffect.
	 */
	bassBoost?: number;
	/**
	 * Penguatan frekuensi treble / nada tinggi (dalam dB, misal: 2 untuk +2 dB via EqualizerSoundEffect).
	 * Berguna untuk mengembalikan kerenyahan simbal, petikan gitar, dan vokal agar tidak terdengar mendem.
	 */
	trebleBoost?: number;
	/**
	 * Mode koreksi pitch:
	 * - "pitchShift": Menggunakan PitchShiftSoundEffect (tempo konstan, bass dikompensasi via Equalizer)
	 * - "playbackSpeed": Mengubah PlaybackSpeed (suara 100% bersih tanpa DSP grains, tempo sedikit berubah)
	 * Default: "pitchShift".
	 */
	pitchCorrectionMode?: "pitchShift" | "playbackSpeed";
	/**
	 * Pengali kecepatan putar saat lagu di-upload untuk bypass (misal: 1.12 untuk dipercepat 1.12x).
	 * Client akan otomatis memutar pada PlaybackSpeed = 1 / speed agar tempo & nada kembali normal secara murni.
	 */
	speed?: number;
	/**
	 * Nilai langsung Sound.PlaybackSpeed (misal: 0.89). Alternatif langsung dari prop speed.
	 */
	playbackSpeed?: number;
	/** Beats per minute untuk sinkronisasi panggung konser & lighting (default 128 jika tidak disetel). */
	bpm?: number;
	/** Offset waktu (dalam detik) sampai ketukan pertama/downbeat lagu terdengar (default 0). */
	firstBeatOffset?: number;
	/** Alias per-track beat offset (dalam detik) dari TimePosition=0 ke downbeat pertama. */
	beatOffset?: number;
}

/** Target audio zone / stage channel */
export type MusicTarget = "main" | "dj";

/** Represents the current playback state of the music player. */
export enum MusicPlayerState {
	Idle = "Idle",
	Playing = "Playing",
	Paused = "Paused",
}

/** Identifies an app installed on the Smartphone. */
export enum AppId {
	Messages = "Messages",
	Music = "Music",
	Settings = "Settings",
	Social = "Social",
	Events = "Events",
}

/** Represents a single status post on the Social Media app. */
export interface StatusPost {
	id: string;
	authorUserId: number;
	authorName: string;
	authorDisplayName: string;
	content: string;
	timestamp: number;
	likedByUserIds: number[];
}

/** Result when creating a new status post. */
export interface CreatePostResult {
	success: boolean;
	message: string;
}

/** Social media config constants. */
export const SOCIAL_CONFIG = {
	MAX_POST_LENGTH: 280,
	MAX_TIMELINE_POSTS: 100,
	POST_COOLDOWN_SECONDS: 5,
} as const;

/** RSVP status for an event. */
export enum RsvpStatus {
	None = "None",
	Going = "Going",
	Interested = "Interested",
}

/** Represents an event in the Event Ticketing app. */
export interface EventData {
	id: string;
	title: string;
	category: string;
	dateText: string;
	timeText: string;
	locationText: string;
	priceText: string;
	posterAssetId: string;
	description: string;
	organizerName: string;
	goingUserIds: number[];
	interestedUserIds: number[];
}

/** Result when changing RSVP status. */
export interface RsvpResult {
	success: boolean;
	message: string;
	newStatus: RsvpStatus;
}

/** Represents a single chat message sent via the Messages app. */
export interface ChatMessage {
	id: string;
	senderUserId: number;
	senderName: string;
	senderDisplayName?: string;
	recipientUserId?: number;
	content: string;
	timestamp: number;
	isOfflineMessage?: boolean;
}

/** Represents a contact in the friend / user list. */
export interface ContactInfo {
	userId: number;
	displayName: string;
	userName: string;
	isOnline: boolean;
	isInServer: boolean;
}

/** Represents an item in the song queue. */
export interface MusicQueueItem {
	track: TrackData;
	requestedBy: string;
	requestedByUserId: number;
	queuedAt: number;
	/** UserIds that have voted to skip this queue item */
	voteSkipUserIds: number[];
}

/** Result returned when a player votes to skip or admin removes a queue item. */
export interface VoteSkipResult {
	success: boolean;
	message: string;
	/** Current vote count after this request */
	currentVotes: number;
	/** Votes required to trigger skip */
	requiredVotes: number;
}

/** Number of votes required to skip a queued song. */
export const VOTE_SKIP_THRESHOLD = 10;

/** Actions that an admin can send to control music. */
export enum MusicControlAction {
	Play = "Play",
	Pause = "Pause",
	TogglePlayPause = "TogglePlayPause",
	Next = "Next",
	Previous = "Previous",
	Seek = "Seek",
	PlaySpecific = "PlaySpecific",
}

/** Payload sent from server to client to synchronize global music. */
export interface GlobalMusicSyncData {
	currentTrack: TrackData;
	state: MusicPlayerState;
	timePosition: number;
	serverTimestamp: number;
	queue: MusicQueueItem[];
}

/** Result when a player requests to queue a song. */
export interface QueueSongResult {
	success: boolean;
	message: string;
}

/** Configuration for the Smartphone system. */
export interface SmartphoneConfig {
	playlist: TrackData[];
}

/** Default playlist using the provided asset ID. */
export const DEFAULT_SMARTPHONE_CONFIG: SmartphoneConfig = {
	playlist: [
		{
			id: "track_1",
			title: "Revival",
			artist: "Miika",
			soundId: "rbxassetid://104445798142371",
			coverColor: Color3.fromHex("#1db954"),
		},
		{
			id: "track_2",
			title: "Embrace",
			artist: "Miika",
			soundId: "rbxassetid://138786500301466",
			coverColor: Color3.fromHex("#b91d32"),
		},
		{
			id: "track_3",
			title: "Numb, But I Still Feel It",
			artist: "Title Fight",
			soundId: "rbxassetid://124673215456249",
			coverColor: Color3.fromHex("#36d8d0"),
		},
		{
			id: "track_4",
			title: "When will this all end",
			artist: "Conversation Without Talk",
			soundId: "rbxassetid://122394268784187",
			coverColor: Color3.fromHex("#b92097"),
		},
		{
			id: "track_5",
			title: "Hurt",
			artist: "Remoire",
			soundId: "rbxassetid://85625315784654",
			speed: 1.12,
			coverColor: Color3.fromHex("#98b920"),
		},
		{
			id: "track_6",
			title: "Ripple Water Shine",
			artist: "Pianos Become The Teeth",
			soundId: "rbxassetid://117842599729476",
			coverColor: Color3.fromHex("#b92020"),
			speed: 1.12,
		},
		{
			id: "track_7",
			title: "Sway",
			artist: "COLORCODE",
			soundId: "rbxassetid://89494358931144",
			coverColor: Color3.fromHex("#37aad8"),
		},
		{
			id: "track_8",
			title: "Melukis Memar Di Langit Ibu",
			artist: "Rekah",
			soundId: "rbxassetid://83086395627870",
			coverColor: Color3.fromHex("#ce1720"),
		},
		{
			id: "track_9",
			title: "Daun dan Ranting Menuju Surga",
			artist: "Themilo",
			soundId: "rbxassetid://125039838178138",
			coverColor: Color3.fromHex("#f750cd"),
		},
		{
			id: "track_10",
			title: "Penghujung Cerita",
			artist: "Murphy Radio",
			soundId: "rbxassetid://96255078258346",
			coverColor: Color3.fromHex("#70ce17"),
		},
		{
			id: "track_11",
			title: "Irine",
			artist: "HUSH",
			soundId: "rbxassetid://101005199328200",
			coverColor: Color3.fromHex("#eb9007"),
		},
		{
			id: "track_12",
			title: "I Am Nietzche",
			artist: "Orchid",
			soundId: "rbxassetid://110499415983940",
			coverColor: Color3.fromHex("#d9dd07"),
		},
		{
			id: "track_13",
			title: "Did I Try",
			artist: "Enamore",
			soundId: "rbxassetid://133624027860316",
			coverColor: Color3.fromHex("#242a47"),
		},
		{
			id: "track_14",
			title: "Tears Will Be Shed Forever",
			artist: "Modern Guns",
			soundId: "rbxassetid://91875432147760",
			coverColor: Color3.fromHex("#e7a311"),
		},
		{
			id: "track_15",
			title: "Sandikala",
			artist: "Enamore",
			soundId: "rbxassetid://89119894398043",
			coverColor: Color3.fromHex("#a7112c"),
		},
		{
			id: "track_16",
			title: "Unpleasant Path",
			artist: "Enamore",
			soundId: "rbxassetid://88885999065079",
			coverColor: Color3.fromHex("#44ee44"),
		},
		{
			id: "track_17",
			title: "Under Pine Tree",
			artist: "Enamore",
			soundId: "rbxassetid://138210155575853",
			coverColor: Color3.fromHex("#242a47"),
		},
		{
			id: "track_18",
			title: "Sunshine",
			artist: "Shewn",
			soundId: "rbxassetid://96012836329936",
			coverColor: Color3.fromHex("#0b360d"),
		},
		{
			id: "track_19",
			title: "Kabar Dari Dasar Botol",
			artist: "Rekah",
			soundId: "rbxassetid://70891757434780",
			coverColor: Color3.fromHex("#ff0000"),
		},
		{
			id: "track_21",
			title: "Kereta Terakhir Dari Palmerah",
			artist: "Rekah",
			soundId: "rbxassetid://107057304507923",
			coverColor: Color3.fromHex("#ff00ff"),
		},
	],
};

/** Asset ID animasi untuk interaksi Toolbar / Tool Smartphone */
export const SMARTPHONE_ANIMATIONS = {
	/** Animasi buka / use tool (HandleSmartphone) */
	USE: "rbxassetid://114941113355273",
	/** Animasi tutup / unuse tool (Unhandle) */
	UNUSE: "rbxassetid://72646169940502",
};
