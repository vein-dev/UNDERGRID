import { Players, ReplicatedStorage, RunService, SoundService, Workspace } from "@rbxts/services";
import { MovementConfig } from "shared/config/MovementConfig";

interface FootstepModuleApi {
	GetCached(soundGroup: SoundGroup, soundType: string): Record<string, Record<string, Sound[]>>;
	GetTableFromMaterial(material: Enum.Material | string): string | undefined;
}

export class FootstepController {
	private static instance?: FootstepController;

	private readonly player: Player;
	private rayParams: RaycastParams;
	private elapsedSinceLastStep = 0;
	private lastFloorMaterial: Enum.Material = Enum.Material.Plastic;

	private cachedFootsteps?: Record<string, Record<string, Sound[]>>;
	private cachedLanding?: Record<string, Record<string, Sound[]>>;
	private cachedJumping?: Record<string, Record<string, Sound[]>>;
	private footstepApi?: FootstepModuleApi;
	private isMuted = false;

	private constructor() {
		this.player = Players.LocalPlayer;
		this.rayParams = new RaycastParams();
		this.rayParams.FilterType = Enum.RaycastFilterType.Exclude;
		this.rayParams.IgnoreWater = true;

		this.init();
	}

	public static getInstance(): FootstepController {
		if (!FootstepController.instance) {
			FootstepController.instance = new FootstepController();
		}
		return FootstepController.instance;
	}

	private init(): void {
		// Initialize FootstepModule from ReplicatedStorage
		const modulesFolder = ReplicatedStorage.WaitForChild("Modules", 10) as Folder | undefined;
		const fsmModule = modulesFolder?.WaitForChild("FootstepModule", 10) as ModuleScript | undefined;

		if (fsmModule) {
			try {
				this.footstepApi = require(fsmModule) as FootstepModuleApi;

				const mainSG = SoundService.WaitForChild("Main", 10) as SoundGroup | undefined;
				const charSG = mainSG?.WaitForChild("Character", 10) as SoundGroup | undefined;

				if (charSG) {
					const footstepsSG = charSG.WaitForChild("Footsteps", 5) as SoundGroup | undefined;
					const landingSG = charSG.WaitForChild("Landing", 5) as SoundGroup | undefined;
					const jumpingSG = charSG.WaitForChild("Jumping", 5) as SoundGroup | undefined;

					if (footstepsSG) this.cachedFootsteps = this.footstepApi.GetCached(footstepsSG, "Footsteps");
					if (landingSG) this.cachedLanding = this.footstepApi.GetCached(landingSG, "Landing");
					if (jumpingSG) this.cachedJumping = this.footstepApi.GetCached(jumpingSG, "Jumping");

					print("[FootstepController] Footstep audio caches initialized successfully.");
				} else {
					warn("[FootstepController] Character SoundGroup not found in SoundService.Main!");
				}
			} catch (err) {
				warn("[FootstepController] Error loading FootstepModule cache:", err);
			}
		}

		if (this.player.Character) {
			this.onCharacterAdded(this.player.Character);
		}
		this.player.CharacterAdded.Connect((char) => this.onCharacterAdded(char));

		RunService.Heartbeat.Connect((dt) => {
			this.onHeartbeat(dt);
		});

		print("[FootstepController] Footstep System Controller initialized successfully.");
	}

