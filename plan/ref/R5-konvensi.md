# R5 — Konvensi kode, test, env, dan Definition of Done

## 1. Bahasa & gaya

| Aspek | Aturan |
|---|---|
| Bahasa | TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, target ES2022, module `NodeNext` (paket Node) / `bundler` (web) |
| Runtime | **Node 24 + pnpm 12** untuk seluruh repo (`"engines": { "node": ">=24" }`, `packageManager: pnpm@12`), sama dengan `app/`. Satu-satunya pengecualian: bundle hook & radar-mcp ber-`target: 'node20'` karena dijalankan oleh Node milik Bob di PC mana pun |
| Modul | ESM di semua paket Node. Hook & radar-mcp dibundel esbuild ke **CJS** satu file (`format: 'cjs', platform: 'node', target: 'node20'`) supaya jalan dengan `node file.js` di mana pun |
| Penamaan | file `kebab-case.ts` (kecuali nama hook yang mengikuti PRD: `lock_guard`, `mark_ai_edit`), tipe `PascalCase`, fungsi `camelCase`, konstanta `UPPER_SNAKE` |
| Bahasa teks | Kode, identifier, komentar: Inggris. Teks yang dibaca user/Bob (brief, pesan blokir, output tool MCP, UI): **Bahasa Indonesia**, singkat |
| Lint/format | `radar/`: ESLint flat config (`typescript-eslint` recommended + `no-floating-promises`), Prettier (`printWidth 100`, `singleQuote`, `trailingComma all`). Kode Orca (`orca:src/**`): ikuti tooling Orca (oxlint + oxfmt), jalankan hanya pada file yang diubah, plus `pnpm -C app tc`. |
| Error | Jangan telan error diam-diam. Hook: semua error → fail-open (exit 0) + log, KECUALI keputusan `block` yang sah (exit 2). Server: error bisnis → `RadarError(code, message)` → handler error R3 §1 |
| Log | Server (Worker/DO): `console.log(JSON.stringify({...}))`, dibaca lewat `wrangler tail` (tanpa `pino`). Sync/hook: file `.radar/*.log` baris teks. **Tidak pernah** menulis token ke log |
| Validasi | Semua input eksternal lewat zod dari `@radar/common/schemas` |

## 2. Struktur test

| Jenis | Alat | Lokasi | Contoh |
|---|---|---|---|
| Unit | vitest | `packages/*/src/**/*.test.ts` | normalisasi payload, `checkWrite` tabel R4 §3, reducer |
| Property | fast-check | `packages/server/src/services/*.prop.test.ts` | invariant I1–I10 dengan urutan operasi acak |
| Integrasi server | vitest 4 + `@cloudflare/vitest-plugin` (plugin Vite `cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })`; `exports.default.fetch()` dari `cloudflare:workers`, `runInDurableObject`, `runDurableObjectAlarm`, WebSocket via `exports.default.fetch()` upgrade) — DO + SQLite asli di workerd lokal. Storage terisolasi **per file test**, bukan per test: tiap test memakai `WORKSPACE_ID`/nama DO unik atau `POST /admin/reset` | `packages/server/test/*.test.ts` | dua klien WS: update → changed; blokir → rejected |
| Integrasi sync | vitest (Node) + server lokal dari `createTestHarness` wrangler (`workers: [{ configPath: '../server/wrangler.jsonc', vars: { GITHUB_COMMIT: 'false' }, secrets: { ADMIN_SECRET: 'test' } }]`, `await server.listen()` → URL port acak, `server.reset()` = storage baru, `server.close()` di `afterAll`) + 2 `SyncAgent` di folder tmp. `unstable_startWorker` sudah deprecated, jangan dipakai. Sebelum fase 03 siap: mock server fase 02 | `packages/sync/test/*.int.test.ts` | A tulis → B disk < 1 s, tanpa gema |
| Hook | vitest menjalankan `node bob-kit/coder/.bob/hooks/lock_guard.js` dengan stdin | `packages/hooks/test/*.test.ts` | exit code 0/2, stderr, fail-open saat server mati |
| MCP | vitest + `Client` SDK + `InMemoryTransport` | `packages/mcp/test/*.test.ts` | daftar tool per role, output teks |
| UI komponen | vitest + @testing-library/react | `packages/ui/src/**/*.test.tsx` | `LockChip` gaya per status, `DecisionCard` memanggil `onApprove` |
| App (Orca) | vitest Orca (`pnpm -C .. test -- src/renderer/src/components/radar`) + uji manual | `orca:src/**/radar/**/*.test.ts(x)` | store menerapkan event, share terminal mengirim frame |
| Replay web | Playwright terhadap JSON statis | `packages/web/e2e/*.spec.ts` | autoplay, klik event → Bob inside |
| E2E | `scripts/sim-3pc.ts` | – | alur demo penuh tanpa Bob |

