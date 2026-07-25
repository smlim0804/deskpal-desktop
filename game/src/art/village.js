// 레퍼런스 시트 5(Buildings & Structures) 기반 숲마을 건물.
// 건물 그림 자체를 3/4 시점으로 그려서(정면+측면+지붕) 2D 스프라이트인데도
// 3D 공간에 놓였을 때 부피감이 생기게 한다.
import { bake, shape as baseShape, line, ellipse, hatch, smoothPath, stipple, INK } from '../core/sketch.js';

// 건물·구조물은 모서리가 살아 있어야 한다 (기본 shape 는 코너를 둥글게 만다)
const shape = (ctx, pts, opts = {}) => baseShape(ctx, pts, { corner: 0.13, ...opts });
import { P, shade } from './palette.js';

// 3/4 뷰 오프셋
const DX = 0.5; // 깊이 → 오른쪽
const DY = 0.34; // 깊이 → 위쪽

/** 직육면체 한 덩이 */
function box(ctx, rng, x, yBase, w, h, d, face, side, top) {
  const ox = d * DX;
  const oy = d * DY;
  // 측면
  shape(
    ctx,
    [
      [x + w, yBase],
      [x + w + ox, yBase - oy],
      [x + w + ox, yBase - oy - h],
      [x + w, yBase - h],
    ],
    { rng, fill: side || shade(face, -0.09), width: 2, close: true }
  );
  // 정면
  shape(
    ctx,
    [
      [x, yBase],
      [x + w, yBase],
      [x + w, yBase - h],
      [x, yBase - h],
    ],
    { rng, fill: face, width: 2.3, close: true }
  );
  if (top) {
    shape(
      ctx,
      [
        [x, yBase - h],
        [x + w, yBase - h],
        [x + w + ox, yBase - h - oy],
        [x + ox, yBase - h - oy],
      ],
      { rng, fill: top, width: 2, close: true }
    );
  }
  return { ox, oy };
}

/** 박공 지붕 */
function gableRoof(ctx, rng, x, yTop, w, h, d, color, overhang = 8) {
  const ox = d * DX;
  const oy = d * DY;
  const apexX = x + w / 2;
  const apexY = yTop - h;
  // 뒤쪽 경사면
  shape(
    ctx,
    [
      [apexX, apexY],
      [apexX + ox, apexY - oy],
      [x + w + ox + overhang, yTop - oy + 3],
      [x + w + overhang, yTop + 3],
    ],
    { rng, fill: shade(color, -0.1), width: 2, close: true }
  );
  // 정면 삼각
  shape(
    ctx,
    [
      [x - overhang, yTop + 3],
      [apexX, apexY],
      [x + w + overhang, yTop + 3],
    ],
    { rng, fill: color, width: 2.3, close: true }
  );
  // 기와 결
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(x - overhang + (apexX - x + overhang) * t, yTop + 3 - (yTop + 3 - apexY) * t);
    ctx.lineTo(x + w + overhang - (x + w + overhang - apexX) * t, yTop + 3 - (yTop + 3 - apexY) * t);
    ctx.stroke();
  }
  ctx.restore();
  return { apexX, apexY };
}

function door(ctx, rng, cx, yBase, w, h) {
  shape(
    ctx,
    [
      [cx - w / 2, yBase],
      [cx - w / 2, yBase - h * 0.72],
      [cx, yBase - h],
      [cx + w / 2, yBase - h * 0.72],
      [cx + w / 2, yBase],
    ],
    { rng, fill: P.woodDark, width: 2, close: true }
  );
  ellipse(ctx, cx + w * 0.26, yBase - h * 0.42, 2.2, 2.2, { rng, fill: P.leafGold, width: 1.2 });
  for (let i = 0; i < 3; i++) {
    line(ctx, cx - w / 2 + 3 + i * (w / 3.4), yBase - 3, cx - w / 2 + 3 + i * (w / 3.4), yBase - h * 0.7, {
      rng,
      width: 1,
      stroke: 'rgba(51,48,43,0.4)',
    });
  }
}

