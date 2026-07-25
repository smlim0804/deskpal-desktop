// 레퍼런스 시트 5(Buildings & Structures)를 보고 만든 저폴리 3D 건물.
import { mesh, merge, box, gable, cylinder, cone, blobSphere, extrude, tri, quad, panel, plate, bounds } from '../core/mesh.js';
import { P } from '../art/palette.js';
import { makeRng, rand } from '../core/rng.js';

function finish(m, meta) {
  const bb = bounds(m);
  return Object.assign(m, {
    hUnits: bb.h,
    radius: Math.max(bb.w, bb.d) * 0.36,
    shadowR: Math.max(bb.w, bb.d) * 0.34,
    ...meta,
  });
}

// 벽에 딱 붙는 얇은 판(문·창문·간판)
function decal(m, { x = 0, y = 0, z = 0, w = 0.5, h = 0.7, color = P.woodDark, ry = 0, tilt = 0 }) {
  panel(m, { x, y, z, w, h, color, ry, tilt });
}

// ── 살림집 ────────────────────────────────────
export function cottage(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const roof = opt.roof || P.roofRed;
  const w = rand(rng, 2.3, 2.8);
  const d = rand(rng, 1.9, 2.3);
  const wallH = rand(rng, 1.7, 2.1);
  box(m, { w, d, h: wallH, color: P.plaster });
  gable(m, { y: wallH, w, d, h: rand(rng, 1.0, 1.3), color: roof, eave: 0.16 });
  // 문 · 창문
  decal(m, { z: d / 2 + 0.02, x: -w * 0.18, y: 0, w: 0.6, h: 1.05, color: P.woodDark });
  decal(m, { z: d / 2 + 0.02, x: w * 0.24, y: 0.85, w: 0.5, h: 0.5, color: '#cfe3ea' });
  decal(m, { x: w / 2 + 0.02, z: -d * 0.16, y: 0.8, w: 0.5, h: 0.5, color: '#cfe3ea', ry: Math.PI / 2 });
  // 굴뚝
  box(m, { x: w * 0.28, z: -d * 0.22, y: wallH + 0.35, w: 0.3, d: 0.3, h: 0.85, color: P.stoneDark, top: '#8f8778' });
  // 현관 디딤돌
  cylinder(m, { z: d / 2 + 0.28, x: -w * 0.18, r: 0.34, h: 0.08, seg: 7, color: P.stone });
  return finish(m, { radius: Math.max(w, d) * 0.42, kind: 'cottage' });
}

// ── 초가 오두막 ───────────────────────────────
export function tinyHut(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const r = rand(rng, 0.95, 1.15);
  cylinder(m, { r, r2: r * 0.97, h: 1.05, seg: 9, color: P.plaster, cap: false });
  cone(m, { y: 1.05, r: r * 1.34, h: 1.15, seg: 9, color: P.roofStraw, skirt: -0.12 });
  cone(m, { y: 2.1, r: 0.16, h: 0.22, seg: 6, color: P.trunkDark });
  decal(m, { z: r * 0.99, w: 0.55, h: 1.0, color: P.woodDark });
  return finish(m, { radius: r + 0.15, kind: 'hut' });
}

// ── 상점 좌판 ─────────────────────────────────
export function shopStall(seed = 1) {
  const m = mesh();
  const w = 2.6;
  const d = 1.2;
  box(m, { w, d, h: 0.85, color: P.wood, top: '#e8cba0' });
  for (const s of [-1, 1]) box(m, { x: s * (w / 2 - 0.1), z: d / 2 - 0.1, w: 0.12, d: 0.12, h: 2.1, color: P.woodDark });
  // 줄무늬 차양 — 좁은 박공을 색 번갈아 이어 붙인다
  const stripes = 7;
  for (let i = 0; i < stripes; i++) {
    const sw = (w + 0.5) / stripes;
    gable(m, {
      x: -(w + 0.5) / 2 + sw * (i + 0.5),
      y: 2.05,
      w: sw + 0.01,
      d: d + 0.7,
      h: 0.42,
      color: i % 2 ? P.roofRed : P.cloth,
    });
  }
  // 간판
  decal(m, { y: 2.5, z: 0.1, w: 1.2, h: 0.62, color: P.plaster });
  blobSphere(m, { y: 2.82, z: 0.16, rx: 0.16, ry: 0.2, seg: 6, rings: 3, color: P.acorn, wob: 0.05, seed: 9 });
  // 진열품
  for (let i = 0; i < 4; i++) {
    cylinder(m, {
      x: -0.95 + i * 0.62,
      z: 0.1,
      y: 0.85,
      r: 0.16,
      r2: 0.12,
      h: 0.34,
      seg: 6,
      color: i % 2 ? P.leafGold : P.leafBlue,
    });
  }
  return finish(m, { radius: 1.3, kind: 'shop' });
}

