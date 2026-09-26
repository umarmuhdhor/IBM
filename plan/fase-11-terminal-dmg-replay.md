# Fase 11 — Tonton Bob rekan (aktivitas Bob IDE), `.dmg`, landing + replay web

| Field | Nilai |
|---|---|
| Jalur | **Aarief**: bagian A, B, C, E (`lane/app`) · **Imelda**: bagian D, landing + replay (`lane/web`) |
| Slot WITA | Aarief: 11a Sab 16:00–21:00 · 11b Sab 23:00–Min 01:00 · tidur 01:00–06:00 · 11c Min 06:00–11:00 · Imelda: 11D1 mulai setelah fase 00 s/d Sab 21:00 (fixture) · 11D2 Sab 23:00–Min 01:00 (I3) + setelah rekaman final Min 14:00 (replay final) |
| Estimasi | 9 jam |
| Prasyarat | A/B/C/E: 09, dan `POST /v1/bob/activity` + event `bob.activity` dari fase 03 (sebelum masuk `main`, pakai mock fase 02 `--scenario demo`) · D: fase 00, fixture `packages/server/test/fixtures/flow-export.json` (fase 05) dan `bob-kit/prompts/bob-quotes.json` (fase 07), disalin ke `packages/web`; sebelum ada, fixture sintetis bertanda `TODO(sync:…)`. Rekaman nyata dari fase 10 untuk replay final. Relay `term.*` hanya untuk P1. |
| Requirement PRD | JT-01, JT-02, JT-03 (sisi klien), DA-01, UI-05, UI-09, EV-02 (P0) · JT-04, UI-06, UI-08, DA-05 (P1) · JT-05 (P2) |
| Model | Sonnet 5 · effort high (Opus 5.5 kalau tap xterm atau flow control bermasalah) |
| Bob slice | **C4** opsi `--md` di `bob-evidence.sh` + `evidence-check.ts` |
| Fase berikutnya | Aarief: 11a → **10** → 11b → 11c → 14 · Imelda: 11D1 → **10** → 11D2 → 14 (PROMPT "Urutan fase") |

**Sub-fase untuk mode auto** (masing-masing punya baris PROGRESS, snapshot `lane/<LANE_ID>-f<sub>`, dan PR sendiri):

| Sub-fase | Isi | Selesai sebelum |
|---|---|---|
| 11a (Aarief) | Bagian A (Watch Bob, P0) + bagian E (Bob slice C4) | Sab 21:00 (lalu fase 10) |
| 11b (Aarief) | Bagian C langkah 9–12 (`.dmg`, ikon, `radar-cli.tgz`, Release) | Min 01:00 |
| 11c (Aarief) | Langkah 13 (uji pasang Mac teman), A.5 JT-04 (P1) bila P0 hijau, poles | Min 11:00 (GATE 2) |
| 11D1 (Imelda) | Bagian D langkah 14–19 dengan fixture (Bob slice I1, I2) | Sab 21:00 (lalu fase 10) |
| 11D2 (Imelda) | Langkah 19b (Bob slice I3), lalu replay final dari rekaman (Min setelah 14:00) | Min 17:00 |

## Tujuan

1. **Momen multiplayer:** Budi klik "Watch Andi's Bob", dan prompt serta file yang sedang ditulis Bob IDE Andi tampil live di laptop Budi.
2. **Bisa dipasang:** file `IBM Bob Live Collab.dmg` yang dipasang di 4 Mac.
3. **Juri bisa menonton sendiri:** `/demo` memutar ulang sesi nyata, termasuk timeline aktivitas Bob dan panel "Bob inside".

## Bacaan wajib

- `../DESIGN.md` §5.6–5.8 · PRD §10.7, §10.6 DA-01, §10.5 UI-05 · `ref/R3` §3.9 · `ref/R7` §3–§4
- `docs/ORCA_MAP.md` (titik `term.write` dan input pty) · `orca:config/electron-builder.config.cjs` · script `build:mac`, `build:unpack` di `orca:package.json`

## Output

- `orca:src/renderer/src/components/radar/WatchBobView.tsx` (P0); `lib/radar/terminal-share.ts`, `components/radar/{ShareTerminalButton,WatchTerminalView}.tsx` (P1)
- Build: `IBM Bob Live Collab-<ver>-arm64.dmg` di GitHub Release `v0.3.0` + `radar-cli.tgz`
- `packages/web/app/page.tsx` (landing = **Application URL** di form lablab), `packages/web/app/demo/page.tsx`, `packages/web/lib/replay-player.ts`, `scripts/export-replay.ts` → `packages/web/public/demo/{events.json,meta.json,bob-quotes.json}`
- `scripts/bob-evidence.sh` (tambah opsi `--md`), `scripts/evidence-check.ts` (dua file ini pengecualian folder untuk Aarief, PLAN §2)
- Deploy Cloudflare Pages `ibm-bob-live-collab.pages.dev` (`pnpm -C radar deploy:web`)

