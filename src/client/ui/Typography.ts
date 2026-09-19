/**
 * Unified Typography System for Smartphone UI and Applications.
 * Ensures consistent font weights, hierarchy, and harmonious aesthetics across all apps.
 */

export const Fonts = {
	/** Used for Main Titles, Header Action buttons, Numeric Badges, Song Titles, and CTA buttons */
	Bold: Enum.Font.GothamBold,
	/** Used for Section Headers, List Row Titles, App Names, Input fields, and Subheaders */
	Medium: Enum.Font.GothamMedium,
	/** Used for Secondary Body, Artist names, Subtitles, Timestamps, Captions, Details, and Values */
	Regular: Enum.Font.Gotham,
} as const;

export const Typography = {
	Bold: Fonts.Bold,
	Medium: Fonts.Medium,
	Regular: Fonts.Regular,

	// ─── Semantic Scale ─────────────────────────────
	/** Big Lockscreen Clock */
	HeroClock: {
		Font: Fonts.Bold,
		MaxSize: 72,
		MinSize: 28,
	},
	/** Screen / App / Modal Header Titles */
	HeaderTitle: {
		Font: Fonts.Bold,
		MaxSize: 18,
		MinSize: 11,
	},
	/** Header Subtitle / Now Playing indicator */
	HeaderSubtitle: {
		Font: Fonts.Medium,
		MaxSize: 12,
		MinSize: 9,
	},
	/** Primary Song Title / Card Heading */
	TrackTitle: {
		Font: Fonts.Bold,
		MaxSize: 18,
		MinSize: 11,
	},
	/** Secondary Artist / Author */
	TrackArtist: {
		Font: Fonts.Medium,
		MaxSize: 14,
		MinSize: 9,
	},
	/** Section Headers in Modals & Settings (e.g. "SOUND", "ABOUT") */
	SectionHeader: {
		Font: Fonts.Bold,
		MaxSize: 12,
		MinSize: 9,
	},
	/** List Row Labels (e.g. "Volume", "Game Version", Catalog Items) */
	RowLabel: {
		Font: Fonts.Medium,
		MaxSize: 14,
		MinSize: 9,
	},
	/** Secondary values / details */
	RowValue: {
		Font: Fonts.Regular,
		MaxSize: 13,
		MinSize: 9,
	},
	/** Timestamps, progress duration, track counter, small hints */
	Timestamp: {
		Font: Fonts.Regular,
		MaxSize: 11,
		MinSize: 8,
	},
	/** Interactive Action Buttons (e.g. "▶ Putar", "+ Antre", "Queue") */
	Button: {
		Font: Fonts.Bold,
		MaxSize: 12,
		MinSize: 8,
	},
	/** Numeric Badges & Count Pills */
	Badge: {
		Font: Fonts.Regular,
		MaxSize: 8,
		MinSize: 2,
	},
	/** Text inputs and search bars */
	Input: {
		Font: Fonts.Medium,
		MaxSize: 12,
		MinSize: 8,
	},
	/** Status bar clock & indicators */
	StatusBarClock: {
		Font: Fonts.Bold,
		MaxSize: 15,
		MinSize: 9,
	},
	StatusBarIcons: {
		Font: Fonts.Medium,
		MaxSize: 11,
		MinSize: 7,
	},
	/** Home Screen App Icon Labels */
	AppLabel: {
		Font: Fonts.Medium,
		MaxSize: 11,
		MinSize: 8,
	},
} as const;
