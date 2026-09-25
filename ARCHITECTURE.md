# IBM Bob Live Collab — Arsitektur teknis (1 halaman)

> Ringkasan yang mudah dibaca. Detail lengkap: [`PRD.md`](PRD.md) §12–§13 dan kontrak di [`plan/ref/`](plan/ref/) (R1 repo, R2 database, R3 API/WebSocket, R4 logika kunci).

---

## 1. Gambaran besar

```text
   LAPTOP SETIAP ANGGOTA (macOS)                              CLOUD
 ┌─────────────────────────────────────────┐
 │ IBM Bob (IDE atau Bob Shell)            │
 │   ├─ mode coder / pm-lead   (.bob/)     │   REST (cek kunci,     ┌──────────────────────────────┐
 │   ├─ hook: lock_guard, brief ───────────┼── task, usulan) ─────► │  COLLAB SERVER (1 proses)    │
 │   └─ MCP: radar-mcp ────────────────────┼──────────────────────► │  Node + Fastify              │
 │                                         │                        │  WebSocket hub               │
 │ App "IBM Bob Live Collab" (Electron)    │   WebSocket (event,    │  SQLite (file, kunci, task,  │
 │   ├─ terminal bob, panel Live Collab ◄──┼── persetujuan, frame   │          event)              │
 │   └─ Share / Watch terminal ◄───────────┼── terminal) ─────────► │  git worker ─────────────────┼──► GitHub (toko-demo)
 │                                         │                        │  hosting: Railway / Fly.io   │    commit per task
 │ Sync agent (CLI `radar`) ◄──────────────┼── WebSocket (isi file) │                              │
 │   pantau folder proyek ↔ server         │                        └──────────────┬───────────────┘
 └─────────────────────────────────────────┘                                       │ export event (JSON)
                                                                                   ▼
                                                            ┌──────────────────────────────────────┐
                                                            │ Vercel: landing + replay /demo       │
                                                            │ (statis, tanpa login & API key)      │
                                                            └──────────────────────────────────────┘
```

Intinya:
- **Server hanya satu.** Semua laptop terhubung ke sana.
- **Kecerdasan AI 100% dari IBM Bob** di laptop masing-masing. Server tidak memanggil LLM apa pun.
- **Web (Vercel) cuma untuk juri** dan tetap hidup walaupun server mati.

---

## 2. Komponen & tech stack

| Komponen | Jalan di | Tech stack | Folder | Lane |
|---|---|---|---|---|
| **Collab Server** | cloud (Railway/Fly.io) | Node 24, TypeScript, **Fastify** (REST), **ws** (WebSocket), **better-sqlite3** (SQLite), **simple-git**, zod, pino | `radar/packages/server` | Core |
| **Sync agent** (`radar` CLI) | laptop | Node, **chokidar** (pantau file), ws | `radar/packages/sync` | Core |
| **Kontrak bersama** | – | TypeScript types + zod schema + reducer event | `radar/packages/common` | Core |
| **Hook Bob** | laptop, dipanggil Bob | Script Node kecil, dibundel **esbuild** jadi 1 file | `radar/packages/hooks` → `radar/bob-kit/*/.bob/hooks` | Bob |
| **radar-mcp** | laptop, dipanggil Bob | **MCP TypeScript SDK** (stdio) | `radar/packages/mcp` | Bob |
| **Custom mode** `coder`, `pm-lead` | laptop (Bob) | YAML `.bob/custom_modes.yaml` | `radar/bob-kit` | Bob |
| **App desktop** | laptop | **Electron 43** + **React 19** + zustand + **xterm** + Monaco + Tailwind/shadcn (basis: **Orca**) | `app/` | App |
| **Komponen UI bersama** | app + web | React | `radar/packages/ui` | App |
| **Landing + replay** | Vercel | **Next.js 15** (statis) + xterm (putar ulang terminal) | `radar/packages/web` | App |
| **Repo demo** `toko-demo` | GitHub | Vite + React (data sintetis) | `radar/examples/toko-demo` → repo terpisah | Core |

Toolchain: **Node 24 + pnpm 12** di semua laptop (`nvm use 24`).

---

## 3. Hosting & biaya

