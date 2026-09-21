# TASK: Clean-up Sistem Preset di Stage Lighting UNDERGRID

> **Status**: Ready to execute
> **Priority**: High — memblokir strobo untuk jalan
> **Scope**: Hapus `AtmospherePreset` (jalur kontrol paralel) dari sistem
> **Tidak termasuk**: Fitur baru, refactor UI, perubahan timing engine

---

## 1. KONTEKS PROJECT

Project **UNDERGRID** — Roblox concert experience, stack **roblox-ts** (TypeScript strict).

Sistem stage lighting terdiri dari 40 moving light fixture di `Workspace.Lighting`
(tag CollectionService `"StageLight"`), dikendalikan oleh layer berikut:

| Layer | File | Tanggung Jawab |
| :--- | :--- | :--- |
| Server State | `src/server/ServerStageLightingService.ts` | Single source of truth mode lighting, warna, brightness, beam, strobo. Menyimpan `controlState: StageLightingControlPayload` dan sync ke `Workspace.Lighting` attributes (`StageLightingMode`, `IsMusicSync`, `StageLightingBrightness`, `StageLightingBeamEnabled`, `StageLightingStrobeSpeed`). |
| Server Admin | `src/server/ServerAdminService.ts` | Handler aksi admin via `AdminControlEvent`, otorisasi via `isPlayerAdmin(player)`. |
| Client Visual | `src/client/ClientStageLightingController.ts` | Phase-Locked Musical Engine di `RenderStepped`. Baca `sound.TimePosition` sebagai master clock, hitung fase birama 4/4, gerakkan `Motor6D.C0` + strobo shutter. **Strobo hanya aktif jika `mode === StageLightMode.MusicSync`** atau `strobeSpeed > 0`. |
| Client Admin | `src/client/services/AdminService.ts` | Wrapper client untuk fire remote ke server. |
| UI | `src/client/ui/tabs/AdminStageFxTab.tsx`, `src/client/ui/LightingRemoteView.tsx` | Panel admin & remote HUD. |
| Types | `src/shared/types/AdminTypes.ts`, `src/shared/types/StageLightingTypes.ts` | Type definitions. |

---

## 2. MASALAH YANG DIIDENTIFIKASI

Sistem saat ini punya **DUA jalur kontrol lighting paralel** yang saling konflik:

- **Jalur A — `StageLightMode` + `StageLightingControlPayload`**
  (via remote `SetStageLightingControl`)
- **Jalur B — `AtmospherePreset`**
  (via remote `ToggleAtmospherePreset`)

### 2.1 Root Cause

Jalur B melakukan **override mode** jalur A secara diam-diam:

| Aksi Admin | Efek di Server | Efek di Client |
| :--- | :--- | :--- |
| Klik `AtmospherePreset.Blackout` | `stageLighting.setMode(StageLightMode.Off)` | Loop strobo berhenti |
| Klik `AtmospherePreset.Spotlight` | `stageLighting.setMode(StageLightMode.SpotlightCenter)` | Loop strobo berhenti |
| Klik `AtmospherePreset.Strobe` | `stageLighting.setMode(StageLightMode.Strobe)` + `task.spawn` loop sendiri | Bypass phase-lock engine |
| Klik `AtmospherePreset.FogMachine` | Set `Lighting.FogStart/FogEnd` | Tidak konflik, tapi tetap jalur B |

### 2.2 Dampak

Setelah admin pakai preset apapun, `mode` bukan lagi `MusicSync`. Di client:

```typescript
const isSyncActive = mode === StageLightMode.MusicSync || isMusicSync === true;
if (!isSyncActive && !isManualStrobe) return;
```

Loop berhenti → **strobo tidak pernah jalan** meski lagu sedang diputar.

Tambahan: `AtmospherePreset.Strobe` punya `task.spawn` loop dengan `task.wait(0.12)` —
**melanggar aturan timing** (bukan phase-locked ke `sound.TimePosition`).

---

## 3. TASK

Hapus **seluruh jalur B (`AtmospherePreset`)** secara bersih.

Setelah clean-up, satu-satunya kontrol lighting adalah:
- `StageLightMode` (via `SetStageLightingControl`)
- `StageLightingControlPayload`

---

## 4. FILE YANG HARUS DIUBAH

### 4.1 `src/shared/types/AdminTypes.ts`

**Action:**
- Hapus enum `AtmospherePreset` sepenuhnya.
- Hapus field `activePresets: AtmospherePreset[]` dari interface `AdminStateSync`.
- Sisakan:

```typescript
export interface AdminStateSync {
    isQueueLocked: boolean;
    stageLighting?: StageLightingControlPayload;
}
```

- Tambahkan komentar di atas interface:

```typescript
// SYNC: AtmospherePreset dihapus — kontrol lighting hanya via StageLightMode
// untuk mencegah konflik mode (strobo gagal jalan karena preset override MusicSync).
```

### 4.2 `src/client/services/AdminService.ts`

**Action:**
- Hapus method `isPresetActive(preset: AtmospherePreset): boolean`.
- Hapus method `toggleAtmospherePreset(preset: AtmospherePreset): void`.
- Hapus import `AtmospherePreset` dari `shared/types`.
- Update inisialisasi state: buang `activePresets: []`.

**Expected final state:**

```typescript
private state: AdminStateSync = {
    isQueueLocked: false,
};
```

### 4.3 `src/server/ServerAdminService.ts`

**Action:**
- Hapus field `private activePresets = new Set<AtmospherePreset>();`
- Hapus field `private strobeThread?: thread;`
- Hapus field `originalBrightness`, `originalClockTime`, `originalAmbient`, `originalOutdoorAmbient` beserta inisialisasinya di constructor.
- Hapus method `toggleAtmospherePreset()`, `activatePreset()`, `deactivatePreset()`.
- Hapus `case "ToggleAtmospherePreset":` dari `handleAdminAction()`.
- Hapus import `Lighting` dari `@rbxts/services` jika setelah perubahan tidak dipakai lagi.
- Hapus import `AtmospherePreset`, `StageLightMode` dari `shared/types` jika tidak dipakai lagi.
- Update `getState()`:

```typescript
public getState(): AdminStateSync {
    return {
        isQueueLocked: ServerMusicService.getInstance().getIsQueueLocked(),
        stageLighting: ServerStageLightingService.getInstance().getControlState(),
    };
}
```

**JANGAN sentuh:**
- Handler `SetStageLightingControl`
- `SendAnnouncement`, `SetQueueLocked`, `ClearQueue`
- `TeleportTo`, `BringPlayer`
- `SetClockTime`, `SetTimeScale`, `ToggleTimePause`, `SetCycleDuration`
- `GiveLightingRemote`
- Logic di `initRemotes()`
- Logic `broadcastStateUpdate()`

### 4.4 `src/client/ui/tabs/AdminStageFxTab.tsx`

**Action:**
- Hapus import `AtmospherePreset`.
- Hapus variable `presetsList`.
- Hapus JSX block `<frame key="AtmosphereFxCard" ...>...</frame>`
  (section "STAGE SPECIAL FX (FOG & BLACKOUT)").
- Pertahankan seluruh section lain:
  - Push Announcement Card
  - Handheld Lighting Remote Card
  - Stage Lighting Motion Card
  - Manual Direction Card
  - Color Card
  - Effects Card (Dimmer, Beam, Strobe, Pulse)
- Pada `strobePresets`, rename label agar konsisten dengan engine:

```typescript
const strobePresets = [
    { label: "Off", speed: 0 },
    { label: "Beat (1/4)", speed: 1 },
    { label: "1/8", speed: 2 },
    { label: "1/16", speed: 3 },
    { label: "32nd", speed: 4 },
];
```

### 4.5 `src/client/ui/LightingRemoteView.tsx`

**Action:**
- Hapus import `AtmospherePreset`.
- Hapus variable `isFogActive` dan `isBlackoutActive`.
- Hapus JSX block di Tab `"colors"`:
  - `<textlabel> "ATMOSPHERE STAGE FX"`
  - `<frame>` berisi tombol Fog Machine & Blackout
- Sisakan di tab `colors`: palet warna + Rainbow/Pulse toggle saja.

---

## 5. ATURAN KERJA (WAJIB)

1. **Baca file sebelum edit.** Jangan asumsi struktur.
2. **Edit bottom-up** sesuai urutan file di Section 4 (types → service → server → UI),
   supaya error TypeScript muncul bertahap dan gampang dilacak.
3. **Jangan refactor yang tidak diminta.** Hanya hapus yang berkaitan dengan `AtmospherePreset`.
4. **Jangan ubah** `ClientStageLightingController.ts` — file ini **TIDAK PERLU DISENTUH**.
   Strobo akan otomatis jalan setelah `mode === MusicSync` tidak lagi di-override.
5. **Jangan ubah** `ServerStageLightingService.ts` — ini single source of truth.
   Kalau ada yang perlu diubah, **ajukan dulu**.
6. **Jangan tambah fitur baru** (Fog, Blackout sebagai mode, dll) di task ini. Itu Fase 2.
7. Kalau ada ambiguitas atau file tidak ditemukan, **tanya dulu** sebelum edit.

---

## 6. VERIFIKASI SETELAH SELESAI

### 6.1 Compile

```bash
rbxtsc --noEmit
```

**Expected:** 0 error.

