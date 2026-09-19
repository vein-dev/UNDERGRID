import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { Boolean, Choose, CreateGenericStory, String } from "@rbxts/ui-labs";
import { Button, ButtonVariant } from "./Button";

const story = CreateGenericStory(
	{
		name: "Button",
		summary: "Interactive iOS-styled Button component with variants",
		controls: {
			text: String("Confirm"),
			icon: String("check"),
			variant: Choose(["primary", "secondary", "ghost", "danger"], 1),
			disabled: Boolean(false),
		},
	},
	(props) => {
		const root = ReactRoblox.createRoot(props.target);

		const render = (controls: typeof props.controls) => {
			root.render(
				<frame
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundTransparency={1}
				>
					<uilistlayout
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						VerticalAlignment={Enum.VerticalAlignment.Center}
					/>
					<Button
						text={controls.text}
						icon={controls.icon !== "" ? controls.icon : undefined}
						variant={controls.variant as ButtonVariant}
						disabled={controls.disabled}
						onClick={() => {
							print("[ButtonStory] Clicked!");
						}}
					/>
				</frame>,
			);
		};

		render(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			render(controls);
		});

		return () => {
			unsubscribe();
			root.unmount();
		};
	},
);

export = story;
