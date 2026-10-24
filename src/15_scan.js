/* ================================================================ barcode reader (EAN-13, EAN-8, UPC-A)
   Works on a still photo, offline, no libraries. The photo becomes grey values; lines are sampled across it at
   several angles; each line becomes bar/space widths (edges to a fraction of a pixel); the widths are matched
   against the EAN digit patterns and the check digit decides. A code read on several lines wins.               */
const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const EAN_PAR = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
function eanBreiten(bits){ const r = []; let n = 1; for (let i = 1; i <= bits.length; i++){ if (bits[i] === bits[i - 1]) n++; else { r.push(n); n = 1; } } return r; }
const EAN_WL = EAN_L.map(eanBreiten);                    /* L and R codes: same widths */
const EAN_WG = EAN_WL.map(w => w.slice().reverse());      /* G codes: L read backwards */
function eanZiffer(runs, i, tabellen){
  const s = runs[i] + runs[i + 1] + runs[i + 2] + runs[i + 3], f = 7 / s;
  let best = 99, zweit = 99, wer = null;
  for (let ti = 0; ti < tabellen.length; ti++){
    const tab = tabellen[ti];
    for (let d = 0; d < 10; d++){
      const pat = tab[d]; let e = 0;
      for (let k = 0; k < 4; k++){ const x = runs[i + k] * f - pat[k]; e += x * x; }
      if (e < best){ zweit = best; best = e; wer = { d, t: ti }; } else if (e < zweit) zweit = e;
    }
  }
  if (best > 1.1 || zweit - best < 0.1) return null;
  return wer;
}
function eanPruef(z){
  let s = 0; const n = z.length;
  for (let i = 0; i < n - 1; i++) s += z[i] * ((n - 1 - i) % 2 ? 3 : 1);
  return (10 - s % 10) % 10 === z[n - 1];
}
function eanGuard(runs, i, n, m){ for (let k = 0; k < n; k++){ const x = runs[i + k] / m; if (x < 0.4 || x > 2) return false; } return true; }
/* runs[s] is a bar; returns the codes that start there */
function eanAus(runs, s, out){
  if (s + 59 <= runs.length){                               /* EAN-13: 59 runs, 95 modules */
    let W = 0; for (let k = 0; k < 59; k++) W += runs[s + k];
    const m = W / 95, vor = s > 0 ? runs[s - 1] : 0, nach = s + 59 < runs.length ? runs[s + 59] : 99 * m;
    if (vor >= 3.5 * m && nach >= 3.5 * m && eanGuard(runs, s, 3, m) && eanGuard(runs, s + 27, 5, m) && eanGuard(runs, s + 56, 3, m)){
      const dig = []; let par = '', ok = true;
      for (let j = 0; j < 6 && ok; j++){ const z = eanZiffer(runs, s + 3 + j * 4, [EAN_WL, EAN_WG]); if (!z) ok = false; else { dig.push(z.d); par += z.t ? 'G' : 'L'; } }
      for (let j = 0; j < 6 && ok; j++){ const z = eanZiffer(runs, s + 32 + j * 4, [EAN_WL]); if (!z) ok = false; else dig.push(z.d); }
      if (ok){ const erste = EAN_PAR.indexOf(par); if (erste >= 0){ const a = [erste].concat(dig); if (eanPruef(a)) out.push(a.join('')); } }
    }
  }
  if (s + 43 <= runs.length){                               /* EAN-8: 43 runs, 67 modules */
    let W = 0; for (let k = 0; k < 43; k++) W += runs[s + k];
    const m = W / 67, vor = s > 0 ? runs[s - 1] : 0, nach = s + 43 < runs.length ? runs[s + 43] : 99 * m;
    if (vor >= 5 * m && nach >= 5 * m && eanGuard(runs, s, 3, m) && eanGuard(runs, s + 19, 5, m) && eanGuard(runs, s + 40, 3, m)){
      const dig = []; let ok = true;
      for (let j = 0; j < 4 && ok; j++){ const z = eanZiffer(runs, s + 3 + j * 4, [EAN_WL]); if (!z) ok = false; else dig.push(z.d); }
      for (let j = 0; j < 4 && ok; j++){ const z = eanZiffer(runs, s + 24 + j * 4, [EAN_WL]); if (!z) ok = false; else dig.push(z.d); }
      if (ok && eanPruef(dig)) out.push(dig.join(''));
    }
  }
}
/* sliding-window minimum or maximum (monotonic queue) */
function huelle(a, R, besser){
  const n = a.length, out = new Float32Array(n), q = new Int32Array(n);
  let kopf = 0, ende = 0, j = 0;
  for (let i = 0; i < n; i++){
    const bis = Math.min(n - 1, i + R);
    for (; j <= bis; j++){ while (ende > kopf && besser(a[j], a[q[ende - 1]])) ende--; q[ende++] = j; }
    while (q[kopf] < i - R) kopf++;
    out[i] = a[q[kopf]];
  }
  return out;
}
/* one line of grey values -> codes found on it */
function eanZeile(p){
  const n = p.length; if (n < 60) return [];
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) sm[i] = p[i];      /* no smoothing along the line: thin bars would fade (noise is averaged across it) */
  let lo = 255, hi = 0; for (let i = 0; i < n; i++){ if (sm[i] < lo) lo = sm[i]; if (sm[i] > hi) hi = sm[i]; }
  if (hi - lo < 28) return [];
  /* local threshold: midway between the darkest and the lightest value nearby (a plain mean would be pulled up by
     the white quiet zone and eat the thin spaces at both ends of the code) */
  const R = Math.max(8, Math.round(n / 18)), thr = new Float32Array(n);
  const mn = huelle(sm, R, (a, b) => a <= b), mx = huelle(sm, R, (a, b) => a >= b);
  for (let i = 0; i < n; i++) thr[i] = (mn[i] + mx[i]) / 2;
  /* hysteresis: a colour change needs a clear swing (noise on white stays white); the edge itself sits at the
     last crossing of the local mean, interpolated between samples */
  const hyst = Math.max(6, (hi - lo) * .1);
  let dunkel = sm[0] - thr[0] < -hyst, zc = 0;
  const edges = [0], dunkelAb = [dunkel];                  /* the stretch before the first edge counts too (quiet zone) */
  for (let i = 1; i < n; i++){
    const d0 = sm[i - 1] - thr[i - 1], d1 = sm[i] - thr[i];
    if ((d0 < 0) !== (d1 < 0)) zc = i - 1 + (d0 === d1 ? 0 : d0 / (d0 - d1));
    if (!dunkel && d1 < -hyst){ dunkel = true; edges.push(zc); dunkelAb.push(true); }
    else if (dunkel && d1 > hyst){ dunkel = false; edges.push(zc); dunkelAb.push(false); }
  }
  edges.push(n - 1);
  if (edges.length < 46) return [];
  const runs = [], bar = [];
  for (let k = 0; k < edges.length - 1; k++){ runs.push(edges[k + 1] - edges[k]); bar.push(dunkelAb[k]); }
  const res = [];
  const probiere = (rs, bs) => { for (let s = 1; s <= rs.length - 43; s++) if (bs[s]) eanAus(rs, s, res); };
  probiere(runs, bar);
  probiere(runs.slice().reverse(), bar.slice().reverse());
  return res;
}
/* grey image (Uint8Array, w*h) -> { code, votes } or null */
function eanBild(grau, w, h, opt){
  opt = opt || {};
  const stimmen = {}, winkel = opt.winkel || [0, 90, 12, -12, 25, -25, 40, -40, 55, -55, 70, -70, 82, -82];
  const schritte = opt.linien || 40;
  const sample = (x, y) => {
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return (grau[i] * (1 - fx) + grau[i + 1] * fx) * (1 - fy) + (grau[i + w] * (1 - fx) + grau[i + w + 1] * fx) * fy;
  };
  let bester = null;
  for (const wg of winkel){
    const r = wg * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r), nx = -dy, ny = dx;
    const cx = (w - 1) / 2, cy = (h - 1) / 2, spann = (Math.abs(nx) * w + Math.abs(ny) * h) / 2;
    for (let k = 0; k <= schritte; k++){
      const o = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (2 * spann / schritte) * .96;   /* from the middle outwards */
      const px = cx + nx * o, py = cy + ny * o;
      let t0 = -Infinity, t1 = Infinity;
      for (const [dd, p0, max] of [[dx, px, w - 2], [dy, py, h - 2]]){
        if (Math.abs(dd) < 1e-9){ if (p0 < 0 || p0 > max){ t0 = 1; t1 = 0; } continue; }
        let a = -p0 / dd, b = (max - p0) / dd; if (a > b){ const z = a; a = b; b = z; }
        if (a > t0) t0 = a; if (b < t1) t1 = b;
      }
      if (!(t1 - t0 > 60)) continue;
      const n = Math.floor(t1 - t0), prof = new Float32Array(n);
      /* each point is the mean of a short stroke across the line (along the bars), which averages noise away */
      for (let i = 0; i < n; i++){
        const t = t0 + i, x = px + dx * t, y = py + dy * t;
        let v = 0, z = 0;
        for (let q = -2; q <= 2; q++){
          const xq = x + nx * q * 1.5, yq = y + ny * q * 1.5;
          if (xq >= 0 && yq >= 0 && xq < w - 1 && yq < h - 1){ v += sample(xq, yq); z++; }
        }
        prof[i] = z ? v / z : sample(x, y);
      }
      for (const c of eanZeile(prof)){ stimmen[c] = (stimmen[c] || 0) + 1; if (!bester || stimmen[c] > bester.votes) bester = { code: c, votes: stimmen[c] }; }
      if (bester && bester.votes >= 3) return bester;
    }
  }
  return bester && bester.votes >= 2 ? bester : null;
}
function grauVon(rgba, n){
  const g = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  return g;
}

