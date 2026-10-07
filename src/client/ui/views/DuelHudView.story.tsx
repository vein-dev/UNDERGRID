import { Choose, CreateGenericStory, Number, String } from "@rbxts/ui-labs";
import { DuelHudView } from "./DuelHudView";

const story = CreateGenericStory(
	{
		name: "Duel HUD & Banners",
		summary: "Countdown 3-2-1 Fight overlay, active opponent health tracker bar, and end result banner",
		controls: {
			mode: Choose(["Countdown", "Active", "Ended", "None"], 1),
			countdownNumber: Choose(["3", "2", "1", "FIGHT!"], 1),
			opponentName: String("ShadowBrawler"),
			isWinner: Choose(["Victory", "Defeat"], 1),
		},
	},
	(props) => {
		const view = DuelHudView.getInstance(props.target);

		const trigger = (c: typeof props.controls) => {
			if (c.mode === "Countdown") {
				view.startCountdown(3);
			} else if (c.mode === "Active") {
				view.showActive({
					opponentUserId: 1,
					opponentName: c.opponentName,
					opponentDisplayName: c.opponentName,
					startTime: os.clock(),
				});
			} else if (c.mode === "Ended") {
				view.showEnded({
					winnerUserId: c.isWinner === "Victory" ? 0 : 1,
					winnerName: c.isWinner === "Victory" ? "LocalPlayer" : c.opponentName,
					loserUserId: c.isWinner === "Victory" ? 1 : 0,
					loserName: c.isWinner === "Victory" ? c.opponentName : "LocalPlayer",
					reason: "Knockout",
				});
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
