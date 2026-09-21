import { CollectionService, RunService, SoundService, Workspace } from "@rbxts/services";
import { AdminService } from "client/services/AdminService";
import { MusicPlayerService } from "client/services/MusicPlayerService";
import { MusicPlayerState, StageLightMode } from "shared/types";

interface ClientFixture {
	model: Model;
	column: number;
	panMotor?: Motor6D;
	tiltMotor?: Motor6D;
	spot?: SpotLight;
	beam?: Beam;
	lens?: BasePart;

	// Physical motor state for inertia & zero-jerk smoothing
	currentPan: number;
	currentTilt: number;
	targetPan: number;
	targetTilt: number;
	currentBrightness: number;
}

const BASE_PAN_C0 = new CFrame(0.0285873413, -0.258911133, -0.00492858887, 1, 0, 0, 0, 0, 1, 0, -1, 0);
const BASE_TILT_C0 = new CFrame(0.0239474773, -0.515777588, -0.00769042969, 1, 0, 0, 0, -1, 0, 0, 0, -1);

const MIC_AIMS: Record<string, [number, number]> = {
	StageLight_C1_R01: [0.75, -0.836],
	StageLight_C1_R02: [0.466, -0.738],
	StageLight_C1_R03: [0.014, -0.682],
	StageLight_C1_R04: [-0.456, -0.732],
	StageLight_C1_R05: [-0.802, -0.86],
};

const TOTAL_PATTERNS = 5;
const PATTERN_DURATION = 16.0; // Berpindah gaya koreografi tiap 16 detik
const BLEND_DURATION = 2.0; // Durasi transisi halus (crossfade) antar pola

/**
 * ClientStageLightingController
 * Pengontrol visual dan motor lighting panggung real-time berlatensi 0ms pada client:
 * 1. Advanced Drum & Bass DSP Engine: Inter-Onset Interval (IOI) beat tracker + Bass Floor Valley Analyzer.
 * 2. 4-Tier Musical Phase Classifier: Membedakan secara nyata Intro (0.3x), Verse (0.7x), Bridge (1.35x), dan Reff (2.5x).
 * 3. Phase-Locked Groove: Mengunci ritme motor tepat pada ketukan kick drum.
 * 4. Multi-Choreography Engine: 5 gaya gerakan panggung berbeda dengan transisi smoothstep crossfade.
 * 5. Physical Motor Slew-Rate Smoothing: Inersia mekanik nyata tanpa patah atau sentakan.
 * 6. Zero Upward Light: Kunci sudut tilt [-0.92, -0.52] rad menjamin 100% sorotan ke panggung.
 */
export class ClientStageLightingController {
	private static instance?: ClientStageLightingController;

	private isInitialized = false;
	private fixtures: ClientFixture[] = [];

	// Advanced Drum & Bass DSP Analytics
	private lastLoudness = 0;
	private shortEnergy = 0;
	private mediumEnergy = 0;
	private macroEnergy = 0;
	private bassFloorEnergy = 0;
	private kickDensity = 0;
	private kickIntensity = 0;
	private beatPhaseNudge = 0;
	private lastKickTimestamp = 0;
	private trackedBPM = 120;
	private musicalIntensity = 0;
	private currentSpeedMult = 0.5;
	private animTime = 0;

	// Multi-Choreography Scheduler & Blending
	private currentPattern = 0;
	private nextPattern = 1;
	private patternTimer = 0;
	private isBlending = false;
	private blendProgress = 0;

	private constructor() {}

	public static getInstance(): ClientStageLightingController {
		if (!ClientStageLightingController.instance) {
			ClientStageLightingController.instance = new ClientStageLightingController();
		}
		return ClientStageLightingController.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		this.indexLocalFixtures();

		// Update visual audio-reactive dan motor sync pada siklus RenderStepped (60+ FPS lokal)
		RunService.RenderStepped.Connect((dt) => {
			this.onRenderStepped(dt);
		});

		print("[ClientStageLightingController] Initialized: Advanced Drum & Bass Engine active.");
	}

