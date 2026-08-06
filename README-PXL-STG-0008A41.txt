PXL-STG-0008A41 — Perbaikan Query Sinkronisasi Customer Invoice CRM

Branch target: staging

Masalah:
Sinkronisasi customer Invoice berhenti dengan PostgreSQL error 42703 karena
endpoint Invoice dan repair CRM mengurutkan tabel invoices memakai kolom
created_at, sedangkan kolom tersebut tidak tersedia pada skema invoices.

Perubahan:
1. Daftar Invoice diurutkan memakai issued_at, updated_at, dan uploaded_at.
2. Repair customer CRM diurutkan memakai invoice_date dan issued_at.
3. Seluruh logika repair customer CRM dari PXL-STG-0008A40 tetap dipertahankan.
4. Tidak ada perubahan flow WO, Material Request, pembayaran, atau PDF Invoice.
5. Tidak memerlukan SQL baru.

Setelah deploy:
1. Login sebagai Superadmin/Admin/Accounting/Manager.
2. Buka CRM > Master Customer.
3. Tunggu sinkronisasi selesai.
4. Periksa Cust21 dan Cust11 pada Master Customer dan Customer 360.

