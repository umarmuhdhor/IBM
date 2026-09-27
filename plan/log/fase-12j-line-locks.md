# Fase 12j · Kunci per rentang baris (D-alief-17)

Lane: Core (Alief). Perubahan kecil di lane lain, commit terpisah: App (Aarief) label di Shared repo dan Team;
Bob (Umar) `lock_guard` mengirim `lines`, `why_blocked` menyebut baris, bundel `bob-kit` dibangun ulang.

## Masalah

Landing dan `lock-collision-demo.tsx` menampilkan "lines 3–5 locked · Alice" dan Budi terblokir di baris 3. Server
hanya mengunci seluruh file, jadi Budi yang mengedit baris 10 juga terblokir. Klaim itu belum benar di produk.

## Perubahan

| Bagian | Commit | Isi |
|---|---|---|
| Keputusan | `docs(decisions)` | D-alief-17 |
| Kontrak (common) | `feat(common)` | `LineRange`, `range?`/`holderRange?`/`lines?`, `outside_range`, `file.ack.merged?/content?`; `line-range.ts`: `rangesOverlap`, `lockLabel`, `changedLines` (diff baris LCS), `merge3`, `touchedLines`; reducer menyimpan `range` |
| Server | `feat(server)` | skema v5 (`start_line`/`end_line`, migrasi idempoten), `checkWrite` tabel R1–R8, pesan blokir bahasa Inggris dengan baris, `file.update` menggabungkan tiga arah saat kunci punya rentang |
| Hooks (Umar) | `feat(hooks)` | `lock_guard` menghitung baris dari `apply_diff`/`insert_content`/`search_and_replace` dan mengirim `lines` |
| Sync | `feat(sync)`, `fix(sync)` ×2 | `file.ack.merged` menulis isi gabungan ke disk hanya kalau file lokal belum berubah; perubahan teman ditunda selama simpanan kita masih di jalan; edit lokal yang belum terkirim dikirim dulu untuk digabung; pesan tolak menyebut baris |
| Feed | `feat(common)`, `feat(server)` | `file.rejected.holderRange?`: "Budi's change to app.ts is refused, lines 3–5 are locked by Alice" |
| App (Aarief) | `feat(app)`, `fix(app)` | Shared repo "lines 3–5 · Alice · held"; Team "Alice holds lines 3–5"; label dibatasi lebarnya |
| radar-mcp (Umar) | `feat(mcp)` | `why_blocked`: "src/app.ts lines 3–5 dipegang Alice …" |
| bob-kit (Umar) | `build(bob-kit)` | bundel hooks dan radar-mcp dibangun ulang |
| R4 | `docs(R4)` | tabel rentang dan pseudocode `file.update` |

## Hasil

### Versi prod

| | Version ID |
|---|---|
| Rollback (sebelum fase 12j, akhir fase 12i) | `b3f7e42d-6123-4dd9-9f9b-f5f4a2184ce0` |
| Deploy antara | `98712ae4…`, `460481dd…`, `a475c3f9-c1bd-4687-878c-2e84fd65cade` |
| **Live, menjalankan tip `lane/core-f12j`** | `208e6acc-1e00-49b7-b239-44825615b97e` |

Canary (health, `/j/<code>`, radar-cli.tgz, WebSocket) 4/4 OK setelah tiap deploy.

### E2E di prod (dua app, profil terpisah, folder sintetis `lines`)

Owner = `af` (nama anggota default dari user OS, bukan "E2E Alice"), coder = "E2E Budi". Hook dijalankan dengan
bundel `radar/bob-kit/coder/.bob/hooks/lock_guard.js` dan payload Bob sintetis.

| # | Langkah | Hasil |
|---|---|---|
| 1 | Alice `apply_diff` mulai baris 3 (3 baris) | kunci `src/app.ts` 3–5; app menampilkan "lines 3–5 · af · held" |
| 2 | Budi `apply_diff` baris 10 | hook lolos (`outside_range`), tanpa kunci; kedua edit ada di kedua Mac |
| 3 | Budi `apply_diff` baris 4 | hook exit 2: "RADAR: src/app.ts lines 3–5 are locked by af (T-1 …)"; edit batal |
| 4 | Budi simpan langsung baris 4 (sync) | `file.rejected held_by_other`, isi Budi di `app.ts.radar-rejected`; feed B: "E2E Budi's change to app.ts is refused, lines 2–5 are locked by af" |
| 5 | Alice ubah baris 2 | rentang melebar ke 2–5 (R3) |
| 6 | Kunci satu file (`write_file` util.ts) | Budi terblokir di `insert_content` baris 1 dan `apply_diff` baris 40 (R8) |
| 7 | 5 ronde edit bersamaan (Alice baris 4, Budi baris 12, jeda <1 dtk) | kedua edit tetap ada tiap ronde, log `recv.deferred` + `ack.merged` |