function window_(ctx, rng, cx, cy, w, h, round = false) {
  if (round) {
    ellipse(ctx, cx, cy, w / 2, h / 2, { rng, fill: '#cfe3ea', width: 2 });
    line(ctx, cx - w / 2, cy, cx + w / 2, cy, { rng, width: 1.4 });
    line(ctx, cx, cy - h / 2, cx, cy + h / 2, { rng, width: 1.4 });
    return;
  }
  shape(
    ctx,
    [
      [cx - w / 2, cy - h / 2],
      [cx + w / 2, cy - h / 2],
      [cx + w / 2, cy + h / 2],
      [cx - w / 2, cy + h / 2],
    ],
    { rng, fill: '#cfe3ea', width: 2, close: true }
  );
  line(ctx, cx, cy - h / 2, cx, cy + h / 2, { rng, width: 1.5 });
  line(ctx, cx - w / 2, cy, cx + w / 2, cy, { rng, width: 1.5 });
}

function smoke(ctx, rng, x, y) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - 10, y - 14, x + 12, y - 22, x + 2, y - 36);
  ctx.stroke();
  ctx.restore();
}

// ── 건물들 ────────────────────────────────────
export function tinyHut(seed) {
  const w = 220;
  const h = 220;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.5,
      pad: 10,
      draw: (ctx, rng) => {
        const x = 46;
        const bw = 110;
        const bh = 62;
        box(ctx, rng, x, h - 8, bw, bh, 46, P.plaster);
        // 초가 지붕
        const cx = x + bw / 2;
        shape(
          ctx,
          [
            [x - 22, h - 8 - bh + 6],
            [cx, h - 8 - bh - 62],
            [x + bw + 44, h - 8 - bh - 8],
          ],
          { rng, fill: P.roofStraw, width: 2.4, close: true }
        );
        for (let i = 0; i < 14; i++) {
          const t = i / 13;
          const sx = x - 20 + t * (bw + 60);
          line(ctx, cx + (sx - cx) * 0.35, h - 8 - bh - 52 + Math.abs(t - 0.5) * 26, sx, h - 8 - bh + 6, {
            rng,
            width: 1.3,
            stroke: 'rgba(51,48,43,0.45)',
          });
        }
        door(ctx, rng, cx, h - 10, 30, 44);
        smoke(ctx, rng, cx + 4, h - 8 - bh - 64);
      },
    }),
    hUnits: 3.4,
    radius: 1.9,
  };
}

export function cottage(seed, opt = {}) {
  const w = 260;
  const h = 280;
  const roof = opt.roof || P.roofRed;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.4,
      pad: 12,
      draw: (ctx, rng) => {
        const x = 40;
        const bw = 130;
        const bh = 92;
        const yBase = h - 8;
        box(ctx, rng, x, yBase, bw, bh, 54, P.plaster);
        gableRoof(ctx, rng, x, yBase - bh, bw, 66, 54, roof, 12);
        door(ctx, rng, x + bw * 0.32, yBase, 32, 48);
        window_(ctx, rng, x + bw * 0.74, yBase - bh * 0.62, 30, 28);
        window_(ctx, rng, x + bw / 2 + 4, yBase - bh - 26, 22, 20, true);
        // 굴뚝
        box(ctx, rng, x + bw * 0.72, yBase - bh - 40, 16, 26, 12, P.stoneDark);
        smoke(ctx, rng, x + bw * 0.78, yBase - bh - 44);
        // 울타리
        for (let i = 0; i < 4; i++) {
          const fx = x - 26 + i * 13;
          shape(
            ctx,
            [
              [fx, yBase],
              [fx, yBase - 24],
              [fx + 5, yBase - 29],
              [fx + 10, yBase - 24],
              [fx + 10, yBase],
            ],
            { rng, fill: P.wood, width: 1.8, close: true }
          );
        }
      },
    }),
    hUnits: 5.0,
    radius: 2.3,
  };
}

