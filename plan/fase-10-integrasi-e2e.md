# Fase 10 — Integrasi end-to-end & milestone Sabtu 23:00

| Field | Nilai |
|---|---|
| Jalur | Semua, di **`main`** setelah PR ketiga lane di-merge (Sab 21:00). Dipimpin Lane B (simulator & Bob). Lane C memegang app di 3 Mac. Lane A memegang server. |
| Slot WITA | Sab 26 Sep 21:00 – Min 27 Sep 02:00 · **Milestone Sab 23:00** |
| Estimasi | 3–4 jam |
| Prasyarat | 04, 05, 07, 08, 09. Fase 06 hanya dibutuhkan untuk langkah review/commit (sim langkah 6–7, 3 PC langkah 7) |
| Requirement PRD | Semua P0; metrik §04; alur §07.1 |
| Model | **Opus 5.5** · effort high, `xhigh` saat mengejar bug race |
| Fase berikutnya | 11 (Orang 3), 12 (Orang 1), 13 (Orang 2) — solo: **11** |

> **Catatan jadwal.** Milestone Sab 23:00 (PRD §17) hanya menuntut **rencana → live → blokir → keputusan**. Kalau fase 06 belum selesai, jalankan sim dengan `--until decision` dan 3 PC sampai langkah 6, lalu ulangi bagian review/commit setelah fase 06 selesai (≈ Min 01:00).

## Tujuan

Membuktikan alur penuh PRD berjalan: **rencana → live → blokir → keputusan → review → commit GitHub** — pertama secara otomatis tanpa Bob (simulator 3 PC, bisa diulang dan diukur), lalu secara nyata di 3 PC dengan Bob mengikuti naskah demo PRD §15. Hasilnya juga menjadi data awal replay.

## Bacaan wajib

- PRD §04 metrik, §07.1, §15 naskah demo, §18 risiko
- `plan/PROGRESS.md` (status P0), log fase 03–09 (catatan handoff)
- `docs/DEMO_SCRIPT.md`

## Output

- `scripts/sim-3pc.ts` (+ `scripts/sim/scenario-demo.ts`)
- `docs/E2E_REPORT.md` (hasil sim + hasil 3 PC + daftar bug & perbaikan)
- `packages/web/public/demo/events.sim.json` (export dari run sim terbaik)
- Perbaikan bug di paket mana pun (dengan test regresi)

## Langkah kerja

1. **Simulator `scripts/sim-3pc.ts`** — tanpa Bob, satu proses:
   - Opsi `--server local|<url>`; `local` = `buildApp` in-process dengan `DATA_DIR` tmp + repo toko-demo (bare remote lokal, `GIT_PUSH=true` ke bare).
   - Buat 3 `SyncAgent` (A, B di folder tmp; C folder tmp read-only).
   - "Bob palsu" = fungsi yang meniru Bob: sebelum menulis, menjalankan **bundle hook nyata** `bob-kit/coder/.bob/hooks/lock_guard.js` dengan stdin payload bentuk IDE; kalau exit 0 → menulis file ke folder (sync agent mengirim); kalau exit 2 → memanggil tool `why_blocked` lewat radar-mcp (Client stdio ke `bob-kit/coder/.bob/radar-mcp.js`).
   - "Main agent palsu" = memanggil tool PM radar-mcp (`propose_plan`, `list_requests`, `propose_decision`, `get_task_diff`, `propose_review`) dengan payload skenario.
   - "PM manusia" = `POST /v1/proposals/:id/decision` dengan token mc.
   - Skenario `demo` (mengikuti PRD §15):
     1. Rencana: T-1 Kupon (A: checkout.ts, coupon.ts; antre routes.ts), T-2 Dark mode (B: theme.css, Header.tsx) → approve.
     2. Live: A menulis checkout.ts 5×, B menulis theme.css 5× berselang; verifikasi isi identik di A, B, C setelah tiap tulis.
     3. Blokir: B mencoba checkout.ts → exit 2 → why_blocked → B menulis Header.tsx (bagian lain).
     4. Lapis kedua (edit manual, PRD §7.5): B menulis langsung ke `coupon.ts` milik A **tanpa** hook → `file.rejected`, isi B dipulihkan, `coupon.ts.radar-rejected` ada, isi A & C tidak berubah.
     5. Keputusan: main agent `antre` → auto-applied; brief prompt B memuat keputusan.
     6. Review: A mengubah signature `calculateTotal(items, shipping)` + submit; main agent `get_task_diff` → harus melihat importer Header.tsx → `propose_review setujui_beri_tahu` + notify B → approve.
     7. Commit: bare remote punya commit author Alice + trailer, hanya file T-1; kunci checkout.ts pindah ke B (`dipesan`); brief prompt B memuat notifikasi `calculateTotal`.
     8. PM mencoba decision dengan token member C → 403.
   - Setiap langkah = assertion; gagal → exit 1 dengan pesan langkah. Opsi `--until plan|live|block|decision|review` menghentikan skenario lebih awal (dipakai saat fase 06 belum selesai).
   - Setelah selesai: hitung & cetak metrik PRD §04 dari event log dan metric table: p95 sinkron (`sync_apply_ms`/bench), p95 cek kunci, dua penulis bersamaan (audit: untuk setiap `file.changed`, `by` harus = pemegang kunci pada saat itu → harus 0 pelanggaran), blokir→keputusan, `review.flagged` ≥ 1.
   - Export event → `packages/web/public/demo/events.sim.json`.

