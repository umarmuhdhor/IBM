# Fase 03 — Collab Server inti: DB, auth, event log, file store, WebSocket, deploy

| Field | Nilai |
|---|---|
| Jalur | **Lane A** (Orang 1) · branch `lane/core` |
| Slot WITA | Sab 26 Sep 02:30 – 07:00 (deploy server kosong target ≤ 04:00) |
| Estimasi | 4 jam |
| Prasyarat | 02 |
| Requirement PRD | SV-01, SV-08, NFR-02, NFR-04, dasar SV-03 (hook penolakan PM), §8.3 |
| Model | **Opus 5.5** · effort high (alt: Sonnet 5 · high) |
| Fase berikutnya | 04 |

## Tujuan

Server yang hidup terus (bukan serverless) dengan SQLite sebagai sumber kebenaran: menyimpan isi file berversi, mencatat setiap kejadian ke event log, mengautentikasi token per anggota & Mission Control, dan menyebarkan perubahan file ke semua klien lewat WebSocket. Mesin kunci penuh menyusul di fase 05; fase ini menyiapkan titik sambung `authorizeWrite`.

## Bacaan wajib

- `plan/ref/R2-skema-db.md` (seluruhnya), `plan/ref/R3-kontrak-api.md` §1, §2.1, §2.21, §2.23, §3, §5
- `plan/ref/R4-mesin-kunci.md` §3 bagian "Penerimaan file.update"
- PRD §08.1, §08.3, §12

## Output

- `packages/server/src/**` (main, cli, app, config, db, services/events, services/files, http/auth, http/errors, routes health/state/export, ws/hub)
- `packages/server/test/*.int.test.ts`
- `packages/server/Dockerfile`, `fly.toml` (atau `render.yaml` / `railway.json`), `.dockerignore`
- Server ter-deploy dengan `GET /healthz` hijau

## Langkah kerja

1. **Config** (`config.ts`): baca env R5 §5 dengan zod, default dev (`PORT=8787`, `DATA_DIR=./.data`, `GIT_PUSH=false`). Gagal validasi → exit dengan pesan jelas.

2. **DB** (`db/migrate.ts`): buka `better-sqlite3` di `$DATA_DIR/radar.db` (atau `:memory:` untuk test), jalankan `schema.sql` (salinan persis R2 §2), set `meta.schema_version`. Fungsi `openDb(path)` mengembalikan instance + prepared statements.

3. **Repository** (`db/repo/*.ts`): satu modul per tabel dengan fungsi kecil bertipe (tanpa ORM). Wajib: `member`, `token`, `meta`, `counter.next(name)`, `file` (`get`, `list`, `upsert`, `snapshot()`), `fileVersion`, `event` (`append`, `listSince`, `range`), `metric.record`. Repo untuk task/lock/allocation/request/proposal/review/notification dibuat sebagai kerangka (fase 05 mengisi logika).

4. **Event service** (`services/events.ts`): `append(actor, type, payload)` → insert ke `event` + validasi `RadarEvent` zod + `bus.emit('event', ev)` (Node `EventEmitter`). Semua perubahan state di fase ini dan berikutnya **wajib** lewat `append` di dalam transaksi yang sama dengan perubahannya (emit bus dilakukan setelah transaksi commit: kumpulkan event dalam array lalu emit di `afterCommit`).
   Helper: `withTx(db, fn)` → menjalankan `fn` di `db.transaction`, lalu mem-flush event yang terkumpul ke bus.

5. **Auth** (`http/auth.ts`): plugin Fastify `onRequest` → header bearer → `sha256Hex(token)` → lookup tabel `token` (tidak dicabut) → `req.principal`. Route mendeklarasikan `config: { roles: ['coder'] | ['pm'] | ['mc'] | 'any' | 'public' }`; plugin menolak dengan 401/403 sesuai matriks R3 §1. Bandingkan hash, jangan token mentah; jangan pernah log token.

6. **Error** (`http/errors.ts`): `RadarError(code, message, status)`; `setErrorHandler` → bentuk R3 §1; `ZodError` → 422 dengan pesan field pertama.

