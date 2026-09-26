# Log fase 10 — Integrasi E2E, bagian Lane Alief · Core

> File ini = bagian Core. Bagian Bob = `fase-10-bob.md` (D-umar-04, supaya PR tiap lane tidak bentrok).
> Baris PROGRESS fase 10 milik bersama ("Semua") — TIDAK diubah di PR ini (PR lane Bob #17 masih terbuka).

- **Status:** [~] sim lokal + fix selesai dan hijau; sisa: sim ke server deploy + milestone 4 Mac (LANGKAH MANUAL, Sab 21:00–23:00).
- **Mulai:** Sab 26 Sep 2026 ~18:30 WITA · branch `lane/core-f10-wip` (worktree terpisah; `lane/core` dipakai worktree lain berisi D-alief-06 yang belum di-commit — file itu tidak disentuh).
- **Model:** Muse Spark (OpenCode). Deviasi dari R6 §2 (Opus 5.5): dicatat di bawah. Eskalasi R6 §3 = minta user lanjutkan di Claude Code Opus bila verifikasi gagal 2× (tidak terjadi).
- **Pra-cek:** D-007 = 7 hit di `origin/main` [x]; working tree bersih [x]; B1–B5 [x] (deploy boleh, sebagai manual); D1–D3 [ ] (bagian milestone = manual); C1–C4 tercakup <fakta-D-007>; `TODO(sync` = kosong [x].

## Ringkasan rencana (≤ 15 baris)

1. Fix `GET /v1/tasks?owner=me` = pemanggil (usulan D-umar-04, R3 §7 vs §2.4): test merah → fix 2 baris → hijau.
2. `sim-3pc`: skenario PRD §15 tanpa Bob — 3 SyncAgent asli (A/B/C) + bundle hook nyata (`lock_guard` exit 2/0) + WS mentah untuk layer-2 (`file.rejected`) + REST untuk plan/decision/review/commit (mc).
3. Metrik: p95 `locks/check` (< 300 ms), audit dua-penulis (= 0), `review.flagged` ≥ 1, blokir→keputusan; export → `packages/web/public/demo/events.sim.json` (jaminan spec fase 10).
4. `--until plan|live|block|decision|review`, `--runs N`, `--server local|<url>`; remote butuh `--allow-remote-wipe` + env token (tidak pernah argv).
5. TDD: test owner=me merah dulu; smoke `sim-3pc.test.ts` = full story lokal (writes=1).
6. Review 4 subagent (pengganti ECC, plugin tidak ada di OpenCode): semua CHANGES REQUESTED → HIGH diperbaiki, MEDIUM dicatat.
7. Verifikasi: `pnpm test` monorepo hijau + sim `--runs 3` hijau. Produksi TIDAK disentuh (head tetap `c0576499`, T-2 terbuka kosong).

## Checklist langkah fase 10 (bagian Core)

- [x] Placeholder: `grep -rn "TODO(sync" app radar` kosong.
- [x] Sim lokal hijau 3× berturut-turut (`--runs 3`, writes=5).
- [x] Metrik: p95 cek kunci 7 ms (< 300), dua penulis 0, `review.flagged` 1, blokir→keputusan ~480 ms.
- [x] `events.sim.json` (87 event, 27 KB, ts dinormalkan FIXTURE_T0) untuk replay Imelda.
- [ ] Sim ke server deploy hijau (LANGKAH MANUAL 1: butuh workspace scratch + repo cadangan, jangan toko-demo utama).
- [ ] Milestone 4 Mac Sab 23:00 (LANGKAH MANUAL 2–9, dipimpin Umar; checklist di `fase-10-bob.md`).
- [x] Perbaikan bug: `owner=me` (D-umar-04).

## File dibuat/diubah

- `radar/packages/sync/scripts/sim-3pc.ts` (baru): runner. NB: tinggal di `packages/sync/scripts/` (bukan `radar/scripts/`) karena symlink `wrangler` di `radar/node_modules` rusak di pnpm 12 — preseden D-alief-04 poin 9 (bench-sync). Wrapper tipis tetap di `radar/scripts/sim-3pc.ts` (jalur sesuai spec).
- `radar/scripts/sim/scenario-demo.ts` (baru): seed, PLAN_BODY, metrik, normalisasi export.
- `radar/scripts/sim-3pc.ts` (baru): wrapper re-export (jalur spec + `pnpm sim`).
- `radar/scripts/sim-3pc.test.ts` (baru): full story lokal writes=1 (~2 s).
- `radar/package.json`: `sim` = build sync + `tsx scripts/sim-3pc.ts` (cermin `bench:sync`).
- `radar/packages/server/src/http/routes/tasks.ts`: `owner=me` → ID pemanggil.
- `radar/packages/server/test/engine.test.ts`: test `owner=me`.
- `radar/packages/web/public/demo/events.sim.json` (baru, 87 event): milik folder lane Web tapi diamanatkan Output fase 10; hanya data sintetis.
- `plan/log/DECISIONS.md`: entri D-alief-07.

## Hasil verifikasi

| Perintah | Hasil |
|---|---|
| `pnpm test` (monorepo: common, server 139, hooks, mcp, sync, ui, web, scripts 27) | semua hijau |
| `tsx packages/sync/scripts/sim-3pc.ts -- --server local --runs 3` | 3× hijau: p95 check 7 ms, dual-writer 0, flagged 1, block→decision ~480 ms, sync p95 ~200 ms |
| `tsc -p scripts/tsconfig.json`, `pnpm --filter @radar/sync typecheck`, `@radar/server typecheck` | bersih |
| `eslint` 7 file fase | bersih |
| `grep -rn "TODO(sync" app radar` | kosong |
| `grep -c rdr_ <log>` | 0 (token tidak pernah di log; SIM_DEBUG hanya method/path/panjang body; `fail()` menyensor `rdr_*`) |

## DoD fase 10 (bagian Core)

- [x] Sim lokal hijau 3× berturut-turut.
- [x] Metrik sim: p95 cek kunci < 300 ms, dua penulis = 0, `review.flagged` ≥ 1, blokir→keputusan tercatat.
- [ ] Sim ke server deploy hijau → MANUAL (jendela 21:00+, workspace scratch).
- [ ] Alur §15 di 4 PC nyata → MANUAL (milestone 23:00, Umar memimpin).
- [~] Semua P0 punya bukti: SV-02..06 [x] (fase 05), SV-07 [x] (fase 06 `c0576499`), MA-01..05/07 [x] (lane Bob #17 + sim review/commit lokal); UI-09/EV/IN menunggu lane lain.
- [x] `events.sim.json` tersedia untuk replay (cadangan; utama = `events.live-1.json` dari milestone).

## Review (pengganti ECC — plugin tidak ada di OpenCode)

| Reviewer | Verdict awal | HIGH diperbaiki |
|---|---|---|
| code | CHANGES REQUESTED | remote butuh `--allow-remote-wipe` + warning http://; layer-2 kini assert versi + disk A/C tidak berubah |
| typescript | CHANGES REQUESTED | `needStr/needLines/needCursor` (gagal keras, bukan TypeError); `Number()` finite (exit 2, bukan hijau palsu) |
| security | CHANGES REQUESTED (CRITICAL nihil) | `--allow-remote-wipe`; warning http://; `fail()` sensor `rdr_*` |
| silent-failure | CHANGES REQUESTED | exit 2 untuk input tak valid; status HTTP diassert di semua GET/decision (bukan hanya body); cursor wajib number |

MEDIUM yang dicatat (tidak dikerjakan, untuk fase 12): esbuild service `bundleHooks()` tidak di-stop antar `--runs`; `bFiles[0]` asumsi urutan (cari T-2 eksplisit); assert diff masih `includes('Header.tsx')`; smoke menambah ~2 s ke suite scripts; `JSON.parse` tanpa skema; `percentile([])` = NaN → `null` di JSON (di-skip bila count 0); `.radar/local.json` 0644 di helper TEST lane Bob (handoff Umar, mitigasi: tmpdir 0700 + cleanup `finally`); `Promise.allSettled(stop)` tak diinspeksi; path asing di-skip audit dual-writer.

## Temuan teknis (untuk fase 12 / arsip)

1. **`return promise` + `finally` berpacu dengan `harness.close()`** (akar 1 jam debug ECONNRESET): `return finish()` di dalam `try` membiarkan `finally` menutup harness saat export masih in-flight. Wajib `return await finish()`. Diberi komentar di kode.
2. **`GET /v1/tasks?owner=me` 403** (D-umar-04): diperbaiki — `me` = pemanggil.
3. **Raw WS kedua untuk member yang sama me-`replace` socket agent** (R3 §3, `WS_CLOSE_REPLACED`): layer-2 sim memicu reconnect B (~50–200 ms, aman karena langkah berikut REST). Bukan bug.
4. **Hook `lock_guard` exit 2 untuk B→checkout.ts** menyebut file + "Andi" (stderr sampai ke sim, selaras D-umar-01 poin 2).

## Deviasi (kontrak tidak berubah)

- Model runner Muse Spark, bukan Opus 5.5 (R6 §2). Skill ECC (`tdd-workflow`, `verification-loop`, `e2e-testing`) dan agent `ecc:*` tidak ada di OpenCode → TDD manual, subagent `general` sebagai reviewer. Dicatat di D-alief-07.
- Runner di `packages/sync/scripts/` + wrapper (preseden D-alief-04; lihat "File" di atas).
- `events.sim.json` ditulis ke folder lane Web (amanat Output fase 10).
- PROGRESS baris fase 10 tidak diubah (milik bersama, PR #17 terbuka).
- Authorship: D-alief-06 (author `aliefauzan`, tanpa trailer asisten di sesi OpenCode) — entri ada di worktree `lane/core` lain, belum di `main`; commit ini mengikutinya (author `aliefauzan`, tanpa trailer).

## LANGKAH MANUAL (jendela Sab 21:00+, butuh manusia)

1. **Sim ke deploy** (Alief): siapkan workspace scratch (repo cadangan `toko-demo-sim`, JANGAN toko-demo utama — atau reset setelahnya), `RADAR_TOKEN_*` + `RADAR_ADMIN_SECRET` dari password manager, lalu:
   `pnpm -C radar sim -- --server https://live-collab.afindo-mi01.workers.dev --allow-remote-wipe --runs 1` (memakai `admin init --force` di workspace `sim-3pc`). Target latensi internet, bukan p95 lokal.
2. **Reset produksi untuk milestone** (Alief, 21:00): `pnpm -C radar admin reset --confirm && admin init …` (member A, B, C, D) — membersihkan T-2 terbuka kosong peninggalan fase 06. Bagikan token lewat kanal privat.
3. **Milestone 4 Mac** (Umar memimpin): checklist lengkap di `plan/log/fase-10-bob.md` LANGKAH MANUAL.
4. Konfirmasi `BOB_COAUTHOR` (TODO B6) sebelum submit; `ADMIN_SECRET`/token produksi tetap di Keychain/password manager, tidak di chat.

## Catatan handoff

- **Imelda (11D2):** `packages/web/public/demo/events.sim.json` = replay cadangan (87 event, patch inline per `file.changed`, ts ternormalkan). Utama tetap `events.live-1.json` dari milestone.
- **Umar:** `owner=me` sudah diterima server (tutup D-umar-04 P1); `.radar/local.json` 0644 di `packages/hooks/test/helpers.ts` (MEDIUM di atas); test waktu hooks rentan beban (catatan fase-10-bob).
- **Fase 12 (Alief):** daftar MEDIUM di atas + P1 `term.*`/`ai-edits` + rate limit admin/WS (D-alief-03).
