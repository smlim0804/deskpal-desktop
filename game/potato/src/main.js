// 감자 언덕(Potato Hollow) — 돈스타브 풍 잉크 그래픽의 감자 농사 게임.
// 2D 종이 인형이 기울어진 3D 들판에 서 있는 방식(빌보드)으로 그린다.
import { Camera } from './core/camera.js';
import { Input } from './core/input.js';
import { clamp, lerp, makeRng, noise1, rand, randInt, pick } from './core/rng.js';
import { drawSprite, makePaperTile, shape, smoothPath, INK } from './core/sketch.js';
import { P, shade, skyColors } from './art/palette.js';
import { bakeBean } from './art/chars.js';
import { bakeCritter } from './art/critters.js';
import { bakePlants } from './art/plants.js';
import { bakeProps } from './art/props.js';
import {
  makeFarm,
  updatePlot,
  buildDressing,
  PLOT_SIZE,
  FIELD_COLS,
  FIELD_ROWS,
  SPOTS,
  STAGE_TIME,
} from './world/farm.js';
import { drawHud, drawPrompt, drawToast, drawShop, drawNightFade, SHOP_ITEMS } from './ui/hud.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false });
const titleEl = document.getElementById('title');
const loadingEl = document.getElementById('loading');

const SAVE_KEY = 'potatohollow.save1';
const DAY_LEN = 110; // 초

// ── 게임 상태 ─────────────────────────────────
class Game {
  constructor(assets) {
    this.assets = assets;
    this.cam = new Camera();
    this.cam.pitch = 0.34;
    this.cam.dist = 12.5;
    this.cam.fov = 0.8;
    this.input = new Input(canvas);
    this.paper = null;

    this.plots = makeFarm();
    this.dressing = buildDressing(assets.props);
    this.player = {
      x: 0,
      z: 3.6,
      face: 1,
      anim: 'idle',
      frame: 0,
      animT: 0,
      action: null, // {kind, t, dur, plot}
      speed: 3.1,
    };
    this.inv = { potato: 0, gold: 0, coins: 6, seeds: 4, fert: 0, water: 6, waterMax: 6 };
    this.upgrades = { bigCan: false, scarecrow: false, land: false };
    this.totalHarvest = 0;
    this.day = 1;
    this.time = 0;
    this.dayClock = 0;
    this.dayT = 0.08;
    this.raining = false;
    this.sleep = 0; // 밤 페이드 (0..1..0)
    this.focus = null;
    this.toastMsg = null;
    this.shopOpen = false;
    this.shopSel = 0;
    this.pickups = [];
    this.particles = [];
    this.crow = null;
    this.critters = [];
    this.running = false;

    // 나비 두어 마리
    for (let i = 0; i < 2; i++) {
      this.critters.push({
        kind: 'butterfly',
        set: assets.butterfly,
        x: rand(Math.random, -4, 4),
        z: rand(Math.random, -2, 6),
        y: 0.8,
        t: Math.random() * 9,
        h: 0.4,
      });
    }

    this.cam.tx = this.player.x;
    this.cam.tz = this.player.z;
    this.load();
  }

  toast(text, life = 2.4) {
    this.toastMsg = { text, life, age: 0 };
  }

