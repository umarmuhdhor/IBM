# Log fase 14 — Submission, bagian Lane Umar · Bob

- **Status:** [~] dokumen lane Bob selesai; sisa = gladi + rekaman (manual), `evidence:check` hijau (menunggu slice I3 Imelda), keputusan eksperimen fase 13.
- **Mulai:** Min 27 Sep 2026 08:45 WITA · branch `lane/bob` di atas `main` 8e813fd2.
- File terpisah dari `fase-14.md` (fase bersama), sama seperti `fase-10-bob.md` (D-umar-04).

## Dikerjakan

- [x] `BOB_DEVELOPMENT.md` (root): Bob sebagai runtime (mode, tabel hook, 13 tool MCP, governance, hasil uji vs Worker asli), Bob sebagai pembangun (tabel slice per anggota), angka (screenshot, trailer, Bobcoin per anggota), temuan spike Bob IDE 2.2, catatan `.bobignore`, watsonx: tidak dipakai.
- [x] IBM Bob Usage Statement di `radar/docs/SUBMISSION.md` (475 kata, batas 500). Bagian lain file itu milik Imelda.
- [x] `pnpm -C radar evidence:check` disambungkan ke `scripts/evidence-check.ts` (sebelumnya `echo`) + opsi `--write-index` → `bob_sessions/INDEX.md` digabung dari `index/<nama>.md` (25 baris).
- [x] `lane/bob` dibersihkan: commit cache `.gradle` (`62c15b98`) dibuang, lane = `main`.

## Status bukti Bob (Min 09:00)

`pnpm -C radar evidence:check`: **1 pelanggaran** — `imelda` punya 2 screenshot, butuh ≥ 3 (slice I3 Long Description belum ada). Anggota lain aman: Alief 4, Aarief 4, Umar 15. Trailer `Bob-Assisted` di `main`: 14, semua menunjuk file yang ada.

Screenshot terbaik untuk form lablab (1–3 per anggota, usulan):

| Anggota | Pilihan |
|---|---|
| Alief | `uaai_alief_task02_check_write_summary.png` (mesin kunci), `uaai_alief_task01_toko_demo_summary.png` |
| Umar | `uaai_umar_task03_hooks_summary.png` (hook), `uaai_umar_task06_mcp_pm_summary.png` (tool PM), `uaai_umar_task10_coder_block_real_server_summary.png` (Bob diblokir di server asli) |
| Aarief | `uaai_aarief_task01_orca_onboarding_summary.png` (Orca 23k file), `uaai_aarief_task03_radar_ui_components_summary.png` |
| Imelda | `uaai_imelda_task01_replay_player_demo_summary.png`, `uaai_imelda_task02_landing_warm_paper_summary.png` (+ I3 nanti) |

## LANGKAH MANUAL: gladi 4 Mac (pengganti milestone fase 10, sebelum rekaman)

Alur join sekarang memakai kode (IN-03, `deploy.md` §3.2, §4.4, §5). Tidak ada token yang diketik di chat.

1. **Alief:** clone toko-demo di commit yang disepakati, lalu `admin init --repo-dir <clone> --force` **tanpa** `--member` (`deploy.md` §3.2). Simpan token `mc` + kode owner di password manager.
2. **Alief:** `pnpm -C radar admin code --server https://live-collab.afindo-mi01.workers.dev` empat kali → 4 kode terbuka, kirim satu per orang lewat DM.
3. **PC C (Mission Control):** app → Live Collab → Settings → **Workspace owner? Use your owner code** → Connect.
4. **Tiap PC:** app → Live Collab → **Multiplayer** → Join a workspace: kode, nama, peran (A, B, D = Coder; C = PM) → Join → **Open in IBM Bob** → **Trust** → mode Live Collab Coder / PM Lead. Tanpa app: `curl -fsSL https://live-collab.afindo-mi01.workers.dev/j/<KODE> | sh`.
5. **C (PM Lead):** "Tujuan sesi: Tambah fitur kupon diskon (total dihitung di src/checkout/checkout.ts) dan dark mode. …" (prompt `pm-rencana.md`) → cek `checkout.ts` masuk task A → Setujui di Mission Control.
6. **A / B:** "Kerjakan task aktifmu: kupon diskon di checkout." / "… dark mode." → file berubah di PC lain, ✎ di Mission Control.
7. **B:** "Tampilkan total dengan diskon kupon di checkout.ts juga" → blokir (hook) atau `request_file` → kartu permintaan → C: `pm-rebutan.md` → antre otomatis.
8. **A:** "Ubah calculateTotal agar menerima ongkos kirim, perbarui pemanggilnya di file task-mu, lalu ajukan task." → C: `pm-review.md` → setujui + beri tahu B → Setujui → commit di GitHub.
9. **D (Umar):** satu task kecil independen (mis. `utils.ts`) + pegang OBS / hitung mundur. Kartu D harus muncul di Team, Files & locks, dan feed.
10. Catat waktu tiap adegan, Bobcoin per akun, semua keanehan. Setelah itu: `admin export` → `radar/packages/server/test/fixtures/events.live-1.json` (untuk replay Imelda), bukti Bob Umar mulai NN 16.

Kalau ada yang macet (join, trust, sync, blokir tidak muncul): catat gejalanya, perbaiki sebelum take pertama. Alur 4 Mac belum pernah dicoba sebelumnya.

## Keputusan terbuka (Umar)

- Fase 13: jalankan putaran A/B versi kecil sebelum rekaman, atau lewati dan tulis jujur di submission ("eksperimen tidak dijalankan; angka dari simulator dan uji otomatis"). Script dan protokol ada di `radar/docs/EXPERIMENT.md`.
