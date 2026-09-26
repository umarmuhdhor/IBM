# Log fase 04 — Sync agent (Lane Alief)

- **Status:** [x] kode, test, bench lokal + produksi, dan smoke test CLI melawan Worker Cloudflare selesai. PR `fase-04: sync agent` dari snapshot `lane/core-f04`.
- **Mulai:** Sab 26 Sep 2026 ±09:15 WITA · **Selesai:** Sab 26 Sep 2026 13:30 WITA · branch `lane/core`.
- **Model:** Claude Opus 5.5 (R6 §2).
- **Pra-cek:** `origin/main` memuat D-007 (6 baris). Perubahan belum di-commit di awal sesi lanjutan hanya milik fase ini (`bench-sync.ts`, `package.json`, lockfile). PR fase 03 ([umarmuhdhor/IBM#5](https://github.com/umarmuhdhor/IBM/pull/5)) masih terbuka; PR fase 04 ikut membawa commit fase 03 sampai #5 merge.
- **Langkah manual yang dikerjakan sesi ini (atas permintaan Alief):** repo `aliefauzan/toko-demo` (public, `main`, seed `ed9e4b2`), deploy Worker `https://live-collab.afindo-mi01.workers.dev`, `ADMIN_SECRET` (acak 32 byte, disimpan di Keychain macOS `radar-admin-secret`, tidak pernah tampil), `GITHUB_TOKEN` (PAT fine-grained dibuat dan diketik Alief di prompt `wrangler secret put`), `admin init` produksi (4 member + mc; token di `~/.live-collab/members-prod-2026-09-26.txt` mode 0600, pindahkan ke password manager tim, TODO B7). Detail di TODO B2–B5 dan log fase 03 langkah 13.

## Checklist langkah (plan/fase-04-sync-agent.md)

- [x] 1. CLI `radar` (commander): `join`, `start`, `status`, `kit install`; `task`/`agent` stub P1.
- [x] 2. Koneksi WS: `hello {token, client:'sync', knownVersions}`, welcome/snapshot/ack/changed/rejected/lock.changed/notice/error; pong string dicocokkan sebelum zod.
- [x] 3. Snapshot awal (SY-01): tulis atomik, `known` monoton, sidecar konflik sebelum menimpa.
- [x] 4. Watcher (SY-02): chokidar v4 + debounce 150 ms per path, `poll-1s` fallback, **rescan pengaman 2 s** (lihat Penyimpangan).
- [x] 5. Terima perubahan (SY-03): `file.applied {appliedTs}`.
- [x] 6. Ditolak (SY-04): `.radar-rejected` / `.radar-conflict`, notifikasi macOS, retry verifikasi hash maks 3.
- [x] 7. Heartbeat (SY-05) tiap `HEARTBEAT_INTERVAL_MS`.
- [x] 8. Kit: `--kit-dir` → `RADAR_KIT_DIR` → `<pkg>/bob-kit` → `radar/bob-kit`; subset/`--force` + backup `.bob.bak-<ts>`.
- [x] 9. `radar status` (`/healthz`; `/v1/tasks` 404 sampai fase 05 dicetak "belum tersedia").
- [x] 10. `.radar/sync.log` + rotasi 5 MB.
- [x] 11. Test integrasi melawan Worker asli (`createTestHarness`), 10 skenario.
- [x] 12. Bench (`packages/sync/scripts/bench-sync.ts`, `pnpm -C radar bench:sync`), hasil di `radar/docs/EXPERIMENT.md`.
- [x] 13. Commit fase.
- [x] v0.3: `--json-status` (JSON lines) dan `pnpm pack` → `radar-cli.tgz` dengan `bob-kit` terbundel.

## Bukti TDD

- RED: `5aa42415 test(sync): fase-04 RED suite …`.
- GREEN: `e04becb2 feat(sync): …` — 37/37, integrasi 8× berturut-turut hijau.
- Review: 3 test RED baru (retry cap, edit offline, symlink) lalu GREEN; sync 43/43.
- Sesi lanjutan: test `watcher.test.ts` "rescan reports writes the fs watcher lost and re-watches their folder" merah dulu (watcher palsu tanpa event, `add()` tidak pernah dipanggil), lalu hijau setelah rescan. Total sync 38/38.
- Typecheck sekarang mencakup `test/` dan `scripts/` (sebelumnya hanya `src/`). Temuan: fixture `holder.state: 'held'` bukan nilai kontrak → diganti `dipegang`.

## Bench (langkah 12)

| Target | Write | Diterima B | p50 | p95 | max | Echo |
|---|---|---|---|---|---|---|
| lokal `createTestHarness` | 100 × 200 ms | 94 (6 digabung debounce) | 156 ms | 159 ms | 172 ms | A 94 / B 0 |
| Worker Cloudflare (`live-collab.afindo-mi01.workers.dev`) | 50 × 200 ms | 50 | 195 ms | 295 ms | 300 ms | A 50 / B 0 |

Target PRD p95 < 1000 ms: lulus di kedua target. p50 lokal ≈ debounce 150 ms + ±6 ms.

## Smoke test CLI (produksi)

- `radar join <worker> --workspace toko-demo --as A` dan `--as B --json-status` di dua folder: 19 file, kit coder 11 file, `.radar/local.json` mode 0600.
- Edit `src/utils.ts` di A → sama persis di B dalam < 3 s.
- `radar status`: server, member, koneksi `ok · server v0.3.0`, task "belum tersedia (HTTP 404, fase 05)".
- Bin lewat symlink: `node <symlink> --version` → 0.3.0 (guard `realpathSync`).
- `pnpm pack --out radar-cli.tgz` → `npm i -g --prefix <tmp>` → `radar --version` 0.3.0, `radar kit install coder` memakai kit dari tarball.
- Sisa data uji di workspace produksi: `radar-bench/latency.txt` dan edit `src/utils.ts`. Dibersihkan oleh `admin reset` + `admin init` di fase 10.

## Review (langkah 8)

Empat reviewer paralel: `ecc:code-reviewer`, `ecc:typescript-reviewer`, `ecc:silent-failure-hunter`, `ecc:pr-test-analyzer`.

| Reviewer | Sev | Temuan | Status |
|---|---|---|---|
| typescript | CRITICAL | `atomicWrite` mengikuti symlink (file atau folder) keluar workspace; `removeLocal` bisa menghapus lewat folder symlink | Diperbaiki: `resolveInside` (realpath dicek di dalam `realpath(root)`), `UnsafePathError`. Test RED→GREEN "never follows a symlink out of the workspace" + "writes through a symlink that stays inside" |
| silent-failure | CRITICAL | Retry verifikasi habis (`reject.giveup`) hanya log, user tidak tahu file tidak tersimpan; budget tidak di-reset | Diperbaiki: notifikasi error + `retries.delete`. Test RED→GREEN `fake-server.test.ts` (server WS palsu selalu `file.rejected`) |
| silent-failure | HIGH | Putus/sambung WS hanya ditulis ke log | Diperbaiki: satu notifikasi "terputus" per putus, "tersambung lagi" saat welcome. Test RED→GREEN "an edit made while disconnected is uploaded after the reconnect" |
| silent-failure | HIGH | `processPath` menelan `safeRelative` gagal | Diperbaiki: log `local.unsafe`; error lain dilempar ulang |
| typescript | HIGH | `s.hash as string` / `s.content as string` di `onRejected` | Diperbaiki: narrowing ke `serverFile` |
| typescript | HIGH | `renameWithRetry` busy-wait | Dipertahankan, didokumentasikan: hanya EPERM/EBUSY (Windows), total ≤ 300 ms, `atomicWrite` tetap sinkron |
| typescript | HIGH | Timer reconnect tidak `unref` | Dipertahankan, didokumentasikan: timer itu yang menjaga `radar start` tetap hidup saat offline |
| silent-failure | MEDIUM | `listFiles`/scanner menelan semua error fs | Diperbaiki: hanya ENOENT/ENOTDIR diam; lainnya ke `onError` / log `scan.error` |
| pr-test | MEDIUM | Belum ada test edit offline, retry cap, reload `.gitignore` | Ditambah (3 test) |
| code-reviewer | MEDIUM | Rescan 2 s = walk sinkron seluruh pohon di mode `watch` | Dicatat. toko-demo 19 file (walk < 1 ms). Fase 12: batasi ke folder yang belum di-watch atau pindah ke worker bila workspace besar |
| code-reviewer | LOW | `bundle.mjs` pakai `URL.pathname` (rusak di Windows) | Diperbaiki: `fileURLToPath` |
| code-reviewer | LOW | `exports["."]` menunjuk `dist/index.js` yang tidak ada di tarball | Dicatat: export dipakai di dalam workspace pnpm; tarball hanya untuk bin `radar` |

MEDIUM/LOW lain yang dicatat (fase 12):
- Error rescan hanya ke log (tidak ke notifikasi); dedupe error berulang tiap 2 s belum ada.
- Tidak ada handler `unlinkDir` (hapus file P1).
- `log.ts` memperingatkan gagal tulis log hanya sekali.
- Sidecar lama ditimpa tanpa cadangan (sesuai spesifikasi SY-04).
- Bench memakai `BENCH_ADMIN_SECRET` tetap (hanya harness lokal, bukan produksi).
- Gap test yang disarankan tapi belum ditulis: konflik live pada `file.changed`, koreksi role saat join, `poll-1s` end-to-end, timeout ping.

Verifikasi akhir: `pnpm typecheck`, `npx eslint .`, `pnpm build`, `pnpm test` hijau di `radar/` (sync 43/43, 5× berturut-turut). gitleaks `radar/` dan `plan/`: hanya cache build `.next` yang di-gitignore.

## Penyimpangan

- Bench dipindah dari `radar/scripts/` ke `packages/sync/scripts/`. Symlink `wrangler` di root `radar/node_modules` rusak di pnpm 12 (menunjuk ke `.pnpm/wrangler@4.140.0` tanpa sufiks peer). Paket sync sudah punya `wrangler` sendiri.
- Kriteria lulus bench: setiap versi yang dikirim A sampai di B, B tidak mengirim apa pun, isi akhir sama, dan p95 < 1000 ms. Bukan "100 update untuk 100 write": write yang berjarak < debounce (jitter event fs) memang digabung.
- Bench memakai satu write pemanasan yang tidak diukur (membuat folder dan menunggu B).
- `@radar/common` pindah ke `devDependencies` `@radar/sync`. CLI dibundel esbuild ke `dist/radar.mjs` (bin), jadi tarball tidak butuh paket yang tidak ada di npm.

## Catatan untuk lane lain

- App (Aarief): jalankan `radar start --json-status` sebagai child process; satu baris JSON per perubahan status (`connected`, `files`, `pending`, `myLocks`). Bin sekarang `dist/radar.mjs`.
- Bob (Umar): kit dicari di `<pkg>/bob-kit` lebih dulu, jadi `radar-cli.tgz` membawa kit sendiri. Setiap perubahan `radar/bob-kit` ikut ke tarball berikutnya lewat `prepack`.
- Semua: Worker produksi sudah hidup. Token member dibagikan Alief lewat password manager, bukan chat.
