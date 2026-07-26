// 손그림 레퍼런스 시트(나무·그루터기·통나무·덤불 / 풀·꽃·고사리·버섯·부들·덩굴)를
// 한 장씩 그대로 옮긴 저폴리 3D 모델. 크기는 실제 월드 단위(캐릭터 키 1.5).
// 잉크 선은 "실루엣 + 날카로운 크리스"에만 붙으므로, 그림의 선(나이테·껍질결·꽃잎 윤곽)은
// 전부 진짜 폴리곤으로 만들어야 보인다.
import { mesh, merge, box, cylinder, cone, blobSphere, extrude, tri, quad, poly, bounds } from '../core/mesh.js';
import { P } from '../art/palette.js';
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

// ── 공통 부품 ─────────────────────────────────

/** +y 를 보는 얇은 원판. 나이테·꽃술·클로버 잎처럼 "그려진 동그라미"에 쓴다. */
function disc(m, { x = 0, y = 0, z = 0, r = 0.05, seg = 7, color = '#fff', outline = true, double = false }) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    // 각도를 거꾸로 돌아야 노멀이 +y 를 본다
    const a = -(i / seg) * Math.PI * 2;
    pts.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
  }
  poly(m, pts, color, { outline, double });
  return m;
}

/**
 * 평평한 잎/꽃잎 한 장 — 면 1개(양면)라서 아주 싸고, 가장자리가 그대로 잉크 선이 된다.
 * 로컬에서 +x 로 뻗고 위(+y)를 보는 판을 만든 뒤 tilt(끝을 들어올림) → dir(방위) 로 돌린다.
 */
function flatLeaf(m, o) {
  const { x = 0, y = 0, z = 0, len = 0.2, wid = 0.1, color = P.leaf, dir = 0, tilt = 0.4, shape = 'leaf', outline = true } = o;
  let pts;
  if (shape === 'round') {
    pts = [[0, 0], [0.24, 0.46], [0.6, 0.54], [0.9, 0.3], [1, 0], [0.9, -0.3], [0.6, -0.54], [0.24, -0.46]];
  } else if (shape === 'heart') {
    pts = [[0, 0], [0.22, 0.34], [0.5, 0.62], [0.84, 0.44], [1, 0], [0.84, -0.44], [0.5, -0.62], [0.22, -0.34]];
  } else if (shape === 'tooth') {
    // 민들레 잎 — 톱니가 실루엣으로 그대로 잡힌다
    pts = [
      [0, 0], [0.18, 0.3], [0.3, 0.14], [0.46, 0.44], [0.6, 0.2], [0.76, 0.42], [1, 0],
      [0.76, -0.42], [0.6, -0.2], [0.46, -0.44], [0.3, -0.14], [0.18, -0.3],
    ];
  } else {
    pts = [[0, 0], [0.3, 0.44], [0.68, 0.42], [1, 0], [0.68, -0.42], [0.3, -0.44]];
  }
  const b = mesh();
  poly(b, pts.map((p) => [p[0] * len, 0, p[1] * wid]), color, { double: true, outline });
  merge(m, b, { rz: tilt, ry: -dir, tx: x, ty: y, tz: z });
  return m;
}

/** 끝이 뾰족한 잎날 한 장(양면). 덤불·잎덩어리 겉면에 삐죽 솟게 심는다. */
function leafTip(m, { x = 0, y = 0, z = 0, dir = 0, out = 0.5, len = 0.3, wid = 0.12, color = P.leaf, outline = true }) {
  const ax = Math.cos(dir) * out;
  const az = Math.sin(dir) * out;
  const inv = 1 / (Math.hypot(ax, 1, az) || 1);
  const px = -Math.sin(dir) * wid * 0.5;
  const pz = Math.cos(dir) * wid * 0.5;
  tri(
    m,
    [x - px, y, z - pz],
    [x + px, y, z + pz],
    [x + ax * len * inv, y + len * inv, z + az * len * inv],
    color,
    { double: true, outline }
  );
  return m;
}

/** 휘어진 풀잎 — 밑동이 넓고 끝으로 갈수록 뾰족하게 휜다(면 2개). */
function arcBlade(m, { x = 0, y = 0, z = 0, dir = 0, len = 0.6, wid = 0.09, bend = 0.4, color = P.grassDeep, outline = true }) {
  const cx = Math.cos(dir);
  const cz = Math.sin(dir);
  const px = -Math.sin(dir);
  const pz = Math.cos(dir);
  const w0 = wid * 0.5;
  const w1 = wid * 0.28;
  const mx = x + cx * len * 0.3 * bend;
  const mz = z + cz * len * 0.3 * bend;
  const my = y + len * 0.58;
  const tx = x + cx * len * bend;
  const tz = z + cz * len * bend;
  const ty = y + len * (0.98 - 0.3 * bend * bend);
  quad(
    m,
    [x - px * w0, y, z - pz * w0],
    [x + px * w0, y, z + pz * w0],
    [mx + px * w1, my, mz + pz * w1],
    [mx - px * w1, my, mz - pz * w1],
    color,
    { double: true, outline }
  );
  tri(m, [mx - px * w1, my, mz - pz * w1], [mx + px * w1, my, mz + pz * w1], [tx, ty, tz], color, { double: true, outline });
  return m;
}

/** 밑동에서 방사형으로 뻗은 뿌리 판 — 땅에 꽂힌 막대가 아니라 "자란 나무"로 보이게 한다. */
function rootFlares(m, { x = 0, z = 0, r = 0.3, n = 4, len = 0.4, color = P.trunkDark, seed = 1, rise = 0.01 }) {
  const rnd = makeRng(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
    const t = mesh();
    cone(t, { r: r * (0.3 + rnd() * 0.14), h: len * (0.8 + rnd() * 0.5), seg: 3, color });
    merge(m, t, { rz: 1.3 + rnd() * 0.14, ry: -a, tx: x + Math.cos(a) * r * 0.6, tz: z + Math.sin(a) * r * 0.6, ty: rise });
  }
  return m;
}

