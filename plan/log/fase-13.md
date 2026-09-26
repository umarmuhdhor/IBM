# Log fase 13 — Eksperimen A/B & metrik (Lane Umar · Bob)

- **Status:** [ ] persiapan selesai; putaran A/B belum dijalankan (butuh fase 10 `[x]`, coder A/B, PM, Bobcoin; slot Min 04:30–10:30).
- **Persiapan:** Sab 26 Sep 2026 19:05–20:00 WITA, branch `lane/bob` di atas `main` 7d564e91, atas permintaan Umar sebelum interupsi fase 10 pukul 21:00 (D-umar-05).
- **Model:** Claude Opus 5.5.

## Persiapan (dikerjakan)

- [x] Protokol ditulis sebelum eksperimen: `radar/docs/EXPERIMENT.md` bagian "Protokol A/B" (yang sama di kedua putaran, langkah A/B, metrik + sumber, keterbatasan).
- [x] Prompt kata demi kata: `radar/docs/experiment-data/prompts.md` (6 task coder, prompt PM, aturan jawaban).
- [x] `radar/scripts/ab/setup-round-a.sh`: clone biasa → `ab/a-coder<X>` di commit awal; menolak bila `.radar/` atau hook Radar ada; `--bundle` untuk mengirim branch tanpa push.
- [x] `radar/scripts/ab/git-conflicts.ts` + `merge-check.ts`: putaran A `check` (file + hunk konflik, konflik dibiarkan untuk diselesaikan manual) lalu `finish --minutes` (menolak bila penanda konflik tersisa, commit merge, build dicatat walau merah).
- [x] `radar/scripts/ab/collect-round-b.ts`: export event berhalaman, `/v1/report/session` (null bila belum ada), replay commit ter-push di atas commit awal untuk menghitung konflik.
- [x] `radar/scripts/metrics.ts`: metrik PRD §04 dari event export (audit dua penulis, blokir, blokir → keputusan, `review.flagged`, commit, `sync.applied`) + latensi cek kunci dari `hook.log`.

TDD: RED `5e00432c` (metrics + git-conflicts), `bdc267bd` (collect-round-b), `6ca6ef7b` (merge-check CLI), 2 test `hook.log` merah sebelum `408a596e` → GREEN `f117dfbc`, `950bba27`, `408a596e`.

## Belum (putaran asli)

- [ ] Putaran A (2 coder, 45 menit) → `round-a.json`.
- [ ] Putaran B (reset server, 2 coder + PM) → `round-b.json`, `events.round-b.json`, `metrics.json`.
- [ ] Hasil + interpretasi + kalimat pitch di `EXPERIMENT.md`; tabel metrik final untuk fase 14; bukti Bob `eksperimen_a` / `eksperimen_b`.
