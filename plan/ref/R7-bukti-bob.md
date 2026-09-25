# R7 — Protokol bukti IBM Bob

> Wajib juri. Diturunkan dari halaman submission lablab: *"Your repository must include the code/files where IBM Bob assisted, plus IBM Bob task session summary screenshots from each team member."* Ditambah **IBM Bob Usage Statement ≤ 500 kata** di form submission.
> Langkah resmi screenshot ada di hackathon guide 2.0 yang dirilis saat kickoff. Kalau berbeda dari langkah di bawah, **guide resmi yang menang**. Perbedaannya dicatat di DECISIONS (D-umar-..).

## 1. Apa yang harus ada di repo

| Artefak | Lokasi | Siapa | Cek |
|---|---|---|---|
| Screenshot ringkasan task (panel konsumsi/summary) | `bob_sessions/<nama>/<NN-slug>/summary.png` | **setiap** anggota, ≥ 3 slice per orang | `evidence:check` |
| Ekspor riwayat task (markdown) | `bob_sessions/<nama>/<NN-slug>/task.md` | setiap anggota | `evidence:check` |
| Indeks | `bob_sessions/INDEX.md` (tabel: folder · anggota · lane/fase · tanggal · ringkasan · file yang dibangun Bob · Bobcoin) | Lane Umar merapikan | manual |
| Kode yang dibantu Bob | commit dengan trailer `Bob-Assisted: bob_sessions/<nama>/<NN-slug>` | pemilik slice | `evidence:check` |
| Narasi | `BOB_DEVELOPMENT.md` + IBM Bob Usage Statement di `docs/SUBMISSION.md` | Lane Umar | ≤ 500 kata untuk statement |

`<nama>` = nama depan huruf kecil: `alief`, `umar`, `aarief`, `imelda`. **Keempat anggota** wajib punya screenshot dan ekspor. `<NN-slug>` = nomor urut dua digit + slug, misalnya `01-orca-onboarding`, `02-register-bob-agent`.

## 2. Alur satu Bob slice (±5 menit overhead)

1. Agent Claude Code berhenti dan mencetak **BOB SLICE <id>**: mode Bob, prompt siap tempel, file yang diharapkan berubah.
2. Buka workspace yang sama di **Bob IDE** (akun hackathon kamu). Pilih mode yang disebut, lalu tempel prompt. Biarkan Bob bekerja. Koreksi lewat chat Bob, bukan edit manual, supaya kontribusinya tercatat.
3. Setelah selesai, buka **History → task tersebut → klik header task** sampai ringkasan konsumsi/summary tampil.
4. Jalankan:
   ```bash
   radar/scripts/bob-evidence.sh <nama> <NN-slug>
   ```
   Script ini:
   - membuat folder `bob_sessions/<nama>/<NN-slug>/`,
   - menjalankan `screencapture -i -o …/summary.png`. Tekan **Space** lalu klik jendela Bob IDE, atau seret area ringkasan,
   - meminta kamu menekan **Export task history** di Bob. Script menunggu (maks 120 s) sampai ada file `.md` baru di `~/Downloads`, lalu memindahkannya ke `…/task.md`. Opsi `--md <path>` tersedia kalau lokasi ekspornya lain,
   - menjalankan sensor sederhana: gagal kalau `task.md` memuat pola secret (`rdr_`, `ghp_`, `sk-`, `apikey`, `Bearer `). Kalau gagal, sensor manual dulu,
   - menambah baris ke `bob_sessions/INDEX.md`.
5. Balas "bob selesai" ke Claude Code. Agent me-review hasil Bob, menjalankan test, lalu commit dengan trailer `Bob-Assisted:`.

Kalau Claude Code mengubah hasil Bob, commit hasil Bob **dulu** (apa adanya, dengan trailer). Perbaikan masuk commit terpisah. Dengan begitu kontribusi Bob tetap terlihat di history.

## 3. `bob-evidence.sh` (spesifikasi, dibuat di Bob slice C4, fase 11)

```text
usage: bob-evidence.sh <nama> <NN-slug> [--md <path>] [--no-shot]
exit 0 = sukses, 1 = argumen salah, 2 = screenshot batal, 3 = md tidak ditemukan, 4 = sensor gagal
```
- Hanya macOS (`screencapture`). Linux: `--no-shot` + salin manual.
- Tidak pernah membaca `.env`/`.radar/`.
- Idempoten: kalau folder sudah ada, tanya sebelum menimpa.

## 4. `pnpm -C radar evidence:check` (fase 14)

Gagal kalau salah satu kondisi berikut terjadi:
- anggota di `plan/team.json` punya < 3 folder slice lengkap (`summary.png` + `task.md`),
- ada trailer `Bob-Assisted:` (dari `git log --all`) yang menunjuk ke folder yang tidak ada,
- `bob_sessions/INDEX.md` tidak mencantumkan salah satu folder,
- ada file di `bob_sessions/` yang cocok dengan pola `.gitignore` template (tidak ikut ter-commit).

## 5. Daftar Bob slice & anggaran

Daftar lengkap dan anggaran Bobcoin (40 per akun) ada di [`../../PLAN.md`](../../PLAN.md) §7. Aturan anggaran:
- Prompt Bob pendek dan spesifik file. Jangan minta Bob "baca seluruh repo Orca". Minta fokus ke `src/shared/` dan `src/renderer/src/lib/`.
- Pakai mode **Ask/Plan** untuk eksplorasi (lebih murah), dan **Code** hanya untuk menulis.
- Simpan ≥ 12 Bobcoin per akun untuk gladi + rekam demo (Minggu pagi).
- Catat Bobcoin yang terpakai per slice di INDEX (dari screenshot ringkasan).

## 6. Yang ditulis di IBM Bob Usage Statement (≤ 500 kata)

1. **Bob sebagai inti produk (runtime):** hook `PreToolUse` menegakkan kunci, hook `SessionStart`/`UserPromptSubmit` menyuntikkan brief tim, custom mode `coder` dan `pm-lead` membagi peran, MCP `radar-mcp` memberi Bob tool `why_blocked`/`propose_*`, dan `bob` jalan sebagai agent kelas satu di app.
2. **Bob sebagai pembangun:** daftar slice per anggota, termasuk onboarding codebase Orca (23k file) dengan Bob, kit `.bob/` yang ditulis di Bob IDE, dan komponen UI. Link ke `bob_sessions/INDEX.md`.
3. **Angka:** jumlah sesi, Bobcoin per anggota, file yang dibantu Bob (dari trailer).
4. **watsonx:** tidak dipakai. Tulis jujur "not used", atau sebutkan kalau tim memutuskan menambah Granite (tidak direncanakan).
