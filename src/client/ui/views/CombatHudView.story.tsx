import { RunService } from "@rbxts/services";
import { Boolean, CreateGenericStory, Slider } from "@rbxts/ui-labs";
import { CombatHudView } from "./CombatHudView";

const story = CreateGenericStory(
	{
		name: "Combat HUD (Fight Mode)",
		summary: "Bottom-right Health & Stamina HUD and Clash Duel Minigame Overlay appearing during combat fight mode",
		controls: {
			fightModeActive: Boolean(true),
			isMobile: Boolean(true),
			health: Slider(100, 0, 100, 1),
			maxHealth: Slider(100, 50, 200, 10),
			stamina: Slider(70, 0, 70, 1),
			maxStamina: Slider(70, 50, 200, 10),
			isBlocking: Boolean(false),
			isSprinting: Boolean(false),
			inClash: Boolean(false),
			yourPresses: Slider(15, 0, 50, 1),
			enemyPresses: Slider(12, 0, 50, 1),
		},
	},
	(props) => {
		// When active gameplay is running (Play Solo / Run), do not render the storybook mockup over the live game
		if (RunService.IsRunning()) {
			return () => {};
		}

		const combatHud = new CombatHudView(props.target);

		const applyControls = (c: typeof props.controls) => {
			combatHud.setMobile(c.isMobile);
			combatHud.setCombatStates(c.isBlocking, c.isSprinting);
			combatHud.setVisible(c.fightModeActive);
			combatHud.setHealth(c.health, c.maxHealth);
			combatHud.setStamina(c.stamina, c.maxStamina);

			if (c.inClash) {
				combatHud.showClash();
				combatHud.updateClash(c.yourPresses, c.enemyPresses);
			} else {
				combatHud.hideClash();
			}
		};

		applyControls(props.controls);

		const unsubscribe = props.subscribe((controls) => {
			applyControls(controls);
		});

		return () => {
			unsubscribe();
			combatHud.destroy();
		};
	},
);

export = story;
