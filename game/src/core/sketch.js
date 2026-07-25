// 손그림(잉크 펜) 프리미티브 + 스프라이트 베이킹.
// 라인은 매 프레임 다시 그리지 않고, 시작할 때 한 번 오프스크린 캔버스에 구워서
// "떨리는 선"이 프레임마다 요동치지(boiling) 않게 한다.
import { makeRng } from './rng.js';

export const INK = '#33302b';
export const INK_SOFT = 'rgba(51,48,43,0.55)';

// ── 경로 만들기 ───────────────────────────────
export function jitter(pts, rng, amp = 1.2) {
  const out = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    out[i] = [pts[i][0] + (rng() - 0.5) * amp * 2, pts[i][1] + (rng() - 0.5) * amp * 2];
  }
  return out;
}

/**
 * 점들을 이어 Path2D 를 만든다.
 * corner: 0 이면 각진 폴리라인, 0.5 면 완전히 둥근 곡선(기본).
 * 삼각 텐트·지붕처럼 각이 살아야 하는 건 작은 값을 준다.
 */
export function smoothPath(pts, close = false, corner = 0.5) {
  const p = new Path2D();
  const n = pts.length;
  if (n === 0) return p;
  if (n === 1) {
    p.moveTo(pts[0][0], pts[0][1]);
    return p;
  }
  if (corner < 0.48) {
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (close) {
      const b0 = mix(pts[0], pts[1 % n], corner);
      p.moveTo(b0[0], b0[1]);
      for (let i = 1; i <= n; i++) {
        const v = pts[i % n];
        const prev = pts[(i - 1 + n) % n];
        const next = pts[(i + 1) % n];
        const a = mix(v, prev, corner);
        const b = mix(v, next, corner);
        p.lineTo(a[0], a[1]);
        p.quadraticCurveTo(v[0], v[1], b[0], b[1]);
      }
      p.closePath();
      return p;
    }
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const v = pts[i];
      const a = mix(v, pts[i - 1], corner);
      const b = mix(v, pts[i + 1], corner);
      p.lineTo(a[0], a[1]);
      p.quadraticCurveTo(v[0], v[1], b[0], b[1]);
    }
    p.lineTo(pts[n - 1][0], pts[n - 1][1]);
    return p;
  }
  if (close) {
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let prev = mid(pts[n - 1], pts[0]);
    p.moveTo(prev[0], prev[1]);
    for (let i = 0; i < n; i++) {
      const cur = pts[i];
      const nxt = pts[(i + 1) % n];
      const m = mid(cur, nxt);
      p.quadraticCurveTo(cur[0], cur[1], m[0], m[1]);
    }
    p.closePath();
    return p;
  }
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  p.lineTo(pts[n - 1][0], pts[n - 1][1]);
  return p;
}

// 타원 둘레 점
export function ellipsePts(cx, cy, rx, ry, segs = 14, rot = 0) {
  const pts = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

// ── 그리기 ────────────────────────────────────
/**
 * 손그림 도형. 색 채우기는 라인과 살짝 어긋나게 칠해서 그림책 느낌을 낸다.
 */
export function shape(ctx, pts, opts = {}) {
  const {
    rng = Math.random,
    fill = null,
    stroke = INK,
    width = 2,
    rough = 1.1,
    close = true,
    passes = 2,
    fillShift = 1.4,
    alpha = 1,
    corner = 0.5,
  } = opts;

  if (fill) {
    const fpts = jitter(pts, rng, rough * 0.7).map(([x, y]) => [x + fillShift * 0.6, y - fillShift * 0.5]);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fill(smoothPath(fpts, close, corner));
    ctx.restore();
  }

  if (!stroke || width <= 0) return;
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    ctx.lineWidth = width * (p === 0 ? 1 : 0.66);
    ctx.globalAlpha = alpha * (p === 0 ? 1 : 0.42);
    ctx.stroke(smoothPath(jitter(pts, rng, rough), close, corner));
  }
  ctx.restore();
}

