import { ContentProvider } from "@rbxts/services";
import {
	DRUM_SEAT_CONFIG,
	EMOTE_CONFIG,
	GUITAR_ANIMATION_CONFIG,
	SEAT_CONFIG,
} from "shared/config";

/**
 * AnimationPreloadService - Preloads all game animation assets into client memory
 * on server startup to eliminate animation stutter and delay during gameplay.
 */
export class AnimationPreloadService {
	private static instance?: AnimationPreloadService;
	private isPreloaded = false;

	private constructor() {}

	public static getInstance(): AnimationPreloadService {
		if (!AnimationPreloadService.instance) {
			AnimationPreloadService.instance = new AnimationPreloadService();
		}
		return AnimationPreloadService.instance;
	}

	public init(): void {
		if (this.isPreloaded) return;
		this.isPreloaded = true;

		task.spawn(() => {
			this.preloadAllAnimations();
		});
	}

	private preloadAllAnimations(): void {
		const startTime = os.clock();
		const animIdSet = new Set<string>();

		// 1. Emotes (Dances & Poses)
		for (const dance of EMOTE_CONFIG.Dances) {
			if (dance.animationId && dance.animationId !== "") {
				animIdSet.add(dance.animationId);
			}
		}

		for (const pose of EMOTE_CONFIG.Poses) {
			if (pose.animationId && pose.animationId !== "") {
				animIdSet.add(pose.animationId);
			}
		}

		// 2. Sit Poses
		for (const seatPose of SEAT_CONFIG.POSES) {
			if (seatPose.animationId && seatPose.animationId !== "") {
				animIdSet.add(seatPose.animationId);
			}
		}

		// 3. Drum Beats
		for (const beat of DRUM_SEAT_CONFIG.BEATS) {
			if (beat.animationId && beat.animationId !== "") {
				animIdSet.add(beat.animationId);
			}
		}

		// 4. Guitar Solos
		for (const guitarAnim of GUITAR_ANIMATION_CONFIG.ANIMATIONS) {
			if (guitarAnim.animationId && guitarAnim.animationId !== "") {
				animIdSet.add(guitarAnim.animationId);
			}
		}

		// Create Animation instances for ContentProvider
		const animInstances: Animation[] = [];
		for (const animId of animIdSet) {
			const anim = new Instance("Animation");
			anim.AnimationId = animId;
			animInstances.push(anim);
		}

		if (animInstances.size() === 0) return;

		print(
			`[AnimationPreloadService] Starting preload for ${animInstances.size()} unique animations...`,
		);

		const [success, err] = pcall(() => {
			ContentProvider.PreloadAsync(animInstances);
		});

		// Clean up temporary Animation instances
		for (const anim of animInstances) {
			anim.Destroy();
		}

		const elapsed = math.round((os.clock() - startTime) * 100) / 100;
		if (success) {
			print(
				`[AnimationPreloadService] Successfully preloaded ${animInstances.size()} animations in ${elapsed}s.`,
			);
		} else {
			warn(`[AnimationPreloadService] Warning during PreloadAsync:`, err);
		}
	}
}
