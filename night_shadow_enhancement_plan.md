# Implementation Plan: Kalibrasi Kontras Bayangan Malam Hari (Night Shadow Enhancement)

Dokumen ini berisi rancangan implementasi untuk meningkatkan ketajaman dan kontras bayangan (*shadows*) pada siklus malam hari di UNDERGRID, baik bayangan directional bulan (*moonlight*) maupun bayangan lampu jalan (*streetlights*).

---

## 1. Analisis Masalah & Tujuan

### Masalah:
1. **Bayangan Bulan (Global Directional Shadow) Tertutup Cahaya Luar (*Washed Out*):**
   * Nilai `outdoorAmbient` pada profil malam hari (`TimePeriod.Night`) saat ini berada di `Color3.fromRGB(105, 110, 130)` (~45% brightness). Karena nilai fill light ini sangat terang, area bayangan tidak memiliki kontras terhadap permukaan tanah/jalan, sehingga bayangan bulan tampak hilang.
2. **Lampu Jalan di Edit Mode & Sebagian SpotLight Tidak Memiliki `Shadows = true`:**
   * Di malam hari, bayangan paling dominan seharusnya jatuh dari lampu jalan (StreetLamp). Beberapa SpotLight memiliki properti `Shadows = false` secara bawaan.

### Tujuan:
1. Menghasilkan kontras bayangan malam hari yang tajam, realistis, dan atmosferik (Moody Cyberpunk / Urban Night).
2. Memastikan bayangan bulan (*moonlight shadows*) terlihat jelas di area terbuka.
3. Memastikan lampu jalan (*streetlights*) menghasilkan bayangan dinamis tajam di bawah karakter dan objek sekitar saat malam hari.

---

## 2. File yang Terlibat

| File | Status | Keterangan Perubahan |
| :--- | :--- | :--- |
| `src/shared/config/TimeConfig.ts` | **Modifikasi** | Menyesuaikan profil `TimePeriod.Night` (mengurangi `outdoorAmbient` dan `ambient`, menyeimbangkan `brightness` & `colorShiftTop`) untuk menghasilkan kontras bayangan tinggi. Memuluskan transisi pada `Dusk` dan `Dawn`. |
| `src/client/controllers/StreetlightController.ts` | **Verifikasi / Penyesuaian** | Memastikan sinkronisasi `spot.Shadows = true` terpasang konsisten saat lampu jalan diaktifkan di malam hari. |
| **Roblox Studio Instance** (Workspace) | **Update via Luau** | Mengaktifkan properti `Shadows = true` pada seluruh `StreetSpotLight` di dalam model lampu jalan di Workspace. |

---

## 3. Detail Perubahan Teknis

### A. Kalibrasi Profil di `src/shared/config/TimeConfig.ts`
* **Sebelum**:
  ```typescript
  [TimePeriod.Night]: {
      brightness: 1.8,
      ambient: Color3.fromRGB(80, 85, 100),
      outdoorAmbient: Color3.fromRGB(105, 110, 130), // Terlalu terang
      colorShiftTop: Color3.fromRGB(140, 170, 210),
      colorShiftBottom: Color3.fromRGB(65, 70, 85),
      exposureCompensation: 0.0,
  }
  ```
* **Sesudah (Target Kalibrasi Sinematik & Kontras Bayangan Tajam)**:
  ```typescript
  [TimePeriod.Night]: {
      brightness: 1.4,                               // Sinar bulan terfokus
      ambient: Color3.fromRGB(18, 20, 28),           // Area indoor/gelap pekat
      outdoorAmbient: Color3.fromRGB(28, 32, 44),    // Fill light redup kebiruan -> bayangan bulan sangat kontras
      colorShiftTop: Color3.fromRGB(130, 160, 210),  // Warna highlight sinar bulan
      colorShiftBottom: Color3.fromRGB(15, 18, 25),  // Warna pantulan tanah malam
      exposureCompensation: 0.0,
  }
  ```

### B. Sinkronisasi Shadows Lampu Jalan
* Memastikan seluruh SpotLight lampu jalan menyala dengan `Shadows = true`, `Range = 60`, `Angle = 108` saat jam malam (18:00 - 06:00).
* Menjalankan pembaruan properti pada instance `StreetSpotLight` di Workspace Studio agar konsisten di Edit Mode maupun Runtime.

---

## 4. Alur Implementasi Bertahap

1. **Step 1: Kalibrasi `TimeConfig.ts`**:
   * Perbarui konfigurasi profil pencahayaan malam hari dengan nilai kontras tinggi.
2. **Step 2: Update Properti SpotLight Lampu Jalan di Studio**:
   * Jalankan update via Studio MCP untuk mengaktifkan `Shadows = true` pada lampu jalan yang ada di map.
3. **Step 3: Uji Coba Visual di Roblox Studio**:
   * Set `ClockTime = 0` (tengah malam) di Studio, amati siluet bayangan karakter/pohon di bawah sinar bulan dan di bawah lampu jalan.
4. **Step 4: Validasi Kompilasi**:
   * Jalankan `npx rbxtsc` untuk memastikan nol error kompilasi TypeScript.

---

## 5. Rencana Verifikasi

* **Kompilasi**: Memastikan `npx rbxtsc` sukses tanpa error lint maupun runtime type issue.
* **Inspeksi Visual Studio**: Menguji tampilan pada `ClockTime = 0` (Malam) dan `ClockTime = 13` (Siang):
  * Bayangan karakter di siang hari tetap tajam dan natural.
  * Bayangan karakter di malam hari terlihat jelas baik di bawah sinar bulan (tanah terbuka) maupun di bawah sorotan lampu jalan.
