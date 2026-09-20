import { Lighting, ReplicatedStorage, RunService } from "@rbxts/services";
import { TimeConfig } from "shared/config";
import { TimePeriod, TimeStateSync } from "shared/types";

/**
 * ServerTimeService
 * Layanan server otoritatif untuk mengelola siklus waktu dinamis (Day/Night Cycle) di map.
 * Menjaga sinkronisasi waktu ke seluruh client secara efisien via ReplicatedStorage attributes.
 */
export class ServerTimeService {
	private static instance?: ServerTimeService;

	private isInitialized = false;
	private clockTime: number = TimeConfig.STARTING_CLOCK_TIME;
	private cycleDurationMinutes: number = TimeConfig.CYCLE_DURATION_MINUTES;
	private timeScale: number = TimeConfig.DEFAULT_TIME_SCALE;
	private isPaused = false;
	private isAdminOverridden = false;

	private lastSyncTime = 0;
	private syncInterval = 2.0; // Interval sinkronisasi server timestamp ke client (detik)

	private constructor() {}

	public static getInstance(): ServerTimeService {
		if (!ServerTimeService.instance) {
			ServerTimeService.instance = new ServerTimeService();
		}
		return ServerTimeService.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		// 1. Terapkan waktu awal ke Lighting server
		Lighting.ClockTime = this.clockTime;

		// 2. Publikasikan attribute awal ke ReplicatedStorage
		this.publishSyncState();

		// 3. Heartbeat loop untuk memajukan waktu server
		RunService.Heartbeat.Connect((dt) => {
			this.onHeartbeat(dt);
		});

		print(
			`[ServerTimeService] Initialized: Cycle=${this.cycleDurationMinutes}m, InitialClock=${string.format("%.2f", this.clockTime)}, TimeScale=${this.timeScale}`,
		);
	}

	private onHeartbeat(dt: number): void {
		if (this.isPaused) return;

		// Kalkulasi laju waktu in-game per detik nyata
		// 24 jam / (cycleDurationMinutes * 60 detik)
		const totalCycleSeconds = math.max(1, this.cycleDurationMinutes * 60);
		const hoursPerSecond = (24 / totalCycleSeconds) * this.timeScale;

		this.clockTime = (this.clockTime + dt * hoursPerSecond) % 24;

		// Jika tidak sedang dioverride oleh admin preset (misal Blackout), sinkronkan Lighting server
		if (!this.isAdminOverridden) {
			Lighting.ClockTime = this.clockTime;
		}

		// Sinkronisasi berkala ke ReplicatedStorage untuk client
		const now = os.clock();
		if (now - this.lastSyncTime >= this.syncInterval) {
			this.lastSyncTime = now;
			this.publishSyncState();
		}
	}

	/**
	 * Menerbitkan status waktu terbaru ke ReplicatedStorage attributes.
	 * Sangat efisien dan langsung tersedia untuk pemain yang baru terhubung.
	 */
	private publishSyncState(): void {
		ReplicatedStorage.SetAttribute("CurrentClockTime", this.clockTime);
		ReplicatedStorage.SetAttribute("CycleDurationMinutes", this.cycleDurationMinutes);
		ReplicatedStorage.SetAttribute("TimeScale", this.timeScale);
		ReplicatedStorage.SetAttribute("IsTimePaused", this.isPaused);
		ReplicatedStorage.SetAttribute("IsAdminTimeOverride", this.isAdminOverridden);
		ReplicatedStorage.SetAttribute("TimeSyncTimestamp", os.clock());
	}

	// ─── Public API ──────────────────────────────────────────────────────────

	public getClockTime(): number {
		return this.clockTime;
	}

	public setClockTime(hour: number): void {
		this.clockTime = math.clamp(hour, 0, 24) % 24;
		if (!this.isAdminOverridden) {
			Lighting.ClockTime = this.clockTime;
		}
		this.publishSyncState();
		print(`[ServerTimeService] ClockTime manually set to: ${string.format("%.2f", this.clockTime)}`);
	}

	public setTimeScale(scale: number): void {
		this.timeScale = math.max(0, scale);
		this.publishSyncState();
		print(`[ServerTimeService] TimeScale set to: ${this.timeScale}`);
	}

	public setCycleDurationMinutes(minutes: number): void {
		this.cycleDurationMinutes = math.max(1, minutes);
		this.publishSyncState();
		print(`[ServerTimeService] CycleDurationMinutes set to: ${this.cycleDurationMinutes}`);
	}

	public pause(): void {
		this.isPaused = true;
		this.publishSyncState();
		print("[ServerTimeService] Time cycle paused.");
	}

	public resume(): void {
		this.isPaused = false;
		this.publishSyncState();
		print("[ServerTimeService] Time cycle resumed.");
	}

	public setAdminOverride(active: boolean): void {
		this.isAdminOverridden = active;
		if (!active) {
			// Pulihkan waktu dinamis aktual saat override selesai
			Lighting.ClockTime = this.clockTime;
		}
		this.publishSyncState();
	}

	public getIsAdminOverridden(): boolean {
		return this.isAdminOverridden;
	}

	/**
	 * Mendapatkan periode waktu saat ini (Dawn, Day, Dusk, Night).
	 */
	public getTimePeriod(): TimePeriod {
		const h = this.clockTime;
		if (h >= 5.0 && h < 7.0) {
			return TimePeriod.Dawn;
		} else if (h >= 7.0 && h < 17.0) {
			return TimePeriod.Day;
		} else if (h >= 17.0 && h < 19.5) {
			return TimePeriod.Dusk;
		} else {
			return TimePeriod.Night;
		}
	}
}
