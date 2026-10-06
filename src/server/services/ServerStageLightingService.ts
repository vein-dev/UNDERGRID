import { CollectionService, RunService, Workspace } from "@rbxts/services";
import {
	MusicPlayerState,
	StageLightFixture,
	StageLightMode,
	StageLightingControlPayload,
	StageTarget,
} from "shared/types";
import { ServerMusicService } from "./ServerMusicService";

/**
 * ServerStageLightingService
 * Layanan server otoritatif untuk mengontrol moving light konser di workspace.Lighting.
 * Mendukung kontrol terpisah dan independen untuk:
 * 1. Main Stage Fixtures (StageLight_C1_R01 s/d R05) -> Fokus ke game.Workspace.Mic
 * 2. DJ Stage Fixtures (StageLight_C1_R06 s/d R10)   -> Fokus ke game.Workspace.FocusDJLighting
 */
const BASE_PAN_C0 = new CFrame(0.0285873413, -0.258911133, -0.00492858887, 1, 0, 0, 0, 0, 1, 0, -1, 0);
const BASE_TILT_C0 = new CFrame(0.0239474773, -0.515777588, -0.00769042969, 1, 0, 0, 0, -1, 0, 0, 0, -1);

export class ServerStageLightingService {
	private static instance?: ServerStageLightingService;

	private isInitialized = false;
	private mainFixtures: StageLightFixture[] = [];
	private djFixtures: StageLightFixture[] = [];

	private mainControlState: StageLightingControlPayload = {
		mode: StageLightMode.Off,
		panAngle: 0,
		tiltAngle: 0,
		motorSpeed: 0.04,
		color: Color3.fromRGB(180, 240, 255),
		brightness: 4.5,
		beamEnabled: false,
		strobeSpeed: 0,
		isRainbow: false,
		isPulse: false,
		isMusicSync: false,
		target: "main",
		fogEnabled: false,
		fogIntensity: 0.6,
		backdropPreset: "gif_cyber_grid",
		backdropBrightness: 2.0,
	};

	private djControlState: StageLightingControlPayload = {
		mode: StageLightMode.Off,
		panAngle: 0,
		tiltAngle: 0,
		motorSpeed: 0.04,
		color: Color3.fromRGB(0, 255, 255),
		brightness: 3.5,
		beamEnabled: false,
		strobeSpeed: 0,
		isRainbow: false,
		isPulse: false,
		isMusicSync: false,
		target: "dj",
		fogEnabled: false,
		fogIntensity: 0.6,
		backdropPreset: "gif_cyber_grid",
		backdropBrightness: 2.0,
	};

	private mainFogEmitters: ParticleEmitter[] = [];
	private djFogEmitters: ParticleEmitter[] = [];

	private animationTime = 0;
	private mainStrobeTimer = 0;
	private mainStrobeState = false;
	private mainPulseTime = 0;

	private djStrobeTimer = 0;
	private djStrobeState = false;
	private djPulseTime = 0;

	private heartbeatConnection?: RBXScriptConnection;

	private constructor() {}

	public static getInstance(): ServerStageLightingService {
		if (!ServerStageLightingService.instance) {
			ServerStageLightingService.instance = new ServerStageLightingService();
		}
		return ServerStageLightingService.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		this.loadFixtures();
		this.ensureFogSetup();

		// Re-scan jika ada fog machine baru di-tag
		CollectionService.GetInstanceAddedSignal("FogMachine").Connect(() => {
			this.ensureFogSetup();
		});
		CollectionService.GetInstanceAddedSignal("DjFogMachine").Connect(() => {
			this.ensureFogSetup();
		});

		this.setMode(this.mainControlState.mode, "main");
		this.setMode(this.djControlState.mode, "dj");
		this.setColor(this.mainControlState.color, "main");
		this.setColor(this.djControlState.color, "dj");
		this.updateIntensity("all");

		// Sambungkan Heartbeat loop untuk update animasi motor, warna, dan efek
		this.heartbeatConnection = RunService.Heartbeat.Connect((dt) => {
			this.onHeartbeat(dt);
		});

		print(
			`[ServerStageLightingService] Initialized: ${this.mainFixtures.size()} Main Stage fixtures, ${this.djFixtures.size()} DJ Stage fixtures.`,
		);
	}

