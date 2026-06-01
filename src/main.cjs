const { app, BrowserWindow, Menu, ipcMain, screen, shell, dialog, desktopCapturer, globalShortcut } = require("electron");
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
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
  ai: {
    enabled: false,
    provider: "codex",
    model: "",
    maxWords: 60,
    freedom: false,
    screenAwareness: false,
    autoSpeak: false,
  },
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
const quickChatAccelerators = ["CommandOrControl+Shift+Y", "CommandOrControl+Alt+Y"];
let quickChatShortcutRegistered = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeAiSettings(source) {
  const src = source && typeof source === "object" ? source : {};
  const fallback = DEFAULT_SETTINGS.ai;
  return {
    enabled: src.enabled === true,
    provider: ["codex", "claude", "ollama"].includes(src.provider) ? src.provider : fallback.provider,
    model: String(src.model || "").trim().slice(0, 80),
    maxWords: Math.round(clamp(src.maxWords, 12, 160, fallback.maxWords)),
    freedom: src.freedom === true,
    screenAwareness: src.screenAwareness === true,
    autoSpeak: src.autoSpeak === true,
  };
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getWindowIconPath() {
  const iconPath = path.join(__dirname, "..", "build", "icon.png");
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function getAiWorkspacePath() {
  const dir = path.join(app.getPath("userData"), "ai-workspace");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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
  next.ai = normalizeAiSettings(src.ai);
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

function toggleQuickChat() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  setOverlayClickThrough(false);
  overlayWindow.webContents.send("quick-chat:toggle");
}

function registerShortcuts() {
  if (quickChatShortcutRegistered) return;
  quickChatShortcutRegistered = quickChatAccelerators.some((accelerator) =>
    globalShortcut.register(accelerator, toggleQuickChat),
  );
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
        { label: "Quick Chat", accelerator: "CommandOrControl+Shift+Y", click: toggleQuickChat },
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

const AI_PROVIDER_LABELS = Object.freeze({
  codex: "Codex CLI",
  claude: "Claude Code CLI",
  ollama: "Ollama",
});

const CHARACTER_PERSONAS = Object.freeze({
  ufo: "curious tiny alien pilot who notices odd patterns on the screen",
  car: "energetic sports car friend who talks fast and loves momentum",
  slime: "soft, gentle slime who is warm and emotionally observant",
  comet: "sparkly comet who speaks like a dramatic little space poet",
  star: "calm lucky star who gives bright, concise encouragement",
  rocket: "bold rocket explorer who wants to launch into action",
  saturn: "wise sleepy planet with a slow cosmic sense of humor",
  gem: "polished gem who is precise, classy, and a little fancy",
  donut: "sweet donut friend who cheers people up with cozy jokes",
  skull: "cute spooky skull who sounds gothic but harmless",
  eyeball: "watchful eyeball who notices visual details",
  energyball: "hyper little energy orb with short excited reactions",
  bug: "top-down roach scout who is sneaky, practical, and surprisingly loyal",
  tank: "tiny tank guardian who is sturdy, tactical, and protective",
});

function commandNames(base) {
  if (process.platform !== "win32") return [base];
  return [`${base}.cmd`, `${base}.exe`, `${base}.bat`, base];
}

function uniquePaths(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function homePath() {
  try {
    return app.isReady() ? app.getPath("home") : os.homedir();
  } catch {
    return os.homedir();
  }
}

function nvmNodeBinDirectories(home) {
  const versionsDir = path.join(home, ".nvm", "versions", "node");
  try {
    return fs
      .readdirSync(versionsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(versionsDir, entry.name, "bin"));
  } catch {
    return [];
  }
}

function cliSearchDirectories() {
  const home = homePath();
  const directories = [
    ...String(process.env.PATH || "")
      .split(path.delimiter)
      .filter(Boolean),
    path.join(home, ".npm-global", "bin"),
    path.join(home, ".npm", "bin"),
    path.join(home, ".local", "bin"),
    path.join(home, ".bun", "bin"),
    path.join(home, ".cargo", "bin"),
    path.join(home, ".asdf", "shims"),
    path.join(home, "Library", "pnpm"),
    path.join(home, ".volta", "bin"),
    path.join(home, "bin"),
    ...nvmNodeBinDirectories(home),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ];

  if (process.platform === "win32") {
    directories.push(
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs") : "",
      process.env.APPDATA ? path.join(process.env.APPDATA, "npm") : "",
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Ollama") : "",
    );
  }

  return uniquePaths(directories);
}

function buildCliEnv() {
  const mergedPath = uniquePaths(cliSearchDirectories()).join(path.delimiter);
  const env = { ...process.env, PATH: mergedPath };
  if (process.platform === "win32") env.Path = mergedPath;
  return env;
}

function pathCandidates(provider) {
  const bases = {
    codex: commandNames("codex"),
    claude: commandNames("claude"),
    ollama: commandNames("ollama"),
  }[provider];
  if (!bases) return [];

  const candidates = [];
  for (const dir of cliSearchDirectories()) {
    for (const base of bases) candidates.push(path.join(dir, base));
  }
  for (const base of bases) candidates.push(base);
  return uniquePaths(candidates);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const child = execFile(
      command,
      args,
      {
        cwd: options.cwd || getAiWorkspacePath(),
        env: options.env || buildCliEnv(),
        timeout: 0,
        maxBuffer: options.maxBuffer || 1024 * 1024 * 4,
        windowsHide: true,
        shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command),
      },
      (error, stdout = "", stderr = "") => {
        finish({
          ok: !error && !timedOut,
          code: error?.code ?? 0,
          stdout: String(stdout || ""),
          stderr: String(stderr || ""),
          error: timedOut ? "Command timed out." : error ? String(error.message || error) : "",
        });
      },
    );
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        /* already finished */
      }
      setTimeout(() => {
        if (!settled) {
          try {
            child.kill("SIGKILL");
          } catch {
            /* already finished */
          }
          finish({ ok: false, code: null, stdout: "", stderr: "", error: "Command timed out." });
        }
      }, 1200);
    }, options.timeout || 12000);
    if (child.stdin) child.stdin.end(options.stdin === undefined ? "" : String(options.stdin));
  });
}

