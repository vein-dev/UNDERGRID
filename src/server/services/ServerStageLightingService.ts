import { CollectionService, RunService, Workspace } from "@rbxts/services";
import { MusicPlayerState, StageLightFixture, StageLightMode, StageLightingControlPayload } from "shared/types";
import { ServerMusicService } from "./ServerMusicService";

/**
 * ServerStageLightingService
 * Layanan server otoritatif untuk mengontrol 40 moving light konser di workspace.Lighting.
 * Mendukung sinkronisasi musik real-time (BPM Tempo-Locked Wave & Beat Flash),
 * kontrol Pan/Tilt, warna RGB dinamis, dan efek pencahayaan panggung.
 */
const BASE_PAN_C0 = new CFrame(0.0285873413, -0.258911133, -0.00492858887, 1, 0, 0, 0, 0, 1, 0, -1, 0);
const BASE_TILT_C0 = new CFrame(0.0239474773, -0.515777588, -0.00769042969, 1, 0, 0, 0, -1, 0, 0, 0, -1);

export class ServerStageLightingService {
	private static instance?: ServerStageLightingService;

	private isInitialized = false;
	private fixtures: StageLightFixture[] = [];

	private controlState: StageLightingControlPayload = {
		mode: StageLightMode.SpotlightCenter,
		panAngle: 0,
		tiltAngle: 0,
		motorSpeed: 0.04,
		color: Color3.fromRGB(180, 240, 255),
		brightness: 4.5,
		beamEnabled: true,
		strobeSpeed: 0,
		isRainbow: false,
		isPulse: false,
		isMusicSync: false,
	};

	private animationTime = 0;
	private strobeTimer = 0;
	private strobeState = false;
	private pulseTime = 0;

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
		this.setMode(this.controlState.mode);

		// Sambungkan Heartbeat loop untuk update animasi motor, warna, dan efek
		this.heartbeatConnection = RunService.Heartbeat.Connect((dt) => {
			this.onHeartbeat(dt);
		});

