// Sheet 7(장식 요소와 경계) + 지형 시트를 한 장 한 장 대조해 옮긴 저폴리 3D 모델.
// 잉크 렌더러는 실루엣과 크리스(접힌) 엣지만 그린다. 그래서 그림 속의 선 —
// 철물 밴드, 창살, 돌 줄눈, 사슬 고리, 널판 이음매 — 은 전부 "진짜 얇은 박스/원기둥"으로 만든다.
// 색만 칠한 디테일은 선이 안 나오므로 절대 쓰지 않는다.
import { mesh, merge, box, gable, blobSphere, tri, quad, poly, panel, bounds } from '../core/mesh.js';
import { P } from '../art/palette.js';
import { makeRng, rand, randInt } from '../core/rng.js';

function finish(m, meta) {
  // 살짝 기울인 부품(rz 로 눕힌 기둥·다리) 때문에 모서리가 땅 밑으로 몇 mm 내려가는 일이 있다.
  // 모델은 "땅에 닿는 바닥 중앙"이 원점이어야 하므로 그만큼 통째로 들어 올린다.
  const pre = bounds(m);
  if (pre.minY < 0 && pre.minY > -0.08) {
    for (let i = 1; i < m.verts.length; i += 3) m.verts[i] -= pre.minY;
  }
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
const STONE_TOP = '#e6e0d1';
const IRON = '#4b463d';
const IRON_L = '#5f5a4f';
const ROPE = '#c9b18a';
const SOIL = '#8b7250';
const WATER = P.water;
const WATER_D = P.waterDeep;
const PAPER = P.paper;

// ── 공용 헬퍼 ────────────────────────────────────
/**
 * 원기둥 / 원뿔대. core/mesh.js 의 cylinder 와 인자는 같지만 옆면을 "바깥에서 봤을 때 반시계"로 감는다.
 * 렌더러가 뒷면을 잘라내기 때문에, 감기가 뒤집혀 있으면 가까운 면이 잘리고 먼 면만 남아
 * 수반·화분처럼 굵은 통이 속이 뚫린 고리처럼 보인다. 여기서는 그러지 않도록 직접 감는다.
 */
function tube(m, o) {
  const { x = 0, y = 0, z = 0, r = 0.5, r2 = null, h = 1, seg = 9, color = '#ccc', cap = true, capColor = null, ry = 0, soft = true } = o;
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

/** 원뿔 — tube 와 같은 이유로 감기를 바깥쪽으로 잡은 cone */
function spike(m, o) {
  const { x = 0, y = 0, z = 0, r = 0.5, h = 1, seg = 9, color = '#c66', ry = 0, skirt = 0, soft = true } = o;
  const b = mesh();
  const ring = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    ring.push([Math.cos(a) * r, skirt, Math.sin(a) * r]);
  }
  const apex = [0, h, 0];
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    tri(b, ring[j], ring[i], apex, color, { soft });
  }
  merge(m, b, { tx: x, ty: y, tz: z, ry });
  return m;
}

/** 불규칙 다각기둥 — 바위·판돌용. 역시 옆면을 바깥으로 감는다 */
function chunk(m, o) {
  const { x = 0, y = 0, z = 0, pts, h = 1, color = '#ccc', topColor = null, topScale = 0.7, topOffset = [0, 0], soft = false } = o;
  const b = mesh();
  const bot = pts.map((p) => [p[0], 0, p[1]]);
  const top = pts.map((p) => [p[0] * topScale + topOffset[0], h, p[1] * topScale + topOffset[1]]);
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    quad(b, bot[i], top[i], top[j], bot[j], color, { soft });
  }
  poly(b, top.slice().reverse(), topColor || color);
  merge(m, b, { tx: x, ty: y, tz: z });
  return m;
}

/**
 * (x,y) 단면을 z 방향으로 뽑아낸 "판" — 뾰족한 널판(피켓), 화살표 표지판,
 * 방패 간판, 아치형 문짝, 칼날처럼 옆에서 본 실루엣이 중요한 것에 쓴다.
 * pts 는 반시계(x 오른쪽 · y 위) 순서. bottom:false 면 땅에 붙는 아랫면을 생략한다.
 */
function prismXY(m, o) {
  const { x = 0, y = 0, z = 0, pts, d = 0.06, color = '#ccc', back = null, ry = 0, rz = 0, bottom = true } = o;
  const b = mesh();
  const hd = d / 2;
  const F = pts.map((p) => [p[0], p[1], hd]);
  const B = pts.map((p) => [p[0], p[1], -hd]);
  poly(b, F, color); // 앞(+z)
  poly(b, B.slice().reverse(), back || color); // 뒤(-z)
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    if (!bottom && pts[i][1] <= 1e-4 && pts[j][1] <= 1e-4) continue;
    quad(b, F[i], B[i], B[j], F[j], color);
  }
  merge(m, b, { tx: x, ty: y, tz: z, ry, rz });
  return m;
}

/** 끝이 뾰족한 널판(피켓) — 사각 몸통 + 삼각 머리 */
function picket(m, o) {
  const { x = 0, y = 0, z = 0, w = 0.17, d = 0.06, h = 1, tip = 0.18, color = WOOD, ry = 0, rz = 0 } = o;
  const hw = w / 2;
  const sh = h - tip;
  prismXY(m, {
    x,
    y,
    z,
    d,
    color,
    ry,
    rz,
    bottom: false,
    pts: [
      [-hw, 0],
      [hw, 0],
      [hw, sh],
      [0, h],
      [-hw, sh],
    ],
  });
  return m;
}

/** 기둥 머리의 작은 구슬 — 10면짜리 저폴리 공(비싼 구를 쓰지 않는다) */
function knob(m, o) {
  const { x = 0, y = 0, z = 0, r = 0.08, ry = null, color = STONE, seg = 5, seed = 7 } = o;
  blobSphere(m, { x, y, z, rx: r, ry: ry == null ? r * 1.08 : ry, rz: r, seg, rings: 2, color, wob: 0.02, seed });
  return m;
}

/** 창끝 장식 — 미늘(플레어) + 4면 피라미드 */
function spearBar(m, o) {
  const { x = 0, z = 0, y = 0, h = 1, r = 0.028, color = IRON } = o;
  tube(m, { x, y, z, r, h, seg: 4, color, cap: false, soft: false, ry: Math.PI / 4 });
  tube(m, { x, y: y + h - 0.03, z, r: r * 1.2, r2: r * 2.4, h: 0.07, seg: 4, color, cap: false, soft: false, ry: Math.PI / 4 });
  spike(m, { x, y: y + h + 0.04, z, r: r * 2.4, h: 0.2, seg: 4, color, ry: Math.PI / 4 });
  return m;
}

/** 늘어진 밧줄 — 짧은 원기둥 토막을 사인 곡선 위에 늘어놓는다 */
function sagRope(m, o) {
  const { x0, x1, y0, y1 = null, z = 0, sag = 0.2, r = 0.026, color = ROPE, segs = 3 } = o;
  const ye = y1 == null ? y0 : y1;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const ax = x0 + (x1 - x0) * t0;
    const bx = x0 + (x1 - x0) * t1;
    const ay = y0 + (ye - y0) * t0 - Math.sin(t0 * Math.PI) * sag;
    const by = y0 + (ye - y0) * t1 - Math.sin(t1 * Math.PI) * sag;
    const len = Math.hypot(bx - ax, by - ay);
    const s = mesh();
    tube(s, { r, h: len, seg: 4, color, cap: false });
    merge(m, s, { rz: Math.atan2(-(bx - ax), by - ay), tx: ax, ty: ay, tz: z });
  }
  return m;
}

/** 사슬 — 짧고 납작한 고리를 번갈아 눕혀 놓는다(토러스는 너무 비싸다) */
function chainSpan(m, o) {
  const { x0, x1, y0, y1 = null, z = 0, sag = 0.16, links = 5, color = IRON } = o;
  const ye = y1 == null ? y0 : y1;
  const span = Math.hypot(x1 - x0, ye - y0);
  const L = (span / links) * 1.3;
  for (let i = 0; i < links; i++) {
    const t = (i + 0.5) / links;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (ye - y0) * t - Math.sin(t * Math.PI) * sag;
    const ta = Math.max(0, t - 0.06);
    const tb = Math.min(1, t + 0.06);
    const dx = (x1 - x0) * (tb - ta);
    const dy = (ye - y0) * (tb - ta) - (Math.sin(tb * Math.PI) - Math.sin(ta * Math.PI)) * sag;
    const ang = Math.atan2(dy, dx);
    const link = mesh();
    if (i % 2 === 0) box(link, { y: -0.026, w: L, d: 0.02, h: 0.052, color });
    else box(link, { y: -0.011, w: L, d: 0.052, h: 0.022, color });
    merge(m, link, { rz: ang, tx: px, ty: py, tz: z });
  }
  return m;
}

/** 낮은 돔(언덕·물웅덩이 둔덕) — 아래가 뚫린 반구 */
function dome(m, o) {
  const { x = 0, y = 0, z = 0, r = 1, rz2 = null, h = 0.6, seg = 9, rings = 2, color = P.grass, wob = 0.07, seed = 1 } = o;
  const rnd = makeRng(seed);
  const rr = rz2 == null ? r : rz2;
  const b = mesh();
  const grid = [];
  for (let i = 0; i <= rings; i++) {
    const phi = (i / rings) * (Math.PI / 2);
    const row = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const k = i === rings ? 1 : 1 + (rnd() - 0.5) * 2 * wob;
      row.push([Math.cos(a) * r * Math.cos(phi) * k, Math.sin(phi) * h * k, Math.sin(a) * rr * Math.cos(phi) * k]);
    }
    grid.push(row);
  }
  const apex = [0, h, 0];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const A = grid[i][j];
      const B = grid[i][j2];
      const C = grid[i + 1][j2];
      const D = grid[i + 1][j];
      if (i === rings - 1) tri(b, B, A, apex, color, { soft: true });
      else quad(b, A, D, C, B, color, { soft: true });
    }
  }
  merge(m, b, { tx: x, ty: y, tz: z });
  return m;
}

/** 불규칙한 돌덩이 하나 */
function rock(m, o) {
  const { x = 0, y = 0, z = 0, r = 0.4, h = 0.4, sides = 5, seed = 1, color = STONE, topColor = STONE_TOP, flat = 0.62 } = o;
  const rnd = makeRng(seed);
  const pts = [];
  const a0 = rnd() * Math.PI * 2;
  for (let k = 0; k < sides; k++) {
    const a = a0 + (k / sides) * Math.PI * 2;
    const rr = r * rand(rnd, 0.76, 1.16);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  chunk(m, {
    x,
    y,
    z,
    pts,
    h,
    color,
    topColor,
    topScale: flat,
    topOffset: [rand(rnd, -r * 0.12, r * 0.12), rand(rnd, -r * 0.12, r * 0.12)],
  });
  return m;
}

/**
 * 각진 덩어리의 평면 다각형(x,z). 각도가 커지는 순서(반시계)라 그대로 chunk/facetRock 에 넣을 수 있다.
 * ridge 를 주면 한 칸 걸러 안팎으로 밀어 세로 결(스트라이에이션)이 또렷해진다.
 * 밖에서 따로 만들어 넘기면 풀 뚜껑·술 장식을 테두리에 딱 맞출 수 있다.
 */
function facetPlan(o) {
  const { r = 1, rz2 = null, sides = 7, seed = 1, wob = 0.14, ridge = 0 } = o;
  const rnd = makeRng(seed);
  const rr = rz2 == null ? r : rz2;
  const a0 = rnd() * Math.PI * 2;
  const pts = [];
  for (let k = 0; k < sides; k++) {
    const a = a0 + (k / sides) * Math.PI * 2;
    const j = (1 + (k % 2 ? -ridge : ridge)) * rand(rnd, 1 - wob, 1 + wob);
    pts.push([Math.cos(a) * r * j, Math.sin(a) * rr * j]);
  }
  return pts;
}

/**
 * 층별 반지름 프로필로 쌓아 올린 각진 덩어리.
 * profile: [[높이비율, 반지름비율], ...] 아래에서 위로. 층마다 같은 평면을 늘였다 줄이므로
 * 옆면 모서리가 위아래로 곧게 이어져 그대로 세로 결이 된다.
 */
function facetRock(m, o) {
  const {
    x = 0,
    y = 0,
    z = 0,
    plan = null,
    h = 0.6,
    profile = [
      [0, 1],
      [1, 0.7],
    ],
    color = STONE,
    topColor = STONE_TOP,
    soft = false,
    cap = true,
    yaw = 0,
  } = o;
  const pts = plan || facetPlan(o);
  const rings = profile.map((pr) => pts.map((p) => [p[0] * pr[1], pr[0] * h, p[1] * pr[1]]));
  const b = mesh();
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < pts.length; k++) {
      const k2 = (k + 1) % pts.length;
      quad(b, rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2], color, { soft });
    }
  }
  if (cap) poly(b, rings[rings.length - 1].slice().reverse(), topColor || color);
  merge(m, b, { tx: x, ty: y, tz: z, ry: yaw });
  return m;
}

