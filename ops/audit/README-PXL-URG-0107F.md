# PXL-URG-0107F — UI & Log Cleanup

Tujuan: membersihkan istilah Supabase yang menyesatkan pada UI dan log production setelah runtime pindah ke PostgreSQL/PostgREST VPS.

Perubahan:
- Inventory status menjadi **PostgREST VPS terhubung**.
- Toast penyimpanan Inventory menjadi **tersimpan di PostgreSQL VPS**.
- Pesan proses Merge Inventory tidak lagi menyebut Supabase.
- Startup log database menjadi **Storage: PostgREST VPS** dan **Mode: PostgREST VPS**.
- Error/timeout adapter database memakai istilah PostgREST.
- System Tools memperjelas pemeriksaan lama sebagai **Legacy Supabase Storage**.
- Pesan runtime Inventory/RPC yang masih menyebut Supabase diganti ke PostgreSQL/PostgREST.

Fase ini tidak menghapus alias/config legacy dan tidak mengubah schema/database.

Uji VPS:
```bash
cd /var/www/internal.pixelsolusindo.com
node ops/audit/test-ui-log-cleanup.js
node ops/audit/test-postgrest-runtime-config.js
node ops/audit/test-vps-supabase-guard.js
bash ops/audit/test-inventory-rpc-audit.sh
```

Expected:
- `PASS PXL-URG-0107F`
- `PASS PXL-URG-0107E`
- `PASS PXL-URG-0107D`
- `PASS`
