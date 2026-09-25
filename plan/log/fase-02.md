# Log fase 02 — Common + mock (kontrak beku) (Lane Alief)

- **Status:** [x] selesai. PR `fase-02: common contracts, reducer, mock server` dari snapshot `lane/core-f02`.
- **Mulai:** Sab 26 Sep 2026 03:30 WITA · **Selesai:** Sab 26 Sep 2026 04:15 WITA · branch `lane/core`.
- **Model:** Claude Opus 5.5 (R6 §2).
- **Pra-cek:** `origin/main` memuat D-007 (≥ 1). Working tree bersih sebelum mulai. TODO B1–B5 belum lengkap: tidak berpengaruh ke fase 02 (tanpa deploy/secret).

## Ringkasan planner (`ecc:planner`)

1. Urutan: constants → types/schemas → paths → hook-payload (fixture spike Umar) → ignore/hash/http/brief → config (`/node`) → events/reducer/selectors → ws/term → mock hub → mock server → test → dokumen.
2. Entry utama harus bebas `node:*` karena Worker (fase 03) dan hook (fase 07) mengimpornya. Solusi: subpath `@radar/common/node`.
3. Celah spesifikasi G1–G12 ditemukan saat memetakan R1–R5 ke kode. Semua dicatat di **D-alief-02** dan ref yang terdampak diperbarui.
4. Mock dibangun di atas reducer yang sama dengan klien (event → `applyEvent`), jadi mock dan app tidak bisa berbeda tafsir soal state.

## Checklist langkah (plan/fase-02-common-mock.md)

- [x] 1. `constants.ts`: semua konstanta R5 §4 + `ACTIVITY_TIMEOUT_MS` baru + batas (plan, notify, feed).
- [x] 2. `types.ts`: tipe domain.
- [x] 3. `schemas.ts`: zod untuk setiap body R3 §2, `RadarEvent` (35 tipe, discriminated union), `parseRadarEvent`.
- [x] 4. `events.ts`: `EVENT_TYPES`, `feedText` (kalimat feed PRD, jam WITA).
- [x] 5. `paths.ts`: POSIX, relatif workspace, `toWorkspaceRelative` melempar / `tryWorkspaceRelative` null.
- [x] 6. `hook-payload.ts`: bentuk nyata Bob IDE 2.2.0 + bentuk docs + camelCase. Fixture `radar/docs/spike-payloads/` dipakai di test.
- [x] 7. `ignore.ts`: pola R5 §6 + `.gitignore`, deteksi biner, batas ukuran.
- [x] 8. `hash.ts`: `sha256Hex` (Web Crypto, aman di Worker dan Node).
- [x] 9. `http.ts`: `radarFetch` dengan timeout, error bertipe, validasi zod respons.
- [x] 10. `config.ts` (via `/node`): `.radar/local.json` + env `RADAR_*`, `state.json` tulis atomik.
- [x] 11. `brief.ts`: `clampBrief` 6 × 160.
- [x] 12. `reducer.ts`: murni, deterministik, lewati event ≤ cursor, event tak dikenal hanya memajukan cursor, `stateFromSnapshot`.
- [x] 13. Mock server `radar/scripts/mock-server.ts` + `radar/scripts/mock/hub.ts`: semua route R3, matriks auth, WS (`sync`/`mc`/`app`), ping/pong frame persis, skenario demo diputar saat klien mc/app pertama terhubung, `--instant`, `--speed`, `--scenario none`.
- [x] 14. Test & build: 93 test di `@radar/common` (target ≥ 40), 12 test mock, `build` menghasilkan `dist/` + `.d.ts`.
- [x] 15. Commit `fase-02: common contracts, reducer, mock server`.
- [x] v0.3 wajib: `client: "app"` di mock; selector `needsYouCount`, `memberStatus`, `bobTimeline`.
- [~] v0.3 P1: `term.ts` selesai; skenario `--scenario terminal` **dilewati** (P1, relay terminal bukan P0).
- [x] 16. Jendela ubah kontrak: hasil spike (D-umar-01) sudah ada sebelum fase 02 mulai, jadi fixture nyata dan usulan P1–P5 langsung masuk PR fase 02. Tidak ada PR `fase-02b` terpisah.

## File dibuat/diubah

