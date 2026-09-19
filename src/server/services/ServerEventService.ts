import { DEFAULT_EVENTS } from "shared/config";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import { EventData, RsvpStatus } from "shared/types";

/**
 * Server service managing events, ticketing, and real-time RSVP synchronization
 * for the Smartphone Event Ticketing App.
 */
export class ServerEventService {
	private static instance?: ServerEventService;

	private events: EventData[] = [];

	private getEventsFunction: RemoteFunction;
	private rsvpEventAction: RemoteEvent;
	private eventRsvpUpdatedEvent: RemoteEvent;

	private constructor() {
		this.getEventsFunction = getRemoteFunction("GetEventsFunction");
		this.rsvpEventAction = getRemoteEvent("RsvpEventAction");
		this.eventRsvpUpdatedEvent = getRemoteEvent("EventRsvpUpdatedEvent");

		this.initEvents();
		this.initRemotes();
	}

	public static getInstance(): ServerEventService {
		if (!ServerEventService.instance) {
			ServerEventService.instance = new ServerEventService();
		}
		return ServerEventService.instance;
	}

	private initEvents(): void {
		// Deep clone default events into runtime memory
		this.events = DEFAULT_EVENTS.map((evt) => ({
			...evt,
			goingUserIds: [...evt.goingUserIds],
			interestedUserIds: [...evt.interestedUserIds],
		}));
	}

	private initRemotes(): void {
		// Clients request the full list of events
		this.getEventsFunction.OnServerInvoke = (_player: Player) => {
			return this.events;
		};

		// Client sends RSVP action
		this.rsvpEventAction.OnServerEvent.Connect((player, rawEventId, rawStatus) => {
			this.handleRsvp(player, rawEventId, rawStatus);
		});

		print("[ServerEventService] Initialized successfully with " + this.events.size() + " events.");
	}

	private handleRsvp(player: Player, rawEventId: unknown, rawStatus: unknown): void {
		if (!typeIs(rawEventId, "string") || !typeIs(rawStatus, "string")) {
			return;
		}

		const event = this.events.find((e) => e.id === rawEventId);
		if (!event) {
			warn(`[ServerEventService] Event not found: ${rawEventId}`);
			return;
		}

		const userId = player.UserId;
		const targetStatus = rawStatus as RsvpStatus;

		// Remove user from both lists first
		event.goingUserIds = event.goingUserIds.filter((id) => id !== userId);
		event.interestedUserIds = event.interestedUserIds.filter((id) => id !== userId);

		// Add to requested list if not None
		if (targetStatus === RsvpStatus.Going) {
			event.goingUserIds.push(userId);
		} else if (targetStatus === RsvpStatus.Interested) {
			event.interestedUserIds.push(userId);
		}

		print(`[ServerEventService] Player ${player.Name} (${userId}) updated RSVP for ${event.title} to ${targetStatus}`);

		// Broadcast updated participant lists to all clients
		this.eventRsvpUpdatedEvent.FireAllClients(event.id, event.goingUserIds, event.interestedUserIds);
	}
}
