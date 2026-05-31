import { CHARACTERS, DEFAULT_CHARACTER } from "./characters.js";

const api = window.busyPet;
const SPRITE_RES = 24;
const IMAGE_SPRITE_RES = 96;
const BASE_SIZE = 54;
const MAX_SLOTS = 8;
const CUSTOM_GRID_SIZE = 24;
const MOUSE_PROXIMITY = 120;
const SIDE_VIEW_CHARACTER_IDS = new Set(["car"]);
const PERFORMANCE_PROFILES = Object.freeze({
  saver: { frameMs: 1000 / 18, heavyFrameMs: 1000 / 16, maxParticles: 36, trailMs: 220, dpr: 1, trails: true, ribbonPoints: 18 },
  balanced: { frameMs: 1000 / 30, heavyFrameMs: 1000 / 24, maxParticles: 100, trailMs: 118, dpr: 1, trails: true, ribbonPoints: 28 },
  smooth: { frameMs: 1000 / 45, heavyFrameMs: 1000 / 34, maxParticles: 160, trailMs: 76, dpr: 1.35, trails: true, ribbonPoints: 42 },
});
const DEFAULT_MOVEMENT = {
  speed: 1.6,
  accel: 0.08,
  damping: 0.92,
  changeMs: [1800, 5000],
  wobble: 0.08,
};

const stage = document.getElementById("stage");
const aquarium = document.getElementById("aquarium");
const ground = document.getElementById("ground");
const effectsCanvas = document.getElementById("effects-canvas");
const effectsCtx = effectsCanvas?.getContext("2d", { alpha: true }) || null;
const panel = document.getElementById("pet-panel");

let settings = null;
let pets = [];
let activePet = null;
let mouseX = -9999;
let mouseY = -9999;
let lastTick = performance.now();
let lastInteractive = false;
let trailHue = 0;
let areaPicker = null;
let effectsDpr = 1;
let effectsCanvasSignature = "";
let effectParticles = [];
let effectsDirty = false;
let animationFrameId = null;
let aquariumSignature = "";
const spriteImageCache = new Map();

const AREA_PRESETS = {
  all: { left: 0.03, top: 0.06, right: 0.97, bottom: 0.92 },
  top: { left: 0.04, top: 0.05, right: 0.96, bottom: 0.42 },
  middle: { left: 0.05, top: 0.25, right: 0.95, bottom: 0.75 },
  bottom: { left: 0.04, top: 0.52, right: 0.96, bottom: 0.94 },
};

const PANEL_I18N = {
  en: {
    note: "Shortcuts and movement controls.",
    close: "Close",
    settings: "Settings",
    roam: "Roam",
    stay: "Stay",
  },
  ko: {
    note: "바로가기와 움직임 설정.",
    close: "닫기",
    settings: "설정",
    roam: "움직임",
    stay: "멈춤",
  },
};

function panelText(key) {
  const language = ["en", "ko"].includes(settings?.language) ? settings.language : "en";
  return PANEL_I18N[language]?.[key] || PANEL_I18N.en[key] || key;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function characterFor(id) {
  const custom = customCharacterFor(id);
  if (custom) {
    return {
      id: custom.id,
      name: custom.name || "Custom",
      frames: 1,
      movement: DEFAULT_MOVEMENT,
      render: (ctx) => renderCustomSprite(ctx, custom),
    };
  }
  return CHARACTERS[id] || CHARACTERS[DEFAULT_CHARACTER];
}

function customCharacterFor(id) {
  return Array.isArray(settings?.customCharacters)
    ? settings.customCharacters.find((character) => character?.id === id) || null
    : null;
}

function customHasImage(custom) {
  return !!String(custom?.imagePath || "").trim();
}

function spriteResolutionFor(pet) {
  return customHasImage(customCharacterFor(pet.characterId)) ? IMAGE_SPRITE_RES : SPRITE_RES;
}

function drawContainedImage(ctx, image, width, height) {
  const sourceW = image.naturalWidth || image.width || width;
  const sourceH = image.naturalHeight || image.height || height;
  const scale = Math.min(width / sourceW, height / sourceH);
  const drawW = Math.max(1, Math.round(sourceW * scale));
  const drawH = Math.max(1, Math.round(sourceH * scale));
  const x = Math.round((width - drawW) / 2);
  const y = Math.round((height - drawH) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, x, y, drawW, drawH);
}

function invalidateCustomSprites(imagePath) {
  for (const pet of pets) {
    const custom = customCharacterFor(pet.characterId);
    if (custom?.imagePath !== imagePath) continue;
    pet._lastFrame = null;
    pet._lastCharacter = null;
    renderSprite(pet, true);
  }
}

function spriteImageRecord(imagePath) {
  const value = String(imagePath || "").trim();
  if (!value) return null;
  const cached = spriteImageCache.get(value);
  if (cached) return cached;
  const record = { image: new Image(), ready: false, failed: false };
  record.image.decoding = "async";
  record.image.onload = () => {
    record.ready = true;
    invalidateCustomSprites(value);
  };
  record.image.onerror = () => {
    record.failed = true;
  };
  record.image.src = fileUrlFromPath(value);
  spriteImageCache.set(value, record);
  return record;
}

function renderCustomSprite(ctx, custom) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);
  const record = spriteImageRecord(custom?.imagePath);
  if (record?.ready) {
    drawContainedImage(ctx, record.image, width, height);
    return;
  }
  ctx.imageSmoothingEnabled = false;
  const pixels = Array.isArray(custom?.pixels) ? custom.pixels : [];
  const cell = Math.max(1, Math.floor(Math.min(width, height) / CUSTOM_GRID_SIZE));
  const offsetX = Math.floor((width - cell * CUSTOM_GRID_SIZE) / 2);
  const offsetY = Math.floor((height - cell * CUSTOM_GRID_SIZE) / 2);
  for (let index = 0; index < CUSTOM_GRID_SIZE * CUSTOM_GRID_SIZE; index += 1) {
    const color = pixels[index];
    if (!color) continue;
    const x = index % CUSTOM_GRID_SIZE;
    const y = Math.floor(index / CUSTOM_GRID_SIZE);
    ctx.fillStyle = color;
    ctx.fillRect(offsetX + x * cell, offsetY + y * cell, cell, cell);
  }
}

