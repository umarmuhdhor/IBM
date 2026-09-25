# Progress — IBM Bob Live Collab

Legenda status: `[ ]` belum · `[~]` sedang dikerjakan / menunggu langkah manual · `[x]` selesai · `[!]` terblokir
Waktu dalam WITA. Setiap lane **hanya mengedit baris fasenya sendiri** (supaya merge tidak bentrok).

| Fase | Judul | Lane | Branch | Status | Mulai | Selesai | Ringkasan satu kalimat | Log |
|---|---|---|---|---|---|---|---|---|
| 00 | Fondasi: fork Orca + `radar/` | Alief | main | [ ] | | | | log/fase-00.md |
| 01 | Spike & GATE 1 | Umar | lane/bob | [ ] | | | | log/fase-01.md |
| 02 | Common + mock (kontrak beku) | Alief | main | [ ] | | | | log/fase-02.md |
| 03 | Server inti | Alief | lane/core | [ ] | | | | log/fase-03.md |
| 04 | Sync agent | Alief | lane/core | [ ] | | | | log/fase-04.md |
| 05 | Kunci, task, permintaan, proposal | Alief | lane/core | [ ] | | | | log/fase-05.md |
| 06 | Git, diff, relay terminal | Alief | lane/core | [ ] | | | | log/fase-06.md |
| 07 | Kit `.bob/` coder | Umar | lane/bob | [ ] | | | | log/fase-07.md |
| 08 | Main agent `pm-lead` | Umar | lane/bob | [ ] | | | | log/fase-08.md |
| 09 | App desktop (Orca di `app/`) + `@radar/ui` | Aarief | lane/app | [ ] | | | | log/fase-09.md |
| 10 | Integrasi E2E | Semua | main | [ ] | | | | log/fase-10.md |
| 11 | Tonton terminal + `.dmg` (Aarief) · landing + replay (Imelda) | Aarief + Imelda | lane/app, lane/web | [ ] | | | | log/fase-11.md |
| 12 | Hardening & P1 | Alief | lane/core | [ ] | | | | log/fase-12.md |
| 13 | Eksperimen A/B | Umar | lane/bob | [ ] | | | | log/fase-13.md |
| 14 | Submission | Semua | main | [ ] | | | | log/fase-14.md |

## Gate & milestone

| Titik | Target | Status | Catatan |
|---|---|---|---|
| Kontrak beku (fase 02 merge) | Sab 26 Sep 02:30 | [ ] | Lane Umar dan Lane Aarief/Imelda rebase setelah ini |
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
| A1 toko-demo | Core | Alief | | [ ] | |
| A2 checkWrite | Core | Alief | | [ ] | |
| A3 commit GitHub API | Core | Alief | | [ ] | |
| A4 review locks | Core | Alief | | [ ] | |
| B1 spike hooks | Bob | Umar | | [ ] | |
| B2 coder mode | Bob | Umar | | [ ] | |
| B3 hooks | Bob | Umar | | [ ] | |
| B4a MCP coder | Bob | Umar | | [ ] | |
| B4b MCP PM | Bob | Umar | | [ ] | |
| C1 onboarding Orca | App | Aarief | | [ ] | |
| C2 agent bob | App | Aarief | | [ ] | |
| C4 script bukti | App | Aarief | | [ ] | |
| C3 komponen `@radar/ui` | App | Aarief | | [ ] | |
| I1 pemutar replay + `/demo` | App | Imelda | | [ ] | |
| I2 landing | App | Imelda | | [ ] | |
| I3 Long Description + outline deck | App | Imelda | | [ ] | |
