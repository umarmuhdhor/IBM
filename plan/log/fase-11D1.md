# Fase 11D1 — Landing + replay web (fixture), Bob slice I1/I2

**Lane**: Imelda · Web & media. **Branch**: `lane/web`. **Status**: `[~]` — infra selesai, BERHENTI di BOB SLICE I1+I2.

## Checklist langkah (bagian D, fase-11-terminal-dmg-replay.md)

- [x] Langkah 14 — fixture + `export-replay.ts` (lihat "Deviasi" untuk sumber fixture).
- [x] Langkah 15 — `src/lib/replay-player.ts` (play/pause/seek/speed, snapshot per 10 detik waktu event).
- [x] Langkah 16 — `/demo` tiga kolom + counter + panel Bob inside → **BOB SLICE I1 selesai** (bukti `bob_sessions/uaai_imelda_task01_replay_player_demo_summary.png`, 4.30 Bobcoin).
- [ ] Langkah 17 — static export tanpa network call luar + `e2e/demo.spec.ts` → spec ditulis, build statis hijau, dicek manual di browser bawaan (1440+390). Playwright otomatis BELUM dijalankan (lihat LANGKAH MANUAL).
- [ ] Langkah 18 — landing warm paper → **BOB SLICE I2** (menunggu).
- [ ] Langkah 19 — deploy Cloudflare Pages → LANGKAH MANUAL (butuh akun, TODO B2).
- [ ] Langkah 19b — Bob slice I3 (Long Description) → ditunda ke sub-fase 11D2 sesuai jadwal.
- [x] Bob slice C4 (`--md` + `evidence-check.ts`) — bukan tanggung jawab lane ini (App/Aarief), tidak disentuh.

## File dibuat/diubah

- `radar/packages/web/src/replay/{sanitize,metrics,chapters,meta}.ts` + `*.test.ts` — logika murni, test-first.
- `radar/packages/web/src/lib/replay-player.ts` + `.test.ts` — snapshot/seek/player, test-first (termasuk fake-timer test untuk play/pause).
- `radar/packages/web/scripts/export-replay.ts` + `.test.ts` — CLI: fixture atau `RADAR_EXPORT_URL` → sanitasi → `public/demo/{events,meta,bob-quotes}.json`.
- `radar/packages/web/fixtures/replay/export.json` — 62 event (lihat Deviasi D-imelda-01).
- `radar/packages/web/public/demo/{events.json,meta.json,bob-quotes.json}` — hasil generate nyata (bukan ditulis tangan), sudah di-commit supaya `/demo` punya data tanpa build step tambahan.
- `radar/packages/web/{vitest.config.ts,playwright.config.ts,e2e/demo.spec.ts}` — konfigurasi test.
- `radar/packages/web/package.json` — tambah devDependency test (`@playwright/test`, `@testing-library/*`, `jsdom`, `tsx`) + script `export:replay`/`e2e`.
- `radar/packages/web/tsconfig.json` — tambah `scripts/**`, `e2e/**` ke `include` (temuan HIGH review, lihat di bawah).
- `radar/pnpm-lock.yaml` — hasil `pnpm install` untuk dependency di atas.
- `plan/PROGRESS.md`, `plan/log/DECISIONS.md` (D-imelda-01..06) — baris/entri lane ini saja.
- **Belum diubah** (menunggu Bob slice): `app/page.tsx`, `app/demo/page.tsx` (masih placeholder fase 00).

## Hasil verifikasi

```
pnpm -C radar --filter @radar/web test        → 7 file, 30 test, hijau
pnpm -C radar --filter @radar/web exec tsc --noEmit   → bersih
pnpm -C radar exec eslint packages/web/src packages/web/scripts   → bersih
pnpm -C radar test   (seluruh workspace)      → semua paket hijau (termasuk common/ui/scripts existing)
pnpm -C radar typecheck (seluruh workspace)   → bersih
pnpm -C radar --filter @radar/web run export:replay   → 62 event, 5 chapter tertulis ke public/demo/
```

`meta.json` yang dihasilkan: `nearMisses: 1`, `decisions: 2`, `mergeConflicts: 0`, `medianDecisionSeconds: 2.9`, chapter `[plan, live, review, near-miss, commit]` — semua dihitung dari event, bukan diketik (DoD UI-05 sebagian).

`pnpm -C radar --filter @radar/web e2e` **BELUM dijalankan** — lihat LANGKAH MANUAL.

## Review (langkah 8, paralel: code-reviewer + typescript-reviewer + security-reviewer)

Semua CRITICAL/HIGH diperbaiki:

| # | Reviewer | Severity | Temuan | Perbaikan |
|---|---|---|---|---|
| 1 | typescript-reviewer | HIGH | `scripts/**`/`e2e/**` tidak ikut `tsc --noEmit` (tsconfig `include`) maupun rule type-aware eslint (`eslint.config.js` `files` glob tidak mencakup `packages/*/scripts`) | tsconfig `include` diperbaiki. `eslint.config.js` **tidak bisa diedit** — hook `config-protection` (ecc) memblokir semua edit ke file itu tanpa kecuali, walau perubahannya cuma menambah cakupan (bukan melemahkan aturan). Dicatat sebagai gap tersisa di bawah. |
| 2 | typescript-reviewer | MEDIUM | `chapters.ts` cast `(ev.payload as { kind?: string })` melemahkan union literal `ProposalKind` yang sudah tepat dari narrowing | Cast dihapus, akses langsung `ev.payload.kind` |
| 3 | code-reviewer | MEDIUM | `metrics.ts`: `request.decided` kedua untuk `requestId` sama menghitung latensi ganda dari `createdTs` basi | `requestCreatedAt.delete(id)` setelah dipakai; test baru ditambah |
| 4 | code-reviewer + security-reviewer | MEDIUM | `sanitize.ts` pola `/sk-/` false-positive di identifier biasa (`desk-1`, `risk-model.ts`) | Pola diperketat `/sk-[a-zA-Z0-9]{16,}/`; test false-positive baru + test lama disesuaikan |
| 5 | code-reviewer | LOW | Komentar `replay-player.ts` mengklaim O(intervalMs) padahal implementasi scan penuh | Diperbaiki sungguhan: `Snapshot.eventIndex` disimpan, `stateAtOffset` mulai dari situ (bukan cuma ganti komentar) |
| 6 | code-reviewer | LOW | `stateAtOffset` bisa crash kalau dipanggil dengan `snapshots: []` | Guard eksplisit + pesan error |
| 7 | security-reviewer | MEDIUM (info) | Sensor 3-pola tidak menutup bentuk AWS key / JWT | Dicatat, TIDAK diperluas (di luar scope fase ini; scan manual mengonfirmasi tidak ada kredensial nyata di fixture/output) |

Security-reviewer juga mengonfirmasi manual: tidak ada kredensial nyata di `fixtures/replay/export.json` maupun `public/demo/*.json`, tidak ada nama file terlarang (R5 §8), `RADAR_EXPORT_TOKEN` tidak pernah ter-log/tertulis ke file, tidak ada path traversal (semua path tetap, bukan dari input).

## Deviasi (lihat `plan/log/DECISIONS.md`)

- **D-imelda-01**: fixture diambil dari `radar/scripts/mock-scenarios/demo.json` (skenario Alief, hanya dibaca) via capture `GET /v1/events/export`, di-*re-timestamp* dari `delayMs` kumulatifnya sendiri, ditambah satu `commit.created` sintetis di akhir untuk chapter "Commit". **TODO(sync:alief)**: ganti dengan `GET /v1/events/export` server asli setelah fase 05/06, dan dengan rekaman nyata setelah milestone fase 10 (di 11D2).
- **D-imelda-02**: `bob-quotes.src.json` tidak ada; dipakai `radar/bob-kit/prompts/bob-quotes.json` apa adanya.
- **D-imelda-03**: definisi 4 counter (near-miss/decisions/merge-conflicts/median) dipilih dari katalog event R3 §5 karena DESIGN §5.8 tidak memberi rumus persis.
- **D-imelda-04**: snapshot 10 detik = waktu event (`ev.ts` offset), bukan waktu putar.
- **D-imelda-05**: skrip & fixture ditaruh di `radar/packages/web/{scripts,fixtures}` (bukan `radar/scripts/`, folder Lane Core).
- **D-imelda-06**: Bob slice I1/I2 belum dikerjakan — lihat bagian Bob slice di bawah.

## Bob slice yang dikerjakan

**I1 (pemutar replay + `/demo` + `/gallery`) — SELESAI.** Bob IDE (mode `coder`, task 01) menghasilkan `app/demo/page.tsx` (rewrite penuh), `app/gallery/page.tsx` (baru), `src/demo-helpers.test.ts` (16 test baru), dan menambah satu baris `@import` di `app/globals.css`. Diff dibaca penuh dan direview manual (bukan cuma dipercaya): 3 perbaikan diterapkan di atas hasil Bob (path import CSS salah, `/gallery` butuh `'use client'`, grid 3 kolom tidak responsif di 390px) — semuanya BUG NYATA yang baru ketahuan setelah `next build` sungguhan + cek visual manual di browser bawaan, bukan asumsi. Setelah perbaikan: 46 test hijau, `tsc --noEmit` bersih, `next build` + static export bersih, dicek visual 1440px dan 390px (autoplay jalan, klik chapter "Near-miss" lompat benar, klik baris aktivitas mengisi panel "Bob inside" dengan kutipan `bob_after_block` yang benar, layout mobile stack rapi setelah fix). Commit terpisah `2058da47` dengan trailer `Bob-Assisted`. Bukti: `bob_sessions/uaai_imelda_task01_replay_player_demo_summary.png` (4.30 Bobcoin, dari screenshot manual Cmd+Shift+4 — `bob-evidence.sh` gagal 3× karena Terminal sesi ini tidak punya akses Screen Recording macOS, baik mode window-detect maupun `--interactive`; lihat LANGKAH MANUAL).

