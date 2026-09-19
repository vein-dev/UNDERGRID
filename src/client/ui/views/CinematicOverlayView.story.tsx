import { Boolean, CreateGenericStory } from "@rbxts/ui-labs";
import { CinematicOverlayView } from "./CinematicOverlayView";

const story = CreateGenericStory(
	{
		name: "Cinematic Letterbox Overlay",
		summary: "Top and bottom black cinematic letterbox bars for spawn intro without text",
		controls: {
			visible: Boolean(true),
		},
	},
	(props) => {
		const storyWrapper = new Instance("Frame");
		storyWrapper.Name = "StoryCinematicContainer";
		storyWrapper.Size = new UDim2(1, 0, 1, 0);
		storyWrapper.BackgroundTransparency = 1;
		storyWrapper.Parent = props.target;

		const overlay = new CinematicOverlayView(storyWrapper);

		const applyControls = (c: typeof props.controls) => {
			if (c.visible) {
				overlay.show();
			} else {
				overlay.hide();
			}
		};

		applyControls(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			applyControls(controls);
		});

		return () => {
			unsubscribe();
			overlay.destroy();
			storyWrapper.Destroy();
		};
	},
);

export = story;
