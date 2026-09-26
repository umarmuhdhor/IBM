# Log fase 10 — Integrasi E2E, bagian Lane Aarief · App

- **Status:** [~] pra-uji app selesai; menunggu milestone 4 Mac Sab 23:00 WITA.
- **Branch:** `lane/app`, di atas `origin/main` setelah fase 09a/b/c, Core 03–06/10, Bob 10, dan Web 11D1 bergabung.
- **Batas folder:** catatan ini hanya untuk app. Simulator dan server milik Alief (`fase-10.md`); Bob IDE dan naskah uji milik Umar (`fase-10-bob.md`).

## Pra-uji

1. [x] Bandingkan kontrak app WebSocket, state, dan keputusan dengan server terbaru di `main`; tidak ada ketidakcocokan P0 yang ditemukan.
2. [x] `pnpm -C app tc` lulus; 36/36 test terfokus Watch Bob, Team, Settings, IPC, dan privasi lulus setelah sinkron ke `main`.
3. [x] `ORCA_BACKGROUND_LAUNCH=1 pnpm -C app build:desktop` lulus untuk renderer, web client, dan mobile web. Shortcut developer opsional di `/usr/local/bin` gagal dibuat karena izin OS, tanpa menggagalkan build.
4. [x] Watch Bob dibuka melalui CDP terhadap mock sintetis; 11 aktivitas tampil. Screenshot yang dipotong tanpa informasi pribadi: `app/docs/img/app-watch-bob.png` (draft PR #21).
5. [ ] Uji alur 4 Mac dan p95 latensi Watch Bob dari peristiwa Bob IDE nyata; jalankan pada milestone bersama tim.
6. [x] Pra-cek server publik Sab 20:48 WITA tanpa kode akses: `GET /healthz` → HTTP 200 (`ok: true`, workspace `toko-demo`, versi `0.3.0`); `GET /v1/state` tanpa kode → HTTP 401. Ini membuktikan endpoint dan penolakan akses anonim, belum membuktikan reset anggota, koneksi app, atau alur demo.
7. [x] Pemeriksaan UI lokal: snapshot lama sengaja dipertahankan saat WS putus, tetapi status bar dan Team masih menyebut anggota online serta menawarkan Watch. Test `RadarPanel.test.tsx` merah 1/3, lalu hijau 3/3 setelah status offline tidak menghitung anggota dan panel menyembunyikan aksi berbasis data usang. `pnpm -C app tc` dan oxlint terfokus lulus. Screenshot panel offline yang dipotong tanpa data pribadi: `app/docs/img/app-offline-state.png`.

## Pemeriksaan tampilan

| Tampilan | Hasil |
|---|---|
| Team tersambung | Hierarki, kartu anggota, dan tombol Watch terbaca; tidak ada temuan HIGH pada screenshot CDP lokal. |
| Team terputus | Label merah dan ajakan buka Settings jelas; kartu online lama tidak terlihat. Screenshot `app/docs/img/app-offline-state.png`. |
| Batas | Review visual manual dilakukan karena skill `better-interface` tidak tersedia di lingkungan ini. |

## LANGKAH MANUAL — app pada 4 Mac

1. Setelah Alief menyiapkan server dan Umar menyiapkan Bob IDE pada Mac A, B, C, D, buka IBM Bob Live Collab di tiap Mac. Pada Settings → Live Collab, isi Server URL yang sama, Workspace `toko-demo`, Member dan Role sesuai undangan, lalu **masukkan access token masing-masing sendiri** dari kanal privat. Jangan tempel token di chat, log, screenshot, atau commit. Di Mac lain, `localhost` menunjuk Mac itu sendiri; gunakan URL server yang disepakati tim.
2. Buka folder workspace hasil `radar join` di app, pilih workspace yang benar, lalu tekan **Test**. Pastikan WebSocket = Connected dan `.bob/settings.json` = Found. Pemeriksaan Bob Shell adalah diagnostik opsional; alur P0 memakai Bob IDE.
3. Mac C buka Mission Control; Mac A dan B buka Team. Saat C menyetujui rencana, cek kartu task dan warna kunci pada A/B/C. Saat A/B mengedit di Bob IDE, cek indikator writing serta perubahan file di panel.
4. Di Mac B, buka Team → Watch pada A. Di Mac A, buka workspace yang benar dan uji **Share my prompts** dalam posisi mati lalu hidup. Dari Bob IDE A, jalankan prompt uji yang aman. Pastikan event read/write dan turn end muncul di B; teks prompt hanya tampak saat toggle A hidup. Jangan tampilkan isi prompt sensitif saat berbagi layar.
5. Ulangi sedikitnya 10 event Bob untuk mengukur waktu dari event di Mac A sampai tampil di Watch Bob Mac B. Catat tiap selisih dalam milidetik dan p95; target < 1.000 ms. Saat B mencoba file milik A, cek blocked di Team/Watch Bob dan kartu permintaan di Mission Control. Catat waktu plan → live → blocked → decision sesuai naskah fase 10.
6. Setelah review dan approve, cek commit GitHub memuat penulis A dan trailer co-author IBM Bob. Simpan hanya hasil waktu, status, dan screenshot yang dipotong tanpa kode akses, hostname, IP, atau data mesin pribadi. Laporkan bug P0 dengan langkah reproduksi; perbaiki di `lane/app` dengan test regresi.

## Batas dan handoff

- Uji dua Mac Watch Bob sekaligus menutup gerbang fisik fase 11a jika p95 dan privasi lulus; catat hasilnya di `fase-11a.md` sebelum merge PR #21.
- Dua Mac boleh berada di lokasi berbeda selama memakai URL server publik yang sama. Koneksi tersimpan pada app lokal saat pra-cek masih menunjuk server lain; jangan ganti sampai konfigurasi anggota produksi selesai dan pengguna memasukkan kode aksesnya sendiri.
- Tangkapan layar handoff Alief menyebut temuan HIGH pada jadwal alarm kunci stale untuk jalur WebSocket. Tim Core perlu menuntaskan dan memverifikasi perbaikan itu sebelum menjadikan uji live sebagai bukti final; app tidak mengubah server dari lane ini.
- Fase 10 belum [x] karena tidak ada bukti uji fisik 4 Mac atau sim remote dari tim. Setelah fase 10, lanjut 11b (`.dmg`).
