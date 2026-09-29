# PXL-URG-0107F1 — Invoice Attachment Cleanup Fix

- Retention attachment lokal VPS: 30 hari.
- Cleanup tidak lagi membaca `data/tickets.json`.
- Sumber metadata cleanup sekarang tabel `invoices` dan `standalone_invoices` via PostgREST VPS.
- Hanya URL lokal `/uploads/...` yang boleh dihapus.
- Cloudinary/external URL tidak disentuh.
- Metadata invoice utama ditandai `file_deleted`; standalone invoice mengosongkan `file_url`.

Test VPS:
```bash
cd /var/www/internal.pixelsolusindo.com
node ops/audit/test-invoice-attachment-cleanup.js
tail -20 backups/PXL-URG-0107F1-node-restart.log
```

Expected: `PASS PXL-URG-0107F1` dan tidak ada error `ENOENT ... data/tickets.json`.