// ── 풍차 ─────────────────────────────────────
export function windmill(seed = 1) {
  const m = mesh();
  const h = 3.4;
  cylinder(m, { r: 1.0, r2: 0.68, h, seg: 10, color: P.plaster, cap: false });
  cone(m, { y: h, r: 0.86, h: 0.95, seg: 10, color: P.roofBlue, skirt: -0.08 });
  decal(m, { z: 0.98, w: 0.6, h: 1.05, color: P.woodDark });
  decal(m, { z: 0.8, y: 1.9, w: 0.42, h: 0.5, color: '#cfe3ea' });
  // 날개 축
  const hubY = h * 0.82;
  const hubZ = 0.78;
  const hub = mesh();
  cylinder(hub, { r: 0.12, h: 0.24, seg: 7, color: P.woodDark });
  merge(m, hub, { rx: Math.PI / 2, ty: hubY, tz: hubZ });
  for (let i = 0; i < 4; i++) {
    const blade = mesh();
    box(blade, { w: 0.14, d: 0.08, h: 1.7, color: P.woodDark });
    box(blade, { x: 0.28, y: 0.45, w: 0.44, d: 0.05, h: 1.1, color: P.cloth });
    merge(m, blade, { rz: (i / 4) * Math.PI * 2 + 0.5, ty: hubY, tz: hubZ + 0.1 });
  }
  return finish(m, { radius: 1.05, kind: 'windmill' });
}

// ── 망루 ─────────────────────────────────────
export function tower(seed = 1) {
  const m = mesh();
  const h = 3.6;
  cylinder(m, { r: 0.85, r2: 0.78, h, seg: 10, color: P.stone, cap: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    box(m, {
      x: Math.cos(a) * 0.72,
      z: Math.sin(a) * 0.72,
      y: h,
      w: 0.3,
      d: 0.24,
      h: 0.28,
      color: P.stoneDark,
      ry: -a,
    });
  }
  cone(m, { y: h + 0.28, r: 0.92, h: 1.1, seg: 10, color: P.roofRed, skirt: -0.06 });
  cylinder(m, { y: h + 1.38, r: 0.03, h: 0.4, seg: 4, color: P.trunkDark, cap: false });
  panel(m, { y: h + 1.5, z: 0.02, w: 0.42, h: 0.26, color: P.roofBlue, ry: 0.2 });
  decal(m, { z: 0.84, w: 0.55, h: 1.0, color: P.woodDark });
  decal(m, { z: 0.8, y: 1.9, w: 0.34, h: 0.46, color: '#cfe3ea' });
  return finish(m, { radius: 0.95, kind: 'tower' });
}

// ── 천막 ─────────────────────────────────────
export function tent(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const r = rand(rng, 1.1, 1.35);
  const h = rand(rng, 1.7, 2.1);
  cone(m, { r, h, seg: 8, color: P.cloth });
  // 입구
  tri(m, [-0.3, 0, r * 0.92], [0.3, 0, r * 0.92], [0, h * 0.5, r * 0.42], '#c8b89a', {
    double: true,
  });
  cylinder(m, { y: h, r: 0.03, h: 0.34, seg: 4, color: P.trunkDark, cap: false });
  panel(m, { y: h + 0.06, z: 0.02, w: 0.36, h: 0.22, color: P.roofRed, ry: 0.3 });
  // 고정 말뚝
  for (const s of [-1, 1]) {
    cylinder(m, { x: s * (r + 0.35), z: -r * 0.3, r: 0.04, h: 0.22, seg: 4, color: P.trunkDark, cap: false });
  }
  return finish(m, { radius: r * 0.8, kind: 'tent' });
}

// ── 마을 대문 ─────────────────────────────────
export function gateArch(seed = 1) {
  const m = mesh();
  const postX = 1.7;
  const postH = 2.5;
  for (const s of [-1, 1]) {
    cylinder(m, { x: s * postX, r: 0.19, r2: 0.16, h: postH, seg: 7, color: P.wood });
    // 버팀목
    const brace = mesh();
    cylinder(brace, { r: 0.07, h: 0.7, seg: 5, color: P.woodDark, cap: false });
    merge(m, brace, { rz: -s * 0.8, tx: s * (postX - 0.1), ty: postH - 0.75 });
  }
  // 아치 — 짧은 각재를 곡선을 따라 잇는다
  const segs = 9;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const p0 = archPoint(t0, postX, postH);
    const p1 = archPoint(t1, postX, postH);
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy);
    const piece = mesh();
    box(piece, { w: 0.16, d: 0.16, h: len * 1.12, color: P.woodDark });
    merge(m, piece, { rz: Math.atan2(-dx, dy), tx: p0[0], ty: p0[1] });
  }
  // 현판 + 콩 문양
  decal(m, { y: postH - 0.55, z: 0.06, w: 1.25, h: 0.55, color: P.plaster });
  blobSphere(m, { y: postH - 0.28, z: 0.12, rx: 0.15, ry: 0.19, seg: 6, rings: 3, color: '#f2e2c4', wob: 0.04, seed: 4 });
  // 깃발 · 등불
  cylinder(m, { x: -postX, y: postH, r: 0.03, h: 0.5, seg: 4, color: P.trunkDark, cap: false });
  panel(m, { x: -postX + 0.02, y: postH + 0.18, w: 0.44, h: 0.3, color: P.roofRed, ry: 0.25 });
  cylinder(m, { x: postX, y: postH - 0.35, r: 0.02, h: 0.3, seg: 4, color: P.trunkDark, cap: false });
  cylinder(m, { x: postX, y: postH - 0.72, r: 0.15, r2: 0.13, h: 0.34, seg: 6, color: '#ffe6a8' });
  return finish(m, { radius: 0, kind: 'gate' });
}

