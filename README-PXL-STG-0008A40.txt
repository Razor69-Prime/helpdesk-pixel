PXL-STG-0008A40 — Repair Master Customer CRM dari Invoice

Branch: staging

Perubahan:
- CRM menjalankan sinkronisasi customer sebelum memuat Master Customer.
- Invoice Terbit, Sebagian, dan Lunas dipindai, termasuk data lama.
- Master crm_customers dibuat/diperbaiki sebelum daftar CRM ditampilkan.
- Relasi Invoice, Sales Order, dan Work Order tetap diperbarui secara idempotent.
- Kegagalan tidak lagi disembunyikan; nomor Invoice dan penyebab dikembalikan server.
- Proses dilakukan berurutan untuk mencegah duplikasi customer.
- Mencakup seluruh perbaikan PXL-STG-0008A39.
- Tidak memerlukan SQL baru.

Uji staging:
1. Login sebagai Superadmin/Admin/Accounting/Manager.
2. Buka CRM -> Master Customer.
3. Tunggu proses muat selesai.
4. Pastikan Cust21 dan Cust11 muncul.
5. Buka Customer 360 dan periksa histori Invoice.