## Langkah kerja

### A. Tonton Bob rekan: stream aktivitas Bob IDE (11a, P0)

1. **`WatchBobView`** (tab "Watching <nama>'s Bob · <mode>"): timeline live dari event `bob.activity` + event server terkait member itu (edit file, blokir, submit). Setiap baris berisi jam, ikon jenis (prompt, baca, tulis, blokir, giliran selesai), path, jumlah baris, dan jejak `BobTrace` (`hook · PreToolUse · lock_guard → blocked`, `mcp · radar.why_blocked`, mode). Border warna pemilik.
2. **Tombol Watch** di `TeamPanel` untuk setiap anggota yang online. Indikator "writing ✎" dan "blocked" di kartu anggota berasal dari event yang sama.
3. **Privasi** (JT-03): toggle "Share my prompts" di Settings → Live Collab, yang menulis `shareprompts` ke `.radar/local.json` untuk dibaca hook.
4. **Uji:** 2 laptop, keduanya Bob IDE. Prompt di A → muncul di app B < 1 s (log latensi). Blokir di B terlihat di timeline A dan di Mission Control.
5. **Tonton terminal Bob Shell (P1, JT-04, hanya kalau P0 lain hijau):** tap output xterm → `term.frame` → `WatchTerminalView` read-only (spesifikasi relay R3 §3.9). Tidak dibutuhkan untuk demo, karena demo memakai Bob IDE.

### B. Ketik sebagai tamu di terminal Bob Shell (P2, lewati untuk hackathon)

8. `GuestInputBar` di `WatchTerminalView` → `term.input.request`. Host melihat toast Allow 10 min / Deny → `term.input.grant`. Keystroke tamu → `term.input` → host menulis ke pty lewat jalur input Orca yang sama dengan keyboard (dari ORCA_MAP), hanya selama grant aktif. Pill `GuestCursor` "Budi" di baris input host. Semua grant/revoke tercatat di event.

### C. Build `.dmg` (11b, P0)

9. **Resep build yang sudah terbukti** (Mac Aarief, 25 Sep, Node 24 + pnpm 12, ±7 menit total):
   ```bash
   nvm use 24
   pnpm -C app install && pnpm -C app/mobile install        # mobile wajib: build:desktop membundel mobile-web
   pnpm -C app build:desktop                                # typecheck, relay, cli, electron-vite, web, mobile-web
   pnpm -C app build:notification-status-macos && pnpm -C app build:keyboard-layout-macos
   # build:computer-macos (helper Computer Use) GAGAL di lipo, dan fitur itu tidak dipakai → lewati
   pnpm -C app run ensure:electron-runtime
   CSC_NAME=- CSC_IDENTITY_AUTO_DISCOVERY=false pnpm -C app exec electron-builder --config config/electron-builder.config.cjs --dir
   # hasil: app/dist/mac-arm64/<productName>.app (ad-hoc signed)
   ```
   Untuk `.dmg`: ganti `--dir` dengan `--mac dmg`. `CSC_NAME=-` wajib, karena tanpa itu `codesign` memakai sertifikat "Apple Development" di keychain dan gagal non-interaktif.
10. Ikon app dari `prompt_ui.md` #11 → `resources/` (`.icns` via script `build:icons` Orca kalau cocok, atau `iconutil`). `electron-builder.config.cjs`: `productName`, `appId: dev.livecollab.app`, `mac.target: dmg`, `arch: arm64`, **tanpa** signing/notarize (`identity: null`). Kalau `build:mac` memaksa native helper yang gagal, pakai `build:unpack` + `electron-builder --mac dmg --prepackaged`.
11. Paket CLI: `pnpm -C radar --filter @radar/sync pack` → `radar-cli.tgz` (bundle hook + MCP + kit di dalamnya).
12. GitHub Release `v0.3.0` (`gh release create`): `.dmg`, `radar-cli.tgz`, catatan pasang (System Settings → Privacy & Security → **Open Anyway**; sejak macOS 15 Sequoia klik kanan → Open tidak lagi melewati Gatekeeper; alternatif `xattr -dr com.apple.quarantine "/Applications/IBM Bob Live Collab.app"`). Uji di Mac kedua: unduh `.dmg` lewat browser (supaya dapat atribut quarantine), pasang, buka, catat pesan Gatekeeper yang muncul.
13. Uji pasang di **Mac teman** dari nol: unduh → pasang → Settings → Connect → tersinkron. Catat waktunya (metrik "< 3 menit").

