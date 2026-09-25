# IBM Bob Live Collab — Desain (v0.3)

> Arah visual: **clean pro ala Amoeba**, yaitu gelap, tenang, mono, dengan tag agent berwarna. Ditambah **DNA IBM**: huruf IBM Plex dan palet Carbon, supaya "ini untuk IBM Bob" terasa tanpa memakai logo IBM.
> Dasar: fork Orca (Electron + React + Tailwind/shadcn). Referensi: `UI Design/amoeba ui/*`, `UI Design/orca ui/*`, video Mosaic.
> Produk: [`PRD.md`](PRD.md) · Plan: [`PLAN.md`](PLAN.md) · Prompt gambar: [`prompt_ui.md`](prompt_ui.md)

---

## 0. Urutan prioritas (baca dulu)

1. **Orca dulu.** Di dalam app (`app/`), pakai komponen, token, spasi, ikon, dan pola layout Orca apa adanya: shadcn/Radix, Tailwind theme Orca, lucide, sidebar, dan panel Agent Dashboard. Panel Live Collab harus terasa seperti fitur bawaan Orca, bukan aplikasi tempelan.
2. **Aksen Live Collab di atasnya.** Hanya ini yang kita tambahkan: warna orang (A/B/C), aksen "Needs you", warna status, `AgentTag`, `LockChip`, dan `BobTrace` (§2–§3). Font IBM Plex dipakai di replay, cover, dan deck. Landing memakai gaya warm paper (§5.11). Di dalam app, ikuti font Orca.
3. **Mockup Stitch** (`UI Inspo & Design/UI Design/stitch_ibm_bob_live_collab_ui/*`) dan gambar Amoeba/Mosaic **hanya pedoman** susunan dan suasana, bukan spesifikasi piksel. Jangan menyalin:
   - angka karangan (mis. "99.4% Safe Handoff", "V2.4", "HD 60FPS", "vs 4.2 min baseline"). Semua angka di UI harus berasal dari data nyata,
   - font serif di render Stitch (itu fallback),
   - sidebar app di halaman replay web,
   - teks lama "Bob radar" di status bar.

---

## 1. Prinsip

1. **Bob selalu kelihatan.** Setiap aksi di layar menyebut Bob siapa dan primitif Bob apa yang bekerja, misalnya `Andi · Bob coder`, `hook · PreToolUse · lock_guard → blocked · 84 ms`, `mcp · radar.why_blocked`. Juri harus bisa melihat hook, mode, dan MCP bekerja, bukan cuma mendengarnya di narasi.
2. **Tenang sampai ada yang butuh kamu.** Layar dominan abu gelap. Warna hanya muncul untuk dua hal: **siapa** (warna orang) dan **status** (hijau/kuning/merah). Kartu "Needs you" adalah satu-satunya elemen yang boleh mencolok.
3. **Tiga pertanyaan PM, kiri ke kanan:** siapa mengerjakan apa → di file mana → apa yang menunggu saya.
4. **Coder tidak pernah bingung.** Setiap blokir disertai alasan satu kalimat dan saran pekerjaan lain.
5. **Live terasa hidup, tapi tidak berisik.** Animasi pendek (≤ 300 ms), pulse "sedang ditulis" 3 detik, tanpa confetti.
6. **Aditif di atas Orca.** Kita memakai ulang shell, sidebar, terminal, dan editor Orca, lalu menambah satu seksi sidebar "Live Collab" plus panel. Kita tidak mendesain ulang Orca.

---

## 2. Token desain

### 2.1 Warna (dark default)

| Token | Hex | Pakai |
|---|---|---|
| `--bg` | `#0E0E10` | latar app |
| `--surface-1` | `#161616` | panel, sidebar (Carbon gray 100) |
| `--surface-2` | `#1E1E20` | kartu, input |
| `--surface-3` | `#262626` | hover, kartu terangkat (gray 90) |
| `--border` | `#2A2A2D` | garis 1 px |
| `--border-strong` | `#393939` | fokus lemah (gray 80) |
| `--text` | `#F4F4F4` | teks utama (gray 10) |
| `--text-muted` | `#A8A8A8` | label (gray 40) |
| `--text-faint` | `#6F6F6F` | timestamp, meta (gray 60) |
| `--accent` | `#0F62FE` | tombol utama, link (IBM Blue 60) |
| `--accent-soft` | `#A6C8FF` | teks di atas accent gelap, fokus ring (Blue 30) |
| `--ok` | `#42BE65` | status hijau (Green 40) |
| `--warn` | `#F1C21B` | status kuning (Yellow 30) |
| `--danger` | `#FA4D56` | blokir, near-miss (Red 50) |
| `--needs-you` | `#FF7EB6` | garis kartu "Needs you", border input aktif (Magenta 40, gema pink Amoeba) |

