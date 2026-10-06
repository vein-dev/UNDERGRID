import { CollectionService, RunService, SoundService, Workspace } from "@rbxts/services";
import { AdminService } from "client/services/AdminService";
import { DjMusicPlayerService } from "client/services/DjMusicPlayerService";
import { MusicPlayerService } from "client/services/MusicPlayerService";
import { StageLightMode, StageLightingControlPayload, TrackData } from "shared/types";

interface ClientFixture {
	model: Model;
	column: number;
	row: number;
	isDj: boolean;
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
 * KONSTANTA TIMING & SINKRONISASI AUDIO
 * Kompensasi latensi hardware output audio perangkat (~80ms).
 */
const AUDIO_OUTPUT_LATENCY_SEC = 0.08;

const MIC_AIMS: Record<string, [number, number]> = {
	StageLight_C1_R01: [0.75, -0.836],
	StageLight_C1_R02: [0.466, -0.738],
	StageLight_C1_R03: [0.014, -0.682],
	StageLight_C1_R04: [-0.456, -0.732],
	StageLight_C1_R05: [-0.802, -0.86],
};

/**
 * Sudut presisi hasil kalibrasi matematis ke game.Workspace.FocusDJLighting (DJ Stage)
 * Menatap ke bawah secara kinematik (Dot = 1.00000)
 */
const DJ_AIMS: Record<string, [number, number]> = {
	StageLight_C1_R06: [0.810, -1.251],
	StageLight_C1_R07: [0.477, -1.135],
	StageLight_C1_R08: [0.000, -1.077],
	StageLight_C1_R09: [-0.458, -1.112],
	StageLight_C1_R10: [-0.822, -1.201],
};


/**
 * ClientStageLightingController
 * Pengontrol visual dan motor lighting panggung real-time berlatensi 0ms pada client:
 * 1. Mendukung kontrol terpisah dan independen untuk Main Stage (R01-R05) dan DJ Stage (R06-R10).
 * 2. Phase-Locked Musical Engine: Mengunci siklus motor dan shutter strobo tepat ke sound.TimePosition & track.bpm.
 * 3. Focus Lock: Mengunci lampu DJ tepat ke game.Workspace.FocusDJLighting tanpa tertahan batas tilt.
 */
export class ClientStageLightingController {
	private static instance?: ClientStageLightingController;

	private isInitialized = false;
	private mainFixtures: ClientFixture[] = [];
	private djFixtures: ClientFixture[] = [];

	// Main Stage state tracking
	private mainCurrentActiveMode: StageLightMode = StageLightMode.Off;
	private mainPreviousActiveMode: StageLightMode = StageLightMode.Off;
	private mainModeTransitionStartTime = 0;

	// DJ Stage state tracking
	private djCurrentActiveMode: StageLightMode = StageLightMode.Off;
	private djPreviousActiveMode: StageLightMode = StageLightMode.Off;
	private djModeTransitionStartTime = 0;

	private readonly MODE_CROSSFADE_DURATION = 1.8;

	// Smart pick koreografi MusicSync
	private smoothedLoudness = 150;
	private readonly smartPickCache = new Map<number, StageLightMode>();

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
		// Re-index saat streaming menyelesaikan child penting (Beam1, SpotLight, Motor6D)
		Workspace.DescendantAdded.Connect((desc) => {
			if (desc.Name === "Beam1" || desc.IsA("SpotLight") || desc.IsA("Motor6D")) {
				task.defer(() => this.indexLocalFixtures());
			}
		});

		// Update visual audio-reactive dan motor sync pada siklus RenderStepped (60+ FPS lokal)
		RunService.RenderStepped.Connect((dt) => {
			this.onRenderStepped(dt);
		});

		print(
			`[ClientStageLightingController] Initialized: ${this.mainFixtures.size()} Main fixtures, ${this.djFixtures.size()} DJ fixtures.`,
		);
	}

