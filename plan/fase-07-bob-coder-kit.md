# Fase 07 — Paket `.bob/` untuk coder: mode `coder`, hook, `radar-mcp` (tool coder)

| Field | Nilai |
|---|---|
| Jalur | **Lane Umar** (Umar) · branch `lane/bob` · sebagian besar kode ditulis di **Bob IDE** (Bob slice), Claude Code + ECC untuk test, review, dan bundel |
| Slot WITA | Sab 26 Sep 09:00 – 16:00 |
| Estimasi | 5 jam |
| Prasyarat | 01 (hasil spike), 02. **Boleh paralel** memakai mock server (`pnpm -C radar dev:mock`) sebelum fase 03/05 masuk `main` |
| Requirement PRD | BC-01, BC-02, BC-03, BC-04, BC-07, JT-01 (sisi hook), JT-03 (`shareprompts`) (P0); kerangka BC-05 (P1) |
| Model | Sonnet 5 · effort high |
| Bob slice | **B2** `custom_modes.yaml` coder (bukti `02-coder-mode`) · **B3** hook `lock_guard` + `brief` (`03-hooks`) · **B4a** tool MCP coder (`04-mcp-coder`). Prompt siap tempel ditulis agent sebelum setiap slice. |
| Fase berikutnya | 08 |

## Tujuan

Membuat Bob milik coder "sadar Radar": di awal sesi dan setiap prompt ia mendapat brief ≤ 6 baris; setiap upaya menulis file dicek ke server lebih dulu dan diblokir kalau milik orang lain; setelah diblokir Bob menjelaskan ke coder dan pindah ke bagian lain, lalu mengajukan task ketika selesai. Semua dikirim sebagai kit yang dipasang `radar join`.

## Bacaan wajib

- `docs/SPIKE_RESULTS.md` + entri GATE 1 di `plan/log/DECISIONS.md` (**sumber kebenaran untuk semua detail Bob**)
- PRD §06 tabel hook, §07.2, §10.3, §11 "Layar coder", §13 "Konfigurasi Bob" & tabel tool MCP
- `plan/ref/R3-kontrak-api.md` §2.2–2.9, §7; `plan/ref/R5-konvensi.md` §1, §4

## Output

- `packages/hooks/src/{_shared,activity,brief,lock_guard,mark_ai_edit,stop}.ts` + `build.mjs` (esbuild)
- `packages/mcp/src/{main,client}.ts`, `tools/coder/*.ts` + `build.mjs`
- `bob-kit/coder/.bob/{custom_modes.yaml, settings.json, mcp.json, rules-coder/01-radar.md, hooks/brief.js, hooks/lock_guard.js, hooks/mark_ai_edit.js, hooks/stop.js, radar-mcp.js, README.md}`
- `bob-kit/prompts/coder-*.md`
- Test hook & MCP; bukti manual di Bob IDE

## Langkah kerja

1. **Sesuaikan dengan spike.** Sebelum menulis kode, salin ke log fase: regex tool edit, field path, kanal pesan blokir (stderr+exit 2 / JSON), apakah stdout brief masuk konteks, lokasi `mcp.json` + `alwaysAllow`, nama grup mode (docs: `execute`, bukan `command`), nama tool shell (docs: `execute_command`), perilaku timeout hook, hasil uji trust workspace. Kalau ada yang belum diverifikasi → tandai "BELUM DIVERIFIKASI SPIKE" dan uji di langkah 12.

2. **Hook bersama** (`packages/hooks/src/_shared.ts`): `readStdin(timeoutMs=500)`, `loadLocalConfig(cwd atau RADAR_ROOT)`, `logLine()` ke `.radar/hook.log` (tanpa token), `withDeadline(fn, 1500)` — semua error/timeout → **fail-open**.

