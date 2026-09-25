# R5 — Konvensi kode, test, env, dan Definition of Done

## 1. Bahasa & gaya

| Aspek | Aturan |
|---|---|
| Bahasa | TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, target ES2022, module `NodeNext` (paket Node) / `bundler` (web) |
| Runtime | Node 20 LTS (`"engines": { "node": ">=20.10" }`), pnpm 9 |
| Modul | ESM di semua paket Node. Hook & radar-mcp dibundel esbuild ke **CJS** satu file (`format: 'cjs', platform: 'node', target: 'node20'`) supaya jalan dengan `node file.js` di mana pun |
| Penamaan | file `kebab-case.ts` (kecuali nama hook yang mengikuti PRD: `lock_guard`, `mark_ai_edit`), tipe `PascalCase`, fungsi `camelCase`, konstanta `UPPER_SNAKE` |
| Bahasa teks | Kode, identifier, komentar: Inggris. Teks yang dibaca user/Bob (brief, pesan blokir, output tool MCP, UI): **Bahasa Indonesia**, singkat |
| Lint/format | ESLint flat config (`typescript-eslint` recommended + `no-floating-promises`), Prettier (`printWidth 100`, `singleQuote`, `trailingComma all`) |
| Error | Jangan telan error diam-diam. Hook: semua error → fail-open (exit 0) + log, KECUALI keputusan `block` yang sah (exit 2). Server: error bisnis → `RadarError(code, message)` → handler error R3 §1 |
| Log | Server `pino` (JSON). Sync/hook: file `.radar/*.log` baris teks. **Tidak pernah** menulis token ke log |
| Validasi | Semua input eksternal lewat zod dari `@radar/common/schemas` |

## 2. Struktur test

| Jenis | Alat | Lokasi | Contoh |
|---|---|---|---|
| Unit | vitest | `packages/*/src/**/*.test.ts` | normalisasi payload, `checkWrite` tabel R4 §3, reducer |
| Property | fast-check | `packages/server/src/services/*.prop.test.ts` | invariant I1–I10 dengan urutan operasi acak |
| Integrasi server | vitest + `buildApp()` + SQLite `:memory:` + klien `ws` | `packages/server/test/*.int.test.ts` | dua klien WS: update → changed; blokir → rejected |
| Integrasi sync | vitest + server in-process + 2 `SyncAgent` di folder tmp | `packages/sync/test/*.int.test.ts` | A tulis → B disk < 1 s, tanpa gema |
| Hook | vitest menjalankan `node bob-kit/coder/.bob/hooks/lock_guard.js` dengan stdin | `packages/hooks/test/*.test.ts` | exit code 0/2, stderr, fail-open saat server mati |
| MCP | vitest + `Client` SDK + `InMemoryTransport` | `packages/mcp/test/*.test.ts` | daftar tool per role, output teks |
| UI | Playwright (smoke) terhadap mock server | `packages/web/e2e/*.spec.ts` | 3 kolom tampil, klik Setujui memanggil API |
| E2E | `scripts/sim-3pc.ts` | – | alur demo penuh tanpa Bob |

Aturan: test integrasi memakai port acak (`listen({ port: 0 })`) dan folder `fs.mkdtemp`. Tidak ada test yang bergantung pada jaringan luar atau GitHub asli (pakai bare repo lokal sebagai remote).

## 3. Konvensi commit

```text
<tipe>(<paket>): <ringkasan imperatif, ≤ 72 char>

<isi opsional>

Radar-Plan: fase-<XX>
```
`tipe` ∈ `feat`, `fix`, `test`, `docs`, `chore`, `refactor`. Commit penutup fase: `fase-<XX>: <judul fase>`.
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
| `MEMBER_COLORS` | A `#3B82F6`, B `#8B5CF6`, C `#F97316` | §11 prinsip UX |
| `STATUS_COLORS` | hijau `#22C55E`, kuning `#EAB308`, merah `#EF4444` | §11 |
| `EDIT_TOOLS_REGEX` | `^(write_file\|apply_diff\|search_and_replace\|insert_content)$` | BC-04 (diverifikasi spike) |

## 5. Variabel lingkungan

### Server (`packages/server`, `.env` / secret Fly)

| Var | Contoh | Wajib | Keterangan |
|---|---|---|---|
| `PORT` | `8787` | ya | |
| `DATA_DIR` | `/data` | ya | DB + clone repo; di Fly = volume |
| `WORKSPACE_ID` | `toko-demo` | ya | |
| `REPO_URL` | `https://github.com/<org>/toko-demo.git` | ya | dipakai `init` dan push |
| `GITHUB_TOKEN` | `ghp_…` | untuk push | fine-grained, hanya repo toko-demo, `contents:write` |
| `GIT_PUSH` | `true` | – | `false` saat dev/test |
| `BOB_COAUTHOR` | `IBM Bob <bob@ibm.com>` | – | trailer co-author |
| `AUTO_APPLY_QUEUE` | `true` | – | keputusan `antre` diterapkan tanpa klik (PRD §7.3) |
| `HEARTBEAT_EXPIRE_MS` | `300000` | – | turunkan ke `60000` untuk demo SV-09 |
| `CORS_ORIGIN` | `https://bob-radar.vercel.app,http://localhost:3000` | ya | |
| `PUBLIC_EXPORT` | `false` | – | izinkan `GET /v1/events/export` tanpa token |
| `LOG_LEVEL` | `info` | – | |

### Web (`packages/web`, Vercel)

| Var | Contoh | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_RADAR_SERVER` | `https://bob-radar.fly.dev` | default URL di halaman login (token MC diketik manusia, disimpan di `localStorage`) |
| `NEXT_PUBLIC_REPO_URL`, `NEXT_PUBLIC_VIDEO_URL`, `NEXT_PUBLIC_SESSIONS_URL` | … | link di replay (UI-05, PRD §7.6) |

### Klien (sync, hook, radar-mcp)

Dibaca dari `.radar/local.json` (R1 §6). Override untuk test: `RADAR_SERVER`, `RADAR_TOKEN`, `RADAR_MEMBER`, `RADAR_ROLE`, `RADAR_ROOT`.

## 6. Aturan abaikan (sync & import awal)

Selalu diabaikan: `.git/`, `node_modules/`, `.radar/`, `.bob/`, `bob_sessions/`, `.next/`, `dist/`, `build/`, `coverage/`, `.DS_Store`, `*.radar-rejected`, `*.radar-conflict`, `*.swp`, `*~`, `.#*`, file > 1 MB, file biner (ada byte NUL di 8 KB pertama). Ditambah isi `.gitignore` root workspace (paket `ignore`). Fungsi tunggal: `@radar/common/ignore.ts#createIgnoreMatcher(root)`.

## 7. Definition of Done (berlaku untuk setiap fase)

- [ ] Semua "Kriteria selesai" di file fase terpenuhi dengan bukti.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` hijau untuk paket yang disentuh.
- [ ] Tidak ada `TODO` tanpa nomor fase tujuan (`// TODO(fase-12): …`).
- [ ] Tidak ada secret di diff (`pnpm secrets:scan` bila gitleaks terpasang).
- [ ] Kontrak `ref/` sesuai kode; deviasi tercatat di `log/DECISIONS.md`.
- [ ] `log/fase-XX.md` dan `PROGRESS.md` diperbarui; requirement P0 terkait diberi bukti di tabel PROGRESS.
- [ ] Kalau fase menyentuh perilaku yang terlihat di demo: dicatat di `docs/DEMO_SCRIPT.md` apa yang berubah.
