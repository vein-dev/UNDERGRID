import { CollectionService, Lighting, RunService, Workspace } from "@rbxts/services";
import { StreetlightConfig } from "shared/config";
import { TimeService } from "client/services/TimeService";

interface ParsedStreetlightAttributes {
	lightColor: Color3;
	offColor: Color3;
	brightness: number;
	range: number;
	angle: number;
	face: Enum.NormalId;
	shadows: boolean;
	onClockTime: number;
	offClockTime: number;
	alwaysOn: boolean;
	flicker: boolean;
	manualEnabled?: boolean;
}

interface StreetlightEntry {
	part: BasePart;
	spotLight: SpotLight;
	attributes: ParsedStreetlightAttributes;
	connections: RBXScriptConnection[];
	originalColor: Color3;
	originalMaterial: Enum.Material;
	isCurrentlyOn: boolean;
	flickerSeed: number;
}

/**
 * StreetlightController
 * Controller terpusat untuk mengelola seluruh lampu jalan berbasis Tag (CollectionService)
 * dan Attributes dengan emisi cahaya SpotLight.
 */
export class StreetlightController {
	private static instance?: StreetlightController;

	private isInitialized = false;
	private readonly entries = new Map<BasePart, StreetlightEntry>();
	private updateTimer = 0;

	private constructor() {}

	public static getInstance(): StreetlightController {
		if (!StreetlightController.instance) {
			StreetlightController.instance = new StreetlightController();
		}
		return StreetlightController.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		// 1. Daftarkan instance yang sudah memiliki tag saat client pertama kali load
		for (const inst of CollectionService.GetTagged(StreetlightConfig.TAG)) {
			this.onInstanceAdded(inst);
		}

		// 2. Dengarkan instance yang baru ditambahkan tag (mendukung streaming & dynamic spawning)
		CollectionService.GetInstanceAddedSignal(StreetlightConfig.TAG).Connect((inst) => {
			this.onInstanceAdded(inst);
		});

		// 3. Dengarkan instance yang tag-nya dilepas atau dihapus dari game
		CollectionService.GetInstanceRemovedSignal(StreetlightConfig.TAG).Connect((inst) => {
			this.onInstanceRemoved(inst);
		});

		// 4. Update berkala untuk evaluasi status on/off berdasarkan siklus jam & efek flicker
		RunService.Heartbeat.Connect((dt) => {
			this.onHeartbeat(dt);
		});

		print(
			`[StreetlightController] Initialized successfully. Tag="${StreetlightConfig.TAG}", SpotLight="${StreetlightConfig.SPOTLIGHT_NAME}".`,
		);
	}

	/**
	 * Handler saat instance dengan tag ditambahkan ke game
	 */
	private onInstanceAdded(inst: Instance): void {
		if (inst.IsA("BasePart")) {
			this.registerPart(inst);
		} else if (inst.IsA("Model")) {
			// Jika Model yang ditag, cari BasePart yang merupakan lampu utama atau daftarkan part turunannya
			const primary = (inst.FindFirstChild("Light", true) ??
				inst.FindFirstChild("Bulb", true) ??
				inst.FindFirstChild("Lamp", true) ??
				inst.FindFirstChildWhichIsA("BasePart", true)) as BasePart | undefined;
			if (primary) {
				this.registerPart(primary);
			}
		}
	}

	/**
	 * Handler saat instance dengan tag dihapus
	 */
	private onInstanceRemoved(inst: Instance): void {
		if (inst.IsA("BasePart")) {
			this.unregisterPart(inst);
		} else if (inst.IsA("Model")) {
			for (const [part] of this.entries) {
				if (part.IsDescendantOf(inst)) {
					this.unregisterPart(part);
				}
			}
		}
	}

