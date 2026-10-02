import { Players, RunService } from "@rbxts/services";
import { MusicPlayerService } from "client/services/MusicPlayerService";
import { DjMusicPlayerService } from "client/services/DjMusicPlayerService";
import { isPlayerInDjArea } from "shared/utils";

/**
 * ZoneAudioController
 * Mengelola crossfade audio dinamis 60 FPS antara Panggung Utama (Main Stage) dan Panggung DJ (Rooftop):
 * 1. Di Area Netral & Seluruh Map: Musik konser utama bermain penuh (100%).
 * 2. Khusus di dalam DJArea: Musik konser utama fade out halus ke 0%, musik DJ fade in ke 100%.
 * 3. Keluar dari DJArea: Musik DJ fade out ke 0%, musik konser utama fade in kembali ke 100%.
 */
export class ZoneAudioController {
	private static instance?: ZoneAudioController;

	private isInitialized = false;
	private heartbeatConn?: RBXScriptConnection;
	private zoneChangedCallbacks: ((inDjArea: boolean) => void)[] = [];
	private lastInDjArea?: boolean;

	private currentMainVolume = 1.0;
	private currentDjVolume = 0.0;

	private userMasterVolume = 0.5; // Default volume smartphone
	private readonly CROSSFADE_SPEED = 2.5; // ~1.2 detik transisi penuh

	private constructor() {}

	public static getInstance(): ZoneAudioController {
		if (!ZoneAudioController.instance) {
			ZoneAudioController.instance = new ZoneAudioController();
		}
		return ZoneAudioController.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		const mainMusicService = MusicPlayerService.getInstance();
		const djMusicService = DjMusicPlayerService.getInstance();

		// Baca volume awal dari MusicPlayerService
		this.userMasterVolume = mainMusicService.getVolume();
		this.currentMainVolume = this.userMasterVolume;
		this.currentDjVolume = 0.0;

		// Dengarkan jika user mengubah slider volume di MusicApp
		mainMusicService.onVolumeChanged((vol) => {
			this.userMasterVolume = vol;
		});
		djMusicService.onVolumeChanged((vol) => {
			this.userMasterVolume = vol;
		});

		// Loop Crossfade di Heartbeat
		this.heartbeatConn = RunService.Heartbeat.Connect((dt) => {
			this.updateZoneAudio(dt);
		});

		print("[ZoneAudioController] Initialized: Smooth Dual-Zone crossfade active.");
	}

	private updateZoneAudio(dt: number): void {
		const localPlayer = Players.LocalPlayer;
		if (!localPlayer) return;

		const inDjArea = isPlayerInDjArea(localPlayer);
		if (this.lastInDjArea === undefined || inDjArea !== this.lastInDjArea) {
			this.lastInDjArea = inDjArea;
			for (const cb of this.zoneChangedCallbacks) {
				cb(inDjArea);
			}
		}

		// Target volume berdasarkan zona
		const targetMain = inDjArea ? 0.0 : this.userMasterVolume;
		const targetDj = inDjArea ? this.userMasterVolume : 0.0;

		const lerpFactor = math.clamp(dt * this.CROSSFADE_SPEED, 0, 1);

		// Interpolasi halus
		this.currentMainVolume = this.currentMainVolume + (targetMain - this.currentMainVolume) * lerpFactor;
		this.currentDjVolume = this.currentDjVolume + (targetDj - this.currentDjVolume) * lerpFactor;

		// Terapkan volume fisik ke sound instances (memperhitungkan kompensasi gain lagu bypass)
		const mainMusic = MusicPlayerService.getInstance();
		const djMusic = DjMusicPlayerService.getInstance();

		mainMusic.setPhysicalVolume(this.currentMainVolume);
		djMusic.setPhysicalVolume(this.currentDjVolume);
	}

	public getIsInDjArea(): boolean {
		const localPlayer = Players.LocalPlayer;
		return localPlayer ? isPlayerInDjArea(localPlayer) : false;
	}

	public onZoneChanged(cb: (inDjArea: boolean) => void): () => void {
		this.zoneChangedCallbacks.push(cb);
		return () => {
			const idx = this.zoneChangedCallbacks.indexOf(cb);
			if (idx !== -1) {
				this.zoneChangedCallbacks.remove(idx);
			}
		};
	}

	public setMasterVolume(vol: number): void {
		this.userMasterVolume = math.clamp(vol, 0, 1);
	}

	public getMasterVolume(): number {
		return this.userMasterVolume;
	}

	public destroy(): void {
		if (this.heartbeatConn) {
			this.heartbeatConn.Disconnect();
			this.heartbeatConn = undefined;
		}
	}
}
