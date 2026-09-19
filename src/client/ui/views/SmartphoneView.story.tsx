import { CreateGenericStory, Boolean, Choose, Slider } from "@rbxts/ui-labs";
import { AppId } from "shared/types";
import { SmartphoneView } from "./SmartphoneView";

const story = CreateGenericStory(
	{
		name: "Smartphone (Full Shell)",
		summary: "Full iPhone-style smartphone shell with LockScreen, HomeScreen, AppRouter, and Dynamic Island",
		controls: {
			isOpen: Boolean(true),
			screen: Choose(
				["HomeScreen", "LockScreen", "Messages", "Music", "Settings", "Social", "Events"],
				1,
			),
			unreadMessages: Slider(3, 0, 99, 1),
		},
	},
	(props) => {
		const storyWrapper = new Instance("Frame");
		storyWrapper.Name = "StoryPhoneContainer";
		storyWrapper.Size = new UDim2(1, 0, 1, 0);
		storyWrapper.BackgroundTransparency = 1;
		storyWrapper.Parent = props.target;

		const phone = new SmartphoneView(storyWrapper);

		const applyControls = (c: typeof props.controls) => {
			if (!c.isOpen) {
				phone.close();
				return;
			}

			phone.open();
			phone.getHomeScreen().setBadge(AppId.Messages, c.unreadMessages);

			if (c.screen === "HomeScreen") {
				phone.getLockScreen().hide();
				phone.getAppRouter().hideAll();
				phone.getHomeScreen().show();
			} else if (c.screen === "LockScreen") {
				phone.getHomeScreen().hide();
				phone.getAppRouter().hideAll();
				phone.getLockScreen().show();
			} else {
				phone.getLockScreen().hide();
				phone.getHomeScreen().hide();
				const appMap: Record<string, AppId> = {
					Messages: AppId.Messages,
					Music: AppId.Music,
					Settings: AppId.Settings,
					Social: AppId.Social,
					Events: AppId.Events,
				};
				const targetApp = appMap[c.screen];
				if (targetApp) {
					phone.getAppRouter().openApp(targetApp);
				}
			}
		};

		applyControls(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			applyControls(controls);
		});

		return () => {
			unsubscribe();
			phone.destroy();
			storyWrapper.Destroy();
		};
	},
);

export = story;
