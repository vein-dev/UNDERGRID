import { CreateGenericStory } from "@rbxts/ui-labs";
import { LockScreenView } from "./LockScreenView";

const story = CreateGenericStory(
	{
		name: "Smartphone Lock Screen",
		summary: "Lock screen showing large GMT+7 digital clock, date format, and swipe/tap prompt",
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

		const lockScreen = new LockScreenView(phoneWrapper);
		lockScreen.show();
		lockScreen.updateClock();

		return () => {
			lockScreen.destroy();
			phoneWrapper.Destroy();
		};
	},
);

export = story;
