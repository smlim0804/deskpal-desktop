const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const APP_NAME = "BusyPet Desktop";
const ARCH = process.env.BUSYPET_ARCH || process.arch;
const OUT_DIR = path.join(ROOT, "dist", `${APP_NAME}-darwin-${ARCH}`);
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

function copyFile(fileName) {
  fs.copyFileSync(path.join(ROOT, fileName), path.join(APP_DIR, fileName));
}

function setPlist(key, value) {
  execFileSync("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, PLIST]);
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

  execFileSync("xattr", ["-cr", DEST_APP], { stdio: "inherit" });
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

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
execFileSync("ditto", [ELECTRON_APP, DEST_APP]);

fs.rmSync(APP_DIR, { recursive: true, force: true });
fs.mkdirSync(APP_DIR, { recursive: true });
copyFile("package.json");
copyFile("README.md");
copyFile("SECURITY.md");
fs.cpSync(path.join(ROOT, "src"), path.join(APP_DIR, "src"), { recursive: true });
const docsDir = path.join(ROOT, "docs");
if (fs.existsSync(docsDir)) fs.cpSync(docsDir, path.join(APP_DIR, "docs"), { recursive: true });

if (fs.existsSync(ELECTRON_BIN)) fs.renameSync(ELECTRON_BIN, APP_BIN);
setPlist("CFBundleExecutable", APP_NAME);
setPlist("CFBundleName", APP_NAME);
setPlist("CFBundleDisplayName", APP_NAME);
setPlist("CFBundleIdentifier", "com.busypet.desktop");
signApp();

console.log(`Wrote new app to: ${path.relative(ROOT, OUT_DIR)}`);
