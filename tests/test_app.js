/* CICO · interface and logic tests in a real browser (Chromium via Playwright), driven through the page only.
   Synthetic data only (tests/fixture.json, "Test Person"). Clock frozen at 14.10.2026 13:10 local time. File pickers are
   switched off, so open/save take the file-input and download paths (the ones the iPhone uses too).
   node tests/test_app.js [path to a real data .json for an extra open + save round trip, kept in private/] */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const URL = require('url').pathToFileURL(path.resolve(__dirname, '../docs/index.html')).href;   // also right for Windows paths
const FIX = path.join(__dirname, 'fixture.json'), REAL = process.argv[2];
const clock = (y, m, d, h, mi) => `const _D=Date; const FIX=new _D(${y},${m},${d},${h},${mi},0).getTime();
class FD extends _D{constructor(...a){ if(a.length) super(...a); else super(FIX);} static now(){return FIX;}}; window.Date=FD;
window.showOpenFilePicker=undefined; window.showSaveFilePicker=undefined; window.showDirectoryPicker=undefined;`;

let ok = 0, bad = 0;
const check = (c, msg) => { if (c) ok++; else { bad++; console.log('FAIL  ' + msg); } };
const tsd = x => { let s = String(Math.round(Math.abs(x))), out = ''; while (s.length > 3){ out = '’' + s.slice(-3) + out; s = s.slice(0, -3); } return (x < 0 ? '−' : '') + s + out; };
const fx = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const kcal = it => it.k * it.g / 100;
const okt = Object.entries(fx.days).filter(([k, v]) => k.startsWith('2026-10') && k <= '2026-10-14' && v.items.length);
const oktAvg = okt.reduce((s, [, d]) => s + d.items.reduce((a, i) => a + kcal(i), 0), 0) / okt.length;
const heute = fx.days['2026-10-14'].items.reduce((a, i) => a + kcal(i), 0);

