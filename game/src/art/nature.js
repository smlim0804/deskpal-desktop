// 레퍼런스 시트 1·3(나무/덤불/풀꽃) 기반 자연물 스프라이트.
// 모든 그림은 "발밑 중앙"이 앵커 — 3D 지면 위에 그대로 꽂으면 된다.
import { bake, shape, line, ellipse, hatch, smoothPath, stipple, INK } from '../core/sketch.js';
import { P, shade } from './palette.js';
import { makeRng, rand, pick } from '../core/rng.js';

// 나무 줄기(살짝 원기둥처럼) — 뿌리 쪽이 벌어진다
function trunk(ctx, rng, x, yBot, yTop, wBot, wTop, color = P.trunk) {
  const pts = [
    [x - wBot, yBot],
    [x - wBot * 0.72, yBot - (yBot - yTop) * 0.3],
    [x - wTop, yTop],
    [x + wTop, yTop],
    [x + wBot * 0.72, yBot - (yBot - yTop) * 0.3],
    [x + wBot, yBot],
  ];
  shape(ctx, pts, { rng, fill: color, width: 2.2, close: true });
  // 결
  for (let i = 0; i < 2; i++) {
    const t = 0.3 + i * 0.3;
    line(
      ctx,
      x - wBot * 0.3 + i * wBot * 0.5,
      yBot - 6,
      x - wTop * 0.2 + i * wTop * 0.4,
      yTop + (yBot - yTop) * 0.35,
      { rng, width: 1.3, stroke: 'rgba(51,48,43,0.45)' }
    );
  }
  // 뿌리
  line(ctx, x - wBot, yBot - 2, x - wBot - 7, yBot + 1, { rng, width: 2 });
  line(ctx, x + wBot, yBot - 2, x + wBot + 7, yBot + 1, { rng, width: 2 });
}

// 뭉게구름형 잎 덩어리의 "바깥 실루엣" 한 줄 — 원을 여러 개 겹쳐 그리면
// 외곽선이 뒤엉켜 철사뭉치처럼 보이므로, 물결치는 폴리곤 하나로 만든다.
export function cloudSilhouette(cx, cy, rx, ry, rng, lobes = 7, flatBottom = 0) {
  const n = lobes * 5;
  const ph = rng() * 6.28;
  const ph2 = rng() * 6.28;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const bulge = 0.88 + 0.11 * Math.sin(a * lobes + ph) + 0.045 * Math.sin(a * lobes * 2 + ph2);
    let y = cy + Math.sin(a) * ry * bulge;
    if (flatBottom && Math.sin(a) > 0) y = cy + Math.sin(a) * ry * (bulge * (1 - flatBottom) + flatBottom * 0.35);
    pts.push([cx + Math.cos(a) * rx * bulge, y]);
  }
  return pts;
}

// 잎 덩어리 그리기: 실루엣 1개 + 안쪽 잎뭉치 곡선 몇 개 (레퍼런스 시트1 느낌)
function canopy(ctx, rng, cx, cy, rx, ry, color, lobes = 7) {
  const pts = cloudSilhouette(cx, cy, rx, ry, rng, lobes);
  const path = smoothPath(pts, true);
  shape(ctx, pts, { rng, fill: color, width: 2.4, rough: 1.3 });

  // 아래쪽 그늘
  ctx.save();
  ctx.clip(path);
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = shade(color, -0.1);
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.16, cy + ry * 0.52, rx * 0.86, ry * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 위쪽 하이라이트
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = shade(color, 0.09);
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.32, cy - ry * 0.38, rx * 0.42, ry * 0.3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 안쪽 잎뭉치 표시 — 짧은 스캘럽 곡선
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = 'rgba(51,48,43,0.5)';
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  const groups = 4 + Math.floor(rng() * 3);
  for (let g = 0; g < groups; g++) {
    const gx = cx + (rng() - 0.5) * rx * 1.3;
    const gy = cy + (rng() - 0.5) * ry * 1.1;
    const w = rx * (0.16 + rng() * 0.14);
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const sx = gx + (k - 1) * w * 0.9;
      ctx.moveTo(sx - w * 0.45, gy + k * 0.6);
      ctx.quadraticCurveTo(sx, gy - w * 0.75, sx + w * 0.45, gy + k * 0.6);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function pineTree(seed, opt = {}) {
  const color = opt.color || pick(makeRng(seed + 3), [P.leafDark, P.leafBlue, '#77ac68']);
  const w = 200;
  const h = 330;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.5,
      pad: 10,
      draw: (ctx, rng) => {
        const cx = w / 2;
        trunk(ctx, rng, cx, h, h * 0.72, 11, 7, P.trunkDark);
        const layers = 4;
        for (let i = layers - 1; i >= 0; i--) {
          const t = i / (layers - 1);
          const yb = h * (0.78 - t * 0.2);
          const yt = yb - h * (0.19 + t * 0.03);
          const hw = w * (0.44 - t * 0.26);
          const pts = [[cx, yt]];
          const spikes = 5;
          for (let s = 0; s <= spikes; s++) {
            const u = s / spikes;
            pts.push([cx + hw * u * 0.92, yb - (1 - u) * (yb - yt) * 0.25 - (s % 2 ? 6 : 0)]);
          }
          pts.push([cx + hw * 0.5, yb + 6]);
          pts.push([cx - hw * 0.5, yb + 6]);
          for (let s = spikes; s >= 0; s--) {
            const u = s / spikes;
            pts.push([cx - hw * u * 0.92, yb - (1 - u) * (yb - yt) * 0.25 - (s % 2 ? 6 : 0)]);
          }
          shape(ctx, pts, { rng, fill: i % 2 ? shade(color, -0.05) : color, width: 2.1, close: true, corner: 0.3 });
          // 침엽 해칭
          hatch(ctx, smoothPath(pts, true), [cx - hw, yt, cx + hw, yb + 8], {
            rng,
            spacing: 9,
            angle: -1.15,
            alpha: 0.18,
          });
        }
      },
    }),
    hUnits: opt.hUnits || rand(makeRng(seed + 9), 5.4, 7.2),
    radius: 0.85,
    sway: 0.5,
  };
}

