# Log fase 09 — App desktop (Lane Aarief · `lane/app`)

- **Status:** [~] berjalan (09a).
- **Mulai:** Sab 26 Sep 2026 00:12 WITA · branch `lane/app` (dibuat dari `origin/main` `ed1f2951`, tanpa upstream).
- **Model:** Claude Opus 5.5 · high (R6 §2 menyarankan Sonnet 5 high; Opus diizinkan untuk titik sambung Orca).

## HANDOFF (baca ini dulu kalau melanjutkan di sesi/agent lain, mis. Codex)

Aturan yang tetap berlaku: `CLAUDE.md`, `plan/PROMPT.md` (LANE Aarief, FASE auto), `plan/fase-09-app-desktop.md`, kontrak `plan/ref/R1–R7`, D-007 + D-alief-01 di `plan/log/DECISIONS.md`. Hanya boleh mengubah `app/**`, `radar/packages/ui`, plus output yang disebut fase 09 (`radar/docs/ORCA_MAP.*`, `bob_sessions/*aarief*`). Toolchain: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24`. Commit kecil per langkah. Jangan force-push main; jangan sentuh folder lane lain.

**Langkah berikutnya (urut):**
1. Tulis `radar/docs/ORCA_MAP.md`: ringkasan `radar/docs/ORCA_MAP.html` (hasil Bob C1, jangan diubah) + tabel koreksi path:baris. Klaim Bob yang sudah diketahui keliru: baris "PTY output → xterm" di `runtime-terminal-inspection.ts:251` sebenarnya jalur *input* (`window.api.pty.write`). Verifikasi setiap path:baris dengan `grep -n`.
2. BOB SLICE C2 (P1, Bob mode **Agent**, bukan Ask): tulis test merah dulu (kasus `bob` di `app/src/shared/tui-agent-config.test.ts` dll.), lalu kirim prompt fase 09 langkah 2 ke Bob IDE, bukti `radar/scripts/bob-evidence.sh aarief 02 register_bob_agent`, commit hasil Bob apa adanya dengan trailer `Bob-Assisted: bob_sessions/<png>`. Daftar file: `grep -rlw kiro app/src | grep -v .test.` (11 file; `agent-favicon-assets.ts` boleh dilewati, glyph pakai `AgentLetterIcon`). `promptInjectionMode` = paling konservatif, tandai "BELUM DIVERIFIKASI". `pnpm -C app tc` harus hijau.
3. 09b: alias Vite/tsconfig/vitest ke `radar/packages/{common,ui}/src` (`app/electron.vite.config.ts`, `app/config/tsconfig.web.json`, `app/config/vitest.config.ts`, dedupe react/lucide) → secure-store + IPC → ws-client + store + api (lihat keputusan di bawah).
4. 09c: BOB SLICE C3 (`@radar/ui` komponen), lalu panel sidebar/Mission Control/Team/Files/Settings/status bar, gerbang UI, review, PR `lane/app-f09a|b|c` (PROMPT langkah 11).

**Keputusan yang sudah diambil (tulis ke DECISIONS sebagai D-aarief-01 saat commit berikutnya):**
- Role di Settings = `coder | mc` (R3 §1/§2.14: hanya token `mc` boleh decision; fase 09 langkah 5 menulis `pm`).
- Token hanya di main process: WS client + REST (`decide`/`revoke`/`cancel`) berjalan di main (`app/src/main/radar/`; Electron 43 = Node 24, `WebSocket` global). Renderer menerima `state`/`event` lewat IPC. Menyimpang dari path `lib/radar/ws-client.ts` di file fase, demi DoD "token tidak di renderer".
- `theme-vars.css` fase 00 memakai `--lc-member-*`/`--lc-status-*`; DESIGN memakai `--lc-person-a/b/c` + `--lc-needs-you`; tambah `--lc-person-d` (#08BDBA, R5 §4).
- Mission Control dibuka dengan pola drawer/sheet seperti Agent Dashboard (bukan tab content type baru).

**Otomasi Bob IDE (terbukti, detail di `radar/docs/SPIKE_RESULTS.md` bagian "Bob IDE UI automation via CDP"):** Bob IDE jalan dengan `--remote-debugging-port=9223` pada folder `app/`. Chat ada di iframe `vscode-webview://`; pakai `Runtime.evaluate` ke target iframe (helper ±30 baris Node 24; tidak ikut repo, buat ulang bila perlu).

## Ringkasan planner (`ecc:planner`)

1. 09a: identitas app → C1 (verifikasi) → C2 dengan test registry agent dulu.
2. 09b: alias (juga `config/vitest.config.ts`, dedupe React) → secure-store (pola `minimax-cookie-store`) → ws-client (fake WebSocket + fake timers) → store + api.
3. 09c: placeholder tipe + fixture dulu → C3 → sisa komponen TDD → views smoke test → screenshot + `better-interface` → security review → PR.
4. Konflik: role `pm` vs `mc`; token di renderer; bentuk `state` (array §2.21 vs record §6) perlu adapter; nama `--lc-*`; lucide beda versi (`^1.48` ui vs `^0.577` app); output `docs/` di luar folder lane.
5. Test renderer Orca butuh komentar `// @vitest-environment happy-dom`.

## Checklist langkah

