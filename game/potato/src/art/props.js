// 농장 둘레 소품 — 돈스타브처럼 뒤틀린 나무, 삐뚠 울타리, 낡은 헛간.
// 전부 세로로 서 있는 2D 종이 인형(빌보드)이고 발밑이 앵커다.
import { bake, shape, line, ellipse, blob, smoothPath, hatch, stipple, ellipsePts, INK } from '../core/sketch.js';
import { P, shade } from './palette.js';
import { makeRng, rand, pick } from '../core/rng.js';

function mk(w, h, seed, hUnits, draw, opt = {}) {
  const sp = bake({ w, h, seed, ss: opt.ss || 1.5, pad: opt.pad ?? 10, draw });
  sp.hUnits = hUnits;
  return sp;
}

/** 뒤틀린 줄기 — 돈스타브 나무의 핵심. 살짝 S자로 휘고 밑동이 넓다 */
function twistedTrunk(ctx, rng, cx, gy, topY, w, color) {
  const bend = (rng() - 0.5) * w * 1.6;
  const L = [];
  const R = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = gy - (gy - topY) * t;
    const x = cx + Math.sin(t * Math.PI) * bend * 0.5 + bend * t * 0.4;
    const hw = w * (1 - t * 0.55) * (0.72 + 0.28 * Math.cos(t * 2.4));
    L.push([x - hw, y]);
    R.push([x + hw, y]);
  }
  // 밑동 뿌리 벌어짐
  L[0][0] -= w * 0.5;
  R[0][0] += w * 0.5;
  const pts = [...L, ...R.reverse()];
  shape(ctx, pts, { rng, fill: color, width: 2.8, close: true, corner: 0.3 });
  // 옹이
  if (rng() < 0.7) {
    const ky = gy - (gy - topY) * (0.3 + rng() * 0.3);
    ellipse(ctx, cx + bend * 0.3, ky, 3.4, 4.6, { rng, fill: shade(color, -0.08), width: 1.6 });
  }
  return cx + bend * 0.9; // 꼭대기 x
}