export function blobTree(seed, opt = {}) {
  const rng0 = makeRng(seed + 5);
  const color = opt.color || pick(rng0, [P.leaf, P.leafDark, '#a3c97c', P.leafBlue]);
  const w = 250;
  const h = 320;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.4,
      pad: 12,
      draw: (ctx, rng) => {
        const cx = w / 2;
        trunk(ctx, rng, cx, h, h * 0.6, 16, 10);
        // 가지
        line(ctx, cx, h * 0.68, cx - 36, h * 0.5, { rng, width: 3.2 });
        line(ctx, cx, h * 0.64, cx + 34, h * 0.48, { rng, width: 3.2 });
        canopy(ctx, rng, cx, h * 0.33, w * 0.47, h * 0.3, color, 7);
      },
    }),
    hUnits: opt.hUnits || rand(makeRng(seed + 17), 4.8, 6.4),
    radius: 0.9,
    sway: 0.8,
  };
}

export function willowTree(seed, opt = {}) {
  const color = opt.color || '#9cc47e';
  const w = 250;
  const h = 340;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.4,
      pad: 12,
      draw: (ctx, rng) => {
        const cx = w / 2;
        trunk(ctx, rng, cx, h, h * 0.6, 15, 9);
        const cy = h * 0.31;
        const rx = w * 0.42;
        const ry = h * 0.2;
        // 늘어진 잎줄기가 먼저(캐노피 뒤로 들어가게)
        for (let i = 0; i < 44; i++) {
          const t = i / 43;
          const x = cx - rx * 1.04 + rx * 2.08 * t;
          const edge = Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / (rx * 1.06), 2)));
          const y0 = cy + ry * edge * 0.8;
          const len = 34 + rng() * 76 * (0.35 + edge * 0.65);
          const drift = (x - cx) * 0.12 + (rng() - 0.5) * 8;
          const pts = [
            [x, y0 - 10],
            [x + drift * 0.4, y0 + len * 0.5],
            [x + drift, y0 + len],
          ];
          shape(ctx, pts, {
            rng,
            fill: null,
            stroke: i % 3 === 0 ? shade(color, -0.16) : color,
            width: 2.6,
            close: false,
            passes: 1,
            rough: 0.6,
          });
        }
        canopy(ctx, rng, cx, cy, rx, ry, color, 8);
      },
    }),
    hUnits: opt.hUnits || rand(makeRng(seed + 23), 5.0, 6.2),
    radius: 0.9,
    sway: 1.2,
  };
}

