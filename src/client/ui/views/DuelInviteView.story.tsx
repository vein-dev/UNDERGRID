import { Boolean, CreateGenericStory, Number, String } from "@rbxts/ui-labs";
import { DuelInviteView } from "./DuelInviteView";

const story = CreateGenericStory(
	{
		name: "Duel Invite Prompt",
		summary: "Modal prompt showing challenger information, countdown timer, and accept/decline buttons",
		controls: {
			visible: Boolean(true),
			challengerDisplayName: String("RebelRider"),
			challengerName: String("rebel_skater"),
			durationSeconds: Number(15, 5, 30, 1),
		},
	},
	(props) => {
		const view = DuelInviteView.getInstance(props.target);

		const trigger = (c: typeof props.controls) => {
			if (c.visible) {
				view.show(
					{
						challengerUserId: 1,
						challengerName: c.challengerName,
						challengerDisplayName: c.challengerDisplayName,
						durationSeconds: c.durationSeconds,
					},
					() => print("[Story] Accepted duel"),
					() => print("[Story] Declined duel"),
				);
			} else {
				view.hide();
			}
		};

		trigger(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			trigger(controls);
		});

		return () => {
			unsubscribe();
			view.destroy();
		};
	},
);

export = story;
