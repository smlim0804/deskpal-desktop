// 시작할 때 한 번만 준비하는 에셋.
//  · 캐릭터(플레이어·주민·숲친구)는 손그림 2D 스프라이트 — 종이 인형처럼 보이게 의도한 것
//  · 그 외 건물·나무·소품은 전부 저폴리 3D 메시 (+ 원거리용 임포스터)
import { bakeBean } from '../art/bean.js';
import { bakeCritter } from '../art/critters.js';
import * as N3 from '../art3d/nature.js';
import * as V3 from '../art3d/village.js';
import * as PR from '../art3d/props.js';
import { bakeImpostorSet, bakeImpostor } from '../render/mesh3d.js';
import { P } from '../art/palette.js';
import { Theme, setMode } from '../core/theme.js';

function pool(fn, count, startSeed, opt) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(fn(startSeed + i * 37, opt));
  return out;
}

const IMPOSTOR_KEYS = [
  'cottage', 'hut', 'shop', 'windmill', 'tower', 'tent', 'gate', 'well', 'fence', 'lamp', 'sign',
  'barrel', 'crate', 'campfire', 'bridge', 'ruin', 'cart', 'woodpile', 'garden', 'laundry', 'hay', 'trough',
  'sack', 'bucket', 'table', 'chair', 'bench', 'chest', 'basket', 'pot', 'wheelbarrow', 'wagon',
  'mailbox', 'birdhouse', 'block', 'fountain', 'statue', 'notice', 'stonewall', 'ropefence', 'ironfence',
  'woodgate', 'stonearch', 'bunting', 'banner', 'bollard', 'planter', 'monolith', 'rockmound', 'mound', 'cave',
];

// 멀리서 볼 때 쓸 스프라이트를 미리 굽는다 (폴리곤 수 절약)
function imp(models, ppu = 38) {
  for (const m of models) m.imp = bakeImpostorSet(m, { ppu });
  return models;
}

export const PLAYER_DEF = {
  shape: 'bean',
  color: '#f8eeda',
  width: 30,
  blush: true,
  hat: 'headband',
  footColor: '#f8eeda',
  seed: 101,
  ss: 2,
};

export const VILLAGERS = [
  { id: 'elder', name: '촌장 콩', shape: 'round', color: '#f2e2c4', width: 32, hat: 'straw', item: 'staff', seed: 211 },
  { id: 'smith', name: '대장장이 팥', shape: 'square', color: '#e7d0ea', width: 31, hat: 'headband', sash: true, sashColor: '#c76a52', belt: true, seed: 233 },
  { id: 'trader', name: '장돌뱅이 녹두', shape: 'bean', color: '#d9e7f3', width: 29, hat: 'cap', item: 'lantern', seed: 257 },
  { id: 'witch', name: '숲의 마녀', shape: 'tall', color: '#cfc6e8', width: 27, hat: 'witch', item: 'staff', seed: 271 },
  { id: 'kid', name: '꼬마 완두', shape: 'round', color: '#e5f0d4', width: 24, blush: true, heightUnits: 1.05, seed: 293 },
  { id: 'guard', name: '문지기 강낭', shape: 'bean', color: '#efe3c2', width: 32, hat: 'beanie', item: 'spear', belt: true, seed: 311 },
  { id: 'farmer', name: '농부 메주', shape: 'cone', color: '#f8dcd6', width: 33, hat: 'leaf', seed: 331 },
  { id: 'sleepy', name: '잠보 도토리', shape: 'bean', color: '#efdcc0', width: 30, stripes: true, seed: 353 },
];

