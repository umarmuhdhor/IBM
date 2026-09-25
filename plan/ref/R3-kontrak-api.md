# R3 — Kontrak API: REST, WebSocket, event, tool MCP

> Semua body divalidasi dengan zod di `@radar/common/schemas.ts`. Server, sync agent, hook, radar-mcp, dan Mission Control **mengimpor schema yang sama**. Contoh di bawah adalah bentuk final.

## 1. Umum

- Base URL: `https://<server>/` (dev: `http://localhost:8787/`).
- Auth: header `Authorization: Bearer <token>`. Server mengubah token menjadi `principal`:
  - `{ kind: "member", memberId: "A", role: "coder" }`
  - `{ kind: "member", memberId: "C", role: "pm" }`
  - `{ kind: "mc" }` (Mission Control, dipegang manusia PM di browser)
- Content-Type: `application/json`. Waktu: epoch ms. Path: POSIX relatif workspace.
- Format error:

```json
{ "error": { "code": "FORBIDDEN", "message": "Hanya Mission Control yang dapat menyetujui usulan." } }
```

| HTTP | code | Kapan |
|---|---|---|
| 400 | `BAD_REQUEST` | JSON rusak |
| 401 | `UNAUTHORIZED` | Token hilang/salah/dicabut |
| 403 | `FORBIDDEN` | Role tidak berhak (mis. PM memanggil decision, coder memanggil proposals) |
| 404 | `NOT_FOUND` | Task/proposal/request/file tidak ada |
| 409 | `CONFLICT` | Transisi status tidak sah (mis. submit task yang sudah `selesai`, keputusan untuk proposal yang bukan `menunggu`) |
| 422 | `VALIDATION` | Gagal zod / aturan bisnis (mis. rencana dengan file tumpang tindih tanpa tanda antre) |
| 500 | `INTERNAL` | Lainnya (dicatat, tanpa stack ke klien) |

### Matriks otorisasi

| Endpoint | coder | pm (main agent) | mc |
|---|:-:|:-:|:-:|
| `POST /v1/locks/check`, `GET /v1/brief`, `GET /v1/tasks`, `GET /v1/blocks/last`, `POST /v1/tasks/:id/submit`, `POST /v1/requests`, `GET /v1/activity`, `POST /v1/tasks/:id/activate`, `POST /v1/ai-edits` | ✅ | brief & activity saja | ❌ |
| `GET /v1/team`, `GET /v1/requests`, `POST /v1/proposals`, `GET /v1/proposals`, `GET /v1/tasks/:id/diff`, `POST /v1/notify`, `GET /v1/report/session` | ❌ | ✅ | ✅ (baca) |
| `POST /v1/proposals/:id/decision`, `POST /v1/locks/revoke`, `POST /v1/tasks/:id/cancel` | ❌ | ❌ **(MA-07)** | ✅ |
| `GET /v1/state`, `GET /v1/files/history` | ❌ | ✅ | ✅ |
| `GET /v1/events/export`, `GET /healthz` | ✅ | ✅ | ✅ (export juga tanpa auth bila `PUBLIC_EXPORT=true`) |

## 2. REST endpoint

### 2.1 `GET /healthz`
`200 { "ok": true, "workspace": "toko-demo", "version": "0.2.0", "uptimeMs": 12345 }`

### 2.2 `POST /v1/locks/check` — hook PreToolUse (SV-02)

