// 모델 대조 갤러리 — 레퍼런스 시트처럼 모델을 격자로 늘어놓아
// 원본 그림과 나란히 두고 비교할 수 있게 한다.
import * as N3 from './art3d/nature.js';
import * as V3 from './art3d/village.js';
import * as PR from './art3d/props.js';
import { bakeImpostor } from './render/mesh3d.js';
import { Theme, setMode } from './core/theme.js';

const canvas = document.getElementById('sheet');
const ctx = canvas.getContext('2d');
const countEl = document.getElementById('count');

const FONT = '"Gaegu", "Nanum Pen Script", "Comic Sans MS", "Apple SD Gothic Neo", sans-serif';

async function loadDecor() {
  try {
    return await import('./art3d/decor.js');
  } catch (e) {
    return null;
  }
}

function collect(mod, tag) {
  const out = [];
  if (!mod) return out;
  for (const [name, fn] of Object.entries(mod)) {
    if (typeof fn !== 'function') continue;
    if (name.startsWith('_')) continue;
    out.push({ name, fn, tag });
  }
  return out;
}

function build(items) {
  const cell = 190;
  const cols = Math.floor(1600 / cell);
  const rows = Math.ceil(items.length / cols);
  canvas.width = cols * cell;
  canvas.height = rows * cell + 40;

  ctx.fillStyle = Theme.mode === 'ink' ? '#fdfcf7' : Theme.mode === 'valheim' ? '#c8d1d6' : '#fdfbf4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  items.forEach((item, i) => {
    const cx = (i % cols) * cell + cell / 2;
    const cy = Math.floor(i / cols) * cell + cell / 2 + 10;
    let sp = null;
    try {
      const model = item.fn(1234 + i * 7);
      if (!model || !model.verts || !model.verts.length) throw new Error('empty');
      sp = bakeImpostor(model, { yaw: 0.42, ppu: 300 / Math.max(1.2, model.hUnits || 1), maxPx: 300 });
    } catch (e) {
      ctx.save();
      ctx.fillStyle = '#c2603a';
      ctx.font = `13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('ERR ' + (e.message || '').slice(0, 18), cx, cy);
      ctx.restore();
    }
    if (sp) {
      const maxW = cell - 24;
      const maxH = cell - 44;
      const k = Math.min(maxW / sp.canvas.width, maxH / sp.canvas.height, 1);
      const w = sp.canvas.width * k;
      const h = sp.canvas.height * k;
      ctx.drawImage(sp.canvas, cx - w / 2, cy + (cell - 44) / 2 - h, w, h);
    }
    ctx.save();
    ctx.fillStyle = '#33302b';
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(item.name, cx, cy + cell / 2 - 6);
    ctx.globalAlpha = 0.45;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(item.tag, cx, cy + cell / 2 - 20);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(51,48,43,0.13)';
    ctx.strokeRect((i % cols) * cell + 3, Math.floor(i / cols) * cell + 13, cell - 6, cell - 6);
    ctx.restore();
  });

  countEl.textContent = `${items.length}개 모델`;
}

(async () => {
  const DE = await loadDecor();
  const items = [
    ...collect(V3, 'village'),
    ...collect(N3, 'nature'),
    ...collect(PR, 'props'),
    ...collect(DE, 'decor'),
  ].filter((it) => !['cloudSilhouette'].includes(it.name));

  build(items);
  window.__gallery = { items, rebuild: () => build(items) };

  for (const b of document.querySelectorAll('.style-btn')) {
    b.addEventListener('click', () => {
      setMode(b.dataset.style);
      for (const o of document.querySelectorAll('.style-btn')) o.classList.toggle('is-on', o === b);
      build(items);
    });
  }
})();
