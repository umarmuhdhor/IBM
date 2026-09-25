# Fase 09 — Mission Control (Next.js, layar PM)

| Field | Nilai |
|---|---|
| Jalur | Orang 3 |
| Slot WITA | Setup: Sab 26 Sep 01:00–02:00 · Build: Sab 08:00 – 21:00 |
| Estimasi | 8 jam |
| Prasyarat | 02 (reducer + mock server). Boleh paralel penuh memakai mock; sambung ke server asli setelah fase 05 |
| Requirement PRD | UI-01, UI-02, UI-03, UI-04 (P0); §11 layout & prinsip UX; NFR-04 (token MC) |
| Model | Sonnet 5 · effort medium |
| Fase berikutnya | 10 (lalu 11) |

## Tujuan

Satu layar yang menjawab tiga pertanyaan PM secara berurutan: siapa mengerjakan apa (task board), di mana (pohon file dengan kunci berwarna dan penanda "sedang ditulis"), dan apa yang butuh saya (antrean keputusan dengan tombol Setujui/Tolak), plus feed live < 1 detik. Layar ini juga cover 16:9 dan panel tengah video demo, jadi harus terlihat rapi di 1920×1080.

## Bacaan wajib

- PRD §11 (mockup ASCII — acuan layout), §07.1, §07.3, §07.4, §10.5, §15 (adegan yang melibatkan MC)
- `plan/ref/R3-kontrak-api.md` §2.13, §2.14, §2.18, §2.19, §2.21, §3 (`client: 'mc'`), §5, §6
- `packages/common/src/reducer.ts`, `selectors.ts`

## Output

- `packages/web/app/{page.tsx, mc/page.tsx, layout.tsx, globals.css}`
- `packages/web/components/{TopBar,TaskBoard,TaskCard,FileTree,LockChip,WritingPulse,DecisionQueue,ProposalCard,PlanPreview,LiveFeed,ConnectionBadge,Toasts,StaleMemberBanner}.tsx`
- `packages/web/lib/{ws-client,api,store,colors,time}.ts`
- `packages/web/e2e/mc.spec.ts` (Playwright smoke)
- Deploy Vercel

## Desain

**Palet** (R5 §4): A biru `#3B82F6`, B ungu `#8B5CF6`, C oranye `#F97316`; status hijau/kuning/merah hanya untuk status. Latar gelap netral (`#0B0F17`), panel `#111827`, teks `#E5E7EB`, font mono untuk path (`JetBrains Mono`/`ui-monospace`), sans untuk teks (`Inter`).

**Layout 1920×1080** (PRD §11): TopBar 56 px; tiga kolom `grid-cols-[1.1fr_1fr_1.1fr]` — Task board | File & kunci | Menunggu keputusan (atas) + Feed live (bawah). Di bawah `lg` kolom ditumpuk (urutan: keputusan, task, file, feed).

**Status kunci di pohon file** (UI-02): chip inisial berwarna pemegang; gaya: `dipesan` = outline, `dipegang` = solid, `review` = solid + ikon jam; `antre:B` = chip kecil abu dengan inisial; `bebas` = teks abu "bebas"; ✎ berkedip (animasi pulse) selama `now < writingUntil` (3 s).

## Langkah kerja

1. **Setup** (slot 01:00–02:00, boleh sebelum fase 02 selesai): Next.js 15 App Router + Tailwind 4 + zustand, import `@radar/common` (transpilePackages), deploy kosong ke Vercel (`packages/web` sebagai root project, build command `pnpm --filter @radar/web build`). Set env `NEXT_PUBLIC_RADAR_SERVER`.

2. **Login** (`app/page.tsx`): form URL server (default env) + token Mission Control; tombol "Masuk" → `GET /v1/state` dengan token untuk validasi → simpan `{server, token}` di `localStorage` (bungkus try/catch) → redirect `/mc`. Link "Tonton replay demo" ke `/demo`. Peringatan kecil: "Token MC hanya untuk PM manusia. Jangan berikan ke Bob."

3. **Store** (`lib/store.ts`, zustand): `state: RadarState`, `connected`, `lastEventAt`, `now` (ticker 250 ms untuk animasi ✎), `actions.applyEvent`, `actions.reset(state)`. Semua perubahan lewat `applyEvent` dari `@radar/common` (sama dengan replay).

4. **WS client** (`lib/ws-client.ts`): hubungkan `wss://…/ws`, `hello {token, client:'mc'}`, terima `state` → `reset`, `event` → `applyEvent`. Reconnect backoff 0,5→8 s; saat reconnect ambil `state` baru. Ukur `now - ev.ts` → tampilkan latensi feed di TopBar (dev mode) untuk bukti UI-04 < 1 s.

5. **API** (`lib/api.ts`): `decide(proposalId, approve, note?)`, `revoke(path)`, `cancelTask(id)`, `retryCommit(taskId)` dengan token MC; tampilkan error R3 §1 sebagai toast.

6. **TopBar** (`TopBar`, `ConnectionBadge`): `Mission Control · toko-demo`, `● live · 3 PC terhubung` (hitung member `online`), chip anggota `[A·coder][B·coder][C·PM]` dengan warna & titik online, head commit pendek + link GitHub.

7. **TaskBoard** (UI-01): kolom **Draf** (task dari proposal plan `menunggu`, tampil pudar dengan label "usulan"), **Dikerjakan** (`terbuka` + `dikerjakan`; `terbuka` diberi label "belum mulai"), **Review**, **Selesai** (sha pendek + link commit). Kartu: `T-1 Kupon`, chip pemilik, `3 file`, `14 edit`, badge "tunggu PM" bila ada proposal review menunggu. Klik kartu → drawer detail (file task, status kunci, riwayat event task). Tombol "Batalkan task" di drawer (mc).

