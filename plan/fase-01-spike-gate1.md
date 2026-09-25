# Fase 01 — Spike teknis & GATE 1

| Field | Nilai |
|---|---|
| Jalur | **Lane B** (spike 1–3, 5–7, branch `lane/bob`) + Lane A (spike 4, 30 menit) + **Lane C** (spike 8, dan membantu spike 7 di `lane/app`) |
| Slot WITA | Sab 26 Sep 00:30 – 04:00 · **GATE 1 Sab 04:00** |
| Estimasi | 3 jam (≈ 40% menyiapkan script, 60% uji manual di Bob IDE) |
| Prasyarat | 00 |
| Requirement PRD | §17 spike 1–6, §18 open question 1–5, dasar BC-01..04, MA-01 |
| Model | Sonnet 5 · effort medium |
| Bob slice | **B1**: hook payload logger + mode read-only ditulis di Bob IDE (bukti `01-spike-hooks`) |
| Fase berikutnya | 02 (Orang 1) · 07 setelah tidur (Orang 2) — solo: **02** |

## Tujuan

Membuktikan (atau membantah) enam asumsi teknis yang menopang PRD sebelum menulis kode produk, lalu mengambil keputusan GATE 1 yang mengunci cara penegakan kunci dan cara sinkron. Semua fakta tentang Bob yang dipakai fase 07–08 **harus** berasal dari hasil fase ini.

## Bacaan wajib

- PRD §06 (tabel hasil cek hook), §08.3, §13 (konfigurasi Bob), §17 (spike + GATE 1), §18 (open question)
- Dokumentasi Bob (buka di browser, ringkas ke log): lifecycle hooks, custom modes, MCP — tautan di bagian "Sumber" PRD
- `plan/ref/R3-kontrak-api.md` §2.2 (bentuk pesan blokir yang ingin kita capai)

## Output

- `spike/` (tidak masuk produk):
  - `spike/.bob/settings.json`, `spike/.bob/custom_modes.yaml`, `spike/.bob/mcp.json`
  - `spike/hooks/log_payload.js`, `spike/hooks/block_edit.js`, `spike/hooks/timing.js`
  - `spike/mcp/echo-server.mjs`
  - `spike/sync/two-dir.ts`, `spike/sync/relay.ts`
  - `spike/sandbox/` (file target untuk diedit Bob: `a.ts`, `b.ts`, `locked.ts`)
  - `spike/README.md` (cara menjalankan tiap spike)
- `docs/SPIKE_RESULTS.md` terisi lengkap (tabel hasil + bukti + jawaban OQ 1–5)
- Entri `D-00x` di `plan/log/DECISIONS.md`: **Keputusan GATE 1** + semua fakta Bob yang ditemukan

## Langkah kerja

### A. Siapkan artefak (agent)

0. **Bob slice B1.** Langkah 1 dan 5 di bawah ditulis oleh **Bob IDE** (mode Code) dengan prompt: "Buat `radar/spike/hooks/log_payload.js` dan `radar/spike/.bob/custom_modes.yaml` sesuai `plan/fase-01-spike-gate1.md` langkah A1 dan A5." Bukti: `bob-evidence.sh <nama> 01-spike-hooks`. Claude Code mengerjakan sisanya.
1. **`spike/hooks/log_payload.js`** — CommonJS, tanpa dependensi:
   - Baca seluruh stdin (timeout 1 s), `JSON.parse` kalau bisa.
   - Tulis `spike/out/<event>-<timestamp>.json` berisi `{ argv, env: <hanya var berawalan BOB_/HOOK_/CLAUDE_>, cwd, stdinRaw, stdinJson }`.
   - Cetak ke **stdout** satu baris `SPIKE-MARKER <event> <timestamp>` (untuk spike 3: apakah stdout masuk konteks model).
   - Exit 0. Argumen pertama = nama event (`start`, `prompt`, `pre`, `post`, `stop`).
