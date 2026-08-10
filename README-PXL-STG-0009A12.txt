PXL-STG-0009A12 — Blokir dan Notifikasi Edit Assignment Teknisi Cuti

Modul:
- Laporan / Work Order — Assign dan Ganti Teknisi
- Kanban — Edit jadwal dan teknisi

Perubahan:
1. Semua bentuk field assignment divalidasi: technicians, technician, assigned_to,
   assigned_to2, technician_1, dan technician_2.
2. Teknisi dengan cuti approved pada tanggal kerja tidak dapat disimpan melalui
   edit/ganti teknisi biasa.
3. Sistem menampilkan notifikasi berisi nama teknisi, tanggal pekerjaan, dan
   periode cuti.
4. Jika pengguna membatalkan notifikasi, respons konflik dipertahankan sehingga
   frontend tidak menganggap perubahan berhasil dan data lama tetap tersimpan.
5. Manager/Admin/Superadmin tetap memiliki pilihan Paksa Assign sesuai keputusan
   integrasi sebelumnya. Role lain hanya mendapat notifikasi blokir.
6. Cache script dinaikkan ke PXL-STG-0009A12.

Tidak ada perubahan pada Form Cuti, PDF, saldo, approval, atau database.
Tidak memerlukan SQL baru. Production tidak disentuh.

Instalasi:
1. Extract ZIP ke root project staging dan pilih Replace/Overwrite.
2. Commit dan push file sesuai perintah pada handoff.
3. Setelah deployment, lakukan Ctrl + F5.