Request:
```json
{
  "paths": ["src/checkout/checkout.ts"],
  "tool": "apply_diff",
  "sessionId": "bob-session-uuid-or-null",
  "clientTs": 1790000000000
}
```
Response `200`:
```json
{
  "decision": "block",
  "results": [
    {
      "path": "src/checkout/checkout.ts",
      "decision": "block",
      "reason": "held_by_other",
      "holder": { "memberId": "A", "memberName": "Alice", "taskId": "T-1", "taskTitle": "Kupon", "state": "dipegang" },
      "requestId": "R-3",
      "queuePos": null
    }
  ],
  "activeTaskId": "T-2",
  "message": "RADAR: src/checkout/checkout.ts sedang dipegang Bob milik Alice (T-1 Kupon). Edit dibatalkan. Jangan coba ulang dan jangan ubah lewat shell. Panggil radar why_blocked, beri tahu user, lalu kerjakan bagian lain dari task T-2.",
  "serverMs": 4
}
```
- `decision` total = `block` kalau salah satu path `block`.
- `reason` ∈ `own` · `grabbed` · `held_by_other` · `reserved_by_other` · `in_review_by_other` · `pm_readonly` · `ignored_path`.
- `ignored_path` (mis. `node_modules/…`, `.radar/…`) → `allow`, tanpa kunci.
- Logika lengkap: R4 §3. Latensi server dicatat ke `metric(lock_check_ms)`.

### 2.3 `GET /v1/brief?kind=start|prompt&since=<eventId>[&peek=true]` — hook SessionStart / UserPromptSubmit (BC-02, BC-03)

Endpoint ini tidak menyimpan state di server (cursor disimpan hook di `.radar/state.json`), jadi `peek=true` hanya penanda bahwa pemanggil bukan hook (dipakai tampilan coder UI-07) dan tidak dicatat di metrik.

Response `200`:
```json
{
  "lines": [
    "[Radar] Kamu A (coder). Task aktif: T-2 Dark mode (dikerjakan).",
    "[Radar] File kamu: src/ui/theme.css, src/ui/Header.tsx",
    "[Radar] Dipegang orang lain: src/checkout/checkout.ts→A(T-1), src/routes.ts→A(T-1)",
    "[Radar] Keputusan PM: kamu antre src/checkout/checkout.ts setelah T-1.",
    "[Radar] Berubah sejak prompt lalu: src/checkout/checkout.ts (A, v9).",
    "[Radar] Catatan PM: calculateTotal() kini butuh parameter ongkir."
  ],
  "cursor": 1289
}
```
- Maksimal **6 baris**, tiap baris ≤ 160 karakter (`clampBrief`). Aturan isi & prioritas: R4 §8.
- `kind=start`: identitas + task + file + pemegang lain (tanpa `since`).
- `kind=prompt`: hanya baris yang berubah sejak `since` (keputusan, notifikasi, file berubah oleh rekan, kunci baru), ditambah 1 baris task aktif. Kalau tidak ada yang baru → `lines: []` (hook tidak mencetak apa-apa, hemat Bobcoin).

### 2.4 `GET /v1/tasks?owner=A&status=open` — MCP `my_tasks`

`owner` default = pemanggil. `status=open` = `terbuka|dikerjakan|review`; `status=all` semua.
```json
{
  "tasks": [
    {
      "id": "T-2", "title": "Dark mode", "description": "…", "ownerId": "B", "status": "dikerjakan",
      "adhoc": false, "baseCommit": "3f9a2c1", "editCount": 7,
      "files": [
        { "path": "src/ui/theme.css", "lock": "dipegang", "queuePos": 0 },
        { "path": "src/checkout/checkout.ts", "lock": null, "queuePos": 1, "waitingFor": "T-1" }
      ]
    }
  ],
  "activeTaskId": "T-2"
}
```

### 2.5 `POST /v1/tasks/:id/activate` — set task aktif (dipakai `radar task use`, dan otomatis oleh check)
`200 { "activeTaskId": "T-2" }`. Hanya pemilik task. Task harus `terbuka|dikerjakan`.

