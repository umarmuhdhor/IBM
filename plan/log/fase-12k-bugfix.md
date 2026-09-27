# Fase 12k · Perbaikan bug multiplayer dari uji dua app

Lane: Core (Alief). Pelacak: `plan/fixbug.md`. Kerja dibagi dua sesi: sesi A (bug 1–4, 7–10, semua langkah prod) dan
sesi B (bug 5 dan 6, worktree `IBM-12k-b`). Perubahan kecil di lane lain, commit terpisah: App (Aarief) di
`app/src/main/radar` dan `app/src/renderer/src/components/radar`; Bob (Umar) hanya tes `mcp` untuk D-alief-18.

## Perubahan

| Bug | Commit | Isi |
|---|---|---|
| 3. Teks bahasa Inggris | `6846ee61`, `aab0e88b`, `9ed45306`, `d5482180` | D-alief-18 (ubah R5 §1): teks server, brief dan laporan sesi dalam bahasa Inggris; nilai wire seperti `bebas` tetap |
| 2. File biner / terlalu besar | `13003c11`, `d948fb06` | sync melaporkan `rejected` sekali per file; pesan menyebut file tetap di Mac ini dan apa yang bisa dilakukan |
| 4. Bob kit ditolak | `4ff557c1`, `ead32cc1`, `d3d94b4b` | `--json-status` mengirim baris `kit`; app menampilkan tombol "Back up .bob and install the Bob kit" (membuat `.bob.bak-<waktu>/`); backup itu masuk daftar ignore |
| Ekstra | `12a5b848` | panggilan server di app lewat HTTP client utama, bukan `fetch` langsung |
| 1. Folder kosong | `55a2497f` | D-alief-19: penanda virtual `<folder>/.radar-dir` di wire, tidak pernah ditulis ke disk |
| 7. Escape | `951be715`, `6af8ed58` | Escape di konfirmasi hanya menutup konfirmasi, dan hanya kalau berasal dari dalamnya; konfirmasi = `alertdialog` |
| 8. Satu kartu | `c5d1b784` | teman yang sudah join tidak melihat kartu "X is sharing" kedua |
| 9. Keluar saat upload | `23b7d3c6` | `owner-folder.json` menyimpan `pending`; app menyelesaikan share saat dibuka lagi |
| Ekstra (silent-failure-hunter) | `d8859df9`, `55302886` | CLI mengirim `accepted`; pemberitahuan "not sent" hilang setelah file tersinkron |
| Ekstra (ditemukan di prod) | `ac15dc81` | jumlah file di status tidak menghitung file terhapus dan penanda folder kosong |
| Ekstra (react review) | `e793ec36` | pemberitahuan kit baru membuang error pemasangan lama |
| 5, 6 (sesi B) | _menunggu sesi B_ | |

## Hasil

### Versi prod

| | Version ID |
|---|---|
| Rollback (akhir fase 12j) | `208e6acc-1e00-49b7-b239-44825615b97e` |
| Deploy antara | `47e6cba5-ad94-42cb-8b58-3a0baaa73b8c`, `0f415a37-afc4-45e1-beaa-7d7448afaaf0` |
| **Live (belum memuat bug 5/6, `ffea1db3`, `569bd085`)** | `0f415a37-afc4-45e1-beaa-7d7448afaaf0` |

Canary (health, `/j/<code>`, radar-cli.tgz, WebSocket) 4/4 OK setelah tiap deploy.

### E2E di prod (dua app, profil terpisah, folder sintetis)

Owner = `af`, teman = "E2E Budi". Folder `lines`, `big` (2400 file) dan `k2`.

| Bug | Langkah | Hasil |
|---|---|---|
| 8 | B join | satu kartu workspace |
| 1 | O membuat `assets/icons/` kosong, lalu menghapusnya | muncul di B ±1 dtk, tanpa file penanda, tanpa konflik; penghapusan ikut |
| 2 | O menaruh `logo.png` biner, lalu menggantinya dengan teks | pemberitahuan muncul, lalu hilang lewat `accepted` |
| 7 | Escape di "Share a different folder?" dan "Stop sharing?" | fokus ke Cancel, Escape hanya menutup konfirmasi, fokus kembali ke pembuka; Tab/Shift+Tab bekerja |
| 9 | share `big`, app ditutup saat `pending: true` | dibuka lagi, share selesai sendiri dalam 4,8 dtk, server punya 2401 file |
| 4 | folder dengan `.bob/notes.md` milik sendiri | pemberitahuan kit muncul; tombol membuat `.bob.bak-<waktu>/notes.md` dan memasang kit; backup tidak tersinkron ke server maupun B (`k2`) |
| ekstra | hapus `src/f3.ts`, buat folder kosong | O dan B sama-sama "Syncing 3 files" |