// ── 나무들 ───────────────────────────────────
function roundTree(ctx, rng, W, H) {
  const gy = H - 4;
  const topX = twistedTrunk(ctx, rng, W / 2, gy, H * 0.42, W * 0.07, P.trunk);
  // 구름 캐노피 — 혹이 큼직큼직
  blob(ctx, topX, H * 0.28, W * 0.36, H * 0.24, { rng, fill: P.leafDark, width: 3, lumps: 10, lumpAmt: 0.22 });
  blob(ctx, topX - W * 0.14, H * 0.34, W * 0.2, H * 0.13, { rng, fill: P.leaf, width: 2.4, lumps: 8, lumpAmt: 0.2 });
  blob(ctx, topX + W * 0.12, H * 0.2, W * 0.17, H * 0.11, { rng, fill: shade(P.leafDark, 0.05), width: 2.4, lumps: 8, lumpAmt: 0.2 });
  // 캐노피에 소용돌이 한 줄 — 돈스타브 감성
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const sx = topX + W * 0.05;
  const sy = H * 0.26;
  for (let a = 0; a < Math.PI * 2.2; a += 0.3) {
    const r = 3 + a * 2.6;
    const x = sx + Math.cos(a + 1) * r;
    const y = sy + Math.sin(a + 1) * r * 0.8;
    a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function spikyTree(ctx, rng, W, H) {
  // 지그재그 침엽수 — 층층이 삐죽
  const gy = H - 4;
  twistedTrunk(ctx, rng, W / 2, gy, H * 0.66, W * 0.06, P.trunkDark);
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const y = H * (0.62 - t * 0.42);
    const w = W * (0.4 - t * 0.24);
    const pts = [];
    const teeth = 5;
    pts.push([W / 2 - w, y]);
    for (let k = 0; k <= teeth; k++) {
      const u = k / teeth;
      pts.push([W / 2 - w + w * 2 * u, y - ((k % 2 ? 0.2 : 1) * H * 0.09 + rng() * 3)]);
    }
    pts.push([W / 2 + w, y]);
    shape(ctx, pts, { rng, fill: i % 2 ? P.leafDark : shade(P.leafDark, -0.05), width: 2.6, close: true, corner: 0.12 });
  }
}

function deadTree(ctx, rng, W, H) {
  const gy = H - 4;
  const topX = twistedTrunk(ctx, rng, W / 2, gy, H * 0.3, W * 0.075, P.trunkDark);
  // 갈퀴 같은 가지
  for (const [dx, dy, len, a] of [
    [-2, H * 0.34, H * 0.2, -2.4],
    [2, H * 0.42, H * 0.24, -0.7],
    [0, H * 0.31, H * 0.17, -1.6],
  ]) {
    const x0 = topX + dx;
    const y0 = dy;
    const x1 = x0 + Math.cos(a) * len;
    const y1 = y0 + Math.sin(a) * len;
    line(ctx, x0, y0, x1, y1, { rng, width: 3, stroke: P.trunkDark });
    line(ctx, x1, y1, x1 + Math.cos(a + 0.7) * len * 0.4, y1 + Math.sin(a + 0.7) * len * 0.4, { rng, width: 2.2, stroke: P.trunkDark });
  }
}

// ── 울타리·건물 ──────────────────────────────
function fence(ctx, rng, W, H) {
  const gy = H - 4;
  // 삐뚤빼뚤 말뚝 3개 + 가로장 2개
  for (let i = 0; i < 3; i++) {
    const x = W * (0.16 + i * 0.34) + (rng() - 0.5) * 4;
    const lean = (rng() - 0.5) * 6;
    shape(
      ctx,
      [
        [x - 4, gy],
        [x - 3 + lean, gy - H * 0.6],
        [x + lean, gy - H * 0.7],
        [x + 3 + lean, gy - H * 0.6],
        [x + 4, gy],
      ],
      { rng, fill: P.wood, width: 2.6, close: true, corner: 0.15 }
    );
  }
  for (const y of [gy - H * 0.5, gy - H * 0.26]) {
    shape(
      ctx,
      [
        [2, y + (rng() - 0.5) * 5],
        [W / 2, y + (rng() - 0.5) * 5],
        [W - 2, y + (rng() - 0.5) * 5],
      ],
      { rng, fill: null, width: 4, close: false, stroke: shade(P.woodDark, -0.02) }
    );
  }
}

function shed(ctx, rng, W, H) {
  const gy = H - 4;
  // 낡은 판자 헛간 — 지붕이 축 처졌다
  shape(
    ctx,
    [
      [W * 0.1, gy],
      [W * 0.12, H * 0.42],
      [W * 0.88, H * 0.46],
      [W * 0.9, gy],
    ],
    { rng, fill: P.woodPale, width: 3, close: true, corner: 0.1 }
  );
  // 판자 줄
  for (let i = 1; i < 4; i++) {
    line(ctx, W * 0.12, H * 0.46 + (gy - H * 0.46) * (i / 4), W * 0.88, H * 0.48 + (gy - H * 0.48) * (i / 4), {
      rng,
      width: 1.6,
    });
  }
  // 처진 지붕
  shape(
    ctx,
    [
      [W * 0.02, H * 0.46],
      [W * 0.5, H * 0.3],
      [W * 0.98, H * 0.48],
      [W * 0.86, H * 0.42],
      [W * 0.5, H * 0.36],
      [W * 0.14, H * 0.44],
    ],
    { rng, fill: P.cloth, width: 2.8, close: true, corner: 0.12 }
  );
  // 문 + 창
  shape(
    ctx,
    [
      [W * 0.42, gy],
      [W * 0.42, H * 0.62],
      [W * 0.58, H * 0.62],
      [W * 0.58, gy],
    ],
    { rng, fill: P.woodDark, width: 2.4, close: true, corner: 0.1 }
  );
  ellipse(ctx, W * 0.55, H * 0.8, 1.8, 1.8, { rng, fill: INK, width: 1 });
  ellipse(ctx, W * 0.26, H * 0.6, 6.5, 6.5, { rng, fill: P.skyDayLow, width: 2.2 });
  line(ctx, W * 0.26 - 6.5, H * 0.6, W * 0.26 + 6.5, H * 0.6, { rng, width: 1.4 });
  line(ctx, W * 0.26, H * 0.6 - 6.5, W * 0.26, H * 0.6 + 6.5, { rng, width: 1.4 });
  hatch(ctx, smoothPath([[W * 0.6, H * 0.5], [W * 0.88, H * 0.48], [W * 0.9, gy], [W * 0.62, gy]], true), [W * 0.6, H * 0.46, W * 0.9, gy], { rng, spacing: 7, alpha: 0.15 });
}

function scarecrow(ctx, rng, W, H) {
  const gy = H - 4;
  // 장대 + 가로대
  line(ctx, W / 2, gy, W / 2, H * 0.24, { rng, width: 3.4, stroke: P.woodDark });
  line(ctx, W * 0.2, H * 0.42, W * 0.8, H * 0.4, { rng, width: 3, stroke: P.woodDark });
  // 몸통(자루 옷)
  shape(
    ctx,
    [
      [W * 0.36, H * 0.44],
      [W * 0.3, H * 0.72],
      [W * 0.7, H * 0.72],
      [W * 0.64, H * 0.44],
    ],
    { rng, fill: P.cloth, width: 2.6, close: true, corner: 0.2 }
  );
  line(ctx, W * 0.42, H * 0.55, W * 0.58, H * 0.55, { rng, width: 1.6 });
  // 소매 끝 지푸라기
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + s * W * 0.3;
      line(ctx, x, H * 0.41, x + s * 7, H * 0.41 + 5 + i * 3, { rng, width: 1.6, stroke: P.strawHat });
    }
  }
  // 감자 머리 + 밀짚모자
  blob(ctx, W / 2, H * 0.32, 13, 11, { rng, fill: P.potato, width: 2.6, lumps: 8, lumpAmt: 0.08 });
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(W / 2 - 4.4, H * 0.31, 1.8, 2.1, 0, 0, Math.PI * 2);
  ctx.ellipse(W / 2 + 4.4, H * 0.31, 1.8, 2.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  shape(
    ctx,
    [
      [W * 0.28, H * 0.27],
      [W * 0.42, H * 0.24],
      [W / 2, H * 0.17],
      [W * 0.58, H * 0.24],
      [W * 0.72, H * 0.27],
      [W / 2, H * 0.31],
    ],
    { rng, fill: P.strawHat, width: 2.4, close: true, corner: 0.25 }
  );
}

