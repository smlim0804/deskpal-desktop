// DeskPal — 픽셀 도트 캐릭터 (24×24)
// 모든 캐릭터: 떠다니는(flyer) 타입
// 컬렉션: UFO/로켓/자동차/슬라임/혜성/별 + 동물(시바/고양이/토끼/레서판다/펭귄) + 토성/보석/도넛/해골/안구/에너지볼/벌레/탱크

export const SPRITE_W = 24;
export const SPRITE_H = 24;
const W = SPRITE_W, H = SPRITE_H;

// ===== 픽셀 헬퍼 =====
function blank() {
  return Array.from({ length: H }, () => new Array(W).fill(null));
}
function px(g, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  g[y][x] = c;
}
function rect(g, x, y, w, h, c) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) px(g, x + dx, y + dy, c);
}
function disc(g, cx, cy, rx, ry, c) {
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++)
    for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.02)
        px(g, cx + x, cy + y, c);
    }
}
function ring(g, cx, cy, rx, ry, c) {
  const m = blank();
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++)
    for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.02) {
        const gx = cx + x, gy = cy + y;
        if (gx >= 0 && gx < W && gy >= 0 && gy < H) m[gy][gx] = 1;
      }
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!m[y][x]) continue;
      if (!m[y - 1]?.[x] || !m[y + 1]?.[x] || !m[y][x - 1] || !m[y][x + 1])
        px(g, x, y, c);
    }
}
function line(g, x1, y1, x2, y2, c) {
  x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
  let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
  let sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    px(g, x1, y1, c);
    if (x1 === x2 && y1 === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x1 += sx; }
    if (e2 < dx) { err += dx; y1 += sy; }
  }
}

// 위로 뾰족한 삼각형 채우기 (동물 귀 등). apex = 꼭짓점(위), h = 높이, 아래로 갈수록 1px씩 넓어짐
function tri(g, apexX, apexY, h, c) {
  for (let r = 0; r < h; r++)
    for (let x = apexX - r; x <= apexX + r; x++) px(g, x, apexY + r, c);
}

export function renderGrid(ctx, grid, palette) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = false;
  const sx = ctx.canvas.width / W;
  const sy = ctx.canvas.height / H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = grid[y][x];
      if (!c) continue;
      const color = palette[c] || c;
      ctx.fillStyle = color;
      ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
    }
  }
}

// ============================================================
// 1. UFO (외계 비행선)
// ============================================================
const UFO_PAL = {
  K: "#0a1a2a", S: "#aab0bc", M: "#666e80", D: "#3a4452",
  G: "#7be25b", H: "#cfffb0", L: "#fff570", R: "#ff5050", B: "#5fb6e8", W: "#fff",
};
function buildUFO(frame) {
  const g = blank();
  const f = frame % 8;
  const hover = Math.round(Math.sin((f / 8) * Math.PI * 2) * 1);
  // 디스크
  disc(g, 12, 13 + hover, 9, 2, "S"); ring(g, 12, 13 + hover, 9, 2, "K");
  for (let x = 4; x <= 20; x++) px(g, x, 14 + hover, "M");
  // 돔
  for (let y = -5; y <= 0; y++)
    for (let x = -5; x <= 5; x++)
      if (x * x + y * y <= 25 && y <= 0) px(g, 12 + x, 11 + hover + y, "B");
  for (let y = -5; y <= 0; y++)
    for (let x = -5; x <= 5; x++)
      if (x * x + y * y <= 25 && x * x + y * y >= 18) px(g, 12 + x, 11 + hover + y, "K");
  px(g, 9, 8 + hover, "H"); px(g, 10, 7 + hover, "H");
  // 외계인
  disc(g, 12, 10 + hover, 2, 2, "G"); ring(g, 12, 10 + hover, 2, 2, "K");
  px(g, 11, 10 + hover, "K"); px(g, 13, 10 + hover, "K");
  // 점멸등
  const lights = [[4, "L"], [8, "R"], [12, "L"], [16, "R"], [20, "L"]];
  for (let i = 0; i < lights.length; i++) {
    const [x, baseC] = lights[i];
    const on = ((f + i) % 4) < 2;
    px(g, x, 15 + hover, on ? baseC : "D");
  }
  return g;
}

// ============================================================
// 2. 로켓
// ============================================================
const ROCKET_PAL = {
  K: "#1a1a1a", W: "#f0f0f0", G: "#bcbcbc", R: "#e63b3b",
  D: "#a82020", B: "#5fb6e8", Y: "#ffd84a", O: "#ff7e3a", F: "#ffe066",
};
function buildRocket(frame) {
  const g = blank();
  const f = frame % 8;
  // 노즈콘
  px(g, 11, 2, "R"); px(g, 12, 2, "R");
  for (let y = 3; y <= 5; y++) for (let x = 10; x <= 13; x++) px(g, x, y, "R");
  px(g, 13, 4, "D"); px(g, 13, 5, "D");
  px(g, 11, 1, "K"); px(g, 12, 1, "K");
  px(g, 10, 2, "K"); px(g, 13, 2, "K");
  for (let y = 3; y <= 5; y++) { px(g, 9, y, "K"); px(g, 14, y, "K"); }
  // 몸통
  for (let y = 6; y <= 14; y++) for (let x = 9; x <= 14; x++) px(g, x, y, "W");
  for (let y = 6; y <= 14; y++) px(g, 13, y, "G");
  for (let y = 6; y <= 14; y++) px(g, 14, y, "G");
  for (let y = 6; y <= 14; y++) { px(g, 8, y, "K"); px(g, 15, y, "K"); }
  // 창문
  disc(g, 11, 8, 1, 1, "B");
  px(g, 10, 8, "K"); px(g, 12, 8, "K"); px(g, 11, 7, "K"); px(g, 11, 9, "K");
  px(g, 11, 8, "W");
  // 띠
  for (let x = 8; x <= 15; x++) px(g, x, 11, "R");
  // 핀
  px(g, 7, 13, "R"); px(g, 6, 14, "R"); px(g, 6, 15, "R");
  px(g, 7, 14, "R"); px(g, 7, 15, "R");
  px(g, 16, 13, "R"); px(g, 17, 14, "R"); px(g, 17, 15, "R");
  px(g, 16, 14, "R"); px(g, 16, 15, "R");
  px(g, 5, 15, "K"); px(g, 18, 15, "K");
  // 노즐
  px(g, 10, 15, "K"); px(g, 13, 15, "K");
  for (let x = 10; x <= 13; x++) px(g, x, 16, "K");
  // 화염
  const flameFrames = [[3, 4, 5, 4, 3], [4, 5, 6, 5, 4], [3, 5, 5, 5, 3], [2, 4, 5, 4, 2]];
  const flameRow = flameFrames[f % flameFrames.length];
  for (let i = 0; i < 5; i++) {
    const h = flameRow[i];
    const cx = 9 + i;
    for (let dy = 0; dy < h; dy++) {
      const y = 17 + dy;
      let c = dy < 1 ? "W" : dy < 2 ? "F" : dy < 3 ? "Y" : dy < 4 ? "O" : "R";
      px(g, cx, y, c);
    }
  }
  return g;
}

// ============================================================
// 3. 자동차
// ============================================================
const CAR_PAL = {
  K: "#1a1a1a", R: "#e63b3b", D: "#b32626", G: "#5fb6e8", W: "#ffffff",
  Y: "#ffd84a", T: "#2a2a2a", S: "#666666",
};
function buildCar(frame) {
  const g = blank();
  const f = frame % 8;
  rect(g, 2, 14, 20, 4, "R");
  rect(g, 6, 9, 12, 5, "R");
  for (let x = 2; x <= 21; x++) px(g, x, 17, "D");
  for (let x = 7; x <= 17; x++) px(g, x, 8, "K");
  px(g, 6, 9, "K"); px(g, 18, 9, "K");
  px(g, 5, 10, "K"); px(g, 19, 10, "K");
  px(g, 4, 11, "K"); px(g, 20, 11, "K");
  for (let y = 12; y <= 14; y++) { px(g, 3, y, "K"); px(g, 21, y, "K"); }
  for (let x = 2; x <= 21; x++) px(g, x, 18, "K");
  px(g, 1, 15, "K"); px(g, 1, 16, "K"); px(g, 1, 17, "K");
  px(g, 22, 15, "K"); px(g, 22, 16, "K"); px(g, 22, 17, "K");
  rect(g, 8, 10, 4, 3, "G");
  rect(g, 13, 10, 4, 3, "G");
  px(g, 12, 10, "K"); px(g, 12, 11, "K"); px(g, 12, 12, "K");
  px(g, 21, 13, "Y"); px(g, 21, 14, "Y");
  px(g, 2, 13, "Y");
  for (let x = 3; x <= 20; x++) px(g, x, 16, "D");
  px(g, 9, 15, "K"); px(g, 16, 15, "K");
  disc(g, 6, 20, 2, 2, "T"); ring(g, 6, 20, 2, 2, "K"); px(g, 6, 20, "S");
  const rot = f % 4;
  if (rot === 0) { px(g, 6, 19, "S"); px(g, 6, 21, "S"); }
  else if (rot === 1) { px(g, 5, 19, "S"); px(g, 7, 21, "S"); }
  else if (rot === 2) { px(g, 5, 20, "S"); px(g, 7, 20, "S"); }
  else { px(g, 7, 19, "S"); px(g, 5, 21, "S"); }
  disc(g, 18, 20, 2, 2, "T"); ring(g, 18, 20, 2, 2, "K"); px(g, 18, 20, "S");
  if (rot === 0) { px(g, 18, 19, "S"); px(g, 18, 21, "S"); }
  else if (rot === 1) { px(g, 17, 19, "S"); px(g, 19, 21, "S"); }
  else if (rot === 2) { px(g, 17, 20, "S"); px(g, 19, 20, "S"); }
  else { px(g, 19, 19, "S"); px(g, 17, 21, "S"); }
  if (f % 2 === 0) { px(g, 0, 16, "S"); px(g, 0, 17, "S"); }
  else { px(g, 0, 15, "S"); }
  return g;
}