/**
 * 모서리를 깎아낸 막돌 블록 — 네 귀퉁이를 잘라 8각으로 만들고 윗면도 살짝 좁힌다.
 * 기계로 자른 벽돌처럼 보이지 않게 담·동굴 아치의 돌 하나하나에 쓴다.
 */
function cobbleBlock(m, o) {
  const {
    x = 0,
    y = 0,
    z = 0,
    w = 0.4,
    h = 0.3,
    d = 0.4,
    color = STONE,
    top = STONE_TOP,
    ry = 0,
    rz = 0,
    cham = 0.3,
    taper = 0.86,
  } = o;
  const hw = w / 2;
  const hd = d / 2;
  const cx = hw * cham;
  const cz = hd * cham;
  const pts = [
    [hw, -hd + cz],
    [hw, hd - cz],
    [hw - cx, hd],
    [-hw + cx, hd],
    [-hw, hd - cz],
    [-hw, -hd + cz],
    [-hw + cx, -hd],
    [hw - cx, -hd],
  ];
  const b = mesh();
  const bot = pts.map((p) => [p[0], 0, p[1]]);
  const tp = pts.map((p) => [p[0] * taper, h, p[1] * taper]);
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    quad(b, bot[i], tp[i], tp[j], bot[j], color, { soft: false });
  }
  poly(b, tp.slice().reverse(), top || color);
  merge(m, b, { tx: x, ty: y, tz: z, ry, rz });
  return m;
}

/** 선돌용 판석 — 폭이 두께보다 훨씬 넓고, 꼭대기는 비스듬히 쪼아낸 쐐기 모양 */
function slabStone(m, o) {
  const {
    x = 0,
    y = 0,
    z = 0,
    w = 0.6,
    d = 0.45,
    h = 1.5,
    sides = 6,
    seed = 1,
    color = STONE,
    topColor = STONE_TOP,
    taper = 0.9,
    slope = 0.3,
    yaw = 0,
  } = o;
  const rnd = makeRng(seed);
  // 첫 점을 +x 축 가까이 고정한다 — 그래야 w 가 실제 판석의 폭이 된다(무작위로 돌리면 폭이 줄어든다)
  const a0 = rand(rnd, -0.1, 0.1);
  const pts = [];
  for (let k = 0; k < sides; k++) {
    const a = a0 + (k / sides) * Math.PI * 2;
    pts.push([Math.cos(a) * (w / 2) * rand(rnd, 0.9, 1.06), Math.sin(a) * (d / 2) * rand(rnd, 0.86, 1.1)]);
  }
  const b = mesh();
  const bot = pts.map((p) => [p[0], 0, p[1]]);
  // 윗면은 기울어진 평면 하나(y = h + x·slope) — 정으로 비스듬히 쪼아낸 자국이 된다
  const tp = pts.map((p) => [p[0] * taper, h + p[0] * taper * slope, p[1] * taper]);
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    quad(b, bot[i], tp[i], tp[j], bot[j], color, { soft: false });
  }
  poly(b, tp.slice().reverse(), topColor || color);
  merge(m, b, { tx: x, ty: y, tz: z, ry: yaw });
  return m;
}

/** 아치 단면(x,y) — 아래 두 귀 → 오른쪽 기둥 → 반원 → 왼쪽 기둥. prismXY 가 요구하는 반시계 순서 */
function archPts(w, h, seg = 7) {
  const R = w / 2;
  const sh = Math.max(0.02, h - R);
  const p = [
    [-R, 0],
    [R, 0],
    [R, sh],
  ];
  for (let i = 1; i < seg; i++) {
    const a = (i / seg) * Math.PI;
    p.push([Math.cos(a) * R, sh + Math.sin(a) * R]);
  }
  p.push([-R, sh]);
  return p;
}

/** 물 표면 — 위를 보는 다각형 한 장 */
function waterDisc(m, o) {
  const { x = 0, y = 0.02, z = 0, r = 1, seg = 10, color = WATER, outline = true } = o;
  const pts = [];
  for (let i = seg; i > 0; i--) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
  }
  poly(m, pts, color, { outline });
  return m;
}

/** 풀 포기 — 얇은 삼각형이 그대로 펜 선이 된다 */
function tuft(m, o) {
  const { x = 0, y = 0, z = 0, h = 0.22, w = 0.05, n = 3, color = P.grassDeep, seed = 1, spread = 0.1 } = o;
  const rnd = makeRng(seed);
  for (let i = 0; i < n; i++) {
    const bx = x + rand(rnd, -spread, spread);
    const bz = z + rand(rnd, -spread, spread);
    const lean = rand(rnd, -0.16, 0.16);
    const hh = h * rand(rnd, 0.65, 1.25);
    tri(m, [bx - w / 2, y, bz], [bx + w / 2, y, bz], [bx + lean, y + hh, bz + lean * 0.4], color, { double: true });
  }
  return m;
}

/** 꽃 한 송이 — 오각 꽃잎 한 장 + 줄기 한 장 */
function bloom(m, o) {
  const { x = 0, y = 0, z = 0, r = 0.055, color = '#e8909f', stem = 0.12, stemColor = P.leafDark, tilt = 0.4 } = o;
  if (stem > 0) panel(m, { x, y: y - stem, z, w: 0.022, h: stem, color: stemColor });
  const b = mesh();
  const pts = [];
  for (let i = 5; i > 0; i--) {
    const a = (i / 5) * Math.PI * 2;
    pts.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
  }
  poly(b, pts, color, { double: true });
  merge(m, b, { tx: x, ty: y, tz: z, rx: tilt });
  return m;
}

/** 화분 위에 심긴 꽃무더기 — 잎덩어리 하나 + 꽃 몇 송이 */
function flowerBed(m, o) {
  const { x = 0, y = 0, z = 0, rx = 0.5, rz = 0.18, ry = 0.14, n = 6, seed = 1 } = o;
  const rnd = makeRng(seed);
  const cols = ['#e8909f', '#efc86a', '#b79ede', '#f4f0e0', '#e88f6d'];
  blobSphere(m, {
    x,
    y: y + ry * 0.7,
    z,
    rx,
    ry,
    rz,
    seg: 8,
    rings: 3,
    color: P.leaf,
    wob: 0.16,
    bumps: 3,
    bumpAmt: 0.22,
    seed: seed + 5,
  });
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    bloom(m, {
      x: x + (t - 0.5) * rx * 1.8,
      y: y + ry * 1.5 + rand(rnd, 0, 0.09),
      z: z + rand(rnd, -rz * 0.5, rz * 0.5),
      r: rand(rnd, 0.038, 0.052),
      color: cols[i % cols.length],
      stem: rand(rnd, 0.08, 0.16),
      tilt: rand(rnd, 0.15, 0.4),
    });
  }
  return m;
}

// ── Sheet 7 · 1행 : 울타리 ──────────────────────
/** 뾰족 피켓 울타리 — 그림 1행 1번: 끝이 뾰족한 널판 5장 + 가로살 2줄 */
export function picketFence(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const span = opt.span || 2.0;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span / (n - 1)) * i;
    picket(m, {
      x,
      z: 0.02,
      w: rand(rng, 0.16, 0.19),
      d: 0.055,
      h: rand(rng, 0.92, 1.02),
      tip: rand(rng, 0.16, 0.21),
      color: i % 2 ? WOOD : '#d3b083',
      ry: rand(rng, -0.05, 0.05),
      rz: rand(rng, -0.035, 0.035),
    });
  }
  // 널판 뒤로 지나가는 가로살 2줄
  for (const y of [0.34, 0.58]) {
    box(m, { z: -0.045, y, w: span + 0.16, d: 0.05, h: 0.075, color: DARK, ry: rand(rng, -0.02, 0.02) });
  }
  return finish(m, { radius: span * 0.5, kind: 'picketfence' });
}

/** 부서진 가로살 울타리 — 그림 1행 2번: 기둥 3개 + 가로살 2줄 + 비스듬히 떨어진 널판 */
export function railFenceBroken(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const span = opt.span || 2.0;
  // 기둥 3개 — 하나는 기울어 있다
  const xs = [-span * 0.42, -span * 0.02, span * 0.4];
  xs.forEach((x, i) => {
    picket(m, {
      x,
      w: 0.15,
      d: 0.09,
      h: i === 2 ? 0.86 : 1.0,
      tip: 0.14,
      color: i === 2 ? '#cfab7e' : WOOD,
      rz: i === 2 ? 0.16 : rand(rng, -0.03, 0.03),
    });
  });
  // 성한 가로살 2줄 (살짝 처져 있다)
  for (const y of [0.32, 0.66]) {
    const rail = mesh();
    box(rail, { y: -0.04, w: span * 0.92, d: 0.06, h: 0.09, color: DARK });
    merge(m, rail, { rz: rand(rng, -0.05, -0.02), tx: -span * 0.2, ty: y, tz: -0.05 });
  }
  // 떨어져 비스듬히 걸린 부러진 널판
  const broke = mesh();
  box(broke, { y: 0, w: 0.09, d: 0.06, h: 0.95, color: '#c9a374' });
  merge(m, broke, { rz: -0.72, tx: span * 0.34, ty: 0.02, tz: -0.1 });
  // 부러진 살 토막
  const stub = mesh();
  box(stub, { y: -0.04, w: 0.42, d: 0.06, h: 0.085, color: DARK });
  merge(m, stub, { rz: 0.22, tx: span * 0.46, ty: 0.6, tz: -0.05 });
  return finish(m, { radius: span * 0.55, kind: 'railfence' });
}

/** 철제 창살 울타리 — 그림 2행 1번: 창끝 6개 + 가로살 2줄 */
export function ironFence(seed = 1, opt = {}) {
  const m = mesh();
  const span = opt.span || 2.0;
  const bars = 6;
  for (let i = 0; i < bars; i++) {
    const x = -span / 2 + (span / (bars - 1)) * i;
    spearBar(m, { x, h: 0.96, r: 0.028, color: IRON });
  }
  for (const y of [0.4, 0.72]) {
    box(m, { y, w: span + 0.18, d: 0.04, h: 0.045, color: IRON_L });
  }
  return finish(m, { radius: span * 0.5, kind: 'ironfence' });
}

/** 밧줄 울타리 — 그림 2행 3번: 구슬머리 기둥 3개 + 늘어진 밧줄 2칸 */
export function ropeFence(seed = 1, opt = {}) {
  const m = mesh();
  const span = opt.span || 2.2;
  const xs = [-span / 2, 0, span / 2];
  for (const x of xs) {
    tube(m, { x, r: 0.062, r2: 0.05, h: 0.76, seg: 5, color: WOOD, cap: false });
    tube(m, { x, y: 0.66, r: 0.068, h: 0.07, seg: 5, color: ROPE, cap: false }); // 밧줄 감은 자리
    knob(m, { x, y: 0.8, r: 0.075, color: DARK });
  }
  for (let i = 0; i < 2; i++) {
    sagRope(m, { x0: xs[i], x1: xs[i + 1], y0: 0.7, sag: 0.2, r: 0.026, segs: 3 });
  }
  return finish(m, { radius: span * 0.5, kind: 'ropefence' });
}

/** 사슬 울타리 — 그림 5행 3번: 마름모 머리 각기둥 3개 + 늘어진 사슬 2칸 */
export function chainFence(seed = 1, opt = {}) {
  const m = mesh();
  const span = opt.span || 2.0;
  const xs = [-span / 2, 0, span / 2];
  for (const x of xs) {
    // 네모 각기둥 — seg:4 + soft:false 라야 네 모서리에 잉크 선이 선다
    tube(m, { x, r: 0.16, r2: 0.105, h: 0.12, seg: 4, color: STONE_D, cap: false, soft: false }); // 퍼진 발
    tube(m, { x, y: 0.12, r: 0.105, h: 0.68, seg: 4, color: STONE, cap: false, soft: false });
    // 마름모 피니얼 — 아래로 좁아지는 사각뿔대 + 위 사각뿔
    tube(m, { x, y: 0.8, r: 0.105, r2: 0.15, h: 0.11, seg: 4, color: STONE, cap: false, soft: false });
    spike(m, { x, y: 0.91, r: 0.15, h: 0.18, seg: 4, color: STONE_D });
  }
  for (let i = 0; i < 2; i++) {
    chainSpan(m, { x0: xs[i], x1: xs[i + 1], y0: 0.82, sag: 0.2, links: 4 });
  }
  return finish(m, { radius: span * 0.5, kind: 'chainfence' });
}

