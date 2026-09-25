# IBM Bob Live Collab — Arsitektur teknis (1 halaman)

> Ringkasan yang mudah dibaca. Detail lengkap: [`PRD.md`](PRD.md) §12–§13 dan kontrak di [`plan/ref/`](plan/ref/) (R1 repo, R2 database, R3 API/WebSocket, R4 logika kunci).

---

## 1. Gambaran besar

```text
  LAPTOP SETIAP ANGGOTA (macOS)                         CLOUDFLARE (serverless, plan Free)
 ┌────────────────────────────────────────┐
 │ IBM Bob (IDE atau Bob Shell)           │  REST: cek kunci,   ┌───────────────────────────────────┐
 │   ├─ mode coder / pm-lead (.bob/)      │  task, usulan       │ Worker "live-collab" (Hono)       │
 │   ├─ hook: lock_guard, brief ──────────┼───────────────────► │   meneruskan semua ke ↓           │
 │   └─ MCP: radar-mcp ───────────────────┼───────────────────► │ Durable Object "toko-demo"        │
 │                                        │                     │   · WebSocket Hibernation         │
 │ App "IBM Bob Live Collab" (Electron)   │  WebSocket: event,  │   · SQLite bawaan: file, kunci,   │
 │   ├─ terminal bob, panel Live Collab ◄─┼─ persetujuan,       │     task, event, token (hash)     │
 │   └─ Share / Watch terminal ◄──────────┼─ frame terminal ──► │   · relay terminal                │
 │                                        │                     │   · pesan diproses 1 per 1        │
 │ Sync agent (CLI `radar`) ◄─────────────┼─ WebSocket: file ─► │     (kunci bebas race)            │
 │   pantau folder proyek ↔ server        │                     │   · commit via GitHub API ────────┼──► GitHub toko-demo
 └────────────────────────────────────────┘                     └────────────────┬──────────────────┘    (commit per task)
                                                                                 │ export event + frame (JSON)
                                                                                 ▼
                                                               ┌───────────────────────────────────┐
                                                               │ Cloudflare Pages: landing + /demo │
                                                               │ (statis, tanpa login & API key)   │
                                                               └───────────────────────────────────┘
```

Intinya:
- **Server hanya satu "ruang"**: satu Durable Object per workspace di Cloudflare. Semua laptop terhubung ke sana. Serverless: tidak ada VPS atau laptop yang harus nyala terus.
- **Kecerdasan AI 100% dari IBM Bob** di laptop masing-masing. Server tidak memanggil LLM apa pun.
- **Web (Cloudflare Pages) cuma untuk juri** dan tetap hidup walaupun server mati.

---

## 2. Komponen & tech stack

| Komponen | Jalan di | Tech stack | Folder | Lane |
|---|---|---|---|---|
| **Collab Server** | **Cloudflare Workers + Durable Objects** | TypeScript, **Hono** (REST), **WebSocket Hibernation API**, **SQLite bawaan Durable Object**, **GitHub REST API** (Octokit) untuk commit, zod, `diff` | `radar/packages/server` | Core (Alief) |
| **Sync agent** (`radar` CLI) | laptop | Node, **chokidar** (pantau file), ws | `radar/packages/sync` | Core |
| **Kontrak bersama** | – | TypeScript types + zod schema + reducer event | `radar/packages/common` | Core |
| **Hook Bob** | laptop, dipanggil Bob | Script Node kecil, dibundel **esbuild** jadi 1 file | `radar/packages/hooks` → `radar/bob-kit/*/.bob/hooks` | Bob |
| **radar-mcp** | laptop, dipanggil Bob | **MCP TypeScript SDK** (stdio) | `radar/packages/mcp` | Bob |
| **Custom mode** `coder`, `pm-lead` | laptop (Bob) | YAML `.bob/custom_modes.yaml` | `radar/bob-kit` | Bob |
| **App desktop** | laptop | **Electron 43** + **React 19** + zustand + **xterm** + Monaco + Tailwind/shadcn (basis: **Orca**) | `app/` | App |
| **Komponen UI bersama** | app + web | React | `radar/packages/ui` | App |
| **Landing + replay** | **Cloudflare Pages** | **Next.js 15** (`output: 'export'`, statis) + xterm (putar ulang terminal) | `radar/packages/web` | App (Imelda) |
| **Repo demo** `toko-demo` | GitHub | Vite + React (data sintetis) | `radar/examples/toko-demo` → repo terpisah | Core |