export function bareTree(seed, opt = {}) {
  const w = 220;
  const h = 300;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.4,
      pad: 10,
      draw: (ctx, rng) => {
        const cx = w / 2;
        trunk(ctx, rng, cx, h, h * 0.45, 13, 6, P.trunkDark);
        const branch = (x, y, ang, len, depth) => {
          if (depth <= 0 || len < 10) return;
          const nx = x + Math.cos(ang) * len;
          const ny = y + Math.sin(ang) * len;
          line(ctx, x, y, nx, ny, { rng, width: Math.max(1.2, depth * 0.9) });
          branch(nx, ny, ang - 0.35 - rng() * 0.3, len * 0.72, depth - 1);
          branch(nx, ny, ang + 0.35 + rng() * 0.3, len * 0.7, depth - 1);
        };
        branch(cx, h * 0.46, -Math.PI / 2 - 0.12, 52, 4);
        branch(cx, h * 0.5, -Math.PI / 2 + 0.5, 34, 3);
        branch(cx, h * 0.5, -Math.PI / 2 - 0.6, 34, 3);
      },
    }),
    hUnits: opt.hUnits || rand(makeRng(seed + 31), 4.2, 5.4),
    radius: 0.7,
    sway: 0.6,
  };
}

export function bush(seed, opt = {}) {
  const rng0 = makeRng(seed + 2);
  const color = opt.color || pick(rng0, [P.leaf, P.leafDark, '#a9cb84']);
  const w = 160;
  const h = 110;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.6,
      pad: 8,
      draw: (ctx, rng) => {
        const cx = w / 2;
        // 위쪽 삐죽삐죽(덤불 잔가지)이 먼저
        for (let i = 0; i < 14; i++) {
          const x = cx + (rng() - 0.5) * w * 0.66;
          const y = h * 0.42 + rng() * 10;
          line(ctx, x, y + 10, x + (rng() - 0.5) * 8, y - 12 - rng() * 10, { rng, width: 1.6 });
        }
        canopy(ctx, rng, cx, h * 0.64, w * 0.42, h * 0.3, color, 6);
        if (opt.berries) {
          for (let i = 0; i < 7; i++) {
            const x = cx + (rng() - 0.5) * w * 0.6;
            const y = h * 0.5 + (rng() - 0.5) * h * 0.3;
            ellipse(ctx, x, y, 3.4, 3.4, { rng, fill: '#d76a6a', width: 1.4 });
          }
        }
      },
    }),
    hUnits: opt.hUnits || rand(makeRng(seed + 41), 1.1, 1.7),
    radius: 0.6,
    sway: 1.4,
  };
}

export function rock(seed, opt = {}) {
  const w = 140;
  const h = 100;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.6,
      pad: 6,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const pts = [
          [cx - w * 0.4, h - 6],
          [cx - w * 0.36, h * 0.58],
          [cx - w * 0.2, h * 0.3],
          [cx + w * 0.02, h * 0.22],
          [cx + w * 0.22, h * 0.34],
          [cx + w * 0.36, h * 0.62],
          [cx + w * 0.4, h - 6],
        ];
        shape(ctx, pts, { rng, fill: P.stoneDark, width: 2.4, close: true, corner: 0.22 });
        // 윗면(빛 받는 면) — 입체감
        shape(
          ctx,
          [
            [cx - w * 0.2, h * 0.3],
            [cx + w * 0.02, h * 0.22],
            [cx + w * 0.22, h * 0.34],
            [cx + w * 0.04, h * 0.44],
            [cx - w * 0.14, h * 0.4],
          ],
          { rng, fill: P.stone, width: 1.8, close: true }
        );
        line(ctx, cx - w * 0.14, h * 0.4, cx - w * 0.1, h - 8, { rng, width: 1.5 });
        line(ctx, cx + w * 0.04, h * 0.44, cx + w * 0.1, h - 8, { rng, width: 1.4 });
        hatch(ctx, smoothPath(pts, true), [cx + w * 0.05, h * 0.35, cx + w * 0.42, h], {
          rng,
          spacing: 6,
          angle: -1.0,
          alpha: 0.18,
        });
        // 곁돌
        ellipse(ctx, cx + w * 0.42, h - 9, 13, 8, { rng, fill: P.stone, width: 2 });
      },
    }),
    hUnits: opt.hUnits || rand(makeRng(seed + 53), 0.8, 1.3),
    radius: 0.7,
  };
}

export function stump(seed) {
  const w = 130;
  const h = 96;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.6,
      pad: 6,
      draw: (ctx, rng) => {
        const cx = w / 2;
        shape(
          ctx,
          [
            [cx - 40, h - 6],
            [cx - 34, h * 0.35],
            [cx + 34, h * 0.35],
            [cx + 40, h - 6],
          ],
          { rng, fill: P.trunk, width: 2.3, close: true }
        );
        ellipse(ctx, cx, h * 0.34, 35, 13, { rng, fill: shade(P.trunk, 0.07), width: 2.2 });
        ellipse(ctx, cx, h * 0.34, 22, 8, { rng, fill: null, width: 1.4 });
        ellipse(ctx, cx, h * 0.34, 10, 4, { rng, fill: null, width: 1.2 });
        for (let i = 0; i < 5; i++) {
          const x = cx - 34 + i * 17;
          line(ctx, x, h * 0.45, x + 2, h - 10, { rng, width: 1.3, stroke: 'rgba(51,48,43,0.4)' });
        }
      },
    }),
    hUnits: 1.1,
    radius: 0.55,
  };
}

