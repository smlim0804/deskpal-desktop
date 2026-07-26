// 레퍼런스 시트 5(Buildings & Structures)를 "그림 한 장 = 모델 한 개"로 옮긴 저폴리 3D 건물.
// 목표는 분위기가 아니라 동일성 — 실루엣·비례·눈에 보이는 요소의 개수까지 그림과 맞춘다.
// (울타리 살 3개·뾰족한 머리, 풍차 날개 4개는 전부 사다리꼴 격자, 성가퀴 이빨 개수 …)
import {
  mesh,
  merge,
  box,
  gable,
  cylinder as rawCylinder,
  cone as rawCone,
  blobSphere,
  extrude as rawExtrude,
  tri,
  quad,
  poly,
  panel,
  plate,
  bounds,
} from '../core/mesh.js';
import { P } from '../art/palette.js';
import { makeRng, rand } from '../core/rng.js';

// (예전에는 mesh.js 의 cylinder/cone/extrude 옆면 감기가 안쪽을 향해서 여기서 뒤집어 줬다.
//  엔진 쪽을 고쳤으므로 이제는 그대로 쓴다)
const cylinder = rawCylinder;
const cone = rawCone;
const extrude = rawExtrude;

function finish(m, meta) {
  const bb = bounds(m);
  return Object.assign(m, {
    hUnits: bb.h,
    radius: Math.max(bb.w, bb.d) * 0.36,
    shadowR: Math.max(bb.w, bb.d) * 0.34,
    ...meta,
  });
}

// ── 공용 헬퍼 ─────────────────────────────────
// 잉크 선은 실루엣과 날카로운 크리스에만 붙는다. 그래서 문·창살·널 이음매는
// 전부 "진짜 판(면)"으로 만들어 바깥으로 살짝 띄운다. 그래야 그림의 선이 3D 에 나온다.

/** ry 로 돌아간 벽면의 지역 좌표계. p(u,v,off) 는 벽 위 (가로 u, 높이 v) 를 off 만큼 띄운 점 */
function wallFrame(cx, cy, cz, ry = 0) {
  const nx = Math.sin(ry);
  const nz = Math.cos(ry);
  const ux = Math.cos(ry);
  const uz = -Math.sin(ry);
  return {
    ry,
    p(u, v, off = 0) {
      return [cx + ux * u + nx * off, cy + v, cz + uz * u + nz * off];
    },
    // v 는 판의 "중심" 높이 (panel 은 바닥 기준이라 절반을 빼 준다)
    panel(m, u, v, w, h, color, off = 0.02) {
      const q = this.p(u, v - h / 2, off);
      panel(m, { x: q[0], y: q[1], z: q[2], w, h, color, ry });
      return this;
    },
  };
}

/**
 * 벽통 — 앞면(+z)을 splits 높이에서 가로로 쪼갠다.
 * 잉크 렌더러는 "면 중심 깊이"로 정렬하므로 벽 한 장이 너무 크면 그 위에 붙인 문이
 * 벽 뒤로 밀려 사라진다. 문 윗선에서 벽을 끊어 주면 문이 제대로 앞에 온다.
 */
function wallBox(m, { x = 0, y = 0, z = 0, w = 1, d = 1, h = 1, color = '#ccc', top = null, ry = 0, splits = [], opening = null }) {
  const hw = w / 2;
  const hd = d / 2;
  const b = mesh();
  if (opening) {
    // 문구멍을 진짜로 뚫는다 — 좌·우 벽기둥 + 그 위 인방띠.
    // 인방띠도 splits 높이에서 끊어 준다(안 그러면 띠 한 장이 문 아치 머리를 덮어 버린다)
    const { u0, u1, top: ot } = opening;
    quad(b, [-hw, 0, hd], [u0, 0, hd], [u0, ot, hd], [-hw, ot, hd], color);
    quad(b, [u1, 0, hd], [hw, 0, hd], [hw, ot, hd], [u1, ot, hd], color);
    const ys = [ot, ...splits.filter((v) => v > ot && v < h), h];
    for (let i = 0; i < ys.length - 1; i++) {
      quad(b, [-hw, ys[i], hd], [hw, ys[i], hd], [hw, ys[i + 1], hd], [-hw, ys[i + 1], hd], color);
    }
  } else {
    const ys = [0, ...splits.filter((v) => v > 0 && v < h), h];
    for (let i = 0; i < ys.length - 1; i++) {
      quad(b, [-hw, ys[i], hd], [hw, ys[i], hd], [hw, ys[i + 1], hd], [-hw, ys[i + 1], hd], color);
    }
  }
  quad(b, [hw, 0, hd], [hw, 0, -hd], [hw, h, -hd], [hw, h, hd], color);
  quad(b, [hw, 0, -hd], [-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd], color);
  quad(b, [-hw, 0, -hd], [-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd], color);
  quad(b, [-hw, h, hd], [hw, h, hd], [hw, h, -hd], [-hw, h, -hd], top || color);
  merge(m, b, { tx: x, ty: y, tz: z, ry });
  return m;
}

/** 두 점을 잇는 가는 막대 — 밧줄·버팀줄·아치 조각에 쓴다 */
function strut(m, p0, p1, r, color, seg = 4) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const dz = p1[2] - p0[2];
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const s = mesh();
  cylinder(s, { r, h: len, seg, color, cap: false });
  const phi = Math.acos(Math.max(-1, Math.min(1, dy / len)));
  // rz 는 +y 를 (-sinφ, cosφ, 0) 으로 보내므로 ry 는 atan2(dz, -dx) 여야 한다
  const th = Math.atan2(dz, -dx);
  merge(m, s, { rz: phi, ry: th, tx: p0[0], ty: p0[1], tz: p0[2] });
}

/** 두 점을 잇는 각재 — 아치 목재·버팀목·수레채 */
function beam(m, p0, p1, w, d, color, over = 1.0) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const dz = p1[2] - p0[2];
  const len = (Math.hypot(dx, dy, dz) || 0.001) * over;
  const s = mesh();
  box(s, { w, d, h: len, color });
  const phi = Math.acos(Math.max(-1, Math.min(1, dy / (len / over))));
  // rz 는 +y 를 (-sinφ, cosφ, 0) 으로 보내므로 ry 는 atan2(dz, -dx) 여야 한다
  const th = Math.atan2(dz, -dx);
  merge(m, s, { rz: phi, ry: th, tx: p0[0], ty: p0[1], tz: p0[2] });
}

/** 십자 창살 창문 — 틀 + 유리 + 세로살 + 가로살 (면 4장) */
function crossWindow(m, W, u, v, w, h, frame = P.woodDark, glass = '#cfe3ea') {
  W.panel(m, u, v, w, h, frame, 0.04);
  W.panel(m, u, v, w - 0.1, h - 0.1, glass, 0.055);
  W.panel(m, u, v, 0.045, h - 0.1, frame, 0.07);
  W.panel(m, u, v, w - 0.1, 0.045, frame, 0.07);
}

/** 격자(멀리언) 창 — 틀 + 유리 + 세로살 1 + 가로살 2 + 창턱. 그림의 풍차 중간 창이 이 모양 */
function mullionWindow(m, W, u, v, w, h, frame = P.woodDark, glass = '#cfe3ea') {
  W.panel(m, u, v, w + 0.09, h + 0.09, frame, 0.04);
  W.panel(m, u, v, w, h, glass, 0.055);
  W.panel(m, u, v, 0.05, h, frame, 0.07);
  for (const k of [-0.2, 0.2]) W.panel(m, u, v + k * h, w, 0.05, frame, 0.07);
  W.panel(m, u, v - h / 2 - 0.08, w + 0.18, 0.09, frame, 0.06);
}

/** 둥근 창 — 원판 테두리 + 유리 + 십자 창살 (오두막 박공에 쓰는 그림의 그 창) */
function roundWindow(m, W, u, v, r, frame = P.woodDark, glass = '#cfe3ea') {
  const disc = (rr, col, off) => {
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      pts.push(W.p(u + Math.cos(a) * rr, v + Math.sin(a) * rr, off));
    }
    poly(m, pts, col, { double: true });
  };
  disc(r, frame, 0.04);
  disc(r - 0.06, glass, 0.055);
  W.panel(m, u, v, 0.04, r * 1.9, frame, 0.07);
  W.panel(m, u, v, r * 1.9, 0.04, frame, 0.07);
}

/** 널을 세로로 댄 사각 문 (틀 + 문짝 + 널 이음매 + 손잡이) */
function plankDoor(m, W, u, v0, w, h, frame = '#8a6a45', slab = P.woodDark, planks = 3) {
  W.panel(m, u, v0 + (h + 0.06) / 2, w + 0.11, h + 0.06, frame, 0.05);
  W.panel(m, u, v0 + h / 2, w, h, slab, 0.065);
  for (let i = 1; i < planks; i++) W.panel(m, u - w / 2 + (w * i) / planks, v0 + h / 2, 0.035, h - 0.09, frame, 0.08);
  W.panel(m, u + w * 0.3, v0 + h * 0.45, 0.07, 0.07, frame, 0.085);
}

/** 윗머리가 둥근 아치문 — 실루엣이 통째로 잉크선이 되도록 양면 폴리곤 한 장 */
function archDoor(m, W, u, v0, w, h, frame = '#8a6a45', slab = P.woodDark, planks = 3) {
  const arc = (ww, hh, off) => {
    const hwv = ww / 2;
    const sp = hh - hwv;
    const pts = [W.p(u - hwv, v0, off), W.p(u + hwv, v0, off), W.p(u + hwv, v0 + sp, off)];
    for (let i = 1; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      pts.push(W.p(u + Math.cos(a) * hwv, v0 + sp + Math.sin(a) * hwv, off));
    }
    pts.push(W.p(u - hwv, v0 + sp, off));
    return pts;
  };
  poly(m, arc(w + 0.12, h + 0.08, 0.05), frame, { double: true });
  poly(m, arc(w, h, 0.07), slab, { double: true });
  for (let i = 1; i < planks; i++) {
    const uu = u - w / 2 + (w * i) / planks;
    W.panel(m, uu, v0 + h * 0.4, 0.035, h * 0.68, frame, 0.09);
  }
}

/** 머리가 뾰족한 울타리 살 하나 */
function picket(m, { x = 0, y = 0, z = 0, w = 0.15, d = 0.09, h = 0.72, ry = 0, color = P.wood }) {
  box(m, { x, y, z, w, d, h, color, ry });
  cone(m, { x, y: y + h, z, r: w * 0.72, h: 0.15, seg: 4, color, ry: ry + Math.PI / 4 });
}

/** 그림의 왼쪽 울타리 — 뾰족한 살 n 개 + 가로대 2줄 (가로대는 양끝으로 튀어나온다) */
function picketRun(m, { x = 0, y = 0, z = 0, ry = 0, n = 3, gap = 0.42, h = 0.72, color = P.wood }) {
  const run = mesh();
  for (let i = 0; i < n; i++) picket(run, { x: (i - (n - 1) / 2) * gap, h, color });
  const span = (n - 1) * gap + 0.34;
  for (const ry2 of [0.26, 0.5]) box(run, { y: h * ry2, w: span, d: 0.06, h: 0.075, color: P.woodDark });
  merge(m, run, { tx: x, ty: y, tz: z, ry });
}

