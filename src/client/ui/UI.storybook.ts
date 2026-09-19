import { Storybook } from "@rbxts/ui-labs";
import { StarterPlayer } from "@rbxts/services";

const sps = StarterPlayer.WaitForChild("StarterPlayerScripts") as StarterPlayerScripts;
const ts = sps.WaitForChild("TS") as Folder;
const uiFolder = ts.WaitForChild("ui") as Folder;

const storybook: Storybook = {
	name: "Game System UI",
	storyRoots: [
		uiFolder.WaitForChild("components"),
		uiFolder.WaitForChild("views"),
		uiFolder.WaitForChild("apps"),
		uiFolder.WaitForChild("admin"),
	],
	groupRoots: true,
};

export = storybook;
