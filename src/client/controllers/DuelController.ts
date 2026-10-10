import { Players, Workspace } from "@rbxts/services";
import { ARCZIS_COMBAT_CONFIG, DuelActiveData, DuelEndData, DuelIntroData, DuelInviteData } from "shared/types";
import { BackpackController } from "./BackpackController";
import { HotbarController } from "./HotbarController";
import { DuelService } from "../services/DuelService";
import { DuelHudView } from "../ui/views/DuelHudView";
import { DuelInviteView } from "../ui/views/DuelInviteView";
import { CinematicOverlayView } from "../ui/views/CinematicOverlayView";
import { createSpring, Spring, SpringPresets } from "../ui/SpringConfig";

/**
 * DuelController - Controls client-side duel flow:
 * prompts, pre-round cinematic intro (3/4 low angle, smooth transition), countdown, HUD state, and auto-equipping combat weapons.
 */
export class DuelController {
	private static instance?: DuelController;
	private duelService = DuelService.getInstance();
	private inviteView = DuelInviteView.getInstance();
	private hudView = DuelHudView.getInstance();
	private cinematicOverlay = new CinematicOverlayView();
	private localPlayer = Players.LocalPlayer;

	private isPlayingIntro = false;
	private activeCameraSpring?: Spring<CFrame>;
	private activeTracks: AnimationTrack[] = [];
	private originalCameraType: Enum.CameraType = Enum.CameraType.Custom;

	private constructor() {}

	public static getInstance(): DuelController {
		if (!DuelController.instance) {
			DuelController.instance = new DuelController();
		}
		return DuelController.instance;
	}

	public init(): void {
		this.duelService.setCallbacks({
			onInviteReceived: (data) => this.handleInviteReceived(data),
			onInviteCancelled: () => this.handleInviteCancelled(),
			onIntro: (data) => this.handleIntro(data),
			onCountdown: (data, duration) => this.handleCountdown(data, duration),
			onActive: (data) => this.handleActive(data),
			onEnded: (result) => this.handleEnded(result),
		});

		print("[DuelController] Initialized successfully with Cinematic Intro support.");
	}

	private handleInviteReceived(data: DuelInviteData): void {
		this.inviteView.show(
			data,
			() => {
				this.duelService.respondDuel(true);
			},
			() => {
				this.duelService.respondDuel(false);
			},
		);
	}

	private handleInviteCancelled(): void {
		this.inviteView.hide();
		this.cleanupCinematicCamera();
	}

	private handleIntro(data: DuelIntroData): void {
		this.inviteView.hide();
		BackpackController.getInstance().toggle(false);
		HotbarController.getInstance().setVisible(false);

		this.hudView.showIntro(data);
		this.playCinematicIntro(data);
	}

	private handleCountdown(data: DuelActiveData, duration: number): void {
		this.inviteView.hide();
		BackpackController.getInstance().toggle(false);
		HotbarController.getInstance().setVisible(false);

		if (this.isPlayingIntro) {
			this.cleanupCinematicCamera();
		} else {
			this.cinematicOverlay.hide();
		}

		// Play countdown (3... 2... 1... FIGHT!)
		this.hudView.startCountdown(duration, () => {
			this.equipCombatTool();
		});
	}

	private handleActive(data: DuelActiveData): void {
		this.cleanupCinematicCamera();
		BackpackController.getInstance().toggle(false);
		HotbarController.getInstance().setVisible(false);
		this.equipCombatTool();
		this.hudView.showActive(data);
	}

	private handleEnded(result: DuelEndData): void {
		this.cleanupCinematicCamera();
		this.hudView.showEnded(result, () => {
			this.unequipCombatTool();
			HotbarController.getInstance().setVisible(true);
		});

		// Ensure tools unequipped after a grace period
		task.delay(3.5, () => {
			this.unequipCombatTool();
			HotbarController.getInstance().setVisible(true);
		});
	}

