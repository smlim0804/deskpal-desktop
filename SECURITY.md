# Security Notes

- This desktop MVP does not use API keys, accounts, or remote AI servers.
- Ollama chat is local-only and restricted to `localhost`, `127.0.0.1`, or `::1`.
- Settings are stored locally in Electron's `userData` directory as `settings.json`.
- Shortcut opening is restricted to `http://` and `https://` URLs.
- Renderer processes use `contextIsolation: true` and do not enable `nodeIntegration`.
- The preload script exposes only the small IPC surface needed by the app.
- The app does not read screen contents, browser tabs, files, passwords, or page text.

Future AI features should keep API keys out of renderer code and should never send screen contents without an explicit user-controlled permission flow.
