PXL-STG-0008A22 — Invoice: Terbitkan & Referensi SO/WO

Scope
- Khusus branch staging.
- Tidak mengubah main atau production.

Perubahan
1. Validasi Terbitkan Full Payment sekarang menganggap status WO `done` sebagai selesai.
   Status selesai legacy lain tetap didukung: selesai, completed, closed, dan finished.
2. Daftar Invoice sekarang menampilkan nomor Sales Order (SO).
3. Daftar Invoice sekarang menampilkan seluruh nomor Work Order (WO) yang terhubung
   ke setiap Invoice, termasuk lebih dari satu WO.
4. Ukuran font dan padding tabel daftar Invoice diperkecil agar kolom tambahan tetap rapi.
5. Pencarian daftar Invoice dapat mencari nomor SO dan WO.
6. Cache-bust halaman Invoice diperbarui ke PXL-STG-0008A22 agar tampilan baru dimuat.

SQL
- Tidak ada SQL baru.

File perubahan
- pxl-stg-0008a-invoice-api.js
- public/invoice-v1-a16.html
- public/pxl-stg-0008a6-invoice-menu.js
