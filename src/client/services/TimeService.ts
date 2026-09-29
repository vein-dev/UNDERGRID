import { CollectionService, Lighting, ReplicatedStorage, RunService, Workspace } from "@rbxts/services";
import { TimeConfig } from "shared/config";
import { LightingProfile, TimePeriod } from "shared/types";

interface EmissivePartData {
	part: BasePart;
	originalColor: Color3;
	originalMaterial: Enum.Material;
}

interface LampFixture {
	light?: Light;
	emissiveParts: EmissivePartData[];
}

/**
 * TimeService
 * Layanan client untuk memajukan siklus waktu secara lokal (60+ FPS smooth),
 * menginterpolasi warna pencahayaan atmosfer (Fajar, Siang, Senja, Malam),
 * serta mengotomatisasi lampu jalan dan lampu map saat malam tiba.
 */
export class TimeService {
	private static instance?: TimeService;

	private isInitialized = false;
	private localClockTime: number = TimeConfig.STARTING_CLOCK_TIME;
	private cycleDurationMinutes: number = TimeConfig.CYCLE_DURATION_MINUTES;
	private timeScale: number = TimeConfig.DEFAULT_TIME_SCALE;
	private isPaused = false;
	private isAdminTimeOverride = false;

	// Cache lampu jalan dan perlengkapan lampu di map
	private cachedFixtures: LampFixture[] = [];
	private isNightActive = false;

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

		// 3. Pindai dan siapkan lampu jalan di map
		this.scanMapLights();

		// Pantau jika ada objek lampu baru ditambahkan ke map secara dinamis
		Workspace.DescendantAdded.Connect((descendant) => {
			if (descendant.IsA("Light")) {
				this.registerLightInstance(descendant);
			} else if (descendant.IsA("Model")) {
				const modelName = descendant.Name.lower();
				for (const pattern of TimeConfig.STREETLIGHTS.NAME_PATTERNS) {
					if (modelName.find(pattern)[0] !== undefined) {
						this.registerModelFixture(descendant);
						break;
					}
				}
			}
		});

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
			this.updateStreetlights(this.localClockTime);
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

		// 4. Periksa kondisi lampu jalan
		this.updateStreetlights(this.localClockTime);
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
	 * Pindai lampu jalan di map berdasarkan tag atau nama.
	 */
	private scanMapLights(): void {
		this.cachedFixtures = [];
		const scannedModels = new Set<Instance>();

		// 1. Pindai model lampu jalan berdasarkan nama pola (misal StreetLamp, lamp, wallLamp)
		for (const desc of Workspace.GetDescendants()) {
			if (desc.IsA("Model")) {
				const modelName = desc.Name.lower();
				let matchesPattern = false;
				for (const pattern of TimeConfig.STREETLIGHTS.NAME_PATTERNS) {
					if (modelName.find(pattern)[0] !== undefined) {
						matchesPattern = true;
						break;
					}
				}
				if (matchesPattern || CollectionService.HasTag(desc, TimeConfig.STREETLIGHTS.COLLECTION_TAG)) {
					this.registerModelFixture(desc);
					scannedModels.add(desc);
				}
			}
		}

		// 2. Lampu bertag CollectionService yang berada di luar model di atas
		for (const instance of CollectionService.GetTagged(TimeConfig.STREETLIGHTS.COLLECTION_TAG)) {
			const ancestorModel = instance.FindFirstAncestorOfClass("Model");
			if (ancestorModel && scannedModels.has(ancestorModel)) continue;

			if (instance.IsA("Light")) {
				this.registerLightInstance(instance);
			} else if (instance.IsA("BasePart")) {
				const childLight = instance.FindFirstChildOfClass("Light");
				this.registerLightInstance(childLight, instance);
			}
		}

		// 3. Lampu standalone lainnya di Workspace
		for (const desc of Workspace.GetDescendants()) {
			if (desc.IsA("Light")) {
				const ancestorModel = desc.FindFirstAncestorOfClass("Model");
				if (ancestorModel && scannedModels.has(ancestorModel)) continue;

				const lightName = desc.Name.lower();
				const parentName = desc.Parent?.Name.lower() ?? "";
				for (const pattern of TimeConfig.STREETLIGHTS.NAME_PATTERNS) {
					if (lightName.find(pattern)[0] !== undefined || parentName.find(pattern)[0] !== undefined) {
						this.registerLightInstance(desc);
						break;
					}
				}
			}
		}

		// Evaluasi status awal lampu
		const isNight = this.isNightTime(this.localClockTime);
		this.isNightActive = isNight;
		this.applyStreetlightState(isNight);

		print(`[TimeService] Registered ${this.cachedFixtures.size()} dynamic map light fixtures.`);
	}

