# PXL-URG-0107C — Storage/File Legacy Audit

Tujuan: memastikan tidak ada file/attachment production yang masih menunjuk Supabase Storage dan memetakan storage non-VPS yang masih dipakai.

Hasil audit production:
- Supabase Storage reference di database: 0
- Invoice file_url: 0
- Standalone invoice file_url: 0
- Local /uploads references: 0
- Physical local upload files: 0
- Missing local files referenced DB: 0
- Work Order photo records: 425, seluruhnya Cloudinary
- Service photo records: 3, seluruhnya Cloudinary
- User signature_url: 0
- Cloudinary runtime configuration: aktif
- Satu literal Supabase ditemukan di source: hanya komentar dokumentasi pada config.js, bukan endpoint runtime.

Kesimpulan:
- Supabase Storage tidak dipakai oleh data production yang diaudit.
- File foto WO/Service masih berada di Cloudinary. Cloudinary bukan Supabase, tetapi juga bukan storage VPS.
- Fase ini hanya audit; tidak memindahkan atau menghapus file.

Jalankan audit:
```bash
bash ops/audit/storage-file-audit.sh
```

Expected result saat kondisi saat ini: `AUDIT_PASS`.