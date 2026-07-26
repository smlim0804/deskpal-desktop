// 시드 기반 난수 — 같은 시드면 항상 같은 손그림이 나오도록(라인 떨림 고정)
export function makeRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 문자열 → 시드
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const rand = (rng, a, b) => a + (b - a) * rng();
export const randInt = (rng, a, b) => Math.floor(a + (b - a + 1) * rng());
export const pick = (rng, arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
export const chance = (rng, p) => rng() < p;

// 부드러운 1D 값 노이즈 (바람, 흔들림에 사용)
export function noise1(t, seed = 0) {
  const i = Math.floor(t);
  const f = t - i;
  const h = (n) => {
    let x = Math.sin((n * 127.1 + seed * 311.7) * 43758.5453);
    return x - Math.floor(x);
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
