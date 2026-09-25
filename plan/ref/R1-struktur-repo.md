# R1 — Struktur repo, paket, script & CLI (v0.3: fork Orca + workspace `radar/`)

> Kontrak layout. Semua fase menaruh file sesuai peta ini. Perubahan → `log/DECISIONS.md`.

## 1. Dua repo

| Repo | Isi | Lokasi |
|---|---|---|
| **ibm-bob-live-collab** (repo produk, publik, dinilai juri) | **Fork GitHub dari `stablyai/orca`** (MIT). Kode Orca di root (`src/`, `config/`, …) + workspace pnpm terpisah `radar/` (server, sync, hook, MCP, UI, replay, kit Bob, plan) + `bob_sessions/` | `gh repo fork stablyai/orca --fork-name ibm-bob-live-collab` di fase 00 |
| **toko-demo** (workspace yang disinkronkan) | Toko online kecil, data sintetis. Diedit Bob A & B lewat Live Collab. Server meng-commit + push ke sini. | Template `radar/examples/toko-demo/`, disalin ke repo GitHub terpisah di fase 00 |

Konvensi path di semua file plan: **`orca:`** = relatif ke root repo (kode Orca), path tanpa prefix = relatif ke `radar/`.

## 2. Layout repo `ibm-bob-live-collab`

```text
ibm-bob-live-collab/                  ← root = fork Orca
├── src/                              ← Orca (Electron main/preload/renderer/shared). Lane C menambah:
│   ├── shared/tui-agent.ts           ← + 'bob' di union TuiAgent
│   ├── shared/tui-agent-config.ts    ← + konfigurasi launch/detect bob
│   ├── main/radar/                   ← BARU: sync-supervisor.ts (P1), secure-store.ts (safeStorage)
│   └── renderer/src/
│       ├── lib/agent-catalog.tsx     ← + entri "IBM Bob"
│       ├── lib/agent-icon-glyphs.tsx ← + glyph "B"
│       ├── store/radar-store.ts      ← BARU: zustand + applyEvent
│       ├── lib/radar/ws-client.ts    ← BARU
│       ├── lib/radar/terminal-share.ts ← BARU (fase 11): tap xterm → term.frame
│       └── components/radar/         ← BARU: RadarSidebarSection, MissionControlView, TeamPanel,
│                                        FilesLocksView, WatchTerminalView, RadarSettingsPane, …
├── electron.vite.config.ts           ← + alias @radar/common, @radar/ui → radar/packages/*/src
├── config/electron-builder.config.cjs← productName "IBM Bob Live Collab", appId, ikon (fase 11)
├── resources/                        ← ikon app baru (fase 11)
├── .gitignore                        ← .gitignore Orca + blok template IBM (fase 00)
├── .bobignore  SECURITY.MD  .env.example   ← dari ibm-hackathon-template (fase 00)
├── LICENSE                           ← MIT Orca, TIDAK diubah
├── README.md                         ← README juri (atas) + atribusi Orca (bawah)
├── BOB_DEVELOPMENT.md
├── bob_sessions/<nama>/<NN-slug>/{summary.png,task.md} + INDEX.md
└── radar/                            ← workspace pnpm TERPISAH (pnpm-workspace.yaml sendiri)
    ├── package.json  pnpm-workspace.yaml  tsconfig.base.json  eslint.config.js  .prettierrc
    ├── PRD.md  PLAN.md  DESIGN.md  prompt_ui.md      ← dipindah dari folder IBM/ di fase 00
    ├── plan/                          ← folder ini
    ├── packages/
    │   ├── common/   @radar/common    (tipe, zod, events, reducer, hook-payload, term.ts)
    │   ├── server/   @radar/server    (Fastify + ws + SQLite + git + relay terminal)
    │   ├── sync/     @radar/sync      → bin: radar
    │   ├── hooks/    @radar/hooks     → bundel ke bob-kit/*/.bob/hooks/*.js
    │   ├── mcp/      @radar/mcp       → bundel ke bob-kit/*/.bob/radar-mcp.js
    │   ├── ui/       @radar/ui        BARU: komponen React presentasional (DESIGN.md §3)
    │   └── web/      @radar/web       Next.js: /demo replay, /install (P2), /gallery (dev)
    ├── bob-kit/{coder,pm}/.bob/  bob-kit/prompts/
    ├── spike/  examples/toko-demo/
    ├── scripts/  (mock-server, sim-3pc, bench-sync, metrics, export-replay, ab/,
    │             bob-evidence.sh, evidence-check.ts, check-ignored.sh)
    └── docs/  (SPIKE_RESULTS, ARCHITECTURE, EXPERIMENT, DEMO_SCRIPT, SUBMISSION, deck/, video/)
```

