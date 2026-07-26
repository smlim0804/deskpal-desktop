// 시트 6 "NPCS / CREATURES" — 병아리, 구름양, 유령, 로봇, 달팽이, 애벌레, 벌레, 가시몬, 버섯족
import { bake, shape, line, ellipse, blob, stipple, INK } from '../core/sketch.js';
import { P, shade } from './palette.js';

const W = 120;
const H = 120;

function eyes(ctx, cx, cy, gap = 9, r = 2.4, closed = false) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    if (closed) {
      ctx.beginPath();
      ctx.moveTo(cx + s * gap - 4, cy);
      ctx.quadraticCurveTo(cx + s * gap, cy - 3, cx + s * gap + 4, cy);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(cx + s * gap, cy, r, r * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function smile(ctx, cx, cy, w = 6) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy);
  ctx.quadraticCurveTo(cx, cy + w * 0.7, cx + w / 2, cy);
  ctx.stroke();
  ctx.restore();
}

const DRAW = {
  chick(ctx, rng, k) {
    const cx = W / 2;
    const cy = H - 34 - k * 3;
    ellipse(ctx, cx, cy, 26, 25, { rng, fill: '#f4dd8e', width: 2.3 });
    for (const s of [-1, 1]) ellipse(ctx, cx + s * 26, cy + 4, 9, 7, { rng, fill: '#f4dd8e', width: 2, rot: s * 0.4 });
    shape(ctx, [[cx - 5, cy + 2], [cx + 5, cy + 2], [cx, cy + 9]], { rng, fill: P.flowerYellow, width: 1.8, close: true });
    eyes(ctx, cx, cy - 6, 9, 2.6);
    for (const s of [-1, 1]) line(ctx, cx + s * 8, cy + 24, cx + s * 8, H - 6, { rng, width: 2 });
    line(ctx, cx, cy - 24, cx + 2, cy - 34, { rng, width: 2 });
    ellipse(ctx, cx + 3, cy - 36, 3, 3, { rng, fill: '#f4dd8e', width: 1.6 });
  },
  cloudSheep(ctx, rng, k) {
    const cx = W / 2;
    const cy = H - 46 - k * 2;
    blob(ctx, cx, cy, 40, 26, { rng, fill: P.flowerWhite, width: 2.4, lumps: 11, lumpAmt: 0.2 });
    eyes(ctx, cx - 6, cy, 9, 2.4);
    smile(ctx, cx - 6, cy + 8, 8);
    for (const s of [-1, 1]) {
      line(ctx, cx + s * 16, cy + 22, cx + s * 16, H - 6, { rng, width: 2.2 });
      line(ctx, cx + s * 26, cy + 20, cx + s * 27, H - 8, { rng, width: 2.2 });
    }
  },
  ghost(ctx, rng, k) {
    const cx = W / 2;
    const cy = H - 58 - k * 4;
    shape(
      ctx,
      [
        [cx - 26, cy + 34],
        [cx - 28, cy - 6],
        [cx - 14, cy - 30],
        [cx + 12, cy - 30],
        [cx + 27, cy - 4],
        [cx + 26, cy + 34],
        [cx + 13, cy + 26],
        [cx, cy + 36],
        [cx - 13, cy + 26],
      ],
      { rng, fill: 'rgba(246,241,228,0.92)', width: 2.3, close: true }
    );
    eyes(ctx, cx, cy - 6, 10, 3);
    smile(ctx, cx, cy + 6, 9);
  },
  robot(ctx, rng, k) {
    const cx = W / 2;
    const cy = H - 46 - k * 2;
    shape(
      ctx,
      [
        [cx - 26, cy + 26],
        [cx - 26, cy - 24],
        [cx + 26, cy - 24],
        [cx + 26, cy + 26],
      ],
      { rng, fill: '#dfe3e6', width: 2.4, close: true }
    );
    eyes(ctx, cx, cy - 6, 10, 2.6);
    smile(ctx, cx, cy + 6, 9);
    line(ctx, cx, cy - 24, cx + 2, cy - 40, { rng, width: 1.8 });
    ellipse(ctx, cx + 3, cy - 42, 3.4, 3.4, { rng, fill: P.flowerYellow, width: 1.6 });
    for (const s of [-1, 1]) line(ctx, cx + s * 12, cy + 26, cx + s * 12, H - 6, { rng, width: 2.4 });
  },
  snail(ctx, rng, k) {
    const cx = W / 2 + 4;
    const cy = H - 30;
    // 몸
    shape(
      ctx,
      [
        [cx - 44, cy + 6],
        [cx - 40, cy - 8],
        [cx - 26, cy - 16],
        [cx + 20, cy - 8],
        [cx + 40, cy + 6],
      ],
      { rng, fill: '#e6d9c0', width: 2.2, close: true }
    );
    // 껍데기 나선
    ellipse(ctx, cx + 12, cy - 18, 24, 22, { rng, fill: P.flowerYellow, width: 2.3 });
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const r = 3 + a * 2.6;
      const x = cx + 12 + Math.cos(a) * r;
      const y = cy - 18 + Math.sin(a) * r;
      a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    // 눈 더듬이
    for (const s of [-1, -0.4]) {
      const ex = cx - 34 + s * 4;
      line(ctx, ex + 6, cy - 12, ex, cy - 30 - k * 2, { rng, width: 1.8 });
      ellipse(ctx, ex, cy - 32 - k * 2, 3.4, 3.4, { rng, fill: P.flowerWhite, width: 1.6 });
    }
    eyes(ctx, cx - 30, cy - 4, 5, 1.6);
  },
  bug(ctx, rng, k) {
    const cx = W / 2;
    const cy = H - 40 - k * 2;
    ellipse(ctx, cx, cy, 30, 22, { rng, fill: '#e8d6a8', width: 2.3 });
    line(ctx, cx - 26, cy - 4, cx + 26, cy - 4, { rng, width: 1.6 });
    eyes(ctx, cx, cy + 2, 9, 2.4);
    smile(ctx, cx, cy + 12, 7);
    for (const s of [-1, 1]) {
      line(ctx, cx + s * 12, cy - 18, cx + s * 22, cy - 40, { rng, width: 1.6 });
      ellipse(ctx, cx + s * 23, cy - 42, 3, 3, { rng, fill: null, width: 1.6 });
      for (let i = 0; i < 3; i++) line(ctx, cx + s * (8 + i * 8), cy + 16, cx + s * (14 + i * 10), H - 6, { rng, width: 1.8 });
    }
  },
  spiky(ctx, rng, k) {
    const cx = W / 2;
    const cy = H - 40 - k * 2;
    const pts = [];
    const n = 12;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? 32 : 24;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92]);
    }
    shape(ctx, pts, { rng, fill: '#cfe0a8', width: 2.2, close: true });
    eyes(ctx, cx, cy - 4, 9, 2.6);
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 8);
    ctx.quadraticCurveTo(cx, cy + 17, cx + 8, cy + 8);
    ctx.stroke();
    ctx.restore();
    // 이빨
    for (const s of [-1, 1]) {
      shape(ctx, [[cx + s * 4, cy + 10], [cx + s * 7, cy + 15], [cx + s * 1, cy + 14]], {
        rng,
        fill: P.flowerWhite,
        width: 1,
        close: true,
      });
    }
  },
  mushroomFolk(ctx, rng, k) {
    const cx = W / 2;
    const cy = H - 30 - k * 2;
    shape(
      ctx,
      [
        [cx - 12, cy],
        [cx - 9, cy - 34],
        [cx + 9, cy - 34],
        [cx + 12, cy],
      ],
      { rng, fill: P.cloth, width: 2.2, close: true }
    );
    eyes(ctx, cx, cy - 20, 6, 2);
    smile(ctx, cx, cy - 12, 6);
    shape(
      ctx,
      [
        [cx - 40, cy - 32],
        [cx - 32, cy - 58],
        [cx, cy - 68],
        [cx + 32, cy - 58],
        [cx + 40, cy - 32],
        [cx, cy - 26],
      ],
      { rng, fill: '#dd9a86', width: 2.3, close: true }
    );
    for (let i = 0; i < 4; i++) {
      ellipse(ctx, cx - 22 + rng() * 44, cy - 56 + rng() * 20, 5, 4, { rng, fill: P.flowerWhite, width: 1.2 });
    }
    for (const s of [-1, 1]) ellipse(ctx, cx + s * 9, cy + 2, 6.5, 4, { rng, fill: P.flowerWhite, width: 1.8 });
  },
  worm(ctx, rng, k) {
    const cx = W / 2;
    const cy = H - 20;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      pts.push([cx - 34 + i * 9, cy - Math.sin(i * 0.9 + k * 1.4) * 5]);
    }
    shape(ctx, pts, { rng, fill: null, stroke: '#e8b7a8', width: 8, close: false, passes: 1 });
    shape(ctx, pts, { rng, fill: null, stroke: INK, width: 1.6, close: false, passes: 1 });
    ellipse(ctx, cx + 36, cy - Math.sin(8 * 0.9 + k * 1.4) * 5 - 2, 8, 7, { rng, fill: '#e8b7a8', width: 2 });
    eyes(ctx, cx + 37, cy - 4, 3, 1.4);
  },
};

