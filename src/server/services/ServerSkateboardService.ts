/**
 * ServerSkateboardService.ts
 * Layanan server otoritatif untuk manajemen pemasangan (mount/dismount) Skateboard R6
 * dan replikasi visual/suara ke seluruh client.
 */

import { KeyframeSequenceProvider, Players, ReplicatedStorage, ServerStorage, StarterPack, Workspace } from "@rbxts/services";
import { getRemoteEvent } from "shared/network";
import { SkateboardConfig } from "shared/config";
import { SkateboardMountPayload, SkateboardTrickPayload } from "shared/types";

export class ServerSkateboardService {
	private static instance: ServerSkateboardService;

	private mountEvent: RemoteEvent;
	private trickEvent: RemoteEvent;
	private soundEvent: RemoteEvent;
	private templateModel?: Instance;
	private activeBoards = new Map<Player, Instance>();
	private originalHipHeights = new Map<Player, number>();

	private constructor() {
		this.mountEvent = getRemoteEvent("SkateboardMountEvent");
		this.trickEvent = getRemoteEvent("SkateboardTrickEvent");
		this.soundEvent = getRemoteEvent("SoundEvent");
	}

	public static getInstance(): ServerSkateboardService {
		if (!ServerSkateboardService.instance) {
			ServerSkateboardService.instance = new ServerSkateboardService();
		}
		return ServerSkateboardService.instance;
	}

	public init(): void {
		this.registerKeyframeSequences();
		this.findOrCreateTemplate();

		// Handle mount / dismount request
		this.mountEvent.OnServerEvent.Connect((player, payload) => {
			const data = payload as SkateboardMountPayload | undefined;
			if (!data) return;

			print(`[ServerSkateboardService] Player ${player.Name} request mount: ${data.mount}`);
			if (data.mount) {
				this.mountPlayer(player);
			} else {
				this.dismountPlayer(player);
			}
		});

		// Handle trick replication & sound playback to other players
		this.trickEvent.OnServerEvent.Connect((player, payload) => {
			const data = payload as SkateboardTrickPayload | undefined;
			if (!data) return;

			const char = player.Character;
			const hrp = char?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

			// Replikasi suara & visual ke SEMUA pemain LAIN (kecualikan pengirim/player)
			for (const otherPlayer of Players.GetPlayers()) {
				if (otherPlayer !== player) {
					// 1. Suara pop 3D spasial HANYA dimainkan saat lepas landas dari tanah (Ollie).
					// Pemain pengirim (player) TIDAK dikirimi agar tidak terjadi pantulan ganda (echo)
					// karena player pengirim sudah memutarnya secara instan 0ms di lokal.
					if (data.trickName === "Ollie" && hrp) {
						this.soundEvent.FireClient(
							otherPlayer,
							"PlaySound",
							hrp.Position,
							SkateboardConfig.SOUNDS.pop,
							0.95,
						);
					}

					// 2. Replikasi data animasi & rotasi trik ke pemain lain
					this.trickEvent.FireClient(otherPlayer, player, data);
				}
			}
		});

		// Cleanup saat player disconnect
		Players.PlayerRemoving.Connect((player) => {
			this.dismountPlayer(player);
		});

		const starterSkate = StarterPack.FindFirstChild("Skateboard") as Tool | undefined;
		if (starterSkate) {
			starterSkate.RequiresHandle = false;
			starterSkate.ManualActivationOnly = true;
			const oldHandle = starterSkate.FindFirstChild("Handle");
			if (oldHandle) oldHandle.Name = "ToolAnchor";
			for (const desc of starterSkate.GetDescendants()) {
				if (desc.IsA("BasePart")) {
					desc.Anchored = false;
					desc.CanCollide = false;
					desc.Massless = true;
				}
			}
		}

		print("[ServerSkateboardService] Initialized successfully with Combat-grade Keyframe & Sound replication.");
	}

