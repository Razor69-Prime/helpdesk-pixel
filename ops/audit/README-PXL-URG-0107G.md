# PXL-URG-0107G — Legacy File Cleanup

Audit memastikan dua file lama berikut tidak direquire atau diload oleh runtime production:
- `supabase.js`
- `public/config.js`

Perubahan:
- Kedua file legacy dihapus dari repository.
- Komentar setup Supabase lama pada `config.js` diganti menjadi keterangan runtime PostgreSQL/PostgREST VPS.
- Alias kompatibilitas `SUPABASE_*` di backend tidak dihapus pada fase ini karena masih dipakai sebagai fallback oleh wrapper lama.
- File staging/wrapper yang masih aktif tidak dihapus.

Test VPS:
```bash
cd /var/www/internal.pixelsolusindo.com
node ops/audit/test-legacy-file-cleanup.js
```

Expected: `PASS PXL-URG-0107G`.
