# R1 — Struktur repo, paket, script & CLI (v0.3: Orca di `app/` + workspace `radar/` di repo umarmuhdhor/IBM)

> Kontrak layout. Semua fase menaruh file sesuai peta ini. Perubahan → `log/DECISIONS.md`.

## 1. Dua repo

| Repo | Isi | Lokasi |
|---|---|---|
| **`umarmuhdhor/IBM`** (repo produk, **sudah publik**, yang dinilai juri) | Dokumen di root, **Orca di `app/`** (disalin dari `stablyai/orca` @ `bf40d35`, MIT, tanpa history upstream), workspace pnpm `radar/` (server, sync, hook, MCP, UI, replay, kit Bob), `bob_sessions/`, `.claude/` (agent & skill bersama) | sudah ada. Orca masuk di commit `7c86819`. |
| **toko-demo** (workspace yang disinkronkan) | Toko online kecil, data sintetis. Diedit Bob A & B lewat Live Collab. Server meng-commit + push ke sini. | Template `radar/examples/toko-demo/`, disalin ke repo GitHub terpisah di fase 00 |

Konvensi path di semua file plan:
- **`orca:`** = relatif ke folder **`app/`** (kode Orca), misalnya `orca:src/shared/tui-agent.ts` = `app/src/shared/tui-agent.ts`.
- `plan/…`, `PRD.md`, `PLAN.md`, `DESIGN.md`, `bob_sessions/…` = relatif ke root repo.
- Path kode lain tanpa prefix (`packages/…`, `scripts/…`, `docs/…`, `bob-kit/…`, `examples/…`) = relatif ke **`radar/`**.

Toolchain: `app/` butuh **Node 24 + pnpm 12** (`nvm use 24`, lalu corepack). `radar/` juga Node 24 (`engines: >=24`, `.nvmrc` = `24`, CI Node 24). Hanya bundle hook & radar-mcp yang ditarget `node20`, karena bundle itu jalan di mesin anggota lewat Bob IDE.

## 2. Layout repo

```text
IBM/  (github.com/umarmuhdhor/IBM)
├── README.md  PLAN.md  PRD.md  DESIGN.md  prompt_ui.md     ← dokumen (tetap di root)
├── plan/  arsip/  "UI Inspo & Design"/                      ← rencana, arsip, referensi & mockup UI
├── .claude/agents/electron-pro.md                           ← agent bersama (VoltAgent, MIT)
├── .claude/skills/{electron-automation,live-collab-app}/    ← skill bersama (lihat PLAN.md §11)
├── .gitignore  .bobignore  SECURITY.MD  .env.example        ← template IBM (fase 00)
├── .github/workflows/ci.yml                                 ← CI kita (workflow Orca di app/.github tidak jalan)
├── BOB_DEVELOPMENT.md
├── bob_sessions/<tim>_<nama>_task<NN>_<slug>_summary.png + INDEX.md
├── app/                               ← Orca (Electron). Lane Aarief/Imelda menambah:
│   ├── src/shared/tui-agent.ts        ← + 'bob'
│   ├── src/shared/tui-agent-config.ts ← + konfigurasi launch/detect bob (+ ±10 file registrasi lain, daftar di fase 09)
│   ├── src/main/radar/                ← BARU: secure-store.ts (safeStorage), sync-supervisor.ts (P1)
│   ├── src/renderer/src/
│   │   ├── lib/agent-catalog.tsx, lib/agent-icon-glyphs.tsx   ← + "IBM Bob"
│   │   ├── store/radar-store.ts                               ← BARU
│   │   ├── lib/radar/{ws-client,api,terminal-share}.ts        ← BARU
│   │   └── components/radar/*                                 ← BARU: sidebar section, views, settings
│   ├── electron.vite.config.ts        ← + alias @radar/common, @radar/ui → ../radar/packages/*/src
│   ├── config/electron-builder.config.cjs ← productName, appId, ikon (fase 11)
│   └── LICENSE                        ← MIT Orca, TIDAK diubah
└── radar/                             ← workspace pnpm Live Collab (dibuat fase 00)
    ├── package.json  pnpm-workspace.yaml  tsconfig.base.json  eslint.config.js  .prettierrc
    ├── packages/{common,server,sync,hooks,mcp,ui,web}
    ├── bob-kit/{coder,pm}/.bob/  bob-kit/prompts/
    ├── spike/  examples/toko-demo/
    ├── scripts/  (mock-server, sim-3pc, bench-sync, metrics, export-replay, ab/,
    │             bob-evidence.sh, evidence-check.ts, check-ignored.sh)
    └── docs/  (SPIKE_RESULTS, ARCHITECTURE, EXPERIMENT, DEMO_SCRIPT, SUBMISSION, ORCA_MAP, deck/, video/)
```

