# Fase 00 — Fondasi: workspace `radar/`, template IBM, toko-demo, ECC, branch lane

| Field | Nilai |
|---|---|
| Jalur | **Lane Alief** (Alief), dikerjakan **di `main`** repo `umarmuhdhor/IBM`. Lane Umar dan Lane Aarief/Imelda membantu di langkah manual. |
| Slot WITA | Jum 25 Sep 23:00 – Sab 26 Sep 00:30 |
| Estimasi | 1–1,5 jam (Orca **sudah** ada di `app/` sejak commit `7c86819`, dan `pnpm -C app install` sudah terbukti jalan) |
| Prasyarat | – |
| Requirement PRD | §12 stack, §16 R0, NFR-04, NFR-07, NFR-10, NFR-11 |
| Model | Sonnet 5 · effort medium |
| Bob slice | **A1**: toko-demo ditulis Bob IDE |
| Fase berikutnya | Lane Alief: **02** · Lane Umar: **01** · Lane Aarief: **09** · Lane Imelda: **11 (D)** |

## Tujuan

Menyiapkan repo `umarmuhdhor/IBM` supaya empat lane langsung bisa bekerja paralel:
- workspace pnpm `radar/` dengan 7 paket kosong yang bisa di-build dan di-test,
- file keamanan template IBM di root,
- repo contoh `toko-demo`,
- ECC terverifikasi,
- script bukti Bob tersedia sejak jam pertama,
- CI kita,
- branch `lane/core`, `lane/bob`, `lane/app`, `lane/web`.

Dokumen (PRD, PLAN, DESIGN, `plan/`) **tetap di root**, tidak dipindah.

## Bacaan wajib

- `../PLAN.md` §2, §3, §6, §7 · `ref/R1-struktur-repo.md` · `ref/R5-konvensi.md` (terutama §8) · `ref/R7-bukti-bob.md`
- PRD §12, §15, §16, §17 (eksperimen), §18
- `orca:AGENTS.md`, `orca:CLAUDE.md`, `orca:pnpm-workspace.yaml` (komentar tentang `mobile/` sebagai workspace terpisah)

## Output