function well(ctx, rng, W, H) {
  const gy = H - 4;
  // 돌담 몸통
  shape(
    ctx,
    [
      [W * 0.2, gy],
      [W * 0.22, H * 0.6],
      [W * 0.78, H * 0.6],
      [W * 0.8, gy],
    ],
    { rng, fill: P.stone, width: 2.8, close: true, corner: 0.15 }
  );
  for (let i = 0; i < 5; i++) {
    ellipse(ctx, W * (0.3 + (i % 3) * 0.2), H * (0.68 + Math.floor(i / 3) * 0.14), 7, 4.6, {
      rng,
      fill: shade(P.stone, i % 2 ? -0.05 : 0.04),
      width: 1.8,
    });
  }
  // 기둥과 작은 지붕
  for (const s of [-1, 1]) line(ctx, W / 2 + s * W * 0.24, H * 0.6, W / 2 + s * W * 0.2, H * 0.3, { rng, width: 3, stroke: P.woodDark });
  shape(
    ctx,
    [
      [W * 0.16, H * 0.32],
      [W / 2, H * 0.16],
      [W * 0.84, H * 0.32],
      [W / 2, H * 0.26],
    ],
    { rng, fill: P.cloth, width: 2.6, close: true, corner: 0.1 }
  );
  // 도르래와 두레박
  line(ctx, W / 2, H * 0.26, W / 2, H * 0.46, { rng, width: 1.6 });
  shape(
    ctx,
    [
      [W * 0.44, H * 0.46],
      [W * 0.56, H * 0.46],
      [W * 0.54, H * 0.55],
      [W * 0.46, H * 0.55],
    ],
    { rng, fill: P.wood, width: 2, close: true }
  );
  // 물 반짝
  ellipse(ctx, W / 2, H * 0.62, W * 0.2, 4, { rng, fill: P.water, width: 2 });
}

