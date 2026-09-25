# Progress — IBM Bob Live Collab

Legenda status: `[ ]` belum · `[~]` sedang dikerjakan / menunggu langkah manual · `[x]` selesai · `[!]` terblokir
Waktu dalam WITA. Setiap lane **hanya mengedit baris fasenya sendiri** (supaya merge tidak bentrok).

| Fase | Judul | Lane | Branch | Status | Mulai | Selesai | Ringkasan satu kalimat | Log |
|---|---|---|---|---|---|---|---|---|
| 00 | Fondasi: fork Orca + `radar/` | A | main | [ ] | | | | log/fase-00.md |
| 01 | Spike & GATE 1 | B | lane/bob | [ ] | | | | log/fase-01.md |
| 02 | Common + mock (kontrak beku) | A | main | [ ] | | | | log/fase-02.md |
| 03 | Server inti | A | lane/core | [ ] | | | | log/fase-03.md |
| 04 | Sync agent | A | lane/core | [ ] | | | | log/fase-04.md |
| 05 | Kunci, task, permintaan, proposal | A | lane/core | [ ] | | | | log/fase-05.md |
| 06 | Git, diff, relay terminal | A | lane/core | [ ] | | | | log/fase-06.md |
| 07 | Kit `.bob/` coder | B | lane/bob | [ ] | | | | log/fase-07.md |
| 08 | Main agent `pm-lead` | B | lane/bob | [ ] | | | | log/fase-08.md |
| 09 | App desktop (fork Orca) | C | lane/app | [ ] | | | | log/fase-09.md |
| 10 | Integrasi E2E | Semua | main | [ ] | | | | log/fase-10.md |
| 11 | Tonton terminal, `.dmg`, replay | C | lane/app | [ ] | | | | log/fase-11.md |
| 12 | Hardening & P1 | A | lane/core | [ ] | | | | log/fase-12.md |
| 13 | Eksperimen A/B | B | lane/bob | [ ] | | | | log/fase-13.md |
| 14 | Submission | Semua | main | [ ] | | | | log/fase-14.md |

## Gate & milestone

| Titik | Target | Status | Catatan |
|---|---|---|---|
| Kontrak beku (fase 02 merge) | Sab 26 Sep 02:30 | [ ] | Lane B/C rebase setelah ini |
| GATE 1 — hasil spike | Sab 26 Sep 04:00 | [ ] | Penegakan IDE vs Shell, sinkron, Bob di terminal Orca, build app |
| Sinkron 1 — semua lane ke main | Sab 26 Sep 16:00 | [ ] | App konek ke server staging |
| Milestone — alur penuh di 3 Mac | Sab 26 Sep 23:00 | [ ] | rencana → live → blokir → keputusan + tonton terminal |
| GATE 2 — feature freeze | Min 27 Sep 11:00 | [ ] | Setelah ini hanya bugfix, dokumen, video |
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
| UI-05 | 11 | [ ] | |
| DA-01 | 11 | [ ] | |
| DA-02, DA-03, DA-04, DA-06 | 09 | [ ] | |
| JT-01, JT-02 | 11 | [ ] | |
| JT-03, JT-05 | 06 (+11) | [ ] | |
| IN-01 | 04 + 11 | [ ] | |
| EV-01..03 | semua (dicek 14) | [ ] | |
| NFR-11 (template IBM, check:ignored) | 00 | [ ] | |

## Bob slice (R7)

| ID | Lane | Pemilik | Folder `bob_sessions/…` | Status | Bobcoin |
|---|---|---|---|---|---|
| A1 toko-demo | A | | | [ ] | |
| A2 checkWrite | A | | | [ ] | |
| A3 commit format | A | | | [ ] | |
| A4 review locks | A | | | [ ] | |
| B1 spike hooks | B | | | [ ] | |
| B2 coder mode | B | | | [ ] | |
| B3 hooks | B | | | [ ] | |
| B4a MCP coder | B | | | [ ] | |
| B4b MCP PM | B | | | [ ] | |
| C1 onboarding Orca | C | Aarief | | [ ] | |
| C2 agent bob | C | Aarief | | [ ] | |
| C3 komponen UI | C | Aarief | | [ ] | |
| C4 script bukti | C | Aarief | | [ ] | |
