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
