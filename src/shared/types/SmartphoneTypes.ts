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
}

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
			title: "Numb, But I Still Feel It",
			artist: "Title Fight",
			soundId: "rbxassetid://17208361335",
			coverColor: Color3.fromHex("#1db954"),
		},
		{
			id: "track_2",
			title: "Leaf",
			artist: "Title Fight",
			soundId: "rbxassetid://122427746390315",
			coverColor: Color3.fromHex("#5856d6"),
		},
		{
			id: "track_3",
			title: "Revival",
			artist: "MIIKA",
			soundId: "rbxassetid://129375707474398",
			coverColor: Color3.fromHex("#ff9500"),
		},
		{
			id: "track_4",
			title: "Acceptance",
			artist: "MIIKA",
			soundId: "rbxassetid://124579830698647",
			coverColor: Color3.fromHex("#d12424"),
		},
		{
			id: "track_5",
			title: "Embrace",
			artist: "MIIKA",
			soundId: "rbxassetid://82411311172877",
			coverColor: Color3.fromHex("#0ef1ef"),
		},
		{
			id: "track_6",
			title: "Unpleasant Path",
			artist: "Enamore",
			soundId: "rbxassetid://114483969995029",
			coverColor: Color3.fromHex("#ff0000"),
		},
		{
			id: "track_7",
			title: "Head In The Ceiling Fan",
			artist: "Title Fight",
			soundId: "rbxassetid://79926530616230",
			coverColor: Color3.fromHex("#ff0000"),
			pitch: 2,
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