function fileUrlFromPath(filePath) {
  const value = String(filePath || "").trim();
  if (!value) return "";
  return `file://${value.split("/").map(encodeURIComponent).join("/")}`;
}

function behaviorFor(slot) {
  return {
    movementStyle: "free",
    orientationMode: "smart",
    mouseMode: "avoid",
    areaPreset: "all",
    area: AREA_PRESETS.all,
    speedMultiplier: 1,
    scale: 1,
    effectMode: "normal",
    effectIntensity: 1,
    ...(slot?.behavior || {}),
  };
}

function getPetSize(pet) {
  return Math.round(BASE_SIZE * (pet.behavior?.scale || 1));
}

function viewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

function performanceProfile() {
  const base = PERFORMANCE_PROFILES[settings?.performanceMode] || PERFORMANCE_PROFILES.saver;
  const fps = clamp(Math.round(Number(settings?.fps || 16)), 10, 60);
  return {
    ...base,
    frameMs: 1000 / fps,
    heavyFrameMs: 1000 / Math.max(10, Math.round(fps * 0.75)),
  };
}

function hasActiveRainbow() {
  return pets.some((pet) => pet.enabled && pet.behavior?.effectMode === "rainbow");
}

function activeRainbowCount() {
  return pets.filter((pet) => pet.enabled && pet.behavior?.effectMode === "rainbow").length;
}

function maxEffectParticles() {
  if (!hasActiveRainbow()) return performanceProfile().maxParticles;
  const mode = settings?.performanceMode || "saver";
  if (mode === "smooth") return 120;
  if (mode === "balanced") return 90;
  return 60;
}

function resizeEffectsCanvas() {
  if (!effectsCanvas || !effectsCtx) return;
  const { w, h } = viewport();
  const nextDpr = Math.min(window.devicePixelRatio || 1, performanceProfile().dpr);
  const signature = `${w}x${h}@${nextDpr}`;
  if (effectsCanvasSignature === signature) return;
  effectsCanvasSignature = signature;
  effectsDpr = nextDpr;
  effectsCanvas.width = Math.max(1, Math.ceil(w * effectsDpr));
  effectsCanvas.height = Math.max(1, Math.ceil(h * effectsDpr));
  effectsCanvas.style.width = `${w}px`;
  effectsCanvas.style.height = `${h}px`;
  effectsCtx.setTransform(effectsDpr, 0, 0, effectsDpr, 0, 0);
}

function pushEffectParticle(particle) {
  if (!effectsCtx) return;
  effectParticles.push(particle);
  effectsDirty = true;
  const overflow = effectParticles.length - maxEffectParticles();
  if (overflow > 0) effectParticles.splice(0, overflow);
}

function drawDiamond(ctx, x, y, size) {
  const half = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y - half);
  ctx.lineTo(x + half, y);
  ctx.lineTo(x, y + half);
  ctx.lineTo(x - half, y);
  ctx.closePath();
  ctx.fill();
}

function hasRibbonTrails() {
  return pets.some((pet) => pet.enabled && pet.ribbonTrail?.length > 1);
}

