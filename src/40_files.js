/* ================================================================ files
   Two layers: the working copy in this browser (written on every change, so nothing is lost when the phone
   closes the tab) and your data file (written by Save). The Save button blinks amber while the file is behind. */
const LS_KEY = 'calorieTracker.data.v1';
let FILE = { name: '', handle: null };
let lokalT = null;

function lokalLesen(){ try { const x = JSON.parse(localStorage.getItem(LS_KEY)); return x && x.data && x.data.foods ? x : null; } catch (e){ return null; } }
function lokalSchreiben(sofort){
  clearTimeout(lokalT);
  const tu = () => { try { localStorage.setItem(LS_KEY, JSON.stringify({ at: new Date().toISOString(), name: FILE.name, basis: FILE.basis, dirty: S.dirty, data: DATA })); } catch (e){ toast('This browser refused to keep a local copy. Save to your file regularly.', true); } };
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
  /* basis: the file's own "saved" stamp when it was opened; Save compares it with the file on disk (fremdGespeichert) */
  DATA = d; FILE = { name: got.name, handle: got.handle, basis: d.saved || null };
  if (got.handle) idbSchreiben('datei', got.handle);
  S.dirty = false; lokalSchreiben(true);
  starteApp();
  /* a file carries its look: opening it applies it on this device too */
  if (DATA.settings && DATA.settings.theme) Kit.set(DATA.settings.theme, 'file');
  toast('Opened ' + got.name);
}
function neuAnfangen(){ DATA = leer(); FILE = { name: '', handle: null, basis: null }; S.dirty = true; lokalSchreiben(true); starteApp(); setTimeout(() => zieleDialog(true), 450); }
function weiter(x){
  try { DATA = normalize(x.data); } catch (e){ toast(e.message, true); return; }
  FILE = { name: x.name || '', handle: null, basis: x.basis }; S.dirty = !!x.dirty;
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
const zaehl = d => Object.keys(d.foods).length + '/' + Object.keys(d.days).length + '/' + Object.values(d.days).reduce((s, t) => s + t.items.length, 0) + '/' + Object.keys(d.weights || {}).length;
function inhalt(){
  DATA.settings = Object.assign({}, DATA.settings, { theme: Kit.theme() });
  DATA.saved = new Date().toISOString();
  const text = JSON.stringify(DATA, null, 1);
  /* read it back before writing: same foods, same days, same entries, or nothing is written */
  const zurueck = normalize(JSON.parse(text));
  if (zaehl(zurueck) !== zaehl(DATA)) throw new Error('Save stopped: the file did not read back the same. Nothing was written.');
  return text;
}
/* a written file reads back right: same foods, days and entries as this window */
function liestZurueck(t){ try { return zaehl(normalize(JSON.parse(t))) === zaehl(DATA); } catch (e){ return false; } }
function stempel(t){ try { return JSON.parse(t).saved || null; } catch (e){ return null; } }
/* the data files a save to the app folder replaces (moved to the backup folder): today's name, the old name, the " 1" /
   " (1)" an iPhone save adds. Copies stay where they are */
function istDatendatei(n){ return /\.json$/i.test(n) && !/COPY/i.test(n) && (/_CICO( \d+| \(\d+\))?\.json$/i.test(n) || /CALORIE LOG DATA/i.test(n)); }
const wannText = s => s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
/* Was the file saved again since this window opened it (on the iPhone, in another window)? Its own "saved" stamp is
   compared with the one this window started from, so a OneDrive sync that only touches the file date does not count.
   null: nothing to worry about (also when the file is gone or cannot be read with the access we have). */
async function fremdGespeichert(hd){
  if (FILE.basis === undefined) return null;
  let text;
  try { text = await (await hd.getFile()).text(); } catch (e){ return null; }
  try { const o = JSON.parse(text), s = o && o.saved || null; return s !== (FILE.basis || null) ? { saved: s } : null; }
  catch (e){ return { saved: null }; }
}
/* three choices, the safe one on top: 'ersetzen' (replace it), 'neu' (save as a new file) or null (cancel) */
function dreiWege(titel, text, hinweis){
  return new Promise(ok => {
    let wahl = null;
    const body = h('div', {}, [
      h('p', { style: { margin: '0 0 6px', color: 'var(--t2)' } }, [text]),
      hinweis ? h('p', { style: { margin: '0 0 6px', color: 'var(--t3)', fontSize: '13px' } }, [hinweis]) : null,
      h('div', { class: 'aktion drei' }, [
        h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => d.zu() }, ['Cancel']),
        h('button', { class: 'btn btn--danger', type: 'button', onclick: () => { wahl = 'ersetzen'; d.zu(); } }, ['Replace it']),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => { wahl = 'neu'; d.zu(); } }, ['Save as a new file'])
      ])
    ]);
    const d = blatt(titel, 'Your changes here are not lost either way', body, { beimSchliessen: () => ok(wahl) });
  });
}
function konfliktFrage(name, saved){
  return dreiWege('Saved elsewhere since you opened it', name + ' was saved again' + (saved ? ' on ' + wannText(saved) : '') + ' after you opened it here, on your iPhone or in another window. Saving now would replace that version.');
}
/* Save to folder asks when the app folder holds a newer data file, or today's file that is not this window's version */
function ordnerFrage(f){
  const liste = f.files.map(x => x.name + (x.stamp ? ' (saved ' + wannText(x.stamp) + ')' : '')).join(', ');
  return f.kind === 'newer'
    ? dreiWege('Saved elsewhere since you opened it', liste + ' in “' + f.folder + '” was saved after the version you have here, on your iPhone or in another window.',
        'Replace it: that file goes to the backup folder and this version takes its place. Save as a new file: this version goes next to it as a copy.')
    : dreiWege('Today’s file is already there', liste + ' is already in “' + f.folder + '” and is not the version you have here.',
        'Replace it: the old one goes to the backup folder. Save as a new file: this version goes next to it as a copy.');
}
async function speichern(alsKopie){
  let text; try { text = inhalt(); } catch (e){ toast(e.message, true); return; }
  const blob = new Blob([text], { type: 'application/json' });
  let neu = false;
  /* Save to folder (desktop Chrome/Edge, once the app folder is chosen): today's file into the app folder, the data files
     it replaces into the backup folder (Kit.folder.save) */
  if (!alsKopie && Kit.folder.can && await Kit.folder.get()){
    let r;
    try {
      r = await Kit.folder.save({ name: dataName(), text, copyName: TODAY + '_CICO COPY.json', basis: FILE.basis,
        isData: istDatendatei, stamp: stempel, check: liestZurueck, ask: ordnerFrage });
    } catch (e){ toast('Not saved to the folder: ' + (e && e.message || e), true); return; }
    if (r.cancel) return;
    if (r.missing || r.denied){
      toast(r.missing ? '“' + r.folder + '” cannot be found any more. Moved or renamed? Choose it again.' : 'No access to “' + r.folder + '”. Choose it again.', true);
      return ordnerDialog();
    }
    FILE = { name: r.name, handle: r.handle, basis: FILE.basis }; idbSchreiben('datei', r.handle);
    return gespeichert(r.name, false, r);
  }
  if (!alsKopie && !neu && FSA && FILE.handle && neuerName(FILE.name)){
    try {
      if (FILE.handle.queryPermission && await FILE.handle.queryPermission({ mode: 'readwrite' }) !== 'granted' &&
          (await FILE.handle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('no access');
      const f = await fremdGespeichert(FILE.handle);
      const w = f ? await konfliktFrage(FILE.name, f.saved) : 'ersetzen';
      if (!w) return;
      if (w === 'ersetzen'){
        const sw = await FILE.handle.createWritable(); await sw.write(blob); await sw.close();
        return gespeichert(FILE.name);
      }
    } catch (e){ /* fall through to the picker */ }
  }
  /* a copy, or "Save as a new file" after a conflict: the copy name, so the picker never suggests the other version's name */
  const r = await ablegen(blob, alsKopie || neu ? TODAY + '_CICO COPY.json' : dataName());
  if (!r.ok){ if (r.err) toast('Not saved: ' + r.err.message, true); return; }
  if (alsKopie) return toast('Copy saved as ' + r.name);
  if (r.handle){ FILE = { name: r.name, handle: r.handle }; idbSchreiben('datei', r.handle); }
  else FILE.name = r.name;
  gespeichert(r.name, r.shared || r.download);
}
function gespeichert(name, aufsPhone, ordner){
  S.dirty = false; FILE.basis = DATA.saved || null; malSichern(); lokalSchreiben(true);
  $('#dateiname').textContent = name;
  document.dispatchEvent(new CustomEvent('dl:saved', { detail: { name } }));
  if (ordner) toast('Saved to ' + ordner.folder, false, name + (ordner.moved.length ? ' · moved to ' + ordner.backup + ': ' + ordner.moved.map(m => m[0]).join(', ') : '') +
    (ordner.noBackup ? ' · choose a backup folder to move the older files' : ''));
  else toast(aufsPhone ? 'Saved as ' + name + '. Keep it in Files or OneDrive.' : 'Saved to ' + name);
}
/* Save to folder (desktop): the app folder (e.g. OneDrive › APPS › CICO) and the backup folder (its 02 BACKUP) */
async function ordnerDialog(){
  const app = await Kit.folder.get(), bk = await Kit.folder.backup();
  const waehle = async (wahl, was, alt) => {
    let neu;
    try { neu = await wahl(); }
    catch (e){ if (!e || e.name !== 'AbortError') toast(e && e.message || 'This browser did not give access to that folder.', true); return; }
    const bk2 = await Kit.folder.backup();
    toast(was + ' folder: “' + neu.name + '”' + (alt && alt !== neu.name ? ' (was “' + alt + '”)' : '') + '.', false,
      was === 'App' ? (bk2 ? 'Backups go to “' + bk2.name + '”.' : 'It has no 02 BACKUP: choose a backup folder too.') : '');
    d.zu(); setTimeout(ordnerDialog, 250);
  };
  const zeile = (titel, ordner, leer, knopf, fn) => h('div', { class: 'ordnerzeile' }, [
    h('div', {}, [h('small', {}, [titel]), h('b', {}, [ordner ? '“' + ordner.name + '”' : leer])]),
    h('button', { class: 'btn btn--secondary btn--sm', type: 'button', disabled: knopf ? null : true, onclick: fn }, [ordner ? 'Change…' : 'Choose…'])]);
  const body = h('div', {}, [
    h('p', { style: { margin: '0 0 12px', color: 'var(--t2)' } }, ['Save writes today’s file into the app folder and moves the file it replaces into the backup folder. Nothing is deleted.']),
    zeile('App folder', app, 'Not chosen yet (e.g. OneDrive › APPS › CICO)', true, () => waehle(Kit.folder.choose, 'App', app && app.name)),
    zeile('Backup folder', bk, app ? 'Not chosen yet (e.g. 02 BACKUP)' : 'Choose the app folder first', !!app, () => waehle(Kit.folder.chooseBackup, 'Backup', bk && bk.name)),
    h('p', { style: { margin: '12px 0 0', color: 'var(--t3)', fontSize: '13px' } }, ['A browser only shows a folder’s name, not where it is. If you move or rename a folder, the app says so and you choose it again. The github.io app and a copy opened from this computer each remember their own folders.']),
    h('div', { class: 'aktion' }, [
      app ? h('button', { class: 'btn btn--ghost links', type: 'button', onclick: async () => { await Kit.folder.forget(); d.zu(); toast('Folders forgotten. Save writes back into the opened file again.'); } }, ['Stop using folders']) : null,
      h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => d.zu() }, ['Close']),
      h('button', { class: 'btn btn--primary', type: 'button', disabled: app ? null : true, onclick: () => { d.zu(); speichern(); } }, ['Save now'])
    ])
  ]);
  const d = blatt('Save to folder', app ? null : 'Pick the app folder once; its 02 BACKUP is used by itself', body);
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