7. **CLI `radar-server`** (`cli.ts`, `commander`):
   - `init`: validasi argumen `--member "ID:role:Nama:email"`; clone `--repo` ke `$DATA_DIR/repo` (`simple-git`; path lokal juga boleh); walk file dengan `createIgnoreMatcher` + batas 1 MB + deteksi biner; insert `file` versi 1 + `file_version`; `meta.head_commit` = `git rev-parse HEAD`; buat member dengan warna R5 §4; generate token `rdr_<32 byte base64url>` untuk A/B/C + satu token mc; simpan hash; **cetak token sekali** dalam tabel; event `workspace.created`, `member.created`.
   - Menolak `init` kalau DB sudah ada (kecuali `--force`).
   - `start`, `token --member X --rotate`, `export --out`, `reset --confirm`.

8. **App** (`app.ts`): `buildApp({ db, config, logger })` mendaftarkan cors (`CORS_ORIGIN`), auth, error handler, routes, websocket. `main.ts` = `openDb` + `buildApp` + `listen({ host: '0.0.0.0', port })` + shutdown bersih (SIGTERM tutup WS, DB).

9. **Routes fase ini**: `GET /healthz` (public), `GET /v1/state` (pm/mc; untuk sekarang berisi workspace, members, files metadata, recentEvents, cursor; field lain array kosong), `GET /v1/events/export` (any; public bila `PUBLIC_EXPORT=true`). Payload `file.changed` di export berisi `patch` (buat dengan paket `diff` `createTwoFilesPatch` dari `file_version` sebelumnya) — bukan isi utuh.

10. **File service** (`services/files.ts`): `applyUpdate({ member, path, baseVersion, content, hash })` mengikuti R4 "Penerimaan file.update" **kecuali** pemanggilan `checkWrite` diganti fungsi yang bisa disuntik `authorizeWrite(member, path, via)`. Implementasi fase ini: `pm` → block `pm_readonly`, selain itu allow. Validasi: ukuran ≤ 1 MB, bukan biner, hash cocok, path lolos `normalizeRelative` & tidak diabaikan. Idempoten: hash sama dengan versi server → ack tanpa menaikkan versi.

11. **WebSocket hub** (`ws/hub.ts`, `@fastify/websocket` di `/ws`):
    - Koneksi baru → tunggu `hello` ≤ 5 s (tutup 4401 kalau tidak). Autentikasi token sama dengan REST.
    - `client: 'sync'` (member): kirim `welcome` lalu `snapshot` (semua file, atau hanya yang berbeda dari `knownVersions`); set `member.online=1`, event `member.online` (atau `member.reconnected` kalau menggantikan koneksi lama — tutup koneksi lama dengan kode 4000).
    - `client: 'mc'` (token mc) atau PM: kirim `welcome` lalu `state`; berlangganan bus → kirim setiap event sebagai `{ t: 'event', d: ev }`.
    - `file.update` → `files.applyUpdate` → `file.ack` ke pengirim, `file.changed` ke semua koneksi sync **lain**; `file.rejected` ke pengirim bila ditolak.
    - `file.applied` → catat `metric(sync_apply_ms)` + event `sync.applied`.
    - `heartbeat` → `member.last_heartbeat = now`.
    - `ping` tiap 20 s; koneksi tanpa `pong` 2× → terminate; saat close: `online=0`, event `member.offline`.
    - Validasi setiap pesan dengan `WsMessage` zod; pesan invalid → `error` tanpa menutup koneksi.
    - Backpressure sederhana: kalau `socket.bufferedAmount > 8 MB`, tutup koneksi (klien akan reconnect & snapshot).

