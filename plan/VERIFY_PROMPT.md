# Master prompt: verifikasi seluruh plan (read-only)

Tempel blok di bawah ke AI mana pun (Claude Code, Codex, Bob IDE mode Ask, dll.) di root repo `umarmuhdhor/IBM`.

```text
<peran>
Kamu reviewer teknis independen untuk proyek hackathon "IBM Bob Live Collab" (tim UAAI, IBM Bob 2.0 Hackathon,
lablab.ai, 25–27 Sep 2026). Tugasmu MEMBACA, MEMAHAMI, dan MEMVERIFIKASI seluruh rencana. Jangan mengubah,
membuat, atau menghapus file apa pun. Jangan commit. Jangan menjalankan build atau install. Jawab dalam Bahasa Indonesia.
</peran>

<bacaan>
Baca berurutan dan lengkap:
1. README.md, CLAUDE.md, AGENTS.md
2. PLAN.md, ARCHITECTURE.md
3. PRD.md (seluruhnya), DESIGN.md, prompt_ui.md, DATA_SOURCES.md
4. plan/README.md, plan/PROMPT.md, plan/PROGRESS.md
5. plan/log/DECISIONS.md. Keputusan yang lebih baru (D-001 … D-005) MENGALAHKAN teks lama yang bertentangan.
6. plan/fase-00 … plan/fase-14 (semua)
7. plan/ref/R1 … R7 (semua)
8. .claude/skills/live-collab-app/SKILL.md, "UI Inspo & Design/landing-style/README.md", media-references/README.md
9. Skim: app/AGENTS.md, app/CLAUDE.md, app/package.json (bagian scripts). app/ adalah salinan Orca (Electron, MIT).
Abaikan folder arsip/ (dokumen lama) kecuali untuk memahami sejarah.

Aturan resmi dari luar (baca bila bisa diakses):
- Hackathon guide: https://lablab-ibm-bob-2-hackathon-guide.s3.us.cloud-object-storage.appdomain.cloud/index.html
- Bob IDE lifecycle hooks: https://bob.ibm.com/docs/ide/configuration/lifecycle-hooks
</bacaan>

<yang_diverifikasi>
A. PEMAHAMAN. Ringkas dengan kata-katamu sendiri: produknya apa, arsitekturnya (Bob IDE + kit .bob/ +
   app Orca + server Cloudflare Workers/Durable Objects + web Cloudflare Pages), 4 lane (Alief, Umar, Aarief, Imelda)
   beserta fase masing-masing, dan alur demo video ≤ 3 menit.
B. KONSISTENSI antar-dokumen. Cari kontradiksi atau sisa versi lama, misalnya:
   - nama produk/tim (IBM Bob Live Collab, UAAI) · nama lane dan pemilik · branch (lane/core, lane/bob, lane/app, lane/web)
   - stack server (Cloudflare, bukan Fastify/Railway/Vercel/Fly) · web di Cloudflare Pages
   - Bob IDE sebagai inti (bukan Bob Shell) · "tonton Bob rekan" = stream aktivitas hook (P0), terminal = P1
   - path `orca:` = app/ · perintah `pnpm -C app|radar` · Node 24 + pnpm 12
   - penamaan bukti `bob_sessions/uaai_<nama>_task<NN>_<slug>_summary.png` · video ≤ 3 menit · statement ≤ 500 kata
   - nomor requirement (SY, SV, BC, MA, UI, DA, JT, IN, EV, NFR) yang dirujuk tapi tidak didefinisikan, atau sebaliknya
C. KEPATUHAN guide hackathon: Bob IDE komponen inti, screenshot ringkasan task dari SETIAP anggota, format/penamaan PNG,
   40 Bobcoin per akun, aturan data, deliverable form (title, deskripsi, 2 statement, repo publik, video, deck, cover, URL).
D. KELAYAKAN TEKNIS 48 jam: hook Bob IDE (blokir exit 2, stdout ke konteks), WebSocket Hibernation + SQLite Durable Object,
   commit lewat GitHub REST API, fork Orca + build .dmg (resep di fase 11), stream aktivitas Bob, kuota Workers Free.
   Tandai asumsi yang belum terbukti dan apakah spike (fase 01) sudah mengujinya.
E. KEMANDIRIAN LANE: bisakah tiap lane jalan paralel dengan placeholder `TODO(sync:…)`? Apakah ada ketergantungan
   tersembunyi yang membuat satu lane terpaksa menunggu? Apakah kontrak (R2/R3/R4) cukup lengkap untuk mock?
F. EKSEKUSI OTOMATIS: apakah plan/PROMPT.md mode auto + CLAUDE.md cukup jelas agar AI bisa bekerja tanpa manusia
   (branch, PR, rebase, Bob slice, gerbang UI, bukti Bob)? Sebutkan instruksi yang ambigu atau kurang.
G. JADWAL: realistis untuk 4 orang dalam 48 jam (termasuk jam tidur)? Titik rawan di mana?
H. KEAMANAN & REPO PUBLIK: token/secret, .gitignore template IBM (nama file terlarang), share prompt/aktivitas.
</yang_diverifikasi>

<format_jawaban>
1. Ringkasan pemahaman dalam poin (maks 12 poin).
2. Verdict: SIAP / SIAP DENGAN CATATAN / BELUM SIAP, plus alasan satu kalimat.
3. Daftar temuan dalam bentuk poin (JANGAN pakai tabel), diurutkan dari yang paling parah. Format tiap poin:
   - [KRITIS|TINGGI|SEDANG|RENDAH] file § bagian: masalah → usulan perbaikan
   Maks 25 poin. Setiap temuan harus menyebut file dan bagian yang spesifik. Jangan menebak.
4. Kontradiksi antar-dokumen, satu poin per pasangan file yang bertentangan.
5. Lima risiko terbesar untuk demo dan penjurian, satu poin per risiko + mitigasinya.
6. Pertanyaan yang harus dijawab tim sebelum kickoff (maks 8).
Semua jawaban berupa poin (bullet), tanpa tabel. Kalau suatu bagian tidak bisa diverifikasi (mis. URL tidak bisa dibuka), katakan terus terang.
</format_jawaban>
```
