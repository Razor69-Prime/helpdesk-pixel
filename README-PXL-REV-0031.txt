PXL-REV-0031
Modul: Notifikasi Inventory / Penyelesaian Tiket

Perubahan:
- Notifikasi item belum terdaftar dikirim langsung ke ID seluruh akun Admin dan Super Admin aktif.
- Format role Admin/admin dan Super Admin/superadmin/super_admin dinormalisasi.
- Pengambilan notifikasi tetap mendukung notifikasi lama berbasis target_role.
- Tidak ada perubahan SQL dan dependency.

Tes:
1. Login teknisi dan selesaikan tiket memakai item yang belum ada di Inventory.
2. Login akun Admin atau Super Admin.
3. Tunggu maksimal 15 detik atau refresh halaman.
4. Badge lonceng harus muncul dan notifikasi berisi nama item serta nomor WO.
