# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-10-07

### Added
- **Spatial Voice Chat Zone System (`ServerVoiceZoneService` & `VoiceZoneController`)**:
  - Implementasi kontrol mikrofon spasial otoritatif memanfaatkan fitur `VoiceChatService.UseAudioApi` (`AudioDeviceInput`).
  - Pembatasan berbicara: mikrofon pemain otomatis dikunci (`Muted = true`) di luar zona, dan hanya dibuka (`Muted = false`) ketika menginjak `RooftopVoiceZone` atau `GarageVoiceZone`.
  - Integrasi otomatis dengan `ZoneAudioController`: volume musik (Main Stage & DJ Rooftop) otomatis ducking halus (lerp) menjadi 50% saat berada di dalam Voice Zone agar suara obrolan terdengar jernih, dan kembali ke 100% saat keluar.
  - Toleransi vertikal $\approx 30$ studs agar pemain yang melompat atau berdiri di atas part tetap dapat berbicara tanpa jeda.
  - Notifikasi visual real-time pada Dynamic Island saat pemain masuk ke zona (`"VOICE ZONE ACTIVE"`, icon `mic`) dan keluar dari zona (`"VOICE MUTED"`, icon `mic-off`).
  - Utilitas pendeteksi zona suara modular di `src/shared/utils/VoiceZoneUtils.ts`.
- **NPC Realistic Head Follow Controller (`NpcHeadFollowController`)**:
  - Implementasi kontroler pelacak kepala NPC berbasis client menggunakan interpolasi halus (`RenderStepped` & `Lerp`).
  - Dukungan otomatis untuk seluruh NPC di dalam folder `Workspace.NPC` (Twins, Paul, Mang Kosim, Legion Riq) serta entitas dengan tag CollectionService `"NPC"`.
  - Dukungan rig universal untuk model R6 dan R15.
  - Batasan sudut dinamis (Yaw horizontal $\pm 70^\circ$, Pitch vertikal $\pm 35^\circ$) agar kepala NPC tidak terputar berlebihan ke belakang.
  - Dukungan penuh `StreamingEnabled` dengan pemindai berkala latar belakang.

### Changed
- **Pembersihan Fisika Rig & Aksesoris NPC (`ServerNpcService`)**:
  - Otomatisasi unanchor seluruh anggota badan dan aksesoris NPC saat startup server, menyisakan hanya `HumanoidRootPart` yang di-anchor agar NPC tidak jatuh atau terdorong.
  - Pembersihan otomatis (*sanitizer*) untuk sambungan weld yang salah atau korup (`HeadWeld` yang mengelas kepala ke aksesoris pinggang/kaki).
  - Penyelarasan aksesoris `Accessory (ipod)` pada NPC Twins ke `Head` agar kabel earphone ikut berputar selaras bersama kepala.
- **Transisi Kembali Posisi Awal Leher**:
  - Mengganti kalkulasi deteksi kembali dari selisih posisi translasi menjadi selisih orientasi rotasi visual (`LookVector` & `UpVector`).
  - Menghilangkan efek patah/teleportasi leher instan saat pemain berjalan menjauh, digantikan dengan transisi santai dan halus ($\sim 0.6$ detik).
- **Efek Typewriter pada Dialog NPC (`NpcDialogueView`)**:
  - Animasi teks mesin ketik bertahap per huruf yang responsif dengan fitur skip saat layar diklik atau tombol aksi ditekan.

---
