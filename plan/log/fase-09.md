# Log fase 09 — App desktop (Lane Aarief · `lane/app`)

- **Status:** [~] berjalan (09c; 09a/09b menunggu gerbang UI dan snapshot PR).
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
- [x] 3. Alias paket UI/common di Vite renderer, Vitest, `tsconfig.web.json`, dan `tsconfig.tc.web.json`; React/React DOM/lucide di-dedupe. `pnpm -C app tc:web` hijau.
- [x] 4. Penyimpanan koneksi aman + IPC: ciphertext `userData/radar/connection.bin`, menolak OS encryption yang tidak tersedia, `get`/`set` hanya mengembalikan ringkasan tanpa token, `clear` menghapus file. Test merah sebelum implementasi, lalu 7/7 lulus.
- [x] 5. 09b: WebSocket di main (`hello` mc/app, keepalive string persis, backoff 0,5→8 s, stop pada 4401), store renderer dari snapshot/event, dan aksi MC via IPC (`decide`, `revoke`, `cancelTask`). Test merah untuk WS, endpoint, store task/kunci/proposal sebelum implementasi; 19/19 test terkait lulus.
- [x] 6. BOB SLICE C3 lewat CDP Bob IDE, commit asli `c9e33b6c` dengan `Bob-Assisted` dan `Co-authored-by: IBM Bob <bob@ibm.com>`. Bukti `bob_sessions/uaai_aarief_task03_radar_ui_components_summary.png` (2.27 Bobcoin). Dua suite test ditulis merah sebelum Bob; hasil Bob 6/6 test dan typecheck hijau. Review terpisah: ganti satu warna hex pada komponen, jangan menandai pemilik task online bila status belum diketahui, rapikan EOF.
- [x] 6a. Komponen pelengkap `ReviewCard`, `BriefMeter`, `PresenceStack` disiapkan dengan dua suite test merah dahulu, lalu 8/8 test UI dan typecheck hijau. Komponen ini mengikuti props murni dan token `--lc-*`.
- [x] 7. Seksi LIVE COLLAB disisipkan setelah header sidebar dengan Mission Control, Team, Files & locks, Settings; badge Needs you dihitung dari proposal pending. Drawer mengikuti pola Sheet Orca.
- [~] 8–9. Mission Control menampilkan task, keputusan, feed, ringkasan lock, dan notifikasi blocked/decision; Team dan Files & locks membaca state WS; Settings menyimpan koneksi melalui IPC dan status bar menampilkan ringkasan. Tombol Open in Bob IDE memakai launcher editor Orca pada worktree aktif. Test coder read-only dan keputusan MC menunggu event server lulus. Checklist Settings dan verifikasi mock masih berjalan; `radar dev:mock` saat ini hanya placeholder fase 02.
- [x] 8a. Renderer yang baru mount meminta `radar:refresh` setelah berlangganan update, agar frame `state` tidak hilang bila WS main tersambung sebelum UI siap. Handler membaca koneksi aman di main dan memulai ulang WS; token tidak dikirim ke renderer. Test IPC merah dahulu, lalu 5/5 lulus dan `app tc` hijau.
- [ ] 10–14. Branding, error/empty state lanjutan, gerbang UI, security review, snapshot PR.

## File dibuat/diubah

