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
| – | [`UI Inspo & Design/`](UI%20Inspo%20%26%20Design) | Inspirasi (Orca, Amoeba, Mosaic) + mockup Stitch. **Hanya pedoman**, gaya app mengikuti Orca (DESIGN.md §0). | Lane C |
| – | `app/` | Kode app desktop = Orca (stablyai/orca@bf40d35, MIT). Node 24 + pnpm 12: `pnpm -C app install && pnpm -C app dev` | Lane C |
| – | `.claude/` | Skill & agent bersama: `live-collab-app`, `electron-automation`, `electron-pro` (PLAN.md §11) | semua |
| – | [`arsip/`](arsip/README.md) | Dokumen lama (v0.1, v0.2, riset ide, roast). Hanya referensi. | – |

## Mulai kerja dalam 3 langkah (per orang)

1. Baca `PLAN.md` §2 (lane kamu) dan §5 (jadwal).
2. Pasang Node 24 + pnpm 12 dan plugin di PLAN.md §11 (minimal ECC: `/plugin marketplace add https://github.com/affaan-m/ECC` lalu `/plugin install ecc@ecc`).
3. Salin prompt dari `plan/PROMPT.md`, ubah `LANE` dan `FASE`, lalu tempel ke Claude Code.

Repo ini = `github.com/umarmuhdhor/IBM` (**publik**). Jangan commit secret.