export function shopStall(seed) {
  const w = 280;
  const h = 220;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.5,
      pad: 10,
      draw: (ctx, rng) => {
        const yBase = h - 8;
        const x = 44;
        const bw = 170;
        // 카운터
        box(ctx, rng, x, yBase, bw, 40, 40, P.wood);
        // 기둥
        for (const px of [x + 4, x + bw - 8]) {
          box(ctx, rng, px, yBase - 40, 7, 76, 7, P.woodDark);
        }
        // 차양 (줄무늬)
        const ay = yBase - 116;
        shape(
          ctx,
          [
            [x - 20, ay + 26],
            [x + 6, ay],
            [x + bw + 34, ay - 6],
            [x + bw + 12, ay + 22],
          ],
          { rng, fill: P.cloth, width: 2.2, close: true }
        );
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = P.roofRed;
        ctx.lineWidth = 7;
        for (let i = 0; i < 5; i++) {
          const t = i / 4;
          ctx.beginPath();
          ctx.moveTo(x - 18 + t * (bw + 46), ay + 25 - t * 4);
          ctx.lineTo(x + 8 + t * (bw + 22), ay - t * 6);
          ctx.stroke();
        }
        ctx.restore();
        // 간판
        shape(
          ctx,
          [
            [x + 34, ay - 4],
            [x + 116, ay - 8],
            [x + 116, ay - 44],
            [x + 34, ay - 40],
          ],
          { rng, fill: P.plaster, width: 2, close: true }
        );
        ellipse(ctx, x + 75, ay - 26, 12, 13, { rng, fill: P.acorn, width: 1.8 });
        line(ctx, x + 68, ay - 38, x + 82, ay - 38, { rng, width: 2 });
        // 진열 항아리/통
        for (let i = 0; i < 4; i++) {
          const bx = x + 20 + i * 36;
          shape(
            ctx,
            [
              [bx, yBase - 40],
              [bx + 20, yBase - 40],
              [bx + 17, yBase - 66],
              [bx + 3, yBase - 66],
            ],
            { rng, fill: i % 2 ? P.leafGold : P.leafBlue, width: 1.8, close: true }
          );
        }
      },
    }),
    hUnits: 3.9,
    radius: 2.2,
  };
}

export function windmill(seed) {
  const w = 280;
  const h = 340;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.4,
      pad: 12,
      draw: (ctx, rng) => {
        const cx = w / 2 - 20;
        const yBase = h - 8;
        // 원뿔형 탑
        shape(
          ctx,
          [
            [cx - 48, yBase],
            [cx - 30, yBase - 150],
            [cx + 30, yBase - 150],
            [cx + 48, yBase],
          ],
          { rng, fill: P.plaster, width: 2.4, close: true }
        );
        // 오른쪽 그늘
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = shade(P.plaster, -0.12);
        ctx.beginPath();
        ctx.moveTo(cx + 12, yBase);
        ctx.lineTo(cx + 18, yBase - 150);
        ctx.lineTo(cx + 30, yBase - 150);
        ctx.lineTo(cx + 48, yBase);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // 지붕
        shape(
          ctx,
          [
            [cx - 40, yBase - 150],
            [cx, yBase - 190],
            [cx + 40, yBase - 150],
          ],
          { rng, fill: P.roofBlue, width: 2.2, close: true }
        );
        door(ctx, rng, cx, yBase, 30, 46);
        window_(ctx, rng, cx, yBase - 100, 22, 26);
        stipple(ctx, cx, yBase - 60, 40, 60, 22, { rng, alpha: 0.14, size: 1.2 });
        // 날개
        const hx = cx + 2;
        const hy = yBase - 168;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          const ex = hx + Math.cos(a) * 96;
          const ey = hy + Math.sin(a) * 96;
          line(ctx, hx, hy, ex, ey, { rng, width: 3 });
          const px = -Math.sin(a);
          const py = Math.cos(a);
          shape(
            ctx,
            [
              [hx + Math.cos(a) * 26, hy + Math.sin(a) * 26],
              [ex, ey],
              [ex + px * 15, ey + py * 15],
              [hx + Math.cos(a) * 26 + px * 13, hy + Math.sin(a) * 26 + py * 13],
            ],
            { rng, fill: P.cloth, width: 1.6, close: true, alpha: 0.95 }
          );
        }
        ellipse(ctx, hx, hy, 6, 6, { rng, fill: P.woodDark, width: 2 });
      },
    }),
    hUnits: 7.4,
    radius: 2.1,
  };
}