// ============================================================
// 4. 슬라임
// ============================================================
const SLIME_PAL = { K: "#0a2e44", B: "#5fb6e8", L: "#bdedff", W: "#fff" };
function buildSlime(frame) {
  const g = blank();
  const f = frame % 8;
  let cx = 12, cy, rx, ry;
  if (f < 2)      { cy = 18; rx = 9; ry = 3; }
  else if (f < 3) { cy = 15; rx = 6; ry = 5; }
  else if (f < 4) { cy = 13; rx = 5; ry = 6; }
  else if (f < 5) { cy = 12; rx = 5; ry = 6; }
  else if (f < 6) { cy = 14; rx = 6; ry = 5; }
  else if (f < 7) { cy = 17; rx = 7; ry = 4; }
  else            { cy = 19; rx = 10; ry = 2; }
  disc(g, cx, cy, rx, ry, "B");
  ring(g, cx, cy, rx, ry, "K");
  if (rx >= 4) {
    px(g, cx - rx + 2, cy - 1, "L");
    px(g, cx - rx + 3, cy - 1, "L");
  }
  if (ry >= 4) {
    px(g, cx - 2, cy, "W"); px(g, cx - 2, cy, "K");
    px(g, cx + 2, cy, "W"); px(g, cx + 2, cy, "K");
  } else {
    px(g, cx - 2, cy, "K"); px(g, cx + 2, cy, "K");
  }
  if (ry >= 5) px(g, cx, cy + 2, "K");
  if (cy <= 14) {
    for (let dx = -3; dx <= 3; dx++) px(g, cx + dx, 22, "K");
  }
  return g;
}

// ============================================================
// 5. 바퀴벌레 🪳 (top-down, 머리 위쪽, orientToMovement)
// ============================================================
const BUG_PAL = {
  K: "#0a0604", D: "#2a1a10", B: "#5a3a22", M: "#7a5030",
  R: "#a36240", Y: "#d4a060", L: "#e8b878", E: "#ff0040",
};
function buildBug(frame) {
  const g = blank();
  const f = frame % 8;
  const cx = 12;
  // 더듬이 (위쪽 V자, 흔들흔들)
  const aw = Math.sin(f * Math.PI / 4) * 1.5;
  // 좌측 더듬이 (곡선)
  line(g, cx - 1, 5, cx - 3 + aw, 2, "K");
  line(g, cx - 3 + aw, 2, cx - 5 + aw, 0, "K");
  // 우측 더듬이
  line(g, cx + 1, 5, cx + 3 - aw, 2, "K");
  line(g, cx + 3 - aw, 2, cx + 5 - aw, 0, "K");

  // 머리 (디스크)
  disc(g, cx, 5, 2, 2, "D");
  ring(g, cx, 5, 2, 2, "K");
  // 빨간 눈 2개
  px(g, cx - 1, 5, "E"); px(g, cx + 1, 5, "E");

  // 흉부 (prothorax — 사다리꼴, 머리 아래 어두운 갈색)
  for (let dy = 0; dy < 3; dy++) {
    const w = 3 + dy;
    for (let dx = -w; dx <= w; dx++) px(g, cx + dx, 7 + dy, "M");
  }
  for (let dx = -3; dx <= 3; dx++) px(g, cx + dx, 7, "K");
  for (let dy = 0; dy < 3; dy++) {
    px(g, cx - (3 + dy), 7 + dy, "K");
    px(g, cx + (3 + dy), 7 + dy, "K");
  }
  // 흉부 광택
  px(g, cx - 1, 8, "R"); px(g, cx + 1, 8, "R");

  // 6 다리 (3쌍, 트로트 식 교차)
  const legPhase = f % 2;
  const legSpecs = [
    { sy: 8,  outX: 6 },  // 앞다리
    { sy: 12, outX: 8 },  // 중간다리
    { sy: 16, outX: 7 },  // 뒷다리
  ];
  for (let i = 0; i < 3; i++) {
    const spec = legSpecs[i];
    const lifted = (legPhase + i) % 2 === 0;
    const wiggle = lifted ? -1 : 1;
    // 좌측 다리 (관절 표현 — 2단 꺾인 선)
    line(g, cx - 4, spec.sy, cx - 4 - Math.floor(spec.outX / 2), spec.sy + wiggle, "K");
    line(g, cx - 4 - Math.floor(spec.outX / 2), spec.sy + wiggle, cx - 4 - spec.outX, spec.sy, "K");
    // 우측 다리
    line(g, cx + 4, spec.sy, cx + 4 + Math.floor(spec.outX / 2), spec.sy + wiggle, "K");
    line(g, cx + 4 + Math.floor(spec.outX / 2), spec.sy + wiggle, cx + 4 + spec.outX, spec.sy, "K");
  }

  // 몸통 (날개 케이스) - 세로로 긴 타원
  disc(g, cx, 14, 5, 6, "B");
  ring(g, cx, 14, 5, 6, "K");
  // 가운데 분리선 (날개 두 장)
  for (let y = 9; y <= 19; y++) px(g, cx, y, "D");
  // 등 광택 (좌상단)
  px(g, cx - 3, 11, "R"); px(g, cx - 2, 12, "R");
  px(g, cx - 2, 14, "L"); px(g, cx + 2, 14, "M");
  px(g, cx + 3, 13, "M"); px(g, cx - 3, 16, "M");
  // 점박이
  px(g, cx - 1, 10, "K"); px(g, cx + 1, 10, "K");
  px(g, cx - 2, 13, "D"); px(g, cx + 2, 17, "D");

  // 꼬리 부분 (cerci — 작은 뾰족)
  px(g, cx - 1, 20, "K"); px(g, cx + 1, 20, "K"); px(g, cx, 20, "D");

  return g;
}

