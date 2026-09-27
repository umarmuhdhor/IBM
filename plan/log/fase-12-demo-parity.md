# Fase 12 (lanjutan) · App setara demo landing / `/demo`

Lane: Core (Alief), lintas lane `app/**` dan `radar/packages/ui` atas permintaan user (27 Sep): "make sure our app is doing like the demo we do on the landingpage … the ui too".
Model: Claude Opus 5.5. Worktree terpisah (`IBM-demo`, branch `core-demo-parity`) agar tidak bentrok dengan sesi e2e multiplayer di `lane/core`.

## Celah yang ditemukan (baseline, mock server skenario toko-demo)

| Area | Demo `/demo` | App sebelum |
|---|---|---|
| Feed + notifikasi | kalimat Inggris dengan nama ("Budi's Bob is blocked on checkout.ts, Andi holds it") | kalimat Indonesia dengan id member (`B`, `A`) |
| Mission Control | kolom "Shared repo": path, pemegang, held/reserved/review, antrean | hanya hitungan "N files · N locks" |
| Files & locks | daftar repo dengan nama pemegang + antrean | inisial saja, tanpa antrean |
| Team | lane per orang: mode, prompt terakhir, aktivitas hook/mode, posisi antre | kartu tipis |
| ReviewCard | tidak ada angka karangan | "+0 −0" dikarang saat diff tidak dilaporkan; tombol Approve teks gelap di atas aksen |

## Perubahan

- `common`: `feedText(ev, names)` jadi kalimat Inggris dengan nama member; reducer mengirim nama dari `state.members`.
- `ui`: `ReviewCard` hanya menampilkan baris diff bila angkanya ada; token `--lc-on-accent` untuk teks tombol utama (`ReviewCard`, `DecisionCard`).
- `app`: `radar-lanes.ts` (helper murni), `SharedRepoList`, Files & locks = "Shared repo", Mission Control menampilkan Shared repo di kolom kanan, Team = lane per orang seperti `/demo`.
- `mcp` test: ekspektasi `team_activity` ikut kalimat feed baru (`T-1 is now done`).

Catatan: kunci di sistem per file. Hero landing menampilkan kunci per baris ("lines 3–5 locked · Alice"); belum diputuskan apakah copy landing diubah (lane Imelda) atau kontraknya.

## Gerbang UI `better-interface` (27 Sep, Claude Code)

Scope: panel Live Collab tab Mission Control, Team, Files & locks, tema gelap, lebar 1512 dan 900. Stack: React + Tailwind, token Orca dipetakan ke `--lc-*` di `main.css`. Dokumen konvensi: `CLAUDE.md`, `app/AGENTS.md`, skill `live-collab-app`, `DESIGN.md`.

| Domain | Bukti | Hasil |
|---|---|---|
| Accessibility | Tab ke tombol Watch (ring `:focus-visible` terlihat, `focus-watch.png`), nama aksesibel `Watch <nama>'s Bob`, `aria-current` di tab panel, heading h3/h4 | Clear |
| Layout | screenshot 1512 + 900, urutan baca kolom | 1 temuan lama (di luar cap) |
| Writing | copy feed, empty state, label | 1 LOW |
| Typography | pemotongan teks di lebar 900 | 1 HIGH (diperbaiki) |
| Colors | kontras diukur dari warna ter-render (JS di jendela app) | 1 HIGH (diperbaiki) |
| UI | status, border, radius, tanpa animasi baru | Clear |

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| HIGH | Typography | `TeamPanel.tsx:68`, `TeamPanel.tsx:87`, `SharedRepoList.tsx:24` | `truncate` pada judul task, detail aktivitas Bob (`apply_diff checko…`), path file (hanya `title`) | `[overflow-wrap:anywhere]`, teks penuh membungkus | Teks terpotong tanpa cara membaca nilai penuh di lebar 900 — **diperbaiki**, `fix-team-narrow.png` |
| HIGH | Colors | `SharedRepoList.tsx:40` | `text-muted-foreground/70` untuk "free": 4.04:1 di atas card, 12px | `text-muted-foreground`: 6.94:1 | Teks di bawah 4.5:1 — **diperbaiki** |
| LOW | Writing | `radar/packages/common/src/events.ts:132` | "Request R-1: queued (automatic)" | sebut file/orang bila payload `request.decided` membawa path | Id request tidak berarti bagi manusia; payload saat ini tidak punya path (perlu perubahan kontrak) |

Temuan lama (bukan dari perubahan ini): `MissionControlView.tsx:72` di bawah breakpoint `lg` kolom "Needs you" jatuh di bawah seluruh Live feed; badge sidebar tetap menunjukkan "1". MEDIUM, layout.

Kontras terukur (dark): teks muted 6.94:1, chip antrean 5.86:1, "blocked" 6.24:1, hijau ok 12.77:1, kuning review 9.35:1.
Tidak diverifikasi: tema terang, zoom 200%, screen reader nyata.

Verdict: **Approve** (tidak ada HIGH tersisa).

## Verifikasi

- `app`: vitest `src/renderer/src/components/radar` 56 test lulus, `pnpm tc` 0 error, oxlint bersih pada file baru, `check:code-quality:changed` lulus, `build:electron-vite` OK.
- `radar`: common 97, server 186, mcp 48, sync 56, ui 11, web 48, hooks 48 lulus; `typecheck` + `lint` bersih. (Test latensi server p95 sempat gagal satu kali saat mesin sibuk e2e; lulus saat diulang.)