async function resolveCli(provider) {
  const candidates = pathCandidates(provider);
  for (const candidate of candidates) {
    const isBareCommand = !candidate.includes(path.sep) && !candidate.includes("/");
    if (!isBareCommand) {
      try {
        const stat = fs.statSync(candidate);
        if (!stat.isFile()) continue;
      } catch {
        continue;
      }
    }
    const versionArgs = provider === "ollama" ? ["--version"] : ["--version"];
    const result = await runCommand(candidate, versionArgs, { timeout: 5000, maxBuffer: 256 * 1024 });
    if (result.ok || /version|codex|claude|ollama/i.test(result.stdout + result.stderr)) {
      return { ok: true, provider, label: AI_PROVIDER_LABELS[provider], command: candidate };
    }
  }
  return { ok: false, provider, label: AI_PROVIDER_LABELS[provider], error: `${AI_PROVIDER_LABELS[provider]} not found` };
}

async function getAiStatus(provider) {
  const cli = await resolveCli(provider);
  if (!cli.ok) return { ...cli, connected: false };

  if (provider === "codex") {
    const status = await runCommand(cli.command, ["login", "status"], { timeout: 10000, maxBuffer: 512 * 1024 });
    return {
      ...cli,
      connected: status.ok,
      detail: (status.stdout || status.stderr || "").trim(),
      error: status.ok ? "" : "Run `codex` in a terminal and sign in first.",
    };
  }

  if (provider === "claude") {
    const status = await runCommand(cli.command, ["--version"], { timeout: 10000, maxBuffer: 512 * 1024 });
    return {
      ...cli,
      connected: status.ok,
      detail: (status.stdout || status.stderr || "").trim(),
      error: status.ok ? "" : "Install Claude Code CLI, then run `claude` in a terminal and sign in first.",
    };
  }

  const status = await runCommand(cli.command, ["list"], { timeout: 10000, maxBuffer: 1024 * 1024 });
  return {
    ...cli,
    connected: status.ok,
    detail: (status.stdout || status.stderr || "").trim(),
    error: status.ok ? "" : "Start Ollama and install a model first.",
  };
}

