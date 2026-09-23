import { CreateGenericStory, String, Number } from "@rbxts/ui-labs";
import { AnnouncementOverlayView } from "./AnnouncementOverlayView";

const story = CreateGenericStory(
	{
		name: "Announcement Fullscreen Overlay",
		summary: "Cinematic full-screen broadcast announcement with dynamic scale and fade animation",
		controls: {
			text: String("MC NAIK PANGGUNG DALAM 1 MENIT! HARAP BERSIAP!"),
			duration: Number(5.0, 1.0, 15.0, 0.5),
		},
	},
	(props) => {
		const overlay = new AnnouncementOverlayView(props.target);

		const trigger = (c: typeof props.controls) => {
			overlay.show(c.text, c.duration);
		};

		trigger(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			trigger(controls);
		});

		return () => {
			unsubscribe();
			overlay.destroy();
		};
	},
);

export = story;

