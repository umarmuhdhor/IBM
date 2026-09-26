# Deploy dan cara pakai IBM Bob Live Collab

Panduan singkat: cara menjalankan server dan app, lalu cara tim memakainya.
Bagian 1–3 untuk yang men-deploy server. Bagian 4 untuk pemilik workspace, bagian 5 untuk anggota tim.

Komponen:

| Bagian | Lokasi | Jalan di |
|---|---|---|
| Collab Server (Worker + Durable Object) | `radar/packages/server` | Cloudflare Workers, sekarang di `https://live-collab.afindo-mi01.workers.dev` |
| Sync agent + CLI `radar` | `radar/packages/sync` | Mac tiap anggota (dibawa di dalam app) |
| Kit Bob (mode, hook, `radar-mcp`) | `radar/bob-kit`, `radar/packages/{hooks,mcp}` | IBM Bob IDE tiap anggota (dipasang app otomatis) |
| App desktop (fork Orca) | `app/` | macOS (`.dmg`) |
| Landing + replay | `radar/packages/web` | Cloudflare Pages |

## 1. Prasyarat

- macOS (Apple Silicon untuk `.dmg` yang dibangun di sini).
- Node 24 dan pnpm 12: `nvm use 24`, lalu `corepack enable`.
- IBM Bob IDE terpasang di Mac tiap anggota.
- Hanya untuk pemilik: akun Cloudflare (`npx wrangler login`) dan GitHub PAT dengan akses tulis ke repo demo (untuk commit dari proposal).

Pasang dependensi sekali:

```bash
pnpm -C radar install
```

```bash
pnpm -C app install
```

Semua secret disimpan di luar git. Repo ini publik.

## 2. Jalankan secara lokal (tanpa Cloudflare)

Server lokal (`wrangler dev`). Isi `radar/packages/server/.dev.vars` (git-ignored) dengan `ADMIN_SECRET=<nilai acak>` dan, bila perlu, `GITHUB_TOKEN=<PAT>`.

```bash
pnpm -C radar dev:server
```

Atau mock server tanpa Durable Object, cukup untuk UI dan test:

```bash
pnpm -C radar dev:mock
```

App desktop dalam mode dev:

```bash
pnpm -C app dev
```

Web (landing + replay):

```bash
pnpm -C radar dev:web
```

Test dan pemeriksaan:

```bash
pnpm -C radar test
```

```bash
pnpm -C radar typecheck
```

## 3. Deploy (pemilik workspace)

### 3.1 Server

Pasang secret sekali. Wrangler akan meminta nilainya, jadi nilai tidak masuk ke riwayat shell.

```bash
pnpm -C radar/packages/server exec wrangler secret put ADMIN_SECRET
```

```bash
pnpm -C radar/packages/server exec wrangler secret put GITHUB_TOKEN
```

Variabel non-secret (`WORKSPACE_ID`, `GITHUB_REPO`, `GITHUB_COMMIT`, …) ada di `radar/packages/server/wrangler.jsonc`. Deploy:

```bash
pnpm -C radar deploy:server
```

Deploy juga membangun `public/radar-cli.tgz`, yang dipakai perintah gabung satu baris (`curl … /j/<kode> | sh`).

### 3.2 Buat workspace

Simpan `ADMIN_SECRET` yang sama di file di luar repo (misalnya `~/.live-collab-admin`, `chmod 600`). Lalu, dari clone repo demo:

```bash
ADMIN_SECRET="$(cat ~/.live-collab-admin)" pnpm -C radar admin init --server https://live-collab.afindo-mi01.workers.dev --workspace toko-demo --repo aliefauzan/toko-demo --repo-dir /path/ke/clone/toko-demo --force
```

- `--repo-dir` mengimpor file repo demo ke workspace.
- `--force` menimpa workspace lama. **Semua task, kunci, file, dan token lama dihapus.**
- Tanpa `--member`, workspace mulai kosong. Teman bergabung dengan kode terbuka dan mengisi nama serta peran sendiri.

Output berisi token `mc` dan **kode owner** (`mc  XXXX-XXXX`). Simpan keduanya di password manager tim. Jangan tempel di chat publik.

Perintah admin lain:

| Perintah | Guna |
|---|---|
| `admin code --server <url> --owner` | kode owner baru (bila kode lama kedaluwarsa, default 72 jam) |
| `admin code --server <url>` | satu kode terbuka untuk teman |
| `admin code --server <url> --member B` | kode untuk member yang sudah ada (pindah Mac) |
| `admin token --server <url> --member mc` | token `mc` baru (cara lama) |
| `admin export --server <url> --out events.json` | ekspor event untuk replay |
| `admin reset --server <url> --confirm` | kosongkan workspace |

### 3.3 App `.dmg`

```bash
pnpm -C app build:mac
```

Hasilnya `app/dist/orca-macos-arm64.dmg`. Build lokal tidak ditandatangani, jadi pengguna membuka app pertama kali lewat klik kanan → **Open**. Bagikan `.dmg` lewat tautan privat. Jangan commit `.dmg` ke repo.

### 3.4 Web (opsional)

```bash
pnpm -C radar deploy:web
```

## 4. Cara pakai: pemilik workspace

Pemilik (owner) = orang yang membagikan folder project-nya. Owner juga ikut coding (member A) sekaligus memegang Mission Control.

### 4.1 Mulai multiplayer: buka folder, klik Share, kirim kode

1. Buka app **IBM Bob Live Collab**.
2. Buka folder project: **Projects** → **Open**, lalu pilih folder di Mac Anda.
3. Di sidebar kiri, bagian **LIVE COLLAB**, klik **Multiplayer**.
4. Klik **Share <nama-folder>**.
   - Tidak ada folder yang terbuka? Tombolnya **Choose folder and share…** dan membuka pemilih folder.
5. Tunggu beberapa detik. App mengunggah file project ke server.
6. Kode gabung (misalnya `K7QM-3XPA`) tampil besar dan **otomatis tersalin**. Kirim kode itu ke satu teman lewat chat pribadi.
7. Untuk teman berikutnya, klik **Make code** di kartu **Invite teammates**. Satu kode = satu orang. Kode berlaku 72 jam.
8. Klik **Open in IBM Bob**. Di IBM Bob IDE klik **Trust**, lalu pilih mode **Live Collab Coder**.

Yang terjadi di balik layar:

- Folder **tidak dipindah**. Folder itu yang tersinkron live ke semua anggota.
- Nama Anda diambil dari `git config user.name`, atau nama akun Mac bila kosong. Peran Anda Coder.
- File mengikuti `.gitignore`. File biner dan file di atas 1 MB tetap lokal. Maksimal 3000 file.
- Proposal yang disetujui hanya menjadi commit lokal di server. Tidak ada push ke GitHub.
- Saat app dibuka lagi, folder owner tersinkron lagi otomatis.

### 4.2 Mengelola tim

1. Anggota yang sudah bergabung muncul di daftar **Joined** (kartu Invite teammates) dan di tab **Team**.
2. Dari **Mission Control**: lihat siapa memegang file apa, setujui atau tolak proposal dan permintaan, cabut kunci, dan batalkan task.

### 4.3 Ganti project atau gantian owner

Satu server hanya bisa memegang **satu workspace pada satu waktu**. Untuk pindah project, owner yang sekarang harus menghentikan sharing dulu. Setelah itu siapa pun di tim bisa membagikan folder berikutnya.

Contoh: Alief sedang share project A. Tim ingin pindah ke project B milik Sari.

1. **Alief** (owner sekarang) → **Multiplayer** → **Stop sharing…** → baca peringatannya → klik **Stop sharing**.
   - Server dikosongkan: task, kunci, dan daftar anggota project A dihapus.
   - Semua anggota terputus dan sync berhenti.
   - **File di Mac semua orang tetap ada.** Tidak ada file yang dihapus.
2. **Sari** membuka folder project B di app → **Multiplayer** → **Share <project-B>**. Sari sekarang owner. Kode tersalin di Mac Sari.
3. Sari mengirim kode ke Alief dan anggota lain.
4. **Alief** dan anggota lain → **Multiplayer** (atau **Settings**) → kartu **Join a workspace**:
   - Kalau kartu masih menampilkan workspace lama, klik **Join with a different code**.
   - Isi kode dari Sari, nama, dan peran, lalu klik **Join**.
   - File project B tersinkron ke `~/live-collab/<project-B>`.

