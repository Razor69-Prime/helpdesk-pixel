PXL-REV-0016
Modul: Teknisi, Material Request, Inventory Asset

Perubahan:
- Submenu Teknisi Scan dihapus dari halaman Inventory.
- Scan Barcode dipindahkan ke Form Material Request pada setiap WO.
- SKU otomatis menjadi nilai barcode saat barang baru dibuat.
- Teknisi dapat scan barcode atau mengetik SKU secara manual.
- Item hasil scan terhubung ke inventory_items.
- Saat MR disimpan, stok berkurang dan Log Stok dibuat melalui transaksi Supabase.
- Jika stok tidak cukup, seluruh pengeluaran Inventory dibatalkan dan MR baru dibersihkan.

Urutan implementasi:
1. Jalankan PXL-REV-0016-material-request-inventory-scan.sql di Supabase SQL Editor.
2. Replace public/index.html, public/inventory.html, server.js, dan db.js.
3. npm start untuk tes lokal.
4. Buat barang baru dan Generate SKU. Barcode otomatis sama dengan SKU.
5. Buka Form Material Request, pilih WO, scan barcode atau masukkan SKU.
6. Simpan dan cek stok serta Log Stok Inventory.
