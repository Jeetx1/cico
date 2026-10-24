/* Barcode reader tests: synthetic photos (rotation, blur, noise, uneven light, small and large modules).
   The reader part of the app is evaluated on its own, so nothing in the app has to be global.            */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../src/15_scan.js'), 'utf8');
const { eanBild, eanPruef } = new Function(SRC + '\nreturn { eanBild, eanPruef };')();

const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const G = L.map(s => s.split('').map(b => b === '1' ? '0' : '1').reverse().join(''));
const R = L.map(s => s.split('').map(b => b === '1' ? '0' : '1').join(''));
const PAR = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
function pruefziffer(s){ let t = 0; const n = s.length + 1; for (let i = 0; i < s.length; i++) t += +s[i] * ((n - 1 - i) % 2 ? 3 : 1); return String((10 - t % 10) % 10); }
function bits13(code){
  const d = code.split('').map(Number), p = PAR[d[0]];
  let b = '101'; for (let i = 0; i < 6; i++) b += (p[i] === 'L' ? L : G)[d[1 + i]];
  b += '01010'; for (let i = 0; i < 6; i++) b += R[d[7 + i]]; return b + '101';
}
function bits8(code){ const d = code.split('').map(Number); let b = '101'; for (let i = 0; i < 4; i++) b += L[d[i]]; b += '01010'; for (let i = 4; i < 8; i++) b += R[d[i]]; return b + '101'; }

let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function bild(bits, o){
  const W = o.w || 900, H = o.h || 700, mod = o.mod, ang = o.ang * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
  const len = bits.length * mod, hoch = o.hoch || len * .55, cx = W / 2 + (o.dx || 0), cy = H / 2 + (o.dy || 0);
  const img = new Float32Array(W * H);
  const SS = 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    let v = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++){
      const X = x + (sx + .5) / SS - cx, Y = y + (sy + .5) / SS - cy;
      const u = X * ca + Y * sa, w = -X * sa + Y * ca;            /* barcode coordinates */
      let dunkel = false;
      if (Math.abs(w) < hoch / 2){ const k = Math.floor((u + len / 2) / mod); if (k >= 0 && k < bits.length) dunkel = bits[k] === '1'; }
      v += dunkel ? (o.ink || 40) : 225;
    }
    img[y * W + x] = v / (SS * SS);
  }
  /* box blur */
  let src = img;
  for (let pass = 0; pass < (o.blur || 0); pass++){
    const dst = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++){
      let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += src[(y + j) * W + x + i]; dst[y * W + x] = s / 9;
    }
    src = dst;
  }
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    const licht = 1 - (o.licht || 0) * (x / W);                     /* uneven light */
    const v = src[y * W + x] * licht + (rnd() - .5) * 2 * (o.noise || 0);
    g[y * W + x] = Math.max(0, Math.min(255, v));
  }
  return { g, W, H };
}

let ok = 0, bad = 0;
const check = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL  ' + m); } };
const faelle = [
  ['7610200337538', { mod: 4, ang: 0 }],
  ['7613035974685', { mod: 3, ang: 90, blur: 1, noise: 10 }],
  ['4006381333931', { mod: 2.2, ang: 18, noise: 12 }],
  ['7617400030457', { mod: 5, ang: -33, blur: 2, noise: 8, licht: .45 }],
  ['0012345678905', { mod: 3.5, ang: 47, blur: 1, noise: 14 }],       /* UPC-A read as EAN-13 */
  ['7610032055052', { mod: 6.5, ang: 180, blur: 2, noise: 6, w: 1100, h: 800 }],
  ['5000159407236', { mod: 2.8, ang: -71, blur: 1, noise: 10, dx: 120, dy: -80 }],
  ['7616500010222', { mod: 1.7, ang: 4, noise: 6 }],
  ['9783161484100', { mod: 3, ang: 105, blur: 2, noise: 16, ink: 70 }],
  ['7610807000017', { mod: 4.5, ang: 8, blur: 4, noise: 10 }],                      /* soft focus */
  ['7613404203513', { mod: 8, ang: -5, blur: 3, noise: 8, w: 1280, h: 960 }]         /* very close */
];
for (const [roh, o] of faelle){
  const code = roh.slice(0, 12) + pruefziffer(roh.slice(0, 12));
  const { g, W, H } = bild(bits13(code), o);
  const t = Date.now(), r = eanBild(g, W, H), ms = Date.now() - t;
  check(r && r.code === code, 'EAN-13 ' + code + ' ' + JSON.stringify(o) + ' -> ' + JSON.stringify(r));
  check(ms < 4000, 'speed ' + code + ' ' + ms + ' ms');
  if (process.env.V) console.log(code, ms + ' ms', r && r.votes);
}
for (const [code, o] of [['96385074', { mod: 4, ang: 0, blur: 1, noise: 8 }], ['40170725', { mod: 3, ang: -24, noise: 10 }]]){
  const { g, W, H } = bild(bits8(code), o);
  const r = eanBild(g, W, H);
  check(r && r.code === code, 'EAN-8 ' + code + ' -> ' + JSON.stringify(r));
}
/* nothing to read: no false positives */
{
  const W = 700, H = 500, g = new Uint8Array(W * H);
  for (let i = 0; i < g.length; i++){ const x = i % W, y = (i / W) | 0; g[i] = 128 + 90 * Math.sin(x * .21 + Math.sin(y * .05) * 3) * Math.cos(y * .13) + (rnd() - .5) * 30; }
  check(eanBild(g, W, H) === null, 'no code in a stripy non-barcode picture');
}
console.log((bad ? 'FAILED ' : 'ok ') + ok + '/' + (ok + bad) + ' barcode checks');
process.exit(bad ? 1 : 0);