/** 나무 줄기 — 뿌리 쪽이 굵고 위로 갈수록 가늘다. */
function trunk(m, { x = 0, z = 0, h = 1.6, r = 0.22, top = 0.14, color = P.trunk, seg = 6, roots = 4, seed = 1, flare = 0.4 }) {
  cylinder(m, { x, z, r, r2: top, h, seg, color, cap: false });
  if (flare > 0) cylinder(m, { x, z, r: r * (1 + flare), r2: r, h: h * 0.16, seg, color, cap: false });
  if (roots > 0) rootFlares(m, { x, z, r: r * (1 + flare), n: roots, len: r * 2.1, color, seed: seed * 31 + 7 });
  return m;
}

/** 부러진 나무의 파단면 — 톱니처럼 삐죽삐죽하게 닫는다(고목·쪼개진 그루터기). */
function jaggedTop(m, { x = 0, y = 0, z = 0, r = 0.3, seg = 7, spike = 0.18, color = P.wood, seed = 1 }) {
  const rnd = makeRng(seed);
  const ring = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const up = (i % 2 ? spike : spike * 0.22) * (0.6 + rnd() * 0.8);
    ring.push([x + Math.cos(a) * r, y + up, z + Math.sin(a) * r]);
  }
  const c = [x, y + spike * 0.3, z];
  for (let i = 0; i < seg; i++) {
    // (c, j, i) 순서라야 노멀이 위를 본다
    tri(m, c, ring[(i + 1) % seg], ring[i], color);
  }
  return m;
}

/** 원통 겉면에 살짝 띄운 껍질 결 한 줄(면 1개). 통나무·줄기의 손그림 선. */
function barkLine(m, { r = 0.25, a = 0, y0 = 0, y1 = 1, w = 0.05, color = P.trunkDark, lift = 0.014 }) {
  const nx = Math.cos(a) * (r + lift);
  const nz = Math.sin(a) * (r + lift);
  const tx = -Math.sin(a) * w * 0.5;
  const tz = Math.cos(a) * w * 0.5;
  quad(m, [nx - tx, y0, nz - tz], [nx + tx, y0, nz + tz], [nx + tx, y1, nz + tz], [nx - tx, y1, nz - tz], color, { double: true });
  return m;
}

/** 처지는 가지 한 층 — 뾰족한 삼각 잎가지를 링으로 두른다(가문비나무). */
function frondRing(m, { y = 0, r0 = 0.1, r = 0.8, droop = 0.2, n = 8, color = P.leafDark, phase = 0, rise = 0.1 }) {
  const w = (Math.PI / n) * 0.95;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase;
    tri(
      m,
      [Math.cos(a - w) * r0, y + rise, Math.sin(a - w) * r0],
      [Math.cos(a + w) * r0, y + rise, Math.sin(a + w) * r0],
      [Math.cos(a) * r, y - droop, Math.sin(a) * r],
      color,
      { double: true }
    );
  }
  return m;
}

// ── 나무 ──────────────────────────────────────

/** 시트 1-①: 층층이 처진 뾰족한 가지의 키 큰 가문비나무. 밑동엔 맨 줄기가 드러난다. */
export function pineTree(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const dark = pick(rng, [P.leafDark, P.leafBlue, '#6fa35c']);
  const lite = dark === P.leafBlue ? '#93c2a9' : '#84b46b';
  const h = rand(rng, 4.6, 6.3);
  // 그림처럼 다리(맨 줄기)가 보이도록 줄기를 길고 가늘게
  trunk(m, { h: h * 0.74, r: 0.16, top: 0.05, color: P.trunkDark, seg: 5, roots: 3, seed, flare: 0.5 });
  // 잎층 사이로 하늘이 뚫리지 않게 속을 채우는 심. 꼭대기의 뾰족한 첨탑 역할도 한다.
  const coreY = h * 0.26;
  const coreR = h * 0.17;
  const coreH = h * 0.66;
  cone(m, { y: coreY, r: coreR, h: coreH, seg: 5, color: dark });
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const y = h * (0.28 + t * 0.56);
    const r = h * (0.3 - t * 0.2);
    const r0 = Math.max(0.03, coreR * (1 - (y - coreY) / coreH) * 0.85);
    frondRing(m, {
      y,
      r0,
      r,
      droop: r * 0.34,
      n: 9 - i,
      color: i % 2 ? lite : dark,
      phase: i * 0.42,
      rise: r * 0.18,
    });
  }
  return finish(m, { radius: 0.55, sway: 0.35, kind: 'pine' });
}

/** 시트 1-②: 뾰족한 잎이 불꽃처럼 뭉친 큰 활엽수. */
export function leafyTree(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, P.leafDark, '#96c46f']);
  const tipColor = opt.color || '#7fb45f';
  const h = rand(rng, 4.6, 5.8);
  trunk(m, { h: h * 0.32, r: 0.26, top: 0.16, seed, roots: 4 });
  // 잎덩어리 속으로 갈라져 들어가는 두 가지
  for (const s of [-1, 1]) {
    const t = mesh();
    cylinder(t, { r: 0.1, r2: 0.05, h: h * 0.2, seg: 4, color: P.trunk, cap: false });
    merge(m, t, { rz: s * 0.5, tx: s * 0.06, ty: h * 0.28 });
  }
  const cy = h * 0.62;
  const rx = h * 0.29;
  const ry = h * 0.34;
  blobSphere(m, { y: cy, rx, ry, seg: 8, rings: 4, color, wob: 0.06, bumps: 4, bumpAmt: 0.28, seed: seed + 4 });
  // 겉면에 뾰족한 잎끝을 심어 불꽃 실루엣을 만든다(위로 갈수록 길고 곧게)
  const rows = [
    [1.4, 8, 0.16, 0.9],
    [1.0, 7, 0.18, 0.6],
    [0.62, 5, 0.2, 0.35],
    [0.2, 3, 0.24, 0.15],
  ];
  for (let k = 0; k < rows.length; k++) {
    const [phi, n, lenF, out] = rows[k];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.5;
      const dx = Math.sin(phi) * Math.cos(a);
      const dy = Math.cos(phi);
      const dz = Math.sin(phi) * Math.sin(a);
      leafTip(m, {
        x: dx * rx * 0.92,
        y: cy + dy * ry * 0.92,
        z: dz * rx * 0.92,
        dir: a,
        out,
        len: h * lenF * 0.5,
        wid: h * 0.07,
        color: k % 2 ? tipColor : color,
      });
    }
  }
  return finish(m, { radius: 0.6, sway: 0.55, kind: 'leafy' });
}

