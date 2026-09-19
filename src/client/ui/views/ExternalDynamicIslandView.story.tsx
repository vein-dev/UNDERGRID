import { CreateGenericStory, Boolean, String } from "@rbxts/ui-labs";
import { ExternalDynamicIslandView } from "./ExternalDynamicIslandView";

const story = CreateGenericStory(
	{
		name: "External Dynamic Island",
		summary: "Floating iOS Dynamic Island pill notification when the smartphone is closed",
		controls: {
			title: String("Undergrid Live Gig"),
			message: String("DJ Astra is now live on Main Stage!"),
			badge: String("ticket"),
			isUrgent: Boolean(true),
		},
	},
	(props) => {
		const island = new ExternalDynamicIslandView(props.target);

		const triggerIsland = (c: typeof props.controls) => {
			island.show({
				title: c.title,
				message: c.message,
				subtext: "now",
				badgeText: c.badge,
				badgeColor: Color3.fromHex("#2a2a2a"),
				duration: 9999, // Keep visible for testing
				isUrgent: c.isUrgent,
			});
		};

		triggerIsland(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			triggerIsland(controls);
		});

		return () => {
			unsubscribe();
			island.destroy();
		};
	},
);

export = story;
