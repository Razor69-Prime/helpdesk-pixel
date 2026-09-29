# PXL-URG-0107F2 — Urgent Master Paket SO Validation Fix

Masalah:
- Saat membuat Sales Order dari Master Paket, material Master Paket yang belum termapping Inventory masih ditolak oleh validator legacy `pxl-stg-0006b.js`.
- Contoh error: `Material Kabel Listrik 2 Meter wajib dipilih dari Inventory.`

Perbaikan:
- Material manual tetap wajib memiliki `inventory_item_id`.
- Material dari Master Paket (`source_type=master_package` / memiliki `package_id` / `package_item_id`) boleh masuk SO walau belum termapping Inventory.
- Jasa tetap tidak membutuhkan Inventory.
- Flow Material Request tetap hanya mengambil material yang memiliki `inventory_item_id`.

Test VPS:
```bash
cd /var/www/internal.pixelsolusindo.com
node ops/audit/test-master-package-so-validation.js
```

Expected: `PASS PXL-URG-0107F2`.
