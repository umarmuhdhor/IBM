# Progress — IBM Bob Live Collab

Legenda status: `[ ]` belum · `[~]` sedang dikerjakan / menunggu langkah manual · `[x]` selesai · `[!]` terblokir
Waktu dalam WITA. Setiap lane **hanya mengedit baris fasenya sendiri** (supaya merge tidak bentrok).

| Fase | Judul | Lane | Branch | Status | Mulai | Selesai | Ringkasan satu kalimat | Log |
|---|---|---|---|---|---|---|---|---|
| 00 | Fondasi: fork Orca + `radar/` | Alief | main | [x] | Jum 25 17:20 | Sab 26 01:05 | Workspace `radar/` 7 paket hijau, template IBM, CI, toko-demo oleh Bob (A1), 4 branch lane; sisa langkah manual di log | log/fase-00.md |
| 01 | Spike & GATE 1 | Umar | lane/bob | [x] | Sab 26 00:10 | Sab 26 00:40 | GATE 1: hook+server, sync watch (p95 212 ms satu Mac), stderr exit 2 sampai ke model; uji 4 dua Mac menunggu Alief (D4) | log/fase-01.md |
| 02 | Common + mock (kontrak beku) | Alief | lane/core | [x] | Sab 26 03:30 | Sab 26 04:15 | `@radar/common` (zod R3, reducer murni, selector, normalizer hook nyata, subpath `/node`), mock server semua route R3 + WS; 105 test; ref R1/R3/R5 diperbarui (D-alief-02) | log/fase-02.md |
| 03 | Server inti | Alief | lane/core | [x] | Sab 26 04:20 | Sab 26 09:05 | Worker + DO SQLite (auth, event log, file versi, hub WS hibernasi, alarm, admin API + CLI), 52 test server + 14 CLI, uji `wrangler dev` lokal; deploy `live-collab.afindo-mi01.workers.dev` Sab 26 12:40 | log/fase-03.md |
| 04 | Sync agent | Alief | lane/core | [x] | Sab 26 09:15 | Sab 26 13:20 | CLI `radar` (join/start/status/kit), WS + snapshot + watcher (rescan 2 s), sidecar konflik, `--json-status`, `radar-cli.tgz`; 43 test, bench p95 159 ms lokal / 295 ms Cloudflare | log/fase-04.md |
| 05 | Kunci, task, permintaan, proposal | Alief | lane/core | [x] | Sab 26 13:20 | Sab 26 14:30 | Mesin kunci R4 (`checkWrite` oleh Bob A2, antrean, transfer, revoke), task/permintaan/usulan/brief/team REST, commit dua transaksi (stub sampai 06); 110 test server incl. property I1–I10 300×60 + alur demo 9 langkah | log/fase-05.md |
| 06 | Commit GitHub, diff (relay terminal P1) | Alief | lane/core | [x] | Sab 26 14:30 | Sab 26 18:00 | Commit `c0576499` ter-push (author + 4 trailer, fast-forward); 138 test hijau; P1 relay → fase 12 | log/fase-06.md |
| 07 | Kit `.bob/` coder | Umar | lane/bob | [x] | Sab 26 00:45 | Sab 26 01:10 | Kit coder (5 hook, radar-mcp 5 tool, mode + rules), 57 test hijau, uji Bob IDE jalur blokir 3/3 melawan fake server; uji di toko-demo asli = fase 10 | log/fase-07.md |
| 08 | Main agent `pm-lead` | Umar | lane/bob | [x] | Sab 26 01:12 | Sab 26 01:30 | 8 tool PM (tanpa approve), kit PM, uji Bob IDE MA-01/02/03/04 (3/3)/05/07 melawan fake server; uji server asli = fase 10 | log/fase-08.md |
| 09 | App desktop (Orca di `app/`) + `@radar/ui` | Aarief | lane/app | [x] | Sab 26 00:12 | Sab 26 11:30 | Agent IBM Bob di Orca (C2, DA-02), koneksi aman di main + WS/Approve live lulus melawan mock, panel Live Collab + `@radar/ui` (C3), gerbang UI + security PASS; uji server asli = fase 10 | log/fase-09.md |
| 10 | Integrasi E2E | Semua | lane masing-masing | [ ] | | | | log/fase-10.md |
| 11a | Tonton Bob rekan (A) + script bukti C4 (E) | Aarief | lane/app | [~] | Sab 26 <12:00 | | Kode dan Bob slice C4 selesai; 35/35 test, typecheck lulus. Menunggu uji 2 laptop dan p95 < 1 s; wiring `evidence:check` di luar folder Aarief. | log/fase-11a.md |
| 11b | `.dmg` + Release (C) | Aarief | lane/app | [ ] | | | | log/fase-11b.md |
| 11c | Uji pasang Mac teman, P1, poles | Aarief | lane/app | [ ] | | | | log/fase-11c.md |
| 11D1 | Landing + replay dengan fixture (I1, I2) | Imelda | lane/web | [~] | Sab 26 13:10 | | I1/I2 + e2e 12/12 hijau (1440/390, trailingSlash); BERHENTI di LANGKAH MANUAL deploy Cloudflare Pages (TODO B2) + squash-merge PR #14 | log/fase-11D1.md |
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
| SV-02..06 | 05 | [x] | `test/engine.test.ts`, `test/invariants.prop.test.ts`, `test/flow.int.test.ts`, `locks.test.ts` (log fase 05); uji produksi fase 10 |
| SV-07 | 06 | [x] | commit `c0576499` di toko-demo (author coder + 4 trailer, 1 file, fast-forward) + `radar/docs/img/commit-github.png`; `test/github.test.ts`, `services/diff.test.ts` |
| BC-01..04, BC-07 | 07 | [x] | hooks 41 + mcp 16 test; Bob IDE vs fake server (log fase 07); fase 10: Bob IDE vs Worker asli di toko-demo (blokir hook + `why_blocked`, `request_file`) + `mcp/test/server.int.test.ts` (log fase-10-bob, task 10–11) |
| MA-01..05, MA-07 | 08 (+05, 06) | [x] | fase 10 vs Worker asli: test integrasi (`mcp/test/server.int.test.ts`: plan, antre otomatis, notify → brief, `get_task_diff` + importer, review, token PM 403) + Bob IDE task 09, 12–15 (log fase-10-bob) |
| UI-01..04, UI-07 | 09 | [ ] | |
| UI-05 | 11D1 | [x] | `/demo` tanpa login/API key/server; e2e 12/12 (`demo.spec.ts` 1440+390) vs static `out/` |
| DA-01 | 11b/11c | [ ] | |
| DA-03, DA-04, DA-06 | 09 | [ ] | |
| JT-01 (hook + `bob/activity`) | 03 + 07 | [~] | sisi Bob: hook → `POST /v1/bob/activity` 204 di Worker asli (`server.int.test.ts`, log wrangler sesi Bob IDE fase 10); tampilan Watch Bob = 11a |
| JT-02, JT-03 (Watch Bob, privasi prompt) | 11a (+07 `shareprompts`) | [ ] | |
| UI-09 (landing web) | 11D1 | [~] | Kode + build statis siap (log fase 11D1); belum live di Cloudflare Pages (LANGKAH MANUAL, TODO B2) |
| IN-01 | 04 + 11 | [ ] | |
| EV-01..03 | semua (dicek 14) | [ ] | |
| NFR-11 (template IBM, check:ignored) | 00 | [x] | `check:ignored` di CI |

