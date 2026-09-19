import { CreateGenericStory } from "@rbxts/ui-labs";
import { AdminPlayerTab } from "./AdminPlayerTab";

const story = CreateGenericStory(
	{
		name: "Admin Player Management Tab",
		summary: "Tab 3: Player Management list with kick, mute, and teleport action buttons",
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

		const tab = new AdminPlayerTab(tabWrapper);
		tab.setVisible(true);

		return () => {
			tab.destroy();
			tabWrapper.Destroy();
		};
	},
);

export = story;