	private onCharacterAdded(char: Model): void {
		this.rayParams.FilterDescendantsInstances = [char, Workspace.CurrentCamera ?? char];
		this.elapsedSinceLastStep = 0;

		const humanoid = char.WaitForChild("Humanoid") as Humanoid;
		const hrp = char.WaitForChild("HumanoidRootPart") as BasePart;

		// Mute default Roblox plastic slap footsteps so only custom template audio plays
		const muteDefaultSound = (name: string) => {
			const existing = hrp.FindFirstChild(name) as Sound | undefined;
			if (existing && existing.IsA("Sound")) {
				existing.Volume = 0;
			}
			hrp.ChildAdded.Connect((child) => {
				if (child.Name === name && child.IsA("Sound")) {
					child.Volume = 0;
					child.GetPropertyChangedSignal("Volume").Connect(() => {
						if (child.Volume > 0) child.Volume = 0;
					});
				}
			});
		};

		muteDefaultSound("Running");
		muteDefaultSound("Jumping");
		muteDefaultSound("Landing");
		muteDefaultSound("Climbing");

		humanoid.StateChanged.Connect((_oldState, newState) => {
			if (this.isMuted || hrp.GetAttribute("IsSkating") === true) return;
			if (newState === Enum.HumanoidStateType.Landed) {
				this.playActionSound("Landing", hrp);
			} else if (newState === Enum.HumanoidStateType.Jumping) {
				this.playActionSound("Jumping", hrp);
			}
		});
	}

	public setMuted(muted: boolean): void {
		this.isMuted = muted;
	}

	private onHeartbeat(dt: number): void {
		const char = this.player.Character;
		const humanoid = char?.FindFirstChildOfClass("Humanoid");
		const hrp = char?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (this.isMuted || hrp?.GetAttribute("IsSkating") === true) return;
		if (!char || !humanoid || !hrp || humanoid.Health <= 0) return;

		const velocity = hrp.AssemblyLinearVelocity;
		const flatSpeed = new Vector3(velocity.X, 0, velocity.Z).Magnitude;
		const isMoving = flatSpeed >= 0.5 || humanoid.MoveDirection.Magnitude > 0.1;

		const defaultWalkSpeed = 16;
		const footstepInterval = defaultWalkSpeed / MovementConfig.FOOTSTEPS.footstepsPerSecond; // 16 / 2.5 = 6.4

		if (!isMoving) {
			// Pre-charge the timer so the first step upon moving sounds immediately
			this.elapsedSinceLastStep = footstepInterval * 0.9;
			return;
		}

		const currentState = humanoid.GetState();
		const isClimbing = currentState === Enum.HumanoidStateType.Climbing;
		const isRunning = currentState === Enum.HumanoidStateType.Running;

		if (!isRunning && !isClimbing) {
			return;
		}

		// Detect floor material: prioritize humanoid property, fallback to raycast
		let floorMat = humanoid.FloorMaterial;
		if (floorMat === Enum.Material.Air) {
			const hipHeight = humanoid.HipHeight > 0 ? humanoid.HipHeight : 2;
			const rayDistance = hrp.Size.Y / 2 + hipHeight + 3;
			const rayResult = Workspace.Raycast(hrp.Position, new Vector3(0, -rayDistance, 0), this.rayParams);
			if (rayResult && rayResult.Instance) {
				floorMat = rayResult.Material;
			}
		}

		if (floorMat === Enum.Material.Air && !isClimbing) {
			return;
		}

		this.lastFloorMaterial = floorMat;

		// Stride timer scaled with velocity (matching original template mechanics)
		const effectiveSpeed = math.max(flatSpeed, humanoid.MoveDirection.Magnitude > 0.1 ? humanoid.WalkSpeed : 6);
		this.elapsedSinceLastStep += dt * effectiveSpeed;

		if (this.elapsedSinceLastStep >= footstepInterval) {
			this.elapsedSinceLastStep = 0;
			const speedRatio = math.clamp(effectiveSpeed / defaultWalkSpeed, 0.75, 1.4);
			this.playFootstepSound(this.lastFloorMaterial, hrp, speedRatio);
		}

	}