function stall(ctx, rng, W, H) {
  const gy = H - 4;
  // 판매대 — 카운터 + 차양 + 감자 간판
  for (const s of [-1, 1]) line(ctx, W / 2 + s * W * 0.36, gy, W / 2 + s * W * 0.38, H * 0.3, { rng, width: 3.2, stroke: P.woodDark });
  shape(
    ctx,
    [
      [W * 0.08, H * 0.62],
      [W * 0.92, H * 0.62],
      [W * 0.9, gy],
      [W * 0.1, gy],
    ],
    { rng, fill: P.wood, width: 2.8, close: true, corner: 0.08 }
  );
  line(ctx, W * 0.1, H * 0.74, W * 0.9, H * 0.74, { rng, width: 1.6 });
  // 차양(스캘럽)
  const pts = [[W * 0.04, H * 0.3]];
  for (let i = 0; i <= 4; i++) pts.push([W * 0.04 + (W * 0.92 * i) / 4, H * 0.3 - (i % 2 ? 6 : 2)]);
  pts.push([W * 0.96, H * 0.3]);
  for (let i = 4; i >= 0; i--) {
    pts.push([W * 0.04 + (W * 0.92 * i) / 4 + W * 0.115, H * 0.4 + (i % 2 ? 4 : 0)]);
  }
  shape(ctx, pts, { rng, fill: P.cloth, width: 2.6, close: true, corner: 0.3 });
  // 카운터 위 감자 무더기
  for (const [px, py, r] of [
    [W * 0.3, H * 0.58, 7],
    [W * 0.44, H * 0.57, 8],
    [W * 0.6, H * 0.58, 7],
    [W * 0.37, H * 0.52, 6.4],
    [W * 0.52, H * 0.52, 6.4],
  ]) {
    blob(ctx, px, py, r, r * 0.76, { rng, fill: P.potato, width: 2, lumps: 7, lumpAmt: 0.08 });
  }
  // 매달린 코인 간판
  line(ctx, W * 0.74, H * 0.4, W * 0.74, H * 0.47, { rng, width: 1.5 });
  ellipse(ctx, W * 0.74, H * 0.52, 6.4, 6.4, { rng, fill: P.coin, width: 2 });
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.font = 'bold 9px "Comic Sans MS", cursive';
  ctx.strokeText('$', W * 0.72, H * 0.55);
  ctx.restore();
}

function barrel(ctx, rng, W, H) {
  const gy = H - 4;
  shape(
    ctx,
    [
      [W * 0.24, gy],
      [W * 0.17, H * 0.55],
      [W * 0.24, H * 0.26],
      [W * 0.76, H * 0.26],
      [W * 0.83, H * 0.55],
      [W * 0.76, gy],
    ],
    { rng, fill: P.wood, width: 2.8, close: true, corner: 0.4 }
  );
  ellipse(ctx, W / 2, H * 0.26, W * 0.26, 5.5, { rng, fill: P.waterDeep, width: 2.2 });
  for (const y of [H * 0.42, H * 0.78]) {
    line(ctx, W * 0.18, y, W * 0.82, y - 2, { rng, width: 3, stroke: P.metal });
  }
  // 빗물 반짝
  ellipse(ctx, W * 0.42, H * 0.26, 4, 1.6, { rng, fill: 'rgba(230,235,230,0.75)', width: 0 });
}

function rock(ctx, rng, W, H) {
  const gy = H - 6;
  blob(ctx, W / 2, gy - H * 0.2, W * 0.3, H * 0.2, { rng, fill: P.stone, width: 2.8, lumps: 7, lumpAmt: 0.18 });
  blob(ctx, W * 0.72, gy - H * 0.08, W * 0.12, H * 0.08, { rng, fill: shade(P.stone, -0.05), width: 2.2, lumps: 6, lumpAmt: 0.15 });
  line(ctx, W * 0.4, gy - H * 0.26, W * 0.5, gy - H * 0.18, { rng, width: 1.4 });
  stipple(ctx, W / 2, gy - H * 0.14, W * 0.2, H * 0.08, 6, { rng, alpha: 0.25 });
}

