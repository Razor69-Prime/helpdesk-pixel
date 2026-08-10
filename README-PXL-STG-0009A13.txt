PXL-STG-0009A13 — Checklist Akun Approve Cuti

Perubahan:
- Manajemen Akun memiliki checklist Approve Cuti, mengikuti skema role Purchase Request.
- Hanya akun yang dicentang yang melihat tombol Setujui/Tolak ketika status Diajukan.
- API memvalidasi checklist langsung dari data akun sebelum menerima keputusan dan tanda tangan.
- Approval tetap mensyaratkan tanda tangan PIC.
- Setelah disetujui, status menjadi approved sehingga integrasi blokir assignment Kanban/Laporan aktif.

File berubah:
- pxl-stg-0009a-leave-api.js
- public/pxl-stg-0009a-leave.js
- public/index.html

SQL: tidak ada.
Target: staging saja.