**Warna orang** (konsisten di semua layar, termasuk replay dan video):

| Anggota | Peran | Hex | Nama |
|---|---|---|---|
| A · Andi | coder (Bob IDE) | `#78A9FF` | Blue 40 |
| B · Budi | coder (Bob Shell di IBM Bob Live Collab) | `#BE95FF` | Purple 40 |
| C · Citra | PM + main agent `pm-lead` | `#FF832B` | Orange 40 |

Aturan: warna orang **hanya** dipakai untuk chip inisial, tag agent, garis kiri kartu, dan border terminal yang ditonton. Status tidak pernah memakai warna orang.

Mode terang (P2): tukar ke Carbon White theme. Tidak dikerjakan untuk demo.

### 2.2 Tipografi

| Peran | Font | Ukuran/leading | Catatan |
|---|---|---|---|
| UI | **IBM Plex Sans** 400/500/600 | 13/20, judul 15/22, H1 20/28 | fallback `Inter, system-ui` |
| Kode, path, terminal, meta | **IBM Plex Mono** 400/500 | 12/18 (terminal 13/18) | tag agent juga mono |
| Angka metrik | IBM Plex Mono 500 tabular | 24/28 | counter di replay dan cover |

Kedua font berlisensi OFL. Dibundel lokal di app lewat `@fontsource/ibm-plex-sans` dan `@fontsource/ibm-plex-mono`.

### 2.3 Spasi, radius, bayangan

- Grid 4 px. Padding panel 12–16. Jarak antar-kartu 8.
- Radius: kartu 10, chip/tag 6, tombol 8, jendela 12 (mengikuti Orca).
- Bayangan hampir nol. Pemisah memakai border 1 px `--border`, bukan shadow.
- Latar marketing/replay/cover: **pola titik halftone** (dot 2 px, jarak 12 px, opasitas 6–10%) seperti halaman Amoeba.

### 2.4 Ikon & motion

- Ikon: `lucide-react` (sudah dipakai Orca) ukuran 14/16, stroke 1.5.
- Motion: masuk kartu `translateY(4px)→0 + opacity`, 180 ms ease-out. Kartu keluar setelah disetujui: geser kanan + fade, 220 ms. Pulse "sedang ditulis": titik warna orang, opasitas 1→0.3, 900 ms, selama 3 s. Hormati `prefers-reduced-motion`.

---

## 3. Komponen inti (`radar/packages/ui`, dipakai di app & replay)

| Komponen | Isi | Keadaan |
|---|---|---|
| `AgentTag` | pill mono `Andi · Bob coder`, latar warna orang 18%, teks warna orang | `idle` / `writing` (titik pulse) / `blocked` (border merah) |
| `MemberChip` | lingkaran 20 px inisial + titik online | online / stale (kuning) / offline (abu) |
| `LockChip` | inisial pemegang di kanan baris file | `reserved` = outline · `held` = solid · `review` = solid + ikon jam · `queue:B` = chip kecil abu |
| `WritingPulse` | ✎ kecil berdenyut 3 s setelah `file.changed` | – |
| `BobTrace` | baris mono redup: `hook · PreToolUse · lock_guard → blocked · 84 ms` | ikon per primitif: hook ⚓︎, mcp ⧉, mode ◐ |
| `BriefMeter` | `hook · UserPromptSubmit · injecting team brief ━━━╸ 5/6 lines · 312 tok` | hijau bila ≤ 6 baris |
| `DecisionCard` | garis kiri `--needs-you`, judul `[blocked] Budi needs checkout.ts`, usulan main agent + alasan 1 kalimat, tombol **Approve** / **Deny** | pending / deciding (spinner) / approved (label "approved by Citra 21:07") / auto-applied |
| `ReviewCard` | ringkasan diff (+12 −3, 2 file), temuan dampak antar-file, verdict main agent, **Approve & commit** / **Send back** | – |
| `TaskCard` | `T-1 Kupon diskon`, chip pemilik, `3 files · 14 edits`, badge `waiting PM` | draft (pudar) / working / review / done (sha) |
| `FeedItem` | `21:06` + titik warna aktor + teks + `BobTrace` opsional | edit / blocked / decision / commit |
| `TerminalFrame` | bingkai xterm read-only, border 1 px warna pemilik, header `Watching Andi's Bob · coder · live` | live / paused / host stopped sharing |
| `GuestCursor` | pill nama kecil di posisi kursor terminal (bonus) | – |
| `PresenceStack` | tumpukan avatar di header | – |

