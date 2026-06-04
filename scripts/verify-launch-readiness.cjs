const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const releaseApi = "https://api.github.com/repos/smlim0804/deskpal-downloads/releases/latest";
const expectedAssets = [
  "DeskPal-Desktop-macOS-arm64.dmg",
  "DeskPal-Desktop-Windows-x64.exe",
];

function readText(...segments) {
  return fs.readFileSync(path.join(root, ...segments), "utf8").replace(/\r\n/g, "\n");
}

function readJson(...segments) {
  return JSON.parse(readText(...segments));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Launch readiness failed: ${message}`);
    process.exitCode = 1;
  }
}

function includes(source, needle, label) {
  assert(source.includes(needle), `missing ${label || needle}`);
}

function fileSize(...segments) {
  try {
    return fs.statSync(path.join(root, ...segments)).size;
  } catch {
    return 0;
  }
}

function functionBody(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `missing ${name}`);
  if (start < 0) return "";
  const next = source.indexOf("\nfunction ", start + marker.length);
  return source.slice(start, next > start ? next : source.length);
}

function assertNoLegacyName() {
  const legacy = ["Busy", "Pet"].join("");
  const ignoredDirs = new Set(["node_modules", "dist", "release", ".git"]);
  const ignoredFiles = new Set([path.basename(__filename)]);

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignoredDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (ignoredFiles.has(entry.name)) continue;
      if (!/\.(cjs|js|html|css|json|md|svg|plist)$/i.test(entry.name)) continue;
      const body = fs.readFileSync(full, "utf8");
      assert(!body.includes(legacy), `legacy product name remains in ${path.relative(root, full)}`);
    }
  }

  walk(root);
}

async function verifyRelease(packageVersion) {
  const response = await fetch(releaseApi, {
    headers: { "User-Agent": `DeskPal-launch-check/${packageVersion}` },
  });
  const release = await response.json().catch(() => ({}));
  assert(response.ok, `latest release API returned ${response.status}`);
  assert(release.tag_name === `v${packageVersion}`, `latest release tag ${release.tag_name || "(missing)"} does not match v${packageVersion}`);
  const assetNames = Array.isArray(release.assets) ? release.assets.map((asset) => asset.name).sort() : [];
  assert(
    JSON.stringify(assetNames) === JSON.stringify([...expectedAssets].sort()),
    `release assets must be exactly ${expectedAssets.join(", ")}; got ${assetNames.join(", ") || "(none)"}`,
  );
}

async function main() {
  const pkg = readJson("package.json");
  const mainSource = readText("src", "main.cjs");
  const preloadSource = readText("src", "preload.cjs");
  const settingsHtml = readText("src", "settings.html");
  const settingsJs = readText("src", "settings.js");
  const characters = readText("src", "characters.js");

  assert(pkg.name === "deskpal-desktop", "package name must be deskpal-desktop");
  assert(pkg.build?.productName === "DeskPal Desktop", "Electron productName must be DeskPal Desktop");
  assert(pkg.build?.appId === "com.deskpal.desktop", "Electron appId must be com.deskpal.desktop");
  assert(/^\d+\.\d+\.\d+$/.test(pkg.version), "package version must be a stable semver");

  assert(fileSize("build", "icon.png") > 1000, "rocket PNG app icon is missing or empty");
  assert(fileSize("build", "icon.icns") > 1000, "macOS ICNS app icon is missing or empty");
  assert(fileSize("build", "icon.ico") > 1000, "Windows ICO app icon is missing or empty");
  includes(characters, "effectAnchor: { x: 0.47, y: 0.86 }", "rocket exhaust effect anchor");

  includes(mainSource, "https://www.aidogam.com/api/deskpal-license", "DeskPal license API URL");
  includes(mainSource, "https://api.github.com/repos/smlim0804/deskpal-downloads/releases/latest", "DeskPal update release API");
  includes(mainSource, "function resolveLicenseCheckoutUrl", "app-driven checkout resolver");
  includes(mainSource, "action: \"checkout\"", "checkout API action");
  includes(mainSource, "plan: targetPlan", "selected checkout plan is sent to API");
  includes(mainSource, "function fallbackCheckoutUrl", "checkout fallback to website");
  includes(mainSource, "url.searchParams.set(\"plan\", checkoutPlan(plan))", "fallback checkout preserves selected plan");
  includes(preloadSource, "openLicenseCheckout: (plan)", "preload passes selected checkout plan");
  includes(settingsHtml, "id=\"buyPro\"", "Pro checkout button");
  includes(settingsHtml, "id=\"buyLifetime\"", "Lifetime checkout button");
  includes(settingsJs, "api.openLicenseCheckout(\"pro\")", "Pro button opens Pro checkout");
  includes(settingsJs, "api.openLicenseCheckout(\"lifetime\")", "Lifetime button opens Lifetime checkout");

  includes(mainSource, "const FREE_CHARACTER_LIMIT = 2", "free character limit");
  includes(mainSource, "const FREE_WEB_SHORTCUT_LIMIT = 1", "free web shortcut limit");
  includes(mainSource, "const FREE_APP_SHORTCUT_LIMIT = 1", "free app shortcut limit");
  const limits = functionBody(mainSource, "applyFreeLimits");
  includes(limits, "if (hasProLicense(next)) return next", "Pro bypasses free limits");
  includes(limits, "if (index >= FREE_CHARACTER_LIMIT) limited.enabled = false", "free disables extra character slots");
  includes(limits, "if (isCustomCharacterId(limited.character)) limited.character = fallback.character", "free blocks custom characters");
  includes(limits, "limited.behavior.effectMode = \"off\"", "free blocks effects");
  includes(limits, "return appCount <= FREE_APP_SHORTCUT_LIMIT", "free keeps only one app shortcut");
  includes(limits, "return webCount <= FREE_WEB_SHORTCUT_LIMIT", "free keeps only one web shortcut");
  includes(mainSource, "return applyFreeLimits(next)", "settings normalization enforces free limits server-side");

  includes(settingsJs, "if (!isPro()) return;", "free custom editor actions are blocked");
  includes(settingsJs, "addShortcut.disabled = !isPro() && shortcutCount(\"web\") >= FREE_WEB_SHORTCUT_LIMIT", "free web shortcut add button locks");
  includes(settingsJs, "addAppShortcut.disabled = !isPro() && shortcutCount(\"app\") >= FREE_APP_SHORTCUT_LIMIT", "free app shortcut add button locks");
  includes(settingsJs, "effectSelect.disabled = !pro", "free effect selector locks");

  assertNoLegacyName();
  await verifyRelease(pkg.version);

  if (!process.exitCode) console.log("Launch readiness verification passed.");
}

main().catch((error) => {
  console.error(`Launch readiness failed: ${error?.message || error}`);
  process.exitCode = 1;
});
