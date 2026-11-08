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

