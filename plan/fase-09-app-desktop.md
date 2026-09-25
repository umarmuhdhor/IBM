# Fase 09 — App desktop (fork Orca): agent IBM Bob, panel Live Collab, Mission Control

| Field | Nilai |
|---|---|
| Jalur | **Aarief** · branch `lane/app` (seluruh fase, termasuk komponen `@radar/ui`) |
| Slot WITA | 09a Sab 00:30–02:30 · 09b Sab 02:30–04:00 · tidur 04:00–09:00 · 09c Sab 09:00–16:00 |
| Estimasi | 9 jam |
| Prasyarat | 00. 09a–09b **tidak** butuh 02. 09c memakai mock server fase 02 (`pnpm -C radar dev:mock`), lalu server asli setelah Sinkron 1 (Sab 16:00). |
| Requirement PRD | DA-02, DA-03, DA-04, DA-06, UI-01..04, UI-07 (P0) · DA-05, UI-08 (P1) · NFR-10 |
| Model | Sonnet 5 · effort high. Opus 5.5 untuk langkah 2 dan 6 (titik sambung Orca). |
| Bob slice | **C1** onboarding Orca · **C2** registrasi agent `bob` · **C3** komponen `@radar/ui` |
| Fase berikutnya | 11 |

## Tujuan

App Orca berubah menjadi **IBM Bob Live Collab** tanpa merombak Orca:
1. IBM Bob menjadi agent kelas satu di terminal Orca.
2. Seksi sidebar **Live Collab** (Mission Control, Team, Files & locks) menampilkan state workspace secara live.
3. PM bisa Approve/Deny dari app.

Tampilan mengikuti [`../DESIGN.md`](../DESIGN.md) §2–§5 dan mockup hasil `prompt_ui.md` #01–#03.

## Bacaan wajib

- `../DESIGN.md` seluruhnya (terutama §3 komponen, §4 peta integrasi, §5.1–5.4)
- PRD §10.5, §10.6 · `ref/R3-kontrak-api.md` §2.13, §2.14, §2.21, §3 (klien `mc` dan `app`), §5, §6 · `ref/R5` §4, §8 · `ref/R7`
- `orca:AGENTS.md`, `orca:CLAUDE.md`
- `packages/common/src/{reducer,selectors,schemas}.ts` (setelah fase 02; sebelumnya pakai tipe sementara di `packages/ui/src/types-temp.ts`)

## Output

- `docs/ORCA_MAP.md`: peta titik sambung Orca (hasil Bob slice C1)
- Agent `bob` di semua titik registrasi agent Orca (pola agent `kiro`, Orca 1.4.197): `orca:src/shared/{tui-agent.ts, tui-agent-config.ts, tui-agent-display-names.ts, tui-agent-selection.ts, tui-agent-permissions.ts, agent-kind.ts, telemetry-property-schemas.ts, skills-cli-agent-keys.ts}` dan `orca:src/renderer/src/lib/{agent-catalog.tsx, agent-status.ts, agent-favicon-assets.ts, agent-icon-glyphs.tsx}`. Cari ulang dengan `grep -rlw kiro app/src | grep -v .test.` sebelum mulai, karena daftar bisa berubah
- `orca:electron.vite.config.ts`: alias `@radar/common` dan `@radar/ui`
- `orca:src/main/radar/secure-store.ts` (Electron `safeStorage`) + IPC `radar:get-connection` / `radar:set-connection`
- `orca:src/renderer/src/lib/radar/{ws-client,api}.ts`, `orca:src/renderer/src/store/radar-store.ts`
- `orca:src/renderer/src/components/radar/{RadarSidebarSection,MissionControlView,TeamPanel,FilesLocksView,NotificationsPanel,RadarSettingsPane,RadarStatusItem}.tsx`
- `packages/ui/src/*` (DESIGN §3) + test
- Branding minimum: `productName`, judul jendela, layar About ("IBM Bob Live Collab — built on Orca (MIT)")
- Screenshot `docs/img/app-{home,coder,mission-control}.png` (1512×982)

## Langkah kerja

### 09a · Onboarding Orca dengan Bob + agent IBM Bob (Sab 00:30–02:30)