	/**
	 * Mengumpulkan referensi lengkap seluruh model lampu di client dengan self-healing
	 * Memisahkan secara tegas antara Main Stage (R01-R05) dan DJ Stage (R06-R10)
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

		this.mainFixtures.clear();
		this.djFixtures.clear();

		for (const inst of models) {
			if (!inst.IsA("Model")) continue;

			let col = 1;
			let row = 1;
			const [colStr, rowStr] = inst.Name.match("StageLight_C(%d+)_R(%d+)");
			if (colStr !== undefined && rowStr !== undefined) {
				col = tonumber(colStr) || 1;
				row = tonumber(rowStr) || 1;
			} else {
				const colAttr = inst.GetAttribute("Column");
				const rowAttr = inst.GetAttribute("Row");
				if (typeIs(colAttr, "number")) col = colAttr;
				if (typeIs(rowAttr, "number")) row = rowAttr;
			}

			const isDj = row >= 6;

			const body = inst.FindFirstChild("Body");
			const beamPart = body?.FindFirstChild("Beam1");
			const spot = beamPart?.FindFirstChildOfClass("SpotLight");
			const beam = beamPart?.FindFirstChildOfClass("Beam");
			const lens = body?.FindFirstChild("Lens") as BasePart | undefined;

			const motorFolder = inst.FindFirstChild("Motor");
			const panMotor = motorFolder?.FindFirstChild("Pan") as Motor6D | undefined;
			const tiltMotor = motorFolder?.FindFirstChild("Tilt") as Motor6D | undefined;

			if (spot) {
				spot.Face = Enum.NormalId.Front;
				spot.Range = isDj ? 65 : 60;
				spot.Angle = 85;
				spot.Shadows = true;
			}
			if (beam) {
				beam.Width0 = 1.2;
				beam.Width1 = isDj ? 18 : 20;
				beam.LightEmission = 1;
				beam.LightInfluence = 0;
				if (beam.Attachment0) beam.Attachment0.Position = new Vector3(0, 0, -0.2);
				if (beam.Attachment1) beam.Attachment1.Position = new Vector3(0, 0, -42);
			}

			const defaultAim = isDj
				? (DJ_AIMS[inst.Name] ?? [0, -1.1])
				: (MIC_AIMS[inst.Name] ?? [0, -0.73]);

			const fixtureData: ClientFixture = {
				model: inst,
				column: col,
				row,
				isDj,
				panMotor,
				tiltMotor,
				spot,
				beam,
				lens,
				currentPan: defaultAim[0],
				currentTilt: defaultAim[1],
				targetPan: defaultAim[0],
				targetTilt: defaultAim[1],
				currentBrightness: isDj ? 3.5 : 4.5,
			};

			if (isDj) {
				this.djFixtures.push(fixtureData);
			} else {
				this.mainFixtures.push(fixtureData);
			}
		}

		// Sortir Main Stage Fixtures dari kiri ke kanan (sumbu X)
		this.mainFixtures.sort((a, b) => {
			return a.model.GetPivot().Position.X < b.model.GetPivot().Position.X;
		});
		for (let i = 0; i < this.mainFixtures.size(); i++) {
			this.mainFixtures[i].column = i + 1;
		}

		// Sortir DJ Stage Fixtures sepanjang truss (sumbu Z)
		this.djFixtures.sort((a, b) => {
			return a.model.GetPivot().Position.Z < b.model.GetPivot().Position.Z;
		});
		for (let i = 0; i < this.djFixtures.size(); i++) {
			this.djFixtures[i].column = i + 1;
		}
	}

	/**
	 * Mendapatkan sudut bidik acuan untuk fixture
	 */
	private getFixtureAim(f: ClientFixture): [number, number] {
		if (f.isDj) {
			const precomputed = DJ_AIMS[f.model.Name];
			if (precomputed) return precomputed;

			const focus = Workspace.FindFirstChild("FocusDJLighting") as Model | BasePart | undefined;
			if (focus) {
				const focusPos = focus.IsA("Model") ? focus.GetPivot().Position : focus.Position;
				const lampPos = f.model.GetPivot().Position;
				const diff = focusPos.sub(lampPos);
				const targetPan = math.atan2(-diff.Z, diff.X);
				const hDist = math.sqrt(diff.X * diff.X + diff.Z * diff.Z);
				const targetTilt = -math.atan2(hDist, -diff.Y);
				return [targetPan, targetTilt];
			}
			return [0, -1.1];
		} else {
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
	}

	/**
	 * Menemukan instans Sound musik yang sedang diputar di client
	 * @param isDj True jika mencari audio DJ Stage, false untuk Main Stage
	 */
	private getActiveMusicSound(isDj: boolean = false): Sound | undefined {
		if (isDj) {
			const dj = DjMusicPlayerService.getInstance();
			const djSound = dj.getSoundInstance();
			if (djSound && djSound.IsPlaying) return djSound;

			const serverDj = SoundService.FindFirstChild("ServerDjMusic") as Sound | undefined;
			if (serverDj && serverDj.IsPlaying) return serverDj;

			return undefined;
		}

		const mp = MusicPlayerService.getInstance();
		const mpSound = mp.getSoundInstance();
		if (mpSound && mpSound.IsPlaying) return mpSound;

		const serverMusic = SoundService.FindFirstChild("ServerGlobalMusic") as Sound | undefined;
		if (serverMusic && serverMusic.IsPlaying) return serverMusic;

		let bestSound: Sound | undefined;
		let maxLoudness = -1;

		for (const child of SoundService.GetChildren()) {
			if (child.IsA("Sound") && child.IsPlaying && child.Name !== "ServerDjMusic" && child.Name !== "DjMusic") {
				const loudness = child.PlaybackLoudness;
				if (loudness > maxLoudness) {
					maxLoudness = loudness;
					bestSound = child;
				}
			}
		}

		return bestSound;
	}

	/**
	 * Menghitung parameter audio beat engine untuk panggung tertentu
	 */
	private calculateBeatParams(
		activeSound: Sound | undefined,
		currentTrack: TrackData | undefined,
		clockNow: number,
	): {
		isMusicPlaying: boolean;
		songTime: number;
		beatDuration: number;
		leadBarPhase: number;
		leadTotalBeats: number;
		currentPatternIdx: number;
		nextPatternIdx: number;
		isCrossfading: boolean;
		smoothCrossfade: number;
		motorSlewRate: number;
		playbackLoudness: number;
	} {
		const isMusicPlaying = activeSound !== undefined && activeSound.IsPlaying;
		const playbackLoudness = activeSound && activeSound.IsPlaying ? activeSound.PlaybackLoudness : 0;
		const baseBpm = currentTrack?.bpm ?? 128;
		const playbackSpeed = activeSound ? activeSound.PlaybackSpeed : 1.0;
		const effectiveBpm = math.clamp(baseBpm * playbackSpeed, 40, 260);

		const beatDuration = 60 / baseBpm;
		const barDuration = beatDuration * 4;

		const rawSongTime = activeSound ? activeSound.TimePosition : clockNow;
		const trackOffset = currentTrack?.beatOffset ?? currentTrack?.firstBeatOffset ?? 0;
		const totalOffset = AUDIO_OUTPUT_LATENCY_SEC + trackOffset;
		const isBeforeFirstBeat = activeSound !== undefined && rawSongTime < totalOffset;
		const songTime = isBeforeFirstBeat ? 0 : math.max(0, rawSongTime - totalOffset);

		const motorSlewRate = 8.0 + (effectiveBpm / 60) * 4.0;
		const motorLeadTime = 1 / motorSlewRate;
		const leadAdjustedTime = isBeforeFirstBeat ? 0 : songTime + motorLeadTime;
		const leadBarPhase = isBeforeFirstBeat ? 0 : (leadAdjustedTime % barDuration) / barDuration;
		const leadTotalBeats = isBeforeFirstBeat ? 0 : leadAdjustedTime / beatDuration;

		// Smoothing energi audio (EMA) untuk smart pick koreografi
		this.smoothedLoudness = this.smoothedLoudness + (playbackLoudness - this.smoothedLoudness) * 0.02;

		const barsPerPattern = 4;
		const totalBars = leadAdjustedTime / barDuration;
		const barInCycle = totalBars % barsPerPattern;
		const currentPatternIdx = math.floor(totalBars / barsPerPattern);
		const nextPatternIdx = currentPatternIdx + 1;

		const isCrossfading = barInCycle >= barsPerPattern - 1;
		const crossfadeT = isCrossfading ? barInCycle - (barsPerPattern - 1) : 0;
		const smoothCrossfade = crossfadeT * crossfadeT * (3 - 2 * crossfadeT);

		return {
			isMusicPlaying,
			songTime,
			beatDuration,
			leadBarPhase,
			leadTotalBeats,
			currentPatternIdx,
			nextPatternIdx,
			isCrossfading,
			smoothCrossfade,
			motorSlewRate,
			playbackLoudness,
		};
	}

	/**
	 * Smart Pick: memilih koreografi untuk sebuah frasa musik (4 bar) berdasarkan
	 * urutan variatif dan energi audio saat frasa pertama kali dievaluasi.
	 * Hasil di-cache per frasa agar tidak berubah di tengah frasa.
	 */
	private getSmartChoreography(phraseIdx: number): StageLightMode {
		const cached = this.smartPickCache.get(phraseIdx);
		if (cached !== undefined) return cached;

		const loudness = this.smoothedLoudness;
		let picked: StageLightMode;
		if (loudness > 240) {
			const high = [StageLightMode.Ballyhoo, StageLightMode.CrossFire, StageLightMode.Circle];
			picked = high[phraseIdx % high.size()];
		} else if (loudness < 80) {
			const low = [StageLightMode.Searchlight, StageLightMode.FanSpread];
			picked = low[phraseIdx % low.size()];
		} else {
			const seq = [
				StageLightMode.Wave,
				StageLightMode.CrossFire,
				StageLightMode.Ballyhoo,
				StageLightMode.Circle,
				StageLightMode.FanSpread,
				StageLightMode.Searchlight,
			];
			picked = seq[phraseIdx % seq.size()];
		}

		if (this.smartPickCache.size() >= 8) this.smartPickCache.clear();
		this.smartPickCache.set(phraseIdx, picked);
		return picked;
	}

	/**
	 * Menghitung target offset [Pan, Tilt] untuk mode panggung tertentu
	 */
	private getModeOffset(
		mode: StageLightMode,
		f: ClientFixture,
		clockNow: number,
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
			case StageLightMode.Off:
				return [0, 0];

			case StageLightMode.Static: {
				const mid = (totalFixtures + 1) / 2;
				const panOffset = (f.column - mid) * (f.isDj ? 0.12 : 0.18);
				const tiltOffset = math.abs(f.column - mid) * (f.isDj ? 0.02 : 0.04);
				return [panOffset, tiltOffset];
			}

			case StageLightMode.Wave: {
				// True traveling sinusoidal wave across columns with synchronized room sweep
				const panAmp = f.isDj ? 0.35 : 0.50;
				const tiltAmp = f.isDj ? 0.20 : 0.32;
				const pan = math.sin(clockNow * 0.9) * panAmp;
				const tilt = math.sin(clockNow * 2.2 - (f.column - 1) * 0.95) * tiltAmp;
				return [pan, tilt];
			}

			case StageLightMode.Circle: {
				// Dual Counter-Rotating Double Helix Vortex
				const panAmp = f.isDj ? 0.32 : 0.45;
				const tiltAmp = f.isDj ? 0.18 : 0.26;
				const dir = f.column % 2 === 1 ? 1 : -1;
				const phase = f.column * 0.75;
				const pan = math.cos(clockNow * 1.8 * dir + phase) * panAmp;
				const tilt = math.sin(clockNow * 1.8 * dir + phase) * tiltAmp;
				return [pan, tilt];
			}

			case StageLightMode.Ballyhoo: {
				// High-energy Figure-8 Lissajous Sky Cannon
				const panAmp = f.isDj ? 0.38 : 0.58;
				const tiltAmp = f.isDj ? 0.20 : 0.28;
				const phaseOffset = f.column * 0.5;
				const pan = math.sin(clockNow * 2.6 + phaseOffset) * panAmp;
				const tilt = math.sin((clockNow * 2.6 + phaseOffset) * 2.0) * tiltAmp;
				return [pan, tilt];
			}

			case StageLightMode.CrossFire: {
				// X-Laser Scissors: outer and inner beams cross over through center
				const mid = (totalFixtures + 1) / 2;
				const colNorm = (f.column - mid) / 2;
				const scissorWave = math.sin(clockNow * 1.6);
				const pan = -colNorm * 0.55 * scissorWave;
				const tilt = -math.abs(scissorWave) * (f.isDj ? 0.14 : 0.22);
				return [pan, tilt];
			}

			case StageLightMode.FanSpread: {
				// Peacock Sunburst & Angel Wings breathing
				const mid = (totalFixtures + 1) / 2;
				const fanSpread = (f.column - mid) * (f.isDj ? 0.18 : 0.28);
				const breath = math.sin(clockNow * 1.3);
				const pan = fanSpread * (1.1 + 0.45 * breath);
				const tilt = math.cos(clockNow * 1.3) * (f.isDj ? 0.18 : 0.26);
				return [pan, tilt];
			}

			case StageLightMode.Searchlight: {
				// Sky Tracker / Suspenseful sweeping searchlights
				const pan = math.sin(clockNow * 0.6 + f.column * 1.25) * (f.isDj ? 0.40 : 0.65);
				const tilt = (math.cos(clockNow * 0.85 + f.column * 0.9) - 0.2) * (f.isDj ? 0.18 : 0.28);
				return [pan, tilt];
			}

			case StageLightMode.MusicSync:
			default: {
				// Smart pick: pilih koreografi yang ada berdasarkan frasa beat & energi audio
				const currentMode = this.getSmartChoreography(currentMusicPatternIdx);
				const [p1Pan, p1Tilt] = this.getModeOffset(
					currentMode,
					f,
					clockNow,
					leadBarPhase,
					leadTotalBeats,
					totalFixtures,
					currentMusicPatternIdx,
					nextMusicPatternIdx,
					false,
					0,
				);
				if (isMusicCrossfading) {
					const nextMode = this.getSmartChoreography(nextMusicPatternIdx);
					if (nextMode !== currentMode) {
						const [p2Pan, p2Tilt] = this.getModeOffset(
							nextMode,
							f,
							clockNow,
							leadBarPhase,
							leadTotalBeats,
							totalFixtures,
							currentMusicPatternIdx,
							nextMusicPatternIdx,
							false,
							0,
						);
						return [
							p1Pan + (p2Pan - p1Pan) * smoothMusicCrossfade,
							p1Tilt + (p2Tilt - p1Tilt) * smoothMusicCrossfade,
						];
					}
				}
				return [p1Pan, p1Tilt];
			}
		}
	}

