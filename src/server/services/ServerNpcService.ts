/**
 * ServerNpcService.ts
 * Layanan server otoritatif untuk interaksi NPC, ProximityPrompt, dan sistem dialog Undergrid.
 */

import { ServerStorage, Workspace } from "@rbxts/services";
import { getRemoteEvent } from "shared/network";
import { NPC_CONFIG } from "shared/config";
import { NpcDialogueActionPayload, NpcDialogueOpenPayload } from "shared/types";

export class ServerNpcService {
	private static instance?: ServerNpcService;

	private dialogueOpenEvent: RemoteEvent;
	private dialogueActionEvent: RemoteEvent;
	private twinsPrompt?: ProximityPrompt;

	private constructor() {
		this.dialogueOpenEvent = getRemoteEvent("NpcDialogueOpenEvent");
		this.dialogueActionEvent = getRemoteEvent("NpcDialogueActionEvent");
	}

	public static getInstance(): ServerNpcService {
		if (!ServerNpcService.instance) {
			ServerNpcService.instance = new ServerNpcService();
		}
		return ServerNpcService.instance;
	}

	public init(): void {
		task.spawn(() => {
			this.setupAllNpcs();
		});

		// Tangani aksi pilihan dialog dari client
		this.dialogueActionEvent.OnServerEvent.Connect((player, payload) => {
			const data = payload as NpcDialogueActionPayload | undefined;
			if (!data) return;

			this.handleDialogueAction(player, data);
		});

		print("[ServerNpcService] Initialized NPC interaction and dialogue service.");
	}

	/**
	 * Memeriksa apakah pemain sudah memiliki item tertentu di Backpack atau Karakter
	 */
	public playerHasTool(player: Player, toolName: string): boolean {
		const backpack = player.FindFirstChildOfClass("Backpack");
		if (backpack && backpack.FindFirstChild(toolName)) {
			return true;
		}

		const char = player.Character;
		if (char && char.FindFirstChild(toolName)) {
			return true;
		}

		return false;
	}

	/**
	 * Menyiapkan rig NPC agar bagian leher dan anggota tubuh tidak anchored
	 * Hanya HumanoidRootPart yang di-anchor agar NPC berdiri kokoh di posisinya.
	 */
	public prepareNpcRig(model: Model): void {
		const hrp = (model.FindFirstChild("HumanoidRootPart") ??
			model.FindFirstChild("Torso")) as BasePart | undefined;
		if (hrp) {
			hrp.Anchored = true;
		}

		for (const desc of model.GetDescendants()) {
			if (desc.IsA("BasePart") && desc !== hrp) {
				desc.Anchored = false;
			}

			// Bersihkan weld salah/korup yang menarik kepala ke aksesoris pinggang/kaki
			if (desc.IsA("Weld") && desc.Name === "HeadWeld") {
				const p0 = desc.Part0;
				const p1 = desc.Part1;
				if (
					(p0?.Name === "Head" && p1?.Name !== "Head") ||
					(p1?.Name === "Head" && p0?.Name !== "Head")
				) {
					desc.Destroy();
				}
			}
		}

		// Jika NPC memiliki aksesoris iPod earphone (seperti pada Twins), sambungkan ke Head agar kabel earphone ikut menoleh
		const ipod = model.FindFirstChild("Accessory (ipod)");
		const head = model.FindFirstChild("Head") as BasePart | undefined;
		if (ipod && head) {
			const handle = ipod.FindFirstChild("Handle") as BasePart | undefined;
			if (handle) {
				const att = handle.FindFirstChild("BodyFrontAttachment");
				if (att) {
					att.Name = "iPodAttachment";
				}
				let weld = handle.FindFirstChildOfClass("Weld");
				if (!weld) {
					weld = new Instance("Weld");
					weld.Name = "AccessoryWeld";
					weld.Parent = handle;
				}
				weld.Part0 = handle;
				weld.Part1 = head;
				weld.C0 = new CFrame();
				weld.C1 = head.CFrame.ToObjectSpace(handle.CFrame);
			}
		}
	}

	/**
	 * Menyiapkan semua NPC di folder Workspace.NPC
	 */
	private setupAllNpcs(): void {
		const npcFolder = Workspace.FindFirstChild("NPC");
		if (npcFolder) {
			for (const child of npcFolder.GetChildren()) {
				if (child.IsA("Model")) {
					this.prepareNpcRig(child);
				}
			}

			npcFolder.ChildAdded.Connect((child) => {
				if (child.IsA("Model")) {
					task.delay(0.2, () => this.prepareNpcRig(child));
				}
			});
		}

		this.setupTwinsNpc();
	}

