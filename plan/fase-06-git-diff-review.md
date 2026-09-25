# Fase 06 — Commit per task lewat GitHub Git Data API, diff task, analisis dampak (relay terminal P1)

| Field | Nilai |
|---|---|
| Jalur | **Lane Alief** (Alief) · branch `lane/core` |
| Slot WITA | Sab 26 Sep 17:30 – 21:00 (sebelum fase 10 integrasi 21:00) |
| Estimasi | 3 jam |
| Prasyarat | 05 |
| Requirement PRD | SV-07, MA-04 (sisi server: `get_task_diff` + importer), §07.4, NFR-09 · P1 bila waktu ada: JT-04 + NFR-12 (relay terminal) |
| Model | **Opus 5.5** · effort high (alt: Sonnet 5 · high) |
| Bob slice | **A3**: formatter pesan commit per task + trailer (`services/git-message.ts`) · **A4**: `/review` Bob (mode Ask) atas `locks.ts` vs R4. Bukti `03-commit-format`, `04-locks-review`. |
| Fase berikutnya | 10 (integrasi, Sab 21:00) |

## Tujuan

Saat PM menyetujui review, server meng-commit **hanya file milik task itu** ke repo `toko-demo` dengan author coder, trailer `Co-authored-by: IBM Bob`, `Radar-Task`, `Reviewed-by`, langsung ke GitHub lewat **GitHub REST API** (Git Data API), karena Durable Object tidak bisa menjalankan binary `git`. Dan main agent bisa melihat diff task beserta file lain yang memakai simbol yang berubah — inilah yang membuat review menangkap "calculateTotal() berubah, Header.tsx milik B terdampak" (PRD §15 menit 2:40).

## Bacaan wajib

- PRD §07.4, §15 (adegan Review), §18 risiko pertama
- `plan/ref/R4-mesin-kunci.md` §6.3, `plan/ref/R3-kontrak-api.md` §2.15, §5 (`commit.*`), `plan/ref/R5-konvensi.md` §3 (format commit server)

## Output

- `packages/server/src/services/github.ts` (`GitHubCommitter`), `services/git-message.ts`, `services/diff.ts`, route `GET /v1/tasks/:id/diff`
- Test dengan GitHub API di-mock (`@msw/cloudflare` + `msw`, handler di `test/github-mock.ts`; `fetchMock` sudah dihapus dari `cloudflare:test`)

## Langkah kerja

1. **`GitHubCommitter`** (`services/github.ts`, `fetch` langsung ke `https://api.github.com` dengan header `authorization: Bearer ${env.GITHUB_TOKEN}`, `user-agent: live-collab`, repo `GITHUB_REPO`). Ganti stub fase 05. Tidak ada binary `git`, tidak ada working copy, tidak ada `@octokit/rest`.
   - `commitTask(snapshot, reviewer): Promise<{ sha, empty }>` menerima snapshot dari Tx1 R4 §6.3 (path, isi `task_touch.last_version`, status deleted, `meta.head_commit`), lalu memanggil Git Data API:
     1. **Tanpa POST blob.** Semua file workspace berupa teks UTF-8 (file biner diabaikan, R5 §6), jadi isi file dikirim inline lewat field `content` di entri tree. Path yang dihapus: entri tree dengan `sha: null` (GitHub menolak kalau path itu tidak ada di `base_tree`, jadi hanya kirim hapus untuk path yang ada di head).
     2. `GET /git/commits/{head_commit}` → `baseTree`, lalu `POST /git/trees {base_tree: baseTree, tree:[{path, mode:"100644", type:"blob", content}]}`. Hanya path milik task, **tidak** ada file lain.
     3. `POST /git/commits {message, tree, parents:[head_commit], author:{name: git_name, email: git_email, date}, committer:{name:"Live Collab", email:"live-collab@users.noreply.github.com", date}}`. Pesan mengikuti R5 §3:
        ```text
        T-1: Kupon diskon

        <submit_summary>

        Radar-Task: T-1
        Reviewed-by: Citra (PM) <citra@example.com>
        Co-authored-by: IBM Bob <bob@ibm.com>
        ```
        Tambahkan `Radar-Main-Agent-Proposal: P-7` untuk jejak audit (NFR-09). Format pesan ini adalah **Bob slice A3** (`services/git-message.ts`).
     4. `PATCH /git/refs/heads/<branch> {sha: newCommit, force:false}`. `409` atau `422` (docs Update ref mendaftar keduanya; pesan "not a fast forward" hanya dikenal dari laporan komunitas) → lempar `NonFastForwardError` dengan `status` + `message` asli. `403`/`429` dengan header `retry-after` → `RateLimitError` (secondary rate limit).
     Kalau tree baru sama dengan `baseTree`, lewati langkah 3–4 dan kembalikan `{ sha: head_commit, empty: true }`.
   - Subrequest tetap **4** berapa pun jumlah file (GET commit, POST tree, POST commit, PATCH ref), jauh di bawah batas 50 subrequest plan Free. Batas payload: task > 100 file atau total isi > 5 MB ditolak sebelum I/O dengan `commit.push_failed { error: "too_many_files" }` (kode error tetap, batas baru).
   - `GITHUB_COMMIT=false` (dev/test tanpa mock GitHub) → kembalikan sha deterministik `local-<hash>` tanpa memanggil GitHub.
   - Token GitHub hanya di `env.GITHUB_TOKEN` (secret). Tidak pernah di event, log, pesan error, atau respons. Error GitHub dicatat hanya `status` + `message` dari body.

