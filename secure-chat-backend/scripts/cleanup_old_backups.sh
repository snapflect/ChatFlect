#!/bin/bash
# scripts/cleanup_old_backups.sh
# Epic 37: Backup Retention Policy

set -e

BACKUP_DIR="${BACKUP_DIR:-$(dirname $0)/../backups}"

echo "=== Backup Cleanup ==="
echo "Directory: $BACKUP_DIR"

# Retention policy:
# - Keep daily backups for 14 days
# - Keep weekly backups (Sundays) for 2 months
# - Keep monthly backups (1st) for 1 year

DAILY_KEEP=14
WEEKLY_KEEP=60
MONTHLY_KEEP=365

DELETED=0

for DIR in "$BACKUP_DIR"/*/; do
    if [ ! -d "$DIR" ]; then continue; fi
    
    DIRNAME=$(basename "$DIR")
    
    # Skip non-date directories
    if ! [[ "$DIRNAME" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        continue
    fi
    
    # Calculate age in days
    AGE=$(( ($(date +%s) - $(date -d "$DIRNAME" +%s 2>/dev/null || echo 0)) / 86400 ))
    
    # Determine retention
    DAY_OF_WEEK=$(date -d "$DIRNAME" +%u 2>/dev/null || echo 0)
    DAY_OF_MONTH=$(date -d "$DIRNAME" +%d 2>/dev/null || echo 0)
    
    KEEP=false
    
    # Monthly (1st of month) - keep 1 year
    if [ "$DAY_OF_MONTH" = "01" ] && [ "$AGE" -le "$MONTHLY_KEEP" ]; then
        KEEP=true
    # Weekly (Sunday) - keep 2 months
    elif [ "$DAY_OF_WEEK" = "7" ] && [ "$AGE" -le "$WEEKLY_KEEP" ]; then
        KEEP=true
    # Daily - keep 14 days
    elif [ "$AGE" -le "$DAILY_KEEP" ]; then
        KEEP=true
    fi
    
    if [ "$KEEP" = false ]; then
        echo "Deleting: $DIRNAME (${AGE} days old)"
        rm -rf "$DIR"
        DELETED=$((DELETED + 1))
    fi
done

echo ""
echo "✅ Cleanup complete. Deleted: $DELETED directories"
