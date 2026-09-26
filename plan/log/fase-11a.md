# Log fase 11a — Watch Bob dan bukti sesi (Lane Aarief)

- **Status:** [~] implementasi lokal selesai; gerbang uji 2 laptop belum dijalankan. Belum ada snapshot atau PR fase 11a.
- **Branch:** `lane/app`, di atas `origin/main` setelah fase 09a/b/c digabung.
- **Mulai:** Sab 26 Sep 2026, sebelum 12:00 WITA.
- **Sinkron 20:25 WITA:** `lane/app` direbase bersih ke `origin/main` `b9fc1c02` setelah Core 03–06/10, Bob 10, dan Web 11D1 bergabung. Tidak ada `TODO(sync:...)` di `app/src` atau `radar/packages/ui`.

## Langkah kerja

1. [x] Timeline Watch Bob, tombol Watch di Team, dan status writing/blocked: commit `20e22578` dan `8ef7d85b`.
2. [x] Toggle Share my prompts, penyimpanan `.radar/local.json` di main process, dan catatan privasi: commit `146fe186` dan `ac50ed8f`.
3. [x] Bob slice C4 via CDP port 9223 dalam mode Agent. Cek merah: `--md` ditolak sebagai opsi tak dikenal dan `evidence-check.ts` belum ada. Bob menulis dua script; hasil asli dan bukti pada commit `e39fc6b3` dengan trailer `Bob-Assisted` serta `Co-authored-by: IBM Bob <bob@ibm.com>`.
4. [x] Review C4: preflight Markdown sebelum screenshot dan validasi **semua** PNG. Sebelum perbaikan, fixture `junk.png` lolos audit dan sumber Markdown yang hilang tetap menghasilkan screenshot; setelah commit `ccf35645`, audit gagal untuk `junk.png`, exit 3 tidak membuat screenshot, Markdown aman tersalin, pengulangan tanpa `--force` ditolak, dan pola rahasia memberi exit 4 tanpa salinan.
5. [ ] Uji Watch Bob dan privasi di 2 laptop dengan Bob IDE, termasuk p95 latensi < 1 detik. Perlu dua Mac yang terhubung ke server demo yang sama.

## Hasil verifikasi

- `pnpm -C app tc`: lulus.
- Tujuh suite terfokus Watch Bob, Team, Settings, IPC, dan privasi: **35/35** test lulus.
- Hasil tetap sama setelah sinkron ke `main` terbaru: typecheck lulus, 35/35 test lulus, `git diff --check` bersih.
- `bash -n radar/scripts/bob-evidence.sh` dan `pnpm -C radar exec tsc -p scripts/tsconfig.json`: lulus.
- `pnpm -C radar exec tsx scripts/evidence-check.ts`: script berjalan; setelah sinkron hanya Imelda yang masih 2/3 PNG. Ini data lane Web yang belum lengkap, bukan crash.
- Bukti Bob C4: `bob_sessions/uaai_aarief_task04_evidence_scripts_summary.png`, **2.06 Bobcoin**. Screenshot menampilkan status semua tugas selesai; tidak menampilkan secret.
- Belum ada angka latensi 2 laptop atau uji event blokir lintas laptop; DoD JT-01/02/03 masih terbuka.

## Gerbang UI dan keamanan (20:30 WITA)

| Bukti | Hasil |
|---|---|
| Renderer app via CDP 9339, state mock sintetis | Team menampilkan 3 anggota online dan tombol Watch; Watch Andi membuka 11 baris aktivitas Bob (prompt, write, turn end, submit). Screenshot aman: `app/docs/img/app-watch-bob.png`. |
| Pemeriksaan tampilan | Hierarki, label, status, border anggota, dan baris aktivitas terbaca; tidak ada temuan HIGH. |
| Pemeriksaan privasi | Toggle default mati; file `.radar/local.json` ditulis atomik dengan mode 0600 oleh main process. Renderer tidak menerima token. Prompt hanya ditampilkan bila event server memuat teks; uji 2 Mac masih diperlukan untuk membuktikan hook menghormati toggle. |

## Batas folder dan handoff

- Bob sempat mengubah `radar/package.json` agar `evidence:check` menjalankan script baru. Perubahan itu **dikembalikan** karena hanya dua file `radar/scripts/{bob-evidence.sh,evidence-check.ts}` yang dikecualikan untuk Aarief di fase 11. Pemilik `radar/package.json` perlu mengganti placeholder `evidence:check` dengan `tsx scripts/evidence-check.ts` sebelum gerbang EV-02 final; sampai itu terjadi, jalankan script langsung seperti perintah verifikasi di atas.
- Hasil agent `.dmg` pada worktree terpisah baru berupa perubahan nama artefak di `app/config/electron-builder.config.cjs`, belum diuji build dan belum digabung; tinjau lagi di fase 11b setelah fase 10.
- Fase 11a belum boleh ditandai [x] atau dibuat PR sampai uji 2 laptop selesai. Fase 10 dimulai pada gerbang Sab 21:00 WITA sesuai `plan/PROMPT.md` bila uji belum selesai.

## LANGKAH MANUAL

1. Siapkan **dua Mac** yang menjalankan Bob IDE dan IBM Bob Live Collab dengan anggota berbeda, keduanya tersambung ke **server demo yang sama**. Untuk mock lokal, jalankan `pnpm -C radar dev:mock`; terminal server menampilkan token dev per peran. Token itu dibuat oleh mock lokal, bukan Cloudflare. Di Mac kedua, isi Server URL dengan alamat LAN Mac yang menjalankan server (`localhost` hanya berlaku di Mac server). Masukkan token sendiri lewat Settings → Live Collab. Jangan kirim token atau alamat pribadi ke chat atau commit.
2. Di Mac A, buka Team → Watch pada anggota Mac B. Jalankan satu prompt Bob di Mac B. Pastikan timeline A menampilkan prompt, read/write, dan status selesai. Ulangi dengan `Share my prompts` **mati** lalu **hidup** di Mac B; teks prompt hanya boleh muncul saat hidup.
3. Catat waktu event dari Bob IDE B ke tampilan A untuk sekurangnya 10 event dan hitung p95; target < 1 detik. Uji satu peristiwa blokir dari hook, lalu pastikan terlihat juga di Mission Control. Simpan hanya angka dan screenshot yang tidak memuat kode akses, hostname, IP, atau token.
4. Setelah uji, balas **“uji 2 laptop selesai”** beserta hasil p95 dan apakah prompt/blokir tampil. Saya akan menutup log, membuat snapshot `lane/app-f11a`, push, dan PR sesuai PROMPT langkah 11.
