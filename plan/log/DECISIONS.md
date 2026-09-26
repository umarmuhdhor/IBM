# Keputusan & deviasi (append-only)

Setiap perubahan kontrak (`plan/ref/*`), stack, atau scope dicatat di sini. Jangan menghapus entri lama; kalau keputusan dibatalkan, tambah entri baru yang merujuk entri lama.

Format:

```text
## D-<nomor> · <tanggal WITA> · fase <XX> · <judul singkat>
- Keputusan:
- Alasan:
- Alternatif yang ditolak:
- Dampak ke paket/fase lain:
- File ref/ yang diperbarui:
```

---

## D-000 · 25 Sep 2026 · plan · Keputusan awal dari penyusunan plan

- Keputusan:
  1. Monorepo pnpm di root repo ini; repo contoh `examples/toko-demo` menjadi repo GitHub terpisah yang disinkronkan Radar.
  2. Token disimpan di tabel `token` (bukan kolom `member.token_hash` seperti ERD PRD §13) supaya token Mission Control (`kind=mc`) dan token anggota berada di satu tempat.
  3. "Bebas" dan "Dicabut" tidak disimpan sebagai baris `lock`: bebas = tidak ada baris, dicabut = event `lock.revoked` lalu baris dihapus.
  4. Endpoint tambahan di luar PRD §13: `GET /v1/state`, `GET /v1/team`, `GET /v1/requests`, `GET /v1/proposals`, `POST /v1/requests`, `POST /v1/notify`, `GET /v1/activity`, `POST /v1/locks/revoke`, `POST /v1/tasks/:id/activate`, `POST /v1/tasks/:id/cancel`, `POST /v1/ai-edits`, `GET /v1/report/session`, `GET /v1/files/history`. Semua dibutuhkan tool MCP / Mission Control yang disebut PRD.
  5. Coder tanpa task aktif yang menulis file bebas mendapat task implisit `adhoc` (supaya invariant "kunci selalu dipegang task" tetap berlaku).
  6. Reducer event (`applyEvent`) tinggal di `@radar/common` dan dipakai bersama oleh Mission Control live dan replay.
- Alasan: menjaga satu sumber kebenaran untuk live + replay, dan menutup celah yang tidak dijelaskan PRD.
- Dampak: fase 02, 03, 05, 09, 11.
- File ref/ yang diperbarui: R2, R3, R4.

<!-- Entri baru di bawah baris ini -->

## D-001 · 25 Sep 2026 · plan · Revisi v0.3 (app desktop, tonton terminal, ECC, 3 lane)

- Keputusan:
  1. Nama produk **IBM Bob Live Collab**. Codename teknis tetap `radar` (CLI `radar`, paket `@radar/*`, `radar-mcp`, folder `radar/`, `.radar/`) supaya kontrak R1–R5 tidak perlu di-rename massal. Semua teks untuk user dan juri memakai "Live Collab". Ditulis "community hackathon project, not an official IBM product".
  2. Repo produk = **fork GitHub `stablyai/orca`** (MIT) bernama `ibm-bob-live-collab`. Kode Live Collab di workspace pnpm terpisah `radar/`. Mission Control web v0.2 diganti view di app desktop. Web tinggal replay `/demo`.
  3. Fitur baru P0: tonton terminal Bob rekan (read-only). Ketik sebagai tamu = P1. Relay terminal dibuat sendiri di server Live Collab. Relay bawaan Orca (`cloud/apps/relay`, Postgres) tidak dipakai.
  4. Paket baru `@radar/ui` untuk komponen yang dipakai bersama app dan replay.
  5. Pembangunan: 3 lane (Alief = core, Umar = Bob, Aarief/Imelda = app) dengan branch `lane/*`. Hanya Lane Alief yang mengubah kontrak. ID DECISIONS berikutnya memakai prefix lane (`D-alief-..`, `D-umar-..`, `D-app-..`).
  6. Harness: Claude Code + plugin **ECC**. `PROMPT.md` memakai `LANE` + `FASE`.
  7. Bukti Bob memakai protokol R7 (Bob slice, `bob-evidence.sh`, trailer `Bob-Assisted`, `evidence:check`).
  8. Template IBM (`.gitignore`, `.bobignore`, `SECURITY.MD`, `.env.example`) digabung ke fork. Nama file terlarang (R5 §8): `db/repo/token.ts` → `db/repo/access.ts`.
  9. Video ≤ 3 menit (aturan lablab 2.0), dan 2 statement ≤ 500 kata. PRD §15 dan fase 14 disesuaikan.
  10. Warna mengikuti palet Carbon (DESIGN.md §2.1), font IBM Plex.
- Alasan: permintaan tim (multiplayer beda akun Bob seperti Google Docs, menonjolkan IBM Bob, UI ala Amoeba, 3 AI paralel), plus aturan submission lablab 2.0.
- Alternatif yang ditolak: Mission Control tetap Next.js (kurang menonjol, tidak memenuhi permintaan app); relay Orca (terlalu berat); rename codename ke `collab` (churn besar di kontrak menjelang kickoff).
- Dampak: semua fase. Rewrite fase 00, 09, 11, 14. Tambahan di 01–08, 10, 12, 13.
- File ref/ yang diperbarui: R1, R3 (§3.9), R5 (§4, §8), R6 (§0), R7 (baru).

## D-002 · 25 Sep 2026 · pra-kickoff · Repo tim umarmuhdhor/IBM, Orca di `app/`, skill bersama

- Keputusan:
  1. Tidak membuat fork publik baru. Repo produk = **`umarmuhdhor/IBM`** (sudah publik). Orca disalin ke **`app/`** dari `stablyai/orca@bf40d35b0b77b02fe1ad0f4103f83b73b1637522` tanpa history upstream (commit `7c86819`, 29.355 file, termasuk 329 file dokumen/benchmark yang di upstream ditambahkan paksa). `app/LICENSE` MIT tidak diubah. Dokumen tetap di root. Workspace Live Collab di `radar/`. Prefix `orca:` = `app/`.
  2. Toolchain Node 24 + pnpm 12 (syarat Orca), lewat nvm + corepack.
  3. Hasil uji build (Mac Aarief): `pnpm -C app install` 71 s. `build:unpack` gagal di mobile-web → setelah `pnpm -C app/mobile install` lolos → gagal di helper `computer-use-macos` (lipo, tidak dipakai) → helper notification/keyboard dibangun terpisah → `electron-builder --dir` dengan `CSC_NAME=- CSC_IDENTITY_AUTO_DISCOVERY=false` **berhasil** (`app/dist/mac-arm64/Orca.app`, ad-hoc). Resep di fase 11 langkah 9.
  4. appId/productName/userData diganti di awal fase 09 supaya tidak bentrok dengan Orca asli yang terpasang.
  5. Gaya UI: Orca dulu, aksen Live Collab di atasnya. Mockup Stitch hanya pedoman (DESIGN.md §0).
  6. Skill & agent bersama di `.claude/`: `electron-pro` (VoltAgent, MIT), `electron-automation` (fcakyon/claude-codex-settings, Apache-2.0), `live-collab-app` (buatan tim). Daftar skill wajib per orang di PLAN.md §11.
- Alasan: permintaan tim (pakai repo Umar, jangan buat repo publik baru, app langsung di repo itu), dan menghindari tabrakan dengan instalasi Orca asli.
- Dampak: R1 §1–2, fase 00 (langkah fork dihapus), 09 (langkah 0), 11 (resep build), PLAN §1/§3/§5.1/§11, PROMPT konteks.

## D-003 · 25 Sep 2026 · pra-kickoff · Nama lane per orang, Imelda anggota ke-4, server di Cloudflare

- Keputusan:
  1. Lane diberi nama pemiliknya: **Alief · Core** (server + sync, dulu Lane A), **Umar · Bob** (kit Bob, spike, pm-lead, eksperimen, koordinator bukti; dulu Lane B), **Aarief/Imelda · App** (dulu Lane C). Di dalam lane App: Aarief memegang app desktop di `app/` (fase 09 a/b/c, 11 A–C, E), Imelda memegang `@radar/ui`, landing + replay web (11 D), video, deck, cover, dan statement (14). Branch: `lane/core`, `lane/bob`, `lane/app`, `lane/web`. Prefix DECISIONS: `D-alief-..`, `D-umar-..`, `D-app-..`.
  2. **Imelda = anggota ke-4 dengan akun IBM Bob sendiri.** Bob slice I1 (komponen UI), I2 (landing), I3 (Long Description + outline deck). `evidence:check` mensyaratkan ≥ 3 slice untuk **keempat** anggota.
  3. **Server pindah ke Cloudflare Workers + Durable Objects** (plan Free): Hono, WebSocket Hibernation API, SQLite bawaan DO, satu DO per workspace. Git worker (`simple-git`) diganti **commit lewat GitHub REST API** (Git Data API). Web landing + replay di **Cloudflare Pages** (Next.js `output: 'export'`). CLI `radar-server` diganti `pnpm -C radar admin …` yang memanggil `/admin/*` (dilindungi `ADMIN_SECRET`). Kontrak REST/WebSocket/event (R3) **tidak berubah**.