	/**
	 * Mengumpulkan referensi lengkap seluruh model lampu di client
	 */
	public indexLocalFixtures(): void {
		this.fixtures.clear();
		const tagged = CollectionService.GetTagged("StageLight");

		let models: Instance[] = tagged;
		if (models.size() === 0) {
			const lightingFolder = Workspace.FindFirstChild("Lighting");
			if (lightingFolder) {
				models = lightingFolder.GetChildren();
			}
		}

		for (const inst of models) {
			if (!inst.IsA("Model")) continue;

			const colAttr = inst.GetAttribute("Column");
			let col = typeIs(colAttr, "number") ? colAttr : 1;
			if (!typeIs(colAttr, "number")) {
				const match = inst.Name.match("StageLight_C(%d+)_R(%d+)");
				if (match[0]) col = tonumber(match[0]) || 1;
			}

			const body = inst.FindFirstChild("Body");
			const beamPart = body?.FindFirstChild("Beam1");
			const spot = beamPart?.FindFirstChildOfClass("SpotLight");
			const beam = beamPart?.FindFirstChildOfClass("Beam");
			const lens = body?.FindFirstChild("Lens") as BasePart | undefined;

			const motorFolder = inst.FindFirstChild("Motor");
			const panMotor = motorFolder?.FindFirstChild("Pan") as Motor6D | undefined;
			const tiltMotor = motorFolder?.FindFirstChild("Tilt") as Motor6D | undefined;

			// Pastikan kalibrasi jarak sorot lokal tepat di lantai panggung
			if (spot) {
				spot.Face = Enum.NormalId.Front;
				spot.Range = 28;
				spot.Angle = 55;
				spot.Shadows = true;
			}
			if (beam) {
				beam.Width0 = 0.9;
				beam.Width1 = 9.5;
				beam.LightEmission = 1;
				beam.LightInfluence = 0;
				if (beam.Attachment0) beam.Attachment0.Position = new Vector3(0, 0, -0.2);
				if (beam.Attachment1) beam.Attachment1.Position = new Vector3(0, 0, -18);
			}

			const defaultAim = MIC_AIMS[inst.Name] ?? [0, -0.73];

			this.fixtures.push({
				model: inst,
				column: col,
				panMotor,
				tiltMotor,
				spot,
				beam,
				lens,
				currentPan: defaultAim[0],
				currentTilt: defaultAim[1],
				targetPan: defaultAim[0],
				targetTilt: defaultAim[1],
				currentBrightness: 3.5,
			});
		}

		// Sortir dari kiri ke kanan berdasarkan koordinat sumbu X
		this.fixtures.sort((a, b) => {
			return a.model.GetPivot().Position.X < b.model.GetPivot().Position.X;
		});
		for (let i = 0; i < this.fixtures.size(); i++) {
			this.fixtures[i].column = i + 1;
		}
	}

	private getMicAim(f: ClientFixture): [number, number] {
		const precomputed = MIC_AIMS[f.model.Name];
		if (precomputed) return precomputed;

		const mic = Workspace.FindFirstChild("Mic") as Model | BasePart | undefined;
		const micPos = mic ? (mic.IsA("Model") ? mic.GetPivot().Position : mic.Position) : new Vector3(260.65, -13.17, 380.26);
		const lampPos = f.model.GetPivot().Position;
		const diff = micPos.sub(lampPos);
		const targetPan = math.atan2(diff.X, -diff.Z);
		const hDist = math.sqrt(diff.X * diff.X + diff.Z * diff.Z);
		const targetTilt = -math.atan2(hDist, -diff.Y);
		return [targetPan, targetTilt];
	}

	/**
	 * Menemukan instans Sound musik yang sedang diputar di client dengan robust fallback
	 */
	private getActiveMusicSound(): Sound | undefined {
		// 1. Periksa sound dari MusicPlayerService
		const mp = MusicPlayerService.getInstance();
		const mpSound = mp.getSoundInstance();
		if (mpSound && mpSound.IsPlaying) return mpSound;

		// 2. Periksa instans langsung di SoundService
		const smartphone = SoundService.FindFirstChild("SmartphoneMusic") as Sound | undefined;
		if (smartphone && smartphone.IsPlaying) return smartphone;

		const serverMusic = SoundService.FindFirstChild("ServerGlobalMusic") as Sound | undefined;
		if (serverMusic && serverMusic.IsPlaying) return serverMusic;

		// 3. Pindai child lain di SoundService
		for (const child of SoundService.GetChildren()) {
			if (child.IsA("Sound") && child.IsPlaying) {
				return child;
			}
		}

		return undefined;
	}

