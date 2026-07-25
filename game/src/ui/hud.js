// 캔버스 위에 직접 그리는 손그림 UI
import { shape, line, INK } from '../core/sketch.js';
import { makeRng, clamp } from '../core/rng.js';
import { P } from '../art/palette.js';
import { TOTAL_LANTERNS } from '../game/quest.js';

const FONT = '"Gaegu", "Nanum Pen Script", "Comic Sans MS", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

// 프레임마다 같은 시드를 써서 UI 선이 떨리지 않게 한다
function rr(ctx, x, y, w, h, opts = {}) {
  const rng = makeRng(opts.seed || 9);
  const k = opts.round || 10;
  const pts = [
    [x + k, y],
    [x + w - k, y],
    [x + w, y + k],
    [x + w, y + h - k],
    [x + w - k, y + h],
    [x + k, y + h],
    [x, y + h - k],
    [x, y + k],
  ];
  shape(ctx, pts, {
    rng,
    fill: opts.fill || 'rgba(246,241,228,0.94)',
    stroke: opts.stroke || INK,
    width: opts.width || 2.4,
    rough: 1.0,
    close: true,
    passes: 2,
  });
}

function text(ctx, str, x, y, size, color = INK, align = 'left') {
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.restore();
}

function wrap(ctx, str, maxW, size) {
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
}

export function drawHud(ctx, cam, game) {
  const q = game.quest;

  // 좌상단 상태 패널
  const px = 22;
  const py = 20;
  rr(ctx, px, py, 232, 96, { seed: 11 });

  // 도토리
  const acorn = game.assets.props.acorn[0];
  ctx.drawImage(acorn.canvas, px + 14, py + 12, 28, 30);
  text(ctx, `도토리  ${q.acorns} / 12`, px + 50, py + 34, 22);

  // 등불
  const lan = q.delivered >= TOTAL_LANTERNS ? game.assets.props.lanternLit[0] : game.assets.props.lantern[0];
  ctx.drawImage(lan.canvas, px + 14, py + 46, 26, 34);
  text(ctx, `등불  ${q.delivered} / ${TOTAL_LANTERNS}`, px + 50, py + 72, 22);
  if (q.carrying > 0) text(ctx, `(들고 있음 ${q.carrying})`, px + 152, py + 72, 16, '#8a6a3a');

  // 목표
  const obj = q.objective;
  ctx.save();
  ctx.font = `20px ${FONT}`;
  const w = Math.min(560, ctx.measureText(obj).width + 44);
  ctx.restore();
  rr(ctx, cam.w / 2 - w / 2, 18, w, 42, { seed: 23, fill: 'rgba(246,241,228,0.88)' });
  text(ctx, obj, cam.w / 2, 46, 20, INK, 'center');

  // 조작 힌트 (우하단)
  ctx.save();
  ctx.globalAlpha = 0.6;
  text(ctx, 'WASD 이동 · Shift 달리기 · Space 점프 · Q/E 회전 · F 상호작용', cam.w - 22, cam.h - 18, 16, INK, 'right');
  ctx.restore();
}

export function drawPrompt(ctx, cam, game) {
  const t = game.focus;
  if (!t || game.dialogue.active) return;
  const p = t._p;
  if (!p || !p.visible) return;
  const y = p.y - (t._sh || 40) - 26;
  const label = t.promptLabel || '말 걸기';
  ctx.save();
  ctx.font = `18px ${FONT}`;
  const w = ctx.measureText(label).width + 58;
  ctx.restore();
  const bob = Math.sin(game.time * 4) * 3;
  rr(ctx, p.x - w / 2, y - 30 + bob, w, 34, { seed: 41, round: 8, fill: 'rgba(255,252,242,0.95)' });
  text(ctx, 'F', p.x - w / 2 + 16, y - 6 + bob, 20, '#c2603a');
  text(ctx, label, p.x - w / 2 + 34, y - 6 + bob, 18);
}

export function drawDialogue(ctx, cam, game) {
  const d = game.dialogue;
  if (!d.active) return;
  const boxW = Math.min(820, cam.w - 90);
  const boxH = 150;
  const x = cam.w / 2 - boxW / 2;
  const y = cam.h - boxH - 46;

  // 말꼬리 (대상 쪽으로)
  const t = d.target;
  if (t && t._p && t._p.visible) {
    const tx = clamp(t._p.x, x + 40, x + boxW - 40);
    const ty = t._p.y - (t._sh || 40);
    ctx.save();
    ctx.fillStyle = 'rgba(246,241,228,0.94)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(tx - 16, y + 6);
    ctx.lineTo(tx + 16, y + 6);
    ctx.lineTo(tx + 4, Math.min(ty + 30, y - 2));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  rr(ctx, x, y, boxW, boxH, { seed: 57, round: 16 });

  // 이름표
  const name = d.name || '';
  if (name) {
    ctx.save();
    ctx.font = `22px ${FONT}`;
    const nw = ctx.measureText(name).width + 34;
    ctx.restore();
    rr(ctx, x + 26, y - 20, nw, 40, { seed: 61, round: 10, fill: '#f3dcb6' });
    text(ctx, name, x + 26 + nw / 2, y + 7, 22, INK, 'center');
  }

  const shown = d.line.slice(0, Math.floor(d.charT));
  const lines = wrap(ctx, shown, boxW - 80, 26);
  lines.slice(0, 3).forEach((l, i) => text(ctx, l, x + 40, y + 62 + i * 34, 26));

  // 다음 표시
  if (d.charT >= d.line.length) {
    const bob = Math.sin(game.time * 5) * 3;
    ctx.save();
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + boxW - 44, y + boxH - 30 + bob);
    ctx.lineTo(x + boxW - 28, y + boxH - 30 + bob);
    ctx.lineTo(x + boxW - 36, y + boxH - 18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export function drawToast(ctx, cam, game) {
  const t = game.toastMsg;
  if (!t || t.life <= 0) return;
  const a = clamp(t.life / 0.6, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `30px ${FONT}`;
  const w = ctx.measureText(t.text).width + 60;
  ctx.restore();
  const y = 92 + (1 - Math.min(1, t.age * 3)) * -18;
  ctx.save();
  ctx.globalAlpha = a;
  rr(ctx, cam.w / 2 - w / 2, y, w, 52, { seed: 71, round: 14, fill: '#fff3d6' });
  text(ctx, t.text, cam.w / 2, y + 36, 30, '#8a4a24', 'center');
  ctx.restore();
}

export function drawFestivalBanner(ctx, cam, game) {
  if (!game.quest.festival) return;
  const t = clamp(game.quest.festivalT, 0, 1);
  ctx.save();
  ctx.globalAlpha = clamp(2.6 - game.quest.festivalT, 0, 1);
  const y = 150 - (1 - t) * 30;
  ctx.font = `54px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fff6e0';
  ctx.strokeText('등불 축제', cam.w / 2, y);
  ctx.fillStyle = '#c2603a';
  ctx.fillText('등불 축제', cam.w / 2, y);
  ctx.restore();
}
