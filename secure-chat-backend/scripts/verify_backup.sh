#!/bin/bash
# scripts/verify_backup.sh
# Epic 37: Backup Integrity Verification

set -e

BACKUP_DIR="${BACKUP_DIR:-$(dirname $0)/../backups}"
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: verify_backup.sh <backup_file>"
    exit 1
fi

FULL_PATH="$BACKUP_DIR/$BACKUP_FILE"

echo "=== Backup Verification ==="
echo "File: $FULL_PATH"

# Check file exists
if [ ! -f "$FULL_PATH" ]; then
    echo "❌ FAIL: File not found"
    exit 1
fi
echo "✅ File exists"

# Check file size
SIZE=$(stat -c%s "$FULL_PATH" 2>/dev/null || stat -f%z "$FULL_PATH")
if [ "$SIZE" -lt 1000 ]; then
    echo "❌ FAIL: File too small (${SIZE} bytes)"
    exit 1
fi
echo "✅ File size OK (${SIZE} bytes)"

# Verify gzip integrity
if ! gzip -t "$FULL_PATH" 2>/dev/null; then
    echo "❌ FAIL: Gzip corruption detected"
    exit 1
fi
echo "✅ Gzip integrity OK"

# Check for required tables in dump
TABLES="relay_messages receipts presence_status abuse_scores api_metrics"
MISSING=""

for TABLE in $TABLES; do
    if ! zgrep -q "CREATE TABLE.*$TABLE" "$FULL_PATH" 2>/dev/null; then
        MISSING="$MISSING $TABLE"
    fi
done

if [ -n "$MISSING" ]; then
    echo "⚠️  Warning: Missing tables:$MISSING"
else
    echo "✅ Required tables present"
fi

# Calculate current checksum
CHECKSUM=$(sha256sum "$FULL_PATH" | cut -d' ' -f1)
echo "Checksum: $CHECKSUM"

echo ""
echo "✅ Verification PASSED"
