PXL-STG-0009A14 — Perbaikan Login Setelah A13

Masalah:
- public/index.html pada paket A13 terpotong di tengah JavaScript.
- Browser gagal mendefinisikan doLogin(), sehingga tombol Masuk tidak berfungsi.

Perbaikan:
- Memulihkan public/index.html dari versi lengkap terakhir.
- Memasang kembali checklist Approve Cuti milik A13.
- Menaikkan versi pemuatan script cuti untuk membersihkan cache browser.
- Tidak mengubah API/login, PDF, Kanban, atau database.

Instalasi:
Extract ke root project dan pilih Replace/Overwrite, lalu deploy ke branch staging.