2. **`spike/hooks/block_edit.js`** — sama seperti di atas tapi: kalau path target berakhiran `locked.ts` → tulis ke **stderr** `SPIKE-BLOCK: locked.ts dipegang Bob milik A (T-1). Jangan coba ulang. Panggil why_blocked.` dan exit **2**; selain itu exit 0. Ekstrak path dengan mencoba field `tool_input.path`, `tool_input.file_path`, `input.path`, `input.file_path`, `input.args.path`, dan array `input.files[].path` (tulis field mana yang ternyata dipakai).
   - Variasi kedua (flag `--json`): alih-alih exit 2, cetak JSON `{"decision":"block","reason":"…"}` ke stdout + exit 0 — untuk mengetahui apakah Bob mendukung keputusan via JSON.
3. **`spike/hooks/timing.js`** — ukur overhead eksekusi `node` hook (cetak durasi dari `process.hrtime` start sampai exit ke file).
4. **`spike/.bob/settings.json`** — daftarkan SEMUA event yang disebut docs Bob (minimal `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`) ke `log_payload.js`; `PreToolUse` dengan matcher `^(write_file|apply_diff|search_and_replace|insert_content)$` ke `block_edit.js`. Tambahkan juga entri PreToolUse **tanpa matcher** ke `log_payload.js pre-all` untuk menemukan nama SEMUA tool (termasuk tool eksekusi perintah, OQ 3).
5. **`spike/.bob/custom_modes.yaml`** — dua mode:
   - `spike-coder`: groups `[read, edit, command, mcp]`
   - `spike-readonly`: groups `[read, mcp]` + instruksi "Coba tulis file sandbox/a.ts kalau diminta."
6. **`spike/mcp/echo-server.mjs`** — server MCP stdio minimal (boleh memakai `@modelcontextprotocol/sdk` dari root `node_modules` dengan path absolut, atau implementasi JSON-RPC manual) dengan tool `ping({ note })` → `pong <note> role=<env RADAR_ROLE> cwd=<cwd>`.
   `spike/.bob/mcp.json` → `{ "mcpServers": { "radar-spike": { "command": "node", "args": ["<abs path>/spike/mcp/echo-server.mjs"], "env": { "RADAR_ROLE": "coder" } } } }` (lokasi & format file MCP proyek diverifikasi di spike 6).
7. **Spike 4 (Orang 1) — `spike/sync/relay.ts` + `two-dir.ts`**:
   - `relay.ts`: server `ws` kecil yang meneruskan `{path, content, hash, t0}` ke klien lain.
   - `two-dir.ts`: dua watcher `chokidar@4` di `spike/tmp/A` dan `spike/tmp/B` (bisa di 2 PC berbeda dengan `--relay ws://<ip>:8799`), debounce 150 ms, anti-gema hash, penulisan atomik (tmp + rename).
   - Mode bench: tulis 50 file berurutan di A, ukur `t(apply di B) - t(write di A)`, cetak p50/p95/max. Mode "Bob": biarkan Bob menulis di A, amati B.
8. **`spike/README.md`** — satu bagian per spike: perintah, apa yang diamati, di mana bukti disimpan.

### B. Uji manual (LANGKAH MANUAL — manusia di Bob IDE; agent menulis checklist ini ke log)

Buka folder `radar/spike/` sebagai workspace di Bob IDE **dan** di Bob Shell (`cd radar/spike && bob`). Hook Bob Shell terdokumentasi resmi (`.bob/settings.json`), sedangkan hook Bob IDE harus dibuktikan di sini. Untuk setiap spike, simpan bukti (screenshot atau file di `spike/out/`) dan isi tabel di `docs/SPIKE_RESULTS.md`.

