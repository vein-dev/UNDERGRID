import { CreateGenericStory, String } from "@rbxts/ui-labs";
import { MusicApp } from "./MusicApp";

const story = CreateGenericStory(
	{
		name: "Music Player App",
		summary: "iOS-styled music player with spinning vinyl disc, scrubber progress, transport controls, and queue modal",
		controls: {
			trackTitle: String("Neon Horizon"),
			artist: String("Cyber Pulse"),
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

		const musicApp = new MusicApp(phoneWrapper);
		musicApp.show();

		return () => {
			musicApp.destroy();
			phoneWrapper.Destroy();
		};
	},
);

export = story;
