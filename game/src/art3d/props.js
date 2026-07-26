// 레퍼런스 Sheet 4(소품 & 오브젝트)를 한 칸씩 대조해 옮긴 저폴리 3D 소품.
// Sheet 7(장식·경계)·지형 시트 항목은 decor.js 로 옮겨가는 중이라 여기서는 얇은 호환 버전만 남긴다.
//
// 잉크 선은 "실루엣 + 꺾인 크리스 + 열린 면의 테두리"에만 그려진다.
// 그래서 그림 속 선(널빤지 이음매·쇠띠·X 브레이스·바퀴살·손잡이)은
// 전부 얇은 양면 쿼드(slat/ribbonArc)로 진짜 지오메트리로 박아 넣었다.
import { mesh, merge, box, gable, cylinder, cone, blobSphere, extrude, tri, quad, poly, panel, bounds } from '../core/mesh.js';
import { P } from '../art/palette.js';
import { makeRng, rand, randInt, pick } from '../core/rng.js';

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
const TOPW = '#e2c295'; // 켠 나무 단면(밝은 널빤지 윗면)
const IRON = '#8a857a';
const IRON_D = '#5c574e';
const ROPE = '#c9b18a';
const SACK = '#ddceac';
const SACK_D = '#c8b692';
const CERAMIC = '#e0cfae';

// ── 손그림 선을 만드는 공용 부품 ──────────────
/**
 * 얇은 양면 판. 벽에서 0.02 쯤 띄워 붙이면 "면에 그은 선"이 된다.
 * (X 브레이스, 널빤지 이음매, 쇠띠, 못자국, 빨랫줄 …)
 * 중심이 (x,y,z) 이고 기본은 XY 평면에 서 있다. rz→rx→ry 는 "제자리 회전",
 * yaw 는 판을 놓은 뒤 모델 원점을 축으로 통째로 돌린다(상자 네 면에 같은 무늬를 붙일 때).
 */
function slat(m, o) {
  const { x = 0, y = 0, z = 0, w = 0.1, h = 0.4, color = DARK, rx = 0, ry = 0, rz = 0, yaw = 0, outline = true } = o;
  const b = mesh();
  quad(b, [-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0], color, {
    double: true,
    soft: true,
    outline,
  });
  if (yaw) {
    const t = mesh();
    merge(t, b, { tx: x, ty: y, tz: z, rx, ry, rz });
    merge(m, t, { ry: yaw });
  } else {
    merge(m, b, { tx: x, ty: y, tz: z, rx, ry, rz });
  }
  return m;
}

/**
 * 원호 리본 — 안쪽·바깥쪽 두 줄로 보이는 띠.
 * 양동이/바구니 손잡이, 상자 쇠띠, 마차 살대처럼 그림에서 "두 줄"로 그려진 부품용.
 * XY 평면에 놓이고 정면(+z)에서 보면 아치로 보인다.
 */
function ribbonArc(m, o) {
  const { x = 0, y = 0, z = 0, r = 0.2, ry2 = null, w = 0.035, seg = 6, a0 = 0, a1 = Math.PI, color = DARK, ry = 0, rz = 0 } = o;
  const rv = ry2 == null ? r : ry2;
  const b = mesh();
  const pt = (t, k) => [Math.cos(t) * (r + k), Math.sin(t) * (rv + k), 0];
  for (let i = 0; i < seg; i++) {
    const t0 = a0 + (a1 - a0) * (i / seg);
    const t1 = a0 + (a1 - a0) * ((i + 1) / seg);
    quad(b, pt(t0, -w / 2), pt(t0, w / 2), pt(t1, w / 2), pt(t1, -w / 2), color, { double: true, soft: true });
  }
  merge(m, b, { tx: x, ty: y, tz: z, ry, rz });
  return m;
}

/**
 * 반원 통 — 축은 x. 마차 천막, 상자 둥근 뚜껑, 우편함 지붕, 반쪽 통나무에 쓴다.
 * a0..a1 로 호의 범위를 지정한다(0..PI 면 위쪽 반원, PI..2PI 면 아래쪽 반원).
 */
function halfTube(m, o) {
  const {
    x = 0,
    y = 0,
    z = 0,
    len = 1,
    r = 0.2,
    seg = 7,
    color = WOOD,
    capColor = null,
    a0 = 0,
    a1 = Math.PI,
    lid = false,
    lidColor = null,
    caps = true,
    soft = true,
    ry = 0,
    double = false,
  } = o;
  const b = mesh();
  const hl = len / 2;
  const ring = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + (a1 - a0) * (i / seg);
    ring.push([Math.cos(a) * r, Math.sin(a) * r]); // [z, y]
  }
  for (let i = 0; i < seg; i++) {
    const p = ring[i];
    const q = ring[i + 1];
    quad(b, [-hl, p[1], p[0]], [hl, p[1], p[0]], [hl, q[1], q[0]], [-hl, q[1], q[0]], color, { soft, double });
  }
  if (caps) {
    const cm = ring.map((p) => [-hl, p[1], p[0]]);
    const cp = ring.map((p) => [hl, p[1], p[0]]);
    poly(b, cm, capColor || color);
    poly(b, cp.slice().reverse(), capColor || color);
  }
  if (lid) {
    const p0 = ring[0];
    const p1 = ring[seg];
    quad(b, [-hl, p0[1], p0[0]], [-hl, p1[1], p1[0]], [hl, p1[1], p1[0]], [hl, p0[1], p0[0]], lidColor || color);
  }
  merge(m, b, { tx: x, ty: y, tz: z, ry });
  return m;
}

/**
 * 바깥을 향해 감은 원통. mesh.js 의 cylinder 는 옆면이 안쪽을 향하고 있어서
 * 화가 알고리즘의 깊이 정렬이 뒤집힌다 — 통 몸통보다 살짝 굵은 쇠테가 몸통 뒤로
 * 밀려 사라진다. 쇠테·테두리처럼 "겹쳐 보여야 하는" 곡면은 이 tube 를 쓴다.
 */
function tube(m, o) {
  const { x = 0, y = 0, z = 0, r = 0.5, r2 = null, h = 1, seg = 9, color = '#ccc', cap = false, capColor = null, ry = 0, soft = true } = o;
  const rt = r2 == null ? r : r2;
  const b = mesh();
  const lo = [];
  const up = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    lo.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
    up.push([Math.cos(a) * rt, h, Math.sin(a) * rt]);
  }
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    quad(b, lo[i], up[i], up[j], lo[j], color, { soft });
  }
  if (cap && rt > 0.001) poly(b, up.slice().reverse(), capColor || color);
  merge(m, b, { tx: x, ty: y, tz: z, ry });
  return m;
}

/**
 * 옆모습 실루엣(=[y, 반지름] 목록)을 돌려 만든 회전체. 마디마다 반지름이 이어지므로
 * 항아리·기름등처럼 잘록한 데가 있는 물건에서 이음매가 벌어지지 않는다.
 * colors 를 주면 마디별로 색을 달리한다(심지 고리 같은 띠).
 */
function profileTube(m, o) {
  const { x = 0, y = 0, z = 0, pts, seg = 8, color = '#ccc', colors = null, cap = false, capColor = null, soft = true, ry = 0 } = o;
  const b = mesh();
  const ring = (h, r) => {
    const out = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      out.push([Math.cos(a) * r, h, Math.sin(a) * r]);
    }
    return out;
  };
  for (let k = 0; k < pts.length - 1; k++) {
    const lo = ring(pts[k][0], pts[k][1]);
    const up = ring(pts[k + 1][0], pts[k + 1][1]);
    const c = (colors && colors[k]) || color;
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      quad(b, lo[i], up[i], up[j], lo[j], c, { soft });
    }
  }
  if (cap) {
    const top = pts[pts.length - 1];
    if (top[1] > 0.001) poly(b, ring(top[0], top[1]).reverse(), capColor || color);
  }
  merge(m, b, { tx: x, ty: y, tz: z, ry });
  return m;
}

/** 살 달린 바퀴 — 축이 x 축과 나란하도록 이미 눕혀서 돌려준다(원점 = 바퀴 중심). */
function wheelMesh(o = {}) {
  const { r = 0.3, t = 0.07, spokes = 6, seg = 9, tire = DARK, hub = WOOD } = o;
  const w = mesh();
  tube(w, { y: -t / 2, r, h: t, seg, color: tire });
  for (let i = 0; i < spokes / 2; i++) {
    const s = mesh();
    quad(s, [-r, 0, -0.022], [r, 0, -0.022], [r, 0, 0.022], [-r, 0, 0.022], hub, { double: true, soft: true });
    merge(w, s, { ry: (i / (spokes / 2)) * Math.PI });
  }
  tube(w, { y: -t * 0.55, r: r * 0.17, h: t * 1.1, seg: 5, color: hub, cap: true, capColor: DARK });
  const out = mesh();
  merge(out, w, { rz: Math.PI / 2 });
  return out;
}

/** 양쪽 마구리가 다 막힌 통나무 토막 — 중심이 원점, 길이는 y축 방향 */
function logMesh(len, r, seg = 5, color = P.trunk, capColor = '#e0bf94') {
  const l = mesh();
  tube(l, { y: -len / 2, r, h: len, seg, color, cap: true, capColor });
  const ring = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    ring.push([Math.cos(a) * r, -len / 2, Math.sin(a) * r]);
  }
  poly(l, ring, capColor);
  return l;
}

/** 작은 돌멩이 (모닥불 돌 테두리) */
function pebble(m, o) {
  const { x = 0, y = 0, z = 0, r = 0.12, h = 0.12, rng, color = STONE } = o;
  const pts = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.4;
    pts.push([Math.cos(a) * r * rand(rng, 0.8, 1.15), Math.sin(a) * r * rand(rng, 0.8, 1.15)]);
  }
  extrude(m, { x, y, z, pts, h, color, topColor: '#efeade', topScale: 0.72, soft: true });
  return m;
}

/**
 * 불꽃 — 사방으로 돌려 세운 뾰족한 혀 몇 갈래(양면 삼각형).
 * 각 혀를 제 평면에서 만든 뒤 ry 로 돌려야 한 방향에서만 보이는 판때기가 되지 않는다.
 */
function flameTongues(m, o) {
  const { x = 0, y = 0, z = 0, h = 0.42, r = 0.11, n = 3, seed = 1 } = o;
  const rng = makeRng(seed);
  for (let i = 0; i < n; i++) {
    const t = mesh();
    const rr = r * rand(rng, 0.55, 1.0);
    const hh = h * (i === 0 ? 1 : rand(rng, 0.45, 0.8));
    const lean = rand(rng, -0.35, 0.35);
    tri(t, [-rr, 0, 0], [rr, 0, 0], [rr * lean, hh, 0], i === 0 ? '#f5c26b' : P.fire, { double: true });
    // 가운데가 살짝 갈라진 혀
    if (i === 0) tri(t, [-rr * 0.7, hh * 0.35, 0], [rr * 0.2, hh * 0.3, 0], [-rr * 0.9, hh * 0.8, 0], P.fire, { double: true });
    merge(m, t, {
      ry: (i / n) * Math.PI * 2 + 0.5,
      tx: x + Math.cos((i / n) * Math.PI * 2) * r * 0.3,
      ty: y,
      tz: z + Math.sin((i / n) * Math.PI * 2) * r * 0.3,
    });
  }
  return m;
}