function archPoint(t, postX, postH) {
  const a = Math.PI * (1 - t);
  return [Math.cos(a) * postX, postH - 0.1 + Math.sin(a) * 0.62];
}

// ── 우물 ─────────────────────────────────────
export function well(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 0.78, r2: 0.72, h: 0.62, seg: 10, color: P.stone, capColor: P.stoneDark });
  cylinder(m, { y: 0.6, r: 0.6, h: 0.04, seg: 10, color: P.waterDeep });
  for (const s of [-1, 1]) box(m, { x: s * 0.6, w: 0.14, d: 0.14, h: 1.4, y: 0.6, color: P.wood });
  gable(m, { y: 1.98, w: 1.7, d: 1.0, h: 0.6, color: P.roofStraw, eave: 0.14 });
  const bar = mesh();
  cylinder(bar, { r: 0.06, h: 1.2, seg: 5, color: P.woodDark, cap: false });
  merge(m, bar, { rz: -Math.PI / 2, tx: -0.6, ty: 1.85 });
  cylinder(m, { y: 1.35, r: 0.015, h: 0.45, seg: 4, color: P.trunkDark, cap: false });
  cylinder(m, { y: 1.1, r: 0.17, r2: 0.15, h: 0.26, seg: 6, color: P.wood });
  return finish(m, { radius: 0.9, kind: 'well' });
}

// ── 돌다리 ────────────────────────────────────
export function bridge(seed = 1) {
  const m = mesh();
  const span = 3.6;
  const rise = 0.62;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const t0 = -1 + (2 * i) / segs;
    const t1 = -1 + (2 * (i + 1)) / segs;
    const z0 = (t0 * span) / 2;
    const z1 = (t1 * span) / 2;
    const y0 = rise * (1 - t0 * t0);
    const y1 = rise * (1 - t1 * t1);
    const len = Math.hypot(z1 - z0, y1 - y0);
    const piece = mesh();
    box(piece, { w: 1.9, d: len * 1.1, h: 0.18, color: P.stone, top: '#e6e0d0' });
    merge(m, piece, { rx: -Math.atan2(y1 - y0, z1 - z0), tz: (z0 + z1) / 2, ty: (y0 + y1) / 2 });
  }
  // 난간
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 4; i++) {
      const t = -1 + i / 2;
      const z = (t * span) / 2;
      const y = rise * (1 - t * t) + 0.18;
      box(m, { x: s * 0.88, z, y, w: 0.12, d: 0.12, h: 0.42, color: P.stoneDark });
    }
  }
  return finish(m, { radius: 0, kind: 'bridge' });
}

// ── 무너진 아치 ───────────────────────────────
export function ruinArch(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const postX = 1.25;
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pts.push([Math.cos(a) * rand(rng, 0.32, 0.44), Math.sin(a) * rand(rng, 0.3, 0.42)]);
    }
    extrude(m, { x: s * postX, pts, h: s > 0 ? 1.5 : 2.4, color: P.stone, topColor: P.stoneDark, topScale: 0.85 });
  }
  // 남은 아치 조각 (한쪽만)
  for (let i = 0; i < 4; i++) {
    const t = i / 9;
    const a = Math.PI * (1 - t);
    const piece = mesh();
    box(piece, { w: 0.34, d: 0.34, h: 0.42, color: P.stoneDark });
    merge(m, piece, { rz: -a + Math.PI / 2, tx: Math.cos(a) * postX, ty: 2.3 + Math.sin(a) * 0.5 });
  }
  // 굴러떨어진 돌
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      pts.push([Math.cos(a) * 0.24, Math.sin(a) * 0.24]);
    }
    extrude(m, {
      x: rand(rng, -2.2, 2.2),
      z: rand(rng, -0.9, 0.9),
      pts,
      h: 0.24,
      color: P.stoneDark,
      topColor: P.stone,
      topScale: 0.7,
    });
  }
  return finish(m, { radius: 1.0, kind: 'ruin' });
}

