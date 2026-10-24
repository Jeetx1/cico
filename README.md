<img src="pwa/icon-192.png" width="96" alt="">

# CICO

Calories in, calories out. A calorie tracker in one offline HTML app: scan a barcode once, type the label values once,
log it forever. Overview with key figures, daily or weekly chart, macro split and phases (Maintenance, Light shred,
Surplus day); Entry by meal with day swipe; Foods with the app's own barcode reader. No libraries, no server, no tracking.
Three looks under Appearance (Glass, Ember, Prism), built on the Design Lab system.

The app holds no data: your log is a separate `.json` file you open in it. Save writes back into that file (Chrome/Edge
on a computer), hands it to the share sheet (iPhone), or downloads it.

- App: `docs/index.html`, built from `src/` (plain concatenation) by `./build.sh`, or on Windows by double-clicking
  `build.cmd`; served by GitHub Pages from `/docs` together with the manifest, icons and offline cache from `pwa/`.
- Tests: `./run_tests.sh` (Node + Playwright with Chromium; synthetic data of a fictional "Test Person"). CI runs them
  on every push and fails if `docs/` is not the build of `src/` and `pwa/`.
- Version: `src/01_head.html` (`<meta name="build">`) and `pwa/sw.js` (`CACHE`) carry the same build number; the app
  shows it at the bottom of the settings sheet. The build stops if they differ.

## Structure

| Path | What |
|---|---|
| `src/01_head.html` | head, look before first paint, fixed app icon, build version |
| `src/02_dl_tokens.html`, `04_dl_components.html`, `06_dl_effects.html`, `09_dl_kit.html` | Design Lab kit (theme tokens, components, signature effects, theme modules + kit runtime). Copied from the kit, never edited here |
| `src/03_tokens.html`, `05_styles.html`, `07_effects.html` | CICO's own colours, styles and effects (the bite, day level), tokens only |
| `src/08_body.html` | markup: start screen, shell, three pages |
| `src/10_helpers.js` … `99_boot.js` | the app: helpers, barcode reader, data, state, files, frame, Overview, Entry, scanning, Foods, posting moment, boot |
| `pwa/` | manifest, offline cache (`sw.js`), home-screen icons |
| `tests/` | `test_app.js` (logic and interface), `test_ui.js` (three looks), `smoke.js` (Design Lab), `test_scan.js` (barcode reader), `fixture.json` + `make_fixture.py` (synthetic data), barcode photos |

## Your data stays out of this repository

A GitHub Pages repository is public. Everything personal is git-ignored: `private/`, every calorie log `.json`, backups
and dated copies of the app. Before committing, the changes should list only `src/`, `pwa/`, `docs/`, `tests/` and the
files in this folder.
