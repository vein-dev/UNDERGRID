/**
 * NpcDialogueController.ts
 * Pengendali interaksi dialog NPC di client.
 * Menghubungkan network remote, UI NpcDialogueView, dan auto-close saat pemain menjauh.
 */

import { Players, RunService, Workspace } from "@rbxts/services";
import { getRemoteEvent } from "shared/network";
import { DialogueOption, NpcDialogueActionPayload, NpcDialogueOpenPayload, NpcDialogueTree } from "shared/types";
import { NPC_CONFIG } from "shared/config";
import { GlobalNotificationService } from "../services/GlobalNotificationService";
import { NpcDialogueView } from "../ui/views/NpcDialogueView";

export class NpcDialogueController {
	private static instance?: NpcDialogueController;

	private dialogueOpenEvent: RemoteEvent;
	private dialogueActionEvent: RemoteEvent;

	private activeTree?: NpcDialogueTree;
	private view: NpcDialogueView;
	private heartbeatConn?: RBXScriptConnection;

	private constructor() {
		this.dialogueOpenEvent = getRemoteEvent("NpcDialogueOpenEvent");
		this.dialogueActionEvent = getRemoteEvent("NpcDialogueActionEvent");
		this.view = NpcDialogueView.getInstance();
	}

	public static getInstance(): NpcDialogueController {
		if (!NpcDialogueController.instance) {
			NpcDialogueController.instance = new NpcDialogueController();
		}
		return NpcDialogueController.instance;
	}

	public init(): void {
		// Pasang callback tombol aksi UI
		this.view.setCallbacks({
			onSelectOption: (option) => this.handleOptionSelected(option),
			onClose: () => this.closeDialogue(),
		});

		// Tangkap event pembuka dialog dari server
		this.dialogueOpenEvent.OnClientEvent.Connect((payload: unknown) => {
			if (!typeIs(payload, "table")) return;
			const data = payload as unknown as NpcDialogueOpenPayload;
			this.openDialogue(data);
		});

		print("[NpcDialogueController] Initialized NPC dialogue client controller.");
	}

	/**
	 * Membuka UI dialog berdasarkan payload dari server
	 */
	public openDialogue(payload: NpcDialogueOpenPayload): void {
		this.activeTree = payload.dialogueTree;
		this.view.show(payload.dialogueTree, payload.startNodeId);

		// Mulai pengecekan jarak pemain agar dialog otomatis tertutup jika pemain berjalan menjauh
		this.startDistanceGuard(payload.npcId);
	}

	/**
	 * Menutup dialog dan membersihkan guard
	 */
	public closeDialogue(): void {
		this.stopDistanceGuard();
		this.view.hide();
		this.activeTree = undefined;
	}

	/**
	 * Menangani pemilihan opsi respons
	 */
	private handleOptionSelected(option: DialogueOption): void {
		if (!this.activeTree) return;

		if (option.action === "claim_skateboard") {
			// Kirim request ke server untuk memberikan Skateboard
			const payload: NpcDialogueActionPayload = {
				npcId: this.activeTree.npcId,
				action: "claim_skateboard",
			};
			this.dialogueActionEvent.FireServer(payload);

			// Tampilkan notifikasi dinamis di client
			GlobalNotificationService.getInstance().show({
				title: this.activeTree.speakerName,
				message: "Skateboard berhasil diambil! Cek Hotbar atau Tasmu.",
				badgeIcon: "sparkles",
				duration: 3.5,
			});

			this.closeDialogue();
		} else if (option.action === "close") {
			this.closeDialogue();
		} else if (option.nextNodeId) {
			this.view.setCurrentNode(option.nextNodeId);
		} else {
			this.closeDialogue();
		}
	}

	/**
	 * Memantau jarak pemain dari NPC selama dialog terbuka
	 */
	private startDistanceGuard(npcName: string): void {
		this.stopDistanceGuard();

		let checkCounter = 0;
		this.heartbeatConn = RunService.Heartbeat.Connect(() => {
			checkCounter++;
			// Pengecekan setiap ~15 frame untuk optimasi performa
			if (checkCounter % 15 !== 0) return;

			if (!this.view.isVisible()) {
				this.stopDistanceGuard();
				return;
			}

			const npcFolder = Workspace.FindFirstChild("NPC");
			const npcModel = npcFolder?.FindFirstChild(npcName) as Model | undefined;
			const npcPart = (npcModel?.FindFirstChild("HumanoidRootPart") ??
				npcModel?.FindFirstChild("Torso")) as BasePart | undefined;

			const localChar = Players.LocalPlayer.Character;
			const localHrp = localChar?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

			if (npcPart && localHrp) {
				const distance = npcPart.Position.sub(localHrp.Position).Magnitude;
				if (distance > NPC_CONFIG.PROMPT_MAX_INTERACTION_DISTANCE) {
					this.closeDialogue();
				}
			}
		});
	}

	private stopDistanceGuard(): void {
		if (this.heartbeatConn) {
			this.heartbeatConn.Disconnect();
			this.heartbeatConn = undefined;
		}
	}
}