	private getLightingState(isDj: boolean): {
		isSyncActive: boolean;
		brightness: number;
		beamEnabled: boolean;
		strobeSpeed: number;
		mode: StageLightMode;
	} {
		const adminState = AdminService.getInstance().getState();
		const stageState = isDj ? adminState.djStageLighting : adminState.stageLighting;

		const lightingFolder = Workspace.FindFirstChild("Lighting");
		const prefix = isDj ? "DjLighting" : "StageLighting";
		const attrMode = lightingFolder?.GetAttribute(`${prefix}Mode`) as StageLightMode | undefined;
		const attrBright = lightingFolder?.GetAttribute(`${prefix}Brightness`) as number | undefined;
		const attrBeam = lightingFolder?.GetAttribute(`${prefix}BeamEnabled`) as boolean | undefined;
		const attrStrobe = lightingFolder?.GetAttribute(`${prefix}StrobeSpeed`) as number | undefined;

		const defaultBrightness = isDj ? 3.5 : 4.5;
		const mode = stageState?.mode ?? attrMode ?? StageLightMode.Off;
		const brightness = stageState?.brightness ?? attrBright ?? defaultBrightness;
		const beamEnabled = stageState?.beamEnabled ?? attrBeam ?? false;
		const strobeSpeed = stageState?.strobeSpeed ?? attrStrobe ?? 0;

		return { isSyncActive: true, brightness, beamEnabled, strobeSpeed, mode };
	}

