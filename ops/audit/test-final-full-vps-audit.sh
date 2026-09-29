#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
AUDIT="$HERE/final-full-vps-audit.sh"
[[ -f "$AUDIT" ]] || { echo "FAIL final audit script missing"; exit 1; }
bash -n "$AUDIT"
for token in '127.0.0.1:5433' '127.0.0.1:3003' ':3001' 'test-inventory-rpc-audit.sh' 'storage-file-audit.sh' 'test-vps-supabase-guard.js' 'test-postgrest-runtime-config.js' 'test-ui-log-cleanup.js' 'test-invoice-attachment-cleanup.js' 'test-legacy-file-cleanup.js' 'FINAL_AUDIT_PASS'; do
  grep -q "$token" "$AUDIT" || { echo "FAIL missing final audit check $token"; exit 1; }
done
echo PASS
