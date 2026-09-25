# Log fase 00 — Fondasi (Lane Alief)

- **Status:** [~] berjalan. Scaffold selesai dan hijau. Menunggu Bob slice A1 (toko-demo) + LANGKAH MANUAL.
- **Mulai:** Jum 25 Sep 2026 17:20 WITA · branch `main` (fase 00 langsung di `main`, PROMPT langkah 11).
- **Model:** Claude Opus 5.5 (R6 §2 menyarankan Sonnet 5 untuk scaffold; dicatat di D-alief-00).

## Ringkasan planner (`ecc:planner`)

1. Urutan: cek `app/` → template IBM → workspace `radar/` → 7 paket → lint/CI → script → dokumen → Bob slice A1 → commit → branch lane.
2. Pin: Node 24, pnpm 12.0.0 (sama dengan `app/`), TypeScript `~6.0.3` (typescript-eslint belum mendukung 7), vitest `^4.1` (peer `@cloudflare/vitest-plugin`).
3. Risiko 1: pola template `*token*`, `*secret*`, `config.json`, `dist/`, `build/`, `*.log` diam-diam meng-ignore file baru. Mitigasi: `check-ignored.sh` + hindari nama tersebut.
4. Risiko 2: filter `out/` tanpa anchor ikut meloloskan `checkout/` (toko-demo). Mitigasi: regex di-anchor `(^|/)out/`.
5. Risiko 3: `package_json_file` di `pnpm/action-setup` harus `radar/package.json` (tidak ada `package.json` root).
6. Risiko 4: `.bobignore` template menyembunyikan `*config.json`, termasuk `tsconfig.json`, dari Bob. Bob slice toko-demo perlu diberi tahu.
7. Test paket workspace memakai alias ke `src/` supaya tidak perlu build dulu.

## Checklist langkah (plan/fase-00-fondasi.md)

- [x] 1. Cek `app/`: `app/LICENSE` utuh, `git config core.hooksPath` kosong, `pnpm install` 40 s, `pnpm tc` hijau (72 s).
- [x] 2. Template IBM: `.gitignore` gabungan (blok Orca-root → blok template utuh → blok proyek), `.bobignore` dan `SECURITY.MD` disalin apa adanya, `.env.example` = template + variabel R5 §5 non-rahasia.
- [x] 3. Workspace `radar/` (pnpm 12, lockfile sendiri, `catalog:` untuk versi bersama).
- [x] 4. Paket `common, server, sync, hooks, mcp, ui, web` masing-masing punya `src/index.ts` + minimal 1 test.
- [x] 5. `radar/eslint.config.js` (type-aware untuk `packages/*/src`), `.github/workflows/ci.yml` (job `radar`, `gitleaks`, `changes`, `app`), `.gitleaks.toml`.
- [ ] 6. toko-demo: **Bob slice A1**, menunggu Bob IDE.
- [x] 7. `check-ignored.sh`, `bob-evidence.sh`, `plan/team.json`.
- [x] 8. `UI Inspo & Design/README.md`. Tidak ada video > 10 MB.
- [x] 9. Dokumen kerangka: `radar/docs/*.md`, `bob_sessions/{README,INDEX}.md`, `BOB_DEVELOPMENT.md`, README root (judul, status, indeks, kredit Orca).
- [x] 10. Nama ECC tercatat di D-alief-00 (ECC 2.2.2, semua nama R6 §0 ada).
- [ ] 11. Branch lane: dibuat setelah commit toko-demo (semua branch lane dari commit fase 00 final).
- [x] 12. Checklist kickoff: lihat LANGKAH MANUAL.
- [ ] 13. Commit scaffold di `main` sudah. Commit toko-demo (trailer `Bob-Assisted`) + push menunggu Bob slice.

## File dibuat/diubah

