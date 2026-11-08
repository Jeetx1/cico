// CICO · the three looks on phone and desktop: sample data, day swipe, look button. Screenshots in tests/shots/ui (git-ignored).
// node tests/test_ui.js [docs/index.html] [shots dir]
const { chromium } = (() => { try { return require('playwright'); } catch (e){ return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs');
const FILE = require('url').pathToFileURL(require('path').resolve(process.argv[2] || require('path').join(__dirname, '../docs/index.html'))).href;
const OUT = process.argv[3] || require('path').join(__dirname, 'shots', 'ui');
fs.mkdirSync(OUT, { recursive: true });

function sample(){
  const foods = {
    f1: { name: 'Skyr nature', brand: 'Emmi', barcode: '', unit: 'g', k: 63, p: 11, c: 4, f: 0.2, portion: { name: 'cup', g: 170 }, fav: true, made: 'manual', created: '2026-09-01T08:00:00Z' },
    f2: { name: 'Oats', brand: 'Migros', barcode: '', unit: 'g', k: 372, p: 13, c: 59, f: 7, portion: null, fav: true, made: 'manual', created: '2026-09-01T08:00:00Z' },
    f3: { name: 'Chicken breast', brand: '', barcode: '', unit: 'g', k: 110, p: 23, c: 0, f: 1.5, portion: null, fav: false, made: 'manual', created: '2026-09-02T08:00:00Z' },
    f4: { name: 'Basmati rice', brand: 'Uncle Ben', barcode: '', unit: 'g', k: 350, p: 8, c: 77, f: 1, portion: null, fav: false, made: 'manual', created: '2026-09-02T08:00:00Z' },
    f5: { name: 'Banana', brand: '', barcode: '', unit: 'g', k: 89, p: 1.1, c: 23, f: 0.3, portion: { name: 'piece', g: 120 }, fav: false, made: 'manual', created: '2026-09-03T08:00:00Z' },
    f6: { name: 'Dark chocolate 70%', brand: 'Lindt', barcode: '', unit: 'g', k: 566, p: 9, c: 34, f: 41, portion: { name: 'row', g: 20 }, fav: false, made: 'manual', created: '2026-09-04T08:00:00Z' },
    f7: { name: 'Whey protein', brand: 'Sponser', barcode: '', unit: 'g', k: 380, p: 78, c: 6, f: 5, portion: { name: 'scoop', g: 30 }, fav: true, made: 'manual', created: '2026-09-05T08:00:00Z' }
  };
  const days = {}; let id = 0;
  const today = new Date(); const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  for (let k = 50; k >= 0; k--){
    const d = new Date(today.getTime() - k * 86400000), it = [];
    const add = (food, g, meal) => { const f = foods[food]; it.push({ id: 'i' + (++id), food, name: f.name, brand: f.brand, g, meal, k: f.k, p: f.p, c: f.c, f: f.f, at: '' }); };
    if (k % 9 === 4) continue;
    add('f2', 60 + (k % 3) * 10, 'Breakfast'); add('f1', 170, 'Breakfast');
    add('f3', 180 + (k % 4) * 20, 'Lunch'); add('f4', 80, 'Lunch');
    if (k % 2) add('f5', 120, 'Snacks');
    add('f3', 150, 'Dinner'); add('f4', 70 + (k % 5) * 10, 'Dinner');
    if (k % 3 === 0) add('f6', 20 + (k % 2) * 20, 'Snacks');
    add('f7', 30, 'Snacks');
    days[iso(d)] = { items: it };
  }
  const t = { kcal: 2400, protein: null, carbs: null, fat: null, split: { p: 30, c: 45, f: 25 } };
  return { app: 'calorie-tracker', v: 1, saved: null, config: { name: 'Test Person', targets: { maintain: t, shred: { kcal: 2100, split: { p: 35, c: 40, f: 25 } }, surplus: { kcal: 2800, split: { p: 25, c: 50, f: 25 } } }, phaseFrom: [] }, foods, days };
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  async function page(vp, theme, touch){
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: !!touch, isMobile: !!touch });
    await ctx.addInitScript(([data, theme]) => {
      try {
        localStorage.setItem('calorieTracker.data.v1', JSON.stringify({ at: new Date().toISOString(), name: '2026-10-20_CICO.json', dirty: false, data }));
        if (theme) localStorage.setItem('dl.theme.calorie-tracker', theme);
      } catch (e){}
    }, [sample(), theme]);
    const p = await ctx.newPage();
    p.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource/.test(m.text())) errors.push(theme + ' ' + vp.width + ': ' + m.text()); });   // web fonts are optional
    p.on('pageerror', e => errors.push(theme + ' ' + vp.width + ' PAGEERROR: ' + e.message));
    await p.route('**/fonts.googleapis.com/**', r => r.abort());
    await p.goto(FILE);
    await p.waitForTimeout(300);
    return { p, ctx };
  }
  for (const theme of ['ember', 'glass', 'prism']){
    // phone
    let { p, ctx } = await page({ width: 390, height: 844 }, theme, true);
    await p.screenshot({ path: OUT + '/' + theme + '-phone-start.png' });
    await p.click('#wahl button');                   // Continue
    await p.waitForTimeout(1800);
    await p.screenshot({ path: OUT + '/' + theme + '-phone-overview.png' });
    // swipe right-to-left on the overview: next day? (today is the last day, so go back first: left-to-right)
    const swipe = async (from, to) => {
      await p.evaluate(([from, to]) => {
        const el = document.querySelector('#p-overview.on, #p-entry.on'), r = el.getBoundingClientRect();
        const y = r.top + 120, ev = (type, x) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
        ev('pointerdown', from); for (let i = 1; i <= 8; i++) ev('pointermove', from + (to - from) * i / 8); ev('pointerup', to);
      }, [from, to]);
      await p.waitForTimeout(900);
    };
    await swipe(60, 320);                            // to the day before
    await p.screenshot({ path: OUT + '/' + theme + '-phone-overview-yesterday.png' });
    const t1 = await p.evaluate(() => document.querySelector('.heute h3') && document.querySelector('.heute h3').textContent);
    console.log(theme, 'after swipe right, overview day =', t1);
    // the look button
    await p.click('#look'); await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '/' + theme + '-phone-look.png' });
    await p.keyboard.press('Escape');
    // entry
    await p.click('.tab[data-tab="entry"]'); await p.waitForTimeout(1200);
    await p.screenshot({ path: OUT + '/' + theme + '-phone-entry.png' });
    await swipe(320, 60);
    const t2 = await p.evaluate(() => document.querySelector('.tagleiste h2') && document.querySelector('.tagleiste h2').firstChild.textContent);
    console.log(theme, 'after swipe left on entry, day =', t2);
    await ctx.close();
    // desktop
    ({ p, ctx } = await page({ width: 1360, height: 900 }, theme, false));
    await p.click('#wahl button'); await p.waitForTimeout(1800);
    await p.screenshot({ path: OUT + '/' + theme + '-desk-overview.png' });
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(800);
    for (let i = 0; i < 30; i++){ await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(650); }
    const per = await p.evaluate(() => document.querySelector('.seitenkopf p').textContent + ' | ' + document.querySelector('.heute h3').textContent + ' ' + document.querySelector('.heute .unter').textContent);
    console.log(theme, 'after 31 days back on desktop:', per);
    await p.screenshot({ path: OUT + '/' + theme + '-desk-overview-back.png' });
    await p.click('#look'); await p.waitForTimeout(400);
    await p.click('.lookmenu__more'); await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '/' + theme + '-desk-look.png' });
    await ctx.close();
  }
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await b.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
