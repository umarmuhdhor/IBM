# Log fase 12 — Hardening & fitur P1 (Lane Alief · Core)

- **Status:** [~] kode + test selesai dan hijau; sisa: deploy final + GATE 2 tag `v0.3.0-freeze` + uji restart server (LANGKAH MANUAL, butuh konfirmasi user).
- **Mulai:** Sab 26 Sep 2026 ~19:15 WITA (lebih awal dari slot Min 04:00; fase 10 bagian otomatis selesai lebih dulu) · worktree `IBM-f10rb`, branch `wip/core-f12` di atas `origin/main` `b9fc1c02`.
- **Model:** Claude Opus 5.5 (Claude Code), effort high.
- **Pra-cek:** `grep -rn "TODO(sync" app radar` kosong [x]; `origin/main` tidak berubah sejak PR #20 [x]; `docs/E2E_REPORT.md` belum ada (milestone 23:00 belum jalan) → item 1 menunggu.

## Ringkasan rencana (≤ 15 baris)

1. Urutan nilai fase 12: bugfix E2E → SV-09 → SY-07 → MA-06 → SV-10 → SY-06 → BC-05 → BC-06, lalu hardening (langkah 9) dan tambahan v0.3 (IN-02, UI-06).
2. Tiap item: test merah → kode → hijau; commit per item di branch kerja; satu PR fase 12 dari snapshot `lane/core-f12`.
3. SV-10 (`radar agent --auto`) bergantung pada CLI Bob Shell non-interaktif yang tidak bisa diverifikasi di Mac ini → dipotong ke roadmap (fallback yang sudah ditulis di spec).
4. Hardening: body cap REST 256 KB / WS 1,5 MB, rate limit 60 POST/menit/token untuk proposal + mc, uji beban 5 anggota × 2 update/s × 120 s.

## Checklist langkah

- [ ] 1. Bug dari `docs/E2E_REPORT.md` — laporan belum ada (milestone 23:00). Dikerjakan setelah milestone sebagai bugfix (boleh setelah freeze).
- [x] 2. SV-09: `services/stale.ts` — `member.stale` sekali per episode untuk coder pemegang kunci yang diam > `HEARTBEAT_EXPIRE_MS`; heartbeat berikutnya → `member.online` (episode selesai). Deadline alarm lewat provider; `POST /v1/locks/revoke` sudah ada dari fase 05. Banner + tombol cabut di MC = lane App (Aarief).
- [x] 3. SY-07: logika reconnect sudah ada sejak fase 04 (`knownVersions` + pending terakhir per path); ditambah test integrasi sesuai spec (edit offline milik A terkirim, file yang diubah B di server → `.radar-conflict`).
- [x] 4. MA-06: `GET /v1/report/session` (pm, mc) — task per status, commit (+link), blokir, keputusan, median blokir→keputusan, review, p95 sinkron, p95 cek kunci (server + RTT hook), durasi; Markdown ditest dengan inline snapshot.
- [—] 5. SV-10: **dipotong ke roadmap** (D-alief-08). Bob Shell tidak terpasang di Mac Core; sintaks non-interaktif `bob` belum diverifikasi.
- [x] 6. SY-06: `file.delete` (sync → server → `file.changed{deleted}` ke klien lain), tombstone versi, konflik bila server diubah orang lain, rename = delete + update; commit memakai entri tree `sha: null`; file baru yang dihapus sebelum commit tidak ikut.
- [x] 7. BC-05: `POST /v1/ai-edits` (coder) — tandai versi terbaru member ≤ 10 s sebagai `ai=1`, atau simpan `ai_mark` bila hook datang sebelum upload; event `ai.edit`. Tampilan "Bob A" vs "A (manual)" = reducer/app.
- [—] 8. BC-06 `bob.turn`: dipotong (opsional; `turn.end` lewat `bob.activity` sudah P0 dari fase 07).
- [x] 9. Hardening: body cap + rate limit + uji beban lokal. Uji restart server (`wrangler deploy` ulang) = LANGKAH MANUAL.
- [ ] 10. GATE 2: deploy final server + tag `v0.3.0-freeze` — LANGKAH MANUAL (aksi produksi, butuh konfirmasi user).
- [x] Tambahan v0.3: UI-06 `GET /v1/files/history`; IN-02 kode undangan (`admin invite`, `radar join --invite`, decoder di `@radar/common` untuk app).

## File dibuat/diubah (ringkas)

