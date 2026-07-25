// 레퍼런스 시트 1·3(나무·덤불·풀꽃)을 보고 만든 저폴리 3D 모델.
// 크기는 실제 월드 단위(미터급). 캐릭터 키가 1.5 정도다.
import { mesh, merge, box, gable, cylinder, cone, blobSphere, extrude, tri, quad, panel, bounds } from '../core/mesh.js';
import { P, shade } from '../art/palette.js';
import { makeRng, rand, pick } from '../core/rng.js';

function finish(m, meta) {
  const bb = bounds(m);
  return Object.assign(m, {
    hUnits: bb.h,
    radius: 0.5,
    sway: 0,
    shadowR: Math.max(bb.w, bb.d) * 0.34,
    ...meta,
  });
}

// 나무 줄기 — 뿌리 쪽이 굵고 위로 갈수록 가늘어진다
function trunk(m, { x = 0, z = 0, h = 1.6, r = 0.22, top = 0.14, color = P.trunk, seg = 7 }) {
  cylinder(m, { x, z, r, r2: top, h, seg, color, cap: false });
  // 밑동
  cylinder(m, { x, z, r: r * 1.35, r2: r, h: h * 0.16, seg, color, cap: false });
}

// ── 나무 ──────────────────────────────────────
export function pineTree(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = pick(rng, [P.leafDark, P.leafBlue, '#77ac68']);
  const h = rand(rng, 4.6, 6.4);
  trunk(m, { h: h * 0.34, r: 0.17, top: 0.11, color: P.trunkDark });
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const y = h * (0.2 + t * 0.56);
    const r = (0.95 - t * 0.58) * (h / 5.4);
    const ch = (1.5 - t * 0.55) * (h / 5.4);
    cone(m, {
      y,
      r,
      h: ch,
      seg: 7,
      color: i % 2 ? color : P.leafDark === color ? '#7db268' : color,
      skirt: -0.16,
    });
  }
  return finish(m, { radius: 0.55, sway: 0.35, kind: 'pine' });
}

export function blobTree(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, P.leafDark, '#a3c97c', P.leafBlue]);
  const h = rand(rng, 4.2, 5.6);
  trunk(m, { h: h * 0.5, r: 0.24, top: 0.16 });
  // 갈라진 가지
  for (const s of [-1, 1]) {
    const t = mesh();
    cylinder(t, { r: 0.1, r2: 0.06, h: h * 0.16, seg: 5, color: P.trunk, cap: false });
    merge(m, t, { rz: s * 0.7, tx: s * 0.1, ty: h * 0.46 });
  }
  const cy = h * 0.68;
  const rx = h * 0.3;
  blobSphere(m, {
    y: cy,
    rx,
    ry: rx * 0.82,
    seg: 11,
    rings: 6,
    color,
    wob: 0.06,
    bumps: 7,
    bumpAmt: 0.44,
    seed: seed + 3,
  });
  return finish(m, { radius: 0.6, sway: 0.6, kind: 'blob' });
}

export function willowTree(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = '#9cc47e';
  const h = rand(rng, 4.2, 5.2);
  trunk(m, { h: h * 0.52, r: 0.26, top: 0.17 });
  const cy = h * 0.74;
  const rx = h * 0.38;
  blobSphere(m, { y: cy, rx, ry: rx * 0.62, seg: 11, rings: 5, color, wob: 0.04, bumps: 5, bumpAmt: 0.3, seed: seed + 5 });
  // 늘어진 잎 커튼
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.2;
    const r = rx * (0.78 + rng() * 0.2);
    const len = rand(rng, 0.9, 1.7);
    panel(m, {
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      y: cy - rx * 0.3 - len,
      w: 0.42,
      h: len,
      color: i % 3 ? color : '#8ab471',
      ry: a + Math.PI / 2,
      outline: false,
    });
  }
  return finish(m, { radius: 0.6, sway: 1.0, kind: 'willow' });
}

