// 하늘 배경(구름·먼 능선)용 2D 실루엣 — 월드 바깥 원경이라 폴리곤으로 만들지 않는다.
export function cloudSilhouette(cx, cy, rx, ry, rng, lobes = 7, flatBottom = 0) {
  const n = lobes * 5;
  const ph = rng() * 6.28;
  const ph2 = rng() * 6.28;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const bulge = 0.88 + 0.11 * Math.sin(a * lobes + ph) + 0.045 * Math.sin(a * lobes * 2 + ph2);
    let y = cy + Math.sin(a) * ry * bulge;
    if (flatBottom && Math.sin(a) > 0) y = cy + Math.sin(a) * ry * (bulge * (1 - flatBottom) + flatBottom * 0.35);
    pts.push([cx + Math.cos(a) * rx * bulge, y]);
  }
  return pts;
}
