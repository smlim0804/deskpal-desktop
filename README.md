# BusyPet Desktop

Desktop version of BusyPet. It runs as a transparent always-on-top overlay, so pixel companions can walk around the computer screen instead of only inside Chrome.

## Run

```bash
cd /Users/limsungmin/Desktop/codex_product/busypet_desktop
npm install
npm start
```

To create double-clickable app folders:

```bash
cd /Users/limsungmin/Desktop/codex_product/busypet_desktop
npm run check
npm run package:mac
npm run package:win
npm run package:linux
npm run package:linux:arm64
```

Ubuntu installer:

```bash
cd /Users/limsungmin/Desktop/codex_product/busypet_desktop
npm run release:ubuntu
npm run release:ubuntu:arm64
```

Outputs:

```text
dist/BusyPet Desktop-darwin-arm64/BusyPet Desktop.app
dist/BusyPet Desktop-win32-x64/BusyPet Desktop.exe
dist/BusyPet Desktop-linux-x64/busypet-desktop
dist/BusyPet Desktop-linux-arm64/busypet-desktop
release/BusyPet-Desktop-Ubuntu-x64.deb
release/BusyPet-Desktop-Ubuntu-arm64.deb
```

On this Mac:

```bash
open "/Users/limsungmin/Desktop/codex_product/busypet_desktop/dist/BusyPet Desktop-darwin-arm64/BusyPet Desktop.app"
```

macOS downloaded release:

- A normal double-click install requires Apple Developer ID signing and notarization.
- GitHub Actions will notarize the app automatically when these repository secrets are configured:
  `APPLE_CERTIFICATE_BASE64`, `APPLE_CERTIFICATE_PASSWORD`, `MACOS_KEYCHAIN_PASSWORD`,
  `MACOS_CODESIGN_IDENTITY`, `APPLE_ID`, `APPLE_TEAM_ID`, and `APPLE_APP_PASSWORD`.
- For local testing of an unsigned download only:

```bash
xattr -dr com.apple.quarantine "/Applications/BusyPet Desktop.app"
open "/Applications/BusyPet Desktop.app"
```

Ubuntu/Linux:

```bash
chmod +x "dist/BusyPet Desktop-linux-x64/busypet-desktop"
"dist/BusyPet Desktop-linux-x64/busypet-desktop"
```

Ubuntu 22.04 easiest install:

1. Check the Ubuntu CPU type with `dpkg --print-architecture`.
2. Download `BusyPet-Desktop-Ubuntu-x64.deb` for `amd64`, or `BusyPet-Desktop-Ubuntu-arm64.deb` for `arm64`.
   UTM on Apple Silicon Macs is usually `arm64`.
3. Double-click it.
4. Press Install.
5. Open `BusyPet Desktop` from Activities.

Terminal install:

```bash
cd ~/Downloads
sudo apt update
sudo apt install ./BusyPet-Desktop-Ubuntu-arm64.deb
busypet-desktop
```

Use `BusyPet-Desktop-Ubuntu-x64.deb` instead if `dpkg --print-architecture` prints `amd64`.

Windows:

```powershell
& ".\dist\BusyPet Desktop-win32-x64\BusyPet Desktop.exe"
```

The app opens two windows:

- Transparent overlay: the companions roam on top of the desktop.
- Settings window: change FPS, each character, speed, size, mouse behavior, effect, and shortcuts.

## Current MVP

- Desktop transparent overlay
- Eight character slots
- Per-character settings
- Custom pixel character editor with 24x24 dot grid or transparent image import
- Custom effect anchor defaults to a downward Y+ trail when placed, with X/Y axis and coordinate preview
- Add custom sprites to the bottom of the custom list from the Pixel Maker
- Tabbed settings sections for characters, custom sprites, and links
- English and Korean settings UI from the globe menu
- Per-character heading mode: smart turn, free turn, or fixed
- Per-character custom movement area by drawing directly on the screen
- Smoother requestAnimationFrame-based roaming motion
- Direction-aware rotation for moving objects
- Original character set: UFO, Sports Car, Slime, Comet, Twinkle Star, Rocket, Saturn, Gem, Donut, Skull, Eyeball, Energy Orb, Roach, and Tank
- Rainbow, glow, spark, bubble, and pixel trails
- Click a character to open website or local app shortcuts
- Shortcut image picker and global display modes: image + name, image only, or name only
- Optional bring-your-own AI chat through a logged-in local CLI: Codex CLI, Claude Code CLI, or Ollama
- No API key is stored inside BusyPet

## Files

- `src/main.cjs`: Electron app, overlay window, settings window, local settings store
- `src/preload.cjs`: secure IPC bridge
- `src/overlay.html`, `src/overlay.css`, `src/overlay.js`: desktop overlay and motion engine
- `src/settings.html`, `src/settings.css`, `src/settings.js`: settings UI, pixel editor, shortcuts editor
- `src/characters.js`: pixel character renderer copied from the RunCat-style reference and adjusted for English names

## Notes

The overlay uses Electron click-through mode. It only captures the mouse while the cursor is over a character or a panel, so normal desktop clicks should pass through everywhere else.

To draw a movement area, open Settings, pick a character slot, press `Draw` beside `Area`, then drag a rectangle on the screen. The slot switches to `Custom` automatically.

Shortcuts support two target types:

- `Web`: opens an `http` or `https` URL.
- `App`: opens a safe local app path for the current OS.
  macOS supports `.app` inside `/Applications`, `/System/Applications`, or `~/Applications`.
  Windows supports `.exe` or `.lnk` inside Program Files, AppData, or the Start Menu.
  Linux supports `.desktop` files or executables inside `/usr`, `/opt`, `~/.local/share/applications`, or `~/bin`.

AI chat is optional and uses the user's own local login:

- Codex CLI: install with `npm install -g @openai/codex`, then run `codex` and sign in.
- Claude Code CLI: install with `npm install -g @anthropic-ai/claude-code`, then run `claude` and sign in.
- Ollama: install Ollama, run `ollama pull llama3.2`, then keep `ollama serve` running.

In BusyPet Settings, open `AI`, choose the provider, press `Detect`, turn on `Character chat`, and click a character to chat. BusyPet only calls the local CLI process; it does not collect or save provider passwords, OAuth tokens, API keys, or chat credentials.
