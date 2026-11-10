/* ================================================================ toast */
const TOAST_IC = { success: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', error: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>' };
function toast(msg, fehler, sub){
  const box = $('#toasts'), type = fehler ? 'error' : 'success';
  const t = h('div', { class: 'toast toast--' + type }, [h('span', { class: 'toast__icon', html: icon(TOAST_IC[type], 14) }), h('div', { class: 'toast__body' }, [msg, sub ? h('small', {}, [sub]) : null])]);
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  let weg = false;
  const geh = () => { if (weg) return; weg = true; document.removeEventListener('pointerdown', geh, true); t.classList.add('is-leaving'); setTimeout(() => t.remove(), 260); };
  setTimeout(geh, fehler ? 5200 : 2600);
  /* taps go through it (CSS); the next tap anywhere also sends it away */
  setTimeout(() => { if (!weg) document.addEventListener('pointerdown', geh, true); }, 0);
}

/* ================================================================ emblem and background: the guilloché of the house icons */
function rosette(cx, cy, rho, amp, k, ph){
  let d = '';
  for (let i = 0; i <= 240; i++){ const a = i / 240 * Math.PI * 2, r = rho + amp * Math.sin(k * a + ph); d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2); }
  return d + 'Z';
}
const FLAMME = 'M50 24c8 10 18.5 18 16.5 35.5C65.3 71 58.4 78 50 78s-15.6-6.6-16.3-16.8c-.7-9.7 5-15.6 8.3-21.6.6 6.6 3.4 10 7 11.2-2.3-8.2-3.3-17.6 1-26.8z';
const FLAMME_INNEN = 'M50.2 49c5.2 6.4 9.4 10.6 7.6 18-1 4.2-4 6.8-7.6 6.8s-6.6-2.4-7.3-6.2c-.8-4.4 1.7-7.6 4-10.2.3 3.6 1.8 5.3 3.6 5.6-1-4.4-1.6-9.2-.3-14z';
/* the emblem in the colours of each look: the kit draws it into [data-icon], the tab icon and the home-screen icon */
const ICON_FARBEN = {
  glass: { b: ['#1B3550', '#0F1D2C', '#080D13'], r: ['#A9CDF3', '#5E8FCB', '#C9DDF5'], f: ['#F4F9FF', '#8DBCEB'], innen: '#2F5E91', mitte: '#0B141D', licht: .22 },
  ember: { b: ['#2B130C', '#170A07', '#0C0605'], r: ['#FFB347', '#E8401A', '#FFC24A'], f: ['#FFE08A', '#FF5A1F'], innen: '#8A1E08', mitte: '#120806', licht: .14 },
  prism: { b: ['#FFFFFF', '#F1EFFA', '#E4E1F6'], r: ['#5B48F5', '#16B2E3', '#FF5C8A'], f: ['#6E56FF', '#16B2E3'], innen: '#FFFFFF', mitte: '#FFFFFF', licht: .5 }
};
function appIcon(theme, g){ return ICONS.cico(g).replace('<svg ', '<svg width="100%" height="100%" '); }

/* ================================================================ numbers that count up, rings that draw in */
/* ================================================================ KPI lines (Design Lab KPI card)
   The line is drawn in real pixels so the travelling light stays round. When it appears, a point of light runs along it
   and draws the line behind it with a short tail (length, colour, speed: the theme's --spark-* tokens). Effects listen
   to 'dl:spark' (start / end / rest). */
