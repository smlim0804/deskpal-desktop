const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");
const extractZip = require("extract-zip");

const ROOT = path.resolve(__dirname, "..");
const APP_NAME = "BusyPet Desktop";
const APP_ID = "com.busypet.desktop";
const DIST_DIR = path.join(ROOT, "dist");
const CACHE_DIR = path.join(ROOT, ".cache", "electron");
const ELECTRON_VERSION = require("electron/package.json").version;

const TARGETS = {
  "win32-x64": {
    platform: "win32",
    arch: "x64",
    outName: `${APP_NAME}-win32-x64`,
    executable: `${APP_NAME}.exe`,
    sourceExecutable: "electron.exe",
  },
  "linux-x64": {
    platform: "linux",
    arch: "x64",
    outName: `${APP_NAME}-linux-x64`,
    executable: "busypet-desktop",
    sourceExecutable: "electron",
  },
  "linux-arm64": {
    platform: "linux",
    arch: "arm64",
    outName: `${APP_NAME}-linux-arm64`,
    executable: "busypet-desktop",
    sourceExecutable: "electron",
  },
};

function targetFromArg(arg) {
  if (arg === "win" || arg === "windows") return "win32-x64";
  if (arg === "linux" || arg === "ubuntu") return "linux-x64";
  if (arg === "linux-arm" || arg === "ubuntu-arm" || arg === "ubuntu-arm64") return "linux-arm64";
  return arg;
}

function selectedTargets() {
  const args = process.argv.slice(2).map(targetFromArg);
  const targets = args.length ? args : ["linux-x64"];
  if (targets.includes("all")) return Object.keys(TARGETS);
  for (const target of targets) {
    if (!TARGETS[target]) {
      throw new Error(`Unknown target "${target}". Use win32-x64, linux-x64, linux-arm64, win, linux, ubuntu, ubuntu-arm64, or all.`);
    }
  }
  return targets;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(fileName, appDir) {
  const source = path.join(ROOT, fileName);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(appDir, fileName));
}

function copyApp(appDir) {
  fs.rmSync(appDir, { recursive: true, force: true });
  ensureDir(appDir);
  copyFile("package.json", appDir);
  copyFile("README.md", appDir);
  copyFile("SECURITY.md", appDir);
  fs.cpSync(path.join(ROOT, "src"), path.join(appDir, "src"), { recursive: true });
  const docsDir = path.join(ROOT, "docs");
  if (fs.existsSync(docsDir)) fs.cpSync(docsDir, path.join(appDir, "docs"), { recursive: true });
}

function electronZipName(target) {
  return `electron-v${ELECTRON_VERSION}-${target.platform}-${target.arch}.zip`;
}

function electronZipUrl(target) {
  const mirror = process.env.ELECTRON_MIRROR || "https://github.com/electron/electron/releases/download";
  return `${mirror.replace(/\/$/, "")}/v${ELECTRON_VERSION}/${electronZipName(target)}`;
}

function download(url, destination, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error(`Too many redirects while downloading ${url}`));
      return;
    }

    const request = https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.resume();
        if (!location) {
          reject(new Error(`Redirect from ${url} did not include a Location header.`));
          return;
        }
        download(new URL(location, url).toString(), destination, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${response.statusCode}: ${url}`));
        return;
      }

      ensureDir(path.dirname(destination));
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
      file.on("error", reject);
    });

    request.on("error", reject);
  });
}

async function ensureElectronZip(target) {
  const zipPath = path.join(CACHE_DIR, electronZipName(target));
  if (fs.existsSync(zipPath) && fs.statSync(zipPath).size > 0) return zipPath;
  const partialPath = `${zipPath}.download`;
  fs.rmSync(partialPath, { force: true });
  console.log(`Downloading ${electronZipName(target)}...`);
  await download(electronZipUrl(target), partialPath);
  fs.renameSync(partialPath, zipPath);
  return zipPath;
}

function renameExecutable(outDir, target) {
  const from = path.join(outDir, target.sourceExecutable);
  const to = path.join(outDir, target.executable);
  if (!fs.existsSync(from)) throw new Error(`Electron executable not found: ${from}`);
  fs.rmSync(to, { force: true });
  fs.renameSync(from, to);
  if (target.platform === "linux") fs.chmodSync(to, 0o755);
}

function writeLinuxDesktopFile(outDir) {
  const desktopFile = [
    "[Desktop Entry]",
    "Type=Application",
    `Name=${APP_NAME}`,
    "Comment=Desktop pixel companions",
    "Exec=busypet-desktop",
    "Terminal=false",
    "Categories=Utility;",
    `StartupWMClass=${APP_ID}`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "busypet-desktop.desktop"), desktopFile);
}

async function packageTarget(targetName) {
  const target = TARGETS[targetName];
  const outDir = path.join(DIST_DIR, target.outName);
  const appDir = path.join(outDir, "resources", "app");
  const zipPath = await ensureElectronZip(target);

  fs.rmSync(outDir, { recursive: true, force: true });
  ensureDir(outDir);
  await extractZip(zipPath, { dir: outDir });
  copyApp(appDir);
  renameExecutable(outDir, target);
  if (target.platform === "linux") writeLinuxDesktopFile(outDir);

  console.log(`Wrote ${targetName}: ${path.relative(ROOT, outDir)}`);
}

(async () => {
  ensureDir(DIST_DIR);
  for (const targetName of selectedTargets()) {
    await packageTarget(targetName);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
