/* ================================================================ the posting moment: small, because it happens several times a day */
const SPRUECHE = [
  ['Posted.', 'Debit stomach, credit fridge.'],
  ['Booked.', 'Accrued, not deferred.'],
  ['Entry approved.', 'Reconciled with the plate.'],
  ['Recognised in full.', 'No provision for second helpings.'],
  ['Logged.', 'The audit trail is delicious.'],
  ['Journal entry posted.', 'Materiality: one plate.'],
  ['Booked.', 'Four-eyes principle: you and the label.'],
  ['Posted to the ledger.', 'Fairly presented, in all material respects.'],
  ['Cleared.', 'No open items on this plate.'],
  ['Booked.', 'Supported by documentation (the packaging).']
];
let letzterSpruch = -1;
function gebucht(neu, iso){
  let i; do { i = Math.floor(Math.random() * SPRUECHE.length); } while (i === letzterSpruch && SPRUECHE.length > 1);
  letzterSpruch = i;
  const v = posten(neu), s = tagSumme(iso), z = zielVon(iso), vorher = s.p - v.p;
  let [a, b] = SPRUECHE[i];
  if (z.protein && vorher < z.protein && s.p >= z.protein){ a = 'Protein target reached.'; b = 'Fully funded for ' + (iso === TODAY ? 'today' : tagKurz(iso)) + '.'; }
  toast(a + ' ' + neu.name + ', ' + tsd(v.kcal) + ' kcal', false, b);
  plusFliegt(v.kcal);
}
/* THE BITE (signature): the kcal fly from where you tapped into the day's ring, the ring swallows them with a pulse
   and its arcs grow from the old total to the new one. Glass sends an ice droplet, Ember a spark, Prism a beam.
   Switched off (or with reduced motion), the classic "+312" rises over the ring instead. */
let BISS = null, LAST_TAP = null;
const BISS_DELAY = 820, BISS_START = 140, BISS_FLUG = 640;
document.addEventListener('pointerdown', e => { LAST_TAP = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
function bissVorbereiten(iso){ BISS = BEWEGUNG && Kit.isOn('bite') ? { iso, s: tagSumme(iso), t: Date.now() } : null; }
function bissFuer(iso){ return BISS && BISS.iso === iso && Date.now() - BISS.t < 2500 ? BISS : null; }
function plusFliegt(kcal){
  const bs = BISS; BISS = null;
  if (!BEWEGUNG) return;
  const ring = $('#p-entry .tagsumme .ringe'), r = ring && ring.getBoundingClientRect();
  const sichtbar = !!(r && r.width && r.bottom > 40 && r.top < window.innerHeight - 40);
  if (bs && sichtbar){ try { biss(kcal, ring, r); return; } catch (e){ /* decoration only: fall back to the classic */ } }
  setTimeout(() => {
    let x, y;
    if (sichtbar){ x = r.left + r.width / 2; y = r.top + r.height * .25; }
    else { const t = LAST_TAP && Date.now() - LAST_TAP.t < 4000 ? LAST_TAP : { x: window.innerWidth / 2, y: window.innerHeight * .6 }; x = t.x; y = t.y - 20; }
    const el = h('div', { class: 'plus' }, ['+' + tsd(kcal)]);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 1400);
  }, 260);
}
function biss(kcal, ring, r){
  const tap = LAST_TAP && Date.now() - LAST_TAP.t < 4000 ? LAST_TAP : { x: window.innerWidth / 2, y: window.innerHeight * .8 };
  const x0 = tap.x, y0 = tap.y, x1 = r.left + r.width / 2, y1 = r.top + r.height / 2;
  /* a gentle arc: the control point sits above the straight line */
  const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - Math.max(50, Math.abs(x1 - x0) * .22 + Math.abs(y1 - y0) * .12);
  const pt = t => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  const N = 10, a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
  const bahn = (gr, op) => { const f = []; for (let i = 0; i <= N; i++){ const t = i / N, p = pt(t);
    f.push({ transform: 'translate3d(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px,0) scale(' + (gr * (i === 0 ? .4 : 1 - t * .45)).toFixed(3) + ')', opacity: i === 0 || i === N ? 0 : op }); } return f; };
  const flieg = (cls, gr, op, spaeter, label) => {
    const el = h('div', { class: 'biss' + cls }, [h('i'), label ? h('b', {}, ['+' + tsd(kcal)]) : null]);
    el.style.setProperty('--a', a.toFixed(1) + 'deg'); el.style.opacity = '0';
    document.body.appendChild(el);
    const an = el.animate(bahn(gr, op), { duration: BISS_FLUG, delay: BISS_START + spaeter, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' });
    an.onfinish = () => el.remove(); setTimeout(() => el.remove(), BISS_START + spaeter + BISS_FLUG + 400);
  };
  flieg(' geist', .55, .25, 90, false);
  flieg(' geist', .75, .5, 45, false);
  flieg('', 1, 1, 0, kcal >= 1);
  setTimeout(() => {
    if (!ring.isConnected) return;
    ring.classList.remove('schluck'); void ring.offsetWidth; ring.classList.add('schluck');
    const w = h('span', { class: 'welle', 'aria-hidden': 'true' }); ring.appendChild(w);
    setTimeout(() => { w.remove(); ring.classList.remove('schluck'); }, 950);
  }, BISS_START + BISS_FLUG - 40);
}

/* DAY LEVEL (optional extra): the background fills like a glass with the day's kcal; a fine line marks the target
   at 78 % of the screen, and the colour warms once the day is past it. Entry follows the day you look at. */
function pegel(){
  const el = $('#pegel'); if (!el) return;
  const an = !!DATA && !$('#shell').hidden && Kit.isOn('daylevel');
  el.classList.toggle('an', an);
  if (!DATA) return;
  const iso = S.tab === 'foods' ? TODAY : S.tag, z = zielVon(iso), bs = bissFuer(iso);
  const setze = s => {
    const p = z.kcal ? s.kcal / z.kcal : 0, L = Math.min(1.12, p) * .78;
    el.classList.toggle('ohneziel', !z.kcal); el.classList.toggle('ueber', !!z.kcal && p > 1);
    $('.pegel__fill', el).style.transform = 'translate3d(0,' + ((1 - L) * 100).toFixed(2) + '%,0)';
  };
  if (bs && an){ setze(bs.s); setTimeout(() => setze(tagSumme(iso)), BISS_DELAY); }
  else setze(tagSumme(iso));
}
const SPRUECHE_KOPIE = [
  ['Recurring entry posted.', 'Same as last period. The auditor approves.'],
  ['Prior-period template applied.', 'Consistency principle, honoured.'],
  ['Standing order executed.', 'Your stomach has a direct debit.'],
  ['Rolled forward.', 'Opening balance = closing balance. Textbook.']
];

