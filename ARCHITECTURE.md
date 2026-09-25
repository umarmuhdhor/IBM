# IBM Bob Live Collab — Arsitektur teknis (1 halaman)

> Ringkasan yang mudah dibaca. Detail lengkap: [`PRD.md`](PRD.md) §12–§13 dan kontrak di [`plan/ref/`](plan/ref/) (R1 repo, R2 database, R3 API/WebSocket, R4 logika kunci).

---

## 1. Gambaran besar

```text
  LAPTOP SETIAP ANGGOTA (macOS)                         CLOUDFLARE (serverless, plan Free)
 ┌────────────────────────────────────────┐
 │ IBM Bob IDE (wajib; Bob Shell opsional) │  REST: cek kunci,   ┌───────────────────────────────────┐
 │   ├─ mode coder / pm-lead (.bob/)      │  task, usulan       │ Worker "live-collab" (Hono)       │
 │   ├─ hook: lock_guard, brief ──────────┼───────────────────► │   meneruskan semua ke ↓           │
 │   └─ MCP: radar-mcp ───────────────────┼───────────────────► │ Durable Object "toko-demo"        │
 │                                        │                     │   · WebSocket Hibernation         │
 │ App "IBM Bob Live Collab" (Electron)   │  WebSocket: event,  │   · SQLite bawaan: file, kunci,   │
 │   ├─ terminal bob, panel Live Collab ◄─┼─ persetujuan,       │     task, event, token (hash)     │
 │   └─ Watch teammate's Bob ◄────────────┼─ aktivitas Bob ───► │   · siaran aktivitas Bob          │
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
| **Collab Server** | **Cloudflare Workers + Durable Objects** | TypeScript, **Hono** (REST), **WebSocket Hibernation API**, **SQLite bawaan Durable Object**, **GitHub Git Data API** (`fetch` langsung, R4 §6.3) untuk commit, zod, `diff` | `radar/packages/server` | Core (Alief) |
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
| Commit ke GitHub | **GitHub Git Data API** | gratis (5.000 request/jam) | 1 commit = 4 request berapa pun jumlah file (isi file inline di `POST trees`, tanpa `POST blobs`). Batas plan Free Workers = 50 subrequest per invocation tidak tersentuh; task > 100 file atau > 5 MB ditolak (`too_many_files`). Secondary limit GitHub: 80 request pembuat konten/menit. Commit memakai klaim dua transaksi karena `await fetch` membuka input gate DO (R4 §6.3). Token khusus `toko-demo` = secret Worker. |
| Landing + replay | **Cloudflare Pages** | gratis | Statis, aman dari server mati. Satu akun dengan Worker. |
| Dev lokal | `wrangler dev` | gratis | Worker + DO + SQLite jalan di laptop, identik dengan cloud |
| Cadangan darurat | `wrangler dev` + Cloudflare Tunnel | gratis | Hanya kalau akun Cloudflare bermasalah saat demo |
| Kode | GitHub `umarmuhdhor/IBM` + `toko-demo` | gratis | – |
| App `.dmg` | GitHub Release | gratis | Ad-hoc signed, tidak di-sign/notarize: buka lewat System Settings → Privacy & Security → **Open Anyway** (sejak macOS 15 Sequoia klik kanan → Open tidak lagi melewati Gatekeeper), atau `xattr -dr com.apple.quarantine "/Applications/IBM Bob Live Collab.app"` |

Kuota plan Free: Workers 100k request/hari; pesan WebSocket masuk dihitung 20:1, pesan keluar gratis, auto-response ping gratis. SQLite DO: **100k rows written/hari** (update index dihitung, `setAlarm` = 1 row) dan 5 juta rows read/hari, 5 GB per akun, 1 GB per DO. Kuota yang paling mungkin habis adalah rows written, jadi heartbeat tidak ditulis ke SQL, alarm hanya aktif selama ada kunci (R4 §7), dan frame terminal digabung per detik (fase 06 P1).

**Tidak dibutuhkan:** VPS, homelab yang nyala terus, database cloud, API key LLM, watsonx, atau OAuth. Token per anggota dibuat oleh `pnpm -C radar admin init`.

**Kenapa Durable Object cocok:**
- Satu objek per workspace menerima semua koneksi dan memproses pesan satu per satu, jadi dua Bob yang berebut file di milidetik yang sama tidak mungkin sama-sama menang, tanpa lock tambahan.
- Batas yang relevan: Worker depan 10 ms CPU per request (hanya meneruskan ke DO), 50 subrequest per invocation, DO 30 s CPU per pesan, pesan WebSocket hingga 32 MiB, baris SQLite 2 MB, statement SQL 100 KB / 100 parameter, attachment WebSocket 16 KiB, tag WebSocket tidak bisa diubah setelah `acceptWebSocket`.
- Hibernasi menghapus state memori dan menjalankan ulang constructor saat bangun. State per koneksi disimpan di `serializeAttachment`, state lain di SQLite.

---

## 4. Lima alur utama

| # | Alur | Jalur data |
|---|---|---|
| 1 | **Edit live** | Bob A menulis file → sync agent A mengirim `file.update` → server menyimpan versi baru → `file.changed` ke laptop lain → file muncul di disk B & C (< 1 s) |
| 2 | **Blokir** | Bob B mau menulis `checkout.ts` → hook `PreToolUse` → `POST /v1/locks/check` → milik A → **exit 2** (edit batal) → Bob B memanggil MCP `why_blocked` → permintaan masuk ke "Needs you" PM |
| 3 | **Keputusan PM** | main agent C (`pm-lead`) memanggil MCP `propose_decision` → kartu di Mission Control → **manusia** C klik Approve → server menerapkan → brief di prompt B berikutnya |
| 4 | **Tonton Bob rekan** | hook Bob IDE A (`UserPromptSubmit`/`PreToolUse`/`PostToolUse`/`Stop`) → `POST /v1/bob/activity` → DO menyiarkan `bob.activity` → timeline "Watching Andi's Bob" di app B (< 1 s). Bonus P1: terminal Bob Shell via `term.frame`. |
| 5 | **Review & commit** | B submit task → main agent `get_task_diff` + `propose_review` → C Approve → DO membuat commit lewat GitHub API (author coder, `Co-authored-by: IBM Bob`) → kunci dilepas / pindah antrean |

Dua lapis penegakan: **hook** mencegah Bob menulis, dan **server** menolak `file.update` dari bukan pemilik kunci. Lapis kedua ini juga menangkap edit manual dan `sed`.

---

## 5. Di laptop setiap anggota

| Terpasang | Untuk apa |
|---|---|
| **IBM Bob IDE ≥ 2.0.2** (akun hackathon `ibm-coding-challenge-uat`, us-east); Bob Shell opsional | agent AI masing-masing (wajib Bob IDE) |
| App IBM Bob Live Collab (`.dmg`) | Mission Control, Team, tonton Bob rekan (di samping Bob IDE) |
| `radar` CLI (sync agent) | sinkron folder proyek. Nanti dijalankan otomatis oleh app (P1). |
| `.bob/` kit di folder proyek (dipasang `radar join`) | mode, hook, `radar-mcp` |
| `.radar/local.json` (tidak di-commit) | URL server, member, token |

---

## 6. Keamanan singkat

- Token per anggota disimpan di server sebagai hash. Token PM (Mission Control) terpisah, dan hanya token itu yang bisa menyetujui usulan.
- Main agent **tidak punya** tool untuk menyetujui usulannya sendiri.
- Di app, token disimpan lewat Electron `safeStorage`, tidak masuk log.
- Aktivitas Bob tidak pernah berisi isi file. Prompt hanya dibagikan kalau anggota menyalakan "Share my prompts". Share terminal Bob Shell (P1) mati secara default.
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
