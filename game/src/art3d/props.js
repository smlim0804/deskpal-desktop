// 레퍼런스 Sheet 4(소품)·Sheet 7(장식과 경계)·지형 시트를 보고 만든 저폴리 3D 소품.
import { mesh, merge, box, gable, cylinder, cone, blobSphere, extrude, tri, quad, panel, bounds } from '../core/mesh.js';
import { P } from '../art/palette.js';
import { makeRng, rand, randInt } from '../core/rng.js';

function finish(m, meta) {
  const bb = bounds(m);
  return Object.assign(m, {
    hUnits: bb.h,
    radius: Math.max(bb.w, bb.d) * 0.34,
    shadowR: Math.max(bb.w, bb.d) * 0.34,
    ...meta,
  });
}

const WOOD = P.wood;
const DARK = P.woodDark;
const STONE = P.stone;
const STONE_D = P.stoneDark;
const CLOTH = P.cloth;

// ── Sheet 4 : 소품 ────────────────────────────
/** 자루 (감자 자루) */
export function sack(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = rand(rng, 0.85, 1.15);
  blobSphere(m, {
    y: 0.3 * s,
    rx: 0.3 * s,
    ry: 0.32 * s,
    seg: 8,
    rings: 4,
    color: '#ddceac',
    wob: 0.12,
    bumps: 3,
    bumpAmt: 0.18,
    seed: seed + 1,
  });
  cylinder(m, { y: 0.56 * s, r: 0.11 * s, r2: 0.07 * s, h: 0.14 * s, seg: 6, color: '#cbbb96' });
  cone(m, { y: 0.68 * s, r: 0.09 * s, h: 0.14 * s, seg: 5, color: '#ddceac' });
  return finish(m, { radius: 0.3 * s, kind: 'sack' });
}

/** 나무 양동이 */
export function bucket(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 0.17, r2: 0.2, h: 0.3, seg: 8, color: WOOD, capColor: '#9cc9d4' });
  cylinder(m, { y: 0.24, r: 0.21, h: 0.04, seg: 8, color: DARK, cap: false });
  const handle = mesh();
  cylinder(handle, { r: 0.02, h: 0.42, seg: 4, color: DARK, cap: false });
  merge(m, handle, { rz: Math.PI / 2, tx: -0.2, ty: 0.42 });
  return finish(m, { radius: 0.22, kind: 'bucket' });
}

/** 소박한 탁자 */
export function table(seed = 1) {
  const m = mesh();
  const w = 1.3;
  const d = 0.85;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(m, { x: sx * (w / 2 - 0.1), z: sz * (d / 2 - 0.1), w: 0.1, d: 0.1, h: 0.6, color: DARK });
    }
  }
  box(m, { y: 0.6, w, d, h: 0.09, color: WOOD, top: '#e2c295' });
  return finish(m, { radius: 0.62, kind: 'table' });
}

/** 등받이 의자 */
export function chair(seed = 1) {
  const m = mesh();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(m, { x: sx * 0.19, z: sz * 0.19, w: 0.07, d: 0.07, h: 0.42, color: DARK });
    }
  }
  box(m, { y: 0.42, w: 0.5, d: 0.5, h: 0.07, color: WOOD, top: '#e2c295' });
  box(m, { z: -0.21, y: 0.49, w: 0.46, d: 0.07, h: 0.46, color: WOOD });
  return finish(m, { radius: 0.3, kind: 'chair' });
}

/** 통나무 벤치 */
export function logBench(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const len = rand(rng, 1.5, 2.0);
  const t = mesh();
  cylinder(t, { r: 0.22, h: len, seg: 8, color: P.trunk, capColor: '#dcb98c' });
  merge(m, t, { rx: Math.PI / 2, ty: 0.36, tz: len / 2 });
  // 다리
  for (const s of [-1, 1]) {
    box(m, { z: s * (len / 2 - 0.28), y: 0, w: 0.16, d: 0.16, h: 0.36, color: DARK });
  }
  // 윗면을 깎아 앉는 자리
  box(m, { y: 0.5, w: 0.34, d: len - 0.2, h: 0.05, color: '#e2c295' });
  return finish(m, { radius: 0.5, kind: 'bench' });
}

