# Fase 12g · Multiplayer (D-alief-12): perbaikan bug share / join / stop / switch + e2e dua app

Lane: Core (Alief). Perubahan `app/**` (lane App) kecil, aditif, dan di-commit terpisah (awalan `app:`).
Semua uji hanya ke server lokal (`pnpm -C radar dev:server`, http://localhost:8787); app dijalankan dengan
`LIVE_COLLAB_SERVER=http://localhost:8787` (lihat `deploy.md` §2). Prod tidak disentuh.

## Cara uji e2e

Dua app Electron (A dan B) dengan profil dan HOME terpisah, dikendalikan Playwright `_electron.launch()`
lewat driver HTTP kecil di scratchpad. Folder dipilih dengan `dialog.showOpenDialog` yang diganti di proses main.
Setiap bug: test gagal dulu, lalu perbaikan, satu commit per bug.

## Bug yang diperbaiki

| # | Gejala | Perbaikan (commit) |
|---|---|---|
| 1 | Kode terbuka yang sudah dipakai bisa diambil orang lain | server: 409, nama sama memutar token (D-alief-13) |
| 2 | Join ke folder yang sudah berisi file lama mengunggah file basi | app pindahkan folder lama ke `.old-<waktu>`; sync melaporkan `.radar-conflict` (D-alief-14) |
| 3 | Setelah pemilik berhenti berbagi / device lain masuk, app teman menampilkan error mentah | server/sync/app: alasan berhenti + tampilan tenang (D-alief-15) |
| 4 | Ganti role tidak mengganti kit Bob role lama | sync: kit role lain diganti |
| 5 | Kit Bob dan salinan sync ikut masuk git | sync: `.bob`, `.radar` masuk exclude |
| 6 | Copy kode gagal di renderer | app: salin lewat proses main |
| 7 | Catatan Multiplayer tertinggal setelah koneksi berganti | app: catatan terikat ke koneksi |
| 8 | 409 saat Share tidak menyebut siapa yang berbagi | server + app: pesan menyebut nama pemilik |
| 9 | Kartu Share tidak sesuai peran; "Join with a different code" tak bisa dibatalkan | app |
| 10 | Multiplayer menumpang di Settings; nama share dan join berbeda; "1 files" | app: tab sendiri, satu nama profil, bentuk tunggal |
| 11 | `.env` ikut tersinkron; aturan `!` di .gitignore bisa membuka `.radar/` | common: daftar selalu-abaikan (D-alief-16) |
| 12 | Folder yang di-rename di Mac lain meninggalkan folder kosong | sync: hapus induk kosong |
| 13 | Klik item Live Collab lain di sidebar menutup panel | app: panel tetap terbuka, tab berganti |
| — | Sync PM tidak lanjut setelah app dibuka ulang | app: `resumeMemberSync` untuk coder dan PM |
| — | `.gitignore` di subfolder diabaikan | common + sync + app (D-alief-16 butir 4) |
| 14 | Judul workspace menampilkan huruf member ("beta · B") | app: nama dari daftar member |
| 15 | Perubahan yang ditolak server tidak pernah sampai ke app | sync `--json-status` event `rejected`; app menampilkan alasannya |
| 16 | Tampilan "device lain mengambil alih" masih menampilkan "Copied <kode>" | app |
| 17 | Setelah "Share a different folder", Invite masih menampilkan kode workspace lama | app: daftar kode mulai kosong per share |
| 18 | PM melihat "(coder)" di judul | app: koneksi menyimpan role dari server; judul membaca role member |
| 19 | **Keamanan:** folder home, `~/live-collab` bisa dibagikan (dotfile seperti riwayat shell ikut terunggah); `/` gagal dengan EACCES mentah | app: `share-folder-guard.ts` menolak sebelum memanggil server; file tak terbaca disebut dengan kalimat biasa |
| 20 | Catatan konflik/tolak berwarna kuning di atas putih (≈2,9:1) | app: callout warning Orca (UI gate) |

## Bug terbuka

- Folder kosong tidak tersinkron (sesuai desain: hanya file).
- File >1 MB / biner dilewati tanpa pemberitahuan di app.
- Masih ada pesan domain berbahasa Indonesia di service server dan `common/events.ts`.
- Penolakan kit dalam mode JSON tidak dilaporkan ke app.
- Kursi member lama menumpuk di daftar "Joined" (mis. "af PM" dan "af coder"); belum ada cara menghapus member.
- Bila device yang mengambil alih lewat kode pemilik hilang, workspace hanya bisa dibersihkan dengan admin.
- Slug dari nama unicode membuang huruf non-ASCII ("Proyek Kopi ☕ é" → `proyek-kopi`); dapat diterima.
- Escape di konfirmasi "Share a different folder?" menutup seluruh panel, bukan hanya konfirmasinya.
- Kartu "Budi is sharing X…" di atas kartu workspace teman mengulang informasi (MEDIUM, lihat tabel UI).
- Pra-ada di main, bukan dari cabang ini: 4 test `components/sidebar/Sidebar.test.tsx` gagal karena `window.api.radar` tidak di-stub.

## Verifikasi

| Perintah / interaksi | Hasil |
|---|---|
| `pnpm -C radar test` | semua paket lulus (563 test) |
| `vitest src/main/radar src/renderer/src/components/radar` | lulus (77 + 57) |
| `pnpm -C app tc` | bersih |
| `check:code-quality:changed` (dengan `diff.relative=true`, lihat catatan) | lulus, 0 temuan |
| oxlint pada semua file app yang berubah | bersih |
| e2e: share folder, unicode/emoji/spasi di nama file, edit/buat/hapus/atomic save dua arah | lulus |
| e2e: edit bersamaan → `.radar-conflict` + catatan di app | lulus |
| e2e: file >1 MB dilewati, symlink tidak disinkron | lulus |
| e2e: Stop sharing → kode lama 404, teman melihat pemberitahuan tenang | lulus |
| e2e: switch folder (B "Share a different folder" → gamma) → A "The owner stopped sharing…" | lulus |
| e2e: restart kedua app; PM lanjut sync setelah restart | lulus |
| e2e: server restart → "Reconnecting" lalu kembali online | lulus |
| e2e: kode terbuka dipakai nama lain → 409; nama sama → A "You joined from another device" | lulus |
| e2e: kode pemilik dua kali → B "Another device took over as owner", tanpa "Copied" lama | lulus |
| e2e: PM mengedit file → `readme.md.radar-rejected` + "A PM does not write files…" | lulus |
| e2e: sidebar Team saat panel terbuka → panel tetap, tab Team | lulus |
| e2e: share home, `/` → "Pick one project folder…", workspace lama tidak tersentuh | lulus |
| e2e: folder "Proyek Kopi ☕ é" → A bergabung ke `~/live-collab/proyek-kopi` | lulus |
| Keyboard: Tab melalui panel A dan B | urutan logis, fokus terkunci di panel, semua kontrol bernama |
| Keluar app di tengah upload | **Not verified** (sulit diatur waktunya) |
| Hook Bob / radar-mcp setelah switch | **Not verified** (butuh Bob IDE) |
| Lebar sempit (390) | **Not verified** (panel desktop) |

Catatan: `check:code-quality:changed` tanpa `diff.relative` tidak menemukan file berubah di monorepo ini (path diff relatif ke root repo), jadi dijalankan dengan
`GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=diff.relative GIT_CONFIG_VALUE_0=true`.

## UI gate (better-interface)

Scope: panel Live Collab → Multiplayer (tampilan pemilik, teman coder/PM, catatan ditolak, switch, penolakan folder, takeover), tema terang, 1440 px.
Stack: React + Tailwind + token Orca (`main.css`), `docs/STYLEGUIDE.md`, `app/AGENTS.md`.
Bukti: screenshot `a8`–`a16`, `b8`–`b15` (scratchpad e2e), warna terhitung lewat `getComputedStyle`, penelusuran Tab.
Skill domain tidak dimuat satu per satu; aksesibilitas (nama, keyboard, fokus, kontras) diverifikasi saat runtime, domain lain ditinjau dari screenshot saja.

| Severity | Domain | Lokasi | Sebelum | Sesudah | Alasan |
|---|---|---|---|---|---|
| HIGH (diperbaiki) | Colors | `app/src/renderer/src/components/radar/SyncConflictsNote.tsx:16,24` | `text-[var(--lc-warn)]` = #ca8a04 di atas #fff | callout `border-status-warning-border bg-status-warning-background text-foreground` + ikon `AlertCircle` | Kontras teks ≈2,9:1, di bawah 4,5:1 |
| MEDIUM (terbuka) | Layout | `app/src/renderer/src/components/radar/ShareFolderCard.tsx:340` | teman melihat kartu "Budi is sharing X…" di atas kartu workspace-nya | sembunyikan saat teman sudah bergabung ke workspace yang sama | Informasi ganda menggeser tindakan utama ke bawah |
| LOW (terbuka) | Writing | `JoinWithCodeCard.tsx` catatan "Joined … moved to <path panjang>" | path lengkap | cukup "Show folder" | Path panjang sulit dibaca |

Kontras lain yang diukur: `--lc-ok` #15803d (≈5,0:1), muted #737373 (≈4,7:1), destructive #e40014 (≈4,6:1): lulus.
Verdict: **Approve** (tidak ada HIGH tersisa).
