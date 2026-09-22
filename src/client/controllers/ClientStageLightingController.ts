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

	// Dynamic Beat & Energy Tracking
	private lastLoudness = 0;
	private shortEnergy = 0;
	private mediumEnergy = 0;
	private kickIntensity = 0;
	private kickDensity = 0;
	private lastKickTimestamp = 0;
	private lastBeatIndex = -1;

	// Strobe Engine
	private autoStrobeTimer = 0;
	private autoStrobeCooldown = 0;
	private lastDropImpact = 0;

	// SYNC: Kick-Reactive Dynamic Lighting State
	private kickFlash = 0; // 0.0 - 1.0, decay cepat (~80ms)
	private kickStrobeTimer = 0; // detik, durasi burst
	private kickStrobeCooldown = 0; // detik, jarak min antar burst
	private lastSignificantKickTs = 0; // os.clock()
	private lastConfirmedKickTs = 0; // os.clock()
	private lastBeatPhaseForKick = 0;
	private recentStmForGate: number[] = [];

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

		// SYNC: Set default tuning attributes (hanya jika belum ada — biar admin bisa override manual)
		const lightingFolder = Workspace.FindFirstChild("Lighting");
		if (lightingFolder) {
			if (lightingFolder.GetAttribute("TuneKickGate") === undefined)
				lightingFolder.SetAttribute("TuneKickGate", 1.05);
			if (lightingFolder.GetAttribute("TuneStrobeGate") === undefined)
				lightingFolder.SetAttribute("TuneStrobeGate", 1.15);
			if (lightingFolder.GetAttribute("TuneStrobeCooldown") === undefined)
				lightingFolder.SetAttribute("TuneStrobeCooldown", 0.12);
		}

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

		const isSyncActive = mode === StageLightMode.MusicSync || isMusicSync === true || mode === undefined;

		return { isSyncActive, brightness, beamEnabled, strobeSpeed, mode };
	}

	private onRenderStepped(dt: number): void {
		const clockNow = os.clock();

		// ─── 0. FIXTURE INDEX CHECK ───
		// SYNC: Hanya re-index jika benar-benar kosong. Reference stale di-handle
		// per-fixture di dalam loop rendering (Section 7) — jangan clear array di sini,
		// karena akan reset motor state & spot reference setiap frame.
		if (this.fixtures.size() === 0) {
			this.indexLocalFixtures();
			if (this.fixtures.size() === 0) return;
		}

		const { isSyncActive, brightness, beamEnabled, strobeSpeed, mode } = this.getLightingState();
		const isManualStrobe = strobeSpeed > 0 || mode === StageLightMode.Strobe;
		if (!isSyncActive && !isManualStrobe) return;

		if (isManualStrobe) {
			this.autoStrobeTimer = 0;
			this.autoStrobeCooldown = 0;
		}

		const activeSound = this.getActiveMusicSound();
		const isMusicPlaying = activeSound !== undefined && activeSound.IsPlaying;

		// ─── JIKA MUSIK TIDAK SEDANG DIPUTAR & BUKAN STROBE MANUAL: Parkir perlahan ke Mic ───
		if (!isMusicPlaying && !isManualStrobe) {
			this.lastBeatIndex = -1;
			this.kickFlash = 0;
			this.kickStrobeTimer = 0;
			this.kickStrobeCooldown = 0;
			this.lastConfirmedKickTs = 0;
			this.recentStmForGate = [];
			this.lastBeatPhaseForKick = 0;
			this.lastLoudness = 0;
			const lightingFolder = Workspace.FindFirstChild("Lighting");
			const debugEnabled = lightingFolder?.GetAttribute("DebugEnabled") === true;
			if (lightingFolder && debugEnabled) {
				lightingFolder.SetAttribute("DebugSongTime", 0);
				lightingFolder.SetAttribute("DebugBeatPhase", 0);
				lightingFolder.SetAttribute("DebugBarPhase", 0);
				lightingFolder.SetAttribute("DebugAudioLatency", AUDIO_OUTPUT_LATENCY_SEC);
				lightingFolder.SetAttribute("DebugKickFlash", 0);
				lightingFolder.SetAttribute("DebugKickStrobeTimer", 0);
				lightingFolder.SetAttribute("DebugRawLoudness", 0);
				lightingFolder.SetAttribute("DebugShortEnergy", 0);
				lightingFolder.SetAttribute("DebugMediumEnergy", 0);
				lightingFolder.SetAttribute("DebugShortToMedium", 0);
				lightingFolder.SetAttribute("DebugIsSignificantKick", false);
				lightingFolder.SetAttribute("DebugIsBigKick", false);
				lightingFolder.SetAttribute("DebugAutoStrobeCd", 0);
				lightingFolder.SetAttribute("DebugKickStrobeCd", 0);
				lightingFolder.SetAttribute("DebugKickDensity", 0);
				lightingFolder.SetAttribute("DebugAutoStrobeTimer", 0);
				lightingFolder.SetAttribute("DebugHasRecentKick", false);
				lightingFolder.SetAttribute("DebugLastConfirmedKickAgo", 0);
				lightingFolder.SetAttribute("DebugLastStrobeSource", "none");
				lightingFolder.SetAttribute("DebugAtDownbeat", false);
				lightingFolder.SetAttribute("DebugAtHalfBeat", false);
				lightingFolder.SetAttribute("DebugFirstBrightness", this.fixtures[0]?.spot ? this.fixtures[0].spot.Brightness : -1);
				lightingFolder.SetAttribute("DebugSpotExists0", this.fixtures[0]?.spot !== undefined);
				lightingFolder.SetAttribute("DebugBeamExists0", this.fixtures[0]?.beam !== undefined);
				lightingFolder.SetAttribute(
					"DebugBodyChildsCount",
					(() => {
						const body = this.fixtures[0]?.model.FindFirstChild("Body");
						return body ? body.GetChildren().size() : -1;
					})(),
				);
			}

			const parkSpeed = dt * 4.0;
			for (const f of this.fixtures) {
				if (!f.model.Parent) continue;
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
				f.currentPan = f.currentPan + (basePan - f.currentPan) * math.clamp(parkSpeed, 0, 1);
				f.currentTilt = f.currentTilt + (baseTilt - f.currentTilt) * math.clamp(parkSpeed, 0, 1);

				const safeTilt = math.clamp(f.currentTilt, -0.92, -0.52);
				if (f.panMotor) f.panMotor.C0 = BASE_PAN_C0.mul(CFrame.Angles(0, 0, f.currentPan));
				if (f.tiltMotor) f.tiltMotor.C0 = BASE_TILT_C0.mul(CFrame.Angles(0, 0, safeTilt));

				if (f.spot) {
					f.currentBrightness =
						f.currentBrightness + (1.2 - f.currentBrightness) * math.clamp(parkSpeed, 0, 1);
					f.spot.Brightness = f.currentBrightness;
					f.spot.Enabled = true;
				}
				if (f.beam) f.beam.Enabled = beamEnabled;
				if (f.lens) f.lens.Material = Enum.Material.Neon;
			}
			return;
		}

		// ─── 1. PHASE-LOCKED MUSICAL BEAT ENGINE (LATENCY & OFFSET COMPENSATED) ───
		const musicService = MusicPlayerService.getInstance();
		const currentTrack = musicService.getCurrentTrack();
		const baseBpm = currentTrack?.bpm ?? 128;
		const playbackSpeed = activeSound ? activeSound.PlaybackSpeed : 1.0;
		// SYNC: effectiveBpm hanya untuk motor slew-rate smoothing & UI, JANGAN double-count di beatDuration!
		const effectiveBpm = math.clamp(baseBpm * playbackSpeed, 40, 260);

		// SYNC: beatDuration menggunakan baseBpm karena Sound.TimePosition sudah diskalakan oleh PlaybackSpeed
		const beatDuration = 60 / baseBpm;
		const barDuration = beatDuration * 4; // Birama 4/4 standar

		const rawSongTime = activeSound ? activeSound.TimePosition : clockNow;
		const trackOffset = currentTrack?.beatOffset ?? currentTrack?.firstBeatOffset ?? 0;
		// SYNC: Kurangi output latency hardware speaker (~80ms) & per-track downbeat offset
		const totalOffset = AUDIO_OUTPUT_LATENCY_SEC + trackOffset;
		const isBeforeFirstBeat = activeSound !== undefined && rawSongTime < totalOffset;
		const songTime = isBeforeFirstBeat ? 0 : math.max(0, rawSongTime - totalOffset);

		const totalBeats = isBeforeFirstBeat ? 0 : songTime / beatDuration;

		// Fase birama & subdivisi musikal deterministik (0.0 s/d 1.0)
		const beatPhase = isBeforeFirstBeat ? 0 : (songTime % beatDuration) / beatDuration; // 0.0 s/d 1.0 (Quarter note)
		const barPhase = isBeforeFirstBeat ? 0 : (songTime % barDuration) / barDuration; // 0.0 s/d 1.0 (4 beats)
		const eighthPhase = isBeforeFirstBeat ? 0 : (songTime % (beatDuration * 0.5)) / (beatDuration * 0.5); // 0.0 s/d 1.0 (Eighth note)
		const sixteenthPhase = isBeforeFirstBeat ? 0 : (songTime % (beatDuration * 0.25)) / (beatDuration * 0.25); // 0.0 s/d 1.0 (16th note)

		// SYNC: Expose real-time debug timing metrics untuk kalibrasi cepat (Section 10 & Test D)
		const lightingFolder = Workspace.FindFirstChild("Lighting");
		const debugEnabled = lightingFolder?.GetAttribute("DebugEnabled") === true;
		if (lightingFolder && debugEnabled) {
			lightingFolder.SetAttribute("DebugSongTime", math.floor(songTime * 1000) / 1000);
			lightingFolder.SetAttribute("DebugBeatPhase", math.floor(beatPhase * 1000) / 1000);
			lightingFolder.SetAttribute("DebugBarPhase", math.floor(barPhase * 1000) / 1000);
			lightingFolder.SetAttribute("DebugAudioLatency", AUDIO_OUTPUT_LATENCY_SEC);
			lightingFolder.SetAttribute("DebugKickFlash", math.floor(this.kickFlash * 100) / 100);
			lightingFolder.SetAttribute("DebugKickStrobeTimer", math.floor(this.kickStrobeTimer * 1000) / 1000);

			const firstFixture = this.fixtures[0];
			if (firstFixture && (firstFixture.spot === undefined || !firstFixture.spot.IsDescendantOf(game))) {
				const body = firstFixture.model.FindFirstChild("Body");
				const beam1 = body?.FindFirstChild("Beam1");
				firstFixture.spot = beam1?.FindFirstChildOfClass("SpotLight");
				firstFixture.beam = beam1?.FindFirstChildOfClass("Beam");
				firstFixture.lens = body?.FindFirstChild("Lens") as BasePart | undefined;
			}

			lightingFolder.SetAttribute("DebugFixtureCount", this.fixtures.size());
			lightingFolder.SetAttribute("DebugFirstSpotExists", firstFixture?.spot !== undefined);
			lightingFolder.SetAttribute("DebugFirstSpotBrightness", firstFixture?.spot ? firstFixture.spot.Brightness : -1);
			lightingFolder.SetAttribute("DebugFirstBrightness", firstFixture?.spot ? firstFixture.spot.Brightness : -1);
			lightingFolder.SetAttribute("DebugFirstPanMotorExists", firstFixture?.panMotor !== undefined);
			lightingFolder.SetAttribute("DebugSpotExists0", this.fixtures[0]?.spot !== undefined);
			lightingFolder.SetAttribute("DebugBeamExists0", this.fixtures[0]?.beam !== undefined);
			lightingFolder.SetAttribute(
				"DebugBodyChildsCount",
				(() => {
					const body = this.fixtures[0]?.model.FindFirstChild("Body");
					return body ? body.GetChildren().size() : -1;
				})(),
			);
		}

		// ─── 2. MOTOR SLEW RATE & LEAD PREDICTION / COMPENSATED TIMING ───
		// Menghitung kompensasi fase (lookahead/lead phase) agar keterlambatan inersia motor tereliminasi:
		// Slew-rate low-pass filter menghasilkan time delay tau ≈ 1 / motorSlewRate
		const motorSlewRate = 8.0 + (effectiveBpm / 60) * 4.0;
		const motorLeadTime = 1 / motorSlewRate;
		const leadAdjustedTime = isBeforeFirstBeat ? 0 : songTime + motorLeadTime;
		const leadBarPhase = isBeforeFirstBeat ? 0 : (leadAdjustedTime % barDuration) / barDuration;
		const leadTotalBeats = isBeforeFirstBeat ? 0 : leadAdjustedTime / beatDuration;

		// ─── 3. BEAT-TRIGGERED, LOUDNESS-GATED KICK FLASH ───
		let rawLoudness = 0;
		if (activeSound && activeSound.IsPlaying) {
			rawLoudness = activeSound.PlaybackLoudness;
		}

		this.shortEnergy += (rawLoudness - this.shortEnergy) * math.clamp(dt * 18.0, 0, 1);
		this.mediumEnergy += (rawLoudness - this.mediumEnergy) * math.clamp(dt * 2.8, 0, 1);

		const shortToMedium = this.shortEnergy / math.max(this.mediumEnergy, 1);

		// SYNC: Peak-hold 5 frame buat gate loudness (anti aliasing 30Hz)
		this.recentStmForGate.push(shortToMedium);
		if (this.recentStmForGate.size() > 5) this.recentStmForGate.shift();
		let maxRecentStm = 0;
		for (const v of this.recentStmForGate) if (v > maxRecentStm) maxRecentStm = v;

		// SYNC: Beat rising edge — timing akurat dari TimePosition
		const prevBeatPhase = this.lastBeatPhaseForKick;
		const isNewBeatNow = prevBeatPhase > 0.5 && beatPhase < 0.5;
		this.lastBeatPhaseForKick = beatPhase;

		// SYNC: Tuning
		const tuneGate = (lightingFolder?.GetAttribute("TuneKickGate") as number) ?? 1.05;
		const tuneStrobeCd = (lightingFolder?.GetAttribute("TuneStrobeCooldown") as number) ?? 0.12;
		const tuneStrobeGate = (lightingFolder?.GetAttribute("TuneStrobeGate") as number) ?? 1.15;

		// SYNC: TRIGGER — timing dari beat, gate dari loudness
		if (isNewBeatNow && !isBeforeFirstBeat) {
			// Cek apakah ada kick "baru-baru ini" via peak-hold loudness
			if (maxRecentStm > tuneGate) {
				// Intensity dari loudness (dinamis)
				const intensity = math.clamp((maxRecentStm - 1.0) * 5.0, 0.4, 1.0);
				this.kickFlash = intensity;
				this.lastConfirmedKickTs = clockNow;
				this.kickIntensity = math.clamp((rawLoudness - 15) / 100, 0.3, 1.3);
				this.kickDensity = math.min(6.0, this.kickDensity + 1.0);
			}
			// Kalau maxRecentStm <= tuneGate → beat kalem, skip. No flash.
		}

		// SYNC: Kick strobo burst — beat dengan loudness tinggi
		if (isNewBeatNow && maxRecentStm > tuneStrobeGate && this.kickStrobeCooldown <= 0) {
			this.kickStrobeTimer = 0.08;
			this.kickStrobeCooldown = tuneStrobeCd;
			this.autoStrobeTimer = 0;
			this.lastConfirmedKickTs = clockNow;
		}

		// Decay (sedikit lebih lambat biar visual kelihatan)
		this.kickFlash = math.max(0, this.kickFlash - dt * 8);
		this.kickStrobeTimer = math.max(0, this.kickStrobeTimer - dt);
		this.kickStrobeCooldown = math.max(0, this.kickStrobeCooldown - dt);
		this.kickIntensity = math.max(0, this.kickIntensity - dt * 7.5);
		this.kickDensity = math.max(0, this.kickDensity - dt * 1.0);
		this.lastDropImpact = math.max(0, this.lastDropImpact - dt * 4.0);

		// Debug
		if (lightingFolder && debugEnabled) {
			lightingFolder.SetAttribute("DebugMaxRecentStm", math.floor(maxRecentStm * 1000) / 1000);
			lightingFolder.SetAttribute("DebugIsNewBeat", isNewBeatNow);
			lightingFolder.SetAttribute("DebugShortToMedium", math.floor(shortToMedium * 1000) / 1000);
		}

		// ─── 4. BEAT-LOCKED STROBE BURST TRIGGERS ───
		// Siklus birama untuk koreografi & fill musikal (8 bars = 32 beats) menggunakan lead time
		const barsPerPattern = 8;
		const totalBars = leadAdjustedTime / barDuration;
		const barInCycle = totalBars % barsPerPattern;
		const isPhraseTurnaround = barInCycle >= 7.75; // 1 beat terakhir di bar ke-8

		if (this.autoStrobeCooldown > 0) {
			this.autoStrobeCooldown = math.max(0, this.autoStrobeCooldown - dt);
		}

		// SYNC: Semua auto strobe WAJIB gate ke hasRecentKick — no kick, no strobe.
		// Track source untuk debugging.
		const hasRecentKick = clockNow - this.lastConfirmedKickTs < beatDuration;
		// SYNC: Drum roll strobe HANYA trigger di DOWNBEAT (beatPhase < 0.08) supaya sync ke kick.
		// Jangan trigger random saat akumulasi KickDensity.
		const isAtBeatStart = beatPhase < 0.08;

		const isNewBeat = isNewBeatNow;
		const isSuddenDropImpact = isNewBeat && maxRecentStm > 1.30;
		const isDrumRollSurge = this.kickDensity >= 4.5 && maxRecentStm > 1.15;

		if (this.autoStrobeCooldown <= 0 && !isBeforeFirstBeat && hasRecentKick) {
			if (isSuddenDropImpact) {
				this.lastDropImpact = 1.0;
				this.autoStrobeTimer = beatDuration * 2.0;
				this.autoStrobeCooldown = beatDuration * 8.0;
				if (lightingFolder && debugEnabled) lightingFolder.SetAttribute("DebugLastStrobeSource", "drop");
			} else if (isDrumRollSurge && this.kickDensity >= 4.5 && isAtBeatStart) {
				this.autoStrobeTimer = beatDuration * 1.5;
				this.autoStrobeCooldown = beatDuration * 6.0;
				if (lightingFolder && debugEnabled) lightingFolder.SetAttribute("DebugLastStrobeSource", "roll");
			} else if (isPhraseTurnaround && this.kickDensity >= 2.0) {
				this.autoStrobeTimer = beatDuration * 1.0;
				this.autoStrobeCooldown = beatDuration * 4.0;
				if (lightingFolder && debugEnabled) lightingFolder.SetAttribute("DebugLastStrobeSource", "turnaround");
			}
		} else if (this.autoStrobeCooldown <= 0 && !hasRecentKick) {
			if (lightingFolder && debugEnabled) lightingFolder.SetAttribute("DebugLastStrobeSource", "none");
		}

		if (this.autoStrobeTimer > 0) {
			this.autoStrobeTimer = math.max(0, this.autoStrobeTimer - dt);
		}

		const isStrobeActive = isManualStrobe || this.autoStrobeTimer > 0;

		// ─── 5. OPTICAL SHUTTER CUT CALCULATION ───
		let isShutterOpen = true;

		if (isManualStrobe) {
			// Kecepatan strobo manual terkunci pada fraksi birama musik
			switch (strobeSpeed) {
				case 1: // Slow (Quarter note / 1 beat)
					isShutterOpen = beatPhase < 0.55;
					break;
				case 2: // Med (Eighth note / 1/2 beat)
					isShutterOpen = eighthPhase < 0.55;
					break;
				case 3: // Fast (16th note / 1/4 beat)
					isShutterOpen = sixteenthPhase < 0.55;
					break;
				case 4: // Hyper (32th note / 1/8 beat)
				default: {
					const thirtySecondPhase = isBeforeFirstBeat
						? 0
						: (songTime % (beatDuration * 0.125)) / (beatDuration * 0.125);
					isShutterOpen = thirtySecondPhase < 0.55;
					break;
				}
			}
		} else if (isStrobeActive) {
			// SYNC: Flash serempak (bukan alternate ganjil-genap) supaya visual jelas strobo.
			if (this.lastDropImpact > 0.1) {
				isShutterOpen = sixteenthPhase < 0.55;
			} else {
				isShutterOpen = eighthPhase < 0.55;
			}
		}

		// ─── 6. MULTI-CHOREOGRAPHY SELECTION & INTERPOLATION (LEAD COMPENSATED) ───
		// Berganti pola secara harmonis setiap 8 birama lagu (32 beats)
		const currentPatternIdx = math.floor(totalBars / barsPerPattern) % TOTAL_PATTERNS;
		const nextPatternIdx = (currentPatternIdx + 1) % TOTAL_PATTERNS;

		const isCrossfading = barInCycle >= barsPerPattern - 1; // 1 bar terakhir untuk crossfade halus
		const crossfadeT = isCrossfading ? barInCycle - (barsPerPattern - 1) : 0;
		const smoothCrossfade = crossfadeT * crossfadeT * (3 - 2 * crossfadeT);

		// ─── 7. PHYSICAL MOTOR SLEW & LIGHTING UPDATE ───
		const total = this.fixtures.size();
		const baseBrightness = brightness;

		for (const f of this.fixtures) {
			if (!f.model.Parent) continue;
			// SYNC: Per-fixture self-heal — refetch reference nil TANPA clear array.
			// Jauh lebih murah dari full re-index, dan tidak reset motor state.
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

			// Gunakan leadBarPhase & leadTotalBeats agar motor tiba tepat di puncak (downbeat)
			const [p1Pan, p1Tilt] = this.evaluateMusicalPattern(
				currentPatternIdx,
				f,
				leadBarPhase,
				leadTotalBeats,
				total,
			);
			let targetOffsetPan = p1Pan;
			let targetOffsetTilt = p1Tilt;

			if (isCrossfading) {
				const [p2Pan, p2Tilt] = this.evaluateMusicalPattern(
					nextPatternIdx,
					f,
					leadBarPhase,
					leadTotalBeats,
					total,
				);
				targetOffsetPan = p1Pan + (p2Pan - p1Pan) * smoothCrossfade;
				targetOffsetTilt = p1Tilt + (p2Tilt - p1Tilt) * smoothCrossfade;
			}

			const isOdd = f.column % 2 === 1;
			const kickNudge = this.kickIntensity * (isOdd ? 0.04 : -0.04);

			f.targetPan = basePan + targetOffsetPan + kickNudge;
			f.targetTilt = baseTilt + targetOffsetTilt;

			f.currentPan = f.currentPan + (f.targetPan - f.currentPan) * math.clamp(dt * motorSlewRate, 0, 1);
			f.currentTilt = f.currentTilt + (f.targetTilt - f.currentTilt) * math.clamp(dt * motorSlewRate, 0, 1);

			const safeTilt = math.clamp(f.currentTilt, -0.92, -0.52);

			if (f.panMotor) f.panMotor.C0 = BASE_PAN_C0.mul(CFrame.Angles(0, 0, f.currentPan));
			if (f.tiltMotor) f.tiltMotor.C0 = BASE_TILT_C0.mul(CFrame.Angles(0, 0, safeTilt));

			if (f.spot) {
				if (isStrobeActive) {
					// ─── Priority 1: FULL STROBE (SYNC: Flash serempak — hilangkan alternate) ───
					const fixtureOpen = isShutterOpen;

					if (fixtureOpen) {
						f.spot.Brightness = math.min(9.5, baseBrightness * 2.2);
						f.spot.Enabled = true;

						if (f.beam) {
							f.beam.Enabled = beamEnabled;
							f.beam.Width1 = 12.0;
						}
						if (f.lens) f.lens.Material = Enum.Material.Neon;
					} else {
						// Blackout cut tajam (shutter tertutup)
						f.spot.Brightness = 0;
						f.spot.Enabled = false;

						if (f.beam) {
							f.beam.Enabled = false;
						}
						if (f.lens) f.lens.Material = Enum.Material.SmoothPlastic;
					}
				} else if (this.kickStrobeTimer > 0) {
					// ─── Priority 2: KICK STROBE BURST ───
					// SYNC: Optical shutter burst 3-4 frame pada kick sangat besar
					const isShutterOpen = sixteenthPhase < 0.55;
					if (isShutterOpen) {
						f.spot.Brightness = math.min(9.5, baseBrightness * 2.4);
						f.spot.Enabled = true;
						if (f.beam) {
							f.beam.Enabled = beamEnabled;
							f.beam.Width1 = 13.0;
						}
						if (f.lens) f.lens.Material = Enum.Material.Neon;
					} else {
						f.spot.Brightness = 0;
						f.spot.Enabled = false;
						if (f.beam) f.beam.Enabled = false;
						if (f.lens) f.lens.Material = Enum.Material.SmoothPlastic;
					}
				} else {
					// ─── Priority 3: REGULAR GROOVE + KICK FLASH ───
					// SYNC: Flash brightness jelas (~80ms decay) pada setiap kick signifikan
					const flashBoost = this.kickFlash * 1.5; // up to +1.5x
					const brightnessMultiplier = 0.82 + flashBoost; // 0.82 - 2.32
					f.currentBrightness = baseBrightness * brightnessMultiplier;
					f.spot.Brightness = math.min(8.5, f.currentBrightness);
					f.spot.Enabled = true;

					if (f.beam) {
						f.beam.Enabled = beamEnabled;
						f.beam.Width1 = 9.5 * (0.95 + this.kickFlash * 0.45);
					}
					if (f.lens) f.lens.Material = Enum.Material.Neon;
				}
			}
		}
	}
}