/** 보물 상자 */
export function chest(seed = 1) {
  const m = mesh();
  box(m, { w: 0.8, d: 0.52, h: 0.36, color: WOOD, top: '#c99e6c' });
  // 둥근 뚜껑
  const lid = mesh();
  cylinder(lid, { r: 0.27, h: 0.8, seg: 8, color: DARK, cap: false });
  merge(m, lid, { rz: Math.PI / 2, tx: -0.4, ty: 0.36 });
  box(m, { z: 0.27, y: 0.2, w: 0.14, d: 0.04, h: 0.2, color: '#d9b25e' });
  for (const sx of [-0.28, 0.28]) box(m, { x: sx, z: 0.265, y: 0, w: 0.06, d: 0.03, h: 0.36, color: '#d9b25e' });
  return finish(m, { radius: 0.45, kind: 'chest' });
}

/** 바구니 */
export function basket(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 0.26, r2: 0.31, h: 0.28, seg: 9, color: '#d8b482', capColor: '#c79f6a' });
  const handle = mesh();
  cylinder(handle, { r: 0.02, h: 0.62, seg: 4, color: '#b8945f', cap: false });
  merge(m, handle, { rz: Math.PI / 2, tx: -0.31, ty: 0.5 });
  for (let i = 0; i < 3; i++) {
    blobSphere(m, {
      x: -0.1 + i * 0.1,
      z: (i % 2) * 0.08 - 0.04,
      y: 0.3,
      rx: 0.08,
      ry: 0.07,
      seg: 5,
      rings: 3,
      color: i % 2 ? '#d76a6a' : '#e0b45c',
      wob: 0.08,
      seed: seed + i,
    });
  }
  return finish(m, { radius: 0.32, kind: 'basket' });
}

/** 항아리 */
export function potVase(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = rand(rng, 0.85, 1.2);
  cylinder(m, { r: 0.16 * s, r2: 0.26 * s, h: 0.24 * s, seg: 9, color: '#dcc7a4', cap: false });
  cylinder(m, { y: 0.24 * s, r: 0.26 * s, r2: 0.15 * s, h: 0.28 * s, seg: 9, color: '#dcc7a4', cap: false });
  cylinder(m, { y: 0.52 * s, r: 0.15 * s, r2: 0.17 * s, h: 0.1 * s, seg: 9, color: '#cbb492' });
  return finish(m, { radius: 0.26 * s, kind: 'pot' });
}

/** 외바퀴 수레 */
export function wheelbarrow(seed = 1) {
  const m = mesh();
  box(m, { y: 0.34, w: 0.72, d: 0.5, h: 0.3, color: WOOD, top: '#a98b62' });
  const wheel = mesh();
  cylinder(wheel, { r: 0.22, h: 0.08, seg: 9, color: DARK, capColor: WOOD });
  merge(m, wheel, { rz: Math.PI / 2, tz: 0.42, ty: 0.22 });
  for (const s of [-1, 1]) {
    const handle = mesh();
    cylinder(handle, { r: 0.04, h: 0.95, seg: 4, color: DARK, cap: false });
    merge(m, handle, { rx: -1.25, tx: s * 0.26, ty: 0.36, tz: -0.2 });
  }
  box(m, { x: -0.2, z: -0.34, y: 0, w: 0.07, d: 0.07, h: 0.36, color: DARK });
  box(m, { x: 0.2, z: -0.34, y: 0, w: 0.07, d: 0.07, h: 0.36, color: DARK });
  return finish(m, { radius: 0.45, kind: 'wheelbarrow' });
}