// ============================================================
// 6. 탱크 🚛 — top-down 군용 탱크
// 차체 + 양옆 캐터필러 + 회전 포탑 + 긴 포신
// 포신은 위쪽(앞)을 향함, orientToMovement로 회전
// ============================================================
const TANK_PAL = {
  K: "#0a0a0a",      // 외곽선 (거의 검정)
  D: "#2a3018",      // 차체 어두운 부분
  B: "#4a5028",      // 차체 메인 (군용 카키)
  L: "#6a7038",      // 차체 하이라이트
  H: "#8a9050",      // 밝은 하이라이트
  T: "#3a4020",      // 트랙(캐터필러) 색
  TL: "#5a6030",     // 트랙 광택
  G: "#1a1a1a",      // 포신 (검정)
  GM: "#3a3a3a",     // 포신 음영
  R: "#c83020",      // 빨간 마킹 (별/십자)
  F: "#ffd84a",      // 머즐 플래시
};
function buildTank(frame) {
  // 위에서 본 탱크 — 양 옆에 캐터필러 + 중앙 차체 + 회전 포탑 + 긴 포신 (위쪽)
  const g = blank();
  const f = frame % 4;
  const cx = 12;

  // === 좌측 캐터필러 (트랙) ===
  for (let dy = 4; dy <= 19; dy++) {
    for (let dx = 1; dx <= 4; dx++) px(g, cx - 9 + dx, dy, "T");
  }
  // 트랙 외곽
  for (let dy = 4; dy <= 19; dy++) {
    px(g, cx - 9, dy, "K");
    px(g, cx - 4, dy, "K");
  }
  px(g, cx - 8, 3, "K"); px(g, cx - 7, 3, "K"); px(g, cx - 6, 3, "K"); px(g, cx - 5, 3, "K");
  px(g, cx - 8, 20, "K"); px(g, cx - 7, 20, "K"); px(g, cx - 6, 20, "K"); px(g, cx - 5, 20, "K");
  // 트랙 패턴 (frame에 따라 움직임 — 가로 줄들이 흐름)
  for (let dy = 4 + (f % 2); dy <= 19; dy += 2) {
    for (let dx = -8; dx <= -5; dx++) px(g, cx + dx, dy, "TL");
  }

  // === 우측 캐터필러 (미러) ===
  for (let dy = 4; dy <= 19; dy++) {
    for (let dx = 1; dx <= 4; dx++) px(g, cx + 4 + dx, dy, "T");
  }
  for (let dy = 4; dy <= 19; dy++) {
    px(g, cx + 4, dy, "K");
    px(g, cx + 9, dy, "K");
  }
  px(g, cx + 5, 3, "K"); px(g, cx + 6, 3, "K"); px(g, cx + 7, 3, "K"); px(g, cx + 8, 3, "K");
  px(g, cx + 5, 20, "K"); px(g, cx + 6, 20, "K"); px(g, cx + 7, 20, "K"); px(g, cx + 8, 20, "K");
  for (let dy = 4 + (f % 2); dy <= 19; dy += 2) {
    for (let dx = 5; dx <= 8; dx++) px(g, cx + dx, dy, "TL");
  }

  // === 차체 (가운데 사각 — 캐터필러 사이) ===
  for (let dy = 5; dy <= 18; dy++) {
    for (let dx = -3; dx <= 3; dx++) px(g, cx + dx, dy, "B");
  }
  // 차체 음영 (오른쪽)
  for (let dy = 5; dy <= 18; dy++) {
    px(g, cx + 2, dy, "D");
    px(g, cx + 3, dy, "D");
  }
  // 차체 하이라이트 (왼쪽)
  for (let dy = 5; dy <= 18; dy++) px(g, cx - 3, dy, "L");
  // 외곽선
  for (let dy = 5; dy <= 18; dy++) {
    px(g, cx - 3, dy, dy === 5 || dy === 18 ? "K" : (dy === 6 ? "K" : "L"));
    if (dy === 5 || dy === 18) {
      for (let dx = -3; dx <= 3; dx++) px(g, cx + dx, dy, "K");
    }
  }
  // 차체 4모서리
  px(g, cx - 3, 5, "K"); px(g, cx + 3, 5, "K");
  px(g, cx - 3, 18, "K"); px(g, cx + 3, 18, "K");

  // === 후방 엔진 그릴 ===
  for (let dx = -2; dx <= 2; dx++) {
    px(g, cx + dx, 17, "D");
    if (dx % 2 === 0) px(g, cx + dx, 16, "K");
  }

  // === 포탑 (가운데 큰 원) ===
  disc(g, cx, 11, 4, 4, "B");
  // 포탑 음영
  px(g, cx + 1, 13, "D"); px(g, cx + 2, 12, "D");
  px(g, cx + 2, 13, "D"); px(g, cx + 3, 11, "D");
  // 포탑 하이라이트
  px(g, cx - 2, 9, "H"); px(g, cx - 1, 8, "H");
  px(g, cx - 2, 10, "L");
  // 포탑 외곽
  ring(g, cx, 11, 4, 4, "K");

  // === 빨간 별/마킹 (포탑 위) ===
  px(g, cx, 11, "R"); px(g, cx - 1, 12, "R"); px(g, cx + 1, 12, "R");

  // === 포신 (위쪽으로 길게 = 진행 방향) ===
  // 포신 본체 (가운데 검은 막대)
  for (let dy = 0; dy <= 8; dy++) {
    px(g, cx, 0 + dy, "G");
    px(g, cx - 1, 0 + dy, "G");
  }
  // 포신 음영
  for (let dy = 0; dy <= 8; dy++) px(g, cx, 0 + dy, "GM");
  // 포신 외곽
  for (let dy = 0; dy <= 8; dy++) {
    px(g, cx - 2, 0 + dy, "K");
    px(g, cx + 1, 0 + dy, "K");
  }
  // 포구 (총구, 두꺼움)
  px(g, cx - 2, 0, "K"); px(g, cx - 1, 0, "GM"); px(g, cx, 0, "GM"); px(g, cx + 1, 0, "K");
  // 포신 뒷부분 (포탑 연결)
  px(g, cx - 2, 8, "K"); px(g, cx + 1, 8, "K");

  // === 발사 깜빡임 (포구 끝, frame에 따라) ===
  if (f === 0) {
    // 큰 머즐 플래시
    px(g, cx - 1, -1, "F"); // 화면 밖이라 안 보이지만 위치 참고
    // (실제 머즐 플래시는 특수 이벤트에서 spawn)
  }

  return g;
}


// 마우스 위치 받아서 동공 그리는 안구 (옵션 안에서)
function buildEyeballWithLook(frame, opts) {
  const g = blank();
  // 흰자
  disc(g, 12, 12, 7, 6, "W");
  ring(g, 12, 12, 7, 6, "K");
  // 마우스 방향 계산
  const lookDx = opts?.lookDx ?? 0;
  const lookDy = opts?.lookDy ?? 0;
  const dist = Math.hypot(lookDx, lookDy);
  let pupilX = 12, pupilY = 12;
  if (dist > 1) {
    // 최대 2.5픽셀 떨어진 위치
    const range = 2.5;
    const norm = Math.min(1, dist / 200); // 200px 안에서 비례
    pupilX = 12 + (lookDx / dist) * range;
    pupilY = 12 + (lookDy / dist) * range * 0.8; // y는 약간 덜
  } else {
    // 마우스 멀거나 정중앙 — frame따라 살짝 두리번
    const f = frame % 8;
    const angle = (f / 8) * Math.PI * 2;
    pupilX = 12 + Math.cos(angle) * 1.0;
    pupilY = 12 + Math.sin(angle) * 0.6;
  }
  // 홍채
  disc(g, pupilX, pupilY, 3, 3, "B");
  ring(g, pupilX, pupilY, 3, 3, "D");
  px(g, pupilX - 1, pupilY - 1, "L");
  px(g, pupilX + 1, pupilY + 1, "L");
  // 동공
  disc(g, pupilX, pupilY, 1, 1, "K");
  // 반사광
  px(g, pupilX - 1, pupilY - 1, "W");
  // 핏줄
  line(g, 6, 8, 9, 10, "R");
  line(g, 18, 14, 16, 13, "R");
  line(g, 8, 16, 10, 14, "R");
  return g;
}

// ============================================================
// 7. 토성 🪐
// ============================================================
const SATURN_PAL = {
  K: "#1a1a1a", O: "#e8a854", D: "#a06530", Y: "#ffd84a",
  L: "#fff0a8", B: "#5a3a1a", R: "#c8702c",
};
function buildSaturn(frame) {
  const g = blank();
  const f = frame % 8;
  const tilt = (f % 4) - 1.5; // -1.5 ~ 1.5
  // 행성 본체
  disc(g, 12, 12, 5, 5, "O");
  ring(g, 12, 12, 5, 5, "K");
  // 줄무늬
  for (let x = 8; x <= 16; x++) {
    px(g, x, 10, "D"); px(g, x, 13, "D"); px(g, x, 11, "R");
  }
  // 광택
  px(g, 9, 9, "L"); px(g, 10, 9, "Y");
  px(g, 8, 11, "L");
  // 고리 (회전 효과 — 좌우로 기울어짐)
  for (let dx = -10; dx <= 10; dx++) {
    if (Math.abs(dx) <= 5) continue; // 본체 가려진 부분
    const baseY = 12 + Math.sign(dx) * tilt * 0.4;
    const yMain = Math.round(baseY);
    const yEdge = yMain + 1;
    px(g, 12 + dx, yMain, "L");
    px(g, 12 + dx, yEdge, "K");
  }
  // 본체 앞에 보이는 고리 끝
  if (tilt > 0) { px(g, 6, 13, "L"); px(g, 18, 12, "L"); }
  else { px(g, 6, 12, "L"); px(g, 18, 13, "L"); }
  return g;
}