### 2.6 `GET /v1/blocks/last` — MCP `why_blocked`
```json
{
  "block": {
    "path": "src/checkout/checkout.ts", "ts": 1790000000000, "via": "hook",
    "holder": { "memberId": "A", "memberName": "Alice", "taskId": "T-1", "taskTitle": "Kupon", "state": "dipegang", "sinceMs": 420000 },
    "requestId": "R-3", "requestStatus": "terbuka",
    "queue": [ { "taskId": "T-1", "memberId": "A" }, { "taskId": "T-2", "memberId": "B" } ],
    "suggestion": "File ini milik T-1. Permintaanmu R-3 sudah masuk antrean PM. Lanjutkan file lain di task T-2: src/ui/Header.tsx."
  }
}
```
`block: null` kalau belum pernah diblokir. `suggestion` dibuat server: daftar file task aktif pemanggil yang milik sendiri dan belum disentuh/masih bisa ditulis.

### 2.7 `POST /v1/requests` — MCP `request_file`
Request `{ "path": "src/routes.ts", "reason": "Butuh rute /coupon" }` → `201 { "requestId": "R-4", "status": "terbuka", "duplicate": false }`.
Kalau file bebas → `200 { "requestId": null, "status": "bebas", "message": "File bebas, langsung edit saja." }`. Duplikat → kembalikan request aktif yang ada dengan `duplicate: true`.

### 2.8 `GET /v1/activity?path=&limit=20` — MCP `team_activity`
```json
{ "items": [ { "ts": 1790000000000, "actor": "A", "type": "file.changed", "path": "src/checkout/checkout.ts", "summary": "A mengubah checkout.ts (v9, T-1)" } ] }
```

### 2.9 `POST /v1/tasks/:id/submit` — MCP `submit_task`
Request `{ "summary": "Kupon diskon persen + validasi kode" }`.
`200 { "taskId": "T-1", "status": "review", "files": ["src/checkout/checkout.ts", "src/checkout/coupon.ts"] }`.
Aturan: hanya pemilik; status harus `dikerjakan` (atau `terbuka` dengan ≥1 touch); semua lock task → state `review` (kunci TETAP dipegang). `409` kalau tidak ada file yang diubah.

### 2.10 `GET /v1/team` — MCP `team_status`
```json
{
  "members": [ { "id": "A", "name": "Alice", "role": "coder", "online": true, "lastHeartbeatMs": 3200, "activeTaskId": "T-1" } ],
  "tasks": [ { "id": "T-1", "title": "Kupon", "ownerId": "A", "status": "dikerjakan", "files": ["…"], "editCount": 14 } ],
  "locks": [ { "path": "src/checkout/checkout.ts", "taskId": "T-1", "memberId": "A", "state": "dipegang", "queue": ["T-2"] } ],
  "openRequests": 1, "pendingProposals": 2, "headCommit": "3f9a2c1"
}
```

### 2.11 `GET /v1/requests?status=terbuka` — MCP `list_requests`
```json
{
  "requests": [
    {
      "id": "R-3", "path": "src/checkout/checkout.ts", "status": "terbuka", "source": "hook", "reason": "",
      "requester": { "memberId": "B", "taskId": "T-2", "taskTitle": "Dark mode", "taskDescription": "…" },
      "holder": { "memberId": "A", "taskId": "T-1", "taskTitle": "Kupon", "taskDescription": "…", "state": "dipegang", "editCount": 14 },
      "fileVersion": 9, "createdAt": 1790000000000
    }
  ]
}
```

### 2.12 `POST /v1/proposals` — MCP main agent (MA-02/03/04)
Request umum: `{ "kind": "plan"|"decision"|"review", "payload": {...}, "reason": "satu kalimat" }` → `201 { "proposalId": "P-5", "status": "menunggu" | "diterapkan_otomatis" }`.
Status awal **selalu** `menunggu`, kecuali `decision` dengan `option: "antre"` dan `AUTO_APPLY_QUEUE=true` → langsung diterapkan, status `diterapkan_otomatis` (PRD §7.3). Payload per jenis: §4.

### 2.13 `GET /v1/proposals?status=menunggu` — MC & main agent
`{ "proposals": [ { "id": "P-5", "kind": "review", "status": "menunggu", "payload": {...}, "reason": "…", "refId": "T-0", "createdAt": … } ] }`