3. **`lock_guard.ts`** (PreToolUse, BC-04):
   ```text
   start = now
   raw = readStdin()
   n = normalizeHookPayload(raw, root)
   if n.paths kosong → exit 0
   try res = POST /v1/locks/check {paths, tool, sessionId, clientTs} (timeout 1500 ms)
   catch timeout/network → log + best-effort POST event failopen di background (tanpa menunggu) → exit 0   # fail-open (PRD §06)
   if res.decision == 'allow' → exit 0 (kalau reason 'grabbed' cetak info singkat ke stdout bila spike menunjukkan aman)
   else → tulis res.message ke kanal blokir hasil spike (default stderr) → simpan lastBlock ke .radar/state.json → exit 2
   log durasi (target < 300 ms)
   ```
   - Tidak pernah exit dengan kode lain selain 0/2. Tangkap semua exception.
   - Fail-open dicatat server lewat `POST /v1/ai-edits`? **Tidak** — kirim sebagai event lewat endpoint ringan: tambah field `failopen: true` pada panggilan berikutnya yang sukses, atau cukup log lokal + `metric` saat hook berikut berhasil (catat pilihan di DECISIONS). Minimal: log lokal.

4. **`brief.ts`** (SessionStart & UserPromptSubmit, BC-02/03): argumen `start|prompt`.
   - `start`: `GET /v1/brief?kind=start` → cetak `lines` ke stdout (≤ 6). Simpan `cursor`.
   - `prompt`: `GET /v1/brief?kind=prompt&since=<cursor>` → cetak bila tidak kosong; simpan cursor baru.
   - Timeout 1500 ms → cetak apa-apa? **Tidak**: diam (hemat Bobcoin), log lokal.
   - Docs lifecycle hooks Bob IDE: stdout `SessionStart` dan `UserPromptSubmit` disuntik sebagai konteks. Ini jalur utama penjelasan blokir: server menaruh blokir terbaru sejak `since` di baris pertama brief `prompt` (R4 §8 kind=prompt poin 0), jadi hook cukup mencetak `lines`. Kalau spike 3 membuktikan sebaliknya → fallback sesuai DECISIONS.

5. **`mark_ai_edit.ts`** (PostToolUse): **P0** kirim `bob.activity kind=tool.post` (JT-01, lewat `activity.ts`). **P1** (BC-05) juga `POST /v1/ai-edits {paths, tool, sessionId}`; endpoint dibuat di fase 12, sampai itu gagal diam. Keduanya fire-and-forget (timeout 800 ms), selalu exit 0.
5b. **`stop.ts`** (Stop): kirim `bob.activity kind=turn.end` (payload `Stop` hanya session ID, jadi tanpa ringkasan). Selalu exit 0. **Tidak melepas kunci.**
5c. **`activity.ts`** (helper): `sendActivity(kind, fields)` → `POST /v1/bob/activity`, timeout 800 ms, tidak pernah melempar, tidak menunda keputusan blokir (`lock_guard` memanggilnya setelah exit code ditentukan, tanpa `await` lebih dari sisa tenggat). `mode` dari `.radar/local.json` `role`. `text` hanya dikirim bila `shareprompts=true`.

6. **Bundle** (`packages/hooks/build.mjs`): esbuild entry per hook → `bob-kit/coder/.bob/hooks/<nama>.js`, `bundle: true, platform: 'node', format: 'cjs', target: 'node20', minify: false, banner: '#!/usr/bin/env node'`, tanpa external. Tambahkan komentar header `// generated by @radar/hooks — do not edit`.

