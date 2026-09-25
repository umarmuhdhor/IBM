# Fase 03 — Collab Server inti di Cloudflare: Worker + Durable Object, SQLite, auth, event log, WebSocket, deploy

| Field | Nilai |
|---|---|
| Jalur | **Lane Alief** (Alief) · branch `lane/core` |
| Slot WITA | Sab 26 Sep 02:30 – 07:00 (deploy Worker kosong target ≤ 04:00) |
| Estimasi | 4 jam |
| Prasyarat | 02 |
| Requirement PRD | SV-01, SV-08, NFR-02, NFR-04, dasar SV-03 (hook penolakan PM), §8.3 |
| Model | **Opus 5.5** · effort high (alt: Sonnet 5 · high) · skill Cloudflare: `durable-objects`, `workers-best-practices`, `wrangler` |
| Fase berikutnya | 04 |

## Tujuan

Server yang memegang satu-satunya sumber kebenaran, **tanpa server yang kita urus**:
- **Cloudflare Worker** tipis menerima request dan meneruskannya ke satu **Durable Object (DO) per workspace** (`WorkspaceDO`, nama = `WORKSPACE_ID`).
- DO memakai **SQLite bawaan** (`ctx.storage.sql`) untuk menyimpan isi file berversi, event log, dan token (hash).
- DO memegang semua koneksi **WebSocket** lewat **Hibernation API**.
- Karena DO memproses satu pesan pada satu waktu, cek kunci di fase 05 bebas race condition tanpa lock tambahan.

Mesin kunci penuh menyusul di fase 05. Fase ini menyiapkan titik sambung `authorizeWrite`.

## Bacaan wajib

- `plan/ref/R2-skema-db.md` (seluruhnya, lihat catatan DO SQLite di atasnya), `plan/ref/R3-kontrak-api.md` §1, §2.1, §2.21, §2.23, §3, §5
- `plan/ref/R4-mesin-kunci.md` §3 bagian "Penerimaan file.update"
- PRD §08.1, §08.3, §12 · `ARCHITECTURE.md`
- Skill Cloudflare (`/plugin install cloudflare@cloudflare`): `durable-objects`, `workers-best-practices`, `wrangler`

## Output

- `packages/server/wrangler.jsonc`: Worker `live-collab`, binding DO `WORKSPACE` → class `WorkspaceDO`, `migrations: [{ tag: "v1", new_sqlite_classes: ["WorkspaceDO"] }]`, `vars` (`WORKSPACE_ID`, `CORS_ORIGIN`, `PUBLIC_EXPORT`, `BOB_COAUTHOR`, `AUTO_APPLY_QUEUE`, `GITHUB_REPO`), secret (`GITHUB_TOKEN`, `ADMIN_SECRET`) via `wrangler secret put`
- `packages/server/src/index.ts` (Worker: Hono, CORS, forward ke DO), `src/workspace-do.ts` (class DO), `src/db/{schema.sql,migrate.ts,sql.ts,repo/*.ts}`, `src/services/{events,files}.ts`, `src/http/{auth,errors,routes/*}.ts`, `src/ws/hub.ts`, `src/admin.ts`
- `packages/server/test/*.test.ts` dengan `@cloudflare/vitest-pool-workers` (menjalankan DO + SQLite asli di workerd lokal)
- `scripts/admin.ts` (CLI Node pengganti `radar-server`: `init`, `token --rotate`, `export`, `reset`, memanggil endpoint `/admin/*`)
- Worker ter-deploy: `https://live-collab.<akun>.workers.dev/healthz` hijau

## Langkah kerja

1. **Proyek Worker.** `packages/server` dependensi: `hono`, `zod`, `nanoid`, `diff`, `@octokit/rest` (dipakai fase 06), `@radar/common`. Dev: `wrangler`, `@cloudflare/workers-types`, `@cloudflare/vitest-pool-workers`, `vitest`. `compatibility_date` terbaru, `compatibility_flags: ["nodejs_compat"]`. Script: `dev` = `wrangler dev` (lokal, DO + SQLite jalan di mesin sendiri, tanpa tunnel), `deploy` = `wrangler deploy`, `test` = `vitest run`.

2. **Worker tipis** (`src/index.ts`): Hono dengan CORS (`CORS_ORIGIN`), `GET /healthz` langsung dijawab. Semua path lain (`/v1/*`, `/ws`, `/admin/*`) diteruskan apa adanya ke `env.WORKSPACE.get(env.WORKSPACE.idFromName(env.WORKSPACE_ID)).fetch(request)`. Worker tidak menyimpan state dan tidak melakukan kerja berat, karena batas CPU Worker di plan gratis cuma 10 ms per request. Semua logika ada di DO.

