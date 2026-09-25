# Fase 00 — Fondasi repo, monorepo, repo contoh & kickoff

| Field | Nilai |
|---|---|
| Jalur | Semua (dipimpin Orang 1) |
| Slot WITA | Jum 25 Sep 23:00 – Sab 26 Sep 01:00 |
| Estimasi | 1,5–2 jam |
| Prasyarat | – |
| Requirement PRD | §12 stack, §16 R0, NFR-04 (gitleaks), NFR-07 (data sintetis), NFR-08 (kompatibilitas) |
| Model | Sonnet 5 · effort medium (hemat: Haiku 4.5 · low) |
| Fase berikutnya | 01 (Orang 2), 02 (Orang 1), 09 langkah setup (Orang 3) — solo: **01** |

## Tujuan

Menyiapkan kerangka yang membuat semua fase berikutnya bisa langsung menulis kode: monorepo pnpm dengan 6 paket kosong yang bisa di-build dan di-test, CI, pemindai secret, repo contoh `toko-demo` yang sengaja punya file bersinggungan, dan checklist kickoff hackathon.

## Bacaan wajib

- `plan/README.md`, `plan/ref/R1-struktur-repo.md`, `plan/ref/R5-konvensi.md`
- PRD §12 (stack), §15 (naskah demo — untuk desain toko-demo), §16, §17 (eksperimen A/B — 6 task), §18 open question

## Output

- Root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `.gitleaks.toml`, `.env.example`, `.nvmrc` (`20`), `.github/workflows/ci.yml`, `README.md` (kerangka)
- `packages/{common,server,sync,hooks,mcp,web}` dengan `package.json`, `tsconfig.json`, `src/index.ts`, 1 test placeholder (web: cukup `next` terpasang, lihat langkah 6)
- `bob-kit/{coder,pm}/.bob/.gitkeep`, `bob-kit/prompts/.gitkeep`
- `examples/toko-demo/` lengkap (langkah 8)
- `docs/{SPIKE_RESULTS.md,ARCHITECTURE.md,EXPERIMENT.md,DEMO_SCRIPT.md}` (kerangka berjudul)
- `bob_sessions/README.md`, `BOB_DEVELOPMENT.md` (kerangka)
- `plan/log/fase-00.md`, entri kickoff di `plan/log/DECISIONS.md`

## Langkah kerja

1. **Git.** Kalau root belum repo git: `git init -b main`. Jangan memindahkan/merename `Bob Radar PRD v0.2.md`.

2. **`.gitignore` root**:
   ```gitignore
   node_modules/
   dist/
   .next/
   coverage/
   .data/
   .env
   .env.*
   !.env.example
   .radar/
   *.radar-rejected
   *.radar-conflict
   *.log
   .DS_Store
   spike/out/
   ```

3. **pnpm workspace.** `pnpm-workspace.yaml` berisi `packages/*` saja. Root `package.json`: `"private": true`, `"type": "module"`, `"packageManager": "pnpm@9.x"`, `"engines": {"node": ">=20.10"}`, semua script di R1 §4 (script yang belum punya implementasi boleh `echo "fase-XX"` sementara). DevDeps root: `typescript`, `tsx`, `vitest`, `eslint`, `typescript-eslint`, `prettier`, `@types/node`.

