PXL-REV-0012
Modul: Inventory Asset

Perubahan:
1. Import Excel dengan preview, validasi, dan konfirmasi cut off stok.
2. Proses cut off menggunakan RPC Supabase atomik: jika satu baris gagal, seluruh import dibatalkan.
3. Export Excel mencakup sheet Stok Inventory dan Log Stok.
4. Menyediakan file template Excel dari aplikasi.
5. Mengaktifkan scan barcode kamera dan fallback scanner USB/input manual.

File yang berubah:
- public/inventory.html
- server.js
- db.js
- package.json
- package-lock.json

SQL baru:
- PXL-REV-0012-inventory-excel-cutoff.sql

Urutan implementasi:
1. Jalankan SQL di Supabase SQL Editor.
2. Salin/replace seluruh file revisi ke folder project lokal.
3. Jalankan npm install.
4. Commit dan push ke GitHub.
5. Tunggu deployment Vercel selesai, lalu Ctrl+F5.

Catatan scan barcode:
- Kamera memerlukan HTTPS dan izin kamera browser.
- Deteksi otomatis memakai BarcodeDetector pada browser yang mendukungnya.
- Jika browser tidak mendukung, gunakan scanner barcode USB atau input barcode manual pada modal yang sama.
