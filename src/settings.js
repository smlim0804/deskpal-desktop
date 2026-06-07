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
const deviceIdLabel = document.getElementById("deviceIdLabel");
const deviceId = document.getElementById("deviceId");
const copyDeviceId = document.getElementById("copyDeviceId");
const updateBadge = document.getElementById("updateBadge");
const updateStatus = document.getElementById("updateStatus");
const checkUpdates = document.getElementById("checkUpdates");
const openUpdate = document.getElementById("openUpdate");
const installUpdate = document.getElementById("installUpdate");
const updateProgress = document.getElementById("updateProgress");
const updateProgressBar = document.getElementById("updateProgressBar");
const shortcutDisplayMode = document.getElementById("shortcutDisplayMode");
const languageButton = document.getElementById("languageButton");
const languagePopover = document.getElementById("languagePopover");
const languageSelect = document.getElementById("languageSelect");
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
    ghostMouse: "Mouse / wheel",
    ghostKeyboard: "Keyboard",
    ghostHint: "When the inputs enabled above are detected, the companions quietly disappear, then return after the delay.",
    proFeatureToast: "Pro feature — opening checkout",
    proFeatureTooltip: "Pro-only feature",
    showTrayIcon: "Show tray icon",
    effectQuality: "Effect quality",
    licenseTitle: "DeskPal",
    licenseFree: "Free",
    licensePro: "Pro",
    licenseHelpFree: "Everything's unlocked — DeskPal is completely free. If you enjoy it, a little support helps a lot ♥",
    licenseHelpPro: "Everything's unlocked — DeskPal is completely free.",
    promoTitle: "DeskPal is free",
    promoDesc: "Every character, shortcut, custom sprite, and effect — all free.",
    licensePlaceholder: "LICENSE-KEY",
    activateLicense: "Activate",
    buyPro: "Support ♥",
    deviceId: "Device ID",
    copyDeviceId: "Copy",
    deviceIdCopied: "Device ID copied.",
    licenseActivating: "Activating...",
    licenseActivated: "Premium activated.",
    updatesTitle: "Updates",
    updateReady: "Ready",
    updateAvailable: "Update",
    updateDownloading: "Downloading",
    updateCurrent: "Up to date",
    updateChecking: "Checking...",
    updateStatusReady: "Check for DeskPal updates.",
    updateStatusCurrent: "DeskPal is up to date.",
    updateStatusAvailable: "New version {version} is available.",
    updateStatusDownloading: "Downloading update file...",
    updateStatusDownloaded: "Downloaded to Downloads.",
    updateStatusReadyInstall: "Update downloaded — applying and restarting DeskPal.",
    updateInstall: "Install",
    updateInstalling: "Applying update — DeskPal will restart...",
    checkUpdates: "Check",
    openUpdate: "Download",
    characters: "Characters",
    characterHint: "Per-character settings",
    pixelMaker: "Pixel Maker",
    customHint: "Custom sprite + effect point",
    effectDirection: "Effect direction",
    shortcuts: "Shortcuts",
    webShortcuts: "Web shortcuts",
    appShortcuts: "App shortcuts",
    shortcutHint: "Web & app launchers",
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
    ghostMouse: "마우스 / 휠",
    ghostKeyboard: "키보드",
    ghostHint: "위에서 켠 입력이 감지되면 캐릭터가 살짝 사라졌다가, 대기 시간이 지나면 다시 나타나요.",
    proFeatureToast: "Pro 기능 — 결제 페이지를 열게요",
    proFeatureTooltip: "프로에서만 제공되는 기능",
    showTrayIcon: "상태바에 표시",
    effectQuality: "이펙트 품질",
    licenseTitle: "DeskPal",
    licenseFree: "무료",
    licensePro: "Pro",
    licenseHelpFree: "모든 기능이 무료로 열려 있어요. 마음에 들면 개발자에게 후원 한 번 ♥",
    licenseHelpPro: "모든 기능이 무료로 열려 있어요.",
    promoTitle: "DeskPal은 무료예요",
    promoDesc: "캐릭터·바로가기·커스텀·이펙트까지 전부 무료로 써요.",
    licensePlaceholder: "라이선스 키",
    activateLicense: "활성화",
    buyPro: "후원하기 ♥",
    deviceId: "기기 ID",
    copyDeviceId: "복사",
    deviceIdCopied: "기기 ID를 복사했어.",
    licenseActivating: "활성화 중...",
    licenseActivated: "프리미엄 활성화 완료.",
    updatesTitle: "업데이트",
    updateReady: "대기",
    updateAvailable: "업데이트",
    updateDownloading: "다운로드 중",
    updateCurrent: "최신",
    updateChecking: "확인 중...",
    updateStatusReady: "DeskPal 업데이트를 확인할 수 있어.",
    updateStatusCurrent: "지금 최신 버전이야.",
    updateStatusAvailable: "새 버전 {version}이 있어.",
    updateStatusDownloading: "업데이트 파일을 다운로드하는 중...",
    updateStatusDownloaded: "다운로드 폴더에 저장 완료.",
    updateStatusReadyInstall: "업데이트를 받았어 — 적용하고 DeskPal을 다시 시작할게.",
    updateInstall: "설치",
    updateInstalling: "업데이트 적용 중 — DeskPal을 다시 시작할게...",
    checkUpdates: "확인",
    openUpdate: "다운로드",
    characters: "캐릭터",
    characterHint: "캐릭터별 설정",
    pixelMaker: "픽셀 메이커",
    customHint: "커스텀 캐릭터 + 이펙트점",
    effectDirection: "이펙트 방향",
    shortcuts: "바로가기",
    webShortcuts: "웹 바로가기",
    appShortcuts: "앱 바로가기",
    shortcutHint: "웹 · 앱 바로가기",
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

