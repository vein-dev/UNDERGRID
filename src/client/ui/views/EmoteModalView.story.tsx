import { CreateGenericStory, Boolean } from "@rbxts/ui-labs";
import { EmoteModalView } from "./EmoteModalView";

const story = CreateGenericStory(
	{
		name: "Emotes & Reactions Panel",
		summary: "Compact vertical modern gaming emote wheel / panel with category tabs and search",
		controls: {
			isOpen: Boolean(true),
		},
	},
	(props) => {
		const emoteModal = new EmoteModalView(props.target);
		emoteModal.toggle(props.controls.isOpen);

		const unsubscribe = props.subscribe((controls) => {
			emoteModal.toggle(controls.isOpen);
		});

		return () => {
			unsubscribe();
			emoteModal.destroy();
		};
	},
);

export = story;
