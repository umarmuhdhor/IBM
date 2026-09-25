# R6 — Rekomendasi model AI untuk menjalankan plan


## 0. Harness: Claude Code + ECC (v0.3)

Semua fase dijalankan di **Claude Code dengan plugin ECC** (`/plugin install ecc@ecc`). `PROMPT.md` memanggil agent dan skill ECC berikut. Nama bisa berubah antar versi, jadi cocokkan dengan `/plugin list ecc@ecc` di fase 00 dan catat di DECISIONS (D-alief-00).

| Kebutuhan | ECC (command / agent / skill) | Dipakai di langkah PROMPT |
|---|---|---|
| Rencana implementasi | `/ecc:plan` · agent `planner` (fase 03, 05, 09: juga `architect`) | 4 |
| Test dulu | skill `tdd-workflow` · agent `tdd-guide` | 5 |
| Review kode | `/ecc:code-review` · agent `code-reviewer`, `typescript-reviewer` | 7b, 8 |
| Keamanan | `/ecc:security-scan` · agent `security-reviewer` | 8 (fase 03, 05, 06, 07, 09, 11) |
| Build merah | `/ecc:build-fix` · agent `build-error-resolver` | 9 |
| Verifikasi | skill `verification-loop` | 9 |
| E2E UI | skill `e2e-testing` · agent `e2e-runner` | fase 11 (Playwright replay) |
| Dokumen | agent `doc-updater` | fase 14 |
| Simpan / lanjut sesi | `/ecc:save-session`, `/ecc:resume-session` | 12 |
| Eksplorasi codebase besar (Orca) | agent `code-explorer` | fase 09 (sebelum Bob slice C1, hanya untuk verifikasi) |

**Kerja paralel dalam satu lane:** buka worktree kedua (`git worktree add ../lc-<lane>-<topik> -b lane/<x>-<topik>`) dan jalankan sesi Claude Code kedua dengan `FASE` yang sama tetapi dibatasi ke sub-bagian (mis. "fase 11 bagian C: replay web saja"). Jangan menjalankan dua sesi pada file yang sama.

## 1. Pilihan model

| Tier | Model | ID API | Kekuatan | Kelemahan untuk proyek ini |
|---|---|---|---|---|
| Berat | **Claude Opus 5.5** | `claude-opus-5-5` | Penalaran paling dalam: konkurensi, state machine, invariant, debugging lintas paket, membaca log panjang | Lebih mahal dan lebih lambat; berlebihan untuk UI dan dokumen |
| Utama | **Claude Sonnet 5** | `claude-sonnet-5` | Seimbang: cepat, kuat untuk implementasi mengikuti spesifikasi jelas, UI, tool MCP, dokumen | Sesekali melewatkan kasus tepi konkurensi → itulah sebabnya fase 03–06 & 10 memakai Opus |
| Hemat | **Claude Haiku 4.5** | `claude-haiku-4-5-20251001` | Sangat cepat & murah untuk pekerjaan mekanis dengan instruksi eksplisit | Tidak disarankan untuk logika inti atau keputusan desain |

## 2. Rekomendasi per fase

