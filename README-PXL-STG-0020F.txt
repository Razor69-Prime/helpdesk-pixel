PXL-STG-0020F — Kanban Lifecycle Isolation
- Hanya pxl-stg-0007j-layout.js yang memiliki UI Kanban.
- Legacy pxl-stg-0007-kanban.js tidak lagi dimuat sehingga tidak ada dua lifecycle/page dengan ID sama.
- Kanban default hidden.
- Delegated sidebar navigation selalu menutup Kanban sebelum modul lain tampil.
- Tidak mengubah Invoice, Sales PIC, Kanban API/data/schedule, WO, atau modul lain.
- Tidak ada SQL. STAGING ONLY. Main/production tidak disentuh.
