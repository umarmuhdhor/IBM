# Fase 00 — Fondasi: fork Orca, workspace `radar/`, template IBM, toko-demo, ECC

| Field | Nilai |
|---|---|
| Jalur | **Lane A** (Orang 1), dikerjakan **di `main`**. Lane B/C membantu di langkah manual. |
| Slot WITA | Jum 25 Sep 23:00 – Sab 26 Sep 00:30 |
| Estimasi | 1,5 jam (fork sudah disiapkan sebelum kickoff oleh Aarief, lihat PLAN.md §5.1) |
| Prasyarat | – |
| Requirement PRD | §12 stack, §16 R0, NFR-04, NFR-07, NFR-10, NFR-11 |
| Model | Sonnet 5 · effort medium |
| Bob slice | **A1**: toko-demo ditulis Bob IDE |
| Fase berikutnya | Lane A: **02** · Lane B: **01** · Lane C: **09** |

## Tujuan

Menyiapkan satu repo publik `ibm-bob-live-collab` (fork Orca) yang langsung bisa dipakai tiga lane secara paralel:
- workspace pnpm `radar/` dengan 7 paket kosong yang bisa di-build dan di-test,
- file keamanan dari template IBM digabung tanpa merusak Orca,
- repo contoh `toko-demo`,
- ECC terverifikasi,
- script bukti Bob tersedia sejak jam pertama,
- dokumen (PRD, PLAN, DESIGN, plan/) pindah ke dalam repo,
- branch `lane/core`, `lane/bob`, `lane/app` dibuat.

## Bacaan wajib

- `../PLAN.md` §2, §3, §6, §7 · `ref/R1-struktur-repo.md` · `ref/R5-konvensi.md` (terutama §8) · `ref/R7-bukti-bob.md`
- PRD §12, §15, §16, §17 (eksperimen), §18
- `orca:AGENTS.md`, `orca:CLAUDE.md`, `orca:pnpm-workspace.yaml` (komentar tentang `mobile/` sebagai workspace terpisah)

## Output

