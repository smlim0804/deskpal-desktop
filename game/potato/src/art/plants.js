// 감자밭 식물 — 돈스타브처럼 굵은 잉크선에 끝이 말린 잎, 손그림 해칭.
// 성장 단계: 0 심음(새싹 점) → 1 떡잎 → 2 잎덤불 → 3 꽃 → 4 수확기(흙이 불룩).
import { bake, shape, line, ellipse, blob, smoothPath, hatch, stipple, INK } from '../core/sketch.js';
import { P, shade } from './palette.js';

const W = 110;
const H = 130;
const G = H - 4; // 땅 닿는 y

/** 끝이 돌돌 말린 잎 한 장 — 돈스타브 특유의 곱슬 실루엣 */
function curlyLeaf(ctx, rng, x, y, len, dir, color, tilt = -0.9) {
  const c = Math.cos(dir);
  const s = Math.sin(dir);
  const pts = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // 잎 축을 따라 가다가 끝에서 안쪽으로 말린다
    const curl = t > 0.72 ? (t - 0.72) * 3.4 : 0;
    const ax = x + c * len * t - s * curl * len * 0.22;
    const ay = y + s * len * t * tilt - len * t * (1 - t) * 0.35 + c * curl * len * 0.1;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * len * 0.26;
    pts.push([ax - s * w, ay - Math.abs(c) * w * 0.4]);
  }
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const curl = t > 0.72 ? (t - 0.72) * 3.4 : 0;
    const ax = x + c * len * t - s * curl * len * 0.22;
    const ay = y + s * len * t * tilt - len * t * (1 - t) * 0.35 + c * curl * len * 0.1;
    const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * len * 0.26;
    pts.push([ax + s * w, ay + Math.abs(c) * w * 0.4]);
  }
  shape(ctx, pts, { rng, fill: color, width: 2.4, close: true });
  // 잎맥
  line(ctx, x, y, x + c * len * 0.8, y + s * len * 0.8 * tilt - len * 0.18, { rng, width: 1.3, segs: 4 });
}

/** 흙 두둑(밭에 얹는 낮은 언덕) */
function soilMound(ctx, rng, cx, y, w, h, wet = false) {
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([cx - w / 2 + w * t, y - Math.sin(Math.PI * t) * h * (0.85 + rng() * 0.3)]);
  }
  pts.push([cx + w / 2, y + 2]);
  pts.push([cx - w / 2, y + 2]);
  shape(ctx, pts, { rng, fill: wet ? P.soilWet : P.soil, width: 2.6, close: true });
  stipple(ctx, cx, y - h * 0.4, w * 0.38, h * 0.5, 8, { rng, alpha: 0.3 });
}

function potatoBody(ctx, rng, cx, cy, rx, ry, color, face = true) {
  blob(ctx, cx, cy, rx, ry, { rng, fill: color, width: 2.6, lumps: 9, lumpAmt: 0.1 });
  // 눈(감자 눈 + 진짜 눈, 아기자기 포인트)
  stipple(ctx, cx - rx * 0.3, cy - ry * 0.25, rx * 0.5, ry * 0.45, 4, { rng, alpha: 0.35, size: 1.4 });
  if (face) {
    ctx.save();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.28, cy - ry * 0.1, 1.9, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + rx * 0.28, cy - ry * 0.1, 1.9, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy + ry * 0.24);
    ctx.quadraticCurveTo(cx, cy + ry * 0.24 + 2.6, cx + 3, cy + ry * 0.24);
    ctx.stroke();
    ctx.restore();
  }
}

// ── 성장 단계 ─────────────────────────────────
function stagePlanted(ctx, rng) {
  soilMound(ctx, rng, W / 2, G, 58, 13);
  // 심은 자리 표시 — 작은 새싹 점
  line(ctx, W / 2, G - 13, W / 2 - 1, G - 19, { rng, width: 2 });
  ellipse(ctx, W / 2 - 2, G - 21, 3, 2.2, { rng, fill: P.leaf, width: 1.6, rot: -0.5 });
  ellipse(ctx, W / 2 + 2, G - 20, 3, 2.2, { rng, fill: P.leaf, width: 1.6, rot: 0.5 });
}