### Dua bug balapan sync yang ditemukan di prod dan diperbaiki (tes gagal dulu)

1. **Kehilangan data** (`00486a37`): `file.changed` Alice datang saat simpanan Budi masih di jalan. Agent menulis versi
   Alice di atas edit Budi, lalu melewati ack gabungan dan mengirim ulang teks lama sebagai v6. Sekarang perubahan
   ditunda; ack gabungan atau penolakan yang menyelesaikan file.
2. **Sidecar palsu** (`a8304d16`): edit Budi yang masih di debounce disimpan sebagai `.radar-conflict` saat perubahan
   Alice datang. Sekarang edit itu dikirim dulu terhadap versi asalnya dan server menggabungkannya per baris.

### Verifikasi (ecc:verification-loop)

| Cek | Hasil |
|---|---|
| radar tests | common 139, server 206, sync 63, hooks 52, mcp 49, ui 11, web 56: semua lulus |
| radar typecheck + lint | bersih |
| app `tc` | lulus |
| app tes radar (`src/renderer/src/components/radar`, `src/main/radar`) | 26 file, 140 tes lulus |
| app suite penuh | 23 file gagal, semua karena lingkungan (Playwright webkit tidak ada, timeout); tidak ada di radar/sidebar |
| oxlint app | 1 error lama di `WatchBobView.tsx:23` (sudah ada di `main`) |

### Review

| Review | Temuan | Tindakan |
|---|---|---|
| ecc:typescript-reviewer | tidak ada CRITICAL/HIGH. LOW: `team.ts` membaca rentang dua kali; `merge3` O(n·m) memori terburuk ±32 MB pada 2 MiB | `db5c2d35`; memori dibatasi `MAX_FILE_BYTES`, dicatat |
| ecc:react-reviewer | tidak ada CRITICAL/HIGH. MEDIUM: label kunci terpotong | `da8ea9bf`, lalu `e46c1e31` (bungkus) |
| /ecc:code-review (diff fase) | APPROVE. LOW: perubahan yang ditunda tidak mengirim `file.applied` (satu sampel latensi hilang); rentang tidak bergeser saat baris disisipkan di atasnya | dicatat di Batasan |

### UI gate (better-interface, app terhubung ke prod)

Tangkapan: `ui-O-Fileslocks.png`, `ui-B-MissionControl.png`, `ui-B-Team.png`, `ui-B-feed-rejected.png` (scratchpad e2e).

| Sev | Temuan | Lokasi | Tindakan |
|---|---|---|---|
| HIGH | Label kunci terpotong, teks penuh hanya di `title` (tidak terjangkau keyboard) | `SharedRepoList.tsx` | diperbaiki: label dibungkus (`[overflow-wrap:anywhere]`, `max-w-[16rem]`), dicek di lebar sempit |
| MEDIUM | Subjudul Files & locks masih bilang "one Bob per file" | `FilesLocksView.tsx` | diperbaiki (`a524cd3f`) |
| LOW | Feed menampilkan dua baris "blocked" (hook dan sync sama-sama mengirim `lock.blocked`) | feed | dicatat, perilaku lama |
| — | Teks antrean Team ("Alice holds lines 3–5") | `TeamPanel.tsx` | dites unit; tidak terlihat saat runtime (tidak ada antrean di e2e) |
| — | App memakai tema Orca terang, bukan dark Carbon | profil | sudah ada sebelumnya, bukan dari fase ini |

### Usulan untuk Imelda (landing dan /demo, tidak diedit)

`lock-collision-demo.tsx` dibanding produk:

1. Demo mengunci per ketikan; produk mengunci per panggilan tool Bob (`apply_diff`, `insert_content`, `search_and_replace`
   memberi baris; `write_file` mengunci seluruh file).
2. Label demo "locked · Alice"; app menulis "lines 3–5 · Alice · held". Samakan formatnya.
3. "Zero merge conflicts" terlalu kuat: edit yang berdempetan atau tumpang tindih tetap jadi konflik (`.radar-conflict`).
   Usul: "Edits on different lines merge automatically".
4. Tambahkan kasus yang sekarang benar di produk: Budi edit baris 10 saat Alice pegang 3–5, lolos, kedua edit tersimpan.
5. Alur serah-terima (Alice selesai, lalu PM setuju) sudah kira-kira cocok dengan permintaan + antrean.

### Batasan

- Rentang tidak bergeser saat baris disisipkan/dihapus di atasnya; kunci tetap di nomor baris lama sampai dilepas.
- Serah-terima kunci (`pindahkan`) memberi pemegang baru seluruh file.
- `merge3` memakai tabel LCS; memori terburuk ±32 MB pada file 2 MiB, masih dalam batas Worker.
- Perubahan teman yang ditunda tidak mengirim `file.applied`, jadi satu sampel latensi hilang.
