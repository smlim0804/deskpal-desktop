const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const APP_NAME = "DeskPal";
const ARCH = process.env.DESKPAL_ARCH || process.arch;
const APP_PATH = path.join(ROOT, "dist", `${APP_NAME}-darwin-${ARCH}`, `${APP_NAME}.app`);
const RELEASE_DIR = path.join(ROOT, "release", "installers");
const OUTPUT = path.join(RELEASE_DIR, `DeskPal-macOS-${ARCH}.dmg`);

if (process.platform !== "darwin") {
  throw new Error("DMG packaging must run on macOS.");
}

if (!fs.existsSync(APP_PATH)) {
  throw new Error(`Missing macOS app at ${APP_PATH}. Run npm run package:mac first.`);
}

fs.mkdirSync(RELEASE_DIR, { recursive: true });
fs.rmSync(OUTPUT, { force: true });

// Stage the app next to an /Applications symlink so the DMG opens as a familiar
// "drag DeskPal into Applications" installer. Without this the app lands in
// Downloads (or stays on the read-only DMG) and never shows up in Spotlight.
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "deskpal-dmg-"));
try {
  execFileSync("ditto", [APP_PATH, path.join(stage, `${APP_NAME}.app`)], { stdio: "inherit" });
  fs.symlinkSync("/Applications", path.join(stage, "Applications"));

  execFileSync(
    "hdiutil",
    ["create", "-volname", APP_NAME, "-srcfolder", stage, "-ov", "-format", "UDZO", OUTPUT],
    { stdio: "inherit" },
  );
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}

console.log(`Wrote DMG: ${path.relative(ROOT, OUTPUT)}`);
