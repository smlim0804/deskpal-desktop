// 등불 축제 퀘스트 + 대사
import { GATE } from '../world/world.js';

export const TOTAL_LANTERNS = 5;

const LINES = {
  guard: {
    pre: [
      '오늘 밤이 등불 축제인데… 큰일 났어.',
      '문에 걸어 둘 등불 다섯 개가 전부 사라졌지 뭐야.',
      '숲 어딘가에 굴러다닐 거야. 찾으면 이 문 앞으로 가져와 줘!',
    ],
    mid: ['좋아, 하나씩 걸리고 있어. 계속 부탁해!'],
    done: ['다섯 개 전부다! 자, 이제 밤이 예뻐질 시간이야.'],
  },
  elder: {
    pre: ['등불이 다 걸리면 하늘도 색을 바꾼단다.', '서두르지 말고, 숲 구경도 좀 하렴.'],
    mid: ['벌써 몇 개를 찾았구나. 손이 야무지네.'],
    done: ['좋은 밤이다. 오래 기억될 밤이야.'],
  },
  trader: {
    pre: ['도토리 모으는 거 좋아해? 나도 그래.', '반짝이는 건 대개 값이 나가지. 등불도 그렇고.'],
    mid: ['등불 하나에 도토리 열 개 값은 하겠는걸.'],
    done: ['축제 기념 할인! …이라고 말하고 싶지만 오늘은 다 공짜야.'],
  },
  smith: {
    pre: ['망치질 소리 시끄럽지? 미안해.', '등불 고리는 내가 다 만들어 뒀는데 정작 등불이 없네.'],
    mid: ['고리 다섯 개, 준비 완료.'],
    done: ['내 고리에 딱 맞더군. 역시 내 솜씨야.'],
  },
  kid: {
    pre: ['저기 자는 애는 사흘째 자는 중이야!', '숲 안쪽은 무서워서 못 가. 대신 가 줄래?'],
    mid: ['우와, 진짜로 찾아왔어?!'],
    done: ['오늘은 안 잘 거야. 절대로!'],
  },
  witch: {
    pre: ['등불 하나는 무너진 아치 근처에서 굴러다니는 걸 봤어.', '유령이 가지고 논 모양이야. 물진 않아.'],
    mid: ['북쪽 숲 깊은 곳도 한번 살펴보렴.'],
    done: ['불빛이 좋구나. 오늘은 마법을 아껴 둘게.'],
  },
  farmer: {
    pre: ['풍차 뒤쪽은 바람이 세서 뭐든 굴러가 버려.', '내 모자도 저번에 거기서 찾았지.'],
    mid: ['풍차 뒤! 거기 봤어?'],
    done: ['올해 도토리 농사도 풍년이야. 축제까지 겹쳤네.'],
  },
  sleepy: {
    pre: ['…zzz…', '…등불… 다섯 개… zzz…'],
    mid: ['…zzz…'],
    done: ['…응? 벌써 밤이야? …zzz…'],
  },
};

export class Quest {
  constructor() {
    this.carrying = 0;
    this.delivered = 0;
    this.acorns = 0;
    this.festival = false;
    this.festivalT = 0;
    this.talkedTo = new Set();
  }

  get objective() {
    if (this.festival) return '등불 축제가 시작됐다! 마을을 둘러보자';
    if (this.carrying > 0) return `등불 ${this.carrying}개를 마을 문으로 가져가기`;
    if (this.delivered === 0) return '숲에 흩어진 축제 등불 5개 찾기';
    return `남은 등불 ${TOTAL_LANTERNS - this.delivered}개 더 찾기`;
  }

  linesFor(npcId) {
    const set = LINES[npcId];
    if (!set) return ['…'];
    if (this.festival) return set.done;
    if (this.delivered > 0 || this.carrying > 0) return set.mid;
    return set.pre;
  }

  // 문 앞에 도착하면 들고 있던 등불을 전부 건다
  tryDeliver(player, game) {
    if (this.carrying <= 0 || this.festival) return;
    const d = Math.hypot(player.x - GATE.x, player.z - GATE.z);
    if (d > 3.4) return;
    this.delivered = Math.min(TOTAL_LANTERNS, this.delivered + this.carrying);
    this.carrying = 0;
    game.spawnSparks(GATE.x, GATE.z, 26);
    game.toast(`등불을 문에 걸었다!  (${this.delivered}/${TOTAL_LANTERNS})`);
    player.playEmote('cheer', 1.2);
    game.lightGate(this.delivered);
    if (this.delivered >= TOTAL_LANTERNS) this.startFestival(game);
  }

  startFestival(game) {
    this.festival = true;
    this.festivalT = 0;
    game.toast('🏮 등불 축제가 시작됐다!', 4.2);
    for (const n of game.world.npcs) {
      if (n.state !== 'sleep') n.celebrate = true;
    }
    game.cam.shake = 0.6;
  }
}