### 6.2 Grep

```bash
grep -rn "AtmospherePreset" src/
grep -rn "activePresets" src/
grep -rn "toggleAtmospherePreset" src/
grep -rn "isPresetActive" src/
```

**Expected:** 0 hasil untuk setiap command
(kecuali di komentar dokumentasi yang menjelaskan penghapusan).

### 6.3 Runtime Test — Strobo

1. Spawn fixture dengan tag `"StageLight"`.
2. Buka Admin Panel → tab **Stage & FX**.
3. Pilih mode **Sync Musik (BPM Locked)**.
4. Play lagu EDM dengan kick yang jelas.
5. Buka Beat Monitor (F3) — pastikan indikator `KICK: ● SPIKE` muncul.
6. Fixture harus kedip strobo di 1/8 note saat drum roll, 1/16 saat drop.
7. Coba pilih strobe manual (tab Effects → strobe "Beat (1/4)") —
   strobo manual harus jalan juga.
8. Coba klik tombol lain (trim, color, speed, brightness) — mode **tidak boleh**
   berpindah dari `MusicSync`.

### 6.4 Regresi Test

- [ ] Admin Panel buka/tutup normal
- [ ] Push Announcement berfungsi
- [ ] Queue Lock / Clear Queue berfungsi
- [ ] Time Control (set jam, pause, cycle duration) berfungsi
- [ ] Player Management (Teleport / Bring) berfungsi
- [ ] Handheld Lighting Remote bisa diambil
- [ ] Warna cover art album sync ke lampu saat MusicSync
- [ ] Mode Wave / Circle / Ballyhoo / SpotlightCenter masih jalan
- [ ] Mode Manual + trim buttons masih jalan
- [ ] Mode Off mematikan semua lampu

---

## 7. YANG **TIDAK** DIMINTA (JANGAN DILAKUKAN)

- ❌ Jangan buat ulang `AtmospherePreset` dengan nama lain.
- ❌ Jangan tambah fitur baru (Fog, Blackout, dll) di task ini. Itu **Fase 2**.
- ❌ Jangan ubah `ClientStageLightingController.ts`.
- ❌ Jangan ubah `ServerStageLightingService.ts`.
- ❌ Jangan refactor UI yang tidak berkaitan dengan preset.
- ❌ Jangan rename `StageLightMode` atau `StageLightingControlPayload`.
- ❌ Jangan ubah timing engine (beat phase, kick detection, strobo shutter).
- ❌ Jangan ubah sistem audio (`ServerMusicService`, `MusicPlayerService`).

---

## 8. FORMAT OUTPUT

Laporan dalam format berikut:

```
## Files Changed
- path/file.ts — <ringkasan 1 baris>

## Verification

### Compile
<output rbxtsc --noEmit>

### Grep
<output grep>

### Runtime Test
<hasil test strobo + regresi, checklist di atas>

## Notes
<catatan tambahan, jika ada>
```

---

## 9. ROLLBACK PLAN

Kalau hasil edit menyebabkan error yang tidak bisa di-fix dalam 15 menit:

1. `git stash` atau `git checkout -- src/` untuk revert semua perubahan.
2. Buka issue dengan template:
   ```
   File: <nama file>
   Error: <paste error>
   Konteks: <apa yang lagi dikerjain>
   ```

Jangan commit sampai runtime test (Section 6.3 dan 6.4) lulus.

---

## 10. FASE 2 — FITUR YANG HILANG (BACKLOG, BUKAN SEKARANG)

Fitur berikut sengaja dihapus dari scope task ini. Bisa dikerjakan setelah clean-up
selesai & stabil:

| Fitur | Rencana Implementasi |
| :--- | :--- |
| **Blackout** | Tambah `StageLightMode.Blackout` — brightness 0, tanpa nyentuh `Lighting.Brightness` global |
| **Fog Machine** | Tambah field `fogEnabled?: boolean`, `fogDensity?: number` di `StageLightingControlPayload`. Kontrol terpisah di `AdminStageFxTab`. |
| **Server-side Strobe** | Tidak perlu — strobo sudah dihandle client via phase-lock engine. |
| **Preset tersimpan** | Kalau perlu, buat sistem preset baru yang **hanya** berisi `StageLightingControlPayload` utuh (tidak override mode). |

**Aturan Fase 2:** Semua fitur baru HARUS masuk lewat `StageLightMode` atau field di
`StageLightingControlPayload`. **Jangan** buat jalur kontrol paralel lagi.

---

## 11. TRIGGER

Mulai kerja begitu prompt ini dibaca. Kalau ada ambiguitas atau file tidak ditemukan,
**tanya dulu** sebelum edit. Kalau tidak ada ambiguitas, langsung eksekusi.