	/**
	 * Mendaftarkan KeyframeSequence dari Workspace/ServerStorage ke ReplicatedStorage (persis seperti ServerCombatService)
	 */
	private registerKeyframeSequences(): void {
		const kfsMapping = new Map<string, string[]>([
			["Kickflip", ["Kickflip"]],
			["Heelflip", ["Heelflip"]],
			["Treflip", ["Treflip"]],
			["Shuv", ["Shuv"]],
			["Ollie", ["Ollie", "ollie"]],
			["Land", ["Land", "land"]],
			["FakieLand", ["fakieLand"]],
			["Idle", ["Idle", "idle"]],
			["Idle-fakie", ["fakieIdle"]],
			["FakieInAir", ["inAir"]],
			["Startpush", ["startPush"]],
			["Startpush-Fakie", ["fakiePush"]],
			["TurnLeft", ["turnLeft"]],
			["TurnRight", ["turnRight"]],
			["FakieTurnLeft", ["fakieTurnLeft"]],
			["FakieTurnRight", ["fakieTurnRight"]],
			["Stop", ["stop"]],
			["FakieStop", ["fakieStop"]],
			["Crouch", ["crouch"]],
			["FakieCrouch", ["fakieCrouch"]],
		]);

		let animFolder = ReplicatedStorage.FindFirstChild("SkateboardAnimationIds") as Folder | undefined;
		if (!animFolder) {
			animFolder = new Instance("Folder");
			animFolder.Name = "SkateboardAnimationIds";
			animFolder.Parent = ReplicatedStorage;
		}

		let animInstanceFolder = ReplicatedStorage.FindFirstChild("SkateboardAnimations") as Folder | undefined;
		if (!animInstanceFolder) {
			animInstanceFolder = new Instance("Folder");
			animInstanceFolder.Name = "SkateboardAnimations";
			animInstanceFolder.Parent = ReplicatedStorage;
		}

		const registeredKfs = new Set<Instance>();

		const scanAndRegister = () => {
			const containers: Instance[] = [Workspace, ReplicatedStorage];
			const serverStorage = game.GetService("ServerStorage") as Instance | undefined;
			if (serverStorage) containers.push(serverStorage);

			for (const container of containers) {
				for (const inst of container.GetDescendants()) {
					if (inst.IsA("KeyframeSequence") && !registeredKfs.has(inst)) {
						const targets = kfsMapping.get(inst.Name);
						if (targets) {
							const [success, registeredId] = pcall(() =>
								KeyframeSequenceProvider.RegisterKeyframeSequence(inst),
							);
							if (success && registeredId) {
								registeredKfs.add(inst);
								for (const targetName of targets) {
									let val = animFolder!.FindFirstChild(targetName) as StringValue | undefined;
									if (!val) {
										val = new Instance("StringValue");
										val.Name = targetName;
										val.Parent = animFolder!;
									}
									val.Value = registeredId;

									let animInst = animInstanceFolder!.FindFirstChild(targetName) as
										Animation | undefined;
									if (!animInst) {
										animInst = new Instance("Animation");
										animInst.Name = targetName;
										animInst.Parent = animInstanceFolder!;
									}
									animInst.AnimationId = registeredId;
								}
								print(`[ServerSkateboardService] KFS '${inst.Name}' terdaftar -> ${registeredId}`);
							}
						}
					}
				}
			}

			if (registeredKfs.size() > 0) {
				print(
					`[ServerSkateboardService] Total ${registeredKfs.size()} Skateboard KeyframeSequence didaftarkan ke ReplicatedStorage.`,
				);
			}
		};

		// Pindai berkala agar model yang di-load terlambat terdeteksi penuh (identik ServerCombatService)
		task.spawn(() => {
			scanAndRegister();
			task.wait(1);
			scanAndRegister();
			task.wait(2);
			scanAndRegister();
			task.wait(3);
			scanAndRegister();
		});

		Workspace.DescendantAdded.Connect((inst) => {
			if (inst.IsA("KeyframeSequence")) {
				scanAndRegister();
			}
		});
	}

