# Fase 06 — Git worker (commit per task + push), diff task & analisis dampak

| Field | Nilai |
|---|---|
| Jalur | Orang 1 |
| Slot WITA | Sab 26 Sep 21:00 – Min 27 Sep 01:00 (PRD: "Sab 23:00–Min 05:00 commit per task + push") |
| Estimasi | 3 jam |
| Prasyarat | 05 |
| Requirement PRD | SV-07, MA-04 (sisi server: `get_task_diff` + importer), §07.4, NFR-09 |
| Model | **Opus 5.5** · effort high (alt: Sonnet 5 · high) |
| Fase berikutnya | 10 (integrasi) — atau 12 bila tim paralel sudah di fase 10 |

## Tujuan

Saat PM menyetujui review, server meng-commit **hanya file milik task itu** ke repo `toko-demo` dengan author coder, trailer `Co-authored-by: IBM Bob`, `Radar-Task`, `Reviewed-by`, lalu push ke GitHub. Dan main agent bisa melihat diff task beserta file lain yang memakai simbol yang berubah — inilah yang membuat review menangkap "calculateTotal() berubah, Header.tsx milik B terdampak" (PRD §15 menit 2:40).

## Bacaan wajib

- PRD §07.4, §15 (adegan Review), §18 risiko pertama
- `plan/ref/R4-mesin-kunci.md` §6.3, `plan/ref/R3-kontrak-api.md` §2.15, §5 (`commit.*`), `plan/ref/R5-konvensi.md` §3 (format commit server)

## Output

- `packages/server/src/services/git.ts` (`GitWorker`), `services/diff.ts`, route `GET /v1/tasks/:id/diff`, `POST /v1/tasks/:id/retry-commit` (mc)
- Test dengan bare repo lokal sebagai remote

## Langkah kerja

1. **`GitWorker`** (`simple-git` pada `$DATA_DIR/repo`):
   - Antrean serial (promise chain / `p-queue` concurrency 1): tidak ada dua operasi git bersamaan.
   - `commitTask(task, reviewer)`:
     1. Ambil `task_touch` untuk task. Untuk setiap path: tulis `file.content` terkini ke working copy (buat folder), atau `git rm` bila `deleted`.
     2. `git add -- <paths>` (hanya path task; **jangan** `git add -A`).
     3. Kalau tidak ada perubahan staged (isi sama dengan HEAD) → kembalikan `{ sha: HEAD, empty: true }` (task tetap bisa selesai).
     4. Commit dengan `--author "<git_name> <git_email>"` pemilik task, committer `Radar Server <radar@localhost>`, pesan R5 §3:
        ```text
        T-1: Kupon diskon

        <submit_summary>

        Radar-Task: T-1
        Reviewed-by: Citra (PM) <citra@example.com>
        Co-authored-by: IBM Bob <bob@ibm.com>
        ```
        Tambahkan `Radar-Main-Agent-Proposal: P-7` untuk jejak audit (NFR-09).
     5. `sha = rev-parse HEAD`; `meta.head_commit = sha`.
   - `push()` asinkron setelah commit bila `GIT_PUSH=true`: `git push <url-dengan-token> HEAD:main` memakai `-c credential.helper=` dan URL token **hanya di argumen proses** (jangan simpan ke config, jangan log). Sukses → event `commit.created {pushed: true, url: <repo>/commit/<sha>}`; gagal → `commit.push_failed` dan retry otomatis 3× backoff (5 s, 15 s, 45 s).
   - Sebelum commit: `git pull --rebase`? **Tidak** — repo toko-demo hanya ditulis server. Kalau remote berubah dari luar (push manual), push akan gagal → event peringatan; dokumentasikan "jangan push manual ke toko-demo saat demo".
   - Bila working copy kotor di luar path task (tidak boleh terjadi) → log peringatan, lanjut hanya dengan path task.

2. **Integrasi ke keputusan review** (ganti stub fase 05): urutan R4 §6.3 — git commit di luar transaksi (serial), lalu satu transaksi DB: `review.commit_sha`, `task.commit_sha`, task `selesai`, `releaseTaskLocks`, event `commit.created` (pushed=false dulu), `task.status`. Gagal commit → proposal tetap `menunggu`? **Tidak**: proposal `disetujui` tapi task tetap `review` + event error + MC menampilkan tombol "Coba commit lagi" (`POST /v1/tasks/:id/retry-commit`, mc).

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

5. **Test** (`test/git.int.test.ts`, `services/diff.test.ts`):
   - Setup: `git init --bare remote.git`, clone ke `$DATA_DIR/repo` via `radar-server init` dengan repo contoh berisi file toko-demo mini.
   - Approve review T-1 → commit baru di remote (`git --git-dir remote.git log -1 --format=%an%n%B`): author = Alice, pesan berisi 3 trailer, **hanya** path T-1 berubah (`git show --name-only`), file milik T-2 yang sedang dikerjakan **tidak** ikut.
   - Dua task disetujui berurutan → dua commit terpisah, sha di `task.commit_sha`.
   - Push gagal (remote tidak ada) → `commit.push_failed`, commit lokal tetap ada, task `selesai`.
   - Task tanpa perubahan nyata → selesai dengan `empty: true`.
   - Diff: ubah `calculateTotal(items)` → `calculateTotal(items, shipping)` di `checkout.ts`; `Header.tsx` mengimpor & memanggil → respons berisi `exportsChanged[calculateTotal]` dan `importers[Header.tsx].lines` yang benar.
   - Test gagal kalau ada sha `pending-fase-06` tersisa (grep di kode).

6. **Uji manual ke GitHub nyata** (LANGKAH MANUAL): dengan server deploy + `GIT_PUSH=true`, jalankan skenario singkat lewat `curl` (rencana → edit via sync → submit → proposal review → approve dengan token mc) dan pastikan commit muncul di GitHub atas nama coder dengan co-author IBM Bob (GitHub menampilkan avatar ganda bila email co-author dikenali). Screenshot → `docs/img/commit-github.png`.

7. Commit `fase-06: git worker, task diff, impact analysis`.

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