/** 시트 1-③: 둥글게 부풀린 구름 캐노피의 큰 나무(닫힌 덩어리 하나 + 혹으로 스캘럽). */
export function blobTree(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, P.leafDark, '#a3c97c', P.leafBlue]);
  const h = rand(rng, 4.2, 5.4);
  trunk(m, { h: h * 0.46, r: 0.25, top: 0.15, seed, roots: 4 });
  for (const s of [-1, 1]) {
    const t = mesh();
    cylinder(t, { r: 0.09, r2: 0.05, h: h * 0.2, seg: 4, color: P.trunk, cap: false });
    merge(m, t, { rz: s * 0.58, tx: s * 0.06, ty: h * 0.42 });
  }
  blobSphere(m, {
    y: h * 0.64,
    rx: h * 0.33,
    ry: h * 0.28,
    seg: 10,
    rings: 5,
    color,
    wob: 0.04,
    bumps: 8,
    bumpAmt: 0.42,
    seed: seed + 3,
  });
  return finish(m, { radius: 0.6, sway: 0.6, kind: 'blob' });
}

/** 시트 1-⑧: 작고 둥근 구름나무(짧은 줄기 + 큼직한 혹 몇 개). */
export function cloudTree(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, '#9fc97f', P.leafBlue]);
  const h = rand(rng, 2.8, 3.7);
  trunk(m, { h: h * 0.36, r: 0.17, top: 0.11, seed, roots: 3, seg: 5 });
  blobSphere(m, {
    y: h * 0.66,
    rx: h * 0.36,
    ry: h * 0.31,
    seg: 9,
    rings: 5,
    color,
    wob: 0.03,
    bumps: 9,
    bumpAmt: 0.5,
    seed: seed + 6,
  });
  return finish(m, { radius: 0.55, sway: 0.7, kind: 'cloudTree' });
}

/** 시트 1-④: 줄기가 꼭대기까지 보이는 좁고 긴 스캘럽 나무. */
export function columnarTree(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, P.leafDark, '#9dc57b']);
  const h = rand(rng, 3.6, 4.6);
  // 그림에선 줄기 선이 캐노피를 뚫고 꼭대기까지 이어진다
  trunk(m, { h: h * 0.94, r: 0.12, top: 0.03, color: P.trunkDark, seg: 5, roots: 3, seed, flare: 0.5 });
  blobSphere(m, {
    y: h * 0.56,
    rx: h * 0.155,
    ry: h * 0.42,
    seg: 8,
    rings: 6,
    color,
    wob: 0.04,
    bumps: 7,
    bumpAmt: 0.34,
    seed: seed + 9,
  });
  return finish(m, { radius: 0.35, sway: 0.8, kind: 'columnar' });
}

/** 시트 1-⑥: 길게 휜 줄기가 옆으로 누우며 넓은 구름 캐노피를 인 나무. */
export function leaningTree(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, P.leafDark, '#a5c980']);
  const h = rand(rng, 3.6, 4.5);
  const segs = 5;
  const segLen = h * 0.17;
  let px = 0;
  let py = 0;
  let tilt = 0.12;
  for (let i = 0; i < segs; i++) {
    const r0 = 0.25 - i * 0.033;
    const c = mesh();
    cylinder(c, { r: r0, r2: r0 - 0.03, h: segLen * 1.06, seg: 5, color: P.trunk, cap: false });
    merge(m, c, { rz: -tilt, tx: px, ty: py });
    px += Math.sin(tilt) * segLen;
    py += Math.cos(tilt) * segLen;
    tilt += 0.19 + i * 0.035;
  }
  cylinder(m, { r: 0.36, r2: 0.26, h: h * 0.08, seg: 6, color: P.trunk, cap: false });
  rootFlares(m, { r: 0.32, n: 4, len: 0.5, color: P.trunkDark, seed: seed + 21 });
  // 줄기 끝에서 두 갈래가 캐노피 속으로 더 뻗는다
  for (const s of [-0.35, 0.3]) {
    const t = mesh();
    cylinder(t, { r: 0.08, r2: 0.04, h: h * 0.22, seg: 4, color: P.trunk, cap: false });
    merge(m, t, { rz: -(tilt + s), tx: px, ty: py });
  }
  blobSphere(m, {
    x: px + h * 0.08,
    y: py + h * 0.1,
    z: 0,
    rx: h * 0.38,
    ry: h * 0.24,
    seg: 10,
    rings: 5,
    color,
    wob: 0.04,
    bumps: 8,
    bumpAmt: 0.44,
    seed: seed + 12,
  });
  return finish(m, { radius: 0.7, sway: 0.75, kind: 'leaning' });
}

/** 시트 1-⑦: 가장자리가 톱니처럼 거친 가느다란 사이프러스 첨탑. */
export function cypress(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = rand(rng, 3.2, 4.3);
  const color = pick(rng, [P.leafDark, '#5f9a52', P.leafBlue]);
  trunk(m, { h: h * 0.3, r: 0.1, top: 0.05, color: P.trunkDark, seg: 5, roots: 3, seed, flare: 0.5 });
  const bodyY = h * 0.12;
  const bodyR = h * 0.12;
  const bodyH = h * 0.86;
  cone(m, { y: bodyY, r: bodyR, h: bodyH, seg: 7, color });
  // 나선으로 잎다발을 붙여 실루엣을 거칠게
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = t * Math.PI * 5.2 + 0.4;
    const y = bodyY + bodyH * (0.08 + t * 0.78);
    const rr = bodyR * (1 - (y - bodyY) / bodyH) * 0.9;
    leafTip(m, {
      x: Math.cos(a) * rr,
      y,
      z: Math.sin(a) * rr,
      dir: a,
      out: 0.75,
      len: h * 0.11,
      wid: h * 0.05,
      color: i % 2 ? color : P.leafDark,
    });
  }
  return finish(m, { radius: 0.3, sway: 0.5, kind: 'cypress' });
}

