import { ReplicatedStorage, RunService } from "@rbxts/services";

/**
 * Helper to ensure a RemoteFolder exists in ReplicatedStorage.
 */
function getRemoteFolder(): Folder {
	let folder = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (!folder) {
		if (RunService.IsServer() || RunService.IsStudio()) {
			folder = new Instance("Folder");
			folder.Name = "Remotes";
			folder.Parent = ReplicatedStorage;
		} else {
			folder = ReplicatedStorage.WaitForChild("Remotes") as Folder;
		}
	}
	return folder;
}

/**
 * Get or create a RemoteEvent by name.
 */
export function getRemoteEvent(name: string): RemoteEvent {
	const folder = getRemoteFolder();
	let child = folder.FindFirstChild(name);

	if (child && !child.IsA("RemoteEvent")) {
		if (RunService.IsServer() || RunService.IsStudio()) {
			child.Destroy();
			child = undefined;
		} else {
			child = undefined;
		}
	}

	let event = child as RemoteEvent | undefined;
	if (!event) {
		if (RunService.IsServer() || RunService.IsStudio()) {
			event = new Instance("RemoteEvent");
			event.Name = name;
			event.Parent = folder;
		} else {
			event = folder.WaitForChild(name) as RemoteEvent;
		}
	}

	return event;
}

/**
 * Get or create a RemoteFunction by name.
 */
export function getRemoteFunction(name: string): RemoteFunction {
	const folder = getRemoteFolder();
	let child = folder.FindFirstChild(name);

	if (child && !child.IsA("RemoteFunction")) {
		if (RunService.IsServer() || RunService.IsStudio()) {
			child.Destroy();
			child = undefined;
		} else {
			child = undefined;
		}
	}

	let func = child as RemoteFunction | undefined;
	if (!func) {
		if (RunService.IsServer() || RunService.IsStudio()) {
			func = new Instance("RemoteFunction");
			func.Name = name;
			func.Parent = folder;
		} else {
			func = folder.WaitForChild(name) as RemoteFunction;
		}
	}

	return func;
}

/**
 * Get or create a BindableEvent by name.
 */
export function getBindableEvent(name: string): BindableEvent {
	const folder = getRemoteFolder();
	let child = folder.FindFirstChild(name);

	if (child && !child.IsA("BindableEvent")) {
		if (RunService.IsServer() || RunService.IsStudio()) {
			child.Destroy();
			child = undefined;
		} else {
			child = undefined;
		}
	}

	let event = child as BindableEvent | undefined;
	if (!event) {
		if (RunService.IsServer() || RunService.IsStudio()) {
			event = new Instance("BindableEvent");
			event.Name = name;
			event.Parent = folder;
		} else {
			event = folder.WaitForChild(name) as BindableEvent;
		}
	}

	return event;
}
