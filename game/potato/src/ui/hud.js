// 손그림 HUD — 감자·동전·씨앗·물뿌리개 상태, 상점 패널, 말풍선 안내.
import { shape, line, ellipse, blob, INK } from '../core/sketch.js';
import { makeRng, clamp } from '../core/rng.js';
import { P } from '../art/palette.js';

const FONT = '"Gaegu", "Nanum Pen Script", "Comic Sans MS", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

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
    fill: opts.fill || 'rgba(236,227,203,0.95)',
    stroke: opts.stroke || INK,
    width: opts.width || 2.6,
    rough: 1.1,
    close: true,
    passes: 2,
  });
}

function text(ctx, str, x, y, size, color = INK, align = 'left', bold = false) {
  ctx.save();
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
  ctx.restore();
}

// 아이콘들 — 매 프레임 같은 시드로 그려 떨림 방지
function iconPotato(ctx, x, y, s = 1) {
  const rng = makeRng(41);
  blob(ctx, x, y, 11 * s, 8.5 * s, { rng, fill: P.potato, width: 2.2, lumps: 8, lumpAmt: 0.09 });
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x - 3.4 * s, y - 1 * s, 1.4, 1.7, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 3.4 * s, y - 1 * s, 1.4, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function iconCoin(ctx, x, y) {
  const rng = makeRng(43);
  ellipse(ctx, x, y, 10, 10, { rng, fill: P.coin, width: 2.2 });
  text(ctx, '$', x, y + 5, 14, INK, 'center', true);
}

function iconSeed(ctx, x, y) {
  const rng = makeRng(47);
  // 씨감자 — 싹이 난 자그마한 감자
  blob(ctx, x, y + 1, 8.5, 6.6, { rng, fill: P.potatoDark, width: 2, lumps: 7, lumpAmt: 0.1 });
  line(ctx, x + 2, y - 4, x + 4, y - 10, { rng, width: 1.8 });
  ellipse(ctx, x + 5.6, y - 11, 3, 2.2, { rng, fill: P.leaf, width: 1.4, rot: 0.5 });
}

function iconDrop(ctx, x, y) {
  const rng = makeRng(53);
  shape(
    ctx,
    [
      [x, y - 9],
      [x + 6.4, y + 1],
      [x + 4, y + 7],
      [x - 4, y + 7],
      [x - 6.4, y + 1],
    ],
    { rng, fill: P.water, width: 2, close: true, corner: 0.5 }
  );
}

function iconFert(ctx, x, y) {
  const rng = makeRng(59);
  shape(
    ctx,
    [
      [x - 7, y - 6],
      [x + 7, y - 6],
      [x + 5.5, y + 8],
      [x - 5.5, y + 8],
    ],
    { rng, fill: P.woodPale, width: 2, close: true, corner: 0.2 }
  );
  text(ctx, '肥', x, y + 4, 10, INK, 'center');
}

export function drawHud(ctx, cam, g) {
  const px = 20;
  const py = 18;
  rr(ctx, px, py, 250, 128, { seed: 11 });

  iconPotato(ctx, px + 30, py + 26);
  text(ctx, `감자  ${g.inv.potato}`, px + 52, py + 33, 22);
  text(ctx, `(금감자 ${g.inv.gold})`, px + 150, py + 33, 16, 'rgba(43,36,29,0.6)');
  iconCoin(ctx, px + 30, py + 58);
  text(ctx, `동전  ${g.inv.coins}`, px + 52, py + 65, 22);
  iconSeed(ctx, px + 30, py + 92);
  text(ctx, `씨감자  ${g.inv.seeds}`, px + 52, py + 97, 22);
  iconFert(ctx, px + 160, py + 90);
  text(ctx, `× ${g.inv.fert}`, px + 176, py + 97, 18);

  // 물뿌리개 게이지
  iconDrop(ctx, px + 30, py + 116);
  const bw = 120;
  const bx = px + 50;
  const by = py + 110;
  rr(ctx, bx, by, bw, 13, { seed: 13, round: 6, fill: 'rgba(255,255,255,0.5)', width: 2 });
  const k = clamp(g.inv.water / g.inv.waterMax, 0, 1);
  if (k > 0.02) {
    ctx.save();
    ctx.fillStyle = P.water;
    ctx.beginPath();
    ctx.roundRect(bx + 2, by + 2, (bw - 4) * k, 9, 4);
    ctx.fill();
    ctx.restore();
  }
  text(ctx, `${g.inv.water}/${g.inv.waterMax}`, bx + bw + 10, by + 12, 15);

  // 우상단 날짜/시간
  rr(ctx, cam.w - 190, py, 170, 46, { seed: 17 });
  const phase = g.dayT < 0.42 ? '☀' : g.dayT < 0.62 ? '🌇' : '🌙';
  text(ctx, `${phase}  ${g.day}일째`, cam.w - 175, py + 31, 22);
  if (g.raining) text(ctx, '☔', cam.w - 60, py + 31, 22);

  // 수확 목표(가벼운 진행 표시)
  if (g.totalHarvest < 100) {
    text(ctx, `감자 캔 개수 ${g.totalHarvest} / 100`, cam.w - 24, py + 88, 17, 'rgba(43,36,29,0.75)', 'right');
  } else {
    text(ctx, `감자 박사 달성! ${g.totalHarvest}개`, cam.w - 24, py + 88, 17, 'rgba(43,36,29,0.75)', 'right');
  }
}

export function drawPrompt(ctx, cam, g) {
  if (!g.focus || g.shopOpen) return;
  const label = g.focus.label;
  if (!label) return;
  const y = cam.h - 76;
  ctx.save();
  ctx.font = `20px ${FONT}`;
  const w = ctx.measureText(label).width + 66;
  ctx.restore();
  rr(ctx, cam.w / 2 - w / 2, y - 27, w, 40, { seed: 21, round: 12 });
  text(ctx, 'F', cam.w / 2 - w / 2 + 22, y + 1, 21, '#a3502e', 'left', true);
  text(ctx, label, cam.w / 2 - w / 2 + 44, y + 1, 20);
}

export function drawToast(ctx, cam, g) {
  if (!g.toastMsg) return;
  const t = g.toastMsg;
  const a = clamp(Math.min(t.age * 5, t.life * 3), 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `21px ${FONT}`;
  const w = ctx.measureText(t.text).width + 56;
  rr(ctx, cam.w / 2 - w / 2, 24, w, 44, { seed: 23, round: 14 });
  text(ctx, t.text, cam.w / 2, 53, 21, INK, 'center');
  ctx.restore();
}

// ── 상점 ─────────────────────────────────────
export const SHOP_ITEMS = [
  { id: 'seed', name: '씨감자 3개', desc: '심을 수 있는 씨앗', cost: 4, icon: iconSeed },
  { id: 'fert', name: '거름 1포', desc: '심을 때 자동 사용 · 성장 30%↑ 수확 +2', cost: 6, icon: iconFert },
  { id: 'can', name: '큰 물뿌리개', desc: '물 용량 6 → 10', cost: 18, once: 'bigCan', icon: iconDrop },
  { id: 'scare', name: '허수아비', desc: '까마귀가 얼씬도 못 한다', cost: 26, once: 'scarecrow', icon: null },
  { id: 'land', name: '땅 넓히기', desc: '밭 두 줄 개간 (+8칸)', cost: 40, once: 'land', icon: null },
];

export function drawShop(ctx, cam, g) {
  if (!g.shopOpen) return;
  const w = 460;
  const h = 350;
  const x = cam.w / 2 - w / 2;
  const y = cam.h / 2 - h / 2 - 20;
  rr(ctx, x, y, w, h, { seed: 31, round: 14, fill: 'rgba(238,229,205,0.97)' });
  text(ctx, '감자 가게', x + w / 2, y + 40, 28, INK, 'center', true);
  line(ctx, x + 30, y + 54, x + w - 30, y + 54, { rng: makeRng(33), width: 2 });

  // 판매 줄
  const sellY = y + 86;
  const total = g.inv.potato * 3 + g.inv.gold * 15;
  iconPotato(ctx, x + 44, sellY - 8, 0.9);
  text(ctx, `감자 전부 팔기  (+${total} 동전)`, x + 66, sellY, 20);
  text(ctx, '[E]', x + w - 44, sellY, 20, '#a3502e', 'right', true);

  for (let i = 0; i < SHOP_ITEMS.length; i++) {
    const it = SHOP_ITEMS[i];
    const iy = sellY + 44 + i * 44;
    const owned = it.once && g.upgrades[it.once];
    const afford = g.inv.coins >= it.cost;
    const col = owned ? 'rgba(43,36,29,0.35)' : afford ? INK : 'rgba(160,60,40,0.75)';
    if (g.shopSel === i) {
      rr(ctx, x + 20, iy - 26, w - 40, 38, { seed: 37 + i, round: 9, fill: 'rgba(213,196,150,0.85)', width: 2 });
    }
    if (it.icon) it.icon(ctx, x + 44, iy - 8);
    text(ctx, owned ? `${it.name}  (완료)` : it.name, x + 66, iy, 20, col);
    if (!owned) text(ctx, `${it.cost}💰`, x + w - 44, iy, 19, col, 'right');
  }
  text(ctx, '↑↓ 고르기 · F 사기 · E 팔기 · Esc 닫기', x + w / 2, y + h - 20, 16, 'rgba(43,36,29,0.6)', 'center');
}

export function drawNightFade(ctx, cam, k) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = '#0d0f16';
  ctx.fillRect(0, 0, cam.w, cam.h);
  if (k > 0.35) {
    ctx.globalAlpha = (k - 0.35) / 0.65;
    text(ctx, '쿨쿨… 다음 날 아침', cam.w / 2, cam.h / 2, 30, '#e3d9b4', 'center');
  }
  ctx.restore();
}
