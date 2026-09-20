/**
 * SkateboardAudioService.ts
 * Mengelola efek suara realistis untuk sistem Skateboard R6 dengan latensi 0ms:
 * - Pre-buffered sound pools (Pop & Landing) agar berbunyi seketika tanpa delay streaming
 * - ContentProvider.PreloadAsync untuk caching audio ke memori sejak mount
 * - Rolling sound loop dinamis dengan modulasi volume & pitch berdasarkan kecepatan
 */

import { ContentProvider } from "@rbxts/services";
import { SkateboardConfig } from "shared/config/SkateboardConfig";

export class SkateboardAudioService {
	private static instance: SkateboardAudioService;

	private parentPart?: BasePart;
	private rollingSound?: Sound;
	private grindSound?: Sound;

	// Pre-buffered pools untuk pemutaran instan 0ms (Zero Latency)
	private popSounds: Sound[] = [];
	private currentPopIndex = 0;

	private landingSounds: Sound[] = [];
	private currentLandingIndex = 0;

	// Fisika Akustik Inersia Roda
	private virtualWheelSpeed = 0;
	private currentVolume = 0;
	private currentPitch = 0.85;

	private constructor() {}

	public static getInstance(): SkateboardAudioService {
		if (!SkateboardAudioService.instance) {
			SkateboardAudioService.instance = new SkateboardAudioService();
		}
		return SkateboardAudioService.instance;
	}

	/**
	 * Inisialisasi audio service dengan part penempel suara 3D (HRP)
	 * Menyiapkan instance audio dan pre-buffer ke memori agar instan tanpa lag
	 */
	public init(parentPart: BasePart): void {
		this.cleanup();
		this.parentPart = parentPart;

		// 1. Rolling loop sound
		const roll = new Instance("Sound");
		roll.Name = "SkateboardRolling";
		roll.SoundId = SkateboardConfig.SOUNDS.rolling;
		roll.Looped = true;
		roll.Volume = 0;
		roll.PlaybackSpeed = 0.85;
		roll.RollOffMode = Enum.RollOffMode.InverseTapered;
		roll.MinDistance = 6;
		roll.MaxDistance = 55;
		roll.Parent = parentPart;
		this.rollingSound = roll;

		// 1.5 Grind loop sound
		const grind = new Instance("Sound");
		grind.Name = "SkateboardGrind";
		grind.SoundId = SkateboardConfig.SOUNDS.grind;
		grind.Looped = true;
		grind.Volume = 0;
		grind.PlaybackSpeed = 1.0;
		grind.RollOffMode = Enum.RollOffMode.InverseTapered;
		grind.MinDistance = 8;
		grind.MaxDistance = 65;
		grind.Parent = parentPart;
		this.grindSound = grind;

		// 2. Pre-created pool untuk Pop sound (2 slot agar tidak terpotong saat trigger cepat)
		this.popSounds = [];
		for (let i = 0; i < 2; i++) {
			const pop = new Instance("Sound");
			pop.Name = `SkateboardPop_${i}`;
			pop.SoundId = SkateboardConfig.SOUNDS.pop;
			pop.Volume = 0.85;
			pop.PlaybackSpeed = 1.0;
			pop.RollOffMode = Enum.RollOffMode.InverseTapered;
			pop.MinDistance = 6;
			pop.MaxDistance = 60;
			pop.Parent = parentPart;
			this.popSounds.push(pop);
		}

		// 3. Pre-created pool untuk Landing sound (2 slot)
		this.landingSounds = [];
		for (let i = 0; i < 2; i++) {
			const land = new Instance("Sound");
			land.Name = `SkateboardLanding_${i}`;
			land.SoundId = SkateboardConfig.SOUNDS.landing;
			land.Volume = 0.9;
			land.PlaybackSpeed = 1.0;
			land.RollOffMode = Enum.RollOffMode.InverseTapered;
			land.MinDistance = 8;
			land.MaxDistance = 65;
			land.Parent = parentPart;
			this.landingSounds.push(land);
		}

		// Preload seluruh aset audio ke memori client secara asynchronous
		ContentProvider.PreloadAsync([this.rollingSound, this.grindSound, ...this.popSounds, ...this.landingSounds]);
	}