### 2.14 `POST /v1/proposals/:id/decision` — **hanya token `mc`** (MA-07)
Request `{ "approve": true, "note": "ok" }` → `200 { "proposalId": "P-5", "status": "disetujui", "applied": { ... ringkasan efek ... } }`.
`403` untuk token member mana pun (termasuk PM). `409` kalau status bukan `menunggu`. Efek: R4 §6.

### 2.15 `GET /v1/tasks/:id/diff` — MCP `get_task_diff` (MA-04)
```json
{
  "taskId": "T-0", "title": "Setup ongkir", "ownerId": "A", "status": "review", "baseCommit": "3f9a2c1", "summary": "…",
  "files": [
    { "path": "src/checkout/checkout.ts", "change": "modified", "fromVersion": 3, "toVersion": 12,
      "patch": "--- a/src/checkout/checkout.ts\n+++ b/src/checkout/checkout.ts\n@@ …",
      "exportsChanged": [ { "name": "calculateTotal", "kind": "function", "before": "calculateTotal(items: Item[])", "after": "calculateTotal(items: Item[], shipping: number)" } ] }
  ],
  "importers": [
    { "path": "src/ui/Header.tsx", "imports": "src/checkout/checkout.ts", "symbols": ["calculateTotal"], "lines": [14],
      "holder": { "memberId": "B", "taskId": "T-2", "state": "dipegang" } }
  ],
  "truncated": false
}
```
Batas: total patch ≤ 60 KB (sisanya `truncated: true`). Algoritma importer: fase 06.

### 2.16 `POST /v1/notify` — MCP `notify` (MA-05)
Request `{ "memberId": "B", "message": "calculateTotal() kini butuh parameter ongkir." }` → `201 { "notificationId": 17 }`. Muncul di brief `prompt` berikutnya milik B. Pesan ≤ 200 karakter.

### 2.17 `GET /v1/report/session?from=&to=` — MCP `session_report` (MA-06, P1)
`{ "markdown": "## Laporan sesi …", "stats": { "tasks": 3, "commits": 2, "blocks": 4, "decisions": 3, "medianBlockToDecisionMs": 41000, "syncP95Ms": 420, "lockCheckP95Ms": 38 } }`

### 2.18 `POST /v1/locks/revoke` — hanya `mc` (SV-09)
Request `{ "path": "src/routes.ts", "reason": "PC A mati 5 menit" }` → `200 { "path": "src/routes.ts", "nextHolder": { "taskId": "T-3", "memberId": "B" } | null }`.

### 2.19 `POST /v1/tasks/:id/cancel` — hanya `mc`
Task `terbuka|draf|dikerjakan` → `batal`; kunci & alokasi dilepas (R4 §5). `409` untuk `review|selesai`.

### 2.20 `POST /v1/ai-edits` — hook PostToolUse (BC-05, P1)
Request `{ "paths": ["src/ui/theme.css"], "tool": "write_file", "sessionId": "…" }` → `204`. Menandai versi terbaru file tersebut (`file_version.ai=1`) dan menulis event `ai.edit`.

### 2.21 `GET /v1/state` — snapshot Mission Control
```json
{
  "workspace": { "id": "toko-demo", "name": "toko-demo", "headCommit": "3f9a2c1", "repoUrl": "https://github.com/…" },
  "members": [...], "tasks": [...], "locks": [...], "allocations": [...],
  "files": [ { "path": "src/ui/theme.css", "version": 12, "updatedBy": "B", "updatedAt": … } ],
  "requests": [...], "proposals": [...], "recentEvents": [ /* 100 event terakhir */ ],
  "cursor": 1289
}
```
Isi file TIDAK dikirim (hemat). Bentuk `state` = bentuk `RadarState` di reducer (§6).

