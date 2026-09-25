# Fase 11 — Tonton terminal Bob rekan, `.dmg`, replay web untuk juri

| Field | Nilai |
|---|---|
| Jalur | **Lane C (Aarief)** · branch `lane/app` (sub-branch opsional `lane/app-replay` di worktree kedua untuk bagian C) |
| Slot WITA | 11a Sab 16:00–21:00 · 11b Sab 23:00–Min 01:00 · tidur 01:00–06:00 · 11c Min 06:00–11:00 |
| Estimasi | 9 jam |
| Prasyarat | 09. Relay `term.*` server dari fase 06 (sebelum siap, pakai mock fase 02 yang sudah mendukung `term.*`). Rekaman nyata dari fase 10 untuk replay. |
| Requirement PRD | JT-01, JT-02, JT-03 (sisi klien), JT-05, DA-01, UI-05, EV-02 (P0) · JT-04, UI-06, UI-08, DA-05 (P1) |
| Model | Sonnet 5 · effort high (Opus 5.5 kalau tap xterm atau flow control bermasalah) |
| Bob slice | **C4** `bob-evidence.sh` versi lengkap + `evidence-check.ts` |
| Fase berikutnya | 10 (bergabung ke integrasi), lalu 14 |

## Tujuan

1. **Momen multiplayer:** Budi klik "Watch terminal", dan terminal Bob milik Andi tampil live di laptop Budi.
2. **Bisa dipasang:** file `IBM Bob Live Collab.dmg` yang dipasang di 3 Mac.
3. **Juri bisa menonton sendiri:** `/demo` memutar ulang sesi nyata, termasuk frame terminal dan panel "Bob inside".

## Bacaan wajib

- `../DESIGN.md` §5.6–5.8 · PRD §10.7, §10.6 DA-01, §10.5 UI-05 · `ref/R3` §3.9 · `ref/R7` §3–§4
- `docs/ORCA_MAP.md` (titik `term.write` dan input pty) · `orca:config/electron-builder.config.cjs` · script `build:mac`, `build:unpack` di `orca:package.json`

## Output

- `orca:src/renderer/src/lib/radar/terminal-share.ts`, `components/radar/{ShareTerminalButton,WatchTerminalView,GuestInputBar}.tsx`
- Build: `IBM Bob Live Collab-<ver>-arm64.dmg` di GitHub Release `v0.3.0` + `radar-cli.tgz`
- `packages/web/app/page.tsx` (landing = **Application URL** di form lablab), `packages/web/app/demo/page.tsx`, `packages/web/lib/replay-player.ts`, `scripts/export-replay.ts` → `packages/web/public/demo/{events.json,frames.json,meta.json,bob-quotes.json}`
- `scripts/bob-evidence.sh` (lengkap), `scripts/evidence-check.ts`
- Deploy Vercel `ibm-bob-live-collab.vercel.app/demo`

## Langkah kerja

### A. Tonton terminal (11a, P0)

