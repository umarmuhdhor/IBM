# Fase 15 · Peran PM tunggal, pembagian task dengan langkah, centang oleh coder

Lane: Bob (Umar), branch `fitur_PM`. Permintaan Umar 27 Sep: fitur ini ditulis **lewat IBM Bob IDE** (Claude Code
mengetik prompt di Bob, memantau, me-review, menjalankan test, dan mengambil screenshot bukti setiap task).
Perubahan menyentuh folder lane lain (common/server = Core, app = App) atas permintaan langsung; dicatat di
`DECISIONS.md` sebagai D-umar-06.

## Permintaan

1. Ada peran PM, dan **hanya satu PM per room** (workspace).
2. PM membagikan task ke coder, dipecah supaya tabrakan minimal.
3. Hasil pembagian muncul di tampilan coder. Coder bisa menandai bagian yang sudah selesai, dan itu muncul di
   halaman PM.
4. Pakai yang disediakan Bob (mode `pm-lead`/`coder`, radar-mcp, hooks).

## Rancangan

| Bagian | Isi |
|---|---|
| PM tunggal (server) | `POST /v1/join` dengan peran `pm` ditolak 409 kalau sudah ada member aktif lain dengan peran `pm`: "This room already has a PM (<nama>). Join as a coder." Berlaku untuk kursi baru dan kursi yang dipakai ulang (D-alief-20). App sudah menampilkan pesan error server di kartu Join. |
| Pembagian task | Tetap lewat Bob mode `pm-lead` → tool `propose_plan`. File antar-task sudah tidak boleh overlap (skema `PlanPayload`), itu yang meminimalkan tabrakan. Baru: tiap task punya `steps` (checklist ≤ 12 langkah) yang ditulis PM. Rencana tetap disetujui Mission Control seperti sebelumnya. |
| Langkah (common) | `TaskView.steps: {text, done}[]`, `PlanTask.steps: string[]`, event baru `task.step {taskId, index, done, by}`, `StepReq`/`StepRes`, `steps` di `TaskItem` dan `TeamRes.tasks`. |
| Langkah (server) | Tabel baru `task_step` (skema v7, `CREATE TABLE IF NOT EXISTS`). `applyPlan` menyimpan langkah. `POST /v1/tasks/:id/steps` (coder pemilik task, status `terbuka`/`dikerjakan`) mencentang/membatalkan satu langkah dan mengirim event `task.step`. Snapshot, `/v1/tasks`, `/v1/team` ikut membawa langkah. |
| Bob (radar-mcp) | Coder: tool baru `complete_step`; `my_tasks` menampilkan langkah. PM: `team_status` menampilkan progres x/y; `propose_plan` menerima `steps`. Rules kit `pm-lead` menyuruh PM memecah pekerjaan per coder dengan file yang tidak overlap dan langkah yang bisa dicentang. |
| App | Tab baru **My tasks** (peran coder): task milik sendiri, file yang dialokasikan, checklist langkah yang bisa dicentang, tombol "Mark task done" (submit ke review). Tab **Tasks** (peran PM dan Mission Control): papan per coder dengan progres langkah live. |

## Task Bob

| Task | Isi | Screenshot |
|---|---|---|
| 16 | Kontrak `@radar/common`: steps, event `task.step`, StepReq/Res, reducer + test | `uaai_umar_task16_pm_task_steps_common_summary.png` (3.11 Bobcoin) |
| 17 | Server: satu PM per room, tabel `task_step` (v7), `POST /v1/tasks/:id/steps`, steps di state/tasks/team, test | `uaai_umar_task17_single_pm_task_steps_server_summary.png` (18.03 Bobcoin) |
| 18 | radar-mcp `complete_step`, steps di `my_tasks`/`team_status`/`propose_plan`, rules kit PM + coder | `uaai_umar_task18_mcp_complete_step_kit_summary.png` (1.93 Bobcoin) |
| 19 | App: tab My tasks (coder) + Tasks (PM/MC), IPC `setTaskStep`/`submitTask`, test | `uaai_umar_task19_app_task_board_summary.png` (2.90 Bobcoin) |
| 20 | Uji perilaku: Bob mode **Live Collab PM Lead** membagi goal kupon ke B dan D via `propose_plan` dengan steps, melawan Worker lokal | `uaai_umar_task20_pm_lead_plan_with_steps_summary.png` (0.218 Bobcoin) |