### D. [Imelda] Landing + replay web (P0) · Bob slice **I1** pemutar replay + `/demo`, **I2** landing, **I3** draf Long Description

Imelda memakai komponen `@radar/ui` buatan Aarief (fase 09 langkah 6). Sebelum komponennya siap, pakai data fixture dan placeholder sederhana. Tambahkan juga halaman `/gallery` yang menampilkan semua komponen untuk pengecekan visual.

14. **`scripts/export-replay.ts`**: input export server (`GET /v1/events/export`, termasuk event `bob.activity`) + `bob-quotes.src.json`. Output `events.json` (sensor: gagal kalau ada `rdr_`, `ghp_`, `sk-`), dan `meta.json` (chapter Plan/Live/Near-miss/Review/Commit, link repo/bob_sessions/video/deck).
15. **`lib/replay-player.ts`**: play/pause/seek/speed. Seek = `applyEvents` sampai `t`, plus timeline aktivitas Bob sampai `t` (snapshot tiap 10 s untuk seek cepat).
16. **`/demo`** (DESIGN §5.8): header + badge `no login · no API key`. Counter. Tiga kolom: Andi (timeline aktivitas Bob IDE), Mission Control (views `@radar/ui` read-only), Budi (timeline aktivitas Bob IDE). Timeline chapter. Panel **Bob inside**: untuk event yang dipilih, tampilkan primitif Bob (hook/MCP/mode), payload ringkas, kutipan Bob, dan link ke `bob_sessions/...` di GitHub. Autoplay 2×, jeda > 5 s dipadatkan.
17. Statis penuh: `next.config` `output: 'export'` (hasil di `packages/web/out/`, dideploy ke Cloudflare Pages), tanpa panggilan jaringan selain origin. Playwright `e2e/demo.spec.ts` (skill `e2e-testing`): autoplay jalan, near-miss muncul ≤ 30 s di 8×, klik event → Bob inside, dan tidak ada request ke domain lain.
18. **Landing `/`** (UI-09, Carbon gelap: DESIGN §5.11 + `UI Inspo & Design/landing-style/README.md`, ±45 menit): hero (judul, tagline, GIF near-miss), tombol utama **Watch the live replay** → `/demo`, tombol **Download for macOS** → `.dmg` di Release terbaru (URL dari `meta.json`), 3 langkah pasang (termasuk Privacy & Security → Open Anyway), dan link Repo · bob_sessions · Video · Deck. Sebagian besar juri kemungkinan memakai Windows, jadi urutan tombol (replay = utama biru, download = ghost sekunder) sudah benar — pastikan caption kecil di bawah **Download for macOS** juga menyebut eksplisit "macOS arm64 only", supaya juri non-Mac tidak membuang klik dan langsung tahu replay adalah cara menonton produk untuk mereka. Tambahkan kalimat "Community hackathon project, not an official IBM product · built on Orca (MIT)". Statis, tanpa login. Setelah jadi: screenshot Playwright (desktop 1440 + mobile 390) lalu jalankan skill `better-interface`. Perbaiki temuan HIGH.

