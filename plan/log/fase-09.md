# Log fase 09 — App desktop (Lane Aarief · `lane/app`)

- **Status:** [~] berjalan (gerbang UI + security lulus 26 Sep 11:05; menunggu uji koneksi live oleh pengguna, lalu snapshot PR 09a/b/c).
- **Mulai:** Sab 26 Sep 2026 00:12 WITA · branch `lane/app` (dibuat dari `origin/main` `ed1f2951`, tanpa upstream).
- **Model:** Claude Opus 5.5 · high (R6 §2 menyarankan Sonnet 5 high; Opus diizinkan untuk titik sambung Orca).

## HANDOFF (baca ini dulu kalau melanjutkan di sesi/agent lain, mis. Codex)

Aturan yang tetap berlaku: `CLAUDE.md`, `plan/PROMPT.md` (LANE Aarief, FASE auto), `plan/fase-09-app-desktop.md`, kontrak `plan/ref/R1–R7`, D-007 + D-alief-01 di `plan/log/DECISIONS.md`. Hanya boleh mengubah `app/**`, `radar/packages/ui`, plus output yang disebut fase 09 (`radar/docs/ORCA_MAP.*`, `bob_sessions/*aarief*`). Toolchain: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24`. Commit kecil per langkah. Jangan force-push main; jangan sentuh folder lane lain.

**Langkah berikutnya (urut):**
1. DA-02 P1 terverifikasi: menu New tab menampilkan **IBM Bob** dengan glyph B; pemilihan dari UI membuka Terminal 2 dan Bob Shell 2.0.5 otomatis. Pesan `halo` dijawab normal dengan tim `ibm-coding-challenge-uat`. Screenshot lokal `/tmp/bob_app_picker_response.png` (tidak di-commit karena menampilkan identitas akun).
2. PR Core #4 sudah di-merge ke `main` sebagai `8dd22e1c`; `lane/app` direbase ke commit itu. Placeholder tipe, reducer, dan keepalive telah diganti dengan `@radar/common`. Mock server `/healthz` hidup. Snapshot demo 61 event diuji tanpa token melalui CDP; Mission Control merender 3 task, 7 lock, dan feed. Uji WebSocket/Approve langsung di UI masih LANGKAH MANUAL karena memerlukan token; agent dilarang mengetik token.
3. **Selesai 26 Sep 10:35–11:05:** checklist Settings (`c86c479b`, `cbbfd4d4`), gerbang UI `better-interface` lengkap (tabel di "Hasil verifikasi"), lint drawer (`aa625358`), kartu keputusan read-only untuk coder (`13f4c917`), security review PASS. Sisa gerbang: uji koneksi WS live + klik Approve/Deny oleh pengguna (LANGKAH MANUAL 2), lalu screenshot `radar/docs/img/app-*.png` saat status Live.
3a. Agent paralel (worktree terpisah, belum di-merge ke `lane/app`): fase 11a bagian A (WatchBobView, tombol Watch, toggle Share my prompts) dan fase 11b (build `.dmg` lokal tanpa signing). Hasilnya di-cherry-pick setelah direview.
4. Setelah gerbang UI lulus, buat snapshot lokal `snap/app-f09a|b|c`, dorong `lane/app-f09a|b|c`, lalu PR sesuai PROMPT langkah 11. Jangan push branch app sebelum review dan prasyaratnya selesai. Commit Bob C2/C3 sudah memiliki `Co-authored-by: IBM Bob <bob@ibm.com>`; email GitHub Bob masih perlu konfirmasi bila avatar coauthor diinginkan.

**Keputusan yang sudah diambil (tulis ke DECISIONS sebagai D-aarief-01 saat commit berikutnya):**
- Role di Settings = `coder | mc` (R3 §1/§2.14: hanya token `mc` boleh decision; fase 09 langkah 5 menulis `pm`).
- Token hanya di main process: WS client + REST (`decide`/`revoke`/`cancel`) berjalan di main (`app/src/main/radar/`; Electron 43 = Node 24, `WebSocket` global). Renderer menerima `state`/`event` lewat IPC. Menyimpang dari path `lib/radar/ws-client.ts` di file fase, demi DoD "token tidak di renderer".
- `theme-vars.css` fase 00 memakai `--lc-member-*`/`--lc-status-*`; DESIGN memakai `--lc-person-a/b/c` + `--lc-needs-you`; tambah `--lc-person-d` (#08BDBA, R5 §4).
- Mission Control dibuka dengan pola drawer/sheet seperti Agent Dashboard (bukan tab content type baru).

**Otomasi Bob IDE:** Bob IDE berjalan dengan `--remote-debugging-port=9223` pada folder `app/`. Target chat ada pada iframe `vscode-webview://`; daftar target melalui `http://127.0.0.1:9223/json`, hubungkan WebSocket debugger target iframe, lalu pakai CDP `Runtime.evaluate` untuk input/click. Bukti slice ada di `bob_sessions/*aarief*`; helper lokal sementara tidak di-commit.

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
- [~] 8–9. Mission Control menampilkan task, keputusan, feed, ringkasan lock, dan notifikasi blocked/decision; Team dan Files & locks membaca state WS; Settings menyimpan koneksi melalui IPC dan status bar menampilkan ringkasan. Tombol Open in Bob IDE memakai launcher editor Orca pada worktree aktif. Test coder read-only dan keputusan MC menunggu event server lulus. Checklist Settings selesai (`c86c479b`, `cbbfd4d4`): tombol Test menjalankan IPC `radar:checks` di main (versi Bob Shell lewat launcher Node 24 + `runProcess`, keberadaan `.bob/settings.json` di workspace aktif) dan status WebSocket. Coder melihat kartu keputusan tanpa tombol (`13f4c917`). Verifikasi koneksi UI dengan token tetap LANGKAH MANUAL 2.
- [x] 8a. Renderer yang baru mount meminta `radar:refresh` setelah berlangganan update, agar frame `state` tidak hilang bila WS main tersambung sebelum UI siap. Handler membaca koneksi aman di main dan memulai ulang WS; token tidak dikirim ke renderer. Test IPC merah dahulu, lalu 5/5 lulus dan `app tc` hijau.
- [x] 8b. Perbaikan startup dari uji manual: `app/vite.web.config.ts` belum memiliki alias `@radar/ui`/`@radar/common`, walau config Electron/Vitest sudah. `pnpm -C app build:web` gagal persis seperti laporan user sebelum patch, lalu hijau setelah alias dan dedupe React/lucide ditambah. `ORCA_BACKGROUND_LAUNCH=1 pnpm -C app dev` mencapai `starting electron app` + CDP 9339; proses dihentikan setelah verifikasi startup.
- [x] 10. Branding utama — commit `d10f10d7`: nama bundle dev/menu, titlebar, judul web, landing, pilihan ikon default, serta aset ikon macOS/Windows memakai IBM Bob Live Collab dan gambar tiga Bob dari pengguna. Test komponen/ikon/identitas dibuat merah sebelum implementasi. App Electron lokal berhasil dibuka; screenshot landing melalui CDP 9339 diperiksa secara visual.
- [x] 11. Kondisi kosong/error: belum konek → kartu "Connect to a Live Collab workspace" + tombol Open settings; server putus → badge merah "Disconnected", state terakhir tetap tampil (store hanya mengubah `connected`). Uji tanpa token melawan mock asli: kredensial sintetis salah → mock menutup 4401 → client membuka tepat 1 socket (tanpa reconnect) dan status akhir `connected:false` (probe sementara, dihapus setelah lulus).
- [x] 12–13. Gerbang UI `better-interface` + security review PASS (lihat "Hasil verifikasi").
- [~] 14. Snapshot PR menunggu uji koneksi live (LANGKAH MANUAL 2). Branding About selesai. Mock server fase 02 sudah tersedia; respons interaktif Bob Shell berhasil dengan tim challenge.
- [x] Sinkron fase 02: PR #4 diperiksa (CI hijau, mergeable, review kontrak) lalu squash-merge ke `main` sebagai `8dd22e1c`. `lane/app` direbase ke `origin/main` tanpa menyentuh folder lane lain. Test merah membuktikan snapshot array dan event resmi belum ditangani, kemudian `@radar/common` dipakai untuk tipe/reducer/keepalive. Test merah kedua menangkap duplikasi jam feed lalu diperbaiki. About menambah kredit Orca setelah test merah.

