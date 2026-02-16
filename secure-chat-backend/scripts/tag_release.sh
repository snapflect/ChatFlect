#!/bin/bash
# scripts/tag_release.sh
# Epic 102: Release Candidate Tagging Automation

set -e

# Configuration
RC_VERSION="v1.0.0-rc1"
BRANCH="main"

# 1. Check Git State
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "❌ Error: You must be on '$BRANCH' branch to cut a release."
    exit 1
fi

if [[ -n $(git status -s) ]]; then
    echo "❌ Error: Git working directory is dirty. Commit or stash changes first."
    exit 1
fi

# 2. Run Verification Gates
echo "🧪 Running Verification Gates..."

# Metrics Check
if [ -f "tests/verify_metrics.sh" ]; then
    echo "   - Running verify_metrics.sh..."
    bash tests/verify_metrics.sh || { echo "❌ Metrics Verification Failed"; exit 1; }
fi

# Logs Check
if [ -f "tests/verify_logs.sh" ]; then
    echo "   - Running verify_logs.sh..."
    bash tests/verify_logs.sh || { echo "❌ Log Verification Failed"; exit 1; }
fi

echo "✅ All Gates Passed."

# 3. Tag Release
if git rev-parse "$RC_VERSION" >/dev/null 2>&1; then
    echo "⚠️  Tag $RC_VERSION already exists."
else
    echo "🏷️  Tagging release $RC_VERSION..."
    git tag -a "$RC_VERSION" -m "Release Candidate $RC_VERSION"
    # git push origin "$RC_VERSION" # Commented out for local testing safety
    echo "✅ Tag Created: $RC_VERSION"
fi
