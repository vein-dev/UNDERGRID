import { CreateGenericStory, Slider } from "@rbxts/ui-labs";
import { AppId } from "shared/types";
import { HomeScreenView } from "./HomeScreenView";

const story = CreateGenericStory(
	{
		name: "Smartphone Home Screen",
		summary: "iOS-styled Home Screen with upper app grid, bottom dock, and unread notification badges",
		controls: {
			unreadMessages: Slider(3, 0, 99, 1),
		},
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

		const homeScreen = new HomeScreenView(phoneWrapper);
		homeScreen.show();
		homeScreen.setBadge(AppId.Messages, props.controls.unreadMessages);

		const unsubscribe = props.subscribe((controls) => {
			homeScreen.setBadge(AppId.Messages, controls.unreadMessages);
		});

		return () => {
			unsubscribe();
			homeScreen.destroy();
			phoneWrapper.Destroy();
		};
	},
);

export = story;