Aturan: test integrasi memakai port acak dan folder `fs.mkdtemp`. Tidak ada test yang bergantung pada jaringan luar atau GitHub asli: `GITHUB_COMMIT=false` mencatat commit tanpa memanggil API, dan test commit memakai `@msw/cloudflare` (`setupNetwork()` + `network.use(http.post(...))`, setup file `test/setup.ts`) untuk endpoint Git Data API. `fetchMock` dari `cloudflare:test` sudah dihapus dan `SELF` deprecated (migration guide vitest-plugin, 20 Agu 2026).

## 3. Konvensi commit

```text
<tipe>(<paket>): <ringkasan imperatif, ≤ 72 char>

<isi opsional>

Radar-Plan: fase-<XX>
```
`tipe` ∈ `feat`, `fix`, `test`, `docs`, `chore`, `refactor`. Commit penutup fase: `fase-<XX>: <judul fase>`.
Commit yang kodenya dibuat IBM Bob (Bob slice, R7) menambah trailer:

```text
Bob-Assisted: bob_sessions/<png>
```

Commit yang dibuat **server Radar** di repo toko-demo punya format sendiri (fase 06):

```text
T-1: Kupon diskon

<ringkasan submit_task>

Radar-Task: T-1
Reviewed-by: Citra (PM) <citra@example.com>
Co-authored-by: IBM Bob <bob@ibm.com>
```
(Alamat email co-author IBM Bob dikonfirmasi saat kickoff; nilainya diambil dari env `BOB_COAUTHOR`.)

## 4. Konstanta (`@radar/common/constants.ts`)

| Nama | Nilai | Sumber PRD |
|---|---|---|
| `SYNC_DEBOUNCE_MS` | 150 | §8.3 |
| `MAX_FILE_BYTES` | 1_048_576 | §8.3 |
| `HEARTBEAT_INTERVAL_MS` | 15_000 | §06 aturan 7 |
| `HEARTBEAT_EXPIRE_MS` | 300_000 | §06 aturan 7 |
| `HOOK_SERVER_TIMEOUT_MS` | 1_500 | §06 tabel hook |
| `HOOK_TOTAL_TIMEOUT_S` | 3 (PreToolUse), 5 (brief) | §13 settings.json |
| `WRITING_INDICATOR_MS` | 3_000 | UI-02 |
| `BRIEF_MAX_LINES` | 6 | NFR-06 |
| `BRIEF_MAX_LINE_CHARS` | 160 | NFR-06 |
| `WS_HELLO_TIMEOUT_MS` | 5_000 | – |
| `WS_PING_MS` | 20_000 | – |
| `WS_PING_FRAME` / `WS_PONG_FRAME` | `'{"t":"ping"}'` / `'{"t":"pong"}'` | R3 §3: string persis untuk `setWebSocketAutoResponse`; jangan dibentuk ulang lewat `JSON.stringify` objek lain |
| `MEMBER_COLORS` | A `#78A9FF`, B `#BE95FF`, C `#FF832B` (Carbon 40) | DESIGN.md §2.1 |
| `STATUS_COLORS` | hijau `#42BE65`, kuning `#F1C21B`, merah `#FA4D56` | DESIGN.md §2.1 |
| `TERM_FRAME_MAX_BYTES` | 32_768 | R3 §3.9 |
| `TERM_RING_BYTES` | 262_144 | JT-03 |
| `TERM_GUEST_MAX_MS` | 600_000 | JT-04 |
| `EDIT_TOOLS_REGEX` | `^(write_file\|apply_diff\|search_and_replace\|insert_content\|office_edit)$` | BC-04. Empat nama pertama sesuai docs tools Bob IDE; `office_edit` ada sejak Bob IDE 2.1.0. **Provisional** sampai spike 1; ubah hanya di jendela kontrak fase 02 (04:00–04:30) |

## 5. Variabel lingkungan

### Server (`packages/server`: `vars` di `wrangler.jsonc`, secret lewat `wrangler secret put`, lokal di `.dev.vars` yang di-ignore)

| Var | Contoh | Wajib | Keterangan |
|---|---|---|---|
| `ADMIN_SECRET` | (secret) | ya | melindungi `/admin/*` (init, rotate token, reset) |
| `WORKSPACE_ID` | `toko-demo` | ya | |
| `GITHUB_REPO` | `<owner>/toko-demo` | ya | dipakai `init` (baca tree) dan commit lewat GitHub API |
| `GITHUB_TOKEN` | (secret) | untuk commit | fine-grained, hanya repo toko-demo, Contents read & write. Tanpa izin Workflows: menulis `.github/workflows/*` lewat API butuh izin itu, jadi folder tersebut masuk daftar abaikan §6 dan tidak pernah ikut commit |
| `GITHUB_COMMIT` | `true` | – | `false` saat dev/test (commit dicatat tanpa memanggil GitHub) |
| `RECORD_TERMINALS` | `false` | – | `true` saat merekam demo (frame disimpan untuk replay) |
| `BOB_COAUTHOR` | `IBM Bob <bob@ibm.com>` | – | trailer co-author |
| `AUTO_APPLY_QUEUE` | `true` | – | keputusan `antre` diterapkan tanpa klik (PRD §7.3) |
| `HEARTBEAT_EXPIRE_MS` | `300000` | – | turunkan ke `60000` untuk demo SV-09 |
| `CORS_ORIGIN` | `https://ibm-bob-live-collab.pages.dev,http://localhost:3000` | ya | |
| `PUBLIC_EXPORT` | `false` | – | izinkan `GET /v1/events/export` tanpa token |
| `LOG_LEVEL` | `info` | – | log Worker terlihat di `wrangler tail` |

