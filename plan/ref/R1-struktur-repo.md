# R1 — Struktur repo, paket, script & CLI

> Kontrak layout. Semua fase menaruh file sesuai peta ini. Perubahan → `log/DECISIONS.md`.

## 1. Dua repo

| Repo | Isi | Lokasi |
|---|---|---|
| **bob-radar** (repo produk) | Semua kode Radar, plan, dokumen, `bob_sessions/` | root folder ini (`git init` di fase 00) → GitHub publik `bob-radar` |
| **toko-demo** (workspace yang disinkronkan) | Toko online kecil, data sintetis. Diedit oleh Bob A & B lewat Radar. Server Radar meng-commit + push ke sini. | Template di `examples/toko-demo/`, disalin menjadi repo GitHub terpisah `toko-demo` di fase 00 |

## 2. Layout monorepo `bob-radar`

```text
bob-radar/
├── Bob Radar PRD v0.2.md
├── plan/                         # rencana (folder ini)
├── package.json                  # root: scripts, devDeps bersama, "packageManager": "pnpm@9"
├── pnpm-workspace.yaml           # packages/*, examples/* TIDAK termasuk
├── tsconfig.base.json
├── eslint.config.js              # flat config
├── .prettierrc
├── .gitignore
├── .gitleaks.toml
├── .env.example
├── .github/workflows/ci.yml
├── packages/
│   ├── common/                   # @radar/common
│   │   └── src/
│   │       ├── index.ts
│   │       ├── constants.ts      # timeout, debounce, heartbeat, batas brief, warna
│   │       ├── types.ts          # tipe domain (Member, Task, Lock, ...)
│   │       ├── schemas.ts        # zod: body REST, pesan WS, event
│   │       ├── events.ts         # katalog event + tipe payload
│   │       ├── reducer.ts        # applyEvent(state, event) → state (live + replay)
│   │       ├── hook-payload.ts   # normalizeHookPayload()
│   │       ├── paths.ts          # toPosix, toWorkspaceRelative, isInside
│   │       ├── ignore.ts         # aturan abaikan + isProbablyBinary
│   │       ├── hash.ts           # sha256Hex
│   │       ├── http.ts           # radarFetch() dengan timeout + bearer
│   │       ├── config.ts         # loadLocalConfig() cari .radar/local.json ke atas
│   │       └── brief.ts          # clampBrief(lines, max=6, maxLen=160)
│   ├── server/                   # @radar/server  (Fastify + ws + better-sqlite3 + simple-git)
│   │   └── src/
│   │       ├── main.ts           # entry: start server
│   │       ├── cli.ts            # radar-server init|start|token|export
│   │       ├── app.ts            # buildApp({ db, config }) — dipakai test
│   │       ├── config.ts         # baca env (R5 §5)
│   │       ├── db/
│   │       │   ├── schema.sql    # salinan persis R2
│   │       │   ├── migrate.ts
│   │       │   └── repo/*.ts     # member, token, task, file, lock, allocation, request, proposal, review, event, notification
│   │       ├── services/
│   │       │   ├── events.ts     # append + bus (EventEmitter)
│   │       │   ├── files.ts      # applyUpdate, applyDelete, history
│   │       │   ├── locks.ts      # mesin kunci (R4)
│   │       │   ├── tasks.ts
│   │       │   ├── requests.ts
│   │       │   ├── proposals.ts  # validate + apply (plan/decision/review)
│   │       │   ├── brief.ts
│   │       │   ├── git.ts        # git worker (antrian serial)
│   │       │   ├── diff.ts       # diff task + analisis importer
│   │       │   ├── heartbeat.ts  # deteksi kedaluwarsa (P1)
│   │       │   └── report.ts     # session_report (P1)
│   │       ├── http/
│   │       │   ├── auth.ts       # plugin bearer → req.principal
│   │       │   ├── errors.ts
│   │       │   └── routes/*.ts   # satu file per kelompok endpoint R3
│   │       └── ws/hub.ts         # koneksi, hello, snapshot, broadcast
│   ├── sync/                     # @radar/sync  → bin: radar
│   │   └── src/
│   │       ├── cli.ts            # radar join|status|task|kit|agent
│   │       ├── agent.ts          # SyncAgent class
│   │       ├── watcher.ts        # chokidar + debounce 150 ms
│   │       ├── known.ts          # peta path → {version, hash} (anti-gema)
│   │       ├── writer.ts         # tulis atomik (tmp + rename)
│   │       ├── sidecar.ts        # .radar-rejected / .radar-conflict
│   │       ├── notify.ts         # notifikasi terminal
│   │       └── kit.ts            # pasang bob-kit ke .bob/
│   ├── hooks/                    # @radar/hooks — sumber hook, dibundel ke bob-kit/.bob/hooks/*.js
│   │   └── src/
│   │       ├── brief.ts          # SessionStart & UserPromptSubmit
│   │       ├── lock_guard.ts     # PreToolUse
│   │       ├── mark_ai_edit.ts   # PostToolUse (P1)
│   │       └── stop.ts           # Stop (P2, opsional)
│   ├── mcp/                      # @radar/mcp — radar-mcp (stdio), dibundel ke bob-kit/.bob/radar-mcp.js
│   │   └── src/
│   │       ├── main.ts
│   │       ├── client.ts         # REST client ke server
│   │       ├── tools/coder/*.ts  # my_tasks, why_blocked, request_file, team_activity, submit_task
│   │       └── tools/pm/*.ts     # team_status, propose_plan, list_requests, propose_decision, get_task_diff, propose_review, notify, session_report
│   └── web/                      # @radar/web — Next.js (Mission Control + /demo)
│       ├── app/
│       │   ├── page.tsx          # login → dashboard
│       │   ├── mc/page.tsx       # Mission Control
│       │   ├── demo/page.tsx     # replay (UI-05)
│       │   └── coder/[member]/page.tsx  # tampilan coder (UI-07, P1)
│       ├── components/           # TopBar, TaskBoard, FileTree, LockChip, DecisionQueue, ProposalCard, LiveFeed, DiffViewer, ReplayControls, CoderPanel
│       ├── lib/                  # ws-client.ts, api.ts, store.ts (zustand), colors.ts
│       └── public/demo/          # events.json, meta.json, bob-quotes.json
├── bob-kit/                      # paket yang disalin ke <workspace>/.bob/ oleh `radar join`
│   ├── coder/.bob/               # custom_modes.yaml, settings.json, mcp.json, hooks/*.js, radar-mcp.js
│   ├── pm/.bob/                  # custom_modes.yaml (pm-lead), mcp.json, radar-mcp.js
│   └── prompts/                  # prompt siap tempel untuk PM & coder
├── spike/                        # artefak fase 01 (boleh dihapus setelah submit)
├── examples/toko-demo/           # template repo workspace
├── scripts/
│   ├── mock-server.ts            # fase 02
│   ├── sim-3pc.ts                # fase 10
│   ├── bench-sync.ts             # fase 04
│   ├── metrics.ts                # fase 13
│   ├── export-replay.ts          # fase 11
│   └── ab/                       # fase 13
├── docs/
│   ├── SPIKE_RESULTS.md
│   ├── ARCHITECTURE.md
│   ├── EXPERIMENT.md
│   ├── DEMO_SCRIPT.md
│   └── deck/
├── bob_sessions/                 # ekspor sesi Bob per anggota per fase
├── BOB_DEVELOPMENT.md
└── README.md                     # README juri
```