	/**
	 * Sequences 3/4 low-angle camera shots highlighting both fighters,
	 * then smoothly transitions to over-the-shoulder combat camera facing the opponent.
	 */
	private playCinematicIntro(data: DuelIntroData): void {
		const camera = Workspace.CurrentCamera;
		if (!camera) return;

		this.isPlayingIntro = true;
		this.originalCameraType = camera.CameraType;
		camera.CameraType = Enum.CameraType.Scriptable;

		// Tampilkan letterbox sinematik persis settingan spawn animation
		this.cinematicOverlay.show();

		const player1 = Players.GetPlayerByUserId(data.player1UserId);
		const player2 = Players.GetPlayerByUserId(data.player2UserId);

		// Alokasikan 1.0 detik untuk transisi kamera menghadap lawan di akhir
		const transitionDuration = 1.0;
		const totalIntro = data.durationSeconds;
		const shotDuration = math.max(2.5, (totalIntro - transitionDuration) / 2);

		// Shot 1: Challenger (3/4 right front angle)
		this.playFighterThreeQuarterShot(player1, true, shotDuration, () => {
			if (!this.isPlayingIntro) return;

			// Shot 2: Opponent (3/4 left front angle)
			this.playFighterThreeQuarterShot(player2, false, shotDuration, () => {
				if (!this.isPlayingIntro) return;

				// Shot 3: Transisi halus ke arah fokus karakter lokal menghadap lawan
				this.transitionToCombatFacing(data, transitionDuration, () => {
					this.equipCombatTool();
				});
			});
		});
	}

	/**
	 * Smooth 3/4 side low-angle dolly camera focusing on a fighter with walk & fist equip animation.
	 */
	private playFighterThreeQuarterShot(
		fighter: Player | undefined,
		isRightSide: boolean,
		duration: number,
		onDone: () => void,
	): void {
		const camera = Workspace.CurrentCamera;
		if (!camera || !fighter) {
			task.delay(duration, onDone);
			return;
		}

		const char = fighter.Character;
		const hrp = char?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const hum = char?.FindFirstChildOfClass("Humanoid");
		const animator = hum?.FindFirstChildOfClass("Animator");

		if (!char || !hrp || !hum || !animator) {
			task.delay(duration, onDone);
			return;
		}

		const forward = hrp.CFrame.LookVector;
		const right = hrp.CFrame.RightVector;
		const chestTarget = hrp.Position.add(new Vector3(0, 1.25, 0));

		// 3/4 Side Angle: ~38 derajat menyamping dari depan karakter
		const angleRad = math.rad(38);
		const sideVector = isRightSide ? right : right.mul(-1);
		const threeQuarterDir = forward.mul(math.cos(angleRad)).add(sideVector.mul(math.sin(angleRad))).Unit;

		// Sudut rendah (low-angle): kamera di bawah level pinggang/lutut, menengadah ke dada & kepala
		const startDistance = 5.8;
		const endDistance = 4.0;
		const startHeight = -0.55;
		const endHeight = -0.35;

		const startPos = hrp.Position.add(threeQuarterDir.mul(startDistance)).add(new Vector3(0, startHeight, 0));
		const endPos = hrp.Position.add(threeQuarterDir.mul(endDistance)).add(new Vector3(0, endHeight, 0));

		const startCFrame = CFrame.lookAt(startPos, chestTarget);
		const endCFrame = CFrame.lookAt(endPos, chestTarget);
		camera.CFrame = startCFrame;

		this.activeCameraSpring?.destroy();
		this.activeCameraSpring = createSpring<CFrame>(startCFrame, SpringPresets.gentle);
		this.activeCameraSpring.onChange((cf: CFrame) => {
			camera.CFrame = cf;
		});
		this.activeCameraSpring.setGoal(endCFrame);

		// Play walking animation transitioning into fists equip pose
		let walkTrack: AnimationTrack | undefined;
		let equipTrack: AnimationTrack | undefined;

		const walkId = ARCZIS_COMBAT_CONFIG.Animations.CombatWalk;
		if (walkId && walkId !== "") {
			const anim = new Instance("Animation");
			anim.AnimationId = walkId;
			walkTrack = animator.LoadAnimation(anim);
			walkTrack.Priority = Enum.AnimationPriority.Action;
			walkTrack.Play(0.15);
			walkTrack.AdjustSpeed(0.8);
			this.activeTracks.push(walkTrack);
		}

		// Transisi dari walk ke pose kepal tinju di paruh waktu animasi
		const walkDuration = duration * 0.52;
		task.delay(walkDuration, () => {
			if (!this.isPlayingIntro) return;
			if (walkTrack && walkTrack.IsPlaying) {
				walkTrack.Stop(0.25);
			}

			const equipId = ARCZIS_COMBAT_CONFIG.Animations.Equip;
			if (equipId && equipId !== "") {
				const anim = new Instance("Animation");
				anim.AnimationId = equipId;
				equipTrack = animator.LoadAnimation(anim);
				equipTrack.Priority = Enum.AnimationPriority.Action2;
				equipTrack.Play(0.2);
				this.activeTracks.push(equipTrack);
			}
		});

		task.delay(duration, () => {
			if (walkTrack && walkTrack.IsPlaying) walkTrack.Stop(0.15);
			if (equipTrack && equipTrack.IsPlaying) equipTrack.Stop(0.25);
			onDone();
		});
	}

