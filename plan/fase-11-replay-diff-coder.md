# Fase 11 — Replay `/demo` untuk juri, diff viewer, tampilan coder

| Field | Nilai |
|---|---|
| Jalur | Orang 3 |
| Slot WITA | Min 27 Sep 01:00 – 05:00 |
| Estimasi | 4 jam |
| Prasyarat | 09, 10 (butuh `events.*.json` nyata; boleh mulai dengan `events.fixture.json` dari fase 05) |
| Requirement PRD | UI-05 (P0), UI-06 (P1), UI-07 (P1), §07.6, NFR-03 (replay tidak bergantung server) |
| Model | Sonnet 5 · effort medium |
| Fase berikutnya | 14 |

## Tujuan

Juri membuka satu URL sendirian — tanpa Bob, tanpa tim, tanpa login, tanpa API key — dan menonton sesi tim yang sebenarnya diputar ulang: tiga panel (A, Mission Control C, B), bisa diklik untuk melihat diff, pemegang kunci, dan kutipan sesi Bob, dengan link ke repo, `bob_sessions/`, dan video. Replay tetap hidup walaupun server mati.

## Bacaan wajib

- PRD §07.6, §10.5 UI-05..07, §15, §16 (urutan potong: diff viewer nomor 3)
- `plan/ref/R3-kontrak-api.md` §2.22, §2.23, §5 (`bob.said`), §6
- `packages/web/components/*` (fase 09)

## Output

- `scripts/export-replay.ts` → `packages/web/public/demo/{events.json, meta.json, bob-quotes.json}`
- `packages/web/app/demo/page.tsx` + `components/{ReplayControls,ReplayTimeline,CoderPanel,EventDetailDrawer,DiffViewer}.tsx`
- `packages/web/lib/replay-player.ts`
- `packages/web/app/coder/[member]/page.tsx` (UI-07)
- UI-06 di Mission Control live

## Langkah kerja

### A. Data replay (P0)

1. **`scripts/export-replay.ts`**: input `--from <events.live-N.json | server URL + token>`, `--quotes bob-quotes.src.json`, `--out packages/web/public/demo/`:
   - Buang event yang tidak perlu (`sync.applied` kecuali untuk metrik ringkas, `metric`), pastikan `file.changed` punya `patch` (bukan isi utuh), sensor apa pun yang mirip secret (regex token `rdr_`, `ghp_`) → gagal kalau ditemukan.
   - Normalisasi waktu: `t = ts - ts0` (ms sejak awal), pertahankan `ts` asli untuk jam di feed.
   - Sisipkan event `bob.said` dari `bob-quotes.src.json` (kutipan nyata dari `bob_sessions/`, masing-masing `{ afterEventId | atMs, memberId, text, source: "bob_sessions/…" }`) — minimal: penjelasan blokir Bob B, usulan rencana & review main agent.
   - `meta.json`: `{ title, recordedAt, durationMs, members, repoUrl, sessionsUrl, videoUrl, deckUrl, chapters: [ { atMs, label: "Rencana" | "Live" | "Blokir" | "Review" | "Commit" } ] }` (chapter otomatis dari event pertama tiap jenis, bisa diedit manual).
   - Ukuran target `events.json` < 1,5 MB.

2. **`lib/replay-player.ts`**: kelas `ReplayPlayer(events, meta)` dengan `play()`, `pause()`, `seek(ms)`, `setSpeed(1|2|4|8)`, `onState(cb)`. Seek = `applyEvents(initialState(), events.filter(e => e.t <= ms))` (cukup cepat untuk ribuan event; cache snapshot tiap 50 event bila perlu). Jam simulasi dipakai sebagai `now` untuk ✎ (bukan jam dinding).

### B. Halaman `/demo` (UI-05, P0)

