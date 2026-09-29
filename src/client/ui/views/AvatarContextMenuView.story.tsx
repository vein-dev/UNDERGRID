import { Boolean, Choose, CreateGenericStory, String } from "@rbxts/ui-labs";
import { Players } from "@rbxts/services";
import { AvatarTargetPlayer } from "shared/types";
import { AvatarContextMenuView } from "./AvatarContextMenuView";

const MOCK_PLAYERS: AvatarTargetPlayer[] = [
	{
		player: Players.LocalPlayer,
		userId: 24163092,
		displayName: "astrxsh666",
		username: "astrxsh666",
		isFriend: false,
		isSyncing: false,
		distance: 8.5,
	},
	{
		player: Players.LocalPlayer,
		userId: 1,
		displayName: "Roblox",
		username: "Roblox",
		isFriend: true,
		isSyncing: false,
		distance: 12.0,
	},
	{
		player: Players.LocalPlayer,
		userId: 156,
		displayName: "Builderman",
		username: "builderman",
		isFriend: false,
		isSyncing: true,
		distance: 15.2,
	},
];

const story = CreateGenericStory(
	{
		name: "Avatar Context Menu (Player Interaction)",
		summary: "iOS Glassmorphic Avatar Context Menu with nearby player carousel, Sync/Unsync, Friends, and Inspect Avatar",
		controls: {
			visible: Boolean(true),
			selectedPlayer: Choose(["astrxsh666", "Roblox", "Builderman"], 1),
			isSyncing: Boolean(false),
			isFriend: Boolean(false),
		},
	},
	(props) => {
		const menu = new AvatarContextMenuView(props.target);

		const getTarget = (name: string, isSync: boolean, isFr: boolean): AvatarTargetPlayer => {
			const found = MOCK_PLAYERS.find((p) => p.displayName === name) ?? MOCK_PLAYERS[0];
			return {
				...found,
				isSyncing: isSync,
				isFriend: isFr,
			};
		};

		const initialTarget = getTarget(
			props.controls.selectedPlayer,
			props.controls.isSyncing,
			props.controls.isFriend,
		);

		menu.setCallbacks({
			onAction: (action, target) => {
				print(`[AvatarContextMenu Story] Clicked action: ${action} for ${target.displayName}`);
			},
			onSelectTarget: (target) => {
				print(`[AvatarContextMenu Story] Selected target from carousel: ${target.displayName}`);
				menu.setTarget(target);
			},
			onClose: () => {
				print("[AvatarContextMenu Story] Closed!");
			},
		});

		if (props.controls.visible) {
			menu.show(initialTarget, MOCK_PLAYERS);
		} else {
			menu.hide();
		}

		const unsubscribe = props.subscribe((controls) => {
			if (controls.visible) {
				const updatedTarget = getTarget(
					controls.selectedPlayer,
					controls.isSyncing,
					controls.isFriend,
				);
				menu.show(updatedTarget, MOCK_PLAYERS);
			} else {
				menu.hide();
			}
		});

		return () => {
			unsubscribe();
			menu.destroy();
		};
	},
);

export = story;
