import { config, SpringOptions } from "@rbxts/ripple";

/**
 * Standard spring presets for UI animations across UNDERGRID.
 * Provides consistent physics parameters across all UI views and components.
 */
export const SpringPresets = {
	/** Standard default spring */
	default: { ...config.default, start: true } as SpringOptions,
	/** Snappy and responsive for interactive controls (buttons, hotbar slots, tabs) */
	snappy: { tension: 350, friction: 28, start: true } as SpringOptions,
	/** Bouncy and energetic for badges, notifications, icon pops */
	bouncy: { tension: 280, friction: 18, start: true } as SpringOptions,
	/** Gentle and smooth for modal dialogs, sheet presentations, backdrops */
	gentle: { ...config.gentle, start: true } as SpringOptions,
	/** Slow motion for dramatic reveals */
	slow: { ...config.slow, start: true } as SpringOptions,
	/** Stiff and crisp with minimal overshoot */
	stiff: { ...config.stiff, start: true } as SpringOptions,
	/** Instant transition without physics delay */
	instant: { tension: 1000, friction: 100, start: true } as SpringOptions,
};

export { useMotion, useSpring, useTween } from "@rbxts/react-ripple";
export { config, createMotion, createSpring, createTween } from "@rbxts/ripple";
export type { Spring, SpringOptions } from "@rbxts/ripple";
