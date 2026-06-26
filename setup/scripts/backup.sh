#!/bin/bash
# Daily Backup Script for Hindsight PostgreSQL
# Run via cron: 0 2 * * * /path/to/backup.sh

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_URL="${HINDSIGHT_API_DATABASE_URL}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/hindsight_backup_$TIMESTAMP.sql"

echo "Backing up Hindsight database to $BACKUP_FILE..."
pg_dump "$DB_URL" > "$BACKUP_FILE"

gzip "$BACKUP_FILE"

echo "Backup complete: $BACKUP_FILE.gz"

# Clean up old backups
find "$BACKUP_DIR" -name 'hindsight_backup_*.sql.gz' -mtime +$RETENTION_DAYS -delete

echo "Cleaned up backups older than $RETENTION_DAYS days"
