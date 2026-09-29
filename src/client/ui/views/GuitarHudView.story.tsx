import { Boolean, Choose, CreateGenericStory, Slider } from "@rbxts/ui-labs";
import { GUITAR_ANIMATION_CONFIG } from "shared/config";
import { GuitarHudView } from "./GuitarHudView";

const story = CreateGenericStory(
	{
		name: "Guitar HUD (Monochrome Guitar Session)",
		summary: "Vertical iOS Glassmorphic Pure Monochrome Guitar HUD with speed slider",
		controls: {
			visible: Boolean(true),
			activeAnimationId: Choose(["guitar_1", "guitar_2", "guitar_3"], 1),
			isPlaying: Boolean(true),
			speed: Slider(1.0, 0.2, 2.0, 0.1),
		},
	},
	(props) => {
		const hud = new GuitarHudView(props.target);
		if (props.controls.visible) {
			hud.show(
				GUITAR_ANIMATION_CONFIG.ANIMATIONS,
				props.controls.activeAnimationId,
				props.controls.isPlaying,
				props.controls.speed,
				(id) => print(`[Story] Selected guitar animation: ${id}`),
				(spd) => print(`[Story] Changed guitar speed: ${spd}`),
				() => print("[Story] Stop guitar playing clicked!"),
			);
		} else {
			hud.hide();
		}

		const unsubscribe = props.subscribe((controls) => {
			if (controls.visible) {
				hud.show(
					GUITAR_ANIMATION_CONFIG.ANIMATIONS,
					controls.activeAnimationId,
					controls.isPlaying,
					controls.speed,
					(id) => print(`[Story] Selected guitar animation: ${id}`),
					(spd) => print(`[Story] Changed guitar speed: ${spd}`),
					() => print("[Story] Stop guitar playing clicked!"),
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
