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
			steerDirection: Choose(["Neutral", "Left", "Right"], 1),
		},
	},
	(props) => {
		if (RunService.IsRunning()) {
			return () => {};
		}

		const mobileView = new SkateboardMobileView(props.target);

		mobileView.setCallbacks({
			onPushDown: () => print("[UI-Labs Skateboard] Push Down"),
			onPushUp: () => print("[UI-Labs Skateboard] Push Up"),
			onBrakeDown: () => print("[UI-Labs Skateboard] Brake Down"),
			onBrakeUp: () => print("[UI-Labs Skateboard] Brake Up"),
			onOllieDown: () => print("[UI-Labs Skateboard] Ollie Down"),
			onOllieUp: () => print("[UI-Labs Skateboard] Ollie Up"),
			onSteerLeftDown: () => print("[UI-Labs Skateboard] Steer Left Down"),
			onSteerLeftUp: () => print("[UI-Labs Skateboard] Steer Left Up"),
			onSteerRightDown: () => print("[UI-Labs Skateboard] Steer Right Down"),
			onSteerRightUp: () => print("[UI-Labs Skateboard] Steer Right Up"),
			onTrick: (trickName) => print(`[UI-Labs Skateboard] Trick: ${trickName}`),
			onDismount: () => print("[UI-Labs Skateboard] Dismount clicked"),
		});

		const applyControls = (c: typeof props.controls) => {
			mobileView.setVisible(c.visible);
			mobileView.setChargingOllie(c.isChargingOllie);
			mobileView.setPushing(c.isPushing);
			mobileView.setBraking(c.isBraking);

			const steerVal =
				c.steerDirection === "Left" ? -1 : c.steerDirection === "Right" ? 1 : 0;
			mobileView.setSteerDirection(steerVal);
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