  // ── 저장/불러오기 ──────────────────────────
  save() {
    try {
      const data = {
        inv: this.inv,
        upgrades: this.upgrades,
        totalHarvest: this.totalHarvest,
        day: this.day,
        plots: this.plots.map((p) => ({
          state: p.state,
          weed: p.weed,
          stage: p.stage,
          t: p.t,
          moisture: p.moisture,
          fert: p.fert,
          locked: p.locked,
        })),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      /* 저장 불가 환경 */
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      Object.assign(this.inv, d.inv || {});
      Object.assign(this.upgrades, d.upgrades || {});
      this.totalHarvest = d.totalHarvest || 0;
      this.day = d.day || 1;
      if (Array.isArray(d.plots)) {
        d.plots.forEach((s, i) => {
          if (this.plots[i]) Object.assign(this.plots[i], s);
        });
      }
    } catch (e) {
      /* 깨진 저장은 무시 */
    }
  }

  // ── 상호작용 대상 찾기 ─────────────────────
  findFocus() {
    const p = this.player;
    let best = null;
    let bestD = 1.55;

    for (const plot of this.plots) {
      if (plot.locked) continue;
      const d = Math.hypot(plot.x - p.x, plot.z - p.z);
      if (d > bestD) continue;
      let label = null;
      if (plot.state === 'grass') label = plot.weed ? '잡초 뽑기' : '밭 갈기';
      else if (plot.state === 'tilled') label = this.inv.seeds > 0 ? '씨감자 심기' : null;
      else if (plot.state === 'wilted') label = '시든 밭 정리';
      else if (plot.state === 'crop') {
        if (plot.stage >= 4) label = '감자 캐기!';
        else if (plot.moisture < 0.85 && this.inv.water > 0) label = '물 주기';
        else if (plot.moisture < 0.85) label = null;
      }
      if (!label) continue;
      bestD = d;
      best = { kind: 'plot', plot, label };
    }

    const dWell = Math.hypot(SPOTS.well.x - p.x, SPOTS.well.z - p.z);
    if (dWell < 1.7 && dWell < bestD && this.inv.water < this.inv.waterMax) {
      best = { kind: 'well', label: '물 받기' };
      bestD = dWell;
    }
    const dStall = Math.hypot(SPOTS.stall.x - p.x, SPOTS.stall.z - p.z);
    if (dStall < 2.0 && dStall < bestD) {
      best = { kind: 'stall', label: '가게 열기' };
      bestD = dStall;
    }
    if (this.crow && this.crow.state !== 'flee') {
      const dCrow = Math.hypot(this.crow.x - p.x, this.crow.z - p.z);
      if (dCrow < 2.6 && dCrow < bestD) best = { kind: 'crow', label: '훠이! 쫓아내기' };
    }
    this.focus = best;
  }

  // ── 행동 ───────────────────────────────────
  startAction(kind, dur, plot) {
    this.player.action = { kind, t: 0, dur, plot };
    this.player.animT = 0;
  }

  interact() {
    if (this.player.action) return;
    const f = this.focus;
    if (!f) return;
    if (f.kind === 'well') {
      this.inv.water = this.inv.waterMax;
      this.toast('물뿌리개가 찰랑찰랑!');
      this.splash(SPOTS.well.x, SPOTS.well.z, 6);
      return;
    }
    if (f.kind === 'stall') {
      this.shopOpen = true;
      this.shopSel = 0;
      return;
    }
    if (f.kind === 'crow') {
      this.scareCrow();
      return;
    }
    const plot = f.plot;
    if (f.label === '잡초 뽑기') this.startAction('weed', 0.55, plot);
    else if (f.label === '밭 갈기') this.startAction('till', 0.7, plot);
    else if (f.label === '씨감자 심기') this.startAction('plant', 0.55, plot);
    else if (f.label === '물 주기') this.startAction('waterPlot', 0.6, plot);
    else if (f.label === '감자 캐기!') this.startAction('harvest', 0.65, plot);
    else if (f.label === '시든 밭 정리') this.startAction('clear', 0.6, plot);
  }

  finishAction(a) {
    const plot = a.plot;
    if (a.kind === 'weed') {
      plot.weed = false;
      this.puff(plot.x, plot.z, 5);
    } else if (a.kind === 'till') {
      plot.state = 'tilled';
      this.puff(plot.x, plot.z, 7);
    } else if (a.kind === 'clear') {
      plot.state = 'tilled';
      plot.stage = 0;
      plot.t = 0;
      plot.moisture = 0;
      plot.dryT = 0;
      plot.fert = false;
      this.puff(plot.x, plot.z, 6);
    } else if (a.kind === 'plant') {
      if (this.inv.seeds <= 0) return;
      this.inv.seeds--;
      plot.state = 'crop';
      plot.stage = 0;
      plot.t = 0;
      plot.moisture = 0.65;
      plot.dryT = 0;
      plot.fert = this.inv.fert > 0;
      if (plot.fert) {
        this.inv.fert--;
        this.toast('거름을 듬뿍 — 실하게 자라겠다!');
      }
      this.puff(plot.x, plot.z, 4);
    } else if (a.kind === 'waterPlot') {
      if (this.inv.water <= 0) return;
      this.inv.water--;
      plot.moisture = 1;
      plot.dryT = 0;
      if (plot.state === 'wilted') return;
      this.splash(plot.x, plot.z, 7);
    } else if (a.kind === 'harvest') {
      const n = randInt(Math.random, 2, 3) + (plot.fert ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const gold = Math.random() < 0.06;
        const ang = Math.random() * Math.PI * 2;
        this.pickups.push({
          gold,
          x: plot.x + Math.cos(ang) * 0.2,
          z: plot.z + Math.sin(ang) * 0.2,
          y: 0.35,
          vx: Math.cos(ang) * rand(Math.random, 0.8, 1.7),
          vz: Math.sin(ang) * rand(Math.random, 0.8, 1.7),
          vy: rand(Math.random, 2.6, 3.6),
          age: 0,
          taken: false,
        });
      }
      plot.state = 'tilled';
      plot.stage = 0;
      plot.t = 0;
      plot.fert = false;
      this.puff(plot.x, plot.z, 8);
    }
  }

  scareCrow() {
    if (!this.crow) return;
    this.crow.state = 'flee';
    this.crow.vy = 2.4;
    this.toast('훠이훠이! 까마귀가 도망갔다');
  }

  // ── 상점 ───────────────────────────────────
  shopBuy() {
    const it = SHOP_ITEMS[this.shopSel];
    if (!it) return;
    if (it.once && this.upgrades[it.once]) {
      this.toast('이미 가지고 있다');
      return;
    }
    if (this.inv.coins < it.cost) {
      this.toast('동전이 모자라다…');
      return;
    }
    this.inv.coins -= it.cost;
    if (it.id === 'seed') this.inv.seeds += 3;
    else if (it.id === 'fert') this.inv.fert += 1;
    else if (it.id === 'can') {
      this.upgrades.bigCan = true;
      this.inv.waterMax = 10;
      this.toast('물뿌리개가 커졌다!');
    } else if (it.id === 'scare') {
      this.upgrades.scarecrow = true;
      this.toast('허수아비가 밭을 지킨다!');
    } else if (it.id === 'land') {
      this.upgrades.land = true;
      for (const p of this.plots) p.locked = false;
      this.toast('밭이 넓어졌다! (+8칸)');
    }
    this.save();
  }

  shopSell() {
    const total = this.inv.potato * 3 + this.inv.gold * 15;
    if (total <= 0) {
      this.toast('팔 감자가 없다…');
      return;
    }
    this.inv.coins += total;
    this.inv.potato = 0;
    this.inv.gold = 0;
    this.toast(`감자를 팔아 ${total}동전을 벌었다!`);
    this.save();
  }

  // ── 파티클 ─────────────────────────────────
  puff(x, z, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        type: 'dust',
        x: x + (Math.random() - 0.5) * 0.7,
        z: z + (Math.random() - 0.5) * 0.7,
        y: 0.1,
        vx: (Math.random() - 0.5) * 0.8,
        vz: (Math.random() - 0.5) * 0.8,
        vy: rand(Math.random, 0.5, 1.2),
        life: 0.55,
        maxLife: 0.55,
        r: 0.1,
      });
    }
  }

  splash(x, z, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        type: 'drop',
        x: x + (Math.random() - 0.5) * 0.8,
        z: z + (Math.random() - 0.5) * 0.8,
        y: rand(Math.random, 0.5, 1.1),
        vx: (Math.random() - 0.5) * 0.5,
        vz: (Math.random() - 0.5) * 0.5,
        vy: -0.4,
        life: 0.6,
        maxLife: 0.6,
        r: 0.06,
      });
    }
  }

  sparkle(x, z, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        type: 'spark',
        x: x + (Math.random() - 0.5) * 0.5,
        z: z + (Math.random() - 0.5) * 0.5,
        y: rand(Math.random, 0.4, 1.1),
        vx: 0,
        vz: 0,
        vy: rand(Math.random, 0.6, 1.2),
        life: 0.8,
        maxLife: 0.8,
        r: 0.06,
      });
    }
  }

  // ── 까마귀 ─────────────────────────────────
  updateCrow(dt) {
    if (this.upgrades.scarecrow) {
      if (this.crow && this.crow.state !== 'flee') this.scareCrow();
    }
    if (!this.crow) {
      const ready = this.plots.filter((p) => !p.locked && p.state === 'crop' && p.stage >= 3);
      if (ready.length && !this.raining && !this.upgrades.scarecrow && this.day >= 2 && Math.random() < dt * 0.05) {
        const target = pick(Math.random, ready);
        this.crow = {
          x: target.x + rand(Math.random, -7, 7),
          z: target.z - 10,
          y: 5,
          vy: 0,
          target,
          state: 'swoop',
          t: 0,
        };
      }
      return;
    }
    const c = this.crow;
    c.t += dt;
    if (c.state === 'swoop') {
      const dx = c.target.x - c.x;
      const dz = c.target.z - c.z;
      const d = Math.hypot(dx, dz);
      c.x += (dx / (d || 1)) * dt * 3.2;
      c.z += (dz / (d || 1)) * dt * 3.2;
      c.y = Math.max(0, c.y - dt * 2.2);
      if (d < 0.3 && c.y <= 0.01) {
        c.state = 'peck';
        c.t = 0;
        this.toast('까마귀가 감자를 노린다!', 2);
      }
    } else if (c.state === 'peck') {
      if (c.target.state !== 'crop') {
        c.state = 'flee';
        return;
      }
      if (Math.hypot(this.player.x - c.x, this.player.z - c.z) < 2.2) {
        this.scareCrow();
        return;
      }
      if (c.t > 5.5) {
        // 한 단계 갉아먹는다 (수확기면 밭을 통째로 망친다)
        if (c.target.stage >= 4) {
          c.target.state = 'tilled';
          c.target.stage = 0;
          this.toast('아앗! 까마귀가 감자를 물어갔다…', 2.6);
        } else {
          c.target.stage = Math.max(0, c.target.stage - 1);
          this.toast('까마귀가 잎을 쪼아 놨다…', 2.2);
        }
        c.state = 'flee';
        c.vy = 2.2;
      }
    } else if (c.state === 'flee') {
      c.y += dt * (c.vy += dt * 2.2);
      c.x += dt * 2.4;
      c.z -= dt * 2.6;
      if (c.y > 7) this.crow = null;
    }
  }

  // ── 갱신 ───────────────────────────────────
  update(dt) {
    const { input, cam, player } = this;
    this.time += dt;

    // 상점 입력
    if (this.shopOpen) {
      if (input.hit('escape', 'q')) this.shopOpen = false;
      if (input.hit('arrowdown', 's')) this.shopSel = (this.shopSel + 1) % SHOP_ITEMS.length;
      if (input.hit('arrowup', 'w')) this.shopSel = (this.shopSel + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length;
      if (input.hit('f', 'enter')) this.shopBuy();
      if (input.hit('e')) this.shopSell();
      input.endFrame();
      cam.update(dt);
      return;
    }

    if (input.hit('f', 'enter', ' ')) this.interact();

    // 카메라
    if (input.down('q')) cam.orbit(-1.3 * dt);
    if (input.down('e')) cam.orbit(1.3 * dt);
    const drag = input.takeDrag();
    if (drag) cam.orbit(-drag * 0.004);
    if (input.down('z')) cam.zoom(-8 * dt);
    if (input.down('x')) cam.zoom(8 * dt);

    // 이동 (액션 중엔 멈춤)
    const act = player.action;
    if (!act && this.sleep <= 0) {
      const mv = input.moveAxis();
      const basis = cam.groundBasis();
      const vx = basis.rx * mv.x + basis.fx * mv.z;
      const vz = basis.rz * mv.x + basis.fz * mv.z;
      const len = Math.hypot(vx, vz);
      if (len > 0.01) {
        player.x += (vx / len) * player.speed * dt * Math.min(1, len);
        player.z += (vz / len) * player.speed * dt * Math.min(1, len);
        player.x = clamp(player.x, -13, 13);
        player.z = clamp(player.z, -8, 12);
        if (Math.abs(vx) > 0.05) player.face = vx > 0 ? 1 : -1;
        player.anim = 'walk';
      } else {
        player.anim = 'idle';
      }
      // 소품 밀어내기
      for (const d of this.dressing) {
        if (!d.r) continue;
        const dx = player.x - d.x;
        const dz = player.z - d.z;
        const dist = Math.hypot(dx, dz);
        if (dist < d.r + 0.34 && dist > 0.001) {
          const push = (d.r + 0.34 - dist) / dist;
          player.x += dx * push;
          player.z += dz * push;
        }
      }
    } else if (act) {
      act.t += dt;
      player.anim = act.kind === 'till' || act.kind === 'clear' || act.kind === 'weed' ? 'hoe' : act.kind === 'waterPlot' ? 'water' : 'dig';
      if (act.t >= act.dur) {
        this.finishAction(act);
        player.action = null;
      }
    }

    player.animT += dt;

    // 밭 갱신
    const growMul = this.dayT > 0.62 ? 0.4 : 1; // 밤에는 천천히
    for (const plot of this.plots) {
      const ev = updatePlot(plot, dt, this.raining, growMul);
      if (ev === 'grew' && plot.stage === 4) this.sparkle(plot.x, plot.z, 5);
      if (ev === 'wilted') this.toast('앗, 밭 하나가 시들었다…', 2.2);
    }

    // 감자 줍기
    for (const k of this.pickups) {
      if (k.taken) continue;
      k.age += dt;
      k.x += k.vx * dt;
      k.z += k.vz * dt;
      k.y += k.vy * dt;
      k.vy -= 9.5 * dt;
      if (k.y <= 0.16) {
        k.y = 0.16;
        k.vy *= -0.35;
        k.vx *= 0.7;
        k.vz *= 0.7;
      }
      // 살짝 자석처럼 끌려온다
      const pdx = player.x - k.x;
      const pdz = player.z - k.z;
      const pd = Math.hypot(pdx, pdz);
      if (k.age > 0.45 && pd < 2.0 && pd > 0.05) {
        k.x += (pdx / pd) * dt * 3.2;
        k.z += (pdz / pd) * dt * 3.2;
      }
      if (k.age > 0.5 && pd < 0.9) {
        k.taken = true;
        if (k.gold) {
          this.inv.gold++;
          this.toast('금감자다!! 반짝반짝', 2.2);
        } else this.inv.potato++;
        this.totalHarvest++;
        this.sparkle(k.x, k.z, 3);
        if (this.totalHarvest === 10) this.toast('감자 10개! 제법 농부답다', 3);
        if (this.totalHarvest === 50) this.toast('감자 50개! 마을 제일 감자꾼', 3);
        if (this.totalHarvest === 100) this.toast('감자 100개!! 감자 박사 등극!', 3.6);
      }
    }
    this.pickups = this.pickups.filter((k) => !k.taken);

    this.updateCrow(dt);

    // 나비
    for (const c of this.critters) {
      c.t += dt;
      c.x += Math.cos(c.t * 0.7) * dt * 0.8;
      c.z += Math.sin(c.t * 0.53) * dt * 0.6;
      c.y = 0.7 + Math.sin(c.t * 2.2) * 0.25;
    }

    // 파티클
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      q.x += q.vx * dt;
      q.z += q.vz * dt;
      q.y += q.vy * dt;
      if (q.type === 'drop') q.vy -= 4 * dt;
      if (q.life <= 0 || q.y < 0) this.particles.splice(i, 1);
    }
    // 비 — 프레임당 여러 방울
    if (this.raining) {
      const n = Math.min(6, Math.max(1, Math.round(dt * 140)));
      for (let i = 0; i < n; i++) {
        this.particles.push({
          type: 'rain',
          x: cam.tx + (Math.random() - 0.5) * 18,
          z: cam.tz + (Math.random() - 0.5) * 16,
          y: 5.5,
          vx: -0.6,
          vz: 0,
          vy: -8,
          life: 0.75,
          maxLife: 0.75,
          r: 0.05,
        });
      }
    }

    // 하루 시계
    this.dayClock += dt;
    this.dayT = clamp(this.dayClock / DAY_LEN, 0, 1);
    if (this.dayT >= 1 && this.sleep <= 0) this.sleep = 0.0001;
    if (this.sleep > 0) {
      this.sleep += dt * 0.8;
      if (this.sleep >= 2) {
        // 아침 — 하루 넘기기
        this.sleep = 0;
        this.day++;
        this.dayClock = 0;
        this.dayT = 0.02;
        this.raining = Math.random() < 0.28;
        if (this.raining) this.toast('비가 온다 — 물 주기는 하늘이 해 준다!', 3);
        else this.toast(`${this.day}일째 아침`, 2);
        for (const plot of this.plots) {
          if (plot.state === 'grass' && !plot.weed && Math.random() < 0.2) plot.weed = true;
        }
        this.crow = null;
        this.save();
      }
    }

    if (this.toastMsg) {
      this.toastMsg.life -= dt;
      this.toastMsg.age += dt;
      if (this.toastMsg.life <= 0) this.toastMsg = null;
    }

    this.findFocus();
    cam.follow(player.x, 0, player.z, dt);
    cam.update(dt);
    input.endFrame();
  }

  // ── 렌더 ───────────────────────────────────
  render() {
    const { cam, player, assets } = this;
    const t = this.time;
    drawScene(ctx, cam, this, t);

    drawHud(ctx, cam, this);
    drawPrompt(ctx, cam, this);
    drawToast(ctx, cam, this);
    drawShop(ctx, cam, this);
    const fadeK = this.sleep <= 0 ? 0 : this.sleep < 1 ? this.sleep : 2 - this.sleep;
    drawNightFade(ctx, cam, clamp(fadeK, 0, 1));
  }
}

