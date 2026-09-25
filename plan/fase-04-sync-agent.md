# Fase 04 — Sync agent (`radar` CLI)

| Field | Nilai |
|---|---|
| Jalur | Orang 1 |
| Slot WITA | Sab 26 Sep 07:00 – 10:00 |
| Estimasi | 3 jam |
| Prasyarat | 03 (dan keputusan `SYNC` dari GATE 1 di fase 01) |
| Requirement PRD | SY-01, SY-02, SY-03, SY-04 (sisi klien), SY-05, dasar SY-07; §8.3; NFR-01 latensi sinkron |
| Model | **Opus 5.5** · effort high (alt: Sonnet 5 · high) |
| Fase berikutnya | 05 (setelah tidur Orang 1: Sab 16:00) |

## Tujuan

Program kecil di setiap PC yang membuat folder proyek selalu sama dengan server: mengirim perubahan lokal (< 300 ms setelah jeda 150 ms), menulis perubahan kiriman server tanpa memantulkannya kembali, mengembalikan isi + menyimpan salinan saat update ditolak, dan mengirim heartbeat.

## Bacaan wajib

- PRD §06 aturan 5, §07.5, §08.1, §08.3, §10.1
- `plan/ref/R3-kontrak-api.md` §3, `plan/ref/R1-struktur-repo.md` §5–6, `plan/ref/R5-konvensi.md` §4, §6
- `docs/SPIKE_RESULTS.md` (spike 4: latensi, reload editor; keputusan `SYNC`)

## Output

- `packages/sync/src/{cli,agent,watcher,known,writer,sidecar,notify,kit}.ts`
- `packages/sync/test/*.int.test.ts`
- `scripts/bench-sync.ts`
- Paket bisa dijalankan sebagai `pnpm --filter @radar/sync exec radar …` dan `npx radar` (bin)

## Desain inti

```text
                    ┌──────────── SyncAgent ────────────┐
disk ──chokidar──▶  │ watcher (debounce 150 ms/path)    │
                    │   ├─ ignore? size? binary? → skip  │
                    │   ├─ hash == known[path].hash → skip (anti-gema)
                    │   └─ send file.update(baseVersion=known.version)
                    │ pending[path] = {hash, msgId}      │ ◀─ file.ack → known = {version, hash}
server ──ws──────▶  │ file.changed → writer.atomicWrite  │     (known di-set SEBELUM menulis)
                    │ file.rejected → sidecar + restore  │
                    │ heartbeat 15 s · reconnect backoff │
                    └───────────────────────────────────┘
```

**Anti-gema (SY-03).** `known: Map<path, {version, hash}>` adalah hash terakhir yang **disepakati dengan server** (dari snapshot, ack, atau changed). Sebelum menulis file kiriman server, `known[path]` di-set ke hash baru; event watcher untuk hash yang sama diabaikan. Tidak perlu "daftar abaikan sementara" berbasis waktu.

**Penulisan atomik.** Tulis ke `<dir>/.<name>.radar-tmp-<rand>` lalu `rename` ke target (hindari editor membaca file setengah jadi). File tmp masuk aturan abaikan.

## Langkah kerja

1. **CLI** (`cli.ts`, `commander`): perintah R1 §5 — `join`, `start`, `status`, `kit install` (implementasi penuh), `task use` & `agent` (stub yang mencetak "tersedia di fase 12").
   - `join <server> --workspace --as --token [--dir .] [--kit coder|pm] [--no-kit]`: tulis `.radar/local.json` (mode file `0600`), pastikan `.radar/` ada di `.gitignore` lokal, pasang kit (`kit.ts`, lihat langkah 8), lalu `start`.
   - Output terminal ringkas berwarna (warna anggota R5 §4): `● terhubung sebagai A (coder) · 42 file · server v0.2`.

2. **Koneksi** (`agent.ts`): `ws` ke `<server>/ws`, kirim `hello {token, client:'sync', knownVersions}`; tangani `welcome`, `snapshot`, `file.ack`, `file.changed`, `file.rejected`, `lock.changed` (simpan peta kunci lokal untuk `radar status` & notifikasi), `notice`, `error`.
   - Reconnect: backoff eksponensial 0,5 s → 8 s + jitter. Saat tersambung ulang, kirim `knownVersions` (hanya file yang sudah disepakati).

