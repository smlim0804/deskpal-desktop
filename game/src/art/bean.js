// 레퍼런스 시트 6 "BASIC BEANS" 기반 콩 캐릭터 절차 생성기.
// 하나의 파라메트릭 드로잉 함수로 몸통/포즈/소품을 조합해 프레임을 굽는다.
import { bake, shape, line, ellipse, smoothPath, ellipsePts, INK } from '../core/sketch.js';
import { P, shade } from './palette.js';

const W = 112;
const H = 152;
const GROUND = H - 4; // 발이 닿는 y
const TOP = 20;

// 몸통 실루엣 반폭 프로파일 (u: 0=머리끝, 1=몸통아래)
function halfWidth(shapeName, u) {
  const s = Math.sin(Math.PI * (0.10 + 0.82 * u));
  switch (shapeName) {
    case 'round':
      return Math.pow(Math.sin(Math.PI * (0.05 + 0.9 * u)), 0.62);
    case 'tall':
      return Math.pow(Math.sin(Math.PI * (0.16 + 0.72 * u)), 0.4) * 0.82;
    case 'square':
      return Math.pow(Math.sin(Math.PI * (0.03 + 0.94 * u)), 0.22) * 0.96;
    case 'cone':
      return 0.18 + 0.82 * u;
    case 'dome':
      return Math.pow(Math.sin(Math.PI * (0.02 + 0.98 * u)), 0.35) * (0.5 + 0.5 * u);
    case 'bean':
    default:
      return Math.pow(s, 0.72) * (0.80 + 0.20 * u);
  }
}

function bodyOutline(def, pose) {
  const bodyTop = TOP + (pose.tuck || 0) * 26;
  const bodyBot = GROUND - 26 + (pose.tuck || 0) * 20;
  const cx = W / 2;
  const hw = (def.width || 30) * (pose.squashX || 1);
  const hgt = (bodyBot - bodyTop) * (pose.squashY || 1);
  const pts = [];
  const steps = 11;
  const lean = pose.lean || 0;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const y = bodyBot - hgt * (1 - u);
    const x = cx + halfWidth(def.shape, u) * hw + lean * (1 - u) * 9;
    pts.push([x, y]);
  }
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    const y = bodyBot - hgt * (1 - u);
    const x = cx - halfWidth(def.shape, u) * hw + lean * (1 - u) * 9;
    pts.push([x, y]);
  }
  return { pts, bodyTop: bodyBot - hgt, bodyBot, cx, hw };
}

