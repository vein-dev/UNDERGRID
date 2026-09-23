export enum NeonCircuitState {
	SteadyOn,
	ShortCircuit,
	Blackout,
	SparkRecover,
}

export interface FlickeringNeonOptions {
	neonColor?: Color3;
	dimColor?: Color3;
	maxBrightness?: number;
	lightRange?: number;
	onlyAtNight?: boolean;
	turnOnHour?: number;
	turnOffHour?: number;
	flickering?: boolean;
}

interface TrackedPartInfo {
	part: BasePart;
	defaultMaterial: Enum.Material;
	defaultColor: Color3;
}

/**
 * FlickeringNeonComponent
 * Komponen template yang mengelola animasi lampu neon konslet / korsleting realistis pada Model / BasePart.
 * Mendukung konfigurasi via Attributes di Roblox Studio:
 * - `Flickering` (boolean): Efek konslet aktif (true) atau nyala solid normal (false) (Default: true).
 * - `NeonColor` (Color3): Warna menyala (Default: #d21414 / Merah).
 * - `DimColor` (Color3): Warna padam opsional (Default: Warna asli bawaan model).
 * - `MaxBrightness` (number): Kecerahan PointLight (Default: 0.45).
 * - `LightRange` (number): Jarak pancaran sinar dalam stud (Default: 8).
 * - `OnlyAtNight` (boolean): Hanya menyala di malam hari (Default: true).
 * - `TurnOnHour` (number): Jam malam mulai (Default: 18.0).
 * - `TurnOffHour` (number): Jam pagi mulai padam (Default: 6.0).
 */
export class FlickeringNeonComponent {
	public readonly instance: Instance;

	private trackedParts: TrackedPartInfo[] = [];
	private pointLights: PointLight[] = [];

	// State machine
	private currentState: NeonCircuitState = NeonCircuitState.SteadyOn;
	private stateStartTime = 0;
	private stateDuration = 2.0;

	// Waktu & Day/Night tracker
	private wasNight = false;

	constructor(instance: Instance) {
		this.instance = instance;
		this.stateStartTime = os.clock();
		this.stateDuration = 2.0;

		this.setupPartsAndLights();
	}

	/**
	 * Mengambil konfigurasi dari Attributes instance atau nilai default
	 */
	public getOptions(): Omit<Required<FlickeringNeonOptions>, "dimColor"> & { dimColor?: Color3 } {
		const inst = this.instance;
		const neonColor = (inst.GetAttribute("NeonColor") as Color3 | undefined) ?? Color3.fromRGB(210, 20, 20);
		const dimColor = inst.GetAttribute("DimColor") as Color3 | undefined;
		const maxBrightness = inst.GetAttribute("MaxBrightness") as number | undefined;
		const lightRange = inst.GetAttribute("LightRange") as number | undefined;
		const onlyAtNight = inst.GetAttribute("OnlyAtNight") as boolean | undefined;
		const turnOnHour = inst.GetAttribute("TurnOnHour") as number | undefined;
		const turnOffHour = inst.GetAttribute("TurnOffHour") as number | undefined;
		const flickering = inst.GetAttribute("Flickering") as boolean | undefined;

		return {
			neonColor,
			dimColor,
			maxBrightness: maxBrightness ?? 0.45,
			lightRange: lightRange ?? 8,
			onlyAtNight: onlyAtNight ?? true,
			turnOnHour: turnOnHour ?? 18.0,
			turnOffHour: turnOffHour ?? 6.0,
			flickering: flickering ?? true,
		};
	}

	private setupPartsAndLights(): void {
		const rawParts: BasePart[] = [];

		if (this.instance.IsA("BasePart")) {
			if (this.instance.Transparency < 1) {
				rawParts.push(this.instance);
			}
		} else if (this.instance.IsA("Model")) {
			for (const desc of this.instance.GetDescendants()) {
				if (desc.IsA("BasePart") && desc.Transparency < 1) {
					rawParts.push(desc);
				}
			}
		}

		// Simpan material dan warna asli bawaan model
		this.trackedParts = rawParts.map((p) => ({
			part: p,
			defaultMaterial: p.Material,
			defaultColor: p.Color,
		}));

		// Bersihkan lampu lama
		for (const pl of this.pointLights) {
			pl.Destroy();
		}
		this.pointLights = [];

		const opts = this.getOptions();
		const count = this.trackedParts.size();

		if (count > 0) {
			// Jika 1 part: pasang 1 lampu. Jika banyak part: pasang 2 lampu terdistribusi merata
			const indices = count === 1 ? [0] : [math.floor(count * 0.25), math.floor(count * 0.75)];

			for (const idx of indices) {
				const item = this.trackedParts[idx];
				if (item) {
					const light = new Instance("PointLight");
					light.Name = `FlickeringNeonLight_${idx}`;
					light.Color = opts.neonColor;
					light.Range = opts.lightRange;
					light.Brightness = opts.maxBrightness;
					light.Shadows = false;
					light.Parent = item.part;
					this.pointLights.push(light);
				}
			}
		}
	}

	private switchState(newState: NeonCircuitState, duration: number): void {
		this.currentState = newState;
		this.stateStartTime = os.clock();
		this.stateDuration = duration;
	}