export function log(seed) {
  const w = 190;
  const h = 80;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.6,
      pad: 6,
      draw: (ctx, rng) => {
        shape(
          ctx,
          [
            [16, h - 10],
            [16, h - 42],
            [w - 22, h - 46],
            [w - 22, h - 12],
          ],
          { rng, fill: P.trunk, width: 2.2, close: true }
        );
        ellipse(ctx, 16, h - 26, 11, 17, { rng, fill: shade(P.trunk, 0.08), width: 2.2 });
        ellipse(ctx, 16, h - 26, 5, 8, { rng, fill: null, width: 1.3 });
        for (let i = 0; i < 3; i++) {
          line(ctx, 30, h - 36 + i * 9, w - 30, h - 38 + i * 9, { rng, width: 1.2, stroke: 'rgba(51,48,43,0.4)' });
        }
      },
    }),
    hUnits: 0.85,
    radius: 0.8,
  };
}

export function mushroom(seed, opt = {}) {
  const w = 90;
  const h = 100;
  const capColor = opt.color || pick(makeRng(seed + 7), ['#e08a76', '#d9a05b', '#c98fb0', '#e8cf9a']);
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.8,
      pad: 6,
      draw: (ctx, rng) => {
        const cx = w / 2;
        shape(
          ctx,
          [
            [cx - 9, h - 6],
            [cx - 6, h * 0.45],
            [cx + 6, h * 0.45],
            [cx + 9, h - 6],
          ],
          { rng, fill: P.cloth, width: 2, close: true }
        );
        shape(
          ctx,
          [
            [cx - 30, h * 0.5],
            [cx - 26, h * 0.24],
            [cx, h * 0.12],
            [cx + 26, h * 0.24],
            [cx + 30, h * 0.5],
            [cx, h * 0.56],
          ],
          { rng, fill: capColor, width: 2.2, close: true }
        );
        for (let i = 0; i < 4; i++) {
          ellipse(ctx, cx - 16 + rng() * 32, h * 0.24 + rng() * 16, 3.6, 2.8, {
            rng,
            fill: P.paper,
            width: 1.2,
          });
        }
      },
    }),
    hUnits: opt.hUnits || 0.55,
    radius: 0,
  };
}

export function grassTuft(seed, opt = {}) {
  const w = 80;
  const h = 66;
  const color = opt.color || pick(makeRng(seed + 4), [P.grassDeep, P.leafDark, '#8cb96a']);
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.7,
      pad: 5,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const n = 4 + Math.floor(rng() * 4);
        for (let i = 0; i < n; i++) {
          const bx = cx + (rng() - 0.5) * 26;
          const dir = rng() < 0.5 ? -1 : 1;
          const len = 24 + rng() * 30;
          shape(
            ctx,
            [
              [bx, h - 4],
              [bx + dir * 5, h - 4 - len * 0.55],
              [bx + dir * 16, h - 4 - len],
            ],
            { rng, fill: null, stroke: color, width: 2.2, close: false, passes: 1 }
          );
        }
      },
    }),
    hUnits: opt.hUnits || rand(makeRng(seed + 61), 0.42, 0.7),
    radius: 0,
    sway: 2.4,
  };
}

export function flower(seed, opt = {}) {
  const w = 70;
  const h = 80;
  const rng0 = makeRng(seed + 6);
  const color = opt.color || pick(rng0, ['#e8909f', '#efc86a', '#b79ede', '#f0f0e2', '#e88f6a']);
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.8,
      pad: 5,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const topY = h * 0.24;
        line(ctx, cx, h - 4, cx + (rng() - 0.5) * 8, topY + 6, { rng, width: 1.8, stroke: P.grassDeep });
        // 잎
        shape(
          ctx,
          [
            [cx, h * 0.62],
            [cx + 13, h * 0.5],
            [cx + 4, h * 0.68],
          ],
          { rng, fill: P.leaf, width: 1.4, close: true }
        );
        const petals = 5;
        for (let i = 0; i < petals; i++) {
          const a = (i / petals) * Math.PI * 2;
          ellipse(ctx, cx + Math.cos(a) * 8, topY + Math.sin(a) * 8, 6, 5, {
            rng,
            fill: color,
            width: 1.5,
          });
        }
        ellipse(ctx, cx, topY, 4, 4, { rng, fill: P.leafGold, width: 1.4 });
      },
    }),
    hUnits: opt.hUnits || 0.55,
    radius: 0,
    sway: 2.0,
  };
}

