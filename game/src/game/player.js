// 플레이어 콩 — 3D 공간에서 움직이고, 2D 손그림 프레임으로 표현된다.
import { clamp } from '../core/rng.js';
import { POND } from '../world/world.js';

const GRAVITY = 15.5;
const JUMP_V = 5.4;
const WALK = 3.5;
const RUN = 6.2;

export class Player {
  constructor(set, x = 0, z = 21) {
    this.set = set;
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.r = 0.36;
    this.h = 1.5;
    this.flip = false;
    this.anim = 'idle';
    this.animT = 0;
    this.frame = 0;
    this.grounded = true;
    this.speed = 0;
    this.inWater = false;
    this.emoteT = 0;
    this.emote = null;
    this.shadow = 1;
    this.kind = 'player';
    this.phase = 0;
    this.sway = 0;
  }

  get currentSprite() {
    const s = this.set;
    const seq = s[this.anim] || s.idle;
    return seq[this.frame % seq.length];
  }

  playEmote(name, dur = 1.1) {
    this.emote = name;
    this.emoteT = dur;
  }

  update(dt, input, cam, world, game) {
    const ax = input.moveAxis();
    const b = cam.groundBasis();
    let dx = b.rx * ax.x + b.fx * ax.z;
    let dz = b.rz * ax.x + b.fz * ax.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.001) {
      dx /= len;
      dz /= len;
    }

    const running = input.down('shift');
    let spd = (running ? RUN : WALK) * (len > 0.01 ? 1 : 0);

    // 연못은 느리다
    this.inWater = Math.hypot(this.x - POND.x, this.z - POND.z) < POND.r - 0.3;
    if (this.inWater) spd *= 0.55;

    const nx = this.x + dx * spd * dt;
    const nz = this.z + dz * spd * dt;
    this.x = nx;
    this.z = nz;
    this.speed = spd;

    // 점프
    if (input.hit(' ') && this.grounded && !this.inWater) {
      this.vy = JUMP_V;
      this.grounded = false;
      game.spawnDust(this.x, this.z, 5);
    }
    if (!this.grounded || this.y > 0) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        if (!this.grounded) game.spawnDust(this.x, this.z, 7);
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }

    this.resolveCollisions(world);
    this.clampToWorld(world);

    // 바라보는 방향 (화면 기준 좌우)
    if (len > 0.01) {
      const screenDir = dx * b.rx + dz * b.rz;
      if (Math.abs(screenDir) > 0.12) this.flip = screenDir < 0;
    }

    // 애니메이션 선택
    let anim = 'idle';
    if (!this.grounded) anim = this.vy > 0 ? 'jump' : 'fall';
    else if (spd > 0.1) anim = 'walk';
    if (game.dialogue.active && spd < 0.1 && this.grounded) anim = 'idle';
    if (this.emoteT > 0) {
      this.emoteT -= dt;
      if (this.emote === 'cheer') anim = 'cheer';
      if (this.emote === 'surprised') anim = 'surprised';
    }

    if (anim !== this.anim) {
      this.anim = anim;
      this.animT = 0;
      this.frame = 0;
    }
    const fps = anim === 'walk' ? (running ? 11 : 7.5) : 2.2;
    this.animT += dt * fps;
    const seq = this.set[this.anim] || this.set.idle;
    this.frame = Math.floor(this.animT) % seq.length;

    // 물 튀김 / 발자국 먼지
    if (spd > 0.1 && this.grounded) {
      this._stepT = (this._stepT || 0) + dt * spd;
      if (this._stepT > 1.4) {
        this._stepT = 0;
        if (this.inWater) game.spawnSplash(this.x, this.z, 3);
        else if (running) game.spawnDust(this.x, this.z, 2);
      }
    }
  }

  resolveCollisions(world) {
    for (const e of world.props) {
      if (!e.r) continue;
      const dx = this.x - e.x;
      const dz = this.z - e.z;
      const min = e.r + this.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (min - d) / d;
        this.x += dx * push;
        this.z += dz * push;
      }
    }
    for (const n of world.npcs) {
      const dx = this.x - n.x;
      const dz = this.z - n.z;
      const min = n.r + this.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (min - d) / d;
        this.x += dx * push * 0.6;
        this.z += dz * push * 0.6;
        n.x -= dx * push * 0.4;
        n.z -= dz * push * 0.4;
      }
    }
  }

  clampToWorld(world) {
    const d = Math.hypot(this.x, this.z);
    const lim = world.radius - 3;
    if (d > lim) {
      this.x = (this.x / d) * lim;
      this.z = (this.z / d) * lim;
    }
  }
}
