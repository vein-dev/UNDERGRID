import { Debris, Players, TweenService } from "@rbxts/services";
import { EMOTE_CONFIG } from "shared/config";
import { getRemoteEvent } from "shared/network";
import { EmoteItem } from "shared/types";

/**
 * EmoteService - Client service managing emote animations, auto-cancelling upon movement,
 * and rendering replicated 3D Billboard reactions above characters' heads.
 */
export class EmoteService {
	private static instance?: EmoteService;
	private player = Players.LocalPlayer;

	private reactionEvent: RemoteEvent;
	private activeTrack?: AnimationTrack;
	private activeEmoteId?: string;
	private stateCallbacks: Array<(isPlaying: boolean, emoteId?: string) => void> = [];

	private moveConnection?: RBXScriptConnection;
	private jumpConnection?: RBXScriptConnection;

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
		this.moveConnection?.Disconnect();
		this.jumpConnection?.Disconnect();
		this.stopEmote();

		const humanoid = character.WaitForChild("Humanoid") as Humanoid | undefined;
		if (!humanoid) return;

		// Cancel dance/pose when moving
		this.moveConnection = humanoid.GetPropertyChangedSignal("MoveDirection").Connect(() => {
			if (humanoid.MoveDirection.Magnitude > 0.05 && this.activeTrack) {
				this.stopEmote();
			}
		});

		// Cancel dance/pose when jumping or falling
		this.jumpConnection = humanoid.StateChanged.Connect((_oldState, newState) => {
			if (
				(newState === Enum.HumanoidStateType.Jumping ||
					newState === Enum.HumanoidStateType.Freefall) &&
				this.activeTrack
			) {
				this.stopEmote();
			}
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

			this.activeTrack = track;
			this.activeEmoteId = item.id;
			this.notifyState(true, item.id);
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
		billboard.Size = new UDim2(0, 68, 0, 68);
		billboard.StudsOffset = new Vector3(0, 2.4, 0);
		billboard.MaxDistance = EMOTE_CONFIG.ReactionMaxDistance;
		billboard.AlwaysOnTop = false;
		billboard.ResetOnSpawn = false;

		const container = new Instance("CanvasGroup");
		container.Name = "EmojiContainer";
		container.Size = new UDim2(0, 64, 0, 64);
		container.Position = new UDim2(0.5, 0, 0.5, 0);
		container.AnchorPoint = new Vector2(0.5, 0.5);
		container.BackgroundColor3 = Color3.fromHex("#121620");
		container.BackgroundTransparency = 0.2;
		container.GroupTransparency = 1; // start invisible for pop-in

		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(0, 20);
		corner.Parent = container;

		const stroke = new Instance("UIStroke");
		stroke.Color = Color3.fromHex("#ffffff");
		stroke.Transparency = 0.75;
		stroke.Thickness = 1.5;
		stroke.Parent = container;

		const emojiLabel = new Instance("TextLabel");
		emojiLabel.Name = "EmojiLabel";
		emojiLabel.Size = new UDim2(1, -8, 1, -8);
		emojiLabel.Position = new UDim2(0.5, 0, 0.5, 0);
		emojiLabel.AnchorPoint = new Vector2(0.5, 0.5);
		emojiLabel.BackgroundTransparency = 1;
		emojiLabel.Text = emoji;
		emojiLabel.TextScaled = true;
		emojiLabel.Font = Enum.Font.GothamBold;
		emojiLabel.Parent = container;

		container.Parent = billboard;
		billboard.Parent = adornee;

		// 1. Pop-in Bounce Tween
		TweenService.Create(
			container,
			new TweenInfo(0.3, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
			{ GroupTransparency: 0 },
		).Play();

		// 2. Slow gentle float upward
		TweenService.Create(
			billboard,
			new TweenInfo(duration, Enum.EasingStyle.Sine, Enum.EasingDirection.Out),
			{ StudsOffset: new Vector3(0, 3.8, 0) },
		).Play();

		// 3. Fade out towards the end
		task.delay(duration - 0.45, () => {
			if (container.Parent) {
				const fadeTween = TweenService.Create(
					container,
					new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
					{ GroupTransparency: 1 },
				);
				fadeTween.Play();
				fadeTween.Completed.Connect(() => {
					billboard.Destroy();
				});
			}
		});

		Debris.AddItem(billboard, duration + 0.5);
	}
}
