const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main.cjs"), "utf8");

function assertMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    console.error(`CLI path invariant failed: ${message}`);
    process.exitCode = 1;
  }
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) return "";
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

const cliSearchDirectories = functionBody(main, "cliSearchDirectories");
const buildCliEnv = functionBody(main, "buildCliEnv");
const runCommand = functionBody(main, "runCommand");

assertMatch(cliSearchDirectories, /\.npm-global", "bin"/, "npm global bin must be searched for Codex CLI installs");
assertMatch(cliSearchDirectories, /"\/opt\/homebrew\/bin"/, "Homebrew ARM bin must be searched for node and CLIs");
assertMatch(cliSearchDirectories, /"\/usr\/local\/bin"/, "Homebrew Intel bin must be searched for node and CLIs");
assertMatch(cliSearchDirectories, /nvmNodeBinDirectories\(home\)/, "nvm node bins must be searched for npm-installed CLIs");
assertMatch(buildCliEnv, /PATH: mergedPath/, "CLI commands must run with the expanded PATH");
assertMatch(runCommand, /env: options\.env \|\| buildCliEnv\(\)/, "AI CLI execution must use the expanded CLI env");

if (!process.exitCode) console.log("CLI path invariants passed.");