## File dibuat/diubah

- `app/config/electron-builder.config.cjs`, `app/config/scripts/electron-builder-mac-channel-config.test.mjs`, `app/src/main/startup/{dev-instance-identity,configure-process}{,.test}.ts`
- `radar/docs/ORCA_MAP.html`, `bob_sessions/uaai_aarief_task01_orca_onboarding_summary.png`, `bob_sessions/index/aarief.md`
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
- 09c startup: `app/vite.web.config.ts` (alias untuk build pairing web).
- 09c notifikasi dan Bob IDE: `app/src/renderer/src/components/radar/{NotificationsPanel{,.test},TeamPanel,MissionControlView}.tsx`.
- 09c branding: `app/resources/app-icons/bob-live-collab.png` (cutout transparan dari gambar pengguna), `app/resources/{icon.png,build/icon.png,build/icon.icns,build/icon.ico}`, `app/src/renderer/src/components/radar/LiveCollabMark{,.test}.tsx`, landing/titlebar/judul HTML, dan identitas bundle dev. Aset sumber diunduh pengguna; tidak menyertakan data pribadi.
- 09c Bob Shell: `app/src/shared/tui-agent-config{,.test}.ts` — launcher macOS memakai `nvm exec 24 bob` bila nvm tersedia; Linux tetap `bob`.
- Sinkron fase 02: `radar/packages/ui/src/types.ts` menggantikan `types-temp.ts`; `app/src/renderer/src/lib/radar/state-adapter.ts` menggantikan `state-placeholder.ts`; alias main Vite/TS, test dan view terkait diperbarui. `app/src/main/menu/gpu-acceleration-about-panel{,.test}.ts` menambah kredit asal Orca.
- `plan/PROGRESS.md` (baris 09 `[~]`)

