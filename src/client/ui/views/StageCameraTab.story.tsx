import React from "@rbxts/react";
import ReactRoblox from "@rbxts/react-roblox";
import { CreateGenericStory } from "@rbxts/ui-labs";
import { StageCameraTab } from "./StageCameraTab";

const story = CreateGenericStory(
	{
		name: "Stage Camera Tab",
		summary: "Cinematic Stage Camera Controller Tab with Face-to-Face Spectate, 360 Orbit, Shake, and Drone Motions",
	},
	(props) => {
		const root = ReactRoblox.createRoot(props.target);
		root.render(
			<scrollingframe
				Size={new UDim2(0, 310, 0, 400)}
				BackgroundColor3={Color3.fromHex("#0a0a0a")}
				BackgroundTransparency={0.1}
				BorderSizePixel={0}
				ScrollBarThickness={3}
				CanvasSize={new UDim2(0, 0, 0, 0)}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
			>
				<uicorner CornerRadius={new UDim(0, 14)} />
				<uipadding
					PaddingLeft={new UDim(0, 12)}
					PaddingRight={new UDim(0, 12)}
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					SortOrder={Enum.SortOrder.LayoutOrder}
					Padding={new UDim(0, 10)}
				/>
				<StageCameraTab />
			</scrollingframe>
		);

		return () => {
			root.unmount();
		};
	}
);

export = story;
