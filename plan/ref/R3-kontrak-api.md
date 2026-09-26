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
| `POST /v1/locks/check`, `GET /v1/brief`, `GET /v1/tasks`, `GET /v1/blocks/last`, `POST /v1/tasks/:id/submit`, `POST /v1/requests`, `GET /v1/activity`, `POST /v1/tasks/:id/activate`, `POST /v1/ai-edits` | ✅ | `brief`, `activity`, dan `locks/check` saja (`locks/check` untuk pm selalu `block` · `pm_readonly`, R4 §2) | ❌ |
| `GET /v1/team`, `GET /v1/requests`, `POST /v1/proposals`, `GET /v1/proposals`, `GET /v1/tasks/:id/diff`, `POST /v1/notify`, `GET /v1/report/session` | ❌ | ✅ | ✅ (baca) |
| `POST /v1/proposals/:id/decision`, `POST /v1/locks/revoke`, `POST /v1/tasks/:id/cancel` | ❌ | ❌ **(MA-07)** | ✅ |
| `POST /v1/bob/activity` (§2.24, P0) | ✅ | ✅ | ❌ |
| `GET /v1/state`, `GET /v1/files/history` | ✅ read-only (dipakai app coder, §3.9) | ✅ | ✅ |
| `GET /v1/events/export`, `GET /healthz` | ✅ | ✅ | ✅ (export juga tanpa auth bila `PUBLIC_EXPORT=true`) |

Klien WebSocket `app` dengan token coder menerima `state` + `event` read-only (§3.9). Itu konsisten dengan baris `GET /v1/state` di atas: coder boleh membaca, tidak boleh memutuskan.

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
- `reason` ∈ `own` · `grabbed` · `held_by_other` · `reserved_by_other` · `in_review_by_other` · `committing` (commit task pemegang sedang berjalan, R4 §6.3) · `pm_readonly` · `ignored_path`.
- `ignored_path` (mis. `node_modules/…`, `.radar/…`) → `allow`, tanpa kunci.
- Logika lengkap: R4 §3. Latensi server dicatat ke `metric(lock_check_ms)`.
- **Jalur `message` ke model: stderr hook exit 2 (terbukti, D-umar-01 poin 2).** Di Bob IDE 2.2.0 stderr `PreToolUse` yang exit 2 sampai ke model; Bob mengutip pesannya dan tidak mencoba ulang (spike fase 01 uji 2). Docs lifecycle hooks menyebut stderr hanya ke log, jadi desain tetap punya tiga jalur cadangan: (1) instruksi mode `coder` + rules `.bob/rules-coder/`: "kalau tool edit ditolak, panggil `radar why_blocked` dulu" (tool ini ada di `alwaysAllow` `.bob/mcp.json`, jadi jalan tanpa klik approve; terbukti di uji 17); (2) server mencatat `block` sehingga `why_blocked` dan baris pertama brief `UserPromptSubmit` berikutnya memuatnya (stdout `UserPromptSubmit` masuk konteks, R4 §8); (3) lapis kedua sync (`file.rejected`). JSON keputusan di stdout tetap diabaikan (uji 2b). Kontrak hook = **exit 2 memblok**, exit 0 mengizinkan.
- **Timeout hook.** Settings memberi `timeout` eksplisit (3 s untuk `PreToolUse`, default Bob 10 s). Hook sendiri menyerah ke server setelah 1,5 s (`HOOK_SERVER_TIMEOUT_MS`) dan fail-open. Perilaku Bob saat hook melewati `timeout` diuji di spike 19.

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

### 2.24 `POST /v1/bob/activity` — hook Bob (JT-01, v0.3)

Dipanggil hook kit coder/PM secara fire-and-forget (timeout 800 ms, gagal = diam). Role: coder, pm.

```json
{ "kind": "prompt" | "tool.pre" | "tool.post" | "turn.end" | "session.start",
  "sessionId": "…", "mode": "coder" | "pm-lead" | "…",
  "tool": "write_file" | "apply_diff" | "read_file" | "…",       // untuk tool.*
  "paths": ["src/checkout/checkout.ts"],                          // relatif workspace
  "decision": "allow" | "block",                                  // untuk tool.pre (dari hasil /v1/locks/check)
  "linesChanged": 12,                                             // untuk tool.post, bila bisa dihitung
  "text": "tambahkan kupon diskon di checkout",                   // prompt ringkas ≤ 200 char (hanya bila shareprompts=on)
  "clientTs": 1790000000000 }                                     // opsional; server tidak menyimpannya di event
```
Respons `204`. Server menulis event `bob.activity { memberId, …field di atas tanpa isi file }` dan menyiarkannya ke klien `app`/`mc`. Dibatasi 20 event/detik per member: sisanya dibuang (tetap `204`) dan dihitung di `metric(activity_dropped)`. Isi file **tidak pernah** dikirim.