	/**
	 * Memuat dan mengindeks seluruh fixture dari workspace.Lighting
	 * Memisahkan secara otomatis antara Main Stage (R01-R05) dan DJ Stage (R06-R10)
	 */
	public loadFixtures(): void {
		this.mainFixtures.clear();
		this.djFixtures.clear();

		const tagged = CollectionService.GetTagged("StageLight");
		let targetList: Instance[] = tagged;
		if (targetList.size() === 0) {
			const lightingFolder = Workspace.FindFirstChild("Lighting");
			if (lightingFolder) {
				targetList = lightingFolder.GetChildren();
			}
		}

		for (const inst of targetList) {
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

			const base = inst.FindFirstChild("Base")?.FindFirstChild("part") as BasePart | undefined;
			const motorFolder = inst.FindFirstChild("Motor");
			const panMotor = motorFolder?.FindFirstChild("Pan") as Motor6D | undefined;
			const tiltMotor = motorFolder?.FindFirstChild("Tilt") as Motor6D | undefined;

			const body = inst.FindFirstChild("Body");
			const lensPart = body?.FindFirstChild("Lens") as BasePart | undefined;
			const beamPart = body?.FindFirstChild("Beam1");
			const spotLight = beamPart?.FindFirstChildOfClass("SpotLight");
			const beam = beamPart?.FindFirstChildOfClass("Beam");

			if (panMotor && tiltMotor) {
				if (base) {
					base.Anchored = true;
				}

				const armPart = inst.FindFirstChild("Pan")?.FindFirstChild("Arm") as BasePart | undefined;
				if (armPart) {
					armPart.Anchored = false;
					armPart.CanCollide = false;
				}
				if (body) {
					for (const child of body.GetChildren()) {
						if (child.IsA("BasePart")) {
							child.Anchored = false;
							child.CanCollide = false;
						}
					}
				}

				if (spotLight) {
					spotLight.Face = Enum.NormalId.Front;
					spotLight.Range = row >= 6 ? 65 : 60;
					spotLight.Angle = 85;
					spotLight.Shadows = true;
				}
				if (beam) {
					beam.Width0 = 1.2;
					beam.Width1 = row >= 6 ? 18 : 20;
					beam.LightEmission = 1;
					beam.LightInfluence = 0;
					beam.Transparency = new NumberSequence([
						new NumberSequenceKeypoint(0.0, 0.05),
						new NumberSequenceKeypoint(0.15, 0.15),
						new NumberSequenceKeypoint(0.4, 0.35),
						new NumberSequenceKeypoint(0.7, 0.65),
						new NumberSequenceKeypoint(0.88, 0.9),
						new NumberSequenceKeypoint(1.0, 1.0),
					]);
					if (beam.Attachment0) {
						beam.Attachment0.Position = new Vector3(0, 0, -0.2);
					}
					if (beam.Attachment1) {
						beam.Attachment1.Position = new Vector3(0, 0, -42);
					}
				}

				panMotor.DesiredAngle = 0;
				panMotor.CurrentAngle = 0;
				panMotor.MaxVelocity = 0;
				tiltMotor.DesiredAngle = 0;
				tiltMotor.CurrentAngle = 0;
				tiltMotor.MaxVelocity = 0;

				const fixtureData: StageLightFixture = {
					model: inst,
					column: col,
					row: row,
					panMotor,
					tiltMotor,
					initialPanC0: BASE_PAN_C0,
					initialTiltC0: BASE_TILT_C0,
					lensPart,
					spotLight,
					beam,
					basePart: base,
				};

				// R06 s/d R10 adalah fixture khusus Stage DJ
				if (row >= 6) {
					this.djFixtures.push(fixtureData);
				} else {
					this.mainFixtures.push(fixtureData);
				}
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
	 * Memutar motor Pan dan Tilt menggunakan Motor6D.C0
	 * Dengan batas aman tilt terpisah antara Main Stage dan DJ Stage
	 */
	private applyFixtureAngles(f: StageLightFixture, panAngle: number, tiltAngle: number, isDj = false): void {
		const minTilt = isDj ? -1.55 : -0.92;
		const maxTilt = isDj ? -0.40 : -0.52;
		const clampedTilt = math.clamp(tiltAngle, minTilt, maxTilt);
		f.panMotor.C0 = f.initialPanC0.mul(CFrame.Angles(0, 0, panAngle));
		f.tiltMotor.C0 = f.initialTiltC0.mul(CFrame.Angles(0, 0, clampedTilt));
	}

	/**
	 * Sudut presisi hasil kalibrasi matematis ke game.Workspace.Mic (Main Stage)
	 */
	private readonly micAims: Record<string, [number, number]> = {
		StageLight_C1_R01: [0.75, -0.836],
		StageLight_C1_R02: [0.466, -0.738],
		StageLight_C1_R03: [0.014, -0.682],
		StageLight_C1_R04: [-0.456, -0.732],
		StageLight_C1_R05: [-0.802, -0.86],
	};

	/**
	 * Sudut presisi hasil kalibrasi matematis ke game.Workspace.FocusDJLighting (DJ Stage)
	 * Dot product = 1.00000 (100% presisi mengunci objek FocusDJLighting secara kinematik)
	 */
	private readonly djAims: Record<string, [number, number]> = {
		StageLight_C1_R06: [0.810, -1.251],
		StageLight_C1_R07: [0.477, -1.135],
		StageLight_C1_R08: [0.000, -1.077],
		StageLight_C1_R09: [-0.458, -1.112],
		StageLight_C1_R10: [-0.822, -1.201],
	};

	/**
	 * Mendapatkan sudut bidik acuan untuk fixture tertentu
	 */
	private getFixtureAim(f: StageLightFixture, isDj: boolean): [number, number] {
		if (isDj) {
			const precomputed = this.djAims[f.model.Name];
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
			return [0, -0.384];
		} else {
			const precomputed = this.micAims[f.model.Name];
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
	 * Fokuskan seluruh moving light ke titik tengah target (Mic / FocusDJLighting)
	 */
	private applyCenterFocusAngles(isDj: boolean): void {
		const fixtures = isDj ? this.djFixtures : this.mainFixtures;
		for (const f of fixtures) {
			const [aimPan, aimTilt] = this.getFixtureAim(f, isDj);
			this.applyFixtureAngles(f, aimPan, aimTilt, isDj);
		}
	}

	/**
	 * Sudut statis menyebar anggun (fanned out) berpusat dari titik fokus
	 */
	private applyStaticAngles(isDj: boolean): void {
		const fixtures = isDj ? this.djFixtures : this.mainFixtures;
		const total = fixtures.size();
		const mid = (total + 1) / 2;
		for (const f of fixtures) {
			const [basePan, baseTilt] = this.getFixtureAim(f, isDj);
			const panOffset = (f.column - mid) * (isDj ? 0.12 : 0.18);
			const tiltOffset = math.abs(f.column - mid) * (isDj ? 0.02 : 0.04);
			this.applyFixtureAngles(f, basePan + panOffset, baseTilt + tiltOffset, isDj);
		}
	}

	/**
	 * Mengembalikan motor ke posisi netral fokus
	 */
	public resetMotors(target: StageTarget = "all"): void {
		if (target === "main" || target === "all") {
			for (const f of this.mainFixtures) {
				const [basePan, baseTilt] = this.getFixtureAim(f, false);
				this.applyFixtureAngles(f, basePan, baseTilt, false);
			}
		}
		if (target === "dj" || target === "all") {
			for (const f of this.djFixtures) {
				const [basePan, baseTilt] = this.getFixtureAim(f, true);
				this.applyFixtureAngles(f, basePan, baseTilt, true);
			}
		}
	}

	/**
	 * Mengatur warna fixture
	 */
	public setColor(color: Color3, target: StageTarget = "all"): void {
		const colorSeq = new ColorSequence(color);

		if (target === "main" || target === "all") {
			this.mainControlState.color = color;
			for (const f of this.mainFixtures) {
				if (f.spotLight) f.spotLight.Color = color;
				if (f.beam) f.beam.Color = colorSeq;
				if (f.lensPart) f.lensPart.Color = color;
			}
		}

		if (target === "dj" || target === "all") {
			this.djControlState.color = color;
			for (const f of this.djFixtures) {
				if (f.spotLight) f.spotLight.Color = color;
				if (f.beam) f.beam.Color = colorSeq;
				if (f.lensPart) f.lensPart.Color = color;
			}
		}
	}

	/**
	 * Memperbarui intensitas cahaya berdasarkan mode dan konfigurasi
	 */
	private updateIntensity(target: StageTarget = "all"): void {
		if (target === "main" || target === "all") {
			const isOff = this.mainControlState.mode === StageLightMode.Off;
			const targetBrightness = isOff ? 0 : this.mainControlState.brightness;
			const targetBeam = !isOff && this.mainControlState.beamEnabled;

			const bFactor = math.clamp(targetBrightness / 5.0, 0, 1.5);
			const t0 = math.clamp(1 - 0.95 * math.min(1, bFactor), 0, 0.98);
			const t1 = math.clamp(1 - 0.85 * math.min(1, bFactor), 0, 0.98);
			const t2 = math.clamp(1 - 0.65 * math.min(1, bFactor), 0, 0.99);
			const t3 = math.clamp(1 - 0.35 * math.min(1, bFactor), 0, 1.0);
			const t4 = math.clamp(1 - 0.10 * math.min(1, bFactor), 0.5, 1.0);
			const beamSeq = new NumberSequence([
				new NumberSequenceKeypoint(0.0, t0),
				new NumberSequenceKeypoint(0.15, t1),
				new NumberSequenceKeypoint(0.4, t2),
				new NumberSequenceKeypoint(0.7, t3),
				new NumberSequenceKeypoint(0.88, t4),
				new NumberSequenceKeypoint(1.0, 1.0),
			]);

			for (const f of this.mainFixtures) {
				if (f.spotLight) {
					f.spotLight.Brightness = targetBrightness;
					f.spotLight.Enabled = targetBrightness > 0.05;
				}
				if (f.beam) {
					f.beam.Enabled = targetBeam && targetBrightness > 0.05;
					f.beam.Width1 = 20;
					f.beam.Transparency = beamSeq;
				}
				if (f.lensPart) {
					f.lensPart.Material =
						targetBeam && targetBrightness > 0.05 ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
				}
			}
		}

		if (target === "dj" || target === "all") {
			const isOff = this.djControlState.mode === StageLightMode.Off;
			const targetBrightness = isOff ? 0 : this.djControlState.brightness;
			const targetBeam = !isOff && this.djControlState.beamEnabled;

			const bFactor = math.clamp(targetBrightness / 5.0, 0, 1.5);
			const t0 = math.clamp(1 - 0.95 * math.min(1, bFactor), 0, 0.98);
			const t1 = math.clamp(1 - 0.85 * math.min(1, bFactor), 0, 0.98);
			const t2 = math.clamp(1 - 0.65 * math.min(1, bFactor), 0, 0.99);
			const t3 = math.clamp(1 - 0.35 * math.min(1, bFactor), 0, 1.0);
			const t4 = math.clamp(1 - 0.10 * math.min(1, bFactor), 0.5, 1.0);
			const djBeamSeq = new NumberSequence([
				new NumberSequenceKeypoint(0.0, t0),
				new NumberSequenceKeypoint(0.15, t1),
				new NumberSequenceKeypoint(0.4, t2),
				new NumberSequenceKeypoint(0.7, t3),
				new NumberSequenceKeypoint(0.88, t4),
				new NumberSequenceKeypoint(1.0, 1.0),
			]);

			for (const f of this.djFixtures) {
				if (f.spotLight) {
					f.spotLight.Brightness = targetBrightness;
					f.spotLight.Enabled = targetBrightness > 0.05;
				}
				if (f.beam) {
					f.beam.Enabled = targetBeam && targetBrightness > 0.05;
					f.beam.Width1 = 18;
					f.beam.Transparency = djBeamSeq;
				}
				if (f.lensPart) {
					f.lensPart.Material =
						targetBeam && targetBrightness > 0.05 ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
				}
			}
		}
	}

	/**
	 * Mengubah mode operasional utama stage lighting
	 */
	public setMode(mode: StageLightMode, target: StageTarget = "main"): void {
		if (target === "main" || target === "all") {
			this.mainControlState.mode = mode;
			this.mainControlState.isMusicSync = mode === StageLightMode.MusicSync;
			this.applyModeState(mode, false);
		}

		if (target === "dj" || target === "all") {
			this.djControlState.mode = mode;
			this.djControlState.isMusicSync = mode === StageLightMode.MusicSync;
			this.applyModeState(mode, true);
		}

		this.syncAttributes();
		print(`[ServerStageLightingService] Mode set for target [${target}]: ${mode}`);
	}

	private applyModeState(mode: StageLightMode, isDj: boolean): void {
		const targetStage: StageTarget = isDj ? "dj" : "main";
		const state = isDj ? this.djControlState : this.mainControlState;
		const fixtures = isDj ? this.djFixtures : this.mainFixtures;

		switch (mode) {
			case StageLightMode.Off:
				this.resetMotors(targetStage);
				this.updateIntensity(targetStage);
				break;

			case StageLightMode.Static:
				this.applyStaticAngles(isDj);
				this.updateIntensity(targetStage);
				break;

			case StageLightMode.SpotlightCenter:
				this.applyCenterFocusAngles(isDj);
				this.updateIntensity(targetStage);
				break;

			case StageLightMode.Manual:
				for (const f of fixtures) {
					const [basePan, baseTilt] = this.getFixtureAim(f, isDj);
					this.applyFixtureAngles(f, basePan + state.panAngle, baseTilt + state.tiltAngle, isDj);
				}
				this.updateIntensity(targetStage);
				break;

			case StageLightMode.MusicSync:
			case StageLightMode.Wave:
			case StageLightMode.Ballyhoo:
			case StageLightMode.Circle:
			case StageLightMode.CrossFire:
			case StageLightMode.FanSpread:
			case StageLightMode.Searchlight:
			case StageLightMode.Strobe:
				this.updateIntensity(targetStage);
				break;
		}
	}

	/**
	 * Menerapkan konfigurasi kontrol parsial atau penuh dengan target fleksibel
	 */
	public applyControl(payload: Partial<StageLightingControlPayload>, targetOverride?: StageTarget): void {
		const target = targetOverride ?? payload.target ?? "main";

		const applyToSingleState = (
			state: StageLightingControlPayload,
			fixtures: StageLightFixture[],
			isDj: boolean,
		) => {
			const st: StageTarget = isDj ? "dj" : "main";

			if (payload.mode !== undefined) {
				this.setMode(payload.mode, st);
			}
			if (payload.panAngle !== undefined) {
				state.panAngle = payload.panAngle;
				if (state.mode === StageLightMode.Manual) {
					for (const f of fixtures) {
						const [basePan, baseTilt] = this.getFixtureAim(f, isDj);
						this.applyFixtureAngles(f, basePan + payload.panAngle, baseTilt + state.tiltAngle, isDj);
					}
				}
			}
			if (payload.tiltAngle !== undefined) {
				state.tiltAngle = payload.tiltAngle;
				if (state.mode === StageLightMode.Manual) {
					for (const f of fixtures) {
						const [basePan, baseTilt] = this.getFixtureAim(f, isDj);
						this.applyFixtureAngles(f, basePan + state.panAngle, baseTilt + payload.tiltAngle, isDj);
					}
				}
			}
			if (payload.motorSpeed !== undefined) {
				state.motorSpeed = math.clamp(payload.motorSpeed, 0.01, 0.1);
			}
			if (payload.color !== undefined) {
				this.setColor(payload.color, st);
			}
			if (payload.brightness !== undefined) {
				state.brightness = payload.brightness;
				this.updateIntensity(st);
			}
			if (payload.beamEnabled !== undefined) {
				state.beamEnabled = payload.beamEnabled;
				this.updateIntensity(st);
			}
			if (payload.strobeSpeed !== undefined) {
				state.strobeSpeed = payload.strobeSpeed;
			}
			if (payload.isRainbow !== undefined) {
				state.isRainbow = payload.isRainbow;
				if (!payload.isRainbow) {
					this.setColor(state.color, st);
				}
			}
			if (payload.isPulse !== undefined) {
				state.isPulse = payload.isPulse;
				if (!payload.isPulse) {
					this.updateIntensity(st);
				}
			}
			if (payload.isMusicSync !== undefined) {
				state.isMusicSync = payload.isMusicSync;
				if (payload.isMusicSync) {
					state.mode = StageLightMode.MusicSync;
				}
			}
		};

		if (target === "main" || target === "all") {
			applyToSingleState(this.mainControlState, this.mainFixtures, false);
		}
		if (target === "dj" || target === "all") {
			applyToSingleState(this.djControlState, this.djFixtures, true);
		}

		// Fog & Backdrop controls per stage
		if (payload.fogEnabled !== undefined) {
			if (target === "main" || target === "all") {
				this.mainControlState.fogEnabled = payload.fogEnabled;
				this.applyFog("main");
			}
			if (target === "dj" || target === "all") {
				this.djControlState.fogEnabled = payload.fogEnabled;
				this.applyFog("dj");
			}
		}
		if (payload.fogIntensity !== undefined) {
			if (target === "main" || target === "all") {
				this.mainControlState.fogIntensity = payload.fogIntensity;
				this.applyFog("main");
			}
			if (target === "dj" || target === "all") {
				this.djControlState.fogIntensity = payload.fogIntensity;
				this.applyFog("dj");
			}
		}
		if (payload.backdropPreset !== undefined) {
			if (target === "main" || target === "all") {
				this.mainControlState.backdropPreset = payload.backdropPreset;
			}
			if (target === "dj" || target === "all") {
				this.djControlState.backdropPreset = payload.backdropPreset;
			}
		}
		if (payload.backdropBrightness !== undefined) {
			if (target === "main" || target === "all") {
				this.mainControlState.backdropBrightness = payload.backdropBrightness;
			}
			if (target === "dj" || target === "all") {
				this.djControlState.backdropBrightness = payload.backdropBrightness;
			}
		}

		this.syncAttributes();
	}

	private syncAttributes(): void {
		const folder = Workspace.FindFirstChild("Lighting");
		if (folder) {
			// Main Stage Attributes
			folder.SetAttribute("StageLightingMode", this.mainControlState.mode);
			folder.SetAttribute("IsMusicSync", this.mainControlState.isMusicSync);
			folder.SetAttribute("StageLightingBrightness", this.mainControlState.brightness);
			folder.SetAttribute("StageLightingBeamEnabled", this.mainControlState.beamEnabled);
			folder.SetAttribute("StageLightingStrobeSpeed", this.mainControlState.strobeSpeed);
			folder.SetAttribute("StageLightingFogEnabled", this.mainControlState.fogEnabled ?? false);
			folder.SetAttribute("StageLightingFogIntensity", this.mainControlState.fogIntensity ?? 0.5);
			folder.SetAttribute(
				"StageLightingBackdropPreset",
				this.mainControlState.backdropPreset ?? "gif_cyber_grid",
			);
			folder.SetAttribute(
				"StageLightingBackdropBrightness",
				this.mainControlState.backdropBrightness ?? 2.0,
			);

			// DJ Stage Attributes
			folder.SetAttribute("DjLightingMode", this.djControlState.mode);
			folder.SetAttribute("IsDjMusicSync", this.djControlState.isMusicSync);
			folder.SetAttribute("DjLightingBrightness", this.djControlState.brightness);
			folder.SetAttribute("DjLightingBeamEnabled", this.djControlState.beamEnabled);
			folder.SetAttribute("DjLightingStrobeSpeed", this.djControlState.strobeSpeed);
			folder.SetAttribute("DjLightingFogEnabled", this.djControlState.fogEnabled ?? false);
			folder.SetAttribute("DjLightingFogIntensity", this.djControlState.fogIntensity ?? 0.5);
			folder.SetAttribute(
				"DjStageLightingBackdropPreset",
				this.djControlState.backdropPreset ?? "gif_cyber_grid",
			);
			folder.SetAttribute(
				"DjStageLightingBackdropBrightness",
				this.djControlState.backdropBrightness ?? 2.0,
			);
		}

		const targetModel = Workspace.FindFirstChild("3dModel");
		if (targetModel) {
			// Main Stage Backdrop
			const mainBackdrop = targetModel.FindFirstChild("Backdrop") as BasePart | undefined;
			if (mainBackdrop) {
				if (this.mainControlState.backdropPreset !== undefined) {
					mainBackdrop.SetAttribute("Preset", this.mainControlState.backdropPreset);
				}
				if (this.mainControlState.backdropBrightness !== undefined) {
					mainBackdrop.SetAttribute("Brightness", this.mainControlState.backdropBrightness);
				}
			}

			// DJ Stage Backdrop (BackdropDJ)
			const djBackdrop = targetModel.FindFirstChild("BackdropDJ") as BasePart | undefined;
			if (djBackdrop) {
				if (this.djControlState.backdropPreset !== undefined) {
					djBackdrop.SetAttribute("Preset", this.djControlState.backdropPreset);
				}
				if (this.djControlState.backdropBrightness !== undefined) {
					djBackdrop.SetAttribute("Brightness", this.djControlState.backdropBrightness);
				}
			}
		}
	}

	private ensureFogSetup(): void {
		this.mainFogEmitters.clear();
		this.djFogEmitters.clear();

		const setupEmittersForInstances = (instances: Instance[], list: ParticleEmitter[]) => {
			for (const child of instances) {
				let targetPart: BasePart | undefined;
				if (child.IsA("BasePart")) {
					targetPart = child;
				} else if (child.IsA("Model")) {
					targetPart = child.PrimaryPart ?? (child.FindFirstChildWhichIsA("BasePart") as BasePart | undefined);
				}

				if (!targetPart) continue;

				let attachment = targetPart.FindFirstChild("FogAttachment") as Attachment | undefined;
				if (!attachment) {
					attachment = new Instance("Attachment");
					attachment.Name = "FogAttachment";
					attachment.Parent = targetPart;
				}
				attachment.Position = new Vector3(0, 0, 0);
				attachment.Orientation = new Vector3(0, 0, 0);

				let emitter = attachment.FindFirstChild("FogEmitter") as ParticleEmitter | undefined;
				if (!emitter) {
					emitter = new Instance("ParticleEmitter");
					emitter.Name = "FogEmitter";
					emitter.Parent = attachment;
				}

				emitter.Texture = "rbxasset://textures/particles/smoke_main.dds";
				emitter.Rate = 0;
				emitter.Lifetime = new NumberRange(3.0, 5.0);
				emitter.Speed = new NumberRange(1.5, 3.5);
				emitter.SpreadAngle = new Vector2(90, 45);
				emitter.Size = new NumberSequence([
					new NumberSequenceKeypoint(0, 4),
					new NumberSequenceKeypoint(0.5, 10),
					new NumberSequenceKeypoint(1, 16),
				]);
				emitter.Transparency = new NumberSequence([
					new NumberSequenceKeypoint(0, 0.8),
					new NumberSequenceKeypoint(0.4, 0.9),
					new NumberSequenceKeypoint(1, 1),
				]);
				emitter.Color = new ColorSequence(Color3.fromRGB(220, 220, 230));
				emitter.LightEmission = 0;
				emitter.LightInfluence = 0.35;
				emitter.RotSpeed = new NumberRange(-15, 15);
				emitter.Acceleration = new Vector3(0, 0.25, 0);
				emitter.Drag = 3.0;
				emitter.ZOffset = 1;
				emitter.EmissionDirection = Enum.NormalId.Top;
				emitter.Enabled = false;

				list.push(emitter);
			}
		};

		// 1. Main Fog Emitters Setup
		let mainInstances = CollectionService.GetTagged("FogMachine");
		if (mainInstances.size() === 0) {
			const m = Workspace.FindFirstChild("FogMachine");
			if (m) mainInstances = m.GetChildren();
		}
		setupEmittersForInstances(mainInstances, this.mainFogEmitters);

		// 2. DJ Fog Emitters Setup (FogMachineDJ / Tag DjFogMachine)
		let djInstances = CollectionService.GetTagged("DjFogMachine");
		if (djInstances.size() === 0) {
			const m = Workspace.FindFirstChild("FogMachineDJ");
			if (m) djInstances = m.GetChildren();
		}
		setupEmittersForInstances(djInstances, this.djFogEmitters);

		print(
			`[ServerStageLightingService] Fog: ${this.mainFogEmitters.size()} Main emitters, ${this.djFogEmitters.size()} DJ emitters.`,
		);
	}

	private applyFog(target: StageTarget = "all"): void {
		const updateGroup = (emitters: ParticleEmitter[], enabled: boolean, intensity: number) => {
			const isEffectivelyOn = enabled && intensity > 0.01;
			const tStart = math.clamp(0.94 - intensity * 0.30, 0.64, 0.96);
			const tMid = math.clamp(0.97 - intensity * 0.18, 0.79, 0.98);
			const fogTransSeq = new NumberSequence([
				new NumberSequenceKeypoint(0.0, tStart),
				new NumberSequenceKeypoint(0.4, tMid),
				new NumberSequenceKeypoint(1.0, 1.0),
			]);
			const rate = isEffectivelyOn ? math.clamp(intensity * 9, 1, 10) : 0;

			for (const emitter of emitters) {
				emitter.Enabled = isEffectivelyOn;
				emitter.Rate = rate;
				emitter.Transparency = fogTransSeq;
				emitter.SpreadAngle = new Vector2(90, 45);
				emitter.Speed = new NumberRange(1.5, 3.5);
				emitter.Acceleration = new Vector3(0, 0.25, 0);
				emitter.Drag = 3.0;
				emitter.LightEmission = 0;
				emitter.LightInfluence = 0.35;
			}
		};

		if (target === "main" || target === "all") {
			const enabled = this.mainControlState.fogEnabled ?? false;
			const intensity = this.mainControlState.fogIntensity ?? 0.5;
			updateGroup(this.mainFogEmitters, enabled, intensity);
		}

		if (target === "dj" || target === "all") {
			const enabled = this.djControlState.fogEnabled ?? false;
			const intensity = this.djControlState.fogIntensity ?? 0.5;
			updateGroup(this.djFogEmitters, enabled, intensity);
		}
	}

	public triggerFogBurst(target: StageTarget = "all"): void {
		if (target === "main" || target === "all") {
			for (const emitter of this.mainFogEmitters) {
				emitter.Emit(12);
			}
		}
		if (target === "dj" || target === "all") {
			for (const emitter of this.djFogEmitters) {
				emitter.Emit(12);
			}
		}
	}

	/**
	 * Loop runtime Heartbeat untuk eksekusi animasi Main Stage dan DJ Stage secara independen
	 */
	private onHeartbeat(dt: number): void {
		this.animationTime += dt;

		// ─── 1. ANIMASI MAIN STAGE ────────────────────────────────────────────────
		this.processStageHeartbeat(
			dt,
			this.mainFixtures,
			this.mainControlState,
			false,
			this.mainStrobeTimer,
			this.mainStrobeState,
			this.mainPulseTime,
			(timer, state, pulse) => {
				this.mainStrobeTimer = timer;
				this.mainStrobeState = state;
				this.mainPulseTime = pulse;
			},
		);

		// ─── 2. ANIMASI DJ STAGE ──────────────────────────────────────────────────
		this.processStageHeartbeat(
			dt,
			this.djFixtures,
			this.djControlState,
			true,
			this.djStrobeTimer,
			this.djStrobeState,
			this.djPulseTime,
			(timer, state, pulse) => {
				this.djStrobeTimer = timer;
				this.djStrobeState = state;
				this.djPulseTime = pulse;
			},
		);
	}

	private processStageHeartbeat(
		dt: number,
		fixtures: StageLightFixture[],
		state: StageLightingControlPayload,
		isDj: boolean,
		strobeTimer: number,
		strobeState: boolean,
		pulseTime: number,
		updateTimers: (timer: number, state: boolean, pulse: number) => void,
	): void {
		if (state.mode === StageLightMode.Off) return;

		// SINKRONISASI MUSIK
		if (state.mode === StageLightMode.MusicSync || state.isMusicSync) {
			const musicService = ServerMusicService.getInstance();
			const track = musicService.getCurrentTrack();
			const musicState = musicService.getPlaybackState();

			if (musicState !== MusicPlayerState.Playing) {
				this.applyCenterFocusAngles(isDj);
				for (const f of fixtures) {
					if (f.spotLight) {
						f.spotLight.Brightness = 0.8;
						f.spotLight.Enabled = true;
					}
					if (f.beam) f.beam.Enabled = true;
					if (f.lensPart) f.lensPart.Material = Enum.Material.Neon;
				}
				updateTimers(strobeTimer, strobeState, pulseTime);
				return;
			}

			let activeColor = state.color;
			if (state.isRainbow) {
				const hue = (this.animationTime * 0.1) % 1;
				activeColor = Color3.fromHSV(hue, 0.9, 1);
			}

			const seq = new ColorSequence(activeColor);
			for (const f of fixtures) {
				if (f.spotLight && f.spotLight.Color !== activeColor) {
					f.spotLight.Color = activeColor;
				}
				if (f.beam) {
					f.beam.Color = seq;
				}
				if (f.lensPart && f.lensPart.Color !== activeColor) {
					f.lensPart.Color = activeColor;
				}
			}
			updateTimers(strobeTimer, strobeState, pulseTime);
			return;
		}

		// STANDALONE EFFECTS
		if (state.isRainbow) {
			const hue = (this.animationTime * 0.15) % 1;
			const dynamicColor = Color3.fromHSV(hue, 0.9, 1);
			const seq = new ColorSequence(dynamicColor);
			for (const f of fixtures) {
				if (f.spotLight) f.spotLight.Color = dynamicColor;
				if (f.beam) f.beam.Color = seq;
				if (f.lensPart) f.lensPart.Color = dynamicColor;
			}
		}

		if (state.isPulse && state.strobeSpeed === 0) {
			pulseTime += dt * 3;
			const pulseFactor = (math.sin(pulseTime) + 1) / 2;
			const pulsedBrightness = math.max(0.2, state.brightness * (0.2 + 0.8 * pulseFactor));
			for (const f of fixtures) {
				if (f.spotLight) f.spotLight.Brightness = pulsedBrightness;
			}
		}

		const strobeSpeed = state.mode === StageLightMode.Strobe ? 2 : state.strobeSpeed;
		if (strobeSpeed > 0) {
			strobeTimer += dt;
			const threshold = strobeSpeed === 1 ? 0.2 : strobeSpeed === 2 ? 0.1 : 0.05;
			if (strobeTimer >= threshold) {
				strobeTimer = 0;
				strobeState = !strobeState;

				const b = strobeState ? state.brightness * 1.4 : 0;
				for (const f of fixtures) {
					if (f.spotLight) f.spotLight.Brightness = b;
					if (f.beam) f.beam.Enabled = strobeState && state.beamEnabled;
				}
			}
		}

		// MOTIONS
		if (state.mode === StageLightMode.Wave) {
			for (const f of fixtures) {
				const [basePan, baseTilt] = this.getFixtureAim(f, isDj);
				const panAmp = isDj ? 0.35 : 0.50;
				const tiltAmp = isDj ? 0.20 : 0.32;
				const pan = math.sin(this.animationTime * 0.9) * panAmp;
				const tilt = math.sin(this.animationTime * 2.2 - (f.column - 1) * 0.95) * tiltAmp;
				this.applyFixtureAngles(f, basePan + pan, baseTilt + tilt, isDj);
			}
		} else if (state.mode === StageLightMode.Circle) {
			for (const f of fixtures) {
				const [basePan, baseTilt] = this.getFixtureAim(f, isDj);
				const panAmp = isDj ? 0.32 : 0.45;
				const tiltAmp = isDj ? 0.18 : 0.26;
				const dir = f.column % 2 === 1 ? 1 : -1;
				const phase = f.column * 0.75;
				const pan = math.cos(this.animationTime * 1.8 * dir + phase) * panAmp;
				const tilt = math.sin(this.animationTime * 1.8 * dir + phase) * tiltAmp;
				this.applyFixtureAngles(f, basePan + pan, baseTilt + tilt, isDj);
			}
		} else if (state.mode === StageLightMode.Ballyhoo) {
			for (const f of fixtures) {
				const [basePan, baseTilt] = this.getFixtureAim(f, isDj);
				const panAmp = isDj ? 0.38 : 0.58;
				const tiltAmp = isDj ? 0.20 : 0.28;
				const phaseOffset = f.column * 0.5;
				const pan = math.sin(this.animationTime * 2.6 + phaseOffset) * panAmp;
				const tilt = math.sin((this.animationTime * 2.6 + phaseOffset) * 2.0) * tiltAmp;
				this.applyFixtureAngles(f, basePan + pan, baseTilt + tilt, isDj);
			}
		} else if (state.mode === StageLightMode.CrossFire) {
			for (const f of fixtures) {
				const [basePan, baseTilt] = this.getFixtureAim(f, isDj);
				const mid = (fixtures.size() + 1) / 2;
				const colNorm = (f.column - mid) / 2;
				const scissorWave = math.sin(this.animationTime * 1.6);
				const pan = -colNorm * 0.55 * scissorWave;
				const tilt = -math.abs(scissorWave) * (isDj ? 0.14 : 0.22);
				this.applyFixtureAngles(f, basePan + pan, baseTilt + tilt, isDj);
			}
		} else if (state.mode === StageLightMode.FanSpread) {
			for (const f of fixtures) {
				const [basePan, baseTilt] = this.getFixtureAim(f, isDj);
				const mid = (fixtures.size() + 1) / 2;
				const fanSpread = (f.column - mid) * (isDj ? 0.18 : 0.28);
				const breath = math.sin(this.animationTime * 1.3);
				const pan = fanSpread * (1.1 + 0.45 * breath);
				const tilt = math.cos(this.animationTime * 1.3) * (isDj ? 0.18 : 0.26);
				this.applyFixtureAngles(f, basePan + pan, baseTilt + tilt, isDj);
			}
		} else if (state.mode === StageLightMode.Searchlight) {
			for (const f of fixtures) {
				const [basePan, baseTilt] = this.getFixtureAim(f, isDj);
				const pan = math.sin(this.animationTime * 0.6 + f.column * 1.25) * (isDj ? 0.40 : 0.65);
				const tilt = (math.cos(this.animationTime * 0.85 + f.column * 0.9) - 0.2) * (isDj ? 0.18 : 0.28);
				this.applyFixtureAngles(f, basePan + pan, baseTilt + tilt, isDj);
			}
		} else if (state.mode === StageLightMode.SpotlightCenter) {
			this.applyCenterFocusAngles(isDj);
		} else if (state.mode === StageLightMode.Static) {
			this.applyStaticAngles(isDj);
		}

		updateTimers(strobeTimer, strobeState, pulseTime);
	}

	public getControlState(target: "main" | "dj" = "main"): StageLightingControlPayload {
		return target === "dj" ? { ...this.djControlState } : { ...this.mainControlState };
	}

	public getMainControlState(): StageLightingControlPayload {
		return { ...this.mainControlState };
	}

	public getDjControlState(): StageLightingControlPayload {
		return { ...this.djControlState };
	}

	public getMode(target: "main" | "dj" = "main"): StageLightMode {
		return target === "dj" ? this.djControlState.mode : this.mainControlState.mode;
	}

	public getFixturesCount(): number {
		return this.mainFixtures.size() + this.djFixtures.size();
	}

	public getMainFixturesCount(): number {
		return this.mainFixtures.size();
	}

	public getDjFixturesCount(): number {
		return this.djFixtures.size();
	}

	public destroy(): void {
		if (this.heartbeatConnection) {
			this.heartbeatConnection.Disconnect();
			this.heartbeatConnection = undefined;
		}
		this.setMode(StageLightMode.Off, "all");
	}
}