7. **`radar-mcp`** (`packages/mcp`):
   - `main.ts`: `McpServer({ name: 'radar', version })` + `StdioServerTransport`. Muat config (`loadLocalConfig(process.cwd())`); role dari config → daftarkan tool role itu saja. **Jangan pernah menulis ke stdout selain protokol MCP** (log ke stderr/file).
   - `client.ts`: pembungkus `radarFetch` dengan timeout 5 s dan pesan error Bahasa Indonesia yang ramah model ("Server Radar tidak menjawab; lanjutkan pekerjaan lokal dan coba lagi nanti.").
   - Tool coder (R3 §7) dengan `registerTool(name, { title, description, inputSchema }, handler)`. Deskripsi tool ditulis untuk model — jelas kapan dipakai:
     | Tool | Deskripsi (ringkas) | Output teks |
     |---|---|---|
     | `my_tasks` | "Panggil di awal setiap sesi. Menampilkan task milikmu, file yang boleh kamu tulis, dan file yang masih antre." | `Task aktif: T-2 Dark mode (dikerjakan)` + daftar file dengan status |
     | `why_blocked` | "Panggil SEGERA setelah edit ditolak Radar. Menjelaskan pemilik file, task-nya, dan apa yang bisa kamu kerjakan sekarang." | `src/checkout/checkout.ts dipegang Alice (T-1 Kupon) sejak 7 menit.` + status permintaan + saran |
     | `request_file` | "Minta file yang sedang dipegang orang lain ke PM, dengan alasan. Jangan dipanggil untuk file bebas." | `Permintaan R-4 dikirim ke PM.` |
     | `team_activity` | "Lihat perubahan terbaru rekan, opsional untuk satu path." | ≤ 10 baris feed |
     | `submit_task` | "Panggil saat task selesai dan sudah kamu cek. Task masuk antrean review PM; kunci tetap milikmu sampai disetujui." | `T-2 diajukan untuk review (3 file).` |
   - Bundle esbuild → `bob-kit/coder/.bob/radar-mcp.js` dan `bob-kit/pm/.bob/radar-mcp.js` (file sama; role dari config).

8. **`bob-kit/coder/.bob/custom_modes.yaml`** — mulai dari PRD §13, sesuaikan nama grup & tool hasil spike:
   ```yaml
   customModes:
     - slug: coder
       name: Live Collab Coder
       roleDefinition: >-
         Kamu adalah coder di workspace multiplayer IBM Bob Live Collab. Beberapa AI dan manusia bekerja di
         folder yang sama secara live. Setiap file hanya boleh ditulis oleh satu task pada satu waktu.
       whenToUse: Mengerjakan task yang dibagikan PM di workspace IBM Bob Live Collab.
       customInstructions: |-
         1. Mulai setiap sesi dengan memanggil tool radar my_tasks. Kerjakan hanya task milikmu.
         2. Baca brief [Radar] di konteks. Brief adalah kebenaran terbaru tentang kunci dan keputusan PM.
         3. File bisa berubah karena rekan kapan saja. Selalu baca ulang file tepat sebelum mengeditnya.
         4. Kalau sebuah edit ditolak atau gagal tanpa alasan yang jelas (pesan hook bisa saja tidak
            terlihat olehmu), anggap file itu dikunci Radar: JANGAN coba ulang, JANGAN mengubah file itu
            lewat shell (execute_command, sed, echo, cp, mv), dan JANGAN membuat salinan
            file untuk mengakalinya. Panggil radar why_blocked DULU, jelaskan ke user dalam satu-dua
            kalimat siapa pemegangnya dan untuk task apa, lalu lanjutkan bagian lain dari task-mu.
         5. Kalau kamu benar-benar butuh file itu, panggil radar request_file dengan alasan singkat.
         6. Saat task selesai dan sudah dicek (typecheck/build bila ada), panggil radar submit_task
            dengan ringkasan 1–3 kalimat. Setelah itu jangan mengedit file task kecuali diminta.
         7. Keputusan PM datang lewat brief di prompt berikutnya. Jangan menebak keputusan.
       groups: [read, edit, execute, mcp]
   ```
   Grup shell di Bob bernama `execute` (docs custom modes: nama grup yang tidak dikenal tidak memberi akses). Instruksi poin 4 juga ditulis sebagai rules mode di `bob-kit/coder/.bob/rules-coder/01-radar.md` supaya tetap terbaca walau `customInstructions` terpotong.

