PXL-REV-0015
Modul: Inventory Asset
Perbaikan: Item Inventory tidak terhapus.

Penyebab:
Kode lama mencoba membuat log dengan transaction_type DELETE_ITEM, sedangkan constraint tabel hanya menerima RESTOCK, REQUEST, RETURN, dan OPNAME. Insert log gagal sehingga proses nonaktifkan item tidak pernah dijalankan.

Perbaikan:
- Penghapusan dijalankan melalui RPC Supabase inventory_soft_delete.
- Stok dinolkan, log dibuat, dan item dinonaktifkan dalam satu transaksi database.
- Jika salah satu langkah gagal, seluruh proses dibatalkan.
- Backend memverifikasi bahwa item sudah tidak aktif.
- Hapus tetap khusus Super Admin.

Urutan implementasi:
1. Jalankan PXL-REV-0015-fix-inventory-delete.sql di Supabase SQL Editor.
2. Replace db.js, server.js, dan public/inventory.html.
3. npm start untuk tes lokal.
4. Push ke GitHub.
