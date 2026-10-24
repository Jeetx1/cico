/* ================================================================ files
   Two layers: the working copy in this browser (written on every change, so nothing is lost when the phone
   closes the tab) and your data file (written by Save). The Save button blinks amber while the file is behind. */
const LS_KEY = 'calorieTracker.data.v1';
let FILE = { name: '', handle: null };
let lokalT = null;

function lokalLesen(){ try { const x = JSON.parse(localStorage.getItem(LS_KEY)); return x && x.data && x.data.foods ? x : null; } catch (e){ return null; } }
function lokalSchreiben(sofort){
  clearTimeout(lokalT);
  const tu = () => { try { localStorage.setItem(LS_KEY, JSON.stringify({ at: new Date().toISOString(), name: FILE.name, dirty: S.dirty, data: DATA })); } catch (e){ toast('This browser refused to keep a local copy. Save to your file regularly.', true); } };
  if (sofort) tu(); else lokalT = setTimeout(tu, 250);
}
function aendern(){ S.dirty = true; malSichern(); lokalSchreiben(); }

function dataName(){ return TODAY + '_CICO.json'; }
/* a file opened under the old name (…_CALORIE LOG DATA.json) is not written back into: the picker offers the new name once */
function neuerName(n){ return /_CICO\.json$/i.test(n || ''); }
function lesen(text){
  const t = String(text || '').trim();
  if (t.charAt(0) !== '{') throw new Error('Pick the calorie log .json file.');
  let o; try { o = JSON.parse(t); } catch (e){ throw new Error('The file is not valid JSON.'); }
  if (!o.foods && !o.days) throw new Error('This JSON has no foods or days in it.');
  return normalize(o);
}
function oeffnenUeberEingabe(){
  return new Promise(res => {
    const inp = $('#dateiwahl'); inp.value = '';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return res(null); f.text().then(t => res({ text: t, name: f.name, handle: null })); };
    inp.click();
  });
}
const FSA = !!(window.showSaveFilePicker && window.showOpenFilePicker) && !TOUCH;
async function oeffnen(){
  let got = null;
  if (FSA){
    try {
      const [hd] = await window.showOpenFilePicker({ multiple: false, id: 'calorielog', types: [{ description: 'Calorie log', accept: { 'application/json': ['.json'] } }] });
      const f = await hd.getFile(); got = { text: await f.text(), name: f.name, handle: hd };
    } catch (e){ if (e && e.name === 'AbortError') return; got = await oeffnenUeberEingabe(); }
  } else got = await oeffnenUeberEingabe();
  if (!got) return;
  let d; try { d = lesen(got.text); } catch (e){ toast(e.message, true); return; }
  DATA = d; FILE = { name: got.name, handle: got.handle };
  if (got.handle) idbSchreiben('datei', got.handle);
  S.dirty = false; lokalSchreiben(true);
  starteApp();
  /* a file carries its look: opening it applies it on this device too */
  if (DATA.settings && DATA.settings.theme) Kit.set(DATA.settings.theme, 'file');
  toast('Opened ' + got.name);
}
function neuAnfangen(){ DATA = leer(); FILE = { name: '', handle: null }; S.dirty = true; lokalSchreiben(true); starteApp(); setTimeout(() => zieleDialog(true), 450); }
function weiter(x){
  try { DATA = normalize(x.data); } catch (e){ toast(e.message, true); return; }
  FILE = { name: x.name || '', handle: null }; S.dirty = !!x.dirty;
  idbLesen('datei').then(hd => { if (hd && hd.name === FILE.name) FILE.handle = hd; });
  starteApp();
}