- `app/config/electron-builder.config.cjs`, `app/config/scripts/electron-builder-mac-channel-config.test.mjs`, `app/src/main/startup/{dev-instance-identity,configure-process}{,.test}.ts`
- `radar/docs/ORCA_MAP.html`, `radar/docs/SPIKE_RESULTS.md` (append), `bob_sessions/uaai_aarief_task01_orca_onboarding_summary.png`, `bob_sessions/index/aarief.md`
- `radar/packages/ui/src/types-temp.ts` (placeholder), `radar/docs/ORCA_MAP.md` (verifikasi C1), `app/src/shared/tui-agent-{config,selection}.test.ts` (test merah C2)
- C2 Bob: `app/src/shared/{tui-agent,tui-agent-config,tui-agent-display-names,tui-agent-selection,telemetry-property-schemas,agent-kind,skills-cli-agent-keys}.ts`, `app/src/renderer/src/lib/{agent-catalog.tsx,agent-status.ts}`, bukti dan indeks Aarief. Review sesudah commit: komentar konfigurasi diubah ke Bahasa Inggris; satu baris dukungan IBM Bob ditambah di `app/docs/site/content/docs/agents/supported.mdx`.
- 09b langkah 3: `app/electron.vite.config.ts`, `app/config/{tsconfig.web.json,tsconfig.tc.web.json,vitest.config.ts}`.
- 09b langkah 4: `app/src/shared/radar-connection.ts`, `app/src/main/radar/{secure-store,connection-ipc}{,.test}.ts`, `app/src/main/startup/main-process-ipc-bootstrap.ts`, `app/src/preload/api/radar-bridge.ts`, `app/src/preload/{api-types,index}.ts`.
- 09b langkah 5: `app/src/main/radar/{ws-client,api}{,.test}.ts`, `app/src/shared/radar-update.ts`, `app/src/renderer/src/lib/radar/state-placeholder.ts`, `app/src/renderer/src/store/radar-store{,.test}.ts`, penyesuaian IPC/preload, `radar/packages/ui/src/index.ts`, dan include TypeScript di `app/config/tsconfig*.web.json`.
- 09c langkah 6: komponen Bob `radar/packages/ui/src/{LockChip,MemberChip,WritingPulse,BobTrace,DecisionCard,TaskCard,FeedItem}.tsx`, `theme-vars.css`, `index.ts`, dua test merah, bukti PNG dan indeks Aarief. Review kecil pada `DecisionCard`, `TaskCard`, `BobTrace`.
- 09c langkah 6a: `radar/packages/ui/src/{ReviewCard,BriefMeter,PresenceStack}.tsx`, dua test dan ekspor dari `index.ts`.
- 09c tema app: blok `--lc-*` aditif di `app/src/renderer/src/assets/main.css`; nilai netral/status/font merujuk variabel Orca, nilai mentah hanya warna anggota dan kebutuhan PM.
- 09c panel: `app/src/renderer/src/components/radar/*`, sisipan `sidebar/index.tsx` dan `status-bar/StatusBarSurface.tsx`; `radar/packages/ui/src/AgentTag.tsx` dilengkapi status idle/writing/blocked dan `DecisionCard.tsx` dibersihkan dari variabel tidak terpakai.
- 09c refresh state: `app/src/main/radar/connection-ipc{,.test}.ts`, `app/src/preload/api/radar-bridge.ts`, `app/src/renderer/src/components/radar/use-radar-session.ts`.
- 09c notifikasi dan Bob IDE: `app/src/renderer/src/components/radar/{NotificationsPanel{,.test},TeamPanel,MissionControlView}.tsx`.
- `plan/PROGRESS.md` (baris 09 `[~]`)

## Placeholder aktif

- `radar/packages/ui/src/types-temp.ts` — `TODO(sync:alief)`: tipe view R3 §5/§6; status tolak diasumsikan `ditolak`.
- `app/src/renderer/src/lib/radar/state-placeholder.ts` — `TODO(sync:alief)`: adapter snapshot/event sementara sampai reducer + schemas `@radar/common` fase 02 masuk main.
- `app/src/main/radar/ws-client.ts` — `TODO(sync:alief)`: impor konstanta keepalive dari `@radar/common` setelah fase 02.

## Hasil verifikasi

