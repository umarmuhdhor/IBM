# Fase 14 — Submission lablab: statement, bukti Bob, video ≤ 3 menit, deck, cover

| Field | Nilai |
|---|---|
| Jalur | Semua. **Lane Alief:** README juri, keamanan, repo publik · **Lane Umar:** `BOB_DEVELOPMENT.md`, `bob_sessions/`, IBM Bob Usage Statement · **Aarief:** rilis `.dmg` & uji pasang · **Imelda:** video, deck, cover, Long Description (Bob slice I3), form |
| Slot WITA | Min 27 Sep 11:00 – 23:00 (submit 19:00–21:00, buffer 21:00–23:00). Batas lablab: **Min 27 Sep 15:00 UTC = 23:00 WITA**. |
| Estimasi | 8 jam |
| Prasyarat | 11, 12, 13 (GATE 2 lewat) |
| Requirement PRD | §15 naskah video, §16 R0, EV-01..03, NFR-04, NFR-10, NFR-11 |
| Model | Sonnet 5 · effort medium (agent `doc-updater` untuk dokumen; Haiku 4.5 untuk cek link) |
| Fase berikutnya | – (selesai). Retrospektif di log. |

## Tujuan

Semua field form lablab terisi, dan setiap field didukung artefak di repo yang bisa dinilai juri sendirian.

## Checklist field form lablab → sumber

| Field form | Isi | Sumber di repo | Pemilik |
|---|---|---|---|
| Project Title | **IBM Bob Live Collab** | – | Imelda |
| Short Description | ≤ 1 kalimat, misalnya: "Google Docs for teams on IBM Bob: every teammate's own Bob, one live workspace, file locks enforced by Bob hooks, and a PM agent that plans, arbitrates and reviews." | `radar/docs/SUBMISSION.md` | Imelda |
| Long Description = **Problem & Solution Statement** | **≤ 500 kata**: masalah (angka + sumber), solusi, target user, cara user berinteraksi, kenapa kreatif dan unik (tabel pembanding singkat), cara mengatasi masalah secara baru | `radar/docs/SUBMISSION.md` §Long | Imelda |
| **IBM Bob Usage Statement** | **≤ 500 kata** (R7 §6): Bob sebagai runtime (hook, custom mode, MCP, agent di app) + Bob sebagai pembangun (slice per anggota, onboarding Orca, angka) + watsonx: not used | `radar/docs/SUBMISSION.md` §Bob, `BOB_DEVELOPMENT.md` | Umar |
| Technology & Category Tags | IBM Bob, Bob Shell, MCP, Electron, TypeScript, Node.js, WebSocket, SQLite, Next.js, Developer Tools, Collaboration, Multi-agent | SUBMISSION.md | Imelda |
| Public Code Repository | `https://github.com/umarmuhdhor/IBM` (publik) | – | Alief |
| IBM Bob Task Session Summary Screenshots | Unggah screenshot dari **setiap anggota** (pilih 1–3 terbaik per orang) + semuanya ada di `bob_sessions/` | `bob_sessions/INDEX.md` | Umar |
| Demo Application Platform | "macOS desktop app (Electron, fork of Orca) + web replay" | – | Imelda |
| Application URL | `https://ibm-bob-live-collab.pages.dev` = landing (tombol **Watch the live replay** → `/demo`, tombol **Download for macOS** → Release `.dmg`). Juri tidak perlu install apa pun. | `packages/web/app/page.tsx` (fase 11 langkah 17) | Imelda |
| Cover Image | 16:9, `radar/docs/deck/cover-16x9.png` | DESIGN §5.10, prompt_ui #10 | Imelda |
| Video Demonstration | **MP4 ≤ 3:00**, ≥ 90 detik solusi berjalan, narasi, pemakaian Bob jelas | `radar/docs/video/script.md` (PRD §15) | Imelda |
| Slide Presentation | PDF 10–12 slide | `radar/docs/deck/deck.pdf` | Imelda |

Cek kata: `wc -w` pada kedua statement harus ≤ 500. Simpan hasilnya di log.