---

## 4. Tempat Live Collab di dalam Orca (peta integrasi)

| Bagian Orca | Perubahan | File (prefix `orca:` = root repo) |
|---|---|---|
| Daftar agent | Tambah `bob` (label "IBM Bob", cmd `bob`, homepage bob.ibm.com, glyph "B" generik, **bukan** logo IBM) | `orca:src/shared/tui-agent.ts`, `orca:src/shared/tui-agent-config.ts`, `orca:src/renderer/src/lib/agent-catalog.tsx`, `orca:src/renderer/src/lib/agent-icon-glyphs.tsx` |
| Sidebar kiri | Seksi baru **Live Collab** di bawah "Agent Dashboard": `Mission Control`, `Team`, `Files & locks` + badge jumlah "Needs you" | `orca:src/renderer/src/components/radar/RadarSidebarSection.tsx` (+ 1 baris di komponen sidebar Orca) |
| Tab/pane utama | View baru `radar:mission-control`, `radar:watch/<member>/<term>` dibuka seperti tab | `orca:src/renderer/src/components/radar/*` |
| Terminal | Tombol kecil **Share** di header tab terminal agent `bob` → tap output xterm | titik tap ditemukan di Bob slice C1 (cari tempat renderer memanggil `term.write`) |
| Settings | Pane **Live Collab**: kode undangan / URL server + token, status sync agent, cek `bob` CLI, hook, MCP | `orca:src/renderer/src/components/radar/RadarSettingsPane.tsx` |
| Status bar bawah | `● Live Collab · 3 online · 1 needs you` + Bobcoin tersisa (manual input/perkiraan) | 1 item status bar |
| Main process | Menjalankan `radar` sync agent sebagai child process untuk workspace aktif | `orca:src/main/radar/sync-supervisor.ts` |
| Agent Dashboard Orca | Dibiarkan. Bucket "Needs you" Orca untuk Bob terisi otomatis kalau hook status Orca untuk `bob` sempat dibuat (P1) | `orca:src/main/bob/hook-service.ts` (P1) |

State: `orca:src/renderer/src/store/radar-store.ts` (zustand) memakai `applyEvent` dari `@radar/common`. Ini reducer yang sama dengan replay. `@radar/common` dan `@radar/ui` diimpor lewat alias Vite ke `radar/packages/*/src`.

---

## 5. Layar

