const { app, BrowserWindow, Menu, ipcMain, screen, shell, dialog, nativeImage, Tray, powerMonitor } = require("electron");
const crypto = require("crypto");
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
const CARE_MEMORY_LIMIT = 12;
const CHARACTER_IDS = [
  "ufo",
  "car",
  "slime",
  "comet",
  "star",
  "pup",
  "kit",
  "bunny",
  "fox",
  "hamster",
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

const DEFAULT_CARE = Object.freeze({
  level: 1,
  xp: 0,
  bond: 0,
  hunger: 72,
  happiness: 76,
  energy: 78,
  hygiene: 82,
  training: 0,
  equippedToy: "",
  equippedEffect: "normal",
  equippedCharm: "",
  equippedMedal: "",
  request: { dayKey: "", action: "", done: false, seed: 0 },
  combo: { lastAction: "", lastAt: 0, chain: 0 },
  routine: { id: "", step: 0, dayKey: "", completedToday: false },
  growthRewards: [],
  memories: [],
  friendships: {},
  lastCareAt: 0,
  lastActionAt: 0,
  actionCounts: {},
});

const DEFAULT_GAME = Object.freeze({
  dayKey: "",
  coins: 0,
  inventory: [],
  effectInventory: ["normal"],
  charmInventory: [],
  eggNest: { progress: 0, hatchedCount: 0, lastHatched: "" },
  snackInventory: {},
  petDex: {},
  moodMoments: { counts: {}, lastAt: 0, lastMood: "" },
  collections: {},
  dailyQuests: [],
  streak: { lastSeenDayKey: "", current: 0, best: 0, claimedDayKey: "" },
  leagueSeason: { seasonKey: "", points: 0, bestPoints: 0, claimedTiers: [] },
  focus: { activeSlot: -1, startedAt: 0, targetMinutes: 25, totalMinutes: 0, completed: 0, bestMinutes: 0, lastCompletedDayKey: "" },
  claimedMilestones: [],
  habitatInventory: [],
  habitatLayout: [],
  habitatTheme: "cozy",
  ambientEvents: { counts: {}, lastAt: 0, lastId: "", lastKey: "" },
});

const TOY_IDS = ["ribbon", "bell", "ball", "brush", "rocketSnack", "starBlanket"];
const EFFECT_IDS = ["normal", "spark", "bubble", "pixel", "rainbow"];
const CHARM_IDS = ["luckyLeaf", "focusGem", "cozyShell", "rainbowPin"];
const EGG_HATCH_POOL = ["pup", "kit", "bunny", "fox", "hamster"];
const SNACK_IDS = ["berryBite", "moonMilk", "crunchyStar", "cleanMint", "focusBean", "cozyCookie"];
const PET_ALBUM_IDS = CHARACTER_IDS;
const MOOD_AURA_IDS = ["bright", "calm", "hungry", "sleepy", "messy", "lonely"];
const CARE_ACTION_IDS = ["feed", "play", "pet", "clean", "train", "nap"];
const CARE_ROUTINE_IDS = ["morningLoop", "skillDrill", "cozyReset", "playSprint"];
const GROWTH_REWARD_IDS = ["firstSteps", "levelSpark", "bondRibbon", "skillStripe", "pathCharm", "habitBadge", "moodCrown", "storyMedal", "acePack"];
const LEAGUE_SEASON_TIER_IDS = ["warmup", "bronze", "gold", "master"];
const LEAGUE_MEDAL_IDS = ["rookie", "sprinter", "cozy", "trickAce", "relayHero", "seasonStar"];
const HABITAT_SLOT_LIMIT = 6;
const HABITAT_IDS = ["mat", "plant", "lamp", "cushion", "snackBowl", "clock", "book", "window"];
const HABITAT_THEME_IDS = ["cozy", "garden", "night", "study"];
const DISCOVERY_ITEM_IDS = [
  "sparkSeed",
  "miniShell",
  "dustStar",
  "smileSticker",
  "lostButton",
  "tinyRibbon",
  "glowPebble",
  "cloudChip",
  "yellowPixel",
  "smallMap",
  "moonMarble",
  "codeLeaf",
];
const MILESTONE_IDS = [
  "firstCare",
  "level3",
  "level5",
  "bond50",
  "training60",
  "toyCollector",
  "toyPlay",
  "cozyCorner",
  "roomDesigner",
  "roomEventHost",
  "miniGameChamp",
  "effectCollector",
  "eggHatcher",
  "snackChef",
  "petAlbum",
  "moodReader",
  "moodPatternKeeper",
  "talentGraduate",
  "jobHelper",
  "focusBuddy",
  "growthPath",
  "habitKeeper",
  "instinctKeeper",
  "perkKeeper",
  "synergyKeeper",
  "storyArchivist",
  "caretakerMentor",
  "personalityMatch",
  "seasonWatcher",
  "collectorHalf",
  "charmCrafter",
  "memoryBook",
  "socialCircle",
  "playdateHost",
  "duoBond",
  "packLeader",
  "contestChampion",
  "leagueCollector",
  "medalCollector",
  "medalChallenger",
  "walkLeader",
  "yardTrainer",
  "patrolCaptain",
  "objectPlayer",
  "routineKeeper",
  "commandTrainer",
  "formAscended",
  "trickStarter",
  "trickMaster",
  "missionScout",
  "signaturePerformer",
  "requestHelper",
  "comboKeeper",
  "dailyStreak",
  "dailyChampion",
];
const AMBIENT_EVENT_IDS = [
  "dewSpark",
  "sunPatch",
  "leafSwirl",
  "moonGlow",
  "snackScent",
  "starBlink",
  "snowQuiet",
  "flowerTrail",
];

const DEFAULT_CUSTOM_PIXELS = Object.freeze(Array(CUSTOM_GRID_SIZE * CUSTOM_GRID_SIZE).fill(""));

function defaultCustomCharacter(index) {
  return {
    id: CUSTOM_CHARACTER_IDS[index],
    name: `Custom ${index + 1}`,
    imagePath: "",
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
  runInBackground: true,
  showTrayIcon: true,
  ghostMode: true,
  ghostDelaySeconds: 3,
  ghostTriggerMouse: true,
  ghostTriggerKeyboard: true,
  ghostTriggerWheel: true,
  ghostOpacity: 0,
  fps: 16,
  game: clone(DEFAULT_GAME),
  customCharacters: [defaultCustomCharacter(0)],
  slots: [
    { character: "ufo", enabled: true, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "normal", speedMultiplier: 1.0 } },
    { character: "car", enabled: true, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "normal", speedMultiplier: 1.0 } },
    { character: "slime", enabled: true, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "pixel", speedMultiplier: 1.0 } },
    { character: "comet", enabled: true, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "rainbow", effectIntensity: 1.0, speedMultiplier: 1.0 } },
    { character: "star", enabled: true, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "spark", speedMultiplier: 1.0 } },
    { character: "pup", enabled: false, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "spark", effectIntensity: 1.1, speedMultiplier: 1.1 } },
    { character: "kit", enabled: false, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "normal", speedMultiplier: 1.0 } },
    { character: "bunny", enabled: false, behavior: { ...DEFAULT_BEHAVIOR, effectMode: "pixel", speedMultiplier: 1.2 } },
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
let lastCpuSample = null;
let tray = null;
let systemStatsCache = null;
let systemStatsCacheAt = 0;
let systemStatsRefreshPending = false;