export async function bakeAll(onProgress = () => {}) {
  const A = { trees: {}, props: {}, critters: {}, beans: {}, crittersInk: {}, beansInk: {}, icons: {} };
  const steps = [];
  const push = (label, fn) => steps.push([label, fn]);

  const CRITTERS = ['chick', 'cloudSheep', 'ghost', 'robot', 'snail', 'bug', 'spiky', 'mushroomFolk', 'worm'];

  push('종이 캐릭터', () => {
    const saved = Theme.mode;
    setMode('color');
    A.player = bakeBean({ ...PLAYER_DEF, heightUnits: 1.5 }, 'full');
    for (const v of VILLAGERS) {
      A.beans[v.id] = bakeBean({ ...v, heightUnits: v.heightUnits || 1.42 }, v.id === 'sleepy' ? 'still' : 'lite');
    }
    for (const k of CRITTERS) A.critters[k] = bakeCritter(k, 30001 + k.length * 13);
    setMode(saved);
  });

  push('선화 캐릭터', () => {
    // 색칠 안 한 스타일용 한 벌 더 (선은 같고 채색만 종이톤)
    const saved = Theme.mode;
    setMode('ink');
    A.playerInk = bakeBean({ ...PLAYER_DEF, heightUnits: 1.5 }, 'full');
    for (const v of VILLAGERS) {
      A.beansInk[v.id] = bakeBean({ ...v, heightUnits: v.heightUnits || 1.42 }, v.id === 'sleepy' ? 'still' : 'lite');
    }
    for (const k of CRITTERS) A.crittersInk[k] = bakeCritter(k, 30001 + k.length * 13);
    setMode(saved);
  });

  push('숲 세우기', () => {
    A.trees.pine = pool(N3.pineTree, 3, 1001);
    A.trees.blob = pool(N3.blobTree, 3, 2001);
    A.trees.willow = pool(N3.willowTree, 2, 3001);
    A.trees.bare = pool(N3.bareTree, 2, 4001);
    A.trees.autumn = pool(N3.blobTree, 2, 5001, { color: P.leafGold });
  });

  push('덤불과 바위', () => {
    A.props.bush = pool(N3.bush, 3, 6001);
    A.props.berryBush = pool(N3.bush, 1, 6501, { berries: true });
    A.props.grass = pool(N3.grassTuft, 5, 7001);
    A.props.flower = pool(N3.flower, 4, 8001);
    A.props.mushroom = pool(N3.mushroom, 3, 9001);
    A.props.cattail = pool(N3.cattail, 2, 9501);
    A.props.sapling = pool(N3.sapling, 2, 9701);
    A.props.rock = pool(N3.rock, 3, 10001);
    A.props.stump = pool(N3.stump, 2, 11001);
    A.props.log = pool(N3.log, 2, 12001);
  });

  push('마을 짓기', () => {
    A.props.cottage = [V3.cottage(13001), V3.cottage(13101, { roof: P.roofBlue }), V3.cottage(13201, { roof: P.roofGreen })];
    A.props.hut = pool(V3.tinyHut, 2, 14001);
    A.props.shop = [V3.shopStall(15001)];
    A.props.windmill = [V3.windmill(16001)];
    A.props.tower = [V3.tower(17001)];
    A.props.tent = pool(V3.tent, 2, 18001);
    A.props.gate = [V3.gateArch(19001)];
    A.props.well = [V3.well(20001)];
    A.props.fence = pool(V3.fencePiece, 2, 21001);
    A.props.lamp = pool(V3.lampPost, 2, 22001);
    A.props.sign = [V3.signPost(23001)];
    A.props.barrel = pool(V3.barrel, 2, 24001);
    A.props.crate = pool(V3.crate, 2, 25001);
    A.props.campfire = [V3.campfire(26001)];
    A.props.bridge = [V3.bridge(27001)];
    A.props.ruin = [V3.ruinArch(28001)];
    A.props.cart = [V3.cart(29001)];
    A.props.woodpile = pool(V3.woodPile, 2, 29101);
    A.props.garden = pool(V3.gardenPlot, 2, 29201);
    A.props.laundry = pool(V3.laundryLine, 2, 29301);
    A.props.hay = pool(V3.hayBale, 3, 29401);
    A.props.trough = [V3.trough(29501)];
    A.props.flowerbox = pool(V3.flowerBox, 2, 29601);
    // Sheet 4 · Sheet 7 소품
    A.props.sack = pool(PR.sack, 2, 40001);
    A.props.bucket = [PR.bucket(40101)];
    A.props.table = [PR.table(40201)];
    A.props.chair = pool(PR.chair, 2, 40301);
    A.props.bench = pool(PR.logBench, 2, 40401);
    A.props.chest = [PR.chest(40501)];
    A.props.basket = pool(PR.basket, 2, 40601);
    A.props.pot = pool(PR.potVase, 3, 40701);
    A.props.wheelbarrow = [PR.wheelbarrow(40801)];
    A.props.wagon = [PR.coveredWagon(40901)];
    A.props.mailbox = [PR.mailbox(41001)];
    A.props.birdhouse = [PR.birdhouse(41101)];
    A.props.block = [PR.choppingBlock(41201)];
    A.props.fountain = [PR.fountain(41301)];
    A.props.statue = [PR.statue(41401)];
    A.props.notice = [PR.noticeBoard(41501)];
    A.props.stonewall = pool(PR.stoneWall, 3, 41601);
    A.props.ropefence = pool(PR.ropeFence, 2, 41701);
    A.props.ironfence = pool(PR.ironFence, 2, 41801);
    A.props.woodgate = [PR.woodGate(41901)];
    A.props.stonearch = [PR.stoneArch(42001)];
    A.props.bunting = pool(PR.bunting, 2, 42101);
    A.props.banner = pool(PR.banner, 3, 42201);
    A.props.bollard = pool(PR.bollardChain, 2, 42301);
    A.props.planter = pool(PR.planterBarrel, 2, 42401);
    A.props.monolith = pool(PR.monolith, 3, 42501);
    A.props.rockmound = pool(PR.rockMound, 3, 42601);
    A.props.mound = pool(PR.dirtMound, 3, 42701);
    A.props.cave = [PR.caveEntrance(42801)];

    A.props.acorn = [N3.acornModel()];
    A.props.lantern = [N3.lanternModel(false)];
    A.props.lanternLit = [N3.lanternModel(true)];
  });

  push('원경 굽기', () => {
    // 멀리서도 보이는 큰 것들만 임포스터를 만든다 (컬러 기준으로 굽고, 선화용은 필요할 때 굽는다)
    const saved = Theme.mode;
    setMode('color');
    imp(A.trees.pine, 30);
    imp(A.trees.blob, 30);
    imp(A.trees.willow, 30);
    imp(A.trees.bare, 30);
    imp(A.trees.autumn, 30);
    imp(A.props.bush, 34);
    imp(A.props.berryBush, 34);
    imp(A.props.rock, 34);
    imp(A.props.stump, 34);
    imp(A.props.log, 34);
    for (const k of IMPOSTOR_KEYS) {
      if (A.props[k]) imp(A.props[k], 30);
    }
    setMode(saved);
  });

  push('UI 아이콘', () => {
    const saved = Theme.mode;
    setMode('color');
    A.icons.acorn = bakeImpostor(A.props.acorn[0], { yaw: 0.35, ppu: 90 });
    A.icons.lantern = bakeImpostor(A.props.lantern[0], { yaw: 0.35, ppu: 70 });
    A.icons.lanternLit = bakeImpostor(A.props.lanternLit[0], { yaw: 0.35, ppu: 70 });
    setMode('ink');
    A.icons.acornInk = bakeImpostor(A.props.acorn[0], { yaw: 0.35, ppu: 90 });
    A.icons.lanternInk = bakeImpostor(A.props.lantern[0], { yaw: 0.35, ppu: 70 });
    A.icons.lanternLitInk = bakeImpostor(A.props.lanternLit[0], { yaw: 0.35, ppu: 70 });
    setMode(saved);
  });

  for (let i = 0; i < steps.length; i++) {
    const [label, fn] = steps[i];
    onProgress(label, i / steps.length);
    fn();
    await new Promise((r) => setTimeout(r, 0));
  }
  onProgress('완성', 1);
  return A;
}

/** 스타일을 선화로 바꿀 때 원경 스프라이트를 미리 구워 둔다(전환 중 끊김 방지) */
export function prebakeInkImpostors(A) {
  const saved = Theme.mode;
  setMode('ink');
  const groups = [
    ...Object.values(A.trees),
    ...IMPOSTOR_KEYS.map((k) => A.props[k]),
    A.props.bush,
    A.props.berryBush,
    A.props.rock,
    A.props.stump,
    A.props.log,
  ];
  for (const g of groups) {
    if (!g) continue;
    for (const m of g) {
      if (m && m.imp && !m.impInk) m.impInk = bakeImpostorSet(m, { ppu: 30 });
    }
  }
  setMode(saved);
}