function stripAnsi(value) {
  return String(value || "").replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function cleanAiText(value) {
  const text = stripAnsi(value)
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !/^Reading (additional input|prompt) from stdin\.\.\.$/.test(line.trim()))
    .join("\n")
    .trim();
  return text.slice(0, 2200);
}

function customCharacterConcept(characterId) {
  return Array.isArray(settings.customCharacters)
    ? String(settings.customCharacters.find((character) => character?.id === characterId)?.concept || "").trim().slice(0, 420)
    : "";
}

function buildCharacterPrompt(payload) {
  const character = String(payload?.characterName || "BusyPet").trim().slice(0, 40) || "BusyPet";
  const characterId = String(payload?.characterId || "").trim();
  const customConcept = String(payload?.customConcept || customCharacterConcept(characterId)).trim().slice(0, 420);
  const persona =
    customConcept ||
    CHARACTER_PERSONAS[characterId] ||
    "cute pixel desktop companion with a distinct, playful personality";
  const userText = String(payload?.message || "").trim().slice(0, 800);
  const maxWords = Math.round(clamp(settings.ai?.maxWords, 12, 160, DEFAULT_SETTINGS.ai.maxWords));
  const languageHint = settings.language === "ko" ? "Korean" : "the user's language";
  const canSeeImages = payload?.imageSupport === true;
  const requestedImages = Array.isArray(payload?.requestedImagePaths) && payload.requestedImagePaths.length;
  const screenHint = payload?.includeScreen && canSeeImages
    ? "If an image is attached, treat it as the user's current screen and comment only on visible, non-sensitive context."
    : "";
  const imageHint = Array.isArray(payload?.imagePaths) && payload.imagePaths.length && canSeeImages
    ? "The user attached an image. If you can see it, use it naturally in your reply."
    : "";
  const unavailableImageHint = requestedImages && !canSeeImages
    ? "Image or screen context was requested, but this provider path cannot attach images here. Do not pretend to see the screen."
    : "";
  return [
    `You are ${character}, a cute pixel desktop companion in BusyPet.`,
    `Personality: ${persona}.`,
    customConcept ? "The personality above was written by the user for this custom character. Follow it closely." : "",
    `Reply in ${languageHint}.`,
    `Keep the reply under ${maxWords} words.`,
    "Stay in character, be friendly, and do not mention command-line tools.",
    "Do not ask to run commands or modify files.",
    "Do not write movement JSON in this visible reply. A separate planner will decide body movement.",
    screenHint,
    imageHint,
    unavailableImageHint,
    "",
    `User: ${userText}`,
  ].filter(Boolean).join("\n");
}

function parseJsonObjectFromAiText(value) {
  const text = cleanAiText(value);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1].trim() : text;
  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(source.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function numberInRange(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max, fallback) : fallback;
}

function normalizePlannerAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = String(value.type || "").trim();
  const lowerType = type.toLowerCase();
  if (!type || lowerType === "none") return null;
  if (lowerType === "motion") {
    const dx = numberInRange(value.dx, 0, -1, 1);
    const dy = numberInRange(value.dy, 0, -1, 1);
    const spin = numberInRange(value.spin, 0, -3, 3);
    if (Math.hypot(dx, dy) < 0.05 && Math.abs(spin) < 0.05 && !Number.isFinite(Number(value.speed))) return null;
    return {
      type: "motion",
      dx,
      dy,
      distance: Math.round(numberInRange(value.distance, 220, 0, 520)),
      speed: Number.isFinite(Number(value.speed)) ? numberInRange(value.speed, 1, 0.35, 2.5) : null,
      spin,
      holdMs: Math.round(numberInRange(value.holdMs, 2600, 600, 8000)),
    };
  }
  if (lowerType === "speed") {
    const factor = Number(value.factor);
    if (Number.isFinite(factor)) return { type: "speed", factor: numberInRange(factor, 1, 0.25, 4) };
    const speed = Number(value.value);
    return Number.isFinite(speed) ? { type: "speed", value: numberInRange(speed, 1, 0.35, 2.5) } : null;
  }
  if (lowerType === "mode") {
    const movement = String(value.movement || "").trim().toLowerCase();
    const mouse = String(value.mouse || "").trim().toLowerCase();
    const normalized = { type: "mode" };
    if (["free", "stay"].includes(movement)) normalized.movement = movement;
    if (["follow", "avoid", "ignore"].includes(mouse)) normalized.mouse = mouse;
    return normalized.movement || normalized.mouse ? normalized : null;
  }
  return null;
}