let KPI_ZULETZT = '';
/* the period before the one on show: the month before, or the same months of the year before */
function vorperiode(){
  const ytd = S.modus === 'ytd';
  let y = S.jahr, m = S.monat;
  if (ytd) y -= 1; else if (--m < 0){ m = 11; y -= 1; }
  const von = ytd ? y + '-01-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01';
  const bis = ISO(add(new Date(Date.UTC(y, m + 1, 1)), -1));
  return { a: agg({ von, bis }), label: ytd ? String(y) : MSHORT[m] };
}
/* the lines for the tiles: daily values (Month) or weekly averages (YTD); the counts as running totals; maintenance as estimated */
function kpiLinien(a){
  const ytd = S.modus === 'ytd', bisher = a.tage.filter(t => !t.zukunft);
  let nT = 0, nZ = 0;
  const lauf = bisher.map(t => { if (t.geloggt){ nT++; if (t.z.kcal && Math.abs(t.s.kcal - t.z.kcal) <= t.z.kcal * .1) nZ++; } return { t, nT, nZ }; });
  const wo = [];
  lauf.forEach(x => {
    const mo = ISO(monday(P(x.t.iso))); let w = wo[wo.length - 1];
    if (!w || w.mo !== mo){ w = { mo, kcal: 0, p: 0, n: 0, nT: 0, nZ: 0 }; wo.push(w); }
    if (x.t.geloggt){ w.kcal += x.t.s.kcal; w.p += x.t.s.p; w.n++; }
    w.nT = x.nT; w.nZ = x.nZ;
  });
  const geloggt = bisher.filter(t => t.geloggt), mitN = wo.filter(w => w.n);
  /* maintenance: the estimate as it stood on each day (Month) or at the end of each week (YTD), where there is one */
  const tageBisGestern = bisher.filter(t => t.iso < TODAY).map(t => t.iso);
  const erhTage = ytd ? tageBisGestern.filter((iso, i, l) => i === l.length - 1 || ISO(monday(P(l[i + 1]))) !== ISO(monday(P(iso)))) : tageBisGestern;
  const erh = erhTage.map(iso => erhaltung(iso).kcal).filter(x => x !== undefined);
  return ytd ? { kcal: mitN.map(w => w.kcal / w.n), p: mitN.map(w => w.p / w.n), tage: wo.map(w => w.nT), ziel: wo.map(w => w.nZ), kg: gewichtWochen(a.gewichte).map(w => w.kg), erh }
             : { kcal: geloggt.map(t => t.s.kcal), p: geloggt.map(t => t.s.p), tage: lauf.map(x => x.nT), ziel: lauf.map(x => x.nZ), kg: a.gewichte.map(x => x.kg), erh };
}
/* weigh-ins as weekly averages (YTD): [{ mo, kg }] */
function gewichtWochen(liste){
  const w = [];
  liste.forEach(x => { const mo = ISO(monday(P(x.iso))); let y = w[w.length - 1]; if (!y || y.mo !== mo){ y = { mo, s: 0, n: 0 }; w.push(y); } y.s += x.kg; y.n++; });
  return w.map(y => ({ mo: y.mo, kg: y.s / y.n }));
}
function kpiGlatt(pts){
  let d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (let i = 1; i < pts.length; i++){ const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2; d += 'C' + mx.toFixed(1) + ',' + a[1].toFixed(1) + ' ' + mx.toFixed(1) + ',' + b[1].toFixed(1) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1); }
  return d;
}
function kpiSignal(svg, phase){ try { svg.dispatchEvent(new CustomEvent('dl:spark', { bubbles: true, detail: { phase } })); } catch (e){} }
function kpiSpark(svg, data, lauf, delay){
  const W = Math.max(40, Math.round(svg.getBoundingClientRect().width || 160)), H = 34, px = 4, py = 5;
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.innerHTML = '<path class="spark__glow"/><path class="spark__line"/><path class="spark__trail t1"/><path class="spark__trail t2"/><path class="spark__trail t3"/><circle class="spark__head" r="2.6"/>';
  let d = '';
  if (data.length > 1){
    const lo = Math.min.apply(null, data), hi = Math.max.apply(null, data), r = hi - lo || 1;
    d = kpiGlatt(data.map((v, i) => [px + i / (data.length - 1) * (W - 2 * px), H - py - (v - lo) / r * (H - 2 * py)]));
  }
  svg.querySelectorAll('.spark__glow, .spark__line, .spark__trail').forEach(p => p.setAttribute('d', d));
  const line = svg.querySelector('.spark__line'), total = d && line.getTotalLength ? line.getTotalLength() : 0;
  if (!lauf || !total){ svg.classList.add('is-done'); kpiSignal(svg, 'rest'); return; }
  const dur = Number(Kit.tok('--spark-dur')) || 1100, tl = Number(Kit.tok('--spark-trail-len')) || .25, glow = svg.querySelector('.spark__glow'), head = svg.querySelector('.spark__head');
  const trails = [['.t1', 1], ['.t2', .5], ['.t3', .2]].map(([c, f]) => [svg.querySelector(c), Math.max(4, tl * f * total)]);
  [line, glow].forEach(p => { p.style.strokeDasharray = total + ' ' + total; p.style.strokeDashoffset = total; });
  trails.forEach(([p]) => { p.style.strokeDasharray = '0 ' + total * 2; });
  head.setAttribute('transform', 'translate(-20 -20)');
  svg.classList.add('is-running'); kpiSignal(svg, 'start');
  const t0 = performance.now() + delay, ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  (function schritt(now){
    if (!svg.isConnected) return;
    const x = Math.max(0, Math.min(1, (now - t0) / dur)), dd = ease(x) * total;
    line.style.strokeDashoffset = total - dd; glow.style.strokeDashoffset = total - dd;
    trails.forEach(([p, L]) => { const l = Math.min(L, dd); p.style.strokeDasharray = l + ' ' + total * 2; p.style.strokeDashoffset = -(dd - l); });
    if (x > 0){ const pt = line.getPointAtLength(dd); head.setAttribute('transform', 'translate(' + pt.x.toFixed(2) + ' ' + pt.y.toFixed(2) + ')'); }
    if (x < 1) requestAnimationFrame(schritt);
    else { line.style.strokeDasharray = ''; line.style.strokeDashoffset = ''; svg.classList.remove('is-running'); svg.classList.add('is-done'); kpiSignal(svg, 'end'); }
  })(performance.now());
}
function zaehle(el, ziel, fmt){
  fmt = fmt || tsd;
  if (!BEWEGUNG || RUHIG || !isFinite(ziel) || Math.abs(ziel) < 1){ el.textContent = fmt(ziel); el.dataset.wert = ziel; return; }
  const start = Number(el.dataset.wert || 0);
  el.dataset.wert = ziel;
  const fertig = () => el.dispatchEvent(new CustomEvent('dl:number', { bubbles: true }));
  if (window.Kit && Kit.numberReveal(el, start, ziel, fmt, fertig)) return;
  const t0 = performance.now(), dauer = 900;
  const schritt = t => { const x = Math.min(1, (t - t0) / dauer), e = 1 - Math.pow(1 - x, 3); el.textContent = fmt(start + (ziel - start) * e); if (x < 1) requestAnimationFrame(schritt); else { el.textContent = fmt(ziel); fertig(); } };
  requestAnimationFrame(schritt);
}
let ringN = 0;
/* rings: [{ frac, breite, farbe: [from, to] }] from outside in; past 100 % a second lap runs on top in ice blue */
function ringeSVG(groesse, rings){
  const g = 'rg' + (++ringN), mitte = groesse / 2;
  ueberStufen();
  let defs = '', inhalt = '', r = mitte;
  rings.forEach((x, i) => {
    r -= x.breite / 2 + (i ? 3 : 1);
    const C = 2 * Math.PI * r, f1 = Math.max(0, Math.min(1, x.frac || 0)), f2 = Math.max(0, Math.min(1, (x.frac || 0) - 1));
    const v1 = Math.max(0, Math.min(1, x.von || 0)), v2 = Math.max(0, Math.min(1, (x.von || 0) - 1)), ex = x.extra ? ' data-extra="' + x.extra + '"' : '';
    defs += '<linearGradient id="' + g + i + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:' + x.farbe[0] + '"/><stop offset="1" style="stop-color:' + x.farbe[1] + '"/></linearGradient>';
    inhalt += '<circle class="ringbahn" cx="' + mitte + '" cy="' + mitte + '" r="' + r.toFixed(2) + '" stroke-width="' + x.breite + '"/>';
    inhalt += '<circle class="ringwert"' + ex + ' data-ziel="' + (C * (1 - f1)).toFixed(2) + '" cx="' + mitte + '" cy="' + mitte + '" r="' + r.toFixed(2) + '" stroke="url(#' + g + i + ')" stroke-width="' + x.breite + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (BEWEGUNG && !RUHIG ? C * (1 - v1) : C * (1 - f1)).toFixed(2) + '"' + (f1 ? '' : ' opacity="0"') + '/>';
    if (f2 > 0 && x.warn) inhalt += ueberBogen(mitte, r, x.breite, f2, v2, x.extra || 0);
    else if (f2 > 0) inhalt += '<circle class="ringwert"' + ex + ' data-ziel="' + (C * (1 - f2)).toFixed(2) + '" cx="' + mitte + '" cy="' + mitte + '" r="' + r.toFixed(2) + '" style="stroke:var(--ring-lap)" stroke-opacity=".9" stroke-width="' + (x.breite * .62).toFixed(1) + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (BEWEGUNG && !RUHIG ? C * (1 - v2) : C * (1 - f2)).toFixed(2) + '"/>';
    r -= x.breite / 2;
  });
  return '<svg viewBox="0 0 ' + groesse + ' ' + groesse + '"><defs>' + defs + '</defs>' + inhalt + '</svg>';
}
/* kcal over budget: the second lap shades from the ring's blue into a muted amber (10 % over) and red (20 % over).
   The colour follows the position on the lap, so the tip always shows how far over the day is. Drawn as short
   pieces that fade in one after the other, which reads as the lap drawing on after the first one. */
