const { app, BrowserWindow, Menu, ipcMain, screen, shell, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

if (process.platform === "linux") {
  // X11 gives Electron reliable transparent-window click-through on Ubuntu 22.04.
  app.commandLine.appendSwitch("ozone-platform", "x11");
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

const MAX_SLOTS = 8;
const CUSTOM_GRID_SIZE = 24;
const CUSTOM_CHARACTER_LIMIT = 24;
const CHARACTER_IDS = [
  "ufo",
  "car",
  "slime",
  "comet",
  "star",
  "rocket",
  "saturn",
  "gem",
  "donut",
  "skull",
  "eyeball",
  "energyball",
  "bug",
  "tank",
];
const CUSTOM_CHARACTER_IDS = Array.from({ length: CUSTOM_CHARACTER_LIMIT }, (_item, index) => `custom-${index + 1}`);

const DEFAULT_BEHAVIOR = Object.freeze({
  movementStyle: "free",
  orientationMode: "smart",
  mouseMode: "avoid",
  areaPreset: "all",
  area: { left: 0.03, top: 0.06, right: 0.97, bottom: 0.92 },
  speedMultiplier: 1,
  scale: 1,
  effectMode: "normal",
  effectIntensity: 1,
});

const DEFAULT_CUSTOM_PIXELS = Object.freeze(Array(CUSTOM_GRID_SIZE * CUSTOM_GRID_SIZE).fill(""));

function defaultCustomCharacter(index) {
  return {
    id: CUSTOM_CHARACTER_IDS[index],
    name: `Custom ${index + 1}`,
    imagePath: "",
    concept: "",
    pixels: [...DEFAULT_CUSTOM_PIXELS],
    effectAnchor: { x: 0.5, y: 0.56 },
    effectDirection: "down",
  };
}

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  showGround: false,
  characterSetVersion: 3,
  language: "en",
  performanceMode: "saver",
  shortcutDisplayMode: "both",
  fps: 16,
  customCharacters: [defaultCustomCharacter(0)],
  slots: [
    { character: "ufo", enabled: true, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "normal", speedMultiplier: 1.0 } },
    { character: "car", enabled: true, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "normal", speedMultiplier: 1.0 } },
    { character: "slime", enabled: true, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "pixel", speedMultiplier: 1.0 } },
    { character: "comet", enabled: true, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "rainbow", effectIntensity: 1.0, speedMultiplier: 1.0 } },
    { character: "star", enabled: true, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "spark", speedMultiplier: 1.0 } },
    { character: "rocket", enabled: false, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "rainbow", effectIntensity: 1.0, speedMultiplier: 1.0 } },
    { character: "saturn", enabled: false, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "spark", speedMultiplier: 1.0 } },
    { character: "gem", enabled: false, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "normal", speedMultiplier: 1.0 } },
  ],
  shortcuts: [
    { type: "web", name: "ChatGPT", url: "https://chat.openai.com" },
    { type: "web", name: "GitHub", url: "https://github.com" },
  ],
});

