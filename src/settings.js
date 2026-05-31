import { CHARACTERS } from "./characters.js";

const api = window.busyPet;
const slotList = document.getElementById("slotList");
const shortcutList = document.getElementById("shortcutList");
const enabled = document.getElementById("enabled");
const fps = document.getElementById("fps");
const fpsValue = document.getElementById("fpsValue");
const performanceMode = document.getElementById("performanceMode");
const shortcutDisplayMode = document.getElementById("shortcutDisplayMode");
const languageButton = document.getElementById("languageButton");
const languagePopover = document.getElementById("languagePopover");
const languageSelect = document.getElementById("languageSelect");
const addShortcut = document.getElementById("addShortcut");
const resetSettings = document.getElementById("resetSettings");
const applyButton = document.getElementById("openOverlaySettings");
const quitApp = document.getElementById("quitApp");
const programExit = document.getElementById("programExit");
const customSelect = document.getElementById("customSelect");
const customName = document.getElementById("customName");
const addCustom = document.getElementById("addCustom");
const customImagePick = document.getElementById("customImagePick");
const customImageClear = document.getElementById("customImageClear");
const customImageStatus = document.getElementById("customImageStatus");
const paintColor = document.getElementById("paintColor");
const paintBrush = document.getElementById("paintBrush");
const paintErase = document.getElementById("paintErase");
const setEffectPoint = document.getElementById("setEffectPoint");
const clearCustom = document.getElementById("clearCustom");
const pixelGrid = document.getElementById("pixelGrid");
const effectDirection = document.getElementById("effectDirection");
const testEffect = document.getElementById("testEffect");
const effectTestCanvas = document.getElementById("effectTestCanvas");
const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));

const MAX_SLOTS = 8;
const CUSTOM_GRID_SIZE = 24;
const CUSTOM_CELL_COUNT = CUSTOM_GRID_SIZE * CUSTOM_GRID_SIZE;
const CUSTOM_CHARACTER_LIMIT = 24;
const CUSTOM_IDS = Array.from({ length: CUSTOM_CHARACTER_LIMIT }, (_item, index) => `custom-${index + 1}`);
const frames = new Map();
let settings = null;
let saveTimer = null;
let saveQueue = Promise.resolve();
let composingText = false;
let selectedCustomIndex = 0;
let eraseMode = false;
let effectPointMode = false;
let drawingPixels = false;
let activePixelPointerId = null;
let lastPaintedIndex = -1;
let effectTestPulse = 0;
let activeTab = "characters";
const spriteImageCache = new Map();

function installButtonFeedback() {
  window.addEventListener(
    "pointerdown",
    (event) => {
      const button = event.target.closest?.("button");
      if (!button || button.disabled || button.classList.contains("pixel-cell")) return;
      button.classList.remove("is-popping");
      void button.offsetWidth;
      button.classList.add("is-popping");
      window.setTimeout(() => button.classList.remove("is-popping"), 280);
    },
    true,
  );
}

