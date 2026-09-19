import { CreateGenericStory, Boolean } from "@rbxts/ui-labs";
import { LoadingScreenView } from "./LoadingScreenView";

const story = CreateGenericStory(
	{
		name: "Custom Loading Screen",
		summary: "Layar pemuatan modern minimalis bergaya iOS dengan animasi smooth progress bar",
		controls: {
			isOpen: Boolean(true),
		},
	},
	(props) => {
		const view = new LoadingScreenView(props.target);
		view.show();

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