/** X 자 결속(밧줄 감기) — 얇은 각재/판 두 개를 面 위에 엇갈려 놓는다 */
function xLashing(m, { x = 0, y = 0, z = 0, s = 0.24, ry = 0, color = P.woodDark, t = 0.05, flat = false }) {
  const g = mesh();
  for (const a of [0.72, -0.72]) {
    const b = mesh();
    if (flat) panel(b, { y: -s * 0.75, w: t, h: s * 1.5, color });
    else box(b, { w: t, d: t, h: s * 1.5, color });
    merge(g, b, { rz: a, ty: flat ? 0 : -s * 0.75 });
  }
  merge(m, g, { tx: x, ty: y, tz: z, ry });
}

/** 깃대 + 물결치는 삼각 페넌트 */
function pennant(m, { x = 0, y = 0, z = 0, h = 0.5, len = 0.46, color = P.roofRed, ry = 0 }) {
  cylinder(m, { x, y, z, r: 0.022, h, seg: 4, color: P.trunkDark, cap: false });
  const f = mesh();
  tri(f, [0, h, 0], [len * 0.55, h - 0.06, 0.05], [0, h - 0.19, 0], color, { double: true });
  tri(f, [len * 0.55, h - 0.06, 0.05], [len, h - 0.2, -0.04], [0, h - 0.19, 0], color, { double: true });
  merge(m, f, { tx: x, ty: y, tz: z, ry });
}

// ── 1. 초가 오두막 (tiny hut) ──────────────────
// 그림: 아주 낮은 원통 벽 + 벽선을 한참 지나 덮어 내려오는 거대한 짚 지붕.
//       아랫단은 잔털처럼 자잘한 짚 끝이 촘촘히 삐져나와 있고(큰 톱니가 아니다),
//       꼭대기에는 묶어 세운 상투 다발. 문은 벽 높이를 거의 다 쓰는 작은 널문.
export function tinyHut(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const r = rand(rng, 0.78, 0.86);
  const wallH = 0.86; // 벽은 짧다 — 그림에서 벽은 전체 높이의 1/4 정도만 보인다
  cylinder(m, { r, r2: r * 0.98, h: wallH, seg: 10, color: P.plaster, cap: false });

  // 짚 지붕 — 꼭짓점 하나에서 뻗은 삼각형들의 아랫변이 그대로 헴라인이 된다.
  // 짚 끝을 15개로 잘게 쪼개고 길이를 제각각으로 흔들어 "잔털 같은" 처마를 만든다.
  const apex = [0, 1.98, 0];
  const teeth = 15;
  const ring = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const tip = i % 2 === 0;
    // 벽 반지름보다 한참 바깥까지 내려온다 → 그림처럼 처마가 깊게 걸친다
    const rr = tip ? rand(rng, 1.2, 1.32) : rand(rng, 1.02, 1.08);
    const yy = tip ? rand(rng, 0.54, 0.68) : rand(rng, 0.88, 0.96);
    ring.push([Math.cos(a) * rr, yy, Math.sin(a) * rr]);
  }
  for (let i = 0; i < ring.length; i++) {
    tri(m, ring[i], apex, ring[(i + 1) % ring.length], P.roofStraw, { soft: true });
  }

  // 상투 — 짚단을 끈으로 묶고 위로 벌어지게 꽂은 모양
  cylinder(m, { y: 1.92, r: 0.1, r2: 0.09, h: 0.08, seg: 6, color: P.trunkDark, cap: false });
  cylinder(m, { y: 1.98, r: 0.055, r2: 0.15, h: 0.2, seg: 5, color: P.roofStraw, cap: false });
  for (let i = 0; i < 3; i++) {
    const sp = mesh();
    cone(sp, { r: 0.05, h: 0.26, seg: 4, color: P.roofStraw });
    merge(m, sp, { rz: 0.42, ry: (i / 3) * Math.PI * 2 + 0.4, ty: 2.17 });
  }

  // 널문 · 작은 창 · 벽 선반
  const F = wallFrame(0, 0, r * 0.97, 0);
  plankDoor(m, F, 0, 0, 0.42, 0.7, P.wood, P.woodDark, 3);
  const L = wallFrame(Math.sin(-1.05) * r * 0.94, 0, Math.cos(-1.05) * r * 0.94, -1.05);
  crossWindow(m, L, 0, 0.5, 0.24, 0.24, P.woodDark, '#d7e6ea');
  const R = wallFrame(Math.sin(1.0) * r * 0.94, 0, Math.cos(1.0) * r * 0.94, 1.0);
  const q = R.p(0, 0.38, 0.06);
  box(m, { x: q[0], y: q[1], z: q[2], w: 0.24, d: 0.14, h: 0.14, color: P.wood, ry: 1.0 });

  return finish(m, { radius: 1.1, kind: 'hut' });
}

// ── 2. 삐딱한 2층집 (crooked house) ────────────
// 그림의 핵심은 "삐뚤삐뚤함"이다. 벽이 한쪽으로 기울고, 용마루가 중심에서 어긋나 있으며
// 앞뒤 용마루 높이까지 달라 지붕선이 기운다. 높이가 다른 굴뚝 2개, 박공 다락창과 아래층 창,
// 벽에서 튀어나온 작은 브래킷들, 발치의 짧은 울타리.
// 처마는 짧게 물려 두어야(그림처럼) 창과 브래킷이 가려지지 않는다.
export function crookedHouse(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const W = rand(rng, 1.46, 1.62); // 폭(x) — 좁다
  const D = rand(rng, 1.58, 1.76); // 깊이(z)
  const wallH = rand(rng, 2.3, 2.5);
  const roofH = rand(rng, 1.5, 1.72);
  const roof = opt.roof || '#a99378';
  const lean = rand(rng, 0.115, 0.14); // 벽 기울기 tan — 6.5~8°
  const lx = wallH * lean; // 벽 윗면이 +x 로 밀린 양
  const lz = 0.08;
  const skew = rand(rng, 0.16, 0.24); // 용마루가 벽 중심에서 어긋난 양
  const taper = 0.95;

  // 기울어진 벽통 — 윗면을 통째로 밀어 "삐딱한 집" 실루엣을 만든다
  const hw = W / 2;
  const hd = D / 2;
  const tw = hw * taper;
  const td = hd * taper;
  const bb = [
    [-hw, 0, hd],
    [hw, 0, hd],
    [hw, 0, -hd],
    [-hw, 0, -hd],
  ];
  const tt = [
    [-tw + lx, wallH, td + lz],
    [tw + lx, wallH, td + lz],
    [tw + lx, wallH, -td + lz],
    [-tw + lx, wallH, -td + lz],
  ];
  // 앞면은 가로·세로로 잘게 쪼갠다.
  // 잉크 렌더러는 면 중심 깊이로 정렬하므로, 기울어진 벽 한 장이 너무 크면
  // 그 위에 붙인 창·문·브래킷이 벽 뒤로 밀려 사라진다. 칸마다 하나씩 얹으면 안전하다.
  const fx = (k, t) => {
    const x0 = bb[0][0] + (tt[0][0] - bb[0][0]) * t;
    const x1 = bb[1][0] + (tt[1][0] - bb[1][0]) * t;
    return x0 + (x1 - x0) * k;
  };
  const fz = (t) => bb[0][2] + (tt[0][2] - bb[0][2]) * t;
  const fp = (k, y) => [fx(k, y / wallH), y, fz(y / wallH)];
  const kx = [0, 0.38, 0.74, 1];
  const ty = [0, 0.42, 0.72, 1];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const y0 = wallH * ty[r];
      const y1 = wallH * ty[r + 1];
      quad(
        m,
        [fx(kx[c], ty[r]), y0, fz(ty[r])],
        [fx(kx[c + 1], ty[r]), y0, fz(ty[r])],
        [fx(kx[c + 1], ty[r + 1]), y1, fz(ty[r + 1])],
        [fx(kx[c], ty[r + 1]), y1, fz(ty[r + 1])],
        P.plaster
      );
    }
  }
  quad(m, bb[1], bb[2], tt[2], tt[1], P.plaster);
  quad(m, bb[2], bb[3], tt[3], tt[2], P.plaster);
  quad(m, bb[3], bb[0], tt[0], tt[3], P.plaster);

  // 지붕 — 용마루가 벽 중심에서 skew 만큼 밀려 좌우 경사가 다르고,
  //        앞쪽 용마루가 뒤쪽보다 높아 지붕선 자체가 기운다.
  const gz = td + lz;
  const zF = gz + 0.12;
  const zB = -gz + 2 * lz - 0.12;
  const apexX = lx + skew;
  const ridgeYF = wallH + roofH + 0.09;
  const ridgeYB = wallH + roofH - 0.11;
  const eaveY = wallH - 0.07; // 처마를 벽 어깨까지만 내린다 → 벽이 다 보인다
  const eaveL = tw + 0.34; // 왼쪽 처마가 더 길다
  const eaveR = tw + 0.2;

  // 박공 회벽(앞·뒤) — 처마선까지 넓게 채워 지붕 밑이 비지 않게 한다
  tri(m, [apexX - eaveL, eaveY, gz], [apexX + eaveR, eaveY, gz], [apexX, ridgeYF, gz], P.plaster);
  tri(m, [apexX + eaveR, eaveY, -gz + 2 * lz], [apexX - eaveL, eaveY, -gz + 2 * lz], [apexX, ridgeYB, -gz + 2 * lz], P.plaster);

  // 지붕 경사면 두 장 — 박공 쪽을 막지 않아야 다락창이 보인다
  for (const s of [-1, 1]) {
    const ex = apexX + s * (s < 0 ? eaveL : eaveR);
    const a = [ex, eaveY, zF];
    const b = [ex, eaveY, zB];
    const rf = [apexX, ridgeYF, zF];
    const rb = [apexX, ridgeYB, zB];
    if (s > 0) quad(m, rb, b, a, rf, roof, { double: true });
    else quad(m, rf, a, b, rb, roof, { double: true });
  }
  // 기울어진 용마루 각재
  beam(m, [apexX, ridgeYB, zB], [apexX, ridgeYF, zF], 0.13, 0.11, P.woodDark, 1.04);

  // 박공 마구리 널(그림에서 지붕 가장자리가 유난히 굵은 두 줄) — 좌우 길이가 다르다
  beam(m, [apexX - eaveL, eaveY - 0.02, zF + 0.05], [apexX, ridgeYF + 0.02, zF + 0.05], 0.11, 0.12, P.woodDark, 1.02);
  beam(m, [apexX + eaveR, eaveY - 0.02, zF + 0.05], [apexX, ridgeYF + 0.02, zF + 0.05], 0.11, 0.12, P.woodDark, 1.02);

  // 굴뚝 2개 — 높이가 다르고(왼쪽이 낮다) 서로 반대로 기울어 있다
  const roofYAt = (x) => {
    const ex = x < apexX ? eaveL : eaveR;
    const rY = ridgeYF - 0.05;
    return rY - (Math.min(Math.abs(x - apexX), ex) * (rY - eaveY)) / ex;
  };
  for (const c of [
    { x: -0.56, z: 0.16, top: 0.5, tilt: -0.07 },
    { x: 0.6, z: -0.04, top: 1.0, tilt: 0.08 },
  ]) {
    const cxp = c.x + lx;
    const base = roofYAt(cxp) - 0.3;
    const hh = roofYAt(cxp) + c.top - base;
    const ch = mesh();
    box(ch, { w: 0.22, d: 0.22, h: hh, color: P.stoneDark });
    box(ch, { y: hh, w: 0.3, d: 0.3, h: 0.09, color: P.stone });
    merge(m, ch, { rz: c.tilt, tx: cxp, ty: base, tz: c.z });
  }

  // 창문 2개 — 박공의 다락창, 아래층 창 (둘 다 십자 창살).
  // 아래층 창·문·브래킷은 각각 자기 벽칸의 한가운데에 붙인다(= 그 칸보다 확실히 앞에 온다).
  const GF = wallFrame(apexX, 0, gz, 0);
  crossWindow(m, GF, 0.02, wallH + 0.5, 0.42, 0.48);
  const wq = fp(0.19, 1.44);
  crossWindow(m, wallFrame(wq[0], 0, wq[2], 0), 0, 1.44, 0.44, 0.48);

  // 널문 + 인방돌 + 디딤돌
  const dq = fp(0.56, 0.46);
  const DF = wallFrame(dq[0], 0, dq[2], 0);
  plankDoor(m, DF, 0, 0, 0.5, 0.92, P.wood, P.woodDark, 3);
  const li = DF.p(0, 0.96, 0.04);
  box(m, { x: li[0], y: li[1], z: li[2], w: 0.68, d: 0.16, h: 0.1, color: P.stone });
  box(m, { x: li[0], y: 0, z: li[2] + 0.13, w: 0.66, d: 0.24, h: 0.07, color: P.stoneDark });

  // 벽에서 튀어나온 작은 브래킷/덧문 상자들
  for (const b of [[0.19, 1.98], [0.88, 1.86], [0.88, 0.5]]) {
    const q = fp(b[0], b[1]);
    box(m, { x: q[0], y: q[1], z: q[2] - 0.04, w: 0.2, d: 0.17, h: 0.18, color: P.wood, ry: 0.16 });
  }

  // 발치의 짧은 울타리 조각 (양옆)
  picketRun(m, { x: -0.95, z: hd + 0.28, n: 2, gap: 0.4, h: 0.6, ry: 0.08 });
  picketRun(m, { x: 0.98, z: hd + 0.3, n: 2, gap: 0.4, h: 0.6, ry: -0.14 });

  return finish(m, { radius: Math.max(W, D) * 0.55, kind: 'crooked' });
}

