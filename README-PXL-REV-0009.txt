PXL-REV-0009
Modul: Inventory API Health Check

Perubahan:
- Endpoint GET /api/inventory/health dapat diakses tanpa Authorization header.
- Endpoint hanya menguji koneksi dan keberadaan tabel inventory; tidak membuka data inventory.
- Endpoint Inventory lainnya tetap dilindungi autentikasi JWT.

File berubah:
- server.js

SQL: Tidak ada.