// ===== Clean line-icon set (Lucide-style), replacing the old unicode glyphs =====
const UI_ICONS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  eraser: '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a2 2 0 0 1 2.8 0l5.5 5.5a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  play: '<polygon points="6 4 19 12 6 20 6 4"/>',
  star: '<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  infinity: '<path d="M12 12c-2-2.7-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.3 6-4Zm0 0c2 2.7 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.3-6 4Z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 21v-5h5"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  rotateCcw: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  frame: '<line x1="22" x2="2" y1="6" y2="6"/><line x1="22" x2="2" y1="18" y2="18"/><line x1="6" x2="6" y1="2" y2="22"/><line x1="18" x2="18" y1="2" y2="22"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  ghost: '<path d="M12 2a8 8 0 0 0-8 8v11l3-2 2.5 2 2.5-2 2.5 2 2.5-2 3 2V10a8 8 0 0 0-8-8z"/><path d="M9 10h.01"/><path d="M15 10h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  keyboard: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 13h10"/>',
  panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/>',
  lock: '<rect width="14" height="10" x="5" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M12 3a14 14 0 0 0 0 18 14 14 0 0 0 0-18"/><path d="M3 12h18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  appWindow: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M7 6.5h.01M10 6.5h.01"/>',
};

const SYMBOL_ICON = {
  '+': 'plus', '−': 'minus', '×': 'x', '✓': 'check',
  '■': 'pencil', '◇': 'eraser', '↓': 'target', '▶': 'play',
  '★': 'star', '↗': 'arrowUpRight', '∞': 'infinity',
  '↻': 'refresh', '⬇': 'download', '↺': 'rotateCcw', '⏻': 'power',
  '▣': 'frame', '◆': 'smile', '◌': 'ghost', '◷': 'clock',
  '⌁': 'mouse', '⌨': 'keyboard', '▾': 'panel', '✦': 'sparkles',
};

