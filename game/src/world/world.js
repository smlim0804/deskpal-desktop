// 숲마을 "Bean Hollow" 레이아웃 생성
import { makeRng, rand, pick, randInt } from '../core/rng.js';
import { P } from '../art/palette.js';

export const WORLD_RADIUS = 46;
export const GATE = { x: 0, z: 17 };
export const PLAZA = { x: 0, z: 0 };
export const POND = { x: 15.5, z: 7.5, r: 6.2 };

let uid = 1;
const nextId = () => uid++;

function prop(list, sprites, x, z, opt = {}) {
  const sp = Array.isArray(sprites) ? pick(opt.rng || Math.random, sprites) : sprites;
  list.push({
    id: nextId(),
    kind: 'prop',
    x,
    z,
    y: 0,
    sprite: sp,
    h: opt.h || sp.hUnits || 1,
    r: opt.r != null ? opt.r : sp.radius || 0,
    sway: opt.sway != null ? opt.sway : sp.sway || 0,
    phase: (x * 7.3 + z * 3.1) % 6.28,
    shadow: opt.shadow != null ? opt.shadow : 1,
    glow: opt.glow || 0,
    glowR: opt.glowR || 2.6,
    tag: opt.tag || null,
    noFade: !!opt.noFade,
    flip: opt.flip || false,
  });
  return list[list.length - 1];
}

// 길 위/건물 위인지 확인해서 잡초가 안 나게
function tooClose(list, x, z, d) {
  for (const e of list) {
    if ((e.x - x) ** 2 + (e.z - z) ** 2 < d * d) return true;
  }
  return false;
}

function pathPolyline() {
  return [
    [0, 20],
    [0, 12],
    [0.6, 6],
    [0, 0],
    [-5.5, -2.5],
    [-10, -5.5],
  ];
}

function branchPolyline() {
  return [
    [0, 0],
    [5, 1.5],
    [9.5, 3.5],
    [13, 5.5],
  ];
}

// 길 바닥 돌 데칼
function makePathDecals(rng, line, width, decals) {
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, z0] = line[i];
    const [x1, z1] = line[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(2, Math.round(len * 1.5));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const cx = x0 + (x1 - x0) * t;
      const cz = z0 + (z1 - z0) * t;
      const n = randInt(rng, 2, 3);
      for (let k = 0; k < n; k++) {
        const ox = (rng() - 0.5) * width;
        const oz = (rng() - 0.5) * 1.1;
        const w = rand(rng, 0.34, 0.62);
        const d = rand(rng, 0.26, 0.46);
        const rot = rand(rng, -0.5, 0.5);
        decals.push(stoneDecal(cx + ox, cz + oz, w, d, rot, rng));
      }
    }
  }
}

function stoneDecal(cx, cz, w, d, rot, rng) {
  const pts = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 1 + (rng() - 0.5) * 0.3;
    const px = Math.cos(a) * w * rr;
    const pz = Math.sin(a) * d * rr;
    pts.push([cx + px * Math.cos(rot) - pz * Math.sin(rot), cz + px * Math.sin(rot) + pz * Math.cos(rot)]);
  }
  return { pts, fill: rng() < 0.5 ? P.stone : P.dirt, stroke: 'rgba(51,48,43,0.45)', width: 1.2, sort: cz };
}

function circleDecal(cx, cz, r, fill, stroke, wob = 0.12, rng = Math.random, n = 18) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (rng() - 0.5) * wob * 2);
    pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr * 0.92]);
  }
  return { pts, fill, stroke, width: 1.6, sort: cz };
}

