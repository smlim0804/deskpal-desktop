// Bean Hollow — 2D 손그림, 3D 공간.
import { Camera } from './core/camera.js';
import { Input } from './core/input.js';
import { clamp, lerp } from './core/rng.js';
import { bakeAll, VILLAGERS } from './world/assets.js';
import { buildWorld, GATE, POND } from './world/world.js';
import { Scene } from './render/scene.js';
import { Player } from './game/player.js';
import { updateVillagers, updateCritters, spawnAmbient } from './game/npc.js';
import { Quest, TOTAL_LANTERNS } from './game/quest.js';
import { drawHud, drawPrompt, drawDialogue, drawToast, drawFestivalBanner } from './ui/hud.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false });
const titleEl = document.getElementById('title');
const pausedEl = document.getElementById('paused');
const loadingEl = document.getElementById('loading');

const NAME_BY_ID = Object.fromEntries(VILLAGERS.map((v) => [v.id, v.name]));

class Game {
  constructor(assets) {
    this.assets = assets;
    this.cam = new Camera();
    this.input = new Input(canvas);
    this.scene = new Scene(ctx, this.cam);
    this.world = buildWorld(assets);
    this.world.pondCenter = POND;
    this.player = new Player(assets.player, 0, 21.5);
    this.quest = new Quest();
    this.particles = [];
    this.dialogue = { active: false, target: null, name: '', lines: [], idx: 0, line: '', charT: 0 };
    this.time = 0;
    this.dayT = 0.12;
    this.focus = null;
    this.toastMsg = null;
    this.running = false;
    this.paused = false;
    this.drawList = [];

    this.cam.tx = this.player.x;
    this.cam.tz = this.player.z;
  }

  toast(text, life = 2.6) {
    this.toastMsg = { text, life, age: 0 };
  }

  lightGate(n) {
    const g = this.world.gate;
    g.glow = 0.35 + (n / TOTAL_LANTERNS) * 0.65;
    g.glowY = 0.78;
    g.glowR = 3.2 + (n / TOTAL_LANTERNS) * 3.4;
  }

