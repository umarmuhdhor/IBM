# Keputusan & deviasi (append-only)

Setiap perubahan kontrak (`plan/ref/*`), stack, atau scope dicatat di sini. Jangan menghapus entri lama; kalau keputusan dibatalkan, tambah entri baru yang merujuk entri lama.

Format:

```text
## D-<nomor> · <tanggal WITA> · fase <XX> · <judul singkat>
- Keputusan:
- Alasan:
- Alternatif yang ditolak:
- Dampak ke paket/fase lain:
- File ref/ yang diperbarui:
```

---

## D-000 · 25 Sep 2026 · plan · Keputusan awal dari penyusunan plan

- Keputusan:
  1. Monorepo pnpm di root repo ini; repo contoh `examples/toko-demo` menjadi repo GitHub terpisah yang disinkronkan Radar.
  2. Token disimpan di tabel `token` (bukan kolom `member.token_hash` seperti ERD PRD §13) supaya token Mission Control (`kind=mc`) dan token anggota berada di satu tempat.
  3. "Bebas" dan "Dicabut" tidak disimpan sebagai baris `lock`: bebas = tidak ada baris, dicabut = event `lock.revoked` lalu baris dihapus.
  4. Endpoint tambahan di luar PRD §13: `GET /v1/state`, `GET /v1/team`, `GET /v1/requests`, `GET /v1/proposals`, `POST /v1/requests`, `POST /v1/notify`, `GET /v1/activity`, `POST /v1/locks/revoke`, `POST /v1/tasks/:id/activate`, `POST /v1/tasks/:id/cancel`, `POST /v1/ai-edits`, `GET /v1/report/session`, `GET /v1/files/history`. Semua dibutuhkan tool MCP / Mission Control yang disebut PRD.
  5. Coder tanpa task aktif yang menulis file bebas mendapat task implisit `adhoc` (supaya invariant "kunci selalu dipegang task" tetap berlaku).
  6. Reducer event (`applyEvent`) tinggal di `@radar/common` dan dipakai bersama oleh Mission Control live dan replay.
- Alasan: menjaga satu sumber kebenaran untuk live + replay, dan menutup celah yang tidak dijelaskan PRD.
- Dampak: fase 02, 03, 05, 09, 11.
- File ref/ yang diperbarui: R2, R3, R4.

<!-- Entri baru di bawah baris ini -->