// ══ Sheet 4 · 1행 : 나무 상자 ═════════════════
/** 뚜껑 덮은 나무 상자 — 모서리 각재 4개, 면마다 X 브레이스, 뚜껑 널빤지 이음매 */
export function crate(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = opt.scale || rand(rng, 0.92, 1.08);
  const W = 0.6 * s;
  const H = 0.46 * s;
  const hw = W / 2;
  box(m, { w: W, d: W, h: H, color: WOOD });
  // 모서리 각재 — 실루엣에서 튀어나와 상자다움을 만든다
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(m, { x: sx * (hw - 0.035 * s), z: sz * (hw - 0.035 * s), w: 0.1 * s, d: 0.1 * s, h: H, color: DARK });
    }
  }
  // 뚜껑
  box(m, { y: H, w: W + 0.06 * s, d: W + 0.06 * s, h: 0.08 * s, color: DARK, top: WOOD });
  // 뚜껑 널빤지 이음매 2줄
  for (const dz of [-0.18 * s, 0.18 * s]) {
    slat(m, { y: H + 0.082 * s, z: dz, w: W, h: 0.045 * s, color: DARK, rx: Math.PI / 2 });
  }
  // 네 면의 X 브레이스 + 아래 가로대
  const off = hw + 0.022;
  const braceLen = Math.hypot(W * 0.86, H * 0.82);
  const diag = Math.atan2(W * 0.86, H * 0.82);
  for (let i = 0; i < 4; i++) {
    const yaw = (i / 4) * Math.PI * 2 + 0.0001;
    slat(m, { y: H * 0.5, z: off, w: 0.055 * s, h: braceLen, color: DARK, rz: diag, yaw });
    slat(m, { y: H * 0.5, z: off, w: 0.055 * s, h: braceLen, color: DARK, rz: -diag, yaw });
    slat(m, { y: 0.07 * s, z: off, w: W * 0.9, h: 0.06 * s, color: DARK, yaw });
  }
  return finish(m, { radius: 0.34 * s, kind: 'crate' });
}

/** 뚜껑 없는 상자 — 안쪽 벽이 보이고 위 테두리에 가로대가 둘린다 */
export function crateOpen(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = opt.scale || rand(rng, 0.92, 1.08);
  const W = 0.6 * s;
  const H = 0.42 * s;
  const hw = W / 2;
  const t = 0.055 * s;
  // 네 벽(얇은 판이라 안쪽 면이 그대로 보인다)
  for (let i = 0; i < 4; i++) {
    const inner = mesh();
    box(inner, { z: hw - t / 2, w: W, d: t, h: H, color: WOOD });
    merge(m, inner, { ry: (i / 4) * Math.PI * 2 + 0.0001 });
  }
  // 바닥
  quad(
    m,
    [-hw, 0.02, hw],
    [hw, 0.02, hw],
    [hw, 0.02, -hw],
    [-hw, 0.02, -hw],
    '#c9a476',
    { double: true }
  );
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(m, { x: sx * (hw - 0.03 * s), z: sz * (hw - 0.03 * s), w: 0.09 * s, d: 0.09 * s, h: H + 0.03 * s, color: DARK });
    }
  }
  for (let i = 0; i < 4; i++) {
    const yaw = (i / 4) * Math.PI * 2 + 0.0001;
    slat(m, { y: H - 0.05 * s, z: hw + 0.022, w: W * 0.92, h: 0.06 * s, color: DARK, yaw });
    slat(m, { y: 0.07 * s, z: hw + 0.022, w: W * 0.92, h: 0.06 * s, color: DARK, yaw });
  }
  return finish(m, { radius: 0.34 * s, kind: 'crate' });
}

/** 널빤지 더미 — 시트 1행의 낮고 납작한 판자 묶음 */
export function plankStack(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const n = opt.planks || randInt(rng, 3, 4);
  // 아래 받침목 2개
  for (const sz of [-1, 1]) {
    box(m, { z: sz * 0.3, w: 0.9, d: 0.1, h: 0.07, color: DARK });
  }
  for (let i = 0; i < n; i++) {
    box(m, {
      x: rand(rng, -0.04, 0.04),
      y: 0.07 + i * 0.065,
      w: rand(rng, 0.95, 1.05),
      d: 0.72,
      h: 0.06,
      color: i % 2 ? WOOD : '#d3b083',
      top: TOPW,
      ry: rand(rng, -0.05, 0.05),
    });
  }
  // 맨 위 판의 널 이음매
  slat(m, { y: 0.07 + n * 0.065 + 0.002, w: 1.0, h: 0.04, color: DARK, rx: Math.PI / 2 });
  return finish(m, { radius: 0.52, kind: 'planks' });
}

// ══ Sheet 4 · 1행 : 통 ════════════════════════
/**
 * 나무살 통 — 옆면을 여러 마디로 쪼개 쌓고 그 위에 쇠테를 확실히 도드라지게 감는다.
 * 옆면을 한 덩어리로 두면 긴 면의 무게중심이 더 앞에 놓여 얇은 쇠테가 몸통에 먹힌다.
 * soft:false 라 마디마다 세로 나무살 선이 생긴다.
 */
function staved(m, o) {
  const {
    y = 0,
    h = 1,
    rAt,
    seg = 9,
    sections = 4,
    color = WOOD,
    hoops = [],
    hoopColor = IRON_D,
    hoopW = 0.05,
    proud = 0.024,
  } = o;
  for (let i = 0; i < sections; i++) {
    const t0 = i / sections;
    const t1 = (i + 1) / sections;
    tube(m, { y: y + h * t0, r: rAt(t0), r2: rAt(t1), h: h * (t1 - t0), seg, color, soft: false });
  }
  const hw = hoopW / (2 * h);
  for (const t of hoops) {
    tube(m, {
      y: y + h * t - hoopW / 2,
      r: rAt(Math.max(0, t - hw)) + proud,
      r2: rAt(Math.min(1, t + hw)) + proud,
      h: hoopW,
      seg,
      color: hoopColor,
    });
  }
  return m;
}

/** 통 몸통 — 배가 부른 실루엣 + 세로 나무살 + 쇠테 2~3줄 + 뚜껑판 */
function barrelBody(m, o) {
  const { y = 0, h = 0.7, r = 0.2, bulge = 0.06, seg = 9, hoops = 3, color = WOOD, lid = true } = o;
  const rb = r + bulge;
  const rAt = (t) => rb - (rb - r) * Math.pow(2 * t - 1, 2);
  staved(m, {
    y,
    h,
    rAt,
    seg,
    sections: 4,
    color,
    hoops: hoops === 2 ? [0.14, 0.86] : [0.09, 0.5, 0.91],
    hoopW: h * 0.075,
    proud: 0.024,
  });
  if (lid) tube(m, { y: y + h - 0.05, r: r * 0.93, h: 0.055, seg, color: '#cda877', cap: true, capColor: TOPW });
  return m;
}

/** 나무 통 (세워 놓은 큰 통) */
export function barrel(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = opt.scale || rand(rng, 0.9, 1.1);
  barrelBody(m, { h: 0.7 * s, r: 0.2 * s, bulge: 0.06 * s, hoops: 3 });
  return finish(m, { radius: 0.27 * s, kind: 'barrel' });
}

/** 꼭지 달린 통 — 앞면 아래에 주둥이와 위로 선 손잡이가 붙는다 */
export function barrelTap(seed = 1, opt = {}) {
  const m = mesh();
  const s = opt.scale || 1;
  barrelBody(m, { h: 0.72 * s, r: 0.2 * s, bulge: 0.06 * s, hoops: 3 });
  // 주둥이 — 몸통에서 +z 로 나오는 짧은 관
  const spout = mesh();
  cylinder(spout, { r: 0.028 * s, h: 0.17 * s, seg: 5, color: IRON_D, capColor: IRON });
  merge(m, spout, { rx: Math.PI / 2, tz: 0.2 * s, ty: 0.19 * s });
  // 아래로 꺾인 끝
  cylinder(m, { z: 0.35 * s, y: 0.13 * s, r: 0.03 * s, h: 0.07 * s, seg: 5, color: IRON_D, capColor: IRON });
  // 손잡이 — 세로 막대 + 가로 손잡이
  cylinder(m, { z: 0.3 * s, y: 0.22 * s, r: 0.016 * s, h: 0.08 * s, seg: 4, color: IRON_D, cap: false });
  slat(m, { z: 0.3 * s, y: 0.3 * s, w: 0.13 * s, h: 0.03 * s, color: IRON_D });
  return finish(m, { radius: 0.27 * s, kind: 'barrel' });
}

/** 나무 받침대에 옆으로 눕힌 통 */
export function barrelCradle(seed = 1, opt = {}) {
  const m = mesh();
  const s = opt.scale || 1;
  const len = 0.72 * s;
  const r = 0.24 * s;
  const cradleH = 0.22 * s;
  // 받침대 — 양옆 다리널 + 그 바깥에 붙은 X 버팀 + 위 받침널
  for (const sx of [-1, 1]) {
    box(m, { x: sx * 0.26 * s, w: 0.09 * s, d: 0.6 * s, h: cradleH, color: DARK });
    for (const k of [1, -1]) {
      slat(m, {
        x: sx * 0.315 * s,
        y: cradleH * 0.5,
        w: 0.36 * s,
        h: 0.045 * s,
        color: DARK,
        rz: k * 0.48,
        ry: Math.PI / 2,
      });
    }
  }
  box(m, { y: cradleH, w: 0.66 * s, d: 0.3 * s, h: 0.05 * s, color: WOOD, top: TOPW });
  // 통 — 축을 x 로 눕힌다
  const bm = mesh();
  barrelBody(bm, { y: -len / 2, h: len, r, bulge: 0.05 * s, hoops: 2, lid: true });
  merge(m, bm, { rz: Math.PI / 2, ty: cradleH + 0.05 * s + r });
  // 마구리 쪽 꼭지
  cylinder(m, { x: 0.4 * s, y: cradleH + 0.09 * s + r * 0.4, r: 0.026 * s, h: 0.12 * s, seg: 5, color: IRON_D, capColor: IRON, ry: Math.PI / 2 });
  return finish(m, { radius: 0.42 * s, kind: 'barrel' });
}

// ══ Sheet 4 · 2행 : 자루 ══════════════════════
/** 목을 묶은 천 자루 — 아래가 퍼진 배, 조인 목, 끈, 너풀거리는 윗부분 */
export function sack(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = opt.scale || rand(rng, 0.86, 1.14);
  const tall = opt.tall != null ? opt.tall : rng() < 0.4;
  const bodyH = (tall ? 0.5 : 0.4) * s;
  const rMax = (tall ? 0.2 : 0.25) * s;
  // 배 — 아래가 넓고 어깨에서 급히 좁아진다
  tube(m, { r: rMax * 0.82, r2: rMax, h: bodyH * 0.35, seg: 8, color: SACK });
  tube(m, { y: bodyH * 0.35, r: rMax, r2: rMax * 0.88, h: bodyH * 0.35, seg: 8, color: SACK });
  tube(m, { y: bodyH * 0.7, r: rMax * 0.88, r2: rMax * 0.34, h: bodyH * 0.42, seg: 8, color: SACK });
  // 목 + 끈
  const neckY = bodyH * 1.12;
  cylinder(m, { y: neckY, r: rMax * 0.32, r2: rMax * 0.28, h: 0.07 * s, seg: 6, color: SACK, cap: false });
  tube(m, { y: neckY + 0.01 * s, r: rMax * 0.37, h: 0.05 * s, seg: 6, color: SACK_D });
  // 너풀거리는 윗동 — 위로 갈수록 벌어진다
  cylinder(m, { y: neckY + 0.07 * s, r: rMax * 0.28, r2: rMax * 0.6, h: 0.13 * s, seg: 6, color: SACK, cap: false });
  // 밖으로 늘어져 접힌 천 끝 3갈래 (위로 솟지 않고 아래로 처져야 자루로 읽힌다)
  const topY = neckY + 0.2 * s;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const a2 = a + 1.5;
    const ri = rMax * 0.34;
    const ro = rMax * 0.74;
    tri(
      m,
      [Math.cos(a) * ri, topY, Math.sin(a) * ri],
      [Math.cos(a2) * ri, topY, Math.sin(a2) * ri],
      [Math.cos((a + a2) / 2) * ro, topY - 0.075 * s, Math.sin((a + a2) / 2) * ro],
      SACK,
      { double: true }
    );
  }
  return finish(m, { radius: rMax * 1.2, kind: 'sack' });
}

