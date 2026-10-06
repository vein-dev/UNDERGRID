import { GuiService, Players, StarterGui, UserInputService, Workspace } from "@rbxts/services";
import { EMOTE_CONFIG } from "shared/config";
import { AvatarContextMenuAction, AvatarTargetPlayer, EmoteItem } from "shared/types";
import { EmoteService } from "../services/EmoteService";
import { AvatarContextMenuView } from "../ui/views/AvatarContextMenuView";
import { CombatController } from "./CombatController";

const MAX_INTERACT_DISTANCE = 80;

function extractAssetIdNumber(assetUrl: string): string | undefined {
	const match = assetUrl.match("%d+")[0];
	return match ? tostring(match) : undefined;
}

// Koleksi seluruh Asset ID numerik khusus Dance dan Pose yang diizinkan untuk di-sync
const ALLOWED_SYNC_ANIMATION_IDS = new Set<string>();
const ANIMATION_ID_TO_EMOTE = new Map<string, EmoteItem>();
const EMOTE_BY_ID = new Map<string, EmoteItem>();

for (const dance of EMOTE_CONFIG.Dances) {
	EMOTE_BY_ID.set(dance.id, dance);
	if (dance.animationId) {
		const id = extractAssetIdNumber(dance.animationId);
		if (id) {
			ALLOWED_SYNC_ANIMATION_IDS.add(id);
			ANIMATION_ID_TO_EMOTE.set(id, dance);
		}
	}
}

for (const pose of EMOTE_CONFIG.Poses) {
	EMOTE_BY_ID.set(pose.id, pose);
	if (pose.animationId) {
		const id = extractAssetIdNumber(pose.animationId);
		if (id) {
			ALLOWED_SYNC_ANIMATION_IDS.add(id);
			ANIMATION_ID_TO_EMOTE.set(id, pose);
		}
	}
}

/**
 * Validasi ketat apakah karakter berada dalam kondisi yang valid untuk melakukan sync emote.
 * Menolak sync jika:
 * 1. Karakter sedang dalam status AFK.
 * 2. Karakter sedang memegang / meng-equip Tool (Gitar, Senjata, Skateboard, Drumstick, dll).
 * 3. Karakter sedang duduk di kursi / drum seat / furniture.
 */
function isCharacterInSyncableState(char: Model | undefined): boolean {
	if (!char) return false;

	// 1. Dilarang sync jika target sedang dalam status AFK
	const isAfk = (char.GetAttribute("IsAfk") as boolean | undefined) ?? false;
	if (isAfk) return false;

	// 2. Dilarang sync jika target sedang memegang Tool (Gitar, Senjata, Skateboard, Drumstick, dll.)
	if (char.FindFirstChildOfClass("Tool") !== undefined) return false;

	// 3. Dilarang sync jika target sedang duduk di kursi / drum / furniture
	const humanoid = char.FindFirstChildOfClass("Humanoid");
	if (!humanoid || humanoid.Health <= 0 || humanoid.Sit) return false;

	return true;
}

function findSyncableEmoteItem(track: AnimationTrack, targetChar?: Model): EmoteItem | undefined {
	if (targetChar && !isCharacterInSyncableState(targetChar)) {
		return undefined;
	}

	const anim = track.Animation;
	if (!anim || !anim.AnimationId || anim.AnimationId === "") {
		return undefined;
	}

	const id = extractAssetIdNumber(anim.AnimationId);
	if (!id) return undefined;

	// Cek apakah ada ActiveEmoteId eksplisit dari karakter target
	if (targetChar) {
		const activeEmoteId = targetChar.GetAttribute("ActiveEmoteId") as string | undefined;
		if (activeEmoteId && activeEmoteId.size() > 0) {
			const item = EMOTE_BY_ID.get(activeEmoteId);
			if (item) {
				const itemAssetId = item.animationId ? extractAssetIdNumber(item.animationId) : undefined;
				if (itemAssetId === id) {
					return item;
				}
			}
		}
	}

	return ANIMATION_ID_TO_EMOTE.get(id);
}

function isSyncableAnimation(track: AnimationTrack, targetChar?: Model): boolean {
	return findSyncableEmoteItem(track, targetChar) !== undefined;
}

/**
 * AvatarContextMenuController - Controls clicking other players in 3D world,
 * managing nearby player carousel, and executing player context actions (Sync, Friends, Inspect).
 */
