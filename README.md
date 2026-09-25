# IBM Bob Live Collab — ruang kerja perencanaan

> Multiplayer untuk IBM Bob: setiap anggota memakai akun Bob sendiri, tapi semua bekerja di satu workspace live seperti Google Docs. Dikirim sebagai app desktop macOS (fork [Orca](https://github.com/stablyai/orca)).
> IBM Bob 2.0 Hackathon (lablab.ai) · Jum 25 Sep 23:00 → Min 27 Sep 23:00 WITA · community project, bukan produk resmi IBM.

## Baca dengan urutan ini

| # | File | Isi | Untuk siapa |
|---|---|---|---|
| 1 | [`PLAN.md`](PLAN.md) | **Mulai di sini.** Feasibility, 3 lane, branch, cara jalan dengan ECC, jadwal, bukti Bob, Bobcoin | semua (kirim ke teman) |
| 2 | [`PRD.md`](PRD.md) | Produk: masalah, requirement (P0/P1), arsitektur, API, naskah video ≤ 3 menit, risiko | semua |
| 3 | [`DESIGN.md`](DESIGN.md) | Desain: token warna, font, komponen, wireframe tiap layar, peta integrasi Orca | Lane C, juga A/B untuk UI |
| 4 | [`prompt_ui.md`](prompt_ui.md) | Prompt generate gambar mockup (11 layar) | Aarief |
| 5 | [`plan/`](plan/README.md) | Detail teknis per fase + satu prompt eksekusi (`plan/PROMPT.md`) + kontrak `plan/ref/` | AI masing-masing lane |
| – | [`arsip/`](arsip/README.md) | Dokumen lama (v0.1, v0.2, riset ide, roast). Hanya referensi. | – |

## Mulai kerja dalam 3 langkah (per orang)

1. Baca `PLAN.md` §2 (lane kamu) dan §5 (jadwal).
2. Pasang ECC di Claude Code: `/plugin marketplace add https://github.com/affaan-m/ECC` lalu `/plugin install ecc@ecc`.
3. Salin prompt dari `plan/PROMPT.md`, ubah `LANE` dan `FASE`, lalu tempel ke Claude Code.

Setelah fase 00, semua file ini pindah ke repo `ibm-bob-live-collab` di folder `radar/`.
