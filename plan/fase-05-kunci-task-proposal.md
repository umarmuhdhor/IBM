# Fase 05 — Mesin kunci, task, permintaan, proposal, keputusan & brief

| Field | Nilai |
|---|---|
| Jalur | **Lane Alief** (Alief) · branch `lane/core` |
| Slot WITA | Sab 26 Sep 16:00 – 21:00 |
| Estimasi | 5 jam (fase terpenting) |
| Prasyarat | 03 (04 disarankan untuk test lapis kedua) |
| Requirement PRD | SV-02, SV-03, SV-04, SV-05, SV-06, MA-07 (sisi server), §06 seluruhnya, §07.3, §08.2, §09, BC-02/03 (sisi server brief) |
| Model | **Opus 5.5** · effort high (jangan diturunkan) |
| Bob slice | **A2**: `checkWrite()` + test tabel R4 §3 ditulis Bob IDE (mode Code). Prompt: "Implementasikan `checkWrite` di `radar/packages/server/src/services/locks.ts` persis tabel keputusan `plan/ref/R4-mesin-kunci.md` §3, dengan test tabel vitest." Bukti `02-check-write`. Claude Code lalu menambah property test invariant. |
| Fase berikutnya | 06 |

## Tujuan

Mewujudkan tiga aturan PRD di server: satu file satu penulis, kunci dipesan saat rencana disetujui dan dipegang sampai task disetujui, dan semua keputusan (rencana, rebutan, review) hanya berlaku setelah manusia menekan tombol di Mission Control. Semua endpoint REST yang dipakai hook, radar-mcp, dan Mission Control selesai di fase ini (kecuali diff & commit di fase 06).

## Bacaan wajib

- `plan/ref/R4-mesin-kunci.md` (**seluruhnya, baca dua kali**), `plan/ref/R2-skema-db.md` §4 invariant, `plan/ref/R3-kontrak-api.md` §1 matriks, §2.2–2.14, §2.16, §2.18–2.19, §2.21, §4
- PRD §05 matriks hak akses, §06, §07.1–7.5, §08.1–8.2, §09

## Output

- `packages/server/src/services/{locks,tasks,requests,proposals,brief,notifications}.ts`
- `packages/server/src/http/routes/{locks,tasks,requests,proposals,team,brief,activity,notify,state}.ts`
- `packages/server/src/services/locks.test.ts` (tabel), `invariants.prop.test.ts` (fast-check), `test/flow.int.test.ts`
- `/v1/state` lengkap, broadcast `lock.changed` via WS

## Langkah kerja

1. **Repository lengkap** untuk `task`, `allocation` (`headOf`, `nextPos`, `insert`, `delete`, `renumber`, `setFront`, `pathsOf`), `lock`, `task_touch`, `block`, `request` (`findOpen`, `create` — tangkap pelanggaran unique index dedup → kembalikan yang ada), `proposal`, `review`, `notification`.

2. **`locks.ts`** — implementasikan persis R4 §3–5:
   - `checkWrite(member, path, via)` → `{ decision, reason, holder?, requestId?, queuePos? }`
   - `resolveActiveTask(member)` (R4 §4, termasuk task adhoc)
   - `enqueue`, `releaseTaskLocks`, `advanceQueue`, `transferNow`, `revoke`
   - Semua dalam `withTx`; event sesuai R3 §5; setiap perubahan kunci juga menyiarkan WS `lock.changed` ke semua klien sync (dari bus `lock.*`).
   - Ganti `authorizeWrite` fase 03 dengan `checkWrite(..., 'sync')` sehingga lapis kedua aktif (SY-04/SV-03). Update yang diterima menulis `task_touch` & `edit_count` untuk task pemegang kunci.

3. **Route `POST /v1/locks/check`** (coder & pm): normalisasi path (`normalizeRelative`), maks 20 path per panggilan, jalankan `checkWrite` per path dalam **satu** transaksi, agregasikan, susun `message` blokir (templat R3 §2.2; sebut nama pemegang, task, "Jangan coba ulang", "Panggil radar why_blocked", "kerjakan bagian lain dari task <aktif>"). Catat `metric(lock_check_ms)`. Target p95 < 300 ms end-to-end (server < 20 ms).