export class AvatarContextMenuController {
	private static instance?: AvatarContextMenuController;
	private view: AvatarContextMenuView;
	private localPlayer = Players.LocalPlayer;

	private currentTarget?: AvatarTargetPlayer;
	private syncingUserId?: number;
	private syncedTargetPlayer?: Player;
	private syncedTrack?: AnimationTrack;
	private syncConnections: RBXScriptConnection[] = [];

	private constructor() {
		this.view = AvatarContextMenuView.getInstance();
	}

	public static getInstance(): AvatarContextMenuController {
		if (!AvatarContextMenuController.instance) {
			AvatarContextMenuController.instance = new AvatarContextMenuController();
		}
		return AvatarContextMenuController.instance;
	}

	public init(): void {
		// Nonaktifkan default AvatarContextMenu bawaan Roblox jika ada
		pcall(() => {
			StarterGui.SetCore("AvatarContextMenuEnabled", false);
		});

		// Setup view callbacks
		this.view.setCallbacks({
			onAction: (action, target) => this.handleAction(action, target),
			onSelectTarget: (target) => this.selectTarget(target),
			onClose: () => {
				this.currentTarget = undefined;
			},
		});

		// Listen to user click/tap in 3D world
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed) return;

			if (
				input.UserInputType === Enum.UserInputType.MouseButton1 ||
				input.UserInputType === Enum.UserInputType.Touch
			) {
				this.onWorldInput();
			} else if (input.KeyCode === Enum.KeyCode.Escape) {
				if (this.view.isVisible()) {
					this.view.hide();
					this.currentTarget = undefined;
				}
			}
		});

		// Cleanup sync if local player character resets or dies
		this.localPlayer.CharacterAdded.Connect((char) => {
			this.stopSync();
			this.bindLocalCharacter(char);
		});
		if (this.localPlayer.Character) {
			this.bindLocalCharacter(this.localPlayer.Character);
		}

		// If local player plays their own emote manually, cancel external sync
		EmoteService.getInstance().onStateChanged((isPlaying) => {
			if (isPlaying && this.syncingUserId !== undefined && !this.syncedTrack) {
				this.stopSync();
			}
		});

		print("[AvatarContextMenuController] Initialized successfully with 3D click detection & dynamic auto-sync.");
	}

	private bindLocalCharacter(character: Model): void {
		const humanoid = character.WaitForChild("Humanoid") as Humanoid | undefined;
		if (!humanoid) return;

		humanoid.Died.Connect(() => {
			this.stopSync();
		});
	}

	/**
	 * Raycasts from cursor position to check if another player was clicked.
	 */
	private onWorldInput(): void {
		// 1. Jangan proses atau buka ACM jika pemain sedang dalam mode kombat / bertarung
		if (CombatController.getInstance().isCombatActive()) {
			if (this.view.isVisible()) {
				this.view.hide();
				this.currentTarget = undefined;
			}
			return;
		}

		// 2. Jangan proses jika pemain sedang memegang Tool atau berstatus IsFighting
		const localChar = this.localPlayer.Character;
		if (
			localChar &&
			(localChar.GetAttribute("IsFighting") === true || localChar.FindFirstChildOfClass("Tool") !== undefined)
		) {
			if (this.view.isVisible()) {
				this.view.hide();
				this.currentTarget = undefined;
			}
			return;
		}

		const cam = Workspace.CurrentCamera;
		if (!cam) return;

		const mousePos = UserInputService.GetMouseLocation();
		const unitRay = cam.ViewportPointToRay(mousePos.X, mousePos.Y);

		const rayParams = new RaycastParams();
		rayParams.FilterType = Enum.RaycastFilterType.Exclude;

		if (localChar) {
			rayParams.FilterDescendantsInstances = [localChar];
		}

		const hit = Workspace.Raycast(unitRay.Origin, unitRay.Direction.mul(200), rayParams);
		if (!hit || !hit.Instance) {
			// Clicked into void / skybox while menu is open -> close menu
			if (this.view.isVisible()) {
				this.view.hide();
				this.currentTarget = undefined;
			}
			return;
		}

		// Find if hit belongs to a Player's character model
		let current: Instance | undefined = hit.Instance;
		let clickedPlayer: Player | undefined;

		while (current && current !== Workspace) {
			if (current.IsA("Model")) {
				clickedPlayer = Players.GetPlayerFromCharacter(current);
				if (clickedPlayer) break;
			}
			current = current.Parent;
		}

		if (clickedPlayer && clickedPlayer !== this.localPlayer) {
			// Jangan buka jika karakter target sedang dalam status bertarung
			const targetChar = clickedPlayer.Character;
			if (targetChar && targetChar.GetAttribute("IsFighting") === true) {
				return;
			}
			this.openForPlayer(clickedPlayer);
		} else if (this.view.isVisible()) {
			// Clicked other environment objects -> close menu
			this.view.hide();
			this.currentTarget = undefined;
		}
	}

	/**
	 * Opens context menu targeting a player and collects nearby players for carousel.
	 */
	public openForPlayer(player: Player): void {
		const nearby = this.gatherNearbyPlayers();
		let target = nearby.find((p) => p.userId === player.UserId);

		if (!target) {
			target = this.createPlayerInfo(player);
			nearby.unshift(target);
		}

		this.currentTarget = target;
		this.view.show(target, nearby);
	}

	private selectTarget(target: AvatarTargetPlayer): void {
		// Refresh dynamic status
		const refreshed = this.createPlayerInfo(target.player);
		this.currentTarget = refreshed;
		this.view.setTarget(refreshed);
	}

	/**
	 * Gathers other players and sorts them by distance to local player.
	 */
	private gatherNearbyPlayers(): AvatarTargetPlayer[] {
		const localChar = this.localPlayer.Character;
		const localRoot = localChar?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const localPos = localRoot ? localRoot.Position : Vector3.zero;

		const list: AvatarTargetPlayer[] = [];

		for (const otherPlayer of Players.GetPlayers()) {
			if (otherPlayer === this.localPlayer) continue;

			const info = this.createPlayerInfo(otherPlayer);
			if (info.distance === undefined || info.distance <= MAX_INTERACT_DISTANCE) {
				list.push(info);
			}
		}

		// Sort by distance (closest first)
		list.sort((a, b) => (a.distance ?? 999) < (b.distance ?? 999));
		return list;
	}

	private createPlayerInfo(player: Player): AvatarTargetPlayer {
		const localChar = this.localPlayer.Character;
		const localRoot = localChar?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

		const char = player.Character;
		const root = char?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

		let dist: number | undefined;
		if (localRoot && root) {
			dist = math.round((root.Position.sub(localRoot.Position)).Magnitude * 10) / 10;
		}

		let isFriend = false;
		pcall(() => {
			isFriend = this.localPlayer.IsFriendsWith(player.UserId as never);
		});

		return {
			player,
			userId: player.UserId,
			displayName: player.DisplayName,
			username: player.Name,
			isFriend,
			isSyncing: this.syncingUserId === player.UserId,
			distance: dist,
		};
	}

	/**
	 * Executes context menu actions.
	 */
	private handleAction(action: AvatarContextMenuAction, target: AvatarTargetPlayer): void {
		switch (action) {
			case "sync":
				this.toggleSync(target);
				break;

			case "friend":
				this.sendFriendRequest(target);
				break;

			case "inspect":
				this.inspectAvatar(target);
				break;
		}
	}

	/**
	 * Synchronizes emote animation with target player with real-time auto-follow.
	 */
	private toggleSync(target: AvatarTargetPlayer): void {
		if (this.syncingUserId === target.userId) {
			// Unsync
			this.stopSync();
			this.selectTarget(target);
			return;
		}

		this.stopSync();

		const targetChar = target.player.Character;
		if (!targetChar || !isCharacterInSyncableState(targetChar)) {
			warn(`[AvatarContextMenuController] ${target.displayName} tidak dalam status yang dapat di-sync (mungkin AFK atau memegang Tool).`);
			return;
		}

		const localChar = this.localPlayer.Character;
		if (!localChar || !isCharacterInSyncableState(localChar)) {
			warn(`[AvatarContextMenuController] Karakter lokal tidak dalam status yang dapat di-sync.`);
			return;
		}

		const targetHum = targetChar.FindFirstChildOfClass("Humanoid");
		const targetAnimator = targetHum?.FindFirstChildOfClass("Animator");

		if (!targetAnimator) {
			warn(`[AvatarContextMenuController] Tidak menemukan Animator pada ${target.displayName}`);
			return;
		}

		// Find currently active Dance or Pose track only
		const tracks = targetAnimator.GetPlayingAnimationTracks();
		const activeTrack = tracks.find((t) => isSyncableAnimation(t, targetChar));

		if (activeTrack && activeTrack.Animation) {
			this.playSyncTrack(activeTrack, target);
		} else {
			print(`[AvatarContextMenuController] Menunggu ${target.displayName} memainkan Dance atau Pose...`);
		}

		this.syncingUserId = target.userId;
		this.syncedTargetPlayer = target.player;
		this.selectTarget(target);

		// Dynamic Listener: automatically follow when target changes emote (restricted to Dance & Pose only)!
		const animPlayedConn = targetAnimator.AnimationPlayed.Connect((newTrack) => {
			if (newTrack.Animation && this.syncingUserId === target.userId) {
				const currentTargetChar = target.player.Character;
				if (!currentTargetChar || !isCharacterInSyncableState(currentTargetChar)) {
					this.stopSync();
					if (this.currentTarget) this.selectTarget(this.currentTarget);
					return;
				}

				if (isSyncableAnimation(newTrack, currentTargetChar)) {
					task.defer(() => {
						this.playSyncTrack(newTrack, target);
					});
				} else {
					// Jika target memainkan animasi lain (misal Tool/Gitar atau non-emote), hentikan sync
					this.stopSync();
					if (this.currentTarget) this.selectTarget(this.currentTarget);
				}
			}
		});
		this.syncConnections.push(animPlayedConn);

		// Listener 1: target berubah menjadi AFK -> langsung stop sync
		const targetAfkConn = targetChar.GetAttributeChangedSignal("IsAfk").Connect(() => {
			if (targetChar.GetAttribute("IsAfk") === true) {
				this.stopSync();
				if (this.currentTarget) this.selectTarget(this.currentTarget);
			}
		});
		this.syncConnections.push(targetAfkConn);

		// Listener 2: target meng-equip Tool (Gitar, Senjata, Skateboard, Drumstick, dll) -> langsung stop sync
		const targetToolConn = targetChar.ChildAdded.Connect((child) => {
			if (child.IsA("Tool")) {
				this.stopSync();
				if (this.currentTarget) this.selectTarget(this.currentTarget);
			}
		});
		this.syncConnections.push(targetToolConn);

		// Listener 3: target duduk (kursi / panggung / drum) -> stop sync
		if (targetHum) {
			const seatedConn = targetHum.Seated.Connect((isSeated) => {
				if (isSeated) {
					this.stopSync();
					if (this.currentTarget) this.selectTarget(this.currentTarget);
				}
			});
			this.syncConnections.push(seatedConn);

			const diedConn = targetHum.Died.Connect(() => {
				this.stopSync();
				if (this.currentTarget) this.selectTarget(this.currentTarget);
			});
			this.syncConnections.push(diedConn);
		}

		// Listener 4: local player berubah menjadi AFK atau meng-equip Tool -> langsung stop sync
		const localAfkConn = localChar.GetAttributeChangedSignal("IsAfk").Connect(() => {
			if (localChar.GetAttribute("IsAfk") === true) {
				this.stopSync();
			}
		});
		this.syncConnections.push(localAfkConn);

		const localToolConn = localChar.ChildAdded.Connect((child) => {
			if (child.IsA("Tool")) {
				this.stopSync();
			}
		});
		this.syncConnections.push(localToolConn);

		const charRemovingConn = target.player.CharacterRemoving.Connect(() => {
			this.stopSync();
			if (this.currentTarget) this.selectTarget(this.currentTarget);
		});
		this.syncConnections.push(charRemovingConn);
	}

	private playSyncTrack(sourceTrack: AnimationTrack, target: AvatarTargetPlayer): void {
		const targetChar = target.player.Character;
		if (!targetChar || !isCharacterInSyncableState(targetChar)) {
			this.stopSync();
			return;
		}

		const matchedItem = findSyncableEmoteItem(sourceTrack, targetChar);
		if (!matchedItem || !matchedItem.animationId) return;

		const localChar = this.localPlayer.Character;
		if (!localChar || !isCharacterInSyncableState(localChar)) {
			this.stopSync();
			return;
		}

		const localHum = localChar.FindFirstChildOfClass("Humanoid");
		if (!localHum || localHum.Health <= 0) return;

		// Ambil Animator resmi server (jangan buat Animator baru di client agar replikasi server aktif)
		const localAnimator =
			localHum.FindFirstChildOfClass("Animator") ??
			(localHum.WaitForChild("Animator", 3) as Animator | undefined);

		if (!localAnimator) {
			warn("[AvatarContextMenuController] Animator resmi server tidak ditemukan pada karakter lokal.");
			return;
		}

		// Stop previous synced track smoothly
		if (this.syncedTrack) {
			this.syncedTrack.Stop(0.15);
			this.syncedTrack.Destroy();
			this.syncedTrack = undefined;
		}

		// Bersihkan instance Animation lama di local character jika ada
		const existingAnim = localChar.FindFirstChild("SyncAnimationInstance");
		if (existingAnim) {
			existingAnim.Destroy();
		}

		EmoteService.getInstance().stopEmote();

		// Buat instance Animation BARU yang di-parent ke localChar pemain sendiri
		// Ini adalah syarat mutlak agar Roblox Engine mereplikasi pemutaran animasi ke server dan seluruh pemain lain!
		const animInstance = new Instance("Animation");
		animInstance.Name = "SyncAnimationInstance";
		animInstance.AnimationId = matchedItem.animationId;
		animInstance.Parent = localChar;

		const [success, newTrack] = pcall(() => localAnimator.LoadAnimation(animInstance));
		if (success && newTrack) {
			newTrack.Priority = Enum.AnimationPriority.Action;
			newTrack.Looped = true;
			newTrack.Play(0.2);
			newTrack.AdjustSpeed(sourceTrack.Speed);

			if (sourceTrack.TimePosition > 0) {
				pcall(() => {
					newTrack.TimePosition = sourceTrack.TimePosition;
				});
			}

			this.syncedTrack = newTrack;

			// Listen to source track stopped in case target stops without playing new one
			const stoppedConn = sourceTrack.Stopped.Connect(() => {
				task.delay(0.1, () => {
					if (this.syncingUserId === target.userId && this.syncedTargetPlayer) {
						const currentTargetChar = this.syncedTargetPlayer.Character;
						if (!currentTargetChar || !isCharacterInSyncableState(currentTargetChar)) {
							this.stopSync();
							if (this.currentTarget) this.selectTarget(this.currentTarget);
							return;
						}

						const currentTargetAnimator = currentTargetChar
							.FindFirstChildOfClass("Humanoid")
							?.FindFirstChildOfClass("Animator");
						const playing =
							currentTargetAnimator
								?.GetPlayingAnimationTracks()
								.filter((t) => isSyncableAnimation(t, currentTargetChar)) ?? [];

						if (playing.size() === 0 && this.syncedTrack) {
							this.syncedTrack.Stop(0.2);
							this.syncedTrack.Destroy();
							this.syncedTrack = undefined;
							const anim = localChar.FindFirstChild("SyncAnimationInstance");
							if (anim) anim.Destroy();
						}
					}
				});
			});
			this.syncConnections.push(stoppedConn);
		}
	}

	private stopSync(): void {
		for (const conn of this.syncConnections) {
			conn.Disconnect();
		}
		this.syncConnections = [];

		if (this.syncedTrack) {
			this.syncedTrack.Stop(0.2);
			this.syncedTrack.Destroy();
			this.syncedTrack = undefined;
		}

		const localChar = this.localPlayer.Character;
		const anim = localChar?.FindFirstChild("SyncAnimationInstance");
		if (anim) {
			anim.Destroy();
		}

		this.syncingUserId = undefined;
		this.syncedTargetPlayer = undefined;
	}

	/**
	 * Prompts native Roblox friend request modal.
	 */
	private sendFriendRequest(target: AvatarTargetPlayer): void {
		pcall(() => {
			StarterGui.SetCore("PromptSendFriendRequest", target.player);
		});
	}

	/**
	 * Opens native Roblox avatar inspection menu.
	 */
	private inspectAvatar(target: AvatarTargetPlayer): void {
		pcall(() => {
			GuiService.InspectPlayerFromUserId(target.userId as never);
		});
	}
}
