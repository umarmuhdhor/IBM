# Fase 13 — Eksperimen A/B & metrik untuk pitch

| Field | Nilai |
|---|---|
| Jalur | **Lane Umar** (Umar) · branch `lane/bob` (+ anggota lain sebagai coder) |
| Slot WITA | Min 27 Sep 04:30 – 10:30 (PRD §18: eksperimen dijadwalkan Minggu pagi karena Bobcoin; selesai sebelum GATE 2 dan rekaman final 11:00) |
| Estimasi | 4 jam |
| Prasyarat | 10 |
| Requirement PRD | §04 metrik keberhasilan, §17 "Eksperimen A/B untuk angka pitch", NFR-06, NFR-09 |
| Model | Sonnet 5 · effort medium (tabulasi & format tabel: Haiku 4.5) |
| Fase berikutnya | 14 |

## Tujuan

Menghasilkan angka jujur untuk pitch: berapa konflik merge, menit resolusi, dan Bobcoin tanpa Radar dibanding dengan Radar pada 6 task yang sama, plus semua metrik PRD §04 yang diukur dari event log. Laporkan apa adanya, termasuk keterbatasan sampel kecil dan skenario rancangan sendiri.

## Bacaan wajib

- PRD §03 (angka riset pembanding), §04 tabel metrik, §17 eksperimen, §18 risiko Bobcoin
- `examples/toko-demo/EXPERIMENT_TASKS.md`, `docs/E2E_REPORT.md`

## Output

- `scripts/ab/{setup-round-a.sh, merge-check.ts, collect-round-b.ts}`, `scripts/metrics.ts`
- `docs/EXPERIMENT.md` (protokol, data mentah, hasil, keterbatasan)
- `docs/experiment-data/{round-a.json, round-b.json, metrics.json}`

## Langkah kerja

1. **Protokol** (tulis dulu di `docs/EXPERIMENT.md` sebelum menjalankan, supaya tidak bias):
   - Sama untuk kedua putaran: repo `toko-demo` di commit awal yang sama, 6 task dari `EXPERIMENT_TASKS.md` dibagi sama (A: 1, 3, 5; B: 2, 4, 6), prompt ke Bob **kata demi kata sama** (simpan di `docs/experiment-data/prompts.md`), batas waktu 45 menit per putaran, PM yang sama.
   - Urutan: putaran A dulu lalu B (catat efek belajar sebagai keterbatasan), atau pertukarkan pasangan coder antar putaran bila waktu memungkinkan.
   - Metrik yang dicatat per putaran: konflik merge (jumlah file & hunk), menit resolusi konflik, task selesai, build hijau di akhir (`npm run build`), Bobcoin terpakai per akun (dari dashboard/Bobalytics — screenshot), blokir, waktu blokir→keputusan, commit.

2. **Putaran A — cara biasa** (`scripts/ab/setup-round-a.sh`): buat branch `ab/a-coderA` dan `ab/a-coderB` dari commit awal di clone lokal toko-demo **terpisah** (tanpa Radar, tanpa hook: pastikan `.bob/` Radar tidak aktif). Coder A & B mengerjakan task masing-masing dengan Bob di branch sendiri, commit per task.
   - `scripts/ab/merge-check.ts`: merge `ab/a-coderA` lalu `ab/a-coderB` ke `ab/a-merge` dengan `git merge --no-commit`; hitung file konflik (`git diff --name-only --diff-filter=U`) & jumlah hunk (`<<<<<<<`); ukur menit resolusi manual (stopwatch, catat); jalankan build setelah resolusi. Output `round-a.json`.

3. **Putaran B — dengan IBM Bob Live Collab**: reset server & toko-demo ke commit awal yang sama; PM (C) meminta main agent menyusun rencana dari tujuan "Kerjakan 6 task di EXPERIMENT_TASKS.md" (rencana boleh berbeda dari pembagian manual — catat alokasi hasilnya); coder mengerjakan dengan prompt yang sama. Semua review lewat main agent + PM.
   - `scripts/ab/collect-round-b.ts`: ambil `GET /v1/events/export` + `GET /v1/report/session` → hitung blokir, keputusan, waktu blokir→keputusan, commit, review.flagged; konflik merge = coba merge semua commit task secara berurutan dari commit awal (harus 0 karena satu penulis per file — tetap diukur, bukan diasumsikan). Output `round-b.json`.

