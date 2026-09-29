#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
AUDIT="$HERE/inventory-rpc-audit.sh"
[[ -f "$AUDIT" ]] || { echo "FAIL audit script missing"; exit 1; }
bash -n "$AUDIT"
for rpc in inventory_next_barcode inventory_next_sku inventory_soft_delete inventory_restock_batch inventory_apply_cutoff inventory_merge_duplicates_bulk inventory_issue_material_request; do
  grep -q "$rpc" "$AUDIT" || { echo "FAIL missing required RPC $rpc"; exit 1; }
done
grep -q "127.0.0.1:3003" "$AUDIT" || { echo "FAIL local PostgREST verification missing"; exit 1; }
echo PASS