Cara lain tanpa menghentikan sharing: owner sekarang bisa klik **Share a different folder…**, lalu pilih folder lain di Mac-nya sendiri. Workspace lama juga dihapus, dan semua anggota perlu kode baru.

Aturan server:

- Server kosong boleh diklaim oleh siapa pun yang pertama klik **Share**.
- Selama ada workspace, hanya owner-nya yang bisa **Stop sharing** atau **Share a different folder…**. Orang lain yang klik Share akan melihat pesan "This server already has the workspace …".
- Butuh dua project jalan bersamaan? Deploy server kedua (bagian 3.1) dengan nama Worker lain.

### 4.4 Cara lain: workspace dari admin CLI (repo demo)

Untuk demo dengan repo GitHub `toko-demo` (commit dari proposal di-push ke GitHub):

1. Jalankan `admin init` (bagian 3.2).
2. Di app buka **Live Collab** → **Settings** → **Workspace owner? Use your owner code**, masukkan kode owner, lalu klik **Connect**. App tersambung sebagai Mission Control, tanpa folder tersinkron.
   Cara lama masih ada: bagian lipat **Have a Mission Control token instead? Connect manually**, lalu tempel token `mc`.

Setiap pemakaian kode owner mengganti token `mc`. Perangkat Mission Control sebelumnya ikut terputus.

## 5. Cara pakai: anggota tim (Coder / PM)

1. Pasang app dari `.dmg` dan buka.
2. Di sidebar **LIVE COLLAB** klik **Multiplayer** (atau **Settings**). Di kartu **Join a workspace**: isi kode dari owner, nama, dan peran (**Coder** atau **PM**), lalu klik **Join**.
3. App menyinkronkan file ke `~/live-collab/<workspace>` dan memasang kit Bob. Klik **Open in IBM Bob**.
4. Di IBM Bob IDE: klik **Trust**, lalu pilih mode **Live Collab Coder** (atau **PM Lead** untuk PM).
5. Kerja seperti biasa di Bob:
   - Perubahan file tersinkron live ke semua anggota.
   - File yang sedang dipegang rekan dikunci. Bob akan diblokir dan masuk antrean, bukan menimpa.
   - Setiap prompt mendapat brief singkat: siapa memegang apa dan keputusan terbaru.
   - PM Lead mengusulkan task dan pembagian file. Manusia yang menyetujui di Mission Control.
6. Saat app dibuka lagi, sinkron berjalan sendiri.
7. Owner menghentikan sharing? Sync berhenti dan file tetap di Mac Anda. Untuk project berikutnya, klik **Join with a different code** dan masukkan kode baru (lihat 4.3). Anda juga bisa menjadi owner berikutnya dengan **Share** folder Anda sendiri.

Alternatif tanpa app (terminal):

```bash
curl -fsSL https://live-collab.afindo-mi01.workers.dev/j/<KODE> | sh
```

Perintah ini memasang Node dan CLI di `~/.radar`, menukar kode, menyinkronkan folder, lalu membuka IBM Bob IDE.

## 6. Masalah umum

| Gejala | Penyebab dan solusi |
|---|---|
| "This join code is wrong or has expired" | Kode salah ketik atau lewat 72 jam. Minta kode baru. |
| "Enter your name and pick a role to join" | Kode terbuka butuh nama dan peran. |
| 409 "already has 8 members" | Workspace penuh (A–H). |
| Token lama tidak berlaku | Kode dipakai lagi di perangkat lain. Perangkat terbaru yang menang. |
| Mission Control terputus | Kode owner atau `admin token --member mc` dipakai lagi. Sambung ulang dengan kode owner. |
| "This server already has the workspace …" saat Share | Server masih dipakai project lain. Minta owner-nya klik **Stop sharing** (4.3), atau minta kode gabung darinya. |
| Sync berhenti, "Workspace reset" | Owner menghentikan sharing atau mengganti folder. Minta kode baru, lalu **Join with a different code**. |
| "more than 3000 files to share" | Tambahkan folder build atau data ke `.gitignore`, atau pilih folder yang lebih kecil. |
| `ADMIN_SECRET is not set` | Set env di shell yang sama. Jangan kirim secret sebagai argumen. |
| App tidak bisa menyimpan koneksi | Keychain macOS terkunci. Buka kunci, lalu coba lagi. |
