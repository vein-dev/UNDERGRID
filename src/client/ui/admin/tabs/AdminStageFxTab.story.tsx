import { CreateGenericStory } from "@rbxts/ui-labs";
import { AdminStageFxTab } from "./AdminStageFxTab";

const story = CreateGenericStory(
	{
		name: "Admin Stage & FX Tab",
		summary: "Tab 2: Stage & FX controls including smoke machine, lasers, confetti, and broadcast banner",
		controls: {},
	},
	(props) => {
		const tabWrapper = new Instance("Frame");
		tabWrapper.Size = new UDim2(0, 440, 0, 460);
		tabWrapper.AnchorPoint = new Vector2(0.5, 0.5);
		tabWrapper.Position = new UDim2(0.5, 0, 0.5, 0);
		tabWrapper.BackgroundColor3 = Color3.fromHex("#121212");
		tabWrapper.Parent = props.target;

		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 16);
		corner.Parent = tabWrapper;

		const tab = new AdminStageFxTab(tabWrapper);
		tab.setVisible(true);

		return () => {
			tab.destroy();
			tabWrapper.Destroy();
		};
	},
);

export = story;
