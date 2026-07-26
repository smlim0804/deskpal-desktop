// 진짜 3D 지형 — 이전에는 화면에 칠한 평면 그라디언트라서 오브젝트가 스티커처럼 떠 보였다.
// 이제 땅도 폴리곤이고, 나무·건물·캐릭터는 전부 이 높이 위에 앉는다.
import { clamp, smoothstep } from '../core/rng.js';
import { isInk, isValheim, FOG } from '../core/theme.js';


export const WORLD_RADIUS = 46;
export const GATE = { x: 0, z: 17 };
export const PLAZA = { x: 0, z: 0 };
export const POND = { x: 15.5, z: 7.5, r: 6.2 };
export const WATER_Y = -0.26;

// 마을 안쪽 길(대문 → 광장 → 서쪽, 광장 → 연못)
const PATHS = [
  [
    [0, 20],
    [0, 12],
    [0.6, 6],
    [0, 0],
    [-5.5, -2.5],
    [-10, -5.5],
  ],
  [
    [0, 0],
    [5, 1.5],
    [9.5, 3.5],
    [13, 5.5],
  ],
];

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function distToPath(x, z) {
  let best = 1e9;
  for (const line of PATHS) {
    for (let i = 0; i < line.length - 1; i++) {
      const d = distToSegment(x, z, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

/** 완만한 구릉. 마을 광장과 길 주변은 평탄하게, 연못은 파여 있다. */
export function heightAt(x, z) {
  let h =
    0.78 * Math.sin(x * 0.071 + 0.7) * Math.cos(z * 0.083 - 0.4) +
    0.34 * Math.sin(x * 0.116 - 1.2) * Math.sin(z * 0.098 + 2.1) +
    0.12 * Math.sin((x + z) * 0.155 + 0.6);

  // 바깥으로 갈수록 살짝 솟아 분지처럼 보이게
  const dv = Math.hypot(x, z);
  h += smoothstep(clamp((dv - 18) / 26, 0, 1)) * 1.5;

  // 광장은 평평
  h *= smoothstep(clamp((dv - 6) / 9, 0, 1));

  // 길 주변도 평탄하게 눌러 준다
  const dp = distToPath(x, z);
  if (dp < 4) h *= 0.35 + 0.65 * smoothstep(clamp((dp - 1.4) / 2.6, 0, 1));

  // 연못은 파임
  const dw = Math.hypot(x - POND.x, z - POND.z);
  if (dw < POND.r + 2.2) {
    const k = 1 - smoothstep(clamp((dw - POND.r * 0.15) / (POND.r + 2.2), 0, 1));
    h -= 1.15 * k;
  }
  return h;
}

/** 지면 법선(색·음영 계산용) */
export function normalAt(x, z, e = 0.6) {
  const hl = heightAt(x - e, z);
  const hr = heightAt(x + e, z);
  const hd = heightAt(x, z - e);
  const hu = heightAt(x, z + e);
  const nx = hl - hr;
  const nz = hd - hu;
  const ny = 2 * e;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

// ── 색 ────────────────────────────────────────
// 셀 단위로 색을 "고르면" 커다란 조각보처럼 보이므로, 두 풀색 사이를 부드럽게 섞고
// 빛도 밴딩 없이 연속으로 준다. 길·광장 흙빛은 지형색이 아니라 바닥 데칼이 담당.
const GRASS_A = [182, 211, 141];
const GRASS_B = [155, 192, 115];
const GRASS_DRY = [201, 208, 152];
const SAND = [221, 208, 168];
const MUD = [140, 166, 116];

const LX = -0.46;
const LY = 0.79;
const LZ = 0.41;

function cellColor(x, z, h, n, dd = 0) {
  const t =
    0.5 + 0.35 * Math.sin(x * 0.17 + 1.1) * Math.cos(z * 0.143 - 0.6) + 0.15 * Math.sin((x - z) * 0.061 + 0.9);
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  let r = GRASS_B[0] + (GRASS_A[0] - GRASS_B[0]) * k;
  let g = GRASS_B[1] + (GRASS_A[1] - GRASS_B[1]) * k;
  let b = GRASS_B[2] + (GRASS_A[2] - GRASS_B[2]) * k;
  if (k > 0.78) {
    const d = ((k - 0.78) / 0.22) * 0.55;
    r += (GRASS_DRY[0] - r) * d;
    g += (GRASS_DRY[1] - g) * d;
    b += (GRASS_DRY[2] - b) * d;
  }
  // 물가 모래 / 물 밑 진흙 — 거리가 아니라 "수면과의 높이차"로 정해야 물가를 따라 자연스럽게 두른다
  const dw = Math.hypot(x - POND.x, z - POND.z);
  if (dw < POND.r + 3.5) {
    if (h < WATER_Y) {
      r += (MUD[0] - r) * 0.9;
      g += (MUD[1] - g) * 0.9;
      b += (MUD[2] - b) * 0.9;
    } else {
      const d = clamp(1 - (h - WATER_Y) / 0.5, 0, 1) * 0.85;
      r += (SAND[0] - r) * d;
      g += (SAND[1] - g) * d;
      b += (SAND[2] - b) * d;
    }
  }
  // 연속적인 명암
  const ndl = n[0] * LX + n[1] * LY + n[2] * LZ;
  if (isInk()) {
    // 색칠 안 한 버전 — 종이 그대로, 기울기만 아주 옅은 회색으로
    const v = clamp(249 + (ndl - 0.97) * 90, 226, 252);
    return `rgb(${v | 0},${(v - 2) | 0},${(v - 6) | 0})`;
  }
  if (isValheim()) {
    // 채도를 죽인 이끼빛 들판 + 따뜻한 태양/차가운 그늘 + 거리 안개
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = (lum + (r - lum) * 0.5) * 0.66;
    g = (lum + (g - lum) * 0.5) * 0.72;
    b = (lum + (b - lum) * 0.5) * 0.62;
    const t = clamp((ndl - 0.86) / 0.14, 0, 1);
    const sun = t * t * (3 - 2 * t);
    r *= 0.5 + 0.72 * sun;
    g *= 0.53 + 0.66 * sun;
    b *= 0.6 + 0.52 * sun;
    const fog = smoothstep(clamp((dd - 13) / 33, 0, 1)) * 0.92;
    r += (FOG[0] - r) * fog;
    g += (FOG[1] - g) * fog;
    b += (FOG[2] - b) * fog;
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  const f = clamp(0.94 + (ndl - 0.95) * 0.9, 0.86, 1.04);
  return `rgb(${(r * f) | 0},${(g * f) | 0},${(b * f) | 0})`;
}

// ── 클립맵 지형 렌더러 ─────────────────────────
// 카메라 주변만 촘촘히, 멀수록 성기게 그린다. 격자를 셀 크기에 맞춰 스냅해서
// 카메라가 움직여도 색이 깜빡이지 않는다.
const LEVELS = [
  { cell: 1.7, n: 20 },
  { cell: 5.5, n: 16 },
  { cell: 14, n: 10 },
];

export class Terrain {
  constructor() {
    this.cache = new Map(); // 높이 캐시 (같은 격자점을 여러 번 쓰므로)
    this.cells = [];
    this._p = { x: 0, y: 0, scale: 0, depth: 0, visible: false };
  }

  h(x, z) {
    const k = Math.round(x * 8) * 100000 + Math.round(z * 8);
    let v = this.cache.get(k);
    if (v === undefined) {
      v = heightAt(x, z);
      if (this.cache.size > 60000) this.cache.clear();
      this.cache.set(k, v);
    }
    return v;
  }

  draw(ctx, cam, maxDist = 52) {
    const cells = this.cells;
    cells.length = 0;
    const cx = cam.tx;
    const cz = cam.tz;

    for (let li = LEVELS.length - 1; li >= 0; li--) {
      const L = LEVELS[li];
      const c = L.cell;
      const half = (L.n * c) / 2;
      const ox = Math.round(cx / c) * c;
      const oz = Math.round(cz / c) * c;
      // 더 촘촘한 레벨이 덮는 영역(완전히 포함될 때만 건너뛴다 → 틈이 생기지 않음)
      let inner = 0;
      if (li > 0) {
        const F = LEVELS[li - 1];
        inner = (F.n * F.cell) / 2 - F.cell;
      }
      const innerX = li > 0 ? Math.round(cx / LEVELS[li - 1].cell) * LEVELS[li - 1].cell : 0;
      const innerZ = li > 0 ? Math.round(cz / LEVELS[li - 1].cell) * LEVELS[li - 1].cell : 0;

      for (let gx = -half; gx < half; gx += c) {
        for (let gz = -half; gz < half; gz += c) {
          const x0 = ox + gx;
          const z0 = oz + gz;
          const x1 = x0 + c;
          const z1 = z0 + c;
          if (inner) {
            if (
              x0 >= innerX - inner &&
              x1 <= innerX + inner &&
              z0 >= innerZ - inner &&
              z1 <= innerZ + inner
            )
              continue;
          }
          const mx = x0 + c / 2;
          const mz = z0 + c / 2;
          const dd = Math.hypot(mx - cam.px, mz - cam.pz);
          if (dd > maxDist) continue;
          cells.push({ x0, z0, x1, z1, mx, mz, dd });
        }
      }
    }

    cells.sort((a, b) => b.dd - a.dd);

    const p = this._p;
    for (let i = 0; i < cells.length; i++) {
      const q = cells[i];
      const h00 = this.h(q.x0, q.z0);
      const h10 = this.h(q.x1, q.z0);
      const h11 = this.h(q.x1, q.z1);
      const h01 = this.h(q.x0, q.z1);

      cam.project(q.x0, h00, q.z0, p);
      if (!p.visible) continue;
      const ax = p.x;
      const ay = p.y;
      cam.project(q.x1, h10, q.z0, p);
      if (!p.visible) continue;
      const bx = p.x;
      const by = p.y;
      cam.project(q.x1, h11, q.z1, p);
      if (!p.visible) continue;
      const cx2 = p.x;
      const cy2 = p.y;
      cam.project(q.x0, h01, q.z1, p);
      if (!p.visible) continue;
      const dx2 = p.x;
      const dy2 = p.y;

      // 화면 밖이면 건너뛰기
      const minX = Math.min(ax, bx, cx2, dx2);
      const maxX = Math.max(ax, bx, cx2, dx2);
      const minY = Math.min(ay, by, cy2, dy2);
      const maxY = Math.max(ay, by, cy2, dy2);
      if (maxX < -20 || minX > cam.w + 20 || maxY < -20 || minY > cam.h + 20) continue;

      const cellSize = q.x1 - q.x0;
      const nx = h00 + h01 - h10 - h11;
      const nz = h00 + h10 - h01 - h11;
      const ny = 2 * cellSize;
      const len = Math.hypot(nx, ny, nz) || 1;
      ctx.fillStyle = cellColor(q.mx, q.mz, (h00 + h11) / 2, [nx / len, ny / len, nz / len], q.dd);
      ctx.globalAlpha = clamp((maxDist - q.dd) / 9, 0, 1);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx2, cy2);
      ctx.lineTo(dx2, dy2);
      ctx.closePath();
      ctx.fill();
      // 셀 사이 안티앨리어싱 틈으로 배경이 비쳐 격자선처럼 보이는 걸 같은 색 획으로 메운다
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return cells.length;
  }

  /**
   * 물가 선 — 지형 높이가 수면과 만나는 지점을 각도별로 찾아 둔다.
   * 그래야 물이 잔디 위로 넘치지 않고 실제 웅덩이처럼 고인다.
   */
  shoreline() {
    if (this._shore) return this._shore;
    const pts = [];
    const N = 44;
    let minR = 1e9;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let lo = 0.4;
      let hi = POND.r + 3.5;
      for (let k = 0; k < 14; k++) {
        const mid = (lo + hi) / 2;
        const h = heightAt(POND.x + Math.cos(a) * mid, POND.z + Math.sin(a) * mid);
        if (h < WATER_Y) lo = mid;
        else hi = mid;
      }
      minR = Math.min(minR, lo);
      pts.push([POND.x + Math.cos(a) * lo, POND.z + Math.sin(a) * lo]);
    }
    this._shore = pts;
    this._shoreMin = minR;
    return pts;
  }

  /** 연못 수면 — 지형이 파여 있어서 물이 고인 것처럼 보인다 */
  drawWater(ctx, cam, time) {
    const p = this._p;
    const shore = this.shoreline();
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= shore.length; i++) {
      const q = shore[i % shore.length];
      cam.project(q[0], WATER_Y, q[1], p);
      if (!p.visible) {
        ctx.restore();
        return;
      }
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = isInk() ? 'rgba(238,241,243,0.85)' : isValheim() ? 'rgba(52,78,88,0.9)' : 'rgba(158,206,213,0.82)';
    ctx.fill();
    ctx.strokeStyle = isValheim() ? 'rgba(26,38,44,0.4)' : 'rgba(51,48,43,0.35)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 물결
    ctx.strokeStyle = isInk() ? 'rgba(120,116,108,0.35)' : isValheim() ? 'rgba(214,228,232,0.22)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.4;
    const lim = (this._shoreMin || POND.r) - 0.5;
    for (let k = 0; k < 4; k++) {
      const rr = 0.8 + ((time * 0.42 + k * 1.1) % Math.max(1.5, lim));
      if (rr > lim) continue;
      ctx.globalAlpha = 0.4 * (1 - rr / POND.r);
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        cam.project(POND.x + Math.cos(a) * rr, WATER_Y + 0.01, POND.z + Math.sin(a) * rr, p);
        if (!p.visible) break;
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