// ── 3. 상점 좌판 (shop) ───────────────────────
// 그림: 판매대 + 그 위 물건들, 앞단이 물결(스캘럽)치는 천 차양, 차양 위 가로보,
//       그 위에 자루 그림이 그려진 네모 간판, 옆에 쌓인 통과 상자, 항아리 줄.
export function shopStall(seed = 1) {
  const m = mesh();
  const w = 2.4;
  const d = 1.0;

  // 판매대
  box(m, { z: 0.05, w, d, h: 0.78, color: P.wood });
  box(m, { z: 0.05, y: 0.78, w: w + 0.14, d: d + 0.12, h: 0.08, color: '#e8cba0' });

  // 기둥 4개
  const px = w / 2 - 0.06;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(m, { x: sx * px, z: sz * (d / 2 - 0.02) + 0.05, w: 0.11, d: 0.11, h: 2.05, color: P.woodDark });
    }
  }
  // 가로보 — 양끝이 삐죽 나온다
  box(m, { y: 2.02, z: 0.05, w: w + 0.42, d: 0.15, h: 0.15, color: P.wood });

  // 판매대 앞널 이음매
  const KF = wallFrame(0, 0, d / 2 + 0.05, 0);
  for (const yy of [0.3, 0.56]) KF.panel(m, 0, yy, w - 0.24, 0.04, P.woodDark, 0.03);

  // 스캘럽 차양 — 앞 끝이 5개의 반원으로 물결친다
  const aw = w + 0.5;
  const backY = 2.0;
  const backZ = 0.2;
  const frontY = 1.64;
  const frontZ = 1.25;
  const M = 15;
  const dip = (k) => 0.17 * Math.sin(Math.PI * (((k * 5) / M) % 1));
  for (let i = 0; i < M; i++) {
    const x0 = -aw / 2 + (aw * i) / M;
    const x1 = -aw / 2 + (aw * (i + 1)) / M;
    quad(
      m,
      [x0, frontY - dip(i), frontZ],
      [x1, frontY - dip(i + 1), frontZ],
      [x1, backY, backZ],
      [x0, backY, backZ],
      i % 2 ? P.cloth : '#eadbbd',
      { double: true }
    );
  }

  // 간판 — 네모 판 한가운데에 돈자루 문양. 그림에서 자루는 판 높이의 2/3 를 차지할 만큼 크다.
  const sgH = 0.86;
  box(m, { y: 2.14, z: 0.02, w: 1.6, d: 0.09, h: sgH, color: P.plaster, top: P.wood });
  const SF = wallFrame(0, 2.14, 0.07, 0);
  // 자루 실루엣 한 장 — 아래는 둥글고 목은 잘록하며 위로 귀 두 개가 삐죽 솟는다
  const bag = [
    [-0.23, -0.25],
    [-0.27, -0.06],
    [-0.21, 0.11],
    [-0.11, 0.2],
    [-0.15, 0.29],
    [-0.06, 0.25],
    [0, 0.32],
    [0.06, 0.25],
    [0.15, 0.29],
    [0.11, 0.2],
    [0.21, 0.11],
    [0.27, -0.06],
    [0.23, -0.25],
    [0.12, -0.32],
    [-0.12, -0.32],
  ];
  poly(m, bag.map((p) => SF.p(p[0], sgH / 2 + p[1], 0.05)), '#7a6248', { double: true });
  // 목을 묶은 끈
  SF.panel(m, 0, sgH / 2 + 0.17, 0.3, 0.07, P.acorn, 0.07);

  // 항아리 줄 — 판매대 위
  for (let i = 0; i < 4; i++) {
    cylinder(m, {
      x: -0.78 + i * 0.44,
      z: 0.02,
      y: 0.86,
      r: 0.12,
      r2: 0.08,
      h: 0.22,
      seg: 6,
      color: i % 2 ? P.leafGold : P.leafBlue,
      capColor: P.trunkDark,
    });
  }

  // 옆에 쌓아 둔 통 2개 · 상자 2개
  for (let i = 0; i < 2; i++) {
    const bx = 1.5 + i * 0.56;
    cylinder(m, { x: bx, z: 0.1, r: 0.25, r2: 0.22, h: 0.58, seg: 7, color: P.wood, capColor: '#e0bd8f' });
    cylinder(m, { x: bx, z: 0.1, y: 0.42, r: 0.27, h: 0.06, seg: 7, color: P.trunkDark, cap: false });
  }
  box(m, { x: 2.5, z: -0.35, w: 0.5, d: 0.5, h: 0.48, color: P.wood, top: '#e0bd8f' });
  const CF = wallFrame(2.5, 0.24, -0.1, 0);
  for (const a of [0.86, -0.86]) {
    const b = mesh();
    panel(b, { y: -0.23, w: 0.05, h: 0.46, color: P.woodDark });
    merge(m, b, { rz: a, tx: CF.p(0, 0, 0.01)[0], ty: 0.24, tz: CF.p(0, 0, 0.01)[2] });
  }
  box(m, { x: 2.46, z: -0.32, y: 0.48, w: 0.42, d: 0.42, h: 0.4, color: P.woodDark, top: P.wood, ry: 0.3 });

  return finish(m, { radius: 1.5, kind: 'shop' });
}

// ── 4. 풍차 (windmill) ────────────────────────
// 그림: 밑동이 넓게 퍼진 뭉툭한 통 모양 탑에 둥근 돔 모자를 씌웠고, 허브는 그 돔 바로 밑에 붙는다.
//       날개는 탑 높이보다 길어서 아래쪽 날개 끝이 탑 중턱까지 내려온다.
//       중턱에는 격자(멀리언) 창 하나, 발치에는 아치 널문.
export function windmill(seed = 1) {
  const m = mesh();
  const h = 3.0; // 벽(탑) 높이
  const rBase = 1.06; // 밑동이 넓다
  const rNeck = 0.78;
  // 배흘림 통 실루엣 — 아래에서는 거의 안 좁아지다가 위로 갈수록 빨리 좁아진다
  const rAt = (y) => {
    const k = Math.min(1, Math.max(0, y / h));
    return rBase + (rNeck - rBase) * Math.pow(k, 1.4);
  };
  const bands = 3;
  for (let i = 0; i < bands; i++) {
    const y0 = (h * i) / bands;
    const y1 = (h * (i + 1)) / bands;
    cylinder(m, { y: y0, r: rAt(y0), r2: rAt(y1), h: y1 - y0, seg: 9, color: P.plaster, cap: false });
  }

  // 둥근 돔 모자 — 원뿔대를 사분원 곡선을 따라 쌓아 지붕선이 둥글게 부풀게 한다
  const capR = rNeck + 0.16; // 탑보다 조금 넓어 처마처럼 걸친다
  const domeH = 0.7;
  const steps = 4;
  let py = h - 0.04;
  let pr = capR;
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    const ny = h - 0.04 + Math.sin(a) * domeH;
    const nr = capR * Math.cos(a);
    if (i < steps) cylinder(m, { y: py, r: pr, r2: nr, h: ny - py, seg: 9, color: '#7c7466', cap: false });
    else cone(m, { y: py, r: pr, h: ny - py, seg: 9, color: '#7c7466' });
    py = ny;
    pr = nr;
  }

  // 아치 널문
  const DF = wallFrame(0, 0, rAt(0.5) * 0.97, 0);
  archDoor(m, DF, 0, 0, 0.58, 1.0, P.wood, P.woodDark, 3);
  // 중턱의 격자 창
  const wy = 1.88;
  const WF = wallFrame(0, 0, rAt(wy) * 0.96, 0);
  mullionWindow(m, WF, 0, wy, 0.34, 0.46);

  // 날개 축(허브 원반) — 돔 바로 밑, 탑 어깨에 붙는다
  const hubY = h - 0.1;
  const hubZ = rAt(hubY) + 0.14;
  const hub = mesh();
  cylinder(hub, { r: 0.16, h: 0.15, seg: 8, color: P.woodDark, capColor: P.wood });
  merge(m, hub, { rx: -Math.PI / 2, ty: hubY, tz: hubZ });

  // 격자 날개 4장 — 탑 높이(3.0)보다 긴 2.0 짜리 날개라 지름이 4.0 이 된다
  const sail = mesh();
  const sl = 2.0;
  for (const s of [-1, 1]) box(sail, { x: s * 0.19, y: 0.18, w: 0.06, d: 0.05, h: sl, color: P.woodDark });
  for (let i = 0; i < 7; i++) {
    panel(sail, { x: 0, y: 0.42 + i * 0.25, z: 0.035, w: 0.36, h: 0.045, color: P.woodDark });
  }
  for (let i = 0; i < 4; i++) {
    merge(m, sail, { rz: (i / 4) * Math.PI * 2 + 0.42, ty: hubY, tz: hubZ + 0.05 });
  }

  return finish(m, { radius: 1.15, kind: 'windmill' });
}