3. **Snapshot awal (SY-01).**
   - Folder kosong / baru: tulis semua file dari snapshot (atomik), isi `known`.
   - Folder berisi: untuk setiap file snapshot, kalau isi lokal berbeda → simpan lokal sebagai `<file>.radar-conflict` lalu tulis versi server (server menang, PRD §8.3). File lokal yang tidak ada di server dan tidak diabaikan → kirim sebagai `file.update` baseVersion 0 (akan diterima kalau bebas; kalau ditolak → sidecar).
   - Cetak ringkasan: `snapshot: 42 file, 0 konflik`.

4. **Watcher (SY-02)** (`watcher.ts`):
   - `SYNC=watch` (default): `chokidar.watch(root, { ignored: (p) => matcher.ignores(rel(p)), ignoreInitial: true, atomic: true, awaitWriteFinish: false })`. chokidar v4 tidak menerima glob → `ignored` wajib fungsi.
   - `SYNC=poll-1s` (fallback GATE 1): pemindai `fs.stat` rekursif tiap 1 s membandingkan `mtimeMs+size`.
   - Debounce per path 150 ms (`SYNC_DEBOUNCE_MS`). Setelah debounce: baca file, cek ukuran/biner, `sha256Hex`, bandingkan `known`, kirim `file.update {path, baseVersion, content, hash, clientTs}` dengan `id` pesan unik; simpan `pending[path]`.
   - Kalau ada update baru untuk path yang masih pending → kirim lagi (server idempoten & pemilik tunggal); jangan antre tak terbatas: simpan hanya versi terakhir.
   - `unlink` & rename: di fase ini **dicatat saja** ke log (P1 fase 12 mengirim `file.delete`).

5. **Terima perubahan (SY-03)**: `file.changed` → `known.set(path, {version, hash})` → `atomicWrite` → kirim `file.applied {path, version, serverTs, appliedTs: Date.now()}`. Buat folder induk bila perlu. Kalau file lokal sedang punya perubahan pending milik kita dengan hash berbeda → itu tidak boleh terjadi untuk file yang kita pegang (single writer); kalau terjadi, simpan lokal sebagai `.radar-conflict` dan tulis versi server.

6. **Ditolak (SY-04)** (`sidecar.ts`): `file.rejected {path, reason, holder, server}`:
   - Salin isi lokal saat ini ke `<path>.radar-rejected` (timpa file sidecar lama, tambahkan header komentar? **Tidak** — simpan isi apa adanya agar bisa disalin).
   - Pulihkan isi server (`atomicWrite` + set `known`), atau hapus file lokal bila server `deleted`/tidak ada.
   - Notifikasi terminal (`notify.ts`): merah, bunyi bel `\x07`, teks: `✖ Perubahanmu di src/checkout/checkout.ts ditolak: dipegang Alice (T-1 Kupon). Isimu disimpan di checkout.ts.radar-rejected.` Untuk `pm_readonly`: `PM tidak menulis file. Perubahan disimpan di …`. Untuk `conflict`: `Versi lokal tertinggal, isi server dipakai. Salinanmu: ….radar-conflict`.
   - Opsional (kalau cepat): notifikasi OS via `osascript`/`notify-send` di balik flag `--os-notify`.

7. **Heartbeat (SY-05)**: `setInterval(HEARTBEAT_INTERVAL_MS)` kirim `heartbeat {ts}` selama terhubung. Tampilkan `♥` redup di baris status (mode `--verbose`).

8. **Kit** (`kit.ts`): salin `bob-kit/<coder|pm>/.bob/**` ke `<root>/.bob/` (lokasi kit dicari: `--kit-dir`, env `RADAR_KIT_DIR`, lalu `../../bob-kit` relatif paket). Jangan menimpa `.bob/` yang berisi file lain tanpa `--force` (backup `.bob.bak-<ts>`). Kalau kit belum ada (fase 07 belum jalan) → peringatan kuning, lanjut.

