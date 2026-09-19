import { Players } from "@rbxts/services";
import { getRemoteEvent, getRemoteFunction } from "shared/network";
import { EventData, RsvpStatus } from "shared/types";

type EventsUpdatedCallback = (events: EventData[]) => void;
type RsvpChangedCallback = (eventId: string, goingUserIds: number[], interestedUserIds: number[]) => void;

/**
 * Singleton client service managing event ticketing data, RSVP interactions, and real-time updates.
 */
export class EventService {
	private static instance?: EventService;

	private events: EventData[] = [];
	private eventsUpdatedCallbacks: EventsUpdatedCallback[] = [];
	private rsvpChangedCallbacks: RsvpChangedCallback[] = [];

	private getEventsFunction: RemoteFunction;
	private rsvpEventAction: RemoteEvent;
	private eventRsvpUpdatedEvent: RemoteEvent;

	private constructor() {
		this.getEventsFunction = getRemoteFunction("GetEventsFunction");
		this.rsvpEventAction = getRemoteEvent("RsvpEventAction");
		this.eventRsvpUpdatedEvent = getRemoteEvent("EventRsvpUpdatedEvent");

		this.initNetwork();
	}

	public static getInstance(): EventService {
		if (!EventService.instance) {
			EventService.instance = new EventService();
		}
		return EventService.instance;
	}

	private initNetwork(): void {
		// Real-time RSVP updates from server
		this.eventRsvpUpdatedEvent.OnClientEvent.Connect(
			(rawEventId: unknown, rawGoing: unknown, rawInterested: unknown) => {
				if (typeIs(rawEventId, "string") && typeIs(rawGoing, "table") && typeIs(rawInterested, "table")) {
					const eventId = rawEventId as string;
					const goingUserIds = rawGoing as number[];
					const interestedUserIds = rawInterested as number[];

					const evt = this.events.find((e) => e.id === eventId);
					if (evt) {
						evt.goingUserIds = goingUserIds;
						evt.interestedUserIds = interestedUserIds;
					}

					for (const cb of this.rsvpChangedCallbacks) {
						cb(eventId, goingUserIds, interestedUserIds);
					}
				}
			},
		);
	}

	/**
	 * Fetch events list from server.
	 */
	public async fetchEvents(): Promise<EventData[]> {
		try {
			const data = this.getEventsFunction.InvokeServer() as EventData[];
			if (typeIs(data, "table")) {
				this.events = data;
				for (const cb of this.eventsUpdatedCallbacks) {
					cb(this.events);
				}
				return this.events;
			}
		} catch (err) {
			warn(`[EventService] Failed to fetch events: ${tostring(err)}`);
		}
		return this.events;
	}

	/**
	 * Returns the locally cached events list.
	 */
	public getEvents(): EventData[] {
		return this.events;
	}

	/**
	 * Returns an event by id.
	 */
	public getEvent(id: string): EventData | undefined {
		return this.events.find((e) => e.id === id);
	}

	/**
	 * Returns the current RSVP status for a given user (defaults to local player).
	 */
	public getUserRsvpStatus(eventId: string, userId?: number): RsvpStatus {
		const targetId = userId ?? Players.LocalPlayer.UserId;
		const evt = this.getEvent(eventId);
		if (!evt) return RsvpStatus.None;

		if (evt.goingUserIds.includes(targetId)) {
			return RsvpStatus.Going;
		}
		if (evt.interestedUserIds.includes(targetId)) {
			return RsvpStatus.Interested;
		}
		return RsvpStatus.None;
	}

	/**
	 * Send an RSVP status update for an event to the server.
	 */
	public setRsvp(eventId: string, status: RsvpStatus): void {
		this.rsvpEventAction.FireServer(eventId, status);
	}

	public onEventsUpdated(cb: EventsUpdatedCallback): () => void {
		this.eventsUpdatedCallbacks.push(cb);
		return () => {
			const idx = this.eventsUpdatedCallbacks.indexOf(cb);
			if (idx !== -1) this.eventsUpdatedCallbacks.remove(idx);
		};
	}

	public onRsvpChanged(cb: RsvpChangedCallback): () => void {
		this.rsvpChangedCallbacks.push(cb);
		return () => {
			const idx = this.rsvpChangedCallbacks.indexOf(cb);
			if (idx !== -1) this.rsvpChangedCallbacks.remove(idx);
		};
	}
}
