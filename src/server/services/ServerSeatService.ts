import { CollectionService, Workspace } from "@rbxts/services";
import { DRUM_SEAT_CONFIG, SEAT_CONFIG } from "shared/config";

/**
 * ServerSeatService - Server service ensuring seat instances are properly tagged
 * with the designated CollectionService seat tag (drum_seat for drums, seat for regular).
 */
export class ServerSeatService {
	private static instance?: ServerSeatService;

	private constructor() {}

	public static getInstance(): ServerSeatService {
		if (!ServerSeatService.instance) {
			ServerSeatService.instance = new ServerSeatService();
		}
		return ServerSeatService.instance;
	}

	public init(): void {
		let regularCount = 0;
		let drumCount = 0;

		const tagIfSeat = (inst: Instance) => {
			if (inst.IsA("Seat")) {
				const isDrum =
					inst.FindFirstAncestor("Drum") !== undefined ||
					inst.Name.lower().find("drum")[0] !== undefined ||
					inst.Parent?.Name.lower().find("drum")[0] !== undefined;

				if (isDrum) {
					if (CollectionService.HasTag(inst, SEAT_CONFIG.TAG)) {
						CollectionService.RemoveTag(inst, SEAT_CONFIG.TAG);
					}
					if (!CollectionService.HasTag(inst, DRUM_SEAT_CONFIG.TAG)) {
						CollectionService.AddTag(inst, DRUM_SEAT_CONFIG.TAG);
						drumCount++;
					}
				} else {
					if (CollectionService.HasTag(inst, DRUM_SEAT_CONFIG.TAG)) {
						CollectionService.RemoveTag(inst, DRUM_SEAT_CONFIG.TAG);
					}
					if (!CollectionService.HasTag(inst, SEAT_CONFIG.TAG)) {
						CollectionService.AddTag(inst, SEAT_CONFIG.TAG);
						regularCount++;
					}
				}
			}
		};

		// Tag existing seats
		for (const desc of Workspace.GetDescendants()) {
			tagIfSeat(desc);
		}

		// Listen for dynamically added seats
		Workspace.DescendantAdded.Connect(tagIfSeat);

		print(
			`[ServerSeatService] Initialized successfully. Tagged ${regularCount} regular seats ('${SEAT_CONFIG.TAG}') and ${drumCount} drum seats ('${DRUM_SEAT_CONFIG.TAG}').`,
		);
	}
}
