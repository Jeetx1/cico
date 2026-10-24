#!/bin/bash
# Builds the single-file app from src/ (plain concatenation, no tooling) into docs/index.html,
# and copies the hosting files (manifest, icons, offline cache) from pwa/ into docs/.
# docs/ is what GitHub Pages serves (Settings > Pages > Deploy from a branch: main, folder /docs).
# The same docs/index.html is the offline copy in the app folder (APPS/CICO/YYYY-MM-DD_CICO.html).
set -e
cd "$(dirname "$0")"
mkdir -p docs
cat src/01_head.html src/02_dl_tokens.html src/03_tokens.html src/04_dl_components.html src/05_styles.html src/06_dl_effects.html src/07_effects.html src/08_body.html src/09_dl_kit.html src/10_helpers.js src/15_scan.js src/20_data.js src/30_state.js src/40_files.js src/50_frame.js src/60_overview.js src/70_entry.js src/75_scanflow.js src/80_foods.js src/82_booking.js src/99_boot.js > docs/index.html
cp pwa/manifest.webmanifest pwa/sw.js pwa/icon-180.png pwa/icon-192.png pwa/icon-512.png docs/
# every script block must compile, and sw.js must carry the same build version as the page
node - <<'JS'
const fs = require('fs'), vm = require('vm');
const s = fs.readFileSync('docs/index.html', 'utf8'), sw = fs.readFileSync('docs/sw.js', 'utf8');
const re = /<script[^>]*>([\s\S]*?)<\/script>/g; let m, i = 0;
while ((m = re.exec(s))){ try { new vm.Script(m[1], { filename: 'script block ' + i }); } catch (e){ console.error('Syntax error in script block ' + i + ':\n' + e.message); process.exit(1); } i++; }
const v = (s.match(/<meta name="build" content="([^"]+)">/) || [])[1], c = (sw.match(/const CACHE = 'cico-([^']+)'/) || [])[1];
if (!v || v !== c){ console.error('Build version mismatch: page "' + v + '", sw.js "' + c + '". Set the same version in src/01_head.html and pwa/sw.js.'); process.exit(1); }
console.log('Built docs/index.html (' + Math.round(Buffer.byteLength(s) / 1024) + ' KB), build ' + v + ', all ' + i + ' script blocks compile.');
JS
