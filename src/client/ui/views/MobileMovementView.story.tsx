import { RunService } from "@rbxts/services";
import { Boolean, CreateGenericStory } from "@rbxts/ui-labs";
import { MobileMovementView } from "./MobileMovementView";

const story = CreateGenericStory(
	{
		name: "Mobile Movement Controls",
		summary: "On-screen ergonomic arc virtual touch movement cluster (Jump, Sprint, Crouch, Crawl) for mobile devices with iOS glassmorphism and reactive feedback",
		controls: {
			visible: Boolean(true),
			isSprinting: Boolean(false),
			isCrouching: Boolean(false),
			isCrawling: Boolean(false),
		},
	},
	(props) => {
		if (RunService.IsRunning()) {
			return () => {};
		}

		const movementView = new MobileMovementView(props.target);

		const applyControls = (c: typeof props.controls) => {
			movementView.setVisible(c.visible);
			movementView.setMovementStates(c.isSprinting, c.isCrouching, c.isCrawling);
		};

		applyControls(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			applyControls(controls);
		});

		return () => {
			unsubscribe();
			movementView.destroy();
		};
	},
);

export = story;
