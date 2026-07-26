// Don't Starve 풍 팔레트 — 빛바랜 올리브 들판, 마른 흙, 양피지 하늘.
// 밝은 원색 대신 물 빠진 중간톤을 쓰고, 포인트(감자·꽃)만 살짝 밝힌다.
export const P = {
  ink: '#2b241d',
  inkSoft: 'rgba(43,36,29,0.55)',

  // 하늘 — 양피지빛. 밤은 검푸른 잉크
  skyDayTop: '#c9c39f',
  skyDayLow: '#e3d9b4',
  skyDuskTop: '#a98f72',
  skyDuskLow: '#d9a86c',
  skyNightTop: '#171b26',
  skyNightLow: '#2c3140',

  // 땅
  grass: '#8a9a58',
  grassDark: '#6d7c42',
  grassDry: '#a5a468',
  dirt: '#9c7a4e',
  dirtDark: '#6e5433',
  soil: '#5c452b', // 갈아엎은 밭
  soilWet: '#46351f',
  path: '#b09468',
  shadow: '#32291d',

  // 식물
  leaf: '#7fA04f',
  leafDark: '#5b7639',
  leafDry: '#a8955a',
  stem: '#6a8544',
  flowerWhite: '#e9e2cb',
  flowerYellow: '#d9b74f',

  // 나무·목재
  trunk: '#6b4f33',
  trunkDark: '#503a24',
  wood: '#a5804f',
  woodDark: '#7d5f3a',
  woodPale: '#c2a06f',

  // 돌
  stone: '#8f8878',
  stoneDark: '#6c6557',

  // 감자
  potato: '#c9a05c',
  potatoDark: '#a67f43',
  potatoGold: '#e7c14f',

  // 소품
  strawHat: '#c9a866',
  cloth: '#b5573f',
  clothBlue: '#5f7d8c',
  metal: '#7a7f84',
  water: '#5f8790',
  waterDeep: '#41626b',

  coin: '#cfa53b',
};

export function hexToRgb(hex) {
  if (typeof hex !== 'string') return [0, 0, 0];
  if (hex[0] !== '#') {
    const m = hex.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(',').map((v) => parseFloat(v));
      return [p[0] || 0, p[1] || 0, p[2] || 0];
    }
    return [0, 0, 0];
  }
  const h = hex.slice(1);
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function shade(color, amt) {
  const [r, g, b] = hexToRgb(color);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** 시간대(0=낮 … 0.5=석양 … 1=밤) 하늘색 */
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