Semua ukuran dirancang untuk 1512×982 (MacBook 14") dan tetap rapi di 1920×1080 untuk rekaman.

### 5.1 Home — Workspaces (mirip "Sessions" Amoeba)

```text
┌ sidebar ─────────┬───────────────────────────────────────────────────────────────┐
│ ◧ Workspaces     │ Workspaces                          [Last active ▾] [⌕] [+ New]│
│ ☺ People         │ ┌──────────────────────────────┐ ┌──────────────────────────┐ │
│ ── Live Collab ──      │ │ toko-demo                ··· │ │ live-collab (dogfood)  ··· │ │
│ ◎ Mission Ctrl 1 │ │ Kupon + dark mode            │ │ Building Live Collab with Live Collab│ │
│ ▦ Team           │ │ ┃⚠ Needs you · 1 near-miss   │ │ ○ Working · 2 Bobs       │ │
│ ▤ Files & locks  │ │ ◐ IBM Bob · coder×2 · pm-lead│ │ ◐ IBM Bob · coder        │ │
│                  │ │ (A)(B)(C)        live · 3/3  │ │ (A)(C)        idle 4m    │ │
│ Projects …(Orca) │ └──────────────────────────────┘ └──────────────────────────┘ │
│ (A) Aarief ⚙     │                                                               │
└──────────────────┴───────────────────────────────────────────────────────────────┘
```

### 5.2 Workspace — tampilan coder (Budi, Bob Shell di dalam app)

```text
┌──────────┬─ EXPLORER ────────┬─ checkout.ts ─────────────────────────┬─ TEAM ───────────────┐
│ sidebar  │ src/              │ 12  export function calculateTotal(   │ (C) Citra · PM       │
│          │  checkout/        │ 13    items: Item[], shipping = 0) {  │  ◐ pm-lead  idle     │
│          │   checkout.ts ✎(A)│ 14    const sub = sum(items…)  [Andi · Bob coder]│ (A) Andi   │
│          │   coupon.ts   (A) │ 15    return applyCoupon(sub…)        │  ◐ coder  writing ✎  │
│          │  ui/              │                                       │  T-1 Kupon · 3 files │
│          │   theme.css   (B)●│                                       │  [Watch terminal]    │
│          │   Header.tsx  (B)○│                                       │ (B) Budi (you)       │
│          │  routes.ts (A) q:B│                                       │  ◐ coder  blocked    │
│          │  utils.ts    free │                                       │  T-2 Dark mode       │
│          ├───────────────────┴─ AGENT · TERMINAL (bob) ──────────────┤ ─ NOTIFICATIONS ─    │
│          │ > ubah checkout.ts untuk toggle tema                      │ ⛔ checkout.ts held   │
│          │ ⚓ hook · PreToolUse · lock_guard → blocked · 84 ms          │   by Andi (T-1)      │
│          │ ⧉ mcp · radar.why_blocked                                   │ ✓ Plan approved      │
│          │ Bob: checkout.ts sedang dipegang Bob milik Andi untuk T-1   │                      │
│          │ (kupon). Saya lanjut ke Header.tsx dulu.                    │                      │
│          │ ⚓ hook · UserPromptSubmit · brief ━━━╸ 4/6 lines            │                      │
└──────────┴────────────────────────────────────────────────────────────┴──────────────────────┘
```

- Explorer: `LockChip` di kanan setiap file. File milik saya = solid, milik rekan = outline berwarna pemilik. `✎` = sedang ditulis.
- Editor: saat file berubah karena Bob rekan, baris yang berubah diberi `AgentTag` selama 3 s (P1, dekorasi Monaco).
- Terminal: Bob Shell (`bob`) di terminal Orca. `BobTrace` dicetak oleh hook/brief ke stdout sehingga terlihat di terminal.

### 5.3 Mission Control — tampilan PM (Citra)

```text
┌ Mission Control · toko-demo    ● live · 3/3 online    (A)(B)(C)    Bobcoin A 31 · B 28 · C 22 ┐
├─ TASKS ────────────────────┬─ FILES & LOCKS ──────────┬─ NEEDS YOU (2) ───────────────────────┤
│ Working        Review      │ src/checkout/            │ ┃ [blocked] Budi needs checkout.ts     │
│ ┌T-1 Kupon──┐ ┌T-0 Ongkir┐ │  checkout.ts ✎  (A)      │ ┃ held by Andi · T-1 Kupon             │
│ │(A) 3 files│ │(A) wait PM│ │  coupon.ts      (A)      │ ┃ ◐ pm-lead suggests: QUEUE Budi after │
│ │14 edits   │ └───────────┘ │ src/ui/                  │ ┃ T-1; continue Header.tsx meanwhile.  │
│ └───────────┘ Done          │  theme.css ✎    (B)      │ ┃ [ Approve ]  [ Deny ]                │
│ ┌T-2 Dark──┐ ┌T-00 Schema┐ │  Header.tsx     (B)      │ ┃ [review] T-0 Ongkir · +12 −3 · 2 files│
│ │(B) 2 files│ │(B) 3f9a2c1│ │ src/                     │ ┃ ⚠ calculateTotal() signature changed; │
│ └───────────┘ └───────────┘ │  routes.ts (A) queue:B   │ ┃ used by Header.tsx (Budi).           │
│                             │  utils.ts        free    │ ┃ [ Approve & commit ] [ Send back ]   │
│                             │                          ├─ LIVE ───────────────────────────────┤
│ [Ask pm-lead to plan…]      │                          │ 21:06 ● Andi's Bob edited checkout.ts│
│                             │                          │ 21:06 ● Budi's Bob blocked ⚓ PreTool │
│                             │                          │ 21:05 ● Budi's Bob edited theme.css  │
└─────────────────────────────┴──────────────────────────┴──────────────────────────────────────┘
```

Tombol **Approve** memanggil endpoint khusus Mission Control. Main agent tidak punya tool untuk menyetujui usulannya sendiri, dan kartu menampilkan teks kecil "suggested by pm-lead · approved by Citra (human)".

### 5.4 Momen near-miss (adegan utama video)

Urutan yang harus terasa dalam ±3 detik:
1. Di terminal Budi: `⚓ hook · PreToolUse · lock_guard → blocked`. Barisnya merah redup.
2. Bob Budi menjelaskan sendiri dalam 1–2 kalimat (dari `radar.why_blocked`).
3. Di Mission Control Citra: `DecisionCard` masuk dari atas dengan garis magenta. Badge sidebar "Needs you 1".
4. Citra klik **Approve**. Kartu keluar ke kanan, `LockChip` routes/checkout menampilkan `queue:B`, dan feed hijau "decision approved".
5. Di prompt Budi berikutnya: `⚓ hook · UserPromptSubmit · brief` menyisipkan "Kamu antre checkout.ts setelah T-1".

### 5.5 Review & commit

`ReviewCard` memakai `diff` ringkas (hanya hunk yang berubah), bagian **Impact** ("`calculateTotal()` now takes `shipping`; called in `Header.tsx` owned by Budi"), verdict main agent, dan tombol **Approve & commit**. Setelah commit: toast `✓ 3f9a2c1 · T-0 Ongkir · co-authored by IBM Bob` dengan link GitHub.

### 5.6 Tonton terminal Bob rekan (P0)

```text
┌─ Watching Andi's Bob · coder · live ─────────────────────── (A) ─ [Stop watching] ┐
│ ▌border 1px #78A9FF                                                               │
│ > tambahkan kupon diskon di checkout                                              │
│ ⚓ hook · SessionStart · brief 5/6 lines                                           │
│ Bob: Saya ambil T-1. File saya: checkout.ts, coupon.ts, routes.ts.                │
│ ⚓ hook · PreToolUse · lock_guard → allowed (held by T-1) · 61 ms                  │
│ ✎ write_file src/checkout/coupon.ts                                               │
│ …                                                                                 │
│ ─ read-only · Andi shares this terminal · 2 watching (B)(C) ─ [Ask to type] ─────  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Dibuka dari tombol **Watch terminal** di panel Team. Host melihat indikator `👁 2 watching` di header tab terminalnya.

### 5.7 Ikut mengetik sebagai tamu (bonus)

Tombol **Ask to type** memunculkan toast di laptop host: "Budi wants to type in your Bob terminal · [Allow 10 min] [Deny]". Saat diizinkan, `GuestCursor` "Budi" (ungu) tampil di baris input, dan footer berubah menjadi `Budi is typing · uses Andi's Bobcoin`.

### 5.8 Replay web untuk juri (`/demo`)

- Header: `IBM Bob Live Collab — session replay` · badge `no login · no API key` · link Repo · bob_sessions · Video · Deck.
- Tiga kolom: **Andi (Bob IDE)** | **Mission Control (Citra)** | **Budi (Bob Shell in Live Collab)**. Setiap kolom coder menampilkan cuplikan terminal hasil rekaman (`term.frame`) yang diputar ulang.
- Timeline bawah: chapter `Plan · Live · Near-miss · Review · Commit`, kecepatan 1×/2×/4×, autoplay 2×.
- Panel kanan **Bob inside** (pembeda juri): setiap event yang diklik menampilkan primitif Bob yang bekerja (hook mana, payload ringkas, tool MCP, mode), kutipan dari `bob_sessions/…` dan link ke file sesinya.
- Counter di atas: `near-misses prevented 3 · merge conflicts 0 · decisions 4 · median decision 38 s`.

### 5.9 Onboarding / join (ala Mosaic install)

Langkah di app baru: **Paste invite** → **Choose folder** → checklist live:
`✓ Bob CLI found (bob 2.x)` · `✓ .bob kit installed (modes: coder)` · `✓ hooks registered (4)` · `✓ radar-mcp reachable` · `✓ synced 42 files` · `✓ you are Budi · coder`.
Kalau ada item merah, tampilkan satu kalimat perbaikan dan tombol **Retry**.

### 5.11 Landing web (Application URL): gaya "warm paper" ala Notion

Landing sengaja **terang dan hangat**, berbeda dari app yang gelap. Tujuannya supaya juri yang membuka URL langsung merasa ini produk jadi. Screenshot app yang gelap tampil di dalamnya sebagai mockup produk. Spesifikasi lengkap ada di [`UI Inspo & Design/landing-style/README.md`](UI%20Inspo%20%26%20Design/landing-style/README.md) (turunan style reference Refero untuk notion.com).

- Kanvas `#f6f5f4`, kartu putih dengan border 1px `rgba(0,0,0,.08)`, tanpa shadow, radius 12.
- Satu tombol biru `#0075de` (**Watch the live replay**) dan satu tombol ghost (**Download for macOS**, dengan catatan kecil "unsigned · right-click → Open").
- Headline 72px dengan tracking negatif dan **pill highlight** di satu kata kerja. Subhead serif (Source Serif 4). Font Inter.
- Blok aksen marigold untuk GIF near-miss, dan satu "dark island" `#02093a` untuk "Built on IBM Bob primitives".
- **Jangan** meniru merek Notion: tanpa logo, nama, ilustrasi karakter, atau font proprietary mereka.
- Footer "Community hackathon project, not an official IBM product · built on Orca (MIT)".

Replay `/demo` tetap gelap seperti app (§5.8), karena menampilkan produk yang sedang berjalan.

### 5.10 Cover 16:9 / slide 1

Latar `--bg` dengan pola titik. Di kiri judul **IBM Bob Live Collab** (Plex Sans 600) dan tagline "Multiplayer IBM Bob. Every teammate's Bob, one live workspace." Di kanan tangkapan Mission Control yang dimiringkan sedikit (tanpa perspektif berlebihan), dengan satu `DecisionCard` near-miss menonjol. Di bawah: tiga `AgentTag`.

---

## 6. Copy & bahasa

- UI app: **Bahasa Inggris** (juri internasional). Brief dan pesan blokir untuk Bob: Bahasa Indonesia **atau** Inggris sesuai `RADAR_LANG` (default `en` untuk demo, supaya juri paham).
- Kata kunci konsisten: *held / reserved / queue / free*, *Needs you*, *near-miss*, *Approve / Deny / Send back*.
- Setiap teks yang ditulis Bob diawali nama Bob-nya (`Andi's Bob`), bukan "AI".

## 7. Aksesibilitas

Kontras AA (teks utama ≥ 7:1 di `--bg`). Fokus ring 2 px `--accent-soft`. Warna tidak pernah satu-satunya penanda: selalu ada ikon atau teks. Feed memakai `aria-live="polite"`. Semua tombol di kartu keputusan bisa dipakai lewat keyboard (`Enter` = Approve, `Esc` = tutup).

## 8. Aset yang harus dihasilkan (fase 09/11/14)

| Aset | Ukuran | Sumber |
|---|---|---|
| Ikon app `IBM Bob Live Collab` | 1024 px `.icns` | lingkaran radar minimal + huruf B, generik (lihat `prompt_ui.md` #11) |
| Glyph agent "IBM Bob" di Orca | 16/20 px SVG | huruf **B** dalam kotak rounded, bukan logo IBM |
| Screenshot cover | 1920×1080 | layar 5.3 dengan data demo |
| GIF README | 1280×720, ≤ 8 MB | momen near-miss 5.4 |
