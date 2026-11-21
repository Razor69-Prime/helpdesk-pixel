# PXL-WH-0001C — Warehouse PX catalog + Daily USED + resilient Daily Stock

Base: main @ 9733cfd.
- Only Warehouse routes, metadata, and standalone frontend changed.
- Active PROBUS source keys MANUAL:PROBUS:PX-* are the authoritative SKU. Existing inventory_sku values are preserved.
- SKU PX in Warehouse pickers and monthly/daily reporting. Historical legacy WO item snapshots remain readable.
- Daily Material Usage records are append-only against WH + linked WO, not Inventory OUT. It does not update Inventory, MR, SO, WO, or Close WO.
- Daily Stock isolates invalid balances and reports "Perlu rekonsiliasi" without substituting zero or changing underlying ledger values.
- Migration adds one dedicated table warehouse_daily_usage, no triggers and no existing-table data changes.
- Production migration requires a verified backup and a separate deployment test; do not reset live files wholesale.
- Regression suite: node --test tests/pxl-wh-0001c.test.js tests/pxl-wh-0001.test.js tests/pxl-urg-0116a-nonblocking-wo.test.js tests/pxl-urg-0116b-warehouse-ui.test.js tests/pxl-urg-0116c-stock-ledger.test.js tests/pxl-wh-0001b-nav-visible.test.js
- Test staging insertion must run within BEGIN/ROLLBACK and must not alter Inventory stock.
