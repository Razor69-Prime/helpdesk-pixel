PXL-STG-0010 — PROJECT TRACKER > PROJECT REPORT
Environment: STAGING ONLY
Baseline: PXL-STG-0009A17
Production: JANGAN DIJALANKAN / JANGAN DISENTUH

RINGKASAN
- Tambah submenu Project Report di dalam menu Project Tracker.
- Project Report otomatis membaca seluruh project existing dari tabel projects.
- Total BOQ diinput manual per project.
- Achievement dicatat per tanggal sebagai history.
- Kalkulasi otomatis:
  Total Done = SUM seluruh achievement
  Remain = Total BOQ - Total Done
  Progress = Total Done / Total BOQ * 100%
  Today Achievement = SUM achievement tanggal hari ini (Asia/Makassar)
- Edit history achievement tersedia untuk role Project Tracker.
- Hapus history achievement dibatasi ke Superadmin/Manager/Admin.
- Validasi Total Done tidak dapat melebihi Total BOQ.
- 3 dummy project disediakan melalui migration untuk UAT staging.

DUMMY PROJECT
1. [DUMMY] CCTV Desa Tumbak Bayuh — BOQ 120 / Today 15 / Done 60 / Remain 60 / 50%
2. [DUMMY] Jaringan Villa Cemagi — BOQ 80 / Today 8 / Done 64 / Remain 16 / 80%
3. [DUMMY] CCTV Restaurant Canggu — BOQ 50 / Today 5 / Done 20 / Remain 30 / 40%

FILE BERUBAH / BARU
- db.js
- server.js
- public/index.html
- public/pxl-stg-0010-project-report.js [BARU]
- PXL-STG-0010-MIGRATION.sql [BARU]
- README-PXL-STG-0010.txt [BARU]
- VERIFICATION-PXL-STG-0010.txt [BARU]

INSTALASI STAGING
1. Backup database staging.
2. Jalankan PXL-STG-0010-MIGRATION.sql hanya pada Supabase STAGING.
3. Deploy source PXL-STG-0010 ke Vercel project STAGING.
4. Hard refresh browser.
5. Buka Project Tracker > Project Report.
6. Jalankan checklist VERIFICATION-PXL-STG-0010.txt.

CATATAN
- Tidak ada perubahan pada Inventory, WO, Sales Order, Cuti/Izin, CRM, Invoice, atau Production.
- Project existing yang belum punya BOQ tetap tampil dengan status "Belum diisi".
