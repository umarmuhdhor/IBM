# IBM Bob 2.0 Hackathon — 10 Ide Proyek

> Riset: 24 September 2026, lewat agent-reach (Exa search dan Jina reader).
> Event: online, 25–27 September 2026 (48 jam), di lablab.ai. Total hadiah $12.000.
> **Pendaftaran tutup 24 Sep 22:00 CET, atau 25 Sep 04:00 WITA.**
> Link: https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon

---

## 1. Ringkasan riset

### Tantangan resmi

Pilih satu alur kerja developer yang sekarang makan terlalu banyak waktu atau tenaga, atau sering menghasilkan error. Pilihannya: **onboarding, debugging, code review, testing, maintenance aplikasi, atau release/deployment**. Lalu bangun prototipe yang berfungsi dengan IBM Bob 2.0 pada proyek nyata atau proyek contoh.

Solusi harus memakai fitur **Agent mode, parallel tasks, subagents, dan document understanding** untuk menangani beberapa langkah sekaligus, bukan hanya membantu menulis kode. Dampaknya harus terukur: produktivitas naik, kerja manual, error, dan rework berkurang, atau waktu penyelesaian jauh lebih cepat.

### Kriteria penilaian

| Kriteria | Yang dinilai |
|---|---|
| Application of Technology | Proyek lengkap dan matang, dengan penggunaan IBM Bob 2.0 yang jelas |
| Presentation | Presentasi jelas dan efektif |
| Business Value | Dampak dan nilai praktis untuk masalah yang mendesak |
| Originality | Keunikan solusi dan cara memakai Bob 2.0 |

### Hadiah

- Juara 1: $5.000
- Juara 2: $3.000
- Juara 3: $2.000
- 20 peserta mendapat $100 masing-masing, dengan syarat mengirim proyek yang lolos kualifikasi dan mengisi form feedback.

### Yang wajib dikumpulkan

- Judul, deskripsi singkat, dan deskripsi panjang
- Cover image, video presentasi, dan slide
- URL aplikasi dan repo kode
- Kode atau file yang dibuat dengan bantuan Bob 2.0
- **Screenshot ringkasan task session IBM Bob**

### Fitur Bob 2.0 yang bisa dipamerkan

- **Tiga mode:** Agent (eksekusi), Plan (perencanaan terstruktur, lalu diserahkan ke Agent), dan Ask (read-only). Bob bisa pindah mode sendiri di tengah task.
- **Custom modes:** atur akses tool, izin file, dan instruksi perilaku.
- **Subagents:** tiap subagent punya konteks sendiri. Hanya ringkasannya yang kembali ke agent utama.
- **Background tasks:** beberapa task jalan paralel, dan tiap task punya thread sendiri.
- **Parallel tool calling:** task yang dulu sekitar 30 detik kini sering selesai di bawah 10 detik. Context window sekarang 270k token.
- **Rollback:** kembali ke titik mana pun, per task, per giliran percakapan, atau per tool call. Tidak butuh git.
- **Document understanding:** baca `.docx`, `.pdf`, dan `.xlsx` secara native. Bisa edit file Office lewat `office_read` dan `office_edit`.
- **Laporan HTML:** di akhir analisis, Bob bisa membuat satu file HTML mandiri yang bisa langsung dibuka di browser.
- **Skills, MCP, dan plugin:** ada tab khusus di settings. Format plugin standar ekosistem didukung.
- **Hooks:** termasuk `PreCompact`/`PostCompact` dan pengiriman event ke endpoint HTTPS.
- **Workflows:** proses multi-fase yang bisa diulang, dengan langkah otomatis, langkah AI, dan langkah persetujuan manusia.
- **Bob Shell:** berjalan sebagai agent ACP, jadi bisa dipakai dari Zed, IntelliJ, atau Neovim.

### Pemenang hackathon IBM Bob Mei 2026

Total 5.628 peserta, 1.672 tim, dan 503 submission.

