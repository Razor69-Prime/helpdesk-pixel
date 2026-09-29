# PXL-URG-0107A — PixelApps Backup System

Backup target default: `/home/deploy/pixelapps-backups`.

- Database daily: 14 snapshots
- Database weekly: 8 snapshots (Sunday)
- Database monthly: 12 snapshots (day 1)
- Source Git snapshot: 14 daily snapshots
- Schema SQL gzip: 14 daily snapshots
- Manifest SHA-256 dan snapshot row count
- Backup otomatis: 02:15 server time melalui crontab user `deploy`
- Secret tidak disalin ke Git/source archive; kredensial DB dibaca runtime dari config PostgREST lokal.
- Restore rutin diverifikasi dengan `--verify-only`. Restore production memerlukan `PIXELAPPS_RESTORE_CONFIRM=RESTORE`.

Offsite replication belum dikonfigurasi pada fase 0107A karena belum ada tujuan/credential backup eksternal yang diberikan.