// ── 씬 렌더링 (돈스타브 무드) ──────────────────
const _p = {};
const _q = {};

function groundPoly(ctx, cam, pts, y, fill, strokeW = 0) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    cam.project(pts[i][0], y, pts[i][1], _p);
    if (!_p.visible) return false;
    i === 0 ? ctx.moveTo(_p.x, _p.y) : ctx.lineTo(_p.x, _p.y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (strokeW > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = strokeW;
    ctx.stroke();
  }
  return true;
}

// 미리 만든 흔들 사각형(월드 좌표에 지터를 구워 둬 매 프레임 안 떨리게)
const wobbleCache = new Map();
function wobbleRect(cx, cz, w, h, seed) {
  const key = `${cx.toFixed(2)}|${cz.toFixed(2)}|${w}|${h}|${seed}`;
  let pts = wobbleCache.get(key);
  if (!pts) {
    const rng = makeRng(seed);
    pts = [];
    const n = 3;
    const corners = [
      [cx - w / 2, cz - h / 2],
      [cx + w / 2, cz - h / 2],
      [cx + w / 2, cz + h / 2],
      [cx - w / 2, cz + h / 2],
    ];
    for (let c = 0; c < 4; c++) {
      const a = corners[c];
      const b = corners[(c + 1) % 4];
      for (let i = 0; i < n; i++) {
        const tt = i / n;
        pts.push([
          a[0] + (b[0] - a[0]) * tt + (rng() - 0.5) * 0.12,
          a[1] + (b[1] - a[1]) * tt + (rng() - 0.5) * 0.12,
        ]);
      }
    }
    wobbleCache.set(key, pts);
  }
  return pts;
}

