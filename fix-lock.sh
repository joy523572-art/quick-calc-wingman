#!/bin/bash
# Automated lock file regeneration script
# This script will regenerate package-lock.json

echo "🔄 Starting automated lock file regeneration..."
echo ""

# Step 1: Clear npm cache
echo "Step 1: Clearing npm cache..."
npm cache clean --force

# Step 2: Remove old lock file
echo "Step 2: Removing old package-lock.json..."
rm -f package-lock.json

# Step 3: Generate fresh lock file
echo "Step 3: Generating fresh lock file with all dependencies..."
npm install --legacy-peer-deps

# Step 4: Verify
if [ -f package-lock.json ]; then
    echo ""
    echo "✅ SUCCESS! Lock file regenerated successfully"
    echo "Lock file size: $(wc -c < package-lock.json) bytes"
    echo "Dependencies resolved: $(grep -c '"name":' package-lock.json || echo "multiple")"
else
    echo "❌ ERROR: Lock file was not created!"
    exit 1
fi

echo ""
echo "✅ You can now commit and push:"
echo "   git add package-lock.json"
echo "   git commit -m 'fix: regenerate package-lock.json'"
echo "   git push origin main"
