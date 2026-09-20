import { RunService } from "@rbxts/services";
import { Boolean, Choose, CreateGenericStory } from "@rbxts/ui-labs";
import { SkateboardMobileView } from "./SkateboardMobileView";

const story = CreateGenericStory(
	{
		name: "Skateboard Mobile Touch Controls",
		summary: "On-screen touch controls cluster (Ollie, Push, Brake, Steer, Tricks, and Dismount) appearing when mounted on a skateboard on mobile devices",
		controls: {
			visible: Boolean(true),
			isChargingOllie: Boolean(false),
			isPushing: Boolean(false),
			isBraking: Boolean(false),
			steerDirection: Choose([-1, 0, 1], 0),
		},
	},
	(props) => {
		if (RunService.IsRunning()) {
			return () => {};
		}

		const mobileView = new SkateboardMobileView(props.target);

		const applyControls = (c: typeof props.controls) => {
			mobileView.setVisible(c.visible);
			mobileView.setChargingOllie(c.isChargingOllie);
			mobileView.setPushing(c.isPushing);
			mobileView.setBraking(c.isBraking);
			mobileView.setSteerDirection(c.steerDirection);
		};

		applyControls(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			applyControls(controls);
		});

		return () => {
			unsubscribe();
			mobileView.destroy();
		};
	},
);

export = story;
