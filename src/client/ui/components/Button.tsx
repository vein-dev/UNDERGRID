import React, { useState } from "@rbxts/react";
import { MonochromeTheme } from "../Theme";
import { Fonts } from "../Typography";
import { LucideIcon } from "./LucideIcon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps {
	text?: string;
	icon?: string;
	iconRight?: string;
	variant?: ButtonVariant;
	size?: UDim2;
	position?: UDim2;
	anchorPoint?: Vector2;
	layoutOrder?: number;
	disabled?: boolean;
	cornerRadius?: UDim;
	textSize?: number;
	onClick?: () => void;
}

/**
 * Reusable iOS-styled interactive Button.
 * Built with MonochromeTheme tokens, dynamic hover/press states, and clean lifecycle.
 */
export function Button({
	text,
	icon,
	iconRight,
	variant = "secondary",
	size = new UDim2(0, 120, 0, 36),
	position = new UDim2(0, 0, 0, 0),
	anchorPoint = new Vector2(0, 0),
	layoutOrder,
	disabled = false,
	cornerRadius = new UDim(0, 8),
	textSize = 13,
	onClick,
}: ButtonProps) {
	const [isHovered, setIsHovered] = useState(false);
	const [isPressed, setIsPressed] = useState(false);

	let bgColor = MonochromeTheme.Button.SecondaryBg;
	let textColor = MonochromeTheme.Button.SecondaryText;
	let strokeColor = MonochromeTheme.Border.Subtle;
	let strokeTransparency = 0.5;

	if (variant === "primary") {
		bgColor = isPressed
			? Color3.fromHex("#d0d0d0")
			: isHovered
				? Color3.fromHex("#e8e8e8")
				: MonochromeTheme.Button.PrimaryBg;
		textColor = MonochromeTheme.Button.PrimaryText;
		strokeTransparency = 1;
	} else if (variant === "secondary") {
		bgColor = isPressed
			? MonochromeTheme.Background.CardActive
			: isHovered
				? MonochromeTheme.Background.CardHover
				: MonochromeTheme.Button.SecondaryBg;
		textColor = MonochromeTheme.Button.SecondaryText;
		strokeColor = isHovered ? MonochromeTheme.Border.Strong : MonochromeTheme.Border.Subtle;
		strokeTransparency = 0.4;
	} else if (variant === "ghost") {
		bgColor = isPressed
			? MonochromeTheme.Background.CardHover
			: isHovered
				? MonochromeTheme.Background.Card
				: MonochromeTheme.Background.PureBlack;
		textColor = isHovered ? MonochromeTheme.Text.Primary : MonochromeTheme.Text.Secondary;
		strokeTransparency = isHovered ? 0.6 : 1;
	} else if (variant === "danger") {
		bgColor = isPressed ? Color3.fromHex("#4a1515") : isHovered ? Color3.fromHex("#3a1010") : Color3.fromHex("#2b0c0c");
		textColor = Color3.fromHex("#ff6b6b");
		strokeColor = Color3.fromHex("#661a1a");
		strokeTransparency = 0.3;
	}

	if (disabled) {
		bgColor = MonochromeTheme.Background.Surface;
		textColor = MonochromeTheme.Text.Muted;
		strokeTransparency = 0.8;
	}

	return (
		<textbutton
			Size={size}
			Position={position}
			AnchorPoint={anchorPoint}
			BackgroundColor3={bgColor}
			BackgroundTransparency={variant === "ghost" && !isHovered && !isPressed ? 1 : 0}
			LayoutOrder={layoutOrder}
			AutoButtonColor={false}
			Text=""
			Event={{
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
				Activated: () => {
					if (!disabled && onClick) {
						onClick();
					}
				},
			}}
		>
			<uicorner CornerRadius={cornerRadius} />
			{strokeTransparency < 1 && (
				<uistroke
					Color={strokeColor}
					Thickness={1}
					Transparency={strokeTransparency}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
			)}
			<frame
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundTransparency={1}
			>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					HorizontalAlignment={Enum.HorizontalAlignment.Center}
					VerticalAlignment={Enum.VerticalAlignment.Center}
					Padding={new UDim(0, 6)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{icon !== undefined && (
					<LucideIcon
						name={icon}
						size={new UDim2(0, textSize + 2, 0, textSize + 2)}
						color={textColor}
						layoutOrder={1}
					/>
				)}
				{text !== undefined && text !== "" && (
					<textlabel
						BackgroundTransparency={1}
						AutomaticSize={Enum.AutomaticSize.XY}
						Font={Fonts.Bold}
						Text={text}
						TextColor3={textColor}
						TextSize={textSize}
						LayoutOrder={2}
					/>
				)}
				{iconRight !== undefined && (
					<LucideIcon
						name={iconRight}
						size={new UDim2(0, textSize + 2, 0, textSize + 2)}
						color={textColor}
						layoutOrder={3}
					/>
				)}
			</frame>
		</textbutton>
	);
}