0. **Pisahkan identitas app dari Orca asli (wajib, sebelum menjalankan build apa pun).** Di Mac tim sudah terpasang Orca asli (`com.stablyai.orca`). Build kita memakai appId dan folder data yang sama, jadi bisa berbagi atau menimpa settings dan worktree Orca asli. Ubah di `orca:config/electron-builder.config.cjs`: `appId = 'dev.livecollab.app'`, `productName: 'IBM Bob Live Collab'`. Ubah juga nama userData di main process (cari `app.setName`/`setPath('userData'` lewat ORCA_MAP, atau langsung `grep -rn "userData" app/src/main | head`) menjadi `IBM Bob Live Collab`. Cek `pnpm -C app dev` memakai folder data terpisah (`~/Library/Application Support/IBM Bob Live Collab*`).

1. **Bob slice C1 — onboarding Orca (Ask/Plan mode, ±3 Bobcoin).** Prompt siap tempel:
   > "Kamu di repo fork Orca (Electron + React). Tanpa mengubah file, jelaskan: (1) di mana agent CLI didefinisikan dan langkah minimum menambah agent baru bernama `bob` (command `bob`); (2) di mana renderer menulis output pty ke xterm (`term.write`) dan di mana input keyboard dikirim ke pty; (3) komponen sidebar kiri dan cara menambah seksi baru; (4) cara menambah tab/pane view baru; (5) cara main process mengekspos IPC ke renderer; (6) konfigurasi electron-builder untuk productName & ikon. Fokus ke `src/shared/`, `src/renderer/src/lib/`, `src/renderer/src/components/sidebar/`, `src/main/ipc/`, `config/electron-builder.config.cjs`. Beri path:baris. Buat laporan HTML ringkas."
   - Simpan laporan HTML Bob ke `docs/ORCA_MAP.html` dan ringkas ke `docs/ORCA_MAP.md`. Buktikan dengan `bob-evidence.sh aarief 01 orca_onboarding`.
   - Claude Code (`code-explorer`) **memverifikasi** path:baris dari laporan Bob. Koreksi dicatat, bukan ditulis ulang.
   - Cerita untuk video dan statement: "Bob memetakan 23k file Orca dalam satu task."

2. **Bob slice C2 — registrasi agent `bob` (Code mode, ±3 Bobcoin).** Prioritas **P1**: Bob IDE adalah alat utama, dan Bob Shell di app hanya pelengkap. Tetap kerjakan kalau waktu ada, karena ini slice Bob yang murah dan bagus sebagai bukti. Tambahkan juga tombol **Open in Bob IDE** di panel Live Collab yang membuka folder workspace di Bob IDE. Prompt: "Tambahkan agent `bob` (label 'IBM Bob', command `bob`, homepage https://bob.ibm.com, glyph huruf B generik, **bukan** logo IBM) mengikuti pola agent `claude` di file-file yang tercantum di `docs/ORCA_MAP.md`. Jangan ubah agent lain." Bukti: `02-register-bob-agent`.
   - Setelah Bob selesai: pastikan `detectCmd`/`expectedProcess` benar (`bob`), dan `promptInjectionMode` mengikuti hasil spike 7 (fase 01). Kalau belum ada hasil spike, pakai mode yang paling konservatif (ketik manual, tanpa injeksi) dan tandai "BELUM DIVERIFIKASI".
   - Update `orca:docs/site/content/docs/agents/supported.mdx` (satu baris) kalau file itu ada.
   - Test: jalankan test Orca yang terkait registry agent (cari `tui-agent*.test.ts`) dan `pnpm -C app tc`. `tc` menunjuk `Record<TuiAgent, …>` yang belum punya entri `bob`; lengkapi semuanya, jangan pakai cast.
   - Uji manual: `pnpm -C app dev` → buat worktree → pilih **IBM Bob** → terminal menjalankan `bob` dan Bob menjawab "halo".

### 09b · Koneksi Live Collab (Sab 02:30–04:00)