	private registerModelFixture(model: Model): void {
		// Hindari duplikasi jika model sudah diproses
		for (const fixture of this.cachedFixtures) {
			if (fixture.light && fixture.light.IsDescendantOf(model)) return;
		}

		const emissiveParts: EmissivePartData[] = [];
		let foundLight: Light | undefined = undefined;

		for (const desc of model.GetDescendants()) {
			if (desc.IsA("Light") && !foundLight) {
				foundLight = desc;
			}
			if (desc.IsA("BasePart") && !desc.IsA("MeshPart")) {
				const partName = desc.Name.lower();
				const isBulb =
					desc.Material === Enum.Material.Neon ||
					(desc.Name === "Part" && desc.Transparency < 0.5) ||
					partName.find("bulb")[0] !== undefined ||
					partName.find("light")[0] !== undefined;

				if (isBulb) {
					emissiveParts.push({
						part: desc,
						originalColor: desc.Color,
						originalMaterial:
							desc.Material === Enum.Material.Neon ? Enum.Material.Neon : Enum.Material.SmoothPlastic,
					});
				}
			}
		}

		if (foundLight || emissiveParts.size() > 0) {
			this.cachedFixtures.push({
				light: foundLight,
				emissiveParts,
			});
		}
	}

	private registerLightInstance(light?: Light, customPart?: BasePart): void {
		if (!light && !customPart) return;

		// Hindari duplikasi
		for (const fixture of this.cachedFixtures) {
			if (fixture.light && fixture.light === light) return;
		}

		const emissiveParts: EmissivePartData[] = [];
		const part = customPart ?? (light?.Parent && light.Parent.IsA("BasePart") ? light.Parent : undefined);
		if (part && !part.IsA("MeshPart") && part.Transparency < 0.5) {
			emissiveParts.push({
				part,
				originalColor: part.Color,
				originalMaterial: part.Material,
			});
		}

		this.cachedFixtures.push({
			light,
			emissiveParts,
		});
	}

	private isNightTime(clockTime: number): boolean {
		const turnOn = TimeConfig.STREETLIGHTS.TURN_ON_HOUR;
		const turnOff = TimeConfig.STREETLIGHTS.TURN_OFF_HOUR;
		// Malam: dari turnOn (17:45 sore saat petang tiba) hingga turnOff (06:00 pagi saat fajar tiba)
		return clockTime >= turnOn || clockTime < turnOff;
	}

	private updateStreetlights(clockTime: number): void {
		const shouldBeNight = this.isNightTime(clockTime);
		if (shouldBeNight !== this.isNightActive) {
			this.isNightActive = shouldBeNight;
			this.applyStreetlightState(shouldBeNight);
		}
	}

	private applyStreetlightState(enabled: boolean): void {
		for (const fixture of this.cachedFixtures) {
			if (fixture.light) {
				fixture.light.Enabled = enabled;
			}
			for (const emissive of fixture.emissiveParts) {
				if (enabled) {
					// Malam / Petang: Bohlam menyala berpijar Neon dengan warna hangat/terang
					emissive.part.Material = Enum.Material.Neon;
					emissive.part.Color = emissive.originalColor;
				} else {
					// Siang: Bohlam padam dingin (SmoothPlastic & warna kaca off-white abu redup)
					emissive.part.Material = Enum.Material.SmoothPlastic;
					emissive.part.Color = Color3.fromRGB(130, 130, 130);
				}
			}
		}
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
