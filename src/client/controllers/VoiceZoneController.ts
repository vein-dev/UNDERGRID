import { Players, RunService } from "@rbxts/services";
import { checkPlayerVoiceZone } from "shared/utils/VoiceZoneUtils";
import { GlobalNotificationService } from "client/services/GlobalNotificationService";

/**
 * VoiceZoneController
 * Mengontrol deteksi Voice Zone di sisi client dan memberikan feedback visual/audio:
 * 1. Mendeteksi secara lokal apakah karakter berada di dalam RooftopVoiceZone atau GarageVoiceZone.
 * 2. Mengatur properti Muted pada AudioDeviceInput lokal untuk respons instan tanpa lag network.
 * 3. Memunculkan notifikasi Dynamic Island elegan saat masuk ("Mic Unmuted") dan keluar ("Mic Muted").
 */
export class VoiceZoneController {
	private static instance?: VoiceZoneController;

	private isInitialized = false;
	private isInZone = false;
	private currentZoneName?: string;
	private lastNotifiedState?: boolean;

	private zoneChangedCallbacks: ((inZone: boolean, zoneName?: string) => void)[] = [];
	private checkTimer = 0;
	private readonly CHECK_INTERVAL = 0.2; // Evaluasi posisi lokal setiap 200ms

	private constructor() {}

	public static getInstance(): VoiceZoneController {
		if (!VoiceZoneController.instance) {
			VoiceZoneController.instance = new VoiceZoneController();
		}
		return VoiceZoneController.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		const localPlayer = Players.LocalPlayer;
		if (!localPlayer) return;

		// Evaluasi posisi lokal di Heartbeat
		RunService.Heartbeat.Connect((dt) => {
			this.checkTimer += dt;
			if (this.checkTimer >= this.CHECK_INTERVAL) {
				this.checkTimer = 0;
				this.updateLocalVoiceZone(localPlayer);
			}
		});

		print("[VoiceZoneController] Initialized: Voice Zone client detector active.");
	}

	private updateLocalVoiceZone(player: Player): void {
		const result = checkPlayerVoiceZone(player);
		const wasInZone = this.isInZone;
		const inZone = result.inZone;

		this.isInZone = inZone;
		this.currentZoneName = inZone ? result.zoneName : undefined;

		// Sinkronisasi lokal AudioDeviceInput jika tersedia
		const audioInput = player.FindFirstChildOfClass("AudioDeviceInput") ??
			player.Character?.FindFirstChildOfClass("AudioDeviceInput");
		if (audioInput) {
			audioInput.Muted = !inZone;
		}

		// Jika status zona berubah
		if (this.lastNotifiedState === undefined || this.lastNotifiedState !== inZone) {
			const isFirstCheck = this.lastNotifiedState === undefined;
			this.lastNotifiedState = inZone;

			// Trigger listeners
			for (const cb of this.zoneChangedCallbacks) {
				cb(inZone, this.currentZoneName);
			}

			// Hindari notifikasi spam saat baru pertama kali spawn jika di luar zona
			if (isFirstCheck && !inZone) {
				return;
			}

			// Tampilkan notifikasi Dynamic Island
			const notifService = GlobalNotificationService.getInstance();
			if (inZone) {
				notifService.show({
					title: "VOICE ZONE ACTIVE",
					message: `Entered ${this.currentZoneName ?? "Voice"} Area`,
					subtext: "Mic Active • Music 50%",
					badgeIcon: "mic",
					badgeColor: Color3.fromHex("#22c55e"),
					duration: 3.5,
				});
			} else {
				notifService.show({
					title: "VOICE MUTED",
					message: "Stepped outside Voice Area",
					subtext: "Mic Muted • Music 100%",
					badgeIcon: "mic-off",
					badgeColor: Color3.fromHex("#ef4444"),
					duration: 3.5,
				});
			}
		}
	}

	/**
	 * Mengecek apakah karakter pemain lokal saat ini berada di dalam Voice Zone.
	 */
	public getIsInVoiceZone(): boolean {
		return this.isInZone;
	}

	/**
	 * Mengambil nama zona suara tempat pemain berada ("Rooftop" | "Garage" | undefined).
	 */
	public getCurrentZoneName(): string | undefined {
		return this.currentZoneName;
	}

	/**
	 * Mendaftarkan callback listener saat status Voice Zone berubah.
	 */
	public onVoiceZoneChanged(cb: (inZone: boolean, zoneName?: string) => void): () => void {
		this.zoneChangedCallbacks.push(cb);
		return () => {
			const index = this.zoneChangedCallbacks.indexOf(cb);
			if (index !== -1) {
				this.zoneChangedCallbacks.remove(index);
			}
		};
	}
}
