/**
 * NpcHeadFollowController.ts
 * Pengendali gerak kepala NPC (Head Tracking / Look-At) di client.
 * Memungkinkan kepala NPC menoleh dan menatap pemain terdekat secara realistis dan halus (Lerp).
 */

import { CollectionService, Players, RunService, Workspace } from "@rbxts/services";
import { NPC_CONFIG } from "shared/config";

interface TrackedNpc {
	model: Model;
	humanoid: Humanoid;
	head: BasePart;
	neck: Motor6D;
	part0: BasePart;
	originalC0: CFrame;
	isReset: boolean;
}

export class NpcHeadFollowController {
	private static instance?: NpcHeadFollowController;

	private trackedNpcs = new Map<Model, TrackedNpc>();
	private heartbeatConn?: RBXScriptConnection;
	private localPlayer = Players.LocalPlayer;

	private readonly config = NPC_CONFIG.HEAD_TRACKING;
	private readonly maxYawRad = math.rad(NPC_CONFIG.HEAD_TRACKING.MAX_YAW_DEG);
	private readonly maxPitchRad = math.rad(NPC_CONFIG.HEAD_TRACKING.MAX_PITCH_DEG);

	private constructor() {}

	public static getInstance(): NpcHeadFollowController {
		if (!NpcHeadFollowController.instance) {
			NpcHeadFollowController.instance = new NpcHeadFollowController();
		}
		return NpcHeadFollowController.instance;
	}

	public init(): void {
		if (!this.config.ENABLED) {
			print("[NpcHeadFollowController] Head tracking dinonaktifkan di konfigurasi.");
			return;
		}

		// 1. Pindai NPC yang sudah ada di Workspace
		this.scanExistingNpcs();

		// 2. Dengarkan kemunculan NPC baru di folder Workspace.NPC
		const npcFolder = Workspace.FindFirstChild("NPC");
		if (npcFolder) {
			npcFolder.ChildAdded.Connect((child) => {
				if (child.IsA("Model")) {
					task.delay(0.5, () => this.registerNpc(child));
				}
			});
		}

		// Dengarkan juga jika folder NPC baru dibuat belakangan
		Workspace.ChildAdded.Connect((child) => {
			if (child.Name === "NPC") {
				child.ChildAdded.Connect((npcModel) => {
					if (npcModel.IsA("Model")) {
						task.delay(0.5, () => this.registerNpc(npcModel));
					}
				});
				for (const desc of child.GetChildren()) {
					if (desc.IsA("Model")) {
						this.registerNpc(desc);
					}
				}
			}
		});

		// 3. Dukung tag CollectionService "NPC" atau "HeadTracking"
		CollectionService.GetInstanceAddedSignal("NPC").Connect((inst) => {
			if (inst.IsA("Model")) this.registerNpc(inst);
		});
		CollectionService.GetInstanceAddedSignal("HeadTracking").Connect((inst) => {
			if (inst.IsA("Model")) this.registerNpc(inst);
		});

		// 4. Jalankan loop kalkulasi per-frame di RenderStepped (sangat halus di client)
		this.heartbeatConn = RunService.RenderStepped.Connect((dt) => {
			this.onRenderStep(dt);
		});

		// 5. Polling berkala untuk menangani StreamingEnabled (NPC yang baru masuk radius streaming pemain)
		task.spawn(() => {
			while (true) {
				task.wait(1.5);
				this.scanExistingNpcs();
			}
		});

		print("[NpcHeadFollowController] Initialized realistic NPC head follow controller.");
	}

	/**
	 * Memindai NPC yang sudah ada di workspace saat inisialisasi
	 */
	private scanExistingNpcs(): void {
		const scan = () => {
			const npcFolder = Workspace.FindFirstChild("NPC");
			if (npcFolder) {
				for (const child of npcFolder.GetChildren()) {
					if (child.IsA("Model")) {
						this.registerNpc(child);
					}
				}
			}

			for (const tagged of CollectionService.GetTagged("NPC")) {
				if (tagged.IsA("Model")) this.registerNpc(tagged);
			}
			for (const tagged of CollectionService.GetTagged("HeadTracking")) {
				if (tagged.IsA("Model")) this.registerNpc(tagged);
			}
		};

		scan();
		// Antisipasi replication / streaming di detik-detik awal gameplay
		task.delay(0.8, scan);
		task.delay(2.0, scan);
		task.delay(4.0, scan);
	}

