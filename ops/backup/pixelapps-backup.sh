#!/usr/bin/env bash
set -euo pipefail
umask 077

APP_ROOT="${APP_ROOT:-/var/www/internal.pixelsolusindo.com}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/deploy/pixelapps-backups}"
POSTGREST_CONF="${POSTGREST_CONF:-/etc/pixelapps/postgrest.conf}"
RETENTION_DAILY=14
RETENTION_WEEKLY=8
RETENTION_MONTHLY=12
MODE="${1:-run}"

DB_DAILY="$BACKUP_ROOT/database/daily"
DB_WEEKLY="$BACKUP_ROOT/database/weekly"
DB_MONTHLY="$BACKUP_ROOT/database/monthly"
SOURCE_DIR="$BACKUP_ROOT/source"
LOG_DIR="$BACKUP_ROOT/logs"
MANIFEST_DIR="$BACKUP_ROOT/manifests"
mkdir -p "$DB_DAILY" "$DB_WEEKLY" "$DB_MONTHLY" "$SOURCE_DIR" "$LOG_DIR" "$MANIFEST_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
DATE_ONLY="$(date +%Y%m%d)"
DOW="$(date +%u)"
DOM="$(date +%d)"
DB_FILE="$DB_DAILY/pixelapps-db-$STAMP.dump"
SCHEMA_FILE="$DB_DAILY/pixelapps-schema-$STAMP.sql.gz"
SOURCE_FILE="$SOURCE_DIR/pixelapps-source-$STAMP.tar.gz"
MANIFEST_FILE="$MANIFEST_DIR/pixelapps-$STAMP.txt"
ROWCOUNT_FILE="$MANIFEST_DIR/pixelapps-rowcounts-$STAMP.csv"
LOG_FILE="$LOG_DIR/backup-$DATE_ONLY.log"
log(){ printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG_FILE"; }

load_db_env(){
  [[ -r "$POSTGREST_CONF" ]] || { log "ERROR postgrest config tidak terbaca: $POSTGREST_CONF"; exit 1; }
  eval "$(python3 - "$POSTGREST_CONF" <<'PY'
import re,sys,shlex
from urllib.parse import urlparse,unquote
s=open(sys.argv[1],encoding='utf-8').read()
m=re.search(r'^\s*db-uri\s*=\s*"([^"]+)"',s,re.M)
if not m: raise SystemExit('db-uri tidak ditemukan')
u=urlparse(m.group(1))
vals={'PGHOST':u.hostname or '127.0.0.1','PGPORT':str(u.port or 5432),
      'PGDATABASE':unquote((u.path or '/').lstrip('/')),'PGUSER':unquote(u.username or ''),
      'PGPASSWORD':unquote(u.password or '')}
for k,v in vals.items(): print(f'export {k}={shlex.quote(v)}')
PY
)"
}

prune_keep(){
  local dir="$1" pattern="$2" keep="$3"
  mapfile -t files < <(find "$dir" -maxdepth 1 -type f -name "$pattern" -printf '%T@ %p\n' | sort -nr | awk '{print $2}')
  if ((${#files[@]} > keep)); then
    for ((i=keep;i<${#files[@]};i++)); do rm -f -- "${files[$i]}"; done
  fi
}

if [[ "$MODE" == "--dry-run" ]]; then
  log "DRY RUN: struktur backup siap di $BACKUP_ROOT"
  log "DRY RUN: daily=$RETENTION_DAILY weekly=$RETENTION_WEEKLY monthly=$RETENTION_MONTHLY"
  exit 0
fi

for cmd in pg_dump pg_restore psql git gzip sha256sum; do
  command -v "$cmd" >/dev/null || { log "ERROR $cmd tidak tersedia"; exit 1; }
done

load_db_env
log "Mulai backup PixelApps"
pg_dump -Fc --no-owner --no-privileges -f "$DB_FILE"
pg_restore -l "$DB_FILE" >/dev/null
log "Database dump OK: $(basename "$DB_FILE")"

pg_dump --schema-only --no-owner --no-privileges | gzip -9 > "$SCHEMA_FILE"
gzip -t "$SCHEMA_FILE"
log "Schema dump OK: $(basename "$SCHEMA_FILE")"

(
  cd "$APP_ROOT"
  git archive --format=tar HEAD | gzip -9 > "$SOURCE_FILE"
)
gzip -t "$SOURCE_FILE"
log "Source archive OK: $(basename "$SOURCE_FILE")"

{
  echo "revision=PXL-URG-0107A"
  echo "created_at=$(date -Iseconds)"
  echo "git_head=$(git -C "$APP_ROOT" rev-parse HEAD)"
  echo "database_file=$(basename "$DB_FILE")"
  echo "database_bytes=$(stat -c %s "$DB_FILE")"
  echo "schema_file=$(basename "$SCHEMA_FILE")"
  echo "source_file=$(basename "$SOURCE_FILE")"
  echo "source_bytes=$(stat -c %s "$SOURCE_FILE")"
  echo "sha256_database=$(sha256sum "$DB_FILE" | awk '{print $1}')"
  echo "sha256_schema=$(sha256sum "$SCHEMA_FILE" | awk '{print $1}')"
  echo "sha256_source=$(sha256sum "$SOURCE_FILE" | awk '{print $1}')"
} > "$MANIFEST_FILE"

TABLE_SQL="$(psql -Atqc "select format('select %L as table_name, count(*)::bigint as row_count from %I.%I;',tablename,schemaname,tablename) from pg_tables where schemaname='public' order by tablename;")"
{
  echo "table_name,row_count"
  if [[ -n "$TABLE_SQL" ]]; then psql -AtF',' -c "$TABLE_SQL"; fi
} > "$ROWCOUNT_FILE"
log "Manifest & row count OK"

if [[ "$DOW" == "7" ]]; then cp -f "$DB_FILE" "$DB_WEEKLY/pixelapps-db-weekly-$STAMP.dump"; log "Weekly snapshot dibuat"; fi
if [[ "$DOM" == "01" ]]; then cp -f "$DB_FILE" "$DB_MONTHLY/pixelapps-db-monthly-$STAMP.dump"; log "Monthly snapshot dibuat"; fi

prune_keep "$DB_DAILY" 'pixelapps-db-*.dump' "$RETENTION_DAILY"
prune_keep "$DB_DAILY" 'pixelapps-schema-*.sql.gz' "$RETENTION_DAILY"
prune_keep "$SOURCE_DIR" 'pixelapps-source-*.tar.gz' "$RETENTION_DAILY"
prune_keep "$MANIFEST_DIR" 'pixelapps-*.txt' "$RETENTION_DAILY"
prune_keep "$MANIFEST_DIR" 'pixelapps-rowcounts-*.csv' "$RETENTION_DAILY"
prune_keep "$DB_WEEKLY" 'pixelapps-db-weekly-*.dump' "$RETENTION_WEEKLY"
prune_keep "$DB_MONTHLY" 'pixelapps-db-monthly-*.dump' "$RETENTION_MONTHLY"
prune_keep "$LOG_DIR" 'backup-*.log' 30
log "Backup selesai"