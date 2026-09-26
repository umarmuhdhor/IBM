# Fase 12 (lanjutan) · IN-03 di app: download app, masukkan kode, langsung gabung

Lane: Core (Alief), lintas lane `app/**` atas permintaan user (lihat D-alief-09, tambahan 26 Sep).

## Alur yang diuji

- **Teman:** buka app → Live Collab → Settings → isi *Join code* → **Join**. App menukar kode (`POST /v1/join`), menyimpan koneksi (safeStorage), menjalankan sync agent bawaan (`radar join` dengan Electron sendiri), memasang kit Bob di `~/live-collab/<ws>/.bob`, lalu **Open in IBM Bob**.
- **Pemilik:** app tersambung sebagai Mission Control → Settings/Team → **Invite teammates** → **Make code** per member → **Copy**.
- **Buka ulang app:** koneksi member tersimpan → sinkron lanjut otomatis (`radar start`).

## Isi perubahan

- `radar/packages/sync/scripts/bundle-standalone.mjs`: bundle CLI satu file (esbuild, semua dependensi) + salin bob-kit.
- `app/config/scripts/build-radar-cli.mjs`, `package.json` (`build:radar-cli`, dipanggil `dev` dan `build:desktop`), `electron-builder.config.cjs` (extraResources `radar-cli`), `.gitignore`.
- Main: `src/main/radar/{join,sync-agent,node-shim}.ts` (baru), `connection-ipc.ts` (`startClient` diekspor; lupakan koneksi juga menghentikan sync), `secure-store.ts` (`requireOsEncryption` diekspor), `startup/main-process-ipc-bootstrap.ts` (1 baris).
- Preload: `radar-join-bridge.ts` (baru), `radar-bridge.ts` (spread).
- Renderer: `JoinWithCodeCard.tsx`, `InviteCodesCard.tsx` (baru), `RadarPanel.tsx` (baris render).
- Shared: `src/shared/radar-join.ts`.
- Server: pesan 404 `/v1/join` kini bahasa Inggris (UI app berbahasa Inggris); dideploy (versi 63d59d3c).
- Test: `src/main/radar/join.test.ts` (6).

## Verifikasi

| Perintah / interaksi | Hasil |
|---|---|
| `pnpm -C app run typecheck` | bersih |
| `pnpm -C app run check:code-quality:changed` | lulus (0 temuan) |
| `pnpm -C app test src/main/radar` | 29 lulus |
| `pnpm -C app test src/renderer/src/components/radar src/shared` | 9075 lulus, 0 gagal |
| `pnpm -C radar/packages/server test` | 170 lulus |
| App dev (HOME terisolasi + keychain sendiri), kode D → Join | "Syncing 18 files", folder + `.bob` (mcp.json, hooks, radar-mcp.js) ada, header "2 online" |
| Edit `index.html` di folder D → cek folder A (`radar join` Alief) | baris muncul di A < 6 s; dihapus lagi, ikut terhapus |
| `ELECTRON_RUN_AS_NODE=1 <Electron> -e …` dengan stdin | jalan (Node 24.21.0), jadi shim `node` bisa menjalankan hook Bob |
| Tutup app | proses sync ikut berhenti |
| Buka ulang app | `radar start` jalan sendiri, status "syncing", 18 file |
| Sambung sebagai `mc` → Make code (D) | kode `XXXX-XXXX` + Copy + "until <hari jam>" |
| Kode salah `ABCD-EFGH` | field merah (`aria-invalid`), pesan server tampil di bawah tombol |
| Open in IBM Bob pada Mac tanpa Bob | **Not verified** (Bob terpasang di Mac ini; jalur fallback membuka Finder) |
| Mac teman tanpa Node sama sekali | **Not verified** lewat app (shim `node` hanya ditulis bila login shell tidak punya `node`); jalur yang sama sudah diuji untuk `join.sh` |

## UI gate (better-interface)

Scope: `JoinWithCodeCard.tsx`, `InviteCodesCard.tsx`, render di `RadarPanel.tsx`; state kosong, error, joined, pemilik (mc). Tema terang diukur; tema gelap Not verified. Konvensi: `app/docs/STYLEGUIDE.md`, `app/AGENTS.md`.

