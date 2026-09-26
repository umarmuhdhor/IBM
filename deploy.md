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

## 4. Cara pakai: pemilik (Mission Control)

### 4.1 Cara utama: bagikan folder project dari app

1. Buka app → **Live Collab** → **Settings** → kartu **Share a folder**.
2. Isi nama dan peran (**Coder** atau **PM**), lalu klik **Choose folder and share…** dan pilih folder project di Mac.
3. App mengunggah file teks folder itu ke server (mengikuti `.gitignore`; file biner dan file di atas 1 MB tetap lokal; maksimal 3000 file). Folder **tetap di tempatnya** dan tersinkron live. Anda menjadi member A sekaligus Mission Control.
4. Kode gabung pertama otomatis tersalin. Kirim ke satu teman. Kode ini juga muncul di kartu **Invite teammates**.
5. Klik **Open in IBM Bob** untuk mulai kerja di folder itu.
6. Saat app dibuka lagi, folder pemilik tersinkron lagi otomatis.

Aturan server:

- Satu server hanya punya satu workspace aktif.
- Server kosong boleh diklaim siapa pun yang membagikan folder pertama kali.
- Kalau server sudah punya workspace, hanya pemiliknya (app yang terhubung sebagai Mission Control) yang boleh membagikan folder lain lewat **Share a different folder…**. **Ini menghapus semua task, kunci, file, dan anggota di server.** File di Mac tidak disentuh. Teman perlu kode baru.
- Proposal di workspace dari folder hanya menjadi commit lokal di server. Tidak ada push ke GitHub.

### 4.2 Cara lain: workspace dari admin CLI (repo demo)

1. Setelah `admin init` (bagian 3.2), buka **Live Collab** → **Settings**.
2. Klik **Workspace owner? Use your owner code**, masukkan kode owner, lalu klik **Connect**. App sekarang tersambung sebagai Mission Control, tanpa folder tersinkron.
   Cara lama masih ada: bagian lipat **Have a Mission Control token instead? Connect manually**, lalu tempel token `mc`.

Setiap pemakaian kode owner mengganti token `mc`. Perangkat Mission Control sebelumnya ikut terputus.

### 4.3 Mengundang dan mengelola tim

1. Di kartu **Invite teammates**, klik **Make code**. Kode langsung tersalin ke clipboard. Bagikan ke satu orang. Satu kode = satu anggota.
2. Anggota yang sudah bergabung muncul di daftar **Joined** dan di tab Team.
3. Dari Mission Control: lihat siapa memegang file apa, setujui atau tolak proposal dan permintaan, cabut kunci, dan batalkan task.

## 5. Cara pakai: anggota tim (Coder / PM)

1. Pasang app dari `.dmg` dan buka.
2. **Live Collab** → **Settings** → kartu **Join a workspace**: isi kode dari pemilik, nama, dan peran (**Coder** atau **PM**), lalu klik **Join**.
3. App menyinkronkan file ke `~/live-collab/<workspace>` dan memasang kit Bob. Klik **Open in IBM Bob**.
4. Di IBM Bob IDE: klik **Trust**, lalu pilih mode **Live Collab Coder** (atau **PM Lead** untuk PM).
5. Kerja seperti biasa di Bob:
   - Perubahan file tersinkron live ke semua anggota.
   - File yang sedang dipegang rekan dikunci. Bob akan diblokir dan masuk antrean, bukan menimpa.
   - Setiap prompt mendapat brief singkat: siapa memegang apa dan keputusan terbaru.
   - PM Lead mengusulkan task dan pembagian file. Manusia yang menyetujui di Mission Control.
6. Saat app dibuka lagi, sinkron berjalan sendiri.

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
| "This server already has the workspace …" saat Share a folder | Server sudah dipakai orang lain. Minta kode gabung ke pemiliknya, atau deploy server sendiri (bagian 3.1). |
| "more than 3000 files to share" | Tambahkan folder build atau data ke `.gitignore`, atau pilih folder yang lebih kecil. |
| `ADMIN_SECRET is not set` | Set env di shell yang sama. Jangan kirim secret sebagai argumen. |
| App tidak bisa menyimpan koneksi | Keychain macOS terkunci. Buka kunci, lalu coba lagi. |
