PXL-REV-0028
Modul: Penyelesaian Tiket, Material Request, Inventory Notification

Perubahan:
1. Material yang belum terdaftar tidak lagi memblokir penyelesaian tiket.
2. Material tersebut tetap tersimpan pada material_request_forms sebagai item_type=unregistered_material.
3. Item Inventory yang ditemukan tetap mengurangi stok seperti sebelumnya.
4. Admin dan Super Admin menerima notifikasi untuk mendaftarkan item yang belum ada.
5. Teknisi menerima peringatan, tetapi tetap dapat melanjutkan ke tanda tangan dan menyelesaikan pekerjaan.

SQL: Tidak ada.

Cara implementasi:
- Replace public/index.html dan server.js.
- Jalankan npm start untuk tes lokal.
- Selesaikan tiket dengan satu item yang tidak ada di Inventory.
- Pastikan muncul peringatan, lalu modal tanda tangan tetap terbuka.
- Login Admin/Super Admin dan cek notifikasi.
- Cek material_request_forms: item tersimpan dengan inventory_status=pending_registration.