	/**
	 * Mendaftarkan sebuah BasePart sebagai lampu jalan dan mengaitkan SpotLight & listener
	 */
	public registerPart(part: BasePart): void {
		if (this.entries.has(part)) return;

		// 1. Temukan atau buat SpotLight di dalam part
		let spotLight = part.FindFirstChild(StreetlightConfig.SPOTLIGHT_NAME) as SpotLight | undefined;
		if (!spotLight) {
			// Cari apakah ada SpotLight lain yang sudah terpasang
			spotLight = part.FindFirstChildWhichIsA("SpotLight");
		}
		if (!spotLight) {
			spotLight = new Instance("SpotLight");
			spotLight.Name = StreetlightConfig.SPOTLIGHT_NAME;
			spotLight.Parent = part;
		}

		// 2. Baca attributes dari part
		const attributes = this.readAttributes(part);

		// 3. Simpan state awal part untuk restorasi saat off
		const entry: StreetlightEntry = {
			part,
			spotLight,
			attributes,
			connections: [],
			originalColor: part.Color,
			originalMaterial: part.Material,
			isCurrentlyOn: false,
			flickerSeed: math.random(1, 10000),
		};

		// 4. Dengarkan perubahan attribute secara real-time pada Part maupun Parent Model
		entry.connections.push(
			part.AttributeChanged.Connect(() => {
				entry.attributes = this.readAttributes(part);
				this.applyLightState(entry, entry.isCurrentlyOn, true);
			}),
		);
		if (part.Parent?.IsA("Model")) {
			entry.connections.push(
				part.Parent.AttributeChanged.Connect(() => {
					entry.attributes = this.readAttributes(part);
					this.applyLightState(entry, entry.isCurrentlyOn, true);
				}),
			);
		}

		// 5. Cleanup saat part dihapus dari workspace
		entry.connections.push(
			part.AncestryChanged.Connect((_child, parent) => {
				if (!parent || !part.IsDescendantOf(Workspace)) {
					this.unregisterPart(part);
				}
			}),
		);

		this.entries.set(part, entry);

		// Evaluasi langsung status lampu pada detik pendaftaran
		const currentClock = this.getCurrentClockTime();
		const shouldOn = this.shouldBeOn(entry, currentClock);
		this.applyLightState(entry, shouldOn, true);
	}

	/**
	 * Menghapus pendaftaran BasePart dan membersihkan koneksi
	 */
	public unregisterPart(part: BasePart): void {
		const entry = this.entries.get(part);
		if (!entry) return;

		for (const conn of entry.connections) {
			conn.Disconnect();
		}
		entry.connections = [];

		this.entries.delete(part);
	}

	/**
	 * Membaca attributes dari BasePart atau Parent Model dengan fallback ke nilai default config
	 */
	private readAttributes(part: BasePart): ParsedStreetlightAttributes {
		const cfg = StreetlightConfig.DEFAULTS;
		const attrNames = StreetlightConfig.ATTRIBUTES;
		const parent = part.Parent?.IsA("Model") ? part.Parent : undefined;

		const getAttr = <T>(name: string, fallback: T): T => {
			const val = part.GetAttribute(name) ?? parent?.GetAttribute(name);
			return val !== undefined ? (val as T) : fallback;
		};

		const lightColor = getAttr<Color3>(attrNames.LIGHT_COLOR, cfg.lightColor);
		const offColor = getAttr<Color3>(attrNames.OFF_COLOR, cfg.offColor);
		const brightness = getAttr<number>(attrNames.BRIGHTNESS, cfg.brightness);
		const range = getAttr<number>(attrNames.RANGE, cfg.range);
		const angle = getAttr<number>(attrNames.ANGLE, cfg.angle);
		const faceStr = getAttr<string>(attrNames.FACE, cfg.face);
		const shadows = getAttr<boolean>(attrNames.SHADOWS, cfg.shadows);
		const onClockTime = getAttr<number>(attrNames.ON_CLOCK_TIME, cfg.onClockTime);
		const offClockTime = getAttr<number>(attrNames.OFF_CLOCK_TIME, cfg.offClockTime);
		const alwaysOn = getAttr<boolean>(attrNames.ALWAYS_ON, cfg.alwaysOn);
		const flicker = getAttr<boolean>(attrNames.FLICKER, cfg.flicker);
		const manualEnabled = (part.GetAttribute(attrNames.ENABLED) ?? parent?.GetAttribute(attrNames.ENABLED)) as
			| boolean
			| undefined;

		return {
			lightColor,
			offColor,
			brightness,
			range,
			angle,
			face: this.parseNormalId(faceStr),
			shadows,
			onClockTime,
			offClockTime,
			alwaysOn,
			flicker,
			manualEnabled,
		};
	}

