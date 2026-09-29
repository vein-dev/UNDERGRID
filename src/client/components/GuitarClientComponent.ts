/**
 * GuitarClientComponent.ts
 * OOP Client Component bound to the Guitar Tools ("Strato", "Gibson", "Bass") for LocalPlayer.
 *
 * - Meredam animasi kaku default Roblox (toolnone / slash) saat gitar di-equip.
 * - Memastikan lengan avatar bergerak alami saat berjalan, lari, atau diam
 *   sembari gitar terpasang rapi di dada.
 * - Membuka GuitarHudView saat di-equip dan memainkan animasi gitar yang dipilih.
 */

import { Players } from "@rbxts/services";
import { GuitarHudView } from "client/ui/views/GuitarHudView";
import { GUITAR_ANIMATION_CONFIG, GuitarAnimationItem } from "shared/config";
import { IToolComponent } from "./IToolComponent";

export class GuitarClientComponent implements IToolComponent {
	private connections: RBXScriptConnection[] = [];
	private equippedConnections: RBXScriptConnection[] = [];
	private currentTrack?: AnimationTrack;
	private activeAnimationId: string = GUITAR_ANIMATION_CONFIG.DEFAULT_ANIMATION_ID;
	private isPlaying = false;
	private currentSpeed = 1.0;

	constructor(public readonly tool: Tool) {
		this.init();
	}

	private init(): void {
		this.connections.push(
			this.tool.Equipped.Connect(() => this.onEquipped()),
			this.tool.Unequipped.Connect(() => this.onUnequipped()),
		);

		if (this.tool.Parent === Players.LocalPlayer.Character) {
			this.onEquipped();
		}

		print("[GuitarClientComponent] Initialized for Tool:", this.tool.Name);
	}

	private onEquipped(): void {
		this.cleanupEquippedConnections();

		const character = (this.tool.Parent as Model | undefined) ?? Players.LocalPlayer.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");

		if (humanoid) {
			// Hentikan animasi default tool Roblox (toolnone & slash) agar lengan tidak kaku mengacung
			for (const track of humanoid.GetPlayingAnimationTracks()) {
				const name = track.Name.lower();
				const animName = track.Animation?.Name.lower() ?? "";
				if (
					name.find("toolnone")[0] !== undefined ||
					animName.find("toolnone")[0] !== undefined ||
					name.find("slash")[0] !== undefined ||
					animName.find("slash")[0] !== undefined
				) {
					track.Stop(0);
				}
			}

			this.equippedConnections.push(
				humanoid.AnimationPlayed.Connect((track) => {
					const name = track.Name.lower();
					const animName = track.Animation?.Name.lower() ?? "";
					if (
						name.find("toolnone")[0] !== undefined ||
						animName.find("toolnone")[0] !== undefined ||
						name.find("slash")[0] !== undefined ||
						animName.find("slash")[0] !== undefined
					) {
						track.Stop(0);
					}
				}),
				humanoid.Died.Connect(() => {
					this.stopAnimation();
					GuitarHudView.getInstance().hide();
				}),
			);
		}

		// Bersihkan RightGrip bawaan jika sempat dibuat oleh client
		const rightArm = (character?.FindFirstChild("Right Arm") ?? character?.FindFirstChild("RightHand")) as
			| BasePart
			| undefined;
		if (rightArm) {
			for (const child of rightArm.GetChildren()) {
				if (child.IsA("Weld") && (child.Name === "RightGrip" || child.Name === "Grip")) {
					child.Destroy();
				}
			}
		}

		print("[GuitarClientComponent] Guitar equipped cleanly on chest. Starting guitar session.");

		// Play default guitar animation
		this.playAnimation(this.activeAnimationId);

		// Show Guitar HUD
		GuitarHudView.getInstance().show(
			GUITAR_ANIMATION_CONFIG.ANIMATIONS,
			this.activeAnimationId,
			this.isPlaying,
			this.currentSpeed,
			(animId) => this.selectAnimation(animId),
			(speed) => this.changeSpeed(speed),
			() => this.stopAnimation(),
		);
	}

	public selectAnimation(animId: string): void {
		this.activeAnimationId = animId;
		this.playAnimation(animId);
		GuitarHudView.getInstance().setActiveAnimationId(animId, true);
	}

	public changeSpeed(newSpeed: number): void {
		this.currentSpeed = newSpeed;
		if (this.currentTrack) {
			this.currentTrack.AdjustSpeed(newSpeed);
		}
		GuitarHudView.getInstance().setSpeed(newSpeed);
	}

	public playAnimation(animId: string): void {
		const character = (this.tool.Parent as Model | undefined) ?? Players.LocalPlayer.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		if (!humanoid) return;

		let animator = humanoid.FindFirstChildOfClass("Animator");
		if (!animator) {
			animator = new Instance("Animator");
			animator.Parent = humanoid;
		}

		const animItem = GUITAR_ANIMATION_CONFIG.ANIMATIONS.find((a: GuitarAnimationItem) => a.id === animId);
		const assetId = animItem ? animItem.animationId : GUITAR_ANIMATION_CONFIG.ANIMATIONS[0].animationId;

		this.stopAnimationTrackOnly();

		const anim = new Instance("Animation");
		anim.AnimationId = assetId;

		const [success, track] = pcall(() => animator!.LoadAnimation(anim));
		if (success && track) {
			track.Priority = GUITAR_ANIMATION_CONFIG.ANIMATION_PRIORITY;
			track.Looped = true;
			track.Play(GUITAR_ANIMATION_CONFIG.FADE_TIME);
			track.AdjustSpeed(this.currentSpeed);
			this.currentTrack = track;
			this.isPlaying = true;
			print(`[GuitarClientComponent] Playing guitar animation '${animItem?.name ?? animId}' (${assetId}) at speed ${this.currentSpeed}x`);
		} else {
			warn("[GuitarClientComponent] Failed to load guitar animation:", track);
		}
	}

	public stopAnimation(): void {
		this.stopAnimationTrackOnly();
		this.isPlaying = false;
		GuitarHudView.getInstance().setIsPlaying(false);
	}

	private stopAnimationTrackOnly(): void {
		if (this.currentTrack) {
			this.currentTrack.Stop(GUITAR_ANIMATION_CONFIG.FADE_TIME);
			this.currentTrack.Destroy();
			this.currentTrack = undefined;
		}
	}

	private onUnequipped(): void {
		this.cleanupEquippedConnections();
		this.stopAnimation();
		this.currentSpeed = 1.0;
		GuitarHudView.getInstance().hide();
		print("[GuitarClientComponent] Guitar unequipped. HUD closed.");
	}

	private cleanupEquippedConnections(): void {
		for (const conn of this.equippedConnections) {
			conn.Disconnect();
		}
		this.equippedConnections = [];
	}

	public destroy(): void {
		for (const conn of this.connections) {
			conn.Disconnect();
		}
		this.connections = [];
		this.cleanupEquippedConnections();
		this.stopAnimation();
		GuitarHudView.getInstance().hide();
		print("[GuitarClientComponent] Destroyed.");
	}
}