4. **`scripts/metrics.ts`** — dari export event + tabel metric (endpoint atau file DB salinan): hitung semua metrik PRD §04:
   | Metrik | Cara hitung |
   |---|---|
   | Latensi sinkron p95 | `sync.applied.latencyMs` (lintas PC: berbasis RTT server, R4 §9) + hasil `bench:sync` satu mesin; laporkan keduanya & metodenya |
   | Dua penulis bersamaan | Audit: telusuri event berurutan, untuk tiap `file.changed` pastikan `by` = pemegang kunci saat itu → jumlah pelanggaran |
   | Latensi cek kunci p95 | `metric.lock_check_ms` (server) + `.radar/hook.log` durasi hook (end-to-end) |
   | Konflik merge | dari round-a vs round-b |
   | Blokir → keputusan | `request.decided.ts - request.created.ts` (median & max; tandai yang auto) |
   | Masalah antar-file tertangkap | jumlah `review.flagged` |
   | Kelengkapan bukti Bob | jumlah folder/ekspor di `bob_sessions/` vs daftar sesi di log fase |
   Output `metrics.json` + tabel markdown ke stdout.

5. **Tulis hasil** `docs/EXPERIMENT.md`: tabel A vs B, grafik sederhana (opsional, PNG dari script atau tabel saja), 3–5 kalimat interpretasi **tanpa melebih-lebihkan**, bagian "Keterbatasan" (n kecil, skenario dirancang tim, efek belajar, Bob nondeterministik, satu repo kecil), dan kalimat siap pakai untuk pitch, mis. "Pada eksperimen kecil kami (6 task, 2 coder), cara biasa menghasilkan X file konflik dan Y menit resolusi; dengan IBM Bob Live Collab 0 konflik dengan Z blokir yang diputuskan PM dalam median W detik."

6. **Tabel metrik final** untuk `BOB_DEVELOPMENT.md` & deck (fase 14): target vs hasil untuk setiap baris PRD §04, status ✅/⚠️/❌ jujur.

7. **Ekspor sesi Bob** kedua putaran lewat `bob-evidence.sh <nama> <NN> eksperimen_a` / `eksperimen_b` (R7).

8. Commit `fase-13: A/B experiment and metrics`.

## Tambahan v0.3 — batas Bobcoin

- Setiap akun hanya punya 40 Bobcoin (guide 2.0). Sebelum mulai, catat sisa Bobcoin setiap akun. Eksperimen memakai akun **Alief, Aarief, dan Imelda** (bukan Umar, yang cadangannya dipakai sebagai PC D saat rekaman), sesuai tabel anggaran PLAN.md §7. Eksperimen **tidak boleh** membuat sisa akun turun di bawah cadangan rekaman (12; akun PC D 8).
- Kalau sisa tidak cukup untuk 3 putaran per kondisi, jalankan 1 putaran per kondisi + `sim-3pc` tanpa Bob sebagai pelengkap, lalu laporkan keterbatasan ini dengan jujur.
- Metrik utama mengikuti roast v0.1: total waktu sampai kedua task ter-merge dan test lulus, build rusak setelah merge, dan Bobcoin. Jangan menjadikan "0 konflik merge" sebagai klaim utama.
- Sesi Bob eksperimen juga diekspor ke `bob_sessions/` (slice tambahan).

## Verifikasi

```bash
pnpm tsx scripts/ab/merge-check.ts --repo ../toko-demo-ab
pnpm tsx scripts/ab/collect-round-b.ts --server $S --token $TOK_C
pnpm metrics -- --export docs/experiment-data/round-b-events.json --out docs/experiment-data/metrics.json
```

## Kriteria selesai (DoD)

- [ ] Protokol ditulis sebelum eksperimen dijalankan (timestamp commit membuktikan urutan).
- [ ] Data mentah kedua putaran tersimpan di `docs/experiment-data/`.
- [ ] Semua 7 metrik PRD §04 punya angka (atau alasan tidak terukur).
- [ ] `docs/EXPERIMENT.md` memuat keterbatasan dan kalimat pitch yang jujur.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Bobcoin tidak cukup untuk dua putaran penuh | Kurangi ke 4 task (1, 2, 3, 6 — tetap bersinggungan di checkout.ts & utils.ts), catat |
| Waktu tidak cukup untuk putaran B nyata | Pakai `pnpm sim` sebagai putaran B otomatis + satu putaran nyata pendek; tandai jelas di laporan |
| Putaran A kebetulan tanpa konflik | Laporkan apa adanya; tekankan metrik lain (blokir yang dicegah, dampak antar-file tertangkap) |

## Catatan handoff

- Fase 14: angka & kalimat pitch dari `docs/EXPERIMENT.md`; screenshot Bobcoin untuk deck.
