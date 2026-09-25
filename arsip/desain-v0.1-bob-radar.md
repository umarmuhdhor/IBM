# Bob Radar: desain lengkap

**Pitch satu kalimat:** Air-traffic control untuk tim yang masing-masing memakai Bob. Bob milikmu otomatis berhenti *sebelum* menulis kode yang akan bentrok dengan pekerjaan Bob milik rekan setim, lalu merundingkan pembagian kerjanya.

Dokumen ini memperdalam ide #1 dari laporan "Strategi menang IBM Bob 2". Isinya: posisi terhadap pesaing, fakta teknis Bob yang membatasi desain, arsitektur, alur kerja, demo, pitch, rencana 48 jam, dan risiko.

---

## 0. Ringkasan keputusan

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Inti produk | Mencegah konflik **dari edit yang akan ditulis**, lintas developer, ditegakkan di dalam loop Bob | Belum ada alat yang melakukan ketiganya sekaligus (lihat §1) |
| Mekanisme utama | Hook `PreToolUse` + server MCP + custom mode | Hook memberi penegakan. MCP memberi "suara" ke model, karena model tidak bisa membaca alasan blokir dari hook (lihat §2). |
| Momen wow | Dua Bob di **dua laptop berbeda**. Bob milik Sari berhenti sendiri, bertanya ke Radar, lalu mengirim usulan pembagian kerja ke Bob milik Andi. | Dua laptop membedakan Radar dari Clash, yang hanya bekerja di satu mesin |
| Angka pitch | Eksperimen terkontrol: 6 task, dengan vs tanpa Radar | Juri butuh angka. Angka ini dibuat sendiri selama hackathon. |
| Cerita bonus | "Kami membangun Radar sambil memakai Radar" | Isi `bob_sessions/` menjadi bukti nyata |

---

## 1. Lanskap pesaing: di mana tempat Radar

Ada dua alat open-source yang sudah menggarap sebagian masalah ini. Juri teknis mungkin mengenalnya, jadi **sebut keduanya dengan jujur di deck**. Menunjukkan bahwa kalian tahu medannya meningkatkan kredibilitas.

| | **MCP Agent Mail** | **Clash** | **Bob Radar** |
|---|---|---|---|
| Apa | "Gmail untuk coding agent": identitas, inbox, dan *advisory file lease* | Deteksi konflik antar-worktree dengan `git merge-tree` | Koordinasi tim yang ditegakkan di dalam Bob |
| Popularitas | ~2,1k stars | ~63 stars | — |
| Lintas manusia/mesin | Ya, lewat HTTP | **Tidak**, hanya satu mesin | **Ya** |
| Prediksi konflik tingkat kode | **Tidak**, hanya path | Ya, tapi dari *status worktree saat ini* | Ya, dari **edit yang akan ditulis** (payload `PreToolUse` memuat konten baru) |
| Penegakan di tool call | Tidak. Lease hanya sinyal, dan ada guard opsional saat pre-commit. | Hook di Claude Code yang menampilkan prompt "ask" | **Blokir otomatis** lewat exit 2 di `PreToolUse` |
| Duplikasi *niat* | Tidak | Tidak | Ya: "Bob Budi sudah mengerjakan rate limiting" |
| Resolusi | Kirim pesan manual | Tidak ada | Skill `negotiate-split`: Bob menyusun kontrak antarmuka dan manusia menyetujuinya |
| Kebijakan organisasi | Tidak | Tidak | `EnforcedHooks` Bob untuk rollout ke seluruh org |