/** 포장마차 */
export function coveredWagon(seed = 1) {
  const m = mesh();
  box(m, { y: 0.5, w: 1.9, d: 1.0, h: 0.55, color: WOOD, top: '#a98b62' });
  // 천막 — 반원 아치를 판으로 세운다
  const ribs = 7;
  for (let i = 0; i <= ribs; i++) {
    const t = i / ribs;
    const a = Math.PI * t;
    const y = 1.05 + Math.sin(a) * 0.62;
    const x = Math.cos(a) * 0.55;
    const piece = mesh();
    box(piece, { w: 0.1, d: 1.06, h: 0.1, color: CLOTH });
    merge(m, piece, { tx: x, ty: y });
  }
  for (const s of [-1, 1]) {
    panel(m, { x: 0, z: s * 0.53, y: 1.05, w: 1.15, h: 0.62, color: CLOTH });
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = mesh();
      const r = sz > 0 ? 0.36 : 0.28;
      cylinder(wheel, { r, h: 0.09, seg: 10, color: DARK, capColor: WOOD });
      merge(m, wheel, { rz: Math.PI / 2, tx: sx * 0.98, tz: sz * 0.55, ty: r });
    }
  }
  const shaft = mesh();
  cylinder(shaft, { r: 0.05, h: 1.1, seg: 4, color: DARK, cap: false });
  merge(m, shaft, { rz: -Math.PI / 2 + 0.2, tx: -0.95, ty: 0.55 });
  return finish(m, { radius: 1.0, kind: 'wagon' });
}

/** 우편함 */
export function mailbox(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 0.06, h: 1.0, seg: 5, color: DARK, cap: false });
  const bodyM = mesh();
  cylinder(bodyM, { r: 0.16, h: 0.42, seg: 8, color: '#c9d2d6', capColor: '#b6c0c6' });
  merge(m, bodyM, { rz: Math.PI / 2, tx: -0.21, ty: 1.06 });
  box(m, { y: 0.9, w: 0.44, d: 0.3, h: 0.16, color: '#c9d2d6' });
  // 깃발
  box(m, { x: 0.2, y: 1.05, w: 0.04, d: 0.04, h: 0.26, color: '#c2603a' });
  panel(m, { x: 0.24, y: 1.2, w: 0.16, h: 0.12, color: '#c2603a' });
  return finish(m, { radius: 0.2, kind: 'mailbox' });
}

/** 새집 */
export function birdhouse(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 0.06, h: 1.5, seg: 5, color: DARK, cap: false });
  box(m, { y: 1.5, w: 0.36, d: 0.34, h: 0.36, color: '#e0c08f' });
  gable(m, { y: 1.86, w: 0.4, d: 0.38, h: 0.22, color: P.roofRed, eave: 0.05 });
  cylinder(m, { z: 0.18, y: 1.68, r: 0.06, h: 0.02, seg: 7, color: '#6b5b45' });
  cylinder(m, { z: 0.22, y: 1.62, r: 0.02, h: 0.1, seg: 4, color: DARK, cap: false });
  return finish(m, { radius: 0.2, kind: 'birdhouse' });
}

/** 그루터기에 박힌 도끼 + 장작 */
export function choppingBlock(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  cylinder(m, { r: 0.34, r2: 0.31, h: 0.46, seg: 8, color: P.trunk, capColor: '#dcb98c' });
  const handle = mesh();
  cylinder(handle, { r: 0.032, h: 0.6, seg: 4, color: DARK, cap: false });
  merge(m, handle, { rz: 0.5, tx: 0.05, ty: 0.44 });
  const head = mesh();
  box(head, { w: 0.1, d: 0.06, h: 0.22, color: '#b9bfc4' });
  merge(m, head, { rz: 0.5 + 1.5, tx: -0.24, ty: 0.94 });
  for (let i = 0; i < 3; i++) {
    const logM = mesh();
    cylinder(logM, { r: 0.08, h: 0.42, seg: 5, color: P.trunk, capColor: '#dcb98c' });
    merge(m, logM, { rx: Math.PI / 2, tx: rand(rng, -0.75, -0.45), tz: rand(rng, -0.3, 0.3), ty: 0.08 });
  }
  return finish(m, { radius: 0.4, kind: 'block' });
}

