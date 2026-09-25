# Log fase 01 — Spike & GATE 1 (Lane Umar · Bob)

- **Status:** [x] selesai. GATE 1 diputuskan (D-umar-01). Sisa: uji 4 dua Mac (Alief, TODO D4), uji 13 build app (lane App).
- **Mulai:** Sab 26 Sep 2026 00:10 WITA · **Selesai:** 00:40 WITA · branch `lane/bob`.
- **Model:** Claude Opus 5.5 (R6 §2 menyarankan Sonnet 5 · medium; sesi sudah berjalan di Opus).
- **Mesin:** Mac Umar, IBM Bob IDE 2.2.0, Node 25.8.1 (Node 24/nvm tidak terpasang; spike tidak butuh fitur khusus 24), pnpm 12.0.0.

## Pra-cek

- D-007 ada di `origin/main` (4 kemunculan). Working tree bersih. Tidak ada PR lain (`gh pr list` kosong).
- TODO D1 (versi ≥ 2.1.0): **2.2.0** di Mac ini. D2 (login): login aktif, instance `ibm-coding-challenge-2` (us-east), bukan `-uat` seperti di plan → perlu konfirmasi. D3 (trust): folder `radar/spike/` sudah trusted (mewarisi folder induk `IBM/`); uji 17 memakai salinan di luar repo.
- Plugin ECC **tidak terpasang** di Mac ini (`~/.claude/plugins/cache/ecc` tidak ada). Pengganti: agent `Plan`/perencanaan di thread utama, `node:test` untuk TDD, reviewer `caveman:cavecrew-reviewer` untuk langkah 8. `/ecc:save-session` tidak tersedia → log ini jadi titik lanjut.

## Ringkasan rencana

1. Artefak Claude: `block_edit.js` (+ test dulu), `timing.js`, `echo-server.mjs` (+ test), `.bob/settings.json`, `.bob/mcp.json`, `use.sh`, `sync/{relay,two-dir}.ts`, `sandbox/`, README.
2. Bob slice B1 (Bob IDE, otomatis via CDP): `hooks/log_payload.js` + `.bob/custom_modes.yaml`.
3. Uji Bob IDE 1–20 otomatis via CDP (driver `radar/spike/automation/`), satu task per uji, prompt pendek.
4. Bench sync lokal, fixture tersensor, `SPIKE_RESULTS.md`, DECISIONS D-umar-01.

## Checklist langkah (plan/fase-01-spike-gate1.md)

- [x] A0. Bob slice B1: dikerjakan Bob IDE (mode Agent = Code), 0.345 Bobcoin, bukti `bob_sessions/uaai_umar_task01_spike_hooks_summary.png`. Hasil Bob di-commit tanpa perubahan (commit "fase-01: Bob slice B1 …").
- [x] A1. `log_payload.js` (Bob). Smoke test lulus.
- [x] A2. `block_edit.js` + varian `--json`, `--sleep N`. 11 test `node:test` hijau (merah dulu).
- [x] A3. `timing.js` (mode hook + `--bench N`).
- [x] A4. `.bob/settings.json`: 5 event, `pre-all` tanpa matcher, matcher edit ke `block_edit.js`, semua `timeout` eksplisit.
- [x] A5. `custom_modes.yaml` (Bob): `spike-coder`, `spike-cmd-typo`, `spike-readonly`.
- [x] A6. `echo-server.mjs` (JSON-RPC manual, 2 test) + `.bob/mcp.json` dengan `alwaysAllow`. Path diganti ke `${workspaceFolder}/…` setelah uji 6 (cwd server = `/`).
- [x] A7. `sync/relay.ts` + `sync/two-dir.ts` (chokidar 4, ws, debounce 150 ms, anti-gema hash, tulis atomik). Folder sync di `out/sync/` supaya lolos `check:ignored`.
- [x] A8. `spike/README.md` + `use.sh` (ganti varian).
- [x] B. Uji 1–20: lihat tabel di `radar/docs/SPIKE_RESULTS.md`. Semua uji Bob IDE dijalankan otomatis, tanpa klik manusia.
- [x] C9. Matriks GATE 1 → `SPIKE_RESULTS.md` + D-umar-01.
- [x] C10. Konstanta: `EDIT_TOOLS_REGEX` tetap; field path = `tool_input.path`; grup `execute`; tool shell `execute_command`; lokasi `.bob/mcp.json` + `${workspaceFolder}`. Tidak ada edit `plan/ref` (usulan P1–P5 ke Alief).
- [x] C11. Commit + PR.

## Hasil verifikasi

| Perintah | Hasil |
|---|---|
| `pnpm -C radar/spike test` | 13 lulus, 0 gagal |
| `pnpm -C radar/spike bench` (50 file, satu Mac) | received 50, lost 0, echoes 0, p50 190 ms, p95 212 ms, max 259 ms → PASS |
| `pnpm -C radar/spike timing` | spawn `block_edit.js` p50 46.8 ms, p95 61.6 ms, max 67.7 ms |
| hook `timing.js` di Bob (n=24) | umur proses p50 36.8 ms, max 49.3 ms |
| `bash radar/scripts/check-ignored.sh` | OK |
| `radar/docs/spike-payloads/` | 14 fixture (SessionStart, UserPromptSubmit, PreToolUse ×7, PostToolUse ×4, Stop), path & ID disensor |

## DoD + bukti

