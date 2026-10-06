import { Boolean, CreateGenericStory } from "@rbxts/ui-labs";
import { FreecamHudView } from "./FreecamHudView";

const story = CreateGenericStory(
	{
		name: "FreecamHudView",
		summary: "Authentic Smartphone Camera Viewfinder (iOS Look) with Shutter Button, Zoom Pill, and Rule of Thirds Grid",
		controls: {
			visible: Boolean(true),
		},
	},
	(props) => {
		const hudView = new FreecamHudView(props.target);
		if (props.controls.visible) {
			hudView.show();
		} else {
			hudView.hide();
		}

		const unsubscribe = props.subscribe((controls) => {
			if (controls.visible) {
				hudView.show();
			} else {
				hudView.hide();
			}
		});

		return () => {
			unsubscribe();
			hudView.destroy();
		};
	},
);

export = story;