/* ---------- writing: back into the open file where the browser allows it, otherwise a picker / the share sheet */
async function ablegen(blob, name){
  if (FSA){
    try {
      const hd = await window.showSaveFilePicker({ suggestedName: name, id: 'calorielog', types: [{ description: 'Calorie log', accept: { 'application/json': ['.json'] } }] });
      const w = await hd.createWritable(); await w.write(blob); await w.close();
      return { ok: true, name: hd.name, handle: hd };
    } catch (e){ if (e && e.name === 'AbortError') return { ok: false, abort: true }; }
  }
  if (navigator.canShare){
    try {
      const f = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare({ files: [f] })){ await navigator.share({ files: [f] }); return { ok: true, name, shared: true }; }
    } catch (e){ if (e && e.name === 'AbortError') return { ok: false, abort: true }; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 800);
  return { ok: true, name, download: true };
}
function inhalt(){
  DATA.settings = Object.assign({}, DATA.settings, { theme: Kit.theme() });
  DATA.saved = new Date().toISOString();
  const text = JSON.stringify(DATA, null, 1);
  /* read it back before writing: same foods, same days, same entries, or nothing is written */
  const zurueck = normalize(JSON.parse(text));
  const zaehl = d => Object.keys(d.foods).length + '/' + Object.keys(d.days).length + '/' + Object.values(d.days).reduce((s, t) => s + t.items.length, 0);
  if (zaehl(zurueck) !== zaehl(DATA)) throw new Error('Save stopped: the file did not read back the same. Nothing was written.');
  return text;
}
async function speichern(alsKopie){
  let text; try { text = inhalt(); } catch (e){ toast(e.message, true); return; }
  const blob = new Blob([text], { type: 'application/json' });
  /* Save to folder: once a folder is picked (desktop Chrome/Edge), the dated file goes straight in */
  if (!alsKopie && Kit.folder.can){
    const r = await Kit.folder.write(dataName(), blob);
    if (r){ FILE = { name: r.name, handle: null }; return gespeichert(r.name, false, r.folder); }
  }
  if (!alsKopie && FSA && FILE.handle && neuerName(FILE.name)){
    try {
      if (FILE.handle.queryPermission && await FILE.handle.queryPermission({ mode: 'readwrite' }) !== 'granted' &&
          (await FILE.handle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('no access');
      const w = await FILE.handle.createWritable(); await w.write(blob); await w.close();
      return gespeichert(FILE.name);
    } catch (e){ /* fall through to the picker */ }
  }
  const r = await ablegen(blob, alsKopie ? TODAY + '_CICO COPY.json' : dataName());
  if (!r.ok){ if (r.err) toast('Not saved: ' + r.err.message, true); return; }
  if (alsKopie) return toast('Copy saved as ' + r.name);
  if (r.handle){ FILE = { name: r.name, handle: r.handle }; idbSchreiben('datei', r.handle); }
  else FILE.name = r.name;
  gespeichert(r.name, r.shared || r.download);
}
function gespeichert(name, aufsPhone, ordner){
  S.dirty = false; malSichern(); lokalSchreiben(true);
  $('#dateiname').textContent = name;
  document.dispatchEvent(new CustomEvent('dl:saved', { detail: { name } }));
  if (ordner) toast('Saved to ' + ordner, false, name);
  else toast(aufsPhone ? 'Saved as ' + name + '. Keep it in Files or OneDrive.' : 'Saved to ' + name);
}
async function ordnerWaehlen(){
  try { await Kit.folder.choose(); }
  catch (e){ if (!e || e.name !== 'AbortError') toast('This browser did not give access to that folder.', true); return; }
  speichern();
}
function malSichern(){
  const b = $('#sichern'); if (!b) return;
  b.classList.toggle('is-dirty', S.dirty);
  $('.btn__label', b).textContent = S.dirty ? 'Save' : 'Saved';
  b.title = S.dirty ? 'Changes are kept in this browser. Save writes them to your data file.' : 'Your data file is up to date.';
}
window.addEventListener('beforeunload', e => { if (DATA && S.dirty){ lokalSchreiben(true); e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.hidden && DATA) lokalSchreiben(true); });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && DATA){ e.preventDefault(); speichern(); } });

/* remembers the file handle between visits (Chrome / Edge on a computer) */
function idb(){ return new Promise((ok, nein) => { const r = indexedDB.open('calorielog', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => nein(r.error); }); }
async function idbLesen(k){ try { if (!window.indexedDB) return null; const db = await idb(); return await new Promise(ok => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => ok(t.result); t.onerror = () => ok(null); }); } catch (e){ return null; } }
async function idbSchreiben(k, v){ try { if (!window.indexedDB) return; const db = await idb(); db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e){} }

