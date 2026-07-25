// 게임 시작 시 모든 손그림을 한 번 구워 두는 곳.
// 매 프레임 다시 그리지 않으므로 선이 떨리지 않고, 성능도 안정적이다.
import { bakeBean } from '../art/bean.js';
import { bakeCritter } from '../art/critters.js';
import * as N from '../art/nature.js';
import * as V from '../art/village.js';
import { P } from '../art/palette.js';

function pool(fn, count, startSeed, opt) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(fn(startSeed + i * 37, opt));
  return out;
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

// 마을 주민 정의 — 이름/대사는 quest 쪽에서 붙인다
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
  const A = { trees: {}, props: {}, critters: {}, beans: {} };
  const steps = [];
  const push = (label, fn) => steps.push([label, fn]);

  push('플레이어', () => {
    A.player = bakeBean({ ...PLAYER_DEF, heightUnits: 1.5 }, 'full');
  });
  push('주민들', () => {
    for (const v of VILLAGERS) {
      A.beans[v.id] = bakeBean({ ...v, heightUnits: v.heightUnits || 1.42 }, v.id === 'sleepy' ? 'still' : 'lite');
    }
  });
  push('숲', () => {
    A.trees.pine = pool(N.pineTree, 3, 1001);
    A.trees.blob = pool(N.blobTree, 3, 2001);
    A.trees.willow = pool(N.willowTree, 2, 3001);
    A.trees.bare = pool(N.bareTree, 2, 4001);
    A.trees.autumn = pool(N.blobTree, 2, 5001, { color: P.leafGold });
  });
  push('덤불과 풀', () => {
    A.props.bush = pool(N.bush, 3, 6001);
    A.props.berryBush = pool(N.bush, 1, 6501, { berries: true });
    A.props.grass = pool(N.grassTuft, 4, 7001);
    A.props.flower = pool(N.flower, 4, 8001);
    A.props.mushroom = pool(N.mushroom, 3, 9001);
    A.props.cattail = pool(N.cattail, 2, 9501);
    A.props.sapling = pool(N.sapling, 2, 9701);
    A.props.rock = pool(N.rock, 3, 10001);
    A.props.stump = pool(N.stump, 2, 11001);
    A.props.log = pool(N.log, 2, 12001);
  });
  push('마을', () => {
    A.props.cottage = [V.cottage(13001), V.cottage(13101, { roof: P.roofBlue }), V.cottage(13201, { roof: P.roofGreen })];
    A.props.hut = pool(V.tinyHut, 2, 14001);
    A.props.shop = [V.shopStall(15001)];
    A.props.windmill = [V.windmill(16001)];
    A.props.tower = [V.tower(17001)];
    A.props.tent = pool(V.tent, 2, 18001);
    A.props.gate = [V.gateArch(19001)];
    A.props.well = [V.well(20001)];
    A.props.fence = pool(V.fencePiece, 2, 21001);
    A.props.lamp = pool(V.lampPost, 2, 22001);
    A.props.sign = [V.signPost(23001)];
    A.props.barrel = pool(V.barrel, 2, 24001);
    A.props.crate = pool(V.crate, 2, 25001);
    A.props.campfire = [V.campfire(26001)];
    A.props.bridge = [V.bridge(27001)];
    A.props.ruin = [V.ruinArch(28001)];
    A.props.cart = [V.cart(29001)];
  });
  push('숲 친구들', () => {
    for (const k of ['chick', 'cloudSheep', 'ghost', 'robot', 'snail', 'bug', 'spiky', 'mushroomFolk', 'worm']) {
      A.critters[k] = bakeCritter(k, 30001 + k.length * 13);
    }
  });
  push('수집품', () => {
    A.props.acorn = [N.acornProp(31001)];
    A.props.lantern = [N.lanternProp(32001, false)];
    A.props.lanternLit = [N.lanternProp(32001, true)];
  });

  for (let i = 0; i < steps.length; i++) {
    const [label, fn] = steps[i];
    onProgress(label, i / steps.length);
    fn();
    // 브라우저가 로딩 문구를 갱신할 틈을 준다
    await new Promise((r) => setTimeout(r, 0));
  }
  onProgress('완성', 1);
  return A;
}
