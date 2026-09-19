import React, { useState } from "@rbxts/react";
import { MonochromeTheme } from "../Theme";

export interface CardProps {
	size?: UDim2;
	position?: UDim2;
	anchorPoint?: Vector2;
	backgroundColor?: Color3;
	backgroundTransparency?: number;
	borderColor?: Color3;
	borderTransparency?: number;
	cornerRadius?: UDim;
	padding?: UDim;
	layoutOrder?: number;
	children?: React.ReactNode;
	onClick?: () => void;
}

/**
 * Reusable iOS-styled Card container with subtle borders and surface elevation.
 */
export function Card({
	size = new UDim2(1, 0, 0, 100),
	position = new UDim2(0, 0, 0, 0),
	anchorPoint = new Vector2(0, 0),
	backgroundColor = MonochromeTheme.Background.Card,
	backgroundTransparency = 0,
	borderColor = MonochromeTheme.Border.Subtle,
	borderTransparency = 0.5,
	cornerRadius = new UDim(0, 12),
	padding = new UDim(0, 12),
	layoutOrder,
	children,
	onClick,
}: CardProps) {
	const [isHovered, setIsHovered] = useState(false);

	const isClickable = onClick !== undefined;
	const activeBgColor = isClickable && isHovered ? MonochromeTheme.Background.CardHover : backgroundColor;
	const activeBorderColor = isClickable && isHovered ? MonochromeTheme.Border.Strong : borderColor;

	if (isClickable) {
		return (
			<textbutton
				Size={size}
				Position={position}
				AnchorPoint={anchorPoint}
				BackgroundColor3={activeBgColor}
				BackgroundTransparency={backgroundTransparency}
				LayoutOrder={layoutOrder}
				AutoButtonColor={false}
				Text=""
				Event={{
					MouseEnter: () => setIsHovered(true),
					MouseLeave: () => setIsHovered(false),
					Activated: onClick,
				}}
			>
				<uicorner CornerRadius={cornerRadius} />
				<uistroke
					Color={activeBorderColor}
					Thickness={1}
					Transparency={borderTransparency}
					ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
				/>
				<uipadding
					PaddingTop={padding}
					PaddingBottom={padding}
					PaddingLeft={padding}
					PaddingRight={padding}
				/>
				{children}
			</textbutton>
		);
	}

	return (
		<frame
			Size={size}
			Position={position}
			AnchorPoint={anchorPoint}
			BackgroundColor3={backgroundColor}
			BackgroundTransparency={backgroundTransparency}
			LayoutOrder={layoutOrder}
		>
			<uicorner CornerRadius={cornerRadius} />
			<uistroke
				Color={borderColor}
				Thickness={1}
				Transparency={borderTransparency}
				ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			/>
			<uipadding
				PaddingTop={padding}
				PaddingBottom={padding}
				PaddingLeft={padding}
				PaddingRight={padding}
			/>
			{children}
		</frame>
	);
}
