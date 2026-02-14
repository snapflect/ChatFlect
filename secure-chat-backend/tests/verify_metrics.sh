#!/bin/bash
# tests/verify_metrics.sh
# Epic 97: Automated Metrics Verification

set -e

METRICS_URL="http://localhost:8080/api/metrics.php"
REQUIRED_KEYS=("chatflect_up" "chatflect_messages_total" "chatflect_users_total")

# 1. Fetch Metrics (simulate external scraper)
# Note: In real K8s, this would be run from a sidecar or temp pod.
echo "🔍 Fetching metrics from $METRICS_URL..."

if [ -z "$METRICS_TOKEN" ]; then
  echo "⚠️  METRICS_TOKEN env var not set. Assuming internal network access (or auth disabled for test)."
  RESPONSE=$(curl -s --fail --max-time 5 "$METRICS_URL")
else
  echo "🔑 Using METRICS_TOKEN..."
  RESPONSE=$(curl -s --fail --max-time 5 -H "X-Metrics-Token: $METRICS_TOKEN" "$METRICS_URL")
fi

# 2. Validation Logic
if [ -z "$RESPONSE" ]; then
  echo "❌ FAIL: Empty response from metrics endpoint."
  exit 1
fi

echo "✅ Received Response."

for key in "${REQUIRED_KEYS[@]}"; do
  if echo "$RESPONSE" | grep -q "$key"; then
    echo "✅ Found metric: $key"
  else
    echo "❌ FAIL: Missing expected metric '$key'"
    exit 1
  fi
done

# 3. OpenMetrics Format Check (Simple)
if echo "$RESPONSE" | grep -q "# TYPE"; then
  echo "✅ OpenMetrics headers detected."
else
  echo "❌ FAIL: Invalid OpenMetrics format (Missing # TYPE)."
  exit 1
fi

echo "🎉 Metrics Verification Passed!"
