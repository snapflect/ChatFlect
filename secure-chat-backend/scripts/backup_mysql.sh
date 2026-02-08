#!/bin/bash
# scripts/backup_mysql.sh
# Epic 37: Automated MySQL Backup

set -e

# Configuration from environment
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS}"
DB_NAME="${DB_NAME:-chatflect_db}"

BACKUP_DIR="${BACKUP_DIR:-$(dirname $0)/../backups}"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="chatflect_backup_${TIMESTAMP}.sql.gz"

echo "=== MySQL Backup ==="
echo "Database: $DB_NAME"
echo "Date: $DATE"

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Run mysqldump with compression
echo "Creating backup..."
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    --databases "$DB_NAME" | gzip > "$BACKUP_DIR/$DATE/$BACKUP_FILE"

# Calculate checksum
CHECKSUM=$(sha256sum "$BACKUP_DIR/$DATE/$BACKUP_FILE" | cut -d' ' -f1)
SIZE=$(stat -c%s "$BACKUP_DIR/$DATE/$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_DIR/$DATE/$BACKUP_FILE")
SIZE_MB=$((SIZE / 1024 / 1024))

echo "Backup created: $BACKUP_DIR/$DATE/$BACKUP_FILE"
echo "Size: ${SIZE_MB}MB"
echo "Checksum: $CHECKSUM"

# Update manifest
MANIFEST="$BACKUP_DIR/backup_manifest.json"
if [ ! -f "$MANIFEST" ]; then
    echo '{"backups":[]}' > "$MANIFEST"
fi

# Append to manifest using jq or simple append
cat > "$BACKUP_DIR/.last_backup.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "file": "$DATE/$BACKUP_FILE",
  "size_bytes": $SIZE,
  "size_mb": $SIZE_MB,
  "checksum_sha256": "$CHECKSUM",
  "database": "$DB_NAME"
}
EOF

echo "✅ Backup complete"
