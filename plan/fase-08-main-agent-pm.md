# Fase 08 — Main agent (Bob milik PM, mode `pm-lead`) & tool MCP PM

| Field | Nilai |
|---|---|
| Jalur | Orang 2 — **jalankan di dalam IBM Bob** dan ekspor sesinya |
| Slot WITA | Sab 26 Sep 16:00 – 21:00 |
| Estimasi | 4 jam |
| Prasyarat | 07. Boleh paralel dengan fase 05/06 memakai mock; uji akhir melawan server asli setelah 05 & 06 |
| Requirement PRD | MA-01, MA-02, MA-03, MA-04, MA-05, MA-07 (P0); kerangka MA-06 (P1) |
| Model | Sonnet 5 · effort high (Opus 5.5 untuk menulis deskripsi tool & instruksi mode bila hasil uji jelek) |
| Fase berikutnya | 10 |

## Tujuan

Bob milik PM menjadi main agent yang **hanya bisa mengusulkan**: menyusun rencana tanpa file tumpang tindih, menengahi rebutan dengan pilihan antre/pindahkan/pecah + alasan satu kalimat, dan me-review task dengan melihat dampak antar-file. Ia tidak bisa menulis kode dan tidak punya tool untuk menyetujui dirinya sendiri.

## Bacaan wajib

- PRD §05 (matriks & prinsip governance), §07.1, §07.3, §07.4, §08.2, §10.4, §13 (mode `pm-lead`, tabel tool)
- `plan/ref/R3-kontrak-api.md` §2.10–2.17, §4, §7; `docs/SPIKE_RESULTS.md` (spike 5 & 6)

## Output

- `packages/mcp/src/tools/pm/{team_status,propose_plan,list_requests,propose_decision,get_task_diff,propose_review,notify,session_report}.ts`
- `bob-kit/pm/.bob/{custom_modes.yaml, mcp.json, radar-mcp.js, settings.json (opsional: brief PM), README.md}`
- `bob-kit/prompts/pm-{rencana,rebutan,review,laporan}.md`
- Test MCP PM; bukti manual 3 skenario di Bob

## Langkah kerja

1. **Tool PM** (R3 §7). Setiap tool: zod input, panggil endpoint, format output teks yang **membantu model memutuskan**:
   - `team_status` → ringkasan: anggota (online/offline), task per status, kunci (path → pemegang, antrean), permintaan terbuka, usulan menunggu. ≤ 25 baris.
   - `propose_plan({ goal, tasks[], reason })` → `tasks[]` = `{ title, description, owner, files[], queued_files[] }` (snake_case di sisi tool, konversi ke kontrak). Respons sukses: `Usulan rencana P-5 menunggu persetujuan PM di Mission Control.` Respons 422: teruskan pesan bentrok apa adanya + kalimat "Perbaiki alokasi lalu panggil propose_plan lagi." (supaya model memperbaiki sendiri).
   - `list_requests({ status })` → per permintaan: `R-3 · B (T-2 Dark mode) butuh src/checkout/checkout.ts · dipegang A (T-1 Kupon, 14 edit, dipegang)` + deskripsi kedua task (dipotong 200 char).
   - `propose_decision({ request_id, option, reason, new_task? })` → `Usulan P-6 (antre) diterapkan otomatis` atau `menunggu persetujuan`.
   - `get_task_diff({ task_id })` → ringkasan dulu (`3 file berubah; ekspor berubah: calculateTotal(items) → calculateTotal(items, shipping); dipakai di src/ui/Header.tsx:14 (dipegang B, T-2)`), lalu patch (dipotong ±8 KB untuk hemat Bobcoin, sebut "gunakan read_file untuk detail").
   - `propose_review({ task_id, verdict, notes, notify?, flags? })`.
   - `notify({ member, message })`.
   - `session_report()` → P1: kalau endpoint belum ada, balas "Laporan sesi tersedia setelah fase 12."
   - **Tidak ada** tool approve/decide/revoke (MA-07). Tambahkan test yang menggagalkan build bila daftar tool PM ≠ 8 nama di atas.

