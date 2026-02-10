#!/bin/bash
# scripts/rollback_backend.sh
# Epic 38: Rollback Script

set -e

SCRIPT_DIR="$(dirname $0)"
ROOT_DIR="$(dirname $SCRIPT_DIR)"
MANIFEST="$ROOT_DIR/deployments/current.json"

echo "=== ChatFlect Backend Rollback ==="

if [ ! -f "$MANIFEST" ]; then
    echo "❌ No deployment manifest found"
    exit 1
fi

CURRENT_COMMIT=$(cat "$MANIFEST" | grep -o '"commit": "[^"]*"' | cut -d'"' -f4)
echo "Current commit: ${CURRENT_COMMIT:0:8}"

# Get previous commit
PREV_COMMIT=$(git rev-parse HEAD~1 2>/dev/null || echo "")
if [ -z "$PREV_COMMIT" ]; then
    echo "❌ Cannot determine previous commit"
    exit 1
fi

echo "Previous commit: ${PREV_COMMIT:0:8}"
echo ""
echo "⚠️  WARNING: Rollback will checkout $PREV_COMMIT"
echo "⚠️  Migrations may NOT be reversible!"
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted"
    exit 0
fi

# Checkout previous commit
echo ""
echo "Rolling back..."
git checkout "$PREV_COMMIT"

# Restart services
if command -v systemctl &> /dev/null; then
    sudo systemctl reload php-fpm 2>/dev/null || true
    sudo systemctl reload nginx 2>/dev/null || true
fi

# Update manifest
cat > "$MANIFEST" << EOF
{
  "commit": "$PREV_COMMIT",
  "commit_short": "${PREV_COMMIT:0:7}",
  "env": "rollback",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployed_by": "$(whoami)",
  "rollback_from": "$CURRENT_COMMIT"
}
EOF

echo ""
echo "✅ Rollback complete"
echo "Now at: ${PREV_COMMIT:0:8}"