Isi folder `packages/server/src` dan lainnya sama dengan v0.2 (di bawah), dengan satu perubahan: `db/repo/token.ts` → **`db/repo/access.ts`**, karena pola `*token*` di `.gitignore` template IBM akan membuat file itu tidak ter-commit (R5 §8).

### 2.1 Isi paket (tidak berubah dari v0.2 kecuali ditandai)

```text
packages/common/src/  index, constants, types, schemas, events, reducer, hook-payload, paths, ignore,
                      hash, http, config, brief, term (BARU: tipe & zod pesan term.*)
packages/server/src/  main, cli, app, config, db/{schema.sql, migrate.ts, repo/*.ts: member, access,
                      task, file, lock, allocation, request, proposal, review, event, notification},
                      services/{events, files, locks, tasks, requests, proposals, brief, git, diff,
                      heartbeat, report, terminals (BARU: relay + ring buffer)}, http/{auth, errors,
                      routes/*.ts}, ws/hub.ts
packages/sync/src/    cli, agent, watcher, known, writer, sidecar, notify, kit
packages/hooks/src/   brief, lock_guard, mark_ai_edit, stop
packages/mcp/src/     main, client, tools/coder/*, tools/pm/*
packages/ui/src/      AgentTag, MemberChip, LockChip, WritingPulse, BobTrace, BriefMeter, DecisionCard,
                      ReviewCard, TaskCard, FeedItem, TerminalFrame, GuestCursor, PresenceStack,
                      views/{MissionControl, FilesLocks, TeamPanel}, tokens.css
packages/web/app/     demo/page.tsx, gallery/page.tsx, install/route.ts (P2)
```

## 3. Paket & dependensi

| Paket | Runtime deps | Dev deps | Build |
|---|---|---|---|
| `@radar/common` | `zod` | `vitest` | `tsc` → `dist/` (ESM) |
| `@radar/server` | `fastify@5`, `@fastify/websocket`, `@fastify/cors`, `better-sqlite3`, `simple-git`, `diff`, `pino`, `nanoid`, `commander`, `@radar/common` | `@types/better-sqlite3`, `vitest`, `fast-check`, `ws` | `tsc`; Docker untuk deploy |
| `@radar/sync` | `chokidar@4`, `ws`, `commander`, `ignore`, `picocolors`, `@radar/common` | `vitest` | `tsc`; `bin.radar = dist/cli.js` |
| `@radar/hooks` | (tidak ada saat runtime — dibundel) `@radar/common` | `esbuild`, `vitest` | `esbuild` → `bob-kit/coder/.bob/hooks/*.js` (CJS, node20, tanpa dependensi eksternal) |
| `@radar/mcp` | `@modelcontextprotocol/sdk`, `zod`, `@radar/common` | `esbuild`, `vitest` | `esbuild` bundle → `bob-kit/*/.bob/radar-mcp.js` (satu file) |
| `@radar/ui` | `react@19` (peer), `@radar/common`, `lucide-react`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | `vitest`, `@testing-library/react` | tanpa build: dikonsumsi sebagai source (alias Vite di Orca, `transpilePackages` di Next) |
| `@radar/web` | `next@15`, `react@19`, `zustand`, `@xterm/xterm` (replay frame), `diff2html` atau `react-diff-viewer-continued`, `@radar/common`, `@radar/ui` | `tailwindcss@4`, `@playwright/test` | `next build` statis, deploy Vercel |

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
| `secrets:scan` | `gitleaks detect --source .. --log-opts="--all"` |
| `evidence:check` | `tsx scripts/evidence-check.ts` (R7 §4) |
| `check:ignored` | `bash scripts/check-ignored.sh` — gagal kalau ada file sumber yang cocok pola `.gitignore` template IBM |
| `dev:app` | `pnpm -C .. dev` (menjalankan Orca/Live Collab dari root) |

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
radar-server invite --member B          → kode undangan rdr_inv_<base64url {server, workspace, member, token}> (P1, IN-02)
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