### 2.22 `GET /v1/files/history?path=&limit=5` — diff viewer (UI-06)
`{ "path": "…", "versions": [ { "version": 12, "by": "A", "taskId": "T-1", "ai": true, "ts": …, "patch": "…" } ] }` (patch terhadap versi sebelumnya).

### 2.23 `GET /v1/events/export?from=<id>&to=<id>` — replay (SV-08)
`200 { "workspace": "toko-demo", "exportedAt": …, "events": [ { "id": 1, "ts": …, "actor": "server", "type": "workspace.created", "payload": {…} } ] }`.
Payload `file.changed` di export **menyertakan patch**, bukan isi utuh (ukuran kecil, cukup untuk diff viewer replay).

## 3. WebSocket `wss://<server>/ws`

Amplop setiap pesan: `{ "t": "<tipe>", "id"?: "<id pesan klien>", "d": { ... } }`.

| Pesan | Arah | `d` |
|---|---|---|
| `hello` | klien → server | `{ token, client: "sync" \| "mc", clientVersion, knownVersions?: { [path]: version } }` |
| `welcome` | server → klien | `{ principal, serverTime, workspace }` |
| `snapshot` | server → sync | `{ files: [ { path, version, hash, content, deleted } ], locks: [...], cursor }` (kalau `knownVersions` dikirim: hanya file yang beda) |
| `state` | server → mc | isi `GET /v1/state` |
| `file.update` | sync → server | `{ path, baseVersion, content, hash, clientTs }` |
| `file.delete` | sync → server | `{ path, baseVersion, clientTs }` (P1) |
| `file.ack` | server → pengirim | `{ id, path, version, hash }` |
| `file.changed` | server → semua sync lain | `{ path, version, content, hash, deleted, by, taskId, serverTs }` |
| `file.applied` | sync → server | `{ path, version, serverTs, appliedTs }` (untuk metrik sinkron) |
| `file.rejected` | server → pengirim | `{ id, path, reason: "held_by_other" \| "pm_readonly" \| "conflict" \| "too_large" \| "binary", holder?, server: { version, hash, content, deleted } }` |
| `lock.changed` | server → semua | `{ path, state: "bebas" \| "dipesan" \| "dipegang" \| "review", taskId, memberId, queue: [taskId…] }` |
| `event` | server → mc | satu `RadarEvent` (§5) — MC menerapkan reducer |
| `notice` | server → sync tertentu | `{ level: "info" \| "warn", message }` (ditampilkan di terminal coder) |
| `proposal.new` / `proposal.decided` | server → mc | `{ proposal }` (juga dikirim sebagai `event`) |
| `heartbeat` | sync → server | `{ ts }` setiap 15 s (SY-05) |
| `ping` / `pong` | dua arah | keepalive 20 s |
| `error` | server → klien | `{ code, message }` lalu tutup untuk `UNAUTHORIZED` |

Aturan koneksi: `hello` harus dikirim ≤ 5 s setelah terhubung; kalau tidak, server menutup koneksi (4401). Satu member boleh punya satu koneksi `sync` aktif (koneksi baru menggantikan lama, event `member.reconnected`).

## 4. Payload proposal

### 4.1 `plan` (MA-02)
```json
{
  "goal": "Tambah fitur kupon dan dark mode",
  "tasks": [
    {
      "ref": "t1", "title": "Kupon diskon", "description": "Tambah kode kupon persen di checkout",
      "ownerId": "A",
      "files": ["src/checkout/checkout.ts", "src/checkout/coupon.ts"],
      "queuedFiles": []
    },
    {
      "ref": "t2", "title": "Dark mode", "description": "Toggle tema gelap di header",
      "ownerId": "B",
      "files": ["src/ui/theme.css", "src/ui/Header.tsx"],
      "queuedFiles": ["src/routes.ts"]
    }
  ]
}
```
Validasi server (422 kalau gagal): `ownerId` harus coder; sebuah path hanya boleh muncul di `files` **satu** task; path yang dibutuhkan >1 task harus ada di `files` satu task dan di `queuedFiles` task lain (urutan antre = urutan task di array); maksimal 8 task, 20 file per task; path dinormalisasi. File boleh belum ada (file baru).

