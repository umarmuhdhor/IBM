# Fase 02 — `@radar/common` (kontrak dalam kode) + mock server

| Field | Nilai |
|---|---|
| Jalur | **Lane Alief** (Alief) · branch `lane/core`, PR ke `main`. Merge PR = **kontrak beku** (Sab ±02:30), lalu semua lane sinkron (PROMPT langkah 13). Satu jendela ubah kontrak lagi: Sab 04:00–04:30 (langkah 16). |
| Slot WITA | Sab 26 Sep 00:30 – 02:30 (+ jendela kontrak 04:00 – 04:30) |
| Estimasi | 1,5 jam |
| Prasyarat | 00 (fixture payload dari 01 boleh menyusul; pakai contoh sintetis dulu) |
| Requirement PRD | BC-04 (normalisasi dua bentuk payload), JT-01/JT-02 (skema `bob.activity`), UI-04/UI-05 (reducer bersama), NFR-06 (brief ≤ 6 baris) |
| Model | Sonnet 5 · effort medium |
| Fase berikutnya | 03 (Alief). Setelah fase ini Umar (07), Aarief (09/11) dan Imelda (11D) bisa bekerja melawan mock |

## Tujuan

Menerjemahkan kontrak R3/R4/R5 menjadi kode bersama yang diimpor semua paket, sehingga server, sync, hook, MCP, dan UI tidak mungkin berbeda bentuk data. Plus mock server yang meniru kontrak agar jalur Bob dan UI bisa jalan paralel sebelum server asli jadi.

## Bacaan wajib

- `plan/ref/R3-kontrak-api.md` (seluruhnya), `plan/ref/R4-mesin-kunci.md` §1–2, §8, `plan/ref/R5-konvensi.md` §4, §6
- `docs/spike-payloads/*.json` kalau sudah ada (fase 01)

## Output

- `packages/common/src/*` sesuai R1 §2 + test
- `scripts/mock-server.ts` + `scripts/mock-scenarios/demo.json`
- `packages/common/README.md` (daftar ekspor)

## Langkah kerja

1. **`constants.ts`** — semua konstanta R5 §4 (ekspor bernama, `as const`).

2. **`types.ts`** — tipe domain: `MemberId`, `Role = 'coder' | 'pm'`, `Principal`, `TaskStatus`, `LockState = 'dipesan' | 'dipegang' | 'review'`, `LockStateView = LockState | 'bebas'`, `RequestStatus`, `ProposalKind`, `ProposalStatus`, `ReviewVerdict`, `DecisionOption = 'antre' | 'pindahkan' | 'pecah'`, `CheckReason`, plus view object (`MemberView`, `TaskView`, `LockView`, `FileView`, `RequestView`, `ProposalView`, `FeedItem`). Semua string status persis seperti R2.

3. **`schemas.ts`** — zod untuk:
   - Setiap body request & response REST di R3 §2 (nama: `LockCheckReq`, `LockCheckRes`, `BriefRes`, `TasksRes`, `BlockLastRes`, `RequestFileReq`, `SubmitReq`, `TeamRes`, `RequestsRes`, `ProposalCreateReq` (discriminated union per `kind`), `DecisionReq`, `TaskDiffRes`, `NotifyReq`, `StateRes`, `ExportRes`, `ErrorRes`, `BobActivityReq` (R3 §2.24, `kind` discriminated: `session.start|prompt|tool.pre|tool.post|turn.end`)).
   - `CheckReason` mencakup `committing` (R4 §3 baris 12).
   - Payload proposal R3 §4 (`PlanPayload`, `DecisionPayload`, `ReviewPayload`) termasuk aturan: maks 8 task, maks 20 file/task, `newTask` wajib bila `option='pecah'` (`superRefine`).
   - Amplop WebSocket `WsMessage` = discriminated union pada `t` untuk setiap pesan R3 §3.
   - `RadarEvent` = discriminated union pada `type` untuk setiap event R3 §5.
   Ekspor juga tipe hasil `z.infer`.

