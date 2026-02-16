#!/bin/bash
# tests/verify_logs.sh
# Epic 98: Automated Log Pipeline Verification

set -e

LOG_FILE="./logs/compliance.json.log"
LOGIN_URL="http://localhost:8080/api/auth/login.php"

# Ensure the log file exists (or creating a dummy event will make it)
mkdir -p logs

echo "🔍 Triggering Audit Event (Failed Login)..."
# We send a request that we KNOW will fail auth, but trigger logging
curl -s -X POST -H "Content-Type: application/json" \
     -d '{"email":"audit_test@chatflect.com", "password":"DUMMY_PASSWORD_FOR_LOG_TEST"}' \
     "$LOGIN_URL" > /dev/null

echo "✅ Event Triggered."
sleep 1 # Wait for filesystem sync

# 1. Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
  echo "❌ FAIL: Log file $LOG_FILE not found."
  exit 1
fi

# 2. Get the last line
LAST_LINE=$(tail -n 1 "$LOG_FILE")

if [ -z "$LAST_LINE" ]; then
  echo "❌ FAIL: Log file is empty."
  exit 1
fi

echo "📄 Last Log Entry: $LAST_LINE"

# 3. JSON Validation (Simple grep check, assuming no jq available)
if echo "$LAST_LINE" | grep -q '"event_id"'; then
  echo "✅ JSON Structure detected."
else
  echo "❌ FAIL: Log entry is not valid JSON."
  exit 1
fi

# 4. Secret Redaction Check
# We check if the ACTUAL password we sent appears in the log (it shouldn't)
if echo "$LAST_LINE" | grep -q "DUMMY_PASSWORD_FOR_LOG_TEST"; then
  echo "❌ FAIL: CRITICAL - Password leaked in log file!"
  exit 1
else
  echo "✅ Redaction Verified (Password not found)."
fi

echo "🎉 Log Pipeline Verified!"
