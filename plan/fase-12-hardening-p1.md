# Fase 12 — Hardening & fitur P1

| Field | Nilai |
|---|---|
| Jalur | **Lane A** (Orang 1) · branch `lane/core` (Lane B membantu BC-05 & SV-10 bila fase 13 cepat selesai) |
| Slot WITA | Min 27 Sep 05:00 – 11:00 · **berakhir di GATE 2 (feature freeze) Min 11:00** |
| Estimasi | 5 jam |
| Prasyarat | 10 |
| Requirement PRD | SV-09, SV-10, SY-06, SY-07, BC-05, MA-06 (P1); BC-06 (P2, opsional); NFR-01..04 hardening |
| Model | Sonnet 5 · effort medium; **Opus 5.5** · high untuk SY-07 reconnect |
| Fase berikutnya | 14 |

## Tujuan

Menutup celah yang membuat demo rapuh (bug non-P0 dari fase 10, PC terputus, kunci yang tertinggal) lalu menambah fitur P1 **sesuai urutan nilai**, sambil siap memotong kapan saja. Pukul 11:00 semua fitur berhenti; setelahnya hanya bugfix.

## Bacaan wajib

- PRD §06 aturan 7, §08.3 (hapus/ganti nama, tersambung ulang), §10 (baris P1), §16 "Kalau waktu mepet, potong dengan urutan ini"
- `docs/E2E_REPORT.md` (bug tersisa), `plan/ref/R4-mesin-kunci.md` §7

## Urutan kerja & urutan potong

Kerjakan dari atas. Kalau jam 10:00 belum sampai sebuah item, **item itu dan semua di bawahnya dipotong** (catat di DECISIONS + README "Roadmap").

| Urutan | Item | Req | Kenapa urutan ini | Potong ke-(PRD §16) |
|---|---|---|---|---|
| 1 | Bug P0/P1 dari `docs/E2E_REPORT.md` | – | Demo stabil > fitur baru | tidak dipotong |
| 2 | Kunci kedaluwarsa + cabut | SV-09 | Menyelamatkan demo bila PC mati | – |
| 3 | Tersambung ulang penuh | SY-07 | Wi-Fi hackathon tidak stabil | – |
| 4 | Laporan sesi | MA-06 | Bahan penutup demo & deck | 4 |
| 5 | Pemicu main agent otomatis | SV-10 | Roadmap kuat; opsional di demo | – |
| 6 | Hapus & ganti nama | SY-06 | Jarang di demo | 2 |
| 7 | Penanda AI PostToolUse | BC-05 | Nilai audit | 1 |
| 8 | Hook Stop → ringkasan giliran | BC-06 (P2) | Hanya bila semua di atas selesai | – |

## Langkah kerja

1. **Bugfix** dari `docs/E2E_REPORT.md`: setiap bug → test regresi → perbaikan → tandai "fixed" di laporan.

2. **SV-09 kunci kedaluwarsa** (R4 §7):
   - Server: job `heartbeat.ts` tiap 30 s; emit `member.stale` sekali per episode (reset saat heartbeat kembali → event `member.online`).
   - `POST /v1/locks/revoke` (mc) sesuai R4 §5 + test (revoke memajukan antrean, notifikasi pemilik lama & baru).
   - MC: `StaleMemberBanner` (fase 09) + tombol cabut per file terhubung ke endpoint.
   - Env `HEARTBEAT_EXPIRE_MS=60000` untuk mendemokan cepat (catat di DEMO_SCRIPT, bukan default).

3. **SY-07 tersambung ulang** (Opus):
   - Sync agent menyimpan antrean perubahan lokal saat terputus (`offlineQueue: Map<path, {hash, baseVersion}>` — hanya versi terakhir per path).
   - Saat tersambung: `hello` dengan `knownVersions` → server kirim snapshot diff → untuk setiap file di snapshot diff yang **juga** ada di offlineQueue: bila `baseVersion` < versi server dan server diubah orang lain → simpan lokal `.radar-conflict`, pakai isi server (PRD §8.3); selain itu kirim `file.update` dari antrean.
   - Test: putus → A menulis offline 2 file (satu miliknya, satu dipegang B yang juga berubah di server) → sambung → file milik A terkirim, file B menghasilkan `.radar-conflict`.

