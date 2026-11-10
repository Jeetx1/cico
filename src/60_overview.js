/* ================================================================ Overview */
const RING_E = ['var(--ring-e1)', 'var(--ring-e2)'], RING_P = ['var(--ring-p1)', 'var(--ring-p2)'];

/* the "today" card: shared with Entry (smaller), so both always say the same */
function tagesRinge(iso, groesse){
  const s = tagSumme(iso), z = zielVon(iso), bs = bissFuer(iso), alt = bs ? bs.s : null, extra = bs ? BISS_DELAY / 1000 : 0;
  const rings = [{ frac: z.kcal ? s.kcal / z.kcal : 0, von: alt && z.kcal ? alt.kcal / z.kcal : 0, extra, breite: groesse > 150 ? 17 : 11, farbe: RING_E, warn: true }];
  if (z.protein) rings.push({ frac: s.p / z.protein, von: alt ? alt.p / z.protein : 0, extra, breite: groesse > 150 ? 13 : 8, farbe: RING_P });
  const rest = z.kcal ? z.kcal - s.kcal : null;
  const b = h('b', { class: 'zahl' }), small = h('small');
  if (rest === null){ small.textContent = 'kcal eaten'; }
  else if (rest >= 0){ small.textContent = 'kcal left'; }
  else { small.textContent = 'kcal over'; }
  const wert = rest === null ? s.kcal : Math.abs(rest);
  const box = h('div', { class: 'ringe', html: ringeSVG(groesse, rings) }, [h('div', { class: 'mitte' }, [b, small])]);
  if (alt){
    /* the figure waits for the bite, then counts on from the old one */
    const vorher = rest === null ? alt.kcal : Math.abs(z.kcal - alt.kcal);
    b.textContent = tsd(vorher); b.dataset.wert = vorher;
    setTimeout(() => zaehle(b, wert), BISS_DELAY);
  } else zaehle(b, wert);
  return { box, s, z };
}
function makroZeile(name, farbe, wert, ziel, einheit){
  const frac = ziel ? Math.min(1, wert / ziel) : 0;
  return h('div', { class: 'mzeile' }, [
    h('span', { class: 'nm' }, [h('i', { style: { background: farbe } }), name]),
    h('span', { class: 'wert', html: (einheit === 'kcal' ? tsd(wert) : g1(wert)) + (ziel ? ' <small>/ ' + (einheit === 'kcal' ? tsd(ziel) : g1(ziel)) + ' ' + einheit + '</small>' : ' <small>' + einheit + '</small>') }),
    h('div', { class: 'balken' }, [h('i', { style: { background: farbe, transform: 'scaleX(' + (BEWEGUNG && !RUHIG ? 0 : frac) + ')' }, 'data-frac': frac })])
  ]);
}
function balkenLos(root){
  if (!BEWEGUNG || RUHIG) return;
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.balken i', root).forEach((b, i) => { b.style.transitionDelay = (.1 + i * .06) + 's'; b.style.transform = 'scaleX(' + b.dataset.frac + ')'; })));
}

