// 주민 / 숲 친구들의 자율 행동
import { makeRng, noise1, clamp } from '../core/rng.js';

const rngA = makeRng(4242);

function pickTarget(e) {
  const a = rngA() * Math.PI * 2;
  const r = rngA() * e.wander;
  e.tx = e.home.x + Math.cos(a) * r;
  e.tz = e.home.z + Math.sin(a) * r;
  e.waitT = 0.8 + rngA() * 3.2;
}

export function updateVillagers(world, dt, player, game) {
  for (const e of world.npcs) {
    e.t += dt;
    const talking = game.dialogue.active && game.dialogue.target === e;

    if (e.state === 'sleep') {
      e.anim = 'idle';
      const seq = e.set.idle;
      e.frame = Math.floor(e.t * 0.9) % seq.length;
      e.currentSprite = seq[e.frame];
      e.alpha = 1;
      continue;
    }

    if (talking) {
      // 플레이어를 바라보고 말하는 모션
      e.flip = player.x - e.x < 0 ? false : true;
      const seq = e.set.talk || e.set.idle;
      e.currentSprite = seq[Math.floor(e.t * 6) % seq.length];
      continue;
    }

    if (e.celebrate) {
      const seq = e.set.cheer || e.set.idle;
      e.currentSprite = seq[0];
      e.y = Math.abs(Math.sin(e.t * 6)) * 0.28;
      continue;
    }

    if (e.tx == null || e.waitT == null) pickTarget(e);
    e.waitT -= dt;

    const dx = (e.tx ?? e.x) - e.x;
    const dz = (e.tz ?? e.z) - e.z;
    const d = Math.hypot(dx, dz);
    let moving = false;
    if (d > 0.25 && e.wander > 0.1) {
      const spd = 1.05;
      e.x += (dx / d) * spd * dt;
      e.z += (dz / d) * spd * dt;
      moving = true;
      e.flip = dx < 0;
    } else if (e.waitT <= 0) {
      pickTarget(e);
    }

    const seq = moving ? e.set.walk || e.set.idle : e.set.idle;
    const fps = moving ? 6.5 : 1.8;
    e.currentSprite = seq[Math.floor(e.t * fps) % seq.length];
    e.y = 0;
  }
}

export function updateCritters(world, dt, player) {
  for (const e of world.critters) {
    e.t += dt;
    if (e.tx == null) pickTarget(e);
    e.waitT -= dt;

    // 플레이어가 가까우면 도망 (겁 많은 친구들)
    const pdx = e.x - player.x;
    const pdz = e.z - player.z;
    const pd = Math.hypot(pdx, pdz);
    if (pd < 1.9 && e.type !== 'ghost' && e.type !== 'mushroomFolk') {
      e.x += (pdx / (pd || 1)) * e.speed * 1.8 * dt;
      e.z += (pdz / (pd || 1)) * e.speed * 1.8 * dt;
      e.flip = pdx < 0;
    } else {
      const dx = e.tx - e.x;
      const dz = e.tz - e.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.2) {
        e.x += (dx / d) * e.speed * dt;
        e.z += (dz / d) * e.speed * dt;
        e.flip = dx < 0;
      } else if (e.waitT <= 0) pickTarget(e);
    }

    e.y = e.hover ? e.hover + Math.sin(e.t * 1.6) * 0.16 : 0;
    e.currentSprite = e.set.idle[Math.floor(e.t * 2.4) % e.set.idle.length];
    e.h = e.set.height;
    e.shadow = e.hover ? 0.55 : 1;
  }
}

// 나뭇잎 / 반딧불이 같은 배경 파티클
export function spawnAmbient(game, dt, dayT, player) {
  game._leafT = (game._leafT || 0) + dt;
  if (game._leafT > 0.45) {
    game._leafT = 0;
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 12;
    game.particles.push({
      type: 'leaf',
      x: player.x + Math.cos(a) * r,
      z: player.z + Math.sin(a) * r,
      y: 4 + Math.random() * 3,
      vy: -0.5 - Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 0.6,
      vz: (Math.random() - 0.5) * 0.6,
      r: 0.09,
      rot: Math.random() * 6.28,
      spin: (Math.random() - 0.5) * 2,
      color: Math.random() < 0.5 ? '#d9a05b' : '#a9c97e',
      life: 9,
      maxLife: 9,
    });
  }

  if (dayT > 0.55) {
    game._flyT = (game._flyT || 0) + dt;
    if (game._flyT > 0.25 && game.particles.length < 260) {
      game._flyT = 0;
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 14;
      game.particles.push({
        type: 'firefly',
        x: player.x + Math.cos(a) * r,
        z: player.z + Math.sin(a) * r,
        y: 0.4 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.2,
        vz: (Math.random() - 0.5) * 0.35,
        r: 0.045,
        life: 7 + Math.random() * 5,
        maxLife: 12,
      });
    }
  }
}
