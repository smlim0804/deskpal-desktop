const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BUILD_DIR = path.join(ROOT, "build");
const ICONSET_DIR = path.join(BUILD_DIR, "icon.iconset");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function color(hex, alpha = 255) {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), alpha];
}

function blend(data, width, x, y, next) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const i = (y * width + x) * 4;
  const a = next[3] / 255;
  data[i] = Math.round(next[0] * a + data[i] * (1 - a));
  data[i + 1] = Math.round(next[1] * a + data[i + 1] * (1 - a));
  data[i + 2] = Math.round(next[2] * a + data[i + 2] * (1 - a));
  data[i + 3] = Math.min(255, Math.round(next[3] + data[i + 3] * (1 - a)));
}

function spriteBlank() {
  return Array.from({ length: 24 }, () => new Array(24).fill(null));
}

function spritePx(grid, x, y, c) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= 24 || iy < 0 || iy >= 24) return;
  grid[iy][ix] = c;
}

function spriteDisc(grid, cx, cy, rx, ry, c) {
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y += 1) {
    for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x += 1) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.02) spritePx(grid, cx + x, cy + y, c);
    }
  }
}

function rocketSprite() {
  const grid = spriteBlank();
  spritePx(grid, 11, 2, "R");
  spritePx(grid, 12, 2, "R");
  for (let y = 3; y <= 5; y += 1) {
    for (let x = 10; x <= 13; x += 1) spritePx(grid, x, y, "R");
  }
  spritePx(grid, 13, 4, "D");
  spritePx(grid, 13, 5, "D");
  spritePx(grid, 11, 1, "K");
  spritePx(grid, 12, 1, "K");
  spritePx(grid, 10, 2, "K");
  spritePx(grid, 13, 2, "K");
  for (let y = 3; y <= 5; y += 1) {
    spritePx(grid, 9, y, "K");
    spritePx(grid, 14, y, "K");
  }

  for (let y = 6; y <= 14; y += 1) {
    for (let x = 9; x <= 14; x += 1) spritePx(grid, x, y, "W");
    spritePx(grid, 13, y, "G");
    spritePx(grid, 14, y, "G");
    spritePx(grid, 8, y, "K");
    spritePx(grid, 15, y, "K");
  }

  spriteDisc(grid, 11, 8, 1, 1, "B");
  spritePx(grid, 10, 8, "K");
  spritePx(grid, 12, 8, "K");
  spritePx(grid, 11, 7, "K");
  spritePx(grid, 11, 9, "K");
  spritePx(grid, 11, 8, "W");

  for (let x = 8; x <= 15; x += 1) spritePx(grid, x, 11, "R");
  spritePx(grid, 7, 13, "R");
  spritePx(grid, 6, 14, "R");
  spritePx(grid, 6, 15, "R");
  spritePx(grid, 7, 14, "R");
  spritePx(grid, 7, 15, "R");
  spritePx(grid, 16, 13, "R");
  spritePx(grid, 17, 14, "R");
  spritePx(grid, 17, 15, "R");
  spritePx(grid, 16, 14, "R");
  spritePx(grid, 16, 15, "R");
  spritePx(grid, 5, 15, "K");
  spritePx(grid, 18, 15, "K");
  spritePx(grid, 10, 15, "K");
  spritePx(grid, 13, 15, "K");
  for (let x = 10; x <= 13; x += 1) spritePx(grid, x, 16, "K");

  const flameRows = [4, 5, 6, 5, 4];
  for (let i = 0; i < flameRows.length; i += 1) {
    const cx = 9 + i;
    for (let dy = 0; dy < flameRows[i]; dy += 1) {
      const y = 17 + dy;
      const c = dy < 1 ? "W" : dy < 2 ? "F" : dy < 3 ? "Y" : dy < 4 ? "O" : "R";
      spritePx(grid, cx, y, c);
    }
  }
  return grid;
}

function renderSprite(data, size, grid, palette, options = {}) {
  const angle = options.angle || 0;
  const scale = options.scale || size / 32;
  const cx = options.cx ?? size * 0.5;
  const cy = options.cy ?? size * 0.5;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tint = options.tint || null;
  const offsetX = options.offsetX || 0;
  const offsetY = options.offsetY || 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx - offsetX;
      const dy = y - cy - offsetY;
      const sx = (cos * dx + sin * dy) / scale + 12;
      const sy = (-sin * dx + cos * dy) / scale + 12;
      const cell = grid[Math.floor(sy)]?.[Math.floor(sx)];
      if (!cell) continue;
      blend(data, size, x, y, tint || palette[cell]);
    }
  }
}

function makeIcon(size) {
  const data = Buffer.alloc(size * size * 4);
  const palette = {
    K: color("#1a1a1a"),
    W: color("#f0f0f0"),
    G: color("#bcbcbc"),
    R: color("#e63b3b"),
    D: color("#a82020"),
    B: color("#5fb6e8"),
    Y: color("#ffd84a"),
    O: color("#ff7e3a"),
    F: color("#ffe066"),
  };
  const grid = rocketSprite();
  const angle = -0.42;
  // Larger rocket so the transparent "cutout" reads strongly on its own
  // (no background tile — just the rocket).
  const scale = size / 22;
  // Soft contact shadow, slightly offset, kept subtle so it stays a clean cutout.
  renderSprite(data, size, grid, palette, {
    angle,
    scale,
    cx: size * 0.5,
    cy: size * 0.5,
    offsetX: size * 0.03,
    offsetY: size * 0.05,
    tint: color("#000000", 40),
  });
  renderSprite(data, size, grid, palette, {
    angle,
    scale,
    cx: size * 0.5,
    cy: size * 0.5,
  });

  return png(size, size, data);
}

function svgIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">
  <g transform="translate(37 34) rotate(-24) scale(2.25) translate(-12 -12)" opacity=".26">
    <rect x="8" y="6" width="8" height="11" fill="#000000"/>
    <rect x="6" y="14" width="13" height="2" fill="#000000"/>
    <rect x="9" y="17" width="5" height="5" fill="#000000"/>
  </g>
  <g transform="translate(34 30) rotate(-24) scale(2.25) translate(-12 -12)">
    <rect x="11" y="1" width="2" height="1" fill="#1a1a1a"/>
    <rect x="10" y="2" width="4" height="1" fill="#1a1a1a"/>
    <rect x="9" y="3" width="1" height="3" fill="#1a1a1a"/>
    <rect x="14" y="3" width="1" height="3" fill="#1a1a1a"/>
    <rect x="10" y="3" width="4" height="3" fill="#e63b3b"/>
    <rect x="13" y="4" width="1" height="2" fill="#a82020"/>
    <rect x="8" y="6" width="1" height="9" fill="#1a1a1a"/>
    <rect x="15" y="6" width="1" height="9" fill="#1a1a1a"/>
    <rect x="9" y="6" width="4" height="9" fill="#f0f0f0"/>
    <rect x="13" y="6" width="2" height="9" fill="#bcbcbc"/>
    <rect x="10" y="7" width="3" height="3" fill="#1a1a1a"/>
    <rect x="11" y="8" width="1" height="1" fill="#f0f0f0"/>
    <rect x="8" y="11" width="8" height="1" fill="#e63b3b"/>
    <rect x="7" y="13" width="1" height="3" fill="#e63b3b"/>
    <rect x="6" y="14" width="1" height="2" fill="#e63b3b"/>
    <rect x="16" y="13" width="1" height="3" fill="#e63b3b"/>
    <rect x="17" y="14" width="1" height="2" fill="#e63b3b"/>
    <rect x="5" y="15" width="1" height="1" fill="#1a1a1a"/>
    <rect x="18" y="15" width="1" height="1" fill="#1a1a1a"/>
    <rect x="10" y="15" width="4" height="2" fill="#1a1a1a"/>
    <rect x="9" y="17" width="5" height="1" fill="#f0f0f0"/>
    <rect x="9" y="18" width="5" height="1" fill="#ffe066"/>
    <rect x="9" y="19" width="5" height="1" fill="#ffd84a"/>
    <rect x="10" y="20" width="3" height="1" fill="#ff7e3a"/>
    <rect x="11" y="21" width="1" height="1" fill="#e63b3b"/>
  </g>
</svg>
`;
}

function writeIco(images, outputPath) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = [];
  for (const item of images) {
    const entry = Buffer.alloc(16);
    entry[0] = item.size === 256 ? 0 : item.size;
    entry[1] = item.size === 256 ? 0 : item.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(item.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += item.buffer.length;
    entries.push(entry);
  }
  fs.writeFileSync(outputPath, Buffer.concat([header, ...entries, ...images.map((item) => item.buffer)]));
}

function main() {
  ensureDir(BUILD_DIR);
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  const pngs = new Map(sizes.map((size) => [size, makeIcon(size)]));
  fs.writeFileSync(path.join(BUILD_DIR, "icon.png"), pngs.get(1024));
  fs.writeFileSync(path.join(BUILD_DIR, "icon.svg"), svgIcon());
  writeIco(
    [16, 32, 48, 256].map((size) => ({ size, buffer: pngs.get(size) })),
    path.join(BUILD_DIR, "icon.ico"),
  );

  fs.rmSync(ICONSET_DIR, { recursive: true, force: true });
  ensureDir(ICONSET_DIR);
  const iconset = [
    [16, "icon_16x16.png"],
    [32, "icon_16x16@2x.png"],
    [32, "icon_32x32.png"],
    [64, "icon_32x32@2x.png"],
    [128, "icon_128x128.png"],
    [256, "icon_128x128@2x.png"],
    [256, "icon_256x256.png"],
    [512, "icon_256x256@2x.png"],
    [512, "icon_512x512.png"],
    [1024, "icon_512x512@2x.png"],
  ];
  for (const [size, name] of iconset) fs.writeFileSync(path.join(ICONSET_DIR, name), pngs.get(size));
  if (process.platform === "darwin") {
    try {
      execFileSync("iconutil", ["-c", "icns", ICONSET_DIR, "-o", path.join(BUILD_DIR, "icon.icns")], { stdio: "inherit" });
    } catch {
      console.warn("iconutil failed; macOS packaging will keep the default icon.");
    }
  }
}

main();