Sumber tiap `kind` (menurut docs lifecycle hooks Bob; dikonfirmasi spike fase 01):

| kind | Hook | Isi yang tersedia |
|---|---|---|
| `session.start` | `SessionStart` | metadata sesi |
| `prompt` | `UserPromptSubmit` | session ID + teks prompt (dikirim hanya bila `shareprompts=on`) |
| `tool.pre` | `PreToolUse` (hook `lock_guard` yang sama) | nama tool + input → `paths`, `decision` |
| `tool.post` | `PostToolUse` | data tool + output → `paths`, `linesChanged` bila bisa dihitung |
| `turn.end` | `Stop` | session ID. Payload `Stop` membawa `last_assistant_message`, tetapi hook **tidak** mengirimnya (privasi, D-alief-01 poin 9; D-umar-01 P4). |

- `mode` tidak dijamin ada di payload hook. Hook mengisinya dari kit yang terpasang (`.radar/local.json` `role` → `coder`/`pm-lead`).
- Field payload hook bertanda **provisional** sampai fixture spike 1 (Sab 04:00). Perubahan nama field dilakukan di jendela ubah kontrak fase 02 (04:00–04:30), bukan sesudahnya.
- Endpoint ini dibangun di **fase 03** (bukan fase 06), karena app (fase 11a) dan milestone butuh jalur ini lebih dulu.

## 3. WebSocket `wss://<server>/ws`

Amplop setiap pesan: `{ "t": "<tipe>", "id"?: "<id pesan klien>", "d": { ... } }`.

| Pesan | Arah | `d` |
|---|---|---|
| `hello` | klien → server | `{ token, client: "sync" \| "mc" \| "app", clientVersion, knownVersions?: { [path]: version } }` |
| `welcome` | server → klien | `{ principal, serverTime, workspace }` |
| `snapshot` | server → sync | `{ files: [ { path, version, hash, content, deleted } ], locks: [...], cursor }` (kalau `knownVersions` dikirim: hanya file yang beda) |
| `state` | server → mc | isi `GET /v1/state` |
| `file.update` | sync → server | `{ path, baseVersion, content, hash, clientTs }` |
| `file.delete` | sync → server | `{ path, baseVersion, clientTs }` (P1) |
| `file.ack` | server → pengirim | `{ id, path, version, hash }` |
| `file.changed` | server → semua sync lain | `{ path, version, content, hash, deleted, by, taskId, serverTs }` |
| `file.applied` | sync → server | `{ path, version, serverTs, appliedTs }` (untuk metrik sinkron) |
| `file.rejected` | server → pengirim | `{ id, path, reason: "held_by_other" \| "committing" \| "pm_readonly" \| "conflict" \| "too_large" \| "binary", holder?, server: { version, hash, content, deleted } }` |
| `lock.changed` | server → semua | `{ path, state: "bebas" \| "dipesan" \| "dipegang" \| "review", taskId, memberId, queue: [taskId…] }` |
| `event` | server → mc | satu `RadarEvent` (§5) — MC menerapkan reducer |
| `notice` | server → sync tertentu | `{ level: "info" \| "warn", message }` (ditampilkan di terminal coder) |
| `proposal.new` / `proposal.decided` | server → mc | `{ proposal }` (juga dikirim sebagai `event`) |
| `heartbeat` | sync → server | `{ ts }` setiap 15 s (SY-05) |
| `ping` / `pong` | dua arah | keepalive 20 s. Klien mengirim string persis `{"t":"ping"}` (tanpa `id`/`d`, tanpa spasi); server menjawab `{"t":"pong"}` lewat `setWebSocketAutoResponse` tanpa membangunkan DO |
| `error` | server → klien | `{ code, message }` lalu tutup untuk `UNAUTHORIZED` |

Aturan koneksi: `hello` harus dikirim ≤ 5 s setelah terhubung; kalau tidak, server menutup koneksi (4401). Satu member boleh punya satu koneksi `sync` aktif (koneksi baru menggantikan lama, event `member.reconnected`).

### 3.9 Klien `app` dan relay terminal `term.*` (v0.3, JT-04/05, **P1**; aktivitas Bob IDE lewat §2.24 adalah P0)

