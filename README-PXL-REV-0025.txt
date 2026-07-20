PXL-REV-0025
Modul: Material Request & Inventory

Perubahan:
1. Pengembalian otomatis dihitung: Pengambilan - Pemakaian.
2. Saat update pemakaian, sisa material otomatis kembali ke stok Inventory dan masuk Log Stok.
3. Semua akun dapat membuat Material Request secara default.
4. PIC Material Request dan Teknisi otomatis memakai nama akun yang login.
5. Material Prepare bersifat opsional dan hanya dapat dipilih dari Admin, Akunting, atau Manager aktif.

Implementasi:
1. Jalankan PXL-REV-0025-material-request-usage-return-flow.sql di Supabase SQL Editor.
2. Replace public/index.html, server.js, dan db.js.
3. Jalankan npm start untuk tes lokal.
4. Buat MR, simpan pengambilan, lalu edit dan isi Pemakaian.
5. Pastikan Pengembalian terisi otomatis dan stok Inventory bertambah sesuai sisa.
