const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const overlay = fs.readFileSync(path.join(root, "src", "overlay.js"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "overlay.css"), "utf8");
const main = fs.readFileSync(path.join(root, "src", "main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "src", "preload.cjs"), "utf8");
const settings = fs.readFileSync(path.join(root, "src", "settings.js"), "utf8");
const characters = fs.readFileSync(path.join(root, "src", "characters.js"), "utf8");
const interaction = fs.readFileSync(path.join(root, "src", "interaction-variety.js"), "utf8");

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
const idleLine = functionBody(overlay, "careIdleLine");
const autoTalk = functionBody(overlay, "maybeAutoTalk");

includes(overlay, "function renderShortcutPanel", "shortcut-only panel renderer");
includes(overlay, "function renderShortcutGroup", "split shortcut group renderer");
includes(overlay, "function renderSimpleCarePage", "simple care page renderer");
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
includes(overlay, "registerSystemIdle(point.idleMs, moved ? \"mouse\" : \"global\", now)", "cursor payload drives global input idle");
includes(overlay, "[\"keydown\", \"keyboard\"]", "keyboard activity fallback");
includes(overlay, "[\"wheel\", \"wheel\"]", "wheel activity fallback");
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
includes(overlay, 'links: "링크"', "Korean link group label");
includes(overlay, 'apps: "앱"', "Korean app group label");
includes(overlay, 'systemCpu: "CPU"', "system CPU label");
includes(overlay, 'systemRam: "RAM"', "system RAM label");
includes(overlay, 'systemStorage: "용량"', "system storage label");
includes(openPanel, 'view === "care" ? renderSimpleCarePage(pet, character) : renderShortcutPanel(pet)', "panel view switch");
assert(!openPanel.includes("renderPanelTabs"), "openPanel must not render care/game tabs");
assert(!openPanel.includes("panelSections"), "openPanel must not build the old crowded section list");
assert(!openPanel.includes("renderMiniGamePanel"), "openPanel must not attach mini games to character click");
assert(!openPanel.includes("renderLeagueSeasonPanel"), "openPanel must not attach league UI to character click");
assert(openPanel.includes("panelManual = null"), "fresh pet clicks must reset stale manual panel position");
assert(positionPanel.includes("belowY"), "panel should position near the clicked character");
assert(!idleLine.includes("character.name"), "auto idle speech must not prefix character names");
assert(autoTalk.includes("systemBenchmarkLine()"), "auto speech must include random system benchmark lines");
assert(!tick.includes("maybeAutoMicroEvents"), "tick must not run old automatic micro events");
assert(!tick.includes("maybePetDiscoveries"), "tick must not run old automatic discovery game loop");
assert(!tick.includes("maybePetAmbientEvents"), "tick must not run old ambient game loop");
assert(!tick.includes("maybeCareQuirkReactions"), "tick must not run old quirk reaction loop");
assert(tick.includes("refreshSystemStats()"), "tick must refresh system stats");
assert(tick.includes("recordFrameHealth(now, dt, profile)"), "tick must detect long frames");
assert(tick.includes("updateGhostMode(now)"), "tick must restore pets after mouse goes quiet");
assert(tick.includes("ghostMotionFrozen(now)"), "tick must freeze pets while fully ghosted");
assert(tick.includes("freezePetForGhost(pet, now)"), "tick must keep hidden pets in place");

includes(css, ".shortcut-panel", "shortcut panel styles");
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

includes(characters, "effectAnchor: { x: 0.479, y: 0.86 }", "rocket tail-centered effect anchor (sprite is symmetric around column 11.5)");

includes(main, "ipcMain.handle(\"system:stats\"", "system stats IPC");
includes(main, "function systemStats", "system stats function");
includes(main, "function systemInputIdleMs", "system input idle function");
includes(main, "powerMonitor.getSystemIdleTime()", "Electron input idle source");
includes(main, "idleMs: systemInputIdleMs()", "cursor payload includes input idle");
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
assert(!main.includes("child_process"), "main process must not spawn external system stat processes");
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
includes(main, "ghostTriggerWheel: true", "ghost wheel trigger default");
includes(main, "ghostOpacity: 0", "ghost opacity default");
includes(main, "next.ghostOpacity = 0", "ghost opacity is fixed hidden");
includes(main, "runInBackground: true", "run-in-background default setting");
includes(main, "showTrayIcon: true", "tray icon visible default setting");
includes(main, "next.runInBackground = src.runInBackground === undefined", "run-in-background is normalized");
includes(main, "next.showTrayIcon = src.showTrayIcon === undefined", "tray icon visibility is normalized");
includes(main, "settings.showTrayIcon === false", "tray icon can be hidden from the menu bar/system tray");
includes(main, "settings.runInBackground === false", "closing the window quits when background mode is off");
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
includes(settings, "settings.ghostTriggerWheel = ghostTriggerWheel.checked", "settings saves ghost wheel trigger");
includes(settings, "settings.runInBackground = runInBackground.checked", "settings saves run-in-background toggle");
includes(settings, "settings.showTrayIcon = showTrayIcon.checked", "settings saves tray icon toggle");
assert(!settings.includes("ghostOpacity"), "settings UI must not expose hidden opacity controls");
includes(settings, "async function chooseAppShortcut(index)", "app picker helper takes a slot index");
includes(settings, "const shortcut = settings.shortcuts[index]", "app picker re-acquires shortcut by index to avoid a stale reference");
includes(settings, "const current = settings.shortcuts[index]", "app picker can revert canceled type change");
assert(!settings.includes("await new Promise((resolve) => setTimeout(resolve, 80))"), "app type change must not race a delayed save before opening the picker");
assert(!settings.includes("chooseAppShortcut(shortcut)"), "app type change must not require a second selection");
includes(settings, "shortcut-app-select", "app shortcut select button");

includes(characters, "function tri(", "triangle ear helper for the new animal sprites");
includes(characters, 'name: "Pengu"', "penguin replaces the old hamster");
includes(characters, 'name: "Kongi"', "shiba replaces the old pup");

includes(interaction, "export function buildSocialDetail", "social detail builder");
includes(interaction, "export function buildDiscoveryDetail", "discovery detail builder");
includes(interaction, "export function buildPatrolDetail", "patrol detail builder");
includes(interaction, "export function buildMicroEventDetail", "micro event detail builder");

if (!process.exitCode) console.log("Care system verification passed.");
