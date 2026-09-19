import React from "@rbxts/react";
import { GetIconUri } from "shared/utils";

export interface LucideIconProps {
	name: string;
	size?: UDim2;
	color?: Color3;
	transparency?: number;
	anchorPoint?: Vector2;
	position?: UDim2;
	layoutOrder?: number;
	zIndex?: number;
	scaleType?: Enum.ScaleType;
}

/**
 * Declarative wrapper for Lucide Icons in React.
 * Adheres strictly to AGENTS.md rule 11 (uses internal registry, zero @nrbx/lucide import overhead).
 */
export function LucideIcon({
	name,
	size = new UDim2(0, 20, 0, 20),
	color = new Color3(1, 1, 1),
	transparency = 0,
	anchorPoint = new Vector2(0, 0),
	position = new UDim2(0, 0, 0, 0),
	layoutOrder,
	zIndex = 1,
	scaleType = Enum.ScaleType.Fit,
}: LucideIconProps) {
	const iconUri = GetIconUri(name);

	return (
		<imagelabel
			Size={size}
			Position={position}
			AnchorPoint={anchorPoint}
			BackgroundTransparency={1}
			Image={iconUri}
			ImageColor3={color}
			ImageTransparency={transparency}
			ScaleType={scaleType}
			LayoutOrder={layoutOrder}
			ZIndex={zIndex}
		/>
	);
}