// ── 5. 망루 (tower) ───────────────────────────
// 그림: 둥근 돌탑, 화살 구멍과 작은 창, 꼭대기의 성가퀴, 그 위에 비늘이 층층인 원뿔 지붕,
//       지붕 꼭대기의 작은 페넌트 깃발, 그리고 돌 켜(가로 띠와 낱장 돌)가 보인다.
export function tower(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = 3.05;
  const rBase = 0.84;
  const rTop = 0.76;
  const rAt = (y) => rBase + (rTop - rBase) * (y / h);
  for (let i = 0; i < 3; i++) {
    const y0 = (h * i) / 3;
    const y1 = (h * (i + 1)) / 3;
    cylinder(m, { y: y0, r: rAt(y0), r2: rAt(y1), h: y1 - y0, seg: 10, color: P.stone, cap: false });
  }

  // 돌 켜 — 얇은 띠 두 줄 + 낱장 돌 세 개
  for (const y of [0.95, 2.0]) {
    cylinder(m, { y, r: rAt(y) + 0.035, r2: rAt(y + 0.12) + 0.035, h: 0.12, seg: 10, color: P.stoneDark, cap: false });
  }
  for (let i = 0; i < 3; i++) {
    const a = rand(rng, -2.2, 2.2);
    const y = rand(rng, 1.2, 2.5);
    box(m, {
      x: Math.sin(a) * rAt(y) * 0.99,
      z: Math.cos(a) * rAt(y) * 0.99,
      y,
      w: 0.3,
      d: 0.1,
      h: 0.18,
      color: P.stoneDark,
      ry: a,
    });
  }

  // 성가퀴 — 난간 띠 + 이빨 8개
  cylinder(m, { y: h, r: rTop + 0.09, h: 0.14, seg: 10, color: P.stoneDark, cap: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    box(m, {
      x: Math.cos(a) * (rTop - 0.03),
      z: Math.sin(a) * (rTop - 0.03),
      y: h + 0.11,
      w: 0.36,
      d: 0.3,
      h: 0.32,
      color: P.stone,
      ry: -a,
    });
  }

  // 비늘 원뿔 지붕 — 원뿔대를 층층이 쌓아 처마 단이 잉크선으로 드러나게 한다
  const ry0 = h + 0.36;
  const bands = [
    [0.98, 0.76, 0.3],
    [0.8, 0.56, 0.3],
    [0.6, 0.34, 0.3],
  ];
  let by = ry0;
  for (const b of bands) {
    cylinder(m, { y: by, r: b[0], r2: b[1], h: b[2], seg: 10, color: P.roofRed, cap: false });
    by += b[2] - 0.02;
  }
  cone(m, { y: by, r: 0.36, h: 0.4, seg: 10, color: P.roofRed });
  pennant(m, { y: by + 0.36, h: 0.46, len: 0.4, color: P.roofBlue, ry: 0.2 });

  // 아치 널문 · 작은 창 · 화살 구멍 2개
  const DF = wallFrame(0, 0, rAt(0.5) * 0.98, 0);
  archDoor(m, DF, 0, 0, 0.5, 0.92, P.wood, P.woodDark, 3);
  const WF = wallFrame(Math.sin(-0.55) * rAt(1.75) * 0.96, 0, Math.cos(-0.55) * rAt(1.75) * 0.96, -0.55);
  crossWindow(m, WF, 0, 1.75, 0.28, 0.34);
  for (const a of [1.5, 2.8]) {
    const y = a > 2 ? 1.5 : 2.15;
    const S = wallFrame(Math.sin(a) * rAt(y) * 0.97, 0, Math.cos(a) * rAt(y) * 0.97, a);
    S.panel(m, 0, y, 0.1, 0.42, '#4d4a42', 0.02);
  }

  return finish(m, { radius: 1.0, kind: 'tower' });
}

// ── 6. 살림집 (cottage) ───────────────────────
// 그림: 땅딸막한 집. 회벽이 사방으로 다 보이고, 그 위에 초가 한 덩어리가 치마처럼 살짝 걸쳐 내려온다.
//       지붕 물매는 완만하고, 박공에 둥근 창, 그 아래 인방 달린 아치 널문,
//       용마루 위에 가느다란 굴뚝, 앞마당에는 뾰족 울타리.
export function cottage(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const roof = opt.roof || P.roofStraw;
  const W = rand(rng, 1.95, 2.15);
  const D = rand(rng, 2.2, 2.45);
  const wallH = rand(rng, 1.72, 1.86); // 벽을 높여 사방 벽이 다 보이게
  const roofH = rand(rng, 1.0, 1.12); // 물매를 낮춰 A 자 텐트가 안 되게
  const ovZ = 0.16;
  const ridgeY = wallH + roofH;
  const zB = -(D / 2 + ovZ);
  const zF = D / 2 + ovZ;
  // 처마는 벽 어깨 바로 밑까지만 내려온다 → 지붕이 땅까지 닿지 않고 벽이 살아난다
  const eaveX = W / 2 + 0.34;
  const eaveY = wallH - 0.08;

  wallBox(m, { w: W, d: D, h: wallH, color: P.plaster, splits: [1.2] });

  // 지붕 = 닫힌 덩어리 하나. 앞뒤 마구리 삼각형이 곧 박공 회벽이라 겹침 선이 안 생긴다
  quad(m, [0, ridgeY, zF], [eaveX, eaveY, zF], [eaveX, eaveY, zB], [0, ridgeY, zB], roof);
  quad(m, [0, ridgeY, zB], [-eaveX, eaveY, zB], [-eaveX, eaveY, zF], [0, ridgeY, zF], roof);
  tri(m, [-eaveX, eaveY, zF], [eaveX, eaveY, zF], [0, ridgeY, zF], P.plaster); // 앞 박공 회벽
  tri(m, [eaveX, eaveY, zB], [-eaveX, eaveY, zB], [0, ridgeY, zB], P.plaster); // 뒤 박공 회벽
  box(m, { y: ridgeY - 0.03, z: (zB + zF) / 2, w: 0.15, d: zF - zB, h: 0.09, color: roof });

  // 박공 마구리의 두 경사에도 짚을 둘러 준다 — 이래야 초가가 "한 덩어리"로 읽히고
  // 회벽 삼각형이 지붕의 두 번째 색처럼 보이지 않는다
  const bg = 0.44; // 마구리 짚띠 폭
  const bgY = 0.4;
  for (const zz of [zF + 0.03, zB - 0.03]) {
    const fr = zz > 0;
    const L = [-eaveX, eaveY, zz];
    const Li = [-eaveX + bg, eaveY, zz];
    const R = [eaveX, eaveY, zz];
    const Ri = [eaveX - bg, eaveY, zz];
    const A = [0, ridgeY, zz];
    const Ai = [0, ridgeY - bgY, zz];
    if (fr) {
      quad(m, L, Li, Ai, A, roof, { double: true });
      quad(m, A, Ai, Ri, R, roof, { double: true });
    } else {
      quad(m, A, Ai, Li, L, roof, { double: true });
      quad(m, R, Ri, Ai, A, roof, { double: true });
    }
  }

  // 처마 밑으로 늘어진 짚 술 — 가운데가 길어 처마 선이 부드럽게 처져 보인다
  const teeth = 9;
  for (const s of [-1, 1]) {
    for (let k = 0; k < teeth; k++) {
      const t0 = (k + 0.06) / teeth;
      const t1 = (k + 0.94) / teeth;
      const za = zB + (zF - zB) * t0;
      const zb2 = zB + (zF - zB) * t1;
      const drop = 0.12 + 0.2 * Math.sin(Math.PI * ((t0 + t1) / 2)) + rand(rng, -0.03, 0.05);
      tri(m, [s * eaveX, eaveY, za], [s * eaveX, eaveY, zb2], [s * (eaveX + 0.05), eaveY - drop, (za + zb2) / 2], roof, {
        double: true,
      });
    }
  }

  // 박공의 둥근 창 · 옆벽의 작은 둥근 창
  const GF = wallFrame(0, 0, D / 2, 0);
  const RF = wallFrame(0, 0, zF, 0);
  roundWindow(m, RF, 0, ridgeY - 0.74, 0.24);
  const SF = wallFrame(-W / 2, 0, D * 0.16, -Math.PI / 2);
  roundWindow(m, SF, 0, 1.02, 0.2);

  // 인방과 디딤돌이 있는 아치 널문
  archDoor(m, GF, 0.12, 0, 0.56, 1.12, P.wood, P.woodDark, 4);
  const li = GF.p(0.12, 1.16, 0.04);
  box(m, { x: li[0], y: li[1], z: li[2], w: 0.76, d: 0.16, h: 0.11, color: '#cbb78c' });
  box(m, { x: li[0], y: 0, z: li[2] + 0.14, w: 0.74, d: 0.26, h: 0.08, color: P.stoneDark });

  // 용마루 위에 올라앉은 가느다란 굴뚝 (그림처럼 슬림하다)
  const cx = 0.14;
  const cTop = ridgeY + 0.78;
  box(m, { x: cx, z: -0.34, y: ridgeY - 0.3, w: 0.21, d: 0.21, h: cTop - (ridgeY - 0.3), color: P.stoneDark });
  box(m, { x: cx, z: -0.34, y: cTop, w: 0.29, d: 0.29, h: 0.09, color: '#8f8778' });

  // 앞마당을 가로지르는 뾰족 울타리
  picketRun(m, { x: -1.15, z: D / 2 + 0.45, n: 3, gap: 0.4, h: 0.66 });
  picketRun(m, { x: 1.2, z: D / 2 + 0.42, n: 3, gap: 0.4, h: 0.66, ry: -0.1 });

  return finish(m, { radius: Math.max(W, D) * 0.5, kind: 'cottage' });
}

// ── 7. 마을 대문 (gate) ───────────────────────
// 그림: 위가 거칠게 잘린 통나무 기둥 두 개(옆구리에 쪼개진 짧은 널이 붙어 있다),
//       그 사이를 잇는 얇은 목재 아치, 기둥과 아치가 만나는 곳의 X 자 밧줄 결속,
//       아치 꼭대기 한가운데 매달린 마름모 장식, 왼쪽 기둥의 굽은 팔에 매달린 등불과
//       바로 그 왼쪽 기둥 위에 꽂힌 작은 페넌트.
export function gateArch(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const postX = 1.55;
  const postH = 2.4;

  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      pts.push([Math.cos(a) * rand(rng, 0.21, 0.27), Math.sin(a) * rand(rng, 0.18, 0.24)]);
    }
    extrude(m, { x: s * postX, pts, h: postH, color: P.wood, topColor: P.woodDark, topScale: 0.94 });
    // 거칠게 잘린 머리 — 비스듬한 덩어리를 얹는다
    const chip = mesh();
    box(chip, { w: 0.34, d: 0.3, h: 0.16, color: P.woodDark });
    merge(m, chip, { rz: s * 0.22, tx: s * postX, ty: postH - 0.03 });
    // 기둥 옆구리에 붙어 선 쪼개진 널 두 장 — 그림처럼 기둥에 딱 붙는다(따로 떠 있지 않다)
    for (const k of [0, 1]) {
      box(m, {
        x: s * (postX + 0.235 + k * 0.085),
        z: -0.04 - k * 0.13,
        w: 0.09,
        d: 0.15,
        h: rand(rng, 0.95, 1.35),
        color: k ? P.woodDark : P.wood,
        top: P.woodDark,
        ry: s * 0.08,
      });
    }
  }

  // 얇은 목재 아치 — 짧은 각재를 곡선을 따라 잇는다
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    beam(m, archPoint(i / segs, postX, postH), archPoint((i + 1) / segs, postX, postH), 0.13, 0.14, P.woodDark, 1.1);
  }

  // X 자 밧줄 결속 — 아치가 기둥에 얹히는 두 곳 + 아치 꼭대기의 감은 자리
  for (const s of [-1, 1]) xLashing(m, { x: s * postX, y: postH - 0.02, z: 0.2, s: 0.3, color: '#7d6a52' });
  const ap = archPoint(0.5, postX, postH);
  box(m, { y: ap[1] - 0.06, z: 0.19, w: 0.3, d: 0.17, h: 0.2, color: '#7d6a52' });

  // 아치 꼭대기 한가운데 매달린 마름모 장식(리본 매듭)
  const dy = ap[1] - 0.24;
  const dz = ap[2] + 0.14;
  const diamond = (rw, rh, col, off) =>
    poly(
      m,
      [
        [0, dy - rh, dz + off],
        [rw, dy, dz + off],
        [0, dy + rh, dz + off],
        [-rw, dy, dz + off],
      ],
      col,
      { double: true }
    );
  diamond(0.23, 0.27, P.cloth, 0);
  diamond(0.12, 0.14, P.roofRed, 0.02);

  // 굽은 팔에 매달린 등불 (왼쪽 기둥)
  beam(m, [-postX, postH - 0.28, 0.1], [-postX - 0.58, postH - 0.12, 0.1], 0.08, 0.08, P.woodDark);
  beam(m, [-postX - 0.02, postH - 0.62, 0.1], [-postX - 0.4, postH - 0.2, 0.1], 0.06, 0.06, P.woodDark);
  strut(m, [-postX - 0.54, postH - 0.14, 0.1], [-postX - 0.54, postH - 0.42, 0.1], 0.018, P.trunkDark);
  cylinder(m, { x: -postX - 0.54, z: 0.1, y: postH - 0.76, r: 0.14, r2: 0.12, h: 0.32, seg: 5, color: '#ffe6a8', capColor: '#4b463d' });
  cone(m, { x: -postX - 0.54, z: 0.1, y: postH - 0.44, r: 0.17, h: 0.14, seg: 5, color: '#4b463d' });

  // 페넌트는 등불과 같은 왼쪽 기둥 위에 꽂힌다 (그림 그대로)
  pennant(m, { x: -postX, y: postH + 0.06, z: 0.02, h: 0.56, len: 0.46, color: P.cloth, ry: 0.18 });

  return finish(m, { radius: 0.5, kind: 'gate' });
}