// ── Sheet 7 : 장식 · 경계 ─────────────────────
/** 마을 분수 */
export function fountain(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 1.35, r2: 1.3, h: 0.42, seg: 14, color: STONE, cap: false });
  cylinder(m, { y: 0.34, r: 1.22, h: 0.06, seg: 14, color: '#9ecfd8' });
  cylinder(m, { y: 0.4, r: 1.3, r2: 1.24, h: 0.12, seg: 14, color: STONE_D, cap: false });
  cylinder(m, { y: 0.4, r: 0.28, h: 0.5, seg: 9, color: STONE_D });
  cylinder(m, { y: 0.9, r: 0.62, r2: 0.5, h: 0.16, seg: 12, color: STONE, capColor: '#9ecfd8' });
  cylinder(m, { y: 1.06, r: 0.12, h: 0.42, seg: 7, color: STONE_D });
  blobSphere(m, { y: 1.56, rx: 0.16, ry: 0.2, seg: 6, rings: 3, color: '#bfe0e6', wob: 0.1, seed: seed + 2 });
  // 물줄기
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const jet = mesh();
    cylinder(jet, { r: 0.03, h: 0.5, seg: 4, color: '#cfe9ee', cap: false });
    merge(m, jet, { rz: 0.7, ry: -a, tx: Math.cos(a) * 0.12, tz: Math.sin(a) * 0.12, ty: 1.6 });
  }
  return finish(m, { radius: 1.35, kind: 'fountain' });
}

/** 마을 석상 (콩 기사) */
export function statue(seed = 1) {
  const m = mesh();
  box(m, { w: 1.2, d: 1.2, h: 0.3, color: STONE_D, top: STONE });
  box(m, { y: 0.3, w: 0.9, d: 0.9, h: 0.5, color: STONE, top: '#e4ded0' });
  // 콩 모양 몸
  blobSphere(m, { y: 1.35, rx: 0.34, ry: 0.52, seg: 9, rings: 5, color: STONE, wob: 0.05, seed: seed + 1 });
  for (const s of [-1, 1]) {
    const arm = mesh();
    cylinder(arm, { r: 0.08, h: 0.44, seg: 5, color: STONE, cap: false });
    merge(m, arm, { rz: s * 0.4, tx: s * 0.3, ty: 1.15 });
  }
  // 창
  cylinder(m, { x: 0.36, y: 0.8, r: 0.04, h: 1.3, seg: 4, color: STONE_D, cap: false });
  cone(m, { x: 0.36, y: 2.1, r: 0.08, h: 0.24, seg: 5, color: STONE_D });
  for (const s of [-1, 1]) cylinder(m, { x: s * 0.14, y: 0.8, r: 0.09, h: 0.28, seg: 5, color: STONE });
  return finish(m, { radius: 0.7, kind: 'statue' });
}

/** 게시판 */
export function noticeBoard(seed = 1) {
  const m = mesh();
  for (const s of [-1, 1]) box(m, { x: s * 0.52, w: 0.12, d: 0.12, h: 1.3, color: DARK });
  box(m, { y: 0.62, w: 1.24, d: 0.09, h: 0.8, color: '#e0c08f' });
  gable(m, { y: 1.42, w: 1.4, d: 0.4, h: 0.22, color: DARK, eave: 0.08 });
  for (let i = 0; i < 3; i++) {
    panel(m, {
      x: -0.36 + i * 0.36,
      y: 0.78 + (i % 2) * 0.12,
      z: 0.05,
      w: 0.26,
      h: 0.3,
      color: '#f6f2e6',
    });
  }
  return finish(m, { radius: 0.6, kind: 'notice' });
}

/** 돌담 */
export function stoneWall(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const n = 5 - (r % 2);
    for (let i = 0; i < n; i++) {
      const w = 2.0 / n;
      box(m, {
        x: -1.0 + w * (i + 0.5) + rand(rng, -0.03, 0.03),
        y: r * 0.28,
        w: w * rand(rng, 0.86, 0.96),
        d: rand(rng, 0.38, 0.46),
        h: 0.28,
        color: r % 2 ? STONE : STONE_D,
        top: '#e2ddcf',
        ry: rand(rng, -0.08, 0.08),
      });
    }
  }
  return finish(m, { radius: 0.9, kind: 'stonewall' });
}

