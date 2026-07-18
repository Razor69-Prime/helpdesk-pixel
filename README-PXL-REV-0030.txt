PXL-REV-0030
Modul: Penyelesaian Tiket + Material Request

Perbaikan:
1. Menghapus field requester dari payload penyelesaian tiket karena tabel material_request_forms pada database aktif menggunakan created_by sebagai PIC.
2. Menambahkan schema fallback untuk INSERT/PATCH material_request_forms. Bila PostgREST mengembalikan PGRST204 untuk field tambahan yang belum tersedia, backend menghapus field tersebut dan mengulang penyimpanan.
3. Field inti tetap dipertahankan: id, ticket_id, wo_number, project_name, technician, created_by, date_out, date_return, items, status (selama tersedia pada schema aktif).
4. Pengurangan stok Inventory tetap dijalankan setelah Material Request berhasil tersimpan.
5. Akses Inventory untuk Teknisi tetap dibatasi seperti REV-0029.

SQL: Tidak ada.
Dependency baru: Tidak ada.

Cara implementasi:
- Replace db.js dan server.js pada project lokal.
- Jalankan npm start dan uji penyelesaian tiket dengan material.
- Setelah berhasil, commit dan push ke GitHub.