/** 입을 벌린 자루 — 안에 든 것(감자)이 보인다 */
export function sackOpen(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = opt.scale || rand(rng, 0.9, 1.1);
  const rMax = 0.25 * s;
  tube(m, { r: rMax * 0.8, r2: rMax, h: 0.16 * s, seg: 8, color: SACK });
  tube(m, { y: 0.16 * s, r: rMax, r2: rMax * 0.92, h: 0.16 * s, seg: 8, color: SACK });
  // 말아 접힌 주둥이
  tube(m, { y: 0.32 * s, r: rMax * 0.92, r2: rMax * 0.86, h: 0.08 * s, seg: 8, color: SACK_D });
  tube(m, { y: 0.4 * s, r: rMax * 0.86, r2: rMax * 0.95, h: 0.06 * s, seg: 8, color: SACK });
  // 내용물 — 봉긋한 감자 덩어리
  blobSphere(m, {
    y: 0.44 * s,
    rx: rMax * 0.8,
    ry: 0.1 * s,
    rz: rMax * 0.8,
    seg: 7,
    rings: 2,
    color: '#cbab74',
    wob: 0.16,
    bumps: 3,
    bumpAmt: 0.22,
    seed: seed + 5,
  });
  return finish(m, { radius: rMax * 1.2, kind: 'sack' });
}

// ══ Sheet 4 · 4행 : 양동이 ════════════════════
/** 나무 양동이 — 위로 벌어진 나무살, 위아래 쇠테, 반원 손잡이 */
export function bucket(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = opt.scale || 1;
  const rb = 0.15 * s;
  const rt = 0.2 * s;
  const h = 0.32 * s;
  staved(m, {
    h,
    rAt: (t) => rb + (rt - rb) * t,
    seg: 9,
    sections: 3,
    color: WOOD,
    hoops: [0.08, 0.88],
    hoopW: 0.045 * s,
    proud: 0.016 * s,
  });
  // 내용물(물)
  tube(m, { y: h - 0.05 * s, r: rt * 0.94, h: 0.02 * s, seg: 9, color: '#a8cfd8', cap: true, capColor: '#9cc9d4' });
  // 반원 손잡이
  ribbonArc(m, { y: h - 0.02 * s, r: rt * 0.98, ry2: rt * 1.25, w: 0.03 * s, seg: 5, color: IRON_D });
  return finish(m, { radius: rt * 1.15, kind: 'bucket' });
}

/** 넓적한 나무 대야(통 모양 양동이) — 손잡이 없이 옆에 잡이만 */
export function tubBucket(seed = 1, opt = {}) {
  const m = mesh();
  const s = opt.scale || 1;
  const rb = 0.2 * s;
  const rt = 0.26 * s;
  const h = 0.26 * s;
  staved(m, {
    h,
    rAt: (t) => rb + (rt - rb) * t,
    seg: 10,
    sections: 3,
    color: WOOD,
    hoops: [0.09, 0.85],
    hoopW: 0.042 * s,
    proud: 0.016 * s,
  });
  tube(m, { y: h - 0.045 * s, r: rt * 0.95, h: 0.02 * s, seg: 10, color: '#a8cfd8', cap: true, capColor: '#9cc9d4' });
  // 옆으로 튀어나온 손잡이 봉
  const grip = mesh();
  cylinder(grip, { r: 0.02 * s, h: 0.11 * s, seg: 4, color: DARK, capColor: TOPW });
  merge(m, grip, { rx: -Math.PI / 2, ty: h * 0.62, tz: rt * 0.72 });
  return finish(m, { radius: rt * 1.1, kind: 'bucket' });
}

// ══ Sheet 4 · 2행 : 이정표 ════════════════════
/** 널빤지 두 장짜리 표지판 — 기둥 머리가 판 위로 조금 솟는다 */
export function signPlank(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = opt.h || rand(rng, 1.05, 1.2);
  box(m, { w: 0.1, d: 0.08, h: h + 0.1, color: DARK, top: TOPW });
  for (let i = 0; i < 2; i++) {
    const y = h - 0.22 - i * 0.2;
    box(m, { y, w: 0.72, d: 0.05, h: 0.18, color: WOOD, top: TOPW });
    slat(m, { y: y + 0.09, z: 0.027, w: 0.6, h: 0.02, color: DARK });
    slat(m, { y: y + 0.09, z: 0.027, w: 0.028, h: 0.028, color: IRON_D }); // 못
  }
  return finish(m, { radius: 0.38, kind: 'sign' });
}

/** 화살표 널빤지 — 길이 len, 두께 t, +x 방향을 가리킨다 */
function arrowPlank(len, hgt, t, color) {
  const b = mesh();
  const tip = hgt * 0.62;
  box(b, { x: -tip / 2, w: len - tip, d: t, h: hgt, color, top: TOPW });
  const x0 = len / 2 - tip;
  const ht = t / 2;
  // 삼각 촉 — 앞뒤 삼각 + 위아래 빗면
  tri(b, [x0, 0, ht], [len / 2, hgt / 2, ht], [x0, hgt, ht], color);
  tri(b, [x0, hgt, -ht], [len / 2, hgt / 2, -ht], [x0, 0, -ht], color);
  quad(b, [x0, 0, ht], [x0, 0, -ht], [len / 2, hgt / 2, -ht], [len / 2, hgt / 2, ht], color);
  quad(b, [x0, hgt, -ht], [x0, hgt, ht], [len / 2, hgt / 2, ht], [len / 2, hgt / 2, -ht], color);
  return b;
}

/** 양쪽으로 갈라지는 두 갈래 이정표 */
export function signArrows(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = opt.h || rand(rng, 1.2, 1.35);
  box(m, { w: 0.1, d: 0.09, h: h + 0.09, color: DARK, top: TOPW });
  const upper = arrowPlank(0.78, 0.19, 0.05, WOOD);
  merge(m, upper, { tx: 0.3, ty: h - 0.28, ry: rand(rng, -0.25, 0.25) });
  const lower = arrowPlank(0.78, 0.19, 0.05, WOOD);
  merge(m, lower, { tx: -0.3, ty: h - 0.6, ry: Math.PI + rand(rng, -0.25, 0.25) });
  return finish(m, { radius: 0.45, kind: 'sign' });
}

// ══ Sheet 4 · 2행 : 등불 ══════════════════════
/** 등불 머리 — 피라미드 갓, 유리통, 네 모서리 기둥, 아래 뾰족한 끝 */
function lanternHead(s = 1, glass = P.lanternGlow) {
  const b = mesh();
  const w = 0.15 * s;
  tube(b, { y: 0.2 * s, r: 0.115 * s, r2: 0.012 * s, h: 0.1 * s, seg: 4, color: IRON_D, ry: Math.PI / 4 });
  box(b, { y: 0.06 * s, w, d: w, h: 0.14 * s, color: glass, top: IRON_D });
  box(b, { y: 0.02 * s, w: w * 1.12, d: w * 1.12, h: 0.045 * s, color: IRON_D });
  // 아래로 뾰족한 끝
  tube(b, { y: -0.06 * s, r: 0.012 * s, r2: 0.075 * s, h: 0.08 * s, seg: 4, color: IRON_D, ry: Math.PI / 4 });
  // 모서리 기둥 4개(면에 붙인 얇은 판이라 선으로 보인다)
  for (let i = 0; i < 4; i++) {
    slat(b, { y: 0.13 * s, z: w / 2 + 0.008, w: 0.022 * s, h: 0.14 * s, color: IRON_D, ry: (i / 4) * Math.PI * 2 });
  }
  // 고리
  ribbonArc(b, { y: 0.3 * s, r: 0.035 * s, w: 0.02 * s, seg: 4, color: IRON_D });
  return b;
}

/** 지팡이 모양 기둥에 매단 등불 (2행 맨 왼쪽) */
export function hangingLantern(seed = 1, opt = {}) {
  const m = mesh();
  const s = opt.scale || 1;
  const H = 1.62 * s;
  tube(m, { r: 0.05 * s, r2: 0.04 * s, h: H, seg: 6, color: DARK });
  // 지팡이처럼 크게 말린 갈고리 — 원호 중심을 기둥 머리 옆에 두고 3/4 바퀴 감는다
  const Rc = 0.23 * s;
  const arcN = 6;
  let px = 0;
  let py = H;
  for (let i = 1; i <= arcN; i++) {
    const th = Math.PI + (-0.45 - Math.PI) * (i / arcN);
    const nx = Rc + Math.cos(th) * Rc;
    const ny = H + Math.sin(th) * Rc;
    const len = Math.hypot(nx - px, ny - py);
    const segm = mesh();
    tube(segm, { r: 0.032 * s, h: len + 0.012, seg: 4, color: DARK });
    merge(m, segm, { rz: Math.atan2(-(nx - px), ny - py), tx: px, ty: py });
    px = nx;
    py = ny;
  }
  // 사슬 — 십자로 세운 얇은 판이라 어느 각도에서나 한 줄로 보인다
  const chainH = 0.15 * s;
  for (const cr of [0, Math.PI / 2]) {
    slat(m, { x: px, y: py - chainH / 2, w: 0.022 * s, h: chainH, color: IRON_D, ry: cr });
  }
  merge(m, lanternHead(1.35 * s), { tx: px, ty: py - chainH - 0.42 * s });
  return finish(m, { radius: 0.32 * s, kind: 'lantern' });
}

/** 기름등 — 받침, 잘록한 대, 배가 부른 기름통, 심지 고리, 둥근 유리구 */
export function oilLamp(seed = 1, opt = {}) {
  const m = mesh();
  const s = opt.scale || 1;
  const BRASS = '#c9a86a';
  // 옆모습 실루엣: 작은 굽 → 가는 대 → 배 부른 기름통 → 버너 목 (맨 위 유리구가 제일 넓다)
  profileTube(m, {
    seg: 7,
    pts: [
      [0, 0.058 * s],
      [0.022 * s, 0.046 * s],
      [0.032 * s, 0.024 * s],
      [0.072 * s, 0.024 * s],
      [0.084 * s, 0.05 * s],
      [0.112 * s, 0.053 * s],
      [0.145 * s, 0.034 * s],
      [0.186 * s, 0.028 * s],
      [0.206 * s, 0.024 * s],
    ],
    color: BRASS,
    soft: true,
  });
  // 심지 조절 고리 — 살짝 굵고 각져서 선이 생긴다
  tube(m, { y: 0.148 * s, r: 0.042 * s, h: 0.022 * s, seg: 7, color: IRON, soft: false });
  // 둥근 유리구
  blobSphere(m, { y: 0.25 * s, rx: 0.052 * s, ry: 0.058 * s, seg: 7, rings: 3, color: P.lanternGlow, wob: 0.02, seed: seed + 2 });
  return finish(m, { radius: 0.09 * s, kind: 'lamp' });
}

