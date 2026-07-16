PXL-REV-0007
Modul: Inventory Asset
Perbaikan:
- Mencegah respons sukses palsu ketika Supabase tidak aktif.
- Menambahkan endpoint /api/inventory/health.
- Memverifikasi item benar-benar dapat dibaca kembali setelah insert.
- Menampilkan status koneksi Supabase pada halaman Inventory.
- Menampilkan error konfigurasi/tabel secara jelas.

Penting:
1. Pastikan supabase-inventory.sql sudah dijalankan di Supabase SQL Editor.
2. Pastikan Vercel Environment Variables memiliki SUPABASE_URL dan SUPABASE_KEY.
3. Redeploy Vercel setelah mengubah Environment Variables.