	private onRenderStepped(dt: number): void {
		const clockNow = os.clock();

		if (this.mainFixtures.size() === 0 && this.djFixtures.size() === 0) {
			this.indexLocalFixtures();
			if (this.mainFixtures.size() === 0 && this.djFixtures.size() === 0) return;
		}

		// ─── 1. PROSES MAIN STAGE FIXTURES (Sync ke MusicPlayerService) ───
		const mainActiveSound = this.getActiveMusicSound(false);
		const mainTrack = MusicPlayerService.getInstance().getCurrentTrack();
		const mainBeat = this.calculateBeatParams(mainActiveSound, mainTrack, clockNow);

		this.processFixtureGroup(
			dt,
			clockNow,
			this.mainFixtures,
			false,
			mainBeat.isMusicPlaying,
			mainBeat.songTime,
			mainBeat.beatDuration,
			mainBeat.leadBarPhase,
			mainBeat.leadTotalBeats,
			mainBeat.currentPatternIdx,
			mainBeat.nextPatternIdx,
			mainBeat.isCrossfading,
			mainBeat.smoothCrossfade,
			mainBeat.motorSlewRate,
			mainBeat.playbackLoudness,
		);

		// ─── 2. PROSES DJ STAGE FIXTURES (Sync ke DjMusicPlayerService) ───
		const djActiveSound = this.getActiveMusicSound(true);
		const djTrack = DjMusicPlayerService.getInstance().getCurrentTrack();
		const djBeat = this.calculateBeatParams(djActiveSound, djTrack, clockNow);

		this.processFixtureGroup(
			dt,
			clockNow,
			this.djFixtures,
			true,
			djBeat.isMusicPlaying,
			djBeat.songTime,
			djBeat.beatDuration,
			djBeat.leadBarPhase,
			djBeat.leadTotalBeats,
			djBeat.currentPatternIdx,
			djBeat.nextPatternIdx,
			djBeat.isCrossfading,
			djBeat.smoothCrossfade,
			djBeat.motorSlewRate,
			djBeat.playbackLoudness,
		);
	}

