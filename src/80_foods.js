/* ================================================================ Foods: everything you scanned or typed */
function seiteFoods(){
  const root = $('#p-foods'); root.innerHTML = '';
  const alle = foodListe(), use = gebrauch();
  root.appendChild(h('div', { class: 'seitenkopf' }, [
    h('div', {}, [h('h2', {}, ['Foods']), h('p', {}, [alle.length ? plural(alle.length, 'food') + ', values per 100 g or ml' : 'Your own food list, built one scan at a time'])]),
    h('div', { class: 'perioden' }, [
      h('button', { type: 'button', class: 'chip chip--filter', onclick: () => foodEditor({}), html: icon(IC.plus, 15) + '<span>Add by hand</span>' }),
      h('button', { type: 'button', class: 'chip chip--filter is-on', onclick: () => scanStarten('food'), html: icon(IC.scan, 16) + '<span>Scan</span>' })
    ])
  ]));
  const liste = h('div', { class: 'glas card foodliste' });
  const zaehler = h('div', { class: 'zaehler' });
  const suche = h('input', { type: 'search', placeholder: 'Name, brand or barcode', value: S.foodSuche, autocomplete: 'off', 'aria-label': 'Search foods' });
  suche.oninput = () => { S.foodSuche = suche.value; mal(); };
  root.appendChild(h('div', { class: 'werkzeug' }, [
    h('label', { class: 'suche' }, [h('span', { html: icon(IC.suche, 18) }), suche]),
    segment([['used', 'Most used'], ['az', 'A\u2013Z'], ['new', 'Newest']], S.foodSort, s => { S.foodSort = s; mal(); })
  ]));
  root.appendChild(zaehler);
  root.appendChild(liste);
  function mal(){
    liste.innerHTML = '';
    const q = S.foodSuche.trim();
    let l = alle.map(f => ({ f, s: treffer(f, q) })).filter(x => x.s);
    const n = x => (use[x.f.id] || {}).n || 0;
    if (S.foodSort === 'az') l.sort((a, b) => a.f.name.localeCompare(b.f.name));
    else if (S.foodSort === 'new') l.sort((a, b) => String(b.f.created || '').localeCompare(String(a.f.created || '')));
    else l.sort((a, b) => n(b) - n(a) || a.f.name.localeCompare(b.f.name));
    if (q) l.sort((a, b) => b.s - a.s);
    zaehler.textContent = q ? plural(l.length, 'match', 'matches') : '';
    if (!alle.length){
      liste.appendChild(h('div', { class: 'leer-hinweis' }, [h('b', {}, ['No foods yet']), 'Scan a pack and type the values from its label once. After that it is one tap away.',
        h('div', { style: { marginTop: '16px' } }, [h('button', { type: 'button', class: 'btn btn--primary', onclick: () => scanStarten('food'), html: icon(IC.scan, 18) + '<span>Scan the first one</span>' })])]));
      return;
    }
    if (!l.length){ liste.appendChild(h('div', { class: 'leer-hinweis' }, ['Nothing matches \u201c' + q + '\u201d.'])); return; }
    l.forEach(({ f }) => {
      const u = use[f.id];
      liste.appendChild(h('button', { type: 'button', class: 'food', onclick: () => foodEditor(f) }, [
        h('span', { class: 'nm' }, [f.fav ? h('span', { html: icon(IC.stern, 14), style: { color: 'var(--blau)', display: 'inline-flex' } }) : null, h('span', {}, [f.name])]),
        h('span', { class: 'sub' }, [[f.brand, f.barcode ? f.barcode : 'no barcode', u ? plural(u.n, 'entry', 'entries') : 'not logged yet'].filter(Boolean).join(', ')]),
        h('span', { class: 'makros' }, MAKRO.map(m => h('span', {}, [h('i', { style: { background: m.farbe } }), g1(f[m.id]) + ' g ' + m.name.toLowerCase()]))),
        h('span', { class: 'kc' }, [h('b', {}, [tsd(f.k)]), h('small', {}, ['kcal / 100 ' + f.unit])])
      ]));
    });
  }
  mal(); pegel();
}