function drawScene(ctx, cam, g, t) {
  const dayT = g.dayT;
  const hy = clamp(cam.horizonY(), -100, cam.h);

  // 하늘
  const [top, low] = skyColors(clamp((dayT - 0.35) / 0.5, 0, 1));
  const skyG = ctx.createLinearGradient(0, 0, 0, Math.max(hy, 40));
  skyG.addColorStop(0, top);
  skyG.addColorStop(1, low);
  ctx.fillStyle = skyG;
  ctx.fillRect(0, 0, cam.w, hy + 3);

  // 해 / 달 — 양피지 하늘에 잉크 원반
  {
    const sx = cam.w * 0.7 - cam.yaw * 220;
    const sy = hy - 60 - Math.sin(clamp(dayT, 0, 1) * Math.PI) * 30;
    ctx.save();
    if (dayT < 0.58) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#e7d38f';
      ctx.strokeStyle = 'rgba(43,36,29,0.6)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(sx, sy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 햇살 선
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * 32, sy + Math.sin(a) * 32);
        ctx.lineTo(sx + Math.cos(a) * 42, sy + Math.sin(a) * 42);
        ctx.stroke();
      }
    } else {
      ctx.globalAlpha = clamp((dayT - 0.5) * 3, 0, 1);
      ctx.fillStyle = '#ded9c2';
      ctx.strokeStyle = 'rgba(43,36,29,0.5)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // 구름
  for (let i = 0; i < 2; i++) {
    const sp = g.assets.props.cloud[i];
    const drift = ((t * (3 + i * 2) + i * 500) % (cam.w + 700)) - 350;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(sp.canvas, drift - cam.yaw * (90 + i * 50), hy - 150 - i * 40, 230, 110);
    ctx.restore();
  }

  // 지평선 숲 실루엣 (어두운 톱니)
  ctx.save();
  ctx.fillStyle = 'rgba(52,58,40,0.85)';
  ctx.beginPath();
  const tw = 46;
  const off = ((-cam.yaw * 380) % tw + tw) % tw;
  ctx.moveTo(-60, hy + 2);
  for (let x = -60; x < cam.w + 60; x += tw) {
    const k = Math.sin(x * 0.021 + 3) * 9;
    ctx.lineTo(x + tw * 0.5 - off, hy - 34 - k);
    ctx.lineTo(x + tw - off, hy + 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 땅
  const gG = ctx.createLinearGradient(0, hy, 0, cam.h);
  gG.addColorStop(0, shade(P.grassDark, -0.03));
  gG.addColorStop(0.35, P.grass);
  gG.addColorStop(1, shade(P.grass, -0.04));
  ctx.fillStyle = gG;
  ctx.fillRect(0, hy, cam.w, cam.h - hy);

  // 흙 마당(농장 전체) + 길
  groundPoly(ctx, cam, wobbleRect(-1.2, 2.2, 15.5, 14.5, 71), 0.004, 'rgba(150,124,82,0.5)');
  groundPoly(ctx, cam, wobbleRect(2.6, 4.4, 2.2, 9, 73), 0.006, 'rgba(176,148,104,0.66)');

  // 밭 데칼
  for (const plot of g.plots) {
    if (plot.locked) {
      groundPoly(ctx, cam, wobbleRect(plot.x, plot.z, PLOT_SIZE, PLOT_SIZE, 100 + plot.col * 7 + plot.row * 31), 0.008, 'rgba(110,96,66,0.25)');
      continue;
    }
    const tilled = plot.state !== 'grass';
    if (!tilled) {
      // 아직 안 간 밭 — 옅은 경계만 보여줘 "여기가 밭"임을 알린다
      groundPoly(
        ctx,
        cam,
        wobbleRect(plot.x, plot.z, PLOT_SIZE, PLOT_SIZE, 100 + plot.col * 7 + plot.row * 31),
        0.006,
        'rgba(118,102,64,0.22)'
      );
      continue;
    }
    const wet = plot.state === 'crop' && plot.moisture > 0.45;
    groundPoly(
      ctx,
      cam,
      wobbleRect(plot.x, plot.z, PLOT_SIZE, PLOT_SIZE, 100 + plot.col * 7 + plot.row * 31),
      0.01,
      wet ? 'rgba(62,47,27,0.92)' : 'rgba(88,66,39,0.92)',
      1.6
    );
    // 고랑 줄
    ctx.strokeStyle = 'rgba(43,36,29,0.4)';
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      cam.project(plot.x - PLOT_SIZE * 0.4, 0.012, plot.z + i * PLOT_SIZE * 0.27, _p);
      ctx.moveTo(_p.x, _p.y);
      cam.project(plot.x + PLOT_SIZE * 0.4, 0.012, plot.z + i * PLOT_SIZE * 0.27, _q);
      ctx.lineTo(_q.x, _q.y);
      ctx.stroke();
    }
  }

  // ── 그릴 것 수집 ────────────────────────────
  const list = [];
  const pushSprite = (sprite, x, z, hUnits, opt = {}) => {
    cam.project(x, opt.y || 0, z, _p);
    if (!_p.visible) return;
    list.push({
      sprite,
      x,
      z,
      sx: _p.x,
      sy: _p.y,
      depth: _p.depth,
      h: hUnits * _p.scale * (opt.scale || 1),
      flip: opt.flip || false,
      alpha: opt.alpha ?? 1,
      shear: opt.shear || 0,
      shadow: opt.shadow ?? 1,
      shadowW: (opt.shadowR || hUnits * 0.3) * _p.scale,
      scale: _p.scale,
    });
  };

  // 소품
  for (const d of g.dressing) {
    const sway = d.sway ? Math.sin(t * 1.3 + d.phase) * 0.018 * d.sway + noise1(t * 0.4 + d.phase, 3) * 0.012 * d.sway : 0;
    pushSprite(d.sprite, d.x, d.z, d.sprite.hUnits, { scale: d.scale, flip: d.flip, shear: sway, shadow: d.shadow, shadowR: d.sprite.hUnits * 0.22 * d.scale });
  }
  // 허수아비 (구매 시)
  if (g.upgrades.scarecrow) {
    const sp = g.assets.props.scarecrow[0];
    pushSprite(sp, SPOTS.scarecrow.x, SPOTS.scarecrow.z, sp.hUnits, { shear: Math.sin(t * 0.9) * 0.012, shadowR: 0.4 });
  }

  // 밭 작물
  const plants = g.assets.plants;
  for (const plot of g.plots) {
    if (plot.locked) continue;
    if (plot.state === 'grass' && plot.weed) {
      pushSprite(plants.weed, plot.x + 0.18, plot.z + 0.1, plants.weed.hUnits, { shear: Math.sin(t * 1.5 + plot.col) * 0.02 });
    } else if (plot.state === 'crop') {
      const dry = plot.moisture <= 0.12 && plot.stage >= 2;
      const sp = dry && plot.stage < 4 ? plants.dryBush : plants.stages[plot.stage];
      pushSprite(sp, plot.x, plot.z, sp.hUnits, { shear: Math.sin(t * 1.6 + plot.col * 1.7 + plot.row) * 0.02 });
    } else if (plot.state === 'wilted') {
      pushSprite(plants.wilted, plot.x, plot.z, plants.wilted.hUnits, {});
    }
  }

  // 감자 픽업
  for (const k of g.pickups) {
    if (k.taken) continue;
    const sp = k.gold ? plants.goldPotato : plants.potato;
    pushSprite(sp, k.x, k.z, sp.hUnits * 0.7, { y: k.y, shadowR: 0.16 });
  }

  // 까마귀
  if (g.crow) {
    const c = g.crow;
    const f = c.state === 'peck' ? (Math.floor(t * 4) % 2 ? 1 : 0) : Math.floor(t * 8) % 2;
    const sp = g.assets.crow.idle[f];
    pushSprite(sp, c.x, c.z, g.assets.crow.height, { y: c.y, flip: c.x < g.player.x, shadow: c.y < 0.5 ? 1 : 0.3, shadowR: 0.3 });
  }
  // 나비
  for (const c of g.critters) {
    const sp = c.set.idle[Math.floor(t * 6 + c.t) % 2];
    pushSprite(sp, c.x, c.z, c.h, { y: c.y, shadow: 0.25, shadowR: 0.12 });
  }

  // 플레이어
  {
    const pl = g.player;
    let set;
    let fps = 7;
    if (pl.anim === 'hoe') set = g.assets.farmerHoe.hoe;
    else if (pl.anim === 'water') set = g.assets.farmerWater.water;
    else if (pl.anim === 'dig') {
      set = g.assets.farmer.dig;
      fps = 5;
    } else set = g.assets.farmer[pl.anim] || g.assets.farmer.idle;
    const frame = set[Math.floor(pl.animT * fps) % set.length];
    pushSprite(frame, pl.x, pl.z, g.assets.farmer.height, { flip: pl.face < 0, shadowR: 0.34 });
  }

  // 깊이 정렬(먼 것부터)
  list.sort((a, b) => b.depth - a.depth);

  // 그림자 먼저
  ctx.save();
  const shAlpha = lerp(0.3, 0.16, clamp((dayT - 0.4) / 0.5, 0, 1));
  ctx.fillStyle = P.shadow;
  for (const e of list) {
    if (!e.shadow) continue;
    cam.project(e.x, 0, e.z, _q);
    if (!_q.visible) continue;
    ctx.globalAlpha = shAlpha * e.shadow;
    ctx.beginPath();
    ctx.ellipse(_q.x, _q.y, Math.max(3, e.shadowW), Math.max(2, e.shadowW * cam.groundSquash * 0.8), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 본체
  for (const e of list) {
    if (e.shear) {
      ctx.save();
      ctx.translate(e.sx, e.sy);
      ctx.transform(1, 0, e.shear, 1, 0, 0);
      ctx.translate(-e.sx, -e.sy);
      drawSprite(ctx, e.sprite, e.sx, e.sy, e.h, e.alpha, e.flip);
      ctx.restore();
    } else {
      drawSprite(ctx, e.sprite, e.sx, e.sy, e.h, e.alpha, e.flip);
    }
  }

  // 파티클
  ctx.save();
  for (const q of g.particles) {
    cam.project(q.x, q.y, q.z, _p);
    if (!_p.visible) continue;
    const a = q.life / q.maxLife;
    if (q.type === 'dust') {
      ctx.globalAlpha = a * 0.6;
      ctx.fillStyle = 'rgba(140,116,80,0.9)';
      ctx.beginPath();
      ctx.arc(_p.x, _p.y, q.r * _p.scale * (1.4 - a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else if (q.type === 'drop' || q.type === 'rain') {
      const isRain = q.type === 'rain';
      ctx.globalAlpha = isRain ? 0.5 : a * 0.8;
      ctx.strokeStyle = isRain ? 'rgba(180,200,204,0.9)' : P.water;
      ctx.lineWidth = isRain ? 1.8 : 1.6;
      ctx.beginPath();
      ctx.moveTo(_p.x, _p.y);
      ctx.lineTo(_p.x + 2, _p.y + q.r * _p.scale * (isRain ? 6.5 : 3.2));
      ctx.stroke();
    } else if (q.type === 'spark') {
      ctx.globalAlpha = a;
      ctx.fillStyle = '#e3c766';
      ctx.beginPath();
      ctx.arc(_p.x, _p.y, q.r * _p.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 밤 어둠 + 반딧불 무드
  const night = clamp((dayT - 0.55) / 0.4, 0, 1);
  if (night > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(58,66,106,${0.62 * night})`;
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.restore();
  }
  // 비 오는 날은 살짝 어둑하게
  if (g.raining) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(148,158,166,0.35)';
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.restore();
  }

  // 종이 질감 + 돈스타브식 강한 비네트
  if (!g.paperPat) {
    g.paper = makePaperTile(256, 7);
    g.paperPat = ctx.createPattern(g.paper, 'repeat');
  }
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = g.paperPat;
  ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.restore();
  if (!g._vig || g._vigKey !== `${cam.w}x${cam.h}`) {
    const c = document.createElement('canvas');
    c.width = cam.w;
    c.height = cam.h;
    const g2 = c.getContext('2d');
    const rg = g2.createRadialGradient(cam.w / 2, cam.h / 2, cam.h * 0.32, cam.w / 2, cam.h / 2, cam.h * 0.85);
    rg.addColorStop(0, 'rgba(30,24,16,0)');
    rg.addColorStop(0.75, 'rgba(30,24,16,0.22)');
    rg.addColorStop(1, 'rgba(24,18,12,0.55)');
    g2.fillStyle = rg;
    g2.fillRect(0, 0, cam.w, cam.h);
    g._vig = c;
    g._vigKey = `${cam.w}x${cam.h}`;
  }
  ctx.drawImage(g._vig, 0, 0);
}

// ── 부팅 ─────────────────────────────────────
function resize(cam) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  cam.resize(w, h);
}

async function boot() {
  const FARMER = {
    shape: 'bean',
    color: '#e8ddc2',
    width: 30,
    blush: true,
    hat: 'straw',
    seed: 707,
    ss: 2,
    heightUnits: 1.45,
  };
  const steps = [
    ['밭 갈 준비', (A) => (A.plants = bakePlants())],
    ['소품 깎기', (A) => (A.props = bakeProps())],
    ['농부 굽기', (A) => (A.farmer = bakeBean(FARMER, 'full'))],
    ['괭이 쥐여주기', (A) => (A.farmerHoe = bakeBean({ ...FARMER, item: 'hoe', seed: 709 }, 'full'))],
    ['물뿌리개 챙기기', (A) => (A.farmerWater = bakeBean({ ...FARMER, item: 'can', seed: 711 }, 'full'))],
    ['까마귀 부르기', (A) => {
      A.crow = bakeCritter('crow', 313);
      A.butterfly = bakeCritter('butterfly', 317);
    }],
  ];
  const assets = {};
  for (let i = 0; i < steps.length; i++) {
    loadingEl.textContent = `스케치 굽는 중… ${steps[i][0]} (${Math.round((i / steps.length) * 100)}%)`;
    await new Promise((r) => setTimeout(r, 0));
    steps[i][1](assets);
  }
  loadingEl.hidden = true;

  const game = new Game(assets);
  window.__potato = game;
  resize(game.cam);
  window.addEventListener('resize', () => resize(game.cam));

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.running) game.update(dt);
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const start = () => {
    if (game.running) return;
    titleEl.hidden = true;
    game.running = true;
    game.toast('밭을 갈고 씨감자를 심어 보자! (F)', 3.6);
  };
  document.getElementById('btn-start').addEventListener('click', start);
  document.getElementById('btn-reset').addEventListener('click', () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      /* ignore */
    }
    location.reload();
  });
  window.addEventListener('keydown', (e) => {
    if (!game.running && (e.key === 'Enter' || e.key === ' ')) start();
  });
}

boot().catch((err) => {
  loadingEl.hidden = false;
  loadingEl.textContent = '앗, 스케치를 굽다가 문제가 생겼어요: ' + err.message;
  console.error(err);
});
