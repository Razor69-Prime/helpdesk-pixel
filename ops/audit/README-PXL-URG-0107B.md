# PXL-URG-0107B — Inventory RPC VPS Audit

Tujuan: memastikan fungsi Inventory yang sebelumnya memakai pola Supabase RPC sudah tersedia dan dipakai pada PostgreSQL/PostgREST lokal VPS.

Hasil audit production:
- PostgreSQL: local VPS `127.0.0.1:5433`
- PostgREST Inventory: local `127.0.0.1:3003` HTTP 200
- 7/7 RPC kritis tersedia di schema `public`
- 7/7 RPC kritis masih direferensikan oleh `db-core.js`
- Tabel prerequisite Inventory tersedia
- Tidak ada perubahan data dilakukan oleh audit ini

RPC kritis:
1. `inventory_next_barcode`
2. `inventory_next_sku`
3. `inventory_soft_delete`
4. `inventory_restock_batch`
5. `inventory_apply_cutoff`
6. `inventory_merge_duplicates_bulk`
7. `inventory_issue_material_request`

Fungsi pendukung tambahan yang juga ditemukan:
- `inventory_code_prefix`
- `inventory_master_code`
- `inventory_delete_material_request`
- `inventory_update_material_request_usage`

Jalankan audit:
```bash
bash ops/audit/inventory-rpc-audit.sh
```

Expected result: `AUDIT_PASS`.