# TODO — yang dibutuhkan dari Alief

Daftar ini dibuat setelah riset teknis dan perbaikan plan (D-007, 25 Sep 2026). Isinya hal yang tidak bisa diputuskan atau dikerjakan agent sendiri: keputusan, akses akun, secret, dan langkah manual. Centang item yang sudah selesai, dan tulis jawabannya di kolom "Jawaban" atau di chat.

Urutan: **A** memblokir commit, **B** memblokir fase 03 dan 06, **C** koordinasi lane, **D** langkah manual di Bob IDE atau Mac, **E** opsional.

## A. Keputusan sebelum commit (memblokir)

| # | Pertanyaan | Kenapa perlu | Pilihan | Jawaban |
|---|---|---|---|---|
| A1 | Bagaimana perubahan plan di-commit? | Working tree berisi perubahan lama (31 file, sudah ada sebelum sesi riset) dan edit D-007 di file yang sama | (a) satu commit gabungan · (b) dua commit: perubahan lama dulu, lalu D-007 · (c) biarkan, commit sendiri | D-007 sudah di `main` (`523c4668`). Sisa `plan/TODO.md` + `plan/README.md` ikut commit fase 00 (Alief, 25 Sep 17:20) |
| A2 | Perubahan lama itu milik siapa, dan boleh ikut di-commit? | Agent tidak tahu asal perubahan itu, jadi tidak boleh meng-commit tanpa izin | ya / tidak / sebagian (sebutkan file) | ya: `plan/TODO.md`, `plan/README.md` ikut commit fase 00 (Alief, 25 Sep 17:20) |
| A3 | Commit langsung ke `main` atau lewat PR? | Aturan repo: hanya fase 00 langsung ke `main`. Ini perubahan dokumen plan + kontrak R1–R5 | (a) langsung `main` (dokumen plan) · (b) PR dari branch `docs/d-007` | (a): D-007 sudah di `main` (`523c4668`), begitu juga perbaikan dokumen berikutnya (`bacb4101`, `11564dc3`) |
| A4 | Setujui perubahan kontrak R1–R5 di D-007? | Kontrak hanya boleh diubah Alief. Ringkasan: `execute`, `alwaysAllow`, `office_edit`, tool test baru, commit 4 request, FK ON, heartbeat di attachment, alarm bersyarat, WS tanpa tag, `/admin/files`, `WS_PING_FRAME`, `.github/workflows/` diabaikan | setuju semua / tolak nomor … | setuju semua (default D-alief-01; fase 02–07 sudah ditulis di atas kontrak ini). Tolak nomor tertentu lewat DECISIONS bila berubah pikiran |
| A5 | Batas `too_many_files` baru: > 100 file **atau** > 5 MB per task. Cocok? | Angka ini pilihan kita (bukan batas resmi GitHub) setelah blob POST dihapus | setuju (default D-alief-01) |
| A6 | Boleh `alwaysAllow` untuk 8 tool MCP PM? | Tanpa itu PM harus klik approve setiap tool. Risikonya kecil karena semua usulan tetap menunggu persetujuan di Mission Control (MA-07) | ya (default D-alief-01): semua usulan tetap butuh Approve di Mission Control |

## B. Akses dan secret (memblokir fase 03 dan 06)

Jangan tempel nilai secret di chat atau di file repo. Agent hanya perlu tahu bahwa langkahnya sudah selesai.

| # | Yang dibutuhkan | Cara | Status |
|---|---|---|---|
| B1 | Akun Cloudflare tim (plan Free) + `npx wrangler login` di Mac Alief | Login di browser saat diminta wrangler | [x] 26 Sep 00:40: `wrangler whoami` OK (OAuth, izin workers/pages write) |
| B2 | Nama akun/subdomain `*.workers.dev` | Untuk `NEXT_PUBLIC_RADAR_SERVER` dan `CORS_ORIGIN` (R5 §5) | [x] 26 Sep 12:40: `https://live-collab.afindo-mi01.workers.dev` (akun `afindo-mi01`) |
| B3 | Repo `toko-demo`: owner, nama, branch default | Dipakai `GITHUB_REPO` dan `admin init --repo` (PROGRESS A1 masih kosong) | [x] 26 Sep 12:38: `aliefauzan/toko-demo` (public), branch `main`, seed `ed9e4b2` dari `radar/examples/toko-demo`. Di akun Alief karena PAT fine-grained Alief tidak bisa mengakses repo personal Umar |
| B4 | GitHub fine-grained PAT untuk `toko-demo` | Hanya repo `toko-demo`, izin **Contents: read & write**, **tanpa** Workflows. Simpan dengan `npx wrangler secret put GITHUB_TOKEN` (diketik di prompt wrangler) | [x] 26 Sep 12:49: PAT fine-grained dibuat Alief (hanya `toko-demo`, Contents read & write), diketik Alief di prompt `wrangler secret put GITHUB_TOKEN` |
| B5 | `ADMIN_SECRET` | Buat string acak, simpan di password manager tim, lalu `npx wrangler secret put ADMIN_SECRET` | [x] 26 Sep 12:45: `openssl rand -hex 32` langsung ke `wrangler secret put` + Keychain macOS (`security find-generic-password -s radar-admin-secret -a live-collab -w`); nilai tidak pernah tampil. Salin ke password manager tim |
| B6 | Email co-author IBM Bob untuk trailer commit | R5 §3: nilai `BOB_COAUTHOR` "dikonfirmasi saat kickoff". Default sekarang `IBM Bob <bob@ibm.com>`; pastikan email ini benar atau ganti | [ ] |
| B7 | Tempat menyimpan token member (A, B, C, D, mc) hasil `admin init` | Password manager tim, bukan chat publik | [~] `admin init` produksi 26 Sep 12:47: token A, B, C, D, mc ada di `~/.live-collab/members-prod-2026-09-26.txt` (0600). Alief memindahkannya ke password manager tim lalu menghapus file itu |

