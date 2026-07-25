// 3D 메시 렌더러 — 툰 면 채색 + 손그림 잉크 외곽선.
// 실루엣(앞면/뒷면 경계)과 크리스(꺾인 모서리)만 선을 그어서 "연필로 그린 3D" 느낌을 낸다.
import { buildEdges, faceNormal, centroid, bounds } from '../core/mesh.js';
import { INK } from '../core/sketch.js';
import { shade } from '../art/palette.js';
import { clamp } from '../core/rng.js';
import { isInk, paperTone, Theme, mul } from '../core/theme.js';

// 고정 광원 (왼쪽 위 앞)
const LX = -0.46;
const LY = 0.79;
const LZ = 0.41;

const CREASE_COS = Math.cos(0.62); // 이보다 많이 꺾이면 선을 긋는다

function toonColor(base, nx, ny, nz) {
  const ndl = nx * LX + ny * LY + nz * LZ;
  if (isInk()) {
    // 색칠 안 한 버전 — 종이 흰색 위에 아주 옅은 회색 단계로만 형태를 잡는다
    let amt;
    if (ndl > 0.62) amt = 1.0;
    else if (ndl > 0.12) amt = 0.972;
    else if (ndl > -0.35) amt = 0.925;
    else amt = 0.885;
    if (ny < -0.45) amt -= 0.03;
    return mul(paperTone(base), amt);
  }
  let amt;
  if (ndl > 0.62) amt = 0.1;
  else if (ndl > 0.12) amt = 0.012;
  else if (ndl > -0.35) amt = -0.085;
  else amt = -0.15;
  if (ny < -0.45) amt -= 0.06; // 아래를 보는 면은 더 어둡게
  return shade(base, amt);
}

/**
 * 모델을 월드에 배치한 인스턴스로 굽는다(정점·노멀·조명 색을 미리 계산).
 * 오브젝트는 움직이지 않으므로 이 계산은 한 번이면 된다.
 */
export function instantiate(model, { x = 0, y = 0, z = 0, ry = 0, scale = 1 } = {}) {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const src = model.verts;
  const verts = new Float64Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const vx = src[i] * scale;
    const vy = src[i + 1] * scale;
    const vz = src[i + 2] * scale;
    verts[i] = x + vx * cos + vz * sin;
    verts[i + 1] = y + vy;
    verts[i + 2] = z + (-vx * sin + vz * cos);
  }

  const n = [];
  const c = [];
  const faces = model.faces.map((f) => {
    faceNormal(verts, f.v, n);
    centroid(verts, f.v, c);
    return {
      v: f.v,
      nx: n[0],
      ny: n[1],
      nz: n[2],
      cx: c[0],
      cy: c[1],
      cz: c[2],
      color: toonColor(f.color, n[0], n[1], n[2]),
      double: f.double,
      outline: f.outline,
      soft: f.soft,
    };
  });

  const edges = (model.edges || (model.edges = buildEdges(model))).map((e) => {
    let crease = true;
    if (e.f2 >= 0) {
      const a = faces[e.f1];
      const b = faces[e.f2];
      const d = a.nx * b.nx + a.ny * b.ny + a.nz * b.nz;
      crease = d < CREASE_COS && !(a.soft && b.soft);
    }
    return { a: e.a, b: e.b, f1: e.f1, f2: e.f2, crease };
  });

  const bb = model.bb || (model.bb = bounds(model));
  return {
    themeVersion: Theme.version,
    verts,
    faces,
    edges,
    height: bb.h * scale,
    radius: (Math.max(bb.w, bb.d) / 2) * scale,
    x,
    y,
    z,
  };
}

// 정점 투영 결과를 담아 두는 스크래치 버퍼
let SX = new Float64Array(0);
let SY = new Float64Array(0);
let SOK = new Uint8Array(0);
const _p = { x: 0, y: 0, scale: 0, depth: 0, visible: false };
let ORDER = [];

function ensure(n) {
  if (SX.length < n) {
    SX = new Float64Array(n);
    SY = new Float64Array(n);
    SOK = new Uint8Array(n);
  }
}

// 잉크 선 흔들림 — 엣지마다 고정된 값이라 카메라가 움직여도 선이 요동치지 않는다
function hash01(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296 - 0.5;
}

/**
 * 인스턴스 하나를 그린다.
 * @returns 그린 면 개수(성능 계측용)
 */