// ── 작은 것들 ─────────────────────────────────
export function fencePiece(seed = 1) {
  const m = mesh();
  for (let i = 0; i < 3; i++) {
    const x = -0.8 + i * 0.8;
    box(m, { x, w: 0.14, d: 0.12, h: 0.78, color: P.wood });
    cone(m, { x, y: 0.78, r: 0.11, h: 0.14, seg: 4, color: P.wood });
  }
  for (const y of [0.28, 0.56]) box(m, { y, w: 1.9, d: 0.07, h: 0.09, color: P.woodDark });
  return finish(m, { radius: 0.5, kind: 'fence' });
}

export function lampPost(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 0.09, r2: 0.06, h: 2.3, seg: 6, color: '#4b463d', cap: false });
  const arm = mesh();
  cylinder(arm, { r: 0.045, h: 0.5, seg: 4, color: '#4b463d', cap: false });
  merge(m, arm, { rz: -Math.PI / 2, ty: 2.28, tx: 0.02 });
  cylinder(m, { x: 0.5, y: 1.92, r: 0.03, h: 0.34, seg: 4, color: '#4b463d', cap: false });
  cylinder(m, { x: 0.5, y: 1.56, r: 0.19, r2: 0.15, h: 0.38, seg: 6, color: '#ffe1a0' });
  cone(m, { x: 0.5, y: 1.94, r: 0.22, h: 0.14, seg: 6, color: '#4b463d' });
  return finish(m, { radius: 0.2, kind: 'lamp' });
}

export function signPost(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 0.07, h: 1.4, seg: 5, color: P.woodDark });
  const a = mesh();
  box(a, { w: 0.75, d: 0.07, h: 0.28, color: P.wood });
  merge(m, a, { tx: 0.35, ty: 1.0, ry: 0.35 });
  const b = mesh();
  box(b, { w: 0.65, d: 0.07, h: 0.25, color: P.wood });
  merge(m, b, { tx: -0.32, ty: 0.62, ry: -0.5 });
  return finish(m, { radius: 0.2, kind: 'sign' });
}

export function barrel(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 0.3, r2: 0.27, h: 0.72, seg: 8, color: P.wood, capColor: '#e0bd8f' });
  for (const y of [0.12, 0.52]) cylinder(m, { y, r: 0.32, h: 0.07, seg: 8, color: P.trunkDark, cap: false });
  return finish(m, { radius: 0.34, kind: 'barrel' });
}

export function crate(seed = 1) {
  const m = mesh();
  box(m, { w: 0.62, d: 0.62, h: 0.6, color: P.wood, top: '#e0bd8f' });
  return finish(m, { radius: 0.36, kind: 'crate' });
}

export function cart(seed = 1) {
  const m = mesh();
  box(m, { y: 0.42, w: 1.5, d: 0.9, h: 0.45, color: P.wood, top: '#c99e6c' });
  box(m, { y: 0.3, w: 1.3, d: 0.7, h: 0.14, color: P.woodDark });
  for (const s of [-1, 1]) {
    const wheel = mesh();
    cylinder(wheel, { r: 0.34, h: 0.1, seg: 9, color: P.trunkDark, capColor: P.wood });
    merge(m, wheel, { rz: Math.PI / 2, tx: s * 0.68, ty: 0.34, tz: 0.05 });
  }
  const shaft = mesh();
  cylinder(shaft, { r: 0.05, h: 1.0, seg: 4, color: P.woodDark, cap: false });
  merge(m, shaft, { rx: -1.25, ty: 0.62, tz: 0.5 });
  return finish(m, { radius: 0.7, kind: 'cart' });
}

export function campfire(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    blobSphere(m, {
      x: Math.cos(a) * 0.5,
      z: Math.sin(a) * 0.5,
      y: 0.08,
      rx: 0.15,
      ry: 0.1,
      seg: 5,
      rings: 3,
      color: P.stone,
      wob: 0.18,
      seed: seed + i,
    });
  }
  for (let i = 0; i < 2; i++) {
    const logM = mesh();
    cylinder(logM, { r: 0.07, h: 0.75, seg: 5, color: P.trunkDark, cap: false });
    merge(m, logM, { rz: Math.PI / 2, ry: i * 1.2, tx: -0.35, ty: 0.1 });
  }
  cone(m, { y: 0.14, r: 0.22, h: 0.55, seg: 5, color: P.fire });
  cone(m, { y: 0.16, r: 0.11, h: 0.34, seg: 5, color: '#ffe08a' });
  return finish(m, { radius: 0.45, kind: 'campfire' });
}
