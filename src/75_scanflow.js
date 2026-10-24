/* ================================================================ scanning: photo -> code -> your food
   ziel: 'log' (Entry: log the food), 'food' (Foods: open the food), or a function that receives the code (a form field). */
function scanStarten(ziel, quelle){
  const inp = $(quelle === 'datei' ? '#fotowahl' : '#kamera');
  inp.value = '';
  inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) fotoLesen(f, ziel); };
  inp.click();
}
function bildLaden(datei){
  return new Promise((ok, nein) => {
    const u = URL.createObjectURL(datei), img = new Image();
    img.onload = () => ok({ img, u });
    img.onerror = () => { URL.revokeObjectURL(u); nein(new Error('This file is not a picture the browser can open.')); };
    img.src = u;
  });
}
/* grey pixels at a given size (photos arrive upright: browsers apply the camera's orientation when drawing) */
function grauBild(img, maxSeite){
  const f = Math.min(1, maxSeite / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * f)), hh = Math.max(1, Math.round(img.naturalHeight * f));
  const c = document.createElement('canvas'); c.width = w; c.height = hh;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, hh);
  return { grau: grauVon(g.getImageData(0, 0, w, hh).data, w * hh), w, h: hh };
}
/* the middle of the photo first (where people aim), then the whole picture at two sizes */
function codeSuchen(img){
  const versuche = [[1280, null], [1800, .55], [820, null], [2400, .4]];
  for (const [max, ausschnitt] of versuche){
    let b = grauBild(img, max);
    if (ausschnitt){
      const w = Math.round(b.w * ausschnitt), hh = Math.round(b.h * ausschnitt), x0 = (b.w - w) >> 1, y0 = (b.h - hh) >> 1, g = new Uint8Array(w * hh);
      for (let y = 0; y < hh; y++) g.set(b.grau.subarray((y + y0) * b.w + x0, (y + y0) * b.w + x0 + w), y * w);
      b = { grau: g, w, h: hh };
    }
    const r = eanBild(b.grau, b.w, b.h);
    if (r) return r.code;
  }
  return null;
}
async function fotoLesen(datei, ziel){
  const lade = h('div', { class: 'lade' }, [h('div', { class: 'spinner' }), h('span', {}, ['Reading the barcode\u2026'])]);
  const d = blatt('Scan', null, lade);
  let geladen;
  try { geladen = await bildLaden(datei); } catch (e){ d.zu(); toast(e.message, true); return; }
  await new Promise(r => setTimeout(r, 40));            /* let the sheet paint before the work starts */
  let code = null;
  try { code = codeSuchen(geladen.img); } catch (e){ code = null; }
  if (code){ URL.revokeObjectURL(geladen.u); d.zu(); codeGefunden(code, ziel); return; }
  /* nothing found: show the photo, offer a retake or typing */
  const body = h('div', {}, [
    h('img', { class: 'foto', src: geladen.u, alt: 'Your photo' }),
    h('p', { class: 'hinweis' }, ['No barcode found in this photo. Hold the phone parallel to the pack, close enough that the code fills about half the width, and keep it sharp.']),
    h('div', { class: 'aktion' }, [
      h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => { d.zu(); codeTippen(ziel); } }, ['Type the number']),
      h('button', { type: 'button', class: 'btn btn--primary', onclick: () => { d.zu(); scanStarten(ziel); } }, ['Take another photo'])
    ])
  ]);
  d.box.querySelector('.lade').replaceWith(body);
  d.box.querySelector('h2').textContent = 'Could not read it';
}
function codeGueltig(c){
  if (/^\d{12}$/.test(c)) c = '0' + c;
  if (!/^(\d{8}|\d{13})$/.test(c)) return null;
  return eanPruef(c.split('').map(Number)) ? c : null;
}
function codeTippen(ziel){
  const inp = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'The digits under the bars', autocomplete: 'off', class: 'code', enterkeyhint: 'done' });
  const hinweis = h('p', { class: 'hinweis', hidden: true });
  const ok = h('button', { type: 'button', class: 'btn btn--primary' }, ['Use this code']);
  const pruefe = () => {
    const roh = inp.value.replace(/\D/g, ''), c = codeGueltig(roh);
    if (c){ d.zu(); codeGefunden(c, ziel); return; }
    hinweis.hidden = false;
    hinweis.textContent = roh.length === 8 || roh.length === 12 || roh.length === 13 ? 'The check digit does not match. One of the digits is probably mistyped.' : 'A barcode on food has 8 or 13 digits (12 on some imports).';
  };
  ok.onclick = pruefe; inp.onkeydown = e => { if (e.key === 'Enter') pruefe(); };
  const body = h('div', {}, [h('label', { class: 'feld' }, [h('span', {}, ['Barcode']), inp]), hinweis, h('div', { class: 'aktion' }, [ok])]);
  const d = blatt('Type the barcode', 'All digits, including the small ones at the edges.', body, { fokus: 'input' });
}
function codeGefunden(code, ziel){
  if (typeof ziel === 'function') return ziel(code);
  const f = foodNachCode(code);
  if (f){ if (ziel === 'food') foodEditor(f); else logSheet(f); return; }
  foodEditor({ barcode: code, made: 'scan' }, { danach: ziel === 'log' ? 'log' : null, neuGescannt: true });
}

