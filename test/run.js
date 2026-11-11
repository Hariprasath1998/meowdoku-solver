const fs = require('fs');
const Core = require('../src/core.js');
const base = process.argv[2];
const buf = fs.readFileSync(base + '.rgba');
const w = buf.readUInt32LE(0), h = buf.readUInt32LE(4);
const img = { width: w, height: h, data: new Uint8ClampedArray(buf.buffer, buf.byteOffset + 8, w * h * 4) };
const truth = JSON.parse(fs.readFileSync(base + '.json'));
const t0 = Date.now();
const a = Core.analyze(img);
const res = Core.solve(a.regions, a.n);
const ms = Date.now() - t0;
// compare partitions up to relabelling
let regionsOk = a.n === truth.n;
if (regionsOk) {
  const map = new Map();
  for (let i = 0; i < truth.regions.length; i++) {
    const k = truth.regions[i];
    if (!map.has(k)) map.set(k, a.regions[i]); else if (map.get(k) !== a.regions[i]) { regionsOk = false; break; }
  }
  if (new Set(map.values()).size !== truth.n) regionsOk = false;
}
const planted = res.solutions.some(s => s.every((c, r) => c === truth.place[r]));
console.log(JSON.stringify({ base, n: a.n, trueN: truth.n, box: Object.fromEntries(Object.entries(a.box).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v])), regionsOk, status: res.status, planted, ms }));