12. **Test integrasi** (`test/ws.int.test.ts`, `test/auth.int.test.ts`, `test/files.int.test.ts`) dengan `buildApp` + `:memory:` + seed fungsi `seedTestWorkspace()` (3 member, token tetap untuk test, 5 file):
    - hello salah token → `error` + close 4401.
    - A `file.update` → A menerima `file.ack`, B menerima `file.changed` dengan versi +1, A **tidak** menerima `file.changed` sendiri.
    - Hash sama → tidak ada versi baru, tidak ada broadcast.
    - C (pm) `file.update` → `file.rejected {reason: 'pm_readonly'}` dan isi server tidak berubah.
    - File > 1 MB → `too_large`.
    - Versi naik monoton (I6) pada 100 update beruntun.
    - `GET /v1/events/export` mengembalikan event berurutan dengan `patch`.
    - Auth: tanpa token 401; token coder ke `/v1/state` 403.

13. **Deploy** (target ≤ 04:00 untuk "server kosong", ulang setelah fase ini):
    - `Dockerfile` multi-stage `node:20-bookworm-slim` (stage build: `python3 make g++` untuk better-sqlite3; `pnpm deploy --filter @radar/server --prod /app`), `CMD ["node","dist/main.js"]`, `git` terpasang di image runtime.
    - Fly.io: `fly launch --no-deploy`, volume `radar_data` di `/data`, `fly secrets set GITHUB_TOKEN=… CORS_ORIGIN=…`, satu mesin (`min_machines_running = 1`, **auto_stop off** agar WS tidak putus), health check `/healthz`.
    - Jalankan `radar-server init` di mesin (`fly ssh console -C "node dist/cli.js init …"`) dengan repo `toko-demo`. Simpan token keluaran di password manager tim.
    - Alternatif: Render/Railway dengan disk persisten. Catat pilihan di DECISIONS.

14. Commit `fase-03: server core (db, auth, events, files, ws)`.

## Tambahan v0.3

- Repo DB untuk token bernama `db/repo/access.ts` (bukan `token.ts`, R5 §8). Tabel SQL `token` boleh tetap.
- Hub WS menerima `client: "app"` (token member, read-only `state` + `event`). Relay `term.*` dikerjakan di fase 06.
- Deploy pertama ke Fly/Railway sebelum tidur, supaya Lane C bisa konek ke staging saat Sinkron 1.

## Verifikasi

```bash
pnpm --filter @radar/server test
pnpm --filter @radar/server build
DATA_DIR=./.data pnpm --filter @radar/server exec node dist/cli.js init --workspace toko-demo \
  --repo ./examples/toko-demo --member "A:coder:Alice:alice@example.com" \
  --member "B:coder:Budi:budi@example.com" --member "C:pm:Citra:citra@example.com"
pnpm dev:server &
curl -s localhost:8787/healthz
curl -s https://<app>.fly.dev/healthz        # setelah deploy
```

## Kriteria selesai (DoD)

- [ ] Semua test integrasi di langkah 12 hijau.
- [ ] SV-01: update diterima menaikkan versi dan tersebar ke klien lain (bukti test).
- [ ] SV-08: setiap kejadian tercatat dan `GET /v1/events/export` berfungsi (bukti test).
- [ ] Token hanya tersimpan sebagai hash; log tidak berisi token (grep log test).
- [ ] Server ter-deploy, `/healthz` hijau, WebSocket bisa dihubungi dari luar (`wscat -c wss://…/ws`).

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| better-sqlite3 gagal di image | Pakai `node:20-bookworm` (bukan slim) atau prebuild; terakhir Render native runtime |
| Fly WS putus karena idle | `ping` 20 s + `auto_stop_machines = false` |
| Clone repo privat butuh token | Repo toko-demo publik; push memakai `GITHUB_TOKEN` lewat URL `https://x-access-token:<tok>@github.com/...` hanya di memori, tidak ditulis ke `.git/config` (set `remote` dengan `-c` per perintah) |

## Catatan handoff

- Fase 04 memakai: protokol WS, `seedTestWorkspace()` untuk test integrasi sync.
- Fase 05 mengganti `authorizeWrite` dengan `locks.checkWrite` dan melengkapi `/v1/state`.
- Bagikan URL server + token A/B/C/mc ke tim lewat kanal privat (bukan repo).
