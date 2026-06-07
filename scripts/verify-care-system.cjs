const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function readText(...segments) {
  return fs.readFileSync(path.join(root, ...segments), "utf8").replace(/\r\n/g, "\n");
}

const overlay = readText("src", "overlay.js");
const css = readText("src", "overlay.css");
const main = readText("src", "main.cjs");
const preload = readText("src", "preload.cjs");
const settings = readText("src", "settings.js");
const settingsCss = readText("src", "settings.css");
const settingsHtml = readText("src", "settings.html");
const characters = readText("src", "characters.js");
const interaction = readText("src", "interaction-variety.js");

function assert(condition, message) {
  if (!condition) {
    console.error(`Care system verification failed: ${message}`);
    process.exitCode = 1;
  }
}

function includes(source, needle, label) {
  assert(source.includes(needle), `missing ${label || needle}`);
}

function functionBody(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `missing ${name}`);
  if (start < 0) return "";
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next > start ? next : source.length);
}

const openPanel = functionBody(overlay, "openPanel");
const tick = functionBody(overlay, "tick");
const positionPanel = functionBody(overlay, "positionPanel");
const autoTalk = functionBody(overlay, "maybeAutoTalk");

includes(overlay, "function renderShortcutPanel", "shortcut-only panel renderer");
includes(overlay, "function renderRadialSide", "radial apps/links sides");
includes(overlay, "function renderRadialTools", "radial settings tool below the pet");
includes(overlay, "function renderRadialBubble", "card-less bubble shortcut renderer");
includes(overlay, "function renderSystemMetricCard", "system metric renderer");
includes(overlay, "function setGhostHidden", "ghost mode visibility helper");
includes(overlay, "function syncGhostBubbleState", "ghost mode speech bubble sync helper");
includes(overlay, "function registerPointerPoint", "ghost mode cursor tracker");
includes(overlay, "function registerSystemIdle", "ghost mode global input idle tracker");
includes(overlay, "function ghostMotionFrozen", "ghost mode freeze helper");
includes(overlay, "function freezePetForGhost", "ghost mode pet freeze helper");
includes(overlay, "const DEFAULT_GHOST_SHOW_DELAY_MS = 3000", "ghost mode default restore delay");
includes(overlay, "const GHOST_FREEZE_DELAY_MS = 380", "ghost mode freezes after fade-out");
includes(overlay, "function ghostShowDelayMs", "ghost mode configurable delay");
includes(overlay, "function ghostTriggerEnabled", "ghost mode trigger toggles");
includes(overlay, "function syncGhostSettings", "ghost opacity sync");
includes(overlay, "document.body.classList.toggle(\"ghost-hidden\", hidden)", "ghost mode body state");
includes(overlay, "bubble.classList.toggle(\"is-ghost-hidden\", ghostHidden)", "new speech bubbles follow ghost state");
includes(overlay, "effectParticles = []", "ghost mode clears live effects");
includes(overlay, "character.effectAnchor", "character trail anchors are used");
includes(overlay, "const visualRotation = (shouldOrient(pet) ? pet.rotation || 0 : 0) + (pet.spin || 0)", "trail anchors rotate with oriented pets");
includes(overlay, "registerSystemIdle(point.idleMs, idleSource, now)", "cursor payload feeds system idle tracker");
includes(overlay, "else if (Number(point.idleMs) + 120 < mouseStillFor) idleSource = \"keyboard\"", "keyboard idle only attributed when mouse has been still longer");
includes(overlay, "[\"keydown\", \"keyboard\"]", "keyboard activity fallback");
includes(overlay, "[\"wheel\", \"wheel\"]", "wheel activity fallback (merged into mouse trigger)");
includes(overlay, "const followRadius = clamp(size * 1.7", "mouse-follow targets an invisible circle around the cursor");
includes(overlay, "const followFar = followMode && mdist > followRadius", "follow speeds up to catch the cursor when outside the circle");
includes(overlay, "function refreshSystemStats", "system stats refresh");
includes(overlay, "nextSystemStatsAt = now + 5000", "renderer stats refresh is aligned to cached main stats");
includes(overlay, "lastCareStatsPanelRefreshAt", "care stats panel rerender throttle");
includes(overlay, "const viewportCache", "viewport dimensions are cached between resizes");
includes(overlay, "performanceProfileSignature", "performance profile is cached by mode and FPS");
includes(overlay, "viewportCache.w = window.innerWidth", "viewport cache updates on resize");
includes(overlay, "const STUTTER_FRAME_MS = 180", "long frame stutter guard threshold");
includes(overlay, "function recordFrameHealth", "long frame detection helper");
includes(overlay, "stutterGuardUntil", "temporary effect recovery guard");
includes(overlay, "profile.heavyFrameMs", "effect draw throttles during recovery");
includes(overlay, "function systemBenchmarkLine", "system benchmark speech");
includes(overlay, 'carePage: "시스템"', "Korean system page label");
includes(overlay, 'noShortcuts: "아직 바로가기가 없어."', "Korean empty shortcut label");
includes(overlay, 'links: "웹"', "Korean web shortcut group label");
includes(overlay, 'apps: "앱"', "Korean app group label");
includes(overlay, 'systemCpu: "CPU"', "system CPU label");
includes(overlay, 'systemRam: "RAM"', "system RAM label");
includes(overlay, 'systemStorage: "용량"', "system storage label");
includes(openPanel, "pet-panel--radial", "click panel uses the card-less radial bubble layout");
includes(openPanel, "renderShortcutPanel(pet)", "panel renders the radial shortcuts without a system toggle");
assert(!openPanel.includes("systemOpen"), "character click panel must not expose the system benchmark toggle");
assert(!openPanel.includes("renderPanelTabs"), "openPanel must not render care/game tabs");
assert(!openPanel.includes("panelSections"), "openPanel must not build the old crowded section list");
assert(!openPanel.includes("renderMiniGamePanel"), "openPanel must not attach mini games to character click");
assert(!openPanel.includes("renderLeagueSeasonPanel"), "openPanel must not attach league UI to character click");
assert(openPanel.includes("panelManual = null"), "fresh pet clicks must reset stale manual panel position");
assert(positionPanel.includes("radial-core"), "panel aligns its transparent core over the clicked character");
assert(autoTalk.includes("systemBenchmarkLine()"), "auto speech must include random system benchmark lines");
assert(!tick.includes("maybeAutoMicroEvents"), "tick must not run old automatic micro events");
assert(!tick.includes("maybePetDiscoveries"), "tick must not run old automatic discovery game loop");
assert(!tick.includes("maybePetAmbientEvents"), "tick must not run old ambient game loop");
assert(!tick.includes("maybeCareQuirkReactions"), "tick must not run old quirk reaction loop");
assert(tick.includes("refreshSystemStats()"), "tick must refresh system stats");
assert(tick.includes("recordFrameHealth(now, dt, profile)"), "tick must detect long frames");
assert(tick.includes("updateGhostMode(now)"), "tick must restore pets after mouse goes quiet");
includes(overlay, "function wakeTick", "loop paces itself instead of always re-requesting animation frames");
includes(overlay, "window.setTimeout(wakeTick, 160)", "loop idles to ~160ms polling when nothing is animating");
includes(overlay, "const petsActive = !ghostHidden && pets.some", "loop idles while pets are ghost-hidden");
includes(overlay, "function setEffectsCanvasShown", "full-screen effects canvas drops out of compositing when empty");
includes(overlay, 'effectsCanvas.style.display = shown ? "" : "none"', "empty effects canvas is removed from the compositor, not just hidden");
includes(overlay, "maxParticles: 160, trailMs: 76, dpr: 1", "effects canvas resolution capped to 1x to cut RAM/fill");
// The motion loop must use the cached care movement factor, never recompute the
// care/synergy/caretaker aggregators per frame (that was ~50% of overlay CPU).
includes(overlay, "function cachedCareMovementFactor", "care movement factor is memoized per pet");
includes(overlay, "const careFactor = cachedCareMovementFactor(pet, now)", "motion loop uses the cached care factor, not the per-frame aggregator");
assert(
  !overlay.includes("const careFactor = careMovementFactor("),
  "updateMotion must not call careMovementFactor directly every frame",
);
includes(overlay, "effectFrameMs", "effects-canvas redraw is capped independent of motion FPS");
includes(overlay, "function spawnCollisionBurst", "pets emit a varied burst when they collide");
includes(overlay, "spawnCollisionBurst(ax + nx * radiusA", "collision burst fires from the contact point on a real bump");
assert(tick.includes("ghostMotionFrozen(now)"), "tick must freeze pets while fully ghosted");
assert(tick.includes("freezePetForGhost(pet, now)"), "tick must keep hidden pets in place");