**Klien `app`.** App desktop coder terhubung dengan `hello { token: <token member>, client: "app" }`. Server membalas `state` (sama seperti `mc`, read-only) dan meneruskan `event`. App PM memakai `client: "mc"` dengan token mc (satu-satunya yang boleh memanggil endpoint persetujuan). Satu member boleh punya satu koneksi `sync` **dan** satu koneksi `app` sekaligus.

| Pesan | Arah | `d` | Aturan |
|---|---|---|---|
| `term.share` | app host → server | `{ termId, title, agent: "bob" \| string, cols, rows }` | `termId` = `<member>-<nanoid6>`. Event `term.shared` di log. |
| `term.unshare` | app host → server | `{ termId }` | Server mengirim `term.ended` ke semua penonton dan menghapus buffer. |
| `term.list` | server → app/mc | `{ terms: [ { termId, member, title, agent, viewers: [member…], guest?: member } ] }` | Dikirim saat berubah. |
| `term.subscribe` / `term.unsubscribe` | penonton → server | `{ termId }` | Hanya anggota workspace yang sama. Server mengirim `term.snapshot` lalu `term.frame` berikutnya. |
| `term.snapshot` | host → server; server → penonton | `{ termId, seq, data }` (hasil `@xterm/addon-serialize`, ≤ 256 KB) | Host mengirim snapshot setiap kali ada penonton baru (server meminta lewat `term.need_snapshot { termId }`). |
| `term.frame` | host → server → penonton | `{ termId, seq, data: base64, ts }` | Maks 32 KB per frame. Host menggabungkan output 16 ms. Server menyimpan ring buffer 256 KB per terminal untuk penonton terlambat. |
| `term.resize` | host → server → penonton | `{ termId, cols, rows }` | – |
| `term.ended` | server → penonton | `{ termId, reason: "unshared" \| "host_offline" }` | – |
| `term.input.request` | penonton → server → host | `{ termId, guest }` | P1 |
| `term.input.grant` / `term.input.revoke` | host → server → penonton | `{ termId, guest, until }` | P1. Maks 10 menit. Event di log. |
| `term.input` | penonton → server → host | `{ termId, guest, data }` | P1. Server menolak (`error TERM_NO_GRANT`) kalau grant tidak aktif. Host memvalidasi ulang. |

- Frame **tidak** disimpan ke DB, kecuali env `RECORD_TERMINALS=true` (hanya saat merekam demo). Frame yang direkam masuk tabel `term_frame(term_id, seq, ts, data)` untuk diekspor ke replay (`GET /v1/events/export?withTerminals=true`).
- Metrik: `term.latency` = `serverTs(forward) - ts` dan `viewerTs - ts` (dilaporkan penonton lewat `term.ack { termId, seq, viewerTs }` setiap 50 frame).
- Kode error baru: `TERM_NOT_FOUND`, `TERM_NOT_OWNER`, `TERM_NO_GRANT`, `TERM_FRAME_TOO_LARGE`.

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
| `member.created` / `member.online` / `member.offline` / `member.reconnected` | `{ memberId }` | MC header "<n> PC terhubung" |
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
| `bob.activity` | `{ memberId, kind, sessionId, mode, tool?, paths?, decision?, linesChanged?, text? }` (§2.24) | **P0**: timeline "Watching <nama>'s Bob" (JT-01/02), status writing/blocked di Team |
| `ai.edit` | `{ memberId, paths, tool }` | BC-05 |
| `bob.turn` | `{ memberId }` (tanpa ringkasan: hook `Stop` hanya membawa session ID) | BC-06 (P2) |
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
  bobActivity: Record<string, BobActivityItem[]>; // memberId → maks 100 bob.activity terbaru (P0, JT-01)
  cursor: number;                             // id event terakhir yang diterapkan
}
export function initialState(): RadarState;
export function applyEvent(state: RadarState, ev: RadarEvent): RadarState;   // murni, tanpa I/O
export function applyEvents(state: RadarState, evs: RadarEvent[]): RadarState;
```
`writingUntil = ev.ts + 3000` pada `file.changed` → UI menampilkan ✎ selama `now < writingUntil` (UI-02). Replay memakai `ts` event, bukan jam dinding.
`bob.activity` masuk ke `bobActivity[memberId]` (bukan ke `feed`, supaya feed tidak banjir). `tool.pre` dengan `decision: "block"` juga menandai member sebagai `blocked` di `MemberView` sampai `tool.pre` berikutnya yang `allow`.

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
