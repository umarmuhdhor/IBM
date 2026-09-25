# Progress — IBM Bob Live Collab

Legenda status: `[ ]` belum · `[~]` sedang dikerjakan / menunggu langkah manual · `[x]` selesai · `[!]` terblokir
Waktu dalam WITA. Setiap lane **hanya mengedit baris fasenya sendiri** (supaya merge tidak bentrok).

| Fase | Judul | Lane | Branch | Status | Mulai | Selesai | Ringkasan satu kalimat | Log |
|---|---|---|---|---|---|---|---|---|
| 00 | Fondasi: fork Orca + `radar/` | Alief | main | [~] | Jum 25 17:20 | | Workspace `radar/` 7 paket hijau, template IBM, CI; menunggu Bob slice A1 (toko-demo) + langkah manual | log/fase-00.md |
| 01 | Spike & GATE 1 | Umar | lane/bob | [x] | Sab 26 00:10 | Sab 26 00:40 | GATE 1: hook+server, sync watch (p95 212 ms satu Mac), stderr exit 2 sampai ke model; uji 4 dua Mac menunggu Alief (D4) | log/fase-01.md |
| 02 | Common + mock (kontrak beku) | Alief | lane/core | [ ] | | | | log/fase-02.md |
| 03 | Server inti | Alief | lane/core | [ ] | | | | log/fase-03.md |
| 04 | Sync agent | Alief | lane/core | [ ] | | | | log/fase-04.md |
| 05 | Kunci, task, permintaan, proposal | Alief | lane/core | [ ] | | | | log/fase-05.md |
| 06 | Commit GitHub, diff (relay terminal P1) | Alief | lane/core | [ ] | | | | log/fase-06.md |
| 07 | Kit `.bob/` coder | Umar | lane/bob | [ ] | | | | log/fase-07.md |
| 08 | Main agent `pm-lead` | Umar | lane/bob | [ ] | | | | log/fase-08.md |
| 09 | App desktop (Orca di `app/`) + `@radar/ui` | Aarief | lane/app | [ ] | | | | log/fase-09.md |
| 10 | Integrasi E2E | Semua | lane masing-masing | [ ] | | | | log/fase-10.md |
| 11a | Tonton Bob rekan (A) + script bukti C4 (E) | Aarief | lane/app | [ ] | | | | log/fase-11a.md |
| 11b | `.dmg` + Release (C) | Aarief | lane/app | [ ] | | | | log/fase-11b.md |
| 11c | Uji pasang Mac teman, P1, poles | Aarief | lane/app | [ ] | | | | log/fase-11c.md |
| 11D1 | Landing + replay dengan fixture (I1, I2) | Imelda | lane/web | [ ] | | | | log/fase-11D1.md |
| 11D2 | I3 Long Description + replay final dari rekaman | Imelda | lane/web | [ ] | | | | log/fase-11D2.md |
| 12 | Hardening & P1 | Alief | lane/core | [ ] | | | | log/fase-12.md |
| 13 | Eksperimen A/B | Umar | lane/bob | [ ] | | | | log/fase-13.md |
| 14 | Submission | Semua | lane masing-masing | [ ] | | | | log/fase-14.md |

## Gate & milestone

| Titik | Target | Status | Catatan |
|---|---|---|---|
| Kontrak beku (PR fase 02 merge) | Sab 26 Sep 02:30 | [ ] | Semua lane sinkron (PROMPT langkah 13) dan ganti `TODO(sync:alief)` |
| Jendela kontrak hasil spike | Sab 26 Sep 04:00–04:30 | [ ] | Hanya field hook, `BobActivityReq`, `EDIT_TOOLS_REGEX` (PR `fase-02b`) |
| GATE 1 — hasil spike | Sab 26 Sep 04:00 | [x] | D-umar-01: `ENFORCEMENT = hook+server`, `SYNC = watch`, fixture di `radar/docs/spike-payloads/`; build app (uji 13) di lane App |
| Sinkron 1 — semua lane punya PR ter-merge | Sab 26 Sep 16:00 | [ ] | App konek ke server staging |
| Fase 10 mulai (interupsi wajib) | Sab 26 Sep 21:00 | [ ] | PR keempat lane ter-merge ≤ 21:00 |
| Milestone — alur penuh di 4 Mac | Sab 26 Sep 23:00 | [ ] | rencana → live → blokir → keputusan + tonton Bob rekan; PC D ikut |
| GATE 2 — feature freeze | Min 27 Sep 11:00 | [ ] | Setelah ini hanya bugfix, dokumen, video |
| Rekaman final (gladi + 2 take) | Min 27 Sep 11:00–14:00 | [ ] | Setelah freeze; server & toko-demo di-reset |
| Submit | Min 27 Sep 19:00–21:00 | [ ] | Batas lablab 23:00 WITA |

## Status requirement P0

| ID | Fase | Status | Bukti (test / log) |
|---|---|---|---|
| SY-01..05 | 04 (+05 untuk SY-04) | [ ] | |
| SV-01, SV-08 | 03 | [ ] | |
| SV-02..06 | 05 | [ ] | |
| SV-07 | 06 | [ ] | |
| BC-01..04, BC-07 | 07 | [ ] | |
| MA-01..05, MA-07 | 08 (+05, 06) | [ ] | |
| UI-01..04, UI-07 | 09 | [ ] | |
| UI-05 | 11D1 | [ ] | |
| DA-01 | 11b/11c | [ ] | |
| DA-03, DA-04, DA-06 | 09 | [ ] | |
| JT-01 (hook + `bob/activity`) | 03 + 07 | [ ] | |
| JT-02, JT-03 (Watch Bob, privasi prompt) | 11a (+07 `shareprompts`) | [ ] | |
| UI-09 (landing web) | 11D1 | [ ] | |
| IN-01 | 04 + 11 | [ ] | |
| EV-01..03 | semua (dicek 14) | [ ] | |
| NFR-11 (template IBM, check:ignored) | 00 | [ ] | |

## Bob slice (R7)

| ID | Lane | Pemilik | Folder `bob_sessions/…` | Status | Bobcoin |
|---|---|---|---|---|---|
| A1 toko-demo | Core | Alief | | [ ] | |
| A2 checkWrite | Core | Alief | | [ ] | |
| A3 commit GitHub API | Core | Alief | | [ ] | |
| A4 review locks | Core | Alief | | [ ] | |
| B1 spike hooks | Bob | Umar | `uaai_umar_task01_spike_hooks_summary.png` | [x] | 0.345 |
| B2 coder mode | Bob | Umar | | [ ] | |
| B3 hooks | Bob | Umar | | [ ] | |
| B4a MCP coder | Bob | Umar | | [ ] | |
| B4b MCP PM | Bob | Umar | | [ ] | |
| C1 onboarding Orca | App | Aarief | | [ ] | |
| C2 agent bob | App | Aarief | | [ ] | |
| C4 `--md` + `evidence-check` | App | Aarief | | [ ] | |
| C3 komponen `@radar/ui` | App | Aarief | | [ ] | |
| I1 pemutar replay + `/demo` | Web | Imelda | | [ ] | |
| I2 landing | Web | Imelda | | [ ] | |
| I3 Long Description + outline deck | Web | Imelda | | [ ] | |
