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

function fillRounded(data, size, x0, y0, w, h, r, colorAt) {
  for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y += 1) {
    for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x += 1) {
      const dx = x < x0 + r ? x0 + r - x : x > x0 + w - r ? x - (x0 + w - r) : 0;
      const dy = y < y0 + r ? y0 + r - y : y > y0 + h - r ? y - (y0 + h - r) : 0;
      if (dx * dx + dy * dy > r * r) continue;
      blend(data, size, x, y, colorAt(x, y));
    }
  }
}

function rect(data, size, x, y, w, h, c) {
  const scale = size / 64;
  const x0 = Math.round(x * scale);
  const y0 = Math.round(y * scale);
  const x1 = Math.round((x + w) * scale);
  const y1 = Math.round((y + h) * scale);
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) blend(data, size, px, py, c);
  }
}

function makeIcon(size) {
  const data = Buffer.alloc(size * size * 4);
  const bgA = color("#111827");
  const bgB = color("#1d5ed8");
  const teal = color("#0f9f8f", 210);
  fillRounded(data, size, 0, 0, size, size, size * 0.23, (_x, y) => {
    const t = y / size;
    return [
      Math.round(bgA[0] * (1 - t) + bgB[0] * t * 0.72),
      Math.round(bgA[1] * (1 - t) + bgB[1] * t * 0.72),
      Math.round(bgA[2] * (1 - t) + bgB[2] * t * 0.72),
      255,
    ];
  });
  fillRounded(data, size, size * 0.57, size * 0.08, size * 0.28, size * 0.28, size * 0.14, () => color("#3a87ff", 116));
  fillRounded(data, size, size * 0.12, size * 0.62, size * 0.25, size * 0.25, size * 0.13, () => teal);

  const k = color("#06111f");
  const body = color("#8ee8f2");
  const body2 = color("#3a87ff");
  const light = color("#f7fbff");
  const gold = color("#f4bd28");
  const rose = color("#ef5da8");

  rect(data, size, 15, 29, 34, 7, k);
  rect(data, size, 18, 25, 28, 10, body);
  rect(data, size, 13, 32, 38, 7, body);
  rect(data, size, 19, 38, 26, 3, color("#79d8e4"));
  rect(data, size, 24, 21, 16, 6, body2);
  rect(data, size, 27, 17, 10, 5, color("#a7f3ff"));
  rect(data, size, 29, 25, 6, 6, light);
  rect(data, size, 21, 41, 5, 5, gold);
  rect(data, size, 38, 41, 5, 5, gold);
  rect(data, size, 30, 40, 4, 8, rose);
  rect(data, size, 19, 51, 26, 3, color("#9fd7ff"));
  rect(data, size, 11, 47, 4, 4, color("#ffffff", 210));
  rect(data, size, 49, 19, 3, 3, color("#ffffff", 200));
  rect(data, size, 52, 23, 2, 2, color("#ffffff", 180));

  return png(size, size, data);
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