/** 시트 1-⑨: 잎이 없는 어린 나무 — 두 갈래씩 갈라지는 마른 잔가지. */
export function bareTree(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = rand(rng, 3.2, 4.2);
  trunk(m, { h: h * 0.5, r: 0.14, top: 0.07, color: P.trunkDark, seg: 5, roots: 3, seed, flare: 0.45 });
  // rz(기울기) → ry(방위) 순으로 도니까 가지 끝 위치는 아래 벡터가 된다
  const branch = (x, y, z, ang, tilt, len, r, depth) => {
    const t = mesh();
    cylinder(t, { r, r2: r * 0.55, h: len, seg: 4, color: P.trunkDark, cap: false });
    merge(m, t, { rz: -tilt, ry: -ang, tx: x, ty: y, tz: z });
    if (depth <= 0) return;
    const nx = x + Math.sin(tilt) * Math.cos(ang) * len;
    const ny = y + Math.cos(tilt) * len;
    const nz = z + Math.sin(tilt) * Math.sin(ang) * len;
    branch(nx, ny, nz, ang + rand(rng, -0.5, 0.5), tilt + rand(rng, 0.3, 0.6), len * 0.6, r * 0.62, depth - 1);
    branch(nx, ny, nz, ang + Math.PI + rand(rng, -0.5, 0.5), tilt + rand(rng, 0.25, 0.55), len * 0.55, r * 0.58, depth - 1);
  };
  const base = rng() * 6.28;
  branch(0, h * 0.5, 0, base, 0.2, h * 0.3, 0.08, 1);
  branch(0, h * 0.44, 0, base + 2.4, 0.36, h * 0.24, 0.07, 1);
  return finish(m, { radius: 0.4, sway: 0.45, kind: 'bare' });
}

/** 늘어진 잎커튼을 두른 나무 — 구름 캐노피 + 아래로 처지는 뾰족한 잎가닥. */
export function willowTree(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = '#9cc47e';
  const h = rand(rng, 4.0, 5.0);
  trunk(m, { h: h * 0.48, r: 0.26, top: 0.16, seed, roots: 4 });
  const cy = h * 0.7;
  const rx = h * 0.36;
  blobSphere(m, { y: cy, rx, ry: rx * 0.6, seg: 10, rings: 4, color, wob: 0.04, bumps: 6, bumpAmt: 0.32, seed: seed + 5 });
  // 늘어지는 잎가닥 — 끝이 뾰족한 삼각형(양면)
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.25;
    const r = rx * (0.72 + rng() * 0.22);
    const len = rand(rng, 0.9, 1.8);
    const y0 = cy - rx * 0.28;
    tri(
      m,
      [Math.cos(a) * r - Math.sin(a) * 0.16, y0, Math.sin(a) * r + Math.cos(a) * 0.16],
      [Math.cos(a) * r + Math.sin(a) * 0.16, y0, Math.sin(a) * r - Math.cos(a) * 0.16],
      [Math.cos(a) * r * 1.1, y0 - len, Math.sin(a) * r * 1.1],
      i % 3 ? color : '#8ab471',
      { double: true }
    );
  }
  return finish(m, { radius: 0.6, sway: 1.0, kind: 'willow' });
}

/** 시트 2-⑫: 부러진 가지 그루와 옹이구멍이 있는 큰 고목. */
export function deadTrunk(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = rand(rng, 2.3, 3.1);
  const r = rand(rng, 0.3, 0.4);
  cylinder(m, { r: r * 1.5, r2: r * 1.12, h: h * 0.14, seg: 7, color: P.trunkDark, cap: false });
  cylinder(m, { y: h * 0.14, r: r * 1.12, r2: r * 0.68, h: h * 0.86, seg: 7, color: P.trunk, cap: false });
  rootFlares(m, { r: r * 1.4, n: 5, len: r * 1.6, color: P.trunkDark, seed: seed + 11 });
  // 꼭대기는 톱니처럼 부러진 파단면
  jaggedTop(m, { y: h, r: r * 0.68, seg: 7, spike: h * 0.14, color: P.wood, seed: seed + 3 });
  // 부러진 가지 그루 3개 — 끝도 삐죽하게 부러져 있다
  const stubs = [[0.6, 0.74, 0.42], [3.0, 0.6, 0.36], [4.7, 0.86, 0.3]];
  for (let i = 0; i < stubs.length; i++) {
    const a = stubs[i][0];
    const yf = stubs[i][1];
    const ln = stubs[i][2] * h * 0.42;
    const s = mesh();
    const sr = r * 0.3;
    cylinder(s, { r: sr, r2: sr * 0.72, h: ln, seg: 4, color: P.trunkDark, cap: false });
    jaggedTop(s, { y: ln, r: sr * 0.72, seg: 4, spike: h * 0.05, color: P.wood, seed: seed + 40 + i });
    const rad = r * (1.12 - 0.44 * yf) * 0.75;
    merge(m, s, { rz: -0.9, ry: -a, tx: Math.cos(a) * rad, ty: h * yf, tz: Math.sin(a) * rad });
  }
  // 옹이구멍 — 겉으로 살짝 튀어나온 테두리 + 어두운 속
  const ka = 0.35;
  const krad = r * 0.94 * 0.9;
  const knot = mesh();
  cylinder(knot, { r: r * 0.3, r2: r * 0.22, h: 0.06, seg: 6, color: P.trunkDark, capColor: '#7a5738' });
  merge(m, knot, { rz: -Math.PI / 2, ry: -ka, tx: Math.cos(ka) * krad, ty: h * 0.46, tz: Math.sin(ka) * krad });
  // 세로 껍질 결
  for (let i = 0; i < 3; i++) {
    const a = 1.3 + i * 2.0;
    const rr = r * 0.98;
    box(m, {
      x: Math.cos(a) * rr,
      z: Math.sin(a) * rr,
      y: h * (0.16 + i * 0.06),
      w: 0.07,
      h: h * 0.4,
      d: 0.1,
      color: P.trunkDark,
      ry: -a,
    });
  }
  return finish(m, { radius: r * 1.5, kind: 'deadTrunk' });
}