const I18N = {
  en: {
    subtitle: "Desktop pixel companions",
    language: "Language",
    tabCharacters: "Characters",
    tabCustom: "Custom",
    tabLinks: "Links",
    companions: "Companions",
    effectQuality: "Effect quality",
    characters: "Characters",
    characterHint: "Per-character settings",
    pixelMaker: "Pixel Maker",
    customHint: "Custom sprite + effect point",
    effectDirection: "Effect direction",
    shortcuts: "Shortcuts",
    shortcutDisplay: "Shortcut display",
    movement: "Movement",
    heading: "Heading",
    mouse: "Mouse",
    area: "Area",
    effect: "Effect",
    speed: "Speed",
    size: "Size",
    trail: "Trail",
    drawArea: "Draw this character's movement area",
    drawAreaShort: "Draw",
    web: "Web",
    app: "App",
    name: "Name",
    newLink: "New Link",
    image: "Image",
    clearImage: "Img",
    draw: "Draw",
    erase: "Erase",
    point: "Point",
    clear: "Clear",
    add: "Add",
    test: "Test",
    reset: "Reset",
    exit: "Exit",
    apply: "Apply",
    pick: "Pick",
    dotGrid: "Dot Grid",
    imageStatus: "Image:",
    closeSettings: "Close settings",
    resetConfirm: "Reset BusyPet settings?",
    paintColor: "Paint color",
    customName: "Custom name",
    effectPreview: "Effect direction preview",
    customGrid: "Custom pixel grid",
    customLimit: "Custom character limit reached.",
    modes: {
      saver: "Saver",
      balanced: "Balanced",
      smooth: "Smooth",
      both: "Image + Name",
      image: "Image Only",
      name: "Name Only",
      free: "Roam",
      stay: "Stay",
      smart: "Smart",
      turn: "Turn",
      fixed: "Fixed",
      avoid: "Avoid",
      follow: "Follow",
      ignore: "Ignore",
      all: "All",
      top: "Top",
      middle: "Middle",
      bottom: "Bottom",
      custom: "Custom",
      off: "Off",
      normal: "Glow",
      rainbow: "Rainbow Tail",
      spark: "Spark",
      bubble: "Bubble",
      pixel: "Pixel",
      left: "X- Left",
      right: "X+ Right",
      up: "Y- Up",
      down: "Y+ Down",
    },
  },
  ko: {
    subtitle: "데스크톱 픽셀 친구들",
    language: "언어",
    tabCharacters: "캐릭터",
    tabCustom: "커스텀",
    tabLinks: "링크",
    companions: "캐릭터 켜기",
    effectQuality: "이펙트 품질",
    characters: "캐릭터",
    characterHint: "캐릭터별 설정",
    pixelMaker: "픽셀 메이커",
    customHint: "커스텀 캐릭터 + 이펙트점",
    effectDirection: "이펙트 방향",
    shortcuts: "바로가기",
    shortcutDisplay: "바로가기 표시",
    movement: "움직임",
    heading: "머리방향",
    mouse: "마우스",
    area: "영역",
    effect: "이펙트",
    speed: "속도",
    size: "크기",
    trail: "잔상",
    drawArea: "이 캐릭터의 이동 영역 직접 그리기",
    drawAreaShort: "그리기",
    web: "웹",
    app: "앱",
    name: "이름",
    newLink: "새 링크",
    image: "사진",
    clearImage: "사진",
    draw: "그리기",
    erase: "지우기",
    point: "점",
    clear: "초기화",
    add: "추가",
    test: "테스트",
    reset: "초기화",
    exit: "종료",
    apply: "적용",
    pick: "선택",
    dotGrid: "도트 그리드",
    imageStatus: "사진:",
    closeSettings: "설정 닫기",
    resetConfirm: "BusyPet 설정을 초기화할까?",
    paintColor: "칠할 색",
    customName: "커스텀 이름",
    effectPreview: "이펙트 방향 미리보기",
    customGrid: "커스텀 픽셀 그리드",
    customLimit: "커스텀 캐릭터를 더 추가할 수 없어.",
    modes: {
      saver: "절약",
      balanced: "균형",
      smooth: "부드럽게",
      both: "사진 + 이름",
      image: "사진만",
      name: "이름만",
      free: "돌아다님",
      stay: "멈춤",
      smart: "자동",
      turn: "회전",
      fixed: "고정",
      avoid: "피함",
      follow: "따라옴",
      ignore: "무시",
      all: "전체",
      top: "위",
      middle: "가운데",
      bottom: "아래",
      custom: "직접",
      off: "끔",
      normal: "빛",
      rainbow: "무지개",
      spark: "반짝",
      bubble: "버블",
      pixel: "픽셀",
      left: "X- 왼쪽",
      right: "X+ 오른쪽",
      up: "Y- 위",
      down: "Y+ 아래",
    },
  },
};

