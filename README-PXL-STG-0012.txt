PXL-STG-0012 — Project BOQ Access Separation
STAGING ONLY — production tidak disentuh.

Fokus:
1. Project Report khusus Teknisi (Super Admin tetap dapat melakukan verifikasi staging).
2. BOQ pada Project Report read only.
3. Teknisi hanya dapat input Today Achievement per item/jasa.
4. Menu terpisah Input Total BOQ untuk Manager / akun dengan permission project_boq_manage.
5. Permission Input Total BOQ Project tersedia di Manajemen Akun.
6. Input BOQ manual per Material/Jasa dan import massal Excel.
7. Project Tracker tetap menampilkan persentase Material dan Jasa.

File perubahan:
- server.js
- public/index.html
- public/pxl-stg-0012-project-report.js
- README-PXL-STG-0012.txt
- VERIFICATION-PXL-STG-0012.txt

SQL:
- Tidak ada SQL baru.
- Menggunakan tabel Project Report/detail BOQ dari PXL-STG-0010/0011.
- Permission disimpan pada custom_menus existing.

Catatan akses:
- Manager: Input Total BOQ default.
- Super Admin: akses penuh untuk verifikasi.
- Akun lain: dapat diberi checklist "Input Total BOQ Project" di Manajemen Akun.
- Teknisi: Project Report + Today Achievement; BOQ tidak dapat diedit dari Project Report.
- Setelah permission akun diubah, logout/login akun target agar token/session mengambil custom_menus terbaru.

Import Excel BOQ:
- Pilih project pada menu Input Total BOQ.
- Klik Template Excel untuk mengunduh format.
- Kolom: Kategori, Nama Item/Jasa, BOQ, Satuan, Catatan, Urutan.
- Kategori hanya Material atau Jasa.
- Import menambahkan baris BOQ ke project yang sedang dipilih.
