# Contributing to DeskPal

Thanks for taking a look at DeskPal. This project is a local-first Electron desktop app for pixel companions, shortcuts, and lightweight companion-game systems.

## Good first areas

- Character movement, animation, and effect polishing
- UI accessibility and responsive settings layout fixes
- Shortcut safety and platform-specific app path handling
- Packaging improvements for macOS and Windows
- Tests for settings migration, free/pro limits, and overlay click-through behavior

## Local setup

```bash
npm install
npm run check
npm start
```

## Pull request checklist

- Keep the default app token-safe: no cloud AI, no API key prompts, and no screen content upload.
- Keep renderer code isolated from Node.js APIs.
- Run `npm run check` before opening a pull request.
- Update `README.md` or `SECURITY.md` when changing behavior that affects users, packaging, shortcuts, or data handling.

## Security-sensitive changes

Please be extra careful with Electron settings, preload APIs, shortcut launching, license activation, and update checks. If a change expands what the renderer can do, explain why it is needed and how it stays constrained.
