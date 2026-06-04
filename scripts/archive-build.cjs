const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const RELEASE_DIR = path.join(ROOT, "release");

const TARGETS = {
  mac: {
    folderPrefix: "DeskPal Desktop-darwin-",
    output: "DeskPal-Desktop-macOS-arm64.zip",
    archive: archiveMacZip,
  },
  win: {
    folder: "DeskPal Desktop-win32-x64",
    output: "DeskPal-Desktop-Windows-x64.zip",
    archive: archiveGenericZip,
  },
  linux: {
    folder: "DeskPal Desktop-linux-x64",
    output: "DeskPal-Desktop-Ubuntu-x64.tar.gz",
    archive: archiveTarGz,
  },
  "linux-arm64": {
    folder: "DeskPal Desktop-linux-arm64",
    output: "DeskPal-Desktop-Ubuntu-arm64.tar.gz",
    archive: archiveTarGz,
  },
};

function selectedTarget() {
  const arg = process.argv[2] || "";
  const normalized = arg === "windows" ? "win" : arg === "ubuntu" ? "linux" : arg === "ubuntu-arm64" ? "linux-arm64" : arg;
  if (!TARGETS[normalized]) throw new Error("Use one of: mac, win, linux, linux-arm64, windows, ubuntu, ubuntu-arm64.");
  return normalized;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function folderFor(target) {
  if (target.folder) return target.folder;
  const match = fs
    .readdirSync(DIST_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(target.folderPrefix))
    .map((entry) => entry.name)
    .sort()
    .pop();
  if (!match) throw new Error(`Could not find dist folder starting with ${target.folderPrefix}`);
  return match;
}

function archiveMacZip(folder, outputPath) {
  const appName = "DeskPal Desktop.app";
  const appPath = path.join(DIST_DIR, folder, appName);
  if (!fs.existsSync(appPath)) throw new Error(`Missing macOS app: ${appPath}`);
  execFileSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appName, outputPath], {
    cwd: path.join(DIST_DIR, folder),
    stdio: "inherit",
  });
}

function archiveGenericZip(folder, outputPath) {
  if (process.platform === "win32") {
    const source = path.join(DIST_DIR, folder, "*");
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path ${JSON.stringify(source)} -DestinationPath ${JSON.stringify(outputPath)} -Force`,
      ],
      { stdio: "inherit" },
    );
    return;
  }
  execFileSync("ditto", ["-c", "-k", "--keepParent", folder, outputPath], {
    cwd: DIST_DIR,
    stdio: "inherit",
  });
}

function archiveTarGz(folder, outputPath) {
  execFileSync("tar", ["-czf", outputPath, "-C", DIST_DIR, folder], { stdio: "inherit" });
}

function main() {
  const targetName = selectedTarget();
  const target = TARGETS[targetName];
  const folder = folderFor(target);
  const outputPath = path.join(RELEASE_DIR, target.output);

  ensureDir(RELEASE_DIR);
  fs.rmSync(outputPath, { force: true });
  target.archive(folder, outputPath);
  console.log(`Wrote release archive: ${path.relative(ROOT, outputPath)}`);
}

main();
