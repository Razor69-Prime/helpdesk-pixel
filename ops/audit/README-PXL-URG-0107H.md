# PXL-URG-0107H — Final Full VPS Audit

Audit final untuk memastikan migrasi runtime PixelApps dari Supabase ke VPS sudah selesai.

Yang diverifikasi:
- Node production listen di `:3001`.
- PostgREST lokal listen di `127.0.0.1:3003`.
- PostgreSQL lokal listen di `127.0.0.1:5433`.
- Endpoint utama production HTTP 200.
- Inventory health connected.
- Regression 0107B/0107C/0107D/0107E/0107F/0107F1/0107F2/0107G tetap lolos.
- Runtime canonical mengarah ke PostgREST lokal.
- Tidak ada URL Supabase Cloud aktif pada runtime source.
- File legacy `supabase.js` dan `public/config.js` sudah hilang.
- Backup harian dan cron tersedia.
- Attachment invoice retention 30 hari.
- Git working tree tidak memiliki perubahan tak terduga.

Catatan penting:
- Foto Work Order dan Service masih memakai Cloudinary. Jadi aplikasi/database sudah bebas Supabase dan berjalan di VPS, tetapi media foto belum 100% disimpan lokal VPS.
- `SUPABASE_*` alias legacy dapat masih ada sebagai compatibility fallback di source; yang dilarang adalah koneksi/URL Supabase Cloud aktif.

Test VPS:
```bash
cd /var/www/internal.pixelsolusindo.com
bash ops/audit/test-final-full-vps-audit.sh
bash ops/audit/final-full-vps-audit.sh
```

Expected terakhir: `FINAL_AUDIT_PASS`.
