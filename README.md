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
release/BusyPet-Desktop-macOS-arm64.zip
release/BusyPet-Desktop-Windows-x64.zip
release/BusyPet-Desktop-Ubuntu-x64.tar.gz
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
2. Download `BusyPet-Desktop-Ubuntu-x64.tar.gz` for `amd64`.
3. Extract it.
4. Run `busypet-desktop`.

Terminal run:

```bash
cd ~/Downloads
tar -xzf BusyPet-Desktop-Ubuntu-x64.tar.gz
cd "BusyPet Desktop-linux-x64"
chmod +x busypet-desktop chrome_crashpad_handler
./busypet-desktop --no-sandbox
```

Linux `.deb` packages should be built on Linux or in GitHub Actions.

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
- Original character set: UFO, Sports Car, Slime, Comet, Twinkle Star, Bori Pup, Miso Kit, Nari Bun, Tori Fox, Dubu Ham, Rocket, Saturn, Gem, Donut, Skull, Eyeball, Energy Orb, Roach, and Tank
- Care-game system with level, XP, bond, hunger, happiness, energy, hygiene, training, mood, and growth stage per character slot
- Care actions from the character panel: feed, play, pet, clean, train, and nap
- Pet Walks with Garden Loop, Training Track, Snack Trail, and Night Stroll routes; animal companions get walk bonuses, favorite snacks and room comfort affect rewards, and walks add memories, daily quest progress, a Walk Leader growth goal, and a Walk Buddy badge
- Training Yard with Agility Tunnel, Recall Drill, Balance Beam, and Focus Hoops courses; runs spend energy, use animal/walk/medal/toy bonuses, trigger course-specific motion, add memories, daily quest progress, a Yard Trainer growth goal, and a Yard Trainer badge
- Patrol Routes with Edge Sweep, Cursor Trail, Icon Watch, and Cozy Round loops; patrols use procedural report text, route-specific motion, animal/walk/room/discovery bonuses, collection finds, daily quest progress, a Patrol Captain growth goal, and a Patrol Scout badge
- Daily companion requests generated from each pet's mood and personality, with one-tap care, bonus rewards, memories, a Good Listener growth goal, and a Good Listener badge
- Care Coach reads fullness, energy, cleanliness, joy, training, personality, habits, and animal instincts to show three safe one-tap care recommendations without using AI or extra tokens
- Tiny Moments add one-tap and low-frequency automatic procedural micro-events generated from mood, stage, personality, room theme, toys, and event type, with local rewards, memories, daily quest progress, and a Moment Maker badge
- Care combo routines such as Feed -> Play, Clean -> Pet, and Train -> Nap, with combo rewards, a Routine Keeper growth goal, a Combo Pal badge, and daily combo quest progress
- Care Routines with Morning Loop, Skill Drill, Cozy Reset, and Play Sprint, each using three visible care steps, local completion rewards, daily routine quest progress, a Routine Builder growth goal, and a Routine Builder badge
- Command Training with direct Come, Slow, Dash, Spin, Hide, and Orbit commands that move companions immediately, add command-tail effects, give local rewards, progress daily command quests, unlock a Command Trainer growth goal, and award a Command Trainer badge
- Evolution Forms with Sprout, Buddy, Ace, and Signature stages unlocked from level, bond, training, growth path score, commands, and tricks; each form gives one-time local rewards, desktop glow feedback, a Form Ascent growth goal, and a Form Keeper badge
- Personality system with Curious, Playful, Cozy, Brave, Tidy, Clever, and Gentle temperaments that affect liked care actions, movement pace, social behavior, growth progress, and the Good Match badge
- Growth Path system that derives Explorer, Scholar, Cozy, or Star identity from each pet's actual care, room, focus, mission, toy, mini-game, and social history, including path meters, movement flavor, a Growth Path goal, and a Growth Path badge
- Growth Rewards add a per-pet reward ladder for care count, level, bond, training, growth path, habits, mood patterns, and story chapters, with local claim rewards, unlocked movement/XP/care/burst effects, and a Growth Rewards badge
- Care Quirks unlock automatically from each pet's raising history, adding personality-like movement, XP, care, burst, idle speech, and occasional autonomous reactions with a Quirk Keeper badge
- Care Quirk Combos activate when multiple raising quirks match, adding combo movement, XP, care, burst, autonomous reactions, a Growth tab combo panel, and a Quirk Combos badge
- Raising Skills unlock from repeated feeding, play, petting, cleaning, training, rest, routing, and room care, adding light movement/XP/care/burst effects and a Raising Skills badge
- Mood Patterns convert repeated mood reads, care actions, Tiny Moments, and room/social actions into per-pet pattern progress with tiny movement, XP, and care bonuses plus a Mood Pattern goal and badge
- Pet Habits unlock from repeated feeding, play, petting, cleaning, training, and rest routines; active habits add small movement, XP, and care bonuses with a Habit Keeper goal and badge
- Animal Instincts give Bori Pup, Miso Kit, Nari Bun, Tori Fox, and Dubu Ham species-specific growth from walks, patrols, play, snacks, and training, with small passive bonuses and an Instinct Pal badge
- Bond Perks unlock from level, bond, training, room comfort, patrols, and collections; active perks add small movement, XP, and care bonuses, show progress in their own panel, and unlock a Perk Keeper growth goal and badge
- Caretaker Rank aggregates all local pet slots, levels, bonds, training, care counts, room comfort, collections, medals, perks, and claimed goals into an account-style rank with a visible progress card, small XP bonus, a Pixel Mentor badge, and a Caretaker Rank growth goal
- Time and season ambient events that react to dawn, morning, afternoon, evening, night, spring, summer, autumn, and winter with small local rewards, memories, a Vibe Watcher growth goal, and a Vibe Pal badge
- Character-specific special moves for every built-in companion, including warps, boosts, pounces, hops, scans, crawls, and charges with real motion, effects, local rewards, daily quest progress, a Signature Spark growth goal, and a Signature Star badge
- Trainable trick system with unlockable Hop, Spin, Dash, Circle, Seek, and Parade actions
- Tricks use the motion engine directly, spend energy, reward XP/bond/joy, create memories, and can unlock the Trick Star badge
- Per-trick mastery system with progress bars, mastery-up rewards, a Trick Master growth goal, and a Master Trainer badge
- Expedition mission board with Garden Walk, Skyline Scout, Buddy Patrol, and Treasure Route
- Expeditions spend energy and can reward coins, XP, training, discovery collection entries, friendship points, daily quest progress, and the Explorer badge
- Daily quests with coin rewards for care actions
- Daily streak card with once-per-day local rewards, best-streak tracking, a Steady Pal growth goal, and a Steady Pal badge
- Long-term growth goals with claimable local rewards for leveling, bonding, training, collecting, friendships, tricks, missions, memories, streaks, and daily clears
- Pixel Room habitat system with buyable room items, six placement slots, comfort score, selectable room themes, item set bonuses, room-play rewards, rest rewards based on placed items, a Room Rhythm growth goal, and a Room Buddy badge
- Room Events with item-combo activities such as Plant Care, Study Session, Cozy Reset, Snack Picnic, Window Watch, and Lamp Focus, including local rewards, discovery chances, daily room-event quest progress, a Room Host growth goal, and a Room Host badge
- Charm Workshop with craftable Lucky Leaf, Focus Gem, Cozy Shell, and Rainbow Pin charms made from discovery materials, per-pet charm equipment, passive movement/care/discovery bonuses, daily charm quest progress, a Charm Maker growth goal, and a Charm Maker badge
- Toy Box with coin purchases, per-slot toy equipment, movement/stat bonuses, equipped-toy play, per-toy mastery, toy motion effects, daily toy quest progress, a Toy Buddy growth goal, and a Toy Buddy badge
- Trail Studio with unlockable Mint, Spark, Bubble, Pixel Pop, and Rainbow Tail effects, per-character trail equipment, local rewards, daily style quest progress, a Trail Shelf growth goal, and a Trail Stylist badge
- Egg Nursery with warmth progress, energy cost, animal hatching into open slots, fallback bonus rewards when slots are full, daily nursery quest progress, a Nest Keeper growth goal, and a Nest Keeper badge
- Snack Pantry with purchasable snacks, character-specific favorite treats, serve rewards, local pantry counts, daily snack quest progress, a Snack Chef growth goal, and a Snack Chef badge
- Pet Album that automatically registers enabled, cared-for, and hatched companions with best-level records, favorite snack hints, a Pet Album growth goal, and a Pet Album badge
- Mood Aura system that reads each companion's current mood, adds transparent non-rectangular glow feedback on the desktop sprite, grants small local rewards, records memories, progresses a Mood Reader growth goal, and can appear in daily quests
- Talent School with Agility, Focus, and Charm practice paths, per-talent levels, progress meters, energy/training requirements, motion reactions, local rewards, a Talent School growth goal, and a Talent Grad badge
- Tiny Jobs board with Pocket Scout, Desk Helper, and Joy Show work loops tied to talent paths, reputation progress, local rewards, discovery finds, daily job quest progress, a Tiny Worker growth goal, and a Tiny Worker badge
- Focus Mode with 5/15/25 minute local work sprints, per-pet focus completion counts/minutes, capped local rewards, daily focus quest progress, a Focus Buddy growth goal, and a Focus Buddy badge
- Mini Games panel with Star Catch, Bubble Dodge, and Memory Steps, including per-character best scores, score-based rewards, motion effects, daily mini-game quest progress, an Arcade Champ growth goal, and an Arcade Pal badge
- Desktop Toys with throw-and-catch objects such as Bounce Ball, Treat Drop, Spark Star, and Bubble Pop; companions chase the pixel object on the desktop, catch it for local rewards, daily toy-catch quest progress, a Desktop Play growth goal, and a Desk Toy Pal badge
- Achievement badges for first care, leveling, bonding, training, daily clears, and toy ownership
- Procedural interaction engine with thousands of social/discovery text combinations from mood, growth stage, toys, and character pairings
- Autonomous discovery events that reward coins, XP, bond, and memories while companions roam
- Persistent friendship scores between active companions, with friend levels shown in the character panel
- Manual Playdate buttons in the friends panel, with energy cost, friendship boosts, daily social quest progress, memories, a Playdate Host growth goal, and a Playdate Host badge
- Pet Synergy reads each pet's best friend, friendship score, training, commands, routines, patrols, collections, duo moves, team events, and Caretaker Rank to unlock Buddy Spark, Study Echo, Cozy Nest, Scout Pack, and Parade Sync passive bonuses with a Synergy Keeper growth goal and badge
- Life Story chapters turn each pet's local care, bond, memories, training, commands, room comfort, collections, synergies, growth path, evolution forms, and special moves into visible story progress, with a Story Archivist growth goal and badge
- Duo Moves that unlock from friendship thresholds, letting two active companions perform Buddy Dash, Study Pair, Snack Share, and Star Parade for shared rewards, daily duo quest progress, memories, a Duo Rhythm growth goal, and a Duo Buddy badge
- Team Events that gather multiple active companions for Garden Sweep, Edge Scout, Sync Drill, and Pixel Parade, with shared motion, local rewards, friendship boosts, discovery chances, daily team quest progress, a Pack Leader growth goal, and a Pack Leader badge
- Pet League contests with Sprint Circuit, Cozy Show, Trick Stage, and Friend Relay; contest scores come from actual care stats, training, tricks, commands, friendships, duo moves, and team events, with local prizes, best-score tracking, daily contest quest progress, a League Champ growth goal, and a League Champ badge
- League Season rewards that turn contest scores into monthly local season points, unlock Warmup/Bronze/Gold/Master chests, track best season points, and add a Season Shelf growth goal and badge
- League Medals with unlockable and equippable local titles from season points, contest best scores, and claimed season rewards; equipped medals add compact labels above companions, plus a Medal Shelf growth goal and badge
- Medal Challenges that use the equipped medal for a short reward run with medal-specific motion, passive movement/reward perks, daily quest progress, memories, a Medal Runner growth goal, and a Medal Runner badge
- Daily quests can now include care, social meetings, duo moves, team events, pet contests, and discovery goals
- Discovery collection album with 12 original tiny treasures, rarity labels, duplicate counts, and collector badge progress
- Per-character memory log for recent care, toy, discovery, and friend moments
- Automatic companion-to-companion interactions such as greeting, chasing, sharing, following, and resting together
- Care state affects autonomous speech and movement speed without using cloud AI
- Character panels are grouped into Care, Growth, Play, Room, Social, and Library tabs so the pet-game systems stay readable
- Rainbow, glow, spark, bubble, and pixel trails
- Click a character to open website or local app shortcuts
- Shortcut image picker and global display modes: image + name, image only, or name only
- No cloud AI, no chat prompt, no API key, and no token usage in the default app