	/**
	 * Memulai audio gesekan rel saat karakter lock ke rail grind
	 */
	public startGrind(): void {
		if (!this.grindSound) return;
		this.grindSound.Volume = 0.45;
		this.grindSound.PlaybackSpeed = 0.95;
		this.grindSound.TimePosition = 0;
		if (!this.grindSound.IsPlaying) {
			this.grindSound.Play();
		}
	}

	/**
	 * Memperbarui modulasi volume & pitch audio grind berdasarkan kecepatan luncur rel
	 */
	public updateGrind(speed: number, maxSpeed: number, dt: number): void {
		if (!this.grindSound || !this.grindSound.IsPlaying) return;

		const absSpeed = math.abs(speed);
		const speedAlpha = math.clamp(absSpeed / maxSpeed, 0, 1.4);
		const targetVolume = 0.4 + speedAlpha * 0.45;
		const targetPitch = 0.9 + speedAlpha * 0.25;

		this.grindSound.Volume =
			this.grindSound.Volume + (targetVolume - this.grindSound.Volume) * math.clamp(10 * dt, 0, 1);
		this.grindSound.PlaybackSpeed =
			this.grindSound.PlaybackSpeed + (targetPitch - this.grindSound.PlaybackSpeed) * math.clamp(8 * dt, 0, 1);
	}

	/**
	 * Menghentikan audio grind saat lepas atau lompat keluar dari rel
	 */
	public stopGrind(): void {
		if (!this.grindSound) return;
		if (this.grindSound.IsPlaying) {
			this.grindSound.Stop();
			this.grindSound.Volume = 0;
		}
	}

	/**
	 * Suara pop hentakan tail papan saat Ollie - dimainkan instan 0ms saat Space dilepas
	 */
	public playPop(): void {
		if (this.popSounds.size() === 0) return;

		const sound = this.popSounds[this.currentPopIndex];
		this.currentPopIndex = (this.currentPopIndex + 1) % this.popSounds.size();

		sound.PlaybackSpeed = 0.96 + math.random() * 0.08;
		sound.TimePosition = 0;
		sound.Play();
	}

	/**
	 * Suara debuman roda & papan saat menyentuh aspal - instan 0ms tanpa delay
	 */
	public playLanding(impactMultiplier = 1.0): void {
		if (this.landingSounds.size() === 0) return;

		const sound = this.landingSounds[this.currentLandingIndex];
		this.currentLandingIndex = (this.currentLandingIndex + 1) % this.landingSounds.size();

		sound.Volume = math.clamp(0.9 * impactMultiplier, 0.45, 1.0);
		sound.PlaybackSpeed = 0.94 + math.random() * 0.1;
		sound.TimePosition = 0;
		sound.Play();
	}