function svgIcon(name, size = 15) {
  const path = UI_ICONS[name];
  if (!path) return '';
  return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Returns "<svg/> <label>" HTML. Callers assign via innerHTML.
function iconText(icon, key) {
  const name = SYMBOL_ICON[icon];
  const svg = name ? svgIcon(name) : '';
  return `${svg}<span class="btn-label">${escapeHtml(t(key))}</span>`;
}

// Convert the static unicode glyphs in the markup (tabs, section heads, inline
// labels, top-bar buttons) into the line icons above. Idempotent.
function renderUiIcons() {
  document.querySelectorAll('.tab-icon, .section-icon, .inline-icon').forEach((el) => {
    if (!el.dataset.sym) el.dataset.sym = (el.textContent || '').trim();
    const name = SYMBOL_ICON[el.dataset.sym];
    if (name) el.innerHTML = svgIcon(name, el.classList.contains('section-icon') ? 16 : 14);
  });
  const langBtn = document.getElementById('languageButton');
  if (langBtn) langBtn.innerHTML = svgIcon('globe', 17);
  const quitBtn = document.getElementById('quitApp');
  if (quitBtn) quitBtn.innerHTML = svgIcon('x', 16);
}

function isPro() {
  // DeskPal is fully free — every feature is unlocked for everyone.
  return true;
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

let proToastTimer = null;
function showProToast() {
  let toast = document.getElementById("proToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "proToast";
    toast.className = "pro-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = t("proFeatureToast");
  // restart the entrance animation
  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");
  if (proToastTimer) clearTimeout(proToastTimer);
  proToastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1700);
}

// Give a container the Pro-locked treatment: grayscale + a centered lock badge
// that shakes and shows a "Pro feature" toast on click, plus a 0.5s-delayed
// hover tooltip. Idempotent — safe to call on every re-render.
function applyLock(container, locked) {
  if (!container) return;
  container.classList.toggle("is-locked", !!locked);
  let badge = container.querySelector(":scope > .lock-badge");
  if (locked) {
    if (!badge) {
      badge = document.createElement("button");
      badge.type = "button";
      badge.className = "lock-badge";
      badge.innerHTML = svgIcon("lock", 16);
      badge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        badge.classList.remove("shake");
        void badge.offsetWidth;
        badge.classList.add("shake");
        showProToast();
        // Clicking a locked Pro feature takes you straight to the Gumroad checkout.
        if (!isPro()) {
          try {
            api.openLicenseCheckout("pro");
          } catch {
            /* checkout open failed; the toast still explains it's Pro-only */
          }
        }
      });
      container.appendChild(badge);
    }
    badge.dataset.tip = t("proFeatureTooltip");
    badge.setAttribute("aria-label", t("proFeatureTooltip"));
  } else if (badge) {
    badge.remove();
  }
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
  addCustom.innerHTML = svgIcon("plus", 16);
  addCustom.title = t("add");
  addCustom.setAttribute("aria-label", t("add"));
  customImagePick.innerHTML = iconText("+", "image");
  customImageClear.innerHTML = iconText("−", "clearImage");
  paintBrush.innerHTML = iconText("■", "draw");
  paintErase.innerHTML = iconText("◇", "erase");
  setEffectPoint.innerHTML = iconText("↓", "point");
  clearCustom.innerHTML = iconText("×", "clear");
  testEffect.innerHTML = iconText("▶", "test");
  activateLicense.innerHTML = iconText("★", "activateLicense");
  buyPro.innerHTML = iconText("↗", "buyPro");
  buyPro.title = t("buyPro");
  buyPro.setAttribute("aria-label", t("buyPro"));
  deviceIdLabel.textContent = t("deviceId");
  copyDeviceId.textContent = t("copyDeviceId");
  checkUpdates.innerHTML = iconText("↻", "checkUpdates");
  openUpdate.innerHTML = iconText("⬇", "openUpdate");
  if (installUpdate) installUpdate.innerHTML = iconText("✓", "updateInstall");
  resetSettings.innerHTML = iconText("↺", "reset");
  programExit.innerHTML = iconText("⏻", "exit");
  applyButton.innerHTML = iconText("✓", "apply");
  renderUiIcons();
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
  applyLock(document.querySelector(".custom-panel"), locked);
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
    applyLock(card, slotLocked);

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
    drawButton.innerHTML = iconText("▣", "drawAreaShort");
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
    effect.appendChild(effectSelect);
    if (!slotLocked) applyLock(effect, !pro);

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
    intensity.input.disabled = !pro;
    if (!slotLocked) applyLock(intensity.wrap, !pro);

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

function shortcutImagePlaceholder(shortcut) {
  const icon = document.createElement("span");
  icon.className = "shortcut-image-placeholder";
  icon.setAttribute("aria-hidden", "true");
  if (shortcut.type !== "app") {
    icon.classList.add("is-web-shortcut");
    icon.innerHTML = svgIcon("link", 14);
  }
  return icon;
}

function renderShortcutRow(shortcut, index) {
  shortcut.type = shortcut.type === "app" ? "app" : "web";
  delete shortcut.displayMode;
  const row = document.createElement("div");
  row.className = "shortcut-row";
  row.dataset.kind = shortcut.type;

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
  imagePick.innerHTML = iconText("+", "image");
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
  pick.innerHTML = iconText("+", "app");
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

  row.append(name, remove, target, tools);
  return row;
}

function renderShortcutSection(kind, entries) {
  const section = document.createElement("section");
  section.className = `shortcut-section shortcut-section--${kind}`;

  const heading = document.createElement("div");
  heading.className = "shortcut-section-head";
  const titleWrap = document.createElement("span");
  titleWrap.className = "shortcut-section-title";
  const kindIcon = document.createElement("span");
  kindIcon.className = "shortcut-kind-icon";
  kindIcon.setAttribute("aria-hidden", "true");
  kindIcon.innerHTML = svgIcon(kind === "app" ? "appWindow" : "link", 15);
  const title = document.createElement("strong");
  title.textContent = t(kind === "app" ? "appShortcuts" : "webShortcuts");
  titleWrap.append(kindIcon, title);
  const count = document.createElement("span");
  count.className = "shortcut-count";
  count.textContent = String(entries.length);
  heading.append(titleWrap, count);
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

  // Centered add button inside each section so Web / App stay clearly separate.
  const foot = document.createElement("div");
  foot.className = "shortcut-section-foot";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "shortcut-add-button mini-button";
  addBtn.innerHTML = iconText("+", kind === "app" ? "addAppShortcut" : "addWebShortcut");
  const limit = kind === "app" ? FREE_APP_SHORTCUT_LIMIT : FREE_WEB_SHORTCUT_LIMIT;
  const atLimit = !isPro() && shortcutCount(kind) >= limit;
  if (atLimit) {
    addBtn.disabled = true;
    applyLock(foot, true);
  } else {
    addBtn.title = t(kind === "app" ? "addAppShortcut" : "addWebShortcut");
    addBtn.addEventListener("click", kind === "app" ? handleAddApp : handleAddWeb);
  }
  foot.appendChild(addBtn);
  section.appendChild(foot);
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
}

function renderLicensePanel() {
  // DeskPal is fully free — no plans/keys. Show a friendly note + a support link.
  licenseBadge.textContent = t("licenseFree");
  licenseBadge.dataset.tone = "free";
  licenseHelp.textContent = t("licenseHelpFree");
  licenseStatus.textContent = "";
  // Hide the now-unused license key / activation / device rows.
  const licenseRow = document.querySelector(".license-row");
  if (licenseRow) licenseRow.style.display = "none";
  const deviceRow = document.querySelector(".device-id-row");
  if (deviceRow) deviceRow.style.display = "none";
}

function renderUpdatePanel() {
  const update = settings.update || {};
  const readyToInstall = update.readyToInstall && update.downloadedPath;
  updateBadge.textContent = update.checking
    ? t("updateChecking")
    : update.downloading
      ? t("updateDownloading")
      : readyToInstall
        ? t("updateInstall")
        : update.available
        ? t("updateAvailable")
        : update.checkedAt
          ? t("updateCurrent")
          : t("updateReady");
  updateBadge.dataset.tone = update.available || update.downloading || readyToInstall ? "update" : "ready";
  updateStatus.textContent = update.checking
    ? t("updateChecking")
    : update.downloading
      ? (update.message || t("updateStatusDownloading"))
      : readyToInstall
        ? (update.message || t("updateStatusReadyInstall"))
        : update.available
        ? t("updateStatusAvailable").replace("{version}", update.latestVersion || "")
        : update.checkedAt
          ? (update.message || t("updateStatusCurrent"))
          : t("updateStatusReady");

  // Progress bar while downloading.
  if (updateProgress && updateProgressBar) {
    const showProgress = update.downloading || (readyToInstall && update.progress >= 100);
    updateProgress.hidden = !showProgress;
    updateProgressBar.style.width = `${Math.max(0, Math.min(100, update.progress || 0))}%`;
  }

  // Download button only appears when a newer version actually exists (not every
  // session). Once downloaded it's replaced by the Install button. The separate
  // Check button is always available to look for updates.
  openUpdate.hidden = !!readyToInstall || !update.available;
  openUpdate.disabled = !!update.downloading;
  if (installUpdate) installUpdate.hidden = !readyToInstall;
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
  api.openLicenseCheckout("pro");
});