let overlayWindow = null;
let settingsWindow = null;
let settings = clone(DEFAULT_SETTINGS);
let cursorTimer = null;
let ignoringMouse = true;
let pendingAreaPick = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getWindowIconPath() {
  const iconPath = path.join(__dirname, "..", "build", "icon.png");
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function appRoots() {
  const home = app.getPath("home");
  if (process.platform === "win32") {
    return [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA,
      process.env.APPDATA,
      path.join(home, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs"),
    ].filter(Boolean);
  }
  if (process.platform === "linux") {
    return [
      "/usr/share/applications",
      "/usr/local/share/applications",
      "/usr/bin",
      "/usr/local/bin",
      "/opt",
      path.join(home, ".local", "share", "applications"),
      path.join(home, "bin"),
    ];
  }
  return ["/Applications", "/System/Applications", "/System/Applications/Utilities", path.join(home, "Applications")];
}

function isInsidePath(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function normalizeAppPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const resolved = path.resolve(raw);
  if (!appRoots().some((root) => resolved === root || isInsidePath(resolved, root))) return "";
  const ext = path.extname(resolved).toLowerCase();
  try {
    const stat = fs.statSync(resolved);
    if (process.platform === "darwin") {
      if (ext !== ".app" || !stat.isDirectory()) return "";
    } else if (process.platform === "win32") {
      if (![".exe", ".lnk"].includes(ext) || !stat.isFile()) return "";
    } else if (process.platform === "linux") {
      const isDesktopFile = ext === ".desktop" && stat.isFile();
      const isExecutableFile = stat.isFile() && (stat.mode & 0o111);
      if (!isDesktopFile && !isExecutableFile) return "";
    }
  } catch {
    return "";
  }
  return resolved;
}

function normalizeImagePath(value, options = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const resolved = path.resolve(raw);
  const ext = path.extname(resolved).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico"].includes(ext)) return "";
  try {
    if (!fs.statSync(resolved).isFile()) return "";
  } catch {
    if (options.allowDraft) return raw.slice(0, 500);
    return "";
  }
  return resolved;
}

function appNameFromPath(appPath) {
  const ext = path.extname(appPath || "");
  const base = path.basename(appPath || "", ext).trim();
  return base || "App";
}

function appPickerOptions() {
  if (process.platform === "win32") {
    return {
      title: "Choose an app",
      defaultPath: process.env.ProgramFiles || app.getPath("home"),
      properties: ["openFile"],
      filters: [{ name: "Applications", extensions: ["exe", "lnk"] }],
      error: "Choose an .exe or .lnk inside Program Files, AppData, or the Start Menu.",
    };
  }
  if (process.platform === "linux") {
    return {
      title: "Choose an app",
      defaultPath: "/usr/share/applications",
      properties: ["openFile"],
      filters: [{ name: "Applications", extensions: ["desktop"] }],
      error: "Choose a .desktop file or executable inside /usr, /opt, ~/.local/share/applications, or ~/bin.",
    };
  }
  return {
    title: "Choose a Mac app",
    defaultPath: "/Applications",
    properties: ["openFile", "openDirectory"],
    filters: [{ name: "Applications", extensions: ["app"] }],
    error: "Choose a .app inside /Applications, /System/Applications, or ~/Applications.",
  };
}

function normalizeShortcut(item, options = {}) {
  const source = item && typeof item === "object" ? item : { url: item };
  const type = source.type === "app" || source.appPath ? "app" : "web";
  const fallbackName = type === "app" ? appNameFromPath(source.appPath) : "Link";
  const name = String(source.name || fallbackName).trim().slice(0, 32);
  const imagePath = normalizeImagePath(source.imagePath, options);

  if (type === "app") {
    const rawAppPath = String(source.appPath || "").trim().slice(0, 500);
    const appPath = normalizeAppPath(rawAppPath);
    if (appPath) return { type: "app", name: name || appNameFromPath(appPath), appPath, imagePath };
    if (options.allowDraft && (name || rawAppPath)) {
      return { type: "app", name: name || "App", appPath: rawAppPath, imagePath };
    }
    return null;
  }

  const rawUrl = String(source.url || "").trim().slice(0, 500);
  const url = normalizeUrl(rawUrl);
  if (url) return { type: "web", name: name || "Link", url, imagePath };
  if (options.allowDraft && (name || rawUrl)) return { type: "web", name: name || "Link", url: rawUrl, imagePath };
  return null;
}

function normalizePixelColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "";
}

function normalizeCustomCharacter(item, index) {
  const fallback = defaultCustomCharacter(index);
  const source = item && typeof item === "object" ? item : {};
  const pixels = Array.isArray(source.pixels) ? source.pixels : fallback.pixels;
  const effectAnchor = source.effectAnchor && typeof source.effectAnchor === "object" ? source.effectAnchor : fallback.effectAnchor;
  return {
    id: fallback.id,
    name: String(source.name || fallback.name).trim().slice(0, 32) || fallback.name,
    imagePath: normalizeImagePath(source.imagePath),
    concept: String(source.concept || "").trim().slice(0, 420),
    pixels: Array.from({ length: CUSTOM_GRID_SIZE * CUSTOM_GRID_SIZE }, (_value, pixelIndex) =>
      normalizePixelColor(pixels[pixelIndex]),
    ),
    effectAnchor: {
      x: clamp(effectAnchor.x, 0, 1, fallback.effectAnchor.x),
      y: clamp(effectAnchor.y, 0, 1, fallback.effectAnchor.y),
    },
    effectDirection: ["left", "right", "up", "down"].includes(source.effectDirection)
      ? source.effectDirection
      : fallback.effectDirection,
  };
}

function normalizeBehavior(source) {
  const merged = { ...clone(DEFAULT_BEHAVIOR), ...(source || {}) };
  merged.movementStyle = ["free", "stay"].includes(merged.movementStyle) ? merged.movementStyle : "free";
  merged.orientationMode = ["smart", "turn", "fixed"].includes(merged.orientationMode)
    ? merged.orientationMode
    : DEFAULT_BEHAVIOR.orientationMode;
  merged.mouseMode = ["avoid", "follow", "ignore"].includes(merged.mouseMode) ? merged.mouseMode : "avoid";
  merged.areaPreset = ["all", "top", "middle", "bottom", "custom"].includes(merged.areaPreset)
    ? merged.areaPreset
    : "all";
  merged.effectMode = ["off", "normal", "rainbow", "spark", "bubble", "pixel"].includes(merged.effectMode)
    ? merged.effectMode
    : DEFAULT_BEHAVIOR.effectMode;
  merged.speedMultiplier = clamp(merged.speedMultiplier, 0.2, 3, 1);
  merged.scale = clamp(merged.scale, 0.5, 2.5, 1);
  merged.effectIntensity = clamp(merged.effectIntensity, 0.3, 2, 1);
  const area = merged.area && typeof merged.area === "object" ? merged.area : DEFAULT_BEHAVIOR.area;
  merged.area = {
    left: clamp(area.left, 0, 0.95, DEFAULT_BEHAVIOR.area.left),
    top: clamp(area.top, 0, 0.95, DEFAULT_BEHAVIOR.area.top),
    right: clamp(area.right, 0.05, 1, DEFAULT_BEHAVIOR.area.right),
    bottom: clamp(area.bottom, 0.05, 1, DEFAULT_BEHAVIOR.area.bottom),
  };
  if (merged.area.right <= merged.area.left + 0.05) merged.area.right = Math.min(1, merged.area.left + 0.2);
  if (merged.area.bottom <= merged.area.top + 0.05) merged.area.bottom = Math.min(1, merged.area.top + 0.2);
  return merged;
}

function normalizeSettings(source) {
  const src = source && typeof source === "object" ? source : {};
  const next = {
    ...clone(DEFAULT_SETTINGS),
    ...src,
    customCharacters: Array.isArray(src.customCharacters)
      ? src.customCharacters.slice(0, CUSTOM_CHARACTER_LIMIT)
      : clone(DEFAULT_SETTINGS.customCharacters),
    slots: Array.isArray(src.slots) ? src.slots.slice(0, MAX_SLOTS) : clone(DEFAULT_SETTINGS.slots),
    shortcuts: Array.isArray(src.shortcuts) ? src.shortcuts : clone(DEFAULT_SETTINGS.shortcuts),
  };
  delete next.aquariumVersion;
  delete next.aquariumScene;
  delete next.aquariumDensity;
  delete next.ai;

  const needsCharacterSetMigration =
    src.characterSetVersion !== DEFAULT_SETTINGS.characterSetVersion && src.aquariumVersion !== undefined;
  const validCharacterIds = [...CHARACTER_IDS, ...CUSTOM_CHARACTER_IDS];
  const hasRemovedCharacter = next.slots.some((slot) => slot?.character && !validCharacterIds.includes(slot.character));
  if (needsCharacterSetMigration || hasRemovedCharacter) {
    next.slots = clone(DEFAULT_SETTINGS.slots);
    next.fps = DEFAULT_SETTINGS.fps;
  }

  while (next.slots.length < MAX_SLOTS) {
    next.slots.push(clone(DEFAULT_SETTINGS.slots[next.slots.length] || DEFAULT_SETTINGS.slots[0]));
  }

  next.enabled = next.enabled !== false;
  next.showGround = false;
  next.characterSetVersion = DEFAULT_SETTINGS.characterSetVersion;
  next.language = ["en", "ko"].includes(src.language) ? src.language : DEFAULT_SETTINGS.language;
  if (!next.customCharacters.length) next.customCharacters = clone(DEFAULT_SETTINGS.customCharacters);
  next.customCharacters = next.customCharacters
    .slice(0, CUSTOM_CHARACTER_LIMIT)
    .map((item, index) => normalizeCustomCharacter(item, index));
  next.performanceMode = ["saver", "balanced", "smooth"].includes(next.performanceMode)
    ? next.performanceMode
    : DEFAULT_SETTINGS.performanceMode;
  next.shortcutDisplayMode = ["both", "image", "name"].includes(src.shortcutDisplayMode)
    ? src.shortcutDisplayMode
    : ["both", "image", "name"].includes(src.shortcuts?.[0]?.displayMode)
      ? src.shortcuts[0].displayMode
      : DEFAULT_SETTINGS.shortcutDisplayMode;
  next.fps = Math.round(clamp(next.fps, 10, 60, DEFAULT_SETTINGS.fps));
  next.slots = next.slots.slice(0, MAX_SLOTS).map((slot, index) => {
    const fallback = DEFAULT_SETTINGS.slots[index] || DEFAULT_SETTINGS.slots[0];
    const character = [...CHARACTER_IDS, ...CUSTOM_CHARACTER_IDS].includes(slot?.character) ? slot.character : fallback.character;
    return {
      character,
      enabled: slot?.enabled !== false,
      behavior: normalizeBehavior(slot?.behavior || fallback.behavior),
    };
  });
  next.shortcuts = next.shortcuts
    .map((item) => normalizeShortcut(item, { allowDraft: true }))
    .filter(Boolean)
    .slice(0, 12);
  if (!next.shortcuts.length) next.shortcuts = clone(DEFAULT_SETTINGS.shortcuts);
  return next;
}

function loadSettings() {
  try {
    const file = fs.readFileSync(getSettingsPath(), "utf8");
    settings = normalizeSettings(JSON.parse(file));
  } catch {
    settings = clone(DEFAULT_SETTINGS);
  }
  saveSettings();
}

function saveSettings() {
  const filePath = getSettingsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
}

function broadcastSettings() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("settings:changed", settings);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("settings:changed", settings);
  }
}

