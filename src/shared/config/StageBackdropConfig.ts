/**
 * Konfigurasi Preset Animasi GIF / Sprite Sheet untuk Backdrop Panggung.
 *
 * PANDUAN MENAMBAHKAN GIF CUSTOM BARU:
 * 1. Convert file GIF Anda menjadi Sprite Sheet PNG menggunakan tool online (misal: Ezgif Sprite Sheet Generator).
 * 2. Upload gambar hasil sprite sheet ke Roblox Creator Hub (Decal/Image) dan salin Asset ID-nya.
 * 3. Tambahkan objek baru ke dalam array `BACKDROP_GIF_PRESETS` di bawah ini.
 * 4. Tombol baru otomatis muncul di tab "Backdrop" pada tool Lighting Remote in-game!
 */

export interface BackdropGifPreset {
	/** Identifier unik preset (digunakan untuk sinkronisasi remote) */
	id: string;
	/** Nama tampilan yang muncul pada tombol di tool Lighting Remote */
	name: string;
	/** Kategori atau deskripsi singkat */
	description?: string;
	/** Asset ID gambar Sprite Sheet di Roblox (contoh: "rbxassetid://123456789") */
	assetId: string;
	/** Jumlah kolom frame dalam gambar grid */
	columns: number;
	/** Jumlah baris frame dalam gambar grid */
	rows: number;
	/** Total jumlah frame animasi dalam gambar grid */
	totalFrames: number;
	/** Kecepatan pemutaran animasi (Frames Per Second / FPS) */
	fps: number;
	/** Lebar total resolusi pixel sprite sheet (opsional, misal 1023) */
	textureWidth?: number;
	/** Tinggi total resolusi pixel sprite sheet (opsional, misal 920) */
	textureHeight?: number;
	/** Warna aksen highlight pada tombol UI Remote */
	accentColor?: Color3;
}

export const BACKDROP_GIF_PRESETS: BackdropGifPreset[] = [
	{
		id: "1",
		name: "TWD",
		description: "TRASH WORLD DIVISION",
		// Catatan: Gunakan Image Asset ID (110800249450765), bukan Decal ID (118955050898620)
		assetId: "rbxassetid://73758718585948",
		columns: 5,
		rows: 8,
		totalFrames: 40,
		fps: 10,
		textureWidth: 1023,
		textureHeight: 921,
	},
];

export const DEFAULT_BACKDROP_PRESET_ID = "1";
