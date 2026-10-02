import { getRemoteEvent, getRemoteFunction } from "shared/network";
import {
	AdminStateSync,
	BanRecord,
	PlayerEntryInfo,
	StageCameraControlPayload,
	StageLightingControlPayload,
	StageLightMode,
	StageTarget,
} from "shared/types";
import { AnnouncementOverlayView } from "client/ui/views/AnnouncementOverlayView";

type StateUpdateCallback = (state: AdminStateSync) => void;
type AnnouncementCallback = (text: string) => void;
type BannedUpdateCallback = (banned: BanRecord[]) => void;

/**
 * Singleton client service managing admin panel actions and state synchronization.
 */
export class AdminService {
	private static instance?: AdminService;

	private state: AdminStateSync = {
		isQueueLocked: false,
	};
	private players: PlayerEntryInfo[] = [];
	private bannedPlayers: BanRecord[] = [];

	private stateUpdateCallbacks: StateUpdateCallback[] = [];
	private announcementCallbacks: AnnouncementCallback[] = [];
	private bannedUpdateCallbacks: BannedUpdateCallback[] = [];

	private adminControlEvent: RemoteEvent;
	private adminQueryFunction: RemoteFunction;
	private adminAnnouncementBroadcast: RemoteEvent;
	private adminStateUpdatedEvent: RemoteEvent;
	private adminBansUpdatedEvent: RemoteEvent;

	private constructor() {
		this.adminControlEvent = getRemoteEvent("AdminControlEvent");
		this.adminQueryFunction = getRemoteFunction("AdminQueryFunction");
		this.adminAnnouncementBroadcast = getRemoteEvent("AdminAnnouncementBroadcast");
		this.adminStateUpdatedEvent = getRemoteEvent("AdminStateUpdatedEvent");
		this.adminBansUpdatedEvent = getRemoteEvent("AdminBansUpdatedEvent");

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

		// Listen for real-time banned list updates from server
		this.adminBansUpdatedEvent.OnClientEvent.Connect((rawBanned: unknown) => {
			if (typeIs(rawBanned, "table")) {
				this.bannedPlayers = rawBanned as BanRecord[];
				for (const cb of this.bannedUpdateCallbacks) cb(this.bannedPlayers);
			}
		});

		// Listen for broadcast announcements - Khusus tampil di Fullscreen Blur Overlay 5 detik
		this.adminAnnouncementBroadcast.OnClientEvent.Connect((rawText: unknown) => {
			if (typeIs(rawText, "string")) {
				AnnouncementOverlayView.getInstance().show(rawText as string, 5.0);
				for (const cb of this.announcementCallbacks) cb(rawText as string);
			}
		});

		// Fetch initial state immediately on startup
		task.defer(() => {
			this.fetchFullState();
		});
	}

	/** Fetch the latest admin state, server players list, and banned players list. */
	public async fetchFullState(): Promise<{ state: AdminStateSync; players: PlayerEntryInfo[]; banned: BanRecord[] } | undefined> {
		try {
			const res = this.adminQueryFunction.InvokeServer() as
				| { state: AdminStateSync; players: PlayerEntryInfo[]; banned?: BanRecord[] }
				| undefined;
			if (res) {
				this.state = res.state;
				this.players = res.players;
				if (res.banned) {
					this.bannedPlayers = res.banned;
					for (const cb of this.bannedUpdateCallbacks) cb(this.bannedPlayers);
				}
				return { state: this.state, players: this.players, banned: this.bannedPlayers };
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

	public sendAnnouncement(text: string): void {
		this.adminControlEvent.FireServer("SendAnnouncement", text);
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

	public kickPlayer(userId: number, reason?: string): void {
		this.adminControlEvent.FireServer("KickPlayer", { targetUserId: userId, reason });
	}

	public banPlayer(userId: number, reason?: string, durationSeconds = 0): void {
		this.adminControlEvent.FireServer("BanPlayer", { targetUserId: userId, reason, durationSeconds });
	}

	public unbanPlayer(userId: number): void {
		this.adminControlEvent.FireServer("UnbanPlayer", { targetUserId: userId });
	}

	public banByUsername(username: string, reason?: string, durationSeconds = 0): void {
		this.adminControlEvent.FireServer("BanByUsername", { username, reason, durationSeconds });
	}

	public unbanByUsername(username: string): void {
		this.adminControlEvent.FireServer("UnbanByUsername", { username });
	}

	public getBannedList(): BanRecord[] {
		return this.bannedPlayers;
	}

	public onBannedListUpdated(cb: BannedUpdateCallback): () => void {
		this.bannedUpdateCallbacks.push(cb);
		return () => {
			const idx = this.bannedUpdateCallbacks.indexOf(cb);
			if (idx !== -1) this.bannedUpdateCallbacks.remove(idx);
		};
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

	public setStageLighting(payload: Partial<StageLightingControlPayload>, target: StageTarget = "main"): void {
		const data = { ...payload, target };

		if (target === "dj" || target === "all") {
			this.state.djStageLighting = {
				...(this.state.djStageLighting ?? {
					mode: StageLightMode.SpotlightCenter,
					panAngle: 0,
					tiltAngle: 0,
					motorSpeed: 0.04,
					color: Color3.fromRGB(0, 255, 255),
					brightness: 3.5,
					beamEnabled: true,
					strobeSpeed: 0,
					isRainbow: false,
					isPulse: false,
					isMusicSync: false,
					target: "dj",
					fogEnabled: false,
					fogIntensity: 0.5,
					backdropPreset: "gif_cyber_grid",
					backdropBrightness: 2.0,
				}),
				...payload,
			};
		}
		if (target === "main" || target === "all") {
			this.state.stageLighting = {
				...(this.state.stageLighting ?? {
					mode: StageLightMode.SpotlightCenter,
					panAngle: 0,
					tiltAngle: 0,
					motorSpeed: 0.04,
					color: Color3.fromRGB(180, 240, 255),
					brightness: 4.5,
					beamEnabled: true,
					strobeSpeed: 0,
					isRainbow: false,
					isPulse: false,
					isMusicSync: false,
					target: "main",
					fogEnabled: false,
					fogIntensity: 0.5,
					backdropPreset: "gif_cyber_grid",
					backdropBrightness: 2.0,
				}),
				...payload,
			};
		}

		for (const cb of this.stateUpdateCallbacks) {
			cb(this.state);
		}
		this.adminControlEvent.FireServer("SetStageLightingControl", data);
	}

	public triggerFogBurst(target?: StageTarget): void {
		this.adminControlEvent.FireServer("TriggerFogBurst", target ?? "all");
	}

	public setStageCameraControl(payload: Partial<StageCameraControlPayload>): void {
		this.adminControlEvent.FireServer("SetStageCameraControl", payload);
	}

	/** @deprecated Physical tool removed. Stage Controller is managed entirely via the Topbar UI icon. */
	public giveStageController(): void {}

	/** @deprecated Physical tool removed. Stage Controller is managed entirely via the Topbar UI icon. */
	public giveLightingRemote(): void {}

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