## Jalannya per task

### Task 16 · common (Bob mode Agent)

- Prompt: file persis (`constants/types/schemas/reducer/reducer.test`), bentuk skema, dan perintah test.
- Bob juga menemukan sendiri bahwa `events.ts` (daftar `EVENT_TYPES` + kalimat feed) dan `schemas.test.ts` (jumlah
  event 36 → 37) harus ikut berubah.
- Hasil Bob: 148 test common hijau, `tsc --noEmit` bersih. Review Claude: diff bersih; satu header komentar
  `2.9 submit` terduplikasi (dirapikan di commit terpisah).
- Commit `366594a1` (trailer `Bob-Assisted`).

### Task 17 · server (Bob mode Agent)

- Bob menambah `activePm()` di repo member dan menjaga kedua jalur join (kursi baru dan kursi dipakai ulang), tabel
  `task_step`, repo `task-step.ts`, `setTaskStep()` + route, steps di `buildState`/`buildTeam`/`toTaskItem`, mock hub.
- Test lama yang memakai dua PM di satu room (`seats`, `join`) disesuaikan ke coder; `db.test` ke skema v7 +
  tabel baru; fixture `flow-export.json` + `engine.test` menerima field `steps`. Test baru `test/pm-tasks.test.ts`
  (13 kasus: 409 PM kedua, coder tetap bisa join, PM gabung ulang di kursinya, steps di state/tasks, centang oleh
  pemilik, 403 coder lain, 403 PM, 404 indeks salah, 409 saat review).
- Catatan pemantauan: Bob dua kali menjalankan `git stash` untuk membandingkan test dengan baseline. Claude
  memeriksa `git stash list` setiap kali; Bob mengembalikan perubahan dengan `stash pop` dan tidak ada yang hilang.
  Bob lalu berputar menjalankan ulang test yang flaky, jadi Claude menghentikan task (18.03 Bobcoin).
- Verifikasi Claude: `pnpm -C radar typecheck` bersih; server 228/231 saat mesin sibuk, 3 yang gagal adalah test
  waktu (`engine` p95 latensi, `hardening` 413, `diff` 60 KB). Ketiganya + `pm-tasks` lulus 55/55 saat dijalankan
  ulang tanpa beban.
- Commit `556c57f5` (trailer `Bob-Assisted`).

### Task 18 · radar-mcp + kit (Bob mode Agent)

- Prompt berisi 8 perubahan file-spesifik dan larangan menjalankan test/git (menghemat Bobcoin; Claude yang
  menjalankan test). Bob menambah `complete_step.ts`, checklist di `my_tasks`, progres `x/y langkah` di
  `team_status`, `steps` di `propose_plan`, `complete_step` di `alwaysAllow`, aturan baru di `custom_modes.yaml` PM
  dan `rules-coder/01-radar.md`.
- Verifikasi Claude: mcp 50/50 test, typecheck bersih. `pnpm -C radar bundle:kit` membangun ulang
  `radar-mcp.js` dan hook di `bob-kit/` (commit terpisah `f528b86e`).
- Commit `41f4f943` (trailer `Bob-Assisted`).

### Task 19 · app (Bob mode Agent)

- Bob menulis `TaskBoardView.tsx` (+ test), tab `tasks` di `RadarPanel` dan sidebar, `postAsMember` +
  `setTaskStep`/`submitTask` di main process, handler IPC, dan bridge preload.
- Review Claude: satu prop tidak dipakai dan dua `if` tanpa kurung (oxlint), fixture test lama tanpa `steps`
  (typecheck). Diperbaiki di commit terpisah `c330ed81` bersama header duplikat di `schemas.ts` dan steps di mock hub.
- Verifikasi Claude: app vitest `components/radar` + `main/radar` 181/181, `pnpm run typecheck` 0 error, oxlint
  bersih di file baru (satu temuan lama `WatchBobView.tsx:23` bukan dari fase ini), `pnpm -C radar lint` bersih.
- Commit `137f3dfa` (trailer `Bob-Assisted`).

### Task 20 · uji Bob PM Lead melawan Worker lokal