8. **FileTree** (UI-02): dari `selectors.fileTree(state)` — hanya tampilkan folder yang punya file terkunci/berubah/antre + toggle "tampilkan semua". Baris file: nama, ✎ bila sedang ditulis, `LockChip` pemegang, antrean (`antre:B`), status kecil (`dipesan/dipegang/review`). Menu kecil per file: "Cabut kunci" (mc, konfirmasi) — dipakai SV-09.

9. **DecisionQueue** (UI-03): kartu untuk setiap proposal `menunggu` + permintaan `terbuka` yang belum punya usulan:
   - Permintaan tanpa usulan: `[blokir] B butuh checkout.ts (milik A, T-1)` + teks "Minta usulan dari main agent di Bob PM" + tombol salin prompt `pm-rebutan.md` (supaya PM cepat).
   - Proposal `decision`: judul `[blokir]`, isi "Usulan main agent: B antre sampai T-1 disetujui…" (`reason`), tombol **Setujui** / **Tolak**.
   - Proposal `plan`: `PlanPreview` — daftar task dengan pemilik, file (chip), file antre; peringatan bila ada file bersama. Tombol **Setujui rencana** / **Tolak**.
   - Proposal `review`: `[review] T-0 Setup ongkir`, verdict, catatan, daftar notify & flags; tombol **Setujui** / **Kembalikan** (untuk verdict `kembalikan` tombolnya "Setujui pengembalian"). Link "lihat diff" (UI-06 fase 11).
   - Setelah klik: tombol disabled + spinner sampai event `proposal.decided` datang (bukan optimistic), lalu kartu meluncur keluar.
   - Proposal `diterapkan_otomatis` tampil 5 s sebagai kartu info abu "Diterapkan otomatis: antre".
   - Urutan: blokir dulu, lalu review, lalu rencana (yang paling menghambat coder di atas).
   - Keyboard: `Enter` = setujui kartu teratas (dengan konfirmasi kecil), untuk demo cepat.

10. **LiveFeed** (UI-04): `state.feed` 30 item terbaru, format `21:06 Bob A ubah checkout.ts` dengan titik warna aktor, ikon per jenis (edit, blokir merah, keputusan, commit hijau). Item baru fade-in. Klik item → drawer detail event (payload rapi; diff di fase 11).

11. **StaleMemberBanner** (SV-09 UI, P1 tapi murah): event `member.stale` → banner kuning "PC A tidak terdengar 5 menit. Kunci: routes.ts, checkout.ts [Cabut]".

12. **Kondisi kosong & error**: belum ada task → kartu ajakan "Minta main agent menyusun rencana" + tombol salin `pm-rencana.md`. Koneksi putus → badge merah "terputus, menyambung ulang…", data tetap tampil.

13. **Aksesibilitas & rapi**: kontras AA, fokus terlihat, `aria-live="polite"` pada feed, semua tombol punya label; tidak ada scroll horizontal di 1280 px; lebar kolom stabil (tidak melompat saat kartu masuk/keluar).

14. **Test**:
    - Unit selector/komponen ringan (vitest + @testing-library/react) untuk `TaskBoard` kolom & `LockChip` gaya.
    - Playwright `e2e/mc.spec.ts` melawan `pnpm dev:mock --scenario demo`: login → 3 kolom terlihat → dalam 10 s muncul kartu `[blokir]` → klik Setujui memanggil `POST /v1/proposals/:id/decision` (intercept) → feed berisi "diblokir".
    - Ukur UI-04: skenario mock mencatat `ev.ts`; test memastikan item feed muncul < 1000 ms setelah event dikirim.

15. **Deploy** Vercel, sambungkan ke server asli setelah fase 05 (CORS di server harus berisi domain Vercel). Screenshot 1920×1080 → `docs/img/mission-control.png` (bahan cover).

16. Commit `fase-09: mission control`.

## Verifikasi

```bash
pnpm --filter @radar/web typecheck && pnpm --filter @radar/web lint
pnpm --filter @radar/web build
pnpm dev:mock & pnpm dev:web &
pnpm --filter @radar/web exec playwright test
```

## Kriteria selesai (DoD)

- [ ] UI-01: 4 kolom, kartu dengan pemilik & jumlah file (Playwright/screenshot).
- [ ] UI-02: chip pemegang berwarna per orang, status dipesan/dipegang/review, ✎ 3 s (screenshot + test).
- [ ] UI-03: kartu rencana, keputusan, review dengan Setujui/Tolak yang memanggil endpoint mc.
- [ ] UI-04: feed < 1 s (angka dari test).
- [ ] Terhubung ke server asli (bila fase 05 sudah selesai) dan ter-deploy di Vercel.
- [ ] Tampilan 1920×1080 rapi untuk cover; layout bertumpuk di layar sempit.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Server asli belum siap | Terus pakai mock; sambungan diuji di fase 10 |
| Token MC di localStorage dianggap tidak aman | Dokumentasikan di README (MVP; roadmap login); token bisa dirotasi `radar-server token --rotate` |
| Terlalu banyak event → UI lambat | Feed dibatasi 200 di reducer; render 30; memo per kolom |

## Catatan handoff

- Fase 11 memakai ulang semua komponen di `/demo` dengan store yang diisi pemutar replay (tanpa WS).
- Fase 14 memakai screenshot untuk cover dan deck.
