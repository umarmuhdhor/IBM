# Log fase 05 — Kunci, task, permintaan, proposal (Lane Alief)

- **Status:** [x] kode, test, dan review selesai. PR `fase-05: lock engine, tasks, requests, proposals, brief` dari snapshot `lane/core-f05`. Deploy server menunggu konfirmasi Alief (aksi produksi).
- **Mulai:** Sab 26 Sep 2026 13:20 WITA · branch `lane/core`.
- **Model:** Claude Opus 5.5 (R6 §2). BOB SLICE A2 ditulis IBM Bob IDE (mode Code).
- **Pra-cek:** `origin/main` tanpa perubahan lane core sejak fase 02. PR fase 03 ([umarmuhdhor/IBM#5](https://github.com/umarmuhdhor/IBM/pull/5)) dan fase 04 ([umarmuhdhor/IBM#10](https://github.com/umarmuhdhor/IBM/pull/10)) masih terbuka; fase 05 bertumpuk di atasnya.

## Checklist langkah (plan/fase-05-kunci-task-proposal.md)

- [x] 1. Repository `task`, `allocation`, `lock`, `task_touch`, `block`, `request` (dedup → yang ada), `proposal`, `review`, `notification`. `test/repo.test.ts`.
- [x] 2. `locks.ts`: `checkWrite` + `blockFor` (**BOB SLICE A2**, commit Bob `8d26df89`), `resolveActiveTask`, `enqueue`, `advanceQueue`, `releaseTaskLocks`, `transferNow`, `revoke`, tabel transisi `setStatus` (409 untuk transisi lain). `authorizeWrite` sync = `checkWrite(..., 'sync')` (SV-03), update yang diterima menulis `task_touch` + `edit_count`.
- [x] 3. `POST /v1/locks/check`: `cleanPath`, maks 20 path, satu transaksi, pesan templat R3 §2.2, `metric(lock_check_ms)` + `hook_rtt_ms`.
- [x] 4. `GET /v1/tasks`, `POST /v1/tasks/:id/{activate,submit,cancel}`.
- [x] 5. `GET /v1/blocks/last` (dengan `suggestion`), `POST /v1/requests`, `GET /v1/requests`.
- [x] 6. `POST/GET /v1/proposals`, `POST /v1/proposals/:id/decision` (hanya `mc`). Kerangka dua transaksi R4 §6.3 dengan `GitHubCommitter` stub (`pending-fase-06`); klaim basi dibersihkan saat objek start.
- [x] 7. `POST /v1/notify` (+ event `notify.sent`).
- [x] 8. `GET /v1/brief` (R4 §8, coder + PM, `start` + `prompt`).
- [x] 9. `GET /v1/team`, `GET /v1/activity`; `/v1/state` tetap dari fase 03.
- [x] 10. `locks.test.ts` (18 test tabel, Bob) + `test/engine.test.ts` (antrean 3 task, revoke, cancel, `pindahkan` memindahkan `task_touch`, `pecah` membuat task anak berantre, commit gagal, approve kedua saat commit → 409, matriks role, brief).
- [x] 11. `test/invariants.prop.test.ts`: fast-check 300 run × 60 langkah, I1–I10 + "pemilik kunci = pemilik task" dicek setelah setiap langkah. Tiap langkah punya savepoint sendiri (seperti satu request = satu transaksi), tiap run di-rollback. Cakupan satu run penuh: 1898 update diterima, 142 `lock.transferred`, 385 `lock.queued`, 34 task `selesai`, 366 `batal`, 1449 penolakan bisnis.
- [x] 12. `test/flow.int.test.ts` 9 langkah (REST + 2 socket sync). Export event disimpan ke `packages/server/test/fixtures/flow-export.json` (ts dinormalkan ke garis waktu tetap supaya deterministik).
- [x] 13. Kinerja: 1000 panggilan `/v1/locks/check` lewat stub DO, p95 < 20 ms (lulus). Catatan: di Workers `Date.now()` tidak maju selama eksekusi sinkron, jadi `serverMs`/`lock_check_ms` praktis 0; angka yang berguna adalah `hook_rtt_ms` dan p95 test ini.
- [ ] 14. Review silang Sonnet 5 (opsional) — dilewati; lima reviewer ECC dipakai.
- [x] 15. Commit.

## BOB SLICE A2

- Bob IDE mode Code menulis `checkWrite`/`blockFor` + 18 test tabel, menjalankan test, lalu commit + push sendiri.
- Commit Bob: `8d26df89 feat(server): checkWrite decision table (R4 §3)` dengan trailer `Bob-Assisted: bob_sessions/uaai_alief_task02_check_write_summary.png`.
- Bukti: `bob_sessions/uaai_alief_task02_check_write_summary.png` + baris di `bob_sessions/index/alief.md` (commit `7569e791`).
- Perubahan Claude sesudahnya: kasus "promote kepala antrean" di `checkWrite` memakai `advanceQueue` (satu jalur untuk event + notifikasi).

## Bukti TDD

- Tabel R4 §3 (Bob): 18/18.
- Integrasi WS lama menyesuaikan diri dengan lapis kedua: `ws.test.ts` update pertama kini `taskId: 'T-1'` (auto-grab), test SV-03 baru.
- Test yang menemukan bug: matriks role (`notify` ke member tidak ada → 500 karena `requireMember` melempar `Error` biasa) → diperbaiki jadi 404.

## Review

| Reviewer | Temuan | Tindakan |
|---|---|---|
| `ecc:code-reviewer` (percobaan pertama kena rate limit, diulang) | HIGH: file bebas yang disentuh setelah submit masuk ke task yang sedang review dan ikut commit tanpa review. MEDIUM: `returnTaskToWorking` tanpa event; `closeTask` menutup request tanpa event dan usulan keputusannya tetap `menunggu`; `transferNow`/`revoke`/review baru mengabaikan klaim commit; `revoke` meninggalkan touch yang lalu ikut commit. LOW: antrean basi dengan kepala milik pemanggil → 500; JSDoc ganda. | Diperbaiki semua kecuali event request `batal` (butuh perubahan kontrak, dicatat D-alief-05): task review kembali `dikerjakan` (atau blok `committing` saat commit), event `lock.acquired` + `proposal.decided kedaluwarsa`, 409 saat commit berjalan, snapshot hanya path yang masih dikunci task, kepala antrean dipromosikan lalu dicek ulang. +2 test regresi. |
| `ecc:typescript-reviewer` | HIGH: payload usulan di-cast `as` tanpa validasi ulang; HIGH: `payload.newTask!`. MEDIUM: `pathOf` membaca `payload.path` tanpa switch tipe. | Diperbaiki: `storedPayload` (zod ulang, 500 bila rusak), guard `newTask`. MEDIUM dicatat di D-alief-05. |
| `ecc:security-reviewer` | HIGH: IDOR `GET /v1/tasks?owner=` (coder bisa baca task orang lain). LOW: pesan galat committer bocor ke klien; tidak ada batas ukuran body eksplisit. | Diperbaiki: `?owner=` lain → 403 + test; pesan commit gagal kini tetap. Batas body dicatat (MEDIUM/LOW, D-alief-05). Role matrix, path traversal, SQL, secret: bersih. |
| `ecc:silent-failure-hunter` | Galat committer ditelan tanpa stack; `toErrorResponse` tanpa stack; `requireMember`/`requireTask` → 500; payload rusak tak terdeteksi; alasan klaim basi tak dicatat. | Diperbaiki semua (log + stack, 404, `storedPayload`, log alasan basi). `?? ''` dan "rekan lain" dicatat MEDIUM. |
| `ecc:pr-test-analyzer` | Jalur tolak (plan/decision/review), 422 plan, `kembalikan`, keputusan untuk request tertutup, submit tanpa perubahan, request duplikat, bentuk team/activity belum dites. | Ditambah 10 test di `test/engine.test.ts`. |

QA akhir: `pnpm lint`, `pnpm typecheck`, `pnpm test` di `radar/` hijau (server 110 test).

## Placeholder aktif

- Tidak ada `TODO(sync`.