	/**
	 * Menyiapkan ProximityPrompt pada NPC Twins
	 */
	private setupTwinsNpc(): void {
		let twinsModel: Model | undefined;

		const findTwins = () => {
			const npcFolder = Workspace.FindFirstChild("NPC");
			if (npcFolder) {
				return npcFolder.FindFirstChild("Twins") as Model | undefined;
			}
			return undefined;
		};

		twinsModel = findTwins();
		let attempts = 0;
		while (!twinsModel && attempts < 20) {
			task.wait(0.5);
			twinsModel = findTwins();
			attempts++;
		}

		if (!twinsModel) {
			warn("[ServerNpcService] Model NPC Twins tidak ditemukan di Workspace.NPC.Twins!");
			return;
		}

		const rootPart = (twinsModel.FindFirstChild("HumanoidRootPart") ??
			twinsModel.FindFirstChild("Torso")) as BasePart | undefined;

		if (!rootPart) {
			warn("[ServerNpcService] HumanoidRootPart atau Torso tidak ditemukan pada Twins NPC.");
			return;
		}

		let prompt = rootPart.FindFirstChild(NPC_CONFIG.TWINS.PROMPT.NAME) as ProximityPrompt | undefined;
		if (!prompt || !prompt.IsA("ProximityPrompt")) {
			prompt = new Instance("ProximityPrompt");
			prompt.Name = NPC_CONFIG.TWINS.PROMPT.NAME;
		}

		prompt.ActionText = NPC_CONFIG.TWINS.PROMPT.ACTION_TEXT;
		prompt.ObjectText = NPC_CONFIG.TWINS.PROMPT.OBJECT_TEXT;
		prompt.HoldDuration = NPC_CONFIG.TWINS.PROMPT.HOLD_DURATION;
		prompt.MaxActivationDistance = NPC_CONFIG.TWINS.PROMPT.MAX_ACTIVATION_DISTANCE;
		prompt.KeyboardKeyCode = NPC_CONFIG.TWINS.PROMPT.KEY_CODE;
		prompt.RequiresLineOfSight = NPC_CONFIG.TWINS.PROMPT.REQUIRES_LINE_OF_SIGHT;
		prompt.Parent = rootPart;
		this.twinsPrompt = prompt;

		prompt.Triggered.Connect((player) => {
			this.onPromptTriggered(player, twinsModel!);
		});

		print("[ServerNpcService] ProximityPrompt berhasil dipasang pada NPC Twins.");
	}

	/**
	 * Dipanggil saat pemain mengaktifkan ProximityPrompt Twins
	 */
	private onPromptTriggered(player: Player, npcModel: Model): void {
		const tree = NPC_CONFIG.TWINS.DIALOGUE_TREE;
		const hasBoard = this.playerHasTool(player, NPC_CONFIG.TWINS.TOOL_NAME);

		const startNodeId = hasBoard && tree.alreadyHasItemNodeId ? tree.alreadyHasItemNodeId : tree.defaultNodeId;

		const payload: NpcDialogueOpenPayload = {
			npcId: NPC_CONFIG.TWINS.NPC_NAME,
			dialogueTree: tree,
			startNodeId,
		};

		this.dialogueOpenEvent.FireClient(player, payload);
	}

	/**
	 * Memproses aksi yang dipicu dari percakapan dialog (misal mengambil skateboard)
	 */
	private handleDialogueAction(player: Player, payload: NpcDialogueActionPayload): void {
		if (payload.action === "claim_skateboard") {
			// 1. Validasi jarak pemain dengan Twins
			const npcFolder = Workspace.FindFirstChild("NPC");
			const twinsModel = npcFolder?.FindFirstChild("Twins") as Model | undefined;
			const rootPart = (twinsModel?.FindFirstChild("HumanoidRootPart") ??
				twinsModel?.FindFirstChild("Torso")) as BasePart | undefined;
			const char = player.Character;
			const playerHrp = char?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

			if (rootPart && playerHrp) {
				const distance = rootPart.Position.sub(playerHrp.Position).Magnitude;
				if (distance > NPC_CONFIG.PROMPT_MAX_INTERACTION_DISTANCE) {
					warn(`[ServerNpcService] Player ${player.Name} terlalu jauh dari Twins (${distance} studs)!`);
					return;
				}
			}

			// 2. Cek apakah pemain sudah memiliki Skateboard
			if (this.playerHasTool(player, NPC_CONFIG.TWINS.TOOL_NAME)) {
				print(`[ServerNpcService] Player ${player.Name} sudah memiliki Skateboard.`);
				return;
			}

			// 3. Ambil template skateboard dari ServerStorage.Tools atau ServerStorage
			const toolsFolder = ServerStorage.FindFirstChild("Tools") as Folder | undefined;
			const template = (toolsFolder?.FindFirstChild(NPC_CONFIG.TWINS.TOOL_NAME) ??
				ServerStorage.FindFirstChild(NPC_CONFIG.TWINS.TOOL_NAME)) as Tool | undefined;

			if (!template) {
				warn("[ServerNpcService] Item Skateboard tidak ditemukan di ServerStorage.Tools atau ServerStorage!");
				return;
			}

			const backpack = player.FindFirstChildOfClass("Backpack");
			if (!backpack) {
				warn(`[ServerNpcService] Backpack tidak ditemukan untuk pemain ${player.Name}`);
				return;
			}

			// 4. Kloning skateboard ke Backpack
			const newBoard = template.Clone();
			newBoard.RequiresHandle = false;
			newBoard.ManualActivationOnly = true;

			const oldHandle = newBoard.FindFirstChild("Handle");
			if (oldHandle) {
				oldHandle.Name = "ToolAnchor";
			}

			for (const desc of newBoard.GetDescendants()) {
				if (desc.IsA("BasePart")) {
					desc.Anchored = false;
					desc.CanCollide = false;
					desc.Massless = true;
				}
			}

			newBoard.Parent = backpack;
			print(`[ServerNpcService] Berhasil memberikan Skateboard kepada ${player.Name}!`);
		}
	}
}
