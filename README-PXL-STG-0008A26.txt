PXL-STG-0008A26 — Menu Piutang sebagai Menu Inti Superadmin

Scope
- Branch target: staging.
- Main dan production tidak disentuh.
- Tidak ada SQL baru.

Perubahan
1. Daftar Piutang terdaftar sebagai menu inti pada sidebar, tidak lagi semata-mata ditambahkan secara dinamis.
2. Menu Accounting & Piutang berisi Invoice dan Daftar Piutang untuk Accounting, Admin, Manager, dan Superadmin.
3. Superadmin tetap melihat seluruh menu aplikasi, termasuk Daftar Piutang.
4. Sales dan Teknisi tidak memiliki menu Piutang.

Uji setelah deploy staging
1. Login Superadmin: Accounting & Piutang harus menampilkan Invoice dan Daftar Piutang.
2. Klik Daftar Piutang: daftar piutang terbuka dan data Invoice Terbit termuat.
3. Login Sales: Daftar Piutang tidak tampil.
