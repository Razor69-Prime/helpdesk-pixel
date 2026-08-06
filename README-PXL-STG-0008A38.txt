PXL-STG-0008A38 — CUSTOMER CRM & REMARKS PAID INVOICE

Branch: staging

Perubahan:
1. Invoice Terbit memastikan master customer tersedia pada crm_customers.
2. Customer dicari berdasarkan ID CRM lalu nama; jika belum ada dibuat otomatis secara idempotent.
3. Relasi customer diperbaiki ke Sales Order, Work Order mirror, dan crm_invoices.
4. Invoice lama tanpa customer CRM diperbaiki saat daftar Invoice dibuka oleh Accounting/Admin/Superadmin.
5. Catat Bayar juga menjalankan repair customer dan Invoice CRM sebelum memperbarui saldo.
6. PDF Invoice berstatus Lunas menampilkan Remarks PAID.
7. PDF menampilkan Down Payment sesuai paid_amount dan Balance Due Rp0 untuk Invoice Lunas.

Tidak ada SQL baru. Production tidak disentuh.

