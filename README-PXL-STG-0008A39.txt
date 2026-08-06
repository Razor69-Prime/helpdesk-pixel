PXL-STG-0008A39 — REPAIR MASTER CUSTOMER CRM DARI INVOICE

Branch: staging

Masalah:
- Invoice Cust21 dan Cust11 sudah Terbit/Lunas serta sudah mempunyai crm_invoices.customer_id.
- ID tersebut dapat menunjuk record master CRM yang sudah tidak ada atau tidak sesuai nama.
- Repair A38 hanya memeriksa customer_id terisi, sehingga data dianggap sudah sinkron dan dilewati.

Perbaikan:
- Backfill memvalidasi customer_id terhadap record nyata di crm_customers.
- Relasi kosong atau yatim diperbaiki otomatis dari snapshot nama customer Invoice.
- Candidate customer berdasarkan ID hanya dipakai jika namanya benar-benar cocok.
- Pencarian nama dibuat case-insensitive dan menghindari customer ganda.
- Customer nonaktif yang terkait Invoice diaktifkan kembali.
- crm_invoices, Sales Order, dan Work Order diarahkan ke master customer yang valid.
- Urutan sumber Customer pada form Invoice diperbaiki memakai kolom schema `name`.

Tidak ada SQL baru. Production tidak disentuh.

Setelah deploy:
1. Login Accounting/Admin/Superadmin.
2. Buka menu Invoice sekali untuk menjalankan repair Invoice lama.
3. Tunggu daftar selesai dimuat.
4. Buka CRM lalu refresh.
5. Pastikan Cust21 dan Cust11 tampil di Master Customer dan Customer 360.
