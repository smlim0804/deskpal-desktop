// 시작할 때 한 번만 준비하는 에셋.
//  · 캐릭터(플레이어·주민·숲친구)는 손그림 2D 스프라이트 — 종이 인형처럼 보이게 의도한 것
//  · 그 외 건물·나무·소품은 전부 저폴리 3D 메시 (+ 원거리용 임포스터)
//  모델은 레퍼런스 시트(건물/나무/풀꽃/소품/장식·경계/지형)를 그림 단위로 옮긴 것이다.
import { bakeBean } from '../art/bean.js';
import { bakeCritter } from '../art/critters.js';
import * as N3 from '../art3d/nature.js';
import * as V3 from '../art3d/village.js';
import * as PR from '../art3d/props.js';
import * as DE from '../art3d/decor.js';
import { bakeImpostorSet, bakeImpostor } from '../render/mesh3d.js';
import { P } from '../art/palette.js';
import { Theme, setMode } from '../core/theme.js';

function pool(fn, count, startSeed, opt) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(fn(startSeed + i * 37, opt));
  return out;
}

// 원거리에서 스프라이트로 대체할 것들 (작은 잡초류는 어차피 가까이서만 보이므로 제외)
const IMPOSTOR_KEYS = [
  // 건물
  'cottage', 'crooked', 'hut', 'shop', 'windmill', 'tower', 'tent', 'gate', 'castle', 'well',
  'bridge', 'ruin', 'cart', 'woodpile', 'garden', 'laundry', 'hay', 'trough', 'flowerbox',
  'fence', 'railfence', 'lamp', 'sign', 'campfire',
  // Sheet 4 소품
  'crate', 'crateOpen', 'plankStack', 'barrel', 'barrelTap', 'barrelCradle', 'sack', 'sackOpen',
  'bucket', 'tubBucket', 'signPlank', 'signArrows', 'hangingLantern', 'oilLamp', 'mailbox',
  'birdhouse', 'table', 'chair', 'stool', 'bench', 'plankBench', 'campfireStones', 'campfireLogs',
  'cookingFire', 'toolShovel', 'toolAxe', 'toolPickaxe', 'chest', 'chestOpen', 'basket',
  'basketWide', 'pot', 'wheelbarrow', 'handCart', 'wagon', 'marketStall', 'standingSign', 'block',
  // Sheet 7 장식·경계 + 지형
  'picketFence', 'railFenceBroken', 'ironfence', 'ropefence', 'chainFence', 'stonewall',
  'stoneWallCoursed', 'stoneWallCorner', 'rubblePile', 'woodgate', 'archGate', 'stonearch',
  'lampPostA', 'lampPostB', 'globeLamp', 'swanNeckLamp', 'fountain', 'fountainLow', 'statue',
  'notice', 'signBoard', 'signArrowPost', 'hangingSign', 'mailPost', 'planterTrough',
  'planterStone', 'planter', 'bollardRope', 'bollard', 'bunting', 'banner', 'pennantPair',
  'boulder', 'boulderCluster', 'standingStones', 'monolith', 'rockmound', 'grassMound', 'mound',
  'cave', 'cliffChunk', 'steppingStone', 'pondRimRocks',
  'openWell', 'hurricaneLantern', 'plankBenchBacked', 'tavernSign', 'fieldGate', 'plankDoor',
  'plankDoorway',
];

