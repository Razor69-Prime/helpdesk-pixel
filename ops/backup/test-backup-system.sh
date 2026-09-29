#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT=/tmp/pxl-urg-0107a-test-backups
rm -rf "$ROOT"
SCRIPT="$HERE/pixelapps-backup.sh"
RESTORE="$HERE/pixelapps-restore.sh"

BACKUP_ROOT="$ROOT" APP_ROOT="${APP_ROOT:-/var/www/internal.pixelsolusindo.com}" /bin/bash "$SCRIPT" --dry-run >/tmp/pxl-urg-0107a-dryrun.out
for d in database/daily database/weekly database/monthly source logs manifests; do
  [[ -d "$ROOT/$d" ]] || { echo "FAIL missing dir $d"; exit 1; }
done
grep -q 'RETENTION_DAILY=14' "$SCRIPT" || { echo 'FAIL daily retention'; exit 1; }
grep -q 'RETENTION_WEEKLY=8' "$SCRIPT" || { echo 'FAIL weekly retention'; exit 1; }
grep -q 'RETENTION_MONTHLY=12' "$SCRIPT" || { echo 'FAIL monthly retention'; exit 1; }
grep -q -- '--verify-only' "$RESTORE" || { echo 'FAIL restore verify mode'; exit 1; }
grep -q 'pg_restore' "$RESTORE" || { echo 'FAIL restore pg_restore'; exit 1; }
echo PASS