// ============================================================
// 8. 보석 💎 (다이아몬드, 반짝 회전)
// ============================================================
const GEM_PAL = {
  K: "#1a1a1a", P: "#ff9eb5", L: "#ffd1de", D: "#c66a85",
  W: "#ffffff", Y: "#ffd84a", B: "#5fb6e8", S: "#a0e0ff",
};
function buildGem(frame) {
  const g = blank();
  const f = frame % 4;
  // 보석 색 사이클 (분홍 ↔ 하늘 살짝)
  const main = f % 2 === 0 ? "P" : "B";
  const light = f % 2 === 0 ? "L" : "S";
  const dark = f % 2 === 0 ? "D" : "K";

  // 다이아몬드 형상 (위쪽 트랩 + 아래쪽 삼각)
  // 위쪽 (table)
  for (let dy = 0; dy < 3; dy++) {
    const w = 5 - dy;
    for (let dx = -w; dx <= w; dx++) px(g, 12 + dx, 7 + dy, main);
  }
  // 가운데 (girdle)
  for (let dx = -7; dx <= 7; dx++) px(g, 12 + dx, 10, main);
  for (let dx = -7; dx <= 7; dx++) px(g, 12 + dx, 11, dark);
  // 아래쪽 (pavilion — 점점 좁아짐)
  for (let dy = 0; dy < 6; dy++) {
    const w = 6 - dy;
    for (let dx = -w; dx <= w; dx++) px(g, 12 + dx, 12 + dy, main);
  }
  // 끝점
  px(g, 12, 18, dark);

  // 외곽선
  // 위 (table)
  for (let dx = -5; dx <= 5; dx++) px(g, 12 + dx, 7, "K");
  // 위 측면 (사선)
  line(g, 7, 7, 5, 10, "K");
  line(g, 17, 7, 19, 10, "K");
  // 가운데 가장자리
  px(g, 5, 10, "K"); px(g, 19, 10, "K");
  px(g, 5, 11, "K"); px(g, 19, 11, "K");
  // 아래 측면
  line(g, 5, 11, 12, 18, "K");
  line(g, 19, 11, 12, 18, "K");

  // 광택 (facet 라인) — 위쪽
  line(g, 7, 7, 9, 10, "K");
  line(g, 17, 7, 15, 10, "K");
  px(g, 10, 8, light); px(g, 11, 8, light);
  // 아래 facets
  line(g, 9, 11, 12, 17, dark);
  line(g, 15, 11, 12, 17, dark);
  // 좌측 큰 광택
  px(g, 8, 9, light); px(g, 8, 10, light); px(g, 9, 9, "W");
  // 아래쪽 어두운 음영
  px(g, 11, 14, dark); px(g, 13, 14, dark);

  // 반짝이 (옆 작은 별)
  if (f === 0) {
    px(g, 2, 4, "W"); px(g, 22, 6, "W");
    px(g, 3, 16, "Y");
  } else if (f === 1) {
    px(g, 20, 3, "W"); px(g, 4, 8, "Y");
  } else if (f === 2) {
    px(g, 1, 12, "W"); px(g, 22, 14, "W");
  } else {
    px(g, 21, 18, "Y"); px(g, 3, 19, "W");
  }
  return g;
}

// ============================================================
// 8b. 혜성 ☄️ (무료) — 머리는 발광 구, 꼬리는 trail로 표현
// ============================================================
const COMET_PAL = {
  K: "#1a1a1a", W: "#ffffff", Y: "#fff8b0", O: "#ffd84a",
  R: "#ff7e3a", B: "#5fb6e8", L: "#a8e0ff",
};
function buildComet(frame) {
  const g = blank();
  const f = frame % 4;
  // 핵 (밝은 흰 + 노랑 외곽)
  disc(g, 12, 12, 3, 3, "W");
  disc(g, 12, 12, 2, 2, "Y");
  px(g, 12, 12, "W");
  // 외곽 노랑/주황 (frame에 따라 깜빡)
  ring(g, 12, 12, 3, 3, "O");
  // 가스 분출 (방사형 작은 빛)
  const spikes = [
    [12, 6], [18, 12], [12, 18], [6, 12],
    [8, 8], [16, 8], [16, 16], [8, 16],
  ];
  for (let i = 0; i < spikes.length; i++) {
    const [sx, sy] = spikes[i];
    const c = (i + f) % 2 === 0 ? "O" : "R";
    px(g, sx, sy, c);
  }
  // 중간 별빛
  if (f === 0) {
    px(g, 4, 4, "Y"); px(g, 19, 4, "Y");
    px(g, 4, 19, "Y"); px(g, 19, 19, "Y");
  } else if (f === 1) {
    px(g, 3, 11, "L"); px(g, 20, 11, "L");
  } else if (f === 2) {
    px(g, 11, 3, "Y"); px(g, 11, 20, "Y");
    px(g, 2, 12, "W"); px(g, 21, 12, "W");
  } else {
    px(g, 5, 7, "L"); px(g, 18, 7, "L");
    px(g, 5, 17, "L"); px(g, 18, 17, "L");
  }
  // 꼬리 시작점 (방향에 맞춰 트레일이 자연스럽게 이어지도록 광택만)
  px(g, 9, 13, "Y"); px(g, 10, 14, "Y");
  return g;
}

// ============================================================
// 9. 도넛 🍩
// ============================================================
const DONUT_PAL = {
  K: "#1a1a1a", D: "#b08458", O: "#e8a854", P: "#ff9eb5",
  R: "#ff5050", Y: "#ffd84a", G: "#7be25b", B: "#5fb6e8", W: "#fff",
};
function buildDonut(frame) {
  const g = blank();
  const f = frame % 4;
  // 도넛 외부 원
  disc(g, 12, 12, 8, 7, "O");
  ring(g, 12, 12, 8, 7, "K");
  // 가운데 구멍 비우기
  for (let y = 9; y <= 15; y++)
    for (let x = 9; x <= 15; x++) {
      const dx = x - 12, dy = y - 12;
      if (dx * dx + dy * dy <= 7) g[y][x] = null;
    }
  // 구멍 외곽선
  ring(g, 12, 12, 2.5, 2.5, "K");
  // 글레이즈 (위쪽 분홍)
  for (let dx = -7; dx <= 7; dx++) {
    const y0 = 12 - Math.round(Math.sqrt(Math.max(0, 49 - dx * dx)));
    for (let yy = y0 + 1; yy <= y0 + 3 && yy < 11; yy++) {
      const dx2 = dx, dy2 = yy - 12;
      if (dx2 * dx2 + dy2 * dy2 > 7) px(g, 12 + dx, yy, "P");
    }
  }
  // 글레이즈 흘러내림
  px(g, 6, 14, "P"); px(g, 6, 15, "P");
  px(g, 18, 13, "P"); px(g, 17, 14, "P");
  // 토핑 (스프링클들, frame따라 색 사이클)
  const sprinkleColors = ["R", "Y", "G", "B", "W"];
  const sprinkles = [
    [9, 9], [14, 8], [10, 10], [15, 10], [16, 11],
    [8, 12], [9, 14], [15, 14], [16, 13],
  ];
  for (let i = 0; i < sprinkles.length; i++) {
    const [sx, sy] = sprinkles[i];
    const c = sprinkleColors[(i + f) % sprinkleColors.length];
    px(g, sx, sy, c);
  }
  return g;
}

// ============================================================
// 10. 해골 💀
// ============================================================
const SKULL_PAL = {
  K: "#0a0a0a", W: "#f0f0f0", G: "#d0d0d0", R: "#ff5050",
  L: "#ffe080", D: "#888",
};
function buildSkull(frame) {
  const g = blank();
  const f = frame % 4;
  // 두개골
  disc(g, 12, 10, 5, 4, "W");
  ring(g, 12, 10, 5, 4, "K");
  // 음영
  px(g, 14, 8, "G"); px(g, 15, 9, "G"); px(g, 14, 11, "G");
  // 아래턱
  for (let dx = -4; dx <= 4; dx++) px(g, 12 + dx, 14, "K");
  for (let dy = 0; dy < 3; dy++) {
    const w = 4 - dy;
    for (let dx = -w; dx <= w; dx++) px(g, 12 + dx, 15 + dy, "W");
    px(g, 12 - w, 15 + dy, "K");
    px(g, 12 + w, 15 + dy, "K");
  }
  // 이빨
  for (let dx = -3; dx <= 3; dx += 2) {
    px(g, 12 + dx, 16, "K");
  }
  // 눈구멍
  disc(g, 9, 10, 1.5, 1.5, "K");
  disc(g, 15, 10, 1.5, 1.5, "K");
  // 눈 발광 (Pro 깜빡)
  if (f % 2 === 0) {
    px(g, 9, 10, "R"); px(g, 15, 10, "R");
  } else {
    px(g, 9, 10, "L"); px(g, 15, 10, "L");
  }
  // 코구멍
  px(g, 11, 12, "K"); px(g, 12, 12, "K"); px(g, 12, 13, "K");
  // 두개골 균열 (디테일)
  px(g, 11, 7, "D"); px(g, 12, 6, "D"); px(g, 13, 7, "D");
  return g;
}

