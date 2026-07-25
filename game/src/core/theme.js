// 그림 스타일 — 'color'(수채 그림책) / 'ink'(색칠 안 한 스케치)
// 색이 지나가는 길목을 여기 한 곳으로 모아 두면, 모드만 바꿔도 전체 톤이 바뀐다.
export const Theme = {
  mode: 'color',
  version: 0, // 바뀔 때마다 증가 — 캐시된 인스턴스를 다시 굽는 신호
};

export function setMode(mode) {
  if (mode !== 'ink' && mode !== 'color') mode = 'color';
  if (Theme.mode === mode) return false;
  Theme.mode = mode;
  Theme.version++;
  return true;
}

export function isInk() {
  return Theme.mode === 'ink';
}

// ── 색 → 종이톤 ────────────────────────────────
const cache = new Map();

function parse(css) {
  if (typeof css !== 'string') return null;
  if (css[0] === '#') {
    const h = css.slice(1);
    if (h.length === 3) {
      return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1];
    }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((v) => parseFloat(v));
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

/**
 * 색칠 안 한 버전의 면 색. 완전한 흰색으로 만들면 형태가 안 읽히므로
 * 원래 색의 명도만 아주 옅게 남겨서 재질 차이를 흔적처럼 남긴다.
 */
export function paperTone(css, strength = 1) {
  const key = css + '|' + strength;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = parse(css);
  if (!p) return css;
  const lum = (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255;
  // 0.845 ~ 0.985 사이의 아주 밝은 무채색
  const v = (0.845 + 0.14 * lum) * 255;
  const warm = 4; // 종이라서 살짝 따뜻하게
  const r = Math.min(255, v + warm);
  const g = Math.min(255, v + warm * 0.5);
  const b = Math.min(255, v - warm * 0.5);
  const mix = (a, t) => a + (v - a) * 0;
  const out =
    p[3] < 1
      ? `rgba(${r | 0},${g | 0},${b | 0},${p[3]})`
      : `rgb(${r | 0},${g | 0},${b | 0})`;
  cache.set(key, out);
  return out;
}

/** 모드에 따라 원색 또는 종이톤을 돌려준다 */
export function tone(css) {
  return isInk() ? paperTone(css) : css;
}

/** 밝기 배율 (0.9 = 약간 어둡게) */
export function mul(css, f) {
  const p = parse(css);
  if (!p) return css;
  const r = Math.max(0, Math.min(255, p[0] * f));
  const g = Math.max(0, Math.min(255, p[1] * f));
  const b = Math.max(0, Math.min(255, p[2] * f));
  return p[3] < 1 ? `rgba(${r | 0},${g | 0},${b | 0},${p[3]})` : `rgb(${r | 0},${g | 0},${b | 0})`;
}