| # | Uji | Cara | Lulus kalau |
|---|---|---|---|
| 1 | PreToolUse terpicu & exit 2 mencegah tulis | Mode `spike-coder`. Prompt: "Tambahkan komentar `// hi` di sandbox/locked.ts". Lalu cek isi file & `spike/out/pre-*.json` | Hook terpicu untuk tool edit; `locked.ts` **tidak berubah**. Catat nama tool & field path yang terlihat |
| 1b | Tool lain | Prompt yang sama untuk `sandbox/a.ts` dengan meminta Bob memakai tiap tool edit (write/apply_diff/search_and_replace/insert_content) | Semua tool edit tertangkap matcher; catat tool edit lain yang tidak tertangkap |
| 2 | Apa yang diterima model setelah blokir | Setelah uji 1, tanya Bob: "Pesan persis apa yang kamu terima dari hook tadi?" + lihat panel/log Bob | Catat apakah stderr diteruskan ke model, formatnya, dan apakah Bob mencoba ulang otomatis |
| 2b | Keputusan via JSON | Ganti ke `block_edit.js --json`, ulangi | Catat apakah Bob menghormati JSON (kalau tidak, pakai exit 2) |
| 3 | Stdout `UserPromptSubmit`/`SessionStart` masuk konteks | Mulai sesi baru, kirim prompt "Sebutkan semua baris yang diawali SPIKE-MARKER di konteksmu" | Bob menyebut marker dari `start` dan `prompt` |
| 4 | Edit Bob memicu chokidar & sampai ke PC 2 < 1 s | Orang 1: `two-dir.ts` antara 2 PC (atau 2 folder), Bob menulis file di A | File muncul di B, p95 bench < 1000 ms, tidak ada gema |
| 4b | Editor memuat ulang file dari luar (OQ 4) | Buka `tmp/B/x.ts` di Bob IDE, ubah dari A | Catat: editor reload otomatis / muncul prompt / tidak |
| 5 | Mode `[read, mcp]` tidak bisa menulis | Mode `spike-readonly`, prompt "Tulis 'x' ke sandbox/a.ts, wajib" | Bob menolak/tidak punya tool edit; file tidak berubah |
| 6 | Tool MCP stdio bisa dipanggil dari dua mode | Di `spike-coder` dan `spike-readonly`: "Panggil tool ping dari radar-spike dengan note=halo" | Output `pong halo role=coder` di kedua mode; catat lokasi file mcp yang dibaca Bob & format nama tool |
| 7 | Hook di Bob Shell (OQ 5) | Jalankan `bob` CLI (Bob Shell) di folder spike dengan prompt edit `locked.ts` | Catat apakah hook yang sama terpicu |
| 8 | Overhead hook | `timing.js` | Catat ms; target total cek kunci < 300 ms (NFR-01) |
| 9 | Nama grup tool & tool shell (OQ 2, 3) | Dari `pre-all-*.json` dan docs | Catat nama grup yang valid & nama tool eksekusi perintah |
| 10 | Bentuk payload (dua bentuk BC-04) | Bandingkan `pre-*.json` dari IDE vs Shell | Catat bentuk mana yang dipakai masing-masing |
| 11 | **Bob Shell di terminal Orca** (spike 7) | Lane C: `pnpm -C app dev` app fork → pilih agent (sementara "custom command" `bob`) → jalankan `bob` di folder `spike/` → ulangi uji 1 & 3 dari terminal itu | Bob interaktif normal (warna, input, TUI), hook terpicu sama seperti di Terminal macOS. Catat mode injeksi prompt yang aman untuk `promptInjectionMode`. |
| 12 | **Tap output xterm** (spike 7b) | Lane C: tambahkan `console.debug` sementara di titik `term.write` renderer (lihat Bob slice C1) | Data dari sesi `bob` bisa disalin tanpa mengganggu tampilan. Catat ukuran frame/detik saat Bob menjawab. |
| 13 | **Build app** (spike 8) | Lane C: `pnpm -C app build:unpack` (atau `build:mac`) di Mac tim | `.app` terbentuk dan bisa dibuka. Catat durasi dan error native helper. |
| 14 | **Login akun** | `bob` CLI dan Bob IDE memakai akun hackathon yang sama | Keduanya jalan. Catat cara login CLI. |

### C. Keputusan GATE 1 (Sab 04:00)

9. Isi matriks berikut di `docs/SPIKE_RESULTS.md` dan salin keputusannya ke `DECISIONS.md`:

| Hasil | Keputusan |
|---|---|
| Spike 1 lulus | `ENFORCEMENT = hook+server` (rencana utama) |
| Spike 1 gagal (hook tidak terpicu / exit 2 tidak mencegah tulis) | `ENFORCEMENT = server-only`: penegakan penuh di sync agent + server (SY-04). Hook PreToolUse tetap dipasang sebagai "peringatan" kalau terpicu. Instruksi mode `coder` diperkuat: panggil `radar.check_file(path)` sebelum menulis (tambah tool MCP opsional di fase 07) |
| Spike 2: stderr tidak sampai ke model | Pesan blokir dipindah ke stdout / JSON sesuai temuan 2b; kalau tidak ada jalur sama sekali, andalkan brief `UserPromptSubmit` berikutnya + `why_blocked` |
| Spike 3 gagal | Brief dikirim lewat tool MCP `my_tasks` di awal (instruksi mode) dan notifikasi terminal sync agent |
| Spike 4 p95 ≥ 1 s atau event hilang | `SYNC = poll-1s` (sync agent memindai mtime setiap 1 s) |
| Spike 5 gagal | Mode `pm-lead` tanpa grup `edit` & `command` + server menolak semua update dari role PM (sudah di R4) + instruksi mode tegas |
| Spike 6 gagal di salah satu mode | Dokumentasikan; untuk PM gunakan REST lewat script `bob-kit/prompts` sebagai fallback |
| Hook jalan di Shell tapi tidak di IDE | `ENFORCEMENT_IDE = server-only`. Demo blokir memakai coder Bob Shell (Budi). Andi (IDE) tetap diamankan lapis 2. |
| Spike 11 gagal (Bob tidak nyaman di terminal Orca) | Budi menjalankan `bob` di Terminal macOS. Fitur tonton terminal tetap memakai terminal Orca biasa yang menjalankan `bob`, atau mode fallback: tonton output `bob run --format stream-json` |
| Spike 13 gagal | Demo memakai `pnpm -C app dev` di 3 Mac. `.dmg` dikejar di fase 11 bagian C. |

10. Perbarui konstanta yang terdampak di rencana: `EDIT_TOOLS_REGEX` (R5 §4), daftar field path untuk normalisasi (dipakai fase 02 `hook-payload.ts`), nama grup tool & lokasi file konfigurasi Bob (fase 07/08), nama tool shell (instruksi mode `coder`). Tulis semuanya sebagai entri DECISIONS dan edit `plan/ref/R5-konvensi.md` bila regex berubah.

11. Commit `fase-01: spike results & GATE 1`.

## Verifikasi

- `docs/SPIKE_RESULTS.md` punya 14 baris uji, masing-masing berisi: hasil (lulus/gagal/sebagian), bukti (path file/screenshot), catatan.
- `spike/out/` berisi minimal satu payload untuk setiap event hook (dikecualikan dari git; salin 1 contoh per event yang **sudah disensor** ke `docs/spike-payloads/` sebagai fixture test fase 02).
- Bench spike 4 mencetak p50/p95/max.

## Kriteria selesai (DoD)

- [ ] Semua 14 uji punya hasil tercatat (boleh "gagal" — yang penting diketahui).
- [ ] Keputusan GATE 1 (`ENFORCEMENT`, `SYNC`, jalur pesan blokir, jalur brief) tercatat di DECISIONS.
- [ ] Fixture payload nyata (disensor) tersedia di `docs/spike-payloads/*.json` untuk test normalisasi fase 02/07.
- [ ] OQ 1–5 PRD §18 terjawab di `docs/SPIKE_RESULTS.md`.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Bob IDE belum terpasang/masalah lisensi di jam 01:00 | Kerjakan spike 4 dulu; spike Bob digeser ke awal fase 07 (Sab 10:00), fase 02–06 tidak terdampak |
| Hook tidak terpicu sama sekali | Cek lokasi `settings.json` (proyek vs global), restart Bob, cek versi ≥ 2.0.1; kalau tetap gagal → `ENFORCEMENT = server-only` |
| Bobcoin boros saat spike | Prompt pendek, satu sesi per spike, jangan minta Bob membaca repo besar |

## Catatan handoff

- Fase 02 (`hook-payload.ts`) memakai fixture di `docs/spike-payloads/`.
- Fase 07 memakai: regex tool edit, field path, kanal pesan blokir, lokasi `mcp.json`, nama grup mode, nama tool shell.
- Fase 04 memakai keputusan `SYNC` (watch vs poll).