- `radar/packages/common/src/`: `constants, types, schemas, events, paths, hook-payload, ignore, hash, http, config, node, brief, reducer, selectors, ws, term, index` + test `paths, hook-payload, schemas, reducer, util, node, bundle`.
- `radar/packages/common/README.md`, `package.json` (subpath `./node`, devDeps `esbuild`, `@types/node`).
- `radar/scripts/mock-server.ts`, `radar/scripts/mock/hub.ts`, `radar/scripts/mock-server.test.ts`, `radar/scripts/mock-scenarios/demo.json` (61 langkah), `radar/scripts/tsconfig.json`.
- `radar/package.json` (`dev:mock`, typecheck/test ikut `scripts/`), `radar/eslint.config.js` (lint bertipe untuk `scripts/**/*.ts`), `radar/vitest.shared.ts`, `radar/pnpm-lock.yaml`.
- `plan/ref/R1-struktur-repo.md` §6, `plan/ref/R3-kontrak-api.md` §2.2 + §2.24, `plan/ref/R5-konvensi.md` §4 + §5.
- `plan/log/DECISIONS.md` (D-alief-02), `plan/log/fase-02.md`, `plan/PROGRESS.md` (baris 02).

## Hasil verifikasi (`verification-loop`)

| Perintah | Hasil |
|---|---|
| `pnpm -C radar --filter @radar/common build` | rc 0, `dist/` + `.d.ts` |
| `pnpm -C radar test` | common 93, mock 12, paket lain hijau |
| `pnpm -C radar typecheck` | rc 0 (7 paket + `scripts/`) |
| `pnpm -C radar lint` | 0 masalah |
| `pnpm -C radar check:ignored` | `check:ignored OK` |
| `curl` locks/check `tok-b` `checkout.ts` (mock `--instant`) | `block`, `held_by_other`, holder A/T-1, `queuePos` 1, pesan R4 |
| `curl` brief `kind=start` `tok-a` | 4 baris `[Radar]` |
| `curl` decision P-1 dengan `tok-c` | 403 |
| `curl` bob/activity `turn.end` | 204 |
| `esbuild src/index.ts --bundle --platform=node --format=cjs` | OK |
| `esbuild src/index.ts --bundle --platform=neutral` | OK, 0 impor `node:` |

## DoD

- [x] Setiap bentuk data di R3 punya schema zod dan diekspor.
- [x] `normalizeHookPayload` lulus test dua bentuk payload + fixture spike nyata.
- [x] Reducer lulus test skenario demo; murni (tidak ada `Date.now`/I/O).
- [x] Mock menjawab semua endpoint R3 (termasuk `bob/activity`), 403 untuk decision token PM, memutar skenario demo (dengan `bob.activity`) lewat WS.
- [x] `@radar/common` tanpa `/node` tidak mengimpor `node:*` (bundel neutral + test).
- [x] `@radar/common` bisa dibundel esbuild tanpa error.

## Review (langkah 8)

| Reviewer | Temuan | Tindakan |
|---|---|---|
| `ecc:code-reviewer` | APPROVE. MEDIUM: `PathOutsideWorkspaceError` tidak ditangkap di `requestFile`/`applyUpdate`/`importFiles` mock (500 / frame `error` alih-alih 422 / `file.rejected`) | Diperbaiki: helper `relative()`, 422 untuk REST, `file.rejected` `conflict` untuk WS, path dilewati di import. Test baru. |
| `ecc:typescript-reviewer` | HIGH: `payload as never` di `MockHub.emitRaw` | Diperbaiki: `emit` dan `emitRaw` lewat satu `append()` yang memvalidasi dengan `parseRadarEvent`; tanpa cast. |
| | HIGH: `loadState` cast `state.json` tanpa validasi | Diperbaiki: skema zod `HookStateFile`, file salah bentuk → `{}`. Test baru. |
| | MEDIUM: `loadScenario` tanpa cek bentuk | Diperbaiki: cek `steps[]` + field wajib, error menyebut file dan indeks. |
| | LOW: `resolveActiveTask(...)!` bergantung pada default parameter | Dicatat, tidak diubah (mock saja). |

## Penyimpangan

- **TDD tidak red-first.** Test ditulis setelah modul (kontrak dari R2–R5 sudah rinci, test jadi pengecek kesesuaian). Dicatat jujur; fase 03 kembali red-first.
- `--scenario terminal` (P1) dilewati.
- Tidak ada PR `fase-02b` terpisah (lihat langkah 16).

## Catatan untuk lane lain

- Mock: `pnpm -C radar dev:mock` (lihat `radar/packages/common/README.md`). Token dev `tok-a`, `tok-b`, `tok-c`, `mc-dev`.
- App (Aarief): pakai `stateFromSnapshot` untuk `GET /v1/state` / pesan WS `state`, lalu `applyEvent` untuk setiap `event`. Feed dan aktivitas Bob sudah newest first.
- Bob (Umar): `normalizeHookPayload`, `ACTIVITY_TIMEOUT_MS`, `shareprompts` siap dipakai; kit perlu `@radar/common` di-build sebelum `bundle:kit`.
- Pertanyaan terbuka untuk fase 05: permintaan baru untuk task yang sudah antre (D-alief-02).

## Langkah manual

Tidak ada untuk fase 02.
