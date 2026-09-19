/**
 * Unified Monochrome Theme for Game System UI.
 * Standardizes all colors into a sleek, minimal, premium Dark Grayscale / iOS Look.
 * Adheres strictly to monochromatic principles (Pure Black, Grays, and White).
 */

export const MonochromeTheme = {
	// ─── Backgrounds ──────────────────────────────────────────
	Background: {
		/** Deepest backdrop / screen base */
		PureBlack: Color3.fromHex("#000000"),
		/** Main modal / app container background */
		DeepCharcoal: Color3.fromHex("#0c0c0c"),
		/** Surface for inner cards, headers, section blocks */
		Surface: Color3.fromHex("#141414"),
		/** Card background / row background */
		Card: Color3.fromHex("#1a1a1a"),
		/** Hover state for cards and list rows */
		CardHover: Color3.fromHex("#242424"),
		/** Active / pressed state for cards */
		CardActive: Color3.fromHex("#2e2e2e"),
		/** Input field & search bar background */
		Input: Color3.fromHex("#161616"),
		/** Elevated floating overlays / dialogs */
		Elevated: Color3.fromHex("#1f1f1f"),
	},

	// ─── Borders & Strokes ────────────────────────────────────
	Border: {
		/** Default hairline border for cards, dividers, and rows */
		Subtle: Color3.fromHex("#262626"),
		/** Intermediate border for interactive items */
		Medium: Color3.fromHex("#383838"),
		/** Strong border for hovered items */
		Strong: Color3.fromHex("#555555"),
		/** High-contrast active / equipped / selected stroke */
		Active: Color3.fromHex("#ffffff"),
	},

	// ─── Typography & Icons ───────────────────────────────────
	Text: {
		/** Primary headings, titles, and high-emphasis labels */
		Primary: Color3.fromHex("#ffffff"),
		/** Body text, secondary labels, unselected values */
		Secondary: Color3.fromHex("#a8a8a8"),
		/** Timestamps, captions, subtle hints, placeholders */
		Muted: Color3.fromHex("#686868"),
		/** Inverted text for solid white buttons or badges */
		InverseDark: Color3.fromHex("#0a0a0a"),
	},

	// ─── Buttons & Controls ───────────────────────────────────
	Button: {
		/** High-emphasis action button background (e.g. Send, Post, Confirm) */
		PrimaryBg: Color3.fromHex("#ffffff"),
		/** High-emphasis action button text */
		PrimaryText: Color3.fromHex("#000000"),
		/** Secondary / standard action button background */
		SecondaryBg: Color3.fromHex("#222222"),
		/** Secondary action button text */
		SecondaryText: Color3.fromHex("#ffffff"),
		/** Secondary button hover background */
		SecondaryHover: Color3.fromHex("#2c2c2c"),
		/** Active / toggled on button background */
		ActiveBg: Color3.fromHex("#333333"),
		/** Active / toggled on button text */
		ActiveText: Color3.fromHex("#ffffff"),
		/** Danger / destructive action in monochrome (dark graphite with light text) */
		DangerBg: Color3.fromHex("#1a1a1a"),
		DangerText: Color3.fromHex("#e6e6e6"),
		DangerBorder: Color3.fromHex("#444444"),
	},

	// ─── Badges & Status Indicators ───────────────────────────
	Indicator: {
		/** Online / active / success indicator */
		Active: Color3.fromHex("#ffffff"),
		/** Offline / inactive / disabled indicator */
		Inactive: Color3.fromHex("#4a4a4a"),
		/** Status pill badge background */
		BadgeBg: Color3.fromHex("#242424"),
		/** Status pill badge text */
		BadgeText: Color3.fromHex("#ffffff"),
		/** Status pill border */
		BadgeBorder: Color3.fromHex("#3a3a3a"),
	},

	// ─── Progress & Sliders ───────────────────────────────────
	Progress: {
		/** Empty track */
		Track: Color3.fromHex("#282828"),
		/** Filled bar / active portion */
		Fill: Color3.fromHex("#ffffff"),
		/** Knob / Thumb */
		Thumb: Color3.fromHex("#ffffff"),
	},

	// ─── Scrollbars ───────────────────────────────────────────
	Scrollbar: {
		Thumb: Color3.fromHex("#383838"),
	},
} as const;

export default MonochromeTheme;