### Verifikasi (ecc:verification-loop)

| Cek | Hasil |
|---|---|
| radar tests | common 142, server 207, sync 72, hooks 52, mcp 49, ui 11, web 56: semua lulus |
| radar typecheck + lint | bersih |
| app `tc` | lulus |
| app tes `src/renderer/src/components/radar`, `src/main/radar`, `src/shared` | 9221 lulus, 125 dilewati |
| oxlint app | 1 error lama di `WatchBobView.tsx:23` (sudah ada di `main`) |

### Review

| Review | Temuan | Tindakan |
|---|---|---|
| ecc:silent-failure-hunter | temuan 2: pemberitahuan `rejected` satu string yang tidak pernah hilang | `d8859df9`, `55302886` |
| ecc:react-reviewer | CRITICAL: listener Escape di window memakan Escape dialog lain (Sheet non-modal). MEDIUM: konfirmasi tanpa `role`/nama/deskripsi; `KitNote` menyimpan error lama | `6af8ed58`, `e793ec36` |
| ecc:typescript-reviewer | tidak ada CRITICAL/HIGH. MEDIUM: resume share saat start dan Share dari pengguna berjalan bersamaan (dua upload, `owner-folder.json` ditulis dua kali). MEDIUM laten: `new URL(url)` di catch `serverFetch` bisa melempar untuk URL rusak (semua pemanggil memakai origin tervalidasi). LOW: `skipped` di agent tidak dihapus saat file biner dihapus | `ffea1db3` (Share/Stop menunggu resume); dua lainnya dicatat |
| ecc:security-reviewer (bug 5, 6) | _sesi B_ | |
| /ecc:code-review (bagian sesi A) | APPROVE. Dicek: path traversal lewat penanda, ignore `.bob.bak-*/`, `removeEmptyFolder` hanya menghapus sampah OS, kompatibilitas baris JSON lama/baru, log tanpa token. Catatan: `kit install` keluar 0 untuk `missing-kit`, jadi tombol app melaporkan sukses | `569bd085` (exit 1 kecuali `installed`) |

### UI gate (better-interface, app terhubung ke prod)

Tangkapan: `k2-O-kit-notice.png`, `ui-O-binary-notice.png`, `ui-O-confirm-replace.png`, `ui-O-confirm-stop.png`,
`ui-O-focus-cancel.png`, `ui-B-joined.png` (scratchpad e2e). Domain yang diperiksa: aksesibilitas (jalan keyboard dan
pohon aksesibilitas lewat Playwright) dan tulisan. Layout, tipografi, warna dan motion tidak diubah fase ini; tidak
ada potongan atau tumpang tindih di tangkapan, lebar sempit tidak dicek.

| Sev | Temuan | Lokasi | Tindakan |
|---|---|---|---|
| HIGH | Pemberitahuan biner / terlalu besar menyebut masalah tanpa jalan keluar | `radar/packages/sync/src/notify.ts:23,25` | diperbaiki (`d948fb06`): "Only text files sync; it stays on this Mac." / "make it smaller to sync it." |
| LOW | Konfirmasi `alertdialog` non-modal: Tab bisa keluar ke "Make code" | `ShareFolderCard.tsx` | dibiarkan: fokus masuk ke Cancel, nama dan peringatan dibacakan, Escape dan Cancel menutup |
| LOW | Teks kit memuat placeholder `.bob.bak-<time>` | `SyncConflictsNote.tsx` (teks dari sync) | dicatat |
| — | App memakai tema Orca terang, bukan dark Carbon | profil | sudah ada sebelumnya |

### Usulan untuk Umar (radar-mcp, tidak diedit)

Teks radar-mcp yang masih berbahasa Indonesia (D-alief-18 berlaku untuk teks yang dibaca pengguna):
`mcp/src/client.ts` `MSG_UNAVAILABLE` dan error kontrak, `tools/pm/session_report.ts` "Laporan sesi",
`why_blocked` "dipegang", "diterapkan otomatis".

### Status saat berhenti (27 Sep, 15:00 WITA)

Alief meminta berhenti di sini dan push ke GitHub. Belum dikerjakan:
- Bug 5 dan 6: sesi B masih jalan di `wip/core-12k-seats` (sudah ada `6349c2db`, `1408befc`); belum di-cherry-pick.
- Deploy ulang, canary dan e2e prod penuh untuk bug 5/6 dan perbaikan app terakhir.
- Bug 10: langkah Bob IDE di `plan/fixbug.md` dijalankan Alief.
- Finish: bersihkan anggota dan folder e2e di prod (workspace sekarang `k2`, sintetis).