copyDeviceId.addEventListener("click", async () => {
  const value = deviceId.textContent.trim();
  if (!value || value === "loading" || value === "unavailable") return;
  await api.copyText(value);
  licenseStatus.textContent = t("deviceIdCopied");
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

openUpdate.addEventListener("click", async () => {
  openUpdate.disabled = true;
  updateStatus.textContent = t("updateStatusDownloading");
  try {
    const result = await api.openUpdate();
    if (result?.mode === "download") {
      updateStatus.textContent = t("updateStatusReadyInstall");
    }
  } catch (error) {
    updateStatus.textContent = error?.message || "Update download failed.";
  } finally {
    renderUpdatePanel();
  }
});

if (installUpdate) {
  installUpdate.addEventListener("click", async () => {
    installUpdate.disabled = true;
    updateStatus.textContent = t("updateInstalling");
    try {
      await api.installUpdate();
    } catch (error) {
      updateStatus.textContent = error?.message || "Install failed.";
    } finally {
      installUpdate.disabled = false;
      renderUpdatePanel();
    }
  });
}

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

function handleAddWeb() {
  if (!isPro() && shortcutCount("web") >= FREE_WEB_SHORTCUT_LIMIT) return;
  settings.shortcuts.push({ type: "web", name: t("newLink"), url: "https://", imagePath: "" });
  renderShortcuts();
  scheduleSave();
}

async function handleAddApp() {
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
}

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
  try {
    deviceId.textContent = await api.getMachineId();
  } catch {
    deviceId.textContent = "unavailable";
  }
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