/* the three steps come from the theme (--over-1/2/3), read when a ring is drawn */
let UEBER = [[0, [153, 190, 232]], [.10, [201, 154, 78]], [.20, [191, 98, 89]]];
function ueberStufen(){ try { UEBER = [[0, Kit.rgb(Kit.tok('--over-1'))], [.10, Kit.rgb(Kit.tok('--over-2'))], [.20, Kit.rgb(Kit.tok('--over-3'))]]; } catch (e){} }
function ueberFarbe(t){
  if (t >= UEBER[UEBER.length - 1][0]) return UEBER[UEBER.length - 1][1];
  for (let i = 1; i < UEBER.length; i++) if (t <= UEBER[i][0]){
    const [a, ca] = UEBER[i - 1], [b, cb] = UEBER[i], q = (t - a) / (b - a);
    return ca.map((v, j) => Math.round(v + (cb[j] - v) * q));
  }
  return UEBER[0][1];
}
function ueberBogen(mitte, r, breite, f2, v2, extra){
  v2 = v2 || 0; extra = extra || 0;
  const schritt = 2 / 360, n = Math.max(1, Math.ceil(f2 / schritt)), anim = BEWEGUNG && !RUHIG;
  const punkt = t => { const a = t * 2 * Math.PI; return (mitte + r * Math.cos(a)).toFixed(2) + ' ' + (mitte + r * Math.sin(a)).toFixed(2); };
  let s = '';
  for (let i = 0; i < n; i++){
    const t0 = i * schritt, t1 = Math.min(f2, (i + 1) * schritt), letzt = i === n - 1, da = anim && t1 > v2 + 1e-6;
    const c = ueberFarbe((t0 + t1) / 2);
    const ende = letzt ? t1 : Math.min(f2, t1 + .002);            /* a hair of overlap: no seams between the pieces */
    s += '<path class="ueberteil' + (da ? ' los' : '') + '"' + (da ? ' style="animation-delay:' + (extra + (v2 > 0 ? .5 : 1.05) + 0.9 * (Math.max(0, t0 - v2) / Math.max(f2 - v2, .25))).toFixed(3) + 's"' : '') +
      ' d="M' + punkt(t0) + ' A' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 0 1 ' + punkt(Math.max(ende, t0 + .0005)) + '"' +
      ' stroke="rgb(' + c.join(',') + ')" stroke-width="' + breite + '" stroke-linecap="' + (letzt || i === 0 ? 'round' : 'butt') + '"/>';
  }
  return s;
}
function ringeLos(root){
  if (!BEWEGUNG || RUHIG) return;
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.ringwert', root).forEach((c, i) => { c.style.transitionDelay = ((Number(c.dataset.extra) || 0) + i * .12) + 's'; c.style.strokeDashoffset = c.dataset.ziel; })));
}

