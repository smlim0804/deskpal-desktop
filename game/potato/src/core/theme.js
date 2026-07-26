// Don't Starve 풍 색 보정 — 모든 채색이 이 관문을 지난다.
// 원색을 그대로 쓰면 그림책처럼 밝아지므로, 채도를 살짝 죽이고 눌러서
// "빛바랜 동화책 잉크" 톤으로 통일한다.
const cache = new Map();

function parse(css) {
  if (typeof css !== 'string') return null;
  if (css[0] === '#') {
    const h = css.slice(1);
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((v) => parseFloat(v));
  return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] == null ? 1 : p[3]];
}

export function tone(css) {
  const hit = cache.get(css);
  if (hit) return hit;
  const p = parse(css);
  if (!p) return css;
  const lum = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
  const S = 0.82; // 남기는 채도
  const curve = (v) => 255 * Math.pow(Math.max(0, v) / 255, 1.08);
  const r = curve(lum + (p[0] - lum) * S) * 1.005;
  const g = curve(lum + (p[1] - lum) * S) * 0.995;
  const b = curve(lum + (p[2] - lum) * S) * 0.965; // 살짝 따뜻하게
  const out =
    p[3] < 1
      ? `rgba(${r | 0},${g | 0},${b | 0},${p[3]})`
      : `rgb(${Math.min(255, r) | 0},${g | 0},${b | 0})`;
  cache.set(css, out);
  return out;
}
