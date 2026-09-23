import { CollectionService, RunService, SoundService, Workspace } from "@rbxts/services";
import { AdminService } from "client/services/AdminService";
import { MusicPlayerService } from "client/services/MusicPlayerService";
import { StageLightMode } from "shared/types";

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

/**
 * KONSTANTA TIMING & SINKRONISASI AUDIO (NON-NEGOTIABLE)
 * Kompensasi latensi hardware output audio perangkat (~40ms - 150ms).
 * Sound.TimePosition adalah decode time, bukan output time fisik speaker.
 */
const AUDIO_OUTPUT_LATENCY_SEC = 0.08; // detik (80 ms)

const MIC_AIMS: Record<string, [number, number]> = {
	StageLight_C1_R01: [0.75, -0.836],
	StageLight_C1_R02: [0.466, -0.738],
	StageLight_C1_R03: [0.014, -0.682],
	StageLight_C1_R04: [-0.456, -0.732],
	StageLight_C1_R05: [-0.802, -0.86],
};

const TOTAL_PATTERNS = 5;

/**
 * ClientStageLightingController
 * Pengontrol visual dan motor lighting panggung real-time berlatensi 0ms pada client:
 * 1. Phase-Locked Musical Engine: Mengunci siklus motor dan shutter strobo tepat ke sound.TimePosition & track.bpm.
 * 2. Self-Healing Fixture Indexer: Anti-race condition yang mendeteksi model lampu meski baru selesai di-stream/di-clone.
 * 3. Sub-Beat Shutter Strobe: Shutter strobo 1/16th dan 1/8th note dengan blackout cut tajam saat tempo cepat & drop.
 * 4. Harmonic Musical Choreography: Pola panggung bergerak harmonis dalam birama 4/4 (1 bar, 2 bars, 4 bars).
 * 5. Physical Motor Slew-Rate Smoothing: Inersia mekanik nyata tanpa jitter.
 */
export class ClientStageLightingController {
	private static instance?: ClientStageLightingController;

	private isInitialized = false;
	private fixtures: ClientFixture[] = [];

	private currentActiveMode: StageLightMode = StageLightMode.MusicSync;
	private previousActiveMode: StageLightMode = StageLightMode.MusicSync;
	private modeTransitionStartTime: number = 0;
	private readonly MODE_CROSSFADE_DURATION: number = 1.8;

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



		// Dengarkan jika ada fixture StageLight baru yang di-stream atau ditambahkan
		CollectionService.GetInstanceAddedSignal("StageLight").Connect(() => {
			this.indexLocalFixtures();
		});
		CollectionService.GetInstanceRemovedSignal("StageLight").Connect(() => {
			this.indexLocalFixtures();
		});
		// SYNC: Re-index saat streaming menyelesaikan child penting (Beam1, SpotLight, Motor6D)
		Workspace.DescendantAdded.Connect((desc) => {
			if (desc.Name === "Beam1" || desc.IsA("SpotLight") || desc.IsA("Motor6D")) {
				task.defer(() => this.indexLocalFixtures());
			}
		});

		// Update visual audio-reactive dan motor sync pada siklus RenderStepped (60+ FPS lokal)
		RunService.RenderStepped.Connect((dt) => {
			this.onRenderStepped(dt);
		});