/* ================================================================ sheets: slide up on the phone, centred on a computer */
function blatt(titel, sub, body, opt){
  opt = opt || {};
  lichtRuht();
  const hg = h('div', { class: 'hg' });
  const zuBtn = h('button', { class: 'kreis', type: 'button', 'aria-label': 'Close', html: icon(IC.zu, 16) });
  const box = h('div', { class: 'blatt', role: 'dialog', 'aria-modal': 'true', 'aria-label': titel }, [
    h('div', { class: 'griff' }),
    h('div', { class: 'bkopf' }, [h('div', {}, [h('h2', {}, [titel]), sub ? h('p', {}, [sub]) : null]), zuBtn]),
    body
  ]);
  hg.appendChild(box); $('#dlgroot').appendChild(hg);
  document.dispatchEvent(new CustomEvent('dl:overlay', { detail: { open: true } }));
  let offen = true;
  function zu(){
    if (!offen) return; offen = false;
    document.removeEventListener('keydown', taste);
    document.dispatchEvent(new CustomEvent('dl:overlay', { detail: { open: false } }));
    if (opt.beimSchliessen) opt.beimSchliessen();
    if (!BEWEGUNG){ hg.remove(); return; }
    hg.classList.add('zu'); setTimeout(() => hg.remove(), 220);
  }
  function taste(e){ if (e.key === 'Escape') zu(); }
  zuBtn.onclick = zu;
  hg.addEventListener('click', e => { if (e.target === hg) zu(); });
  document.addEventListener('keydown', taste);
  if (opt.fokus) setTimeout(() => { const f = box.querySelector(opt.fokus); if (f){ f.focus(); if (f.select) f.select(); } }, TOUCH ? 350 : 60);
  return { zu, box };
}
function bestaetigen(o){
  const body = h('div', {}, [
    o.text ? h('p', { style: { margin: '0 0 6px', color: 'var(--t2)' } }, [o.text]) : null,
    h('div', { class: 'aktion' }, [
      h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => { d.zu(); if (o.beiNein) o.beiNein(); } }, [o.nein || 'Cancel']),
      h('button', { class: o.gefahr ? 'btn btn--danger' : 'btn btn--primary', type: 'button', onclick: () => { d.zu(); o.ja(); } }, [o.jaText])
    ])
  ]);
  const d = blatt(o.titel, o.sub, body);
}
function segment(optionen, wert, beiWahl){
  /* the shared segmented control: equal cells, the thumb only moves with translateX (--i of --n) */
  const s = h('div', { class: 'segmented', role: 'radiogroup' }), thumb = h('span', { class: 'segmented__thumb' }, [h('i')]);
  s.appendChild(thumb); s.style.setProperty('--n', optionen.length);
  const setI = i => s.style.setProperty('--i', i);
  setI(Math.max(0, optionen.findIndex(o => o[0] === wert)));
  const knoepfe = optionen.map(([id, t]) => h('button', { type: 'button', role: 'radio', class: id === wert ? 'is-active' : '', 'aria-checked': id === wert ? 'true' : 'false' }, [t]));
  knoepfe.forEach((k, i) => {
    k.onclick = () => {
      knoepfe.forEach(x => { x.classList.toggle('is-active', x === k); x.setAttribute('aria-checked', x === k ? 'true' : 'false'); });
      setI(i); s.dispatchEvent(new CustomEvent('dl:seg', { bubbles: true })); beiWahl(optionen[i][0]);
    };
    s.appendChild(k);
  });
  return s;
}

