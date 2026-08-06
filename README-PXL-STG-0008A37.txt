PXL-STG-0008A37 — Perbaikan Catat Bayar Invoice

Masalah:
Supabase mengembalikan PGRST204 karena kolom paid_at belum tersedia pada tabel invoices.

Perbaikan:
- Menambahkan kolom invoices.paid_at bertipe timestamptz secara idempotent.
- Meminta PostgREST memuat ulang schema cache setelah migration.
- Melengkapi migration dasar PXL-STG-0008 agar instalasi baru tidak mengalami error yang sama.

Urutan penerapan pada STAGING:
1. Jalankan PXL-STG-0008A37-MIGRATION.sql di Supabase SQL Editor.
2. Pastikan hasil eksekusi Success.
3. Extract/pasang file source revisi dan push ke branch staging.
4. Setelah deployment selesai, ulangi Catat Bayar pada Invoice terkait.

Catatan:
- SQL aman dijalankan ulang karena menggunakan IF NOT EXISTS.
- Tidak mengubah nominal, status, atau data Invoice yang sudah ada.
- Production tidak disentuh.