`db/repo/token.ts` → **`db/repo/access.ts`**, karena pola `*token*` di `.gitignore` template IBM akan membuat file itu tidak ter-commit (R5 §8).

### 2.1 Isi paket (tidak berubah dari v0.2 kecuali ditandai)

```text
packages/common/src/  index, constants, types, schemas, events, reducer, hook-payload, paths, ignore,
                      hash (Web Crypto), http, config (hanya Node, subpath `@radar/common/node`), brief, selectors,
                      term (P1: tipe & zod pesan term.*)
packages/server/src/  index (Worker, Hono), workspace-do (Durable Object), admin, config, db/{schema.sql, migrate.ts, sql.ts, repo/*.ts: member, access,
                      task, file, lock, allocation, request, proposal, review, event, notification},
                      services/{events, files, locks, tasks, requests, proposals, brief, github, git-message, diff,
                      heartbeat, report, activity (`bob/activity`), terminals (P1: relay + ring buffer)}, http/{auth, errors,
                      routes/*.ts}, ws/hub.ts
packages/sync/src/    cli, agent, watcher, known, writer, sidecar, notify, kit
packages/hooks/src/   brief, lock_guard, mark_ai_edit, stop, activity (helper kirim `bob.activity`, fire-and-forget)
packages/mcp/src/     main, client, tools/coder/*, tools/pm/*
packages/ui/src/      AgentTag, MemberChip, LockChip, WritingPulse, BobTrace, BriefMeter, DecisionCard,
                      ReviewCard, TaskCard, FeedItem, TerminalFrame, GuestCursor, PresenceStack,
                      views/{MissionControl, FilesLocks, TeamPanel}, theme-vars.css (bukan tokens.css, R5 §8)
packages/web/app/     demo/page.tsx, gallery/page.tsx, install/route.ts (P2)
```

## 3. Paket & dependensi

| Paket | Runtime deps | Dev deps | Build |
|---|---|---|---|
| `@radar/common` | `zod` | `vitest` | `tsc` → `dist/` (ESM) |
| `@radar/server` | `hono`, `diff`, `nanoid`, `zod`, `@radar/common` (CLI admin terpisah di `scripts/admin.ts` memakai `commander`) | `wrangler`, `@cloudflare/workers-types`, `@cloudflare/vitest-plugin`, `vitest@^4.1` (plugin belum mendukung vitest 5), `msw@^2.14` + `@msw/cloudflare`, `fast-check` | `wrangler deploy` (bundling esbuild bawaan wrangler) |
| `@radar/sync` | `chokidar@4`, `ws`, `commander`, `ignore`, `picocolors`, `@radar/common` | `vitest`, `wrangler` (`createTestHarness` untuk test integrasi) | `tsc`; `bin.radar = dist/cli.js` |
| `@radar/hooks` | (tidak ada saat runtime — dibundel) `@radar/common` | `esbuild`, `vitest` | `esbuild` → `bob-kit/coder/.bob/hooks/*.js` (CJS, node20, tanpa dependensi eksternal) |
| `@radar/mcp` | `@modelcontextprotocol/sdk`, `zod`, `@radar/common` | `esbuild`, `vitest` | `esbuild` bundle → `bob-kit/*/.bob/radar-mcp.js` (satu file) |
| `@radar/ui` | `react@19` (peer), `@radar/common`, `lucide-react`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | `vitest`, `@testing-library/react` | tanpa build: dikonsumsi sebagai source (alias Vite di Orca, `transpilePackages` di Next) |
| `@radar/web` | `next@15`, `react@19`, `zustand`, `@xterm/xterm` (replay frame), `diff2html` atau `react-diff-viewer-continued`, `@radar/common`, `@radar/ui` | `tailwindcss@4`, `@playwright/test` | `next build` (`output: 'export'`), deploy Cloudflare Pages |

Aturan: **hook dan radar-mcp harus bisa jalan di workspace toko-demo tanpa `npm install`**. Karena itu keduanya dibundel menjadi satu file JS mandiri memakai `fetch` bawaan Node 20.

## 4. Script root (`package.json`)

