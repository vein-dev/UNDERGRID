import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { CreateGenericStory, Slider, String } from "@rbxts/ui-labs";
import { LucideIcon } from "./LucideIcon";

const story = CreateGenericStory(
	{
		name: "LucideIcon",
		summary: "Declarative Lucide icon component",
		controls: {
			iconName: String("message-square"),
			size: Slider(32, 12, 64, 2),
		},
	},
	(props) => {
		const root = ReactRoblox.createRoot(props.target);

		const render = (name: string, size: number) => {
			root.render(
				<frame
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundTransparency={1}
				>
					<uilistlayout
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						VerticalAlignment={Enum.VerticalAlignment.Center}
					/>
					<LucideIcon
						name={name}
						size={new UDim2(0, size, 0, size)}
						color={new Color3(1, 1, 1)}
					/>
				</frame>,
			);
		};

		render(props.controls.iconName, props.controls.size);

		const unsubscribe = props.subscribe((controls) => {
			render(controls.iconName, controls.size);
		});

		return () => {
			unsubscribe();
			root.unmount();
		};
	},
);

export = story;