function seiteOverview(){
  const root = $('#p-overview'); root.innerHTML = ''; root.classList.toggle('ruhig', RUHIG);
  const sc = scope(), a = agg(sc);

  /* header with the period controls (house pattern: top right) */
  const js = jahre();
  const jahrSel = js.length > 1 ? h('label', { class: 'select-wrap' }, [h('select', { class: 'select select--pill', 'aria-label': 'Year', onchange: e => { S.jahr = Number(e.target.value); seiteOverview(); } },
    js.map(j => h('option', { value: j, selected: j === S.jahr ? 'selected' : null }, [String(j)])))]) : null;
  const monSel = h('label', { class: 'select-wrap' }, [h('select', { class: 'select select--pill', 'aria-label': 'Month', onchange: e => { S.monat = Number(e.target.value); seiteOverview(); } },
    MONTHS.map((m, i) => h('option', { value: i, selected: i === S.monat ? 'selected' : null }, [m])))]);
  root.appendChild(h('div', { class: 'seitenkopf' }, [
    h('div', {}, [h('h2', {}, ['Overview']), h('p', {}, [sc.titel])]),
    h('div', { class: 'perioden' }, [jahrSel, monSel, segment([['month', 'Month'], ['ytd', 'YTD']], S.modus, m => { S.modus = m; seiteOverview(); })])
  ]));

  const raster = h('div', { class: 'raster' });
  root.appendChild(raster);

  /* today */
  const tg = S.tag, r = tagesRinge(tg, 188), ph = phaseVon(tg);
  const heute = h('div', { class: 'glas card heute s5' }, [
    r.box,
    h('div', { class: 'zeilen' }, [
      h('div', { class: 'daykopf' }, [
        h('div', {}, [h('h3', {}, [tagWort(tg)]), h('p', { class: 'unter', style: { margin: '1px 0 0', color: 'var(--t3)', fontSize: '12.5px' } }, [tagWort(tg) === DAYLONG[dow(P(tg))] ? P(tg).getUTCDate() + ' ' + MONTHS[P(tg).getUTCMonth()] + ' ' + P(tg).getUTCFullYear() : tagLang(tg)])]),
        tg !== TODAY ? h('button', { type: 'button', class: 'heutek', onclick: () => tagSlide(TODAY, tg < TODAY ? 1 : -1) }, ['Today']) : null
      ]),
      makroZeile('Energy', 'var(--energy)', r.s.kcal, r.z.kcal, 'kcal'),
      makroZeile('Protein', 'var(--prot)', r.s.p, r.z.protein, 'g'),
      makroZeile('Carbs', 'var(--carb)', r.s.c, r.z.carbs, 'g'),
      makroZeile('Fat', 'var(--fett)', r.s.f, r.z.fat, 'g'),
      h('div', { class: 'pillen' }, [h('button', { type: 'button', class: 'phase', onclick: () => phaseDialog(tg, seiteOverview) }, [h('i'), PHASE[ph].name]), gewichtKnopf(tg, seiteOverview)])
    ])
  ]);
  raster.appendChild(heute);

  /* key figures for the period */
  const zielTxt = a.schnittDiff === null ? (zielGesetzt() ? 'No target on these days' : 'Set a target to compare') :
    (Math.abs(a.schnittDiff) < 1 ? 'Right on target' : tsd(Math.abs(a.schnittDiff)) + ' kcal ' + (a.schnittDiff > 0 ? 'above' : 'below') + ' target');
  /* KPI tiles: value, sparkline (travelling light), delta against the previous period */
  /* maintenance as estimated at the end of the period (yesterday while it runs), and at the end of the period before */
  const erh = erhaltung(sc.bis), erhVor = erhaltung(ISO(add(P(sc.von), -1)));
  const erhText = erh.fehlt || '\u00b1' + tsd(erh.pm) + ' kcal \u00b7 ' + erh.tage + ' days logged';
  const erhTitel = erh.fehlt ? 'Maintenance is estimated from what you log and how your weight moves: ' + erh.fehlt.toLowerCase() + '.'
    : 'Average of ' + tsd(erh.schnitt) + ' kcal on ' + erh.tage + ' logged days, weight trend ' + (erh.kgProWoche < 0 ? '\u2212' : '+') + Math.abs(erh.kgProWoche).toFixed(2) +
      ' kg per week (' + erh.wiegen + ' weigh-ins, ' + tagKurz(erh.von) + ' to ' + tagKurz(erh.bis) + ', 7\u2019700 kcal per kg). Days logged incompletely make it read low.';
  const kpiSchluessel = [sc.von, sc.bis, S.modus, a.geloggt, Math.round(a.kcal), Math.round(a.p), a.gewichte.map(x => x.iso + x.kg).join(','), erh.kcal].join('|');
  const kpiRuhig = RUHIG || kpiSchluessel === KPI_ZULETZT; KPI_ZULETZT = kpiSchluessel;
  const vp = vorperiode(), av = vp.a, linien = kpiLinien(a), sparks = [];
  const kachel = (k, wert, einheit, f, fmt, x) => {
    x = x || {};
    const w = h('span', { class: 'zahl' });
    const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sv.setAttribute('class', 'spark'); sv.setAttribute('aria-hidden', 'true'); if (x.farbe) sv.style.setProperty('--kpi-farbe', x.farbe);
    const fuss = h('div', { class: 'f' }, [x.delta ? h('span', { class: 'delta ' + (x.delta.gut ? 'delta--up' : 'delta--flat'), title: x.delta.titel }, [x.delta.txt]) : null, h('span', {}, [f])]);
    const el = h('div', { class: 'glas card kpi kachel', title: x.titel || null }, [h('div', { class: 'k' }, [k]), h('div', {}, [h('div', { class: 'w' }, [w, einheit ? h('small', {}, [einheit]) : null]), sv, fuss])]);
    const war = RUHIG; if (kpiRuhig) RUHIG = true;
    try { if (wert === null) w.textContent = '\u2013'; else zaehle(w, wert, fmt); } finally { RUHIG = war; }
    sparks.push([sv, x.linie || []]);
    return el;
  };
  /* deltas: better = success colour, otherwise neutral (never red); none when the previous period has no data */
  const vs = 'vs ' + vp.label;
  const dZahl = (d, einheit, besser, titel) => (d === null || !isFinite(d) || Math.round(d) === 0) ? null :
    { txt: (d > 0 ? '+' : '\u2212') + tsd(Math.abs(d)) + (einheit ? ' ' + einheit : '') + ' ' + vs, gut: besser === 0 ? false : (d > 0) === (besser > 0), titel: titel + ' ' + vs };
  /* bodyweight: the last weigh-in of the period, the shift since the last one before it (or the period's first);
     the delta compares the average weight with the period before. Lower counts as better only in a mostly-shred period. */
  const gw = a.gewichte, gwLetzt = gw.length ? gw[gw.length - 1] : null, gwBasis = a.gewichtVorher || (gw.length > 1 ? gw[0] : null);
  const gwText = !gwLetzt ? 'Weigh in on Entry' : !gwBasis ? 'Weighed on ' + tagKurz(gwLetzt.iso)
    : (Math.abs(gwLetzt.kg - gwBasis.kg) < .05 ? 'Unchanged' : (gwLetzt.kg > gwBasis.kg ? '+' : '−') + kg1(Math.abs(gwLetzt.kg - gwBasis.kg)) + ' kg') + ' since ' + tagKurz(gwBasis.iso);
  const gwBesser = a.phasen.shred > a.phasen.maintain + a.phasen.surplus ? -1 : 0, gwD = a.schnittKg !== null && av.schnittKg !== null ? a.schnittKg - av.schnittKg : null;
  const gwDelta = gwD === null || Math.abs(gwD) < .05 ? null :
    { txt: (gwD > 0 ? '+' : '−') + kg1(Math.abs(gwD)) + ' kg ' + vs, gut: gwBesser !== 0 && (gwD > 0) === (gwBesser > 0), titel: 'Average bodyweight ' + vs };
  raster.appendChild(h('div', { class: 'kacheln s7' }, [
    kachel('Average per day', a.geloggt ? a.schnittKcal : null, 'kcal', a.geloggt ? zielTxt : 'Nothing logged yet', null,
      { linie: linien.kcal, farbe: 'var(--energy)', delta: a.geloggt && av.geloggt ? dZahl(a.schnittKcal - av.schnittKcal, 'kcal', 0, 'Average kcal per logged day') : null }),
    kachel('Protein per day', a.geloggt ? a.schnittP : null, 'g', a.mitProteinZiel ? 'Target reached on ' + a.proteinOk + ' of ' + a.mitProteinZiel + ' days' : 'Across logged days', null,
      { linie: linien.p, farbe: 'var(--prot)', delta: a.geloggt && av.geloggt ? dZahl(a.schnittP - av.schnittP, 'g', 1, 'Average protein per logged day') : null }),
    kachel('Maintenance', erh.fehlt ? null : erh.kcal, erh.fehlt ? '' : 'kcal', erhText, null,
      { linie: linien.erh, farbe: 'var(--energy)', titel: erhTitel, delta: !erh.fehlt && !erhVor.fehlt ? dZahl(erh.kcal - erhVor.kcal, 'kcal', 0, 'Estimated maintenance') : null }),
    kachel('Bodyweight', gwLetzt ? gwLetzt.kg : null, gwLetzt ? 'kg' : '', gwText, kg1, { linie: linien.kg, farbe: 'var(--weight)', delta: gwDelta })
  ]));
  /* the lines are drawn once the tiles are on the page (they need their width) */
  requestAnimationFrame(() => sparks.forEach(([sv, d], i) => { if (sv.isConnected) kpiSpark(sv, d, !kpiRuhig && BEWEGUNG, 220 + i * 140); }));

  /* the chart */
  raster.appendChild(diagrammKarte(a, sc));

  /* macro split */
  const kcalMakro = a.p * 4 + a.c * 4 + a.f * 9;
  const makro = h('div', { class: 'glas card karte s5' }, [
    h('div', { class: 'kkopf' }, [h('div', {}, [h('h3', {}, ['Where the energy came from']), h('p', { class: 'unter' }, ['Share of kcal by macro, average per logged day'])])])
  ]);
  if (kcalMakro > 0){
    makro.appendChild(h('div', { class: 'split' }, MAKRO.map(m => h('i', { style: { width: (a[m.id] * m.kcal / kcalMakro * 100).toFixed(2) + '%', background: m.farbe } }))));
    makro.appendChild(h('div', { class: 'splitliste' }, MAKRO.map(m => h('div', {}, [h('i', { style: { background: m.farbe } }), h('span', {}, [m.name]),
      h('b', {}, [g1(a[m.id] / a.geloggt) + ' g']), h('small', {}, [Math.round(a[m.id] * m.kcal / kcalMakro * 100) + ' %'])]))));
  } else makro.appendChild(h('div', { class: 'leer-hinweis' }, ['Macros show up once something is logged.']));
  /* the phases of the period: how many logged days each, and what they averaged */
  const proPhase = {};
  a.tage.forEach(t => { if (!t.geloggt) return; const x = proPhase[t.phase] || (proPhase[t.phase] = { n: 0, kcal: 0 }); x.n++; x.kcal += t.s.kcal; });
  const benutzt = PHASES.filter(p => proPhase[p.id]);
  if (benutzt.length){
    makro.appendChild(h('div', { class: 'kkopf', style: { marginTop: '20px', marginBottom: '10px' } }, [h('div', {}, [h('h3', {}, ['Phases']), h('p', { class: 'unter' }, ['Logged days and their average'])])]));
    makro.appendChild(h('div', { class: 'splitliste' }, benutzt.map(p => { const z = DATA.config.targets[p.id].kcal; return h('div', {}, [
      h('i', { style: { background: 'var(--phase-' + p.id + ')' } }), h('span', {}, [p.name + ', ' + plural(proPhase[p.id].n, 'day')]),
      h('b', {}, [tsd(proPhase[p.id].kcal / proPhase[p.id].n) + ' kcal']), h('small', {}, [z ? 'of ' + tsd(z) : ''])]); })));
  }
  raster.appendChild(makro);

  /* top foods */
  const top = Object.values(a.foods).sort((x, y) => y.kcal - x.kcal).slice(0, 6);
  const topK = h('div', { class: 'glas card karte s7' }, [h('div', { class: 'kkopf' }, [h('div', {}, [h('h3', {}, ['Biggest contributors']), h('p', { class: 'unter' }, ['Foods by total kcal in ' + (S.modus === 'ytd' ? 'the year so far' : MONTHS[S.monat])])])])]);
  if (top.length){
    const max = top[0].kcal;
    topK.appendChild(h('div', { class: 'topliste' }, top.map((f, i) => h('div', { class: 'toprow' }, [
      h('span', { class: 'nr' }, [String(i + 1)]),
      h('div', { class: 'nm' }, [h('div', {}, [f.name]), h('div', { class: 'bar' }, [h('i', { style: { width: (f.kcal / max * 100).toFixed(1) + '%', animationDelay: (i * .06) + 's' } })])]),
      h('div', { class: 'kc' }, [tsd(f.kcal) + ' kcal', h('small', {}, [plural(f.n, 'entry', 'entries') + ', ' + Math.round(f.kcal / a.kcal * 100) + ' %'])])
    ]))));
  } else topK.appendChild(h('div', { class: 'leer-hinweis' }, ['Your most eaten foods land here.']));
  raster.appendChild(topK);

  ringeLos(root); balkenLos(root); pegel();
}