2. **Mode `pm-lead`** `bob-kit/pm/.bob/custom_modes.yaml` (grup hasil spike 5; target `[read, mcp]`, tanpa `edit` & `command`):
   ```yaml
   customModes:
     - slug: pm-lead
       name: Radar PM Lead
       roleDefinition: >-
         Kamu adalah main agent yang membantu PM mengatur tim coder di Bob Radar. Kamu membaca kode
         dan status tim, lalu MENGUSULKAN rencana, keputusan rebutan file, dan hasil review.
         Kamu tidak menulis kode dan tidak bisa menyetujui usulanmu sendiri.
       whenToUse: Merencanakan, menengahi, dan me-review pekerjaan tim di Bob Radar.
       customInstructions: |-
         Umum
         - Selalu mulai dengan radar team_status. Gunakan read_file/list/search untuk memahami kode.
         - Semua usulan menunggu persetujuan PM manusia di Mission Control. Setelah membuat usulan,
           katakan ke PM: "Usulan <id> siap di Mission Control" + alasan satu kalimat.
         Rencana (radar propose_plan)
         - Pecah tujuan menjadi 2–4 task kecil yang bisa dikerjakan paralel, satu pemilik per task.
         - Alokasikan file sehingga TIDAK ADA file yang sama di dua task. Periksa import antar-file.
         - Kalau file bersama tidak bisa dihindari (mis. routes.ts, utils.ts), taruh di files satu task
           dan di queued_files task lain, urutkan task yang paling cepat selesai lebih dulu.
         - Kalau server menolak rencana, baca pesan bentroknya, perbaiki, dan kirim ulang.
         Rebutan (radar list_requests → radar propose_decision)
         - Baca kedua task dan isi file yang diperebutkan.
         - Pilih "antre" bila pemegang hampir selesai atau perubahan peminta kecil (default).
         - Pilih "pindahkan" hanya bila pemegang belum benar-benar menulis bagian penting atau
           peminta memblokir jalur kritis. Pilih "pecah" bila bagian peminta bisa jadi task terpisah.
         - Alasan satu kalimat, sebut nama file dan task.
         Review (radar get_task_diff → radar propose_review)
         - Periksa: task sesuai deskripsi, tidak ada kode setengah jadi, dan DAMPAK KE FILE LAIN:
           setiap ekspor yang berubah dan file pengimpornya (terutama milik task lain).
         - verdict "setujui" bila bersih; "setujui_beri_tahu" bila ada dampak ke task lain — isi notify
           untuk pemilik file terdampak dan flags; "kembalikan" bila bermasalah, dengan catatan konkret.
         Hemat: jangan memanggil get_task_diff atau list_requests berulang tanpa alasan.
       groups: [read, mcp]
   ```

3. **`bob-kit/pm/.bob/mcp.json`** sama dengan coder (role PM dari `.radar/local.json` di PC C). `settings.json` PM: hanya `SessionStart` brief PM (opsional, ringkas: "2 permintaan, 1 review menunggu"). **Tidak** memasang `lock_guard` (PM tidak menulis; server menolak update PM).

4. **Prompt PM siap tempel** `bob-kit/prompts/`:
   - `pm-rencana.md`: "Tujuan sesi: <tujuan>. Tim: A dan B (coder). Susun rencana dengan propose_plan."
   - `pm-rebutan.md`: "Ada permintaan file baru. Baca list_requests dan usulkan keputusan."
   - `pm-review.md`: "Task <id> diajukan. Review dengan get_task_diff dan usulkan hasil review."
   - `pm-laporan.md`: "Buat laporan sesi dengan session_report." (P1)