const SYSTEM_STATS_REFRESH_MS = 5000;

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

function cpuSample() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total, at: Date.now() };
}

function percent(value) {
  return Math.round(clamp(value, 0, 100, 0));
}

function cpuUsagePercent() {
  const sample = cpuSample();
  if (!lastCpuSample) {
    lastCpuSample = sample;
    return 0;
  }
  const idleDelta = sample.idle - lastCpuSample.idle;
  const totalDelta = sample.total - lastCpuSample.total;
  lastCpuSample = sample;
  if (totalDelta <= 0) return 0;
  return percent((1 - idleDelta / totalDelta) * 100);
}

function storageRoot() {
  const mountPoint = app.getPath("home");
  return path.parse(mountPoint).root || mountPoint;
}

function storageStatsFromStatfs(stats, root) {
  const total = Number(stats.blocks) * Number(stats.bsize);
  const free = Number(stats.bavail) * Number(stats.bsize);
  const used = Math.max(0, total - free);
  return {
    total,
    used,
    free,
    percent: total > 0 ? percent((used / total) * 100) : 0,
    root,
  };
}

function storageStatsFallback() {
  try {
    const root = storageRoot();
    return storageStatsFromStatfs(fs.statfsSync(root), root);
  } catch {
    return { total: 0, used: 0, free: 0, percent: 0, root: "" };
  }
}

async function storageStatsAsync() {
  try {
    const root = storageRoot();
    return storageStatsFromStatfs(await fs.promises.statfs(root), root);
  } catch {
    return null;
  }
}

function parseKeyValueBytes(output) {
  const values = {};
  for (const line of String(output || "").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_()]+):\s+(\d+)/);
    if (!match) continue;
    values[match[1]] = Number(match[2]) * 1024;
  }
  return values;
}

function linuxMemoryStats() {
  try {
    const values = parseKeyValueBytes(fs.readFileSync("/proc/meminfo", "utf8"));
    const total = values.MemTotal || os.totalmem();
    const free = values.MemAvailable || values.MemFree || os.freemem();
    const used = Math.max(0, total - free);
    return {
      total,
      used,
      free,
      percent: total > 0 ? percent((used / total) * 100) : 0,
    };
  } catch {
    return null;
  }
}