	/**
	 * Mengonversi string nama arah (Face) ke Enum.NormalId
	 */
	private parseNormalId(faceStr: string): Enum.NormalId {
		const lower = faceStr.lower();
		if (lower === "top") return Enum.NormalId.Top;
		if (lower === "bottom") return Enum.NormalId.Bottom;
		if (lower === "front") return Enum.NormalId.Front;
		if (lower === "back") return Enum.NormalId.Back;
		if (lower === "left") return Enum.NormalId.Left;
		if (lower === "right") return Enum.NormalId.Right;
		return Enum.NormalId.Bottom;
	}

	/**
	 * Menentukan apakah lampu harus menyala berdasarkan waktu jam saat ini
	 */
	private shouldBeOn(entry: StreetlightEntry, currentClockTime: number): boolean {
		const attrs = entry.attributes;

		// 1. Override manual jika ada attribute "Enabled"
		if (attrs.manualEnabled !== undefined) {
			return attrs.manualEnabled;
		}

		// 2. Mode AlwaysOn
		if (attrs.alwaysOn) {
			return true;
		}

		// 3. Evaluasi siklus jam
		const onTime = attrs.onClockTime;
		const offTime = attrs.offClockTime;

		if (onTime > offTime) {
			// Menyala melewati tengah malam (misal On=18:00, Off=06:00)
			return currentClockTime >= onTime || currentClockTime < offTime;
		} else {
			// Rentang siang standar (misal On=08:00, Off=17:00)
			return currentClockTime >= onTime && currentClockTime < offTime;
		}
	}

	/**
	 * Mengaplikasikan status visual pada part dan SpotLight
	 */
	private applyLightState(entry: StreetlightEntry, shouldBeOn: boolean, force = false): void {
		if (entry.isCurrentlyOn === shouldBeOn && !force) return;
		entry.isCurrentlyOn = shouldBeOn;

		const attrs = entry.attributes;
		const spot = entry.spotLight;
		const part = entry.part;

		if (shouldBeOn) {
			// Aktifkan SpotLight
			spot.Enabled = true;
			spot.Color = attrs.lightColor;
			spot.Brightness = attrs.brightness;
			spot.Range = attrs.range;
			spot.Angle = attrs.angle;
			spot.Face = attrs.face;
			spot.Shadows = attrs.shadows;

			// Aktifkan material Neon pada part
			part.Material = Enum.Material.Neon;
			part.Color = attrs.lightColor;
		} else {
			// Matikan SpotLight
			spot.Enabled = false;

			// Kembalikan part ke material SmoothPlastic dan warna redup
			part.Material = Enum.Material.SmoothPlastic;
			part.Color = attrs.offColor;
		}
	}

	/**
	 * Loop heartbeat untuk update berkala evaluasi waktu dan efek flicker
	 */
	private onHeartbeat(dt: number): void {
		this.updateTimer += dt;

		// Evaluasi waktu setiap UPDATE_INTERVAL_SECONDS (0.5 detik)
		if (this.updateTimer >= StreetlightConfig.UPDATE_INTERVAL_SECONDS) {
			this.updateTimer = 0;
			const currentClock = this.getCurrentClockTime();

			for (const [, entry] of this.entries) {
				const shouldOn = this.shouldBeOn(entry, currentClock);
				this.applyLightState(entry, shouldOn);
			}
		}

		// Efek subtle flicker jika diaktifkan pada atribut part
		const now = os.clock();
		for (const [, entry] of this.entries) {
			if (entry.isCurrentlyOn && entry.attributes.flicker && entry.spotLight.Enabled) {
				const speed = StreetlightConfig.DEFAULTS.flickerSpeed;
				const intensity = StreetlightConfig.DEFAULTS.flickerIntensity;
				const noise = math.noise(now * speed, entry.flickerSeed, 0); // Rentang -0.5 s/d 0.5
				const baseBrightness = entry.attributes.brightness;
				entry.spotLight.Brightness = math.max(0.5, baseBrightness + noise * intensity * baseBrightness);
			}
		}
	}

	/**
	 * Mengambil ClockTime saat ini dari TimeService (lokal) atau Lighting
	 */
	private getCurrentClockTime(): number {
		try {
			return TimeService.getInstance().getClockTime();
		} catch {
			return Lighting.ClockTime;
		}
	}

	/**
	 * Mengambil jumlah lampu jalan yang sedang terdaftar
	 */
	public getRegisteredCount(): number {
		return this.entries.size();
	}
}
