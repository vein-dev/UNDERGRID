import { Players, StarterGui } from "@rbxts/services";
import { GameConfig } from "shared/config/GameConfig";
import {
	BackpackController,
	CombatController,
	CrouchController,
	FootstepController,
	HotbarController,
	InputController,
	MovementController,
	FallController,
	StaminaController,
	SpawnCinematicController,
	ToolController,
	TopbarController,
	OnboardingController,
	GraphicsController,
	SkateboardController,
	ClientStageLightingController,
	ClientSignageController,
	ClientBackdropController,
	FlyController,
	RollupDoorController,
	RooftopDoorController,
	SeatController,
	StageCameraController,
	AvatarContextMenuController,
	StreetlightController,
	AfkController,
	ZoneAudioController,
	MobileMovementController,
	FreecamController,
	NpcDialogueController,
	NpcHeadFollowController,
	VoiceZoneController,
} from "./controllers";


import { AdminService } from "./services/AdminService";
import { AnimationPreloadService } from "./services/AnimationPreloadService";
import { EmoteService } from "./services/EmoteService";
import { GlobalNotificationService } from "./services/GlobalNotificationService";
import { MusicPlayerService } from "./services/MusicPlayerService";
import { TimeService } from "./services/TimeService";
import { StageCameraOverlayView } from "./ui/views/StageCameraOverlayView";
import { FreecamHudView } from "./ui/views/FreecamHudView";

/**
 * Client Entry Point
 */
function main() {
	const localPlayer = Players.LocalPlayer;

	// Izinkan orientasi otomatis antara Landscape Left dan Landscape Right via sensor device
	StarterGui.ScreenOrientation = Enum.ScreenOrientation.LandscapeSensor;
	const playerGui = (localPlayer.FindFirstChild("PlayerGui") as PlayerGui | undefined) ??
		(localPlayer.WaitForChild("PlayerGui", 5) as PlayerGui | undefined);
	if (playerGui) {
		playerGui.ScreenOrientation = Enum.ScreenOrientation.LandscapeSensor;
	}

	// Batasi jarak zoom kamera agar pemain tidak dapat zoom out terlalu jauh melihat kekosongan luar map
	localPlayer.CameraMinZoomDistance = GameConfig.CAMERA.MIN_ZOOM_DISTANCE;
	localPlayer.CameraMaxZoomDistance = GameConfig.CAMERA.MAX_ZOOM_DISTANCE;

	print("[Client] Starting client controllers...");

	// 0. Preload all animations asynchronously & Inisialisasi Graphics Controller & Time Service
	AnimationPreloadService.getInstance().init();
	GraphicsController.getInstance().init();
	TimeService.getInstance().init();

	// 1. Inisialisasi Onboarding Screen (Loading & Cinematic Spawn) paling pertama agar langsung menutupi layar
	OnboardingController.getInstance().init();

	// Initialize active singleton controllers & services
	GlobalNotificationService.getInstance();
	AdminService.getInstance();
	MusicPlayerService.getInstance();


	const emoteService = EmoteService.getInstance();
	emoteService.init();

	const inputController = InputController.getInstance();
	inputController.init();

	const hotbarController = HotbarController.getInstance();
	hotbarController.init();

	const backpackController = BackpackController.getInstance();
	backpackController.init();

	const topbarController = TopbarController.getInstance();
	topbarController.init();

	const toolController = ToolController.getInstance();
	toolController.init();

	const spawnCinematicController = SpawnCinematicController.getInstance();
	spawnCinematicController.init();

	const combatController = CombatController.getInstance();
	combatController.init();

	MovementController.getInstance();
	CrouchController.getInstance();
	FallController.getInstance();
	StaminaController.getInstance();
	FootstepController.getInstance();
	SkateboardController.getInstance().init();
	ClientStageLightingController.getInstance().init();
	ClientSignageController.getInstance().init();
	ClientBackdropController.getInstance().init();
	FlyController.getInstance().init();
	RollupDoorController.getInstance().init();
	RooftopDoorController.getInstance().init();
	SeatController.getInstance().init();
	StageCameraController.getInstance().init();
	StageCameraOverlayView.getInstance();
	FreecamHudView.getInstance();
	AvatarContextMenuController.getInstance().init();
	StreetlightController.getInstance().init();
	AfkController.getInstance().init();
	ZoneAudioController.getInstance().init();
	MobileMovementController.getInstance().init();
	FreecamController.getInstance().init();
	NpcDialogueController.getInstance().init();
	NpcHeadFollowController.getInstance().init();
	VoiceZoneController.getInstance().init();

	print("[Client] All controllers initialized successfully.");


}

main();