function memoryStatsFallback() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = Math.max(0, totalMemory - freeMemory);
  return {
    total: totalMemory,
    used: usedMemory,
    free: freeMemory,
    percent: totalMemory > 0 ? percent((usedMemory / totalMemory) * 100) : 0,
  };
}

// macOS `os.freemem()` only counts truly-free pages, so it reports ~99% used
// even when most memory is reclaimable disk cache. Electron's system memory
// info also exposes file-backed (cached files) and purgeable pages, which are
// reclaimable on demand. Treating them as available matches Activity Monitor's
// "Memory Used" (which excludes cached files) and Windows' available metric.
function electronMemoryStats() {
  if (typeof process.getSystemMemoryInfo !== "function") return null;
  try {
    const info = process.getSystemMemoryInfo();
    const toBytes = (kb) => (Number.isFinite(Number(kb)) ? Number(kb) : 0) * 1024;
    const total = toBytes(info.total);
    if (total <= 0) return null;
    const available = Math.min(total, toBytes(info.free) + toBytes(info.fileBacked) + toBytes(info.purgeable));
    const used = Math.max(0, total - available);
    return {
      total,
      used,
      free: available,
      percent: percent((used / total) * 100),
    };
  } catch {
    return null;
  }
}

function memoryStats() {
  const platformStats = process.platform === "linux" ? linuxMemoryStats() : null;
  if (platformStats) return platformStats;
  return electronMemoryStats() || memoryStatsFallback();
}

function immediateSystemStats(options = {}) {
  const memory = memoryStats();
  const storage =
    options.allowStorageFallback === false && systemStatsCache?.storage
      ? systemStatsCache.storage
      : storageStatsFallback();
  return {
    at: Date.now(),
    cpu: { percent: cpuUsagePercent(), cores: os.cpus().length },
    memory,
    storage,
  };
}

async function collectSystemStats() {
  const fallback = immediateSystemStats({ allowStorageFallback: !systemStatsCache });
  let cpuPercent = fallback.cpu.percent;
  let memory = fallback.memory;
  let storage = fallback.storage;

  storage = (await storageStatsAsync()) || storage;

  return {
    at: Date.now(),
    cpu: { percent: cpuPercent, cores: os.cpus().length },
    memory,
    storage,
  };
}

function refreshSystemStatsCache(options = {}) {
  const now = Date.now();
  if (systemStatsRefreshPending) return;
  if (!options.force && systemStatsCache && now - systemStatsCacheAt < SYSTEM_STATS_REFRESH_MS) return;
  systemStatsRefreshPending = true;
  collectSystemStats()
    .then((next) => {
      systemStatsCache = next;
      systemStatsCacheAt = Date.now();
    })
    .catch(() => {
      if (!systemStatsCache) {
        systemStatsCache = immediateSystemStats();
        systemStatsCacheAt = Date.now();
      }
    })
    .finally(() => {
      systemStatsRefreshPending = false;
    });
}

function systemStats() {
  if (!systemStatsCache) {
    systemStatsCache = immediateSystemStats();
    systemStatsCacheAt = Date.now();
    refreshSystemStatsCache({ force: true });
  } else {
    refreshSystemStatsCache();
  }
  return systemStatsCache;
}

