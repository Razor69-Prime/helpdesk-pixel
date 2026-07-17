PXL-REV-0017
Modul: Inventory Barcode Label & Category Mapping

Fitur:
- Barcode internal otomatis berupa angka 12 digit: 25 + nomor urut 10 digit.
- SKU otomatis berdasarkan Main Kategori dan Subkategori.
- Barcode produk yang sudah ada dapat dimasukkan/di-scan terlebih dahulu.
- Barcode/SKU yang sudah terdaftar mengisi data barang secara otomatis.
- Daftar Inventory menampilkan nomor barcode dan tombol Lihat/Print.
- Label dapat diunduh sebagai SVG dan dicetak.
- Main kategori dan subkategori berupa dropdown yang saling terhubung.
- Material Request tetap dapat mencari berdasarkan barcode angka atau SKU.

Urutan implementasi:
1. Jalankan PXL-REV-0017-inventory-barcode-label-category.sql di Supabase SQL Editor.
2. Replace public/inventory.html, server.js, dan db.js.
3. npm start untuk tes lokal.
4. Push ke GitHub.

Catatan:
Barcode baru yang belum pernah terdaftar tidak dapat menebak kategori hanya dari angka. Pilih kategori/subkategori dari dropdown; setelah disimpan mapping akan tersedia dan scan berikutnya mengisi otomatis.
