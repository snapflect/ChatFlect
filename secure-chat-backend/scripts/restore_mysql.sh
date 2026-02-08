#!/bin/bash
# scripts/restore_mysql.sh
# Epic 37: One-Command MySQL Restore

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS}"
DB_NAME="${DB_NAME:-chatflect_db}"

BACKUP_DIR="${BACKUP_DIR:-$(dirname $0)/../backups}"
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: restore_mysql.sh <backup_file>"
    echo "Example: restore_mysql.sh 2026-02-08/chatflect_backup_2026-02-08_10-00-00.sql.gz"
    exit 1
fi

FULL_PATH="$BACKUP_DIR/$BACKUP_FILE"

echo "=== MySQL Restore ==="
echo "Source: $FULL_PATH"
echo "Target: $DB_NAME on $DB_HOST"
echo ""
echo "⚠️  WARNING: This will overwrite the database!"
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted"
    exit 0
fi

# Verify backup first
echo "Verifying backup integrity..."
$(dirname $0)/verify_backup.sh "$BACKUP_FILE"

# Restore
echo ""
echo "Restoring database..."
gunzip -c "$FULL_PATH" | mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS"

echo ""
echo "✅ Restore complete"
echo "Database '$DB_NAME' restored from $BACKUP_FILE"
