const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const APP_NAME = "BusyPet Desktop";
const ARCH = process.env.BUSYPET_ARCH || process.arch;
const FINAL_OUT_DIR = path.join(ROOT, "dist", `${APP_NAME}-darwin-${ARCH}`);
const FINAL_DEST_APP = path.join(FINAL_OUT_DIR, `${APP_NAME}.app`);
const BUILD_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "busypet-mac-"));
const OUT_DIR = path.join(BUILD_ROOT, `${APP_NAME}-darwin-${ARCH}`);
const DEST_APP = path.join(OUT_DIR, `${APP_NAME}.app`);
const ELECTRON_APP = path.join(ROOT, "node_modules", "electron", "dist", "Electron.app");
const ELECTRON_INSTALL = path.join(ROOT, "node_modules", "electron", "install.js");
const ELECTRON_ICU = path.join(
  ELECTRON_APP,
  "Contents",
  "Frameworks",
  "Electron Framework.framework",
  "Versions",
  "A",
  "Resources",
  "icudtl.dat",
);
const RESOURCES_DIR = path.join(DEST_APP, "Contents", "Resources");
const APP_DIR = path.join(RESOURCES_DIR, "app");
const MACOS_DIR = path.join(DEST_APP, "Contents", "MacOS");
const ELECTRON_BIN = path.join(MACOS_DIR, "Electron");
const APP_BIN = path.join(MACOS_DIR, APP_NAME);
const PLIST = path.join(DEST_APP, "Contents", "Info.plist");
const ENTITLEMENTS = path.join(ROOT, "build", "entitlements.mac.plist");
const NOTARY_PASSWORD = process.env.APPLE_APP_PASSWORD || process.env.APPLE_APP_SPECIFIC_PASSWORD || "";
const ICON_ICNS = path.join(ROOT, "build", "icon.icns");

process.on("exit", () => {
  fs.rmSync(BUILD_ROOT, { recursive: true, force: true });
});

function copyFile(fileName) {
  fs.copyFileSync(path.join(ROOT, fileName), path.join(APP_DIR, fileName));
}

function removeDir(dir) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
      return;
    } catch (error) {
      if (error?.code !== "ENOTEMPTY" || attempt === 3) throw error;
      execFileSync("sleep", ["0.4"]);
    }
  }
}

function setPlist(key, value) {
  try {
    execFileSync("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, PLIST]);
  } catch {
    execFileSync("/usr/libexec/PlistBuddy", ["-c", `Add :${key} string ${value}`, PLIST]);
  }
}

function findDeveloperIdIdentity() {
  const configuredIdentity = process.env.MACOS_CODESIGN_IDENTITY || process.env.APPLE_SIGNING_IDENTITY || "";
  if (configuredIdentity) return configuredIdentity;

  try {
    const identities = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], { encoding: "utf8" });
    const match = identities.match(/"([^"]*Developer ID Application:[^"]+)"/);
    if (match) return match[1];
  } catch {
    // No keychain identity is fine for local unsigned builds.
  }

  return "-";
}

function notarizationReady(identity) {
  return identity !== "-" && process.env.APPLE_ID && process.env.APPLE_TEAM_ID && NOTARY_PASSWORD;
}

function clearMacMetadata(target) {
  const attrs = ["com.apple.FinderInfo", "com.apple.fileprovider.fpfs#P"];

  try {
    execFileSync("dot_clean", ["-m", target], { stdio: "ignore" });
  } catch {
    // dot_clean is macOS-only and optional for local packaging.
  }

  try {
    execFileSync("xattr", ["-cr", target], { stdio: "ignore" });
  } catch {
    // Best effort only. Codesign below will fail loudly if metadata remains invalid.
  }

  for (const attr of attrs) {
    try {
      execFileSync("xattr", ["-dr", attr, target], { stdio: "ignore" });
    } catch {
      // Attribute may not exist on every machine.
    }
  }
}

