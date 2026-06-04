const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const APP_NAME = "DeskPal Desktop";
const ARCH = process.env.DESKPAL_ARCH || process.arch;
const APP_PATH = path.join(ROOT, "dist", `${APP_NAME}-darwin-${ARCH}`, `${APP_NAME}.app`);
const RELEASE_DIR = path.join(ROOT, "release", "installers");
const OUTPUT = path.join(RELEASE_DIR, `DeskPal-Desktop-macOS-${ARCH}.dmg`);

if (process.platform !== "darwin") {
  throw new Error("DMG packaging must run on macOS.");
}

if (!fs.existsSync(APP_PATH)) {
  throw new Error(`Missing macOS app at ${APP_PATH}. Run npm run package:mac first.`);
}

fs.mkdirSync(RELEASE_DIR, { recursive: true });
fs.rmSync(OUTPUT, { force: true });

execFileSync(
  "hdiutil",
  ["create", "-volname", APP_NAME, "-srcfolder", APP_PATH, "-ov", "-format", "UDZO", OUTPUT],
  { stdio: "inherit" },
);

console.log(`Wrote DMG: ${path.relative(ROOT, OUTPUT)}`);