Toolchain: **Node 24 + pnpm 12** di semua laptop (`nvm use 24`).

---

## 3. Hosting & biaya

| Apa | Di mana | Biaya | Catatan |
|---|---|---|---|
| Collab Server | **Cloudflare Workers + Durable Objects** | **gratis** | `wrangler deploy` → `https://live-collab.<akun>.workers.dev`. Tanpa VPS atau volume. DO tidur saat sepi tapi WebSocket tetap tersambung. |
| Commit ke GitHub | **GitHub REST API** | gratis (5.000 request/jam) | 1 commit ≈ 4 + jumlah file request. Token khusus `toko-demo` = secret Worker. |
| Landing + replay | **Cloudflare Pages** | gratis | Statis, aman dari server mati. Satu akun dengan Worker. |
| Dev lokal | `wrangler dev` | gratis | Worker + DO + SQLite jalan di laptop, identik dengan cloud |
| Cadangan darurat | `wrangler dev` + Cloudflare Tunnel | gratis | Hanya kalau akun Cloudflare bermasalah saat demo |
| Kode | GitHub `umarmuhdhor/IBM` + `toko-demo` | gratis | – |
| App `.dmg` | GitHub Release | gratis | Tidak di-sign Apple → klik kanan → Open |

Kuota Workers Free: 100k request/hari. Pesan WebSocket masuk dihitung 20:1, pesan keluar gratis, dan SQLite DO gratis. Semua itu jauh di atas kebutuhan hackathon.

**Tidak dibutuhkan:** VPS, homelab yang nyala terus, database cloud, API key LLM, watsonx, atau OAuth. Token per anggota dibuat oleh `pnpm -C radar admin init`.

**Kenapa Durable Object cocok:**
- Satu objek per workspace menerima semua koneksi dan memproses pesan satu per satu, jadi dua Bob yang berebut file di milidetik yang sama tidak mungkin sama-sama menang, tanpa lock tambahan.
- Batas yang relevan: Worker depan 10 ms CPU per request (hanya meneruskan ke DO), DO 30 s CPU per pesan, dan pesan WebSocket hingga 32 MiB.

---

## 4. Lima alur utama

| # | Alur | Jalur data |
|---|---|---|
| 1 | **Edit live** | Bob A menulis file → sync agent A mengirim `file.update` → server menyimpan versi baru → `file.changed` ke laptop lain → file muncul di disk B & C (< 1 s) |
| 2 | **Blokir** | Bob B mau menulis `checkout.ts` → hook `PreToolUse` → `POST /v1/locks/check` → milik A → **exit 2** (edit batal) → Bob B memanggil MCP `why_blocked` → permintaan masuk ke "Needs you" PM |
| 3 | **Keputusan PM** | main agent C (`pm-lead`) memanggil MCP `propose_decision` → kartu di Mission Control → **manusia** C klik Approve → server menerapkan → brief di prompt B berikutnya |
| 4 | **Tonton terminal** | app A: Share → `term.frame` ke server → server me-relay ke penonton → xterm read-only di app B (< 500 ms) |
| 5 | **Review & commit** | B submit task → main agent `get_task_diff` + `propose_review` → C Approve → DO membuat commit lewat GitHub API (author coder, `Co-authored-by: IBM Bob`) → kunci dilepas / pindah antrean |

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