function signApp() {
  const identity = findDeveloperIdIdentity();
  const realSigning = identity !== "-";
  const codesignArgs = ["--force", "--deep", "--sign", identity];

  if (realSigning) {
    codesignArgs.push("--options", "runtime", "--timestamp", "--entitlements", ENTITLEMENTS);
  } else {
    codesignArgs.push("--timestamp=none");
  }

  codesignArgs.push(DEST_APP);

  clearMacMetadata(DEST_APP);
  execFileSync("codesign", codesignArgs, { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--verbose=2", DEST_APP], { stdio: "inherit" });

  if (notarizationReady(identity)) {
    notarizeApp();
    return;
  }

  if (realSigning) {
    console.warn("Signed with a Developer ID certificate, but notarization secrets are missing. Downloaded macOS builds may still be blocked by Gatekeeper.");
    return;
  }

  console.warn("Signed with an ad-hoc identity. This is fine for local testing, but downloaded macOS builds need Apple Developer ID signing and notarization.");
}

function notarizeApp() {
  const notaryZip = path.join(OUT_DIR, `${APP_NAME}-notary.zip`);

  fs.rmSync(notaryZip, { force: true });
  execFileSync("ditto", ["-c", "-k", "--keepParent", `${APP_NAME}.app`, notaryZip], {
    cwd: OUT_DIR,
    stdio: "inherit",
  });

  execFileSync(
    "xcrun",
    [
      "notarytool",
      "submit",
      notaryZip,
      "--apple-id",
      process.env.APPLE_ID,
      "--team-id",
      process.env.APPLE_TEAM_ID,
      "--password",
      NOTARY_PASSWORD,
      "--wait",
    ],
    { stdio: "inherit" },
  );
  execFileSync("xcrun", ["stapler", "staple", DEST_APP], { stdio: "inherit" });
  execFileSync("xcrun", ["stapler", "validate", DEST_APP], { stdio: "inherit" });
  execFileSync("spctl", ["--assess", "--type", "exec", "--verbose=2", DEST_APP], { stdio: "inherit" });
  fs.rmSync(notaryZip, { force: true });
}

if (!fs.existsSync(ELECTRON_APP) || !fs.existsSync(ELECTRON_ICU)) {
  if (!fs.existsSync(ELECTRON_INSTALL)) {
    throw new Error(`Electron runtime not found at ${ELECTRON_APP}. Run npm install first.`);
  }
  execFileSync(process.execPath, [ELECTRON_INSTALL], { stdio: "inherit" });
}

if (!fs.existsSync(ELECTRON_ICU)) {
  throw new Error("Electron runtime is incomplete. Delete node_modules/electron/dist and run npm install.");
}

execFileSync(process.execPath, [path.join(ROOT, "scripts", "generate-icon.cjs")], { stdio: "inherit" });

removeDir(OUT_DIR);
fs.mkdirSync(OUT_DIR, { recursive: true });
execFileSync("ditto", [ELECTRON_APP, DEST_APP]);

removeDir(APP_DIR);
fs.mkdirSync(APP_DIR, { recursive: true });
copyFile("package.json");
copyFile("README.md");
copyFile("SECURITY.md");
fs.cpSync(path.join(ROOT, "src"), path.join(APP_DIR, "src"), { recursive: true });
fs.cpSync(path.join(ROOT, "build"), path.join(APP_DIR, "build"), { recursive: true });
const docsDir = path.join(ROOT, "docs");
if (fs.existsSync(docsDir)) fs.cpSync(docsDir, path.join(APP_DIR, "docs"), { recursive: true });

if (fs.existsSync(ELECTRON_BIN)) fs.renameSync(ELECTRON_BIN, APP_BIN);
setPlist("CFBundleExecutable", APP_NAME);
setPlist("CFBundleName", APP_NAME);
setPlist("CFBundleDisplayName", APP_NAME);
setPlist("CFBundleIdentifier", "com.busypet.desktop");
if (fs.existsSync(ICON_ICNS)) {
  fs.copyFileSync(ICON_ICNS, path.join(RESOURCES_DIR, "BusyPet.icns"));
  setPlist("CFBundleIconFile", "BusyPet");
}
signApp();

removeDir(FINAL_OUT_DIR);
fs.mkdirSync(FINAL_OUT_DIR, { recursive: true });
execFileSync("ditto", [DEST_APP, FINAL_DEST_APP]);
execFileSync("codesign", ["--verify", "--deep", "--verbose=2", FINAL_DEST_APP], { stdio: "inherit" });

console.log(`Wrote new app to: ${path.relative(ROOT, FINAL_OUT_DIR)}`);