/** 시트 2-⑬: 밑에서 두 갈래로 갈라진 작은 전나무. */
export function firTree(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = rand(rng, 2.6, 3.4);
  const color = pick(rng, [P.leafDark, '#6fa35c']);
  // 갈라진 두 줄기
  for (const s of [-1, 1]) {
    const t = mesh();
    cylinder(t, { r: 0.075, r2: 0.05, h: h * 0.3, seg: 4, color: P.trunkDark, cap: false });
    merge(m, t, { rz: s * 0.24, tx: -s * 0.02 });
  }
  cylinder(m, { y: h * 0.26, r: 0.08, r2: 0.04, h: h * 0.2, seg: 4, color: P.trunkDark, cap: false });
  const coreY = h * 0.3;
  const coreR = h * 0.17;
  const coreH = h * 0.66;
  cone(m, { y: coreY, r: coreR, h: coreH, seg: 5, color });
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const y = h * (0.34 + t * 0.5);
    const r = h * (0.29 - t * 0.19);
    const r0 = Math.max(0.03, coreR * (1 - (y - coreY) / coreH) * 0.85);
    frondRing(m, { y, r0, r, droop: r * 0.3, n: 8 - i, color, phase: i * 0.5, rise: r * 0.18 });
  }
  return finish(m, { radius: 0.4, sway: 0.4, kind: 'fir' });
}

// ── 그루터기 · 통나무 · 가지 ──────────────────

/** 시트 3-⑭: 뿌리가 방사형으로 뻗고 잘린 면에 나이테가 있는 큰 그루터기. */
export function stump(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = rand(rng, 0.82, 1.25);
  const r = 0.42 * s;
  const h = 0.56 * s;
  cylinder(m, { r: r * 1.3, r2: r * 1.06, h: h * 0.26, seg: 8, color: P.trunkDark, cap: false });
  cylinder(m, { y: h * 0.26, r: r * 1.06, r2: r, h: h * 0.74, seg: 8, color: P.trunk, cap: true, capColor: P.wood });
  rootFlares(m, { r: r * 1.25, n: 5, len: r * 1.5, color: P.trunkDark, seed: seed + 7, rise: 0.02 });
  // 잘린 면의 나이테 — 얇게 도드라진 동심원 두 겹
  cylinder(m, { y: h, r: r * 0.62, h: 0.022 * s, seg: 7, color: '#e0c193', capColor: P.wood });
  cylinder(m, { y: h + 0.022 * s, r: r * 0.3, h: 0.018 * s, seg: 6, color: '#e0c193', capColor: '#e8d3ad' });
  // 세로 껍질 결
  for (let i = 0; i < 3; i++) {
    barkLine(m, { r: r * 1.02, a: 0.7 + i * 2.05, y0: h * 0.12, y1: h * 0.9, w: 0.06 * s, color: P.trunkDark });
  }
  return finish(m, { radius: r * 1.3, kind: 'stump' });
}

/** 시트 3-⑯: 세로로 쪼개져 삐죽하게 부러진 그루터기. */
export function splitStump(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = rand(rng, 0.85, 1.2);
  const r = 0.34 * s;
  cylinder(m, { r: r * 1.2, r2: r, h: 0.3 * s, seg: 7, color: P.trunk, cap: false });
  jaggedTop(m, { y: 0.3 * s, r, seg: 7, spike: 0.14 * s, color: P.wood, seed: seed + 2 });
  rootFlares(m, { r: r * 1.15, n: 4, len: r * 1.3, color: P.trunkDark, seed: seed + 5 });
  // 위로 남은 두 조각 — 높이가 서로 다르고 끝이 부러져 있다
  const shards = [[0.9, 0.62], [3.9, 0.44]];
  for (let i = 0; i < shards.length; i++) {
    const a = shards[i][0];
    const ln = shards[i][1] * s;
    const sh = mesh();
    cylinder(sh, { r: r * 0.44, r2: r * 0.3, h: ln, seg: 4, color: P.trunk, cap: false });
    jaggedTop(sh, { y: ln, r: r * 0.3, seg: 4, spike: 0.12 * s, color: P.wood, seed: seed + 30 + i });
    merge(m, sh, { rz: -0.12 + i * 0.2, tx: Math.cos(a) * r * 0.42, ty: 0.24 * s, tz: Math.sin(a) * r * 0.42 });
  }
  return finish(m, { radius: r * 1.2, kind: 'splitStump' });
}

/** 시트 3-⑳: 옆으로 누운 통나무 — 마구리에 나이테, 옆면에 긴 껍질 결. */
export function log(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const len = rand(rng, 1.4, 2.1);
  const r = rand(rng, 0.19, 0.26);
  const seg = 8;
  // 로컬에서는 +y 로 세워 두고 마지막에 눕힌다
  const b = mesh();
  cylinder(b, { y: -len / 2, r, h: len, seg, color: P.trunk, capColor: P.wood });
  const ring = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    ring.push([Math.cos(a) * r, -len / 2, Math.sin(a) * r]);
  }
  poly(b, ring, P.trunkDark); // 반대쪽 마구리(노멀 -y)
  // 마구리 나이테
  cylinder(b, { y: len / 2, r: r * 0.62, h: 0.02, seg: 7, color: P.wood, capColor: '#e8d3ad' });
  cylinder(b, { y: len / 2 + 0.02, r: r * 0.26, h: 0.016, seg: 6, color: '#e8d3ad', capColor: P.trunkDark });
  // 길게 이어지는 껍질 결(옆면을 따라 흐르는 손그림 선)
  for (let i = 0; i < 4; i++) {
    const a = 0.5 + i * 1.5;
    barkLine(b, { r, a, y0: -len * (0.36 + i * 0.03), y1: len * (0.4 - i * 0.04), w: 0.055, color: P.trunkDark });
  }
  merge(m, b, { rx: Math.PI / 2, ry: rand(rng, 0, 3.14), ty: r });
  return finish(m, { radius: r * 1.6, kind: 'log' });
}