export function tower(seed) {
  const w = 200;
  const h = 320;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.4,
      pad: 10,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const yBase = h - 8;
        shape(
          ctx,
          [
            [cx - 40, yBase],
            [cx - 34, yBase - 190],
            [cx + 34, yBase - 190],
            [cx + 40, yBase],
          ],
          { rng, fill: P.stone, width: 2.4, close: true }
        );
        // 돌 무늬
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        for (let r = 0; r < 7; r++) {
          const y = yBase - 16 - r * 25;
          ctx.beginPath();
          ctx.moveTo(cx - 38, y);
          ctx.lineTo(cx + 38, y - 1);
          ctx.stroke();
          const off = r % 2 ? 18 : -18;
          ctx.beginPath();
          ctx.moveTo(cx + off, y);
          ctx.lineTo(cx + off + 2, y - 25);
          ctx.stroke();
        }
        ctx.restore();
        // 총안
        for (let i = -2; i <= 2; i++) {
          shape(
            ctx,
            [
              [cx + i * 16 - 6, yBase - 190],
              [cx + i * 16 + 6, yBase - 190],
              [cx + i * 16 + 6, yBase - 202],
              [cx + i * 16 - 6, yBase - 202],
            ],
            { rng, fill: P.stone, width: 1.8, close: true }
          );
        }
        // 뾰족 지붕
        shape(
          ctx,
          [
            [cx - 44, yBase - 202],
            [cx, yBase - 262],
            [cx + 44, yBase - 202],
          ],
          { rng, fill: P.roofRed, width: 2.2, close: true }
        );
        line(ctx, cx, yBase - 262, cx, yBase - 284, { rng, width: 2 });
        shape(
          ctx,
          [
            [cx, yBase - 284],
            [cx + 26, yBase - 277],
            [cx, yBase - 270],
          ],
          { rng, fill: P.roofBlue, width: 1.8, close: true }
        );
        door(ctx, rng, cx, yBase, 28, 44);
        window_(ctx, rng, cx, yBase - 120, 20, 26);
      },
    }),
    hUnits: 7.0,
    radius: 1.7,
  };
}

export function tent(seed) {
  const w = 220;
  const h = 200;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.5,
      pad: 10,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const yBase = h - 8;
        shape(
          ctx,
          [
            [cx - 78, yBase],
            [cx, yBase - 150],
            [cx + 78, yBase],
          ],
          { rng, fill: P.cloth, width: 2.4, close: true }
        );
        // 입구
        shape(
          ctx,
          [
            [cx - 20, yBase],
            [cx - 4, yBase - 74],
            [cx + 4, yBase - 74],
            [cx + 20, yBase],
          ],
          { rng, fill: shade(P.cloth, -0.22), width: 2, close: true }
        );
        line(ctx, cx - 62, yBase - 30, cx + 62, yBase - 30, { rng, width: 1.4, stroke: 'rgba(51,48,43,0.35)' });
        line(ctx, cx, yBase - 150, cx, yBase - 172, { rng, width: 2 });
        shape(
          ctx,
          [
            [cx, yBase - 172],
            [cx + 24, yBase - 165],
            [cx, yBase - 158],
          ],
          { rng, fill: P.roofRed, width: 1.8, close: true }
        );
        // 고정줄
        line(ctx, cx - 74, yBase - 10, cx - 96, yBase, { rng, width: 1.4 });
        line(ctx, cx + 74, yBase - 10, cx + 96, yBase, { rng, width: 1.4 });
      },
    }),
    hUnits: 3.6,
    radius: 2.0,
  };
}

