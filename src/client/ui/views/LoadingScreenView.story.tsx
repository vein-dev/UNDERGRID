import { CreateGenericStory, Boolean, String, Slider } from "@rbxts/ui-labs";
import { LoadingScreenView, DEFAULT_LOADING_LOGO } from "./LoadingScreenView";

const story = CreateGenericStory(
	{
		name: "Cinematic Loading Screen",
		summary: "Layar pemuatan minimalis sinematik 16:9 Under Grid Subculture dengan pulsing logo dan slim progress bar",
		controls: {
			isOpen: Boolean(true),
			logoAssetId: String(DEFAULT_LOADING_LOGO),
			progress: Slider(0.45, 0, 1, 0.01),
		},
	},
	(props) => {
		const view = new LoadingScreenView(props.target);
		view.setLogoAssetId(props.controls.logoAssetId);
		view.setManualProgress(props.controls.progress);
		if (props.controls.isOpen) {
			view.show();
		}

		const unsubscribe = props.subscribe((controls) => {
			view.setLogoAssetId(controls.logoAssetId);
			view.setManualProgress(controls.progress);
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