/** 시트 3-㉑: 잔가지와 새눈이 달린 떨어진 나뭇가지. */
export function branchProp(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const len = rand(rng, 1.0, 1.5);
  const r = 0.045;
  const b = mesh();
  // 살짝 꺾인 본가지(로컬 +y)
  cylinder(b, { r, r2: r * 0.8, h: len * 0.55, seg: 4, color: P.trunkDark, cap: false });
  const upper = mesh();
  cylinder(upper, { r: r * 0.8, r2: r * 0.4, h: len * 0.5, seg: 4, color: P.trunkDark, cap: false });
  merge(b, upper, { rz: -0.16, ty: len * 0.55 });
  // 잔가지 3개 + 새눈
  const twigs = [[0.34, 0.5, 0.9], [0.6, -0.7, 2.2], [0.82, 0.55, 4.0]];
  for (let i = 0; i < twigs.length; i++) {
    const t0 = twigs[i][0];
    const tilt = twigs[i][1];
    const a = twigs[i][2];
    const tl = len * (0.2 + rng() * 0.14);
    const t = mesh();
    cylinder(t, { r: r * 0.45, r2: r * 0.18, h: tl, seg: 3, color: P.trunkDark, cap: false });
    merge(b, t, { rz: tilt, ry: -a, ty: len * t0 });
    flatLeaf(b, {
      x: Math.sin(tilt) * Math.cos(a) * tl,
      y: len * t0 + Math.cos(tilt) * tl,
      z: Math.sin(tilt) * Math.sin(a) * tl,
      len: 0.11,
      wid: 0.07,
      dir: a,
      tilt: 0.5,
      color: P.leaf,
    });
  }
  merge(m, b, { rz: -Math.PI / 2, ry: rand(rng, 0, 3.14), ty: r });
  return finish(m, { radius: len * 0.45, kind: 'branch' });
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

// ── 덤불 · 낮은 식물 ──────────────────────────

/** 시트 3-㉓: 뾰족한 잎이 위로 솟은 덤불(열매 옵션). */
export function bush(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, P.leafDark, '#a9cb84']);
  const s = rand(rng, 0.8, 1.15);
  const rx = 0.62 * s;
  const ry = 0.44 * s;
  blobSphere(m, { y: 0.4 * s, rx, ry, seg: 9, rings: 4, color, wob: 0.05, bumps: 5, bumpAmt: 0.36, seed: seed + 2 });
  // 위쪽 실루엣을 삐죽하게 만드는 잎끝 8장
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rng() * 0.3;
    const phi = 0.5 + rng() * 0.6;
    leafTip(m, {
      x: Math.sin(phi) * Math.cos(a) * rx * 0.85,
      y: 0.4 * s + Math.cos(phi) * ry * 0.9,
      z: Math.sin(phi) * Math.sin(a) * rx * 0.85,
      dir: a,
      out: 0.35,
      len: 0.34 * s,
      wid: 0.16 * s,
      color: i % 2 ? color : P.leafDark,
    });
  }
  if (opt.berries) {
    // 열매는 "그려진 동그라미" 한 장 — 바깥을 향해 눕힌 원판
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2;
      const phi = 0.6 + rng() * 0.5;
      disc(m, {
        x: Math.sin(phi) * Math.cos(a) * rx * 0.95,
        y: 0.4 * s + Math.cos(phi) * ry * 1.0,
        z: Math.sin(phi) * Math.sin(a) * rx * 0.95,
        r: 0.06 * s,
        seg: 6,
        color: '#d76a6a',
        double: true,
      });
    }
  }
  return finish(m, { radius: 0.5 * s, sway: 1.1, kind: 'bush' });
}

/** 시트 3-⑱: 넓고 낮은 스캘럽 덤불 언덕. */
export function shrubMound(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, '#9ec47c', P.leafDark]);
  const s = rand(rng, 0.85, 1.3);
  const rx = 0.9 * s;
  const ry = 0.4 * s;
  blobSphere(m, { y: 0.34 * s, rx, rz: rx * 0.72, ry, seg: 9, rings: 4, color, wob: 0.05, bumps: 6, bumpAmt: 0.34, seed: seed + 8 });
  // 윗면에 자잘한 뾰족 잎
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng() * 0.4;
    const rr = rx * (0.2 + rng() * 0.5);
    leafTip(m, {
      x: Math.cos(a) * rr,
      y: 0.34 * s + ry * 0.82,
      z: Math.sin(a) * rr * 0.72,
      dir: a,
      out: 0.3,
      len: 0.24 * s,
      wid: 0.13 * s,
      color: i % 2 ? P.leafDark : color,
    });
  }
  // 밑동에 삐져나온 풀 몇 장
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    arcBlade(m, {
      x: Math.cos(a) * rx * 0.85,
      z: Math.sin(a) * rx * 0.6,
      dir: a,
      len: 0.3 * s,
      wid: 0.07,
      bend: 0.5,
      color: P.grassDeep,
    });
  }
  return finish(m, { radius: rx * 0.85, sway: 1.0, kind: 'shrubMound' });
}

// ── 작은 식물(시트 2) ─────────────────────────

/** 뾰족한 잎날이 부챗살처럼 퍼진 풀포기. */
export function grassTuft(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = pick(rng, ['#a6cc7e', '#96c06f', '#b2d489', '#8fba68']);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.5;
    arcBlade(m, {
      x: Math.cos(a) * 0.05,
      z: Math.sin(a) * 0.05,
      dir: a,
      len: rand(rng, 0.4, 0.82),
      wid: rand(rng, 0.07, 0.11),
      bend: rand(rng, 0.22, 0.62),
      color: i % 3 === 0 ? P.grassDeep : color,
    });
  }
  return finish(m, { radius: 0, sway: 2.2, kind: 'grass' });
}