export function gateArch(seed) {
  const w = 300;
  const h = 280;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.4,
      pad: 12,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const yBase = h - 8;
        // 기둥(통나무)
        for (const s of [-1, 1]) {
          box(ctx, rng, cx + s * 96 - 12, yBase, 24, 168, 16, P.wood);
        }
        // 아치
        shape(
          ctx,
          [
            [cx - 100, yBase - 158],
            [cx - 60, yBase - 196],
            [cx, yBase - 206],
            [cx + 60, yBase - 196],
            [cx + 100, yBase - 158],
          ],
          { rng, fill: null, stroke: INK, width: 4, close: false }
        );
        shape(
          ctx,
          [
            [cx - 96, yBase - 150],
            [cx - 58, yBase - 186],
            [cx, yBase - 196],
            [cx + 58, yBase - 186],
            [cx + 96, yBase - 150],
          ],
          { rng, fill: null, stroke: P.woodDark, width: 3, close: false }
        );
        // 매듭
        for (const s of [-1, 1]) {
          const x = cx + s * 66;
          const y = yBase - 182;
          line(ctx, x - 10, y - 8, x + 10, y + 8, { rng, width: 2 });
          line(ctx, x + 10, y - 8, x - 10, y + 8, { rng, width: 2 });
        }
        // 깃발 + 등불
        line(ctx, cx - 96, yBase - 168, cx - 96, yBase - 214, { rng, width: 2 });
        shape(
          ctx,
          [
            [cx - 96, yBase - 214],
            [cx - 66, yBase - 206],
            [cx - 96, yBase - 196],
          ],
          { rng, fill: P.roofRed, width: 1.8, close: true }
        );
        line(ctx, cx + 96, yBase - 176, cx + 122, yBase - 176, { rng, width: 2 });
        line(ctx, cx + 120, yBase - 176, cx + 120, yBase - 156, { rng, width: 1.6 });
        shape(
          ctx,
          [
            [cx + 110, yBase - 156],
            [cx + 130, yBase - 156],
            [cx + 127, yBase - 132],
            [cx + 113, yBase - 132],
          ],
          { rng, fill: P.lanternGlow, width: 1.8, close: true }
        );
        // 현판
        shape(
          ctx,
          [
            [cx - 42, yBase - 176],
            [cx + 42, yBase - 176],
            [cx + 42, yBase - 148],
            [cx - 42, yBase - 148],
          ],
          { rng, fill: P.plaster, width: 2, close: true }
        );
        ctx.save();
        ctx.fillStyle = INK;
        ctx.font = '18px "Comic Sans MS", cursive';
        ctx.textAlign = 'center';
        ctx.fillText('BEAN', cx, yBase - 156);
        ctx.restore();
      },
    }),
    hUnits: 4.8,
    radius: 0, // 통과 가능
  };
}

