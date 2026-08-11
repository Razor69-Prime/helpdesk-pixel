PXL-STG-0020B — UAT Blocking Fix
STAGING ONLY
- Kanban: load memastikan page/range DOM tersedia sebelum digunakan.
- Dashboard Invoice: menambahkan renderSalesChart yang hilang.
- Sales PIC: default akun yang sedang login; akun Sales dikunci ke dirinya sendiri.
- Draft Invoice: jatuh tempo otomatis +14 hari saat tanggal invoice awal/berubah, sampai due date dioverride manual.
- Tidak ada SQL. Main/production tidak disentuh.
