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
} from "./services";

/**
 * Server Entry Point
 */
function main() {
	print("[Server] Starting server services...");

	// Initialize singleton services
	const timeService = ServerTimeService.getInstance();
	timeService.init();

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

	ServerMusicService.getInstance();
	ServerChatService.getInstance();
	ServerSocialService.getInstance();
	ServerEventService.getInstance();
	ServerAdminService.getInstance();

	print("[Server] All services initialized successfully.");
}

main();