1. **Tap output.** Di titik tempat renderer Orca menulis data pty ke xterm (dari ORCA_MAP), tambah hook ringan: kalau `termId` sedang dibagikan, salin `data` ke `terminal-share.ts`. **Jangan** mengubah alur data Orca atau flow control. Salin saja, secara async. Terminal yang dibagikan hanya terminal agent di tab yang dipilih host.
2. **`terminal-share.ts`**: `share(termId, title)` → kirim `term.share`. Gabungkan data 16 ms → `term.frame {seq, data base64, ts}` (maks 32 KB, pecah kalau lebih). Balas `term.need_snapshot` dengan `SerializeAddon.serialize()` (addon sudah dipakai Orca, cek ORCA_MAP). `unshare` saat tab ditutup, app keluar, atau tombol dimatikan.
3. **`ShareTerminalButton`** di header tab terminal agent: ikon + teks **Share** / `👁 2 watching`. Default mati (NFR-12).
4. **`WatchTerminalView`**: tab baru "Watching <nama>'s Bob · <mode>". Membuat `@xterm/xterm` read-only (`disableStdin: true`), `TerminalFrame` dengan border warna pemilik, menerapkan `term.snapshot` lalu frame berurutan `seq` (buang duplikat, minta snapshot ulang kalau ada celah). Mengirim `term.ack` setiap 50 frame untuk metrik latensi. Menampilkan `term.ended`.
5. **Tombol Watch** di `TeamPanel` aktif kalau `term.list` punya terminal milik anggota itu.
6. **Uji:** dua instance app di satu Mac (`pnpm dev` + `pnpm dev-stable-name` dengan userData berbeda) atau dua Mac → p95 latensi < 500 ms (log `term.latency`). Ketik `ls`, jalankan `bob`, dan warna/ANSI tampil sama. Tutup share → penonton melihat "host stopped sharing" < 1 s.
7. **Security review** (`security-reviewer`): frame hanya ke anggota workspace, tidak ada input dari penonton di P0, dan tidak ada data terminal di log.

### B. Ketik sebagai tamu (P1 — bonus, kerjakan hanya kalau A, C, D hijau)

8. `GuestInputBar` di `WatchTerminalView` → `term.input.request`. Host melihat toast Allow 10 min / Deny → `term.input.grant`. Keystroke tamu → `term.input` → host menulis ke pty lewat jalur input Orca yang sama dengan keyboard (dari ORCA_MAP), hanya selama grant aktif. Pill `GuestCursor` "Budi" di baris input host. Semua grant/revoke tercatat di event.

### C. Build `.dmg` (11b, P0)

9. Ikon app dari `prompt_ui.md` #11 → `resources/` (`.icns` via script `build:icons` Orca kalau cocok, atau `iconutil`). `electron-builder.config.cjs`: `productName`, `appId: dev.livecollab.app`, `mac.target: dmg`, `arch: arm64`, **tanpa** signing/notarize (`identity: null`). Kalau `build:mac` memaksa native helper yang gagal, pakai `build:unpack` + `electron-builder --mac dmg --prepackaged`.
10. Paket CLI: `pnpm -C radar --filter @radar/sync pack` → `radar-cli.tgz` (bundle hook + MCP + kit di dalamnya).
11. GitHub Release `v0.3.0` (`gh release create`): `.dmg`, `radar-cli.tgz`, catatan pasang (klik kanan → Open, atau `xattr -dr com.apple.quarantine "/Applications/IBM Bob Live Collab.app"`).
12. Uji pasang di **Mac teman** dari nol: unduh → pasang → Settings → Connect → tersinkron. Catat waktunya (metrik "< 3 menit").

### D. Replay web `/demo` (11c, P0)

13. **`scripts/export-replay.ts`**: input export server (`GET /v1/events/export?withTerminals=true` dari sesi rekaman dengan `RECORD_TERMINALS=true`) + `bob-quotes.src.json`. Output `events.json` (sensor: gagal kalau ada `rdr_`, `ghp_`, `sk-`), `frames.json` (frame terminal A dan B, dikompresi, target < 3 MB), dan `meta.json` (chapter Plan/Live/Near-miss/Review/Commit, link repo/bob_sessions/video/deck).
14. **`lib/replay-player.ts`**: play/pause/seek/speed. Seek = `applyEvents` sampai `t`, plus memutar ulang frame terminal sampai `t` (snapshot tiap 10 s untuk seek cepat).
15. **`/demo`** (DESIGN §5.8): header + badge `no login · no API key`. Counter. Tiga kolom: Andi (mini xterm replay), Mission Control (views `@radar/ui` read-only), Budi (mini xterm replay). Timeline chapter. Panel **Bob inside**: untuk event yang dipilih, tampilkan primitif Bob (hook/MCP/mode), payload ringkas, kutipan Bob, dan link ke `bob_sessions/...` di GitHub. Autoplay 2×, jeda > 5 s dipadatkan.
16. Statis (`force-static`), tanpa panggilan jaringan selain origin. Playwright `e2e/demo.spec.ts` (skill `e2e-testing`): autoplay jalan, near-miss muncul ≤ 30 s di 8×, klik event → Bob inside, dan tidak ada request ke domain lain.
17. **Landing `/`** (UI-09, DESIGN §5.11, ±30 menit): hero (judul, tagline, GIF near-miss), tombol utama **Watch the live replay** → `/demo`, tombol **Download for macOS** → `.dmg` di Release terbaru (URL dari `meta.json`), 3 langkah pasang (termasuk klik kanan → Open), dan link Repo · bob_sessions · Video · Deck. Tambahkan kalimat "Community hackathon project, not an official IBM product · built on Orca (MIT)". Statis, tanpa login.
18. Deploy Vercel. Buka `/` dan `/demo` dari incognito dan ponsel (tab A/MC/B).