9. **Status** (`radar status`): baca `.radar/local.json` + panggil `GET /healthz` & `GET /v1/tasks` (coder) → cetak server, member, koneksi, task aktif, kunci saya.

10. **Log** `.radar/sync.log`: satu baris per kejadian (kirim/terima/tolak/konflik/reconnect) dengan latensi; rotasi sederhana saat > 5 MB.

11. **Test integrasi** (`packages/sync/test/sync.int.test.ts`) — server in-process (`buildApp`, `:memory:`, `seedTestWorkspace`) + `SyncAgent` A, B, C di folder `mkdtemp`:
    - Join → ketiga folder berisi snapshot identik.
    - A menulis `src/utils.ts` → isi sama di B dan C dalam < 1000 ms (poll folder tiap 20 ms, ukur).
    - **Anti-gema:** setelah satu tulis di A, hitung pesan `file.update` yang diterima server selama 2 s = **tepat 1**; B tidak mengirim `file.update` apa pun.
    - 20 simpan beruntun dalam 100 ms di A → debounce: ≤ 3 update terkirim, versi akhir sama di semua PC.
    - C (pm) menulis → C dapat `file.rejected`, isi C dipulihkan, `.radar-rejected` berisi tulisan C, A & B tidak berubah.
    - Folder berisi file berbeda saat join → `.radar-conflict` dibuat.
    - Heartbeat terkirim (percepat interval lewat opsi test).
    - Reconnect: matikan & hidupkan server (atau tutup socket) → agent tersambung lagi dan mengejar perubahan yang terlewat via snapshot diff.
    (Test blokir antar-coder A↔B menunggu mesin kunci fase 05; tambahkan di sana.)

12. **Bench** `scripts/bench-sync.ts`: server lokal + 2 agent di satu mesin, 100 penulisan acak berjeda 200 ms, cetak p50/p95/max `appliedTs(B) - writeTs(A)`; mode `--server <url>` untuk server deploy (2 agent lokal ke server Fly, mengukur round trip nyata). Simpan hasil ke `docs/EXPERIMENT.md` bagian "Latensi sinkron (bench)".

13. Commit `fase-04: sync agent`.

## Verifikasi

```bash
pnpm --filter @radar/sync test
pnpm bench:sync                      # p95 < 1000 ms lokal (target PRD), catat angka
pnpm bench:sync -- --server https://<app>.fly.dev --token-a … --token-b …
# Manual 2 terminal:
radar join http://localhost:8787 --workspace toko-demo --as A --token <tokA> --dir /tmp/wsA --no-kit
radar join http://localhost:8787 --workspace toko-demo --as B --token <tokB> --dir /tmp/wsB --no-kit
echo "// x" >> /tmp/wsA/src/utils.ts && sleep 1 && tail -1 /tmp/wsB/src/utils.ts
```

## Kriteria selesai (DoD)

- [ ] SY-01, SY-02, SY-03, SY-05 terbukti oleh test integrasi (tempel output).
- [ ] SY-04 sisi klien terbukti dengan skenario PM (penolakan antar-coder diuji di fase 05).
- [ ] Bench lokal p95 < 1 s; bench ke server deploy dicatat apa adanya.
- [ ] Tidak ada gema pada 100 penulisan beruntun (jumlah update server = jumlah penulisan setelah debounce).
- [ ] Jalan di macOS; Windows/Linux minimal diuji path-nya lewat test unit `paths.ts`.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Editor menulis via rename (atomic save) → event `unlink`+`add` | `atomic: true` di chokidar + debounce per path; perlakukan `add` setelah `unlink` < 150 ms sebagai `change` |
| Event watcher hilang di folder besar/jaringan | `SYNC=poll-1s` |
| Jam PC berbeda merusak metrik latensi | Metrik lintas PC memakai RTT dari server (R4 §9); p95 resmi diambil dari bench satu mesin + dicatat metodenya |

## Catatan handoff

- Fase 05 menambahkan test blokir A↔B dan penolakan `held_by_other` memakai agent ini.
- Fase 07 memakai `kit install` untuk memasang `.bob/`.
- Fase 12 menambah `file.delete`, reconnect penuh (kirim perubahan offline), dan `radar agent`.
