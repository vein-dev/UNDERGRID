import { Players, RunService } from "@rbxts/services";
import { checkPlayerVoiceZone } from "shared/utils/VoiceZoneUtils";

/**
 * ServerVoiceZoneService
 * Mengontrol akses Voice Chat spasial secara otoritatif di server.
 * Mengunci mikrofon pemain (Muted = true) jika berada di luar zona,
 * dan membuka mikrofon (Muted = false) hanya ketika berdiri di dalam RooftopVoiceZone atau GarageVoiceZone.
 */
export class ServerVoiceZoneService {
	private static instance?: ServerVoiceZoneService;

	private isInitialized = false;
	private playerInputs = new Map<Player, AudioDeviceInput>();
	private lastPlayerZoneState = new Map<Player, boolean>();
	private updateTimer = 0;
	private readonly CHECK_INTERVAL = 0.25; // Evaluasi posisi setiap 250ms

	private constructor() {}

	public static getInstance(): ServerVoiceZoneService {
		if (!ServerVoiceZoneService.instance) {
			ServerVoiceZoneService.instance = new ServerVoiceZoneService();
		}
		return ServerVoiceZoneService.instance;
	}

	public init(): void {
		if (this.isInitialized) return;
		this.isInitialized = true;

		Players.PlayerAdded.Connect((player) => this.onPlayerAdded(player));
		Players.PlayerRemoving.Connect((player) => this.onPlayerRemoving(player));

		for (const player of Players.GetPlayers()) {
			this.onPlayerAdded(player);
		}

		// Loop evaluasi zona berbasis Heartbeat ber-throttle
		RunService.Heartbeat.Connect((dt) => {
			this.updateTimer += dt;
			if (this.updateTimer >= this.CHECK_INTERVAL) {
				this.updateTimer = 0;
				this.evaluateAllPlayers();
			}
		});

		print("[ServerVoiceZoneService] Initialized: Voice Zones (Rooftop & Garage) active.");
	}

	private onPlayerAdded(player: Player): void {
		// Pasang listener pencarian AudioDeviceInput
		this.trackAudioDevice(player);

		player.ChildAdded.Connect((child) => {
			if (child.IsA("AudioDeviceInput")) {
				this.registerAudioInput(player, child as AudioDeviceInput);
			}
		});

		player.CharacterAdded.Connect((char) => {
			// Saat respawn, pastikan status zona direset dan cari AudioDeviceInput jika ada di karakter
			this.lastPlayerZoneState.delete(player);
			const charInput = char.FindFirstChildOfClass("AudioDeviceInput");
			if (charInput) {
				this.registerAudioInput(player, charInput);
			}
			char.ChildAdded.Connect((child) => {
				if (child.IsA("AudioDeviceInput")) {
					this.registerAudioInput(player, child as AudioDeviceInput);
				}
			});
		});
	}

	private onPlayerRemoving(player: Player): void {
		this.playerInputs.delete(player);
		this.lastPlayerZoneState.delete(player);
	}

	private trackAudioDevice(player: Player): void {
		const existingInput = player.FindFirstChildOfClass("AudioDeviceInput");
		if (existingInput) {
			this.registerAudioInput(player, existingInput);
			return;
		}

		// Tunggu jika dibuat asinkron oleh engine Roblox
		task.spawn(() => {
			let attempts = 0;
			while (player.IsDescendantOf(Players) && attempts < 20) {
				const found = player.FindFirstChildOfClass("AudioDeviceInput");
				if (found) {
					this.registerAudioInput(player, found);
					break;
				}
				task.wait(0.5);
				attempts++;
			}
		});
	}

	private registerAudioInput(player: Player, input: AudioDeviceInput): void {
		this.playerInputs.set(player, input);
		// Default: Mute sebelum terverifikasi berada di zona
		input.Muted = true;
	}

	private evaluateAllPlayers(): void {
		for (const player of Players.GetPlayers()) {
			const check = checkPlayerVoiceZone(player);
			const inZone = check.inZone;
			const lastState = this.lastPlayerZoneState.get(player);

			// Update attribute agar bisa dibaca oleh client/HUD secara real-time
			player.SetAttribute("IsInVoiceZone", inZone);
			player.SetAttribute("VoiceZoneName", inZone ? (check.zoneName ?? "") : "");

			// Jika state berubah atau belum pernah di-set
			if (lastState === undefined || lastState !== inZone) {
				this.lastPlayerZoneState.set(player, inZone);

				let audioInput = this.playerInputs.get(player);
				if (!audioInput || !audioInput.IsDescendantOf(game)) {
					// Cari ulang jika referensi hilang
					audioInput = player.FindFirstChildOfClass("AudioDeviceInput") ?? 
						player.Character?.FindFirstChildOfClass("AudioDeviceInput");
					if (audioInput) {
						this.playerInputs.set(player, audioInput);
					}
				}

				if (audioInput) {
					// Jika di dalam zona -> Muted = false (bisa bicara)
					// Jika di luar zona -> Muted = true (tidak bisa bicara)
					audioInput.Muted = !inZone;
				}
			}
		}
	}
}