| Fase | Model utama | Effort (Claude Code) | Alternatif | Kenapa | Mode Bob (bila dijalankan di IBM Bob) |
|---|---|---|---|---|---|
| 00 Fondasi | Sonnet 5 | medium | Haiku 4.5 (low) | Scaffolding mengikuti R1; mekanis tapi banyak file config yang harus konsisten | mode coding bawaan (mis. "Code") |
| 01 Spike | Sonnet 5 | medium | – | Menyiapkan script uji + menulis checklist manual yang presisi; hasilnya ditentukan manusia di Bob IDE | "Code" untuk script; "Ask" untuk membaca docs Bob |
| 02 Common + mock | Sonnet 5 | medium | – | Spesifikasi jelas (R3), banyak schema zod | "Code" |
| 03 Server inti | **Opus 5.5** | high | Sonnet 5 (high) | WebSocket hub, versi file, transaksi SQLite, auth — kesalahan di sini merambat ke semua fase | "Code" (+ "Plan"/"Architect" bila tersedia untuk review desain) |
| 04 Sync agent | **Opus 5.5** | high | Sonnet 5 (high) | Race watcher ↔ penulisan server, anti-gema, penulisan atomik, lintas OS | "Code" |
| 05 Kunci/task/proposal | **Opus 5.5** | high | – (jangan diturunkan) | Jantung produk. Tabel keputusan R4 + property test invariant | "Code" |
| 06 Git + diff + relay terminal | **Opus 5.5** | high | Sonnet 5 (high) | Git worker serial, kegagalan push, analisis importer, relay `term.*` + ring buffer | Bob slice A3/A4 |
| 07 Bob coder kit | Sonnet 5 | high | – | Integrasi Bob sesuai hasil spike; banyak detail kecil tapi tidak rumit secara algoritmik. **Jalankan di Bob** untuk bukti | "Code" di Bob (wajib ekspor sesi) |
| 08 Main agent PM | Sonnet 5 | high | Opus 5.5 untuk menulis deskripsi tool & instruksi mode | Kualitas deskripsi tool menentukan perilaku main agent | "Code" di Bob (wajib ekspor sesi) |
| 09 App desktop (fork Orca) | Sonnet 5 | high | Opus 5.5 untuk titik sambung Orca (renderer ↔ xterm, alias Vite) | Codebase besar & tooling ketat; perubahan aditif | Bob slice C1–C3 di Bob IDE (Ask/Plan untuk onboarding, Code untuk registrasi agent & komponen) |
| 10 Integrasi E2E | **Opus 5.5** | xhigh saat debugging | – | Menelusuri bug lintas server/sync/hook/UI dari log & event | "Code" + "Debug" bila tersedia |
| 11 Tonton terminal, `.dmg`, replay | Sonnet 5 | high | Opus 5.5 bila tap xterm/flow control bermasalah | Streaming terminal + packaging Electron + replay | Bob slice C4 (script bukti) |
| 12 Hardening P1 | Sonnet 5 | medium | Opus 5.5 untuk SY-07 reconnect | Fitur kecil terpisah; reconnect punya kasus tepi | "Code" |
| 13 Eksperimen A/B | Sonnet 5 | medium | Haiku 4.5 untuk tabulasi | Script metrik + laporan jujur | "Code"/"Ask" |
| 14 Submission | Sonnet 5 | medium | Haiku 4.5 untuk checklist, gitleaks, cek link | Menulis README juri, BOB_DEVELOPMENT.md, naskah video, deck | "Ask"/"Code" |

## 3. Aturan eskalasi & efisiensi

1. **Satu sesi per fase.** Mulai sesi baru (atau `/clear`) sebelum menempel prompt fase berikutnya. Konteks bersih = lebih sedikit halusinasi, lebih murah.
2. **Eskalasi:** gagal verifikasi 2× pada masalah yang sama dengan Sonnet → ulangi fase yang sama (baris `FASE:` sama, mode LANJUT) dengan Opus 5.5.
3. **Turunkan ke Haiku hanya** untuk: menyalin pola yang sudah ada, rename, mengisi tabel dari data, cek checklist. Jangan untuk kode fase 03–06, 10.
4. **Review silang murah:** setelah fase 05 selesai, jalankan satu sesi Sonnet 5 dengan prompt "review `packages/server/src/services/locks.ts` terhadap `plan/ref/R4-mesin-kunci.md`, laporkan selisih" sebelum lanjut.
5. **Effort:** `high` untuk Opus di fase inti; naikkan ke `xhigh` hanya saat debugging race yang tidak kunjung ketemu (fase 10). Sonnet cukup `medium`, `high` untuk fase 07/08.
6. **Budget Bobcoin (bila di IBM Bob):** fase 07, 08 dan uji manual main agent memakan Bobcoin paling banyak. Jadwalkan eksperimen A/B (fase 13) setelah memastikan sisa kuota tiap akun (PRD §18).

## 4. Model di dalam produk (runtime, bukan untuk membangun)

IBM Bob Live Collab sendiri tidak memanggil LLM langsung. Kecerdasan saat runtime berasal dari **IBM Bob** di setiap PC:
- Bob coder (mode `coder`) dan main agent (mode `pm-lead`) memakai model yang dikelola Bob.
- Server Radar, sync agent, hook, dan radar-mcp adalah kode deterministik tanpa API key LLM.
- Replay mode tidak memanggil model apa pun (PRD UI-05: tanpa API key).
- Konfirmasi di kickoff model watsonx mana yang dilarang (PRD §18 OQ 6) dan catat di `log/DECISIONS.md`.
