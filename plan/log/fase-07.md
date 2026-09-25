# Log fase 07 — Kit `.bob/` coder (Lane Umar · Bob)

- **Status:** [x] selesai untuk semua yang bisa diuji tanpa server asli. Uji ulang melawan mock fase 02 / Worker fase 03 + `radar join` = fase 10.
- **Mulai:** Sab 26 Sep 2026 00:45 WITA · **Selesai:** 01:10 WITA · branch `lane/bob` (di atas `main` setelah PR #1 fase 01 di-merge).
- **Model:** Claude Opus 5.5 (R6 §2: Sonnet 5 · high). ECC tidak terpasang di Mac ini (lihat log fase 01): TDD dengan vitest, reviewer `caveman:cavecrew-reviewer`.

## Langkah 1 — fakta spike yang dipakai (D-umar-01)

| Hal | Nilai dipakai di kit |
|---|---|
| Regex tool edit | `^(write_file\|apply_diff\|search_and_replace\|insert_content\|office_edit)$` (R5 §4, tidak berubah) |
| Field path | `tool_input.path` (relatif workspace); normalizer tetap menerima bentuk docs + camelCase |
| Kanal pesan blokir | stderr + exit 2 (sampai ke model), cadangan: instruksi mode + rules + `why_blocked` |
| Brief | stdout `SessionStart`/`UserPromptSubmit` masuk konteks; `SessionStart` per task |
| MCP | `.bob/mcp.json` workspace, `${workspaceFolder}` (cwd server = `/`), `alwaysAllow` 5 tool |
| Grup mode | `execute` |
| Tool shell | `execute_command` |
| Timeout hook | fail-open → `lock_guard` sendiri menyerah di 1,5 s, `timeout` 3 s |
| Trust | untrusted = panel Bob kosong → langkah onboarding |
| CommonJS | hook `.js` mewarisi `"type"` → kit membawa `.bob/package.json` `{"type":"commonjs"}` |

## Ringkasan rencana

1. Placeholder `@radar/common` (fase 02 belum di `main`) di `src/placeholder/`, bertanda `TODO(sync:alief)`.
2. Test dulu: hook di-bundle esbuild lalu di-spawn melawan fake server `node:http`; MCP lewat `InMemoryTransport`.
3. Bob slice: B3 `lock_guard` + `brief`, B4a 5 tool MCP, B2 mode + rules. Claude: `_shared`, `activity`, `mark_ai_edit`, `stop`, client/server/main MCP, build, kit statis.
4. Uji perilaku di Bob IDE (workspace `toko-sim` + `spike/fake-radar`), perbaiki instruksi sampai 3/3.

## Checklist langkah (plan/fase-07-bob-coder-kit.md)

- [x] 1. Fakta spike disalin (tabel di atas).
- [x] 2. `_shared.ts`: `readStdin`, `loadContext` (config dari `RADAR_ROOT` / `cwd` payload / `process.cwd()`), `logLine` ke `.radar/hook.log` tanpa token, `radarFetch` dengan `AbortSignal.timeout`, `settleWithin`.
- [x] 3. `lock_guard.ts` (Bob B3 + perbaikan review): exit 0/2 saja, fail-open < 1,8 s, `lastBlock` disimpan, `tool.pre` dikirim ≤ 300 ms.
- [x] 4. `brief.ts` (Bob B3): start/prompt, cursor di `.radar/state.json`, ≤ 6 baris, diam saat server mati.
- [x] 5. `mark_ai_edit.ts`: `tool.post` + `linesChanged` (write_file `line_count`, sisi REPLACE apply_diff, insert_content), P1 `POST /v1/ai-edits` diam saat gagal, tanpa stdout, lewati `mcp__radar__*`.
- [x] 5b. `stop.ts`: `turn.end` saja; `last_assistant_message` tidak dikirim; tidak melepas kunci.
- [x] 5c. `activity.ts`: timeout 800 ms, `text` ≤ 200 karakter hanya bila `shareprompts`.
- [x] 6. `packages/hooks/build.mjs` → `bob-kit/coder/.bob/hooks/*.js` (cjs, node20, banner generated).
- [x] 7. `radar-mcp`: `client.ts` (timeout 5 s, pesan Bahasa Indonesia), `server.ts` (tool per role), `main.ts` (`--root`), 5 tool coder (Bob B4a + perbaikan), `build.mjs` → `bob-kit/coder/.bob/radar-mcp.js` (1,3 MB, tidak di-minify).
- [x] 8. `custom_modes.yaml` (Bob B2) + instruksi 1a (perbaikan perilaku, lihat langkah 14).
- [x] 9. `settings.json`: 5 hook, `timeout` eksplisit (PreToolUse 3 s, brief 5 s, lainnya 3 s), matcher PostToolUse = tool edit + `read_file` + `execute_command`.
- [x] 10. `mcp.json`: `${workspaceFolder}/.bob/radar-mcp.js --root ${workspaceFolder}` + `alwaysAllow`.
- [x] 11. `bob-kit/prompts/coder-{mulai,lanjut,selesai}.md`.
- [x] 12. Test otomatis (hooks 41, mcp 16).
- [x] 13. Uji di Bob IDE melawan fake server (bukan mock fase 02; lihat hasil).
- [x] 14. Perbaikan perilaku: instruksi 1a, uji ulang 3/3.
- [x] 15. Commit + PR.

## Hasil verifikasi

| Perintah | Hasil |
|---|---|
| `pnpm -C radar --filter @radar/hooks test` | 41 lulus (lock_guard 16, brief 9, post/stop 7, payload fixture nyata 9) |
| `pnpm -C radar --filter @radar/mcp test` | 16 lulus |
| `pnpm -C radar typecheck` / `lint` / `test` / `build` / `check:ignored` | semua hijau |
| `pnpm -C radar bundle:kit` | hooks 6,8–9,7 KB, radar-mcp 1,3 MB |
| `lock_guard` wall time, 20× vs server lokal (spawn node) | p50 73 ms, p95 99 ms (target < 300 ms) |
| fail-open | server mati → exit 0 < 1,8 s; server lambat 3 s → exit 0 < 1,8 s; HTTP 500 → exit 0 |
| Bundle radar-mcp via stdio dari cwd `/` | `initialize` + 5 tool + pesan "Server Radar tidak menjawab…" saat server mati |
| Hook di workspace `"type": "module"` | blokir exit 2 jalan berkat `.bob/package.json` |

## Uji perilaku di Bob IDE (langkah 13)

Workspace `toko-sim` (sintetis, di scratchpad) dengan kit terpasang manual + `.radar/local.json` ke `radar/spike/fake-radar/server.mjs`. Mode **Live Collab Coder**, semua via CDP.

| Uji | Hasil | Bukti |
|---|---|---|
| 13.1 mode + MCP termuat, workspace trusted | lulus: mode muncul, `radar` MCP jalan | daftar mode `["Agent","Plan","Ask","Live Collab Coder"]` |
| 13.2 brief terbaca | lulus: Bob mengutip 4 baris `[Radar]` persis | transkrip + log server `GET /v1/brief?kind=start` |
| 13.3 "Kerjakan task aktifmu" → `my_tasks` dulu | lulus: `my_tasks` → baca → `locks/check` allow → edit `theme.css` → `submit_task` (BC-07) | log server |
| 13.4 blokir 3× (awal) | Bob menolak **sebelum mencoba** (brief/`my_tasks` sudah menyebut file itu milik orang lain). Tidak coba ulang, tidak lewat shell, tapi hook tidak terpicu dan permintaan tidak dibuat | run 1–6 |
| 14 perbaikan: instruksi 1a "coba edit, Radar yang memutuskan" | **lulus 3/3** (run 8, 9, 11): coba → hook memblok → `why_blocked` → jelaskan satu-dua kalimat → pindah ke file sendiri. Run 9 memancing "cari cara lain sampai berhasil": Bob menolak jalan pintas shell | `bob_sessions/uaai_umar_task05_coder_block_test_summary.png`, `bob-kit/prompts/bob-quotes.json` |
| Catatan | File yang **sudah diumumkan** antre/dipegang di brief atau `my_tasks` (`checkout.ts`) tetap dijelaskan dan ditawari `request_file` tanpa percobaan edit (run 7, 10) | lihat Catatan handoff |
| Shell | `execute_command` 0 kali di seluruh log uji | `radar/spike/out/fake-radar.jsonl` |

Kutipan Bob setelah diblok (run 8): "File src/routes.ts sedang dikunci oleh Alice untuk task T-1 Kupon, jadi edit tidak bisa dilakukan sekarang. Permintaanmu sudah otomatis masuk antrean PM sebagai R-3 …"

## DoD + bukti

- [x] BC-01: 3/3 blokir jalur hook → `why_blocked`, tanpa coba ulang, tanpa shell (run 8, 9, 11).
- [x] BC-02: brief start ≤ 6 baris (test `brief.test.ts`) + Bob mengutipnya (uji 13.2).
- [x] BC-03: brief prompt hanya hal baru sejak cursor, kosong = diam (test).
- [x] BC-04: dua bentuk payload + fixture nyata; blokir = exit 2 dan file tidak berubah (test + Bob IDE, `git diff` kosong).
- [x] BC-07: 5 tool coder (16 test) + Bob memanggil `my_tasks`, `why_blocked`, `submit_task` di Bob IDE.
- [x] Fail-open terbukti (server mati/lambat/500 → exit 0 < 1,8 s).
- [x] JT-01 sisi hook: `session.start`, `prompt`, `tool.pre`, `tool.post`, `turn.end` terkirim (test + log fake server); `text` tidak terkirim bila `shareprompts=false`.
- [x] Screenshot ringkasan task Bob: task 02 (B2), 03 (B3), 04 (B4a), 05 (uji perilaku).

## Bob slice

| ID | Bukti | Bobcoin | File |
|---|---|---|---|
| B2 coder mode | `uaai_umar_task02_coder_mode_summary.png` | 0.354 | `bob-kit/coder/.bob/custom_modes.yaml`, `rules-coder/01-radar.md` |
| B3 hooks | `uaai_umar_task03_hooks_summary.png` | 0.914 | `packages/hooks/src/lock_guard.ts`, `brief.ts` |
| B4a MCP coder | `uaai_umar_task04_mcp_coder_summary.png` | 1.13 | `packages/mcp/src/tools/coder/*.ts` |
| uji perilaku | `uaai_umar_task05_coder_block_test_summary.png` | ± 1,5 untuk 13 task uji | – |

Perubahan Claude atas hasil Bob (commit terpisah): `lock_guard` tetap exit 2 walau `state.json` gagal ditulis + test; `brief` timeout 1,5 s; `submit_task` meng-encode `task_id` + test; `my_tasks` hanya menandai task aktif dan menyebut status kunci + test; lint (import type, tanpa `{}`); instruksi mode 1a.

## Review (langkah 8)

Reviewer: `caveman:cavecrew-reviewer` (ECC belum termuat saat review dijalankan; plugin ECC baru muncul di sesi setelahnya). Cakupan: correctness, silent failure, kebocoran token/isi file, path/URL injection.

| Sev | Temuan | Tindak lanjut |
|---|---|---|
| HIGH | `lock_guard`: stdin 500 ms + server 1500 ms bisa > 1,8 s bila host tidak menutup stdin | diperbaiki: anggaran total `LOCK_GUARD_BUDGET_MS = 1600` sejak proses mulai, timeout server = sisa anggaran; test baru "stdin tidak ditutup + server lambat" < 1,8 s |
| MEDIUM | `mark_ai_edit`: `linesChanged()` dipanggil dua kali | diperbaiki |
| MEDIUM | `lock_guard`: `res.message` disimpan ke `state.json` tanpa batas | diperbaiki: dipotong 2000 karakter |
| – | Tidak ada kebocoran token/isi file, tidak ada path traversal/URL injection, exit code sesuai kontrak | – |

Review hasil Bob sebelumnya (commit terpisah): `saveState` gagal → blokir hilang (HIGH, diperbaiki + test), `task_id` tanpa encode (MEDIUM, diperbaiki + test), label `my_tasks` (LOW, diperbaiki + test), lint 5 error (diperbaiki).

## Placeholder aktif

- `radar/packages/hooks/src/placeholder/common.ts`: konstanta, `normalizeHookPayload`, `loadLocalConfig`, `loadState/saveState`, tipe R3 → `@radar/common` fase 02.
- `radar/packages/mcp/src/placeholder/config.ts`: `loadLocalConfig` → `@radar/common/node` fase 02.
- `radar/packages/hooks/test/helpers.ts`, `radar/packages/mcp/test/coder.test.ts`: fake server → mock fase 02.
- `radar/packages/hooks/src/mark_ai_edit.ts`: `POST /v1/ai-edits` (fase 12, P1).
- `radar/spike/fake-radar/server.mjs`: diganti mock/Worker di fase 10.

## Deviasi

- Nama file hook tetap `.js` (spec) tetapi kit membawa `.bob/package.json` `{"type":"commonjs"}`; tanpa itu hook gagal di proyek `"type": "module"` (D-umar-02).
- `mcp.json` memakai `${workspaceFolder}` + `--root`, bukan `.bob/radar-mcp.js` relatif (spec langkah 10 menyebut "atau format hasil spike").
- Uji Bob IDE memakai fake server sendiri, bukan mock fase 02 (belum ada di `main`).
- Fail-open dicatat lokal saja (`.radar/hook.log`), pilihan "minimal" di langkah 3.
- `pnpm install` di Mac ini selalu menambah `@pnpm/exe` ke `radar/pnpm-lock.yaml`; dikembalikan setiap kali, tidak di-commit.

## LANGKAH MANUAL

1. (fase 10) Ulangi uji 13 di `toko-demo` asli setelah `radar join` (fase 04) dan mock/Worker (fase 02/03): A memegang `src/checkout/checkout.ts`, B mencoba mengeditnya.

## Catatan handoff

- **Alief (brief, R4 §8):** kalau brief `start` atau `my_tasks` sudah menyebut file X dipegang/antre untuk orang lain, Bob memilih menjelaskan + menawarkan `request_file` tanpa mencoba edit, jadi hook tidak terpicu dan permintaan otomatis tidak dibuat. Untuk naskah demo PRD §15 (momen blokir), file rebutan sebaiknya **tidak** muncul di brief B sebelum B mencoba, atau demo memakai file yang direbut setelah brief start. Usulan dicatat di D-umar-02 poin 5.
- **Alief:** `pnpm install` (pnpm 12.0.0) menambah `@pnpm/exe` ke `packageManagerDependencies` di lockfile; cek apakah lockfile di `main` perlu diperbarui.
- **Imelda (11D):** kutipan Bob di `radar/bob-kit/prompts/bob-quotes.json`.
- **fase 08:** `packages/mcp/src/server.ts` `toolsForRole('pm')` tempat tool PM; `build.mjs` menambah `bob-kit/pm/.bob/radar-mcp.js`.
