/* ================================================================ data
   { app, v, saved,
     config: { name, targets: { maintain|shred|surplus: { kcal, protein, carbs, fat } }, phaseFrom: [{ from, phase }] },
     foods:  { id: { name, brand, barcode, unit, k, p, c, f (all per 100 g/ml), portion: { name, g } | null, fav, made, created, updated } },
     days:   { 'YYYY-MM-DD': { phase?, items: [{ id, food, name, brand, g, meal, k, p, c, f, at }] } },
     weights: { 'YYYY-MM-DD': kg } }
   Bodyweight sits apart from the days: an older build keeps it as an unknown field (it drops days without items).
   Each logged item keeps its own copy of the values per 100, so a later edit of the food never changes the past
   by accident (the food dialog asks whether to update logged entries).                                          */
const APP = 'calorie-tracker', VERSION = 1;
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const PHASES = [
  { id: 'maintain', name: 'Maintenance', kurz: 'Maintenance' },
  { id: 'shred', name: 'Light shred', kurz: 'Shred' },
  { id: 'surplus', name: 'Surplus day', kurz: 'Surplus' }
];
const PHASE = Object.fromEntries(PHASES.map(p => [p.id, p]));
const MAKRO = [
  { id: 'p', name: 'Protein', farbe: 'var(--prot)', hex: '#86D4C4', kcal: 4 },
  { id: 'c', name: 'Carbs', farbe: 'var(--carb)', hex: '#7DB1E6', kcal: 4 },
  { id: 'f', name: 'Fat', farbe: 'var(--fett)', hex: '#B9A9F0', kcal: 9 }
];

let DATA = null;

function leer(){
  return { app: APP, v: VERSION, saved: null,
    config: { name: '', targets: { maintain: ziel0(), shred: ziel0(), surplus: ziel0() }, phaseFrom: [] },
    foods: {}, days: {}, weights: {} };
}
function ziel0(){ return { kcal: null, protein: null, carbs: null, fat: null, split: null }; }
/* The macro targets are a split of the kcal target in percent, so they always add up to it:
   grams = kcal x share / kcal per gram (protein 4, carbs 4, fat 9: the general factors on Swiss and EU labels). */
const SPLIT0 = { p: 30, c: 40, f: 30 };
const r2 = x => Math.round(x * 100) / 100;
function splitGueltig(s){ return s && ['p', 'c', 'f'].every(k => typeof s[k] === 'number' && s[k] >= 0 && s[k] <= 100) && Math.abs(s.p + s.c + s.f - 100) < .05; }
/* the split of a stored target; older targets without one are derived from their grams */
function splitVon(z){
  if (splitGueltig(z.split)) return { p: z.split.p, c: z.split.c, f: z.split.f };
  if (!z.kcal) return Object.assign({}, SPLIT0);
  const p = z.protein ? Math.min(100, z.protein * 4 / z.kcal * 100) : SPLIT0.p, rest = 100 - p;
  const cK = z.carbs ? z.carbs * 4 : 0, fK = z.fat ? z.fat * 9 : 0;
  const c = cK + fK > 0 ? rest * cK / (cK + fK) : rest * SPLIT0.c / (SPLIT0.c + SPLIT0.f);
  return { p: r2(p), c: r2(c), f: r2(100 - r2(p) - r2(c)) };
}
function grammVon(kcal, s){ return kcal ? { protein: Math.round(kcal * s.p / 400 * 10) / 10, carbs: Math.round(kcal * s.c / 400 * 10) / 10, fat: Math.round(kcal * s.f / 900 * 10) / 10 } : { protein: null, carbs: null, fat: null }; }
const num = (x, min, max) => { const v = zahlLesen(x); return v === null || v < (min || 0) || (max !== undefined && v > max) ? null : v; };