// ============================================================
// 11. 안구 👁
// ============================================================
const EYE_PAL = {
  K: "#0a0a0a", W: "#ffffff", G: "#d0d0d0", B: "#3b82f6",
  D: "#1e3a8a", R: "#ff5050", L: "#5fb6e8",
};
function buildEyeball(frame, action, opts) {
  // opts.lookDx/lookDy 있으면 마우스 방향 응시 (content.js가 전달)
  if (opts && (opts.lookDx != null || opts.lookDy != null)) {
    return buildEyeballWithLook(frame, opts);
  }
  const g = blank();
  const f = frame % 8;
  // 흰자
  disc(g, 12, 12, 7, 6, "W");
  ring(g, 12, 12, 7, 6, "K");
  // 동공 위치 (frame에 따라 8방향 이동)
  const angle = (f / 8) * Math.PI * 2;
  const pupilX = 12 + Math.round(Math.cos(angle) * 2.5);
  const pupilY = 12 + Math.round(Math.sin(angle) * 1.8);
  // 홍채 (파랑)
  disc(g, pupilX, pupilY, 3, 3, "B");
  ring(g, pupilX, pupilY, 3, 3, "D");
  // 홍채 패턴
  px(g, pupilX - 1, pupilY - 1, "L");
  px(g, pupilX + 1, pupilY + 1, "L");
  // 동공
  disc(g, pupilX, pupilY, 1, 1, "K");
  // 반사광
  px(g, pupilX - 1, pupilY - 1, "W");
  // 핏줄 (빨간 가닥)
  line(g, 6, 8, 9, 10, "R");
  line(g, 18, 14, 16, 13, "R");
  line(g, 8, 16, 10, 14, "R");
  // 눈꺼풀 음영 (위)
  for (let dx = -6; dx <= 6; dx++) {
    px(g, 12 + dx, 7 - Math.round(Math.abs(dx) / 3) + (Math.abs(dx) > 5 ? -1 : 0), null);
  }
  return g;
}

// ============================================================
// 12. 에너지볼 ⚡
// ============================================================
const ENERGY_PAL = {
  K: "#1a1a1a", Y: "#ffd84a", W: "#ffffff", O: "#ff7e3a",
  L: "#fff8b0", B: "#9333ea",
};
function buildEnergyBall(frame) {
  const g = blank();
  const f = frame % 8;
  // 핵 (흰 중심 + 노랑 외곽)
  disc(g, 12, 12, 3, 3, "L");
  disc(g, 12, 12, 2, 2, "W");
  // 외곽 발광 (가변)
  const pulse = (f % 4);
  const outerR = 5 + pulse * 0.3;
  ring(g, 12, 12, outerR, outerR, "Y");
  // 번개 가시 (4방향)
  const spikes = [
    [12, 5, 12, 7], [12, 17, 12, 19],
    [5, 12, 7, 12], [17, 12, 19, 12],
    [7, 7, 9, 9], [17, 7, 15, 9], [7, 17, 9, 15], [17, 17, 15, 15],
  ];
  const visibleSpikes = (f % 2 === 0) ? spikes.slice(0, 4) : spikes.slice(4);
  for (const [x1, y1, x2, y2] of visibleSpikes) {
    line(g, x1, y1, x2, y2, "Y");
    px(g, x1, y1, "O");
  }
  // 깜빡이는 점들 (랜덤 위치)
  if (f % 2 === 0) {
    px(g, 4, 8, "W"); px(g, 19, 14, "W"); px(g, 8, 19, "W");
  } else {
    px(g, 19, 8, "W"); px(g, 4, 14, "W"); px(g, 16, 19, "W");
  }
  return g;
}

// ============================================================
// 13. 반짝별 ⭐
// ============================================================
const STAR_PAL = { Y: "#ffd84a", L: "#fff8b0", D: "#a06a00", W: "#fff" };
function buildStar(frame) {
  const g = blank();
  const f = frame % 4;
  // 별 모양 (5각)
  const pts5 = [
    [12, 3], [13, 9], [19, 9], [14, 13], [16, 19],
    [12, 15], [8, 19], [10, 13], [5, 9], [11, 9],
  ];
  // f에 따라 회전 효과 (크기 변동)
  let scale = 1.0;
  if (f === 0) scale = 1.0;
  else if (f === 1) scale = 0.9;
  else if (f === 2) scale = 1.0;
  else scale = 0.85;
  // 별 채우기 (간단하게 — 점 별)
  if (f % 2 === 0) {
    // 큰 별
    for (let dy = -7; dy <= 7; dy++) {
      for (let dx = -7; dx <= 7; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 6 - Math.abs(dx) * Math.abs(dy) * 0.1) {
          const d2 = dx * dx + dy * dy;
          if (d2 <= 50) px(g, 12 + dx, 12 + dy, "Y");
        }
      }
    }
    // 5각 강조
    for (const [x, y] of pts5) px(g, x, y, "L");
    // 가운데 발광
    disc(g, 12, 12, 2, 2, "L");
    px(g, 12, 12, "W");
  } else {
    // 작은 별
    disc(g, 12, 12, 4, 4, "Y");
    px(g, 12, 7, "Y"); px(g, 12, 17, "Y");
    px(g, 7, 12, "Y"); px(g, 17, 12, "Y");
    px(g, 12, 12, "L");
  }
  // 외곽 점
  if (f === 0) {
    px(g, 3, 4, "W"); px(g, 20, 4, "W");
    px(g, 4, 20, "W"); px(g, 21, 21, "W");
  }
  return g;
}

// ============================================================
// Aquarium collection
// ============================================================
const FISH_PAL = {
  K: "#103344", W: "#fff7d6", O: "#ff9f1c", Y: "#ffd166", R: "#ef476f",
  B: "#4cc9f0", D: "#118ab2", G: "#06d6a0", P: "#b517ff", L: "#d9fff8",
  N: "#222831", C: "#f15bb5",
};

function buildSmallFish(frame, body = "O", fin = "Y") {
  const g = blank();
  const f = frame % 8;
  const wag = f % 2 === 0 ? -1 : 1;
  disc(g, 12, 12, 7, 4, body);
  ring(g, 12, 12, 7, 4, "K");
  px(g, 17, 11, "W"); px(g, 18, 11, "K");
  line(g, 5, 12, 1, 9 + wag, fin);
  line(g, 5, 12, 1, 15 - wag, fin);
  line(g, 1, 9 + wag, 1, 15 - wag, "K");
  line(g, 9, 8, 12, 5 + wag, fin);
  line(g, 10, 16, 13, 19 - wag, fin);
  px(g, 14, 12, "L"); px(g, 15, 13, "L");
  return g;
}

function buildGoldfish(frame) {
  const g = buildSmallFish(frame, "O", "Y");
  const f = frame % 8;
  rect(g, 10, 10, 2, 5, "Y");
  px(g, 13, 9, f % 2 ? "W" : "Y");
  return g;
}

function buildClownfish(frame) {
  const g = buildSmallFish(frame, "O", "W");
  for (let y = 8; y <= 16; y++) {
    px(g, 8, y, "W"); px(g, 9, y, "W"); px(g, 10, y, "K");
    px(g, 14, y, "W"); px(g, 15, y, "W"); px(g, 16, y, "K");
  }
  return g;
}

function buildBlueTang(frame) {
  const g = buildSmallFish(frame, "B", "Y");
  const f = frame % 8;
  line(g, 8, 9, 14, 15, "D");
  line(g, 9, 8, 15, 14, "D");
  rect(g, 3, 11 + (f % 2), 3, 2, "Y");
  return g;
}

function buildNeonTetra(frame) {
  const g = buildSmallFish(frame, "D", "R");
  line(g, 6, 10, 18, 10, "B");
  line(g, 6, 13, 18, 13, "R");
  px(g, 17, 11, "W"); px(g, 18, 11, "K");
  return g;
}

function buildPufferfish(frame) {
  const g = blank();
  const f = frame % 8;
  const puff = f < 4 ? 1 : 0;
  disc(g, 12, 12, 6 + puff, 6 + puff, "Y");
  ring(g, 12, 12, 6 + puff, 6 + puff, "K");
  px(g, 15, 10, "W"); px(g, 16, 10, "K");
  px(g, 17, 14, "K");
  const spikes = [[12, 4, 12, 2], [12, 20, 12, 22], [5, 12, 3, 12], [19, 12, 21, 12], [7, 7, 5, 5], [17, 7, 19, 5], [7, 17, 5, 19], [17, 17, 19, 19]];
  for (const [x1, y1, x2, y2] of spikes) line(g, x1, y1, x2, y2, "K");
  line(g, 6, 12, 2, 10 + (f % 2), "O");
  return g;
}