- Alasan: gratis, tanpa VPS atau homelab yang harus nyala terus, URL tetap, dan DO memproses pesan satu per satu sehingga cek kunci bebas race. Tim meminta penamaan per orang supaya lebih mudah dibaca.
- Alternatif yang ditolak: Railway/Fly.io (butuh volume, tidak gratis penuh), homelab + Cloudflare Tunnel (laptop harus nyala 24 jam, URL berubah; tetap dipakai sebagai cadangan darurat), Vercel/Netlify Functions (stateless, tidak bisa menahan WebSocket), Supabase/Firebase (tetap butuh server untuk commit dan relay terminal).
- Dampak: ARCHITECTURE §1–§3, PRD §12, R1 §3–§5, R2 §1, R5 §5, fase 03 (rewrite), 06 (GitHub API), 02 (mock Hono), 04, 10, 11, 12, 14, PLAN §1/§2/§5.2/§7/§11, PROGRESS, R7.

## D-004 · 25 Sep 2026 · pra-kickoff · `@radar/ui` dipegang Aarief

- Keputusan: komponen UI bersama `@radar/ui` (fase 09 langkah 6, Bob slice C3) dipegang **Aarief**. Imelda memakai komponen itu di landing dan replay web, dengan Bob slice I1 = pemutar replay + `/demo`, I2 = landing, I3 = Long Description + outline deck.
- Alasan: bentuk komponen ditentukan oleh app desktop. Permintaan Aarief.
- Dampak: PLAN §2/§5.2/§7, fase 09, fase 11 D, PROGRESS, PROMPT.

## D-005 · 25 Sep 2026 · pra-kickoff · Disesuaikan dengan hackathon guide 2.0 resmi

- Keputusan:
  1. **Bob IDE = komponen inti** (syarat lolos penjurian). Semua coder dan PM di demo bekerja di Bob IDE. Bob Shell opsional. Docs resmi mengonfirmasi Bob IDE mendukung 5 hook (blokir exit 2 di `PreToolUse`, stdout `SessionStart`/`UserPromptSubmit` masuk konteks).
  2. "Tonton Bob rekan" (P0) diubah dari streaming terminal menjadi **stream aktivitas Bob IDE dari hook** (`POST /v1/bob/activity`, event `bob.activity`, R3 §2.24). Streaming terminal Bob Shell turun ke P1, dan ketik tamu ke P2. Registrasi agent `bob` di Orca menjadi P1.
  3. Bukti Bob mengikuti penamaan resmi: PNG di `bob_sessions/` dengan pola `uaai_<nama>_task<NN>_<slug>_summary.png`, untuk setiap task Bob IDE terkait submission, dari keempat anggota. `bob-evidence.sh` menangkap jendela Bob IDE otomatis (window id) dan dijalankan oleh Claude Code. Manusia hanya membuka ringkasan task. Otomatisasi klik via CDP dicoba di spike.
  4. Setup: IBMid, Bob IDE ≥ 2.0.2, instance `ibm-coding-challenge-uat` (us-east), Bobcoin dipantau di Settings → General.
  5. `DATA_SOURCES.md` ditambahkan (guide: daftar situs data publik). Semua data kita sintetis.
  6. Alur branch & merge ditulis langkah demi langkah (PLAN §6), dan PR boleh dibuat lewat fitur PR Bob IDE.
- Sumber: https://lablab-ibm-bob-2-hackathon-guide.s3.us.cloud-object-storage.appdomain.cloud/index.html dan https://bob.ibm.com/docs/ide/configuration/lifecycle-hooks
- Dampak: PRD §01/§02/§05/§10.6–10.7/§15/§17/§18, DESIGN §5.2/§5.6–5.8, ARCHITECTURE, PLAN §0/§1/§5/§6/§7/§12/§13, R3 §2.24, R7, fase 01/06/07/09/10/11/14, CLAUDE.md.

## D-006 · 25 Sep 2026 · pra-kickoff · Perbaikan plan setelah review independen (bagian implementasi)

- Keputusan:
  1. **Commit GitHub dari DO = klaim dua transaksi** (R4 §6.3). `await fetch` membuka input gate DO, jadi: Tx1 klaim (`task.commit_started_at`, 409 bila commit lain berjalan) → Git Data API (blobs → trees → commits → `PATCH refs` tanpa force) → Tx2 validasi ulang + finalisasi. Selama klaim, `checkWrite` memblokir file task dengan reason baru `committing` (R4 §3 baris 12, R2 kolom baru). Gagal = proposal tetap `menunggu`, kunci tetap, `commit.push_failed`; "Coba lagi" = approve ulang (tidak ada endpoint `retry-commit`). Task > 40 file ditolak (`too_many_files`, batas 50 subrequest). Tanpa `@octokit/rest`.
  2. **`POST /v1/bob/activity` dibangun di fase 03** (bukan 06), masuk skema & mock fase 02, dan `bobActivity` masuk state reducer (R3 §2.24, §5, §6). Field hook provisional sampai fixture spike Sab 04:00; satu jendela ubah kontrak Sab 04:00–04:30 (PR `fase-02b`). Kelebihan 20 event/s dibuang (bukan digabung). `bob.turn` tanpa ringkasan: payload `Stop` hanya session ID. BC-06 menjadi bagian JT-01 (P0) tanpa ringkasan.
  3. **Pesan blokir ke model belum terbukti**: docs Bob menyebut stderr hook hanya ke log. R3 §2.2 punya 3 jalur cadangan; instruksi mode `coder` selalu memuat "kalau edit gagal, panggil `why_blocked` dulu".
  4. **Git flow**: PR per fase dari branch snapshot `lane/<x>-fNN`, squash merge oleh pemilik, sinkron dengan `git rebase --onto origin/main lane-<x>-fNN lane/<x>` + `--force-with-lease` hanya di lane sendiri. Hanya fase 00 langsung di `main`; fase 02 lewat PR `lane/core` (= kontrak beku). Empat lane penuh: `lane/web` milik Imelda (menggantikan pembagian "Aarief/Imelda · App" di D-003).
  5. **Toolchain & test**: Node 24 untuk `radar/` (engines `>=24`, CI Node 24, satu workflow `.github/workflows/ci.yml`); bundle hook/MCP tetap `target: node20`. Test server = `@cloudflare/vitest-pool-workers`; test sync & bench = `unstable_startWorker`. `hash.ts` memakai Web Crypto supaya `@radar/common` bisa diimpor Worker. Log = console JSON + `wrangler tail`. SQL tanpa PRAGMA; FK diuji di fase 03.
  6. **Gaya app ikut Orca**: tidak ada warna palet mentah di `app/src/**`; `--lc-*` dipetakan ke token Orca di `main.css`, token baru hanya warna orang + `--lc-needs-you`. Font app = font Orca; IBM Plex hanya web/replay. `tokens.css` → `theme-vars.css` (pola `*token*` template IBM).
  7. **Bob Shell tidak ada di jalur P0** (fase 00 kickoff, fase 01 GATE, PLAN §1, DESIGN §5.2). Uji spike Bob Shell & terminal Orca jadi opsional.
  8. Slot jadwal fase disamakan dengan PLAN §5.2 (sumber tunggal). `bob-evidence.sh` final untuk tangkapan layar sejak fase 00; C4 hanya menambah `--md` + `evidence-check.ts` (pengecualian folder untuk Aarief).
- Alasan: review independen plan (25 Sep) menemukan race commit di DO, endpoint P0 yang dijadwalkan terlambat, alur squash+rebase yang bentrok, dan beberapa kontradiksi versi/nama.
- Dampak: R1, R2, R3, R4, R5, R6, R7 §3, fase 00–12, PLAN §0–§2/§5/§6/§7, plan/README, PROGRESS, PROMPT, PRD §10 (BC-05/06, stack, NFR-08, urutan potong), ARCHITECTURE, DESIGN §2/§4/§5.2, CLAUDE.md, skill `live-collab-app`.

## D-007 · 25 Sep 2026 · pra-kickoff · Asumsi teknis dicek ke sumber resmi (riset internet)