2. **Integrasi ke keputusan review** (kerangka dua transaksi sudah ada dari fase 05, R4 §6.3):
   - Sukses → Tx2 validasi ulang lalu finalisasi: `review.commit_sha`, `task.commit_sha`, task `selesai`, `releaseTaskLocks`, `meta.head_commit = sha`, proposal `disetujui`, event `commit.created {pushed: true, url: https://github.com/{o}/{r}/commit/{sha}}` + `task.status`.
   - Gagal (jaringan, 5xx, `NonFastForwardError`, `too_many_files`) → transaksi yang mengosongkan `commit_started_at`, event `commit.push_failed {error}`. Proposal **tetap `menunggu`**, task tetap `review`, kunci tetap. Tidak ada retry otomatis.
   - Tombol "Coba lagi" di MC = kirim ulang `POST /v1/proposals/:id/decision {approve:true}` (tidak ada endpoint baru). Untuk kasus non-fast-forward, sebelum Tx1 berikutnya `GET /git/ref/heads/<branch>` dan perbarui `meta.head_commit`, supaya commit dibuat di atas head terbaru.
   - Batas GitHub: 5.000 request/jam per token; secondary limit 100 request konkuren, 80 request pembuat konten per menit dan 500 per jam. Satu commit = 4 request (2 pembuat konten: tree, commit), jauh di bawah batas. Kena secondary limit → `commit.push_failed { error: "rate_limited" }`, tanpa retry otomatis.

3. **`base_commit`**: diisi `meta.head_commit` saat task dibuat (fase 05 sudah). Diff task memakai `task_touch.first_version` (isi sebelum task menyentuh) — lebih akurat dari `base_commit` karena task lain bisa sudah commit di antaranya. Simpan keduanya di respons.

4. **`diff.ts` → `GET /v1/tasks/:id/diff`** (pm & mc):
   1. Untuk setiap `task_touch`: `before = file_version(path, first_version)` (kosong kalau 0), `after = file` terkini. `change` = `added|modified|deleted`. `patch = createTwoFilesPatch('a/'+path, 'b/'+path, before, after, '', '', { context: 3 })`.
   2. **Ekspor yang berubah** (`exportsChanged`) untuk `.ts/.tsx/.js/.jsx`: regex per baris pada before & after:
      - `export (async )?function (\w+)\s*\(([^)]*)\)` → signature
      - `export const (\w+)\s*=\s*(async )?\(([^)]*)\)\s*(:[^=]+)?=>` → signature
      - `export (class|interface|type|enum) (\w+)`
      - `export default function (\w+)?`
      Bandingkan peta nama → signature: tambah/hapus/berubah signature.
   3. **Importer**: pindai semua file teks di tabel `file` (tidak deleted, ekstensi JS/TS/CSS) untuk pernyataan `import … from '<spec>'`, `import('<spec>')`, `require('<spec>')`, `export … from '<spec>'`, CSS `@import '<spec>'`. Resolusi spec relatif terhadap direktori importer dengan kandidat `['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '.css']`. Kalau spec memakai alias (mis. `@/`), coba `tsconfig.json` `paths` sederhana (satu tingkat); kalau gagal, lewati.
      Untuk setiap importer dari file yang berubah: kumpulkan simbol yang diimpor (`import { a, b as c }` → `a`, `b`), cari baris pemakaian simbol yang ada di `exportsChanged` (regex `\bname\s*\(`) → `lines`. Sertakan `holder` kunci importer (member & task) bila ada.
   4. Batasi total patch 60 KB (`truncated`). Waktu target < 200 ms untuk repo demo.
   5. Kembalikan bentuk R3 §2.15.