export function cattail(seed) {
  const w = 90;
  const h = 130;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.6,
      pad: 5,
      draw: (ctx, rng) => {
        const cx = w / 2;
        for (let i = 0; i < 5; i++) {
          const dir = i % 2 ? 1 : -1;
          line(ctx, cx, h - 4, cx + dir * (10 + rng() * 22), h * (0.12 + rng() * 0.3), {
            rng,
            width: 2,
            stroke: P.grassDeep,
          });
        }
        for (const s of [-1, 1]) {
          const x = cx + s * 8;
          line(ctx, x, h - 6, x + s * 3, h * 0.24, { rng, width: 1.8 });
          shape(
            ctx,
            [
              [x + s * 3 - 4, h * 0.26],
              [x + s * 3 - 4, h * 0.1],
              [x + s * 3, h * 0.05],
              [x + s * 3 + 4, h * 0.1],
              [x + s * 3 + 4, h * 0.26],
            ],
            { rng, fill: P.trunkDark, width: 1.6, close: true }
          );
        }
      },
    }),
    hUnits: 1.3,
    radius: 0,
    sway: 1.8,
  };
}

export function sapling(seed) {
  const w = 70;
  const h = 80;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.8,
      pad: 5,
      draw: (ctx, rng) => {
        const cx = w / 2;
        line(ctx, cx, h - 4, cx + 2, h * 0.3, { rng, width: 2 });
        for (const s of [-1, 1]) {
          shape(
            ctx,
            [
              [cx + 1, h * 0.42],
              [cx + s * 15, h * 0.28],
              [cx + s * 6, h * 0.5],
            ],
            { rng, fill: P.leaf, width: 1.6, close: true }
          );
        }
        shape(
          ctx,
          [
            [cx + 2, h * 0.32],
            [cx - 6, h * 0.16],
            [cx + 9, h * 0.14],
          ],
          { rng, fill: P.leaf, width: 1.6, close: true }
        );
      },
    }),
    hUnits: 0.6,
    radius: 0,
    sway: 2.2,
  };
}

export function acornProp(seed) {
  const w = 56;
  const h = 60;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 2,
      pad: 5,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const cy = h * 0.62;
        shape(
          ctx,
          [
            [cx - 13, cy - 6],
            [cx - 10, cy + 9],
            [cx, cy + 16],
            [cx + 10, cy + 9],
            [cx + 13, cy - 6],
          ],
          { rng, fill: P.acorn, width: 2, close: true }
        );
        shape(
          ctx,
          [
            [cx - 15, cy - 6],
            [cx - 13, cy - 15],
            [cx, cy - 19],
            [cx + 13, cy - 15],
            [cx + 15, cy - 6],
          ],
          { rng, fill: P.trunkDark, width: 2, close: true }
        );
        line(ctx, cx, cy - 18, cx + 2, cy - 26, { rng, width: 2 });
        stipple(ctx, cx, cy - 11, 11, 4, 6, { rng, alpha: 0.35 });
      },
    }),
    hUnits: 0.45,
    radius: 0,
  };
}

export function lanternProp(seed, lit = false) {
  const w = 70;
  const h = 96;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 2,
      pad: 8,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const top = h * 0.22;
        line(ctx, cx - 10, top, cx, top - 12, { rng, width: 1.8 });
        line(ctx, cx + 10, top, cx, top - 12, { rng, width: 1.8 });
        ellipse(ctx, cx, top - 14, 5, 4, { rng, fill: null, width: 1.8 });
        shape(
          ctx,
          [
            [cx - 15, top + 4],
            [cx + 15, top + 4],
            [cx + 18, h - 16],
            [cx - 18, h - 16],
          ],
          { rng, fill: lit ? P.lanternGlow : P.cloth, width: 2.2, close: true }
        );
        shape(
          ctx,
          [
            [cx - 20, h - 16],
            [cx + 20, h - 16],
            [cx + 16, h - 6],
            [cx - 16, h - 6],
          ],
          { rng, fill: P.woodDark, width: 2, close: true }
        );
        line(ctx, cx - 15, top + 4, cx + 15, top + 4, { rng, width: 2.4 });
        if (lit) {
          ctx.save();
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = '#fff3c4';
          ctx.beginPath();
          ctx.ellipse(cx, (top + h - 16) / 2, 9, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      },
    }),
    hUnits: 0.75,
    radius: 0,
  };
}
