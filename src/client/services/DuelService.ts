import { Players } from "@rbxts/services";
import { getRemoteEvent } from "shared/network";
import { DuelActiveData, DuelEndData, DuelIntroData, DuelInviteData } from "shared/types";
import { GlobalNotificationService } from "./GlobalNotificationService";

export interface DuelServiceCallbacks {
	onInviteReceived?: (data: DuelInviteData) => void;
	onInviteCancelled?: () => void;
	onIntro?: (data: DuelIntroData) => void;
	onCountdown?: (data: DuelActiveData, duration: number) => void;
	onActive?: (data: DuelActiveData) => void;
	onEnded?: (result: DuelEndData) => void;
}

/**
 * DuelService - Manages client network events and state for 1v1 PvP Duels.
 */
export class DuelService {
	private static instance?: DuelService;

	private duelRequestEvent = getRemoteEvent("DuelRequestEvent");
	private duelResponseEvent = getRemoteEvent("DuelResponseEvent");
	private duelInviteEvent = getRemoteEvent("DuelInviteEvent");
	private duelStateEvent = getRemoteEvent("DuelStateEvent");
	private duelFeedbackEvent = getRemoteEvent("DuelFeedbackEvent");

	private callbacks: DuelServiceCallbacks = {};
	private activeDuel?: DuelActiveData;

	private constructor() {
		this.initListeners();
	}

	public static getInstance(): DuelService {
		if (!DuelService.instance) {
			DuelService.instance = new DuelService();
		}
		return DuelService.instance;
	}

	public setCallbacks(callbacks: DuelServiceCallbacks): void {
		this.callbacks = callbacks;
	}

	public getActiveDuel(): DuelActiveData | undefined {
		return this.activeDuel;
	}

	public isDueling(): boolean {
		return this.activeDuel !== undefined;
	}

	/**
	 * Sends a duel challenge to target player.
	 */
	public requestDuel(target: Player): void {
		this.duelRequestEvent.FireServer(target);
	}

	/**
	 * Accepts or declines an incoming duel invite.
	 */
	public respondDuel(accepted: boolean): void {
		this.duelResponseEvent.FireServer(accepted);
	}

	private initListeners(): void {
		this.duelInviteEvent.OnClientEvent.Connect((action: unknown, ...args: unknown[]) => {
			if (action === "InviteReceived") {
				const data = args[0] as DuelInviteData;
				this.callbacks.onInviteReceived?.(data);
			} else if (action === "InviteCancelled") {
				this.callbacks.onInviteCancelled?.();
			}
		});

		this.duelStateEvent.OnClientEvent.Connect((state: unknown, ...args: unknown[]) => {
			if (state === "Intro") {
				const data = args[0] as DuelIntroData;
				this.callbacks.onIntro?.(data);
			} else if (state === "Countdown") {
				const data = args[0] as DuelActiveData;
				const duration = (args[1] as number) ?? 3;
				this.activeDuel = data;
				this.callbacks.onCountdown?.(data, duration);
			} else if (state === "Active") {
				const data = args[0] as DuelActiveData;
				this.activeDuel = data;
				this.callbacks.onActive?.(data);
			} else if (state === "Ended") {
				const result = args[0] as DuelEndData;
				this.activeDuel = undefined;
				this.callbacks.onEnded?.(result);
			}
		});

		this.duelFeedbackEvent.OnClientEvent.Connect((msg: unknown) => {
			if (typeIs(msg, "string")) {
				GlobalNotificationService.getInstance().show({
					title: "DUEL",
					message: msg,
					icon: "swords",
					duration: 3.5,
				});
			}
		});
	}
}
