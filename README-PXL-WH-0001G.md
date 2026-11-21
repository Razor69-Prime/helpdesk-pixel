# PXL-WH-0001G — Warehouse permissions + SO-style multi-item Draft workflow

Base: 27108c4 (main). Target: GitHub main and VPS only (no Vercel).

## Warehouse account checklist
- warehouse_view: read Warehouse Monitoring.
- warehouse_usage_write: create/update/finalize Daily Usage Draft.
- warehouse_material_manage: manual material on Warehouse monitoring.
- warehouse_stock_verify: physical stock verification.
- warehouse_access_configured: internal sentinel set when account access is edited.
- Existing manager/admin/warehouse roles retain legacy access until permissions are explicitly configured.
- Superadmin always bypasses every Warehouse permission, regardless of custom_menus_override.

## Workflow
1. Pick SO / WO using fast search; item suggestions are from existing SO / WO / MR and official PX catalog.
2. Add/remove multiple material rows, enter Qty USED and notes as in a Sales Order item table.
3. One Simpan Semua sebagai Draft saves ALL rows (blank quantities permitted) in warehouse_usage_documents.
4. Reopen/edit draft, update date/qty/items/notes and save with optimistic revision to prevent stale overwrites.
5. Finalisasi Pemakaian separately validates all rows have positive USED, locks the document and includes it in reports.
6. Draft rows are NEVER counted as USED; no Inventory, WO, MR, or SO mutation from this feature.
7. Legacy direct POST daily-usage and batch endpoints return 410 to prevent bypassing draft-first workflow.

## Migration and testing
- PXL-WH-0001G-MIGRATION.sql creates ONLY warehouse_usage_documents.
- Test first in staging. Migration is rerunnable (CREATE IF NOT EXISTS).
- Before production deployment: backup source and database, validate permissions and health.
- Run Node tests in tests/pxl-wh-0001g-*.test.js and existing Warehouse/WO nonblocking tests.
- Rollback: restore exact modified source files from checkpoint; preserve new audit data if any has been written; never drop the new draft table without user approval.
