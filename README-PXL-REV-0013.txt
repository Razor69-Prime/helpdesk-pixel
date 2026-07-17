PXL-REV-0013
Modul: Inventory & Manajemen Akun

Fitur:
- SKU generator berdasarkan Kategori + Sub Kategori.
- Import Excel dapat mengisi SKU atau mengosongkannya agar digenerate otomatis.
- Hapus Inventory hanya untuk Super Admin; dilakukan soft-delete agar log tetap aman.
- Custom checklist fitur Inventory di Manajemen Akun.

Urutan implementasi:
1. Jalankan PXL-REV-0013-inventory-sku-permission-delete.sql di Supabase SQL Editor.
2. Replace public/index.html, public/inventory.html, server.js, dan db.js.
3. Push GitHub dan tunggu Vercel Ready.
4. Ctrl+F5.
