# Prompt eksekusi — satu prompt untuk semua fase (Claude Code + ECC)

## ⚡ Cara cepat: cukup satu kalimat (disarankan)

Buka Claude Code di root repo, lalu ketik **satu** kalimat sesuai namamu:

```text
Saya Alief. Kerjakan semua tugas lane saya secara otomatis sesuai CLAUDE.md dan plan/PROMPT.md (mode auto).
```
```text
Saya Umar. Kerjakan semua tugas lane saya secara otomatis sesuai CLAUDE.md dan plan/PROMPT.md (mode auto).
```
```text
Saya Aarief. Kerjakan semua tugas lane saya secara otomatis sesuai CLAUDE.md dan plan/PROMPT.md (mode auto).
```
```text
Saya Imelda. Kerjakan semua tugas lane saya secara otomatis sesuai CLAUDE.md dan plan/PROMPT.md (mode auto).
```

Pertama kali? Jalankan dulu **prompt perkenalan** di `README.md` (AI membaca repo dan menjelaskan tugasmu tanpa mengubah apa pun). Setelah itu kalimat di atas.

AI akan:
- menyiapkan branch lane-nya sendiri,
- memilih fase berikutnya yang belum selesai,
- mengerjakan fase itu sampai selesai, membuka PR ke `main`, lalu **langsung lanjut** ke fase berikutnya.

AI hanya berhenti untuk **BOB SLICE** (kamu kerjakan di Bob IDE), **LANGKAH MANUAL** (akun, rekaman), atau kalau konteks hampir habis. Untuk melanjutkan, ketik lagi kalimat yang sama.

---

## Cara manual (satu fase tertentu)

**Cara pakai:** salin seluruh blok di bawah, ubah **dua baris pertama** (`LANE`, `FASE`), lalu tempel ke Claude Code di **root repo `umarmuhdhor/IBM`** (folder `IBM/` ini).

Syarat: plugin ECC terpasang (`/plugin install ecc@ecc`, lihat [`../PLAN.md`](../PLAN.md) §4.1). Model per fase ada di `README.md` §3.

| Lane | Urutan fase |
|---|---|
| Alief · Core | `00 → 02 → 03 → 04 → 05 → 06 → 10 → 12 → 14` |
| Umar · Bob | `01 → 07 → 08 → 10 → 13 → 14` |
| Aarief · App desktop + `@radar/ui` | `09 → 11 (A, B, C, E) → 10 → 14` (09a/b boleh mulai sebelum 02, memakai mock) |
| Imelda · web & media | `11 (D) → 10 → 14` (boleh mulai setelah fase 00, memakai data fixture) |
| Solo | `00 → 01 → … → 14` |

Alternatif tanpa salin-tempel: ubah dua baris di file ini, lalu ketik ke Claude Code: `Jalankan instruksi di plan/PROMPT.md`.

---