// ══ Sheet 4 · 3행 : 우편함 · 새집 ═════════════
/** 깃발 달린 우편함 — 둥근 지붕, 앞문, 기둥과 버팀목 */
export function mailbox(seed = 1, opt = {}) {
  const m = mesh();
  const H = 0.92;
  box(m, { w: 0.1, d: 0.09, h: H, color: DARK });
  // 버팀목
  slat(m, { x: 0.09, y: H * 0.72, w: 0.05, h: 0.34, color: DARK, rz: -0.5 });
  const bodyW = 0.34;
  const bodyD = 0.5;
  box(m, { y: H, w: bodyW, d: bodyD, h: 0.14, color: '#cfd6d8' });
  halfTube(m, { y: H + 0.14, len: bodyD, r: bodyW / 2, seg: 7, color: '#cfd6d8', capColor: '#bcc5c8', ry: Math.PI / 2 });
  // 앞문 + 손잡이
  slat(m, { z: bodyD / 2 + 0.015, y: H + 0.16, w: bodyW * 0.82, h: 0.24, color: '#bcc5c8' });
  slat(m, { z: bodyD / 2 + 0.03, y: H + 0.13, w: 0.09, h: 0.03, color: IRON_D });
  // 깃발
  box(m, { x: bodyW / 2 + 0.02, y: H + 0.14, w: 0.03, d: 0.03, h: 0.3, color: '#c2603a' });
  panel(m, { x: bodyW / 2 + 0.02, y: H + 0.32, z: 0.05, w: 0.14, h: 0.11, color: '#c2603a' });
  return finish(m, { radius: 0.26, kind: 'mailbox' });
}

/** 기둥 위 새집 — 처마 넓은 박공, 둥근 입구, 앉을 막대 */
export function birdhouse(seed = 1, opt = {}) {
  const m = mesh();
  const H = 1.24;
  box(m, { w: 0.12, d: 0.1, h: H, color: DARK });
  slat(m, { x: 0.09, y: H * 0.78, w: 0.055, h: 0.32, color: DARK, rz: -0.5 });
  box(m, { y: H, w: 0.38, d: 0.34, h: 0.42, color: '#e6cb9c' });
  gable(m, { y: H + 0.42, w: 0.38, d: 0.34, h: 0.24, color: DARK, eave: 0.11 });
  // 입구 구멍 + 테두리
  const hole = mesh();
  cylinder(hole, { r: 0.065, h: 0.02, seg: 7, color: '#6b5b45', capColor: '#4a4038' });
  merge(m, hole, { rx: -Math.PI / 2, ty: H + 0.26, tz: 0.175 });
  // 앉을 막대
  const perch = mesh();
  cylinder(perch, { r: 0.016, h: 0.1, seg: 4, color: DARK, capColor: TOPW });
  merge(m, perch, { rx: -Math.PI / 2, ty: H + 0.15, tz: 0.17 });
  return finish(m, { radius: 0.26, kind: 'birdhouse' });
}

// ══ Sheet 4 · 3행 : 가구 ══════════════════════
/** 작업 탁자 — 두꺼운 널 상판, 벌어진 다리 4개, 앞치마 널과 가로 버팀대 */
export function table(seed = 1, opt = {}) {
  const m = mesh();
  const w = opt.w || 1.3;
  const d = opt.d || 0.9;
  const legH = 0.58;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = mesh();
      box(leg, { w: 0.1, d: 0.1, h: legH, color: DARK });
      merge(m, leg, { rz: -sx * 0.06, rx: sz * 0.06, tx: sx * (w / 2 - 0.13), tz: sz * (d / 2 - 0.13) });
    }
  }
  // 앞치마 널 (앞/뒤)
  for (const sz of [-1, 1]) {
    box(m, { z: sz * (d / 2 - 0.1), y: legH - 0.16, w: w - 0.16, d: 0.05, h: 0.1, color: DARK });
  }
  // 가로 버팀대
  box(m, { y: 0.16, w: w - 0.3, d: 0.06, h: 0.055, color: DARK });
  // 상판 + 널 이음매 2줄
  box(m, { y: legH, w, d, h: 0.11, color: WOOD, top: TOPW });
  for (const dz of [-d * 0.18, d * 0.18]) {
    slat(m, { y: legH + 0.112, z: dz, w: w * 0.97, h: 0.04, color: DARK, rx: Math.PI / 2 });
  }
  return finish(m, { radius: 0.66, kind: 'table' });
}

/** 세로살 등받이 의자 — 다리 4개, 앉는 판, 등판(가로널 3장 + 세로살 2개) */
export function chair(seed = 1, opt = {}) {
  const m = mesh();
  const seatY = 0.42;
  const hw = 0.21;
  // 앞다리 2개
  for (const sx of [-1, 1]) {
    const leg = mesh();
    box(leg, { w: 0.07, d: 0.07, h: seatY, color: DARK });
    merge(m, leg, { rz: -sx * 0.05, rx: 0.05, tx: sx * hw, tz: hw });
  }
  // 뒷다리 2개 — 그대로 위로 올라가 등판 기둥이 된다
  for (const sx of [-1, 1]) {
    const leg = mesh();
    box(leg, { w: 0.07, d: 0.07, h: 0.9, color: DARK });
    merge(m, leg, { rz: -sx * 0.03, tx: sx * hw, tz: -hw });
  }
  box(m, { y: seatY, w: 0.5, d: 0.5, h: 0.075, color: WOOD, top: TOPW });
  slat(m, { y: seatY + 0.077, w: 0.46, h: 0.035, color: DARK, rx: Math.PI / 2 });
  // 세로살 2개 (앉는 판 ~ 등판 사이)
  for (const sx of [-1, 1]) {
    box(m, { x: sx * 0.09, z: -hw, y: seatY + 0.075, w: 0.06, d: 0.04, h: 0.16, color: DARK });
  }
  // 등판 가로널 3장
  for (let i = 0; i < 3; i++) {
    box(m, { z: -hw, y: 0.66 + i * 0.09, w: 0.42, d: 0.045, h: 0.075, color: WOOD, top: TOPW });
  }
  return finish(m, { radius: 0.3, kind: 'chair' });
}

/** 작은 걸상 — 벌어진 다리 3개 + 둥근 앉을 판 + 아래 테 */
export function stool(seed = 1, opt = {}) {
  const m = mesh();
  const h = 0.36;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const leg = mesh();
    cylinder(leg, { r: 0.028, h, seg: 4, color: DARK, cap: false });
    merge(m, leg, { rz: 0.12, ry: -a, tx: Math.cos(a) * 0.11, tz: Math.sin(a) * 0.11 });
  }
  cylinder(m, { y: h * 0.36, r: 0.115, h: 0.025, seg: 6, color: DARK, cap: false });
  cylinder(m, { y: h, r: 0.17, r2: 0.165, h: 0.075, seg: 7, color: WOOD, capColor: TOPW });
  return finish(m, { radius: 0.2, kind: 'stool' });
}

/** 통나무 벤치 — 위를 평평하게 켠 반쪽 통나무 + 벌어진 통나무 다리 4개 */
export function logBench(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const len = opt.len || rand(rng, 1.6, 2.0);
  const r = 0.21;
  const legH = 0.32;
  // 반쪽 통나무 (아래가 둥글고 위는 평평)
  halfTube(m, {
    y: legH + r,
    len,
    r,
    seg: 6,
    a0: Math.PI,
    a1: Math.PI * 2,
    color: P.trunk,
    capColor: '#e0bf94',
    lid: true,
    lidColor: TOPW,
  });
  // 앉는 면 널 이음매
  slat(m, { y: legH + r + 0.003, w: len * 0.94, h: 0.05, color: '#c19a6b', rx: Math.PI / 2 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = mesh();
      cylinder(leg, { r: 0.045, h: legH + 0.06, seg: 4, color: P.trunk, cap: false });
      merge(m, leg, { rz: -sx * 0.16, rx: sz * 0.2, tx: sx * (len / 2 - 0.24), tz: sz * 0.09 });
    }
  }
  return finish(m, { radius: len * 0.4, kind: 'bench' });
}

/** 등받이 있는 널빤지 벤치 */
export function plankBench(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const len = opt.len || rand(rng, 1.6, 1.9);
  const seatY = 0.42;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = mesh();
      cylinder(leg, { r: 0.04, h: seatY, seg: 4, color: DARK, cap: false });
      merge(m, leg, { rz: -sx * 0.14, rx: sz * 0.18, tx: sx * (len / 2 - 0.22), tz: sz * 0.13 });
    }
  }
  box(m, { y: seatY, w: len, d: 0.4, h: 0.09, color: WOOD, top: TOPW });
  slat(m, { y: seatY + 0.092, w: len * 0.96, h: 0.04, color: DARK, rx: Math.PI / 2 });
  // 등받이 기둥 2개 + 널 2장
  for (const sx of [-1, 1]) {
    box(m, { x: sx * (len / 2 - 0.2), z: -0.16, y: seatY + 0.09, w: 0.07, d: 0.06, h: 0.42, color: DARK });
  }
  for (let i = 0; i < 2; i++) {
    box(m, { z: -0.16, y: seatY + 0.2 + i * 0.14, w: len - 0.3, d: 0.045, h: 0.1, color: WOOD, top: TOPW });
  }
  return finish(m, { radius: len * 0.4, kind: 'bench' });
}

// ══ Sheet 4 · 4행 : 모닥불 ════════════════════
/** 돌을 둥글게 두른 모닥불 — 돌 8개 + 안쪽으로 모인 장작 + 불꽃 */
export function campfireStones(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const R = 0.32;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(rng, -0.08, 0.08);
    pebble(m, {
      x: Math.cos(a) * R,
      z: Math.sin(a) * R,
      r: rand(rng, 0.11, 0.145),
      h: rand(rng, 0.14, 0.19),
      rng,
      color: i % 2 ? STONE : STONE_D,
    });
  }
  // 안쪽으로 모인 장작 4개
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    merge(m, logMesh(0.42, 0.045, 4, P.trunkDark), {
      rz: Math.PI / 2,
      ry: -a,
      tx: Math.cos(a) * 0.14,
      tz: Math.sin(a) * 0.14,
      ty: 0.05,
    });
  }
  cylinder(m, { y: 0.02, r: 0.16, h: 0.03, seg: 6, color: '#5b5148', capColor: '#4a4038' });
  flameTongues(m, { y: 0.09, h: 0.44, r: 0.12, n: 4, seed: seed + 7 });
  return finish(m, { radius: 0.6, kind: 'campfire' });
}

