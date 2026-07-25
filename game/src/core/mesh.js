// 저폴리 3D 메시 — 캐릭터를 뺀 모든 오브젝트(건물·나무·소품)는 여기서 만든 진짜 폴리곤이다.
// 좌표계: x=동, y=위, z=북. 모델 원점은 "땅에 닿는 바닥 중앙".
import { makeRng } from './rng.js';

export function mesh() {
  return { verts: [], faces: [] };
}

export function vert(m, x, y, z) {
  m.verts.push(x, y, z);
  return m.verts.length / 3 - 1;
}

/**
 * 면 추가. 바깥에서 봤을 때 반시계(CCW)가 되도록 정점을 넣으면 노멀이 바깥을 향한다.
 * opts: { color, outline=true, double=false, crease }
 */
export function face(m, idx, color, opts = {}) {
  m.faces.push({
    v: idx,
    color,
    outline: opts.outline !== false,
    double: !!opts.double,
    soft: !!opts.soft, // 크리스 라인을 그리지 않는 부드러운 면(구형 캐노피 등)
  });
  return m.faces[m.faces.length - 1];
}

export function quad(m, p0, p1, p2, p3, color, opts) {
  const a = vert(m, p0[0], p0[1], p0[2]);
  const b = vert(m, p1[0], p1[1], p1[2]);
  const c = vert(m, p2[0], p2[1], p2[2]);
  const d = vert(m, p3[0], p3[1], p3[2]);
  return face(m, [a, b, c, d], color, opts);
}

export function tri(m, p0, p1, p2, color, opts) {
  const a = vert(m, p0[0], p0[1], p0[2]);
  const b = vert(m, p1[0], p1[1], p1[2]);
  const c = vert(m, p2[0], p2[1], p2[2]);
  return face(m, [a, b, c], color, opts);
}

export function poly(m, pts, color, opts) {
  const idx = pts.map((p) => vert(m, p[0], p[1], p[2]));
  return face(m, idx, color, opts);
}

// ── 변환 ──────────────────────────────────────
export function transform(m, { tx = 0, ty = 0, tz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const v = m.verts;
  const cy = Math.cos(ry);
  const sy_ = Math.sin(ry);
  const cx = Math.cos(rx);
  const sx_ = Math.sin(rx);
  const cz = Math.cos(rz);
  const sz_ = Math.sin(rz);
  for (let i = 0; i < v.length; i += 3) {
    let x = v[i] * sx;
    let y = v[i + 1] * sy;
    let z = v[i + 2] * sz;
    if (rz) {
      const nx = x * cz - y * sz_;
      y = x * sz_ + y * cz;
      x = nx;
    }
    if (rx) {
      const ny = y * cx - z * sx_;
      z = y * sx_ + z * cx;
      y = ny;
    }
    if (ry) {
      const nx = x * cy + z * sy_;
      z = -x * sy_ + z * cy;
      x = nx;
    }
    v[i] = x + tx;
    v[i + 1] = y + ty;
    v[i + 2] = z + tz;
  }
  return m;
}

/** src 를 dst 에 합친다(변환 적용). src 는 복사되므로 재사용 가능. */
export function merge(dst, src, xf) {
  const base = dst.verts.length / 3;
  const copy = { verts: src.verts.slice(), faces: src.faces };
  if (xf) transform(copy, xf);
  for (let i = 0; i < copy.verts.length; i++) dst.verts.push(copy.verts[i]);
  for (const f of copy.faces) {
    dst.faces.push({ ...f, v: f.v.map((i) => i + base) });
  }
  return dst;
}

export function bounds(m) {
  let minX = 1e9;
  let minY = 1e9;
  let minZ = 1e9;
  let maxX = -1e9;
  let maxY = -1e9;
  let maxZ = -1e9;
  const v = m.verts;
  for (let i = 0; i < v.length; i += 3) {
    if (v[i] < minX) minX = v[i];
    if (v[i] > maxX) maxX = v[i];
    if (v[i + 1] < minY) minY = v[i + 1];
    if (v[i + 1] > maxY) maxY = v[i + 1];
    if (v[i + 2] < minZ) minZ = v[i + 2];
    if (v[i + 2] > maxZ) maxZ = v[i + 2];
  }
  if (v.length === 0) return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0, w: 0, h: 0, d: 0 };
  return { minX, minY, minZ, maxX, maxY, maxZ, w: maxX - minX, h: maxY - minY, d: maxZ - minZ };
}

// ── 프리미티브 ────────────────────────────────
/** 바닥 중앙이 (x,0,z) 인 직육면체 */
export function box(m, o) {
  const { x = 0, y = 0, z = 0, w = 1, h = 1, d = 1, color = '#ccc', top = null, ry = 0 } = o;
  const hw = w / 2;
  const hd = d / 2;
  const b = mesh();
  const P = [
    [-hw, 0, hd],
    [hw, 0, hd],
    [hw, 0, -hd],
    [-hw, 0, -hd],
    [-hw, h, hd],
    [hw, h, hd],
    [hw, h, -hd],
    [-hw, h, -hd],
  ];
  quad(b, P[0], P[1], P[5], P[4], color); // 남(+z)
  quad(b, P[1], P[2], P[6], P[5], color); // 동(+x)
  quad(b, P[2], P[3], P[7], P[6], color); // 북(-z)
  quad(b, P[3], P[0], P[4], P[7], color); // 서(-x)
  quad(b, P[4], P[5], P[6], P[7], top || color); // 위
  merge(m, b, { tx: x, ty: y, tz: z, ry });
  return m;
}

