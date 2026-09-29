import { Boolean, Choose, CreateGenericStory } from "@rbxts/ui-labs";
import { SEAT_CONFIG } from "shared/config";
import { SitPoseHudView } from "./SitPoseHudView";

const story = CreateGenericStory(
	{
		name: "Sit Pose HUD (Vertical Sitting Pose Selector)",
		summary: "Vertical iOS Glassmorphic Sit Pose HUD showing sitting pose selection cards and stand-up button",
		controls: {
			visible: Boolean(true),
			activePoseId: Choose(["pose_1", "pose_2", "pose_3", "pose_4", "pose_5"], 1),
		},
	},
	(props) => {
		const hud = new SitPoseHudView(props.target);
		if (props.controls.visible) {
			hud.show(
				SEAT_CONFIG.POSES,
				props.controls.activePoseId,
				(id) => print(`[Story] Selected pose: ${id}`),
				() => print("[Story] Stand up clicked!"),
			);
		} else {
			hud.hide();
		}

		const unsubscribe = props.subscribe((controls) => {
			if (controls.visible) {
				hud.show(
					SEAT_CONFIG.POSES,
					controls.activePoseId,
					(id) => print(`[Story] Selected pose: ${id}`),
					() => print("[Story] Stand up clicked!"),
				);
			} else {
				hud.hide();
			}
		});

		return () => {
			unsubscribe();
			hud.destroy();
		};
	},
);

export = story;
