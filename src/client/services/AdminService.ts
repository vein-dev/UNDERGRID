import { getRemoteEvent, getRemoteFunction } from "shared/network";
import { AdminStateSync, AtmospherePreset, PlayerEntryInfo } from "shared/types";
import { GlobalNotificationService } from "./GlobalNotificationService";

type StateUpdateCallback = (state: AdminStateSync) => void;
type AnnouncementCallback = (text: string) => void;

/**
 * Singleton client service managing admin panel actions and state synchronization.
 */
export class AdminService {
	private static instance?: AdminService;

	private state: AdminStateSync = {
		isQueueLocked: false,
		activePresets: [],
	};
	private players: PlayerEntryInfo[] = [];

	private stateUpdateCallbacks: StateUpdateCallback[] = [];
	private announcementCallbacks: AnnouncementCallback[] = [];

	private adminControlEvent: RemoteEvent;
	private adminQueryFunction: RemoteFunction;
	private adminAnnouncementBroadcast: RemoteEvent;
	private adminStateUpdatedEvent: RemoteEvent;

	private constructor() {
		this.adminControlEvent = getRemoteEvent("AdminControlEvent");
		this.adminQueryFunction = getRemoteFunction("AdminQueryFunction");
		this.adminAnnouncementBroadcast = getRemoteEvent("AdminAnnouncementBroadcast");
		this.adminStateUpdatedEvent = getRemoteEvent("AdminStateUpdatedEvent");

		this.initNetwork();
	}

	public static getInstance(): AdminService {
		if (!AdminService.instance) {
			AdminService.instance = new AdminService();
		}
		return AdminService.instance;
	}

	private initNetwork(): void {
		// Listen for real-time state updates from server
		this.adminStateUpdatedEvent.OnClientEvent.Connect((rawState: unknown) => {
			if (typeIs(rawState, "table")) {
				this.state = rawState as AdminStateSync;
				for (const cb of this.stateUpdateCallbacks) cb(this.state);
			}
		});

		// Listen for broadcast announcements
		this.adminAnnouncementBroadcast.OnClientEvent.Connect((rawText: unknown) => {
			if (typeIs(rawText, "string")) {
				GlobalNotificationService.getInstance().showAnnouncement(rawText as string);
				for (const cb of this.announcementCallbacks) cb(rawText as string);
			}
		});
	}

	/** Fetch the latest admin state and server players list. */
	public async fetchFullState(): Promise<{ state: AdminStateSync; players: PlayerEntryInfo[] } | undefined> {
		try {
			const res = this.adminQueryFunction.InvokeServer() as
				| { state: AdminStateSync; players: PlayerEntryInfo[] }
				| undefined;
			if (res) {
				this.state = res.state;
				this.players = res.players;
				return res;
			}
		} catch (err) {
			warn(`[AdminService] Failed to query admin state: ${tostring(err)}`);
		}
		return undefined;
	}

	public getState(): AdminStateSync {
		return this.state;
	}

	public getPlayers(): PlayerEntryInfo[] {
		return this.players;
	}

	public isPresetActive(preset: AtmospherePreset): boolean {
		return this.state.activePresets.includes(preset);
	}

	public sendAnnouncement(text: string): void {
		this.adminControlEvent.FireServer("SendAnnouncement", text);
	}

	public toggleAtmospherePreset(preset: AtmospherePreset): void {
		this.adminControlEvent.FireServer("ToggleAtmospherePreset", preset);
	}

	public setQueueLocked(locked: boolean): void {
		this.adminControlEvent.FireServer("SetQueueLocked", locked);
	}

	public clearQueue(): void {
		this.adminControlEvent.FireServer("ClearQueue");
	}

	public teleportTo(userId: number): void {
		this.adminControlEvent.FireServer("TeleportTo", userId);
	}

	public bringPlayer(userId: number): void {
		this.adminControlEvent.FireServer("BringPlayer", userId);
	}

	public setClockTime(hour: number): void {
		this.adminControlEvent.FireServer("SetClockTime", hour);
	}

	public setTimeScale(scale: number): void {
		this.adminControlEvent.FireServer("SetTimeScale", scale);
	}

	public toggleTimePause(pause?: boolean): void {
		this.adminControlEvent.FireServer("ToggleTimePause", pause);
	}

	public setCycleDuration(minutes: number): void {
		this.adminControlEvent.FireServer("SetCycleDuration", minutes);
	}

	public onStateUpdated(cb: StateUpdateCallback): () => void {
		this.stateUpdateCallbacks.push(cb);
		return () => {
			const idx = this.stateUpdateCallbacks.indexOf(cb);
			if (idx !== -1) this.stateUpdateCallbacks.remove(idx);
		};
	}

	public onAnnouncementReceived(cb: AnnouncementCallback): () => void {
		this.announcementCallbacks.push(cb);
		return () => {
			const idx = this.announcementCallbacks.indexOf(cb);
			if (idx !== -1) this.announcementCallbacks.remove(idx);
		};
	}
}