Sumber: [MCP Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail), [Clash](https://github.com/clash-sh/clash).

**Kalimat posisi untuk deck:** "Clash membuktikan konflik bisa diprediksi, tapi hanya di satu laptop. Agent Mail membuktikan agen bisa saling memberi sinyal, tapi tanpa penegakan. Radar menggabungkan prediksi dan penegakan **lintas tim**, di titik paling awal: sebelum baris pertama ditulis."

**Dukungan dari IBM sendiri:** blog rilis Bob V2 menyebut "multiple agents coordinate on a single task" sebagai area eksplorasi berikutnya ([Bob V2 blog](https://bob.ibm.com/blog/bob-v2-release-announcement/)). Radar adalah prototipe dari roadmap mereka.

---

## 2. Fakta teknis Bob yang menentukan desain

Semua poin di bawah dari [dokumentasi resmi lifecycle hooks](https://bob.ibm.com/docs/ide/configuration/lifecycle-hooks) dan [uji lapangan Bob 2.0.2](https://www.the-main-thread.com/p/ibm-bob-lifecycle-hooks-agentic-development).

1. **Lima event hook:** `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`. Konfigurasinya di `.bob/settings.json` (workspace) atau `~/.bob/settings/settings.json` (global).
2. **Hanya `UserPromptSubmit` dan `PreToolUse` yang bisa memblokir**, lewat exit code 2. Exit code lain dicatat lalu diabaikan.
3. **Stdout hanya masuk ke konteks model untuk `SessionStart` dan `UserPromptSubmit`.** Stdout `PreToolUse` diabaikan, dan stderr hanya masuk ke log.
   → **Konsekuensi terpenting: model tahu edit-nya ditolak, tapi tidak tahu alasannya.** Solusinya ada di §4.3.
4. **Payload:** dokumentasi menulis `event`, `tool`, `input`, sedangkan runtime 2.0.2 memakai `hook_event_name`, `tool_name`, `tool_input` → **normalisasi kedua bentuk**. Payload `write_file` memuat `path` dan `content`, jadi isi baru bisa dianalisis sebelum ditulis.
5. **Nama tool edit:** `write_file`, `apply_diff`, `search_and_replace`, `insert_content`. Pakai matcher `^(write_file|apply_diff|search_and_replace|insert_content)$`.
6. **Timeout default 10 detik.** Hook harus cepat (<500 ms), jadi pengecekan konflik harus membaca hasil yang sudah dihitung, bukan menghitung di tempat.
7. **Hook hanya bertipe `command`** di IDE (dijalankan via `sh -c`) dan tidak ada handler HTTP. Hook memanggil server lewat `curl` atau script Python.
8. **`PostToolUse` dilewati kalau tool gagal.** Payload juga tidak memuat info Skill mana yang aktif.
9. **Hook berjalan dengan izin penuh user.** Akui ini di deck sebagai catatan keamanan.
10. **Celah bypass:** Bob bisa saja mengubah file lewat tool eksekusi perintah (misalnya `sed -i`). Pasang juga matcher untuk tool eksekusi dengan deteksi *best-effort*, dan sebutkan keterbatasan ini secara jujur. Nama tool eksekusinya harus diverifikasi saat spike.

---

## 3. Arsitektur

```
 Laptop Andi (Bob IDE)                         Laptop Sari (Bob IDE / Bob Shell)
 ┌──────────────────────────┐                  ┌──────────────────────────┐
 │ Bob  ── mode: radar-pilot│                  │ Bob  ── mode: radar-pilot│
 │  │ hooks (.bob/hooks/*)  │                  │  │ hooks                 │
 │  │ MCP: radar-mcp (stdio)│                  │  │ MCP: radar-mcp        │
 └──┼───────────────────────┘                  └──┼───────────────────────┘
    │ HTTPS + token per developer                 │
    ▼                                             ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ radar-server (FastAPI + SQLite, di Fly.io/Render/Railway)   │
 │  • state: intents, leases, snapshots, events                │
 │  • conflict engine: bare mirror repo + git merge-tree       │
 │  • intent matcher: Granite (watsonx.ai) atau fallback lokal │
 │  • WebSocket → board                                        │
 └─────────────────────────────┬───────────────────────────────┘
                               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ radar-board (Next.js di Vercel): radar live + replay mode   │
 └─────────────────────────────────────────────────────────────┘
```

### 3.1 Komponen

| Komponen | Isi | Dibangun dengan Bob? |
|---|---|---|
| `.bob/custom_modes.yaml` → mode `radar-pilot` | Aturan: umumkan niat sebelum bekerja, patuhi blokir, tanya `why_blocked` | Ya, ditulis bersama Bob |
| `.bob/skills/negotiate-split/SKILL.md` + script | Menyusun usulan pembagian kerja atau kontrak antarmuka | Ya |
| `.bob/settings.json` + `.bob/hooks/*.py` | 5 hook (lihat §4) | Ya |
| `radar-mcp` (FastMCP, stdio) | Tool untuk model (lihat §3.3) | Ya, dengan tutorial "Build MCP servers" |
| `radar-server` | State, conflict engine, intent matcher, WebSocket | Ya |
| `radar-board` | Visual radar, timeline, counter, replay | Ya |
| `org-policy/enforced-hooks.json` | Contoh `EnforcedHooks` untuk rollout org | Ya (hanya contoh konfigurasi) |

### 3.2 Model data (SQLite)

```
developer(id, name, color, token_hash)
session(id, developer_id, bob_session_id, branch, started_at, ended_at)
intent(id, session_id, summary, planned_paths[], status: active|done|abandoned, created_at)
lease(id, intent_id, path_glob, kind: soft|hard, expires_at)
snapshot(developer_id, ref: refs/radar/<dev>, base_sha, head_sha, updated_at)
prediction(dev_a, dev_b, path, hunks, severity: green|yellow|red, computed_at)
block(id, session_id, path, reason, other_intent_id, created_at, resolved_by)
message(id, from_dev, to_dev, kind: split_proposal|ack|info, body, status)
event(id, ts, type, payload_json)   ← sumber replay mode dan semua counter
```

### 3.3 Tool di `radar-mcp`

| Tool | Kapan dipanggil model | Hasil |
|---|---|---|
| `announce_intent(summary, planned_paths)` | Awal setiap task (diwajibkan mode) | `intent_id` + daftar niat rekan yang mirip atau tumpang tindih |
| `why_blocked()` | Setelah edit ditolak | Alasan: siapa, task apa, file/hunk mana, dan saran tindakan |
| `team_activity(path?)` | Saat merencanakan | Siapa sedang menyentuh area mana |
| `propose_split(to_dev, contract_md)` | Dari Skill `negotiate-split` | Pesan masuk ke inbox rekan |
| `inbox()` | Otomatis di-brief lewat hook `UserPromptSubmit` | Usulan dari Bob rekan |
| `release(intent_id)` | Selesai task (juga otomatis via `Stop`) | Lease dilepas |

---

## 4. Alur kerja rinci

### 4.1 Awal sesi
- **`SessionStart`** → `session_start.py` mendaftarkan sesi dan mencetak ringkasan tim singkat, maksimal ±5 baris, karena setiap karakter memakan konteks. Contoh: "Radar: Andi → refactor checkout (checkout.ts, cart.ts). Budi → rate limiting (middleware/)."
- Mode `radar-pilot` mewajibkan model memanggil `announce_intent` sebelum edit pertama. Kalau server mendeteksi niat yang mirip dengan milik rekan (lihat §4.5), model langsung diberi tahu.

### 4.2 Setiap prompt
- **`UserPromptSubmit`** → `prompt_brief.py` mencetak perubahan sejak prompt terakhir: lease baru di area yang sama dan pesan inbox yang belum dibaca. **Inilah saluran "Bob rekan berbicara ke Bob-mu".**

### 4.3 Sebelum setiap edit (inti produk)
`PreToolUse` → `pre_write_guard.py`:
1. Normalisasi payload, lalu ambil `path` dan konten/diff baru.
2. Kirim ke server `POST /check {session, path, proposed}` dengan timeout 1,5 detik.
3. Server:
   - **Lease `hard` milik orang lain** → merah.
   - **Simulasi:** terapkan konten baru ke snapshot developer ini, lalu jalankan `git merge-tree --write-tree` terhadap snapshot rekan yang menyentuh file sama. Konflik → **merah**. Bersih tapi file sama → **kuning**.
   - Selain itu → **hijau**.
4. Merah → simpan `block` ke server, lalu **exit 2**. Kuning → exit 0, dicatat ke board (peringatan tidak bisa dikirim ke model dari sini, jadi dikirim lewat brief `UserPromptSubmit` berikutnya). Hijau → exit 0.
5. **Server tidak terjangkau → fail-open (exit 0)** dan catat. Tim enterprise bisa memilih fail-closed. Sebutkan ini sebagai pilihan kebijakan di deck.

**Menutup celah "model tidak tahu alasannya":** instruksi mode `radar-pilot` berbunyi:
> "Jika sebuah edit ditolak, JANGAN mencoba ulang dan JANGAN memakai perintah shell untuk mengubah file. Panggil `radar.why_blocked()`, jelaskan situasinya ke user, lalu jalankan Skill `negotiate-split` atau kerjakan bagian lain."

Hook memberi penegakan, MCP memberi penjelasan, dan mode mengikat keduanya. **Ini sekaligus bukti pemakaian Bob yang dalam: tiga primitif bekerja sebagai satu sistem.**

### 4.4 Setelah setiap edit
`PostToolUse` → `post_write_sync.py` membuat commit snapshot **tanpa menyentuh branch dan index user**, lalu mem-push ke `refs/radar/<dev>`:
```bash
export GIT_INDEX_FILE="$(git rev-parse --git-dir)/radar-index"   # aman juga di worktree
git read-tree HEAD && git add -A
TREE=$(git write-tree)
SNAP=$(git commit-tree "$TREE" -p HEAD -m "radar snapshot")
git push -q -f radar "$SNAP:refs/radar/$RADAR_DEV"
```
Server menerima push ke mirror, lalu menghitung ulang `prediction` untuk semua pasangan developer yang relevan secara asinkron. Hasilnya di-cache, sehingga `PreToolUse` berikutnya tinggal membaca.

Untuk **simulasi edit yang akan ditulis**, server membuat commit sementara berisi konten usulan di atas HEAD developer (`hash-object` → `update-index` pada index sementara → `commit-tree`), lalu menjalankan `git merge-tree --write-tree --name-only refs/radar/<rekan> <commit-usulan>`. Exit code non-nol berarti konflik.

**Sudah diuji di sandbox (git 2.43):** Andi mengubah `total()` tanpa commit, dan snapshot-nya ter-push tanpa mengubah branch maupun status kerjanya. Usulan Sari mengubah `total()` menghasilkan **MERAH** (`CONFLICT (content)`). Usulan Sari mengubah `tax()` di file yang sama menghasilkan **bersih**, yang dalam desain ini berarti KUNING. Butuh git ≥ 2.38 untuk `merge-tree --write-tree`.

### 4.5 Deteksi niat duplikat
Saat `announce_intent`, server membandingkan `summary` dan `planned_paths` dengan semua niat aktif:
- **Versi IBM:** embedding Granite di watsonx.ai. Ini memenuhi pola "satu sentuhan Granite" yang dipakai para juara, tapi **cek daftar model terlarang** di guide 2.0.
- **Fallback tanpa API key:** kemiripan kata kunci (Jaccard) + tumpang tindih path.
Output ke model: "Budi sedang mengerjakan 'rate limiting untuk endpoint login' (kemiripan 0,82). Gabung, pakai ulang, atau lanjutkan?"

### 4.6 Negosiasi: momen "multiplayer" yang sebenarnya
Skill `negotiate-split` (SKILL.md + template):
1. Model memanggil `why_blocked` → mendapat hunk yang bentrok.
2. Model menyusun **kontrak antarmuka** (misalnya "Andi mengekspor `calculateTotal(cart, coupon)`; Sari hanya memanggilnya") atau **pembagian hunk**.
3. `propose_split(to=andi, contract_md)`.
4. Di prompt Andi berikutnya, `UserPromptSubmit` menyuntikkan: "Usulan dari Bob milik Sari: …". Bob Andi menampilkannya ke Andi, dan **Andi yang menyetujui**. Ini human-in-the-loop, sesuai narasi governance IBM.
5. Persetujuan → lease diperbarui → blokir Sari terangkat → board berubah dari merah menjadi hijau.

### 4.7 Akhir
`Stop` → `stop_release.py` melepas lease `soft` dan menandai sesi selesai. Lease `hard` punya TTL, supaya lease "yatim" tidak mengunci file selamanya.

---

## 5. Board visual: satu layar ikonik

Satu layar ini harus bisa menjadi cover 16:9 dan slide pertama deck:
- **Radar melingkar.** Pusatnya repo, dan setiap direktori adalah sektor. Setiap developer punya warna dan "sapuan" radar sendiri. Setiap file yang sedang disentuh muncul sebagai *blip* berwarna pemiliknya.
- **Garis konflik.** Merah berkedip = diblokir. Kuning = file sama, merge bersih. Hijau = sudah dirundingkan.
- **Panel kanan:** timeline event (announce → block → why → propose → approve).
- **Counter besar:** "Konflik dicegah sebelum ditulis", "Niat duplikat terdeteksi", "Bobcoin yang tidak terbuang (estimasi)".
- **Replay mode** (`/demo`): memutar ulang `event` log yang direkam dari sesi nyata. Juri bisa melihat semuanya **tanpa login, tanpa Bob, tanpa API key**.

---

## 6. Angka pitch: eksperimen terkontrol

Juri IBM menilai "measurable productivity gains or error reduction". Buat angkanya sendiri pada Minggu pagi:

1. Siapkan repo contoh kecil, misalnya toko online sederhana dengan data sintetis.
2. Siapkan **6 task** yang secara alami saling bersinggungan, misalnya kupon, pajak, dan ongkir yang semuanya menyentuh `checkout.ts`.
3. **Putaran A (tanpa Radar):** dua developer, masing-masing dengan Bob, mengerjakan 3 task secara paralel. Ukur jumlah konflik saat merge, menit untuk menyelesaikannya, dan Bobcoin yang terpakai.
4. **Putaran B (dengan Radar):** reset repo, lalu jalankan task yang sama.
5. Laporkan apa adanya. Contoh format: "Tanpa Radar: N konflik, M menit resolusi. Dengan Radar: 0 konflik saat merge, K blokir yang dirundingkan dalam rata-rata X detik."

Catatan: sampel kecil dan skenario dirancang sendiri. **Sebutkan ini di deck.** Kejujuran lebih meyakinkan juri teknis daripada angka yang dibesar-besarkan. Konteks eksternal: 41,7% pasangan PR dari agen berbeda berkonflik ([arXiv 2607.04697](https://arxiv.org/html/2607.04697v2)), dan waktu review PR naik 91% di tim ber-AI ([Faros](https://www.faros.ai/blog/ai-software-engineering)).

---

## 7. Demo video (±4 menit)

| Waktu | Adegan |
|---|---|
| 0:00–0:25 | Hook: "41,7% PR dari agen berbeda saling bentrok. Tim kalian punya 5 developer dan 5 Bob, tapi tidak ada yang mengatur lalu lintasnya." Tampilkan board radar yang penuh garis merah. |
| 0:25–0:45 | Posisi: satu kalimat tentang Clash dan Agent Mail, lalu kenapa Radar berbeda |
| 0:45–2:45 | **Demo langsung, dua laptop, layar dibagi dua.** Andi meminta refactor checkout, dan Bob-nya mengumumkan niat, yang muncul sebagai blip biru. Sari meminta fitur kupon. Bob Sari mencoba `write_file checkout.ts`, lalu **diblokir**. Bob Sari memanggil `why_blocked`, menjelaskan dengan sendirinya, lalu menjalankan `negotiate-split`. Usulan muncul di Bob Andi, dan Andi menyetujuinya. Garis di board berubah hijau dan counter naik. |
| 2:45–3:15 | Di balik layar: `.bob/custom_modes.yaml`, Skill, `settings.json` hooks, dan potongan `bob_sessions/` yang menunjukkan blokir nyata selama tim membangun Radar |
| 3:15–3:45 | Angka dari eksperimen (§6) + `EnforcedHooks` untuk rollout org |
| 3:45–4:00 | Target user, model bisnis, roadmap, dan penutup |

**Rekam cadangan.** Rekam demo terbaik pada Minggu pagi. Jangan mengandalkan satu take live di jam terakhir.

---

## 8. Nilai bisnis (untuk slide)

- **Target user:** tim engineering berisi 5–50 developer yang sudah memakai agen AI secara paralel. Pembelinya engineering manager atau platform team.
- **Masalah berbiaya:** waktu resolusi konflik, pekerjaan dobel, review yang membengkak, dan token terbuang untuk kode yang akhirnya dibuang.
- **Model:** per-seat (misalnya $5–10 per developer per bulan) atau add-on org via `EnforcedHooks`. Versi self-hosted untuk enterprise dengan kebutuhan data residency.
- **Kenapa sekarang:** agen paralel baru menjadi arus utama di 2026, dan IBM menyebut koordinasi multi-agent sebagai roadmap berikutnya.
- **Jalur ke IBM:** Radar bisa menjadi fitur bawaan Bob Enterprise. Framing ini disukai juri sponsor.

Angka harga di atas adalah asumsi untuk slide, bukan hasil riset pasar. Tandai sebagai hipotesis.

---

## 9. Scope: wajib, bagus, potong

| Wajib (MVP untuk demo) | Bagus kalau sempat | **Potong** |
|---|---|---|
| Hook `PreToolUse` blokir + `why_blocked` | Deteksi niat duplikat dengan Granite | Chat tim |
| `announce_intent`, lease soft/hard | Deteksi bypass via tool eksekusi | Dukungan multi-repo |
| Snapshot `refs/radar/*` + merge-tree | Kontrak antarmuka yang dirapikan otomatis | Autentikasi OAuth (pakai token statis per dev) |
| Board radar + replay mode | Contoh `EnforcedHooks` | Integrasi GitHub PR/Actions |
| Skill `negotiate-split` + inbox via `UserPromptSubmit` | Estimasi Bobcoin yang dihemat | Fan-out task ke Bob lain lewat ACP |
| `bob_sessions/`, `BOB_DEVELOPMENT.md`, README juri | | Mobile, notifikasi Slack |

---

## 10. Spike teknis (h2–h5, Sabtu 01:00–04:00 WITA)

Lima hal harus terbukti sebelum **GATE 1, Sabtu 04:00 WITA**:

1. `PreToolUse` dengan matcher edit terpicu, payload terbaca (catat bentuk aslinya), dan **exit 2 benar-benar mencegah file berubah**.
2. Setelah diblokir, **apa persisnya yang dilihat model?** Kalau model menerima pesan error generik, rencana §4.3 jalan. Kalau model langsung mencoba ulang tanpa henti, perketat instruksi di mode.
3. `UserPromptSubmit` stdout benar-benar masuk ke konteks, dan model menyebut isinya kalau ditanya.
4. Hook bisa `curl` ke server publik dalam waktu <1 detik.
5. Dua sesi Bob di **dua laptop** berbeda bisa berjalan bersamaan, dan snapshot `refs/radar/*` masuk ke mirror server.

**Aturan:** 1, 3, dan 4 lolos → lanjut Radar. Poin 1 gagal → pakai *soft enforcement* (mode mewajibkan `check_conflict` sebelum edit). Kalau itu juga lemah → pivot ke **SlopStop**, yang memakai primitif hook yang sama. Poin 5 gagal → demo pakai dua worktree di satu mesin, tapi jelaskan arsitekturnya lintas mesin. Opsi ini lemah terhadap perbandingan dengan Clash, jadi usahakan poin 5 lolos.

---

## 11. Rencana 48 jam khusus Radar (WITA)

| Waktu | Bob Lead | Backend | Frontend | Pitch Lead |
|---|---|---|---|---|
| Jum 23:00–Sab 01:00 | Kickoff, baca guide 2.0, cek aturan | Kickoff | Kickoff | Kickoff, catat rubrik |
| Sab 01:00–04:00 | **Spike 1–3** | **Spike 4–5**, deploy server kosong | Setup Next.js + Vercel | Susun statistik dan kerangka narasi, lalu tidur 02:00 |
| **Sab 04:00** | **GATE 1** | | | |
| Sab 04:00–10:00 | Tidur | Model data, `/check`, lease | Board statis + WebSocket | Tidur |
| Sab 10:00–16:00 | Mode `radar-pilot`, 5 hook, MCP tools | Tidur | Tidur | Repo contoh + 6 task eksperimen |
| Sab 16:00–23:00 | Skill `negotiate-split`, uji end-to-end | Snapshot + merge-tree engine | Radar visual + timeline | Script video v1 |
| **Sab 23:00** | **Alur end-to-end jalan di 2 laptop** | | | |
| Sab 23:00–Min 05:00 | Tidur bergilir, perbaikan | Niat duplikat (fallback dulu, Granite kalau sempat) | Replay mode dari `event` log | Deck v1 |
| Min 05:00–11:00 | **Eksperimen A/B (§6)**, ekspor `bob_sessions/` | Hardening, fail-open, test | Counter + polish | Rekam footage demo |
| **Min 11:00** | **FEATURE FREEZE** | | | |
| Min 11:00–19:00 | `BOB_DEVELOPMENT.md` + tabel metrik | README juri, gitleaks seluruh history | Cover 16:9 | Edit video, deck PDF, deskripsi |
| Min 19:00–21:00 | **Submit** | | | |
| Min 21:00–23:00 | Buffer: cek incognito, repo publik, video bisa diputar, tidak ada secret | | | |

**Bobcoin:** dua sesi paralel memakan dua kali lipat. Bagi pemakaian per akun dan simpan kuota untuk eksperimen A/B dan rekaman demo pada Minggu pagi.

---

## 12. Pemetaan ke kriteria juri

| Kriteria | Bagaimana Radar menjawabnya |
|---|---|
| **Application of Tech** | Enam primitif Bob bekerja sebagai satu sistem: custom mode, Skill, 4–5 hooks, MCP server, `EnforcedHooks`, dan subagent `explore` untuk memetakan file dalam rencana. Ditambah `bob_sessions/` yang memperlihatkan blokir nyata saat membangun Radar sendiri. |
| **Originality** | Prediksi konflik dari *edit yang akan ditulis*, lintas mesin, ditegakkan di dalam agen, dengan negosiasi antar-Bob. Pembandingnya diakui secara eksplisit (Clash, Agent Mail). |
| **Business Value** | Masalah terukur (41,7% konflik, review +91%), pembeli jelas, dan selaras dengan roadmap IBM |
| **Presentation** | Satu visual ikonik (radar), satu momen wow (Bob berhenti lalu berunding), dan angka dari eksperimen sendiri |

---

## 13. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Model tidak paham kenapa diblokir, lalu mencoba ulang atau bypass lewat shell | Demo gagal | Instruksi mode yang tegas + `why_blocked` + matcher tool eksekusi. Uji di spike poin 2. |
| Juri: "ini cuma git lock" | Originality turun | Tekankan simulasi merge dari edit yang akan ditulis, niat duplikat, dan negosiasi. Lock hanya satu dari lima lapisan. |
| Juri tahu Clash atau Agent Mail | Originality dipertanyakan | Sebut duluan di deck, dengan tabel perbandingan §1 |
| Latensi hook melewati timeout 10 detik | Bob lambat atau hook dianggap gagal | Hitung prediksi secara asinkron di `PostToolUse`. `PreToolUse` hanya membaca cache. Fail-open. |
| Format `apply_diff` sulit diterapkan ke snapshot | Prediksi tidak akurat untuk diff | Untuk `write_file` pakai konten penuh. Untuk diff, fallback ke overlap rentang baris. |
| Privasi: snapshot kode dikirim ke server | Keberatan enterprise | Roadmap: server self-hosted, atau hanya kirim hash hunk. Untuk demo, pakai repo publik dengan data sintetis. |
| Demo dua laptop gagal saat live | Presentasi turun | Rekaman cadangan + replay mode |
| Bobcoin habis | Tidak bisa merekam | Anggaran per akun, `--max-cost`, dan eksperimen dijadwalkan lebih awal |
| Guide 2.0 punya track yang tidak cocok | Nilai kecocokan turun | Framing fleksibel: "team workflow", "governance", atau "SDLC orchestration" |
| IBM memperbarui aturan (misalnya `bob_sessions` berubah) | Diskualifikasi | Baca guide di 2 jam pertama, dan Pitch Lead mengecek checklist |

---

## 14. Nama dan tagline alternatif

- **Bob Radar** — "Air-traffic control untuk tim yang memakai Bob"
- **Bob ATC** — lebih teknis, tapi kurang ramah
- **Wingman** — "Bob-mu tahu apa yang dikerjakan Bob rekanmu"

Rekomendasi: tetap **Bob Radar**. Metafora visualnya langsung menyatu dengan board.

---

## Sumber

- [IBM Bob — Lifecycle hooks (dokumentasi resmi)](https://bob.ibm.com/docs/ide/configuration/lifecycle-hooks)
- [The Main Thread — IBM Bob Lifecycle Hooks (uji Bob 2.0.2)](https://www.the-main-thread.com/p/ibm-bob-lifecycle-hooks-agentic-development)
- [rulesync issue #3011 — format hooks Bob](https://github.com/dyoshikawa/rulesync/issues/3011)
- [IBM Bob V2 release blog](https://bob.ibm.com/blog/bob-v2-release-announcement/)
- [IBM Bob IDE changelog](https://bob.ibm.com/docs/ide/changelog)
- [MCP Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail)
- [Clash](https://github.com/clash-sh/clash)
- [arXiv 2607.04697 — AI Agent PRs & merge conflict rates](https://arxiv.org/html/2607.04697v2)
- [Codex KB — When Agents Collide](https://codex.danielvaughan.com/2026/07/28/agent-pr-merge-conflicts-concurrent-coding-agents-codex-cli-worktree-isolation-coordination-defence/)
- [Faros AI — AI software engineering](https://www.faros.ai/blog/ai-software-engineering)
- [Panduan peserta IBM Bob Hackathon (Mei 2026)](https://watsonx-hackathons-2026.s3.us.cloud-object-storage.appdomain.cloud/Lablab-IBM-Bob-hackathon-guide-May-2026.pdf)
