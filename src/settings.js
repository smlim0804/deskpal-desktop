import { CHARACTERS } from "./characters.js";

const api = window.deskPal;
const slotList = document.getElementById("slotList");
const shortcutList = document.getElementById("shortcutList");
const enabled = document.getElementById("enabled");
const ghostMode = document.getElementById("ghostMode");
const ghostDelaySeconds = document.getElementById("ghostDelaySeconds");
const ghostDelayValue = document.getElementById("ghostDelayValue");
const ghostTriggerMouse = document.getElementById("ghostTriggerMouse");
const ghostTriggerKeyboard = document.getElementById("ghostTriggerKeyboard");
const ghostTriggerWheel = document.getElementById("ghostTriggerWheel");
const showTrayIcon = document.getElementById("showTrayIcon");
const fps = document.getElementById("fps");
const fpsValue = document.getElementById("fpsValue");
const performanceMode = document.getElementById("performanceMode");
const licenseBadge = document.getElementById("licenseBadge");
const licenseHelp = document.getElementById("licenseHelp");
const licenseKey = document.getElementById("licenseKey");
const activateLicense = document.getElementById("activateLicense");
const buyPro = document.getElementById("buyPro");
const licenseStatus = document.getElementById("licenseStatus");
const updateBadge = document.getElementById("updateBadge");
const updateStatus = document.getElementById("updateStatus");
const checkUpdates = document.getElementById("checkUpdates");
const openUpdate = document.getElementById("openUpdate");
const shortcutDisplayMode = document.getElementById("shortcutDisplayMode");
const languageButton = document.getElementById("languageButton");
const languagePopover = document.getElementById("languagePopover");
const languageSelect = document.getElementById("languageSelect");
const addShortcut = document.getElementById("addShortcut");
const addAppShortcut = document.getElementById("addAppShortcut");
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
const FREE_CHARACTER_LIMIT = 2;
const FREE_WEB_SHORTCUT_LIMIT = 1;
const FREE_APP_SHORTCUT_LIMIT = 1;
const CUSTOM_GRID_SIZE = 24;
const CUSTOM_CELL_COUNT = CUSTOM_GRID_SIZE * CUSTOM_GRID_SIZE;
const CUSTOM_CHARACTER_LIMIT = 24;
const CUSTOM_IDS = Array.from({ length: CUSTOM_CHARACTER_LIMIT }, (_item, index) => `custom-${index + 1}`);
const frames = new Map();
let settings = null;
let saveTimer = null;
let saveInFlight = false;
let savePending = false;
const slotSaveTimers = new Map();
let composingText = false;
let selectedCustomIndex = 0;
let eraseMode = false;
let effectPointMode = false;
let drawingPixels = false;
let activePixelPointerId = null;
let lastPaintedIndex = -1;
let effectTestPulse = 0;
let activeTab = "characters";
let pendingRemoteSettings = null;
let remoteRenderTimer = null;
const spriteImageCache = new Map();

