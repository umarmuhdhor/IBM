# Fase 06 — Commit per task lewat GitHub API, diff task, analisis dampak, relay terminal

| Field | Nilai |
|---|---|
| Jalur | **Lane Alief** (Alief) · branch `lane/core` |
| Slot WITA | Sab 26 Sep 21:00 – Min 27 Sep 01:00 (PRD: "Sab 23:00–Min 05:00 commit per task + push") |
| Estimasi | 3 jam |
| Prasyarat | 05 |
| Requirement PRD | SV-07, MA-04 (sisi server: `get_task_diff` + importer), §07.4, NFR-09, **JT-03, JT-05, NFR-12 (relay terminal, v0.3)** |
| Model | **Opus 5.5** · effort high (alt: Sonnet 5 · high) |
| Bob slice | **A3**: formatter pesan commit per task + trailer (`services/git-message.ts`) · **A4**: `/review` Bob (mode Ask) atas `locks.ts` vs R4. Bukti `03-commit-format`, `04-locks-review`. |
| Fase berikutnya | 10 (integrasi) — atau 12 bila tim paralel sudah di fase 10 |

## Tujuan

Saat PM menyetujui review, server meng-commit **hanya file milik task itu** ke repo `toko-demo` dengan author coder, trailer `Co-authored-by: IBM Bob`, `Radar-Task`, `Reviewed-by`, langsung ke GitHub lewat **GitHub REST API** (Git Data API), karena Durable Object tidak bisa menjalankan binary `git`. Dan main agent bisa melihat diff task beserta file lain yang memakai simbol yang berubah — inilah yang membuat review menangkap "calculateTotal() berubah, Header.tsx milik B terdampak" (PRD §15 menit 2:40).

## Bacaan wajib

- PRD §07.4, §15 (adegan Review), §18 risiko pertama
- `plan/ref/R4-mesin-kunci.md` §6.3, `plan/ref/R3-kontrak-api.md` §2.15, §5 (`commit.*`), `plan/ref/R5-konvensi.md` §3 (format commit server)

## Output

- `packages/server/src/services/github.ts` (`GitHubCommitter`), `services/diff.ts`, route `GET /v1/tasks/:id/diff`, `POST /v1/tasks/:id/retry-commit` (mc)
- Test dengan GitHub API di-mock (`fetchMock` dari vitest-pool-workers)

## Langkah kerja

1. **`GitHubCommitter`** (`@octokit/rest` atau `fetch` langsung dengan `GITHUB_TOKEN` dari secret Worker, repo `GITHUB_REPO`):
   - Serial otomatis: DO memproses satu event pada satu waktu. Tetap simpan flag `commitInFlight` supaya dua approve beruntun tidak saling menyusul saat menunggu `await fetch`. Antre di memori + tabel `meta`.
   - `commitTask(task, reviewer)`, 5 panggilan Git Data API:
     1. `GET /repos/{o}/{r}/git/ref/heads/main` → `parentSha`. Lalu `GET /git/commits/{parentSha}` → `baseTree`.
     2. Untuk setiap path di `task_touch`: `POST /git/blobs {content, encoding:"utf-8"}` → `blobSha`. Path `deleted` → entri tree dengan `sha: null`.
     3. `POST /git/trees {base_tree: baseTree, tree:[{path, mode:"100644", type:"blob", sha}]}`. Hanya path milik task, **tidak** ada file lain.
     4. `POST /git/commits {message, tree, parents:[parentSha], author:{name: git_name, email: git_email, date}, committer:{name:"Live Collab", email:"live-collab@users.noreply.github.com", date}}`. Pesan mengikuti R5 §3:
        ```text
        T-1: Kupon diskon

        <submit_summary>

        Radar-Task: T-1
        Reviewed-by: Citra (PM) <citra@example.com>
        Co-authored-by: IBM Bob <bob@ibm.com>
        ```
        Tambahkan `Radar-Main-Agent-Proposal: P-7` untuk jejak audit (NFR-09). Format pesan ini adalah **Bob slice A3** (`services/git-message.ts`).
     5. `PATCH /git/refs/heads/main {sha: newCommit, force:false}`. Kalau `422` (ref maju dari luar): ambil ref terbaru, ulangi dari langkah 1 maksimal 2× (tree dibuat ulang di atas parent baru), lalu `commit.push_failed`.
     Kalau tree baru sama dengan `baseTree`, lewati commit dan kembalikan `{ sha: parentSha, empty: true }`.
   - Sukses → `meta.head_commit = sha`, event `commit.created {pushed: true, url: https://github.com/{o}/{r}/commit/{sha}}`. Gagal jaringan/5xx → `commit.push_failed` + retry lewat **DO alarm** (5 s, 15 s, 45 s).
   - Batas GitHub: 5.000 request/jam per token, dan ±80 request pembuat konten per menit. Satu commit ≈ 4 + jumlah file request, jauh di bawah batas.
   - Token GitHub hanya di `env.GITHUB_TOKEN` (secret). Tidak pernah di event, log, atau respons.

