#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/internal.pixelsolusindo.com}"
cd "$APP_ROOT"

fail(){ echo "FAIL: $*"; exit 1; }
pass(){ echo "PASS: $*"; }

echo 'PXL-URG-0107H — Final Full VPS Audit'

echo '--- Core ports ---'
ss -ltn | grep -q '127.0.0.1:5433' || fail 'PostgreSQL 127.0.0.1:5433 tidak listen'
pass 'PostgreSQL 127.0.0.1:5433'
ss -ltn | grep -q '127.0.0.1:3003' || fail 'PostgREST 127.0.0.1:3003 tidak listen'
pass 'PostgREST 127.0.0.1:3003'
ss -ltn | grep -q ':3001' || fail 'Node :3001 tidak listen'
pass 'Node :3001'

echo '--- Production HTTP ---'
for url in \
  'https://internal.pixelsolusindo.com/' \
  'https://internal.pixelsolusindo.com/inventory.html' \
  'https://internal.pixelsolusindo.com/sales-order.html' \
  'https://internal.pixelsolusindo.com/package-recipes.html'; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  [[ "$code" == '200' ]] || fail "$url HTTP $code"
  pass "$url HTTP 200"
done

health="$(curl -sS https://internal.pixelsolusindo.com/api/inventory/health)"
node -e 'const x=JSON.parse(process.argv[1]); if(!(x&&x.ok===true&&x.connected===true)) process.exit(1)' "$health" || fail 'Inventory health gagal'
pass 'Inventory health connected'

echo '--- Regression chain ---'
node ops/audit/test-vps-supabase-guard.js
node ops/audit/test-postgrest-runtime-config.js
node ops/audit/test-ui-log-cleanup.js
node ops/audit/test-invoice-attachment-cleanup.js
node ops/audit/test-master-package-so-validation.js
node ops/audit/test-legacy-file-cleanup.js
bash ops/audit/test-inventory-rpc-audit.sh
bash ops/audit/storage-file-audit.sh

echo '--- Effective runtime endpoint ---'
node - <<'NODE'
const cfg=require('./config');
const db=require('./db');
const u=new URL(cfg.POSTGREST_URL);
if(!['127.0.0.1','localhost'].includes(u.hostname) || String(u.port)!=='3003') process.exit(1);
if(db.USE_POSTGREST!==true) process.exit(2);
console.log('PASS: canonical PostgREST runtime -> '+u.hostname+':'+u.port);
NODE

echo '--- Supabase Cloud runtime scan ---'
if grep -Rni --include='*.js' --include='*.html' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=backups --exclude-dir=ops -E 'https?://[^"[:space:]]*\.supabase\.co|https?://supabase\.co' . | grep -v '^./pxl-urg-0107d-vps-guard.js:' >/tmp/pxl107h-supabase-runtime.txt; then
  cat /tmp/pxl107h-supabase-runtime.txt
  fail 'Supabase Cloud URL literal masih ada di runtime source'
fi
pass 'tidak ada Supabase Cloud URL literal aktif'

echo '--- Removed legacy files ---'
[[ ! -e supabase.js ]] || fail 'supabase.js masih ada'
[[ ! -e public/config.js ]] || fail 'public/config.js masih ada'
pass 'legacy supabase.js/public-config removed'

echo '--- Backup system ---'
backup_root='/home/deploy/pixelapps-backups'
[[ -d "$backup_root/database/daily" ]] || fail 'folder backup database tidak ada'
latest="$(find "$backup_root/database/daily" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)"
[[ -n "$latest" && -s "$latest" ]] || fail 'backup database terbaru tidak ditemukan'
pass "backup latest: $(basename "$latest")"
crontab -l 2>/dev/null | grep -q 'pixelapps-backup.sh' || fail 'cron backup PixelApps tidak terpasang'
pass 'cron backup installed'

echo '--- Attachment cleanup policy ---'
grep -q 'const ATTACH_EXPIRE_DAYS = 30' pxl-urg-0107f1-attachment-cleanup.js || fail 'retention attachment bukan 30 hari'
pass 'attachment retention 30 hari'

echo '--- External media note ---'
if grep -Rqi --include='*.js' --include='*.html' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=backups 'cloudinary.com' public server.js; then
  echo 'WARN: Cloudinary masih dipakai untuk foto WO/Service. Supabase sudah tidak dipakai; media foto belum 100% lokal VPS.'
else
  pass 'tidak ada Cloudinary runtime reference'
fi

echo '--- Git working tree ---'
dirty="$(git status --short | grep -v '^?? backups/' | grep -v '^?? public/downloads/' || true)"
[[ -z "$dirty" ]] || { echo "$dirty"; fail 'working tree memiliki perubahan tak terduga'; }
pass 'working tree bersih selain backups/public/downloads'

echo 'FINAL_AUDIT_PASS'