```text
LANE: Aarief        # Alief | Umar | Aarief | Imelda
FASE: auto          # auto = kerjakan semua fase lane berurutan tanpa berhenti; atau nomor fase, mis. 09

<peran>
Kamu senior engineer (TypeScript, Node 24, Cloudflare Workers/Durable Objects, Electron/React) yang mengeksekusi rencana pembangunan
"IBM Bob Live Collab" (codename teknis: radar) untuk IBM Bob 2.0 Hackathon. Kamu bekerja memakai
plugin ECC (Everything Claude Code): agent planner, tdd-guide, code-reviewer, typescript-reviewer,
security-reviewer, build-error-resolver, serta skill tdd-workflow dan verification-loop.
Laporan dalam Bahasa Indonesia. Kode, nama file, komentar: Bahasa Inggris.
</peran>

<konteks>
- Produk: PRD.md. Rencana tim: PLAN.md. Desain: DESIGN.md. Detail fase: plan/ (setelah fase 00:
  plan/). Status: plan/PROGRESS.md. Keputusan: plan/log/DECISIONS.md.
- Kontrak wajib: plan/ref/R1..R7. R7 = protokol bukti IBM Bob.
- Repo umarmuhdhor/IBM. Orca (Electron) ada di folder app/. Path "orca:" = relatif ke app/
  (orca:src/shared/tui-agent.ts = app/src/shared/tui-agent.ts). Dokumen dan plan/ di root.
  Path kode lain tanpa prefix (packages/, scripts/, docs/, bob-kit/) = relatif ke radar/.
- Toolchain: Node 24 + pnpm 12. Jalankan `nvm use 24` sebelum perintah pnpm.
  Selalu pakai `pnpm -C app …` atau `pnpm -C radar …`.
- Skill wajib per lane (PLAN.md §11), dimuat OTOMATIS tanpa diminta:
  · Alief: plugin `cloudflare` (skill durable-objects, workers-best-practices, wrangler).
  · Umar: `mcp-server-dev`, ECC `mcp-server-patterns`.
  · Aarief: `live-collab-app`, `electron-automation`, agent `electron-pro`, `apple-design`,
    `emil-design-eng`, `review-animations`, `better-interface`.
  · Imelda: `apple-design`, `emil-design-eng`, `better-interface`, `frontend-design`; `brag-slim` untuk teaser.
  Semua lane: ECC (planner, tdd-workflow, code-reviewer, verification-loop).
- LANE menentukan folder yang BOLEH kamu ubah (PLAN.md §2). Jangan menyentuh folder lane lain.
  Kalau perlu, tulis "Catatan handoff" + entri DECISIONS ber-prefix lane (D-alief-.., D-umar-.., D-app-..).
</konteks>

<langkah>
1. TEMUKAN FASE.
   - Kalau user menulis "Saya <nama>", maka LANE = <nama> dan FASE = auto.
   - FASE = auto: ambil fase pertama milik LANE (tabel "Urutan fase" di atas) yang di plan/PROGRESS.md belum [x]
     dan tidak sedang dikerjakan orang lain.
   - FASE = nomor: cari plan/fase-<FASE>-*.md. Kalau tidak ada, berhenti dan tampilkan daftar fase.
   Pastikan fase ini milik LANE (tabel di plan/README.md §3). Kalau bukan, berhenti dan tanya user.

2. BACA berurutan: plan/README.md, plan/PROGRESS.md, plan/log/DECISIONS.md, file fase, lalu SEMUA
   "Bacaan wajib" di file fase. Kalau plan/log/fase-<FASE>.md sudah ada → mode LANJUT.
   Untuk LANE Aarief/Imelda: baca juga orca:AGENTS.md dan orca:CLAUDE.md dan patuhi aturannya.

3. BRANCH & PRASYARAT (otomatis, jangan minta user mengetik perintah git):
   a0. CEK GITHUB DULU (setiap mulai fase): `git fetch origin`, baca `origin/main:plan/PROGRESS.md`,
       lalu `gh pr list --state all --limit 30` untuk melihat apa yang sudah di-merge atau sedang di-PR
       oleh lane lain. Tentukan untuk setiap prasyarat lintas-lane: SUDAH ADA di main → pakai yang asli;
       BELUM ADA → pakai PLACEHOLDER (langkah b).
   a. `git fetch origin`. Kalau branch lane belum ada, buat dari origin/main:
      Alief → lane/core, Umar → lane/bob, Aarief → lane/app, Imelda → lane/web.
      Pindah ke branch itu (`git switch`). Sinkron dengan main HANYA lewat aturan langkah 13 (rebase --onto),
      jangan pernah `git merge origin/main` ke branch lane.
      Pengecualian: fase 00 (Lane Alief) dikerjakan langsung di main karena belum ada apa-apa untuk di-review.
      Fase 02 dikerjakan di lane/core seperti biasa; PR-nya = "kontrak beku" dan setelah di-merge semua lane
      rebase (langkah 13). Fase 10 dan 14 dikerjakan di branch lane masing-masing (PR kecil per perbaikan).
   b. Lane jalan MANDIRI. Kalau prasyarat dari lane lain belum di-merge ke main, JANGAN menunggu:
      pakai mock server / tipe sementara / data fixture (setiap fase menjelaskan caranya).
      SETIAP placeholder WAJIB diberi penanda yang bisa dicari:
        `// TODO(sync:<lane-pemilik>): <apa yang diganti> — ganti setelah <fase/PR> masuk main`
        contoh: `// TODO(sync:alief): tipe BobActivity sementara, ganti dengan @radar/common setelah fase 02`
      Simpan placeholder di file sendiri kalau bisa (mis. `src/…/placeholder/*.ts`, `fixtures/*.json`)
      supaya gampang dihapus. Catat daftar placeholder di log fase (bagian "Placeholder aktif"). Pengecualian:
      prasyarat di lane SENDIRI harus selesai dulu (fase di dalam satu lane berurutan).
   c. Jangan membuat file di luar folder lane (PLAN.md §2). Kalau butuh kerangka `radar/` dari fase 00
      yang belum ada, buat paketmu sendiri sebagai paket mandiri di foldermu, dan rapikan setelah
      fase 00 masuk main.

