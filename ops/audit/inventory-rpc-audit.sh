#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/internal.pixelsolusindo.com}"
POSTGREST_CONF="${POSTGREST_CONF:-/etc/pixelapps/postgrest.conf}"
LOCAL_REST="${LOCAL_REST:-http://127.0.0.1:3003}"

REQUIRED_RPCS=(
  inventory_next_barcode
  inventory_next_sku
  inventory_soft_delete
  inventory_restock_batch
  inventory_apply_cutoff
  inventory_merge_duplicates_bulk
  inventory_issue_material_request
)

[[ -r "$POSTGREST_CONF" ]] || { echo "FAIL postgrest config unreadable"; exit 1; }
[[ -r "$APP_ROOT/db-core.js" ]] || { echo "FAIL db-core.js missing"; exit 1; }

eval "$(python3 - "$POSTGREST_CONF" <<'PY'
import re,sys,shlex
from urllib.parse import urlparse,unquote
s=open(sys.argv[1],encoding='utf-8').read()
m=re.search(r'^\s*db-uri\s*=\s*"([^"]+)"',s,re.M)
if not m: raise SystemExit('db-uri tidak ditemukan')
u=urlparse(m.group(1))
for k,v in {'PGHOST':u.hostname or '127.0.0.1','PGPORT':str(u.port or 5432),'PGDATABASE':unquote((u.path or '/').lstrip('/')),'PGUSER':unquote(u.username or ''),'PGPASSWORD':unquote(u.password or '')}.items():
    print(f'export {k}={shlex.quote(v)}')
PY
)"

echo 'PXL-URG-0107B — Inventory RPC VPS Audit'
echo "Database host: $PGHOST:$PGPORT (local expected)"
[[ "$PGHOST" == "127.0.0.1" || "$PGHOST" == "localhost" ]] || { echo "FAIL database is not local VPS"; exit 1; }

fail=0
echo '--- PostgreSQL functions ---'
for rpc in "${REQUIRED_RPCS[@]}"; do
  count="$(psql -Atqc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='$rpc';")"
  if [[ "$count" == "1" ]]; then echo "PASS $rpc exists"; else echo "FAIL $rpc count=$count"; fail=1; fi
done

echo '--- Application references ---'
for rpc in "${REQUIRED_RPCS[@]}"; do
  if grep -q "/rpc/$rpc" "$APP_ROOT/db-core.js"; then echo "PASS $rpc referenced"; else echo "FAIL $rpc not referenced"; fail=1; fi
done

echo '--- Local PostgREST ---'
http="$(curl -sS -o /tmp/pxl-urg-0107b-rest.json -w '%{http_code}' "$LOCAL_REST/rest/v1/inventory_items?select=id&limit=1" || true)"
if [[ "$http" == "200" ]]; then echo "PASS local PostgREST inventory_items HTTP 200"; else echo "FAIL local PostgREST HTTP $http"; fail=1; fi

echo '--- Inventory table prerequisites ---'
for table in inventory_items inventory_transactions inventory_categories inventory_subcategories material_requests; do
  count="$(psql -Atqc "select count(*) from information_schema.tables where table_schema='public' and table_name='$table';")"
  if [[ "$count" == "1" ]]; then echo "PASS table $table exists"; else echo "FAIL table $table missing"; fail=1; fi
done

echo '--- Supporting inventory functions (informational) ---'
psql -AtF'|' -c "select p.proname,pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'inventory_%' order by p.proname;"

if [[ "$fail" != "0" ]]; then echo "AUDIT_FAIL"; exit 1; fi
echo "AUDIT_PASS"