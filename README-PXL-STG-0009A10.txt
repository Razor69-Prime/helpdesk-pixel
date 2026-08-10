PXL-STG-0009A10 — Validasi Cuti pada Assignment dari Laporan/WO

Perubahan:
- Menutup celah assignment teknisi dari halaman Laporan/WO.
- POST /api/tickets memeriksa cuti approved berdasarkan tanggal kerja.
- PATCH /api/tickets/:id memeriksa cuti approved saat Assign/Ganti Teknisi.
- Assignment diblokir dahulu dengan HTTP 409 dan reminder teknisi sedang cuti.
- Manager/Admin/Superadmin/Operator yang sudah memiliki akses assign dapat memilih Paksa Assign.
- Paksa Assign dari laporan dicatat pada activity log.
- Validasi Kanban/Timeline dari A8 tetap berlaku.
- Tidak mengubah Form Cuti, PDF, saldo cuti, atau modul lain.
- Tidak memerlukan SQL baru.

File berubah:
- server.js
- pxl-stg-0004f.js
- public/pxl-stg-0009a8-kanban-leave.js

Branch target: staging
Production tidak disentuh.
