// 씬 렌더러 — 2D 손그림 스프라이트를 3D 카메라 공간에 배치해서 그린다.
import { bake, shape, line, ellipse, makePaperTile, INK } from '../core/sketch.js';
import { cloudSilhouette } from '../art/backdrop.js';
import { instantiate, drawInstance } from './mesh3d.js';
import { P, skyColors, hexToRgb } from '../art/palette.js';
import { makeRng, clamp, lerp, noise1 } from '../core/rng.js';
import { Terrain, heightAt, WATER_Y } from '../world/terrain.js';
import { isInk, isValheim, tone, valheimGround, Theme, FOG } from '../core/theme.js';
import { bakeImpostorSet } from './mesh3d.js';

const MAX_DIST = 50; // 이보다 먼 건 안 그림
const FADE_START = 26;
const SMALL_PROP_DIST = 18; // 잔풀·꽃 같은 작은 것들의 표시 거리
const NEAR_3D = 22; // 이 안쪽은 진짜 폴리곤, 바깥은 미리 구운 임포스터
const MIN_SCREEN_H = 4; // 화면에서 이보다 작아지면 생략

export class Scene {
  constructor(ctx, cam) {
    this.ctx = ctx;
    this.cam = cam;
    this.paper = makePaperTile(256, 7);
    this.paperPat = ctx.createPattern(this.paper, 'repeat');
    this.bg = { color: null, ink: null };
    this.terrain = new Terrain();
    this._p = { x: 0, y: 0, scale: 0, depth: 0, visible: false };
    this._q = { x: 0, y: 0, scale: 0, depth: 0, visible: false };
    this.drawList = [];
  }

  // 하늘 소품은 스타일마다 한 벌씩 (색이 구워져 들어가므로)
  backdrop() {
    const key = isInk() ? 'ink' : isValheim() ? 'valheim' : 'color';
    if (!this.bg[key]) {
      const v = key === 'valheim';
      this.bg[key] = {
        clouds: [0, 1, 2].map((i) => bakeCloud(400 + i * 97, v)),
        treeline: bakeTreeline(777, v),
        sun: bakeSun(31, v),
        moon: bakeMoon(33, v),
      };
    }
    return this.bg[key];
  }

