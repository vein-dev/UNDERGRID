import { CreateGenericStory, Slider } from "@rbxts/ui-labs";
import { HotbarView, SlotData } from "./HotbarView";

const story = CreateGenericStory(
	{
		name: "Hotbar HUD",
		summary: "Bottom HUD modern 5-slot Hotbar dock with 150ms pop-up transition",
		controls: {
			filledSlots: Slider(5, 0, 5, 1),
			equippedSlot: Slider(1, 0, 5, 1),
		},
	},
	(props) => {
		const hotbar = new HotbarView(props.target);
		hotbar.setVisible(true);

		const dummyToolNames = ["Item 01", "Item 02", "Item 03", "Item 04", "Item 05"];
		const dummyIcons = [
			"rbxassetid://10849912198",
			"",
			"rbxassetid://10849912198",
			"",
			"rbxassetid://10849912198",
		];

		const dummyTools: Tool[] = [];
		for (let i = 0; i < 5; i++) {
			const tool = new Instance("Tool");
			tool.Name = dummyToolNames[i];
			tool.TextureId = dummyIcons[i];
			dummyTools.push(tool);
		}

		let currentEquipped = props.controls.equippedSlot;

		const applySlots = (filled: number, equipped: number) => {
			currentEquipped = equipped;
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

		hotbar.onSlotClicked((slotNum) => {
			const nextEquipped = currentEquipped === slotNum ? 0 : slotNum;
			applySlots(props.controls.filledSlots, nextEquipped);
		});

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
