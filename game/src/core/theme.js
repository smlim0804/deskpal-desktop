// 그림 스타일 — 'color'(수채 그림책) / 'ink'(색칠 안 한 스케치) / 'valheim'(저채도·안개 낀 북유럽 들판)
// 색이 지나가는 길목을 여기 한 곳으로 모아 두면, 모드만 바꿔도 전체 톤이 바뀐다.
export const Theme = {
  mode: 'color',
  version: 0, // 바뀔 때마다 증가 — 캐시된 인스턴스를 다시 굽는 신호
};

export function setMode(mode) {
  if (mode !== 'ink' && mode !== 'color' && mode !== 'valheim') mode = 'color';
  if (Theme.mode === mode) return false;
  Theme.mode = mode;
  Theme.version++;
  return true;
}

export function isInk() {
  return Theme.mode === 'ink';
}

export function isValheim() {
  return Theme.mode === 'valheim';
}

// 발헤임 스타일의 대기(안개) 색 — 하늘 지평선·원경 지형·소품 페이드가 전부 이 색으로 모인다
export const FOG = [173, 186, 196];

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

// ── 발헤임 톤 ──────────────────────────────────
// 파스텔 원색을 북유럽 들판의 낮은 채도로 끌어내린다.
// 채도를 절반쯤 죽이고, 밝은 색은 감마로 살짝 눌러서 "물 빠진" 느낌을 만든다.
const vCache = new Map();

export function valheimTone(css) {
  const hit = vCache.get(css);
  if (hit) return hit;
  const p = parse(css);
  if (!p) return css;
  const lum = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
  // 채도를 너무 죽이면 나무·석재·회벽이 전부 같은 크림색으로 뭉개진다 —
  // 재질이 색으로 구분될 만큼은 남기고, 감마로 중간톤을 눌러 물 빠진 톤을 만든다
  const S = 0.62;
  const curve = (v) => 255 * Math.pow(Math.max(0, v) / 255, 1.3);
  const r = curve(lum + (p[0] - lum) * S) * 0.985;
  const g = curve(lum + (p[1] - lum) * S);
  const b = curve(lum + (p[2] - lum) * S) * 1.02;
  const out =
    p[3] < 1
      ? `rgba(${r | 0},${g | 0},${Math.min(255, b) | 0},${p[3]})`
      : `rgb(${r | 0},${g | 0},${Math.min(255, b) | 0})`;
  vCache.set(css, out);
  return out;
}

// 발헤임식 면 조명 — 따뜻한 태양 + 차가운 하늘빛 그늘.
// (툰 밴딩 대신 부드러운 램프. 면 단위라 어차피 로우폴리 플랫셰이딩으로 보인다)
// 한 건물의 양지/음지 면이 "따뜻한 크림 vs 푸른 회색"으로 확실히 갈리게 색온도를 벌려 둔다
const VAMB = [0.3, 0.35, 0.47]; // 그늘(하늘빛) 성분
const VSUN = [0.9, 0.73, 0.5]; // 직사광(따뜻한) 성분
const vfCache = new Map();

export function valheimFace(css, ndl, downward = false) {
  const q = Math.round(clamp01((ndl + 1) / 2) * 22); // 노멀·광원 각을 22단계로 양자화해 캐시
  const key = css + '|' + q + (downward ? 'd' : '');
  const hit = vfCache.get(key);
  if (hit) return hit;
  const p = parse(valheimTone(css));
  if (!p) return css;
  const t = clamp01(((q / 22) * 2 - 1 + 0.32) / 1.15);
  const sun = t * t * (3 - 2 * t); // smoothstep
  const dk = downward ? 0.86 : 1;
  const r = Math.min(255, p[0] * (VAMB[0] + VSUN[0] * sun) * dk);
  const g = Math.min(255, p[1] * (VAMB[1] + VSUN[1] * sun) * dk);
  const b = Math.min(255, p[2] * (VAMB[2] + VSUN[2] * sun) * dk);
  const out = p[3] < 1 ? `rgba(${r | 0},${g | 0},${b | 0},${p[3]})` : `rgb(${r | 0},${g | 0},${b | 0})`;
  vfCache.set(key, out);
  return out;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 모드에 따라 원색 / 종이톤 / 발헤임톤을 돌려준다 */
export function tone(css) {
  if (isInk()) return paperTone(css);
  if (Theme.mode === 'valheim') return valheimTone(css);
  return css;
}

// 발헤임 바닥 데칼(흙길·디딤돌) — 어둡게 조정한 지형 밝기에 맞춰 한 단계 눌러 준다.
// 그냥 valheimTone 만 쓰면 지형보다 20%쯤 밝아서 길이 표백된 것처럼 떠 보인다.
const vgCache = new Map();

export function valheimGround(css) {
  const hit = vgCache.get(css);
  if (hit) return hit;
  const p = parse(valheimTone(css));
  if (!p) return css;
  const r = p[0] * 0.74;
  const g = p[1] * 0.73;
  const b = p[2] * 0.7;
  const out = p[3] < 1 ? `rgba(${r | 0},${g | 0},${b | 0},${p[3]})` : `rgb(${r | 0},${g | 0},${b | 0})`;
  vgCache.set(css, out);
  return out;
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