function archPoint(t, postX, postH) {
  const a = Math.PI * (1 - t);
  return [Math.cos(a) * postX, postH - 0.06 + Math.sin(a) * 0.66, 0.12];
}

// ── 8. 천막 (tent) ────────────────────────────
// 그림: 옆선이 안쪽으로 살짝 처진 원뿔 천막, 정면(+z) 한가운데에 위가 뾰족한 삼각(Λ) 출입구,
//       꼭대기로 삐져나온 짧은 기둥 위의 작은 둥근 구슬 장식,
//       출입구 좌우로 갈라져 내려가는 버팀줄과 말뚝.
export function tent(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const r = rand(rng, 1.16, 1.3);
  const cloth = P.cloth;
  // 처진 옆선 — 원뿔대 3단으로 오목한 실루엣을 만든다
  const B = [
    [0, 0.74, 1, 0.72],
    [0.74, 0.76, 0.72, 0.4],
    [1.5, 0.72, 0.4, 0],
  ];
  for (const b of B) {
    if (b[3] > 0) cylinder(m, { y: b[0], r: r * b[2], r2: r * b[3], h: b[1], seg: 8, color: cloth, cap: false });
    else cone(m, { y: b[0], r: r * b[2], h: b[1], seg: 8, color: cloth });
  }
  const topY = 2.22;
  // 높이에 따른 천막 반지름 — 출입구와 버팀줄을 천막 면에 붙이는 데 쓴다
  const rAt = (y) => {
    for (const b of B) if (y <= b[0] + b[1]) return r * (b[2] + (b[3] - b[2]) * ((y - b[0]) / b[1]));
    return 0;
  };

  // 정면(+z) 한가운데의 Λ 자 출입구 — 위가 뾰족하고 아래로 벌어진다. 천막 곡면에 딱 붙인다
  const on = (x, y) => [x, y, Math.sqrt(Math.max(0.0004, rAt(y) * rAt(y) - x * x)) + 0.06];
  const doorPts = (k) => [
    on(-0.52 * k, 0.0),
    on(-0.42 * k, 0.24),
    on(-0.22 * k, 0.72),
    on(0, 1.18 * (0.72 + 0.28 * k)),
    on(0.22 * k, 0.72),
    on(0.42 * k, 0.24),
    on(0.52 * k, 0.0),
  ];
  poly(m, doorPts(1.0), '#b3a68f', { double: true }); // 젖혀 놓은 천 자락
  poly(m, doorPts(0.72), '#6f6558', { double: true }); // 안쪽 어두운 입구

  // 중심 기둥 + 작은 둥근 구슬 장식 (페넌트 대신)
  cylinder(m, { y: topY - 0.1, r: 0.045, h: 0.34, seg: 5, color: P.trunkDark, cap: false });
  blobSphere(m, { y: topY + 0.3, rx: 0.085, ry: 0.085, seg: 6, rings: 3, color: P.wood, wob: 0.02, seed: 7 });

  // 버팀줄과 말뚝 — 출입구 좌우로 갈라져 내려간다
  for (const s of [-1, 1]) {
    const stakeX = s * (r + 0.7);
    const ay = 1.5;
    strut(m, [s * rAt(ay) * 0.9, ay, 0.12], [stakeX, 0.16, 0.16], 0.018, '#8a7f6c');
    const st = mesh();
    cylinder(st, { r: 0.05, h: 0.3, seg: 4, color: P.trunkDark, capColor: P.trunk });
    merge(m, st, { rz: -s * 0.35, tx: stakeX, ty: 0.02, tz: 0.16 });
  }

  return finish(m, { radius: r * 0.85, kind: 'tent' });
}

// ── 9. 무너진 아치 (ruin arch) ────────────────
// 그림: 한 스팬을 온전히 건너간 자립 아치다. 두 기둥이 끝까지 서 있고 그 위를 쐐기돌(voussoir)이
//       낱장으로 두르며, 꼭대기에는 크고 밝은 마룻돌(keystone)이 박혀 있다.
//       윗변만 깨져 들쭉날쭉하고, 덩굴이 앞면을 타고 내리며, 양쪽 발치에 돌무더기가 흩어져 있다.
export function ruinArch(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const R = 0.62; // 아치 안쪽 반지름
  const vt = 0.34; // 쐐기돌 두께
  const springY = 1.3; // 아치가 시작되는 높이
  const halfW = 1.5; // 벽 전체 반폭
  const topY = 2.44; // 벽 윗변
  const dep = 0.56; // 두께(z)
  const outR = R + vt;
  const ks = 0.26; // 마룻돌 반폭
  const stone = (i) => (i % 2 ? P.stone : P.stoneDark);

  // 좌·우 기둥 — 둘 다 스프링 라인까지 온전히 선다. 돌을 켜켜이 쌓아 이음매가 보이게
  const pierW = halfW - R;
  for (const s of [-1, 1]) {
    let y = 0;
    let i = s > 0 ? 1 : 0;
    while (y < springY - 0.02) {
      const hh = Math.min(rand(rng, 0.4, 0.48), springY - y);
      box(m, {
        x: s * (R + pierW / 2) + rand(rng, -0.03, 0.03),
        z: rand(rng, -0.02, 0.02),
        y,
        w: pierW + rand(rng, -0.02, 0.05),
        d: dep,
        h: hh + 0.008,
        color: stone(i),
        top: P.stone,
        ry: rand(rng, -0.05, 0.05),
      });
      y += hh;
      i++;
    }
  }

  // 아치 위 어깨벽 — 아치 바깥선을 따라 계단식으로 안쪽까지 채워 스팬을 닫는다
  const bandN = 4;
  for (const s of [-1, 1]) {
    for (let i = 0; i < bandN; i++) {
      const y0 = springY + ((topY - springY) * i) / bandN;
      // 맨 윗켜는 높이를 흔들어 깨진 윗변을 만든다
      const y1 = i === bandN - 1 ? topY + rand(rng, -0.09, 0.06) : springY + ((topY - springY) * (i + 1)) / bandN;
      const dy = y1 - springY;
      const xi = dy >= outR ? ks : Math.sqrt(Math.max(0.01, outR * outR - dy * dy));
      box(m, {
        x: s * (xi + (halfW - xi) / 2),
        y: y0,
        w: halfW - xi,
        d: dep,
        h: y1 - y0,
        color: stone(i + (s > 0 ? 1 : 0)),
        top: P.stone,
        ry: rand(rng, -0.03, 0.03),
      });
    }
  }

  // 쐐기돌 — 반원 아치를 한 바퀴 다 두른다 (가운데 한 장은 마룻돌이 대신한다)
  const vs = 9;
  for (let i = 0; i < vs; i++) {
    if (i === 4) continue;
    const a = Math.PI * (1 - (i + 0.5) / vs);
    const piece = mesh();
    box(piece, { w: 0.28, d: dep * 0.94, h: vt, color: stone(i), top: P.stone });
    // 각 돌의 +y 축이 아치 중심에서 바깥을 향하도록 돌린다
    merge(m, piece, { rz: a - Math.PI / 2, tx: Math.cos(a) * R, ty: springY + Math.sin(a) * R });
  }
  // 마룻돌 — 꼭대기 한가운데. 다른 돌보다 크고 밝아 한눈에 구분된다
  box(m, {
    y: springY + R - 0.02,
    w: ks * 2,
    d: dep * 0.98,
    h: topY - (springY + R) + 0.02,
    color: P.stone,
    top: '#efe9dc',
  });

  // 깨져 나간 윗변에 얹힌 조각들
  for (let i = 0; i < 3; i++) {
    box(m, {
      x: (i - 1) * rand(rng, 0.55, 1.15),
      z: rand(rng, -0.12, 0.12),
      y: topY - rand(rng, 0.04, 0.12),
      w: rand(rng, 0.22, 0.36),
      d: dep * 0.7,
      h: rand(rng, 0.1, 0.2),
      color: P.stoneDark,
      top: P.stone,
      ry: rand(rng, -0.25, 0.25),
    });
  }

  // 양쪽 발치에 굴러떨어진 돌덩이
  for (let i = 0; i < 6; i++) {
    const s = i % 2 ? 1 : -1;
    box(m, {
      x: s * rand(rng, 1.28, 2.15),
      z: rand(rng, -0.55, 0.6),
      w: rand(rng, 0.26, 0.44),
      d: rand(rng, 0.24, 0.4),
      h: rand(rng, 0.16, 0.3),
      color: i % 2 ? P.stoneDark : P.stone,
      top: P.stone,
      ry: rand(rng, 0, 3),
    });
  }

  // 덩굴 — 양쪽 어깨벽·기둥 앞면을 타고 내린 가는 줄기와 잎
  for (let i = 0; i < 4; i++) {
    const s = i < 2 ? -1 : 1;
    const vx = s * rand(rng, 0.95, 1.38);
    const vy = rand(rng, 1.8, 2.32);
    const vh = rand(rng, 0.55, 0.95);
    const vz = dep / 2 + 0.02;
    panel(m, { x: vx, y: vy - vh, z: vz, w: 0.025, h: vh, color: '#6b8a55' });
    for (const k of [0.3, 0.64]) {
      const ly = vy - vh * k;
      const dx = k > 0.5 ? -0.08 : 0.08;
      tri(m, [vx, ly, vz + 0.01], [vx + dx, ly + 0.02, vz + 0.02], [vx + dx * 0.35, ly + 0.09, vz + 0.01], P.leafDark, {
        double: true,
      });
    }
  }

  return finish(m, { radius: 1.25, kind: 'ruin' });
}