/** 둥근 꽃잎 5장 + 가는 줄기 + 잎 두 장. */
export function flower(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = pick(rng, ['#e8909f', '#efc86a', '#b79ede', '#f0f0e2', '#e88f6a']);
  const h = rand(rng, 0.34, 0.52);
  cylinder(m, { r: 0.014, h, seg: 4, color: '#8fba68', cap: false });
  const petals = 5;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + rng() * 0.2;
    flatLeaf(m, {
      x: Math.cos(a) * 0.022,
      y: h,
      z: Math.sin(a) * 0.022,
      len: 0.085,
      wid: 0.075,
      dir: a,
      tilt: 0.32,
      shape: 'round',
      color,
    });
  }
  disc(m, { y: h + 0.022, r: 0.028, seg: 6, color: P.leafGold, double: true });
  for (const sgn of [-1, 1]) {
    flatLeaf(m, {
      y: h * 0.4,
      len: 0.13,
      wid: 0.06,
      dir: sgn > 0 ? 0.5 : 3.4,
      tilt: 0.5,
      color: P.leaf,
    });
  }
  return finish(m, { radius: 0, sway: 2.0, kind: 'flower' });
}

/** 갈색 소시지 두 개가 넓은 잎날 사이에 선 부들. */
export function cattail(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng() * 0.4;
    arcBlade(m, {
      x: Math.cos(a) * 0.06,
      z: Math.sin(a) * 0.06,
      dir: a,
      len: rand(rng, 0.75, 1.15),
      wid: 0.1,
      bend: rand(rng, 0.3, 0.55),
      color: P.grassDeep,
    });
  }
  const stems = [[-0.07, 0.95], [0.08, 1.12]];
  for (let i = 0; i < stems.length; i++) {
    const x = stems[i][0];
    const sh = stems[i][1];
    cylinder(m, { x, r: 0.016, h: sh, seg: 3, color: P.grassDeep, cap: false });
    cylinder(m, { x, y: sh - 0.3, r: 0.055, h: 0.26, seg: 5, color: P.trunkDark, cap: false });
    cone(m, { x, y: sh - 0.04, r: 0.055, h: 0.07, seg: 5, color: P.trunkDark });
    cylinder(m, { x, y: sh + 0.03, r: 0.012, h: 0.14, seg: 3, color: P.grassDeep, cap: false });
  }
  return finish(m, { radius: 0, sway: 1.6, kind: 'cattail' });
}

/** 시트 2-⑪: 잎이 몇 장 붙은 가는 회초리 묘목. */
export function sapling(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = rand(rng, 0.4, 0.62);
  cylinder(m, { r: 0.022, r2: 0.01, h, seg: 4, color: P.trunk, cap: false });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng();
    const t = 0.45 + i * 0.16;
    const tl = h * 0.34;
    const tw = mesh();
    cylinder(tw, { r: 0.012, r2: 0.005, h: tl, seg: 3, color: P.trunk, cap: false });
    merge(m, tw, { rz: -0.75, ry: -a, ty: h * t });
    flatLeaf(m, {
      x: Math.sin(0.75) * Math.cos(a) * tl,
      y: h * t + Math.cos(0.75) * tl,
      z: Math.sin(0.75) * Math.sin(a) * tl,
      len: 0.13,
      wid: 0.08,
      dir: a,
      tilt: 0.45,
      color: P.leaf,
    });
  }
  flatLeaf(m, { y: h, len: 0.12, wid: 0.07, dir: 1.2, tilt: 0.9, color: P.leaf });
  return finish(m, { radius: 0, sway: 2.0, kind: 'sapling' });
}

/** 시트 2-⑩: 떡잎 두 장짜리 아주 작은 싹. */
export function seedling(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = rand(rng, 0.07, 0.11);
  cylinder(m, { r: 0.011, h, seg: 3, color: '#8fba68', cap: false });
  const a = rng() * Math.PI * 2;
  for (const sgn of [0, Math.PI]) {
    flatLeaf(m, { y: h, len: 0.1, wid: 0.085, dir: a + sgn, tilt: 0.55, shape: 'round', color: P.leaf });
  }
  return finish(m, { radius: 0, sway: 2.4, kind: 'seedling' });
}

/** 활처럼 휜 줄기에 작은 잎이 마주 붙은 고사리. */
export function fernPlant(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = pick(rng, [P.leaf, '#8ab96a', P.grassDeep]);
  const fronds = 3;
  for (let f = 0; f < fronds; f++) {
    const dir = (f / fronds) * Math.PI * 2 + rng() * 0.4;
    const len = rand(rng, 0.34, 0.46);
    // 두 토막으로 이어 붙여 활 모양을 만든다
    const t0 = 0.4;
    const t1 = 0.95;
    const s0 = mesh();
    cylinder(s0, { r: 0.016, r2: 0.012, h: len, seg: 3, color: P.grassDeep, cap: false });
    merge(m, s0, { rz: -t0, ry: -dir });
    const bx = Math.sin(t0) * Math.cos(dir) * len;
    const by = Math.cos(t0) * len;
    const bz = Math.sin(t0) * Math.sin(dir) * len;
    const s1 = mesh();
    cylinder(s1, { r: 0.012, r2: 0.005, h: len * 0.8, seg: 3, color: P.grassDeep, cap: false });
    merge(m, s1, { rz: -t1, ry: -dir, tx: bx, ty: by, tz: bz });
    // 마주보는 작은 잎 3쌍
    for (let i = 0; i < 3; i++) {
      const k = 0.35 + i * 0.26;
      const tt = t0 + (t1 - t0) * k;
      const px = Math.sin(tt) * Math.cos(dir) * len * (0.4 + k);
      const py = Math.cos(tt) * len * (0.4 + k) * 0.95;
      const pz = Math.sin(tt) * Math.sin(dir) * len * (0.4 + k);
      const lf = 0.15 - i * 0.028;
      for (const sgn of [1, -1]) {
        flatLeaf(m, {
          x: px,
          y: py,
          z: pz,
          len: lf,
          wid: lf * 0.5,
          dir: dir + sgn * 1.15,
          tilt: 0.35,
          color,
        });
      }
    }
  }
  // 아직 안 펴진 새순(도르르 말린 끝)
  cylinder(m, { r: 0.012, h: 0.26, seg: 3, color: P.grassDeep, cap: false });
  disc(m, { y: 0.29, r: 0.045, seg: 6, color, double: true });
  return finish(m, { radius: 0.3, sway: 1.8, kind: 'fern' });
}

