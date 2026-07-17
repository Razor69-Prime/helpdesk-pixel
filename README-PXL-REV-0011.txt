PXL-REV-0011
Modul: Inventory Asset
Perubahan: Menambahkan RLS policy agar operasi simpan Inventory diizinkan.

Cara menjalankan:
1. Buka Supabase Dashboard.
2. Masuk ke SQL Editor.
3. Pilih New Query.
4. Salin seluruh isi file PXL-REV-0011-inventory-rls-policy.sql.
5. Klik Run.
6. Kembali ke aplikasi dan lakukan Ctrl + F5.
7. Tambahkan satu barang.
8. Cek Table Editor > inventory_items atau endpoint /api/inventory/health.

Tidak ada file source code yang perlu diganti.
Tidak perlu push GitHub karena revisi ini hanya perubahan database Supabase.
Modul lain tidak diubah.