3. **Layout** 3 panel (PRD §7.6): **A** (kiri) — `CoderPanel` | **Mission Control C** (tengah) — komponen fase 09 dalam mode read-only | **B** (kanan) — `CoderPanel`. Di layar sempit: tab A / C / B.
4. **`CoderPanel`**: header anggota berwarna, task aktif & file miliknya, "file yang baru berubah" dengan ✎, gelembung kutipan Bob terbaru (`bob.said`) bergaya chat, notifikasi blokir merah saat `lock.blocked` untuk anggota itu, brief terakhir (disimulasikan dari event keputusan/notify).
5. **Mode read-only MC**: tombol Setujui/Tolak diganti label "disetujui PM pada 21:07" saat `proposal.decided` datang; tidak ada panggilan jaringan apa pun.
6. **`ReplayControls` + `ReplayTimeline`**: play/pause, kecepatan, scrubber dengan penanda chapter, tombol lompat ke chapter; **autoplay** saat halaman dibuka (PRD §7.6 "berjalan otomatis") dengan kecepatan 2×, jeda panjang tanpa event dipadatkan (idle > 5 s → dipotong ke 1 s).
7. **`EventDetailDrawer`**: klik item feed / file / kartu → detail: waktu, aktor, jenis, payload rapi; untuk `file.changed` → `DiffViewer` patch; pemegang kunci saat itu; kutipan Bob terdekat + link ke file di `bob_sessions/` (GitHub).
8. **Header replay**: judul, penjelasan 1 kalimat ("Rekaman sesi nyata 3 PC dengan Bob Radar"), link **Repo**, **bob_sessions**, **Video**, **Deck**, badge "Tanpa login · tanpa API key".
9. **Tanpa server**: `/demo` di-render statis (`export const dynamic = 'force-static'`), data dari `/demo/*.json`. Uji dengan `NEXT_PUBLIC_RADAR_SERVER` kosong dan jaringan offline di DevTools setelah load.

### C. Diff viewer (UI-06, P1 — potong urutan 3 bila mepet)

10. `DiffViewer` (unified, highlight +/- , nomor baris, path header) memakai `diff2html` atau `react-diff-viewer-continued`, dipakai di replay (patch dari event) dan di MC live (`GET /v1/files/history?path=` — endpoint ditambahkan Orang 1 di fase 12 bila belum ada; sementara pakai patch dari event `file.changed` di store). Klik file di pohon → diff terakhir; klik kartu review → diff task (`GET /v1/tasks/:id/diff` dengan token mc).

### D. Tampilan coder ringkas (UI-07, P1)

11. `/coder/[member]`: login dengan token member (bukan mc). Tidak memakai WebSocket; cukup REST polling tiap 2 s ke `GET /v1/tasks`, `GET /v1/brief?kind=start&peek=true` (`peek` = tidak ada efek samping, R3 §2.3) dan `GET /v1/blocks/last`. Isi: task saya, file saya (status kunci), notifikasi terbaru. Halaman kecil, cocok di jendela samping Bob IDE.

### E. Test & deploy

12. Playwright `e2e/demo.spec.ts`: buka `/demo` tanpa env server → autoplay berjalan (jam replay bertambah), dalam ≤ 30 s (8×) muncul kartu blokir & commit; klik item feed → drawer dengan diff; tidak ada request ke domain selain origin sendiri (cek `page.on('request')`).
13. Deploy Vercel; buka dari jendela incognito & ponsel.
14. Commit `fase-11: replay demo, diff viewer, coder view`.

## Verifikasi

```bash
pnpm tsx scripts/export-replay.ts --from packages/web/public/demo/events.live-1.json \
  --quotes docs/bob-quotes.src.json --out packages/web/public/demo/
pnpm --filter @radar/web build
pnpm --filter @radar/web exec playwright test e2e/demo.spec.ts
```

## Kriteria selesai (DoD)

- [ ] UI-05: `/demo` autoplay dari JSON statis, tanpa login & API key, jalan saat server mati (bukti Playwright + uji offline).
- [ ] Tiga panel A / C / B + klik event → diff, pemegang kunci, kutipan Bob, link repo/bob_sessions/video.
- [ ] Tidak ada secret di `public/demo/*.json` (export gagal bila ada).
- [ ] UI-06 dan UI-07 selesai **atau** ditunda dengan alasan tercatat (urutan potong PRD §16).

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Rekaman nyata belum ada / jelek | Pakai `events.sim.json` + kutipan dari uji fase 07/08; ganti setelah rekaman Minggu pagi |
| Seek lambat | Snapshot cache tiap 50 event |
| Juri membuka di ponsel | Layout tab A/C/B |

## Catatan handoff

- Fase 14: URL `/demo` dan video dicantumkan di README juri & deskripsi submission; setelah rekaman final Minggu pagi, jalankan ulang `export-replay.ts`.
