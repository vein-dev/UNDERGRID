import { CollectionService, Lighting, ReplicatedStorage, RunService, Workspace } from "@rbxts/services";
import { StreetlightConfig, TimeConfig } from "shared/config";
import { LightingProfile, TimePeriod } from "shared/types";

/**
 * TimeService
 * Layanan client untuk memajukan siklus waktu secara lokal (60+ FPS smooth)
 * dan menginterpolasi warna pencahayaan atmosfer (Fajar, Siang, Senja, Malam).
 */
export class TimeService {
	private static instance?: TimeService;

	private isInitialized = false;
	private localClockTime: number = TimeConfig.STARTING_CLOCK_TIME;
	private cycleDurationMinutes: number = TimeConfig.CYCLE_DURATION_MINUTES;
	private timeScale: number = TimeConfig.DEFAULT_TIME_SCALE;
	private isPaused = false;
	private isAdminTimeOverride = false;

	private constructor() {}

	public static getInstance(): TimeService {
		if (!TimeService.instance) {
			TimeService.instance = new TimeService();
		}
		return TimeService.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		// 1. Baca sinkronisasi awal dari ReplicatedStorage attributes
		this.syncFromAttributes();

		// 2. Hubungkan listener perubahan attribute server
		ReplicatedStorage.GetAttributeChangedSignal("CurrentClockTime").Connect(() => this.syncFromAttributes());
		ReplicatedStorage.GetAttributeChangedSignal("TimeSyncTimestamp").Connect(() => this.syncFromAttributes());
		ReplicatedStorage.GetAttributeChangedSignal("CycleDurationMinutes").Connect(() => this.syncFromAttributes());
		ReplicatedStorage.GetAttributeChangedSignal("TimeScale").Connect(() => this.syncFromAttributes());
		ReplicatedStorage.GetAttributeChangedSignal("IsTimePaused").Connect(() => this.syncFromAttributes());
		ReplicatedStorage.GetAttributeChangedSignal("IsAdminTimeOverride").Connect(() => this.syncFromAttributes());

		// 3. Pastikan seluruh lampu jalan / map lights dimatikan secara permanen
		this.disableAllMapLights();

		// 4. Pasang update render per frame via Heartbeat
		RunService.Heartbeat.Connect((dt) => {
			this.onHeartbeat(dt);
		});

		print(
			`[TimeService] Initialized: Local Clock=${string.format("%.2f", this.localClockTime)}, Cycle=${this.cycleDurationMinutes}m, TimeScale=${this.timeScale}`,
		);
	}

	/**
	 * Sinkronisasi state dari server attributes dengan kompensasi latensi
	 */
	private syncFromAttributes(): void {
		const serverClock = ReplicatedStorage.GetAttribute("CurrentClockTime") as number | undefined;
		const cycleDuration = ReplicatedStorage.GetAttribute("CycleDurationMinutes") as number | undefined;
		const scale = ReplicatedStorage.GetAttribute("TimeScale") as number | undefined;
		const paused = ReplicatedStorage.GetAttribute("IsTimePaused") as boolean | undefined;
		const override = ReplicatedStorage.GetAttribute("IsAdminTimeOverride") as boolean | undefined;
		const syncTimestamp = ReplicatedStorage.GetAttribute("TimeSyncTimestamp") as number | undefined;

		if (cycleDuration !== undefined) this.cycleDurationMinutes = cycleDuration;
		if (scale !== undefined) this.timeScale = scale;
		if (paused !== undefined) this.isPaused = paused;
		if (override !== undefined) this.isAdminTimeOverride = override;

		if (serverClock !== undefined) {
			if (syncTimestamp !== undefined && syncTimestamp > 0 && !this.isPaused) {
				// Kompensasi latensi waktu jaringan menggunakan Workspace.GetServerTimeNow()
				const now = Workspace.GetServerTimeNow();
				const elapsedSec = math.clamp(now - syncTimestamp, 0, 3);
				const totalCycleSeconds = math.max(1, this.cycleDurationMinutes * 60);
				const hoursPerSecond = (24 / totalCycleSeconds) * this.timeScale;
				this.localClockTime = (serverClock + elapsedSec * hoursPerSecond) % 24;
			} else {
				this.localClockTime = serverClock;
			}

			// Terapkan langsung ke Lighting dan efek atmosfer visual
			Lighting.ClockTime = this.localClockTime;
			this.interpolateLighting(this.localClockTime);
		}
	}