2. **Integrasi ke keputusan review** (ganti stub fase 05): urutan R4 §6.3 — commit GitHub di luar transaksi (async `await fetch`, dengan flag `commitInFlight`), lalu satu transaksi DB: `review.commit_sha`, `task.commit_sha`, task `selesai`, `releaseTaskLocks`, event `commit.created` (pushed=false dulu), `task.status`. Gagal commit → proposal tetap `menunggu`? **Tidak**: proposal `disetujui` tapi task tetap `review` + event error + MC menampilkan tombol "Coba commit lagi" (`POST /v1/tasks/:id/retry-commit`, mc).

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

5. **Test** (`test/github.test.ts`, `services/diff.test.ts`) dengan `fetchMock` (vitest-pool-workers) yang meniru endpoint Git Data API dan menyimpan tree/commit di memori:
   - Approve review T-1 → mock menerima blob hanya untuk path T-1, commit dengan author Alice dan 3 trailer. File milik T-2 yang sedang dikerjakan **tidak** ikut.
   - Dua task disetujui berurutan → dua commit terpisah dengan parent berantai, sha di `task.commit_sha`.
   - `PATCH ref` 422 sekali → retry sukses. 5xx terus → `commit.push_failed`, task tetap `review`, dan tombol retry tersedia.
   - Task tanpa perubahan nyata → `empty: true`.
   - Diff: `calculateTotal(items)` → `calculateTotal(items, shipping)` di `checkout.ts`, dan `Header.tsx` mengimpornya → `exportsChanged[calculateTotal]` + `importers[Header.tsx].lines` benar.
   - Tidak ada `GITHUB_TOKEN` di event, log, atau respons (grep hasil test).

6. **Uji manual ke GitHub nyata** (LANGKAH MANUAL): dengan Worker ter-deploy + secret `GITHUB_TOKEN`, jalankan skenario singkat lewat `curl` (rencana → edit via sync → submit → proposal review → approve dengan token mc) dan pastikan commit muncul di GitHub atas nama coder dengan co-author IBM Bob (GitHub menampilkan avatar ganda bila email co-author dikenali). Screenshot → `docs/img/commit-github.png`.

7. Commit `fase-06: GitHub API committer, task diff, impact analysis`.

## Bagian v0.3 — Relay terminal (JT-03, JT-05, NFR-12)

1. `services/terminals.ts`: registry `termId → {owner, title, agent, viewers:Set, ring: RingBuffer(262144), grant?}`. Hanya pemilik (`principal.member === owner`) yang boleh `share/unshare/frame/snapshot/resize/grant/revoke`. Penonton harus anggota workspace yang sama.
2. Hub WS: routing pesan sesuai R3 §3.9. `term.subscribe` → kirim isi ring buffer, lalu minta `term.need_snapshot` ke host. Host putus → `term.ended {reason:"host_offline"}`.
3. Batas: frame > 32 KB ditolak (`TERM_FRAME_TOO_LARGE`), dan maks 60 frame/detik per terminal (sisanya digabung/dibuang dengan log).
4. `RECORD_TERMINALS=true` → frame disimpan ke tabel `term_frame` (tambahkan ke R2 lewat contract PR). `GET /v1/events/export?withTerminals=true` menyertakan frame.
5. Event log: `term.shared`, `term.unshared`, `term.viewer.joined/left`, `term.input.granted/revoked` (tanpa isi frame).
6. Test integrasi: host + 2 penonton (klien `ws`), urutan `seq` terjaga, penonton terlambat menerima ring, non-anggota ditolak, input tanpa grant ditolak (P1).
7. Metrik `term.latency` di event `metric`.
8. `security-reviewer` wajib untuk bagian ini.

## Verifikasi

```bash
pnpm --filter @radar/server test
pnpm --filter @radar/server build && fly deploy
curl -s $S/v1/tasks/T-1/diff -H "authorization: Bearer $TOK_C" | jq '.importers'
```

## Kriteria selesai (DoD)

- [ ] SV-07: commit per task berisi author coder + 3 trailer + hanya file task; push ke GitHub terbukti (screenshot).
- [ ] MA-04 sisi server: diff + `exportsChanged` + `importers` benar untuk skenario `calculateTotal`.
- [ ] Kegagalan push tidak merusak state; retry berfungsi.
- [ ] Tidak ada token di `.git/config` server maupun di log (cek `fly ssh console -C "cat /data/repo/.git/config"`).

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Regex ekspor meleset pada sintaks kompleks | Cukup untuk repo demo; dokumentasikan batasan. Fallback terakhir (PRD §16 poin 5): review diringkas jadi diff saja |
| GitHub menolak push (proteksi branch) | Nonaktifkan proteksi di `toko-demo` atau push ke branch `radar/main` lalu tampilkan link |
| Email co-author IBM Bob tidak dikenali GitHub | Tetap valid sebagai trailer; konfirmasi alamat resmi di kickoff (env `BOB_COAUTHOR`) |

## Catatan handoff

- Fase 08: tool `get_task_diff` tinggal meneruskan respons ini (ringkas untuk konteks Bob).
- Fase 09/11: `commit.created.url` ditampilkan di kartu Selesai & feed.