function drawRibbonTrail(ctx, pet, now) {
  const trail = pet.ribbonTrail || [];
  if (trail.length < 2) return;
  const profile = performanceProfile();
  const fancy = (settings?.performanceMode || "saver") === "smooth";
  const intensity = clamp(pet.behavior.effectIntensity || 1, 0.3, 2);
  const life = 1250 + intensity * 520;
  const maxWidth = getPetSize(pet) * (0.22 + intensity * 0.07);
  ctx.save();
  ctx.globalCompositeOperation = fancy ? "lighter" : "source-over";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const step = profile.ribbonPoints > 24 ? 1 : 2;
  for (let index = trail.length - 1; index > 0; index -= step) {
    const head = trail[index];
    const tail = trail[index - 1];
    const age = clamp((now - head.t) / life, 0, 1);
    const position = index / trail.length;
    const alpha = (1 - age) * position * 0.82;
    if (alpha <= 0.01) continue;
    const hue = (head.hue + index * 13) % 360;
    const width = Math.max(2, maxWidth * position * (1 - age * 0.5));
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `hsl(${hue} 96% 62%)`;
    ctx.lineWidth = width;
    ctx.shadowBlur = fancy ? width * 1.2 : 0;
    ctx.shadowColor = fancy ? `hsl(${hue} 96% 62% / 0.58)` : "transparent";
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    const midX = (tail.x + head.x) / 2;
    const midY = (tail.y + head.y) / 2;
    ctx.quadraticCurveTo(midX, midY, head.x, head.y);
    ctx.stroke();

    if (fancy && index % 3 === 0) {
      ctx.globalAlpha = alpha * 0.75;
      ctx.fillStyle = `hsl(${(hue + 46) % 360} 100% 72%)`;
      drawDiamond(ctx, head.x + Math.sin(now / 90 + index) * 5, head.y + Math.cos(now / 110 + index) * 4, width * 0.45);
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawEffects(now) {
  if (!effectsCtx) return;
  const liveRibbon = hasRibbonTrails();
  if (!effectParticles.length && !effectsDirty && !liveRibbon) return;
  const { w, h } = viewport();
  effectsCtx.clearRect(0, 0, w, h);

  for (const pet of pets) drawRibbonTrail(effectsCtx, pet, now);

  if (!effectParticles.length) {
    effectsDirty = false;
    return;
  }

  for (let index = effectParticles.length - 1; index >= 0; index -= 1) {
    const particle = effectParticles[index];
    const age = (now - particle.born) / particle.life;
    if (age >= 1) {
      effectParticles.splice(index, 1);
      continue;
    }

    const ease = 1 - (1 - age) * (1 - age);
    const x = particle.x + particle.dx * ease;
    const y = particle.y + particle.dy * ease;
    const size = Math.max(1, particle.size * (1 - age * 0.55));
    effectsCtx.globalAlpha = particle.alpha * (1 - age);
    effectsCtx.fillStyle = particle.color;

    if (particle.type === "bubble") {
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      effectsCtx.fill();
      effectsCtx.lineWidth = 2;
      effectsCtx.strokeStyle = "rgba(36, 160, 190, 0.55)";
      effectsCtx.stroke();
    } else if (particle.type === "rainbow") {
      effectsCtx.globalAlpha = particle.alpha * (1 - age) * 0.22;
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, size * 0.72, 0, Math.PI * 2);
      effectsCtx.fill();
      effectsCtx.globalAlpha = particle.alpha * (1 - age) * 0.82;
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, size * 0.34, 0, Math.PI * 2);
      effectsCtx.fill();
    } else if (particle.type === "spark" || particle.type === "burst") {
      drawDiamond(effectsCtx, x, y, size);
    } else {
      effectsCtx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
    }
  }

  effectsCtx.globalAlpha = 1;
  effectsDirty = true;
}

function renderSprite(pet, force = false) {
  const character = characterFor(pet.characterId);
  const resolution = spriteResolutionFor(pet);
  if (pet.canvas.width !== resolution || pet.canvas.height !== resolution) {
    pet.canvas.width = resolution;
    pet.canvas.height = resolution;
    pet.ctx = pet.canvas.getContext("2d", { alpha: true });
    pet._lastFrame = null;
    pet._lastCharacter = null;
  }
  if (!force && pet._lastFrame === pet.frame && pet._lastCharacter === pet.characterId) return;
  pet._lastFrame = pet.frame;
  pet._lastCharacter = pet.characterId;
  pet.ctx.clearRect(0, 0, pet.canvas.width, pet.canvas.height);
  character.render(pet.ctx, pet.frame, "walk", { mouseX, mouseY });
}

function syncPetSize(pet) {
  const size = getPetSize(pet);
  if (pet._size === size) return;
  pet._size = size;
  pet.el.style.width = `${size}px`;
  pet.el.style.height = `${size}px`;
}

function pickTarget(pet, now) {
  const { w, h } = viewport();
  const size = getPetSize(pet);
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const behavior = pet.behavior;
  const area = behavior.areaPreset && AREA_PRESETS[behavior.areaPreset] ? AREA_PRESETS[behavior.areaPreset] : behavior.area;
  if (behavior.movementStyle === "stay") {
    pet.targetX = clamp(pet.x + rand(-36, 36), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-28, 28), 0, maxY);
    pet.nextTargetAt = now + rand(1800, 3600);
    return;
  }
  pet.targetX = clamp(w * rand(area.left, area.right), 0, maxX);
  pet.targetY = clamp(h * rand(area.top, area.bottom), 0, maxY);
  const changeMs = pet.movement.changeMs || DEFAULT_MOVEMENT.changeMs;
  pet.nextTargetAt = now + rand(changeMs[0], changeMs[1]);
}

function wakePet(pet, strength = 0.45) {
  if (!pet.enabled || pet.dragging || pet.pausedByPanel) return;
  if (pet.behavior?.movementStyle === "stay") return;
  const dx = pet.targetX - pet.x;
  const dy = pet.targetY - pet.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 10) return;
  pet.vx += (dx / distance) * strength;
  pet.vy += (dy / distance) * strength;
}