	/**
	 * Mendaftarkan model NPC untuk diikuti kepalanya
	 */
	public registerNpc(model: Model): void {
		if (this.trackedNpcs.has(model)) return;

		const humanoid = model.FindFirstChildOfClass("Humanoid");
		const head = model.FindFirstChild("Head") as BasePart | undefined;
		if (!humanoid || !head) return;

		// Pastikan leher dan part tubuh tidak anchored agar Motor6D dapat berputar bebas
		const hrp = (model.FindFirstChild("HumanoidRootPart") ??
			model.FindFirstChild("Torso")) as BasePart | undefined;
		if (hrp) {
			hrp.Anchored = true;
		}
		for (const desc of model.GetDescendants()) {
			if (desc.IsA("BasePart") && desc !== hrp) {
				desc.Anchored = false;
			}
		}

		// Cari sendi Motor6D bernama "Neck" (baik R6 maupun R15)
		let neck = head.FindFirstChild("Neck") as Motor6D | undefined;
		if (!neck || !neck.IsA("Motor6D")) {
			const upperTorso = model.FindFirstChild("UpperTorso") as BasePart | undefined;
			if (upperTorso) {
				neck = upperTorso.FindFirstChild("Neck") as Motor6D | undefined;
			}
		}
		if (!neck || !neck.IsA("Motor6D")) {
			const torso = model.FindFirstChild("Torso") as BasePart | undefined;
			if (torso) {
				neck = torso.FindFirstChild("Neck") as Motor6D | undefined;
			}
		}
		if (!neck || !neck.IsA("Motor6D")) {
			const found = model.FindFirstChild("Neck", true);
			if (found && found.IsA("Motor6D")) {
				neck = found;
			}
		}

		if (!neck || !neck.Part0 || !neck.Part1) return;

		const part0 = neck.Part0 as BasePart;
		const originalC0 = neck.C0;

		const tracked: TrackedNpc = {
			model,
			humanoid,
			head,
			neck,
			part0,
			originalC0,
			isReset: true,
		};

		this.trackedNpcs.set(model, tracked);
		print(`[NpcHeadFollowController] Successfully registered NPC for head tracking: ${model.Name}`);

		// Cleanup jika model dihapus dari Workspace
		model.Destroying.Connect(() => {
			this.trackedNpcs.delete(model);
		});
	}

	/**
	 * Mengambil posisi target pemain lokal (Kepala atau Kamera)
	 */
	private getPlayerTargetPosition(): Vector3 | undefined {
		const char = this.localPlayer.Character;
		if (!char) return undefined;

		const head = char.FindFirstChild("Head") as BasePart | undefined;
		if (head) return head.Position;

		const rootPart = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (rootPart) return rootPart.Position.add(new Vector3(0, 1.5, 0));

		const camera = Workspace.CurrentCamera;
		return camera ? camera.CFrame.Position : undefined;
	}

	/**
	 * Update rotasi leher per-frame
	 */
	private onRenderStep(dt: number): void {
		const targetPos = this.getPlayerTargetPosition();
		if (!targetPos) return;

		const maxDist = this.config.MAX_DISTANCE;
		const lerpAlpha = math.clamp(dt * this.config.LERP_SPEED, 0, 1);

		for (const [model, data] of this.trackedNpcs) {
			// Lewati jika model sudah mati atau dihapus
			if (!model.Parent || data.humanoid.Health <= 0) {
				continue;
			}

			const headPos = data.head.Position;
			const distance = headPos.sub(targetPos).Magnitude;

			if (distance <= maxDist) {
				// Hitung arah relatif pemain dalam Part0 (Torso) Object Space
				const part0CFrame = data.part0.CFrame;
				const localTarget = part0CFrame.PointToObjectSpace(targetPos);

				// Yaw (horizontal: kiri / kanan)
				const angleYaw = math.atan2(-localTarget.X, -localTarget.Z);

				// Pitch (vertikal: atas / bawah)
				const horizDist = math.sqrt(localTarget.X * localTarget.X + localTarget.Z * localTarget.Z);
				const anglePitch = math.atan2(localTarget.Y, horizDist);

				// Cek apakah pemain berada di luar batas toleh wajar (misal: di balik punggung NPC)
				if (math.abs(angleYaw) <= this.maxYawRad) {
					// Batasi sudut agar leher tidak terkilir
					const clampedYaw = math.clamp(angleYaw, -this.maxYawRad, this.maxYawRad);
					const clampedPitch = math.clamp(anglePitch, -this.maxPitchRad, this.maxPitchRad);

					// Hitung C0 target: rotasikan di koordinat Part0 lalu pertahankan orientasi awal
					const rotationOffset = CFrame.Angles(0, clampedYaw, 0).mul(CFrame.Angles(clampedPitch, 0, 0));
					const targetC0 = new CFrame(data.originalC0.Position).mul(rotationOffset).mul(data.originalC0.Rotation);

					data.neck.C0 = data.neck.C0.Lerp(targetC0, lerpAlpha);
					data.isReset = false;
				} else {
					// Pemain berada di belakang NPC -> kembali ke posisi awal secara halus
					this.returnToOriginalC0(data, dt);
				}
			} else {
				// Pemain berada di luar jangkauan jarak
				if (!data.isReset) {
					this.returnToOriginalC0(data, dt);
				}
			}
		}
	}

	/**
	 * Mengembalikan C0 leher ke posisi semula secara halus
	 */
	private returnToOriginalC0(data: TrackedNpc, dt: number): void {
		// Gunakan kecepatan kembali yang halus dan rileks
		const returnAlpha = math.clamp(dt * (this.config.LERP_SPEED * 0.6), 0, 1);
		data.neck.C0 = data.neck.C0.Lerp(data.originalC0, returnAlpha);

		// Ukur selisih rotasi (LookVector & UpVector), BUKAN selisih posisi pivot
		const lookDiff = data.neck.C0.LookVector.sub(data.originalC0.LookVector).Magnitude;
		const upDiff = data.neck.C0.UpVector.sub(data.originalC0.UpVector).Magnitude;
		const rotDiff = lookDiff + upDiff;

		// Jika sudah sangat mendekati rotasi awal (< 0.01), kunci ke orientasi asli
		if (rotDiff < 0.01 && !data.isReset) {
			data.neck.C0 = data.originalC0;
			data.isReset = true;
		}
	}

	public destroy(): void {
		if (this.heartbeatConn) {
			this.heartbeatConn.Disconnect();
			this.heartbeatConn = undefined;
		}
		for (const [_, data] of this.trackedNpcs) {
			data.neck.C0 = data.originalC0;
		}
		this.trackedNpcs.clear();
	}
}