// ── Sheet 7 · 1행 : 돌담 ────────────────────────
/** 낮은 돌 경계 — 그림 1행: 돌 6개가 한 켜로만 늘어선 낮은 담 */
export function stoneWallLow(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const span = opt.span || 2.0;
  const n = 6;
  // 돌 폭을 0.6~1.6배로 크게 흔든 뒤 합이 span 이 되도록 되돌린다 — 같은 폭이 반복되면 벽돌로 보인다
  const ws = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const w = rand(rng, 0.6, 1.6);
    ws.push(w);
    sum += w;
  }
  let cur = -span / 2;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const w = (ws[i] / sum) * span;
    cobbleBlock(m, {
      x: cur + w / 2,
      y: i % 2 ? rand(rng, 0.005, 0.03) : 0, // 한 칸 걸러 살짝 올라앉은 돌
      w: w * 1.02, // 돌끼리 살짝 물리게 — 사이가 벌어지면 담이 아니라 흩어진 돌이 된다
      d: rand(rng, 0.34, 0.46),
      h: (0.34 - t * 0.13) * rand(rng, 0.92, 1.14), // 오른쪽으로 갈수록 낮아진다
      color: i % 2 ? STONE : STONE_D,
      top: STONE_TOP,
      ry: rand(rng, -0.14, 0.14),
      cham: rand(rng, 0.26, 0.4),
      taper: rand(rng, 0.78, 0.9),
    });
    cur += w;
  }
  return finish(m, { radius: span * 0.5, kind: 'stonewall' });
}

/** 긴 막돌 담 — 그림 1행: 굵은 아랫켜 + 중간켜 + 작은 윗켜, 3켜짜리 긴 담 */
export function stoneWallCoursed(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const span = opt.span || 2.6;
  const courses = [
    { n: 4, h: 0.31, d: 0.46 },
    { n: 5, h: 0.28, d: 0.42 },
    { n: 4, h: 0.25, d: 0.4 },
  ];
  let y = 0;
  courses.forEach((c, ci) => {
    // 켜마다 돌 폭을 0.6~1.6배로 흔들어 뽑고, 합이 span 이 되도록 되돌린다
    const ws = [];
    let sum = 0;
    for (let i = 0; i < c.n; i++) {
      const w = rand(rng, 0.6, 1.6);
      ws.push(w);
      sum += w;
    }
    let cur = -span / 2;
    for (let i = 0; i < c.n; i++) {
      const w = (ws[i] / sum) * span;
      cobbleBlock(m, {
        x: cur + w / 2,
        y: y + rand(rng, -0.1, 0.1) * c.h, // 켜 자체가 위아래로 출렁이게 — 자로 잰 줄눈은 없다
        w: w * 1.02, // 이웃 돌과 살짝 물리게
        d: c.d * rand(rng, 0.9, 1.08),
        h: c.h * rand(rng, 1.06, 1.22), // 켜끼리 겹쳐 쌓아 틈이 뚫리지 않게
        color: (i + ci) % 2 ? STONE : STONE_D,
        top: STONE_TOP,
        ry: rand(rng, -0.05, 0.05),
        cham: rand(rng, 0.18, 0.3),
        taper: rand(rng, 0.82, 0.92),
      });
      cur += w;
    }
    y += c.h;
  });
  // 속심 — 돌 사이 틈으로 배경이 비치지 않도록 담 안쪽을 채우는 한 덩이
  box(m, { y: 0, w: span * 0.99, d: 0.3, h: y, color: STONE_D });
  // 갓돌 — 담 위를 덮는 넓고 납작한 돌 한 줄
  const capN = 3;
  for (let i = 0; i < capN; i++) {
    const w = span / capN;
    cobbleBlock(m, {
      x: -span / 2 + w * (i + 0.5),
      y: y + rand(rng, -0.02, 0.02),
      w: w * 0.98,
      d: 0.56,
      h: 0.15,
      color: i % 2 ? STONE : STONE_D,
      top: STONE_TOP,
      ry: rand(rng, -0.05, 0.05),
      cham: 0.3,
      taper: 0.93,
    });
  }
  return finish(m, { radius: span * 0.5, kind: 'stonewall' });
}

/** 담 모서리 — 그림 1행 오른쪽 끝: 네 켜가 방향을 번갈아 물리는 귀돌 쌓기 */
export function stoneWallCorner(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const courses = 3;
  const ch = 0.28;
  const T = 0.38; // 담 두께
  const RUN = 1.0; // 모서리에서 뻗어 나가는 길이
  const O = -RUN / 2; // 원점이 가운데 오도록
  for (let c = 0; c < courses; c++) {
    const y = c === 0 ? 0 : c * ch + rand(rng, -0.1, 0.1) * ch; // 켜가 출렁이게(맨 아래 켜는 땅에 붙인다)
    const h = ch * rand(rng, 1.04, 1.2); // 켜 사이가 벌어지지 않도록 조금씩 겹쳐 쌓는다
    // 켜마다 모서리를 차지하는 팔이 바뀐다 — 실제 귀돌(quoin) 쌓기 방식
    const flip = c % 2 === 0;
    const ax0 = flip ? 0 : T;
    const az0 = flip ? T : 0;
    // +x 로 뻗는 팔 — 긴 쪽은 돌 두 장으로 나누되 길이 비를 0.6~1.6배로 흔든다
    const k = rand(rng, 0.6, 1.6);
    const split = ax0 + (RUN - ax0) * (k / (k + 1));
    const xSeg = [
      [ax0, split],
      [split, RUN],
    ];
    xSeg.forEach((s, i) => {
      cobbleBlock(m, {
        x: O + (s[0] + s[1]) / 2,
        z: O + T / 2,
        w: s[1] - s[0],
        d: T * rand(rng, 0.94, 1.06),
        h,
        y,
        color: (c + i) % 2 ? STONE : STONE_D,
        top: STONE_TOP,
        ry: rand(rng, -0.04, 0.04),
        cham: rand(rng, 0.16, 0.26),
        taper: rand(rng, 0.9, 0.96),
      });
    });
    // -z 쪽(뒤로) 뻗는 팔
    cobbleBlock(m, {
      x: O + T / 2,
      z: O + (az0 + RUN) / 2,
      w: T * rand(rng, 0.94, 1.06),
      d: RUN - az0,
      h,
      y,
      color: c % 2 ? STONE_D : STONE,
      top: STONE_TOP,
      ry: rand(rng, -0.04, 0.04),
      cham: rand(rng, 0.16, 0.26),
      taper: rand(rng, 0.9, 0.96),
    });
  }
  // 속심 — 두 팔 안쪽을 채워 돌 사이로 배경이 비치지 않게 한다
  const capY = courses * ch;
  box(m, { x: O + RUN / 2, z: O + T / 2, w: RUN, d: T * 0.72, h: capY, color: STONE_D });
  box(m, { x: O + T / 2, z: O + RUN / 2, w: T * 0.72, d: RUN, h: capY, color: STONE_D });
  // 갓돌 — 두 팔 위를 각각 넓고 납작한 돌로 덮는다
  cobbleBlock(m, {
    x: O + (T + RUN) / 2,
    z: O + T / 2,
    w: RUN - T,
    d: T + 0.06,
    h: 0.13,
    y: capY,
    color: STONE,
    top: STONE_TOP,
    cham: 0.26,
    taper: 0.95,
  });
  cobbleBlock(m, {
    x: O + T / 2,
    z: O + (T + RUN) / 2,
    w: T + 0.06,
    d: RUN - T,
    h: 0.13,
    y: capY,
    color: STONE_D,
    top: STONE_TOP,
    cham: 0.26,
    taper: 0.95,
  });
  cobbleBlock(m, { x: O + T / 2, z: O + T / 2, w: T + 0.06, d: T + 0.06, h: 0.14, y: capY, color: STONE, top: STONE_TOP, cham: 0.3, taper: 0.93 });
  return finish(m, { radius: 0.62, kind: 'stonecorner' });
}

/** 작은 돌무더기 — 그림 1행 첫 번째: 아래 3덩이 + 위 3덩이 */
export function rubblePile(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const lower = [-0.34, 0, 0.34];
  lower.forEach((x, i) => {
    rock(m, { x, z: rand(rng, -0.12, 0.12), r: 0.26, h: rand(rng, 0.26, 0.34), sides: 5, seed: seed + i, color: STONE });
  });
  const upper = [-0.2, 0.16];
  upper.forEach((x, i) => {
    rock(m, { x, y: 0.29, z: rand(rng, -0.1, 0.1), r: 0.23, h: rand(rng, 0.22, 0.3), sides: 5, seed: seed + 11 + i, color: STONE_D });
  });
  rock(m, { x: -0.02, y: 0.55, r: 0.19, h: 0.2, sides: 5, seed: seed + 21, color: STONE });
  return finish(m, { radius: 0.55, kind: 'rubble' });
}

// ── Sheet 7 · 3행 : 대문과 아치 ──────────────────
/** 나무 대문 — 그림 3행 1번: 철띠 두 줄이 지나는 아치형 널문 두 짝 + 구슬머리 돌기둥 */
export function woodGate(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const postX = 1.16;
  // 돌기둥 + 도토리 모양 갓
  for (const s of [-1, 1]) {
    box(m, { x: s * postX, w: 0.28, d: 0.28, h: 1.62, color: STONE, top: STONE_D });
    box(m, { x: s * postX, y: 1.62, w: 0.36, d: 0.36, h: 0.09, color: STONE_D, top: STONE_TOP }); // 갓받침
    tube(m, { x: s * postX, y: 1.71, r: 0.14, r2: 0.12, h: 0.1, seg: 6, color: STONE, cap: false });
    spike(m, { x: s * postX, y: 1.81, r: 0.13, h: 0.17, seg: 6, color: STONE });
  }
  // 문짝 두 짝 — 널판 5장씩, 위가 완만한 아치
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = s * (0.14 + i * 0.21);
      const t = (Math.abs(x) - 0.14) / 0.84;
      box(m, {
        x,
        z: 0,
        w: 0.2,
        d: 0.09,
        h: 1.56 - t * t * 0.42,
        color: i % 2 ? WOOD : '#d5b485',
      });
    }
    // 철띠 2줄 (앞으로 튀어나오게 — 그래야 잉크 선이 생긴다)
    for (const y of [0.34, 1.02]) {
      box(m, { x: s * 0.58, z: 0.055, y, w: 0.94, d: 0.05, h: 0.09, color: IRON });
    }
    // 손잡이
    box(m, { x: s * 0.19, z: 0.06, y: 0.78, w: 0.07, d: 0.04, h: 0.17, color: IRON_L });
  }
  return finish(m, { radius: 1.35, kind: 'woodgate' });
}

/** 작은 아치 대문 — 그림 3행 2번: 반원 머리 널문 두 짝 + 각진 갓돌 기둥 + 고리 손잡이 */
export function archGate(seed = 1, opt = {}) {
  const m = mesh();
  const postX = 0.92;
  for (const s of [-1, 1]) {
    box(m, { x: s * postX, w: 0.26, d: 0.28, h: 1.56, color: STONE, top: STONE_D });
    box(m, { x: s * postX, y: 1.56, w: 0.33, d: 0.35, h: 0.13, color: STONE_D, top: STONE_TOP });
  }
  // 문짝 — 널판 4장씩, 위가 반원
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = s * (0.1 + i * 0.18);
      const t = Math.abs(x) / 0.72;
      box(m, { x, w: 0.17, d: 0.08, h: 1.06 + Math.sqrt(Math.max(0, 1 - t * t * 0.92)) * 0.52, color: i % 2 ? WOOD : '#d5b485' });
    }
    // 경첩 띠 — 기둥 쪽으로 뻗는다
    for (const y of [0.3, 1.06]) {
      box(m, { x: s * 0.44, z: 0.05, y, w: 0.78, d: 0.045, h: 0.08, color: IRON });
    }
  }
  // 고리 손잡이
  const ring = mesh();
  tube(ring, { r: 0.075, h: 0.03, seg: 7, color: IRON_L, cap: false });
  merge(m, ring, { rx: Math.PI / 2, tx: 0.17, ty: 0.88, tz: 0.07 });
  return finish(m, { radius: 1.0, kind: 'archgate' });
}

