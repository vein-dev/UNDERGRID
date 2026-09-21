# Audit & Dokumentasi Teknis Sistem Concert Stage Lighting

Dokumen ini berisi rangkuman teknis arsitektur, sinkronisasi audio, format koreografi, dan alur kerja (*workflow*) dari sistem pengendali tata cahaya konser (*stage lighting*) di project UNDERGRID.

---

## 1. Arsitektur Eksekusi

Sistem ini mengadopsi pola arsitektur **Hybrid Client-Authoritative Visuals dengan Server-Authoritative State**:

| Komponen | Domain / Path | Tanggung Jawab & Implementasi |
| :--- | :--- | :--- |
| **State & Otorisasi Server** | `src/server` / `ServerStageLightingService.ts` | Mengelola *single source of truth* konfigurasi lighting (`StageLightingControlPayload`), menyinkronkan warna RGB cover art album / efek rainbow, menyetel atribut status di `Workspace.Lighting`, serta menangani fallback mode non-musik. |
| **Audio Server Engine** | `src/server` / `ServerMusicService.ts` | Mengelola antrean musik, validasi admin, dan instans `Sound` (`"ServerGlobalMusic"`, volume 0) sebagai referensi waktu mutlak. Mem-broadcast sinkronisasi via `MusicSyncEvent` (`RemoteEvent`). |
| **Real-time Visual Controller** | `src/client` / `ClientStageLightingController.ts` | Menggerakkan motor fisik Pan/Tilt (`Motor6D.C0`), kalkulasi strobo, dan responsivitas beat audio dengan **latensi 0ms pada 60+ FPS** di siklus `RunService.RenderStepped`. |
| **UI Controller & Remote** | `src/client/ui` / `LightingRemoteView.tsx` & `AdminStageFxTab.tsx` | Panel kontrol interaktif bagi admin untuk memilih mode panggung, mengatur warna, kecerahan, dan kecepatan motor. |
| **Fixture Fisik di Workspace** | `Workspace.Lighting` (atau tag CollectionService `"StageLight"`) | Model moving light terdiri atas:<br>• `Base` (`Anchored = true`)<br>• `Pan` (`Arm` + `Motor6D` "Pan")<br>• `Tilt` (`Motor6D` "Tilt")<br>• `Body` (`Lens` BasePart, `Beam1` berisi `SpotLight` & `Beam`) |

---

## 2. Mekanisme Sinkronisasi & Audio

### A. Instance Audio
* Menggunakan standar Roblox **`Sound` instance**.
  * **Client**: `SoundService.SmartphoneMusic` (dikelola oleh `MusicPlayerService.ts` dan dilengkapi `PitchShiftSoundEffect`).
  * **Server**: `SoundService.ServerGlobalMusic` (volume 0, hanya pelacak status playback dan deteksi lagu selesai).

### B. Mekanisme Timing Pergantian Light
* **Bukan** `task.wait()` diskrit dan **bukan** timeline JSON kaku.
* Berjalan secara kontinu pada event **`RunService.RenderStepped`** di client menggunakan prinsip **Phase-Locked Musical Engine**:
  1. **Acuan Waktu Kontinu**: Membaca `sound.TimePosition` secara langsung setiap frame (bebas desinkronisasi jaringan).
  2. **Kalkulasi Birama 4/4**:
     $$\text{effectiveBpm} = \text{clamp}(\text{baseBpm} \times \text{playbackSpeed}, 40, 260)$$
     $$\text{beatDuration} = \frac{60}{\text{effectiveBpm}}, \quad \text{barDuration} = \text{beatDuration} \times 4$$
  3. **Subdivisi Fase Musikal ($0.0 \dots 1.0$)**:
     * `barPhase` (1 birama utuh / 4 ketukan)
     * `beatPhase` (quarter note / 1 ketukan)
     * `eighthPhase` (1/8 note) & `sixteenthPhase` (1/16 note)
  4. **Transient Audio Analyzer**:
     * Membaca `sound.PlaybackLoudness` untuk mendeteksi hentakan instan (*kick drum onset*) dan lonjakan volume mendadak (*sudden drop / cymbal crash*).
     * Memicu *Optical Shutter Strobe Burst* dan hentakan inersia motor (*kick punch*) secara real-time.

