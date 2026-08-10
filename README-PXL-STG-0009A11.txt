PXL-STG-0009A11 — PERBAIKAN BATAS OFF CUTI DAN IDENTITAS TEKNISI

Modul: Form Cuti/Izin ↔ Kanban dan Assignment Laporan/WO

Perubahan:
1. Teknisi tetap OFF sampai satu hari sebelum Tanggal Kembali Bekerja.
2. Contoh: akhir cuti 15 Agustus, kembali bekerja 17 Agustus → tanggal 16 masih OFF.
3. Timeline mingguan menampilkan OFF/CUTI pada seluruh tanggal efektif tersebut.
4. Validasi assignment menggunakan alias akun teknisi: user ID, nama, full name, dan username.
5. Assign dari Kanban maupun Laporan/WO diblokir pada masa OFF.
6. Manager/Admin/Superadmin tetap dapat Paksa Assign setelah reminder.
7. Layout PDF tidak diubah.
8. Tidak memerlukan SQL baru dan production tidak disentuh.

Pemasangan:
- Extract ZIP ke root project dan pilih Replace/Overwrite.
- Push ke branch staging.
- Setelah deployment, lakukan Ctrl+F5.

