// 손그림 레퍼런스 시트(나무·그루터기·통나무·덤불 / 풀·꽃·고사리·버섯·부들·덩굴)를
// 한 장씩 그대로 옮긴 저폴리 3D 모델. 크기는 실제 월드 단위(캐릭터 키 1.5).
// 잉크 선은 "실루엣 + 날카로운 크리스"에만 붙으므로, 그림의 선(나이테·껍질결·꽃잎 윤곽)은
// 전부 진짜 폴리곤으로 만들어야 보인다.
import { mesh, merge, box, cylinder, cone, blobSphere, extrude, tri, quad, poly, bounds } from '../core/mesh.js';
import { P, shade } from '../art/palette.js';
import { makeRng, rand, pick, randInt } from '../core/rng.js';

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
  } else if (shape === 'saw') {
    // 민들레 로제트 — 뒤로 젖혀진 큰 톱니가 톱날처럼 이어진다(끝으로 갈수록 깊다)
    pts = [
      [0, 0], [0.16, 0.2], [0.24, 0.08], [0.4, 0.44], [0.5, 0.14], [0.66, 0.62],
      [0.76, 0.2], [1, 0.05],
      [0.76, -0.2], [0.66, -0.62], [0.5, -0.14], [0.4, -0.44], [0.24, -0.08], [0.16, -0.2],
    ];
  } else if (shape === 'lobe') {
    // 단풍잎 갈래 하나 — 끝이 창처럼 뾰족하고 가장자리에 잔톱니가 있다
    pts = [
      [0, 0], [0.26, 0.5], [0.44, 0.34], [0.62, 0.42], [0.8, 0.24], [1, 0],
      [0.8, -0.24], [0.62, -0.42], [0.44, -0.34], [0.26, -0.5],
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

/**
 * 밑동에서 방사형으로 뻗은 뿌리 버팀 — 줄기 표면에 딱 붙는 "천막" 두 장(면 2개).
 * 원기둥 속을 파고드는 덩어리를 쓰면 관통선이 지저분하게 남아서, 표면에 얹는 쪽이 깔끔하다.
 */
function rootFlares(m, { x = 0, z = 0, r = 0.3, rt = null, up = null, n = 4, len = 0.2, color = P.trunkDark, seed = 1 }) {
  const rnd = makeRng(seed);
  const rtop = rt == null ? r * 0.9 : rt;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.7;
    const uy = (up == null ? len * 0.9 : up) * (0.8 + rnd() * 0.4);
    const out = r * 1.02 + len * (0.55 + rnd() * 0.4);
    const tw = r * (0.34 + rnd() * 0.18);
    const A = [rtop * 0.72, uy, 0];
    const B = [r * 0.74, 0.004, -tw];
    const C = [r * 0.74, 0.004, tw];
    const D = [out, 0.004, 0];
    const t = mesh();
    tri(t, A, C, D, color);
    tri(t, A, D, B, color);
    merge(m, t, { ry: -a, tx: x, tz: z });
  }
  return m;
}

/**
 * 스캘럽(둥근 혹이 사슬처럼 이어진) 잎덩어리 — 그림의 "구름 나무" 캐노피.
 * 공을 여러 개 겹치면 속에 실루엣 선이 남으므로, 닫힌 면 하나의 반지름을 방향별로
 * 울퉁불퉁하게 조절해서 혹을 만든다. core(<1) 덕분에 혹과 혹 사이가 움푹 들어간다.
 */
function cloudBlob(m, o) {
  const {
    x = 0, y = 0, z = 0, rx = 1, ry = null, rz = null,
    seg = 15, rings = 6, color = P.leaf,
    lobes = 8, amt = 0.48, sharp = 10, core = 0.68, top = 2,
    wob = 0.02, seed = 1, yaw = 0,
  } = o;
  const ryy = ry == null ? rx : ry;
  const rzz = rz == null ? rx : rz;
  const rnd = makeRng(seed);
  const dirs = [];
  for (let i = 0; i < lobes; i++) {
    const t = (i / lobes) * Math.PI * 2 + (rnd() - 0.5) * 0.35;
    const u = [-0.38, 0.06, 0.4][i % 3] + (rnd() - 0.5) * 0.16;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    dirs.push([Math.cos(t) * s, u, Math.sin(t) * s, amt * (0.85 + rnd() * 0.35)]);
  }
  for (let i = 0; i < top; i++) {
    const t = (i / Math.max(1, top)) * Math.PI * 2 + rnd();
    const u = 0.58 + rnd() * 0.16;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    dirs.push([Math.cos(t) * s, u, Math.sin(t) * s, amt * (0.5 + rnd() * 0.2)]);
  }
  const kAt = (dx, dy, dz, jit) => {
    let k = core + jit;
    for (let i = 0; i < dirs.length; i++) {
      const d = dirs[i];
      const dot = dx * d[0] + dy * d[1] + dz * d[2];
      if (dot > 0) k += d[3] * Math.pow(dot, sharp);
    }
    return k;
  };
  const b = mesh();
  const grid = [];
  for (let i = 0; i <= rings; i++) {
    const row = [];
    const phi = (i / rings) * Math.PI;
    const pole = i === 0 || i === rings;
    // 극점은 모든 j 가 같은 자리여야 정점이 용접된다
    const pj = pole ? (rnd() - 0.5) * 2 * wob : 0;
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const dx = Math.sin(phi) * Math.cos(th);
      const dy = Math.cos(phi);
      const dz = Math.sin(phi) * Math.sin(th);
      const k = kAt(dx, dy, dz, pole ? pj : (rnd() - 0.5) * 2 * wob);
      row.push([dx * rx * k, dy * ryy * k, dz * rzz * k]);
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

/** 나무 줄기 — 뿌리 쪽이 굵고 위로 갈수록 가늘다. */
function trunk(m, { x = 0, z = 0, h = 1.6, r = 0.22, top = 0.14, color = P.trunk, seg = 6, roots = 4, seed = 1, flare = 0.4 }) {
  cylinder(m, { x, z, r, r2: top, h, seg, color, cap: false });
  if (flare > 0) cylinder(m, { x, z, r: r * (1 + flare), r2: r, h: h * 0.16, seg, color, cap: false });
  if (roots > 0) {
    rootFlares(m, {
      x, z,
      r: r * (1 + flare),
      rt: r * (1 + flare * 0.45),
      up: h * 0.12,
      n: roots,
      len: r * 0.38,
      color,
      seed: seed * 31 + 7,
    });
  }
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
  const c = [x, y + spike * 0.08, z];
  for (let i = 0; i < seg; i++) {
    // (c, j, i) 순서라야 노멀이 위를 본다
    tri(m, c, ring[(i + 1) % seg], ring[i], color);
  }
  return m;
}

/**
 * 위를 보는 고리 띠 하나 — 바깥 링(rOut,yOut)과 안쪽 링(rIn,yIn)을 잇는다.
 * (O[j],O[i],I[i],I[j]) 순서라야 노멀이 위를 향한다.
 */
function ringBand(m, { x = 0, z = 0, rOut = 1, rIn = 0.5, yOut = 0, yIn = 0, seg = 8, color = P.wood, soft = false }) {
  const O = [];
  const I = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    O.push([x + Math.cos(a) * rOut, yOut, z + Math.sin(a) * rOut]);
    I.push([x + Math.cos(a) * rIn, yIn, z + Math.sin(a) * rIn]);
  }
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    quad(m, O[j], O[i], I[i], I[j], color, { soft });
  }
  return m;
}

/**
 * 톱질한 면의 나이테 — 고리 띠를 한 칸씩 내렸다 올렸다 하며 V 자 홈을 판다.
 * 띠를 같은 기울기로 쌓으면 면 사이 각이 얕아서 잉크 선이 안 붙는다.
 * 지그재그로 파야 크리스가 생겨 동심원이 실제로 그려진다.
 */
function growthRings(m, { x = 0, y = 0, z = 0, r = 0.3, n = 3, seg = 8, depth = null, color = P.wood, ringColor = '#e2c79b' }) {
  const step = depth == null ? r * 0.14 : depth;
  let ro = r;
  for (let k = 0; k < n; k++) {
    const ri = r * (1 - (k + 1) / (n + 0.6));
    const down = k % 2 === 0;
    ringBand(m, {
      x, z, seg,
      rOut: ro,
      rIn: ri,
      yOut: down ? y : y - step,
      yIn: down ? y - step : y,
      color: down ? color : ringColor,
    });
    ro = ri;
  }
  const yc = n % 2 === 0 ? y : y - step;
  const c = [];
  for (let i = 0; i < seg; i++) {
    const a = -(i / seg) * Math.PI * 2;
    c.push([x + Math.cos(a) * ro, yc, z + Math.sin(a) * ro]);
  }
  poly(m, c, ringColor);
  return m;
}

/**
 * 쪼개져 남은 나뭇조각 하나 — 위가 한 점이 아니라 짧은 능선이라 "뾰족한 뿔"이 아니라
 * "세로로 찢겨 남은 널빤지"로 읽힌다. 안쪽 면이 따로 있어 뜯긴 속살도 보인다(면 4개).
 */
function woodShard(m, { x = 0, y = 0, z = 0, a = 0, half = 0.42, rOut = 0.3, rIn = 0.15, h = 0.4, lean = 0.03, jag = 0.22, color = P.wood, side = P.trunk }) {
  const p = (ang, rr, yy) => [x + Math.cos(ang) * rr, y + (yy || 0), z + Math.sin(ang) * rr];
  const OL = p(a - half, rOut);
  const OR = p(a + half, rOut);
  const IL = p(a - half * 0.72, rIn);
  const IR = p(a + half * 0.72, rIn);
  const rt = (rOut + rIn) * 0.5 + lean;
  const TL = p(a - half * 0.34, rt, h * (1 - jag));
  const TR = p(a + half * 0.34, rt, h);
  quad(m, OR, OL, TL, TR, color); // 바깥 껍질면
  quad(m, IL, IR, TR, TL, side); // 안쪽 속살면
  tri(m, IR, OR, TR, side); // 옆 파단면
  tri(m, OL, IL, TL, side);
  return m;
}

/** 원뿔 겉면에 살짝 띄운 비스듬한 잎결 한 줄(면 1개). 실루엣을 뚫지 않는 표면 선. */
function slopeLine(m, { a = 0, r0 = 0.2, r1 = 0.08, y0 = 0, y1 = 0.5, w = 0.03, color = P.leafDark, lift = 0.012 }) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const tx = -s * w * 0.5;
  const tz = c * w * 0.5;
  const b0x = c * (r0 + lift);
  const b0z = s * (r0 + lift);
  const b1x = c * (r1 + lift);
  const b1z = s * (r1 + lift);
  quad(
    m,
    [b0x - tx, y0, b0z - tz],
    [b0x + tx, y0, b0z + tz],
    [b1x + tx * 0.35, y1, b1z + tz * 0.35],
    [b1x - tx * 0.35, y1, b1z - tz * 0.35],
    color,
    { double: true }
  );
  return m;
}