includes(css, ".shortcut-panel", "shortcut panel styles");
includes(css, ".pet-panel.pet-panel--radial", "radial panel is transparent (no card background)");
includes(css, "@keyframes radial-bubble-in", "bubbles pop out from the character");
includes(css, "-webkit-backdrop-filter: none", "radial panel adds no frosted blur over the character");
includes(overlay, "radial-bubble__tip", "app/link name shows on hover, not as a permanent label");
includes(css, ".radial-meter", "card-less system ring meters");
includes(css, ".panel-empty", "empty shortcut styles");
includes(css, ".simple-care-page", "simple care page styles");
includes(css, ".system-metric-card", "system metric styles");
includes(css, ".system-graph", "system graph styles");
includes(css, ".shortcut.app-only", "app icon-only shortcut styles");
includes(css, ".web-shortcuts .shortcut-grid", "web shortcut group grid");
includes(css, ".app-shortcuts .shortcut-grid", "app shortcut group grid");
includes(css, ".shortcut-grid {\n  gap: 8px;\n  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));", "compact responsive shortcut grid");
includes(css, ".pet.is-ghosted", "ghost hidden style");
includes(css, "body.ghost-hidden #effects-canvas", "ghost hidden effects canvas style");
includes(css, "body.ghost-hidden .pet-floating-bubble", "ghost hidden speech bubble style");
includes(css, ".pet-floating-bubble.is-ghost-hidden", "ghost hidden speech bubble class style");
includes(css, "var(--ghost-opacity, 0)", "ghost opacity CSS variable");
includes(css, "@keyframes pet-ghost-out", "ghost fade-out animation");
includes(css, "@keyframes pet-ghost-in", "ghost fade-in animation");
includes(css, "filter: none !important", "pet rectangle filter removal");