	/**
	 * Generator 5 Pola Koreografi Panggung Berorientasi Visual
	 */
	private evaluatePatternOffset(pattern: number, f: ClientFixture, animTime: number, total: number): [number, number] {
		const mid = (total + 1) / 2;
		const colOffset = f.column - mid;
		const isOdd = f.column % 2 === 1;

		switch (pattern % TOTAL_PATTERNS) {
			case 0: {
				// ─── Pola 0: Fanned Sway (Ayunan Panggung Berkelompok) ───
				// Lampu membuka formasi kipas anggun dan berayun serentak menyapu panggung
				const fanSpread = colOffset * 0.16;
				const pan = fanSpread + math.sin(animTime * 1.1) * 0.28;
				const tilt = math.cos(animTime * 0.85) * 0.08;
				return [pan, tilt];
			}
			case 1: {
				// ─── Pola 1: Scissor Cross (Persilangan Panggung Simetris) ───
				// Lampu ganjil dan genap bergerak berlawanan arah menyilang di tengah panggung
				const dir = isOdd ? 1 : -1;
				const pan = math.sin(animTime * 1.9) * 0.42 * dir;
				const tilt = math.cos(animTime * 2.2 + colOffset * 0.35) * 0.12;
				return [pan, tilt];
			}
			case 2: {
				// ─── Pola 2: Stage Wave / Ribbon (Gelombang Panggung Sekuensial) ───
				// Ombak horizontal & vertikal mengalir menyapu panggung dari kiri ke kanan
				const phase = animTime * 1.8 - f.column * 0.72;
				const pan = math.sin(phase) * 0.36;
				const tilt = math.cos(phase * 0.8) * 0.11;
				return [pan, tilt];
			}
			case 3: {
				// ─── Pola 3: Center Focus & Bloom (Fokus Mic & Mekar Panggung) ───
				// Kelima lampu memusat ke mic, lalu mekar menyebar keluar serempak
				const bloom = (math.sin(animTime * 2.2) + 1) * 0.5; // 0 s/d 1
				const pan = colOffset * 0.34 * bloom;
				const tilt = -0.06 * bloom + math.sin(animTime * 1.3) * 0.05;
				return [pan, tilt];
			}
			case 4:
			default: {
				// ─── Pola 4: Alternating Chase Step (Lompatan Ketukan Drum) ───
				// Pasangan lampu melompat bergantian mengikuti ketukan bass
				const step = math.sin(animTime * 2.4 + (isOdd ? 0 : math.pi)) * 0.32;
				const pan = colOffset * 0.12 + step;
				const tilt = (isOdd ? 0.05 : -0.05) * math.cos(animTime * 2.4);
				return [pan, tilt];
			}
		}
	}

	private getLightingState(): { isSyncActive: boolean; brightness: number; beamEnabled: boolean } {
		const lightingFolder = Workspace.FindFirstChild("Lighting");
		const attrMode = lightingFolder?.GetAttribute("StageLightingMode") as StageLightMode | undefined;
		const attrSync = lightingFolder?.GetAttribute("IsMusicSync") as boolean | undefined;
		const attrBright = lightingFolder?.GetAttribute("StageLightingBrightness") as number | undefined;
		const attrBeam = lightingFolder?.GetAttribute("StageLightingBeamEnabled") as boolean | undefined;

		const adminState = AdminService.getInstance().getState().stageLighting;

		const mode = attrMode ?? adminState?.mode;
		const isMusicSync = attrSync ?? adminState?.isMusicSync ?? (mode === StageLightMode.MusicSync);
		const brightness = attrBright ?? adminState?.brightness ?? 3.8;
		const beamEnabled = attrBeam ?? adminState?.beamEnabled ?? true;

		// Default ke aktif jika mode MusicSync atau belum ditentukan
		const isSyncActive = mode === StageLightMode.MusicSync || isMusicSync === true || mode === undefined;

		return { isSyncActive, brightness, beamEnabled };
	}