export function buildWorld(A) {
  const rng = makeRng(20260725);
  const props = [];
  const decals = [];
  const pickups = [];
  const npcs = [];

  // ── 바닥 데칼 ────────────────────────────
  decals.push(circleDecal(PLAZA.x, PLAZA.z, 5.4, P.dirt, 'rgba(51,48,43,0.3)', 0.1, rng, 24));
  decals.push(circleDecal(POND.x, POND.z, POND.r, P.water, 'rgba(51,48,43,0.45)', 0.09, rng, 26));
  decals.push(circleDecal(POND.x - 0.4, POND.z + 0.3, POND.r * 0.66, P.waterDeep, null, 0.12, rng, 22));
  const patchTints = [
    'rgba(146,180,110,0.34)',
    'rgba(170,199,126,0.30)',
    'rgba(128,164,96,0.26)',
    'rgba(206,214,160,0.24)',
  ];
  for (let i = 0; i < 26; i++) {
    decals.push(
      circleDecal(
        rand(rng, -34, 34),
        rand(rng, -34, 30),
        rand(rng, 1.4, 4.6),
        patchTints[i % patchTints.length],
        null,
        0.24,
        rng,
        14
      )
    );
  }
  makePathDecals(rng, pathPolyline(), 2.0, decals);
  makePathDecals(rng, branchPolyline(), 1.6, decals);

  // ── 마을 건물 ────────────────────────────
  const gate = prop(props, A.props.gate[0], GATE.x, GATE.z, { rng, tag: 'gate', r: 0, noFade: true, glowR: 5 });
  prop(props, A.props.well[0], 1.6, -0.4, { rng, tag: 'well' });
  prop(props, A.props.campfire[0], -2.4, 1.6, { rng, glow: 1, glowR: 3.4, tag: 'fire' });

  prop(props, A.props.cottage[0], -9.5, -5.5, { rng });
  prop(props, A.props.cottage[1], 8.5, -6.5, { rng });
  prop(props, A.props.cottage[2], -7.5, 5.5, { rng });
  prop(props, A.props.hut[0], 12.5, -1.5, { rng });
  prop(props, A.props.hut[1], -14.5, 1.0, { rng });
  prop(props, A.props.shop[0], -4.5, -4.2, { rng, tag: 'shop' });
  prop(props, A.props.windmill[0], 17.5, -11.5, { rng });
  prop(props, A.props.tower[0], -17.5, -12.5, { rng });
  prop(props, A.props.tent[0], 5.5, 6.5, { rng });
  prop(props, A.props.tent[1], 7.8, 8.4, { rng, flip: true });
  prop(props, A.props.ruin[0], -20.5, 7.5, { rng, tag: 'ruin' });
  prop(props, A.props.cart[0], 3.4, 3.2, { rng });
  prop(props, A.props.bridge[0], POND.x - 0.2, POND.z - 5.6, { rng, r: 0 });

  // 소품
  for (const [x, z] of [
    [-3.4, -3.0],
    [-2.4, -2.2],
    [10.5, -2.4],
    [4.8, 4.6],
  ])
    prop(props, A.props.barrel, x, z, { rng });
  for (const [x, z] of [
    [-5.8, -2.6],
    [11.4, -0.6],
    [6.2, 5.2],
  ])
    prop(props, A.props.crate, x, z, { rng });

  // 가로등 (밤에 빛남)
  for (const [x, z] of [
    [-2.2, 8.5],
    [2.4, 8.5],
    [-2.6, 2.6],
    [3.2, -2.4],
    [-8.6, -1.6],
  ])
    prop(props, A.props.lamp, x, z, { rng, glow: 1, glowR: 3.2, noFade: true });

  prop(props, A.props.sign[0], 1.8, 11.5, { rng });

  // 울타리 줄
  for (let i = 0; i < 5; i++) prop(props, A.props.fence, -12.5 + i * 1.9, -8.6, { rng });
  for (let i = 0; i < 4; i++) prop(props, A.props.fence, 12.0, -4.0 + i * 1.9, { rng });

  // ── 숲 ──────────────────────────────────
  const treeKinds = [A.trees.pine, A.trees.blob, A.trees.willow, A.trees.bare, A.trees.autumn];
  // 바깥 숲 링 (월드 경계 느낌)
  for (let i = 0; i < 190; i++) {
    const a = rng() * Math.PI * 2;
    const r = rand(rng, 25, WORLD_RADIUS);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const kind = rng() < 0.45 ? A.trees.pine : pick(rng, treeKinds);
    prop(props, kind, x, z, { rng });
  }
  // 마을 안쪽 나무 (건물 피해서)
  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI * 2;
    const r = rand(rng, 7, 24);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.5) continue;
    if (Math.abs(x) < 2.6 && z > -2 && z < 20) continue; // 대문 길목
    if (tooClose(props, x, z, 3.4)) continue;
    prop(props, pick(rng, treeKinds), x, z, { rng });
  }

  // 덤불 / 그루터기 / 통나무 / 바위
  for (let i = 0; i < 60; i++) {
    const a = rng() * Math.PI * 2;
    const r = rand(rng, 6, 34);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (tooClose(props, x, z, 2.0)) continue;
    const table = [A.props.bush, A.props.bush, A.props.rock, A.props.stump, A.props.log, A.props.berryBush];
    prop(props, pick(rng, table), x, z, { rng });
  }

  // 잔풀 / 꽃 / 버섯 — 충돌 없음, 분위기 담당
  for (let i = 0; i < 860; i++) {
    const a = rng() * Math.PI * 2;
    const r = rand(rng, 1.5, 40);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const inPond = Math.hypot(x - POND.x, z - POND.z) < POND.r - 0.4;
    if (inPond) continue;
    const roll = rng();
    let sp;
    if (roll < 0.62) sp = A.props.grass;
    else if (roll < 0.78) sp = A.props.flower;
    else if (roll < 0.88) sp = A.props.mushroom;
    else sp = A.props.sapling;
    prop(props, sp, x, z, { rng, r: 0, shadow: 0.45 });
  }
  // 연못가 부들
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2;
    const r = POND.r + rand(rng, -0.3, 0.9);
    prop(props, A.props.cattail, POND.x + Math.cos(a) * r, POND.z + Math.sin(a) * r * 0.95, { rng, r: 0 });
  }

  // ── 수집품 ──────────────────────────────
  const acornSpots = [
    [-6.2, 2.4],
    [4.6, -4.4],
    [-11.5, -2.2],
    [9.4, 2.6],
    [-3.2, 10.4],
    [13.6, -7.5],
    [-16.2, 4.6],
    [6.8, -9.6],
    [19.4, 3.2],
    [-9.8, 12.5],
    [2.2, -12.4],
    [-21.5, -4.5],
  ];
  acornSpots.forEach(([x, z], i) => {
    pickups.push({
      id: nextId(),
      kind: 'acorn',
      x,
      z,
      y: 0,
      sprite: A.props.acorn[0],
      h: 0.5,
      phase: i * 1.3,
      taken: false,
    });
  });

  const lanternSpots = [
    { x: -20.0, z: 9.2, hint: '무너진 아치 곁' },
    { x: 19.8, z: -12.6, hint: '풍차 뒤편' },
    { x: 13.0, z: 12.4, hint: '연못 건너 갈대밭' },
    { x: -19.5, z: -14.5, hint: '망루 밑동' },
    { x: 0.5, z: -16.5, hint: '북쪽 숲 깊은 곳' },
  ];
  lanternSpots.forEach((s, i) => {
    pickups.push({
      id: nextId(),
      kind: 'lantern',
      x: s.x,
      z: s.z,
      y: 0,
      sprite: A.props.lantern[0],
      litSprite: A.props.lanternLit[0],
      h: 0.8,
      glow: 0.7,
      glowR: 2.2,
      glowY: 0.5,
      phase: i * 2.1,
      hint: s.hint,
      index: i,
      taken: false,
    });
  });

  // ── NPC ─────────────────────────────────
  const place = (id, x, z, extra = {}) => {
    const set = A.beans[id];
    npcs.push({
      id: nextId(),
      npcId: id,
      kind: 'npc',
      x,
      z,
      y: 0,
      home: { x, z },
      set,
      h: set.height,
      r: 0.42,
      face: extra.face ?? 1,
      wander: extra.wander ?? 2.2,
      state: extra.state || 'idle',
      t: rng() * 5,
      anim: 0,
      ...extra,
    });
  };
  place('guard', -1.9, 15.2, { wander: 0.8 });
  place('elder', 2.6, 1.8, { wander: 1.2 });
  place('trader', -4.2, -2.4, { wander: 0.6 });
  place('smith', -8.2, -3.6, { wander: 1.6 });
  place('kid', 1.2, 5.4, { wander: 3.4 });
  place('witch', -18.6, 6.2, { wander: 1.0 });
  place('farmer', 9.6, -4.4, { wander: 2.4 });
  place('sleepy', 6.4, 7.4, { wander: 0, state: 'sleep' });

  // 숲 친구들 (크리처)
  const critters = [];
  const cAdd = (kind, x, z, opt = {}) => {
    const c = A.critters[kind];
    critters.push({
      id: nextId(),
      kind: 'critter',
      type: kind,
      x,
      z,
      y: 0,
      home: { x, z },
      set: c,
      h: c.height,
      r: c.radius,
      t: rng() * 6,
      speed: opt.speed ?? 0.8,
      wander: opt.wander ?? 2.5,
      hover: opt.hover || 0,
      flip: false,
    });
  };
  cAdd('chick', 2.8, 6.6, { speed: 1.1, wander: 3 });
  cAdd('chick', 3.6, 7.2, { speed: 1.2, wander: 3 });
  cAdd('cloudSheep', -6.4, 8.4, { speed: 0.5, wander: 4 });
  cAdd('cloudSheep', -8.2, 9.6, { speed: 0.5, wander: 4 });
  cAdd('snail', -2.6, -6.2, { speed: 0.18, wander: 1.6 });
  cAdd('bug', 12.2, -5.4, { speed: 0.9, wander: 3.4 });
  cAdd('spiky', -13.4, -6.6, { speed: 0.7, wander: 3 });
  cAdd('mushroomFolk', -15.8, 3.2, { speed: 0.4, wander: 2 });
  cAdd('worm', 5.2, -1.8, { speed: 0.15, wander: 1.2 });
  cAdd('ghost', -20.2, 5.4, { speed: 0.6, wander: 3, hover: 0.5 });
  cAdd('robot', 16.4, -9.6, { speed: 0.7, wander: 2.4 });

  return {
    props,
    decals: decals.sort((a, b) => a.sort - b.sort),
    pickups,
    npcs,
    critters,
    gate,
    radius: WORLD_RADIUS,
  };
}