function stageSprout(ctx, rng) {
  soilMound(ctx, rng, W / 2, G, 58, 13);
  line(ctx, W / 2, G - 12, W / 2, G - 30, { rng, width: 2.4, stroke: shade(P.stem, -0.06) });
  curlyLeaf(ctx, rng, W / 2, G - 28, 20, Math.PI * 0.9, P.leaf);
  curlyLeaf(ctx, rng, W / 2, G - 26, 22, Math.PI * 0.12, shade(P.leaf, -0.04));
  curlyLeaf(ctx, rng, W / 2 - 1, G - 32, 15, -Math.PI * 0.42, shade(P.leaf, 0.04), -0.3);
}

function stageBush(ctx, rng, big = false, dry = 0) {
  const leaf = dry > 0.5 ? P.leafDry : P.leaf;
  const k = big ? 1.25 : 1;
  soilMound(ctx, rng, W / 2, G, 62, 14);
  // 줄기 몇 가닥
  for (let i = -1; i <= 1; i++) {
    line(ctx, W / 2 + i * 8, G - 11, W / 2 + i * 14, G - 40 * k + Math.abs(i) * 6, {
      rng,
      width: 2.2,
      stroke: shade(P.stem, -0.04),
    });
  }
  // 곱슬잎을 부챗살로
  const n = big ? 8 : 6;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const dir = Math.PI - t * Math.PI;
    const lx = W / 2 + (t - 0.5) * 34 * k;
    const ly = G - 32 * k - Math.sin(t * Math.PI) * 12 * k;
    curlyLeaf(ctx, rng, lx, ly, (17 + Math.sin(t * Math.PI) * 9) * k, dir + (rng() - 0.5) * 0.4, i % 2 ? leaf : shade(leaf, -0.05));
  }
  // 가운데 봉긋한 잎무더기
  blob(ctx, W / 2, G - 42 * k, 22 * k, 13 * k, { rng, fill: shade(leaf, 0.03), width: 2.4, lumps: 10, lumpAmt: 0.2 });
  if (dry > 0.5) {
    // 마른 기색 — 처진 잎
    curlyLeaf(ctx, rng, W / 2 - 20, G - 18, 16, Math.PI * 0.86, P.leafDry, -0.1);
    curlyLeaf(ctx, rng, W / 2 + 20, G - 18, 16, Math.PI * 0.13, P.leafDry, -0.1);
  }
  return k;
}

function stageFlower(ctx, rng) {
  stageBush(ctx, rng, true);
  // 감자꽃 — 흰 꽃잎 5장에 노란 심
  for (const [fx, fy] of [
    [W / 2 - 16, G - 62],
    [W / 2 + 12, G - 66],
    [W / 2 + 2, G - 52],
  ]) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - 0.5;
      ellipse(ctx, fx + Math.cos(a) * 5.4, fy + Math.sin(a) * 5.4, 4.2, 3, {
        rng,
        fill: P.flowerWhite,
        width: 1.7,
        rot: a,
      });
    }
    ellipse(ctx, fx, fy, 2.8, 2.8, { rng, fill: P.flowerYellow, width: 1.6 });
  }
}

function stageReady(ctx, rng) {
  // 흙이 불룩 — 감자가 비집고 나온다
  soilMound(ctx, rng, W / 2, G, 70, 17);
  potatoBody(ctx, rng, W / 2 - 20, G - 7, 10, 7.5, P.potato, false);
  potatoBody(ctx, rng, W / 2 + 22, G - 6, 8.5, 6.5, P.potato, false);
  const leaf = shade(P.leaf, 0.02);
  for (let i = -1; i <= 1; i++) {
    line(ctx, W / 2 + i * 7, G - 14, W / 2 + i * 13, G - 46 + Math.abs(i) * 5, { rng, width: 2.3, stroke: P.stem });
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const dir = Math.PI - t * Math.PI;
    curlyLeaf(
      ctx,
      rng,
      W / 2 + (t - 0.5) * 40,
      G - 40 - Math.sin(t * Math.PI) * 14,
      19 + Math.sin(t * Math.PI) * 9,
      dir + (rng() - 0.5) * 0.4,
      i % 2 ? leaf : P.leafDark
    );
  }
  blob(ctx, W / 2, G - 52, 24, 14, { rng, fill: leaf, width: 2.4, lumps: 11, lumpAmt: 0.22 });
  // 반짝 표시 — 다 컸어요!
  for (const [sx, sy] of [
    [W / 2 - 34, G - 66],
    [W / 2 + 36, G - 60],
  ]) {
    line(ctx, sx - 4, sy, sx + 4, sy, { rng, width: 1.8 });
    line(ctx, sx, sy - 4, sx, sy + 4, { rng, width: 1.8 });
  }
}

