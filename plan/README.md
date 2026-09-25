# Plan detail per fase — IBM Bob Live Collab (v0.3)

> Rencana kerja teknis dari nol sampai submit di IBM Bob 2.0 Hackathon (Jum 25 Sep 23:00 → Min 27 Sep 23:00 WITA).
> Ringkasan tim (lane, branch, jadwal, ECC, bukti Bob) ada di [`../PLAN.md`](../PLAN.md). Produk: [`../PRD.md`](../PRD.md). Desain: [`../DESIGN.md`](../DESIGN.md).
> Codename teknis `radar` tetap dipakai di kode (CLI `radar`, paket `@radar/*`, `radar-mcp`, folder `radar/`). Nama produk: **IBM Bob Live Collab**.

---

## 1. Cara pakai

1. Buka [`PROMPT.md`](PROMPT.md) dan salin blok prompt.
2. Ubah dua baris: `LANE: Alief|Umar|Aarief|Imelda` dan `FASE: NN`.
3. Tempel ke Claude Code (dengan plugin ECC) di root repo. Pilih model sesuai §3.
4. Kalau agent berhenti di **BOB SLICE**, kerjakan prompt itu di Bob IDE, jalankan `bob-evidence.sh`, lalu balas "bob selesai".

Agent mengisi `PROGRESS.md` dan `log/fase-XX.md`, commit, push branch lane, lalu berhenti dan menyebut fase berikutnya. Kalau terputus, jalankan prompt yang sama: agent melanjutkan dari checklist.

---

## 2. Struktur folder

```text
plan/                         (dipindah ke plan/ di fase 00)
├── README.md                 ← file ini
├── PROMPT.md                 ← satu prompt (ubah LANE + FASE)
├── PROGRESS.md               ← status fase + requirement P0
├── ref/                      ← kontrak bersama
│   ├── R1-struktur-repo.md   ← layout fork Orca + workspace radar/
│   ├── R2-skema-db.md        ← SQL SQLite + invariant
│   ├── R3-kontrak-api.md     ← REST, WebSocket (termasuk term.* §3.9), event, MCP
│   ├── R4-mesin-kunci.md     ← state machine kunci & task
│   ├── R5-konvensi.md        ← gaya kode, test, env, warna, larangan nama file (§8)
│   ├── R6-model-ai.md        ← model + agent/skill ECC per fase
│   └── R7-bukti-bob.md       ← protokol bukti IBM Bob (screenshot + ekspor + trailer)
├── fase-00 … fase-14
└── log/
    ├── DECISIONS.md          ← keputusan (ID ber-prefix lane: D-alief-.., D-umar-.., D-app-..)
    └── fase-XX.md            ← laporan per fase
```

---

## 3. Peta fase

| No | Fase | Lane | Branch | Output utama | Requirement PRD | Slot WITA | Model |
|---|---|---|---|---|---|---|---|
| 00 | Fondasi: fork Orca + `radar/` | Alief | `main` | fork, workspace `radar/`, template IBM, toko-demo, CI, ECC | §12, NFR-04/07/10/11 | Jum 23:00–Sab 00:30 | Sonnet 5 |
| 01 | Spike & GATE 1 | Umar | `lane/bob` | `spike/`, `docs/SPIKE_RESULTS.md` | §17 spike 1–8 | Sab 00:30–04:00 | Sonnet 5 |
| 02 | Common + mock server | Alief | `lane/core` → PR | tipe, zod, reducer, mock (termasuk `bob.activity`; `term.*` P1) = **kontrak beku** | BC-04, UI-04/05, JT-01/02 | Sab 00:30–02:30 (+ jendela 04:00–04:30) | Sonnet 5 |
| 03 | Server inti | Alief | `lane/core` | Worker + Durable Object + SQLite DO + auth + WS + deploy | SV-01, SV-08, JT-01 (`bob/activity`) | Sab 02:30–06:30 | Opus 5.5 |
| 04 | Sync agent | Alief | `lane/core` | CLI `radar`, watcher, anti-gema | SY-01..05 | Sab 06:30–09:00 | Opus 5.5 |
| 05 | Kunci, task, permintaan, proposal | Alief | `lane/core` | `/v1/locks/check`, alokasi, antrean | SV-02..06, MA-07 | Sab 14:00–17:30 | Opus 5.5 |
| 06 | Commit GitHub + diff (relay terminal P1) | Alief | `lane/core` | commit per task via Git Data API, `get_task_diff` | SV-07, MA-04 (JT-04 P1) | Sab 17:30–21:00 | Opus 5.5 |
| 07 | Kit `.bob/` coder | Umar | `lane/bob` | mode `coder`, hook, `radar-mcp` coder | BC-01..04, BC-07 | Sab 09:00–16:00 | Sonnet 5 · high |
| 08 | Main agent `pm-lead` | Umar | `lane/bob` | mode `pm-lead`, tool PM | MA-01..05 | Sab 16:00–21:00 | Sonnet 5 · high |
| 09 | App desktop (Orca di `app/`) + `@radar/ui` | Aarief | `lane/app` | agent `bob`, panel Live Collab, `@radar/ui` | DA-01..04, UI-01..04, UI-07 | Sab 00:30–16:00 | Sonnet 5 · high |
| 10 | Integrasi E2E | Semua | lane masing-masing → PR kecil | `sim-3pc`, uji 3 Mac, **milestone Sab 23:00** | semua P0 | Sab 21:00–Min 02:00 | Opus 5.5 |
| 11 | Tonton Bob rekan + `.dmg` (Aarief) · landing + replay web (Imelda) | Aarief + Imelda | `lane/app`, `lane/web` | Watch Bob (JT-01..03), `.dmg`, `/demo` | JT-01..03 (JT-04/05 P1/P2), DA-01, UI-05 | Aarief Sab 16:00–Min 11:00 · Imelda mulai setelah fase 00 | Sonnet 5 · high |
| 12 | Hardening & P1 | Alief | `lane/core` | kedaluwarsa, reconnect, invite | SV-09/10, SY-06/07, IN-02 | Min 04:00–11:00 | Sonnet 5 |
| 13 | Eksperimen A/B | Umar | `lane/bob` | `docs/EXPERIMENT.md` | §04, §17 | Min 04:30–11:00 | Sonnet 5 |
| 14 | Submission | Semua | lane masing-masing → PR | statement, video ≤ 3 menit, deck, bukti Bob | §15, EV-01..03, NFR-11 | Min 11:00–23:00 | Sonnet 5 |