## Placeholder aktif

Tidak ada `TODO(sync:alief)` tersisa di `app/**` atau `radar/packages/ui`.

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
- 09c branding dan Bob Shell: test merah lebih dahulu untuk gambar landing serta ikon app; 21/21 test terarah hijau, `pnpm -C app tc`, `pnpm -C app build:web`, dan `check:code-quality:changed` lulus. Perintah launcher macOS diuji tanpa login: `sh -c '...' bob --version` menampilkan Node v24.21.0 dan Bob 2.0.5. `pnpm -C app dev` berhasil membuka Electron dengan nama bundle `IBM Bob Live Collab Dev`; `CFBundleDisplayName` diperiksa lewat `plutil`.
- Uji interaktif Bob Shell melalui terminal Electron/CDP 9339: `. "$HOME/.nvm/nvm.sh" && nvm exec 24 bob` berjalan, menampilkan `Running node v24.21.0` dan Bob Shell 2.0.5. Prompt kepercayaan hanya untuk folder uji `IBM Bob Live Collab Test` dipilih; tahap berikutnya menampilkan `Complete sign-in in your browser`. Tidak ada login/token yang dimasukkan agent. Screenshot uji disimpan lokal sementara, tidak di-commit.
- Tangkapan layar pengguna setelah login browser memperlihatkan `IBM License Agreement` dengan pilihan membuka dokumen memakai Enter dan menerima/menolak memakai `y`/`n`. Penerimaan lisensi menjadi langkah manual pengguna; agent tidak memilih atas nama pengguna.
- Sesudah pengguna menyelesaikan lisensi, Bob Shell menampilkan composer siap pakai. Uji pesan `halo` lewat terminal Electron/CDP diterima oleh UI, lalu layanan Bob mengembalikan `TrialExpiredError` dengan keterangan masa free trial berakhir dan meminta upgrade paket. Ini batas akun eksternal, bukan kegagalan launcher/Node/app. Agent tidak mengubah akun, login, atau langganan. Tidak ada respons Bob terhadap `halo`; verifikasi P1 DA-02 tetap tertunda.
- Uji lanjutan 26 Sep 2026: Bob IDE menunjukkan tim aktif `ibm-coding-challenge-uat`. Picker `/team` Bob Shell menunjukkan `bob-001` sebagai tim trial yang aktif dan `ibm-coding-challenge-uat` sebagai tim enterprise. Tim enterprise dipilih dengan ArrowDown + Enter lewat CDP 9339; picker dibuka ulang dan menandai tim challenge aktif. Pesan `halo` berikutnya dijawab Bob Shell: “Halo! Ada yang bisa saya bantu?”. Tidak ada login, token, atau perubahan langganan oleh agent. Respons Shell terverifikasi; pemilihan agent dari UI masih perlu diuji untuk DoD DA-02.
- Uji DA-02 dari UI app: klik New tab → menu menampilkan `B IBM Bob` → klik pilihan itu. Terminal 2 terbuka otomatis pada workspace uji, Bob Shell 2.0.5 siap tanpa galat Node atau login tambahan, dan `halo` dibalas “Halo! Ada yang bisa saya bantu?”. Screenshot `/tmp/bob_app_picker_response.png` disimpan lokal saja karena memuat identitas akun. DoD P1 DA-02 lulus.
- Sinkron fase 02: `pnpm -C app tc`, build Electron dan web, 15/15 test radar, 9/9 test `@radar/ui`, 12/12 test About, serta `pnpm -C radar check:ignored` lulus pada Node 24. Warning ukuran chunk/CSS dari build tetap nonblocking. `pnpm -C radar dev:mock` mengembalikan `/healthz` OK. Snapshot demo tanpa token (3 anggota, 3 task, 7 lock, 61 event) disuntikkan hanya ke store renderer melalui CDP 9339; screenshot `/tmp/radar_mock_mission_control.png` menunjukkan task/keputusan/feed tanpa temuan visual HIGH. Koneksi WS asli dan keputusan MC dari UI belum diuji karena larangan agent mengetik token.

