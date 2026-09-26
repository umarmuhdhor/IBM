# Log fase 05 — Kunci, task, permintaan, proposal (Lane Alief)

- **Status:** [~] langkah 1 selesai, kerangka langkah 2 siap. Menunggu **BOB SLICE A2** (`checkWrite` + test tabel R4 §3).
- **Mulai:** Sab 26 Sep 2026 13:20 WITA · branch `lane/core`.
- **Model:** Claude Opus 5.5.
- **Pra-cek:** `origin/main` tanpa perubahan lane core sejak fase 02. PR fase 03 ([#5](https://github.com/umarmuhdhor/IBM/pull/5)) dan fase 04 ([#10](https://github.com/umarmuhdhor/IBM/pull/10)) masih terbuka; fase 05 bertumpuk di atasnya.

## Checklist langkah

- [x] 1. Repository `task`, `allocation` (`headOf`, `nextPos`, `insert`, `delete`, `renumberQueue`, `setFront`, `pathsOf`), `lock`, `task_touch`, `block`, `request` (dedup → yang ada), `proposal`, `review`, `notification`. Test `test/repo.test.ts` 7/7 (RED: modul belum ada → GREEN).
- [~] 2. `locks.ts`: helper Claude selesai (`resolveActiveTask` R4 §4, `commitClaimActive`, `isIgnoredPath`, `holderOf`, `markTaskWorking`, `returnTaskToWorking`, `lockChanged`), test `locks-helpers.test.ts` 5/5. `checkWrite` + `blockFor` + test tabel = BOB SLICE A2.
- [ ] 3–15.

## BOB SLICE A2 (menunggu Alief di Bob IDE)

Mode Bob: **Code**. Workspace Bob: root repo `IBM/`, branch `lane/core` (sudah di-push, working tree bersih).
Bukti: `radar/scripts/bob-evidence.sh alief 02 check_write` → `bob_sessions/uaai_alief_task02_check_write_summary.png`.
Prompt siap tempel ada di laporan chat sesi ini (4 prompt: implementasi, test tabel, jalankan test, commit + push dengan trailer `Bob-Assisted`).

## Placeholder aktif

- Tidak ada `TODO(sync`.