// 까마귀 — 감자 도둑. 웅크린 몸 + 큰 부리 + 꽁지깃
DRAW.crow = (ctx, rng, k) => {
  const bob = k ? 1.4 : 0;
  // 꽁지깃
  shape(
    ctx,
    [
      [W * 0.32, H * 0.62 + bob],
      [W * 0.06, H * 0.42 + bob],
      [W * 0.1, H * 0.6 + bob],
      [W * 0.3, H * 0.74 + bob],
    ],
    { rng, fill: '#2e2a33', width: 2.4, close: true }
  );
  // 몸통
  blob(ctx, W * 0.5, H * 0.58 + bob, W * 0.24, H * 0.24, { rng, fill: '#3a3542', width: 2.6, lumps: 8, lumpAmt: 0.1 });
  // 머리
  blob(ctx, W * 0.66, H * 0.36 + bob * 0.6, W * 0.15, H * 0.15, { rng, fill: '#3a3542', width: 2.4, lumps: 7, lumpAmt: 0.08 });
  // 부리
  shape(
    ctx,
    [
      [W * 0.78, H * 0.33 + bob * 0.6],
      [W * 0.98, H * 0.4 + bob * 0.6],
      [W * 0.78, H * 0.45 + bob * 0.6],
    ],
    { rng, fill: '#c9a05c', width: 2, close: true }
  );
  // 눈
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.arc(W * 0.68, H * 0.34 + bob * 0.6, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(W * 0.69, H * 0.345 + bob * 0.6, 1.7, 0, Math.PI * 2);
  ctx.fill();
  // 날개 접힘 선
  line(ctx, W * 0.38, H * 0.5 + bob, W * 0.6, H * 0.66 + bob, { rng, width: 2 });
  // 다리
  for (const s of [-1, 1]) {
    line(ctx, W * 0.5 + s * W * 0.07, H * 0.8 + bob, W * 0.5 + s * W * 0.1, H * 0.97, { rng, width: 2 });
  }
};

// 나비 — 팔랑이는 두 장 날개
DRAW.butterfly = (ctx, rng, k) => {
  const sp = k ? 0.5 : 1; // 날개 펼침
  for (const s of [-1, 1]) {
    blob(ctx, W * 0.5 + s * W * 0.17 * sp, H * 0.42, W * 0.15 * sp + 2, H * 0.16, {
      rng,
      fill: '#d9b74f',
      width: 2,
      lumps: 7,
      lumpAmt: 0.12,
    });
    blob(ctx, W * 0.5 + s * W * 0.12 * sp, H * 0.6, W * 0.1 * sp + 2, H * 0.11, {
      rng,
      fill: '#c9974a',
      width: 1.8,
      lumps: 6,
      lumpAmt: 0.12,
    });
  }
  ellipse(ctx, W * 0.5, H * 0.52, 3.2, H * 0.17, { rng, fill: INK, width: 1.6 });
  line(ctx, W * 0.5, H * 0.36, W * 0.42, H * 0.24, { rng, width: 1.4 });
  line(ctx, W * 0.5, H * 0.36, W * 0.58, H * 0.24, { rng, width: 1.4 });
};

export const CRITTER_META = {
  crow: { h: 0.72, r: 0.35 },
  butterfly: { h: 0.4, r: 0.2 },
  chick: { h: 0.62, r: 0.3 },
  cloudSheep: { h: 1.15, r: 0.5 },
  ghost: { h: 1.25, r: 0.4 },
  robot: { h: 1.1, r: 0.4 },
  snail: { h: 0.75, r: 0.45 },
  bug: { h: 0.95, r: 0.4 },
  spiky: { h: 0.85, r: 0.4 },
  mushroomFolk: { h: 1.0, r: 0.35 },
  worm: { h: 0.3, r: 0.2 },
};

export function bakeCritter(kind, seed = 3) {
  const draw = DRAW[kind] || DRAW.chick;
  const meta = CRITTER_META[kind] || { h: 1, r: 0.4 };
  return {
    idle: [0, 1].map((k) =>
      bake({
        w: W,
        h: H,
        seed: seed + k * 7,
        ss: 1.8,
        pad: 12,
        draw: (ctx, rng) => draw(ctx, rng, k),
      })
    ),
    height: meta.h,
    radius: meta.r,
  };
}