4. **MA-06 laporan sesi**: `GET /v1/report/session` (R3 §2.17) — agregasi event: task per status, commit (+link), blokir, keputusan (+median blokir→keputusan), review.flagged, p95 sinkron & cek kunci, durasi sesi. `markdown` rapi dengan tabel. Tool `session_report` mengembalikan markdown ini. Test snapshot dengan event fixture.

5. **SV-10 pemicu otomatis**: `radar agent --auto --max-cost <n> [--bob-cmd "bob"]` di PC C: pakai token PM dan polling `GET /v1/requests?status=terbuka` tiap 5 s (lebih sederhana daripada WebSocket, dan token mc tidak pernah dipakai proses ini) → untuk setiap request baru tanpa proposal, jalankan `bob run --mode pm-lead --max-cost <n> "<isi pm-rebutan.md + id request>"` (sintaks CLI Bob diverifikasi dari spike/docs; kalau berbeda, sesuaikan & catat). Satu proses sekaligus, timeout 120 s, log ke `.radar/agent.log`. Fitur di balik flag; default demo tetap manual (PRD R0).

6. **SY-06 hapus & ganti nama**: sync agent mengirim `file.delete` pada `unlink` (debounce; `unlink`+`add` < 150 ms dengan hash sama = rename → kirim delete lama + update baru). Server: `checkWrite` untuk delete, versi naik, `file.deleted` ke klien lain (hapus file lokal), `task_touch.deleted=1`, git worker `git rm`. Test integrasi.

7. **BC-05 PostToolUse**: endpoint `POST /v1/ai-edits` (R3 §2.20) → tandai `file_version.ai=1` untuk versi terbaru yang dibuat member itu dalam 10 s terakhir; event `ai.edit`. Feed menampilkan "Bob A" vs "A (manual)" berdasarkan tanda ini (reducer: `file.changed` + `ai.edit` yang berdekatan). Hook sudah ada dari fase 07.

8. **BC-06 Stop (P2, opsional)**: hook `stop.js` mengirim ringkasan satu baris giliran Bob (dari payload bila tersedia) → event `bob.turn` → feed. **Tidak melepas kunci.**

9. **Hardening umum** (sisihkan 45 menit):
   - Rate limit ringan `@fastify/rate-limit` untuk endpoint mc & proposals (mis. 60/menit/token).
   - Validasi ukuran body (1,5 MB WS, 256 KB REST).
   - Uji beban kecil: 5 member simulasi × 2 update/s selama 2 menit (`scripts/sim-3pc.ts --load`) → tidak ada error, p95 tetap dalam target (NFR-01, batas 5 anggota PRD §04).
   - Uji "server restart saat demo": restart Fly machine → semua klien tersambung lagi < 10 s, MC memuat ulang state.
   - Backup: job harian tidak perlu; cukup `radar-server export` sebelum rekaman.

10. **GATE 2 (11:00)**: bekukan fitur. Tandai di PROGRESS apa yang masuk/terpotong. Deploy final server & web. Tag git `v0.2.0-freeze`.

11. Commit `fase-12: hardening and P1 features`.

## Tambahan v0.3

- IN-02 kode undangan: `radar-server invite --member B` → `rdr_inv_<base64url>` + `radar join --invite <kode>`. App (Settings) menerima kode yang sama (koordinasi dengan Lane C).
- Endpoint `GET /v1/files/history` untuk UI-06 kalau belum ada.

## Verifikasi

```bash
pnpm test
pnpm sim -- --server local --runs 2
pnpm sim -- --server local --load --members 5 --duration 120
curl -s $S/v1/report/session -H "authorization: Bearer $TOK_C" | jq -r .markdown
```

## Kriteria selesai (DoD)

- [ ] Semua bug P0 dari E2E_REPORT fixed dengan test regresi.
- [ ] Setiap item P1 berstatus **selesai + test** atau **dipotong + tercatat** (tidak ada yang setengah jadi di main branch).
- [ ] Uji beban 5 anggota lulus; restart server pulih < 10 s.
- [ ] Tag `v0.2.0-freeze`, deploy final.

## Risiko & fallback

| Risiko | Fallback |
|---|---|
| Reconnect membuat regresi | Kerjakan di branch, merge hanya bila sim hijau 2×; kalau tidak, tunda (P1) |
| CLI `bob run` berbeda dari asumsi | SV-10 dipotong ke roadmap (sudah P1) |

## Catatan handoff

- Fase 14: daftar fitur terpotong → bagian "Roadmap" README & deck (PRD §16 R1/R2).
- Setelah freeze: hanya bugfix yang ditemukan saat rekaman video.