### E. Bob slice C4 — script bukti (kapan saja di fase ini, ±2 Bobcoin)

18. Prompt: "Lengkapi `radar/scripts/bob-evidence.sh` dan buat `radar/scripts/evidence-check.ts` sesuai `radar/plan/ref/R7-bukti-bob.md` §3–§4. Bash POSIX + macOS `screencapture`. `evidence-check.ts` membaca `radar/plan/team.json`, `bob_sessions/`, dan trailer `Bob-Assisted` dari `git log --all`." Bukti: `04-evidence-scripts`. Claude Code menambah test untuk `evidence-check.ts` (fixture folder palsu).

## Verifikasi

```bash
pnpm tc && pnpm test -- src/renderer/src/lib/radar src/renderer/src/components/radar
pnpm -C radar --filter @radar/web build && pnpm -C radar --filter @radar/web exec playwright test e2e/demo.spec.ts
pnpm -C radar evidence:check       # boleh merah untuk anggota yang belum selesai, tapi tidak boleh error script
ls -lh dist/*.dmg                  # atau lokasi output electron-builder
```

## Kriteria selesai (DoD)

- [ ] JT-01/02: tonton terminal Bob rekan di 2 Mac, p95 < 500 ms (angka dari log), dan share mati secara default.
- [ ] DA-01: `.dmg` terpasang di Mac teman dari nol (< 3 menit), Release `v0.3.0` publik.
- [ ] UI-05: `/demo` jalan tanpa login, API key, atau server. Panel Bob inside berfungsi.
- [ ] UI-09: landing `/` live di Vercel, dengan tombol replay dan download `.dmg` yang berfungsi.
- [ ] EV-02: `bob-evidence.sh` lengkap dan dipakai minimal sekali oleh anggota lain.
- [ ] JT-04 selesai **atau** ditunda dengan alasan tercatat (urutan potong PRD §16).

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Titik tap xterm sulit dijangkau (output lewat worker/webgl) | Tap di level IPC data pty yang masuk ke renderer (sebelum ke xterm). Pilihan terakhir: tap di main process pada listener pty, tanpa mengubah alurnya. Catat D-C.. |
| Frame terlalu besar (TUI Bob me-redraw penuh) | Batasi 20 fps, gabungkan frame, kirim snapshot setiap 5 s dan buang frame lama |
| `.dmg` gagal dibuat | Kirim `.app` di dalam `.zip` (`--dir` + `ditto -c -k`). Demo tetap memakai `pnpm dev`. |
| Gatekeeper memblokir app | Instruksi `xattr` di README + Release notes |
| Rekaman nyata belum ada | Replay memakai `sim-3pc` + frame rekaman lokal. Ganti setelah rekaman Minggu 09:00. |

## Catatan handoff

- Fase 14: URL `/demo`, Release, dan GIF near-miss dipakai di README juri, form submission (Application URL, Demo Application Platform = macOS desktop app + web replay), dan video.
- Setelah rekaman final Minggu pagi: jalankan ulang `export-replay.ts` lalu deploy ulang.
