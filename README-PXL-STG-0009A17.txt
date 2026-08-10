PXL-STG-0009A17 — Sinkronisasi final saldo cuti approved

Modul:
- Form Cuti / Izin
- Admin HR: History & Sisa Cuti
- Report/Detail/PDF Cuti

Perubahan:
1. Status dan jenis cuti lama dinormalisasi tanpa bergantung pada satu teks literal.
2. Bukti approval Manager lengkap memulihkan status lama yang tertinggal sebagai Diajukan.
3. Relasi saldo mendukung user ID dan nama akun untuk data legacy.
4. Durasi dihitung ulang dari tanggal jika duration_days kosong/tidak valid.
5. Saldo hasil perhitungan disinkronkan kembali ke leave_balances.
6. History menampilkan Status Last Request dan keterangan apakah mengurangi saldo.
7. Detail dan PDF tetap mengambil snapshot terbaru.
8. Cache frontend dinaikkan ke helpdesk-v59.

SQL: tidak ada.
Production: tidak disentuh.

Git:
git add pxl-stg-0009a-leave-api.js public\pxl-stg-0009a-leave.js public\index.html public\sw.js README-PXL-STG-0009A17.txt VERIFICATION-PXL-STG-0009A17.txt
git commit -m "fix(leave): reconcile approved requests with balances [PXL-STG-0009A17]"
git push origin staging