/**
 * 뾰족한 잎덩어리가 겹겹이 붙은 캐노피 — "뾰족함"이 실루엣 자체에 들어간다.
 * 봉우리 방향을 격자 정점에 딱 맞춰야 끝이 정점으로 잡힌다.
 * (방향이 정점 사이에 떨어지면 봉우리가 깎여 둥글어진다)
 * cells: [[링 i, 세로줄 j, 세기]...]
 * spread 를 주면 봉우리가 "그 각도까지만 부풀고 밖은 0" 인 둥근 혹이 된다
 * (cos^sharp 는 아무리 눌러도 뾰족해지기만 해서 둥근 뭉게구름이 안 나온다).
 */
function clumpCrown(m, o) {
  const {
    x = 0, y = 0, z = 0, rx = 1, ry = null, rz = null,
    seg = 12, rings = 6, color = P.leaf, tipColor = null,
    cells = [], amt = 0.55, sharp = 12, spread = 0, core = 0.68, wob = 0.02, seed = 1, yaw = 0,
  } = o;
  const ryy = ry == null ? rx : ry;
  const rzz = rz == null ? rx : rz;
  const rnd = makeRng(seed);
  const peaks = [];
  const peakKey = new Set();
  for (let c = 0; c < cells.length; c++) {
    const ci = cells[c][0];
    const cj = ((cells[c][1] % seg) + seg) % seg;
    const phi = (ci / rings) * Math.PI;
    const th = (cj / seg) * Math.PI * 2;
    const k = cells[c][2] == null ? 1 : cells[c][2];
    peaks.push([Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th), amt * k * (0.85 + rnd() * 0.3)]);
    peakKey.add(ci * seg + cj);
  }
  const kAt = (dx, dy, dz, jit) => {
    let k = core + jit;
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      const dot = Math.max(-1, Math.min(1, dx * p[0] + dy * p[1] + dz * p[2]));
      if (spread > 0) {
        const ang = Math.acos(dot);
        if (ang < spread) k += p[3] * 0.5 * (1 + Math.cos((Math.PI * ang) / spread));
      } else if (dot > 0) k += p[3] * Math.pow(dot, sharp);
    }
    return k;
  };
  const b = mesh();
  const grid = [];
  for (let i = 0; i <= rings; i++) {
    const row = [];
    const phi = (i / rings) * Math.PI;
    const pole = i === 0 || i === rings;
    const pj = pole ? (rnd() - 0.5) * 2 * wob : 0;
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2;
      const dx = Math.sin(phi) * Math.cos(th);
      const dy = Math.cos(phi);
      const dz = Math.sin(phi) * Math.sin(th);
      const k = kAt(dx, dy, dz, pole ? pj : (rnd() - 0.5) * 2 * wob);
      row.push([dx * rx * k, dy * ryy * k, dz * rzz * k]);
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
      // 봉우리에 닿는 면만 밝은 색 — 잎다발 하나하나가 구분돼 보인다
      const lit = tipColor && (peakKey.has(i * seg + j) || peakKey.has((i + 1) * seg + j));
      const col = lit ? tipColor : color;
      if (i === 0) tri(b, a, c, d, col, { soft: true });
      else if (i === rings - 1) tri(b, a, bb, c, col, { soft: true });
      else quad(b, a, bb, c, d, col, { soft: true });
    }
  }
  merge(m, b, { tx: x, ty: y, tz: z, ry: yaw });
  return m;
}

