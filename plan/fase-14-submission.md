# Fase 14 — Submission: bukti Bob, dokumen juri, keamanan, video, deck

| Field | Nilai |
|---|---|
| Jalur | Semua — Orang 1: README juri + gitleaks · Orang 2: `BOB_DEVELOPMENT.md` + `bob_sessions/` · Orang 3 (atau orang ke-4): video, deck, cover, deskripsi |
| Slot WITA | Min 27 Sep 11:00 – 23:00 (submit 19:00–21:00, buffer 21:00–23:00) |
| Estimasi | 8 jam |
| Prasyarat | 11, 12, 13 (GATE 2 sudah lewat) |
| Requirement PRD | §15 naskah demo, §16 R0, NFR-04, NFR-05, NFR-07, NFR-09, metrik "Kelengkapan bukti Bob 100%" |
| Model | Sonnet 5 · effort medium (cek mekanis — link, checklist, gitleaks: Haiku 4.5) |
| Fase berikutnya | – (selesai). Setelah submit: retrospektif singkat di `plan/log/fase-14.md` |

## Tujuan

Mengubah produk yang jalan menjadi submission yang bisa dinilai juri sendirian: repo publik bersih dari secret, README juri yang bisa diikuti 5 menit, bukti penggunaan Bob lengkap, video ±4 menit sesuai naskah, deck PDF, cover 16:9, deskripsi, dan replay yang hidup.

## Bacaan wajib

- PRD §01 (ringkasan), §03 (posisi & tabel pembanding), §15 (naskah), §16, §18 risiko "Juri menganggap cuma Live Share + kunci"
- Aturan submission resmi (dicatat di `plan/log/DECISIONS.md` fase 00)
- `docs/EXPERIMENT.md`, `docs/E2E_REPORT.md`, semua `plan/log/fase-*.md`

## Output

- `README.md` (juri), `BOB_DEVELOPMENT.md`, `bob_sessions/**` lengkap + `bob_sessions/INDEX.md`
- `docs/ARCHITECTURE.md` final, `docs/DEMO_SCRIPT.md` final, `docs/SECURITY.md`
- `docs/deck/deck.pdf` (+ sumber), `docs/deck/cover-16x9.png`, `docs/SUBMISSION.md` (teks deskripsi pendek & panjang, link)
- Video final (unggah YouTube/Vimeo unlisted atau sesuai aturan) + `docs/video/script.md`
- Replay `/demo` dengan rekaman final

## Langkah kerja

### A. Rekaman final (pagi, sebelum 13:00)

1. **Gladi & rekam** (LANGKAH MANUAL): reset server & toko-demo, 3 PC, layar dibagi A | MC | B (PRD §15). Rekam 2–3 take penuh mengikuti `docs/DEMO_SCRIPT.md`; simpan take terbaik + footage per layar. Setelah take terbaik: `radar-server export` → `events.live-final.json`; ekspor sesi Bob ketiga PC.
2. Jalankan ulang `scripts/export-replay.ts` dengan rekaman final + kutipan Bob final → deploy web.

### B. Bukti Bob (Orang 2)

3. **`bob_sessions/`**: pastikan setiap fase yang dijalankan di Bob punya ekspor (`bob_sessions/<nama>/fase-XX/…`), plus sesi demo final & eksperimen. Buat `bob_sessions/INDEX.md`: tabel `folder · anggota · fase/tujuan · tanggal · ringkasan 1 kalimat · apa yang dibangun Bob`. Sensor secret (jalankan gitleaks khusus folder ini) — **jangan** mengedit isi percakapan selain sensor.
4. **`BOB_DEVELOPMENT.md`**:
   - Bagaimana Bob dipakai untuk **membangun** Radar (fase mana, mode apa, contoh prompt, berapa sesi) — link ke `bob_sessions/INDEX.md`.
   - Bagaimana Radar **memperluas** Bob: custom modes `coder` & `pm-lead` (kutip YAML), 5 hook (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop) dengan tabel perilaku, `radar-mcp` 13 tool, alur governance (main agent mengusulkan, manusia menyetujui).
   - Temuan spike tentang Bob 2.x (payload hook, exit 2, grup mode) — berguna bagi komunitas.
   - Tabel metrik final (fase 13) target vs hasil.
   - Konsumsi Bobcoin per peran & cara menghematnya (brief ≤ 6 baris, `--max-cost`).
   - Keterbatasan & roadmap (`EnforcedHooks`, self-hosted, pemicu otomatis).

### C. Dokumen juri & keamanan (Orang 1)

5. **`README.md` juri** (bisa diikuti tanpa tim):
   1. Satu kalimat + GIF/cover.
   2. **Tonton dalam 1 menit:** link replay `/demo` (tanpa login) & video.
   3. Masalah (angka PRD §03 dengan sumber) & solusi (3 aturan PRD §01).
   4. Tabel pembanding PRD §03 (menonjolkan main agent untuk originality).
   5. Arsitektur (diagram PRD §12 mermaid) + link `docs/ARCHITECTURE.md` & `plan/ref/`.
   6. Quickstart lokal ≤ 10 perintah: `pnpm i`, `radar-server init` (repo contoh), `pnpm dev:server`, `pnpm dev:web`, 2× `radar join`, `pnpm sim` untuk melihat alur tanpa Bob.
   7. Cara memasang di Bob (kit, mode, MCP) untuk tim nyata.
   8. Hasil eksperimen & metrik (ringkas + link `docs/EXPERIMENT.md`).
   9. Keamanan & privasi (link `docs/SECURITY.md`), batasan yang diakui, roadmap R1/R2.
   10. Tim & lisensi (MIT/Apache-2.0 — putuskan & tambahkan `LICENSE`).