| Script | Isi |
|---|---|
| `build` | `pnpm -r build` |
| `typecheck` | `pnpm -r typecheck` |
| `test` | `pnpm -r test` |
| `lint` | `eslint .` |
| `format` | `prettier -w .` |
| `dev:server` | `pnpm --filter @radar/server exec wrangler dev` (Worker + DO + SQLite lokal di http://localhost:8787) |
| `deploy:server` | `pnpm --filter @radar/server exec wrangler deploy` |
| `admin` | `tsx scripts/admin.ts` (init, token --rotate, invite, export, reset lewat `/admin/*`) |
| `deploy:web` | `pnpm --filter @radar/web build && wrangler pages deploy packages/web/out --project-name ibm-bob-live-collab` |
| `dev:web` | `pnpm --filter @radar/web dev` |
| `dev:mock` | `tsx scripts/mock-server.ts --scenario demo` |
| `bundle:kit` | build hooks + mcp → isi `bob-kit/` |
| `sim` | `tsx scripts/sim-3pc.ts` |
| `bench:sync` | `tsx scripts/bench-sync.ts` |
| `metrics` | `tsx scripts/metrics.ts` |
| `secrets:scan` | `gitleaks detect --source .. --log-opts="--all"` |
| `evidence:check` | `tsx scripts/evidence-check.ts` (R7 §4) |
| `check:ignored` | `bash scripts/check-ignored.sh` — gagal kalau ada file sumber yang cocok pola `.gitignore` template IBM |
| `dev:app` | `pnpm -C ../app dev` (menjalankan app Live Collab) |

## 5. CLI

### `admin` (pengganti `radar-server`, memanggil endpoint `/admin/*` di Worker, butuh env `ADMIN_SECRET`)

```text
pnpm -C radar admin init --server <url> --workspace toko-demo --repo <owner>/toko-demo \
  --member "A:coder:Alice:alice@example.com" \
  --member "B:coder:Budi:budi@example.com" \
  --member "C:pm:Citra:citra@example.com" \
  --member "D:coder:Dani:dani@example.com"      # coder keempat untuk milestone & rekaman 4 Mac (fase 10/14)
  → Worker membaca tree repo lewat GitHub API, impor file teks ke tabel file (versi 1),
    buat anggota + token, cetak token SEKALI (A, B, C, dan token Mission Control).
pnpm -C radar admin token --member A --rotate  → token baru
pnpm -C radar admin invite --member B          → kode undangan rdr_inv_<base64url {v, server, workspace, member, token}> (P1, IN-02; merotasi token member)
pnpm -C radar admin export --out events.json [--with-terminals]  → sama dengan GET /v1/events/export
pnpm -C radar admin reset --confirm            → hapus semua data DO (hanya untuk dev/gladi)
```
Server sendiri tidak punya perintah `start`: lokal `pnpm -C radar dev:server` (wrangler dev), cloud `pnpm -C radar deploy:server`.

### `radar` (paket sync)

```text
radar join <server-url> --workspace toko-demo --as A --token <tok> [--dir .] [--no-kit] [--kit coder|pm]
  → tulis .radar/local.json, pasang kit .bob/, unduh snapshot, mulai memantau (foreground).
radar join --invite <rdr_inv_…> [--dir .]   → sama, server/workspace/member/token dari satu kode (IN-02, fase 12;
                                              atau env RADAR_INVITE agar kode tidak masuk riwayat shell)
radar start                    → pakai .radar/local.json yang ada, mulai memantau
radar status                   → server, member, jumlah file, kunci saya, koneksi
radar task use <T-id>          → set task aktif (P1)
radar kit install [coder|pm]   → pasang ulang .bob/ (setelah bundle baru)
radar agent --auto --max-cost <n>  → pemicu main agent otomatis di PC PM (SV-10, P1; dipotong ke roadmap di fase 12)
```

## 6. File lokal per PC (tidak disinkronkan, tidak di-commit)

| Path (di dalam workspace) | Isi |
|---|---|
| `.radar/local.json` | `{ "server": "https://…", "workspace": "toko-demo", "member": "A", "token": "…", "role": "coder", "shareprompts": false }` (`shareprompts` opsional, default `false`) |
| `.radar/state.json` | `{ "briefCursor": 1234, "lastBlock": {...} }` |
| `.radar/hook.log` | log hook (tanpa token) |
| `.radar/sync.log` | log sync agent |
| `.bob/` | kit yang dipasang `radar join` (diabaikan sync; boleh di-commit di toko-demo sebagai referensi) |

`.radar/` dan `*.radar-rejected`, `*.radar-conflict` wajib ada di `.gitignore` toko-demo.