function createPet(slotIndex) {
  const el = document.createElement("button");
  el.className = "pet interactive";
  el.type = "button";
  el.dataset.slot = String(slotIndex);

  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_RES;
  canvas.height = SPRITE_RES;
  el.appendChild(canvas);

  const label = document.createElement("span");
  label.className = "pet-label";
  el.appendChild(label);

  stage.appendChild(el);

  const pet = {
    slotIndex,
    el,
    canvas,
    label,
    ctx: canvas.getContext("2d"),
    characterId: DEFAULT_CHARACTER,
    behavior: behaviorFor(null),
    movement: { ...DEFAULT_MOVEMENT },
    x: 80 + slotIndex * 74,
    y: 140 + slotIndex * 24,
    vx: 0,
    vy: 0,
    targetX: 120,
    targetY: 160,
    direction: 1,
    rotation: 0,
    frame: 0,
    lastFrameAt: 0,
    nextTargetAt: 0,
    dragging: false,
    didDrag: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragStartX: 0,
    dragStartY: 0,
    lastTrailAt: 0,
    lastRibbonAt: 0,
    ribbonTrail: [],
    pausedByPanel: false,
    enabled: true,
  };

  el.addEventListener("pointerdown", (event) => startDrag(event, pet));
  el.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!pet.didDrag) openPanel(pet);
  });

  return pet;
}