// ── 10. 돌다리 (bridge) ───────────────────────
// 그림: 등이 봉긋한 홍예다리. 상판은 계단이 아니라 매끄럽게 휘어 오르고,
//       그 밑은 반원 아치가 뻥 뚫려 물 위를 건넌다. 난간은 갓 씌운 짧은 기둥 사이에
//       밧줄이 축 늘어져 걸린 모양.
export function bridge(seed = 1) {
  const m = mesh();
  const A = 1.7; // 아치 반스팬
  const hr = 1.16; // 아치 안쪽(홍예) 높이
  const crown = 1.58; // 상판 꼭대기
  const endY = 0.42; // 다리 끝 상판 높이
  const hw = 0.66; // 상판 반폭 — 좁아야 등이 봉긋한 홍예로 읽힌다
  const N = 8;
  const zA = (t) => t * A;
  const yIn = (t) => hr * Math.sqrt(Math.max(0, 1 - t * t)); // 아치 안쪽 곡선(반원)
  const yUp = (t) => crown - (crown - endY) * t * t; // 완만하게 휜 상판

  // 아치 몸통 — 위(상판)·아래(홍예 안쪽)·좌우 옆면을 곡선을 따라 이어 붙인다.
  // 아래가 뚫려 있으므로 다리 밑으로 배경이 그대로 비친다.
  for (let i = 0; i < N; i++) {
    const t0 = -1 + (2 * i) / N;
    const t1 = -1 + (2 * (i + 1)) / N;
    const z0 = zA(t0);
    const z1 = zA(t1);
    const u0 = yUp(t0);
    const u1 = yUp(t1);
    const i0 = yIn(t0);
    const i1 = yIn(t1);
    const side = i % 2 ? P.stone : '#d5cdbc';
    quad(m, [-hw, u1, z1], [hw, u1, z1], [hw, u0, z0], [-hw, u0, z0], i % 2 ? '#e6e0d0' : '#e0dacb'); // 상판
    quad(m, [-hw, i0, z0], [hw, i0, z0], [hw, i1, z1], [-hw, i1, z1], P.stoneDark); // 홍예 안쪽
    quad(m, [hw, i0, z0], [hw, u0, z0], [hw, u1, z1], [hw, i1, z1], side, { soft: true }); // 동쪽 옆면
    quad(m, [-hw, i0, z0], [-hw, i1, z1], [-hw, u1, z1], [-hw, u0, z0], side, { soft: true }); // 서쪽 옆면
  }
  // 양 끝 마구리
  quad(m, [-hw, 0, A], [hw, 0, A], [hw, endY, A], [-hw, endY, A], P.stoneDark);
  quad(m, [hw, 0, -A], [-hw, 0, -A], [-hw, endY, -A], [hw, endY, -A], P.stoneDark);

  // 홍예 이맛돌 띠 — 옆면에서 살짝 띄운 좁은 띠. 띠의 바깥 경계가 잉크선이 되어
  // 그림처럼 아치선이 두 줄로 또렷하게 보인다.
  const ringN = 8;
  const xr = hw + 0.045;
  for (const s of [-1, 1]) {
    for (let i = 0; i < ringN; i++) {
      const ua = Math.PI * (0.1 + (0.8 * i) / ringN);
      const ub = Math.PI * (0.1 + (0.8 * (i + 1)) / ringN);
      const ia = [s * xr, hr * Math.sin(ua), A * Math.cos(ua)];
      const ib = [s * xr, hr * Math.sin(ub), A * Math.cos(ub)];
      const oa = [s * xr, (hr + 0.3) * Math.sin(ua), A * 0.97 * Math.cos(ua)];
      const ob = [s * xr, (hr + 0.3) * Math.sin(ub), A * 0.97 * Math.cos(ub)];
      quad(m, ia, ib, ob, oa, P.stoneDark, { double: true, soft: true });
    }
  }

  // 양끝 교대(橋臺) — 물가의 낮은 받침
  for (const s of [-1, 1]) box(m, { z: s * (A + 0.26), w: 1.5, d: 0.54, h: 0.34, color: P.stoneDark, top: P.stone });

  // 난간 — 갓 씌운 짧은 기둥 4개 + 그 사이에 축 늘어진 밧줄
  const ts = [-0.86, -0.3, 0.3, 0.86];
  for (const s of [-1, 1]) {
    const tops = [];
    for (const t of ts) {
      const z = zA(t);
      const y = yUp(t) - 0.02;
      box(m, { x: s * 0.53, z, y, w: 0.14, d: 0.14, h: 0.4, color: '#cdc4b1' });
      box(m, { x: s * 0.53, z, y: y + 0.4, w: 0.21, d: 0.21, h: 0.09, color: P.stoneDark, top: P.stone });
      tops.push([s * 0.53, y + 0.47, z]);
    }
    // 기둥 사이의 밧줄 — 가운데를 크게 늘어뜨려 축 처지게 한다 (팽팽한 직선이 아니다)
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i];
      const b = tops[i + 1];
      const sag = 0.24;
      let prev = a;
      for (let k = 1; k <= 3; k++) {
        const u = k / 3;
        const p = [
          a[0] + (b[0] - a[0]) * u,
          a[1] + (b[1] - a[1]) * u - sag * Math.sin(Math.PI * u),
          a[2] + (b[2] - a[2]) * u,
        ];
        strut(m, prev, p, 0.026, '#9a8b70', 3);
        prev = p;
      }
    }
  }

  return finish(m, { radius: 1.2, kind: 'bridge' });
}

// ── 11. 울타리 조각 (fence pieces) ────────────
/** 그림 왼쪽: 뾰족한 살 3개 + 가로대 2줄 */
export function fencePiece(seed = 1) {
  const m = mesh();
  for (let i = 0; i < 3; i++) picket(m, { x: -0.78 + i * 0.78, w: 0.17, d: 0.1, h: 0.8 });
  for (const y of [0.24, 0.54]) box(m, { y, w: 1.98, d: 0.07, h: 0.09, color: P.woodDark });
  return finish(m, { radius: 0.55, kind: 'fence' });
}

/** 그림 오른쪽: 가로대 2줄 + 기둥마다 X 자 결속, 옆에 부러져 기운 널판 한 장 */
export function railFence(seed = 1) {
  const m = mesh();
  const px = 0.72;
  for (const s of [-1, 1]) picket(m, { x: s * px, w: 0.16, d: 0.12, h: 0.86 });
  for (const y of [0.38, 0.62]) box(m, { y, w: 2.0, d: 0.08, h: 0.1, color: P.wood });
  // X 자 결속 4곳 (기둥 2 × 가로대 2)
  for (const s of [-1, 1]) {
    for (const y of [0.43, 0.67]) {
      xLashing(m, { x: s * px, y, z: 0.09, s: 0.2, color: '#8a7a5f', t: 0.04, flat: true });
    }
  }
  // 부러져 기울어진 널판
  const plank = mesh();
  box(plank, { w: 0.16, d: 0.07, h: 0.78, color: P.woodDark });
  merge(m, plank, { rz: 0.55, tx: 1.32, ty: 0.05, tz: -0.06 });
  return finish(m, { radius: 0.6, kind: 'fence' });
}