18a. **Poles landing — ada kehidupan** (bukan fase baru, masih 11D1 / I2; `D-imelda-10`). Landing sekarang gelap tapi sepi (poster). Ikut struktur [Amoeba](https://useamoeba.com/) — **jangan** copy merek/kalimat/logo. Resep lengkap + urutan build: `UI Inspo & Design/landing-style/README.md` (Build order). Kerjakan di `radar/packages/web/app/page.tsx` berurutan:

    1. Jendela produk HTML di bawah hero (Andi writing, Budi blocked, Citra Needs you; warna orang DESIGN §2.1).
    2. Tab/chapter di window bisa diklik; satu CTA **Watch full replay** → `/demo/`.
    3. Motion pendek: pulse Andi 3 s, kartu Needs you 180 ms; `prefers-reduced-motion`.
    4. Empat mekanisme + tiga kata (Visible / Locked / Human-approved) + 1 baris per primitif Bob di dark island. Ganti 3 kartu abstrak lama, jangan dobel.
    5. Angka hanya dari `public/demo/meta.json`. GIF near-miss tetap placeholder sampai rekaman fase 10.
    6. Screenshot 1440 + 390, `better-interface`, perbaiki HIGH.

    Di luar scope 18a: logo bar palsu, blog, rewrite `/demo`, ganti token Carbon.
19. Deploy Cloudflare Pages (`pnpm -C radar deploy:web`). Buka `/` dan `/demo` dari incognito dan ponsel (tab A/MC/B).

19b. **Bob slice I3** (11D2, Sab 23:00–Min 01:00, bareng naskah video; slice terjadwal, dikecualikan dari aturan "Bob IDE setelah Sab 23:00" PLAN §7 — **kerjakan malam ini, jangan tunda ke fase 14**, ±3 Bobcoin). PRD sudah beku, jadi tidak perlu menunggu lane lain. Prompt: "Baca `PRD.md` (khususnya §1–§3, §18) dan `plan/ref/R7-bukti-bob.md` §6, lalu tulis draf **Long Description (Problem & Solution Statement)** ≤ 500 kata: masalah + angka/sumber, solusi, target user, cara interaksi, kenapa kreatif/unik (tabel pembanding singkat), cara mengatasi masalah secara baru. Simpan sebagai `radar/docs/deck/long-description.draft.md`." Bukti: `03-long-description-draft`. Draf ini dipoles manual jadi final di fase 14 langkah 8 (`SUBMISSION.md`), bukan ditulis ulang dari nol.

### E. Bob slice C4 — script bukti (kapan saja di fase ini, ±2 Bobcoin)

20. Prompt: "Tambahkan opsi `--md <path>` (salin ekspor md task + sensor) ke `radar/scripts/bob-evidence.sh` tanpa mengubah perilaku default, dan buat `radar/scripts/evidence-check.ts` sesuai `plan/ref/R7-bukti-bob.md` §3–§4. Bash POSIX + macOS `screencapture`. `evidence-check.ts` membaca `plan/team.json`, `bob_sessions/`, dan trailer `Bob-Assisted` dari `git log --all`." Bukti: `04-evidence-scripts`. Claude Code menambah test untuk `evidence-check.ts` (fixture folder palsu).

## Verifikasi

```bash
pnpm -C app tc && pnpm -C app test -- src/renderer/src/lib/radar src/renderer/src/components/radar
pnpm -C radar --filter @radar/web build && pnpm -C radar --filter @radar/web exec playwright test e2e/demo.spec.ts
pnpm -C radar evidence:check       # boleh merah untuk anggota yang belum selesai, tapi tidak boleh error script
ls -lh dist/*.dmg                  # atau lokasi output electron-builder
```

## Kriteria selesai (DoD)

- [ ] JT-01/02/03: "Watching <nama>'s Bob" menampilkan aktivitas Bob IDE rekan di 2 Mac, p95 < 1 s (angka dari log), dan toggle share prompt berfungsi.
- [ ] DA-01: `.dmg` terpasang di Mac teman dari nol (< 3 menit), Release `v0.3.0` publik.
- [ ] UI-05: `/demo` jalan tanpa login, API key, atau server. Panel Bob inside berfungsi.
- [ ] UI-09: landing `/` live di Cloudflare Pages, dengan tombol replay dan download `.dmg` yang berfungsi.
- [ ] EV-02: `bob-evidence.sh --md` berfungsi dan `evidence:check` hijau untuk isi `bob_sessions/` saat ini.
- [ ] JT-04 selesai **atau** ditunda dengan alasan tercatat (urutan potong PRD §16).

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Titik tap xterm sulit dijangkau (output lewat worker/webgl) | Tap di level IPC data pty yang masuk ke renderer (sebelum ke xterm). Pilihan terakhir: tap di main process pada listener pty, tanpa mengubah alurnya. Catat D-aarief-.. |
| Frame terlalu besar (TUI Bob me-redraw penuh) | Batasi 20 fps, gabungkan frame, kirim snapshot setiap 5 s dan buang frame lama |
| `.dmg` gagal dibuat | Kirim `.app` di dalam `.zip` (`--dir` + `ditto -c -k`). Demo tetap memakai `pnpm -C app dev`. |
| Gatekeeper memblokir app / "app is damaged" | Instruksi Open Anyway + `xattr` di README + Release notes. Pastikan build memakai `CSC_NAME=-` (ad-hoc): app arm64 tanpa signature sama sekali tidak bisa jalan |
| Rekaman nyata belum ada | Replay memakai `sim-3pc` + export milestone Sab 23:00. Ganti setelah rekaman final Min 11:00–14:00 (11D2). |

## Catatan handoff

- Fase 14: URL `/demo`, Release, dan GIF near-miss dipakai di README juri, form submission (Application URL, Demo Application Platform = macOS desktop app + web replay), dan video.
- Setelah rekaman final (Min 11:00–14:00): jalankan ulang `export-replay.ts` lalu deploy ulang (11D2).