export function bareTree(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = rand(rng, 3.4, 4.4);
  trunk(m, { h: h * 0.55, r: 0.2, top: 0.12, color: P.trunkDark });
  // rz(tilt) → ry(ang) 순으로 도니까 가지 방향은 아래 벡터가 된다
  const branch = (x, y, z, ang, tilt, len, r, depth) => {
    const t = mesh();
    cylinder(t, { r, r2: r * 0.62, h: len, seg: 5, color: P.trunkDark, cap: false });
    merge(m, t, { rz: tilt, ry: ang, tx: x, ty: y, tz: z });
    if (depth <= 0) return;
    const nx = x - Math.sin(tilt) * Math.cos(ang) * len;
    const ny = y + Math.cos(tilt) * len;
    const nz = z + Math.sin(tilt) * Math.sin(ang) * len;
    branch(nx, ny, nz, ang + rand(rng, -0.6, 0.6), tilt + rand(rng, 0.25, 0.6), len * 0.62, r * 0.62, depth - 1);
    branch(nx, ny, nz, ang + Math.PI + rand(rng, -0.6, 0.6), tilt + rand(rng, 0.25, 0.6), len * 0.58, r * 0.6, depth - 1);
  };
  const base = rng() * 6.28;
  branch(0, h * 0.55, 0, base, 0.22, h * 0.3, 0.1, 2);
  branch(0, h * 0.48, 0, base + 2.1, 0.34, h * 0.26, 0.09, 2);
  branch(0, h * 0.42, 0, base + 4.2, 0.42, h * 0.22, 0.08, 1);
  return finish(m, { radius: 0.45, sway: 0.45, kind: 'bare' });
}

export function bush(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, P.leafDark, '#a9cb84']);
  const s = rand(rng, 0.8, 1.15);
  blobSphere(m, {
    y: 0.4 * s,
    rx: 0.66 * s,
    ry: 0.46 * s,
    seg: 9,
    rings: 5,
    color,
    wob: 0.05,
    bumps: 5,
    bumpAmt: 0.36,
    seed: seed + 2,
  });
  if (opt.berries) {
    for (let i = 0; i < 5; i++) {
      blobSphere(m, {
        x: rand(rng, -0.5, 0.6) * s,
        y: rand(rng, 0.35, 0.75) * s,
        z: rand(rng, -0.4, 0.4) * s,
        rx: 0.07,
        ry: 0.07,
        seg: 5,
        rings: 3,
        color: '#d76a6a',
        wob: 0.05,
        seed: seed + 20 + i,
      });
    }
  }
  return finish(m, { radius: 0.5 * s, sway: 1.1, kind: 'bush' });
}

export function rock(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = rand(rng, 0.55, 1.15);
  const pts = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = s * rand(rng, 0.7, 1.05);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  extrude(m, {
    pts,
    h: s * rand(rng, 0.7, 1.0),
    color: P.stoneDark,
    topColor: P.stone,
    topScale: rand(rng, 0.45, 0.68),
    topOffset: [rand(rng, -0.15, 0.15) * s, rand(rng, -0.15, 0.15) * s],
  });
  if (rng() < 0.7) {
    const small = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      small.push([Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3]);
    }
    extrude(m, { x: s * 1.1, z: s * 0.35, pts: small, h: s * 0.32, color: P.stoneDark, topColor: P.stone, topScale: 0.6 });
  }
  return finish(m, { radius: s * 0.8, kind: 'rock' });
}

export function stump(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const r = rand(rng, 0.34, 0.46);
  cylinder(m, { r: r * 1.15, r2: r, h: 0.52, seg: 8, color: P.trunk, capColor: '#dcb98c' });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const t = mesh();
    cylinder(t, { r: 0.1, r2: 0.05, h: 0.32, seg: 4, color: P.trunkDark, cap: false });
    merge(m, t, { rz: 1.15, ry: -a, tx: Math.cos(a) * r * 0.9, tz: Math.sin(a) * r * 0.9, ty: 0.02 });
  }
  return finish(m, { radius: r + 0.1, kind: 'stump' });
}

export function log(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const len = rand(rng, 1.3, 2.0);
  const r = rand(rng, 0.2, 0.28);
  const t = mesh();
  cylinder(t, { r, h: len, seg: 8, color: P.trunk, capColor: '#dcb98c' });
  merge(m, t, { rx: Math.PI / 2, ty: r, tz: len / 2, ry: rand(rng, 0, 3.14) });
  return finish(m, { radius: r * 1.6, kind: 'log' });
}

export function mushroom(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const capColor = pick(rng, ['#e08a76', '#d9a05b', '#c98fb0', '#e8cf9a']);
  const s = rand(rng, 0.55, 0.95);
  cylinder(m, { r: 0.06 * s, r2: 0.05 * s, h: 0.28 * s, seg: 6, color: '#f2e7cf' });
  blobSphere(m, { y: 0.28 * s, rx: 0.2 * s, ry: 0.14 * s, seg: 7, rings: 3, color: capColor, wob: 0.06, seed: seed + 1 });
  return finish(m, { radius: 0, kind: 'mushroom' });
}