/** 밧줄 울타리 */
export function ropeFence(seed = 1) {
  const m = mesh();
  const span = 2.2;
  for (const s of [-1, 1]) {
    cylinder(m, { x: s * span * 0.5, r: 0.09, r2: 0.07, h: 0.85, seg: 6, color: DARK });
    blobSphere(m, { x: s * span * 0.5, y: 0.9, rx: 0.09, ry: 0.08, seg: 5, rings: 3, color: WOOD, wob: 0.05, seed: 3 });
  }
  // 늘어진 밧줄 (3토막으로 근사)
  const pts = [-0.5, -0.17, 0.17, 0.5];
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i] * span;
    const x1 = pts[i + 1] * span;
    const y0 = 0.68 - Math.cos(pts[i] * Math.PI) * 0.0 - (0.25 - Math.abs(pts[i]) * 0.5) * 0.6;
    const y1 = 0.68 - (0.25 - Math.abs(pts[i + 1]) * 0.5) * 0.6;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const rope = mesh();
    cylinder(rope, { r: 0.028, h: len, seg: 4, color: '#c9b18a', cap: false });
    merge(m, rope, { rz: Math.atan2(-(x1 - x0), y1 - y0), tx: x0, ty: y0 });
  }
  return finish(m, { radius: 0.9, kind: 'ropefence' });
}

/** 철제 울타리 */
export function ironFence(seed = 1) {
  const m = mesh();
  const span = 2.0;
  const bars = 7;
  for (let i = 0; i < bars; i++) {
    const x = -span / 2 + (span / (bars - 1)) * i;
    cylinder(m, { x, r: 0.028, h: 0.95, seg: 4, color: '#4b463d', cap: false });
    cone(m, { x, y: 0.95, r: 0.05, h: 0.12, seg: 4, color: '#4b463d' });
  }
  for (const y of [0.24, 0.72]) box(m, { y, w: span, d: 0.035, h: 0.035, color: '#4b463d' });
  return finish(m, { radius: 0.9, kind: 'ironfence' });
}

/** 나무 대문 (양쪽으로 열리는) */
export function woodGate(seed = 1) {
  const m = mesh();
  for (const s of [-1, 1]) {
    box(m, { x: s * 1.05, w: 0.24, d: 0.24, h: 1.7, color: STONE_D, top: STONE });
    cone(m, { x: s * 1.05, y: 1.7, r: 0.16, h: 0.16, seg: 6, color: STONE });
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      box(m, { x: s * (0.16 + i * 0.22), w: 0.2, d: 0.09, h: 1.3 - i * 0.04, color: WOOD });
    }
    box(m, { x: s * 0.5, y: 0.34, w: 0.86, d: 0.06, h: 0.1, color: DARK });
    box(m, { x: s * 0.5, y: 0.95, w: 0.86, d: 0.06, h: 0.1, color: DARK });
  }
  return finish(m, { radius: 1.1, kind: 'woodgate' });
}

/** 돌 아치 (담쟁이) */
export function stoneArch(seed = 1) {
  const m = mesh();
  const R = 1.05;
  for (const s of [-1, 1]) {
    box(m, { x: s * R, w: 0.42, d: 0.42, h: 1.5, color: STONE, top: STONE_D });
  }
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI * (i / segs);
    const a1 = Math.PI * ((i + 1) / segs);
    const x0 = Math.cos(Math.PI - a0) * R;
    const y0 = 1.5 + Math.sin(a0) * R * 0.75;
    const x1 = Math.cos(Math.PI - a1) * R;
    const y1 = 1.5 + Math.sin(a1) * R * 0.75;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const piece = mesh();
    box(piece, { w: 0.34, d: 0.42, h: len * 1.2, color: i % 2 ? STONE : STONE_D, top: STONE });
    merge(m, piece, { rz: Math.atan2(-(x1 - x0), y1 - y0), tx: x0, ty: y0 });
  }
  // 담쟁이
  const rng = makeRng(seed + 4);
  for (let i = 0; i < 9; i++) {
    blobSphere(m, {
      x: rand(rng, -1.3, 1.3),
      y: rand(rng, 0.8, 2.3),
      z: 0.22,
      rx: 0.16,
      ry: 0.12,
      seg: 5,
      rings: 3,
      color: P.leafDark,
      wob: 0.2,
      seed: seed + 10 + i,
    });
  }
  return finish(m, { radius: 1.2, kind: 'stonearch' });
}

