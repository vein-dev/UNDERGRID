import { CreateGenericStory, Boolean } from "@rbxts/ui-labs";
import { CreditsView } from "./CreditsView";

const story = CreateGenericStory(
	{
		name: "Credits View",
		summary: "Credits View dengan infinite rolling credits, hover pause, vignette fades, dan tombol Back sesuai template HTML Undergrid",
		controls: {
			isOpen: Boolean(true),
		},
	},
	(props) => {
		const view = new CreditsView(props.target);

		if (props.controls.isOpen) {
			view.show();
		}

		view.onClose(() => {
			print("[CreditsView Story] Closed!");
		});

		const unsubscribe = props.subscribe((controls) => {
			if (controls.isOpen) {
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