const JELLY_PAL = { K: "#27364a", P: "#ff9de2", L: "#ffd6f4", B: "#9bf6ff", W: "#fff" };
function buildJellyfish(frame) {
  const g = blank();
  const f = frame % 8;
  const bob = f < 4 ? 0 : 1;
  disc(g, 12, 9 + bob, 6, 4, "P");
  ring(g, 12, 9 + bob, 6, 4, "K");
  rect(g, 7, 11 + bob, 11, 2, "L");
  for (let i = 0; i < 5; i++) {
    const x = 8 + i * 2;
    const sway = ((f + i) % 3) - 1;
    line(g, x, 13 + bob, x + sway, 19, i % 2 ? "B" : "P");
    px(g, x + sway, 20, i % 2 ? "B" : "P");
  }
  px(g, 10, 9 + bob, "W"); px(g, 14, 8 + bob, "W");
  return g;
}

const OCTO_PAL = { K: "#261b35", P: "#a855f7", D: "#7e22ce", L: "#e9d5ff", W: "#fff" };
function buildOctopus(frame) {
  const g = blank();
  const f = frame % 8;
  const bob = f % 2;
  disc(g, 12, 9 + bob, 6, 6, "P");
  ring(g, 12, 9 + bob, 6, 6, "K");
  px(g, 10, 9 + bob, "W"); px(g, 14, 9 + bob, "W");
  px(g, 10, 10 + bob, "K"); px(g, 14, 10 + bob, "K");
  for (let i = 0; i < 6; i++) {
    const x = 7 + i * 2;
    const sway = ((f + i) % 3) - 1;
    line(g, x, 14 + bob, x + sway, 20, i % 2 ? "D" : "P");
    px(g, x + sway, 21, "K");
  }
  px(g, 12, 13 + bob, "L");
  return g;
}

const TURTLE_PAL = { K: "#17391f", G: "#3fbf6f", D: "#20804a", S: "#8d6b3f", L: "#a7f3d0", W: "#fff" };
function buildTurtle(frame) {
  const g = blank();
  const f = frame % 8;
  disc(g, 12, 12, 6, 5, "S");
  ring(g, 12, 12, 6, 5, "K");
  disc(g, 18, 11, 3, 3, "G");
  ring(g, 18, 11, 3, 3, "K");
  px(g, 19, 10, "W"); px(g, 20, 10, "K");
  line(g, 8, 8, 4, 6 + (f % 2), "G");
  line(g, 8, 16, 4, 18 - (f % 2), "G");
  line(g, 14, 8, 16, 5 + (f % 2), "G");
  line(g, 14, 16, 16, 19 - (f % 2), "G");
  line(g, 9, 10, 15, 14, "D");
  line(g, 9, 14, 15, 10, "D");
  return g;
}

const SEAHORSE_PAL = { K: "#4a2600", Y: "#f6c453", O: "#f59e0b", L: "#fff3b0", B: "#67e8f9", W: "#fff" };
function buildSeahorse(frame) {
  const g = blank();
  const f = frame % 8;
  disc(g, 13, 8, 4, 4, "Y");
  ring(g, 13, 8, 4, 4, "K");
  line(g, 16, 8, 21, 9, "Y"); px(g, 21, 9, "K");
  disc(g, 11, 13, 4, 6, "O");
  ring(g, 11, 13, 4, 6, "K");
  px(g, 14, 7, "W"); px(g, 15, 7, "K");
  for (let y = 10; y <= 17; y += 2) px(g, 8, y, "L");
  line(g, 11, 18, 8, 21, "O");
  line(g, 8, 21, 12, 22, "O");
  line(g, 9, 12, 5, 10 + (f % 2), "B");
  return g;
}

const CRAB_PAL = { K: "#4a1010", R: "#ef4444", D: "#b91c1c", W: "#fff", P: "#fecaca" };
function buildCrab(frame) {
  const g = blank();
  const f = frame % 8;
  disc(g, 12, 13, 6, 4, "R");
  ring(g, 12, 13, 6, 4, "K");
  px(g, 10, 9, "W"); px(g, 14, 9, "W"); px(g, 10, 10, "K"); px(g, 14, 10, "K");
  line(g, 7, 12, 3, 9 + (f % 2), "D"); disc(g, 2, 8 + (f % 2), 2, 2, "R"); ring(g, 2, 8 + (f % 2), 2, 2, "K");
  line(g, 17, 12, 21, 9 + (f % 2), "D"); disc(g, 22, 8 + (f % 2), 2, 2, "R"); ring(g, 22, 8 + (f % 2), 2, 2, "K");
  for (let i = 0; i < 3; i++) {
    line(g, 8 + i * 2, 16, 5 + i, 20 - (f % 2), "K");
    line(g, 16 - i * 2, 16, 19 - i, 20 - (f % 2), "K");
  }
  return g;
}

const SHRIMP_PAL = { K: "#4a1d1d", R: "#fb7185", P: "#fecdd3", W: "#fff", Y: "#fed7aa" };
function buildShrimp(frame) {
  const g = blank();
  const f = frame % 8;
  for (let i = 0; i < 6; i++) disc(g, 8 + i * 2, 12 + Math.sin((f + i) / 2) * 2, 2, 3, i % 2 ? "R" : "P");
  for (let i = 0; i < 6; i++) ring(g, 8 + i * 2, 12 + Math.sin((f + i) / 2) * 2, 2, 3, "K");
  px(g, 18, 10, "W"); px(g, 19, 10, "K");
  line(g, 19, 11, 23, 8, "K"); line(g, 19, 11, 23, 14, "K");
  line(g, 6, 12, 2, 9 + (f % 2), "R"); line(g, 6, 12, 2, 15 - (f % 2), "R");
  return g;
}

const RAY_PAL = { K: "#182230", B: "#38bdf8", D: "#0ea5e9", L: "#bae6fd", W: "#fff" };
function buildMantaRay(frame) {
  const g = blank();
  const f = frame % 8;
  const flap = f % 4 < 2 ? -1 : 1;
  disc(g, 12, 12, 5, 4, "D");
  ring(g, 12, 12, 5, 4, "K");
  line(g, 8, 12, 1, 8 + flap, "B"); line(g, 8, 13, 1, 16 - flap, "B");
  line(g, 16, 12, 23, 8 + flap, "B"); line(g, 16, 13, 23, 16 - flap, "B");
  line(g, 12, 16, 12, 22, "K");
  px(g, 10, 11, "W"); px(g, 14, 11, "W"); px(g, 10, 12, "K"); px(g, 14, 12, "K");
  return g;
}

const SNAIL_PAL = { K: "#2b2118", S: "#b7791f", P: "#facc15", G: "#34d399", W: "#fff" };
function buildSeaSnail(frame) {
  const g = blank();
  const f = frame % 8;
  disc(g, 10, 13, 5, 5, "S");
  ring(g, 10, 13, 5, 5, "K");
  line(g, 10, 13, 13, 13, "P"); line(g, 13, 13, 13, 10, "P"); line(g, 13, 10, 10, 10, "P");
  rect(g, 12, 15, 8, 3, "G"); ring(g, 17, 16, 4, 2, "K");
  line(g, 19, 15, 22, 12 + (f % 2), "G"); line(g, 19, 15, 22, 17 - (f % 2), "G");
  px(g, 22, 12 + (f % 2), "W"); px(g, 22, 17 - (f % 2), "W");
  return g;
}

// ============================================================
// 오리지널 육성 동물 친구들
// ============================================================
// ----- 강아지: 시바견 "Kongi" -----
const PUP_PAL = { K: "#3a2a1e", O: "#eda35a", D: "#cf7c3c", W: "#fff3e0", P: "#ffa6b6", N: "#2a1c14", I: "#ffffff" };
function buildPup(frame) {
  const g = blank();
  const f = frame % 8;
  const bob = f % 4 < 2 ? 0 : 1;
  const cy = 13 + bob;
  // 쫑긋 귀 (검은 테두리 + 탄색 + 분홍 안쪽)
  tri(g, 6, cy - 9, 4, "K"); tri(g, 18, cy - 9, 4, "K");
  tri(g, 6, cy - 8, 3, "O"); tri(g, 18, cy - 8, 3, "O");
  tri(g, 6, cy - 7, 2, "P"); tri(g, 18, cy - 7, 2, "P");
  // 머리
  disc(g, 12, cy, 8, 7, "O");
  ring(g, 12, cy, 8, 7, "K");
  // 크림색 볼 + 주둥이
  disc(g, 7, cy + 2, 2, 2, "W"); disc(g, 17, cy + 2, 2, 2, "W");
  disc(g, 12, cy + 3, 5, 3, "W");
  // 눈썹(콩고물 점) + 눈 + 반짝임
  px(g, 8, cy - 3, "W"); px(g, 16, cy - 3, "W");
  rect(g, 8, cy - 1, 2, 3, "K"); rect(g, 15, cy - 1, 2, 3, "K");
  px(g, 9, cy - 1, "I"); px(g, 16, cy - 1, "I");
  // 코 + 입
  rect(g, 11, cy + 1, 2, 2, "N");
  line(g, 12, cy + 3, 12, cy + 4, "K");
  line(g, 12, cy + 4, 10, cy + 5, "K"); line(g, 12, cy + 4, 14, cy + 5, "K");
  // 볼터치
  px(g, 6, cy + 3, "P"); px(g, 18, cy + 3, "P");
  return g;
}