---

## 3. Format Data Cue / Koreografi Show

* **Format Penyimpanan**:
  Sistem ini **tidak menggunakan timeline JSON atau cue array statis**, melainkan **Algorithmic Procedural Choreography** (Fungsi generator pola harmonis matematis) di dalam method `evaluateMusicalPattern()`.
* **Siklus Koreografi**:
  Terdapat **5 Pola Koreografi** yang otomatis berganti secara harmonis setiap **8 birama musik (32 beat)** dengan interpolasi *cubic smoothstep crossfade* pada 1 birama terakhir.
* **Contoh Implementasi Data Pola (Pola 0: Fanned Sway)**:
  ```typescript
  // Pola 0: Fanned Sway (Ayunan Birama Harmonis 4/4)
  // Menghasilkan target offset Pan & Tilt berdasarkan indeks kolom lampu dan fase birama
  case 0: {
      const fanSpread = colOffset * 0.16; // Posisi kipas menyebar simetris dari tengah panggung
      const pan = fanSpread + math.sin(twoPiBar) * 0.32; // Ayun kiri-kanan 1 siklus per 1 bar
      const tilt = math.cos(twoPiBar) * 0.08;
      return [pan, tilt];
  }
  ```
  *(Sudut akhir kemudian dijumlahkan dengan titik fokus referensi panggung `Workspace.Mic` dan dibatasi batas aman agar selalu menyinari lantai panggung).*

---

## 4. Alur Kerja (Workflow Singkat)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin UI
    participant AS as AdminService (Client)
    participant SAS as ServerAdminService
    participant SMS as ServerMusicService
    participant SLS as ServerStageLightingService
    participant MPS as MusicPlayerService (Client)
    participant CLC as ClientStageLightingController
    participant Fix as Fixture Fisik (Workspace)

    Admin->>AS: Tekan "Play Song" / Ubah Mode Lighting
    AS->>SAS: Kirim RemoteEvent (AdminActionEvent / MusicControlEvent)
    SAS->>SMS: Play track / Update queue
    SAS->>SLS: Set mode "MusicSync" & Sync warna cover track
    SLS->>Fix: Update warna SpotLight, Beam, & Atribut Workspace.Lighting
    SMS-->>MPS: Broadcast MusicSyncEvent (TimePosition & Track)
    MPS->>MPS: sound.TimePosition = pos; sound:Play()
    loop Setiap RenderStepped (60+ FPS)
        CLC->>MPS: Baca sound.TimePosition & PlaybackLoudness
        CLC->>CLC: Hitung Bar Phase, Pola Koreografi & Shutter Cut
        CLC->>Fix: Update Motor6D.C0 (Pan/Tilt) & SpotLight.Brightness
    end