  spawnDust(x, z, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        type: 'dust',
        x: x + (Math.random() - 0.5) * 0.4,
        z: z + (Math.random() - 0.5) * 0.4,
        y: 0.06,
        vx: (Math.random() - 0.5) * 0.7,
        vz: (Math.random() - 0.5) * 0.7,
        vy: 0.4 + Math.random() * 0.5,
        r: 0.07,
        life: 0.5,
        maxLife: 0.5,
      });
    }
  }

  spawnSplash(x, z, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        type: 'splash',
        x: x + (Math.random() - 0.5) * 0.5,
        z: z + (Math.random() - 0.5) * 0.5,
        y: 0.05,
        vx: (Math.random() - 0.5) * 0.8,
        vz: (Math.random() - 0.5) * 0.8,
        vy: 0.5,
        r: 0.1,
        life: 0.6,
        maxLife: 0.6,
      });
    }
  }

  spawnSparks(x, z, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        type: 'spark',
        x,
        z,
        y: 1.2,
        vx: Math.cos(a) * (1 + Math.random() * 2.4),
        vz: Math.sin(a) * (1 + Math.random() * 2.4),
        vy: 1.6 + Math.random() * 3.2,
        r: 0.06,
        life: 1.4 + Math.random(),
        maxLife: 2.4,
      });
    }
  }

  // ── 상호작용 대상 찾기 ────────────────────
  findFocus() {
    const p = this.player;
    let best = null;
    let bestD = Infinity;
    const consider = (e, range, label) => {
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < range && d < bestD) {
        bestD = d;
        e.promptLabel = label;
        best = e;
      }
    };
    for (const n of this.world.npcs) consider(n, 2.4, '말 걸기');
    for (const c of this.world.critters) consider(c, 1.9, '쓰다듬기');
    for (const k of this.world.pickups) {
      if (k.taken || k.kind !== 'lantern') continue;
      consider(k, 1.9, '등불 줍기');
    }
    if (this.quest.carrying > 0) {
      const d = Math.hypot(p.x - GATE.x, p.z - GATE.z);
      if (d < 3.6 && d < bestD) {
        this.world.gate.promptLabel = '등불 걸기';
        best = this.world.gate;
        bestD = d;
      }
    }
    this.focus = best;
  }

  interact() {
    const d = this.dialogue;
    if (d.active) {
      if (d.charT < d.line.length) {
        d.charT = d.line.length; // 한 번 더 누르면 즉시 전체 표시
        return;
      }
      d.idx++;
      if (d.idx >= d.lines.length) {
        d.active = false;
        d.target = null;
      } else {
        d.line = d.lines[d.idx];
        d.charT = 0;
      }
      return;
    }

    const t = this.focus;
    if (!t) return;

    if (t.kind === 'npc') {
      const lines = this.quest.linesFor(t.npcId);
      d.active = true;
      d.target = t;
      d.name = NAME_BY_ID[t.npcId] || '주민';
      d.lines = lines;
      d.idx = 0;
      d.line = lines[0];
      d.charT = 0;
      this.quest.talkedTo.add(t.npcId);
    } else if (t.kind === 'critter') {
      d.active = true;
      d.target = t;
      d.name = CRITTER_NAME[t.type] || '숲 친구';
      d.lines = [CRITTER_LINE[t.type] || '…!'];
      d.idx = 0;
      d.line = d.lines[0];
      d.charT = 0;
      this.spawnSparks(t.x, t.z, 5);
    } else if (t.kind === 'lantern') {
      t.taken = true;
      this.quest.carrying++;
      this.toast(`등불을 주웠다  (들고 있음 ${this.quest.carrying})`);
      this.spawnSparks(t.x, t.z, 10);
      this.player.playEmote('cheer', 0.7);
    } else if (t.tag === 'gate') {
      this.quest.tryDeliver(this.player, this);
    }
  }

  // ── 업데이트 ─────────────────────────────
  update(dt) {
    const { input, cam, player } = this;
    this.time += dt;

    if (input.hit('escape')) {
      this.paused = !this.paused;
      pausedEl.hidden = !this.paused;
    }
    if (this.paused) {
      input.endFrame();
      return;
    }

    if (input.hit('f', 'enter')) this.interact();

    // 카메라 회전 / 줌
    if (input.down('q')) cam.orbit(-1.4 * dt);
    if (input.down('e')) cam.orbit(1.4 * dt);
    const drag = input.takeDrag();
    if (drag) cam.orbit(-drag * 0.004);
    if (input.down('z')) cam.zoom(-8 * dt);
    if (input.down('x')) cam.zoom(8 * dt);

    if (!this.dialogue.active) {
      player.update(dt, input, cam, this.world, this);
    } else {
      // 대화 중엔 타이핑만 진행
      this.dialogue.charT = Math.min(this.dialogue.line.length, this.dialogue.charT + dt * 42);
      player.anim = 'idle';
      const seq = player.set.idle;
      player.frame = Math.floor(this.time * 2) % seq.length;
    }

    updateVillagers(this.world, dt, player, this);
    updateCritters(this.world, dt, player);
    spawnAmbient(this, dt, this.dayT, player);

    // 도토리 자동 획득
    for (const k of this.world.pickups) {
      if (k.taken) continue;
      k.y = 0.22 + Math.sin(this.time * 2 + k.phase) * 0.1;
      if (k.kind === 'lantern') {
        const d = Math.hypot(k.x - player.x, k.z - player.z);
        if (d < 26 && Math.random() < dt * 1.1) {
          this.particles.push({
            type: 'spark',
            x: k.x + (Math.random() - 0.5) * 0.5,
            z: k.z + (Math.random() - 0.5) * 0.5,
            y: 0.5 + Math.random() * 0.5,
            vx: 0,
            vz: 0,
            vy: 0.5,
            r: 0.05,
            life: 1.1,
            maxLife: 1.1,
          });
        }
      }
      if (k.kind === 'acorn') {
        const d = Math.hypot(k.x - player.x, k.z - player.z);
        if (d < 0.95) {
          k.taken = true;
          this.quest.acorns++;
          this.spawnSparks(k.x, k.z, 6);
          this.toast(`도토리 ${this.quest.acorns}개째!`, 1.4);
        }
      }
    }

    this.quest.tryDeliver(player, this);
    this.findFocus();

    // 파티클
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      q.x += (q.vx || 0) * dt;
      q.z += (q.vz || 0) * dt;
      q.y += (q.vy || 0) * dt;
      if (q.type === 'spark') q.vy -= 5.5 * dt;
      if (q.type === 'leaf') {
        q.vx += Math.sin(this.time + q.rot) * 0.25 * dt;
        q.y = Math.max(0.02, q.y);
      }
      if (q.type === 'firefly') {
        q.vx += (Math.random() - 0.5) * 0.5 * dt;
        q.vz += (Math.random() - 0.5) * 0.5 * dt;
        q.vy += (Math.random() - 0.5) * 0.3 * dt;
        q.y = clamp(q.y, 0.25, 2.6);
      }
      if (q.life <= 0 || q.y < -0.5) this.particles.splice(i, 1);
    }

    // 시간대
    const target = this.quest.festival ? 0.95 : Math.min(0.42, 0.12 + this.time / 900);
    this.dayT = lerp(this.dayT, target, 1 - Math.exp(-(this.quest.festival ? 0.9 : 0.4) * dt));
    if (this.quest.festival) {
      this.quest.festivalT += dt;
      if (Math.random() < dt * 1.4) {
        const a = Math.random() * Math.PI * 2;
        this.spawnSparks(GATE.x + Math.cos(a) * 6, GATE.z + Math.sin(a) * 6, 8);
      }
    }

    if (this.toastMsg) {
      this.toastMsg.life -= dt;
      this.toastMsg.age += dt;
      if (this.toastMsg.life <= 0) this.toastMsg = null;
    }

    cam.follow(player.x, player.y, player.z, dt);
    cam.update(dt);
    input.endFrame();
  }

  // ── 렌더 ────────────────────────────────
  render() {
    const { scene, cam } = this;
    scene.drawSky(this.dayT, this.time);
    scene.drawGround(this.dayT);
    scene.drawDecals(this.world, this.time);

    const list = this.drawList;
    list.length = 0;
    scene.collect(this.world.props, list);
    scene.collect(this.world.npcs, list);
    scene.collect(this.world.critters, list);
    scene.collect(this.world.pickups, list);
    scene.collect([this.player], list);
    list.sort((a, b) => b._p.depth - a._p.depth);

    scene.applyOcclusionFade(list, this.player);
    scene.drawShadows(list, this.dayT);
    scene.drawEntities(list, this.time);
    scene.drawParticles(this.particles, this.time);
    scene.drawLighting(list, this.dayT, this.time);
    scene.drawPaper();

    drawHud(ctx, cam, this);
    drawPrompt(ctx, cam, this);
    drawDialogue(ctx, cam, this);
    drawToast(ctx, cam, this);
    drawFestivalBanner(ctx, cam, this);
  }
}

