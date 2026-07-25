// 그림책 수채 팔레트 — 채도 낮고 종이 위에서 뜨지 않는 색들
export const P = {
  ink: '#33302b',
  inkLight: '#5c564d',

  // 하늘 / 시간대
  skyDayTop: '#bfe0ef',
  skyDayLow: '#f2efd9',
  skyDuskTop: '#7f9fc4',
  skyDuskLow: '#f3c79a',
  skyNightTop: '#2b3a5c',
  skyNightLow: '#63709b',

  // 땅
  grass: '#b9d791',
  grassDark: '#9dc477',
  grassDeep: '#82ad63',
  dirt: '#e2d2ad',
  dirtDark: '#cbb78c',
  stone: '#ddd6c6',
  stoneDark: '#bdb4a2',
  water: '#a8d4de',
  waterDeep: '#7fb9c8',

  // 식물
  leaf: '#8dc26f',
  leafDark: '#6ba455',
  leafBlue: '#7fb59a',
  leafGold: '#e6b45c',
  leafRust: '#d98a55',
  trunk: '#c9a375',
  trunkDark: '#a8804f',

  // 건물
  wood: '#dcbb8c',
  woodDark: '#b78f60',
  plaster: '#f3ead6',
  roofRed: '#d98462',
  roofBlue: '#8fb0c4',
  roofStraw: '#e3c887',
  roofGreen: '#93b787',
  cloth: '#f1e2c6',

  // 소품
  lanternGlow: '#ffd98a',
  fire: '#f0954e',
  acorn: '#c99257',
  shadow: 'rgba(72, 66, 56, 0.30)',
  paper: '#f6f1e4',
};

// 콩 캐릭터 몸 색 후보
export const BEAN_COLORS = [
  '#f7ecd8',
  '#f4dcc0',
  '#e8d6ee',
  '#d9e7f3',
  '#e5f0d4',
  '#f8dcd6',
  '#efe3c2',
  '#dfe6e8',
];

// 낮/밤 보간용 하늘 색 얻기 (t: 0=낮, 1=밤, 중간은 노을)
export function skyColors(t) {
  const mix = (a, b, k) => {
    const pa = hexToRgb(a);
    const pb = hexToRgb(b);
    return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * k)},${Math.round(pa[1] + (pb[1] - pa[1]) * k)},${Math.round(
      pa[2] + (pb[2] - pa[2]) * k
    )})`;
  };
  if (t < 0.5) {
    const k = t / 0.5;
    return [mix(P.skyDayTop, P.skyDuskTop, k), mix(P.skyDayLow, P.skyDuskLow, k)];
  }
  const k = (t - 0.5) / 0.5;
  return [mix(P.skyDuskTop, P.skyNightTop, k), mix(P.skyDuskLow, P.skyNightLow, k)];
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
