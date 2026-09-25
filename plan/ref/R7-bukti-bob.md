# R7 — Protokol bukti IBM Bob

> Wajib juri. Diturunkan dari halaman submission lablab: *"Your repository must include the code/files where IBM Bob assisted, plus IBM Bob task session summary screenshots from each team member."* Ditambah **IBM Bob Usage Statement ≤ 500 kata** di form submission.
> Langkah resmi screenshot ada di hackathon guide 2.0 yang dirilis saat kickoff. Kalau berbeda dari langkah di bawah, **guide resmi yang menang**. Perbedaannya dicatat di DECISIONS (D-umar-..).

## 1. Aturan resmi (hackathon guide 2.0) dan penamaan

Dari guide resmi: *setiap peserta* wajib mengunggah **screenshot ringkasan task session Bob IDE** untuk **semua task yang terkait submission** ke folder `bob_sessions` di repo. Format PNG, dengan nama jelas berisi **nama tim, nomor task, deskripsi singkat**. Contoh resmi: `teamalpha_task01_login_flow_summary.png`.

Cara membuka ringkasan di Bob IDE: chat → **Tasks** → pilih task (pilih **All** kalau task tersebar di beberapa workspace) → klik **header task** → muncul *task session consumption summary* → screenshot.

**Konvensi kita** (flat, langsung di `bob_sessions/`, supaya sesuai contoh resmi):

```text
bob_sessions/
├── uaai_aarief_task01_orca_onboarding_summary.png
├── uaai_aarief_task01_orca_onboarding.md          ← ekspor riwayat task (opsional tapi disarankan)
├── uaai_umar_task01_spike_hooks_summary.png
├── …
└── INDEX.md                                             ← tabel semua task
```
Pola: `<tim>_<nama>_task<NN>_<slug_pakai_underscore>_summary.png`. `<tim>` = `uaai` (nama tim resmi di lablab) (ganti di `plan/team.json` kalau nama tim resmi di lablab berbeda). `<nama>` ∈ `alief`, `umar`, `aarief`, `imelda`. `NN` dihitung per orang.

| Artefak | Wajib? | Cek |
|---|---|---|
| Screenshot ringkasan task (PNG) untuk **setiap task Bob IDE terkait submission**, dari **keempat** anggota | **wajib** | `evidence:check` |
| Ekspor riwayat task (`.md`) dengan nama yang sama tanpa `_summary.png` | disarankan | `evidence:check` (peringatan saja) |
| `bob_sessions/INDEX.md`: file · anggota · lane/fase · tanggal · ringkasan · file kode yang dibantu Bob · Bobcoin | wajib (dari kita) | manual |
| Commit kode hasil Bob dengan trailer `Bob-Assisted: bob_sessions/<nama file png>` | wajib (dari kita) | `evidence:check` |
| Narasi di `BOB_DEVELOPMENT.md` + IBM Bob Usage Statement (≤ 500 kata) | wajib | `wc -w` |

## 2. Alur satu Bob slice: AI yang mengambil screenshot dan memberi nama

1. Claude Code berhenti dan mencetak **BOB SLICE <id>**: mode Bob, prompt siap tempel, dan file yang diharapkan berubah.
2. Kerjakan di **Bob IDE** (akun hackathon `ibm-coding-challenge-uat`, us-east). Koreksi lewat chat Bob, bukan edit manual.
3. Di Bob IDE: **Tasks → task tadi → klik header task** sampai ringkasan terbuka. Ini satu-satunya klik yang dilakukan manusia.
4. Balas "bob selesai" ke Claude Code. **Claude Code sendiri** lalu menjalankan:
   ```bash
   radar/scripts/bob-evidence.sh <nama> <NN> <slug>
   ```
   Script ini:
   - mencari jendela **Bob IDE** yang sedang terbuka (daftar jendela via `CGWindowListCopyWindowInfo`, pemilik "Bob"/"IBM Bob"), lalu mengambil screenshot jendela itu **tanpa perlu klik atau crop manual** (`screencapture -o -l <windowId>`),
   - menyimpan sebagai `bob_sessions/<tim>_<nama>_task<NN>_<slug>_summary.png`,
   - kalau ada ekspor `.md` baru di `~/Downloads` (≤ 10 menit), memindahkannya dengan nama yang sama,
   - menolak (exit 4) kalau `.md` memuat pola secret (`rdr_`, `ghp_`, `sk-`, `apikey`, `Bearer `),
   - menambah baris ke `bob_sessions/INDEX.md`,
   - macOS perlu izin **Screen Recording** untuk Terminal/Claude Code sekali saja (System Settings → Privacy & Security → Screen Recording).
