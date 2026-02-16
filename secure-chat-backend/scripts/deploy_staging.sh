#!/bin/bash
# scripts/deploy_staging.sh
# Epic 95: Automated Staging Deployment

set -e

NAMESPACE="staging"
RELEASE_NAME="chatflect-staging"
CHART_PATH="./charts/chatflect-backend"
VALUES_FILE="./charts/chatflect-backend/values-staging.yaml"

echo "🚀 Deploying to $NAMESPACE..."

# Ensure namespace exists (Idempotent)
if ! kubectl get namespace "$NAMESPACE" > /dev/null 2>&1; then
  echo "Creating namespace $NAMESPACE..."
  kubectl create namespace "$NAMESPACE"
else
  echo "Namespace $NAMESPACE already exists."
fi

# Update dependencies
echo "📦 Building Chart Dependencies..."
helm dependency build $CHART_PATH

# Deploy/Upgrade
helm upgrade --install $RELEASE_NAME $CHART_PATH \
  --namespace $NAMESPACE \
  --values $VALUES_FILE \
  --wait \
  --timeout 5m

echo "✅ Deployment Complete!"
echo "📡 Check status: kubectl get pods -n $NAMESPACE"