### Review visual branding (screenshot lokal, tidak di-commit)

| Tampilan | Temuan | Tingkat | Tindakan |
|---|---|---|---|
| Landing Electron 1970×1280 via CDP 9339 | Tiga Bob tampak utuh dan kontras pada latar gelap; judul dan tombol tidak bertabrakan. | Tidak ada HIGH | Lulus pemeriksaan visual; gambar kerja lokal di `/tmp/bob-live-collab-landing.png`. |
| Titlebar/workspace | Nama IBM Bob Live Collab tampil; workspace lama tetap dapat dibuka. | Tidak ada HIGH | Lulus pemeriksaan visual. |

Skill `better-interface` tidak tersedia pada sesi ini; inspeksi visual langsung dipakai sebagai padanan untuk perubahan branding.

### Gerbang UI `better-interface` — Settings + Mission Control (26 Sep, Claude Code)

Scope: `RadarSettingsPane`, `RadarPanel`, drawer di `sidebar/index.tsx`, `MissionControlView` + `ReviewCard`/`DecisionCard`. Dokumen yang dibaca: `app/AGENTS.md`, `app/docs/STYLEGUIDE.md`, DESIGN.md. Semua 6 domain skill dimuat (accessibility, layout, writing, typography, colors, ui). Screenshot via Playwright CDP 9339 (light 2000×1317 dan dark 1512×982), lokal saja.

| Severity | Domain | Location | Before | After | Status |
|---|---|---|---|---|---|
| HIGH | Writing | `RadarSettingsPane.tsx` catch `runChecks`/`disconnect` | "Checks could not run." / "Could not remove the connection." | "Unable to run checks. Try again." / "Unable to forget the connection. Try again." | Fixed `cbbfd4d4` |
| HIGH | Accessibility | `RadarSettingsPane.tsx` tombol Forget | Tombol hapus koneksi (token harus diisi ulang) tampil sama dengan Test | "Forget connection", `text-destructive`, dipisah `ml-auto` | Fixed `cbbfd4d4` |
| HIGH | Layout/Writing | `ReviewCard.tsx` di view coder | Tombol tanpa gaya tampil sebagai teks "Approve & commit Send back"; coder melihat aksi yang tidak bisa dipakai | Prop `readOnly` di ReviewCard/DecisionCard; coder tidak melihat tombol, gaya tombol sama dengan DecisionCard | Fixed `13f4c917` |
| MEDIUM | Writing | checklist Settings | "Not found on PATH", "Missing in this folder", "Not connected" | Tiap status gagal menyebut cara memperbaiki | Fixed `cbbfd4d4` |
| MEDIUM | Accessibility | pesan status | `<p role="status">` dirender kondisional | Region `role="status"` stabil membungkus pesan + checklist; Test → "Testing…" | Fixed `cbbfd4d4` |
| MEDIUM | Writing | placeholder Server URL | `http://localhost:3000` | `http://localhost:8787` (port mock/worker) | Fixed `cbbfd4d4` |
| MEDIUM | Correctness | `checks.ts` | Baris terakhir `bob --version` = `commit: …` | Ambil baris semver (lewati `Running node …`) | Fixed `cbbfd4d4` + test output asli |
| LOW | Typography | checklist | Instruksi panjang ber-font mono, pecah jelek | Mono hanya untuk nilai versi | Fixed `cbbfd4d4` |