/** 들문 — 그림 2행 2번: 갓 씌운 각기둥 두 개 사이에 X 버팀대를 댄 낮은 문짝 한 짝 */
export function fieldGate(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const span = opt.span || 1.9;
  const postX = span / 2;
  const H = 1.0;
  // 네모 기둥 + 넓적한 갓
  for (const s of [-1, 1]) {
    box(m, { x: s * postX, w: 0.19, d: 0.19, h: H, color: WOOD, top: DARK });
    box(m, { x: s * postX, y: H, w: 0.27, d: 0.27, h: 0.08, color: DARK, top: '#e2c295' });
  }
  // 문짝 틀 — 위아래 가로살 + 양옆 세로살
  const gw = span - 0.28;
  const y0 = 0.24;
  const y1 = 0.8;
  for (const y of [y0, y1]) box(m, { y, z: 0.02, w: gw, d: 0.07, h: 0.1, color: WOOD, ry: rand(rng, -0.01, 0.01) });
  for (const s of [-1, 1]) box(m, { x: s * (gw / 2 - 0.05), y: y0, z: 0.02, w: 0.1, d: 0.07, h: y1 - y0 + 0.1, color: WOOD });
  // X 버팀대 — 앞으로 조금 튀어나와야 널판 위에 잉크 선이 선다
  const ix = gw - 0.14;
  const iy = y1 - y0;
  const L = Math.hypot(ix, iy);
  for (const s of [-1, 1]) {
    const br = mesh();
    box(br, { y: -0.045, w: L, d: 0.06, h: 0.09, color: '#d5b485' });
    merge(m, br, { rz: s * Math.atan2(iy, ix), ty: (y0 + y1) / 2 + 0.05, tz: 0.07 });
  }
  return finish(m, { radius: span * 0.55, kind: 'fieldgate' });
}

/** 널문 — 그림 3행 아래: 위가 둥근 널문 + 철제 경첩 띠 두 줄 + 고리 손잡이 */
export function plankDoor(seed = 1, opt = {}) {
  const m = mesh();
  const W = opt.w || 0.94;
  const H = opt.h || 1.9;
  const R = W / 2;
  const SH = Math.max(0.02, H - R); // 아치가 시작되는 어깨 높이
  const archY = (x) => SH + Math.sqrt(Math.max(0, 1 - (x / R) * (x / R))) * R;
  // 널판 5장 — 각 널의 위 끝을 아치 곡선에 맞춰 비스듬히 자른다
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x0 = -R + (W / n) * i + 0.008;
    const x1 = -R + (W / n) * (i + 1) - 0.008;
    prismXY(m, {
      z: 0,
      d: 0.1,
      color: i % 2 ? WOOD : '#d5b485',
      bottom: false,
      pts: [
        [x0, 0],
        [x1, 0],
        [x1, archY(x1)],
        [x0, archY(x0)],
      ],
    });
  }
  // 철제 경첩 띠 두 줄 — 널판보다 앞으로 나와야 잉크 선이 생긴다
  for (const y of [0.3, 1.24]) {
    box(m, { x: -R * 0.12, y, z: 0.075, w: W * 0.82, d: 0.05, h: 0.085, color: IRON });
  }
  // 경첩 축 — 왼쪽 세로 판
  box(m, { x: -R + 0.05, y: 0.24, z: 0.075, w: 0.09, d: 0.05, h: 1.12, color: IRON });
  // 고리 손잡이 — 작은 받침판 + 앞으로 세운 고리
  box(m, { x: R * 0.62, y: 0.86, z: 0.075, w: 0.09, d: 0.04, h: 0.09, color: IRON });
  const ring = mesh();
  tube(ring, { r: 0.1, h: 0.028, seg: 9, color: IRON_L, cap: false });
  merge(m, ring, { rx: Math.PI / 2, tx: R * 0.62, ty: 0.78, tz: 0.115 });
  return finish(m, { radius: W * 0.7, kind: 'plankdoor' });
}

/** 민무늬 아치 문간 — 그림 3행 아래 왼쪽: 벽에 끼워 넣는, 장식 없는 아치 문짝 + 돌 문선 */
export function plankDoorway(seed = 1, opt = {}) {
  const m = mesh();
  const W = opt.w || 0.98;
  const H = opt.h || 1.95;
  const T = 0.15; // 문선 폭
  const inner = archPts(W, H, 7);
  const outer = archPts(W + T * 2, H + T, 7);
  // 문선 — 안쪽 테두리와 바깥 테두리를 이어 붙인 납작한 돌 띠 (아래 문지방 변은 건너뛴다)
  const N = inner.length;
  const frame = mesh();
  for (let i = 1; i < N; i++) {
    const j = (i + 1) % N;
    quad(frame, [inner[i][0], inner[i][1], 0], [outer[i][0], outer[i][1], 0], [outer[j][0], outer[j][1], 0], [inner[j][0], inner[j][1], 0], STONE, {
      soft: true,
    });
  }
  merge(m, frame, { tz: 0.06 });
  // 문선 두께 — 앞으로 살짝 튀어나온 옆면이 있어야 문간이 벽에서 도드라진다
  for (let i = 1; i < N; i++) {
    const j = (i + 1) % N;
    quad(m, [outer[i][0], outer[i][1], 0.06], [outer[i][0], outer[i][1], -0.02], [outer[j][0], outer[j][1], -0.02], [outer[j][0], outer[j][1], 0.06], STONE_D);
  }
  // 안쪽으로 물러난 민무늬 아치 문짝
  prismXY(m, { z: -0.06, d: 0.07, color: WOOD, back: DARK, bottom: false, pts: inner });
  return finish(m, { radius: (W + T * 2) * 0.6, kind: 'plankdoorway' });
}

/** 돌 아치 — 그림 3행 3번: 네 켜짜리 다리 + 홍예돌 9개(가운데 이맛돌) + 담쟁이 */
export function stoneArch(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const R = 1.02;
  const legTop = 1.5;
  // 다리 — 돌 4켜씩
  for (const s of [-1, 1]) {
    for (let c = 0; c < 4; c++) {
      box(m, {
        x: s * R,
        y: c * (legTop / 4),
        w: 0.44,
        d: 0.44,
        h: legTop / 4,
        color: c % 2 ? STONE : STONE_D,
        top: STONE_TOP,
        ry: rand(rng, -0.03, 0.03),
      });
    }
  }
  // 홍예 — 반원을 9조각으로
  const segs = 9;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI * (i / segs);
    const a1 = Math.PI * ((i + 1) / segs);
    const x0 = Math.cos(Math.PI - a0) * R;
    const y0 = legTop + Math.sin(a0) * R;
    const x1 = Math.cos(Math.PI - a1) * R;
    const y1 = legTop + Math.sin(a1) * R;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const key = i === 4; // 이맛돌은 조금 크고 색이 다르다
    const piece = mesh();
    box(piece, { w: key ? 0.5 : 0.4, d: 0.44, h: len * 1.06, color: key ? STONE_TOP : i % 2 ? STONE : STONE_D, top: STONE_TOP });
    merge(m, piece, { rz: Math.atan2(-(x1 - x0), y1 - y0), tx: x0, ty: y0 });
  }
  // 담쟁이 — 오른쪽 다리를 타고 올라 아치 왼쪽으로 넘어간다.
  // 잎은 얇은 삼각형(양면) 한 장씩이라 그림처럼 윤곽선만 남는다.
  const ivy = [
    [1.18, 0.45],
    [1.22, 1.0],
    [1.14, 1.55],
    [0.98, 2.12],
    [-1.16, 1.25],
    [-1.0, 1.98],
  ];
  for (let i = 0; i < ivy.length; i++) {
    const rnd = makeRng(seed + 30 + i);
    for (let k = 0; k < 3; k++) {
      const a = rand(rnd, -1.1, 1.1);
      const L = rand(rnd, 0.1, 0.16);
      const cx = ivy[i][0] + rand(rnd, -0.06, 0.06);
      const cy = ivy[i][1] + rand(rnd, -0.08, 0.08);
      tri(
        m,
        [cx, cy, 0.24],
        [cx + Math.cos(a) * L, cy + Math.sin(a) * L, 0.24 + rand(rnd, 0.02, 0.1)],
        [cx + Math.cos(a + 0.9) * L, cy + Math.sin(a + 0.9) * L, 0.24 + rand(rnd, 0.02, 0.1)],
        k % 2 ? P.leafDark : P.leaf,
        { double: true }
      );
    }
  }
  return finish(m, { radius: 1.3, kind: 'stonearch' });
}

// ── Sheet 7 · 3행 : 가로등 ──────────────────────
/** 가로등 A — 그림 3행 첫 번째 등: 나팔 밑동 + 마디 + 사각 등롱 + 피라미드 지붕 + 뾰족 장식 */
export function lampPostA(seed = 1, opt = {}) {
  const m = mesh();
  const h = opt.h || 1.3;
  tube(m, { r: 0.17, r2: 0.085, h: 0.3, seg: 6, color: IRON, cap: false }); // 나팔 밑동
  tube(m, { y: 0.3, r: 0.095, h: 0.07, seg: 6, color: IRON_L, cap: false }); // 밑동 띠
  tube(m, { y: 0.37, r: 0.055, r2: 0.042, h, seg: 6, color: IRON, cap: false }); // 기둥
  tube(m, { y: 0.37 + h, r: 0.075, r2: 0.06, h: 0.09, seg: 6, color: IRON_L }); // 등 아래 마디
  const ly = 0.37 + h + 0.09;
  box(m, { y: ly, w: 0.3, d: 0.3, h: 0.045, color: IRON_L, top: IRON }); // 등롱 받침 테
  // 등롱 — seg 4 + soft:false 로 네 귀퉁이에 잉크 선이 서게 한다
  tube(m, { y: ly + 0.045, r: 0.16, r2: 0.125, h: 0.27, seg: 4, ry: Math.PI / 4, color: P.lanternGlow, cap: false, soft: false });
  box(m, { y: ly + 0.315, w: 0.31, d: 0.31, h: 0.04, color: IRON_L, top: IRON }); // 윗 테
  spike(m, { y: ly + 0.355, r: 0.2, h: 0.16, seg: 4, ry: Math.PI / 4, color: IRON }); // 피라미드 지붕
  spike(m, { y: ly + 0.5, r: 0.035, h: 0.13, seg: 4, color: IRON_L }); // 꼭지 장식
  return finish(m, { radius: 0.2, kind: 'lamp' });
}

/** 가로등 B — 그림 3행 두 번째 등: 육각 등롱 + 종 모양 지붕 + 기둥 중간 띠 */
export function lampPostB(seed = 1, opt = {}) {
  const m = mesh();
  const h = opt.h || 1.25;
  tube(m, { r: 0.15, r2: 0.08, h: 0.26, seg: 6, color: IRON, cap: false });
  tube(m, { y: 0.26, r: 0.09, h: 0.06, seg: 6, color: IRON_L, cap: false });
  tube(m, { y: 0.32, r: 0.05, r2: 0.04, h, seg: 6, color: IRON, cap: false });
  tube(m, { y: 0.32 + h * 0.55, r: 0.06, h: 0.05, seg: 6, color: IRON_L, cap: false }); // 중간 띠
  const ly = 0.32 + h;
  tube(m, { y: ly, r: 0.06, r2: 0.14, h: 0.08, seg: 6, color: IRON_L, cap: false }); // 벌어지는 목
  tube(m, { y: ly + 0.08, r: 0.155, r2: 0.115, h: 0.24, seg: 6, color: P.lanternGlow, cap: false, soft: false });
  tube(m, { y: ly + 0.32, r: 0.18, h: 0.035, seg: 6, color: IRON_L });
  spike(m, { y: ly + 0.355, r: 0.19, h: 0.14, seg: 6, color: IRON, skirt: 0.02 });
  spike(m, { y: ly + 0.49, r: 0.03, h: 0.1, seg: 4, color: IRON_L });
  return finish(m, { radius: 0.19, kind: 'lamp' });
}

/** 구슬 가로등 — 그림 3행 네 번째 등: 매끈한 유리구 하나 */
export function globeLamp(seed = 1, opt = {}) {
  const m = mesh();
  const h = opt.h || 1.3;
  tube(m, { r: 0.16, r2: 0.085, h: 0.28, seg: 6, color: IRON, cap: false });
  tube(m, { y: 0.28, r: 0.09, h: 0.06, seg: 6, color: IRON_L, cap: false });
  tube(m, { y: 0.34, r: 0.055, r2: 0.04, h, seg: 6, color: IRON, cap: false });
  tube(m, { y: 0.34 + h, r: 0.07, r2: 0.055, h: 0.07, seg: 6, color: IRON_L }); // 구 받침
  blobSphere(m, {
    y: 0.34 + h + 0.28,
    rx: 0.21,
    ry: 0.22,
    rz: 0.21,
    seg: 7,
    rings: 4,
    color: P.lanternGlow,
    wob: 0,
    seed: seed + 1,
  });
  return finish(m, { radius: 0.22, kind: 'globelamp' });
}

