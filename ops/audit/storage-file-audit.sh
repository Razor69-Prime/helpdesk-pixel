#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/internal.pixelsolusindo.com}"
POSTGREST_CONF="${POSTGREST_CONF:-/etc/pixelapps/postgrest.conf}"
UPLOADS_DIR="${UPLOADS_DIR:-$APP_ROOT/data/uploads}"

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

targets=(
  "invoices.file_url"
  "invoices.pdf_snapshot_url"
  "standalone_invoices.file_url"
  "work_order_photos.image_url"
  "work_order_photos.secure_url"
  "service_photos.image_url"
  "service_photos.secure_url"
  "users.signature_url"
)

echo 'PXL-URG-0107C — Storage/File Legacy Audit'
echo "Database host: $PGHOST:$PGPORT"
echo "Upload folder: $UPLOADS_DIR"
echo 'table.column|nonempty|supabase_storage|cloudinary|local_uploads|other_http|other'

supabase_total=0
local_total=0
missing_local=0
for target in "${targets[@]}"; do
  table="${target%%.*}"; col="${target##*.}"
  exists="$(psql -Atqc "select count(*) from information_schema.columns where table_schema='public' and table_name='$table' and column_name='$col';")"
  [[ "$exists" == "1" ]] || { echo "$target|MISSING_COLUMN"; continue; }
  row="$(psql -AtF'|' -c "select
    count(*) filter (where nullif(btrim($col),'') is not null),
    count(*) filter (where lower(coalesce($col,'')) like '%supabase.co%' or lower(coalesce($col,'')) like '%/storage/v1/%'),
    count(*) filter (where lower(coalesce($col,'')) like '%cloudinary.com%'),
    count(*) filter (where coalesce($col,'') like '/uploads/%'),
    count(*) filter (where lower(coalesce($col,'')) like 'http%' and lower(coalesce($col,'')) not like '%supabase.co%' and lower(coalesce($col,'')) not like '%cloudinary.com%'),
    count(*) filter (where nullif(btrim($col),'') is not null and lower(coalesce($col,'')) not like 'http%' and coalesce($col,'') not like '/uploads/%')
  from public.$table;")"
  echo "$target|$row"
  IFS="|" read -r nonempty sup cloud local otherhttp other <<< "$row"
  supabase_total=$((supabase_total + sup))
  local_total=$((local_total + local))
done

echo '--- Local upload integrity ---'
mkdir -p "$UPLOADS_DIR"
local_refs="$(psql -Atqc "select file_url from invoices where file_url like '/uploads/%' union all select file_url from standalone_invoices where file_url like '/uploads/%';")"
if [[ -n "$local_refs" ]]; then
  while IFS= read -r ref; do
    [[ -n "$ref" ]] || continue
    file="$UPLOADS_DIR/${ref#/uploads/}"
    [[ -f "$file" ]] || missing_local=$((missing_local+1))
  done <<< "$local_refs"
fi
physical_files="$(find "$UPLOADS_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')"
echo "DB local upload refs: $local_total"
echo "Physical local upload files: $physical_files"
echo "Missing local files referenced by DB: $missing_local"

echo '--- Runtime source URL literals ---'
runtime_supabase_literals="$((grep -RIl --include='*.js' --include='*.html' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=backups --exclude-dir=ops -E 'https?://[^"[:space:]]*supabase\.co|/storage/v1/' "$APP_ROOT" 2>/dev/null || true) | wc -l | tr -d ' ')"
echo "Files with Supabase/storage URL literals: $runtime_supabase_literals"

echo '--- Cloudinary configuration ---'
python3 - <<'PY'
import os,re
pids=[]
for name in os.listdir('/proc'):
    if not name.isdigit(): continue
    try:
        cmd=open(f'/proc/{name}/cmdline','rb').read().replace(b'\0',b' ').decode(errors='ignore')
        if '/var/www/internal.pixelsolusindo.com/server.js' in cmd: pids.append(name)
    except: pass
configured=False
for pid in pids[:1]:
    try:
        env={}
        for part in open(f'/proc/{pid}/environ','rb').read().split(b'\0'):
            if b'=' in part:
                k,v=part.split(b'=',1); env[k.decode(errors='ignore')]=v
        configured=all(env.get(k) for k in ('CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'))
    except: pass
print('Cloudinary configured:', 'YES' if configured else 'NO')
PY

echo "Supabase Storage DB references: $supabase_total"
if [[ "$supabase_total" != "0" ]]; then echo "AUDIT_REVIEW_SUPABASE_STORAGE"; exit 2; fi
if [[ "$missing_local" != "0" ]]; then echo "AUDIT_REVIEW_MISSING_LOCAL_FILES"; exit 3; fi
echo "AUDIT_PASS"