function normalizePlannerDecision(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, action: null };
  }
  const type = String(value.type || "").trim().toLowerCase();
  if (type === "none") return { ok: true, action: null };
  const action = normalizePlannerAction(value);
  return action ? { ok: true, action } : { ok: false, action: null };
}

function normalizePlannerReview(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reconsider: false };
  }
  if (typeof value.reconsider !== "boolean") return { ok: false, reconsider: false };
  return { ok: true, reconsider: value.reconsider };
}

function buildMovementPlannerPrompt(payload, visibleReply) {
  const character = String(payload?.characterName || "BusyPet").trim().slice(0, 40) || "BusyPet";
  const characterId = String(payload?.characterId || "").trim();
  const customConcept = String(payload?.customConcept || customCharacterConcept(characterId)).trim().slice(0, 420);
  const persona =
    customConcept ||
    CHARACTER_PERSONAS[characterId] ||
    "cute pixel desktop companion with a distinct, playful personality";
  const userText = String(payload?.message || "").trim().slice(0, 800);
  const replyText = String(visibleReply || "").trim().slice(0, 800);
  const stateText = JSON.stringify(payload?.movementState || {});
  const canSeeImages = payload?.imageSupport === true;
  const requestedImages = Array.isArray(payload?.requestedImagePaths) && payload.requestedImagePaths.length;
  const imageHint = Array.isArray(payload?.imagePaths) && payload.imagePaths.length && canSeeImages
    ? payload?.includeScreen
      ? "The current screen image is attached. Use it as context for body movement when it is relevant."
      : "An attached image is available as context for body movement when it is relevant."
    : "";
  const unavailableImageHint = requestedImages && !canSeeImages
    ? "Screen or image context was requested, but this provider path cannot inspect images. Judge movement from text, visible reply, and movement state only."
    : "";
  return [
    "You are the BusyPet body-control planner.",
    "Use your own judgement every time. Do not keyword-match. Decide whether this character should physically move, stay, change speed, change mouse behavior, or do nothing.",
    `Character: ${character}.`,
    `Personality: ${persona}.`,
    `Current state JSON: ${stateText}`,
    `User message: ${userText}`,
    `Character visible reply: ${replyText}`,
    imageHint,
    unavailableImageHint,
    "Your body plan is applied as a temporary AI override above the user's menu settings. Judge the character's next movement directly.",
    "Return JSON only. No markdown, no prose.",
    'Use {"type":"none"} when the best body decision is no change.',
    "If the visible reply promises or implies physical action, do not return none; choose a body motion that matches the promise.",
    "For a direct user instruction to the character, prefer expressive motion over no motion unless staying still is clearly the best answer.",
    "Body-control JSON:",
    '{"type":"motion","dx":-1..1,"dy":-1..1,"distance":0..520,"speed":0.35..2.5,"spin":-3..3,"holdMs":600..8000}',
    "dx/dy are free continuous steering values, not fixed menu commands. Pick them from the character's intent, personality, current position, and context.",
    '{"type":"speed","value":0.35-2.5} or {"type":"speed","factor":0.25-4}',
    '{"type":"mode","movement":"free|stay","mouse":"follow|avoid|ignore"}',
    "Never output code, shell commands, file paths, or actions outside this schema.",
  ].filter(Boolean).join("\n");
}

