PXL-STG-0009A8 — Integrasi Form Cuti/Izin dengan Kanban Teknisi

Modul:
- Module 09 Form Cuti/Izin
- Kanban & Timeline Teknisi

Perubahan:
1. Cuti berstatus approved dibaca langsung oleh API Kanban.
2. Teknisi cuti ditandai OFF/Cuti pada Kanban dan Timeline.
3. Teknisi cuti dikeluarkan dari jumlah kapasitas serta sisa slot harian.
4. WO yang telah terjadwal pada teknisi cuti menampilkan peringatan konflik.
5. Penjadwalan/assignment baru ke tanggal cuti diblokir oleh server.
6. Manager/Admin/Superadmin dapat memilih Paksa Assign setelah menerima reminder.
7. Paksa Assign dicatat pada history perubahan jadwal.

File berubah:
- pxl-stg-0007.js
- pxl-stg-0004f.js
- public/pxl-stg-0009a8-kanban-leave.js

SQL:
- Tidak ada. Menggunakan tabel leave_requests dari PXL-STG-0009A/A1.

Batas perubahan:
- Hanya staging.
- Tidak mengubah PDF Form Cuti, saldo, approval, SO, quotation, item, harga, dan status/aksi teknisi existing.