| Apa | Di mana | Biaya | Catatan |
|---|---|---|---|
| Collab Server | **Railway** (utama) atau **Fly.io** | gratis sampai ±$5 | Wajib punya **volume** untuk SQLite + clone repo (`DATA_DIR`). Deploy dari GitHub, HTTPS/WSS langsung jadi. |
| Server cadangan / dev | laptop siapa pun + **Cloudflare Tunnel** (`cloudflared tunnel --url http://localhost:8787`) | gratis | Untuk dev dan kalau cloud bermasalah. Laptop tidak boleh tidur. |
| Landing + replay | **Vercel** | gratis | Statis, jadi aman dari server mati |
| Kode | GitHub `umarmuhdhor/IBM` (publik) + `toko-demo` | gratis | Server butuh token GitHub khusus `toko-demo` untuk push (disimpan di secret Railway, **bukan** di repo) |
| App `.dmg` | GitHub Release | gratis | Tidak di-sign Apple → klik kanan → Open |

**Tidak dibutuhkan:** VPS, database cloud (Postgres dan sejenisnya), API key LLM, watsonx, atau login OAuth. Token per anggota dibuat oleh `radar-server init`.

---

## 4. Lima alur utama

| # | Alur | Jalur data |
|---|---|---|
| 1 | **Edit live** | Bob A menulis file → sync agent A mengirim `file.update` → server menyimpan versi baru → `file.changed` ke laptop lain → file muncul di disk B & C (< 1 s) |
| 2 | **Blokir** | Bob B mau menulis `checkout.ts` → hook `PreToolUse` → `POST /v1/locks/check` → milik A → **exit 2** (edit batal) → Bob B memanggil MCP `why_blocked` → permintaan masuk ke "Needs you" PM |
| 3 | **Keputusan PM** | main agent C (`pm-lead`) memanggil MCP `propose_decision` → kartu di Mission Control → **manusia** C klik Approve → server menerapkan → brief di prompt B berikutnya |
| 4 | **Tonton terminal** | app A: Share → `term.frame` ke server → server me-relay ke penonton → xterm read-only di app B (< 500 ms) |
| 5 | **Review & commit** | B submit task → main agent `get_task_diff` + `propose_review` → C Approve → git worker commit file task (author coder, `Co-authored-by: IBM Bob`) → push GitHub → kunci dilepas / pindah antrean |

Dua lapis penegakan: **hook** mencegah Bob menulis, dan **server** menolak `file.update` dari bukan pemilik kunci. Lapis kedua ini juga menangkap edit manual dan `sed`.

---

## 5. Di laptop setiap anggota

| Terpasang | Untuk apa |
|---|---|
| IBM Bob IDE dan/atau Bob Shell (akun hackathon sendiri) | agent AI masing-masing |
| App IBM Bob Live Collab (`.dmg`) | terminal `bob`, Mission Control, Team, tonton terminal |
| `radar` CLI (sync agent) | sinkron folder proyek. Nanti dijalankan otomatis oleh app (P1). |
| `.bob/` kit di folder proyek (dipasang `radar join`) | mode, hook, `radar-mcp` |
| `.radar/local.json` (tidak di-commit) | URL server, member, token |

---

## 6. Keamanan singkat

- Token per anggota disimpan di server sebagai hash. Token PM (Mission Control) terpisah, dan hanya token itu yang bisa menyetujui usulan.
- Main agent **tidak punya** tool untuk menyetujui usulannya sendiri.
- Di app, token disimpan lewat Electron `safeStorage`, tidak masuk log.
- Share terminal mati secara default. Ketik tamu butuh izin host dan dibatasi 10 menit.
- Hook berjalan dengan izin penuh user. Hal ini diakui di dokumen keamanan.
- Repo publik: memakai `.gitignore`/`.bobignore` template IBM dan gitleaks di CI.

---

## 7. Mau baca lebih dalam?

| Topik | File |
|---|---|
| Requirement & alur lengkap | [`PRD.md`](PRD.md) §06–§13 |
| Struktur repo & paket | [`plan/ref/R1-struktur-repo.md`](plan/ref/R1-struktur-repo.md) |
| Skema database SQL | [`plan/ref/R2-skema-db.md`](plan/ref/R2-skema-db.md) |
| Semua endpoint REST, pesan WebSocket, event, tool MCP | [`plan/ref/R3-kontrak-api.md`](plan/ref/R3-kontrak-api.md) |
| Aturan kunci & state machine | [`plan/ref/R4-mesin-kunci.md`](plan/ref/R4-mesin-kunci.md) |
| Env var & konvensi | [`plan/ref/R5-konvensi.md`](plan/ref/R5-konvensi.md) |
| Desain UI | [`DESIGN.md`](DESIGN.md) |
