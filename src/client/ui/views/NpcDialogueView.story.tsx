import { Boolean, Choose, CreateGenericStory } from "@rbxts/ui-labs";
import { NPC_CONFIG } from "shared/config";
import { NpcDialogueView } from "./NpcDialogueView";

const story = CreateGenericStory(
	{
		name: "NPC Dialogue View (Twins Skateboard)",
		summary: "iOS Glassmorphic Dark Monochrome NPC Dialogue Box for Twins with dynamic node switching",
		controls: {
			visible: Boolean(true),
			nodeId: Choose(["greeting", "grant_board", "already_has_board", "goodbye"], 1),
		},
	},
	(props) => {
		const view = new NpcDialogueView(props.target);

		view.setCallbacks({
			onSelectOption: (option) => {
				print(`[NpcDialogueView Story] Option clicked: ${option.label} (${option.action ?? option.nextNodeId})`);
				if (option.nextNodeId) {
					view.setCurrentNode(option.nextNodeId);
				} else if (option.action === "close") {
					view.hide();
				}
			},
			onClose: () => {
				print("[NpcDialogueView Story] Dialogue closed!");
				view.hide();
			},
		});

		if (props.controls.visible) {
			view.show(NPC_CONFIG.TWINS.DIALOGUE_TREE, props.controls.nodeId);
		} else {
			view.hide();
		}

		const unsubscribe = props.subscribe((controls) => {
			if (controls.visible) {
				view.show(NPC_CONFIG.TWINS.DIALOGUE_TREE, controls.nodeId);
			} else {
				view.hide();
			}
		});

		return () => {
			unsubscribe();
			view.destroy();
		};
	},
);

export = story;
