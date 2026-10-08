import { CreateGenericStory, Boolean, String } from "@rbxts/ui-labs";
import { MainMenuView, DEFAULT_MAIN_MENU_BANNER, DEFAULT_MAIN_MENU_LOGO } from "./MainMenuView";

const story = CreateGenericStory(
	{
		name: "Main Menu",
		summary: "Main Menu layar penuh 16:9 Under Grid Subculture sesuai template HTML dengan sliding diamond indicator",
		controls: {
			isOpen: Boolean(true),
			bannerAssetId: String(DEFAULT_MAIN_MENU_BANNER),
			logoAssetId: String(DEFAULT_MAIN_MENU_LOGO),
		},
	},
	(props) => {
		const view = new MainMenuView(props.target);
		view.setBannerAssetId(props.controls.bannerAssetId);
		view.setLogoAssetId(props.controls.logoAssetId);

		if (props.controls.isOpen) {
			view.show();
		}

		view.onStart(() => {
			print("[MainMenuView Story] Start action clicked!");
		});

		const unsubscribe = props.subscribe((controls) => {
			view.setBannerAssetId(controls.bannerAssetId);
			view.setLogoAssetId(controls.logoAssetId);
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