Setup (token hanya di file 0600 di scratchpad, tidak pernah dicetak): `wrangler dev --port 8787` dengan state di
scratchpad; script `scenario.mjs` membuka workspace (owner Alief = A), lalu join Budi (coder, B), Citra (pm, C),
Dewi (coder, D), dan mencoba Eko sebagai pm kedua.

| Cek | Hasil |
|---|---|
| PM kedua | `409 This room already has a PM (Citra). Join as a coder.` |
| Bob PM Lead (folder toko-demo + kit PM, token Citra) | prompt: tambah fitur kupon, coder B dan D, 2 task tanpa file bersama, 3–5 langkah |
| Usulan | `P-1`: B "Coupon logic & cart discount calculation" (`src/checkout/coupon.ts`, `src/cart/cart.ts`, 5 langkah); D "Coupon input UI & styles" (`src/ui/CouponInput.tsx`, `src/ui/theme.css`, 5 langkah). Tidak ada file yang sama. |
| Setujui di app (Mission Control) | Feed "Citra's Bob (PM) proposes a plan (P-1)"; Approve → tab **Tasks**: "Budi 0/5", "Dewi 0/5" dengan file dan checklist |

### Task 21 · uji Bob Coder `complete_step` melawan Worker lokal

- Folder yang sama + kit coder + token Budi, Bob mode **Live Collab Coder**: "panggil my_tasks, centang langkah 1
  dan 2 dengan complete_step, jangan edit file". Bob: "Progress: 2 / 5 steps complete (40%)" (0.146 Bobcoin).
- Tab **Tasks** di app (Mission Control) ikut berubah live tanpa reload: "Budi 2/5", dua langkah ✓, bar progres
  (`ui-15/pm-tasks-board-1512.png`).
- App sebagai coder Dewi (Settings → role Coder, token test lokal lewat clipboard, tidak pernah dicetak): tab
  **My tasks** hanya menampilkan task Dewi; mencentang langkah 1 dan 3 lewat checkbox → server → event `task.step`
  (`ui-15/coder-my-tasks-1512.png`). "Mark task done" sebelum ada edit ditolak server dengan pesan yang jelas
  (`ui-15/coder-error-recovery-1512.png`).

## Gerbang UI `better-interface` (27 Sep, Claude Code)

Scope: `TaskBoardView` (tab Tasks untuk PM/Mission Control, tab My tasks untuk coder), tema gelap, lebar 1512,
app dev melawan Worker lokal. Stack: React + Tailwind, token `--lc-*`. Konvensi: `CLAUDE.md`, `app/AGENTS.md`,
`DESIGN.md`. Pola yang dipakai ulang: pembersih prefix IPC dari `InviteCodesCard.tsx:36`.

| Domain | Bukti | Hasil |
|---|---|---|
| Accessibility | checkbox native + `<label htmlFor>`, `role="progressbar"` + aria-valuenow/max/label, `role="alert"` untuk error, heading h3/h4; outline fokus bawaan dipertahankan (`main.css:514` `outline-ring/50`) | 1 HIGH (diperbaiki) |
| Layout | kartu per task, urutan judul → status → file → progres → langkah → aksi | Clear |
| Writing | label tombol, empty state, pesan error | 1 HIGH + 1 MEDIUM (diperbaiki) |
| Typography | `[overflow-wrap:anywhere]` pada judul/path/langkah (tanpa truncate) | 1 LOW (diperbaiki) |
| Colors | isi progres `--lc-ok` + angka x/y (bukan warna saja), status teks, ✓/○ di PM | Clear |
| UI | radius/border sama dengan kartu Mission Control; animasi lebar progres dihapus | Clear setelah perbaikan |

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| HIGH | Writing | `TaskBoardView.tsx:56`, `:74` | "Error invoking remote method 'radar:submit-task': Error: Task T-2 has not changed any file yet." | "Task T-2 has not changed any file yet. Edit its files in Bob first, then mark it done." | Error tanpa jalan keluar + prefix teknis Electron — **diperbaiki**, test baru |
| HIGH | Accessibility | `TaskBoardView.tsx:31` | `transition-[width]` pada isi progres | transisi dihapus | Gerak pada interaksi yang sering, tidak menghormati `prefers-reduced-motion` — **diperbaiki** (hapus, bukan tambah media query) |
| MEDIUM | Writing | `TaskBoardView.tsx:204` | "Budi 2/5" | "Budi 2/5 steps" | Angka tanpa satuan — **diperbaiki** |
| LOW | Typography | `TaskBoardView.tsx:204` | angka proporsional | `tabular-nums` | Angka yang berubah tidak bergeser — **diperbaiki** |