| Domain | Bukti | Hasil |
|---|---|---|
| Accessibility | label pembungkus, `role=status`, tombol native, fokus Orca | 2 temuan (diperbaiki) |
| Layout | screenshot 1512 px, urutan penting untuk mc | 3 temuan (diperbaiki) |
| Writing | semua teks tombol/pesan | 3 temuan (diperbaiki) |
| Typography | ukuran/weight vs pane Connection | Clear (truncate dicatat di Accessibility) |
| Colors | #737373 di #ffffff = 4.74:1; kode #0a0a0a di #f5f5f5 ≈ 18:1 | Clear |
| UI | tanpa animasi; radius/shadow dari primitive Orca | Clear |

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| HIGH | Accessibility | `InviteCodesCard.tsx:52` | `<span className="w-28 truncate">` | `min-w-28`, tanpa truncate | nama panjang terpotong tanpa cara melihat nilai penuh |
| HIGH | Writing | `InviteCodesCard.tsx:41` | "Each use signs that member in on the new device." | "…signs that member in on the new Mac and signs out their previous device." | teks menyembunyikan bahwa perangkat lama ter-logout |
| HIGH | Writing | `JoinWithCodeCard.tsx:48,129` | pesan "Joined … as D" tetap tampil setelah Forget connection | pesan terikat ke koneksi (`note.key`), hilang saat koneksi berganti | status basi menyesatkan |
| MEDIUM | Accessibility | `JoinWithCodeCard.tsx:125` | `disabled={busy \|\| code.trim().length < 8}` | `disabled={busy}`; validasi saat submit, `aria-invalid` + `aria-describedby` ke pesan | tombol mati tanpa penjelasan |
| MEDIUM | Layout | `RadarPanel.tsx` settings | kartu Join tampil untuk Mission Control di atas Invite | mc hanya melihat Invite teammates | urutan penting; Join akan mengganti koneksi mc |
| MEDIUM | Layout | `JoinWithCodeCard.tsx:102` | input kode selebar pane (≈1400 px) | `max-w-xs` | kolom 9 karakter tidak perlu selebar layar |
| MEDIUM | Writing | `InviteCodesCard.tsx:25`, server `routes.ts:64` | error generik; pesan server bahasa Indonesia | tampilkan pesan server; pesan server bahasa Inggris | penyebab asli (mis. rate limit) hilang; bahasa campur |
| LOW | Layout | `JoinWithCodeCard.tsx:120` | tautan "Use another server" menjorok di baris sendiri | di baris aksi setelah Join | tepi rata |
| LOW | Writing | `InviteCodesCard.tsx:32` | `clipboard.writeText` gagal tanpa pesan | "Unable to copy. Select … and copy it by hand." | error tanpa jalan keluar |

Tercatat, di luar scope (pane Connection milik lane App): dua tombol terisi dalam satu view (Open in IBM Bob + Connect); header "N online" tetap tampil sesaat setelah Forget connection.

Verdict: **Approve** (semua HIGH diperbaiki, dicek ulang dengan screenshot).

## Tambahan 26 Sep: kode terbuka, tanpa data demo (D-alief-10)

Permintaan user: kartu **Invite teammates** tidak lagi menampilkan member hasil seed (A · Alice, B · Budi, …). Awalnya hanya tombol **Make code**; nama dan peran baru muncul setelah teman memakai kode dan mengisi nama + peran sendiri.

- Server: `POST /v1/join-codes` / `/admin/join-code` tanpa `member` membuat kode terbuka (`join_code.member_id` NULL, skema v2, migrasi v1→v2 membuang kode lama). `POST /v1/join {code, name, role}` pada kode terbuka membuat member baru di id kosong pertama A–H (warna dari palet, event `member.created`), lalu kode terikat ke member itu; pemakaian berikutnya masuk sebagai member yang sama (nama/peran diabaikan). Tanpa nama/peran = 422; workspace penuh (8) = 409.
- `admin init` boleh tanpa `--member`; `admin code` tanpa `--member` mencetak satu kode terbuka. Skrip `curl …/j/<kode> | sh` menanyakan nama dan peran lewat `/dev/tty`.
- App: kartu Join punya kolom **Your name** dan pilihan **Coder / PM**; kartu Invite = tombol Make code, daftar kode yang dibuat (Copy, masa berlaku), dan daftar **Joined** (nama + peran) dari state server.

### UI gate (better-interface)

Scope: `InviteCodesCard.tsx` (dirender, screenshot app dev 3024 px, koneksi mc ke workspace live), `JoinWithCodeCard.tsx` kolom nama + peran (source saja; state belum-join tidak dirender karena akan memutus koneksi mc: Not verified visual). Konvensi: `app/AGENTS.md`, `app/CLAUDE.md`.

| Domain | Bukti | Hasil |
|---|---|---|
| Accessibility | tombol native, `role=status`, label pembungkus untuk nama, `aria-labelledby` untuk ToggleGroup, fokus dari primitive Orca | Clear |
| Layout | screenshot: tombol, daftar kode, daftar Joined berurutan; tanpa lebar tetap yang memotong | Clear |
| Writing | deskripsi menyebut nama + peran dan "One code adds one person" | 1 LOW |
| Typography / Colors / UI | token dan primitive Orca yang sama dengan kartu sebelumnya, tanpa animasi | Clear |

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| LOW | Writing | `InviteCodesCard.tsx` daftar kode | kode yang sudah dipakai tetap tampil tanpa status | dicatat, tidak diubah | server tidak mengirim kode mana yang dipakai siapa; nama muncul di Joined |

Verdict: **Approve** (tanpa HIGH). Workspace live masih berisi A–D hasil seed sampai server di-deploy dan `admin init --force` dijalankan tanpa `--member`.

### Tambahan: gaya Google Docs (26 Sep)