```

### Step-by-Step Execution:
1. **Pemicu Aksi**: Admin menekan tombol Play atau memilih preset di UI (`LightingRemoteView` / `AdminStageFxTab`).
2. **Otorisasi Server**: `ServerAdminService` memvalidasi hak akses admin, lalu memerintahkan `ServerMusicService` memutar lagu dan `ServerStageLightingService` mengubah mode menjadi `MusicSync`.
3. **Replikasi & Sinkronisasi Warna**: Server menyinkronkan warna `SpotLight` dan `Beam` dengan warna cover art album (`track.coverColor`) dan meng-inject status ke attribute `Workspace.Lighting`.
4. **Distribusi Jaringan**: Server mem-broadcast `MusicSyncEvent` yang membawa metadata lagu dan `TimePosition`.
5. **Playback Audio Lokal**: `MusicPlayerService` pada masing-masing client memulai pemutaran `SmartphoneMusic` secara sinkron.
6. **Eksekusi Fisik Lokal (RenderStepped Loop)**:
   * `ClientStageLightingController` membaca `sound.TimePosition` dan `sound.PlaybackLoudness`.
   * Menghitung fase birama, memilih pola koreografi, dan menghitung sudut target Pan/Tilt ke `Workspace.Mic`.
   * Menghaluskan pergerakan menggunakan *motor slew-rate filter* (zero-jerk).
   * Memperbarui `Motor6D.C0` pada motor `Pan` & `Tilt` serta mengatur bukaan *optical shutter* strobo seketika tanpa jeda transmisi jaringan.

---

## 5. Cuplikan Kode Kunci (Phase-Locked Engine Loop)

Cuplikan loop utama dari `ClientStageLightingController.ts`:

```typescript
// 1. PEMBACAAN WAKTU & PERHITUNGAN SUBDIVISI BIRAMA
const currentTrack = musicService.getCurrentTrack();
const baseBpm = currentTrack?.bpm ?? 128;
const playbackSpeed = activeSound ? activeSound.PlaybackSpeed : 1.0;
const effectiveBpm = math.clamp(baseBpm * playbackSpeed, 40, 260);

const songTime = activeSound ? activeSound.TimePosition : clockNow;
const beatDuration = 60 / effectiveBpm;
const barDuration = beatDuration * 4; // Birama 4/4
const totalBeats = songTime / beatDuration;

// Subdivisi fase ketukan (0.0 s/d 1.0)
const beatPhase = (songTime % beatDuration) / beatDuration;
const barPhase = (songTime % barDuration) / barDuration;
const eighthPhase = (songTime % (beatDuration * 0.5)) / (beatDuration * 0.5);
const sixteenthPhase = (songTime % (beatDuration * 0.25)) / (beatDuration * 0.25);

// 2. DETEKSI HENTAKAN AUDIO (PLAYBACK LOUDNESS)
const rawLoudness = activeSound?.PlaybackLoudness ?? 0;
const deltaLoudness = rawLoudness - this.lastLoudness;
this.lastLoudness = rawLoudness;

// Trigger transient kick / drop
const isKickSpike = deltaLoudness > math.max(12, this.mediumEnergy * 0.14) && rawLoudness > 30;
if (isKickSpike && clockNow - this.lastKickTimestamp >= 0.14) {
    this.lastKickTimestamp = clockNow;
    this.kickIntensity = 1.0;
}

// 3. SLEW-RATE MOTOR & UPDATE MOTOR6D.C0
const motorSlewRate = 8.0 + (effectiveBpm / 60) * 4.0;

for (const f of this.fixtures) {
    const [basePan, baseTilt] = this.getMicAim(f); // Titik fokus acuan mic panggung
    const [pPan, pTilt] = this.evaluateMusicalPattern(currentPatternIdx, f, barPhase, totalBeats, total);

    f.targetPan = basePan + pPan + (this.kickIntensity * (f.column % 2 === 1 ? 0.04 : -0.04));
    f.targetTilt = baseTilt + pTilt;

    // Penghalusan inersia motor fisik (zero-jerk)
    f.currentPan += (f.targetPan - f.currentPan) * math.clamp(dt * motorSlewRate, 0, 1);
    f.currentTilt += (f.targetTilt - f.currentTilt) * math.clamp(dt * motorSlewRate, 0, 1);

    const safeTilt = math.clamp(f.currentTilt, -0.92, -0.52);

    // Terapkan rotasi fisik langsung ke Motor6D
    if (f.panMotor) f.panMotor.C0 = BASE_PAN_C0.mul(CFrame.Angles(0, 0, f.currentPan));
    if (f.tiltMotor) f.tiltMotor.C0 = BASE_TILT_C0.mul(CFrame.Angles(0, 0, safeTilt));
}
```
