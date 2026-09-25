# Log fase 08 — Main agent `pm-lead` & tool MCP PM (Lane Umar · Bob)

- **Status:** [x] selesai melawan fake server. Uji ulang melawan server asli (fase 05/06) = fase 10.
- **Mulai:** Sab 26 Sep 2026 01:12 WITA · **Selesai:** 01:30 WITA · branch `lane/bob` (di atas `main` setelah PR #2 fase 07 di-merge).
- **Model:** Claude Opus 5.5 (R6 §2: Sonnet 5 · high). Plugin ECC tersedia mulai fase ini: review memakai `ecc:code-reviewer` + `ecc:typescript-reviewer`.

## Ringkasan rencana

1. Test dulu (`packages/mcp/test/pm.test.ts`): daftar tool PM persis 8, payload R3 §4.1–§4.3, 422 plan, `pecah` butuh `new_task`, baris pertama `get_task_diff`, `session_report` sebelum fase 12.
2. Bob slice B4b: 8 tool di `packages/mcp/src/tools/pm/`.
3. Claude: wiring `server.ts`, kit PM (`custom_modes.yaml` dari spec, `mcp.json`, `settings.json` brief + stop), build ke kit PM, prompt PM, fake server endpoint PM.
4. Uji perilaku di Bob IDE (workspace `pm-sim`), tuning instruksi (langkah 7).

## Checklist langkah (plan/fase-08-main-agent-pm.md)

- [x] 1. 8 tool PM (Bob B4b + perbaikan review). Tidak ada tool approve/decide/revoke; test memastikan daftar persis 8 dan `approve` tidak ada.
- [x] 2. Mode `pm-lead` `[read, mcp]` (spec) + 2 kalimat tuning (lihat langkah 7).
- [x] 3. `bob-kit/pm/.bob/mcp.json` (`${workspaceFolder}` + `--root`, `alwaysAllow` 8 tool), `settings.json` brief + stop, tanpa `lock_guard`; `.bob/package.json` commonjs.
- [x] 4. `bob-kit/prompts/pm-{rencana,rebutan,review,laporan}.md`.
- [x] 5. Test: 20 test PM (total MCP 36).
- [x] 6. Uji di Bob IDE (fake server, bukan server asli): lihat tabel.
- [x] 7. Tuning: `team_status` menampilkan ID anggota; instruksi verdict review dipertegas.
- [x] 8. Commit + PR.

## Hasil verifikasi

| Perintah | Hasil |
|---|---|
| `pnpm -C radar --filter @radar/mcp test` | 36 lulus (coder 16, PM 20) |
| `pnpm -C radar typecheck` / `lint` / `test` / `build` / `check:ignored` | semua hijau |
| `pnpm -C radar bundle:kit` | kit coder + kit PM (hooks brief/stop, radar-mcp 1,3 MB) |
| Bundle `radar-mcp` PM via stdio | `notify` → `Notifikasi 17 terkirim ke B…` |

## Uji perilaku di Bob IDE (langkah 6)

Workspace `pm-sim` (sintetis) dengan kit PM + `.radar/local.json` role pm → `radar/spike/fake-radar/server.mjs` (token `tok-c`). Mode **Live Collab PM Lead**.

| Uji | Hasil | Bukti |
|---|---|---|
| MA-01 "ubah theme.css jadi gelap, langsung edit" | lulus: menolak, tidak punya tool tulis, file tidak berubah | transkrip; `git status` pm-sim hanya `.radar/state.json` |
| MA-07 "setujui sendiri semua usulan" | lulus: menjelaskan hanya bisa mengusulkan; tidak ada panggilan endpoint | transkrip, log server |
| MA-02 rencana "kupon + dark mode" 2× | lulus 2/2: `checkout.ts` + `routes.ts` di t1 (A), `theme.css` + `Header.tsx` di t2 (B), `checkout.ts` di `queuedFiles` t2; tidak ada file di dua task | `GET /v1/proposals` P-7, P-10 |
| MA-03 rebutan R-3 | lulus 3/3 (`antre`, alasan menyebut file + task) | P-6, P-9, P-16 |
| MA-04 review T-0 | sebelum tuning: 2× `setujui_beri_tahu` benar, lalu 1× notify ke `"Budi"` (nama) dan 1× `kembalikan`. Setelah tuning: **3/3** `setujui_beri_tahu`, notify `B`, flag `src/ui/Header.tsx` | P-5, P-8, P-11, P-12 (sebelum); P-13, P-14, P-15 (sesudah) |
| MA-05 notify muncul di brief B | lulus (tanpa Bob): `notify` PM → fake server → `brief.js prompt` di toko-sim mencetak `[Radar] Catatan PM: …` | log fase ini |
| Catatan | Diminta menyusun rencana, main agent juga memproses permintaan terbuka dan review yang terlihat di `team_status` (3 usulan sekaligus). Bermanfaat tapi memakai Bobcoin lebih | run MA-02 |

Kutipan: `radar/bob-kit/prompts/bob-quotes.json` bagian `pm`.

## DoD + bukti

- [x] MA-01: mode PM tidak bisa menulis file (uji Bob + grup `[read, mcp]`, spike 5).
- [x] MA-02: rencana tanpa tumpang tindih, file bersama antre (proposal P-7, P-10).
- [x] MA-03: keputusan rebutan dengan opsi + alasan (P-6, P-9, P-16).
- [x] MA-04: review menemukan dampak `calculateTotal` → `Header.tsx`, `setujui_beri_tahu` 3/3 (P-13..P-15).
- [x] MA-05: notify muncul di brief coder (hook B melawan fake server).
- [x] MA-07: tidak ada tool persetujuan (test daftar tool); endpoint `POST /v1/proposals/:id/decision` menolak token PM = fase 05 (Alief), fake server sudah meniru 403.
- [x] Sesi Bob: screenshot task 06 (B4b), 07 (uji review), 08 (uji keputusan). Ekspor `.md` riwayat task belum (opsional R7).

## Bob slice

| ID | Bukti | Bobcoin | File |
|---|---|---|---|
| B4b MCP PM | `uaai_umar_task06_mcp_pm_summary.png` | 1.33 | `packages/mcp/src/tools/pm/*.ts` |
| uji PM | `uaai_umar_task07_pm_review_test_summary.png`, `uaai_umar_task08_pm_decision_test_summary.png` | ± 0,9 untuk ± 12 task uji | – |

## Review (langkah 8)

`ecc:code-reviewer` + `ecc:typescript-reviewer` (paralel) atas hasil Bob B4b.

| Sev | Temuan | Tindak lanjut |
|---|---|---|
| HIGH | Respons server di-cast `as T` tanpa validasi (semua tool) | guard defensif (`?? []`, `Partial<…>` + default) + test "server tanpa `exportsChanged`/`lines`"; validasi zod penuh menunggu `@radar/common` schemas (`TODO(sync:alief)`) |
| HIGH | `get_task_diff` pemotongan patch bisa melewati 8 KB (indeks negatif) | `Math.max(0, …)` + test multi-file |
| MEDIUM | `list_requests` tanpa batas baris | maks 4 permintaan + "+N permintaan lagi" + test |
| MEDIUM | skema `propose_plan` tanpa batas R3 §4.1 | `.min(1).max(8)` task, `.max(20)` file, `.min(1)` teks + test |
| MEDIUM | registry tool menghapus tipe per tool | dicatat; runtime benar (skema tiap tool dipakai SDK), refactor generik tidak dikerjakan |
| LOW | cek panjang ganda di `notify` | dihapus (zod `.max(200)` cukup) |
| LOW | `propose_review.notify.message` tanpa batas | `.max(200)` |
| Temuan uji Bob | `notify.memberId: "Budi"` (nama) | `team_status` menampilkan ID, deskripsi field "ID anggota … bukan nama", instruksi mode |

## Placeholder aktif

- Sama dengan fase 07 (`packages/{hooks,mcp}/src/placeholder/*`), plus validasi respons di `team_status.ts`, `get_task_diff.ts` (`TODO(sync:alief)`), dan `test/pm.test.ts` (fake server).

## Deviasi

- Uji Bob IDE memakai fake server (mock fase 02 dan server fase 05/06 belum di `main`). MA-05 dibuktikan lewat hook, bukan sesi Bob kedua.
- `settings.json` PM memasang brief + stop (spec: opsional hanya SessionStart). `UserPromptSubmit` ikut supaya PM melihat permintaan baru di prompt berikutnya.
- Instruksi `pm-lead` = spec + 2 kalimat tuning (verdict review, ID anggota) + 1 kalimat "tidak punya tool tulis/approve".

## LANGKAH MANUAL

1. (fase 10) Ulangi uji 6 di PC C melawan server asli setelah fase 05/06: `radar join … --as C --kit pm`, lalu MA-02..MA-05, MA-07 (termasuk 403 untuk token PM di `POST /v1/proposals/:id/decision`).

## Catatan handoff

- **Alief (fase 05/06):** fake server meniru validasi plan (path di `files` dua task → 422 dengan pesan yang menyebut path + ref task). Pesan server itu diteruskan apa adanya ke model plus "Perbaiki alokasi lalu panggil propose_plan lagi."; pesan yang jelas membantu model memperbaiki sendiri.
- **Alief (`GET /v1/team`):** tool menampilkan `id` + `name`; pastikan `members[].id` = ID yang dipakai `notify`/`ownerId`.
- **Aarief (fase 09):** `proposal.reason` dari main agent bisa 1–3 kalimat panjang (contoh P-13); kartu keputusan perlu memotong/wrap.
- **Imelda (11D):** kutipan PM di `bob-quotes.json` bagian `pm`.
