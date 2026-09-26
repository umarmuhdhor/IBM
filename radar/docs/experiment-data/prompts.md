# Prompt eksperimen A/B (kata demi kata)

Dipakai **persis sama** di putaran A dan B (fase 13 langkah 1). Satu task = satu task baru di Bob IDE. Jangan menambah atau mengubah kalimat; kalau Bob bertanya, jawab hanya "Lanjutkan sesuai task." dan catat di log putaran.

- Putaran A: mode Bob **Code** (bawaan), clone biasa tanpa `.bob/` Radar.
- Putaran B: mode **Live Collab Coder**; PM memakai mode **Live Collab PM Lead**.
- Pembagian awal: A = task 1, 3, 5 · B = task 2, 4, 6. Di putaran B, pembagian mengikuti rencana main agent (dicatat, boleh berbeda).

## Coder

| Task | Prompt |
|---|---|
| 1 | Kerjakan Task 1 (Discount Coupon) di EXPERIMENT_TASKS.md. Ubah hanya file yang disebut di task itu. Setelah selesai jalankan npm run build dan perbaiki error dari perubahanmu. |
| 2 | Kerjakan Task 2 (Dark Mode) di EXPERIMENT_TASKS.md. Ubah hanya file yang disebut di task itu. Setelah selesai jalankan npm run build dan perbaiki error dari perubahanmu. |
| 3 | Kerjakan Task 3 (Shipping Cost) di EXPERIMENT_TASKS.md. Ubah hanya file yang disebut di task itu. Setelah selesai jalankan npm run build dan perbaiki error dari perubahanmu. |
| 4 | Kerjakan Task 4 (International Price Formatting) di EXPERIMENT_TASKS.md. Ubah hanya file yang disebut di task itu. Setelah selesai jalankan npm run build dan perbaiki error dari perubahanmu. |
| 5 | Kerjakan Task 5 (Order History Page) di EXPERIMENT_TASKS.md. Ubah hanya file yang disebut di task itu. Setelah selesai jalankan npm run build dan perbaiki error dari perubahanmu. |
| 6 | Kerjakan Task 6 (Item Quantity Limit) di EXPERIMENT_TASKS.md. Ubah hanya file yang disebut di task itu. Setelah selesai jalankan npm run build dan perbaiki error dari perubahanmu. |

Putaran B saja, sebelum task pertama tiap coder (prompt kit `bob-kit/prompts/coder-mulai.md`):

> Mulai kerja: panggil radar my_tasks, lalu kerjakan task aktifmu saja. Baca ulang file sebelum mengeditnya.

## PM (putaran B)

| Momen | Prompt |
|---|---|
| Awal | Tujuan sesi: Kerjakan 6 task di EXPERIMENT_TASKS.md. Tim: A dan B (coder). Mulai dengan team_status, baca file yang relevan, lalu susun rencana dengan propose_plan. Tidak boleh ada file yang sama di dua task; file bersama masuk queued_files. |
| Ada permintaan | Ada permintaan file baru. Baca list_requests, bandingkan kedua task dan file yang diperebutkan, lalu usulkan keputusan dengan propose_decision (alasan satu kalimat). |
| Task diajukan | Task <id> diajukan. Review dengan get_task_diff: cek ekspor yang berubah dan file pengimpornya milik task lain, lalu usulkan hasil review dengan propose_review. |