includes(characters, "effectAnchor: { x: 0.47, y: 0.80 }", "rocket effect emits from the exhaust flame just left of centre");

includes(main, "ipcMain.handle(\"system:stats\"", "system stats IPC");
includes(main, "function systemStats", "system stats function");
includes(main, "function systemInputIdleMs", "system input idle function");
includes(main, "powerMonitor.getSystemIdleTime()", "Electron input idle source");
includes(main, "idleMs: systemInputIdleMs()", "cursor payload includes input idle");
includes(main, "cursorWatchIdle ? 240 : 72", "cursor poll eases off while pets are hidden");
includes(main, 'ipcMain.on("overlay:idle"', "main listens for the overlay idle hint");
includes(overlay, "api.setOverlayIdle(hidden)", "overlay tells main when pets hide so the cursor poll can ease off");
includes(main, "function mergeOverlayLiveState", "overlay autosaves only merge game/care, not settings-window config");
assert(!main.includes("pushSettingsBounds"), "settings window must not create a pet no-go rectangle");
assert(!preload.includes("onSettingsBounds"), "preload must not expose settings-window bounds");
assert(!overlay.includes("resolveSettingsCollision"), "pets must be allowed over the settings window");
assert(!overlay.includes("clampOutOfSettings"), "settings window must not alter pet targets");
assert(!overlay.includes("settingsRect"), "overlay must not track settings as a blocked area");
includes(main, "event.sender === overlayWindow.webContents", "settings update ownership is split by sender so mouseMode etc. don't revert");
includes(main, "function memoryStats", "corrected memory stats function");
includes(main, "function memoryStatsFallback", "cross-platform memory stats fallback");
includes(main, "function electronMemoryStats", "cache-aware memory stats via Electron");
includes(main, "process.getSystemMemoryInfo()", "memory stats use Electron's cache-aware system memory info");
includes(main, "toBytes(info.fileBacked)", "reclaimable file-backed cache counts as available memory");
includes(main, "async function storageStatsAsync", "async storage stats helper");
includes(main, "fs.promises.statfs(root)", "storage stats avoid external df process");
includes(main, "function refreshSystemStatsCache", "cached system stats refresh");
includes(main, "const SYSTEM_STATS_REFRESH_MS = 5000", "system stats refresh throttle");
includes(main, "immediateSystemStats({ allowStorageFallback: !systemStatsCache })", "repeated stats refresh reuses cached storage fallback");
includes(main, "options.allowStorageFallback === false && systemStatsCache?.storage", "system stats avoid repeated sync storage fallback");
includes(main, "storage = (await storageStatsAsync()) || storage", "stats refresh updates storage asynchronously");
assert(!main.includes("execFileSync"), "main process must not use synchronous shell commands");
// The main process must not spawn external processes at all (no system-stat polling,
// no self-update helper scripts — updates just open the GitHub releases page).
assert(!main.includes("child_process"), "main process must not spawn external processes");
assert(!main.includes("execFile("), "main process must not exec external system stat commands");
assert(!main.includes("execFileText(\"top\""), "system stats must not spawn top");
assert(!main.includes("execFileText(\"df\""), "system stats must not spawn df");
assert(!main.includes("\"ioreg\""), "cursor idle must not poll ioreg");
includes(main, "nativeImage", "native image app icon fallback");
includes(main, "new Tray", "system tray/menu bar icon");
includes(main, "function createTray", "tray creation helper");
includes(main, "function destroyTray", "tray teardown helper");
includes(main, "function syncTray", "tray visibility sync helper");
includes(main, "tray.popUpContextMenu()", "tray click opens menu instead of settings");
includes(main, "type: \"checkbox\"", "tray ghost mode checkbox");
assert(!main.includes("Hide Companions"), "tray menu must not show Hide Companions");
includes(main, "ghostMode: true", "ghost mode default setting");
includes(main, "ghostDelaySeconds: 3", "ghost delay default setting");
includes(main, "ghostTriggerMouse: true", "ghost mouse trigger default");
includes(main, "ghostTriggerKeyboard: true", "ghost keyboard trigger default");
includes(main, "ghostOpacity: 0", "ghost opacity default");
includes(main, "next.ghostOpacity = 0", "ghost opacity is fixed hidden");
includes(main, "showTrayIcon: true", "tray icon visible default setting");
includes(main, "next.showTrayIcon = src.showTrayIcon === undefined", "tray icon visibility is normalized");
includes(main, "settings.showTrayIcon === false", "tray icon can be hidden from the menu bar/system tray");
// The run-in-background toggle was removed — the overlay always keeps the app
// alive and quitting is explicit. Guard against the feature creeping back.
assert(!main.includes("runInBackground"), "run-in-background feature is fully removed from main");
assert(!settings.includes("runInBackground"), "run-in-background toggle is removed from settings UI");
assert(!main.includes("if (!next.shortcuts.length) next.shortcuts"), "empty shortcut lists must stay empty");
includes(preload, "getSystemStats", "preload exposes system stats");
includes(main, "clamp(next.fps, 10, 120", "fps can be set up to 120");
includes(overlay, "settings?.fps || 16)), 10, 120)", "overlay fps cap raised to 120");
includes(main, '".svg"', "svg images are allowed for shortcuts and custom sprites");
includes(main, '"svg"', "svg appears in the image picker filters");
includes(overlay, "pet-sprite-img", "image/gif/svg custom sprites render as a real <img> so gifs animate");
includes(overlay, "imgEl: spriteImg", "pets carry an <img> sprite layer for image-based customs");
includes(main, "async function extractAppIcon", "app icon extraction");
includes(main, "createThumbnailFromPath", "real app icon via OS thumbnail service (getFileIcon returns a generic placeholder on macOS)");
includes(main, "APP_ICON_CACHE_VERSION", "app icon cache is versioned so stale generic icons are re-fetched");
includes(main, "async function hydrateShortcutIcons", "existing app icon hydration");
includes(main, "imagePath = await extractAppIcon(appPath)", "app picker icon result");
includes(settings, "shortcut.imagePath = result.imagePath || shortcut.imagePath", "settings saves picked app icon");
includes(settings, "const ghostMode = document.getElementById(\"ghostMode\")", "settings ghost mode control");
includes(settings, "settings.ghostMode = ghostMode.checked", "settings saves ghost mode");
includes(settings, "const ghostDelaySeconds = document.getElementById(\"ghostDelaySeconds\")", "settings ghost delay control");
includes(settings, "settings.ghostDelaySeconds = value", "settings saves ghost delay");
includes(settings, "settings.ghostTriggerMouse = ghostTriggerMouse.checked", "settings saves ghost mouse trigger");
includes(settings, "settings.ghostTriggerKeyboard = ghostTriggerKeyboard.checked", "settings saves ghost keyboard trigger");
includes(settings, "settings.showTrayIcon = showTrayIcon.checked", "settings saves tray icon toggle");
assert(!settings.includes("ghostOpacity"), "settings UI must not expose hidden opacity controls");
includes(settings, "async function chooseAppShortcut(index)", "app picker helper takes a slot index");
includes(settings, "const shortcut = settings.shortcuts[index]", "app picker re-acquires shortcut by index to avoid a stale reference");
includes(settings, "const current = settings.shortcuts[index]", "app picker can revert canceled type change");
assert(!settings.includes("await new Promise((resolve) => setTimeout(resolve, 80))"), "app type change must not race a delayed save before opening the picker");
assert(!settings.includes("chooseAppShortcut(shortcut)"), "app type change must not require a second selection");
includes(settings, "shortcut-app-select", "app shortcut select button");
includes(main, "app.getPath(\"downloads\")", "Windows app picker accepts downloaded .exe files");
includes(main, "app.getPath(\"desktop\")", "Windows app picker accepts Desktop .exe/.lnk files");
includes(main, "process.env.PUBLIC", "Windows app picker accepts Public Desktop shortcuts");
includes(main, "async function openUpdateTarget", "update target handler exists");
includes(main, "await shell.openExternal(target)", "update button opens the GitHub releases page (no in-app download)");
includes(main, "function updateIsActionable", "update download is version-gated");
includes(settings, "update.downloading", "settings exposes update download progress");
includes(settingsHtml, "promo-window", "promotion window exists in license panel");
includes(settingsHtml, "../build/icon.svg", "promotion uses the DeskPal rocket logo");
includes(settingsHtml, "./nabi.svg", "promotion includes the flying cat sprite");
includes(settingsCss, ".promo-window", "promotion window matches settings visual system");
includes(settingsCss, ".promo-rocket", "promotion rocket flies in the window");
includes(settingsCss, ".promo-cat", "promotion cat flies in the window");
includes(settingsCss, ".promo-trail", "promotion trail particles are styled");
// behavior(slot) must return a STABLE reference: control handlers capture it
// once at render, so reassigning a fresh object on later calls would orphan the
// capture and silently drop per-character edits (the "doesn't apply" bug).
assert(
  !settings.includes("slot.behavior = { ...clone(BEHAVIOR_DEFAULT), ...(slot.behavior || {}) }"),
  "behavior(slot) must not reassign a fresh object every call (orphans control captures)",
);
includes(
  settings,
  "if (slot.behavior[key] === undefined) slot.behavior[key] = defaults[key]",
  "behavior(slot) backfills defaults in place to keep a stable reference",
);
// Per-character effect-position controls were removed by request.
assert(!settings.includes("function makeEffectAnchorPicker"), "per-character effect point picker is removed");
assert(!settings.includes("effect-anchor-canvas"), "effect anchor picker canvas is removed");
includes(main, "delete merged.effectAnchor", "normalizeBehavior strips stale per-slot effect anchors");

includes(characters, "function tri(", "triangle ear helper for the new animal sprites");
includes(characters, 'name: "Pengu"', "penguin replaces the old hamster");
includes(characters, 'name: "Kongi"', "shiba replaces the old pup");

includes(interaction, "export function buildSocialDetail", "social detail builder");
includes(interaction, "export function buildDiscoveryDetail", "discovery detail builder");
includes(interaction, "export function buildPatrolDetail", "patrol detail builder");
includes(interaction, "export function buildMicroEventDetail", "micro event detail builder");

if (!process.exitCode) console.log("Care system verification passed.");
