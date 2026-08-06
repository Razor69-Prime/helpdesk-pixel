PXL-STG-0008A31 — Tanda Tangan WO dan Sinkronisasi Invoice CRM

Branch: staging

Perubahan:
1. Penyelesaian WO wajib menyertakan tanda tangan teknisi dan customer.
2. Opsi bypass tanda tangan dihapus, termasuk untuk operator dan superadmin.
3. Validasi tanda tangan diterapkan pada UI dan server/API.
4. Invoice V1 yang diterbitkan wajib tersinkron ke tabel crm_invoices.
5. Data CRM mencakup nomor Invoice, SO, WO, customer, item, nilai, tanggal, jatuh tempo, dan saldo.
6. Pembayaran Invoice V1 ikut memperbarui status dan saldo invoice CRM.
7. Penerbitan ditolak bila SO/WO belum mempunyai relasi CRM yang valid.
8. Invoice Terbit lama yang belum ada di CRM dibackfill otomatis saat daftar Invoice dibuka oleh Accounting/Admin/Superadmin.

SQL: tidak ada.
Production/main: tidak disentuh.