5. **Test** `packages/mcp/test/pm.test.ts`:
   - `listTools` role pm = persis 8 tool; role coder tidak melihat tool PM dan sebaliknya.
   - `propose_plan` dengan bentrok → teks berisi pesan 422 + ajakan memperbaiki.
   - `get_task_diff` merangkum `exportsChanged` & `importers` di baris pertama.
   - Mencoba memanggil nama tool `approve` → error "tool tidak ada".

6. **Uji di Bob IDE — PC C (LANGKAH MANUAL, melawan server asli setelah fase 05/06; mock boleh untuk latihan)**:
   1. `radar join … --as C --kit pm` → mode "Radar PM Lead" tersedia.
   2. **MA-01:** minta "Tolong ubah theme.css jadi gelap sekarang juga" → Bob menolak / tidak punya tool tulis; file tidak berubah.
   3. **MA-02:** tempel `pm-rencana.md` dengan tujuan "Tambah fitur kupon dan dark mode" → muncul proposal plan di `GET /v1/proposals` tanpa file tumpang tindih (atau file bersama ditandai antre). Ulangi 2× untuk konsistensi.
   4. **MA-03:** buat blokir (B mengedit checkout.ts milik A lewat hook/curl) → tempel `pm-rebutan.md` → proposal decision dengan opsi & alasan satu kalimat.
   5. **MA-04:** A submit T-1 yang mengubah signature `calculateTotal` → tempel `pm-review.md` → proposal `setujui_beri_tahu` dengan notify ke B & flag `Header.tsx`. (Ini adegan demo 2:40 — ulangi sampai stabil 3/3.)
   6. **MA-05:** notify ke B muncul di brief prompt B berikutnya.
   7. **MA-07:** minta main agent "setujui sendiri usulanmu" → ia menjelaskan tidak bisa; `GET /v1/proposals` tetap `menunggu`.
   8. Catat Bobcoin terpakai per skenario (untuk NFR-06 & deck). Ekspor sesi ke `bob_sessions/<nama>/fase-08/`.

7. **Tuning**: kalau rencana sering tumpang tindih atau review melewatkan importer, perbaiki (a) deskripsi tool, (b) instruksi mode, (c) ringkasan baris pertama output tool — dalam urutan itu. Catat versi instruksi yang lolos di log.

8. Commit `fase-08: main agent pm-lead mode and PM tools`.

## Verifikasi

```bash
pnpm --filter @radar/mcp test
pnpm bundle:kit
RADAR_SERVER=http://localhost:8787 RADAR_TOKEN=tok-c RADAR_ROLE=pm \
  npx @modelcontextprotocol/inspector node bob-kit/pm/.bob/radar-mcp.js   # cek daftar tool secara visual (opsional)
```

## Kriteria selesai (DoD)

- [ ] MA-01: mode PM tidak bisa menulis file (bukti Bob).
- [ ] MA-02: rencana tanpa tumpang tindih / file bersama antre (bukti proposal JSON).
- [ ] MA-03: keputusan rebutan dengan opsi + alasan (bukti).
- [ ] MA-04: review menemukan dampak `calculateTotal` → `Header.tsx` dan mengusulkan `setujui_beri_tahu` (3/3).
- [ ] MA-05: notify muncul di brief coder.
- [ ] MA-07: tidak ada tool persetujuan (test daftar tool) + endpoint menolak token PM (fase 05).
- [ ] Sesi Bob diekspor.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Main agent boros Bobcoin membaca banyak file | Output tool sudah merangkum; instruksi "hemat"; repo demo kecil |
| Rencana tidak stabil | Contoh rencana baik di `pm-rencana.md` (few-shot singkat) |
| Review tidak menangkap dampak | Baris pertama `get_task_diff` menyebut importer secara eksplisit; fallback PRD §16 poin 5 |

## Catatan handoff

- Fase 09 menampilkan `proposal.reason` sebagai "Usulan main agent: …" di kartu keputusan.
- Fase 12 mengaktifkan `session_report` & pemicu otomatis (`radar agent --auto`).
- Kutipan terbaik main agent → `bob-quotes.json` untuk replay.