(async () => {
  const b = await chromium.launch();
  async function neu(o){
    o = o || {};
    const ctx = await b.newContext({ viewport: o.viewport || { width: 1300, height: 1000 }, acceptDownloads: true, isMobile: !!o.mobile, hasTouch: !!o.mobile,
      reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(o.clock || clock(2026, 9, 14, 13, 10));
    const pg = await ctx.newPage(), errs = [];
    pg.setDefaultTimeout(6000);
    await pg.route('**/fonts.g*/**', r => r.abort());       // web fonts are optional (system fallback)
    pg.on('pageerror', e => errs.push(e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await pg.goto(URL); await pg.waitForTimeout(250);
    return { ctx, pg, errs };
  }
  const oeffne = async (pg, f) => { await pg.click('#wahl button:has-text("Open your data file")'); await pg.setInputFiles('#dateiwahl', f); await pg.waitForTimeout(1600); };
  const speichere = async pg => {
    const [d] = await Promise.all([pg.waitForEvent('download'), pg.click('#sichern')]);
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cico-')), d.suggestedFilename());
    await d.saveAs(f); await pg.waitForTimeout(300);
    return { name: d.suggestedFilename(), data: JSON.parse(fs.readFileSync(f, 'utf8')), file: f };
  };

  // ---------------------------------------------------------------- empty start: targets, a food by hand
  let { ctx, pg, errs } = await neu();
  check((await pg.innerText('#wahl')).includes('Start fresh'), 'start screen offers Start fresh');
  check(!(await pg.innerText('#wahl')).includes('Continue'), 'no Continue without a local copy');
  await pg.click('#wahl button:has-text("Start fresh")'); await pg.waitForTimeout(700);
  check(await pg.isVisible('.blatt:has-text("Set your targets")'), 'first start asks for targets');
  await pg.fill('.zielblock:has-text("Maintenance") input >> nth=0', '2600');
  await pg.fill('.zielblock:has-text("Maintenance") input >> nth=1', '160');
  check((await pg.innerText('.zielblock:has-text("Maintenance") .summenzeile')).includes('= ' + tsd(2600) + ' kcal'), 'macro split adds up to the kcal');
  await pg.click('button:has-text("Save targets")'); await pg.waitForTimeout(500);
  const zt = await pg.evaluate("JSON.parse(localStorage.getItem('calorieTracker.data.v1')).data.config.targets");
  check(Math.abs(zt.maintain.protein * 4 + zt.maintain.carbs * 4 + zt.maintain.fat * 9 - 2600) < 1.5 && zt.maintain.protein === 160, 'stored target: grams add up to 2600 kcal, protein kept');
  check((await pg.innerText('#p-overview')).includes('kcal left') && (await pg.innerText('#p-overview')).includes(tsd(2600)), 'overview shows the new target');
  check((await pg.getAttribute('#sichern', 'class')).includes('is-dirty'), 'Save blinks after changes');
  await pg.click('#tabs button[data-tab=foods]'); await pg.waitForTimeout(300);
  await pg.click('#p-foods button:has-text("Add by hand")'); await pg.waitForTimeout(400);
  const f = '.blatt';
  await pg.fill(f + ' .feld:has-text("Name") input', 'Test oats');
  await pg.fill(f + ' .feld:has-text("Energy") input', '1557');
  check((await pg.innerText(f)).includes('looks like kJ'), 'kJ typed as kcal is spotted');
  await pg.click(f + ' .hinweis button'); await pg.waitForTimeout(100);
  check(await pg.inputValue(f + ' .feld:has-text("Energy") input') === '372', 'kJ converted to kcal');
  await pg.fill(f + ' .feld:has-text("Protein") input', '13.5'); await pg.fill(f + ' .feld:has-text("Carbs") input', '58.7'); await pg.fill(f + ' .feld:has-text("Fat") input', '7');
  check(await pg.isDisabled(f + ' .aktion button:has-text("Save")'), 'label kcal far from the macro sum: Save waits for a choice');
  await pg.click(f + ' button:has-text("Keep 372")'); await pg.waitForTimeout(150);
  await pg.click(f + ' .aktion button:has-text("Save")'); await pg.waitForTimeout(500);
  check((await pg.innerText('#p-foods')).includes('Test oats') && (await pg.innerText('#p-foods')).includes('372'), 'food added by hand is listed');
  check(!errs.length, 'no script errors (empty start): ' + errs.join('; '));
  await ctx.close();

  // ---------------------------------------------------------------- the fixture: figures, logging, saving
  ({ ctx, pg, errs } = await neu());
  await oeffne(pg, FIX);
  check(await pg.isVisible('#shell'), 'fixture opens');
  let txt = await pg.innerText('#p-overview');
  check(txt.includes(tsd(oktAvg)), 'October average per day ' + tsd(oktAvg) + ' kcal shown');
  check(txt.includes(String(okt.length)), 'days logged in October: ' + okt.length);
  check(txt.includes(tsd(heute)), 'today eaten ' + tsd(heute) + ' kcal shown');
  check(txt.includes('Light shred'), 'today is in the shred phase');
  check(await pg.$$eval('.kacheln .spark path.spark__line', ps => ps.filter(p => (p.getAttribute('d') || '').length > 10).length) >= 2, 'KPI tiles draw their lines');
  // bodyweight: the tile replaces On target, the chart draws a line through October's weigh-ins
  const gwOkt = Object.keys(fx.weights).filter(k => k.startsWith('2026-10') && k <= '2026-10-14').sort();
  const gwVor = Object.keys(fx.weights).filter(k => k < '2026-10-01').sort().pop();
  const gwShift = fx.weights[gwOkt[gwOkt.length - 1]] - fx.weights[gwVor];
  const gwKachel = await pg.innerText('.kachel:has-text("Bodyweight")');
  check(!txt.includes('On target') && gwKachel.includes(fx.weights[gwOkt[gwOkt.length - 1]].toFixed(1)) && gwKachel.includes((gwShift < 0 ? '−' : '+') + Math.abs(gwShift).toFixed(1) + ' kg since 30 Sep'),
    'Bodyweight tile: last weigh-in and the shift since the last one before October (' + gwKachel.replace(/\s+/g, ' ') + ')');
  check((await pg.$$('#p-overview .diagramm circle.gwpunkt')).length === gwOkt.length && await pg.isVisible('#p-overview .diagramm path.gwlinie') && txt.includes('Bodyweight'),
    'Energy per day draws the bodyweight line through ' + gwOkt.length + ' weigh-ins');
  check(await pg.evaluate(() => getComputedStyle(document.querySelector('#toasts')).pointerEvents === 'none'), 'toasts never catch a tap');
  await pg.click('.segmented button:has-text("YTD")'); await pg.waitForTimeout(500);
  txt = await pg.innerText('#p-overview');
  check(txt.includes('Energy per week') && txt.includes('January to October 2026'), 'YTD shows the weekly chart');
  await pg.click('#tabs button[data-tab=entry]'); await pg.waitForTimeout(500);
  const vorher = (await pg.$$('#p-entry .mahlzeit .zeile')).length;
  check(vorher === fx.days['2026-10-14'].items.length, 'entry lists the day’s items');
  await pg.click('#p-entry .chip:has-text("Banana")'); await pg.waitForTimeout(500);
  check(await pg.isVisible('.blatt h2:has-text("Banana")'), 'a quick-pick chip opens its log sheet');
  await pg.click('.blatt .aktion .btn:has-text("Add to")'); await pg.waitForTimeout(700);
  check((await pg.$$('#p-entry .mahlzeit .zeile')).length === vorher + 1, 'food logged');
  check(await pg.evaluate(() => { const t = document.querySelector('#toasts .toast'); return !!t && getComputedStyle(t).pointerEvents === 'none'; }), 'the posting toast lets taps through to the tile under it');
  await pg.click('#p-entry .tagsumme .phase.gw'); await pg.waitForTimeout(400);
  check(await pg.isVisible('.blatt h2:has-text("Bodyweight")'), 'the weight pill on Entry opens the bodyweight sheet');
  await pg.fill('.blatt .gramm input', '79,2');
  check((await pg.innerText('.blatt .umrech')).includes('since'), 'the sheet shows the shift since the last weigh-in');
  await pg.click('.blatt .aktion .btn:has-text("Save")'); await pg.waitForTimeout(500);
  check((await pg.innerText('#p-entry .tagsumme .phase.gw')).includes('79.2 kg'), 'bodyweight logged for the day (comma typed as decimal point)');
  await pg.fill('#p-entry .suche input', 'choc'); await pg.waitForTimeout(250);
  check((await pg.innerText('#p-entry')).includes('Dark chocolate'), 'search finds by part of the name');
  await pg.fill('#p-entry .suche input', '');
  check((await pg.getAttribute('#sichern', 'class')).includes('is-dirty'), 'logging marks the file unsaved');
  const ver = await pg.getAttribute('meta[name="build"]', 'content');
  await pg.click('#einstellungen'); await pg.waitForTimeout(500);
  check(ver && (await pg.innerText('.blatt')).includes('build ' + ver), 'settings sheet shows the build version ' + ver);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  await pg.evaluate(() => Kit.set('prism', 'user')); await pg.waitForTimeout(300);
  const saved = await speichere(pg);
  check(saved.name === '2026-10-14_CICO.json', 'file named by the save date: ' + saved.name);
  check(!(await pg.getAttribute('#sichern', 'class')).includes('is-dirty'), 'Save stops blinking after saving');
  check(saved.data.app === 'calorie-tracker' && saved.data.settings && saved.data.settings.theme === 'prism', 'the look travels in the file');
  check(saved.data.days['2026-10-14'].items.length === vorher + 1, 'saved file holds the new item');
  check(saved.data.weights && saved.data.weights['2026-10-14'] === 79.2 && Object.keys(saved.data.weights).length === Object.keys(fx.weights).length, 'saved file holds the bodyweights');
  check(Object.keys(saved.data.foods).length === Object.keys(fx.foods).length && Object.keys(saved.data.days).length >= Object.keys(fx.days).length, 'foods and days kept');
  const unbekannt = Object.keys(fx).filter(k => !['app', 'v', 'saved', 'config', 'foods', 'days', 'weights', 'settings'].includes(k));
  check(unbekannt.every(k => JSON.stringify(saved.data[k]) === JSON.stringify(fx[k])), 'unknown fields kept: ' + (unbekannt.join(', ') || 'none in fixture'));
  check(!errs.length, 'no script errors (fixture): ' + errs.join('; '));
  await ctx.close();

  // ---------------------------------------------------------------- round trip: the saved file opens again, with its look
  ({ ctx, pg, errs } = await neu());
  await oeffne(pg, saved.file);
  await pg.click('#tabs button[data-tab=entry]'); await pg.waitForTimeout(500);
  check((await pg.$$('#p-entry .mahlzeit .zeile')).length === vorher + 1, 'reopened file shows the logged item');
  check(await pg.evaluate(() => document.documentElement.dataset.theme) === 'prism', 'opening a file applies its look');
  check(!(await pg.getAttribute('#sichern', 'class')).includes('is-dirty'), 'opening does not count as a change');
  await ctx.close();

  // ---------------------------------------------------------------- phone: no sideways scrolling, reduced motion
  ({ ctx, pg, errs } = await neu({ viewport: { width: 375, height: 800 }, mobile: true, reduced: true }));
  await oeffne(pg, FIX);
  for (const t of ['overview', 'entry', 'foods']){
    await pg.click('#tabs button[data-tab=' + t + ']'); await pg.waitForTimeout(400);
    check(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scrolling at 375 px on ' + t);
  }
  check(!errs.length, 'no script errors (phone, reduced motion): ' + errs.join('; '));
  await ctx.close();

  // ---------------------------------------------------------------- the year list follows the day into a year without entries
  ({ ctx, pg, errs } = await neu({ clock: clock(2026, 0, 2, 10, 0) }));
  const jan = { app: 'calorie-tracker', v: 1, saved: null, config: fx.config, foods: fx.foods,
    days: { '2026-01-01': fx.days['2026-10-14'] } };
  const janFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cico-')), 'jan.json'); fs.writeFileSync(janFile, JSON.stringify(jan));
  await oeffne(pg, janFile);
  for (let i = 0; i < 3; i++){ await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(650); }
  const jahre = await pg.$$eval('#p-overview select', ss => ss.map(s => Array.from(s.options).map(o => o.textContent).join('|') + '=' + s.value));
  check(jahre.some(x => x.startsWith('2025|2026=2025')), 'swiping into 2025 keeps the year list in step: ' + jahre.join(' / '));
  await ctx.close();

  // ---------------------------------------------------------------- optional: the owner's real file (private/, never in the repo)
  if (REAL){
    ({ ctx, pg, errs } = await neu());
    await oeffne(pg, REAL);
    const r = await speichere(pg), orig = JSON.parse(fs.readFileSync(REAL, 'utf8'));
    check(Object.keys(r.data.days).length === Object.keys(orig.days).length && Object.keys(r.data.foods).length === Object.keys(orig.foods).length, 'real file: open + save keeps every day and food');
    check(!errs.length, 'no script errors (real file): ' + errs.join('; '));
    await ctx.close();
  }

  // ---------------------------------------------------------------- computer: saved elsewhere since it was opened (the iPhone saved in between)
  const platte = `window.__disk = {};
    const mk = n => ({ name: n, kind: 'file', getFile: async () => new File([window.__disk[n] || ''], n),
      createWritable: async () => { let s = ''; return { write: async b => { s += typeof b === 'string' ? b : await b.text(); }, close: async () => { window.__disk[n] = s; } }; },
      queryPermission: async () => 'granted', requestPermission: async () => 'granted' });
    window.showOpenFilePicker = async () => [mk('2026-10-14_CICO.json')];
    window.showSaveFilePicker = async o => mk(o.suggestedName);`;
  ({ ctx, pg, errs } = await neu({ clock: clock(2026, 9, 14, 13, 10).replace('window.showOpenFilePicker=undefined; window.showSaveFilePicker=undefined;', '') + platte }));
  await pg.evaluate(t => { window.__disk['2026-10-14_CICO.json'] = t; }, fs.readFileSync(FIX, 'utf8'));
  await pg.click('#wahl button:has-text("Open your data file")'); await pg.waitForTimeout(1200);
  check(await pg.isVisible('#shell'), 'computer: the file opens through the file picker');
  const ANDERSWO = '2026-10-14T09:00:00.000Z';
  const aufDisk = () => pg.evaluate(() => JSON.parse(window.__disk['2026-10-14_CICO.json']).saved);
  await pg.evaluate(s => { const o = JSON.parse(window.__disk['2026-10-14_CICO.json']); o.saved = s; window.__disk['2026-10-14_CICO.json'] = JSON.stringify(o); }, ANDERSWO);
  await pg.click('#sichern'); await pg.waitForTimeout(500);
  check(await pg.isVisible('.blatt:has-text("Saved elsewhere since you opened it")'), 'saved elsewhere since it was opened: Save asks first');
  await pg.click('.blatt button:has-text("Cancel")'); await pg.waitForTimeout(400);
  check(await aufDisk() === ANDERSWO, 'Cancel leaves the other version untouched');
  await pg.click('#sichern'); await pg.waitForTimeout(500);
  await pg.click('.blatt button:has-text("Replace it")'); await pg.waitForTimeout(500);
  check(await aufDisk() !== ANDERSWO, 'Replace it writes this window’s version');
  await pg.click('#sichern'); await pg.waitForTimeout(500);
  check(!(await pg.isVisible('.blatt:has-text("Saved elsewhere")')), 'the next save goes straight in (nothing saved elsewhere since)');
  check(!errs.length, 'no script errors (file picker, saved elsewhere): ' + errs.join('; '));
  await ctx.close();

  // ---------------------------------------------------------------- Save to folder: today's file into the app folder, the one it replaces into 02 BACKUP
  const ordnerFS = `(() => {
    const nf = () => new DOMException('no', 'NotFoundError');
    const fakeFile = (n, t) => { const f = { kind: 'file', name: n, _t: t || '', getFile: async () => new File([f._t], n),
      createWritable: async () => { let s = ''; return { write: async b => { s += typeof b === 'string' ? b : await b.text(); }, close: async () => { f._t = s; } }; },
      queryPermission: async () => 'granted', requestPermission: async () => 'granted' }; return f; };
    const fakeDir = n => { const kids = new Map(); const d = { kind: 'directory', name: n, kids, gone: false,
      queryPermission: async () => 'granted', requestPermission: async () => 'granted', isSameEntry: async o => o === d,
      getFileHandle: async (x, o) => { if (d.gone) throw nf(); let f = kids.get(x); if (!f){ if (!(o && o.create)) throw nf(); f = fakeFile(x); kids.set(x, f); } return f; },
      getDirectoryHandle: async (x, o) => { let f = kids.get(x); if (!f){ if (!(o && o.create)) throw nf(); f = fakeDir(x); kids.set(x, f); } return f; },
      removeEntry: async x => { if (!kids.delete(x)) throw nf(); },
      values: () => { const it = kids.values(); return { next: async () => { if (d.gone) throw nf(); return it.next(); }, [Symbol.asyncIterator](){ return this; } }; } }; return d; };
    const app = fakeDir('CICO'), bkp = fakeDir('02 BACKUP'); app.kids.set('02 BACKUP', bkp);
    window.__app = app; window.__bkp = bkp; window.__fakeFile = fakeFile;
    window.showOpenFilePicker = async () => [app.kids.get('2026-10-13_CICO.json')];
    window.showSaveFilePicker = async o => fakeFile(o.suggestedName);
    window.showDirectoryPicker = async () => app;
  })();`;
  ({ ctx, pg, errs } = await neu({ clock: clock(2026, 9, 14, 13, 10).replace('window.showOpenFilePicker=undefined; window.showSaveFilePicker=undefined; window.showDirectoryPicker=undefined;', '') + ordnerFS }));
  await pg.evaluate(t => { const o = JSON.parse(t); o.saved = '2026-10-13T19:00:00.000Z'; window.__app.kids.set('2026-10-13_CICO.json', window.__fakeFile('2026-10-13_CICO.json', JSON.stringify(o)));
    window.__app.kids.set('notes.md', window.__fakeFile('notes.md', '# pointer')); }, fs.readFileSync(FIX, 'utf8'));
  const inhaltOrdner = () => pg.evaluate(() => [[...window.__app.kids.keys()].sort().join('|'), [...window.__bkp.kids.keys()].sort().join('|')]);
  await pg.click('#wahl button:has-text("Open your data file")'); await pg.waitForTimeout(1200);
  await pg.click('#ordner'); await pg.waitForTimeout(400);
  await pg.click('.blatt button:has-text("Choose")'); await pg.waitForTimeout(800);
  check((await pg.innerText('#toasts')).includes('Backups go to “02 BACKUP”'), 'Save to folder: choosing the app folder finds its 02 BACKUP by itself');
  await pg.click('.blatt button:has-text("Save now")'); await pg.waitForTimeout(800);
  let [imApp, imBackup] = await inhaltOrdner();
  check(imApp === '02 BACKUP|2026-10-14_CICO.json|notes.md' && imBackup === '2026-10-13_CICO.json', 'today’s file goes into the app folder, the one it replaces into 02 BACKUP, nothing else is touched (' + imApp + ' / ' + imBackup + ')');
  await pg.click('#sichern'); await pg.waitForTimeout(600);
  check(!(await pg.isVisible('.blatt:has-text("Replace it")')) && (await inhaltOrdner())[0] === imApp, 'saving again the same day goes straight into today’s file');
  await pg.evaluate(() => { const f = window.__app.kids.get('2026-10-14_CICO.json'), o = JSON.parse(f._t); o.saved = '2026-10-14T05:00:00.000Z'; f._t = JSON.stringify(o); });
  await pg.click('#sichern'); await pg.waitForTimeout(600);
  check(await pg.isVisible('.blatt:has-text("Today’s file is already there")'), 'today’s file that is not this window’s version: Save asks first');
  await pg.click('.blatt button:has-text("Replace it")'); await pg.waitForTimeout(800);
  [imApp, imBackup] = await inhaltOrdner();
  check(imBackup === '2026-10-13_CICO.json|2026-10-14_CICO.json' && imApp.includes('2026-10-14_CICO.json'), 'Replace it: the old one goes to 02 BACKUP first, nothing is deleted (' + imBackup + ')');
  await pg.evaluate(() => { window.__app.gone = true; });
  await pg.click('#sichern'); await pg.waitForTimeout(800);
  check((await pg.innerText('#toasts')).includes('cannot be found any more') && await pg.isVisible('.blatt:has-text("Save to folder")'), 'a folder that was moved or renamed: the app says so and asks for it again');
  check(!errs.length, 'no script errors (Save to folder): ' + errs.join('; '));
  await ctx.close();

  // ---------------------------------------------------------------- offline cache: the origin jeetx1.github.io is shared with the other apps
  const sw = fs.readFileSync(path.join(__dirname, '../docs/sw.js'), 'utf8');
  check(/k\.startsWith\('cico-'\) && k !== CACHE/.test(sw), 'sw.js clears only its own caches (RISE keeps its offline copy)');
  check(/cache: 'reload'/.test(sw), 'sw.js fills a new cache past the browser cache (never the previous build)');

  await b.close();
  console.log((bad ? 'FAILED ' : 'ok ') + ok + '/' + (ok + bad) + ' interface checks');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
