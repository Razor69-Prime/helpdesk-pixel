PXL-REV-0014
Modul: Inventory Asset
Perubahan: Menampilkan tombol Hapus untuk akun Super Admin.

Penyebab:
Halaman Inventory belum mengambil hak akses dari endpoint /api/inventory/access,
sehingga tombol Hapus tetap tersembunyi meskipun backend sudah mengizinkan Super Admin.

File berubah:
public/inventory.html

SQL: Tidak ada.

Implementasi:
Salin public/inventory.html ke folder project dan pilih Replace.
Setelah deploy, lakukan Ctrl + F5 dan login ulang sebagai Super Admin.
