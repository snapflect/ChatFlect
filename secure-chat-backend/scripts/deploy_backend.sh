#!/bin/bash
# scripts/deploy_backend.sh
# Epic 38: Backend Deployment Script

set -e

DEPLOY_ENV="${DEPLOY_ENV:-dev}"
SCRIPT_DIR="$(dirname $0)"
ROOT_DIR="$(dirname $SCRIPT_DIR)"

echo "=== ChatFlect Backend Deployment ==="
echo "Environment: $DEPLOY_ENV"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 1. Pull latest code
echo ""
echo "[1/5] Pulling latest code..."
git pull origin HEAD

COMMIT=$(git rev-parse HEAD)
COMMIT_SHORT=$(git rev-parse --short HEAD)
echo "Commit: $COMMIT_SHORT"

# 2. Load environment config
echo ""
echo "[2/5] Loading environment config..."
ENV_FILE="$ROOT_DIR/config/environments/${DEPLOY_ENV}.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# 3. Validate secrets
echo ""
echo "[3/5] Validating configuration..."
php "$ROOT_DIR/scripts/validate_config.php" || exit 1

# 4. Run migrations
echo ""
echo "[4/5] Running pending migrations..."
php "$ROOT_DIR/scripts/run_pending_migrations.php"

# 5. Restart services
echo ""
echo "[5/5] Restarting services..."
if command -v systemctl &> /dev/null; then
    sudo systemctl reload php-fpm 2>/dev/null || true
    sudo systemctl reload nginx 2>/dev/null || true
fi

# Write deployment manifest
MANIFEST_DIR="$ROOT_DIR/deployments"
mkdir -p "$MANIFEST_DIR"
cat > "$MANIFEST_DIR/current.json" << EOF
{
  "commit": "$COMMIT",
  "commit_short": "$COMMIT_SHORT",
  "env": "$DEPLOY_ENV",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployed_by": "$(whoami)"
}
EOF

echo ""
echo "✅ Deployment complete"
echo "Commit: $COMMIT_SHORT"
echo "Manifest: $MANIFEST_DIR/current.json"