4. RENCANAKAN dengan ECC. Panggil agent `planner` (padanan /ecc:plan) dengan isi "Langkah kerja" fase.
   Hasilnya daftar todo dan urutan test. Tulis ringkasannya (≤ 15 baris) ke log fase. Jangan menunggu
   konfirmasi user kecuali planner menemukan konflik dengan kontrak. Tandai PROGRESS.md [~] + jam
   mulai (WITA).

5. TEST DULU. Untuk setiap langkah yang menghasilkan kode, pakai skill `tdd-workflow`
   (agent `tdd-guide`): tulis test yang gagal dulu, lalu implementasi sampai hijau.
   Pengecualian: konfigurasi murni, dokumen, dan layout UI (UI cukup smoke test atau Playwright).

6. EKSEKUSI. Aturan:
   a. Ikuti kontrak plan/ref PERSIS. Perubahan kontrak hanya oleh LANE Alief. Lane lain mengusulkan
      lewat DECISIONS lalu berhenti di langkah itu.
   b. Hanya scope fase ini. Temuan lain → "Catatan handoff".
   c. P0 sebelum P1. P2 hanya kalau diminta file fase.
   d. Jangan menghapus atau melemahkan test supaya hijau.
   e. Tidak ada secret di file ter-commit. Nama file TIDAK BOLEH mengandung: token, secret,
      password, credentials, apikey/api-key/api_key, dan tidak boleh bernama config.json/config.yaml
      (akan diabaikan .gitignore template IBM, lihat R5 §8).
   f. Tidak ada perintah destruktif (rm -rf di luar folder build, reset history, push --force) tanpa izin
      eksplisit user. SATU pengecualian: `git push --force-with-lease origin lane/<lane-sendiri>` setelah
      rebase di langkah 13. Tidak pernah force ke main, ke branch PR orang lain, atau ke lane orang lain.
   g. Keputusan produk yang tidak dijawab PRD/plan: pilih opsi paling sederhana yang tetap memenuhi
      naskah video PRD §15, catat di DECISIONS, lanjutkan.
   h. Langkah yang butuh manusia (Bob IDE, 3 Mac, akun cloud, rekaman): siapkan semuanya, lalu
      tulis checklist bernomor "LANGKAH MANUAL" di log fase.

7. BOB SLICE (wajib kalau file fase punya bagian "Bob slice"). Lihat plan/ref/R7-bukti-bob.md.
   a. Siapkan semua konteks, lalu BERHENTI dan cetak blok berjudul "BOB SLICE <id>" berisi:
      mode Bob yang dipakai, prompt siap tempel untuk Bob IDE, file yang diharapkan berubah, dan
      perintah bukti: `radar/scripts/bob-evidence.sh <nama> <NN> <slug>`.
   b. Tunggu user menjawab "bob selesai". Setelah itu review hasil Bob dengan `code-reviewer`
      (perbaiki seperlunya, catat apa yang diubah dari hasil Bob), jalankan test, lalu commit
      dengan trailer `Bob-Assisted: bob_sessions/<png>`.
   c. Jangan menulis ulang seluruh hasil Bob. Bukti harus mencerminkan kontribusi Bob yang nyata.

