#!/bin/sh
# Renders every docs/mockups/src/NN-*.html to exports/NN-*-light.png and -dark.png (390x844 at 3x, 1170x2532).
# Needs Google Chrome; no other dependency. Usage: docs/mockups/render.sh [name-prefix]   (e.g. 07 for one screen)
set -e
cd "$(dirname "$0")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
mkdir -p exports
for f in src/${1:-}*.html; do
  n=$(basename "$f" .html)
  for theme in light dark; do
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=3 \
      --window-size=390,844 --virtual-time-budget=3000 \
      --screenshot="$PWD/exports/$n-$theme.png" "file://$PWD/$f#$theme" >/dev/null 2>&1
    echo "exports/$n-$theme.png"
  done
done