6. **`docs/SECURITY.md`** (NFR-04/05): model token (hash, per anggota, token mc terpisah), endpoint persetujuan hanya mc, hook berjalan dengan izin penuh user (diakui), isi file disimpan di server tim (MVP) → roadmap self-hosted, cara rotasi token, tidak ada data pribadi (NFR-07).
7. **Pemindaian secret seluruh history**: `gitleaks detect --source . --log-opts="--all" --redact` untuk repo `bob-radar` **dan** `toko-demo`. Temuan → rotasi token terkait + bersihkan history (`git filter-repo`) **hanya dengan persetujuan tim** (operasi destruktif). Simpan laporan bersih ke `docs/security/gitleaks-report.txt` (tanpa isi secret).
8. **Rotasi token setelah rekaman final**: token A/B/C/mc yang pernah muncul di layar video harus dirotasi (`radar-server token --rotate`) — cek footage untuk token yang terlihat.
9. **Repo publik**: `bob-radar` & `toko-demo` publik, deskripsi repo, topik, link demo di "About". Hapus `spike/out`, `.data`, file besar.

### D. Video, deck, cover, deskripsi (Orang 3/4)

10. **Video ±4 menit** (`docs/video/script.md` dari PRD §15, dengan narasi final per adegan & timecode): intro masalah (angka 41,7%) → ide → rencana → live → blokir → review+commit GitHub → di balik layar (YAML, hook, MCP, `bob_sessions/`, angka A/B) → penutup (target user, model bisnis, roadmap, link replay). Subtitle Bahasa Inggris bila juri internasional (cek aturan). Ekspor 1080p, cek audio, durasi sesuai batas aturan.
11. **Deck PDF (10–12 slide)**: 1 judul + cover · 2 masalah (angka + sumber) · 3 kenapa alat sekarang tidak cukup (tabel pembanding) · 4 solusi 3 aturan · 5 main agent & governance (usul vs setujui) · 6 arsitektur · 7 demo (screenshot MC) · 8 bagaimana dibangun dengan Bob (mode, hook, MCP, sesi) · 9 hasil eksperimen & metrik (jujur) · 10 target user & model bisnis · 11 roadmap R1/R2 (`EnforcedHooks`, self-hosted, CI) · 12 tim + link. Bingkai track sesuai aturan resmi (team workflow / governance / SDLC orchestration — PRD §18).
12. **Cover 16:9** dari screenshot Mission Control 1920×1080 (fase 09) + judul "Bob Radar" + tagline satu baris.
13. **`docs/SUBMISSION.md`**: judul, tagline (≤ 1 kalimat), deskripsi pendek (≤ 280 char), deskripsi panjang (±300 kata), track, teknologi, link (repo, replay, video, deck, toko-demo, bob_sessions), daftar anggota. Salin ke form submission.

### E. Submit & buffer

14. **Submit (19:00–21:00)** (LANGKAH MANUAL): isi form resmi dengan `docs/SUBMISSION.md`. Screenshot konfirmasi → `docs/submission-confirmation.png`.
15. **Checklist buffer (21:00–23:00)** — dari jendela incognito, perangkat lain:
    - [ ] Repo publik terbuka tanpa login; README tampil benar (mermaid render).
    - [ ] `/demo` autoplay, klik event → diff & kutipan Bob; link repo/sessions/video berfungsi.
    - [ ] Video bisa diputar tanpa login, durasi sesuai aturan.
    - [ ] Deck PDF terbuka, link di dalamnya berfungsi.
    - [ ] Gitleaks bersih; tidak ada token di video/deck/replay JSON.
    - [ ] `bob_sessions/INDEX.md` lengkap, 100% sesi terdaftar (metrik PRD §04).
    - [ ] Server live masih jalan (bonus) — replay tetap jalan walau tidak.
16. Commit `fase-14: submission docs and assets`, tag `v0.2.0-submit`, push.
17. **Retrospektif** 10 baris di log: apa yang berhasil, apa yang dipotong, pelajaran untuk R1.

## Verifikasi

```bash
gitleaks detect --source . --log-opts="--all" --redact
(cd ../toko-demo && gitleaks detect --source . --log-opts="--all" --redact)
pnpm test && pnpm --filter @radar/web build
npx markdown-link-check README.md BOB_DEVELOPMENT.md docs/*.md   # cek link
```

## Kriteria selesai (DoD)

- [ ] Semua butir checklist buffer tercentang.
- [ ] Form submission terkirim sebelum batas (bukti screenshot).
- [ ] 100% sesi Bob terdaftar di `bob_sessions/INDEX.md`.
- [ ] Token yang pernah tampil di footage sudah dirotasi.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Demo live gagal saat presentasi | Video + replay (PRD §18) |
| Upload video lambat | Unggah take awal jam 17:00 sebagai cadangan, ganti bila take final siap |
| Menemukan secret di history pukul 20:00 | Rotasi token segera (efektif menetralkan), laporkan di SECURITY.md; bersihkan history hanya bila waktu & tim setuju |

## Catatan handoff

- Setelah hackathon: `plan/` tetap di repo sebagai bukti proses; buat `plan-r1/` untuk rilis pilot (PRD §16 R1).