9. **`bob-kit/coder/.bob/settings.json`** — PRD §13 dengan nilai hasil spike: kelima hook (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`). Matcher `PreToolUse` = tool edit `^(write_file|apply_diff|search_and_replace|insert_content|office_edit)$`; matcher `PostToolUse` = tool edit + baca + perintah dari spike 7 (JT-02), tanpa tool MCP `radar` sendiri. Lalu perintah, `timeout` eksplisit 3 s untuk `PreToolUse` dan 5 s untuk brief; default Bob 10 s). Perintah hook memakai path relatif root workspace (`node .bob/hooks/lock_guard.js`); kalau spike menunjukkan cwd hook bukan root, pakai variabel yang tersedia atau path absolut yang ditulis `radar kit install` saat pemasangan (template `{{ROOT}}`).

10. **`bob-kit/coder/.bob/mcp.json`** — `{ "mcpServers": { "radar": { "command": "node", "args": [".bob/radar-mcp.js"], "alwaysAllow": ["my_tasks", "why_blocked", "request_file", "team_activity", "submit_task"] } } }` (atau format/lokasi hasil spike). Tanpa `alwaysAllow`, Bob meminta approve untuk setiap panggilan MCP (auto-approve mati secara default), jadi `why_blocked` tidak jalan otomatis. `radar kit install` mengganti path menjadi absolut bila perlu.

11. **Prompt siap pakai** `bob-kit/prompts/coder-mulai.md` ("Mulai kerja: panggil my_tasks lalu kerjakan task aktif…"), `coder-lanjut.md`, `coder-selesai.md`. Singkat, hemat Bobcoin.

12. **Test otomatis**:
    - `packages/hooks/test/lock_guard.test.ts`: jalankan bundle dengan `child_process.spawn('node', [bundle])`, stdin = fixture spike (dua bentuk), env `RADAR_*` → mock/test server:
      - file milik sendiri → exit 0; milik orang lain → exit 2 & pesan berisi nama pemegang; path di luar workspace → exit 0;
      - server mati (port tertutup) → exit 0 dalam < 1,8 s (fail-open);
      - server lambat 3 s → exit 0 dalam < 1,8 s;
      - ukur durasi 20× → p95 < 300 ms terhadap server lokal (catat angka).
    - `brief.test.ts`: `start` mencetak ≤ 6 baris; `prompt` tanpa hal baru tidak mencetak apa pun; cursor tersimpan.
    - `packages/mcp/test/coder.test.ts`: `Client` + `InMemoryTransport` (atau spawn stdio) → `listTools` untuk role coder = persis 5 tool; setiap tool mengembalikan teks sesuai skenario mock.

13. **Uji di Bob IDE (LANGKAH MANUAL, di workspace toko-demo yang di-`radar join` sebagai A dan B, server = mock atau server asli)**:
    1. `radar kit install coder` → buka folder di Bob IDE dan **trust workspace** (folder untrusted melewati hook, MCP, dan rules tanpa error) → Bob IDE memuat mode "Live Collab Coder" & MCP `radar` (cek panel MCP dan tab Hooks di Settings).
    2. Sesi baru mode `coder` → brief `[Radar]` terlihat/terbaca Bob (tanya "apa brief Radar-mu?").
    3. Prompt "Kerjakan task aktifmu" → Bob memanggil `my_tasks` lebih dulu (BC-01).
    4. Minta Bob B mengedit `src/checkout/checkout.ts` (milik A) → edit diblokir, file tidak berubah, Bob memanggil `why_blocked` dan menjelaskan pemilik + pindah ke file lain, **tidak mencoba ulang dan tidak memakai shell** (BC-01, BC-04). Ulangi 3× dengan kata-kata berbeda, catat hasil.
    5. Minta Bob menyelesaikan task → Bob memanggil `submit_task` (BC-07).
    6. Screenshot ringkasan task setiap sesi Bob lewat `bob-evidence.sh umar <NN> <slug>` (R7).
    Tulis hasil setiap langkah (lulus/gagal + kutipan jawaban Bob) di log fase — kutipan ini dipakai lagi di replay (fase 11) dan video.

14. **Perbaikan perilaku**: kalau Bob mencoba ulang / memakai shell, perkuat instruksi mode (kalimat tegas, contoh), tambahkan kalimat penutup di pesan blokir. Uji ulang sampai 3 dari 3 percobaan benar.

15. Commit `fase-07: bob coder kit (mode, hooks, radar-mcp coder tools)`.

## Tambahan v0.3

- **Target utama = Bob IDE** (aturan hackathon: Bob IDE wajib jadi komponen inti). Docs resmi menyatakan Bob IDE mendukung 5 hook dan blokir exit 2 di `PreToolUse`. Tapi stderr hook hanya masuk log, jadi pesan blokir belum tentu sampai ke model: jalur penjelasan dipilih dari hasil spike 2 (R3 §2.2), dan instruksi mode poin 4 selalu dipasang sebagai jaring pengaman. Bob Shell opsional, tidak diuji untuk P0.
- **Stream aktivitas (JT-01, P0):** semua hook memanggil `POST /v1/bob/activity` secara fire-and-forget (≤ 800 ms, gagal = diam): `UserPromptSubmit` → `kind:"prompt"` (ringkasan ≤ 200 karakter, hanya bila `shareprompts` di `.radar/local.json` = true), `PreToolUse` → `tool.pre` + hasil cek kunci, `PostToolUse` (matcher tool edit + baca + perintah dari hasil spike, bukan tool MCP `radar` sendiri) → `tool.post` + path + jumlah baris berubah bila payload membawanya, `Stop` → `turn.end` (tanpa ringkasan), `SessionStart` → `session.start` + mode. Isi file tidak pernah dikirim.
- Jejak `BobTrace` (mis. `hook · PreToolUse · lock_guard → blocked · 84 ms`) dibentuk dari event `bob.activity` di app. Di Bob IDE, stdout `PreToolUse` diabaikan, jadi jejak blokir di chat Bob berasal dari pesan penolakan + penjelasan `why_blocked`.
- `RADAR_LANG=en` (default demo) atau `id` untuk teks brief/blokir.

## Verifikasi

```bash
pnpm -C radar --filter @radar/hooks test
pnpm -C radar --filter @radar/mcp test
pnpm -C radar bundle:kit && ls -la radar/bob-kit/coder/.bob radar/bob-kit/coder/.bob/hooks
echo '{"hook_event_name":"PreToolUse","tool_name":"write_file","tool_input":{"path":"src/checkout/checkout.ts"}}' \
  | RADAR_SERVER=http://localhost:8787 RADAR_TOKEN=tok-b RADAR_ROOT=$PWD/examples/toko-demo \
    node bob-kit/coder/.bob/hooks/lock_guard.js; echo "exit=$?"
```

## Kriteria selesai (DoD)

- [ ] BC-01: di Bob, 3/3 percobaan blokir → `why_blocked`, tanpa coba ulang, tanpa shell (kutipan di log).
- [ ] BC-02: brief start ≤ 6 baris (test + bukti Bob).
- [ ] BC-03: brief prompt memuat keputusan/notifikasi/perubahan rekan sejak prompt terakhir (test).
- [ ] BC-04: dua bentuk payload dinormalisasi; blokir = exit 2 & file tidak berubah (test + bukti Bob).
- [ ] BC-07: 5 tool coder berfungsi (test MCP + bukti Bob).
- [ ] Fail-open terbukti (server mati → exit 0 < 1,8 s).
- [ ] JT-01 sisi hook: setiap hook mengirim `bob.activity` yang benar (test dengan mock), `text` tidak terkirim bila `shareprompts=false`.
- [ ] Screenshot ringkasan task Bob ada di `bob_sessions/` (R7).

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Bob tetap mencoba ulang edit | Pesan blokir lebih eksplisit + contoh di instruksi mode; lapis kedua server tetap menjamin file tidak berubah |
| Hook lambat karena start Node (> 300 ms) | Bundle kecil (tanpa zod penuh: impor hanya schema yang dibutuhkan), hindari `ignore` besar; ukur `node --cpu-prof` bila perlu |
| cwd hook bukan root workspace | `radar kit install` menulis path absolut ke `settings.json` |
| MCP tidak terbaca di mode | Cek workspace trusted dulu; lokasi config sesuai spike; fallback: daftarkan MCP global Bob (`~/.bob/settings/mcp.json`) |
| Hook/MCP diam tanpa error | Workspace belum trusted (Bob IDE ≥ 2.0.2). Trust workspace, lalu cek tab Hooks di Settings |

## Catatan handoff

- Fase 08 memakai `packages/mcp` yang sama (tambah `tools/pm/*`).
- Kutipan jawaban Bob (blokir & penjelasan) → `radar/bob-kit/prompts/bob-quotes.json` (folder lane Umar). Imelda menyalinnya ke replay di fase 11D.
