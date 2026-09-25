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
