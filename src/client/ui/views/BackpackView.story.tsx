import { Boolean, CreateGenericStory, Slider, String } from "@rbxts/ui-labs";
import { BackpackSlotInfo, BackpackView } from "./BackpackView";

const story = CreateGenericStory(
	{
		name: "Backpack & Inventory View",
		summary: "Interactive 3D Avatar Portrait, 5 Pickup Slots, 10 Storage Slots, and Search Filter",
		controls: {
			isOpen: Boolean(true),
			pickupFilled: Slider(3, 0, 5, 1),
			storageFilled: Slider(5, 0, 10, 1),
			searchFilter: String(""),
		},
	},
	(props) => {
		const backpack = new BackpackView(props.target);
		backpack.setVisible(props.controls.isOpen);

		const sampleToolNames = [
			"Smartphone",
			"Radio Device",
			"Security Lock",
			"Health Pack",
			"Lightning Core",
			"Wrench Tool",
			"Mini Camera",
			"Paint Tool",
			"Access Key",
			"Processor Chip",
			"Battery Pack",
			"Audio Headset",
		];

		const createdTools: Tool[] = [];
		for (const name of sampleToolNames) {
			const tool = new Instance("Tool");
			tool.Name = name;
			tool.TextureId = ""; // Uses crisp smart Lucide icons
			createdTools.push(tool);
		}

		const applyData = (pickupCount: number, storageCount: number, filter: string) => {
			const pickup = new Map<number, BackpackSlotInfo>();
			for (let i = 1; i <= BackpackView.PICKUP_SLOT_COUNT; i++) {
				if (i <= pickupCount) {
					const tool = createdTools[i - 1];
					pickup.set(i, {
						tool: tool,
						isSelected: i === 1,
						isEquipped: i === 1,
					});
				} else {
					pickup.set(i, { tool: undefined, isSelected: false });
				}
			}

			const storage = new Map<number, BackpackSlotInfo>();
			for (let i = 1; i <= BackpackView.STORAGE_SLOT_COUNT; i++) {
				if (i <= storageCount) {
					const tool = createdTools[(i - 1) % createdTools.size()];
					storage.set(i, {
						tool: tool,
						isSelected: false,
					});
				} else {
					storage.set(i, { tool: undefined, isSelected: false });
				}
			}

			backpack.updatePickupSlots(pickup);
			backpack.updateStorageSlots(storage, filter);
		};

		applyData(props.controls.pickupFilled, props.controls.storageFilled, props.controls.searchFilter);

		const unsubscribe = props.subscribe((controls) => {
			backpack.setVisible(controls.isOpen);
			applyData(controls.pickupFilled, controls.storageFilled, controls.searchFilter);
		});

		return () => {
			unsubscribe();
			backpack.destroy();
			for (const t of createdTools) {
				t.Destroy();
			}
		};
	},
);

export = story;