  _skyGradient(dayT, hy) {
    const key = `${Math.round(dayT * 60)}|${Math.round(hy)}|${this.cam.h}|${Theme.version}`;
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
    // 발헤임의 해는 시간이 갈수록 지평선으로 떨어진다(해질녘 = 능선에 걸린 황금빛)
    let py;
    const valSun = isValheim() && dayT < 0.55;
    if (valSun) {
      const elev = clamp(1 - dayT * 1.55, 0.06, 1);
      py = hy - 26 - elev * 150;
    } else {
      py = hy - 96 - Math.sin(dayT * Math.PI) * 46;
    }
    const bg = this.backdrop();
    const body = dayT < 0.55 ? bg.sun : bg.moon;
    const bodySize = isValheim() && dayT >= 0.55 ? 150 : 120;
    ctx.save();
    ctx.globalAlpha = dayT < 0.55 ? 1 : clamp((dayT - 0.4) * 3, 0, 1);
    ctx.drawImage(body.canvas, px - bodySize / 2, py - bodySize / 2, bodySize, bodySize);
    ctx.restore();
    this._sunX = px;
    this._sunY = py;

    // 구름
    for (let i = 0; i < bg.clouds.length; i++) {
      const c = bg.clouds[i];
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
    if (isValheim()) {
      // 두 겹의 침엽수 능선 — 뒤 능선은 안개에 잠겨 옅다
      const off2 = ((-cam.yaw * 230) % tw + tw) % tw;
      ctx.globalAlpha = 0.3;
      for (let i = -1; i * tw - off2 < cam.w + tw; i++) {
        ctx.drawImage(bg.treeline.canvas, i * tw - off2 + 330, hy - 128, tw * 1.25, 128);
      }
      ctx.globalAlpha = 0.62;
      for (let i = -1; i * tw - off < cam.w + tw; i++) {
        ctx.drawImage(bg.treeline.canvas, i * tw - off, hy - 96, tw, 110);
      }
      // 지평선 안개띠 — 능선 밑동이 안개에 녹아들게 (밤에는 안개도 어두워진다)
      const nightK = clamp((dayT - 0.4) / 0.6, 0, 1);
      const fr = FOG[0] + (26 - FOG[0]) * nightK;
      const fgc = FOG[1] + (37 - FOG[1]) * nightK;
      const fb = FOG[2] + (48 - FOG[2]) * nightK;
      const fg = ctx.createLinearGradient(0, hy - 130, 0, hy + 4);
      fg.addColorStop(0, `rgba(${fr | 0},${fgc | 0},${fb | 0},0)`);
      fg.addColorStop(1, `rgba(${fr | 0},${fgc | 0},${fb | 0},0.85)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = fg;
      ctx.fillRect(0, hy - 130, cam.w, 134);

      // 밤하늘 별 — 위쪽 하늘에 옅게 뿌린다
      if (nightK > 0.15) {
        if (!this._stars) {
          const rng = makeRng(521);
          this._stars = Array.from({ length: 130 }, () => ({
            x: rng() * 2200,
            k: rng(), // 높이 비율
            a: 0.25 + rng() * 0.5,
            s: rng() < 0.18 ? 2 : 1.3,
          }));
        }
        ctx.fillStyle = '#d4dde8';
        const span = 2200;
        for (const st of this._stars) {
          const sx = (((st.x - cam.yaw * 300) % span) + span) % span - 100;
          if (sx < -4 || sx > cam.w + 4) continue;
          const sy = 2 + Math.max(24, hy - 60) * st.k;
          ctx.globalAlpha = st.a * nightK;
          ctx.fillRect(sx, sy, st.s, st.s);
        }
        ctx.globalAlpha = 1;
        // 달무리
        const mg = ctx.createRadialGradient(this._sunX, this._sunY, 8, this._sunX, this._sunY, 110);
        mg.addColorStop(0, `rgba(214,226,240,${0.22 * nightK})`);
        mg.addColorStop(1, 'rgba(214,226,240,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = mg;
        ctx.fillRect(this._sunX - 110, this._sunY - 110, 220, 220);
        ctx.globalCompositeOperation = 'source-over';
      }

      // 해 글로우 — 안개띠 위에 얹어 "안개를 뚫고 번지는 빛"으로 보이게. 해질녘엔 크고 진한 황금빛
      if (dayT < 0.62) {
        const dusk = clamp(1 - Math.abs(dayT - 0.5) / 0.2, 0, 1);
        const a = 0.3 + dusk * 0.28;
        const r = cam.h * (0.45 + dusk * 0.38);
        ctx.globalCompositeOperation = 'lighter';
        const g2 = ctx.createRadialGradient(this._sunX, this._sunY, 0, this._sunX, this._sunY, r);
        g2.addColorStop(0, `rgba(255,${217 - dusk * 47},${160 - dusk * 75},${a})`);
        g2.addColorStop(0.4, `rgba(255,${198 - dusk * 46},${132 - dusk * 58},${a * 0.42})`);
        g2.addColorStop(1, 'rgba(255,180,110,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(this._sunX - r, this._sunY - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      ctx.globalAlpha = 0.55;
      for (let i = -1; i * tw - off < cam.w + tw; i++) {
        ctx.drawImage(bg.treeline.canvas, i * tw - off, hy - 96, tw, 110);
      }
    }
    ctx.restore();
  }

  drawGround(dayT) {
    const { ctx, cam } = this;
    const hy = clamp(cam.horizonY(), -200, cam.h);
    const key = `${Math.round(hy)}|${cam.h}|${Theme.version}`;
    if (this._groundKey !== key) {
      const g = ctx.createLinearGradient(0, Math.max(hy, 0), 0, cam.h);
      if (isInk()) {
        g.addColorStop(0, '#f4f2ec');
        g.addColorStop(0.35, '#f7f5ef');
        g.addColorStop(1, '#f2efe7');
      } else if (isValheim()) {
        // 지평선은 안개색, 발치는 이끼빛 — 원경 지형 셀이 이 위로 페이드된다
        g.addColorStop(0, `rgb(${FOG[0]},${FOG[1]},${FOG[2]})`);
        g.addColorStop(0.42, '#95a189');
        g.addColorStop(1, '#75895c');
      } else {
        g.addColorStop(0, '#cfe0ad');
        g.addColorStop(0.35, P.grass);
        g.addColorStop(1, P.grassDark);
      }
      this._groundKey = key;
      this._groundGrad = g;
    }
    ctx.fillStyle = this._groundGrad;
    ctx.fillRect(0, hy, cam.w, cam.h - hy);
    // 진짜 지형 메시
    return this.terrain.draw(ctx, cam);
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
      if (!d.hs) {
        d.hs = d.pts.map((q) => heightAt(q[0], q[1]) + 0.035);
      }
      ctx.beginPath();
      let ok = false;
      for (let i = 0; i < d.pts.length; i++) {
        cam.project(d.pts[i][0], d.hs[i], d.pts[i][1], p);
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
        ctx.fillStyle = isValheim() ? valheimGround(d.fill) : tone(d.fill);
        ctx.fill();
      }
      if (d.stroke) {
        ctx.strokeStyle = d.stroke;
        ctx.lineWidth = Math.max(0.8, d.width * (p.scale / 60));
        ctx.stroke();
      }
    }
  }

  drawWater(time) {
    this.terrain.drawWater(this.ctx, this.cam, time);
  }

  // ── 발헤임 스타일 대기 ────────────────────
  /** 밤이 되면 안개도 어두워진다 — 대기 요소가 공유하는 안개색 */
  _fogRGB(dayT) {
    const n = clamp((dayT - 0.4) / 0.6, 0, 1);
    return [
      (FOG[0] + (26 - FOG[0]) * n) | 0,
      (FOG[1] + (37 - FOG[1]) * n) | 0,
      (FOG[2] + (48 - FOG[2]) * n) | 0,
      1 - 0.4 * n, // 알파 배율 — 밤 안개는 옅게
    ];
  }

  /** 땅 위를 기는 안개 뭉치 — 오브젝트보다 먼저 그려 뒤에 깔린다 */
  drawMist(time, dayT = 0.2) {
    if (!isValheim()) return;
    const { ctx, cam } = this;
    const [mr, mg2, mb, mk] = this._fogRGB(dayT);
    if (!this._mist) {
      const rng = makeRng(83);
      const spots = [];
      for (let i = 0; i < 14; i++) {
        const a = rng() * Math.PI * 2;
        const r = 15 + rng() * 21;
        spots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: 3.2 + rng() * 4.5, ph: rng() * 9 });
      }
      // 연못가에도 두엇
      spots.push({ x: 15.5, z: 7.5, r: 5.2, ph: 2 });
      spots.push({ x: 12.5, z: 11.5, r: 3.6, ph: 5 });
      this._mist = spots;
    }
    const p = this._p;
    ctx.save();
    for (const s of this._mist) {
      const x = s.x + Math.sin(time * 0.045 + s.ph) * 2.6;
      const z = s.z + Math.cos(time * 0.038 + s.ph * 1.7) * 2.0;
      cam.project(x, heightAt(x, z) + 0.5, z, p);
      if (!p.visible || p.depth < 6) continue;
      const r = Math.min(cam.h * 0.45, s.r * p.scale);
      if (r < 8) continue;
      const breathe = (0.75 + 0.25 * Math.sin(time * 0.11 + s.ph * 2.3)) * mk;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(${mr},${mg2},${mb},${0.2 * breathe})`);
      g.addColorStop(0.6, `rgba(${mr},${mg2},${mb},${0.1 * breathe})`);
      g.addColorStop(1, `rgba(${mr},${mg2},${mb},0)`);
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.36);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** 화면 공간 높이 안개 — 지평선 부근(=먼 곳)일수록 안개색에 잠긴다 */
  drawAtmosphere(dayT = 0.2) {
    if (!isValheim()) return;
    const { ctx, cam } = this;
    const hy = clamp(cam.horizonY(), -200, cam.h);
    const [fr, fg, fb, fk] = this._fogRGB(dayT);
    const key = `${Math.round(hy)}|${cam.w}x${cam.h}|${fr}|${Math.round(fk * 20)}`;
    if (this._atmoKey !== key) {
      const top = hy - 150;
      const bot = hy + cam.h * 0.5;
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, `rgba(${fr},${fg},${fb},0)`);
      g.addColorStop(clamp((hy - top) / (bot - top), 0.05, 0.95), `rgba(${fr},${fg},${fb},${0.4 * fk})`);
      g.addColorStop(1, `rgba(${fr},${fg},${fb},0)`);
      this._atmoKey = key;
      this._atmoGrad = g;
      this._atmoTop = top;
      this._atmoBot = bot;
    }
    ctx.fillStyle = this._atmoGrad;
    ctx.fillRect(0, this._atmoTop, cam.w, this._atmoBot - this._atmoTop);

    // 해질녘 황금빛 — 장면 전체에 따뜻한 기운을 얹는다
    const dusk = clamp(1 - Math.abs(dayT - 0.5) / 0.16, 0, 1);
    if (dusk > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = `rgba(255,152,84,${0.2 * dusk})`;
      ctx.fillRect(0, 0, cam.w, cam.h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,140,60,${0.05 * dusk})`;
      ctx.fillRect(0, 0, cam.w, cam.h);
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
      const halfW = e.model ? Math.max(e.r, e.shadowR || 0.4, 0.4) * p.scale * 1.6 : sh * 1.2;
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
      if (e === player || e.h < 1.6) continue;
      if (e.kind !== 'prop' && e.kind !== 'npc') continue;
      // 카메라 코앞을 막아선 물체는 사라지듯 흐려진다(거대한 실루엣이 화면을 덮는 걸 방지).
      // 가로등처럼 noFade 인 것도 여기서는 예외가 아니다 — 안 그러면 화면 구석이 새까매진다.
      if (e._sh > this.cam.h * 0.95) {
        e.alpha = 0;
        continue;
      }
      if (e.noFade) continue;
      if (e._p.depth >= pp.depth - 0.35) continue;
      let left;
      let right;
      let top;
      let bottom;
      if (e.model) {
        const hw = Math.max(e.shadowR || 0.5, 0.5) * e._p.scale;
        left = e._p.x - hw;
        right = e._p.x + hw;
        top = e._p.y - e._sh;
        bottom = e._p.y;
      } else {
        const sp = e.currentSprite || e.sprite;
        if (!sp) continue;
        const sw = e._sh * sp.aspect;
        left = e._p.x - sw * sp.ax;
        right = left + sw;
        top = e._p.y - e._sh * sp.ay;
        bottom = top + e._sh;
      }
      if (right < pp.x - pw || left > pp.x + pw) continue;
      if (bottom < pTop || top > pp.y) continue;
      // 가까울수록 더 투명 (코앞이면 거의 사라짐)
      e.alpha = clamp((e._p.depth - 3.5) / 5, 0, 1) * 0.2 + 0.05;
    }
  }

  drawShadows(list, dayT) {
    const { ctx, cam } = this;
    const alphaBase = lerp(0.32, 0.14, dayT);
    ctx.save();
    for (const e of list) {
      if (e.shadow === 0) continue;
      const p = e._p;
      const gy = e.gy ?? 0;
      const groundP = e.y !== gy ? cam.project(e.x, gy, e.z, this._q) : p;
      if (!groundP.visible) continue;
      const r = (e.shadowR || Math.max(0.28, (e.r || 0.35) * 1.25)) * groundP.scale;
      if (r < 2.0) continue;
      const air = Math.max(0, (e.y ?? 0) - gy);
      const lift = clamp(1 - air * 0.45, 0.45, 1);
      const fade = fadeFor(p.depth);
      // 넓고 옅은 바깥 그림자 — 물체가 땅에 "놓인" 느낌
      ctx.globalAlpha = alphaBase * 0.42 * (e.shadow ?? 1) * lift * fade;
      ctx.fillStyle = isValheim() ? '#232e38' : P.shadow;
      ctx.beginPath();
      ctx.ellipse(groundP.x, groundP.y, r * 1.75 * lift, r * 1.75 * cam.groundSquash * lift, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alphaBase * (e.shadow ?? 1) * lift * fade;
      ctx.beginPath();
      ctx.ellipse(groundP.x, groundP.y, r * lift, r * cam.groundSquash * lift, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEntities(list, time) {
    const { ctx, cam } = this;
    let faces = 0;
    for (const e of list) {
      const p = e._p;
      const alpha = fadeFor(p.depth) * (e.alpha ?? 1);
      if (alpha <= 0.02) continue;
      // 바람에 흔들리는 정도(화면 기준 기울임)
      let shear = 0;
      if (e.sway) {
        shear = Math.sin(time * 1.5 + e.phase) * 0.02 * e.sway + noise1(time * 0.4 + e.phase, 2) * 0.012 * e.sway;
      }

      if (e.model) {
        const model = e.litModel && e.lit ? e.litModel : e.model;
        const useMesh = p.depth < NEAR_3D || (Theme.mode === 'color' && !model.imp);
        ctx.save();
        if (shear) {
          ctx.translate(p.x, p.y);
          ctx.transform(1, 0, shear, 1, 0, 0);
          ctx.translate(-p.x, -p.y);
        }
        if (useMesh) {
          // 흔들리거나(픽업) 회전이 바뀌면 다시 굽는다
          const gy = e.gy ?? 0;
          if (!e._inst || e._instModel !== model || e._inst.themeVersion !== Theme.version) {
            e._inst = instantiate(model, { x: e.x, y: gy, z: e.z, ry: e.ry || 0, scale: e.scale || 1 });
            e._instModel = model;
          }
          if (e.y !== gy) {
            // 위아래로 떠 있는 오브젝트는 화면상 평행이동으로 근사
            cam.project(e.x, gy, e.z, this._q);
            ctx.translate(0, p.y - this._q.y);
          }
          faces += drawInstance(ctx, cam, e._inst, { alpha, lineScale: 1 });
        } else {
          let set;
          if (isInk()) set = model.impInk || (model.impInk = bakeImpostorSet(model, { ppu: 30 }));
          else if (isValheim()) set = model.impVal || (model.impVal = bakeImpostorSet(model, { ppu: 30 }));
          else set = model.imp;
          const sp = set.pick(cam.yaw);
          const h = sp.unitsTall * p.scale * (e.scale || 1);
          const w = h * sp.aspect;
          ctx.globalAlpha = alpha;
          ctx.drawImage(sp.canvas, p.x - w * sp.ax, p.y - h * sp.ay, w, h);
        }
        ctx.restore();
        continue;
      }

      const sp = e.currentSprite || e.sprite;
      if (!sp) continue;
      blit(ctx, sp, p.x, p.y, e._sh, alpha, e.flip, shear);
    }
    return faces;
  }

  // 밤 + 광원
  drawLighting(list, dayT, time) {
    const { ctx, cam } = this;
    const night = clamp((dayT - 0.4) / 0.6, 0, 1);
    if (night <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = isInk()
      ? `rgba(150,155,168,${0.55 * night})`
      : isValheim()
        ? `rgba(38,52,80,${0.82 * night})`
        : `rgba(62,80,146,${0.8 * night})`;
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of list) {
      if (!e.glow) continue;
      const p = e._p;
      const flick = 0.85 + Math.sin(time * 7 + e.phase * 3) * 0.08 + noise1(time * 3 + e.phase, 5) * 0.12;
      const val = isValheim();
      // 발헤임: 뿌연 큰 번짐 대신 작고 심지가 또렷한 횃불빛
      const r = Math.min(cam.h * 0.5, (e.glowR || 2.6) * p.scale * flick * (val ? 0.66 : 1));
      const gy = p.y - e._sh * (e.glowY ?? 0.72);
      const g = ctx.createRadialGradient(p.x, gy, 0, p.x, gy, r);
      if (isInk()) {
        g.addColorStop(0, `rgba(250,248,240,${0.4 * night * Math.min(1, e.glow)})`);
        g.addColorStop(0.42, `rgba(244,241,232,${0.14 * night * Math.min(1, e.glow)})`);
        g.addColorStop(1, 'rgba(244,241,232,0)');
      } else if (val) {
        g.addColorStop(0, `rgba(255,208,122,${0.5 * night * Math.min(1, e.glow)})`);
        g.addColorStop(0.35, `rgba(255,178,96,${0.16 * night * Math.min(1, e.glow)})`);
        g.addColorStop(1, 'rgba(255,168,88,0)');
      } else {
        g.addColorStop(0, `rgba(255,226,158,${0.42 * night * Math.min(1, e.glow)})`);
        g.addColorStop(0.42, `rgba(255,198,116,${0.14 * night * Math.min(1, e.glow)})`);
        g.addColorStop(1, 'rgba(255,190,110,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, gy, r, 0, Math.PI * 2);
      ctx.fill();
      if (val) {
        // 불꽃 심지 — 작고 진한 코어
        const cr = Math.max(2.5, r * 0.14);
        const cg = ctx.createRadialGradient(p.x, gy, 0, p.x, gy, cr);
        cg.addColorStop(0, `rgba(255,232,168,${0.85 * night * Math.min(1, e.glow)})`);
        cg.addColorStop(1, 'rgba(255,210,122,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(p.x, gy, cr, 0, Math.PI * 2);
        ctx.fill();
      }
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
        if (isInk()) {
          g.addColorStop(0, `rgba(250,248,242,${0.9 * alpha})`);
          g.addColorStop(1, 'rgba(246,243,236,0)');
        } else {
          g.addColorStop(0, `rgba(255,240,170,${0.9 * alpha})`);
          g.addColorStop(1, 'rgba(255,220,120,0)');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (q.type === 'leaf') {
        ctx.globalAlpha = alpha * fadeFor(p.depth);
        ctx.fillStyle = tone(q.color);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(q.rot + time * q.spin);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.6, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        if (!isValheim()) ctx.stroke();
        ctx.restore();
      } else if (q.type === 'splash' || q.type === 'dust') {
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle =
          q.type === 'splash'
            ? isInk()
              ? 'rgba(140,145,150,0.8)'
              : isValheim()
                ? '#8fb3ba'
                : '#7fb9c8'
            : 'rgba(120,110,90,0.8)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * (1.6 - alpha), 0, Math.PI * 2);
        ctx.stroke();
      } else if (q.type === 'spark') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = isInk() ? '#e8e4d8' : '#ffd98a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // 종이 질감 + 비네트 — 매 프레임 합성하면 비싸서 한 장으로 미리 구워 둔다.
  // 발헤임 스타일은 종이결 대신 미세한 필름 그레인 + 차가운 비네트.
  _overlay() {
    const { cam } = this;
    const val = isValheim();
    const key = `${cam.w}x${cam.h}|${val ? 'v' : 'p'}`;
    if (this._ovKey === key) return this._ov;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cam.w));
    c.height = Math.max(1, Math.round(cam.h));
    const g2 = c.getContext('2d');
    const rng = makeRng(19);
    const img = g2.createImageData(c.width, c.height);
    const data = img.data;
    if (val) {
      // 필름 그레인 — 아주 옅은 무채색 노이즈
      for (let i = 0; i < data.length; i += 4) {
        const n = rng();
        data[i] = 18;
        data[i + 1] = 22;
        data[i + 2] = 28;
        data[i + 3] = n < 0.72 ? 0 : Math.floor(n * 13);
      }
      g2.putImageData(img, 0, 0);
    } else {
      // 종이결 — 어두운 반투명 노이즈로 만들어 두면 곱하기 합성 없이 한 번에 얹을 수 있다
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
    }
    const rg = g2.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.35, c.width / 2, c.height / 2, c.height * 0.9);
    if (val) {
      rg.addColorStop(0, 'rgba(16,24,34,0)');
      rg.addColorStop(1, 'rgba(16,24,34,0.42)');
    } else {
      rg.addColorStop(0, 'rgba(60,50,40,0)');
      rg.addColorStop(1, 'rgba(60,50,40,0.34)');
    }
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
  if (isValheim()) {
    // 대기 원근 — 안개색 배경 위로 일찍부터 서서히 흐려져 "안개에 잠기는" 느낌을 만든다
    if (depth < 15) return 1;
    const k = clamp(1 - (depth - 15) / (MAX_DIST - 15), 0, 1);
    return Math.pow(k, 1.35) * 0.96 + 0.04;
  }
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
function bakeCloud(seed, valheim = false) {
  return bake({
    w: 300,
    h: 120,
    seed,
    ss: 1.2,
    pad: 6,
    ay: 0.5,
    draw: (ctx, rng) => {
      // 발헤임: 외곽선 없이 납작하고 부드러운 구름
      const pts = valheim ? cloudSilhouette(150, 70, 142, 26, rng, 7, 0.9) : cloudSilhouette(150, 66, 132, 42, rng, 6, 0.75);
      shape(ctx, pts, {
        rng,
        fill: valheim ? 'rgba(226,233,238,0.62)' : 'rgba(255,255,255,0.94)',
        stroke: valheim ? null : 'rgba(51,48,43,0.45)',
        width: 2.2,
        rough: valheim ? 0.7 : 1.4,
      });
    },
  });
}

function bakeTreeline(seed, valheim = false) {
  return bake({
    w: 900,
    h: 110,
    seed,
    ss: 1,
    pad: 0,
    ay: 1,
    draw: (ctx, rng) => {
      ctx.fillStyle = valheim ? '#46584e' : tone('#9dbb96');
      ctx.strokeStyle = valheim ? 'rgba(0,0,0,0)' : 'rgba(51,48,43,0.5)';
      ctx.lineWidth = valheim ? 0.001 : 1.4;
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

function bakeSun(seed, valheim = false) {
  return bake({
    w: 120,
    h: 120,
    seed,
    ss: 1.4,
    pad: 4,
    ax: 0.5,
    ay: 0.5,
    draw: (ctx, rng) => {
      if (valheim) {
        // 안개 낀 하늘의 낮은 해 — 외곽선·햇살 없이 뿌옇게 번지는 원반
        const g = ctx.createRadialGradient(60, 60, 4, 60, 60, 46);
        g.addColorStop(0, 'rgba(255,244,214,0.98)');
        g.addColorStop(0.45, 'rgba(255,230,178,0.55)');
        g.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 120, 120);
        return;
      }
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

function bakeMoon(seed, valheim = false) {
  return bake({
    w: 120,
    h: 120,
    seed,
    ss: 1.4,
    pad: 4,
    ax: 0.5,
    ay: 0.5,
    draw: (ctx, rng) => {
      if (valheim) {
        const g = ctx.createRadialGradient(60, 60, 4, 60, 60, 42);
        g.addColorStop(0, 'rgba(246,250,255,1)');
        g.addColorStop(0.35, 'rgba(226,234,244,0.55)');
        g.addColorStop(1, 'rgba(212,224,236,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 120, 120);
        ctx.fillStyle = 'rgba(180,192,204,0.5)';
        ctx.beginPath();
        ctx.arc(53, 53, 6, 0, Math.PI * 2);
        ctx.arc(67, 65, 4.4, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ellipse(ctx, 60, 60, 28, 28, { rng, fill: '#f4f1dd', width: 2.2, stroke: 'rgba(51,48,43,0.5)' });
      ellipse(ctx, 52, 52, 7, 6, { rng, fill: 'rgba(190,190,175,0.7)', width: 1.2 });
      ellipse(ctx, 68, 66, 5, 4.4, { rng, fill: 'rgba(190,190,175,0.7)', width: 1.2 });
      ellipse(ctx, 58, 72, 4, 3.4, { rng, fill: 'rgba(190,190,175,0.7)', width: 1.2 });
    },
  });
}
