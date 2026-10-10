import { Debris, Players } from "@rbxts/services";
import { EMOTE_CONFIG } from "shared/config";
import { getRemoteEvent } from "shared/network";
import { EmoteItem } from "shared/types";
import { createSpring, SpringPresets } from "client/ui/SpringConfig";

/**
 * EmoteService - Client service managing emote animations,
 * and rendering replicated 3D Billboard reactions above characters' heads.
 */
export class EmoteService {
	private static instance?: EmoteService;
	private player = Players.LocalPlayer;

	private reactionEvent: RemoteEvent;
	private activeTrack?: AnimationTrack;
	private activeEmoteId?: string;
	private stateCallbacks: Array<(isPlaying: boolean, emoteId?: string) => void> = [];
	private playbackSpeed = 1.0;
	private speedCallbacks: Array<(speed: number) => void> = [];

	private diedConnection?: RBXScriptConnection;

	private constructor() {
		this.reactionEvent = getRemoteEvent("EmoteReactionEvent");
	}

	public static getInstance(): EmoteService {
		if (!EmoteService.instance) {
			EmoteService.instance = new EmoteService();
		}
		return EmoteService.instance;
	}

	public init(): void {
		// Listen for reaction events broadcasted by server
		this.reactionEvent.OnClientEvent.Connect(
			(action: unknown, senderPlayer: unknown, emoji: unknown, duration: unknown) => {
				if (action === "PlayReaction" && senderPlayer && typeIs(emoji, "string")) {
					this.displayReactionBillboard(
						senderPlayer as Player,
						emoji,
						typeIs(duration, "number") ? duration : EMOTE_CONFIG.ReactionDuration,
					);
				}
			},
		);

		// Character lifecycle
		this.player.CharacterAdded.Connect((char) => this.bindCharacter(char));
		if (this.player.Character) {
			this.bindCharacter(this.player.Character);
		}

		print("[EmoteService] Initialized successfully with animation & reaction renderer.");
	}

	private bindCharacter(character: Model): void {
		this.diedConnection?.Disconnect();
		this.stopEmote();

		const humanoid = character.WaitForChild("Humanoid") as Humanoid | undefined;
		if (!humanoid) return;

		// Clean up emote animation if character dies
		this.diedConnection = humanoid.Died.Connect(() => {
			this.stopEmote();
		});
	}

	public onStateChanged(callback: (isPlaying: boolean, emoteId?: string) => void): () => void {
		this.stateCallbacks.push(callback);
		return () => {
			this.stateCallbacks = this.stateCallbacks.filter((cb) => cb !== callback);
		};
	}

	private notifyState(isPlaying: boolean, emoteId?: string): void {
		for (const cb of this.stateCallbacks) {
			cb(isPlaying, emoteId);
		}
	}

	public isPlaying(): boolean {
		return this.activeTrack !== undefined && this.activeTrack.IsPlaying;
	}

	public getActiveEmoteId(): string | undefined {
		return this.activeEmoteId;
	}

	public getPlaybackSpeed(): number {
		return this.playbackSpeed;
	}

	public setPlaybackSpeed(speed: number): void {
		const clamped = math.clamp(math.round(speed * 10) / 10, 0.2, 2.0);
		this.playbackSpeed = clamped;
		if (this.activeTrack && this.activeTrack.IsPlaying) {
			this.activeTrack.AdjustSpeed(clamped);
		}
		for (const cb of this.speedCallbacks) {
			cb(clamped);
		}
	}

	public onSpeedChanged(callback: (speed: number) => void): () => void {
		this.speedCallbacks.push(callback);
		return () => {
			this.speedCallbacks = this.speedCallbacks.filter((cb) => cb !== callback);
		};
	}

	public playEmote(item: EmoteItem): void {
		if (item.category === "Reaction") {
			// Trigger server-replicated floating reaction
			this.reactionEvent.FireServer("SendReaction", item.icon ?? item.name);
			return;
		}

		// Dance or Pose
		this.stopEmote();

		const character = this.player.Character;
		if (!character) return;
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (!humanoid || humanoid.Health <= 0) return;

		let animator = humanoid.FindFirstChildOfClass("Animator");
		if (!animator) {
			animator = new Instance("Animator");
			animator.Parent = humanoid;
		}

		if (!item.animationId || item.animationId === "") {
			warn(`[EmoteService] Emote '${item.name}' tidak memiliki AnimationId.`);
			return;
		}

		const anim = new Instance("Animation");
		anim.AnimationId = item.animationId;

		const [success, track] = pcall(() => animator!.LoadAnimation(anim));
		if (success && track) {
			track.Priority = Enum.AnimationPriority.Action;
			track.Looped = true;
			track.Play(0.2);
			track.AdjustSpeed(this.playbackSpeed);

			this.activeTrack = track;
			this.activeEmoteId = item.id;
			this.notifyState(true, item.id);
			this.reactionEvent.FireServer("StartEmote", item.id);
		} else {
			warn(`[EmoteService] Gagal memuat animasi emote '${item.name}':`, track);
		}
	}

