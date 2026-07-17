PXL-REV-0022 — CUMULATIVE
Modul: Inventory Asset, Material Request, Manajemen Akun

Mencakup revisi:
- REV-0018: scan barcode pabrikan pada form tambah item.
- REV-0019: restock scan counter dan tracking Serial Number.
- REV-0020: scan berulang Material Request menambah quantity.
- REV-0021: hapus Material Request khusus Super Admin + permission checklist.
- REV-0022: item barcode yang belum terdaftar diarahkan ke form item baru; pencarian Inventory dan Material Request berdasarkan nama, SKU, barcode, product number, kategori, dan subkategori.

Perilaku scan item belum terdaftar:
1. Barcode angka 8–14 digit dipakai sebagai barcode pabrikan.
2. Form item baru otomatis dibuka dan barcode terisi.
3. Nama dan kategori tetap dipilih karena barcode pabrikan tidak menyimpan informasi tersebut di database aplikasi.
4. SKU otomatis dibuat backend saat Simpan walaupun tombol Generate tidak ditekan.
5. Bila kode hasil scan bukan angka, kode disimpan sebagai Product Number dan barcode internal angka dibuat otomatis.

Urutan implementasi:
1. Jalankan PXL-REV-0022-CUMULATIVE-INVENTORY-MR.sql pada Supabase SQL Editor.
2. Replace public/index.html, public/inventory.html, server.js, dan db.js.
3. Jalankan npm start untuk tes lokal.
4. Push ke GitHub.

Tidak ada dependency baru.