/** 장작을 원뿔로 세운 모닥불 */
export function campfireLogs(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(rng, -0.15, 0.15);
    merge(m, logMesh(0.46, 0.05, 4, i % 2 ? P.trunk : P.trunkDark), {
      rz: 0.95,
      ry: -a,
      tx: Math.cos(a) * 0.13,
      tz: Math.sin(a) * 0.13,
      ty: 0.175,
    });
  }
  // 바닥에 흩어진 짧은 장작 2개
  for (let i = 0; i < 2; i++) {
    merge(m, logMesh(0.3, 0.04, 4, P.trunkDark), {
      rz: Math.PI / 2,
      ry: rand(rng, 0, 3),
      tx: rand(rng, -0.3, 0.3),
      tz: rand(rng, 0.24, 0.36),
      ty: 0.04,
    });
  }
  flameTongues(m, { y: 0.18, h: 0.34, r: 0.1, n: 4, seed: seed + 9 });
  return finish(m, { radius: 0.42, kind: 'campfire' });
}

/** 삼각대 걸이 모닥불 — 엇갈린 막대 두 쌍 + 가로대 + 매달린 냄비 */
export function cookingFire(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const H = 1.0;
  const span = 0.62;
  // 양쪽 X 다리 — 막대 2개가 위(가로대 자리)에서 교차한다
  for (const sx of [-1, 1]) {
    for (const k of [-1, 1]) {
      const stick = mesh();
      cylinder(stick, { r: 0.028, h: H + 0.14, seg: 4, color: P.trunkDark, cap: false });
      merge(m, stick, { rz: -sx * 0.05, rx: k * 0.2, tx: sx * span, tz: -k * 0.222 });
    }
  }
  // 가로대
  const bar = mesh();
  cylinder(bar, { y: -(span * 2 + 0.3) / 2, r: 0.028, h: span * 2 + 0.3, seg: 4, color: P.trunkDark, capColor: '#e0bf94' });
  merge(m, bar, { rz: Math.PI / 2, ty: H });
  // 냄비 — 갈고리 + 손잡이 + 몸통
  slat(m, { y: H - 0.09, w: 0.02, h: 0.18, color: IRON_D });
  ribbonArc(m, { y: H - 0.18, r: 0.11, ry2: 0.09, w: 0.022, seg: 4, color: IRON_D });
  tube(m, { y: H - 0.36, r: 0.1, r2: 0.13, h: 0.18, seg: 8, color: '#6b6459', cap: true, capColor: '#3f3a33' });
  tube(m, { y: H - 0.2, r: 0.14, h: 0.04, seg: 8, color: '#4a453d' });
  // 아래 장작불
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    merge(m, logMesh(0.36, 0.04, 4, P.trunkDark), {
      rz: Math.PI / 2,
      ry: -a,
      tx: Math.cos(a) * 0.09,
      tz: Math.sin(a) * 0.09,
      ty: 0.04,
    });
  }
  flameTongues(m, { y: 0.08, h: 0.3, r: 0.1, n: 3, seed: seed + 11 });
  return finish(m, { radius: 0.7, kind: 'campfire' });
}

// ══ Sheet 4 · 4행 : 연장 ══════════════════════
/** 삽 — D 자 손잡이 + 긴 자루 + 뾰족한 날 */
export function toolShovel(seed = 1, opt = {}) {
  const m = mesh();
  const s = mesh();
  const H = 0.86;
  // 날 — 삼각 촉 + 사각 몸 + 목
  tri(s, [-0.085, 0.11, 0.018], [0.085, 0.11, 0.018], [0, 0, 0.018], IRON, { double: true });
  quad(s, [-0.085, 0.11, -0.018], [-0.085, 0.11, 0.018], [0, 0, 0.018], [0, 0, -0.018], IRON);
  quad(s, [0.085, 0.11, 0.018], [0.085, 0.11, -0.018], [0, 0, -0.018], [0, 0, 0.018], IRON);
  box(s, { y: 0.11, w: 0.17, d: 0.036, h: 0.15, color: IRON, top: IRON_D });
  cylinder(s, { y: 0.26, r: 0.034, r2: 0.026, h: 0.07, seg: 5, color: IRON, cap: false });
  cylinder(s, { y: 0.3, r: 0.026, h: H, seg: 5, color: WOOD, cap: false });
  // D 자 손잡이
  box(s, { y: 0.3 + H, w: 0.03, d: 0.03, h: 0.1, color: WOOD });
  ribbonArc(s, { y: 0.3 + H + 0.07, r: 0.06, ry2: 0.11, w: 0.028, seg: 4, color: WOOD });
  merge(m, s, { rz: 0.09, ty: 0.012 });
  return finish(m, { radius: 0.16, kind: 'tool' });
}

/** 도끼 — 자루 + 쐐기 날 */
export function toolAxe(seed = 1, opt = {}) {
  const m = mesh();
  const s = mesh();
  const H = 0.9;
  cylinder(s, { r: 0.026, r2: 0.022, h: H, seg: 5, color: WOOD, capColor: TOPW });
  // 자루 끝 마개
  cylinder(s, { r: 0.032, h: 0.05, seg: 5, color: DARK, cap: false });
  // 도끼머리 — 눈(자루 구멍) + 날
  box(s, { y: H - 0.16, w: 0.06, d: 0.07, h: 0.17, color: IRON_D });
  const blade = mesh();
  quad(blade, [0, 0, 0.035], [0.19, 0.05, 0.02], [0.19, 0.05, -0.02], [0, 0, -0.035], IRON);
  quad(blade, [0, 0.15, -0.035], [0.19, 0.11, -0.02], [0.19, 0.11, 0.02], [0, 0.15, 0.035], IRON);
  quad(blade, [0, 0, 0.035], [0, 0.15, 0.035], [0.19, 0.11, 0.02], [0.19, 0.05, 0.02], IRON);
  quad(blade, [0, 0.15, -0.035], [0, 0, -0.035], [0.19, 0.05, -0.02], [0.19, 0.11, -0.02], IRON);
  quad(blade, [0.19, 0.05, 0.02], [0.19, 0.11, 0.02], [0.19, 0.11, -0.02], [0.19, 0.05, -0.02], '#eae6dc');
  merge(s, blade, { tx: 0.028, ty: H - 0.16 });
  merge(m, s, { rz: 0.08 });
  return finish(m, { radius: 0.16, kind: 'tool' });
}

/** 곡괭이 — 자루 + 좌우로 휜 뾰족한 머리 */
export function toolPickaxe(seed = 1, opt = {}) {
  const m = mesh();
  const s = mesh();
  const H = 0.92;
  cylinder(s, { r: 0.026, r2: 0.022, h: H, seg: 5, color: WOOD, capColor: TOPW });
  box(s, { y: H - 0.08, w: 0.055, d: 0.06, h: 0.11, color: IRON_D });
  // 휜 머리 — 짧은 마디 3개씩 좌우로
  for (const sx of [-1, 1]) {
    let px = 0.02 * sx;
    let py = H - 0.02;
    for (let i = 1; i <= 3; i++) {
      const t = i / 3;
      const nx = sx * (0.02 + t * 0.3);
      const ny = H - 0.02 + Math.sin(t * 1.35) * 0.09 - t * t * 0.14;
      const len = Math.hypot(nx - px, ny - py);
      const seg = mesh();
      cylinder(seg, { r: 0.024 - i * 0.005, h: len + 0.008, seg: 4, color: IRON, cap: i === 3, capColor: '#eae6dc' });
      merge(s, seg, { rz: Math.atan2(-(nx - px), ny - py), tx: px, ty: py });
      px = nx;
      py = ny;
    }
  }
  // 쐐기 고정 띠
  slat(s, { y: H - 0.02, w: 0.075, h: 0.02, color: IRON_D });
  merge(m, s, { rz: 0.07 });
  return finish(m, { radius: 0.18, kind: 'tool' });
}

// ══ Sheet 4 · 5행 : 상자 · 바구니 ═════════════
/** 보물 상자 — 둥근 뚜껑, 몸통과 뚜껑을 감는 쇠띠 2줄, 자물쇠판 */
export function chest(seed = 1, opt = {}) {
  const m = mesh();
  const W = 0.78;
  const D = 0.5;
  const bodyH = 0.3;
  const r = D / 2;
  box(m, { w: W, d: D, h: bodyH, color: WOOD });
  // 몸통 널 이음매
  slat(m, { z: D / 2 + 0.015, y: bodyH * 0.55, w: W * 0.96, h: 0.03, color: DARK });
  box(m, { y: bodyH - 0.05, w: W + 0.03, d: D + 0.03, h: 0.05, color: DARK });
  // 둥근 뚜껑
  halfTube(m, { y: bodyH, len: W, r, seg: 7, color: WOOD, capColor: '#cba473', caps: true });
  // 쇠띠 2줄 — 앞면 세로 + 뚜껑을 넘어가는 호
  for (const sx of [-0.24, 0.24]) {
    slat(m, { x: sx, z: D / 2 + 0.02, y: bodyH * 0.5, w: 0.07, h: bodyH, color: IRON_D });
    ribbonArc(m, { x: sx, y: bodyH, r: r + 0.012, w: 0.07, seg: 6, color: IRON_D, ry: Math.PI / 2 });
  }
  // 자물쇠판 + 열쇠구멍
  box(m, { z: D / 2 + 0.005, y: bodyH - 0.11, w: 0.14, d: 0.03, h: 0.16, color: '#d9b25e' });
  slat(m, { z: D / 2 + 0.04, y: bodyH - 0.04, w: 0.035, h: 0.05, color: IRON_D });
  // 발
  for (const sx of [-1, 1]) box(m, { x: sx * (W / 2 - 0.06), z: 0, w: 0.09, d: D + 0.02, h: 0.045, color: IRON_D });
  return finish(m, { radius: 0.45, kind: 'chest' });
}

/** 뚜껑을 젖힌 보물 상자 */
export function chestOpen(seed = 1, opt = {}) {
  const m = mesh();
  const W = 0.78;
  const D = 0.5;
  const bodyH = 0.3;
  const r = D / 2;
  const t = 0.05;
  // 위가 트인 몸통 — 얇은 벽 4장이라 안쪽 면이 그대로 보인다
  box(m, { z: D / 2 - t / 2, w: W, d: t, h: bodyH, color: WOOD });
  box(m, { z: -D / 2 + t / 2, w: W, d: t, h: bodyH, color: WOOD });
  for (const sx of [-1, 1]) box(m, { x: sx * (W / 2 - t / 2), w: t, d: D - t * 2, h: bodyH, color: WOOD });
  quad(
    m,
    [-W / 2 + t, 0.04, D / 2 - t],
    [W / 2 - t, 0.04, D / 2 - t],
    [W / 2 - t, 0.04, -D / 2 + t],
    [-W / 2 + t, 0.04, -D / 2 + t],
    '#8d6b45',
    { double: true }
  );
  slat(m, { z: D / 2 + 0.015, y: bodyH * 0.5, w: W * 0.96, h: 0.03, color: DARK });
  for (const sx of [-0.24, 0.24]) slat(m, { x: sx, z: D / 2 + 0.02, y: bodyH * 0.5, w: 0.07, h: bodyH, color: IRON_D });
  // 젖힌 뚜껑 — 뒤쪽 모서리를 축으로 돌린다(안쪽이 보이므로 양면)
  const lid = mesh();
  halfTube(lid, { z: r, len: W, r, seg: 7, color: WOOD, capColor: '#cba473', double: true });
  for (const sx of [-0.24, 0.24]) ribbonArc(lid, { x: sx, z: r, r: r + 0.012, w: 0.07, seg: 6, color: IRON_D, ry: Math.PI / 2 });
  merge(m, lid, { rx: -1.95, ty: bodyH, tz: -D / 2 });
  // 안에 든 것
  for (let i = 0; i < 3; i++) {
    tube(m, {
      x: -0.16 + i * 0.16,
      z: (i % 2) * 0.09 - 0.045,
      y: 0.05,
      r: 0.07,
      h: 0.045,
      seg: 6,
      color: '#d9b25e',
      cap: true,
      capColor: '#efd489',
    });
  }
  box(m, { z: D / 2 + 0.005, y: bodyH - 0.13, w: 0.14, d: 0.03, h: 0.13, color: '#d9b25e' });
  return finish(m, { radius: 0.45, kind: 'chest' });
}

