PXL-REV-0035
Baseline: PXL-REV-0034
Jenis: Revisi production kumulatif

PENGGABUNGAN KONSEP
- CRM baseline: Customer, Customer 360, Kunjungan dan Project Tracker berada di CRM. Modul Sales tetap terpisah.
- Flow SO: nomor SO auto-generate, tidak dapat dihapus, status void/cancelled tetap menjadi history.
- WO: nomor dapat auto-generate atau input manual dari sistem WO eksternal; nomor wajib unik.
- MR: dibuat dari item SO, jasa tidak masuk gudang, wajib verifikasi dan tanda tangan teknisi.
- Tambahan material: tanpa upload foto, wajib approval internal dan persetujuan customer.
- Invoice: nilai dasar dari SO dan nilai tambahan yang disetujui; harga transaksi customer, bukan harga dealer/master inventory.
- Report: PDF dan Excel untuk modul utama.
- Invoice PDF: terhubung ke invoice CRM dan invoice yang sudah ada.
- Manajemen Akun: checklist menu dikelompokkan berdasarkan divisi.

FILE BERUBAH
- db.js
- server.js
- report-service.js
- package.json
- package-lock.json
- public/index.html

FILE BARU
- public/crm.html
- public/report-center-mockup.html
- public/assets/invoice-logo.png
- public/assets/invoice-signature.png
- PXL-REV-0035-MIGRATION.sql
- README-PXL-REV-0035.txt
- INSTALL-PXL-REV-0035.txt
- VERIFICATION-PXL-REV-0035.txt

DATABASE
Jalankan PXL-REV-0035-MIGRATION.sql satu kali melalui Supabase SQL Editor sebelum deploy.
SQL bersifat idempotent: CREATE TABLE/INDEX IF NOT EXISTS dan ADD COLUMN IF NOT EXISTS.

CATATAN
- Tidak ada folder .git dan tidak ada file .env dalam paket.
- Modul Sales tidak dilebur ke CRM.
- Tidak ada field upload foto pada tambahan material.
