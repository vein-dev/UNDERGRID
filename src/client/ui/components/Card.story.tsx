import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { Boolean, CreateGenericStory, Slider } from "@rbxts/ui-labs";
import { Card } from "./Card";
import { Fonts } from "../Typography";
import { MonochromeTheme } from "../Theme";

const story = CreateGenericStory(
	{
		name: "Card",
		summary: "iOS-styled Card container component",
		controls: {
			clickable: Boolean(true),
			cornerRadius: Slider(12, 0, 24, 2),
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
					<Card
						size={new UDim2(0, 260, 0, 120)}
						cornerRadius={new UDim(0, controls.cornerRadius)}
						onClick={
							controls.clickable
								? () => {
										print("[CardStory] Card clicked!");
									}
								: undefined
						}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Vertical}
							Padding={new UDim(0, 6)}
						/>
						<textlabel
							Size={new UDim2(1, 0, 0, 20)}
							BackgroundTransparency={1}
							Font={Fonts.Bold}
							Text="Card Heading"
							TextColor3={MonochromeTheme.Text.Primary}
							TextSize={16}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
						<textlabel
							Size={new UDim2(1, 0, 0, 40)}
							BackgroundTransparency={1}
							Font={Fonts.Regular}
							Text="This is an iOS-style container card with subtle borders and smooth hover states."
							TextColor3={MonochromeTheme.Text.Secondary}
							TextSize={12}
							TextWrapped={true}
							TextXAlignment={Enum.TextXAlignment.Left}
						/>
					</Card>
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