Tidak diverifikasi: lebar 320 px / zoom 200 %, tema terang, screen reader nyata, ring fokus ter-render (hanya dari
CSS). Verdict: **Approve** (tidak ada HIGH tersisa).

## Verifikasi akhir

- radar: `typecheck` + `lint` bersih; common 148, mcp 50, server 228/231 saat mesin sibuk (3 test waktu), 55/55
  saat diulang tanpa beban.
- app: vitest `components/radar` + `main/radar` 182 lulus (termasuk 8 test `TaskBoardView`), `pnpm run typecheck`
  0 error, oxlint bersih di file baru.
- E2E lokal: PM kedua 409; Bob PM Lead → `propose_plan` dengan steps; approve di app; Bob Coder `complete_step` →
  board PM live; centang dan "Mark task done" dari app coder.

## Bobcoin

| Task | Bobcoin |
|---|---|
| 16 common | 3.11 |
| 17 server | 18.03 |
| 18 mcp + kit | 1.93 |
| 19 app | 2.90 |
| 20 uji PM Lead | 0.218 |
| 21 uji Coder | 0.146 |
| **Total** | **26.33** |

Pelajaran: Task 17 mahal karena Bob menjalankan ulang suite server berkali-kali (test flaky) dan dua kali memakai
`git stash`. Mulai Task 18 prompt melarang Bob menjalankan test/git; Claude yang memverifikasi.

## Catatan

- Rencana PM tetap harus disetujui Mission Control (tidak berubah).
- Deploy server ke Cloudflare **belum** dilakukan; skema v7 dibuat otomatis saat DO bangun (`CREATE TABLE IF NOT
  EXISTS`). Kit Bob di folder pengguna perlu dipasang ulang (`radar kit install` / tombol di app) agar
  `complete_step` tersedia.

## Lanjutan · PM boleh menambah dokumen (Task 22)

- Permintaan Umar: PM harus bisa memasukkan file brief ke folder proyek supaya bisa dipanggil (`@brief.md`) di
  Bob. Sebelumnya `checkWrite` baris 2 menolak semua tulisan PM (`pm_readonly`), dan sync agent melewatkan file
  baru PM saat scan awal. Lampiran chat Bob (⇧ drag) hanya menerima gambar, jadi file teks harus ada di workspace.
- Keputusan Umar (pilihan dari tiga): **dokumen saja**, `.md` dan `.txt`. PDF tidak termasuk karena sync menolak
  file biner.
- Aturan baru (`locks.ts` baris 2): PM + dokumen bebas → `allow 'pm_doc'` tanpa kunci, tanpa task, tanpa event;
  dokumen yang dipegang coder → `held_by_other`; di bawah klaim commit → `committing`; PM + file lain →
  `pm_readonly` seperti sebelumnya. Sync agent tidak lagi melewatkan dokumen baru PM. Pesan penolakan dan brief
  PM menjelaskan aturannya.
- Bob (mode Agent, 2.95 Bobcoin, `uaai_umar_task22_pm_can_add_documents_summary.png`): 7 perubahan file-spesifik
  + 3 test baru di `locks.test.ts`; Bob tidak menjalankan test. Satu perintah `find … | head` (hanya baca)
  di-approve Claude. Commit `d7125a9f`.
- Perbaikan Claude (`871c078c`): label log scan sync, kalimat brief PM, test sync yang memakai `README.md` sebagai
  contoh penolakan PM diganti ke file kode, dan test integrasi baru: PM menulis `docs/brief.md` → coder A dan B
  menerimanya. Kit Bob di-bundle ulang (`822e5c12`).
- Verifikasi: common 148, sync 74, server 234, hooks 52, mcp 50; `pnpm -C radar typecheck` + `lint` bersih.
- Catatan: dokumen PM tidak punya task, jadi tidak ikut commit GitHub per task; dokumen tetap tersimpan di server
  dan tersinkron ke semua anggota.