- Keputusan:
  1. **Grup shell mode Bob = `execute`**, bukan `command` (docs custom modes: nama grup yang tidak dikenal tidak memberi akses). Diubah di PRD §13, fase 01, 07, 08.
  2. **Pesan blokir tidak lewat stderr.** Docs lifecycle hooks Bob IDE: stderr hanya ke log, stdout `PreToolUse` diabaikan, keputusan JSON tidak didokumentasikan. Kontrak hook = exit 2. Jalur penjelasan tetap: instruksi mode + rules `.bob/rules-coder/` → `why_blocked` (masuk `alwaysAllow`) → baris pertama brief `UserPromptSubmit` (R4 §8 poin 0) → `file.rejected`. Mengganti urutan fallback D-006 poin 3 (JSON tidak lagi jalur pertama).
  3. **Workspace harus di-trust** (Bob IDE ≥ 2.0.2; folder untrusted melewati hook/MCP/rules tanpa error) dan **`alwaysAllow`** wajib di `.bob/mcp.json` (auto-approve MCP mati secara default). Masuk onboarding fase 07/08 dan spike 17–18.
  4. `EDIT_TOOLS_REGEX` + matcher hook menambah `office_edit` (Bob IDE 2.1.0).
  5. **Tool test diganti** (menggantikan D-006 poin 5): `@cloudflare/vitest-pool-workers` → `@cloudflare/vitest-plugin` (plugin `cloudflareTest()`), `vitest@^4.1` dipin, `SELF` → `exports.default.fetch()` dari `cloudflare:workers`, `fetchMock` (dihapus) → `@msw/cloudflare` + `msw@^2.14`, `unstable_startWorker` (deprecated) → `createTestHarness` dari `wrangler`. Storage test terisolasi per file, bukan per test.
  6. **Commit GitHub tanpa `POST blobs`**: isi file inline di `POST trees` (`content`), hapus = `sha: null`. Subrequest tetap 4. Batas `too_many_files` jadi > 100 file atau > 5 MB (menggantikan > 40 file di D-006 poin 1). Update ref: `409` dan `422` → `NonFastForwardError`; `403`/`429` + `retry-after` → `rate_limited`.
  7. **FK ON secara default di DO** (workerd PR #794); `foreign_keys`/`defer_foreign_keys` diizinkan, `journal_mode` tidak. Urutan insert/delete mengikuti FK (R2 §1). Menggantikan "SQL tanpa PRAGMA; FK diuji" di D-006 poin 5.
  8. **Kuota rows written 100k/hari** dijaga: heartbeat di attachment WebSocket (bukan SQL), alarm hanya aktif selama ada kunci atau socket menunggu `hello`, frame terminal digabung per detik (R4 §7, fase 03, fase 06 P1).
  9. **WebSocket tanpa tag**: tag tidak bisa diubah setelah `acceptWebSocket`, jadi status koneksi (`pending`/`ready`, `client`, `memberId`, `lastHeartbeat`) disimpan di `serializeAttachment` (maks 16 KiB). Klien ping dengan string persis `{"t":"ping"}` (auto-response).
  10. **`/admin/init` tidak mengambil blob per file dari Worker** (akan melewati 50 subrequest). `scripts/admin.ts` membaca clone lokal dan mengunggah lewat `POST /admin/files` per batch ≤ 100 file / ≤ 4 MB; server cukup memverifikasi `headCommit` dengan 1 request.
  11. `.github/workflows/` masuk daftar abaikan (R5 §6): token fine-grained tanpa izin Workflows tidak bisa menulis ke sana.
  12. **Registrasi agent `bob` di Orca** menyentuh ±12 file, bukan 4 (daftar di fase 09). Build app tetap lewat `build:unpack`/`electron-builder` dengan `CSC_NAME=-`, bukan `build:mac` (helper Computer Use butuh signing identity).
  13. **Gatekeeper**: sejak macOS 15 Sequoia klik kanan → Open tidak lagi melewati Gatekeeper. Petunjuk pasang = Privacy & Security → Open Anyway, atau `xattr -dr com.apple.quarantine`.
- Sumber (diakses 25 Sep 2026): bob.ibm.com/docs/ide/configuration/{lifecycle-hooks,custom-modes,mcp/mcp-in-bob}, bob.ibm.com/docs/ide/core-concepts/tools, bob.ibm.com/docs/ide/changelog; developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/{migrate-to-vitest-plugin,migrate-from-vitest-3-to-vitest-4}, .../vitest-integration/mock-outbound-requests, .../workers/wrangler/api (createTestHarness), .../workers/platform/limits, .../durable-objects/platform/{limits,pricing}, .../durable-objects/api/{state,alarms}, .../durable-objects/best-practices/websockets; github.com/cloudflare/workerd `src/workerd/util/sqlite.c++` + PR #794; docs.github.com/en/rest/git/{trees,refs} dan rate limits REST; developer.apple.com/news/?id=saqachfa (6 Agu 2024); kode vendored `app/` (Orca 1.4.197).
- Alasan: riset teknis pra-kickoff menemukan nama grup mode yang salah, paket test yang sudah diganti/dihapus, batas subrequest yang terlewati oleh `/admin/init`, dan kuota rows written yang belum dihitung.
- Dampak: R1 §3, R2 §1, R3 §2.2/§3, R4 §6.3/§7/§8, R5 §2/§4/§5/§6, fase 00/01/02/03/04/05/06/07/08/09/10/11, PRD §13/BC-04/DA-01/risiko, PLAN §1/§8, ARCHITECTURE §3, DESIGN §5.11, prompt_ui.md.

## D-alief-00 · 25 Sep 2026 · fase 00 · Toolchain `radar/`, gitleaks, nama ECC

- Keputusan:
  1. **TypeScript `~6.0.3` di `radar/`**, bukan 7.x seperti `app/`. `typescript-eslint@8.70` punya peer `typescript >=4.8.4 <6.1.0`; aturan type-aware (`no-floating-promises`, R5 §1) butuh itu. Versi bersama dipin lewat `catalog:` di `radar/pnpm-workspace.yaml` (vitest `^4.1.11`, React 19, zod 4, `@types/node ^24`).
  2. **Test memakai paket workspace sebagai source**: `radar/vitest.shared.ts` meng-alias `@radar/common`/`@radar/ui` ke `src/`, dan `exports` paket Node = `{ types: ./src/index.ts, import: ./dist/index.js }`. `pnpm test`/`typecheck` tidak butuh `build` dulu; runtime Node tetap memakai `dist/`.
  3. **Server**: test fase 00 sudah memakai `@cloudflare/vitest-plugin` + `exports.default.fetch()` (D-007). Tipe `Env`/`exports` dari `wrangler types --include-runtime=false` (`worker-configuration.d.ts`, script `pnpm types`) + `@cloudflare/workers-types`. `build` = `wrangler deploy --dry-run --outdir dist`.
  4. **`.gitleaks.toml`**: aturan default tetap aktif; hanya commit vendoring Orca `7c86819` yang di-allowlist (178 temuan di fixture/golden publik upstream, bukan secret tim). Commit berikutnya, termasuk di `app/`, tetap dipindai.
  5. **`check-ignored.sh`**: filter jalur build di-anchor (`(^|/)(node_modules|dist|out|…)/`) supaya `checkout/` atau `layout/` tidak ikut lolos; juga memeriksa `bob_sessions/`, dan mengizinkan `.dev.vars`/`.env`.
  6. **`bob-evidence.sh`**: tambah opsi `--force` (menimpa PNG tanpa tanya) karena Claude Code berjalan tanpa TTY; tanpa `--force` dan tanpa TTY script menolak (exit 1). Jendela Bob IDE dicari lewat JXA `CGWindowListCopyWindowInfo`, pemilik `IBM Bob` (bundle `com.ibm.software.bob`, v2.1.0 di Mac Alief).
  7. **Nama ECC terverifikasi** (ECC 2.2.2, `~/.claude/plugins/cache/ecc/ecc/2.2.2`): agent `planner`, `architect`, `tdd-guide`, `code-reviewer`, `typescript-reviewer`, `security-reviewer`, `build-error-resolver`, `react-build-resolver`, `react-reviewer`, `silent-failure-hunter`, `pr-test-analyzer`, `e2e-runner`, `doc-updater`, `code-explorer`, `database-reviewer`, `performance-optimizer`, `docs-lookup` · skill `tdd-workflow`, `verification-loop`, `e2e-testing`, `mcp-server-patterns`, `backend-patterns`, `api-design`, `security-review`, `git-workflow` · command `/ecc:plan`, `/ecc:code-review`, `/ecc:security-scan`, `/ecc:build-fix`, `/ecc:save-session`, `/ecc:resume-session`. Semua nama di R6 §0 cocok. Dipanggil dengan prefix `ecc:` (mis. agent `ecc:planner`). Plugin `cloudflare` belum terpasang di Mac Alief (LANGKAH MANUAL fase 00).
- Alasan: menjaga lint type-aware, CI hijau tanpa menyembunyikan secret baru, dan bukti Bob bisa diambil otomatis.
- Alternatif yang ditolak: TypeScript 7 + lint tanpa type info (kehilangan `no-floating-promises`); allowlist path `app/**` di gitleaks (akan menyembunyikan secret baru di lane App); build `@radar/common` sebelum setiap test.
- Dampak: fase 02–07 (pakai `catalog:` dan alias test), fase 03 (`pnpm types` setelah menambah binding DO), fase 11 C4 (`bob-evidence.sh` sudah punya `--force`).
- File ref/ yang diperbarui: – (tidak ada perubahan kontrak).

## D-alief-01 · 25 Sep 2026 · pra-kickoff · Perbaikan hasil review independen

- Keputusan:
  1. **Git flow per lane**: `<x>` = `LANE_ID` dari `plan/team.json` (`core`/`bob`/`app`/`web`). Ujung fase ditandai branch lokal `snap/<LANE_ID>-fNN` (bukan tag), di-push sebagai `lane/<LANE_ID>-fNN`, dan sinkron memakai `git rebase --update-refs --onto origin/main snap/<x>-fNN lane/<x>` (git ≥ 2.38). `--force-with-lease` boleh di branch lane sendiri dan snapshot sendiri. Review manusia lintas lane tidak wajib (PLAN §6, PROMPT langkah 6f/11/13, CLAUDE.md).
  2. **Sub-fase 11**: Aarief `09 → 11a → 10 → 11b → 11c → 14`, Imelda `11D1 → 10 → 11D2 → 14`. **Fase 10 = interupsi wajib Sab 21:00** untuk semua lane (PROMPT langkah 13.4). PROGRESS, plan/README, fase 09/11 diperbarui.
  3. **Jadwal Minggu**: eksperimen A/B Min 04:30–10:30 memakai akun Alief, Aarief, Imelda; **rekaman final Min 11:00–14:00** setelah GATE 2; Umar = PC D saat rekaman. Tabel anggaran Bobcoin per akun di PLAN §7, dengan cadangan rekaman yang tidak boleh dipakai eksperimen.
  4. **Milestone 4 Mac**: member D (`D:coder:Dani:dani@example.com`) ikut `admin init` (R1), fase 10 langkah 3b menguji PC D, dan semua "3 PC/3 Mac" di fase 10, PRD R0, risiko, serta fallback `.dmg` menjadi 4.
  5. **Bukti Bob**: `bob-evidence.sh` menulis indeks per anggota `bob_sessions/index/<nama>.md` (tidak ada lagi konflik rebase di `INDEX.md`). `INDEX.md` dirakit di fase 14 lewat `evidence:check --write-index`. Perintah default tanpa `--force`; fallback `--interactive`. Kickoff fase 00 menambah uji skrip di 4 Mac dengan izin Screen Recording. PRD EV-02 disamakan dengan R7.
  6. **Klaim commit punya TTL**: `COMMIT_CLAIM_TTL_MS = 60000` (R5 §4). Klaim yang lebih tua dianggap bebas oleh Tx1 dan `checkWrite`, constructor DO membersihkannya dan emit `commit.push_failed { error: "claim_expired" }` (R4 §6.3 poin 5, R2 komentar kolom, test baru fase 06).
  7. **R3 matriks**: token pm boleh memanggil `POST /v1/locks/check`, dan jawabannya selalu `block` · `pm_readonly` (sesuai R4 §2).
  8. **Versi minimum Bob IDE 2.1.0** (untuk `office_edit`) di PRD NFR-08, ARCHITECTURE, fase 00/01, PLAN §5.1. Kalimat "sejak 2.0.2" tentang trust workspace tetap, karena itu fakta sejarah.
  9. **Klaim yang jujur**: SV-10/NFR-06 tidak lagi bergantung pada `bob run --max-cost`. NFR-06 diukur dari ringkasan task Bob IDE. PRD §15 punya varian video P0-only (kartu `BobTrace`, bukan pill UI-08, subagent opsional). Klaim R7 §6.1, PLAN §10, dan fase 14 hanya menyebut fitur yang benar-benar dirilis. DA-02 (P1) keluar dari daftar "tidak boleh dipotong".
  10. **Contoh settings hook** di PRD §13 dan fase 07 langkah 9 memuat kelima hook, termasuk `Stop` dan matcher `PostToolUse` untuk tool baca/perintah (JT-02).
  11. **Gambar pihak ketiga** (diagram Akshay Pachaar dari X) dihapus dari `media-references/`. README dan `media-references/README.md` hanya menautkan. Sumber dicatat di `DATA_SOURCES.md`. Gambar lama masih ada di riwayat git.
  12. **Teks lama disapu**: nama lane (4 lane, `D-aarief`/`D-imelda`), "terminal Budi" → aktivitas Bob IDE, relay terminal = fase 06 bagian P1, fallback `check_file` di fase 01 dihapus, PR `fase-02b`, resep build di skill `live-collab-app` mengikuti fase 11 langkah 9 (`CSC_NAME=-`), DESIGN (angka Bobcoin/counter jadi placeholder, `turn end` tanpa ringkasan, 5 hook, font landing Inter + Source Serif 4, arah visual Orca dulu).
  13. `plan/TODO.md` A3–A6 diisi dengan default: A3 (a) karena D-007 sudah di `main`, A4 setuju semua, A5 setuju, A6 ya. B1–B7 dan D tetap langkah manual.
- Alasan: review independen pra-kickoff (25 Sep 23:00 WITA) menemukan 25 temuan: alur rebase yang merusak, fase 10 yang bentrok dengan fase 11, jadwal rekaman dan eksperimen yang saling makan Bobcoin, milestone yang tidak menguji PC D, klaim commit yang bisa tertinggal selamanya, serta teks lama dari sebelum D-003 sampai D-007.
- Alternatif yang ditolak: memakai tag `lane-<x>-fNN` untuk rebase (tag tidak ikut `--update-refs`); satu `INDEX.md` bersama (konflik di setiap rebase); menjalankan eksperimen setelah rekaman (tidak cukup waktu sebelum submit).
- Dampak: PLAN §1/§2/§3/§5/§6/§7/§9/§10/§11/§12, PROMPT, CLAUDE.md, README, PRD, ARCHITECTURE, DESIGN, DATA_SOURCES, PROGRESS, plan/README, TODO, fase 00/01/03/06/07/09/10/11/12/13/14, `bob_sessions/{INDEX,README}.md`, `radar/scripts/bob-evidence.sh`, skill `live-collab-app`, `media-references/`.
- File ref/ yang diperbarui: R1 (`admin init` member D), R2 (komentar `commit_started_at`), R3 §1 (matriks pm), R4 §2/§6.3 (TTL klaim), R5 §4 (`COMMIT_CLAIM_TTL_MS`), R7 (indeks per anggota, klaim C2).
## D-umar-01 · 26 Sep 2026 00:35 · fase 01 · Keputusan GATE 1 + fakta Bob IDE 2.2.0

- Keputusan (GATE 1, bukti di `radar/docs/SPIKE_RESULTS.md`, fixture di `radar/docs/spike-payloads/`):
  1. **`ENFORCEMENT = hook+server`.** `PreToolUse` exit 2 memblok keempat tool edit, juga di dalam subagent (uji 1, 1b, 20a).
  2. **Jalur pesan blokir: stderr hook exit 2 sampai ke model** di Bob IDE 2.2.0 (uji 2). Bob mengutip pesannya dan tidak mencoba ulang. Ini berbeda dari docs dan dari asumsi D-007 poin 2. Jalur cadangan tetap (instruksi mode + rules + `why_blocked`), dan terbukti jalan: setelah diblok, Bob memanggil tool MCP yang diminta instruksi mode (uji 17). JSON di stdout tetap diabaikan (uji 2b).
  3. **Brief = stdout `SessionStart`/`UserPromptSubmit`** (uji 3). `SessionStart` terpicu per task Bob, bukan per jendela IDE.
  4. **`SYNC = watch`** (chokidar 4, debounce 150 ms): p95 212 ms, 0 hilang, 0 gema di dua folder satu Mac. Uji dua Mac = TODO D4 (Alief).
  5. **Timeout hook = fail-open** (uji 19). `lock_guard` harus selesai jauh di bawah `timeout` (rencana 3 s dengan `HOOK_SERVER_TIMEOUT_MS` 1,5 s tetap aman).
  6. Grup mode tetap `execute` (terdokumentasi). Catatan: `command` juga diterima Bob IDE 2.2.0 (uji 20b), jadi D-007 poin 1 benar untuk docs, tapi `command` tidak "tanpa akses". `[read, mcp]` tidak punya edit maupun `execute_command` (uji 5).
  7. `EDIT_TOOLS_REGEX` (R5 §4) **tidak berubah**.
- Usulan kontrak untuk Lane Core (jendela fase-02b, Sab 04:00–04:30; Lane Bob tidak mengubah `plan/ref`):
  - P1. Bentuk payload nyata Bob IDE 2.2.0 = `{ session_id, cwd, hook_event_name, tool_name, tool_input, tool_use_id }`, `PostToolUse` + `tool_response` (bukan `output`), `UserPromptSubmit` + `prompt`, `SessionStart` + `source`, `Stop` + `last_assistant_message`. Bentuk docs (`event`/`tool`/`input`) tidak terlihat; normalizer fase 02 sudah menerima keduanya, cukup tambah fixture nyata.
  - P2. Path selalu di `tool_input.path` (relatif workspace) untuk `write_file`/`apply_diff`/`search_and_replace`/`insert_content`.
  - P3. R3 §2.2 kalimat "Jalur `message` ke model: bukan stderr" → stderr menjadi jalur pertama (terbukti), tiga jalur lain jadi cadangan.
  - P4. R3 §2.24 `turn.end`: `Stop` membawa `last_assistant_message`. Usul: tetap tidak dikirim (privasi, D-alief-01 poin 9), cukup ubah kalimat "hanya session ID".
  - P5. `tool_response` `read_file` berisi isi file: hook tidak boleh meneruskannya ke server (sudah sesuai R3 §2.24 "isi file tidak pernah dikirim").
- Fakta untuk fase 07/08 (lane Bob sendiri):
  - Server MCP stdio dijalankan dengan cwd `/` → `radar-mcp` dipanggil lewat `${workspaceFolder}/…` dan menerima path workspace dari argumen/env, bukan `process.cwd()`. Nama tool di hook: `mcp__<server>__<tool>`. Client `mcp-use` 2.2.5, protokol `2025-11-25`.
  - `alwaysAllow` jalan, kecuali panggilan pertama setelah `mcp.json` berubah (server hot-restart). Checklist onboarding: jangan ubah `mcp.json` tepat sebelum demo, atau lakukan satu panggilan pemanasan.
  - Workspace untrusted = panel Bob kosong (bukan hook dilewati diam-diam). Onboarding: trust folder.
  - Hook cwd = root workspace, tanpa env `BOB_*`, mewarisi env proses yang membuka Bob. Hook `.js` mewarisi `"type"` dari `package.json` terdekat → kit memakai `.cjs` atau `package.json` sendiri.
  - `PreToolUse` terpicu sebelum dialog approve. Stdout `PostToolUse` tampil di transkrip → hook `mark_ai_edit` tidak mencetak apa pun.
  - Overhead hook `node` ± 37–47 ms.
  - Instance akun di Mac Umar = `ibm-coding-challenge-2` (us-east), bukan `ibm-coding-challenge-uat`. Perlu dikonfirmasi tim (TODO D2).
- Alasan: hasil spike otomatis via CDP di Bob IDE 2.2.0 (18 task, ± 1,3 Bobcoin + B1 0,345).
- Alternatif yang ditolak: `ENFORCEMENT = server-only` (tidak perlu, hook terbukti); `SYNC = poll-1s` (watch cukup cepat); pindah grup ke `command` (tidak terdokumentasi).
- Dampak: fase 02 (fixture + normalizer, jendela 02b), fase 03 (`bob/activity` field), fase 07/08 (kit, `radar-mcp` path, onboarding), fase 10 (checklist trust + pemanasan MCP), fase 11a (`session_id` = Task Id Bob).
- File ref/ yang diperbarui: – (usulan P1–P5 menunggu Alief).

## D-umar-02 · 26 Sep 2026 01:10 · fase 07 · Bentuk kit coder `.bob/` setelah uji di Bob IDE

- Keputusan:
  1. Hook dibundel ke `.bob/hooks/*.js` (CJS, node20) dan kit membawa **`.bob/package.json` `{"type":"commonjs"}`**. Tanpa file itu, hook gagal di proyek yang `package.json`-nya `"type": "module"` (fakta spike D-umar-01).
  2. `.bob/mcp.json`: `"args": ["${workspaceFolder}/.bob/radar-mcp.js", "--root", "${workspaceFolder}"]`. `radar-mcp` membaca root dari `--root` (fallback `RADAR_ROOT`, lalu cwd), tidak pernah dari cwd saja, karena Bob menjalankan server stdio dengan cwd `/`.
  3. Matcher `PostToolUse` = tool edit + `read_file` + `execute_command` (nama dari payload spike). `mark_ai_edit` tidak mencetak apa pun dan melewati tool `mcp__radar__*`. `Stop` hanya mengirim `turn.end` + `sessionId`; `last_assistant_message` tetap lokal.
  4. Fail-open `lock_guard` dicatat lokal saja (`.radar/hook.log`), pilihan minimal di fase 07 langkah 3. Server tetap punya lapis 2 (sync agent).
  5. **Instruksi mode `coder` poin 1a:** "jangan menolak sendiri, coba edit, Radar yang memutuskan". Tanpa ini Bob menolak semua file di luar daftar task-nya (termasuk file bebas), jadi hook tidak terpicu dan permintaan otomatis ke PM tidak pernah dibuat. Setelah perubahan: jalur hook 3/3. Catatan untuk Lane Core (brief R4 §8) dan naskah demo: file yang sudah diumumkan dipegang/antre di brief atau `my_tasks` tetap dijelaskan Bob tanpa percobaan edit.
- Alasan: uji perilaku di Bob IDE 2.2.0 (workspace sintetis `toko-sim`, fake server `radar/spike/fake-radar`), log fase 07.
- Alternatif yang ditolak: nama `.cjs` (mengubah nama file di spec dan `settings.json`); path MCP relatif (gagal, cwd `/`); membiarkan Bob menolak sendiri (menghilangkan momen blokir dan permintaan otomatis).
- Dampak: fase 04 (`radar kit install` menyalin `.bob/package.json`), fase 08 (kit PM memakai pola yang sama), fase 10 (uji ulang di `toko-demo`), fase 14 (naskah demo: file rebutan tidak diumumkan di brief B sebelum B mencoba).
- File ref/ yang diperbarui: – (tidak ada perubahan kontrak).

## D-umar-03 · 26 Sep 2026 01:30 · fase 08 · Kit PM dan tuning main agent

- Keputusan:
  1. Kit PM `bob-kit/pm/.bob/`: mode `pm-lead` `[read, mcp]`, `mcp.json` sama pola kit coder (`${workspaceFolder}` + `--root`) dengan `alwaysAllow` 8 tool PM, `settings.json` hanya brief (SessionStart + UserPromptSubmit) dan stop. Tidak ada `lock_guard`/`mark_ai_edit` (PM tidak menulis; server menolak update role pm).
  2. Instruksi `pm-lead` = spec fase 08 + tuning: `setujui_beri_tahu` bila perubahan benar tetapi file milik task lain harus menyesuaikan; `kembalikan` hanya bila task itu sendiri salah; `notify.member`/`owner` selalu ID anggota. Tanpa tuning: 1 dari 4 review memakai nama ("Budi") dan 1 memilih `kembalikan`; sesudah: 3/3 benar.
  3. `team_status` menampilkan `id` di depan nama anggota (sumber ID untuk `notify`/`ownerId`).
  4. Respons server di tool PM dijaga dengan default (`?? []`) sampai skema zod `@radar/common` (fase 02) bisa dipakai untuk validasi penuh.
- Alasan: uji perilaku di Bob IDE 2.2.0 (workspace sintetis `pm-sim`, fake server) dan review `ecc:code-reviewer` + `ecc:typescript-reviewer`.
- Alternatif yang ditolak: tool `approve` untuk PM (melanggar MA-07); membiarkan `kembalikan` untuk breaking change lintas task (bertentangan dengan adegan demo PRD §15 dan MA-04).
- Dampak: fase 09 (kartu keputusan menampilkan `reason` panjang), fase 10 (uji di PC C), fase 14 (naskah demo adegan review).
- File ref/ yang diperbarui: – (tidak ada perubahan kontrak).

## D-alief-02 · 26 Sep 2026 04:10 · fase 02 · Kontrak `@radar/common`, celah spesifikasi, dan usulan D-umar-01

- Keputusan:
  1. **Usulan D-umar-01 P1–P5 diterima.** Normalizer `normalizeHookPayload` menerima bentuk nyata Bob IDE 2.2.0 (`session_id`, `hook_event_name`, `tool_name`, `tool_input.path`, `tool_response`, `prompt`, `source`, `last_assistant_message`) dan bentuk docs; fixture nyata `radar/docs/spike-payloads/` jadi test. R3 §2.2: stderr hook exit 2 jadi jalur pertama, tiga jalur lain cadangan (P3). R3 §2.24: `turn.end` membawa session ID saja; `last_assistant_message` tidak dikirim (P4). Isi `tool_response` tidak pernah dikirim (P5).
  2. Celah spesifikasi yang ditutup di kode (G1–G12):
     - G1. `NormalizedHook.input` menyimpan `tool_input` mentah untuk hook yang butuh field selain `path`.
     - G2. Konstanta baru `ACTIVITY_TIMEOUT_MS = 800` (R5 §4) dan `shareprompts` di `.radar/local.json` + env `RADAR_SHAREPROMPTS` (R1 §6, R5 §5). Default mati.
     - G3. `clientTs` di `BobActivityReq` opsional dan tidak disimpan di event.
     - G4. `toWorkspaceRelative` melempar `PathOutsideWorkspaceError`; `tryWorkspaceRelative` mengembalikan `null` (untuk hook yang harus fail-open).
     - G5. Subpath `@radar/common/node` untuk helper file system. Entry utama bebas `node:*` dan `process.` (dicek `bundle.test.ts`, bundel esbuild platform neutral).
     - G6. Matcher abaikan murni dari teks (`createIgnoreMatcherFromText`); pembaca `.gitignore` ada di `/node`.
     - G7. `memberStatus(state, memberId, now)` menerima `now` (bukan `Date.now()` di dalam).
     - G8. Event dengan tipe tak dikenal hanya memajukan cursor di reducer.
     - G9. `GET /v1/tasks?owner=me` diterima selain ID anggota.
     - G10. = poin 1 (R3 §2.2 dan §2.24).
     - G11. `LockHolder.sinceMs` opsional (kunci dari snapshot lama tidak punya waktu mulai).
     - G12. `pnpm bundle:kit` (fase 07) butuh `@radar/common` di-build dulu; urutan ada di README paket.
  3. `StateRes` di wire memakai array (`members`, `tasks`, `locks`, `files`, `requests`, `proposals`, `recentEvents`). Klien memakai `stateFromSnapshot(res)` untuk `RadarState` berkunci.
  4. Bentuk respons admin yang dipakai mock dan harus diikuti server fase 03: `POST /admin/init` → `201 { workspace, tokens: { <memberId>: <token>, mc: <token> } }`; `POST /admin/files` → `{ inserted, headCommit }`, path yang diabaikan (R5 §6) dilewati.
  5. Mock server `radar/scripts/mock-server.ts` (Hono + ws, in-memory, reducer dan skema dari paket ini) jadi pengganti server untuk lane lain sampai fase 03 ter-deploy. Token dev `tok-a`/`tok-b`/`tok-c`/`mc-dev` hanya ada di mock.
- Pertanyaan terbuka untuk fase 05: di mock, hasil `block` mengisi `queuePos` bila task peminta sudah antre. Menurut R4 `findOpen`, permintaan baru tetap dibuat setelah permintaan lama `diputuskan` (B yang dicek lagi setelah R-1 diputuskan membuat R-2). Fase 05 memutuskan apakah task yang sudah antre dikecualikan dari permintaan baru.
- Alasan: jendela ubah kontrak fase 02; semua celah ditemukan `ecc:planner` saat memetakan R1–R5 ke kode, dan fixture spike Umar.
- Alternatif yang ditolak: `StateRes` berbentuk map (JSON lebih besar dan urutan tidak stabil); satu entry dengan `node:*` di belakang cek runtime (Worker gagal bundel); menormalkan CRLF sebelum hash (versi berbeda dari isi file sebenarnya).
- Dampak ke paket/fase lain: fase 03 (bentuk admin + `StateRes` array + `owner=me`), fase 04 (`/node`, ignore), fase 05 (pertanyaan terbuka antre), fase 07/08 (kit memakai normalizer + `ACTIVITY_TIMEOUT_MS` + `shareprompts`), fase 09 (app memakai `stateFromSnapshot`, selector, mock).
- File ref/ yang diperbarui: R1 §6 (`shareprompts`), R3 §2.2 (jalur pesan blokir), R3 §2.24 (`clientTs` opsional, `turn.end`), R5 §4 (`ACTIVITY_TIMEOUT_MS`), R5 §5 (`RADAR_SHAREPROMPTS`).

## D-aarief-01 · 26 Sep 2026 · fase 09 · Batas koneksi dan presentasi app

- Keputusan: role Settings mengikuti R3 sebagai `coder | mc`. Token disimpan dan dipakai di main process melalui `safeStorage`; main process menjalankan WebSocket dan REST, renderer hanya menerima state/event melalui IPC. Ini menjaga token keluar dari log dan state renderer. Mission Control memakai drawer/sheet Orca, tanpa jenis tab persisten baru. Token `--lc-*` app mengambil warna/font Orca; UI web memakai `theme-vars.css`. Tambahkan `--lc-person-d` (#08BDBA) untuk member keempat sesuai R5 §4.
- Alasan: kontrak R3 membatasi decision ke `mc`, DoD fase 09 melarang token di renderer, dan app vendored Orca meminta perubahan aditif.
- Deviasi: path `lib/radar/ws-client.ts` dan `lib/radar/api.ts` di rencana fase menjadi modul main process.

## D-alief-03 · 26 Sep 2026 09:00 · fase 03 · Server inti di Cloudflare: bentuk admin, aturan WS, dan penyimpangan kecil

- Keputusan:
  1. **Admin API** (skema baru di `@radar/common` `schemas.ts`, dipakai server dan `scripts/admin.ts`):
     - `POST /admin/init` `AdminInitReq {workspace, repo?, branch='main', members[1..8], force?}`. `repo` opsional (lokal tanpa GitHub), regex `owner/name`. ID `mc` dilarang untuk member. `email` opsional; default `git_email` = `<id>@users.noreply.radar`. Warna dari `MEMBER_COLORS[id]`, selain itu palet per indeks. Sudah ada data tanpa `force` → 409; `force` = wipe lalu init. Balasan `201 {workspace, tokens:{<id>, mc}}` (sama dengan mock D-alief-02).
     - `POST /admin/files` `{headCommit|null, files ≤ 100}`, total ≤ 4 MB. 409 sebelum init. Path di luar workspace, diabaikan (R5 §6), > `MAX_FILE_BYTES`, atau biner **dilewati diam-diam** (sama seperti sync agent). Impor ulang hanya menimpa file yang masih v1; file yang sudah diedit tim tidak disentuh. `headCommit: null` mempertahankan `meta.head_commit` lama.
     - `POST /admin/token {member, rotate:true}` → `{member, token}`. `member: 'mc'` merotasi token mc. Token lama dicabut dan socket principal itu ditutup 4401. Member tak dikenal → 404.
     - `GET /admin/export` memakai query yang sama dengan `/v1/events/export`. `POST /admin/reset {confirm:true}` → `{ok:true}`: tutup semua socket 1012, hapus alarm, `deleteAll`, migrasi ulang, kosongkan limiter.
  2. **Verifikasi `headCommit` ke GitHub** hanya bila `GITHUB_COMMIT='true'` dan repo terisi (timeout 10 s, gagal → 422, beda → 409). Test msw ditunda ke fase 06 (fase itu memasang `@msw/cloudflare` untuk Git Data API).
  3. **Patch hanya di export.** `file.changed` di log tidak menyimpan diff; `/v1/events/export` dan `/admin/export` menghitung `patch` dari `file_version` v-1 → v saat diminta. Batas export 1000 event per panggilan (`limit` dipotong ke 1000).
  4. **`bob.activity`**: `text` > 200 dipotong (tanpa memecah surrogate pair), bukan 422. `clientTs` dibuang. Rate limit 20/s per member di memori DO; jumlah yang dibuang ditulis satu baris `metric(activity_dropped)` saat jendela berikutnya member itu dimulai (hilang bila DO hibernasi lebih dulu; metrik best-effort).
  5. **Aturan hello**: `sync` butuh token member, `mc` butuh token mc, `app` menerima keduanya. Gagal → `error UNAUTHORIZED` + close 4401. `file.applied` jadi event `sync.applied {latencyMs}` (tanpa baris metric).
  6. **State attachment `closed`** (selain `pending`/`ready`/`replaced`). Socket ditandai `closed` sebelum server menutupnya (hello gagal/kedaluwarsa, reset), supaya callback close dan penjadwal alarm mengabaikannya dan reset tidak menulis `member.offline` ke DB baru. Kirim WS yang gagal → log error + tutup 1011, jadi klien reconnect dan dapat snapshot baru.
  7. **Skema** ada di `src/db/schema.ts` (string SQL R2 §2 verbatim, `SCHEMA_VERSION='1'`), bukan `schema.sql`: wrangler/vitest tidak perlu loader teks. Wrangler `alias` `@radar/common` → `../common/src/index.ts`, jadi `wrangler dev/deploy` tidak butuh build common dulu.
  8. **Hashing sinkron** (`node:crypto` lewat `nodejs_compat`). Handler `file.update` dan auth tidak pernah `await`, jadi pesan WS tidak bisa saling sisip di tengah transaksi.
  9. **Belum didukung**: `file.delete` (P1) dan `term.*` (P1 fase 06) dibalas `error BAD_REQUEST` tanpa menutup socket. `snapshot` dikirim sebagai satu pesan (risiko ukuran untuk repo besar; dicek ulang di fase 04 dengan toko-demo, 18 file).
  10. **`scripts/admin.ts` memakai `node:util` `parseArgs`**, bukan `commander` (spesifikasi langkah 8): fitur yang dipakai cukup, tanpa dependensi baru.
- Temuan review MEDIUM/LOW yang dicatat (tidak diperbaiki di fase 03):
  - Security M1: `/admin/*` tanpa rate limit tebakan `x-admin-secret`. Mitigasi: `ADMIN_SECRET` wajib string acak ≥ 32 byte (TODO B5). Rate limit Cloudflare ditinjau di fase 12.
  - Security M2: `PUBLIC_EXPORT=true` + `CORS_ORIGIN=*` membuka seluruh riwayat diff. Default `false`; hanya dinyalakan untuk replay publik dengan data sintetis (fase 11D).
  - Security L: `file.update` tanpa rate limit per socket; socket `pending` tanpa batas jumlah (dibatasi waktu 5 s). Fase 12.
  - Silent-failure M: `hub.close` menelan semua error `ws.close` (hanya kasus sudah tertutup yang diharapkan).
  - TS M: `delete payload.clientTs` di route `bob/activity` (destrukturisasi ditolak ESLint `no-unused-vars`).
- Alasan: spesifikasi fase 03 langkah 8–12, D-007, dan review `ecc:code-reviewer`, `ecc:typescript-reviewer`, `ecc:security-reviewer`, `ecc:silent-failure-hunter`, `ecc:pr-test-analyzer`.
- Alternatif yang ditolak: Worker mengambil isi file dari GitHub (batas 50 subrequest plan Free); diff disimpan di setiap event (baris dan byte berlipat); tag `acceptWebSocket` per klien (tidak bisa diubah setelah hello); `heartbeat` menulis SQL tiap 15 s (kuota rows written).
- Dampak: fase 04 (protokol WS, `seedTestWorkspace`, ukuran snapshot), fase 05 (`authorizeWrite` diganti `locks.checkWrite`, job alarm 30 s), fase 06 (test msw `headCommit`, `term.*`), fase 09/11 (app memakai `client:'app'`), fase 12 (rate limit admin/WS).
- File ref/ yang diperbarui: – (bentuk admin ada di skema `@radar/common`; R3 tidak berubah).
## D-imelda-01 · 26 Sep 2026 · fase 11D1 · Sumber fixture replay: skenario mock asli, bukan data sintetis baru

- Keputusan: `radar/packages/web/fixtures/replay/export.json` dibuat dengan menjalankan `pnpm dev:mock -- --scenario demo --instant` (skrip Alief, hanya dibaca lewat CLI, tidak diimpor saat runtime dan tidak diubah), menangkap `GET /v1/events/export` (61 event, sesuai persis PRD §15: A pegang checkout.ts, B diblokir, PM memutuskan "antre" otomatis), lalu menghitung ulang `ts` tiap event dari `delayMs` kumulatif di `radar/scripts/mock-scenarios/demo.json` sendiri (mode `--instant` membuat semua `ts` sama karena wall-clock). Ditambah satu event `commit.created` sintetis di akhir (skenario aslinya tidak pernah commit) supaya chapter "Commit" (DESIGN §5.8) punya sesuatu untuk ditunjuk. Skrip generator satu-pakai, tidak di-commit.
- Alasan: memakai data yang sudah disetujui kontrak (bentuk event tervalidasi zod, narasi cocok PRD) lebih aman daripada mengarang dataset paralel; README mengizinkan fixture untuk 11D1.
- Dampak: `scripts/export-replay.ts` (fase ini) membaca fixture ini sebagai fallback saat `RADAR_EXPORT_URL` tidak diset.
- File ref/ yang diperbarui: – (tidak ada perubahan kontrak; `TODO(sync:alief)` di `scripts/export-replay.ts` menandai penggantian dengan `GET /v1/events/export` asli setelah fase 05/06, dan dengan rekaman nyata setelah milestone fase 10 / 11D2).

## D-imelda-02 · 26 Sep 2026 · fase 11D1 · `bob-quotes.src.json` tidak ada; pakai `bob-kit/prompts/bob-quotes.json`

- Keputusan: fase file menyebut input `bob-quotes.src.json`, tapi file itu tidak pernah dibuat. Panel "Bob inside" memakai `radar/bob-kit/prompts/bob-quotes.json` (milik Umar, fase 07, objek berkunci bukan array) apa adanya, disalin ke `public/demo/bob-quotes.json` saat export.
- Alasan: itu satu-satunya sumber kutipan Bob nyata (dari sesi Bob IDE asli) yang ada di repo.
- Dampak: tidak ada — hanya path input yang berbeda dari yang tertulis di fase file.
- File ref/ yang diperbarui: –

## D-imelda-03 · 26 Sep 2026 · fase 11D1 · Definisi counter replay (`near-misses` · `decisions` · `merge conflicts` · `median decision`)

- Keputusan: R3/DESIGN tidak mendefinisikan rumus counter §5.8 secara presisi. Dipakai: `nearMisses` = jumlah event `lock.blocked`; `decisions` = jumlah `proposal.decided` (semua `kind`); `mergeConflicts` = jumlah `commit.push_failed`; `medianDecisionSeconds` = median (`request.decided.ts` − `request.created.ts`) yang dipasangkan lewat `requestId`, dalam detik. Diimplementasikan di `src/replay/metrics.ts`, diuji lewat 7 kasus (kosong, ganjil, tidak ada pasangan, dll).
- Alasan: ini satu-satunya pemetaan langsung dari katalog event R3 §5 ke empat angka yang diminta DESIGN §5.8.
- Dampak: kalau Lane Core menambah event `near_miss` atau `decision` eksplisit di kontrak nanti, `metrics.ts` perlu disesuaikan (bukan breaking, hanya definisi ulang).
- File ref/ yang diperbarui: –

## D-imelda-04 · 26 Sep 2026 · fase 11D1 · Snapshot replay per 10 detik = waktu event, bukan waktu putar

- Keputusan: "snapshot tiap 10 detik untuk seek cepat" (fase 11D1 langkah 15) diartikan sebagai 10 detik offset `ts` event (`ev.ts − events[0].ts`), bukan 10 detik waktu nyata pemutaran. Diimplementasikan di `src/lib/replay-player.ts` (`buildSnapshots`/`stateAtOffset`), independen dari kecepatan putar (1×/2×/4×/8×).
- Alasan: snapshot berbasis waktu putar akan berubah tiap kali kecepatan diganti, sehingga cache-nya harus dibangun ulang; snapshot berbasis waktu event dihitung sekali dan dipakai untuk semua kecepatan.
- Dampak: –
- File ref/ yang diperbarui: –

## D-imelda-05 · 26 Sep 2026 · fase 11D1 · Lokasi skrip export & fixture: folder lane sendiri, bukan `radar/scripts/`

- Keputusan: fase file menulis output sebagai `scripts/export-replay.ts` (tersirat `radar/scripts/`, folder Lane Core menurut CLAUDE.md). Ditempatkan di `radar/packages/web/scripts/export-replay.ts` dan `radar/packages/web/fixtures/replay/export.json` supaya tetap di dalam folder lane Imelda (`radar/packages/web`).
- Alasan: `radar/scripts/*` adalah folder Lane Core (CLAUDE.md §Team & lanes); menaruh file di sana melanggar aturan "folder = lane".
- Dampak: perintah jalan sebagai `pnpm -C radar/packages/web exec tsx scripts/export-replay.ts` (bukan `pnpm -C radar export:replay`).
- File ref/ yang diperbarui: –

## D-imelda-06 · 26 Sep 2026 · fase 11D1 · Bob slice I1/I2 BELUM dikerjakan Claude Code

- Keputusan: Claude Code menyiapkan seluruh infrastruktur non-Bob fase 11D1 (fixture, `sanitize.ts`, `metrics.ts`, `chapters.ts`, `meta.ts`, `replay-player.ts`, `scripts/export-replay.ts`, 28 test hijau) lalu BERHENTI di BOB SLICE I1 (pemutar replay + `/demo`) dan I2 (landing) sesuai `plan/ref/R7-bukti-bob.md` dan golden rule PLAN.md §5.6 ("Bob slice itu nyata"). Halaman `app/page.tsx` dan `app/demo/page.tsx` TETAP versi placeholder fase 00 sampai manusia menjalankan slice ini di Bob IDE dan membalas "bob selesai".
- Alasan: I1 dan I2 adalah Bob slice wajib (bukti judging), bukan pekerjaan Claude Code langsung.
- Dampak: fase 11D1 tidak bisa ditutup (PR, gerbang UI, `/gallery`) sampai kedua slice ini selesai dan direview.
- File ref/ yang diperbarui: –
- **Superseded**: I1 dan I2 sekarang selesai (commit `2058da47`, `99d85138`; lihat `plan/log/fase-11D1.md`).

## D-imelda-07 · 26 Sep 2026 · fase 11D1 · Allowlist gitleaks untuk fixture test sensor secret

- Keputusan: `.gitleaks.toml` dapat satu `[[allowlists]]` baru (pola `regexes`, bukan `commits`, supaya tidak melonggarkan seluruh commit): string `ghp_1234567890abcdef1234567890abcdef1234` di `radar/packages/web/src/replay/sanitize.test.ts:21` — fixture sengaja dibuat mirip GitHub PAT asli buat menguji `sanitizeEvents()` (sensor secret export replay, fase 11D1), bukan kredensial nyata. CI `ci / gitleaks` di PR #11 gagal karena ini; dikonfirmasi dengan `gitleaks detect` lokal (1 leak → 0 leak setelah allowlist).
- Alasan: mengikuti pola yang sudah ada (allowlist commit vendoring Orca, D-alief-00) daripada mengubah/menghapus test yang justru sengaja menguji kasus token bocor.
- Dampak: tidak ada perubahan kode fungsional, hanya konfigurasi CI. `.gitleaks.toml` di luar folder lane manapun (root repo); dicatat di sini karena tim sepakat kontrak di `radar/packages/common`/`plan/ref` lewat Alief, tapi config CI seperti ini lebih longgar — kalau ada keberatan, revert baris `regexes` ini.
- File ref/ yang diperbarui: – (bukan `plan/ref`).

## D-imelda-08 · 26 Sep 2026 · fase 11D1 · `trailingSlash: true` supaya `/demo` bukan listing JSON

- Keputusan: `next.config.ts` memakai `trailingSlash: true` dan `SITE.demoPath` = `/demo/`. Next menulis `out/demo/index.html` di samping `public/demo/{events,meta,bob-quotes}.json`. Tanpa ini, `python http.server` dan Cloudflare Pages menyajikan directory listing folder `demo/` (bukan halaman replay).
- Alasan: e2e langkah 17 merah — `replay-play-toggle` tidak ada karena `/demo` = listing tiga file JSON.
- Dampak: URL publik jadi `/demo/` dan `/gallery/`. Fetch data tetap `/demo/events.json`.
- File ref/ yang diperbarui: –

## D-imelda-09 · 26 Sep 2026 · fase 11D1 · Landing gelap Carbon, bukan warm paper

- Keputusan: landing `/` (`radar/packages/web/app/page.tsx`) memakai token gelap `--lc-*` yang sama dengan app/replay. Gaya "warm paper" Notion (`#f6f5f4`, CTA `#0075de`) di DESIGN.md §5.11 **diganti di tempat**, bukan file DESIGN/PLAN kedua.
- Alasan: juri buka Application URL lalu `/demo` harus satu merek. Referensi produk (Amoeba) juga gelap. Split terang/gelap terasa dua situs.
- Alternatif yang ditolak: `DESIGN-v2.md` / `PLAN-v2.md` (dobel sumber kebenaran); invert Notion tanpa ganti token IBM.
- Dampak: `DESIGN.md` §0/§5.11, `UI Inspo & Design/landing-style/README.md`, `prompt_ui.md` #12, `plan/PROMPT.md` gerbang UI, `CLAUDE.md` UI gate. Isi/section landing belum diubah (coba tema dulu).
- File ref/ yang diperbarui: – (bukan `plan/ref`).

## D-imelda-10 · 26 Sep 2026 · fase 11D1 · Poles landing "ada kehidupan" (langkah 18a), bukan PLAN kedua

- Keputusan: landing `/` dapat window produk + tab klik + motion pendek + 4 mekanisme, mengikuti struktur Amoeba. **Bukan** fase baru dan **bukan** `PLAN-v2.md`. Ditulis di `plan/fase-11-terminal-dmg-replay.md` langkah **18a**, resep urutan di `UI Inspo & Design/landing-style/README.md` (Build order), kontrak visual di DESIGN.md §5.11. Kode belum disentuh sampai 18a dikerjakan.
- Alasan: tema gelap sudah oke; halaman masih poster. Tanpa checklist, poles `page.tsx` sulit ditelusur ("perubahan apa ini?").
- Alternatif yang ditolak: file `PLAN-landing.md` / `DESIGN-v2.md`; nulis langsung di `page.tsx` tanpa resep.
- Dampak: Imelda kerjakan 18a di `radar/packages/web/app/page.tsx` sesuai urutan 1→4. `/demo` tidak diubah. Angka hanya `meta.json`.
- File ref/ yang diperbarui: – (bukan `plan/ref`).


## D-imelda-11 · 26 Sep 2026 · fase 11D1 · Hero landing disederhanakan ala Amoeba

- Keputusan: layar pertama landing = satu pesan saja: nav pill mengambang (logo app + 3 link + Download), judul besar tanpa pill marigold, satu baris sub, **satu** tombol IBM Blue "Watch the live replay", caption dengan link "Download for macOS (arm64, unsigned)". Latar = siluet halftone logo app (`app/resources/icon.png` → `public/brand/bob-crew-halftone.svg` lewat `scripts/halftone-logo.py`). Semua konten lain (window produk, angka, mekanisme, near-miss, primitif, pasang) turun di bawah fold.
- Alasan: permintaan user — layar pertama terlalu penuh tulisan. Struktur Amoeba (bukan mereknya).
- Menyimpang dari DESIGN §5.11: pill marigold di hero dan tombol ghost kedua dihapus; tombol utama putih (bukan IBM Blue) atas permintaan user; nav full-width yang berubah jadi pill saat scroll; teks "Privacy & Security → Open Anyway" pindah penuh ke bagian pasang (caption hero tetap sebut arm64 + unsigned).
- File ref/ yang diperbarui: –

## D-imelda-12 · 26 Sep 2026 · fase 11D1 · `.gitleaks.toml` pakai tabel lama `[allowlist]`

- Keputusan: dua blok `[[allowlists]]` (commit vendoring Orca + fixture PAT palsu D-imelda-07) digabung jadi satu `[allowlist]` dengan `commits` + `regexes`. Arti sama: salah satu cocok → temuan diabaikan.
- Alasan: `ci / gitleaks` di PR #18 merah. `gitleaks/gitleaks-action@v2` memasang gitleaks 8.24.3, yang diam-diam mengabaikan `[[allowlists]]` level atas; gitleaks lokal 8.30.1 membacanya, jadi scan lokal hijau. `[allowlist]` dibaca kedua versi (dicek lokal: rentang PR 0 leak, commit Orca 0 leak).
- Alternatif ditolak: pin `GITLEAKS_VERSION` di `ci.yml` (file CI bersama); tulis ulang histori untuk menambah `gitleaks:allow`.
- File ref/ yang diperbarui: –

- Keputusan:
  1. **`my_tasks` tidak lagi mengirim `owner=me`.** Tabel tool R3 §7 menulis `GET /v1/tasks?owner=me&status=open`, tetapi server fase 05 menjawab 403 "Hanya task milikmu sendiri." untuk `owner` selain ID pemanggil (`packages/server/src/http/routes/tasks.ts:15`). R3 §2.4 menyebut `owner` default = pemanggil, jadi tool memanggil `GET /v1/tasks?status=open` (lolos di mock dan server). **Usulan ke Alief:** samakan baris R3 §7 dengan §2.4 (atau server menerima `me` seperti mock). Tidak ada perubahan kontrak dari lane Bob.
  2. **`mark_ai_edit` → `POST /v1/ai-edits`:** penanda `TODO(sync:alief)` diganti komentar biasa. Kode sisi Bob sudah final (R3 §2.20); route di Worker = fase 12 (BC-05, P1). Sampai itu ada, 404 hanya ditulis ke `.radar/hook.log` (fail-open, tidak memperlambat edit: panggilan paralel dengan `bob/activity`).
  3. **`spike/fake-radar/server.mjs`:** tidak lagi dipakai untuk uji; uji Bob IDE fase 10 memakai Worker asli (`wrangler dev`). File disimpan hanya untuk mereproduksi bukti fase 07/08.
  4. Log fase 10 lane Bob = `plan/log/fase-10-bob.md` (fase 10 dikerjakan semua lane; file terpisah supaya PR lane tidak bentrok).
- Temuan demo (bukan kontrak, untuk naskah PRD §15 / `docs/DEMO_SCRIPT.md`):
  - Dengan tujuan "Tambah fitur kupon diskon di checkout dan dark mode", Bob PM menaruh kupon di `coupon.ts` + `App.tsx`, **tanpa `checkout.ts`** (di toko-demo `applyCoupon` dipanggil dari `App.tsx`). Adegan blokir naskah butuh `checkout.ts` dipegang A → sebut file di tujuan (lihat LANGKAH MANUAL fase-10-bob).
  - Brief start B menyebut file yang dipegang A, jadi Bob B memilih `request_file` tanpa mencoba edit (sama dengan handoff fase 07). Kartu permintaan dan keputusan tetap muncul, tetapi notifikasi "Bob B diblokir" hanya muncul kalau Bob benar-benar mencoba edit.
  - Bob coder kadang menjawab dalam bahasa Inggris walau prompt Indonesia.
- Alasan: test integrasi `packages/mcp/test/server.int.test.ts` (RED `ffc816a3` → GREEN `7c759f72`) dan 4 sesi Bob IDE 2.2.0 melawan Worker lokal.
- Dampak: Alief (R3 §7), Imelda/semua (naskah demo), fase 12 (`/v1/ai-edits`).
- File ref/ yang diperbarui: – (usulan saja).

## D-alief-07 · 26 Sep 2026 · fase 10 · Simulator sim-3pc + fix `owner=me`, tanpa ubah kontrak

- Keputusan:
  1. **`GET /v1/tasks?owner=me` = task pemanggil** (terima usulan D-umar-04 P1; R3 §7 tabel `my_tasks` vs §2.4 default pemanggil). Tanpa perubahan `plan/ref` (perilaku sudah tersirat di §2.4).
  2. **`scripts/sim-3pc.ts`**: skenario PRD §15 tanpa Bob (3 SyncAgent asli + bundle `lock_guard` + WS mentah layer-2 + REST plan/decision/review/commit mc), metrik (p95 check < 300 ms, dual-writer 0, flagged ≥ 1), export `packages/web/public/demo/events.sim.json`. Opsi `--until/--runs/--server`; remote wajib `--allow-remote-wipe` + token env (tidak pernah argv), `GITHUB_COMMIT=false` di lokal.
  3. **Runner di `packages/sync/scripts/sim-3pc.ts` + wrapper tipis `radar/scripts/sim-3pc.ts`** (jalur spec tetap ada): symlink `wrangler` di `radar/node_modules` rusak di pnpm 12 — preseden D-alief-04 poin 9.
  4. **Lingkungan sesi ini**: runner Muse Spark (OpenCode), bukan Opus 5.5 (R6 §2); skill/agent `ecc:*` tidak ada → TDD manual + subagent `general` sebagai reviewer (4 review, HIGH diperbaiki). Authorship ikut D-alief-06 (author `aliefauzan`, tanpa trailer asisten).
  5. **Temuan `return promise` + `finally`**: `return finish()` di dalam `try` membiarkan `finally` (`harness.close()`) berpacu dengan fetch export (ECONNRESET deterministik) — wajib `return await finish()`. Berlaku untuk semua harness `createTestHarness` + cleanup `finally`.
- Alasan: fase 10 butuh bukti otomatis sebelum milestone 21:00; D-umar-04 memblokir `my_tasks` R3 §7.
- Alternatif yang ditolak: sim di `radar/scripts/` dengan `wrangler` sebagai dep root (symlink rusak); WS layer-2 lewat socket agent (menggantikan socket = `replaced`, jadi dipakai socket mentah terpisah).
- Dampak: fase 11D2 (replay cadangan), fase 12 (MEDIUM tercatat di log fase-10), milestone 21:00 (LANGKAH MANUAL di log).
- File ref/ yang diperbarui: – (tidak ada perubahan kontrak).
- Selisih vs `origin/main`: D-alief-06 (authorship) ada di worktree `lane/core` lain dan belum di-`main` saat entri ini ditulis; commit fase ini mengikutinya tanpa memodifikasi file itu.

## D-umar-05 · 26 Sep 2026 19:45 · fase 13 (persiapan) · Script eksperimen A/B di `radar/scripts`

- Keputusan:
  1. Script fase 13 ditaruh sesuai file fase: `radar/scripts/metrics.ts` dan `radar/scripts/ab/*` (bukan paket baru). CLAUDE.md mencatat `radar/scripts/*` sebagai folder server Alief; lane Bob hanya menambah file baru ini dan tidak menyentuh `admin.ts`, `mock-server.ts`, atau `mock/`.
  2. Persiapan (protokol, prompt, script + test) dikerjakan Sab 19:00–21:00 sebelum fase 10 `[x]`, atas permintaan Umar. Baris 13 di PROGRESS tetap `[ ]`; putaran eksperimen tetap di slot Min 04:30–10:30 setelah fase 10.
  3. Latensi cek kunci diambil dari `.radar/hook.log` (`lock_guard … ms=<n>`, end-to-end, sesuai PRD §04 "log waktu di hook"). Metric server `lock_check_ms` tidak ikut di export; dipakai hanya bila ada salinan baris metric.
  4. Konflik putaran B diukur dengan memutar ulang commit task yang ter-push di atas commit awal (worktree sementara), bukan diasumsikan 0. Coder putaran A tidak push: branch dikirim sebagai `git bundle`.
- Alasan: plan fase 13 (output di `scripts/`), PRD §04/§17, protokol ditulis sebelum eksperimen.
- Dampak: Alief (folder `radar/scripts`, usulan opsional: `metric` di `/admin/export`), fase 14 (tabel metrik).
- File ref/ yang diperbarui: –.
