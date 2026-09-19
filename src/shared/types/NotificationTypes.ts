/**
 * Global App Notification Types.
 * Standardizes reusable Dynamic Island & Notch notifications across the game.
 */

export interface AppNotificationOptions {
	/** Judul notifikasi atau nama pengirim (contoh: "sven", "PENGUMUMAN", "Tiket Konser", "System") */
	title: string;

	/** Teks isi pesan notifikasi */
	message: string;

	/** Keterangan waktu / subteks di pojok kanan atas (default: "baru saja") */
	subtext?: string;

	/** URL Gambar Avatar / Icon (contoh: rbxthumb://..., rbxassetid://...) */
	icon?: string;

	/** Badge emoji/icon kecil di pojok icon utama (contoh: "💬", "📢", "🎟️", "🎵", "⚠️") */
	badgeText?: string;

	/** Nama icon Lucide untuk badge pojok (contoh: "message-square", "megaphone", "ticket", "bell") */
	badgeIcon?: string;

	/** Warna latar belakang badge kecil */
	badgeColor?: Color3;

	/** Sembunyikan badge kecil di pojok bawah icon (misal untuk pengumuman server) */
	hideBadge?: boolean;

	/** Teks tombol aksi di sebelah kanan (contoh: "Buka ↗", "Lihat", "Info"). Jika false/undefined, tombol aksi disembunyikan */
	actionText?: string;

	/** Warna aksen tombol aksi */
	actionColor?: Color3;

	/** Callback saat banner atau tombol diklik oleh pemain */
	onClick?: () => void;

	/** Durasi tampil dalam detik sebelum otomatis menghilang (default: 4.5 detik) */
	duration?: number;

	/** Sound effect asset ID khusus atau false jika ingin senyap (default: iOS Chime rbxassetid://17208361335) */
	soundId?: string | boolean;

	/** Mode urgent untuk pengumuman penting: font teks lebih besar, subteks tersembunyi jika kosong */
	isUrgent?: boolean;
}
