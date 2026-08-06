PXL-STG-0009A — MODULE 09 FORM CUTI / IZIN

Ruang lingkup:
- Modul terpisah di kelompok Administrasi.
- Submenu Form Cuti dan Admin HR.
- Semua role dapat melihat/membuat Form Cuti.
- Pembuat hanya dapat mengedit form miliknya; Manager dapat mengedit semua form.
- Approval hanya oleh Manager.
- Admin HR (Manager/Admin/Superadmin) mengatur saldo awal dan melihat last request, terpakai, dan sisa cuti.
- Nama pemohon, PIC Incharge, dan approver berasal dari akun login.
- Setiap pihak menandatangani bagiannya sendiri menggunakan pola TTD Material Request.
- PDF menggunakan A5 landscape dan mengikuti susunan gambar referensi.

Urutan instalasi:
1. Jalankan PXL-STG-0009A-MIGRATION.sql pada Supabase staging.
2. Extract paket ke root project dan overwrite.
3. Commit/push ke branch staging.

Catatan saldo:
- Saldo hanya berkurang ketika Cuti Tahunan disetujui Manager.
- Izin, Cuti Bersalin, dan Lainnya tidak mengurangi saldo tahunan.
- Production tidak disentuh.