/** 삼각 깃발 가랜드 */
export function bunting(seed = 1) {
  const m = mesh();
  const span = 3.2;
  for (const s of [-1, 1]) cylinder(m, { x: s * span * 0.5, r: 0.05, h: 1.9, seg: 5, color: DARK, cap: false });
  const colors = ['#d9834a', '#8fb0c4', '#e0b45c', '#93b787', '#c98fb0'];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = -span / 2 + span * t;
    const y = 1.86 - Math.sin(t * Math.PI) * 0.34;
    // 줄
    const seg = mesh();
    box(seg, { w: span / (n - 1) + 0.04, d: 0.02, h: 0.02, color: '#6b6156' });
    merge(m, seg, { tx: x, ty: y });
    // 깃발
    tri(
      m,
      [x - 0.11, y - 0.02, 0],
      [x + 0.11, y - 0.02, 0],
      [x, y - 0.34, 0],
      colors[i % colors.length],
      { double: true }
    );
  }
  return finish(m, { radius: 0.3, kind: 'bunting' });
}

/** 긴 깃발 (장대) */
export function banner(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  cylinder(m, { r: 0.06, h: 2.6, seg: 5, color: DARK, cap: false });
  blobSphere(m, { y: 2.66, rx: 0.08, ry: 0.09, seg: 5, rings: 3, color: '#d9b25e', wob: 0.04, seed: seed + 1 });
  const col = ['#c2603a', '#7f96b8', '#93b787'][randInt(rng, 0, 2)];
  box(m, { x: 0.34, y: 1.35, w: 0.62, d: 0.03, h: 1.05, color: col });
  tri(m, [0.03, 1.35, 0], [0.65, 1.35, 0], [0.34, 1.08, 0], col, { double: true });
  return finish(m, { radius: 0.3, kind: 'banner' });
}

/** 기둥과 사슬 */
export function bollardChain(seed = 1) {
  const m = mesh();
  const span = 1.6;
  for (const s of [-1, 1]) {
    cylinder(m, { x: s * span * 0.5, r: 0.09, r2: 0.07, h: 0.6, seg: 6, color: STONE_D });
    blobSphere(m, { x: s * span * 0.5, y: 0.64, rx: 0.09, ry: 0.09, seg: 5, rings: 3, color: STONE, wob: 0.03, seed: 2 });
  }
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4;
    const t1 = (i + 1) / 4;
    const x0 = (-0.5 + t0) * span;
    const x1 = (-0.5 + t1) * span;
    const y0 = 0.56 - Math.sin(t0 * Math.PI) * 0.16;
    const y1 = 0.56 - Math.sin(t1 * Math.PI) * 0.16;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const link = mesh();
    cylinder(link, { r: 0.022, h: len, seg: 4, color: '#4b463d', cap: false });
    merge(m, link, { rz: Math.atan2(-(x1 - x0), y1 - y0), tx: x0, ty: y0 });
  }
  return finish(m, { radius: 0.7, kind: 'bollard' });
}

/** 통 화분 */
export function planterBarrel(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  cylinder(m, { r: 0.3, r2: 0.27, h: 0.5, seg: 8, color: WOOD, capColor: '#a98b62' });
  for (const y of [0.1, 0.38]) cylinder(m, { y, r: 0.32, h: 0.05, seg: 8, color: DARK, cap: false });
  const colors = ['#e8909f', '#efc86a', '#b79ede', '#f0f0e2'];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    blobSphere(m, {
      x: Math.cos(a) * 0.15,
      z: Math.sin(a) * 0.15,
      y: 0.56 + rand(rng, 0, 0.1),
      rx: 0.1,
      ry: 0.09,
      seg: 5,
      rings: 3,
      color: i % 2 ? P.leaf : colors[i % colors.length],
      wob: 0.16,
      seed: seed + i,
    });
  }
  return finish(m, { radius: 0.34, kind: 'planter' });
}

