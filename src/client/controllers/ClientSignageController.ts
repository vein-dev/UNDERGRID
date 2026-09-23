import { CollectionService, Lighting, RunService, Workspace } from "@rbxts/services";
import { FlickeringNeonComponent } from "client/components/FlickeringNeonComponent";


const FLICKERING_NEON_TAG = "FlickeringNeon";

/**
 * ClientSignageController
 * Manager / Orchestrator terpusat untuk template `FlickeringNeon`:
 * 1. Mendeteksi seluruh Model / BasePart yang ditag `FlickeringNeon` di map secara otomatis.
 * 2. Mengaitkan komponen `FlickeringNeonComponent` secara dinamis (mendukung StreamingEnabled & lifecycle cleanup).
 * 3. Otomatis memberi tag pada `game.Workspace.Signane` jika ditemukan agar kompatibel mundur tanpa konfigurasi manual.
 * 4. Menjalankan 1 central RenderStepped loop berkinerja tinggi untuk mengupdate seluruh signage bertag secara serempak.
 */
export class ClientSignageController {
	private static instance?: ClientSignageController;

	private isInitialized = false;
	private components = new Map<Instance, FlickeringNeonComponent>();
	private connection?: RBXScriptConnection;

	private constructor() {}

	public static getInstance(): ClientSignageController {
		if (!ClientSignageController.instance) {
			ClientSignageController.instance = new ClientSignageController();
		}
		return ClientSignageController.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		// 1. Tag otomatis Workspace.Signane jika ada
		this.ensureSignaneTagged();
		Workspace.DescendantAdded.Connect((desc) => {
			if (desc.Name === "Signane" || (desc.Parent && desc.Parent.Name === "Signane")) {
				task.defer(() => this.ensureSignaneTagged());
			}
		});

		// 2. Daftarkan instance yang sudah memiliki tag saat ini
		for (const inst of CollectionService.GetTagged(FLICKERING_NEON_TAG)) {
			this.registerInstance(inst);
		}

		// 3. Dengarkan event penambahan/penghapusan tag secara dinamis
		CollectionService.GetInstanceAddedSignal(FLICKERING_NEON_TAG).Connect((inst) => {
			this.registerInstance(inst);
		});

		CollectionService.GetInstanceRemovedSignal(FLICKERING_NEON_TAG).Connect((inst) => {
			this.unregisterInstance(inst);
		});

		// 4. Central RenderStepped loop (60+ FPS, zero lag)
		this.connection = RunService.RenderStepped.Connect(() => {
			this.onRenderStepped();
		});

		print(
			`[ClientSignageController] Initialized: Template Tag "${FLICKERING_NEON_TAG}" active with Day/Night sync.`,
		);
	}

	private ensureSignaneTagged(): void {
		const signane = Workspace.FindFirstChild("Signane") as Model | undefined;
		if (signane && !CollectionService.HasTag(signane, FLICKERING_NEON_TAG)) {
			CollectionService.AddTag(signane, FLICKERING_NEON_TAG);
		}
	}

	private registerInstance(instance: Instance): void {
		if (this.components.has(instance)) return;
		const comp = new FlickeringNeonComponent(instance);
		this.components.set(instance, comp);
	}

	private unregisterInstance(instance: Instance): void {
		const comp = this.components.get(instance);
		if (comp) {
			comp.destroy();
			this.components.delete(instance);
		}
	}

	private onRenderStepped(): void {
		const now = os.clock();
		const clockTime = Lighting.ClockTime;

		this.components.forEach((comp, inst) => {
			if (!inst.Parent) {
				comp.destroy();
				this.components.delete(inst);
				return;
			}
			comp.update(now, clockTime);
		});
	}

	public destroy(): void {
		this.connection?.Disconnect();
		this.connection = undefined;

		this.components.forEach((comp) => {
			comp.destroy();
		});
		this.components.clear();

		ClientSignageController.instance = undefined;
	}
}


