PXL-REV-0010
Modul: Inventory Asset
Perbaikan: Supabase write persistence

Perubahan:
- Menambahkan header Prefer: return=representation pada insert/update Inventory.
- Memastikan Supabase mengembalikan record hasil penyimpanan.
- Berlaku untuk barang, transaksi stok, dan stock opname.
- Tidak ada perubahan SQL.

File berubah:
- db.js

Implementasi:
1. Salin db.js ke root project dan Replace.
2. Commit dan push ke GitHub.
3. Tunggu Vercel selesai deploy.
4. Hard refresh, tambah barang, lalu cek /api/inventory/health.
