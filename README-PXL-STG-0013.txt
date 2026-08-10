PXL-STG-0013 — FIX PROJECT BOQ ACCESS
STAGING ONLY

Fokus:
- Memperbaiki submenu Input Total BOQ yang tidak muncul pada akun Manager.
- Memastikan Superadmin selalu mendapatkan seluruh akses Project Tracker, Project Report, dan Input Total BOQ.

Root cause:
- Script Project Report membangun submenu sebelum currentUser selesai dimuat.
- Saat role masih kosong, tombol role-specific tidak dibuat dan tidak direbuild setelah login.

Perubahan:
1. Navigation Project Report/BOQ sekarang menunggu currentUser siap.
2. Submenu direbuild otomatis jika role/permission berubah.
3. Saat tab Project Tracker dibuka, permission navigation direfresh kembali.
4. Role dinormalisasi agar Super Admin/superadmin dan Manager konsisten.
5. Superadmin: Project Tracker + Project Report + Input Total BOQ.
6. Manager: Project Tracker + Input Total BOQ secara default.
7. Teknisi: Project Report saja; BOQ read-only.
8. Akun lain: Input Total BOQ hanya jika custom permission project_boq_manage aktif.
9. Tidak memerlukan SQL.

File berubah/baru:
- public/index.html
- public/pxl-stg-0013-project-report.js
- README-PXL-STG-0013.txt
- VERIFICATION-PXL-STG-0013.txt
