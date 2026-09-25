# IBM Bob Live Collab

Multiplayer for IBM Bob: every teammate keeps their own Bob account, and the whole team works in one live workspace, like Google Docs.

**Status: in development.** IBM Bob 2.0 Hackathon (lablab.ai), 25–27 Sep 2026.
Community hackathon project, not an official IBM product.

## For judges

| What | Where |
|---|---|
| IBM Bob evidence (task summaries of all four members) | [`bob_sessions/INDEX.md`](bob_sessions/INDEX.md) |
| How Bob built and powers the product | [`BOB_DEVELOPMENT.md`](BOB_DEVELOPMENT.md) |
| Live Collab code (server, sync agent, Bob hooks, MCP, UI, web replay) | [`radar/`](radar/) |
| Desktop app (Orca fork) | [`app/`](app/) |
| Security rules | [`SECURITY.MD`](SECURITY.MD) |

Install and demo instructions are added in phase 14.

---

## Dokumen tim (Bahasa Indonesia)

> Multiplayer untuk IBM Bob: setiap anggota memakai akun Bob sendiri, tapi semua bekerja di satu workspace live seperti Google Docs. Dikirim sebagai app desktop macOS (fork [Orca](https://github.com/stablyai/orca)).
> IBM Bob 2.0 Hackathon (lablab.ai) · Jum 25 Sep 23:00 → Min 27 Sep 23:00 WITA · community project, bukan produk resmi IBM.

## Baca dengan urutan ini

| # | File | Isi | Untuk siapa |
|---|---|---|---|
| 1 | [`PLAN.md`](PLAN.md) | **Mulai di sini.** Feasibility, 4 lane, branch, cara jalan dengan ECC, jadwal, bukti Bob, Bobcoin | semua (kirim ke teman) |
| 2 | [`ARCHITECTURE.md`](ARCHITECTURE.md) | **Arsitektur 1 halaman:** diagram, tech stack, hosting (Cloudflare Workers + Pages, gratis, tanpa VPS), 5 alur utama | semua |
| 3 | [`PRD.md`](PRD.md) | Produk: masalah, requirement (P0/P1), arsitektur, API, naskah video ≤ 3 menit, risiko | semua |
| 4 | [`DESIGN.md`](DESIGN.md) | Desain: token warna, font, komponen, wireframe tiap layar, peta integrasi Orca | Aarief & Imelda, juga Alief/Umar untuk UI |
| 5 | [`prompt_ui.md`](prompt_ui.md) | Prompt generate gambar mockup (11 layar) | Aarief |
| 6 | [`plan/`](plan/README.md) | Detail teknis per fase + satu prompt eksekusi (`plan/PROMPT.md`) + kontrak `plan/ref/` | AI masing-masing lane |
| – | [`UI Inspo & Design/`](UI%20Inspo%20%26%20Design) | Inspirasi (Orca, Amoeba, Mosaic) + mockup Stitch. **Hanya pedoman**, gaya app mengikuti Orca (DESIGN.md §0). | Aarief |
| – | `app/` | Kode app desktop = Orca (stablyai/orca@bf40d35, MIT). Node 24 + pnpm 12: `pnpm -C app install && pnpm -C app dev` | Lane Aarief |
| – | `CLAUDE.md` / `AGENTS.md` | Aturan otomatis untuk AI (lane, skill, gerbang UI, larangan nama file). Dibaca Claude Code/Bob setiap sesi. | semua |
| – | `.claude/` | Skill & agent bersama: `live-collab-app`, `electron-automation`, `electron-pro`, skill UI (`apple-design`, `better-interface` + `better-*`, `emil-design-eng`, `review-animations`), `brag-slim` (PLAN.md §11) | semua |
| – | [`plan/VERIFY_PROMPT.md`](plan/VERIFY_PROMPT.md) | Master prompt untuk AI lain: baca dan verifikasi seluruh plan (read-only) | siapa saja |
| – | [`DATA_SOURCES.md`](DATA_SOURCES.md) | Daftar sumber data (wajib menurut guide). Semua data kita sintetis. | semua |
| – | [`media-references/`](media-references/README.md) | Tautan referensi teknik multi-agent (gambar pihak ketiga tidak disalin ke repo) | semua |
| – | [`arsip/`](arsip/README.md) | Dokumen lama (v0.1, v0.2, riset ide, roast). Hanya referensi. | – |

## Prompt perkenalan untuk AI (jalankan sekali di awal)

Tempel ke Claude Code di root repo, ganti `<nama>`:

```text
Saya <nama> (Alief | Umar | Aarief | Imelda). Sebelum mulai kerja, pelajari repo ini tanpa mengubah file apa pun.
Baca berurutan: README.md → CLAUDE.md → PLAN.md → ARCHITECTURE.md → plan/README.md → plan/PROMPT.md →
file fase milik lane saya di plan/ (lihat tabel lane di PLAN.md §2) → plan/ref yang disebut di "Bacaan wajib" fase itu.
Skim saja: PRD.md (bagian yang disebut fase saya), DESIGN.md (kalau lane saya menyentuh UI), app/AGENTS.md (kalau saya Aarief).
Lalu jelaskan ke saya dengan singkat:
1. struktur folder repo dan mana yang boleh saya ubah,
2. tugas lane saya dan urutan fasenya,
3. ketergantungan ke lane lain dan placeholder apa yang akan dipakai,
4. Bob slice saya dan anggaran Bobcoin,
5. hal yang harus saya lakukan manual (akun, Bob IDE, Screen Recording).
Jangan mulai mengerjakan fase. Tunggu saya bilang "mulai".
```

Setelah itu, ketik perintah kerja (mode auto) di bawah.

## Mulai kerja dalam 3 langkah (per orang)

1. Baca `PLAN.md` §2 (lane kamu) dan §5 (jadwal).
2. Pasang Node 24 + pnpm 12 dan plugin di PLAN.md §11 (minimal ECC: `/plugin marketplace add https://github.com/affaan-m/ECC` lalu `/plugin install ecc@ecc`).
3. Salin prompt dari `plan/PROMPT.md`, ubah `LANE` dan `FASE`, lalu tempel ke Claude Code.

Repo ini = `github.com/umarmuhdhor/IBM` (**publik**). Jangan commit secret.

---

## Teknik multi-agent yang kita pakai

Referensi: artikel Akshay Pachaar, **"Subagents vs Agent Teams"** ([X article](https://x.com/akshay_pachaar/article/2033167408463069526)). Gambarnya milik penulis dan tidak kami salin ke repo. Tautan per diagram ada di [`media-references/README.md`](media-references/README.md).

### A. Produk: IBM Bob Live Collab = pola **Agent Teams** untuk Bob IDE

Diagram: [team lead + shared task list](https://pbs.twimg.com/media/HDcolYDbQAAthSB?format=jpg&name=large) (Akshay Pachaar).

| Konsep di artikel | Di IBM Bob Live Collab |
|---|---|
| Team Lead (assign + synthesize) | Bob IDE milik PM dalam mode **`pm-lead`**: menyusun rencana, membagi task dan file, me-review. Hanya **mengusulkan**, manusia yang menyetujui. |
| Teammates (sesi persisten) | Bob IDE setiap coder, dengan akun dan konteks masing-masing |
| Shared Task List | **Collab Server** (Durable Object): task, alokasi file, kunci, antrean, keputusan |
| Direct message / "API changed" | **Brief** lewat hook `UserPromptSubmit` + `notify` dari `pm-lead` (mis. "calculateTotal() berubah, dipakai Header.tsx") |
| `blockedBy` | **Kunci file + antrean**: Bob yang ingin menulis file milik rekan diblokir hook `PreToolUse`, lalu antre |
| *Tambahan kita, tidak ada di artikel* | Penegakan keras (hook exit 2), sinkron file live, dan persetujuan manusia untuk setiap keputusan |

Di dalam tim itu, `pm-lead` juga memakai pola **Subagents** (review dampak per task di konteks terisolasi) dan **Evaluator-Optimizer** (review → "send back" → coder memperbaiki).

### B. Proses membangun: tim manusia + AI kita sendiri

Diagram: [lima pola orkestrasi](https://pbs.twimg.com/media/HDcupB4bUAAQ7XB?format=jpg&name=large) (Akshay Pachaar).

| Pola | Cara kita memakainya |
|---|---|
| **Agent Teams** | 4 orang, masing-masing dengan Claude Code + Bob IDE, sebagai teammate. Shared task list = `plan/PROGRESS.md` + `plan/log/DECISIONS.md` + PR. |
| **Parallelization** | Lane Alief, Umar, Aarief, dan Imelda jalan paralel (pakai mock kalau belum ada hasil lane lain) |
| **Prompt chaining** | Satu fase = plan → test → implement → review → verify (`plan/PROMPT.md`) |
| **Routing** | Model per fase: Opus untuk konkurensi/server, Sonnet untuk mayoritas, Haiku untuk tugas mekanis (`plan/ref/R6`) |
| **Subagents** | Agent ECC (`planner`, `code-reviewer`, `security-reviewer`) jalan di konteks terisolasi dan hanya mengembalikan hasil ringkas |
| **Evaluator-Optimizer** | Review + `better-interface` diulang sampai tidak ada temuan HIGH |

Diagram: [split by context, not role](https://pbs.twimg.com/media/HDcscLeawAAmtxF?format=jpg&name=large) (Akshay Pachaar).

Prinsip yang kita ikuti: **bagi kerja menurut konteks, bukan menurut peran.** Lane dibagi per folder/bagian produk (server, kit Bob, app, web), bukan "planner → coder → tester". Di produk juga sama: `pm-lead` membagi task menurut **file** yang disentuh, sehingga setiap Bob punya batas konteks yang bersih.

### Apa yang dibagikan antar-anggota (dan apa yang tidak)

| Dibagikan | Tidak dibagikan |
|---|---|
| Isi file workspace (sinkron live) | Riwayat chat lengkap setiap Bob |
| Task, kunci, antrean, keputusan PM | Isi context window Bob orang lain |
| **Brief** ≤ 6 baris ke setiap Bob (siapa pegang apa, keputusan terbaru) | Transkrip sesi (kecuali ekspor `bob_sessions/` untuk juri) |
| **Aktivitas Bob** (ringkasan prompt, file yang dibaca/ditulis, blokir), dan prompt bisa dimatikan | Isi file di dalam aktivitas |

Alasannya: setiap Bob tetap punya konteks sendiri yang bersih (seperti teammate di Agent Teams). Yang dibagikan cukup ringkasan yang dibutuhkan untuk koordinasi, supaya Bobcoin hemat dan tidak ada "telephone game".

---

## Credits

Desktop app built on top of [Orca](https://github.com/stablyai/orca) (MIT) by Stably AI — vendored in `app/`. Orca's own README is [`app/README.md`](app/README.md); its license is [`app/LICENSE`](app/LICENSE).
