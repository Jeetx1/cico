#!/bin/bash
# Builds docs/ and runs every check: barcode reader (Node), interface + logic (Chromium via Playwright),
# the three looks on phone and desktop, and the Design Lab smoke test.
# Needs Node; once: npm install && npx playwright install chromium (CI does this itself).
# If private/ holds a real data file, the logic test also does an open + save round trip with it.
set -eo pipefail
cd "$(dirname "$0")"
[ -d node_modules/playwright ] || npm install --silent >/dev/null 2>&1
./build.sh
echo "--- barcode reader"
node tests/test_scan.js
REAL=$(ls private/*.json 2>/dev/null | sort | tail -1 || true)
echo "--- interface and logic${REAL:+ (plus real data: $(basename "$REAL"))}"
node tests/test_app.js ${REAL:+"$REAL"}
echo "--- the three looks, phone and desktop"
node tests/test_ui.js docs/index.html tests/shots/ui | tail -3
echo "--- Design Lab smoke test"
node tests/smoke.js docs/index.html tests/shots/smoke | tail -1