	/**
	 * Smooth camera transition panning directly behind the local character facing their opponent.
	 */
	private transitionToCombatFacing(data: DuelIntroData, duration: number, onDone: () => void): void {
		const camera = Workspace.CurrentCamera;
		if (!camera) {
			onDone();
			return;
		}

		const myChar = this.localPlayer.Character;
		const myHrp = myChar?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const myHum = myChar?.FindFirstChildOfClass("Humanoid");

		const opponentUserId =
			this.localPlayer.UserId === data.player1UserId ? data.player2UserId : data.player1UserId;
		const opponentPlayer = Players.GetPlayerByUserId(opponentUserId);
		const oppChar = opponentPlayer?.Character;
		const oppHrp = oppChar?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

		if (!myChar || !myHrp || !myHum || !oppHrp) {
			this.cleanupCinematicCamera();
			onDone();
			return;
		}

		// Arah horizontal karakter lokal ke lawan
		const diff = oppHrp.Position.sub(myHrp.Position);
		const flatDir = new Vector3(diff.X, 0, diff.Z).Unit;

		// Posisi kamera gameplay combat di belakang punggung menghadap lurus ke lawan
		const targetCamPos = myHrp.Position.sub(flatDir.mul(10.5)).add(new Vector3(0, 3.2, 0));
		const targetFocus = myHrp.Position.add(flatDir.mul(4.0)).add(new Vector3(0, 1.4, 0));
		const targetCombatCFrame = CFrame.lookAt(targetCamPos, targetFocus);

		// Mulai slide-out letterbox bar secara halus (persis spawn animation)
		this.cinematicOverlay.hide();

		this.activeCameraSpring?.destroy();
		this.activeCameraSpring = createSpring<CFrame>(camera.CFrame, SpringPresets.gentle);
		this.activeCameraSpring.onChange((cf: CFrame) => {
			camera.CFrame = cf;
		});

		let isCompleted = false;
		this.activeCameraSpring.onComplete(() => {
			if (isCompleted) return;
			isCompleted = true;
			if (this.isPlayingIntro) {
				camera.CameraSubject = myHum;
				camera.Focus = new CFrame(myHrp.Position);
				camera.CFrame = targetCombatCFrame;
				camera.CameraType = Enum.CameraType.Custom;
				this.isPlayingIntro = false;
				this.equipCombatTool();
			}
			onDone();
		});

		this.activeCameraSpring.setGoal(targetCombatCFrame);
	}

	private cleanupCinematicCamera(): void {
		this.activeCameraSpring?.destroy();
		this.activeCameraSpring = undefined;

		for (const track of this.activeTracks) {
			if (track.IsPlaying) {
				track.Stop(0.15);
			}
		}
		this.activeTracks = [];

		this.cinematicOverlay.hide();

		if (this.isPlayingIntro) {
			this.isPlayingIntro = false;
			const camera = Workspace.CurrentCamera;
			if (camera) {
				const char = this.localPlayer.Character;
				const hum = char?.FindFirstChildOfClass("Humanoid");
				if (hum) {
					camera.CameraSubject = hum;
				}
				camera.CameraType = Enum.CameraType.Custom;
			}
		}
	}

	/**
	 * Automatically equips Fists from character or backpack.
	 */
	private equipCombatTool(): void {
		const char = this.localPlayer.Character;
		if (!char) return;

		const hum = char.FindFirstChildOfClass("Humanoid");
		if (!hum || hum.Health <= 0) return;

		const tryEquip = (): boolean => {
			const currentTool = char.FindFirstChildOfClass("Tool");
			if (currentTool && currentTool.Name.lower().find("fist")[0] !== undefined) {
				return true;
			}

			const backpack = this.localPlayer.FindFirstChildOfClass("Backpack");
			if (backpack) {
				for (const tool of backpack.GetChildren()) {
					if (tool.IsA("Tool") && tool.Name.lower().find("fist")[0] !== undefined) {
						hum.EquipTool(tool);
						return true;
					}
				}
			}

			return false;
		};

		if (!tryEquip()) {
			task.spawn(() => {
				for (let attempt = 0; attempt < 10; attempt++) {
					task.wait(0.2);
					if (tryEquip()) break;
				}
			});
		}
	}

	/**
	 * Unequips any combat tools when duel ends.
	 */
	private unequipCombatTool(): void {
		const char = this.localPlayer.Character;
		if (!char) return;

		const hum = char.FindFirstChildOfClass("Humanoid");
		if (hum) {
			hum.UnequipTools();
		}
	}
}