function startDrag(event, pet) {
  if (event.button !== 0 || !pet.enabled) return;
  api.setClickThrough(false);
  pet.dragging = true;
  pet.didDrag = false;
  const rect = pet.el.getBoundingClientRect();
  pet.dragOffsetX = event.clientX - rect.left;
  pet.dragOffsetY = event.clientY - rect.top;
  pet.dragStartX = event.clientX;
  pet.dragStartY = event.clientY;
  pet.vx = 0;
  pet.vy = 0;
  pet.el.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

window.addEventListener("pointermove", (event) => {
  if (areaPicker) return;
  mouseX = event.clientX;
  mouseY = event.clientY;
  if (!pets.some((pet) => pet.dragging)) return;
  for (const pet of pets) {
    if (!pet.dragging) continue;
    const size = getPetSize(pet);
    const { w, h } = viewport();
    if (Math.abs(event.clientX - pet.dragStartX) > 3 || Math.abs(event.clientY - pet.dragStartY) > 3) {
      pet.didDrag = true;
    }
    pet.x = clamp(event.clientX - pet.dragOffsetX, 0, w - size);
    pet.y = clamp(event.clientY - pet.dragOffsetY, 0, h - size);
    applyPetTransform(pet);
  }
  positionPanel();
});

window.addEventListener("pointerup", (event) => {
  for (const pet of pets) {
    if (!pet.dragging) continue;
    pet.dragging = false;
    try {
      pet.el.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
    if (pet.didDrag) {
      pickTarget(pet, performance.now());
    }
  }
});

window.addEventListener(
  "pointerdown",
  (event) => {
    if (areaPicker || !activePet || panel.hidden) return;
    if (event.target.closest(".pet-panel") || event.target.closest(".pet")) return;
    closePanel();
    api.setClickThrough(true);
  },
  true,
);

function updateMotion(pet, now, step) {
  if (!pet.enabled || pet.dragging) return;
  const behavior = pet.behavior;
  const movement = pet.movement;
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);

  if (pet.pausedByPanel) {
    pet.vx = 0;
    pet.vy = 0;
    pet.x = clamp(pet.x, 0, maxX);
    pet.y = clamp(pet.y, 0, maxY);
    pet.targetX = pet.x;
    pet.targetY = pet.y;
    pet.nextTargetAt = now + 1200;
    return;
  }

  if (now > pet.nextTargetAt || Math.hypot(pet.targetX - pet.x, pet.targetY - pet.y) < 12) {
    pickTarget(pet, now);
  }
  if (behavior.movementStyle !== "stay" && Math.hypot(pet.vx, pet.vy) < 0.015) {
    wakePet(pet, 0.28);
  }

  if (behavior.movementStyle !== "stay") {
    const dx = pet.targetX - pet.x;
    const dy = pet.targetY - pet.y;
    const dist = Math.hypot(dx, dy) || 1;
    const accel = (movement.accel || DEFAULT_MOVEMENT.accel) * behavior.speedMultiplier;
    pet.vx += (dx / dist) * accel * step;
    pet.vy += (dy / dist) * accel * step;
    pet.vx += rand(-1, 1) * (movement.wobble || DEFAULT_MOVEMENT.wobble) * step;
    pet.vy += rand(-1, 1) * (movement.wobble || DEFAULT_MOVEMENT.wobble) * step;
  } else {
    pet.vx += (pet.targetX - pet.x) * 0.002 * step;
    pet.vy += (pet.targetY - pet.y) * 0.002 * step;
  }

  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const mdx = mouseX - cx;
  const mdy = mouseY - cy;
  const mdist = Math.hypot(mdx, mdy);

  if (behavior.mouseMode === "follow" && mdist > 1) {
    pet.vx += (mdx / mdist) * 0.16 * step;
    pet.vy += (mdy / mdist) * 0.16 * step;
  } else if (behavior.mouseMode === "avoid" && mdist < MOUSE_PROXIMITY && mdist > 1) {
    const force = (1 - mdist / MOUSE_PROXIMITY) * 0.55;
    pet.vx -= (mdx / mdist) * force * step;
    pet.vy -= (mdy / mdist) * force * step;
  }

  const speed = Math.hypot(pet.vx, pet.vy);
  const maxSpeed = (movement.speed || DEFAULT_MOVEMENT.speed) * behavior.speedMultiplier;
  if (speed > maxSpeed) {
    pet.vx *= maxSpeed / speed;
    pet.vy *= maxSpeed / speed;
  }

  pet.vx *= Math.pow(movement.damping || DEFAULT_MOVEMENT.damping, step);
  pet.vy *= Math.pow(movement.damping || DEFAULT_MOVEMENT.damping, step);
  pet.x += pet.vx * step;
  pet.y += pet.vy * step;

  if (pet.x < 0) {
    pet.x = 0;
    pet.vx = Math.abs(pet.vx) * 0.42;
  }
  if (pet.x > maxX) {
    pet.x = maxX;
    pet.vx = -Math.abs(pet.vx) * 0.42;
  }
  if (pet.y < 0) {
    pet.y = 0;
    pet.vy = Math.abs(pet.vy) * 0.42;
  }
  if (pet.y > maxY) {
    pet.y = maxY;
    pet.vy = -Math.abs(pet.vy) * 0.42;
  }

  if (Math.abs(pet.vx) > 0.08) {
    pet.direction = pet.vx >= 0 ? 1 : -1;
  }
}

function isSideViewCharacter(pet) {
  return SIDE_VIEW_CHARACTER_IDS.has(pet.characterId);
}

function orientationModeFor(pet) {
  return ["smart", "turn", "fixed"].includes(pet.behavior?.orientationMode) ? pet.behavior.orientationMode : "smart";
}

function shouldOrient(pet) {
  const mode = orientationModeFor(pet);
  if (mode === "fixed") return false;
  if (mode === "turn") return true;
  if (isSideViewCharacter(pet)) return false;
  const character = characterFor(pet.characterId);
  return character.orientToMovement || ["rocket", "bug", "tank", "car", "comet"].includes(pet.characterId);
}

function setPetTransform(pet, transform) {
  if (pet._lastTransform === transform) return;
  pet._lastTransform = transform;
  pet.el.style.transform = transform;
}

function applyPetTransform(pet) {
  syncPetSize(pet);
  let rotation = pet.rotation || 0;
  const speed = Math.hypot(pet.vx, pet.vy);
  const mode = orientationModeFor(pet);
  if (mode === "fixed") {
    pet.rotation = 0;
    setPetTransform(pet, `translate3d(${pet.x.toFixed(2)}px, ${pet.y.toFixed(2)}px, 0)`);
    return;
  }
  if (mode === "smart" && isSideViewCharacter(pet)) {
    const desiredTilt = clamp(pet.vy * 7 * pet.direction, -10, 10);
    rotation += (desiredTilt - rotation) * 0.18;
    pet.rotation = rotation;
    const flip = pet.direction < 0 ? " scaleX(-1)" : "";
    setPetTransform(pet, `translate3d(${pet.x.toFixed(2)}px, ${pet.y.toFixed(2)}px, 0) rotate(${rotation.toFixed(2)}deg)${flip}`);
    return;
  }
  if (shouldOrient(pet) && speed > 0.08) {
    const desired = (Math.atan2(pet.vy, pet.vx) * 180) / Math.PI + 90;
    const diff = ((desired - rotation + 540) % 360) - 180;
    rotation += diff * 0.18;
    pet.rotation = rotation;
  }
  const flip = shouldOrient(pet) ? "" : pet.direction < 0 ? " scaleX(-1)" : "";
  const rotate = shouldOrient(pet) ? ` rotate(${rotation.toFixed(2)}deg)` : "";
  setPetTransform(pet, `translate3d(${pet.x.toFixed(2)}px, ${pet.y.toFixed(2)}px, 0)${rotate}${flip}`);
}

function updateAnimation(pet, now) {
  const character = characterFor(pet.characterId);
  const speed = Math.min(1, Math.hypot(pet.vx, pet.vy) / 2.5);
  const interval = 360 - speed * 240;
  if (now - pet.lastFrameAt >= interval) {
    pet.frame = (pet.frame + 1) % character.frames;
    pet.lastFrameAt = now;
  }
  renderSprite(pet);
}

function updateRainbowRibbon(pet, now) {
  pet.ribbonTrail = [];
}

function effectAnchorFor(pet) {
  const custom = customCharacterFor(pet.characterId);
  return custom?.effectAnchor || pet.behavior?.effectAnchor || { x: 0.5, y: 0.56 };
}

function effectDirectionFor(pet) {
  const custom = customCharacterFor(pet.characterId);
  return custom?.effectDirection || pet.behavior?.effectDirection || "back";
}

function effectOrigin(pet, size) {
  const anchor = effectAnchorFor(pet);
  const anchorX = Number(anchor.x);
  const anchorY = Number(anchor.y);
  return {
    x: pet.x + size * clamp(Number.isFinite(anchorX) ? anchorX : 0.5, 0, 1),
    y: pet.y + size * clamp(Number.isFinite(anchorY) ? anchorY : 0.56, 0, 1),
  };
}

function effectVector(pet) {
  const direction = effectDirectionFor(pet);
  if (direction === "left") return { x: -1, y: 0 };
  if (direction === "right") return { x: 1, y: 0 };
  if (direction === "up") return { x: 0, y: -1 };
  if (direction === "down") return { x: 0, y: 1 };
  const speed = Math.hypot(pet.vx, pet.vy);
  if (speed > 0.05) {
    const sign = direction === "auto" ? 1 : -1;
    return { x: (pet.vx / speed) * sign, y: (pet.vy / speed) * sign };
  }
  const fallback = pet.direction >= 0 ? 1 : -1;
  return { x: direction === "auto" ? fallback : -fallback, y: 0 };
}

function spawnTrail(pet, now) {
  const mode = pet.behavior.effectMode || "off";
  const profile = performanceProfile();
  if (!profile.trails) return;
  if (mode === "off") return;
  const intensity = clamp(pet.behavior.effectIntensity || 1, 0.3, 2);
  const speed = Math.hypot(pet.vx, pet.vy);
  if (speed < 0.18 && !pet.dragging) return;
  if (mode === "rainbow") {
    const rainbowCount = Math.max(1, activeRainbowCount());
    const interval = clamp(22 + rainbowCount * 11, 34, 72);
    if (now - pet.lastTrailAt < interval) return;
    pet.lastTrailAt = now;
    const size = getPetSize(pet);
    const origin = effectOrigin(pet, size);
    const vector = effectVector(pet);
    const sizeMul = 0.9 + (pet.behavior.scale || 1) * 0.2;
    const hue = (now / 5) % 360;
    pushEffectParticle({
      type: "rainbow",
      x: origin.x - 4 + rand(-2, 2),
      y: origin.y - 4 + rand(-2, 2),
      dx: vector.x * 42 + rand(-5, 5),
      dy: vector.y * 42 + rand(-5, 5),
      size: Math.round(7 * sizeMul * Math.min(intensity, 1.35)),
      color: `hsl(${hue} 95% 60%)`,
      alpha: 0.78,
      born: now,
      life: 1100 + intensity * 220,
    });
    return;
  }
  const interval = Math.max(profile.trailMs * 0.72, profile.trailMs / intensity);
  if (now - pet.lastTrailAt < interval) return;
  pet.lastTrailAt = now;

  const size = getPetSize(pet);
  const origin = effectOrigin(pet, size);
  const vector = effectVector(pet);
  const x = origin.x + rand(-size * 0.08, size * 0.08);
  const y = origin.y + rand(-size * 0.08, size * 0.08);
  const pixelSize = mode === "spark" ? rand(5, 9) : rand(7, 15) * Math.min(intensity, 1.35);
  let color = "#42d7c5";
  let alpha = 0.72;

  if (mode === "rainbow" || mode === "normal") {
    trailHue = (trailHue + 23) % 360;
    const hue = mode === "normal" ? 172 : trailHue;
    color = `hsl(${hue} 96% 64%)`;
    alpha = mode === "rainbow" ? 0.52 : alpha;
  } else if (mode === "pixel") {
    const colors = ["#ff4d6d", "#ffd166", "#39d98a", "#4dabf7", "#a78bfa"];
    color = colors[Math.floor(Math.random() * colors.length)];
  } else if (mode === "spark") {
    color = "#ffe76b";
    alpha = 0.9;
  } else if (mode === "bubble") {
    color = "rgba(157, 234, 255, 0.42)";
    alpha = 0.86;
  }

  pushEffectParticle({
    type: mode,
    x,
    y,
    dx: vector.x * rand(18, 34) + rand(-8, 8),
    dy: vector.y * rand(18, 34) + rand(-8, 8),
    size: pixelSize,
    color,
    alpha,
    born: now,
    life: mode === "spark" ? 520 : 760,
  });
}

function spawnClickBurst(pet) {
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    const distance = rand(24, 58);
    pushEffectParticle({
      type: "burst",
      x: cx,
      y: cy,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: 7,
      color: "#ffe76b",
      alpha: 0.92,
      born: now,
      life: 520,
    });
  }
}