function buildMovementPlannerNoneReviewPrompt(payload, visibleReply, previousPlanText) {
  const character = String(payload?.characterName || "BusyPet").trim().slice(0, 40) || "BusyPet";
  const userText = String(payload?.message || "").trim().slice(0, 800);
  const replyText = String(visibleReply || "").trim().slice(0, 800);
  const priorText = String(previousPlanText || "").trim().slice(0, 800);
  const stateText = JSON.stringify(payload?.movementState || {});
  const canSeeImages = payload?.imageSupport === true;
  const requestedImages = Array.isArray(payload?.requestedImagePaths) && payload.requestedImagePaths.length;
  const imageHint = Array.isArray(payload?.imagePaths) && payload.imagePaths.length && canSeeImages
    ? "Image context is attached; use it only if it helps judge whether no movement is appropriate."
    : "";
  const unavailableImageHint = requestedImages && !canSeeImages
    ? "Image context was requested but is not attached for this provider path; do not infer unseen screen details."
    : "";
  return [
    "You are the BusyPet body-control reviewer.",
    "Use your own judgement. Do not keyword-match.",
    "The planner chose no physical movement.",
    `Character: ${character}.`,
    `Current state JSON: ${stateText}`,
    `User message: ${userText}`,
    `Character visible reply: ${replyText}`,
    `Previous body plan: ${priorText}`,
    imageHint,
    unavailableImageHint,
    "Decide whether the no-movement plan contradicts the user's intent or the character reply.",
    "Return JSON only.",
    '{"reconsider":true} if a physical body plan should be reconsidered.',
    '{"reconsider":false} if no movement is a genuinely good body decision.',
    "No prose. No code.",
  ].filter(Boolean).join("\n");
}

function buildMovementPlannerRepairPrompt(payload, visibleReply, previousPlanText) {
  const character = String(payload?.characterName || "BusyPet").trim().slice(0, 40) || "BusyPet";
  const userText = String(payload?.message || "").trim().slice(0, 800);
  const replyText = String(visibleReply || "").trim().slice(0, 800);
  const priorText = String(previousPlanText || "").trim().slice(0, 800);
  const stateText = JSON.stringify(payload?.movementState || {});
  const canSeeImages = payload?.imageSupport === true;
  const requestedImages = Array.isArray(payload?.requestedImagePaths) && payload.requestedImagePaths.length;
  const imageHint = Array.isArray(payload?.imagePaths) && payload.imagePaths.length && canSeeImages
    ? "Image context is attached; use it when choosing the corrected body movement."
    : "";
  const unavailableImageHint = requestedImages && !canSeeImages
    ? "Image context was requested but is not attached for this provider path; do not infer unseen screen details."
    : "";
  return [
    "You are still the BusyPet body-control planner.",
    "Your previous body plan was not usable by the app.",
    "Re-evaluate from scratch using your own judgement. Do not keyword-match.",
    `Character: ${character}.`,
    `Current state JSON: ${stateText}`,
    `User message: ${userText}`,
    `Character visible reply: ${replyText}`,
    `Previous unusable plan: ${priorText}`,
    imageHint,
    unavailableImageHint,
    "Your body plan is a temporary AI override above menu settings; choose the next physical behavior directly.",
    "Return JSON only.",
    'Return {"type":"none"} only if no body change is truly the best decision.',
    "If the user or character reply implies movement, pick a continuous body-control plan.",
    '{"type":"motion","dx":-1..1,"dy":-1..1,"distance":0..520,"speed":0.35..2.5,"spin":-3..3,"holdMs":600..8000}',
    '{"type":"speed","value":0.35..2.5} or {"type":"speed","factor":0.25..4}',
    '{"type":"mode","movement":"free|stay","mouse":"follow|avoid|ignore"}',
    "No prose. No code. No commands outside this schema.",
  ].filter(Boolean).join("\n");
}

async function capturePrimaryScreenToFile() {
  const display = screen.getPrimaryDisplay();
  const scale = display.scaleFactor || 1;
  const thumbnailSize = {
    width: Math.min(1440, Math.round(display.size.width * scale)),
    height: Math.min(900, Math.round(display.size.height * scale)),
  };
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize });
  const source = sources.find((item) => String(item.display_id) === String(display.id)) || sources[0];
  if (!source || source.thumbnail.isEmpty()) throw new Error("Screen capture is not available.");
  const filePath = path.join(os.tmpdir(), `busypet-screen-${process.pid}-${Date.now()}.png`);
  fs.writeFileSync(filePath, source.thumbnail.toPNG());
  return filePath;
}

