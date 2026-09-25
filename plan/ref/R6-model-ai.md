# R6 — Rekomendasi model AI untuk menjalankan plan

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
| 06 Git + diff | **Opus 5.5** | high | Sonnet 5 (high) | Git worker serial, kegagalan push, analisis importer | "Code" |
| 07 Bob coder kit | Sonnet 5 | high | – | Integrasi Bob sesuai hasil spike; banyak detail kecil tapi tidak rumit secara algoritmik. **Jalankan di Bob** untuk bukti | "Code" di Bob (wajib ekspor sesi) |
| 08 Main agent PM | Sonnet 5 | high | Opus 5.5 untuk menulis deskripsi tool & instruksi mode | Kualitas deskripsi tool menentukan perilaku main agent | "Code" di Bob (wajib ekspor sesi) |
| 09 Mission Control | Sonnet 5 | medium | – | UI React/Next dari layout PRD §11 | "Code" |
| 10 Integrasi E2E | **Opus 5.5** | xhigh saat debugging | – | Menelusuri bug lintas server/sync/hook/UI dari log & event | "Code" + "Debug" bila tersedia |
| 11 Replay/diff/coder | Sonnet 5 | medium | – | UI + pemutar event memakai reducer yang sudah ada | "Code" |
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

Bob Radar sendiri tidak memanggil LLM langsung. Kecerdasan saat runtime berasal dari **IBM Bob** di setiap PC:
- Bob coder (mode `coder`) dan main agent (mode `pm-lead`) memakai model yang dikelola Bob.
- Server Radar, sync agent, hook, dan radar-mcp adalah kode deterministik tanpa API key LLM.
- Replay mode tidak memanggil model apa pun (PRD UI-05: tanpa API key).
- Konfirmasi di kickoff model watsonx mana yang dilarang (PRD §18 OQ 6) dan catat di `log/DECISIONS.md`.