- Root: `.gitignore` (M), `README.md` (M), `.bobignore`, `.env.example`, `.gitleaks.toml`, `SECURITY.MD`, `BOB_DEVELOPMENT.md`, `.github/workflows/ci.yml`, `UI Inspo & Design/README.md`.
- `bob_sessions/README.md`, `bob_sessions/INDEX.md`.
- `plan/team.json`, `plan/TODO.md` + `plan/README.md` (ikut commit ini, jawaban A1/A2), `plan/log/fase-00.md`, `plan/log/DECISIONS.md` (D-alief-00), `plan/PROGRESS.md` (baris 00).
- `radar/`: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `eslint.config.js`, `vitest.shared.ts`, `.nvmrc`, `.prettierrc`, `.prettierignore`, `docs/*.md` (5), `bob-kit/README.md`, `scripts/check-ignored.sh`, `scripts/bob-evidence.sh`.
- `radar/packages/{common,server,sync,hooks,mcp,ui,web}/**`: `package.json`, `tsconfig*.json`, `vitest.config.ts`, `src/index.ts` + test. Server: `wrangler.jsonc`, `worker-configuration.d.ts` (hasil `wrangler types`), `test/health.test.ts`. UI: `theme-vars.css`, `AgentTag.tsx`. Web: `next.config.ts`, `postcss.config.mjs`, `app/{layout,page,demo/page}.tsx`, `src/site.ts`.

## Hasil verifikasi (`verification-loop`)

| Perintah | Hasil |
|---|---|
| `pnpm -C radar install --frozen-lockfile` | OK |
| `pnpm -C radar -r build` | rc 0 · server dry-run 62.94 KiB · Next export `/`, `/_not-found`, `/demo` |
| `pnpm -C radar typecheck` | rc 0 (7 paket) |
| `pnpm -C radar lint` | 0 masalah |
| `pnpm -C radar test` | 8 test / 7 paket, semua lulus |
| `pnpm -C radar check:ignored` | `check:ignored OK` |
| `pnpm -C app install && pnpm -C app tc` | hijau (install 40 s, tc 72 s) |
| `pnpm -C app dev` | belum, cek visual manual (LANGKAH MANUAL 10) |
| toko-demo `npm install && npm run build` | belum, Bob slice A1 |
| `git check-ignore -v .env` | ter-ignore (pola template) |
| `gitleaks git` (seluruh riwayat) | bersih dengan `.gitleaks.toml` (178 temuan lama semua di commit vendoring Orca `7c86819`, di-allowlist) |
| `bob-evidence.sh` | validasi argumen OK. Tangkapan gagal: "could not create image from window" karena izin Screen Recording belum ada (exit 2, tidak ada PNG tersisa). LANGKAH MANUAL 1 |

Catatan pnpm: `pnpm` global di Mac Alief rusak (placeholder binary pnpm 12). Verifikasi memakai `corepack pnpm@12.0.0`. Lihat LANGKAH MANUAL 12.

## DoD + bukti

- [x] `app/LICENSE` Orca utuh (tidak ada di diff). Atribusi di README root bagian "Credits".
- [x] File template IBM di root. Blok template di `.gitignore` utuh di bawah komentar `# ==== IBM hackathon template (do not remove) ====`. `check:ignored` hijau.
- [x] `radar/` build/typecheck/lint/test hijau (7 paket). `pnpm -C app tc` hijau.
- [ ] toko-demo build hijau oleh Bob + `bob_sessions/uaai_alief_task01_toko_demo_summary.png`. Menunggu Bob slice A1.
- [ ] Empat branch lane di remote. Setelah commit toko-demo.
- [x] `bob-evidence.sh` menghasilkan PNG tanpa klik (uji 26 Sep 00:14, PNG uji dihapus).
- [x] Nama ECC tercatat (D-alief-00). Checklist kickoff tertulis (bawah).

## Deviasi