function updateOverlayBounds() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  overlayWindow.setBounds(display.bounds);
}

function applyOverlayMousePassthrough(ignore, options = {}) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (typeof overlayWindow.setFocusable === "function" && !options.preserveFocus) {
    overlayWindow.setFocusable(!ignore);
  }
  if (process.platform === "linux") {
    overlayWindow.setIgnoreMouseEvents(ignore);
    return;
  }
  overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
}

function createOverlayWindow() {
  const display = screen.getPrimaryDisplay();
  overlayWindow = new BrowserWindow({
    ...display.bounds,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    title: "BusyPet Overlay",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  applyOverlayMousePassthrough(true);
  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));

  overlayWindow.on("closed", () => {
    overlayWindow = null;
    stopCursorWatch();
  });
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 390,
    height: 720,
    minWidth: 360,
    minHeight: 560,
    title: "BusyPet Settings",
    icon: getWindowIconPath(),
    backgroundColor: "#f7f4ee",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, "settings.html"));
  settingsWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function showSettingsWindow() {
  if (!settingsWindow || settingsWindow.isDestroyed()) createSettingsWindow();
  let revealed = false;
  const reveal = () => {
    if (revealed || !settingsWindow || settingsWindow.isDestroyed()) return;
    revealed = true;
    settingsWindow.show();
    settingsWindow.focus();
    if (app.dock) app.dock.show();
  };
  if (settingsWindow.webContents.isLoading()) {
    settingsWindow.once("ready-to-show", reveal);
    settingsWindow.webContents.once("did-finish-load", () => {
      setTimeout(reveal, 50);
    });
    setTimeout(reveal, 800);
  } else {
    reveal();
  }
}