// ----- 고양이: "Nabi" (회색 태비) -----
const KIT_PAL = { K: "#241f2e", G: "#9aa6b8", D: "#6b7689", W: "#fbfcff", P: "#ffb3c8", N: "#ff8fae", I: "#ffffff", S: "#cdd6e2" };
function buildKit(frame) {
  const g = blank();
  const f = frame % 8;
  const bob = f % 4 < 2 ? 0 : 1;
  const cy = 13 + bob;
  // 귀
  tri(g, 6, cy - 9, 4, "K"); tri(g, 18, cy - 9, 4, "K");
  tri(g, 6, cy - 8, 3, "G"); tri(g, 18, cy - 8, 3, "G");
  tri(g, 6, cy - 7, 2, "P"); tri(g, 18, cy - 7, 2, "P");
  // 머리
  disc(g, 12, cy, 8, 7, "G");
  ring(g, 12, cy, 8, 7, "K");
  // 태비 줄무늬(이마)
  px(g, 12, cy - 6, "D"); px(g, 11, cy - 5, "D"); px(g, 13, cy - 5, "D"); px(g, 12, cy - 4, "D");
  px(g, 5, cy, "D"); px(g, 19, cy, "D");
  // 밝은 주둥이
  disc(g, 12, cy + 3, 5, 3, "W");
  // 눈 + 반짝임
  rect(g, 8, cy - 1, 2, 3, "K"); rect(g, 15, cy - 1, 2, 3, "K");
  px(g, 8, cy, "I"); px(g, 15, cy, "I");
  // 코 + 입
  px(g, 11, cy + 1, "N"); px(g, 12, cy + 1, "N"); px(g, 13, cy + 1, "N");
  line(g, 12, cy + 2, 11, cy + 3, "K"); line(g, 12, cy + 2, 13, cy + 3, "K");
  // 수염
  line(g, 5, cy + 1, 1, cy, "S"); line(g, 5, cy + 2, 1, cy + 3, "S");
  line(g, 19, cy + 1, 23, cy, "S"); line(g, 19, cy + 2, 23, cy + 3, "S");
  // 볼터치
  px(g, 6, cy + 3, "P"); px(g, 18, cy + 3, "P");
  return g;
}

// ----- 토끼: "Mochi" (흰 토끼, 긴 귀) -----
const BUNNY_PAL = { K: "#3a2e3a", W: "#fdfdff", S: "#ece5f1", P: "#ffb0c6", R: "#ff8aa6", I: "#ffffff" };
function buildBunny(frame) {
  const g = blank();
  const f = frame % 8;
  const bob = f % 4 < 2 ? 0 : -1;
  const cy = 14 + bob;
  // 긴 귀 (검은 테두리 + 흰색 + 분홍 안쪽)
  rect(g, 6, cy - 13, 5, 11, "K"); rect(g, 14, cy - 13, 5, 11, "K");
  rect(g, 7, cy - 12, 3, 9, "W"); rect(g, 15, cy - 12, 3, 9, "W");
  rect(g, 8, cy - 11, 1, 6, "P"); rect(g, 16, cy - 11, 1, 6, "P");
  // 머리
  disc(g, 12, cy, 7, 6, "W");
  ring(g, 12, cy, 7, 6, "K");
  // 눈 + 반짝임
  rect(g, 8, cy - 1, 2, 3, "K"); rect(g, 14, cy - 1, 2, 3, "K");
  px(g, 8, cy - 1, "I"); px(g, 14, cy - 1, "I");
  // 코 + 입
  px(g, 11, cy + 1, "R"); px(g, 12, cy + 1, "R"); px(g, 13, cy + 1, "R");
  line(g, 12, cy + 2, 12, cy + 3, "K");
  line(g, 12, cy + 3, 10, cy + 4, "K"); line(g, 12, cy + 3, 14, cy + 4, "K");
  // 볼터치
  disc(g, 7, cy + 2, 1, 1, "P"); disc(g, 17, cy + 2, 1, 1, "P");
  return g;
}

// ----- 레서판다: "Popo" -----
const FOX_PAL = { K: "#2a1410", O: "#d6713c", D: "#a84a22", W: "#fff1df", C: "#f6c89a", N: "#2a1c14", I: "#ffffff", P: "#ff9a86" };
function buildFox(frame) {
  const g = blank();
  const f = frame % 8;
  const bob = f % 4 < 2 ? 0 : 1;
  const cy = 13 + bob;
  // 뾰족 귀 (검은 테두리 + 적갈색 + 크림 안쪽)
  tri(g, 6, cy - 9, 4, "K"); tri(g, 18, cy - 9, 4, "K");
  tri(g, 6, cy - 8, 3, "O"); tri(g, 18, cy - 8, 3, "O");
  tri(g, 6, cy - 7, 2, "C"); tri(g, 18, cy - 7, 2, "C");
  // 머리(적갈색)
  disc(g, 12, cy, 8, 7, "O");
  ring(g, 12, cy, 8, 7, "K");
  // 흰 얼굴 무늬(볼 + 눈썹) — 레서판다 상징
  disc(g, 7, cy + 1, 3, 3, "W"); disc(g, 17, cy + 1, 3, 3, "W");
  rect(g, 8, cy - 3, 2, 1, "W"); rect(g, 15, cy - 3, 2, 1, "W");
  // 흰 주둥이
  disc(g, 12, cy + 3, 3, 2, "W");
  // 눈 + 반짝임
  rect(g, 8, cy - 1, 2, 2, "K"); rect(g, 15, cy - 1, 2, 2, "K");
  px(g, 8, cy - 1, "I"); px(g, 15, cy - 1, "I");
  // 눈물 줄무늬(짙은 갈색)
  px(g, 9, cy + 1, "D"); px(g, 9, cy + 2, "D"); px(g, 15, cy + 1, "D"); px(g, 15, cy + 2, "D");
  // 코 + 입
  rect(g, 11, cy + 2, 2, 1, "N");
  line(g, 12, cy + 3, 12, cy + 4, "K");
  // 볼터치
  px(g, 6, cy + 3, "P"); px(g, 18, cy + 3, "P");
  return g;
}

// ----- 펭귄: "Pengu" (통통 전신) -----
const HAM_PAL = { K: "#1b2331", B: "#33415c", W: "#fefeff", O: "#ffb13b", D: "#e8901f", P: "#ff9bb0", I: "#ffffff" };
function buildHamster(frame) {
  const g = blank();
  const f = frame % 8;
  const bob = f % 4 < 2 ? 0 : 1;
  const yo = bob;
  // 몸통(남색 달걀형)
  disc(g, 12, 13 + yo, 7, 9, "B");
  ring(g, 12, 13 + yo, 7, 9, "K");
  // 날개(양옆 작은 지느러미)
  px(g, 4, 13 + yo, "B"); px(g, 4, 14 + yo, "B"); px(g, 5, 15 + yo, "B");
  px(g, 19, 13 + yo, "B"); px(g, 19, 14 + yo, "B"); px(g, 18, 15 + yo, "B");
  px(g, 3, 13 + yo, "K"); px(g, 3, 14 + yo, "K"); px(g, 4, 15 + yo, "K");
  px(g, 20, 13 + yo, "K"); px(g, 20, 14 + yo, "K"); px(g, 19, 15 + yo, "K");
  // 흰 앞면(얼굴+배) — 위·옆은 남색 남김
  disc(g, 12, 14 + yo, 5, 7, "W");
  // 눈 + 반짝임 (흰 얼굴 위쪽)
  rect(g, 9, 9 + yo, 2, 2, "K"); rect(g, 13, 9 + yo, 2, 2, "K");
  px(g, 9, 9 + yo, "I"); px(g, 13, 9 + yo, "I");
  // 부리(주황 다이아)
  px(g, 11, 11 + yo, "O"); px(g, 12, 11 + yo, "O");
  px(g, 11, 12 + yo, "D"); px(g, 12, 12 + yo, "D");
  // 볼터치
  px(g, 7, 11 + yo, "P"); px(g, 17, 11 + yo, "P");
  // 발(주황)
  rect(g, 8, 22 + yo, 3, 1, "O"); rect(g, 14, 22 + yo, 3, 1, "O");
  return g;
}

