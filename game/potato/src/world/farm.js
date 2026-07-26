// 감자 농장 — 밭 상태 기계와 월드 배치.
// 밭 한 칸: grass → tilled → (씨감자) stage 0..4 → 수확 / 방치하면 시듦.
import { makeRng, rand, randInt, pick, clamp } from '../core/rng.js';

export const PLOT_SIZE = 1.7; // 밭 한 칸 월드 크기
export const FIELD_COLS = 4;
export const FIELD_ROWS = 3;
export const EXTRA_ROWS = 2; // 땅 확장으로 열리는 줄

// 성장 단계별 소요 시간(초)·필요 수분
export const STAGE_TIME = [16, 22, 26, 24, Infinity];
export const MOIST_DRAIN = 1 / 55; // 초당 수분 감소
export const WILT_AFTER = 65; // 바싹 마른 채 이 시간이 지나면 시든다

export function plotPos(col, row) {
  // 밭은 광장 서쪽. 오른쪽(동쪽)에 우물/판매대가 있다
  return {
    x: -4.6 + col * (PLOT_SIZE + 0.55),
    z: -2.6 + row * (PLOT_SIZE + 0.75),
  };
}

export function makePlot(col, row, locked) {
  const p = plotPos(col, row);
  return {
    col,
    row,
    x: p.x,
    z: p.z,
    locked, // 땅 확장 전
    state: 'grass', // grass | tilled | crop | wilted
    weed: !locked && Math.random() < 0.35,
    stage: 0,
    t: 0, // 현 단계 경과
    moisture: 0,
    dryT: 0, // 수분 0으로 버틴 시간
    fert: false,
  };
}

export function makeFarm() {
  const plots = [];
  for (let row = 0; row < FIELD_ROWS + EXTRA_ROWS; row++) {
    for (let col = 0; col < FIELD_COLS; col++) {
      plots.push(makePlot(col, row, row >= FIELD_ROWS));
    }
  }
  return plots;
}

/** 밭 상태 갱신 — dt 초, raining 이면 물이 저절로 찬다 */
export function updatePlot(plot, dt, raining, growMul = 1) {
  if (plot.state !== 'crop') return null;
  if (raining) plot.moisture = clamp(plot.moisture + dt * 0.5, 0, 1);
  plot.moisture = clamp(plot.moisture - dt * MOIST_DRAIN, 0, 1);

  if (plot.stage >= 4) return null; // 다 컸다 — 수확 대기
  if (plot.moisture > 0.12) {
    plot.dryT = 0;
    plot.t += dt * (plot.fert ? 1.3 : 1) * growMul;
    if (plot.t >= STAGE_TIME[plot.stage]) {
      plot.t = 0;
      plot.stage++;
      return 'grew';
    }
  } else {
    plot.dryT += dt;
    if (plot.dryT > WILT_AFTER && plot.stage >= 1) {
      plot.state = 'wilted';
      return 'wilted';
    }
  }
  return null;
}

// ── 월드 배치(소품·데칼) ─────────────────────
export const SPOTS = {
  well: { x: 4.6, z: -1.2 },
  stall: { x: 5.4, z: 2.4 },
  shed: { x: -6.2, z: 6.4 },
  scarecrow: { x: -1.4, z: -4.6 },
  mailbox: { x: 3.0, z: 5.2 },
  sign: { x: 1.6, z: 6.6 },
};

export function buildDressing(props) {
  const rng = makeRng(20260726);
  const out = [];
  const add = (sprite, x, z, opt = {}) => out.push({ sprite, x, z, scale: opt.scale || 1, flip: opt.flip || false, sway: opt.sway || 0, phase: rng() * 6, r: opt.r ?? 0.4, shadow: opt.shadow ?? 1 });

  // 농장 시설
  add(props.well[0], SPOTS.well.x, SPOTS.well.z, { r: 0.9 });
  add(props.stall[0], SPOTS.stall.x, SPOTS.stall.z, { r: 1.2 });
  add(props.shed[0], SPOTS.shed.x, SPOTS.shed.z, { r: 1.4 });
  add(props.mailbox[0], SPOTS.mailbox.x, SPOTS.mailbox.z, { r: 0.3 });
  add(props.sign[0], SPOTS.sign.x, SPOTS.sign.z, { r: 0.3 });
  add(props.barrel[0], SPOTS.well.x + 0.9, SPOTS.well.z + 0.7, { r: 0.4 });
  add(props.crate[0], SPOTS.stall.x - 1.2, SPOTS.stall.z + 0.6, { r: 0.4 });
  add(props.crate[0], SPOTS.stall.x - 0.9, SPOTS.stall.z + 1.3, { r: 0.4, flip: true });

  // 밭 둘레 울타리 (남쪽 입구는 비워 둔다)
  const fx0 = -5.6;
  const fx1 = 2.4;
  const fz0 = -3.6;
  const fz1 = 8.0;
  for (let x = fx0; x <= fx1; x += 1.35) {
    add(pick(rng, props.fence), x, fz0, { r: 0, sway: 0 });
  }
  for (let z = fz0; z <= fz1; z += 1.35) {
    add(pick(rng, props.fence), fx0 - 0.7, z, { r: 0 });
  }
  for (let x = fx0; x <= fx1 - 4.2; x += 1.35) {
    add(pick(rng, props.fence), x, fz1, { r: 0 });
  }

  // 숲 테두리 — 뒤틀린 나무들이 농장을 두 겹으로 감싼다
  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI * 2;
    const r = 11.5 + rng() * 7;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.9 + 1.5;
    const roll = rng();
    const sp = roll < 0.42 ? pick(rng, props.treeRound) : roll < 0.8 ? pick(rng, props.treeSpiky) : props.treeDead[0];
    add(sp, x, z, { scale: 0.85 + rng() * 0.4, flip: rng() < 0.5, sway: 0.5, r: 0.5 });
  }
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2;
    const r = 18 + rng() * 8;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.9 + 1.5;
    const sp = rng() < 0.5 ? pick(rng, props.treeRound) : pick(rng, props.treeSpiky);
    add(sp, x, z, { scale: 0.9 + rng() * 0.5, flip: rng() < 0.5, sway: 0.4, r: 0 });
  }
  // 사이사이 바위·풀·꽃
  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2;
    const r = 3.5 + rng() * 10.5;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.9 + 1.5;
    // 밭·시설 위는 피한다
    if (x > -5.8 && x < 2.6 && z > -3.8 && z < 8.2) continue;
    if (Math.hypot(x - SPOTS.stall.x, z - SPOTS.stall.z) < 1.6) continue;
    const roll = rng();
    const sp = roll < 0.5 ? pick(rng, props.grass) : roll < 0.72 ? pick(rng, props.flower) : roll < 0.88 ? pick(rng, props.rock) : pick(rng, props.grass);
    add(sp, x, z, { scale: 0.8 + rng() * 0.5, flip: rng() < 0.5, sway: roll < 0.72 ? 1 : 0, r: 0, shadow: 0.5 });
  }
  return out;
}