/** 굽은목 가로등 — 그림 3행 다섯 번째: 곧은 기둥 + 팔 + 버팀대 + 매달린 등롱 */
export function swanNeckLamp(seed = 1, opt = {}) {
  const m = mesh();
  const h = opt.h || 1.85;
  tube(m, { r: 0.17, r2: 0.09, h: 0.3, seg: 6, color: IRON, cap: false });
  tube(m, { y: 0.3, r: 0.095, h: 0.07, seg: 6, color: IRON_L, cap: false });
  tube(m, { y: 0.37, r: 0.06, r2: 0.05, h, seg: 6, color: IRON, cap: false });
  const top = 0.37 + h;
  spike(m, { y: top, r: 0.085, h: 0.14, seg: 4, ry: Math.PI / 4, color: IRON_L }); // 머리 장식
  // 가로 팔
  box(m, { x: 0.28, y: top - 0.1, w: 0.62, d: 0.055, h: 0.06, color: IRON });
  // 대각 버팀대
  const brace = mesh();
  box(brace, { w: 0.05, d: 0.05, h: 0.36, color: IRON });
  merge(m, brace, { rz: -0.82, tx: 0.06, ty: top - 0.4 });
  knob(m, { x: 0.56, y: top - 0.07, r: 0.055, color: IRON_L });
  // 매달린 등롱
  const lx = 0.56;
  box(m, { x: lx, y: top - 0.25, w: 0.03, d: 0.03, h: 0.19, color: IRON_L }); // 고리
  box(m, { x: lx, y: top - 0.29, w: 0.26, d: 0.26, h: 0.04, color: IRON_L, top: IRON });
  spike(m, { x: lx, y: top - 0.29, r: 0.17, h: 0.14, seg: 4, ry: Math.PI / 4, color: IRON }); // 지붕
  tube(m, {
    x: lx,
    y: top - 0.57,
    r: 0.115,
    r2: 0.135,
    h: 0.26,
    seg: 4,
    ry: Math.PI / 4,
    color: P.lanternGlow,
    cap: false,
    soft: false,
  });
  box(m, { x: lx, y: top - 0.62, w: 0.24, d: 0.24, h: 0.05, color: IRON_L, top: IRON }); // 아래 테
  return finish(m, { radius: 0.4, kind: 'swanlamp' });
}

// ── Sheet 7 · 3행 : 분수 ────────────────────────
/** 2단 분수 — 그림 오른쪽 아래: 팔각 돌 수반 + 기둥 + 윗대야 + 물기둥 */
export function fountainTier(seed = 1, opt = {}) {
  const m = mesh();
  const R = 1.02;
  const side = 2 * R * Math.tan(Math.PI / 8) * 1.04;
  // 팔각 수반 — 돌 8덩이를 빙 둘러 세운다(그림처럼 줄눈이 보이게)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    box(m, {
      x: Math.cos(a) * R,
      z: Math.sin(a) * R,
      w: side,
      d: 0.24,
      h: 0.36,
      ry: Math.PI / 2 - a,
      color: i % 2 ? STONE : STONE_D,
      top: STONE_TOP,
    });
  }
  waterDisc(m, { y: 0.27, r: R - 0.16, seg: 8, color: WATER });
  // 가운데 기둥
  tube(m, { y: 0.24, r: 0.3, r2: 0.19, h: 0.16, seg: 8, color: STONE_D, cap: false });
  tube(m, { y: 0.4, r: 0.15, r2: 0.13, h: 0.34, seg: 8, color: STONE, cap: false });
  tube(m, { y: 0.74, r: 0.2, r2: 0.17, h: 0.07, seg: 8, color: STONE_D, cap: false }); // 마디
  // 윗대야
  tube(m, { y: 0.81, r: 0.2, r2: 0.6, h: 0.24, seg: 9, color: STONE, cap: false });
  tube(m, { y: 1.05, r: 0.62, r2: 0.58, h: 0.08, seg: 9, color: STONE_D, cap: false }); // 두툼한 테
  waterDisc(m, { y: 1.08, r: 0.53, seg: 9, color: WATER });
  // 물 뿜는 꼭지
  tube(m, { y: 1.1, r: 0.09, r2: 0.06, h: 0.16, seg: 6, color: STONE_D });
  tube(m, { y: 1.26, r: 0.075, h: 0.05, seg: 6, color: STONE, cap: false });
  // 물기둥 — 위로 갈수록 갈라지는 잎사귀 모양
  blobSphere(m, { y: 1.52, rx: 0.11, ry: 0.24, rz: 0.11, seg: 5, rings: 3, color: '#cfe9ee', wob: 0.16, seed: seed + 2 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    tri(
      m,
      [Math.cos(a) * 0.16, 1.5, Math.sin(a) * 0.16],
      [Math.cos(a) * 0.22, 1.42, Math.sin(a) * 0.22],
      [Math.cos(a) * 0.34, 1.62, Math.sin(a) * 0.34],
      '#cfe9ee',
      { double: true }
    );
  }
  return finish(m, { radius: 1.1, kind: 'fountain' });
}

/** 낮은 물 뿜는 샘 — 그림 오른쪽 위: 두 단 낮은 돌단 + 굵은 물줄기 하나 + 물방울 */
export function fountainLow(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  tube(m, { r: 0.92, r2: 0.86, h: 0.16, seg: 9, color: STONE_D, cap: false });
  tube(m, { y: 0.16, r: 0.8, r2: 0.76, h: 0.14, seg: 9, color: STONE, cap: false });
  waterDisc(m, { y: 0.29, r: 0.68, seg: 9, color: WATER });
  // 촛불처럼 솟는 물줄기
  tube(m, { y: 0.26, r: 0.14, r2: 0.09, h: 0.42, seg: 6, color: '#cfe9ee', cap: false });
  spike(m, { y: 0.68, r: 0.09, h: 0.26, seg: 6, color: '#cfe9ee' });
  // 튀는 물방울
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    const rr = rand(rng, 0.3, 0.5);
    tri(
      m,
      [Math.cos(a) * rr, 0.62 + rand(rng, 0, 0.2), Math.sin(a) * rr],
      [Math.cos(a) * rr + 0.05, 0.68 + rand(rng, 0, 0.2), Math.sin(a) * rr],
      [Math.cos(a) * rr + 0.02, 0.82 + rand(rng, 0, 0.2), Math.sin(a) * rr + 0.03],
      WATER_D,
      { double: true }
    );
  }
  return finish(m, { radius: 0.92, kind: 'fountainlow' });
}

// ── Sheet 7 · 4행 : 석상 · 게시판 · 표지 ─────────
/** 기사 석상 — 그림 4행 1번: 두 단 대좌 + 투구 쓴 콩 기사 + 칼끝을 아래로 짚은 검 */
export function statue(seed = 1, opt = {}) {
  const m = mesh();
  // 두 단 대좌 — 그림처럼 기사 어깨너비의 1.6배쯤으로 좁게
  box(m, { w: 0.94, d: 0.94, h: 0.14, color: STONE_D, top: STONE });
  box(m, { y: 0.14, w: 0.8, d: 0.8, h: 0.1, color: STONE, top: STONE_TOP });
  tube(m, { y: 0.24, r: 0.36, r2: 0.31, h: 0.44, seg: 4, ry: Math.PI / 4, color: STONE, cap: false, soft: false });
  box(m, { y: 0.68, w: 0.78, d: 0.78, h: 0.09, color: STONE_D, top: STONE_TOP });
  const G = 0.77; // 기사가 딛고 선 높이

  // 다리 · 장화
  box(m, { y: G, w: 0.52, d: 0.38, h: 0.11, color: STONE_D, top: STONE });
  for (const s of [-1, 1]) box(m, { x: s * 0.15, y: G + 0.11, w: 0.2, d: 0.22, h: 0.36, color: STONE });
  // 무릎까지 내려온 겉옷
  tube(m, { y: G + 0.42, r: 0.36, r2: 0.3, h: 0.42, seg: 5, color: STONE, cap: false, soft: false });
  tube(m, { y: G + 0.84, r: 0.31, h: 0.09, seg: 5, color: STONE_D, cap: false, soft: false }); // 허리띠
  // 콩 모양 상체
  blobSphere(m, { y: G + 1.22, rx: 0.34, ry: 0.4, rz: 0.26, seg: 6, rings: 3, color: STONE, wob: 0.03, seed: seed + 1 });
  // 어깨 갑옷
  for (const s of [-1, 1]) tube(m, { x: s * 0.31, y: G + 1.33, r: 0.16, r2: 0.11, h: 0.13, seg: 5, color: STONE_D });
  // 팔 — 앞으로 모아 검 자루를 쥔다
  for (const s of [-1, 1]) {
    const arm = mesh();
    tube(arm, { r: 0.085, h: 0.5, seg: 4, color: STONE, cap: false });
    merge(m, arm, { rz: s * 0.26, rx: 0.3, tx: s * 0.28, ty: G + 1.28, tz: 0.08 });
  }
  // 투구 — 평평한 대투구에 십자 눈구멍
  tube(m, { y: G + 1.56, r: 0.2, r2: 0.18, h: 0.32, seg: 4, ry: Math.PI / 4, color: STONE, cap: true, capColor: STONE_D, soft: false });
  box(m, { z: 0.17, y: G + 1.63, w: 0.045, d: 0.04, h: 0.2, color: STONE_D });
  box(m, { z: 0.17, y: G + 1.71, w: 0.17, d: 0.04, h: 0.045, color: STONE_D });

  // 검 — 칼끝을 땅으로 짚고 손잡이는 가슴 앞. 겉옷보다 앞으로 빼야 실루엣에 걸린다
  prismXY(m, {
    z: 0.42,
    y: G,
    d: 0.06,
    color: STONE_D,
    pts: [
      [0, 0],
      [0.07, 0.2],
      [0.07, 1.0],
      [-0.07, 1.0],
      [-0.07, 0.2],
    ],
  });
  box(m, { z: 0.42, y: G + 1.0, w: 0.4, d: 0.08, h: 0.07, color: STONE }); // 코등이
  box(m, { z: 0.42, y: G + 1.07, w: 0.09, d: 0.07, h: 0.16, color: STONE_D }); // 자루
  spike(m, { z: 0.42, y: G + 1.23, r: 0.065, h: 0.1, seg: 4, color: STONE }); // 자루 끝
  return finish(m, { radius: 0.55, kind: 'statue' });
}

/** 게시판 — 그림 4행: 굵은 기둥 2개 + 틀 짠 판 + 아래 선반 + 널지붕 + 압정으로 붙인 종이 3장 */
export function noticeBoard(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const W = 1.3;
  for (const s of [-1, 1]) box(m, { x: s * (W / 2 - 0.05), w: 0.14, d: 0.14, h: 1.44, color: DARK });
  box(m, { y: 0.66, z: -0.02, w: W - 0.16, d: 0.06, h: 0.68, color: '#e5cfa6' }); // 판
  // 틀 — 네 변을 얇은 각재로
  box(m, { y: 0.62, z: 0.03, w: W - 0.06, d: 0.05, h: 0.06, color: DARK });
  box(m, { y: 1.3, z: 0.03, w: W - 0.06, d: 0.05, h: 0.06, color: DARK });
  for (const s of [-1, 1]) box(m, { x: s * (W / 2 - 0.09), y: 0.62, z: 0.03, w: 0.06, d: 0.05, h: 0.74, color: DARK });
  box(m, { y: 0.52, z: 0.02, w: W - 0.1, d: 0.14, h: 0.08, color: WOOD, top: '#e2c295' }); // 아래 선반
  // 널지붕 — 용마루가 판을 따라 x축으로 뻗는다
  gable(m, { y: 1.36, w: W - 0.02, d: 0.42, h: 0.2, color: DARK, eave: 0.1 });
  box(m, { y: 1.54, w: W + 0.2, d: 0.07, h: 0.05, color: '#9c7a4e' }); // 용마루
  // 붙어 있는 종이
  const paperPos = [
    [-0.3, 0.86],
    [0.06, 0.92],
    [0.3, 0.74],
  ];
  for (const p of paperPos) {
    panel(m, { x: p[0], y: p[1], z: 0.045, w: rand(rng, 0.22, 0.3), h: rand(rng, 0.24, 0.32), color: PAPER, ry: rand(rng, -0.06, 0.06) });
  }
  return finish(m, { radius: 0.7, kind: 'notice' });
}