		print(`[ServerStageLightingService] Initialized with ${this.fixtures.size()} stage light fixtures.`);
	}

	/**
	 * Memuat dan mengindeks seluruh fixture dari workspace.Lighting
	 */
	public loadFixtures(): void {
		this.fixtures.clear();
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

			const colAttr = inst.GetAttribute("Column");
			const rowAttr = inst.GetAttribute("Row");

			let col = typeIs(colAttr, "number") ? colAttr : 1;
			let row = typeIs(rowAttr, "number") ? rowAttr : 1;

			if (!typeIs(colAttr, "number")) {
				const match = inst.Name.match("StageLight_C(%d+)_R(%d+)");
				if (match[0] && match[1]) {
					col = tonumber(match[0]) || 1;
					row = tonumber(match[1]) || 1;
				}
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
				// Pastikan base tetap menempel di truss
				if (base) {
					base.Anchored = true;
				}

				// Bagian bergerak HARUS unanchored agar Motor6D dapat memutar kepala lampu
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

				// Kalibrasi agar sinar lampu atmosferik pas di lantai panggung tanpa tembus jauh
				if (spotLight) {
					spotLight.Face = Enum.NormalId.Front;
					spotLight.Range = 28;
					spotLight.Angle = 55;
					spotLight.Shadows = true;
				}
				if (beam) {
					beam.Width0 = 0.9;
					beam.Width1 = 9.5;
					beam.LightEmission = 1;
					beam.LightInfluence = 0;
					beam.Transparency = new NumberSequence([
						new NumberSequenceKeypoint(0, 0.1),
						new NumberSequenceKeypoint(0.5, 0.45),
						new NumberSequenceKeypoint(1, 1.0),
					]);
					if (beam.Attachment0) {
						beam.Attachment0.Position = new Vector3(0, 0, -0.2);
					}
					if (beam.Attachment1) {
						beam.Attachment1.Position = new Vector3(0, 0, -18);
					}
				}

				// Reset joint internal angles agar rotasi murni dikendalikan via C0 tanpa drift fisik
				panMotor.DesiredAngle = 0;
				panMotor.CurrentAngle = 0;
				panMotor.MaxVelocity = 0;
				tiltMotor.DesiredAngle = 0;
				tiltMotor.CurrentAngle = 0;
				tiltMotor.MaxVelocity = 0;

				this.fixtures.push({
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
				});
			}
		}

		// Sortir fixtures dari kiri ke kanan (sumbu X) agar efek Wave/Chase mengalir sesuai posisi panggung
		this.fixtures.sort((a, b) => {
			const posA = a.model.GetPivot().Position.X;
			const posB = b.model.GetPivot().Position.X;
			return posA < posB;
		});

		// Berikan nomor kolom 1..N dari kiri ke kanan
		for (let i = 0; i < this.fixtures.size(); i++) {
			this.fixtures[i].column = i + 1;
		}
	}

	/**
	 * Memutar motor Pan dan Tilt menggunakan Motor6D.C0 (dengan batas aman fokus panggung)
	 */
	private applyFixtureAngles(f: StageLightFixture, panAngle: number, tiltAngle: number): void {
		// Strict clamp untuk Tilt agar 100% fokus ke panggung dan TIDAK PERNAH menyorot ke atas
		const clampedTilt = math.clamp(tiltAngle, -0.92, -0.52);
		f.panMotor.C0 = f.initialPanC0.mul(CFrame.Angles(0, 0, panAngle));
		f.tiltMotor.C0 = f.initialTiltC0.mul(CFrame.Angles(0, 0, clampedTilt));
	}

	/**
	 * Menerapkan konfigurasi kontrol parsial atau penuh
	 */
	public applyControl(payload: Partial<StageLightingControlPayload>): void {
		if (payload.mode !== undefined) {
			this.setMode(payload.mode);
		}
		if (payload.panAngle !== undefined) {
			this.controlState.panAngle = payload.panAngle;
			if (this.controlState.mode === StageLightMode.Manual) {
				for (const f of this.fixtures) {
					const [basePan, baseTilt] = this.getFixtureMicAim(f);
					this.applyFixtureAngles(f, basePan + payload.panAngle, baseTilt + this.controlState.tiltAngle);
				}
			}
		}
		if (payload.tiltAngle !== undefined) {
			this.controlState.tiltAngle = payload.tiltAngle;
			if (this.controlState.mode === StageLightMode.Manual) {
				for (const f of this.fixtures) {
					const [basePan, baseTilt] = this.getFixtureMicAim(f);
					this.applyFixtureAngles(f, basePan + this.controlState.panAngle, baseTilt + payload.tiltAngle);
				}
			}
		}
		if (payload.motorSpeed !== undefined) {
			this.controlState.motorSpeed = math.clamp(payload.motorSpeed, 0.01, 0.1);
		}
		if (payload.color !== undefined) {
			this.setColor(payload.color);
		}
		if (payload.brightness !== undefined) {
			this.controlState.brightness = payload.brightness;
			this.updateIntensity();
		}
		if (payload.beamEnabled !== undefined) {
			this.controlState.beamEnabled = payload.beamEnabled;
			this.updateIntensity();
		}
		if (payload.strobeSpeed !== undefined) {
			this.controlState.strobeSpeed = payload.strobeSpeed;
		}
		if (payload.isRainbow !== undefined) {
			this.controlState.isRainbow = payload.isRainbow;
			if (!payload.isRainbow) {
				this.setColor(this.controlState.color);
			}
		}
		if (payload.isPulse !== undefined) {
			this.controlState.isPulse = payload.isPulse;
			if (!payload.isPulse) {
				this.updateIntensity();
			}
		}
		if (payload.isMusicSync !== undefined) {
			this.controlState.isMusicSync = payload.isMusicSync;
			if (payload.isMusicSync) {
				this.controlState.mode = StageLightMode.MusicSync;
			}
		}
		this.syncAttributes();
	}

	private syncAttributes(): void {
		const folder = Workspace.FindFirstChild("Lighting");
		if (folder) {
			folder.SetAttribute("StageLightingMode", this.controlState.mode);
			folder.SetAttribute("IsMusicSync", this.controlState.isMusicSync);
			folder.SetAttribute("StageLightingBrightness", this.controlState.brightness);
			folder.SetAttribute("StageLightingBeamEnabled", this.controlState.beamEnabled);
			folder.SetAttribute("StageLightingStrobeSpeed", this.controlState.strobeSpeed);
		}
	}

	/**
	 * Mengubah mode operasional utama stage lighting
	 */
	public setMode(mode: StageLightMode): void {
		this.controlState.mode = mode;
		this.controlState.isMusicSync = mode === StageLightMode.MusicSync;
		this.syncAttributes();
		print(`[ServerStageLightingService] Mode set to: ${mode}`);

		switch (mode) {
			case StageLightMode.Off:
				this.resetMotors();
				this.updateIntensity();
				break;

			case StageLightMode.Static:
				this.applyStaticAngles();
				this.updateIntensity();
				break;

			case StageLightMode.SpotlightCenter:
				this.applyCenterFocusAngles();
				this.updateIntensity();
				break;

			case StageLightMode.Manual:
				for (const f of this.fixtures) {
					const [basePan, baseTilt] = this.getFixtureMicAim(f);
					this.applyFixtureAngles(f, basePan + this.controlState.panAngle, baseTilt + this.controlState.tiltAngle);
				}
				this.updateIntensity();
				break;

			case StageLightMode.MusicSync:
			case StageLightMode.Wave:
			case StageLightMode.Ballyhoo:
			case StageLightMode.Circle:
			case StageLightMode.Strobe:
				this.updateIntensity();
				break;
		}
	}

	/**
	 * Mengatur warna seluruh Beam, SpotLight, dan Lens
	 */
	public setColor(color: Color3): void {
		this.controlState.color = color;
		const colorSeq = new ColorSequence(color);

		for (const f of this.fixtures) {
			if (f.spotLight) f.spotLight.Color = color;
			if (f.beam) f.beam.Color = colorSeq;
			if (f.lensPart) f.lensPart.Color = color;
		}
	}

	/**
	 * Memperbarui intensitas cahaya berdasarkan mode dan konfigurasi
	 */
	private updateIntensity(): void {
		const isOff = this.controlState.mode === StageLightMode.Off;
		const targetBrightness = isOff ? 0 : this.controlState.brightness;
		const targetBeam = !isOff && this.controlState.beamEnabled;

		for (const f of this.fixtures) {
			if (f.spotLight) {
				f.spotLight.Brightness = targetBrightness;
				f.spotLight.Enabled = targetBrightness > 0;
			}
			if (f.beam) {
				f.beam.Enabled = targetBeam;
			}
			if (f.lensPart) {
				f.lensPart.Material = targetBeam ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
			}
		}
	}

	/**
	 * Sudut presisi hasil kalibrasi matematis ke game.Workspace.Mic (lensa dan sorot cahaya 100% sejajar ke panggung)
	 */
	private readonly micAims: Record<string, [number, number]> = {
		StageLight_C1_R01: [0.75, -0.836],
		StageLight_C1_R02: [0.466, -0.738],
		StageLight_C1_R03: [0.014, -0.682],
		StageLight_C1_R04: [-0.456, -0.732],
		StageLight_C1_R05: [-0.802, -0.86],
	};

	/**
	 * Mendapatkan sudut bidik acuan ke panggung & mic untuk fixture tertentu
	 */
	private getFixtureMicAim(f: StageLightFixture): [number, number] {
		const precomputed = this.micAims[f.model.Name];
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
	 * Mengembalikan motor ke posisi netral fokus panggung
	 */
	public resetMotors(): void {
		for (const f of this.fixtures) {
			const [basePan, baseTilt] = this.getFixtureMicAim(f);
			this.applyFixtureAngles(f, basePan, baseTilt);
		}
	}

	/**
	 * Fokuskan seluruh moving light ke titik tengah venue panggung dengan acuan game.Workspace.Mic
	 */
	private applyCenterFocusAngles(): void {
		for (const f of this.fixtures) {
			const [aimPan, aimTilt] = this.getFixtureMicAim(f);
			this.applyFixtureAngles(f, aimPan, aimTilt);
		}
	}

	/**
	 * Sudut panggung statis menyebar anggun (fanned out) berpusat dari mic
	 */
	private applyStaticAngles(): void {
		const total = this.fixtures.size();
		const mid = (total + 1) / 2;
		for (const f of this.fixtures) {
			const [basePan, baseTilt] = this.getFixtureMicAim(f);
			const panOffset = (f.column - mid) * 0.18;
			const tiltOffset = math.abs(f.column - mid) * 0.04;
			this.applyFixtureAngles(f, basePan + panOffset, baseTilt + tiltOffset);
		}
	}

	/**
	 * Loop runtime untuk mode beranimasi (MusicSync, Wave, Circle, Ballyhoo, Rainbow, Pulse, Strobe)
	 */
	private onHeartbeat(dt: number): void {
		if (this.controlState.mode === StageLightMode.Off) return;

		this.animationTime += dt;

		// ─── 1. MODE KHUSUS: SINKRONISASI MUSIK (AUDIO & BPM SYNC) ───────────────
		if (this.controlState.mode === StageLightMode.MusicSync || this.controlState.isMusicSync) {
			const musicService = ServerMusicService.getInstance();
			const track = musicService.getCurrentTrack();
			const musicState = musicService.getPlaybackState();
			const elapsed = musicService.getPlaybackPosition();

			// Jika musik tidak sedang dimainkan (di-pause / idle), istirahatkan lampu fokus tepat ke Mic
			if (musicState !== MusicPlayerState.Playing) {
				this.applyCenterFocusAngles();
				for (const f of this.fixtures) {
					if (f.spotLight) {
						f.spotLight.Brightness = 0.8;
						f.spotLight.Enabled = true;
					}
					if (f.beam) f.beam.Enabled = true;
					if (f.lensPart) f.lensPart.Material = Enum.Material.Neon;
				}
				return;
			}

			// Mode Reaktif Otomatis (Metode 2): Server hanya menyinkronkan warna dasar.
			// Seluruh respons tempo, hentakan bass, akselerasi intro/reff, dan visual beat
			// dikendalikan murni oleh Sound.PlaybackLoudness di client tanpa timeline BPM statis.
			let activeColor = this.controlState.color;
			if (!this.controlState.isRainbow && track) {
				activeColor = track.coverColor;
			} else if (this.controlState.isRainbow) {
				const hue = (this.animationTime * 0.1) % 1;
				activeColor = Color3.fromHSV(hue, 0.9, 1);
			}

			const seq = new ColorSequence(activeColor);

			// Sinkronisasi warna cover track / rainbow di server tanpa mengunci Enabled (agar optical shutter strobo client berjalan mulus)
			for (const f of this.fixtures) {
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
			return;
		}

		// ─── 2. MODE NON-MUSIK (STANDALONE EFFECTS) ──────────────────────────────

		// Rainbow RGB Cycle Effect
		if (this.controlState.isRainbow) {
			const hue = (this.animationTime * 0.15) % 1;
			const dynamicColor = Color3.fromHSV(hue, 0.9, 1);
			const seq = new ColorSequence(dynamicColor);
			for (const f of this.fixtures) {
				if (f.spotLight) f.spotLight.Color = dynamicColor;
				if (f.beam) f.beam.Color = seq;
				if (f.lensPart) f.lensPart.Color = dynamicColor;
			}
		}

		// Pulse / Breathing Effect
		if (this.controlState.isPulse && this.controlState.strobeSpeed === 0) {
			this.pulseTime += dt * 3;
			const pulseFactor = (math.sin(this.pulseTime) + 1) / 2; // 0 s/d 1
			const pulsedBrightness = math.max(0.2, this.controlState.brightness * (0.2 + 0.8 * pulseFactor));
			for (const f of this.fixtures) {
				if (f.spotLight) f.spotLight.Brightness = pulsedBrightness;
			}
		}

		// Strobe Effect (Multi-speed)
		const strobeSpeed = this.controlState.mode === StageLightMode.Strobe ? 2 : this.controlState.strobeSpeed;
		if (strobeSpeed > 0) {
			this.strobeTimer += dt;
			const threshold = strobeSpeed === 1 ? 0.2 : strobeSpeed === 2 ? 0.1 : 0.05;
			if (this.strobeTimer >= threshold) {
				this.strobeTimer = 0;
				this.strobeState = !this.strobeState;

				const b = this.strobeState ? this.controlState.brightness * 1.4 : 0;
				for (const f of this.fixtures) {
					if (f.spotLight) f.spotLight.Brightness = b;
					if (f.beam) f.beam.Enabled = this.strobeState && this.controlState.beamEnabled;
				}
			}
		}

		// Pergerakan Motor Berdasarkan Mode Preset (Berpusat di Acuan Mic Panggung)
		if (this.controlState.mode === StageLightMode.Wave) {
			for (const f of this.fixtures) {
				const [basePan, baseTilt] = this.getFixtureMicAim(f);
				const colWave = math.sin(this.animationTime * 1.5 + f.column * 0.6) * 0.35;
				const rowWave = math.cos(this.animationTime * 1.8 + f.column * 0.4) * 0.18;

				this.applyFixtureAngles(f, basePan + colWave, baseTilt + rowWave);
			}
		} else if (this.controlState.mode === StageLightMode.Circle) {
			for (const f of this.fixtures) {
				const [basePan, baseTilt] = this.getFixtureMicAim(f);
				const phase = f.column * 0.65;
				const pan = math.cos(this.animationTime * 2.0 + phase) * 0.3;
				const tilt = math.sin(this.animationTime * 2.0 + phase) * 0.18;

				this.applyFixtureAngles(f, basePan + pan, baseTilt + tilt);
			}
		} else if (this.controlState.mode === StageLightMode.Ballyhoo) {
			for (const f of this.fixtures) {
				const [basePan, baseTilt] = this.getFixtureMicAim(f);
				const fastPan = math.sin(this.animationTime * 2.6 + f.column * 1.1) * 0.55;
				const fastTilt = math.sin(this.animationTime * 2.0 + f.column * 1.3) * 0.22;

				this.applyFixtureAngles(f, basePan + fastPan, baseTilt + fastTilt);
			}
		}
	}

	public getControlState(): StageLightingControlPayload {
		return { ...this.controlState };
	}

	public getMode(): StageLightMode {
		return this.controlState.mode;
	}

	public getFixturesCount(): number {
		return this.fixtures.size();
	}

	public destroy(): void {
		if (this.heartbeatConnection) {
			this.heartbeatConnection.Disconnect();
			this.heartbeatConnection = undefined;
		}
		this.setMode(StageLightMode.Off);
	}
}