- Repo GitHub `<akun>/ibm-bob-live-collab` (fork `stablyai/orca`), `main` berisi commit fase 00
- `.gitignore` (Orca + blok template IBM), `.bobignore`, `SECURITY.MD`, `.env.example` di root
- `radar/` lengkap: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.nvmrc`, `packages/{common,server,sync,hooks,mcp,ui,web}`, `bob-kit/`, `examples/toko-demo/`, `scripts/{check-ignored.sh,bob-evidence.sh (stub)}`, `docs/*` kerangka
- `radar/PRD.md`, `radar/PLAN.md`, `radar/DESIGN.md`, `radar/prompt_ui.md`, `radar/plan/**` (dipindah dari folder `IBM/`, termasuk `arsip/` → `radar/docs/arsip/`)
- `bob_sessions/README.md`, `bob_sessions/INDEX.md` (header tabel), `BOB_DEVELOPMENT.md` (kerangka), `README.md` root (bagian juri di atas + atribusi Orca)
- `.github/workflows/radar-ci.yml`
- Branch `lane/core`, `lane/bob`, `lane/app` dari `main`

## Langkah kerja

1. **Fork & clone** (kalau belum dilakukan sebelum kickoff):
   ```bash
   gh repo fork stablyai/orca --fork-name ibm-bob-live-collab --clone=false
   git clone https://github.com/<akun>/ibm-bob-live-collab.git && cd ibm-bob-live-collab
   pnpm install          # Orca, root
   ```
   Jangan mengubah `LICENSE`. Nonaktifkan workflow CI bawaan Orca yang butuh secret: pindahkan `.github/workflows/*.yml` Orca ke `.github/workflows-orca-disabled/`, lalu catat di DECISIONS (D-A01). Alasannya supaya Actions di fork tidak merah atau memakan menit.

2. **Template keamanan IBM.** Ambil `.gitignore`, `.bobignore`, `SECURITY.MD`, `.env.example` dari `watsonxhackathon/ibm-hackathon-template` (`gh api repos/watsonxhackathon/ibm-hackathon-template/contents/<file> --jq .content | base64 -d`).
   - `.gitignore`: **tambahkan** blok template di bawah `.gitignore` Orca, diawali komentar `# ==== IBM hackathon template (do not remove) ====`. Jangan menghapus pola template.
   - `.bobignore`, `SECURITY.MD`: salin apa adanya ke root.
   - `.env.example` root: isi template + variabel server/web dari R5 §5 (nilai contoh non-rahasia).
   - Tambah `.radar/`, `*.radar-rejected`, `*.radar-conflict`, `radar/.data/`, `radar/spike/out/` ke `.gitignore`.
   - Jalankan `git ls-files -ci --exclude-standard`. File Orca yang sudah ter-track dan cocok dengan pola template (mis. `admin-token-verifier.ts`) **tetap ter-track** karena `.gitignore` tidak berlaku untuk file ter-track. Catat daftarnya di log sebagai info.

3. **Workspace `radar/`** (terpisah dari graph pnpm Orca, meniru pola `mobile/`):
   - `radar/pnpm-workspace.yaml`: `packages: ['packages/*']`.
   - `radar/package.json`: `"private": true`, `"type": "module"`, `"packageManager"` mengikuti versi pnpm Orca, `"engines": {"node": ">=20.10"}`, semua script R1 §4 (yang belum ada implementasinya: `echo "fase-XX"`). DevDeps: `typescript`, `tsx`, `vitest`, `eslint`, `typescript-eslint`, `prettier`, `@types/node`.
   - Pastikan `pnpm-workspace.yaml` root Orca **tidak** mencakup `radar/`. Uji: `pnpm -C radar install` membuat `radar/pnpm-lock.yaml` sendiri, dan `pnpm install` di root tidak menyentuh `radar/`.
   - `tsconfig.base.json` sama seperti v0.2 (strict, NodeNext, …).

4. **Paket.** `common, server, sync, hooks, mcp` (Node, ESM) sama seperti v0.2 (nama `@radar/<nama>`, script `build/typecheck/test/dev`, dependensi R1 §3, `src/index.ts` + 1 test). Tambahan:
   - `packages/ui` (`@radar/ui`): React peer, `src/index.ts` mengekspor `tokens.css` + satu komponen `AgentTag` placeholder + 1 test (@testing-library/react).
   - `packages/web` (`@radar/web`): Next.js 15 App Router + Tailwind 4, `transpilePackages: ['@radar/common','@radar/ui']`, halaman `/demo` sementara "Replay (fase 11)".
   - `db/repo/access.ts`, **bukan** `token.ts` (R5 §8).

5. **Lint, format, CI untuk `radar/`.** `eslint.config.js` flat seperti v0.2, dengan path `packages/*/src`. `.github/workflows/radar-ci.yml`: trigger push/PR, `working-directory: radar`, Node 22, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:ignored`. Job kedua: gitleaks (`fetch-depth: 0`). Job Orca: `pnpm tc` di root, hanya kalau `src/**` berubah (`paths` filter).