function imp(models, ppu = 30) {
  if (!models) return models;
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
    const saved = Theme.mode;
    setMode('ink');
    A.playerInk = bakeBean({ ...PLAYER_DEF, heightUnits: 1.5 }, 'full');
    for (const v of VILLAGERS) {
      A.beansInk[v.id] = bakeBean({ ...v, heightUnits: v.heightUnits || 1.42 }, v.id === 'sleepy' ? 'still' : 'lite');
    }
    for (const k of CRITTERS) A.crittersInk[k] = bakeCritter(k, 30001 + k.length * 13);
    setMode(saved);
  });

  // ── 나무 시트 ────────────────────────────
  push('숲 세우기', () => {
    A.trees.pine = pool(N3.pineTree, 3, 1001);
    A.trees.fir = pool(N3.firTree, 2, 1201);
    A.trees.cypress = pool(N3.cypress, 2, 1301);
    A.trees.blob = pool(N3.blobTree, 3, 2001);
    A.trees.cloud = pool(N3.cloudTree, 2, 2201);
    A.trees.columnar = pool(N3.columnarTree, 2, 2301);
    A.trees.leafy = pool(N3.leafyTree, 2, 2401);
    A.trees.leaning = pool(N3.leaningTree, 2, 2501);
    A.trees.willow = pool(N3.willowTree, 2, 3001);
    A.trees.bare = pool(N3.bareTree, 2, 4001);
    A.trees.dead = pool(N3.deadTrunk, 2, 4201);
    A.trees.autumn = pool(N3.leafyTree, 2, 5001, { color: P.leafGold });
  });

  // ── 풀꽃 시트 ────────────────────────────
  push('덤불과 바위', () => {
    A.props.bush = pool(N3.bush, 3, 6001);
    A.props.berryBush = pool(N3.bush, 1, 6501, { berries: true });
    A.props.shrub = pool(N3.shrubMound, 2, 6601);
    A.props.grass = pool(N3.grassTuft, 5, 7001);
    A.props.flower = pool(N3.flower, 4, 8001);
    A.props.dandelion = pool(N3.dandelion, 2, 8301);
    A.props.clover = pool(N3.cloverPatch, 2, 8401);
    A.props.fern = pool(N3.fernPlant, 2, 8501);
    A.props.vine = pool(N3.vinePlant, 2, 8601);
    A.props.mushroom = pool(N3.mushroom, 3, 9001);
    A.props.cattail = pool(N3.cattail, 2, 9501);
    A.props.sapling = pool(N3.sapling, 2, 9701);
    A.props.seedling = pool(N3.seedling, 2, 9801);
    A.props.rock = pool(N3.rock, 3, 10001);
    A.props.stump = pool(N3.stump, 2, 11001);
    A.props.splitStump = pool(N3.splitStump, 2, 11201);
    A.props.log = pool(N3.log, 2, 12001);
    A.props.branch = pool(N3.branchProp, 2, 12201);
    A.props.leaf = pool(N3.fallenLeaf, 3, 12301);
  });

  // ── 건물 시트 ────────────────────────────
  push('마을 짓기', () => {
    A.props.cottage = [V3.cottage(13001), V3.cottage(13101, { roof: P.roofBlue }), V3.cottage(13201, { roof: P.roofGreen })];
    A.props.crooked = pool(V3.crookedHouse, 2, 13401);
    A.props.hut = pool(V3.tinyHut, 2, 14001);
    A.props.shop = [V3.shopStall(15001)];
    A.props.windmill = [V3.windmill(16001)];
    A.props.tower = [V3.tower(17001)];
    A.props.tent = pool(V3.tent, 2, 18001);
    A.props.gate = [V3.gateArch(19001)];
    A.props.castle = [V3.castle(19501)];
    A.props.well = [V3.well(20001)];
    A.props.fence = pool(V3.fencePiece, 2, 21001);
    A.props.railfence = pool(V3.railFence, 2, 21201);
    A.props.lamp = pool(V3.lampPost, 2, 22001);
    A.props.sign = [V3.signPost(23001)];
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
  });

  // ── 소품 시트 (Sheet 4) ──────────────────
  push('살림살이', () => {
    A.props.crate = pool(PR.crate, 2, 40001);
    A.props.crateOpen = [PR.crateOpen(40051)];
    A.props.plankStack = [PR.plankStack(40071)];
    A.props.barrel = pool(PR.barrel, 2, 40101);
    A.props.barrelTap = [PR.barrelTap(40151)];
    A.props.barrelCradle = [PR.barrelCradle(40171)];
    A.props.sack = pool(PR.sack, 2, 40201);
    A.props.sackOpen = [PR.sackOpen(40251)];
    A.props.bucket = [PR.bucket(40301)];
    A.props.tubBucket = [PR.tubBucket(40321)];
    A.props.signPlank = [PR.signPlank(40401)];
    A.props.signArrows = [PR.signArrows(40421)];
    A.props.hangingLantern = [PR.hangingLantern(40501)];
    A.props.oilLamp = [PR.oilLamp(40521)];
    A.props.hurricaneLantern = [PR.hurricaneLantern(40541)];
    A.props.mailbox = [PR.mailbox(40601)];
    A.props.birdhouse = [PR.birdhouse(40621)];
    A.props.table = [PR.table(40701)];
    A.props.chair = pool(PR.chair, 2, 40721);
    A.props.stool = [PR.stool(40741)];
    A.props.bench = pool(PR.logBench, 2, 40801);
    A.props.plankBench = pool(PR.plankBench, 2, 40851);
    A.props.plankBenchBacked = [PR.plankBenchBacked(40871)];
    A.props.campfireStones = [PR.campfireStones(40901)];
    A.props.campfireLogs = [PR.campfireLogs(40921)];
    A.props.cookingFire = [PR.cookingFire(40941)];
    A.props.toolShovel = [PR.toolShovel(41001)];
    A.props.toolAxe = [PR.toolAxe(41021)];
    A.props.toolPickaxe = [PR.toolPickaxe(41041)];
    A.props.chest = [PR.chest(41101)];
    A.props.chestOpen = [PR.chestOpen(41121)];
    A.props.basket = pool(PR.basket, 2, 41201);
    A.props.basketWide = [PR.basketWide(41251)];
    A.props.pot = [PR.potVase(41301), PR.potLidded(41311), PR.potAmphora(41321), PR.potUrn(41331)];
    A.props.wheelbarrow = [PR.wheelbarrow(41401)];
    A.props.handCart = [PR.handCart(41421)];
    A.props.wagon = [PR.coveredWagon(41441)];
    A.props.marketStall = [PR.marketStall(41501)];
    A.props.openWell = [PR.openWell(41481)];
    A.props.standingSign = [PR.standingSign(41521)];
    A.props.tavernSign = [PR.tavernSign(41541)];
    A.props.block = [PR.choppingBlock(41601)];
  });

  // ── 장식·경계 시트 (Sheet 7) + 지형 시트 ──
  push('마을 단장', () => {
    A.props.picketFence = pool(DE.picketFence, 2, 50001);
    A.props.railFenceBroken = [DE.railFenceBroken(50051)];
    A.props.ironfence = pool(DE.ironFence, 2, 50101);
    A.props.ropefence = pool(DE.ropeFence, 2, 50151);
    A.props.chainFence = [DE.chainFence(50171)];
    A.props.stonewall = pool(DE.stoneWallLow, 2, 50201);
    A.props.stoneWallCoursed = pool(DE.stoneWallCoursed, 2, 50251);
    A.props.stoneWallCorner = [DE.stoneWallCorner(50281)];
    A.props.rubblePile = pool(DE.rubblePile, 2, 50301);
    A.props.woodgate = [DE.woodGate(50401)];
    A.props.fieldGate = [DE.fieldGate(50411)];
    A.props.plankDoor = [DE.plankDoor(50415)];
    A.props.plankDoorway = [DE.plankDoorway(50417)];
    A.props.archGate = [DE.archGate(50421)];
    A.props.stonearch = [DE.stoneArch(50441)];
    A.props.lampPostA = pool(DE.lampPostA, 2, 50501);
    A.props.lampPostB = [DE.lampPostB(50531)];
    A.props.globeLamp = [DE.globeLamp(50551)];
    A.props.swanNeckLamp = [DE.swanNeckLamp(50571)];
    A.props.fountain = [DE.fountainTier(50601)];
    A.props.fountainLow = [DE.fountainLow(50621)];
    A.props.statue = [DE.statue(50701)];
    A.props.notice = [DE.noticeBoard(50721)];
    A.props.signBoard = [DE.signBoard(50741)];
    A.props.signArrowPost = [DE.signArrowPost(50761)];
    A.props.hangingSign = [DE.hangingSign(50781)];
    A.props.mailPost = [DE.mailPost(50801)];
    A.props.planterTrough = [DE.planterTrough(50901)];
    A.props.planterStone = [DE.planterStone(50921)];
    A.props.planter = pool(DE.planterBarrel, 2, 50941);
    A.props.bollardRope = pool(DE.bollardRope, 2, 51001);
    A.props.bollard = pool(DE.bollardChain, 2, 51051);
    A.props.bunting = pool(DE.bunting, 2, 51101);
    A.props.banner = pool(DE.banner, 3, 51151);
    A.props.pennantPair = [DE.pennantPair(51201)];
    A.props.boulder = pool(DE.boulder, 3, 51301);
    A.props.boulderCluster = pool(DE.boulderCluster, 2, 51351);
    A.props.standingStones = pool(DE.standingStones, 2, 51401);
    A.props.monolith = pool(DE.monolith, 2, 51451);
    A.props.rockmound = pool(DE.rockMound, 2, 51501);
    A.props.grassMound = pool(DE.grassMound, 2, 51551);
    A.props.mound = pool(DE.dirtMound, 2, 51601);
    A.props.cave = [DE.caveEntrance(51701)];
    A.props.cliffChunk = pool(DE.cliffChunk, 2, 51751);
    A.props.steppingStone = pool(DE.steppingStone, 3, 51801);
    A.props.pondRimRocks = pool(DE.pondRimRocks, 2, 51851);

    A.props.acorn = [N3.acornModel()];
    A.props.lantern = [N3.lanternModel(false)];
    A.props.lanternLit = [N3.lanternModel(true)];
  });

  push('원경 굽기', () => {
    // 컬러 기준으로 굽고, 선화용은 스타일을 바꿀 때 한 번에 굽는다
    const saved = Theme.mode;
    setMode('color');
    for (const g of Object.values(A.trees)) imp(g, 30);
    imp(A.props.bush, 34);
    imp(A.props.berryBush, 34);
    imp(A.props.shrub, 34);
    imp(A.props.rock, 34);
    imp(A.props.stump, 34);
    imp(A.props.splitStump, 34);
    imp(A.props.log, 34);
    for (const k of IMPOSTOR_KEYS) if (A.props[k]) imp(A.props[k], 30);
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
  const groups = [...Object.values(A.trees), ...Object.values(A.props)];
  for (const g of groups) {
    if (!Array.isArray(g)) continue;
    for (const m of g) {
      if (m && m.imp && !m.impInk) m.impInk = bakeImpostorSet(m, { ppu: 30 });
    }
  }
  setMode(saved);
}