function grassTuft(ctx, rng, W, H) {
  const gy = H - 2;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x = W * 0.2 + W * 0.6 * t;
    const h = H * (0.3 + Math.sin(t * Math.PI) * 0.4) * (0.8 + rng() * 0.4);
    const bend = (t - 0.5) * W * 0.3;
    shape(
      ctx,
      [
        [x, gy],
        [x + bend * 0.3, gy - h * 0.6],
        [x + bend, gy - h],
      ],
      { rng, fill: null, width: 2.4, close: false, stroke: i % 2 ? P.grassDark : shade(P.grassDark, -0.06) }
    );
  }
}

function flowerProp(ctx, rng, W, H) {
  const gy = H - 2;
  const fx = W / 2 + (rng() - 0.5) * 8;
  line(ctx, fx, gy, fx - 2, gy - H * 0.4, { rng, width: 2, stroke: P.stem });
  curl(ctx, rng, fx - 6, gy - H * 0.2, 8, Math.PI * 0.8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - 0.6;
    ellipse(ctx, fx - 2 + Math.cos(a) * 6, gy - H * 0.44 + Math.sin(a) * 6, 4.6, 3.2, {
      rng,
      fill: pick(rng, [P.flowerWhite, '#d9a0a8', P.flowerYellow]),
      width: 1.7,
      rot: a,
    });
  }
  ellipse(ctx, fx - 2, gy - H * 0.44, 2.6, 2.6, { rng, fill: P.flowerYellow, width: 1.5 });
}