Verifikasi: focus-visible terlihat di semua stop Tab form (outline ring Orca); kontras terukur tema light: `--lc-ok` 5.02:1, destructive 4.87:1, muted 4.74:1 di atas kartu putih (lulus 4.5:1). Status checklist tidak hanya warna (● / ○ + teks). **Not verified:** kontras terukur tema dark (inspeksi visual saja), zoom 200%/lebar 320 (app desktop, drawer lebar tetap), screen reader nyata. Temuan design-lint di `Landing.tsx:78`, `StatusBarSurface.tsx:159,288` berasal dari kode Orca asli (`7c86819e`), tidak disentuh. Verdict: **Approve** (tidak ada HIGH tersisa).

Catatan alat: `pnpm -C app run check:code-quality:changed` tidak memeriksa file yang sudah di-commit di monorepo ini, karena `git diff --name-only` mengembalikan `app/src/...` sedangkan filter mengharapkan `src/...`. Padanan dijalankan manual: `git diff --name-only --relative origin/main -- 'src/**/*.ts' 'src/**/*.tsx' | xargs pnpm exec oxlint` (62 file, 1 error `curly` → fixed `aa625358`) dan design-lint pada file renderer (restyle `SheetContent` milik kita → fixed `aa625358`).

### Security review (langkah 13, agent `security-reviewer`, read-only)

PASS. Token hanya dibaca di `secure-store.ts` dan dipakai di header Bearer (`api.ts`) + frame WS hello (`ws-client.ts`); IPC hanya mengembalikan `RadarConnectionSummary` (tanpa token); tidak ada `console`/logger yang memuat token; tidak ada perubahan `webPreferences`/`nodeIntegration`; semua handler `radar:*` memvalidasi input; `radar:checks` hanya launcher tetap + cek keberadaan file berpath absolut; URL server dibatasi http/https. Satu-satunya nilai mirip token di diff adalah fixture test `synthetic-value`. Nama file lolos aturan R5 §8.

## Deviasi

- Model Opus 5.5 (lihat atas). Otomasi Bob memakai CDP langsung ke iframe webview karena browser automation biasa tidak masuk frame.
- Batas koneksi, role, token UI, dan drawer dicatat di D-aarief-01.
- Review C2: registrasi exhaustive `Record<TuiAgent,...>` lengkap tanpa cast baru, `detectCmd`/`launchCmd`/`expectedProcess` = `bob`, glyph B generik. `stdin-after-start` menghindari argumen prompt CLI tetapi tetap mengirim followup lewat PTY bila ada; Bob Shell kini terverifikasi melalui UI. Tidak ada channel IPC atau `nodeIntegration` baru.
- 09b: path `lib/radar/{ws-client,api}.ts` dari rencana dipindah ke main process sesuai D-aarief-01, sehingga header Bearer hanya dipasang di main. Snapshot array §2.21 sekarang diubah oleh `stateFromSnapshot` resmi. Keputusan Approve/Deny tetap menunggu `proposal.decided` dari WS; API tidak mengubah store secara optimistis.

## LANGKAH MANUAL

1. DA-02 sudah lulus dari pemilih agent UI; tidak ada langkah akun Bob tersisa.
2. Gerbang koneksi UI live: mock server fase 02 sudah masuk `main` dan berjalan. Snapshot demo tampil lewat CDP tanpa token, tetapi uji WebSocket live dan klik Approve/Deny memerlukan token mock yang harus dimasukkan sendiri oleh pengguna di Settings. Agent tidak boleh mengetik/login dengan token sesuai instruksi pengguna. Setelah pengguna menghubungkan workspace, cek event blocked dalam 10 detik dan keputusan mencapai endpoint mock, lalu selesaikan checklist Settings, review keamanan/visual, snapshot dan PR app.
3. Jika ingin GitHub menampilkan akun/avatar IBM Bob sebagai co-author, konfirmasi alamat email GitHub IBM Bob untuk mengganti default `bob@ibm.com` (plan/TODO.md B6) sebelum snapshot 09a didorong. Trailer co-author sudah ada di commit C2; identitas pendorong branch tidak menentukan co-author commit.

## Catatan handoff lintas lane

- Alief (fase 02): `GET /v1/state` §2.21 berbentuk array, `RadarState` §6 berbentuk record — mohon pastikan bentuk final; status proposal ditolak belum bernama di R3 §2.14.
