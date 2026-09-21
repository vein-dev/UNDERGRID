import { CreateGenericStory, Boolean } from "@rbxts/ui-labs";
import { LightingRemoteView } from "./LightingRemoteView";

const story = CreateGenericStory(
	{
		name: "Lighting Remote HUD",
		summary: "Floating DMX Stage Lighting Remote HUD with Live Modes, Colors, Strobe, and Trim",
		controls: {
			visible: Boolean(true),
		},
	},
	(props) => {
		const view = new LightingRemoteView(props.target);

		if (props.controls.visible) {
			view.show();
		} else {
			view.hide();
		}

		const unsubscribe = props.subscribe((controls) => {
			if (controls.visible) {
				view.show();
			} else {
				view.hide();
			}
		});

		return () => {
			unsubscribe();
			view.destroy();
		};
	},
);

export = story;
