PXL-STG-0009A9 — Tanggal Kembali Bekerja Manual

Modul: Form Cuti / Izin

Perubahan:
- Tanggal Kembali Bekerja diisi manual melalui input tanggal.
- Total Hari tetap dihitung otomatis secara inklusif dari Tanggal Mulai sampai Tanggal Selesai.
- API menyimpan tanggal kembali manual saat membuat dan mengedit pengajuan.
- Tanggal kembali wajib diisi dan tidak boleh lebih awal dari Tanggal Selesai.
- Layout PDF dan integrasi Kanban tidak diubah.

SQL: Tidak ada.
Target: staging. Production tidak disentuh.

Instalasi:
1. Extract ZIP ke root project dan pilih Replace/Overwrite.
2. Jalankan:
   git add pxl-stg-0009a-leave-api.js public\pxl-stg-0009a-leave.js README-PXL-STG-0009A9.txt VERIFICATION-PXL-STG-0009A9.txt
   git commit -m "fix(leave): make return-to-work date manual [PXL-STG-0009A9]"
   git push origin staging
3. Setelah deployment, lakukan Ctrl + F5.
