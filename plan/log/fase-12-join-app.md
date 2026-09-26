# Fase 12 (lanjutan) · IN-03 di app: download app, masukkan kode, langsung gabung

Lane: Core (Alief), lintas lane `app/**` atas permintaan user (lihat D-alief-09, tambahan 26 Sep).

## Alur yang diuji

- **Teman:** buka app → Live Collab → Settings → isi *Join code* → **Join**. App menukar kode (`POST /v1/join`), menyimpan koneksi (safeStorage), menjalankan sync agent bawaan (`radar join` dengan Electron sendiri), memasang kit Bob di `~/live-collab/<ws>/.bob`, lalu **Open in IBM Bob**.
- **Pemilik:** app tersambung sebagai Mission Control → Settings/Team → **Invite teammates** → **Make code** per member → **Copy**.
- **Buka ulang app:** koneksi member tersimpan → sinkron lanjut otomatis (`radar start`).

## Isi perubahan

- `radar/packages/sync/scripts/bundle-standalone.mjs`: bundle CLI satu file (esbuild, semua dependensi) + salin bob-kit.
- `app/config/scripts/build-radar-cli.mjs`, `package.json` (`build:radar-cli`, dipanggil `dev` dan `build:desktop`), `electron-builder.config.cjs` (extraResources `radar-cli`), `.gitignore`.
- Main: `src/main/radar/{join,sync-agent,node-shim}.ts` (baru), `connection-ipc.ts` (`startClient` diekspor; lupakan koneksi juga menghentikan sync), `secure-store.ts` (`requireOsEncryption` diekspor), `startup/main-process-ipc-bootstrap.ts` (1 baris).
- Preload: `radar-join-bridge.ts` (baru), `radar-bridge.ts` (spread).
- Renderer: `JoinWithCodeCard.tsx`, `InviteCodesCard.tsx` (baru), `RadarPanel.tsx` (baris render).
- Shared: `src/shared/radar-join.ts`.
- Server: pesan 404 `/v1/join` kini bahasa Inggris (UI app berbahasa Inggris); dideploy (versi 63d59d3c).
- Test: `src/main/radar/join.test.ts` (6).

## Verifikasi

| Perintah / interaksi | Hasil |
|---|---|
| `pnpm -C app run typecheck` | bersih |
| `pnpm -C app run check:code-quality:changed` | lulus (0 temuan) |
| `pnpm -C app test src/main/radar` | 29 lulus |
| `pnpm -C app test src/renderer/src/components/radar src/shared` | 9075 lulus, 0 gagal |
| `pnpm -C radar/packages/server test` | 170 lulus |
| App dev (HOME terisolasi + keychain sendiri), kode D → Join | "Syncing 18 files", folder + `.bob` (mcp.json, hooks, radar-mcp.js) ada, header "2 online" |
| Edit `index.html` di folder D → cek folder A (`radar join` Alief) | baris muncul di A < 6 s; dihapus lagi, ikut terhapus |
| `ELECTRON_RUN_AS_NODE=1 <Electron> -e …` dengan stdin | jalan (Node 24.21.0), jadi shim `node` bisa menjalankan hook Bob |
| Tutup app | proses sync ikut berhenti |
| Buka ulang app | `radar start` jalan sendiri, status "syncing", 18 file |
| Sambung sebagai `mc` → Make code (D) | kode `XXXX-XXXX` + Copy + "until <hari jam>" |
| Kode salah `ABCD-EFGH` | field merah (`aria-invalid`), pesan server tampil di bawah tombol |
| Open in IBM Bob pada Mac tanpa Bob | **Not verified** (Bob terpasang di Mac ini; jalur fallback membuka Finder) |
| Mac teman tanpa Node sama sekali | **Not verified** lewat app (shim `node` hanya ditulis bila login shell tidak punya `node`); jalur yang sama sudah diuji untuk `join.sh` |

## UI gate (better-interface)

Scope: `JoinWithCodeCard.tsx`, `InviteCodesCard.tsx`, render di `RadarPanel.tsx`; state kosong, error, joined, pemilik (mc). Tema terang diukur; tema gelap Not verified. Konvensi: `app/docs/STYLEGUIDE.md`, `app/AGENTS.md`.

| Domain | Bukti | Hasil |
|---|---|---|
| Accessibility | label pembungkus, `role=status`, tombol native, fokus Orca | 2 temuan (diperbaiki) |
| Layout | screenshot 1512 px, urutan penting untuk mc | 3 temuan (diperbaiki) |
| Writing | semua teks tombol/pesan | 3 temuan (diperbaiki) |
| Typography | ukuran/weight vs pane Connection | Clear (truncate dicatat di Accessibility) |
| Colors | #737373 di #ffffff = 4.74:1; kode #0a0a0a di #f5f5f5 ≈ 18:1 | Clear |
| UI | tanpa animasi; radius/shadow dari primitive Orca | Clear |

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| HIGH | Accessibility | `InviteCodesCard.tsx:52` | `<span className="w-28 truncate">` | `min-w-28`, tanpa truncate | nama panjang terpotong tanpa cara melihat nilai penuh |
| HIGH | Writing | `InviteCodesCard.tsx:41` | "Each use signs that member in on the new device." | "…signs that member in on the new Mac and signs out their previous device." | teks menyembunyikan bahwa perangkat lama ter-logout |
| HIGH | Writing | `JoinWithCodeCard.tsx:48,129` | pesan "Joined … as D" tetap tampil setelah Forget connection | pesan terikat ke koneksi (`note.key`), hilang saat koneksi berganti | status basi menyesatkan |
| MEDIUM | Accessibility | `JoinWithCodeCard.tsx:125` | `disabled={busy \|\| code.trim().length < 8}` | `disabled={busy}`; validasi saat submit, `aria-invalid` + `aria-describedby` ke pesan | tombol mati tanpa penjelasan |
| MEDIUM | Layout | `RadarPanel.tsx` settings | kartu Join tampil untuk Mission Control di atas Invite | mc hanya melihat Invite teammates | urutan penting; Join akan mengganti koneksi mc |
| MEDIUM | Layout | `JoinWithCodeCard.tsx:102` | input kode selebar pane (≈1400 px) | `max-w-xs` | kolom 9 karakter tidak perlu selebar layar |
| MEDIUM | Writing | `InviteCodesCard.tsx:25`, server `routes.ts:64` | error generik; pesan server bahasa Indonesia | tampilkan pesan server; pesan server bahasa Inggris | penyebab asli (mis. rate limit) hilang; bahasa campur |
| LOW | Layout | `JoinWithCodeCard.tsx:120` | tautan "Use another server" menjorok di baris sendiri | di baris aksi setelah Join | tepi rata |
| LOW | Writing | `InviteCodesCard.tsx:32` | `clipboard.writeText` gagal tanpa pesan | "Unable to copy. Select … and copy it by hand." | error tanpa jalan keluar |

Tercatat, di luar scope (pane Connection milik lane App): dua tombol terisi dalam satu view (Open in IBM Bob + Connect); header "N online" tetap tampil sesaat setelah Forget connection.

Verdict: **Approve** (semua HIGH diperbaiki, dicek ulang dengan screenshot).
