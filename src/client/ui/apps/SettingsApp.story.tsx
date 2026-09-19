import { CreateGenericStory } from "@rbxts/ui-labs";
import { SettingsApp } from "./SettingsApp";

const story = CreateGenericStory(
	{
		name: "Settings App",
		summary: "iOS-styled Settings application with system preferences, notification sounds, and appearance toggles",
		controls: {},
	},
	(props) => {
		const phoneWrapper = new Instance("Frame");
		phoneWrapper.Size = new UDim2(0, 340, 0, 680);
		phoneWrapper.AnchorPoint = new Vector2(0.5, 0.5);
		phoneWrapper.Position = new UDim2(0.5, 0, 0.5, 0);
		phoneWrapper.BackgroundColor3 = Color3.fromHex("#0c0c0c");
		phoneWrapper.ClipsDescendants = true;
		phoneWrapper.Parent = props.target;

		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 36);
		corner.Parent = phoneWrapper;

		const settingsApp = new SettingsApp(phoneWrapper);
		settingsApp.show();

		return () => {
			settingsApp.destroy();
			phoneWrapper.Destroy();
		};
	},
);

export = story;
