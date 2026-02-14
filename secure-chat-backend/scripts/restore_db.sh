#!/bin/bash
# scripts/restore_db.sh
# Epic 99: Database Restore Automation (Destructive)

set -e

DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-root}
DB_NAME=${DB_NAME:-chatflect_staging}

if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_backup.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ File not found: $BACKUP_FILE"
    exit 1
fi

# Safety Guard: Prevent running on Production
if [ "$ENVIRONMENT" == "production" ]; then
    echo "❌ CRITICAL: Cannot restore on PRODUCTION environment!"
    exit 1
fi

echo "⚠️  WARNING: THIS WILL OVERWRITE DATABASE '$DB_NAME' on '$DB_HOST'."
echo "Type 'RESTORE' to continue:"
read -r CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
    echo "❌ Aborted."
    exit 1
fi

echo "🔄 Restoring from $BACKUP_FILE..."

export MYSQL_PWD="$DB_PASSWORD"

# Drop and Recreate (Safety: Ensure clean state)
mysql -h "$DB_HOST" -u "$DB_USER" -e "DROP DATABASE IF EXISTS $DB_NAME; CREATE DATABASE $DB_NAME;"

# Import
zcat "$BACKUP_FILE" | mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME"

unset MYSQL_PWD

echo "✅ Restore Complete."