function faviconUrl(url) {
  try {
    const host = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${host}.ico`;
  } catch {
    return "";
  }
}

function shortcutKind(shortcut) {
  return shortcut?.type === "app" ? "app" : "web";
}

function shortcutIcon(shortcut) {
  const icon = document.createElement("span");
  icon.className = `shortcut-icon ${shortcutKind(shortcut)}`;
  icon.textContent = shortcutKind(shortcut) === "app" ? "APP" : "URL";
  return icon;
}

function shortcutImage(shortcut) {
  if (shortcut?.imagePath) return fileUrlFromPath(shortcut.imagePath);
  return shortcutKind(shortcut) === "web" ? faviconUrl(shortcut.url) : "";
}

function hasCustomShortcutImage(shortcut) {
  return !!String(shortcut?.imagePath || "").trim();
}

function closePanel() {
  if (activePet) {
    activePet.pausedByPanel = false;
    pickTarget(activePet, performance.now());
  }
  panel.hidden = true;
  activePet = null;
}

function openPanel(pet) {
  if (activePet && activePet !== pet) {
    activePet.pausedByPanel = false;
    pickTarget(activePet, performance.now());
  }
  activePet = pet;
  pet.pausedByPanel = true;
  pet.vx = 0;
  pet.vy = 0;
  pet.targetX = pet.x;
  pet.targetY = pet.y;
  spawnClickBurst(pet);
  const character = characterFor(pet.characterId);
  const shortcuts = Array.isArray(settings?.shortcuts)
    ? settings.shortcuts.filter((item) => item?.name && (item.type === "app" ? item.appPath : item.url))
    : [];
  panel.innerHTML = "";
  panel.setAttribute("aria-label", character.name);

  const grid = document.createElement("div");
  grid.className = "shortcut-grid";
  const displayMode = ["both", "image", "name"].includes(settings?.shortcutDisplayMode)
    ? settings.shortcutDisplayMode
    : "both";
  grid.classList.toggle("image-only-grid", displayMode === "image");
  const visibleShortcuts = (displayMode === "image" ? shortcuts.filter(hasCustomShortcutImage) : shortcuts).slice(
    0,
    displayMode === "image" ? 12 : 6,
  );
  for (const shortcut of visibleShortcuts) {
    const button = document.createElement("button");
    button.className = "shortcut";
    button.type = "button";
    if (displayMode !== "name") {
      let icon = shortcutIcon(shortcut);
      const imageUrl = shortcutImage(shortcut);
      if (imageUrl) {
        icon = document.createElement("img");
        icon.alt = "";
        icon.src = imageUrl;
        icon.addEventListener("error", () => {
          icon.replaceWith(shortcutIcon(shortcut));
        });
      }
      button.appendChild(icon);
    }
    if (displayMode !== "image") {
      const label = document.createElement("span");
      label.textContent = shortcut.name;
      button.appendChild(label);
    } else {
      button.classList.add("image-only");
      button.title = shortcut.name;
    }
    button.addEventListener("click", () => api.openShortcut(shortcut));
    grid.appendChild(button);
  }
  panel.appendChild(grid);

  const actions = document.createElement("div");
  actions.className = "panel-actions";
  const settingsButton = document.createElement("button");
  settingsButton.className = "pixel-button";
  settingsButton.type = "button";
  settingsButton.textContent = `⚙ ${panelText("settings")}`;
  settingsButton.addEventListener("click", () => api.openSettings());
  actions.append(settingsButton);
  panel.appendChild(actions);

  panel.hidden = false;
  positionPanel();
}

function positionPanel() {
  if (!activePet || panel.hidden) return;
  const size = getPetSize(activePet);
  const { w, h } = viewport();
  const rectW = 320;
  const rectH = panel.offsetHeight || 112;
  let x = activePet.x + size / 2 - rectW / 2;
  let y = activePet.y - rectH - 4;
  if (y < 12) y = activePet.y + size + 4;
  x = clamp(x, 12, Math.max(12, w - rectW - 12));
  y = clamp(y, 12, Math.max(12, h - rectH - 12));
  panel.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function syncGround() {
  ground.hidden = true;
  ground.innerHTML = "";
}

function syncAquarium() {
  if (!aquarium) return;
  if (aquariumSignature === "disabled") return;
  aquariumSignature = "disabled";
  aquarium.hidden = true;
  aquarium.innerHTML = "";
}

function syncPets() {
  if (!settings) return;
  document.body.dataset.performance = settings.performanceMode || "saver";
  while (pets.length < MAX_SLOTS) pets.push(createPet(pets.length));
  const slots = settings.slots || [];
  const now = performance.now();
  for (let index = 0; index < pets.length; index += 1) {
    const slot = slots[index] || {};
    const pet = pets[index];
    const previousCharacterId = pet.characterId;
    pet.enabled = settings.enabled && slot.enabled !== false;
    pet.el.hidden = !pet.enabled;
    pet.characterId = CHARACTERS[slot.character] || customCharacterFor(slot.character) ? slot.character : DEFAULT_CHARACTER;
    const characterChanged = previousCharacterId !== pet.characterId;
    if (characterChanged) {
      pet.frame = 0;
      pet.rotation = 0;
      pet.vx = 0;
      pet.vy = 0;
      pet._lastFrame = null;
      pet._lastCharacter = null;
    }
    pet.behavior = behaviorFor(slot);
    const character = characterFor(pet.characterId);
    pet.movement = { ...DEFAULT_MOVEMENT, ...(character.movement || {}) };
    pet.label.textContent = character.name;
    pet.el.dataset.spriteType = customHasImage(customCharacterFor(pet.characterId)) ? "image" : "pixel";
    pet.el.setAttribute("aria-label", `${character.name} companion`);
    syncPetSize(pet);
    renderSprite(pet, true);
    if (!pet.nextTargetAt || characterChanged) pickTarget(pet, now);
    if (characterChanged || Math.hypot(pet.vx, pet.vy) < 0.02) wakePet(pet, 0.5);
    if (characterChanged && activePet === pet && !panel.hidden) {
      openPanel(pet);
    }
  }
  syncGround();
  syncAquarium();
  if (activePet && !activePet.enabled) {
    closePanel();
  }
}

function handleCursorPoint(point) {
  if (areaPicker) return;
  mouseX = point.x;
  mouseY = point.y;
  const target = document.elementFromPoint(point.x, point.y);
  const panelOpen = activePet && !panel.hidden;
  const interactive = panelOpen || !!target?.closest(".interactive");
  if (interactive !== lastInteractive) {
    lastInteractive = interactive;
    api.setClickThrough(!interactive);
  }
}

function normalizePickedArea(x1, y1, x2, y2) {
  const { w, h } = viewport();
  const left = clamp(Math.min(x1, x2) / w, 0, 0.95);
  const top = clamp(Math.min(y1, y2) / h, 0, 0.95);
  const right = clamp(Math.max(x1, x2) / w, 0.05, 1);
  const bottom = clamp(Math.max(y1, y2) / h, 0.05, 1);
  return { left, top, right, bottom };
}

function finishAreaPick(result) {
  if (!areaPicker) return;
  areaPicker.el.remove();
  areaPicker = null;
  api.completeAreaPick(result);
}

function startAreaPicker(payload) {
  if (areaPicker) finishAreaPick({ ok: false, cancelled: true });
  closePanel();

  const overlay = document.createElement("div");
  overlay.className = "area-picker interactive";

  const hint = document.createElement("div");
  hint.className = "area-picker__hint";
  hint.textContent = `#${Number(payload?.slotIndex || 0) + 1} movement area: drag on the screen`;

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    finishAreaPick({ ok: false, cancelled: true });
  });
  hint.appendChild(cancel);

  const rect = document.createElement("div");
  rect.className = "area-picker__rect";
  overlay.append(hint, rect);
  stage.appendChild(overlay);

  areaPicker = {
    el: overlay,
    rect,
    dragging: false,
    startX: 0,
    startY: 0,
  };

  overlay.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    areaPicker.dragging = true;
    areaPicker.startX = event.clientX;
    areaPicker.startY = event.clientY;
    rect.style.display = "block";
    rect.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    rect.style.width = "0px";
    rect.style.height = "0px";
    overlay.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  overlay.addEventListener("pointermove", (event) => {
    if (!areaPicker?.dragging) return;
    const x = Math.min(areaPicker.startX, event.clientX);
    const y = Math.min(areaPicker.startY, event.clientY);
    const width = Math.abs(event.clientX - areaPicker.startX);
    const height = Math.abs(event.clientY - areaPicker.startY);
    rect.style.transform = `translate(${x}px, ${y}px)`;
    rect.style.width = `${width}px`;
    rect.style.height = `${height}px`;
  });

  overlay.addEventListener("pointerup", (event) => {
    if (!areaPicker?.dragging) return;
    areaPicker.dragging = false;
    const width = Math.abs(event.clientX - areaPicker.startX);
    const height = Math.abs(event.clientY - areaPicker.startY);
    if (width < 80 || height < 80) {
      rect.style.display = "none";
      return;
    }
    const area = normalizePickedArea(areaPicker.startX, areaPicker.startY, event.clientX, event.clientY);
    finishAreaPick({ ok: true, area });
  });
}