// ── 12. 작은 성채 (small castle-like structure) ─
// 그림: 성가퀴를 두른 네모 본채, 그 정면을 지배하는 것은 어두운 세로 널을 댄 아치 쌍여닫이 성문이다
//       (본채 폭의 절반 가까이 되고, 앞으로 도드라져 나와 있다). 본채 위의 깃발,
//       오른쪽에 낮은 성가퀴 날개벽과 원뿔 지붕을 쓴 곁탑, 작은 십자 창들.
export function castle(seed = 1) {
  const m = mesh();
  const W = 2.5;
  const D = 1.9;
  const H = 2.85;

  // 본채 + 난간 띠 + 성가퀴
  // 성문 구멍은 문짝보다 작게 뚫고, 인방띠는 문 아치 머리 높이에서 끊는다
  wallBox(m, {
    w: W,
    d: D,
    h: H,
    color: P.stone,
    top: P.stoneDark,
    opening: { u0: -0.76, u1: 0.16, top: 0.94 },
    splits: [1.06, 1.56],
  });
  box(m, { y: H, w: W + 0.12, d: D + 0.12, h: 0.13, color: P.stoneDark });
  const merlon = (x, z, mw, md) => box(m, { x, z, y: H + 0.13, w: mw, d: md, h: 0.34, color: P.stone, top: P.stoneDark });
  for (let i = 0; i < 4; i++) {
    const mx = -W / 2 + (W / 4) * (i + 0.5);
    merlon(mx, D / 2 - 0.11, 0.34, 0.22);
    merlon(mx, -D / 2 + 0.11, 0.34, 0.22);
  }
  for (let i = 0; i < 2; i++) {
    const mz = -D / 2 + (D / 2) * (i + 0.5);
    merlon(-W / 2 + 0.11, mz, 0.22, 0.34);
    merlon(W / 2 - 0.11, mz, 0.22, 0.34);
  }
  pennant(m, { x: -0.1, y: H + 0.47, z: 0, h: 0.72, len: 0.5, color: P.cloth, ry: 0.15 });

  // 아치 쌍여닫이 성문 — 그림에서 정면을 지배하는 요소.
  // 어두운 세로 널 문짝이 벽보다 한참 앞으로 도드라지고, 그 둘레로 어둡게 파인 감실이 보인다.
  // 잉크 렌더러는 면 중심 깊이로 정렬하므로 감실·문짝·인방을 "같은 높이 띠"로 끊어 두어야
  // 앞뒤가 뒤집히지 않는다. 띠 경계는 wallBox 의 splits 와 맞춰 놓았다.
  const GF = wallFrame(-0.3, 0, D / 2, 0);
  const arcW = (hwv, sp, y) => (y <= sp ? hwv : Math.sqrt(Math.max(0, hwv * hwv - (y - sp) * (y - sp))));
  const arcBand = (hwv, sp, y0, y1, off, color) => {
    const a = arcW(hwv, sp, y0);
    const b = arcW(hwv, sp, y1);
    poly(m, [GF.p(-a, y0, off), GF.p(a, y0, off), GF.p(b, y1, off), GF.p(-b, y1, off)], color, { double: true });
  };
  const arcCap = (hwv, sp, y0, off, color) => {
    const t0 = Math.asin(Math.min(1, Math.max(0, (y0 - sp) / hwv)));
    const pts = [GF.p(-hwv * Math.cos(t0), y0, off), GF.p(hwv * Math.cos(t0), y0, off)];
    for (let i = 1; i < 7; i++) {
      const th = t0 + ((Math.PI - 2 * t0) * i) / 7;
      pts.push(GF.p(hwv * Math.cos(th), sp + hwv * Math.sin(th), off));
    }
    poly(m, pts, color, { double: true });
  };
  const rows = [0, 0.4, 0.54, 0.94, 1.06];

  // 어둡게 파인 감실 — 문짝보다 한 겹 크다
  const rw = 0.65;
  const rsp = 1.56 - rw;
  for (let i = 0; i < rows.length - 1; i++) arcBand(rw, rsp, rows[i], rows[i + 1], 0.02, '#6b6155');
  arcCap(rw, rsp, 1.06, 0.02, '#6b6155');

  // 문짝 — 폭 1.08 로 본채 폭(2.5)의 절반 가까이 된다
  const dw = 0.54; // 반폭
  const dsp = 1.52 - dw;
  const dz = 0.16; // 벽보다 앞으로 나온 양
  const cols = [-0.54, -0.288, -0.036, 0.036, 0.288, 0.54];
  const plank = ['#5b4832', '#6b563c', '#3a2e20', '#6b563c', '#5b4832']; // 가운데가 두 짝이 만나는 이음선
  for (const yy of [[rows[0], rows[1]], [rows[2], rows[3]]]) {
    for (let c = 0; c < 5; c++) {
      poly(
        m,
        [GF.p(cols[c], yy[0], dz), GF.p(cols[c + 1], yy[0], dz), GF.p(cols[c + 1], yy[1], dz), GF.p(cols[c], yy[1], dz)],
        plank[c],
        { double: true }
      );
    }
  }
  // 가로 띠쇠 두 줄
  arcBand(dw, dsp, rows[1], rows[2], dz, '#463829');
  arcBand(dw, dsp, rows[3], rows[4], dz, '#463829');
  // 아치 머리 + 거기까지 이어지는 가운데 이음선
  arcCap(dw, dsp, 1.06, dz, '#5b4832');
  GF.panel(m, 0, 1.27, 0.07, 0.4, '#3a2e20', dz + 0.02);
  // 손잡이 고리 두 개
  for (const s of [-1, 1]) GF.panel(m, s * 0.17, 0.72, 0.09, 0.09, '#2f2618', dz + 0.05);

  // 작은 십자 창 3개 · 벽에 붙은 브래킷 2개
  const FF = wallFrame(0, 0, D / 2, 0);
  crossWindow(m, FF, -0.72, 2.0, 0.3, 0.36, P.stoneDark, '#4f5a5e');
  const q1 = FF.p(-1.05, 1.2, 0.03);
  box(m, { x: q1[0], y: q1[1], z: q1[2], w: 0.26, d: 0.16, h: 0.24, color: P.stone, top: P.stoneDark });
  const q2 = FF.p(0.86, 1.9, 0.03);
  box(m, { x: q2[0], y: q2[1], z: q2[2], w: 0.26, d: 0.16, h: 0.24, color: P.stone, top: P.stoneDark });

  // 오른쪽 낮은 날개벽 (성가퀴 3개)
  const wx = W / 2 + 0.62;
  box(m, { x: wx, w: 1.3, d: D * 0.8, h: 1.95, color: P.stone, top: P.stoneDark });
  for (let i = 0; i < 3; i++) {
    box(m, { x: wx - 0.44 + i * 0.44, z: D * 0.4 - 0.11, y: 1.95, w: 0.3, d: 0.2, h: 0.28, color: P.stone, top: P.stoneDark });
  }
  const WF2 = wallFrame(wx - 0.15, 0, D * 0.4, 0);
  crossWindow(m, WF2, 0, 1.25, 0.28, 0.34, P.stoneDark, '#4f5a5e');

  // 곁탑 — 원뿔 지붕과 깃발
  const tx = W / 2 + 1.18;
  const tH = 3.5;
  box(m, { x: tx, w: 0.92, d: 0.92, h: tH, color: P.stone, top: P.stoneDark });
  cone(m, { x: tx, y: tH, r: 0.82, h: 0.78, seg: 4, color: P.roofRed, ry: Math.PI / 4, skirt: -0.05 });
  pennant(m, { x: tx, y: tH + 0.72, h: 0.5, len: 0.38, color: P.roofBlue, ry: -0.2 });
  const TF = wallFrame(tx, 0, 0.46, 0);
  crossWindow(m, TF, 0, 2.85, 0.26, 0.32, P.stoneDark, '#4f5a5e');

  return finish(m, { radius: 1.9, kind: 'castle' });
}

// ── 우물 (well) ───────────────────────────────
// 그림: 돌덩이가 낱장으로 보이는 두레박 우물 난간, 기둥 2개, 비늘이 그려진 박공 지붕,
//       가운데에 밧줄로 매달린 두레박과 옆의 크랭크 손잡이.
export function well(seed = 1) {
  const m = mesh();
  const kr = 0.46;
  // 돌 난간 — 블록을 원 둘레에 접선 방향으로 눕혀 두 켜로 엇갈려 쌓는다(그림의 돌쌓기)
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + (c ? Math.PI / 6 : 0);
      box(m, {
        x: Math.sin(a) * kr,
        z: Math.cos(a) * kr,
        y: c * 0.27,
        w: 0.56,
        d: 0.22,
        h: 0.28,
        color: c ? P.stone : P.stoneDark,
        top: P.stone,
        ry: a,
      });
    }
  }
  plate(m, { y: 0.52, w: 0.56, d: 0.56, color: '#6d7f83' });

  // 기둥 2개
  for (const s of [-1, 1]) box(m, { x: s * 0.44, y: 0.5, w: 0.12, d: 0.12, h: 1.2, color: P.wood });

  // 비늘 박공 지붕
  const ry0 = 1.7;
  const rh = 0.44;
  gable(m, { y: ry0, w: 1.3, d: 0.92, h: rh, color: P.roofRed, eave: 0.11 });
  box(m, { y: ry0 + rh - 0.02, w: 1.4, d: 0.1, h: 0.07, color: '#b56a51' });
  const halfd = 0.46 + 0.11;
  const th = Math.atan2(rh, halfd);
  for (const s of [-1, 1]) {
    const sh = mesh();
    box(sh, { w: 1.36, d: 0.09, h: 0.045, color: '#c9765a' });
    merge(m, sh, { rx: s * th, ty: ry0 + rh * 0.46, tz: s * halfd * 0.54 });
  }

  // 두레박 축 · 크랭크 · 밧줄 · 두레박
  const dy = 1.42;
  const drum = mesh();
  cylinder(drum, { r: 0.085, h: 0.78, seg: 6, color: P.woodDark, capColor: P.wood });
  merge(m, drum, { rz: -Math.PI / 2, tx: -0.39, ty: dy });
  const crank = mesh();
  box(crank, { w: 0.05, d: 0.05, h: 0.22, color: P.trunkDark });
  merge(m, crank, { rz: 1.2, tx: 0.42, ty: dy });
  const grip = mesh();
  cylinder(grip, { r: 0.035, h: 0.14, seg: 4, color: P.trunk, cap: false });
  merge(m, grip, { rz: Math.PI / 2, tx: 0.55, ty: dy + 0.08 });
  strut(m, [0, dy - 0.07, 0], [0, 0.94, 0], 0.016, '#8a7f6c');
  cylinder(m, { y: 0.7, r: 0.16, r2: 0.13, h: 0.24, seg: 6, color: P.wood, capColor: '#7fb9c8' });

  return finish(m, { radius: 0.85, kind: 'well' });
}

// ── 이정표 (sign post) ────────────────────────
// 그림: 머리가 뾰족한 기둥에 한쪽 끝이 화살처럼 뾰족한 판이 달려 있다.
function arrowBoard(len, h, t, color) {
  // xy 평면에 선 닫힌 판 — 한쪽 끝이 화살촉처럼 뾰족하다
  const pts = [
    [-len * 0.45, -h / 2],
    [len * 0.35, -h / 2],
    [len * 0.55, 0],
    [len * 0.35, h / 2],
    [-len * 0.45, h / 2],
  ];
  const b = mesh();
  const f = pts.map((p) => [p[0], p[1], t / 2]);
  const k = pts.map((p) => [p[0], p[1], -t / 2]);
  poly(b, f, color);
  poly(b, k.slice().reverse(), color);
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    quad(b, f[i], k[i], k[j], f[j], color);
  }
  return b;
}

