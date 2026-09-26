# Log fase 03 — Server inti di Cloudflare (Lane Alief)

- **Status:** [~] kode, test, dan uji lokal selesai. PR `fase-03: server core on Cloudflare (Worker + Durable Object, SQLite, auth, events, files, ws)` dari snapshot `lane/core-f03`. Deploy ke Cloudflare = langkah manual (TODO B2–B5 belum [x]).
- **Mulai:** Sab 26 Sep 2026 04:20 WITA · **Selesai (lokal):** Sab 26 Sep 2026 09:05 WITA · branch `lane/core`.
- **Model:** Claude Opus 5.5 (R6 §2).
- **Pra-cek:** `origin/main` memuat D-007. Working tree bersih. TODO B1 [x], B2–B5 [ ] → fase 03 jalan lokal saja; deploy, `wrangler secret put`, dan `admin init` produksi jadi langkah manual.
- **Ketergantungan:** PR fase 02 ([umarmuhdhor/IBM#4](https://github.com/umarmuhdhor/IBM/pull/4)) belum merge; PR fase 03 berisi commit fase 02 sampai #4 merge dan lane di-rebase.

## Ringkasan planner (`ecc:planner` + `ecc:architect`)

1. Worker tipis (Hono, CORS, `/healthz`) meneruskan semua path lain ke satu DO `WorkspaceDO` (`getByName(WORKSPACE_ID)`). Route `/ws` didaftarkan sebelum middleware CORS supaya respons 101 tidak disentuh.
2. DO memegang semua logika: `Db` kecil di atas `ctx.storage.sql`, repo per tabel, service murni yang menerima `WorkspaceDeps` (DO sendiri mengimplementasikannya), Hono di dalam DO.
3. Perubahan state selalu lewat `transact(fn)`: event dan pesan `toSync` dikumpulkan di `UnitOfWork` selama transaksi, lalu di-broadcast setelah commit (outbox).
4. WebSocket Hibernation: `acceptWebSocket` tanpa tag, status di attachment (`pending` → `ready` / `replaced` / `closed`), satu `AlarmScheduler` dengan penyedia tenggat (fase ini: tenggat hello; fase 05 menambah job 30 s lock).
5. Semua handler WS sinkron setelah parsing (hash `node:crypto`), jadi satu pesan selesai sebelum pesan berikutnya diproses.

## Checklist langkah (plan/fase-03-server-inti.md)

- [x] 1. Proyek Worker: hono, zod, diff, `@radar/common`; wrangler 4.140, `@cloudflare/vitest-plugin` 1.2.7, vitest 4.1. `nodejs_compat`. Script `dev`, `deploy`, `test`, `types`.
- [x] 2. Worker tipis `src/index.ts`: CORS dari `CORS_ORIGIN`, `/healthz`, teruskan ke DO.
- [x] 3. `db/sql.ts` (`all/one/run/script/tx`, maks 100 parameter), `db/migrate.ts` di `blockConcurrencyWhile`, skema R2 §2 (`db/schema.ts`, D-alief-03 butir 7).
- [x] 4. Repo: `meta`, `counter`, `member`, `access`, `file` (+ `file_version`), `event`, `metric`.
- [x] 5. `services/events.ts`: `appendEvent` validasi zod, hanya di dalam transaksi, broadcast setelah commit.
- [x] 6. `http/auth.ts`: bearer → sha256 → `token` → principal; matriks role; `x-admin-secret` dibandingkan timing-safe; token tidak pernah di-log.
- [x] 7. `http/errors.ts`: `RadarError`, `ZodError` → 422, JSON rusak → 400, error tak dikenal → 500 generik.
- [x] 8. `src/admin.ts` (init, files, token, export, reset) + `scripts/admin.ts` (`init --repo-dir`, `token`, `export`, `reset --confirm`; `ADMIN_SECRET` dari env saja).
- [x] 9. `GET /v1/state`, `GET /v1/events/export` (publik bila `PUBLIC_EXPORT=true`, `patch` untuk `file.changed`).
- [x] 10. `services/files.ts` `applyUpdate` (urutan R4: ukuran → biner → hash → path → `authorizeWrite` → base basi → hash sama → tulis v+1).
- [x] 11. Hub WS: hello ≤ 5 s lewat alarm, `sync` → `welcome` + `snapshot` (filter `knownVersions`), `app`/`mc` → `welcome` + `state`, `file.update`/`file.applied`/`heartbeat` (attachment saja), auto-response ping, presence online/reconnected (4000)/offline.
- [x] 11b. `POST /v1/bob/activity`: `memberId` dari token, teks dipotong 200, 20/s per member + `metric(activity_dropped)`.
- [x] 12. Test (lihat bawah).
- [x] 13. Deploy 26 Sep 12:40 WITA (dikerjakan di sesi fase 04 atas permintaan Alief): `wrangler deploy` → `https://live-collab.afindo-mi01.workers.dev` (version `b544b7ce`), `ADMIN_SECRET` + `GITHUB_TOKEN` terpasang, `admin init` produksi (repo `aliefauzan/toko-demo`, 18 file, head `ed9e4b2`). `/healthz` 200, `/admin/init` tanpa secret 401. Sync A↔B lewat Worker lulus (log fase 04).
- [x] 14. Commit fase.

## Bukti TDD

- RED: `45f4b130 test(server): fase-03 RED suite …` — suite gagal karena modul server belum ada.
- GREEN: `6d891d25 feat(server): …` — 47/47 hijau, stabil 3× rerun.
- Admin CLI: `0e2f895a feat(scripts): …` — 14 test (`scripts/admin.test.ts`, termasuk init lawan mock server fase 02).
- Setelah review: 52/52 server (tambah rotate menutup socket, reset 1012 + alarm terhapus, impor ulang tidak menimpa v>1, `metric(activity_dropped)`, unit `ActivityLimiter`). Scripts 26/26.

| # | Yang dijamin | Test |
|---|---|---|
| 1 | Token salah / pesan pertama bukan hello / jenis klien salah → close 4401 | `ws.test.ts` hello |
| 2 | Socket tanpa hello ditutup alarm; tidak ada alarm tersisa setelah ready | `ws.test.ts` alarm |
| 3 | A `file.update` → A `file.ack`, B `file.changed` v+1, mc `event`, A tidak menerima miliknya (SV-01) | `ws.test.ts` |
| 4 | Hash sama → tanpa versi baru; 100 update → versi monoton | `ws.test.ts` |
| 5 | `pm_readonly`, `too_large`, biner, hash salah, `../escape.ts`, base basi → `file.rejected` | `ws.test.ts` |
| 6 | Heartbeat tidak menulis SQL; hibernasi (`evictDurableObject`) mempertahankan attachment | `ws.test.ts` |
| 7 | Export berurutan dengan `patch` (SV-08), auth 401/403, `PUBLIC_EXPORT` | `rest.test.ts` |
| 8 | `bob/activity` 204 + event ke `app`/`mc`, `mc` → 403, `memberId` body diabaikan, 20/s + metric | `rest.test.ts` |
| 9 | FK ON, insert `lock` dengan task tak dikenal gagal, skema R2 lengkap | `db.test.ts` |
| 10 | Admin 401/409/422/404, 3 batch `/admin/files`, rotate, reset, impor ulang | `admin.test.ts` |
| 11 | `/healthz`, CORS, `/ws` tanpa upgrade 426 | `worker.test.ts` |

## Uji lokal (`wrangler dev`, secret lokal acak di `.dev.vars` yang di-ignore)

- `GET /healthz` → `{"ok":true,"workspace":"toko-demo","version":"0.3.0"}`.
- `admin init --repo-dir examples/toko-demo` 3 member → 18 file diimpor, 4 token (A, B, P, mc). Init kedua tanpa `--force` → 409. Secret salah → 401. `export --out` → 4 event.
- WS: `sync` A → `welcome,snapshot` (18 file); `mc` → `welcome,state`; token salah → 4401; A menutup socket → mc menerima `member.offline`.
- Token tidak muncul di log test (`grep -c rdr_` = 0) maupun log `wrangler dev` (0).

## Review (langkah 8)

| Reviewer | Temuan | Tindakan |
|---|---|---|
| `ecc:code-reviewer` | APPROVE. MEDIUM: `/admin/files` hanya cek "sudah init" setelah `await` GitHub; `init --force` paralel bisa ditimpa batch lama | Diperbaiki: bandingkan `meta.created_at` sebelum/sesudah `await`, beda → 409 |
| | LOW: path tidak valid dilaporkan sebagai `conflict` | Dicatat + komentar (R3 tidak punya alasan khusus) |
| `ecc:typescript-reviewer` | HIGH: rejection `blockConcurrencyWhile(migrate)` tidak terlihat | Diperbaiki: try/catch log `console.error` lalu lempar ulang (runtime me-reset DO) |
| | MEDIUM: `JSON.parse` payload proposal tanpa guard di `buildState` | Diperbaiki: `parseStoredJson`, baris rusak → `null` + log |
| | MEDIUM: `delete payload.clientTs` | Dicatat (D-alief-03) |
| `ecc:security-reviewer` | 0 CRITICAL/HIGH. MEDIUM: brute force `x-admin-secret`; `PUBLIC_EXPORT` + CORS `*` | Dicatat (D-alief-03); secret acak ≥ 32 byte, export publik default mati |
| | LOW: tanpa rate limit `file.update` per socket; socket pending tanpa batas jumlah | Dicatat untuk fase 12 |
| `ecc:silent-failure-hunter` | HIGH: event rusak dilewati hanya dengan `warn` | Diperbaiki: `console.error` dengan ID event (skema dicek saat insert, jadi hanya terjadi bila ada bug) |
| | HIGH: `ws.send` gagal hanya `warn`, klien bisa tertinggal | Diperbaiki: log error + tutup 1011 supaya klien reconnect dan dapat snapshot baru |
| | MEDIUM: patch export dari baris `file_version` hilang; fetch GitHub tanpa timeout; CLI membuang body error non-JSON | Diperbaiki: log error, `AbortSignal.timeout(10 s)`, 200 char pertama body ditampilkan |
| | MEDIUM: `hub.close` menelan error | Dicatat |
| `ecc:pr-test-analyzer` | CRITICAL: `metric(activity_dropped)` tidak pernah dites; rotate menutup socket tidak dites. HIGH: reset 1012 + alarm; impor ulang v>1 | Diperbaiki: 5 test baru (4 integrasi + unit `ActivityLimiter`) |

Verification loop: `pnpm -C radar build` OK, `typecheck` OK, ESLint bersih, `pnpm -C radar test` semua hijau (common 93, server 52, scripts 26, lainnya 1/36/41/1/1), gitleaks `ac8edb4d..HEAD` bersih.

## DoD

- [x] Semua test integrasi langkah 12 hijau (52/52).
- [x] SV-01 (test 3) dan SV-08 (test 7).
- [x] Token hanya hash; log bersih dari token.
- [~] Worker ter-deploy, `/healthz` 200 dari luar, dua sync agent tersambung dan bertukar file (bench 50 write). Uji tersambung > 5 menit menunggu fase 10.

## Penyimpangan

- `schema.ts` alih-alih `schema.sql`; `parseArgs` alih-alih `commander` (D-alief-03 butir 7, 10).
- Test msw untuk verifikasi `headCommit` GitHub ditunda ke fase 06 (D-alief-03 butir 2).
- `test/setup.ts` dan `test/fixtures/` tidak dibuat: helper di `test/helpers.ts` sudah cukup.

## Catatan untuk lane lain

- Protokol WS dan REST fase 03 sama dengan mock fase 02. Setelah deploy, ganti URL mock dengan URL Worker; token dari `admin init` dibagikan lewat kanal privat.
- `client: 'app'` menerima token member atau mc (read-only `state` + `event`).
- `POST /v1/bob/activity` asli siap untuk kit Umar (fase 07) dan app Aarief (fase 11).

## Langkah manual (Alief)

1. Isi TODO B2 (subdomain `*.workers.dev`), B3 (repo `toko-demo`), B4 (PAT fine-grained), B5 (`ADMIN_SECRET` acak ≥ 32 byte di password manager).
2. `pnpm -C radar deploy:server`.
3. `cd radar/packages/server && npx wrangler secret put ADMIN_SECRET` lalu `npx wrangler secret put GITHUB_TOKEN` (nilai diketik di prompt wrangler).
4. `export ADMIN_SECRET=…` di shell (tidak masuk history bila diawali spasi), lalu `pnpm -C radar admin init --server https://live-collab.<akun>.workers.dev --workspace toko-demo --repo <owner>/toko-demo --repo-dir <clone toko-demo> --member "A:coder:Alice:…" --member "B:coder:Budi:…" --member "C:pm:Citra:…"`. Simpan token di password manager tim.
5. `curl https://live-collab.<akun>.workers.dev/healthz` dan `npx wscat -c wss://live-collab.<akun>.workers.dev/ws` (biarkan > 5 menit).
