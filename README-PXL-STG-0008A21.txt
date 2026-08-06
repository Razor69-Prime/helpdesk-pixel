PXL-STG-0008A21 - Invoice Draft file_url NULL

Branch
- staging

Modul
- Invoice

Ringkasan perubahan
- Invoice terkait WO dapat disimpan sebagai Draft tanpa file.
- Invoice tanpa WO dapat disimpan sebagai Draft tanpa file.
- Jika tidak ada file yang diunggah, file_url dikirim ke database sebagai NULL,
  bukan string kosong.
- file_url hanya terisi setelah file benar-benar berhasil diunggah dan disimpan.

File berubah
- server.js
- README-PXL-STG-0008A21.txt
- VERIFICATION-PXL-STG-0008A21.txt

SQL
- Tidak ada SQL baru untuk dijalankan pada revisi ini.
- SQL berikut sudah berhasil dijalankan sebelumnya dan tidak perlu diulang:
  ALTER TABLE invoices ALTER COLUMN file_url DROP NOT NULL;

Batasan
- Hanya branch staging.
- Tidak menyentuh main atau production.

Perintah Git
git checkout staging
git status
git add server.js README-PXL-STG-0008A21.txt VERIFICATION-PXL-STG-0008A21.txt
git commit -m "PXL-STG-0008A21 fix(invoice): store null file url for draft"
git push origin staging
