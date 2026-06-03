# Security Notes

- This desktop MVP does not use API keys, accounts, or remote AI servers.
- The main branch does not expose AI chat, provider login, CLI detection, or screen-awareness features.
- Settings are stored locally in Electron's `userData` directory as `settings.json`.
- Care-game stats such as level, XP, mood, Growth Path input activity counts, bond perk unlock progress, Caretaker Rank inputs derived from local growth stats, Pet Synergy inputs derived from local friendship/team stats, Life Story chapter progress derived from local care stats, pet walk counts, training yard counts, patrol route counts, mood aura check counts, Talent School practice counts/levels, Tiny Jobs run counts/reputation progress, Focus Mode session counts/minutes/active timer state, bond, toy inventory, equipped toys, equipped-toy play counts/mastery progress, desktop toy-object counts, trail effect inventory/equipped effects/style counts, charm inventory/equipped charm/charm craft counts, equipped league medal, medal challenge counts, egg nursery warmth/hatch counts, snack pantry counts/favorite-snack counts, pet album registration/best-level records, mini-game counts/best scores, Pixel Room habitat inventory/layout/theme, room-play counts, room-event counts, discovery collections, time/season ambient event counts, daily streak counts/claim day, league season points/claimed tiers/best points, daily care request state/counts, care combo state/counts, care routine state/counts, command training counts, evolution form claim counts, special-move counts, claimed growth milestones, friendship scores, playdate counts, duo move counts, team event counts, pet contest counts/best scores, and short memory logs are stored locally with the settings file.
- Shortcut opening is restricted to `http://` and `https://` URLs.
- Renderer processes use `contextIsolation: true` and do not enable `nodeIntegration`.
- The preload script exposes only the small IPC surface needed by the app.
- The app does not read screen contents, browser tabs, files, passwords, or page text.

Future AI features should stay opt-in, keep API keys out of renderer code, and never send screen contents without an explicit user-controlled permission flow.