/** 나무 표지판 — 그림 4행: 널 3장을 겹쳐 박은 판 + 위로 튀어나온 기둥 + 발치 풀 */
export function signBoard(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const post = mesh();
  box(post, { w: 0.1, d: 0.1, h: 1.14, color: DARK });
  merge(m, post, { rz: 0.05, tx: 0.02 });
  for (let i = 0; i < 3; i++) {
    box(m, {
      z: 0.03,
      y: 0.56 + i * 0.17,
      w: rand(rng, 0.68, 0.74),
      d: 0.05,
      h: 0.16,
      color: i % 2 ? WOOD : '#d5b485',
      ry: rand(rng, -0.03, 0.03),
    });
  }
  tuft(m, { x: -0.03, z: 0.07, h: 0.2, n: 3, seed: seed + 3, spread: 0.07 });
  return finish(m, { radius: 0.38, kind: 'sign' });
}

/** 화살표 이정표 — 그림 4행: 방향을 가리키는 화살 널판 3장이 한 기둥에 달린 것 */
export function signArrowPost(seed = 1, opt = {}) {
  const m = mesh();
  const w = 0.62;
  const h = 0.2;
  box(m, { w: 0.11, d: 0.11, h: 1.32, color: DARK });
  const rows = [
    { y: 1.0, dir: 1, yaw: -0.14 },
    { y: 0.74, dir: 1, yaw: 0.16 },
    { y: 0.48, dir: -1, yaw: 0.34 },
  ];
  for (const r of rows) {
    const d = r.dir;
    prismXY(m, {
      y: r.y,
      z: 0.02,
      d: 0.05,
      color: WOOD,
      ry: r.yaw,
      pts: [
        [-d * w * 0.5, -h / 2],
        [d * w * 0.22, -h / 2],
        [d * w * 0.5, 0],
        [d * w * 0.22, h / 2],
        [-d * w * 0.5, h / 2],
      ],
    });
  }
  return finish(m, { radius: 0.4, kind: 'signpost' });
}

/** 매다는 간판 — 그림 4행: 기둥 + 가로대 + 고리 2개로 매단 방패꼴 간판 */
export function hangingSign(seed = 1, opt = {}) {
  const m = mesh();
  box(m, { w: 0.12, d: 0.12, h: 1.9, color: DARK });
  box(m, { x: -0.34, y: 1.62, w: 0.86, d: 0.11, h: 0.11, color: WOOD }); // 가로대
  box(m, { x: -0.76, y: 1.6, w: 0.09, d: 0.14, h: 0.15, color: DARK }); // 가로대 끝 장식
  const brace = mesh();
  box(brace, { w: 0.05, d: 0.05, h: 0.3, color: DARK });
  merge(m, brace, { rz: 0.75, tx: -0.06, ty: 1.35 }); // 대각 버팀대
  for (const x of [-0.58, -0.14]) box(m, { x, y: 1.44, w: 0.03, d: 0.03, h: 0.16, color: IRON }); // 고리 2개
  // 방패꼴 간판
  prismXY(m, {
    x: -0.36,
    y: 0.86,
    z: 0,
    d: 0.05,
    color: '#e5cfa6',
    pts: [
      [-0.24, 0.58],
      [0.24, 0.58],
      [0.24, 0.12],
      [0, -0.12],
      [-0.24, 0.12],
    ],
  });
  box(m, { x: -0.36, y: 1.15, z: 0.03, w: 0.5, d: 0.04, h: 0.05, color: DARK }); // 위 테
  panel(m, { x: -0.36, y: 1.0, z: 0.04, w: 0.14, h: 0.18, color: DARK }); // 문장
  return finish(m, { radius: 0.5, kind: 'hangsign' });
}

/** 우체통 — 그림 4행: 반원 지붕 통 + 앞문 투입구 + 위 손잡이 + 갈라진 나무 기둥 */
export function mailPost(seed = 1, opt = {}) {
  const m = mesh();
  // 아래로 갈라지는 기둥 두 갈래
  for (const s of [-1, 1]) {
    const leg = mesh();
    box(leg, { w: 0.1, d: 0.11, h: 0.92, color: DARK });
    merge(m, leg, { rz: -s * 0.055, tx: s * 0.045 });
  }
  // 반원 지붕 몸통 — 옆에서 본 단면(네모 + 둥근 머리)을 x 방향으로 뽑는다
  prismXY(m, {
    y: 0.9,
    d: 0.42,
    ry: Math.PI / 2,
    color: '#c9d2d6',
    pts: [
      [-0.19, 0],
      [0.19, 0],
      [0.19, 0.22],
      [0.13, 0.34],
      [0, 0.4],
      [-0.13, 0.34],
      [-0.19, 0.22],
    ],
  });
  // 앞문 + 투입구
  box(m, { z: 0.2, y: 0.96, w: 0.32, d: 0.04, h: 0.28, color: '#b7c1c6' });
  box(m, { z: 0.23, y: 1.03, w: 0.17, d: 0.035, h: 0.06, color: IRON_L });
  // 위 손잡이 · 깃발
  knob(m, { y: 1.3, z: 0.05, r: 0.05, color: IRON_L });
  box(m, { x: 0.21, y: 1.06, w: 0.04, d: 0.04, h: 0.22, color: '#c2603a' });
  panel(m, { x: 0.25, y: 1.2, w: 0.14, h: 0.11, color: '#c2603a' });
  return finish(m, { radius: 0.26, kind: 'mailpost' });
}

// ── Sheet 7 · 5행 : 화분 ────────────────────────
/** 긴 화분 통 — 그림 5행 1번: 위가 벌어진 여물통 모양 + 가는 다리 4개 + 꽃 */
export function planterTrough(seed = 1, opt = {}) {
  const m = mesh();
  const W = 1.1;
  // 가는 철제 다리
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = mesh();
      box(leg, { w: 0.045, d: 0.045, h: 0.19, color: IRON });
      merge(m, leg, { rz: sx * 0.22, tx: sx * (W / 2 - 0.14), tz: sz * 0.13 });
    }
  }
  // 위로 벌어지는 통 — 아래보다 위가 넓다
  const body = mesh();
  const b0 = 0.16;
  const b1 = 0.24;
  const w0 = W * 0.86;
  const w1 = W;
  const L = [
    [-w0 / 2, 0, b0],
    [w0 / 2, 0, b0],
    [w0 / 2, 0, -b0],
    [-w0 / 2, 0, -b0],
  ];
  const U = [
    [-w1 / 2, 0.34, b1],
    [w1 / 2, 0.34, b1],
    [w1 / 2, 0.34, -b1],
    [-w1 / 2, 0.34, -b1],
  ];
  quad(body, L[0], L[1], U[1], U[0], WOOD);
  quad(body, L[1], L[2], U[2], U[1], WOOD);
  quad(body, L[2], L[3], U[3], U[2], WOOD);
  quad(body, L[3], L[0], U[0], U[3], WOOD);
  quad(body, U[0], U[1], U[2], U[3], SOIL); // 흙
  merge(m, body, { ty: 0.18 });
  box(m, { y: 0.5, w: W + 0.05, d: b1 * 2 + 0.05, h: 0.05, color: DARK, top: SOIL }); // 테두리
  flowerBed(m, { y: 0.55, rx: 0.46, rz: 0.16, ry: 0.13, n: 6, seed: seed + 4 });
  return finish(m, { radius: 0.6, kind: 'planter' });
}

/** 돌덩이 화분 — 그림 5행 4번: 돌을 두 켜 쌓아 만든 긴 화단 + 꽃 */
export function planterStone(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const W = 1.2;
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < 3; i++) {
      box(m, {
        x: -W / 2 + (W / 3) * (i + 0.5) + rand(rng, -0.02, 0.02),
        y: c * 0.22,
        w: (W / 3) * rand(rng, 0.9, 0.99),
        d: 0.44,
        h: 0.22,
        color: (i + c) % 2 ? STONE : STONE_D,
        top: STONE_TOP,
        ry: rand(rng, -0.05, 0.05),
      });
    }
  }
  box(m, { y: 0.44, w: W + 0.06, d: 0.5, h: 0.07, color: STONE_TOP, top: SOIL }); // 갓돌 + 흙
  flowerBed(m, { y: 0.5, rx: 0.5, rz: 0.17, ry: 0.13, n: 7, seed: seed + 6 });
  return finish(m, { radius: 0.65, kind: 'planter' });
}

/** 통 화분 — 그림 5행 3번: 널을 세운 술통에 테 3줄, 꽃이 넘쳐 나온다 */
export function planterBarrel(seed = 1, opt = {}) {
  const m = mesh();
  // soft:false 로 널 이음매(세로 선)가 서게 한다
  tube(m, { r: 0.23, r2: 0.27, h: 0.34, seg: 8, color: WOOD, cap: false, soft: false });
  tube(m, { y: 0.34, r: 0.27, r2: 0.235, h: 0.36, seg: 8, color: WOOD, cap: false, soft: false });
  for (const y of [0.04, 0.32, 0.63]) tube(m, { y, r: y === 0.32 ? 0.285 : 0.26, h: 0.055, seg: 8, color: DARK, cap: false });
  tube(m, { y: 0.66, r: 0.22, h: 0.03, seg: 8, color: SOIL }); // 흙
  flowerBed(m, { y: 0.69, rx: 0.21, rz: 0.21, ry: 0.14, n: 5, seed: seed + 8 });
  return finish(m, { radius: 0.32, kind: 'planter' });
}

// ── Sheet 7 · 5행 : 볼라드 ──────────────────────
/** 밧줄 볼라드 — 그림 5행 1번: 구슬머리 가는 기둥 2개 + 늘어진 밧줄 */
export function bollardRope(seed = 1, opt = {}) {
  const m = mesh();
  const span = opt.span || 1.5;
  for (const s of [-1, 1]) {
    tube(m, { x: s * span * 0.5, r: 0.055, r2: 0.045, h: 0.62, seg: 5, color: STONE_D, cap: false });
    tube(m, { x: s * span * 0.5, y: 0.6, r: 0.062, h: 0.06, seg: 5, color: ROPE, cap: false });
    knob(m, { x: s * span * 0.5, y: 0.72, r: 0.066, color: STONE });
  }
  sagRope(m, { x0: -span * 0.5, x1: span * 0.5, y0: 0.64, sag: 0.24, r: 0.022, segs: 4 });
  return finish(m, { radius: span * 0.5, kind: 'bollard' });
}

/** 사슬 볼라드 — 그림 5행 2번: 구슬머리 기둥 2개 + 늘어진 사슬 고리 5개 */
export function bollardChain(seed = 1, opt = {}) {
  const m = mesh();
  const span = opt.span || 1.4;
  for (const s of [-1, 1]) {
    tube(m, { x: s * span * 0.5, r: 0.06, r2: 0.048, h: 0.6, seg: 5, color: STONE_D, cap: false });
    tube(m, { x: s * span * 0.5, y: 0.56, r: 0.07, h: 0.07, seg: 5, color: IRON_L, cap: false });
    knob(m, { x: s * span * 0.5, y: 0.71, r: 0.07, color: STONE });
  }
  chainSpan(m, { x0: -span * 0.5, x1: span * 0.5, y0: 0.62, sag: 0.22, links: 5 });
  return finish(m, { radius: span * 0.5, kind: 'bollard' });
}

// ── Sheet 7 : 깃발 ──────────────────────────────
/** 삼각 깃발 줄 — 그림: 창끝 장대 2개 + 늘어진 줄 + 삼각기 4장 */
export function bunting(seed = 1, opt = {}) {
  const m = mesh();
  const span = opt.span || 2.8;
  const H = 2.3;
  for (const s of [-1, 1]) {
    tube(m, { x: s * span * 0.5, r: 0.045, r2: 0.035, h: H, seg: 5, color: DARK, cap: false });
    spike(m, { x: s * span * 0.5, y: H, r: 0.06, h: 0.2, seg: 4, color: IRON_L });
  }
  // 왼쪽이 낮고 오른쪽이 높은 줄
  const x0 = -span * 0.5;
  const x1 = span * 0.5;
  const y0 = H - 0.28;
  const y1 = H - 0.02;
  const sag = 0.3;
  const at = (t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * sag];
  for (let i = 0; i < 5; i++) {
    const a = at(i / 5);
    const b = at((i + 1) / 5);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const s = mesh();
    tube(s, { r: 0.018, h: len, seg: 4, color: DARK, cap: false });
    merge(m, s, { rz: Math.atan2(-(b[0] - a[0]), b[1] - a[1]), tx: a[0], ty: a[1] });
  }
  const cols = ['#d9834a', '#8fb0c4', '#e0b45c', '#93b787'];
  for (let i = 0; i < 4; i++) {
    const c = at((i + 0.6) / 5.6);
    tri(m, [c[0] - 0.13, c[1], 0], [c[0] + 0.13, c[1], 0], [c[0], c[1] - 0.36, 0], cols[i], { double: true });
  }
  return finish(m, { radius: span * 0.5, kind: 'bunting' });
}