export function well(seed) {
  const w = 180;
  const h = 200;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.5,
      pad: 8,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const yBase = h - 8;
        // 돌 우물통
        shape(
          ctx,
          [
            [cx - 46, yBase],
            [cx - 42, yBase - 52],
            [cx + 42, yBase - 52],
            [cx + 46, yBase],
          ],
          { rng, fill: P.stone, width: 2.3, close: true }
        );
        ellipse(ctx, cx, yBase - 52, 42, 15, { rng, fill: shade(P.stone, 0.06), width: 2.2 });
        ellipse(ctx, cx, yBase - 50, 30, 10, { rng, fill: P.waterDeep, width: 1.6 });
        for (let r = 0; r < 3; r++) {
          const y = yBase - 12 - r * 16;
          line(ctx, cx - 44, y, cx + 44, y, { rng, width: 1.2, stroke: 'rgba(51,48,43,0.4)' });
        }
        // 기둥 + 지붕
        for (const s of [-1, 1]) box(ctx, rng, cx + s * 38 - 5, yBase - 52, 9, 62, 6, P.wood);
        shape(
          ctx,
          [
            [cx - 58, yBase - 114],
            [cx, yBase - 146],
            [cx + 58, yBase - 114],
          ],
          { rng, fill: P.roofStraw, width: 2.2, close: true }
        );
        // 두레박
        line(ctx, cx, yBase - 116, cx, yBase - 84, { rng, width: 1.5 });
        shape(
          ctx,
          [
            [cx - 10, yBase - 84],
            [cx + 10, yBase - 84],
            [cx + 8, yBase - 68],
            [cx - 8, yBase - 68],
          ],
          { rng, fill: P.wood, width: 1.8, close: true }
        );
      },
    }),
    hUnits: 2.9,
    radius: 1.2,
  };
}

export function fencePiece(seed) {
  const w = 160;
  const h = 90;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.6,
      pad: 6,
      draw: (ctx, rng) => {
        const yBase = h - 6;
        for (let i = 0; i < 3; i++) {
          const x = 22 + i * 52;
          shape(
            ctx,
            [
              [x, yBase],
              [x, yBase - 52],
              [x + 8, yBase - 62],
              [x + 16, yBase - 52],
              [x + 16, yBase],
            ],
            { rng, fill: P.wood, width: 2, close: true }
          );
        }
        line(ctx, 18, yBase - 22, w - 18, yBase - 24, { rng, width: 4, stroke: P.woodDark });
        line(ctx, 18, yBase - 44, w - 18, yBase - 46, { rng, width: 4, stroke: P.woodDark });
      },
    }),
    hUnits: 1.15,
    radius: 0.9,
  };
}

export function lampPost(seed) {
  const w = 120;
  const h = 240;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.6,
      pad: 8,
      draw: (ctx, rng) => {
        const x = w * 0.35;
        const yBase = h - 6;
        line(ctx, x, yBase, x + 3, yBase - 180, { rng, width: 5 });
        line(ctx, x + 3, yBase - 180, x + 46, yBase - 180, { rng, width: 4 });
        line(ctx, x + 46, yBase - 178, x + 46, yBase - 158, { rng, width: 2 });
        shape(
          ctx,
          [
            [x + 33, yBase - 158],
            [x + 59, yBase - 158],
            [x + 63, yBase - 122],
            [x + 29, yBase - 122],
          ],
          { rng, fill: P.lanternGlow, width: 2.2, close: true }
        );
        shape(
          ctx,
          [
            [x + 29, yBase - 160],
            [x + 63, yBase - 160],
            [x + 46, yBase - 174],
          ],
          { rng, fill: P.woodDark, width: 2, close: true }
        );
        line(ctx, x + 10, yBase - 168, x + 3, yBase - 156, { rng, width: 2 });
      },
    }),
    hUnits: 4.2,
    radius: 0.4,
  };
}

export function signPost(seed) {
  const w = 140;
  const h = 140;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.7,
      pad: 6,
      draw: (ctx, rng) => {
        const x = w / 2;
        const yBase = h - 6;
        line(ctx, x, yBase, x, yBase - 110, { rng, width: 4.5 });
        shape(
          ctx,
          [
            [x - 4, yBase - 100],
            [x + 46, yBase - 96],
            [x + 58, yBase - 84],
            [x + 46, yBase - 72],
            [x - 4, yBase - 76],
          ],
          { rng, fill: P.wood, width: 2, close: true }
        );
        shape(
          ctx,
          [
            [x + 4, yBase - 66],
            [x - 46, yBase - 62],
            [x - 58, yBase - 50],
            [x - 46, yBase - 38],
            [x + 4, yBase - 42],
          ],
          { rng, fill: P.wood, width: 2, close: true }
        );
      },
    }),
    hUnits: 2.0,
    radius: 0.35,
  };
}