/* ================================================================ start screen */
function zeigeStart(){
  $('#shell').hidden = true; $('#start').classList.add('on'); pegel();
  const look = $('#startLook');
  if (look && !look._seg){ const sw = Kit.themeSwitch(); look._seg = sw; look.appendChild(sw.el); document.addEventListener('dl:theme', sw.sync); }
  const wahl = $('#wahl'); wahl.innerHTML = '';
  const knopf = (ic, b, s, fn) => h('button', { type: 'button', class: 'glas', onclick: fn }, [h('span', { class: 'ic', html: icon(ic, 20) }), h('span', {}, [h('b', {}, [b]), h('small', {}, [s])])]);
  const lokal = lokalLesen();
  if (lokal){
    const nF = Object.keys(lokal.data.foods || {}).length, tage = Object.keys(lokal.data.days || {}).sort();
    wahl.appendChild(knopf(IC.weiter, 'Continue', plural(nF, 'food') + (tage.length ? ', last entry ' + tagKurz(tage[tage.length - 1]) : '') +
      (lokal.dirty ? '. Not yet saved to a file.' : (lokal.name ? '. Same as ' + lokal.name + '.' : '')), () => weiter(lokal)));
  }
  wahl.appendChild(knopf(IC.ordner, 'Open your data file', 'The .json you saved before, from Files or OneDrive.', () => {
    if (lokal && lokal.dirty) bestaetigen({ titel: 'Replace the copy on this device?', text: 'This device holds changes that are not in a file yet. Opening a file replaces them.', gefahr: true, jaText: 'Open file', ja: oeffnen });
    else oeffnen();
  }));
  wahl.appendChild(knopf(IC.neu, 'Start fresh', 'An empty log. Set your targets, then scan your first food.', () => {
    if (lokal) bestaetigen({ titel: 'Start with an empty log?', text: 'The copy on this device (' + plural(Object.keys(lokal.data.foods || {}).length, 'food') + ') is replaced. Your saved files are not touched.', gefahr: true, jaText: 'Start fresh', ja: neuAnfangen });
    else neuAnfangen();
  }));
  $('#startfuss').textContent = 'Works without internet. Nothing is looked up online, every value comes from you.';
}
function starteApp(){
  $('#start').classList.remove('on'); $('#shell').hidden = false;
  $('#dateiname').textContent = FILE.name || 'Not saved to a file yet';
  baueTabs(); malSichern();
  if (S.tab === 'entry' && !S.tagGewaehlt) S.tag = TODAY;
  zeigeTab(S.tab, true);
}
const TABS = [
  { id: 'overview', t: 'Overview', i: IC.ring },
  { id: 'entry', t: 'Entry', i: IC.plus },
  { id: 'foods', t: 'Foods', i: IC.korb }
];
/* pages: one round button at the bottom right (phone and computer). A tap opens the three pages above it along the
   right edge, and they stay until a page, the button or anything else is tapped. Press and slide (finger, or the held
   mouse button): the pages open at once, the one under the pointer lights up, letting go on it opens that page. */