5. Claude Code me-review hasil Bob, menjalankan test, lalu commit hasil Bob **apa adanya** dengan trailer `Bob-Assisted: bob_sessions/<png>`. Perbaikan dari Claude masuk commit terpisah.

**Otomatis penuh (dicoba di spike fase 01, opsional):** Bob IDE adalah aplikasi Electron/VS Code. Kalau Bob IDE dibuka dengan `--remote-debugging-port=9223`, skill `electron-automation` (agent-browser) bisa mengklik **Tasks → task → header** sendiri, lalu script mengambil screenshot. Kalau berhasil, langkah 3 juga tidak perlu manusia. Kalau gagal, pakai alur di atas.

## 3. `bob-evidence.sh` (spesifikasi; tangkapan layar default + `--interactive` final di fase 00, opsi `--md` + sensor ditambah Bob slice C4 fase 11)

```text
usage: bob-evidence.sh <nama> <NN> <slug> [--md <path>] [--interactive]
  default      : tangkap jendela Bob IDE otomatis (window id)
  --interactive: screencapture -i (pilih manual) bila jendela tidak ditemukan
exit 0 sukses · 1 argumen · 2 jendela/screenshot gagal · 3 md tidak ditemukan (peringatan) · 4 sensor gagal
```
Idempoten: kalau nama file sudah ada, tanya sebelum menimpa. Tidak pernah membaca `.env` atau `.radar/`.

## 4. `pnpm -C radar evidence:check` (fase 14)

Gagal kalau salah satu kondisi berikut terjadi:
- anggota di `plan/team.json` punya < 3 PNG `…_summary.png`,
- ada PNG yang namanya tidak sesuai pola §1,
- ada trailer `Bob-Assisted:` yang menunjuk ke file yang tidak ada,
- `INDEX.md` tidak mencantumkan salah satu PNG,
- ada file di `bob_sessions/` yang ter-ignore git (tidak ikut ter-commit).

## 5. Daftar Bob slice & anggaran

Daftar lengkap dan anggaran Bobcoin (40 per akun) ada di [`../../PLAN.md`](../../PLAN.md) §7. Aturan anggaran:
- Prompt Bob pendek dan spesifik file. Jangan minta Bob "baca seluruh repo Orca". Minta fokus ke `src/shared/` dan `src/renderer/src/lib/`.
- Pakai mode **Ask/Plan** untuk eksplorasi (lebih murah), dan **Code** hanya untuk menulis.
- Simpan ≥ 12 Bobcoin per akun untuk gladi + rekam demo (Minggu pagi). Pantau di Bob IDE: **Settings → General** (pastikan instance `ibm-coding-challenge-uat`, us-east).
- Catat Bobcoin yang terpakai per slice di INDEX (dari screenshot ringkasan).

## 6. Yang ditulis di IBM Bob Usage Statement (≤ 500 kata)

1. **Bob sebagai inti produk (runtime):** hook `PreToolUse` menegakkan kunci, hook `SessionStart`/`UserPromptSubmit` menyuntikkan brief tim, custom mode `coder` dan `pm-lead` membagi peran, MCP `radar-mcp` memberi Bob tool `why_blocked`/`propose_*`, dan `bob` jalan sebagai agent kelas satu di app.
2. **Bob sebagai pembangun:** daftar slice per anggota, termasuk onboarding codebase Orca (23k file) dengan Bob, kit `.bob/` yang ditulis di Bob IDE, dan komponen UI. Link ke `bob_sessions/INDEX.md`.
3. **Angka:** jumlah sesi, Bobcoin per anggota, file yang dibantu Bob (dari trailer).
4. **watsonx:** tidak dipakai. Tulis jujur "not used", atau sebutkan kalau tim memutuskan menambah Granite (tidak direncanakan).
