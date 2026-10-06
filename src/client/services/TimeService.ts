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
	 * Melakukan interpolasi warna pencahayaan (Lerp) yang super mulus di antara 8 titik anchor
	 * 24-jam bernuansa Los Angeles / New York City, dengan horizon 100% jernih tanpa garis kaku.
	 */
	private interpolateLighting(time: number): void {
		const anchors = TimeConfig.ANCHORS;
		const normalizedTime = ((time % 24) + 24) % 24;

		let pA: LightingProfile = anchors[0].profile;
		let pB: LightingProfile = anchors[0].profile;
		let alpha = 0;

		const count = anchors.size();
		let found = false;

		for (let i = 0; i < count - 1; i++) {
			const a1 = anchors[i];
			const a2 = anchors[i + 1];
			if (normalizedTime >= a1.hour && normalizedTime < a2.hour) {
				pA = a1.profile;
				pB = a2.profile;
				alpha = (normalizedTime - a1.hour) / (a2.hour - a1.hour);
				found = true;
				break;
			}
		}

		if (!found) {
			// Interval terakhir: Anchor terakhir -> 24.0 (wrap around ke Anchor 0)
			const lastAnchor = anchors[count - 1];
			const firstAnchor = anchors[0];
			pA = lastAnchor.profile;
			pB = firstAnchor.profile;
			const duration = 24.0 - lastAnchor.hour;
			alpha = duration > 0 ? (normalizedTime - lastAnchor.hour) / duration : 0;
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

		// Interpolasi Image-Based Lighting (IBL)
		if (pA.environmentDiffuseScale !== undefined && pB.environmentDiffuseScale !== undefined) {
			Lighting.EnvironmentDiffuseScale =
				pA.environmentDiffuseScale + (pB.environmentDiffuseScale - pA.environmentDiffuseScale) * alpha;
		}
		if (pA.environmentSpecularScale !== undefined && pB.environmentSpecularScale !== undefined) {
			Lighting.EnvironmentSpecularScale =
				pA.environmentSpecularScale + (pB.environmentSpecularScale - pA.environmentSpecularScale) * alpha;
		}

		// Interpolasi Atmosphere dinamis (menjaga visual kabut/langit 100% jernih tanpa garis batas kaku)
		const atmosphere = Lighting.FindFirstChildOfClass("Atmosphere");
		if (atmosphere) {
			if (pA.atmosphereColor && pB.atmosphereColor) {
				atmosphere.Color = pA.atmosphereColor.Lerp(pB.atmosphereColor, alpha);
			}
			if (pA.atmosphereDecay && pB.atmosphereDecay) {
				atmosphere.Decay = pA.atmosphereDecay.Lerp(pB.atmosphereDecay, alpha);
			}
			if (pA.atmosphereHaze !== undefined && pB.atmosphereHaze !== undefined) {
				atmosphere.Haze = pA.atmosphereHaze + (pB.atmosphereHaze - pA.atmosphereHaze) * alpha;
			}
			if (pA.atmosphereDensity !== undefined && pB.atmosphereDensity !== undefined) {
				atmosphere.Density = pA.atmosphereDensity + (pB.atmosphereDensity - pA.atmosphereDensity) * alpha;
			}
			if (pA.atmosphereOffset !== undefined && pB.atmosphereOffset !== undefined) {
				atmosphere.Offset = pA.atmosphereOffset + (pB.atmosphereOffset - pA.atmosphereOffset) * alpha;
			}
			if (pA.atmosphereGlare !== undefined && pB.atmosphereGlare !== undefined) {
				atmosphere.Glare = pA.atmosphereGlare + (pB.atmosphereGlare - pA.atmosphereGlare) * alpha;
			}
		}
	}

	/**
	 * Mematikan semua lampu jalan / map lights secara permanen di Workspace.
	 */
	private disableAllMapLights(): void {
		const namePatterns = ["thelight"];
		for (const desc of Workspace.GetDescendants()) {
			// Lewati part atau model yang ditag StreetLight atau turunan dari model ber-tag
			const isStreetLight =
				CollectionService.HasTag(desc, StreetlightConfig.TAG) ||
				(desc.Parent !== undefined && CollectionService.HasTag(desc.Parent, StreetlightConfig.TAG)) ||
				(desc.FindFirstAncestorWhichIsA("Model") !== undefined &&
					CollectionService.HasTag(desc.FindFirstAncestorWhichIsA("Model")!, StreetlightConfig.TAG));

			if (isStreetLight) {
				continue;
			}

			// Lindungi lampu fungsional seperti wallLamp dari penonaktifan
			const partName = desc.Name.lower();
			const parentName = desc.Parent?.Name.lower() ?? "";
			if (partName.find("walllamp")[0] !== undefined || parentName.find("walllamp")[0] !== undefined) {
				continue;
			}

			if (desc.IsA("Light")) {
				desc.Enabled = false;
			} else if (desc.IsA("BasePart") && desc.Material === Enum.Material.Neon) {
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
		print("[TimeService] Legacy map lights safely processed.");
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