## Langkah kerja

### A. Rekaman final (Min 09:00–12:00, pagi saat tim masih segar)

1. **Gladi & rekam** (LANGKAH MANUAL): reset server (`RECORD_TERMINALS=true`) dan toko-demo, 3 Mac dengan app `.dmg`. A memakai Bob IDE, B memakai Bob Shell di app, C memakai Mission Control + `pm-lead`. Rekam layar per Mac (QuickTime/OBS, 1080p) + audio narasi terpisah. 2 take penuh mengikuti PRD §15. Pantau Bobcoin: satu take ≈ 3–4 Bobcoin per akun.
2. Setelah take terbaik: `pnpm -C radar admin export --with-terminals > events.live-final.json`. Ekspor sesi Bob dari ketiga Mac (R7). Jalankan ulang `export-replay.ts` lalu deploy replay.
3. **Rotasi token** yang pernah tampil di layar (`pnpm -C radar admin token --rotate`).

### B. Video ≤ 3 menit (Imelda, dibantu Aarief untuk footage app)

4. Edit mengikuti tabel PRD §15. Sebelum ekspor, pastikan:
   - total ≤ 3:00 (targetkan 2:50 sebagai margin),
   - ≥ 90 detik solusi berjalan di layar (target ±120 s),
   - narasi Bahasa Inggris dan subtitle dibakar,
   - pemakaian Bob terlihat jelas: jejak `hook · PreToolUse`, mode `coder`/`pm-lead`, `radar-mcp`, cuplikan `bob_sessions/`,
   - agar menonjol di antara video screen-share lain: split 3 layar dengan label warna orang, zoom-in halus di momen near-miss, lower-third `BobTrace`, satu kalimat hook di 0:00, dan tanpa jeda mati.
5. Ekspor MP4 H.264 1080p. Cek durasi dengan `ffprobe`. Unggah take cadangan jam 17:00.

### C. Deck & cover (Imelda)

6. **Deck PDF (10–12 slide):** judul + cover · masalah (angka + sumber) · kenapa alat sekarang tidak cukup (tabel PRD §03) · solusi (3 aturan + tonton terminal) · main agent & governance (usul vs setujui) · arsitektur · demo (screenshot) · **IBM Bob di dalam produk** (hook, mode, MCP, agent di app) · **IBM Bob sebagai pembangun** (slice per anggota, onboarding Orca) · hasil eksperimen (jujur) · target user & model bisnis · roadmap + tim + link.
7. **Cover 16:9** dari screenshot Mission Control + prompt_ui #10.

### D. Statement & dokumen (Lane Umar + C, agent `doc-updater`)

8. `radar/docs/SUBMISSION.md`: title, short, Long Description (≤ 500 kata), IBM Bob Usage Statement (≤ 500 kata), tags, platform, URL, link repo/replay/Release/video/deck, anggota.
9. `BOB_DEVELOPMENT.md`:
   - bagaimana Bob membangun app ini (tabel slice dari `bob_sessions/INDEX.md`, dengan kutipan prompt),
   - bagaimana app memperluas Bob (YAML mode, tabel hook, 13 tool MCP, governance),
   - temuan spike Bob 2.x,
   - Bobcoin per anggota,
   - catatan `.bobignore` template (Bob tidak membaca `tsconfig.json`).
10. `bob_sessions/INDEX.md` final. Jalankan `pnpm -C radar evidence:check` sampai **hijau**: 3 anggota, masing-masing ≥ 3 slice lengkap, dan semua trailer valid.

### E. README juri, keamanan, repo (Lane Alief)