8. REVIEW. Jalankan `code-reviewer` + `typescript-reviewer` (padanan /ecc:code-review) pada diff
   fase. Untuk fase 03 (auth, `bob/activity`), 05, 06 (PAT GitHub, commit), 07 (hook), 09 (token/koneksi), 11 (Watch Bob):
   jalankan juga `security-reviewer` (padanan /ecc:security-scan). Perbaiki temuan CRITICAL/HIGH.
   GERBANG UI (otomatis, wajib kalau diff menyentuh app/src/renderer/**, radar/packages/ui/** atau
   radar/packages/web/**):
   a. Ambil screenshot tampilan yang berubah: app → `electron-automation` atau Playwright
      `_electron.launch()`; web → Playwright (lebar 1440 dan 390).
   b. Jalankan skill `better-interface` pada screenshot + kode itu. Perbaiki semua temuan HIGH, lalu
      catat tabel temuannya di log fase.
   c. Kalau ada animasi: jalankan `review-animations`.
   d. Cek arah gaya: app & replay = gelap, mengikuti Orca (DESIGN.md §0). Landing = terang "warm paper"
      (DESIGN.md §5.11 + "UI Inspo & Design/landing-style/README.md").

9. VERIFIKASI. Pakai skill `verification-loop`: jalankan SEMUA perintah di bagian "Verifikasi" file
   fase. Kalau build atau typecheck merah → agent `build-error-resolver` (padanan /ecc:build-fix).
   Tempel ringkasan angka (test lulus/gagal, latensi) ke log. Cek setiap butir DoD dan beri bukti.

10. DOKUMENTASI. Tulis/perbarui plan/log/fase-<FASE>.md:
    Status · checklist langkah · file dibuat/diubah · hasil verifikasi · DoD + bukti · deviasi (+ link
    DECISIONS) · Bob slice yang dikerjakan (+ folder bob_sessions) · LANGKAH MANUAL · Catatan handoff.
    Perbarui baris fase ini saja di PROGRESS.md.

11. COMMIT & PR (setiap fase, kecuali fase 00 yang langsung di main).
    a. Commit "fase-<FASE>: <judul>" (konvensi R5 §3). Push branch lane.
    b. Tandai ujung fase secara lokal: `git tag -f lane-<lane>-f<FASE>` (dipakai rebase --onto di langkah 13).
    c. PR dari branch SNAPSHOT fase, bukan dari branch lane:
       `git push origin HEAD:refs/heads/lane/<lane>-f<FASE>` lalu
       `gh pr create --base main --head lane/<lane>-f<FASE>` (judul = pesan commit, isi = ringkasan log).
       Branch lane tetap dipakai untuk fase berikutnya, jadi commit fase berikutnya tidak ikut masuk PR ini.
    d. MERGE: pemilik lane squash-merge PR-nya sendiri setelah CI hijau
       (`gh pr merge <no> --squash --delete-branch`). Pengecualian: PR yang menyentuh `radar/packages/common/**`
       atau `plan/ref/**` butuh approve Alief dulu. Di mode auto, cek status PR fase sebelumnya di awal
       setiap fase (langkah 13); jangan menunggu CI di tempat.

12. SIMPAN SESI. Jalankan /ecc:save-session (atau padanannya) dengan nama "lane<LANE>-fase<FASE>".

13. LANJUT atau LAPOR.
    - FASE = auto: setelah PR fase ini dibuat, tulis ringkasan 3 baris, lalu KEMBALI ke langkah 1 untuk
      fase berikutnya milik lane. Berhenti hanya kalau: (a) BOB SLICE menunggu user, (b) LANGKAH MANUAL,
      (c) semua fase lane selesai, atau (d) konteks hampir habis (simpan log + /ecc:save-session dulu).
      Sebelum mulai fase baru, SINKRON:
      1) `git fetch origin`. Untuk PR fase milik lane yang CI-nya hijau dan belum di-merge → merge (langkah 11d).
      2) Untuk setiap fase NN milik lane yang PR-nya sudah di-merge sejak sinkron terakhir:
         `git rebase --onto origin/main lane-<lane>-fNN lane/<lane>` (hanya commit SETELAH fase NN yang
         dipindah ke atas main, karena isi fase NN sudah ada di main lewat squash), lalu
         `git push --force-with-lease origin lane/<lane>`.
      3) Kalau belum ada PR yang di-merge tapi main maju: tidak perlu rebase. Rebase hanya bila PR fase
         konflik; saat itu rebase branch snapshot `lane/<lane>-fNN` ke origin/main dan force-with-lease
         branch snapshot itu (milikmu sendiri).
      LALU RESOLVE PLACEHOLDER: `grep -rn "TODO(sync" app radar` → untuk setiap penanda yang prasyaratnya
      sekarang sudah ada di main, ganti placeholder dengan yang asli, jalankan test, commit
      "sync: replace <x> placeholder". Kalau bentuk aslinya beda dari placeholder, sesuaikan kodemu (bukan
      kontrak) dan catat di log.
    - FASE = nomor: laporan ringkas (maks 15 baris), baris terakhir PERSIS
      "Lanjut: LANE <x> · FASE <nomor berikutnya>", lalu berhenti.
</langkah>

<batasan>
- Jangan mengarang API Bob, Orca, atau ECC. Fakta Bob diambil dari docs/SPIKE_RESULTS.md dan
  DECISIONS. Fakta Orca dari kode Orca yang benar-benar kamu baca (sebutkan path:baris). Nama
  command ECC dari `/plugin list ecc@ecc` yang tercatat di DECISIONS. Yang belum pasti ditandai
  "BELUM DIVERIFIKASI".
- Di kode Orca: perubahan aditif. Jangan refactor, jangan ubah pty daemon, relay, atau mobile/.
  Jalankan `pnpm -C app tc` dan oxlint pada file yang diubah saja, bukan seluruh `pnpm lint`.
- Jangan menambah fitur di luar PRD. Jangan ganti stack R1 tanpa entri DECISIONS.
- Kalau konteks mau habis: simpan progres ke log fase dan /ecc:save-session dulu, baru berhenti.
</batasan>
```

---

## Tabel cepat

| Baris | Fase | Lane | Model | Bob slice |
|---|---|---|---|---|
| `FASE: 00` | Fondasi (fork Orca + `radar/`) | Alief | Sonnet 5 | A1 toko-demo |
| `FASE: 01` | Spike & GATE 1 | Umar | Sonnet 5 | B1 spike hook |
| `FASE: 02` | Common + mock (kontrak beku) | Alief | Sonnet 5 | – |
| `FASE: 03` | Server inti + `bob.activity` | Alief | Opus 5.5 | – |
| `FASE: 04` | Sync agent | Alief | Opus 5.5 | – |
| `FASE: 05` | Kunci, task, proposal | Alief | Opus 5.5 | A2 `checkWrite` |
| `FASE: 06` | Commit GitHub, diff, review (relay terminal P1) | Alief | Opus 5.5 | A3 formatter commit, A4 review |
| `FASE: 07` | Kit `.bob/` coder | Umar | Sonnet 5 · high | B2, B3, B4 |
| `FASE: 08` | Main agent `pm-lead` | Umar | Sonnet 5 · high | B4 (tool PM) |
| `FASE: 09` | App desktop (fork Orca) + `@radar/ui` | Aarief | Sonnet 5 · high (Opus untuk titik sambung Orca) | C1, C2, C3 |
| `FASE: 10` | Integrasi E2E | Semua | Opus 5.5 | – |
| `FASE: 11` | Watch Bob (aktivitas Bob IDE), `.dmg` (Aarief) · landing + replay (Imelda) | Aarief · Imelda | Sonnet 5 · high | C4 `evidence-check.ts`, I1, I2 |
| `FASE: 12` | Hardening P1 | Alief | Sonnet 5 | – |
| `FASE: 13` | Eksperimen A/B | Umar | Sonnet 5 | (sesi eksperimen) |
| `FASE: 14` | Submission | Semua | Sonnet 5 | – |
