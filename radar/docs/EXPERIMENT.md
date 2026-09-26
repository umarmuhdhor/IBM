# A/B experiment (fase 13)

> Skeleton from fase 00. Filled in by the owning phase.

## Latensi sinkron (bench)

`pnpm -C radar bench:sync [-- --server <url>]` (fase 04 langkah 12). Dua `SyncAgent` di satu Mac, A menulis satu file, B mencatat kapan tiap versi sampai. Latensi = `appliedTs(B) − writeTs(A)` dengan satu jam, jadi tidak ada selisih jam antar-PC. Mode `--server` membaca token dari `RADAR_TOKEN_A` / `RADAR_TOKEN_B` (env, bukan argumen).

| Waktu (UTC) | Target | Write | Diterima B | p50 (ms) | p95 (ms) | max (ms) | Update |
|---|---|---|---|---|---|---|---|
| 2026-09-26T04:58 | local createTestHarness (wrangler dev runtime) | 100 × 200 ms | 94 (6 coalesced) | 156 | 159 | 172 | A 94 / B 0 |
| 2026-09-26T04:58 | https://live-collab.afindo-mi01.workers.dev | 50 × 200 ms | 50 (0 coalesced) | 195 | 295 | 300 | A 50 / B 0 |

Catatan: "coalesced" = write yang jaraknya lebih pendek dari debounce 150 ms (jitter event fs) digabung jadi satu update. Isi terakhir tetap sampai. Target PRD p95 < 1000 ms lulus.

## Protokol A/B (ditulis Sab 26 Sep 19:40 WITA, sebelum eksperimen)

Ditulis sebelum putaran mana pun dijalankan supaya hasil tidak memengaruhi cara ukur (fase 13 langkah 1). Perubahan protokol setelah ini dicatat di bagian "Deviasi" beserta alasannya.

### Pertanyaan

Pada 6 task yang sengaja bersinggungan (`examples/toko-demo/EXPERIMENT_TASKS.md`), berapa konflik merge, menit resolusi, build rusak, dan Bobcoin **tanpa** Radar (putaran A) dibanding **dengan** IBM Bob Live Collab (putaran B)? Tidak ada target angka selain PRD §04: build rusak 0 dengan Live Collab; waktu dilaporkan apa adanya walaupun lebih lambat.

### Yang sama di kedua putaran

- Repo `aliefauzan/toko-demo` di **commit awal yang sama** (SHA dicatat di `experiment-data/round-a.json` dan `round-b.json`).
- 6 task, pembagian awal A = 1, 3, 5 · B = 2, 4, 6. Di putaran B pembagian mengikuti rencana main agent; alokasinya dicatat.
- Prompt Bob **kata demi kata** dari `experiment-data/prompts.md`. Bob bertanya → jawaban tetap "Lanjutkan sesuai task." (dicatat).
- Batas 45 menit per putaran, coder dan PM orang yang sama, satu akun Bob per orang.
- Berhenti bila sisa Bobcoin akun turun ke cadangan rekaman (PRD §18: cadangan 12, Umar 8). Putaran yang terhenti dilaporkan sebagai terhenti, bukan dibuang.

### Putaran A: cara biasa

1. Tiap coder: clone baru toko-demo (tanpa `.bob/` Radar dan `.radar/`), lalu `bash radar/scripts/ab/setup-round-a.sh <clone> <A|B> <sha-awal>` (menolak jalan bila kit Radar masih ada).
2. Kerjakan task dengan Bob mode Code, `git commit -am "task <n>"` per task. Catat Bobcoin tiap task dari ringkasan task Bob.
3. Setelah putaran: `setup-round-a.sh --bundle <clone> <X>` → kirim bundle ke Umar (coder bukan collaborator repo, jadi tanpa push).
4. Umar di satu clone: `git fetch <bundle> ab/a-coderX:ab/a-coderX` untuk A dan B, lalu
   `pnpm -C radar exec tsx scripts/ab/merge-check.ts check --repo <clone> --base <sha-awal> --out docs/experiment-data/round-a.json`
   → jumlah file konflik dan hunk (`<<<<<<<`), konflik dibiarkan di working tree.
