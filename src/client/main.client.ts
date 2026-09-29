import { StarterGui } from "@rbxts/services";
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
	SeatController,
	StageCameraController,
	AvatarContextMenuController,
} from "./controllers";


import { AdminService } from "./services/AdminService";
import { AnimationPreloadService } from "./services/AnimationPreloadService";
import { EmoteService } from "./services/EmoteService";
import { GlobalNotificationService } from "./services/GlobalNotificationService";
import { MusicPlayerService } from "./services/MusicPlayerService";
import { TimeService } from "./services/TimeService";
import { StageCameraOverlayView } from "./ui/views/StageCameraOverlayView";

/**
 * Client Entry Point
 */
function main() {
	// Lock experience orientation to fixed LandscapeRight and disable sensor detection
	StarterGui.ScreenOrientation = Enum.ScreenOrientation.LandscapeRight;

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
	SeatController.getInstance().init();
	StageCameraController.getInstance().init();
	StageCameraOverlayView.getInstance();
	AvatarContextMenuController.getInstance().init();

	print("[Client] All controllers initialized successfully.");


}

main();