		print("[ClientStageLightingController] Initialized: Phase-Locked Musical Beat & Strobe Engine active.");
	}

	/**
	 * Mengumpulkan referensi lengkap seluruh model lampu di client dengan self-healing
	 */
	public indexLocalFixtures(): void {
		const tagged = CollectionService.GetTagged("StageLight");

		let models: Instance[] = tagged;
		if (models.size() === 0) {
			const lightingFolder = Workspace.FindFirstChild("Lighting");
			if (lightingFolder) {
				models = lightingFolder.GetChildren();
			}
		}

		if (models.size() === 0) {
			return;
		}

		this.fixtures.clear();

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
		const micPos = mic
			? mic.IsA("Model")
				? mic.GetPivot().Position
				: mic.Position
			: new Vector3(260.65, -13.17, 380.26);
		const lampPos = f.model.GetPivot().Position;
		const diff = micPos.sub(lampPos);
		const targetPan = math.atan2(diff.X, -diff.Z);
		const hDist = math.sqrt(diff.X * diff.X + diff.Z * diff.Z);
		const targetTilt = -math.atan2(hDist, -diff.Y);
		return [targetPan, targetTilt];
	}

	/**
	 * Menemukan instans Sound musik yang sedang diputar di client
	 */
	private getActiveMusicSound(): Sound | undefined {
		const mp = MusicPlayerService.getInstance();
		const mpSound = mp.getSoundInstance();
		if (mpSound && mpSound.IsPlaying) return mpSound;

		let bestSound: Sound | undefined;
		let maxLoudness = -1;

		for (const child of SoundService.GetChildren()) {
			if (child.IsA("Sound") && child.IsPlaying) {
				const loudness = child.PlaybackLoudness;
				if (loudness > maxLoudness) {
					maxLoudness = loudness;
					bestSound = child;
				}
			}
		}

		if (bestSound) return bestSound;

		const serverMusic = SoundService.FindFirstChild("ServerGlobalMusic") as Sound | undefined;
		if (serverMusic && serverMusic.IsPlaying) return serverMusic;

		return undefined;
	}

	/**
	 * Generator 5 Pola Koreografi Panggung yang Terkunci pada Birama Musik 4/4
	 */
	private evaluateMusicalPattern(
		pattern: number,
		f: ClientFixture,
		barPhase: number,
		totalBeats: number,
		totalFixtures: number,
	): [number, number] {
		const mid = (totalFixtures + 1) / 2;
		const colOffset = f.column - mid;
		const isOdd = f.column % 2 === 1;
		const twoPiBar = barPhase * math.pi * 2;

		switch (pattern % TOTAL_PATTERNS) {
			case 0: {
				// ─── Pola 0: Fanned Sway (Ayunan Birama Harmonis) ───
				// 1 ayunan penuh per 1 birama musik (4 beat)
				const fanSpread = colOffset * 0.16;
				const pan = fanSpread + math.sin(twoPiBar) * 0.32;
				const tilt = math.cos(twoPiBar) * 0.08;
				return [pan, tilt];
			}
			case 1: {
				// ─── Pola 1: Scissor Cross (Persilangan Cepat Simetris) ───
				// 2 persilangan per birama (tiap 2 beat menyilang di tengah)
				const dir = isOdd ? 1 : -1;
				const pan = math.sin(twoPiBar * 2) * 0.44 * dir;
				const tilt = math.cos(twoPiBar + colOffset * 0.35) * 0.12;
				return [pan, tilt];
			}
			case 2: {
				// ─── Pola 2: Stage Wave / Ribbon (Gelombang Birama Mengalir) ───
				// Ombak mengalir dari kiri ke kanan terkunci pada ketukan
				const phase = twoPiBar - f.column * 0.75;
				const pan = math.sin(phase) * 0.38;
				const tilt = math.cos(phase * 0.5) * 0.11;
				return [pan, tilt];
			}
			case 3: {
				// ─── Pola 3: Center Focus & Bloom (Mekar Ketukan Reff) ───
				// Mengembang dan memusat selaras birama 2 bar
				const bloom = (math.sin(twoPiBar * 0.5) + 1) * 0.5; // 0 s/d 1
				const pan = colOffset * 0.35 * bloom;
				const tilt = -0.06 * bloom + math.sin(twoPiBar) * 0.05;
				return [pan, tilt];
			}
			case 4:
			default: {
				// ─── Pola 4: Alternating Chase Step (Lompatan Ketukan Drum) ───
				// Pasangan lampu melompat bergantian tepat pada setiap ketukan quarter note
				const step = math.sin((totalBeats + (isOdd ? 0 : 1)) * math.pi) * 0.32;
				const pan = colOffset * 0.12 + step;
				const tilt = (isOdd ? 0.05 : -0.05) * math.cos(twoPiBar * 2);
				return [pan, tilt];
			}
		}
	}

	/**
	 * Menghitung target offset [Pan, Tilt] untuk mode panggung tertentu
	 */
	private getModeOffset(
		mode: StageLightMode,
		f: ClientFixture,
		leadBarPhase: number,
		leadTotalBeats: number,
		totalFixtures: number,
		currentMusicPatternIdx: number,
		nextMusicPatternIdx: number,
		isMusicCrossfading: boolean,
		smoothMusicCrossfade: number,
	): [number, number] {
		switch (mode) {
			case StageLightMode.SpotlightCenter:
				// Fokus panggung ke mic (tidak ada offset gerak tambahan)
				return [0, 0];

			case StageLightMode.Wave:
				// Pola Wave mengalir
				return this.evaluateMusicalPattern(2, f, leadBarPhase, leadTotalBeats, totalFixtures);

			case StageLightMode.Circle:
				// Pola Orbit / Circle
				return this.evaluateMusicalPattern(0, f, leadBarPhase, leadTotalBeats, totalFixtures);

			case StageLightMode.Ballyhoo:
				// Pola Ballyhoo / Scissor Cross
				return this.evaluateMusicalPattern(1, f, leadBarPhase, leadTotalBeats, totalFixtures);

			case StageLightMode.Off:
				return [0, 0];

			case StageLightMode.MusicSync:
			default: {
				const [p1Pan, p1Tilt] = this.evaluateMusicalPattern(
					currentMusicPatternIdx,
					f,
					leadBarPhase,
					leadTotalBeats,
					totalFixtures,
				);
				if (isMusicCrossfading) {
					const [p2Pan, p2Tilt] = this.evaluateMusicalPattern(
						nextMusicPatternIdx,
						f,
						leadBarPhase,
						leadTotalBeats,
						totalFixtures,
					);
					return [
						p1Pan + (p2Pan - p1Pan) * smoothMusicCrossfade,
						p1Tilt + (p2Tilt - p1Tilt) * smoothMusicCrossfade,
					];
				}
				return [p1Pan, p1Tilt];
			}
		}
	}

	private getLightingState(): {
		isSyncActive: boolean;
		brightness: number;
		beamEnabled: boolean;
		strobeSpeed: number;
		mode: StageLightMode;
	} {
		const lightingFolder = Workspace.FindFirstChild("Lighting");
		const attrMode = lightingFolder?.GetAttribute("StageLightingMode") as StageLightMode | undefined;
		const attrSync = lightingFolder?.GetAttribute("IsMusicSync") as boolean | undefined;
		const attrBright = lightingFolder?.GetAttribute("StageLightingBrightness") as number | undefined;
		const attrBeam = lightingFolder?.GetAttribute("StageLightingBeamEnabled") as boolean | undefined;
		const attrStrobe = lightingFolder?.GetAttribute("StageLightingStrobeSpeed") as number | undefined;

		const adminState = AdminService.getInstance().getState().stageLighting;

		const mode = attrMode ?? adminState?.mode ?? StageLightMode.MusicSync;
		const isMusicSync = attrSync ?? adminState?.isMusicSync ?? mode === StageLightMode.MusicSync;
		const brightness = attrBright ?? adminState?.brightness ?? 3.8;
		const beamEnabled = attrBeam ?? adminState?.beamEnabled ?? true;
		const strobeSpeed = attrStrobe ?? adminState?.strobeSpeed ?? 0;

		const isSyncActive = true;

		return { isSyncActive, brightness, beamEnabled, strobeSpeed, mode };
	}

	private onRenderStepped(dt: number): void {
		const clockNow = os.clock();

		// ─── 0. FIXTURE INDEX CHECK ───
		if (this.fixtures.size() === 0) {
			this.indexLocalFixtures();
			if (this.fixtures.size() === 0) return;
		}

		const { brightness, beamEnabled, strobeSpeed, mode } = this.getLightingState();

		// ─── SMOOTH MODE TRANSITION TRACKER ───
		if (mode !== this.currentActiveMode) {
			this.previousActiveMode = this.currentActiveMode;
			this.currentActiveMode = mode;
			this.modeTransitionStartTime = clockNow;
		}

		const modeTransitionElapsed = clockNow - this.modeTransitionStartTime;
		const modeTransitionT = math.clamp(modeTransitionElapsed / this.MODE_CROSSFADE_DURATION, 0, 1);
		// S-Curve smoothing (Smoothstep)
		const smoothModeBlend = modeTransitionT * modeTransitionT * (3 - 2 * modeTransitionT);

		const activeSound = this.getActiveMusicSound();
		const isMusicPlaying = activeSound !== undefined && activeSound.IsPlaying;

		// ─── JIKA MUSIK TIDAK SEDANG DIPUTAR: Parkir perlahan ke Mic ───
		if (!isMusicPlaying) {
			const parkSpeed = dt * 3.5;
			const isStrobeActive = strobeSpeed > 0;
			let isIdleStrobeOn = true;
			if (isStrobeActive) {
				const idleStrobeHz = strobeSpeed === 1 ? 2.5 : strobeSpeed === 2 ? 5.0 : strobeSpeed === 3 ? 10.0 : 20.0;
				const phase = (clockNow * idleStrobeHz) % 1.0;
				isIdleStrobeOn = phase < 0.35;
			}

			const targetBrightness = this.currentActiveMode === StageLightMode.Off ? 0 : 1.2;

			for (const f of this.fixtures) {
				if (!f.model.Parent) continue;

				// Self-heal reference
				if (f.spot === undefined || !f.spot.IsDescendantOf(game)) {
					const body = f.model.FindFirstChild("Body");
					const beam1 = body?.FindFirstChild("Beam1");
					f.spot = beam1?.FindFirstChildOfClass("SpotLight");
					f.beam = beam1?.FindFirstChildOfClass("Beam");
					f.lens = body?.FindFirstChild("Lens") as BasePart | undefined;
				}
				if (f.panMotor === undefined || !f.panMotor.IsDescendantOf(game)) {
					const mf = f.model.FindFirstChild("Motor");
					f.panMotor = mf?.FindFirstChild("Pan") as Motor6D | undefined;
				}
				if (f.tiltMotor === undefined || !f.tiltMotor.IsDescendantOf(game)) {
					const mf = f.model.FindFirstChild("Motor");
					f.tiltMotor = mf?.FindFirstChild("Tilt") as Motor6D | undefined;
				}

				const [basePan, baseTilt] = this.getMicAim(f);
				f.currentPan = f.currentPan + (basePan - f.currentPan) * math.clamp(parkSpeed, 0, 1);
				f.currentTilt = f.currentTilt + (baseTilt - f.currentTilt) * math.clamp(parkSpeed, 0, 1);

				const safeTilt = math.clamp(f.currentTilt, -0.92, -0.52);
				if (f.panMotor) f.panMotor.C0 = BASE_PAN_C0.mul(CFrame.Angles(0, 0, f.currentPan));
				if (f.tiltMotor) f.tiltMotor.C0 = BASE_TILT_C0.mul(CFrame.Angles(0, 0, safeTilt));

				if (f.spot) {
					f.currentBrightness =
						f.currentBrightness + (targetBrightness - f.currentBrightness) * math.clamp(parkSpeed, 0, 1);

					let spotB = f.currentBrightness;
					let spotBeam = beamEnabled && this.currentActiveMode !== StageLightMode.Off;

					if (isStrobeActive) {
						if (isIdleStrobeOn) {
							spotB = math.max(0.5, spotB * 1.35);
						} else {
							spotB = 0;
							spotBeam = false;
						}
					}

					f.spot.Brightness = spotB;
					f.spot.Enabled = spotB > 0.05;
					if (f.beam) f.beam.Enabled = spotBeam;
					if (f.lens) {
						f.lens.Material = (spotB > 0.05 && spotBeam) ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
					}
				}
			}
			return;
		}

		// ─── 1. PHASE-LOCKED MUSICAL BEAT ENGINE (LATENCY & OFFSET COMPENSATED) ───
		const musicService = MusicPlayerService.getInstance();
		const currentTrack = musicService.getCurrentTrack();
		const baseBpm = currentTrack?.bpm ?? 128;
		const playbackSpeed = activeSound ? activeSound.PlaybackSpeed : 1.0;
		const effectiveBpm = math.clamp(baseBpm * playbackSpeed, 40, 260);

		const beatDuration = 60 / baseBpm;
		const barDuration = beatDuration * 4; // Birama 4/4 standar

		const rawSongTime = activeSound ? activeSound.TimePosition : clockNow;
		const trackOffset = currentTrack?.beatOffset ?? currentTrack?.firstBeatOffset ?? 0;
		const totalOffset = AUDIO_OUTPUT_LATENCY_SEC + trackOffset;
		const isBeforeFirstBeat = activeSound !== undefined && rawSongTime < totalOffset;
		const songTime = isBeforeFirstBeat ? 0 : math.max(0, rawSongTime - totalOffset);

		const totalBeats = isBeforeFirstBeat ? 0 : songTime / beatDuration;
		const beatPhase = isBeforeFirstBeat ? 0 : (songTime % beatDuration) / beatDuration;
		const barPhase = isBeforeFirstBeat ? 0 : (songTime % barDuration) / barDuration;

		// ─── 2. MOTOR SLEW RATE & LEAD PREDICTION / COMPENSATED TIMING ───
		const motorSlewRate = 8.0 + (effectiveBpm / 60) * 4.0;
		const motorLeadTime = 1 / motorSlewRate;
		const leadAdjustedTime = isBeforeFirstBeat ? 0 : songTime + motorLeadTime;
		const leadBarPhase = isBeforeFirstBeat ? 0 : (leadAdjustedTime % barDuration) / barDuration;
		const leadTotalBeats = isBeforeFirstBeat ? 0 : leadAdjustedTime / beatDuration;

		// ─── 3. MULTI-CHOREOGRAPHY SELECTION & INTERPOLATION ───
		const barsPerPattern = 8;
		const totalBars = leadAdjustedTime / barDuration;
		const barInCycle = totalBars % barsPerPattern;
		const currentPatternIdx = math.floor(totalBars / barsPerPattern) % TOTAL_PATTERNS;
		const nextPatternIdx = (currentPatternIdx + 1) % TOTAL_PATTERNS;

		const isCrossfading = barInCycle >= barsPerPattern - 1;
		const crossfadeT = isCrossfading ? barInCycle - (barsPerPattern - 1) : 0;
		const smoothCrossfade = crossfadeT * crossfadeT * (3 - 2 * crossfadeT);

		// ─── 4. OPTICAL SHUTTER STROBE TIMING ───
		let isStrobeFlash = true;
		if (strobeSpeed > 0) {
			const subDiv = strobeSpeed === 1 ? 1 : strobeSpeed === 2 ? 0.5 : strobeSpeed === 3 ? 0.25 : 0.125;
			const subPhase = (songTime / (beatDuration * subDiv)) % 1.0;
			isStrobeFlash = subPhase < 0.35; // 35% ON flash, 65% OFF
		}

		// Interpolasikan brightness jika transisi dari/ke mode Off
		const baseBrightness = brightness;
		const prevModeBrightness = this.previousActiveMode === StageLightMode.Off ? 0 : baseBrightness;
		const currModeBrightness = this.currentActiveMode === StageLightMode.Off ? 0 : baseBrightness;
		const modeBlendedBrightness = prevModeBrightness + (currModeBrightness - prevModeBrightness) * smoothModeBlend;

		let finalBrightness = modeBlendedBrightness;
		let finalBeam = beamEnabled && this.currentActiveMode !== StageLightMode.Off;

		if (strobeSpeed > 0) {
			if (isStrobeFlash) {
				finalBrightness = math.max(0.5, modeBlendedBrightness * 1.35);
				finalBeam = beamEnabled;
			} else {
				finalBrightness = 0;
				finalBeam = false;
			}
		}

		// ─── 5. PHYSICAL MOTOR SLEW & LIGHTING UPDATE ───
		const total = this.fixtures.size();

		for (const f of this.fixtures) {
			if (!f.model.Parent) continue;

			// Per-fixture self-heal
			if (f.spot === undefined || !f.spot.IsDescendantOf(game)) {
				const body = f.model.FindFirstChild("Body");
				const beam1 = body?.FindFirstChild("Beam1");
				f.spot = beam1?.FindFirstChildOfClass("SpotLight");
				f.beam = beam1?.FindFirstChildOfClass("Beam");
				f.lens = body?.FindFirstChild("Lens") as BasePart | undefined;

				if (f.spot) {
					f.spot.Face = Enum.NormalId.Front;
					f.spot.Range = 28;
					f.spot.Angle = 55;
					f.spot.Shadows = true;
				}
				if (f.beam) {
					f.beam.Width0 = 0.9;
					f.beam.Width1 = 9.5;
					f.beam.LightEmission = 1;
					f.beam.LightInfluence = 0;
					if (f.beam.Attachment0) f.beam.Attachment0.Position = new Vector3(0, 0, -0.2);
					if (f.beam.Attachment1) f.beam.Attachment1.Position = new Vector3(0, 0, -18);
				}
			}

			if (f.panMotor === undefined || !f.panMotor.IsDescendantOf(game)) {
				const mf = f.model.FindFirstChild("Motor");
				f.panMotor = mf?.FindFirstChild("Pan") as Motor6D | undefined;
			}
			if (f.tiltMotor === undefined || !f.tiltMotor.IsDescendantOf(game)) {
				const mf = f.model.FindFirstChild("Motor");
				f.tiltMotor = mf?.FindFirstChild("Tilt") as Motor6D | undefined;
			}

			const [basePan, baseTilt] = this.getMicAim(f);

			// Evaluasi offset mode sebelumnya dan mode saat ini
			const [prevPan, prevTilt] = this.getModeOffset(
				this.previousActiveMode,
				f,
				leadBarPhase,
				leadTotalBeats,
				total,
				currentPatternIdx,
				nextPatternIdx,
				isCrossfading,
				smoothCrossfade,
			);
			const [currPan, currTilt] = this.getModeOffset(
				this.currentActiveMode,
				f,
				leadBarPhase,
				leadTotalBeats,
				total,
				currentPatternIdx,
				nextPatternIdx,
				isCrossfading,
				smoothCrossfade,
			);

			// Transisi halus antar mode (smooth crossfade)
			const targetOffsetPan = prevPan + (currPan - prevPan) * smoothModeBlend;
			const targetOffsetTilt = prevTilt + (currTilt - prevTilt) * smoothModeBlend;

			f.targetPan = basePan + targetOffsetPan;
			f.targetTilt = baseTilt + targetOffsetTilt;

			// Slew motor yang stabil dan mulus tanpa patah
			const effectiveSlew = math.clamp(motorSlewRate * (0.6 + 0.4 * smoothModeBlend), 4, 14);
			f.currentPan = f.currentPan + (f.targetPan - f.currentPan) * math.clamp(dt * effectiveSlew, 0, 1);
			f.currentTilt = f.currentTilt + (f.targetTilt - f.currentTilt) * math.clamp(dt * effectiveSlew, 0, 1);

			const safeTilt = math.clamp(f.currentTilt, -0.92, -0.52);

			if (f.panMotor) f.panMotor.C0 = BASE_PAN_C0.mul(CFrame.Angles(0, 0, f.currentPan));
			if (f.tiltMotor) f.tiltMotor.C0 = BASE_TILT_C0.mul(CFrame.Angles(0, 0, safeTilt));

			if (f.spot) {
				f.currentBrightness = finalBrightness;
				f.spot.Brightness = finalBrightness;
				f.spot.Enabled = finalBrightness > 0.05;
				if (f.beam) {
					f.beam.Enabled = finalBeam;
					f.beam.Width1 = 9.5;
				}
				if (f.lens) {
					f.lens.Material = (finalBrightness > 0.05 && finalBeam) ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
				}
			}
		}
	}
}