| Juara | Proyek | Isi | Kenapa menang |
|---|---|---|---|
| 1 | **Pedigree** | Bukti asal-usul kode buatan AI yang ditandatangani secara kriptografis (mirip C2PA, tapi untuk kode). Ada "Code Passport" dan GitHub Action yang memblokir merge. | Dikaitkan dengan denda EU AI Act Pasal 50. Bob dipakai sangat dalam: custom mode "Provenance Officer", Skill yang di-hash, dan server MCP. |
| 2 | **Atlas** | Repo GitHub ditampilkan sebagai peta kota yang bisa di-zoom, untuk onboarding. | Visual kuat dan langsung paham. |
| 3 | **Sandbox** | Simulasi sistem runtuh sebelum deploy: skor risiko dan animasi "Failure Replay". | Visual kuat, ada klaim waktu build 70% lebih cepat. |

**Link proyek pemenang** (dicek 24 Sep 2026):

| Proyek | Halaman lablab | GitHub | Demo |
|---|---|---|---|
| Pedigree | [lablab](https://lablab.ai/ai-hackathons/ibm-bob-hackathon/ctrlcats/pedigree) | [om13rajpal/pedigree](https://github.com/om13rajpal/pedigree) (sekarang private atau sudah dihapus) | [ibm-lilac.vercel.app](https://ibm-lilac.vercel.app/) (sekarang 404) |
| Atlas | [lablab](https://lablab.ai/ai-hackathons/ibm-bob-hackathon/atlas/atlas) | [chanjoongx/atlas](https://github.com/chanjoongx/atlas) | [atlas-1q0.pages.dev](https://atlas-1q0.pages.dev) · [slide PDF](https://storage.googleapis.com/lablab-static-eu/presentations/submissions/fprshn2p016bof54dpbni9nz/fprshn2p016bof54dpbni9nz-1779017956568_tkkwg9x9t6yte3xearcp6eh3.pdf) |
| Sandbox | [lablab](https://lablab.ai/ai-hackathons/ibm-bob-hackathon/404/sandbox-castles-crumble-fix-them-first) | [jamiedevera/Sandbox](https://github.com/jamiedevera/Sandbox) | [sandbox-lake-beta.vercel.app](https://sandbox-lake-beta.vercel.app/) |

Hasil resmi: [lablab.ai/ai-hackathons/ibm-bob-hackathon/live](https://lablab.ai/ai-hackathons/ibm-bob-hackathon/live)

**Pola pemenang:** masalah mendesak yang biaya atau dendanya bisa dihitung, Bob dipakai sangat dalam (bukan hanya menulis kode), dan demo visual yang kuat. Banyak peserta kalah dengan ide "AI SDLC wrapper" yang terlalu umum. Hindari itu.

---

## 2. Sepuluh ide

### 1. Spec Drift Court

- **Alur kerja:** testing dan maintenance
- **Masalah:** PRD (`.docx`), API spec, dan test case (`.xlsx`) makin lama makin tidak sesuai dengan kode. Bug baru ketahuan waktu UAT.
- **Cara pakai Bob:** tiga subagent paralel mengecek spec terhadap kode, spec terhadap test, dan kode terhadap test. Bob mengisi matriks keterlacakan langsung di file `.xlsx` lewat `office_edit`, lalu membuat laporan HTML.
- **Kenapa kuat:** memakai fitur baca dokumen secara maksimal. Matriks keterlacakan wajib ada di industri yang diatur regulasi, seperti bank, farmasi, dan pemerintahan.

### 2. Hypothesis Swarm Debugger

- **Alur kerja:** debugging
- **Masalah:** debugging insiden berjalan satu per satu. Satu dugaan dicoba, gagal, lalu coba dugaan berikutnya. MTTR bisa berjam-jam.
- **Cara pakai Bob:** masukkan log insiden. Plan mode menyusun 5 dugaan. Tiap dugaan dikerjakan satu background task: reproduksi, bisect, lalu patch. Kalau gagal, rollback. Hasil akhirnya PR perbaikan dan postmortem `.docx`.
- **Kenapa kuat:** paralel dan rollback kelihatan jelas di demo. Metriknya mudah dijual, misalnya MTTR 3 jam menjadi 20 menit.

### 3. Business Rule Excavator

- **Alur kerja:** maintenance aplikasi dan modernisasi
- **Masalah:** aturan bisnis terkubur di COBOL atau Java lama. Migrasi berisiko karena tidak ada yang tahu aturan pastinya.
- **Cara pakai Bob:** subagent per modul menggali aturan bisnis menjadi katalog dalam bahasa manusia (`.xlsx`). Bob juga membuat golden regression test sebelum migrasi. Ada custom mode "Legacy Archaeologist".
- **Kenapa kuat:** paling cocok dengan arah IBM, yang sedang mendorong modernisasi Java, IBM i, dan IBM Z lewat Bob. Juri dari IBM akan langsung paham nilainya.

### 4. Flaky Test Exorcist

- **Alur kerja:** testing
- **Masalah:** test flaky merusak kepercayaan pada CI. Developer jadi terbiasa asal klik "retry".
- **Cara pakai Bob:** jalankan test suite N kali di background task. Kelompokkan penyebabnya (timing, urutan test, state yang dipakai bersama). Perbaiki, lalu verifikasi dengan menjalankan ulang. Kalau hasilnya tidak stabil, rollback.
- **Kenapa kuat:** hasilnya bisa diukur, misalnya tingkat flaky 12% menjadi 0,5%. Pas dengan tema testing.

### 5. CVE-to-PR in 15 Minutes

- **Alur kerja:** maintenance dan release
- **Masalah:** advisory CVE (PDF) menyentuh 20 service. Patch manual makan berminggu-minggu dan SLA terlewat.
- **Cara pakai Bob:** Bob membaca PDF advisory dan mencari service yang terdampak. Tiap service di-upgrade oleh satu subagent secara paralel, lalu test dijalankan. Service yang gagal di-rollback dan dilaporkan. Hasilnya dashboard SLA dalam HTML.
- **Kenapa kuat:** cerita seperti Log4Shell selalu menarik. Nilai bisnisnya langsung terasa: risiko keamanan dan kepatuhan.

### 6. Go/No-Go Release Room

- **Alur kerja:** release dan deployment
- **Masalah:** keputusan rilis diambil dari checklist manual. Migrasi database yang berbahaya atau breaking change sering lolos.
- **Cara pakai Bob:** subagent paralel masing-masing memeriksa satu hal: keamanan migrasi, breaking API, feature flag, dan rencana rollback. Hasilnya dossier Go/No-Go dan release notes untuk tiga audiens: developer, tim support, dan customer (`.docx`).
- **Kenapa kuat:** menutup seluruh alur release. Output untuk banyak audiens jarang dipikirkan peserta lain.

### 7. Reviewer Twin

- **Alur kerja:** code review
- **Masalah:** standar review hanya ada di kepala developer senior. Developer junior terus mendapat komentar yang sama.
- **Cara pakai Bob:** tarik riwayat komentar PR lewat GitHub MCP. Saring menjadi Skill yang di-versioning, ditambah custom mode "Senior Reviewer". Bob melakukan review awal pada PR dan mengutip komentar serupa dari masa lalu sebagai preseden.
- **Kenapa kuat:** Skill yang belajar dari budaya review tim itu cara pakai Bob yang tidak biasa. Metriknya: jumlah putaran review berkurang.

### 8. Audit Evidence Autopilot

- **Alur kerja:** maintenance dan compliance
- **Masalah:** permintaan bukti audit SOC 2 atau ISO 27001 (`.xlsx` berisi lebih dari 100 kontrol) menyita waktu tim engineering berminggu-minggu.
- **Cara pakai Bob:** Bob membaca spreadsheet auditor dan mencari bukti di repo, CI, dan kode infrastruktur (branch protection, kontrol akses, enkripsi). Kolom bukti diisi otomatis, lalu Bob membuat laporan kekurangan.
- **Kenapa kuat:** mirip Pedigree yang juara 1 karena sama-sama compliance dengan nilai bisnis tinggi, tapi masalahnya berbeda.

### 9. Runbook Rot Detector

- **Alur kerja:** deployment dan operasional
- **Masalah:** runbook operasional (`.docx`) sudah tidak sesuai dengan Terraform atau Kubernetes yang sebenarnya. Waktu insiden jam 3 pagi, langkah di runbook ternyata salah.
- **Cara pakai Bob:** tiap langkah runbook dicek terhadap kode infrastruktur, lalu dijalankan sebagai dry-run di sandbox. Bob menulis ulang runbook dan menandai langkah yang sudah usang. Hook memicu pengecekan ulang setiap kali infrastruktur berubah.
- **Kenapa kuat:** masalah nyata yang jarang disentuh orang, jadi nilai orisinalitasnya tinggi.

### 10. First-PR Quest Engine

- **Alur kerja:** onboarding
- **Masalah:** developer baru butuh 2–4 minggu sampai PR pertamanya.
- **Cara pakai Bob:** Bob membaca repo dan wiki internal (PDF), lalu membuat misi bertingkat. Tiap misi adalah issue kecil yang nyata di repo itu sendiri. Custom mode "Mentor" menilai solusi developer dan hanya memberi petunjuk, bukan jawaban.
- **Kenapa kuat:** Atlas (juara 2) hanya memvisualisasikan repo. Ide ini membawa developer baru dari paham sampai benar-benar mengirim PR. Metriknya: waktu sampai PR pertama.

---

## 3. Pilihan terbaik

| Ide | Teknologi | Nilai bisnis | Orisinalitas | Kekuatan demo |
|---|---|---|---|---|
| #3 Business Rule Excavator | Tinggi | Sangat tinggi (sesuai arah IBM) | Tinggi | Sedang |
| #2 Hypothesis Swarm Debugger | Sangat tinggi | Tinggi | Tinggi | Sangat kuat |
| #1 Spec Drift Court | Sangat tinggi | Tinggi | Tinggi | Kuat |
| #9 Runbook Rot Detector | Tinggi | Tinggi | Sangat tinggi | Kuat |

**Rekomendasi:** #2 Hypothesis Swarm Debugger untuk demo paling kuat, atau #3 Business Rule Excavator untuk kecocokan paling tinggi dengan arah IBM.

---

## 4. Tips supaya menang

1. **Satu masalah, satu angka.** Tunjukkan perbandingan sebelum dan sesudah, misalnya "4 jam menjadi 12 menit". Judul yang umum biasanya kalah.
2. **Tampilkan fitur Bob di layar.** Custom mode, Skill, subagent paralel, rollback, dan pembacaan dokumen harus terlihat di video. Juara 1 menang karena Bob dipakai sampai ke intinya.
3. **Siapkan screenshot session summary sejak awal.** Screenshot ini wajib dikumpulkan. Ambil setiap selesai satu task besar.
4. **Jadikan laporan HTML dari Bob bagian demo.** Visual yang kuat adalah kunci juara 2 dan 3.
5. **Hindari ide "AI SDLC wrapper" yang umum.** Banyak submission seperti ini di bulan Mei, dan tidak ada yang menang.

---

## Sumber

- https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon
- https://bob.ibm.com/blog/bob-v2-release-announcement/
- https://bob.ibm.com/docs/ide/features/modes
- https://bob.ibm.com/docs/shell/changelog
- https://lablab.ai/ai-hackathons/ibm-bob-hackathon/ctrlcats/pedigree
- https://lablab.ai/ai-hackathons/ibm-bob-hackathon/404/sandbox-castles-crumble-fix-them-first
- https://letsdatascience.com/news/kookmin-student-wins-second-place-at-ibm-bob-hackathon-97b13ce9