/** 손잡이 달린 둥근 바구니 */
export function basket(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = opt.scale || rand(rng, 0.92, 1.08);
  const rt = 0.26 * s;
  // 둥근 바닥 + 위로 벌어진 몸통(면마다 선 = 엮은 결)
  tube(m, { r: 0.09 * s, r2: 0.19 * s, h: 0.09 * s, seg: 9, color: '#d3ab77', soft: false });
  tube(m, { y: 0.09 * s, r: 0.19 * s, r2: rt, h: 0.2 * s, seg: 9, color: '#d8b482', soft: false });
  // 테두리(굵게 엮은 테)
  tube(m, { y: 0.255 * s, r: rt + 0.014 * s, r2: rt + 0.008 * s, h: 0.05 * s, seg: 9, color: '#b8945f' });
  // 담긴 것
  tube(m, { y: 0.25 * s, r: rt * 0.9, h: 0.02 * s, seg: 9, color: '#c99257', cap: true, capColor: '#d8a869' });
  // 아치 손잡이
  ribbonArc(m, { y: 0.28 * s, r: rt * 0.92, ry2: rt * 1.15, w: 0.04 * s, seg: 6, color: '#b8945f' });
  return finish(m, { radius: rt * 1.15, kind: 'basket' });
}

/** 넓적한 과일 바구니 — 얕고 넓은 대야 + 높은 손잡이 */
export function basketWide(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = opt.scale || 1;
  const rt = 0.34 * s;
  tube(m, { r: 0.14 * s, r2: 0.26 * s, h: 0.08 * s, seg: 10, color: '#d3ab77', soft: false });
  tube(m, { y: 0.08 * s, r: 0.26 * s, r2: rt, h: 0.13 * s, seg: 10, color: '#d8b482', soft: false });
  tube(m, { y: 0.185 * s, r: rt + 0.015 * s, r2: rt + 0.008 * s, h: 0.045 * s, seg: 10, color: '#b8945f' });
  tube(m, { y: 0.18 * s, r: rt * 0.92, h: 0.02 * s, seg: 10, color: '#c99257', cap: true, capColor: '#d8a869' });
  // 과일 2알
  for (let i = 0; i < 2; i++) {
    blobSphere(m, {
      x: (i - 0.5) * 0.24 * s,
      z: rand(rng, -0.08, 0.08) * s,
      y: 0.24 * s,
      rx: 0.09 * s,
      ry: 0.08 * s,
      seg: 6,
      rings: 3,
      color: i ? '#d76a6a' : '#e0b45c',
      wob: 0.06,
      seed: seed + i,
    });
  }
  ribbonArc(m, { y: 0.21 * s, r: rt * 0.7, ry2: rt * 1.0, w: 0.045 * s, seg: 6, color: '#b8945f' });
  return finish(m, { radius: rt * 1.1, kind: 'basket' });
}

// ══ Sheet 4 · 6행 : 항아리 ════════════════════
/** 항아리·꽃병 — 시트의 네 가지 형태(넓은 단지 / 뚜껑 단지 / 긴 병 / 큰 독) */
export function potVase(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const shape = opt.shape != null ? opt.shape : randInt(rng, 0, 3);
  const s = opt.scale || rand(rng, 0.9, 1.15);
  const seg = 9;
  if (shape === 0) {
    // 넓은 단지 — 배가 부르고 목이 짧다
    tube(m, { r: 0.13 * s, r2: 0.2 * s, h: 0.2 * s, seg, color: CERAMIC });
    tube(m, { y: 0.2 * s, r: 0.2 * s, r2: 0.15 * s, h: 0.22 * s, seg, color: CERAMIC });
    tube(m, { y: 0.42 * s, r: 0.15 * s, r2: 0.15 * s, h: 0.04 * s, seg, color: CERAMIC });
    tube(m, { y: 0.46 * s, r: 0.19 * s, r2: 0.17 * s, h: 0.055 * s, seg, color: '#cbb492', cap: true, capColor: '#8f7f66' });
  } else if (shape === 1) {
    // 뚜껑과 귀 달린 작은 단지
    tube(m, { r: 0.11 * s, r2: 0.16 * s, h: 0.14 * s, seg, color: CERAMIC });
    tube(m, { y: 0.14 * s, r: 0.16 * s, r2: 0.13 * s, h: 0.12 * s, seg, color: CERAMIC });
    tube(m, { y: 0.26 * s, r: 0.15 * s, r2: 0.14 * s, h: 0.04 * s, seg, color: '#cbb492' });
    tube(m, { y: 0.3 * s, r: 0.13 * s, r2: 0.1 * s, h: 0.035 * s, seg, color: '#cbb492', cap: true, capColor: '#b7a181' });
    tube(m, { y: 0.335 * s, r: 0.022 * s, h: 0.045 * s, seg: 5, color: '#cbb492', cap: true, capColor: '#b7a181' });
    for (const sx of [-1, 1]) ribbonArc(m, { x: sx * 0.155 * s, y: 0.2 * s, r: 0.055 * s, w: 0.03 * s, seg: 4, color: CERAMIC, ry: Math.PI / 2 });
  } else if (shape === 2) {
    // 긴 병 — 어깨가 좁고 목이 길다
    tube(m, { r: 0.1 * s, r2: 0.17 * s, h: 0.24 * s, seg, color: CERAMIC });
    tube(m, { y: 0.24 * s, r: 0.17 * s, r2: 0.1 * s, h: 0.26 * s, seg, color: CERAMIC });
    tube(m, { y: 0.5 * s, r: 0.1 * s, r2: 0.095 * s, h: 0.1 * s, seg, color: CERAMIC });
    tube(m, { y: 0.6 * s, r: 0.13 * s, r2: 0.12 * s, h: 0.045 * s, seg, color: '#cbb492', cap: true, capColor: '#8f7f66' });
  } else {
    // 큰 독 — 아래가 좁고 어깨가 넓다
    tube(m, { r: 0.13 * s, r2: 0.24 * s, h: 0.26 * s, seg, color: CERAMIC });
    tube(m, { y: 0.26 * s, r: 0.24 * s, r2: 0.17 * s, h: 0.24 * s, seg, color: CERAMIC });
    tube(m, { y: 0.5 * s, r: 0.17 * s, h: 0.04 * s, seg, color: CERAMIC });
    tube(m, { y: 0.54 * s, r: 0.22 * s, r2: 0.2 * s, h: 0.06 * s, seg, color: '#cbb492', cap: true, capColor: '#8f7f66' });
  }
  return finish(m, { radius: 0.26 * s, kind: 'pot' });
}

// ══ Sheet 4 · 6행 : 수레 ══════════════════════
/** 외바퀴 수레 — 기울인 판 짐칸, 긴 손잡이 2개, 앞 살바퀴, 뒷다리 2개 */
export function wheelbarrow(seed = 1, opt = {}) {
  const m = mesh();
  const wr = 0.2;
  // 짐칸 — 바닥 + 좌우 옆판 + 앞판
  const tray = mesh();
  box(tray, { w: 0.56, d: 0.72, h: 0.06, color: WOOD, top: TOPW });
  for (const sx of [-1, 1]) box(tray, { x: sx * 0.28, y: 0.05, w: 0.05, d: 0.72, h: 0.2, color: WOOD });
  box(tray, { z: -0.34, y: 0.05, w: 0.56, d: 0.05, h: 0.2, color: WOOD });
  slat(tray, { z: 0, y: 0.03, w: 0.5, h: 0.045, color: DARK, rx: Math.PI / 2 });
  merge(m, tray, { rx: -0.1, ty: 0.36, tz: 0.02 });
  // 손잡이 겸 프레임 2개 (앞바퀴 축에서 뒤로 길게)
  for (const sx of [-1, 1]) {
    const bar = mesh();
    box(bar, { w: 0.055, d: 0.055, h: 1.24, color: DARK, top: TOPW });
    merge(m, bar, { rx: -1.44, tx: sx * 0.26, ty: 0.24, tz: 0.5 });
  }
  // 뒷다리 2개
  for (const sx of [-1, 1]) {
    const leg = mesh();
    box(leg, { w: 0.05, d: 0.05, h: 0.32, color: DARK });
    merge(m, leg, { rx: -0.14, tx: sx * 0.24, tz: -0.28 });
  }
  merge(m, wheelMesh({ r: wr, t: 0.07, spokes: 6, seg: 9 }), { ty: wr, tz: 0.5 });
  return finish(m, { radius: 0.5, kind: 'wheelbarrow' });
}

/** 두 바퀴 손수레 — 널판 짐칸, 모서리 기둥 4개, 큰 살바퀴 2개, 끌채 2개 */
export function handCart(seed = 1, opt = {}) {
  const m = mesh();
  const W = 0.78;
  const D = 1.16;
  const bedY = 0.44;
  const wr = 0.36;
  box(m, { y: bedY, w: W, d: D, h: 0.08, color: WOOD, top: TOPW });
  // 옆판 — 살짝 벌어지게
  for (const sx of [-1, 1]) {
    const wall = mesh();
    box(wall, { w: 0.05, d: D, h: 0.34, color: WOOD });
    merge(m, wall, { rz: sx * 0.1, tx: sx * W * 0.5, ty: bedY + 0.08 });
    slat(m, { x: sx * (W * 0.5 + 0.06), y: bedY + 0.24, w: D * 0.95, h: 0.04, color: DARK, ry: Math.PI / 2 });
  }

  for (const sz of [-1, 1]) {
    const wall = mesh();
    box(wall, { w: W, d: 0.05, h: 0.34, color: WOOD });
    merge(m, wall, { rx: -sz * 0.1, tz: sz * D * 0.5, ty: bedY + 0.08 });
  }
  // 모서리 기둥 4개 (짐칸 위로 솟는다)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(m, { x: sx * (W / 2 + 0.02), z: sz * (D / 2 - 0.05), y: bedY, w: 0.06, d: 0.06, h: 0.5, color: DARK });
    }
  }
  for (const sx of [-1, 1]) {
    merge(m, wheelMesh({ r: wr, t: 0.07, spokes: 6, seg: 8 }), { tx: sx * (W / 2 + 0.09), ty: wr, tz: -0.05 });
  }
  // 끌채 2개 — 앞으로 뻗어 땅에 닿는다
  for (const sx of [-1, 1]) {
    const shaft = mesh();
    box(shaft, { w: 0.05, d: 0.05, h: 0.7, color: DARK, top: TOPW });
    merge(m, shaft, { rx: 2.05, tx: sx * (W / 2 - 0.06), ty: bedY, tz: D / 2 - 0.02 });
  }
  return finish(m, { radius: 0.75, kind: 'cart' });
}

