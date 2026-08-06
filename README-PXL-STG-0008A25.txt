PXL-STG-0008A25 — Penempatan Menu Accounting & Piutang

Scope
- Branch target: staging.
- Main dan production tidak disentuh.
- Tidak ada SQL baru.

Perubahan
1. Invoice dipindahkan ke kelompok menu Accounting & Piutang.
2. Daftar Piutang selalu dimasukkan ke kelompok Accounting & Piutang, tidak lagi menggunakan fallback navigasi umum.
3. Sales tidak mendapat menu maupun akses Piutang.
4. Purchase Request dan Master Supplier tetap berada di kelompok Keuangan & Pengadaan.
5. Pengaturan hak akses akun mengikuti pembagian kelompok menu yang baru.

Uji setelah deploy staging
1. Login Sales: pastikan tidak ada menu Daftar Piutang.
2. Login Accounting/Admin/Superadmin: buka Accounting & Piutang dan pastikan tersedia Invoice serta Daftar Piutang.
3. Pastikan Purchase Request dan Master Supplier tetap berada di Keuangan & Pengadaan.