function systemInputIdleMs() {
  try {
    const seconds = powerMonitor.getSystemIdleTime();
    return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : null;
  } catch {
    return null;
  }
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
  if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico"].includes(ext)) return "";
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

// Bump when icon extraction improves so previously cached (often generic)
// icons are re-fetched instead of reused.
const APP_ICON_CACHE_VERSION = 2;

function appIconCachePath(appPath) {
  const hash = crypto.createHash("sha1").update(String(appPath || "")).digest("hex").slice(0, 24);
  return path.join(app.getPath("userData"), "shortcut-icons", `${hash}-v${APP_ICON_CACHE_VERSION}.png`);
}

function existingAppIconPath(appPath) {
  const iconPath = appIconCachePath(appPath);
  try {
    return fs.statSync(iconPath).isFile() ? iconPath : "";
  } catch {
    return "";
  }
}

async function extractAppIcon(appPath) {
  const iconPath = appIconCachePath(appPath);
  const writeIcon = (icon) => {
    if (!icon || icon.isEmpty()) return "";
    const png = icon.toPNG();
    if (!png?.length) return "";
    fs.mkdirSync(path.dirname(iconPath), { recursive: true });
    fs.writeFileSync(iconPath, png);
    return iconPath;
  };

  // The OS thumbnail service (QuickLook on macOS, the shell on Windows) returns
  // the real, full-color app icon. `app.getFileIcon` frequently hands back a
  // generic placeholder on macOS, so prefer the thumbnail when it is available.
  if (process.platform !== "linux" && typeof nativeImage.createThumbnailFromPath === "function") {
    try {
      const thumb = await nativeImage.createThumbnailFromPath(appPath, { width: 128, height: 128 });
      const saved = writeIcon(thumb);
      if (saved) return saved;
    } catch {
      /* fall back to getFileIcon below */
    }
  }

  try {
    const icon = await app.getFileIcon(appPath, { size: "normal" });
    const saved = writeIcon(icon);
    if (saved) return saved;
  } catch {
    /* fall back to bundled icon below */
  }

  if (process.platform === "darwin" && path.extname(appPath).toLowerCase() === ".app") {
    try {
      const resources = path.join(appPath, "Contents", "Resources");
      const icons = fs
        .readdirSync(resources)
        .filter((name) => path.extname(name).toLowerCase() === ".icns")
        .map((name) => path.join(resources, name))
        .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
      for (const candidate of icons) {
        const saved = writeIcon(nativeImage.createFromPath(candidate));
        if (saved) return saved;
      }
    } catch {
      /* no readable bundle icon */
    }
  }

  return "";
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
    if (appPath) {
      return {
        type: "app",
        name: name || appNameFromPath(appPath),
        appPath,
        imagePath: imagePath || existingAppIconPath(appPath),
      };
    }
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
  merged.effectMode = ["off", ...EFFECT_IDS].includes(merged.effectMode)
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

function normalizeMemory(source) {
  const src = source && typeof source === "object" ? source : {};
  const text = String(src.text || "").trim().slice(0, 180);
  if (!text) return null;
  return {
    at: Math.round(clamp(src.at, 0, Date.now(), Date.now())),
    icon: String(src.icon || "✦").trim().slice(0, 4) || "✦",
    text,
  };
}

function normalizeFriendships(source) {
  const src = source && typeof source === "object" ? source : {};
  const friendships = {};
  for (let index = 0; index < MAX_SLOTS; index += 1) {
    const key = `slot-${index + 1}`;
    const value = Math.round(clamp(src[key], 0, 9999, 0));
    if (value > 0) friendships[key] = value;
  }
  return friendships;
}

function normalizeCareRequest(source) {
  const src = source && typeof source === "object" ? source : {};
  const action = CARE_ACTION_IDS.includes(src.action) ? src.action : "";
  return {
    dayKey: String(src.dayKey || "").trim().slice(0, 16),
    action,
    done: src.done === true,
    seed: Math.round(clamp(src.seed, 0, 999999999, 0)),
  };
}

function normalizeCareCombo(source) {
  const src = source && typeof source === "object" ? source : {};
  const lastAction = CARE_ACTION_IDS.includes(src.lastAction) ? src.lastAction : "";
  return {
    lastAction,
    lastAt: Math.round(clamp(src.lastAt, 0, Date.now(), 0)),
    chain: Math.round(clamp(src.chain, 0, 9999, 0)),
  };
}

function normalizeCareRoutine(source) {
  const src = source && typeof source === "object" ? source : {};
  const id = CARE_ROUTINE_IDS.includes(src.id) ? src.id : "";
  return {
    id,
    step: Math.round(clamp(src.step, 0, 8, 0)),
    dayKey: String(src.dayKey || "").trim().slice(0, 16),
    completedToday: src.completedToday === true,
  };
}

function normalizeCare(source) {
  const src = source && typeof source === "object" ? source : {};
  const counts = src.actionCounts && typeof src.actionCounts === "object" ? src.actionCounts : {};
  const memories = Array.isArray(src.memories) ? src.memories : [];
  const care = {
    ...clone(DEFAULT_CARE),
    ...src,
    actionCounts: {},
    memories: [],
    friendships: {},
  };
  care.level = Math.round(clamp(care.level, 1, 99, DEFAULT_CARE.level));
  care.xp = Math.round(clamp(care.xp, 0, 999999, DEFAULT_CARE.xp));
  care.bond = Math.round(clamp(care.bond, 0, 9999, DEFAULT_CARE.bond));
  care.hunger = Math.round(clamp(care.hunger, 0, 100, DEFAULT_CARE.hunger));
  care.happiness = Math.round(clamp(care.happiness, 0, 100, DEFAULT_CARE.happiness));
  care.energy = Math.round(clamp(care.energy, 0, 100, DEFAULT_CARE.energy));
  care.hygiene = Math.round(clamp(care.hygiene, 0, 100, DEFAULT_CARE.hygiene));
  care.training = Math.round(clamp(care.training, 0, 100, DEFAULT_CARE.training));
  care.equippedToy = TOY_IDS.includes(care.equippedToy) ? care.equippedToy : "";
  care.equippedEffect = EFFECT_IDS.includes(care.equippedEffect) ? care.equippedEffect : DEFAULT_CARE.equippedEffect;
  care.equippedCharm = CHARM_IDS.includes(care.equippedCharm) ? care.equippedCharm : "";
  care.equippedMedal = LEAGUE_MEDAL_IDS.includes(care.equippedMedal) ? care.equippedMedal : "";
  care.request = normalizeCareRequest(src.request);
  care.combo = normalizeCareCombo(src.combo);
  care.routine = normalizeCareRoutine(src.routine);
  care.growthRewards = Array.isArray(src.growthRewards)
    ? Array.from(new Set(src.growthRewards.filter((id) => GROWTH_REWARD_IDS.includes(id)))).slice(0, GROWTH_REWARD_IDS.length)
    : [];
  care.memories = memories.map(normalizeMemory).filter(Boolean).slice(0, CARE_MEMORY_LIMIT);
  care.friendships = normalizeFriendships(src.friendships);
  care.lastCareAt = Math.round(clamp(care.lastCareAt, 0, Date.now(), 0));
  care.lastActionAt = Math.round(clamp(care.lastActionAt, 0, Date.now(), 0));
  for (const [key, value] of Object.entries(counts)) {
    care.actionCounts[String(key).slice(0, 32)] = Math.round(clamp(value, 0, 999999, 0));
  }
  return care;
}

function normalizeQuest(source) {
  const src = source && typeof source === "object" ? source : {};
  const id = String(src.id || "").trim().slice(0, 48);
  const action = String(src.action || "").trim().slice(0, 32);
  const labelKey = String(src.labelKey || "").trim().slice(0, 48);
  if (!id || !action || !labelKey) return null;
  const target = Math.round(clamp(src.target, 1, 99, 1));
  const progress = Math.round(clamp(src.progress, 0, target, 0));
  return {
    id,
    action,
    labelKey,
    target,
    progress,
    reward: Math.round(clamp(src.reward, 1, 999, 10)),
    done: src.done === true || progress >= target,
    claimed: src.claimed === true,
  };
}

function normalizeCollections(source) {
  const src = source && typeof source === "object" ? source : {};
  const collections = {};
  for (const id of DISCOVERY_ITEM_IDS) {
    const count = Math.round(clamp(src[id], 0, 9999, 0));
    if (count > 0) collections[id] = count;
  }
  return collections;
}

function normalizeHabitatInventory(source) {
  return Array.isArray(source)
    ? Array.from(new Set(source.filter((id) => HABITAT_IDS.includes(id)))).slice(0, HABITAT_IDS.length)
    : [];
}

function normalizeEffectInventory(source) {
  const selected = Array.isArray(source) ? source : [];
  return Array.from(new Set(["normal", ...selected.filter((id) => EFFECT_IDS.includes(id))])).slice(0, EFFECT_IDS.length);
}

function normalizeCharmInventory(source) {
  return Array.isArray(source)
    ? Array.from(new Set(source.filter((id) => CHARM_IDS.includes(id)))).slice(0, CHARM_IDS.length)
    : [];
}

function normalizeSnackInventory(source) {
  const src = source && typeof source === "object" ? source : {};
  const inventory = {};
  for (const snackId of SNACK_IDS) {
    const count = Math.round(clamp(src[snackId], 0, 99, 0));
    if (count > 0) inventory[snackId] = count;
  }
  return inventory;
}

function normalizePetDex(source) {
  const src = source && typeof source === "object" ? source : {};
  const dex = {};
  for (const id of PET_ALBUM_IDS) {
    const record = src[id];
    const data = record && typeof record === "object" ? record : {};
    const seen = record === true || data.seen === true;
    const bestLevel = Math.round(clamp(data.bestLevel, 0, 99, 0));
    const hatchCount = Math.round(clamp(data.hatchCount, 0, 9999, 0));
    const firstSeenDayKey = String(data.firstSeenDayKey || "").trim().slice(0, 16);
    if (!seen && bestLevel <= 0 && hatchCount <= 0) continue;
    dex[id] = {
      seen: true,
      firstSeenDayKey,
      bestLevel,
      hatchCount,
    };
  }
  return dex;
}

function normalizeMoodMoments(source) {
  const src = source && typeof source === "object" ? source : {};
  const counts = {};
  const rawCounts = src.counts && typeof src.counts === "object" ? src.counts : {};
  for (const id of MOOD_AURA_IDS) {
    const count = Math.round(clamp(rawCounts[id], 0, 9999, 0));
    if (count > 0) counts[id] = count;
  }
  return {
    counts,
    lastAt: Math.round(clamp(src.lastAt, 0, Date.now(), 0)),
    lastMood: MOOD_AURA_IDS.includes(src.lastMood) ? src.lastMood : "",
  };
}

function normalizeEggNest(source) {
  const src = source && typeof source === "object" ? source : {};
  return {
    progress: Math.round(clamp(src.progress, 0, 100, 0)),
    hatchedCount: Math.round(clamp(src.hatchedCount, 0, 9999, 0)),
    lastHatched: EGG_HATCH_POOL.includes(src.lastHatched) ? src.lastHatched : "",
  };
}

function normalizeHabitatLayout(source, inventory = []) {
  const owned = new Set(inventory);
  return Array.isArray(source)
    ? Array.from(new Set(source.filter((id) => HABITAT_IDS.includes(id) && owned.has(id)))).slice(0, HABITAT_SLOT_LIMIT)
    : [];
}

function normalizeHabitatTheme(source) {
  return HABITAT_THEME_IDS.includes(source) ? source : DEFAULT_GAME.habitatTheme;
}

function normalizeAmbientEvents(source) {
  const src = source && typeof source === "object" ? source : {};
  const counts = {};
  const rawCounts = src.counts && typeof src.counts === "object" ? src.counts : {};
  for (const id of AMBIENT_EVENT_IDS) {
    const count = Math.round(clamp(rawCounts[id], 0, 9999, 0));
    if (count > 0) counts[id] = count;
  }
  return {
    counts,
    lastAt: Math.round(clamp(src.lastAt, 0, Date.now(), 0)),
    lastId: AMBIENT_EVENT_IDS.includes(src.lastId) ? src.lastId : "",
    lastKey: String(src.lastKey || "").trim().slice(0, 32),
  };
}

function normalizeDailyStreak(source) {
  const src = source && typeof source === "object" ? source : {};
  const current = Math.round(clamp(src.current, 0, 9999, 0));
  const best = Math.round(clamp(src.best, 0, 9999, current));
  return {
    lastSeenDayKey: String(src.lastSeenDayKey || "").trim().slice(0, 16),
    current,
    best: Math.max(best, current),
    claimedDayKey: String(src.claimedDayKey || "").trim().slice(0, 16),
  };
}

function currentLeagueSeasonKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function normalizeLeagueSeason(source) {
  const src = source && typeof source === "object" ? source : {};
  const currentKey = currentLeagueSeasonKey();
  const rawKey = String(src.seasonKey || currentKey).trim().slice(0, 16);
  const rawPoints = Math.round(clamp(src.points, 0, 999999, 0));
  const rawBest = Math.round(clamp(src.bestPoints, 0, 999999, rawPoints));
  const claimedTiers = Array.isArray(src.claimedTiers)
    ? Array.from(new Set(src.claimedTiers.filter((id) => LEAGUE_SEASON_TIER_IDS.includes(id)))).slice(0, LEAGUE_SEASON_TIER_IDS.length)
    : [];
  if (rawKey !== currentKey) {
    return {
      seasonKey: currentKey,
      points: 0,
      bestPoints: Math.max(rawBest, rawPoints),
      claimedTiers: [],
    };
  }
  return {
    seasonKey: currentKey,
    points: rawPoints,
    bestPoints: Math.max(rawBest, rawPoints),
    claimedTiers,
  };
}

function normalizeFocus(source) {
  const src = source && typeof source === "object" ? source : {};
  const targetMinutes = Math.round(clamp(src.targetMinutes, 5, 90, DEFAULT_GAME.focus.targetMinutes));
  const activeSlot = Math.round(clamp(src.activeSlot, -1, MAX_SLOTS - 1, -1));
  const startedAt = activeSlot >= 0 ? Math.round(clamp(src.startedAt, 0, Date.now(), 0)) : 0;
  return {
    activeSlot: startedAt > 0 ? activeSlot : -1,
    startedAt,
    targetMinutes,
    totalMinutes: Math.round(clamp(src.totalMinutes, 0, 999999, 0)),
    completed: Math.round(clamp(src.completed, 0, 999999, 0)),
    bestMinutes: Math.round(clamp(src.bestMinutes, 0, 9999, 0)),
    lastCompletedDayKey: String(src.lastCompletedDayKey || "").trim().slice(0, 16),
  };
}

function normalizeGame(source) {
  const src = source && typeof source === "object" ? source : {};
  const claimedMilestones = Array.isArray(src.claimedMilestones)
    ? Array.from(new Set(src.claimedMilestones.filter((id) => MILESTONE_IDS.includes(id)))).slice(0, MILESTONE_IDS.length)
    : [];
  const habitatInventory = normalizeHabitatInventory(src.habitatInventory);
  return {
    dayKey: String(src.dayKey || "").trim().slice(0, 16),
    coins: Math.round(clamp(src.coins, 0, 999999, DEFAULT_GAME.coins)),
    inventory: Array.isArray(src.inventory)
      ? Array.from(new Set(src.inventory.filter((id) => TOY_IDS.includes(id)))).slice(0, TOY_IDS.length)
      : [],
    effectInventory: normalizeEffectInventory(src.effectInventory),
    charmInventory: normalizeCharmInventory(src.charmInventory),
    eggNest: normalizeEggNest(src.eggNest),
    snackInventory: normalizeSnackInventory(src.snackInventory),
    petDex: normalizePetDex(src.petDex),
    moodMoments: normalizeMoodMoments(src.moodMoments),
    collections: normalizeCollections(src.collections),
    dailyQuests: Array.isArray(src.dailyQuests)
      ? src.dailyQuests.map(normalizeQuest).filter(Boolean).slice(0, 5)
      : [],
    streak: normalizeDailyStreak(src.streak),
    leagueSeason: normalizeLeagueSeason(src.leagueSeason),
    focus: normalizeFocus(src.focus),
    claimedMilestones,
    habitatInventory,
    habitatLayout: normalizeHabitatLayout(src.habitatLayout, habitatInventory),
    habitatTheme: normalizeHabitatTheme(src.habitatTheme),
    ambientEvents: normalizeAmbientEvents(src.ambientEvents),
  };
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
    game: normalizeGame(src.game),
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
  next.ghostMode = src.ghostMode === undefined ? DEFAULT_SETTINGS.ghostMode : src.ghostMode === true;
  const rawGhostDelay = src.ghostDelaySeconds === 1 ? DEFAULT_SETTINGS.ghostDelaySeconds : src.ghostDelaySeconds;
  next.ghostDelaySeconds = clamp(rawGhostDelay, 1, 15, DEFAULT_SETTINGS.ghostDelaySeconds);
  next.ghostTriggerMouse = src.ghostTriggerMouse === undefined ? DEFAULT_SETTINGS.ghostTriggerMouse : src.ghostTriggerMouse === true;
  next.ghostTriggerKeyboard =
    src.ghostTriggerKeyboard === undefined ? DEFAULT_SETTINGS.ghostTriggerKeyboard : src.ghostTriggerKeyboard === true;
  next.ghostTriggerWheel = src.ghostTriggerWheel === undefined ? DEFAULT_SETTINGS.ghostTriggerWheel : src.ghostTriggerWheel === true;
  next.ghostOpacity = 0;
  next.runInBackground = src.runInBackground === undefined ? DEFAULT_SETTINGS.runInBackground : src.runInBackground === true;
  next.showTrayIcon = src.showTrayIcon === undefined ? DEFAULT_SETTINGS.showTrayIcon : src.showTrayIcon === true;
  next.shortcutDisplayMode = ["both", "image", "name"].includes(src.shortcutDisplayMode)
    ? src.shortcutDisplayMode
    : ["both", "image", "name"].includes(src.shortcuts?.[0]?.displayMode)
      ? src.shortcuts[0].displayMode
      : DEFAULT_SETTINGS.shortcutDisplayMode;
  next.fps = Math.round(clamp(next.fps, 10, 120, DEFAULT_SETTINGS.fps));
  next.slots = next.slots.slice(0, MAX_SLOTS).map((slot, index) => {
    const fallback = DEFAULT_SETTINGS.slots[index] || DEFAULT_SETTINGS.slots[0];
    const character = [...CHARACTER_IDS, ...CUSTOM_CHARACTER_IDS].includes(slot?.character) ? slot.character : fallback.character;
    return {
      character,
      enabled: slot?.enabled !== false,
      behavior: normalizeBehavior(slot?.behavior || fallback.behavior),
      care: normalizeCare(slot?.care),
    };
  });
  next.shortcuts = next.shortcuts
    .map((item) => normalizeShortcut(item, { allowDraft: true }))
    .filter(Boolean)
    .slice(0, 12);
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
  syncTray();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("settings:changed", settings);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("settings:changed", settings);
  }
}

async function hydrateShortcutIcons() {
  let changed = false;
  const iconDir = path.join(app.getPath("userData"), "shortcut-icons");
  for (const shortcut of settings.shortcuts || []) {
    if (shortcut?.type !== "app" || !shortcut.appPath) continue;
    // Keep a user-chosen custom image (one stored outside our icon cache).
    if (shortcut.imagePath && !isInsidePath(path.resolve(shortcut.imagePath), iconDir)) {
      try {
        if (fs.statSync(shortcut.imagePath).isFile()) continue;
      } catch {
        shortcut.imagePath = "";
      }
    }
    // Otherwise (re)resolve to the current cached icon, re-extracting stale or
    // previous-version icons so old generic placeholders get replaced.
    const imagePath = existingAppIconPath(shortcut.appPath) || (await extractAppIcon(shortcut.appPath));
    if (!imagePath || shortcut.imagePath === imagePath) continue;
    shortcut.imagePath = imagePath;
    changed = true;
  }
  if (!changed) return;
  saveSettings();
  broadcastSettings();
}

function trayIcon() {
  const candidates = [
    getWindowIconPath(),
    path.join(__dirname, "..", "build", "iconTemplate.png"),
    path.join(__dirname, "..", "build", "icon.ico"),
  ].filter(Boolean);
  let source = nativeImage.createEmpty();
  for (const candidate of candidates) {
    source = nativeImage.createFromPath(candidate);
    if (!source.isEmpty()) break;
  }
  const size = process.platform === "darwin" ? 22 : 20;
  const image = source.isEmpty() ? source : source.resize({ width: size, height: size, quality: "best" });
  return image;
}

function trayLabel(key) {
  const ko = settings.language === "ko";
  const labels = {
    settings: ko ? "설정" : "Settings",
    background: ko ? "백그라운드 실행" : "Run in Background",
    ghost: ko ? "유령모드" : "Ghost Mode",
    quit: ko ? "종료" : "Quit",
  };
  return labels[key] || key;
}

function trayTemplate() {
  return [
    {
      label: trayLabel("settings"),
      click: showSettingsWindow,
    },
    {
      label: trayLabel("background"),
      type: "checkbox",
      checked: settings.runInBackground !== false,
      click: (menuItem) => {
        settings.runInBackground = menuItem.checked;
        saveSettings();
        broadcastSettings();
      },
    },
    {
      label: trayLabel("ghost"),
      type: "checkbox",
      checked: settings.ghostMode !== false,
      click: (menuItem) => {
        settings.ghostMode = menuItem.checked;
        saveSettings();
        broadcastSettings();
      },
    },
    { type: "separator" },
    {
      label: trayLabel("quit"),
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ];
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(trayTemplate()));
}

function createTray() {
  if (tray) return;
  tray = new Tray(trayIcon());
  tray.setToolTip("BusyPet");
  refreshTrayMenu();
  tray.on("click", () => {
    refreshTrayMenu();
    tray.popUpContextMenu();
  });
}

function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

// Show/hide the menu-bar (macOS) / system-tray (Windows) icon and keep its
// menu in sync with the current settings.
function syncTray() {
  if (settings.showTrayIcon === false) {
    destroyTray();
    return;
  }
  if (!tray) createTray();
  else refreshTrayMenu();
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
    if (app.isQuitting) return;
    // When background mode is off, closing the window quits the whole app
    // instead of leaving it alive in the tray/menu bar.
    if (settings.runInBackground === false) {
      app.isQuitting = true;
      app.quit();
      return;
    }
    event.preventDefault();
    settingsWindow.hide();
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
      idleMs: systemInputIdleMs(),
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

ipcMain.handle("system:stats", () => systemStats());

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
  const imagePath = await extractAppIcon(appPath);
  return { ok: true, name: appNameFromPath(appPath), appPath, imagePath };
});