function normalizeAiImagePaths(payload) {
  const source = Array.isArray(payload?.imagePaths) ? payload.imagePaths : payload?.imagePath ? [payload.imagePath] : [];
  return source
    .map((item) => normalizeImagePath(item))
    .filter(Boolean)
    .slice(0, 2);
}

function providerSupportsImageAttachments(provider) {
  return provider === "codex";
}

function imagePathsForProvider(provider, imagePaths) {
  return providerSupportsImageAttachments(provider) ? imagePaths : [];
}

async function chatWithCodex(command, prompt, imagePaths = []) {
  const outputPath = path.join(
    os.tmpdir(),
    `busypet-codex-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e6)}.txt`,
  );
  const args = [
    "--ask-for-approval",
    "never",
    "exec",
    "--skip-git-repo-check",
    "--ephemeral",
    "--ignore-rules",
    "--sandbox",
    "read-only",
    "--color",
    "never",
    "-C",
    app.getPath("userData"),
    "-o",
    outputPath,
  ];
  if (settings.ai?.model) args.push("--model", settings.ai.model);
  for (const imagePath of imagePaths) args.push("--image", imagePath);
  const result = await runCommand(command, args, { timeout: 90000, maxBuffer: 1024 * 1024 * 8, stdin: prompt });
  let fileAnswer = "";
  try {
    fileAnswer = fs.readFileSync(outputPath, "utf8");
  } catch {
    fileAnswer = "";
  } finally {
    fs.rmSync(outputPath, { force: true });
  }
  const fileText = cleanAiText(fileAnswer);
  const stdoutText = cleanAiText(result.stdout);
  const stderrText = result.ok ? "" : cleanAiText(result.stderr || result.error);
  const text = fileText || stdoutText || stderrText;
  return { ok: result.ok && !!text, text, raw: result };
}

async function chatWithClaude(command, prompt) {
  const args = [
    "-p",
    prompt,
    "--output-format",
    "text",
    "--max-turns",
    "1",
    "--disallowedTools",
    "Bash,Read,Edit,Write,NotebookEdit,WebFetch,WebSearch",
  ];
  if (settings.ai?.model) args.push("--model", settings.ai.model);
  const result = await runCommand(command, args, { timeout: 90000, maxBuffer: 1024 * 1024 * 8 });
  return { ok: result.ok, text: cleanAiText(result.stdout || result.stderr), raw: result };
}

async function chatWithOllama(command, prompt) {
  const model = settings.ai?.model || "llama3.2";
  const result = await runCommand(command, ["run", model, prompt], { timeout: 90000, maxBuffer: 1024 * 1024 * 8 });
  return { ok: result.ok, text: cleanAiText(result.stdout || result.stderr), raw: result };
}

async function chatWithProvider(provider, command, prompt, imagePaths = []) {
  if (provider === "claude") return chatWithClaude(command, prompt);
  if (provider === "ollama") return chatWithOllama(command, prompt);
  return chatWithCodex(command, prompt, imagePaths);
}

async function planAiMovement(provider, command, payload, imagePaths, visibleReply) {
  const supportedImagePaths = imagePathsForProvider(provider, imagePaths);
  const plannerPayload = {
    ...payload,
    imagePaths: supportedImagePaths,
    requestedImagePaths: imagePaths,
    imageSupport: providerSupportsImageAttachments(provider),
  };
  const planPrompt = buildMovementPlannerPrompt(plannerPayload, visibleReply);
  const plan = await chatWithProvider(provider, command, planPrompt, supportedImagePaths);
  const decision = plan.ok && plan.text
    ? normalizePlannerDecision(parseJsonObjectFromAiText(plan.text))
    : { ok: false, action: null };
  if (decision.ok && decision.action) return decision.action;
  if (decision.ok) {
    const reviewPrompt = buildMovementPlannerNoneReviewPrompt(plannerPayload, visibleReply, plan.text);
    const reviewPlan = await chatWithProvider(provider, command, reviewPrompt, supportedImagePaths);
    const review = reviewPlan.ok && reviewPlan.text
      ? normalizePlannerReview(parseJsonObjectFromAiText(reviewPlan.text))
      : { ok: false, reconsider: false };
    if (!review.ok || !review.reconsider) return null;
  }

  const repairPrompt = buildMovementPlannerRepairPrompt(plannerPayload, visibleReply, plan.text || plan.raw?.stderr || plan.raw?.error);
  const repairPlan = await chatWithProvider(provider, command, repairPrompt, supportedImagePaths);
  const repairDecision = repairPlan.ok && repairPlan.text
    ? normalizePlannerDecision(parseJsonObjectFromAiText(repairPlan.text))
    : { ok: false, action: null };
  return repairDecision.ok ? repairDecision.action : null;
}