## 3. Paket & dependensi

| Paket | Runtime deps | Dev deps | Build |
|---|---|---|---|
| `@radar/common` | `zod` | `vitest` | `tsc` → `dist/` (ESM) |
| `@radar/server` | `fastify@5`, `@fastify/websocket`, `@fastify/cors`, `better-sqlite3`, `simple-git`, `diff`, `pino`, `nanoid`, `commander`, `@radar/common` | `@types/better-sqlite3`, `vitest`, `fast-check`, `ws` | `tsc`; Docker untuk deploy |
| `@radar/sync` | `chokidar@4`, `ws`, `commander`, `ignore`, `picocolors`, `@radar/common` | `vitest` | `tsc`; `bin.radar = dist/cli.js` |
| `@radar/hooks` | (tidak ada saat runtime — dibundel) `@radar/common` | `esbuild`, `vitest` | `esbuild` → `bob-kit/coder/.bob/hooks/*.js` (CJS, node20, tanpa dependensi eksternal) |
| `@radar/mcp` | `@modelcontextprotocol/sdk`, `zod`, `@radar/common` | `esbuild`, `vitest` | `esbuild` bundle → `bob-kit/*/.bob/radar-mcp.js` (satu file) |
| `@radar/web` | `next@15`, `react@19`, `zustand`, `diff2html` atau `react-diff-viewer-continued`, `@radar/common` | `tailwindcss@4`, `@playwright/test` | `next build`, deploy Vercel |

