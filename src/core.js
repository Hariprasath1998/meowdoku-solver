// Meowdoku solver core: board detection, grid-size detection, colour clustering, solver.
// Works on {width, height, data: Uint8ClampedArray RGBA}.
const MeowCore = (() => {
  const MIN_N = 4, MAX_N = 16;

  function edgeMaps(img) {
    const { width: W, height: H, data: D } = img;
    const gx = new Float32Array(W * H), gy = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        let a = (i - 1) * 4, b = (i + 1) * 4;
        gx[i] = Math.abs(D[a] - D[b]) + Math.abs(D[a + 1] - D[b + 1]) + Math.abs(D[a + 2] - D[b + 2]);
        a = (i - W) * 4; b = (i + W) * 4;
        gy[i] = Math.abs(D[a] - D[b]) + Math.abs(D[a + 1] - D[b + 1]) + Math.abs(D[a + 2] - D[b + 2]);
      }
    }
    return { gx, gy };
  }

  // Longest run of strong-edge pixels along a line, tolerating small gaps.
  function longestRun(get, len, T, gapTol) {
    let best = { s: 0, e: -1 }, s = -1, lastHit = -1e9;
    for (let k = 0; k < len; k++) {
      if (get(k) > T) {
        if (s < 0 || k - lastHit > gapTol + 1) s = k;
        lastHit = k;
        if (lastHit - s > best.e - best.s) best = { s, e: lastHit };
      }
    }
    return best;
  }

  function median(arr) { const a = [...arr].sort((p, q) => p - q); return a[a.length >> 1]; }

  // Group runs whose extents line up; return the group with the most lines.
  function bestGroup(runs, tol) {
    let best = null;
    for (const r of runs) {
      const g = runs.filter(o => Math.abs(o.s - r.s) <= tol && Math.abs(o.e - r.e) <= tol);
      const score = g.length * (r.e - r.s);
      if (!best || score > best.score) best = { score, g };
    }
    return best && best.g.length >= 6 ? best.g : null;
  }

  function detectBoard(img, edges) {
    const { width: W, height: H } = img;
    const { gx, gy } = edges || edgeMaps(img);
    const T = 45, minLen = 0.3 * Math.min(W, H), gap = Math.max(2, Math.round(0.006 * W));
    // Dilate edges across the line direction so thick/thin segments of one line stay connected.
    const rad = Math.max(2, Math.round(0.004 * Math.min(W, H)));
    const dy = new Float32Array(W * H), dx = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let my = 0, mx = 0;
      for (let d = -rad; d <= rad; d++) {
        const yy = y + d, xx = x + d;
        if (yy >= 0 && yy < H) { const v = gy[yy * W + x]; if (v > my) my = v; }
        if (xx >= 0 && xx < W) { const v = gx[y * W + xx]; if (v > mx) mx = v; }
      }
      dy[y * W + x] = my; dx[y * W + x] = mx;
    }
    const hRuns = [], vRuns = [];
    for (let y = 1; y < H - 1; y++) {
      const r = longestRun(x => dy[y * W + x], W, T, gap);
      if (r.e - r.s >= minLen) hRuns.push({ pos: y, s: r.s, e: r.e });
    }
    for (let x = 1; x < W - 1; x++) {
      const r = longestRun(y => dx[y * W + x], H, T, gap);
      if (r.e - r.s >= minLen) vRuns.push({ pos: x, s: r.s, e: r.e });
    }
    const tol = 0.03 * Math.min(W, H);
    const hg = bestGroup(hRuns, tol), vg = bestGroup(vRuns, tol);
    // Horizontal lines' extents give the board's x-range; vertical lines' extents give its y-range.
    // (Wide UI bars share the board's width but never its height, so they drop out.)
    let x0, x1, y0, y1;
    if (hg && vg) {
      x0 = median(hg.map(r => r.s)); x1 = median(hg.map(r => r.e));
      y0 = median(vg.map(r => r.s)); y1 = median(vg.map(r => r.e));
    } else if (hg || vg) {
      const g = hg || vg;
      const a = median(g.map(r => r.s)), b = median(g.map(r => r.e));
      const inRange = g.filter(r => r.pos >= 0);
      const c0 = Math.min(...inRange.map(r => r.pos)), c1 = Math.max(...inRange.map(r => r.pos));
      if (hg) { x0 = a; x1 = b; y0 = c0; y1 = c1; } else { y0 = a; y1 = b; x0 = c0; x1 = c1; }
    }
    if (x0 === undefined) {
      const side = 0.9 * Math.min(W, H);
      return { x: (W - side) / 2, y: (H - side) / 2, w: side, h: side, found: false };
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, found: true };
  }

  function lineScore(profile, n) {
    const len = profile.length, cell = len / n, win = Math.max(1, Math.round(cell * 0.1));
    const peak = p => { let m = 0; for (let d = -win; d <= win; d++) { const v = profile[Math.round(p) + d]; if (v > m) m = v; } return m; };
    let lines = 0, mids = 0, mean = 0;
    for (let k = 1; k < n; k++) lines += peak(k * cell);
    for (let k = 0; k < n; k++) mids += peak((k + 0.5) * cell);
    for (const v of profile) mean += v;
    mean /= len;
    return (lines / (n - 1) - mids / n) / (mean + 1e-6);
  }

  function detectGridSize(img, box, edges) {
    const { width: W } = img;
    const { gx, gy } = edges || edgeMaps(img);
    const bx = Math.round(box.x), by = Math.round(box.y), bw = Math.round(box.w), bh = Math.round(box.h);
    const inset = Math.max(2, Math.round(Math.min(bw, bh) * 0.01));
    const px = new Float32Array(bw), py = new Float32Array(bh), CAP = 60; // cap so faint lines count like bold ones
    for (let y = by + inset; y < by + bh - inset; y++)
      for (let x = bx; x < bx + bw; x++) px[x - bx] += Math.min(CAP, gx[y * W + x] || 0);
    for (let x = bx + inset; x < bx + bw - inset; x++)
      for (let y = by; y < by + bh; y++) py[y - by] += Math.min(CAP, gy[y * W + x] || 0);
    const scores = [];
    for (let n = MIN_N; n <= MAX_N; n++) scores.push({ n, s: lineScore(px, n) + lineScore(py, n) });
    const best = Math.max(...scores.map(o => o.s));
    let pick = scores.find(o => o.s === best).n;
    for (const o of scores) if (o.s >= 0.7 * best && o.n > pick) pick = o.n;
    return { n: pick, scores };
  }

  // Dominant colour of each cell's interior (mode of quantised colours, robust to icons).
  function sampleCells(img, box, n) {
    const { width: W, data: D } = img;
    const out = [];
    const cw = box.w / n, ch = box.h / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x0 = box.x + (c + 0.2) * cw, x1 = box.x + (c + 0.8) * cw;
      const y0 = box.y + (r + 0.2) * ch, y1 = box.y + (r + 0.8) * ch;
      const step = Math.max(1, Math.floor((x1 - x0) / 24));
      const bins = new Map();
      for (let y = Math.round(y0); y < y1; y += step) for (let x = Math.round(x0); x < x1; x += step) {
        const i = (y * W + x) * 4;
        const key = ((D[i] >> 4) << 8) | ((D[i + 1] >> 4) << 4) | (D[i + 2] >> 4);
        let b = bins.get(key);
        if (!b) bins.set(key, b = [0, 0, 0, 0]);
        b[0] += D[i]; b[1] += D[i + 1]; b[2] += D[i + 2]; b[3]++;
      }
      let top = null;
      for (const b of bins.values()) if (!top || b[3] > top[3]) top = b;
      out.push(top ? [top[0] / top[3], top[1] / top[3], top[2] / top[3]] : [128, 128, 128]);
    }
    return out;
  }

  function colorDist(a, b) {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db) / 3;
  }

  // Agglomerative clustering into exactly k colour groups.
  function clusterColors(colors, k) {
    let cl = colors.map((c, i) => ({ sum: [...c], cnt: 1, members: [i], mean: [...c] }));
    while (cl.length > k) {
      let bi = 0, bj = 1, bd = Infinity;
      for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) {
        const d = colorDist(cl[i].mean, cl[j].mean);
        if (d < bd) { bd = d; bi = i; bj = j; }
      }
      const a = cl[bi], b = cl[bj];
      a.sum = a.sum.map((v, t) => v + b.sum[t]); a.cnt += b.cnt; a.members.push(...b.members);
      a.mean = a.sum.map(v => v / a.cnt);
      cl.splice(bj, 1);
    }
    cl.sort((p, q) => Math.min(...p.members) - Math.min(...q.members));
    const regions = new Array(colors.length);
    cl.forEach((c, id) => c.members.forEach(m => (regions[m] = id)));
    let minSep = Infinity;
    for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) minSep = Math.min(minSep, colorDist(cl[i].mean, cl[j].mean));
    return { regions, palette: cl.map(c => c.mean.map(Math.round)), minSep };
  }

  // Backtracking solver: one cat per row/column/region, no two cats touching.
  function solve(regions, n, limit = 2) {
    const ids = [...new Set(regions)];
    if (regions.some(r => r < 0)) return { status: 'incomplete', solutions: [] };
    if (ids.length !== n) return { status: 'region-count', regionCount: ids.length, solutions: [] };
    const remap = new Map(ids.map((id, i) => [id, i]));
    const reg = regions.map(r => remap.get(r));
    const cellsOf = Array.from({ length: n }, () => []);
    reg.forEach((g, i) => cellsOf[g].push([Math.floor(i / n), i % n]));
    const colUsed = new Array(n).fill(false), regUsed = new Array(n).fill(false), place = [];
    const sols = []; let nodes = 0; const MAX_NODES = 5e6;
    const feasible = r => {
      for (let g = 0; g < n; g++) {
        if (regUsed[g]) continue;
        let ok = false;
        for (const [rr, c] of cellsOf[g]) {
          if (rr > r && !colUsed[c] && !(rr === r + 1 && Math.abs(c - place[r]) <= 1)) { ok = true; break; }
        }
        if (!ok) return false;
      }
      return true;
    };
    const bt = r => {
      if (sols.length >= limit || ++nodes > MAX_NODES) return;
      if (r === n) { sols.push(place.slice()); return; }
      for (let c = 0; c < n; c++) {
        if (colUsed[c] || (r > 0 && Math.abs(place[r - 1] - c) <= 1)) continue;
        const g = reg[r * n + c];
        if (regUsed[g]) continue;
        colUsed[c] = regUsed[g] = true; place[r] = c;
        if (feasible(r)) bt(r + 1);
        colUsed[c] = regUsed[g] = false;
      }
    };
    bt(0);
    const status = sols.length === 0 ? (nodes > MAX_NODES ? 'timeout' : 'none') : sols.length === 1 ? 'unique' : 'multiple';
    return { status, solutions: sols };
  }

  function analyze(img, opts = {}) {
    const edges = edgeMaps(img);
    const box = opts.box || detectBoard(img, edges);
    const n = opts.n || detectGridSize(img, box, edges).n;
    const colors = sampleCells(img, box, n);
    const { regions, palette, minSep } = clusterColors(colors, n);
    return { box, n, regions, palette, minSep, edges };
  }

  return { edgeMaps, detectBoard, detectGridSize, sampleCells, clusterColors, solve, analyze, colorDist, MIN_N, MAX_N };
})();
if (typeof module !== 'undefined') module.exports = MeowCore;