### Web (`packages/web`, Cloudflare Pages, Next.js `output: 'export'`)

| Var | Contoh | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_RADAR_SERVER` | `https://live-collab.<akun>.workers.dev` | default URL di halaman login (token MC diketik manusia, disimpan di `localStorage`) |
| `NEXT_PUBLIC_REPO_URL`, `NEXT_PUBLIC_VIDEO_URL`, `NEXT_PUBLIC_SESSIONS_URL` | … | link di replay (UI-05, PRD §7.6) |

### Klien (sync, hook, radar-mcp)

Dibaca dari `.radar/local.json` (R1 §6). Override untuk test: `RADAR_SERVER`, `RADAR_TOKEN`, `RADAR_MEMBER`, `RADAR_ROLE`, `RADAR_ROOT`.

## 6. Aturan abaikan (sync & import awal)

Selalu diabaikan: `.git/`, `.github/workflows/`, `node_modules/`, `.radar/`, `.bob/`, `bob_sessions/`, `.next/`, `dist/`, `build/`, `coverage/`, `.DS_Store`, `*.radar-rejected`, `*.radar-conflict`, `*.swp`, `*~`, `.#*`, file > 1 MB, file biner (ada byte NUL di 8 KB pertama). Ditambah isi `.gitignore` root workspace (paket `ignore`). Fungsi tunggal: `@radar/common/ignore.ts#createIgnoreMatcher(root)`.

## 7. Definition of Done (berlaku untuk setiap fase)

- [ ] Semua "Kriteria selesai" di file fase terpenuhi dengan bukti.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` hijau untuk paket yang disentuh.
- [ ] Tidak ada `TODO` tanpa nomor fase tujuan (`// TODO(fase-12): …`). Placeholder yang menunggu lane lain memakai `// TODO(sync:<lane>): … — ganti setelah <fase/PR>` dan harus habis sebelum fase 10.
- [ ] Tidak ada secret di diff (`pnpm secrets:scan` bila gitleaks terpasang).
- [ ] Kontrak `ref/` sesuai kode; deviasi tercatat di `log/DECISIONS.md`.
- [ ] `log/fase-XX.md` dan `PROGRESS.md` diperbarui; requirement P0 terkait diberi bukti di tabel PROGRESS.
- [ ] Kalau fase menyentuh perilaku yang terlihat di demo: dicatat di `docs/DEMO_SCRIPT.md` apa yang berubah.

## 8. Nama file terlarang & template IBM (NFR-11)

`.gitignore` dari [ibm-hackathon-template](https://github.com/watsonxhackathon/ibm-hackathon-template) digabung ke `.gitignore` Orca di fase 00. Pola template **mengabaikan** file baru yang namanya cocok dengan:

`*token*` · `*secret*` · `*password*` · `*credentials*` · `*apikey*` · `*api-key*` · `*api_key*` · `config.json` · `config.yaml` · `config.yml` · `secrets.*` · `database.yml` · `database.json` · `db-config.*` · `*.pem` · `*.key` · `*.crt` · `.vscode/` · `.idea/`

Akibatnya file seperti `access-token.ts` atau `config.json` **tidak akan ter-commit tanpa peringatan**. Aturannya:
1. Jangan membuat file sumber dengan nama di atas. Contoh padanan: `token.ts` → `access.ts`, `secret-store.ts` → `secure-store.ts`, `config.json` → `radar.settings.json`, **`tokens.css` → `theme-vars.css`** (kata "design tokens" juga kena pola `*token*`).
2. `scripts/check-ignored.sh` (fase 00, dijalankan di CI dan `verification-loop`) mencari file sumber yang di-ignore: `git ls-files --others --ignored --exclude-standard -- radar app/src | grep -vE '(node_modules|dist|\.next|out|\.data|\.radar)/'`. Kalau ada hasil, CI gagal.
3. `.bobignore` template membuat Bob tidak membaca file yang cocok dengan `*config.json`, `*token*`, `*secret*`, dan sejenisnya (termasuk `tsconfig.json`). Prompt Bob slice tidak boleh bergantung ke file itu. Jangan menghapus pola template.