3. **Alias Vite.** Di `orca:electron.vite.config.ts` bagian renderer: `resolve.alias['@radar/common'] = radar/packages/common/src`, `['@radar/ui'] = radar/packages/ui/src`. Pastikan tsconfig renderer Orca mengenal path yang sama (`paths`). Uji `pnpm -C app tc`.
4. **Penyimpanan koneksi.** `orca:src/main/radar/secure-store.ts`: simpan `{server, workspace, member, role, token}` terenkripsi dengan `safeStorage` di `userData/radar/connection.bin`. Nama file tidak mengandung "token" (R5 §8). IPC `radar:get-connection` / `radar:set-connection` / `radar:clear-connection` lewat pola IPC Orca (lihat ORCA_MAP). Token **tidak pernah** dikirim ke renderer log.
5. **WS client + store.** `lib/radar/ws-client.ts`: `hello { token, client: role === 'pm' ? 'mc' : 'app' }`, lalu `state` → `reset` dan `event` → `applyEvent`. Keepalive `WS_PING_FRAME` tiap `WS_PING_MS` (sama dengan sync, R3 §3). Reconnect backoff 0,5→8 s. Ukur latensi feed. `store/radar-store.ts` (zustand, mengikuti pola store Orca): `state`, `connected`, `now` (ticker 250 ms untuk pulse), `actions`. `lib/radar/api.ts`: `decide`, `revoke`, `cancelTask` (hanya role pm).
   - Test vitest: store menerapkan urutan event fixture dari mock → kolom task dan kunci benar.

### 09c · Panel Live Collab (Sab 09:00–16:00)

6. **Bob slice C3 — komponen `@radar/ui` (Code mode, ±4 Bobcoin).** Prompt: "Di `radar/packages/ui/src`, buat komponen React presentasional sesuai `DESIGN.md` §2–§3: `AgentTag`, `MemberChip`, `LockChip`, `WritingPulse`, `BobTrace`, `DecisionCard`, `TaskCard`, `FeedItem`. Semua warna & font hanya lewat `var(--lc-*)` (tanpa hex di komponen). Buat `theme-vars.css` (bukan `tokens.css`, R5 §8) yang mengisi `--lc-*` dengan nilai DESIGN §2.1 + font IBM Plex, untuk web/replay saja. Props murni, tanpa fetch. Tulis test @testing-library untuk `LockChip` (4 status) dan `DecisionCard` (Approve memanggil `onApprove`)." Bukti: `bob-evidence.sh aarief 03 radar_ui_components`. Setelah selesai, umumkan props komponen ke Imelda (dipakai replay).
   - Claude Code melengkapi sisa komponen (`ReviewCard`, `PresenceStack`, `BriefMeter`, `views/*`; `TerminalFrame` P1) mengikuti gaya yang dibuat Bob.
   - **Di app:** jangan impor `theme-vars.css`. Tambahkan blok aditif di `app/src/renderer/src/assets/main.css` yang mengisi `--lc-*` dari token Orca yang setara (latar, kartu, border, teks, status, font sans/mono Orca) dan mendefinisikan token baru hanya untuk `--lc-person-a/b/c` + `--lc-needs-you` (DESIGN §2.1). Jalankan `pnpm -C app run check:code-quality:changed`: tidak boleh ada warna palet mentah di `app/src/**` selain blok token itu.
   - Halaman `packages/web/app/gallery/page.tsx` (dibuat Imelda di fase 11) menampilkan semua komponen dengan data contoh, dipakai untuk mencocokkan dengan mockup.
7. **Seksi sidebar** `RadarSidebarSection`: judul **LIVE COLLAB**, item Mission Control (badge jumlah "Needs you"), Team, Files & locks. Disisipkan ke sidebar Orca dengan satu baris import + render (titik dari ORCA_MAP).
8. **Views** sebagai tab/pane Orca:
   - `MissionControlView` (DESIGN §5.3): Tasks (Draft/Working/Review/Done) · Files & locks · Needs you (DecisionCard/ReviewCard) · Live feed. Tombol Approve/Deny memanggil `api.decide`. Tombol disabled + spinner sampai event `proposal.decided` datang (bukan optimistic). Role `app` (coder) melihat view ini read-only tanpa tombol.
   - `TeamPanel` (DESIGN §5.2 kanan): anggota, mode Bob, status (idle/writing/blocked dari event), task aktif, tombol **Watch Bob** (membuka `WatchBobView`, fase 11).
   - `FilesLocksView`: pohon file dari `selectors.fileTree`, dengan `LockChip` + `WritingPulse`.
   - `NotificationsPanel`: blokir saya, keputusan, notify dari main agent.