**I2 (landing warm paper) — menunggu.** Prompt sudah diberikan ke user di chat, belum dijalankan di Bob IDE.

## LANGKAH MANUAL

1. ~~**Bob IDE**: jalankan BOB SLICE I1~~ — **selesai** (lihat di atas).
2. **Bob IDE**: jalankan BOB SLICE I2 (landing warm paper), lalu balas "bob selesai". **Bukti**: langsung screenshot manual Cmd+Shift+4 dari panel ringkasan task Bob IDE, kirim PNG-nya ke chat — jangan buang waktu coba `bob-evidence.sh` dulu, sudah terbukti gagal (lihat poin 3).
3. **`bob-evidence.sh` gagal 3× di sesi ini**: (a) mode window-detect otomatis → "IBM Bob IDE window not found" (sesi Claude Code ini tidak punya akses layar asli, walau IBM Bob beneran kebuka di layar manusia); (b) `--interactive` drag manual → file 0 byte ("screenshot is empty") dua kali (kemungkinan drag/klik terlalu cepat di trackpad); (c) `--interactive` setelah user diminta cek izin → "could not create image from rect" (Terminal belum/tidak bisa dikasih izin **Screen Recording** di macOS System Settings). Solusi yang akhirnya jalan: screenshot manual **Cmd+Shift+4** (tidak lewat Terminal sama sekali, tidak butuh izin tambahan), user kirim PNG-nya ke chat, Claude Code convert (kalau perlu, mis. dari `.webp`) dan salin ke `bob_sessions/` + tulis baris index manual mengikuti format persis yang dibaca dari `scripts/bob-evidence.sh` (nama tim `uaai` dari `plan/team.json`, pola `<team>_<nama>_task<NN>_<slug>_summary.png`). **Pakai cara ini langsung untuk I2/I3, jangan coba `bob-evidence.sh` lagi di sesi non-interaktif ini.** Kalau nanti dijalankan dari sesi Claude Code yang punya akses layar asli (mis. terminal interaktif manusia sendiri, bukan agent), coba lagi dari awal (window-detect otomatis kemungkinan besar akan berhasil).
4. **Playwright browser install**: sandbox sesi ini punya bandwidth sangat terbatas (~41 KiB/s terukur saat `pnpm install` awal); mengunduh Chromium (~300 MB) tidak realistis sekarang. Sebelum menjalankan `pnpm -C radar/packages/web e2e`, jalankan manual: `pnpm -C radar/packages/web exec playwright install chromium`.
5. **Deploy Cloudflare Pages** (langkah 19): perlu `TODO B2` (`plan/TODO.md`) — nama akun/subdomain `*.workers.dev` dan `wrangler login` di mesin ini. Setelah tersedia: `pnpm -C radar --filter "@radar/web..." build && pnpm -C radar deploy:web`.
6. **`eslint.config.js` coverage gap**: hook `config-protection` (plugin ecc) memblokir SEMUA edit ke file itu di sesi ini, termasuk penambahan glob yang murni menambah cakupan (`packages/*/scripts/**`, `packages/*/e2e/**`). Kalau ada manusia dengan akses penuh, tambahkan baris itu ke array `files` di blok `tseslint.config` kedua (baris 24-29 saat ini) supaya `scripts/export-replay.ts` dan `e2e/demo.spec.ts` ikut kena rule type-aware (`no-floating-promises`, `consistent-type-imports`). `tsc --noEmit` sudah mencakup keduanya (diperbaiki di fase ini).

## Catatan handoff

- Setelah Bob slice I1/I2 selesai: jalankan gerbang UI (screenshot 1440+390 lewat browser bawaan Claude Code atau Playwright, skill `better-interface`, isi tabel temuan di log ini), lalu langkah 9 verifikasi penuh (`e2e/demo.spec.ts`), commit, snapshot `snap/web-f11D1`, PR ke `main`.
- Fase berikutnya untuk lane ini setelah PR fase 11D1 di-merge: **10** (integrasi E2E, interupsi wajib Sab 21:00 WITA) — tapi fase 03/04/05/06 (Core) dan 11a (App) belum `[x]` di PROGRESS.md, jadi fase 10 kemungkinan besar juga akan berhenti menunggu lane lain; cek ulang `plan/PROGRESS.md` sebelum memulai.
- `@radar/ui` (fase 09, Aarief) SUDAH selesai dan berisi 10 komponen siap pakai (`AgentTag`, `MemberChip`, `LockChip`, `WritingPulse`, `BobTrace`, `DecisionCard`, `TaskCard`, `FeedItem`, `ReviewCard`, `BriefMeter`, `PresenceStack`) — prompt BOB SLICE I1 di bawah mengarahkan pemakaian komponen ini alih-alih membuat duplikat lokal (beda dari asumsi awal rencana).
