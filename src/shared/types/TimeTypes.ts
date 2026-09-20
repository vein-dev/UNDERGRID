/**
 * TimeTypes.ts
 * Definisi tipe data, enum, dan antarmuka untuk sistem waktu dinamis (Day/Night Cycle).
 */

export enum TimePeriod {
	Dawn = "Dawn", // 05:00 - 07:00 (Fajar / Matahari terbit)
	Day = "Day", // 07:00 - 17:00 (Siang hari)
	Dusk = "Dusk", // 17:00 - 19:30 (Senja / Sunset)
	Night = "Night", // 19:30 - 05:00 (Malam hari)
}

/**
 * Representasi sinkronisasi status waktu dari server ke client.
 */
export interface TimeStateSync {
	clockTime: number; // 0 - 24
	cycleDurationMinutes: number; // Durasi 1 hari penuh dalam menit waktu nyata
	timeScale: number; // Kecepatan waktu (1.0 = normal)
	isPaused: boolean; // Apakah waktu sedang dijeda
	lastSyncTimestamp: number; // os.clock() saat server mencatat waktu
}

/**
 * Profil pencahayaan visual untuk interpolasi halus di client.
 */
export interface LightingProfile {
	brightness: number;
	ambient: Color3;
	outdoorAmbient: Color3;
	colorShiftTop: Color3;
	colorShiftBottom: Color3;
	exposureCompensation: number;
}
