/* ================================================================ Entry */
let neuId = null;   /* the item(s) just logged, highlighted once: one id, or a list after copying a meal */
const istNeu = id => neuId !== null && [].concat(neuId).indexOf(id) >= 0;
function postenLoeschen(iso, it){
  const t = DATA.days[iso]; if (!t) return;
  t.items = t.items.filter(x => x.id !== it.id);
  if (!t.items.length && !t.phase) delete DATA.days[iso];
  aendern(); malSeite(); toast('Removed ' + it.name, false, tagKurz(iso));
}

/* swipe a logged entry to the left: a red Delete appears on the right. Vertical scrolling stays with the browser
   (touch-action: pan-y), only a clearly sideways drag moves the row. One row open at a time; a tap anywhere else closes it. */
const WISCH = 84;
let offenWisch = null;
function wischZu(){ if (offenWisch){ offenWisch.spur.style.transform = ''; offenWisch = null; } }
document.addEventListener('pointerdown', e => { if (offenWisch && !offenWisch.box.contains(e.target)) wischZu(); }, true);
function wischZeile(zeile, oeffnen, weg){
  const loesch = h('button', { type: 'button', class: 'loesch', 'aria-label': 'Delete', html: icon(IC.eimer, 18) + '<span>Delete</span>' });
  const spur = h('div', { class: 'wischspur' }, [zeile, loesch]);
  const box = h('div', { class: 'wisch' }, [spur]);
  const ich = { box, spur };
  let x0 = 0, y0 = 0, basis = 0, pos = 0, richtung = null, aktiv = false, geschoben = false;
  const setze = x => { pos = x; spur.style.transform = 'translateX(' + x + 'px)'; };
  zeile.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    aktiv = true; richtung = null; geschoben = false;
    x0 = e.clientX; y0 = e.clientY; basis = offenWisch === ich ? -WISCH : 0; pos = basis;
  });
  zeile.addEventListener('pointermove', e => {
    if (!aktiv) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!richtung){
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      richtung = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (richtung === 'y'){ aktiv = false; return; }
      if (offenWisch && offenWisch !== ich) wischZu();
      spur.classList.add('zieht'); geschoben = true;
      try { zeile.setPointerCapture(e.pointerId); } catch (_){}
    }
    let x = basis + dx;
    if (x > 0) x = x * .25;                                  /* a little give either way */
    if (x < -WISCH) x = -WISCH + (x + WISCH) * .3;
    setze(x);
  });
  const ende = () => {
    if (!aktiv) return; aktiv = false;
    if (!geschoben) return;
    spur.classList.remove('zieht');
    if (pos < -WISCH / 2){ setze(-WISCH); offenWisch = ich; }
    else { spur.style.transform = ''; if (offenWisch === ich) offenWisch = null; }
  };
  zeile.addEventListener('pointerup', ende);
  zeile.addEventListener('pointercancel', ende);
  /* a swipe is not a tap, and a tap on an open row just closes it */
  zeile.onclick = () => {
    if (geschoben){ geschoben = false; return; }
    if (offenWisch === ich){ wischZu(); return; }
    oeffnen();
  };
  loesch.onclick = () => {
    offenWisch = null;
    if (!BEWEGUNG || RUHIG){ weg(); return; }
    box.style.height = box.offsetHeight + 'px'; void box.offsetHeight;
    box.classList.add('weg'); box.style.height = '0px';
    setTimeout(weg, 300);
  };
  return box;
}
function geheZuTag(iso){ lichtRuht(); S.tag = iso; S.tagGewaehlt = true; periodeFolgt(iso); seiteEntry(); }
/* the Overview period follows the day: swiping into another month moves the month (and year) with it */
function periodeFolgt(iso){
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1;
  if (y !== S.jahr || m !== S.monat){ S.jahr = y; S.monat = m; return true; }
  return false;
}

/* ================================================================ day swipe (Overview and Entry)
   Swipe left for the next day, right for the day before. The page follows the thumb; past a short distance (or with a
   quick flick) it slides out and the new day slides in from the other side. Rows that swipe on their own (delete),
   the quick-pick chips and form fields keep their gestures. On a computer: the arrow keys do the same. */