- [x] 0. Identitas app terpisah dari Orca asli — commit `fe2de749`. `appId` `dev.livecollab.app`, `productName`/nama runtime `IBM Bob Live Collab`, userData dev `IBM Bob Live Collab Dev` (juga memisahkan item Keychain safeStorage). TDD: 6 test merah → hijau.
- [x] 1. BOB SLICE C1 (Ask mode, otomatis penuh via CDP, 00:25–00:27) — commit `41154319`, bukti `bob_sessions/uaai_aarief_task01_orca_onboarding_summary.png` (0.709 Bobcoin, konteks 22.3k). Laporan `radar/docs/ORCA_MAP.html`; path:baris diverifikasi di `radar/docs/ORCA_MAP.md`. Koreksi: `runtime-terminal-inspection.ts:251` adalah input PTY, union tab ada di `shared/tab-types.ts:20`, filter sidebar ada di menu workspace, dan `extraResources` berada di blok per platform.
- [x] 2. BOB SLICE C2 (P1) — Agent mode via CDP, commit Bob asli `b8406f70` dengan trailer `Bob-Assisted` dan `Co-authored-by: IBM Bob <bob@ibm.com>` (default R5 §3; verifikasi email GitHub masih TODO B6), serta bukti `bob_sessions/uaai_aarief_task02_register_bob_agent_summary.png`. Test registry merah (1 gagal/11) sebelum Bob, lalu 59/59 test terkait lulus; `pnpm -C app tc` hijau. Uji interaktif `bob` masih LANGKAH MANUAL karena CLI belum terpasang pada PATH.
- [ ] 3–5. 09b.
- [ ] 6–14. 09c.

## File dibuat/diubah

- `app/config/electron-builder.config.cjs`, `app/config/scripts/electron-builder-mac-channel-config.test.mjs`, `app/src/main/startup/{dev-instance-identity,configure-process}{,.test}.ts`
- `radar/docs/ORCA_MAP.html`, `radar/docs/SPIKE_RESULTS.md` (append), `bob_sessions/uaai_aarief_task01_orca_onboarding_summary.png`, `bob_sessions/index/aarief.md`
- `radar/packages/ui/src/types-temp.ts` (placeholder), `radar/docs/ORCA_MAP.md` (verifikasi C1), `app/src/shared/tui-agent-{config,selection}.test.ts` (test merah C2)
- C2 Bob: `app/src/shared/{tui-agent,tui-agent-config,tui-agent-display-names,tui-agent-selection,telemetry-property-schemas,agent-kind,skills-cli-agent-keys}.ts`, `app/src/renderer/src/lib/{agent-catalog.tsx,agent-status.ts}`, bukti dan indeks Aarief. Review sesudah commit: komentar konfigurasi diubah ke Bahasa Inggris; satu baris dukungan IBM Bob ditambah di `app/docs/site/content/docs/agents/supported.mdx`.
- `plan/PROGRESS.md` (baris 09 `[~]`)

## Placeholder aktif

- `radar/packages/ui/src/types-temp.ts` — `TODO(sync:alief)`: tipe view R3 §5/§6; status tolak diasumsikan `ditolak`.

## Hasil verifikasi

- `pnpm -C app test src/main/startup/{dev-instance-identity,configure-process}.test.ts`: 52/52 lulus.
- `vitest run --config config/vitest.config.ts config/scripts/`: lulus kecuali `mobile-web-app-*-render` (butuh browser Playwright; tidak terkait).
- `pnpm -C radar --filter @radar/ui test`: 1/1; typecheck hijau.
- C2: `pnpm -C app test` untuk 4 suite registry/prompt transport: 59/59 lulus. `pnpm -C app tc`: hijau. `pnpm -C app exec oxlint` pada 11 file TS/TSX C2: bersih. `git diff --check`: bersih. `command -v bob`: tidak ditemukan; respons terminal Bob Shell belum terverifikasi.

## Deviasi

- Model Opus 5.5 (lihat atas). Otomasi Bob memakai CDP langsung ke iframe webview karena `agent-browser` tidak bisa masuk frame (SPIKE_RESULTS).
- Batas koneksi, role, token UI, dan drawer dicatat di D-aarief-01.
- Review C2: registrasi exhaustive `Record<TuiAgent,...>` lengkap tanpa cast baru, `detectCmd`/`launchCmd`/`expectedProcess` = `bob`, glyph B generik. `stdin-after-start` menghindari argumen prompt CLI tetapi tetap mengirim followup lewat PTY bila ada; perilaku Bob Shell **BELUM DIVERIFIKASI**. Tidak ada channel IPC atau `nodeIntegration` baru. Gerbang screenshot UI dilakukan sebelum PR 09a.

## LANGKAH MANUAL

1. Pasang/aktifkan Bob Shell CLI `bob` di PATH Mac ini secara mandiri; jangan kirim kredensial ke repo atau chat. Bob IDE tetap jalur P0, sehingga ini hanya verifikasi P1 DA-02.
2. Jalankan `pnpm -C app dev` dengan `ORCA_BACKGROUND_LAUNCH=1`, buka UI secara manual, buat worktree, pilih **IBM Bob**, lalu cek terminal menjalankan `bob` dan jawab "halo". Jika CLI meminta login, selesaikan sendiri di aplikasi Bob.
3. Balas **"manual selesai"** beserta hasil singkat (jalan/gagal dan pesan error tanpa kredensial). Setelah itu lanjutkan 09a (screenshot gerbang UI dan tombol Open in Bob IDE), lalu 09b.

## Catatan handoff lintas lane

- Alief (fase 02): `GET /v1/state` §2.21 berbentuk array, `RadarState` §6 berbentuk record — mohon pastikan bentuk final; status proposal ditolak belum bernama di R3 §2.14.