function installButtonFeedback() {
  window.addEventListener(
    "pointerdown",
    (event) => {
      const button = event.target.closest?.("button");
      if (!button || button.disabled || button.classList.contains("pixel-cell") || button.classList.contains("tab-button")) return;
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
    tabLinks: "Shortcuts",
    companions: "Companions",
    ghostMode: "Ghost Mode",
    ghostDelay: "Reappear after",
    ghostMouse: "Mouse",
    ghostKeyboard: "Keyboard",
    ghostWheel: "Wheel",
    showTrayIcon: "Show tray icon",
    effectQuality: "Effect quality",
    licenseTitle: "DeskPal Pro",
    licenseFree: "Free",
    licensePro: "Pro",
    licenseHelpFree: "Free: 2 characters, 1 app shortcut, 1 web shortcut, no custom sprites or effects.",
    licenseHelpPro: "Pro active: all character slots, custom sprites, shortcuts, and effects are unlocked.",
    licensePlaceholder: "LICENSE-KEY",
    activateLicense: "Activate",
    buyPro: "Buy Pro",
    licenseActivating: "Activating...",
    licenseActivated: "Pro activated.",
    updatesTitle: "Updates",
    updateReady: "Ready",
    updateAvailable: "Update",
    updateCurrent: "Up to date",
    updateChecking: "Checking...",
    updateStatusReady: "Check for DeskPal updates.",
    updateStatusCurrent: "DeskPal is up to date.",
    updateStatusAvailable: "New version {version} is available.",
    checkUpdates: "Check",
    openUpdate: "Update",
    characters: "Characters",
    characterHint: "Per-character settings",
    pixelMaker: "Pixel Maker",
    customHint: "Custom sprite + effect point",
    effectDirection: "Effect direction",
    shortcuts: "Shortcuts",
    webShortcuts: "Web shortcuts",
    appShortcuts: "App shortcuts",
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
    none: "None",
    addWebShortcut: "+ Web",
    addAppShortcut: "+ App",
    test: "Test",
    reset: "Reset",
    exit: "Exit",
    apply: "Apply",
    pick: "Pick",
    selectApp: "Select App",
    noApp: "No app selected",
    dotGrid: "Dot Grid",
    imageStatus: "Image:",
    closeSettings: "Close settings",
    resetConfirm: "Reset DeskPal settings?",
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
    tabLinks: "바로가기",
    companions: "캐릭터 켜기",
    ghostMode: "유령 모드",
    ghostDelay: "복귀 대기",
    ghostMouse: "마우스",
    ghostKeyboard: "키보드",
    ghostWheel: "휠",
    showTrayIcon: "상태바에 표시",
    effectQuality: "이펙트 품질",
    licenseTitle: "DeskPal Pro",
    licenseFree: "Free",
    licensePro: "Pro",
    licenseHelpFree: "무료: 캐릭터 2개, 앱 바로가기 1개, 웹 바로가기 1개. 커스텀과 이펙트는 잠겨 있어.",
    licenseHelpPro: "Pro 활성화됨: 모든 캐릭터 슬롯, 커스텀, 바로가기, 이펙트가 열렸어.",
    licensePlaceholder: "라이선스 키",
    activateLicense: "활성화",
    buyPro: "Pro 구매",
    licenseActivating: "활성화 중...",
    licenseActivated: "Pro 활성화 완료.",
    updatesTitle: "업데이트",
    updateReady: "대기",
    updateAvailable: "업데이트",
    updateCurrent: "최신",
    updateChecking: "확인 중...",
    updateStatusReady: "DeskPal 업데이트를 확인할 수 있어.",
    updateStatusCurrent: "지금 최신 버전이야.",
    updateStatusAvailable: "새 버전 {version}이 있어.",
    checkUpdates: "확인",
    openUpdate: "업데이트",
    characters: "캐릭터",
    characterHint: "캐릭터별 설정",
    pixelMaker: "픽셀 메이커",
    customHint: "커스텀 캐릭터 + 이펙트점",
    effectDirection: "이펙트 방향",
    shortcuts: "바로가기",
    webShortcuts: "웹 바로가기",
    appShortcuts: "앱 바로가기",
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
    none: "없음",
    addWebShortcut: "+ 웹",
    addAppShortcut: "+ 앱",
    test: "테스트",
    reset: "초기화",
    exit: "종료",
    apply: "적용",
    pick: "선택",
    selectApp: "앱 선택",
    noApp: "선택된 앱 없음",
    dotGrid: "도트 그리드",
    imageStatus: "사진:",
    closeSettings: "설정 닫기",
    resetConfirm: "DeskPal 설정을 초기화할까?",
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

function isPro() {
  return settings?.license?.plan === "pro" && settings?.license?.status === "active";
}

function freeLimitText() {
  return t(isPro() ? "licenseHelpPro" : "licenseHelpFree");
}

function shortcutCount(kind) {
  return Array.isArray(settings?.shortcuts)
    ? settings.shortcuts.filter((shortcut) => (kind === "app" ? shortcut.type === "app" : shortcut.type !== "app")).length
    : 0;
}

function proLock(node, locked, title = freeLimitText()) {
  if (!node) return;
  node.disabled = !!locked;
  node.title = locked ? title : "";
  node.classList.toggle("is-pro-locked", !!locked);
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
  licenseKey.placeholder = t("licensePlaceholder");
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
  addShortcut.textContent = t("addWebShortcut");
  addShortcut.title = t("addWebShortcut");
  addShortcut.setAttribute("aria-label", t("addWebShortcut"));
  addAppShortcut.textContent = t("addAppShortcut");
  addAppShortcut.title = t("addAppShortcut");
  addAppShortcut.setAttribute("aria-label", t("addAppShortcut"));
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
  activateLicense.textContent = iconText("★", "activateLicense");
  buyPro.textContent = iconText("↗", "buyPro");
  checkUpdates.textContent = iconText("↻", "checkUpdates");
  openUpdate.textContent = iconText("⬇", "openUpdate");
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
  // Must return a STABLE reference: control handlers capture `behavior(slot)`
  // once at render time, so reassigning a fresh object on later calls (e.g.
  // slotPatch, the effect-anchor picker) would orphan that capture and silently
  // drop the user's edits. Initialize if missing, then backfill defaults in
  // place — never replace the object.
  if (!slot.behavior || typeof slot.behavior !== "object") {
    slot.behavior = clone(BEHAVIOR_DEFAULT);
    return slot.behavior;
  }
  const defaults = clone(BEHAVIOR_DEFAULT);
  for (const key of Object.keys(defaults)) {
    if (slot.behavior[key] === undefined) slot.behavior[key] = defaults[key];
  }
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

function activeInteractiveField() {
  const el = document.activeElement;
  if (!el) return null;
  if (el.tagName === "SELECT" || el.tagName === "TEXTAREA") return el;
  if (el.tagName !== "INPUT") return null;
  return ["text", "url", "search", "email", "password", "range", "color"].includes(el.type) ? el : null;
}

function shouldHoldRender() {
  return composingText || !!activeInteractiveField();
}

function flushPendingRemoteSettings() {
  if (!pendingRemoteSettings || shouldHoldRender()) return;
  const next = pendingRemoteSettings;
  pendingRemoteSettings = null;
  settings = next;
  render();
}

function schedulePendingRemoteFlush() {
  if (remoteRenderTimer) clearTimeout(remoteRenderTimer);
  remoteRenderTimer = setTimeout(() => {
    remoteRenderTimer = null;
    flushPendingRemoteSettings();
  }, 140);
}

function flushPendingRemoteSoon() {
  window.setTimeout(flushPendingRemoteSettings, 0);
}

function applyRemoteSettings(next) {
  if (shouldHoldRender()) {
    pendingRemoteSettings = next;
    schedulePendingRemoteFlush();
    return;
  }
  pendingRemoteSettings = null;
  settings = next;
  render();
}

async function saveLatestSettings() {
  if (!settings || saveInFlight) return;
  savePending = false;
  saveInFlight = true;
  const snapshot = clone(settings);
  try {
    const next = await api.updateSettings(snapshot);
    if (!savePending) applyRemoteSettings(next);
  } catch (error) {
    console.error("Failed to save DeskPal settings", error);
  } finally {
    saveInFlight = false;
    if (savePending) {
      saveLatestSettings();
    }
  }
}

function scheduleSave(immediate = false) {
  savePending = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const run = () => {
    if (saveInFlight) return;
    saveLatestSettings();
  };
  if (immediate) {
    run();
    return;
  }
  saveTimer = setTimeout(run, 60);
}

function slotPatch(index) {
  const slot = settings?.slots?.[index];
  if (!slot) return null;
  return {
    character: slot.character,
    enabled: slot.enabled !== false,
    behavior: clone(behavior(slot)),
  };
}

function scheduleSlotSave(index, immediate = false) {
  if (!api.updateSlot) {
    scheduleSave(immediate);
    return;
  }
  const run = async () => {
    slotSaveTimers.delete(index);
    const patch = slotPatch(index);
    if (!patch) return;
    try {
      applyRemoteSettings(await api.updateSlot(index, patch));
    } catch (error) {
      console.error("Failed to save DeskPal character settings", error);
    }
  };
  const existing = slotSaveTimers.get(index);
  if (existing) clearTimeout(existing);
  if (immediate) {
    run();
    return;
  }
  slotSaveTimers.set(index, window.setTimeout(run, 60));
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
    onInput(number, false);
  });
  input.addEventListener("change", () => {
    const number = Number(input.value);
    valueEl.textContent = format(number);
    onInput(number, true);
  });
  wrap.append(label, input, valueEl);
  const setValue = (nextValue) => {
    const number = Number(nextValue);
    input.value = String(number);
    valueEl.textContent = format(number);
  };
  return { wrap, label, input, valueEl, setValue };
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
  if (direction === "left") return { x: -1, y: 0, glyph: "←" };
  if (direction === "right") return { x: 1, y: 0, glyph: "→" };
  if (direction === "up") return { x: 0, y: -1, glyph: "↑" };
  return { x: 0, y: 1, glyph: "↓" };
}

// A clean indicator: the sprite plus a bold arrow + colour stream that simply
// shows which way the effect shoots out (no axes, coordinates, or START label).
function drawEffectTest() {
  const canvas = effectTestCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const character = selectedCustom();
  const dirName = ["left", "right", "up", "down"].includes(character.effectDirection)
    ? character.effectDirection
    : "down";
  const dir = directionVector(dirName);
  const horizontal = dir.x !== 0;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#202024";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  // Park the sprite on the side opposite the effect direction so the stream
  // always has room to travel across the panel.
  const spriteSize = horizontal ? 60 : 46;
  const half = spriteSize / 2;
  const pad = 16;
  const cx = horizontal ? (dir.x > 0 ? pad + half : width - pad - half) : width / 2;
  const cy = horizontal ? height / 2 : (dir.y > 0 ? pad + half : height - pad - half);

  const temp = document.createElement("canvas");
  temp.width = spriteSize;
  temp.height = spriteSize;
  drawCustomCharacter(temp.getContext("2d"), character, spriteSize, spriteSize, false);
  ctx.drawImage(temp, Math.round(cx - half), Math.round(cy - half));

  const avail = horizontal
    ? (dir.x > 0 ? width - pad - (cx + half) : cx - half - pad)
    : (dir.y > 0 ? height - pad - (cy + half) : cy - half - pad);
  const reach = Math.max(20, avail);
  const originX = cx + dir.x * (half + 2);
  const originY = cy + dir.y * (half + 2);
  const perpX = -dir.y;
  const perpY = dir.x;

  // Colour-stream particles flowing outward in the chosen direction.
  const hueBase = 18 + effectTestPulse * 170;
  const count = 7;
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const dist = t * reach * (0.7 + effectTestPulse * 0.3);
    const wob = Math.sin(t * 7 + effectTestPulse * 4) * 3;
    const px = originX + dir.x * dist + perpX * wob;
    const py = originY + dir.y * dist + perpY * wob;
    const box = Math.max(3, 9 - i);
    ctx.fillStyle = `hsl(${(hueBase + i * 24) % 360} 92% 60%)`;
    ctx.globalAlpha = 0.95 - t * 0.55;
    ctx.fillRect(Math.round(px - box / 2), Math.round(py - box / 2), box, box);
  }
  ctx.globalAlpha = 1;

  // Bold direction arrow.
  const arrowLen = Math.min(reach, 40);
  const ax1 = originX + dir.x * arrowLen;
  const ay1 = originY + dir.y * arrowLen;
  const head = 9;
  ctx.strokeStyle = "#202024";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(ax1, ay1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax1, ay1);
  ctx.lineTo(ax1 - dir.x * head + perpX * head, ay1 - dir.y * head + perpY * head);
  ctx.lineTo(ax1 - dir.x * head - perpX * head, ay1 - dir.y * head - perpY * head);
  ctx.closePath();
  ctx.fillStyle = "#202024";
  ctx.fill();

  // Big direction glyph in the corner.
  ctx.fillStyle = "#202024";
  ctx.font = "900 24px ui-monospace, Menlo, monospace";
  ctx.fillText(dir.glyph, 14, 32);
}

function paintPixel(index) {
  if (!isPro()) return;
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
  const locked = !isPro();
  customName.disabled = locked;
  customSelect.disabled = locked;
  customImagePick.disabled = locked;
  customImageClear.disabled = locked;
  paintColor.disabled = locked;
  paintBrush.disabled = locked;
  paintErase.disabled = locked;
  setEffectPoint.disabled = locked;
  clearCustom.disabled = locked;
  effectDirection.disabled = locked;
  testEffect.disabled = locked;
  addCustom.disabled = locked || customs.length >= CUSTOM_CHARACTER_LIMIT;
  for (const node of [customName, customSelect, customImagePick, customImageClear, paintColor, paintBrush, paintErase, setEffectPoint, clearCustom, effectDirection, testEffect, addCustom]) {
    proLock(node, locked);
  }
  renderPixelGrid();
  drawEffectTest();
}

function renderSlots() {
  slotList.innerHTML = "";
  const pro = isPro();
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
    const slotLocked = !pro && index >= FREE_CHARACTER_LIMIT;

    const card = document.createElement("article");
    card.className = "slot-card";
    card.classList.toggle("is-pro-locked", slotLocked);

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
    for (const character of pro ? characters : Object.values(CHARACTERS)) {
      select.appendChild(makeOption(character.id, `#${index + 1} ${character.name}`));
    }
    select.value = slot.character;
    select.disabled = slotLocked;
    proLock(select, slotLocked);
    select.addEventListener("change", () => {
      if (slotLocked) return;
      slot.character = select.value;
      slot.enabled = true;
      delete behavior(slot).effectAnchor;
      renderPreview(preview, slot.character, frames.get(index) || 0);
      renderSlots();
      scheduleSlotSave(index, true);
    });

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = slot.enabled !== false;
    toggle.disabled = slotLocked;
    proLock(toggle, slotLocked);
    toggle.addEventListener("change", () => {
      if (slotLocked) return;
      slot.enabled = toggle.checked;
      scheduleSlotSave(index, true);
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
          scheduleSlotSave(index, true);
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
          scheduleSlotSave(index, true);
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
          scheduleSlotSave(index, true);
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
        scheduleSlotSave(index, true);
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
    const effectSelect = makeSelect(
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
          scheduleSlotSave(index, true);
        },
      );
    effectSelect.disabled = !pro;
    proLock(effectSelect, !pro);
    effect.appendChild(effectSelect);

    const speed = makeRange(0.2, 3, 0.1, b.speedMultiplier, (v) => `${v.toFixed(1)}x`, (value, immediate) => {
      b.speedMultiplier = value;
      scheduleSlotSave(index, immediate);
    });
    speed.label.textContent = t("speed");

    const scale = makeRange(0.5, 2.5, 0.1, b.scale, (v) => `${v.toFixed(1)}x`, (value, immediate) => {
      b.scale = value;
      scheduleSlotSave(index, immediate);
    });
    scale.label.textContent = t("size");

    const intensity = makeRange(0.3, 2, 0.1, b.effectIntensity, (v) => `${v.toFixed(1)}x`, (value, immediate) => {
      b.effectIntensity = value;
      scheduleSlotSave(index, immediate);
    });
    intensity.label.textContent = t("trail");
    proLock(intensity.input, !pro);

    // Per-character effect-position controls were removed by request: built-in
    // characters use their own default effect anchor and custom characters set
    // the effect point in the Pixel Maker. Any stale per-slot anchor is dropped
    // (see normalizeBehavior) so it no longer overrides those defaults.
    delete b.effectAnchor;

    grid.append(
      movement,
      heading,
      mouse,
      area,
      effect,
      speed.wrap,
      scale.wrap,
      intensity.wrap,
    );
    card.appendChild(grid);
    slotList.appendChild(card);
  }
}

function label(text) {
  const node = document.createElement("label");
  node.textContent = text;
  return node;
}

async function chooseAppShortcut(index) {
  const result = await api.pickAppShortcut();
  // A queued save can swap out the whole `settings` object while the native
  // picker is open, so re-acquire the shortcut by index instead of holding a
  // stale reference — otherwise the very first pick is silently dropped and
  // the user has to add the app twice.
  const shortcut = settings.shortcuts[index];
  if (!shortcut) return false;
  if (!result?.ok) return false;
  shortcut.type = "app";
  // Keep a name the user already typed; only fall back to the app's own name
  // when the field is empty or still the default placeholder.
  const typedName = (shortcut.name || "").trim();
  const keepTyped = typedName && typedName !== t("newLink");
  shortcut.name = keepTyped ? shortcut.name : result.name || t("app");
  shortcut.appPath = result.appPath;
  shortcut.imagePath = result.imagePath || shortcut.imagePath || "";
  delete shortcut.url;
  renderShortcuts();
  scheduleSave(true);
  return true;
}

function switchShortcutToWeb(shortcut) {
  shortcut.type = "web";
  delete shortcut.appPath;
  delete shortcut.imagePath;
  shortcut.url ||= "https://";
}

function switchShortcutToAppDraft(shortcut) {
  shortcut.type = "app";
  delete shortcut.url;
  shortcut.appPath ||= "";
}

function shortcutImagePlaceholder(shortcut) {
  const icon = document.createElement("span");
  icon.className = "shortcut-image-placeholder";
  icon.setAttribute("aria-hidden", "true");
  if (shortcut.type !== "app") {
    icon.classList.add("is-web-shortcut");
    icon.textContent = "↗";
  }
  return icon;
}

function renderShortcutRow(shortcut, index) {
  shortcut.type = shortcut.type === "app" ? "app" : "web";
  delete shortcut.displayMode;
  const row = document.createElement("div");
  row.className = "shortcut-row";
  row.dataset.kind = shortcut.type;

  const type = document.createElement("select");
  type.append(makeOption("web", t("web")), makeOption("app", t("app")));
  type.value = shortcut.type;
  type.addEventListener("change", async () => {
    if (type.value === "app") {
      switchShortcutToAppDraft(shortcut);
      renderShortcuts();
      const picked = await chooseAppShortcut(index);
      if (!picked) {
        const current = settings.shortcuts[index];
        if (current) {
          switchShortcutToWeb(current);
          renderShortcuts();
          scheduleSave(true);
        }
      }
      return;
    }
    switchShortcutToWeb(shortcut);
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

  let target;
  if (shortcut.type === "app") {
    target = document.createElement("button");
    target.className = "shortcut-target shortcut-app-select";
    target.type = "button";
    target.textContent = shortcut.appPath ? shortcut.name || t("app") : t("selectApp");
    target.title = shortcut.appPath || t("noApp");
    target.addEventListener("click", () => chooseAppShortcut(index));
  } else {
    target = document.createElement("input");
    target.className = "shortcut-target";
    target.type = "text";
    target.inputMode = "url";
    target.placeholder = "https://example.com";
    target.value = shortcut.url || "";
    bindTextInput(target, (value) => {
      shortcut.url = value;
    });
  }

  const tools = document.createElement("div");
  tools.className = "shortcut-tools";

  const imagePreview = document.createElement("span");
  imagePreview.className = "shortcut-image-preview";
  const imagePath = shortcut.imagePath || "";
  imagePreview.classList.toggle("has-image", !!imagePath);
  imagePreview.classList.toggle("is-empty", !imagePath);
  imagePreview.classList.toggle("is-web-empty", !imagePath && shortcut.type !== "app");
  if (imagePath) {
    const image = document.createElement("img");
    image.alt = "";
    image.src = fileUrlFromPath(imagePath);
    image.addEventListener("error", () => {
      imagePreview.classList.remove("has-image");
      imagePreview.classList.add("is-empty");
      imagePreview.classList.toggle("is-web-empty", shortcut.type !== "app");
      imagePreview.replaceChildren(shortcutImagePlaceholder(shortcut));
    });
    imagePreview.appendChild(image);
  } else {
    imagePreview.appendChild(shortcutImagePlaceholder(shortcut));
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
  pick.addEventListener("click", () => {
    chooseAppShortcut(index);
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
  return row;
}

function renderShortcutSection(kind, entries) {
  const section = document.createElement("section");
  section.className = `shortcut-section shortcut-section--${kind}`;

  const heading = document.createElement("div");
  heading.className = "shortcut-section-head";
  const title = document.createElement("strong");
  title.textContent = t(kind === "app" ? "appShortcuts" : "webShortcuts");
  const count = document.createElement("span");
  count.textContent = String(entries.length);
  heading.append(title, count);
  section.appendChild(heading);

  const rows = document.createElement("div");
  rows.className = "shortcut-section-list";
  if (entries.length) {
    for (const { shortcut, index } of entries) {
      rows.appendChild(renderShortcutRow(shortcut, index));
    }
  } else {
    const empty = document.createElement("p");
    empty.className = "shortcut-empty";
    empty.textContent = t("none");
    rows.appendChild(empty);
  }
  section.appendChild(rows);
  return section;
}

function renderShortcuts() {
  shortcutList.innerHTML = "";
  settings.shortcutDisplayMode = ["both", "image", "name"].includes(settings.shortcutDisplayMode)
    ? settings.shortcutDisplayMode
    : "both";
  shortcutDisplayMode.value = settings.shortcutDisplayMode;
  const entries = settings.shortcuts.map((shortcut, index) => {
    shortcut.type = shortcut.type === "app" ? "app" : "web";
    return { shortcut, index };
  });
  shortcutList.append(
    renderShortcutSection("web", entries.filter((entry) => entry.shortcut.type !== "app")),
    renderShortcutSection("app", entries.filter((entry) => entry.shortcut.type === "app")),
  );
  addShortcut.disabled = !isPro() && shortcutCount("web") >= FREE_WEB_SHORTCUT_LIMIT;
  addAppShortcut.disabled = !isPro() && shortcutCount("app") >= FREE_APP_SHORTCUT_LIMIT;
  addShortcut.title = addShortcut.disabled ? freeLimitText() : t("addWebShortcut");
  addAppShortcut.title = addAppShortcut.disabled ? freeLimitText() : t("addAppShortcut");
}

function renderLicensePanel() {
  const pro = isPro();
  licenseBadge.textContent = pro ? t("licensePro") : t("licenseFree");
  licenseBadge.dataset.tone = pro ? "pro" : "free";
  licenseHelp.textContent = freeLimitText();
  licenseKey.value = pro ? "" : licenseKey.value;
  activateLicense.disabled = pro;
  licenseStatus.textContent = settings.license?.message || "";
}

function renderUpdatePanel() {
  const update = settings.update || {};
  updateBadge.textContent = update.checking
    ? t("updateChecking")
    : update.available
      ? t("updateAvailable")
      : update.checkedAt
        ? t("updateCurrent")
        : t("updateReady");
  updateBadge.dataset.tone = update.available ? "update" : "ready";
  updateStatus.textContent = update.checking
    ? t("updateChecking")
    : update.available
      ? t("updateStatusAvailable").replace("{version}", update.latestVersion || "")
      : update.checkedAt
        ? (update.message || t("updateStatusCurrent"))
        : t("updateStatusReady");
  openUpdate.disabled = !update.available && !update.downloadUrl && !update.pageUrl;
}

function render() {
  settings.language = ["en", "ko"].includes(settings.language) ? settings.language : "en";
  renderLanguage();
  enabled.checked = settings.enabled !== false;
  ghostMode.checked = settings.ghostMode !== false;
  const nextGhostDelay = Math.round(Number(settings.ghostDelaySeconds || 3));
  ghostDelaySeconds.value = String(nextGhostDelay);
  ghostDelayValue.textContent = `${nextGhostDelay}s`;
  ghostTriggerMouse.checked = settings.ghostTriggerMouse !== false;
  ghostTriggerKeyboard.checked = settings.ghostTriggerKeyboard !== false;
  ghostTriggerWheel.checked = settings.ghostTriggerWheel !== false;
  showTrayIcon.checked = settings.showTrayIcon !== false;
  const nextFps = Math.round(Number(settings.fps || 16));
  fps.value = String(nextFps);
  fpsValue.textContent = String(nextFps);
  performanceMode.value = ["saver", "balanced", "smooth"].includes(settings.performanceMode)
    ? settings.performanceMode
    : "saver";
  renderSlots();
  renderCustomEditor();
  renderShortcuts();
  renderLicensePanel();
  renderUpdatePanel();
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

ghostMode.addEventListener("change", () => {
  settings.ghostMode = ghostMode.checked;
  scheduleSave(true);
});

ghostDelaySeconds.addEventListener("input", () => {
  const value = Math.round(Number(ghostDelaySeconds.value));
  ghostDelayValue.textContent = `${value}s`;
  settings.ghostDelaySeconds = value;
  scheduleSave();
});

ghostTriggerMouse.addEventListener("change", () => {
  settings.ghostTriggerMouse = ghostTriggerMouse.checked;
  scheduleSave(true);
});

ghostTriggerKeyboard.addEventListener("change", () => {
  settings.ghostTriggerKeyboard = ghostTriggerKeyboard.checked;
  scheduleSave(true);
});

ghostTriggerWheel.addEventListener("change", () => {
  settings.ghostTriggerWheel = ghostTriggerWheel.checked;
  scheduleSave(true);
});

showTrayIcon.addEventListener("change", () => {
  settings.showTrayIcon = showTrayIcon.checked;
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

buyPro.addEventListener("click", () => {
  api.openLicenseCheckout();
});

activateLicense.addEventListener("click", async () => {
  const key = licenseKey.value.trim();
  if (!key) return;
  activateLicense.disabled = true;
  licenseStatus.textContent = t("licenseActivating");
  try {
    const result = await api.activateLicense(key);
    if (!result?.ok) throw new Error(result?.error || "Activation failed");
    settings = await api.getSettings();
    licenseStatus.textContent = t("licenseActivated");
    render();
  } catch (error) {
    licenseStatus.textContent = error?.message || "Activation failed";
  } finally {
    activateLicense.disabled = isPro();
  }
});

checkUpdates.addEventListener("click", async () => {
  checkUpdates.disabled = true;
  updateStatus.textContent = t("updateChecking");
  try {
    settings.update = await api.checkForUpdates();
    renderUpdatePanel();
  } catch (error) {
    updateStatus.textContent = error?.message || "Update check failed.";
  } finally {
    checkUpdates.disabled = false;
  }
});

openUpdate.addEventListener("click", () => {
  api.openUpdate();
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

window.addEventListener("focusout", flushPendingRemoteSoon, true);
window.addEventListener("change", flushPendingRemoteSoon, true);

shortcutDisplayMode.addEventListener("change", () => {
  settings.shortcutDisplayMode = shortcutDisplayMode.value;
  scheduleSave(true);
});

addShortcut.addEventListener("click", () => {
  if (!isPro() && shortcutCount("web") >= FREE_WEB_SHORTCUT_LIMIT) return;
  settings.shortcuts.push({ type: "web", name: t("newLink"), url: "https://", imagePath: "" });
  renderShortcuts();
  scheduleSave();
});

addAppShortcut.addEventListener("click", async () => {
  if (!isPro() && shortcutCount("app") >= FREE_APP_SHORTCUT_LIMIT) return;
  const index = settings.shortcuts.length;
  settings.shortcuts.push({ type: "app", name: t("app"), appPath: "", imagePath: "" });
  renderShortcuts();
  const picked = await chooseAppShortcut(index);
  if (!picked) {
    const current = settings.shortcuts[index];
    if (current?.type === "app" && !current.appPath) {
      settings.shortcuts.splice(index, 1);
      renderShortcuts();
      scheduleSave(true);
    }
  }
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
  if (!isPro()) return;
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
  if (!isPro()) return;
  const result = await api.pickSpriteImage();
  if (!result?.ok) return;
  selectedCustom().imagePath = result.imagePath;
  renderCustomEditor();
  renderSlots();
  scheduleSave(true);
});

customImageClear.addEventListener("click", () => {
  if (!isPro()) return;
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
  schedulePendingRemoteFlush();
});

window.addEventListener("pointercancel", () => {
  drawingPixels = false;
  activePixelPointerId = null;
  lastPaintedIndex = -1;
  schedulePendingRemoteFlush();
});

window.addEventListener("focusout", () => {
  schedulePendingRemoteFlush();
});

window.addEventListener("keyup", () => {
  schedulePendingRemoteFlush();
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
