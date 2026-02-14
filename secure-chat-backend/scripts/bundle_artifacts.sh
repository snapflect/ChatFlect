#!/bin/bash
# scripts/bundle_artifacts.sh
# Epic 102: Release Bundling

set -e

VERSION="v1.0.0-rc1"
OUTPUT_DIR="./dist"
ZIP_NAME="chatflect-backend-$VERSION.zip"

mkdir -p "$OUTPUT_DIR"

echo "📦 Bundling Artifacts for $VERSION..."

# Create Zip (Excluding dev/test files)
zip -r "$OUTPUT_DIR/$ZIP_NAME" . \
    -x "*.git*" \
    -x "tests/*" \
    -x "docs/*" \
    -x "benchmark/*" \
    -x "ops/*" \
    -x "scripts/*" \
    -x "backups/*" \
    -x "logs/*" \
    -x ".env"

echo "✅ Created Bundle: $OUTPUT_DIR/$ZIP_NAME"

# Verify Bundle Content (Leakage Check)
echo "🔍 Verifying Bundle Content..."
# grep returns 0 if match found (which is BAD here)
if unzip -l "$OUTPUT_DIR/$ZIP_NAME" | grep -qE "\.env|\.git|\.key|backups/"; then
    echo "❌ CRITICAL: Bundle contains forbidden files (secrets/git/backups)!"
    rm "$OUTPUT_DIR/$ZIP_NAME"
    exit 1
else
    echo "✅ Bundle Verify Passed (Clean)."
fi

# Generate Checksum
cd "$OUTPUT_DIR"
sha256sum "$ZIP_NAME" > "$ZIP_NAME.sha256"
echo "🔐 Checksum Generated: $(cat $ZIP_NAME.sha256)"