## C. Koordinasi lane (kabari tim)

D-007 mengubah hal yang dipakai lane lain. Agent tidak mengirim pesan atas nama Alief, jadi tolong teruskan.

| # | Ke | Isi pesan singkat |
|---|---|---|
| C1 | Umar (Bob) | Grup shell mode = `execute`, bukan `command`. `.bob/mcp.json` wajib `alwaysAllow`. Workspace wajib di-trust. Matcher tambah `office_edit`. Pesan blokir tidak lewat stderr: pakai rules `.bob/rules-coder/` + `why_blocked` + brief. Spike fase 01 sekarang 20 uji (baru: 17–20). Detail: D-007 poin 1–4, fase 01, fase 07. |
| C2 | Aarief (App) | Registrasi agent `bob` menyentuh ±12 file Orca (daftar di fase 09 Output). Build `.dmg` jangan pakai `build:mac`. App WS client kirim `WS_PING_FRAME` tiap 20 s. |
| C3 | Imelda (Web & media) | Teks pasang app: "klik kanan → Open" tidak berlaku lagi sejak macOS 15. Pakai "Privacy & Security → Open Anyway" (landing, README release, video, deck). DESIGN §5.11 dan `prompt_ui.md` sudah diubah. |
| C4 | Semua | Tool test server: `@cloudflare/vitest-plugin` + `vitest@^4.1` (jangan vitest 5), mock GitHub dengan `@msw/cloudflare`, test sync dengan `createTestHarness`. |

## D. Langkah manual yang butuh manusia

| # | Langkah | Siapa | Kapan | Status |
|---|---|---|---|---|
| D1 | Cek versi Bob IDE di 4 PC ≥ 2.1.0 (untuk `office_edit` dan tab Hooks). IDE v1.0.3 dan v2.0.0 mati 30 Sep 2026 | semua | sebelum fase 01 | [ ] |
| D2 | Login Bob IDE dengan IBMid akun hackathon, instance `ibm-coding-challenge-uat` (us-east); catat saldo Bobcoin awal (40 per akun) | semua | sebelum fase 01 | [ ] |
| D3 | Saat spike: buka `radar/spike/` di Bob IDE dan **trust workspace**; jalankan uji 17–20 | Umar | fase 01 | [ ] |
| D4 | Spike 4 (sync dua folder / dua PC) | Alief | fase 01, 30 menit | [ ] |
| D5 | Uji Gatekeeper: unduh `.dmg` lewat browser di Mac kedua, pasang, buka, catat pesan yang muncul | Aarief atau Imelda | fase 11 | [ ] |
| D6 | Setelah setiap Bob slice: bilang "bob selesai" supaya agent menjalankan `radar/scripts/bob-evidence.sh` | pemilik slice | tiap slice | [ ] |

## E. Opsional

| # | Hal | Manfaat |
|---|---|---|
| E1 | Sambungkan ekstensi browser OpenCLI untuk agent-reach (akun burner) | Riset diskusi komunitas Reddit/X tentang Bob hooks. Saat ini tidak tersambung, jadi riset hanya memakai docs resmi |
| E2 | Jalankan `pnpm @cloudflare/codemods vitest:pool-workers-to-vitest-plugin` hanya kalau ada kode lama | Belum perlu: `radar/` belum berisi kode |
| E3 | Tentukan apakah `arsip/PRD-v0.2.md` perlu ikut diperbarui | Sekarang sengaja tidak diubah (arsip) |

## Referensi

- Keputusan lengkap: [`log/DECISIONS.md`](log/DECISIONS.md) D-007
- Kontrak yang berubah: [`ref/R1`](ref/R1-struktur-repo.md), [`R2`](ref/R2-skema-db.md), [`R3`](ref/R3-kontrak-api.md), [`R4`](ref/R4-mesin-kunci.md), [`R5`](ref/R5-konvensi.md)
