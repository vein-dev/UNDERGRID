import { useEffect, useState } from "@rbxts/react";
import { SpringOptions } from "@rbxts/ripple";
import { SpringPresets, useSpring } from "../SpringConfig";

export interface PressSpringOptions {
	disabled?: boolean;
	idleScale?: number;
	hoverScale?: number;
	pressScale?: number;
	springConfig?: SpringOptions;
}

/**
 * Hook providing tactile spring-based micro-interactions for buttons and interactive cards.
 * Returns a reactive scaleBinding, hover/pressed booleans, and pre-packaged Roblox GUI event handlers.
 */
export function usePressSpring(options: PressSpringOptions = {}) {
	const {
		disabled = false,
		idleScale = 1.0,
		hoverScale = 1.02,
		pressScale = 0.95,
		springConfig = SpringPresets.snappy,
	} = options;

	const [isHovered, setIsHovered] = useState(false);
	const [isPressed, setIsPressed] = useState(false);

	const targetScale = disabled ? idleScale : isPressed ? pressScale : isHovered ? hoverScale : idleScale;
	const [scaleBinding, scaleSpring] = useSpring(targetScale, springConfig);

	useEffect(() => {
		scaleSpring.setGoal(targetScale);
	}, [targetScale]);

	const eventHandlers = {
		MouseEnter: () => {
			if (!disabled) setIsHovered(true);
		},
		MouseLeave: () => {
			setIsHovered(false);
			setIsPressed(false);
		},
		MouseButton1Down: () => {
			if (!disabled) setIsPressed(true);
		},
		MouseButton1Up: () => {
			setIsPressed(false);
		},
	};

	return {
		scaleBinding,
		isHovered,
		isPressed,
		setIsHovered,
		setIsPressed,
		eventHandlers,
	};
}