async function runAiChat(payload) {
  const ai = normalizeAiSettings(settings.ai);
  if (!ai.enabled) return { ok: false, error: "AI is disabled in Settings." };
  const message = String(payload?.message || "").trim();
  if (!message) return { ok: false, error: "Type a message first." };

  const status = await getAiStatus(ai.provider);
  if (!status.ok || !status.connected) {
    return { ok: false, provider: ai.provider, error: status.error || `${status.label} is not connected.` };
  }

  const tempFiles = [];
  const imagePaths = normalizeAiImagePaths(payload);
  if (payload?.includeScreen && ai.screenAwareness) {
    try {
      const screenPath = await capturePrimaryScreenToFile();
      tempFiles.push(screenPath);
      imagePaths.unshift(screenPath);
    } catch (error) {
      if (!payload?.message) return { ok: false, error: String(error?.message || error) };
    }
  }

  try {
    const supportsImages = providerSupportsImageAttachments(ai.provider);
    const supportedImagePaths = imagePathsForProvider(ai.provider, imagePaths);
    const aiPayload = {
      ...payload,
      imagePaths: supportedImagePaths,
      requestedImagePaths: imagePaths,
      imageSupport: supportsImages,
    };
    const prompt = buildCharacterPrompt(aiPayload);
    const chat = await chatWithProvider(ai.provider, status.command, prompt, supportedImagePaths);

    if (!chat.ok || !chat.text) {
      return { ok: false, provider: ai.provider, error: cleanAiText(chat.raw?.stderr || chat.raw?.error) || "AI did not answer." };
    }

    const action = await planAiMovement(ai.provider, status.command, aiPayload, imagePaths, chat.text);

    return { ok: true, provider: ai.provider, text: chat.text, action };
  } finally {
    for (const filePath of tempFiles) fs.rmSync(filePath, { force: true });
  }
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

ipcMain.handle("ai:detect", async (_event, provider) => {
  const safeProvider = ["codex", "claude", "ollama"].includes(provider) ? provider : settings.ai?.provider || "codex";
  return getAiStatus(safeProvider);
});

ipcMain.handle("ai:test", async (_event, provider) => {
  const previous = settings.ai;
  settings.ai = normalizeAiSettings({ ...settings.ai, enabled: true, provider });
  try {
    return await runAiChat({
      characterName: "BusyPet",
      message: settings.language === "ko" ? "짧게 연결 테스트 인사해줘." : "Say a short connection test greeting.",
    });
  } finally {
    settings.ai = previous;
  }
});

ipcMain.handle("ai:chat", async (_event, payload) => runAiChat(payload));

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

ipcMain.handle("chat-image:pick", async () => {
  const owner = overlayWindow && !overlayWindow.isDestroyed() ? overlayWindow : settingsWindow;
  const result = await dialog.showOpenDialog(owner, {
    title: "Choose an image for BusyPet chat",
    defaultPath: app.getPath("pictures"),
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
  });
  if (result.canceled || !result.filePaths?.length) return { ok: false, cancelled: true };
  const imagePath = normalizeImagePath(result.filePaths[0]);
  if (!imagePath) return { ok: false, error: "Choose a PNG, JPG, WEBP, or GIF image file." };
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

ipcMain.on("quick-chat:toggle", toggleQuickChat);

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
    registerShortcuts();
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

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });

  app.on("window-all-closed", () => {
    // Keep the menu shortcut available until the user explicitly quits.
  });
}