	private getMaterialGroupName(material: Enum.Material): string {
		if (this.footstepApi) {
			try {
				const mapped = this.footstepApi.GetTableFromMaterial(material);
				if (mapped !== undefined) {
					return mapped;
				}
			} catch {
				// fallback below
			}
		}

		switch (material) {
			case Enum.Material.Wood:
			case Enum.Material.WoodPlanks:
				return "Wood";
			case Enum.Material.Grass:
			case Enum.Material.LeafyGrass:
				return "Grass";
			case Enum.Material.Ground:
				return "Dirt";
			case Enum.Material.Pebble:
				return "Gravel";
			case Enum.Material.Sand:
			case Enum.Material.Salt:
				return "Sand";
			case Enum.Material.Metal:
			case Enum.Material.CorrodedMetal:
			case Enum.Material.DiamondPlate:
				return "Metal_Solid";
			case Enum.Material.Foil:
				return "Metal_Grate";
			case Enum.Material.Fabric:
				return "Carpet";
			case Enum.Material.Snow:
				return "Snow";
			case Enum.Material.Ice:
			case Enum.Material.Glacier:
			case Enum.Material.Glass:
				return "Glass";
			default:
				return "Concrete";
		}
	}

	private playFootstepSound(material: Enum.Material, parentPart: BasePart, speedRatio: number): void {
		const setName = "Default";
		const groupName = this.getMaterialGroupName(material);

		const setCache = this.cachedFootsteps ? this.cachedFootsteps[setName] : undefined;
		if (!setCache) return;

		// 1. Play surface-specific sound (Concrete, Wood, Grass, etc.)
		const materialSounds = setCache[groupName];
		if (materialSounds && materialSounds.size() > 0) {
			this.playRandomSoundFromList(materialSounds, parentPart, speedRatio, false);
		}

		// 2. Play punchy Bass layer (gives weighty feedback to steps)
		const bassSounds = setCache["Bass"];
		if (bassSounds && bassSounds.size() > 0) {
			this.playRandomSoundFromList(bassSounds, parentPart, speedRatio, true);
		}
	}

	private playActionSound(actionType: "Landing" | "Jumping", parentPart: BasePart): void {
		const setName = "Default";
		const groupName = this.getMaterialGroupName(this.lastFloorMaterial);

		const cache = actionType === "Landing" ? this.cachedLanding : this.cachedJumping;
		const setCache = cache ? cache[setName] : undefined;
		if (!setCache) return;

		const soundList = setCache[groupName];
		if (soundList && soundList.size() > 0) {
			this.playRandomSoundFromList(soundList, parentPart, 1.0, false);
		}

		if (actionType === "Landing") {
			const bassSounds = setCache["Bass"];
			if (bassSounds && bassSounds.size() > 0) {
				this.playRandomSoundFromList(bassSounds, parentPart, 1.0, true);
			}
		}
	}

	private playRandomSoundFromList(
		soundList: Sound[],
		parentPart: BasePart,
		speedRatio: number,
		isBass = false,
	): void {
		if (soundList.size() === 0) return;
		const soundIndex = math.random(0, soundList.size() - 1);
		const baseSound = soundList[soundIndex];
		if (!baseSound) return;

		const clone = baseSound.Clone();
		const defaultPitch = (clone.GetAttribute("DefaultPitch") as number | undefined) ?? 1.0;
		const defaultVolume = (clone.GetAttribute("DefaultVolume") as number | undefined) ?? 0.7;
		const defaultRolloff = (clone.GetAttribute("DefaultRolloff") as number | undefined) ?? 15;

		const pitchMultiplier = (math.random(950, 1050) / 1000) * (0.6 + speedRatio * 0.4);
		const volumeMultiplier = isBass ? math.max(speedRatio - 0.4, 0.35) : math.clamp(speedRatio * 1.1, 0.6, 1.4);

		clone.PlaybackSpeed = defaultPitch * pitchMultiplier;
		clone.Volume = defaultVolume * volumeMultiplier;
		clone.RollOffMinDistance = defaultRolloff;
		clone.RollOffMaxDistance = 250;
		clone.Parent = parentPart;
		clone.Play();

		clone.Ended.Once(() => {
			clone.Destroy();
		});

		task.delay(2.5, () => {
			if (clone.Parent) clone.Destroy();
		});
	}
}