2. **Jalankan sim lokal sampai hijau 3× berturut-turut** (deteksi flakiness). Setiap bug: tulis test regresi di paket terkait, perbaiki, catat di `docs/E2E_REPORT.md` (gejala, akar masalah, perbaikan, test).

3. **Jalankan sim ke server deploy** (`--server https://…`) — memastikan CORS, WSS, latensi internet, push GitHub asli ke repo cadangan `toko-demo-sim` (jangan mengotori `toko-demo` utama; atau reset setelahnya).

4. **Milestone Sab 23:00 — 3 PC nyata (LANGKAH MANUAL, tulis checklist ini di log)**:
   Persiapan:
   1. Reset server: `radar-server reset --confirm && radar-server init …` (repo toko-demo bersih), bagikan token baru.
   2. PC A & B: clone kosong folder kerja → `radar join <server> --workspace toko-demo --as A|B --token … --kit coder`; buka folder di Bob IDE, mode "Radar Coder".
   3. PC C: `radar join … --as C --kit pm`; Bob IDE mode "Radar PM Lead"; browser Mission Control login token mc.
   Jalankan naskah PRD §15 (tanpa merekam dulu):
   4. C: prompt `pm-rencana.md` tujuan "Tambah fitur kupon dan dark mode" → kartu rencana → Setujui → kunci berwarna muncul.
   5. A: "Kerjakan task aktifmu: kupon diskon di checkout." · B: "Kerjakan task aktifmu: dark mode." → amati file berubah sendiri di PC lain & ✎ di MC.
   6. B: "Tampilkan total dengan diskon kupon di checkout.ts juga" → blokir → Bob B menjelaskan & pindah ke Header.tsx → kartu permintaan → C: `pm-rebutan.md` → usulan antre → (auto/klik) Setujui.
   7. A: "Ubah calculateTotal agar menerima ongkos kirim, lalu ajukan task." → C: `pm-review.md` → usulan setujui+beri tahu B → Setujui → commit muncul di GitHub (A + co-author IBM Bob), kunci checkout.ts pindah ke B.
   8. Catat waktu tiap adegan vs target naskah, Bobcoin per PC, dan semua keanehan.
   9. Ekspor event (`radar-server export`) → `packages/web/public/demo/events.live-1.json`; ekspor sesi Bob ketiga PC ke `bob_sessions/`.

5. **Triase** hasil 3 PC: bug P0 (merusak alur demo) diperbaiki malam ini; sisanya → fase 12. Tandai milestone di PROGRESS (tercapai / tercapai sebagian + apa yang kurang).

6. **Latihan kedua** setelah perbaikan (sebelum tidur bergilir) untuk memastikan stabil; ukur ulang metrik.

7. Commit `fase-10: e2e simulator, fixes, milestone run`.

## Tambahan v0.3 — uji di 3 Mac dengan app

1. Ketiga Mac memakai **app Live Collab** (build `pnpm -C app dev` atau `.app` dari spike 8). A: Bob IDE + app (panel Team). B: Bob Shell di terminal app. C: Mission Control + Bob `pm-lead`.
2. Tambahkan ke milestone Sab 23:00: B menonton terminal Bob A (JT-01/02) dan latensi p95 tercatat.
3. `scripts/sim-3pc.ts` ditambah langkah `term.share` + 1 penonton (tanpa Bob, frame sintetis).
4. Rekam semua sesi uji dengan `RECORD_TERMINALS=true` sebagai bahan replay cadangan.

## Verifikasi

```bash
pnpm test                                  # seluruh monorepo hijau
pnpm sim -- --server local --runs 3        # 3× hijau berturut-turut
pnpm sim -- --server https://<app>.fly.dev --repo-suffix -sim
```

## Kriteria selesai (DoD)

- [ ] Sim lokal hijau 3× berturut-turut; sim ke server deploy hijau.
- [ ] Metrik sim: p95 cek kunci < 300 ms, dua penulis bersamaan = 0, `review.flagged` ≥ 1, blokir→keputusan tercatat.
- [ ] Alur naskah §15 berjalan di 3 PC nyata minimal sekali (milestone), dengan catatan waktu.
- [ ] Semua P0 di tabel PROGRESS punya bukti.
- [ ] `events.sim.json` & `events.live-1.json` tersedia untuk replay.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Bob berperilaku tidak konsisten saat live | Rapikan prompt demo (`bob-kit/prompts`) jadi kalimat persis; latihan ulang |
| Jaringan hackathon lambat | Server di region terdekat (Singapura `sin`), atau jalankan server di laptop C + tunnel (`cloudflared`) sebagai cadangan |
| Bug race sulit | Replay urutan event dari export ke test (`applyEvents` + query DB), eskalasi Opus effort xhigh |

## Catatan handoff

- Fase 11: gunakan `events.live-*.json` terbaik sebagai dasar replay, `events.sim.json` sebagai cadangan.
- Fase 12: daftar bug non-P0 dari `docs/E2E_REPORT.md`.
- Fase 13: simulator ini menjadi dasar putaran B eksperimen (versi otomatis) di samping putaran nyata.