- `pnpm -C app test src/main/startup/{dev-instance-identity,configure-process}.test.ts`: 52/52 lulus.
- `vitest run --config config/vitest.config.ts config/scripts/`: lulus kecuali `mobile-web-app-*-render` (butuh browser Playwright; tidak terkait).
- `pnpm -C radar --filter @radar/ui test`: 1/1; typecheck hijau.
- C2: `pnpm -C app test` untuk 4 suite registry/prompt transport: 59/59 lulus. `pnpm -C app tc`: hijau. `pnpm -C app exec oxlint` pada 11 file TS/TSX C2: bersih. `git diff --check`: bersih. `command -v bob`: tidak ditemukan; respons terminal Bob Shell belum terverifikasi.
- 09b langkah 3: `pnpm -C app tc:web` exit 0.
- 09b langkah 4: 7/7 test penyimpanan/IPC lulus; `pnpm -C app tc:node` dan `tc:web` exit 0; oxlint pada 9 file TS terkait exit 0. File hanya memuat ciphertext; tidak ada token dalam respons `get`/`set`.
- 09b langkah 5: `pnpm -C app test src/main/radar src/renderer/src/store/radar-store.test.ts` 19/19 lulus; `pnpm -C app tc` exit 0; oxlint file terkait exit 0. `tc:web` sempat TS6307 pada source paket UI, lalu hijau setelah include source workspace ditambah.
- 09c langkah 6: `pnpm -C radar --filter @radar/ui test` 6/6 lulus; `pnpm -C radar --filter @radar/ui typecheck` exit 0; Bob menyelesaikan 9 file sumber dalam batas folder yang diminta.
- 09c panel awal: `pnpm -C app tc`, test radar renderer 3/3, `pnpm -C radar --filter @radar/ui test` 9/9, typecheck UI, dan `check:code-quality:changed` tanpa temuan. `radar-view-model.test.ts` dibuat merah sebelum helper; test keputusan UI membuktikan coder read-only dan MC tidak optimistis.
- 09c notifikasi: test merah sebelum komponen; test radar renderer 4/4 dan `pnpm -C app tc` hijau. `bob --version` gagal pada Node 20 (`node:sqlite`), berhasil pada Node 24: versi 2.0.5; sesi login/terminal interaktif belum dicoba.

## Deviasi

- Model Opus 5.5 (lihat atas). Otomasi Bob memakai CDP langsung ke iframe webview karena `agent-browser` tidak bisa masuk frame (SPIKE_RESULTS).
- Batas koneksi, role, token UI, dan drawer dicatat di D-aarief-01.
- Review C2: registrasi exhaustive `Record<TuiAgent,...>` lengkap tanpa cast baru, `detectCmd`/`launchCmd`/`expectedProcess` = `bob`, glyph B generik. `stdin-after-start` menghindari argumen prompt CLI tetapi tetap mengirim followup lewat PTY bila ada; perilaku Bob Shell **BELUM DIVERIFIKASI**. Tidak ada channel IPC atau `nodeIntegration` baru. Gerbang screenshot UI dilakukan sebelum PR 09a.
- 09b: path `lib/radar/{ws-client,api}.ts` dari rencana dipindah ke main process sesuai D-aarief-01, sehingga header Bearer hanya dipasang di main. `RadarState` dari server bisa berupa array (§2.21); adapter sementara mengubahnya menjadi record. Keputusan Approve/Deny tetap menunggu `proposal.decided` dari WS; API tidak mengubah store secara optimistis.

## LANGKAH MANUAL

1. Bob Shell CLI ditemukan: versi 2.0.5 hanya berjalan dengan Node 24; Node 20 gagal `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`. Jalankan `nvm use 24` pada shell yang akan menjalankan Bob. Jangan kirim kredensial ke repo atau chat. Bob IDE tetap jalur P0; ini verifikasi P1 DA-02.
2. Jalankan `ORCA_BACKGROUND_LAUNCH=1 pnpm -C app dev`, buka UI, buat worktree, pilih **IBM Bob**, lalu cek terminal menjalankan `bob` dan menjawab "halo". Jika CLI meminta login, selesaikan sendiri di aplikasi Bob; agent tidak melakukan login atau mengetik token.
3. Balas **"manual selesai"** beserta hasil singkat (jalan/gagal dan pesan error tanpa kredensial). Gerbang screenshot UI dan uji skenario demo memerlukan mock server fase 02: saat ini `pnpm -C radar dev:mock` hanya mencetak placeholder. Setelah fase 02 masuk main, lanjutkan screenshot dan uji data live.
4. Jika ingin GitHub menampilkan akun/avatar IBM Bob sebagai co-author, konfirmasi alamat email GitHub IBM Bob untuk mengganti default `bob@ibm.com` (plan/TODO.md B6) sebelum snapshot 09a didorong. Trailer co-author sudah ada di commit C2; identitas pendorong branch tidak menentukan co-author commit.

## Catatan handoff lintas lane

- Alief (fase 02): `GET /v1/state` §2.21 berbentuk array, `RadarState` §6 berbentuk record — mohon pastikan bentuk final; status proposal ditolak belum bernama di R3 §2.14.
