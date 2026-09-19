import { CreateGenericStory, Boolean } from "@rbxts/ui-labs";
import { SettingsModalView } from "./SettingsModalView";

const story = CreateGenericStory(
	{
		name: "Settings Modal (Game Settings)",
		summary: "Modern iOS Glassmorphic Game Settings Modal with Body Lean and Camera Bobbing motion toggles",
		controls: {
			isOpen: Boolean(true),
		},
	},
	(props) => {
		const settingsModal = new SettingsModalView(props.target);
		settingsModal.toggle(props.controls.isOpen);

		const unsubscribe = props.subscribe((controls) => {
			settingsModal.toggle(controls.isOpen);
		});

		return () => {
			unsubscribe();
			settingsModal.destroy();
		};
	},
);

export = story;