const SWIPE_AUS = '.wisch, .schnellwahl, input, textarea, select, .segmented, .teiler, .griffknopf, .tabs, button.zeile';
let slideLaeuft = false;
function seiteVon(tab){ return $('#p-' + tab); }
function malTag(){ if (S.tab === 'overview') seiteOverview(); else seiteEntry(); pegel(); }
/* richtung: +1 = the new day comes from the right (later), -1 = from the left (earlier) */
function tagSlide(iso, richtung, startX){
  if (slideLaeuft || !iso) return;
  const el = seiteVon(S.tab); if (!el) return;
  lichtRuht();
  const W = Math.max(320, window.innerWidth), wechsel = () => {
    S.tag = iso; S.tagGewaehlt = true; periodeFolgt(iso);
    malTag();
  };
  if (!BEWEGUNG){ wechsel(); return; }
  slideLaeuft = true;
  el.classList.add('is-sliding'); el.classList.remove('is-settling');
  if (startX !== undefined) el.style.transform = 'translate3d(' + startX + 'px,0,0)';
  void el.offsetWidth;
  el.classList.add('is-leaving');
  el.style.transform = 'translate3d(' + (-richtung * W) + 'px,0,0)';
  let fertig = false;
  const weiter = () => {
    if (fertig) return; fertig = true;
    el.classList.remove('is-leaving');
    wechsel();
    el.style.transform = 'translate3d(' + (richtung * W * .9) + 'px,0,0)';
    void el.offsetWidth;
    el.classList.add('is-settling');
    el.style.transform = 'translate3d(0,0,0)';
    setTimeout(() => { el.classList.remove('is-settling', 'is-sliding'); el.style.transform = ''; slideLaeuft = false; }, 360);
  };
  el.addEventListener('transitionend', function te(e){ if (e.target === el){ el.removeEventListener('transitionend', te); weiter(); } });
  setTimeout(weiter, 260);
}
function tagNachbar(richtung){ return ISO(add(P(S.tag), richtung)); }
(function tagWischen(){
  const main = $('#main'); if (!main) return;
  let x0 = 0, y0 = 0, t0 = 0, dx = 0, achse = null, aktiv = false, el = null, pid = null;
  main.addEventListener('pointerdown', e => {
    achse = null; dx = 0;
    if (slideLaeuft || !DATA || (S.tab !== 'overview' && S.tab !== 'entry')) return;
    if (e.pointerType === 'mouse' || (e.target.closest && e.target.closest(SWIPE_AUS))) return;
    el = seiteVon(S.tab); if (!el || !el.contains(e.target)) return;
    aktiv = true; achse = null; dx = 0; x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); pid = e.pointerId;
  }, { passive: true });
  main.addEventListener('pointermove', e => {
    if (!aktiv || e.pointerId !== pid) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!achse){
      if (Math.abs(mx) < 9 && Math.abs(my) < 9) return;
      achse = Math.abs(mx) > Math.abs(my) * 1.15 ? 'x' : 'y';
      if (achse === 'y'){ aktiv = false; return; }
      el.classList.add('is-sliding'); el.classList.remove('is-settling');
      try { main.setPointerCapture(pid); } catch (_){}
    }
    dx = mx;
    el.style.transform = 'translate3d(' + (dx * .92).toFixed(1) + 'px,0,0)';
  }, { passive: true });
  const ende = e => {
    if (!aktiv || (e && e.pointerId !== pid)) return;
    aktiv = false;
    if (achse !== 'x') return;
    const v = Math.abs(dx) / Math.max(1, performance.now() - t0), weit = Math.abs(dx) > Math.min(96, window.innerWidth * .22);
    if (weit || (v > .45 && Math.abs(dx) > 30)){ const r = dx < 0 ? 1 : -1; tagSlide(tagNachbar(r), r, dx * .92); }
    else {
      el.classList.add('is-settling'); el.style.transform = 'translate3d(0,0,0)';
      setTimeout(() => { if (!slideLaeuft){ el.classList.remove('is-settling', 'is-sliding'); el.style.transform = ''; } }, 360);
    }
  };
  main.addEventListener('pointerup', ende);
  main.addEventListener('pointercancel', e => { if (aktiv && achse === 'x') ende(e); else aktiv = false; });
  /* a sideways swipe is not a tap: swallow the click that may follow it */
  main.addEventListener('click', e => { if (achse === 'x' && Math.abs(dx) > 9){ e.stopPropagation(); e.preventDefault(); achse = null; } }, true);
  /* computers: arrow keys, when no field has the focus */
  document.addEventListener('keydown', e => {
    if (!DATA || (S.tab !== 'overview' && S.tab !== 'entry') || $('.overlay, .hg') || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target; if (t && (t.closest('input, textarea, select, [contenteditable]'))) return;
    if (e.key === 'ArrowRight'){ e.preventDefault(); tagSlide(tagNachbar(1), 1); }
    else if (e.key === 'ArrowLeft'){ e.preventDefault(); tagSlide(tagNachbar(-1), -1); }
  });
})();

