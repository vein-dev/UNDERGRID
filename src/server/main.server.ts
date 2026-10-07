import {
	ServerAdminService,
	ServerChatService,
	ServerCombatService,
	ServerEventService,
	ServerMusicService,
	ServerPlayerService,
	ServerSocialService,
	ServerDummyService,
	ServerEmoteService,
	ServerSkateboardService,
	ServerTimeService,
	ServerStageLightingService,
	ServerGuitarService,
	ServerDrumstickService,
	ServerRollupDoorService,
	ServerRooftopDoorService,
	ServerSeatService,
	ServerAfkService,
	ServerDjMusicService,
	ServerElevatorService,
	ServerNpcService,
	ServerVoiceZoneService,
	ServerDuelService,
	ServerRagdollService,
} from "./services";

/**
 * Server Entry Point
 */
function main() {
	print("[Server] Starting server services...");

	// Initialize singleton services
	const timeService = ServerTimeService.getInstance();
	timeService.init();

	const afkService = ServerAfkService.getInstance();
	afkService.init();

	const stageLightingService = ServerStageLightingService.getInstance();
	stageLightingService.init();

	const playerService = ServerPlayerService.getInstance();
	playerService.init();

	const combatService = ServerCombatService.getInstance();
	combatService.init();

	const dummyService = ServerDummyService.getInstance();
	dummyService.init();

	const emoteService = ServerEmoteService.getInstance();
	emoteService.init();

	const skateboardService = ServerSkateboardService.getInstance();
	skateboardService.init();

	const guitarService = ServerGuitarService.getInstance();
	guitarService.init();

	const drumstickService = ServerDrumstickService.getInstance();
	drumstickService.init();

	const rollupDoorService = ServerRollupDoorService.getInstance();
	rollupDoorService.init();

	const rooftopDoorService = ServerRooftopDoorService.getInstance();
	rooftopDoorService.init();

	const seatService = ServerSeatService.getInstance();
	seatService.init();

	const elevatorService = ServerElevatorService.getInstance();
	elevatorService.init();

	const npcService = ServerNpcService.getInstance();
	npcService.init();

	const voiceZoneService = ServerVoiceZoneService.getInstance();
	voiceZoneService.init();

	const duelService = ServerDuelService.getInstance();
	duelService.init();

	const ragdollService = ServerRagdollService.getInstance();
	ragdollService.init();

	ServerMusicService.getInstance();
	ServerDjMusicService.getInstance();
	ServerChatService.getInstance();
	ServerSocialService.getInstance();
	ServerEventService.getInstance();
	ServerAdminService.getInstance();

	print("[Server] All services initialized successfully.");
}

main();