function menue(auf){
  const nav = $('#tabs'); nav.classList.toggle('offen', auf);
  $('#seitenknopf').setAttribute('aria-expanded', auf ? 'true' : 'false');
  $('#seitenliste').inert = !auf;
}
function seitenGeste(nav, knopf){
  let aktiv = false, x0 = 0, y0 = 0, gezogen = false, warOffen = false, heiss = null;
  const unter = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest ? el.closest('#seitenliste .swahl') : null; };
  const markiere = b => { if (heiss === b) return; if (heiss) heiss.classList.remove('is-hot'); heiss = b; if (b) b.classList.add('is-hot'); };
  knopf.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    aktiv = true; gezogen = false; warOffen = nav.classList.contains('offen'); x0 = e.clientX; y0 = e.clientY;
    try { knopf.setPointerCapture(e.pointerId); } catch (_){}
    if (!warOffen) menue(true);
  });
  knopf.addEventListener('pointermove', e => {
    if (!aktiv) return;
    if (!gezogen && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) gezogen = true;
    if (gezogen) markiere(unter(e));
  });
  const ende = (e, abbruch) => {
    if (!aktiv) return; aktiv = false;
    const ziel = abbruch ? null : unter(e); markiere(null);
    if (ziel){ menue(false); zeigeTab(ziel.dataset.tab); return; }
    if (!gezogen){ if (warOffen) menue(false); return; }            /* a tap: opened (and stays), or closes */
    const el = document.elementFromPoint(e.clientX, e.clientY);    /* slid off: back on the button keeps it open */
    if (abbruch || !(el && knopf.contains(el))) menue(false);
  };
  knopf.addEventListener('pointerup', e => ende(e));
  knopf.addEventListener('pointercancel', e => ende(e, true));
  knopf.addEventListener('click', e => { if (e.detail === 0) menue(!nav.classList.contains('offen')); });   /* keyboard */
  $('.seitenwahl__schleier', nav).addEventListener('pointerdown', e => { e.preventDefault(); menue(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('offen')){ menue(false); knopf.focus(); } });
}
function baueTabs(){
  const nav = $('#tabs'), liste = $('#seitenliste'), knopf = $('#seitenknopf');
  liste.innerHTML = '';
  TABS.forEach((s, i) => {
    const b = h('button', { type: 'button', class: 'swahl', 'data-tab': s.id, html: '<span>' + s.t + '</span><i>' + icon(s.i, 21) + '</i>', onclick: () => { menue(false); zeigeTab(s.id); } });
    b.style.setProperty('--j', TABS.length - 1 - i);               /* the one nearest the button comes first */
    liste.appendChild(b);
  });
  if (!nav._an){ nav._an = true; seitenGeste(nav, knopf); }
  menue(false);
  $('#sichern').onclick = () => speichern();
  $('#einstellungen').onclick = () => zieleDialog();
  /* the look: one button in the top row, next to the settings */
  if (!$('#look')){ const lb = Kit.lookButton(); lb.id = 'look'; $('#einstellungen').parentNode.insertBefore(lb, $('#einstellungen')); }
  const o = $('#ordner'); o.hidden = !Kit.folder.can; o.onclick = ordnerDialog;
}
/* Glass's drifting light holds still for a moment while a page, a day or a sheet is built (Design Lab Kit.rest()) */
function lichtRuht(){ if (window.Kit && Kit.rest) Kit.rest(); }
function zeigeTab(id, erst){
  lichtRuht();
  const vorher = S.tab; S.tab = id;
  const nav = $('#tabs'), i = Math.max(0, TABS.findIndex(t => t.id === id));
  $$('.swahl', nav).forEach(b => { const on = b.dataset.tab === id; b.classList.toggle('is-active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  /* the button shows the page you are on; open, it turns into a cross */
  $('#seitenknopf').innerHTML = '<span class="jetzt">' + icon(TABS[i].i, 24) + '</span><span class="zu">' + icon(IC.zu, 22) + '</span>';
  $('#seitenknopf').setAttribute('aria-label', 'Pages, now ' + TABS[i].t);
  $$('.seite').forEach(s => s.classList.toggle('on', s.id === 'p-' + id));
  if (!erst && vorher !== id) nav.dispatchEvent(new CustomEvent('dl:tab', { detail: i }));
  malSeite();
  if (!erst) window.scrollTo(0, 0);
}
function malSeite(){
  if (S.tab === 'overview') seiteOverview();
  else if (S.tab === 'entry') seiteEntry();
  else seiteFoods();
}

/* ================================================================ targets and phases */
/* one phase: kcal, and a bar split into protein, carbs and fat with two handles. The grams follow from the split,
   so protein x 4 + carbs x 4 + fat x 9 is always the kcal target. Typing grams works too: protein keeps carbs and
   fat in proportion, carbs give way to fat and fat to carbs. A new kcal keeps the protein grams and rescales the rest. */
function zielBlock(phase, z){
  const st = { kcal: z.kcal, s: splitVon(z) };
  const M = [{ k: 'p', name: 'Protein', farbe: 'var(--prot)', proG: 4 }, { k: 'c', name: 'Carbs', farbe: 'var(--carb)', proG: 4 }, { k: 'f', name: 'Fat', farbe: 'var(--fett)', proG: 9 }];
  const kcalIn = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'kcal per day', value: st.kcal == null ? '' : String(st.kcal), 'aria-label': phase.name + ' energy target' });
  const teile = M.map(m => h('i', { style: { background: m.farbe } }, [h('span')]));
  const griffe = [0, 1].map(i => h('button', { type: 'button', class: 'griffknopf', role: 'slider', 'aria-label': i ? 'Carbs and fat' : 'Protein and carbs', 'aria-valuemin': '0', 'aria-valuemax': '100' }));
  const balken = h('div', { class: 'teiler' }, teile.concat(griffe));
  const zeilen = M.map(m => {
    const inp = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': phase.name + ' ' + m.name + ' in grams' });
    const pct = h('small'), kc = h('small');
    inp.addEventListener('input', () => tippe(m, inp));
    return { m, inp, pct, kc, el: h('div', { class: 'mzeile2' }, [h('span', { class: 'nm' }, [h('i', { style: { background: m.farbe } }), m.name]),
      h('div', { class: 'mit' }, [inp, h('em', {}, ['g'])]), h('div', { class: 'rechts' }, [pct, kc])]) };
  });
  const summe = h('p', { class: 'summenzeile' });
  const block = h('div', { class: 'zielblock' }, [h('h4', {}, [h('i'), phase.name]),
    h('label', { class: 'feld' }, [h('span', {}, ['Energy']), h('div', { class: 'mit' }, [kcalIn, h('em', {}, ['kcal'])])]),
    balken, h('div', { class: 'mzeilen' }, zeilen.map(x => x.el)), summe]);

  function gramm(){ return grammVon(st.kcal, st.s); }
  function mal(ausser){
    const aus = !st.kcal, g = gramm();
    block.classList.toggle('aus', aus);
    M.forEach((m, i) => {
      teile[i].style.width = st.s[m.k] + '%';
      teile[i].firstChild.textContent = st.s[m.k] >= 9 ? Math.round(st.s[m.k]) + ' %' : '';
      const z = zeilen[i], gw = g[{ p: 'protein', c: 'carbs', f: 'fat' }[m.k]];
      if (z.inp !== ausser) z.inp.value = aus ? '' : String(Math.round(gw));
      z.inp.disabled = aus;
      z.pct.textContent = Math.round(st.s[m.k]) + ' %';
      z.kc.textContent = aus ? '' : tsd(gw * m.proG) + ' kcal';
    });
    griffe[0].style.left = st.s.p + '%'; griffe[1].style.left = (st.s.p + st.s.c) + '%';
    griffe[0].setAttribute('aria-valuenow', Math.round(st.s.p)); griffe[1].setAttribute('aria-valuenow', Math.round(st.s.p + st.s.c));
    griffe[0].setAttribute('aria-valuetext', 'Protein ' + Math.round(st.s.p) + ' %, carbs ' + Math.round(st.s.c) + ' %');
    griffe[1].setAttribute('aria-valuetext', 'Carbs ' + Math.round(st.s.c) + ' %, fat ' + Math.round(st.s.f) + ' %');
    griffe.forEach(b => { b.disabled = aus; });
    summe.textContent = aus ? 'Type the kcal first; the split then turns into grams.'
      : g1(g.protein) + ' g \u00d7 4 + ' + g1(g.carbs) + ' g \u00d7 4 + ' + g1(g.fat) + ' g \u00d7 9 = ' + tsd(g.protein * 4 + g.carbs * 4 + g.fat * 9) + ' kcal';
  }
  const fest = x => Math.max(0, Math.min(100, x));
  function setze(p, c){ p = r2(fest(p)); c = r2(fest(Math.min(c, 100 - p))); st.s = { p, c, f: r2(100 - p - c) }; }
  function tippe(m, inp){
    const g = zahlLesen(inp.value); if (g === null || !st.kcal) return;
    const anteil = g * m.proG / st.kcal * 100, s0 = st.s;
    if (m.k === 'p'){ const p = fest(anteil), rest = 100 - p, cf = s0.c + s0.f; setze(p, cf > 0 ? rest * s0.c / cf : rest * .5); }
    else if (m.k === 'c') setze(s0.p, Math.min(anteil, 100 - s0.p));
    else setze(s0.p, 100 - s0.p - fest(Math.min(anteil, 100 - s0.p)));
    mal(inp);
  }
  kcalIn.addEventListener('input', () => {
    const alt = st.kcal, altP = alt ? grammVon(alt, st.s).protein : null;
    st.kcal = zahlLesen(kcalIn.value); if (st.kcal !== null && (st.kcal < 1 || st.kcal > 20000)) st.kcal = null;
    if (st.kcal && altP){ const p = fest(altP * 4 / st.kcal * 100), rest = 100 - p, cf = st.s.c + st.s.f; setze(p, cf > 0 ? rest * st.s.c / cf : rest * .5); }
    mal();
  });
  /* dragging: snaps to whole percent */
  let zieht = -1;
  const ausX = e => { const r = balken.getBoundingClientRect(); return Math.round(fest((e.clientX - r.left) / r.width * 100)); };
  const zu = (i, x) => { if (i === 0) setze(Math.min(x, st.s.p + st.s.c), st.s.p + st.s.c - Math.min(x, st.s.p + st.s.c)); else setze(st.s.p, Math.max(x, st.s.p) - st.s.p); mal(); };
  griffe.forEach((b, i) => {
    b.addEventListener('pointerdown', e => { if (b.disabled) return; e.preventDefault(); zieht = i; balken.classList.add('zieht'); b.setPointerCapture && b.setPointerCapture(e.pointerId); });
    b.addEventListener('pointermove', e => { if (zieht === i) zu(i, ausX(e)); });
    const los = () => { if (zieht === i){ zieht = -1; balken.classList.remove('zieht'); } };
    b.addEventListener('pointerup', los); b.addEventListener('pointercancel', los);
    b.addEventListener('keydown', e => {
      const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 }[e.key]; if (!d) return;
      e.preventDefault(); zu(i, Math.round(i ? st.s.p + st.s.c : st.s.p) + d);
    });
  });
  mal();
  return { el: block, wert: () => st.kcal ? Object.assign({ kcal: st.kcal, split: Object.assign({}, st.s) }, gramm()) : { kcal: null, protein: null, carbs: null, fat: null, split: Object.assign({}, st.s) } };
}
function zieleDialog(erstmal){
  const c = DATA.config;
  const name = h('input', { type: 'text', value: c.name || '', placeholder: 'Shown nowhere but here', autocomplete: 'name' });
  const bloecke = PHASES.map(p => ({ id: p.id, b: zielBlock(p, c.targets[p.id]) }));
  const body = h('div', {}, [
    erstmal ? h('p', { class: 'hinweis' }, ['One target per phase. Pick the phase of a day on Entry, for that day only or from that day on.']) : null,
    h('div', { class: 'zieltab' }, bloecke.map(x => x.b.el)),
    h('label', { class: 'feld', style: { marginTop: '12px' } }, [h('span', {}, ['Your name']), name]),
    h('div', { class: 'aktion' }, [
      FILE.name || S.dirty ? h('button', { type: 'button', class: 'btn btn--ghost links', onclick: () => { d.zu(); speichern(true); } }, ['Save a dated copy']) : null,
      h('button', { type: 'button', class: 'btn btn--primary', onclick: () => {
        bloecke.forEach(x => { c.targets[x.id] = x.b.wert(); }); c.name = name.value.trim();
        d.zu(); aendern(); malSeite(); toast('Targets updated');
      } }, ['Save targets'])
    ]),
    h('p', { class: 'build' }, ['CICO \u00b7 build ' + BUILD])
  ]);
  const d = blatt(erstmal ? 'Set your targets' : 'Targets', 'Drag the handles to split the kcal into protein, carbs and fat, or type the grams.', body);
}
function phaseDialog(iso, fertig){
  const jetzt = phaseVon(iso), eigen = tag(iso) && tag(iso).phase;
  let gewaehlt = jetzt;
  const liste = h('div', { class: 'wahlliste' }, PHASES.map(p => {
    const z = DATA.config.targets[p.id];
    const b = h('button', { type: 'button', class: p.id === jetzt ? 'on' : '', onclick: () => { gewaehlt = p.id; $$('button', liste).forEach(x => x.classList.toggle('on', x === b)); } },
      [h('span', {}, [h('b', {}, [p.name]), h('small', {}, [z.kcal ? tsd(z.kcal) + ' kcal' + (z.protein ? ', ' + tsd(z.protein) + ' g protein' : '') : 'No target set'])])]);
    return b;
  }));
  const setzeTag = () => { const t = DATA.days[iso] || (DATA.days[iso] = { items: [] }); t.phase = gewaehlt; };
  const body = h('div', {}, [liste, h('div', { class: 'aktion' }, [
    h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => { setzeTag(); d.zu(); aendern(); fertig(); toast(PHASE[gewaehlt].name + ' for ' + tagKurz(iso)); } }, ['This day only']),
    h('button', { type: 'button', class: 'btn btn--primary', onclick: () => {
      const pf = DATA.config.phaseFrom.filter(x => x.from !== iso); pf.push({ from: iso, phase: gewaehlt }); pf.sort((a, b) => a.from < b.from ? -1 : 1);
      DATA.config.phaseFrom = pf;
      /* days after this one that only had the old override for the same phase keep theirs: their choice was explicit */
      if (DATA.days[iso]){ delete DATA.days[iso].phase; if (!DATA.days[iso].items.length) delete DATA.days[iso]; }
      d.zu(); aendern(); fertig(); toast(PHASE[gewaehlt].name + ' from ' + tagKurz(iso) + ' on');
    } }, ['From this day on'])
  ])]);
  const d = blatt('Phase', tagLang(iso) + (eigen ? '. Set for this day only.' : ''), body);
}

