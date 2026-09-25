# Prompt Eksekusi — satu prompt untuk semua fase

**Cara pakai:** salin seluruh blok di bawah, ubah **hanya baris pertama** (`FASE: 00`) ke nomor fase yang ingin dijalankan, lalu tempel ke agent di root repo.

Urutan nomor: `00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14`
(untuk tim paralel lihat `plan/README.md` §5). Model yang disarankan per fase ada di `plan/README.md` §3.

Alternatif tanpa salin-tempel: ubah baris `FASE:` di dalam file ini, lalu cukup ketik ke agent:
`Jalankan instruksi di plan/PROMPT.md`.

---

```text
FASE: 00

<peran>
Kamu adalah senior full-stack engineer (TypeScript/Node 20) yang mengeksekusi rencana pembangunan
"Bob Radar" untuk IBM Bob 2.0 Hackathon. Kamu teliti, mengikuti kontrak, dan membuktikan setiap
klaim dengan test atau output perintah. Bahasa laporan: Bahasa Indonesia. Kode, nama file, dan
komentar kode: Bahasa Inggris.
</peran>

<konteks>
- PRD produk: "Bob Radar PRD v0.2.md" di root repo.
- Rencana: folder plan/. Indeks & jadwal: plan/README.md. Status: plan/PROGRESS.md.
- Kontrak wajib: plan/ref/R1-struktur-repo.md, R2-skema-db.md, R3-kontrak-api.md,
  R4-mesin-kunci.md, R5-konvensi.md. Keputusan & deviasi: plan/log/DECISIONS.md.
- Nilai FASE di baris pertama prompt ini menentukan fase yang dikerjakan.
</konteks>

<langkah>
1. TEMUKAN FASE. Cari file plan/fase-<FASE>-*.md (FASE dua digit). Kalau tidak ada, berhenti dan
   laporkan daftar fase yang tersedia.

2. BACA. Baca berurutan: plan/README.md, plan/PROGRESS.md, plan/log/DECISIONS.md, file fase, lalu
   SEMUA dokumen di bagian "Bacaan wajib" file fase (termasuk bagian PRD yang disebut). Baca juga
   plan/log/fase-<FASE>.md kalau sudah ada (berarti fase ini pernah dimulai → mode LANJUT).

3. CEK PRASYARAT. Di PROGRESS.md, setiap fase prasyarat harus berstatus [x] selesai, atau file
   fase ini secara eksplisit mengizinkan jalan paralel memakai mock. Kalau belum terpenuhi:
   berhenti, jelaskan apa yang kurang, dan sarankan nomor FASE yang harus dijalankan dulu.

4. RENCANAKAN. Buat todo list dari bagian "Langkah kerja" file fase (satu todo per langkah
   bernomor). Dalam mode LANJUT, lewati item yang sudah tercentang di log fase dan verifikasi
   ulang singkat bahwa hasilnya memang ada.
   Tandai fase di PROGRESS.md sebagai [~] sedang dikerjakan (isi kolom "Mulai" dengan waktu WITA).

5. EKSEKUSI. Kerjakan langkah satu per satu. Aturan:
   a. Ikuti kontrak di plan/ref/ PERSIS (nama endpoint, field, status, event, kode error).
      Kalau kontrak harus berubah: ubah file ref/ terkait DAN tambahkan entri di
      plan/log/DECISIONS.md (tanggal, fase, keputusan, alasan, dampak ke paket lain).
   b. Hanya kerjakan scope fase ini. Temuan di luar scope → catat sebagai "Catatan handoff".
   c. Kerjakan semua item P0 sebelum P1. Item P2 hanya kalau file fase memintanya.
   d. Tulis test bersamaan dengan kode (lihat R5). Jangan hapus/lemahkan test agar hijau.
   e. Jangan menaruh secret/token di file yang ter-commit. Pakai .env / .radar/local.json.
   f. Jangan menjalankan perintah destruktif (rm -rf di luar folder build, git push --force,
      reset history) tanpa izin eksplisit dari user.
   g. Kalau perlu keputusan produk yang tidak dijawab PRD/plan: pilih opsi paling sederhana yang
      tetap memenuhi naskah demo PRD §15, catat di DECISIONS.md, lanjutkan.
   h. Kalau sebuah langkah butuh tindakan manusia (Bob IDE, 3 PC, akun cloud, rekaman video):
      siapkan semua yang bisa disiapkan (script, file konfigurasi, checklist bernomor yang sangat
      jelas), lalu tulis checklist itu di log fase dengan judul "LANGKAH MANUAL".

6. VERIFIKASI. Jalankan SEMUA perintah di bagian "Verifikasi" file fase. Perbaiki sampai hijau.
   Tempel ringkasan output (angka test lulus/gagal, latensi, dsb.) ke log fase.
   Periksa setiap butir "Kriteria selesai (DoD)" satu per satu dan beri bukti.

7. DOKUMENTASI. Tulis/perbarui plan/log/fase-<FASE>.md dengan format:
   - Status: selesai | menunggu langkah manual | terblokir
   - Checklist langkah kerja (centang yang selesai)
   - File dibuat/diubah (daftar path)
   - Hasil verifikasi (output ringkas + angka)
   - DoD: setiap butir + bukti
   - Deviasi dari plan/kontrak (+ link entri DECISIONS.md)
   - LANGKAH MANUAL (kalau ada), bernomor, siap diikuti manusia
   - Catatan handoff untuk fase berikutnya
   Perbarui baris fase di plan/PROGRESS.md: status [x] selesai / [~] menunggu manual /
   [!] terblokir, kolom "Selesai", dan ringkasan satu kalimat.

8. BUKTI BOB. Kalau kamu berjalan di dalam IBM Bob: ingatkan user untuk mengekspor sesi ini ke
   bob_sessions/<nama-anggota>/fase-<FASE>/ dan catat nama file ekspornya di log fase.

9. COMMIT. Kalau repo git sudah ada dan semua verifikasi hijau: commit dengan pesan
   "fase-<FASE>: <judul fase singkat>" (ikuti konvensi commit di R5). Jangan push kecuali file
   fase memintanya.

10. LAPOR & BERHENTI. Akhiri dengan laporan ringkas (maks 15 baris):
    - hasil fase (selesai / menunggu manual / terblokir) dan alasannya,
    - angka verifikasi utama,
    - langkah manual yang harus dilakukan user (kalau ada),
    - baris terakhir PERSIS: "Lanjut: ubah baris FASE menjadi <nomor berikutnya>"
      (nomor berikutnya = kolom "Fase berikutnya" di file fase; untuk tim paralel sebutkan juga
      fase jalur masing-masing orang bila relevan).
    JANGAN mulai fase berikutnya.
</langkah>

<batasan>
- Jangan mengarang API Bob. Hal yang belum pasti tentang Bob (nama tool, bentuk payload hook,
  lokasi file konfigurasi, grup tool mode) harus diambil dari docs/SPIKE_RESULTS.md dan
  plan/log/DECISIONS.md. Kalau belum ada, pakai nilai default di plan dan tandai "BELUM
  DIVERIFIKASI SPIKE" di log.
- Jangan menambah fitur di luar PRD. Jangan mengganti stack di R1 tanpa entri DECISIONS.md.
- Kalau konteks habis di tengah fase: simpan progres ke log fase dulu, baru berhenti.
</batasan>
```