// 풀 — 삼각 잎날 몇 장(양면). 진짜 3D 공간을 차지한다.
export function grassTuft(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = pick(rng, ['#a6cc7e', '#96c06f', '#b2d489', '#8fba68']);
  const n = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const bx = Math.cos(a) * 0.14;
    const bz = Math.sin(a) * 0.14;
    const hgt = rand(rng, 0.42, 0.85);
    const lean = rand(rng, -0.34, 0.34);
    tri(
      m,
      [bx - 0.09, 0, bz],
      [bx + 0.09, 0, bz],
      [bx + lean, hgt, bz + lean * 0.6],
      color,
      { double: true, outline: false }
    );
  }
  return finish(m, { radius: 0, sway: 2.2, kind: 'grass' });
}

export function flower(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = pick(rng, ['#e8909f', '#efc86a', '#b79ede', '#f0f0e2', '#e88f6a']);
  const h = rand(rng, 0.4, 0.62);
  cylinder(m, { r: 0.022, h, seg: 4, color: '#8fba68', cap: false });
  blobSphere(m, { y: h + 0.06, rx: 0.15, ry: 0.08, seg: 6, rings: 3, color, wob: 0.12, seed: seed + 1 });
  blobSphere(m, { y: h + 0.1, rx: 0.05, ry: 0.04, seg: 5, rings: 2, color: P.leafGold, wob: 0, seed: seed + 2 });
  tri(m, [0, h * 0.4, 0], [0.16, h * 0.55, 0.04], [0.03, h * 0.62, 0], P.leaf, { double: true, outline: false });
  return finish(m, { radius: 0, sway: 2.0, kind: 'flower' });
}

export function cattail(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const hgt = rand(rng, 0.7, 1.15);
    tri(
      m,
      [Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06],
      [Math.cos(a) * 0.06 + 0.06, 0, Math.sin(a) * 0.06 + 0.04],
      [Math.cos(a) * 0.4, hgt, Math.sin(a) * 0.4],
      P.grassDeep,
      { double: true, outline: false }
    );
  }
  for (const s of [-1, 1]) {
    const x = s * 0.08;
    cylinder(m, { x, r: 0.02, h: 0.95, seg: 4, color: P.grassDeep, cap: false });
    cylinder(m, { x, y: 0.95, r: 0.06, h: 0.26, seg: 6, color: P.trunkDark });
  }
  return finish(m, { radius: 0, sway: 1.6, kind: 'cattail' });
}

export function sapling(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = rand(rng, 0.34, 0.55);
  cylinder(m, { r: 0.025, h, seg: 4, color: P.trunk, cap: false });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng();
    tri(
      m,
      [0, h * 0.5, 0],
      [Math.cos(a) * 0.22, h * 0.78, Math.sin(a) * 0.22],
      [Math.cos(a + 0.5) * 0.1, h * 0.62, Math.sin(a + 0.5) * 0.1],
      P.leaf,
      { double: true, outline: false }
    );
  }
  return finish(m, { radius: 0, sway: 2.0, kind: 'sapling' });
}

// ── 수집품 ────────────────────────────────────
export function acornModel() {
  const m = mesh();
  blobSphere(m, { y: 0.16, rx: 0.12, ry: 0.15, seg: 7, rings: 4, color: P.acorn, wob: 0.04, seed: 5 });
  cylinder(m, { y: 0.2, r: 0.13, r2: 0.11, h: 0.09, seg: 7, color: P.trunkDark });
  cylinder(m, { y: 0.29, r: 0.02, h: 0.09, seg: 4, color: P.trunkDark, cap: false });
  return finish(m, { radius: 0, kind: 'acorn' });
}

export function lanternModel(lit = false) {
  const m = mesh();
  const glass = lit ? '#ffe6a8' : P.cloth;
  cylinder(m, { y: 0.02, r: 0.17, r2: 0.15, h: 0.07, seg: 6, color: P.woodDark });
  cylinder(m, { y: 0.09, r: 0.15, r2: 0.15, h: 0.34, seg: 6, color: glass });
  cylinder(m, { y: 0.43, r: 0.17, r2: 0.05, h: 0.12, seg: 6, color: P.woodDark });
  cylinder(m, { y: 0.55, r: 0.02, h: 0.1, seg: 4, color: P.trunkDark, cap: false });
  return finish(m, { radius: 0, kind: 'lantern', lit });
}