4. **`tsconfig.base.json`**: `strict`, `noUncheckedIndexedAccess`, `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `declaration: true`, `sourceMap: true`, `skipLibCheck: true`, `esModuleInterop: true`, `resolveJsonModule: true`.

5. **Paket Node** (`common`, `server`, `sync`, `hooks`, `mcp`): nama `@radar/<nama>`, `"type": "module"`, script `build` (`tsc -p .`), `typecheck` (`tsc --noEmit -p .`), `test` (`vitest run`), `dev` (server: `tsx watch src/main.ts`). Pasang dependensi runtime sesuai R1 §3 sekarang juga (supaya lockfile stabil). `src/index.ts` mengekspor `export const PACKAGE = '@radar/<nama>'`; test placeholder memastikan ekspor itu ada. `server` dan `sync` bergantung ke `@radar/common` via `workspace:*`.
   - `better-sqlite3` butuh build native: pastikan `pnpm install` sukses di macOS/Linux. Kalau gagal, catat di log dan pasang toolchain (`xcode-select --install` / `build-essential`).

6. **Paket web.** `pnpm create next-app packages/web --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-pnpm` (atau buat manual setara), rename ke `@radar/web`, tambah dependensi `@radar/common` (`workspace:*`) dan `zustand`. Halaman `app/page.tsx` sementara menampilkan "Bob Radar — Mission Control (fase 09)". `next.config` → `transpilePackages: ['@radar/common']`.

7. **Lint & format.** `eslint.config.js` flat: `typescript-eslint` recommended-type-checked untuk `packages/*/src`, abaikan `dist`, `.next`, `bob-kit/**/*.js`, `examples/**`, `spike/**`. Aturan tambahan: `@typescript-eslint/no-floating-promises: error`. `.prettierrc` sesuai R5 §1.

8. **Repo contoh `examples/toko-demo/`** (data sintetis, NFR-07). Stack kecil: Vite + React + TypeScript, **tanpa** dependensi berat. Rancang agar skenario demo PRD §15 dan eksperimen §17 terjadi secara alami:

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
   | `README.md` | Penjelasan bahwa ini repo demo sintetis untuk Bob Radar |
   | `EXPERIMENT_TASKS.md` | 6 task eksperimen (lihat di bawah) |

   **6 task eksperimen** (PRD §17), sengaja bersinggungan di `checkout.ts`, `routes.ts`, `utils.ts`:
   1. *Kupon diskon* — `coupon.ts`, `checkout.ts`, `routes.ts` (rute `/coupon`).
   2. *Dark mode* — `theme.css`, `Header.tsx` (toggle), `utils.ts` (helper `prefersDark`).
   3. *Ongkos kirim* — `checkout.ts` (`calculateTotal(items, shipping)`), `Header.tsx` ikut terdampak.
   4. *Format harga internasional* — `utils.ts` (`formatPrice(locale)`), `Header.tsx`, `cart.ts`.
   5. *Halaman riwayat pesanan* — `routes.ts`, file baru `src/orders/orders.ts`.
   6. *Batas jumlah item* — `cart.ts`, `utils.ts` (`clamp`), `checkout.ts` (validasi).

   Jalankan `npm install && npm run build` di folder ini untuk memastikan hijau, lalu hapus `node_modules` (folder ini tidak masuk workspace pnpm).

9. **Dokumen kerangka.** Buat `docs/SPIKE_RESULTS.md` (judul + tabel 6 spike kosong), `docs/ARCHITECTURE.md` (salin diagram arsitektur PRD §12 + tautan ke `plan/ref/`), `docs/EXPERIMENT.md` (judul), `docs/DEMO_SCRIPT.md` (salin tabel PRD §15), `bob_sessions/README.md` (konvensi `bob_sessions/<nama-anggota>/fase-XX/<file ekspor>` + cara ekspor), `BOB_DEVELOPMENT.md` (judul + daftar bagian yang diisi fase 14), `README.md` root (judul, satu paragraf dari PRD §01, "status: dalam pengembangan").

10. **`.env.example`** berisi semua variabel server & web dari R5 §5 dengan nilai contoh non-rahasia.

11. **Gitleaks.** `.gitleaks.toml` memakai default + allowlist `plan/`, `examples/**/products.json`. Kalau `gitleaks` belum terpasang lokal, tulis cara pasang di log (`brew install gitleaks`).

12. **CI** `.github/workflows/ci.yml`: trigger push & PR; job `build-test` (ubuntu-latest, Node 20, pnpm 9, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`); job `secrets` (`gitleaks/gitleaks-action@v2`, `fetch-depth: 0`).

13. **Checklist kickoff (LANGKAH MANUAL — tulis di log):**
    1. Baca guide resmi IBM Bob 2.0 hackathon. Catat di `DECISIONS.md`: track yang dipilih, rubrik, aturan `bob_sessions/`, Bobcoin per peserta, model watsonx yang dilarang (PRD §18 OQ 6–7), aturan penggunaan AI selain Bob.
    2. Isi nama tim & anggota (tabel versi PRD) dan peta Orang 1/2/3.
    3. Pasang Bob IDE ≥ 2.0.1 di 3 PC (NFR-08: 2.0.0 berhenti 30 Sep), Node 20, git ≥ 2.38, pnpm 9.
    4. Buat akun/proyek: GitHub (repo `bob-radar` publik + repo `toko-demo` publik), Fly.io (atau Render/Railway), Vercel.
    5. Buat repo GitHub `toko-demo` dari isi `examples/toko-demo/` (commit awal "chore: initial toko-demo").
    6. Buat GitHub fine-grained token hanya untuk `toko-demo` (contents: read & write) → simpan di password manager, **jangan** di repo.
    7. Sepakati warna & inisial: A biru, B ungu, C oranye.

14. **Commit** `fase-00: fondasi monorepo, toko-demo, CI`.

## Verifikasi

```bash
pnpm install
pnpm -r build
pnpm typecheck
pnpm lint
pnpm test
(cd examples/toko-demo && npm install && npm run build && rm -rf node_modules dist)
git status --short   # tidak ada file .env / token
```

## Kriteria selesai (DoD)

- [ ] `pnpm install` sukses termasuk `better-sqlite3` native.
- [ ] `pnpm -r build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` hijau (6 paket).
- [ ] `examples/toko-demo` build hijau; `Header.tsx` memanggil `calculateTotal`; `EXPERIMENT_TASKS.md` berisi 6 task.
- [ ] CI YAML valid (cek dengan `act` bila ada, atau review manual).
- [ ] Checklist kickoff tertulis di log sebagai LANGKAH MANUAL; jawaban yang sudah diketahui dicatat di `DECISIONS.md`.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| `better-sqlite3` gagal build | Pakai Node 20 LTS terbaru, pasang toolchain; alternatif terakhir `node:sqlite` bawaan Node 22 (catat di DECISIONS, ubah `engines`) |
| `create-next-app` interaktif | Buat manual: `next`, `react`, `react-dom`, `tailwindcss`, `app/layout.tsx`, `app/page.tsx` |
| Guide resmi belum keluar saat fase ini | Lanjut dengan asumsi PRD, tandai OQ 6–7 "terbuka", ulangi cek di fase 01 |

## Catatan handoff

- Orang 2 bisa langsung mulai fase 01 (spike tidak bergantung paket).
- Orang 1 lanjut fase 02.
- Orang 3 boleh menjalankan fase 09 langkah 1–3 (setup Next.js + Vercel) lalu tidur sesuai jadwal.
