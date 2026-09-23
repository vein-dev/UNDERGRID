import { CollectionService, RunService, Workspace } from "@rbxts/services";
import { StageBackdropGifComponent } from "client/components";

/**
 * ClientBackdropController
 * Controller client terpusat yang mengelola instance StageBackdropGifComponent
 * pada game.Workspace["3dModel"].Backdrop dan objek-objek bertag StageBackdrop.
 */
export class ClientBackdropController {
	private static instance?: ClientBackdropController;

	private isInitialized = false;
	private components = new Map<BasePart, StageBackdropGifComponent>();
	private renderConnection?: RBXScriptConnection;

	private constructor() {}

	public static getInstance(): ClientBackdropController {
		if (!ClientBackdropController.instance) {
			ClientBackdropController.instance = new ClientBackdropController();
		}
		return ClientBackdropController.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		// 1. Cari target utama game.Workspace["3dModel"].Backdrop
		this.checkAndRegisterMainBackdrop();

		// 2. Dukung StreamingEnabled / late load
		Workspace.DescendantAdded.Connect((desc) => {
			if (desc.Name === "Backdrop" && desc.IsA("BasePart") && desc.Parent?.Name === "3dModel") {
				this.registerPart(desc);
			}
		});

		// 3. Dukung CollectionService tag "StageBackdrop"
		for (const inst of CollectionService.GetTagged("StageBackdrop")) {
			if (inst.IsA("BasePart")) {
				this.registerPart(inst);
			}
		}

		CollectionService.GetInstanceAddedSignal("StageBackdrop").Connect((inst) => {
			if (inst.IsA("BasePart")) {
				this.registerPart(inst);
			}
		});

		CollectionService.GetInstanceRemovedSignal("StageBackdrop").Connect((inst) => {
			if (inst.IsA("BasePart")) {
				this.unregisterPart(inst);
			}
		});

		// 4. Centralized RenderStepped loop untuk update animasi GIF frame
		this.renderConnection = RunService.RenderStepped.Connect((dt) => {
			const now = os.clock();
			for (const [_, comp] of this.components) {
				comp.update(dt, now);
			}
		});

		print("[ClientBackdropController] Initialized successfully.");
	}

	private checkAndRegisterMainBackdrop(): void {
		const targetModel = Workspace.FindFirstChild("3dModel");
		if (targetModel) {
			const backdrop = targetModel.FindFirstChild("Backdrop");
			if (backdrop && backdrop.IsA("BasePart")) {
				this.registerPart(backdrop);
			}

			// Self-healing: Cek juga part di panggung jika bernama Part dengan dimensi layar (~25.6 x 14.4 atau ~31.3 x 14.4)
			for (const child of targetModel.GetChildren()) {
				if (child.IsA("BasePart") && (child.Name === "Backdrop" || (child.Size.X >= 24 && child.Size.X <= 33 && math.abs(child.Size.Y - 14.4) < 1))) {
					this.registerPart(child);
				}
			}
		}
	}

	public registerPart(part: BasePart): void {
		if (this.components.has(part)) return;
		const comp = new StageBackdropGifComponent(part);
		this.components.set(part, comp);

		part.Destroying.Connect(() => {
			this.unregisterPart(part);
		});
	}

	public unregisterPart(part: BasePart): void {
		const comp = this.components.get(part);
		if (comp) {
			comp.destroy();
			this.components.delete(part);
		}
	}

	public getComponents(): ReadonlyMap<BasePart, StageBackdropGifComponent> {
		return this.components;
	}

	public destroy(): void {
		if (this.renderConnection) {
			this.renderConnection.Disconnect();
			this.renderConnection = undefined;
		}
		for (const [_, comp] of this.components) {
			comp.destroy();
		}
		this.components.clear();
		this.isInitialized = false;
	}
}