## Bob slice (R7)

| ID | Lane | Pemilik | Folder `bob_sessions/…` | Status | Bobcoin |
|---|---|---|---|---|---|
| A1 toko-demo | Core | Alief | `uaai_alief_task01_toko_demo_summary.png` | [x] | 1.80 |
| A2 checkWrite | Core | Alief | `uaai_alief_task02_check_write_summary.png` | [x] | 5.28 |
| A3 commit GitHub API | Core | Alief | | [ ] | |
| A4 review locks | Core | Alief | | [ ] | |
| B1 spike hooks | Bob | Umar | `uaai_umar_task01_spike_hooks_summary.png` | [x] | 0.345 |
| B2 coder mode | Bob | Umar | `uaai_umar_task02_coder_mode_summary.png` | [x] | 0.354 |
| B3 hooks | Bob | Umar | `uaai_umar_task03_hooks_summary.png` | [x] | 0.914 |
| B4a MCP coder | Bob | Umar | `uaai_umar_task04_mcp_coder_summary.png` | [x] | 1.13 |
| B4b MCP PM | Bob | Umar | `uaai_umar_task06_mcp_pm_summary.png` | [x] | 1.33 |
| C1 onboarding Orca | App | Aarief | | [ ] | |
| C2 agent bob | App | Aarief | | [ ] | |
| C4 `--md` + `evidence-check` | App | Aarief | | [ ] | |
| C3 komponen `@radar/ui` | App | Aarief | | [ ] | |
| I1 pemutar replay + `/demo` | Web | Imelda | `uaai_imelda_task01_replay_player_demo_summary.png` | [x] | 4.30 |
| I2 landing | Web | Imelda | `uaai_imelda_task02_landing_warm_paper_summary.png` | [x] | 0.873 |
| I3 Long Description + outline deck | Web | Imelda | | [ ] | |