/** 톱니 잎 위로 솟은 민들레 — 홀씨 공과 노란 꽃 한 송이. */
export function dandelion(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  // 바닥에 깔린 톱니 잎 4장
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng() * 0.5;
    flatLeaf(m, {
      y: 0.012,
      len: rand(rng, 0.26, 0.34),
      wid: 0.14,
      dir: a,
      tilt: 0.28,
      shape: 'tooth',
      color: pick(rng, [P.leaf, P.grassDeep]),
    });
  }
  // 홀씨 줄기
  const h = rand(rng, 0.42, 0.56);
  cylinder(m, { r: 0.012, h, seg: 3, color: P.grassDeep, cap: false });
  blobSphere(m, { y: h + 0.07, rx: 0.09, ry: 0.085, seg: 6, rings: 3, color: '#f4f1e6', wob: 0.14, seed: seed + 4 });
  // 옆에 선 노란 꽃 한 송이
  const fh = h * 0.66;
  const fa = rng() * Math.PI * 2;
  const fx = Math.cos(fa) * 0.1;
  const fz = Math.sin(fa) * 0.1;
  cylinder(m, { x: fx, z: fz, r: 0.011, h: fh, seg: 3, color: P.grassDeep, cap: false });
  cylinder(m, { x: fx, z: fz, y: fh, r: 0.055, r2: 0.07, h: 0.035, seg: 6, color: P.leafGold, capColor: '#f2cf74' });
  return finish(m, { radius: 0.3, sway: 1.9, kind: 'dandelion' });
}

/** 세 갈래 둥근 잎의 클로버 무리. */
export function cloverPatch(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = pick(rng, [P.leaf, '#93c46f']);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.6;
    const rr = rand(rng, 0.06, 0.16);
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const h = rand(rng, 0.13, 0.22);
    cylinder(m, { x, z, r: 0.009, h, seg: 3, color: P.grassDeep, cap: false });
    const base = rng() * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const la = base + (k / 3) * Math.PI * 2;
      flatLeaf(m, {
        x: x + Math.cos(la) * 0.012,
        y: h,
        z: z + Math.sin(la) * 0.012,
        len: 0.075,
        wid: 0.075,
        dir: la,
        tilt: 0.22,
        shape: 'round',
        color,
      });
    }
  }
  // 작은 흰 꽃 한 송이
  const fh = 0.24;
  cylinder(m, { x: 0.02, z: -0.04, r: 0.008, h: fh, seg: 3, color: P.grassDeep, cap: false });
  blobSphere(m, { x: 0.02, z: -0.04, y: fh + 0.035, rx: 0.045, ry: 0.04, seg: 5, rings: 2, color: '#f3efe1', wob: 0.16, seed: seed + 6 });
  return finish(m, { radius: 0.2, sway: 2.0, kind: 'clover' });
}

/** 돌돌 말린 덩굴 — 구불구불 올라가는 줄기에 하트 잎. */
export function vinePlant(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = pick(rng, [P.leaf, P.leafDark]);
  const segs = 6;
  const segLen = rand(rng, 0.13, 0.17);
  let px = 0;
  let py = 0;
  let pz = 0;
  let a = rng() * Math.PI * 2;
  for (let i = 0; i < segs; i++) {
    const tilt = 0.42 + (i % 2) * 0.12;
    const s = mesh();
    cylinder(s, { r: 0.016 - i * 0.0015, r2: 0.014 - i * 0.0015, h: segLen * 1.08, seg: 3, color: P.grassDeep, cap: false });
    merge(m, s, { rz: -tilt, ry: -a, tx: px, ty: py, tz: pz });
    // 마디마다 잎 한 장
    if (i > 0) {
      flatLeaf(m, { x: px, y: py, z: pz, len: 0.14, wid: 0.11, dir: a + 1.5, tilt: 0.4, shape: 'heart', color });
    }
    px += Math.sin(tilt) * Math.cos(a) * segLen;
    py += Math.cos(tilt) * segLen;
    pz += Math.sin(tilt) * Math.sin(a) * segLen;
    a += 1.15;
  }
  // 끝의 말린 덩굴손
  for (let i = 0; i < 3; i++) {
    const ca = a + i * 1.6;
    tri(
      m,
      [px, py, pz],
      [px + Math.cos(ca) * 0.06, py + 0.03, pz + Math.sin(ca) * 0.06],
      [px + Math.cos(ca + 0.9) * 0.09, py + 0.09, pz + Math.sin(ca + 0.9) * 0.09],
      color,
      { double: true }
    );
  }
  return finish(m, { radius: 0.2, sway: 1.7, kind: 'vine' });
}

/** 시트 3-㉔ / 시트 2의 버섯 — 갓 아래로 퍼진 챙과 점무늬. */
export function mushroom(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const capColor = pick(rng, ['#e08a76', '#d9a05b', '#c98fb0', '#e8cf9a']);
  const s = rand(rng, 0.7, 1.2);
  const stemH = 0.2 * s;
  const capR = 0.17 * s;
  cylinder(m, { r: 0.042 * s, r2: 0.05 * s, h: stemH, seg: 6, color: '#f2e7cf', cap: false });
  // 갓 밑면(주름) — 아래를 보는 원판
  const und = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    und.push([Math.cos(a) * capR, stemH, Math.sin(a) * capR]);
  }
  poly(m, und, '#e4d3b4');
  cylinder(m, { y: stemH, r: capR, r2: capR * 0.72, h: 0.06 * s, seg: 7, color: capColor, cap: false });
  cone(m, { y: stemH + 0.06 * s, r: capR * 0.72, h: 0.085 * s, seg: 7, color: capColor });
  // 갓 위 점무늬
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng();
    const rr = capR * (0.3 + rng() * 0.3);
    disc(m, {
      x: Math.cos(a) * rr,
      y: stemH + 0.075 * s,
      z: Math.sin(a) * rr,
      r: 0.03 * s,
      seg: 5,
      color: '#f6efdd',
      double: true,
    });
  }
  return finish(m, { radius: capR, kind: 'mushroom' });
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
