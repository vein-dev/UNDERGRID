import { Boolean, CreateGenericStory } from "@rbxts/ui-labs";
import { StageCameraOverlayView } from "./StageCameraOverlayView";

const story = CreateGenericStory(
	{
		name: "Stage Camera Cinematic Frame",
		summary: "Cinematic letterbox frame (top & bottom black bars) during live stage camera broadcast",
		controls: {
			active: Boolean(true),
		},
	},
	(props) => {
		const storyWrapper = new Instance("Frame");
		storyWrapper.Name = "StoryStageCamCinematicContainer";
		storyWrapper.Size = new UDim2(1, 0, 1, 0);
		storyWrapper.BackgroundTransparency = 1;
		storyWrapper.Parent = props.target;

		const view = new StageCameraOverlayView(storyWrapper);

		const applyControls = (c: typeof props.controls) => {
			if (c.active) {
				view.show();
			} else {
				view.hide();
			}
		};

		applyControls(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			applyControls(controls);
		});

		return () => {
			unsubscribe();
			view.destroy();
			storyWrapper.Destroy();
		};
	},
);

export = story;
