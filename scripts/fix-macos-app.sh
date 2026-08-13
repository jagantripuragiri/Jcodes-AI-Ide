#!/bin/bash
# Fixes local macOS packaging issues in the gulp-built "J code's.app" so it can
# actually launch: repairs the framework symlink structure that gulp's file
# copy flattens into real duplicate files (which confuses codesign), then
# ad-hoc re-signs the whole bundle bottom-up. Run this after every
# `npm run gulp vscode-darwin-arm64` (or -x64) build, before launching the app.
#
# Usage: scripts/fix-macos-app.sh ["/path/to/J code's.app"]

set -euo pipefail

DEFAULT_APP="/Applications/J code"
DEFAULT_APP="${DEFAULT_APP}'s.app"
APP="${1:-$DEFAULT_APP}"

if [ ! -d "$APP" ]; then
  echo "App not found: $APP" >&2
  exit 1
fi

echo "== Fixing framework symlink structure =="
for fw in "$APP/Contents/Frameworks"/*.framework; do
  [ -d "$fw" ] || continue
  name=$(basename "$fw" .framework)
  echo "-- $name --"
  cd "$fw"
  rm -rf "Versions/Current"
  ln -s A "Versions/Current"
  for item in "Versions/A"/*; do
    base=$(basename "$item")
    if [ -e "$fw/$base" ] && [ ! -L "$fw/$base" ]; then
      rm -rf "$fw/$base"
      ln -s "Versions/Current/$base" "$fw/$base"
    fi
  done
  cd - >/dev/null
done

echo "== Stripping stale signatures =="
find "$APP" -name "_CodeSignature" -type d -exec rm -rf {} + 2>/dev/null || true

echo "== Signing nested frameworks =="
for fw in "$APP/Contents/Frameworks"/*.framework; do
  [ -d "$fw" ] || continue
  codesign --force --deep --sign - "$fw"
done

echo "== Signing helper apps =="
for helper in "$APP/Contents/Frameworks"/*.app; do
  [ -d "$helper" ] || continue
  codesign --force --deep --sign - "$helper"
done

echo "== Signing outer app =="
codesign --force --deep --sign - "$APP"

echo "== Verifying =="
if codesign --verify --deep --strict "$APP"; then
  echo "OK: signature is valid. Try opening the app now."
else
  echo "Signature verification still failing, see output above." >&2
  exit 1
fi
