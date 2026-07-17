PXL-REV-0006 — Perbaikan tombol Simpan Inventory

Perubahan:
- Tombol Simpan memakai type=button dan handler yang lebih stabil.
- Menambahkan validasi nama, stok awal, minimum stok, dan qty restock.
- Menambahkan status "Menyimpan..." untuk mencegah klik ganda.
- Menambahkan timeout API 15 detik dan pesan error yang jelas.
- Memastikan cookie sesi dikirim melalui credentials: same-origin.

File berubah:
- public/inventory.html

SQL:
- Tidak ada.