export function line(ctx, x1, y1, x2, y2, opts = {}) {
  const { rng = Math.random, segs = 3 } = opts;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
  }
  shape(ctx, pts, { ...opts, rng, close: false, fill: null });
}

export function ellipse(ctx, cx, cy, rx, ry, opts = {}) {
  const segs = opts.segs || Math.max(10, Math.round((rx + ry) * 0.5));
  shape(ctx, ellipsePts(cx, cy, rx, ry, segs, opts.rot || 0), { ...opts, close: true });
}

export function blob(ctx, cx, cy, rx, ry, opts = {}) {
  const { rng = Math.random, lumps = 9, lumpAmt = 0.16 } = opts;
  const pts = [];
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2;
    const k = 1 + (rng() - 0.5) * 2 * lumpAmt;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  shape(ctx, pts, { ...opts, close: true });
}

// 평행선 해칭 그림자
export function hatch(ctx, clipPath, box, opts = {}) {
  const { rng = Math.random, color = INK, spacing = 6, angle = -0.9, width = 1, alpha = 0.28 } = opts;
  ctx.save();
  ctx.clip(clipPath);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  const [x0, y0, x1, y1] = box;
  const diag = Math.hypot(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  for (let d = -diag / 2; d <= diag / 2; d += spacing) {
    const ox = cx + nx * d;
    const oy = cy + ny * d;
    const w = (rng() - 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(ox - dx * diag * 0.5 + w, oy - dy * diag * 0.5);
    ctx.quadraticCurveTo(ox + w * 0.5, oy, ox + dx * diag * 0.5 - w, oy + dy * diag * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

// 점 찍기(질감)
export function stipple(ctx, cx, cy, rx, ry, count, opts = {}) {
  const { rng = Math.random, color = INK, alpha = 0.4, size = 1 } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng());
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, size * (0.6 + rng() * 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── 스프라이트 베이킹 ─────────────────────────
/**
 * @param {{w:number,h:number,seed?:number,ss?:number,ax?:number,ay?:number,draw:Function}} spec
 * ax/ay 는 앵커(0~1). 기본값은 발밑 중앙(0.5, 1).
 */
export function bake(spec) {
  const { w, h, seed = 1, ss = 2, ax = 0.5, ay = 1, draw, pad = 6 } = spec;
  const cw = Math.ceil((w + pad * 2) * ss);
  const ch = Math.ceil((h + pad * 2) * ss);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.scale(ss, ss);
  ctx.translate(pad, pad);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx, makeRng(seed), w, h);
  const totalW = w + pad * 2;
  const totalH = h + pad * 2;
  return {
    canvas,
    w: totalW,
    h: totalH,
    // 앵커를 패딩 포함 비율로 환산
    ax: (pad + w * ax) / totalW,
    ay: (pad + h * ay) / totalH,
    aspect: totalW / totalH,
  };
}

/** 화면에 스프라이트 배치. sy 는 앵커(보통 발밑)의 화면 Y */
export function drawSprite(ctx, sp, sx, sy, screenH, alpha = 1, flip = false) {
  if (!sp || screenH <= 0.4) return;
  const screenW = screenH * sp.aspect;
  const x = sx - screenW * sp.ax;
  const y = sy - screenH * sp.ay;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.translate(x + screenW / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sp.canvas, -screenW / 2, y, screenW, screenH);
  } else {
    ctx.drawImage(sp.canvas, x, y, screenW, screenH);
  }
  ctx.restore();
}

// 종이 질감 타일 (화면 전체에 곱해서 깔면 스케치북 느낌)
export function makePaperTile(size = 256, seed = 7) {
  const rng = makeRng(seed);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 232 + rng() * 23;
    img.data[i] = n;
    img.data[i + 1] = n - 3;
    img.data[i + 2] = n - 10;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // 결 무늬
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#b9ae95';
  for (let i = 0; i < 90; i++) {
    const y = rng() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rng() - 0.5) * 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return c;
}