4. **`events.ts`** — daftar `EVENT_TYPES` + helper `feedText(ev: RadarEvent): string | null` yang menghasilkan kalimat feed Bahasa Indonesia (contoh `21:06 Bob A ubah checkout.ts`, `21:06 Bob B diblokir di checkout.ts (milik A)`). `null` untuk event yang tidak tampil di feed (`sync.applied`, `hook.failopen`, `ai.edit`). Format jam `HH:mm` zona `Asia/Makassar`.

5. **`paths.ts`** —
   - `toPosix(p)` (ganti `\` → `/`),
   - `toWorkspaceRelative(root, p)` (terima path absolut atau relatif; hasil tanpa `./`; lempar `PathOutsideWorkspaceError` kalau di luar root; tangani huruf drive Windows & case-insensitive di win32),
   - `isInside(root, p)`, `normalizeRelative(p)` (hapus `./`, gabung `..`, tolak path absolut).

6. **`hook-payload.ts`** — `normalizeHookPayload(raw: unknown, root: string): NormalizedHook`:
   ```ts
   interface NormalizedHook {
     event: 'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'Stop' | 'unknown';
     tool: string | null;
     paths: string[];          // relatif workspace, unik, POSIX
     sessionId: string | null;
     cwd: string | null;
     prompt: string | null;    // UserPromptSubmit
     raw: unknown;
   }
   ```
   - Dukung dua bentuk (BC-04): `{ event, tool, input }` dan `{ hook_event_name, tool_name, tool_input }`, plus variasi camelCase (`hookEventName`, `toolName`, `toolInput`).
   - Ekstrak path dari: `path`, `file_path`, `filePath`, `target_file`, `args.path`, `files[].path`, `args.file[].path`, dan untuk `apply_diff` multi-file: semua path yang ditemukan. Urutan & daftar field final mengikuti `docs/SPIKE_RESULTS.md` (kalau berbeda, ikuti spike & catat DECISIONS).
   - Path di luar workspace → dibuang (dan dicatat di `raw`), bukan error.
   - Test tabel: minimal 12 kasus (dua bentuk × tiap tool edit × path absolut/relatif/Windows) + fixture nyata dari `docs/spike-payloads/`.

7. **`ignore.ts`** — `createIgnoreMatcher(root)` → `{ ignores(relPath): boolean }` memakai paket `ignore` dengan daftar default R5 §6 + `.gitignore` root. `isProbablyBinary(buf)` (NUL di 8 KB pertama). `exceedsMaxSize(bytes)`.
   *Catatan:* paket `ignore` harus dibundel ke hook (esbuild), jadi jangan pakai fs sinkron berat saat import.

8. **`hash.ts`** — `sha256Hex(content: string | Uint8Array): Promise<string>` memakai **Web Crypto** (`globalThis.crypto.subtle.digest('SHA-256', …)`), bukan `node:crypto`, karena `@radar/common` juga diimpor Worker. Tersedia di Node ≥ 20 dan Workers. String di-encode UTF-8 lewat `TextEncoder`. **Tidak** menormalisasi CRLF: hash persis byte yang ada di disk (catat keputusan ini di README paket). Aturan umum: `@radar/common` tidak boleh mengimpor modul `node:*` kecuali di `config.ts` (hanya dipakai sisi Node; ekspor lewat subpath `@radar/common/node`).

9. **`http.ts`** — `radarFetch<T>(cfg, method, path, body?, { timeoutMs, schema })`: `fetch` bawaan + `AbortController`, header bearer, parse error R3 §1 menjadi `RadarHttpError(code, status, message)`, timeout → `RadarTimeoutError`. Tanpa dependensi lain (dipakai hook yang dibundel).

10. **`config.ts`** — `loadLocalConfig(startDir)` cari `.radar/local.json` naik ke atas sampai root FS; override env `RADAR_*` (R5 §5); validasi zod; kembalikan `{ root, server, workspace, member, token, role }`. `loadState/saveState` untuk `.radar/state.json` (tulis atomik).

11. **`brief.ts`** — `clampBrief(lines: string[]): string[]` → maks 6 baris, tiap baris dipotong ke 160 char dengan `…`, awalan `[Radar] ` dijamin sekali.

12. **`reducer.ts`** — `initialState()`, `applyEvent(state, ev)`, `applyEvents(state, evs)` sesuai R3 §6. Murni (tanpa `Date.now()`; semua waktu dari `ev.ts`). Aturan penting:
    - `file.changed` → `files[path].version/updatedBy/updatedAt`, `writingUntil = ev.ts + 3000`, `tasks[taskId].editCount++`.
    - `lock.*` → `locks[path]` (hapus saat `released`/`revoked` dan antrean kosong; `transferred` ganti pemegang).
    - `task.*`, `request.*`, `proposal.*`, `commit.created` (set `tasks[taskId].commitSha`, status `selesai` ditangani `task.status`).
    - `member.online/offline/stale`.
    - `bob.activity` → `bobActivity[memberId]` (maks 100 terbaru, bukan `feed`). `tool.pre` dengan `decision='block'` menandai member `blocked` sampai `tool.pre` berikutnya yang `allow`; `tool.post` dengan path menandai `writing` 3 s (R3 §6).
    - `feed`: tambahkan `feedText(ev)` bila tidak null, simpan 200 terbaru.
    - Event tak dikenal → abaikan (forward-compatible).
    - Test: urutan event skenario demo PRD §15 → state akhir sesuai layar PRD §11 (T-1 dikerjakan, T-0 review, checkout.ts dipegang A dengan antrean B, dll.).
    Buat juga `selectors.ts`: `tasksByColumn(state)` (kolom UI: Draf = proposal plan `menunggu`, Dikerjakan = `terbuka|dikerjakan`, Review, Selesai), `fileTree(state)` (pohon folder dengan status kunci), `pendingDecisions(state)`.

13. **Mock server `scripts/mock-server.ts`** (tsx, Hono `@hono/node-server` + `ws`, semua in-memory. Protokol sama persis dengan Worker):
    - Mengimplementasikan SEMUA endpoint R3 §2 (termasuk `POST /v1/bob/activity` → siarkan `bob.activity`) dengan logika sederhana namun konsisten: peta kunci `path → {memberId, taskId, state}`, `checkWrite` versi ringkas (tabel R4 §3 baris 1–10), permintaan dedup, proposal & decision (token `mc-dev`), brief sederhana.
    - Token tetap untuk dev: `A=tok-a`, `B=tok-b`, `C=tok-c`, `mc=mc-dev` (hanya mock!).
    - `POST /admin/init` + `POST /admin/files` versi in-memory (header `x-admin-secret`, bentuk sama dengan fase 03 langkah 8), supaya helper `seedTestWorkspace(url)` fase 04 jalan sama terhadap mock dan Worker.
    - WebSocket `/ws`: `hello`, `welcome`, `snapshot`/`state`, `file.update` → `file.changed` ke klien lain, `event` ke klien mc. `WS_PING_FRAME` dijawab `WS_PONG_FRAME` (meniru auto-response Worker).
    - `--scenario demo`: setelah klien mc terhubung, putar `scripts/mock-scenarios/demo.json` (urutan event PRD §15 dengan jeda 1–3 s, **termasuk** event `bob.activity` untuk A dan B: prompt, tool.pre allow/block, tool.post, turn.end) supaya UI dan Watch Bob punya data hidup. `--scenario none` untuk test hook.
    - Port default 8787, cetak banner berisi token dev.
    - Ini **bukan** server produk: jangan dipakai di fase 03 sebagai dasar kode; tujuannya hanya membuka blokir jalur paralel.

14. **Test & build**: `pnpm --filter @radar/common test` (target ≥ 40 test), `build` menghasilkan `dist/` + `.d.ts`.

15. Commit `fase-02: common contracts, reducer, mock server`.

## Tambahan v0.3

- **Wajib:** mock server mendukung `client: "app"` (R3 §3.9, auth matriks R3 §1).
- **Wajib:** selector baru di `selectors.ts`: `needsYouCount(state)`, `memberStatus(state, member)` (`idle | writing | blocked`, sumber utama `bobActivity`), `bobTimeline(state, member)` (untuk Watch Bob, fase 11).
- **P1 (boleh dilewati kalau waktu habis):** `packages/common/src/term.ts` (tipe + zod pesan `term.*`) dan skenario mock `--scenario terminal` dari `scripts/fixtures/term-bob-session.json`. Relay terminal bukan P0; Watch Bob P0 memakai `bob.activity`.

16. **Jendela ubah kontrak (Sab 04:00–04:30, setelah GATE 1).** Kalau fixture `docs/spike-payloads/` (fase 01) berbeda dari asumsi: ubah **hanya** `hook-payload.ts` (daftar field path), `BobActivityReq`, dan `EDIT_TOOLS_REGEX`, tambah test fixture nyata, lalu PR kecil `fase-02b: hook fields from spike` dari branch snapshot `lane/core-f02b`. Catat di DECISIONS. Di luar jendela ini kontrak hanya berubah lewat proposal DECISIONS + persetujuan Alief.

## Verifikasi

```bash
pnpm -C radar --filter @radar/common build
pnpm -C radar --filter @radar/common test
pnpm -C radar typecheck
pnpm -C radar dev:mock &                 # lalu:
curl -s -X POST localhost:8787/v1/locks/check -H 'authorization: Bearer tok-b' \
  -H 'content-type: application/json' -d '{"paths":["src/checkout/checkout.ts"],"tool":"apply_diff","clientTs":0}'
curl -s localhost:8787/v1/brief?kind=start -H 'authorization: Bearer tok-a'
curl -s -X POST localhost:8787/v1/proposals/P-1/decision -H 'authorization: Bearer tok-c' \
  -H 'content-type: application/json' -d '{"approve":true}'   # harus 403
curl -s -X POST localhost:8787/v1/bob/activity -H 'authorization: Bearer tok-a' \
  -H 'content-type: application/json' -d '{"kind":"turn.end","sessionId":"s1","mode":"coder"}'   # 204
```

## Kriteria selesai (DoD)

- [ ] Setiap bentuk data di R3 punya schema zod dan diekspor.
- [ ] `normalizeHookPayload` lulus test dua bentuk payload + fixture spike (kalau ada).
- [ ] Reducer lulus test skenario demo; murni (tidak ada `Date.now`/I/O).
- [ ] Mock server menjawab semua endpoint R3 (termasuk `POST /v1/bob/activity`), `403` untuk decision dengan token PM, dan memutar skenario demo (dengan `bob.activity`) lewat WS.
- [ ] `@radar/common` (tanpa subpath `/node`) tidak mengimpor `node:*` (uji: bundle dengan `--platform=neutral`).
- [ ] `@radar/common` bisa dibundel esbuild tanpa error (uji: `npx esbuild packages/common/src/index.ts --bundle --platform=node --format=cjs --outfile=/tmp/c.js`).

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Fixture spike belum ada | Pakai payload sintetis dua bentuk; tambah fixture nyata di awal fase 07 |
| Discriminated union zod terlalu besar/lambat untuk hook | Hook hanya mengimpor `hook-payload`, `http`, `config`, `brief` (tree-shaking esbuild) |

## Catatan handoff

- Umar: jalankan `pnpm -C radar dev:mock` untuk mengembangkan hook & radar-mcp (fase 07) dengan token `tok-a`/`tok-b`/`tok-c`.
- Aarief: `pnpm -C radar dev:mock` + WS `ws://localhost:8787/ws` token `mc-dev` untuk Mission Control (fase 09) dan Watch Bob (fase 11).
- Imelda: rekam output WS skenario demo ke fixture replay (fase 11D).
