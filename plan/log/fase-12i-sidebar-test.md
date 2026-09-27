# Fase 12i · Sidebar.test diperbaiki + baseline prod (main setelah #35 dan #37)

Lane: Core (Alief). Satu perubahan di `app/**` (lane App, Aarief): hanya file test.

## Masalah

Empat test di `app/src/renderer/src/components/sidebar/Sidebar.test.tsx` gagal di `main` dengan
`TypeError: Cannot read properties of undefined (reading 'radar')`. Sidebar sekarang merender kartu Multiplayer,
dan hook-nya (`use-radar-session.ts:10`) memanggil `window.api.radar`. happy-dom tidak punya preload bridge.

## Perbaikan

`vi.mock('@/components/radar/use-radar-session', …)` di file test mengembalikan `{ connection: null, setConnection }`.
`use-radar-session.ts` dan `Sidebar.tsx` tidak diubah. Commit `fix(app/test): stub the radar session hook in Sidebar.test`.

## Prod

| Hal | Nilai |
|---|---|
| Versi sebelum deploy (target rollback) | `b81029bc-b602-4f23-b960-29a0f386e414` (`npx wrangler rollback b81029bc-b602-4f23-b960-29a0f386e414`) |
| Versi yang dideploy (main `8b5c34fc`, #35 + #37) | `b3f7e42d-6123-4dd9-9f9b-f5f4a2184ce0` |
| Perintah | `pnpm -C radar --filter "@radar/server^..." build && pnpm -C radar --filter @radar/server run deploy` (percobaan pertama gagal di Cloudflare API `assets-upload-session` code 10013, percobaan kedua berhasil) |
| Isi prod sebelum uji | workspace `demo` (owner `aliefauzan`, 0 file, 5 event); cadangan export di scratchpad. Alief mengizinkan prod dikosongkan untuk e2e. |

Canary (Node `fetch` + `WebSocket` ke prod, setelah deploy):

| Cek | Hasil |
|---|---|
| `GET /healthz` | 200, `version 0.3.0` |
| `GET /j/<kode>` | 200 `text/x-shellscript`, skrip menyebut `radar-cli.tgz` |
| `GET /radar-cli.tgz` | 200, 1,46 MB gzip |
| WebSocket `/ws` | open |

## Smoke e2e di prod (app tanpa `LIVE_COLLAB_SERVER`)

Tiga app Electron (profil dan HOME terpisah) lewat driver Playwright `_electron`. Folder uji sintetis `alpha`
(3 file + satu folder kosong). Nama uji: owner `af`, `E2E Budi` (coder), `E2E Pat` (PM).

| Langkah | Hasil |
|---|---|
| `admin reset --confirm`, owner Share `alpha` | kode keluar, "Syncing 3 files" |
| B join sebagai coder | "Joined alpha as E2E Budi (coder)", 3 file di `~/live-collab/alpha` |
| P join dengan kode yang sama | ditolak 409 "This code was already used by E2E Budi" (D-alief-13, sesuai desain) |
| Owner **Make code**, P join sebagai PM | "Joined alpha as E2E Pat (PM)", 3 online |
| Owner edit `README.md` | sampai di B dan P |
| B edit `src/util.ts` | sampai di owner dan P; lock "E2E Budi · held" di Files & locks |
| Owner edit `src/util.ts` | ditolak; app owner: "Your change to src/util.ts was refused: held by E2E Budi (T-2 …)", isi di `util.ts.radar-rejected` |
| PM edit `README.md` | ditolak; app PM: "A PM does not write files. Your change is kept in README.md.radar-rejected." |
| Owner **Stop sharing** | owner: "Sharing stopped. The server is empty…"; B dan P: "The owner stopped sharing. Your files stay in …" |

Bug yang terlihat (sudah ada di daftar fase 12k): folder kosong `empty-dir` tidak muncul di B.

## Gerbang

- UI gate: tidak ada view yang berubah (hanya file test). Screenshot prod ada di scratchpad e2e (`o1-shared`, `o2-files-locks`, `o3-team`, `b1-joined`, `p1-joined`, `b2-stopped`).
- Hasil verifikasi (jumlah test) ada di badan PR.

## Verifikasi (Min 27 Sep, 11:40 WITA)

| Perintah | Hasil |
|---|---|
| `npx vitest run --config config/vitest.config.ts src/renderer/src/components/sidebar/Sidebar.test.tsx` (app/) | 6/6 lulus (sebelumnya 4 gagal) |
| `pnpm -C radar test` | 563 lulus (8 paket) |
| `pnpm -C radar typecheck`, `pnpm -C radar lint` | bersih |
| `pnpm -C app tc`, `oxlint Sidebar.test.tsx` | bersih |
| Suite app penuh (`pnpm -C app test`) | 9447 file lulus, 23 file gagal. Tidak ada yang menyentuh file yang diubah. Dijalankan ulang terpisah: tetap gagal karena lingkungan (webkit Playwright tidak terpasang, test `cross-version-wire` butuh checkout rilis, `pty-transcript-secret-scan` menandai username mesin ini) atau karena perubahan lane lain yang sudah ada di `main` (`electron-builder-config` mengharapkan appId Orca `com.stablyai.orca`, sekarang `dev.livecollab.app`; `global-fetch-call-site-audit` menandai `app/src/main/radar/server-fetch.ts`, dikerjakan di fase 12k). |

Code review (diff 5 baris): tidak ada temuan CRITICAL/HIGH.
