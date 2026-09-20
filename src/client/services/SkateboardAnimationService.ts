import { ContentProvider, ReplicatedStorage } from "@rbxts/services";
import { SkateboardConfig } from "shared/config";

export class SkateboardAnimationService {
	private static instance: SkateboardAnimationService;

	private cachedTracks = new Map<string, AnimationTrack>();
	private currentAnimator?: Animator;

	private constructor() {
		this.preloadAnimationAssets();
	}

	public static getInstance(): SkateboardAnimationService {
		if (!SkateboardAnimationService.instance) {
			SkateboardAnimationService.instance = new SkateboardAnimationService();
		}
		return SkateboardAnimationService.instance;
	}

	/**
	 * Preload seluruh aset animasi ke memori client menggunakan ContentProvider
	 */
	private preloadAnimationAssets(): void {
		const animInstances: Animation[] = [];
		for (const [_, id] of pairs(SkateboardConfig.ANIMATIONS)) {
			const formattedId = this.resolveAnimationId(id as string);
			const anim = new Instance("Animation");
			anim.AnimationId = formattedId;
			animInstances.push(anim);
		}
		task.spawn(() => {
			const [ok, err] = pcall(() => ContentProvider.PreloadAsync(animInstances));
			if (ok) {
				print("[SkateboardAnimationService] All animation assets preloaded into memory.");
			} else {
				warn(`[SkateboardAnimationService] PreloadAsync warning: ${tostring(err)}`);
			}
		});
	}

	/**
	 * Set animator karakter dan langsung muat SEMUA track ke cache (0ms delay pada trik pertama)
	 */
	public setAnimator(animator: Animator): void {
		if (!animator || !animator.IsDescendantOf(game)) {
			warn("[SkateboardAnimationService] setAnimator received invalid/unparented Animator.");
			return;
		}

		if (this.currentAnimator !== animator) {
			this.cleanup();
			this.currentAnimator = animator;
			this.cacheAllAnimationTracks(animator);
		}
	}

	/**
	 * Muat semua AnimationTrack ke dalam memori seketika (mencegah T-pose dan lag pertama kali trik)
	 */
	private cacheAllAnimationTracks(animator: Animator): void {
		if (!animator || !animator.IsDescendantOf(game)) return;

		for (const [key, id] of pairs(SkateboardConfig.ANIMATIONS)) {
			try {
				const formattedId = this.resolveAnimationId(id as string);
				const anim = new Instance("Animation");
				anim.AnimationId = formattedId;

				const [ok, trackOrErr] = pcall(() => animator.LoadAnimation(anim));
				if (ok && trackOrErr) {
					const track = trackOrErr as AnimationTrack;
					const keyStr = tostring(key);
					this.cachedTracks.set(keyStr, track);
					this.cachedTracks.set(keyStr.lower(), track);
					const capitalized = keyStr.sub(1, 1).upper() + keyStr.sub(2);
					this.cachedTracks.set(capitalized, track);
					this.cachedTracks.set(id as string, track);
					this.cachedTracks.set(formattedId, track);
				} else {
					warn(`[SkateboardAnimationService] Could not cache animation for key '${tostring(key)}' (${formattedId}): ${tostring(trackOrErr)}`);
				}
			} catch (err) {
				warn(`[SkateboardAnimationService] Error caching animation for key '${tostring(key)}': ${tostring(err)}`);
			}
		}
		print("[SkateboardAnimationService] Animation tracks cached for animator.");
	}

	private resolveAnimationId(animId: string): string {
		// 1. Prioritaskan Real Published Asset ID resmi dari SkateboardConfig.ANIMATIONS
		const animConfig = SkateboardConfig.ANIMATIONS as Record<string, string>;
		if (animConfig[animId] && animConfig[animId] !== "") {
			return animConfig[animId];
		}

		const lowerKey = animId.lower();
		for (const [k, v] of pairs(animConfig)) {
			if (tostring(k).lower() === lowerKey && v !== "") {
				return v;
			}
		}

		// Jika animId sudah berupa URL asset id resmi (rbxassetid://...)
		if (animId.find("^rbxassetid://%d+")[0] !== undefined) {
			return animId;
		}

		// Jika animId berupa angka numerik murni
		if (tonumber(animId) !== undefined) {
			return `rbxassetid://${animId}`;
		}

		// 2. Fallback: Cek folder SkateboardAnimationIds (StringValue) jika tidak terdaftar di config
		const idFolder = ReplicatedStorage.FindFirstChild("SkateboardAnimationIds") as Folder | undefined;
		if (idFolder) {
			const val = idFolder.FindFirstChild(animId) as StringValue | undefined;
			if (val && val.Value !== "") {
				return val.Value;
			}
		}

		// 3. Fallback: Cek folder SkateboardAnimations (Animation instance)
		const folder = ReplicatedStorage.FindFirstChild("SkateboardAnimations") as Folder | undefined;
		if (folder) {
			const direct = folder.FindFirstChild(animId) as Animation | undefined;
			if (direct && direct.AnimationId !== "") {
				return direct.AnimationId;
			}
		}

		return animId.find("^rbxassetid://")[0] !== undefined ? animId : `rbxassetid://${animId}`;
	}

