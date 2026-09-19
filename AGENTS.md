# Panduan Pengembangan Agent (AGENTS.md)

Dokumen ini memuat aturan inti, standar arsitektur, dan prinsip kerja agent dalam mengembangkan serta memodifikasi codebase project ini. Dokumen ini wajib dipatuhi tanpa pengecualian.

---

### 1. Standar Kode TypeScript (roblox-ts)
* Tulis kode TypeScript yang rapi, terstruktur, mematuhi konvensi `roblox-ts`, dan nol error kompilasi (`npx rbxtsc`).
* Terapkan pendekatan **Object-Oriented Programming (OOP)** untuk Services, Controllers, Components 3D, dan Class Adapter pada UI.
* Utamakan prinsip **Clean Code**: penamaan variabel/metode yang deskriptif, pemisahan tanggung jawab (*Separation of Concerns*), dan modularitas tinggi.
* Buat kode yang **reusable** dan hindari duplikasi logika (*DRY - Don't Repeat Yourself*).

---

### 2. Pemahaman Prompt & Analisis Mendalam
* Analisis setiap instruksi, pertanyaan, atau keluhan dari pengguna secara menyeluruh sebelum mengambil tindakan.
* Perhatikan konteks file yang sedang aktif, error log, dan arsitektur yang sudah berjalan.
* Jika ada kebutuhan yang ambigu atau belum jelas, mintalah klarifikasi terlebih dahulu sebelum berasumsi.

---

### 3. Alur Logika Runtut & Tidak Meloncat
* Setiap implementasi fitur baru harus dirancang secara sistematis dari awal hingga akhir:
  1. **Definisi Tipe Data / Interfaces** (`src/shared/types/`).
  2. **Logika Server Otoritatif** (`src/server/services/` & Network Remotes).
  3. **Layanan Client & Input Controller** (`src/client/services/` & `src/client/controllers/`).
  4. **Antarmuka Pengguna / UI Layer** (`src/client/ui/` menggunakan React TSX).
* Hindari memotong alur logika penting atau melompati tahapan penanganan status (*state management*).

---

### 4. Tepat Sasaran & Tanpa Overengineering
* Kerjakan **hanya apa yang diminta oleh pengguna**.
* Dilarang menambahkan fitur, komponen, atau dekorasi yang tidak diminta (*no overengineering*).
* Jaga scope perubahan agar tetap minimal, bersih, dan langsung menjawab inti permasalahan pengguna.

---

### 5. Selalu Membuat Implementation Plan Sebelum Bekerja
* Sebelum mengeksekusi perubahan kode (khususnya untuk fitur baru, refactor besar, atau perbaikan arsitektur), buat rencana implementasi (*Implementation Plan*) terlebih dahulu.
* Rencana harus memuat:
  - Analisis masalah / tujuan.
  - File-file yang akan dibuat atau diubah.
  - Alur implementasi bertahap.
  - Rencana verifikasi / pengujian.
* Tunggu persetujuan pengguna sebelum memulai eksekusi.

---

### 6. Review Ulang & Validasi Hasil Kerja
* Selalu periksa kembali (*self-review*) setiap perubahan kode untuk memastikan tidak ada efek samping atau regresi.
* Validasi keberhasilan kode melalui kompilasi (`npx rbxtsc`) guna memastikan **nol error** dan kode siap dijalankan di Roblox Studio maupun Rojo.

---

### 7. Pemisahan Domain Ekstensi `.ts` vs `.tsx` (Separation of Concerns)
Arsitektur codebase ini memisahkan secara tegas antara domain logika murni dan domain UI visual:

| Ekstensi | Domain / Direktori | Peruntukan & Karakteristik |
| :--- | :--- | :--- |
| **`.ts`** | `src/server/`<br>`src/shared/`<br>`src/client/services/`<br>`src/client/controllers/`<br>`src/client/components/` (3D Tool) | **Logika Bisnis & Backend (Non-UI):** Kontrak tipe data, otorisasi server, sinkronisasi remote network, state listener, dan controller input. **DILARANG** menggunakan sintaks JSX di dalam file `.ts`. |
| **`.tsx`** | `src/client/ui/` (`views/`, `apps/`, `components/`, `admin/`) | **Antarmuka Pengguna (React UI Layer):** Komponen deklaratif menggunakan `@rbxts/react` & `@rbxts/react-roblox` (`<frame>`, `<textlabel>`, `<Button>`, reactive hooks). |

---

### 8. Standar UI React TSX & Estetika Modern (iOS Look)
* **Paradigma Deklaratif React**: Bangun UI menggunakan Functional Components dan React Hooks (`useState`, `useEffect`, `useSignal`, `useInterval`).
* **Pencegahan Memory Leak**: Manfaatkan lifecycle React untuk pembersihan memori otomatis (unmount). Jangan menyimpan event connection manual secara global jika bisa dikelola via lifecycle React.
* **Class Adapter Pattern**: Seluruh View utama (`views/`, `admin/`, `apps/`) wajib menyediakan Class Adapter berorientasi objek (misal: `getInstance()`, `show()`, `hide()`, `toggle()`, `destroy()`) agar controller client (`TopbarController`, `HotbarController`, `BackpackController`) dapat berinteraksi secara mulus tanpa ketergantungan langsung ke siklus render React.
* **Desain Modern & Glassmorphism**: Terapkan estetika modern bergaya Apple iOS (sudut melengkung dengan `UICorner`, border tipis halus dengan `UIStroke`, palet warna gelap elegan `#0c0c0c` / `#121212`, dan latar belakang semi-transparan).
* **Tata Letak & Spasi Proporsional**: Berikan padding dan margin terukur (`UIPadding`, `UIListLayout`) agar elemen tidak saling bertumpuk atau tertekan.

---

### 9. Hierarki Font & Responsivitas Teks (Typography System)
* **Gunakan Typography Terpadu**: Selalu gunakan font family terstandarisasi dari `src/client/ui/Typography.ts`:
  - **`Fonts.Bold` (`Enum.Font.GothamBold`)**: Judul Utama (*Screen Titles*, *Header Titles*), Tombol Aksi/CTA (*Back*, *Send*, *RSVP*), Badge angka, dan Nama Pengguna utama.
  - **`Fonts.Medium` (`Enum.Font.GothamMedium`)**: Subjudul (*Subheaders*), Kolom Input Teks (*Search Bar*, *Message Input*), Status indikator, dan Label daftar.
  - **`Fonts.Regular` (`Enum.Font.Gotham`)**: Teks Isi (*Body Text*, *Chat Message Bubble*), Subteks sekunder (`@username`), Timestamp waktu, dan keterangan detail (*caption*).
* **Wajib Responsif (Dynamic Text Scaling)**:
  - Setiap elemen teks wajib bersifat responsif. Untuk elemen input/button statis berukuran kecil, gunakan batasan `TextSize` terukur (minimal 10–11 pt).
  - Untuk teks panjang atau multi-line chat, gunakan `TextWrapped = true`, `LineHeight = 1.15`, dan `UISizeConstraint` untuk batas lebar maksimal.

---

### 10. Struktur Direktori & Konvensi Penempatan File Code
Sebelum membuat atau memodifikasi file, pahami dan patuhi arsitektur folder berikut secara ketat. Dilarang membuat file sembarangan di root `src/` atau mencampuradukkan domain lapisan (*layers*):

```
src/
├── shared/                       # Kode bersama (dapat diakses Client & Server) [.ts]
│   ├── types/                    # Definisi Interface, Type, dan Enum (Wajib re-export di types/index.ts)
│   │   ├── AdminTypes.ts         # Tipe admin, tab, dan status server
│   │   ├── NotificationTypes.ts  # Tipe konfigurasi notifikasi global
│   │   ├── SmartphoneTypes.ts    # Tipe aplikasi smartphone, chat, feed, gigs
│   │   └── WeaponTypes.ts        # Tipe item/senjata
│   ├── config/                   # Konfigurasi data statis (AdminConfig, EventConfig, GameConfig)
│   ├── network/                  # Deklarasi RemoteEvent & RemoteFunction terpusat (Remotes.ts)
│   └── utils/                    # Utilitas murni & helper independen (TimeUtils.ts, LucideIcons.ts)
│
├── server/                       # Logika Server / Backend (Otoritatif & Zero-Trust) [.ts]
│   ├── services/                 # Layanan server berbasis Singleton (Wajib diawali prefix Server)
│   │   ├── ServerAdminService.ts # Otorisasi admin, kontrol panggung/FX, broadcast
│   │   ├── ServerChatService.ts  # Filter teks, perutean chat privat/DM, offline inbox
│   │   ├── ServerCombatService.ts# Validasi combat, cooldown serangan, dan kalkulasi damage
│   │   ├── ServerEventService.ts # Manajemen data event dan ticketing
│   │   ├── ServerMusicService.ts # Audio hub, rundown gigs, antrean lagu
│   │   ├── ServerPlayerService.ts# Manajemen lifecycle data pemain (PlayerAdded/Removing)
│   │   └── ServerSocialService.ts# Feed postingan sosial & interaksi like/follow
│   └── main.server.ts            # Titik masuk server: inisialisasi seluruh Server Services
│
└── client/                       # Logika Client / Frontend
    ├── services/                 # Client State & Network Manager [.ts]
    │   ├── AdminService.ts       # Komunikasi client ke ServerAdminService
    │   ├── ChatService.ts        # State pesan, unread counter, listener chat
    │   ├── EventService.ts       # State pendaftaran event & tiket client
    │   ├── GlobalNotificationService.ts # Smart router notifikasi (Dynamic Island & Notch)
    │   ├── MusicPlayerService.ts # Playback musik lokal & sinkronisasi audio
    │   └── SocialService.ts      # Sinkronisasi feed sosial di client
    ├── controllers/              # Pengendali input pemain, binding aksi, & Topbar [.ts]
    │   ├── BackpackController.ts # Input tombol inventory & drag-drop logic
    │   ├── HotbarController.ts   # Input angka 1-5, seleksi tool di tangan
    │   ├── InputController.ts    # Centralized input capture & keyboard/mouse events
    │   ├── ToolController.ts     # Logika pemakaian item di tangan & tool lifecycle
    │   └── TopbarController.ts   # Integrasi icon TopbarPlus (Admin, HP, Emote)
    ├── components/               # Komponen interaksi 3D / Tool di client [.ts]
    │   └── SmartphoneClientComponent.ts
    └── ui/                       # Seluruh Antarmuka Pengguna (Declarative React TSX Layer)
        ├── Typography.ts         # Standar font family terpadu [.ts]
        ├── Theme.ts              # Design tokens, warna glassmorphism, spasi [.ts]
        ├── AppRouter.ts          # State router navigasi smartphone [.ts]
        ├── UI.storybook.ts       # Root konfigurasi UI-Labs storybook [.ts]
        ├── hooks/                # Custom React Hooks [.ts]
        │   ├── useSignal.ts      # Hook listener RBXScriptSignal / GoodSignal
        │   └── useInterval.ts    # Hook interval timer deklaratif
        ├── components/           # UI Kit Primitif Deklaratif [.tsx]
        │   ├── Button.tsx & Button.story.tsx
        │   ├── Card.tsx & Card.story.tsx
        │   └── LucideIcon.tsx & LucideIcon.story.tsx
        ├── views/                # Shell besar, HUD & Overlay [.tsx]
        │   ├── BackpackView.tsx & BackpackView.story.tsx
        │   ├── CombatHudView.tsx & CombatHudView.story.tsx
        │   ├── EmoteModalView.tsx & EmoteModalView.story.tsx
        │   ├── ExternalDynamicIslandView.tsx & ExternalDynamicIslandView.story.tsx
        │   ├── HomeScreenView.tsx & HomeScreenView.story.tsx
        │   ├── HotbarView.tsx & HotbarView.story.tsx
        │   ├── LockScreenView.tsx & LockScreenView.story.tsx
        │   ├── NotificationBannerView.tsx & NotificationBannerView.story.tsx
        │   └── SmartphoneView.tsx & SmartphoneView.story.tsx
        ├── apps/                 # Aplikasi khusus Smartphone [.tsx]
        │   ├── ChatApp.tsx & ChatApp.story.tsx
        │   ├── EventApp.tsx & EventApp.story.tsx
        │   ├── MusicApp.tsx & MusicApp.story.tsx
        │   ├── SettingsApp.tsx & SettingsApp.story.tsx
        │   └── SocialApp.tsx & SocialApp.story.tsx
        └── admin/                # Panel Admin Controller [.tsx]
            ├── AdminPanelView.tsx & AdminPanelView.story.tsx
            └── tabs/             # Tab modular admin [.tsx]
                ├── AdminMusicTab.tsx & AdminMusicTab.story.tsx
                ├── AdminPlayerTab.tsx & AdminPlayerTab.story.tsx
                └── AdminStageFxTab.tsx & AdminStageFxTab.story.tsx
```

#### Aturan Baku Penempatan File Baru (Decision Matrix):
1. **Tipe Data (`src/shared/types/`)**:
   - Kontrak data baru (`interface`, `enum`, `type`) dibuat di file terpisah bernama `<Domain>Types.ts` dan **wajib di-reexport** di `src/shared/types/index.ts`.
2. **Konfigurasi Statis (`src/shared/config/`)**:
   - Data statis, daftar ID admin, metadata event/gigs diletakkan di `<Domain>Config.ts` dan di-export di `src/shared/config/index.ts`.
3. **Backend Server (`src/server/services/`)**:
   - Seluruh server service **wajib diawali prefix `Server`** (misalnya `ServerPlayerService.ts`, `ServerCombatService.ts`). Inisialisasi di `src/server/main.server.ts` dan re-export di `src/server/services/index.ts`.
4. **Frontend Client Service (`src/client/services/`)**:
   - Layanan client yang mendengarkan RemoteEvent dan menyimpan state lokal ditempatkan di `src/client/services/<NamaFitur>Service.ts`.
5. **Controller Input / Hotbar (`src/client/controllers/`)**:
   - Logika penanganan input keyboard/gamepad/mouse, binding aksi, atau integrasi Topbar diletakkan di `src/client/controllers/<NamaFitur>Controller.ts`.
6. **Tampilan UI (`src/client/ui/`)**:
   - Halaman aplikasi di dalam Smartphone $\rightarrow$ `src/client/ui/apps/<NamaFitur>App.tsx`.
   - Modal/layar besar independen di luar HP $\rightarrow$ `src/client/ui/views/<NamaFitur>View.tsx`.
   - Tab modular baru untuk panel admin $\rightarrow$ `src/client/ui/admin/tabs/Admin<NamaTab>Tab.tsx`.
   - Komponen primitif bersama $\rightarrow$ `src/client/ui/components/<NamaKomponen>.tsx`.
7. **Standar Penamaan File & Simbol**:
   - **PascalCase untuk Semua File Kode**: `BackpackView.tsx`, `ChatApp.tsx`, `ServerAdminService.ts`, `Remotes.ts`, `TimeUtils.ts`, `AdminTypes.ts`.
   - **Pengecualian Khusus**: `main.server.ts` dan `main.client.ts` menggunakan lowercase sesuai konvensi inti `roblox-ts`. Barrel file menggunakan `index.ts`.
   - **camelCase untuk Kode Internal**: Nama fungsi, utilitas, method, instance variables, dan parameters selalu menggunakan camelCase (`getRemoteEvent()`, `formatTime()`, `onPlayerAdded()`).

---

### 11. Integrasi Wajib UI-Labs (UI Storybook)
* **Wajib Memiliki File Story (`.story.tsx`)**: Setiap komponen UI, View, App, atau modal baru yang dibuat **wajib dibuatkan file story UI-Labs berdampingan** di folder yang sama (misalnya: `BackpackView.tsx` memiliki `BackpackView.story.tsx`, `Button.tsx` memiliki `Button.story.tsx`).
* **Format Story UI-Labs**:
  - Gunakan `CreateGenericStory` dari `@rbxts/ui-labs`.
  - Sediakan kontrol dinamis interaktif (`Slider`, `Boolean`, `String`, `Choose`, dll.) untuk mempermudah preview dan testing variasi state UI tanpa gameplay penuh.
  - Wajib menyediakan fungsi cleanup/unmount (`return () => { view.destroy(); }` atau unmount React root) untuk membersihkan instance dan koneksi event.
* **Isolasi Lingkungan Preview**:
  - Setiap komponen UI wajib menerima parameter container atau target (`props.target`) agar bisa di-mount secara aman di environment storybook.
  - **Dilarang Mengotori Global Services di Edit/Preview Mode**: Komponen UI tidak boleh memodifikasi service global secara permanen (seperti memasang `BlurEffect` di `game.Lighting`) saat berjalan di luar active client gameplay (`RunService.IsRunning() && !isGuiObject`).

---

### 12. Standar Penggunaan Ikon (Wajib Lucide Icons)
* **Wajib Menggunakan Lucide Icons**: Seluruh elemen ikon visual pada antarmuka pengguna (UI buttons, tabs, badges, headers, search bars, dock icons) **wajib menggunakan Lucide Icons**.
* **Dilarang Menggunakan Emoji / Unicode Arrow Mentah**:
  - Hindari penggunaan teks emoji mentah (`"🔍"`, `"✕"`, `"X"`, `"💬"`, `"🎵"`, `"⏹"`) atau unicode arrow (`"↗"`, `"→"`) sebagai ikon tampilan atau tombol.
  - Gunakan komponen deklaratif `<LucideIcon name="<icon-name>" size={...} color={...} />` dari `src/client/ui/components/LucideIcon.tsx` pada file TSX.
* **Mekanisme Lookup Terpusat**:
  - Selalu gunakan utilitas registri internal dari `src/shared/utils`:
    ```typescript
    import { GetIconUri, HasLucideIcon } from "shared/utils";
    ```
  - **Larangan Keras Import npm `@nrbx/lucide`**: Jangan pernah mengimpor `@nrbx/lucide` secara langsung ke file source karena paket tersebut membawa 3.600+ modul file individual dan dependensi React internal yang memicu bug fatal Rojo (`PatchTree: table index is nil`) serta `Infinite yield on WaitForChild("@nrbx")`. Selalu gunakan `LucideIcon` atau `GetIconUri` dari `shared/utils`.
