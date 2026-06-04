const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PACKAGE_JSON = require("../package.json");
const DIST_DIR = path.join(ROOT, "dist");
const RELEASE_DIR = path.join(ROOT, "release");
const TARGET_ARCH = architectureFromArg(process.argv[2]);
const SOURCE_DIR = path.join(DIST_DIR, `DeskPal Desktop-linux-${TARGET_ARCH.releaseSuffix}`);
const PACKAGE_ROOT = path.join(DIST_DIR, "deb", `deskpal-desktop-${TARGET_ARCH.debArch}`);
const INSTALL_DIR = path.join(PACKAGE_ROOT, "opt", "deskpal-desktop");
const DESKTOP_DIR = path.join(PACKAGE_ROOT, "usr", "share", "applications");
const ICON_DIR = path.join(PACKAGE_ROOT, "usr", "share", "icons", "hicolor", "scalable", "apps");
const BIN_DIR = path.join(PACKAGE_ROOT, "usr", "bin");
const DEBIAN_DIR = path.join(PACKAGE_ROOT, "DEBIAN");
const OUTPUT = path.join(RELEASE_DIR, `DeskPal-Desktop-Ubuntu-${TARGET_ARCH.releaseSuffix}.deb`);

const DESKTOP_FILE = [
  "[Desktop Entry]",
  "Type=Application",
  "Name=DeskPal Desktop",
  "Comment=Desktop pixel companions",
  "Exec=/opt/deskpal-desktop/deskpal-desktop",
  "Icon=deskpal-desktop",
  "Terminal=false",
  "Categories=Utility;",
  "StartupWMClass=com.deskpal.desktop",
  "",
].join("\n");

const ICON_SVG = fs.readFileSync(path.join(ROOT, "build", "icon.svg"), "utf8");

function architectureFromArg(arg = "x64") {
  const normalized = (arg || "x64").toLowerCase();
  if (["x64", "amd64", "linux", "ubuntu"].includes(normalized)) {
    return { debArch: "amd64", releaseSuffix: "x64", packageScript: "npm run package:linux" };
  }
  if (["arm64", "aarch64", "linux-arm64", "ubuntu-arm64", "linux-arm", "ubuntu-arm"].includes(normalized)) {
    return { debArch: "arm64", releaseSuffix: "arm64", packageScript: "npm run package:linux:arm64" };
  }
  throw new Error("Use one of: x64, amd64, arm64, aarch64, ubuntu, or ubuntu-arm64.");
}

function ensureLinuxHost() {
  if (process.platform !== "linux") {
    throw new Error("Ubuntu .deb packages must be built on Linux. GitHub Actions will build this automatically.");
  }
}

function ensureDpkgDeb() {
  try {
    execFileSync("dpkg-deb", ["--version"], { stdio: "ignore" });
  } catch {
    throw new Error("dpkg-deb was not found. Install dpkg-dev or build this on Ubuntu/GitHub Actions.");
  }
}

function ensureSourceDist() {
  if (!fs.existsSync(path.join(SOURCE_DIR, "deskpal-desktop"))) {
    throw new Error(`Missing Linux app folder for ${TARGET_ARCH.debArch}. Run ${TARGET_ARCH.packageScript} before npm run package:deb.`);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, contents, mode = 0o644) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents);
  fs.chmodSync(filePath, mode);
}

function chmodDirectories(rootDir) {
  fs.chmodSync(rootDir, 0o755);
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) chmodDirectories(entryPath);
  }
}

function markExecutable(relativePath) {
  const filePath = path.join(INSTALL_DIR, relativePath);
  if (fs.existsSync(filePath) && !fs.lstatSync(filePath).isSymbolicLink()) {
    fs.chmodSync(filePath, 0o755);
  }
}

function writeControlFile() {
  const control = [
    "Package: deskpal-desktop",
    `Version: ${PACKAGE_JSON.version}`,
    "Section: utils",
    "Priority: optional",
    `Architecture: ${TARGET_ARCH.debArch}`,
    "Maintainer: smlim0804 <smlim0804@users.noreply.github.com>",
    "Depends: libgtk-3-0, libnss3, libxss1, libgbm1, libasound2 | libasound2t64, libatk-bridge2.0-0",
    "Description: Desktop pixel companions",
    " DeskPal Desktop adds small pixel companions that roam on top of the desktop.",
    "",
  ].join("\n");

  writeFile(path.join(DEBIAN_DIR, "control"), control);
}

function stagePackage() {
  fs.rmSync(PACKAGE_ROOT, { recursive: true, force: true });
  ensureDir(INSTALL_DIR);
  fs.cpSync(SOURCE_DIR, INSTALL_DIR, { recursive: true });

  chmodDirectories(PACKAGE_ROOT);
  markExecutable("deskpal-desktop");
  markExecutable("chrome-sandbox");
  markExecutable("chrome_crashpad_handler");

  writeControlFile();
  writeFile(path.join(DESKTOP_DIR, "deskpal-desktop.desktop"), DESKTOP_FILE);
  writeFile(path.join(ICON_DIR, "deskpal-desktop.svg"), ICON_SVG);

  ensureDir(BIN_DIR);
  const linkPath = path.join(BIN_DIR, "deskpal-desktop");
  fs.rmSync(linkPath, { force: true });
  fs.symlinkSync("/opt/deskpal-desktop/deskpal-desktop", linkPath);
}

function buildDeb() {
  ensureDir(RELEASE_DIR);
  fs.rmSync(OUTPUT, { force: true });
  execFileSync("dpkg-deb", ["--build", "--root-owner-group", PACKAGE_ROOT, OUTPUT], { stdio: "inherit" });
  console.log(`Wrote Ubuntu ${TARGET_ARCH.debArch} installer: ${path.relative(ROOT, OUTPUT)}`);
}

function main() {
  ensureLinuxHost();
  ensureDpkgDeb();
  ensureSourceDist();
  stagePackage();
  buildDeb();
}

main();