9. **Settings & status bar.** `RadarSettingsPane` (DESIGN §5.9 versi sederhana): URL server, workspace, member, role, token (field password), tombol **Connect** dan **Test**. Checklist cek: koneksi WS, `bob --version` (lewat IPC `child_process` main), ada `.bob/settings.json` di folder workspace. `RadarStatusItem`: `● Live Collab · 3 online · 1 needs you`.
10. **Branding minimum** (DA-06): judul jendela, About ("built on Orca by Stably AI, MIT"). `productName` dan appId sudah diganti di langkah 0. Ikon diganti di fase 11.
11. **Kondisi kosong & error**: belum konek → kartu "Connect to a Live Collab workspace". Server putus → badge merah, data terakhir tetap tampil.
12. **Test & verifikasi visual.** Skill `apple-design`/`emil-design-eng` untuk motion kartu dan pulse. Screenshot panel lewat `electron-automation` atau Playwright `_electron.launch()`, lalu jalankan `better-interface` dan perbaiki temuan HIGH sebelum PR. Unit test `@radar/ui`. Vitest store. Uji manual melawan mock `--scenario demo`: dalam 10 s muncul kartu `[blocked]`, dan Approve memanggil `POST /v1/proposals/:id/decision` (lihat log mock). Ambil 3 screenshot ke `docs/img/` dan bandingkan dengan mockup.
13. **Security review** (`security-reviewer`): token hanya di main process/safeStorage, tidak ada token di log renderer, tidak ada `nodeIntegration` baru.
14. Commit per bagian (09a, 09b, 09c). PR per bagian dari branch snapshot `lane/app-f09a`, `-f09b`, `-f09c` (PROMPT langkah 11); `09c` harus ter-merge sebelum Sinkron 1 (Sab 16:00).

## Verifikasi

```bash
pnpm -C app tc                                            # Orca + perubahan kita
pnpm -C app exec oxlint $(git diff --name-only origin/main -- 'src/**/*.ts' 'src/**/*.tsx')
pnpm -C app run check:code-quality:changed               # tanpa warna palet mentah
pnpm -C app test -- src/renderer/src/components/radar src/renderer/src/store/radar-store
pnpm -C radar --filter @radar/ui test
pnpm -C radar check:ignored
pnpm -C radar dev:mock &  pnpm -C app dev                 # uji manual melawan mock
```

## Kriteria selesai (DoD)

- [ ] *(P1)* DA-02: "IBM Bob" bisa dipilih, `bob` jalan di terminal Orca (screenshot).
- [ ] DA-03/04: seksi Live Collab + koneksi tersimpan aman. Token tidak muncul di log (grep).
- [ ] UI-01..04, UI-07 tampil dengan data mock, dan setelah Sinkron 1 dengan server asli.
- [ ] Approve/Deny memanggil endpoint mc, hanya untuk role pm.
- [ ] Bob slice C1, C2, C3 punya folder bukti lengkap + commit dengan trailer `Bob-Assisted`.
- [ ] `pnpm -C app tc` hijau. Tidak ada perubahan di pty daemon, relay, atau mobile Orca.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Menyisipkan seksi ke sidebar Orca rumit | Buka Live Collab sebagai tab khusus dari Command palette Orca + satu tombol di status bar |
| Alias Vite ke `radar/` bentrok dengan tsconfig Orca | Salin build `@radar/ui` (`tsc` → `dist`) dan impor dari `dist`. Catat D-app-.. |
| `bob` tidak terdeteksi sebagai agent (status heuristik Orca) | Tidak apa-apa untuk R0: terminal tetap jalan. Status agent diambil dari event Live Collab. |
| Waktu habis | Potong: NotificationsPanel → gabung ke TeamPanel. Settings cukup form tanpa checklist. |

## Catatan handoff

- Fase 11 memakai `TeamPanel` (tombol Watch), `TerminalFrame`, titik tap xterm dari ORCA_MAP, dan store yang sama.
- Replay web (fase 11) memakai `@radar/ui` views yang sama dengan store diisi pemutar.
