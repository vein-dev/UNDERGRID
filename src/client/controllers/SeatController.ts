import { CollectionService, Players } from "@rbxts/services";
import { DrumSeatHudView } from "client/ui/views/DrumSeatHudView";
import { SitPoseHudView } from "client/ui/views/SitPoseHudView";
import { DRUM_SEAT_CONFIG, DrumBeatItem, SEAT_CONFIG, SitPoseItem } from "shared/config";

/**
 * SeatController - Client controller managing custom sit poses and drum playing animations,
 * routing regular seats to SitPoseHudView and drum thrones to DrumSeatHudView.
 */
export class SeatController {
	private static instance?: SeatController;
	private player = Players.LocalPlayer;

	private seatedConn?: RBXScriptConnection;
	private diedConn?: RBXScriptConnection;
	private sitTrack?: AnimationTrack;

	private currentAnimator?: Animator;
	private currentHumanoid?: Humanoid;
	private activeSeatType?: "regular" | "drum";
	private currentPoseId: string = SEAT_CONFIG.DEFAULT_POSE_ID;
	private currentDrumBeatId: string = DRUM_SEAT_CONFIG.DEFAULT_BEAT_ID;
	private currentDrumSpeed: number = 1.0;

	private constructor() {}

	public static getInstance(): SeatController {
		if (!SeatController.instance) {
			SeatController.instance = new SeatController();
		}
		return SeatController.instance;
	}

	public init(): void {
		this.player.CharacterAdded.Connect((char) => this.bindCharacter(char));
		if (this.player.Character) {
			this.bindCharacter(this.player.Character);
		}

		print("[SeatController] Initialized successfully with separated regular sit & drum seat HUD support.");
	}

	private bindCharacter(character: Model): void {
		this.seatedConn?.Disconnect();
		this.diedConn?.Disconnect();
		this.stopCustomSitAnimation();
		this.hideAllHuds();

		const humanoid = character.WaitForChild("Humanoid") as Humanoid | undefined;
		if (!humanoid) return;

		let animator = humanoid.FindFirstChildOfClass("Animator");
		if (!animator) {
			animator = new Instance("Animator");
			animator.Parent = humanoid;
		}

		this.currentHumanoid = humanoid;
		this.currentAnimator = animator;

		// Listen to Seated event
		this.seatedConn = humanoid.Seated.Connect((active, currentSeat) => {
			if (active && currentSeat) {
				const isDrumSeat =
					CollectionService.HasTag(currentSeat, DRUM_SEAT_CONFIG.TAG) ||
					currentSeat.FindFirstAncestor("Drum") !== undefined ||
					currentSeat.Name.lower().find("drum")[0] !== undefined ||
					currentSeat.Parent?.Name.lower().find("drum")[0] !== undefined;

				const isRegularSeat =
					!isDrumSeat &&
					(CollectionService.HasTag(currentSeat, SEAT_CONFIG.TAG) ||
						currentSeat.IsA("Seat") ||
						currentSeat.Name === "Seat");

				if (isDrumSeat) {
					// Hide regular sit HUD
					SitPoseHudView.getInstance().hide();

					// Play default drum beat
					this.activeSeatType = "drum";
					this.currentDrumBeatId = DRUM_SEAT_CONFIG.DEFAULT_BEAT_ID;
					print(`[SeatController] Player seated on drum throne: '${currentSeat.GetFullName()}'.`);
					this.playDrumBeat(this.currentDrumBeatId);

					// Show Drum HUD
					DrumSeatHudView.getInstance().show(
						DRUM_SEAT_CONFIG.BEATS,
						this.currentDrumBeatId,
						this.currentDrumSpeed,
						(beatId) => this.selectDrumBeat(beatId),
						(newSpeed) => this.changeDrumSpeed(newSpeed),
						() => this.standUp(),
					);
				} else if (isRegularSeat) {
					// Hide drum HUD
					DrumSeatHudView.getInstance().hide();

					// Play default regular sit pose
					this.activeSeatType = "regular";
					this.currentPoseId = SEAT_CONFIG.DEFAULT_POSE_ID;
					print(`[SeatController] Player seated on regular seat: '${currentSeat.GetFullName()}'.`);
					this.playSitPose(this.currentPoseId);

					// Show Regular Sit Pose HUD
					SitPoseHudView.getInstance().show(
						SEAT_CONFIG.POSES,
						this.currentPoseId,
						(poseId) => this.selectPose(poseId),
						() => this.standUp(),
					);
				} else {
					this.hideAllHuds();
					this.stopCustomSitAnimation();
				}
			} else {
				this.hideAllHuds();
				this.stopCustomSitAnimation();
			}
		});

		// Clean up upon character death
		this.diedConn = humanoid.Died.Connect(() => {
			this.hideAllHuds();
			this.stopCustomSitAnimation();
		});
	}