- `.gitignore` root (isi sekarang + blok template IBM), `.bobignore`, `SECURITY.MD`, `.env.example` di root
- `radar/` lengkap: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.nvmrc` (`24`), `packages/{common,server,sync,hooks,mcp,ui,web}`, `bob-kit/`, `examples/toko-demo/`, `scripts/{check-ignored.sh,bob-evidence.sh (stub)}`, `docs/*` kerangka
- `bob_sessions/README.md`, `bob_sessions/INDEX.md` (header tabel), `BOB_DEVELOPMENT.md` (kerangka), `README.md` root (bagian juri di atas, indeks dokumen di bawah, atribusi Orca)
- `.github/workflows/ci.yml`
- `plan/team.json`
- Branch `lane/core`, `lane/bob`, `lane/app`, `lane/web` dari `main`

## Langkah kerja

1. **Cek `app/`.** Orca sudah disalin ke `app/` (upstream `stablyai/orca@bf40d35`, commit `7c86819`). Jangan mengubah `app/LICENSE`. Workflow Orca di `app/.github/` **tidak** jalan karena bukan di root, jadi tidak perlu dimatikan. Husky Orca (`prepare`) melewati instalasi karena `app/` tidak punya `.git`: cek `git config core.hooksPath` masih kosong. Pastikan `nvm use 24 && pnpm -C app install && pnpm -C app tc` hijau.

2. **Template keamanan IBM.** Ambil `.gitignore`, `.bobignore`, `SECURITY.MD`, `.env.example` dari `watsonxhackathon/ibm-hackathon-template` (`gh api repos/watsonxhackathon/ibm-hackathon-template/contents/<file> --jq .content | base64 -d`).
   - `.gitignore`: **tambahkan** blok template di bawah `.gitignore` Orca, diawali komentar `# ==== IBM hackathon template (do not remove) ====`. Jangan menghapus pola template.
   - `.bobignore`, `SECURITY.MD`: salin apa adanya ke root.
   - `.env.example` root: isi template + variabel server/web dari R5 §5 (nilai contoh non-rahasia).
   - Tambah `.radar/`, `*.radar-rejected`, `*.radar-conflict`, `radar/.data/`, `radar/spike/out/`, `.dev.vars`, `radar/**/.wrangler/` ke `.gitignore` (`.dev.vars` berisi secret lokal wrangler).
   - Jalankan `git ls-files -ci --exclude-standard`. File Orca yang sudah ter-track dan cocok dengan pola template (mis. `admin-token-verifier.ts`) **tetap ter-track** karena `.gitignore` tidak berlaku untuk file ter-track. Catat daftarnya di log sebagai info.

3. **Workspace `radar/`** (pnpm workspace sendiri, terpisah dari `app/`):
   - `radar/pnpm-workspace.yaml`: `packages: ['packages/*']`.
   - `radar/package.json`: `"private": true`, `"type": "module"`, `"packageManager": "pnpm@12.0.0"` (sama dengan `app/`), `"engines": {"node": ">=24"}`, semua script R1 §4 (yang belum ada implementasinya: `echo "fase-XX"`). DevDeps: `typescript`, `tsx`, `vitest@^4.1` (dipin: `@cloudflare/vitest-plugin` butuh peer `vitest ^4.1`, sedangkan `vitest` latest sudah 5.x), `eslint`, `typescript-eslint`, `prettier`, `@types/node`.
   - Tidak ada `package.json` di root repo. Setiap perintah memakai `-C app` atau `-C radar`. Uji: `pnpm -C radar install` membuat `radar/pnpm-lock.yaml` sendiri.
   - `tsconfig.base.json` sama seperti v0.2 (strict, NodeNext, …).

4. **Paket.** `common, server, sync, hooks, mcp` (Node, ESM) sama seperti v0.2 (nama `@radar/<nama>`, script `build/typecheck/test/dev`, dependensi R1 §3, `src/index.ts` + 1 test). Tambahan:
   - `packages/ui` (`@radar/ui`): React peer, `src/index.ts` mengekspor `theme-vars.css` (bukan `tokens.css`: pola template `*token*` akan meng-ignore-nya, R5 §8) + satu komponen `AgentTag` placeholder + 1 test (@testing-library/react).
   - `packages/web` (`@radar/web`): Next.js 15 App Router + Tailwind 4, `transpilePackages: ['@radar/common','@radar/ui']`, halaman `/demo` sementara "Replay (fase 11)".
   - `db/repo/access.ts`, **bukan** `token.ts` (R5 §8).

5. **Lint, format, CI untuk `radar/`.** `eslint.config.js` flat seperti v0.2, dengan path `packages/*/src`. Satu file workflow saja: `.github/workflows/ci.yml` di **root**, trigger push ke `main` dan semua PR. Semua job memakai Node 24 (`actions/setup-node` dengan `node-version-file: radar/.nvmrc`) + pnpm 12:
   - job `radar`: `working-directory: radar`, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:ignored`.
   - job `gitleaks`: `fetch-depth: 0`.
   - job `app`: `pnpm -C app install --frozen-lockfile && pnpm -C app tc`, hanya kalau `app/**` berubah (pakai `dorny/paths-filter`, karena filter `paths` di level workflow akan melewati job lain juga).

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
   - `radar/scripts/bob-evidence.sh <nama> <NN> <slug>`: sudah **final untuk tangkapan layar** sejak fase 00 (dipakai sejak Bob slice A1). Cari window Bob IDE (`osascript` → id window proses Bob), tangkap tanpa interaksi dengan `screencapture -o -l <windowId> bob_sessions/uaai_<nama>_task<NN>_<slug>_summary.png`, lalu tambah baris ke `bob_sessions/INDEX.md`. Fallback `--interactive` memakai `screencapture -i -o` bila id window tidak ketemu. Validasi `<nama>` terhadap `plan/team.json`, `<NN>` dua digit, `<slug>` `[a-z0-9_]+`. Bob slice C4 (fase 11) **tidak** menulis ulang script ini; C4 hanya menambah opsi `--md` (salin ekspor md + sensor, R7 §3) dan membuat `evidence-check.ts`.
   - `plan/team.json`: `{"team":"uaai","members":[{"id":"alief","lane":"core"},{"id":"umar","lane":"bob"},{"id":"aarief","lane":"app"},{"id":"imelda","lane":"web"}]}` (tanpa email). Dipakai `evidence:check`.

8. **Rapikan referensi UI.** Folder `UI Inspo & Design/` sudah di root (inspirasi + mockup Stitch). Tambahkan `UI Inspo & Design/README.md` yang menjelaskan bahwa mockup Stitch **hanya pedoman**, dan gaya app mengikuti Orca (DESIGN.md §0). Jangan commit video di atas 10 MB.

9. **Dokumen kerangka.** `radar/docs/{SPIKE_RESULTS,ARCHITECTURE,EXPERIMENT,DEMO_SCRIPT,SUBMISSION}.md` berjudul. `bob_sessions/README.md` berisi ringkas R7 §1–§2. `bob_sessions/INDEX.md` berisi header tabel. `BOB_DEVELOPMENT.md` (judul + daftar bagian). `README.md` root:
   - di atas: judul **IBM Bob Live Collab**, satu kalimat, "status: in development", kalimat "Community hackathon project, not an official IBM product."
   - di tengah: indeks dokumen (isi README sekarang).
   - di bawah: "Desktop app built on top of [Orca](https://github.com/stablyai/orca) (MIT) by Stably AI — vendored in `app/`". README Orca tetap di `app/README.md`.

10. **ECC.** Setiap orang menjalankan `/plugin list ecc@ecc`, lalu Lane Alief mencatat nama command/agent/skill yang **benar-benar ada** ke DECISIONS (D-alief-00) sebagai tabel padanan untuk `ref/R6` §0.

11. **Branch lane.** `git switch -c lane/core && git push -u origin lane/core`, sama untuk `lane/bob`, `lane/app`, dan `lane/web`. Semua dibuat dari commit fase 00. Alur PR per fase (branch snapshot `lane/<x>-fNN`, squash-merge, `rebase --onto`) ada di PLAN §6 dan PROMPT langkah 11/13. Push ke `umarmuhdhor/IBM` butuh akses collaborator: minta Umar menambahkan anggota lain.

12. **Checklist kickoff (LANGKAH MANUAL, tulis di log):**
    1. Baca hackathon guide 2.0. Catat di DECISIONS: langkah resmi screenshot ringkasan task, Bobcoin per akun, model watsonx yang dilarang, aturan persiapan sebelum kickoff, dan batas ukuran video/deck.
    2. Setiap orang: login **Bob IDE** dengan akun hackathon dan catat versi (Help → About, minimal 2.0.2). Bob Shell opsional; kalau dipasang, cek `bob --version`, tapi tidak ada fitur P0 yang bergantung padanya.
    3. Buat repo GitHub publik `toko-demo` dari `radar/examples/toko-demo/`.
    4. GitHub fine-grained PAT hanya untuk `toko-demo` (contents: read & write) → password manager, **bukan** repo. Nanti dipasang lewat `wrangler secret put GITHUB_TOKEN` (fase 03).
    5. Akun Cloudflare (Workers + Pages, plan Free) → `npx wrangler login`. Belum deploy.
    6. Sepakati nama anggota dan warna: A `#78A9FF`, B `#BE95FF`, C `#FF832B` (R5 §4 `MEMBER_COLORS`, DESIGN.md §2.1).

13. **Commit** di `main`: `fase-00: fork Orca + radar workspace, IBM template, toko-demo` (dengan trailer `Bob-Assisted` untuk commit toko-demo), lalu push.

## Bob slice A1 — toko-demo

- **Mode Bob:** Code. **Siapa:** Alief (atau siapa pun yang Bob-nya menganggur).
- **Prompt siap tempel:** "Buat repo contoh di `radar/examples/toko-demo/` sesuai tabel file di `plan/fase-00-fondasi.md` langkah 6. Vite + React + TypeScript, data sintetis, `Header.tsx` harus memanggil `calculateTotal(items)`. Tulis juga `EXPERIMENT_TASKS.md` dengan 6 task. Jalankan `npm install && npm run build` dan pastikan hijau."
- **Bukti:** `radar/scripts/bob-evidence.sh <nama> 01 toko_demo`.
- Claude Code lalu hanya me-review hasilnya dan menjalankan build.

## Verifikasi

```bash
pnpm -C radar install && pnpm -C radar -r build && pnpm -C radar typecheck && pnpm -C radar lint && pnpm -C radar test
pnpm -C radar check:ignored          # tidak ada file sumber yang ter-ignore
pnpm -C app tc                       # app tetap lolos typecheck
pnpm -C app dev                      # app masih jalan (cek manual, lalu tutup)
(cd radar/examples/toko-demo && npm install && npm run build && rm -rf node_modules dist)
git check-ignore -v .env && git status --short   # .env ter-ignore, tidak ada token
```

## Kriteria selesai (DoD)

- [ ] `app/LICENSE` Orca utuh. Atribusi di README root.
- [ ] File template IBM ada di root. `.gitignore` gabungan tidak menghapus pola template. `check:ignored` hijau.
- [ ] `radar/` build/typecheck/lint/test hijau (7 paket). `pnpm -C app tc` Orca hijau.
- [ ] toko-demo build hijau, dikerjakan Bob (`bob_sessions/uaai_alief_task01_toko_demo_summary.png` ada).
- [ ] Empat branch lane (`lane/core`, `lane/bob`, `lane/app`, `lane/web`) ada di remote.
- [ ] `bob-evidence.sh` menghasilkan PNG window Bob IDE tanpa klik (uji sekali, lalu hapus PNG uji).
- [ ] Nama command ECC tercatat (D-alief-00). Checklist kickoff tertulis.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| `pnpm -C app install` gagal di Mac teman (native: node-pty, sherpa-onnx) | Node 24 via nvm, Xcode CLT. Di Mac Aarief sudah terbukti jalan (71 s). |
| Teman tidak bisa push | Minta Umar menambah collaborator, atau fork repo Umar lalu PR |
| Guide 2.0 belum keluar | Lanjut dengan asumsi PRD, ulangi cek di fase 01 |

## Catatan handoff

- Lane Umar langsung ke fase 01 di `lane/bob`.
- Lane Aarief ke fase 09 di `lane/app` (bagian a–b tidak butuh fase 02, memakai mock).
- Lane Imelda ke fase 11 bagian D di `lane/web` (landing + replay dengan data fixture).
- Lane Alief lanjut fase 02 di `lane/core`. PR fase 02 = kontrak beku (Sab ±02:30), di-merge Alief. Setelah itu setiap lane menjalankan sinkron PROMPT langkah 13 dan mengganti placeholder `TODO(sync:alief)`.
