PXL-STG-0008A23 — Invoice: Perbaikan Referensi Nomor SO

Scope
- Khusus branch staging.
- Tidak mengubah main atau production.

Perubahan
1. Endpoint daftar Invoice hanya meminta kolom `id` dan `so_number` dari tabel `sales_orders`.
2. Referensi fallback ke kolom `order_number` dihapus karena kolom tersebut tidak ada pada skema staging.
3. Nomor SO pada daftar Invoice tetap ditampilkan melalui kolom `so_number`.

SQL
- Tidak ada SQL baru.

File perubahan
- pxl-stg-0008a-invoice-api.js