function scheduleTick() {
  if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
  animationFrameId = window.requestAnimationFrame(tick);
}

function tick(now) {
  animationFrameId = null;
  const profile = performanceProfile();
  const dt = now - lastTick;
  const motionDue = dt >= Math.max(8, profile.frameMs * 0.82);
  if (motionDue) {
    lastTick = now;
    const step = clamp(dt / 16.67, 0.2, 2.4);
    for (const pet of pets) {
      if (!pet.enabled) continue;
      updateMotion(pet, now, step);
      updateAnimation(pet, now);
      applyPetTransform(pet);
      spawnTrail(pet, now);
    }
  } else if (hasActiveRainbow()) {
    for (const pet of pets) {
      if (pet.enabled && pet.behavior?.effectMode === "rainbow") spawnTrail(pet, now);
    }
  }
  drawEffects(now);
  if (motionDue || activePet) positionPanel();
  scheduleTick();
}

async function init() {
  resizeEffectsCanvas();
  settings = await api.getSettings();
  syncPets();
  api.onSettingsChanged((next) => {
    settings = next;
    resizeEffectsCanvas();
    syncPets();
  });
  api.onCursorPoint(handleCursorPoint);
  api.onAreaPickStart(startAreaPicker);
  api.setClickThrough(true);
  lastTick = performance.now();
  scheduleTick();
}

window.addEventListener("resize", () => {
  resizeEffectsCanvas();
  const { w, h } = viewport();
  for (const pet of pets) {
    const size = getPetSize(pet);
    pet.x = clamp(pet.x, 0, Math.max(0, w - size));
    pet.y = clamp(pet.y, 0, Math.max(0, h - size));
  }
});

init();