// 몸 안쪽 음영 — 볼륨감(입체) 담당
function volumeShade(ctx, path, color) {
  ctx.save();
  ctx.clip(path);
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = shade(color, -0.09);
  ctx.beginPath();
  ctx.ellipse(W * 0.78, H * 0.62, W * 0.42, H * 0.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = shade(color, 0.08);
  ctx.beginPath();
  ctx.ellipse(W * 0.36, H * 0.34, W * 0.18, H * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFace(ctx, rng, geo, def, pose) {
  const { cx, bodyTop, bodyBot } = geo;
  const eyeY = bodyTop + (bodyBot - bodyTop) * (def.eyeHeight || 0.34);
  const gap = (def.eyeGap || 0.42) * geo.hw;
  const lean = (pose.lean || 0) * 6;
  const st = pose.eyes || 'open';

  ctx.save();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';

  for (const s of [-1, 1]) {
    const ex = cx + s * gap + lean;
    if (st === 'closed' || st === 'happy') {
      ctx.beginPath();
      const dir = st === 'happy' ? -1 : 1;
      ctx.moveTo(ex - 4.4, eyeY + dir * 1.6);
      ctx.quadraticCurveTo(ex, eyeY - dir * 3.2, ex + 4.4, eyeY + dir * 1.6);
      ctx.stroke();
    } else if (st === 'surprised') {
      ctx.beginPath();
      ctx.arc(ex, eyeY, 3.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, eyeY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 2.5, 2.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 입
  const my = eyeY + 9.5;
  const mo = pose.mouth || 'smile';
  ctx.lineWidth = 1.9;
  if (mo === 'o') {
    ctx.beginPath();
    ctx.ellipse(cx + lean, my + 1, 2.8, 3.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mo === 'flat') {
    ctx.beginPath();
    ctx.moveTo(cx - 3.4 + lean, my);
    ctx.lineTo(cx + 3.4 + lean, my + 0.6);
    ctx.stroke();
  } else if (mo === 'wide') {
    ctx.beginPath();
    ctx.moveTo(cx - 5 + lean, my - 1);
    ctx.quadraticCurveTo(cx + lean, my + 5.5, cx + 5 + lean, my - 1);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 3.6 + lean, my - 0.6);
    ctx.quadraticCurveTo(cx + lean, my + 3, cx + 3.6 + lean, my - 0.6);
    ctx.stroke();
  }

  // 볼터치
  if (def.blush) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#f0a898';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * (gap + 9) + lean, my - 1, 4.4, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawHat(ctx, rng, geo, def) {
  const { cx, bodyTop, hw } = geo;
  const c = def.hatColor || P.roofRed;
  switch (def.hat) {
    case 'cap':
      shape(
        ctx,
        [
          [cx - hw * 0.8, bodyTop + 9],
          [cx - hw * 0.7, bodyTop - 1],
          [cx, bodyTop - 6],
          [cx + hw * 0.7, bodyTop - 1],
          [cx + hw * 0.8, bodyTop + 9],
        ],
        { rng, fill: c, width: 2, close: true }
      );
      line(ctx, cx + hw * 0.55, bodyTop + 8, cx + hw * 1.5, bodyTop + 11, { rng, width: 2.2 });
      break;
    case 'straw': {
      shape(
        ctx,
        [
          [cx - hw * 1.55, bodyTop + 10],
          [cx - hw * 0.75, bodyTop + 1],
          [cx, bodyTop - 5],
          [cx + hw * 0.75, bodyTop + 1],
          [cx + hw * 1.55, bodyTop + 10],
          [cx, bodyTop + 15],
        ],
        { rng, fill: P.roofStraw, width: 2, close: true }
      );
      break;
    }
    case 'witch':
      shape(
        ctx,
        [
          [cx - hw * 1.25, bodyTop + 9],
          [cx - hw * 0.5, bodyTop + 3],
          [cx - hw * 0.75, bodyTop - 26],
          [cx + hw * 0.2, bodyTop - 12],
          [cx + hw * 0.6, bodyTop + 3],
          [cx + hw * 1.25, bodyTop + 9],
        ],
        { rng, fill: def.hatColor || '#8f7fb0', width: 2, close: true }
      );
      break;
    case 'beanie':
      shape(
        ctx,
        [
          [cx - hw * 0.85, bodyTop + 10],
          [cx - hw * 0.8, bodyTop - 2],
          [cx, bodyTop - 8],
          [cx + hw * 0.8, bodyTop - 2],
          [cx + hw * 0.85, bodyTop + 10],
        ],
        { rng, fill: c, width: 2, close: true }
      );
      line(ctx, cx - hw * 0.85, bodyTop + 10, cx + hw * 0.85, bodyTop + 10, { rng, width: 2.4 });
      ellipse(ctx, cx, bodyTop - 11, 3.6, 3.6, { rng, fill: P.paper, width: 1.8 });
      break;
    case 'headband':
      shape(
        ctx,
        [
          [cx - hw * 0.95, bodyTop + 16],
          [cx, bodyTop + 12],
          [cx + hw * 0.95, bodyTop + 16],
        ],
        { rng, fill: null, stroke: INK, width: 4.5, close: false }
      );
      line(ctx, cx + hw * 0.9, bodyTop + 15, cx + hw * 1.5, bodyTop + 24, { rng, width: 2 });
      break;
    case 'horns':
      for (const s of [-1, 1]) {
        shape(
          ctx,
          [
            [cx + s * hw * 0.55, bodyTop + 4],
            [cx + s * hw * 1.0, bodyTop - 9],
            [cx + s * hw * 0.78, bodyTop + 2],
          ],
          { rng, fill: P.cloth, width: 2, close: true }
        );
      }
      break;
    case 'antenna':
      line(ctx, cx, bodyTop + 2, cx + 3, bodyTop - 20, { rng, width: 1.8 });
      ellipse(ctx, cx + 4, bodyTop - 23, 3.4, 3.4, { rng, fill: P.lanternGlow, width: 1.8 });
      break;
    case 'ears':
      for (const s of [-1, 1]) {
        shape(
          ctx,
          [
            [cx + s * hw * 0.35, bodyTop + 6],
            [cx + s * hw * 0.9, bodyTop - 16],
            [cx + s * hw * 1.05, bodyTop + 4],
          ],
          { rng, fill: def.color, width: 2, close: true }
        );
      }
      break;
    case 'leaf':
      shape(
        ctx,
        [
          [cx, bodyTop + 2],
          [cx + 12, bodyTop - 12],
          [cx + 20, bodyTop - 4],
          [cx + 6, bodyTop + 4],
        ],
        { rng, fill: P.leaf, width: 1.8, close: true }
      );
      break;
    default:
      break;
  }
}

function drawItem(ctx, rng, geo, def, handX, handY) {
  switch (def.item) {
    case 'spear':
      line(ctx, handX + 2, handY + 26, handX + 8, handY - 44, { rng, width: 2.6 });
      shape(
        ctx,
        [
          [handX + 8, handY - 44],
          [handX + 3, handY - 54],
          [handX + 12, handY - 62],
          [handX + 13, handY - 48],
        ],
        { rng, fill: P.stone, width: 1.8, close: true }
      );
      break;
    case 'flag':
      line(ctx, handX + 4, handY + 22, handX + 4, handY - 44, { rng, width: 2.4 });
      shape(
        ctx,
        [
          [handX + 5, handY - 44],
          [handX + 30, handY - 36],
          [handX + 5, handY - 26],
        ],
        { rng, fill: P.roofRed, width: 1.8, close: true }
      );
      break;
    case 'staff':
      line(ctx, handX + 2, handY + 26, handX + 6, handY - 40, { rng, width: 3 });
      ellipse(ctx, handX + 7, handY - 45, 5, 5, { rng, fill: P.lanternGlow, width: 1.8 });
      break;
    case 'sword':
      line(ctx, handX + 2, handY + 10, handX + 24, handY - 30, { rng, width: 3.4, stroke: P.stone });
      line(ctx, handX + 2, handY + 10, handX + 24, handY - 30, { rng, width: 1.4 });
      line(ctx, handX - 4, handY + 2, handX + 10, handY + 10, { rng, width: 2.4 });
      break;
    case 'lantern':
      line(ctx, handX + 2, handY, handX + 6, handY + 12, { rng, width: 1.6 });
      shape(
        ctx,
        [
          [handX, handY + 12],
          [handX + 13, handY + 12],
          [handX + 15, handY + 26],
          [handX - 2, handY + 26],
        ],
        { rng, fill: P.lanternGlow, width: 1.8, close: true }
      );
      break;
    default:
      break;
  }
}

/**
 * 콩 캐릭터 1프레임을 그린다.
 * def : 외형 정의, pose : 포즈 파라미터
 */
export function drawBean(ctx, rng, def, pose) {
  const geo = bodyOutline(def, pose);
  const { cx, bodyTop, bodyBot, hw } = geo;
  const bob = pose.bob || 0;
  ctx.save();
  ctx.translate(0, bob);

  const legTop = bodyBot - 4;
  const footY = GROUND - (pose.lift || 0);

  // 다리 + 발 (몸 뒤)
  if (!pose.sit) {
    const legs = pose.legs || [
      [-0.34, 0],
      [0.34, 0],
    ];
    for (const [lx, ly] of legs) {
      const fx = cx + lx * hw * 1.5;
      const fy = footY + ly * 10;
      line(ctx, cx + lx * hw * 0.55, legTop, fx, fy - 3, { rng, width: 2.2 });
      ellipse(ctx, fx, fy, 7.5, 4.2, { rng, fill: def.footColor || P.paper, width: 2 });
    }
  } else {
    for (const s of [-1, 1]) {
      ellipse(ctx, cx + s * hw * 0.85, GROUND - 2, 7.5, 4.2, { rng, fill: def.footColor || P.paper, width: 2 });
    }
  }

  // 몸통
  const bodyPath = smoothPath(geo.pts, true);
  shape(ctx, geo.pts, { rng, fill: def.color, width: 2.4, rough: 1.0 });
  volumeShade(ctx, bodyPath, def.color);

  // 허리선 / 어깨띠
  if (def.belt) {
    const by = bodyBot - (bodyBot - bodyTop) * 0.22;
    line(ctx, cx - hw * 0.86, by, cx + hw * 0.86, by, { rng, width: 2.2 });
    shape(
      ctx,
      [
        [cx - 6, by - 4],
        [cx + 6, by - 4],
        [cx + 6, by + 5],
        [cx - 6, by + 5],
      ],
      { rng, fill: P.leafGold, width: 1.6, close: true }
    );
  }
  if (def.sash) {
    line(ctx, cx - hw * 0.9, bodyBot - (bodyBot - bodyTop) * 0.1, cx + hw * 0.75, bodyTop + (bodyBot - bodyTop) * 0.5, {
      rng,
      width: 3.2,
      stroke: def.sashColor || P.roofRed,
    });
  }
  if (def.stripes) {
    for (let i = 1; i <= 2; i++) {
      const y = bodyTop + (bodyBot - bodyTop) * (0.45 + i * 0.16);
      line(ctx, cx - hw * 0.8, y, cx + hw * 0.8, y, { rng, width: 2 });
    }
  }

  // 팔 + 동그란 손
  const armY = bodyTop + (bodyBot - bodyTop) * 0.62;
  const arms = pose.arms || [-0.35, 0.35];
  let handRX = cx;
  let handRY = armY;
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const a = arms[i]; // 각도(라디안 비슷한 값): 음수=위
    const sx = cx + s * hw * 0.9;
    const ex = sx + s * (10 + Math.abs(a) * 4);
    const ey = armY + Math.sin(a) * 22;
    line(ctx, sx, armY, ex, ey, { rng, width: 2.1 });
    ellipse(ctx, ex + s * 3, ey, 4.6, 4.6, { rng, fill: def.color, width: 2 });
    if (s === 1) {
      handRX = ex + 3;
      handRY = ey;
    }
  }

  drawFace(ctx, rng, geo, def, pose);
  if (def.hat) drawHat(ctx, rng, geo, def);
  if (def.item) drawItem(ctx, rng, geo, def, handRX, handRY);

  // 감정 기호
  if (pose.emote === 'zzz') {
    ctx.save();
    ctx.fillStyle = INK;
    ctx.font = 'italic 15px "Comic Sans MS", cursive';
    ctx.fillText('z', cx + hw + 6, bodyTop + 2);
    ctx.font = 'italic 11px "Comic Sans MS", cursive';
    ctx.fillText('z', cx + hw + 17, bodyTop - 9);
    ctx.restore();
  } else if (pose.emote === 'excl') {
    for (let i = -1; i <= 1; i++) {
      line(ctx, cx + i * 11, bodyTop - 8 + Math.abs(i) * 3, cx + i * 15, bodyTop - 18 + Math.abs(i) * 3, {
        rng,
        width: 2.4,
      });
    }
  }

  ctx.restore();
}

// ── 포즈 프리셋 ───────────────────────────────
const POSES = {
  idle0: { bob: 0, arms: [0.15, 0.15], legs: [[-0.34, 0], [0.34, 0]] },
  idle1: { bob: 1.6, squashY: 0.985, squashX: 1.015, arms: [0.22, 0.22], legs: [[-0.34, 0], [0.34, 0]] },
  walk0: { bob: -1.2, lean: 0.18, arms: [-0.3, 0.4], legs: [[-0.55, -0.9], [0.34, 0]] },
  walk1: { bob: 0.8, lean: 0.12, arms: [0.1, 0.1], legs: [[-0.2, 0], [0.2, 0]] },
  walk2: { bob: -1.2, lean: 0.18, arms: [0.4, -0.3], legs: [[-0.34, 0], [0.55, -0.9]] },
  walk3: { bob: 0.8, lean: 0.12, arms: [0.1, 0.1], legs: [[-0.2, 0], [0.2, 0]] },
  jump: { bob: -3, lean: 0.1, arms: [-0.9, -0.9], legs: [[-0.5, -1.6], [0.5, -1.4]], eyes: 'surprised', mouth: 'o' },
  fall: { bob: 1, arms: [-0.5, -0.5], legs: [[-0.4, -0.6], [0.42, -0.5]], mouth: 'flat' },
  sit: { sit: true, tuck: 0.42, arms: [0.5, 0.5], eyes: 'happy' },
  sleep0: { sit: true, tuck: 0.5, arms: [0.6, 0.6], eyes: 'closed', mouth: 'flat', emote: 'zzz' },
  sleep1: { sit: true, tuck: 0.55, squashY: 0.97, arms: [0.6, 0.6], eyes: 'closed', mouth: 'flat', emote: 'zzz' },
  cheer: { bob: -2.4, arms: [-1.25, -1.25], legs: [[-0.4, -0.5], [0.4, -0.5]], eyes: 'happy', mouth: 'wide' },
  talk0: { arms: [0.15, -0.2], mouth: 'o' },
  talk1: { bob: 1.2, arms: [0.15, -0.35], mouth: 'wide' },
  surprised: { bob: -1, arms: [-0.7, -0.7], eyes: 'surprised', mouth: 'o', emote: 'excl' },
};

const FULL_SET = {
  idle: ['idle0', 'idle1'],
  walk: ['walk0', 'walk1', 'walk2', 'walk3'],
  jump: ['jump'],
  fall: ['fall'],
  sit: ['sit'],
  sleep: ['sleep0', 'sleep1'],
  cheer: ['cheer'],
  talk: ['talk0', 'talk1'],
  surprised: ['surprised'],
};

const LITE_SET = {
  idle: ['idle0', 'idle1'],
  walk: ['walk0', 'walk1', 'walk2', 'walk3'],
  talk: ['talk0', 'talk1'],
  cheer: ['cheer'],
};

const STILL_SET = {
  idle: ['idle0', 'idle1'],
  talk: ['talk0', 'talk1'],
  cheer: ['cheer'],
};

/**
 * 캐릭터 정의로 애니메이션 세트를 굽는다.
 * @param {object} def {shape,color,width,hat,item,...}
 * @param {'full'|'lite'|'still'} level
 */
export function bakeBean(def, level = 'lite') {
  const set = level === 'full' ? FULL_SET : level === 'still' ? STILL_SET : LITE_SET;
  const seedBase = def.seed || 11;
  const out = {};
  for (const [name, frames] of Object.entries(set)) {
    out[name] = frames.map((poseName, i) =>
      bake({
        w: W,
        h: H,
        ss: def.ss || 1.8,
        seed: seedBase + i * 13,
        pad: 26,
        draw: (ctx, rng) => drawBean(ctx, rng, def, POSES[poseName]),
      })
    );
  }
  out.height = def.heightUnits || 1.45;
  return out;
}

export { W as BEAN_W, H as BEAN_H, POSES };
