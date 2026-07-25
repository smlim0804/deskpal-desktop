// 씬 렌더러 — 2D 손그림 스프라이트를 3D 카메라 공간에 배치해서 그린다.
import { bake, shape, line, ellipse, makePaperTile, INK } from '../core/sketch.js';
import { cloudSilhouette } from '../art/nature.js';
import { P, skyColors, hexToRgb } from '../art/palette.js';
import { makeRng, clamp, lerp, noise1 } from '../core/rng.js';

const MAX_DIST = 50; // 이보다 먼 건 안 그림
const FADE_START = 26;
const SMALL_PROP_DIST = 24; // 잔풀·꽃 같은 작은 것들의 표시 거리
const MIN_SCREEN_H = 3; // 화면에서 이보다 작아지면 생략

export class Scene {
  constructor(ctx, cam) {
    this.ctx = ctx;
    this.cam = cam;
    this.paper = makePaperTile(256, 7);
    this.paperPat = ctx.createPattern(this.paper, 'repeat');
    this.clouds = [0, 1, 2].map((i) => bakeCloud(400 + i * 97));
    this.treeline = bakeTreeline(777);
    this.sun = bakeSun(31);
    this.moon = bakeMoon(33);
    this._p = { x: 0, y: 0, scale: 0, depth: 0, visible: false };
    this._q = { x: 0, y: 0, scale: 0, depth: 0, visible: false };
    this.drawList = [];
  }

  _skyGradient(dayT, hy) {
    const key = `${Math.round(dayT * 60)}|${Math.round(hy)}|${this.cam.h}`;
    if (this._skyKey !== key) {
      const [top, low] = skyColors(dayT);
      const g = this.ctx.createLinearGradient(0, 0, 0, Math.max(hy, 40));
      g.addColorStop(0, top);
      g.addColorStop(1, low);
      this._skyKey = key;
      this._skyGrad = g;
    }
    return this._skyGrad;
  }

  // ── 하늘 ────────────────────────────────
  drawSky(dayT, time) {
    const { ctx, cam } = this;
    const hy = clamp(cam.horizonY(), -200, cam.h);
    const g = this._skyGradient(dayT, hy);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cam.w, hy + 4);

    // 해 / 달 — 카메라 회전에 따라 아주 느리게 움직여 원경 시차를 만든다
    const px = cam.w * 0.72 - cam.yaw * 260;
    const py = hy - 96 - Math.sin(dayT * Math.PI) * 46;
    const body = dayT < 0.55 ? this.sun : this.moon;
    ctx.save();
    ctx.globalAlpha = dayT < 0.55 ? 1 : clamp((dayT - 0.4) * 3, 0, 1);
    ctx.drawImage(body.canvas, px - 60, py - 60, 120, 120);
    ctx.restore();

