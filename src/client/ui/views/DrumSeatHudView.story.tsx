import { Boolean, Choose, CreateGenericStory, Slider } from "@rbxts/ui-labs";
import { DRUM_SEAT_CONFIG } from "shared/config";
import { DrumSeatHudView } from "./DrumSeatHudView";

const story = CreateGenericStory(
	{
		name: "Drum Seat HUD (Monochrome Drum Session)",
		summary: "Vertical iOS Glassmorphic Pure Monochrome Drum Seat HUD with speed slider",
		controls: {
			visible: Boolean(true),
			activeBeatId: Choose(["drum_beat_1", "drum_beat_2"], 1),
			speed: Slider(1.0, 0.2, 2.0, 0.1),
		},
	},
	(props) => {
		const hud = new DrumSeatHudView(props.target);
		if (props.controls.visible) {
			hud.show(
				DRUM_SEAT_CONFIG.BEATS,
				props.controls.activeBeatId,
				props.controls.speed,
				(id) => print(`[Story] Selected drum beat: ${id}`),
				(spd) => print(`[Story] Changed drum speed: ${spd}`),
				() => print("[Story] Stop drum clicked!"),
			);
		} else {
			hud.hide();
		}

		const unsubscribe = props.subscribe((controls) => {
			if (controls.visible) {
				hud.show(
					DRUM_SEAT_CONFIG.BEATS,
					controls.activeBeatId,
					controls.speed,
					(id) => print(`[Story] Selected drum beat: ${id}`),
					(spd) => print(`[Story] Changed drum speed: ${spd}`),
					() => print("[Story] Stop drum clicked!"),
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