	/**
	 * Memuat dan memutar animasi secara langsung menggunakan Pure Asset ID atau Server Registered ID.
	 * Mengembalikan boolean apakah animasi berhasil diputar.
	 */
	public playAnimation(
		animId: string,
		priority: Enum.AnimationPriority = Enum.AnimationPriority.Action,
		looped = false,
		fadeTime = 0.15,
		speed = 1.0,
	): boolean {
		if (!this.currentAnimator || !this.currentAnimator.IsDescendantOf(game) || animId === "") {
			return false;
		}

		let track = this.cachedTracks.get(animId) ?? this.cachedTracks.get(animId.lower());
		if (!track) {
			const formattedId = this.resolveAnimationId(animId);
			track = this.cachedTracks.get(formattedId);
			if (!track) {
				warn(`[SkateboardAnimationService] Track '${animId}' not found in cache. Loading on-demand fallback.`);
				const animInstance = new Instance("Animation");
				animInstance.AnimationId = formattedId;

				const [ok, loadedTrackOrErr] = pcall(() => this.currentAnimator!.LoadAnimation(animInstance));
				if (ok && loadedTrackOrErr) {
					track = loadedTrackOrErr as AnimationTrack;
					this.cachedTracks.set(animId, track);
					this.cachedTracks.set(animId.lower(), track);
					this.cachedTracks.set(formattedId, track);
				} else {
					warn(`[SkateboardAnimationService] Failed on-demand load for '${animId}': ${tostring(loadedTrackOrErr)}`);
					return false;
				}
			}
		}

		const [playOk, playErr] = pcall(() => {
			track!.Priority = priority;
			track!.Looped = looped;
			track!.Play(fadeTime, 1, speed);
		});

		if (!playOk) {
			warn(`[SkateboardAnimationService] Error playing animation '${animId}': ${tostring(playErr)}`);
			return false;
		}

		return true;
	}

	/**
	 * Memuat dan memutar animasi pada Animator tertentu (misal karakter pemain lain)
	 */
	public playAnimationFor(
		animator: Animator,
		animId: string,
		priority: Enum.AnimationPriority = Enum.AnimationPriority.Action,
		looped = false,
		fadeTime = 0.05,
		speed = 1.0,
	): boolean {
		if (!animator || !animator.IsDescendantOf(game) || animId === "") return false;

		const formattedId = this.resolveAnimationId(animId);
		const animInstance = new Instance("Animation");
		animInstance.AnimationId = formattedId;

		const [ok, trackOrErr] = pcall(() => animator.LoadAnimation(animInstance));
		if (!ok || !trackOrErr) {
			warn(`[SkateboardAnimationService] Failed playAnimationFor '${animId}': ${tostring(trackOrErr)}`);
			return false;
		}

		const track = trackOrErr as AnimationTrack;
		const [playOk, playErr] = pcall(() => {
			track.Priority = priority;
			track.Looped = looped;
			track.Play(fadeTime, 1, speed);
		});

		if (!playOk) {
			warn(`[SkateboardAnimationService] Error playing animation for other player '${animId}': ${tostring(playErr)}`);
			return false;
		}

		return true;
	}

	/**
	 * Mengambil track animasi berdasarkan Asset ID atau nama trik
	 */
	public getTrack(animId: string): AnimationTrack | undefined {
		let track =
			this.cachedTracks.get(animId) ??
			this.cachedTracks.get(animId.lower()) ??
			this.cachedTracks.get(this.resolveAnimationId(animId));

		if (!track && this.currentAnimator && this.currentAnimator.IsDescendantOf(game)) {
			const formattedId = this.resolveAnimationId(animId);
			const animInstance = new Instance("Animation");
			animInstance.AnimationId = formattedId;

			const [ok, loadedTrack] = pcall(() => this.currentAnimator!.LoadAnimation(animInstance));
			if (ok && loadedTrack) {
				track = loadedTrack as AnimationTrack;
				this.cachedTracks.set(animId, track);
				this.cachedTracks.set(animId.lower(), track);
				this.cachedTracks.set(formattedId, track);
			}
		}

		return track;
	}

	/**
	 * Mengatur kecepatan pemutaran animasi secara dinamis
	 */
	public adjustSpeed(animId: string, speed: number): void {
		const track = this.getTrack(animId);
		if (track && track.IsPlaying) {
			track.AdjustSpeed(speed);
		}
	}

	/**
	 * Memeriksa apakah animasi tertentu sedang aktif diputar
	 */
	public isPlaying(animId: string): boolean {
		const track = this.getTrack(animId);
		return track !== undefined && track.IsPlaying;
	}

	/**
	 * Menghentikan animasi berdasarkan Asset ID atau nama trik
	 */
	public stopAnimation(animId: string, fadeTime = 0.15): void {
		const track = this.getTrack(animId);
		if (track && track.IsPlaying) {
			track.Stop(fadeTime);
		}
	}

	/**
	 * Menghentikan seluruh animasi skateboard yang sedang berjalan tanpa menghapus cache track
	 */
	public stopAll(fadeTime = 0.1): void {
		const stopped = new Set<AnimationTrack>();
		for (const [_, track] of this.cachedTracks) {
			if (!stopped.has(track)) {
				stopped.add(track);
				if (track.IsPlaying) {
					track.Stop(fadeTime);
				}
			}
		}
	}

	/**
	 * Menghapus cache track saat karakter respawn atau mati
	 */
	public cleanup(): void {
		this.stopAll(0);
		const destroyed = new Set<AnimationTrack>();
		for (const [_, track] of this.cachedTracks) {
			if (!destroyed.has(track)) {
				destroyed.add(track);
				track.Destroy();
			}
		}
		this.cachedTracks.clear();
		this.currentAnimator = undefined;
	}
}