    // 구름
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      const drift = ((time * (4 + i * 2) + i * 640) % (cam.w + 900)) - 450;
      const x = drift - cam.yaw * (120 + i * 60);
      const y = hy - 210 + i * 62 + Math.sin(time * 0.3 + i) * 5;
      ctx.save();
      ctx.globalAlpha = 0.85 - i * 0.12;
      ctx.drawImage(c.canvas, x, y, 300, 120);
      ctx.restore();
    }

    // 먼 숲 능선 (월드 밖 배경)
    const tw = 900;
    const off = ((-cam.yaw * 420) % tw + tw) % tw;
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = -1; i * tw - off < cam.w + tw; i++) {
      ctx.drawImage(this.treeline.canvas, i * tw - off, hy - 96, tw, 110);
    }
    ctx.restore();
  }

  drawGround(dayT) {
    const { ctx, cam } = this;
    const hy = clamp(cam.horizonY(), -200, cam.h);
    const key = `${Math.round(hy)}|${cam.h}`;
    if (this._groundKey !== key) {
      const g = ctx.createLinearGradient(0, Math.max(hy, 0), 0, cam.h);
      g.addColorStop(0, '#cfe0ad');
      g.addColorStop(0.35, P.grass);
      g.addColorStop(1, P.grassDark);
      this._groundKey = key;
      this._groundGrad = g;
    }
    ctx.fillStyle = this._groundGrad;
    ctx.fillRect(0, hy, cam.w, cam.h - hy);
  }

  // ── 바닥 데칼(길·연못·흙) ─────────────────
  drawDecals(world, time) {
    const { ctx, cam } = this;
    const p = this._p;
    for (const d of world.decals) {
      // 대충 컬링
      const dx = d.pts[0][0] - cam.px;
      const dz = d.pts[0][1] - cam.pz;
      if (dx * dx + dz * dz > MAX_DIST * MAX_DIST) continue;
      ctx.beginPath();
      let ok = false;
      for (let i = 0; i < d.pts.length; i++) {
        cam.project(d.pts[i][0], 0, d.pts[i][1], p);
        if (!p.visible) {
          ok = false;
          break;
        }
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        ok = true;
      }
      if (!ok) continue;
      ctx.closePath();
      if (d.fill) {
        ctx.fillStyle = d.fill;
        ctx.fill();
      }
      if (d.stroke) {
        ctx.strokeStyle = d.stroke;
        ctx.lineWidth = Math.max(0.8, d.width * (p.scale / 60));
        ctx.stroke();
      }
    }
    // 연못 물결
    const pond = world.pondCenter;
    if (pond) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        const rr = 1.2 + ((time * 0.5 + i * 0.9) % 4.4);
        const a0 = 0;
        ctx.beginPath();
        for (let s = 0; s <= 20; s++) {
          const a = a0 + (s / 20) * Math.PI * 2;
          cam.project(pond.x + Math.cos(a) * rr, 0.02, pond.z + Math.sin(a) * rr * 0.9, this._q);
          if (!this._q.visible) break;
          s === 0 ? ctx.moveTo(this._q.x, this._q.y) : ctx.lineTo(this._q.x, this._q.y);
        }
        ctx.globalAlpha = 0.35 * (1 - rr / 5.6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ── 엔티티 수집 & 정렬 ────────────────────
  collect(entities, out) {
    const { cam } = this;
    for (const e of entities) {
      if (e.taken) continue;
      const dx = e.x - cam.px;
      const dz = e.z - cam.pz;
      const d2 = dx * dx + dz * dz;
      const limit = e.h < 0.9 ? SMALL_PROP_DIST : MAX_DIST;
      if (d2 > limit * limit) continue;
      const p = cam.project(e.x, e.y || 0, e.z, e._proj || (e._proj = {}));
      if (!p.visible) continue;
      const sh = e.h * p.scale;
      if (sh < MIN_SCREEN_H) continue;
      // 화면 밖 컬링
      const halfW = sh * 1.2;
      if (p.x + halfW < -40 || p.x - halfW > cam.w + 40 || p.y - sh * 1.6 > cam.h + 40) continue;
      e._p = p;
      e._sh = sh;
      out.push(e);
    }
  }

  // 플레이어를 가리는 앞쪽 나무/건물은 반투명하게 — 시야 확보 + 입체감
  applyOcclusionFade(list, player) {
    const pp = player._p;
    if (!pp) return;
    const pw = player._sh * 0.34;
    const pTop = pp.y - player._sh;
    for (const e of list) {
      e.alpha = 1;
      if (e === player || e.h < 1.6 || e.noFade) continue;
      if (e.kind !== 'prop' && e.kind !== 'npc') continue;
      if (e._p.depth >= pp.depth - 0.35) continue;
      const sp = e.currentSprite || e.sprite;
      if (!sp) continue;
      const sw = e._sh * sp.aspect;
      const left = e._p.x - sw * sp.ax;
      const right = left + sw;
      const top = e._p.y - e._sh * sp.ay;
      const bottom = top + e._sh;
      if (right < pp.x - pw || left > pp.x + pw) continue;
      if (bottom < pTop || top > pp.y) continue;
      e.alpha = 0.4;
    }
  }

  drawShadows(list, dayT) {
    const { ctx, cam } = this;
    const alphaBase = lerp(0.32, 0.14, dayT);
    ctx.save();
    for (const e of list) {
      if (e.shadow === 0) continue;
      const p = e._p;
      const groundP = e.y ? cam.project(e.x, 0, e.z, this._q) : p;
      if (!groundP.visible) continue;
      const r = (e.shadowR || Math.max(0.28, (e.r || 0.35) * 1.25)) * groundP.scale;
      if (r < 2.2) continue;
      const lift = e.y ? clamp(1 - e.y * 0.45, 0.45, 1) : 1;
      ctx.globalAlpha = alphaBase * (e.shadow ?? 1) * lift * fadeFor(p.depth);
      ctx.fillStyle = P.shadow;
      ctx.beginPath();
      ctx.ellipse(groundP.x, groundP.y, r * lift, r * cam.groundSquash * lift, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEntities(list, time) {
    const { ctx } = this;
    for (const e of list) {
      const p = e._p;
      const sp = e.currentSprite || e.sprite;
      if (!sp) continue;
      const alpha = fadeFor(p.depth) * (e.alpha ?? 1);
      if (alpha <= 0.02) continue;
      let shear = 0;
      if (e.sway) {
        shear = Math.sin(time * 1.5 + e.phase) * 0.02 * e.sway + noise1(time * 0.4 + e.phase, 2) * 0.012 * e.sway;
      }
      blit(ctx, sp, p.x, p.y, e._sh, alpha, e.flip, shear);
    }
  }

  // 밤 + 광원
  drawLighting(list, dayT, time) {
    const { ctx, cam } = this;
    const night = clamp((dayT - 0.4) / 0.6, 0, 1);
    if (night <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(62,80,146,${0.8 * night})`;
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of list) {
      if (!e.glow) continue;
      const p = e._p;
      const flick = 0.85 + Math.sin(time * 7 + e.phase * 3) * 0.08 + noise1(time * 3 + e.phase, 5) * 0.12;
      const r = Math.min(cam.h * 0.5, (e.glowR || 2.6) * p.scale * flick);
      const gy = p.y - e._sh * (e.glowY ?? 0.72);
      const g = ctx.createRadialGradient(p.x, gy, 0, p.x, gy, r);
      g.addColorStop(0, `rgba(255,226,158,${0.42 * night * Math.min(1, e.glow)})`);
      g.addColorStop(0.42, `rgba(255,198,116,${0.14 * night * Math.min(1, e.glow)})`);
      g.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawParticles(particles, time) {
    const { ctx, cam } = this;
    const p = this._p;
    ctx.save();
    for (const q of particles) {
      cam.project(q.x, q.y, q.z, p);
      if (!p.visible) continue;
      const alpha = q.life / q.maxLife;
      const r = q.r * p.scale;
      if (q.type === 'firefly') {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.5);
        g.addColorStop(0, `rgba(255,240,170,${0.9 * alpha})`);
        g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (q.type === 'leaf') {
        ctx.globalAlpha = alpha * fadeFor(p.depth);
        ctx.fillStyle = q.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(q.rot + time * q.spin);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.6, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (q.type === 'splash' || q.type === 'dust') {
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = q.type === 'splash' ? '#7fb9c8' : 'rgba(120,110,90,0.8)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * (1.6 - alpha), 0, Math.PI * 2);
        ctx.stroke();
      } else if (q.type === 'spark') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffd98a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // 종이 질감 + 비네트 — 매 프레임 합성하면 비싸서 한 장으로 미리 구워 둔다
  _overlay() {
    const { cam } = this;
    const key = `${cam.w}x${cam.h}`;
    if (this._ovKey === key) return this._ov;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cam.w));
    c.height = Math.max(1, Math.round(cam.h));
    const g2 = c.getContext('2d');
    // 종이결 — 어두운 반투명 노이즈로 만들어 두면 곱하기 합성 없이 한 번에 얹을 수 있다
    const rng = makeRng(19);
    const img = g2.createImageData(c.width, c.height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = rng();
      data[i] = 96;
      data[i + 1] = 86;
      data[i + 2] = 68;
      data[i + 3] = n < 0.55 ? 0 : Math.floor(n * 26);
    }
    g2.putImageData(img, 0, 0);
    // 가로 결
    g2.globalAlpha = 0.05;
    g2.strokeStyle = '#6b5f4a';
    for (let i = 0; i < c.height / 6; i++) {
      const y = rng() * c.height;
      g2.beginPath();
      g2.moveTo(0, y);
      g2.lineTo(c.width, y + (rng() - 0.5) * 8);
      g2.stroke();
    }
    g2.globalAlpha = 1;
    const rg = g2.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.35, c.width / 2, c.height / 2, c.height * 0.9);
    rg.addColorStop(0, 'rgba(60,50,40,0)');
    rg.addColorStop(1, 'rgba(60,50,40,0.34)');
    g2.fillStyle = rg;
    g2.fillRect(0, 0, c.width, c.height);
    this._ovKey = key;
    this._ov = c;
    return c;
  }

  drawPaper() {
    const { ctx, cam } = this;
    ctx.drawImage(this._overlay(), 0, 0, cam.w, cam.h);
  }
}

export function fadeFor(depth) {
  if (depth < FADE_START) return 1;
  return clamp(1 - (depth - FADE_START) / (MAX_DIST - FADE_START), 0, 1) * 0.95 + 0.05;
}

// 기울임(바람)까지 지원하는 스프라이트 blit
export function blit(ctx, sp, sx, sy, screenH, alpha = 1, flip = false, shear = 0) {
  if (!sp || screenH <= 0.5) return;
  const screenW = screenH * sp.aspect;
  const x = -screenW * sp.ax;
  const y = -screenH * sp.ay;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(sx, sy);
  if (shear) ctx.transform(1, 0, shear, 1, 0, 0);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(sp.canvas, flip ? -screenW - x : x, y, screenW, screenH);
  ctx.restore();
}

// ── 배경 소품 굽기 ──────────────────────────
function bakeCloud(seed) {
  return bake({
    w: 300,
    h: 120,
    seed,
    ss: 1.2,
    pad: 6,
    ay: 0.5,
    draw: (ctx, rng) => {
      const pts = cloudSilhouette(150, 66, 132, 42, rng, 6, 0.75);
      shape(ctx, pts, {
        rng,
        fill: 'rgba(255,255,255,0.94)',
        stroke: 'rgba(51,48,43,0.45)',
        width: 2.2,
        rough: 1.4,
      });
    },
  });
}

function bakeTreeline(seed) {
  return bake({
    w: 900,
    h: 110,
    seed,
    ss: 1,
    pad: 0,
    ay: 1,
    draw: (ctx, rng) => {
      ctx.fillStyle = '#9dbb96';
      ctx.strokeStyle = 'rgba(51,48,43,0.5)';
      ctx.lineWidth = 1.4;
      for (let x = -20; x < 920; x += 16 + rng() * 12) {
        const h = 40 + rng() * 62;
        const w = 12 + rng() * 12;
        ctx.beginPath();
        ctx.moveTo(x - w, 110);
        for (let i = 0; i < 4; i++) {
          const t = i / 4;
          ctx.lineTo(x - w * (1 - t) * 0.9, 110 - h * t);
          ctx.lineTo(x - w * (1 - t) * 0.55, 110 - h * (t + 0.12));
        }
        ctx.lineTo(x, 110 - h);
        for (let i = 3; i >= 0; i--) {
          const t = i / 4;
          ctx.lineTo(x + w * (1 - t) * 0.55, 110 - h * (t + 0.12));
          ctx.lineTo(x + w * (1 - t) * 0.9, 110 - h * t);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    },
  });
}

function bakeSun(seed) {
  return bake({
    w: 120,
    h: 120,
    seed,
    ss: 1.4,
    pad: 4,
    ax: 0.5,
    ay: 0.5,
    draw: (ctx, rng) => {
      ellipse(ctx, 60, 60, 30, 30, { rng, fill: '#fbe6a2', width: 2.4, stroke: 'rgba(51,48,43,0.55)' });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        line(ctx, 60 + Math.cos(a) * 36, 60 + Math.sin(a) * 36, 60 + Math.cos(a) * 48, 60 + Math.sin(a) * 48, {
          rng,
          width: 2,
          stroke: 'rgba(51,48,43,0.4)',
        });
      }
    },
  });
}

function bakeMoon(seed) {
  return bake({
    w: 120,
    h: 120,
    seed,
    ss: 1.4,
    pad: 4,
    ax: 0.5,
    ay: 0.5,
    draw: (ctx, rng) => {
      ellipse(ctx, 60, 60, 28, 28, { rng, fill: '#f4f1dd', width: 2.2, stroke: 'rgba(51,48,43,0.5)' });
      ellipse(ctx, 52, 52, 7, 6, { rng, fill: 'rgba(190,190,175,0.7)', width: 1.2 });
      ellipse(ctx, 68, 66, 5, 4.4, { rng, fill: 'rgba(190,190,175,0.7)', width: 1.2 });
      ellipse(ctx, 58, 72, 4, 3.4, { rng, fill: 'rgba(190,190,175,0.7)', width: 1.2 });
    },
  });
}
