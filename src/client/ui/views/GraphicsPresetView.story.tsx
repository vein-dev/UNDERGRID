import { CreateGenericStory, Boolean } from "@rbxts/ui-labs";
import { GraphicsPresetView } from "./GraphicsPresetView";

const story = CreateGenericStory(
	{
		name: "Graphics Preset",
		summary: "Graphics Preset menu 4 kartu preset (Low, Medium, High, Ultra) sesuai template HTML",
		controls: {
			isOpen: Boolean(true),
		},
	},
	(props) => {
		const view = new GraphicsPresetView(props.target);

		if (props.controls.isOpen) {
			view.show();
		}

		view.onClose(() => {
			print("[GraphicsPresetView Story] Closed!");
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