// ============================================================
// 캐릭터 사전
// ============================================================
function makeRender(buildFn, palette) {
  return function (ctx, frame, action, opts) {
    const grid = buildFn(frame, action || "walk", opts);
    renderGrid(ctx, grid, palette);
  };
}

export const CHARACTERS = {
  // === 무료 (5종) ===
  ufo: {
    id: "ufo", name: "UFO", premium: false, type: "flyer",
    render: makeRender(buildUFO, UFO_PAL), build: buildUFO, palette: UFO_PAL,
    frames: 8,
    movement: { speed: 1.1, accel: 0.035, damping: 0.95, changeMs: [4500, 9000], area: { x: [0.1, 0.9], y: [0.1, 0.5] }, wobble: 0.03 },
  },
  car: {
    id: "car", name: "Sports Car", premium: false, type: "flyer",
    render: makeRender(buildCar, CAR_PAL), build: buildCar, palette: CAR_PAL,
    frames: 8,
    movement: { speed: 2.5, accel: 0.13, damping: 0.93, changeMs: [1800, 3500], area: { x: [0.0, 1.0], y: [0.55, 0.85] }, wobble: 0.05 },
  },
  slime: {
    id: "slime", name: "Slime", premium: false, type: "flyer",
    render: makeRender(buildSlime, SLIME_PAL), build: buildSlime, palette: SLIME_PAL,
    frames: 8,
    movement: { speed: 1.8, accel: 0.1, damping: 0.9, changeMs: [2000, 4500], area: { x: [0.05, 0.95], y: [0.2, 0.85] }, wobble: 0.12 },
  },
  comet: {
    id: "comet", name: "Comet", premium: false, type: "flyer",
    render: makeRender(buildComet, COMET_PAL), build: buildComet, palette: COMET_PAL,
    frames: 4, orientToMovement: true,
    movement: { speed: 2.8, accel: 0.15, damping: 0.92, changeMs: [1500, 3500], area: { x: [0.0, 1.0], y: [0.05, 0.85] }, wobble: 0.06 },
  },
  star: {
    id: "star", name: "Twinkle Star", premium: false, type: "flyer",
    render: makeRender(buildStar, STAR_PAL), build: buildStar, palette: STAR_PAL,
    frames: 4,
    movement: { speed: 1.4, accel: 0.1, damping: 0.92, changeMs: [2000, 5000], area: { x: [0.05, 0.95], y: [0.05, 0.6] }, wobble: 0.12 },
  },
  pup: {
    id: "pup", name: "Kongi", premium: false, type: "animal",
    render: makeRender(buildPup, PUP_PAL), build: buildPup, palette: PUP_PAL,
    frames: 8,
    movement: { speed: 1.9, accel: 0.12, damping: 0.9, changeMs: [1500, 3600], area: { x: [0.03, 0.97], y: [0.38, 0.94] }, wobble: 0.12 },
  },
  kit: {
    id: "kit", name: "Nabi", premium: false, type: "animal",
    render: makeRender(buildKit, KIT_PAL), build: buildKit, palette: KIT_PAL,
    frames: 8,
    movement: { speed: 1.55, accel: 0.09, damping: 0.92, changeMs: [2200, 5200], area: { x: [0.04, 0.96], y: [0.22, 0.88] }, wobble: 0.08 },
  },
  bunny: {
    id: "bunny", name: "Mochi", premium: false, type: "animal",
    render: makeRender(buildBunny, BUNNY_PAL), build: buildBunny, palette: BUNNY_PAL,
    frames: 8,
    movement: { speed: 2.15, accel: 0.16, damping: 0.86, changeMs: [1200, 3000], area: { x: [0.04, 0.96], y: [0.36, 0.93] }, wobble: 0.16 },
  },
  fox: {
    id: "fox", name: "Popo", premium: true, type: "animal",
    render: makeRender(buildFox, FOX_PAL), build: buildFox, palette: FOX_PAL,
    frames: 8,
    movement: { speed: 2.25, accel: 0.13, damping: 0.9, changeMs: [1500, 3600], area: { x: [0.03, 0.97], y: [0.26, 0.9] }, wobble: 0.1 },
  },
  hamster: {
    id: "hamster", name: "Pengu", premium: true, type: "animal",
    render: makeRender(buildHamster, HAM_PAL), build: buildHamster, palette: HAM_PAL,
    frames: 8,
    movement: { speed: 1.25, accel: 0.08, damping: 0.93, changeMs: [2600, 6200], area: { x: [0.05, 0.95], y: [0.45, 0.94] }, wobble: 0.11 },
  },

  // === Pro (9종) ===
  rocket: {
    id: "rocket", name: "Rocket", premium: true, type: "flyer",
    render: makeRender(buildRocket, ROCKET_PAL), build: buildRocket, palette: ROCKET_PAL,
    frames: 8, orientToMovement: true,
    // Emit from the exhaust flame, just left of the body centre (cols 9-13).
    effectAnchor: { x: 0.47, y: 0.86 },
    movement: { speed: 3.0, accel: 0.18, damping: 0.94, changeMs: [1200, 3000], area: { x: [0.05, 0.95], y: [0.05, 0.85] }, wobble: 0.04 },
  },
  saturn: {
    id: "saturn", name: "Saturn", premium: true, type: "flyer",
    render: makeRender(buildSaturn, SATURN_PAL), build: buildSaturn, palette: SATURN_PAL,
    frames: 8,
    movement: { speed: 0.7, accel: 0.04, damping: 0.97, changeMs: [5000, 11000], area: { x: [0.1, 0.9], y: [0.1, 0.5] }, wobble: 0.02 },
  },
  gem: {
    id: "gem", name: "Gem", premium: true, type: "flyer",
    render: makeRender(buildGem, GEM_PAL), build: buildGem, palette: GEM_PAL,
    frames: 4,
    movement: { speed: 1.0, accel: 0.06, damping: 0.95, changeMs: [3500, 7500], area: { x: [0.05, 0.95], y: [0.1, 0.7] }, wobble: 0.05 },
  },
  donut: {
    id: "donut", name: "Donut", premium: true, type: "flyer",
    render: makeRender(buildDonut, DONUT_PAL), build: buildDonut, palette: DONUT_PAL,
    frames: 4,
    movement: { speed: 1.2, accel: 0.08, damping: 0.93, changeMs: [2500, 5500], area: { x: [0.05, 0.95], y: [0.15, 0.85] }, wobble: 0.1 },
  },
  skull: {
    id: "skull", name: "Skull", premium: true, type: "flyer",
    render: makeRender(buildSkull, SKULL_PAL), build: buildSkull, palette: SKULL_PAL,
    frames: 4,
    movement: { speed: 1.1, accel: 0.06, damping: 0.94, changeMs: [3500, 7000], area: { x: [0.05, 0.95], y: [0.1, 0.8] }, wobble: 0.07 },
  },
  eyeball: {
    id: "eyeball", name: "Eyeball", premium: true, type: "flyer",
    render: makeRender(buildEyeball, EYE_PAL), build: buildEyeball, palette: EYE_PAL,
    frames: 8, // 마우스 추적은 비활성 (성능 이슈)
    movement: { speed: 0.8, accel: 0.04, damping: 0.96, changeMs: [4000, 8500], area: { x: [0.05, 0.95], y: [0.1, 0.8] }, wobble: 0.05 },
  },
  energyball: {
    id: "energyball", name: "Energy Orb", premium: true, type: "flyer",
    render: makeRender(buildEnergyBall, ENERGY_PAL), build: buildEnergyBall, palette: ENERGY_PAL,
    frames: 8,
    movement: { speed: 2.5, accel: 0.2, damping: 0.85, changeMs: [800, 2500], area: { x: [0.05, 0.95], y: [0.1, 0.85] }, wobble: 0.25 },
  },
  bug: {
    id: "bug", name: "Roach", premium: true, type: "flyer",
    render: makeRender(buildBug, BUG_PAL), build: buildBug, palette: BUG_PAL,
    frames: 8, orientToMovement: true,
    movement: { speed: 2.8, accel: 0.22, damping: 0.82, changeMs: [600, 2000], area: { x: [0.0, 1.0], y: [0.4, 0.95] }, wobble: 0.25 },
  },
  tank: {
    id: "tank", name: "Tank", premium: true, type: "flyer",
    render: makeRender(buildTank, TANK_PAL), build: buildTank, palette: TANK_PAL,
    frames: 4, orientToMovement: true,
    movement: { speed: 1.2, accel: 0.08, damping: 0.94, changeMs: [2000, 4500], area: { x: [0.05, 0.95], y: [0.15, 0.85] }, wobble: 0.04 },
  },
};

export const DEFAULT_CHARACTER = "ufo";