/** 깃대 깃발 — 그림: 구슬 꼭지 장대 + 나부끼는 네모 깃발 */
export function banner(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const H = 2.7;
  tube(m, { r: 0.05, r2: 0.04, h: H, seg: 5, color: DARK, cap: false });
  tube(m, { y: H, r: 0.055, h: 0.05, seg: 5, color: IRON_L, cap: false });
  knob(m, { y: H + 0.12, r: 0.08, color: '#d9b25e' });
  const col = ['#c2603a', '#7f96b8', '#93b787'][randInt(rng, 0, 2)];
  // 나부끼는 천 — 세로 4칸을 사인 곡선 위에 세운다
  const n = 4;
  const L = 1.0;
  const top = H - 0.06;
  const wave = (t) => Math.sin(t * 5.2) * 0.14;
  const drop = (t) => 0.06 + t * 0.24; // 끝으로 갈수록 아래로 처진다
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    quad(
      m,
      [0.04 + L * t0, top - 0.72 - drop(t0), wave(t0)],
      [0.04 + L * t1, top - 0.72 - drop(t1), wave(t1)],
      [0.04 + L * t1, top - drop(t1) * 0.3, wave(t1)],
      [0.04 + L * t0, top - drop(t0) * 0.3, wave(t0)],
      col,
      { double: true }
    );
  }
  return finish(m, { radius: 0.6, kind: 'banner' });
}

/** 늘어뜨린 문장기 두 폭 — 그림: 창끝 장대 + 구슬 달린 가로대 + 아래가 V로 갈라진 천 */
export function pennantPair(seed = 1, opt = {}) {
  const m = mesh();
  const cols = ['#e0d6c0', '#dfe6ea'];
  const emb = ['#c9a24a', '#b8524a'];
  const set = [
    { x: -0.42, h: 2.15, z: 0 },
    { x: 0.42, h: 1.95, z: -0.12 },
  ];
  set.forEach((s, i) => {
    tube(m, { x: s.x, z: s.z, r: 0.04, r2: 0.032, h: s.h, seg: 4, color: DARK, cap: false });
    spike(m, { x: s.x, z: s.z, y: s.h, r: 0.055, h: 0.2, seg: 4, color: IRON_L });
    // 가로대 + 양끝 구슬
    const bar = mesh();
    tube(bar, { r: 0.028, h: 0.62, seg: 4, color: DARK, cap: false });
    merge(m, bar, { rz: Math.PI / 2, tx: s.x + 0.31, ty: s.h - 0.3, tz: s.z });
    for (const e of [-0.31, 0.31]) knob(m, { x: s.x + e, y: s.h - 0.3, z: s.z, r: 0.045, color: WOOD });
    // 천 — 네모 몸통 + 아래 V
    const ty = s.h - 0.33;
    quad(
      m,
      [s.x - 0.24, ty - 0.86, s.z + 0.01],
      [s.x + 0.24, ty - 0.86, s.z + 0.01],
      [s.x + 0.24, ty, s.z + 0.01],
      [s.x - 0.24, ty, s.z + 0.01],
      cols[i],
      { double: true }
    );
    tri(
      m,
      [s.x - 0.24, ty - 0.86, s.z + 0.01],
      [s.x, ty - 1.16, s.z + 0.01],
      [s.x + 0.24, ty - 0.86, s.z + 0.01],
      cols[i],
      { double: true }
    );
    // 문장
    panel(m, { x: s.x, y: ty - 0.42, z: s.z + 0.03, w: 0.18, h: 0.16, color: emb[i] });
  });
  return finish(m, { radius: 0.7, kind: 'pennant' });
}

// ── 지형 시트 : 바위 ────────────────────────────
/** 바위 하나 — 지형 시트: 배가 불룩하고 윗머리가 말려 들어간 납작한 덩어리 + 발치 자갈 3개 */
export function boulder(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const r = opt.r || rand(rng, 0.5, 0.72);
  // 실루엣을 깨는 면 9장. 아래가 안으로 파이고(언더컷) 배가 나온 뒤 윗머리가 다시 좁아진다 —
  // 위로만 곧게 좁아지면 받침대(사다리꼴)처럼 보인다.
  const body = mesh();
  facetRock(body, {
    r,
    rz2: r * rand(rng, 0.8, 0.94),
    sides: 9,
    seed: seed + 1,
    wob: 0.2,
    ridge: 0.11,
    h: r,
    // 층을 셋만 두어 면이 크고 각지게 남는다. 아래는 안으로 파이고(언더컷) 허리가 가장 넓다.
    profile: [
      [0, 0.7],
      [0.4, 1.0],
      [0.78, 0.84],
      [1, 0.44],
    ],
    color: STONE,
    topColor: STONE_TOP,
  });
  // 실제 폭을 재서 가로:세로 = 1.45:1 이 되도록 눌러 준다(카메라가 내려다보므로 조금 더 납작하게)
  const bb = bounds(body);
  merge(m, body, { sy: Math.max(bb.w, bb.d) / 1.45 / bb.h });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rng();
    facetRock(m, {
      x: Math.cos(a) * r * 1.2,
      z: Math.sin(a) * r * 1.1,
      r: r * rand(rng, 0.2, 0.3),
      rz2: r * rand(rng, 0.16, 0.24),
      sides: 5,
      seed: seed + 10 + i,
      wob: 0.2,
      h: r * rand(rng, 0.16, 0.26),
      profile: [
        [0, 0.9],
        [1, 0.55],
      ],
      color: STONE_D,
      topColor: STONE,
    });
  }
  return finish(m, { radius: r * 1.4, kind: 'boulder' });
}

/** 바위 무리 — 지형 시트: 큰 덩어리 하나 + 중간 둘 + 자갈 넷 */
export function boulderCluster(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  rock(m, { x: -0.12, r: 0.6, h: 0.62, sides: 6, seed: seed + 1, color: STONE });
  rock(m, { x: 0.62, z: 0.18, r: 0.36, h: 0.42, sides: 5, seed: seed + 2, color: STONE_D });
  rock(m, { x: 0.24, z: -0.5, r: 0.3, h: 0.3, sides: 5, seed: seed + 3, color: STONE });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    rock(m, {
      x: Math.cos(a) * rand(rng, 0.85, 1.15),
      z: Math.sin(a) * rand(rng, 0.6, 0.95),
      r: rand(rng, 0.13, 0.2),
      h: rand(rng, 0.12, 0.2),
      sides: 5,
      seed: seed + 20 + i,
      color: STONE_D,
    });
  }
  return finish(m, { radius: 1.1, kind: 'boulders' });
}

/** 선돌 무리 — 지형 시트 오른쪽: 폭이 제각각인 판석 3장 + 발치 각진 돌조각 7개 */
export function standingStones(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  // 기둥이 아니라 "판석"이다 — 가장 큰 것이 폭:높이 = 1:2.5, 나머지는 폭을 크게 달리한다
  const cols = [
    { x: -0.86, z: 0.12, h: 1.5, w: 0.56, d: 0.34, slope: 0.36, yaw: 0.28 },
    { x: 0.0, z: -0.18, h: 2.4, w: 0.96, d: 0.52, slope: -0.24, yaw: -0.16 },
    { x: 0.96, z: 0.2, h: 1.08, w: 0.78, d: 0.44, slope: 0.44, yaw: 0.52 },
  ];
  cols.forEach((c, i) => {
    slabStone(m, {
      x: c.x,
      z: c.z,
      w: c.w,
      d: c.d,
      h: c.h,
      sides: 6,
      seed: seed + i * 3 + 1,
      color: STONE,
      topColor: STONE_TOP,
      taper: rand(rng, 0.88, 0.96),
      slope: c.slope, // 꼭대기를 비스듬히 쪼아낸 쐐기 — 톱으로 자른 듯한 평면을 없앤다
      yaw: c.yaw,
    });
  });
  // 발치에 흩어진 각진 돌조각 7개
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    facetRock(m, {
      x: Math.cos(a) * rand(rng, 0.7, 1.45),
      z: Math.sin(a) * rand(rng, 0.34, 0.66),
      r: rand(rng, 0.12, 0.24),
      rz2: rand(rng, 0.1, 0.2),
      sides: 5,
      seed: seed + 40 + i,
      wob: 0.24,
      h: rand(rng, 0.13, 0.26),
      profile: [
        [0, 0.92],
        [1, rand(rng, 0.3, 0.6)],
      ],
      color: STONE_D,
      topColor: STONE,
    });
  }
  return finish(m, { radius: 1.25, kind: 'standingstones' });
}

/** 선돌 하나 — 지형 시트 가운데: 위가 각진 큰 돌기둥 + 발치 잔돌 4개 */
export function monolith(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = opt.h || rand(rng, 2.0, 2.7);
  rock(m, { r: 0.42, h: h * 0.62, sides: 5, seed: seed + 1, color: STONE, flat: 0.92 });
  rock(m, { y: h * 0.62, r: 0.38, h: h * 0.38, sides: 5, seed: seed + 2, color: STONE, topColor: STONE_TOP, flat: 0.8 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.7;
    rock(m, {
      x: Math.cos(a) * rand(rng, 0.6, 0.85),
      z: Math.sin(a) * rand(rng, 0.5, 0.72),
      r: rand(rng, 0.16, 0.26),
      h: rand(rng, 0.16, 0.28),
      sides: 5,
      seed: seed + 50 + i,
      color: STONE_D,
    });
  }
  return finish(m, { radius: 0.8, kind: 'monolith' });
}

/** 돌무더기 — 지형 시트: 둥근 돌 7덩이를 쌓아 올린 낮은 더미 */
export function rockMound(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const base = [
    [-0.62, 0.1],
    [-0.16, -0.16],
    [0.34, 0.14],
    [0.74, -0.06],
  ];
  base.forEach((p, i) => {
    rock(m, { x: p[0], z: p[1], r: rand(rng, 0.28, 0.4), h: rand(rng, 0.26, 0.38), sides: 5, seed: seed + i, color: STONE });
  });
  const top = [
    [-0.34, 0.02],
    [0.12, -0.02],
    [0.5, 0.06],
  ];
  top.forEach((p, i) => {
    rock(m, {
      x: p[0],
      z: p[1],
      y: rand(rng, 0.26, 0.34),
      r: rand(rng, 0.24, 0.34),
      h: rand(rng, 0.24, 0.34),
      sides: 5,
      seed: seed + 20 + i,
      color: STONE_D,
    });
  });
  return finish(m, { radius: 0.9, kind: 'rockmound' });
}

/** 풀 언덕 — 지형 시트: 매끈한 낮은 돔 + 가장자리에 돋은 풀포기 */
export function grassMound(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const r = opt.r || rand(rng, 1.1, 1.5);
  // 높이는 폭(2r)의 0.5배 — 납작한 부침개가 아니라 봉긋한 돔이어야 한다
  const h = r * rand(rng, 0.94, 1.06);
  const rz2 = r * rand(rng, 0.82, 0.95);
  // rings 3 이라야 옆선이 고르게 둥근 사분원을 그린다
  dome(m, { r, rz2, h, seg: 9, rings: 3, color: P.grass, wob: 0.05, seed: seed + 1 });
  // 밑동을 빙 두르는 풀포기 6포기 — 언덕이 땅에서 솟은 것처럼 보이게 한다
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand(rng, -0.24, 0.24);
    tuft(m, {
      x: Math.cos(a) * r * rand(rng, 0.94, 1.04),
      z: Math.sin(a) * rz2 * rand(rng, 0.94, 1.04),
      y: 0,
      h: 0.34,
      n: 3,
      seed: seed + 10 + i,
      spread: 0.11,
    });
  }
  return finish(m, { radius: r, kind: 'grassmound' });
}

/** 흙더미 — 지형 시트: 풀이 거의 없는 납작한 맨흙 둔덕 + 풀싹 몇 개 */
export function dirtMound(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const r = opt.r || rand(rng, 0.75, 1.05);
  // 풀 언덕과 같은 비율 — 높이는 폭(2r)의 0.5배
  const h = r * rand(rng, 0.92, 1.04);
  const rz2 = r * rand(rng, 0.78, 0.92);
  dome(m, { r, rz2, h, seg: 9, rings: 3, color: P.dirt, wob: 0.07, seed: seed + 1 });
  // 밑동을 두르는 풀포기 5포기 — 흙더미라 풀은 발치에만 돋는다
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand(rng, -0.3, 0.3);
    tuft(m, {
      x: Math.cos(a) * r * rand(rng, 0.92, 1.04),
      z: Math.sin(a) * rz2 * rand(rng, 0.92, 1.04),
      y: 0,
      h: 0.3,
      n: 3,
      seed: seed + 20 + i,
      spread: 0.1,
    });
  }
  return finish(m, { radius: r, kind: 'dirtmound' });
}

