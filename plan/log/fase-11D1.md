# Fase 11D1 — Landing + replay web (fixture), Bob slice I1/I2

**Lane**: Imelda · Web & media. **Branch**: `lane/web`. **Status**: `[~]` — kode + e2e selesai. BERHENTI di LANGKAH MANUAL: deploy Cloudflare Pages (TODO B2) dan squash-merge PR #14 (`gh` tidak login di sesi ini).

## Checklist langkah (bagian D, fase-11-terminal-dmg-replay.md)

- [x] Langkah 14 — fixture + `export-replay.ts` (lihat "Deviasi" untuk sumber fixture).
- [x] Langkah 15 — `src/lib/replay-player.ts` (play/pause/seek/speed, snapshot per 10 detik waktu event).
- [x] Langkah 16 — `/demo` tiga kolom + counter + panel Bob inside → **BOB SLICE I1 selesai** (bukti `bob_sessions/uaai_imelda_task01_replay_player_demo_summary.png`, 4.30 Bobcoin).
- [x] Langkah 17 — static export tanpa network call luar + `e2e/demo.spec.ts` → 12/12 hijau (desktop-1440 + mobile-390) terhadap `out/` via `python3 -m http.server`. `trailingSlash: true` (D-imelda-08) supaya `/demo/` = halaman, bukan listing JSON.
- [x] Langkah 18 — landing warm paper → **BOB SLICE I2 selesai** (bukti `bob_sessions/uaai_imelda_task02_landing_warm_paper_summary.png`, 0.873 Bobcoin).
- [ ] Langkah 19 — deploy Cloudflare Pages → LANGKAH MANUAL (butuh akun, TODO B2). Kode SIAP deploy (build + static export sudah dites hijau).
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
pnpm -C radar --filter @radar/web test                → 8 file, 46 test, hijau (30 infra + 16 Bob slice I1)
pnpm -C radar --filter @radar/web exec tsc --noEmit    → bersih (setelah I1 dan setelah I2)
pnpm -C radar exec eslint packages/web/app packages/web/src packages/web/scripts   → bersih
pnpm -C radar test   (seluruh workspace)               → semua paket hijau
pnpm -C radar typecheck (seluruh workspace)            → bersih
pnpm -C radar --filter @radar/web run export:replay    → 62 event, 5 chapter tertulis ke public/demo/
pnpm -C radar --filter "@radar/web..." build           → next build + static export bersih (dijalankan 2×, setelah I1 dan setelah I2)
```

`meta.json` yang dihasilkan: `nearMisses: 1`, `decisions: 2`, `mergeConflicts: 0`, `medianDecisionSeconds: 2.9`, chapter `[plan, live, review, near-miss, commit]` — semua dihitung dari event, bukan diketik (DoD UI-05).

Cek visual manual (browser bawaan Claude Code, bukan Playwright): `/demo`, `/gallery`, `/` di lebar 1440 dan 390 — semua jalan, termasuk autoplay, seek per-chapter, panel Bob inside, dan mobile stacking (setelah fix).

`pnpm -C radar --filter @radar/web e2e` → **12 passed (3.6s)** pada 26 Sep 15:26 WITA (Node 24). Termasuk: autoplay, near-miss, Bob inside, nol origin luar, reduced-motion pause, smoke `/` + `/gallery`.

## Sesi LANJUT 26 Sep 15:11 (pra-cek → e2e)

Rencana [planner](3759605f-b01a-470a-b9c1-61c9d2ddbc90): commit allowlist, rebase `--onto origin/main` (konflik `DECISIONS.md` digabung D-alief-03 + D-imelda-*), e2e, gerbang UI, jangan deploy.

- Rebase `lane/web` ke `origin/main` (fase 03 sudah di main). `snap/web-f11D1` ikut `--update-refs`.
- RED e2e: `/demo` = directory listing `public/demo/*.json`. Fix: `trailingSlash: true` + `SITE.demoPath='/demo/'`.
- `shouldAutoplayReplay` + chapter `<button>` (HIGH a11y: reduced-motion, keyboard seek, hit 24×24).
- Gerbang UI: screenshot Playwright `/` `/demo` `/gallery` 1440/390. Landing warm paper + Open Anyway. Demo gelap 3 kolom / stack 390.
- Review sesi ini: code/ts/security = 0 CRITICAL/HIGH. React HIGH chapter hit-area+focus → diperbaiki. MEDIUM dicatat (scrubber belum keyboard; link meta tanpa allowlist host — residual I2).
- `launch.json` tidak ada; browser Claude Code tidak dipakai. Playwright = fallback (catat).

**better-interface (screenshot + kode):**

| # | Domain | Severity | Temuan | Perbaikan |
|---|---|---|---|---|
| 1 | a11y | HIGH | Autoplay mengabaikan `prefers-reduced-motion` | `shouldAutoplayReplay` + e2e reduce |
| 2 | a11y | HIGH | Chapter label = `div` onClick, tidak keyboard | `<button type="button">` |
| 3 | a11y | HIGH | Chapter 10px/padding 0 < 24×24 | min 24×24 + padding |
| 4 | a11y | MEDIUM | Scrubber bar hanya klik | dicatat; seek lewat chapter button |
| 5 | writing | — | Landing memakai "Privacy & Security → Open Anyway" | sudah sesuai D-007.13 |

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

**Review Bob slice I2** (code-reviewer + security-reviewer + react-reviewer paralel, `app/page.tsx` + `app/globals.css`): nol CRITICAL/HIGH.

| # | Reviewer | Severity | Temuan | Perbaikan |
|---|---|---|---|---|
| 8 | code-reviewer + react-reviewer | LOW | Ikon emoji dekoratif (⚡📄✅) di 3 feature card tidak `aria-hidden`, screen reader baca nama emoji yang membingungkan padahal sudah ada `<h3>` di sebelahnya | `aria-hidden="true"` ditambah ke 3 div ikon |
| 9 | react-reviewer | MEDIUM | `metaRaw.links as SiteLinks` cast tanpa validasi runtime — kalau bentuk `meta.json` berubah, link rusak diam-diam (bukan error build) | Dicatat, TIDAK diperbaiki (risiko rendah: `meta.json` dihasilkan pipeline sendiri di commit yang sama, bukan sumber eksternal; perlu zod schema baru kalau mau diperbaiki sungguhan) |

Security-reviewer I2: semua 11 link `target="_blank"` sudah `rel="noopener noreferrer"`, tidak ada `dangerouslySetInnerHTML`/`eval`, tidak ada kredensial, `next/font/google` benar self-hosted (tanpa request ke fonts.googleapis.com saat runtime).

## Deviasi (lihat `plan/log/DECISIONS.md`)

- **D-imelda-01**: fixture diambil dari `radar/scripts/mock-scenarios/demo.json` (skenario Alief, hanya dibaca) via capture `GET /v1/events/export`, di-*re-timestamp* dari `delayMs` kumulatifnya sendiri, ditambah satu `commit.created` sintetis di akhir untuk chapter "Commit". **TODO(sync:alief)**: ganti dengan `GET /v1/events/export` server asli setelah fase 05/06, dan dengan rekaman nyata setelah milestone fase 10 (di 11D2).
- **D-imelda-02**: `bob-quotes.src.json` tidak ada; dipakai `radar/bob-kit/prompts/bob-quotes.json` apa adanya.
- **D-imelda-03**: definisi 4 counter (near-miss/decisions/merge-conflicts/median) dipilih dari katalog event R3 §5 karena DESIGN §5.8 tidak memberi rumus persis.
- **D-imelda-04**: snapshot 10 detik = waktu event (`ev.ts` offset), bukan waktu putar.
- **D-imelda-05**: skrip & fixture ditaruh di `radar/packages/web/{scripts,fixtures}` (bukan `radar/scripts/`, folder Lane Core).
- **D-imelda-06**: (superseded — I1/I2 sekarang selesai, lihat bagian Bob slice di bawah dan commit `2058da47`/`99d85138`).

## Bob slice yang dikerjakan

**I1 (pemutar replay + `/demo` + `/gallery`) — SELESAI.** Bob IDE (mode `coder`, task 01) menghasilkan `app/demo/page.tsx` (rewrite penuh), `app/gallery/page.tsx` (baru), `src/demo-helpers.test.ts` (16 test baru), dan menambah satu baris `@import` di `app/globals.css`. Diff dibaca penuh dan direview manual (bukan cuma dipercaya): 3 perbaikan diterapkan di atas hasil Bob (path import CSS salah, `/gallery` butuh `'use client'`, grid 3 kolom tidak responsif di 390px) — semuanya BUG NYATA yang baru ketahuan setelah `next build` sungguhan + cek visual manual di browser bawaan, bukan asumsi. Setelah perbaikan: 46 test hijau, `tsc --noEmit` bersih, `next build` + static export bersih, dicek visual 1440px dan 390px (autoplay jalan, klik chapter "Near-miss" lompat benar, klik baris aktivitas mengisi panel "Bob inside" dengan kutipan `bob_after_block` yang benar, layout mobile stack rapi setelah fix). Commit terpisah `2058da47` dengan trailer `Bob-Assisted`. Bukti: `bob_sessions/uaai_imelda_task01_replay_player_demo_summary.png` (4.30 Bobcoin, dari screenshot manual Cmd+Shift+4 — `bob-evidence.sh` gagal 3× karena Terminal sesi ini tidak punya akses Screen Recording macOS, baik mode window-detect maupun `--interactive`; lihat LANGKAH MANUAL).

**I2 (landing warm paper) — SELESAI.** Bob IDE (mode `coder`, task 02, 4/4 todo, 0.873 Bobcoin) menulis ulang penuh `app/page.tsx` + menambah 13 baris hover utility ke `app/globals.css`. Sesuai spek: kanvas `#f6f5f4`, kartu putih, headline 72px dengan pill marigold di kata "working", subhead Source Serif 4, font Inter+Source Serif 4 self-hosted lewat `next/font/google`, 3 langkah pasang dengan wording benar (bukan "klik kanan"), blok near-miss marigold dengan placeholder GIF bertanda `TODO(sync:imelda)`, dark island "Built on IBM Bob primitives", link kondisional Video/Deck, footer disclaimer + Orca MIT, tanpa jejak brand Notion. Bonus (di luar prompt): 3 feature card ringkas — dianggap penghias landing yang wajar, bukan fitur baru di luar PRD. Link diambil langsung dari `public/demo/meta.json` (bukan hardcode). Direview (lihat tabel), 1 LOW diperbaiki, 1 MEDIUM dicatat. Dicek visual 1440+390 — **tidak perlu perbaikan tambahan**, langsung rapi di dua lebar. Commit terpisah `99d85138` dengan trailer `Bob-Assisted`. Bukti: `bob_sessions/uaai_imelda_task02_landing_warm_paper_summary.png`.

## LANGKAH MANUAL (sisa)

1. **`gh auth login`** (akun GitHub kamu sendiri) lalu squash-merge PR #14 setelah CI hijau: `gh pr merge 14 --squash --delete-branch`. Snapshot akan di-push ulang di commit sesi ini (`lane/web-f11D1`). Jangan force-push `main`.
2. **Deploy Cloudflare Pages** (langkah 19) — menahan 11D1 dari `[x]` (UI-09). TODO B2. Setelah login wrangler:
   ```bash
   pnpm -C radar --filter "@radar/web..." build && pnpm -C radar deploy:web
   ```
   Cek `/` dan `/demo/` dari incognito. Baru lalu `[x]` baris 11D1.
3. **`eslint.config.js` coverage gap** — hook config-protection memblokir edit. Tambah glob `packages/*/scripts/**/*.ts` dan `packages/*/e2e/**/*.ts` ke `files` type-aware.
4. **MEDIUM sisa:** `sanitize.ts` belum AWS/JWT; `meta.json` links tanpa allowlist host; scrubber seek belum keyboard.

**Catatan untuk sesi Claude Code berikutnya**: `radar/scripts/bob-evidence.sh` gagal total di sesi ini (window-detect: "not found" walau Bob IDE beneran terbuka di layar manusia; `--interactive`: gagal 2x beda alasan, termasuk "Screen Recording permission"). Dugaan kuat: sesi agent ini tidak punya akses layar/Terminal-permission yang sama dengan sesi interaktif manusia. Solusi yang berhasil: user screenshot manual (Cmd+Shift+4) lalu kirim PNG ke chat, Claude Code convert format kalau perlu dan salin ke `bob_sessions/` + tulis baris index manual (format persis di `scripts/bob-evidence.sh`, tim `uaai` dari `plan/team.json`). Pakai cara ini lagi untuk Bob slice I3 (11D2) di sesi serupa; coba `bob-evidence.sh` biasa dulu hanya kalau sesi barunya punya akses layar nyata.

## Catatan handoff

- Fase berikutnya untuk lane ini setelah PR fase 11D1 di-merge: **10** (integrasi E2E, interupsi wajib Sab 21:00 WITA) — tapi fase 03/04/05/06 (Core) dan 11a (App) belum `[x]` di PROGRESS.md, jadi fase 10 kemungkinan besar juga akan berhenti menunggu lane lain; cek ulang `plan/PROGRESS.md` sebelum memulai.
- `@radar/ui` (fase 09, Aarief) SUDAH selesai dan berisi 10 komponen siap pakai (`AgentTag`, `MemberChip`, `LockChip`, `WritingPulse`, `BobTrace`, `DecisionCard`, `TaskCard`, `FeedItem`, `ReviewCard`, `BriefMeter`, `PresenceStack`) — Bob slice I1 memakai komponen ini langsung, tidak ada duplikat lokal.
- 11D2 (Bob slice I3 + replay final) tinggal: (a) draft Long Description (Sab 23:00-Min 01:00 sesuai jadwal), (b) setelah rekaman fase 10, jalankan ulang `export-replay.ts` dengan `RADAR_EXPORT_URL` mengarah ke server asli / rekaman nyata, lalu deploy ulang.
