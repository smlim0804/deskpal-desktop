// 숲마을 "Bean Hollow" 레이아웃 생성
import { makeRng, rand, pick, randInt } from '../core/rng.js';
import { P } from '../art/palette.js';
import { heightAt, distToPath, WORLD_RADIUS, GATE, PLAZA, POND, WATER_Y } from './terrain.js';

export { WORLD_RADIUS, GATE, PLAZA, POND, WATER_Y, heightAt };

let uid = 1;
const nextId = () => uid++;

function prop(list, models, x, z, opt = {}) {
  const rng = opt.rng || Math.random;
  const sp = Array.isArray(models) ? pick(rng, models) : models;
  const scale = opt.scale != null ? opt.scale : 1;
  const gy = heightAt(x, z);
  list.push({
    id: nextId(),
    kind: 'prop',
    x,
    z,
    y: gy,
    gy,
    model: sp,
    ry: opt.ry != null ? opt.ry : rng() * Math.PI * 2,
    scale,
    h: (opt.h || sp.hUnits || 1) * scale,
    r: (opt.r != null ? opt.r : sp.radius || 0) * scale,
    sway: opt.sway != null ? opt.sway : sp.sway || 0,
    shadowR: (sp.shadowR || 0.35) * scale,
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

/**
 * 오브젝트 밑동에 잡초·버섯·자갈을 둘러 준다.
 * 물체와 땅이 만나는 선을 흐려 줘서 "얹어 놓은 스티커" 느낌을 없앤다.
 */
function dress(props, A, rng, x, z, r, opt = {}) {
  const n = opt.count != null ? opt.count : randInt(rng, 3, 6);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const d = r * rand(rng, 0.55, 1.45);
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const roll = rng();
    let table;
    if (roll < (opt.grass ?? 0.62)) table = A.props.grass;
    else if (roll < 0.78) table = A.props.flower;
    else if (roll < 0.9) table = A.props.mushroom;
    else table = A.props.sapling;
    prop(props, table, px, pz, { rng, r: 0, shadow: 0.4, scale: rand(rng, 0.8, 1.3) });
  }
  if (opt.pebbles !== false && rng() < 0.7) {
    const a = rng() * Math.PI * 2;
    prop(props, A.props.rock, x + Math.cos(a) * r * 1.3, z + Math.sin(a) * r * 1.3, {
      rng,
      scale: rand(rng, 0.22, 0.4),
      shadow: 0.5,
      r: 0,
    });
  }
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

/** 흙길 리본 — 지형 위에 깔리는 폭 있는 띠 */
function makePathRibbon(rng, line, width, decals, color) {
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, z0] = line[i];
    const [x1, z1] = line[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(2, Math.round(len / 1.4));
    for (let s = 0; s < steps; s++) {
      const ta = s / steps;
      const tb = (s + 1) / steps;
      const ax = x0 + (x1 - x0) * ta;
      const az = z0 + (z1 - z0) * ta;
      const bx = x0 + (x1 - x0) * tb;
      const bz = z0 + (z1 - z0) * tb;
      const dx = bx - ax;
      const dz = bz - az;
      const dl = Math.hypot(dx, dz) || 1;
      const nx = -dz / dl;
      const nz = dx / dl;
      const wa = width * rand(rng, 0.86, 1.14);
      const wb = width * rand(rng, 0.86, 1.14);
      decals.push({
        pts: [
          [ax + nx * wa, az + nz * wa],
          [bx + nx * wb, bz + nz * wb],
          [bx - nx * wb, bz - nz * wb],
          [ax - nx * wa, az - nz * wa],
        ],
        fill: color,
        stroke: null,
        width: 0,
        sort: -100 + az * 0.001,
      });
    }
  }
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
  // 흙·이끼 얼룩 (지형 색 위에 살짝 얹는 정도)
  const patchTints = [
    'rgba(150,176,112,0.26)',
    'rgba(186,196,140,0.22)',
    'rgba(124,156,96,0.20)',
    'rgba(206,190,150,0.20)',
  ];
  for (let i = 0; i < 34; i++) {
    const px = rand(rng, -34, 34);
    const pz = rand(rng, -34, 30);
    if (Math.hypot(px - POND.x, pz - POND.z) < POND.r) continue;
    decals.push(circleDecal(px, pz, rand(rng, 1.2, 4.2), patchTints[i % patchTints.length], null, 0.26, rng, 13));
  }
  // 흙길 → 가장자리 → 디딤돌 순으로 겹쳐 깐다
  makePathRibbon(rng, pathPolyline(), 1.85, decals, 'rgba(211,190,152,0.92)');
  makePathRibbon(rng, branchPolyline(), 1.45, decals, 'rgba(211,190,152,0.88)');
  makePathRibbon(rng, pathPolyline(), 1.25, decals, 'rgba(221,203,168,0.9)');
  makePathRibbon(rng, branchPolyline(), 0.95, decals, 'rgba(221,203,168,0.85)');
  decals.push(circleDecal(PLAZA.x, PLAZA.z, 5.0, 'rgba(211,190,152,0.9)', null, 0.09, rng, 26));
  decals.push(circleDecal(PLAZA.x + 0.4, PLAZA.z - 0.3, 3.4, 'rgba(223,206,172,0.8)', null, 0.13, rng, 22));
  makePathDecals(rng, pathPolyline(), 2.0, decals);
  makePathDecals(rng, branchPolyline(), 1.6, decals);

  // ── 마을 건물 ────────────────────────────
  const gate = prop(props, A.props.gate[0], GATE.x, GATE.z, { rng, tag: 'gate', r: 0, noFade: true, glowR: 5, ry: 0 });
  prop(props, A.props.well[0], 1.6, -0.4, { rng, tag: 'well', ry: 0.2 });
  prop(props, A.props.campfire[0], -2.4, 1.6, { rng, glow: 1, glowR: 3.4, tag: 'fire' });

  prop(props, A.props.cottage[0], -9.5, -5.5, { rng, ry: 0.55 });
  prop(props, A.props.cottage[1], 8.5, -6.5, { rng, ry: -0.5 });
  prop(props, A.props.cottage[2], -7.5, 5.5, { rng, ry: 1.9 });
  prop(props, A.props.hut[0], 12.5, -1.5, { rng, ry: -1.4 });
  prop(props, A.props.hut[1], -14.5, 1.0, { rng, ry: 1.5 });
  prop(props, A.props.shop[0], -4.5, -4.2, { rng, tag: 'shop', ry: 0.25 });
  prop(props, A.props.windmill[0], 17.5, -11.5, { rng, ry: 0.4 });
  prop(props, A.props.tower[0], -17.5, -12.5, { rng, ry: 0.6 });
  prop(props, A.props.tent[0], 5.5, 6.5, { rng });
  prop(props, A.props.tent[1], 7.8, 8.4, { rng, flip: true });
  prop(props, A.props.ruin[0], -20.5, 7.5, { rng, tag: 'ruin' });
  prop(props, A.props.cart[0], 3.4, 3.2, { rng });

  // 집집마다 살림살이 — 마을이 "사는 곳"처럼 보이게
  prop(props, A.props.woodpile, -11.2, -4.4, { rng, ry: 0.5 });
  prop(props, A.props.woodpile, 10.2, -5.6, { rng, ry: -0.8 });
  prop(props, A.props.garden, -8.0, -8.2, { rng, ry: 0.2 });
  prop(props, A.props.garden, 11.4, 1.6, { rng, ry: -0.4 });
  prop(props, A.props.laundry, -6.6, 3.4, { rng, ry: 0.9 });
  prop(props, A.props.laundry, 9.2, -8.4, { rng, ry: -0.3 });
  prop(props, A.props.hay, 12.8, -4.2, { rng });
  prop(props, A.props.hay, 13.6, -3.4, { rng });
  prop(props, A.props.hay, -13.2, 3.2, { rng });
  prop(props, A.props.trough, -12.8, -0.6, { rng, ry: 0.4 });
  prop(props, A.props.trough, 6.4, 4.6, { rng, ry: -1.2 });
  prop(props, A.props.flowerbox, -9.2, -4.35, { rng, ry: 0.55 });
  prop(props, A.props.flowerbox, 8.2, -5.4, { rng, ry: -0.5 });
  prop(props, A.props.flowerbox, -7.2, 6.3, { rng, ry: 1.9 });

  // ── 레퍼런스 Sheet 4 · 7 소품 배치 ────────
  // 광장 주변
  prop(props, A.props.fountain[0], -3.4, -1.9, { rng, ry: 0.2, tag: 'fountain' });
  prop(props, A.props.notice[0], 3.1, 9.4, { rng, ry: -0.7 });
  prop(props, A.props.statue[0], 3.6, 11.6, { rng, ry: -0.4 });
  for (let i = 0; i < 4; i++) {
    const a = -0.9 + i * 0.6;
    prop(props, A.props.ironfence, 3.6 + Math.cos(a) * 1.5, 11.6 + Math.sin(a) * 1.5, { rng, ry: a + Math.PI / 2 });
  }
  prop(props, A.props.bench, 2.9, 3.6, { rng, ry: -0.6 });
  prop(props, A.props.bench, -4.2, 2.4, { rng, ry: 1.2 });
  prop(props, A.props.bench, 12.2, 4.4, { rng, ry: 2.1 });
  prop(props, A.props.bollard, 4.6, 6.4, { rng, ry: 0.4 });
  prop(props, A.props.bollard, -4.4, 6.0, { rng, ry: -0.3 });

  // 상점 앞 좌판 살림
  prop(props, A.props.table[0], -2.7, -5.5, { rng, ry: 0.3 });
  prop(props, A.props.chair, -1.9, -6.1, { rng, ry: 2.6 });
  prop(props, A.props.chair, -3.4, -5.0, { rng, ry: -0.4 });
  prop(props, A.props.chest[0], -6.3, -5.4, { rng, ry: 0.6 });
  prop(props, A.props.basket, -5.5, -3.3, { rng });
  prop(props, A.props.basket, 12.9, -0.9, { rng });
  prop(props, A.props.sack, -3.9, -3.1, { rng });
  prop(props, A.props.sack, -4.6, -2.6, { rng });
  prop(props, A.props.sack, 11.0, -2.9, { rng });
  prop(props, A.props.pot, -6.1, -2.9, { rng });
  prop(props, A.props.pot, 5.1, 5.4, { rng });
  prop(props, A.props.pot, -13.4, 1.6, { rng });
  prop(props, A.props.bucket[0], 2.6, 0.7, { rng, ry: 0.5 });
  prop(props, A.props.bucket[0], -12.4, -1.2, { rng, ry: -0.8 });
  prop(props, A.props.wheelbarrow[0], -8.9, -7.3, { rng, ry: 0.9 });
  prop(props, A.props.wagon[0], 7.2, 11.2, { rng, ry: -0.5 });
  prop(props, A.props.block[0], -12.0, -3.7, { rng, ry: 0.3 });

  // 집 앞
  prop(props, A.props.mailbox[0], -8.4, -3.4, { rng, ry: 0.5 });
  prop(props, A.props.mailbox[0], 7.6, -5.0, { rng, ry: -0.6 });
  prop(props, A.props.birdhouse[0], -6.2, 4.4, { rng });
  prop(props, A.props.birdhouse[0], 10.8, 1.8, { rng });
  prop(props, A.props.planter, -9.0, -4.2, { rng, ry: 0.5 });
  prop(props, A.props.planter, 8.4, -5.6, { rng, ry: -0.4 });
  prop(props, A.props.planter, -7.0, 6.2, { rng, ry: 1.8 });

  // 담과 울타리
  for (let i = 0; i < 4; i++) prop(props, A.props.stonewall, -6.2, -0.6 + i * 1.9, { rng, ry: Math.PI / 2 });
  for (let i = 0; i < 3; i++) prop(props, A.props.ropefence, -2.6 + i * 2.2, 13.4, { rng, ry: 0 });
  for (let i = 0; i < 3; i++) prop(props, A.props.ropefence, -2.6 + i * 2.2, 6.6, { rng, ry: 0 });
  prop(props, A.props.woodgate[0], -8.8, -8.6, { rng, ry: 0 });

  // 축제 장식
  prop(props, A.props.bunting, 0, 7.6, { rng, ry: 0 });
  prop(props, A.props.bunting, 0.4, 2.6, { rng, ry: 0.35 });
  prop(props, A.props.banner, -2.9, 16.4, { rng, ry: 0.2 });
  prop(props, A.props.banner, 2.9, 16.4, { rng, ry: -0.2 });
  prop(props, A.props.banner, -16.4, -11.4, { rng, ry: 0.6 });

  // 숲 속 유적과 지형지물
  prop(props, A.props.stonearch[0], -1.8, -14.2, { rng, ry: 0.15 });
  prop(props, A.props.monolith, -24.5, -6.5, { rng });
  prop(props, A.props.monolith, 17.5, -19.5, { rng });
  prop(props, A.props.monolith, -7.5, -25.5, { rng });
  prop(props, A.props.cave[0], -27.5, -17.5, { rng, ry: 0.7 });
  for (let i = 0; i < 8; i++) {
    const a = rng() * Math.PI * 2;
    const r = rand(rng, 12, 34);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (tooClose(props, x, z, 3.2)) continue;
    prop(props, rng() < 0.5 ? A.props.rockmound : A.props.mound, x, z, { rng });
  }

  // ── 새 레퍼런스 반영: 건물 · 살림살이 · 경계 · 지형지물 ──
  // 삐뚜름한 2층집과 마을 뒤 작은 성
  prop(props, A.props.crooked, -12.2, 4.6, { rng, ry: 1.7 });
  prop(props, A.props.crooked, 6.4, -9.8, { rng, ry: -0.35 });
  prop(props, A.props.castle[0], -3.5, -27.5, { rng, ry: 0.15, tag: 'castle' });
  prop(props, A.props.archGate[0], 0.2, -18.5, { rng, ry: 0 });

  // 장터 — 좌판, 물건, 걸상
  prop(props, A.props.marketStall[0], -2.2, -6.6, { rng, ry: 0.15 });
  prop(props, A.props.standingSign[0], -1.9, -3.6, { rng, ry: -0.5 });
  prop(props, A.props.crateOpen[0], -3.6, -6.1, { rng, ry: 0.4 });
  prop(props, A.props.plankStack[0], -7.1, -6.1, { rng, ry: 0.2 });
  prop(props, A.props.barrelTap[0], -5.9, -6.5, { rng, ry: 0.8 });
  prop(props, A.props.barrelCradle[0], -7.4, -4.6, { rng, ry: -0.4 });
  prop(props, A.props.sackOpen[0], -4.3, -2.5, { rng, ry: 0.6 });
  prop(props, A.props.basketWide[0], -5.0, -3.9, { rng, ry: -0.3 });
  prop(props, A.props.tubBucket[0], 2.9, 1.4, { rng, ry: 0.3 });
  prop(props, A.props.stool[0], -2.1, -4.9, { rng, ry: 0.9 });
  prop(props, A.props.plankBench, 1.4, 6.9, { rng, ry: Math.PI });
  prop(props, A.props.plankBench, -3.0, 8.4, { rng, ry: 0.4 });
  prop(props, A.props.handCart[0], 4.9, -1.9, { rng, ry: 1.1 });
  prop(props, A.props.chestOpen[0], -6.9, -5.9, { rng, ry: -0.2 });

  // 모닥불 자리와 연장
  prop(props, A.props.cookingFire[0], -1.6, 2.9, { rng, ry: 0.3, glow: 1, glowR: 3.0 });
  prop(props, A.props.campfireStones[0], 8.6, 6.4, { rng, glow: 0.8, glowR: 2.6 });
  prop(props, A.props.campfireLogs[0], -16.4, 8.2, { rng, glow: 0.8, glowR: 2.6 });
  prop(props, A.props.toolAxe[0], -11.4, -3.2, { rng, ry: 0.5 });
  prop(props, A.props.toolShovel[0], -8.2, -7.4, { rng, ry: -0.6 });
  prop(props, A.props.toolPickaxe[0], -12.6, -0.2, { rng, ry: 0.9 });

  // 가로등 · 표지 · 게시물
  prop(props, A.props.lampPostA, -5.2, 5.2, { rng, glow: 1, glowR: 3.2, noFade: true });
  prop(props, A.props.lampPostA, 5.6, 5.0, { rng, glow: 1, glowR: 3.2, noFade: true });
  prop(props, A.props.lampPostB[0], 3.0, -3.6, { rng, glow: 1, glowR: 3.2, noFade: true });
  prop(props, A.props.globeLamp[0], -6.4, 0.6, { rng, glow: 1, glowR: 3.0, noFade: true });
  prop(props, A.props.swanNeckLamp[0], 4.2, 9.6, { rng, glow: 1, glowR: 3.0, noFade: true });
  prop(props, A.props.hangingSign[0], -3.9, -3.4, { rng, ry: 0.3 });
  prop(props, A.props.signArrowPost[0], -2.6, 10.9, { rng, ry: -0.4 });
  prop(props, A.props.signBoard[0], 8.2, 3.4, { rng, ry: 1.2 });
  prop(props, A.props.mailPost[0], 9.4, -6.4, { rng, ry: -0.4 });

  // 화단 · 난간
  prop(props, A.props.planterTrough[0], 2.4, -5.4, { rng, ry: 0.2 });
  prop(props, A.props.planterStone[0], -8.6, 2.2, { rng, ry: -0.5 });
  prop(props, A.props.fountainLow[0], 10.4, 5.8, { rng });
  for (let i = 0; i < 3; i++) prop(props, A.props.bollardRope, -3.2 - i * 1.7, 4.9, { rng, ry: 0.1 });
  for (let i = 0; i < 3; i++) prop(props, A.props.chainFence[0], 6.6, -1.2 + i * 1.9, { rng, ry: Math.PI / 2 });
  for (let i = 0; i < 4; i++) prop(props, A.props.picketFence, -10.6 + i * 1.9, 7.4, { rng, ry: 0 });
  for (let i = 0; i < 3; i++) prop(props, A.props.stoneWallCoursed, 9.4, -3.2 + i * 2.0, { rng, ry: Math.PI / 2 });
  prop(props, A.props.stoneWallCorner[0], 9.4, -5.0, { rng, ry: 0 });
  prop(props, A.props.railFenceBroken[0], -14.6, -6.4, { rng, ry: 0.2 });
  prop(props, A.props.pennantPair[0], 2.6, 14.9, { rng, ry: 0 });

  // 연못가 — 돌 테두리와 징검다리
  for (let i = 0; i < 7; i++) {
    const a = 0.6 + (i / 7) * Math.PI * 1.3;
    prop(props, A.props.pondRimRocks, POND.x + Math.cos(a) * (POND.r + 0.4), POND.z + Math.sin(a) * (POND.r + 0.4), {
      rng,
      ry: -a,
    });
  }
  for (let i = 0; i < 5; i++) {
    prop(props, A.props.steppingStone, POND.x - 3.4 + i * 1.5, POND.z + 4.6 - i * 0.5, { rng, shadow: 0.4 });
  }

  // 지형지물 — 바위 무리, 선돌, 흙언덕, 절개면
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2;
    const r = rand(rng, 13, 36);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (tooClose(props, x, z, 3.4)) continue;
    const table = [
      A.props.boulder,
      A.props.boulderCluster,
      A.props.rubblePile,
      A.props.grassMound,
      A.props.mound,
      A.props.rockmound,
      A.props.cliffChunk,
    ];
    prop(props, pick(rng, table), x, z, { rng });
  }
  prop(props, A.props.standingStones, -24.5, -6.5, { rng });
  prop(props, A.props.standingStones, 17.5, -19.5, { rng });
  prop(props, A.props.monolith, -7.5, -25.5, { rng });

  // 건물 밑동 잡초 — 벽과 땅이 만나는 선을 흐린다
  for (const b of props.slice(0, 22)) {
    if (!b.r || b.r < 0.6) continue;
    dress(props, A, rng, b.x, b.z, b.r * 1.25, { count: randInt(rng, 4, 8), grass: 0.75 });
  }
  prop(props, A.props.bridge[0], POND.x - 0.2, POND.z - 5.6, { rng, r: 0, ry: 0 });

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
    prop(props, A.props.lamp, x, z, { rng, glow: 1, glowR: 3.2, noFade: true, ry: Math.PI * 0.5 });

  prop(props, A.props.sign[0], 1.8, 11.5, { rng, ry: -0.3 });

  // 울타리 줄
  for (let i = 0; i < 5; i++) prop(props, A.props.fence, -12.5 + i * 1.9, -8.6, { rng, ry: 0 });
  for (let i = 0; i < 4; i++) prop(props, A.props.fence, 12.0, -4.0 + i * 1.9, { rng, ry: Math.PI / 2 });

  // ── 숲 ──────────────────────────────────
  const treeKinds = [
    A.trees.pine,
    A.trees.fir,
    A.trees.cypress,
    A.trees.blob,
    A.trees.cloud,
    A.trees.columnar,
    A.trees.leafy,
    A.trees.leaning,
    A.trees.willow,
    A.trees.bare,
    A.trees.dead,
    A.trees.autumn,
  ];
  const conifers = [A.trees.pine, A.trees.fir, A.trees.cypress];
  // 바깥 숲 링 (월드 경계 느낌)
  for (let i = 0; i < 190; i++) {
    const a = rng() * Math.PI * 2;
    const r = rand(rng, 25, WORLD_RADIUS);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const kind = rng() < 0.45 ? pick(rng, conifers) : pick(rng, treeKinds);
    prop(props, kind, x, z, { rng, scale: rand(rng, 0.82, 1.22) });
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
    const t = prop(props, pick(rng, treeKinds), x, z, { rng, scale: rand(rng, 0.85, 1.25) });
    dress(props, A, rng, x, z, t.r * 1.5 + 0.6, { count: randInt(rng, 3, 7) });
  }

  // 덤불 / 그루터기 / 통나무 / 바위
  for (let i = 0; i < 60; i++) {
    const a = rng() * Math.PI * 2;
    const r = rand(rng, 6, 34);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (tooClose(props, x, z, 2.0)) continue;
    const table = [
      A.props.bush,
      A.props.bush,
      A.props.shrub,
      A.props.rock,
      A.props.stump,
      A.props.splitStump,
      A.props.log,
      A.props.branch,
      A.props.berryBush,
      A.props.boulder,
      A.props.fern,
    ];
    const o = prop(props, pick(rng, table), x, z, { rng, scale: rand(rng, 0.85, 1.2) });
    if (rng() < 0.8) dress(props, A, rng, x, z, o.r * 1.4 + 0.5, { count: randInt(rng, 2, 4) });
  }

  // 잔풀 / 꽃 / 버섯 — 균일하게 뿌리면 인공적이라 "군락"으로 모아 심는다
  const scatterSpots = [];
  const CLUSTERS = 260;
  for (let c = 0; c < CLUSTERS; c++) {
    const a = rng() * Math.PI * 2;
    const r = rand(rng, 2.5, 40);
    const cxp = Math.cos(a) * r;
    const czp = Math.sin(a) * r;
    const n = randInt(rng, 3, 9);
    const spread = rand(rng, 0.7, 2.6);
    for (let k = 0; k < n; k++) {
      const aa = rng() * Math.PI * 2;
      const rr = spread * Math.sqrt(rng());
      scatterSpots.push([cxp + Math.cos(aa) * rr, czp + Math.sin(aa) * rr]);
    }
  }
  for (let i = 0; i < scatterSpots.length; i++) {
    const x = scatterSpots[i][0];
    const z = scatterSpots[i][1];
    const inPond = Math.hypot(x - POND.x, z - POND.z) < POND.r - 0.4;
    if (inPond) continue;
    // 광장과 대문 길목은 비워 둔다
    if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < 5.0) continue;
    if (Math.abs(x) < 1.5 && z > -1 && z < 19) continue;
    const roll = rng();
    let sp;
    if (roll < 0.5) sp = A.props.grass;
    else if (roll < 0.62) sp = A.props.flower;
    else if (roll < 0.7) sp = A.props.clover;
    else if (roll < 0.78) sp = A.props.fern;
    else if (roll < 0.84) sp = A.props.dandelion;
    else if (roll < 0.9) sp = A.props.mushroom;
    else if (roll < 0.96) sp = A.props.sapling;
    else sp = A.props.seedling;
    prop(props, sp, x, z, { rng, r: 0, shadow: 0.45, scale: rand(rng, 0.75, 1.35) });
  }
  // 연못가 부들
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2;
    const r = POND.r + rand(rng, -0.3, 0.9);
    prop(props, A.props.cattail, POND.x + Math.cos(a) * r, POND.z + Math.sin(a) * r * 0.95, { rng, r: 0 });
  }

  // 낙엽·자갈 부스러기 — 땅에 생활감을 준다
  const litterColors = ['rgba(190,160,110,0.5)', 'rgba(160,150,105,0.45)', 'rgba(205,180,130,0.45)', 'rgba(150,170,120,0.4)'];
  const bigProps = props.filter((e) => e.r > 0.5 && e.h > 1.6);
  for (const b of bigProps) {
    if (rng() < 0.45) continue;
    const n = randInt(rng, 3, 8);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const rr = b.r * rand(rng, 0.7, 2.1);
      const lx = b.x + Math.cos(a) * rr;
      const lz = b.z + Math.sin(a) * rr;
      decals.push(
        circleDecal(lx, lz, rand(rng, 0.1, 0.26), litterColors[randInt(rng, 0, 3)], null, 0.4, rng, 5)
      );
    }
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
      y: heightAt(x, z),
      gy: heightAt(x, z),
      model: A.props.acorn[0],
      ry: i * 0.7,
      scale: 1,
      h: 0.42,
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
      y: heightAt(s.x, s.z),
      gy: heightAt(s.x, s.z),
      model: A.props.lantern[0],
      litModel: A.props.lanternLit[0],
      ry: i * 0.9,
      scale: 1,
      h: 0.68,
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
    const setInk = A.beansInk[id];
    npcs.push({
      id: nextId(),
      npcId: id,
      kind: 'npc',
      x,
      z,
      y: heightAt(x, z),
      gy: heightAt(x, z),
      home: { x, z },
      set,
      setInk,
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
    const cInk = A.crittersInk[kind];
    critters.push({
      id: nextId(),
      kind: 'critter',
      type: kind,
      x,
      z,
      y: heightAt(x, z),
      gy: heightAt(x, z),
      home: { x, z },
      set: c,
      setInk: cInk,
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

  // 서로 파고든 소품 정리 — 나중에 놓인 쪽을 뺀다(건물·태그가 붙은 것은 남긴다)
  {
    const keep = [];
    const solid = [];
    for (const e of props) {
      if (!e.r || e.r < 0.22 || e.tag || e.h > 2.6) {
        keep.push(e);
        if (e.r > 0.22) solid.push(e);
        continue;
      }
      let clash = false;
      for (const o of solid) {
        const d = Math.hypot(o.x - e.x, o.z - e.z);
        if (d < (o.r + e.r) * 0.78) {
          clash = true;
          break;
        }
      }
      if (!clash) {
        keep.push(e);
        solid.push(e);
      }
    }
    props.length = 0;
    for (const e of keep) props.push(e);
  }

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