Teman hanya mengisi kode, nama, peran. Kartu Join tidak lagi punya "Use another server" (selalu `DEFAULT_RADAR_SERVER`). Form Connection manual (Server URL, Workspace, Member, token) dilipat dalam `<details>`: "Connection details" bila sudah terhubung, "Workspace owner? Connect Mission Control with a token" bila belum; terbuka otomatis saat ada `connectionFailure`. Kode baru langsung disalin ke clipboard. UI gate: screenshot Settings (mc) setelah perubahan, disclosure native (keyboard + fokus bawaan browser), tanpa temuan HIGH.

## Tambahan 27 Sep · kode owner (D-alief-11)

Pemilik menukar kode owner pendek (dari `admin init` / `admin code --owner`) di kartu Join, tanpa menempel token `mc`.

| Perintah / interaksi | Hasil |
|---|---|
| `pnpm -C radar --filter @radar/server exec vitest run` | 175 lulus (termasuk kode owner + migrasi v2→v3) |
| `vitest run admin.test.ts` (radar/scripts) | 17 lulus |
| `vitest run src/main/radar src/renderer/src/components/radar` (app) | 73 lulus |
| `pnpm -C app run typecheck:node`, `typecheck:web` | bersih |
| App dev (HOME terisolasi, belum terhubung) → Settings | kartu Join tampil; tautan **Workspace owner? Use your owner code** mengganti form ke kode owner saja, fokus pindah ke kolom kode |
| Tukar kode owner di app ke server live | **Not verified** (butuh server v3 terdeploy + kode owner dari `admin init`) |

UI gate (better-interface), scope: `JoinWithCodeCard.tsx` mode teman dan mode owner, `RadarPanel.tsx` label lipat. Layar 1512 px, tema terang; tema gelap dan lebar sempit Not verified.

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| MEDIUM | Writing | `RadarPanel.tsx:103` | dua pilihan berawalan "Workspace owner?" (tautan kode owner + lipatan token) | lipatan: "Have a Mission Control token instead? Connect manually" | dua jalan dengan awalan sama membingungkan; kode owner jadi jalan utama |
| MEDIUM | Accessibility | `JoinWithCodeCard.tsx` tombol ganti mode | fokus tetap di tombol yang labelnya berubah | fokus pindah ke kolom kode | judul dan kolom berubah tanpa diumumkan ke pembaca layar |

Tidak ada temuan HIGH. Colors, Typography, UI: Clear (primitive Orca yang sama dengan mode teman).

## Tambahan 27 Sep · pemilik membagikan folder lokal (D-alief-12)

Pemilik memilih folder project di Mac-nya. Folder itu jadi workspace, tetap di tempatnya, dan tersinkron live sebagai member A. Kode pertama otomatis tersalin.

| Perintah / interaksi | Hasil |
|---|---|
| `pnpm -C radar --filter @radar/server test` | 180 lulus (termasuk `open-workspace.test.ts` dan commit lokal tanpa base commit) |
| `pnpm -C radar typecheck` | bersih |
| `vitest run src/main/radar src/renderer/src/components/radar` (app) | 84 lulus (termasuk `open-folder.test.ts`, `ShareFolderCard.test.tsx`) |
| `pnpm -C app run typecheck:node`, `typecheck:web`; `oxlint` file yang diubah | bersih |
| App dev (HOME terisolasi, belum terhubung) → Settings | kartu **Join a workspace** lalu **Share a folder** (nama, peran, **Choose folder and share…**) |
| Pemilih folder native + unggah ke server nyata | **Not verified** lewat UI (dialog native tidak bisa dikendalikan lewat CDP); alurnya diuji di `open-folder.test.ts` dan test route server |
| Tampilan pemilik (folder tersinkron, **Share a different folder…**, konfirmasi) | Not verified secara visual; diuji di `ShareFolderCard.test.tsx` |

UI gate (better-interface), scope: `ShareFolderCard.tsx`, `RadarPanel.tsx` slot kartu. Layar 1512 px, tema terang.

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| MEDIUM | Writing | `routes.ts` pesan 409 | "Only its owner can open a different folder." | "Ask its owner for a join code, or use your own server to share a folder." | pesan error harus memberi jalan keluar |

Tidak ada temuan HIGH. Aksi destruktif (ganti folder) memakai konfirmasi di halaman, teks peringatan merah, dan tombol varian `destructive`.

### Revisi: satu klik (permintaan user "buka folder, klik share, dapat kode")

- Sidebar **LIVE COLLAB** punya item pertama **Multiplayer** (membuka Settings, kartu Multiplayer paling atas).
- Kartu Multiplayer tanpa form: **Share <folder yang terbuka>**, atau **Choose folder and share…** bila tidak ada folder terbuka. Nama owner otomatis (`git config user.name`, lalu nama akun Mac).
- Tampilan owner: nama folder, status sync, kode besar + **Copy code**, **Open in IBM Bob**, **Show folder**, **Share a different folder…** (konfirmasi di halaman, tombol `destructive`).
- Test app radar: 85 lulus. Typecheck node/web dan oxlint bersih.
- Screenshot app dev (HOME terisolasi, tanpa folder terbuka): item Multiplayer di sidebar, kartu Multiplayer di atas kartu Join. Tampilan dengan folder terbuka dan tampilan owner: Not verified secara visual (diuji di `ShareFolderCard.test.tsx`). Tanpa temuan HIGH.