/* daily bars for a month, weekly averages for YTD; the dashed line is the target of each day (it follows the phases) */
function diagrammKarte(a, sc){
  const ytd = S.modus === 'ytd';
  const punkte = ytd ? wochen(a.tage).map(w => ({ label: w.mo, wert: w.wert, ziel: w.ziel, zukunft: w.zukunft, leer: !w.n, heute: w.mo === ISO(monday(P(S.tag))) }))
                     : a.tage.map(t => ({ label: t.iso, wert: t.s.kcal, ziel: t.z.kcal, zukunft: t.zukunft, leer: !t.geloggt, heute: t.iso === S.tag }));
  const karte = h('div', { class: 'glas card karte' }, [h('div', { class: 'kkopf' }, [
    h('div', {}, [h('h3', {}, [ytd ? 'Energy per week' : 'Energy per day']), h('p', { class: 'unter' }, [(ytd ? 'Average kcal per logged day in each week' : 'kcal eaten each day') + (a.gewichte.length ? ', and your bodyweight' : '')])])
  ])]);
  if (!a.geloggt){
    karte.appendChild(h('div', { class: 'leer-hinweis' }, [h('b', {}, ['Nothing logged in ' + (ytd ? S.jahr : MONTHS[S.monat]) + ' yet']), 'Scan or pick a food on Entry and it appears here.',
      h('div', { style: { marginTop: '14px' } }, [h('button', { type: 'button', class: 'btn btn--primary', onclick: () => { S.tag = TODAY; zeigeTab('entry'); } }, ['Go to Entry'])])]));
    return karte;
  }
  const W = 1000, H = 210, unten = 22, oben = 8, n = punkte.length;
  const max = Math.max(1, ...punkte.map(p => Math.max(p.wert, p.ziel || 0))) * 1.08;
  const y = v => oben + (H - unten - oben) * (1 - v / max);
  const sp = W / n, bw = Math.max(3, Math.min(26, sp * .62));
  const NSV = 'http://www.w3.org/2000/svg';
  let s = '<defs><linearGradient id="stabg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--bar-1)"/><stop offset="1" style="stop-color:var(--bar-2)"/></linearGradient>' +
    '<linearGradient id="stabh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--bar-today-1)"/><stop offset="1" style="stop-color:var(--bar-today-2)"/></linearGradient></defs>';
  /* gridlines */
  const schritt = max > 6000 ? 2000 : (max > 2500 ? 1000 : 500);
  for (let v = schritt; v < max; v += schritt) s += '<line x1="0" x2="' + W + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" style="stroke:var(--chart-grid)"/><text class="achse" x="' + W + '" y="' + (y(v) - 4).toFixed(1) + '" text-anchor="end">' + tsd(v) + '</text>';
  punkte.forEach((p, i) => {
    const x = i * sp + (sp - bw) / 2;
    if (!p.leer){
      const hgt = Math.max(2, H - unten - y(p.wert));
      s += '<rect class="stab" style="animation-delay:' + (i * (ytd ? .012 : .018)).toFixed(3) + 's" x="' + x.toFixed(1) + '" y="' + y(p.wert).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hgt.toFixed(1) + '" rx="' + Math.min(6, bw / 2).toFixed(1) + '" fill="url(#' + (p.heute ? 'stabh' : 'stabg') + ')"><title>' +
        (ytd ? 'Week of ' + tagKurz(p.label) + ': ' + tsd(p.wert) + ' kcal per day' : tagLang(p.label) + ': ' + tsd(p.wert) + ' kcal') + (p.ziel ? ' (target ' + tsd(p.ziel) + ')' : '') + '</title></rect>';
    } else if (!p.zukunft){
      s += '<rect x="' + (x + bw / 2 - 1.5).toFixed(1) + '" y="' + (H - unten - 3) + '" width="3" height="3" rx="1.5" style="fill:var(--bar-empty)"/>';
    }
    const heuteI = punkte.findIndex(x => x.heute), abst = TOUCH || W / n < 40 ? 7 : 3;
    const zeig = ytd ? (P(p.label).getUTCDate() <= 7) : (p.heute || ((n <= 16 || i % abst === 0) && (heuteI < 0 || Math.abs(i - heuteI) > (abst > 3 ? 2 : 1))));
    if (zeig) s += '<text class="achse" x="' + (i * sp + sp / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle"' + (p.heute ? ' style="fill:var(--text);font-weight:600"' : '') + '>' +
      (ytd ? MSHORT[P(p.label).getUTCMonth()] : String(P(p.label).getUTCDate())) + '</text>';
  });
  /* target as a step line, broken where there is none */
  let pfad = '', an = false;
  punkte.forEach((p, i) => {
    if (!p.ziel || p.zukunft){ an = false; return; }
    const x0 = i * sp, x1 = (i + 1) * sp, yy = y(p.ziel).toFixed(1);
    pfad += (an ? 'L' + x0.toFixed(1) + ',' + yy : 'M' + x0.toFixed(1) + ',' + yy) + 'L' + x1.toFixed(1) + ',' + yy; an = true;
  });
  if (pfad) s += '<path class="ziellinie" d="' + pfad + '"/>';
  /* bodyweight on its own scale (labels on the left): a line through the weigh-ins, bridging days without one.
     YTD: the weekly average. At least 2 kg of range, so a few hundred grams do not look like a landslide. */
  const gwPunkte = [];
  if (ytd){ const wk = {}; gewichtWochen(a.gewichte).forEach(w => { wk[w.mo] = w.kg; }); punkte.forEach((p, i) => { if (wk[p.label] !== undefined) gwPunkte.push({ i, kg: wk[p.label], label: p.label }); }); }
  else { punkte.forEach((p, i) => { const kg = p.zukunft ? null : gewicht(p.label); if (kg !== null) gwPunkte.push({ i, kg, label: p.label }); }); }
  if (gwPunkte.length){
    let lo = Math.min(...gwPunkte.map(p => p.kg)), hi = Math.max(...gwPunkte.map(p => p.kg));
    if (hi - lo < 2){ const m = (hi + lo) / 2; lo = m - 1; hi = m + 1; }
    const rand = (hi - lo) * .12; lo -= rand; hi += rand;
    const yk = v => oben + 10 + (H - unten - oben - 20) * (1 - (v - lo) / (hi - lo)), xk = i => i * sp + sp / 2;
    const st = hi - lo > 12 ? 5 : (hi - lo > 5 ? 2 : 1);
    for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) s += '<text class="achse gwachse" x="0" y="' + (yk(v) + 3.5).toFixed(1) + '" text-anchor="start">' + v + ' kg</text>';
    if (gwPunkte.length > 1) s += '<path class="gwlinie" vector-effect="non-scaling-stroke" d="' + gwPunkte.map((p, j) => (j ? 'L' : 'M') + xk(p.i).toFixed(1) + ',' + yk(p.kg).toFixed(1)).join('') + '"/>';
    gwPunkte.forEach(p => { s += '<circle class="gwpunkt" cx="' + xk(p.i).toFixed(1) + '" cy="' + yk(p.kg).toFixed(1) + '" r="3.2"><title>' + (ytd ? 'Week of ' + tagKurz(p.label) + ': ' + kg1(p.kg) + ' kg on average' : tagLang(p.label) + ': ' + kg1(p.kg) + ' kg') + '</title></circle>'; });
  }
  const box = h('div', { class: 'diagramm' });
  box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + (ytd ? 'Average kcal per week' : 'kcal per day') + '">' + s + '</svg>';
  /* text must not stretch with the bars: counter-scale it */
  const svgEl = box.firstChild;
  requestAnimationFrame(() => {
    const bw2 = svgEl.getBoundingClientRect ? svgEl.getBoundingClientRect().width : 0;
    if (!bw2) return;
    const fx = W / bw2;
    $$('text', svgEl).forEach(t => { const x = Number(t.getAttribute('x')); t.setAttribute('transform', 'translate(' + x + ' 0) scale(' + fx.toFixed(3) + ' 1) translate(' + (-x) + ' 0)'); });
    $$('circle', svgEl).forEach(c => { const x = Number(c.getAttribute('cx')); c.setAttribute('transform', 'translate(' + x + ' 0) scale(' + fx.toFixed(3) + ' 1) translate(' + (-x) + ' 0)'); });
  });
  karte.appendChild(box);
  karte.appendChild(h('div', { class: 'legende' }, [
    h('span', {}, [h('i', { style: { background: 'linear-gradient(var(--bar-1),var(--bar-2))' } }), ytd ? 'Average per logged day' : 'Eaten']),
    pfad ? h('span', {}, [h('i', { class: 'strich' }), 'Target of the day\u2019s phase']) : null,
    gwPunkte.length ? h('span', {}, [h('i', { class: 'gw' }), ytd ? 'Bodyweight, weekly average' : 'Bodyweight']) : null,
    h('span', {}, [h('i', { style: { background: 'linear-gradient(var(--bar-today-1),var(--bar-today-2))' } }), ytd ? (S.tag === TODAY ? 'This week' : 'Week of ' + tagKurz(S.tag)) : (S.tag === TODAY ? 'Today' : tagKurz(S.tag))])
  ]));
  return karte;
}

