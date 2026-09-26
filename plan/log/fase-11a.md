# Log fase 11a — Watch Bob dan bukti sesi (Lane Aarief)

- **Status:** [~] implementasi lokal selesai; gerbang uji 2 laptop belum dijalankan. Belum ada snapshot atau PR fase 11a.
- **Branch:** `lane/app`, di atas `origin/main` setelah fase 09a/b/c digabung.
- **Mulai:** Sab 26 Sep 2026, sebelum 12:00 WITA.

## Langkah kerja

1. [x] Timeline Watch Bob, tombol Watch di Team, dan status writing/blocked: commit `20e22578` dan `8ef7d85b`.
2. [x] Toggle Share my prompts, penyimpanan `.radar/local.json` di main process, dan catatan privasi: commit `146fe186` dan `ac50ed8f`.
3. [x] Bob slice C4 via CDP port 9223 dalam mode Agent. Cek merah: `--md` ditolak sebagai opsi tak dikenal dan `evidence-check.ts` belum ada. Bob menulis dua script; hasil asli dan bukti pada commit `e39fc6b3` dengan trailer `Bob-Assisted` serta `Co-authored-by: IBM Bob <bob@ibm.com>`.
4. [x] Review C4: preflight Markdown sebelum screenshot dan validasi **semua** PNG. Sebelum perbaikan, fixture `junk.png` lolos audit dan sumber Markdown yang hilang tetap menghasilkan screenshot; setelah commit `ccf35645`, audit gagal untuk `junk.png`, exit 3 tidak membuat screenshot, Markdown aman tersalin, pengulangan tanpa `--force` ditolak, dan pola rahasia memberi exit 4 tanpa salinan.
5. [ ] Uji Watch Bob dan privasi di 2 laptop dengan Bob IDE, termasuk p95 latensi < 1 detik. Perlu dua Mac yang terhubung ke server demo yang sama.

## Hasil verifikasi

- `pnpm -C app tc`: lulus.
- Tujuh suite terfokus Watch Bob, Team, Settings, IPC, dan privasi: **35/35** test lulus.
- `bash -n radar/scripts/bob-evidence.sh` dan `pnpm -C radar exec tsc -p scripts/tsconfig.json`: lulus.
- `pnpm -C radar exec tsx scripts/evidence-check.ts`: script berjalan dan menemukan 2 kekurangan bukti anggota lain (Alief 1/3, Imelda 0/3). Ini data yang belum lengkap, bukan crash.
- Bukti Bob C4: `bob_sessions/uaai_aarief_task04_evidence_scripts_summary.png`, **2.06 Bobcoin**. Screenshot menampilkan status semua tugas selesai; tidak menampilkan secret.
- Belum ada angka latensi 2 laptop atau uji event blokir lintas laptop; DoD JT-01/02/03 masih terbuka.

## Batas folder dan handoff

- Bob sempat mengubah `radar/package.json` agar `evidence:check` menjalankan script baru. Perubahan itu **dikembalikan** karena hanya dua file `radar/scripts/{bob-evidence.sh,evidence-check.ts}` yang dikecualikan untuk Aarief di fase 11. Pemilik `radar/package.json` perlu mengganti placeholder `evidence:check` dengan `tsx scripts/evidence-check.ts` sebelum gerbang EV-02 final; sampai itu terjadi, jalankan script langsung seperti perintah verifikasi di atas.
- Hasil agent `.dmg` pada worktree terpisah baru berupa perubahan nama artefak di `app/config/electron-builder.config.cjs`, belum diuji build dan belum digabung; tinjau lagi di fase 11b setelah fase 10.
- Fase 11a belum boleh ditandai [x] atau dibuat PR sampai uji 2 laptop selesai. Fase 10 dimulai pada gerbang Sab 21:00 WITA sesuai `plan/PROMPT.md` bila uji belum selesai.

## LANGKAH MANUAL

1. Siapkan **dua Mac** yang menjalankan Bob IDE dan IBM Bob Live Collab dengan anggota berbeda, keduanya tersambung ke **server demo yang sama**. Untuk mock lokal, jalankan `pnpm -C radar dev:mock`; terminal server menampilkan token dev per peran. Token itu dibuat oleh mock lokal, bukan Cloudflare. Di Mac kedua, isi Server URL dengan alamat LAN Mac yang menjalankan server (`localhost` hanya berlaku di Mac server). Masukkan token sendiri lewat Settings → Live Collab. Jangan kirim token atau alamat pribadi ke chat atau commit.
2. Di Mac A, buka Team → Watch pada anggota Mac B. Jalankan satu prompt Bob di Mac B. Pastikan timeline A menampilkan prompt, read/write, dan status selesai. Ulangi dengan `Share my prompts` **mati** lalu **hidup** di Mac B; teks prompt hanya boleh muncul saat hidup.
3. Catat waktu event dari Bob IDE B ke tampilan A untuk sekurangnya 10 event dan hitung p95; target < 1 detik. Uji satu peristiwa blokir dari hook, lalu pastikan terlihat juga di Mission Control. Simpan hanya angka dan screenshot yang tidak memuat kode akses, hostname, IP, atau token.
4. Setelah uji, balas **“uji 2 laptop selesai”** beserta hasil p95 dan apakah prompt/blokir tampil. Saya akan menutup log, membuat snapshot `lane/app-f11a`, push, dan PR sesuai PROMPT langkah 11.
