import { Choose, CreateGenericStory } from "@rbxts/ui-labs";
import { AdminTab } from "shared/types";
import { AdminPanelView } from "./AdminPanelView";

const story = CreateGenericStory(
	{
		name: "Admin Controller (Full Modal)",
		summary: "Modular Admin Panel with tabs for Audio Hub, Stage & FX, and Player Management",
		controls: {
			selectedTab: Choose([AdminTab.MusicMaster, AdminTab.StageFx, AdminTab.PlayerManagement], 1),
		},
	},
	(props) => {
		const adminPanel = new AdminPanelView(props.target);
		adminPanel.show();
		adminPanel.switchTab(props.controls.selectedTab);

		const unsubscribe = props.subscribe((controls) => {
			adminPanel.switchTab(controls.selectedTab);
		});

		return () => {
			unsubscribe();
			adminPanel.destroy();
		};
	},
);

export = story;