6. **Repo contoh `radar/examples/toko-demo/`** — **Bob slice A1** (lihat bawah) (data sintetis, NFR-07). Stack kecil: Vite + React + TypeScript, **tanpa** dependensi berat. Rancang agar skenario demo PRD §15 dan eksperimen §17 terjadi secara alami:

   | File | Isi & tujuan |
   |---|---|
   | `package.json` | scripts `dev`, `build` (`tsc --noEmit && vite build`), `typecheck`. Deps: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript` |
   | `index.html`, `src/main.tsx`, `src/App.tsx` | App satu halaman: header, daftar produk, keranjang, ringkasan checkout |
   | `src/data/products.json` | 8 produk fiktif (nama generik, harga Rupiah) |
   | `src/utils.ts` | `formatRupiah()`, `clamp()`, `sum()` — dipakai banyak file (**titik singgung**) |
   | `src/cart/cart.ts` | tipe `Item`, `addItem`, `removeItem` |
   | `src/checkout/checkout.ts` | `export function calculateTotal(items: Item[]): number` (belum ada ongkir/kupon) (**titik singgung utama**) |
   | `src/checkout/coupon.ts` | stub `export function applyCoupon(total: number, code?: string): number { return total }` |
   | `src/ui/Header.tsx` | Menampilkan judul toko + **total keranjang dengan memanggil `calculateTotal(items)`** (supaya review main agent bisa menemukan dampak antar-file) |
   | `src/ui/theme.css` | Variabel CSS tema terang (`--bg`, `--fg`, `--accent`) |
   | `src/routes.ts` | Peta rute sederhana `{ '/': 'Home', '/cart': 'Cart', '/checkout': 'Checkout' }` (**titik singgung**) |
   | `.gitignore` | `node_modules/`, `dist/`, `.radar/`, `*.radar-rejected`, `*.radar-conflict` |
   | `README.md` | Penjelasan bahwa ini repo demo sintetis untuk IBM Bob Live Collab |
   | `EXPERIMENT_TASKS.md` | 6 task eksperimen (lihat di bawah) |

   **6 task eksperimen** (PRD §17), sengaja bersinggungan di `checkout.ts`, `routes.ts`, `utils.ts`:
   1. *Kupon diskon* — `coupon.ts`, `checkout.ts`, `routes.ts` (rute `/coupon`).
   2. *Dark mode* — `theme.css`, `Header.tsx` (toggle), `utils.ts` (helper `prefersDark`).
   3. *Ongkos kirim* — `checkout.ts` (`calculateTotal(items, shipping)`), `Header.tsx` ikut terdampak.
   4. *Format harga internasional* — `utils.ts` (`formatPrice(locale)`), `Header.tsx`, `cart.ts`.
   5. *Halaman riwayat pesanan* — `routes.ts`, file baru `src/orders/orders.ts`.
   6. *Batas jumlah item* — `cart.ts`, `utils.ts` (`clamp`), `checkout.ts` (validasi).

   Jalankan `npm install && npm run build` di folder ini untuk memastikan hijau, lalu hapus `node_modules` (folder ini tidak masuk workspace pnpm).

7. **Script bukti & pemeriksa nama file.**
   - `radar/scripts/check-ignored.sh` sesuai R5 §8 (bisa dijalankan dari root atau `radar/`).
   - `radar/scripts/bob-evidence.sh`: **stub** yang sudah bisa membuat folder, menjalankan `screencapture -i`, dan menambah baris INDEX. Versi lengkap (tunggu md di Downloads, sensor) dibuat di Bob slice C4 (fase 11). Stub ini dibutuhkan supaya Bob slice A1 dan B1 bisa dibuktikan sejak jam pertama.
   - `radar/plan/team.json`: `[{ "id": "A", "name": "<nama1>", "lane": "A" }, …]` (nama tanpa email).

8. **Pindahkan dokumen.** Salin `PRD.md`, `PLAN.md`, `DESIGN.md`, `prompt_ui.md`, `plan/` dari folder kerja `IBM/` ke `radar/`, dan `arsip/` ke `radar/docs/arsip/`. Perbarui link relatif: di dalam `radar/plan/` link ke PRD menjadi `../PRD.md`. Salin juga folder `UI Design/` yang relevan ke `radar/docs/ui-reference/` (screenshot saja, tanpa video besar).

9. **Dokumen kerangka.** `radar/docs/{SPIKE_RESULTS,ARCHITECTURE,EXPERIMENT,DEMO_SCRIPT,SUBMISSION}.md` berjudul. `bob_sessions/README.md` berisi ringkas R7 §1–§2. `bob_sessions/INDEX.md` berisi header tabel. `BOB_DEVELOPMENT.md` (judul + daftar bagian). `README.md` root:
   - di atas: judul **IBM Bob Live Collab**, satu kalimat, "status: in development", kalimat "Community hackathon project, not an official IBM product."
   - di bawah: "Built on top of [Orca](https://github.com/stablyai/orca) (MIT) by Stably AI". README asli Orca dipindah ke `docs/ORCA_README.md` dan di-link.

10. **ECC.** Setiap orang menjalankan `/plugin list ecc@ecc`, lalu Lane A mencatat nama command/agent/skill yang **benar-benar ada** ke DECISIONS (D-A00) sebagai tabel padanan untuk `ref/R6` §0.

11. **Branch lane.** `git switch -c lane/core && git push -u origin lane/core`, sama untuk `lane/bob` dan `lane/app`. Semua dibuat dari commit fase 00.

12. **Checklist kickoff (LANGKAH MANUAL, tulis di log):**
    1. Baca hackathon guide 2.0. Catat di DECISIONS: langkah resmi screenshot ringkasan task, Bobcoin per akun, model watsonx yang dilarang, aturan persiapan sebelum kickoff, dan batas ukuran video/deck.
    2. Setiap orang: login Bob IDE **dan** Bob Shell (`bob`) dengan akun hackathon. Cek `bob --version`.
    3. Buat repo GitHub publik `toko-demo` dari `radar/examples/toko-demo/`.
    4. GitHub fine-grained token hanya untuk `toko-demo` (contents: read & write) → password manager, **bukan** repo.
    5. Akun Fly.io/Railway (server) + Vercel (replay). Belum deploy.
    6. Sepakati nama anggota dan warna: A biru, B ungu, C oranye (DESIGN.md §2.1).

13. **Commit** di `main`: `fase-00: fork Orca + radar workspace, IBM template, toko-demo` (dengan trailer `Bob-Assisted` untuk commit toko-demo), lalu push.

## Bob slice A1 — toko-demo

- **Mode Bob:** Code. **Siapa:** Orang 1 (atau siapa pun yang Bob-nya menganggur).
- **Prompt siap tempel:** "Buat repo contoh di `radar/examples/toko-demo/` sesuai tabel file di `radar/plan/fase-00-fondasi.md` langkah 6. Vite + React + TypeScript, data sintetis, `Header.tsx` harus memanggil `calculateTotal(items)`. Tulis juga `EXPERIMENT_TASKS.md` dengan 6 task. Jalankan `npm install && npm run build` dan pastikan hijau."
- **Bukti:** `radar/scripts/bob-evidence.sh <nama> 01-toko-demo`.
- Claude Code lalu hanya me-review hasilnya dan menjalankan build.

## Verifikasi

```bash
pnpm -C radar install && pnpm -C radar -r build && pnpm -C radar typecheck && pnpm -C radar lint && pnpm -C radar test
pnpm -C radar check:ignored          # tidak ada file sumber yang ter-ignore
pnpm tc                              # Orca tetap lolos typecheck (tidak ada perubahan src/ di fase ini)
pnpm dev                             # app Orca masih jalan (cek manual, lalu tutup)
(cd radar/examples/toko-demo && npm install && npm run build && rm -rf node_modules dist)
git check-ignore -v .env && git status --short   # .env ter-ignore, tidak ada token
```

## Kriteria selesai (DoD)

- [ ] Fork publik ada. `LICENSE` Orca utuh. Atribusi di README.
- [ ] File template IBM ada di root. `.gitignore` gabungan tidak menghapus pola template. `check:ignored` hijau.
- [ ] `radar/` build/typecheck/lint/test hijau (7 paket). `pnpm tc` Orca hijau.
- [ ] toko-demo build hijau, dikerjakan Bob (folder `bob_sessions/<nama>/01-toko-demo/` lengkap).
- [ ] Dokumen dipindah ke `radar/` dan link relatif berfungsi.
- [ ] Tiga branch lane ada di remote.
- [ ] Nama command ECC tercatat (D-A00). Checklist kickoff tertulis.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| `pnpm install` Orca gagal (native: node-pty, sherpa-onnx) | Xcode CLT, Node sesuai `.nvmrc` Orca. Kalau tetap gagal, Lane C memakai build rilis Orca untuk eksplorasi UI sambil memperbaiki. Catat di DECISIONS. |
| pnpm root ikut membaca `radar/` | Pastikan `radar/pnpm-workspace.yaml` ada dan jalankan perintah dengan `-C radar`. Tambah `radar` ke `.npmrc`/ignore kalau perlu. |
| Workflow Orca jalan di fork dan gagal | Nonaktifkan (langkah 1) atau matikan Actions untuk workflow itu di Settings |
| Guide 2.0 belum keluar | Lanjut dengan asumsi PRD, ulangi cek di fase 01 |

## Catatan handoff

- Lane B langsung ke fase 01 di `lane/bob`.
- Lane C ke fase 09 di `lane/app` (bagian a–b tidak butuh fase 02).
- Lane A lanjut fase 02 di `main`. Merge fase 02 = kontrak beku (Sab ±02:30). Setelah itu Lane B dan C rebase.
