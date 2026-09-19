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

	// Pre-buffered pools untuk pemutaran instan 0ms (Zero Latency)
	private popSounds: Sound[] = [];
	private currentPopIndex = 0;

	private landingSounds: Sound[] = [];
	private currentLandingIndex = 0;

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
		ContentProvider.PreloadAsync([this.rollingSound, ...this.popSounds, ...this.landingSounds]);
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
	 * Update suara rolling secara dinamis berdasarkan status kontak tanah dan kecepatan laju
	 */
	public updateRolling(isGrounded: boolean, speed: number, maxSpeed: number, dt: number): void {
		if (!this.rollingSound) return;

		const absSpeed = math.abs(speed);

		// Jika di udara atau laju sangat pelan (< 0.6 studs/s): fade out
		if (!isGrounded || absSpeed < 0.6) {
			if (this.rollingSound.Volume > 0.01) {
				this.rollingSound.Volume = math.max(0, this.rollingSound.Volume - 7 * dt);
			} else if (this.rollingSound.IsPlaying) {
				this.rollingSound.Stop();
				this.rollingSound.Volume = 0;
			}
			return;
		}

		// Jika di tanah dan sedang meluncur:
		if (!this.rollingSound.IsPlaying) {
			this.rollingSound.Volume = 0.05;
			this.rollingSound.Play();
		}

		// Hitung target volume dan pitch berdasarkan rasio kecepatan
		const speedAlpha = math.clamp(absSpeed / maxSpeed, 0, 1);
		const targetVolume = 0.15 + speedAlpha * 0.55; // Volume berkisar 0.15 - 0.70
		const targetPitch = 0.85 + speedAlpha * 0.35; // Pitch berkisar 0.85 - 1.20

		// Smooth lerp agar transisi suara halus & tidak mengejutkan telinga
		this.rollingSound.Volume =
			this.rollingSound.Volume +
			(targetVolume - this.rollingSound.Volume) * math.clamp(8 * dt, 0, 1);

		this.rollingSound.PlaybackSpeed =
			this.rollingSound.PlaybackSpeed +
			(targetPitch - this.rollingSound.PlaybackSpeed) * math.clamp(6 * dt, 0, 1);
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

		this.parentPart = undefined;
	}
}
