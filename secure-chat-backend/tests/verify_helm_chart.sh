#!/bin/bash
# tests/verify_helm_chart.sh
# Epic 95: Verify Helm Chart Validity

set -e

CHART_PATH="./charts/chatflect-backend"
VALUES_FILE="./charts/chatflect-backend/values-staging.yaml"

echo "🔍 Linting Helm Chart..."
helm lint $CHART_PATH -f $VALUES_FILE

echo "📄 Rendering Templates (Dry Run)..."
helm template test-release $CHART_PATH -f $VALUES_FILE --namespace staging > /dev/null

echo "🛡️  Checking for Root User..."
if helm template test-release $CHART_PATH -f $VALUES_FILE | grep -q "runAsUser: 0"; then
  echo "❌ FAIL: Deployment configured to run as Root!"
  exit 1
else
  echo "✅ PASS: Non-Root User Validated."
fi

echo "✅ Helm Verification Passed."
