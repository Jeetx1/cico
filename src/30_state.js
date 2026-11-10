/* ================================================================ UI state and the one aggregate the Overview reads */
const S = {
  tab: 'overview',
  jahr: Number(TODAY.slice(0, 4)), monat: Number(TODAY.slice(5, 7)) - 1, modus: 'month',
  tag: TODAY,
  suche: '', foodSuche: '', foodSort: 'used',
  dirty: false
};
function jahre(){
  const j = new Set([Number(TODAY.slice(0, 4)), S.jahr]);
  Object.keys(DATA.days).forEach(iso => j.add(Number(iso.slice(0, 4))));
  return Array.from(j).sort((a, b) => a - b);
}
function scope(){
  const y = S.jahr, m = S.monat;
  const von = S.modus === 'ytd' ? y + '-01-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01';
  const ende = ISO(add(new Date(Date.UTC(y, m + 1, 1)), -1));
  return { von, bis: ende, offenBis: ende < TODAY ? ende : TODAY,
    titel: S.modus === 'ytd' ? 'January to ' + MONTHS[m] + ' ' + y : MONTHS[m] + ' ' + y };
}
function agg(sc){
  const r = { tage: [], geloggt: 0, kcal: 0, p: 0, c: 0, f: 0, imZiel: 0, mitZiel: 0, diffSumme: 0, proteinOk: 0, mitProteinZiel: 0,
    kalender: 0, phasen: { maintain: 0, shred: 0, surplus: 0 }, foods: {} };
  for (let d = P(sc.von); ISO(d) <= sc.bis; d = add(d, 1)){
    const iso = ISO(d), t = tag(iso), s = summe(t ? t.items : []), z = zielVon(iso);
    const zukunft = iso > TODAY;
    r.tage.push({ iso, s, z, phase: phaseVon(iso), geloggt: s.n > 0, zukunft });
    if (!zukunft) r.kalender++;
    if (!s.n) continue;
    r.geloggt++; r.kcal += s.kcal; r.p += s.p; r.c += s.c; r.f += s.f;
    r.phasen[phaseVon(iso)]++;
    if (z.kcal){ r.mitZiel++; r.diffSumme += s.kcal - z.kcal; if (Math.abs(s.kcal - z.kcal) <= z.kcal * .1) r.imZiel++; }
    if (z.protein){ r.mitProteinZiel++; if (s.p >= z.protein * .95) r.proteinOk++; }
    t.items.forEach(it => {
      const key = it.food || ('name:' + normName(it.name)), v = posten(it);
      const x = r.foods[key] || (r.foods[key] = { name: (it.food && DATA.foods[it.food] ? DATA.foods[it.food].name : it.name), kcal: 0, g: 0, n: 0 });
      x.kcal += v.kcal; x.g += it.g; x.n++;
    });
  }
  r.schnittKcal = r.geloggt ? r.kcal / r.geloggt : 0;
  r.schnittP = r.geloggt ? r.p / r.geloggt : 0;
  r.schnittDiff = r.mitZiel ? r.diffSumme / r.mitZiel : null;
  /* bodyweight: the weigh-ins of the period so far, and the last one before it (where the shift starts from) */
  r.gewichte = gewichteIn(sc.von, sc.bis < TODAY ? sc.bis : TODAY);
  r.gewichtVorher = gewichtVor(sc.von);
  r.schnittKg = r.gewichte.length ? r.gewichte.reduce((s, x) => s + x.kg, 0) / r.gewichte.length : null;
  return r;
}
/* maintenance, estimated from the log itself (energy balance): over the 28 days up to `bis` (never today, which is still
   being logged), the average intake on logged days minus the bodyweight trend at 7'700 kcal per kg. The trend is the
   least-squares line through the weigh-ins, so one heavy morning moves it little. Needs at least 4 weigh-ins spread
   over 14 days and 10 logged days between the first and the last. The window stays at 28 days on purpose: maintenance
   moves with weight and activity, so older weeks would pull it towards an old figure. The range (about 95 %) narrows
   with more weigh-ins. Days logged incompletely make it read low.
   → { kcal, pm, tage, wiegen, von, bis } or { fehlt: what is missing } */
const KCAL_PRO_KG = 7700, ERH_TAGE = 28;
function erhaltung(bis){
  const ende = bis < TODAY ? bis : ISO(add(P(TODAY), -1)), anfang = ISO(add(P(ende), -(ERH_TAGE - 1)));
  const gw = gewichteIn(anfang, ende), m = gw.length;
  const spanne = m > 1 ? (P(gw[m - 1].iso) - P(gw[0].iso)) / DAY : 0;
  if (m < 4 || spanne < 14) return { fehlt: m ? 'Needs weigh-ins across 2 weeks' : 'Weigh in on Entry to start' };
  let n = 0, k = 0;
  for (let d = P(gw[0].iso); ISO(d) <= gw[m - 1].iso; d = add(d, 1)){ const s = tagSumme(ISO(d)); if (s.n){ n++; k += s.kcal; } }
  if (n < 10) return { fehlt: 'Needs ' + (10 - n) + ' more logged day' + (10 - n === 1 ? '' : 's') };
  const x0 = P(gw[0].iso).getTime(), xs = gw.map(g => (P(g.iso) - x0) / DAY), ys = gw.map(g => g.kg);
  const mx = xs.reduce((s, x) => s + x, 0) / m, my = ys.reduce((s, y) => s + y, 0) / m;
  let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += (x - mx) * (x - mx); sxy += (x - mx) * (ys[i] - my); });
  const steig = sxy / sxx;
  let rest = 0; xs.forEach((x, i) => { const e = ys[i] - (my + steig * (x - mx)); rest += e * e; });
  const fehler = Math.sqrt(rest / Math.max(1, m - 2) / sxx);
  return { kcal: Math.round((k / n - steig * KCAL_PRO_KG) / 10) * 10, pm: Math.max(10, Math.round(2 * fehler * KCAL_PRO_KG / 10) * 10),
    tage: n, wiegen: m, von: gw[0].iso, bis: gw[m - 1].iso, schnitt: k / n, kgProWoche: steig * 7 };
}
/* weeks for the YTD chart: average per logged day and the average target */
function wochen(tage){
  const w = [];
  tage.forEach(t => {
    const mo = ISO(monday(P(t.iso)));
    let x = w[w.length - 1];
    if (!x || x.mo !== mo){ x = { mo, kcal: 0, n: 0, ziel: 0, zn: 0, zukunft: true }; w.push(x); }
    if (!t.zukunft) x.zukunft = false;
    if (t.geloggt){ x.kcal += t.s.kcal; x.n++; if (t.z.kcal){ x.ziel += t.z.kcal; x.zn++; } }
  });
  return w.map(x => ({ mo: x.mo, wert: x.n ? x.kcal / x.n : 0, n: x.n, ziel: x.zn ? x.ziel / x.zn : null, zukunft: x.zukunft }));
}