export function drawInstance(ctx, cam, inst, opts = {}) {
  const { alpha = 1, lineScale = 1, wobble = 1.15, outline = true } = opts;
  const verts = inst.verts;
  const nv = verts.length / 3;
  ensure(nv);

  let minDepth = Infinity;
  let avgScale = 0;
  let okCount = 0;
  for (let i = 0, vi = 0; i < nv; i++, vi += 3) {
    cam.project(verts[vi], verts[vi + 1], verts[vi + 2], _p);
    if (_p.visible) {
      SX[i] = _p.x;
      SY[i] = _p.y;
      SOK[i] = 1;
      avgScale += _p.scale;
      okCount++;
      if (_p.depth < minDepth) minDepth = _p.depth;
    } else {
      SOK[i] = 0;
    }
  }
  if (!okCount) return 0;
  avgScale /= okCount;

  // 앞면만 고르고 깊이순 정렬
  const faces = inst.faces;
  ORDER.length = 0;
  const ortho = !!cam.ortho;
  for (let fi = 0; fi < faces.length; fi++) {
    const f = faces[fi];
    let vx;
    let vy;
    let vz;
    if (ortho) {
      vx = -cam.fx;
      vy = -cam.fy;
      vz = -cam.fz;
    } else {
      vx = cam.px - f.cx;
      vy = cam.py - f.cy;
      vz = cam.pz - f.cz;
    }
    const facing = f.nx * vx + f.ny * vy + f.nz * vz;
    if (!f.double && facing <= 0) continue;
    let ok = true;
    for (let k = 0; k < f.v.length; k++) {
      if (!SOK[f.v[k]]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const depth = ortho
      ? f.cx * cam.fx + f.cy * cam.fy + f.cz * cam.fz
      : (f.cx - cam.px) * cam.fx + (f.cy - cam.py) * cam.fy + (f.cz - cam.pz) * cam.fz;
    ORDER.push({ f, fi, depth, flip: facing < 0 });
  }
  if (!ORDER.length) return 0;
  ORDER.sort((a, b) => b.depth - a.depth);

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;

  // 어떤 면이 몇 번째로 그려지는지 — 선을 "가장 가까운 면"에 맡겨서
  // 뒤에 가려진 선이 앞면에 덮이도록(간이 히든라인 제거) 만든다.
  const nf = faces.length;
  if (!inst._rank || inst._rank.length < nf) inst._rank = new Int32Array(nf);
  const rank = inst._rank;
  rank.fill(-1, 0, nf);
  for (let i = 0; i < ORDER.length; i++) rank[ORDER[i].fi] = i;

  let buckets = null;
  if (outline) {
    buckets = inst._buckets || (inst._buckets = []);
    for (let i = 0; i < ORDER.length; i++) {
      if (!buckets[i]) buckets[i] = [];
      else buckets[i].length = 0;
    }
    const edges = inst.edges;
    for (let ei = 0; ei < edges.length; ei++) {
      const e = edges[ei];
      if (!SOK[e.a] || !SOK[e.b]) continue;
      const r1 = rank[e.f1];
      const r2 = e.f2 >= 0 ? rank[e.f2] : -1;
      const front1 = r1 >= 0;
      const front2 = r2 >= 0;
      if (!front1 && !front2) continue;
      let draw;
      if (e.f2 < 0) draw = front1 && faces[e.f1].outline;
      else {
        const showBoth = faces[e.f1].outline && faces[e.f2].outline;
        draw = (front1 !== front2 && (front1 ? faces[e.f1].outline : faces[e.f2].outline)) || (e.crease && front1 && front2 && showBoth);
      }
      if (!draw) continue;
      const owner = Math.max(r1, r2);
      buckets[owner].push(ei);
    }
  }

  const lw = clamp(avgScale * 0.028 * lineScale, 0.7, 3.4);
  const amp = clamp(avgScale * 0.02, 0.5, 2.6) * wobble;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;

  const edges = inst.edges;
  for (let i = 0; i < ORDER.length; i++) {
    const f = ORDER[i].f;
    const idx = f.v;
    ctx.beginPath();
    ctx.moveTo(SX[idx[0]], SY[idx[0]]);
    for (let k = 1; k < idx.length; k++) ctx.lineTo(SX[idx[k]], SY[idx[k]]);
    ctx.closePath();
    ctx.fillStyle = f.color;
    ctx.fill();

    if (!buckets) continue;
    const list = buckets[i];
    if (!list || !list.length) continue;
    ctx.beginPath();
    for (let n = 0; n < list.length; n++) {
      const e = edges[list[n]];
      const x1 = SX[e.a];
      const y1 = SY[e.a];
      const x2 = SX[e.b];
      const y2 = SY[e.b];
      const k = (e.a * 73856093) ^ (e.b * 19349663);
      const mx = (x1 + x2) / 2 + hash01(k) * amp * 2.4;
      const my = (y1 + y2) / 2 + hash01(k + 1) * amp * 2.4;
      ctx.moveTo(x1 + hash01(k + 2) * amp, y1 + hash01(k + 3) * amp);
      ctx.quadraticCurveTo(mx, my, x2 + hash01(k + 4) * amp, y2 + hash01(k + 5) * amp);
    }
    ctx.stroke();
  }

  ctx.restore();
  return ORDER.length;
}

function isFront(cam, f, ortho) {
  if (ortho) return f.nx * -cam.fx + f.ny * -cam.fy + f.nz * -cam.fz > 0;
  return f.nx * (cam.px - f.cx) + f.ny * (cam.py - f.cy) + f.nz * (cam.pz - f.cz) > 0;
}

// ── 임포스터(원거리 대체 스프라이트) ─────────────
/** 게임 카메라와 같은 각도를 쓰는 평행투영 카메라 */
export class OrthoCam {
  constructor(yaw, pitch, ppu) {
    this.ortho = true;
    this.yaw = yaw;
    this.pitch = pitch;
    this.ppu = ppu;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    this.fx = -sy * cp;
    this.fy = -sp;
    this.fz = -cy * cp;
    const rl = Math.hypot(this.fz, this.fx) || 1;
    this.rx = -this.fz / rl;
    this.ry = 0;
    this.rz = this.fx / rl;
    this.ux = -this.rz * this.fy;
    this.uy = this.rz * this.fx - this.rx * this.fz;
    this.uz = this.rx * this.fy;
    const ul = Math.hypot(this.ux, this.uy, this.uz) || 1;
    this.ux /= ul;
    this.uy /= ul;
    this.uz /= ul;
    this.ox = 0;
    this.oy = 0;
    // 백페이스 판정에 쓰는 가상의 카메라 위치(아주 먼 곳)
    this.px = -this.fx * 1000;
    this.py = -this.fy * 1000;
    this.pz = -this.fz * 1000;
  }

  project(x, y, z, out) {
    const vx = x * this.rx + y * this.ry + z * this.rz;
    const vy = x * this.ux + y * this.uy + z * this.uz;
    out.x = this.ox + vx * this.ppu;
    out.y = this.oy - vy * this.ppu;
    out.scale = this.ppu;
    out.depth = x * this.fx + y * this.fy + z * this.fz;
    out.visible = true;
    return out;
  }
}

/**
 * 모델을 한 각도에서 미리 렌더해 스프라이트로 만든다.
 * 멀리 있는 물체는 이걸로 그려서 폴리곤 수를 줄인다.
 */
export function bakeImpostor(model, { yaw = 0, pitch = 0.36, ppu = 42, scale = 1, maxPx = 460 } = {}) {
  const inst = instantiate(model, { x: 0, y: 0, z: 0, ry: 0, scale });
  const cam = new OrthoCam(yaw, pitch, ppu);
  // 경계상자 8점을 투영해 캔버스 크기를 정한다
  const bb = model.bb || (model.bb = bounds(model));
  let minX = 1e9;
  let minY = 1e9;
  let maxX = -1e9;
  let maxY = -1e9;
  const o = {};
  for (const cx of [bb.minX, bb.maxX]) {
    for (const cy of [bb.minY, bb.maxY]) {
      for (const cz of [bb.minZ, bb.maxZ]) {
        cam.project(cx * scale, cy * scale, cz * scale, o);
        if (o.x < minX) minX = o.x;
        if (o.x > maxX) maxX = o.x;
        if (o.y < minY) minY = o.y;
        if (o.y > maxY) maxY = o.y;
      }
    }
  }
  const pad = 4;
  let w = Math.ceil(maxX - minX) + pad * 2;
  let h = Math.ceil(maxY - minY) + pad * 2;
  let k = 1;
  if (Math.max(w, h) > maxPx) {
    k = maxPx / Math.max(w, h);
    w = Math.ceil(w * k);
    h = Math.ceil(h * k);
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, w);
  canvas.height = Math.max(2, h);
  const ctx = canvas.getContext('2d');
  if (k !== 1) ctx.scale(k, k);
  cam.ox = -minX + pad;
  cam.oy = -minY + pad;
  drawInstance(ctx, cam, inst, { lineScale: 0.85, wobble: 1 });

  // 모델 원점(발밑)이 캔버스 어디에 오는지
  cam.project(0, 0, 0, o);
  return {
    canvas,
    ax: (o.x * k) / canvas.width,
    ay: (o.y * k) / canvas.height,
    aspect: canvas.width / canvas.height,
    unitsTall: canvas.height / (ppu * k),
  };
}

/** 여러 yaw 각도로 임포스터를 구워 두고, 카메라 각도에 맞춰 골라 쓴다 */
export function bakeImpostorSet(model, { yaws = [-0.62, 0, 0.62], pitch = 0.36, ppu = 40, scale = 1 } = {}) {
  const frames = yaws.map((y) => bakeImpostor(model, { yaw: y, pitch, ppu, scale }));
  return {
    yaws,
    frames,
    pick(yaw) {
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < yaws.length; i++) {
        const d = Math.abs(yaws[i] - yaw);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      return frames[best];
    },
  };
}
