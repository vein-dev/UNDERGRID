import { CreateGenericStory, Slider } from "@rbxts/ui-labs";
import { HotbarView, SlotData } from "./HotbarView";

const story = CreateGenericStory(
	{
		name: "Hotbar HUD",
		summary: "Bottom HUD standard 5-slot Hotbar with equipped states",
		controls: {
			filledSlots: Slider(3, 0, 5, 1),
			equippedSlot: Slider(1, 0, 5, 1),
		},
	},
	(props) => {
		const hotbar = new HotbarView(props.target);
		hotbar.setVisible(true);

		const dummyToolNames = ["Katana", "Health Potion", "Crossbow", "Energy Shield", "Grappling Hook"];
		const dummyIcons = [
			"rbxassetid://10849912198",
			"rbxassetid://10849912198",
			"rbxassetid://10849912198",
			"rbxassetid://10849912198",
			"rbxassetid://10849912198",
		];

		const dummyTools: Tool[] = [];
		for (let i = 0; i < 5; i++) {
			const tool = new Instance("Tool");
			tool.Name = dummyToolNames[i];
			tool.TextureId = dummyIcons[i];
			dummyTools.push(tool);
		}

		const applySlots = (filled: number, equipped: number) => {
			const slots = new Map<number, SlotData>();
			for (let i = 1; i <= 5; i++) {
				if (i <= filled) {
					slots.set(i, {
						tool: dummyTools[i - 1],
						isEquipped: i === equipped,
					});
				} else {
					slots.set(i, {
						tool: undefined,
						isEquipped: false,
					});
				}
			}
			hotbar.updateSlots(slots);
		};

		applySlots(props.controls.filledSlots, props.controls.equippedSlot);

		const unsubscribe = props.subscribe((controls) => {
			applySlots(controls.filledSlots, controls.equippedSlot);
		});

		return () => {
			unsubscribe();
			hotbar.destroy();
			for (const t of dummyTools) {
				t.Destroy();
			}
		};
	},
);

export = story;
