import { CreateGenericStory, Number } from "@rbxts/ui-labs";
import { AfkOverlayView } from "./AfkOverlayView";

const story = CreateGenericStory(
	{
		name: "AfkOverlayView",
		summary: "Floating top banner and controls for active AFK mode",
		controls: {
			elapsedSeconds: Number(65, 0, 3600, 5),
		},
	},
	(props) => {
		const overlay = new AfkOverlayView(props.target);

		const trigger = (c: typeof props.controls) => {
			overlay.show(os.time() - c.elapsedSeconds);
		};

		trigger(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			trigger(controls);
		});

		return () => {
			unsubscribe();
			overlay.destroy();
		};
	},
);

export = story;
