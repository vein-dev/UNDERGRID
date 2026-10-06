import { CreateGenericStory } from "@rbxts/ui-labs";
import { CameraApp } from "./CameraApp";

const story = CreateGenericStory(
	{
		name: "Camera App",
		summary: "Smartphone Camera & Drone app with Freecam launcher, FOV presets, and flight speed",
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

		const cameraApp = new CameraApp(phoneWrapper);
		cameraApp.show();

		return () => {
			cameraApp.destroy();
			phoneWrapper.Destroy();
		};
	},
);

export = story;
