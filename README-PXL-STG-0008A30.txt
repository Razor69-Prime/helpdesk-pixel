PXL-STG-0008A30 — Penguncian Flow WO, Material Request, dan Invoice

Branch: staging
SQL: tidak ada

Flow yang diterapkan:
1. Work Order dibuat dan teknisi ditugaskan.
2. Material Request wajib dibuat dari Work Order.
3. Material harus berstatus Diambil sebelum pekerjaan WO dapat diselesaikan.
4. Setelah WO selesai, teknisi menyelesaikan proses pengembalian material.
5. Invoice boleh dibuat dan diedit sebagai Draft selama proses pekerjaan berjalan.
6. Ajukan Approval, Setujui, dan Terbitkan Invoice hanya dapat dilakukan jika:
   - Invoice terhubung ke minimal satu WO;
   - seluruh WO terkait berstatus selesai/done;
   - setiap WO memiliki Material Request;
   - seluruh Material Request terkait berstatus returned/Dikembalikan.
7. Jalur override WO/MR belum selesai dihapus.

File aplikasi berubah:
- pxl-stg-0004f.js
- pxl-stg-0008a30-flow-guard.js
- pxl-stg-0008a-invoice-api.js

Catatan:
- Validasi dilakukan di server, sehingga tidak dapat dilewati dengan memanggil API langsung.
- MR dari Sales Order tetap dinonaktifkan; MR dibuat dari WO teknisi.
- main dan production tidak disentuh.
