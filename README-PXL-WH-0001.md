# PXL-WH-0001 — Warehouse Monitoring Revamp (GitHub candidate, no deployment)

Base commit: fcc54d809773d864d6ef6701603bfdb2a820f361

## Changes
- Adds independent Warehouse Monitoring API and UI, no changes to Sales Order, Work Order, MR, Inventory or Close WO transactions.
- Lists SO/WO all statuses, paginated source retrieval (no status/period filters).
- Stable WH-YYYY-0001 numbering using separate metadata table. Related SO/WO share one number.
- Automatic item snapshot from linked MR, SO or WO; manual entries chosen from active master Inventory.
- Displays technicians, daily Inventory ledger, monthly IN/OUT, and append-only physical-count audits.
- Monthly OUT is explicitly not equated to actual used quantity.
- Browser has independent status/text filters.

## Production prerequisites (NOT executed)
1. Review PostgREST role access and apply PXL-WH-0001-MIGRATION.sql to staging first.
2. Smoke test SO/WO/MR joins, manual save, numbering, stock-check audit and roles using real staging data.
3. Confirm baseline production files and any local differences before merging/deploying.
4. Only after UAT, deploy *changed files* according to approved deployment procedure.
5. Do NOT git reset --hard, replace entire production directory, or mutate stock/WO.
6. Back up the production database prior to any migration.

## Rollback
- No deployment: do not merge the feature branch; main stays at prior commit.
- If deployed: restore only touched files from a verified pre-deploy backup; roll back the new app endpoints/UI, without dropping Warehouse audit tables with data.
- Existing VPS checkpoint: /home/deploy/pixelapps-backups/PXL-SYS-0003-20261119-084148
- The SQL migration creates only new independent tables; it does not update existing Inventory/SO/WO/MR rows.

## Known constraints
- Production database migration/UAT not executed; SQL permissions must be verified in staging.
- Monthly OUT is not the same metric as actual material use per WO.
- Live source loading may require performance testing on a large dataset.