/* every file goes through here; fields the app does not know are kept */
function normalize(o){
  if (!o || typeof o !== 'object') throw new Error('The file is empty.');
  if (o.app && o.app !== APP) throw new Error('This file belongs to another app (' + o.app + ').');
  const d = Object.assign({}, o);
  d.app = APP; d.v = VERSION;
  const c = d.config = Object.assign({}, o.config || {});
  c.name = typeof c.name === 'string' ? c.name : '';
  const t = Object.assign({}, c.targets || {});
  PHASES.forEach(p => { const z = Object.assign(ziel0(), t[p.id] || {});
    z.kcal = num(z.kcal, 1, 20000); z.protein = num(z.protein, 0, 1000); z.carbs = num(z.carbs, 0, 2000); z.fat = num(z.fat, 0, 1000);
    /* a valid split is the source of truth: the grams are recomputed from it, so they always add up to the kcal */
    if (splitGueltig(z.split)){ z.split = { p: z.split.p, c: z.split.c, f: z.split.f }; if (z.kcal) Object.assign(z, grammVon(z.kcal, z.split)); }
    else z.split = null;
    t[p.id] = z; });
  c.targets = t;
  c.phaseFrom = (Array.isArray(c.phaseFrom) ? c.phaseFrom : []).filter(x => x && /^\d{4}-\d{2}-\d{2}$/.test(x.from) && PHASE[x.phase])
    .map(x => ({ from: x.from, phase: x.phase })).sort((a, b) => a.from < b.from ? -1 : 1);
  const foods = {};
  for (const id in (o.foods || {})){
    const f = Object.assign({}, o.foods[id]);
    if (!f || typeof f.name !== 'string' || !f.name.trim()) continue;
    f.name = f.name.trim(); f.brand = typeof f.brand === 'string' ? f.brand.trim() : '';
    f.barcode = f.barcode ? String(f.barcode).replace(/\D/g, '') : '';
    f.unit = f.unit === 'ml' ? 'ml' : 'g';
    f.k = num(f.k, 0, 1000) || 0; f.p = num(f.p, 0, 100) || 0; f.c = num(f.c, 0, 100) || 0; f.f = num(f.f, 0, 100) || 0;
    f.portion = f.portion && num(f.portion.g, 0.1, 5000) ? { name: String(f.portion.name || 'Portion'), g: num(f.portion.g, 0.1, 5000) } : null;
    f.fav = !!f.fav; f.made = f.made === 'scan' ? 'scan' : 'manual';
    foods[id] = f;
  }
  d.foods = foods;
  const days = {};
  for (const iso in (o.days || {})){
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const t0 = Object.assign({}, o.days[iso]);
    t0.items = (Array.isArray(t0.items) ? t0.items : []).filter(x => x && num(x.g, 0.01, 100000)).map(x => {
      const it = Object.assign({}, x);
      it.id = it.id || neueId(); it.g = num(it.g, 0.01, 100000);
      it.meal = MEALS.indexOf(it.meal) >= 0 ? it.meal : 'Snacks';
      it.name = String(it.name || (foods[it.food] && foods[it.food].name) || 'Food');
      it.k = num(it.k, 0, 1000) || 0; it.p = num(it.p, 0, 100) || 0; it.c = num(it.c, 0, 100) || 0; it.f = num(it.f, 0, 100) || 0;
      return it;
    });
    if (t0.phase && !PHASE[t0.phase]) delete t0.phase;
    if (t0.items.length || t0.phase) days[iso] = t0;
  }
  d.days = days;
  const weights = {};
  for (const iso in (o.weights || {})){ const kg = num(o.weights[iso], 20, 400); if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && kg) weights[iso] = Math.round(kg * 10) / 10; }
  d.weights = weights;
  return d;
}

/* ---------- arithmetic */
const kcalAusMakros = (p, c, f) => p * 4 + c * 4 + f * 9;
function posten(it){ const x = it.g / 100; return { kcal: it.k * x, p: it.p * x, c: it.c * x, f: it.f * x }; }
function summe(items){
  const s = { kcal: 0, p: 0, c: 0, f: 0, n: 0 };
  (items || []).forEach(it => { const v = posten(it); s.kcal += v.kcal; s.p += v.p; s.c += v.c; s.f += v.f; s.n++; });
  return s;
}
function tag(iso){ return DATA.days[iso] || null; }
function tagSumme(iso){ const t = tag(iso); return summe(t ? t.items : []); }
function phaseVon(iso){
  const t = tag(iso); if (t && t.phase) return t.phase;
  let p = 'maintain';
  for (const x of DATA.config.phaseFrom){ if (x.from <= iso) p = x.phase; else break; }
  return p;
}
function zielVon(iso){ return DATA.config.targets[phaseVon(iso)] || ziel0(); }
function zielGesetzt(){ return PHASES.some(p => DATA.config.targets[p.id].kcal); }

/* ---------- bodyweight: one figure per day, in kg */
function gewicht(iso){ const kg = DATA.weights[iso]; return typeof kg === 'number' ? kg : null; }
function gewichteIn(von, bis){ return Object.keys(DATA.weights).filter(i => i >= von && i <= bis).sort().map(iso => ({ iso, kg: DATA.weights[iso] })); }
/* the last weigh-in before a day */
function gewichtVor(iso){ const v = Object.keys(DATA.weights).filter(i => i < iso).sort().pop(); return v ? { iso: v, kg: DATA.weights[v] } : null; }
const kg1 = x => (Math.round(x * 10) / 10).toFixed(1);

/* ---------- foods */
function foodListe(){ return Object.keys(DATA.foods).map(id => Object.assign({ id }, DATA.foods[id])); }
function foodNachCode(code){ for (const id in DATA.foods) if (DATA.foods[id].barcode === code) return Object.assign({ id }, DATA.foods[id]); return null; }
/* usage across the log: count and last day, for "Recent" and sorting */
function gebrauch(){
  const g = {};
  Object.keys(DATA.days).sort().forEach(iso => DATA.days[iso].items.forEach(it => {
    if (!it.food) return; const x = g[it.food] || (g[it.food] = { n: 0, last: '', lastG: 0, lastMeal: '' });
    x.n++; if (iso >= x.last){ x.last = iso; x.lastG = it.g; x.lastMeal = it.meal; }
  }));
  return g;
}
function eintraegeVon(foodId){ let n = 0; for (const iso in DATA.days) DATA.days[iso].items.forEach(it => { if (it.food === foodId) n++; }); return n; }
function normName(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function treffer(f, q){
  if (!q) return 1;
  const hay = normName(f.name + ' ' + (f.brand || '')), w = normName(q).split(' ').filter(Boolean);
  if (/^\d{6,}$/.test(q.trim())) return f.barcode && f.barcode.indexOf(q.trim()) >= 0 ? 3 : 0;
  let s = 0;
  for (const x of w){ const i = hay.indexOf(x); if (i < 0) return 0; s += i === 0 || hay[i - 1] === ' ' ? 2 : 1; }
  return s;
}
function standardMahlzeit(){
  const d = new Date(), m = d.getHours() * 60 + d.getMinutes();
  if (m < 10 * 60 + 30) return 'Breakfast';
  if (m < 14 * 60 + 30) return 'Lunch';
  if (m < 17 * 60 + 30) return 'Snacks';
  if (m < 21 * 60 + 30) return 'Dinner';
  return 'Snacks';
}