ipcMain.handle("image:pick", async () => {
  const owner = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : undefined;
  const result = await dialog.showOpenDialog(owner, {
    title: "Choose a shortcut image",
    defaultPath: app.getPath("pictures"),
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg", "ico"] }],
  });
  if (result.canceled || !result.filePaths?.length) return { ok: false, cancelled: true };
  const imagePath = normalizeImagePath(result.filePaths[0]);
  if (!imagePath) return { ok: false, error: "Choose a PNG, JPG, SVG, WEBP, GIF, or ICO image file." };
  return { ok: true, imagePath };
});

ipcMain.handle("sprite-image:pick", async () => {
  const owner = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : undefined;
  const result = await dialog.showOpenDialog(owner, {
    title: "Choose a custom character image",
    defaultPath: app.getPath("pictures"),
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"] }],
  });
  if (result.canceled || !result.filePaths?.length) return { ok: false, cancelled: true };
  const imagePath = normalizeImagePath(result.filePaths[0]);
  if (!imagePath) return { ok: false, error: "Choose a PNG, JPG, SVG, WEBP, or GIF image file." };
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
  if (!settingsWindow || settingsWindow.isDestroyed()) return;
  if (settings.runInBackground === false) {
    app.isQuitting = true;
    app.quit();
    return;
  }
  settingsWindow.hide();
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
    refreshSystemStatsCache({ force: true });
    buildMenu();
    syncTray();
    createOverlayWindow();
    createSettingsWindow();
    hydrateShortcutIcons();
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
    // In background mode, keep the menu shortcut available until the user
    // explicitly quits. Otherwise close the app once no windows remain.
    if (settings.runInBackground === false) app.quit();
  });
}
