# IBM Bob Live Collab — Plan eksekusi tim (v0.3)

> Satu halaman untuk seluruh tim: siapa mengerjakan apa, di branch mana, dengan cara apa (Claude Code + ECC), kapan merge, dan bagaimana bukti IBM Bob dikumpulkan.
> Produk: [`PRD.md`](PRD.md) · Desain: [`DESIGN.md`](DESIGN.md) · Prompt gambar UI: [`prompt_ui.md`](prompt_ui.md) · Detail per fase: [`plan/`](plan/README.md)
> Event: IBM Bob 2.0 Hackathon (lablab.ai), **Jum 25 Sep 23:00 WITA → Min 27 Sep 23:00 WITA** (15:00 UTC).

---

## 0. Ringkasan 30 detik

- **Apa yang dibangun:** *IBM Bob Live Collab*, aplikasi desktop macOS (`IBM Bob Live Collab.app`, fork dari [Orca](https://github.com/stablyai/orca), MIT) plus server kecil. Tim yang masing-masing memakai **akun IBM Bob sendiri** bisa bekerja di **satu workspace live** seperti Google Docs:
  1. File yang ditulis Bob siapa pun langsung muncul di semua laptop.
  2. Satu file hanya boleh ditulis satu Bob. Ini ditegakkan oleh hook `PreToolUse` Bob dan server.
  3. Bob milik PM dalam mode `pm-lead` membagi kerja, menengahi rebutan file, dan me-review. Manusia yang menyetujui.
  4. **Baru di v0.3:** anggota tim bisa **menonton terminal Bob rekan secara live**. Ikut mengetik di terminal itu adalah bonus.
- **Tim:** Alief (server), Umar (integrasi Bob), Aarief (app desktop), Imelda (UI web, video, pitch).
- **Cara membangunnya:** 4 orang, 3 lane paralel, masing-masing dengan AI sendiri (Claude Code + plugin **ECC**). Semua memakai satu `PROMPT.md` dan cukup mengganti 2 baris (`LANE`, `FASE`).
- **Submit:** video MP4 ≤ 3 menit, 2 statement ≤ 500 kata, screenshot ringkasan task Bob dari **setiap** anggota (§10).
- **Bukti Bob:** setiap fase punya **Bob slice**, yaitu bagian nyata yang dikerjakan di Bob IDE. Hasilnya dikumpulkan sebagai ekspor sesi dan screenshot ringkasan task ke `bob_sessions/<nama>/`.

---

## 1. Apakah ini feasible? (jawaban jujur)

| Bagian | Feasible? | Dasar | Risiko utama → mitigasi |
|---|---|---|---|
| Tiap orang memakai akun Bob sendiri | Ya | Bob berjalan lokal di laptop masing-masing, dengan login masing-masing | – |
| Hook blokir di Bob | Ya untuk **Bob Shell**. Untuk Bob IDE dicek saat spike. | Docs Bob Shell: `PreToolUse` exit 2 memblokir, stdout `SessionStart`/`UserPromptSubmit` masuk konteks, config `.bob/settings.json` | Kalau hook di IDE tidak jalan, penegakan tetap ada di server + sync agent (lapis 2). Coder IDE tetap aman, hanya penjelasan dari Bob-nya yang lebih lemah. |
| Server tanpa VPS | Ya | **Cloudflare Workers + Durable Objects** (plan Free): WebSocket Hibernation, SQLite bawaan, satu DO per workspace. Commit lewat GitHub REST API. Web di Cloudflare Pages. Detail di `ARCHITECTURE.md` §3. | Tim belum familiar DO → plugin resmi `cloudflare@cloudflare` (skill `durable-objects`). Cadangan: `wrangler dev` + Cloudflare Tunnel. |
| File live sync | Ya | chokidar + WebSocket, sudah dirancang di plan v0.2 | Gema/loop → anti-gema berbasis hash (fase 04) |
| Orca (di `app/`) menjadi `.app` | **Ya, terbukti** | Di Mac Aarief (25 Sep): install 71 s, lalu build `.app` ad-hoc signed jadi (575 MB). Resepnya ada di fase 11 langkah 9: `app/mobile` wajib di-install, helper Computer Use dilewati, dan `CSC_NAME=-`. | App tidak di-sign Apple → klik kanan → Open. **Jangan buka build sebelum appId diganti** (fase 09 langkah 0), karena bisa bentrok dengan data Orca asli. |
| Menambah "IBM Bob" sebagai agent di Orca | Ya | Agent Orca didefinisikan di `src/shared/tui-agent.ts`, `tui-agent-config.ts`, `renderer/src/lib/agent-catalog.tsx` | Codebase Orca besar (~23k file) → perubahan **aditif** saja. Bob slice: Bob IDE membaca Orca dan menemukan titik sambungnya. |
| Tonton terminal Bob rekan | Ya | Renderer Orca memakai xterm. Output di-tap lalu dikirim lewat WebSocket server Live Collab, dan penonton membuka xterm read-only. | Relay bawaan Orca (`cloud/apps/relay`, Postgres) **tidak dipakai** karena terlalu berat. Kita buat relay ringan sendiri. |
| Ikut mengetik di terminal rekan | Ya, **bonus** | Input tamu diteruskan ke pty host setelah host mengizinkan | Bobcoin milik host yang terpakai. Keamanan: host harus menyalakan toggle. |
| Bobcoin | Ketat | **40 Bobcoin per akun** (guide Mei 2026) | Anggaran per orang (§7). Main agent dipanggil hanya saat perlu. `--max-cost`. |
| Aturan "Bob IDE harus jadi komponen inti" (guide Mei) | Ya | Demo: A memakai **Bob IDE**, B memakai **Bob Shell di dalam app Live Collab**, C (PM) memakai Bob mode `pm-lead` | Cek ulang guide 2.0 saat kickoff |

**Kesimpulan:** feasible untuk 48 jam **kalau** perubahan di Orca dibatasi ke sidebar/panel baru dan registrasi agent. Jangan refactor internal Orca (pty daemon, relay, mobile).

---

## 2. Tim, lane, dan kepemilikan file

Empat orang, tiga lane, semua berjalan paralel. **Batas lane = batas folder**, supaya merge hampir tidak pernah bentrok.

| Lane | Pemilik | Fokus | Fase | Folder yang BOLEH disentuh |
|---|---|---|---|---|
| **Alief · Core** | Alief | Collab Server di **Cloudflare Workers + Durable Objects**, sync agent, mesin kunci, commit via GitHub API, relay terminal | 00, 02, 03, 04, 05, 06, 12 | `radar/packages/{common,server,sync}`, `radar/scripts/{sim-3pc,bench-sync,mock-server}.ts`, `radar/examples/toko-demo`, root `radar/` config |
| **Umar · Bob** | Umar | Kit `.bob/`: mode `coder` + `pm-lead`, hook, `radar-mcp`, spike Bob, eksperimen, **koordinator bukti Bob** | 01, 07, 08, 13 | `radar/packages/{hooks,mcp}`, `radar/bob-kit`, `radar/spike`, `radar/scripts/{ab,metrics}*`, `bob_sessions/INDEX.md`, `BOB_DEVELOPMENT.md` |
| **Aarief/Imelda · App** | **Aarief** | App desktop (Orca di `app/`): agent `bob`, panel Live Collab, tonton terminal, `.dmg` | 09 (a, b, c-wiring), 11 (A, B, C) | `app/**`, `resources/` ikon |
| | **Imelda** | Komponen UI bersama `@radar/ui`, landing + replay web (Cloudflare Pages), video, deck, cover, statement submission | 09 (langkah 6: komponen), 11 (D: landing + replay), 14 (media & statement) | `radar/packages/{ui,web}`, `radar/docs/{deck,video,SUBMISSION.md}` |
| Bersama | Semua | Integrasi E2E, submission | 10, 14 | Masing-masing di foldernya sendiri |

Branch: `lane/core` (Alief), `lane/bob` (Umar), `lane/app` (Aarief), `lane/web` (Imelda). Aarief dan Imelda sama-sama merge ke `main`. Imelda mengubah `@radar/ui` dan Aarief memakainya di app, jadi sepakati props komponen di awal (DESIGN.md §3).

**Kontrak** (`radar/packages/common/**`, `plan/ref/**`) hanya diubah oleh **Lane Alief** lewat "contract PR". Lane Umar dan Lane Aarief/Imelda yang butuh perubahan menulis entri `DECISIONS.md` (prefix `D-umar-..`/`D-app-..`) lalu mention Lane Alief.

---

## 3. Struktur repo & branch

```text
github.com/umarmuhdhor/IBM            ← repo tim (milik Umar, SUDAH PUBLIK)
├── README.md PLAN.md PRD.md DESIGN.md prompt_ui.md   ← dokumen tetap di root
├── plan/  arsip/  "UI Inspo & Design"/
├── .claude/                          ← agent & skill bersama (§11), ikut ter-clone ke semua orang
├── app/                              ← Orca (Electron) disalin dari stablyai/orca@bf40d35, MIT. Lane Aarief/Imelda bekerja di sini.
├── radar/                            ← workspace pnpm Live Collab (dibuat fase 00): packages, bob-kit, spike, scripts, docs
├── bob_sessions/<nama>/NN-slug/{summary.png, task.md}
└── BOB_DEVELOPMENT.md
```

Toolchain: **Node 24 + pnpm 12** (syarat `app/`). `nvm install 24 && nvm use 24`, lalu `corepack enable`. Semua perintah memakai `pnpm -C app …` atau `pnpm -C radar …` karena root tidak punya `package.json`.

> Repo Umar **sudah publik**, jadi apa pun yang di-push langsung terlihat orang lain. Tidak ada secret yang boleh masuk, termasuk sebelum kickoff. Kalau tim mau menyembunyikan pekerjaan sampai submit, Umar bisa mengubahnya ke private sementara, lalu publik lagi sebelum Minggu 19:00.

| Branch | Isi | Siapa merge |
|---|---|---|
| `main` | Integrasi. Selalu bisa `pnpm -C radar test` dan `pnpm -C app tc` hijau | PR, di-review 1 orang lain (atau `/ecc:code-review` kalau semua sibuk) |
| `lane/core` | Lane Alief | Alief |
| `lane/bob` | Lane Umar | Umar |
| `lane/app` | Lane Aarief/Imelda: app desktop | Aarief |
| `lane/web` | Lane Aarief/Imelda: `@radar/ui` + web + media | Imelda |
| `lane/<x>-<topik>` | Sub-branch opsional untuk AI kedua di lane yang sama (worktree) | pemilik lane |

**Agar AI tidak menganggur:** satu orang boleh menjalankan **2 sesi Claude Code sekaligus** di 2 git worktree (`git worktree add ../br-app-replay lane/app-replay`). Orca sendiri adalah pengelola worktree, jadi kalian bisa memakai Orca untuk menjalankan lane masing-masing. Setiap lane punya daftar **"kerjaan saat menunggu"** (§5) yang hanya butuh mock server.

---

## 4. Cara menjalankan fase dengan ECC

### 4.1 Pasang sekali (setiap orang, sebelum kickoff)

```bash
# di Claude Code
/plugin marketplace add https://github.com/affaan-m/ECC
/plugin install ecc@ecc
/plugin list ecc@ecc          # catat nama command/agent yang benar-benar ada → DECISIONS.md
```

### 4.2 Siklus per fase (ditegakkan oleh `plan/PROMPT.md`)

| Langkah | Alat ECC | Output |
|---|---|---|
| 1. Baca fase + kontrak | – | todo list |
| 2. Rencana implementasi | `/ecc:plan` (agent **planner**) | rencana singkat di log fase |
| 3. Test dulu | skill **tdd-workflow** (agent **tdd-guide**) | test merah |
| 4. Implementasi | – | test hijau |
| 5. **Bob slice** | Berhenti. Manusia mengerjakan bagian yang ditandai di Bob IDE, lalu `bob-evidence.sh` | `bob_sessions/<nama>/NN-*` |
| 6. Review | `/ecc:code-review` (agent **code-reviewer** + **typescript-reviewer**) | temuan diperbaiki |
| 7. Keamanan (fase 03, 05, 07, 11) | `/ecc:security-scan` (agent **security-reviewer**) | bersih |
| 8. Verifikasi | skill **verification-loop**; kalau build merah → `/ecc:build-fix` (agent **build-error-resolver**) | semua perintah "Verifikasi" hijau |
| 9. Simpan | `/ecc:save-session`, commit, update `PROGRESS.md` | siap PR |

Nama command bisa berubah antar versi ECC. Kalau `/plugin list` menunjukkan nama lain, pakai padanannya dan catat di `DECISIONS.md`.

### 4.3 Prompt satu baris per orang

Salin blok di [`plan/PROMPT.md`](plan/PROMPT.md), ubah dua baris, lalu tempel ke Claude Code di root repo:

```text
LANE: Aarief
FASE: 09
```

Model per fase ada di `plan/README.md` §3 dan `plan/ref/R6-model-ai.md`.

---

## 5. Jadwal (WITA) & urutan per lane

### 5.1 Sebelum kickoff (hari ini, **setup saja, tanpa kode produk**)

Kode proyek baru mulai ditulis setelah kickoff. Setup lingkungan boleh dilakukan sebelumnya (cek ulang aturan saat kickoff).

| Siapa | Tugas |
|---|---|
| Semua | Node 20+, pnpm 9, git ≥ 2.38, Xcode CLT, `gh auth login`, Claude Code + **ECC**. Bob IDE ≥ 2.0.1 + Bob Shell (`bob --version`). Login akun Bob hackathon begitu dibagikan. |
| Aarief | ✅ Orca di `app/` (commit `7c86819`) · ✅ install · ✅ build `.app`. Sisa: pasang plugin §11 (ECC, typescript-lsp, frontend-design), Bob IDE + Bob Shell, dan generate gambar yang belum ada (#12 landing). |
| Alief | Buat **akun Cloudflare** (plan Free), `npx wrangler login`, dan coba deploy contoh Durable Object WebSocket. Pasang plugin `cloudflare@cloudflare`. Buat repo kosong `toko-demo` + fine-grained token GitHub. |
| Umar | Baca docs Bob: hooks (Shell & IDE), custom modes, MCP, `bob run`. Siapkan checklist spike. |

### 5.2 Selama hackathon

| Waktu | Alief · Core | Umar · Bob | Aarief · App desktop | Imelda · UI & web |
|---|---|---|---|---|
| Jum 23:00–Sab 00:30 | **00 Fondasi** di `main` | Kickoff: baca guide 2.0, catat aturan bukti & Bobcoin | **Bob slice C1**: Bob memetakan titik sambung Orca | Kickoff. Siapkan `@radar/ui` (tokens, Tailwind) setelah 00 |
| Sab 00:30–02:30 | **02 Common + mock** → `main` = **kontrak beku** | **01 Spike** | **09a** agent `bob` + ganti appId | **Bob slice I1**: `LockChip`, `AgentTag`, `DecisionCard` |
| Sab 02:30–04:00 | 03 Server (Worker + DO) mulai | 01 → **GATE 1 (04:00)** | 09b koneksi Live Collab melawan mock | sisa komponen + halaman `/gallery` |
| Sab 04:00–09:00 | 03 → 04 Sync agent | Tidur | Tidur | Tidur |
| Sab 09:00–16:00 | Tidur 09–14 → 05 Kunci/task/proposal | **07** Kit coder (**di Bob IDE**) | **09c** pasang panel Live Collab di app | views `MissionControl`/`TeamPanel`/`FilesLocks` di `@radar/ui` + **I2** landing |
| **Sab 16:00** | **Sinkron 1:** semua lane merge ke `main`, uji melawan Worker staging | | | |
| Sab 16:00–21:00 | 05 → 06 GitHub API + diff + relay terminal | **08** `pm-lead` (**di Bob IDE**) | **11a** tonton terminal | **11 D** replay player + `/demo` (fixture) |
| **Sab 21:00–23:00** | **10 Integrasi E2E** di `main` → **Milestone 23:00** di 4 laptop | | | |
| Sab 23:00–Min 04:00 | Perbaikan E2E, tidur bergilir | Tidur 23:30–04:30 | **11b** `.dmg`, tidur 01:00–06:00 | naskah video + storyboard, tidur 00:00–05:00 |
| Min 04:00–11:00 | **12** Hardening | **13** Eksperimen, cek `bob_sessions/` | 11c polish + ketik tamu (bonus) | rekam footage 09:00, replay dari rekaman nyata |
| **Min 11:00** | **GATE 2: feature freeze** | | | |
| Min 11:00–19:00 | 14: README juri, gitleaks | 14: `BOB_DEVELOPMENT.md`, Bob Usage Statement | 14: rilis `.dmg`, uji pasang | 14: **video, deck, cover, Long Description** |
| Min 19:00–21:00 | **Submit** (Imelda isi form) | | | |
| Min 21:00–23:00 | Buffer: cek incognito, link, video, tidak ada secret | | | |

### 5.3 Kerjaan saat menunggu (AI tidak boleh menganggur)

| Lane | Kalau terblokir, kerjakan ini (cukup melawan mock) |
|---|---|
| A | Property test invariant kunci (R4), `bench-sync`, `sim-3pc` skenario tambahan, endpoint `/v1/files/history` |
| B | Tambahan fixture payload hook, test MCP per role, prompt siap tempel `bob-kit/prompts/*`, draft `BOB_DEVELOPMENT.md` |
| C | Storybook-like halaman `radar/packages/web/app/gallery` untuk semua komponen `@radar/ui`, kondisi kosong & error, screenshot cover, naskah video |

---

## 6. Aturan merge (singkat)

1. PR kecil, satu fase atau setengah fase. Judul `fase-XX: …`.
2. CI hijau: `pnpm -C radar typecheck && pnpm -C radar test`. Untuk perubahan `src/**`: `pnpm -C app tc` dan test Orca yang terkait saja. Jangan jalankan seluruh `pnpm lint` Orca karena terlalu lama. Pakai `oxlint` pada file yang diubah.
3. Kontrak diubah hanya lewat contract PR Lane Alief. Setelah itu lane lain **rebase** (jangan merge `main` bolak-balik).
4. `PROGRESS.md`: setiap lane hanya mengedit baris fasenya sendiri. `DECISIONS.md`: append-only dengan ID ber-prefix lane (`D-alief-07`, `D-umar-03`, `D-app-02`), jadi tidak ada tabrakan nomor.
5. Titik sinkron wajib: **Sab 02:30** (kontrak), **Sab 16:00** (sinkron 1), **Sab 21:00** (E2E), **Min 11:00** (freeze).

---

## 7. Bukti IBM Bob (wajib juri) & anggaran Bobcoin

Aturan: *"Your repository must include the code/files where IBM Bob assisted, plus IBM Bob task session summary screenshots from each team member."* Detail lengkap ada di [`plan/ref/R7-bukti-bob.md`](plan/ref/R7-bukti-bob.md).

**Kenapa tidak bisa otomatis penuh:** Claude Code/ECC tidak bisa mengklik UI Bob IDE. Jadi alurnya setengah otomatis:

1. Prompt fase berhenti di **Bob slice** dan mencetak prompt Bob yang siap tempel.
2. Manusia menjalankan prompt itu di Bob IDE, lalu membuka History → task → klik header task → **Export task history**.
3. `radar/scripts/bob-evidence.sh <nama> <NN-slug>` menjalankan `screencapture -i` untuk ringkasan task, mengambil file `.md` ekspor terbaru dari `~/Downloads`, memindahkan keduanya ke `bob_sessions/<nama>/<NN-slug>/`, dan menambah baris ke `bob_sessions/INDEX.md`.
4. Commit kode hasil Bob dengan trailer `Bob-Assisted: bob_sessions/<nama>/<NN-slug>`.
5. `pnpm -C radar evidence:check` (fase 14) memastikan setiap anggota punya screenshot + md dan setiap trailer menunjuk ke folder yang ada.

**Bob slice per lane** (bagian yang benar-benar dibangun Bob):

| # | Pemilik | Bob slice | Mode Bob | Estimasi Bobcoin |
|---|---|---|---|---|
| A1 | Alief | Repo contoh `toko-demo` (8 file + 6 task eksperimen) | Code | 3 |
| A2 | Alief | `checkWrite()` tabel keputusan kunci + test tabel R4 §3 | Code | 4 |
| A3 | Alief | Commit per task lewat GitHub API + trailer `Co-authored-by: IBM Bob` | Code | 3 |
| A4 | Alief | `/review` Bob atas `locks.ts` vs R4 (review silang) | Ask/Code | 2 |
| B1 | Umar | Spike: hook payload logger + mode read-only | Code | 4 |
| B2 | Umar | `custom_modes.yaml` coder + pm-lead | Code | 3 |
| B3 | Umar | Hook `lock_guard` + `brief` | Code | 5 |
| B4 | Umar | `radar-mcp` tool coder + PM | Code | 6 |
| C1 | Aarief | **Onboarding Orca dengan Bob:** "di mana agent didefinisikan dan cara menambah agent baru" → laporan HTML Bob | Ask/Plan | 3 |
| C2 | Aarief | Registrasi agent `bob` di Orca (3 file) | Code | 3 |
| C4 | Aarief | Script `bob-evidence.sh` + `evidence:check` | Code | 2 |
| I1 | Imelda | Komponen `@radar/ui`: `LockChip`, `AgentTag`, `DecisionCard` + test | Code | 4 |
| I2 | Imelda | Landing page `/` (Application URL) | Code | 3 |
| I3 | Imelda | Draf Long Description + outline deck dari PRD (**document understanding** Bob: baca `PRD.md`, hasilkan `.docx`/HTML) | Ask/Code | 3 |

Setiap orang minimal 3 slice (syarat `evidence:check`).

**Anggaran per akun (40):** build slices ±20 · gladi + rekam demo ±12 · cadangan 8. Eksperimen A/B (fase 13) dijalankan dengan akun yang masih paling banyak sisa. Kalau kurang, jumlah putaran dikurangi dan hal itu **dilaporkan jujur**.

---

## 8. Distribusi ke teman (cara install, ala Mosaic)

| Komponen | Cara pasang | Prioritas |
|---|---|---|
| App desktop | `IBM Bob Live Collab.dmg` di GitHub Releases → seret ke Applications → klik kanan → Open (tidak di-sign) | P0 |
| CLI `radar` (sync agent + kit) | `npm i -g https://github.com/umarmuhdhor/IBM/releases/download/v0.3.0/radar-cli.tgz` | P0 |
| One-liner | `curl -fsSL https://ibm-bob-live-collab.pages.dev/install \| sh` → cek node & `bob`, pasang CLI, `radar join --invite <kode>` | P1 |
| Undangan | `pnpm -C radar admin invite --member B` → kode `rdr_inv_…` (URL server + token, base64url) | P1 |

Di dalam app: **Settings → Live Collab → tempel kode undangan**. App lalu menjalankan sync agent sebagai child process, memasang `.bob/` kit, dan mengecek `bob` CLI, hook, dan MCP (checklist hijau di onboarding, lihat DESIGN §5.9).

---

## 9. Definisi selesai (R0 · submit)

- [ ] Semua P0 PRD v0.3 punya test hijau atau bukti manual di `plan/log/`.
- [ ] Alur demo penuh jalan di 3 laptop: rencana → live → blokir → keputusan → review → commit GitHub, **ditambah tonton terminal Bob rekan**.
- [ ] `IBM Bob Live Collab.dmg` terunggah di Releases dan terpasang di 3 Mac.
- [ ] Replay `/demo` jalan tanpa login dan tanpa API key.
- [ ] `bob_sessions/` berisi screenshot ringkasan + ekspor md dari **ketiga** anggota. `evidence:check` hijau.
- [ ] Video MP4 **≤ 3 menit** (≥ 90 detik solusi berjalan, narasi, pemakaian Bob jelas), deck PDF, cover 16:9, gitleaks bersih, repo publik.
- [ ] **Long Description (Problem & Solution) ≤ 500 kata** dan **IBM Bob Usage Statement ≤ 500 kata** di `radar/docs/SUBMISSION.md`.

---

## 10. Yang dinilai & yang dikirim (lablab 2.0)

| Kriteria juri | Jawaban kita | Di mana terlihat |
|---|---|---|
| **Application of Technology** (lengkap + jelas memakai Bob 2.0) | Bob adalah runtime produk (hook menegakkan kunci, custom mode `coder`/`pm-lead`, MCP `radar-mcp`, `bob` di app) **dan** alat bangun (Bob slice semua anggota) | video 2:25–2:50, `BOB_DEVELOPMENT.md`, panel "Bob inside" di replay |
| **Presentation** | Video 3 menit dengan satu momen near-miss yang jelas, 3 layar berlabel warna, replay yang bisa diklik juri | PRD §15, DESIGN §5.4 |
| **Business Value** | 41,7% pasangan PR agent berkonflik, review +91%. Tim yang sudah membeli Bob butuh cara bekerja bersama. | Long Description, deck slide 2 |
| **Originality** | Multiplayer pertama yang native di primitif Bob (penegakan lewat hook, bukan saran), PM agent yang hanya mengusulkan, tonton terminal Bob rekan | tabel PRD §03 |

Form lablab (detail di [`plan/fase-14-submission.md`](plan/fase-14-submission.md)): Title · Short Description · Long Description (≤ 500 kata) · **IBM Bob Usage Statement (≤ 500 kata)** · Tags · Public repo · **Screenshot ringkasan task Bob dari setiap anggota** · Demo Application Platform · Application URL · Cover · Video MP4 ≤ 3:00 · Slide PDF.

Repo memakai file keamanan dari [ibm-hackathon-template](https://github.com/watsonxhackathon/ibm-hackathon-template) (`.gitignore`, `.bobignore`, `SECURITY.MD`). **Awas:** `.gitignore` template mengabaikan file baru yang namanya mengandung `token`, `secret`, `password`, `credentials`, atau bernama `config.json`, jadi jangan beri nama file seperti itu (R5 §8, dicek otomatis oleh `check:ignored`).

---

## 11. Skill & agent wajib untuk setiap orang

Supaya AI keempat orang bekerja dengan standar yang sama. **Yang ada di `.claude/` repo otomatis terbawa saat clone**, jadi tidak perlu dipasang. Sisanya dipasang sekali per orang sebelum kickoff.

### 11.1 Semua orang

| Skill / plugin | Pasang | Dipakai untuk |
|---|---|---|
| **ECC** (planner, tdd-workflow, verification-loop, code-reviewer, typescript-reviewer, security-review, build-error-resolver, `git-workflow`) | `/plugin marketplace add https://github.com/affaan-m/ECC` → `/plugin install ecc@ecc` | siklus setiap fase (PROMPT.md) |
| **typescript-lsp** (resmi) | `/plugin install typescript-lsp@claude-plugins-official` | navigasi & diagnosa TypeScript, penting di codebase Orca yang besar |
| **Context7** (MCP, sudah tersambung di akun Aarief) | connector claude.ai | dokumentasi terbaru Electron, Cloudflare Workers/Durable Objects, Hono, Next.js, MCP SDK, xterm |
| Skill pribadi yang sudah ada di Mac Aarief: `investigate-first`, `surgical-patch`, `safe-refactor`, `verify-and-stop` | sudah terpasang (Aarief). Teman boleh menyalin dari `~/.claude/skills/` Aarief. | perubahan kecil & aman di kode Orca |

### 11.2 Lane Aarief/Imelda · App

Aarief memakai semua baris di bawah. Imelda minimal: ECC React/frontend, `frontend-design`, `e2e-testing`, `nextjs-turbopack`, `remotion-video-creation`, `video-editing`, dan `frontend-slides`.

| Skill / agent | Sumber | Dipakai untuk |
|---|---|---|
| **`live-collab-app`** | `.claude/skills/` (repo) | aturan kerja di `app/`: aditif, gaya ikut Orca, Node 24, perintah tc/oxlint/test/build |
| **`electron-automation`** | `.claude/skills/` (repo, dari fcakyon/claude-codex-settings, Apache-2.0) | membuka app dev dengan `--remote-debugging-port`, lalu screenshot & klik lewat `npx agent-browser`. Dengan ini Claude bisa **melihat UI buatannya sendiri**. |
| **`electron-pro`** (agent) | `.claude/agents/` (repo, dari VoltAgent, MIT) | main/preload/IPC, `safeStorage`, keamanan, electron-builder/.dmg |
| ECC `react-patterns`, `react-testing`, `react-performance`, `frontend-patterns`, `frontend-a11y`, `design-system`, `e2e-testing`, `nextjs-turbopack` + agent `react-reviewer`, `react-build-resolver`, `a11y-architect` | ECC | komponen `@radar/ui`, panel Live Collab, replay Next.js, Playwright |
| **frontend-design** (resmi) | `/plugin install frontend-design@claude-plugins-official` | landing & replay web supaya tidak terlihat generik |
| ECC `remotion-video-creation`, `video-editing`, `frontend-slides` | ECC | video ≤ 3 menit & deck (fase 14) |
| Skill Orca `orca-cli`, `orchestration` | `app/skills/` | memakai Orca sendiri untuk menjalankan beberapa agent/worktree paralel |

### 11.3 Lane Alief · Core

| Skill / agent | Dipakai untuk |
|---|---|
| **Cloudflare (resmi)**: `/plugin marketplace add cloudflare/skills` → `/plugin install cloudflare@cloudflare`. Isinya skill `durable-objects`, `workers-best-practices`, `wrangler`, `nextjs-on-cloudflare` + MCP Cloudflare | Worker + Durable Object + WebSocket Hibernation + SQLite DO + deploy |
| ECC `backend-patterns`, `api-design`, `security-review` | desain REST/WS, auth token |
| ECC agent `database-reviewer`, `silent-failure-hunter`, `performance-optimizer` | skema SQLite, error yang tertelan, latensi sinkron/relay |
| ECC `mcp-server-patterns` | review kontrak yang dipakai radar-mcp |

### 11.4 Lane Umar · Bob

| Skill / agent | Dipakai untuk |
|---|---|
| **mcp-server-dev** (resmi): `/plugin install mcp-server-dev@claude-plugins-official` + ECC `mcp-server-patterns` | `radar-mcp` (stdio, tool coder & PM) |
| ECC `documentation-lookup` / agent `docs-lookup` + Context7 | docs Bob (hooks, custom modes, MCP, `bob run`) |
| ECC `tdd-workflow` (hook diuji dengan stdin fixture) | hook `lock_guard`, `brief` |
| **IBM Bob sendiri** (Bob IDE + Bob Shell) | Bob slice B1–B4. Lane Umar adalah pemakai Bob paling berat. |

### 11.5 Cek sebelum kickoff (setiap orang)

Di Claude Code: `/plugin list`, lalu pastikan ada `ecc`, `typescript-lsp`, serta `frontend-design` (Lane Aarief/Imelda) atau `mcp-server-dev` (Lane Umar). Di terminal:

```bash
ls .claude/skills .claude/agents          # dari repo: electron-automation, live-collab-app, electron-pro
node -v    # v24.x
pnpm -v    # 12.x
bob --version
```