3. **DB di DO** (`db/sql.ts`, `db/migrate.ts`): pembungkus kecil `Db` di atas `ctx.storage.sql`: `all(sql, ...args)`, `one()`, `run()`, dan `tx(fn)` = `ctx.storage.transactionSync(fn)`. Migrasi dijalankan di constructor DO dalam `ctx.blockConcurrencyWhile(...)`: eksekusi `schema.sql` (R2 §2, tanpa PRAGMA yang tidak didukung DO) dan set `meta.schema_version`. Service menerima `Db`, bukan objek Cloudflare, supaya mudah dites.

4. **Repository** (`db/repo/*.ts`): sama seperti v0.2. Satu modul per tabel dengan fungsi kecil bertipe. Wajib: `member`, `access` (token), `meta`, `counter.next`, `file`, `fileVersion`, `event`, `metric`. Repo lainnya berupa kerangka untuk fase 05.

5. **Event service** (`services/events.ts`): `append(actor, type, payload)` → insert ke `event` + validasi zod `RadarEvent`. Event dikumpulkan selama `tx`, lalu setelah transaksi selesai di-broadcast lewat `hub.broadcastEvent(ev)`. Semua perubahan state wajib lewat `append` di transaksi yang sama.

6. **Auth** (`http/auth.ts`): bearer → `sha256Hex` (Web Crypto `crypto.subtle.digest`) → lookup `token` → `principal`. Middleware Hono per route dengan `roles` sesuai matriks R3 §1. Jangan pernah log token. `/admin/*` hanya menerima header `x-admin-secret` = `ADMIN_SECRET` (dibandingkan timing-safe).

7. **Error** (`http/errors.ts`): `RadarError(code, message, status)` → bentuk R3 §1. `ZodError` → 422.

8. **Admin** (`src/admin.ts` + `scripts/admin.ts`), pengganti CLI `radar-server`:
   - `POST /admin/init {workspace, repo: "owner/name", branch, members:[{id,role,name,email}]}`: tolak kalau sudah ada data, kecuali `force`. Ambil file repo lewat GitHub API (`GET /repos/{o}/{r}/git/trees/{branch}?recursive=1` lalu blob/raw per file) dengan `createIgnoreMatcher`, batas ukuran, dan deteksi biner. Insert `file` v1 + `file_version`, `meta.head_commit` = sha tree/commit. Buat member (warna R5 §4) dan token `rdr_<32 byte base64url>` untuk A/B/C + satu token mc. Simpan hash-nya saja. **Kembalikan token sekali.** Event `workspace.created`, `member.created`.
   - `POST /admin/token {member, rotate:true}`, `GET /admin/export`, `POST /admin/reset {confirm:true}` (hapus semua baris SQL).
   - `scripts/admin.ts` (Node, `commander`): `pnpm -C radar admin init --server <url> --repo <owner/name> --member "A:coder:Alice:a@x" …`. Membaca `ADMIN_SECRET` dari env (bukan argumen, supaya tidak masuk history shell) dan mencetak token dalam tabel.

9. **Routes fase ini**: `GET /v1/state` (pm/mc, dan read-only untuk `app`), `GET /v1/events/export` (any, publik bila `PUBLIC_EXPORT=true`). `file.changed` di export berisi `patch` (`diff.createTwoFilesPatch` dari `file_version` sebelumnya), bukan isi utuh.

10. **File service** (`services/files.ts`): `applyUpdate({ member, path, baseVersion, content, hash })` mengikuti R4 "Penerimaan file.update", dengan `authorizeWrite(member, path, via)` yang bisa disuntik. Implementasi fase ini: `pm` → `pm_readonly`, selain itu allow. Validasi ukuran ≤ `MAX_FILE_BYTES`, bukan biner, hash cocok, path valid. Idempoten.

11. **WebSocket hub** (`ws/hub.ts`, di dalam DO, **Hibernation API**):
    - `GET /ws` dengan header `Upgrade` → `new WebSocketPair()`, lalu `ctx.acceptWebSocket(server, [tag])`. Tag awal `pending`. Balas `101`.
    - `webSocketMessage(ws, msg)`: pesan pertama wajib `hello` ≤ 5 s (cek via `ws.deserializeAttachment()` dan alarm). Setelah autentikasi, `ws.serializeAttachment({ memberId, role, client })` supaya info tetap ada setelah DO hibernasi. Tag socket diganti (`sync`, `app`, `mc`) lewat socket baru, atau simpan di attachment dan filter saat broadcast.
    - `client: 'sync'` → `welcome` + `snapshot`, set online, event `member.online` (koneksi lama member yang sama ditutup dengan 4000).
    - `client: 'app' | 'mc'` → `welcome` + `state`, lalu menerima setiap `event`.
    - `file.update` → `files.applyUpdate` → `file.ack` ke pengirim, `file.changed` ke semua socket `sync` lain (`ctx.getWebSockets()` + filter attachment). `file.rejected` bila ditolak.
    - `file.applied`, `heartbeat`: seperti v0.2.
    - **Ping murah**: `ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}','{"t":"pong"}'))`, jadi keepalive tidak membangunkan DO dan tidak ditagih.
    - `webSocketClose/Error` → `online=0`, event `member.offline`.
    - Validasi setiap pesan dengan zod `WsMessage`. Pesan invalid → `error` tanpa menutup koneksi.