	private findOrCreateTemplate(player?: Player): void {
		// 1. Cek ReplicatedStorage
		const inRep = ReplicatedStorage.FindFirstChild("SkateboardTemplate");
		if (inRep) {
			this.templateModel = inRep;
			return;
		}

		// 2. Cek Workspace
		const inWs = Workspace.FindFirstChild("Skateboard");
		if (inWs && (inWs.IsA("Model") || inWs.IsA("Folder"))) {
			const tmpl = inWs.Clone() as Model;
			tmpl.Name = "SkateboardTemplate";
			tmpl.Parent = ReplicatedStorage;
			this.templateModel = tmpl;
			print("[ServerSkateboardService] Skateboard template registered from Workspace.");
			return;
		}

		// 3. Cek StarterPack atau Tool pemain
		const inStarter = StarterPack.FindFirstChild("Skateboard") as Tool | undefined;
		const backpack = player?.FindFirstChildOfClass("Backpack");
		const toolSource =
			inStarter ??
			(player?.Character?.FindFirstChild("Skateboard") as Tool | undefined) ??
			(backpack?.FindFirstChild("Skateboard") as Tool | undefined);

		if (toolSource) {
			const tmpl = new Instance("Model");
			tmpl.Name = "SkateboardTemplate";

			const visualFolder = toolSource.FindFirstChild("Skateboard") ?? toolSource.FindFirstChild("Trickboard");
			if (visualFolder) {
				for (const child of visualFolder.GetChildren()) {
					child.Clone().Parent = tmpl;
				}
			} else {
				for (const child of toolSource.GetChildren()) {
					if (
						child.Name !== "Handle" &&
						child.Name !== "ToolAnchor" &&
						(child.IsA("BasePart") || child.IsA("Model") || child.IsA("Folder"))
					) {
						child.Clone().Parent = tmpl;
					}
				}
			}

			const primary = (tmpl.FindFirstChild("Board", true) ?? tmpl.FindFirstChildWhichIsA("BasePart", true)) as BasePart | undefined;
			if (primary) {
				tmpl.PrimaryPart = primary;
			}

			tmpl.Parent = ReplicatedStorage;
			this.templateModel = tmpl;
			print("[ServerSkateboardService] Skateboard template created from Tool source.");
			return;
		}
	}