const CRITTER_NAME = {
  chick: '삐약이',
  cloudSheep: '구름양',
  ghost: '수줍은 유령',
  robot: '고물 로봇',
  snail: '느림보 달팽이',
  bug: '숲벌레',
  spiky: '가시콩',
  mushroomFolk: '버섯족',
  worm: '지렁이',
};
const CRITTER_LINE = {
  chick: '삐약! 삐약!',
  cloudSheep: '메…에…  (구름이 폭신하다)',
  ghost: '으… 놀랐어? 미안…',
  robot: '삐-빅. 등불. 다섯. 개. 필요.',
  snail: '…느…리…게…  (한참 걸린다)',
  bug: '부웅— 하고 날아올랐다.',
  spiky: '가시가 따끔! 그래도 착한 애다.',
  mushroomFolk: '포자를 폴폴 뿌리며 인사했다.',
  worm: '꿈틀. 꿈틀.',
};

// ── 부팅 ──────────────────────────────────
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
  const assets = await bakeAll((label, p) => {
    loadingEl.textContent = `스케치 굽는 중… ${label} (${Math.round(p * 100)}%)`;
  });
  loadingEl.hidden = true;

  const game = new Game(assets);
  window.__bean = game; // 디버그용
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
    titleEl.hidden = true;
    game.running = true;
    game.toast('축제 등불 5개를 찾아 마을 문으로!', 3.4);
  };
  document.getElementById('btn-start').addEventListener('click', start);
  document.getElementById('btn-resume').addEventListener('click', () => {
    game.paused = false;
    pausedEl.hidden = true;
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