function setOverlayClickThrough(ignore, options = {}) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const next = !!ignore;
  if (next === ignoringMouse && !options.preserveFocus) return;
  ignoringMouse = next;
  applyOverlayMousePassthrough(next, options);
  if (!next) {
    overlayWindow.showInactive();
    overlayWindow.focus();
  }
}

function startCursorWatch() {
  stopCursorWatch();
  cursorTimer = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    const bounds = overlayWindow.getBounds();
    const point = screen.getCursorScreenPoint();
    overlayWindow.webContents.send("cursor:point", {
      x: point.x - bounds.x,
      y: point.y - bounds.y,
    });
  }, 72);
}

function stopCursorWatch() {
  if (cursorTimer) clearInterval(cursorTimer);
  cursorTimer = null;
}

function buildMenu() {
  const template = [
    {
      label: "BusyPet",
      submenu: [
        { label: "Open Settings", accelerator: "CommandOrControl+,", click: showSettingsWindow },
        {
          label: "Toggle Companions",
          accelerator: "CommandOrControl+Shift+B",
          click: () => {
            settings.enabled = !settings.enabled;
            saveSettings();
            broadcastSettings();
          },
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: "CommandOrControl+Q",
          click: () => {
            app.isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("settings:get", () => settings);

ipcMain.handle("settings:update", (_event, patch) => {
  settings = normalizeSettings({ ...settings, ...(patch || {}) });
  saveSettings();
  broadcastSettings();
  return settings;
});

ipcMain.handle("settings:reset", () => {
  settings = clone(DEFAULT_SETTINGS);
  saveSettings();
  broadcastSettings();
  return settings;
});

ipcMain.handle("shortcut:open", async (_event, shortcut) => {
  const safeShortcut = normalizeShortcut(shortcut);
  if (!safeShortcut) return { ok: false, error: "Invalid shortcut" };
  if (safeShortcut.type === "app") {
    const error = await shell.openPath(safeShortcut.appPath);
    return error ? { ok: false, error } : { ok: true };
  }
  await shell.openExternal(safeShortcut.url);
  return { ok: true };
});

ipcMain.handle("app:pick", async () => {
  const owner = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : undefined;
  const picker = appPickerOptions();
  const result = await dialog.showOpenDialog(owner, picker);
  if (result.canceled || !result.filePaths?.length) return { ok: false, cancelled: true };
  const appPath = normalizeAppPath(result.filePaths[0]);
  if (!appPath) {
    return {
      ok: false,
      error: picker.error,
    };
  }
  return { ok: true, name: appNameFromPath(appPath), appPath };
});

ipcMain.handle("image:pick", async () => {
  const owner = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : undefined;
  const result = await dialog.showOpenDialog(owner, {
    title: "Choose a shortcut image",
    defaultPath: app.getPath("pictures"),
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "ico"] }],
  });
  if (result.canceled || !result.filePaths?.length) return { ok: false, cancelled: true };
  const imagePath = normalizeImagePath(result.filePaths[0]);
  if (!imagePath) return { ok: false, error: "Choose a PNG, JPG, WEBP, GIF, or ICO image file." };
  return { ok: true, imagePath };
});

ipcMain.handle("sprite-image:pick", async () => {
  const owner = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : undefined;
  const result = await dialog.showOpenDialog(owner, {
    title: "Choose a custom character image",
    defaultPath: app.getPath("pictures"),
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
  });
  if (result.canceled || !result.filePaths?.length) return { ok: false, cancelled: true };
  const imagePath = normalizeImagePath(result.filePaths[0]);
  if (!imagePath) return { ok: false, error: "Choose a PNG, JPG, WEBP, or GIF image file." };
  return { ok: true, imagePath };
});

ipcMain.handle("area:pick", (_event, slotIndex) => {
  const index = Number(slotIndex);
  if (!overlayWindow || overlayWindow.isDestroyed()) return { ok: false, error: "Overlay is not ready" };
  if (!Number.isInteger(index) || index < 0 || index >= MAX_SLOTS) {
    return { ok: false, error: "Invalid character slot" };
  }
  if (pendingAreaPick) {
    pendingAreaPick.resolve({ ok: false, cancelled: true });
    pendingAreaPick = null;
  }
  return new Promise((resolve) => {
    pendingAreaPick = { slotIndex: index, resolve };
    setOverlayClickThrough(false);
    overlayWindow.webContents.send("area:pick-start", { slotIndex: index });
  });
});

ipcMain.handle("area:pick-complete", (_event, result) => {
  if (!pendingAreaPick) {
    setOverlayClickThrough(true);
    return { ok: false, error: "No area picker is active" };
  }

  const { slotIndex, resolve } = pendingAreaPick;
  pendingAreaPick = null;
  setOverlayClickThrough(true);

  if (!result?.ok || !result.area) {
    resolve({ ok: false, cancelled: true });
    return { ok: true };
  }

  const normalized = normalizeBehavior({
    ...settings.slots[slotIndex].behavior,
    areaPreset: "custom",
    area: result.area,
  });
  settings.slots[slotIndex].behavior = normalized;
  saveSettings();
  broadcastSettings();
  resolve({ ok: true, slotIndex, settings });
  return { ok: true };
});

ipcMain.on("overlay:click-through", (_event, payload) => {
  if (payload && typeof payload === "object") {
    setOverlayClickThrough(payload.ignore, { preserveFocus: payload.preserveFocus === true });
    return;
  }
  setOverlayClickThrough(payload);
});

ipcMain.on("settings:show", showSettingsWindow);

ipcMain.on("settings:hide", () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.hide();
});

ipcMain.on("app:quit", () => {
  app.isQuitting = true;
  app.quit();
});

if (gotSingleInstanceLock) {
  app.on("second-instance", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      updateOverlayBounds();
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
    }
  });

  app.whenReady().then(() => {
    loadSettings();
    buildMenu();
    createOverlayWindow();
    createSettingsWindow();
    if (!settings.enabled || !settings.slots.some((slot) => slot.enabled !== false)) {
      showSettingsWindow();
    }
    startCursorWatch();
    screen.on("display-metrics-changed", updateOverlayBounds);
    screen.on("display-added", updateOverlayBounds);
    screen.on("display-removed", updateOverlayBounds);
  });

  app.on("activate", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      updateOverlayBounds();
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
    }
  });

  app.on("before-quit", () => {
    app.isQuitting = true;
  });

  app.on("window-all-closed", () => {
    // Keep the menu shortcut available until the user explicitly quits.
  });
}