export function barrel(seed) {
  const w = 100;
  const h = 110;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.8,
      pad: 6,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const yBase = h - 6;
        shape(
          ctx,
          [
            [cx - 26, yBase - 6],
            [cx - 32, yBase - 40],
            [cx - 26, yBase - 74],
            [cx + 26, yBase - 74],
            [cx + 32, yBase - 40],
            [cx + 26, yBase - 6],
          ],
          { rng, fill: P.wood, width: 2.2, close: true }
        );
        ellipse(ctx, cx, yBase - 74, 26, 8, { rng, fill: shade(P.wood, 0.07), width: 2 });
        for (const y of [yBase - 22, yBase - 56]) {
          line(ctx, cx - 30, y, cx + 30, y, { rng, width: 2.4, stroke: P.trunkDark });
        }
      },
    }),
    hUnits: 1.1,
    radius: 0.45,
  };
}

export function crate(seed) {
  const w = 110;
  const h = 100;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.8,
      pad: 6,
      draw: (ctx, rng) => {
        const yBase = h - 6;
        box(ctx, rng, 24, yBase, 54, 54, 26, P.wood, shade(P.wood, -0.1), shade(P.wood, 0.06));
        line(ctx, 24, yBase, 78, yBase - 54, { rng, width: 2 });
        line(ctx, 78, yBase, 24, yBase - 54, { rng, width: 2 });
      },
    }),
    hUnits: 0.9,
    radius: 0.45,
  };
}

export function campfire(seed) {
  const w = 130;
  const h = 120;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.8,
      pad: 6,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const yBase = h - 8;
        // 돌 원
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          ellipse(ctx, cx + Math.cos(a) * 34, yBase - 6 + Math.sin(a) * 12, 10, 7, {
            rng,
            fill: P.stone,
            width: 1.8,
          });
        }
        // 장작
        line(ctx, cx - 20, yBase - 12, cx + 20, yBase - 22, { rng, width: 4, stroke: P.trunkDark });
        line(ctx, cx - 18, yBase - 22, cx + 22, yBase - 10, { rng, width: 4, stroke: P.trunkDark });
        // 불꽃
        shape(
          ctx,
          [
            [cx - 18, yBase - 22],
            [cx - 8, yBase - 52],
            [cx - 2, yBase - 34],
            [cx + 6, yBase - 62],
            [cx + 14, yBase - 34],
            [cx + 20, yBase - 22],
          ],
          { rng, fill: P.fire, width: 2, close: true }
        );
        shape(
          ctx,
          [
            [cx - 8, yBase - 22],
            [cx - 1, yBase - 42],
            [cx + 8, yBase - 22],
          ],
          { rng, fill: P.lanternGlow, width: 1.4, close: true }
        );
      },
    }),
    hUnits: 1.2,
    radius: 0.7,
  };
}