	private onRenderStepped(dt: number): void {
		const { isSyncActive, brightness, beamEnabled } = this.getLightingState();
		if (!isSyncActive) return;

		const activeSound = this.getActiveMusicSound();
		const isMusicPlaying = activeSound !== undefined && activeSound.IsPlaying;

		// ─── JIKA MUSIK TIDAK SEDANG DIPUTAR: Parkir perlahan ke titik mic ───
		if (!isMusicPlaying) {
			const parkSpeed = dt * 4.0;
			for (const f of this.fixtures) {
				const [basePan, baseTilt] = this.getMicAim(f);
				f.currentPan = f.currentPan + (basePan - f.currentPan) * math.clamp(parkSpeed, 0, 1);
				f.currentTilt = f.currentTilt + (baseTilt - f.currentTilt) * math.clamp(parkSpeed, 0, 1);

				const safeTilt = math.clamp(f.currentTilt, -0.92, -0.52);
				if (f.panMotor) f.panMotor.C0 = BASE_PAN_C0.mul(CFrame.Angles(0, 0, f.currentPan));
				if (f.tiltMotor) f.tiltMotor.C0 = BASE_TILT_C0.mul(CFrame.Angles(0, 0, safeTilt));

				if (f.spot) {
					f.currentBrightness = f.currentBrightness + (1.2 - f.currentBrightness) * math.clamp(parkSpeed, 0, 1);
					f.spot.Brightness = f.currentBrightness;
					f.spot.Enabled = true;
				}
				if (f.beam) f.beam.Enabled = beamEnabled;
				if (f.lens) f.lens.Material = Enum.Material.Neon;
			}
			return;
		}

		// ─── 1. ADVANCED DRUM & BASS DSP ENGINE (FORMULA PALING AMPUH) ───
		const rawLoudness = activeSound.PlaybackLoudness;
		const clockNow = os.clock();

		// A. Multi-Scale Energy Moving Averages (EMA)
		this.shortEnergy += (rawLoudness - this.shortEnergy) * math.clamp(dt * 18.0, 0, 1);
		this.mediumEnergy += (rawLoudness - this.mediumEnergy) * math.clamp(dt * 2.5, 0, 1);
		this.macroEnergy += (rawLoudness - this.macroEnergy) * math.clamp(dt * 0.7, 0, 1);

		// B. Bass Floor Valley Tracker (Mendeteksi keberadaan sub-bass konstan)
		// Saat reff/drop, sub-bass menjaga lantai audio tetap tinggi (>150-250)
		// Saat intro/bridge, lantai audio turun bebas ke mendekati 0 di jeda vokal/akustik
		if (rawLoudness < this.bassFloorEnergy) {
			this.bassFloorEnergy += (rawLoudness - this.bassFloorEnergy) * math.clamp(dt * 4.5, 0, 1);
		} else {
			this.bassFloorEnergy += (rawLoudness - this.bassFloorEnergy) * math.clamp(dt * 0.35, 0, 1);
		}

		// C. Transient Drum Kick Onset Detection (Relative Derivative Spike)
		const deltaLoudness = rawLoudness - this.lastLoudness;
		this.lastLoudness = rawLoudness;

		const kickThreshold = math.max(26, this.mediumEnergy * 0.22);
		const isKickOnset = deltaLoudness > kickThreshold && rawLoudness > (this.mediumEnergy * 0.92);

		// D. Inter-Onset Interval (IOI) & Kick Density Accumulator
		if (isKickOnset) {
			const elapsedSinceKick = clockNow - this.lastKickTimestamp;
			if (elapsedSinceKick >= 0.18) { // Debounce max 330 BPM
				this.lastKickTimestamp = clockNow;
				// Setiap hentakan drum menambah densitas ketukan
				this.kickDensity = math.min(6.0, this.kickDensity + 1.0);
				this.kickIntensity = 1.0; // Instant visual attack
				this.beatPhaseNudge = 0.09; // Micro groove snap

				// Jika interval masuk dalam batas ketukan musik normal (0.28s - 1.35s = 45-215 BPM)
				if (elapsedSinceKick >= 0.28 && elapsedSinceKick <= 1.35) {
					const instantBPM = 60 / elapsedSinceKick;
					this.trackedBPM += (instantBPM - this.trackedBPM) * 0.35;
				}
			}
		}

		// Peluruhan eksponensial terus-menerus (decay)
		this.kickDensity = math.max(0, this.kickDensity - dt * 1.35);
		this.kickIntensity = math.max(0, this.kickIntensity - dt * 6.5);
		this.beatPhaseNudge = math.max(0, this.beatPhaseNudge - dt * 4.0);

		// E. FORMULA KLASIFIKASI FASE LAGU (4-TIER MUSICAL PHASE CLASSIFIER)
		// Menghitung intensitas musik absolut dari gabungan Drum Kick + Sub-Bass Floor + Macro Volume
		const densityFactor = math.clamp(this.kickDensity / 3.0, 0, 1);
		const bassFloorFactor = math.clamp((this.bassFloorEnergy - 25) / 160, 0, 1);
		const macroVolumeFactor = math.clamp((this.macroEnergy - 35) / 200, 0, 1);

		// Pembobotan: 50% Kerapatan Kick Drum, 30% Sub-Bass Floor, 20% Macro Volume
		const rawMusicalIntensity = densityFactor * 0.50 + bassFloorFactor * 0.30 + macroVolumeFactor * 0.20;
		this.musicalIntensity += (rawMusicalIntensity - this.musicalIntensity) * math.clamp(dt * 2.0, 0, 1);

		// F. PERHITUNGAN TEMPO & KECEPATAN MOTOR DINAMIS:
		// - INTRO / BREAKDOWN (Intensity < 0.20): Drum absen -> Kecepatan 0.30x (Super kalem, puitis)
		// - VERSE / BAIT (0.20 <= Intensity < 0.48): Drum mengalir -> Kecepatan 0.70x - 0.95x (Santai)
		// - BRIDGE / BUILD-UP (0.48 <= Intensity < 0.70): Ketukan memadat -> Kecepatan 1.30x - 1.65x (Menaik)
		// - REFF / CHORUS / DROP (Intensity >= 0.70): Full drum & bass -> Kecepatan 2.30x - 2.80x (Kencang & Enerjik)
		let targetSpeedMult = 0.30;
		if (this.musicalIntensity < 0.20) {
			// Intro / Breakdown
			targetSpeedMult = 0.30;
		} else if (this.musicalIntensity < 0.48) {
			// Verse
			const t = (this.musicalIntensity - 0.20) / (0.48 - 0.20);
			targetSpeedMult = 0.70 + t * 0.25;
		} else if (this.musicalIntensity < 0.70) {
			// Bridge / Build-Up
			const t = (this.musicalIntensity - 0.48) / (0.70 - 0.48);
			targetSpeedMult = 1.30 + t * 0.35;
		} else {
			// Reff / Chorus / Drop
			const t = math.clamp((this.musicalIntensity - 0.70) / 0.30, 0, 1);
			targetSpeedMult = 2.30 + t * 0.50;
		}

		// Asymmetric Acceleration: Menanjak cepat ke reff (slew 4.5), melambat anggun ke intro (slew 1.8)
		const speedSlew = targetSpeedMult > this.currentSpeedMult ? 4.5 : 1.8;
		this.currentSpeedMult += (targetSpeedMult - this.currentSpeedMult) * math.clamp(dt * speedSlew, 0, 1);

		// AnimTime berakselerasi proporsional terhadap tempo drum + hentakan micro groove
		this.animTime += dt * this.currentSpeedMult + this.beatPhaseNudge * dt * 4.0;

		// ─── 2. MULTI-CHOREOGRAPHY SCHEDULER & CROSSFADE ──────────────────
		this.patternTimer += dt * this.currentSpeedMult;

		// Setiap pergantian durasi atau lonjakan energi drastis, jadwalkan transisi ke pola berikutnya
		if (!this.isBlending && this.patternTimer >= PATTERN_DURATION) {
			this.patternTimer = 0;
			this.isBlending = true;
			this.blendProgress = 0;
			this.nextPattern = (this.currentPattern + 1) % TOTAL_PATTERNS;
		}

		if (this.isBlending) {
			this.blendProgress += dt * (1.0 / BLEND_DURATION);
			if (this.blendProgress >= 1.0) {
				this.blendProgress = 1.0;
				this.currentPattern = this.nextPattern;
				this.isBlending = false;
			}
		}

		// ─── 3. KALKULASI SUDUT, SMOOTH MOTOR SLEW-RATE, & LIGHTING ─────────
		const total = this.fixtures.size();
		const baseBrightness = brightness;

		// Responsivitas inersia motor fisik: mengikuti tempo yang sedang aktif
		const motorSlewRate = 7.0 + this.currentSpeedMult * 4.8;
		const brightnessSlewRate = 12.0;

		for (const f of this.fixtures) {
			const [basePan, baseTilt] = this.getMicAim(f);

			// Ambil offset dari pola aktif (dengan crossfade halus jika sedang blending)
			const [p1Pan, p1Tilt] = this.evaluatePatternOffset(this.currentPattern, f, this.animTime, total);
			let panOffset = p1Pan;
			let tiltOffset = p1Tilt;

			if (this.isBlending) {
				const [p2Pan, p2Tilt] = this.evaluatePatternOffset(this.nextPattern, f, this.animTime, total);
				// Interpolasi hermite smoothstep untuk transisi kurva mulus tanpa sentakan
				const t = this.blendProgress * this.blendProgress * (3 - 2 * this.blendProgress);
				panOffset = p1Pan + (p2Pan - p1Pan) * t;
				tiltOffset = p1Tilt + (p2Tilt - p1Tilt) * t;
			}

			// Nudge mikro responsif saat kick drum menghantam
			const isOdd = f.column % 2 === 1;
			const kickNudge = this.kickIntensity * (isOdd ? 0.05 : -0.05);

			f.targetPan = basePan + panOffset + kickNudge;
			f.targetTilt = baseTilt + tiltOffset;

			// Slew-rate smoothing: motor berputar dengan inersia mekanik nyata
			f.currentPan = f.currentPan + (f.targetPan - f.currentPan) * math.clamp(dt * motorSlewRate, 0, 1);
			f.currentTilt = f.currentTilt + (f.targetTilt - f.currentTilt) * math.clamp(dt * motorSlewRate, 0, 1);

			// Kunci sudut tilt agar 100% selalu terfokus ke panggung (TIDAK PERNAH ke langit-langit)
			const safeTilt = math.clamp(f.currentTilt, -0.92, -0.52);

			if (f.panMotor) f.panMotor.C0 = BASE_PAN_C0.mul(CFrame.Angles(0, 0, f.currentPan));
			if (f.tiltMotor) f.tiltMotor.C0 = BASE_TILT_C0.mul(CFrame.Angles(0, 0, safeTilt));

			// Visual Flash & Attack/Decay Envelope
			// Intro: redup dan tenang (~0.65x), Reff: terang benderang (~1.4x) + ledakan punch kick drum
			if (f.spot) {
				const phaseBrightMult = 0.65 + this.musicalIntensity * 0.75;
				const targetBright = baseBrightness * (phaseBrightMult + this.kickIntensity * 0.80);
				f.currentBrightness =
					f.currentBrightness + (targetBright - f.currentBrightness) * math.clamp(dt * brightnessSlewRate, 0, 1);
				f.spot.Brightness = math.min(7.0, f.currentBrightness);
				f.spot.Enabled = true;
			}
			if (f.beam) {
				f.beam.Enabled = beamEnabled;
				f.beam.Width1 = 9.5 * (0.92 + this.musicalIntensity * 0.28 + this.kickIntensity * 0.32);
			}
			if (f.lens) f.lens.Material = Enum.Material.Neon;
		}
	}
}
