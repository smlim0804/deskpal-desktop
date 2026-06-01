# Security Notes

- This desktop MVP does not use API keys, accounts, or remote AI servers.
- The main branch does not expose AI chat, provider login, CLI detection, or screen-awareness features.
- Settings are stored locally in Electron's `userData` directory as `settings.json`.
- Shortcut opening is restricted to `http://` and `https://` URLs.
- Renderer processes use `contextIsolation: true` and do not enable `nodeIntegration`.
- The preload script exposes only the small IPC surface needed by the app.
- The app does not read screen contents, browser tabs, files, passwords, or page text.

Future AI features should stay opt-in, keep API keys out of renderer code, and never send screen contents without an explicit user-controlled permission flow.