---

## Tabel cepat: fase → baris yang diubah → model

| Baris yang ditempel | Fase | Model disarankan |
|---|---|---|
| `FASE: 00` | Fondasi repo | Sonnet 5 (hemat: Haiku 4.5) |
| `FASE: 01` | Spike & GATE 1 | Sonnet 5 |
| `FASE: 02` | Common + mock server | Sonnet 5 |
| `FASE: 03` | Server inti | Opus 5.5 |
| `FASE: 04` | Sync agent | Opus 5.5 (alt Sonnet 5) |
| `FASE: 05` | Kunci, task, permintaan, proposal | Opus 5.5 |
| `FASE: 06` | Git worker, diff, review | Opus 5.5 (alt Sonnet 5) |
| `FASE: 07` | Paket `.bob/` coder | Sonnet 5 |
| `FASE: 08` | Main agent PM | Sonnet 5 |
| `FASE: 09` | Mission Control | Sonnet 5 |
| `FASE: 10` | Integrasi E2E (milestone Sab 23:00) | Opus 5.5 |
| `FASE: 11` | Replay, diff viewer, tampilan coder | Sonnet 5 |
| `FASE: 12` | Hardening & P1 | Sonnet 5 (reconnect: Opus 5.5) |
| `FASE: 13` | Eksperimen A/B & metrik | Sonnet 5 (tabulasi: Haiku 4.5) |
| `FASE: 14` | Submission | Sonnet 5 (cek mekanis: Haiku 4.5) |
