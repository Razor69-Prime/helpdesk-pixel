PXL-ACC-0001 — Accounting Sales V1 UAT Candidate
=================================================

STATUS
- Branch: feature/accounting-sales-v1
- Implementasi dilakukan pada workspace terisolasi.
- main dan VPS production BELUM disentuh.
- Migration BELUM dijalankan ke production.

SCOPE
1. Modul standalone Accounting khusus Superadmin.
2. Menu internal: Dashboard, Transaksi Penjualan, Master Accounting.
3. Transaksi mempertahankan 16 kolom dan urutan workbook sumber:
   TANGGAL | KLASIFIKASI | SUB KLASIFIKASI | NAMA CUSTOMER - PEKERJAAN |
   TRANSAKSI | NOMINAL TRANSAKSI | HPP | NET | DPP | PPN | KATEGORI PRODUK |
   METODE PEMBAYARAN | STATUS PAID | PENJ. BARANG | PENJ. JASA | PIC
4. Accounting input angka sumber hanya NOMINAL TRANSAKSI/OMZET dan HPP.
5. DPP, PPN, NET dihitung server-side:
   DPP = round(Omzet / 1.11)
   PPN = Omzet - DPP
   NET = DPP - HPP
6. Klasifikasi: B2C / B2B / B2G / B2BG.
7. Sub klasifikasi: Perdagangan / Project / Operasional.
8. Auto-classification lokal: Master Customer -> Master PIC -> Manual.
9. Dashboard Accounting membaca data Accounting saja.
10. Export Excel per bulan/multi-bulan dengan satu sheet per periode dan layout spreadsheet.
11. Checklist Manajemen Akun: Accounting — Laporan Transaksi
    id: accounting_transaction_report
    V1 tetap Superadmin-only; checklist belum membuka akses role lain.

ISOLASI
- Accounting tidak membaca/menulis CRM.
- Accounting tidak membaca/menulis Sales Order.
- Accounting tidak membaca/menulis Inventory.
- Accounting tidak membaca/menulis Work Order.
- Accounting tidak membaca/menulis Project.
- Accounting tidak membaca/menulis Invoice.
- Dependency existing hanya session/auth dan shell/navigation PixelApps.

DATABASE / MIGRATION
File: PXL-ACC-0001-MIGRATION.sql

Tabel baru:
- accounting_sales_transactions
- accounting_sales_transaction_audit
- accounting_customers
- accounting_pics
- accounting_product_categories
- accounting_payment_methods

Untuk UAT staging:
1. Backup database staging sesuai prosedur existing.
2. Jalankan isi PXL-ACC-0001-MIGRATION.sql hanya pada database staging.
3. Restart/reload service staging bila diperlukan oleh deployment existing.
4. Jangan menjalankan migration pada production sebelum UAT disetujui.

UAT CHECKLIST
1. Login Superadmin -> menu Accounting muncul.
2. Login Admin/Manager/Accounting/HR/Sales/Teknisi -> menu Accounting tidak muncul.
3. Panggilan langsung /api/accounting/* oleh non-Superadmin -> 403.
4. Buka Accounting -> Dashboard berada di dalam module Accounting, bukan dashboard global.
5. Buat Master Customer dan PIC dengan Default Klasifikasi.
6. Buat transaksi: isi Omzet + HPP, pastikan NET/DPP/PPN otomatis.
7. Contoh kontrol: Omzet Rp10.000.000 + HPP Rp6.000.000 menghasilkan:
   DPP Rp9.009.009
   PPN Rp990.991
   NET Rp3.009.009
8. Cek auto-classification Customer -> PIC -> manual override.
9. Pastikan tabel transaksi memakai urutan 16 kolom persis seperti workbook.
10. Edit Omzet/HPP -> DPP/PPN/NET dan dashboard ikut berubah setelah refresh.
11. Hapus transaksi -> transaksi hilang dari data aktif dan audit delete tersimpan.
12. Cek filter Dashboard per periode, klasifikasi, sub klasifikasi, PIC, kategori.
13. Cek grafik klasifikasi, sub klasifikasi, kategori, PIC, Barang/Jasa, NET, trend bulanan.
14. Export satu bulan -> nama sheet bulan, kolom, Rupiah, header/border sesuai layout.
15. Export multi-bulan/lintas tahun -> sheet tidak bentrok dan setiap periode terpisah.
16. Review visual warna/lebar kolom terhadap workbook asli sebelum production approval.

STATIC / UNIT TEST
- node --check server.js
- node --check db.js
- node --check accounting-sales-v1.js
- node --check accounting-sales-store.js
- node --check accounting-sales-routes.js
- node --check accounting-sales-export.js
- node --check public/pxl-accounting-sales-v1.js
- node tests/accounting-sales-v1.test.js
- node tests/accounting-sales-export.test.js

ROLLBACK BOUNDARY
Aplikasi:
- Revert commit PXL-ACC-0001* atau lepaskan bundle/menu Accounting.
- Karena module standalone, rollback tidak memerlukan perubahan CRM/SO/Inventory/WO/Project/Invoice.

Database staging:
- Setelah data UAT dibackup bila diperlukan, tabel berprefix accounting_ dapat dihapus hanya bila rollback database memang diperlukan.
- Jangan drop tabel production tanpa backup dan approval eksplisit.

FILE UTAMA PERUBAHAN
- accounting-sales-v1.js
- accounting-sales-store.js
- accounting-sales-routes.js
- accounting-sales-export.js
- PXL-ACC-0001-MIGRATION.sql
- public/pxl-accounting-sales-v1.js
- public/index.html
- tests/accounting-sales-v1.test.js
- tests/accounting-sales-export.test.js
- README-PXL-ACC-0001.txt

CATATAN VISUAL
UI dan export mengikuti struktur, urutan, warna header oranye/cokelat, teks putih,
grid, dan format Rupiah yang dikunci dari sample. Pixel-perfect final tetap perlu UAT
berdampingan dengan workbook Excel asli sebelum dinyatakan final untuk production.