	public selectPose(poseId: string): void {
		const targetPose = SEAT_CONFIG.POSES.find((p: SitPoseItem) => p.id === poseId);
		if (!targetPose) return;

		this.currentPoseId = poseId;
		this.playSitPose(poseId);
		SitPoseHudView.getInstance().setActivePoseId(poseId);
	}

	public selectDrumBeat(beatId: string): void {
		const targetBeat = DRUM_SEAT_CONFIG.BEATS.find((b: DrumBeatItem) => b.id === beatId);
		if (!targetBeat) return;

		this.currentDrumBeatId = beatId;
		this.playDrumBeat(beatId);
		DrumSeatHudView.getInstance().setActiveBeatId(beatId);
	}

	public changeDrumSpeed(speed: number): void {
		this.currentDrumSpeed = speed;
		if (this.sitTrack) {
			this.sitTrack.AdjustSpeed(speed);
		}
		DrumSeatHudView.getInstance().setSpeed(speed);
	}

	public standUp(): void {
		if (this.currentHumanoid) {
			this.currentHumanoid.Sit = false;
		}
		this.hideAllHuds();
		this.stopCustomSitAnimation();
	}

	private hideAllHuds(): void {
		SitPoseHudView.getInstance().hide();
		DrumSeatHudView.getInstance().hide();
		this.activeSeatType = undefined;
		this.currentDrumSpeed = 1.0;
	}

	private playSitPose(poseId: string): void {
		if (!this.currentAnimator) return;

		const targetPose = SEAT_CONFIG.POSES.find((p: SitPoseItem) => p.id === poseId);
		const animId = targetPose ? targetPose.animationId : SEAT_CONFIG.ANIMATION_ID;

		this.stopCustomSitAnimation();

		const anim = new Instance("Animation");
		anim.AnimationId = animId;

		const [success, track] = pcall(() => this.currentAnimator!.LoadAnimation(anim));
		if (success && track) {
			track.Priority = SEAT_CONFIG.ANIMATION_PRIORITY;
			track.Looped = true;
			track.Play(SEAT_CONFIG.FADE_TIME);
			this.sitTrack = track;
			print(`[SeatController] Playing sit pose '${targetPose?.name ?? poseId}' (${animId})`);
		} else {
			warn(`[SeatController] Failed to load sit animation track:`, track);
		}
	}

	private playDrumBeat(beatId: string): void {
		if (!this.currentAnimator) return;

		const targetBeat = DRUM_SEAT_CONFIG.BEATS.find((b: DrumBeatItem) => b.id === beatId);
		const animId = targetBeat ? targetBeat.animationId : DRUM_SEAT_CONFIG.BEATS[0].animationId;

		this.stopCustomSitAnimation();

		const anim = new Instance("Animation");
		anim.AnimationId = animId;

		const [success, track] = pcall(() => this.currentAnimator!.LoadAnimation(anim));
		if (success && track) {
			track.Priority = DRUM_SEAT_CONFIG.ANIMATION_PRIORITY;
			track.Looped = true;
			track.Play(DRUM_SEAT_CONFIG.FADE_TIME);
			track.AdjustSpeed(this.currentDrumSpeed);
			this.sitTrack = track;
			print(`[SeatController] Playing drum beat '${targetBeat?.name ?? beatId}' (${animId}) at speed ${this.currentDrumSpeed}x`);
		} else {
			warn(`[SeatController] Failed to load drum animation track:`, track);
		}
	}

	private stopCustomSitAnimation(): void {
		if (this.sitTrack) {
			this.sitTrack.Stop(SEAT_CONFIG.FADE_TIME);
			this.sitTrack.Destroy();
			this.sitTrack = undefined;
		}
	}
}
