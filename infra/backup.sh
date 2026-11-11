#!/bin/sh
set -eu
mkdir -p /backups
while true; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  file="/backups/popin-$stamp.dump"
  pg_dump -h "${PGHOST:-postgres}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$file.tmp"
  pg_restore --list "$file.tmp" > /dev/null
  mv "$file.tmp" "$file"
  find /backups -name 'popin-*.dump' -mtime +14 -delete
  echo "Backup completed: $stamp"
  sleep 86400
done