- [x] 20 uji punya hasil (lulus/gagal/sebagian/dilewati) → `SPIKE_RESULTS.md` tabel "Results".
- [x] Keputusan GATE 1 (`ENFORCEMENT = hook+server`, `SYNC = watch`, pesan blokir via stderr + cadangan, brief via stdout) → D-umar-01.
- [x] Fixture nyata tersensor → `radar/docs/spike-payloads/*.json`.
- [x] OQ 1–5 terjawab → `SPIKE_RESULTS.md` "Open questions".

## Deviasi

- Uji dijalankan otomatis via CDP (bukan manual R7 §2), sesuai instruksi `<bob-slice-otomatis>` user. agent-browser 0.38.1 tidak melihat webview chat Bob, jadi dipakai CDP mentah (`automation/cdp.mjs`, `bobrun.mjs`). Selector dicatat di `SPIKE_RESULTS.md`.
- Bob IDE sempat dibuka dari shell Claude Code dan mewarisi env-nya (termasuk nilai sesi `CLAUDE_CODE_*`) ke `out/b1/*.json` (git-ignored). Nilai sudah diganti `<redacted>`; Bob dibuka ulang dengan `env -i`. Tidak ada yang ter-commit.
- `pnpm install --ignore-workspace` di `radar/spike` sempat mengubah `radar/pnpm-lock.yaml` (menambah `@pnpm/exe`); dikembalikan, tidak di-commit.
- Node 25 dipakai, bukan Node 24 (tidak ada nvm di Mac ini).
- Fakta Bob yang berbeda dari docs/D-007: stderr exit 2 sampai ke model; bentuk payload snake_case; `Stop` membawa `last_assistant_message`; grup `command` diterima. Semua di D-umar-01.

## Bob slice

| ID | Bukti | Bobcoin | File |
|---|---|---|---|
| B1 spike hooks | `bob_sessions/uaai_umar_task01_spike_hooks_summary.png` | 0.345 | `radar/spike/hooks/log_payload.js`, `radar/spike/.bob/custom_modes.yaml` |

Uji spike (18 task Bob, ± 1,3 Bobcoin) adalah uji perilaku, bukan pembangunan; tidak diambil screenshot per task.

## Review (langkah 8)

Reviewer: `caveman:cavecrew-reviewer` (pengganti `ecc:code-reviewer` + `ecc:typescript-reviewer`; ECC tidak terpasang). Security review terpisah tidak wajib untuk fase 01; temuan env bocor ke `out/` sudah ditangani (lihat Deviasi).

| Sev | Temuan | Tindak lanjut |
|---|---|---|
| HIGH | `bobrun.mjs` `opt()` mengembalikan `undefined` bila flag tanpa nilai → `--timeout` NaN, loop berhenti diam-diam | diperbaiki: default dipakai bila nilai hilang/flag lain; `timeoutS` fallback 300 |
| HIGH | `bobrun.mjs` `fetch` CDP tanpa penanganan error | diperbaiki: pesan jelas + exit 2; juga bila target webview tidak ada |
| MEDIUM | `two-dir.ts` `JSON.parse` file bench tanpa try/catch | diperbaiki: fallback ke waktu kirim + warning |
| MEDIUM | pemilih mode di `bobrun.mjs` terlalu longgar | diperbaiki: hanya `[role=option|menuitem|menuitemradio],[cmdk-item]`, nama persis |
| MEDIUM | `relay.ts` memakai `require.main === module` | dibiarkan: paket spike `type: commonjs` dan dijalankan `tsx` (CJS), jadi benar di sini |

Setelah perbaikan: `pnpm test` 13/13, bench 20 file PASS, `bobrun --mode Ask` memilih mode dengan benar.

## LANGKAH MANUAL

1. **Alief (TODO D4):** uji 4 dua Mac: di Mac 1 `pnpm -C radar/spike install --ignore-workspace && pnpm -C radar/spike relay`; di Mac 1 `tsx sync/two-dir.ts --side B --relay ws://<ip-mac1>:8799`; di Mac 2 `tsx sync/two-dir.ts --side A --relay ws://<ip-mac1>:8799 --bench 50`. Catat baris `BENCH …` ke `SPIKE_RESULTS.md` uji 4.
2. **Tim (TODO D2):** konfirmasi instance hackathon yang benar: Mac Umar memakai `ibm-coding-challenge-2` (us-east), plan menulis `ibm-coding-challenge-uat`.
3. **Aarief:** uji 13 `pnpm -C app build:unpack` (fase 09/11b).

## Catatan handoff

- **Alief (fase 02b, 04:00–04:30):** usulan P1–P5 di D-umar-01; fixture di `radar/docs/spike-payloads/`. Normalizer fase 02 cukup menambah test fixture nyata; `EDIT_TOOLS_REGEX` tidak berubah.
- **Umar fase 07:** hook kit `.cjs` (atau `package.json` sendiri); `radar-mcp` via `${workspaceFolder}`; `mark_ai_edit` tanpa stdout; `lock_guard` fail-open jauh di bawah `timeout`; onboarding: trust folder + hindari edit `mcp.json` sesaat sebelum demo.
- **Aarief fase 11a:** `session_id` hook = Task Id Bob (dipakai subagent juga).
- **Semua:** buka Bob IDE dengan env bersih kalau dijalankan dari terminal agent (hook mewarisi env peluncur).