	public stopEmote(): void {
		if (this.activeTrack) {
			this.activeTrack.Stop(0.2);
			this.activeTrack.Destroy();
			this.activeTrack = undefined;
		}
		if (this.activeEmoteId !== undefined) {
			this.activeEmoteId = undefined;
			this.notifyState(false);
			this.reactionEvent.FireServer("StopEmote");
		}
	}

	/**
	 * Renders a juicy pop-up BillboardGui above the target player's head.
	 */
	private displayReactionBillboard(targetPlayer: Player, emoji: string, duration: number): void {
		const char = targetPlayer.Character;
		if (!char) return;
		const head = char.FindFirstChild("Head") as BasePart | undefined;
		const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		const adornee = head ?? hrp;
		if (!adornee) return;

		// Clean up existing reaction billboard on this character if any
		const existing = adornee.FindFirstChild("ReactionBillboard");
		if (existing) {
			existing.Destroy();
		}

		const billboard = new Instance("BillboardGui");
		billboard.Name = "ReactionBillboard";
		billboard.Adornee = adornee;
		billboard.Size = new UDim2(0, 110, 0, 110);
		billboard.StudsOffset = new Vector3(0, 2.6, 0);
		billboard.MaxDistance = EMOTE_CONFIG.ReactionMaxDistance;
		billboard.AlwaysOnTop = false;
		billboard.ResetOnSpawn = false;

		const container = new Instance("CanvasGroup");
		container.Name = "EmojiContainer";
		container.Size = new UDim2(0.2, 0, 0.2, 0);
		container.Position = new UDim2(0.5, 0, 0.5, 0);
		container.AnchorPoint = new Vector2(0.5, 0.5);
		container.BackgroundTransparency = 1;
		container.GroupTransparency = 1; // start invisible for pop-in

		const emojiLabel = new Instance("TextLabel");
		emojiLabel.Name = "EmojiLabel";
		emojiLabel.Size = new UDim2(1, 0, 1, 0);
		emojiLabel.Position = new UDim2(0.5, 0, 0.5, 0);
		emojiLabel.AnchorPoint = new Vector2(0.5, 0.5);
		emojiLabel.BackgroundTransparency = 1;
		emojiLabel.Text = emoji;
		emojiLabel.TextScaled = true;
		emojiLabel.Font = Enum.Font.GothamBold;
		emojiLabel.Parent = container;

		container.Parent = billboard;
		billboard.Parent = adornee;

		// 1. Pop-in Bouncy Spring (Scale & Opacity)
		const scaleSpring = createSpring(0.2, SpringPresets.bouncy);
		scaleSpring.onChange((scale: number) => {
			if (container.Parent) {
				container.Size = new UDim2(scale, 0, scale, 0);
			}
		});
		scaleSpring.setGoal(1.0);

		const transSpring = createSpring(1.0, SpringPresets.snappy);
		transSpring.onChange((trans: number) => {
			if (container.Parent) {
				container.GroupTransparency = trans;
			}
		});
		transSpring.setGoal(0);

		// 2. Slow gentle float upward with physics spring
		const floatSpring = createSpring(new Vector3(0, 2.6, 0), SpringPresets.gentle);
		floatSpring.onChange((offset: Vector3) => {
			if (billboard.Parent) {
				billboard.StudsOffset = offset;
			}
		});
		floatSpring.setGoal(new Vector3(0, 4.2, 0));

		// 3. Fade out & subtle bloom towards the end
		task.delay(math.max(0.1, duration - 0.45), () => {
			if (container.Parent) {
				scaleSpring.setGoal(1.2);
				transSpring.setGoal(1.0);
				transSpring.onComplete((trans: number) => {
					if (trans >= 0.95) {
						scaleSpring.destroy();
						transSpring.destroy();
						floatSpring.destroy();
						billboard.Destroy();
					}
				});
			}
		});

		Debris.AddItem(billboard, duration + 0.5);
	}
}