	/**
	 * Memasang skateboard ke karakter R6
	 */
	public mountPlayer(player: Player): boolean {
		const char = player.Character;
		if (!char) return false;

		const rootPart = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const humanoid = char.FindFirstChildOfClass("Humanoid");
		if (!rootPart || !humanoid || humanoid.Health <= 0) return false;

		// Pastikan Animator resmi server tersedia di Humanoid agar replikasi animasi aktif
		let animator = humanoid.FindFirstChildOfClass("Animator");
		if (!animator) {
			animator = new Instance("Animator");
			animator.Name = "Animator";
			animator.Parent = humanoid;
		}

		// Jika sudah terpasang papan sebelumnya, bersihkan board & joint saja (JANGAN dismountPlayer agar tool tidak di-unequip)
		const oldBoard = this.activeBoards.get(player);
		if (oldBoard) {
			oldBoard.Destroy();
			this.activeBoards.delete(player);
		}
		for (const child of char.GetChildren()) {
			if (child.Name === "PlayerSkateboard") {
				child.Destroy();
			}
		}
		const oldJoint = rootPart.FindFirstChild(SkateboardConfig.ATTACHMENT.jointName);
		if (oldJoint) {
			oldJoint.Destroy();
		}

		if (!this.templateModel) {
			this.findOrCreateTemplate(player);
			if (!this.templateModel) {
				warn("[ServerSkateboardService] Skateboard template not found!");
				this.mountEvent.FireClient(player, { mount: false });
				return false;
			}
		}

		// Clone skateboard model
		const boardModel = this.templateModel.Clone() as Model;
		boardModel.Name = "PlayerSkateboard";

		// Cari root part papan: Board (dari Trickboard) atau BoardMain
		const targetPart = (boardModel.FindFirstChild("Board", true) ??
			boardModel.FindFirstChild("BoardMain", true) ??
			boardModel.FindFirstChildWhichIsA("BasePart", true)) as BasePart | undefined;

		if (!targetPart) {
			warn("[ServerSkateboardService] Board part not found in skateboard template!");
			boardModel.Destroy();
			return false;
		}

		// Las SEMUA part di dalam boardModel ke targetPart agar kokoh 100% dan tidak ada part yang tertinggal/jatuh
		for (const desc of boardModel.GetDescendants()) {
			if (desc.IsA("BasePart") && desc !== targetPart) {
				const weld = new Instance("WeldConstraint");
				weld.Name = `Weld_${desc.Name}`;
				weld.Part0 = targetPart;
				weld.Part1 = desc;
				weld.Parent = targetPart;
			}
		}

		// Set semua part tidak anchored, canCollide false, massless, dan pastikan part visual papan 100% terlihat
		for (const desc of boardModel.GetDescendants()) {
			if (desc.IsA("BasePart")) {
				desc.Anchored = false;
				desc.CanCollide = false;
				desc.Massless = true;
				if (desc.Name === "Handle" || desc.Name === "ToolAnchor" || desc.Name === "Trucks") {
					desc.Transparency = 1;
				} else {
					desc.Transparency = 0;
				}
			}
		}

		// Rename untuk mencocokkan nama pose animasi R6 (VisualBoard)
		targetPart.Name = "VisualBoard";

		// Posisikan skateboard tepat di bawah kaki karakter
		boardModel.Parent = char;

		// Sambungkan HumanoidRootPart ke VisualBoard via Motor6D
		const joint = new Instance("Motor6D");
		joint.Name = SkateboardConfig.ATTACHMENT.jointName;
		joint.Part0 = rootPart;
		joint.Part1 = targetPart;
		joint.C0 = SkateboardConfig.ATTACHMENT.boardCFrameOffset;
		joint.C1 = new CFrame();
		joint.Parent = rootPart;

		// Kunci part tool ke HumanoidRootPart agar tidak jatuh bebas ke void (mencegah tool terhapus oleh FallenPartsDestroyHeight)
		const equippedTool = char.FindFirstChildOfClass("Tool");
		if (equippedTool) {
			equippedTool.RequiresHandle = false;
			const anchorPart = (equippedTool.FindFirstChild("ToolAnchor") ??
				equippedTool.FindFirstChild("Handle") ??
				equippedTool.FindFirstChildWhichIsA("BasePart")) as BasePart | undefined;
			if (anchorPart) {
				anchorPart.Name = "ToolAnchor";
				anchorPart.Anchored = false;
				anchorPart.CanCollide = false;
				anchorPart.Massless = true;
				anchorPart.CFrame = rootPart.CFrame;
				let weld = anchorPart.FindFirstChild("ToolRootWeld") as WeldConstraint | undefined;
				if (!weld) {
					weld = new Instance("WeldConstraint");
					weld.Name = "ToolRootWeld";
					weld.Part0 = rootPart;
					weld.Part1 = anchorPart;
					weld.Parent = anchorPart;
				}
			}
			for (const desc of equippedTool.GetDescendants()) {
				if (desc.IsA("BasePart")) {
					desc.Transparency = 1;
					desc.CanCollide = false;
					desc.Massless = true;
					desc.Anchored = false;
				}
			}
		}

		// Disable collision kaki agar tidak bentrok dengan papan
		const leftLeg = char.FindFirstChild("Left Leg") as BasePart | undefined;
		const rightLeg = char.FindFirstChild("Right Leg") as BasePart | undefined;
		if (leftLeg) leftLeg.CanCollide = false;
		if (rightLeg) rightLeg.CanCollide = false;

		// Kunci kontrol default agar karakter berdiri stabil di papan
		humanoid.WalkSpeed = 0;
		humanoid.JumpPower = 0;
		humanoid.AutoRotate = false;
		if (!this.originalHipHeights.has(player)) {
			this.originalHipHeights.set(player, humanoid.HipHeight);
		}
		humanoid.HipHeight = SkateboardConfig.ATTACHMENT.hipHeightMounted;

		this.activeBoards.set(player, boardModel);
		rootPart.SetAttribute("IsSkating", true);

		// Konfirmasi ke client
		this.mountEvent.FireClient(player, { mount: true });

		// Cleanup jika karakter mati
		const conn = humanoid.Died.Connect(() => {
			this.dismountPlayer(player);
			conn.Disconnect();
		});

		return true;
	}

	/**
	 * Mencopot skateboard dari karakter
	 */
	public dismountPlayer(player: Player): void {
		const board = this.activeBoards.get(player);
		if (board) {
			board.Destroy();
			this.activeBoards.delete(player);
		}

		const originalHip = this.originalHipHeights.get(player) ?? SkateboardConfig.ATTACHMENT.hipHeightDismounted;
		this.originalHipHeights.delete(player);

		const char = player.Character;
		if (char) {
			const rootPart = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (rootPart) {
				rootPart.SetAttribute("IsSkating", false);
				const joint = rootPart.FindFirstChild(SkateboardConfig.ATTACHMENT.jointName);
				if (joint) joint.Destroy();
			}

			// Unequip tool skateboard dari tangan ke Backpack
			const humanoid = char.FindFirstChildOfClass("Humanoid");
			if (humanoid && humanoid.Health > 0) {
				humanoid.UnequipTools();
				humanoid.WalkSpeed = 12;
				humanoid.JumpPower = 35;
				humanoid.AutoRotate = true;
				humanoid.HipHeight = originalHip;
			}
		}

		this.mountEvent.FireClient(player, { mount: false });
	}
}