## Files

- `src/main.cjs`: Electron app, overlay window, settings window, local settings store
- `src/preload.cjs`: secure IPC bridge
- `src/overlay.html`, `src/overlay.css`, `src/overlay.js`: desktop overlay and motion engine
- `src/settings.html`, `src/settings.css`, `src/settings.js`: settings UI, pixel editor, shortcuts editor
- `src/characters.js`: pixel character renderer copied from the RunCat-style reference and adjusted for English names
- `src/interaction-variety.js`: procedural social, discovery, patrol, and Tiny Moments interaction text engine
- `src/game-systems.js`: separated game-system data and pure progress/effect helpers for quirk combos and raising skills
- `scripts/verify-care-system.cjs`: verifies animal sprites, care state, pet walk hooks, training yard hooks, patrol route hooks, care request hooks, Care Coach hooks, care combo hooks, care routine hooks, command training hooks, evolution form hooks, personality growth hooks, Growth Path hooks, Growth Reward hooks, Care Quirk hooks, Care Quirk Combo hooks, Raising Skill hooks, Mood Pattern hooks, Pet Habit hooks, Animal Instinct hooks, bond perk hooks, Caretaker Rank hooks, Pet Synergy hooks, Life Story hooks, time/season ambient hooks, mood aura hooks, Talent School hooks, Tiny Jobs hooks, Focus Mode hooks, Charm Workshop hooks, character special-move hooks, trick mastery hooks, playdate hooks, duo move hooks, team event hooks, pet contest hooks, league season rewards, league medal hooks, medal challenge hooks, desktop toy-object hooks, daily streak hooks, toy inventory, equipped toy play hooks, trail effect shop hooks, egg nursery hooks, snack pantry hooks, pet album hooks, mini-game hooks, Pixel Room habitat state, room themes, item set bonuses, room-play hooks, room-event hooks, discovery collections, friendship state, milestone rewards, memory logs, quest hooks, interaction hooks, badges, procedural variety, panel section tabs, and responsive care UI tokens

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
