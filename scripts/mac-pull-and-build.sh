#!/usr/bin/env bash
# Run this on the Mac after pulling (or to pull and build in one go).
# From repo root:  bash scripts/mac-pull-and-build.sh
# Or from anywhere:  bash /path/to/BoatMatey/scripts/mac-pull-and-build.sh

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "→ Pulling latest from origin/main..."
git pull origin main

echo "→ Installing dependencies (root)..."
npm install

echo "→ Installing dependencies (web)..."
cd web && npm install && cd ..

echo "→ Building web and syncing to iOS..."
npm run cap:ios

echo "Done. In Xcode: Product → Clean Build Folder (Shift+Cmd+K), then build/run."
