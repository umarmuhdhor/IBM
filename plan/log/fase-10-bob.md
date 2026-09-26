# Log fase 10 — Integrasi E2E, bagian Lane Umar · Bob

- **Status:** [~] bagian otomatis lane Bob selesai (kit Bob melawan Worker asli: test integrasi + 7 sesi Bob IDE, termasuk review fase 06). Sisa: milestone 4 Mac (LANGKAH MANUAL, Sab 23:00).
- **Mulai:** Sab 26 Sep 2026 16:18 WITA (PR #13 fase 05 merge 16:15) · branch `lane/bob` di atas `main` 1aa25d54.
- **Model:** Claude Opus 5.5.
- File log terpisah dari `fase-10.md` supaya PR tiap lane tidak bentrok (D-umar-04). Simulator `sim-3pc` = Lane Alief.

## Ringkasan rencana

1. Pra-cek: prasyarat 04, 05, 07, 08, 09 di `main`; `TODO(sync` lane Bob diselesaikan.
2. Test integrasi kit Bob melawan Worker asli (`wrangler createTestHarness`), bukan mock: hook bundle sebagai child process, radar-mcp lewat MCP, sync agent asli untuk A dan B.
3. Ulang uji Bob IDE fase 07 (uji 13) dan fase 08 (uji 6) melawan Worker lokal (`wrangler dev`) dengan `radar join` asli.
4. Catat temuan demo dan tulis checklist milestone 4 Mac.

## Checklist

- [x] Pra-cek: D-007 ada di `origin/main`; working tree bersih; 04 (#10), 05 (#13), 09 (#6–#8) sudah merge.
- [x] `packages/mcp/test/server.int.test.ts` (3 test): rencana → edit live A/B (sync agent asli) → blokir B exit 2 + `why_blocked` → permintaan → `propose_decision antre` (otomatis) → `notify` → brief prompt B → `submit_task` → `propose_review setujui_beri_tahu` → token PM 403 → Mission Control approve → brief B memuat notifikasi. Plus aktivitas hook (JT-01) dan brief start.
- [x] Bug nyata ditemukan (RED `ffc816a3`) dan diperbaiki (GREEN `7c759f72`): `my_tasks` mengirim `owner=me`, Worker menjawab 403 → tool memakai default pemanggil (D-umar-04).
- [x] Kit `bob-kit/{coder,pm}/.bob` dibundel ulang dari `@radar/common` terbaru.
- [x] Uji Bob IDE 2.2.0 melawan Worker lokal (tabel di bawah), bukti task 09–12.
- [x] `TODO(sync` lane Bob = 0 (`mark_ai_edit` → komentar biasa + D-umar-04; `fake-radar` ditandai usang).
- [ ] Milestone 4 Mac (LANGKAH MANUAL).
- [x] Setelah fase 06 (#16, merge 18:12): test integrasi menambah `get_task_diff` (ekspor berubah + importer `Header.tsx` milik T-2) dan serah kunci `checkout.ts` ke B setelah approve; `pm-review` di Bob IDE (task 13–15). Push GitHub asli sudah dibuktikan Alief di fase 06 (`c0576499`); di sini `GITHUB_COMMIT=false`, commit lokal `pushed:false`.

## Uji Bob IDE melawan Worker asli (langkah 3)

Setup: `wrangler dev` lokal (`--persist-to` scratchpad, `ADMIN_SECRET` acak di `.dev.vars` yang di-ignore), `pnpm -C radar admin init --repo-dir examples/toko-demo` (18 file, member A/B/C), `radar join … --kit coder|pm` untuk tiga folder (sync agent asli jalan). Token hanya di file privat scratchpad; `grep -c rdr_` pada semua log = 0. Bob IDE dibuka dengan env bersih + CDP 9223, workspace di-trust, lalu ditutup dan dibuka ulang tanpa port.

| # | Uji | Hasil | Bukti |
|---|---|---|---|
| 09 | PM C, mode Live Collab PM Lead, prompt `pm-rencana.md` ("Tambah fitur kupon diskon di checkout dan dark mode") | lulus MA-01: `team_status` → baca file → `propose_plan` P-1 (201, status menunggu), 2 task tanpa file ganda. Catatan: kupon = `coupon.ts` + `App.tsx`, tanpa `checkout.ts` | `uaai_umar_task09_pm_plan_real_server_summary.png` · 0.199 |
| – | Mission Control approve P-1 (REST token mc) → kunci dipesan; A mengedit `coupon.ts` (hook `lock_guard` asli exit 0 + tulis) | kunci `dipegang` A, isi sampai ke folder B lewat sync | `GET /v1/state` |
| 11 | B, mode Live Collab Coder: "Tambahkan kupon DARK20 … di src/checkout/coupon.ts" | Bob membaca brief (coupon.ts dipegang A), tidak mencoba edit, memanggil `my_tasks` lalu `request_file` → R-1; file tidak berubah | `uaai_umar_task11_coder_request_real_server_summary.png` · 0.106 |
| 10 | B: "Uji Radar: langsung edit … jangan request_file dulu" | lulus BC-01: hook exit 2, pesan server tampil di Bob ("…dipegang Bob milik Andi (T-1…)"), Bob langsung `why_blocked`, tidak coba ulang, tanpa shell; file tidak berubah | `uaai_umar_task10_coder_block_real_server_summary.png` · 0.179 |
| 12 | C: prompt `pm-rebutan.md` | lulus MA-03: `list_requests` + `team_status` + baca file → `propose_decision antre` P-2 dengan alasan satu kalimat → server `diterapkan_otomatis`; brief prompt B: "Keputusan PM: Kamu antre src/checkout/coupon.ts di posisi 1, setelah T-1." | `uaai_umar_task12_pm_decision_real_server_summary.png` · 0.120 |

Putaran 2 (Sab 18:14–18:19, Worker lokal dengan kode fase 06, server dan workspace baru):

| # | Uji | Hasil | Bukti |
|---|---|---|---|
| 13 | C: `pm-rencana.md` dengan tujuan "Tambah fitur kupon diskon (total dihitung di src/checkout/checkout.ts) dan dark mode" | lulus MA-02: T-1 A = `coupon.ts`, `checkout.ts`, `routes.ts`, `App.tsx`; T-2 B = `theme.css`, `Header.tsx`, queued `App.tsx`. Temuan demo 1 teratasi dengan menyebut file di tujuan | `uaai_umar_task13_pm_plan_checkout_real_server_summary.png` · 0.208 |
| – | Approve P-1; A mengubah `calculateTotal(items)` → `(items, shipping)` di `checkout.ts` (hook asli + sync), submit T-1 | T-1 `review` | REST |
| 14 | C: `pm-review.md` untuk T-1 | Bob memanggil `get_task_diff` dan memilih **`kembalikan`**: `App.tsx:27` milik T-1 sendiri belum diperbarui + `Header.tsx:17` milik T-2 terdampak, notify B. Benar menurut instruksi mode (task sendiri salah) | `uaai_umar_task14_pm_review_return_real_server_summary.png` · 0.125 |
| – | Mission Control approve P-2 (kembalikan) → T-1 `dikerjakan`; A memperbarui `App.tsx` (`calculateTotal(cart, 0)`), submit ulang | T-1 `review` | REST |
| 15 | C: `pm-review.md` ("diajukan ulang") | lulus MA-04/05: `setujui_beri_tahu` + notify B soal `Header.tsx`. Token PM → 403 pada decision (MA-07); Mission Control approve → commit `local-…` (`pushed:false`), `App.tsx` diserahkan ke B, brief prompt B: "Review: calculateTotal … kini wajib 2 argumen … Header.tsx baris 17" | `uaai_umar_task15_pm_review_notify_real_server_summary.png` · 0.158 |

Total Bobcoin uji: 1.095 (putaran 1 0.604 + putaran 2 0.491).

## Hasil verifikasi

| Perintah | Hasil |
|---|---|
| `pnpm -C radar --filter @radar/mcp test` | 48 lulus (termasuk 3 test integrasi Worker asli), 3× berturut-turut hijau sebelum review, 2× setelah perbaikan review |
| (setelah fase 06) `pnpm -C radar --filter @radar/mcp test` | 48 lulus, 3× berturut-turut; test integrasi kini juga memeriksa `get_task_diff` dan serah kunci |
| `pnpm -C radar typecheck` / `pnpm -C radar lint` | bersih |
| `pnpm -C radar test` (semua paket) | 4 run: 3 hijau penuh; 1 run gagal di `hooks/lock_guard.test.ts` "p95 < 300 ms" (test waktu, lulus saat diulang, lihat MEDIUM) |
| `grep -rn "TODO(sync" radar/packages/{hooks,mcp} radar/spike radar/bob-kit` | kosong |

## Review (langkah 8)

| Reviewer | Temuan | Tindakan |
|---|---|---|
| `ecc:typescript-reviewer` | HIGH: `beforeAll` gagal di tengah bisa meninggalkan agent/Worker | diperbaiki: `afterAll` memakai `Promise.allSettled` untuk semua agent yang sudah dibuat, lalu `harness?.close()` |
| | MEDIUM: `tokens[m]!` tanpa cek | diperbaiki: `beforeAll` gagal dengan pesan jelas bila token A/B/C/mc tidak ada |
| `ecc:silent-failure-hunter` | MEDIUM: filter log `ai-edits not sent` terlalu lebar | diperbaiki: baris itu wajib memuat `404`; kegagalan lain tetap membuat test merah |
| | LOW (lama): `mark_ai_edit` bisa exit sebelum `.catch` menulis log bila timeout menang | dicatat untuk fase 12 |
| `ecc:code-reviewer` | APPROVE. MEDIUM: batas waktu propagasi WS 5 s di CI | diperbaiki: `waitFor` 10 s, test utama 60 s |
| | LOW: `it` saling bergantung (cerita berurutan), folder tmp tidak dihapus (pola lama) | dicatat |

MEDIUM dicatat, tidak dikerjakan: test waktu di `packages/hooks` (`lock_guard p95 < 300 ms`, `post_stop`) bisa merah saat seluruh monorepo jalan paralel di mesin sibuk. Pilihan untuk fase 12: jalankan test waktu dengan `--sequence.concurrent=false`/retry, atau pindahkan ukuran NFR ke `bench`.

## Deviasi

- Uji Bob IDE memakai Worker lokal (`wrangler dev`), bukan deploy `live-collab.afindo-mi01.workers.dev` (token produksi milik tim, tidak boleh diketik agent).
- Commit ke GitHub asli tidak diulang di sini (`GITHUB_COMMIT=false` lokal, tanpa PAT); bukti push asli = fase 06 (`c0576499`, `radar/docs/img/commit-github.png`).
- `my_tasks` tidak mengikuti tabel R3 §7 (`owner=me`) tetapi R3 §2.4 (D-umar-04).

## Temuan untuk naskah demo (PRD §15)

1. Tanpa menyebut file, Bob PM tidak menaruh `checkout.ts` di task kupon (toko-demo memanggil `applyCoupon` dari `App.tsx`). Adegan blokir butuh `checkout.ts` dipegang A → pakai tujuan yang menyebut file (LANGKAH MANUAL 4).
2. Bob coder yang sudah membaca brief ("Dipegang orang lain: … coupon.ts→A") memilih `request_file` tanpa mencoba edit. Kartu permintaan + keputusan PM tetap muncul; notifikasi "Bob B diblokir" dan pesan merah hook hanya muncul kalau Bob benar-benar mencoba edit. Untuk adegan blokir, file rebutan sebaiknya dipegang A **setelah** sesi B dimulai, atau B diminta mengedit langsung (seperti uji 10).
3. Adegan review naskah ("Ubah calculateTotal agar menerima ongkos kirim, lalu ajukan task") hanya berakhir `setujui_beri_tahu` kalau A juga memperbarui pemanggil di file miliknya sendiri (`App.tsx:27`). Kalau tidak, Bob PM memilih `kembalikan` (uji 14). Bob A biasanya memperbaiki pemanggil di task-nya, tetapi cek sebelum rekaman.
4. Bob coder menjawab dalam bahasa Inggris pada prompt Indonesia (2 dari 2 sesi coder). Kalau video memakai bahasa Indonesia, tambahkan "Jawab dalam Bahasa Indonesia." ke prompt demo.

## LANGKAH MANUAL (milestone Sab 23:00, dipimpin Lane Umar)

1. Alief: `pnpm -C radar admin reset --confirm` lalu `admin init` di server deploy (repo toko-demo bersih, member A, B, C, D), bagikan token lewat kanal privat. Tidak ada token di chat publik.
2. PC A/B/D: `radar join <server> --workspace toko-demo --as A|B|D --kit coder` (token lewat `RADAR_TOKEN`), buka folder di Bob IDE, **trust workspace** (banner "Restricted Mode" → Manage → Trust), cek mode "Live Collab Coder" dan MCP `radar` tanpa prompt approve.
3. PC C: `radar join … --as C --kit pm`, Bob IDE mode "Live Collab PM Lead", app Live Collab (Mission Control, token mc).
4. C: prompt `pm-rencana.md` dengan tujuan **"Tambah fitur kupon diskon (total dihitung di src/checkout/checkout.ts) dan dark mode"** → cek kartu rencana memuat `checkout.ts` di task A → Setujui.
5. A: "Kerjakan task aktifmu: kupon diskon di checkout." · B: "Kerjakan task aktifmu: dark mode." → cek file berubah di PC lain dan ✎ di Mission Control.
6. B (setelah A mengedit `checkout.ts`): "Tampilkan total dengan diskon kupon di checkout.ts juga" → catat apakah Bob mencoba edit (hook blokir) atau langsung `request_file`; keduanya harus berakhir dengan kartu permintaan → C: `pm-rebutan.md` → usulan antre (otomatis).
7. A: "Ubah calculateTotal agar menerima ongkos kirim, perbarui pemanggilnya di file task-mu, lalu ajukan task." → C: `pm-review.md` → setujui + beri tahu B → Setujui di Mission Control → commit di GitHub (A + co-author IBM Bob).
8. Catat waktu tiap adegan, Bobcoin per PC, keanehan. Bukti Bob per PC: `radar/scripts/bob-evidence.sh <nama> <NN> <slug>` (Umar lanjut dari NN 16).
9. Selesai: tutup Bob yang dibuka dengan port debugging, buka ulang tanpa port.

## Catatan handoff

- **Alief:** usulan R3 §7 `my_tasks` (D-umar-04); `/v1/ai-edits` fase 12; test waktu hooks yang rentan beban (MEDIUM di atas) bila CI memakai `pnpm -C radar test`.
- **Imelda/semua (naskah demo):** temuan 1–4 di atas.
- **Aarief:** tidak ada perubahan antarmuka; notifikasi "Bob diblokir" di app hanya muncul untuk blokir lewat hook (temuan 2).