	/**
	 * Update suara rolling secara dinamis berdasarkan status kontak tanah, kecepatan laju fisik,
	 * material permukaan pijakan, status pengereman, dan inersia putaran roda di udara (Ollie).
	 */
	public updateRolling(
		isGrounded: boolean,
		speed: number,
		maxSpeed: number,
		dt: number,
		material?: Enum.Material,
		isBraking?: boolean,
	): void {
		if (!this.rollingSound) return;

		const cfg = SkateboardConfig.AUDIO;
		const absSpeed = math.abs(speed);

		if (!this.rollingSound.IsPlaying) {
			this.rollingSound.Volume = 0;
			this.rollingSound.Play();
		}

		if (isGrounded) {
			// 1. DI TANAH: Roda berputar langsung sesuai kecepatan kontak aspal
			this.virtualWheelSpeed = absSpeed;

			if (absSpeed < cfg.minRollSpeed) {
				// Berhenti di tempat: fade out lembut ke hening (bebas suara klik/pop)
				this.currentVolume = math.max(0, this.currentVolume - 3.5 * dt);
				this.rollingSound.Volume = this.currentVolume;
				return;
			}

			// Rasio kecepatan fisik non-linear (kurva eksponensial respons telinga manusia)
			const speedRatio = math.clamp(absSpeed / maxSpeed, 0, 1.2);
			let targetVolume = cfg.minRollVolume + math.pow(speedRatio, 1.2) * (cfg.maxRollVolume - cfg.minRollVolume);
			let targetPitch = cfg.minRollPitch + speedRatio * (cfg.maxRollPitch - cfg.minRollPitch);

			// Modulasi material permukaan pijakan (akustik lingkungan)
			if (material) {
				if (
					material === Enum.Material.Grass ||
					material === Enum.Material.Sand ||
					material === Enum.Material.Fabric
				) {
					targetVolume *= 0.65;
					targetPitch *= 0.88;
				} else if (material === Enum.Material.Metal || material === Enum.Material.CorrodedMetal) {
					targetVolume *= 1.1;
					targetPitch *= 1.08;
				} else if (material === Enum.Material.Wood || material === Enum.Material.WoodPlanks) {
					targetVolume *= 1.05;
					targetPitch *= 0.96;
				}
			}

			// Modulasi gesekan saat pengereman aktif (menahan tombol S)
			if (isBraking && absSpeed > 3) {
				targetVolume = math.min(cfg.maxRollVolume * 1.15, targetVolume * 1.25);
				targetPitch *= 0.94;
			}

			// Smooth lerp di tanah (cepat & responsif)
			this.currentVolume =
				this.currentVolume + (targetVolume - this.currentVolume) * math.clamp(cfg.groundLerpSpeed * dt, 0, 1);
			this.currentPitch =
				this.currentPitch + (targetPitch - this.currentPitch) * math.clamp(cfg.groundLerpSpeed * dt, 0, 1);
		} else {
			// 2. DI UDARA (Ollie / Melayang):
			// Roda tidak mati seketika! Inersia massa & bearing roda membuatnya tetap berputar bebas di udara,
			// menghasilkan desingan halus berangsur melambat (fade out realistis ~0.6-0.8 detik).
			if (this.virtualWheelSpeed > 0.5) {
				// Deselerasi putaran bebas akibat hambatan udara dan gesekan bearing
				const decayRate = 14 + this.virtualWheelSpeed * cfg.airborneDecayRate;
				this.virtualWheelSpeed = math.max(0, this.virtualWheelSpeed - decayRate * dt);

				const airRatio = math.clamp(this.virtualWheelSpeed / maxSpeed, 0, 1.2);
				const targetVolume =
					(cfg.minRollVolume + math.pow(airRatio, 1.3) * (cfg.maxRollVolume - cfg.minRollVolume)) *
					cfg.airborneVolumeMultiplier;
				const targetPitch = (cfg.minRollPitch + airRatio * (cfg.maxRollPitch - cfg.minRollPitch)) * 1.05;

				this.currentVolume =
					this.currentVolume + (targetVolume - this.currentVolume) * math.clamp(cfg.airLerpSpeed * dt, 0, 1);
				this.currentPitch =
					this.currentPitch + (targetPitch - this.currentPitch) * math.clamp(cfg.airLerpSpeed * dt, 0, 1);
			} else {
				// Roda sudah benar-benar berhenti berputar di udara
				this.currentVolume = math.max(0, this.currentVolume - 4.0 * dt);
			}
		}

		this.rollingSound.Volume = math.clamp(this.currentVolume, 0, 1);
		this.rollingSound.PlaybackSpeed = math.clamp(this.currentPitch, 0.5, 2.0);
	}

	/**
	 * Hentikan dan bersihkan seluruh suara skateboard
	 */
	public cleanup(): void {
		if (this.rollingSound) {
			this.rollingSound.Stop();
			this.rollingSound.Destroy();
			this.rollingSound = undefined;
		}

		if (this.grindSound) {
			this.grindSound.Stop();
			this.grindSound.Destroy();
			this.grindSound = undefined;
		}

		for (const pop of this.popSounds) {
			pop.Stop();
			pop.Destroy();
		}
		this.popSounds = [];
		this.currentPopIndex = 0;

		for (const land of this.landingSounds) {
			land.Stop();
			land.Destroy();
		}
		this.landingSounds = [];
		this.currentLandingIndex = 0;

		this.virtualWheelSpeed = 0;
		this.currentVolume = 0;
		this.currentPitch = 0.85;

		this.parentPart = undefined;
	}
}