export function bridge(seed) {
  const w = 340;
  const h = 160;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.4,
      pad: 10,
      draw: (ctx, rng) => {
        const yBase = h - 8;
        // 아치 몸통
        shape(
          ctx,
          [
            [10, yBase],
            [40, yBase - 46],
            [w / 2, yBase - 66],
            [w - 40, yBase - 46],
            [w - 10, yBase],
            [w - 10, yBase - 12],
            [w - 46, yBase - 58],
            [w / 2, yBase - 80],
            [46, yBase - 58],
            [10, yBase - 12],
          ],
          { rng, fill: P.stone, width: 2.3, close: true }
        );
        // 난간
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          const x = 26 + t * (w - 52);
          const y = yBase - 62 - Math.sin(t * Math.PI) * 22;
          line(ctx, x, y, x, y - 26, { rng, width: 2.4 });
        }
        shape(
          ctx,
          [
            [26, yBase - 88],
            [w / 2, yBase - 110],
            [w - 26, yBase - 88],
          ],
          { rng, fill: null, stroke: INK, width: 2.6, close: false }
        );
        // 돌 무늬
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          const x = 20 + t * (w - 40);
          const y = yBase - 20 - Math.sin(t * Math.PI) * 40;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 3, y + 22);
          ctx.stroke();
        }
        ctx.restore();
      },
    }),
    hUnits: 2.4,
    radius: 0,
  };
}

export function ruinArch(seed) {
  const w = 240;
  const h = 240;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.4,
      pad: 10,
      draw: (ctx, rng) => {
        const cx = w / 2;
        const yBase = h - 8;
        shape(
          ctx,
          [
            [cx - 84, yBase],
            [cx - 76, yBase - 120],
            [cx - 40, yBase - 168],
            [cx + 40, yBase - 168],
            [cx + 76, yBase - 120],
            [cx + 84, yBase],
            [cx + 46, yBase],
            [cx + 42, yBase - 100],
            [cx, yBase - 130],
            [cx - 42, yBase - 100],
            [cx - 46, yBase],
          ],
          { rng, fill: P.stone, width: 2.3, close: true }
        );
        hatch(ctx, smoothPath([[cx + 46, yBase], [cx + 84, yBase], [cx + 76, yBase - 120], [cx + 42, yBase - 100]], true),
          [cx + 40, yBase - 130, cx + 90, yBase], { rng, spacing: 8, alpha: 0.16 });
        // 덩굴
        for (let i = 0; i < 5; i++) {
          const x = cx - 70 + i * 34;
          line(ctx, x, yBase - 150 + i * 6, x + 8, yBase - 100 + i * 10, { rng, width: 1.6, stroke: P.leafDark });
        }
        // 무너진 돌
        ellipse(ctx, cx - 100, yBase - 8, 16, 10, { rng, fill: P.stoneDark, width: 2 });
        ellipse(ctx, cx + 104, yBase - 6, 12, 8, { rng, fill: P.stoneDark, width: 2 });
      },
    }),
    hUnits: 5.2,
    radius: 1.6,
  };
}

export function cart(seed) {
  const w = 200;
  const h = 130;
  return {
    ...bake({
      w,
      h,
      seed,
      ss: 1.6,
      pad: 8,
      draw: (ctx, rng) => {
        const yBase = h - 8;
        shape(
          ctx,
          [
            [30, yBase - 34],
            [170, yBase - 40],
            [176, yBase - 76],
            [24, yBase - 70],
          ],
          { rng, fill: P.wood, width: 2.2, close: true }
        );
        for (let i = 0; i < 4; i++) {
          line(ctx, 42 + i * 34, yBase - 36, 40 + i * 34, yBase - 72, { rng, width: 1.4, stroke: 'rgba(51,48,43,0.4)' });
        }
        for (const wx of [58, 142]) {
          ellipse(ctx, wx, yBase - 18, 20, 20, { rng, fill: P.woodDark, width: 2.2 });
          ellipse(ctx, wx, yBase - 18, 6, 6, { rng, fill: P.wood, width: 1.6 });
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI;
            line(ctx, wx - Math.cos(a) * 18, yBase - 18 - Math.sin(a) * 18, wx + Math.cos(a) * 18, yBase - 18 + Math.sin(a) * 18, {
              rng,
              width: 1.4,
            });
          }
        }
        line(ctx, 24, yBase - 66, -6, yBase - 78, { rng, width: 3 });
      },
    }),
    hUnits: 1.7,
    radius: 1.0,
  };
}