	/**
	 * Update frame loop dieksekusi secara terpusat oleh controller
	 */
	public update(now: number, clockTime: number): void {
		if (this.trackedParts.size() === 0) {
			this.setupPartsAndLights();
			if (this.trackedParts.size() === 0) return;
		}

		const opts = this.getOptions();

		// ─── 1. Sinkronisasi Waktu Siang / Malam ───
		let isNight = true;
		if (opts.onlyAtNight) {
			isNight = clockTime >= opts.turnOnHour || clockTime < opts.turnOffHour;

			// Deteksi transisi sore ke malam: percikan api hidup (spark recovery)
			if (isNight && !this.wasNight) {
				this.switchState(NeonCircuitState.SparkRecover, 0.35);
			}
			this.wasNight = isNight;

			// Jika sedang siang hari: kembalikan material & warna asli model & padamkan PointLight
			if (!isNight) {
				for (const item of this.trackedParts) {
					if (item.part.Parent) {
						item.part.Color = item.defaultColor;
						item.part.Material = item.defaultMaterial;
					}
				}
				for (const light of this.pointLights) {
					if (light.Parent) {
						light.Brightness = 0;
						light.Enabled = false;
					}
				}
				return;
			}
		}

		// ─── 2. Evaluasi Status Sirkuit Listrik & Konslet ───
		let isCircuitOn = true;
		let lightAlpha = 1.0;

		if (opts.flickering) {
			const elapsed = now - this.stateStartTime;
			if (elapsed >= this.stateDuration) {
				switch (this.currentState) {
					case NeonCircuitState.SteadyOn:
						// Setelah nyala stabil 1.5 - 3.2 detik, mulai konslet
						this.switchState(NeonCircuitState.ShortCircuit, math.random(30, 65) / 100);
						break;
					case NeonCircuitState.ShortCircuit:
						// Setelah konslet, padam total (blackout) 0.25 - 0.65 detik
						this.switchState(NeonCircuitState.Blackout, math.random(25, 65) / 100);
						break;
					case NeonCircuitState.Blackout:
						// Coba nyala kembali dengan percikan spark
						this.switchState(NeonCircuitState.SparkRecover, 0.28);
						break;
					case NeonCircuitState.SparkRecover:
						// Kembali ke nyala stabil
						this.switchState(NeonCircuitState.SteadyOn, math.random(15, 32) / 10);
						break;
				}
			}

			switch (this.currentState) {
				case NeonCircuitState.SteadyOn: {
					const hum = math.sin(now * 15) * 0.05;
					lightAlpha = math.clamp(0.95 + hum, 0.9, 1.0);
					isCircuitOn = true;
					break;
				}
				case NeonCircuitState.ShortCircuit: {
					const step = math.floor(elapsed * 18);
					isCircuitOn = step % 2 === 0 || math.random() > 0.45;
					lightAlpha = isCircuitOn ? 0.85 + math.random() * 0.2 : 0;
					break;
				}
				case NeonCircuitState.Blackout: {
					isCircuitOn = false;
					lightAlpha = 0;
					break;
				}
				case NeonCircuitState.SparkRecover: {
					const isSpark1 = elapsed < 0.06;
					const isSpark2 = elapsed > 0.12 && elapsed < 0.19;
					const isIgnited = elapsed > 0.23;
					isCircuitOn = isSpark1 || isSpark2 || isIgnited;
					lightAlpha = isCircuitOn ? 0.9 : 0;
					break;
				}
			}
		} else {
			// Mode Flickering OFF: Menyala solid & stabil 100% tanpa konslet
			isCircuitOn = true;
			lightAlpha = 1.0;
		}

		// ─── 3. Terapkan Visual ke Parts & Lights ───
		const targetBrightness = isCircuitOn ? opts.maxBrightness * lightAlpha : 0;
		const rogueIndex = this.trackedParts.size() - 1;

		for (let i = 0; i < this.trackedParts.size(); i++) {
			const item = this.trackedParts[i];
			if (!item.part.Parent) continue;

			let letterOn = isCircuitOn;
			if (opts.flickering && i === rogueIndex && this.currentState === NeonCircuitState.ShortCircuit) {
				letterOn = !letterOn;
			}

			item.part.Color = letterOn ? opts.neonColor : (opts.dimColor ?? item.defaultColor);
			// Saat menyala: Neon. Saat tidak menyala/padam: kembalikan material default model
			item.part.Material = letterOn ? Enum.Material.Neon : item.defaultMaterial;
		}

		for (const light of this.pointLights) {
			if (light.Parent) {
				light.Color = opts.neonColor;
				light.Range = opts.lightRange;
				light.Brightness = targetBrightness;
				light.Enabled = isCircuitOn && targetBrightness > 0.05;
			}
		}
	}

	public destroy(): void {
		for (const pl of this.pointLights) {
			pl.Destroy();
		}
		this.pointLights = [];

		for (const item of this.trackedParts) {
			if (item.part.Parent) {
				item.part.Material = item.defaultMaterial;
				item.part.Color = item.defaultColor;
			}
		}
		this.trackedParts = [];
	}
}
