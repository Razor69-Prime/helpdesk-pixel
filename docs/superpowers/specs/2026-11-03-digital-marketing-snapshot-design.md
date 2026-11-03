# Digital Marketing Snapshot Design

## Intent
Add a PixelApps module named Digital Marketing that stores month-by-month local snapshots read from Marketing Apps. AI Report will later read these PixelApps-local snapshots only.

## Hard constraint
Marketing Apps is source-only. PixelApps MUST NOT INSERT, UPDATE, DELETE, UPSERT, or otherwise mutate Marketing Apps. Source reads run inside a MySQL `START TRANSACTION READ ONLY` transaction and the connector exposes no write function.

## Data
Read monthly KPI records/targets, Meta Ads campaigns, and prospect summary from Marketing Apps. Preserve payload and normalized summary in PixelApps. Historical months are CLOSED and never auto-overwritten; current month is OPEN and may be refreshed.

## Pull modes
Manual pull from the Digital Marketing module and automatic pull every day at 04:00 Asia/Makassar. Both only read Marketing Apps and write PixelApps snapshot/history tables.

## UI
Digital Marketing shows source status, last pull, month selector, monthly snapshot summary, previous-month comparison, and pull history. No ChatGPT/Gemini call exists in Phase 1.

## Security
Superadmin-only endpoints in Phase 1. Marketing source reader validates YYYY-MM, uses hard-coded SELECT queries, transaction READ ONLY, and rolls back/ends without writes.