5. **Test** (`test/github.test.ts`, `services/diff.test.ts`) dengan `@msw/cloudflare` (`network.use(http.get/post/patch('https://api.github.com/repos/:o/:r/git/...'))`) yang meniru endpoint Git Data API dan menyimpan tree/commit di memori:
   - Approve review T-1 → entri tree (dengan `content` inline) hanya untuk path T-1, tidak ada panggilan `POST /git/blobs`, commit dengan author Alice dan 3 trailer. File milik T-2 yang sedang dikerjakan **tidak** ikut.
   - File dihapus dalam task → entri tree `sha: null`, tanpa `content`.
   - Dua task disetujui berurutan → dua commit terpisah dengan parent berantai, sha di `task.commit_sha`.
   - Approve T-2 saat commit T-1 masih menunggu `fetch` (mock ditahan dengan promise) → 409; B menulis file T-1 saat itu → `committing`.
   - `PATCH ref` 422 dan (terpisah) 409 → `commit.push_failed`, proposal tetap `menunggu`, kunci tetap; approve ulang setelah head diperbarui → sukses.
   - `POST /git/trees` 403 + `retry-after` → `commit.push_failed { error: "rate_limited" }`.
   - 5xx → `commit.push_failed`, `commit_started_at` kosong lagi, task tetap `review`.
   - DO restart di tengah commit (R4 §6.3 poin 5): isi `commit_started_at` = `now - 61 s` lalu buat ulang DO → constructor mengosongkan klaim + `commit.push_failed { error: "claim_expired" }`; B bisa menulis file T-1 lagi (bukan `committing`), dan approve ulang T-1 sukses. Klaim berumur 30 s tetap memblokir (`409`, `committing`).
   - 101 file (atau total > 5 MB) → `too_many_files` tanpa satu pun panggilan `fetch`; 60 file → sukses dengan tepat 4 request.
   - Task tanpa perubahan nyata → `empty: true`.
   - Diff: `calculateTotal(items)` → `calculateTotal(items, shipping)` di `checkout.ts`, dan `Header.tsx` mengimpornya → `exportsChanged[calculateTotal]` + `importers[Header.tsx].lines` benar.
   - Tidak ada `GITHUB_TOKEN` di event, log, atau respons (grep hasil test).

6. **Uji manual ke GitHub nyata** (LANGKAH MANUAL): dengan Worker ter-deploy + secret `GITHUB_TOKEN`, jalankan skenario singkat lewat `curl` (rencana → edit via sync → submit → proposal review → approve dengan token mc) dan pastikan commit muncul di GitHub atas nama coder dengan co-author IBM Bob (GitHub menampilkan avatar ganda bila email co-author dikenali). Screenshot → `docs/img/commit-github.png`.

7. Commit `fase-06: GitHub API committer, task diff, impact analysis`.

## Bagian P1 — relay terminal (JT-04)

`POST /v1/bob/activity` sudah dibangun di fase 03. Relay terminal `term.*` adalah **P1**: kerjakan hanya setelah semua P0 fase ini hijau, atau pindahkan ke fase 12.

1. `services/terminals.ts`: registry `termId → {owner, title, agent, viewers:Set, ring: RingBuffer(262144), grant?}`. Hanya pemilik (`principal.member === owner`) yang boleh `share/unshare/frame/snapshot/resize/grant/revoke`. Penonton harus anggota workspace yang sama.
2. Hub WS: routing pesan sesuai R3 §3.9. `term.subscribe` → kirim isi ring buffer, lalu minta `term.need_snapshot` ke host. Host putus → `term.ended {reason:"host_offline"}`.
3. Batas: frame > 32 KB ditolak (`TERM_FRAME_TOO_LARGE`), dan maks 60 frame/detik per terminal (sisanya digabung/dibuang dengan log).
4. `RECORD_TERMINALS=true` → frame disimpan ke tabel `term_frame` (tambahkan ke R2 lewat contract PR). Gabung frame per terminal menjadi satu baris per ±1 s (maks 256 KB per baris), bukan satu baris per frame: 60 frame/s akan menghabiskan kuota 100k rows written/hari plan Free dalam < 30 menit. `GET /v1/events/export?withTerminals=true` menyertakan frame.
5. Event log: `term.shared`, `term.unshared`, `term.viewer.joined/left`, `term.input.granted/revoked` (tanpa isi frame).
6. Test integrasi: host + 2 penonton (klien `ws`), urutan `seq` terjaga, penonton terlambat menerima ring, non-anggota ditolak, input tanpa grant ditolak (P1).
7. Metrik `term.latency` di event `metric`.
8. `security-reviewer` wajib untuk bagian ini.

## Verifikasi

```bash
pnpm -C radar --filter @radar/server test
pnpm -C radar deploy:server
curl -s $S/v1/tasks/T-1/diff -H "authorization: Bearer $TOK_C" | jq '.importers'
```

## Kriteria selesai (DoD)

- [ ] SV-07: commit per task berisi author coder + 3 trailer + hanya file task; push ke GitHub terbukti (screenshot).
- [ ] MA-04 sisi server: diff + `exportsChanged` + `importers` benar untuk skenario `calculateTotal`.
- [ ] Kegagalan push tidak merusak state (proposal `menunggu`, kunci tetap, klaim dilepas); approve ulang berfungsi.
- [ ] Tidak ada token GitHub di event, respons, atau log (`npx wrangler tail` selama uji manual, grep `ghp_`/`github_pat_`).

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Regex ekspor meleset pada sintaks kompleks | Cukup untuk repo demo; dokumentasikan batasan. Fallback terakhir (PRD §16 poin 5): review diringkas jadi diff saja |
| GitHub menolak push (proteksi branch) | Nonaktifkan proteksi di `toko-demo` atau push ke branch `radar/main` lalu tampilkan link |
| Email co-author IBM Bob tidak dikenali GitHub | Tetap valid sebagai trailer; konfirmasi alamat resmi di kickoff (env `BOB_COAUTHOR`) |

## Catatan handoff

- Fase 08: tool `get_task_diff` tinggal meneruskan respons ini (ringkas untuk konteks Bob).
- Fase 09/11: `commit.created.url` ditampilkan di kartu Selesai & feed.