### 4.2 `decision` (MA-03)
```json
{ "requestId": "R-3", "option": "antre" | "pindahkan" | "pecah",
  "newTask": { "title": "Rute kupon di routes.ts", "description": "…", "ownerId": "B" } }
```
`newTask` wajib hanya untuk `pecah`.

### 4.3 `review` (MA-04)
```json
{ "taskId": "T-0", "verdict": "setujui" | "setujui_beri_tahu" | "kembalikan",
  "notes": "calculateTotal() kini menerima parameter ongkir.",
  "notify": [ { "memberId": "B", "message": "calculateTotal() kini butuh parameter ongkir; Header.tsx baris 14 perlu diperbarui." } ],
  "flags": [ { "path": "src/ui/Header.tsx", "issue": "Memanggil calculateTotal() dengan 1 argumen" } ] }
```
`flags` tidak kosong → server menulis event `review.flagged` (metrik PRD §04).

## 5. Katalog event (`event.type`)

Semua event punya `{ id, ts, actor, type, payload }`. Payload minimal:

| type | payload | Dipakai |
|---|---|---|
| `workspace.created` | `{ workspaceId, headCommit, fileCount }` | replay |
| `member.created` / `member.online` / `member.offline` / `member.reconnected` | `{ memberId }` | MC header "3 PC terhubung" |
| `member.stale` | `{ memberId, lastHeartbeat }` | SV-09 peringatan |
| `file.changed` | `{ path, version, hash, by, taskId, size, patch? }` | feed, penanda ✎ 3 s, diff |
| `file.deleted` | `{ path, version, by, taskId }` | P1 |
| `file.rejected` | `{ path, by, reason, holderMemberId, holderTaskId }` | feed, SY-04 |
| `sync.applied` | `{ path, version, memberId, latencyMs }` | metrik (tidak tampil di feed) |
| `lock.reserved` | `{ path, taskId, memberId, source }` | pohon file |
| `lock.acquired` | `{ path, taskId, memberId, auto: boolean }` | pohon file; `auto=true` → info ke main agent |
| `lock.review` | `{ path, taskId }` | pohon file |
| `lock.released` | `{ path, taskId }` | pohon file |
| `lock.transferred` | `{ path, fromTaskId, toTaskId, toMemberId, cause: "queue" \| "decision" }` | pohon file, brief |
| `lock.queued` | `{ path, taskId, memberId, pos }` | pohon file "antre:B" |
| `lock.revoked` | `{ path, taskId, memberId, reason }` | SV-09 |
| `lock.blocked` | `{ path, memberId, taskId, holderMemberId, holderTaskId, via, requestId }` | feed "Bob B diblokir" |
| `hook.failopen` | `{ memberId, paths, errorKind }` | audit NFR-03 |
| `task.created` | `{ taskId, title, ownerId, status, files, queuedFiles, adhoc, parentTaskId? }` | board |
| `task.status` | `{ taskId, from, to, by }` | board |
| `task.submitted` | `{ taskId, summary, files }` | feed |
| `request.created` | `{ requestId, path, requesterMemberId, requesterTaskId, holderMemberId, holderTaskId, source }` | kartu keputusan, metrik |
| `request.decided` | `{ requestId, outcome, proposalId, auto }` | metrik blokir→keputusan |
| `proposal.created` | `{ proposalId, kind, refId, reason, payload }` | antrean keputusan |
| `proposal.decided` | `{ proposalId, kind, status, by, note }` | antrean keputusan |
| `review.created` | `{ reviewId, taskId, verdict }` | feed |
| `review.flagged` | `{ reviewId, taskId, flags }` | metrik |
| `notify.sent` | `{ notificationId, memberId, message, by }` | feed, brief |
| `commit.created` | `{ taskId, sha, author, files, pushed: boolean, url? }` | feed, board "Selesai 3f9a2c1" |
| `commit.push_failed` | `{ taskId, sha, error }` | feed (peringatan) |
| `ai.edit` | `{ memberId, paths, tool }` | BC-05 |
| `bob.turn` | `{ memberId, summary }` | BC-06 (P2) |
| `bob.said` | `{ memberId, text }` | hanya untuk replay (kutipan sesi Bob, disisipkan manual) |