/** 포장마차 — 널판 짐칸 + 아치 살대 5개에 씌운 천 + 앞뒤 살바퀴 + 끌채 */
export function coveredWagon(seed = 1, opt = {}) {
  const m = mesh();
  const W = 0.96;
  const D = 1.9;
  const bedY = 0.5;
  const R = 0.62;
  box(m, { y: bedY, w: W, d: D, h: 0.34, color: WOOD, top: '#a98b62' });
  for (const sx of [-1, 1]) {
    slat(m, { x: sx * (W / 2 + 0.015), y: bedY + 0.1, w: D * 0.96, h: 0.035, color: DARK, ry: Math.PI / 2 });
    slat(m, { x: sx * (W / 2 + 0.015), y: bedY + 0.24, w: D * 0.96, h: 0.035, color: DARK, ry: Math.PI / 2 });
  }
  // 천막 — 마디마다 살짝 배가 나온 반원 통(축 = z)
  const canopyY = bedY + 0.34;
  const sects = 6;
  const cv = mesh();
  const seg = 7;
  const rings = [];
  for (let i = 0; i <= sects; i++) {
    const t = i / sects;
    const bulge = 1 + Math.sin(t * Math.PI * sects) * 0.0;
    const taper = 1 - Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.1;
    const row = [];
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI;
      row.push([Math.cos(a) * R * 0.86 * taper * bulge, Math.sin(a) * R * taper * bulge, -D / 2 + D * t]);
    }
    rings.push(row);
  }
  for (let i = 0; i < sects; i++) {
    for (let k = 0; k < seg; k++) {
      quad(cv, rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k], CLOTH, { soft: true });
    }
  }
  // 앞뒤 마구리 천 (뒤 = -z, 앞 = +z)
  poly(cv, rings[0].slice().reverse(), '#e6d5b6');
  poly(cv, rings[sects], CLOTH);
  merge(m, cv, { ty: canopyY });
  // 살대 5개 — 천 위로 도드라진 띠
  for (let i = 0; i < 5; i++) {
    const t = 0.08 + (i / 4) * 0.84;
    const taper = 1 - Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.1;
    ribbonArc(m, {
      y: canopyY,
      z: -D / 2 + D * t,
      r: R * 0.86 * taper + 0.022,
      ry2: R * taper + 0.022,
      w: 0.075,
      seg: 7,
      color: '#cdb48c',
    });
  }
  // 뒤쪽 나무 문틀
  box(m, { z: -D / 2 - 0.02, y: canopyY, w: 0.07, d: 0.06, h: R * 0.6, color: DARK });
  box(m, { z: -D / 2 - 0.02, y: canopyY + R * 0.6, w: W * 0.66, d: 0.06, h: 0.07, color: DARK });
  // 바퀴 — 뒤가 크고 앞이 작다
  for (const sx of [-1, 1]) {
    merge(m, wheelMesh({ r: 0.38, t: 0.08, spokes: 6, seg: 9 }), { tx: sx * (W / 2 + 0.1), ty: 0.38, tz: -D * 0.28 });
    merge(m, wheelMesh({ r: 0.27, t: 0.07, spokes: 6, seg: 8 }), { tx: sx * (W / 2 + 0.1), ty: 0.27, tz: D * 0.3 });
  }
  // 끌채
  const shaft = mesh();
  box(shaft, { w: 0.07, d: 0.07, h: 0.95, color: DARK, top: TOPW });
  merge(m, shaft, { rx: 1.72, ty: 0.42, tz: D / 2 });
  return finish(m, { radius: 1.0, kind: 'wagon' });
}

// ══ Sheet 4 · 6행 : 장터 좌판 · 간판 ══════════
/** 장터 좌판 — 판매대, 기둥 4개, 물결 앞자락 차양, 앞 가로대에 매단 물건들 */
export function marketStall(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const W = 2.0;
  const D = 0.85;
  const postH = 2.05;
  const counterY = 0.82;
  // 기둥 4개 (뒤가 높고 앞이 낮아 차양이 앞으로 기운다)
  for (const sx of [-1, 1]) {
    box(m, { x: sx * (W / 2 - 0.06), z: -D / 2 + 0.06, w: 0.1, d: 0.1, h: postH, color: DARK });
    box(m, { x: sx * (W / 2 - 0.06), z: D / 2 - 0.06, w: 0.09, d: 0.09, h: postH - 0.34, color: DARK });
  }
  // 판매대
  box(m, { y: counterY, w: W - 0.05, d: D - 0.1, h: 0.11, color: WOOD, top: TOPW });
  box(m, { z: D / 2 - 0.12, w: W - 0.1, d: 0.09, h: counterY, color: WOOD });
  for (const k of [0.28, 0.56, 0.84]) {
    slat(m, { z: D / 2 - 0.06, y: counterY * k, w: W - 0.16, h: 0.035, color: DARK });
  }
  box(m, { y: 0.3, w: W - 0.3, d: D - 0.24, h: 0.08, color: DARK, top: '#a98b62' });
  // 앞 가로대(물건 매다는 봉)
  const rail = mesh();
  cylinder(rail, { y: -(W - 0.1) / 2, r: 0.035, h: W - 0.1, seg: 5, color: DARK, capColor: TOPW });
  merge(m, rail, { rz: Math.PI / 2, ty: postH - 0.36, tz: D / 2 - 0.06 });
  // 차양 — 줄무늬 8칸 + 앞자락 물결
  const stripes = 8;
  const zb = -D / 2 - 0.06;
  const zf = D / 2 + 0.22;
  const yb = postH + 0.06;
  const yf = postH - 0.44;
  for (let i = 0; i < stripes; i++) {
    const x0 = -W / 2 - 0.1 + ((W + 0.2) * i) / stripes;
    const x1 = -W / 2 - 0.1 + ((W + 0.2) * (i + 1)) / stripes;
    const dy = i % 2 ? 0.035 : 0; // 살짝 접힌 주름 → 칸마다 선이 생긴다
    quad(
      m,
      [x0, yb, zb],
      [x0, yf + dy, zf],
      [x1, yf + dy, zf],
      [x1, yb, zb],
      i % 2 ? CLOTH : '#e7d7b8',
      { double: true }
    );
    // 앞자락 반원 물결
    tri(m, [x0, yf + dy, zf], [(x0 + x1) / 2, yf + dy - 0.11, zf + 0.01], [x1, yf + dy, zf], i % 2 ? CLOTH : '#e7d7b8', {
      double: true,
    });
  }
  // 매달린 물건 4개
  for (let i = 0; i < 4; i++) {
    const x = -0.72 + i * 0.48;
    slat(m, { x, y: postH - 0.5, z: D / 2 - 0.06, w: 0.018, h: 0.24, color: IRON_D });
    if (i % 2) {
      cylinder(m, { x, y: postH - 0.78, z: D / 2 - 0.06, r: 0.045, r2: 0.03, h: 0.15, seg: 5, color: '#d3a05e', capColor: '#c08a49' });
    } else {
      blobSphere(m, { x, y: postH - 0.7, z: D / 2 - 0.06, rx: 0.05, ry: 0.075, seg: 5, rings: 2, color: '#cf9a63', wob: 0.08, seed: seed + i });
    }
  }
  // 판매대 위 물건 3개
  for (let i = 0; i < 3; i++) {
    const x = -0.55 + i * 0.55;
    const h = rand(rng, 0.12, 0.2);
    cylinder(m, { x, z: rand(rng, -0.1, 0.1), y: counterY + 0.11, r: 0.07, r2: 0.05, h, seg: 6, color: CERAMIC, capColor: '#cbb492' });
  }
  return finish(m, { radius: 1.05, kind: 'stall' });
}

/** 세워 놓은 간판 — 두루마리 상단, 널판 판면, 벌어진 다리 2개, 병 그림 */
export function standingSign(seed = 1, opt = {}) {
  const m = mesh();
  const W = 0.68;
  const H = 0.82;
  const baseY = 0.52;
  // 다리 2개
  for (const sx of [-1, 1]) {
    const leg = mesh();
    box(leg, { w: 0.06, d: 0.06, h: baseY + 0.1, color: DARK });
    merge(m, leg, { rz: -sx * 0.1, rx: 0.12, tx: sx * (W / 2 - 0.09) });
  }
  box(m, { y: baseY, w: W, d: 0.07, h: H, color: WOOD, top: TOPW });
  // 위아래 두루마리 봉
  for (const y of [baseY, baseY + H]) {
    const roll = mesh();
    cylinder(roll, { y: -(W + 0.09) / 2, r: 0.045, h: W + 0.09, seg: 6, color: DARK, capColor: TOPW });
    merge(m, roll, { rz: Math.PI / 2, ty: y });
  }
  // 판면 널 이음매 2줄
  for (const sx of [-0.19, 0.19]) slat(m, { x: sx, z: 0.038, y: baseY + H / 2, w: 0.025, h: H * 0.88, color: DARK });
  // 병 그림 — 얇은 판 두 장으로 실루엣을 그린다
  slat(m, { z: 0.045, y: baseY + H * 0.36, w: 0.2, h: 0.3, color: '#cfa878' });
  slat(m, { z: 0.045, y: baseY + H * 0.66, w: 0.075, h: 0.18, color: '#cfa878' });
  return finish(m, { radius: 0.4, kind: 'sign' });
}

/** 도끼 박힌 그루터기 + 장작 (시트 1행 옆 작업터) */
export function choppingBlock(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  tube(m, { r: 0.32, r2: 0.29, h: 0.44, seg: 9, color: P.trunk, cap: true, capColor: '#dcb98c', soft: false });
  // 나이테
  tube(m, { y: 0.442, r: 0.16, h: 0.004, seg: 9, color: '#c9a375', cap: true, capColor: '#e6c79c' });
  // 박힌 도끼
  const ax = mesh();
  cylinder(ax, { r: 0.024, h: 0.52, seg: 4, color: WOOD, capColor: TOPW });
  box(ax, { y: 0.5, w: 0.05, d: 0.06, h: 0.13, color: IRON_D });
  const blade = mesh();
  quad(blade, [0, 0, 0.03], [0.15, 0.04, 0.018], [0.15, 0.04, -0.018], [0, 0, -0.03], IRON);
  quad(blade, [0, 0.12, -0.03], [0.15, 0.09, -0.018], [0.15, 0.09, 0.018], [0, 0.12, 0.03], IRON);
  quad(blade, [0, 0, 0.03], [0, 0.12, 0.03], [0.15, 0.09, 0.018], [0.15, 0.04, 0.018], IRON);
  quad(blade, [0, 0.12, -0.03], [0, 0, -0.03], [0.15, 0.04, -0.018], [0.15, 0.09, -0.018], IRON);
  merge(ax, blade, { tx: 0.024, ty: 0.5 });
  merge(m, ax, { rz: -0.42, tx: 0.06, ty: 0.34 });
  // 옆에 쌓인 장작
  for (let i = 0; i < 3; i++) {
    merge(m, logMesh(0.4, 0.075, 5, i % 2 ? P.trunk : P.trunkDark), {
      rz: Math.PI / 2,
      ry: rand(rng, -0.3, 0.3),
      tx: rand(rng, -0.72, -0.5),
      tz: rand(rng, -0.28, 0.28),
      ty: 0.075 + (i > 1 ? 0.14 : 0),
    });
  }
  return finish(m, { radius: 0.45, kind: 'block' });
}