12. **Test** (`@cloudflare/vitest-pool-workers`, `SELF.fetch` + `runInDurableObject`): hello token salah → close 4401 · A `file.update` → A `file.ack`, B `file.changed` v+1, A tidak menerima miliknya sendiri · hash sama → tanpa versi baru · PM update → `pm_readonly` · file terlalu besar → `too_large` · versi monoton pada 100 update · export berurutan dengan `patch` · auth 401/403 · admin tanpa secret 401.
13. **Deploy** (target ≤ 04:00 untuk Worker kosong):
    - `npx wrangler login` (akun Cloudflare tim, plan Free cukup), `pnpm -C radar --filter @radar/server run deploy`.
    - `npx wrangler secret put ADMIN_SECRET` dan `npx wrangler secret put GITHUB_TOKEN` (fine-grained, hanya repo `toko-demo`, Contents read & write).
    - `pnpm -C radar admin init --server https://live-collab.<akun>.workers.dev --repo <owner>/toko-demo …`. Simpan token keluaran di password manager tim, bukan di repo atau chat publik.
    - Uji dari luar: `curl https://…/healthz`, `npx wscat -c wss://…/ws`.
14. Commit `fase-03: server core on Cloudflare (Worker + Durable Object, SQLite, auth, events, files, ws)`.

## Tambahan v0.3

- Repo DB untuk token bernama `db/repo/access.ts` (bukan `token.ts`, R5 §8). Tabel SQL `token` boleh tetap.
- Hub WS menerima `client: "app"` (token member, read-only `state` + `event`). Relay `term.*` dikerjakan di fase 06, juga di dalam DO yang sama.
- Deploy pertama sebelum tidur, supaya Aarief dan Imelda bisa konek ke staging saat Sinkron 1.

## Verifikasi

```bash
pnpm -C radar --filter @radar/server test                 # vitest-pool-workers (DO + SQLite lokal)
pnpm -C radar --filter @radar/server exec wrangler dev &  # server lokal di http://localhost:8787
ADMIN_SECRET=dev pnpm -C radar admin init --server http://localhost:8787 --repo <owner>/toko-demo \
  --member "A:coder:Alice:alice@example.com" --member "B:coder:Budi:budi@example.com" \
  --member "C:pm:Citra:citra@example.com"
curl -s localhost:8787/healthz
curl -s https://live-collab.<akun>.workers.dev/healthz   # setelah deploy
```

## Kriteria selesai (DoD)

- [ ] Semua test integrasi di langkah 12 hijau.
- [ ] SV-01: update diterima menaikkan versi dan tersebar ke klien lain (bukti test).
- [ ] SV-08: setiap kejadian tercatat dan `GET /v1/events/export` berfungsi (bukti test).
- [ ] Token hanya tersimpan sebagai hash; log tidak berisi token (grep log test).
- [ ] Worker ter-deploy di Cloudflare, `/healthz` hijau, WebSocket bisa dihubungi dari luar (`wscat -c wss://…/ws`), dan tetap tersambung > 5 menit tanpa aktivitas (hibernasi).

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Belum familiar Durable Objects | Muat skill `durable-objects` + `workers-best-practices`. Contoh resmi "chat room WebSocket hibernation" menjadi pola dasar hub. |
| Kuota Workers Free (100k request/hari, pesan WS masuk dihitung 20:1) habis saat uji beban | Batasi frame terminal (fase 06). Kalau tetap kurang, upgrade Workers Paid ($5/bulan). Catat D-alief-.. |
| Batas CPU plan gratis ternyata lebih ketat untuk DO | Pindahkan kerja berat (diff besar) ke langkah async, atau upgrade Paid |
| Fitur Node tidak tersedia di workerd | `nodejs_compat`, dan hindari paket native (tidak ada `better-sqlite3`, `simple-git`, `fs`) |
| Cloudflare down atau akun bermasalah saat demo | Fallback: jalankan `wrangler dev` di satu laptop + `cloudflared tunnel --url http://localhost:8787` (kode sama persis) |

## Catatan handoff

- Fase 04 memakai: protokol WS, `seedTestWorkspace()` untuk test integrasi sync.
- Fase 05 mengganti `authorizeWrite` dengan `locks.checkWrite` dan melengkapi `/v1/state`.
- Bagikan URL Worker + token A/B/C/mc ke tim lewat kanal privat (bukan repo).
- Fase 06: commit per task lewat GitHub API (Octokit) di dalam DO. Tidak ada binary `git`.