	private processFixtureGroup(
		dt: number,
		clockNow: number,
		fixtures: ClientFixture[],
		isDj: boolean,
		isMusicPlaying: boolean,
		songTime: number,
		beatDuration: number,
		leadBarPhase: number,
		leadTotalBeats: number,
		currentPatternIdx: number,
		nextPatternIdx: number,
		isCrossfading: boolean,
		smoothCrossfade: number,
		motorSlewRate: number,
		playbackLoudness: number,
	): void {
		if (fixtures.size() === 0) return;

		const { brightness, beamEnabled, strobeSpeed, mode } = this.getLightingState(isDj);

		// Mode change smooth blending
		let currMode = isDj ? this.djCurrentActiveMode : this.mainCurrentActiveMode;
		let prevMode = isDj ? this.djPreviousActiveMode : this.mainPreviousActiveMode;
		let transStartTime = isDj ? this.djModeTransitionStartTime : this.mainModeTransitionStartTime;

		if (mode !== currMode) {
			prevMode = currMode;
			currMode = mode;
			transStartTime = clockNow;

			if (isDj) {
				this.djPreviousActiveMode = prevMode;
				this.djCurrentActiveMode = currMode;
				this.djModeTransitionStartTime = transStartTime;
			} else {
				this.mainPreviousActiveMode = prevMode;
				this.mainCurrentActiveMode = currMode;
				this.mainModeTransitionStartTime = transStartTime;
			}
		}

		const modeElapsed = clockNow - transStartTime;
		const modeT = math.clamp(modeElapsed / this.MODE_CROSSFADE_DURATION, 0, 1);
		const smoothModeBlend = modeT * modeT * (3 - 2 * modeT);

		// Brightness base crossfade
		const prevModeBrightness = prevMode === StageLightMode.Off ? 0 : brightness;
		const currModeBrightness = currMode === StageLightMode.Off ? 0 : brightness;
		const blendedBrightness = prevModeBrightness + (currModeBrightness - prevModeBrightness) * smoothModeBlend;

		const isMusicMode = currMode === StageLightMode.MusicSync;
		const isIdleMusicSync = isMusicMode && !isMusicPlaying;

		// ─── BEAT & AUDIO-REACTIVE ENGINE ───
		const beatPhase = (songTime % beatDuration) / beatDuration;
		const kickHitDecay = math.exp(-beatPhase * 6.5);
		const loudnessNorm = math.clamp((playbackLoudness - 40) / 260, 0, 1.2);
		const audioPulse = isMusicPlaying
			? math.clamp(0.45 + 0.42 * kickHitDecay + 0.30 * loudnessNorm, 0.45, 1.35)
			: 1.0;

		// Musical strobe subdivision (1: 1/2 beat, 2: 1/4 beat, 3: 1/8 beat, 4: 1/16 beat)
		const subDiv = strobeSpeed === 1 ? 2 : strobeSpeed === 2 ? 1 : strobeSpeed === 3 ? 0.5 : 0.25;

		const total = fixtures.size();

		for (const f of fixtures) {
			if (!f.model.Parent) continue;

			// Self-heal component references
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

			const [basePan, baseTilt] = this.getFixtureAim(f);

			if (isIdleMusicSync) {
				// Standby perlahan mengarah ke target bidik
				const parkSpeed = dt * 3.5;
				f.currentPan = f.currentPan + (basePan - f.currentPan) * math.clamp(parkSpeed, 0, 1);
				f.currentTilt = f.currentTilt + (baseTilt - f.currentTilt) * math.clamp(parkSpeed, 0, 1);
			} else {
				const [prevPan, prevTilt] = this.getModeOffset(
					prevMode,
					f,
					clockNow,
					leadBarPhase,
					leadTotalBeats,
					total,
					currentPatternIdx,
					nextPatternIdx,
					isCrossfading,
					smoothCrossfade,
				);
				const [currPan, currTilt] = this.getModeOffset(
					currMode,
					f,
					clockNow,
					leadBarPhase,
					leadTotalBeats,
					total,
					currentPatternIdx,
					nextPatternIdx,
					isCrossfading,
					smoothCrossfade,
				);

				const targetOffsetPan = prevPan + (currPan - prevPan) * smoothModeBlend;
				const targetOffsetTilt = prevTilt + (currTilt - prevTilt) * smoothModeBlend;

				f.targetPan = basePan + targetOffsetPan;
				f.targetTilt = baseTilt + targetOffsetTilt;

				const effectiveSlew = math.clamp(motorSlewRate * (0.6 + 0.4 * smoothModeBlend), 4, 14);
				f.currentPan = f.currentPan + (f.targetPan - f.currentPan) * math.clamp(dt * effectiveSlew, 0, 1);
				f.currentTilt = f.currentTilt + (f.targetTilt - f.currentTilt) * math.clamp(dt * effectiveSlew, 0, 1);
			}

			// Tilt clamping range terpisah: DJ Stage butuh -1.55 s/d -0.40 agar menatap lantai/meja DJ
			const minTilt = isDj ? -1.55 : -0.92;
			const maxTilt = isDj ? -0.40 : -0.52;
			const safeTilt = math.clamp(f.currentTilt, minTilt, maxTilt);

			if (f.panMotor) f.panMotor.C0 = BASE_PAN_C0.mul(CFrame.Angles(0, 0, f.currentPan));
			if (f.tiltMotor) f.tiltMotor.C0 = BASE_TILT_C0.mul(CFrame.Angles(0, 0, safeTilt));

			// Strobe / Beat flash calculation per fixture
			let actualBrightness = blendedBrightness;
			let actualBeam = beamEnabled && currMode !== StageLightMode.Off;

			if (strobeSpeed > 0) {
				// Alternating odd/even chase flash on musical division
				const colOffsetPhase = f.column % 2 === 0 && strobeSpeed >= 2 ? 0.5 : 0.0;
				const strobeCycle = (songTime / (beatDuration * subDiv) + colOffsetPhase) % 1.0;
				const isFlash = strobeCycle < 0.38;

				if (isFlash) {
					const strobeMultiplier = isMusicMode ? 1.25 + 0.45 * kickHitDecay : 1.35;
					actualBrightness = math.max(0.5, blendedBrightness * strobeMultiplier);
					actualBeam = beamEnabled;
				} else {
					actualBrightness = 0;
					actualBeam = false;
				}
			} else if (isMusicMode && isMusicPlaying) {
				// Pola koreografi 24-beat:
				// 1. Ganjil-Genap (Beat 0-7)
				// 2. Wave Loop Ping-Pong Kiri ke Kanan & Kanan ke Kiri (Beat 8-15)
				// 3. All-Out Climax Flash (Beat 16-23)
				const beatIndex = math.floor(leadTotalBeats);
				const cycleStep = beatIndex % 24;
				let isFixtureActive = true;

				if (cycleStep < 8) {
					// Pola 1: Ganjil-Genap bergantian per ketukan (Even: 1, 3, 5 | Odd: 2, 4)
					const isEvenBeat = beatIndex % 2 === 0;
					const isOddCol = f.column % 2 === 1;
					isFixtureActive = isEvenBeat ? isOddCol : !isOddCol;
				} else if (cycleStep < 16) {
					// Pola Wave: Looping Kiri ke Kanan lalu Kanan ke Kiri (1 -> 2 -> 3 -> 4 -> 5 -> 4 -> 3 -> 2)
					const cycleLen = math.max(2, (total - 1) * 2);
					const stepInWave = (beatIndex - 8) % cycleLen;
					const activeCol =
						stepInWave < total ? stepInWave + 1 : total - (stepInWave - total + 1);
					isFixtureActive = f.column === activeCol;
				} else {
					// Pola 4: All-out kick flash (seluruh lampu menyala serempak)
					isFixtureActive = true;
				}

				if (isFixtureActive) {
					actualBrightness = blendedBrightness * audioPulse;
					actualBeam = beamEnabled;
				} else {
					actualBrightness = 0;
					actualBeam = false;
				}
			}

			if (isIdleMusicSync) {
				actualBrightness = 0.8;
				actualBeam = true;
			}

			if (f.spot) {
				f.currentBrightness = actualBrightness;
				f.spot.Brightness = actualBrightness;
				f.spot.Enabled = actualBrightness > 0.05;
			}

			if (f.beam) {
				f.beam.Enabled = actualBeam && actualBrightness > 0.05;
				f.beam.Width1 = isDj ? 18 : 20;

				const bFactor = math.clamp(actualBrightness / 5.0, 0, 1.5);
				const t0 = math.clamp(1 - 0.95 * math.min(1, bFactor), 0, 0.98);
				const t1 = math.clamp(1 - 0.85 * math.min(1, bFactor), 0, 0.98);
				const t2 = math.clamp(1 - 0.65 * math.min(1, bFactor), 0, 0.99);
				const t3 = math.clamp(1 - 0.35 * math.min(1, bFactor), 0, 1.0);
				const t4 = math.clamp(1 - 0.10 * math.min(1, bFactor), 0.5, 1.0);

				f.beam.Transparency = new NumberSequence([
					new NumberSequenceKeypoint(0.0, t0),
					new NumberSequenceKeypoint(0.15, t1),
					new NumberSequenceKeypoint(0.4, t2),
					new NumberSequenceKeypoint(0.7, t3),
					new NumberSequenceKeypoint(0.88, t4),
					new NumberSequenceKeypoint(1.0, 1.0),
				]);
			}

			if (f.lens) {
				f.lens.Material =
					actualBrightness > 0.05 && actualBeam ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
			}
		}
	}
}