/** 빨랫줄 — 기둥 2개 + 처진 줄 + 널린 천 3장 (5행) */
export function laundryLine(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const span = 2.4;
  const H = 1.5;
  for (const sx of [-1, 1]) {
    box(m, { x: sx * span * 0.5, w: 0.09, d: 0.08, h: H, color: DARK, top: TOPW });
  }
  // 처진 줄 3토막
  const pts = [-0.5, -0.17, 0.17, 0.5];
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i] * span;
    const x1 = pts[i + 1] * span;
    const y0 = H - 0.08 - (0.25 - Math.abs(pts[i]) * 0.5) * 0.32;
    const y1 = H - 0.08 - (0.25 - Math.abs(pts[i + 1]) * 0.5) * 0.32;
    slat(m, {
      x: (x0 + x1) / 2,
      y: (y0 + y1) / 2,
      w: 0.02,
      h: Math.hypot(x1 - x0, y1 - y0),
      color: ROPE,
      rz: Math.atan2(-(x1 - x0), y1 - y0),
    });
  }
  const cols = ['#f1e2c6', '#dfe6e8', '#e9d6c2'];
  for (let i = 0; i < 3; i++) {
    const x = -0.62 + i * 0.62;
    const hh = rand(rng, 0.42, 0.6);
    const y = H - 0.14 - (0.25 - Math.abs(x / span) * 0.5) * 0.32;
    panel(m, { x, y: y - hh, w: rand(rng, 0.26, 0.34), h: hh, color: cols[i] });
    slat(m, { x, y, w: 0.03, h: 0.07, color: DARK }); // 집게
  }
  return finish(m, { radius: span * 0.4, kind: 'laundry' });
}

// ══ Sheet 7 / 지형 : decor.js 로 이전 중인 호환용 얇은 버전 ══
/** 마을 분수 */
export function fountain(seed = 1, opt = {}) {
  const m = mesh();
  cylinder(m, { r: 1.35, r2: 1.3, h: 0.42, seg: 14, color: STONE, cap: false });
  cylinder(m, { y: 0.34, r: 1.22, h: 0.06, seg: 14, color: '#9ecfd8' });
  cylinder(m, { y: 0.4, r: 1.3, r2: 1.24, h: 0.12, seg: 14, color: STONE_D, cap: false });
  cylinder(m, { y: 0.4, r: 0.28, h: 0.5, seg: 9, color: STONE_D });
  cylinder(m, { y: 0.9, r: 0.62, r2: 0.5, h: 0.16, seg: 12, color: STONE, capColor: '#9ecfd8' });
  cylinder(m, { y: 1.06, r: 0.12, h: 0.42, seg: 7, color: STONE_D });
  blobSphere(m, { y: 1.56, rx: 0.16, ry: 0.2, seg: 6, rings: 3, color: '#bfe0e6', wob: 0.1, seed: seed + 2 });
  return finish(m, { radius: 1.35, kind: 'fountain' });
}

/** 마을 석상 */
export function statue(seed = 1, opt = {}) {
  const m = mesh();
  box(m, { w: 1.2, d: 1.2, h: 0.3, color: STONE_D, top: STONE });
  box(m, { y: 0.3, w: 0.9, d: 0.9, h: 0.5, color: STONE, top: '#e4ded0' });
  blobSphere(m, { y: 1.35, rx: 0.34, ry: 0.52, seg: 9, rings: 5, color: STONE, wob: 0.05, seed: seed + 1 });
  for (const s of [-1, 1]) {
    const arm = mesh();
    cylinder(arm, { r: 0.08, h: 0.44, seg: 5, color: STONE, cap: false });
    merge(m, arm, { rz: s * 0.4, tx: s * 0.3, ty: 1.15 });
  }
  cylinder(m, { x: 0.36, y: 0.8, r: 0.04, h: 1.3, seg: 4, color: STONE_D, cap: false });
  cone(m, { x: 0.36, y: 2.1, r: 0.08, h: 0.24, seg: 5, color: STONE_D });
  return finish(m, { radius: 0.7, kind: 'statue' });
}

/** 게시판 */
export function noticeBoard(seed = 1, opt = {}) {
  const m = mesh();
  for (const s of [-1, 1]) box(m, { x: s * 0.52, w: 0.12, d: 0.12, h: 1.3, color: DARK });
  box(m, { y: 0.62, w: 1.24, d: 0.09, h: 0.8, color: '#e0c08f' });
  gable(m, { y: 1.42, w: 1.4, d: 0.4, h: 0.22, color: DARK, eave: 0.08 });
  for (let i = 0; i < 3; i++) {
    slat(m, { x: -0.36 + i * 0.36, y: 0.78 + (i % 2) * 0.12, z: 0.06, w: 0.26, h: 0.3, color: '#f6f2e6' });
  }
  return finish(m, { radius: 0.6, kind: 'notice' });
}

/** 돌담 */
export function stoneWall(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  for (let r = 0; r < 3; r++) {
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

/** 밧줄 울타리 — 기둥 4개(머리 둥근) + 처진 밧줄 + 끝에 작은 삼각기 (Sheet 4 · 5행) */
export function ropeFence(seed = 1, opt = {}) {
  const m = mesh();
  const span = 2.7;
  const H = 0.78;
  const posts = 4;
  for (let i = 0; i < posts; i++) {
    const x = -span / 2 + (span / (posts - 1)) * i;
    cylinder(m, { x, r: 0.075, r2: 0.062, h: H, seg: 6, color: DARK, cap: false });
    cylinder(m, { x, y: H, r: 0.078, r2: 0.05, h: 0.06, seg: 6, color: WOOD, capColor: TOPW });
    // 밧줄을 감은 자리
    cylinder(m, { x, y: H - 0.1, r: 0.085, h: 0.045, seg: 6, color: ROPE, cap: false });
  }
  // 처진 밧줄 — 칸마다 2토막
  for (let i = 0; i < posts - 1; i++) {
    const xa = -span / 2 + (span / (posts - 1)) * i;
    const xb = xa + span / (posts - 1);
    const sag = 0.13;
    const mid = [(xa + xb) / 2, H - 0.08 - sag];
    const chain = [[xa, H - 0.08], mid, [xb, H - 0.08]];
    for (let k = 0; k < 2; k++) {
      const p = chain[k];
      const q = chain[k + 1];
      slat(m, {
        x: (p[0] + q[0]) / 2,
        y: (p[1] + q[1]) / 2,
        w: 0.028,
        h: Math.hypot(q[0] - p[0], q[1] - p[1]),
        color: ROPE,
        rz: Math.atan2(-(q[0] - p[0]), q[1] - p[1]),
      });
    }
  }
  // 끝 기둥에 매단 제비꼬리 깃발
  const fx = span / 2 + 0.16;
  quad(m, [fx - 0.14, H - 0.06, 0], [fx + 0.14, H - 0.06, 0], [fx + 0.14, H - 0.34, 0], [fx - 0.14, H - 0.34, 0], CLOTH, { double: true });
  tri(m, [fx - 0.14, H - 0.34, 0], [fx + 0.14, H - 0.34, 0], [fx, H - 0.22, 0], '#f7f2e6', { double: true });
  return finish(m, { radius: span * 0.45, kind: 'ropefence' });
}

/** 철제 울타리 */
export function ironFence(seed = 1, opt = {}) {
  const m = mesh();
  const span = 2.0;
  const bars = 7;
  for (let i = 0; i < bars; i++) {
    const x = -span / 2 + (span / (bars - 1)) * i;
    cylinder(m, { x, r: 0.028, h: 0.95, seg: 4, color: IRON_D, cap: false });
    cone(m, { x, y: 0.95, r: 0.05, h: 0.12, seg: 4, color: IRON_D });
  }
  for (const y of [0.24, 0.72]) box(m, { y, w: span, d: 0.035, h: 0.035, color: IRON_D });
  return finish(m, { radius: 0.9, kind: 'ironfence' });
}

/** 나무 대문 */
export function woodGate(seed = 1, opt = {}) {
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

/** 돌 아치 */
export function stoneArch(seed = 1, opt = {}) {
  const m = mesh();
  const R = 1.05;
  for (const s of [-1, 1]) box(m, { x: s * R, w: 0.42, d: 0.42, h: 1.5, color: STONE, top: STONE_D });
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
  return finish(m, { radius: 1.2, kind: 'stonearch' });
}

/** 삼각 깃발 가랜드 */
export function bunting(seed = 1, opt = {}) {
  const m = mesh();
  const span = 3.2;
  for (const s of [-1, 1]) cylinder(m, { x: s * span * 0.5, r: 0.05, h: 1.9, seg: 5, color: DARK, cap: false });
  const colors = ['#d9834a', '#8fb0c4', '#e0b45c', '#93b787', '#c98fb0'];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = -span / 2 + span * t;
    const y = 1.86 - Math.sin(t * Math.PI) * 0.34;
    const seg = mesh();
    box(seg, { w: span / (n - 1) + 0.04, d: 0.02, h: 0.02, color: '#6b6156' });
    merge(m, seg, { tx: x, ty: y });
    tri(m, [x - 0.11, y - 0.02, 0], [x + 0.11, y - 0.02, 0], [x, y - 0.34, 0], colors[i % colors.length], { double: true });
  }
  return finish(m, { radius: 0.3, kind: 'bunting' });
}

/** 긴 깃발 */
export function banner(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  cylinder(m, { r: 0.06, h: 2.6, seg: 5, color: DARK, cap: false });
  blobSphere(m, { y: 2.66, rx: 0.08, ry: 0.09, seg: 5, rings: 3, color: '#d9b25e', wob: 0.04, seed: seed + 1 });
  const col = pick(rng, ['#c2603a', '#7f96b8', '#93b787']);
  box(m, { x: 0.34, y: 1.35, w: 0.62, d: 0.03, h: 1.05, color: col });
  tri(m, [0.03, 1.35, 0], [0.65, 1.35, 0], [0.34, 1.08, 0], col, { double: true });
  return finish(m, { radius: 0.3, kind: 'banner' });
}

/** 기둥과 사슬 */
export function bollardChain(seed = 1, opt = {}) {
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
    slat(m, {
      x: (x0 + x1) / 2,
      y: (y0 + y1) / 2,
      w: 0.03,
      h: Math.hypot(x1 - x0, y1 - y0),
      color: IRON_D,
      rz: Math.atan2(-(x1 - x0), y1 - y0),
    });
  }
  return finish(m, { radius: 0.7, kind: 'bollard' });
}

/** 통 화분 */
export function planterBarrel(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  cylinder(m, { r: 0.3, r2: 0.27, h: 0.5, seg: 9, color: WOOD, capColor: '#a98b62', soft: false });
  for (const y of [0.08, 0.4]) cylinder(m, { y, r: 0.315, h: 0.05, seg: 9, color: IRON_D, cap: false });
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

/** 선돌 무리 */
export function monolith(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const n = randInt(rng, 2, 4);
  for (let i = 0; i < n; i++) {
    const h = rand(rng, 1.4, 3.0);
    const w = rand(rng, 0.4, 0.7);
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
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
  return finish(m, { radius: 1.1, kind: 'monolith' });
}

/** 돌무더기 */
export function rockMound(seed = 1, opt = {}) {
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

/** 흙더미 */
export function dirtMound(seed = 1, opt = {}) {
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
  return finish(m, { radius: r * 0.8, kind: 'mound' });
}

/** 동굴 입구 */
export function caveEntrance(seed = 1, opt = {}) {
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