4. **`tasks.ts` + routes**: `GET /v1/tasks`, `POST /v1/tasks/:id/activate`, `POST /v1/tasks/:id/submit` (R3 §2.9: lock task → `review`, event `task.submitted` + `task.status`, 409 bila tidak ada touch), `POST /v1/tasks/:id/cancel` (mc). Transisi status hanya lewat fungsi `transitionTask(task, to, by)` yang memvalidasi tabel R4 §2 (tolak transisi lain dengan 409).

5. **`requests.ts` + routes**: `GET /v1/blocks/last` (dengan `suggestion` R3 §2.6: file task aktif pemanggil yang bisa ditulis & belum di-review), `POST /v1/requests` (MCP `request_file`; file bebas → jawaban "bebas"), `GET /v1/requests` (pm/mc, gabung detail task kedua pihak + `editCount`).

6. **`proposals.ts` + routes**:
   - `POST /v1/proposals` (**hanya role pm**): validasi payload per jenis (zod + aturan bisnis):
     - `plan`: owner coder, tidak ada path ganda di `files` antar-task, file bersama wajib di `queuedFiles`, path valid. Pesan 422 menyebut path & task yang bentrok (supaya main agent bisa memperbaiki).
     - `decision`: request ada & aktif; `pecah` wajib `newTask`. Request → `diusulkan`, `proposal_id` diisi.
     - `review`: task ada & berstatus `review`; kalau sudah ada proposal review `menunggu` untuk task itu → tandai lama `kedaluwarsa`.
     - `decision` + `antre` + `AUTO_APPLY_QUEUE=true` → langsung `apply` dengan `decided_by='auto'`, status `diterapkan_otomatis`.
     - Event `proposal.created` (+ `review.flagged` bila `flags` tidak kosong — dicatat saat dibuat supaya metrik tetap terhitung walau PM menolak).
   - `GET /v1/proposals?status=`.
   - `POST /v1/proposals/:id/decision` (**hanya token mc**, MA-07): `approve=false` → `ditolak` + efek penolakan R4 §6; `approve=true` → `apply(proposal)` R4 §6.1–6.3. Untuk `review` disetujui, panggil `git.commitTask(task)` — **di fase ini pakai stub** `commitTask` yang mengembalikan sha palsu `"pending-fase-06"` di balik interface `GitWorker` supaya alur bisa dites; fase 06 menggantinya.
   - `event proposal.decided`, `request.decided` (+ `metric(block_to_decision_ms)`).

7. **`notifications.ts` + `POST /v1/notify`** (pm): simpan notifikasi + event `notify.sent`; batasi 200 karakter.

8. **`brief.ts` + `GET /v1/brief`** — implementasi R4 §8 dengan `clampBrief`. Untuk `kind=prompt`, ambil event dengan `id > since` yang relevan bagi member (keputusan untuknya, notifikasi untuknya, kunci berpindah ke dia, `file.changed` oleh orang lain untuk file yang dialokasikan ke dia atau diimpor oleh file miliknya → cukup "file yang dialokasikan ke dia + 5 perubahan terbaru lainnya"). Selalu kembalikan `cursor` = id event terbaru. PM juga boleh memanggil (brief PM: ringkasan permintaan & review menunggu).

9. **`GET /v1/team`, `GET /v1/activity`, `GET /v1/state` lengkap** (R3 §2.8, §2.10, §2.21).

10. **Test tabel `locks.test.ts`**: satu test per baris tabel R4 §3 (11 baris) + kasus: antrean 3 task pada satu file (maju berurutan saat approve), `pindahkan` memindahkan `task_touch`, `pecah` membuat task anak berantre, revoke memajukan antrean, cancel melepas semua kunci, auto-grab tanpa task membuat task adhoc, PM tidak pernah memegang kunci.

11. **Property test `invariants.prop.test.ts`** (fast-check, ≥ 300 run × 60 langkah): generator operasi acak `{check(member,path), update(member,path), submit(task), proposePlan(random), decide(proposal, approve), proposeDecision(request, option), cancel(task), revoke(path)}` pada 3 member × 6 file; setelah **setiap** langkah cek I1–I10 (R2 §4) lewat query SQL. Temuan counterexample → perbaiki kode, jangan longgarkan invariant.