	private onHeartbeat(dt: number): void {
		// Jika sedang dijeda atau admin mengaktifkan preset khusus (misal Blackout), lewati update
		if (this.isPaused || this.isAdminTimeOverride) return;

		// 1. Majukan waktu lokal
		const totalCycleSeconds = math.max(1, this.cycleDurationMinutes * 60);
		const hoursPerSecond = (24 / totalCycleSeconds) * this.timeScale;
		this.localClockTime = (this.localClockTime + dt * hoursPerSecond) % 24;

		// 2. Terapkan waktu ke Lighting
		Lighting.ClockTime = this.localClockTime;

		// 3. Interpolasikan atmosfer pencahayaan halus
		this.interpolateLighting(this.localClockTime);
	}

	/**
	 * Melakukan interpolasi warna pencahayaan (Lerp) yang mulus di antara 4 titik anchor:
	 * Dawn (06:00), Day (12:00), Dusk (18:00), Night (24:00/00:00).
	 */
	private interpolateLighting(time: number): void {
		const profiles = TimeConfig.PROFILES;

		let pA: LightingProfile;
		let pB: LightingProfile;
		let alpha = 0;

		if (time >= 0 && time < 6) {
			// Midnight (00:00) -> Dawn (06:00)
			pA = profiles[TimePeriod.Night];
			pB = profiles[TimePeriod.Dawn];
			alpha = (time - 0) / 6;
		} else if (time >= 6 && time < 12) {
			// Dawn (06:00) -> Day (12:00)
			pA = profiles[TimePeriod.Dawn];
			pB = profiles[TimePeriod.Day];
			alpha = (time - 6) / 6;
		} else if (time >= 12 && time < 18) {
			// Day (12:00) -> Dusk (18:00)
			pA = profiles[TimePeriod.Day];
			pB = profiles[TimePeriod.Dusk];
			alpha = (time - 12) / 6;
		} else {
			// Dusk (18:00) -> Midnight (24:00)
			pA = profiles[TimePeriod.Dusk];
			pB = profiles[TimePeriod.Night];
			alpha = (time - 18) / 6;
		}

		alpha = math.clamp(alpha, 0, 1);

		// Terapkan hasil interpolasi ke Lighting
		Lighting.Brightness = pA.brightness + (pB.brightness - pA.brightness) * alpha;
		Lighting.Ambient = pA.ambient.Lerp(pB.ambient, alpha);
		Lighting.OutdoorAmbient = pA.outdoorAmbient.Lerp(pB.outdoorAmbient, alpha);
		Lighting.ColorShift_Top = pA.colorShiftTop.Lerp(pB.colorShiftTop, alpha);
		Lighting.ColorShift_Bottom = pA.colorShiftBottom.Lerp(pB.colorShiftBottom, alpha);
		Lighting.ExposureCompensation =
			pA.exposureCompensation + (pB.exposureCompensation - pA.exposureCompensation) * alpha;
	}

	/**
	 * Mematikan semua lampu jalan / map lights secara permanen di Workspace.
	 */
	private disableAllMapLights(): void {
		const namePatterns = ["streetlight", "streetlamp", "thelight", "lamp", "walllamp"];
		for (const desc of Workspace.GetDescendants()) {
			// Lewati part atau model yang ditag StreetLight
			if (
				CollectionService.HasTag(desc, StreetlightConfig.TAG) ||
				(desc.Parent !== undefined && CollectionService.HasTag(desc.Parent, StreetlightConfig.TAG))
			) {
				continue;
			}

			if (desc.IsA("Light")) {
				desc.Enabled = false;
			} else if (desc.IsA("BasePart") && desc.Material === Enum.Material.Neon) {
				const partName = desc.Name.lower();
				const parentName = desc.Parent?.Name.lower() ?? "";
				let matches = false;
				for (const p of namePatterns) {
					if (partName.find(p)[0] !== undefined || parentName.find(p)[0] !== undefined) {
						matches = true;
						break;
					}
				}
				if (matches) {
					desc.Material = Enum.Material.SmoothPlastic;
					desc.Color = Color3.fromRGB(130, 130, 130);
				}
			}
		}
		print("[TimeService] All streetlights and map lights permanently disabled.");
	}

	// ─── Public API ──────────────────────────────────────────────────────────

	public getClockTime(): number {
		return this.localClockTime;
	}

	public getTimePeriod(): TimePeriod {
		const h = this.localClockTime;
		if (h >= 5.0 && h < 7.0) return TimePeriod.Dawn;
		if (h >= 7.0 && h < 17.0) return TimePeriod.Day;
		if (h >= 17.0 && h < 19.5) return TimePeriod.Dusk;
		return TimePeriod.Night;
	}
}