function curl(ctx, rng, x, y, r, dir) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 1.8; a += 0.3) {
    const rr = r * (1 - a / (Math.PI * 2.2));
    const px = x + Math.cos(a + dir) * rr;
    const py = y + Math.sin(a + dir) * rr;
    a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function signPost(ctx, rng, W, H) {
  const gy = H - 4;
  line(ctx, W / 2, gy, W / 2 - 2, H * 0.3, { rng, width: 3.2, stroke: P.woodDark });
  shape(
    ctx,
    [
      [W * 0.16, H * 0.3],
      [W * 0.8, H * 0.28],
      [W * 0.88, H * 0.36],
      [W * 0.8, H * 0.46],
      [W * 0.16, H * 0.44],
    ],
    { rng, fill: P.woodPale, width: 2.6, close: true, corner: 0.15 }
  );
  // 감자 그림 간판
  blob(ctx, W * 0.42, H * 0.37, 8, 6, { rng, fill: P.potato, width: 2, lumps: 7, lumpAmt: 0.08 });
  line(ctx, W * 0.55, H * 0.37, W * 0.68, H * 0.37, { rng, width: 2 });
}

function mailbox(ctx, rng, W, H) {
  const gy = H - 4;
  line(ctx, W / 2, gy, W / 2, H * 0.5, { rng, width: 3, stroke: P.woodDark });
  shape(
    ctx,
    [
      [W * 0.3, H * 0.5],
      [W * 0.3, H * 0.34],
      [W * 0.38, H * 0.26],
      [W * 0.62, H * 0.26],
      [W * 0.7, H * 0.34],
      [W * 0.7, H * 0.5],
    ],
    { rng, fill: P.clothBlue, width: 2.4, close: true, corner: 0.35 }
  );
  line(ctx, W * 0.3, H * 0.42, W * 0.7, H * 0.42, { rng, width: 1.6 });
  // 깃발
  line(ctx, W * 0.68, H * 0.32, W * 0.76, H * 0.2, { rng, width: 2 });
  shape(
    ctx,
    [
      [W * 0.76, H * 0.2],
      [W * 0.88, H * 0.23],
      [W * 0.76, H * 0.27],
    ],
    { rng, fill: P.cloth, width: 1.8, close: true }
  );
}

function crate(ctx, rng, W, H) {
  const gy = H - 4;
  shape(
    ctx,
    [
      [W * 0.2, gy],
      [W * 0.2, H * 0.42],
      [W * 0.8, H * 0.42],
      [W * 0.8, gy],
    ],
    { rng, fill: P.wood, width: 2.6, close: true, corner: 0.08 }
  );
  line(ctx, W * 0.2, H * 0.42, W * 0.8, gy, { rng, width: 2 });
  line(ctx, W * 0.8, H * 0.42, W * 0.2, gy, { rng, width: 2 });
  // 감자 삐죽
  blob(ctx, W * 0.38, H * 0.4, 7.4, 6, { rng, fill: P.potato, width: 2, lumps: 7, lumpAmt: 0.08 });
  blob(ctx, W * 0.58, H * 0.38, 6.6, 5.4, { rng, fill: shade(P.potato, -0.04), width: 2, lumps: 7, lumpAmt: 0.08 });
}

function cloudProp(ctx, rng, W, H) {
  // 하늘용 — 나른한 구름
  blob(ctx, W * 0.5, H * 0.5, W * 0.4, H * 0.26, { rng, fill: 'rgba(238,233,214,0.9)', width: 2.6, lumps: 9, lumpAmt: 0.2 });
}

export function bakeProps() {
  return {
    treeRound: [mk(150, 190, 901, 3.4, (c, r, w, h) => roundTree(c, r, w, h)), mk(150, 190, 917, 3.1, (c, r, w, h) => roundTree(c, r, w, h)), mk(150, 190, 931, 3.7, (c, r, w, h) => roundTree(c, r, w, h))],
    treeSpiky: [mk(120, 200, 951, 3.6, (c, r, w, h) => spikyTree(c, r, w, h)), mk(120, 200, 967, 3.2, (c, r, w, h) => spikyTree(c, r, w, h))],
    treeDead: [mk(130, 180, 981, 2.9, (c, r, w, h) => deadTree(c, r, w, h))],
    fence: [mk(120, 90, 1001, 1.0, (c, r, w, h) => fence(c, r, w, h)), mk(120, 90, 1013, 1.0, (c, r, w, h) => fence(c, r, w, h))],
    shed: [mk(220, 190, 1031, 3.0, (c, r, w, h) => shed(c, r, w, h), { ss: 1.7 })],
    scarecrow: [mk(110, 170, 1051, 2.2, (c, r, w, h) => scarecrow(c, r, w, h))],
    well: [mk(130, 160, 1071, 2.1, (c, r, w, h) => well(c, r, w, h), { ss: 1.7 })],
    stall: [mk(190, 170, 1091, 2.5, (c, r, w, h) => stall(c, r, w, h), { ss: 1.7 })],
    barrel: [mk(80, 100, 1111, 1.05, (c, r, w, h) => barrel(c, r, w, h))],
    rock: [mk(110, 80, 1131, 0.62, (c, r, w, h) => rock(c, r, w, h)), mk(110, 80, 1141, 0.5, (c, r, w, h) => rock(c, r, w, h))],
    grass: [mk(70, 60, 1151, 0.5, (c, r, w, h) => grassTuft(c, r, w, h)), mk(70, 60, 1161, 0.42, (c, r, w, h) => grassTuft(c, r, w, h)), mk(70, 60, 1171, 0.56, (c, r, w, h) => grassTuft(c, r, w, h))],
    flower: [mk(60, 80, 1181, 0.6, (c, r, w, h) => flowerProp(c, r, w, h)), mk(60, 80, 1191, 0.55, (c, r, w, h) => flowerProp(c, r, w, h))],
    sign: [mk(110, 120, 1201, 1.5, (c, r, w, h) => signPost(c, r, w, h))],
    mailbox: [mk(90, 120, 1211, 1.5, (c, r, w, h) => mailbox(c, r, w, h))],
    crate: [mk(90, 90, 1221, 0.9, (c, r, w, h) => crate(c, r, w, h))],
    cloud: [mk(220, 110, 1231, 1, (c, r, w, h) => cloudProp(c, r, w, h)), mk(220, 110, 1241, 1, (c, r, w, h) => cloudProp(c, r, w, h))],
  };
}