// ── 지형 시트 : 바위 · 흙더미 · 동굴 ───────────
/** 선돌 무리 */
export function monolith(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const n = randInt(rng, 2, 4);
  for (let i = 0; i < n; i++) {
    const h = rand(rng, 1.4, 3.0);
    const w = rand(rng, 0.4, 0.7);
    const pts = [];
    const sides = 5;
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const r = w * rand(rng, 0.8, 1.15);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    extrude(m, {
      x: rand(rng, -1.2, 1.2),
      z: rand(rng, -0.8, 0.8),
      pts,
      h,
      color: STONE_D,
      topColor: STONE,
      topScale: rand(rng, 0.7, 0.9),
      topOffset: [rand(rng, -0.1, 0.1), rand(rng, -0.1, 0.1)],
    });
  }
  // 발치 자갈
  for (let i = 0; i < 4; i++) {
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      pts.push([Math.cos(a) * 0.2, Math.sin(a) * 0.2]);
    }
    extrude(m, { x: rand(rng, -1.8, 1.8), z: rand(rng, -1.2, 1.2), pts, h: 0.18, color: STONE_D, topColor: STONE, topScale: 0.7 });
  }
  return finish(m, { radius: 1.1, kind: 'monolith' });
}

/** 돌무더기 */
export function rockMound(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const n = randInt(rng, 4, 7);
  for (let i = 0; i < n; i++) {
    const s = rand(rng, 0.3, 0.62);
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      pts.push([Math.cos(a) * s * rand(rng, 0.8, 1.1), Math.sin(a) * s * rand(rng, 0.8, 1.1)]);
    }
    extrude(m, {
      x: rand(rng, -0.8, 0.8),
      z: rand(rng, -0.6, 0.6),
      y: rng() < 0.3 ? rand(rng, 0.2, 0.4) : 0,
      pts,
      h: s * rand(rng, 0.7, 1.1),
      color: STONE_D,
      topColor: STONE,
      topScale: 0.62,
    });
  }
  return finish(m, { radius: 0.9, kind: 'rockmound' });
}

/** 흙더미 (풀이 난 언덕) */
export function dirtMound(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const r = rand(rng, 1.1, 1.9);
  blobSphere(m, {
    y: -0.1,
    rx: r,
    ry: rand(rng, 0.5, 0.85),
    seg: 10,
    rings: 4,
    color: '#b3c98a',
    wob: 0.08,
    bumps: 3,
    bumpAmt: 0.16,
    seed: seed + 3,
  });
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2;
    const rr = r * rand(rng, 0.2, 0.8);
    tri(
      m,
      [Math.cos(a) * rr - 0.06, 0.4, Math.sin(a) * rr],
      [Math.cos(a) * rr + 0.06, 0.4, Math.sin(a) * rr],
      [Math.cos(a) * rr + rand(rng, -0.1, 0.1), 0.4 + rand(rng, 0.3, 0.55), Math.sin(a) * rr],
      '#9dc06f',
      { double: true, outline: false }
    );
  }
  return finish(m, { radius: r * 0.8, kind: 'mound' });
}

/** 동굴 입구 */
export function caveEntrance(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const segs = 9;
  const R = 1.5;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI * (i / segs);
    const a1 = Math.PI * ((i + 1) / segs);
    const mid = (a0 + a1) / 2;
    const bx = Math.cos(Math.PI - mid) * R;
    const by = Math.sin(mid) * R * 1.15;
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      pts.push([Math.cos(a) * rand(rng, 0.3, 0.45), Math.sin(a) * rand(rng, 0.3, 0.45)]);
    }
    extrude(m, { x: bx, y: by, z: 0, pts, h: 0.5, color: STONE, topColor: STONE_D, topScale: 0.8 });
  }
  // 어두운 안쪽
  const dark = mesh();
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (i / 12);
    pts.push([Math.cos(Math.PI - a) * R * 0.86, Math.sin(a) * R * 1.02, 0]);
  }
  pts.push([R * 0.86, 0, 0]);
  pts.push([-R * 0.86, 0, 0]);
  const idx = pts.map((p) => {
    dark.verts.push(p[0], p[1], -0.4);
    return dark.verts.length / 3 - 1;
  });
  dark.faces.push({ v: idx, color: '#4a4640', outline: true, double: true, soft: false });
  merge(m, dark, {});
  return finish(m, { radius: 1.5, kind: 'cave' });
}