/** 원통 겉면에 살짝 띄운 껍질 결 한 줄(면 1개). 통나무·줄기의 손그림 선. */
function barkLine(m, { r = 0.25, a = 0, y0 = 0, y1 = 1, w = 0.05, color = P.trunkDark, lift = 0.014 }) {
  const nx = Math.cos(a) * (r + lift);
  const nz = Math.sin(a) * (r + lift);
  const tx = -Math.sin(a) * w * 0.5;
  const tz = Math.cos(a) * w * 0.5;
  // 양면으로 두면 옆에서 볼 때 판이 선 하나로 눌려 실루엣 밖에 삐져나온 "머리카락"이 된다.
  // 바깥을 향하도록 감아서 단면일 때 자동으로 컬링되게 한다.
  quad(m, [nx + tx, y0, nz + tz], [nx - tx, y0, nz - tz], [nx - tx, y1, nz - tz], [nx + tx, y1, nz + tz], color);
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
  // 잎다발 끝만 한 톤 밝게 — 덩어리 하나하나가 겹쳐 보인다
  const tipColor = color === P.leafDark ? P.leaf : '#a7d181';
  const h = rand(rng, 4.6, 5.8);
  trunk(m, { h: h * 0.3, r: 0.27, top: 0.15, seed, roots: 4, flare: 0.5 });
  // 잎덩어리 속으로 갈라져 들어가는 두 가지
  for (const s of [-1, 1]) {
    const t = mesh();
    cylinder(t, { r: 0.1, r2: 0.05, h: h * 0.2, seg: 4, color: P.trunk, cap: false });
    merge(m, t, { rz: s * 0.5, tx: s * 0.06, ty: h * 0.26 });
  }
  // 캐노피는 "공 + 삐죽 튀어나온 가시"가 아니라, 뾰족한 잎다발이 겹쳐 붙은
  // 닫힌 덩어리 하나다. 봉우리를 격자 정점에 맞춰 심어 끝이 실루엣에 그대로 남는다.
  const cy = h * 0.62;
  const cells = [
    [0, 0, 0.85],
    [1, 1], [1, 5], [1, 9],
    [2, 3], [2, 7], [2, 11],
    [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10],
    [4, 1], [4, 5], [4, 9],
  ];
  clumpCrown(m, {
    y: cy,
    rx: h * 0.27,
    ry: h * 0.34,
    seg: 12,
    rings: 6,
    color,
    tipColor,
    cells,
    amt: 0.7,
    sharp: 16,
    core: 0.62,
    seed: seed + 4,
    yaw: rng() * 0.5,
  });
  return finish(m, { radius: 0.6, sway: 0.55, kind: 'leafy' });
}