function stageWilted(ctx, rng) {
  soilMound(ctx, rng, W / 2, G, 60, 12);
  for (let i = -1; i <= 1; i++) {
    const bend = i * 10;
    shape(
      ctx,
      [
        [W / 2 + i * 7, G - 10],
        [W / 2 + i * 12 + bend * 0.4, G - 26],
        [W / 2 + i * 10 + bend, G - 20],
      ],
      { rng, fill: null, width: 2.2, close: false }
    );
    curlyLeaf(ctx, rng, W / 2 + i * 10 + bend, G - 19, 13, i <= 0 ? Math.PI * 0.9 : Math.PI * 0.1, P.leafDry, 0.25);
  }
  stipple(ctx, W / 2, G - 16, 20, 10, 5, { rng, alpha: 0.3 });
}

// ── 기타 ─────────────────────────────────────
function weed(ctx, rng) {
  // 잡초 — 삐죽빼죽 뾰족풀 + 씨앗 알갱이
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = W / 2 + (t - 0.5) * 34;
    const h = 20 + Math.sin(t * Math.PI) * 16 + rng() * 8;
    const bend = (t - 0.5) * 18;
    shape(
      ctx,
      [
        [x, G],
        [x + bend * 0.4, G - h * 0.6],
        [x + bend, G - h],
      ],
      { rng, fill: null, width: 2.3, close: false, stroke: shade(P.grassDry, -0.18) }
    );
  }
  for (let i = 0; i < 3; i++) {
    ellipse(ctx, W / 2 + (rng() - 0.5) * 26, G - 24 - rng() * 12, 2.2, 2.2, { rng, fill: P.grassDry, width: 1.4 });
  }
}

function potatoItem(ctx, rng, golden = false) {
  const c = golden ? P.potatoGold : P.potato;
  potatoBody(ctx, rng, W / 2, G - 26, 26, 20, c, true);
  hatch(ctx, smoothPath([[W / 2 - 26, G - 46], [W / 2 + 26, G - 46], [W / 2 + 26, G - 6], [W / 2 - 26, G - 6]], true), [W / 2 - 26, G - 46, W / 2 + 26, G - 6], { rng, spacing: 7, alpha: 0.12 });
  if (golden) {
    for (const [sx, sy] of [
      [W / 2 - 30, G - 50],
      [W / 2 + 32, G - 42],
      [W / 2 + 6, G - 56],
    ]) {
      line(ctx, sx - 4.4, sy, sx + 4.4, sy, { rng, width: 2 });
      line(ctx, sx, sy - 4.4, sx, sy + 4.4, { rng, width: 2 });
    }
  }
}

const STAGES = [stagePlanted, stageSprout, (c, r) => stageBush(c, r, false), stageFlower, stageReady];

export function bakePlants() {
  const mk = (draw, seed, h) =>
    bake({ w: W, h: H, seed, ss: 1.7, pad: 10, draw: (ctx, rng) => draw(ctx, rng) });
  const out = {
    stages: STAGES.map((fn, i) => {
      const sp = mk(fn, 500 + i * 31);
      sp.hUnits = [0.6, 0.9, 1.4, 1.8, 1.75][i];
      return sp;
    }),
    dryBush: (() => {
      const sp = mk((c, r) => stageBush(c, r, false, 1), 771);
      sp.hUnits = 1.4;
      return sp;
    })(),
    wilted: (() => {
      const sp = mk(stageWilted, 801);
      sp.hUnits = 0.75;
      return sp;
    })(),
    weed: (() => {
      const sp = mk(weed, 831);
      sp.hUnits = 0.85;
      return sp;
    })(),
    potato: (() => {
      const sp = mk((c, r) => potatoItem(c, r, false), 861);
      sp.hUnits = 0.62;
      return sp;
    })(),
    goldPotato: (() => {
      const sp = mk((c, r) => potatoItem(c, r, true), 891);
      sp.hUnits = 0.65;
      return sp;
    })(),
  };
  return out;
}