/* ---------- the food form. Values per 100 g (or ml), straight from the label. */
function foodEditor(f, opt){
  opt = opt || {};
  const neu = !f.id, e = Object.assign({ name: '', brand: '', barcode: '', unit: 'g', k: null, p: null, c: null, f: null, portion: null, fav: false, made: 'manual' }, klon(f));
  const feld = (label, wert, attrs, einheit) => {
    const inp = h('input', Object.assign({ type: 'text', value: wert == null ? '' : String(wert) }, attrs || {}));
    return { inp, el: h('label', { class: 'feld' }, [h('span', {}, [label]), einheit ? h('div', { class: 'mit' }, [inp, h('em', {}, [einheit])]) : inp]) };
  };
  const name = feld('Name', e.name, { placeholder: 'e.g. Skyr nature', autocomplete: 'off' });
  const brand = feld('Brand', e.brand, { placeholder: 'optional', autocomplete: 'off' });
  const code = feld('Barcode', e.barcode, { inputmode: 'numeric', placeholder: 'optional', class: 'code', autocomplete: 'off' });
  const zahl = { inputmode: 'decimal', placeholder: '0', autocomplete: 'off' };
  const k = feld('Energy', e.k, zahl, 'kcal'), p = feld('Protein', e.p, zahl, 'g'), c = feld('Carbs', e.c, zahl, 'g'), fe = feld('Fat', e.f, zahl, 'g');
  const pName = feld('Portion name', e.portion ? e.portion.name : '', { placeholder: 'e.g. cup, slice', autocomplete: 'off' });
  const pG = feld('Portion size', e.portion ? e.portion.g : '', zahl, e.unit);
  const fav = h('input', { type: 'checkbox', checked: e.fav ? 'checked' : null, role: 'switch' });
  const pruef = h('div');
  const pro = h('div', { class: 'unterkopf', style: { margin: '10px 2px 8px' } }, [h('span', {}, ['Per 100 ' + e.unit + ', as on the label'])]);
  const einheit = segment([['g', 'Per 100 g'], ['ml', 'Per 100 ml']], e.unit, u => { e.unit = u; pro.firstChild.textContent = 'Per 100 ' + u + ', as on the label'; pG.el.querySelector('em').textContent = u; });
  const scanKlein = h('button', { type: 'button', class: 'chip chip--filter', style: { alignSelf: 'end', marginBottom: '12px', height: '48px', borderRadius: 'var(--r-control)' }, 'aria-label': 'Scan the barcode', html: icon(IC.scan, 18),
    onclick: () => scanStarten(cd => { code.inp.value = cd; pruefen(); }) });

  /* plausibility, said once and plainly: kJ typed as kcal, label kcal far from the macros */
  let behalten = null;                                            /* label kcal you confirmed despite the gap */
  const abweichung = (kv, ausM) => Math.abs(kv - ausM) > Math.max(3, kv * .02);
  function pruefen(){
    pruef.innerHTML = '';
    const kv = zahlLesen(k.inp.value), pv = zahlLesen(p.inp.value) || 0, cv = zahlLesen(c.inp.value) || 0, fv = zahlLesen(fe.inp.value) || 0;
    const ausM = kcalAusMakros(pv, cv, fv);
    if (kv !== null && kv > 900){
      pruef.appendChild(h('p', { class: 'hinweis' }, ['More than pure fat has (900 kcal). That looks like kJ: ' + tsd(kv) + ' kJ is ' + tsd(kv / 4.184) + ' kcal.',
        h('button', { type: 'button', onclick: () => { k.inp.value = String(Math.round(kv / 4.184)); pruefen(); } }, ['Use ' + tsd(kv / 4.184)])]));
    } else if (kv === null && ausM > 0){
      pruef.appendChild(h('p', { class: 'hinweis' }, ['No kcal typed. The macros add up to ' + tsd(ausM) + ' kcal.',
        h('button', { type: 'button', onclick: () => { k.inp.value = String(Math.round(ausM)); pruefen(); } }, ['Use that'])]));
    } else if (kv !== null && ausM > 0 && abweichung(kv, ausM)){
      /* more than 2 % apart (3 kcal minimum, for rounding on light foods): saving waits until you pick one */
      const proz = Math.round(Math.abs(kv - ausM) / kv * 100);
      if (behalten === kv) pruef.appendChild(h('p', { class: 'hinweis ruhig' }, ['Label value ' + tsd(kv) + ' kept. The macros give ' + tsd(ausM) + ' kcal (' + proz + ' % apart).']));
      else pruef.appendChild(h('p', { class: 'hinweis warn' }, [
        'The macros add up to ' + tsd(ausM) + ' kcal, the label says ' + tsd(kv) + ': ' + proz + ' % apart. Check the numbers for a typo. Fibre (2 kcal/g) or alcohol (7 kcal/g) can explain a real gap.',
        h('div', { class: 'knoepfe' }, [
          h('button', { type: 'button', class: 'haupt', onclick: () => { k.inp.value = String(Math.round(ausM)); pruefen(); } }, ['Use ' + tsd(ausM)]),
          h('button', { type: 'button', onclick: () => { behalten = kv; pruefen(); } }, ['Keep ' + tsd(kv)])
        ])]));
    }
    if (pv + cv + fv > 100.5) pruef.appendChild(h('p', { class: 'hinweis' }, ['Protein, carbs and fat add up to more than 100 g per 100 ' + e.unit + '. One of them is off.']));
    const cd = code.inp.value.replace(/\D/g, '');
    if (cd && !codeGueltig(cd)) pruef.appendChild(h('p', { class: 'hinweis' }, ['This barcode does not pass its check digit. Rescan it or check the digits.']));
    else if (cd){ const da = foodNachCode(codeGueltig(cd)); if (da && da.id !== f.id) pruef.appendChild(h('p', { class: 'hinweis' }, ['This barcode already belongs to ' + da.name + '.'])); }
    const offen = kv !== null && kv <= 900 && ausM > 0 && abweichung(kv, ausM) && behalten !== kv;
    speichernBtn.disabled = !name.inp.value.trim() || (kv === null && !(ausM > 0)) || offen;
  }
  [k, p, c, fe, code, name].forEach(x => x.inp.addEventListener('input', pruefen));

  const speichernBtn = h('button', { type: 'button', class: 'btn btn--primary' }, [opt.danach === 'log' ? 'Save and log' : 'Save']);
  speichernBtn.onclick = () => {
    const kv = zahlLesen(k.inp.value), pv = zahlLesen(p.inp.value) || 0, cv = zahlLesen(c.inp.value) || 0, fv = zahlLesen(fe.inp.value) || 0;
    const cd = codeGueltig(code.inp.value.replace(/\D/g, '')) || '';
    const da = cd && foodNachCode(cd);
    if (da && da.id !== f.id){ toast('That barcode already belongs to ' + da.name + '.', true); return; }
    const pgv = zahlLesen(pG.inp.value);
    const werte = { name: name.inp.value.trim(), brand: brand.inp.value.trim(), barcode: cd, unit: e.unit,
      k: kv === null ? Math.round(kcalAusMakros(pv, cv, fv)) : kv, p: pv, c: cv, f: fv,
      portion: pgv > 0 ? { name: pName.inp.value.trim() || 'Portion', g: pgv } : null, fav: fav.checked };
    if (werte.k > 1000 || pv > 100 || cv > 100 || fv > 100){ toast('Values are per 100 ' + e.unit + ': kcal up to 900, each macro up to 100 g.', true); return; }
    const jetzt = new Date().toISOString();
    if (neu){
      const id = neueId();
      DATA.foods[id] = Object.assign({}, werte, { made: f.made === 'scan' || opt.neuGescannt ? 'scan' : 'manual', created: jetzt, updated: jetzt });
      d.zu(); aendern();
      const gespeichert = Object.assign({ id }, DATA.foods[id]);
      if (opt.danach === 'log') logSheet(gespeichert, opt.logOpt);
      else { malSeite(); toast('Added ' + werte.name, false, werte.barcode ? 'Scan it next time and it is ready.' : null); }
      return;
    }
    const alt = DATA.foods[f.id], werteGeaendert = ['k', 'p', 'c', 'f'].some(x => Math.abs((alt[x] || 0) - werte[x]) > 1e-9);
    const nameGeaendert = alt.name !== werte.name || (alt.brand || '') !== werte.brand;
    const anwenden = (auchVergangenheit) => {
      DATA.foods[f.id] = Object.assign({}, alt, werte, { updated: jetzt });
      let n = 0;
      for (const iso in DATA.days) DATA.days[iso].items.forEach(it => {
        if (it.food !== f.id) return;
        if (nameGeaendert){ it.name = werte.name; it.brand = werte.brand; }
        if (auchVergangenheit && werteGeaendert){ it.k = werte.k; it.p = werte.p; it.c = werte.c; it.f = werte.f; n++; }
      });
      d.zu(); aendern(); malSeite();
      toast('Saved ' + werte.name, false, n ? plural(n, 'logged entry', 'logged entries') + ' updated too.' : null);
    };
    const nE = eintraegeVon(f.id);
    if (werteGeaendert && nE){
      bestaetigen({ titel: 'Update logged entries too?', text: werte.name + ' is in ' + plural(nE, 'logged entry', 'logged entries') + '. They keep the old values unless you update them, for example to fix a typo.',
        nein: 'Only from now on', beiNein: () => anwenden(false), jaText: 'Update ' + plural(nE, 'entry', 'entries'), ja: () => anwenden(true) });
    } else anwenden(false);
  };

  const body = h('div', {}, [
    opt.neuGescannt ? h('p', { class: 'hinweis' }, ['New barcode ', h('span', { class: 'code' }, [e.barcode]), '. Type the values from the label once; next time this code is all it takes.']) : null,
    name.el,
    brand.el,
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' } }, [code.el, scanKlein]),
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, [pro, einheit]),
    h('div', { class: 'felder4' }, [k.el, p.el, c.el, fe.el]),
    pruef,
    h('div', { class: 'felder2' }, [pName.el, pG.el]),
    h('label', { class: 'switch einzeln' }, [h('span', {}, [h('b', {}, ['Favourite']), h('small', {}, ['Shown at the top on Entry'])]), fav]),
    h('div', { class: 'aktion' }, [
      !neu ? h('button', { type: 'button', class: 'btn btn--quiet-danger links', onclick: () => {
        const nE = eintraegeVon(f.id);
        bestaetigen({ titel: 'Delete ' + f.name + '?', text: nE ? 'Its ' + plural(nE, 'logged entry', 'logged entries') + ' stay in your log with their values. Only the food disappears from this list.' : 'It is not in your log anywhere.',
          gefahr: true, jaText: 'Delete food', ja: () => { delete DATA.foods[f.id]; for (const iso in DATA.days) DATA.days[iso].items.forEach(it => { if (it.food === f.id) it.food = null; }); d.zu(); aendern(); malSeite(); toast('Deleted ' + f.name); } });
      } }, ['Delete']) : null,
      !neu && opt.danach !== 'log' ? h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => { d.zu(); S.tag = S.tab === 'entry' ? S.tag : TODAY; logSheet(Object.assign({ id: f.id }, DATA.foods[f.id]), { iso: S.tag }); } }, ['Log it']) : null,
      speichernBtn
    ])
  ]);
  const d = blatt(neu ? (opt.neuGescannt ? 'New food' : 'Add a food') : 'Edit food', neu ? null : (f.made === 'scan' ? 'Added by scanning' : 'Added by hand') + (f.created ? ' on ' + tagKurz(f.created.slice(0, 10)) : ''), body,
    { fokus: TOUCH ? null : (e.name ? '.felder4 input' : 'input') });
  pruefen();
}