export function signPost(seed = 1) {
  const m = mesh();
  const h = 1.4;
  box(m, { w: 0.12, d: 0.12, h, color: P.wood });
  cone(m, { y: h, r: 0.1, h: 0.16, seg: 4, color: P.woodDark, ry: Math.PI / 4 });
  merge(m, arrowBoard(0.84, 0.28, 0.07, P.wood), { ry: 0.28, tx: 0.22, ty: h - 0.3 });
  merge(m, arrowBoard(0.72, 0.26, 0.07, P.wood), { ry: Math.PI - 0.4, tx: -0.2, ty: h - 0.66 });
  return finish(m, { radius: 0.25, kind: 'sign' });
}

// ── 수레 (cart) ───────────────────────────────
// 그림: 위가 트인 널판 짐칸, 살이 보이는 큰 바퀴 두 개, 앞으로 길게 뻗은 끌채.
export function cart(seed = 1) {
  const m = mesh();
  const bw = 0.92; // 폭
  const bd = 1.5; // 길이(끌채 방향)
  const by = 0.46;
  // 짐칸 — 바닥 + 옆널 4장(위가 트여 있다)
  box(m, { y: by, w: bw, d: bd, h: 0.09, color: P.woodDark, top: P.wood });
  for (const s of [-1, 1]) {
    box(m, { x: s * (bw / 2 - 0.04), y: by + 0.07, w: 0.08, d: bd, h: 0.4, color: P.wood });
    box(m, { z: s * (bd / 2 - 0.04), y: by + 0.07, w: bw - 0.16, d: 0.08, h: 0.4, color: P.wood });
  }
  // 널 이음매
  for (const s of [-1, 1]) {
    for (const yy of [0.7, 0.84]) {
      panel(m, { x: s * (bw / 2 + 0.01), y: yy, w: bd - 0.2, h: 0.035, color: P.woodDark, ry: (s * Math.PI) / 2 });
    }
  }
  // 살 바퀴 — 바깥면이 원판이라 살이 또렷하게 보인다
  const wr = 0.4;
  for (const s of [-1, 1]) {
    const wheel = mesh();
    cylinder(wheel, { r: wr, h: 0.11, seg: 9, color: P.trunkDark, capColor: P.wood });
    merge(m, wheel, { rz: -s * Math.PI * 0.5, tx: s * (bw / 2 - 0.02), ty: wr, tz: -0.1 });
    for (let i = 0; i < 5; i++) {
      const sp = mesh();
      panel(sp, { y: -wr * 0.94, w: 0.055, h: wr * 1.88, color: P.trunkDark });
      merge(m, sp, { rz: (i / 5) * Math.PI, ry: (s * Math.PI) / 2, tx: s * (bw / 2 + 0.11), ty: wr, tz: -0.1 });
    }
    const hub = mesh();
    cylinder(hub, { r: 0.08, h: 0.1, seg: 6, color: P.wood, capColor: P.trunk });
    merge(m, hub, { rz: -s * Math.PI * 0.5, tx: s * (bw / 2 + 0.1), ty: wr, tz: -0.1 });
  }
  // 긴 끌채 두 줄 + 앞 가로대
  for (const s of [-1, 1]) beam(m, [s * 0.3, 0.52, bd / 2 - 0.05], [s * 0.24, 0.3, bd / 2 + 1.0], 0.07, 0.07, P.woodDark);
  box(m, { y: 0.28, z: bd / 2 + 0.95, w: 0.62, d: 0.07, h: 0.07, color: P.woodDark });
  return finish(m, { radius: 0.8, kind: 'cart' });
}

// ── 나머지 소품 ───────────────────────────────
export function lampPost(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 0.09, r2: 0.06, h: 2.3, seg: 6, color: '#4b463d', cap: false });
  beam(m, [0, 2.26, 0], [0.52, 2.26, 0], 0.07, 0.07, '#4b463d');
  beam(m, [0.04, 1.94, 0], [0.36, 2.24, 0], 0.05, 0.05, '#4b463d');
  strut(m, [0.5, 2.24, 0], [0.5, 1.98, 0], 0.02, '#4b463d');
  cylinder(m, { x: 0.5, y: 1.58, r: 0.18, r2: 0.15, h: 0.38, seg: 6, color: '#ffe1a0', capColor: '#4b463d' });
  cone(m, { x: 0.5, y: 1.96, r: 0.21, h: 0.14, seg: 6, color: '#4b463d' });
  return finish(m, { radius: 0.22, kind: 'lamp' });
}

export function barrel(seed = 1) {
  const m = mesh();
  cylinder(m, { r: 0.3, r2: 0.27, h: 0.72, seg: 8, color: P.wood, capColor: '#e0bd8f' });
  for (const y of [0.12, 0.52]) cylinder(m, { y, r: 0.32, h: 0.07, seg: 8, color: P.trunkDark, cap: false });
  return finish(m, { radius: 0.34, kind: 'barrel' });
}

export function crate(seed = 1) {
  const m = mesh();
  const s = 0.62;
  box(m, { w: s, d: s, h: 0.6, color: P.wood, top: '#e0bd8f' });
  // 모서리 기둥 + 네 면의 X 보강대 + 뚜껑의 X — 그림의 상자 무늬 그대로
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) box(m, { x: sx * (s / 2 - 0.03), z: sz * (s / 2 - 0.03), w: 0.07, d: 0.07, h: 0.6, color: P.woodDark });
  }
  for (let i = 0; i < 4; i++) {
    const ry = (i / 4) * Math.PI * 2;
    const F = wallFrame(0, 0.3, 0, ry);
    for (const a of [0.75, -0.75]) {
      const b = mesh();
      panel(b, { y: -0.29, w: 0.05, h: 0.58, color: P.woodDark });
      const q = F.p(0, 0, s / 2 + 0.015);
      merge(m, b, { rz: a, ry, tx: q[0], ty: q[1], tz: q[2] });
    }
  }
  for (const a of [1, -1]) {
    quad(
      m,
      [-s * 0.42, 0.61, a * -s * 0.42],
      [s * 0.42, 0.61, a * s * 0.42],
      [s * 0.42 - 0.05, 0.61, a * (s * 0.42) + 0.05 * a],
      [-s * 0.42 - 0.05, 0.61, a * -s * 0.42 + 0.05 * a],
      P.woodDark,
      { double: true }
    );
  }
  return finish(m, { radius: 0.38, kind: 'crate' });
}

export function campfire(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  // 둘레의 돌 — 그림처럼 낱장 덩어리로 보이게, 면 수는 아끼려고 각진 블록으로
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    box(m, {
      x: Math.cos(a) * 0.5,
      z: Math.sin(a) * 0.5,
      w: rand(rng, 0.24, 0.34),
      d: rand(rng, 0.2, 0.28),
      h: rand(rng, 0.14, 0.22),
      color: i % 2 ? P.stone : P.stoneDark,
      top: P.stone,
      ry: -a + rand(rng, -0.2, 0.2),
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

/** 장작더미 */
export function woodPile(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const n = rows - r;
    for (let i = 0; i < n; i++) {
      const logM = mesh();
      cylinder(logM, { r: 0.13, h: 1.1, seg: 6, color: r % 2 ? P.trunk : P.trunkDark, capColor: '#dcb98c' });
      merge(m, logM, {
        rz: Math.PI / 2,
        tx: -0.55,
        ty: 0.13 + r * 0.24,
        tz: (i - (n - 1) / 2) * 0.27 + rand(rng, -0.03, 0.03),
      });
    }
  }
  return finish(m, { radius: 0.6, kind: 'woodpile' });
}

/** 텃밭 — 흙 이랑과 새싹 */
export function gardenPlot(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const w = 2.2;
  const d = 1.6;
  box(m, { w, d, h: 0.14, color: '#a98b62', top: '#c2a377' });
  for (let r = 0; r < 3; r++) {
    const z = -d / 2 + 0.4 + r * 0.4;
    box(m, { z, w: w - 0.3, d: 0.2, h: 0.12, color: '#8f7350', top: '#a98b62' });
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + 0.5 + i * 0.6;
      blobSphere(m, {
        x,
        z,
        y: 0.27,
        rx: 0.14,
        ry: 0.15,
        seg: 5,
        rings: 2,
        color: rng() < 0.4 ? '#8fbf6a' : '#a3cd79',
        wob: 0.16,
        seed: seed + r * 7 + i,
      });
    }
  }
  return finish(m, { radius: 1.0, kind: 'garden' });
}

/** 빨랫줄 */
export function laundryLine(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const span = 2.6;
  for (const s of [-1, 1]) {
    cylinder(m, { x: s * span * 0.5, r: 0.06, h: 1.7, seg: 5, color: P.woodDark, cap: false });
    const arm = mesh();
    cylinder(arm, { r: 0.04, h: 0.34, seg: 4, color: P.woodDark, cap: false });
    merge(m, arm, { rz: s * 1.1, tx: s * span * 0.5, ty: 1.5 });
  }
  box(m, { y: 1.66, w: span, d: 0.03, h: 0.03, color: '#6b6156' });
  const colors = ['#f1e2c6', '#cfe3ea', '#f0c0b0', '#d8e8c8'];
  for (let i = 0; i < 4; i++) {
    panel(m, {
      x: -span * 0.34 + i * (span * 0.23),
      y: 1.66 - rand(rng, 0.5, 0.72),
      w: rand(rng, 0.34, 0.46),
      h: rand(rng, 0.5, 0.72),
      color: colors[i % colors.length],
      ry: rand(rng, -0.2, 0.2),
    });
  }
  return finish(m, { radius: 0.4, kind: 'laundry' });
}

/** 건초더미 */
export function hayBale(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const t = mesh();
  cylinder(t, { r: 0.46, h: 0.8, seg: 9, color: '#dcc079', capColor: '#e6cd8e' });
  merge(m, t, { rx: Math.PI / 2, ty: 0.46, ry: rand(rng, 0, 3) });
  return finish(m, { radius: 0.5, kind: 'hay' });
}

/** 물통 */
export function trough(seed = 1) {
  const m = mesh();
  box(m, { w: 1.2, d: 0.5, h: 0.34, color: P.woodDark, top: '#9ec9d4' });
  for (const s of [-1, 1]) box(m, { x: s * 0.5, w: 0.12, d: 0.5, h: 0.44, color: P.wood });
  return finish(m, { radius: 0.55, kind: 'trough' });
}

/** 창가 화단 */
export function flowerBox(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  box(m, { w: 0.8, d: 0.28, h: 0.22, color: P.woodDark, top: '#7b5f42' });
  for (let i = 0; i < 5; i++) {
    blobSphere(m, {
      x: -0.3 + i * 0.15,
      y: 0.26,
      rx: 0.09,
      ry: 0.08,
      seg: 5,
      rings: 2,
      color: pickColor(rng),
      wob: 0.14,
      seed: seed + i,
    });
  }
  return finish(m, { radius: 0.3, kind: 'flowerbox' });
}

function pickColor(rng) {
  const list = ['#e8909f', '#efc86a', '#b79ede', '#f0f0e2', '#e88f6a'];
  return list[Math.floor(rng() * list.length) % list.length];
}