12. **Test alur integrasi `test/flow.int.test.ts`** (REST + WS + 2 SyncAgent dari fase 04 bila tersedia):
    1. PM `POST /v1/proposals` plan (T-1 A: checkout.ts, coupon.ts; T-2 B: theme.css, Header.tsx; routes.ts antre A lalu B) → mc approve → kunci `dipesan` sesuai rencana, event `task.created`, `lock.reserved`, `lock.queued`.
    2. A check `checkout.ts` → allow `own` (dipesan→dipegang, T-1 dikerjakan).
    3. B check `checkout.ts` → block `held_by_other`, `requestId` R-1; ulang 3× → tetap R-1 (SV-05).
    4. B menulis `checkout.ts` lewat sync → `file.rejected`, isi B dipulihkan (SV-03/SY-04).
    5. B check `utils.ts` (bebas) → allow `grabbed` untuk T-2.
    6. PM propose decision `antre` untuk R-1 → `diterapkan_otomatis`, B antre `checkout.ts` pos 1; brief `prompt` B memuat keputusan.
    7. A submit T-1 → lock review; PM propose review `setujui_beri_tahu` dengan notify B → mc approve → T-1 `selesai`, commit stub, kunci `checkout.ts` pindah ke B (`dipesan`, SV-06), brief B memuat notifikasi.
    8. PM (token member C) memanggil decision → 403 (MA-07).
    9. `GET /v1/events/export` berisi urutan event lengkap yang cocok dengan skenario.
    Simpan export hasil test ini ke `packages/web/public/demo/events.fixture.json` sebagai bahan awal replay (fase 11).

13. **Kinerja**: test mikro 1000× `checkWrite` di `:memory:` → p95 < 5 ms. Catat.

14. Minta review silang (R6 §3 poin 4) bila waktu ada: sesi Sonnet 5 membaca `locks.ts` vs R4.

15. Commit `fase-05: lock engine, tasks, requests, proposals, brief`.

## Verifikasi

```bash
pnpm --filter @radar/server test          # tabel + property + flow hijau
pnpm --filter @radar/sync test            # regresi fase 04 tetap hijau
pnpm --filter @radar/server build && fly deploy   # atau platform terpilih
# smoke ke server deploy (token dari password manager):
curl -s -X POST $S/v1/locks/check -H "authorization: Bearer $TOK_B" -H 'content-type: application/json' \
  -d '{"paths":["src/utils.ts"],"tool":"write_file","clientTs":0}'
```

## Kriteria selesai (DoD)

- [ ] SV-02: 11 baris tabel R4 lulus; p95 server < 20 ms (bukti metric/test kinerja).
- [ ] SV-03: update dari bukan pemilik ditolak tanpa mengubah isi (test flow langkah 4).
- [ ] SV-04: rencana disetujui membuat task + memesan file (langkah 1).
- [ ] SV-05: blokir berulang tidak menduplikasi permintaan (langkah 3).
- [ ] SV-06: approve memindahkan kunci ke antrean berikutnya + notifikasi (langkah 7).
- [ ] MA-07 sisi server: semua endpoint persetujuan menolak token member (langkah 8 + test auth).
- [ ] Property test I1–I10 hijau ≥ 300 run.
- [ ] Server versi baru ter-deploy.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Waktu habis sebelum `pecah` | `pecah` P0 minimal: buat task baru + antre; UI boleh menampilkannya sederhana. Kalau tetap mepet: sembunyikan opsi `pecah` dari tool MCP (catat DECISIONS) — naskah demo hanya butuh `antre` |
| Property test menemukan bug sulit | Kecilkan generator, simpan seed counterexample sebagai test regresi, eskalasi ke Opus effort xhigh |
| Stub git lupa diganti | Fase 06 DoD mewajibkan test yang gagal bila sha = `pending-fase-06` |

## Catatan handoff

- Fase 06: implementasikan `GitWorker.commitTask` & `GET /v1/tasks/:id/diff`; urutan review disetujui R4 §6.3.
- Fase 07/08: semua endpoint coder & PM kini nyata — pindahkan radar-mcp & hook dari mock ke server asli.
- Fase 09: `GET /v1/state` + stream `event` lengkap.
