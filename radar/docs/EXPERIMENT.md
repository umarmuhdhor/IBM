# A/B experiment (fase 13)

> Skeleton from fase 00. Filled in by the owning phase.

## Latensi sinkron (bench)

`pnpm -C radar bench:sync [-- --server <url>]` (fase 04 langkah 12). Dua `SyncAgent` di satu Mac, A menulis satu file, B mencatat kapan tiap versi sampai. Latensi = `appliedTs(B) − writeTs(A)` dengan satu jam, jadi tidak ada selisih jam antar-PC. Mode `--server` membaca token dari `RADAR_TOKEN_A` / `RADAR_TOKEN_B` (env, bukan argumen).

| Waktu (UTC) | Target | Write | Diterima B | p50 (ms) | p95 (ms) | max (ms) | Update |
|---|---|---|---|---|---|---|---|
| 2026-09-26T04:58 | local createTestHarness (wrangler dev runtime) | 100 × 200 ms | 94 (6 coalesced) | 156 | 159 | 172 | A 94 / B 0 |
| 2026-09-26T04:58 | https://live-collab.afindo-mi01.workers.dev | 50 × 200 ms | 50 (0 coalesced) | 195 | 295 | 300 | A 50 / B 0 |

Catatan: "coalesced" = write yang jaraknya lebih pendek dari debounce 150 ms (jitter event fs) digabung jadi satu update. Isi terakhir tetap sampai. Target PRD p95 < 1000 ms lulus.
