PXL-STG-0009A15 — Service Worker + Sinkronisasi Data Cuti

Modul:
- PWA / Service Worker
- Form Cuti & Izin
- Admin HR — History & Sisa Cuti
- Report Form dan PDF Cuti

Perubahan:
1. Memperbaiki lifecycle service worker dan menaikkan cache ke helpdesk-v57.
2. Menghilangkan data GET lama setelah proses Setujui/Tolak/Tanda Tangan.
3. Menghitung ulang Terpakai dan Sisa dari cuti tahunan yang benar-benar Disetujui.
4. Menyamakan saldo pada History Cuti, kartu Form Cuti, Detail/Report Form, dan PDF.
5. Detail dan PDF mengambil snapshot terbaru sebelum ditampilkan atau diunduh.
6. Status approval tetap mensyaratkan hak akun Approve Cuti dan tanda tangan approver.

File yang berubah:
- public/sw.js
- public/pxl-stg-0009a-leave.js
- pxl-stg-0009a-leave-api.js

SQL: tidak ada.
Target: staging. Production tidak disentuh.

Setelah deploy, tutup seluruh tab staging lalu buka kembali dan lakukan Ctrl + Shift + R.
