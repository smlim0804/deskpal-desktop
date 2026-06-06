# DeskPal

Desktop version of DeskPal. It runs as a transparent always-on-top overlay, so pixel companions can walk around the computer screen instead of only inside Chrome.

DeskPal is the open-source desktop edition of the original BusyPet idea: small pixel companions, local customization, and shortcut helpers that stay on the user's own computer. The default app does not include cloud AI, prompt boxes, API keys, or screen-reading features.

## Open source

- License: MIT
- Repository: https://github.com/smlim0804/deskpal-desktop
- Primary maintainer: Sungmin Lim (`smlim0804`)
- Security notes: see `SECURITY.md`
- Contributing guide: see `CONTRIBUTING.md`

The project is built to be safe for local-first desktop use. It stores settings locally, exposes a small Electron preload IPC surface, and keeps shortcut opening restricted to safe web URLs or OS-specific app paths.

## Run

```bash
cd /Users/limsungmin/Desktop/codex_product/deskpal_desktop
npm install
npm start
```

To create local double-clickable app folders:

```bash
cd /Users/limsungmin/Desktop/codex_product/deskpal_desktop
npm run check
npm run package:mac
npm run package:win
```

To create public installer files for releases:

```bash
cd /Users/limsungmin/Desktop/codex_product/deskpal_desktop
npm run installer:desktop
```

Outputs:

```text
dist/DeskPal-darwin-arm64/DeskPal.app
dist/DeskPal-win32-x64/DeskPal.exe
release/installers/DeskPal-macOS-arm64.dmg
release/installers/DeskPal-Windows-x64.exe
```

On this Mac:

```bash
open "/Users/limsungmin/Desktop/codex_product/deskpal_desktop/dist/DeskPal-darwin-arm64/DeskPal.app"
```

macOS downloaded release:

- A normal double-click install requires Apple Developer ID signing and notarization.
- GitHub Actions will notarize the app automatically when these repository secrets are configured:
  `APPLE_CERTIFICATE_BASE64`, `APPLE_CERTIFICATE_PASSWORD`, `MACOS_KEYCHAIN_PASSWORD`,
  `MACOS_CODESIGN_IDENTITY`, `APPLE_ID`, `APPLE_TEAM_ID`, and `APPLE_APP_PASSWORD`.
- For local testing of an unsigned download only:

```bash
xattr -dr com.apple.quarantine "/Applications/DeskPal.app"
open "/Applications/DeskPal.app"
```

Windows:

```powershell
& ".\dist\DeskPal-win32-x64\DeskPal.exe"
```

The app opens two windows:

- Transparent overlay: the companions roam on top of the desktop.
- Settings window: change FPS, each character, speed, size, mouse behavior, effect, and shortcuts.

Public releases are intentionally macOS + Windows only right now:

- macOS: `DeskPal-macOS-arm64.dmg`
- Windows: `DeskPal-Windows-x64.exe`

Older Linux packaging scripts are kept in the repo for experimentation, but Linux artifacts should not be uploaded to public releases unless the Linux click-through behavior is tested again.

## Commerce and updates

DeskPal uses `https://www.aidogam.com/api/deskpal-license` for license activation and `https://api.github.com/repos/smlim0804/deskpal-downloads/releases/latest` for update checks.

Free limits are enforced in `src/main.cjs`:

- up to 2 enabled character slots
- 1 web shortcut
- 1 app shortcut
- no custom characters
- no effects

Pro unlocks those limits after a valid license key is activated. The owner's machine is auto-unlocked through the `owner-status` API action.

Release flow:

```bash
npm run check
npm run installer:desktop
gh release create vX.Y.Z \
  release/installers/DeskPal-macOS-arm64.dmg \
  release/installers/DeskPal-Windows-x64.exe \
  -R smlim0804/deskpal-downloads \
  --title "DeskPal vX.Y.Z" \
  --notes "macOS DMG and Windows EXE only."
npm run verify:launch
```

The overlay update badge appears when the public release version is newer than the app's `package.json` version.

## Current MVP

- Transparent desktop overlay where pixel companions roam outside the browser
- Smooth requestAnimationFrame-based movement with per-character speed, size, mouse behavior, heading mode, and movement area settings
- Original pixel character set: UFO, Sports Car, Slime, Comet, Twinkle Star, Bori Pup, Miso Kit, Nari Bun, Tori Fox, Dubu Ham, Rocket, Saturn, Gem, Donut, Skull, Eyeball, Energy Orb, Roach, and Tank
- Custom pixel character editor with a 24x24 dot grid or transparent image import
- Per-character trail/effect settings, including adjustable effect anchors and preview coordinates
- Web and local app shortcuts opened directly from a character panel
- Shortcut image picker and global display modes: image + name, image only, or name only
- Lightweight benchmarking/status bubbles for local system information such as CPU and RAM usage
- English and Korean settings UI from the globe menu
- FPS controls and reduced-work idle behavior for smoother desktop performance
- macOS and Windows packaging scripts and release verification checks
- No cloud AI, no chat prompt, no API key, and no token usage in the default app
- Future AI direction: opt-in character intelligence where users explicitly connect their own provider or approved model, with clear permissions and no hidden screen upload

## Files

- `src/main.cjs`: Electron app, overlay window, settings window, safe shortcut opening, update checks, and local settings store
- `src/preload.cjs`: secure IPC bridge exposed to renderer code
- `src/overlay.html`, `src/overlay.css`, `src/overlay.js`: transparent desktop overlay, character rendering, motion engine, shortcut panel, and benchmarking/status bubbles
- `src/settings.html`, `src/settings.css`, `src/settings.js`: settings UI, character controls, custom pixel editor, effect anchors, shortcuts editor, and language switching
- `src/characters.js`: original pixel character renderer and built-in sprite definitions
- `src/interaction-variety.js`: procedural local status/companion text used without cloud AI
- `scripts/verify-bubble-position.cjs`: verifies panel/bubble placement behavior
- `scripts/verify-care-system.cjs`: broad runtime regression verifier kept under its historical name
- `scripts/verify-launch-readiness.cjs`: release-readiness checks for packaging, update flow, shortcuts, and promotional UI

## Notes

The overlay uses Electron click-through mode. It only captures the mouse while the cursor is over a character or a panel, so normal desktop clicks should pass through everywhere else.

To draw a movement area, open Settings, pick a character slot, press `Draw` beside `Area`, then drag a rectangle on the screen. The slot switches to `Custom` automatically.

Shortcuts support two target types:

- `Web`: opens an `http` or `https` URL.
- `App`: opens a safe local app path for the current OS.
  macOS supports `.app` inside `/Applications`, `/System/Applications`, or `~/Applications`.
  Windows supports `.exe` or `.lnk` inside Program Files, AppData, or the Start Menu.
  Linux supports `.desktop` files or executables inside `/usr`, `/opt`, `~/.local/share/applications`, or `~/bin`.

The main branch is token-safe by default: there is no AI provider setup, no chat box, and no screen-sharing prompt. The old AI-enabled snapshot is preserved on the `ai-enabled-archive` branch.

The macOS/Linux app icon is generated from `build/icon.svg` with `npm run icons`; packaging scripts run this automatically so the app no longer uses the default Electron mark.