/** 박공(삼각) 지붕 — 용마루가 x축과 나란함 */
export function gable(m, o) {
  const { x = 0, y = 0, z = 0, w = 1, d = 1, h = 0.6, color = '#c66', ry = 0, eave = 0 } = o;
  const hw = w / 2 + eave;
  const hd = d / 2 + eave;
  const b = mesh();
  const ridgeA = [-hw, h, 0];
  const ridgeB = [hw, h, 0];
  quad(b, [-hw, 0, hd], [hw, 0, hd], ridgeB, ridgeA, color); // 남쪽 경사
  quad(b, [hw, 0, -hd], [-hw, 0, -hd], ridgeA, ridgeB, color); // 북쪽 경사
  tri(b, [hw, 0, hd], [hw, 0, -hd], ridgeB, color); // 동쪽 박공
  tri(b, [-hw, 0, -hd], [-hw, 0, hd], ridgeA, color); // 서쪽 박공
  merge(m, b, { tx: x, ty: y, tz: z, ry });
  return m;
}

/** 원기둥 / 원뿔대 */
export function cylinder(m, o) {
  const { x = 0, y = 0, z = 0, r = 0.5, r2 = null, h = 1, seg = 9, color = '#ccc', cap = true, capColor = null, ry = 0, soft = true } = o;
  const rt = r2 == null ? r : r2;
  const b = mesh();
  const lower = [];
  const upper = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    lower.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
    upper.push([Math.cos(a) * rt, h, Math.sin(a) * rt]);
  }
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    quad(b, lower[i], lower[j], upper[j], upper[i], color, { soft });
  }
  if (cap && rt > 0.001) poly(b, upper.slice().reverse(), capColor || color);
  merge(m, b, { tx: x, ty: y, tz: z, ry });
  return m;
}

/** 원뿔(지붕·침엽) */
export function cone(m, o) {
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
    tri(b, ring[i], ring[j], apex, color, { soft });
  }
  merge(m, b, { tx: x, ty: y, tz: z, ry });
  return m;
}

/** 저폴리 구/타원체 — 나무 잎덩어리, 바위에 사용 */
export function blobSphere(m, o) {
  const {
    x = 0,
    y = 0,
    z = 0,
    rx = 1,
    ry = 1,
    rz = null,
    seg = 8,
    rings = 4,
    color = '#8dc26f',
    wob = 0.14,
    seed = 1,
    yaw = 0,
    bumps = 0,
    bumpAmt = 0.3,
  } = o;
  const rzz = rz == null ? rx : rz;
  const rnd = makeRng(seed);
  const b = mesh();

  // 뭉게구름처럼 큼직한 혹을 만든다 — 공을 여러 개 겹치면 안쪽 실루엣 선이 보이므로
  // "닫힌 면 하나"를 울퉁불퉁하게 만드는 편이 훨씬 깔끔하다.
  const bumpDirs = [];
  for (let i = 0; i < bumps; i++) {
    const u = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const s2 = Math.sqrt(Math.max(0, 1 - u * u));
    bumpDirs.push([Math.cos(t) * s2, u * 0.75 + 0.15, Math.sin(t) * s2, bumpAmt * (0.6 + rnd() * 0.7)]);
  }

  const radiusAt = (dx, dy, dz, jitter) => {
    let k = 1 + jitter;
    for (let bIdx = 0; bIdx < bumpDirs.length; bIdx++) {
      const bd = bumpDirs[bIdx];
      const dot = dx * bd[0] + dy * bd[1] + dz * bd[2];
      if (dot > 0) k += bd[3] * dot * dot;
    }
    return k;
  };

  const grid = [];
  for (let i = 0; i <= rings; i++) {
    const row = [];
    const phi = (i / rings) * Math.PI;
    const pole = i === 0 || i === rings;
    // 극점은 모든 j 가 같은 자리에 있어야 한다.
    // (안 그러면 정점이 용접되지 않아 극에서 선이 방사형으로 뻗친다)
    const poleJitter = pole ? (rnd() - 0.5) * 2 * wob : 0;
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const dx = Math.sin(phi) * Math.cos(th);
      const dy = Math.cos(phi);
      const dz = Math.sin(phi) * Math.sin(th);
      const jitter = pole ? poleJitter : (rnd() - 0.5) * 2 * wob;
      const k = radiusAt(dx, dy, dz, jitter);
      row.push([dx * rx * k, dy * ry * k, dz * rzz * k]);
    }
    grid.push(row);
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const a = grid[i][j];
      const bb = grid[i][j2];
      const c = grid[i + 1][j2];
      const d = grid[i + 1][j];
      if (i === 0) tri(b, a, c, d, color, { soft: true });
      else if (i === rings - 1) tri(b, a, bb, c, color, { soft: true });
      else quad(b, a, bb, c, d, color, { soft: true });
    }
  }
  merge(m, b, { tx: x, ty: y, tz: z, ry: yaw });
  return m;
}

