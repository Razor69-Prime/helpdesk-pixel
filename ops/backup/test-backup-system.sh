#!/usr/bin/env bash
set -euo pipefail
ROOT=/tmp/pxl-urg-0107a/test-backups
rm -rf "$ROOT"
SCRIPT=/tmp/pxl-urg-0107a/pixelapps-backup.sh
RESTORE=/tmp/pxl-urg-0107a/pixelapps-restore.sh
[[ -x "$SCRIPT" ]] || { echo 'FAIL backup script missing'; exit 1; }
[[ -x "$RESTORE" ]] || { echo 'FAIL restore script missing'; exit 1; }
BACKUP_ROOT="$ROOT" APP_ROOT="/var/www/internal.pixelsolusindo.com" "$SCRIPT" --dry-run >/tmp/pxl-urg-0107a/dryrun.out
for d in database/daily database/weekly database/monthly source logs manifests; do
  [[ -d "$ROOT/$d" ]] || { echo "FAIL missing dir $d"; exit 1; }
done
grep -q 'RETENTION_DAILY=14' "$SCRIPT" || { echo 'FAIL daily retention'; exit 1; }
grep -q 'RETENTION_WEEKLY=8' "$SCRIPT" || { echo 'FAIL weekly retention'; exit 1; }
grep -q 'RETENTION_MONTHLY=12' "$SCRIPT" || { echo 'FAIL monthly retention'; exit 1; }
grep -q -- '--verify-only' "$RESTORE" || { echo 'FAIL restore verify mode'; exit 1; }
grep -q 'pg_restore' "$RESTORE" || { echo 'FAIL restore pg_restore'; exit 1; }
echo PASS