Semua di [DECISIONS D-alief-00](DECISIONS.md#d-alief-00--25-sep-2026--fase-00--toolchain-radar-gitleaks-nama-ecc): TypeScript `~6.0.3`, alias test ke `src/`, test server pakai vitest-plugin sejak fase 00, `.gitleaks.toml` allowlist commit vendoring, anchor regex `check-ignored.sh`, opsi `--force` di `bob-evidence.sh`, plugin Cloudflare belum terpasang.

## Placeholder `TODO(sync`

Tidak ada.

## Info: file ter-track yang cocok pola template

`git ls-files -ci --exclude-standard` = 442 file (322 `app/docs` karena `app/.gitignore` Orca sendiri `docs/**`, 81 `app/src`, sisanya `app/mobile`, `app/cloud`, `app/tests`, `app/resources`, `app/config`, `app/.github`, 1 `.claude/skills`). Contoh `app/src`: `gh-account-token.ts`, `dispatch-tokens.ts`, `runtime-auth-managed-credentials.ts`. Semua tetap ter-track (`.gitignore` tidak berlaku untuk file ter-track). Hati-hati: file **baru** di `app/src` dengan nama serupa akan diam-diam ter-ignore; `check:ignored` menangkapnya.

## Temuan review (langkah 8: `ecc:code-reviewer` + `ecc:typescript-reviewer`, paralel)

| Sumber | Tingkat | Temuan | Tindakan |
|---|---|---|---|
| typescript | CRITICAL | `exports.import` → `dist/`, tetapi `deploy:web`/`dev:web`/`dev:server`/`deploy:server` tidak build dependensi dulu. Di clone bersih, `next build` gagal resolve `@radar/common` | **Diperbaiki**: script memakai `--filter "@radar/web..."` / `"^..."`. Diuji: hapus semua `dist/` → `pnpm --filter "@radar/web..." build` hijau. Komentar `next.config.ts` dikoreksi |
| typescript | HIGH | Lint type-aware tidak mencakup `packages/*/test/**` (test integrasi server) | **Diperbaiki** di `eslint.config.js` |
| typescript | HIGH→MEDIUM | Tanpa TS project references antar-paket | Dicatat. `pnpm -r build` sudah topologis dan script tunggal memakai filter `...`. Tinjau lagi di fase 04 bila build parsial jadi masalah |
| typescript | MEDIUM | Test meng-alias `@radar/common` ke `src/`, jadi jalur `dist/` tidak diuji | Dicatat. Fase 04/07 (CLI `radar`, hooks) wajib punya smoke test `node dist/cli.js --help` setelah build |
| code | MEDIUM | `bob-evidence.sh`: field `team` hilang → stack trace Node | **Diperbaiki**: `die 1` yang jelas |
| code | MEDIUM | `bob-evidence.sh`: slug seperti `github_token_setup` → PNG diam-diam ter-ignore | **Diperbaiki**: nama file dicek terhadap `token|secret|password|credential|api_?key`, exit 1 |
| code | LOW | Cakupan `check-ignored.sh` lebih luas dari perintah literal R5 §8 | Sudah di D-alief-00 butir 5 |
| typescript | LOW | `hooks`/`mcp` build pakai `tsc`, belum bundle esbuild CJS (R5 §1) | Sengaja ditunda ke fase 07 (esbuild sudah devDep) |

Kompatibilitas bash 3.2 (`/bin/bash` macOS) diuji langsung: usage, validasi nama/nomor/slug, `check-ignored.sh` semua jalan. ### UI gate (`better-interface`, gate cepat pemicu eskalasi)

Cakupan: `radar/packages/web/app/{layout,page,demo/page}.tsx` hasil `next build` (export statis, disajikan lokal), dibuka di browser pane pada lebar 1440, 390, dan 320. `@radar/ui` `AgentTag` belum dipakai di halaman mana pun (hanya dites di jsdom).

| Pemicu | Hasil |
|---|---|
| Kontrol tanpa nama aksesibel | Tidak ada. Satu-satunya kontrol `<a>Replay</a>` punya teks |
| Fokus keyboard terlihat | Ya. Tab → `A`, outline `auto 1px` (bawaan browser, tidak dihapus preflight Tailwind) |
| Terpotong/scroll horizontal di 320 px | Tidak. `scrollWidth` = 320 |
| Kontras teks | Hitam `rgb(0,0,0)` di atas putih |
| `lang` | `<html lang="en">` ada |

**HIGH: 0.** Halaman ini placeholder dan tidak punya desain. Domain `better-layout/writing/typography/colors/ui`: *Not reviewed*, karena belum ada desain yang bisa dinilai. Review lengkap (landing warm paper, replay gelap) ada di fase 11 (Imelda). App: tidak ada perubahan di `app/src/renderer/**`.

## Bob slice

- A1 toko-demo: **menunggu** Bob IDE (mode Code). Bukti: `bob_sessions/uaai_alief_task01_toko_demo_summary.png` via `radar/scripts/bob-evidence.sh alief 01 toko_demo`.
- Sab 26 Sep 00:11 WITA: percobaan otomatis lewat CDP (Bob IDE 2.2.0, port 9223). Buka app, ketik prompt, dan kirim **berhasil**. Bob menjawab "Request Failed": log ekstensi `ProviderError … Caused by: Forbidden` + `Model information unavailable`, Retry gagal sama. Status bar: instance `ibm-coding-challenge-2`, bukan `ibm-coding-challenge-uat`. Masalah akun/instance (TODO D2), bukan otomasi. Detail + selector: `radar/docs/SPIKE_RESULTS.md` bagian "Bob IDE UI automation over CDP".
- Uji `bob-evidence.sh alief 99 uji --force`: PNG jendela Bob IDE tertangkap tanpa klik (izin Screen Recording sudah ada). PNG uji + baris indeks sudah dihapus. LANGKAH MANUAL 1 selesai untuk Mac Alief.

## LANGKAH MANUAL

1. Beri izin **Screen Recording** untuk app Claude / terminal (System Settings → Privacy & Security → Screen Recording), restart app. Lalu uji `radar/scripts/bob-evidence.sh alief 99 uji --force` dengan Bob IDE terbuka, cek PNG, hapus PNG uji + baris INDEX-nya.
2. Baca hackathon guide 2.0. Catat di DECISIONS: langkah resmi screenshot ringkasan task, Bobcoin per akun, model watsonx yang dilarang, aturan persiapan sebelum kickoff, batas ukuran video/deck.
3. Setiap orang: login Bob IDE, catat versi (Help → About, minimal 2.0.2). Mac Alief: IBM Bob 2.1.0 terpasang (TODO D1/D2).
4. Buat repo GitHub publik `toko-demo` dari `radar/examples/toko-demo/` (TODO B3), setelah Bob slice A1.
5. Fine-grained PAT hanya untuk `toko-demo` (contents read & write), simpan di password manager, bukan repo (TODO B4). Dipasang di fase 03 lewat `wrangler secret put GITHUB_TOKEN` yang diketik manusia.
6. Akun Cloudflare (Workers + Pages, Free) → `npx wrangler login` (TODO B1/B2). Belum deploy.
7. Setiap anggota: `/plugin list ecc@ecc` (ECC 2.2.2 di Mac Alief).
8. Pasang plugin Cloudflare: `/plugin marketplace add cloudflare/skills` → `/plugin install cloudflare@cloudflare`.
9. Umar menambah collaborator (Alief, Aarief, Imelda) ke `umarmuhdhor/IBM`.
10. Cek visual `pnpm -C app dev` (app Orca masih jalan), lalu tutup.
11. Sepakati warna anggota: A `#78A9FF`, B `#BE95FF`, C `#FF832B` (R5 §4, DESIGN.md §2.1).
12. ~~Perbaiki pnpm global Mac Alief~~ **Selesai 26 Sep 00:40**: `npm uninstall -g pnpm` (11.9.0), `corepack enable pnpm`, `corepack install -g pnpm@12.0.0`. `pnpm -v` = 12.0.0 dari root, `radar/`, `app/`; `pnpm -C radar install --frozen-lockfile && test` hijau.
13. **Skill global membebani Bob IDE.** Bob 2.2.0 memuat ~930 skill Global dari `~/.claude/skills` + `~/.agents/skills` (Settings → Skills, 47 halaman). Prompt "ok" saja = body `POST /inference/v1/chat/completions` 598 KB. Setelah akses Bob pulih, ini akan menghabiskan Bobcoin. Keputusan user: batasi skill yang dimuat Bob.
14. **Bob inference 403.** Debug log: `GET https://api.us-east.bob.ibm.com/inference/v1/model/info` → 403 dan `POST …/chat/completions` → 403, sedangkan info akun (budget 40.00) terbaca. Akun Bob: team `ibm-coding-challenge-2`. Perlu cek: IBMid = email registrasi lablab, undangan team sudah diterima, atau kendala dari penyelenggara.

## Catatan handoff

- Workspace: `pnpm -C radar install` lalu `pnpm -C radar test`. Versi bersama lewat `catalog:` di `radar/pnpm-workspace.yaml`; paket baru pakai `"vitest": "catalog:"` dsb.
- Test yang mengimpor `@radar/common`/`@radar/ui` wajib memakai `resolve: { alias: workspaceAlias }` dari `radar/vitest.shared.ts`.
- Server: setelah menambah binding (DO fase 03), jalankan `pnpm -C radar/packages/server types` lalu commit `worker-configuration.d.ts`.
- Nama file: hindari `token`, `secret`, `password`, `credentials`, `apikey`, `config.json`, folder `build/`/`dist/`/`env/`. `check:ignored` di CI akan gagal.
- Lane Umar → fase 01 di `lane/bob`. Lane Aarief → fase 09 di `lane/app` (mock). Lane Imelda → fase 11 bagian D di `lane/web` (fixture). Lane Alief → fase 02 di `lane/core`.