- Server: `services/{stale,report,ai-edits,history,rate-limit}.ts` (baru), `services/files.ts` (`applyDelete`), `services/proposals.ts` (file baru-lalu-hapus tidak di-commit), `http/routes/files.ts` (baru), `http/routes/team.ts` (report), `http/query.ts`, `http/errors.ts` (413/429, `readJson` cap), `http/routes.ts` (middleware rate limit), `ws/protocol.ts` (`file.delete`, cap frame, akhir episode stale), `ws/scheduler.ts` (alarm tidak pernah dimundurkan), `workspace-do.ts`, `db/schema.ts` (tabel `ai_mark`), `admin.ts`.
- Common: `schemas.ts` (`RATE_LIMITED`, `PAYLOAD_TOO_LARGE`), `invite.ts` (baru).
- Sync: `agent.ts` (delete/rename, unlink → processPath), `known.ts`, `cli.ts` (`--invite`), `scripts/sim-load.ts` (baru), `scripts/sim-3pc.ts` (`--load`, `writeReplay`).
- Scripts: `admin.ts` (`invite`), `vitest.config.ts` (alias workspace).
- Ref: `R2-skema-db.md` (`ai_mark`), `R1-struktur-repo.md` (`join --invite`, SV-10 dipotong).
- Test: `server/test/{stale,p1,hardening}.test.ts` (baru), `ws.test.ts`, `github.test.ts`, `db.test.ts`; `sync/test/{sync.int,cli}.test.ts`; `common/src/invite.test.ts`; `scripts/admin.test.ts`.

## Hasil verifikasi

| Perintah | Hasil |
|---|---|
| `pnpm -C radar lint` / `typecheck` | bersih |
| `pnpm -C radar test` | semua paket hijau (8 run vitest, 0 gagal) |
| `pnpm -C radar sim -- --server local --runs 2` | 2× hijau: p95 cek kunci 9 ms, dua penulis 0, `review.flagged` 1 |
| `pnpm -C radar sim -- --load --members 5 --duration 120` | hijau: 1200 tulis, 4800 diterapkan, 0 ditolak, 0 konflik, sinkron p50 163 / p95 219 / maks 316 ms, cek kunci p95 24 ms, semua disk sama |
| `curl $S/v1/report/session` | ditest di `p1.test.ts` (inline snapshot); uji di server deploy = setelah deploy final |

## Review

REVIEW_PLACEHOLDER

## DoD fase 12

- [ ] Semua bug P0 dari E2E_REPORT fixed dengan test regresi → menunggu laporan milestone.
- [x] Setiap item P1 **selesai + test** (SV-09, SY-07, MA-06, SY-06, BC-05, UI-06, IN-02) atau **dipotong + tercatat** (SV-10, BC-06 → D-alief-08).
- [~] Uji beban 5 anggota lulus (lokal) [x]; restart server pulih < 10 s → MANUAL.
- [ ] Tag `v0.3.0-freeze`, deploy final → MANUAL.

## LANGKAH MANUAL (butuh user)

1. **Deploy final server** (`pnpm -C radar deploy:server`) — aksi produksi; lakukan setelah PR fase 12 merge dan di luar jendela milestone. Set `HEARTBEAT_EXPIRE_MS=60000` hanya untuk gladi demo (catat di DEMO_SCRIPT), bukan default.
2. **Uji restart:** deploy ulang saat 2–3 klien tersambung → semua `radar` tersambung lagi < 10 s, MC memuat ulang state.
3. **Tag `v0.3.0-freeze`** di `main` setelah deploy (GATE 2, Min 11:00).
4. **Undangan:** untuk anggota baru, `ADMIN_SECRET=… pnpm -C radar admin invite --server <url> --member B` → kirim kode lewat DM pribadi (kode = token; merotasi token lama).

## Catatan handoff

- Lane App (Aarief): `member.stale` + `POST /v1/locks/revoke` siap untuk `StaleMemberBanner`; `ai.edit` untuk label "Bob A" vs "A (manual)"; `GET /v1/files/history` untuk UI-06; `decodeInvite()` di `@radar/common` untuk Settings (tempel kode `rdr_inv_…`).
- Lane Bob (Umar): `mark_ai_edit` → `POST /v1/ai-edits` kini 204 (bukan 404); `session_report` → `GET /v1/report/session`.
- Klien yang memanggil proposal/decision/revoke/cancel > 60×/menit menerima `429 RATE_LIMITED` + `Retry-After`.
- Mock server (`radar/scripts/mock-server.ts`) masih mengabaikan `file.delete` (P1); tidak dibutuhkan lane lain.
- Flaky: `mcp/test/server.int.test.ts` (lane Bob) sekali gagal saat seluruh suite paralel, hijau saat diulang (2×) dan sendiri.
- Fase 14: SV-10 + BC-06 masuk bagian "Roadmap" README & deck.