## 6. Reducer bersama (`@radar/common/reducer.ts`)

```ts
export interface RadarState {
  workspace: { id: string; name: string; headCommit: string | null; repoUrl: string | null };
  members: Record<string, MemberView>;        // online, color, activeTaskId
  tasks: Record<string, TaskView>;            // status, files, editCount, commitSha
  locks: Record<string, LockView>;            // path → { taskId, memberId, state, queue: string[] }
  files: Record<string, FileView>;            // path → { version, updatedBy, updatedAt, writingUntil }
  requests: Record<string, RequestView>;
  proposals: Record<string, ProposalView>;
  feed: FeedItem[];                           // maks 200, terbaru di depan
  cursor: number;                             // id event terakhir yang diterapkan
}
export function initialState(): RadarState;
export function applyEvent(state: RadarState, ev: RadarEvent): RadarState;   // murni, tanpa I/O
export function applyEvents(state: RadarState, evs: RadarEvent[]): RadarState;
```
`writingUntil = ev.ts + 3000` pada `file.changed` → UI menampilkan ✎ selama `now < writingUntil` (UI-02). Replay memakai `ts` event, bukan jam dinding.

## 7. Kontrak tool MCP `radar-mcp`

Semua tool mengembalikan `{ content: [{ type: "text", text }] }`. Teks singkat Bahasa Indonesia, maksimal ±12 baris, diawali ringkasan satu baris; data mentah (kalau perlu) sebagai JSON ringkas di bawahnya. Role ditentukan dari `.radar/local.json` (`role`), tool yang didaftarkan hanya milik role itu.

| Tool | Role | Input (zod) | Endpoint |
|---|---|---|---|
| `my_tasks` | coder | `{}` | `GET /v1/tasks?owner=me&status=open` |
| `why_blocked` | coder | `{}` | `GET /v1/blocks/last` |
| `request_file` | coder | `{ path: string, reason: string }` | `POST /v1/requests` |
| `team_activity` | coder | `{ path?: string, limit?: number(1..50) }` | `GET /v1/activity` |
| `submit_task` | coder | `{ task_id: string, summary: string(≤500) }` | `POST /v1/tasks/:id/submit` |
| `team_status` | pm | `{}` | `GET /v1/team` |
| `propose_plan` | pm | `{ goal: string, tasks: PlanTask[], reason: string }` | `POST /v1/proposals` kind=plan |
| `list_requests` | pm | `{ status?: "terbuka" \| "diusulkan" \| "all" }` | `GET /v1/requests` |
| `propose_decision` | pm | `{ request_id, option: "antre" \| "pindahkan" \| "pecah", reason, new_task? }` | `POST /v1/proposals` kind=decision |
| `get_task_diff` | pm | `{ task_id }` | `GET /v1/tasks/:id/diff` |
| `propose_review` | pm | `{ task_id, verdict, notes, notify?, flags? }` | `POST /v1/proposals` kind=review |
| `notify` | pm | `{ member, message }` | `POST /v1/notify` |
| `session_report` | pm | `{}` | `GET /v1/report/session` (P1) |

**Tidak ada** tool `approve`, `decide`, `revoke`, atau apa pun yang memanggil endpoint khusus `mc` (MA-07). Test fase 08 memastikan daftar tool PM persis seperti tabel ini.
