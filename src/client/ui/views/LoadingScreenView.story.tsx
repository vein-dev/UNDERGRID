import { CreateGenericStory, Boolean, String, Slider } from "@rbxts/ui-labs";
import { LoadingScreenView } from "./LoadingScreenView";
import { GameConfig } from "shared/config/GameConfig";

const story = CreateGenericStory(
	{
		name: "Custom Loading Screen",
		summary: "Layar pemuatan modern minimalis bergaya iOS dengan background wallpaper dan animasi smooth progress bar",
		controls: {
			isOpen: Boolean(true),
			backgroundImage: String(GameConfig.LOADING_SCREEN.BACKGROUND_IMAGE),
			overlayTransparency: Slider(GameConfig.LOADING_SCREEN.OVERLAY_TRANSPARENCY, 0, 1, 0.05),
		},
	},
	(props) => {
		const view = new LoadingScreenView(props.target);
		view.setBackgroundImage(props.controls.backgroundImage, props.controls.overlayTransparency);
		view.show();

		const unsubscribe = props.subscribe((controls) => {
			view.setBackgroundImage(controls.backgroundImage, controls.overlayTransparency);
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