/** 2D 다각형(x,z)을 위로 뽑아 올리기 — 바위·불규칙 덩어리 */
export function extrude(m, o) {
  const { x = 0, y = 0, z = 0, pts, h = 1, color = '#ccc', topColor = null, topScale = 0.7, topOffset = [0, 0], soft = false } = o;
  const b = mesh();
  const bot = pts.map((p) => [p[0], 0, p[1]]);
  const top = pts.map((p) => [p[0] * topScale + topOffset[0], h, p[1] * topScale + topOffset[1]]);
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    quad(b, bot[i], bot[j], top[j], top[i], color, { soft });
  }
  poly(b, top.slice().reverse(), topColor || color);
  merge(m, b, { tx: x, ty: y, tz: z });
  return m;
}

/** 지면에 눕힌 사각 판 (물·바닥 표시) */
export function plate(m, o) {
  const { x = 0, y = 0.01, z = 0, w = 1, d = 1, color = '#aaa', ry = 0 } = o;
  const b = mesh();
  quad(b, [-w / 2, 0, d / 2], [w / 2, 0, d / 2], [w / 2, 0, -d / 2], [-w / 2, 0, -d / 2], color, {
    double: true,
    outline: false,
  });
  merge(m, b, { tx: x, ty: y, tz: z, ry });
  return m;
}

/** 세로 사각 천/깃발/잎 — 양면 */
export function panel(m, o) {
  const { x = 0, y = 0, z = 0, w = 1, h = 1, color = '#eee', ry = 0, tilt = 0, outline = true } = o;
  const b = mesh();
  quad(b, [-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0], [-w / 2, h, 0], color, { double: true, outline });
  merge(m, b, { tx: x, ty: y, tz: z, ry, rx: tilt });
  return m;
}

/** 십자로 세운 두 판 — 풀·작은 식물용(3D 공간을 차지하는 고전 기법) */
export function cross(m, o) {
  const { x = 0, y = 0, z = 0, w = 0.4, h = 0.5, color = '#8cb96a', ry = 0, outline = false } = o;
  panel(m, { x, y, z, w, h, color, ry, outline });
  panel(m, { x, y, z, w, h, color, ry: ry + Math.PI / 2, outline });
  return m;
}

// ── 엣지(외곽선용) 인접 정보 ──────────────────
/**
 * 프리미티브마다 정점을 새로 만들기 때문에 같은 자리에 여러 정점이 겹쳐 있다.
 * 위치 기준으로 정점을 용접해야 "면이 맞닿은 곳"을 알 수 있고,
 * 그래야 실루엣만 골라 잉크 선을 그릴 수 있다(안 그러면 전부 와이어프레임이 된다).
 */
export function weld(m) {
  const nv = m.verts.length / 3;
  const canon = new Int32Array(nv);
  const map = new Map();
  for (let i = 0; i < nv; i++) {
    const k =
      Math.round(m.verts[i * 3] * 2000) + ',' + Math.round(m.verts[i * 3 + 1] * 2000) + ',' + Math.round(m.verts[i * 3 + 2] * 2000);
    const hit = map.get(k);
    if (hit === undefined) {
      map.set(k, i);
      canon[i] = i;
    } else canon[i] = hit;
  }
  return canon;
}

export function buildEdges(m) {
  const canon = weld(m);
  const map = new Map();
  m.faces.forEach((f, fi) => {
    const n = f.v.length;
    for (let i = 0; i < n; i++) {
      const a = canon[f.v[i]];
      const b = canon[f.v[(i + 1) % n]];
      if (a === b) continue;
      const key = a < b ? a * 1000000 + b : b * 1000000 + a;
      const e = map.get(key);
      if (e) {
        if (e.f2 < 0) e.f2 = fi;
      } else map.set(key, { a: Math.min(a, b), b: Math.max(a, b), f1: fi, f2: -1 });
    }
  });
  return [...map.values()];
}

/** 면의 노멀(정규화) — verts 는 flat 배열 */
export function faceNormal(verts, idx, out = []) {
  // Newell's method: 오목한 다각형에서도 안정적
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < idx.length; i++) {
    const c = idx[i] * 3;
    const n = idx[(i + 1) % idx.length] * 3;
    nx += (verts[c + 1] - verts[n + 1]) * (verts[c + 2] + verts[n + 2]);
    ny += (verts[c + 2] - verts[n + 2]) * (verts[c] + verts[n]);
    nz += (verts[c] - verts[n]) * (verts[c + 1] + verts[n + 1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  out[0] = nx / len;
  out[1] = ny / len;
  out[2] = nz / len;
  return out;
}

export function centroid(verts, idx, out = []) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const i of idx) {
    x += verts[i * 3];
    y += verts[i * 3 + 1];
    z += verts[i * 3 + 2];
  }
  const n = idx.length;
  out[0] = x / n;
  out[1] = y / n;
  out[2] = z / n;
  return out;
}