11. **README root (bagian juri)**: satu kalimat + GIF near-miss → **Tonton dalam 1 menit** (link replay + video) → masalah & solusi → pembanding → arsitektur (mermaid) → **Install** (`.dmg` + `radar-cli.tgz` + langkah Gatekeeper) → quickstart lokal tanpa Bob (`pnpm -C radar sim`) → cara pakai dengan Bob (kit, mode, MCP) → hasil eksperimen → keamanan → IBM Bob evidence (link INDEX) → tim, lisensi, **atribusi Orca**, "not an official IBM product".
12. `radar/docs/SECURITY.md` (model token, share terminal, hook berjalan dengan izin user, penyimpanan isi file di server) + rujukan `SECURITY.MD` template IBM.
13. **Pemindaian:** `gitleaks detect --source . --log-opts="--all" --redact` untuk repo produk dan `toko-demo`. `pnpm -C radar check:ignored` hijau. `git ls-files bob_sessions | wc -l` sama dengan jumlah file di disk, jadi tidak ada yang ter-ignore.
14. **Repo publik:** deskripsi, topik, website = URL replay. Hapus `radar/spike/out`, `.data`, dan video besar dari history kerja (jangan rewrite history tanpa persetujuan tim).

### F. Submit & buffer

15. **Submit (19:00–21:00)** (LANGKAH MANUAL, Imelda): isi form lablab dari `SUBMISSION.md`, unggah MP4, PDF, cover, dan screenshot ringkasan task setiap anggota. Screenshot konfirmasi → `radar/docs/submission-confirmation.png`.
16. **Buffer 21:00–23:00**, dari jendela incognito dan perangkat lain:
    - [ ] Repo publik tanpa login. README tampil (mermaid render). Atribusi Orca ada.
    - [ ] Landing `/` terbuka, dan tombol replay + download berfungsi.
    - [ ] `/demo` autoplay, Bob inside, link berfungsi.
    - [ ] Release `.dmg` bisa diunduh.
    - [ ] Video ≤ 3:00 bisa diputar. Solusi berjalan ≥ 90 s.
    - [ ] Kedua statement ≤ 500 kata (angka `wc -w` di log).
    - [ ] `evidence:check` hijau. Screenshot ringkasan task Bob IDE dari **keempat** anggota ada di `bob_sessions/` dengan pola `livecollab_<nama>_task<NN>_<slug>_summary.png`.
    - [ ] `DATA_SOURCES.md` lengkap (guide: daftar situs data publik). Semua data sintetis.
    - [ ] Video menunjukkan **Bob IDE** sebagai alat utama (syarat lolos penjurian).
    - [ ] Gitleaks bersih. Tidak ada token di video/deck/replay JSON.
17. Commit `fase-14: submission`, tag `v0.3.0-submit`, push. Retrospektif 10 baris di log.

## Verifikasi

```bash
gitleaks detect --source . --log-opts="--all" --redact
pnpm -C radar check:ignored && pnpm -C radar evidence:check && pnpm -C radar test
ffprobe -v error -show_entries format=duration -of csv=p=0 radar/docs/video/final.mp4   # ≤ 180
awk '/^## Long/{f=1;next}/^## /{f=0}f' radar/docs/SUBMISSION.md | wc -w                  # ≤ 500
awk '/^## IBM Bob Usage/{f=1;next}/^## /{f=0}f' radar/docs/SUBMISSION.md | wc -w         # ≤ 500
npx markdown-link-check README.md BOB_DEVELOPMENT.md radar/docs/*.md
```

## Kriteria selesai (DoD)

- [ ] Semua field form terisi dan terkirim sebelum 23:00 WITA (bukti screenshot).
- [ ] Video ≤ 180 s, statement ≤ 500 kata masing-masing.
- [ ] `evidence:check` hijau untuk 3 anggota.
- [ ] Token yang pernah tampil di footage sudah dirotasi.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Demo live gagal saat rekaman | Pakai footage per layar dari gladi + replay web |
| Video > 3 menit | Potong adegan "di balik layar" menjadi 15 s. Jangan memotong 90 s solusi. |
| Anggota kehabisan Bobcoin sebelum slice ketiga | Slice ketiga memakai mode Ask (murah), misalnya review kode. Catat jujur di INDEX. |
| Secret ditemukan pukul 20:00 | Rotasi segera, laporkan di SECURITY.md. Bersihkan history hanya bila tim setuju. |