const BEHAVIOR_DEFAULT = {
  movementStyle: "free",
  orientationMode: "smart",
  mouseMode: "avoid",
  areaPreset: "all",
  area: { left: 0.03, top: 0.06, right: 0.97, bottom: 0.92 },
  speedMultiplier: 1,
  scale: 1,
  effectMode: "normal",
  effectIntensity: 1,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function lang() {
  return ["en", "ko"].includes(settings?.language) ? settings.language : "en";
}

function t(key) {
  return I18N[lang()]?.[key] ?? I18N.en[key] ?? key;
}

function modeLabel(value) {
  return I18N[lang()]?.modes?.[value] ?? I18N.en.modes[value] ?? value;
}

function iconText(icon, key) {
  return `${icon} ${t(key)}`;
}

function appPathPlaceholder() {
  if (api.platform === "win32") return "C:\\Program Files\\App\\App.exe";
  if (api.platform === "linux") return "/usr/share/applications/app.desktop";
  return "/Applications/App.app";
}

function setSelectLabels(select, labels) {
  for (const option of select.options) {
    if (labels[option.value]) option.textContent = labels[option.value];
  }
}

function renderLanguage() {
  document.documentElement.lang = lang();
  languageSelect.value = lang();
  languageButton.title = t("language");
  quitApp.title = t("closeSettings");
  customName.placeholder = t("customName");
  paintColor.title = t("paintColor");
  pixelGrid.setAttribute("aria-label", t("customGrid"));
  effectTestCanvas.setAttribute("aria-label", t("effectPreview"));
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  setSelectLabels(performanceMode, {
    saver: modeLabel("saver"),
    balanced: modeLabel("balanced"),
    smooth: modeLabel("smooth"),
  });
  setSelectLabels(shortcutDisplayMode, {
    both: modeLabel("both"),
    image: modeLabel("image"),
    name: modeLabel("name"),
  });
  setSelectLabels(effectDirection, {
    left: modeLabel("left"),
    right: modeLabel("right"),
    up: modeLabel("up"),
    down: modeLabel("down"),
  });
  addShortcut.textContent = "+";
  addShortcut.title = t("add");
  addShortcut.setAttribute("aria-label", t("add"));
  addCustom.textContent = "+";
  addCustom.title = t("add");
  addCustom.setAttribute("aria-label", t("add"));
  customImagePick.textContent = iconText("+", "image");
  customImageClear.textContent = `− ${t("clearImage")}`;
  paintBrush.textContent = iconText("■", "draw");
  paintErase.textContent = iconText("◇", "erase");
  setEffectPoint.textContent = iconText("↓", "point");
  clearCustom.textContent = iconText("×", "clear");
  testEffect.textContent = iconText("▶", "test");
  resetSettings.textContent = iconText("↺", "reset");
  programExit.textContent = iconText("⏻", "exit");
  applyButton.textContent = iconText("✓", "apply");
}

function setActiveTab(tab) {
  activeTab = ["characters", "custom", "links"].includes(tab) ? tab : "characters";
  for (const button of tabButtons) {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }
  for (const panel of tabPanels) {
    panel.hidden = panel.dataset.tabPanel !== activeTab;
  }
}

function blankPixels() {
  return Array(CUSTOM_CELL_COUNT).fill("");
}

function defaultCustomCharacter(index) {
  return {
    id: CUSTOM_IDS[index],
    name: `Custom ${index + 1}`,
    imagePath: "",
    pixels: blankPixels(),
    effectAnchor: { x: 0.5, y: 0.56 },
    effectDirection: "down",
  };
}

function behavior(slot) {
  slot.behavior = { ...clone(BEHAVIOR_DEFAULT), ...(slot.behavior || {}) };
  return slot.behavior;
}

function ensureCustomCharacters() {
  if (!settings) return [];
  if (!Array.isArray(settings.customCharacters)) settings.customCharacters = [];
  if (!settings.customCharacters.length) settings.customCharacters.push(defaultCustomCharacter(0));
  settings.customCharacters = settings.customCharacters.slice(0, CUSTOM_CHARACTER_LIMIT);
  for (let index = 0; index < settings.customCharacters.length; index += 1) {
    const existing = settings.customCharacters[index] || {};
    settings.customCharacters[index] = {
      ...defaultCustomCharacter(index),
      ...existing,
      id: CUSTOM_IDS[index],
      imagePath: String(existing.imagePath || ""),
      pixels: Array.isArray(existing.pixels)
        ? Array.from({ length: CUSTOM_CELL_COUNT }, (_item, pixelIndex) => existing.pixels[pixelIndex] || "")
        : blankPixels(),
      effectAnchor: {
        x: Number.isFinite(Number(existing.effectAnchor?.x)) ? Math.min(1, Math.max(0, Number(existing.effectAnchor.x))) : 0.5,
        y: Number.isFinite(Number(existing.effectAnchor?.y)) ? Math.min(1, Math.max(0, Number(existing.effectAnchor.y))) : 0.56,
      },
      effectDirection: ["left", "right", "up", "down"].includes(existing.effectDirection)
        ? existing.effectDirection
        : "down",
    };
  }
  return settings.customCharacters;
}

function selectedCustom() {
  return ensureCustomCharacters()[selectedCustomIndex] || defaultCustomCharacter(selectedCustomIndex);
}

function isCustomCharacterId(characterId) {
  return CUSTOM_IDS.includes(characterId);
}

function customCharacterFor(characterId) {
  return ensureCustomCharacters().find((character) => character.id === characterId) || null;
}

function fileUrlFromPath(filePath) {
  const value = String(filePath || "").trim();
  if (!value) return "";
  return `file://${value.split("/").map(encodeURIComponent).join("/")}`;
}

function fileNameFromPath(filePath) {
  return String(filePath || "").split("/").filter(Boolean).pop() || "";
}

function drawPixels(ctx, character, width, height) {
  ctx.imageSmoothingEnabled = false;
  const cell = Math.max(1, Math.floor(Math.min(width, height) / CUSTOM_GRID_SIZE));
  const offsetX = Math.floor((width - cell * CUSTOM_GRID_SIZE) / 2);
  const offsetY = Math.floor((height - cell * CUSTOM_GRID_SIZE) / 2);
  for (let index = 0; index < CUSTOM_CELL_COUNT; index += 1) {
    const color = character.pixels[index];
    if (!color) continue;
    const x = index % CUSTOM_GRID_SIZE;
    const y = Math.floor(index / CUSTOM_GRID_SIZE);
    ctx.fillStyle = color;
    ctx.fillRect(offsetX + x * cell, offsetY + y * cell, cell, cell);
  }
  return { cell, offsetX, offsetY };
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

function redrawCustomImageConsumers(imagePath) {
  const character = ensureCustomCharacters().find((item) => item.imagePath === imagePath);
  if (!character) return;
  if (character.id === selectedCustom().id) {
    drawEffectTest();
  }
  for (let index = 0; index < MAX_SLOTS; index += 1) {
    const slot = settings?.slots?.[index];
    if (slot?.character !== character.id) continue;
    const canvas = document.querySelector(`canvas.preview[data-slot="${index}"]`);
    if (canvas) renderPreview(canvas, slot.character, frames.get(index) || 0);
  }
}

function spriteImageRecord(imagePath) {
  const value = String(imagePath || "").trim();
  if (!value) return null;
  const cached = spriteImageCache.get(value);
  if (cached) return cached;
  const record = { image: new Image(), ready: false, failed: false };
  record.image.onload = () => {
    record.ready = true;
    redrawCustomImageConsumers(value);
  };
  record.image.onerror = () => {
    record.failed = true;
  };
  record.image.src = fileUrlFromPath(value);
  spriteImageCache.set(value, record);
  return record;
}

function drawCustomCharacter(ctx, character, width = ctx.canvas.width, height = ctx.canvas.height, showAnchor = false) {
  ctx.clearRect(0, 0, width, height);
  const record = spriteImageRecord(character.imagePath);
  if (record?.ready) {
    drawContainedImage(ctx, record.image, width, height);
  }
  const pixelLayout = record?.ready ? null : drawPixels(ctx, character, width, height);
  if (showAnchor) {
    const anchor = character.effectAnchor || { x: 0.5, y: 0.56 };
    const cell = pixelLayout?.cell || Math.min(width, height) / CUSTOM_GRID_SIZE;
    const offsetX = pixelLayout?.offsetX ?? Math.floor((width - cell * CUSTOM_GRID_SIZE) / 2);
    const offsetY = pixelLayout?.offsetY ?? Math.floor((height - cell * CUSTOM_GRID_SIZE) / 2);
    const ax = offsetX + anchor.x * cell * CUSTOM_GRID_SIZE;
    const ay = offsetY + anchor.y * cell * CUSTOM_GRID_SIZE;
    ctx.fillStyle = "#ff4d6d";
    ctx.fillRect(Math.round(ax) - 3, Math.round(ay) - 3, 6, 6);
    ctx.strokeStyle = "#202024";
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(ax) - 5, Math.round(ay) - 5, 10, 10);
  }
}

function activeTextField() {
  const el = document.activeElement;
  if (!el || el.tagName !== "INPUT") return null;
  return ["text", "url", "search", "email", "password"].includes(el.type) ? el : null;
}

function shouldHoldRender() {
  return composingText || !!activeTextField();
}

function applyRemoteSettings(next) {
  if (shouldHoldRender()) return;
  settings = next;
  render();
}

function scheduleSave(immediate = false) {
  if (saveTimer) clearTimeout(saveTimer);
  const run = async () => {
    saveTimer = null;
    const snapshot = clone(settings);
    saveQueue = saveQueue
      .catch(() => null)
      .then(async () => {
        applyRemoteSettings(await api.updateSettings(snapshot));
      });
    await saveQueue;
  };
  if (immediate) {
    run();
    return;
  }
  saveTimer = setTimeout(run, 120);
}

function renderPreview(canvas, characterId, frame = 0) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (isCustomCharacterId(characterId)) {
    drawCustomCharacter(ctx, customCharacterFor(characterId) || defaultCustomCharacter(0));
    return;
  }
  const character = CHARACTERS[characterId] || CHARACTERS.ufo;
  character.render(ctx, frame % character.frames, "walk");
}

function makeOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function makeSelect(options, value, onChange) {
  const select = document.createElement("select");
  for (const [optionValue, label] of options) select.appendChild(makeOption(optionValue, label));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function makeRange(min, max, step, value, format, onInput) {
  const wrap = document.createElement("div");
  wrap.className = "control full";
  const label = document.createElement("label");
  const valueEl = document.createElement("span");
  valueEl.className = "range-value";
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  valueEl.textContent = format(value);
  input.addEventListener("input", () => {
    const number = Number(input.value);
    valueEl.textContent = format(number);
    onInput(number);
  });
  wrap.append(label, input, valueEl);
  return { wrap, label };
}

function bindTextInput(input, onValue) {
  input.addEventListener("compositionstart", () => {
    composingText = true;
  });
  input.addEventListener("compositionend", () => {
    composingText = false;
    onValue(input.value);
    scheduleSave();
  });
  input.addEventListener("input", () => {
    onValue(input.value);
    if (!composingText) scheduleSave();
  });
  input.addEventListener("blur", () => {
    composingText = false;
    onValue(input.value);
    scheduleSave(true);
  });
}

function setPaintMode(mode) {
  eraseMode = mode === "erase";
  effectPointMode = mode === "effect";
  paintBrush.classList.toggle("active", mode === "draw");
  paintErase.classList.toggle("active", mode === "erase");
  setEffectPoint.classList.toggle("active", mode === "effect");
}

function renderCustomSelector() {
  customSelect.innerHTML = "";
  const customs = ensureCustomCharacters();
  for (let index = 0; index < customs.length; index += 1) {
    customSelect.appendChild(makeOption(String(index), `#${index + 1} ${customs[index].name}`));
  }
  customSelect.value = String(selectedCustomIndex);
}

function renderPixelGrid() {
  const character = selectedCustom();
  pixelGrid.innerHTML = "";
  const anchorX = Math.round((character.effectAnchor?.x ?? 0.5) * (CUSTOM_GRID_SIZE - 1));
  const anchorY = Math.round((character.effectAnchor?.y ?? 0.56) * (CUSTOM_GRID_SIZE - 1));
  for (let index = 0; index < CUSTOM_CELL_COUNT; index += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "pixel-cell";
    cell.dataset.index = String(index);
    const color = character.pixels[index];
    if (color) cell.style.background = color;
    if (index % CUSTOM_GRID_SIZE === anchorX && Math.floor(index / CUSTOM_GRID_SIZE) === anchorY) {
      cell.classList.add("effect-anchor");
    }
    pixelGrid.appendChild(cell);
  }
}

function directionVector(direction) {
  if (direction === "left") return { x: -1, y: 0, label: "X-" };
  if (direction === "right") return { x: 1, y: 0, label: "X+" };
  if (direction === "up") return { x: 0, y: -1, label: "Y-" };
  return { x: 0, y: 1, label: "Y+" };
}

function drawEffectTest() {
  const canvas = effectTestCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const character = selectedCustom();
  const direction = directionVector(character.effectDirection);
  const anchorGridX = Math.round((character.effectAnchor?.x ?? 0.5) * (CUSTOM_GRID_SIZE - 1));
  const anchorGridY = Math.round((character.effectAnchor?.y ?? 0.56) * (CUSTOM_GRID_SIZE - 1));
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#202024";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  const originX = 176;
  const originY = 18;
  const axisW = 126;
  const axisH = 52;
  ctx.save();
  ctx.strokeStyle = "rgba(32, 32, 36, 0.42)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(originX - 6, originY);
  ctx.lineTo(originX + axisW, originY);
  ctx.moveTo(originX, originY - 8);
  ctx.lineTo(originX, originY + axisH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#202024";
  ctx.font = "900 12px ui-monospace, Menlo, monospace";
  ctx.fillText("X", originX + axisW - 8, originY - 5);
  ctx.fillText("Y", originX + 7, originY + axisH - 2);
  ctx.restore();

  const spriteSize = 56;
  const sx = 54;
  const sy = 18;
  const temp = document.createElement("canvas");
  temp.width = spriteSize;
  temp.height = spriteSize;
  drawCustomCharacter(temp.getContext("2d"), character, spriteSize, spriteSize, true);
  ctx.drawImage(temp, sx, sy);

  const anchorX = sx + spriteSize * (character.effectAnchor?.x ?? 0.5);
  const anchorY = sy + spriteSize * (character.effectAnchor?.y ?? 0.56);
  const length = 42 + effectTestPulse * 12;
  const endX = anchorX + direction.x * length;
  const endY = anchorY + direction.y * length;
  const hueBase = 20 + effectTestPulse * 180;
  for (let i = 0; i < 10; i += 1) {
    const t = i / 9;
    ctx.fillStyle = `hsl(${(hueBase + i * 24) % 360} 95% 62%)`;
    ctx.globalAlpha = 0.9 - t * 0.55;
    const px = Math.round(anchorX + (endX - anchorX) * t - 4);
    const py = Math.round(anchorY + (endY - anchorY) * t - 4 + Math.sin(t * Math.PI * 2 + effectTestPulse) * 2);
    ctx.fillRect(px, py, 8, 8);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#202024";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(anchorX, anchorY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - 5 * direction.x - 4 * Math.abs(direction.y), endY - 5 * direction.y - 4 * Math.abs(direction.x));
  ctx.lineTo(endX - 5 * direction.x + 4 * Math.abs(direction.y), endY - 5 * direction.y + 4 * Math.abs(direction.x));
  ctx.closePath();
  ctx.fillStyle = "#202024";
  ctx.fill();
  ctx.fillStyle = "#202024";
  ctx.font = "900 14px ui-monospace, Menlo, monospace";
  ctx.fillText(direction.label, 18, 22);
  ctx.fillText(`x:${anchorGridX} y:${anchorGridY}`, 178, 36);
  ctx.font = "900 10px ui-monospace, Menlo, monospace";
  ctx.fillText("START", Math.max(10, anchorX - 18), Math.max(14, anchorY - 10));
}

function paintPixel(index) {
  const character = selectedCustom();
  if (effectPointMode) {
    const x = index % CUSTOM_GRID_SIZE;
    const y = Math.floor(index / CUSTOM_GRID_SIZE);
    character.effectAnchor = {
      x: x / (CUSTOM_GRID_SIZE - 1),
      y: y / (CUSTOM_GRID_SIZE - 1),
    };
    character.effectDirection = "down";
    effectDirection.value = "down";
    renderPixelGrid();
    drawEffectTest();
    scheduleSave(true);
    return;
  }
  character.pixels[index] = eraseMode ? "" : paintColor.value;
  const cell = pixelGrid.querySelector(`[data-index="${index}"]`);
  if (cell) cell.style.background = character.pixels[index] || "";
  drawEffectTest();
  scheduleSave();
}

function renderCustomEditor() {
  const customs = ensureCustomCharacters();
  if (selectedCustomIndex >= customs.length) selectedCustomIndex = 0;
  const character = selectedCustom();
  renderCustomSelector();
  customName.value = character.name;
  customImageStatus.textContent = character.imagePath
    ? `${t("imageStatus")} ${fileNameFromPath(character.imagePath)}`
    : t("dotGrid");
  customImageStatus.title = character.imagePath || "Custom dot grid";
  if (!["left", "right", "up", "down"].includes(character.effectDirection)) character.effectDirection = "down";
  effectDirection.value = character.effectDirection || "down";
  addCustom.disabled = customs.length >= CUSTOM_CHARACTER_LIMIT;
  renderPixelGrid();
  drawEffectTest();
}

function renderSlots() {
  slotList.innerHTML = "";
  const characters = [
    ...Object.values(CHARACTERS),
    ...ensureCustomCharacters().map((character) => ({
      id: character.id,
      name: character.name,
    })),
  ];
  for (let index = 0; index < MAX_SLOTS; index += 1) {
    const slot = settings.slots[index];
    const b = behavior(slot);

    const card = document.createElement("article");
    card.className = "slot-card";

    const top = document.createElement("div");
    top.className = "slot-top";

    const preview = document.createElement("canvas");
    preview.className = "preview";
    preview.width = 24;
    preview.height = 24;
    preview.dataset.slot = String(index);
    renderPreview(preview, slot.character, frames.get(index) || 0);

    const select = document.createElement("select");
    select.className = "slot-select";
    for (const character of characters) {
      select.appendChild(makeOption(character.id, `#${index + 1} ${character.name}`));
    }
    select.value = slot.character;
    select.addEventListener("change", () => {
      slot.character = select.value;
      slot.enabled = true;
      renderPreview(preview, slot.character, frames.get(index) || 0);
      scheduleSave(true);
    });

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = slot.enabled !== false;
    toggle.addEventListener("change", () => {
      slot.enabled = toggle.checked;
      scheduleSave(true);
    });

    top.append(preview, select, toggle);
    card.appendChild(top);

    const grid = document.createElement("div");
    grid.className = "control-grid";

    const movement = document.createElement("div");
    movement.className = "control";
    movement.appendChild(label(t("movement")));
    movement.appendChild(
      makeSelect(
        [
          ["free", modeLabel("free")],
          ["stay", modeLabel("stay")],
        ],
        b.movementStyle,
        (value) => {
          b.movementStyle = value;
          scheduleSave(true);
        },
      ),
    );

    const heading = document.createElement("div");
    heading.className = "control";
    heading.appendChild(label(t("heading")));
    heading.appendChild(
      makeSelect(
        [
          ["smart", modeLabel("smart")],
          ["turn", modeLabel("turn")],
          ["fixed", modeLabel("fixed")],
        ],
        b.orientationMode,
        (value) => {
          b.orientationMode = value;
          scheduleSave(true);
        },
      ),
    );

    const mouse = document.createElement("div");
    mouse.className = "control";
    mouse.appendChild(label(t("mouse")));
    mouse.appendChild(
      makeSelect(
        [
          ["avoid", modeLabel("avoid")],
          ["follow", modeLabel("follow")],
          ["ignore", modeLabel("ignore")],
        ],
        b.mouseMode,
        (value) => {
          b.mouseMode = value;
          scheduleSave(true);
        },
      ),
    );

    const area = document.createElement("div");
    area.className = "control";
    area.appendChild(label(t("area")));
    const areaRow = document.createElement("div");
    areaRow.className = "area-row";
    const areaSelect = makeSelect(
      [
        ["all", modeLabel("all")],
        ["top", modeLabel("top")],
        ["middle", modeLabel("middle")],
        ["bottom", modeLabel("bottom")],
        ["custom", modeLabel("custom")],
      ],
      b.areaPreset,
      (value) => {
        b.areaPreset = value;
        scheduleSave(true);
      },
    );
    const drawButton = document.createElement("button");
    drawButton.className = "draw-button";
    drawButton.type = "button";
    drawButton.textContent = iconText("▣", "drawAreaShort");
    drawButton.title = t("drawArea");
    drawButton.addEventListener("click", async () => {
      drawButton.disabled = true;
      drawButton.textContent = "...";
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      settings = await api.updateSettings(settings);
      const result = await api.pickArea(index);
      if (result?.ok) {
        settings = result.settings;
      } else {
        settings = await api.getSettings();
      }
      render();
    });
    areaRow.append(areaSelect, drawButton);
    area.appendChild(areaRow);

    const effect = document.createElement("div");
    effect.className = "control";
    effect.appendChild(label(t("effect")));
    effect.appendChild(
      makeSelect(
        [
          ["off", modeLabel("off")],
          ["normal", modeLabel("normal")],
          ["rainbow", modeLabel("rainbow")],
          ["spark", modeLabel("spark")],
          ["bubble", modeLabel("bubble")],
          ["pixel", modeLabel("pixel")],
        ],
        b.effectMode,
        (value) => {
          b.effectMode = value;
          scheduleSave(true);
        },
      ),
    );

    const speed = makeRange(0.2, 3, 0.1, b.speedMultiplier, (v) => `${v.toFixed(1)}x`, (value) => {
      b.speedMultiplier = value;
      scheduleSave();
    });
    speed.label.textContent = t("speed");

    const scale = makeRange(0.5, 2.5, 0.1, b.scale, (v) => `${v.toFixed(1)}x`, (value) => {
      b.scale = value;
      scheduleSave();
    });
    scale.label.textContent = t("size");

    const intensity = makeRange(0.3, 2, 0.1, b.effectIntensity, (v) => `${v.toFixed(1)}x`, (value) => {
      b.effectIntensity = value;
      scheduleSave();
    });
    intensity.label.textContent = t("trail");

    grid.append(movement, heading, mouse, area, effect, speed.wrap, scale.wrap, intensity.wrap);
    card.appendChild(grid);
    slotList.appendChild(card);
  }
}

function label(text) {
  const node = document.createElement("label");
  node.textContent = text;
  return node;
}

function renderShortcuts() {
  shortcutList.innerHTML = "";
  settings.shortcutDisplayMode = ["both", "image", "name"].includes(settings.shortcutDisplayMode)
    ? settings.shortcutDisplayMode
    : "both";
  shortcutDisplayMode.value = settings.shortcutDisplayMode;
  for (let index = 0; index < settings.shortcuts.length; index += 1) {
    const shortcut = settings.shortcuts[index];
    shortcut.type = shortcut.type === "app" ? "app" : "web";
    delete shortcut.displayMode;
    const row = document.createElement("div");
    row.className = "shortcut-row";

    const type = document.createElement("select");
    type.append(makeOption("web", t("web")), makeOption("app", t("app")));
    type.value = shortcut.type;
    type.addEventListener("change", () => {
      shortcut.type = type.value;
      if (shortcut.type === "app") {
        delete shortcut.url;
        shortcut.appPath ||= "";
      } else {
        delete shortcut.appPath;
        shortcut.url ||= "https://";
      }
      renderShortcuts();
      scheduleSave();
    });

    const name = document.createElement("input");
    name.type = "text";
    name.placeholder = t("name");
    name.value = shortcut.name || "";
    bindTextInput(name, (value) => {
      shortcut.name = value;
    });

    const target = document.createElement("input");
    target.className = "shortcut-target";
    target.type = "text";
    target.inputMode = shortcut.type === "web" ? "url" : "text";
    target.placeholder = shortcut.type === "web" ? "https://example.com" : appPathPlaceholder();
    target.value = shortcut.type === "web" ? shortcut.url || "" : shortcut.appPath || "";
    bindTextInput(target, (value) => {
      if (shortcut.type === "web") shortcut.url = value;
      else shortcut.appPath = value;
    });

    const tools = document.createElement("div");
    tools.className = "shortcut-tools";

    const imagePreview = document.createElement("span");
    imagePreview.className = "shortcut-image-preview";
    const imagePath = shortcut.imagePath || "";
    if (imagePath) {
      const image = document.createElement("img");
      image.alt = "";
      image.src = fileUrlFromPath(imagePath);
      image.addEventListener("error", () => {
        imagePreview.textContent = "IMG";
      });
      imagePreview.appendChild(image);
    } else {
      imagePreview.textContent = t("image").slice(0, 3).toUpperCase();
    }

    const imagePick = document.createElement("button");
    imagePick.className = "pick-button";
    imagePick.type = "button";
    imagePick.textContent = iconText("+", "image");
    imagePick.title = t("image");
    imagePick.addEventListener("click", async () => {
      const result = await api.pickShortcutImage();
      if (!result?.ok) return;
      shortcut.imagePath = result.imagePath;
      renderShortcuts();
      scheduleSave(true);
    });

    const imageClear = document.createElement("button");
    imageClear.className = "remove-button";
    imageClear.type = "button";
    imageClear.textContent = `− ${t("clearImage")}`;
    imageClear.addEventListener("click", () => {
      delete shortcut.imagePath;
      renderShortcuts();
      scheduleSave(true);
    });

    const pick = document.createElement("button");
    pick.className = "pick-button";
    pick.type = "button";
    pick.textContent = iconText("+", "app");
    pick.title = t("pick");
    pick.classList.toggle("is-invisible", shortcut.type !== "app");
    pick.disabled = shortcut.type !== "app";
    pick.tabIndex = shortcut.type === "app" ? 0 : -1;
    pick.setAttribute("aria-hidden", shortcut.type === "app" ? "false" : "true");
    pick.addEventListener("click", async () => {
      const result = await api.pickAppShortcut();
      if (!result?.ok) return;
      shortcut.type = "app";
      shortcut.name = shortcut.name || result.name;
      shortcut.appPath = result.appPath;
      renderShortcuts();
      scheduleSave(true);
    });
    tools.append(imagePreview, imagePick, imageClear, pick);

    const remove = document.createElement("button");
    remove.className = "remove-button";
    remove.type = "button";
    remove.textContent = "−";
    remove.addEventListener("click", () => {
      settings.shortcuts.splice(index, 1);
      renderShortcuts();
      scheduleSave(true);
    });

    row.append(type, name, remove, target, tools);
    shortcutList.appendChild(row);
  }
}

function render() {
  settings.language = ["en", "ko"].includes(settings.language) ? settings.language : "en";
  renderLanguage();
  enabled.checked = settings.enabled !== false;
  const nextFps = Math.round(Number(settings.fps || 16));
  fps.value = String(nextFps);
  fpsValue.textContent = String(nextFps);
  performanceMode.value = ["saver", "balanced", "smooth"].includes(settings.performanceMode)
    ? settings.performanceMode
    : "saver";
  renderSlots();
  renderCustomEditor();
  renderShortcuts();
  setActiveTab(activeTab);
}

function animatePreviews() {
  if (!settings || document.hidden) return;
  for (let index = 0; index < MAX_SLOTS; index += 1) {
    const next = (frames.get(index) || 0) + 1;
    frames.set(index, next);
    const canvas = document.querySelector(`canvas.preview[data-slot="${index}"]`);
    const slot = settings.slots[index];
    if (canvas && slot) renderPreview(canvas, slot.character, next);
  }
}

enabled.addEventListener("change", () => {
  settings.enabled = enabled.checked;
  scheduleSave(true);
});

fps.addEventListener("input", () => {
  const value = Math.round(Number(fps.value));
  fpsValue.textContent = String(value);
  settings.fps = value;
  scheduleSave();
});

performanceMode.addEventListener("change", () => {
  settings.performanceMode = performanceMode.value;
  scheduleSave(true);
});

for (const button of tabButtons) {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
}

languageButton.addEventListener("click", (event) => {
  event.stopPropagation();
  languagePopover.hidden = !languagePopover.hidden;
});

languageSelect.addEventListener("change", () => {
  settings.language = languageSelect.value;
  render();
  scheduleSave(true);
});

window.addEventListener("click", (event) => {
  if (languagePopover.hidden) return;
  if (event.target.closest(".top-actions")) return;
  languagePopover.hidden = true;
});

shortcutDisplayMode.addEventListener("change", () => {
  settings.shortcutDisplayMode = shortcutDisplayMode.value;
  scheduleSave(true);
});

addShortcut.addEventListener("click", () => {
  settings.shortcuts.push({ type: "web", name: t("newLink"), url: "https://", imagePath: "" });
  renderShortcuts();
  scheduleSave();
});

customSelect.addEventListener("change", () => {
  selectedCustomIndex = Number(customSelect.value) || 0;
  renderCustomEditor();
});

bindTextInput(customName, (value) => {
  const character = selectedCustom();
  character.name = value.trim().slice(0, 32) || `Custom ${selectedCustomIndex + 1}`;
});

addCustom.addEventListener("click", () => {
  const customs = ensureCustomCharacters();
  if (customs.length >= CUSTOM_CHARACTER_LIMIT) {
    alert(t("customLimit"));
    return;
  }
  const source = selectedCustom();
  const index = customs.length;
  settings.customCharacters.push({
    ...clone(source),
    id: CUSTOM_IDS[index],
    name: source.name && !/^Custom \d+$/i.test(source.name) ? `${source.name} ${index + 1}` : `Custom ${index + 1}`,
    pixels: Array.isArray(source.pixels) ? [...source.pixels] : blankPixels(),
    effectAnchor: { ...(source.effectAnchor || { x: 0.5, y: 0.56 }) },
    effectDirection: ["left", "right", "up", "down"].includes(source.effectDirection) ? source.effectDirection : "down",
  });
  selectedCustomIndex = index;
  render();
  scheduleSave(true);
});

customImagePick.addEventListener("click", async () => {
  const result = await api.pickSpriteImage();
  if (!result?.ok) return;
  selectedCustom().imagePath = result.imagePath;
  renderCustomEditor();
  renderSlots();
  scheduleSave(true);
});

customImageClear.addEventListener("click", () => {
  selectedCustom().imagePath = "";
  renderCustomEditor();
  renderSlots();
  scheduleSave(true);
});

paintBrush.addEventListener("click", () => setPaintMode("draw"));
paintErase.addEventListener("click", () => setPaintMode("erase"));
setEffectPoint.addEventListener("click", () => setPaintMode("effect"));

clearCustom.addEventListener("click", () => {
  const character = selectedCustom();
  character.pixels = blankPixels();
  renderPixelGrid();
  drawEffectTest();
  scheduleSave(true);
});

effectDirection.addEventListener("change", () => {
  selectedCustom().effectDirection = effectDirection.value;
  drawEffectTest();
  scheduleSave(true);
});

testEffect.addEventListener("click", () => {
  effectTestPulse = effectTestPulse > 0 ? 0 : 1;
  drawEffectTest();
  window.setTimeout(() => {
    effectTestPulse = 0;
    drawEffectTest();
  }, 420);
});

function pixelIndexFromPointer(event) {
  const direct = event.target.closest?.(".pixel-cell");
  const cell = direct || document.elementFromPoint(event.clientX, event.clientY)?.closest(".pixel-cell");
  if (!cell || !pixelGrid.contains(cell)) return null;
  return Number(cell.dataset.index);
}

function paintFromPointer(event) {
  const index = pixelIndexFromPointer(event);
  if (!Number.isInteger(index)) return;
  if (index === lastPaintedIndex && !effectPointMode) return;
  lastPaintedIndex = index;
  paintPixel(index);
}

pixelGrid.addEventListener("pointerdown", (event) => {
  const index = pixelIndexFromPointer(event);
  if (!Number.isInteger(index)) return;
  drawingPixels = true;
  activePixelPointerId = event.pointerId;
  lastPaintedIndex = -1;
  paintFromPointer(event);
  pixelGrid.setPointerCapture(event.pointerId);
  event.preventDefault();
});

pixelGrid.addEventListener("pointermove", (event) => {
  if (!drawingPixels || event.pointerId !== activePixelPointerId) return;
  paintFromPointer(event);
  event.preventDefault();
});

window.addEventListener("pointerup", (event) => {
  if (activePixelPointerId !== null && event.pointerId !== activePixelPointerId) return;
  drawingPixels = false;
  activePixelPointerId = null;
  lastPaintedIndex = -1;
});

window.addEventListener("pointercancel", () => {
  drawingPixels = false;
  activePixelPointerId = null;
  lastPaintedIndex = -1;
});

resetSettings.addEventListener("click", async () => {
  if (!confirm(t("resetConfirm"))) return;
  settings = await api.resetSettings();
  render();
});

applyButton.addEventListener("click", () => {
  scheduleSave(true);
});

quitApp.addEventListener("click", () => {
  api.closeSettings();
});

programExit.addEventListener("click", () => {
  api.quit();
});

async function init() {
  settings = await api.getSettings();
  ensureCustomCharacters();
  setPaintMode("draw");
  render();
  api.onSettingsChanged((next) => {
    applyRemoteSettings(next);
  });
  setInterval(animatePreviews, 320);
}

installButtonFeedback();
init();
