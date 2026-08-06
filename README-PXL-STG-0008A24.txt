PXL-STG-0008A24 — Integrasi Invoice Terbit ke Omzet, Sales PIC, dan Piutang

Scope
- Branch target: staging.
- Main dan production tidak disentuh.
- Tidak ada SQL baru.

Perubahan
1. Invoice V1 dengan status issued, partially_paid, atau paid menjadi sumber omzet Dashboard.
2. Nilai invoice menggunakan tanggal invoice dan Sales PIC dari sales_pic_snapshot.
3. Sales Dashboard memakai sumber Invoice V1 yang sama sehingga realisasi Sales PIC ikut bertambah.
4. Menu Daftar Piutang ditambahkan di Keuangan & Pengadaan untuk Accounting, Admin, Superadmin, dan Manager.
5. Daftar Piutang menampilkan invoice terbit yang masih memiliki sisa saldo serta status Belum Lunas, Sebagian, Jatuh Tempo, atau Lunas.
6. Accounting/Admin/Superadmin dapat mencatat pembayaran manual; saldo dan status pembayaran diperbarui tanpa mengubah nilai omzet.

Flow
SO -> WO selesai -> Invoice Terbit -> Omzet Dashboard + Sales PIC + Piutang
Piutang dibayar manual -> status Sebagian/Lunas; omzet tetap tidak berubah.

Uji setelah deploy staging
1. Buka Dashboard periode sesuai tanggal invoice lalu pastikan invoice Terbit muncul di Total Invoice, Total Realisasi, dan Sales PIC.
2. Buka Sales Dashboard dan pastikan realisasi Sales PIC bertambah.
3. Buka Keuangan & Pengadaan > Daftar Piutang; invoice Terbit harus tampil sebagai Belum Lunas.
4. Login Accounting, tekan Catat Bayar, masukkan nominal, lalu pastikan saldo dan status berubah.