/** 시트 1-③: 둥글게 부풀린 구름 캐노피의 큰 나무(닫힌 덩어리 하나 + 혹으로 스캘럽). */
export function blobTree(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, P.leafDark, '#a3c97c', P.leafBlue]);
  const h = rand(rng, 4.2, 5.4);
  // 굵은 밑동이 위로 갈수록 확 가늘어지고, 뿌리 버팀이 밖으로 벌어진다
  trunk(m, { h: h * 0.4, r: 0.3, top: 0.12, seed, roots: 5, flare: 0.62 });
  // 줄기가 한 번만 두 갈래로 갈라져 캐노피 속으로 들어간다(V 가 캐노피 밑에서 보인다)
  const forkY = h * 0.39;
  for (const s of [-1, 1]) {
    const t = mesh();
    cylinder(t, { r: 0.1, r2: 0.045, h: h * 0.27, seg: 4, color: P.trunk, cap: false });
    merge(m, t, { rz: s * 0.46, tx: s * 0.045, ty: forkY });
  }
  // 캐노피 가장자리는 큼직한 둥근 혹 대여섯 덩이로 크게 파도친다.
  // 혹 방향을 격자 정점에 맞춰야 봉우리가 깎이지 않고 실루엣에 그대로 남는다.
  clumpCrown(m, {
    y: h * 0.8,
    rx: h * 0.37,
    ry: h * 0.3,
    seg: 16,
    rings: 8,
    color,
    tipColor: null,
    cells: [
      [1, 4], [2, 11], [3, 1], [3, 7], [3, 13], [4, 4], [4, 10], [5, 0], [5, 8],
    ],
    amt: 0.78,
    spread: 0.82,
    core: 0.6,
    seed: seed + 3,
    yaw: rng() * 0.7,
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
  cloudBlob(m, {
    y: h * 0.66,
    rx: h * 0.42,
    ry: h * 0.36,
    seg: 13,
    rings: 5,
    color,
    lobes: 7,
    amt: 0.44,
    sharp: 9,
    core: 0.72,
    top: 1,
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
  cloudBlob(m, {
    y: h * 0.56,
    rx: h * 0.2,
    ry: h * 0.5,
    seg: 12,
    rings: 6,
    color,
    lobes: 6,
    amt: 0.4,
    sharp: 8,
    core: 0.74,
    top: 1,
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
  // 먼저 줄기 경로만 재 보고, 캐노피가 원점 위로 오도록 밑동을 반대쪽으로 물린다
  const path = [];
  let px = 0;
  let py = 0;
  let tilt = 0.12;
  for (let i = 0; i < segs; i++) {
    path.push([px, py, tilt]);
    px += Math.sin(tilt) * segLen;
    py += Math.cos(tilt) * segLen;
    tilt += 0.19 + i * 0.035;
  }
  const cxo = -(px + h * 0.08) * 0.62;
  for (let i = 0; i < segs; i++) {
    const r0 = 0.25 - i * 0.033;
    const c = mesh();
    cylinder(c, { r: r0, r2: r0 - 0.03, h: segLen * 1.06, seg: 5, color: P.trunk, cap: false });
    merge(m, c, { rz: -path[i][2], tx: cxo + path[i][0], ty: path[i][1] });
  }
  cylinder(m, { x: cxo, r: 0.36, r2: 0.26, h: h * 0.08, seg: 6, color: P.trunk, cap: false });
  rootFlares(m, { x: cxo, r: 0.36, rt: 0.3, up: 0.3, n: 4, len: 0.13, color: P.trunkDark, seed: seed + 21 });
  // 줄기 끝에서 두 갈래가 캐노피 속으로 더 뻗는다
  for (const s of [-0.35, 0.3]) {
    const t = mesh();
    cylinder(t, { r: 0.08, r2: 0.04, h: h * 0.22, seg: 4, color: P.trunk, cap: false });
    merge(m, t, { rz: -(tilt + s), tx: cxo + px, ty: py });
  }
  cloudBlob(m, {
    x: cxo + px + h * 0.08,
    y: py + h * 0.08,
    z: 0,
    rx: h * 0.46,
    ry: h * 0.3,
    seg: 14,
    rings: 6,
    color,
    lobes: 8,
    amt: 0.46,
    sharp: 10,
    core: 0.7,
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
  trunk(m, { h: h * 0.26, r: 0.085, top: 0.045, color: P.trunkDark, seg: 5, roots: 3, seed, flare: 0.5 });
  // 그림처럼 폭보다 5배쯤 높은 깔끔한 첨탑. 잎을 밖으로 심으면 선인장이 되므로
  // 실루엣은 매끈하게 두고, 잎결은 겉면에 붙인 얇은 선으로만 넣는다.
  const bodyY = h * 0.1;
  const bodyR = h * 0.1;
  const bodyH = h * 0.9;
  const waist = bodyR * 0.68;
  const skirtH = bodyH * 0.42;
  cylinder(m, { y: bodyY, r: bodyR, r2: waist, h: skirtH, seg: 9, color, cap: false });
  cone(m, { y: bodyY + skirtH, r: waist, h: bodyH - skirtH, seg: 9, color });
  // 겉면을 타고 흐르는 잎결 — 실루엣을 뚫지 않는다
  const n = 20;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = t * Math.PI * 9.4 + 0.4;
    const y0 = bodyY + bodyH * (0.05 + t * 0.72);
    const y1 = Math.min(bodyY + bodyH * 0.97, y0 + bodyH * 0.17);
    const rAt = (yy) => {
      const k = (yy - bodyY) / bodyH;
      return k < 0.42 ? bodyR + (waist - bodyR) * (k / 0.42) : waist * (1 - (k - 0.42) / 0.58);
    };
    slopeLine(m, {
      a,
      r0: rAt(y0),
      r1: rAt(y1),
      y0,
      y1,
      w: h * 0.045,
      color: i % 2 ? P.leafDark : '#5f9a52',
      lift: 0.022,
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
    // 갈래는 위로 벌어진다 — 하나는 더 눕고 하나는 더 선다(아래로 처지지 않게 묶어 둔다)
    const t1 = Math.min(1.15, tilt + rand(rng, 0.22, 0.45));
    const t2 = Math.max(0.06, tilt - rand(rng, 0.15, 0.4));
    branch(nx, ny, nz, ang + rand(rng, -0.45, 0.45), t1, len * 0.58, r * 0.6, depth - 1);
    branch(nx, ny, nz, ang + rand(rng, -0.5, 0.5), t2, len * 0.52, r * 0.55, depth - 1);
  };
  // 그림처럼 줄기가 위로 이어지고, 그 줄기 곳곳에서 가지가 V 자로 갈라져 올라간다
  const base = rng() * 6.28;
  const lead = mesh();
  cylinder(lead, { r: 0.07, r2: 0.028, h: h * 0.34, seg: 4, color: P.trunkDark, cap: false });
  merge(m, lead, { rz: -0.09, ry: -base, ty: h * 0.5 });
  const forks = 5;
  for (let i = 0; i < forks; i++) {
    const k = i / (forks - 1);
    const y = h * (0.4 + k * 0.32);
    const r = 0.075 - k * 0.028;
    branch(0, y, 0, base + i * 2.35 + rand(rng, -0.35, 0.35), rand(rng, 0.5, 0.85), h * (0.3 - k * 0.11), r, 2);
  }
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
  cloudBlob(m, { y: cy, rx, ry: rx * 0.88, seg: 13, rings: 5, color, lobes: 6, amt: 0.42, sharp: 9, core: 0.74, top: 1, seed: seed + 5 });
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
  rootFlares(m, { r: r * 1.48, rt: r * 1.26, up: h * 0.13, n: 5, len: r * 0.34, color: P.trunkDark, seed: seed + 11 });
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
  // 밑동은 자른 면보다 1.6 배 굵게 벌어진다(그림의 나팔처럼 퍼진 뿌리목)
  const base = r * 1.6;
  cylinder(m, { r: base, r2: r * 1.16, h: h * 0.34, seg: 8, color: P.trunkDark, cap: false });
  cylinder(m, { y: h * 0.34, r: r * 1.16, r2: r, h: h * 0.66, seg: 8, color: P.trunk, cap: false });
  // 방사형 뿌리 버팀 5 개 — 밑동에서 땅으로 뻗어 나간다
  rootFlares(m, { r: base, rt: r * 1.3, up: h * 0.46, n: 5, len: r * 0.5, color: P.trunkDark, seed: seed + 7 });
  // 잘린 면의 나이테 — 홈을 지그재그로 파서 동심원이 잉크 선으로 잡힌다
  growthRings(m, { y: h, r, n: 3, seg: 8, depth: r * 0.13, color: P.wood, ringColor: '#e0c193' });
  // 세로 껍질 결
  for (let i = 0; i < 3; i++) {
    barkLine(m, { r: r * 1.02, a: 0.7 + i * 2.05, y0: h * 0.2, y1: h * 0.74, w: 0.06 * s, color: P.trunkDark });
  }
  return finish(m, { radius: base, kind: 'stump' });
}

/** 시트 3-⑯: 위쪽이 세로로 쪼개져 뾰족한 조각이 남은 그루터기. */
export function splitStump(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const s = rand(rng, 0.85, 1.2);
  const r = 0.34 * s;
  const bodyH = 0.34 * s;
  const seg = 8;
  cylinder(m, { r: r * 1.22, r2: r, h: bodyH, seg, color: P.trunk, cap: false });
  rootFlares(m, { r: r * 1.22, rt: r * 1.1, up: bodyH * 0.62, n: 4, len: r * 0.26, color: P.trunkDark, seed: seed + 5 });
  // 한가운데는 뻥 뚫려 있다 — 테두리 턱 → 깔때기 → 어두운 바닥 순으로 파고든다.
  // 매끈한 원뿔 네 개를 세우면 "톱니 왕관"이 되고, 속이 비어야 뜯긴 느낌이 산다.
  ringBand(m, { rOut: r, rIn: r * 0.62, yOut: bodyH, yIn: bodyH - 0.03 * s, seg, color: '#a9855c' });
  ringBand(m, { rOut: r * 0.62, rIn: r * 0.2, yOut: bodyH - 0.03 * s, yIn: bodyH - 0.2 * s, seg, color: '#8a6a45' });
  const floor = [];
  for (let i = 0; i < seg; i++) {
    const a = -(i / seg) * Math.PI * 2;
    floor.push([Math.cos(a) * r * 0.2, bodyH - 0.2 * s, Math.sin(a) * r * 0.2]);
  }
  poly(m, floor, '#6f5334');
  // 쪼개져 남은 조각 5 개 — [방위, 높이(r 배수), 폭(반각)]. 셋 다 제각각이라
  // 톱니 왕관이 아니라 "제멋대로 부러진" 형태가 된다.
  const shards = [
    [0.15, 1.5, 0.78],
    [1.4, 0.5, 0.4],
    [2.35, 1.05, 0.52],
    [3.6, 0.3, 0.36],
    [4.8, 0.75, 0.66],
  ];
  for (let i = 0; i < shards.length; i++) {
    const a = shards[i][0] + rand(rng, -0.14, 0.14);
    woodShard(m, {
      y: bodyH - 0.02 * s,
      a,
      half: shards[i][2],
      rOut: r * 1.02,
      rIn: r * 0.5,
      h: r * shards[i][1] * (0.88 + rng() * 0.3),
      lean: r * rand(rng, -0.06, 0.14),
      jag: rand(rng, 0.14, 0.4),
      color: P.trunk,
      side: P.wood,
    });
  }
  // 세로로 갈라진 결
  for (let i = 0; i < 3; i++) {
    barkLine(m, { r: r * 1.06, a: 0.5 + i * 2.1, y0: bodyH * 0.14, y1: bodyH * 0.8, w: 0.05 * s, color: P.trunkDark });
  }
  return finish(m, { radius: r * 1.2, kind: 'splitStump' });
}

/** 시트 3-⑳: 옆으로 누운 굵은 통나무 — 마구리 나이테가 주인공, 옆면엔 긴 껍질 결. */
export function log(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  // 그림은 "굵고 짧은" 토막이다 — 길이가 지름의 2.5 배쯤
  const r = rand(rng, 0.24, 0.3);
  const len = r * 2 * rand(rng, 2.2, 2.5);
  const seg = 8;
  // 로컬에서는 +y 로 세워 두고 마지막에 눕힌다
  const b = mesh();
  cylinder(b, { y: -len / 2, r, r2: r * 0.95, h: len, seg, color: P.trunk, cap: false });
  const ring = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    ring.push([Math.cos(a) * r, -len / 2, Math.sin(a) * r]);
  }
  poly(b, ring, P.trunkDark); // 반대쪽 마구리(노멀 -y)
  // 톱질한 마구리 — 동심원 홈이 이 모델의 얼굴이다
  growthRings(b, { y: len / 2, r: r * 0.95, n: 3, seg, depth: r * 0.13, color: P.wood, ringColor: '#e8d3ad' });
  // 길게 이어지는 껍질 결(옆면을 따라 흐르는 손그림 선)
  for (let i = 0; i < 4; i++) {
    const a = 0.5 + i * 1.5;
    barkLine(b, { r, a, y0: -len * (0.38 - i * 0.04), y1: len * (0.42 - i * 0.05), w: 0.036, color: P.trunkDark });
  }
  // 갤러리/게임 카메라(yaw 0.42)에서 마구리가 3/4 로 보이도록 축을 고정한다.
  // 방위를 완전히 랜덤으로 돌리면 마구리가 뒤로 숨어 납작한 판때기로 보인다.
  merge(m, b, { rx: Math.PI / 2, ry: -0.35 + rand(rng, -0.14, 0.14), ty: r });
  return finish(m, { radius: r * 1.6, kind: 'log' });
}

/** 시트 3-㉑: 잔가지와 새눈이 달린 떨어진 나뭇가지. */
export function branchProp(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const len = rand(rng, 1.0, 1.5);
  const r = 0.045;
  const b = mesh();
  // 로컬에서는 +y 로 세운 채 만들고 마지막에 눕힌다(길이 방향으로 가운데 정렬).
  const y0 = -len * 0.5;
  cylinder(b, { y: y0, r, r2: r * 0.8, h: len * 0.55, seg: 4, color: P.trunkDark, cap: false });
  const upper = mesh();
  cylinder(upper, { r: r * 0.8, r2: r * 0.4, h: len * 0.5, seg: 4, color: P.trunkDark, cap: false });
  merge(b, upper, { rz: 0.16, ty: y0 + len * 0.55 });
  // 잔가지 3개 + 새눈. 눕혔을 때 위를 향하도록 방위각은 π 언저리만 쓴다.
  const twigs = [[0.3, 0.6, 1.85], [0.55, 0.75, 3.55], [0.78, 0.55, 2.6]];
  for (let i = 0; i < twigs.length; i++) {
    const t0 = twigs[i][0];
    const tilt = twigs[i][1];
    const a = twigs[i][2];
    const tl = len * (0.2 + rng() * 0.14);
    const t = mesh();
    cylinder(t, { r: r * 0.45, r2: r * 0.18, h: tl, seg: 3, color: P.trunkDark, cap: false });
    merge(b, t, { rz: -tilt, ry: -a, ty: y0 + len * t0 });
    flatLeaf(b, {
      x: Math.sin(tilt) * Math.cos(a) * tl,
      y: y0 + len * t0 + Math.cos(tilt) * tl,
      z: Math.sin(tilt) * Math.sin(a) * tl,
      len: 0.11,
      wid: 0.07,
      dir: a,
      tilt: 0.5,
      color: P.leaf,
    });
  }
  merge(m, b, { rz: -Math.PI / 2, ry: rand(rng, 0, 3.14), ty: r * 1.1 });
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

/** 시트 3-㉒: 둥근 혹 예닐곱 개가 겹쳐 뭉게구름처럼 부푼 덤불(열매 옵션). */
export function bush(seed = 1, opt = {}) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = opt.color || pick(rng, [P.leaf, P.leafDark, '#a9cb84']);
  const s = rand(rng, 0.8, 1.15);
  const rx = 0.62 * s;
  const ry = 0.44 * s;
  // 밑에 살짝 드러난 짧은 줄기 그루
  cylinder(m, { r: 0.055 * s, r2: 0.04 * s, h: 0.17 * s, seg: 5, color: P.trunkDark, cap: false });
  // 그림은 가시 달린 공이 아니라 스캘럽(둥근 혹)이 이어진 구름이다 —
  // 잎끝을 밖으로 꽂으면 기뢰처럼 보이므로 실루엣을 혹으로만 울퉁불퉁하게 만든다.
  clumpCrown(m, {
    y: 0.46 * s,
    rx,
    ry,
    seg: 13,
    rings: 7,
    color,
    cells: [
      [0, 0, 0.6], [1, 6], [2, 0], [2, 5], [2, 9], [3, 2], [3, 7], [3, 11], [4, 4], [4, 10],
    ],
    amt: 0.56,
    spread: 1.02,
    core: 0.7,
    seed: seed + 2,
    yaw: rng() * 1.2,
  });
  if (opt.berries) {
    // 열매는 "그려진 동그라미" 한 장 — 바깥을 향해 눕힌 원판
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2;
      const phi = 0.6 + rng() * 0.5;
      disc(m, {
        x: Math.sin(phi) * Math.cos(a) * rx * 0.92,
        y: 0.46 * s + Math.cos(phi) * ry * 1.0,
        z: Math.sin(phi) * Math.sin(a) * rx * 0.92,
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
  const ry = 0.36 * s;
  cloudBlob(m, { y: 0.28 * s, rx, rz: rx * 0.72, ry, seg: 12, rings: 4, color, lobes: 7, amt: 0.4, sharp: 9, core: 0.74, top: 1, seed: seed + 8 });
  // 윗면에 자잘한 뾰족 잎
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng() * 0.4;
    const rr = rx * (0.5 + rng() * 0.3);
    leafTip(m, {
      x: Math.cos(a) * rr,
      y: 0.28 * s + ry * 0.66,
      z: Math.sin(a) * rr * 0.72,
      dir: a,
      out: 1.1,
      len: 0.24 * s,
      wid: 0.12 * s,
      color: i % 3 ? color : P.leafDark,
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
    cylinder(m, { x, y: sh - 0.32, r: 0.075, h: 0.28, seg: 5, color: P.trunkDark, cap: false });
    cone(m, { x, y: sh - 0.04, r: 0.075, h: 0.08, seg: 5, color: P.trunkDark });
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

/**
 * 아직 안 펴진 새순(도르르 말린 고사리 끝) — 안쪽으로 감기는 납작한 리본.
 * 반지름을 줄이면서 각도를 돌려 띠를 잇는다(면 n 개, 양면).
 */
function fiddlehead(m, { x = 0, y = 0, z = 0, r = 0.08, dir = 0, n = 9, turns = 1.55, w = 0.032, color = P.leaf }) {
  const b = mesh();
  const tmax = turns * Math.PI * 2;
  const pt = (k) => {
    const t = (k / n) * tmax;
    const rr = r * (1 - 0.78 * (k / n));
    const ww = w * (1 - 0.6 * (k / n));
    return [Math.cos(t) * rr, Math.sin(t) * rr, ww];
  };
  for (let k = 0; k < n; k++) {
    const a = pt(k);
    const c = pt(k + 1);
    quad(
      b,
      [a[0] - Math.cos((k / n) * tmax) * a[2], a[1] - Math.sin((k / n) * tmax) * a[2], 0],
      [a[0] + Math.cos((k / n) * tmax) * a[2], a[1] + Math.sin((k / n) * tmax) * a[2], 0],
      [c[0] + Math.cos(((k + 1) / n) * tmax) * c[2], c[1] + Math.sin(((k + 1) / n) * tmax) * c[2], 0],
      [c[0] - Math.cos(((k + 1) / n) * tmax) * c[2], c[1] - Math.sin(((k + 1) / n) * tmax) * c[2], 0],
      color,
      { double: true }
    );
  }
  merge(m, b, { ry: -dir, tx: x, ty: y, tz: z });
  return m;
}

/**
 * 시트 2 아랫줄의 고사리 — 밑동에서 부챗살로 뻗은 길고 넓은 잎날 대여섯 장,
 * 그 사이로 돌돌 말린 새순 하나가 대에 얹혀 올라온다.
 * (예전엔 깃털잎을 수십 장 붙였는데, 잎이 손톱만 해서 화면에서는
 *  윤곽선만 뭉쳐 새까만 얼룩으로 보였다. 그림처럼 큼직한 잎날로 바꿨다)
 */
export function fernPlant(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = pick(rng, [P.leaf, '#8ab96a', P.grassDeep]);
  const dark = shade(color, -0.05);
  const blades = randInt(rng, 5, 7);
  const base = rng() * Math.PI * 2;
  for (let f = 0; f < blades; f++) {
    // 부챗살 — 가운데 잎이 가장 길고 곧게 서고, 바깥으로 갈수록 짧고 크게 눕는다
    const t = blades === 1 ? 0 : f / (blades - 1) - 0.5;
    const dir = base + t * 4.6 + rand(rng, -0.18, 0.18);
    const len = rand(rng, 0.62, 0.78) * (1 - Math.abs(t) * 0.26);
    // 잎면이 위를 보게 눕혀 심는다 — 세워 두면 옆에서 볼 때 선만 남아 까맣게 뭉친다
    flatLeaf(m, {
      len,
      wid: len * rand(rng, 0.24, 0.32),
      dir,
      tilt: 0.62 + Math.abs(t) * 0.42 + rand(rng, -0.08, 0.08),
      color: f % 2 ? color : dark,
    });
    // 잎날 밑동에 짧은 곁잎 — 그림처럼 밑이 수북해 보이게
    if (rng() < 0.6) {
      flatLeaf(m, {
        y: 0.01,
        len: len * 0.46,
        wid: len * 0.17,
        dir: dir + rand(rng, -0.6, 0.6),
        tilt: 0.3,
        color: dark,
      });
    }
  }
  // 아직 안 펴진 새순 — 활처럼 휜 대 끝에 나선이 달린다
  const fd = base + Math.PI * 0.55 + rand(rng, -0.3, 0.3);
  const fl = 0.34;
  const ft = [0.2, 0.5];
  let qx = 0;
  let qy = 0;
  let qz = 0;
  for (let s = 0; s < ft.length; s++) {
    const st = mesh();
    cylinder(st, { r: 0.016 - s * 0.004, r2: 0.012 - s * 0.003, h: fl, seg: 3, color: P.grassDeep, cap: false });
    merge(m, st, { rz: -ft[s], ry: -fd, tx: qx, ty: qy, tz: qz });
    qx += Math.sin(ft[s]) * Math.cos(fd) * fl;
    qy += Math.cos(ft[s]) * fl;
    qz += Math.sin(ft[s]) * Math.sin(fd) * fl;
  }
  fiddlehead(m, { x: qx, y: qy + 0.12, z: qz, r: 0.14, w: 0.05, dir: fd + Math.PI / 2, color });
  return finish(m, { radius: 0.4, sway: 1.8, kind: 'fern' });
}

/** 톱니 잎 위로 솟은 민들레 — 홀씨 공과 노란 꽃 한 송이. */
export function dandelion(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const h = rand(rng, 0.42, 0.56);
  // 밑동의 큼직한 톱날 잎 로제트 — 퍼진 폭이 키만큼 넓고, 비스듬히 들려 있다.
  // 이 로제트가 민들레의 인상 절반을 차지하므로 크고 굵게 깐다.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rng() * 0.4;
    flatLeaf(m, {
      y: 0.012 + i * 0.004,
      len: h * rand(rng, 0.62, 0.8),
      wid: h * 0.34,
      dir: a,
      // 그림처럼 비스듬히 들려 있어야 톱니가 옆 실루엣으로 잡힌다
      tilt: rand(rng, 0.5, 0.82),
      shape: 'saw',
      color: pick(rng, [P.leaf, P.grassDeep]),
    });
  }
  // 홀씨 줄기
  cylinder(m, { r: 0.012, h, seg: 3, color: P.grassDeep, cap: false });
  // 홀씨 공 — 가시 별이 아니라 자잘한 혹이 촘촘한 동글동글 보송한 공
  blobSphere(m, {
    y: h + 0.085,
    rx: 0.085,
    ry: 0.082,
    seg: 7,
    rings: 4,
    color: '#f4f1e6',
    wob: 0.07,
    bumps: 6,
    bumpAmt: 0.2,
    seed: seed + 4,
  });
  // 옆에 선 노란 꽃 한 송이
  const fh = h * 0.66;
  const fa = rng() * Math.PI * 2;
  const fx = Math.cos(fa) * 0.1;
  const fz = Math.sin(fa) * 0.1;
  cylinder(m, { x: fx, z: fz, r: 0.011, h: fh, seg: 3, color: P.grassDeep, cap: false });
  for (let i = 0; i < 5; i++) {
    const pa = (i / 5) * Math.PI * 2 + fa;
    flatLeaf(m, { x: fx, y: fh, z: fz, len: 0.06, wid: 0.045, dir: pa, tilt: 0.3, shape: 'round', color: P.leafGold });
  }
  disc(m, { x: fx, y: fh + 0.016, z: fz, r: 0.022, seg: 6, color: '#e0a63f', double: true });
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
  blobSphere(m, { x: 0.02, z: -0.04, y: fh + 0.035, rx: 0.042, ry: 0.038, seg: 6, rings: 3, color: '#f3efe1', wob: 0.14, seed: seed + 6 });
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
  // 갓은 지름이 높이의 세 배쯤 — 폭이 넓고 낮게 도톰한 돔
  const capR = 0.17 * s;
  const capH = 0.105 * s;
  const seg = 7;
  // 대는 밑동이 불룩하게 부풀었다가 위로 갈수록 홀쭉해진다
  cylinder(m, { r: 0.062 * s, r2: 0.042 * s, h: stemH * 0.42, seg: 6, color: '#f2e7cf', cap: false });
  cylinder(m, { y: stemH * 0.42, r: 0.042 * s, r2: 0.046 * s, h: stemH * 0.58, seg: 6, color: '#f2e7cf', cap: false });
  // 갓 밑면(주름) — 아래를 보는 원판
  const und = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    und.push([Math.cos(a) * capR, stemH, Math.sin(a) * capR]);
  }
  poly(m, und, '#e4d3b4');
  // 돔 — 위로 갈수록 급하게 좁아지는 세 단
  cylinder(m, { y: stemH, r: capR, r2: capR * 0.91, h: capH * 0.3, seg, color: capColor, cap: false });
  cylinder(m, { y: stemH + capH * 0.3, r: capR * 0.91, r2: capR * 0.7, h: capH * 0.34, seg, color: capColor, cap: false });
  cylinder(m, {
    y: stemH + capH * 0.64,
    r: capR * 0.7,
    r2: capR * 0.36,
    h: capH * 0.36,
    seg,
    color: capColor,
    cap: true,
    capColor,
  });
  // 갓 위 동그란 점무늬 6개 — 그림처럼 큼직하게
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rng() * 0.5;
    const t = 0.3 + (i % 3) * 0.22;
    const rr = capR * t;
    const yy = stemH + capH * (t < 0.45 ? 0.99 : t < 0.7 ? 0.67 : 0.34) + 0.004 * s;
    disc(m, {
      x: Math.cos(a) * rr,
      y: yy,
      z: Math.sin(a) * rr,
      r: 0.03 * s,
      seg: 7,
      color: '#f6efdd',
      double: true,
    });
  }
  return finish(m, { radius: capR, kind: 'mushroom' });
}

/**
 * 시트 2: 땅에 떨어져 납작하게 누운 단풍잎 — 손바닥처럼 갈라진 갈래 일곱 장.
 * 갈래를 한 점에서 부챗살로 펼치고 y 를 아주 조금씩 어긋나게 쌓아
 * 같은 높이에서 깜빡이지 않게 한다.
 */
export function fallenLeaf(seed = 1) {
  const rng = makeRng(seed);
  const m = mesh();
  const color = pick(rng, [P.leafRust, P.leafGold, '#cf7a45', '#d8a24f', '#b8894a']);
  const s = rand(rng, 0.85, 1.25);
  const base = rng() * Math.PI * 2;
  const spread = 2.6; // 갈래가 펼쳐진 각도
  const lobes = [0.62, 0.8, 0.94, 1.0, 0.94, 0.8, 0.62];
  const n = lobes.length;
  for (let i = 0; i < n; i++) {
    const a = base + (i / (n - 1) - 0.5) * spread + rand(rng, -0.07, 0.07);
    flatLeaf(m, {
      y: 0.012 * s + i * 0.0016,
      len: 0.4 * s * lobes[i],
      wid: 0.16 * s,
      dir: a,
      tilt: 0,
      shape: 'lobe',
      color,
    });
  }
  // 잎자루 — 부챗살 반대쪽으로 짧게 뻗은 얇은 판
  const pa = base + Math.PI;
  const pw = 0.016 * s;
  const pl = 0.17 * s;
  quad(
    m,
    [-Math.sin(pa) * pw, 0.01 * s, Math.cos(pa) * pw],
    [Math.sin(pa) * pw, 0.01 * s, -Math.cos(pa) * pw],
    [Math.cos(pa) * pl + Math.sin(pa) * pw * 0.5, 0.01 * s, Math.sin(pa) * pl - Math.cos(pa) * pw * 0.5],
    [Math.cos(pa) * pl - Math.sin(pa) * pw * 0.5, 0.01 * s, Math.sin(pa) * pl + Math.cos(pa) * pw * 0.5],
    P.trunkDark,
    { double: true }
  );
  return finish(m, { radius: 0.34 * s, sway: 0, kind: 'fallenLeaf' });
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