**GATE 1** Sab 04:00 · **Kontrak beku** Sab 02:30 (PR fase 02 merge; jendela hasil spike 04:00–04:30) · **Sinkron 1** Sab 16:00 · **Milestone** Sab 23:00 · **GATE 2 / freeze** Min 11:00.

---

## 4. Grafik dependensi

```mermaid
flowchart LR
  F00[00 Fondasi · main] --> F01[01 Spike · Umar]
  F00 --> F02[02 Kontrak + mock · Alief]
  F01 -. fixture hook .-> F02
  F02 --> F03[03 Server · Alief]
  F03 --> F04[04 Sync · Alief]
  F03 --> F05[05 Kunci · Alief]
  F05 --> F06[06 Commit GitHub + diff · Alief]
  F01 --> F07[07 Kit coder · Umar]
  F02 -. mock .-> F07
  F07 --> F08[08 PM agent · Umar]
  F00 --> F09[09 App desktop · Aarief]
  F02 -. mock .-> F09
  F09 --> F11A[11 Watch Bob + dmg · Aarief]
  F03 -. bob.activity .-> F11A
  F00 --> F11D[11D Landing + replay · Imelda]
  F02 -. fixture .-> F11D
  F04 --> F10[10 E2E · semua]
  F06 --> F10
  F08 --> F10
  F09 --> F10
  F10 --> F12[12 Hardening · Alief]
  F10 --> F13[13 Eksperimen · Umar]
  F11A --> F14[14 Submission]
  F11D --> F14
  F12 --> F14
  F13 --> F14
```

Garis putus-putus berarti fase itu boleh dikerjakan paralel melawan **mock server** fase 02, lalu disambungkan ke server asli di fase 10.

---

## 5. Aturan emas

1. **Kontrak dulu.** `ref/R2`, `R3`, `R4` adalah kontrak antar-paket. Hanya Lane Alief yang mengubahnya, lewat contract PR + entri DECISIONS.
2. **Satu fase per sesi.** Agent tidak mengerjakan fase lain walaupun "sekalian".
3. **Folder = lane.** Jangan menyentuh folder lane lain (tabel di `../PLAN.md` §2).
4. **P0 sebelum P1.**
5. **Test adalah bukti.** ECC `tdd-workflow` + `verification-loop`.
6. **Bob slice itu nyata.** Setiap fase yang punya Bob slice menghasilkan kode yang benar-benar dibuat Bob + bukti di `bob_sessions/` (R7).
7. **Tanpa secret, tanpa nama file terlarang** (R5 §8).
8. **Demo adalah produk.** Keputusan diuji terhadap naskah video PRD §15 (≤ 3 menit).
9. **Bobcoin hemat.** 40 per akun (anggaran di `../PLAN.md` §7).

---

## 6. Definisi selesai proyek

Lihat [`../PLAN.md`](../PLAN.md) §9.
