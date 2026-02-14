#!/bin/bash
# scripts/backup_db.sh
# Epic 99: Database Backup Automation

set -e

# Default to environment variables or local defaults
DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-root}
DB_NAME=${DB_NAME:-chatflect_staging}
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "📦 Starting Backup of $DB_NAME on $DB_HOST..."

# Check if password is set
if [ -z "$DB_PASSWORD" ]; then
    echo "⚠️  DB_PASSWORD env var is not set!"
    exit 1
fi

# Dump and Compress
export MYSQL_PWD="$DB_PASSWORD"
mysqldump -h "$DB_HOST" -u "$DB_USER" --single-transaction --routines --triggers "$DB_NAME" | gzip > "$BACKUP_FILE"
unset MYSQL_PWD

# Verify
if gzip -t "$BACKUP_FILE"; then
    echo "✅ Backup Successful: $BACKUP_FILE"
    echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    echo "❌ Backup Failed: Integrity Check Failed"
    rm "$BACKUP_FILE"
    exit 1
fi
