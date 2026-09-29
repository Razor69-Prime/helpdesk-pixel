#!/usr/bin/env bash
set -euo pipefail
umask 077

POSTGREST_CONF="${POSTGREST_CONF:-/etc/pixelapps/postgrest.conf}"
DUMP="${1:-}"
MODE="${2:---verify-only}"

usage(){
  echo "Usage: $0 <pixelapps-db-*.dump> --verify-only"
  echo "       PIXELAPPS_RESTORE_CONFIRM=RESTORE $0 <dump> --confirm-production"
}

[[ -n "$DUMP" && -f "$DUMP" ]] || { usage; exit 2; }
if [[ -x /usr/lib/postgresql/17/bin/pg_restore ]]; then PG_RESTORE_BIN=/usr/lib/postgresql/17/bin/pg_restore; else PG_RESTORE_BIN="$(command -v pg_restore || true)"; fi
[[ -n "$PG_RESTORE_BIN" ]] || { echo "pg_restore tidak tersedia"; exit 1; }

if [[ "$MODE" == "--verify-only" ]]; then
  "$PG_RESTORE_BIN" -l "$DUMP" >/dev/null
  echo "VERIFY_OK $(basename "$DUMP")"
  exit 0
fi

[[ "$MODE" == "--confirm-production" ]] || { usage; exit 2; }
[[ "${PIXELAPPS_RESTORE_CONFIRM:-}" == "RESTORE" ]] || {
  echo "REFUSED: set PIXELAPPS_RESTORE_CONFIRM=RESTORE untuk restore production."
  exit 3
}

eval "$(python3 - "$POSTGREST_CONF" <<'PY'
import re,sys,shlex
from urllib.parse import urlparse,unquote
s=open(sys.argv[1],encoding='utf-8').read()
m=re.search(r'^\s*db-uri\s*=\s*"([^"]+)"',s,re.M)
if not m: raise SystemExit('db-uri tidak ditemukan')
u=urlparse(m.group(1))
for k,v in {
 'PGHOST':u.hostname or '127.0.0.1','PGPORT':str(u.port or 5432),
 'PGDATABASE':unquote((u.path or '/').lstrip('/')),'PGUSER':unquote(u.username or ''),
 'PGPASSWORD':unquote(u.password or '')
}.items(): print(f'export {k}={shlex.quote(v)}')
PY
)"

"$PG_RESTORE_BIN" -l "$DUMP" >/dev/null
echo "WARNING: restore akan mengganti object database target. Pastikan aplikasi dihentikan."
"$PG_RESTORE_BIN" --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname="$PGDATABASE" "$DUMP"
echo "RESTORE_OK $(basename "$DUMP")"