function seiteEntry(){
  const root = $('#p-entry'); root.innerHTML = ''; offenWisch = null;
  const iso = S.tag, d = P(iso);

  root.appendChild(h('div', { class: 'tagleiste' }, [
    h('h2', {}, [tagWort(iso), h('small', {}, [tagWort(iso) === DAYLONG[dow(d)] ? d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : tagLang(iso)])]),
    /* arrows jump a week and keep the weekday; Today is always in the same spot, quiet when you are already there */
    h('div', { class: 'tagnav glas' }, [
      h('button', { type: 'button', class: 'kreis', 'aria-label': 'Previous week', html: icon(IC.links, 18), onclick: () => geheZuTag(ISO(add(d, -7))) }),
      h('button', { type: 'button', class: 'heutek', disabled: iso === TODAY ? 'disabled' : null, onclick: () => geheZuTag(TODAY) }, ['Today']),
      h('button', { type: 'button', class: 'kreis', 'aria-label': 'Next week', html: icon(IC.rechts, 18), onclick: () => geheZuTag(ISO(add(d, 7))) })
    ])
  ]));

  /* the week, each day with a small ring */
  const mo = monday(d), woche = h('div', { class: 'woche glas' });
  for (let i = 0; i < 7; i++){
    const t = ISO(add(mo, i)), s = tagSumme(t), z = zielVon(t), frac = z.kcal ? Math.min(1, s.kcal / z.kcal) : (s.n ? 1 : 0), C = 2 * Math.PI * 11;
    woche.appendChild(h('button', { type: 'button', class: (t === iso ? 'on' : '') + (t === TODAY ? ' heute' : ''), 'aria-label': tagLang(t) + (s.n ? ', ' + tsd(s.kcal) + ' kcal' : ''), onclick: () => geheZuTag(t) }, [
      h('span', {}, [DAYNAMES[i]]),
      h('span', { html: '<svg class="mini" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" style="stroke:var(--ring-track)"/>' +
        (frac ? '<circle cx="14" cy="14" r="11" stroke="url(#wg)" stroke-linecap="round" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (C * (1 - frac)).toFixed(2) + '" transform="rotate(-90 14 14)"/>' : '') +
        '<defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--ring-e1)"/><stop offset="1" style="stop-color:var(--ring-e2)"/></linearGradient></defs></svg>' }),
      h('b', {}, [String(add(mo, i).getUTCDate())])
    ]));
  }
  root.appendChild(woche);

  const grid = h('div', { class: 'eingabe' }), links = h('div', { class: 'links', style: { display: 'grid', gap: '14px', gridTemplateColumns: 'minmax(0,1fr)', minWidth: 0 } }), rechts = h('div');
  grid.appendChild(links); grid.appendChild(rechts); root.appendChild(grid);

  /* summary of the day */
  const r = tagesRinge(iso, 104), ph = phaseVon(iso);
  links.appendChild(h('div', { class: 'glas card tagsumme' }, [r.box, h('div', { style: { display: 'grid', gap: '9px', minWidth: 0 } }, [
    makroZeile('Energy', 'var(--energy)', r.s.kcal, r.z.kcal, 'kcal'),
    makroZeile('Protein', 'var(--prot)', r.s.p, r.z.protein, 'g'),
    h('div', { style: { display: 'flex', gap: '12px', fontSize: '12.5px', color: 'var(--t3)', flexWrap: 'wrap' } }, [
      h('span', {}, ['Carbs ' + g1(r.s.c) + ' g']), h('span', {}, ['Fat ' + g1(r.s.f) + ' g'])]),
    h('div', { class: 'pillen' }, [h('button', { type: 'button', class: 'phase', onclick: () => phaseDialog(iso, seiteEntry) }, [h('i'), PHASE[ph].name]), gewichtKnopf(iso, seiteEntry)])
  ])]));

  /* scan and search */
  const ergebnis = h('div');
  const eingabe = h('input', { type: 'search', placeholder: 'Search your foods', value: S.suche, autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Search your foods' });
  eingabe.oninput = () => { S.suche = eingabe.value; malErgebnis(ergebnis); };
  eingabe.onkeydown = e => { if (e.key === 'Enter'){ const erstes = $('.zeile', ergebnis); if (erstes) erstes.click(); } };
  links.appendChild(h('div', { class: 'glas card aktionen' }, [
    /* text search does the daily work; the scanner only matters the first time a pack comes home */
    h('div', { class: 'suchreihe' }, [
      h('label', { class: 'suche' }, [h('span', { html: icon(IC.suche, 18) }), eingabe]),
      h('button', { type: 'button', class: 'scanmini', 'aria-label': 'Scan a barcode', title: 'Scan a barcode', onclick: () => scanStarten('log'), html: icon(IC.scan, 22) })
    ]),
    ergebnis
  ]));
  malErgebnis(ergebnis);

  /* the meals */
  const t = tag(iso), items = t ? t.items : [];
  MEALS.forEach(m => {
    const meine = items.filter(it => it.meal === m), s = summe(meine);
    const karte = h('div', { class: 'glas card mahlzeit' }, [h('div', { class: 'mkopf' }, [h('h3', {}, [m]), h('div', { class: 'mr' }, [
      h('span', {}, [s.n ? tsd(s.kcal) + ' kcal' : '']),
      h('button', { type: 'button', class: 'mplus', 'aria-label': 'Add to ' + m, html: icon(IC.plus, 15) })
    ])])]);
    /* the whole tile opens the meal sheet; the logged rows keep their own tap (edit) and swipe (delete) */
    karte.onclick = e => {
      if (e.target.closest('.wisch')) return;
      if (BEWEGUNG){ karte.classList.add('tipp'); setTimeout(() => karte.classList.remove('tipp'), 160); }
      mahlzeitBlatt(m, iso);
    };
    if (!meine.length) karte.appendChild(h('div', { class: 'mleer' }, ['Nothing yet. Tap to add.']));
    else karte.appendChild(h('div', { class: 'liste' }, meine.map(it => {
      const v = posten(it), food = it.food && DATA.foods[it.food];
      return wischZeile(h('button', { type: 'button', class: 'zeile' + (istNeu(it.id) ? ' neu' : '') }, [
        h('span', { class: 'nm' }, [it.name]),
        h('span', { class: 'sub' }, [g1(it.g) + ' ' + (food && food.unit === 'ml' ? 'ml' : 'g') + (it.brand ? ', ' + it.brand : '') + '  \u00a0P ' + g1(v.p) + '  C ' + g1(v.c) + '  F ' + g1(v.f)]),
        h('span', { class: 'rechts' }, [tsd(v.kcal), h('small', {}, ['kcal'])])
      ]), () => logSheet(food ? Object.assign({ id: it.food }, food) : null, { item: it, iso }), () => postenLoeschen(iso, it));
    })));
    rechts.appendChild(karte);
  });
  neuId = null;
  ringeLos(root); balkenLos(root); pegel();
}

/* search results, or recent and favourite foods when the field is empty */
function malErgebnis(box){
  box.innerHTML = '';
  const q = S.suche.trim(), alle = foodListe(), use = gebrauch();
  const zeile = f => h('button', { type: 'button', class: 'zeile', onclick: () => logSheet(f) }, [
    h('span', { class: 'nm' }, [f.name]),
    h('span', { class: 'sub' }, [(f.brand ? f.brand + ', ' : '') + tsd(f.k) + ' kcal per 100 ' + f.unit]),
    h('span', { class: 'rechts' }, [use[f.id] ? g1(use[f.id].lastG) + ' ' + f.unit : '', h('small', {}, [use[f.id] ? 'last time' : 'new'])])
  ]);
  if (q){
    const t = alle.map(f => ({ f, s: treffer(f, q) })).filter(x => x.s).sort((a, b) => b.s - a.s || ((use[b.f.id] || {}).n || 0) - ((use[a.f.id] || {}).n || 0)).slice(0, 12);
    if (t.length) box.appendChild(h('div', { class: 'liste' }, t.map(x => zeile(x.f))));
    else box.appendChild(h('div', { class: 'mleer', style: { padding: '6px 4px' } }, ['No food called \u201c' + q + '\u201d yet.']));
    box.appendChild(h('button', { type: 'button', class: 'chip chip--filter', style: { marginTop: '8px' }, onclick: () => foodEditor({ name: /^\d{8,14}$/.test(q) ? '' : q, barcode: /^\d{8,14}$/.test(q) ? q : '' }, { danach: 'log' }), html: icon(IC.plus, 15) + '<span>New food' + (/^\d{8,14}$/.test(q) ? ' with this code' : ' \u201c' + esc(q) + '\u201d') + '</span>' }));
    return;
  }
  if (!alle.length){
    box.appendChild(h('div', { class: 'mleer', style: { padding: '4px' } }, ['No foods yet. Scan the first one, or ']));
    box.lastChild.appendChild(h('button', { type: 'button', style: { color: 'var(--blau)', fontWeight: 600 }, onclick: () => foodEditor({}, { danach: 'log' }) }, ['add it by hand']));
    return;
  }
  /* quick picks as a row of chips: favourites first, then the most recent, so the day's meals stay in view */
  const recent = alle.filter(f => use[f.id] && !f.fav).sort((a, b) => use[b.id].last < use[a.id].last ? -1 : (use[b.id].last > use[a.id].last ? 1 : use[b.id].n - use[a.id].n)).slice(0, 10);
  const favs = alle.filter(f => f.fav).sort((a, b) => ((use[b.id] || {}).n || 0) - ((use[a.id] || {}).n || 0));
  const auswahl = favs.concat(recent).slice(0, 14);
  const liste = auswahl.length ? auswahl : alle.slice(0, 10);
  box.appendChild(h('div', { class: 'unterkopf' }, [h('span', {}, [favs.length ? 'Favourites and recent' : 'Recent']), h('button', { type: 'button', onclick: () => zeigeTab('foods') }, ['All foods'])]));
  box.appendChild(h('div', { class: 'schnellwahl' }, liste.map(f => h('button', { type: 'button', class: 'chip chip--filter' + (f.fav ? ' fav' : ''), onclick: () => logSheet(f) }, [
    f.fav ? h('span', { html: icon(IC.stern, 13), style: { display: 'inline-flex', color: 'var(--blau)' } }) : null, f.name]))));
}

/* ---------- the meal sheet: tap Breakfast (or any meal) on Entry.
   Top: search, picking a food opens the log sheet with this meal already set.
   Then the same meal from the day before (or the last day it was logged, up to two weeks back), to copy whole
   or line by line. Lines already on today's plate are ticked and skipped, so Copy all never doubles up.
   Then the foods you usually have at this meal. */
function kopieVon(src, meal){
  const food = src.food && DATA.foods[src.food], w = food || src;
  return { id: neueId(), food: food ? src.food : null, name: food ? food.name : src.name, brand: food ? (food.brand || '') : (src.brand || ''),
    g: src.g, meal, k: w.k, p: w.p, c: w.c, f: w.f, at: new Date().toISOString() };
}
function gleicherPosten(a, b){ return (a.food && b.food ? a.food === b.food : a.name === b.name) && Math.abs(a.g - b.g) < 0.05; }
function mahlzeitBlatt(meal, iso){
  const use = gebrauch(), alle = foodListe();
  /* the last earlier day that has this meal */
  let vorIso = null, vorItems = [];
  for (let i = 1; i <= 14 && !vorIso; i++){
    const t = ISO(add(P(iso), -i)), x = tag(t), m = x ? x.items.filter(it => it.meal === meal) : [];
    if (m.length){ vorIso = t; vorItems = m; }
  }
  const body = h('div');
  const q0 = { v: '' };
  const eingabe = h('input', { type: 'search', placeholder: 'Search your foods', autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Search your foods' });
  const treff = h('div', { class: 'mtreffer' }), rest = h('div');
  body.appendChild(h('label', { class: 'suche msuche' }, [h('span', { html: icon(IC.suche, 18) }), eingabe]));
  body.appendChild(treff); body.appendChild(rest);

  const waehle = (f, g) => { d.zu(); logSheet(f, { iso, meal, g }); };

  /* --- the day before */
  let kopierKnopf = null, zeilen = [];
  const offen = () => {                       /* which earlier lines are not on this day's meal yet */
    const heute = (tag(iso) ? tag(iso).items : []).filter(it => it.meal === meal).slice();
    return vorItems.map(v => { const j = heute.findIndex(x => gleicherPosten(x, v)); if (j >= 0){ heute.splice(j, 1); return false; } return true; });
  };
  const malKopie = () => {
    const o = offen(), n = o.filter(Boolean).length;
    zeilen.forEach((z, i) => { z.box.classList.toggle('ok', !o[i]); z.plus.classList.toggle('ok', !o[i]); z.plus.innerHTML = icon(o[i] ? IC.plus : '<path d="M5 12.5l4.5 4.5L19 7.5"/>', 16); z.plus.setAttribute('aria-label', o[i] ? 'Add this' : 'Already logged'); });
    if (!kopierKnopf) return;
    kopierKnopf.disabled = n === 0;
    kopierKnopf.innerHTML = icon('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', 15) +
      '<span>' + (n === 0 ? 'All logged' : (n === vorItems.length ? 'Copy all' : 'Copy the rest')) + '</span>';
  };
  const buche = items => {
    const t = DATA.days[iso] || (DATA.days[iso] = { items: [] });
    bissVorbereiten(iso); items.forEach(x => t.items.push(x));
    aendern(); neuId = items.map(x => x.id);
    if (S.tab !== 'entry'){ S.tag = iso; zeigeTab('entry'); } else seiteEntry();
  };
  if (vorIso){
    const s = summe(vorItems);
    const titel = tagWort(vorIso);   /* the sheet is already titled with the meal: Yesterday, or the weekday */
    kopierKnopf = h('button', { type: 'button', class: 'chip chip--filter is-on' });
    kopierKnopf.onclick = () => {
      const o = offen(), neu = vorItems.filter((v, i) => o[i]).map(v => kopieVon(v, meal));
      if (!neu.length) return;
      const z = zielVon(iso), pVor = tagSumme(iso).p;
      buche(neu); d.zu();
      const k = summe(neu);
      let [a, b] = SPRUECHE_KOPIE[Math.floor(Math.random() * SPRUECHE_KOPIE.length)];
      if (z.protein && pVor < z.protein && pVor + k.p >= z.protein){ a = 'Protein target reached.'; b = 'Fully funded for ' + (iso === TODAY ? 'today' : tagKurz(iso)) + '.'; }
      toast(a + ' ' + plural(neu.length, 'item') + ' to ' + meal + ', ' + tsd(k.kcal) + ' kcal', false, b);
      plusFliegt(k.kcal);
    };
    const box = h('div', { class: 'vortag' }, [h('div', { class: 'vkopf' }, [
      h('div', {}, [h('b', {}, [titel]), h('small', {}, [tagKurz(vorIso) + ' \u00b7 ' + plural(vorItems.length, 'item') + ', ' + tsd(s.kcal) + ' kcal'])]), kopierKnopf])]);
    vorItems.forEach(v => {
      const food = v.food && DATA.foods[v.food], unit = food && food.unit === 'ml' ? 'ml' : 'g', w = posten(food ? Object.assign({}, v, { k: food.k, p: food.p, c: food.c, f: food.f }) : v);
      const zeile = h('button', { type: 'button', class: 'zeile', onclick: () => {
        /* tap the line: log it with the amount prefilled, to tweak before adding */
        if (food) waehle(Object.assign({ id: v.food }, food), v.g);
        else { buche([kopieVon(v, meal)]); malKopie(); gebucht(DATA.days[iso].items[DATA.days[iso].items.length - 1], iso); }
      } }, [
        h('span', { class: 'nm' }, [food ? food.name : v.name]),
        h('span', { class: 'sub' }, [g1(v.g) + ' ' + unit + '  \u00a0P ' + g1(w.p) + '  C ' + g1(w.c) + '  F ' + g1(w.f)]),
        h('span', { class: 'rechts' }, [tsd(w.kcal), h('small', {}, ['kcal'])])
      ]);
      const plus = h('button', { type: 'button', class: 'addk' });
      plus.onclick = () => { const x = kopieVon(v, meal); buche([x]); malKopie(); gebucht(x, iso); };
      const zb = h('div', { class: 'vzeile' }, [zeile, plus]);
      zeilen.push({ box: zb, plus }); box.appendChild(zb);
    });
    rest.appendChild(box);
    malKopie();
  }

  /* --- the usual at this meal: foods by how often they were logged here, favourites as a fallback */
  const hier = {};
  Object.keys(DATA.days).forEach(t => DATA.days[t].items.forEach(it => { if (it.meal === meal && it.food && DATA.foods[it.food]) hier[it.food] = (hier[it.food] || 0) + 1; }));
  let ueblich = alle.filter(f => hier[f.id]).sort((a, b) => hier[b.id] - hier[a.id] || ((use[b.id] || {}).n || 0) - ((use[a.id] || {}).n || 0));
  let uTitel = 'Usual at ' + meal.toLowerCase();
  if (!ueblich.length){ ueblich = alle.filter(f => f.fav).concat(alle.filter(f => !f.fav && use[f.id]).sort((a, b) => use[b.id].n - use[a.id].n)); uTitel = 'Favourites and recent'; }
  ueblich = ueblich.slice(0, 12);
  if (ueblich.length){
    rest.appendChild(h('div', { class: 'unterkopf', style: { marginBottom: '8px' } }, [h('span', {}, [uTitel])]));
    rest.appendChild(h('div', { class: 'schnellwahl' }, ueblich.map(f => h('button', { type: 'button', class: 'chip chip--filter' + (f.fav ? ' fav' : ''), onclick: () => waehle(f) }, [
      f.fav ? h('span', { html: icon(IC.stern, 13), style: { display: 'inline-flex', color: 'var(--blau)' } }) : null, f.name]))));
  } else if (!vorIso){
    rest.appendChild(h('div', { class: 'mleer', style: { padding: '4px' } }, ['No foods yet. Search above, or close this and scan the first one.']));
  }

  /* --- search: results replace the sections while there is text */
  const malTreffer = () => {
    const q = eingabe.value.trim(); treff.innerHTML = ''; rest.hidden = !!q;
    if (!q) return;
    const t = alle.map(f => ({ f, s: treffer(f, q) })).filter(x => x.s).sort((a, b) => b.s - a.s || ((use[b.f.id] || {}).n || 0) - ((use[a.f.id] || {}).n || 0)).slice(0, 12);
    if (t.length) treff.appendChild(h('div', { class: 'liste' }, t.map(x => h('button', { type: 'button', class: 'zeile', onclick: () => waehle(x.f) }, [
      h('span', { class: 'nm' }, [x.f.name]),
      h('span', { class: 'sub' }, [(x.f.brand ? x.f.brand + ', ' : '') + tsd(x.f.k) + ' kcal per 100 ' + x.f.unit]),
      h('span', { class: 'rechts' }, [use[x.f.id] ? g1(use[x.f.id].lastG) + ' ' + x.f.unit : '', h('small', {}, [use[x.f.id] ? 'last time' : 'new'])])
    ]))));
    else treff.appendChild(h('div', { class: 'mleer', style: { padding: '6px 4px' } }, ['No food called \u201c' + q + '\u201d yet.']));
    const code = /^\d{8,14}$/.test(q);
    treff.appendChild(h('button', { type: 'button', class: 'chip chip--filter', style: { marginTop: '8px' }, onclick: () => { d.zu(); foodEditor({ name: code ? '' : q, barcode: code ? q : '' }, { danach: 'log', logOpt: { iso, meal } }); },
      html: icon(IC.plus, 15) + '<span>New food' + (code ? ' with this code' : ' \u201c' + esc(q) + '\u201d') + '</span>' }));
  };
  eingabe.oninput = malTreffer;
  eingabe.onkeydown = e => { if (e.key === 'Enter'){ const erstes = $('.zeile', treff); if (erstes) erstes.click(); } };

  const jetzt = summe((tag(iso) ? tag(iso).items : []).filter(it => it.meal === meal));
  const d = blatt(meal, (iso === TODAY ? 'Today, ' + tagKurz(iso) : tagLang(iso)) + (jetzt.n ? '. ' + tsd(jetzt.kcal) + ' kcal so far.' : '.'), body, { fokus: TOUCH ? null : 'input' });
}

/* ---------- the log sheet: amount (portions or grams), meal, live numbers. Also edits a logged item.
   Portion mode: type how many pieces (6 cookies), the grams follow from the food's portion size.
   Gram mode: type the full grams or ml as weighed; the label values are per 100, the sheet does the maths. */
function logSheet(food, opt){
  opt = opt || {};
  const it = opt.item, iso = opt.iso || S.tag, use = gebrauch();
  const quelle = it ? { name: it.name, brand: it.brand || '', k: it.k, p: it.p, c: it.c, f: it.f, unit: food ? food.unit : 'g', portion: food ? food.portion : null } : food;
  if (!quelle) return;
  let meal = it ? it.meal : (opt.meal || standardMahlzeit());
  const pg = quelle.portion && quelle.portion.g > 0 ? quelle.portion.g : 0;
  const pName = pg ? (/[a-zA-Z\u00c0-\u024f]/.test(quelle.portion.name) ? quelle.portion.name : 'Portion') : '';
  const glatt = n => Math.abs(n * 4 - Math.round(n * 4)) < 0.01;          /* whole, half or quarter portions */
  const zahlText = x => String(Math.round(x * 100) / 100);
  const vorG = it ? it.g : (opt.g > 0 ? opt.g : 0);
  const startG = vorG || (use[food.id] && use[food.id].lastG ? use[food.id].lastG : (pg || 100));
  /* portions whenever the food has a size, unless an edited or copied entry was weighed to an odd amount */
  let art = pg && (!vorG || glatt(vorG / pg)) ? 'portion' : 'g';
  const startWert = art === 'portion' ? (glatt(startG / pg) ? startG / pg : 1) : startG;
  const gIn = h('input', { type: 'text', inputmode: 'decimal', value: zahlText(startWert), 'aria-label': 'Amount', enterkeyhint: 'done', autocomplete: 'off' });
  const einh = h('em', {}, [art === 'portion' ? pName : quelle.unit]);
  const feld = h('div', { class: 'gramm' }, [gIn, einh]);
  const umrech = h('div', { class: 'umrech' });
  const kopf = h('div', { class: 'k' }, [art === 'portion' ? 'How many' : 'Amount']);
  const kachel = h('div', { class: 'mengenkachel', onclick: e => { if (e.target !== gIn){ gIn.focus(); gIn.select(); } } }, [
    kopf, h('span', { class: 'stift', html: icon('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 15) }), feld, umrech
  ]);
  const vor = h('div', { class: 'vorschau' });
  const gramm = () => { const v = zahlLesen(gIn.value) || 0; return Math.round((art === 'portion' ? v * pg : v) * 10) / 10; };
  const malVor = () => {
    const g = gramm(), x = g / 100, v = zahlLesen(gIn.value) || 0;
    gIn.style.width = Math.max(1.6, gIn.value.length + .4) + 'ch';      /* the unit sits right next to the number */
    vor.innerHTML = '';
    [['kcal', quelle.k * x, true], ['Protein', quelle.p * x], ['Carbs', quelle.c * x], ['Fat', quelle.f * x]].forEach(([n, w, k]) =>
      vor.appendChild(h('div', {}, [h('b', {}, [k ? tsd(w) : g1(w)]), h('small', {}, [k ? n : n + ' g'])])));
    if (art === 'portion') umrech.innerHTML = esc(zahlText(v)) + ' \u00d7 ' + esc(g1(pg)) + ' ' + quelle.unit + ' = <b>' + esc(g1(g)) + ' ' + quelle.unit + '</b>';
    else umrech.textContent = pg ? '1 ' + pName + ' = ' + g1(pg) + ' ' + quelle.unit : 'Full amount, e.g. 150 for 150 ' + quelle.unit;
    los.disabled = !(g > 0);
  };
  /* switching keeps the same amount of food: 6 pieces become 114 g and back */
  const wechsle = neu => {
    if (neu === art) return;
    const g = gramm(); art = neu;
    gIn.value = g > 0 ? zahlText(art === 'portion' ? g / pg : g) : '';
    einh.textContent = art === 'portion' ? pName : quelle.unit;
    kopf.textContent = art === 'portion' ? 'How many' : 'Amount';
    feld.classList.remove('wechsel'); void feld.offsetWidth; feld.classList.add('wechsel');
    malVor();
    if (!TOUCH){ gIn.focus(); gIn.select(); }
  };
  const artWahl = pg ? h('div', { class: 'mengenart' }, [segment([['portion', pName], ['g', quelle.unit === 'ml' ? 'Millilitres' : 'Grams']], art, wechsle)]) : null;
  const los = h('button', { type: 'button', class: 'btn btn--primary' }, [it ? 'Save' : 'Add to ' + meal]);
  const mahl = segment(MEALS.map(m => [m, m === 'Breakfast' ? 'Breakfast' : m]), meal, m => { meal = m; if (!it) los.textContent = 'Add to ' + m; });
  gIn.onkeydown = e => { if (e.key === 'Enter' && !los.disabled) los.click(); };
  gIn.oninput = malVor;
  gIn.onfocus = () => setTimeout(() => gIn.select(), 0);   /* typing replaces the amount */
  const body = h('div', {}, [
    artWahl,
    kachel,
    vor,
    h('div', { class: 'mahlwahl' }, [mahl]),
    h('div', { class: 'aktion' }, [
      it ? h('button', { type: 'button', class: 'btn btn--quiet-danger links', onclick: () => {
        d.zu(); postenLoeschen(iso, it);
      } }, ['Remove']) : null,
      los
    ])
  ]);
  los.onclick = () => {
    const g = gramm(); if (!(g > 0)) return;
    if (it){ it.g = g; it.meal = meal; d.zu(); aendern(); neuId = it.id; malSeite(); toast('Updated', false, it.name + ', ' + g1(g) + ' ' + quelle.unit); return; }
    const t = DATA.days[iso] || (DATA.days[iso] = { items: [] });
    const neu = { id: neueId(), food: food.id || null, name: food.name, brand: food.brand || '', g, meal, k: food.k, p: food.p, c: food.c, f: food.f, at: new Date().toISOString() };
    bissVorbereiten(iso); t.items.push(neu);
    d.zu(); aendern(); neuId = neu.id; S.suche = '';
    if (S.tab !== 'entry'){ S.tag = iso; zeigeTab('entry'); } else seiteEntry();
    gebucht(neu, iso);
  };
  malVor();
  const d = blatt(quelle.name,(quelle.brand ? quelle.brand + '. ' : '') + tsd(quelle.k) + ' kcal per 100 ' + quelle.unit + (it ? '. Logged on ' + tagKurz(iso) + '.' : ''), body, { fokus: TOUCH ? null : 'input' });
}

/* ---------- bodyweight: a pill next to the phase on the day card (Overview and Entry), one figure per day */
function gewichtKnopf(iso, fertig){
  const kg = gewicht(iso);
  return h('button', { type: 'button', class: 'phase gw' + (kg === null ? ' leer' : ''), onclick: () => gewichtBlatt(iso, fertig) }, [h('i'), kg === null ? 'Add weight' : kg1(kg) + ' kg']);
}
function gewichtBlatt(iso, fertig){
  const kg = gewicht(iso), vor = gewichtVor(iso);
  const gIn = h('input', { type: 'text', inputmode: 'decimal', value: kg !== null ? kg1(kg) : (vor ? kg1(vor.kg) : ''), placeholder: '0.0', 'aria-label': 'Bodyweight in kg', enterkeyhint: 'done', autocomplete: 'off' });
  const umrech = h('div', { class: 'umrech' });
  const los = h('button', { type: 'button', class: 'btn btn--primary' }, ['Save']);
  const wert = () => { const v = zahlLesen(gIn.value); return v !== null && v >= 20 && v <= 400 ? Math.round(v * 10) / 10 : null; };
  const seit = v => (Math.abs(v - vor.kg) < .05 ? 'unchanged' : (v > vor.kg ? '+' : '−') + kg1(Math.abs(v - vor.kg)) + ' kg') + ' since ' + tagKurz(vor.iso);
  const mal = () => {
    gIn.style.width = Math.max(2.4, gIn.value.length + .4) + 'ch';
    const v = wert();
    umrech.textContent = v !== null && vor ? seit(v) : (vor ? 'Last weigh-in ' + kg1(vor.kg) + ' kg on ' + tagKurz(vor.iso) : 'In kg, e.g. 78.4');
    los.disabled = v === null;
  };
  gIn.oninput = mal;
  gIn.onfocus = () => setTimeout(() => gIn.select(), 0);
  gIn.onkeydown = e => { if (e.key === 'Enter' && !los.disabled) los.click(); };
  const kachel = h('div', { class: 'mengenkachel', onclick: e => { if (e.target !== gIn){ gIn.focus(); gIn.select(); } } }, [
    h('div', { class: 'k' }, ['Bodyweight']), h('div', { class: 'gramm' }, [gIn, h('em', {}, ['kg'])]), umrech
  ]);
  los.onclick = () => {
    const v = wert(); if (v === null) return;
    DATA.weights[iso] = v; d.zu(); aendern(); fertig();
    toast('Balance sheet updated.', false, kg1(v) + ' kg on ' + tagKurz(iso) + (vor ? ', ' + seit(v) : ''));
  };
  const body = h('div', {}, [kachel, h('div', { class: 'aktion' }, [
    kg !== null ? h('button', { type: 'button', class: 'btn btn--quiet-danger links', onclick: () => { delete DATA.weights[iso]; d.zu(); aendern(); fertig(); toast('Weight removed', false, tagKurz(iso)); } }, ['Remove']) : null,
    los
  ])]);
  mal();
  const d = blatt('Bodyweight', (iso === TODAY ? 'Today, ' + tagKurz(iso) : tagLang(iso)) + '. One weigh-in a day, ideally in the morning.', body, { fokus: TOUCH ? null : 'input' });
}

