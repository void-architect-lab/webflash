#!/bin/bash

# The version currently hardcoded in your app.js
CURRENT_VERSION="0.6.1"

echo "🔍 Checking upstream registry for esptool-js..."

# Fetch the latest stable release version from npm
LATEST_VERSION=$(npm view esptool-js version 2>/dev/null)

if [ -z "$LATEST_VERSION" ]; then
    echo "❌ Failed to fetch version from npm. Check your internet connection."
    exit 1
fi

echo "----------------------------------------"
echo "Pinned Version : $CURRENT_VERSION"
echo "Latest Stable  : $LATEST_VERSION"
echo "----------------------------------------"

if [ "$CURRENT_VERSION" != "$LATEST_VERSION" ]; then
    echo "⚠️  UPDATE AVAILABLE!"
    echo "Do NOT change app.js immediately. To upgrade safely:"
    echo "  1. Test the new version (@$LATEST_VERSION) locally first."
    echo "  2. Verify all flash/monitor methods still work."
    echo "  3. Only then commit and push to trigger a Cloudflare deploy."
else
    echo "✅ Library is fully up to date. No action needed."
fi