5. Stopwatch mulai, konflik diselesaikan manual (boleh dibantu Bob, Bobcoin dicatat), lalu
   `… merge-check.ts finish --repo <clone> --minutes <n> --out docs/experiment-data/round-a.json` → menolak bila penanda konflik tersisa, commit merge, jalankan `npm run build`, mencatat hasil build (merah tetap dicatat).

### Putaran B: dengan IBM Bob Live Collab

1. Alief: `admin reset` + `admin init` dengan clone toko-demo di **commit awal yang sama** (lihat catatan reset milestone).
2. `radar join` untuk A, B (kit coder) dan C (kit pm); trust workspace di Bob IDE.
3. PM: prompt "Awal" dari `prompts.md` → Mission Control menyetujui rencana. Coder: prompt `coder-mulai`, lalu prompt task yang sama dengan putaran A. PM memakai prompt "Ada permintaan" dan "Task diajukan" saat kartunya muncul.
4. Setelah putaran (token dari env, tidak diketik di argumen):
   `RADAR_TOKEN=<token mc> pnpm -C radar exec tsx scripts/ab/collect-round-b.ts --server <url> --out docs/experiment-data/round-b.json --events-out docs/experiment-data/events.round-b.json --repo <clone toko-demo, sudah pull> --base <sha-awal>`
   → metrik dari event log + konflik merge **diukur** dengan memutar ulang commit task yang ter-push di atas commit awal (bukan diasumsikan 0).
5. Latensi cek kunci: kumpulkan `.radar/hook.log` dari PC A dan B, lalu
   `pnpm -C radar exec tsx scripts/metrics.ts --events docs/experiment-data/events.round-b.json --hook-log <A/hook.log> --hook-log <B/hook.log> --out docs/experiment-data/metrics.json`.

### Metrik dan sumbernya

| Metrik | A | B | Sumber |
|---|---|---|---|
| File konflik / hunk | ✓ | ✓ | `merge-check.ts check` · `collect-round-b.ts` (replay) |
| Menit resolusi konflik | ✓ | ✓ (0 bila tidak ada konflik) | stopwatch → `finish --minutes` |
| Task selesai (dari 6) | ✓ | ✓ | commit per task · `commit.created` |
| Build hijau di akhir | ✓ | ✓ | `finish --build` · `npm run build` di clone setelah pull |
| Bobcoin per akun | ✓ | ✓ | ringkasan task Bob (screenshot `bob_sessions/`, R7) |
| Blokir, blokir → keputusan | – | ✓ | `lock.blocked`, `request.created` → `request.decided` |
| Dua penulis bersamaan | – | ✓ | audit `file.changed` vs pemegang kunci (`metrics.ts`) |
| Latensi sinkron / cek kunci p95 | – | ✓ | `sync.applied` · `hook.log` (`ms=`) |
| `review.flagged` | – | ✓ | event log |

### Keterbatasan yang sudah diketahui sebelum menjalankan

- n kecil: 6 task, 2 coder, 1 putaran per kondisi (kalau Bobcoin cukup, putaran kedua dengan pasangan coder ditukar).
- Skenario dirancang tim sendiri, dengan konflik yang disengaja; bukan sampel proyek nyata.
- Efek belajar: putaran A dijalankan lebih dulu, jadi coder sudah mengenal task di putaran B.
- Bob nondeterministik: prompt sama bisa menghasilkan perubahan berbeda.
- Satu repo kecil (React + TypeScript), satu jaringan.

### Data

`docs/experiment-data/{prompts.md, round-a.json, round-b.json, events.round-b.json, metrics.json}`. Tidak ada token di file data: `collect-round-b.ts` membaca token dari env dan tidak menulisnya.
