import { CreateGenericStory } from "@rbxts/ui-labs";
import { AdminTimeTab } from "./AdminTimeTab";

const story = CreateGenericStory(
	{
		name: "Admin Time Control Tab",
		summary: "Tab 4: Dynamic day/night cycle time controls, quick presets, and speed multipliers",
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

		const tab = new AdminTimeTab(tabWrapper);
		tab.setVisible(true);

		return () => {
			tab.destroy();
			tabWrapper.Destroy();
		};
	},
);

export = story;
