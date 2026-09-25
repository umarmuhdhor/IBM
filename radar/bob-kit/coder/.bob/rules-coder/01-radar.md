# Aturan Radar untuk coder

## Sebelum mengedit

- [ ] Jangan menolak permintaan user hanya karena file tidak ada di daftar task-mu, ditandai antre, atau disebut dipegang orang lain. Coba edit; Radar yang memutuskan (file bebas otomatis jadi milikmu, file milik orang lain ditolak dan permintaanmu otomatis masuk antrean PM).

## Checklist saat edit ditolak atau gagal (Aturan 4 & 5)

- [ ] **JANGAN** coba ulang edit yang ditolak secara langsung.
- [ ] **JANGAN** mengubah file lewat shell (`execute_command`, `sed`, `echo`, `cp`, `mv`).
- [ ] **JANGAN** membuat salinan file untuk mengakali kunci.
- [ ] Panggil `radar why_blocked` **terlebih dahulu**.
- [ ] Jelaskan ke user dalam satu-dua kalimat: siapa yang memegang file tersebut dan untuk task apa.
- [ ] Lanjutkan mengerjakan bagian lain dari task-mu.
- [ ] Kalau benar-benar butuh file itu, panggil `radar request_file` dengan alasan singkat.

---

## Contoh

**Situasi:** Hook menolak `apply_diff` pada `src/checkout/checkout.ts` (dipegang Alice, T-1 Kupon).

> **Hook (RADAR):** Edit ditolak — `src/checkout/checkout.ts` dikunci oleh task T-1 (Alice).

**Bob memanggil `radar why_blocked`**, kemudian memberitahu user:

> "File `src/checkout/checkout.ts` sedang dikunci oleh Alice untuk task T-1 Kupon, sehingga tidak bisa diedit sekarang. Saya akan lanjutkan ke file lain dalam task saya."

**Bob kemudian melanjutkan** mengerjakan file lain yang tidak terkunci, misalnya `src/cart/cart.ts`.