Aturan: **hook dan radar-mcp harus bisa jalan di workspace toko-demo tanpa `npm install`**. Karena itu keduanya dibundel menjadi satu file JS mandiri memakai `fetch` bawaan Node 20.

## 4. Script root (`package.json`)

| Script | Isi |
|---|---|
| `build` | `pnpm -r build` |
| `typecheck` | `pnpm -r typecheck` |
| `test` | `pnpm -r test` |
| `lint` | `eslint .` |
| `format` | `prettier -w .` |
| `dev:server` | `pnpm --filter @radar/server dev` (tsx watch, DATA_DIR=./.data) |
| `dev:web` | `pnpm --filter @radar/web dev` |
| `dev:mock` | `tsx scripts/mock-server.ts --scenario demo` |
| `bundle:kit` | build hooks + mcp → isi `bob-kit/` |
| `sim` | `tsx scripts/sim-3pc.ts` |
| `bench:sync` | `tsx scripts/bench-sync.ts` |
| `metrics` | `tsx scripts/metrics.ts` |
| `secrets:scan` | `gitleaks detect --source . --log-opts="--all"` |

## 5. CLI

### `radar-server` (paket server)

```text
radar-server init --workspace toko-demo --repo <git-url|path> \
  --member "A:coder:Alice:alice@example.com" \
  --member "B:coder:Budi:budi@example.com" \
  --member "C:pm:Citra:citra@example.com"
  → clone repo ke $DATA_DIR/repo, impor file teks ke tabel file (versi 1),
    buat anggota + token, cetak token SEKALI (A, B, C, dan token Mission Control).
radar-server start                      → jalankan HTTP + WS di $PORT
radar-server token --member A --rotate  → token baru
radar-server export --out events.json   → sama dengan GET /v1/events/export
radar-server reset --confirm            → hapus DATA_DIR (hanya untuk dev)
```

### `radar` (paket sync)

```text
radar join <server-url> --workspace toko-demo --as A --token <tok> [--dir .] [--no-kit] [--kit coder|pm]
  → tulis .radar/local.json, pasang kit .bob/, unduh snapshot, mulai memantau (foreground).
radar start                    → pakai .radar/local.json yang ada, mulai memantau
radar status                   → server, member, jumlah file, kunci saya, koneksi
radar task use <T-id>          → set task aktif (P1)
radar kit install [coder|pm]   → pasang ulang .bob/ (setelah bundle baru)
radar agent --auto --max-cost <n>  → pemicu main agent otomatis di PC PM (SV-10, P1)
```

## 6. File lokal per PC (tidak disinkronkan, tidak di-commit)

| Path (di dalam workspace) | Isi |
|---|---|
| `.radar/local.json` | `{ "server": "https://…", "workspace": "toko-demo", "member": "A", "token": "…", "role": "coder" }` |
| `.radar/state.json` | `{ "briefCursor": 1234, "lastBlock": {...} }` |
| `.radar/hook.log` | log hook (tanpa token) |
| `.radar/sync.log` | log sync agent |
| `.bob/` | kit yang dipasang `radar join` (diabaikan sync; boleh di-commit di toko-demo sebagai referensi) |

`.radar/` dan `*.radar-rejected`, `*.radar-conflict` wajib ada di `.gitignore` toko-demo.