// ── 지형 시트 : 동굴 · 절벽 · 물가 ───────────────
/** 동굴 입구 — 지형 시트: 진짜 반원 아치 구멍 + 뒤로 물러난 굴 + 모서리 깎은 돌 세 켜 */
export function caveEntrance(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const R = opt.r || 0.7; // 구멍 반너비 (구멍 너비 2R)
  const LEG = R * 2; // 곧은 다리 높이 — 다리 + 반원 = 3R 이라 "높이 = 너비 × 1.5"
  const DEPTH = 1.25; // 굴이 뒤로 물러난 깊이

  // ── 굴 속 — 검게 칠한 판때기가 아니라 뒤로 뚫린 통로다 ──
  // 아치 단면을 따라 -z 로 뽑아 낸 안쪽 벽 + 맨 뒤를 막는 벽
  const prof = [[-R, 0]];
  const arcN = 8;
  for (let i = 0; i <= arcN; i++) {
    const a = Math.PI - (i / arcN) * Math.PI; // π → 0 (왼쪽 → 오른쪽)
    prof.push([Math.cos(a) * R, LEG + Math.sin(a) * R]);
  }
  prof.push([R, 0]);
  const inner = mesh();
  // 안쪽으로 갈수록 좁아진다 — 그래야 입구에서 볼 때 벽이 모여 들어가는 게 보여 "통로"로 읽힌다
  const back = prof.map((p) => [p[0] * 0.58, p[1] * 0.6]);
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i];
    const b = prof[i + 1];
    const a2 = back[i];
    const b2 = back[i + 1];
    // 앞 → 뒤 → 뒤 → 앞 순서라야 노멀이 굴 안쪽(축 방향)을 향해 입구에서 들여다보인다
    quad(inner, [a[0], a[1], 0], [a2[0], a2[1], -DEPTH], [b2[0], b2[1], -DEPTH], [b[0], b[1], 0], '#5a544a', { soft: true });
  }
  poly(
    inner,
    back
      .slice()
      .reverse()
      .map((p) => [p[0], p[1], -DEPTH]),
    '#2b2823'
  );
  merge(m, inner, {});

  // ── 구멍을 두르는 돌 세 켜 ──
  // 켜마다 아치 곡선을 따라가며 모서리를 깎은 블록을 방사형으로 눕힌다.
  const T = 0.44; // 켜 두께
  const courses = [
    { arc: 4, span: 1.0, legs: [0.34, 1.06], legW: 0.74, d: 0.66, tone: 0 },
    { arc: 6, span: 1.0, legs: [0.72], legW: 1.48, d: 0.58, tone: 1 },
    { arc: 4, span: 0.62, legs: [], legW: 0, d: 0.5, tone: 0 }, // 맨 바깥 켜는 꼭대기만 덮어 봉긋한 더미가 된다
  ];
  courses.forEach((c, ci) => {
    const base = R + T * ci; // 이 켜가 시작되는 반지름
    // 아치 — 반원 위에 고르게
    for (let i = 0; i < c.arc; i++) {
      const a = Math.PI * (0.5 + ((i + 0.5) / c.arc - 0.5) * c.span);
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      cobbleBlock(m, {
        x: cs * base,
        y: LEG + sn * base,
        z: rand(rng, -0.04, 0.04),
        w: ((Math.PI * base * c.span) / c.arc) * rand(rng, 0.94, 1.12), // 접선 방향 길이
        h: T * rand(rng, 0.9, 1.05), // 반지름 방향 두께
        d: c.d * rand(rng, 0.92, 1.06),
        rz: Math.atan2(-cs, sn), // 블록의 위쪽이 아치 바깥을 향하도록 눕힌다
        ry: rand(rng, -0.06, 0.06),
        color: (i + ci + c.tone) % 2 ? STONE : STONE_D,
        top: STONE_TOP,
        cham: rand(rng, 0.26, 0.4),
        taper: rand(rng, 0.82, 0.92),
      });
    }
    // 다리 — 같은 방식으로 옆으로 눕힌 블록
    for (const s of [-1, 1]) {
      c.legs.forEach((ly, i) => {
        cobbleBlock(m, {
          x: s * base,
          y: ly,
          z: rand(rng, -0.04, 0.04),
          w: c.legW * rand(rng, 0.92, 1.08),
          h: T * rand(rng, 0.9, 1.05),
          d: c.d * rand(rng, 0.92, 1.06),
          rz: (-s * Math.PI) / 2,
          ry: rand(rng, -0.05, 0.05),
          color: (i + ci) % 2 ? STONE : STONE_D,
          top: STONE_TOP,
          cham: rand(rng, 0.26, 0.4),
          taper: rand(rng, 0.82, 0.92),
        });
      });
    }
  });

  // 발치 돌부스러기
  for (let i = 0; i < 2; i++) {
    facetRock(m, {
      x: rand(rng, -1.5, 1.5),
      z: rand(rng, 0.34, 0.7),
      r: rand(rng, 0.15, 0.26),
      rz2: rand(rng, 0.12, 0.2),
      sides: 5,
      seed: seed + 60 + i,
      wob: 0.22,
      h: rand(rng, 0.12, 0.24),
      profile: [
        [0, 0.92],
        [1, 0.52],
      ],
      color: STONE_D,
      topColor: STONE,
    });
  }
  return finish(m, { radius: 1.7, kind: 'cave' });
}

/** 잘려 나간 흙덩이 절벽 — 지형 시트: 풀 덮인 윗면 + 삐죽삐죽한 풀 가장자리 + 단면의 세로 결 */
export function cliffChunk(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const W = opt.w || 2.0;
  const D = opt.d || 1.3;
  const H = opt.h || 1.5;
  // 세로 결 7줄 — ridge 로 한 칸 걸러 안팎으로 밀어 모서리가 또렷한 결이 되게 한다
  const SIDES = 7;
  const plan = facetPlan({ r: W / 2, rz2: D / 2, sides: SIDES, seed: seed + 1, wob: 0.13, ridge: 0.1 });
  // 흙덩이 — 위는 넓고 아래로 갈수록 좁아져 30% 남짓까지 조여든 뒤 삐뚤한 끝점으로 마무리된다.
  // (공중섬 아래처럼) 곧은 벽이 아니라 뾰족하게 깎여 내려간 단면이어야 한다.
  facetRock(m, {
    plan,
    h: H,
    profile: [
      [0, 0.1],
      [0.13, 0.3],
      [0.42, 0.62],
      [0.73, 0.88],
      [1, 1],
    ],
    color: '#c9a978',
    topColor: '#b3925f',
    soft: false,
    cap: false, // 풀 뚜껑이 덮으므로 윗면은 생략
  });
  // 풀 뚜껑 — 흙 테두리보다 13% 밖으로 나와 처마처럼 걸쳐진다
  const K = 1.13;
  const cap = plan.map((p) => [p[0] * K, p[1] * K]);
  facetRock(m, {
    y: H,
    plan: cap,
    h: 0.2,
    profile: [
      [0, 1],
      [1, 0.96],
    ],
    color: P.grassDeep,
    topColor: P.grass,
  });
  // 처마 밑으로 늘어진 삐죽삐죽한 풀 술 — 한 변마다 폭도 길이도 제각각인 세 가닥
  for (let i = 0; i < cap.length; i++) {
    const a = cap[i];
    const b = cap[(i + 1) % cap.length];
    for (let k = 0; k < 3; k++) {
      const c0 = (k + rand(rng, 0.02, 0.3)) / 3;
      const c1 = c0 + rand(rng, 0.14, 0.3) / 3;
      const p0 = [a[0] + (b[0] - a[0]) * c0, a[1] + (b[1] - a[1]) * c0];
      const p1 = [a[0] + (b[0] - a[0]) * c1, a[1] + (b[1] - a[1]) * c1];
      const tip = rand(rng, 0.3, 0.75); // 가닥 끝이 어느 쪽으로 치우칠지
      tri(
        m,
        [p0[0], H + 0.04, p0[1]],
        [p1[0], H + 0.04, p1[1]],
        [(p0[0] + (p1[0] - p0[0]) * tip) * 1.06, H - rand(rng, 0.1, 0.38), (p0[1] + (p1[1] - p0[1]) * tip) * 1.06],
        P.grassDeep,
        { double: true }
      );
    }
  }
  // 윗면 가장자리에 돋은 풀 — 실루엣 밖으로 조금 나가야 그림처럼 보인다
  for (let i = 0; i < cap.length; i++) {
    tuft(m, {
      x: cap[i][0] * 0.98,
      z: cap[i][1] * 0.98,
      y: H + 0.19,
      h: 0.3,
      n: 2,
      seed: seed + 10 + i,
      spread: 0.08,
    });
  }
  return finish(m, { radius: W * 0.6, kind: 'cliff' });
}

/** 징검돌 — 지형 시트: 납작한 판돌 5장이 구불구불 이어진 길 한 토막 */
export function steppingStone(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const n = opt.count || 5;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    // 돌은 모두 같은 땅 높이·같은 두께로 놓는다(계단처럼 올라가면 안 된다).
    // 대신 좌우로만 엇갈리게 흔들어 구불구불한 길이 되게 한다.
    facetRock(m, {
      x: t * 2.3 + rand(rng, -0.07, 0.07),
      y: 0,
      z: (i % 2 ? 0.24 : -0.2) + rand(rng, -0.06, 0.06),
      r: rand(rng, 0.27, 0.36),
      rz2: rand(rng, 0.2, 0.28),
      sides: 8,
      seed: seed + i,
      wob: 0.15,
      h: 0.085,
      // 육각형 각이 아니라 둥글둥글한 조약돌 — soft 라 실루엣 선만 남는다
      profile: [
        [0, 0.9],
        [0.5, 1],
        [1, 0.88],
      ],
      color: STONE,
      topColor: STONE_TOP,
      soft: true,
    });
  }
  return finish(m, { radius: 1.2, kind: 'stepstone' });
}

/** 돌 두른 웅덩이 — 지형 시트: 동심 물결이 이는 물면 + 낮은 조약돌 테 + 부들 무더기 */
export function pondRimRocks(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const R = opt.r || 1.15;
  const WL = 0.075; // 수면 높이 — 돌은 이 선에 반쯤 잠긴다
  // 물면 + 동심 물결 3겹. 조금씩 띄워 얹으면 각 판의 테두리가 그대로 잉크 원이 된다
  const inner = R - 0.12;
  waterDisc(m, { y: WL, r: inner, seg: 12, color: WATER });
  waterDisc(m, { y: WL + 0.012, r: inner * 0.72, seg: 11, color: WATER_D });
  waterDisc(m, { y: WL + 0.024, r: inner * 0.46, seg: 10, color: WATER });
  waterDisc(m, { y: WL + 0.036, r: inner * 0.22, seg: 9, color: WATER_D });
  // 테두리 조약돌 — 각진 돌이 아니라 물가에 반쯤 묻힌 납작하고 둥근 자갈
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand(rng, -0.12, 0.12);
    facetRock(m, {
      x: Math.cos(a) * R,
      z: Math.sin(a) * R * 0.86,
      r: rand(rng, 0.21, 0.31),
      rz2: rand(rng, 0.15, 0.23),
      sides: 6,
      seed: seed + i,
      wob: 0.16,
      h: WL + rand(rng, 0.04, 0.08), // 수면보다 아주 조금만 솟는다
      profile: [
        [0, 0.95],
        [1, 0.62],
      ],
      color: i % 2 ? STONE : STONE_D,
      topColor: STONE_TOP,
      soft: true, // 크리스 선을 죽여 둥근 조약돌로 보이게
    });
  }
  // 부들 무더기 — 가는 줄기 5대 끝에 갈색 이삭. 줄기는 얇은 삼각형이 그대로 펜 선이 된다
  const cx = -R * 0.6;
  const cz = -R * 0.5;
  for (let i = 0; i < 5; i++) {
    const bx = cx + (i - 2) * 0.09 + rand(rng, -0.05, 0.05);
    const bz = cz + rand(rng, -0.16, 0.16);
    const lean = rand(rng, -0.26, 0.26);
    const h = rand(rng, 0.52, 0.88);
    const tx = bx + lean * h;
    const tz = bz + lean * 0.3 * h;
    tri(m, [bx - 0.026, WL, bz], [bx + 0.026, WL, bz], [tx, WL + h, tz], P.leafDark, { double: true });
    // 이삭 — 줄기 끝에 붙은 굵은 갈색 원기둥
    tube(m, { x: tx, y: WL + h - 0.16, z: tz, r: 0.038, h: 0.19, seg: 5, color: i % 2 ? '#a8804f' : '#96703f', cap: false });
  }
  tuft(m, { x: R * 0.5, z: R * 0.42, h: 0.26, n: 3, seed: seed + 40, spread: 0.09 });
  return finish(m, { radius: R * 1.2, kind: 'pond' });
}
