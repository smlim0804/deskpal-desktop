import { CHARACTERS, DEFAULT_CHARACTER } from "./characters.js";
import {
  buildDiscoveryDetail,
  buildMicroEventDetail,
  buildPatrolDetail,
  buildSocialDetail,
  discoveryVarietyCount,
  hashText,
  microEventVarietyCount,
  patrolVarietyCount,
  socialVarietyCount,
} from "./interaction-variety.js";

const api = window.deskPal;
const SPRITE_RES = 24;
const IMAGE_SPRITE_RES = 96;
const BASE_SIZE = 54;
const MAX_SLOTS = 8;
const CUSTOM_GRID_SIZE = 24;
const MOUSE_PROXIMITY = 92;
const MOUSE_COLLISION_RADIUS = 12;
const MOUSE_BUMP_SPEED = 1.15;
const MAX_IMPACT_SPEED = 8.5;
const MAX_THROW_SPEED = 18;
const THROW_POWER = 2.15;
const WALL_BOUNCE = 0.92;
const SIDE_VIEW_CHARACTER_IDS = new Set(["car", "pup", "kit", "bunny", "fox", "hamster"]);
const CARE_ACTION_IDS = ["feed", "play", "pet", "clean", "train", "nap"];
const CARE_ROUTINE_IDS = ["morningLoop", "skillDrill", "cozyReset", "playSprint"];
const CARE_COMMAND_IDS = ["comeHere", "slowDrift", "quickDash", "spinAround", "hidePeek", "orbitSpot"];
const FORM_STAGE_IDS = ["sprout", "buddy", "ace", "signature"];
const QUEST_ACTION_IDS = [
  ...CARE_ACTION_IDS,
  "social",
  "discover",
  "expedition",
  "special",
  "request",
  "combo",
  "toyPlay",
  "roomPlay",
  "miniGame",
  "effect",
  "eggCare",
  "snack",
  "mood",
  "talent",
  "job",
  "microEvent",
  "roomEvent",
  "charm",
  "focus",
  "duo",
  "pack",
  "contest",
  "desktopObject",
  "routine",
  "command",
  "medalTrial",
  "petWalk",
  "trainingYard",
  "patrol",
];
const CARE_MEMORY_LIMIT = 12;
const CARE_COMBO_WINDOW_MS = 6 * 60 * 60 * 1000;
const FOCUS_PRESETS = Object.freeze([5, 15, 25]);
const FOCUS_MIN_COMPLETE_MS = 60 * 1000;
const TOY_PLAY_MASTERY_THRESHOLDS = Object.freeze([1, 3, 7, 12]);
const INTERACTION_VARIETY_MINIMUM = 1000;
const INTERACTION_VARIETY_READY =
  socialVarietyCount() >= INTERACTION_VARIETY_MINIMUM &&
  discoveryVarietyCount() >= INTERACTION_VARIETY_MINIMUM &&
  patrolVarietyCount() >= INTERACTION_VARIETY_MINIMUM;
// effectFrameMs caps how often the full-screen effects canvas is cleared and
// redrawn. Pet MOTION still runs at the user's FPS, but particle trails look
// identical at 30-60 Hz, so we avoid re-compositing the whole transparent
// overlay 120x/s just to nudge soft particles. This is the biggest CPU/GPU win
// when an effect (e.g. rainbow) is active.
const PERFORMANCE_PROFILES = Object.freeze({
  saver: { frameMs: 1000 / 18, heavyFrameMs: 1000 / 16, effectFrameMs: 1000 / 30, maxParticles: 36, trailMs: 220, dpr: 1, trails: true, ribbonPoints: 18 },
  balanced: { frameMs: 1000 / 30, heavyFrameMs: 1000 / 24, effectFrameMs: 1000 / 45, maxParticles: 100, trailMs: 118, dpr: 1, trails: true, ribbonPoints: 28 },
  smooth: { frameMs: 1000 / 45, heavyFrameMs: 1000 / 34, effectFrameMs: 1000 / 60, maxParticles: 160, trailMs: 76, dpr: 1, trails: true, ribbonPoints: 42 },
});
const DEFAULT_MOVEMENT = {
  speed: 1.6,
  accel: 0.08,
  damping: 0.92,
  changeMs: [1800, 5000],
  wobble: 0.08,
};

const stage = document.getElementById("stage");
const effectsCanvas = document.getElementById("effects-canvas");
const effectsCtx = effectsCanvas?.getContext("2d", { alpha: true }) || null;
const panel = document.getElementById("pet-panel");
const updatePill = document.getElementById("update-pill");
const viewportCache = { w: window.innerWidth, h: window.innerHeight };

let settings = null;
let pets = [];
let activePet = null;
let mouseX = -9999;
let mouseY = -9999;
let mouseLastX = -9999;
let mouseLastY = -9999;
let mouseLastAt = 0;
let mouseVx = 0;
let mouseVy = 0;
let ghostHidden = false;
let ghostLastMotionAt = 0;
let ghostHiddenAt = 0;
let lastTick = performance.now();
let lastInteractive = false;
let trailHue = 0;
let areaPicker = null;
let effectsDpr = 1;
let effectsCanvasSignature = "";
let effectParticles = [];
let desktopObjects = [];
let effectsDirty = false;
let effectsCanvasShown = true;
let effectsEmptyAt = 0;
let animationFrameId = null;
let tickTimer = null;
let autoTalkBusy = false;
let nextAutoTalkAt = 0;
let lastAutoMicroEventAt = 0;
let systemStats = null;
let systemStatsHistory = [];
let systemStatsBusy = false;
let nextSystemStatsAt = 0;
let lastCareStatsPanelRefreshAt = 0;
let panelPinned = false;
let panelDrag = null;
let panelResize = null;
let panelManual = null;
let pendingSettingsSaveTimer = null;
let performanceProfileCache = null;
let performanceProfileSignature = "";
let stutterGuardUntil = 0;
let lastEffectDrawAt = 0;
const spriteImageCache = new Map();
const FLOATING_BUBBLE_HIDE_MS = 460;
const DEFAULT_GHOST_SHOW_DELAY_MS = 3000;
const GHOST_FREEZE_DELAY_MS = 380;
const GHOST_MOVE_THRESHOLD = 1.8;
const STUTTER_FRAME_MS = 180;
const STUTTER_GUARD_MS = 1200;
const PANEL_DRAG_BLOCK_SELECTOR = [
  "button",
  "input",
  "textarea",
  "select",
  "a",
  "[role='button']",
  ".panel-resize",
  ".panel-tabs",
  ".panel-section",
  ".shortcut-grid",
  ".panel-actions",
  ".care-coach-card",
  ".micro-event-card",
  ".request-card",
  ".combo-card",
  ".trick-card",
  ".mastery-card",
  ".signature-card",
  ".streak-card",
  ".focus-card",
  ".expedition-card",
  ".milestone-card",
  ".habitat-card",
  ".room-event-card",
  ".effect-card",
  ".toy-card",
  ".toy-play-card",
  ".mini-game-card",
  ".badge-card",
  ".friend-card",
  ".collection-card",
  ".charm-card",
  ".pet-album-card",
  ".mood-card",
  ".talent-card",
  ".job-card",
  ".personality-card",
  ".growth-card",
  ".growth-reward-card",
  ".quirk-card",
  ".quirk-combo-card",
  ".mood-pattern-card",
  ".habit-card",
  ".animal-instinct-card",
  ".ambient-card",
  ".nursery-card",
  ".snack-card",
].join(",");

const PANEL_SECTION_IDS = Object.freeze(["care", "growth", "play", "room", "social", "library"]);

const AREA_PRESETS = {
  all: { left: 0.03, top: 0.06, right: 0.97, bottom: 0.92 },
  top: { left: 0.04, top: 0.05, right: 0.96, bottom: 0.42 },
  middle: { left: 0.05, top: 0.25, right: 0.95, bottom: 0.75 },
  bottom: { left: 0.04, top: 0.52, right: 0.96, bottom: 0.94 },
};

const PANEL_I18N = {
  en: {
    note: "Shortcuts and movement controls.",
    close: "Close",
    settings: "Settings",
    shortcuts: "Shortcuts",
    links: "Web",
    apps: "Apps",
    carePage: "System",
    back: "Back",
    noShortcuts: "No shortcuts yet.",
    addShortcuts: "Add web shortcuts or apps in Settings.",
    simpleCareNote: "Live computer load.",
    systemCpu: "CPU",
    systemRam: "RAM",
    systemStorage: "Storage",
    systemCores: "cores",
    systemUsed: "used",
    systemWaiting: "Reading system stats...",
    panelSectionCare: "Care",
    panelSectionGrowth: "Growth",
    panelSectionPlay: "Play",
    panelSectionRoom: "Room",
    panelSectionSocial: "Social",
    panelSectionLibrary: "Library",
    roam: "Roam",
    stay: "Stay",
    movementApplied: "Movement updated.",
    careTitle: "Care",
    careCoachTitle: "Care Coach",
    careCoachReady: "Suggested now",
    careCoachAction: "Do",
    coachHungry: "Refill first",
    coachHungryDesc: "Fullness is the lowest need, so food keeps the day steady.",
    coachSleepy: "Recharge",
    coachSleepyDesc: "Energy is dipping; a nap prevents clumsy play and training.",
    coachMessy: "Clean reset",
    coachMessyDesc: "Dusty pixels are lowering comfort. A quick clean brightens them up.",
    coachLonely: "Check in",
    coachLonelyDesc: "A gentle pet is the fastest way to bring bond and joy back.",
    coachPlayful: "Move together",
    coachPlayfulDesc: "They have enough energy for a happy play burst.",
    coachTraining: "Practice skill",
    coachTrainingDesc: "Skill has room to grow and energy is ready for training.",
    coachPersonality: "Favorite care",
    coachPersonalityDesc: "This matches the companion's temperament and grows trust.",
    coachHabit: "Habit nudge",
    coachHabitDesc: "This action pushes the next pet habit closer to unlocking.",
    coachInstinct: "Instinct nudge",
    coachInstinctDesc: "This helps the animal instinct wake up sooner.",
    microEventTitle: "Tiny Moments",
    microEventRun: "Start",
    microEventNeedEnergy: "Need energy",
    microEventReward: "Moment reward",
    microEventDone: "Moments",
    microEventPatterns: "Patterns",
    microEventAuto: "Auto",
    microEventAutoDesc: "When the panel is closed, companions can quietly create tiny moments on a long cooldown.",
    microEventSignal: "Signal Check",
    microEventSignalDesc: "Reads a tiny desktop cue and turns it into a calm reaction.",
    microEventStretch: "Pixel Stretch",
    microEventStretchDesc: "A small body reset that smooths the next movement.",
    microEventNose: "Nose Note",
    microEventNoseDesc: "Sniffs out a small need and stores it as a useful memory.",
    microEventShimmer: "Shimmer Step",
    microEventShimmerDesc: "A bright step that gives the room a little more life.",
    microEventTidy: "Tidy Tap",
    microEventTidyDesc: "Clears tiny dust pixels while keeping the pet cheerful.",
    microEventBrave: "Brave Peek",
    microEventBraveDesc: "Peeks toward a new route and builds a little confidence.",
    level: "Lv",
    bond: "Bond",
    xp: "XP",
    mood: "Mood",
    hunger: "Full",
    happiness: "Joy",
    energy: "Energy",
    hygiene: "Clean",
    training: "Skill",
    personalityTitle: "Personality",
    personalityLikes: "Likes",
    personalityBonus: "Bonus",
    personalityProgress: "Liked care",
    personalityCurious: "Curious",
    personalityCuriousDesc: "Investigates odd pixels and learns faster from training.",
    personalityPlayful: "Playful",
    personalityPlayfulDesc: "Turns care into movement and loves play time.",
    personalityCozy: "Cozy",
    personalityCozyDesc: "Recovers better from naps and room rest.",
    personalityBrave: "Brave",
    personalityBraveDesc: "Enjoys missions and bolder movement.",
    personalityTidy: "Tidy",
    personalityTidyDesc: "Stays happier when cleaned and cared for.",
    personalityClever: "Clever",
    personalityCleverDesc: "Builds skill and finds tiny patterns quickly.",
    personalityGentle: "Gentle",
    personalityGentleDesc: "Bonds faster from petting and calm care.",
    growthPathTitle: "Growth Path",
    growthCurrent: "Current",
    growthScore: "Score",
    growthNext: "Next",
    growthBonus: "Bonus",
    growthExplorer: "Explorer",
    growthExplorerDesc: "Raised through missions, finds, and brave roaming.",
    growthScholar: "Scholar",
    growthScholarDesc: "Raised through focus, talent practice, and training.",
    growthCozy: "Cozy",
    growthCozyDesc: "Raised through rest, room care, snacks, and gentle routines.",
    growthPerformer: "Star",
    growthPerformerDesc: "Raised through play, toys, mini games, and special moves.",
    growthRankSprout: "Sprout",
    growthRankRising: "Rising",
    growthRankSignature: "Signature",
    growthRewardsTitle: "Growth Rewards",
    growthRewardsClaimed: "Claimed",
    growthRewardNeed: "Need",
    growthRewardClaim: "Claim",
    growthRewardClaimed: "Claimed",
    growthRewardReady: "Ready",
    growthRewardReward: "Reward",
    growthRewardUnlock: "Unlock",
    growthRewardBurst: "care burst",
    growthRewardMotion: "motion kick",
    growthRewardFirstSteps: "First Steps",
    growthRewardFirstStepsDesc: "A starter pack for steady early care.",
    growthRewardLevelSpark: "Level Spark",
    growthRewardLevelSparkDesc: "A reward for reaching the first real buddy stage.",
    growthRewardBondRibbon: "Bond Ribbon",
    growthRewardBondRibbonDesc: "Trust turns into a warmer care rhythm.",
    growthRewardSkillStripe: "Skill Stripe",
    growthRewardSkillStripeDesc: "Training progress earns a sharper growth mark.",
    growthRewardPathCharm: "Path Charm",
    growthRewardPathCharmDesc: "A clear growth path earns a small boost pack.",
    growthRewardHabitBadge: "Habit Badge",
    growthRewardHabitBadgeDesc: "Unlocked habits become a visible raising reward.",
    growthRewardMoodCrown: "Mood Crown",
    growthRewardMoodCrownDesc: "Mood patterns prove this pet has its own routine.",
    growthRewardStoryMedal: "Story Medal",
    growthRewardStoryMedalDesc: "Life story chapters turn memories into rewards.",
    growthRewardAcePack: "Ace Pack",
    growthRewardAcePackDesc: "A bigger prize for raising a mature companion.",
    quirksTitle: "Care Quirks",
    quirksActive: "Active",
    quirkNeed: "Need",
    quirkEffect: "Effect",
    quirkSnackScout: "Snack Scout",
    quirkSnackScoutDesc: "Feeding and snack care shaped a sharp little nose.",
    quirkZoomDancer: "Zoom Dancer",
    quirkZoomDancerDesc: "Play, walks, and games turned into lively movement.",
    quirkTidyGlow: "Tidy Glow",
    quirkTidyGlowDesc: "Clean care made this pet sparkle after messy moments.",
    quirkStudyNudge: "Study Nudge",
    quirkStudyNudgeDesc: "Training and focus became a steady learning habit.",
    quirkCozyAnchor: "Cozy Anchor",
    quirkCozyAnchorDesc: "Naps and room rests made recovery feel safer.",
    quirkSocialSpark: "Social Spark",
    quirkSocialSparkDesc: "Playdates and team moments made this pet warmer around friends.",
    quirkBravePacer: "Brave Pacer",
    quirkBravePacerDesc: "Patrols, walks, and commands made roaming bolder.",
    quirkMemoryKeeper: "Memory Keeper",
    quirkMemoryKeeperDesc: "A pet with enough stories starts reacting like it remembers.",
    quirkCombosTitle: "Quirk Combos",
    quirkCombosActive: "Active",
    quirkComboNeed: "Needs",
    quirkComboEffect: "Effect",
    quirkComboPicnicDash: "Picnic Dash",
    quirkComboPicnicDashDesc: "Snack instincts and lively play turn into a cheerful dash.",
    quirkComboSparkStudy: "Spark Study",
    quirkComboSparkStudyDesc: "Tidy care and training make a focused little rhythm.",
    quirkComboCozyMemoir: "Cozy Memoir",
    quirkComboCozyMemoirDesc: "Restful care and memories become a warm calm loop.",
    quirkComboBraveCircle: "Brave Circle",
    quirkComboBraveCircleDesc: "Brave roaming and social warmth pull friends together.",
    quirkComboGentleFestival: "Gentle Festival",
    quirkComboGentleFestivalDesc: "Food, friends, and memories turn care into a tiny party.",
    quirkComboAceRoutine: "Ace Routine",
    quirkComboAceRoutineDesc: "Study, courage, and rest create a polished daily flow.",
    moodPatternsTitle: "Mood Patterns",
    moodPatternsActive: "Active",
    moodPatternNeed: "Need",
    moodPatternEffect: "Effect",
    patternBrightLoop: "Bright Loop",
    patternBrightLoopDesc: "Bright mood checks, play, and tiny moments make movement more lively.",
    patternCalmNest: "Calm Nest",
    patternCalmNestDesc: "Calm checks, petting, and naps turn into softer recovery.",
    patternSnackSignal: "Snack Signal",
    patternSnackSignalDesc: "Hungry reads, feeding, and snack moments sharpen meal timing.",
    patternDreamDrift: "Dream Drift",
    patternDreamDriftDesc: "Sleepy reads, naps, and focus rests make quiet care more efficient.",
    patternCleanSpark: "Clean Spark",
    patternCleanSparkDesc: "Messy reads and clean care grow into a tidy sparkle habit.",
    patternHeartPulse: "Heart Pulse",
    patternHeartPulseDesc: "Lonely reads, petting, and social care build a warmer bond rhythm.",
    petHabitsTitle: "Pet Habits",
    petHabitsActive: "Active",
    petHabitNeed: "Need",
    petHabitEffect: "Effect",
    habitSnackNose: "Snack Nose",
    habitSnackNoseDesc: "Repeated feeding teaches this pet to recover from meals better.",
    habitZoomies: "Zoomies",
    habitZoomiesDesc: "Play loops become quicker and a little more joyful.",
    habitGentleHeart: "Gentle Heart",
    habitGentleHeartDesc: "Steady petting turns into warmer bond gains.",
    habitTidyPaws: "Tidy Paws",
    habitTidyPawsDesc: "Clean care keeps the pet brighter for longer.",
    habitStudyLoop: "Study Loop",
    habitStudyLoopDesc: "Training habits make skill practice more efficient.",
    habitDreamNest: "Dream Nest",
    habitDreamNestDesc: "Rest routines restore more energy and calm the pace.",
    animalInstinctTitle: "Animal Instinct",
    animalInstinctActive: "Awake",
    animalInstinctNeed: "Need",
    animalInstinctEffect: "Effect",
    instinctLoyalNose: "Loyal Nose",
    instinctLoyalNoseDesc: "Pup walks, play, and petting grow into a loyal return rhythm.",
    instinctSilentPounce: "Silent Pounce",
    instinctSilentPounceDesc: "Kit patrols and clean care sharpen quiet movement.",
    instinctMoonHop: "Moon Hop",
    instinctMoonHopDesc: "Bunny play and rest turn into softer, bouncier recovery.",
    instinctCleverScout: "Clever Scout",
    instinctCleverScoutDesc: "Fox routes, patrols, and training reveal smarter paths.",
    instinctPocketHoard: "Pocket Hoard",
    instinctPocketHoardDesc: "Hamster snacks and toys become tiny stored momentum.",
    bondPerksTitle: "Bond Perks",
    bondPerksUnlocked: "Active",
    bondPerkNeed: "Need",
    bondPerkEffect: "Effect",
    caretakerRankTitle: "Caretaker Rank",
    caretakerRankScore: "Score",
    caretakerRankNext: "Next",
    caretakerRankMax: "Max rank",
    caretakerRankBonus: "Bonus",
    caretakerStatPets: "Pets",
    caretakerStatCare: "Care",
    caretakerStatBond: "Bond",
    caretakerStatCollections: "Finds",
    caretakerStatMilestones: "Goals",
    caretakerStatPerks: "Perks",
    caretakerRookie: "Rookie Keeper",
    caretakerRookieDesc: "A fresh helper learning every tiny habit.",
    caretakerBuddy: "Buddy Keeper",
    caretakerBuddyDesc: "A steady caretaker with several happy routines.",
    caretakerMentor: "Pixel Mentor",
    caretakerMentorDesc: "Guides many companions through real growth.",
    caretakerExpert: "Habitat Expert",
    caretakerExpertDesc: "Balances rooms, collections, training, and bonds.",
    caretakerLegend: "Legend Keeper",
    caretakerLegendDesc: "A whole desktop family grows around your care.",
    petSynergyTitle: "Pet Synergy",
    petSynergyActive: "Active",
    petSynergyNeed: "Need",
    petSynergyEffect: "Effect",
    petSynergyFriend: "Best friend",
    petSynergyNoFriend: "Enable another companion to start synergies.",
    synergyBuddySpark: "Buddy Spark",
    synergyBuddySparkDesc: "A close friend adds a tiny bright lift to care.",
    synergyStudyEcho: "Study Echo",
    synergyStudyEchoDesc: "Training and commands echo between steady friends.",
    synergyCozyNest: "Cozy Nest",
    synergyCozyNestDesc: "Room comfort and routines help friends recover together.",
    synergyScoutPack: "Scout Pack",
    synergyScoutPackDesc: "Patrols and finds sharpen a pair's roaming rhythm.",
    synergyParadeSync: "Parade Sync",
    synergyParadeSyncDesc: "Duo and team events make the group move like a tiny parade.",
    lifeStoryTitle: "Life Story",
    lifeStoryUnlocked: "Chapters",
    lifeStoryNeed: "Need",
    lifeStoryCurrent: "Now",
    storyFirstSteps: "First Steps",
    storyFirstStepsDesc: "The first little routine became part of this pet's day.",
    storyTrustedPal: "Trusted Pal",
    storyTrustedPalDesc: "Care, bond, and memories turned into a steady friendship.",
    storySkillSpark: "Skill Spark",
    storySkillSparkDesc: "Training, tricks, and commands started shaping a real style.",
    storyHomeHeart: "Home Heart",
    storyHomeHeartDesc: "Room comfort, finds, and synergies made the desktop feel like home.",
    storySignatureTale: "Signature Tale",
    storySignatureTaleDesc: "Growth, forms, and special moves became this pet's signature story.",
    perkLoyalNudge: "Loyal Nudge",
    perkLoyalNudgeDesc: "Care gives a tiny extra bond and happiness lift.",
    perkQuickPaws: "Quick Paws",
    perkQuickPawsDesc: "Movement gets a little smoother and faster.",
    perkEagerLearner: "Eager Learner",
    perkEagerLearnerDesc: "Care XP grows slightly from steady training.",
    perkCozyAura: "Cozy Aura",
    perkCozyAuraDesc: "Calm high-mood care restores a little more energy.",
    perkScoutSense: "Scout Sense",
    perkScoutSenseDesc: "Patrol and collection work sharpen care rewards.",
    perkSignatureTrust: "Signature Trust",
    perkSignatureTrustDesc: "Deep bond adds a small speed and XP edge.",
    ambientTitle: "Today's vibe",
    ambientSeason: "Season",
    ambientTime: "Time",
    ambientTotal: "Moments",
    seasonSpring: "Spring",
    seasonSummer: "Summer",
    seasonAutumn: "Autumn",
    seasonWinter: "Winter",
    timeDawn: "Dawn",
    timeMorning: "Morning",
    timeAfternoon: "Afternoon",
    timeEvening: "Evening",
    timeNight: "Night",
    ambientDewSpark: "Dew Spark",
    ambientDewSparkDesc: "Fresh pixels lift their mood at quiet dawn.",
    ambientSunPatch: "Sun Patch",
    ambientSunPatchDesc: "A warm patch gives a small energy lift.",
    ambientLeafSwirl: "Leaf Swirl",
    ambientLeafSwirlDesc: "Tiny leaves make roaming feel playful.",
    ambientMoonGlow: "Moon Glow",
    ambientMoonGlowDesc: "Night light settles them into calm focus.",
    ambientSnackScent: "Snack Scent",
    ambientSnackScentDesc: "A tiny snack smell nudges hunger and bond.",
    ambientStarBlink: "Star Blink",
    ambientStarBlinkDesc: "Blinking sky pixels add a discovery spark.",
    ambientSnowQuiet: "Snow Quiet",
    ambientSnowQuietDesc: "Soft winter quiet restores energy.",
    ambientFlowerTrail: "Flower Trail",
    ambientFlowerTrailDesc: "Spring color boosts joy and cleanliness.",
    feed: "Feed",
    play: "Play",
    pet: "Pet",
    clean: "Clean",
    train: "Train",
    nap: "Nap",
    comboTitle: "Care Combos",
    comboReady: "Ready combo",
    comboStart: "Start a routine",
    comboChain: "Chain",
    comboReward: "Combo reward",
    comboHint: "Next",
    comboSnackSprint: "Snack Sprint",
    comboSnackSprintDesc: "Feed first, then play for a bright energy rush.",
    comboSparkleCuddle: "Sparkle Cuddle",
    comboSparkleCuddleDesc: "Clean first, then pet for a cozy bond boost.",
    comboFocusReset: "Focus Reset",
    comboFocusResetDesc: "Train first, then nap so learning settles in.",
    comboWakeSnack: "Wake Snack",
    comboWakeSnackDesc: "Nap first, then feed for a gentle morning reset.",
    comboTrustLesson: "Trust Lesson",
    comboTrustLessonDesc: "Pet first, then train with extra confidence.",
    comboMuddyFun: "Muddy Fun",
    comboMuddyFunDesc: "Play first, then clean up the happy mess.",
    routineTitle: "Care Routines",
    routineStart: "Start",
    routineNext: "Next",
    routineDoStep: "Do step",
    routineDoneToday: "Done today",
    routineStep: "Step",
    routineReward: "Routine reward",
    routineNeedEnergy: "Need energy",
    routineMorning: "Morning Loop",
    routineMorningDesc: "Feed, clean, then play for a bright start.",
    routineSkill: "Skill Drill",
    routineSkillDesc: "Train, play, and pet to build confidence.",
    routineCozy: "Cozy Reset",
    routineCozyDesc: "Clean, pet, then nap for a soft reset.",
    routinePlay: "Play Sprint",
    routinePlayDesc: "Play, train, then feed after the run.",
    tricksTitle: "Tricks",
    trickUse: "Use",
    trickNeed: "Needs",
    trickHop: "Hop",
    trickSpin: "Spin",
    trickDash: "Dash",
    trickCircle: "Circle",
    trickSeek: "Seek",
    trickParade: "Parade",
    trickMasteryTitle: "Skill mastery",
    trickMastery: "Mastery",
    trickMasteryNext: "Next",
    trickMasteryComplete: "Mastered",
    masteryFresh: "Fresh",
    masteryNovice: "Novice",
    masterySteady: "Steady",
    masterySharp: "Sharp",
    masteryMaster: "Master",
    badgeTrickStar: "Trick Star",
    badgeMasterTrainer: "Master Trainer",
    expeditionsTitle: "Missions",
    expeditionGo: "Go",
    expeditionNeed: "Needs",
    expeditionGarden: "Garden Walk",
    expeditionSkyline: "Skyline Scout",
    expeditionBuddy: "Buddy Patrol",
    expeditionTreasure: "Treasure Route",
    badgeExplorer: "Explorer",
    specialTitle: "Special Move",
    specialUse: "Use",
    specialNeedEnergy: "Need energy",
    specialReward: "Reward",
    specialTimes: "Times",
    specialReady: "Ready",
    requestTitle: "Today's Request",
    requestDo: "Help",
    requestDone: "Done today",
    requestBonus: "Bonus",
    requestReason: "Mood read",
    milestonesTitle: "Growth Goals",
    milestoneClaim: "Claim",
    milestoneClaimed: "Claimed",
    milestoneReady: "Ready",
    milestoneReward: "Reward",
    milestoneFirstCare: "First hello",
    milestoneFirstCareDesc: "Complete any care action once.",
    milestoneLevel3: "Small buddy",
    milestoneLevel3Desc: "Raise this companion to level 3.",
    milestoneLevel5: "Bright buddy",
    milestoneLevel5Desc: "Raise this companion to level 5.",
    milestoneBond50: "Trusted pal",
    milestoneBond50Desc: "Reach bond 50 with this companion.",
    milestoneTraining60: "Skilled steps",
    milestoneTraining60Desc: "Reach training 60.",
    milestoneToyCollector: "Toy shelf",
    milestoneToyCollectorDesc: "Own 3 different toys.",
    milestoneToyPlay: "Toy buddy",
    milestoneToyPlayDesc: "Play with equipped toys 10 times.",
    milestoneCozyCorner: "Cozy corner",
    milestoneCozyCornerDesc: "Place 4 room items.",
    milestonePersonalityMatch: "Good match",
    milestonePersonalityMatchDesc: "Use this companion's liked care 8 times.",
    milestoneSeasonWatcher: "Vibe watcher",
    milestoneSeasonWatcherDesc: "Collect 12 time or season moments.",
    milestoneCollectorHalf: "Tiny album",
    milestoneCollectorHalfDesc: "Find 6 collection treasures.",
    milestoneCharmCrafter: "Charm maker",
    milestoneCharmCrafterDesc: "Craft all 4 collection charms.",
    milestoneMemoryBook: "Memory book",
    milestoneMemoryBookDesc: "Keep 8 recent memories.",
    milestoneSocialCircle: "Friend circle",
    milestoneSocialCircleDesc: "Build 160 total friendship points.",
    milestonePlaydateHost: "Playdate host",
    milestonePlaydateHostDesc: "Host 6 companion playdates.",
    milestoneDuoBond: "Duo rhythm",
    milestoneDuoBondDesc: "Use duo moves 10 times.",
    milestonePackLeader: "Pack leader",
    milestonePackLeaderDesc: "Run 8 team events.",
    milestoneContestChampion: "League champ",
    milestoneContestChampionDesc: "Enter pet contests 10 times.",
    milestoneLeagueCollector: "Season shelf",
    milestoneLeagueCollectorDesc: "Claim all league season rewards.",
    milestoneMedalCollector: "Medal shelf",
    milestoneMedalCollectorDesc: "Unlock all league medals.",
    milestoneMedalChallenger: "Medal runner",
    milestoneMedalChallengerDesc: "Run 12 equipped medal challenges.",
    milestoneWalkLeader: "Walk leader",
    milestoneWalkLeaderDesc: "Take 10 companion walks.",
    milestoneYardTrainer: "Yard trainer",
    milestoneYardTrainerDesc: "Clear 12 training yard courses.",
    milestonePatrolCaptain: "Patrol captain",
    milestonePatrolCaptainDesc: "Complete 18 desktop patrols.",
    milestoneObjectPlayer: "Desktop play",
    milestoneObjectPlayerDesc: "Catch desktop toys 12 times.",
    milestoneRoutineKeeper: "Routine builder",
    milestoneRoutineKeeperDesc: "Complete care routines 10 times.",
    milestoneCommandTrainer: "Command trainer",
    milestoneCommandTrainerDesc: "Use direct commands 16 times.",
    milestoneFormAscended: "Form ascent",
    milestoneFormAscendedDesc: "Claim all four evolution forms.",
    milestoneTrickStarter: "Trick rhythm",
    milestoneTrickStarterDesc: "Use tricks 12 times.",
    milestoneTrickMaster: "Trick master",
    milestoneTrickMasterDesc: "Earn 12 total mastery levels from tricks.",
    milestoneMissionScout: "Mission scout",
    milestoneMissionScoutDesc: "Complete missions 8 times.",
    milestoneDailyStreak: "Steady pal",
    milestoneDailyStreakDesc: "Reach a 5-day daily streak.",
    milestoneSignaturePerformer: "Signature spark",
    milestoneSignaturePerformerDesc: "Use special moves 12 times.",
    milestoneRequestHelper: "Good listener",
    milestoneRequestHelperDesc: "Complete 10 companion requests.",
    milestoneComboKeeper: "Routine keeper",
    milestoneComboKeeperDesc: "Complete 8 care combos.",
    milestoneRoomDesigner: "Room rhythm",
    milestoneRoomDesignerDesc: "Play in the Pixel Room 8 times.",
    milestoneRoomEventHost: "Room host",
    milestoneRoomEventHostDesc: "Run 14 room events.",
    milestoneMiniGameChamp: "Arcade champ",
    milestoneMiniGameChampDesc: "Play mini games 10 times.",
    milestoneEffectCollector: "Trail shelf",
    milestoneEffectCollectorDesc: "Own 4 trail effects.",
    milestoneEggHatcher: "Nest keeper",
    milestoneEggHatcherDesc: "Hatch 3 nursery eggs.",
    milestoneSnackChef: "Snack chef",
    milestoneSnackChefDesc: "Serve favorite snacks 10 times.",
    milestonePetAlbum: "Pet album",
    milestonePetAlbumDesc: "Register 10 companions in the pet album.",
    milestoneMoodReader: "Mood reader",
    milestoneMoodReaderDesc: "Check companion moods 12 times.",
    milestoneMoodPatternKeeper: "Mood patterns",
    milestoneMoodPatternKeeperDesc: "Awaken 3 mood patterns on one companion.",
    milestoneTalentGraduate: "Talent school",
    milestoneTalentGraduateDesc: "Earn 9 total talent levels.",
    milestoneJobHelper: "Tiny worker",
    milestoneJobHelperDesc: "Finish 12 tiny jobs.",
    milestoneFocusBuddy: "Focus buddy",
    milestoneFocusBuddyDesc: "Complete 8 focus sessions.",
    milestoneGrowthPath: "Growth path",
    milestoneGrowthPathDesc: "Reach 120 points in one growth path.",
    milestoneHabitKeeper: "Habit keeper",
    milestoneHabitKeeperDesc: "Unlock every pet habit.",
    milestoneInstinctKeeper: "Instinct keeper",
    milestoneInstinctKeeperDesc: "Awaken an animal companion's instinct.",
    milestonePerkKeeper: "Perk keeper",
    milestonePerkKeeperDesc: "Unlock all bond perks.",
    milestoneCaretakerMentor: "Caretaker rank",
    milestoneCaretakerMentorDesc: "Reach 360 caretaker score.",
    milestoneSynergyKeeper: "Synergy keeper",
    milestoneSynergyKeeperDesc: "Activate all pet synergies.",
    milestoneStoryArchivist: "Story archivist",
    milestoneStoryArchivistDesc: "Unlock all Life Story chapters.",
    milestoneDailyChampion: "Daily champion",
    milestoneDailyChampionDesc: "Finish all of today's goals.",
    badgeMilestoneKeeper: "Goal Keeper",
    badgeRoomMaker: "Room Maker",
    badgePersonalityMatch: "Good Match",
    badgeSeasonPal: "Vibe Pal",
    badgeDailyStreak: "Steady Pal",
    badgeSignatureStar: "Signature Star",
    badgeRequestHelper: "Good Listener",
    badgeComboPal: "Combo Pal",
    badgeToyBuddy: "Toy Buddy",
    badgeRoomDesigner: "Room Buddy",
    badgeRoomEventHost: "Room Host",
    badgeMiniGamer: "Arcade Pal",
    badgeTrailStylist: "Trail Stylist",
    badgeNestKeeper: "Nest Keeper",
    badgeSnackChef: "Snack Chef",
    badgePetAlbum: "Pet Album",
    badgeMoodReader: "Mood Reader",
    badgeMoodPattern: "Mood Pattern",
    badgeGrowthReward: "Growth Rewards",
    badgeQuirkKeeper: "Quirk Keeper",
    badgeQuirkCombo: "Quirk Combos",
    badgeTalentGraduate: "Talent Grad",
    badgeJobHelper: "Tiny Worker",
    badgeFocusBuddy: "Focus Buddy",
    badgeMomentMaker: "Moment Maker",
    badgeGrowthPath: "Growth Path",
    badgeHabitKeeper: "Habit Keeper",
    badgeInstinctKeeper: "Instinct Pal",
    badgePerkKeeper: "Perk Keeper",
    badgeCaretakerRank: "Pixel Mentor",
    badgeSynergyKeeper: "Synergy Keeper",
    badgeStoryArchivist: "Story Archivist",
    badgeDuoBuddy: "Duo Buddy",
    badgeObjectPal: "Desk Toy Pal",
    badgeRoutineKeeper: "Routine Builder",
    badgeCommandTrainer: "Command Trainer",
    badgeEvolutionKeeper: "Form Keeper",
    baby: "Tiny",
    buddy: "Buddy",
    ace: "Ace",
    bright: "Bright",
    hungry: "Hungry",
    sleepy: "Sleepy",
    messy: "Messy",
    lonely: "Lonely",
    calm: "Calm",
    moodAuraTitle: "Mood Aura",
    moodAuraCheck: "Check mood",
    moodAuraSeen: "Checks",
    moodAuraReward: "Mood reward",
    moodBrightAura: "Bright Glow",
    moodBrightAuraDesc: "High-care sparkle. Great for training and play.",
    moodCalmAura: "Calm Ripple",
    moodCalmAuraDesc: "Steady mood. A soft bond and energy reset.",
    moodHungryAura: "Snack Signal",
    moodHungryAuraDesc: "Food mood detected. A tiny refill helps.",
    moodSleepyAura: "Dream Drift",
    moodSleepyAuraDesc: "Sleepy pixels. Energy recovers gently.",
    moodMessyAura: "Clean Spark",
    moodMessyAuraDesc: "Dusty pixels. Clean shimmer wakes up.",
    moodLonelyAura: "Heart Pulse",
    moodLonelyAuraDesc: "Needs attention. Bond grows from checking in.",
    talentSchoolTitle: "Talent School",
    talentTrain: "Practice",
    talentLevel: "Talent Lv",
    talentProgress: "Progress",
    talentNeedEnergy: "Need energy",
    talentNeedSkill: "Need skill",
    talentReward: "Talent reward",
    talentAgility: "Agility",
    talentAgilityDesc: "Sharper turns and a tiny movement boost.",
    talentFocus: "Focus",
    talentFocusDesc: "Better learning rhythm for tricks and missions.",
    talentCharm: "Charm",
    talentCharmDesc: "Warmer social moments and stronger bond.",
    jobBoardTitle: "Tiny Jobs",
    jobRun: "Start",
    jobNeed: "Needs",
    jobNeedEnergy: "Need energy",
    jobNeedLevel: "Need level",
    jobNeedSkill: "Need skill",
    jobReward: "Job reward",
    jobReputation: "Rep",
    jobPocketScout: "Pocket Scout",
    jobPocketScoutDesc: "Searches the desktop edge for tiny finds.",
    jobDeskHelper: "Desk Helper",
    jobDeskHelperDesc: "Sorts small tasks with focused pixels.",
    jobJoyShow: "Joy Show",
    jobJoyShowDesc: "Performs a little cheer for coin and bond.",
    questsTitle: "Today",
    coins: "Coins",
    done: "Done",
    dailyStreakTitle: "Daily streak",
    dailyStreak: "Streak",
    dailyBest: "Best",
    dailyClaim: "Claim",
    dailyClaimed: "Claimed",
    dailyStreakReward: "Daily reward",
    questFeed: "Feed companions",
    questPlay: "Play together",
    questPet: "Give pets",
    questClean: "Clean companions",
    questTrain: "Train tricks",
    questNap: "Let them nap",
    questSocial: "Let friends meet",
    questDuo: "Use duo moves",
    questPack: "Run team events",
    questContest: "Enter pet contests",
    questDeskObject: "Catch desktop toys",
    questRoutine: "Finish routines",
    questCommand: "Guide commands",
    questDiscover: "Find tiny treasures",
    questCharm: "Craft or equip charms",
    questExpedition: "Send missions",
    questSpecial: "Use special moves",
    questRequest: "Help requests",
    questCombo: "Complete care combos",
    questToyPlay: "Play with toys",
    questRoomPlay: "Play in room",
    questRoomEvent: "Run room events",
    questMiniGame: "Play mini game",
    questEffect: "Style trail",
    questEggCare: "Warm nursery eggs",
    questSnack: "Serve snacks",
    questMood: "Read moods",
    questTalent: "Practice talent",
    questJob: "Finish jobs",
    questFocus: "Finish focus",
    questMicroEvent: "Start tiny moments",
    questMedalTrial: "Run medal challenge",
    questPetWalk: "Take a walk",
    questTrainingYard: "Clear training yard",
    questPatrol: "Run a patrol",
    questReward: "Reward",
    focusModeTitle: "Focus Mode",
    focusStart: "Start",
    focusBank: "Bank",
    focusCancel: "Cancel",
    focusRunning: "Running",
    focusReady: "Ready",
    focusTotal: "Total",
    focusBest: "Best",
    focusSessions: "Sessions",
    focusReward: "Focus reward",
    focusNeedTime: "Needs 1m",
    focusOtherPet: "Another pet is focusing",
    focusIdleHint: "Pick a sprint. Your pet keeps watch while you work.",
    nurseryTitle: "Egg Nursery",
    nurseryProgress: "Warmth",
    nurseryHatched: "Hatched",
    nurseryNext: "Next hatch",
    nurseryEmptySlot: "Ready slot",
    nurseryFull: "All slots full",
    nurseryWarm: "Warm egg",
    nurseryNeedEnergy: "Need energy",
    nurseryReward: "Nest reward",
    nurseryHint: "Warm the egg to hatch a new animal friend.",
    nurseryReady: "Ready to hatch",
    nurseryBonus: "Bonus hatch reward",
    snackPantryTitle: "Snack Pantry",
    snackServe: "Serve",
    snackBuy: "Buy",
    snackOwned: "Owned",
    snackFavorite: "Favorite",
    snackGood: "Good snack",
    snackNeedCoins: "Need coins",
    snackReward: "Snack reward",
    snackServed: "Snack served",
    snackBerryBite: "Berry Bite",
    snackBerryBiteDesc: "Sweet berry pixels for quick joy.",
    snackMoonMilk: "Moon Milk",
    snackMoonMilkDesc: "Soft milk that restores energy.",
    snackCrunchyStar: "Crunchy Star",
    snackCrunchyStarDesc: "A crisp star that helps training.",
    snackCleanMint: "Clean Mint",
    snackCleanMintDesc: "Fresh mint for tidy companions.",
    snackFocusBean: "Focus Bean",
    snackFocusBeanDesc: "Tiny bean for sharp practice.",
    snackCozyCookie: "Cozy Cookie",
    snackCozyCookieDesc: "Warm cookie for bond and fullness.",
    effectShopTitle: "Trail Studio",
    effectBuy: "Buy",
    effectEquip: "Equip",
    effectEquipped: "Equipped",
    effectOwned: "Owned",
    effectNeedCoins: "Need coins",
    effectReward: "Style reward",
    effectNormal: "Mint Trail",
    effectNormalDesc: "A clean soft pixel trail.",
    effectSpark: "Spark Trail",
    effectSparkDesc: "Bright tiny sparks behind the pet.",
    effectBubble: "Bubble Trail",
    effectBubbleDesc: "Soft bubbles that float upward.",
    effectPixel: "Pixel Pop",
    effectPixelDesc: "Color pixels that scatter lightly.",
    effectRainbow: "Rainbow Tail",
    effectRainbowDesc: "A long colorful tail effect.",
    miniGameTitle: "Mini Games",
    miniGameBest: "Best",
    miniGameScore: "Score",
    miniGamePlay: "Play",
    miniGameNeed: "Need energy",
    miniGameReward: "Game reward",
    miniStarCatch: "Star Catch",
    miniStarCatchDesc: "Catch tiny stars for joy.",
    miniBubbleDodge: "Bubble Dodge",
    miniBubbleDodgeDesc: "Dodge bubbles with quick moves.",
    miniMemorySteps: "Memory Steps",
    miniMemoryStepsDesc: "Repeat tiny steps for training.",
    toyBox: "Toy Box",
    equip: "Equip",
    equipped: "Equipped",
    buy: "Buy",
    owned: "Owned",
    notEnoughCoins: "Need more coins",
    toyRibbon: "Focus Ribbon",
    toyBell: "Happy Bell",
    toyBall: "Bounce Ball",
    toyBrush: "Clean Brush",
    toyRocketSnack: "Rocket Snack",
    toyStarBlanket: "Star Blanket",
    toyPlayTitle: "Toy Play",
    toyPlay: "Play toy",
    toyPlayNeed: "Equip a toy first",
    toyPlayMastery: "Toy mastery",
    toyPlayReward: "Play reward",
    toyPlayNext: "Next",
    deskObjectTitle: "Desktop Toys",
    deskObjectThrow: "Throw",
    deskObjectCount: "Caught",
    deskObjectNeedEnergy: "Need energy",
    deskObjectReward: "Catch reward",
    deskBall: "Bounce Ball",
    deskBallDesc: "A lively ball that makes companions chase.",
    deskTreat: "Treat Drop",
    deskTreatDesc: "A tiny snack to dash toward.",
    deskStar: "Spark Star",
    deskStarDesc: "A bright target for practice.",
    deskBubble: "Bubble Pop",
    deskBubbleDesc: "A clean pop with soft blue pixels.",
    evolutionTitle: "Forms",
    evolutionCurrent: "Current",
    evolutionClaim: "Claim",
    evolutionClaimed: "Claimed",
    evolutionLocked: "Locked",
    evolutionNeed: "Need",
    evolutionReward: "Reward",
    formSprout: "Sprout Form",
    formSproutDesc: "A first bright form from basic care.",
    formBuddy: "Buddy Form",
    formBuddyDesc: "A warmer form from steady bonding.",
    formAce: "Ace Form",
    formAceDesc: "A trained form with clear movement rhythm.",
    formSignature: "Signature Form",
    formSignatureDesc: "A final form shaped by its strongest growth path.",
    commandTitle: "Commands",
    commandUse: "Guide",
    commandTimes: "Used",
    commandNeedEnergy: "Need energy",
    commandCome: "Come",
    commandComeDesc: "Move toward your cursor or the screen center.",
    commandSlow: "Slow",
    commandSlowDesc: "Glide gently and calm down for a moment.",
    commandDash: "Dash",
    commandDashDesc: "Shoot forward in the current facing direction.",
    commandSpin: "Spin",
    commandSpinDesc: "Twirl in place with a bright pop.",
    commandHide: "Hide",
    commandHideDesc: "Slip toward an edge, then peek back.",
    commandOrbit: "Orbit",
    commandOrbitDesc: "Circle around its current spot.",
    habitatTitle: "Pixel Room",
    habitatComfort: "Comfort",
    habitatThemesTitle: "Room Themes",
    habitatTheme: "Theme",
    habitatThemeUse: "Use",
    habitatThemeActive: "Active",
    habitatThemeLocked: "Need comfort",
    habitatSetBonus: "Set Bonus",
    habitatNoSet: "Place matching items for bonuses.",
    habitatRoomPlay: "Room play",
    habitatRoomPlayNeed: "Place an item first",
    habitatRoomReward: "Room reward",
    habitatRest: "Rest",
    habitatBuy: "Buy",
    habitatPlace: "Place",
    habitatRemove: "Remove",
    habitatFull: "Room full",
    habitatEmptySlot: "Empty",
    habitatOwned: "Owned",
    habitatMat: "Soft Mat",
    habitatMatDesc: "A calm floor spot for quick rest.",
    habitatPlant: "Mini Plant",
    habitatPlantDesc: "A tiny green corner that lifts mood.",
    habitatLamp: "Glow Lamp",
    habitatLampDesc: "Warm light for sleepy companions.",
    habitatCushion: "Puff Cushion",
    habitatCushionDesc: "Extra comfort after busy roaming.",
    habitatSnackBowl: "Snack Bowl",
    habitatSnackBowlDesc: "Keeps fullness steadier.",
    habitatClock: "Tiny Clock",
    habitatClockDesc: "Helps training feel more steady.",
    habitatBook: "Pixel Book",
    habitatBookDesc: "A quiet skill corner.",
    habitatWindow: "Sky Window",
    habitatWindowDesc: "Fresh air for a brighter mood.",
    habitatThemeCozy: "Cozy",
    habitatThemeCozyDesc: "Soft warm room for steady rest.",
    habitatThemeGarden: "Garden",
    habitatThemeGardenDesc: "Fresh green room for bright moods.",
    habitatThemeNight: "Night",
    habitatThemeNightDesc: "Quiet blue room for sleepy pals.",
    habitatThemeStudy: "Study",
    habitatThemeStudyDesc: "Focused room for skill practice.",
    habitatSetCozyNest: "Cozy Nest",
    habitatSetCozyNestDesc: "Mat + cushion + lamp.",
    habitatSetGardenNook: "Garden Nook",
    habitatSetGardenNookDesc: "Plant + window + snack bowl.",
    habitatSetStudyDesk: "Study Desk",
    habitatSetStudyDeskDesc: "Book + clock + lamp.",
    habitatSetPicnicMat: "Picnic Mat",
    habitatSetPicnicMatDesc: "Mat + plant + snack bowl.",
    roomEventTitle: "Room Events",
    roomEventRun: "Run",
    roomEventNeedItems: "Need items",
    roomEventNeedEnergy: "Need energy",
    roomEventReward: "Event reward",
    roomEventDone: "Events",
    roomEventPlantCare: "Plant Care",
    roomEventPlantCareDesc: "Waters the green corner and shakes out fresh pixels.",
    roomEventStudySession: "Study Session",
    roomEventStudySessionDesc: "Uses book and clock for a focused practice loop.",
    roomEventCozyReset: "Cozy Reset",
    roomEventCozyResetDesc: "Settles into the mat and cushion for a soft reset.",
    roomEventSnackPicnic: "Snack Picnic",
    roomEventSnackPicnicDesc: "Turns the mat and snack bowl into a tiny picnic.",
    roomEventWindowWatch: "Window Watch",
    roomEventWindowWatchDesc: "Looks through the sky window and may spot treasure.",
    roomEventLampFocus: "Lamp Focus",
    roomEventLampFocusDesc: "Uses warm lamp light to sharpen quiet study.",
    badgesTitle: "Badges",
    locked: "Locked",
    badgeFirstCare: "First Care",
    badgeLevel5: "Level 5",
    badgeBond50: "Bond 50",
    badgeTraining60: "Training 60",
    badgeDailyDone: "Daily Clear",
    badgeToyOwner: "Toy Owner",
    badgeMemoryKeeper: "Memory Keeper",
    badgeBestFriend: "Best Friend",
    badgeCollector: "Collector",
    badgeCharmCrafter: "Charm Maker",
    badgePlaydateHost: "Playdate Host",
    badgePackLeader: "Pack Leader",
    badgeContestChamp: "League Champ",
    badgeLeagueCollector: "Season Shelf",
    badgeMedalCollector: "Medal Shelf",
    badgeMedalRunner: "Medal Runner",
    badgeWalkBuddy: "Walk Buddy",
    badgeYardTrainer: "Yard Trainer",
    badgePatrolScout: "Patrol Scout",
    friendsTitle: "Friends",
    noFriends: "Enable more companions to build friendships.",
    friendNew: "New",
    friendPal: "Pal",
    friendClose: "Close",
    friendBest: "Best",
    playdate: "Playdate",
    playdateNeedEnergy: "Need more energy",
    playdateCooldown: "Resting after last playdate",
    duoTitle: "Duo",
    duoUse: "Use",
    duoLocked: "Need bond",
    duoNeedEnergy: "Need energy",
    duoBuddyDash: "Buddy Dash",
    duoBuddyDashDesc: "Two friends zip across the desktop in sync.",
    duoStudyPair: "Study Pair",
    duoStudyPairDesc: "A focused pair practice that boosts skill.",
    duoSnackShare: "Snack Share",
    duoSnackShareDesc: "Friends split a tiny snack and warm up.",
    duoStarParade: "Star Parade",
    duoStarParadeDesc: "Close friends perform a bright little parade.",
    packTitle: "Team Events",
    packRun: "Run",
    packMembers: "Team",
    packTimes: "Runs",
    packNeedMembers: "Need more friends",
    packNeedEnergy: "Need energy",
    packReward: "Team reward",
    packGarden: "Garden Sweep",
    packGardenDesc: "Friends clean tiny leaves and share a calm boost.",
    packScout: "Edge Scout",
    packScoutDesc: "The team checks desktop edges for small finds.",
    packDrill: "Sync Drill",
    packDrillDesc: "A group movement practice for training rhythm.",
    packParade: "Pixel Parade",
    packParadeDesc: "A bright team parade that boosts friendship.",
    contestTitle: "Pet League",
    contestEnter: "Enter",
    contestBest: "Best",
    contestScore: "Score",
    contestNeedLevel: "Need level",
    contestNeedEnergy: "Need energy",
    contestReward: "Prize",
    contestBronze: "Bronze",
    contestSilver: "Silver",
    contestGold: "Gold",
    contestMaster: "Master",
    contestSprint: "Sprint Circuit",
    contestSprintDesc: "A fast route scored from training, energy, and level.",
    contestCozy: "Cozy Show",
    contestCozyDesc: "A calm show scored from happiness, hygiene, and bond.",
    contestTrick: "Trick Stage",
    contestTrickDesc: "A skill stage scored from tricks, commands, and training.",
    contestRelay: "Friend Relay",
    contestRelayDesc: "A social relay scored from friendships and team activity.",
    leagueSeasonTitle: "League Season",
    leagueSeasonPoints: "Season points",
    leagueSeasonBest: "Best season",
    leagueSeasonClaim: "Claim",
    leagueSeasonClaimed: "Claimed",
    leagueSeasonLocked: "Need points",
    leagueSeasonReward: "Season reward",
    leagueSeasonGain: "Season",
    leagueTierWarmup: "Warmup chest",
    leagueTierBronze: "Bronze chest",
    leagueTierGold: "Gold chest",
    leagueTierMaster: "Master chest",
    medalTitle: "League Medals",
    medalEquip: "Equip",
    medalEquipped: "Equipped",
    medalLocked: "Locked",
    medalNone: "No medal",
    medalRequirement: "Need",
    medalRookie: "Rookie",
    medalRookieDesc: "First league steps.",
    medalSprinter: "Sprinter",
    medalSprinterDesc: "Fast contest medal.",
    medalCozy: "Cozy Star",
    medalCozyDesc: "Calm show medal.",
    medalTrickAce: "Trick Ace",
    medalTrickAceDesc: "Skill stage medal.",
    medalRelayHero: "Relay Hero",
    medalRelayHeroDesc: "Friend relay medal.",
    medalSeasonStar: "Season Star",
    medalSeasonStarDesc: "Season reward medal.",
    medalTrialTitle: "Medal Challenge",
    medalTrialRun: "Run",
    medalTrialNeedMedal: "Equip a medal first.",
    medalTrialEnergy: "Energy",
    medalTrialReward: "Challenge reward",
    medalTrialTimes: "Challenges",
    medalTrialPerk: "Medal perk",
    medalTrialReady: "Ready",
    medalTrialTired: "Need energy",
    medalTrialDone: "Challenge complete",
    walkTitle: "Pet Walk",
    walkRun: "Walk",
    walkTimes: "Walks",
    walkNeedLevel: "Need level",
    walkNeedEnergy: "Need energy",
    walkReward: "Walk reward",
    walkAnimalBonus: "Animal bonus",
    walkSnackBonus: "Snack bonus",
    walkReady: "Ready",
    walkGarden: "Garden Loop",
    walkGardenDesc: "A bright loop that likes room comfort and green moods.",
    walkTrack: "Training Track",
    walkTrackDesc: "A brisk route for skill, energy, and clean movement.",
    walkSnackTrail: "Snack Trail",
    walkSnackTrailDesc: "A treat-guided walk boosted by favorite snacks.",
    walkNightStroll: "Night Stroll",
    walkNightStrollDesc: "A calm evening route for bond and recovery.",
    yardTitle: "Training Yard",
    yardRun: "Train",
    yardTimes: "Runs",
    yardNeedLevel: "Need level",
    yardNeedEnergy: "Need energy",
    yardReward: "Yard reward",
    yardAnimalBonus: "Animal bonus",
    yardWalkBonus: "Walk rhythm",
    yardMedalBonus: "Medal focus",
    yardToyBonus: "Toy bonus",
    yardReady: "Ready",
    yardAgility: "Agility Tunnel",
    yardAgilityDesc: "A quick weave course that rewards past walks.",
    yardRecall: "Recall Drill",
    yardRecallDesc: "A bond drill where animal friends learn faster.",
    yardBalance: "Balance Beam",
    yardBalanceDesc: "A steady course that grows with training.",
    yardHoops: "Focus Hoops",
    yardHoopsDesc: "A medal-aware hoop loop for sharp practice.",
    patrolTitle: "Patrol Routes",
    patrolRun: "Patrol",
    patrolTimes: "Patrols",
    patrolNeedLevel: "Need level",
    patrolNeedEnergy: "Need energy",
    patrolReward: "Patrol reward",
    patrolAnimalBonus: "Animal scout",
    patrolWalkBonus: "Walk map",
    patrolDiscoveryBonus: "Discovery chance",
    patrolComfortBonus: "Room comfort",
    patrolReady: "Ready",
    patrolEdge: "Edge Sweep",
    patrolEdgeDesc: "Checks desktop edges and cleans tiny route marks.",
    patrolCursor: "Cursor Trail",
    patrolCursorDesc: "Follows cursor echoes with walk rhythm bonuses.",
    patrolIcon: "Icon Watch",
    patrolIconDesc: "Scans quiet icon gaps for collection chances.",
    patrolCozy: "Cozy Round",
    patrolCozyDesc: "A soft route that likes room comfort and calm pets.",
    collectionTitle: "Collection",
    collectionFound: "Found",
    collectionEmpty: "Tiny treasures discovered while roaming appear here.",
    charmWorkshopTitle: "Charm Workshop",
    charmCraft: "Craft",
    charmEquip: "Equip",
    charmEquipped: "Equipped",
    charmOwned: "Owned",
    charmNeedItems: "Need items",
    charmRecipe: "Recipe",
    charmBonus: "Charm bonus",
    charmLuckyLeaf: "Lucky Leaf",
    charmLuckyLeafDesc: "A light charm for playful movement and small finds.",
    charmFocusGem: "Focus Gem",
    charmFocusGemDesc: "A study charm that sharpens training and talent practice.",
    charmCozyShell: "Cozy Shell",
    charmCozyShellDesc: "A soft charm for naps, petting, and calmer bonds.",
    charmRainbowPin: "Rainbow Pin",
    charmRainbowPinDesc: "A bright charm for play and special move sparkle.",
    petAlbumTitle: "Pet Album",
    petAlbumSeen: "Registered",
    petAlbumLevel: "Best Lv",
    petAlbumActive: "Active",
    petAlbumHidden: "Unknown pal",
    petAlbumHint: "Enable, hatch, or care for companions to register them.",
    petAlbumFavorite: "Likes",
    rarityCommon: "Common",
    rarityRare: "Rare",
    rarityEpic: "Epic",
    memoriesTitle: "Memories",
    emptyMemories: "Care, discoveries, and friend moments will appear here.",
  },
  ko: {
    note: "바로가기와 움직임 설정.",
    close: "닫기",
    settings: "설정",
    shortcuts: "바로가기",
    links: "웹",
    apps: "앱",
    carePage: "시스템",
    back: "뒤로",
    noShortcuts: "아직 바로가기가 없어.",
    addShortcuts: "설정에서 웹 바로가기나 앱을 추가해줘.",
    simpleCareNote: "컴퓨터 상태를 실시간으로 보고 있어.",
    systemCpu: "CPU",
    systemRam: "RAM",
    systemStorage: "용량",
    systemCores: "코어",
    systemUsed: "사용중",
    systemWaiting: "시스템 상태 읽는 중...",
    panelSectionCare: "돌봄",
    panelSectionGrowth: "성장",
    panelSectionPlay: "놀이",
    panelSectionRoom: "방",
    panelSectionSocial: "친구",
    panelSectionLibrary: "기록",
    roam: "움직임",
    stay: "멈춤",
    movementApplied: "움직임 반영했어.",
    careTitle: "육성",
    careCoachTitle: "케어 코치",
    careCoachReady: "지금 추천",
    careCoachAction: "실행",
    coachHungry: "먼저 든든하게",
    coachHungryDesc: "포만감이 낮아서 밥을 주면 하루 흐름이 안정돼.",
    coachSleepy: "충전 타이밍",
    coachSleepyDesc: "에너지가 내려가고 있어. 낮잠으로 움직임을 회복해.",
    coachMessy: "반짝 리셋",
    coachMessyDesc: "먼지 픽셀이 쌓였어. 씻기면 기분과 청결이 같이 살아나.",
    coachLonely: "가볍게 확인",
    coachLonelyDesc: "쓰담은 즐거움과 친밀도를 빠르게 회복시켜.",
    coachPlayful: "같이 움직이기",
    coachPlayfulDesc: "지금은 에너지가 있어서 즐겁게 놀기 좋은 상태야.",
    coachTraining: "기술 연습",
    coachTrainingDesc: "훈련 수치가 더 자랄 수 있고 에너지도 준비됐어.",
    coachPersonality: "좋아하는 돌봄",
    coachPersonalityDesc: "이 캐릭터 성격과 잘 맞아서 신뢰가 잘 쌓여.",
    coachHabit: "습관 밀어주기",
    coachHabitDesc: "다음 펫 습관 해금에 바로 도움이 되는 행동이야.",
    coachInstinct: "본능 깨우기",
    coachInstinctDesc: "동물 본능 진행도를 더 빨리 올릴 수 있어.",
    microEventTitle: "작은 순간",
    microEventRun: "시작",
    microEventNeedEnergy: "에너지 필요",
    microEventReward: "순간 보상",
    microEventDone: "순간",
    microEventPatterns: "패턴",
    microEventAuto: "자동",
    microEventAutoDesc: "패널이 닫혀 있으면 긴 쿨다운으로 캐릭터가 조용히 작은 순간을 만들 수 있어.",
    microEventSignal: "신호 확인",
    microEventSignalDesc: "작은 데스크톱 단서를 읽고 차분한 반응으로 바꿔.",
    microEventStretch: "픽셀 스트레칭",
    microEventStretchDesc: "다음 움직임을 부드럽게 만드는 작은 몸풀기.",
    microEventNose: "코끝 기록",
    microEventNoseDesc: "작은 필요를 찾아 쓸만한 기억으로 저장해.",
    microEventShimmer: "반짝 걸음",
    microEventShimmerDesc: "방을 조금 더 살아있게 만드는 밝은 걸음.",
    microEventTidy: "깔끔 톡",
    microEventTidyDesc: "먼지 픽셀을 정리하면서 기분도 챙겨.",
    microEventBrave: "용감한 빼꼼",
    microEventBraveDesc: "새 경로를 살짝 확인하고 자신감을 키워.",
    level: "레벨",
    bond: "친밀도",
    xp: "경험치",
    mood: "기분",
    hunger: "포만감",
    happiness: "즐거움",
    energy: "에너지",
    hygiene: "청결",
    training: "훈련",
    personalityTitle: "성격",
    personalityLikes: "좋아함",
    personalityBonus: "보너스",
    personalityProgress: "좋아하는 돌봄",
    personalityCurious: "호기심",
    personalityCuriousDesc: "이상한 픽셀을 살피고 훈련에서 더 빨리 배워.",
    personalityPlayful: "장난꾸러기",
    personalityPlayfulDesc: "돌봄을 움직임으로 바꾸고 놀이 시간을 좋아해.",
    personalityCozy: "느긋함",
    personalityCozyDesc: "낮잠과 픽셀 방 휴식에서 더 잘 회복해.",
    personalityBrave: "용감함",
    personalityBraveDesc: "원정과 과감한 움직임을 좋아해.",
    personalityTidy: "깔끔함",
    personalityTidyDesc: "씻기와 정돈된 돌봄에서 기분이 더 좋아져.",
    personalityClever: "영리함",
    personalityCleverDesc: "기술과 작은 패턴을 빨리 익혀.",
    personalityGentle: "다정함",
    personalityGentleDesc: "쓰다듬기와 차분한 돌봄에서 친밀도가 잘 올라.",
    growthPathTitle: "성장 성향",
    growthCurrent: "현재",
    growthScore: "점수",
    growthNext: "다음",
    growthBonus: "보너스",
    growthExplorer: "탐험가",
    growthExplorerDesc: "원정, 발견, 용감한 이동으로 자라는 성향.",
    growthScholar: "학자",
    growthScholarDesc: "집중, 탤런트, 훈련으로 자라는 성향.",
    growthCozy: "포근함",
    growthCozyDesc: "휴식, 방 관리, 간식, 루틴으로 자라는 성향.",
    growthPerformer: "스타",
    growthPerformerDesc: "놀이, 장난감, 미니게임, 특수 행동으로 자라는 성향.",
    growthRankSprout: "새싹",
    growthRankRising: "성장",
    growthRankSignature: "대표 성향",
    growthRewardsTitle: "성장 보상",
    growthRewardsClaimed: "받음",
    growthRewardNeed: "필요",
    growthRewardClaim: "받기",
    growthRewardClaimed: "받음",
    growthRewardReady: "준비됨",
    growthRewardReward: "보상",
    growthRewardUnlock: "해금",
    growthRewardBurst: "돌봄 이펙트",
    growthRewardMotion: "모션 탄력",
    growthRewardFirstSteps: "첫 걸음",
    growthRewardFirstStepsDesc: "초반 돌봄을 꾸준히 해낸 보상 꾸러미.",
    growthRewardLevelSpark: "레벨 반짝",
    growthRewardLevelSparkDesc: "진짜 친구 단계에 도달한 보상.",
    growthRewardBondRibbon: "친밀 리본",
    growthRewardBondRibbonDesc: "신뢰가 따뜻한 돌봄 리듬으로 돌아와.",
    growthRewardSkillStripe: "훈련 줄무늬",
    growthRewardSkillStripeDesc: "훈련 성장이 또렷한 성장 표시가 돼.",
    growthRewardPathCharm: "성향 참",
    growthRewardPathCharmDesc: "뚜렷한 성장 성향이 작은 보상 꾸러미를 열어.",
    growthRewardHabitBadge: "습관 배지",
    growthRewardHabitBadgeDesc: "열린 습관이 눈에 보이는 육성 보상이 돼.",
    growthRewardMoodCrown: "기분 왕관",
    growthRewardMoodCrownDesc: "기분 패턴이 이 친구만의 루틴을 증명해.",
    growthRewardStoryMedal: "이야기 메달",
    growthRewardStoryMedalDesc: "성장 이야기 챕터가 추억 보상으로 바뀌어.",
    growthRewardAcePack: "에이스 팩",
    growthRewardAcePackDesc: "성숙한 친구까지 키운 큰 보상.",
    quirksTitle: "돌봄 개성",
    quirksActive: "활성",
    quirkNeed: "필요",
    quirkEffect: "효과",
    quirkSnackScout: "간식 정찰",
    quirkSnackScoutDesc: "밥과 간식 돌봄이 예민한 작은 코를 만들었어.",
    quirkZoomDancer: "질주 댄서",
    quirkZoomDancerDesc: "놀이, 산책, 게임이 활발한 움직임으로 자랐어.",
    quirkTidyGlow: "깔끔 반짝",
    quirkTidyGlowDesc: "씻기 돌봄으로 지저분한 순간 뒤에도 반짝여.",
    quirkStudyNudge: "공부 자극",
    quirkStudyNudgeDesc: "훈련과 집중이 꾸준한 학습 습관이 됐어.",
    quirkCozyAnchor: "포근 닻",
    quirkCozyAnchorDesc: "낮잠과 방 휴식이 더 안전한 회복감으로 남았어.",
    quirkSocialSpark: "소셜 반짝",
    quirkSocialSparkDesc: "만남과 팀 순간이 친구 곁에서 더 따뜻하게 만들어.",
    quirkBravePacer: "용감한 보폭",
    quirkBravePacerDesc: "순찰, 산책, 명령이 더 대담한 이동으로 자랐어.",
    quirkMemoryKeeper: "기억지기",
    quirkMemoryKeeperDesc: "이야기가 충분한 친구는 기억하는 것처럼 반응해.",
    quirkCombosTitle: "개성 조합",
    quirkCombosActive: "활성",
    quirkComboNeed: "필요",
    quirkComboEffect: "효과",
    quirkComboPicnicDash: "피크닉 질주",
    quirkComboPicnicDashDesc: "먹는 감각과 활발한 놀이가 명랑한 질주로 이어져.",
    quirkComboSparkStudy: "반짝 공부",
    quirkComboSparkStudyDesc: "깔끔한 돌봄과 훈련이 집중 리듬을 만들어.",
    quirkComboCozyMemoir: "포근 기억",
    quirkComboCozyMemoirDesc: "휴식 돌봄과 추억이 따뜻한 안정 루프로 이어져.",
    quirkComboBraveCircle: "용감한 모임",
    quirkComboBraveCircleDesc: "대담한 이동과 사회성이 친구들을 끌어모아.",
    quirkComboGentleFestival: "다정 축제",
    quirkComboGentleFestivalDesc: "먹이, 친구, 추억이 작은 축제 같은 돌봄을 만들어.",
    quirkComboAceRoutine: "에이스 루틴",
    quirkComboAceRoutineDesc: "공부, 용기, 휴식이 반듯한 하루 흐름을 만들어.",
    moodPatternsTitle: "기분 패턴",
    moodPatternsActive: "활성",
    moodPatternNeed: "필요",
    moodPatternEffect: "효과",
    patternBrightLoop: "반짝 루프",
    patternBrightLoopDesc: "반짝 기분 확인, 놀이, 작은 순간이 움직임을 더 생기 있게 만들어.",
    patternCalmNest: "잔잔 둥지",
    patternCalmNestDesc: "차분한 확인, 쓰담, 낮잠이 부드러운 회복 리듬으로 자라.",
    patternSnackSignal: "간식 신호",
    patternSnackSignalDesc: "배고픔 읽기, 밥주기, 간식 순간이 먹는 타이밍을 또렷하게 해.",
    patternDreamDrift: "꿈결 드리프트",
    patternDreamDriftDesc: "졸림 읽기, 낮잠, 집중 휴식이 조용한 돌봄을 더 효율적으로 만들어.",
    patternCleanSpark: "뽀송 반짝",
    patternCleanSparkDesc: "지저분함 읽기와 씻기가 깔끔한 반짝 습관으로 자라.",
    patternHeartPulse: "하트 파동",
    patternHeartPulseDesc: "외로움 읽기, 쓰담, 친구 돌봄이 따뜻한 친밀 리듬을 만들어.",
    petHabitsTitle: "펫 습관",
    petHabitsActive: "활성",
    petHabitNeed: "필요",
    petHabitEffect: "효과",
    habitSnackNose: "간식 코",
    habitSnackNoseDesc: "밥주기를 반복하면 먹을 때 회복이 더 좋아져.",
    habitZoomies: "신난 발",
    habitZoomiesDesc: "놀이 루프가 더 빠르고 즐거워져.",
    habitGentleHeart: "다정한 마음",
    habitGentleHeartDesc: "꾸준한 쓰담이 더 따뜻한 친밀도로 돌아와.",
    habitTidyPaws: "깔끔 발",
    habitTidyPawsDesc: "씻기 습관으로 더 오래 반짝이는 상태를 유지해.",
    habitStudyLoop: "공부 루프",
    habitStudyLoopDesc: "훈련 습관으로 기술 연습 효율이 좋아져.",
    habitDreamNest: "꿈 둥지",
    habitDreamNestDesc: "휴식 루틴이 에너지를 더 부드럽게 회복시켜.",
    animalInstinctTitle: "동물 본능",
    animalInstinctActive: "각성",
    animalInstinctNeed: "필요",
    animalInstinctEffect: "효과",
    instinctLoyalNose: "충성 코",
    instinctLoyalNoseDesc: "강아지 산책, 놀이, 쓰담이 든든한 복귀 리듬으로 자라.",
    instinctSilentPounce: "조용한 덮치기",
    instinctSilentPounceDesc: "고양이 순찰과 깔끔한 돌봄이 조용한 움직임을 날카롭게 해.",
    instinctMoonHop: "달빛 점프",
    instinctMoonHopDesc: "토끼 놀이와 휴식이 더 부드럽고 통통한 회복으로 이어져.",
    instinctCleverScout: "영리한 정찰",
    instinctCleverScoutDesc: "여우의 이동, 순찰, 훈련이 더 똑똑한 경로를 열어.",
    instinctPocketHoard: "주머니 저장",
    instinctPocketHoardDesc: "햄스터 간식과 장난감이 작은 추진력으로 쌓여.",
    bondPerksTitle: "친밀 퍼크",
    bondPerksUnlocked: "활성",
    bondPerkNeed: "필요",
    bondPerkEffect: "효과",
    caretakerRankTitle: "보호자 랭크",
    caretakerRankScore: "점수",
    caretakerRankNext: "다음",
    caretakerRankMax: "최고 랭크",
    caretakerRankBonus: "보너스",
    caretakerStatPets: "펫",
    caretakerStatCare: "돌봄",
    caretakerStatBond: "친밀",
    caretakerStatCollections: "발견",
    caretakerStatMilestones: "목표",
    caretakerStatPerks: "퍼크",
    caretakerRookie: "초보 보호자",
    caretakerRookieDesc: "작은 습관을 하나씩 배우는 시작 단계.",
    caretakerBuddy: "친구 보호자",
    caretakerBuddyDesc: "여러 루틴을 안정적으로 챙기는 보호자.",
    caretakerMentor: "픽셀 멘토",
    caretakerMentorDesc: "많은 친구의 성장을 이끄는 든든한 멘토.",
    caretakerExpert: "서식지 전문가",
    caretakerExpertDesc: "방, 도감, 훈련, 친밀도를 균형 있게 키워.",
    caretakerLegend: "전설 보호자",
    caretakerLegendDesc: "데스크톱 전체가 네 돌봄으로 살아나는 단계.",
    petSynergyTitle: "펫 시너지",
    petSynergyActive: "활성",
    petSynergyNeed: "필요",
    petSynergyEffect: "효과",
    petSynergyFriend: "단짝",
    petSynergyNoFriend: "시너지를 시작하려면 다른 캐릭터를 켜줘.",
    synergyBuddySpark: "친구 반짝",
    synergyBuddySparkDesc: "가까운 친구가 돌봄에 작은 밝은 힘을 더해.",
    synergyStudyEcho: "학습 메아리",
    synergyStudyEchoDesc: "훈련과 명령 감각이 친구 사이에서 반복돼.",
    synergyCozyNest: "포근 둥지",
    synergyCozyNestDesc: "방 안락도와 루틴이 친구들의 회복을 도와.",
    synergyScoutPack: "정찰 무리",
    synergyScoutPackDesc: "순찰과 발견이 둘의 이동 리듬을 또렷하게 해.",
    synergyParadeSync: "퍼레이드 합",
    synergyParadeSyncDesc: "듀오와 팀 이벤트가 작은 행진처럼 맞물려.",
    lifeStoryTitle: "성장 이야기",
    lifeStoryUnlocked: "챕터",
    lifeStoryNeed: "필요",
    lifeStoryCurrent: "현재",
    storyFirstSteps: "첫걸음",
    storyFirstStepsDesc: "처음의 작은 루틴이 이 친구의 하루가 됐어.",
    storyTrustedPal: "믿는 친구",
    storyTrustedPalDesc: "돌봄, 친밀도, 기억이 안정적인 우정으로 자랐어.",
    storySkillSpark: "기술 반짝",
    storySkillSparkDesc: "훈련, 기술, 명령이 이 친구만의 스타일을 만들기 시작해.",
    storyHomeHeart: "집의 마음",
    storyHomeHeartDesc: "방 안락도, 발견, 시너지가 데스크톱을 집처럼 만들었어.",
    storySignatureTale: "대표 이야기",
    storySignatureTaleDesc: "성장 성향, 폼, 특수 행동이 이 친구의 대표 이야기가 됐어.",
    perkLoyalNudge: "충성 톡",
    perkLoyalNudgeDesc: "돌봄 때 친밀도와 기분이 살짝 더 올라.",
    perkQuickPaws: "빠른 발",
    perkQuickPawsDesc: "움직임이 조금 더 부드럽고 빨라져.",
    perkEagerLearner: "학습 의욕",
    perkEagerLearnerDesc: "꾸준한 훈련으로 돌봄 XP가 살짝 증가해.",
    perkCozyAura: "포근 오라",
    perkCozyAuraDesc: "기분 좋은 상태의 돌봄이 에너지를 조금 더 회복해.",
    perkScoutSense: "정찰 감각",
    perkScoutSenseDesc: "순찰과 도감 활동이 돌봄 보상을 또렷하게 해.",
    perkSignatureTrust: "깊은 신뢰",
    perkSignatureTrustDesc: "높은 친밀도로 속도와 XP가 조금 더 좋아져.",
    ambientTitle: "오늘의 분위기",
    ambientSeason: "계절",
    ambientTime: "시간대",
    ambientTotal: "순간",
    seasonSpring: "봄",
    seasonSummer: "여름",
    seasonAutumn: "가을",
    seasonWinter: "겨울",
    timeDawn: "새벽",
    timeMorning: "아침",
    timeAfternoon: "낮",
    timeEvening: "저녁",
    timeNight: "밤",
    ambientDewSpark: "이슬 반짝",
    ambientDewSparkDesc: "조용한 새벽 픽셀이 기분을 살짝 올려.",
    ambientSunPatch: "햇살 자리",
    ambientSunPatchDesc: "따뜻한 햇살 조각이 에너지를 채워줘.",
    ambientLeafSwirl: "잎사귀 회오리",
    ambientLeafSwirlDesc: "작은 잎들이 움직임을 장난스럽게 만들어.",
    ambientMoonGlow: "달빛 잔잔",
    ambientMoonGlowDesc: "밤빛이 차분한 집중을 만들어줘.",
    ambientSnackScent: "간식 냄새",
    ambientSnackScentDesc: "작은 간식 냄새가 포만감과 친밀도를 올려.",
    ambientStarBlink: "별빛 깜빡",
    ambientStarBlinkDesc: "깜빡이는 하늘 픽셀이 발견 감각을 깨워.",
    ambientSnowQuiet: "눈송이 고요",
    ambientSnowQuietDesc: "부드러운 겨울 고요가 에너지를 회복시켜.",
    ambientFlowerTrail: "꽃길 픽셀",
    ambientFlowerTrailDesc: "봄 색감이 즐거움과 청결을 올려줘.",
    feed: "밥주기",
    play: "놀기",
    pet: "쓰담",
    clean: "씻기",
    train: "훈련",
    nap: "낮잠",
    comboTitle: "케어 콤보",
    comboReady: "준비된 콤보",
    comboStart: "루틴 시작",
    comboChain: "연속",
    comboReward: "콤보 보상",
    comboHint: "다음",
    comboSnackSprint: "간식 질주",
    comboSnackSprintDesc: "밥을 먹고 바로 놀면 밝은 에너지 루틴이 돼.",
    comboSparkleCuddle: "반짝 쓰담",
    comboSparkleCuddleDesc: "깨끗하게 씻고 쓰다듬으면 친밀도가 더 잘 올라.",
    comboFocusReset: "집중 리셋",
    comboFocusResetDesc: "훈련 후 낮잠을 자면 배운 게 차분히 자리 잡아.",
    comboWakeSnack: "기상 간식",
    comboWakeSnackDesc: "낮잠 뒤 밥을 먹으면 부드럽게 컨디션이 돌아와.",
    comboTrustLesson: "신뢰 훈련",
    comboTrustLessonDesc: "쓰담 후 훈련하면 더 자신 있게 배워.",
    comboMuddyFun: "흙먼지 놀이",
    comboMuddyFunDesc: "신나게 논 뒤 씻으면 즐거운 마무리 루틴이 돼.",
    routineTitle: "케어 루틴",
    routineStart: "시작",
    routineNext: "다음",
    routineDoStep: "단계 실행",
    routineDoneToday: "오늘 완료",
    routineStep: "단계",
    routineReward: "루틴 보상",
    routineNeedEnergy: "에너지 필요",
    routineMorning: "아침 루프",
    routineMorningDesc: "밥, 씻기, 놀기로 밝게 시작해.",
    routineSkill: "기술 루틴",
    routineSkillDesc: "훈련, 놀기, 쓰담으로 자신감을 올려.",
    routineCozy: "아늑 리셋",
    routineCozyDesc: "씻기, 쓰담, 낮잠으로 부드럽게 정리해.",
    routinePlay: "놀이 질주",
    routinePlayDesc: "놀고, 훈련하고, 밥으로 마무리해.",
    tricksTitle: "기술",
    trickUse: "실행",
    trickNeed: "필요",
    trickHop: "폴짝",
    trickSpin: "빙글",
    trickDash: "대시",
    trickCircle: "원돌기",
    trickSeek: "찾기",
    trickParade: "행진",
    trickMasteryTitle: "기술 숙련도",
    trickMastery: "숙련",
    trickMasteryNext: "다음",
    trickMasteryComplete: "마스터",
    masteryFresh: "입문",
    masteryNovice: "초급",
    masterySteady: "안정",
    masterySharp: "능숙",
    masteryMaster: "마스터",
    badgeTrickStar: "기술 스타",
    badgeMasterTrainer: "마스터 트레이너",
    expeditionsTitle: "원정",
    expeditionGo: "출발",
    expeditionNeed: "필요",
    expeditionGarden: "정원 산책",
    expeditionSkyline: "하늘 정찰",
    expeditionBuddy: "친구 순찰",
    expeditionTreasure: "보물 루트",
    badgeExplorer: "탐험가",
    specialTitle: "특수 행동",
    specialUse: "실행",
    specialNeedEnergy: "에너지 부족",
    specialReward: "보상",
    specialTimes: "횟수",
    specialReady: "준비됨",
    requestTitle: "오늘의 부탁",
    requestDo: "들어주기",
    requestDone: "오늘 완료",
    requestBonus: "추가 보상",
    requestReason: "기분 읽기",
    milestonesTitle: "성장 목표",
    milestoneClaim: "받기",
    milestoneClaimed: "받음",
    milestoneReady: "준비됨",
    milestoneReward: "보상",
    milestoneFirstCare: "첫 인사",
    milestoneFirstCareDesc: "아무 돌봄 행동을 1번 해줘.",
    milestoneLevel3: "작은 친구",
    milestoneLevel3Desc: "이 캐릭터를 레벨 3까지 키워.",
    milestoneLevel5: "반짝 친구",
    milestoneLevel5Desc: "이 캐릭터를 레벨 5까지 키워.",
    milestoneBond50: "믿는 친구",
    milestoneBond50Desc: "이 캐릭터 친밀도 50 달성.",
    milestoneTraining60: "능숙한 걸음",
    milestoneTraining60Desc: "훈련 60 달성.",
    milestoneToyCollector: "장난감 선반",
    milestoneToyCollectorDesc: "서로 다른 장난감 3개 보유.",
    milestoneToyPlay: "장난감 친구",
    milestoneToyPlayDesc: "장착한 장난감으로 10번 놀기.",
    milestoneCozyCorner: "아늑한 코너",
    milestoneCozyCornerDesc: "방 소품 4개 배치.",
    milestonePersonalityMatch: "찰떡 궁합",
    milestonePersonalityMatchDesc: "이 캐릭터가 좋아하는 돌봄을 8번 해줘.",
    milestoneSeasonWatcher: "분위기 관찰자",
    milestoneSeasonWatcherDesc: "시간대나 계절 순간 12번 모으기.",
    milestoneCollectorHalf: "작은 도감",
    milestoneCollectorHalfDesc: "도감 보물 6종 발견.",
    milestoneCharmCrafter: "참 제작자",
    milestoneCharmCrafterDesc: "수집 참 4종 모두 제작.",
    milestoneMemoryBook: "추억 책",
    milestoneMemoryBookDesc: "최근 기억 8개 쌓기.",
    milestoneSocialCircle: "친구 모임",
    milestoneSocialCircleDesc: "친구 점수 합계 160 달성.",
    milestonePlaydateHost: "만남 주최자",
    milestonePlaydateHostDesc: "친구 플레이데이트 6번 열기.",
    milestoneDuoBond: "듀오 리듬",
    milestoneDuoBondDesc: "합동 행동 10번 사용.",
    milestonePackLeader: "팀 리더",
    milestonePackLeaderDesc: "팀 이벤트 8번 실행.",
    milestoneContestChampion: "리그 챔피언",
    milestoneContestChampionDesc: "펫 콘테스트 10번 참가.",
    milestoneLeagueCollector: "시즌 선반",
    milestoneLeagueCollectorDesc: "리그 시즌 보상 전부 받기.",
    milestoneMedalCollector: "메달 선반",
    milestoneMedalCollectorDesc: "리그 메달 전부 해금.",
    milestoneMedalChallenger: "메달 러너",
    milestoneMedalChallengerDesc: "장착 메달 챌린지 12회 실행.",
    milestoneWalkLeader: "산책 리더",
    milestoneWalkLeaderDesc: "친구 산책 10번 다녀오기.",
    milestoneYardTrainer: "훈련장 코치",
    milestoneYardTrainerDesc: "훈련장 코스 12번 완료.",
    milestonePatrolCaptain: "순찰 대장",
    milestonePatrolCaptainDesc: "데스크톱 순찰 18번 완료.",
    milestoneObjectPlayer: "데스크톱 놀이",
    milestoneObjectPlayerDesc: "데스크톱 장난감 12번 잡기.",
    milestoneRoutineKeeper: "루틴 빌더",
    milestoneRoutineKeeperDesc: "케어 루틴 10번 완료.",
    milestoneCommandTrainer: "명령 훈련사",
    milestoneCommandTrainerDesc: "직접 명령 16번 사용.",
    milestoneFormAscended: "폼 성장",
    milestoneFormAscendedDesc: "진화 폼 4종 보상 받기.",
    milestoneTrickStarter: "기술 리듬",
    milestoneTrickStarterDesc: "기술을 12번 사용.",
    milestoneTrickMaster: "기술 마스터",
    milestoneTrickMasterDesc: "기술 숙련도 합계 12 달성.",
    milestoneMissionScout: "원정 정찰자",
    milestoneMissionScoutDesc: "원정을 8번 완료.",
    milestoneDailyStreak: "꾸준한 친구",
    milestoneDailyStreakDesc: "연속 출석 5일 달성.",
    milestoneSignaturePerformer: "시그니처 반짝",
    milestoneSignaturePerformerDesc: "특수 행동 12번 사용.",
    milestoneRequestHelper: "말 잘 듣는 친구",
    milestoneRequestHelperDesc: "캐릭터 부탁 10번 들어주기.",
    milestoneComboKeeper: "루틴 지킴이",
    milestoneComboKeeperDesc: "케어 콤보 8번 완료.",
    milestoneRoomDesigner: "방 리듬",
    milestoneRoomDesignerDesc: "픽셀 방에서 8번 놀기.",
    milestoneRoomEventHost: "방 이벤트 주최자",
    milestoneRoomEventHostDesc: "방 이벤트 14번 실행.",
    milestoneMiniGameChamp: "게임 챔피언",
    milestoneMiniGameChampDesc: "미니게임 10번 플레이.",
    milestoneEffectCollector: "잔상 선반",
    milestoneEffectCollectorDesc: "이펙트 4종 보유.",
    milestoneEggHatcher: "둥지 지킴이",
    milestoneEggHatcherDesc: "알 둥지에서 3번 부화시키기.",
    milestoneSnackChef: "간식 셰프",
    milestoneSnackChefDesc: "좋아하는 간식 10번 챙겨주기.",
    milestonePetAlbum: "펫 앨범",
    milestonePetAlbumDesc: "펫 앨범에 캐릭터 10종 등록.",
    milestoneMoodReader: "기분 리더",
    milestoneMoodReaderDesc: "캐릭터 기분을 12번 확인.",
    milestoneMoodPatternKeeper: "기분 패턴",
    milestoneMoodPatternKeeperDesc: "한 캐릭터의 기분 패턴 3개 깨우기.",
    milestoneTalentGraduate: "탤런트 스쿨",
    milestoneTalentGraduateDesc: "탤런트 레벨 합계 9 달성.",
    milestoneJobHelper: "작은 일꾼",
    milestoneJobHelperDesc: "작은 일거리 12번 완료.",
    milestoneFocusBuddy: "집중 친구",
    milestoneFocusBuddyDesc: "집중 세션 8번 완료.",
    milestoneGrowthPath: "성장 성향",
    milestoneGrowthPathDesc: "한 성장 성향에서 120점 달성.",
    milestoneHabitKeeper: "습관지기",
    milestoneHabitKeeperDesc: "모든 펫 습관 해금.",
    milestoneInstinctKeeper: "본능지기",
    milestoneInstinctKeeperDesc: "동물 친구의 본능을 깨우기.",
    milestonePerkKeeper: "퍼크 지킴이",
    milestonePerkKeeperDesc: "친밀 퍼크 전부 해금.",
    milestoneCaretakerMentor: "보호자 랭크",
    milestoneCaretakerMentorDesc: "보호자 점수 360점 달성.",
    milestoneSynergyKeeper: "시너지 지킴이",
    milestoneSynergyKeeperDesc: "모든 펫 시너지 활성화.",
    milestoneStoryArchivist: "이야기 기록가",
    milestoneStoryArchivistDesc: "모든 성장 이야기 챕터 해금.",
    milestoneDailyChampion: "오늘 챔피언",
    milestoneDailyChampionDesc: "오늘 목표를 전부 완료.",
    badgeMilestoneKeeper: "목표 지킴이",
    badgeRoomMaker: "방 꾸미기",
    badgePersonalityMatch: "찰떡 궁합",
    badgeSeasonPal: "분위기 친구",
    badgeDailyStreak: "꾸준한 친구",
    badgeSignatureStar: "시그니처 스타",
    badgeRequestHelper: "말 잘 듣는 친구",
    badgeComboPal: "콤보 친구",
    badgeToyBuddy: "장난감 친구",
    badgeRoomDesigner: "방 친구",
    badgeRoomEventHost: "방 이벤트",
    badgeMiniGamer: "게임 친구",
    badgeTrailStylist: "잔상 스타일러",
    badgeNestKeeper: "둥지 지킴이",
    badgeSnackChef: "간식 셰프",
    badgePetAlbum: "펫 앨범",
    badgeMoodReader: "기분 리더",
    badgeMoodPattern: "기분 패턴",
    badgeGrowthReward: "성장 보상",
    badgeQuirkKeeper: "개성지기",
    badgeQuirkCombo: "개성 조합",
    badgeTalentGraduate: "탤런트 졸업",
    badgeJobHelper: "작은 일꾼",
    badgeFocusBuddy: "집중 친구",
    badgeMomentMaker: "순간 메이커",
    badgeGrowthPath: "성장 성향",
    badgeHabitKeeper: "습관지기",
    badgeInstinctKeeper: "본능 친구",
    badgePerkKeeper: "퍼크 지킴이",
    badgeCaretakerRank: "픽셀 멘토",
    badgeSynergyKeeper: "시너지 지킴이",
    badgeStoryArchivist: "이야기 기록가",
    badgeDuoBuddy: "듀오 친구",
    badgeObjectPal: "책상 장난감",
    badgeRoutineKeeper: "루틴 빌더",
    badgeCommandTrainer: "명령 훈련사",
    badgeEvolutionKeeper: "폼 지킴이",
    baby: "새싹",
    buddy: "친구",
    ace: "에이스",
    bright: "반짝",
    hungry: "배고픔",
    sleepy: "졸림",
    messy: "찝찝",
    lonely: "심심",
    calm: "차분",
    moodAuraTitle: "기분 오라",
    moodAuraCheck: "기분 확인",
    moodAuraSeen: "확인",
    moodAuraReward: "기분 보상",
    moodBrightAura: "반짝 오라",
    moodBrightAuraDesc: "컨디션이 좋아서 훈련과 놀이가 잘 통해.",
    moodCalmAura: "잔잔 오라",
    moodCalmAuraDesc: "차분한 상태라 에너지와 친밀도가 안정돼.",
    moodHungryAura: "간식 신호",
    moodHungryAuraDesc: "배고픈 신호를 읽고 포만감을 살짝 채워.",
    moodSleepyAura: "꿈결 오라",
    moodSleepyAuraDesc: "졸린 픽셀이 보여서 에너지를 부드럽게 회복해.",
    moodMessyAura: "뽀송 반짝",
    moodMessyAuraDesc: "먼지 픽셀을 읽고 청결 반짝임을 깨워.",
    moodLonelyAura: "하트 파동",
    moodLonelyAuraDesc: "관심이 필요한 상태라 친밀도가 더 올라.",
    talentSchoolTitle: "탤런트 스쿨",
    talentTrain: "연습",
    talentLevel: "탤런트 레벨",
    talentProgress: "진행",
    talentNeedEnergy: "에너지 필요",
    talentNeedSkill: "훈련 필요",
    talentReward: "탤런트 보상",
    talentAgility: "민첩",
    talentAgilityDesc: "방향 전환이 더 날렵해지고 이동감이 살짝 좋아져.",
    talentFocus: "집중",
    talentFocusDesc: "기술과 원정을 배우는 리듬이 더 안정돼.",
    talentCharm: "매력",
    talentCharmDesc: "친구 순간과 친밀도가 더 따뜻하게 올라.",
    jobBoardTitle: "작은 일거리",
    jobRun: "시작",
    jobNeed: "필요",
    jobNeedEnergy: "에너지 필요",
    jobNeedLevel: "레벨 필요",
    jobNeedSkill: "훈련 필요",
    jobReward: "일거리 보상",
    jobReputation: "평판",
    jobPocketScout: "주머니 정찰",
    jobPocketScoutDesc: "바탕화면 가장자리에서 작은 발견을 찾아와.",
    jobDeskHelper: "책상 도우미",
    jobDeskHelperDesc: "집중 픽셀로 작은 일을 정리해.",
    jobJoyShow: "기쁨 쇼",
    jobJoyShowDesc: "작은 응원 공연으로 코인과 친밀도를 올려.",
    questsTitle: "오늘 목표",
    coins: "코인",
    done: "완료",
    dailyStreakTitle: "연속 출석",
    dailyStreak: "연속",
    dailyBest: "최고",
    dailyClaim: "받기",
    dailyClaimed: "받음",
    dailyStreakReward: "출석 보상",
    questFeed: "밥 챙기기",
    questPlay: "같이 놀기",
    questPet: "쓰다듬기",
    questClean: "깨끗하게 하기",
    questTrain: "훈련하기",
    questNap: "낮잠 재우기",
    questSocial: "친구 만나기",
    questDuo: "합동 행동 쓰기",
    questPack: "팀 이벤트 하기",
    questContest: "펫 콘테스트 참가",
    questDeskObject: "장난감 잡기",
    questRoutine: "루틴 완료",
    questCommand: "명령 안내하기",
    questDiscover: "보물 발견하기",
    questCharm: "참 만들거나 장착하기",
    questExpedition: "원정 보내기",
    questSpecial: "특수 행동 쓰기",
    questRequest: "부탁 들어주기",
    questCombo: "케어 콤보 완성",
    questToyPlay: "장난감으로 놀기",
    questRoomPlay: "방에서 놀기",
    questRoomEvent: "방 이벤트 하기",
    questMiniGame: "미니게임 하기",
    questEffect: "이펙트 꾸미기",
    questEggCare: "알 따뜻하게 하기",
    questSnack: "간식 챙기기",
    questMood: "기분 읽기",
    questTalent: "탤런트 연습",
    questJob: "일거리 완료",
    questFocus: "집중 완료",
    questMicroEvent: "작은 순간 시작",
    questMedalTrial: "메달 챌린지 실행",
    questPetWalk: "산책 다녀오기",
    questTrainingYard: "훈련장 완료",
    questPatrol: "순찰 돌기",
    questReward: "보상",
    focusModeTitle: "집중 모드",
    focusStart: "시작",
    focusBank: "보관",
    focusCancel: "취소",
    focusRunning: "진행",
    focusReady: "완료 가능",
    focusTotal: "총 시간",
    focusBest: "최고",
    focusSessions: "횟수",
    focusReward: "집중 보상",
    focusNeedTime: "1분 필요",
    focusOtherPet: "다른 펫이 집중 중",
    focusIdleHint: "시간을 고르면 펫이 네 작업을 지켜봐.",
    nurseryTitle: "알 둥지",
    nurseryProgress: "따뜻함",
    nurseryHatched: "부화",
    nurseryNext: "다음 부화",
    nurseryEmptySlot: "빈 슬롯 준비됨",
    nurseryFull: "슬롯이 가득 참",
    nurseryWarm: "알 데우기",
    nurseryNeedEnergy: "에너지 필요",
    nurseryReward: "둥지 보상",
    nurseryHint: "알을 따뜻하게 돌보면 새 동물 친구가 부화해.",
    nurseryReady: "부화 준비 완료",
    nurseryBonus: "부화 보너스",
    snackPantryTitle: "간식 창고",
    snackServe: "주기",
    snackBuy: "구매",
    snackOwned: "보유",
    snackFavorite: "최애",
    snackGood: "좋아함",
    snackNeedCoins: "코인 필요",
    snackReward: "간식 보상",
    snackServed: "간식 완료",
    snackBerryBite: "베리 한입",
    snackBerryBiteDesc: "기분이 오르는 달콤한 베리 픽셀.",
    snackMoonMilk: "달빛 우유",
    snackMoonMilkDesc: "에너지를 부드럽게 채워줘.",
    snackCrunchyStar: "바삭 별",
    snackCrunchyStarDesc: "훈련에 도움 되는 작은 별 간식.",
    snackCleanMint: "민트 캔디",
    snackCleanMintDesc: "깔끔한 친구에게 좋은 상쾌한 민트.",
    snackFocusBean: "집중 콩",
    snackFocusBeanDesc: "기술 연습 감각을 깨워줘.",
    snackCozyCookie: "포근 쿠키",
    snackCozyCookieDesc: "포만감과 친밀도를 같이 올려줘.",
    effectShopTitle: "잔상 스튜디오",
    effectBuy: "구매",
    effectEquip: "장착",
    effectEquipped: "장착됨",
    effectOwned: "보유",
    effectNeedCoins: "코인 필요",
    effectReward: "스타일 보상",
    effectNormal: "민트 잔상",
    effectNormalDesc: "깔끔한 픽셀 잔상.",
    effectSpark: "반짝 잔상",
    effectSparkDesc: "작은 불빛이 따라와.",
    effectBubble: "버블 잔상",
    effectBubbleDesc: "방울이 위로 올라가.",
    effectPixel: "픽셀 팝",
    effectPixelDesc: "색 픽셀이 흩어져.",
    effectRainbow: "무지개 꼬리",
    effectRainbowDesc: "긴 컬러 꼬리 효과.",
    miniGameTitle: "미니게임",
    miniGameBest: "최고",
    miniGameScore: "점수",
    miniGamePlay: "플레이",
    miniGameNeed: "에너지 필요",
    miniGameReward: "게임 보상",
    miniStarCatch: "별 잡기",
    miniStarCatchDesc: "작은 별을 잡아 기분을 올려.",
    miniBubbleDodge: "버블 피하기",
    miniBubbleDodgeDesc: "빠르게 움직여 방울을 피해.",
    miniMemorySteps: "기억 발걸음",
    miniMemoryStepsDesc: "순서를 기억해 훈련을 올려.",
    toyBox: "장난감",
    equip: "장착",
    equipped: "장착됨",
    buy: "구매",
    owned: "보유",
    notEnoughCoins: "코인이 부족해",
    toyRibbon: "집중 리본",
    toyBell: "해피 방울",
    toyBall: "통통 공",
    toyBrush: "뽀송 브러시",
    toyRocketSnack: "로켓 간식",
    toyStarBlanket: "별 담요",
    toyPlayTitle: "장난감 놀이",
    toyPlay: "장난감으로 놀기",
    toyPlayNeed: "먼저 장난감을 장착해줘",
    toyPlayMastery: "장난감 숙련",
    toyPlayReward: "놀이 보상",
    toyPlayNext: "다음",
    deskObjectTitle: "데스크톱 장난감",
    deskObjectThrow: "던지기",
    deskObjectCount: "잡음",
    deskObjectNeedEnergy: "에너지 필요",
    deskObjectReward: "잡기 보상",
    deskBall: "통통 공",
    deskBallDesc: "캐릭터가 쫓아가는 활발한 공.",
    deskTreat: "간식 점",
    deskTreatDesc: "후다닥 달려갈 작은 간식.",
    deskStar: "반짝 별",
    deskStarDesc: "연습하기 좋은 밝은 목표.",
    deskBubble: "버블 팝",
    deskBubbleDesc: "푸른 픽셀이 톡 터지는 청결 놀이.",
    evolutionTitle: "진화 폼",
    evolutionCurrent: "현재",
    evolutionClaim: "받기",
    evolutionClaimed: "받음",
    evolutionLocked: "잠김",
    evolutionNeed: "필요",
    evolutionReward: "보상",
    formSprout: "새싹 폼",
    formSproutDesc: "기본 돌봄으로 열리는 첫 밝은 폼.",
    formBuddy: "친구 폼",
    formBuddyDesc: "꾸준한 친밀도로 따뜻해진 폼.",
    formAce: "에이스 폼",
    formAceDesc: "훈련 리듬이 잡힌 날렵한 폼.",
    formSignature: "시그니처 폼",
    formSignatureDesc: "가장 강한 성장 성향으로 완성된 폼.",
    commandTitle: "명령 훈련",
    commandUse: "지시",
    commandTimes: "사용",
    commandNeedEnergy: "에너지 필요",
    commandCome: "이리와",
    commandComeDesc: "커서나 화면 중앙 쪽으로 이동해.",
    commandSlow: "천천히",
    commandSlowDesc: "잠깐 차분하게 느린 속도로 움직여.",
    commandDash: "대시",
    commandDashDesc: "바라보는 방향으로 빠르게 튀어나가.",
    commandSpin: "빙글",
    commandSpinDesc: "제자리에서 반짝 돌기.",
    commandHide: "숨기",
    commandHideDesc: "가장자리로 슬쩍 숨어서 다시 나와.",
    commandOrbit: "돌기",
    commandOrbitDesc: "현재 위치 주변을 둥글게 돌아.",
    habitatTitle: "픽셀 방",
    habitatComfort: "안락도",
    habitatThemesTitle: "방 테마",
    habitatTheme: "테마",
    habitatThemeUse: "사용",
    habitatThemeActive: "적용됨",
    habitatThemeLocked: "안락도 필요",
    habitatSetBonus: "세트 보너스",
    habitatNoSet: "맞는 소품을 배치하면 보너스가 열려.",
    habitatRoomPlay: "방에서 놀기",
    habitatRoomPlayNeed: "먼저 소품을 배치해줘",
    habitatRoomReward: "방 보상",
    habitatRest: "쉬기",
    habitatBuy: "구매",
    habitatPlace: "배치",
    habitatRemove: "빼기",
    habitatFull: "방이 꽉 찼어",
    habitatEmptySlot: "빈칸",
    habitatOwned: "보유",
    habitatMat: "폭신 매트",
    habitatMatDesc: "짧게 쉬기 좋은 차분한 바닥.",
    habitatPlant: "미니 식물",
    habitatPlantDesc: "기분을 올려주는 작은 초록 코너.",
    habitatLamp: "빛 램프",
    habitatLampDesc: "졸린 친구에게 따뜻한 빛.",
    habitatCushion: "퐁신 쿠션",
    habitatCushionDesc: "많이 돌아다닌 뒤 안락함 추가.",
    habitatSnackBowl: "간식 그릇",
    habitatSnackBowlDesc: "포만감을 차분하게 유지해줘.",
    habitatClock: "작은 시계",
    habitatClockDesc: "훈련 리듬을 차분하게 잡아줘.",
    habitatBook: "픽셀 책",
    habitatBookDesc: "조용한 기술 코너.",
    habitatWindow: "하늘 창문",
    habitatWindowDesc: "기분이 밝아지는 작은 환기.",
    habitatThemeCozy: "아늑함",
    habitatThemeCozyDesc: "차분하게 쉬는 따뜻한 방.",
    habitatThemeGarden: "정원",
    habitatThemeGardenDesc: "기분이 밝아지는 초록 방.",
    habitatThemeNight: "밤하늘",
    habitatThemeNightDesc: "졸린 친구를 위한 푸른 방.",
    habitatThemeStudy: "공부방",
    habitatThemeStudyDesc: "기술 연습에 집중하는 방.",
    habitatSetCozyNest: "아늑한 둥지",
    habitatSetCozyNestDesc: "매트 + 쿠션 + 램프.",
    habitatSetGardenNook: "정원 코너",
    habitatSetGardenNookDesc: "식물 + 창문 + 간식 그릇.",
    habitatSetStudyDesk: "공부 책상",
    habitatSetStudyDeskDesc: "책 + 시계 + 램프.",
    habitatSetPicnicMat: "피크닉 매트",
    habitatSetPicnicMatDesc: "매트 + 식물 + 간식 그릇.",
    roomEventTitle: "방 이벤트",
    roomEventRun: "실행",
    roomEventNeedItems: "소품 필요",
    roomEventNeedEnergy: "에너지 필요",
    roomEventReward: "이벤트 보상",
    roomEventDone: "이벤트",
    roomEventPlantCare: "식물 돌보기",
    roomEventPlantCareDesc: "초록 코너에 물을 주고 산뜻한 픽셀을 털어내.",
    roomEventStudySession: "공부 세션",
    roomEventStudySessionDesc: "책과 시계를 써서 집중 연습 루프를 돌아.",
    roomEventCozyReset: "아늑한 리셋",
    roomEventCozyResetDesc: "매트와 쿠션에서 부드럽게 컨디션을 정리해.",
    roomEventSnackPicnic: "간식 피크닉",
    roomEventSnackPicnicDesc: "매트와 간식 그릇으로 작은 피크닉을 열어.",
    roomEventWindowWatch: "창밖 관찰",
    roomEventWindowWatchDesc: "하늘 창문을 보며 작은 보물을 발견할 수도 있어.",
    roomEventLampFocus: "램프 집중",
    roomEventLampFocusDesc: "따뜻한 램프빛으로 조용한 공부를 또렷하게 해.",
    badgesTitle: "배지",
    locked: "잠김",
    badgeFirstCare: "첫 돌봄",
    badgeLevel5: "레벨 5",
    badgeBond50: "친밀도 50",
    badgeTraining60: "훈련 60",
    badgeDailyDone: "오늘 완료",
    badgeToyOwner: "장난감 보유",
    badgeMemoryKeeper: "기억 수집가",
    badgeBestFriend: "단짝 친구",
    badgeCollector: "수집가",
    badgeCharmCrafter: "참 제작자",
    badgePlaydateHost: "만남 주최자",
    badgePackLeader: "팀 리더",
    badgeContestChamp: "리그 챔피언",
    badgeLeagueCollector: "시즌 선반",
    badgeMedalCollector: "메달 선반",
    badgeMedalRunner: "메달 러너",
    badgeWalkBuddy: "산책 친구",
    badgeYardTrainer: "훈련장 코치",
    badgePatrolScout: "순찰 정찰",
    friendsTitle: "친구",
    noFriends: "친구 관계를 만들려면 캐릭터를 더 켜줘.",
    friendNew: "새 친구",
    friendPal: "친구",
    friendClose: "절친",
    friendBest: "단짝",
    playdate: "만나기",
    playdateNeedEnergy: "에너지가 부족해",
    playdateCooldown: "방금 만나서 쉬는 중",
    duoTitle: "합동",
    duoUse: "사용",
    duoLocked: "친밀도 필요",
    duoNeedEnergy: "에너지 필요",
    duoBuddyDash: "친구 대시",
    duoBuddyDashDesc: "두 친구가 같은 박자로 데스크톱을 가로질러.",
    duoStudyPair: "공부 짝",
    duoStudyPairDesc: "둘이 집중해서 훈련 감각을 올려.",
    duoSnackShare: "간식 나눔",
    duoSnackShareDesc: "작은 간식을 나눠 먹고 따뜻해져.",
    duoStarParade: "별 퍼레이드",
    duoStarParadeDesc: "가까운 친구들이 반짝 퍼레이드를 해.",
    packTitle: "팀 이벤트",
    packRun: "실행",
    packMembers: "팀",
    packTimes: "횟수",
    packNeedMembers: "친구 필요",
    packNeedEnergy: "에너지 필요",
    packReward: "팀 보상",
    packGarden: "정원 정리",
    packGardenDesc: "친구들이 작은 잎을 치우고 차분함을 나눠.",
    packScout: "가장자리 정찰",
    packScoutDesc: "팀이 바탕화면 가장자리에서 발견을 찾아.",
    packDrill: "동작 훈련",
    packDrillDesc: "함께 움직이며 훈련 리듬을 맞춰.",
    packParade: "픽셀 행진",
    packParadeDesc: "밝은 행진으로 팀 친밀도를 올려.",
    contestTitle: "펫 리그",
    contestEnter: "참가",
    contestBest: "최고",
    contestScore: "점수",
    contestNeedLevel: "레벨 필요",
    contestNeedEnergy: "에너지 필요",
    contestReward: "상금",
    contestBronze: "브론즈",
    contestSilver: "실버",
    contestGold: "골드",
    contestMaster: "마스터",
    contestSprint: "스프린트 코스",
    contestSprintDesc: "훈련, 에너지, 레벨로 빠른 코스를 평가해.",
    contestCozy: "포근 쇼",
    contestCozyDesc: "행복, 청결, 친밀도로 차분한 매력을 평가해.",
    contestTrick: "기술 무대",
    contestTrickDesc: "기술, 명령, 훈련으로 무대 실력을 평가해.",
    contestRelay: "친구 릴레이",
    contestRelayDesc: "친구 관계와 팀 활동으로 릴레이를 평가해.",
    leagueSeasonTitle: "리그 시즌",
    leagueSeasonPoints: "시즌 포인트",
    leagueSeasonBest: "최고 시즌",
    leagueSeasonClaim: "받기",
    leagueSeasonClaimed: "받음",
    leagueSeasonLocked: "포인트 필요",
    leagueSeasonReward: "시즌 보상",
    leagueSeasonGain: "시즌",
    leagueTierWarmup: "준비 상자",
    leagueTierBronze: "브론즈 상자",
    leagueTierGold: "골드 상자",
    leagueTierMaster: "마스터 상자",
    medalTitle: "리그 메달",
    medalEquip: "장착",
    medalEquipped: "장착됨",
    medalLocked: "잠김",
    medalNone: "메달 없음",
    medalRequirement: "필요",
    medalRookie: "루키",
    medalRookieDesc: "첫 리그 발자국.",
    medalSprinter: "스프린터",
    medalSprinterDesc: "빠른 코스 메달.",
    medalCozy: "포근 스타",
    medalCozyDesc: "차분한 쇼 메달.",
    medalTrickAce: "기술 에이스",
    medalTrickAceDesc: "기술 무대 메달.",
    medalRelayHero: "릴레이 히어로",
    medalRelayHeroDesc: "친구 릴레이 메달.",
    medalSeasonStar: "시즌 스타",
    medalSeasonStarDesc: "시즌 보상 메달.",
    medalTrialTitle: "메달 챌린지",
    medalTrialRun: "실행",
    medalTrialNeedMedal: "먼저 메달을 장착해줘.",
    medalTrialEnergy: "에너지",
    medalTrialReward: "챌린지 보상",
    medalTrialTimes: "챌린지",
    medalTrialPerk: "메달 보너스",
    medalTrialReady: "준비됨",
    medalTrialTired: "에너지 필요",
    medalTrialDone: "챌린지 완료",
    walkTitle: "펫 산책",
    walkRun: "산책",
    walkTimes: "산책",
    walkNeedLevel: "레벨 필요",
    walkNeedEnergy: "에너지 필요",
    walkReward: "산책 보상",
    walkAnimalBonus: "동물 보너스",
    walkSnackBonus: "간식 보너스",
    walkReady: "준비됨",
    walkGarden: "정원 루프",
    walkGardenDesc: "방 comfort와 산뜻한 기분을 살리는 밝은 산책.",
    walkTrack: "훈련 트랙",
    walkTrackDesc: "기술, 에너지, 깔끔한 움직임을 올리는 빠른 코스.",
    walkSnackTrail: "간식 길",
    walkSnackTrailDesc: "좋아하는 간식으로 더 신나는 산책.",
    walkNightStroll: "밤 산책",
    walkNightStrollDesc: "친밀도와 회복을 위한 차분한 저녁 산책.",
    yardTitle: "훈련장",
    yardRun: "훈련",
    yardTimes: "훈련",
    yardNeedLevel: "레벨 필요",
    yardNeedEnergy: "에너지 필요",
    yardReward: "훈련 보상",
    yardAnimalBonus: "동물 보너스",
    yardWalkBonus: "산책 리듬",
    yardMedalBonus: "메달 집중",
    yardToyBonus: "장난감 보너스",
    yardReady: "준비됨",
    yardAgility: "민첩 터널",
    yardAgilityDesc: "산책 경험이 빛나는 빠른 지그재그 코스.",
    yardRecall: "호출 훈련",
    yardRecallDesc: "동물 친구가 더 빨리 배우는 친밀도 훈련.",
    yardBalance: "균형 빔",
    yardBalanceDesc: "훈련 수치가 높을수록 안정되는 코스.",
    yardHoops: "집중 링",
    yardHoopsDesc: "장착 메달 집중력이 살아나는 링 코스.",
    patrolTitle: "순찰 루트",
    patrolRun: "순찰",
    patrolTimes: "순찰",
    patrolNeedLevel: "레벨 필요",
    patrolNeedEnergy: "에너지 필요",
    patrolReward: "순찰 보상",
    patrolAnimalBonus: "동물 정찰",
    patrolWalkBonus: "산책 지도",
    patrolDiscoveryBonus: "발견 확률",
    patrolComfortBonus: "방 안락도",
    patrolReady: "준비됨",
    patrolEdge: "가장자리",
    patrolEdgeDesc: "데스크톱 가장자리를 살피고 작은 표시를 정리해.",
    patrolCursor: "커서길",
    patrolCursorDesc: "커서 잔향을 따라가며 산책 리듬을 써.",
    patrolIcon: "아이콘 감시",
    patrolIconDesc: "조용한 아이콘 틈에서 도감 기회를 찾아.",
    patrolCozy: "포근 순찰",
    patrolCozyDesc: "방 안락도와 차분한 상태를 살리는 부드러운 루트.",
    collectionTitle: "도감",
    collectionFound: "수집",
    collectionEmpty: "돌아다니다 발견한 작은 보물이 여기에 쌓여.",
    charmWorkshopTitle: "참 공방",
    charmCraft: "제작",
    charmEquip: "장착",
    charmEquipped: "장착됨",
    charmOwned: "보유",
    charmNeedItems: "재료 필요",
    charmRecipe: "재료",
    charmBonus: "참 보너스",
    charmLuckyLeaf: "행운 잎",
    charmLuckyLeafDesc: "장난기 있는 움직임과 작은 발견을 돕는 가벼운 참.",
    charmFocusGem: "집중 보석",
    charmFocusGemDesc: "훈련과 탤런트 연습을 또렷하게 해주는 공부 참.",
    charmCozyShell: "아늑 조개",
    charmCozyShellDesc: "낮잠, 쓰다듬기, 차분한 친밀도를 돕는 부드러운 참.",
    charmRainbowPin: "무지개 핀",
    charmRainbowPinDesc: "놀이와 특수 행동을 더 반짝이게 하는 밝은 참.",
    petAlbumTitle: "펫 앨범",
    petAlbumSeen: "등록",
    petAlbumLevel: "최고 레벨",
    petAlbumActive: "활성",
    petAlbumHidden: "아직 모르는 친구",
    petAlbumHint: "캐릭터를 켜거나 부화시키고 돌보면 앨범에 등록돼.",
    petAlbumFavorite: "좋아함",
    rarityCommon: "일반",
    rarityRare: "희귀",
    rarityEpic: "영롱",
    memoriesTitle: "기억장",
    emptyMemories: "돌봄, 발견, 친구 순간들이 여기에 쌓여.",
  },
};

const DEFAULT_CARE = Object.freeze({
  level: 1,
  xp: 0,
  bond: 0,
  hunger: 72,
  happiness: 76,
  energy: 78,
  hygiene: 82,
  training: 0,
  equippedToy: "",
  equippedEffect: "normal",
  equippedCharm: "",
  equippedMedal: "",
  request: { dayKey: "", action: "", done: false, seed: 0 },
  combo: { lastAction: "", lastAt: 0, chain: 0 },
  routine: { id: "", step: 0, dayKey: "", completedToday: false },
  growthRewards: [],
  memories: [],
  friendships: {},
  lastCareAt: 0,
  lastActionAt: 0,
  actionCounts: {},
});

const CARE_ACTIONS = Object.freeze({
  feed: { icon: "🍙", xp: 8, bond: 2, hunger: 24, happiness: 4, energy: 2, hygiene: -2 },
  play: { icon: "🎾", xp: 14, bond: 5, hunger: -7, happiness: 24, energy: -13, hygiene: -5 },
  pet: { icon: "✋", xp: 6, bond: 4, hunger: 0, happiness: 15, energy: 4, hygiene: 0 },
  clean: { icon: "🫧", xp: 9, bond: 2, hunger: -2, happiness: 5, energy: -2, hygiene: 30 },
  train: { icon: "🏅", xp: 18, bond: 5, hunger: -9, happiness: 7, energy: -17, hygiene: -4, training: 10 },
  nap: { icon: "☾", xp: 5, bond: 1, hunger: -4, happiness: 3, energy: 32, hygiene: 0 },
});

const PET_HABITS = Object.freeze({
  snackNose: {
    icon: "SN",
    labelKey: "habitSnackNose",
    descKey: "habitSnackNoseDesc",
    color: "#fb923c",
    target: 8,
    sources: { feed: 1, snackUse: 1, eggCare: 0.5 },
    effect: { xp: 1.02, care: { feed: { hunger: 4, happiness: 1 } } },
  },
  zoomies: {
    icon: "ZM",
    labelKey: "habitZoomies",
    descKey: "habitZoomiesDesc",
    color: "#38bdf8",
    target: 10,
    sources: { play: 1, petWalk: 0.8, miniGame: 0.7, toyPlay: 0.6 },
    effect: { speed: 1.04, xp: 1.02, care: { play: { happiness: 3 } } },
  },
  gentleHeart: {
    icon: "GH",
    labelKey: "habitGentleHeart",
    descKey: "habitGentleHeartDesc",
    color: "#fb7185",
    target: 8,
    sources: { pet: 1, playdate: 0.8, duoMove: 0.6 },
    effect: { xp: 1.03, care: { pet: { bond: 2, happiness: 1 } } },
  },
  tidyPaws: {
    icon: "TP",
    labelKey: "habitTidyPaws",
    descKey: "habitTidyPawsDesc",
    color: "#42d7c5",
    target: 8,
    sources: { clean: 1, roomEvent: 0.5, habitatRest: 0.4 },
    effect: { speed: 1.01, care: { clean: { hygiene: 4, happiness: 1 } } },
  },
  studyLoop: {
    icon: "SL",
    labelKey: "habitStudyLoop",
    descKey: "habitStudyLoopDesc",
    color: "#3a87ff",
    target: 10,
    sources: { train: 1, command: 0.8, trainingYard: 0.8, talentTrain: 0.6 },
    effect: { xp: 1.04, care: { train: { training: 3 } } },
  },
  dreamNest: {
    icon: "DN",
    labelKey: "habitDreamNest",
    descKey: "habitDreamNestDesc",
    color: "#a78bfa",
    target: 7,
    sources: { nap: 1, focusSession: 0.5, habitatRest: 0.7 },
    effect: { speed: 0.98, xp: 1.02, care: { nap: { energy: 5, bond: 1 } } },
  },
});

const PET_HABIT_IDS = Object.freeze(Object.keys(PET_HABITS));

const ANIMAL_INSTINCTS = Object.freeze({
  pup: {
    icon: "LN",
    labelKey: "instinctLoyalNose",
    descKey: "instinctLoyalNoseDesc",
    color: "#f59e0b",
    target: 12,
    sources: { petWalk: 1, play: 0.7, pet: 0.7, playdate: 0.6 },
    effect: { speed: 1.04, xp: 1.02, care: { pet: { bond: 2 }, play: { happiness: 2 } } },
  },
  kit: {
    icon: "SP",
    labelKey: "instinctSilentPounce",
    descKey: "instinctSilentPounceDesc",
    color: "#60a5fa",
    target: 12,
    sources: { patrol: 1, clean: 0.8, train: 0.5, command: 0.5 },
    effect: { speed: 1.03, xp: 1.03, care: { clean: { hygiene: 3 }, train: { training: 1 } } },
  },
  bunny: {
    icon: "MH",
    labelKey: "instinctMoonHop",
    descKey: "instinctMoonHopDesc",
    color: "#f9a8d4",
    target: 11,
    sources: { play: 1, nap: 0.8, miniGame: 0.6, roomPlay: 0.5 },
    effect: { speed: 1.05, xp: 1.02, care: { play: { happiness: 2 }, nap: { energy: 3 } } },
  },
  fox: {
    icon: "CS",
    labelKey: "instinctCleverScout",
    descKey: "instinctCleverScoutDesc",
    color: "#fb7185",
    target: 13,
    sources: { patrol: 1, train: 0.8, petWalk: 0.6, expedition: 0.6 },
    effect: { speed: 1.04, xp: 1.04, care: { train: { training: 2 } } },
  },
  hamster: {
    icon: "PH",
    labelKey: "instinctPocketHoard",
    descKey: "instinctPocketHoardDesc",
    color: "#fbbf24",
    target: 11,
    sources: { feed: 1, snackUse: 0.9, toyPlay: 0.6, desktopObject: 0.5 },
    effect: { speed: 1.02, xp: 1.03, care: { feed: { hunger: 3, energy: 1 }, nap: { energy: 2 } } },
  },
});

const ANIMAL_INSTINCT_IDS = Object.freeze(Object.keys(ANIMAL_INSTINCTS));

const MOOD_AURAS = Object.freeze({
  bright: {
    icon: "BR",
    labelKey: "moodBrightAura",
    descKey: "moodBrightAuraDesc",
    color: "#facc15",
    particle: "spark",
    reward: { coins: 2, xp: 5, happiness: 3, training: 2, bond: 1 },
  },
  calm: {
    icon: "CL",
    labelKey: "moodCalmAura",
    descKey: "moodCalmAuraDesc",
    color: "#42d7c5",
    particle: "bubble",
    reward: { coins: 1, xp: 4, energy: 4, bond: 1 },
  },
  hungry: {
    icon: "FD",
    labelKey: "moodHungryAura",
    descKey: "moodHungryAuraDesc",
    color: "#fb923c",
    particle: "pixel",
    reward: { coins: 1, xp: 3, hunger: 6, bond: 1 },
  },
  sleepy: {
    icon: "ZZ",
    labelKey: "moodSleepyAura",
    descKey: "moodSleepyAuraDesc",
    color: "#93c5fd",
    particle: "bubble",
    reward: { coins: 1, xp: 3, energy: 7, happiness: 1 },
  },
  messy: {
    icon: "SP",
    labelKey: "moodMessyAura",
    descKey: "moodMessyAuraDesc",
    color: "#7dd3fc",
    particle: "bubble",
    reward: { coins: 1, xp: 3, hygiene: 7, happiness: 1 },
  },
  lonely: {
    icon: "HE",
    labelKey: "moodLonelyAura",
    descKey: "moodLonelyAuraDesc",
    color: "#f9a8d4",
    particle: "spark",
    reward: { coins: 1, xp: 4, happiness: 6, bond: 2 },
  },
});

const MOOD_AURA_IDS = Object.freeze(Object.keys(MOOD_AURAS));

const MOOD_PATTERNS = Object.freeze({
  brightLoop: {
    icon: "BL",
    mood: "bright",
    labelKey: "patternBrightLoop",
    descKey: "patternBrightLoopDesc",
    color: "#facc15",
    target: 12,
    sources: { "mood:bright": 1, play: 0.65, train: 0.45, microEvent: 0.35, toyPlay: 0.35 },
    effect: { speed: 1.025, xp: 1.015, care: { play: { happiness: 2 }, train: { training: 1 } } },
  },
  calmNest: {
    icon: "CN",
    mood: "calm",
    labelKey: "patternCalmNest",
    descKey: "patternCalmNestDesc",
    color: "#42d7c5",
    target: 10,
    sources: { "mood:calm": 1, pet: 0.55, nap: 0.55, habitatRest: 0.45, microEventAuto: 0.3 },
    effect: { speed: 0.985, xp: 1.02, care: { pet: { bond: 1 }, nap: { energy: 2 } } },
  },
  snackSignal: {
    icon: "SS",
    mood: "hungry",
    labelKey: "patternSnackSignal",
    descKey: "patternSnackSignalDesc",
    color: "#fb923c",
    target: 9,
    sources: { "mood:hungry": 1, feed: 0.8, snackUse: 0.7, "microEvent:noseNote": 0.35 },
    effect: { xp: 1.015, care: { feed: { hunger: 3, happiness: 1 } } },
  },
  dreamDrift: {
    icon: "DD",
    mood: "sleepy",
    labelKey: "patternDreamDrift",
    descKey: "patternDreamDriftDesc",
    color: "#93c5fd",
    target: 9,
    sources: { "mood:sleepy": 1, nap: 0.85, focusSession: 0.45, habitatRest: 0.45, microEvent: 0.25 },
    effect: { speed: 0.975, xp: 1.025, care: { nap: { energy: 3, bond: 1 } } },
  },
  cleanSpark: {
    icon: "CS",
    mood: "messy",
    labelKey: "patternCleanSpark",
    descKey: "patternCleanSparkDesc",
    color: "#7dd3fc",
    target: 9,
    sources: { "mood:messy": 1, clean: 0.9, roomEvent: 0.35, microEvent: 0.25 },
    effect: { speed: 1.01, xp: 1.015, care: { clean: { hygiene: 3, happiness: 1 } } },
  },
  heartPulse: {
    icon: "HP",
    mood: "lonely",
    labelKey: "patternHeartPulse",
    descKey: "patternHeartPulseDesc",
    color: "#f9a8d4",
    target: 10,
    sources: { "mood:lonely": 1, pet: 0.8, playdate: 0.5, social: 0.35, microEvent: 0.3 },
    effect: { xp: 1.02, care: { pet: { bond: 2, happiness: 1 }, play: { happiness: 1 } } },
  },
});

const MOOD_PATTERN_IDS = Object.freeze(Object.keys(MOOD_PATTERNS));

const TALENTS = Object.freeze({
  agility: {
    icon: "AG",
    labelKey: "talentAgility",
    descKey: "talentAgilityDesc",
    color: "#38bdf8",
    energyCost: 9,
    trainingNeed: 0,
    reward: { xp: 7, happiness: 5, training: 3, bond: 1 },
  },
  focus: {
    icon: "FO",
    labelKey: "talentFocus",
    descKey: "talentFocusDesc",
    color: "#a78bfa",
    energyCost: 11,
    trainingNeed: 8,
    reward: { xp: 10, training: 6, energy: -1, bond: 1 },
  },
  charm: {
    icon: "CH",
    labelKey: "talentCharm",
    descKey: "talentCharmDesc",
    color: "#f9a8d4",
    energyCost: 8,
    trainingNeed: 4,
    reward: { xp: 6, happiness: 7, bond: 3 },
  },
});

const TALENT_IDS = Object.freeze(Object.keys(TALENTS));
const TALENT_MAX_LEVEL = 5;
const TALENT_LEVEL_THRESHOLDS = Object.freeze([1, 3, 6, 10, 15]);

const TINY_JOBS = Object.freeze({
  pocketScout: {
    icon: "PS",
    labelKey: "jobPocketScout",
    descKey: "jobPocketScoutDesc",
    color: "#42d7c5",
    energyCost: 10,
    level: 1,
    training: 0,
    talent: "agility",
    reward: { coins: 7, xp: 6, happiness: 3, training: 1, bond: 1 },
    collection: true,
  },
  deskHelper: {
    icon: "DH",
    labelKey: "jobDeskHelper",
    descKey: "jobDeskHelperDesc",
    color: "#a78bfa",
    energyCost: 11,
    level: 2,
    training: 8,
    talent: "focus",
    reward: { coins: 9, xp: 8, training: 4, bond: 1 },
  },
  joyShow: {
    icon: "JS",
    labelKey: "jobJoyShow",
    descKey: "jobJoyShowDesc",
    color: "#f9a8d4",
    energyCost: 9,
    level: 2,
    training: 4,
    talent: "charm",
    reward: { coins: 8, xp: 6, happiness: 8, bond: 2 },
  },
});

const TINY_JOB_IDS = Object.freeze(Object.keys(TINY_JOBS));
const JOB_REPUTATION_THRESHOLDS = Object.freeze([1, 3, 6, 10]);

const CARE_COMBOS = Object.freeze({
  snackSprint: {
    icon: "SS",
    from: "feed",
    to: "play",
    labelKey: "comboSnackSprint",
    descKey: "comboSnackSprintDesc",
    coins: 5,
    xp: 7,
    happiness: 6,
    bond: 1,
  },
  sparkleCuddle: {
    icon: "SC",
    from: "clean",
    to: "pet",
    labelKey: "comboSparkleCuddle",
    descKey: "comboSparkleCuddleDesc",
    coins: 4,
    xp: 6,
    happiness: 5,
    bond: 2,
  },
  focusReset: {
    icon: "FR",
    from: "train",
    to: "nap",
    labelKey: "comboFocusReset",
    descKey: "comboFocusResetDesc",
    coins: 5,
    xp: 8,
    energy: 8,
    bond: 1,
  },
  wakeSnack: {
    icon: "WS",
    from: "nap",
    to: "feed",
    labelKey: "comboWakeSnack",
    descKey: "comboWakeSnackDesc",
    coins: 4,
    xp: 6,
    hunger: 8,
    happiness: 3,
  },
  trustLesson: {
    icon: "TL",
    from: "pet",
    to: "train",
    labelKey: "comboTrustLesson",
    descKey: "comboTrustLessonDesc",
    coins: 6,
    xp: 9,
    training: 4,
    bond: 2,
  },
  muddyFun: {
    icon: "MF",
    from: "play",
    to: "clean",
    labelKey: "comboMuddyFun",
    descKey: "comboMuddyFunDesc",
    coins: 5,
    xp: 7,
    hygiene: 8,
    happiness: 4,
  },
});

const CARE_COMBO_IDS = Object.freeze(Object.keys(CARE_COMBOS));

const CARE_ROUTINES = Object.freeze({
  morningLoop: {
    icon: "AM",
    labelKey: "routineMorning",
    descKey: "routineMorningDesc",
    steps: ["feed", "clean", "play"],
    color: "#facc15",
    reward: { coins: 14, xp: 14, happiness: 6, energy: 3, bond: 2 },
  },
  skillDrill: {
    icon: "SK",
    labelKey: "routineSkill",
    descKey: "routineSkillDesc",
    steps: ["train", "play", "pet"],
    color: "#3a87ff",
    reward: { coins: 16, xp: 18, happiness: 4, training: 8, bond: 2 },
  },
  cozyReset: {
    icon: "CZ",
    labelKey: "routineCozy",
    descKey: "routineCozyDesc",
    steps: ["clean", "pet", "nap"],
    color: "#fb7185",
    reward: { coins: 12, xp: 13, happiness: 7, energy: 8, hygiene: 5, bond: 3 },
  },
  playSprint: {
    icon: "GO",
    labelKey: "routinePlay",
    descKey: "routinePlayDesc",
    steps: ["play", "train", "feed"],
    color: "#42d7c5",
    reward: { coins: 15, xp: 16, hunger: 8, happiness: 8, training: 4, bond: 2 },
  },
});
const CARE_ROUTINE_DEFS = Object.freeze(CARE_ROUTINE_IDS.map((id) => ({ id, ...CARE_ROUTINES[id] })).filter((routine) => routine.steps));

const PET_COMMANDS = Object.freeze({
  comeHere: {
    icon: "IN",
    labelKey: "commandCome",
    descKey: "commandComeDesc",
    energyCost: 2,
    color: "#42d7c5",
    reward: { xp: 4, happiness: 2, bond: 1 },
  },
  slowDrift: {
    icon: "SL",
    labelKey: "commandSlow",
    descKey: "commandSlowDesc",
    energyCost: 1,
    color: "#8fd3ff",
    reward: { xp: 3, energy: 2, happiness: 1 },
  },
  quickDash: {
    icon: "GO",
    labelKey: "commandDash",
    descKey: "commandDashDesc",
    energyCost: 4,
    color: "#fb7185",
    reward: { xp: 6, happiness: 4, training: 3 },
  },
  spinAround: {
    icon: "SP",
    labelKey: "commandSpin",
    descKey: "commandSpinDesc",
    energyCost: 3,
    color: "#facc15",
    reward: { xp: 5, happiness: 4, training: 2 },
  },
  hidePeek: {
    icon: "HI",
    labelKey: "commandHide",
    descKey: "commandHideDesc",
    energyCost: 3,
    color: "#a78bfa",
    reward: { xp: 5, happiness: 2, training: 2, bond: 1 },
  },
  orbitSpot: {
    icon: "OR",
    labelKey: "commandOrbit",
    descKey: "commandOrbitDesc",
    energyCost: 4,
    color: "#3a87ff",
    reward: { xp: 6, happiness: 3, training: 4 },
  },
});
const PET_COMMAND_IDS = Object.freeze(CARE_COMMAND_IDS.filter((id) => PET_COMMANDS[id]));

const EVOLUTION_FORMS = Object.freeze({
  sprout: {
    icon: "SP",
    labelKey: "formSprout",
    descKey: "formSproutDesc",
    color: "#42d7c5",
    requirement: { level: 2, bond: 5, careActions: 6 },
    reward: { coins: 16, xp: 12, happiness: 6, energy: 4, bond: 2 },
  },
  buddy: {
    icon: "BD",
    labelKey: "formBuddy",
    descKey: "formBuddyDesc",
    color: "#facc15",
    requirement: { level: 4, bond: 35, careActions: 24 },
    reward: { coins: 32, xp: 18, happiness: 8, training: 4, bond: 5 },
  },
  ace: {
    icon: "AC",
    labelKey: "formAce",
    descKey: "formAceDesc",
    color: "#3a87ff",
    requirement: { level: 7, bond: 70, training: 55, pathScore: 80 },
    reward: { coins: 48, xp: 24, happiness: 8, training: 8, bond: 6 },
  },
  signature: {
    icon: "SG",
    labelKey: "formSignature",
    descKey: "formSignatureDesc",
    color: "#a78bfa",
    requirement: { level: 10, bond: 120, training: 80, pathScore: 150, commands: 12, tricks: 10 },
    reward: { coins: 72, xp: 32, happiness: 12, energy: 8, training: 10, bond: 10 },
  },
});
const EVOLUTION_FORM_IDS = Object.freeze(FORM_STAGE_IDS.filter((id) => EVOLUTION_FORMS[id]));

const GROWTH_REWARDS = Object.freeze({
  firstSteps: {
    icon: "S1",
    labelKey: "growthRewardFirstSteps",
    descKey: "growthRewardFirstStepsDesc",
    color: "#42d7c5",
    target: 6,
    reward: { coins: 18, xp: 10, happiness: 4, bond: 2 },
    effect: { care: { feed: { hunger: 1 }, pet: { happiness: 1 } }, burst: 2, colors: ["#42d7c5"] },
    value: ({ care }) => totalCareActions(care),
  },
  levelSpark: {
    icon: "LV",
    labelKey: "growthRewardLevelSpark",
    descKey: "growthRewardLevelSparkDesc",
    color: "#facc15",
    target: 4,
    reward: { coins: 30, xp: 14, happiness: 6, energy: 4 },
    effect: { speed: 1.015, xp: 1.01, burst: 2, colors: ["#facc15"], motion: { playKick: 0.18 } },
    value: ({ care }) => care.level,
  },
  bondRibbon: {
    icon: "BR",
    labelKey: "growthRewardBondRibbon",
    descKey: "growthRewardBondRibbonDesc",
    color: "#f9a8d4",
    target: 45,
    reward: { coins: 34, xp: 12, happiness: 5, bond: 5 },
    effect: { care: { pet: { bond: 1, happiness: 1 }, play: { happiness: 1 } }, burst: 2, colors: ["#f9a8d4"] },
    value: ({ care }) => care.bond,
  },
  skillStripe: {
    icon: "SK",
    labelKey: "growthRewardSkillStripe",
    descKey: "growthRewardSkillStripeDesc",
    color: "#3a87ff",
    target: 45,
    reward: { coins: 38, xp: 16, training: 6, energy: 3 },
    effect: { xp: 1.01, care: { train: { training: 2 } }, burst: 2, colors: ["#3a87ff"], motion: { trainKick: 0.22 } },
    value: ({ care }) => care.training,
  },
  pathCharm: {
    icon: "PC",
    labelKey: "growthRewardPathCharm",
    descKey: "growthRewardPathCharmDesc",
    color: "#a78bfa",
    target: 90,
    reward: { coins: 44, xp: 18, happiness: 6, training: 3, bond: 3 },
    effect: { speed: 1.02, xp: 1.015, burst: 3, colors: ["#a78bfa", "#facc15"] },
    value: ({ care, game }) => growthPathFor(care, game).score,
  },
  habitBadge: {
    icon: "HB",
    labelKey: "growthRewardHabitBadge",
    descKey: "growthRewardHabitBadgeDesc",
    color: "#fb923c",
    target: 3,
    reward: { coins: 46, xp: 18, happiness: 6, energy: 4, bond: 3 },
    effect: { care: { play: { happiness: 1 }, clean: { hygiene: 1 }, nap: { energy: 1 } }, burst: 3, colors: ["#fb923c"] },
    value: ({ care }) => totalPetHabits(care),
  },
  moodCrown: {
    icon: "MC",
    labelKey: "growthRewardMoodCrown",
    descKey: "growthRewardMoodCrownDesc",
    color: "#facc15",
    target: 3,
    reward: { coins: 48, xp: 18, happiness: 7, training: 3, bond: 4 },
    effect: { xp: 1.02, burst: 4, colors: ["#facc15", "#f9a8d4", "#42d7c5"] },
    value: ({ care }) => totalMoodPatterns(care),
  },
  storyMedal: {
    icon: "ST",
    labelKey: "growthRewardStoryMedal",
    descKey: "growthRewardStoryMedalDesc",
    color: "#7dd3fc",
    target: 3,
    reward: { coins: 50, xp: 20, happiness: 8, bond: 5 },
    effect: { xp: 1.015, care: { pet: { bond: 1 }, nap: { energy: 1 } }, burst: 2, colors: ["#7dd3fc"] },
    value: ({ pet, care, game }) => totalLifeStoryChapters(pet, care, game),
  },
  acePack: {
    icon: "AC",
    labelKey: "growthRewardAcePack",
    descKey: "growthRewardAcePackDesc",
    color: "#22c55e",
    target: 8,
    reward: { coins: 68, xp: 26, happiness: 10, energy: 8, training: 6, bond: 6 },
    effect: { speed: 1.03, xp: 1.025, care: { play: { happiness: 2 }, train: { training: 2 } }, burst: 5, colors: ["#22c55e", "#facc15"], motion: { playKick: 0.3, trainKick: 0.28 } },
    value: ({ care }) => care.level,
  },
});

const GROWTH_REWARD_IDS = Object.freeze(Object.keys(GROWTH_REWARDS));

const PERSONALITIES = Object.freeze({
  curious: {
    icon: "?",
    labelKey: "personalityCurious",
    descKey: "personalityCuriousDesc",
    likes: ["train", "feed"],
    speed: 1.04,
    careBonus: { train: { xp: 4, training: 2 }, feed: { xp: 2 } },
    socialWeight: { greet: 1, follow: 1 },
  },
  playful: {
    icon: "!",
    labelKey: "personalityPlayful",
    descKey: "personalityPlayfulDesc",
    likes: ["play", "pet"],
    speed: 1.12,
    careBonus: { play: { xp: 3, happiness: 5 }, pet: { happiness: 2 } },
    socialWeight: { play: 3, follow: 1 },
  },
  cozy: {
    icon: "Z",
    labelKey: "personalityCozy",
    descKey: "personalityCozyDesc",
    likes: ["nap", "feed"],
    speed: 0.94,
    careBonus: { nap: { energy: 8, happiness: 2 }, feed: { hunger: 4 } },
    socialWeight: { nap: 4, share: 1 },
  },
  brave: {
    icon: "B",
    labelKey: "personalityBrave",
    descKey: "personalityBraveDesc",
    likes: ["train", "play"],
    speed: 1.1,
    careBonus: { train: { xp: 3, bond: 1 }, play: { training: 2 } },
    socialWeight: { play: 2, follow: 2 },
  },
  tidy: {
    icon: "T",
    labelKey: "personalityTidy",
    descKey: "personalityTidyDesc",
    likes: ["clean", "pet"],
    speed: 1,
    careBonus: { clean: { hygiene: 6, happiness: 3 }, pet: { bond: 1 } },
    socialWeight: { greet: 2, share: 1 },
  },
  clever: {
    icon: "C",
    labelKey: "personalityClever",
    descKey: "personalityCleverDesc",
    likes: ["train", "clean"],
    speed: 1.03,
    careBonus: { train: { training: 4, xp: 2 }, clean: { xp: 2 } },
    socialWeight: { follow: 2, greet: 1 },
  },
  gentle: {
    icon: "G",
    labelKey: "personalityGentle",
    descKey: "personalityGentleDesc",
    likes: ["pet", "nap"],
    speed: 0.98,
    careBonus: { pet: { bond: 2, happiness: 3 }, nap: { bond: 1 } },
    socialWeight: { share: 2, greet: 2, nap: 1 },
  },
});

const PERSONALITY_IDS = Object.freeze(Object.keys(PERSONALITIES));
const PERSONALITY_BY_CHARACTER = Object.freeze({
  ufo: "curious",
  car: "brave",
  slime: "cozy",
  comet: "playful",
  star: "gentle",
  pup: "playful",
  kit: "curious",
  bunny: "gentle",
  fox: "clever",
  hamster: "cozy",
  rocket: "brave",
  saturn: "cozy",
  gem: "tidy",
  donut: "gentle",
  skull: "clever",
  eyeball: "curious",
  energyball: "playful",
  bug: "tidy",
  tank: "brave",
});

const CARE_QUIRKS = Object.freeze({
  snackScout: {
    icon: "SS",
    labelKey: "quirkSnackScout",
    descKey: "quirkSnackScoutDesc",
    color: "#fb923c",
    target: 12,
    sources: { feed: 1, snackUse: 1.2, "mood:hungry": 0.5 },
    effect: { xp: 1.01, care: { feed: { hunger: 2, happiness: 1 } }, burst: 2, idle: 0.18 },
  },
  zoomDancer: {
    icon: "ZD",
    labelKey: "quirkZoomDancer",
    descKey: "quirkZoomDancerDesc",
    color: "#38bdf8",
    target: 14,
    sources: { play: 1, petWalk: 0.8, miniGame: 0.8, toyPlay: 0.5 },
    effect: { speed: 1.025, care: { play: { happiness: 2 } }, burst: 2, motion: 0.2, idle: 0.2 },
  },
  tidyGlow: {
    icon: "TG",
    labelKey: "quirkTidyGlow",
    descKey: "quirkTidyGlowDesc",
    color: "#7dd3fc",
    target: 10,
    sources: { clean: 1, "mood:messy": 0.7, roomEvent: 0.35 },
    effect: { care: { clean: { hygiene: 3, happiness: 1 } }, burst: 3, idle: 0.14 },
  },
  studyNudge: {
    icon: "SN",
    labelKey: "quirkStudyNudge",
    descKey: "quirkStudyNudgeDesc",
    color: "#a78bfa",
    target: 12,
    sources: { train: 1, talentTrain: 0.8, focusSession: 0.7, trainingYard: 0.5 },
    effect: { xp: 1.02, care: { train: { training: 2 } }, burst: 2, idle: 0.16 },
  },
  cozyAnchor: {
    icon: "CA",
    labelKey: "quirkCozyAnchor",
    descKey: "quirkCozyAnchorDesc",
    color: "#c4b5fd",
    target: 11,
    sources: { nap: 1, habitatRest: 0.9, focusMinutes: 0.08, "mood:sleepy": 0.5 },
    effect: { speed: 0.99, xp: 1.01, care: { nap: { energy: 3, bond: 1 } }, burst: 2, idle: 0.15 },
  },
  socialSpark: {
    icon: "SO",
    labelKey: "quirkSocialSpark",
    descKey: "quirkSocialSparkDesc",
    color: "#f9a8d4",
    target: 10,
    sources: { playdate: 1, duoMove: 1, packEvent: 0.8, pet: 0.35 },
    effect: { xp: 1.015, care: { pet: { bond: 2, happiness: 1 }, play: { happiness: 1 } }, burst: 3, idle: 0.22 },
  },
  bravePacer: {
    icon: "BP",
    labelKey: "quirkBravePacer",
    descKey: "quirkBravePacerDesc",
    color: "#22c55e",
    target: 13,
    sources: { patrol: 1, petWalk: 0.8, command: 0.65, expedition: 0.6 },
    effect: { speed: 1.03, xp: 1.01, care: { train: { training: 1 }, play: { happiness: 1 } }, burst: 2, motion: 0.22, idle: 0.2 },
  },
  memoryKeeper: {
    icon: "MK",
    labelKey: "quirkMemoryKeeper",
    descKey: "quirkMemoryKeeperDesc",
    color: "#facc15",
    target: 8,
    value: ({ care }) => (care.memories || []).length,
    effect: { xp: 1.015, care: { pet: { bond: 1 }, nap: { energy: 1 } }, burst: 2, idle: 0.18 },
  },
});

const CARE_QUIRK_IDS = Object.freeze(Object.keys(CARE_QUIRKS));

const CARE_QUIRK_COMBOS = Object.freeze({
  picnicDash: {
    icon: "PD",
    labelKey: "quirkComboPicnicDash",
    descKey: "quirkComboPicnicDashDesc",
    color: "#fb923c",
    requires: ["snackScout", "zoomDancer"],
    effect: {
      speed: 1.015,
      xp: 1.01,
      care: { feed: { hunger: 2 }, play: { happiness: 2 } },
      burst: 3,
      motion: 0.18,
      idle: 0.16,
    },
  },
  sparkStudy: {
    icon: "ST",
    labelKey: "quirkComboSparkStudy",
    descKey: "quirkComboSparkStudyDesc",
    color: "#7dd3fc",
    requires: ["tidyGlow", "studyNudge"],
    effect: {
      xp: 1.025,
      care: { clean: { hygiene: 2 }, train: { training: 2 } },
      burst: 3,
      idle: 0.14,
    },
  },
  cozyMemoir: {
    icon: "CM",
    labelKey: "quirkComboCozyMemoir",
    descKey: "quirkComboCozyMemoirDesc",
    color: "#c4b5fd",
    requires: ["cozyAnchor", "memoryKeeper"],
    effect: {
      xp: 1.015,
      care: { nap: { energy: 3, bond: 1 }, pet: { bond: 1 } },
      burst: 3,
      idle: 0.18,
    },
  },
  braveCircle: {
    icon: "BC",
    labelKey: "quirkComboBraveCircle",
    descKey: "quirkComboBraveCircleDesc",
    color: "#22c55e",
    requires: ["bravePacer", "socialSpark"],
    effect: {
      speed: 1.025,
      xp: 1.015,
      care: { play: { happiness: 2 }, train: { training: 1 }, pet: { bond: 1 } },
      burst: 4,
      motion: 0.2,
      idle: 0.2,
    },
  },
  gentleFestival: {
    icon: "GF",
    labelKey: "quirkComboGentleFestival",
    descKey: "quirkComboGentleFestivalDesc",
    color: "#f9a8d4",
    requires: ["socialSpark", "memoryKeeper", "snackScout"],
    effect: {
      xp: 1.02,
      care: { feed: { happiness: 1 }, pet: { bond: 2 }, play: { happiness: 1 } },
      burst: 4,
      idle: 0.22,
    },
  },
  aceRoutine: {
    icon: "AR",
    labelKey: "quirkComboAceRoutine",
    descKey: "quirkComboAceRoutineDesc",
    color: "#facc15",
    requires: ["studyNudge", "bravePacer", "cozyAnchor"],
    effect: {
      speed: 1.02,
      xp: 1.025,
      care: { train: { training: 2 }, nap: { energy: 2 } },
      burst: 5,
      motion: 0.22,
      idle: 0.2,
    },
  },
});

const CARE_QUIRK_COMBO_IDS = Object.freeze(Object.keys(CARE_QUIRK_COMBOS));

const PET_TRICKS = Object.freeze({
  hop: { icon: "↟", labelKey: "trickHop", level: 1, training: 0, bond: 0, xp: 5, happiness: 5, energy: -4 },
  spin: { icon: "⟳", labelKey: "trickSpin", level: 2, training: 12, bond: 4, xp: 7, happiness: 7, energy: -6 },
  dash: { icon: "»", labelKey: "trickDash", level: 3, training: 24, bond: 8, xp: 9, happiness: 9, energy: -9 },
  circle: { icon: "○", labelKey: "trickCircle", level: 4, training: 36, bond: 14, xp: 11, happiness: 10, energy: -11 },
  seek: { icon: "◇", labelKey: "trickSeek", level: 5, training: 48, bond: 20, xp: 12, happiness: 8, energy: -12 },
  parade: { icon: "★", labelKey: "trickParade", level: 7, training: 64, bond: 34, xp: 15, happiness: 14, energy: -15 },
});

const PET_TRICK_IDS = Object.freeze(Object.keys(PET_TRICKS));
const TRICK_MASTERY_THRESHOLDS = Object.freeze([1, 3, 7, 12]);
const TRICK_MASTERY_LABEL_KEYS = Object.freeze([
  "masteryFresh",
  "masteryNovice",
  "masterySteady",
  "masterySharp",
  "masteryMaster",
]);

const EXPEDITIONS = Object.freeze({
  gardenWalk: {
    icon: "▣",
    labelKey: "expeditionGarden",
    level: 1,
    training: 0,
    bond: 0,
    energyCost: 10,
    coins: 6,
    xp: 8,
    happiness: 8,
    trainingGain: 1,
    collection: true,
  },
  skylineScout: {
    icon: "△",
    labelKey: "expeditionSkyline",
    level: 3,
    training: 22,
    bond: 8,
    energyCost: 16,
    coins: 10,
    xp: 12,
    happiness: 9,
    trainingGain: 3,
  },
  buddyPatrol: {
    icon: "◇",
    labelKey: "expeditionBuddy",
    level: 4,
    training: 28,
    bond: 18,
    energyCost: 18,
    coins: 12,
    xp: 13,
    happiness: 10,
    trainingGain: 2,
    friendship: 10,
  },
  treasureRoute: {
    icon: "◆",
    labelKey: "expeditionTreasure",
    level: 6,
    training: 54,
    bond: 26,
    energyCost: 24,
    coins: 16,
    xp: 18,
    happiness: 12,
    trainingGain: 4,
    collection: true,
  },
});

const EXPEDITION_IDS = Object.freeze(Object.keys(EXPEDITIONS));

const SIGNATURE_ACTIONS = Object.freeze({
  ufo: {
    icon: "UF",
    name: { en: "Warp Blink", ko: "워프 점멸" },
    desc: { en: "Blinks across the screen with a soft scanner pulse.", ko: "부드러운 탐지 파동을 남기고 화면을 순간이동해." },
    motion: "warp",
    color: "#7dd3fc",
    energyCost: 10,
    xp: 11,
    happiness: 7,
    training: 2,
    bond: 2,
  },
  car: {
    icon: "DR",
    name: { en: "Turbo Drift", ko: "터보 드리프트" },
    desc: { en: "Cuts a fast corner and leaves a crisp pixel trail.", ko: "빠르게 코너를 돌며 선명한 픽셀 자국을 남겨." },
    motion: "dash",
    color: "#ef4444",
    energyCost: 12,
    xp: 12,
    happiness: 8,
    training: 3,
    bond: 1,
  },
  slime: {
    icon: "JB",
    name: { en: "Jelly Bounce", ko: "젤리 통통" },
    desc: { en: "Squishes into a bouncy hop with tiny splash pixels.", ko: "말랑하게 눌렸다가 작은 튐 픽셀과 함께 뛰어올라." },
    motion: "bounce",
    color: "#42d7c5",
    energyCost: 8,
    xp: 9,
    happiness: 10,
    training: 1,
    bond: 2,
  },
  comet: {
    icon: "TL",
    name: { en: "Tail Sweep", ko: "꼬리 쓸기" },
    desc: { en: "Swings a bright tail arc behind its path.", ko: "이동 경로 뒤로 밝은 꼬리 호를 휘둘러." },
    motion: "dash",
    color: "#fb923c",
    energyCost: 10,
    xp: 11,
    happiness: 8,
    training: 2,
    bond: 2,
  },
  star: {
    icon: "GL",
    name: { en: "Glitter Pulse", ko: "반짝 파동" },
    desc: { en: "Pulses in place and scatters calm star dust.", ko: "제자리에서 빛나며 차분한 별가루를 흩뿌려." },
    motion: "pulse",
    color: "#facc15",
    energyCost: 7,
    xp: 8,
    happiness: 8,
    training: 1,
    bond: 3,
  },
  pup: {
    icon: "ZM",
    name: { en: "Happy Zoomies", ko: "행복 질주" },
    desc: { en: "Runs a playful loop like it found the best snack.", ko: "최고 간식을 찾은 것처럼 장난스럽게 한 바퀴 질주해." },
    motion: "zigzag",
    color: "#f59e0b",
    energyCost: 13,
    xp: 13,
    happiness: 12,
    training: 2,
    bond: 3,
  },
  kit: {
    icon: "PN",
    name: { en: "Silent Pounce", ko: "조용한 덮치기" },
    desc: { en: "Creeps, snaps forward, then freezes like nothing happened.", ko: "살금 다가가 휙 튀어나간 뒤 아무 일 없던 척 멈춰." },
    motion: "pounce",
    color: "#60a5fa",
    energyCost: 10,
    xp: 12,
    happiness: 8,
    training: 4,
    bond: 2,
  },
  bunny: {
    icon: "HP",
    name: { en: "Moon Hop", ko: "달빛 점프" },
    desc: { en: "Hops upward in soft little moon steps.", ko: "부드러운 달빛 걸음처럼 위로 폴짝 뛰어." },
    motion: "bounce",
    color: "#f9a8d4",
    energyCost: 9,
    xp: 10,
    happiness: 9,
    training: 2,
    bond: 3,
  },
  fox: {
    icon: "ZG",
    name: { en: "Clever Zigzag", ko: "영리한 지그재그" },
    desc: { en: "Changes direction sharply with a clever little flourish.", ko: "영리하게 방향을 꺾으며 작은 여우표 마무리를 해." },
    motion: "zigzag",
    color: "#fb7185",
    energyCost: 11,
    xp: 13,
    happiness: 8,
    training: 4,
    bond: 2,
  },
  hamster: {
    icon: "PK",
    name: { en: "Pocket Dash", ko: "주머니 대시" },
    desc: { en: "Darts away, loops back, and looks very proud.", ko: "휙 달려갔다가 돌아와서 뿌듯한 표정을 지어." },
    motion: "dash",
    color: "#fbbf24",
    energyCost: 9,
    xp: 10,
    happiness: 10,
    training: 1,
    bond: 3,
  },
  rocket: {
    icon: "BT",
    name: { en: "Booster Launch", ko: "부스터 발사" },
    desc: { en: "Launches nose-first and paints the air with sparks.", ko: "머리 방향으로 발사되며 공중에 스파크를 칠해." },
    motion: "launch",
    color: "#fb923c",
    energyCost: 14,
    xp: 15,
    happiness: 9,
    training: 4,
    bond: 2,
  },
  saturn: {
    icon: "OB",
    name: { en: "Ring Orbit", ko: "고리 궤도" },
    desc: { en: "Loops in a tiny orbit and steadies itself.", ko: "작은 궤도를 그리며 빙글 돈 뒤 차분히 멈춰." },
    motion: "orbit",
    color: "#f59e0b",
    energyCost: 10,
    xp: 11,
    happiness: 7,
    training: 3,
    bond: 2,
  },
  gem: {
    icon: "PR",
    name: { en: "Prism Flash", ko: "프리즘 섬광" },
    desc: { en: "Splits light into clean little color shards.", ko: "빛을 작고 선명한 색 조각으로 나눠 뿌려." },
    motion: "pulse",
    color: "#38bdf8",
    energyCost: 8,
    xp: 10,
    happiness: 8,
    training: 2,
    bond: 2,
  },
  donut: {
    icon: "RL",
    name: { en: "Sugar Roll", ko: "슈가 구르기" },
    desc: { en: "Rolls in a sweet circle and shakes off sugar pixels.", ko: "달콤한 원을 구르며 설탕 픽셀을 털어내." },
    motion: "orbit",
    color: "#fb7185",
    energyCost: 8,
    xp: 9,
    happiness: 11,
    training: 1,
    bond: 3,
  },
  skull: {
    icon: "GH",
    name: { en: "Ghost Spin", ko: "유령 회전" },
    desc: { en: "Spins through a quiet spooky drift.", ko: "조용하고 묘한 흐름으로 빙글 돌아." },
    motion: "spin",
    color: "#c4b5fd",
    energyCost: 9,
    xp: 10,
    happiness: 7,
    training: 3,
    bond: 2,
  },
  eyeball: {
    icon: "SC",
    name: { en: "Wide Scan", ko: "전방위 관찰" },
    desc: { en: "Scans the room and pivots toward a new route.", ko: "방을 훑어보고 새로운 경로로 방향을 틀어." },
    motion: "scan",
    color: "#93c5fd",
    energyCost: 8,
    xp: 12,
    happiness: 6,
    training: 4,
    bond: 1,
  },
  energyball: {
    icon: "VB",
    name: { en: "Volt Burst", ko: "볼트 폭발" },
    desc: { en: "Bursts into a short neon rush.", ko: "짧고 강한 네온 질주로 튀어나가." },
    motion: "dash",
    color: "#a78bfa",
    energyCost: 12,
    xp: 13,
    happiness: 9,
    training: 3,
    bond: 2,
  },
  bug: {
    icon: "WL",
    name: { en: "Wall Crawl", ko: "벽면 기어가기" },
    desc: { en: "Scuttles like it is really gripping the screen.", ko: "진짜 화면을 붙잡은 것처럼 다리로 기어가." },
    motion: "climb",
    color: "#84cc16",
    energyCost: 10,
    xp: 12,
    happiness: 8,
    training: 3,
    bond: 2,
  },
  tank: {
    icon: "CH",
    name: { en: "Heavy Charge", ko: "중장 돌격" },
    desc: { en: "Pushes forward with a slow but serious burst.", ko: "느리지만 묵직하게 앞으로 밀고 나가." },
    motion: "charge",
    color: "#64748b",
    energyCost: 13,
    xp: 14,
    happiness: 7,
    training: 4,
    bond: 2,
  },
  custom: {
    icon: "PX",
    name: { en: "Pixel Flourish", ko: "픽셀 플러리시" },
    desc: { en: "Uses your custom concept as a little stage move.", ko: "네가 만든 컨셉을 작은 무대 동작처럼 보여줘." },
    motion: "pulse",
    color: "#42d7c5",
    energyCost: 8,
    xp: 9,
    happiness: 8,
    training: 2,
    bond: 2,
  },
});

const SIGNATURE_ACTION_IDS = Object.freeze(Object.keys(SIGNATURE_ACTIONS));
const TOY_IDS = Object.freeze(["ribbon", "bell", "ball", "brush", "rocketSnack", "starBlanket"]);
const TRAIL_STYLES = Object.freeze({
  normal: {
    icon: "NM",
    labelKey: "effectNormal",
    descKey: "effectNormalDesc",
    cost: 0,
    mode: "normal",
    intensity: 1,
    colors: ["#42d7c5", "#8fd3ff"],
    happiness: 1,
  },
  spark: {
    icon: "SP",
    labelKey: "effectSpark",
    descKey: "effectSparkDesc",
    cost: 34,
    mode: "spark",
    intensity: 1.05,
    colors: ["#ffe76b", "#facc15"],
    happiness: 3,
    training: 1,
  },
  bubble: {
    icon: "BB",
    labelKey: "effectBubble",
    descKey: "effectBubbleDesc",
    cost: 38,
    mode: "bubble",
    intensity: 1.08,
    colors: ["#9deaff", "#38bdf8"],
    happiness: 2,
    energy: 2,
  },
  pixel: {
    icon: "PX",
    labelKey: "effectPixel",
    descKey: "effectPixelDesc",
    cost: 44,
    mode: "pixel",
    intensity: 1.18,
    colors: ["#ff4d6d", "#ffd166", "#39d98a", "#4dabf7", "#a78bfa"],
    training: 2,
    happiness: 2,
  },
  rainbow: {
    icon: "RB",
    labelKey: "effectRainbow",
    descKey: "effectRainbowDesc",
    cost: 72,
    mode: "rainbow",
    intensity: 1.28,
    colors: ["#ff4d6d", "#ffd166", "#39d98a", "#4dabf7", "#a78bfa"],
    happiness: 5,
    bond: 1,
  },
});

const EFFECT_IDS = Object.freeze(Object.keys(TRAIL_STYLES));
const EGG_HATCH_POOL = Object.freeze(["pup", "kit", "bunny", "fox", "hamster"]);
const SNACKS = Object.freeze({
  berryBite: {
    icon: "BB",
    labelKey: "snackBerryBite",
    descKey: "snackBerryBiteDesc",
    cost: 10,
    hunger: 12,
    happiness: 7,
    energy: 1,
    color: "#fb7185",
  },
  moonMilk: {
    icon: "MM",
    labelKey: "snackMoonMilk",
    descKey: "snackMoonMilkDesc",
    cost: 12,
    hunger: 5,
    happiness: 3,
    energy: 13,
    color: "#93c5fd",
  },
  crunchyStar: {
    icon: "CS",
    labelKey: "snackCrunchyStar",
    descKey: "snackCrunchyStarDesc",
    cost: 14,
    hunger: 8,
    happiness: 4,
    training: 5,
    color: "#facc15",
  },
  cleanMint: {
    icon: "CM",
    labelKey: "snackCleanMint",
    descKey: "snackCleanMintDesc",
    cost: 12,
    hunger: 4,
    happiness: 3,
    hygiene: 15,
    color: "#42d7c5",
  },
  focusBean: {
    icon: "FB",
    labelKey: "snackFocusBean",
    descKey: "snackFocusBeanDesc",
    cost: 16,
    hunger: 5,
    energy: 5,
    training: 9,
    color: "#a78bfa",
  },
  cozyCookie: {
    icon: "CC",
    labelKey: "snackCozyCookie",
    descKey: "snackCozyCookieDesc",
    cost: 18,
    hunger: 13,
    happiness: 8,
    energy: 2,
    bond: 1,
    color: "#fb923c",
  },
});
const SNACK_IDS = Object.freeze(Object.keys(SNACKS));
const FAVORITE_SNACKS = Object.freeze({
  ufo: ["moonMilk", "focusBean"],
  car: ["crunchyStar", "focusBean"],
  slime: ["berryBite", "cleanMint"],
  comet: ["crunchyStar", "moonMilk"],
  star: ["crunchyStar", "cozyCookie"],
  pup: ["crunchyStar", "cozyCookie"],
  kit: ["moonMilk", "berryBite"],
  bunny: ["berryBite", "cleanMint"],
  fox: ["focusBean", "crunchyStar"],
  hamster: ["cozyCookie", "berryBite"],
  rocket: ["focusBean", "crunchyStar"],
  saturn: ["moonMilk", "cozyCookie"],
  gem: ["cleanMint", "berryBite"],
  donut: ["cozyCookie", "berryBite"],
  skull: ["cleanMint", "moonMilk"],
  eyeball: ["focusBean", "moonMilk"],
  energyball: ["crunchyStar", "focusBean"],
  bug: ["berryBite", "cleanMint"],
  tank: ["crunchyStar", "cozyCookie"],
  custom: ["berryBite", "cozyCookie"],
});
const PET_ALBUM_IDS = Object.freeze(Object.keys(CHARACTERS));
const MINI_GAMES = Object.freeze({
  starCatch: {
    icon: "SC",
    labelKey: "miniStarCatch",
    descKey: "miniStarCatchDesc",
    energyCost: 6,
    color: "#facc15",
    skill: "happiness",
  },
  bubbleDodge: {
    icon: "BD",
    labelKey: "miniBubbleDodge",
    descKey: "miniBubbleDodgeDesc",
    energyCost: 7,
    color: "#38bdf8",
    skill: "energy",
  },
  memorySteps: {
    icon: "MS",
    labelKey: "miniMemorySteps",
    descKey: "miniMemoryStepsDesc",
    energyCost: 8,
    color: "#a78bfa",
    skill: "training",
  },
});

const MINI_GAME_IDS = Object.freeze(Object.keys(MINI_GAMES));
const MICRO_EVENTS = Object.freeze({
  signalCheck: {
    icon: "SG",
    labelKey: "microEventSignal",
    descKey: "microEventSignalDesc",
    color: "#42d7c5",
    energyCost: 2,
    moodWeight: { calm: 12, bright: 8, lonely: 6 },
    personalityWeight: { curious: 10, clever: 8, gentle: 4 },
    reward: { coins: 3, xp: 5, happiness: 4, training: 2, bond: 1 },
  },
  pixelStretch: {
    icon: "PX",
    labelKey: "microEventStretch",
    descKey: "microEventStretchDesc",
    color: "#38bdf8",
    energyCost: 1,
    moodWeight: { sleepy: 12, calm: 6, messy: 4 },
    personalityWeight: { cozy: 10, playful: 5, tidy: 4 },
    reward: { coins: 2, xp: 4, energy: 5, happiness: 3, hygiene: 1 },
  },
  noseNote: {
    icon: "NN",
    labelKey: "microEventNose",
    descKey: "microEventNoseDesc",
    color: "#fb923c",
    energyCost: 2,
    moodWeight: { hungry: 14, lonely: 5, calm: 3 },
    personalityWeight: { curious: 6, gentle: 5, brave: 3 },
    reward: { coins: 3, xp: 5, hunger: 6, bond: 1 },
  },
  shimmerStep: {
    icon: "SH",
    labelKey: "microEventShimmer",
    descKey: "microEventShimmerDesc",
    color: "#facc15",
    energyCost: 3,
    moodWeight: { bright: 14, calm: 6, lonely: 4 },
    personalityWeight: { playful: 10, brave: 5, curious: 4 },
    reward: { coins: 4, xp: 6, happiness: 6, training: 1, bond: 1 },
  },
  tidyTap: {
    icon: "TT",
    labelKey: "microEventTidy",
    descKey: "microEventTidyDesc",
    color: "#60a5fa",
    energyCost: 2,
    moodWeight: { messy: 14, calm: 5, sleepy: 3 },
    personalityWeight: { tidy: 11, clever: 5, cozy: 3 },
    reward: { coins: 3, xp: 5, hygiene: 7, happiness: 2 },
  },
  bravePeek: {
    icon: "BP",
    labelKey: "microEventBrave",
    descKey: "microEventBraveDesc",
    color: "#fb7185",
    energyCost: 4,
    moodWeight: { bright: 8, calm: 4, lonely: 7 },
    personalityWeight: { brave: 12, curious: 7, playful: 4 },
    reward: { coins: 5, xp: 7, training: 5, happiness: 3, bond: 1 },
  },
});
const MICRO_EVENT_IDS = Object.freeze(Object.keys(MICRO_EVENTS));
const ROOM_EVENT_IDS = Object.freeze(["plantCare", "studySession", "cozyReset", "snackPicnic", "windowWatch", "lampFocus"]);
const DESKTOP_OBJECTS = Object.freeze({
  bounceBall: {
    icon: "BL",
    labelKey: "deskBall",
    descKey: "deskBallDesc",
    kind: "ball",
    color: "#fb7185",
    energyCost: 3,
    reward: { coins: 7, xp: 8, happiness: 8, training: 1, bond: 1 },
  },
  treatDrop: {
    icon: "TR",
    labelKey: "deskTreat",
    descKey: "deskTreatDesc",
    kind: "treat",
    color: "#f59e0b",
    energyCost: 0,
    reward: { coins: 5, xp: 6, hunger: 10, happiness: 3, bond: 1 },
  },
  sparkleStar: {
    icon: "ST",
    labelKey: "deskStar",
    descKey: "deskStarDesc",
    kind: "star",
    color: "#facc15",
    energyCost: 4,
    reward: { coins: 9, xp: 10, happiness: 5, training: 4, bond: 1 },
  },
  bubblePop: {
    icon: "BB",
    labelKey: "deskBubble",
    descKey: "deskBubbleDesc",
    kind: "bubble",
    color: "#38bdf8",
    energyCost: 2,
    reward: { coins: 6, xp: 7, hygiene: 6, happiness: 5, energy: 1, bond: 1 },
  },
});
const DESKTOP_OBJECT_IDS = Object.freeze(Object.keys(DESKTOP_OBJECTS));
const GROWTH_PATHS = Object.freeze({
  explorer: {
    icon: "EX",
    color: "#38bdf8",
    labelKey: "growthExplorer",
    descKey: "growthExplorerDesc",
    speed: 1.04,
  },
  scholar: {
    icon: "SC",
    color: "#3a87ff",
    labelKey: "growthScholar",
    descKey: "growthScholarDesc",
    speed: 1.01,
  },
  cozy: {
    icon: "CZ",
    color: "#fb7185",
    labelKey: "growthCozy",
    descKey: "growthCozyDesc",
    speed: 0.98,
  },
  performer: {
    icon: "ST",
    color: "#a78bfa",
    labelKey: "growthPerformer",
    descKey: "growthPerformerDesc",
    speed: 1.05,
  },
});
const GROWTH_PATH_IDS = Object.freeze(Object.keys(GROWTH_PATHS));
const BOND_PERKS = Object.freeze({
  loyalNudge: {
    icon: "LN",
    color: "#fb7185",
    labelKey: "perkLoyalNudge",
    descKey: "perkLoyalNudgeDesc",
    requirement: { level: 2, bond: 12 },
    care: { happiness: 1, bond: 1 },
  },
  quickPaws: {
    icon: "QP",
    color: "#38bdf8",
    labelKey: "perkQuickPaws",
    descKey: "perkQuickPawsDesc",
    requirement: { level: 3, training: 22 },
    speed: 1.04,
  },
  eagerLearner: {
    icon: "EL",
    color: "#3a87ff",
    labelKey: "perkEagerLearner",
    descKey: "perkEagerLearnerDesc",
    requirement: { level: 4, training: 36, careActions: 18 },
    xp: 1.06,
  },
  cozyAura: {
    icon: "CA",
    color: "#facc15",
    labelKey: "perkCozyAura",
    descKey: "perkCozyAuraDesc",
    requirement: { happiness: 78, roomComfort: 80 },
    care: { energy: 1, happiness: 1 },
  },
  scoutSense: {
    icon: "SS",
    color: "#42d7c5",
    labelKey: "perkScoutSense",
    descKey: "perkScoutSenseDesc",
    requirement: { patrols: 8, collections: 4 },
    care: { training: 1 },
  },
  signatureTrust: {
    icon: "ST",
    color: "#a78bfa",
    labelKey: "perkSignatureTrust",
    descKey: "perkSignatureTrustDesc",
    requirement: { level: 7, bond: 72 },
    speed: 1.03,
    xp: 1.05,
    care: { bond: 1 },
  },
});
const BOND_PERK_IDS = Object.freeze(Object.keys(BOND_PERKS));

const CARETAKER_RANKS = Object.freeze([
  {
    id: "rookie",
    icon: "R1",
    color: "#38bdf8",
    min: 0,
    labelKey: "caretakerRookie",
    descKey: "caretakerRookieDesc",
    xp: 1,
  },
  {
    id: "buddy",
    icon: "R2",
    color: "#42d7c5",
    min: 120,
    labelKey: "caretakerBuddy",
    descKey: "caretakerBuddyDesc",
    xp: 1.02,
  },
  {
    id: "mentor",
    icon: "R3",
    color: "#facc15",
    min: 360,
    labelKey: "caretakerMentor",
    descKey: "caretakerMentorDesc",
    xp: 1.04,
  },
  {
    id: "expert",
    icon: "R4",
    color: "#fb923c",
    min: 720,
    labelKey: "caretakerExpert",
    descKey: "caretakerExpertDesc",
    xp: 1.06,
  },
  {
    id: "legend",
    icon: "R5",
    color: "#a78bfa",
    min: 1180,
    labelKey: "caretakerLegend",
    descKey: "caretakerLegendDesc",
    xp: 1.08,
  },
]);

const CARETAKER_RANK_IDS = Object.freeze(CARETAKER_RANKS.map((rank) => rank.id));

const PET_SYNERGIES = Object.freeze({
  buddySpark: {
    icon: "BS",
    color: "#42d7c5",
    labelKey: "synergyBuddySpark",
    descKey: "synergyBuddySparkDesc",
    requirement: { friendship: 28, careActions: 12 },
    effect: { xp: 1.02, care: { happiness: 1, bond: 1 } },
  },
  studyEcho: {
    icon: "SE",
    color: "#3a87ff",
    labelKey: "synergyStudyEcho",
    descKey: "synergyStudyEchoDesc",
    requirement: { friendship: 46, training: 44, commands: 6 },
    effect: { xp: 1.03, care: { training: 1 } },
  },
  cozyNest: {
    icon: "CN",
    color: "#facc15",
    labelKey: "synergyCozyNest",
    descKey: "synergyCozyNestDesc",
    requirement: { friendship: 42, roomComfort: 86, routines: 4 },
    effect: { care: { energy: 1, happiness: 1 } },
  },
  scoutPack: {
    icon: "SP",
    color: "#38bdf8",
    labelKey: "synergyScoutPack",
    descKey: "synergyScoutPackDesc",
    requirement: { friendship: 58, patrols: 10, collections: 6 },
    effect: { speed: 1.03, care: { training: 1 } },
  },
  paradeSync: {
    icon: "PS",
    color: "#a78bfa",
    labelKey: "synergyParadeSync",
    descKey: "synergyParadeSyncDesc",
    requirement: { friendship: 82, duo: 4, pack: 4, caretaker: 360 },
    effect: { speed: 1.02, xp: 1.04, care: { happiness: 1, bond: 1 } },
  },
});

const PET_SYNERGY_IDS = Object.freeze(Object.keys(PET_SYNERGIES));

const LIFE_STORY_CHAPTERS = Object.freeze({
  firstSteps: {
    icon: "S1",
    color: "#42d7c5",
    labelKey: "storyFirstSteps",
    descKey: "storyFirstStepsDesc",
    requirement: { careActions: 1 },
  },
  trustedPal: {
    icon: "S2",
    color: "#fb7185",
    labelKey: "storyTrustedPal",
    descKey: "storyTrustedPalDesc",
    requirement: { level: 3, bond: 34, memories: 3 },
  },
  skillSpark: {
    icon: "S3",
    color: "#3a87ff",
    labelKey: "storySkillSpark",
    descKey: "storySkillSparkDesc",
    requirement: { training: 44, tricks: 4, commands: 6 },
  },
  homeHeart: {
    icon: "S4",
    color: "#facc15",
    labelKey: "storyHomeHeart",
    descKey: "storyHomeHeartDesc",
    requirement: { roomComfort: 100, collections: 6, synergies: 2 },
  },
  signatureTale: {
    icon: "S5",
    color: "#a78bfa",
    labelKey: "storySignatureTale",
    descKey: "storySignatureTaleDesc",
    requirement: { level: 7, growthScore: 120, forms: 3, specials: 6 },
  },
});

const LIFE_STORY_CHAPTER_IDS = Object.freeze(Object.keys(LIFE_STORY_CHAPTERS));
const CHARMS = Object.freeze({
  luckyLeaf: {
    icon: "LL",
    labelKey: "charmLuckyLeaf",
    descKey: "charmLuckyLeafDesc",
    color: "#42d7c5",
    recipe: { sparkSeed: 2, miniShell: 1 },
    speed: 1.04,
    care: { play: { happiness: 2, xp: 1 }, discover: { coins: 2, xp: 1 } },
  },
  focusGem: {
    icon: "FG",
    labelKey: "charmFocusGem",
    descKey: "charmFocusGemDesc",
    color: "#3a87ff",
    recipe: { dustStar: 2, glowPebble: 1 },
    speed: 1.01,
    care: { train: { training: 3, xp: 2 }, talent: { training: 1 } },
  },
  cozyShell: {
    icon: "CS",
    labelKey: "charmCozyShell",
    descKey: "charmCozyShellDesc",
    color: "#fb7185",
    recipe: { miniShell: 2, lostButton: 1 },
    speed: 0.98,
    care: { pet: { bond: 1, happiness: 2 }, nap: { energy: 4, bond: 1 } },
  },
  rainbowPin: {
    icon: "RP",
    labelKey: "charmRainbowPin",
    descKey: "charmRainbowPinDesc",
    color: "#a78bfa",
    recipe: { smileSticker: 2, tinyRibbon: 1, yellowPixel: 1 },
    speed: 1.06,
    care: { play: { happiness: 3 }, special: { xp: 2, happiness: 2 } },
  },
});
const CHARM_IDS = Object.freeze(Object.keys(CHARMS));
const HABITAT_SLOT_LIMIT = 6;
const PLAYDATE_ENERGY_COST = 8;
const PLAYDATE_COOLDOWN_MS = 9000;
const DUO_MOVES = Object.freeze({
  buddyDash: {
    icon: "BD",
    labelKey: "duoBuddyDash",
    descKey: "duoBuddyDashDesc",
    minFriendship: 24,
    energyCost: 5,
    color: "#38bdf8",
    reward: { coins: 10, xp: 9, happiness: 5, training: 2, bond: 2, friendship: 7 },
  },
  studyPair: {
    icon: "SP",
    labelKey: "duoStudyPair",
    descKey: "duoStudyPairDesc",
    minFriendship: 44,
    energyCost: 7,
    color: "#3a87ff",
    reward: { coins: 12, xp: 13, happiness: 4, training: 5, bond: 2, friendship: 8 },
  },
  snackShare: {
    icon: "SS",
    labelKey: "duoSnackShare",
    descKey: "duoSnackShareDesc",
    minFriendship: 64,
    energyCost: 4,
    color: "#fb7185",
    reward: { coins: 10, xp: 8, hunger: 8, happiness: 8, energy: 3, bond: 3, friendship: 10 },
  },
  starParade: {
    icon: "ST",
    labelKey: "duoStarParade",
    descKey: "duoStarParadeDesc",
    minFriendship: 96,
    energyCost: 9,
    color: "#a78bfa",
    reward: { coins: 18, xp: 16, happiness: 10, training: 4, bond: 4, friendship: 12 },
  },
});
const DUO_MOVE_IDS = Object.freeze(Object.keys(DUO_MOVES));
const PACK_EVENTS = Object.freeze({
  gardenSweep: {
    icon: "GS",
    labelKey: "packGarden",
    descKey: "packGardenDesc",
    minMembers: 2,
    energyCost: 4,
    color: "#42d7c5",
    reward: { coins: 12, xp: 8, happiness: 6, energy: 2, hygiene: 8, bond: 2, friendship: 6 },
  },
  edgeScout: {
    icon: "ES",
    labelKey: "packScout",
    descKey: "packScoutDesc",
    minMembers: 2,
    energyCost: 6,
    color: "#facc15",
    reward: { coins: 18, xp: 11, happiness: 4, training: 3, bond: 2, friendship: 7, discover: true },
  },
  syncDrill: {
    icon: "SD",
    labelKey: "packDrill",
    descKey: "packDrillDesc",
    minMembers: 3,
    energyCost: 8,
    color: "#3a87ff",
    reward: { coins: 22, xp: 15, happiness: 5, training: 9, bond: 3, friendship: 9 },
  },
  pixelParade: {
    icon: "PP",
    labelKey: "packParade",
    descKey: "packParadeDesc",
    minMembers: 3,
    energyCost: 9,
    color: "#a78bfa",
    reward: { coins: 26, xp: 16, happiness: 12, energy: 3, training: 4, bond: 4, friendship: 12 },
  },
});
const PACK_EVENT_IDS = Object.freeze(Object.keys(PACK_EVENTS));
const PET_CONTESTS = Object.freeze({
  sprintCircuit: {
    icon: "SP",
    labelKey: "contestSprint",
    descKey: "contestSprintDesc",
    minLevel: 1,
    energyCost: 8,
    color: "#38bdf8",
    weights: { training: 0.52, energy: 0.32, happiness: 0.16, level: 5, commands: 2, tricks: 1 },
    reward: { coins: 14, xp: 12, happiness: 4, training: 3, bond: 2 },
  },
  cozyShow: {
    icon: "CZ",
    labelKey: "contestCozy",
    descKey: "contestCozyDesc",
    minLevel: 2,
    energyCost: 5,
    color: "#fb7185",
    weights: { happiness: 0.42, hygiene: 0.34, bond: 0.22, level: 4, routines: 2, snacks: 2 },
    reward: { coins: 12, xp: 10, happiness: 7, hygiene: 4, bond: 3 },
  },
  trickStage: {
    icon: "TS",
    labelKey: "contestTrick",
    descKey: "contestTrickDesc",
    minLevel: 3,
    energyCost: 9,
    color: "#a78bfa",
    weights: { training: 0.58, happiness: 0.16, level: 5, commands: 4, tricks: 5, mastery: 3 },
    reward: { coins: 18, xp: 15, happiness: 4, training: 7, bond: 3 },
  },
  friendRelay: {
    icon: "FR",
    labelKey: "contestRelay",
    descKey: "contestRelayDesc",
    minLevel: 4,
    energyCost: 10,
    color: "#42d7c5",
    weights: { happiness: 0.24, energy: 0.22, friendship: 0.16, level: 4, duo: 3, pack: 4, playdates: 3 },
    reward: { coins: 22, xp: 16, happiness: 6, training: 4, bond: 5 },
  },
});
const PET_CONTEST_IDS = Object.freeze(Object.keys(PET_CONTESTS));
const LEAGUE_SEASON_TIERS = Object.freeze([
  { id: "warmup", icon: "S1", labelKey: "leagueTierWarmup", target: 70, reward: { coins: 22, xp: 8, happiness: 3 } },
  { id: "bronze", icon: "S2", labelKey: "leagueTierBronze", target: 170, reward: { coins: 42, xp: 14, training: 3, bond: 2 } },
  { id: "gold", icon: "S3", labelKey: "leagueTierGold", target: 320, reward: { coins: 68, xp: 22, happiness: 6, training: 5, bond: 3 } },
  { id: "master", icon: "S4", labelKey: "leagueTierMaster", target: 520, reward: { coins: 105, xp: 34, happiness: 8, energy: 8, training: 8, bond: 5 } },
]);
const LEAGUE_SEASON_TIER_IDS = Object.freeze(LEAGUE_SEASON_TIERS.map((tier) => tier.id));
const LEAGUE_MEDALS = Object.freeze({
  rookie: {
    icon: "R1",
    labelKey: "medalRookie",
    descKey: "medalRookieDesc",
    color: "#94a3b8",
    requirement: { seasonPoints: 70 },
    perk: { speed: 1.02, reward: 1.04 },
    trial: { energyCost: 4, reward: { coins: 4, xp: 7, happiness: 3, training: 1, bond: 1 } },
  },
  sprinter: {
    icon: "SP",
    labelKey: "medalSprinter",
    descKey: "medalSprinterDesc",
    color: "#38bdf8",
    requirement: { contestBest: "sprintCircuit", score: 120 },
    perk: { speed: 1.08, reward: 1.05 },
    trial: { energyCost: 8, reward: { coins: 6, xp: 10, happiness: 3, training: 5, bond: 1 } },
  },
  cozy: {
    icon: "CZ",
    labelKey: "medalCozy",
    descKey: "medalCozyDesc",
    color: "#fb7185",
    requirement: { contestBest: "cozyShow", score: 120 },
    perk: { speed: 0.98, reward: 1.08 },
    trial: { energyCost: 5, reward: { coins: 5, xp: 8, happiness: 8, hygiene: 5, bond: 2 } },
  },
  trickAce: {
    icon: "TA",
    labelKey: "medalTrickAce",
    descKey: "medalTrickAceDesc",
    color: "#a78bfa",
    requirement: { contestBest: "trickStage", score: 145 },
    perk: { speed: 1.04, reward: 1.07 },
    trial: { energyCost: 9, reward: { coins: 7, xp: 12, happiness: 4, training: 8, bond: 2 } },
  },
  relayHero: {
    icon: "RH",
    labelKey: "medalRelayHero",
    descKey: "medalRelayHeroDesc",
    color: "#42d7c5",
    requirement: { contestBest: "friendRelay", score: 145 },
    perk: { speed: 1.03, reward: 1.06 },
    trial: { energyCost: 8, reward: { coins: 8, xp: 10, happiness: 5, training: 3, bond: 5 } },
  },
  seasonStar: {
    icon: "SS",
    labelKey: "medalSeasonStar",
    descKey: "medalSeasonStarDesc",
    color: "#facc15",
    requirement: { claimedSeasonTiers: LEAGUE_SEASON_TIERS.length },
    perk: { speed: 1.05, reward: 1.1 },
    trial: { energyCost: 10, reward: { coins: 12, xp: 16, happiness: 7, energy: 3, training: 6, bond: 4 } },
  },
});
const LEAGUE_MEDAL_IDS = Object.freeze(Object.keys(LEAGUE_MEDALS));
const PET_WALKS = Object.freeze({
  gardenLoop: {
    icon: "GL",
    labelKey: "walkGarden",
    descKey: "walkGardenDesc",
    minLevel: 1,
    energyCost: 5,
    color: "#42d7c5",
    reward: { coins: 4, xp: 8, happiness: 5, hygiene: 3, bond: 1 },
    habitatScale: 0.12,
    seasonBoost: ["spring", "summer"],
  },
  trainingTrack: {
    icon: "TR",
    labelKey: "walkTrack",
    descKey: "walkTrackDesc",
    minLevel: 2,
    energyCost: 8,
    color: "#38bdf8",
    reward: { coins: 5, xp: 10, happiness: 3, training: 7, hygiene: 2, bond: 1 },
    trainingScale: 0.05,
  },
  snackTrail: {
    icon: "ST",
    labelKey: "walkSnackTrail",
    descKey: "walkSnackTrailDesc",
    minLevel: 1,
    energyCost: 6,
    color: "#fb923c",
    reward: { coins: 5, xp: 8, hunger: 6, happiness: 6, energy: 1, bond: 2 },
    snackScale: 1,
  },
  nightStroll: {
    icon: "NT",
    labelKey: "walkNightStroll",
    descKey: "walkNightStrollDesc",
    minLevel: 3,
    energyCost: 7,
    color: "#a78bfa",
    reward: { coins: 6, xp: 9, happiness: 4, energy: 7, bond: 3 },
    timeBoost: ["evening", "night", "dawn"],
  },
});
const PET_WALK_IDS = Object.freeze(Object.keys(PET_WALKS));
const TRAINING_YARD_COURSES = Object.freeze({
  agilityTunnel: {
    icon: "AT",
    labelKey: "yardAgility",
    descKey: "yardAgilityDesc",
    minLevel: 1,
    energyCost: 7,
    color: "#38bdf8",
    reward: { coins: 5, xp: 10, happiness: 3, training: 7, bond: 1 },
    walkScale: 0.08,
  },
  recallDrill: {
    icon: "RC",
    labelKey: "yardRecall",
    descKey: "yardRecallDesc",
    minLevel: 2,
    energyCost: 6,
    color: "#42d7c5",
    reward: { coins: 5, xp: 9, happiness: 5, training: 4, bond: 4 },
    animalBoost: true,
  },
  balanceBeam: {
    icon: "BB",
    labelKey: "yardBalance",
    descKey: "yardBalanceDesc",
    minLevel: 3,
    energyCost: 8,
    color: "#facc15",
    reward: { coins: 6, xp: 11, happiness: 4, training: 8, hygiene: 2, bond: 2 },
    trainingScale: 0.05,
  },
  focusHoops: {
    icon: "FH",
    labelKey: "yardHoops",
    descKey: "yardHoopsDesc",
    minLevel: 4,
    energyCost: 9,
    color: "#a78bfa",
    reward: { coins: 7, xp: 12, happiness: 3, energy: 1, training: 9, bond: 2 },
    medalBoost: true,
  },
});
const TRAINING_YARD_COURSE_IDS = Object.freeze(Object.keys(TRAINING_YARD_COURSES));
const PATROL_ROUTES = Object.freeze({
  edgeSweep: {
    icon: "ES",
    labelKey: "patrolEdge",
    descKey: "patrolEdgeDesc",
    minLevel: 1,
    energyCost: 4,
    color: "#42d7c5",
    reward: { coins: 4, xp: 7, happiness: 3, hygiene: 5, bond: 1 },
    animalBoost: true,
    collectionChance: 0.24,
  },
  cursorTrail: {
    icon: "CT",
    labelKey: "patrolCursor",
    descKey: "patrolCursorDesc",
    minLevel: 2,
    energyCost: 5,
    color: "#38bdf8",
    reward: { coins: 5, xp: 8, happiness: 4, training: 3, bond: 1 },
    walkScale: 0.12,
  },
  iconWatch: {
    icon: "IW",
    labelKey: "patrolIcon",
    descKey: "patrolIconDesc",
    minLevel: 3,
    energyCost: 6,
    color: "#facc15",
    reward: { coins: 6, xp: 9, happiness: 3, training: 4, hygiene: 2, bond: 2 },
    collectionChance: 0.45,
    discoveryBoost: true,
  },
  cozyRound: {
    icon: "CR",
    labelKey: "patrolCozy",
    descKey: "patrolCozyDesc",
    minLevel: 1,
    energyCost: 3,
    color: "#fb7185",
    reward: { coins: 4, xp: 6, happiness: 6, energy: 2, bond: 2 },
    comfortScale: 0.08,
  },
});
const PATROL_ROUTE_IDS = Object.freeze(Object.keys(PATROL_ROUTES));
const ACTION_COUNT_KEYS = Object.freeze([
  ...CARE_ACTION_IDS,
  "habitatRest",
  "playdate",
  "careRequest",
  "careCombo",
  ...CARE_ACTION_IDS.map((id) => `request:${id}`),
  ...CARE_COMBO_IDS.map((id) => `combo:${id}`),
  "toyPlay",
  "roomPlay",
  "miniGame",
  "microEvent",
  "microEventAuto",
  ...MICRO_EVENT_IDS.map((id) => `microEvent:${id}`),
  "effectEquip",
  "eggCare",
  "snackUse",
  "moodCheck",
  "talentTrain",
  "jobRun",
  "roomEvent",
  "charmCraft",
  "focusSession",
  "focusMinutes",
  "duoMove",
  "packEvent",
  "contestRun",
  "medalTrial",
  "desktopObject",
  "routineStep",
  "routine",
  "command",
  "formClaim",
  "petWalk",
  "trainingYard",
  "patrol",
  ...MOOD_AURA_IDS.map((id) => `mood:${id}`),
  ...TALENT_IDS.map((id) => `talent:${id}`),
  ...TINY_JOB_IDS.map((id) => `job:${id}`),
  ...ROOM_EVENT_IDS.map((id) => `roomEvent:${id}`),
  ...CHARM_IDS.map((id) => `charm:${id}`),
  ...DUO_MOVE_IDS.map((id) => `duo:${id}`),
  ...PACK_EVENT_IDS.map((id) => `pack:${id}`),
  ...PET_CONTEST_IDS.map((id) => `contest:${id}`),
  ...PET_CONTEST_IDS.map((id) => `contestBest:${id}`),
  ...LEAGUE_MEDAL_IDS.map((id) => `medalTrial:${id}`),
  ...PET_WALK_IDS.map((id) => `petWalk:${id}`),
  ...TRAINING_YARD_COURSE_IDS.map((id) => `trainingYard:${id}`),
  ...PATROL_ROUTE_IDS.map((id) => `patrol:${id}`),
  ...DESKTOP_OBJECT_IDS.map((id) => `desktopObject:${id}`),
  ...CARE_ROUTINE_IDS.map((id) => `routine:${id}`),
  ...PET_COMMAND_IDS.map((id) => `command:${id}`),
  ...EVOLUTION_FORM_IDS.map((id) => `form:${id}`),
  ...TOY_IDS.map((id) => `toyPlay:${id}`),
  ...EFFECT_IDS.map((id) => `effect:${id}`),
  ...SNACK_IDS.map((id) => `snack:${id}`),
  ...SNACK_IDS.map((id) => `snackFavorite:${id}`),
  ...MINI_GAME_IDS.map((id) => `miniGame:${id}`),
  ...MINI_GAME_IDS.map((id) => `miniBest:${id}`),
  ...SIGNATURE_ACTION_IDS.map((id) => `signature:${id}`),
  ...PET_TRICK_IDS.map((id) => `trick:${id}`),
  ...EXPEDITION_IDS.map((id) => `expedition:${id}`),
]);

const DEFAULT_GAME = Object.freeze({
  dayKey: "",
  coins: 0,
  inventory: [],
  effectInventory: ["normal"],
  charmInventory: [],
  eggNest: { progress: 0, hatchedCount: 0, lastHatched: "" },
  snackInventory: {},
  petDex: {},
  moodMoments: { counts: {}, lastAt: 0, lastMood: "" },
  collections: {},
  dailyQuests: [],
  streak: { lastSeenDayKey: "", current: 0, best: 0, claimedDayKey: "" },
  leagueSeason: { seasonKey: "", points: 0, bestPoints: 0, claimedTiers: [] },
  focus: { activeSlot: -1, startedAt: 0, targetMinutes: 25, totalMinutes: 0, completed: 0, bestMinutes: 0, lastCompletedDayKey: "" },
  claimedMilestones: [],
  habitatInventory: [],
  habitatLayout: [],
  habitatTheme: "cozy",
  ambientEvents: { counts: {}, lastAt: 0, lastId: "", lastKey: "" },
});

const SEASONS = Object.freeze({
  spring: { labelKey: "seasonSpring", months: [2, 3, 4], color: "#42d7c5" },
  summer: { labelKey: "seasonSummer", months: [5, 6, 7], color: "#facc15" },
  autumn: { labelKey: "seasonAutumn", months: [8, 9, 10], color: "#fb923c" },
  winter: { labelKey: "seasonWinter", months: [11, 0, 1], color: "#93c5fd" },
});

const TIME_BANDS = Object.freeze({
  dawn: { labelKey: "timeDawn", start: 5, end: 8, color: "#c4b5fd" },
  morning: { labelKey: "timeMorning", start: 8, end: 12, color: "#42d7c5" },
  afternoon: { labelKey: "timeAfternoon", start: 12, end: 17, color: "#facc15" },
  evening: { labelKey: "timeEvening", start: 17, end: 21, color: "#fb923c" },
  night: { labelKey: "timeNight", start: 21, end: 5, color: "#93c5fd" },
});

const AMBIENT_EVENTS = Object.freeze({
  dewSpark: {
    icon: "DEW",
    labelKey: "ambientDewSpark",
    descKey: "ambientDewSparkDesc",
    seasons: ["spring", "summer"],
    times: ["dawn", "morning"],
    weight: 3,
    color: "#42d7c5",
    reward: { happiness: 4, hygiene: 3, xp: 3 },
  },
  sunPatch: {
    icon: "SUN",
    labelKey: "ambientSunPatch",
    descKey: "ambientSunPatchDesc",
    seasons: ["spring", "summer", "autumn"],
    times: ["morning", "afternoon"],
    weight: 4,
    color: "#facc15",
    reward: { energy: 5, happiness: 3, xp: 2 },
  },
  leafSwirl: {
    icon: "LEAF",
    labelKey: "ambientLeafSwirl",
    descKey: "ambientLeafSwirlDesc",
    seasons: ["autumn"],
    times: ["afternoon", "evening"],
    weight: 5,
    color: "#fb923c",
    reward: { happiness: 5, training: 2, xp: 3 },
  },
  moonGlow: {
    icon: "MOON",
    labelKey: "ambientMoonGlow",
    descKey: "ambientMoonGlowDesc",
    seasons: ["spring", "summer", "autumn", "winter"],
    times: ["evening", "night"],
    weight: 3,
    color: "#a78bfa",
    reward: { energy: 4, bond: 1, xp: 3 },
  },
  snackScent: {
    icon: "SNK",
    labelKey: "ambientSnackScent",
    descKey: "ambientSnackScentDesc",
    seasons: ["spring", "summer", "autumn", "winter"],
    times: ["afternoon", "evening"],
    weight: 2,
    color: "#facc15",
    reward: { hunger: 5, bond: 1, coins: 1, xp: 2 },
  },
  starBlink: {
    icon: "STAR",
    labelKey: "ambientStarBlink",
    descKey: "ambientStarBlinkDesc",
    seasons: ["spring", "summer", "autumn", "winter"],
    times: ["night", "dawn"],
    weight: 2,
    color: "#60a5fa",
    reward: { training: 2, happiness: 3, coins: 1, xp: 4 },
  },
  snowQuiet: {
    icon: "SNOW",
    labelKey: "ambientSnowQuiet",
    descKey: "ambientSnowQuietDesc",
    seasons: ["winter"],
    times: ["morning", "afternoon", "evening", "night"],
    weight: 5,
    color: "#93c5fd",
    reward: { energy: 7, happiness: 2, xp: 3 },
  },
  flowerTrail: {
    icon: "FLW",
    labelKey: "ambientFlowerTrail",
    descKey: "ambientFlowerTrailDesc",
    seasons: ["spring"],
    times: ["morning", "afternoon"],
    weight: 4,
    color: "#fb7185",
    reward: { happiness: 6, hygiene: 2, xp: 3 },
  },
});

const AMBIENT_EVENT_IDS = Object.freeze(Object.keys(AMBIENT_EVENTS));

const TOYS = Object.freeze({
  ribbon: { icon: "🎀", labelKey: "toyRibbon", cost: 24, happiness: 4, training: 4, speed: 1.03, effect: "#fb7185" },
  bell: { icon: "🔔", labelKey: "toyBell", cost: 28, happiness: 9, training: 0, speed: 1.0, effect: "#facc15" },
  ball: { icon: "⚽", labelKey: "toyBall", cost: 36, happiness: 6, training: 5, speed: 1.12, effect: "#38bdf8" },
  brush: { icon: "🪮", labelKey: "toyBrush", cost: 30, happiness: 3, hygiene: 10, speed: 1.0, effect: "#7dd3fc" },
  rocketSnack: { icon: "🚀", labelKey: "toyRocketSnack", cost: 48, happiness: 5, energy: 8, speed: 1.18, effect: "#fb923c" },
  starBlanket: { icon: "✦", labelKey: "toyStarBlanket", cost: 42, happiness: 4, energy: 12, speed: 0.96, effect: "#c4b5fd" },
});

const HABITAT_ITEMS = Object.freeze({
  mat: {
    icon: "▤",
    labelKey: "habitatMat",
    descKey: "habitatMatDesc",
    cost: 18,
    comfort: 8,
    energy: 5,
    happiness: 2,
  },
  plant: {
    icon: "♧",
    labelKey: "habitatPlant",
    descKey: "habitatPlantDesc",
    cost: 26,
    comfort: 10,
    happiness: 5,
    hygiene: 3,
  },
  lamp: {
    icon: "☼",
    labelKey: "habitatLamp",
    descKey: "habitatLampDesc",
    cost: 32,
    comfort: 12,
    energy: 8,
    happiness: 3,
  },
  cushion: {
    icon: "▰",
    labelKey: "habitatCushion",
    descKey: "habitatCushionDesc",
    cost: 38,
    comfort: 14,
    energy: 10,
    bond: 1,
  },
  snackBowl: {
    icon: "◌",
    labelKey: "habitatSnackBowl",
    descKey: "habitatSnackBowlDesc",
    cost: 42,
    comfort: 11,
    hunger: 8,
    happiness: 2,
  },
  clock: {
    icon: "◷",
    labelKey: "habitatClock",
    descKey: "habitatClockDesc",
    cost: 46,
    comfort: 9,
    training: 4,
    energy: 3,
  },
  book: {
    icon: "▣",
    labelKey: "habitatBook",
    descKey: "habitatBookDesc",
    cost: 54,
    comfort: 13,
    training: 6,
    bond: 1,
  },
  window: {
    icon: "◇",
    labelKey: "habitatWindow",
    descKey: "habitatWindowDesc",
    cost: 62,
    comfort: 16,
    happiness: 8,
    hygiene: 4,
  },
});

const HABITAT_IDS = Object.freeze(Object.keys(HABITAT_ITEMS));

const HABITAT_THEMES = Object.freeze({
  cozy: {
    icon: "CO",
    labelKey: "habitatThemeCozy",
    descKey: "habitatThemeCozyDesc",
    unlockComfort: 0,
    color: "#fb7185",
    reward: { energy: 2, happiness: 2 },
  },
  garden: {
    icon: "GR",
    labelKey: "habitatThemeGarden",
    descKey: "habitatThemeGardenDesc",
    unlockComfort: 22,
    color: "#42d7c5",
    reward: { happiness: 4, hygiene: 2 },
  },
  night: {
    icon: "NT",
    labelKey: "habitatThemeNight",
    descKey: "habitatThemeNightDesc",
    unlockComfort: 36,
    color: "#8b5cf6",
    reward: { energy: 5, bond: 1 },
  },
  study: {
    icon: "ST",
    labelKey: "habitatThemeStudy",
    descKey: "habitatThemeStudyDesc",
    unlockComfort: 48,
    color: "#3a87ff",
    reward: { training: 4, xp: 3 },
  },
});

const HABITAT_THEME_IDS = Object.freeze(Object.keys(HABITAT_THEMES));

const HABITAT_SET_BONUSES = Object.freeze({
  cozyNest: {
    icon: "CN",
    labelKey: "habitatSetCozyNest",
    descKey: "habitatSetCozyNestDesc",
    items: ["mat", "cushion", "lamp"],
    reward: { energy: 7, happiness: 4, bond: 1 },
  },
  gardenNook: {
    icon: "GN",
    labelKey: "habitatSetGardenNook",
    descKey: "habitatSetGardenNookDesc",
    items: ["plant", "window", "snackBowl"],
    reward: { hunger: 5, happiness: 6, hygiene: 3 },
  },
  studyDesk: {
    icon: "SD",
    labelKey: "habitatSetStudyDesk",
    descKey: "habitatSetStudyDeskDesc",
    items: ["book", "clock", "lamp"],
    reward: { training: 7, xp: 4, energy: 2 },
  },
  picnicMat: {
    icon: "PM",
    labelKey: "habitatSetPicnicMat",
    descKey: "habitatSetPicnicMatDesc",
    items: ["mat", "plant", "snackBowl"],
    reward: { hunger: 6, happiness: 5, bond: 1 },
  },
});

const HABITAT_SET_BONUS_IDS = Object.freeze(Object.keys(HABITAT_SET_BONUSES));

const ROOM_EVENTS = Object.freeze({
  plantCare: {
    icon: "PC",
    labelKey: "roomEventPlantCare",
    descKey: "roomEventPlantCareDesc",
    items: ["plant"],
    color: "#42d7c5",
    energyCost: 5,
    reward: { coins: 4, xp: 5, happiness: 5, hygiene: 5, bond: 1 },
  },
  studySession: {
    icon: "SS",
    labelKey: "roomEventStudySession",
    descKey: "roomEventStudySessionDesc",
    items: ["book", "clock"],
    color: "#3a87ff",
    energyCost: 8,
    reward: { coins: 6, xp: 8, training: 8, energy: 1, bond: 1 },
  },
  cozyReset: {
    icon: "CR",
    labelKey: "roomEventCozyReset",
    descKey: "roomEventCozyResetDesc",
    items: ["mat", "cushion"],
    color: "#fb7185",
    energyCost: 4,
    reward: { coins: 5, xp: 5, energy: 10, happiness: 4, bond: 2 },
  },
  snackPicnic: {
    icon: "SP",
    labelKey: "roomEventSnackPicnic",
    descKey: "roomEventSnackPicnicDesc",
    items: ["snackBowl", "mat"],
    color: "#facc15",
    energyCost: 6,
    reward: { coins: 5, xp: 6, hunger: 10, happiness: 6, bond: 1 },
  },
  windowWatch: {
    icon: "WW",
    labelKey: "roomEventWindowWatch",
    descKey: "roomEventWindowWatchDesc",
    items: ["window"],
    color: "#93c5fd",
    energyCost: 5,
    reward: { coins: 4, xp: 7, happiness: 6, training: 2 },
    discovery: true,
  },
  lampFocus: {
    icon: "LF",
    labelKey: "roomEventLampFocus",
    descKey: "roomEventLampFocusDesc",
    items: ["lamp", "book"],
    color: "#a78bfa",
    energyCost: 7,
    reward: { coins: 6, xp: 7, training: 6, energy: 3, hygiene: 1 },
  },
});

const DISCOVERY_ITEMS = Object.freeze({
  sparkSeed: { icon: "✦", rarity: "common", reward: 1, label: { en: "Spark Seed", ko: "반짝 씨앗" } },
  miniShell: { icon: "◒", rarity: "common", reward: 1, label: { en: "Mini Shell", ko: "미니 조개" } },
  dustStar: { icon: "★", rarity: "common", reward: 1, label: { en: "Dust Star", ko: "먼지 별" } },
  smileSticker: { icon: "☺", rarity: "common", reward: 1, label: { en: "Smile Sticker", ko: "웃는 스티커" } },
  lostButton: { icon: "●", rarity: "common", reward: 1, label: { en: "Lost Button", ko: "잃어버린 버튼" } },
  tinyRibbon: { icon: "◇", rarity: "rare", reward: 2, label: { en: "Tiny Ribbon", ko: "작은 리본" } },
  glowPebble: { icon: "◆", rarity: "rare", reward: 2, label: { en: "Glow Pebble", ko: "빛나는 돌멩이" } },
  cloudChip: { icon: "☁", rarity: "rare", reward: 2, label: { en: "Cloud Chip", ko: "구름 조각" } },
  yellowPixel: { icon: "■", rarity: "rare", reward: 2, label: { en: "Yellow Pixel", ko: "노란 픽셀" } },
  smallMap: { icon: "▧", rarity: "epic", reward: 4, label: { en: "Small Map", ko: "작은 지도" } },
  moonMarble: { icon: "☾", rarity: "epic", reward: 4, label: { en: "Moon Marble", ko: "달 구슬" } },
  codeLeaf: { icon: "{ }", rarity: "epic", reward: 4, label: { en: "Code Leaf", ko: "코드 잎사귀" } },
});

const DISCOVERY_ITEM_IDS = Object.freeze(Object.keys(DISCOVERY_ITEMS));

const MILESTONE_DEFS = Object.freeze([
  {
    id: "firstCare",
    icon: "✦",
    labelKey: "milestoneFirstCare",
    descKey: "milestoneFirstCareDesc",
    target: 1,
    reward: { coins: 12, xp: 5, bond: 1 },
    value: ({ care }) => totalCareActions(care),
  },
  {
    id: "level3",
    icon: "LV",
    labelKey: "milestoneLevel3",
    descKey: "milestoneLevel3Desc",
    target: 3,
    reward: { coins: 32, xp: 10, happiness: 6 },
    value: ({ care }) => care.level,
  },
  {
    id: "level5",
    icon: "★",
    labelKey: "milestoneLevel5",
    descKey: "milestoneLevel5Desc",
    target: 5,
    reward: { coins: 52, xp: 18, bond: 4 },
    value: ({ care }) => care.level,
  },
  {
    id: "bond50",
    icon: "♥",
    labelKey: "milestoneBond50",
    descKey: "milestoneBond50Desc",
    target: 50,
    reward: { coins: 42, happiness: 8 },
    value: ({ care }) => care.bond,
  },
  {
    id: "training60",
    icon: "SK",
    labelKey: "milestoneTraining60",
    descKey: "milestoneTraining60Desc",
    target: 60,
    reward: { coins: 48, training: 5, xp: 12 },
    value: ({ care }) => care.training,
  },
  {
    id: "toyCollector",
    icon: "◆",
    labelKey: "milestoneToyCollector",
    descKey: "milestoneToyCollectorDesc",
    target: 3,
    reward: { coins: 60, happiness: 10 },
    value: ({ game }) => game.inventory.length,
  },
  {
    id: "toyPlay",
    icon: "TY",
    labelKey: "milestoneToyPlay",
    descKey: "milestoneToyPlayDesc",
    target: 10,
    reward: { coins: 48, xp: 16, happiness: 8, bond: 3 },
    value: ({ care }) => totalToyPlay(care),
  },
  {
    id: "cozyCorner",
    icon: "HM",
    labelKey: "milestoneCozyCorner",
    descKey: "milestoneCozyCornerDesc",
    target: 4,
    reward: { coins: 66, xp: 12, happiness: 8 },
    value: ({ game }) => habitatPlacedCount(game),
  },
  {
    id: "roomDesigner",
    icon: "RM",
    labelKey: "milestoneRoomDesigner",
    descKey: "milestoneRoomDesignerDesc",
    target: 8,
    reward: { coins: 70, xp: 18, happiness: 8, bond: 3 },
    value: ({ care }) => totalRoomPlay(care),
  },
  {
    id: "roomEventHost",
    icon: "RE",
    labelKey: "milestoneRoomEventHost",
    descKey: "milestoneRoomEventHostDesc",
    target: 14,
    reward: { coins: 78, xp: 22, training: 5, happiness: 8, bond: 4 },
    value: ({ care }) => totalRoomEvents(care),
  },
  {
    id: "miniGameChamp",
    icon: "MG",
    labelKey: "milestoneMiniGameChamp",
    descKey: "milestoneMiniGameChampDesc",
    target: 10,
    reward: { coins: 74, xp: 20, training: 5, happiness: 8 },
    value: ({ care }) => totalMiniGames(care),
  },
  {
    id: "effectCollector",
    icon: "FX",
    labelKey: "milestoneEffectCollector",
    descKey: "milestoneEffectCollectorDesc",
    target: 4,
    reward: { coins: 68, xp: 16, happiness: 7, bond: 2 },
    value: ({ game }) => effectOwnedCount(game),
  },
  {
    id: "eggHatcher",
    icon: "EG",
    labelKey: "milestoneEggHatcher",
    descKey: "milestoneEggHatcherDesc",
    target: 3,
    reward: { coins: 82, xp: 24, happiness: 9, bond: 4 },
    value: ({ game }) => eggHatchCount(game),
  },
  {
    id: "snackChef",
    icon: "SN",
    labelKey: "milestoneSnackChef",
    descKey: "milestoneSnackChefDesc",
    target: 10,
    reward: { coins: 66, xp: 18, happiness: 8, bond: 4 },
    value: ({ care }) => totalFavoriteSnacks(care),
  },
  {
    id: "petAlbum",
    icon: "PA",
    labelKey: "milestonePetAlbum",
    descKey: "milestonePetAlbumDesc",
    target: 10,
    reward: { coins: 88, xp: 20, happiness: 8, bond: 3 },
    value: ({ game }) => petAlbumSeenCount(game),
  },
  {
    id: "moodReader",
    icon: "MR",
    labelKey: "milestoneMoodReader",
    descKey: "milestoneMoodReaderDesc",
    target: 12,
    reward: { coins: 58, xp: 16, happiness: 7, bond: 3 },
    value: ({ care }) => totalMoodChecks(care),
  },
  {
    id: "moodPatternKeeper",
    icon: "MP",
    labelKey: "milestoneMoodPatternKeeper",
    descKey: "milestoneMoodPatternKeeperDesc",
    target: 3,
    reward: { coins: 64, xp: 20, happiness: 8, energy: 4, bond: 4 },
    value: ({ care }) => totalMoodPatterns(care),
  },
  {
    id: "talentGraduate",
    icon: "TG",
    labelKey: "milestoneTalentGraduate",
    descKey: "milestoneTalentGraduateDesc",
    target: 9,
    reward: { coins: 76, xp: 22, training: 8, happiness: 8, bond: 3 },
    value: ({ care }) => totalTalentLevels(care),
  },
  {
    id: "jobHelper",
    icon: "JW",
    labelKey: "milestoneJobHelper",
    descKey: "milestoneJobHelperDesc",
    target: 12,
    reward: { coins: 72, xp: 20, training: 5, happiness: 7, bond: 4 },
    value: ({ care }) => totalTinyJobs(care),
  },
  {
    id: "focusBuddy",
    icon: "FO",
    labelKey: "milestoneFocusBuddy",
    descKey: "milestoneFocusBuddyDesc",
    target: 8,
    reward: { coins: 70, xp: 24, training: 6, happiness: 8, bond: 4 },
    value: ({ care }) => totalFocusSessions(care),
  },
  {
    id: "growthPath",
    icon: "GP",
    labelKey: "milestoneGrowthPath",
    descKey: "milestoneGrowthPathDesc",
    target: 120,
    reward: { coins: 92, xp: 26, happiness: 9, training: 6, bond: 5 },
    value: ({ care, game }) => growthPathFor(care, game).score,
  },
  {
    id: "habitKeeper",
    icon: "HB",
    labelKey: "milestoneHabitKeeper",
    descKey: "milestoneHabitKeeperDesc",
    target: PET_HABIT_IDS.length,
    reward: { coins: 74, xp: 22, happiness: 8, energy: 5, training: 5, bond: 6 },
    value: ({ care }) => totalPetHabits(care),
  },
  {
    id: "instinctKeeper",
    icon: "IN",
    labelKey: "milestoneInstinctKeeper",
    descKey: "milestoneInstinctKeeperDesc",
    target: 1,
    reward: { coins: 58, xp: 18, happiness: 7, energy: 4, training: 4, bond: 5 },
    value: ({ pet, care, game }) => totalAnimalInstincts(pet, care, game),
  },
  {
    id: "perkKeeper",
    icon: "BP",
    labelKey: "milestonePerkKeeper",
    descKey: "milestonePerkKeeperDesc",
    target: BOND_PERK_IDS.length,
    reward: { coins: 78, xp: 24, happiness: 10, energy: 5, training: 6, bond: 8 },
    value: ({ care, game }) => totalBondPerks(care, game),
  },
  {
    id: "synergyKeeper",
    icon: "SY",
    labelKey: "milestoneSynergyKeeper",
    descKey: "milestoneSynergyKeeperDesc",
    target: PET_SYNERGY_IDS.length,
    reward: { coins: 96, xp: 28, happiness: 10, energy: 6, training: 8, bond: 8 },
    value: ({ pet, care, game }) => totalPetSynergies(pet, care, game),
  },
  {
    id: "storyArchivist",
    icon: "ST",
    labelKey: "milestoneStoryArchivist",
    descKey: "milestoneStoryArchivistDesc",
    target: LIFE_STORY_CHAPTER_IDS.length,
    reward: { coins: 104, xp: 30, happiness: 10, training: 8, bond: 10 },
    value: ({ pet, care, game }) => totalLifeStoryChapters(pet, care, game),
  },
  {
    id: "caretakerMentor",
    icon: "CR",
    labelKey: "milestoneCaretakerMentor",
    descKey: "milestoneCaretakerMentorDesc",
    target: 360,
    reward: { coins: 112, xp: 28, happiness: 10, energy: 6, training: 7, bond: 8 },
    value: ({ game }) => caretakerRankFor(game).stats.score,
  },
  {
    id: "personalityMatch",
    icon: "PM",
    labelKey: "milestonePersonalityMatch",
    descKey: "milestonePersonalityMatchDesc",
    target: 8,
    reward: { coins: 50, xp: 14, bond: 4 },
    value: ({ pet, care }) => personalityLikedActionCount(pet, care),
  },
  {
    id: "seasonWatcher",
    icon: "VB",
    labelKey: "milestoneSeasonWatcher",
    descKey: "milestoneSeasonWatcherDesc",
    target: 12,
    reward: { coins: 44, xp: 12, happiness: 5 },
    value: ({ game }) => totalAmbientEventCount(game),
  },
  {
    id: "collectorHalf",
    icon: "C",
    labelKey: "milestoneCollectorHalf",
    descKey: "milestoneCollectorHalfDesc",
    target: Math.ceil(DISCOVERY_ITEM_IDS.length / 2),
    reward: { coins: 70, xp: 20, bond: 3 },
    value: ({ game }) => collectionUniqueCount(game),
  },
  {
    id: "charmCrafter",
    icon: "CH",
    labelKey: "milestoneCharmCrafter",
    descKey: "milestoneCharmCrafterDesc",
    target: 4,
    reward: { coins: 80, xp: 22, happiness: 8, training: 4, bond: 4 },
    value: ({ care }) => totalCharmCrafts(care),
  },
  {
    id: "memoryBook",
    icon: "M",
    labelKey: "milestoneMemoryBook",
    descKey: "milestoneMemoryBookDesc",
    target: 8,
    reward: { coins: 34, bond: 5 },
    value: ({ care }) => (care.memories || []).length,
  },
  {
    id: "socialCircle",
    icon: "BF",
    labelKey: "milestoneSocialCircle",
    descKey: "milestoneSocialCircleDesc",
    target: 160,
    reward: { coins: 56, bond: 8, happiness: 7 },
    value: ({ care }) => totalFriendshipScore(care),
  },
  {
    id: "playdateHost",
    icon: "PD",
    labelKey: "milestonePlaydateHost",
    descKey: "milestonePlaydateHostDesc",
    target: 6,
    reward: { coins: 38, bond: 5, happiness: 6 },
    value: ({ care }) => totalPlaydates(care),
  },
  {
    id: "duoBond",
    icon: "DU",
    labelKey: "milestoneDuoBond",
    descKey: "milestoneDuoBondDesc",
    target: 10,
    reward: { coins: 68, xp: 20, happiness: 8, training: 5, bond: 5 },
    value: ({ care }) => totalDuoMoves(care),
  },
  {
    id: "packLeader",
    icon: "PK",
    labelKey: "milestonePackLeader",
    descKey: "milestonePackLeaderDesc",
    target: 8,
    reward: { coins: 76, xp: 24, happiness: 10, training: 6, bond: 6 },
    value: ({ care }) => totalPackEvents(care),
  },
  {
    id: "contestChampion",
    icon: "LC",
    labelKey: "milestoneContestChampion",
    descKey: "milestoneContestChampionDesc",
    target: 10,
    reward: { coins: 84, xp: 28, happiness: 9, training: 9, bond: 6 },
    value: ({ care }) => totalContestRuns(care),
  },
  {
    id: "leagueCollector",
    icon: "LS",
    labelKey: "milestoneLeagueCollector",
    descKey: "milestoneLeagueCollectorDesc",
    target: LEAGUE_SEASON_TIERS.length,
    reward: { coins: 96, xp: 30, happiness: 10, training: 8, bond: 7 },
    value: ({ game }) => claimedLeagueSeasonTierCount(game),
  },
  {
    id: "medalCollector",
    icon: "MD",
    labelKey: "milestoneMedalCollector",
    descKey: "milestoneMedalCollectorDesc",
    target: LEAGUE_MEDAL_IDS.length,
    reward: { coins: 72, xp: 24, happiness: 7, training: 5, bond: 5 },
    value: ({ care, game }) => unlockedMedalCount(care, game),
  },
  {
    id: "medalChallenger",
    icon: "MC",
    labelKey: "milestoneMedalChallenger",
    descKey: "milestoneMedalChallengerDesc",
    target: 12,
    reward: { coins: 64, xp: 20, happiness: 7, training: 6, bond: 4 },
    value: ({ care }) => totalMedalTrials(care),
  },
  {
    id: "walkLeader",
    icon: "WL",
    labelKey: "milestoneWalkLeader",
    descKey: "milestoneWalkLeaderDesc",
    target: 10,
    reward: { coins: 58, xp: 18, happiness: 9, energy: 5, training: 4, bond: 5 },
    value: ({ care }) => totalPetWalks(care),
  },
  {
    id: "yardTrainer",
    icon: "YD",
    labelKey: "milestoneYardTrainer",
    descKey: "milestoneYardTrainerDesc",
    target: 12,
    reward: { coins: 66, xp: 22, happiness: 8, energy: 4, training: 7, bond: 5 },
    value: ({ care }) => totalTrainingYardRuns(care),
  },
  {
    id: "patrolCaptain",
    icon: "PT",
    labelKey: "milestonePatrolCaptain",
    descKey: "milestonePatrolCaptainDesc",
    target: 18,
    reward: { coins: 70, xp: 24, happiness: 8, hygiene: 6, training: 5, bond: 6 },
    value: ({ care }) => totalPatrolRuns(care),
  },
  {
    id: "objectPlayer",
    icon: "OB",
    labelKey: "milestoneObjectPlayer",
    descKey: "milestoneObjectPlayerDesc",
    target: 12,
    reward: { coins: 54, xp: 18, happiness: 8, training: 4, bond: 4 },
    value: ({ care }) => totalDesktopObjects(care),
  },
  {
    id: "routineKeeper",
    icon: "RT",
    labelKey: "milestoneRoutineKeeper",
    descKey: "milestoneRoutineKeeperDesc",
    target: 10,
    reward: { coins: 62, xp: 22, happiness: 8, energy: 6, training: 5, bond: 5 },
    value: ({ care }) => totalCareRoutines(care),
  },
  {
    id: "commandTrainer",
    icon: "CM",
    labelKey: "milestoneCommandTrainer",
    descKey: "milestoneCommandTrainerDesc",
    target: 16,
    reward: { coins: 58, xp: 18, happiness: 8, training: 6, bond: 4 },
    value: ({ care }) => totalPetCommands(care),
  },
  {
    id: "formAscended",
    icon: "FM",
    labelKey: "milestoneFormAscended",
    descKey: "milestoneFormAscendedDesc",
    target: EVOLUTION_FORM_IDS.length,
    reward: { coins: 88, xp: 28, happiness: 12, energy: 10, training: 8, bond: 8 },
    value: ({ care }) => totalEvolutionForms(care),
  },
  {
    id: "trickStarter",
    icon: "TS",
    labelKey: "milestoneTrickStarter",
    descKey: "milestoneTrickStarterDesc",
    target: 12,
    reward: { coins: 58, training: 6, xp: 16 },
    value: ({ care }) => totalTrickUses(care),
  },
  {
    id: "trickMaster",
    icon: "TM",
    labelKey: "milestoneTrickMaster",
    descKey: "milestoneTrickMasterDesc",
    target: 12,
    reward: { coins: 72, training: 8, xp: 22, bond: 3 },
    value: ({ care }) => totalTrickMastery(care),
  },
  {
    id: "missionScout",
    icon: "EX",
    labelKey: "milestoneMissionScout",
    descKey: "milestoneMissionScoutDesc",
    target: 8,
    reward: { coins: 64, xp: 22, happiness: 6 },
    value: ({ care }) => totalExpeditionRuns(care),
  },
  {
    id: "signaturePerformer",
    icon: "SG",
    labelKey: "milestoneSignaturePerformer",
    descKey: "milestoneSignaturePerformerDesc",
    target: 12,
    reward: { coins: 54, xp: 18, training: 5, bond: 3 },
    value: ({ care }) => totalSignatureActions(care),
  },
  {
    id: "requestHelper",
    icon: "RQ",
    labelKey: "milestoneRequestHelper",
    descKey: "milestoneRequestHelperDesc",
    target: 10,
    reward: { coins: 46, xp: 14, happiness: 7, bond: 4 },
    value: ({ care }) => totalCareRequests(care),
  },
  {
    id: "comboKeeper",
    icon: "CB",
    labelKey: "milestoneComboKeeper",
    descKey: "milestoneComboKeeperDesc",
    target: 8,
    reward: { coins: 52, xp: 16, happiness: 8, training: 4 },
    value: ({ care }) => totalCareCombos(care),
  },
  {
    id: "dailyStreak",
    icon: "ST",
    labelKey: "milestoneDailyStreak",
    descKey: "milestoneDailyStreakDesc",
    target: 5,
    reward: { coins: 40, xp: 12, happiness: 6, bond: 2 },
    value: ({ game }) => dailyStreakValue(game),
  },
  {
    id: "dailyChampion",
    icon: "✓",
    labelKey: "milestoneDailyChampion",
    descKey: "milestoneDailyChampionDesc",
    target: 3,
    reward: { coins: 44, happiness: 7, bond: 2 },
    value: ({ game }) => completedDailyQuestCount(game),
    done: ({ game }) => allDailyQuestsDone(game),
  },
]);

const MILESTONE_IDS = Object.freeze(MILESTONE_DEFS.map((milestone) => milestone.id));

const QUEST_TEMPLATES = Object.freeze([
  { action: "feed", labelKey: "questFeed", target: 3, reward: 14 },
  { action: "play", labelKey: "questPlay", target: 2, reward: 18 },
  { action: "pet", labelKey: "questPet", target: 4, reward: 12 },
  { action: "clean", labelKey: "questClean", target: 2, reward: 16 },
  { action: "train", labelKey: "questTrain", target: 2, reward: 22 },
  { action: "nap", labelKey: "questNap", target: 1, reward: 10 },
  { action: "social", labelKey: "questSocial", target: 2, reward: 20 },
  { action: "duo", labelKey: "questDuo", target: 1, reward: 22 },
  { action: "pack", labelKey: "questPack", target: 1, reward: 24 },
  { action: "contest", labelKey: "questContest", target: 1, reward: 25 },
  { action: "desktopObject", labelKey: "questDeskObject", target: 2, reward: 18 },
  { action: "routine", labelKey: "questRoutine", target: 1, reward: 24 },
  { action: "command", labelKey: "questCommand", target: 2, reward: 18 },
  { action: "discover", labelKey: "questDiscover", target: 2, reward: 16 },
  { action: "charm", labelKey: "questCharm", target: 1, reward: 22 },
  { action: "expedition", labelKey: "questExpedition", target: 1, reward: 24 },
  { action: "special", labelKey: "questSpecial", target: 1, reward: 23 },
  { action: "request", labelKey: "questRequest", target: 1, reward: 19 },
  { action: "combo", labelKey: "questCombo", target: 1, reward: 21 },
  { action: "toyPlay", labelKey: "questToyPlay", target: 1, reward: 18 },
  { action: "roomPlay", labelKey: "questRoomPlay", target: 1, reward: 18 },
  { action: "roomEvent", labelKey: "questRoomEvent", target: 2, reward: 19 },
  { action: "miniGame", labelKey: "questMiniGame", target: 1, reward: 20 },
  { action: "effect", labelKey: "questEffect", target: 1, reward: 16 },
  { action: "eggCare", labelKey: "questEggCare", target: 1, reward: 18 },
  { action: "snack", labelKey: "questSnack", target: 2, reward: 17 },
  { action: "mood", labelKey: "questMood", target: 2, reward: 15 },
  { action: "talent", labelKey: "questTalent", target: 2, reward: 19 },
  { action: "job", labelKey: "questJob", target: 2, reward: 18 },
  { action: "focus", labelKey: "questFocus", target: 1, reward: 22 },
  { action: "microEvent", labelKey: "questMicroEvent", target: 2, reward: 17 },
  { action: "medalTrial", labelKey: "questMedalTrial", target: 1, reward: 23 },
  { action: "petWalk", labelKey: "questPetWalk", target: 1, reward: 20 },
  { action: "trainingYard", labelKey: "questTrainingYard", target: 1, reward: 22 },
  { action: "patrol", labelKey: "questPatrol", target: 2, reward: 20 },
]);

const SOCIAL_INTERACTIONS = Object.freeze([
  { id: "greet", weight: 4, happiness: 4, bond: 1, energy: 0, training: 0, impulse: 0.35, color: "#42d7c5" },
  { id: "play", weight: 3, happiness: 8, bond: 2, energy: -4, training: 1, impulse: 1.1, color: "#38bdf8" },
  { id: "follow", weight: 3, happiness: 5, bond: 2, energy: -2, training: 2, impulse: 0.75, color: "#a78bfa" },
  { id: "share", weight: 2, happiness: 6, bond: 3, energy: 2, training: 0, impulse: 0.45, color: "#facc15" },
  { id: "nap", weight: 1, happiness: 3, bond: 1, energy: 8, training: 0, impulse: 0.15, color: "#c4b5fd" },
]);

const SOCIAL_LINE_PARTS = Object.freeze({
  greet: {
    ko: ["작게 인사했어", "코끝으로 톡 인사", "옆을 지나가며 눈인사", "반가운 신호 교환"],
    en: ["shared a tiny hello", "booped a little greeting", "traded a passing nod", "exchanged a friendly signal"],
  },
  play: {
    ko: ["짧게 술래잡기 시작", "같이 통통 뛰었어", "장난 루프 진입", "꼬리 추격전 성공"],
    en: ["started a tiny chase", "bounced together", "entered play loop", "tail chase success"],
  },
  follow: {
    ko: ["잠깐 따라가기 훈련", "같은 궤도로 움직였어", "나란히 이동 연습", "작은 행진 성공"],
    en: ["practiced following", "matched the same route", "trained side-by-side movement", "tiny march success"],
  },
  share: {
    ko: ["간식 이야기를 나눴어", "작은 응원 나눔", "좋은 기분을 공유", "따뜻한 픽셀 교환"],
    en: ["shared snack gossip", "shared tiny encouragement", "passed along a good mood", "traded warm pixels"],
  },
  nap: {
    ko: ["잠깐 같이 쉬었어", "나란히 느긋해졌어", "조용한 휴식 모드", "작은 낮잠 동맹"],
    en: ["rested together", "slowed down side by side", "quiet rest mode", "tiny nap alliance"],
  },
});

const CARE_LINE_PARTS = Object.freeze({
  feed: {
    ko: ["간식 충전 완료", "든든하게 먹었어", "작은 배가 따뜻해졌어", "맛있는 에너지 들어왔어"],
    en: ["Snack loaded", "A cozy bite landed", "Tiny belly is warmer", "Fresh energy arrived"],
  },
  play: {
    ko: ["신나게 뛰었어", "꼬리 속도가 올라갔어", "오늘 놀이 기억 저장", "장난감 추적 성공"],
    en: ["Play sprint complete", "Tail speed increased", "Play memory saved", "Toy chase success"],
  },
  pet: {
    ko: ["쓰담 신호 수신", "마음이 폭신해졌어", "친밀도 반짝", "손길을 기억할게"],
    en: ["Pet signal received", "Heart got softer", "Bond sparkle", "I will remember that touch"],
  },
  clean: {
    ko: ["뽀송 모드 켜짐", "먼지 픽셀 제거", "반짝 청결 완료", "상쾌하게 재부팅"],
    en: ["Fluffy clean mode on", "Dust pixels removed", "Sparkly clean", "Fresh reboot complete"],
  },
  train: {
    ko: ["작은 기술을 배웠어", "훈련 기록 갱신", "움직임이 더 똑똑해졌어", "집중력 상승"],
    en: ["Learned a tiny trick", "Training log updated", "Movement got smarter", "Focus up"],
  },
  nap: {
    ko: ["짧게 충전했어", "잠깐 꿈을 꿨어", "에너지 회복 완료", "느긋한 낮잠 성공"],
    en: ["Quick recharge done", "Had a tiny dream", "Energy recovered", "Gentle nap success"],
  },
});

const LOCAL_CHARACTER_LINES = Object.freeze({
  ufo: {
    ko: ["삐빅, 화면 위 이상한 패턴을 정찰 중이야.", "작은 UFO가 조용히 순찰 지나갑니다.", "여기 공기 흐름이 꽤 흥미로운데?"],
    en: ["Beep beep, I am scouting odd little patterns.", "Tiny UFO patrol passing through.", "The air currents here are curious."],
  },
  car: {
    ko: ["부릉, 속도는 낮춰도 기분은 빠르게!", "길만 열리면 바로 달릴 준비 완료.", "오늘도 픽셀 타이어 상태 최고야."],
    en: ["Vroom, calm speed but fast mood.", "Road is clear and I am ready.", "Pixel tires are feeling sharp today."],
  },
  slime: {
    ko: ["말랑하게 옆에 붙어 있을게.", "천천히 해도 괜찮아, 내가 같이 있어.", "오늘 분위기 꽤 포근한데?"],
    en: ["I will stay softly nearby.", "Slow is fine. I am here with you.", "The mood feels cozy today."],
  },
  comet: {
    ko: ["반짝, 작은 꼬리를 남기고 지나가.", "지금 이 화면에 별가루 조금 뿌렸어.", "나는 오늘도 빛나는 궤도를 그리는 중."],
    en: ["Spark, leaving a tiny tail behind.", "I sprinkled a little stardust here.", "I am drawing a bright little orbit."],
  },
  star: {
    ko: ["반짝. 오늘 운은 꽤 좋아 보여.", "작은 별빛으로 집중을 지켜줄게.", "괜찮아, 천천히 밝아지면 돼."],
    en: ["Twinkle. Luck looks pretty good today.", "I will guard your focus with tiny light.", "It is okay to brighten slowly."],
  },
  pup: {
    ko: ["멍! 오늘도 같이 화면 산책하자.", "콩이가 쫑긋 귀로 응원하는 중!", "작은 발자국으로 옆을 지킬게."],
    en: ["Woof! Let us walk the screen together.", "Kongi's ears perk up for you.", "Tiny paws guarding your side."],
  },
  kit: {
    ko: ["나비가 조용히 관찰하는 중이야.", "냐옹, 지금은 집중하기 좋은 공기야.", "부드럽게 다가와서 옆에 앉을게."],
    en: ["Nabi is quietly watching.", "Meow, the air is good for focus.", "I will sit softly nearby."],
  },
  bunny: {
    ko: ["모치가 통통, 좋은 리듬 찾았어.", "당근은 없어도 기분은 좋아.", "작게 뛰면서 응원할게."],
    en: ["Mochi found a bouncy rhythm.", "No carrot needed, mood is good.", "Tiny hops, big support."],
  },
  fox: {
    ko: ["포포가 동그란 귀로 길을 살피고 있어.", "살짝 장난스럽지만 네 편이야.", "복슬 꼬리로 화면 흐름을 읽는 중."],
    en: ["Popo scans the route with round ears.", "A little playful, fully on your side.", "My fluffy tail reads the screen flow."],
  },
  hamster: {
    ko: ["펭구가 뒤뚱뒤뚱 다가왔어.", "천천히 미끄러져도 결국 도착해.", "포근한 깃털로 힘을 줄게."],
    en: ["Pengu waddled over to you.", "Sliding slowly still arrives.", "Cozy feathers of encouragement."],
  },
  rocket: {
    ko: ["발사 준비 완료. 대답도 곧 착륙!", "로켓 속도 낮추고 네 말 듣는 중.", "작은 추진력으로 계속 곁에 있을게."],
    en: ["Launch ready. Reply landing soon.", "Rocket speed down, listening now.", "Tiny thrust, staying close."],
  },
  saturn: {
    ko: ["고리가 살짝 졸리지만 지켜보고 있어.", "우주식으로 천천히 생각 중이야.", "조용한 궤도에서 같이 돌자."],
    en: ["My rings are sleepy, but I am watching.", "Thinking slowly, cosmic style.", "Let us orbit calmly."],
  },
  gem: {
    ko: ["반짝임 기준으로 보면 꽤 괜찮은 흐름이야.", "정교하게 빛나는 중. 계속해도 좋아.", "작은 광택으로 집중을 정리해줄게."],
    en: ["By sparkle standards, this flow is good.", "Polishing the moment. Keep going.", "A tiny shine to organize your focus."],
  },
  donut: {
    ko: ["달콤하게 응원 한 입 줄게.", "쉬엄쉬엄 해도 맛은 살아있어.", "오늘은 설탕 코팅처럼 부드럽게 가자."],
    en: ["A sweet bite of encouragement for you.", "Easy pace still tastes good.", "Let us go smooth like glaze today."],
  },
  skull: {
    ko: ["으스스하지만 네 편이야.", "작은 해골이 조용히 응원 중.", "어둡게 보여도 귀엽게 지켜볼게."],
    en: ["Spooky, but on your side.", "Tiny skull cheering quietly.", "Dark look, harmless heart."],
  },
  eyeball: {
    ko: ["봤어. 작은 변화도 놓치지 않을게.", "눈 크게 뜨고 화면을 지키는 중.", "픽셀 눈동자가 집중 모드야."],
    en: ["I saw that. Tiny changes will not slip by.", "Wide eye, guarding the screen.", "Pixel pupil is in focus mode."],
  },
  energyball: {
    ko: ["파직! 에너지 조금 충전 완료.", "작게 튀면서 텐션 올리는 중!", "지금 흐름 좋아, 번쩍 가자."],
    en: ["Zap! Tiny energy charged.", "Bouncing up the mood.", "Good flow. Flash forward."],
  },
  bug: {
    ko: ["사사삭, 조용히 정찰 중이야.", "구석부터 확인 완료. 이상 없음.", "작지만 충성스럽게 주변을 살필게."],
    en: ["Skitter, quiet scouting in progress.", "Corners checked. All clear.", "Small but loyal, watching nearby."],
  },
  tank: {
    ko: ["방어 태세 유지. 천천히 전진.", "작은 탱크가 든든하게 지켜줄게.", "경로 확인 완료. 안전하게 가자."],
    en: ["Defense mode steady. Moving slowly.", "Tiny tank guarding firmly.", "Route checked. Safe advance."],
  },
  custom: {
    ko: ["나만의 픽셀 친구가 여기 있어.", "커스텀 캐릭터도 말할 준비 완료.", "작은 도트 마음으로 대답할게."],
    en: ["Your custom pixel friend is here.", "Custom companion ready to talk.", "Answering with a tiny pixel heart."],
  },
});

const LOCAL_CHARACTER_STYLES = Object.freeze({
  ufo: { ko: "스캔 결과,", en: "Scan result:" },
  car: { ko: "도로를 정리해보면,", en: "Road check:" },
  slime: { ko: "말랑하게 정리하면,", en: "Soft summary:" },
  comet: { ko: "궤적을 보면,", en: "Trail check:" },
  star: { ko: "별빛 기준으로,", en: "Starlight read:" },
  pup: { ko: "멍멍 기준으로,", en: "Paw check:" },
  kit: { ko: "고양이 감각으로,", en: "Whisker read:" },
  bunny: { ko: "통통 뛰어보면,", en: "Hop check:" },
  fox: { ko: "여우식으로 보면,", en: "Fox read:" },
  hamster: { ko: "볼주머니 기준으로,", en: "Cheek-pouch read:" },
  rocket: { ko: "발사 전에 정리하면,", en: "Pre-launch check:" },
  saturn: { ko: "천천히 궤도를 보면,", en: "Orbit check:" },
  gem: { ko: "정교하게 보면,", en: "Facet check:" },
  donut: { ko: "부드럽게 말하면,", en: "Sweet summary:" },
  skull: { ko: "차분히 보면,", en: "Calm read:" },
  eyeball: { ko: "내가 보기엔,", en: "From what I see:" },
  energyball: { ko: "에너지 흐름상,", en: "Energy read:" },
  bug: { ko: "위에서 내려다보면,", en: "Top-down check:" },
  tank: { ko: "작전 기준으로,", en: "Tactical read:" },
  custom: { ko: "네 커스텀 친구로서,", en: "As your custom pal:" },
});

function panelText(key) {
  const language = ["en", "ko"].includes(settings?.language) ? settings.language : "en";
  return PANEL_I18N[language]?.[key] || PANEL_I18N.en[key] || key;
}

function currentLanguage() {
  return settings?.language === "ko" ? "ko" : "en";
}

function localLinesFor(characterId) {
  const key = LOCAL_CHARACTER_LINES[characterId] ? characterId : customCharacterFor(characterId) ? "custom" : "star";
  return LOCAL_CHARACTER_LINES[key]?.[currentLanguage()] || LOCAL_CHARACTER_LINES.star.en;
}

function localStyleFor(characterId) {
  const key = LOCAL_CHARACTER_STYLES[characterId] ? characterId : customCharacterFor(characterId) ? "custom" : "star";
  return LOCAL_CHARACTER_STYLES[key]?.[currentLanguage()] || LOCAL_CHARACTER_STYLES.star.en;
}

function personalityForCharacterId(characterId) {
  const custom = customCharacterFor(characterId);
  if (custom) {
    const seed = [custom.name, custom.concept, characterId].filter(Boolean).join(":") || characterId;
    return PERSONALITIES[PERSONALITY_IDS[hashText(seed) % PERSONALITY_IDS.length]];
  }
  return PERSONALITIES[PERSONALITY_BY_CHARACTER[characterId]] || PERSONALITIES.curious;
}

function personalityForPet(pet) {
  return personalityForCharacterId(pet?.characterId || DEFAULT_CHARACTER);
}

function personalityLikedActionCount(pet, care = careForPet(pet)) {
  const personality = personalityForPet(pet);
  return (personality.likes || []).reduce((sum, actionId) => sum + (care.actionCounts?.[actionId] || 0), 0);
}

function personalityCareBonus(personality, actionId) {
  return personality?.careBonus?.[actionId] || null;
}

function personalityBonusLine(personality, actionId) {
  if (!personality?.likes?.includes(actionId)) return "";
  const label = careText(personality.labelKey);
  if (currentLanguage() === "ko") return ` ${label} 성격 보너스.`;
  return ` ${label} personality bonus.`;
}

function parseLocalMovementCommand(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return null;

  const hasCommandTone =
    /가라|가줘|가봐|가자|으로 가|로 가|이동|움직|움직여|멈|가만|정지|서 ?있|따라|피해|피하|느리게|천천히|빨리|빠르게|속도|두 ?배|2배|절반|반으로|돌아|돌아봐|돌아라|회전|빙글|spin|rotate|go|move|stop|stay|pause|follow|avoid|slow|fast|speed|double|half/.test(
      value,
    ) || value.length <= 12;
  if (!hasCommandTone) return null;

  const command = createMovementCommand();

  const hasLeft = /왼쪽|좌측|left/.test(value);
  const hasRight = /오른쪽|우측|right/.test(value);
  const hasUp = /위쪽|상단|위로|올라|up|top|upper/.test(value);
  const hasDown = /아래|하단|아래로|내려|down|bottom|lower/.test(value);
  const hasCenter = /중앙|가운데|center|middle/.test(value);
  const hasMoveVerb = /가라|가줘|가봐|가자|으로 가|로 가|이동|움직|move|go/.test(value);
  const hasAreaVerb = /영역|쪽에서|근처|주변|머물|놀아|area|zone|side/.test(value);
  const spinIntent = /(돌아|돌아봐|돌아라|회전|빙글|한 ?바퀴|spin|rotate)/.test(value) && !/돌아다/.test(value);
  const roamIntent = /돌아다|움직여|움직이|자유|마음대로|roam|free|wander/.test(value);

  if (/멈|가만|정지|서 ?있|stop|stay|pause/.test(value)) {
    command.stop = true;
    command.changed = true;
  }
  if (roamIntent) {
    command.roam = true;
    command.stop = false;
    command.changed = true;
  }
  if (/따라|쫓아|follow|come to me/.test(value)) {
    command.follow = true;
    command.changed = true;
  }
  if (/피해|피하|멀어|avoid|run away/.test(value)) {
    command.avoid = true;
    command.changed = true;
  }
  if (/(두 ?배|2배|x2|double|twice)/.test(value) && /(속도|speed|빠르|빨리|올|up|fast)/.test(value)) {
    command.speedFactor = 2;
    command.changed = true;
  } else if (/(절반|반으로|반만|half|x0\.5)/.test(value) && /(속도|speed|느리|낮|줄|slow|down)/.test(value)) {
    command.speedFactor = 0.5;
    command.changed = true;
  } else if (/아주 느리게|엄청 느리게|very slow/.test(value)) {
    command.speed = 0.35;
    command.changed = true;
  } else if (/느리게|천천히|속도.*낮|slow/.test(value)) {
    command.speed = 0.55;
    command.changed = true;
  } else if (/엄청 빨리|아주 빨리|very fast/.test(value)) {
    command.speed = 2.25;
    command.changed = true;
  } else if (/빨리|빠르게|속도.*올|fast|speed up/.test(value)) {
    command.speed = 1.7;
    command.changed = true;
  } else if (/보통|원래|기본|normal|default speed/.test(value)) {
    command.speed = 1;
    command.changed = true;
  }

  if (spinIntent) {
    const direction = hasLeft || /반시계|counter/.test(value) ? -1 : 1;
    const turns = /두 ?바퀴|2바퀴|twice/.test(value) ? 2 : 1;
    command.spin = direction * 34 * turns;
    command.changed = true;
  }

  const directionOnly = (hasLeft || hasRight || hasUp || hasDown || hasCenter) && value.length <= 16;
  if (!spinIntent && (hasMoveVerb || directionOnly)) {
    const x = (hasRight ? 1 : 0) - (hasLeft ? 1 : 0);
    const y = (hasDown ? 1 : 0) - (hasUp ? 1 : 0);
    if (hasCenter) command.target = { center: true };
    else if (x || y) command.target = { x, y };
    if (command.target) command.changed = true;
  }

  if (hasAreaVerb) {
    if (hasLeft) command.area = { left: 0.03, top: 0.06, right: 0.42, bottom: 0.92 };
    else if (hasRight) command.area = { left: 0.58, top: 0.06, right: 0.97, bottom: 0.92 };
    else if (hasUp) command.area = { left: 0.03, top: 0.06, right: 0.97, bottom: 0.42 };
    else if (hasDown) command.area = { left: 0.03, top: 0.58, right: 0.97, bottom: 0.92 };
    else if (hasCenter) command.area = { left: 0.22, top: 0.22, right: 0.78, bottom: 0.78 };
    if (command.area) command.changed = true;
  }

  return command.changed ? command : null;
}

function movementCommandReply(character, command) {
  const language = currentLanguage();
  const parts = [];
  if (language === "ko") {
    if (command.stop) parts.push("여기서 멈춰 있을게.");
    if (command.roam) parts.push("다시 자유롭게 돌아다닐게.");
    if (command.follow) parts.push("마우스를 따라갈게.");
    if (command.avoid) parts.push("마우스는 피해서 움직일게.");
    if (command.mouseMode === "ignore") parts.push("마우스 반응은 잠깐 끌게.");
    if (Number.isFinite(command.speedFactor)) parts.push(`속도는 지금의 ${command.speedFactor.toFixed(1)}배로 바꿨어.`);
    if (command.speed === 0.35) parts.push("속도는 아주 느리게 낮췄어.");
    else if (command.speed === 0.55) parts.push("속도는 천천히로 낮췄어.");
    else if (command.speed === 1) parts.push("속도는 기본으로 맞췄어.");
    else if (command.speed === 1.7) parts.push("속도는 빠르게 올렸어.");
    else if (command.speed === 2.25) parts.push("속도는 아주 빠르게 올렸어.");
    else if (Number.isFinite(command.speed)) parts.push(`속도는 ${command.speed.toFixed(1)}x로 맞췄어.`);
    if (command.target?.center) parts.push("가운데로 이동할게.");
    else if (command.target?.x < 0) parts.push("왼쪽으로 이동할게.");
    else if (command.target?.x > 0) parts.push("오른쪽으로 이동할게.");
    if (command.target?.y < 0) parts.push("위로 이동할게.");
    else if (command.target?.y > 0) parts.push("아래로 이동할게.");
    if (command.area) parts.push("활동 구역도 그쪽으로 맞춰둘게.");
    if (command.spin) parts.push(command.spin < 0 ? "반대로 한 바퀴 돌게." : "빙글 한 바퀴 돌게.");
    return `${localStyleFor(character.id)} ${parts.join(" ") || "명령 확인했어."}`;
  }

  if (command.stop) parts.push("I will stay here.");
  if (command.roam) parts.push("I will roam freely again.");
  if (command.follow) parts.push("I will follow the mouse.");
  if (command.avoid) parts.push("I will avoid the mouse.");
  if (command.mouseMode === "ignore") parts.push("Mouse reaction is off for now.");
  if (Number.isFinite(command.speedFactor)) parts.push(`Speed changed by ${command.speedFactor.toFixed(1)}x.`);
  if (command.speed === 0.35) parts.push("Speed set very slow.");
  else if (command.speed === 0.55) parts.push("Speed set slow.");
  else if (command.speed === 1) parts.push("Speed reset to normal.");
  else if (command.speed === 1.7) parts.push("Speed set fast.");
  else if (command.speed === 2.25) parts.push("Speed set very fast.");
  else if (Number.isFinite(command.speed)) parts.push(`Speed set to ${command.speed.toFixed(1)}x.`);
  if (command.target?.center) parts.push("Moving to the center.");
  else if (command.target?.x < 0) parts.push("Moving left.");
  else if (command.target?.x > 0) parts.push("Moving right.");
  if (command.target?.y < 0) parts.push("Moving up.");
  else if (command.target?.y > 0) parts.push("Moving down.");
  if (command.area) parts.push("I will keep my activity area there.");
  if (command.spin) parts.push(command.spin < 0 ? "Spinning counterclockwise." : "Spinning around.");
  return `${localStyleFor(character.id)} ${parts.join(" ") || "Command received."}`;
}

function createMovementCommand() {
  return {
    target: null,
    area: null,
    speed: null,
    speedFactor: null,
    distance: null,
    aiHoldMs: null,
    mouseMode: null,
    spin: 0,
    stop: false,
    roam: false,
    follow: false,
    avoid: false,
    changed: false,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function careText(key) {
  return panelText(key);
}

function finiteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function currentDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentLeagueSeasonKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function dayNumber(dayKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ""));
  if (!match) return Number.NaN;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

function currentSeasonId(date = new Date()) {
  const month = date.getMonth();
  return Object.entries(SEASONS).find(([, season]) => season.months.includes(month))?.[0] || "spring";
}

function currentTimeBandId(date = new Date()) {
  const hour = date.getHours();
  return Object.entries(TIME_BANDS).find(([, band]) => {
    if (band.start < band.end) return hour >= band.start && hour < band.end;
    return hour >= band.start || hour < band.end;
  })?.[0] || "afternoon";
}

function ambientKey(date = new Date()) {
  return `${currentDayKey(date)}:${currentTimeBandId(date)}`;
}

function seededIndex(seed, index, length) {
  const x = Math.sin(seed * 31.17 + index * 73.91) * 10000;
  return Math.abs(Math.floor(x)) % length;
}

function questSeed(dayKey) {
  return String(dayKey || "").split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 0);
}

function buildDailyQuests(dayKey) {
  const pool = QUEST_TEMPLATES.map((template) => ({ ...template }));
  const seed = questSeed(dayKey);
  const picked = [];
  while (pool.length && picked.length < 3) {
    const index = seededIndex(seed, picked.length, pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked.map((template, index) => ({
    id: `${dayKey}-${template.action}-${index}`,
    action: template.action,
    labelKey: template.labelKey,
    target: template.target + (seededIndex(seed, index + 5, 2) === 0 ? 0 : 1),
    progress: 0,
    reward: template.reward + seededIndex(seed, index + 11, 7),
    done: false,
    claimed: false,
  }));
}

function normalizeQuest(source) {
  const src = source && typeof source === "object" ? source : {};
  const id = String(src.id || "").trim().slice(0, 48);
  const action = QUEST_ACTION_IDS.includes(src.action) ? src.action : "";
  const labelKey = String(src.labelKey || "").trim().slice(0, 48);
  if (!id || !action || !labelKey) return null;
  const target = Math.round(clamp(finiteNumber(src.target, 1), 1, 99));
  const progress = Math.round(clamp(finiteNumber(src.progress, 0), 0, target));
  return {
    id,
    action,
    labelKey,
    target,
    progress,
    reward: Math.round(clamp(finiteNumber(src.reward, 10), 1, 999)),
    done: src.done === true || progress >= target,
    claimed: src.claimed === true,
  };
}

function normalizeCollections(source) {
  const src = source && typeof source === "object" ? source : {};
  const collections = {};
  for (const id of DISCOVERY_ITEM_IDS) {
    const count = Math.round(clamp(finiteNumber(src[id], 0), 0, 9999));
    if (count > 0) collections[id] = count;
  }
  return collections;
}

function normalizeHabitatInventory(source) {
  return Array.isArray(source)
    ? Array.from(new Set(source.filter((id) => HABITAT_IDS.includes(id)))).slice(0, HABITAT_IDS.length)
    : [];
}

function normalizeEffectInventory(source) {
  const selected = Array.isArray(source) ? source : [];
  return Array.from(new Set(["normal", ...selected.filter((id) => EFFECT_IDS.includes(id))])).slice(0, EFFECT_IDS.length);
}

function normalizeCharmInventory(source) {
  return Array.isArray(source)
    ? Array.from(new Set(source.filter((id) => CHARM_IDS.includes(id)))).slice(0, CHARM_IDS.length)
    : [];
}

function normalizeSnackInventory(source) {
  const src = source && typeof source === "object" ? source : {};
  const inventory = {};
  for (const snackId of SNACK_IDS) {
    const count = Math.round(clamp(finiteNumber(src[snackId], 0), 0, 99));
    if (count > 0) inventory[snackId] = count;
  }
  return inventory;
}

function normalizePetDex(source) {
  const src = source && typeof source === "object" ? source : {};
  const dex = {};
  for (const id of PET_ALBUM_IDS) {
    const record = src[id];
    const data = record && typeof record === "object" ? record : {};
    const seen = record === true || data.seen === true;
    const bestLevel = Math.round(clamp(finiteNumber(data.bestLevel, 0), 0, 99));
    const hatchCount = Math.round(clamp(finiteNumber(data.hatchCount, 0), 0, 9999));
    const firstSeenDayKey = String(data.firstSeenDayKey || "").trim().slice(0, 16);
    if (!seen && bestLevel <= 0 && hatchCount <= 0) continue;
    dex[id] = {
      seen: true,
      firstSeenDayKey: firstSeenDayKey || currentDayKey(),
      bestLevel,
      hatchCount,
    };
  }
  return dex;
}

function normalizeMoodMoments(source) {
  const src = source && typeof source === "object" ? source : {};
  const counts = {};
  const rawCounts = src.counts && typeof src.counts === "object" ? src.counts : {};
  for (const id of MOOD_AURA_IDS) {
    const count = Math.round(clamp(finiteNumber(rawCounts[id], 0), 0, 9999));
    if (count > 0) counts[id] = count;
  }
  return {
    counts,
    lastAt: Math.round(clamp(finiteNumber(src.lastAt, 0), 0, Date.now())),
    lastMood: MOOD_AURA_IDS.includes(src.lastMood) ? src.lastMood : "",
  };
}

function normalizeEggNest(source) {
  const src = source && typeof source === "object" ? source : {};
  return {
    progress: Math.round(clamp(finiteNumber(src.progress, 0), 0, 100)),
    hatchedCount: Math.round(clamp(finiteNumber(src.hatchedCount, 0), 0, 9999)),
    lastHatched: EGG_HATCH_POOL.includes(src.lastHatched) ? src.lastHatched : "",
  };
}

function normalizeHabitatLayout(source, inventory = []) {
  const owned = new Set(inventory);
  return Array.isArray(source)
    ? Array.from(new Set(source.filter((id) => HABITAT_IDS.includes(id) && owned.has(id)))).slice(0, HABITAT_SLOT_LIMIT)
    : [];
}

function normalizeHabitatTheme(source) {
  return HABITAT_THEME_IDS.includes(source) ? source : DEFAULT_GAME.habitatTheme;
}

function normalizeAmbientEvents(source) {
  const src = source && typeof source === "object" ? source : {};
  const counts = {};
  const rawCounts = src.counts && typeof src.counts === "object" ? src.counts : {};
  for (const id of AMBIENT_EVENT_IDS) {
    const count = Math.round(clamp(finiteNumber(rawCounts[id], 0), 0, 9999));
    if (count > 0) counts[id] = count;
  }
  return {
    counts,
    lastAt: Math.round(clamp(finiteNumber(src.lastAt, 0), 0, Date.now())),
    lastId: AMBIENT_EVENT_IDS.includes(src.lastId) ? src.lastId : "",
    lastKey: String(src.lastKey || "").trim().slice(0, 32),
  };
}

function normalizeDailyStreak(source) {
  const src = source && typeof source === "object" ? source : {};
  const current = Math.round(clamp(finiteNumber(src.current, 0), 0, 9999));
  const best = Math.round(clamp(finiteNumber(src.best, current), 0, 9999));
  return {
    lastSeenDayKey: String(src.lastSeenDayKey || "").trim().slice(0, 16),
    current,
    best: Math.max(best, current),
    claimedDayKey: String(src.claimedDayKey || "").trim().slice(0, 16),
  };
}

function normalizeLeagueSeason(source) {
  const src = source && typeof source === "object" ? source : {};
  const currentKey = currentLeagueSeasonKey();
  const rawKey = String(src.seasonKey || currentKey).trim().slice(0, 16);
  const rawPoints = Math.round(clamp(finiteNumber(src.points, 0), 0, 999999));
  const rawBest = Math.round(clamp(finiteNumber(src.bestPoints, rawPoints), 0, 999999));
  const claimedTiers = Array.isArray(src.claimedTiers)
    ? Array.from(new Set(src.claimedTiers.filter((id) => LEAGUE_SEASON_TIER_IDS.includes(id)))).slice(0, LEAGUE_SEASON_TIER_IDS.length)
    : [];
  if (rawKey !== currentKey) {
    return {
      seasonKey: currentKey,
      points: 0,
      bestPoints: Math.max(rawBest, rawPoints),
      claimedTiers: [],
    };
  }
  return {
    seasonKey: currentKey,
    points: rawPoints,
    bestPoints: Math.max(rawBest, rawPoints),
    claimedTiers,
  };
}

function updateDailyStreak(streak, today = currentDayKey()) {
  const next = normalizeDailyStreak(streak);
  if (next.lastSeenDayKey !== today) {
    const last = dayNumber(next.lastSeenDayKey);
    const now = dayNumber(today);
    if (!Number.isFinite(last) || !Number.isFinite(now)) {
      next.current = 1;
    } else if (now - last === 1) {
      next.current = Math.max(1, next.current + 1);
    } else if (now > last) {
      next.current = 1;
    } else {
      next.current = Math.max(1, next.current);
    }
    next.lastSeenDayKey = today;
    next.best = Math.max(next.best, next.current);
  }
  return next;
}

function dailyStreakFor(game) {
  return normalizeDailyStreak(game?.streak);
}

function normalizeFocus(source) {
  const src = source && typeof source === "object" ? source : {};
  const targetMinutes = Math.round(clamp(finiteNumber(src.targetMinutes, DEFAULT_GAME.focus.targetMinutes), 5, 90));
  const activeSlot = Math.round(clamp(finiteNumber(src.activeSlot, -1), -1, MAX_SLOTS - 1));
  const startedAt = activeSlot >= 0 ? Math.round(clamp(finiteNumber(src.startedAt, 0), 0, Date.now())) : 0;
  return {
    activeSlot: startedAt > 0 ? activeSlot : -1,
    startedAt,
    targetMinutes,
    totalMinutes: Math.round(clamp(finiteNumber(src.totalMinutes, 0), 0, 999999)),
    completed: Math.round(clamp(finiteNumber(src.completed, 0), 0, 999999)),
    bestMinutes: Math.round(clamp(finiteNumber(src.bestMinutes, 0), 0, 9999)),
    lastCompletedDayKey: String(src.lastCompletedDayKey || "").trim().slice(0, 16),
  };
}

function focusFor(game) {
  return normalizeFocus(game?.focus);
}

function focusElapsedMs(focus, now = Date.now()) {
  return focus?.startedAt > 0 ? Math.max(0, now - focus.startedAt) : 0;
}

function focusElapsedMinutes(focus, now = Date.now()) {
  return Math.round(clamp(Math.floor(focusElapsedMs(focus, now) / 60000), 0, 9999));
}

function totalFocusSessions(care) {
  return Math.round(clamp(Number(care?.actionCounts?.focusSession) || 0, 0, 999999));
}

function totalFocusMinutes(care) {
  return Math.round(clamp(Number(care?.actionCounts?.focusMinutes) || 0, 0, 999999));
}

function actionCount(care, key) {
  return Math.round(clamp(Number(care?.actionCounts?.[key]) || 0, 0, 999999));
}

function growthPathScores(care, game = null) {
  const safeCare = care || normalizeCare(null);
  const collections = collectionUniqueCount(game);
  const roomComfort = habitatComfortScore(game);
  const packEvents = totalPackEvents(safeCare);
  const contestRuns = totalContestRuns(safeCare);
  const walks = totalPetWalks(safeCare);
  const yardRuns = totalTrainingYardRuns(safeCare);
  const patrolRuns = totalPatrolRuns(safeCare);
  return {
    explorer: Math.round(clamp(
      totalExpeditionRuns(safeCare) * 9 +
        actionCount(safeCare, "job:pocketScout") * 5 +
        totalTinyJobs(safeCare) * 2 +
        collections * 7 +
        walks * 5 +
        yardRuns * 2 +
        patrolRuns * 7 +
        totalRoomEvents(safeCare) * 2 +
        packEvents * 3 +
        safeCare.level * 2,
      0,
      9999,
    )),
    scholar: Math.round(clamp(
      safeCare.training * 0.45 +
        totalFocusSessions(safeCare) * 8 +
        totalFocusMinutes(safeCare) * 0.5 +
        totalTalentLevels(safeCare) * 9 +
        actionCount(safeCare, "train") * 4 +
        yardRuns * 5 +
        patrolRuns * 2 +
        totalPetCommands(safeCare) * 3 +
        contestRuns * 3 +
        totalMiniGames(safeCare) * 2,
      0,
      9999,
    )),
    cozy: Math.round(clamp(
      (actionCount(safeCare, "feed") + actionCount(safeCare, "pet") + actionCount(safeCare, "nap") + actionCount(safeCare, "clean")) * 4 +
        actionCount(safeCare, "snackUse") * 5 +
        actionCount(safeCare, "roomPlay") * 7 +
        walks * 3 +
        yardRuns * 2 +
        patrolRuns * 3 +
        totalCareRoutines(safeCare) * 3 +
        actionCount(safeCare, "habitatRest") * 6 +
        roomComfort * 0.08 +
        safeCare.hygiene * 0.12 +
        safeCare.happiness * 0.12,
      0,
      9999,
    )),
    performer: Math.round(clamp(
      actionCount(safeCare, "play") * 5 +
        totalToyPlay(safeCare) * 8 +
        totalDesktopObjects(safeCare) * 6 +
        totalCareRoutines(safeCare) * 3 +
        totalPetCommands(safeCare) * 4 +
        totalSignatureActions(safeCare) * 6 +
        totalPlaydates(safeCare) * 7 +
        walks * 2 +
        yardRuns * 4 +
        patrolRuns * 2 +
        packEvents * 5 +
        contestRuns * 6 +
        totalMiniGames(safeCare) * 5 +
        totalTrickUses(safeCare) * 3 +
        safeCare.happiness * 0.2,
      0,
      9999,
    )),
  };
}

function growthPathRankKey(score) {
  if (score >= 150) return "growthRankSignature";
  if (score >= 80) return "growthRankRising";
  return "growthRankSprout";
}

function growthPathFor(care, game = null) {
  const scores = growthPathScores(care, game);
  const id = GROWTH_PATH_IDS
    .map((pathId) => ({ id: pathId, score: scores[pathId] || 0 }))
    .sort((a, b) => b.score - a.score || GROWTH_PATH_IDS.indexOf(a.id) - GROWTH_PATH_IDS.indexOf(b.id))[0]?.id || "explorer";
  const score = scores[id] || 0;
  return {
    id,
    def: GROWTH_PATHS[id] || GROWTH_PATHS.explorer,
    score,
    scores,
    rankKey: growthPathRankKey(score),
    next: score >= 150 ? 150 : score >= 80 ? 150 : 80,
  };
}

function growthPathBonusText(path) {
  const speed = Math.round(((path?.def?.speed || 1) - 1) * 100);
  const prefix = speed > 0 ? "+" : "";
  return `${prefix}${speed}% ${careText("roam")}`;
}

function bondPerkRequirementValues(care, game, perk) {
  const safeCare = care || normalizeCare(null);
  const requirement = perk?.requirement || {};
  return {
    level: safeCare.level || 1,
    bond: safeCare.bond || 0,
    training: safeCare.training || 0,
    happiness: safeCare.happiness || 0,
    careActions: totalCareActions(safeCare),
    patrols: totalPatrolRuns(safeCare),
    collections: collectionUniqueCount(game),
    roomComfort: habitatComfortScore(game),
    requirement,
  };
}

function bondPerkUnlocked(care, game, perk) {
  const values = bondPerkRequirementValues(care, game, perk);
  return Object.entries(values.requirement).every(([key, target]) => (values[key] || 0) >= target);
}

function bondPerkRequirementText(care, game, perk) {
  const values = bondPerkRequirementValues(care, game, perk);
  const labels = {
    level: careText("level"),
    bond: careText("bond"),
    training: careText("training"),
    happiness: careText("happiness"),
    careActions: careText("careTitle"),
    patrols: careText("patrolTimes"),
    collections: careText("collectionFound"),
    roomComfort: careText("habitatComfort"),
  };
  return Object.entries(values.requirement)
    .map(([key, target]) => `${labels[key] || key} ${Math.min(target, Math.round(values[key] || 0))}/${target}`)
    .join(" · ");
}

function bondPerkEffectText(perk) {
  const parts = [];
  if (Number.isFinite(perk?.speed)) {
    parts.push(`+${Math.round((perk.speed - 1) * 100)}% ${careText("roam")}`);
  }
  if (Number.isFinite(perk?.xp)) {
    parts.push(`+${Math.round((perk.xp - 1) * 100)}% ${careText("xp")}`);
  }
  const care = perk?.care || {};
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training", "bond"]) {
    if (!Number.isFinite(care[key]) || care[key] === 0) continue;
    parts.push(`+${care[key]} ${careText(key)}`);
  }
  return parts.join(" · ") || careText("bondPerkEffect");
}

function activeBondPerks(care, game = settings?.game || null) {
  return BOND_PERK_IDS
    .map((id) => ({ id, ...BOND_PERKS[id] }))
    .filter((perk) => bondPerkUnlocked(care, game, perk));
}

function totalBondPerks(care, game = settings?.game || null) {
  return activeBondPerks(care, game).length;
}

function bondPerkEffects(care, game = settings?.game || null) {
  const effects = { speed: 1, xp: 1, care: {} };
  for (const perk of activeBondPerks(care, game)) {
    if (Number.isFinite(perk.speed)) effects.speed *= perk.speed;
    if (Number.isFinite(perk.xp)) effects.xp *= perk.xp;
    for (const [key, value] of Object.entries(perk.care || {})) {
      if (!Number.isFinite(value)) continue;
      effects.care[key] = (effects.care[key] || 0) + value;
    }
  }
  effects.speed = clamp(effects.speed, 0.8, 1.18);
  effects.xp = clamp(effects.xp, 1, 1.16);
  return effects;
}

function caretakerCareEntries() {
  const slots = Array.isArray(settings?.slots) ? settings.slots : [];
  return slots
    .map((slot, index) => {
      const care = normalizeCare(slot?.care);
      const hasProgress =
        slot?.enabled !== false ||
        care.level > 1 ||
        care.bond > 0 ||
        care.training > 0 ||
        totalCareActions(care) > 0 ||
        (care.memories || []).length > 0;
      return hasProgress ? { index, slot, care } : null;
    })
    .filter(Boolean);
}

function caretakerStats(game = settings?.game || null) {
  const safeGame = normalizeGame(game);
  const entries = caretakerCareEntries();
  const totalLevel = entries.reduce((sum, entry) => sum + (entry.care.level || 1), 0);
  const totalBond = entries.reduce((sum, entry) => sum + (entry.care.bond || 0), 0);
  const totalTraining = entries.reduce((sum, entry) => sum + (entry.care.training || 0), 0);
  const totalCare = entries.reduce((sum, entry) => sum + totalCareActions(entry.care), 0);
  const totalPerks = entries.reduce((sum, entry) => sum + totalBondPerks(entry.care, safeGame), 0);
  const totalMedals = entries.reduce((sum, entry) => sum + unlockedMedalCount(entry.care, safeGame), 0);
  const collections = collectionUniqueCount(safeGame);
  const roomComfort = habitatComfortScore(safeGame);
  const album = petAlbumSeenCount(safeGame);
  const milestones = claimedMilestoneSet(safeGame).size;
  const score = Math.round(
    clamp(
      entries.length * 12 +
        totalLevel * 6 +
        totalBond * 0.22 +
        totalTraining * 0.7 +
        Math.sqrt(totalCare) * 8 +
        collections * 9 +
        roomComfort * 0.75 +
        album * 5 +
        milestones * 16 +
        totalPerks * 18 +
        totalMedals * 10,
      0,
      9999,
    ),
  );
  return {
    activePets: entries.length,
    totalLevel,
    totalBond,
    totalTraining,
    totalCare,
    totalPerks,
    totalMedals,
    collections,
    roomComfort,
    album,
    milestones,
    score,
  };
}

function caretakerRankFor(game = settings?.game || null) {
  const stats = caretakerStats(game);
  let index = 0;
  for (let rankIndex = 0; rankIndex < CARETAKER_RANKS.length; rankIndex += 1) {
    if (stats.score >= CARETAKER_RANKS[rankIndex].min) index = rankIndex;
  }
  const rank = CARETAKER_RANKS[index] || CARETAKER_RANKS[0];
  const next = CARETAKER_RANKS[index + 1] || null;
  const range = next ? Math.max(1, next.min - rank.min) : 1;
  const percent = next ? clamp(((stats.score - rank.min) / range) * 100, 0, 100) : 100;
  return { ...rank, index, stats, next, percent };
}

function caretakerRankBonusText(rank) {
  const xp = Math.round(((rank?.xp || 1) - 1) * 100);
  return `+${xp}% ${careText("xp")}`;
}

function totalEvolutionForms(care) {
  return Math.round(clamp(Number(care?.actionCounts?.formClaim) || 0, 0, EVOLUTION_FORM_IDS.length));
}

function evolutionFormClaimed(care, formId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`form:${formId}`]) || 0, 0, 1)) > 0;
}

function evolutionRequirementProgress(care, game, requirement = {}) {
  const path = growthPathFor(care, game);
  return {
    level: care?.level || 1,
    bond: care?.bond || 0,
    training: care?.training || 0,
    careActions: totalCareActions(care),
    pathScore: path.score,
    commands: totalPetCommands(care),
    tricks: totalTrickUses(care),
  };
}

function evolutionFormUnlocked(care, game, form) {
  const requirement = form?.requirement || {};
  const progress = evolutionRequirementProgress(care, game, requirement);
  return Object.entries(requirement).every(([key, target]) => (progress[key] || 0) >= target);
}

function evolutionCurrentForm(care, game = null) {
  const fallback = { id: "sprout", ...EVOLUTION_FORMS.sprout };
  return EVOLUTION_FORM_IDS
    .map((id) => ({ id, ...EVOLUTION_FORMS[id] }))
    .filter((form) => evolutionFormUnlocked(care, game, form))
    .pop() || fallback;
}

function evolutionRequirementText(care, game, form) {
  const requirement = form?.requirement || {};
  const progress = evolutionRequirementProgress(care, game, requirement);
  const labels = {
    level: careText("level"),
    bond: careText("bond"),
    training: careText("training"),
    careActions: careText("careTitle"),
    pathScore: careText("growthPathTitle"),
    commands: careText("commandTitle"),
    tricks: careText("tricksTitle"),
  };
  return Object.entries(requirement)
    .map(([key, target]) => `${labels[key] || key} ${Math.min(target, Math.round(progress[key] || 0))}/${target}`)
    .join(" · ");
}

function evolutionRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function evolutionClaimLine(character, form, reward) {
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(form.labelKey)} 보상 받았어. ${evolutionRewardText(reward)}`;
  }
  return `${localStyleFor(character.id)} Claimed ${careText(form.labelKey)}. ${evolutionRewardText(reward)}`;
}

function dailyStreakValue(game) {
  return dailyStreakFor(game).best;
}

function canClaimDailyStreak(game, today = currentDayKey()) {
  return dailyStreakFor(game).claimedDayKey !== today;
}

function dailyStreakReward(game) {
  const streak = dailyStreakFor(game);
  const chain = Math.round(clamp(streak.current || 1, 1, 7));
  return {
    coins: 8 + chain * 4,
    xp: 4 + chain * 2,
    happiness: 2 + Math.floor(chain / 2),
    bond: chain >= 5 ? 1 : 0,
  };
}

function dailyStreakRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function leagueSeasonFor(game) {
  return normalizeLeagueSeason(game?.leagueSeason);
}

function claimedLeagueSeasonTierCount(game) {
  return leagueSeasonFor(game).claimedTiers.length;
}

function leagueSeasonPointGain(score, tier) {
  const bonus = tier?.id === "master" ? 72 : tier?.id === "gold" ? 48 : tier?.id === "silver" ? 30 : 18;
  return Math.round(clamp(Math.floor(score * 0.58) + bonus, 20, 240));
}

function addLeagueSeasonPoints(game, score, tier) {
  const season = leagueSeasonFor(game);
  const gain = leagueSeasonPointGain(score, tier);
  season.points = Math.round(clamp(season.points + gain, 0, 999999));
  season.bestPoints = Math.max(season.bestPoints, season.points);
  game.leagueSeason = normalizeLeagueSeason(season);
  return gain;
}

function leagueSeasonRewardText(reward) {
  return packRewardText(reward);
}

function leagueSeasonClaimLine(character, tier, reward) {
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(tier.labelKey)} 받았어. ${leagueSeasonRewardText(reward)}`;
  }
  return `${localStyleFor(character.id)} Claimed ${careText(tier.labelKey)}. ${leagueSeasonRewardText(reward)}`;
}

function medalRequirementProgress(care, game, medal) {
  const safeCare = care || normalizeCare(null);
  const season = leagueSeasonFor(game);
  const requirement = medal?.requirement || {};
  return {
    seasonPoints: Math.max(season.points || 0, season.bestPoints || 0),
    claimedSeasonTiers: claimedLeagueSeasonTierCount(game),
    contestBest: requirement.contestBest ? contestBestScore(safeCare, requirement.contestBest) : 0,
  };
}

function medalUnlocked(care, game, medal) {
  const requirement = medal?.requirement || {};
  const progress = medalRequirementProgress(care, game, medal);
  if (Number.isFinite(requirement.seasonPoints) && progress.seasonPoints < requirement.seasonPoints) return false;
  if (Number.isFinite(requirement.claimedSeasonTiers) && progress.claimedSeasonTiers < requirement.claimedSeasonTiers) return false;
  if (requirement.contestBest && progress.contestBest < Math.round(clamp(requirement.score || 0, 0, 9999))) return false;
  return true;
}

function medalRequirementText(care, game, medal) {
  const requirement = medal?.requirement || {};
  const progress = medalRequirementProgress(care, game, medal);
  if (Number.isFinite(requirement.seasonPoints)) {
    return `${careText("medalRequirement")} ${careText("leagueSeasonPoints")} ${Math.min(progress.seasonPoints, requirement.seasonPoints)}/${requirement.seasonPoints}`;
  }
  if (Number.isFinite(requirement.claimedSeasonTiers)) {
    return `${careText("medalRequirement")} ${careText("leagueSeasonClaimed")} ${Math.min(progress.claimedSeasonTiers, requirement.claimedSeasonTiers)}/${requirement.claimedSeasonTiers}`;
  }
  if (requirement.contestBest) {
    const contest = PET_CONTESTS[requirement.contestBest];
    const target = Math.round(clamp(requirement.score || 0, 0, 9999));
    return `${careText("medalRequirement")} ${careText(contest?.labelKey || "contestBest")} ${Math.min(progress.contestBest, target)}/${target}`;
  }
  return careText("medalLocked");
}

function unlockedMedalCount(care, game) {
  return LEAGUE_MEDAL_IDS.filter((id) => medalUnlocked(care, game, LEAGUE_MEDALS[id])).length;
}

function medalForCare(care, game = settings?.game || null) {
  const medalId = LEAGUE_MEDAL_IDS.includes(care?.equippedMedal) ? care.equippedMedal : "";
  const medal = LEAGUE_MEDALS[medalId] || null;
  return medal && medalUnlocked(care, game, medal) ? { id: medalId, ...medal } : null;
}

function equipLeagueMedal(pet, medalId) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return;
  const game = ensureGame();
  const care = careForPet(pet);
  const targetId = LEAGUE_MEDAL_IDS.includes(medalId) ? medalId : "";
  if (targetId && !medalUnlocked(care, game, LEAGUE_MEDALS[targetId])) {
    showPetThought(pet, medalRequirementText(care, game, LEAGUE_MEDALS[targetId]), { durationMs: 3200 });
    return;
  }
  care.equippedMedal = targetId;
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  const medal = targetId ? LEAGUE_MEDALS[targetId] : null;
  const line = targetId
    ? `${careText(medal.labelKey)} · ${careText("medalEquipped")}`
    : careText("medalNone");
  showPetThought(pet, line, { durationMs: 2600 });
  api.updateSettings({ slots: settings.slots, game }).then((next) => {
    settings = normalizeSettings(next);
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet);
  });
}

function medalTrialCount(care, medalId = "") {
  if (!medalId) return Math.round(clamp(Number(care?.actionCounts?.medalTrial) || 0, 0, 999999));
  return Math.round(clamp(Number(care?.actionCounts?.[`medalTrial:${medalId}`]) || 0, 0, 999999));
}

function totalMedalTrials(care) {
  return medalTrialCount(care);
}

function medalPerkText(medal) {
  if (!medal) return careText("medalTrialNeedMedal");
  const parts = [];
  const speed = finiteNumber(medal.perk?.speed, 1);
  const reward = finiteNumber(medal.perk?.reward, 1);
  if (Math.abs(speed - 1) >= 0.01) {
    const value = Math.round((speed - 1) * 100);
    parts.push(`${value > 0 ? "+" : ""}${value}% ${careText("roam")}`);
  }
  if (Math.abs(reward - 1) >= 0.01) {
    const value = Math.round((reward - 1) * 100);
    parts.push(`${value > 0 ? "+" : ""}${value}% ${careText("medalTrialReward")}`);
  }
  return parts.join(" · ") || careText("medalTrialReady");
}

function medalTrialReward(care, medal) {
  const base = medal?.trial?.reward || {};
  const boost = finiteNumber(medal?.perk?.reward, 1);
  const levelBonus = Math.floor((care?.level || 1) / 4);
  const trainingBonus = Math.floor((care?.training || 0) / 42);
  const reward = {};
  for (const [key, value] of Object.entries(base)) {
    if (!Number.isFinite(value)) continue;
    const bonus = key === "coins" || key === "xp" ? levelBonus : trainingBonus;
    reward[key] = Math.round(clamp((value + bonus) * boost, -99, 999));
  }
  return reward;
}

function medalTrialRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`+${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function medalTrialLine(character, medal, reward, completedQuests, leveled) {
  const quest = questRewardLine(completedQuests);
  const levelText = leveled ? (currentLanguage() === "ko" ? " 레벨업!" : " Level up!") : "";
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(medal.labelKey)} ${careText("medalTrialDone")}. ${medalTrialRewardText(reward)}.${levelText}${quest}`;
  }
  return `${localStyleFor(character.id)} ${careText(medal.labelKey)} ${careText("medalTrialDone")}. ${medalTrialRewardText(reward)}.${levelText}${quest}`;
}

function petWalkCount(care, walkId = "") {
  if (!walkId) return Math.round(clamp(Number(care?.actionCounts?.petWalk) || 0, 0, 999999));
  return Math.round(clamp(Number(care?.actionCounts?.[`petWalk:${walkId}`]) || 0, 0, 999999));
}

function totalPetWalks(care) {
  return petWalkCount(care);
}

function isAnimalPet(pet) {
  return characterFor(pet?.characterId).type === "animal";
}

function petWalkFavoriteSnackBonus(pet, care, game) {
  const favorites = favoriteSnacksForPet(pet);
  const owned = favorites.filter((snackId) => snackOwnedCount(game, snackId) > 0).length;
  const served = favorites.reduce((sum, snackId) => sum + snackUseCount(care, snackId), 0);
  return {
    owned,
    served: Math.round(clamp(served, 0, 999999)),
    bonus: Math.round(clamp(owned * 2 + Math.min(6, served), 0, 12)),
  };
}

function petWalkReady(pet, walk, care = careForPet(pet)) {
  if ((care?.level || 1) < walk.minLevel) return { ok: false, reason: "level", care };
  if ((care?.energy || 0) < walk.energyCost) return { ok: false, reason: "energy", care };
  return { ok: true, reason: "", care };
}

function petWalkReward(pet, walk, care, game) {
  const reward = { ...(walk.reward || {}) };
  const animal = isAnimalPet(pet);
  const comfortBonus = Math.floor(habitatComfortScore(game) * finiteNumber(walk.habitatScale, 0));
  const snack = petWalkFavoriteSnackBonus(pet, care, game);
  const timeId = currentTimeBandId();
  const seasonId = currentSeasonId();
  const isSeasonBoost = Array.isArray(walk.seasonBoost) && walk.seasonBoost.includes(seasonId);
  const isTimeBoost = Array.isArray(walk.timeBoost) && walk.timeBoost.includes(timeId);
  if (animal) {
    reward.xp = (reward.xp || 0) + 2;
    reward.happiness = (reward.happiness || 0) + 3;
    reward.bond = (reward.bond || 0) + 2;
  }
  if (comfortBonus > 0) {
    reward.happiness = (reward.happiness || 0) + Math.min(8, comfortBonus);
    reward.hygiene = (reward.hygiene || 0) + Math.min(4, Math.floor(comfortBonus / 2));
  }
  if (walk.trainingScale) reward.training = (reward.training || 0) + Math.floor((care.training || 0) * walk.trainingScale);
  if (walk.snackScale) {
    reward.hunger = (reward.hunger || 0) + Math.round(snack.bonus * walk.snackScale);
    reward.happiness = (reward.happiness || 0) + Math.floor(snack.bonus / 2);
  }
  if (isSeasonBoost) reward.happiness = (reward.happiness || 0) + 3;
  if (isTimeBoost) {
    reward.energy = (reward.energy || 0) + 4;
    reward.bond = (reward.bond || 0) + 1;
  }
  const normalized = {};
  for (const [key, value] of Object.entries(reward)) {
    if (!Number.isFinite(value)) continue;
    normalized[key] = Math.round(clamp(value, -99, 999));
  }
  return normalized;
}

function petWalkRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`+${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function petWalkBonusText(pet, care, game, walk) {
  const parts = [];
  if (isAnimalPet(pet)) parts.push(careText("walkAnimalBonus"));
  const snack = petWalkFavoriteSnackBonus(pet, care, game);
  if (snack.bonus > 0) parts.push(`${careText("walkSnackBonus")} +${snack.bonus}`);
  if (walk?.seasonBoost?.includes(currentSeasonId())) parts.push(careText(SEASONS[currentSeasonId()]?.labelKey || "seasonSpring"));
  if (walk?.timeBoost?.includes(currentTimeBandId())) parts.push(careText(TIME_BANDS[currentTimeBandId()]?.labelKey || "timeAfternoon"));
  return parts.join(" · ") || careText("walkReady");
}

function petWalkLine(character, walk, reward, completedQuests, leveled) {
  const quest = questRewardLine(completedQuests);
  const levelText = leveled ? (currentLanguage() === "ko" ? " 레벨업!" : " Level up!") : "";
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(walk.labelKey)} 산책 완료. ${petWalkRewardText(reward)}.${levelText}${quest}`;
  }
  return `${localStyleFor(character.id)} finished ${careText(walk.labelKey)}. ${petWalkRewardText(reward)}.${levelText}${quest}`;
}

function trainingYardCount(care, courseId = "") {
  if (!courseId) return Math.round(clamp(Number(care?.actionCounts?.trainingYard) || 0, 0, 999999));
  return Math.round(clamp(Number(care?.actionCounts?.[`trainingYard:${courseId}`]) || 0, 0, 999999));
}

function totalTrainingYardRuns(care) {
  return trainingYardCount(care);
}

function trainingYardReady(pet, course, care = careForPet(pet)) {
  if ((care?.level || 1) < course.minLevel) return { ok: false, reason: "level", care };
  if ((care?.energy || 0) < course.energyCost) return { ok: false, reason: "energy", care };
  return { ok: true, reason: "", care };
}

function trainingYardReward(pet, course, care, game) {
  const medal = medalForCare(care, game);
  const toy = toyForCare(care);
  const toyMastery = toy ? toyPlayMasteryLevel(care, care.equippedToy) : 0;
  const walkBonus = Math.min(10, Math.floor(totalPetWalks(care) * finiteNumber(course.walkScale, 0)));
  const trainingBonus = Math.min(8, Math.floor((care?.training || 0) * finiteNumber(course.trainingScale, 0)));
  const extras = {};
  if (course.animalBoost && isAnimalPet(pet)) {
    extras.xp = (extras.xp || 0) + 3;
    extras.happiness = (extras.happiness || 0) + 1;
    extras.training = (extras.training || 0) + 2;
    extras.bond = (extras.bond || 0) + 2;
  }
  if (walkBonus > 0) {
    extras.xp = (extras.xp || 0) + walkBonus;
    extras.training = (extras.training || 0) + Math.ceil(walkBonus / 2);
  }
  if (trainingBonus > 0) {
    extras.coins = (extras.coins || 0) + Math.floor(trainingBonus / 2);
    extras.training = (extras.training || 0) + trainingBonus;
  }
  if (course.medalBoost && medal) {
    extras.coins = (extras.coins || 0) + 1;
    extras.xp = (extras.xp || 0) + 2;
    extras.happiness = (extras.happiness || 0) + 1;
    extras.training = (extras.training || 0) + 2;
  }
  if (toy) {
    extras.happiness = (extras.happiness || 0) + 1 + Math.min(2, toyMastery);
    extras.training = (extras.training || 0) + Math.min(4, Math.round((toy.training || 0) * 0.2) + toyMastery);
  }
  const reward = mergeRewards(course.reward, extras);
  const normalized = {};
  for (const [key, value] of Object.entries(reward)) {
    if (!Number.isFinite(value)) continue;
    normalized[key] = Math.round(clamp(value, -99, 999));
  }
  return normalized;
}

function trainingYardRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`+${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function trainingYardBonusText(pet, care, game, course) {
  const parts = [];
  const walkBonus = Math.min(10, Math.floor(totalPetWalks(care) * finiteNumber(course.walkScale, 0)));
  if (course.animalBoost && isAnimalPet(pet)) parts.push(careText("yardAnimalBonus"));
  if (walkBonus > 0) parts.push(`${careText("yardWalkBonus")} +${walkBonus}`);
  if (course.medalBoost && medalForCare(care, game)) parts.push(careText("yardMedalBonus"));
  if (toyForCare(care)) parts.push(careText("yardToyBonus"));
  return parts.join(" · ") || careText("yardReady");
}

function trainingYardLine(character, course, reward, completedQuests, leveled) {
  const quest = questRewardLine(completedQuests);
  const levelText = leveled ? (currentLanguage() === "ko" ? " 레벨업!" : " Level up!") : "";
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(course.labelKey)} 훈련 완료. ${trainingYardRewardText(reward)}.${levelText}${quest}`;
  }
  return `${localStyleFor(character.id)} cleared ${careText(course.labelKey)}. ${trainingYardRewardText(reward)}.${levelText}${quest}`;
}

function patrolCount(care, routeId = "") {
  if (!routeId) return Math.round(clamp(Number(care?.actionCounts?.patrol) || 0, 0, 999999));
  return Math.round(clamp(Number(care?.actionCounts?.[`patrol:${routeId}`]) || 0, 0, 999999));
}

function totalPatrolRuns(care) {
  return patrolCount(care);
}

function patrolReady(pet, route, care = careForPet(pet)) {
  if ((care?.level || 1) < route.minLevel) return { ok: false, reason: "level", care };
  if ((care?.energy || 0) < route.energyCost) return { ok: false, reason: "energy", care };
  return { ok: true, reason: "", care };
}

function patrolDiscoveryChance(route, care, game) {
  const base = finiteNumber(route?.collectionChance, 0);
  const collectionBonus = route?.discoveryBoost ? Math.min(0.12, collectionUniqueCount(game) * 0.01) : 0;
  const trainingBonus = Math.min(0.08, (care?.training || 0) / 1200);
  return clamp(base + collectionBonus + trainingBonus, 0, 0.72);
}

function patrolReward(pet, route, care, game) {
  const animal = isAnimalPet(pet);
  const walkBonus = Math.min(10, Math.floor(totalPetWalks(care) * finiteNumber(route.walkScale, 0)));
  const comfortBonus = Math.min(8, Math.floor(habitatComfortScore(game) * finiteNumber(route.comfortScale, 0)));
  const reward = mergeRewards(route.reward, {
    xp: animal && route.animalBoost ? 2 : 0,
    happiness: (animal && route.animalBoost ? 2 : 0) + comfortBonus,
    hygiene: route.animalBoost ? 1 : 0,
    training: Math.ceil(walkBonus / 2),
    bond: animal && route.animalBoost ? 1 : 0,
    coins: route.discoveryBoost ? Math.floor(collectionUniqueCount(game) / 4) : 0,
  });
  const normalized = {};
  for (const [key, value] of Object.entries(reward)) {
    if (!Number.isFinite(value)) continue;
    normalized[key] = Math.round(clamp(value, -99, 999));
  }
  return normalized;
}

function patrolRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`+${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function patrolBonusText(pet, care, game, route) {
  const parts = [];
  const walkBonus = Math.min(10, Math.floor(totalPetWalks(care) * finiteNumber(route.walkScale, 0)));
  const comfortBonus = Math.min(8, Math.floor(habitatComfortScore(game) * finiteNumber(route.comfortScale, 0)));
  const discoveryChance = Math.round(patrolDiscoveryChance(route, care, game) * 100);
  if (route.animalBoost && isAnimalPet(pet)) parts.push(careText("patrolAnimalBonus"));
  if (walkBonus > 0) parts.push(`${careText("patrolWalkBonus")} +${walkBonus}`);
  if (discoveryChance > 0) parts.push(`${careText("patrolDiscoveryBonus")} ${discoveryChance}%`);
  if (comfortBonus > 0) parts.push(`${careText("patrolComfortBonus")} +${comfortBonus}`);
  return parts.join(" · ") || careText("patrolReady");
}

function patrolDiscoveryLine(foundItem, firstFound) {
  if (!foundItem) return "";
  const name = discoveryLabel(foundItem);
  if (currentLanguage() === "ko") return firstFound ? ` 새 도감: ${name}.` : ` 발견: ${name}.`;
  return firstFound ? ` New collection: ${name}.` : ` Found ${name}.`;
}

function patrolLine(pet, route, care, reward, completedQuests, leveled, foundItem = null, firstFound = false) {
  const character = characterFor(pet.characterId);
  const toy = toyForCare(care);
  const rewardText = `${patrolRewardText(reward)}${patrolDiscoveryLine(foundItem, firstFound)}${leveled ? (currentLanguage() === "ko" ? " 레벨업!" : " Level up!") : ""}${questRewardLine(completedQuests)}`;
  return buildPatrolDetail({
    language: currentLanguage(),
    characterName: character.name,
    routeName: careText(route.labelKey),
    mood: careText(careMood(care)),
    stage: careText(careStage(care)),
    toyName: toy ? careText(toy.labelKey) : "",
    rewardText,
    seed: [pet.characterId, route.id, care.level, totalPatrolRuns(care), care.equippedToy, foundItem?.id || "", Math.floor(performance.now() / 7000)].join(":"),
  });
}

function performMedalTrial(pet) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const medal = medalForCare(care, game);
  const character = characterFor(pet.characterId);
  if (!medal) {
    showPetThought(pet, careText("medalTrialNeedMedal"), { durationMs: 3200 });
    return;
  }
  const energyCost = Math.round(clamp(medal.trial?.energyCost || 6, 1, 24));
  if (care.energy < energyCost) {
    showPetThought(pet, `${careText("medalTrialTired")} · ${care.energy}/${energyCost}`, { durationMs: 3200 });
    spawnMedalTrialBurst(pet, medal, true);
    return;
  }

  const reward = medalTrialReward(care, medal);
  let leveled = false;
  care.energy = Math.round(clamp(care.energy - energyCost + (reward.energy || 0), 0, 100));
  care.happiness = Math.round(clamp(care.happiness + (reward.happiness || 0), 0, 100));
  care.hygiene = Math.round(clamp(care.hygiene + (reward.hygiene || 0), 0, 100));
  care.training = Math.round(clamp(care.training + (reward.training || 0), 0, 100));
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  care.actionCounts.medalTrial = (care.actionCounts.medalTrial || 0) + 1;
  care.actionCounts[`medalTrial:${medal.id}`] = (care.actionCounts[`medalTrial:${medal.id}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  leveled = addCareXp(care, reward.xp || 0) || leveled;
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("medalTrial");
  settings.game = normalizeGame(settings.game);
  const line = medalTrialLine(character, medal, reward, completedQuests, leveled);
  recordMemory(pet, medal.icon, line);
  runMedalTrialMotion(pet, medal);
  spawnMedalTrialBurst(pet, medal);
  showPetThought(pet, line, { durationMs: 5000 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performPetWalk(pet, walkId) {
  const walkDef = PET_WALKS[walkId];
  const walk = walkDef ? { id: walkId, ...walkDef } : null;
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!walk || !slot) return;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  const readiness = petWalkReady(pet, walk, care);
  if (!readiness.ok) {
    const line = readiness.reason === "level"
      ? `${localStyleFor(character.id)} ${careText("walkNeedLevel")} ${walk.minLevel}.`
      : `${localStyleFor(character.id)} ${careText("walkNeedEnergy")} · ${care.energy}/${walk.energyCost}.`;
    showPetThought(pet, line, { durationMs: 3200 });
    spawnPetWalkBurst(pet, walk, true);
    return;
  }

  const reward = petWalkReward(pet, walk, care, game);
  let leveled = false;
  care.energy = Math.round(clamp(care.energy - walk.energyCost + (reward.energy || 0), 0, 100));
  care.hunger = Math.round(clamp(care.hunger + (reward.hunger || 0), 0, 100));
  care.happiness = Math.round(clamp(care.happiness + (reward.happiness || 0), 0, 100));
  care.hygiene = Math.round(clamp(care.hygiene + (reward.hygiene || 0), 0, 100));
  care.training = Math.round(clamp(care.training + (reward.training || 0), 0, 100));
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  care.actionCounts.petWalk = (care.actionCounts.petWalk || 0) + 1;
  care.actionCounts[`petWalk:${walkId}`] = (care.actionCounts[`petWalk:${walkId}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  leveled = addCareXp(care, reward.xp || 0) || leveled;
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("petWalk");
  settings.game = normalizeGame(settings.game);
  const line = petWalkLine(character, walk, reward, completedQuests, leveled);
  recordMemory(pet, walk.icon, line);
  runPetWalkMotion(pet, walk);
  spawnPetWalkBurst(pet, walk);
  showPetThought(pet, line, { durationMs: 5000 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performTrainingYard(pet, courseId) {
  const courseDef = TRAINING_YARD_COURSES[courseId];
  const course = courseDef ? { id: courseId, ...courseDef } : null;
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!course || !slot) return;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  const readiness = trainingYardReady(pet, course, care);
  if (!readiness.ok) {
    const line = readiness.reason === "level"
      ? `${localStyleFor(character.id)} ${careText("yardNeedLevel")} ${course.minLevel}.`
      : `${localStyleFor(character.id)} ${careText("yardNeedEnergy")} · ${care.energy}/${course.energyCost}.`;
    showPetThought(pet, line, { durationMs: 3200 });
    spawnTrainingYardBurst(pet, course, true);
    return;
  }

  const reward = trainingYardReward(pet, course, care, game);
  let leveled = false;
  care.energy = Math.round(clamp(care.energy - course.energyCost + (reward.energy || 0), 0, 100));
  care.hunger = Math.round(clamp(care.hunger + (reward.hunger || 0), 0, 100));
  care.happiness = Math.round(clamp(care.happiness + (reward.happiness || 0), 0, 100));
  care.hygiene = Math.round(clamp(care.hygiene + (reward.hygiene || 0), 0, 100));
  care.training = Math.round(clamp(care.training + (reward.training || 0), 0, 100));
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  care.actionCounts.trainingYard = (care.actionCounts.trainingYard || 0) + 1;
  care.actionCounts[`trainingYard:${courseId}`] = (care.actionCounts[`trainingYard:${courseId}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  leveled = addCareXp(care, reward.xp || 0) || leveled;
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("trainingYard");
  settings.game = normalizeGame(settings.game);
  const line = trainingYardLine(character, course, reward, completedQuests, leveled);
  recordMemory(pet, course.icon, line);
  runTrainingYardMotion(pet, course);
  spawnTrainingYardBurst(pet, course);
  showPetThought(pet, line, { durationMs: 5000 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performPatrolRoute(pet, routeId) {
  const routeDef = PATROL_ROUTES[routeId];
  const route = routeDef ? { id: routeId, ...routeDef } : null;
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!route || !slot) return;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  const readiness = patrolReady(pet, route, care);
  if (!readiness.ok) {
    const line = readiness.reason === "level"
      ? `${localStyleFor(character.id)} ${careText("patrolNeedLevel")} ${route.minLevel}.`
      : `${localStyleFor(character.id)} ${careText("patrolNeedEnergy")} · ${care.energy}/${route.energyCost}.`;
    showPetThought(pet, line, { durationMs: 3200 });
    spawnPatrolBurst(pet, route, true);
    return;
  }

  const reward = patrolReward(pet, route, care, game);
  let foundItem = null;
  let firstFound = false;
  let leveled = false;
  let completedDiscoveryQuests = [];
  care.energy = Math.round(clamp(care.energy - route.energyCost + (reward.energy || 0), 0, 100));
  care.hunger = Math.round(clamp(care.hunger + (reward.hunger || 0), 0, 100));
  care.happiness = Math.round(clamp(care.happiness + (reward.happiness || 0), 0, 100));
  care.hygiene = Math.round(clamp(care.hygiene + (reward.hygiene || 0), 0, 100));
  care.training = Math.round(clamp(care.training + (reward.training || 0), 0, 100));
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  care.actionCounts.patrol = (care.actionCounts.patrol || 0) + 1;
  care.actionCounts[`patrol:${routeId}`] = (care.actionCounts[`patrol:${routeId}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  leveled = addCareXp(care, reward.xp || 0) || leveled;
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));

  if (Math.random() < patrolDiscoveryChance(route, care, game)) {
    const item = pickDiscoveryItem(care);
    const find = addDiscoveryToCollection(game, care, item, (isFirst) => item.reward + (isFirst ? 2 : 0), { min: 1, max: 12 });
    foundItem = item;
    firstFound = find.firstFound;
    game.coins = Math.round(clamp(game.coins + find.reward, 0, 999999));
    if (find.charmBonus?.xp) leveled = addCareXp(care, find.charmBonus.xp) || leveled;
    spawnDiscoveryBurst(pet);
    completedDiscoveryQuests = updateDailyQuests("discover");
  }

  slot.care = normalizeCare(care);
  pet.care = slot.care;
  settings.game = normalizeGame(game);
  const completedQuests = [...completedDiscoveryQuests, ...updateDailyQuests("patrol")];
  settings.game = normalizeGame(settings.game);
  const line = patrolLine(pet, route, slot.care, reward, completedQuests, leveled, foundItem, firstFound);
  recordMemory(pet, route.icon, line);
  runPatrolMotion(pet, route);
  spawnPatrolBurst(pet, route);
  showPetThought(pet, line, { durationMs: 5600 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function dailyStreakLine(character, streak, reward) {
  if (currentLanguage() === "ko") {
    return `${character.name} 출석 ${streak.current}일째! ${dailyStreakRewardText(reward)} 챙겼어.`;
  }
  return `${character.name} checked in for day ${streak.current}! ${dailyStreakRewardText(reward)} collected.`;
}

function formatFocusMinutes(minutes) {
  const value = Math.round(clamp(minutes, 0, 999999));
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatFocusClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function focusReward(minutes, targetMinutes) {
  const completedTarget = minutes >= targetMinutes;
  return {
    coins: Math.round(clamp(4 + minutes * 1.4 + (completedTarget ? 8 : 0), 5, 160)),
    xp: Math.round(clamp(6 + minutes * 2.2 + (completedTarget ? 10 : 0), 6, 240)),
    happiness: Math.round(clamp(3 + Math.floor(minutes / 4) + (completedTarget ? 3 : 0), 3, 24)),
    energy: -Math.round(clamp(2 + Math.floor(minutes / 6), 2, 18)),
    training: Math.round(clamp(2 + Math.floor(minutes / 5) + (completedTarget ? 2 : 0), 2, 24)),
    bond: completedTarget ? 2 : 1,
  };
}

function focusRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function focusLine(character, minutes, targetMinutes, reward, completedQuests) {
  const quest = questRewardLine(completedQuests);
  const targetDone = minutes >= targetMinutes;
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${formatFocusMinutes(minutes)} 집중을 지켜냈어${targetDone ? "!" : "."} ${focusRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} Guarded ${formatFocusMinutes(minutes)} of focus${targetDone ? "!" : "."} ${focusRewardText(reward)}${quest}`;
}

function normalizeGame(source) {
  const src = source && typeof source === "object" ? source : {};
  const claimedMilestones = Array.isArray(src.claimedMilestones)
    ? Array.from(new Set(src.claimedMilestones.filter((id) => MILESTONE_IDS.includes(id)))).slice(0, MILESTONE_IDS.length)
    : [];
  const habitatInventory = normalizeHabitatInventory(src.habitatInventory);
  return {
    dayKey: String(src.dayKey || "").trim().slice(0, 16),
    coins: Math.round(clamp(finiteNumber(src.coins, DEFAULT_GAME.coins), 0, 999999)),
    inventory: Array.isArray(src.inventory)
      ? Array.from(new Set(src.inventory.filter((id) => TOY_IDS.includes(id)))).slice(0, TOY_IDS.length)
      : [],
    effectInventory: normalizeEffectInventory(src.effectInventory),
    charmInventory: normalizeCharmInventory(src.charmInventory),
    eggNest: normalizeEggNest(src.eggNest),
    snackInventory: normalizeSnackInventory(src.snackInventory),
    petDex: normalizePetDex(src.petDex),
    moodMoments: normalizeMoodMoments(src.moodMoments),
    collections: normalizeCollections(src.collections),
    dailyQuests: Array.isArray(src.dailyQuests)
      ? src.dailyQuests.map(normalizeQuest).filter(Boolean).slice(0, 5)
      : [],
    streak: normalizeDailyStreak(src.streak),
    leagueSeason: normalizeLeagueSeason(src.leagueSeason),
    focus: normalizeFocus(src.focus),
    claimedMilestones,
    habitatInventory,
    habitatLayout: normalizeHabitatLayout(src.habitatLayout, habitatInventory),
    habitatTheme: normalizeHabitatTheme(src.habitatTheme),
    ambientEvents: normalizeAmbientEvents(src.ambientEvents),
  };
}

function ensureGame() {
  if (!settings) return normalizeGame(null);
  settings.game = normalizeGame(settings.game);
  const today = currentDayKey();
  let changed = false;
  const streakBefore = JSON.stringify(settings.game.streak);
  settings.game.streak = updateDailyStreak(settings.game.streak, today);
  changed = changed || JSON.stringify(settings.game.streak) !== streakBefore;
  if (settings.game.dayKey !== today || settings.game.dailyQuests.length < 3) {
    settings.game.dayKey = today;
    settings.game.dailyQuests = buildDailyQuests(today);
    changed = true;
  }
  changed = updatePetAlbumFromSlots(settings.game) || changed;
  if (changed) saveSettingsSoon(900);
  return settings.game;
}

function updateDailyQuests(actionId) {
  const game = ensureGame();
  const completed = [];
  for (const quest of game.dailyQuests) {
    if (quest.action !== actionId || quest.done) continue;
    quest.progress = Math.min(quest.target, quest.progress + 1);
    if (quest.progress >= quest.target) {
      quest.done = true;
      if (!quest.claimed) {
        quest.claimed = true;
        game.coins = Math.round(clamp(game.coins + quest.reward, 0, 999999));
        completed.push(quest);
      }
    }
  }
  return completed;
}

function questRewardLine(completed) {
  if (!completed.length) return "";
  const reward = completed.reduce((sum, quest) => sum + quest.reward, 0);
  if (currentLanguage() === "ko") return ` 오늘 목표 완료! +${reward} ${careText("coins")}`;
  return ` Daily goal complete! +${reward} ${careText("coins")}`;
}

function toyForCare(care) {
  return TOYS[care?.equippedToy] || null;
}

function toyPlayCount(care, toyId = care?.equippedToy) {
  if (!toyId) return 0;
  return Math.round(clamp(Number(care?.actionCounts?.[`toyPlay:${toyId}`]) || 0, 0, 999999));
}

function totalToyPlay(care) {
  return Math.round(clamp(Number(care?.actionCounts?.toyPlay) || 0, 0, 999999));
}

function toyPlayMasteryLevel(care, toyId = care?.equippedToy) {
  const count = toyPlayCount(care, toyId);
  return TOY_PLAY_MASTERY_THRESHOLDS.reduce((level, target) => (count >= target ? level + 1 : level), 0);
}

function toyPlayNextTarget(care, toyId = care?.equippedToy) {
  const count = toyPlayCount(care, toyId);
  return TOY_PLAY_MASTERY_THRESHOLDS.find((target) => count < target) || TOY_PLAY_MASTERY_THRESHOLDS[TOY_PLAY_MASTERY_THRESHOLDS.length - 1];
}

function toyPlayReward(toy, masteryLevel = 0) {
  return {
    coins: 3 + masteryLevel,
    xp: 5 + masteryLevel * 2,
    happiness: Math.round(clamp(4 + (toy?.happiness || 0) * 0.45 + masteryLevel, 3, 18)),
    energy: toy?.labelKey === "toyStarBlanket" ? 8 + masteryLevel : toy?.labelKey === "toyRocketSnack" ? 2 : -6,
    hygiene: Math.round(clamp((toy?.hygiene || 0) * 0.45, 0, 12)),
    training: Math.round(clamp((toy?.training || 0) * 0.55 + masteryLevel, 0, 14)),
    bond: masteryLevel >= 2 ? 2 : 1,
  };
}

function toyPlayRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function toyPlayLine(character, toy, reward, masteryLevel) {
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(toy.labelKey)}로 놀았어. ${careText("toyPlayMastery")} ${masteryLevel}/${TOY_PLAY_MASTERY_THRESHOLDS.length}. ${toyPlayRewardText(reward)}`;
  }
  return `${localStyleFor(character.id)} Played with ${careText(toy.labelKey)}. ${careText("toyPlayMastery")} ${masteryLevel}/${TOY_PLAY_MASTERY_THRESHOLDS.length}. ${toyPlayRewardText(reward)}`;
}

function effectForCare(care, pet = null) {
  const effectId = EFFECT_IDS.includes(care?.equippedEffect)
    ? care.equippedEffect
    : EFFECT_IDS.includes(pet?.behavior?.effectMode)
      ? pet.behavior.effectMode
      : DEFAULT_CARE.equippedEffect;
  return TRAIL_STYLES[effectId] || TRAIL_STYLES[DEFAULT_CARE.equippedEffect];
}

function effectOwnedCount(game) {
  return normalizeEffectInventory(game?.effectInventory).length;
}

function eggNestFor(game) {
  return normalizeEggNest(game?.eggNest);
}

function eggHatchCount(game) {
  return eggNestFor(game).hatchedCount;
}

function eggCareCount(care) {
  return Math.round(clamp(Number(care?.actionCounts?.eggCare) || 0, 0, 999999));
}

function firstDisabledSlotIndex() {
  if (!Array.isArray(settings?.slots)) return -1;
  return settings.slots.findIndex((slot) => slot && slot.enabled !== true);
}

function nextHatchCharacterId() {
  const used = new Set((settings?.slots || []).filter((slot) => slot?.enabled).map((slot) => slot.character));
  return EGG_HATCH_POOL.find((id) => !used.has(id)) || EGG_HATCH_POOL[eggHatchCount(ensureGame()) % EGG_HATCH_POOL.length];
}

function nurseryStatusText(game) {
  const slotIndex = firstDisabledSlotIndex();
  const nextCharacter = characterFor(nextHatchCharacterId());
  const slotText = slotIndex >= 0 ? `${careText("nurseryEmptySlot")} #${slotIndex + 1}` : careText("nurseryFull");
  return `${careText("nurseryNext")} ${nextCharacter.name} · ${slotText}`;
}

function nurseryRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function nurseryHatchLine(character, hatchedId, reward, completedQuests, addedSlot = true) {
  const hatched = characterFor(hatchedId);
  const quest = questRewardLine(completedQuests);
  if (!addedSlot) {
    if (currentLanguage() === "ko") {
      return `${localStyleFor(character.id)} 알이 부화했지만 슬롯이 가득 차서 ${careText("nurseryBonus")}로 바뀌었어. ${nurseryRewardText(reward)}${quest}`;
    }
    return `${localStyleFor(character.id)} The egg hatched, but slots are full, so it became a ${careText("nurseryBonus")}. ${nurseryRewardText(reward)}${quest}`;
  }
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} 알이 부화했어! 새 친구 ${hatched.name}. ${careText("nurseryReward")} ${nurseryRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} The egg hatched! New friend ${hatched.name}. ${careText("nurseryReward")} ${nurseryRewardText(reward)}${quest}`;
}

function nurseryWarmLine(character, progress, gain, reward, completedQuests) {
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} 알을 따뜻하게 했어. +${gain}% · ${careText("nurseryProgress")} ${progress}/100. ${nurseryRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} Warmed the egg. +${gain}% · ${careText("nurseryProgress")} ${progress}/100. ${nurseryRewardText(reward)}${quest}`;
}

function snackInventoryFor(game) {
  return normalizeSnackInventory(game?.snackInventory);
}

function snackOwnedCount(game, snackId = "") {
  const inventory = snackInventoryFor(game);
  if (snackId) return Math.round(clamp(Number(inventory[snackId]) || 0, 0, 99));
  return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

function snackUseCount(care, snackId = "") {
  const key = snackId ? `snack:${snackId}` : "snackUse";
  return Math.round(clamp(Number(care?.actionCounts?.[key]) || 0, 0, 999999));
}

function totalFavoriteSnacks(care) {
  return Object.entries(care?.actionCounts || {}).reduce(
    (sum, [key, value]) =>
      String(key).startsWith("snackFavorite:") ? sum + Math.round(clamp(Number(value) || 0, 0, 999999)) : sum,
    0,
  );
}

function favoriteSnacksForPet(pet) {
  const key = FAVORITE_SNACKS[pet?.characterId] ? pet.characterId : customCharacterFor(pet?.characterId) ? "custom" : "star";
  return FAVORITE_SNACKS[key] || FAVORITE_SNACKS.star;
}

function snackIsFavorite(pet, snackId) {
  return favoriteSnacksForPet(pet).includes(snackId);
}

function snackReward(snack, favorite = false) {
  return {
    xp: 6 + (favorite ? 4 : 0),
    hunger: Math.round(clamp((snack?.hunger || 0) + (favorite ? 4 : 0), 0, 30)),
    happiness: Math.round(clamp((snack?.happiness || 0) + (favorite ? 5 : 0), 0, 30)),
    energy: Math.round(clamp(snack?.energy || 0, 0, 25)),
    hygiene: Math.round(clamp(snack?.hygiene || 0, 0, 25)),
    training: Math.round(clamp((snack?.training || 0) + (favorite ? 2 : 0), 0, 25)),
    bond: Math.round(clamp((snack?.bond || 0) + (favorite ? 2 : 1), 0, 8)),
  };
}

function snackRewardText(reward) {
  const parts = [];
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`+${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  return parts.join(" · ");
}

function snackServeLine(character, snack, reward, favorite, completedQuests) {
  const quest = questRewardLine(completedQuests);
  const tag = favorite ? careText("snackFavorite") : careText("snackGood");
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(snack.labelKey)} 간식 먹었어. ${tag}! ${snackRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} Served ${careText(snack.labelKey)}. ${tag}! ${snackRewardText(reward)}${quest}`;
}

function snackBuyLine(character, snack, owned) {
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(snack.labelKey)} 구매했어. ${careText("snackOwned")} ${owned}`;
  }
  return `${localStyleFor(character.id)} Bought ${careText(snack.labelKey)}. ${careText("snackOwned")} ${owned}`;
}

function petAlbumFor(game) {
  return normalizePetDex(game?.petDex);
}

function petAlbumSeenCount(game) {
  return Object.keys(petAlbumFor(game)).length;
}

function recordPetAlbumEntry(game, characterId, options = {}) {
  if (!game || !PET_ALBUM_IDS.includes(characterId)) return false;
  const before = JSON.stringify(normalizePetDex(game.petDex));
  const dex = normalizePetDex(game.petDex);
  const current = dex[characterId] || { seen: true, firstSeenDayKey: currentDayKey(), bestLevel: 0, hatchCount: 0 };
  current.seen = true;
  current.firstSeenDayKey = current.firstSeenDayKey || currentDayKey();
  if (Number.isFinite(options.bestLevel)) {
    current.bestLevel = Math.max(current.bestLevel || 0, Math.round(clamp(options.bestLevel, 0, 99)));
  }
  if (Number.isFinite(options.hatchDelta)) {
    current.hatchCount = Math.round(clamp((current.hatchCount || 0) + options.hatchDelta, 0, 9999));
  }
  dex[characterId] = current;
  game.petDex = normalizePetDex(dex);
  return JSON.stringify(game.petDex) !== before;
}

function updatePetAlbumFromSlots(game) {
  if (!game || !Array.isArray(settings?.slots)) return false;
  let changed = false;
  for (const slot of settings.slots) {
    const characterId = PET_ALBUM_IDS.includes(slot?.character) ? slot.character : "";
    if (!characterId) continue;
    const care = normalizeCare(slot.care);
    const hasProgress = slot.enabled === true || care.level > 1 || totalCareActions(care) > 0;
    if (!hasProgress) continue;
    changed = recordPetAlbumEntry(game, characterId, { bestLevel: care.level }) || changed;
  }
  const nest = eggNestFor(game);
  if (nest.lastHatched) changed = recordPetAlbumEntry(game, nest.lastHatched, { bestLevel: 1 }) || changed;
  return changed;
}

function effectRewardText(effect) {
  const parts = [];
  if (effect.happiness) parts.push(`+${effect.happiness} ${careText("happiness")}`);
  if (effect.energy) parts.push(`+${effect.energy} ${careText("energy")}`);
  if (effect.training) parts.push(`+${effect.training} ${careText("training")}`);
  if (effect.bond) parts.push(`+${effect.bond} ${careText("bond")}`);
  return parts.join(" · ") || careText("effectReward");
}

function effectEquipLine(character, effect, ownedBefore, completedQuests) {
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return ownedBefore
      ? `${localStyleFor(character.id)} ${careText(effect.labelKey)} 장착했어. ${effectRewardText(effect)}${quest}`
      : `${localStyleFor(character.id)} ${careText(effect.labelKey)} 구매 완료! 이제 잔상이 바뀌어. ${effectRewardText(effect)}${quest}`;
  }
  return ownedBefore
    ? `${localStyleFor(character.id)} Equipped ${careText(effect.labelKey)}. ${effectRewardText(effect)}${quest}`
    : `${localStyleFor(character.id)} Bought ${careText(effect.labelKey)}. Trail style updated. ${effectRewardText(effect)}${quest}`;
}

function totalCareActions(care) {
  const counts = care?.actionCounts && typeof care.actionCounts === "object" ? care.actionCounts : {};
  return Object.entries(counts).reduce((sum, [key, value]) => {
    if (String(key).startsWith("miniBest:")) return sum;
    return sum + Math.round(clamp(Number(value) || 0, 0, 999999));
  }, 0);
}

function moodPatternProgress(care, pattern) {
  const counts = care?.actionCounts && typeof care.actionCounts === "object" ? care.actionCounts : {};
  const value = Object.entries(pattern?.sources || {}).reduce((sum, [key, weight]) => {
    return sum + (Number(counts[key]) || 0) * finiteNumber(weight, 1);
  }, 0);
  const target = Math.max(1, Math.round(pattern?.target || 1));
  return {
    value: Math.round(clamp(value, 0, 999999)),
    target,
    done: value >= target,
    percent: clamp((value / target) * 100, 0, 100),
  };
}

function moodPatternUnlocked(care, pattern) {
  return moodPatternProgress(care, pattern).done;
}

function activeMoodPatterns(care = null) {
  return MOOD_PATTERN_IDS
    .map((id) => ({ id, ...MOOD_PATTERNS[id] }))
    .filter((pattern) => moodPatternUnlocked(care, pattern));
}

function totalMoodPatterns(care = null) {
  return activeMoodPatterns(care).length;
}

function moodPatternEffects(care = null) {
  const effects = { speed: 1, xp: 1, care: {} };
  for (const pattern of activeMoodPatterns(care)) {
    const effect = pattern.effect || {};
    if (Number.isFinite(effect.speed)) effects.speed *= effect.speed;
    if (Number.isFinite(effect.xp)) effects.xp *= effect.xp;
    for (const [actionId, bonus] of Object.entries(effect.care || {})) {
      effects.care[actionId] = effects.care[actionId] || {};
      for (const [key, value] of Object.entries(bonus || {})) {
        if (!Number.isFinite(value)) continue;
        effects.care[actionId][key] = (effects.care[actionId][key] || 0) + value;
      }
    }
  }
  effects.speed = clamp(effects.speed, 0.94, 1.1);
  effects.xp = clamp(effects.xp, 1, 1.12);
  return effects;
}

function moodPatternEffectText(pattern) {
  const effect = pattern?.effect || {};
  const parts = [];
  if (Number.isFinite(effect.speed)) {
    const percent = Math.round((effect.speed - 1) * 100);
    if (percent) parts.push(`${percent > 0 ? "+" : ""}${percent}% ${careText("roam")}`);
  }
  if (Number.isFinite(effect.xp)) {
    parts.push(`+${Math.round((effect.xp - 1) * 100)}% ${careText("xp")}`);
  }
  for (const [actionId, bonus] of Object.entries(effect.care || {})) {
    for (const [key, value] of Object.entries(bonus || {})) {
      if (!Number.isFinite(value) || value === 0) continue;
      parts.push(`${careText(actionId)} +${value} ${careText(key)}`);
    }
  }
  return parts.join(" · ") || careText("moodPatternEffect");
}

function moodPatternCareLine(care, actionId) {
  const matching = activeMoodPatterns(care)
    .filter((pattern) => pattern.effect?.care?.[actionId])
    .map((pattern) => careText(pattern.labelKey))
    .slice(0, 2);
  if (!matching.length) return "";
  return currentLanguage() === "ko"
    ? ` ${careText("moodPatternsTitle")} ${matching.join(" · ")} 보너스.`
    : ` ${careText("moodPatternsTitle")} bonus: ${matching.join(" · ")}.`;
}

function allDailyQuestsDone(game) {
  return Array.isArray(game?.dailyQuests) && game.dailyQuests.length > 0 && game.dailyQuests.every((quest) => quest.done);
}

function completedDailyQuestCount(game) {
  return Array.isArray(game?.dailyQuests) ? game.dailyQuests.filter((quest) => quest.done).length : 0;
}

function discoveryLabel(item) {
  const language = currentLanguage();
  return item?.label?.[language] || item?.label?.en || "";
}

function rarityText(rarity) {
  if (rarity === "epic") return careText("rarityEpic");
  if (rarity === "rare") return careText("rarityRare");
  return careText("rarityCommon");
}

function collectionUniqueCount(game) {
  return Object.values(normalizeCollections(game?.collections)).filter((count) => count > 0).length;
}

function collectionTotalCount(game) {
  return Object.values(normalizeCollections(game?.collections)).reduce((sum, count) => sum + count, 0);
}

function charmInventoryFor(game) {
  return normalizeCharmInventory(game?.charmInventory);
}

function charmForCare(care) {
  return CHARMS[care?.equippedCharm] || null;
}

function charmOwned(game, charmId) {
  return charmInventoryFor(game).includes(charmId);
}

function totalCharmCrafts(care) {
  return Math.round(clamp(Number(care?.actionCounts?.charmCraft) || 0, 0, 999999));
}

function charmRecipeText(charm, game = ensureGame()) {
  const collections = normalizeCollections(game?.collections);
  return Object.entries(charm.recipe || {})
    .map(([itemId, need]) => {
      const item = DISCOVERY_ITEMS[itemId];
      const owned = Math.round(clamp(collections[itemId] || 0, 0, 9999));
      return `${discoveryLabel(item)} ${owned}/${need}`;
    })
    .join(" · ");
}

function charmCraftable(game, charm) {
  const collections = normalizeCollections(game?.collections);
  return Object.entries(charm.recipe || {}).every(([itemId, need]) => (collections[itemId] || 0) >= need);
}

function charmBonusText(charm) {
  const parts = [];
  if (charm.speed && charm.speed !== 1) parts.push(`${Math.round((charm.speed - 1) * 100)}% ${careText("roam")}`);
  const bonuses = mergeRewards(...Object.values(charm.care || {}));
  if (bonuses.coins) parts.push(`+${bonuses.coins} ${careText("coins")}`);
  if (bonuses.xp) parts.push(`+${bonuses.xp} ${careText("xp")}`);
  if (bonuses.happiness) parts.push(`+${bonuses.happiness} ${careText("happiness")}`);
  if (bonuses.energy) parts.push(`+${bonuses.energy} ${careText("energy")}`);
  if (bonuses.training) parts.push(`+${bonuses.training} ${careText("training")}`);
  if (bonuses.bond) parts.push(`+${bonuses.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function charmCareBonus(charm, actionId) {
  if (!charm?.care) return null;
  return charm.care[actionId] || null;
}

function charmActionLine(charm, action) {
  const name = careText(charm.labelKey);
  if (currentLanguage() === "ko") {
    if (action === "craft") return `${name} 제작 완료. ${careText("charmBonus")} ${charmBonusText(charm)}.`;
    return `${name} 장착 완료.`;
  }
  if (action === "craft") return `${name} crafted. ${careText("charmBonus")} ${charmBonusText(charm)}.`;
  return `${name} equipped.`;
}

function totalAmbientEventCount(game) {
  const ambient = normalizeAmbientEvents(game?.ambientEvents);
  return Object.values(ambient.counts).reduce((sum, count) => sum + count, 0);
}

function moodAuraFor(moodId) {
  return MOOD_AURAS[moodId] || MOOD_AURAS.calm;
}

function moodMomentsFor(game) {
  return normalizeMoodMoments(game?.moodMoments);
}

function moodMomentCount(game, moodId) {
  return Math.round(clamp(Number(moodMomentsFor(game).counts[moodId]) || 0, 0, 999999));
}

function totalMoodChecks(care) {
  return Math.round(clamp(Number(care?.actionCounts?.moodCheck) || 0, 0, 999999));
}

function moodAuraReward(care, moodId) {
  const base = moodAuraFor(moodId).reward || {};
  const levelBonus = Math.floor((care?.level || 1) / 5);
  return {
    coins: Math.round(clamp((base.coins || 0) + levelBonus, 0, 99)),
    xp: Math.round(clamp((base.xp || 0) + levelBonus * 2, 0, 99)),
    hunger: Math.round(clamp(base.hunger || 0, 0, 30)),
    happiness: Math.round(clamp(base.happiness || 0, 0, 30)),
    energy: Math.round(clamp(base.energy || 0, 0, 30)),
    hygiene: Math.round(clamp(base.hygiene || 0, 0, 30)),
    training: Math.round(clamp(base.training || 0, 0, 30)),
    bond: Math.round(clamp(base.bond || 0, 0, 8)),
  };
}

function moodAuraRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`+${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function moodAuraLine(character, moodId, reward, completedQuests) {
  const aura = moodAuraFor(moodId);
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(aura.labelKey)}를 읽었어. ${careText(aura.descKey)} ${careText("moodAuraReward")} ${moodAuraRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} Read ${careText(aura.labelKey)}. ${careText(aura.descKey)} ${careText("moodAuraReward")} ${moodAuraRewardText(reward)}${quest}`;
}

function talentFor(talentId) {
  return TALENTS[talentId] || TALENTS.agility;
}

function talentTrainingCount(care, talentId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`talent:${talentId}`]) || 0, 0, 999999));
}

function talentLevel(care, talentId) {
  const count = talentTrainingCount(care, talentId);
  return TALENT_LEVEL_THRESHOLDS.reduce((level, target) => (count >= target ? level + 1 : level), 0);
}

function talentNextTarget(care, talentId) {
  const count = talentTrainingCount(care, talentId);
  return TALENT_LEVEL_THRESHOLDS.find((target) => count < target) || TALENT_LEVEL_THRESHOLDS[TALENT_LEVEL_THRESHOLDS.length - 1];
}

function totalTalentLevels(care) {
  return TALENT_IDS.reduce((sum, talentId) => sum + talentLevel(care, talentId), 0);
}

function talentReady(care, talent) {
  return care.energy >= talent.energyCost + 4 && care.training >= talent.trainingNeed;
}

function talentReward(care, talent, levelBefore = 0) {
  const base = talent.reward || {};
  const levelBonus = Math.max(0, levelBefore);
  return {
    xp: Math.round(clamp((base.xp || 0) + levelBonus * 2, 0, 99)),
    hunger: Math.round(clamp(base.hunger || 0, -30, 30)),
    happiness: Math.round(clamp((base.happiness || 0) + Math.floor(levelBonus / 2), 0, 30)),
    energy: Math.round(clamp(base.energy || 0, -30, 30)),
    hygiene: Math.round(clamp(base.hygiene || 0, -30, 30)),
    training: Math.round(clamp((base.training || 0) + levelBonus, 0, 30)),
    bond: Math.round(clamp((base.bond || 0) + (levelBefore >= 3 ? 1 : 0), 0, 8)),
    coins: Math.round(clamp(2 + levelBefore, 1, 24)),
  };
}

function talentRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`${reward.hunger > 0 ? "+" : ""}${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function talentRequirementText(talent) {
  const parts = [];
  if (talent.energyCost) parts.push(`-${talent.energyCost} ${careText("energy")}`);
  if (talent.trainingNeed) parts.push(`${careText("training")} ${talent.trainingNeed}`);
  return parts.join(" · ");
}

function talentPracticeLine(character, talent, levelBefore, levelAfter, reward, completedQuests) {
  const quest = questRewardLine(completedQuests);
  const levelPart = levelAfter > levelBefore
    ? currentLanguage() === "ko"
      ? ` ${careText("talentLevel")} ${levelAfter}!`
      : ` ${careText("talentLevel")} ${levelAfter}!`
    : "";
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(talent.labelKey)} 연습 완료. ${careText(talent.descKey)} ${careText("talentReward")} ${talentRewardText(reward)}.${levelPart}${quest}`;
  }
  return `${localStyleFor(character.id)} Practiced ${careText(talent.labelKey)}. ${careText(talent.descKey)} ${careText("talentReward")} ${talentRewardText(reward)}.${levelPart}${quest}`;
}

function tinyJobFor(jobId) {
  return TINY_JOBS[jobId] || TINY_JOBS.pocketScout;
}

function tinyJobRunCount(care, jobId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`job:${jobId}`]) || 0, 0, 999999));
}

function tinyJobReputation(care, jobId) {
  const count = tinyJobRunCount(care, jobId);
  return JOB_REPUTATION_THRESHOLDS.reduce((level, target) => (count >= target ? level + 1 : level), 0);
}

function tinyJobNextTarget(care, jobId) {
  const count = tinyJobRunCount(care, jobId);
  return JOB_REPUTATION_THRESHOLDS.find((target) => count < target) || JOB_REPUTATION_THRESHOLDS[JOB_REPUTATION_THRESHOLDS.length - 1];
}

function totalTinyJobs(care) {
  return Math.round(clamp(Number(care?.actionCounts?.jobRun) || 0, 0, 999999));
}

function tinyJobReady(care, job) {
  return care.energy >= job.energyCost + 4 && care.level >= job.level && care.training >= job.training;
}

function tinyJobReward(care, job, reputation = 0) {
  const base = job.reward || {};
  const talentBoost = talentLevel(care, job.talent);
  return {
    coins: Math.round(clamp((base.coins || 0) + reputation * 2 + talentBoost, 0, 99)),
    xp: Math.round(clamp((base.xp || 0) + reputation * 2 + talentBoost * 2, 0, 99)),
    hunger: Math.round(clamp(Number.isFinite(base.hunger) ? base.hunger : -2, -30, 30)),
    happiness: Math.round(clamp((base.happiness || 0) + Math.floor(reputation / 2), 0, 30)),
    energy: Math.round(clamp(base.energy || 0, -30, 30)),
    hygiene: Math.round(clamp(Number.isFinite(base.hygiene) ? base.hygiene : -1, -30, 30)),
    training: Math.round(clamp((base.training || 0) + (talentBoost >= 2 ? 1 : 0), 0, 30)),
    bond: Math.round(clamp((base.bond || 0) + (reputation >= 3 ? 1 : 0), 0, 8)),
  };
}

function tinyJobRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`${reward.hunger > 0 ? "+" : ""}${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`${reward.hygiene > 0 ? "+" : ""}${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function tinyJobRequirementText(job) {
  const language = currentLanguage();
  const parts = language === "ko"
    ? [`레벨 ${job.level}`, `훈련 ${job.training}`, `-${job.energyCost} ${careText("energy")}`]
    : [`Lv ${job.level}`, `Skill ${job.training}`, `-${job.energyCost} ${careText("energy")}`];
  return `${careText("jobNeed")} ${parts.join(" · ")}`;
}

function tinyJobFoundLine(foundItem) {
  if (!foundItem) return "";
  const name = discoveryLabel(foundItem);
  if (currentLanguage() === "ko") return ` 발견: ${name} +${foundItem.reward} ${careText("coins")}.`;
  return ` Found ${name} +${foundItem.reward} ${careText("coins")}.`;
}

function tinyJobLine(character, job, reward, repBefore, repAfter, completedQuests, foundItem = null) {
  const quest = questRewardLine(completedQuests);
  const repPart = repAfter > repBefore
    ? currentLanguage() === "ko"
      ? ` ${careText("jobReputation")} ${repAfter}!`
      : ` ${careText("jobReputation")} ${repAfter}!`
    : ` ${careText("jobReputation")} ${repAfter}.`;
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(job.labelKey)} 완료. ${careText(job.descKey)} ${careText("jobReward")} ${tinyJobRewardText(reward)}.${repPart}${tinyJobFoundLine(foundItem)}${quest}`;
  }
  return `${localStyleFor(character.id)} Finished ${careText(job.labelKey)}. ${careText(job.descKey)} ${careText("jobReward")} ${tinyJobRewardText(reward)}.${repPart}${tinyJobFoundLine(foundItem)}${quest}`;
}

function activeAmbientEvents(date = new Date()) {
  const seasonId = currentSeasonId(date);
  const timeId = currentTimeBandId(date);
  return AMBIENT_EVENT_IDS.map((id) => ({ id, ...AMBIENT_EVENTS[id] })).filter(
    (event) => event.seasons.includes(seasonId) && event.times.includes(timeId),
  );
}

function pickAmbientEvent(pet, date = new Date()) {
  const pool = activeAmbientEvents(date);
  const fallback = AMBIENT_EVENT_IDS.map((id) => ({ id, ...AMBIENT_EVENTS[id] }));
  const choices = pool.length ? pool : fallback;
  const personality = personalityForPet(pet);
  const mood = careMood(pet.care || careForPet(pet));
  const weighted = choices.map((event) => {
    let weight = event.weight || 1;
    if (personality.likes?.includes("nap") && event.reward?.energy) weight += 1;
    if (personality.likes?.includes("play") && event.reward?.happiness) weight += 1;
    if (personality.likes?.includes("train") && event.reward?.training) weight += 1;
    if (mood === "sleepy" && event.reward?.energy) weight += 2;
    if (mood === "hungry" && event.reward?.hunger) weight += 2;
    if (mood === "messy" && event.reward?.hygiene) weight += 2;
    return { event, weight: Math.max(1, weight) };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = rand(0, total);
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.event;
  }
  return weighted[0]?.event || fallback[0];
}

function ambientRewardText(event) {
  const reward = event?.reward || {};
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`+${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  return parts.join(" · ");
}

function ambientLine(pet, event, date = new Date()) {
  const character = characterFor(pet.characterId);
  const personality = personalityForPet(pet);
  const season = careText(SEASONS[currentSeasonId(date)]?.labelKey || "seasonSpring");
  const time = careText(TIME_BANDS[currentTimeBandId(date)]?.labelKey || "timeAfternoon");
  const mood = careText(careMood(pet.care || careForPet(pet)));
  const reward = ambientRewardText(event);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${time} ${season} 이벤트: ${careText(event.labelKey)}. ${careText(event.descKey)} ${careText(personality.labelKey)} ${character.name} 기분은 ${mood}. ${reward}`;
  }
  return `${localStyleFor(character.id)} ${time} ${season} moment: ${careText(event.labelKey)}. ${careText(event.descKey)} ${careText(personality.labelKey)} ${character.name} feels ${mood}. ${reward}`;
}

function habitatPlacedItems(game) {
  const normalized = normalizeGame(game);
  return normalized.habitatLayout.map((id) => HABITAT_ITEMS[id]).filter(Boolean);
}

function habitatPlacedCount(game) {
  return normalizeGame(game).habitatLayout.length;
}

function habitatComfortScore(game) {
  return habitatPlacedItems(game).reduce((sum, item) => sum + Math.round(clamp(item.comfort || 0, 0, 99)), 0);
}

function habitatItemRewardText(item) {
  const parts = [`${item.cost} ${careText("coins")}`];
  if (item.energy) parts.push(`+${item.energy} ${careText("energy")}`);
  if (item.hunger) parts.push(`+${item.hunger} ${careText("hunger")}`);
  if (item.happiness) parts.push(`+${item.happiness} ${careText("happiness")}`);
  if (item.hygiene) parts.push(`+${item.hygiene} ${careText("hygiene")}`);
  if (item.training) parts.push(`+${item.training} ${careText("training")}`);
  if (item.bond) parts.push(`+${item.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function habitatThemeFor(game) {
  const normalized = normalizeGame(game);
  return HABITAT_THEMES[normalized.habitatTheme] || HABITAT_THEMES[DEFAULT_GAME.habitatTheme];
}

function habitatThemeUnlocked(game, theme) {
  return habitatComfortScore(game) >= Math.round(clamp(theme?.unlockComfort || 0, 0, 999));
}

function habitatSetBonuses(game) {
  const placed = new Set(normalizeGame(game).habitatLayout);
  return HABITAT_SET_BONUS_IDS.map((id) => ({ id, ...HABITAT_SET_BONUSES[id] })).filter((bonus) =>
    bonus.items.every((itemId) => placed.has(itemId)),
  );
}

function totalRoomPlay(care) {
  return Math.round(clamp(Number(care?.actionCounts?.roomPlay) || 0, 0, 999999));
}

function mergeRewards(...rewards) {
  const merged = {};
  for (const reward of rewards) {
    if (!reward || typeof reward !== "object") continue;
    for (const [key, value] of Object.entries(reward)) {
      if (!Number.isFinite(value)) continue;
      merged[key] = (merged[key] || 0) + value;
    }
  }
  return merged;
}

function roomRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`+${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function formatCompactCount(value) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  if (n >= 1000000) return `${Math.round(n / 100000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return `${n}`;
}

function microEventFor(eventId) {
  return MICRO_EVENTS[eventId] || MICRO_EVENTS.signalCheck;
}

function microEventCount(care, eventId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`microEvent:${eventId}`]) || 0, 0, 999999));
}

function totalMicroEvents(care) {
  return Math.round(clamp(Number(care?.actionCounts?.microEvent) || 0, 0, 999999));
}

function personalityIdForPet(pet) {
  const personality = personalityForPet(pet);
  return PERSONALITY_IDS.find((id) => PERSONALITIES[id] === personality) || "curious";
}

function microEventScore(pet, care, game, event) {
  const moodId = careMood(care);
  const personalityId = personalityIdForPet(pet);
  const comfort = habitatComfortScore(game);
  const toyBonus = toyForCare(care) ? 4 : 0;
  const repeatPenalty = Math.min(8, microEventCount(care, event.id) * 0.5);
  return Math.round(
    20 +
      (event.moodWeight?.[moodId] || 0) +
      (event.personalityWeight?.[personalityId] || 0) +
      Math.min(9, comfort / 18) +
      toyBonus -
      repeatPenalty,
  );
}

function microEventReward(pet, care, game, event) {
  const comfortBonus = Math.floor(habitatComfortScore(game) / 44);
  const personalityMatch = event.personalityWeight?.[personalityIdForPet(pet)] ? 1 : 0;
  const toyBonus = toyForCare(care) ? 1 : 0;
  return mergeRewards(event.reward, {
    coins: comfortBonus,
    xp: comfortBonus + toyBonus + personalityMatch,
    happiness: personalityMatch,
    bond: personalityMatch && careMood(care) === "lonely" ? 1 : 0,
  });
}

function scaleMicroEventReward(reward, factor = 1) {
  const scaled = {};
  for (const [key, value] of Object.entries(reward || {})) {
    if (!Number.isFinite(value) || value <= 0) continue;
    scaled[key] = Math.max(key === "coins" || key === "xp" ? 1 : 0, Math.round(value * factor));
  }
  return scaled;
}

function microEventOptions(pet, care = careForPet(pet), game = settings?.game || null) {
  const safeGame = normalizeGame(game);
  return MICRO_EVENT_IDS.map((eventId) => {
    const event = { id: eventId, ...microEventFor(eventId) };
    return { event, score: microEventScore(pet, care, safeGame, event) };
  }).sort((a, b) => b.score - a.score);
}

function microEventLine(pet, character, event, reward, completedQuests) {
  const care = careForPet(pet);
  const game = ensureGame();
  const toy = toyForCare(care);
  const personality = personalityForPet(pet);
  const theme = habitatThemeFor(game);
  const detail = buildMicroEventDetail({
    language: currentLanguage(),
    seed: `${pet.slotIndex}:${event.id}:${microEventCount(care, event.id)}:${careMood(care)}:${careStage(care)}:${theme.labelKey}`,
    characterName: character.name,
    eventName: careText(event.labelKey),
    mood: careText(careMood(care)),
    stage: careText(careStage(care)),
    themeName: careText(theme.labelKey),
    toyName: toy ? careText(toy.labelKey) : "",
    personality: careText(personality.labelKey),
    rewardText: `${careText("microEventReward")} ${roomRewardText(reward)}`,
  });
  return `${localStyleFor(character.id)} ${detail}${questRewardLine(completedQuests)}`;
}

function habitatRoomReward(game) {
  const comfort = habitatComfortScore(game);
  const theme = habitatThemeFor(game);
  const bonuses = habitatSetBonuses(game);
  const bonusReward = bonuses.reduce((reward, bonus) => mergeRewards(reward, bonus.reward), {});
  return mergeRewards(
    {
      coins: 2 + bonuses.length + Math.floor(comfort / 40),
      xp: 5 + Math.floor(comfort / 18),
      happiness: 3 + Math.floor(comfort / 24),
      energy: 2 + Math.floor(comfort / 30),
      bond: bonuses.length >= 2 ? 2 : 1,
    },
    theme.reward,
    bonusReward,
  );
}

function habitatRoomLine(character, game, reward, completedQuests) {
  const theme = habitatThemeFor(game);
  const bonuses = habitatSetBonuses(game);
  const bonusText = bonuses.length
    ? bonuses.map((bonus) => careText(bonus.labelKey)).join(" + ")
    : careText("habitatSetBonus");
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(theme.labelKey)} 방에서 놀았어. ${bonusText} 적용! ${roomRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} Played in the ${careText(theme.labelKey)} room. ${bonusText} active! ${roomRewardText(reward)}${quest}`;
}

function roomEventFor(eventId) {
  return ROOM_EVENTS[eventId] || ROOM_EVENTS.plantCare;
}

function roomEventCount(care, eventId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`roomEvent:${eventId}`]) || 0, 0, 999999));
}

function totalRoomEvents(care) {
  return Math.round(clamp(Number(care?.actionCounts?.roomEvent) || 0, 0, 999999));
}

function roomEventUnlocked(game, event) {
  const placed = new Set(normalizeGame(game).habitatLayout);
  return event.items.every((itemId) => placed.has(itemId));
}

function roomEventReady(game, care, event) {
  return roomEventUnlocked(game, event) && care.energy >= event.energyCost + 4;
}

function roomEventItemsText(event) {
  return event.items.map((itemId) => careText(HABITAT_ITEMS[itemId]?.labelKey || itemId)).join(" + ");
}

function roomEventReward(game, event) {
  const comfort = habitatComfortScore(game);
  const bonusCount = habitatSetBonuses(game).length;
  return mergeRewards(event.reward, {
    coins: Math.floor(comfort / 38) + bonusCount,
    xp: Math.floor(comfort / 24),
    happiness: bonusCount,
    bond: bonusCount >= 2 ? 1 : 0,
  });
}

function roomEventRequirementText(event) {
  return `${careText("roomEventNeedItems")} ${roomEventItemsText(event)} · -${event.energyCost} ${careText("energy")}`;
}

function roomEventFoundLine(foundItem) {
  if (!foundItem) return "";
  const name = discoveryLabel(foundItem);
  if (currentLanguage() === "ko") return ` 발견: ${name} +${foundItem.reward} ${careText("coins")}.`;
  return ` Found ${name} +${foundItem.reward} ${careText("coins")}.`;
}

function roomEventLine(character, event, reward, completedQuests, foundItem = null) {
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(event.labelKey)} 완료. ${careText(event.descKey)} ${careText("roomEventReward")} ${roomRewardText(reward)}.${roomEventFoundLine(foundItem)}${quest}`;
  }
  return `${localStyleFor(character.id)} Finished ${careText(event.labelKey)}. ${careText(event.descKey)} ${careText("roomEventReward")} ${roomRewardText(reward)}.${roomEventFoundLine(foundItem)}${quest}`;
}

function miniGameCount(care, gameId = "") {
  if (!gameId) return 0;
  return Math.round(clamp(Number(care?.actionCounts?.[`miniGame:${gameId}`]) || 0, 0, 999999));
}

function totalMiniGames(care) {
  return Math.round(clamp(Number(care?.actionCounts?.miniGame) || 0, 0, 999999));
}

function miniGameBest(care, gameId = "") {
  if (!gameId) return 0;
  return Math.round(clamp(Number(care?.actionCounts?.[`miniBest:${gameId}`]) || 0, 0, 999999));
}

function miniGameScore(pet, gameDef, care) {
  const personality = personalityForPet(pet);
  const toy = toyForCare(care);
  const skillValue = Math.round(clamp(Number(care?.[gameDef.skill]) || 0, 0, 100));
  const likedBoost = personality.likes?.includes("play") ? 7 : personality.likes?.includes("train") ? 5 : 0;
  const toyBoost = toy ? Math.round(clamp((toy.happiness || 0) + (toy.training || 0) + (toy.energy || 0) * 0.35, 0, 18)) : 0;
  const base =
    26 +
    skillValue * 0.42 +
    care.happiness * 0.15 +
    care.energy * 0.18 +
    care.training * 0.16 +
    care.level * 1.8 +
    care.bond * 0.035 +
    likedBoost +
    toyBoost;
  const moodPenalty = careMood(care) === "sleepy" || careMood(care) === "hungry" ? 9 : 0;
  return Math.round(clamp(base + rand(0, 34) - moodPenalty, 10, 220));
}

function miniGameReward(gameDef, score, isBest) {
  return {
    coins: Math.round(clamp(4 + score / 18 + (isBest ? 5 : 0), 4, 28)),
    xp: Math.round(clamp(6 + score / 14 + (isBest ? 4 : 0), 6, 32)),
    happiness: Math.round(clamp(4 + score / 42, 3, 16)),
    energy: -gameDef.energyCost,
    training: Math.round(clamp(2 + score / 55, 1, 12)),
    bond: isBest ? 2 : 1,
  };
}

function miniGameRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function miniGameLine(character, gameDef, score, best, reward, completedQuests) {
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(gameDef.labelKey)} 점수 ${score}. ${careText("miniGameBest")} ${best}. ${miniGameRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} ${careText(gameDef.labelKey)} score ${score}. ${careText("miniGameBest")} ${best}. ${miniGameRewardText(reward)}${quest}`;
}

function pickDiscoveryItem(care) {
  const stage = careStage(care);
  const toyBonus = toyForCare(care) ? 0.1 : 0;
  const levelBonus = clamp((care.level || 1) / 40, 0, 0.35);
  const rareChance = 0.22 + levelBonus + toyBonus;
  const epicChance = 0.04 + levelBonus * 0.45 + (stage === "ace" ? 0.06 : 0);
  const roll = Math.random();
  let rarity = "common";
  if (roll < epicChance) rarity = "epic";
  else if (roll < epicChance + rareChance) rarity = "rare";
  const pool = DISCOVERY_ITEM_IDS.filter((id) => DISCOVERY_ITEMS[id].rarity === rarity);
  const fallback = DISCOVERY_ITEM_IDS.filter((id) => DISCOVERY_ITEMS[id].rarity === "common");
  const list = pool.length ? pool : fallback;
  const id = list[Math.floor(Math.random() * list.length)];
  return { id, ...DISCOVERY_ITEMS[id] };
}

function addDiscoveryToCollection(game, care, item, baseReward, options = {}) {
  const collections = normalizeCollections(game?.collections);
  const previousCount = Math.round(clamp(collections[item.id] || 0, 0, 9999));
  const firstFound = previousCount === 0;
  const rawReward = typeof baseReward === "function" ? baseReward(firstFound, previousCount) : baseReward;
  const charmBonus = charmCareBonus(charmForCare(care), "discover");
  const minReward = Number.isFinite(options.min) ? options.min : 0;
  const maxReward = Number.isFinite(options.max) ? options.max : 999;
  const reward = Math.round(clamp((Number(rawReward) || 0) + (charmBonus?.coins || 0), minReward, maxReward));
  collections[item.id] = Math.round(clamp(previousCount + 1, 0, 9999));
  game.collections = normalizeCollections(collections);
  return {
    item: { ...item, reward },
    reward,
    firstFound,
    previousCount,
    charmBonus,
  };
}

function normalizeMemory(source) {
  const src = source && typeof source === "object" ? source : {};
  const text = String(src.text || "").trim().slice(0, 180);
  if (!text) return null;
  return {
    at: Math.round(clamp(finiteNumber(src.at, Date.now()), 0, Date.now())),
    icon: String(src.icon || "✦").trim().slice(0, 4) || "✦",
    text,
  };
}

function friendshipKey(slotIndex) {
  return `slot-${Math.round(clamp(Number(slotIndex) || 0, 0, MAX_SLOTS - 1)) + 1}`;
}

function normalizeFriendships(source) {
  const src = source && typeof source === "object" ? source : {};
  const friendships = {};
  for (let index = 0; index < MAX_SLOTS; index += 1) {
    const key = friendshipKey(index);
    const value = Math.round(clamp(finiteNumber(src[key], 0), 0, 9999));
    if (value > 0) friendships[key] = value;
  }
  return friendships;
}

function normalizeCareRequest(source) {
  const src = source && typeof source === "object" ? source : {};
  const action = CARE_ACTION_IDS.includes(src.action) ? src.action : "";
  return {
    dayKey: String(src.dayKey || "").trim().slice(0, 16),
    action,
    done: src.done === true,
    seed: Math.round(clamp(finiteNumber(src.seed, 0), 0, 999999999)),
  };
}

function normalizeCareCombo(source) {
  const src = source && typeof source === "object" ? source : {};
  const lastAction = CARE_ACTION_IDS.includes(src.lastAction) ? src.lastAction : "";
  return {
    lastAction,
    lastAt: Math.round(clamp(finiteNumber(src.lastAt, 0), 0, Date.now())),
    chain: Math.round(clamp(finiteNumber(src.chain, 0), 0, 9999)),
  };
}

function normalizeCareRoutine(source) {
  const src = source && typeof source === "object" ? source : {};
  const id = CARE_ROUTINE_IDS.includes(src.id) ? src.id : "";
  const routine = CARE_ROUTINES[id] || null;
  const maxStep = routine ? routine.steps.length : 0;
  return {
    id,
    step: Math.round(clamp(finiteNumber(src.step, 0), 0, maxStep)),
    dayKey: String(src.dayKey || "").trim().slice(0, 16),
    completedToday: src.completedToday === true,
  };
}

function normalizeCare(source) {
  const src = source && typeof source === "object" ? source : {};
  const actionCounts = src.actionCounts && typeof src.actionCounts === "object" ? src.actionCounts : {};
  const memories = Array.isArray(src.memories) ? src.memories : [];
  const care = {
    ...DEFAULT_CARE,
    ...src,
    actionCounts: {},
    memories: [],
    friendships: {},
  };
  care.level = Math.round(clamp(finiteNumber(care.level, DEFAULT_CARE.level), 1, 99));
  care.xp = Math.round(clamp(finiteNumber(care.xp, 0), 0, 999999));
  care.bond = Math.round(clamp(finiteNumber(care.bond, 0), 0, 9999));
  care.hunger = Math.round(clamp(finiteNumber(care.hunger, DEFAULT_CARE.hunger), 0, 100));
  care.happiness = Math.round(clamp(finiteNumber(care.happiness, DEFAULT_CARE.happiness), 0, 100));
  care.energy = Math.round(clamp(finiteNumber(care.energy, DEFAULT_CARE.energy), 0, 100));
  care.hygiene = Math.round(clamp(finiteNumber(care.hygiene, DEFAULT_CARE.hygiene), 0, 100));
  care.training = Math.round(clamp(finiteNumber(care.training, 0), 0, 100));
  care.equippedToy = TOY_IDS.includes(care.equippedToy) ? care.equippedToy : "";
  care.equippedEffect = EFFECT_IDS.includes(care.equippedEffect) ? care.equippedEffect : DEFAULT_CARE.equippedEffect;
  care.equippedCharm = CHARM_IDS.includes(care.equippedCharm) ? care.equippedCharm : "";
  care.equippedMedal = LEAGUE_MEDAL_IDS.includes(care.equippedMedal) ? care.equippedMedal : "";
  care.request = normalizeCareRequest(src.request);
  care.combo = normalizeCareCombo(src.combo);
  care.routine = normalizeCareRoutine(src.routine);
  care.growthRewards = Array.isArray(src.growthRewards)
    ? Array.from(new Set(src.growthRewards.filter((id) => GROWTH_REWARD_IDS.includes(id)))).slice(0, GROWTH_REWARD_IDS.length)
    : [];
  care.memories = memories.map(normalizeMemory).filter(Boolean).slice(0, CARE_MEMORY_LIMIT);
  care.friendships = normalizeFriendships(src.friendships);
  care.lastCareAt = Math.round(clamp(finiteNumber(care.lastCareAt, 0), 0, Date.now()));
  care.lastActionAt = Math.round(clamp(finiteNumber(care.lastActionAt, 0), 0, Date.now()));
  for (const actionId of ACTION_COUNT_KEYS) {
    care.actionCounts[actionId] = Math.round(clamp(Number(actionCounts[actionId]) || 0, 0, 999999));
  }
  return care;
}

function careThreshold(level) {
  return 48 + Math.max(1, level) * 34;
}

function careStage(care) {
  if ((care?.level || 1) >= 8) return "ace";
  if ((care?.level || 1) >= 4) return "buddy";
  return "baby";
}

function careMood(care) {
  if ((care?.hunger || 0) < 34) return "hungry";
  if ((care?.energy || 0) < 30) return "sleepy";
  if ((care?.hygiene || 0) < 34) return "messy";
  if ((care?.happiness || 0) < 42) return "lonely";
  const score = ((care?.hunger || 0) + (care?.happiness || 0) + (care?.energy || 0) + (care?.hygiene || 0)) / 4;
  return score >= 78 ? "bright" : "calm";
}

function requestSeedFor(pet, care, dayKey = currentDayKey()) {
  return Math.abs(hashText(`${dayKey}:${pet?.slotIndex || 0}:${pet?.characterId || "pet"}:${care.level}:${care.bond}`));
}

function weightedRequestActions(pet, care) {
  const mood = careMood(care);
  const personality = personalityForPet(pet);
  const weights = {
    feed: mood === "hungry" ? 9 : 2,
    play: mood === "lonely" || mood === "bright" ? 6 : 2,
    pet: mood === "lonely" ? 7 : 3,
    clean: mood === "messy" ? 9 : 1,
    train: mood === "bright" ? 7 : 2,
    nap: mood === "sleepy" ? 9 : 1,
  };
  for (const actionId of personality.likes || []) {
    if (weights[actionId]) weights[actionId] += 3;
  }
  return Object.entries(weights).flatMap(([actionId, weight]) => Array(Math.max(1, Math.round(weight))).fill(actionId));
}

function pickCareRequestAction(pet, care, seed = requestSeedFor(pet, care)) {
  const pool = weightedRequestActions(pet, care);
  return pool[seed % pool.length] || "pet";
}

function ensureCareRequest(pet, care = careForPet(pet)) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return normalizeCareRequest(null);
  const today = currentDayKey();
  const current = normalizeCareRequest(care.request);
  if (current.dayKey === today && CARE_ACTION_IDS.includes(current.action)) return current;
  const seed = requestSeedFor(pet, care, today);
  const next = {
    dayKey: today,
    action: pickCareRequestAction(pet, care, seed),
    done: false,
    seed,
  };
  care.request = next;
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  saveSettingsSoon(900);
  return next;
}

function requestReasonLine(pet, care, actionId) {
  const character = characterFor(pet.characterId);
  const mood = careMood(care);
  const personality = careText(personalityForPet(pet).labelKey);
  if (currentLanguage() === "ko") {
    const moodLine = {
      hungry: "배가 비어서 작은 간식 신호를 보내고 있어.",
      sleepy: "졸려서 조용히 쉬고 싶어 해.",
      messy: "먼지 픽셀이 붙어서 정돈을 기다리고 있어.",
      lonely: "심심해서 네 손길을 찾고 있어.",
      bright: "컨디션이 좋아서 더 배우고 싶어 해.",
      calm: "차분한 상태라 가벼운 돌봄을 받아들이기 좋아.",
    };
    return `${character.name}는 ${personality} 성격이야. ${moodLine[mood] || moodLine.calm} ${careText(actionId)}를 부탁해.`;
  }
  const moodLine = {
    hungry: "is sending tiny snack signals.",
    sleepy: "wants a quiet reset.",
    messy: "has dust pixels waiting to be cleaned.",
    lonely: "is looking for your attention.",
    bright: "feels sharp enough to grow.",
    calm: "is calm and ready for gentle care.",
  };
  return `${character.name} is ${personality}. It ${moodLine[mood] || moodLine.calm} Request: ${careText(actionId)}.`;
}

function requestBonusFor(care, actionId) {
  const mood = careMood(care);
  const bonus = {
    xp: 5,
    happiness: actionId === "play" || actionId === "pet" ? 4 : 2,
    bond: actionId === "pet" ? 2 : 1,
    coins: 4,
  };
  if ((mood === "hungry" && actionId === "feed") || (mood === "sleepy" && actionId === "nap") || (mood === "messy" && actionId === "clean")) {
    bonus.xp += 3;
    bonus.happiness += 3;
    bonus.coins += 3;
  }
  if (actionId === "train") bonus.xp += 3;
  return bonus;
}

function requestBonusText(bonus) {
  const parts = [];
  if (bonus.coins) parts.push(`+${bonus.coins} ${careText("coins")}`);
  if (bonus.xp) parts.push(`+${bonus.xp} ${careText("xp")}`);
  if (bonus.happiness) parts.push(`+${bonus.happiness} ${careText("happiness")}`);
  if (bonus.bond) parts.push(`+${bonus.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function requestCompleteLine(character, actionId, bonus) {
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} 부탁한 ${careText(actionId)} 완료. ${careText("requestBonus")} ${requestBonusText(bonus)}.`;
  }
  return `${localStyleFor(character.id)} Request ${careText(actionId)} complete. ${careText("requestBonus")} ${requestBonusText(bonus)}.`;
}

function totalCareRequests(care) {
  return Math.round(clamp(Number(care?.actionCounts?.careRequest) || 0, 0, 999999));
}

function totalCareRoutines(care) {
  return Math.round(clamp(Number(care?.actionCounts?.routine) || 0, 0, 999999));
}

function routineCount(care, routineId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`routine:${routineId}`]) || 0, 0, 999999));
}

function routineRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function routineStepLine(character, routine, stepAction, step, total) {
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(routine.labelKey)} ${step}/${total}. ${careText(stepAction)} 완료.`;
  }
  return `${localStyleFor(character.id)} ${careText(routine.labelKey)} ${step}/${total}. ${careText(stepAction)} done.`;
}

function routineCompleteLine(character, routine, reward, completedQuests) {
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(routine.labelKey)} 완료. ${careText("routineReward")} ${routineRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} ${careText(routine.labelKey)} complete. ${careText("routineReward")} ${routineRewardText(reward)}${quest}`;
}

function totalPetCommands(care) {
  return Math.round(clamp(Number(care?.actionCounts?.command) || 0, 0, 999999));
}

function petCommandCount(care, commandId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`command:${commandId}`]) || 0, 0, 999999));
}

function petCommandRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function petCommandLine(character, command, reward, completedQuests) {
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(command.labelKey)} 명령 완료. ${petCommandRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} ${careText(command.labelKey)} command done. ${petCommandRewardText(reward)}${quest}`;
}

function careComboFor(care, actionId, now = Date.now()) {
  const comboState = normalizeCareCombo(care?.combo);
  if (!comboState.lastAction || !CARE_ACTION_IDS.includes(actionId)) return null;
  if (now - comboState.lastAt > CARE_COMBO_WINDOW_MS) return null;
  return CARE_COMBO_IDS.map((id) => ({ id, ...CARE_COMBOS[id] })).find(
    (combo) => combo.from === comboState.lastAction && combo.to === actionId,
  ) || null;
}

function nextCareCombos(care) {
  const comboState = normalizeCareCombo(care?.combo);
  if (!comboState.lastAction || Date.now() - comboState.lastAt > CARE_COMBO_WINDOW_MS) return [];
  return CARE_COMBO_IDS.map((id) => ({ id, ...CARE_COMBOS[id] })).filter((combo) => combo.from === comboState.lastAction);
}

function applyCareComboReward(care, combo) {
  if (!combo) return;
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(combo[key])) continue;
    care[key] = Math.round(clamp(care[key] + combo[key], 0, 100));
  }
  if (combo.bond) care.bond = Math.round(clamp(care.bond + combo.bond, 0, 9999));
}

function careComboRewardText(combo) {
  const parts = [];
  if (combo.coins) parts.push(`+${combo.coins} ${careText("coins")}`);
  if (combo.xp) parts.push(`+${combo.xp} ${careText("xp")}`);
  if (combo.happiness) parts.push(`+${combo.happiness} ${careText("happiness")}`);
  if (combo.energy) parts.push(`+${combo.energy} ${careText("energy")}`);
  if (combo.hunger) parts.push(`+${combo.hunger} ${careText("hunger")}`);
  if (combo.hygiene) parts.push(`+${combo.hygiene} ${careText("hygiene")}`);
  if (combo.training) parts.push(`+${combo.training} ${careText("training")}`);
  if (combo.bond) parts.push(`+${combo.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function careComboLine(combo, chain) {
  if (!combo) return "";
  if (currentLanguage() === "ko") {
    return ` ${careText(combo.labelKey)} 콤보 완성. ${careText("comboChain")} ${chain}. ${careText("comboReward")} ${careComboRewardText(combo)}.`;
  }
  return ` ${careText(combo.labelKey)} combo complete. ${careText("comboChain")} ${chain}. ${careText("comboReward")} ${careComboRewardText(combo)}.`;
}

function totalCareCombos(care) {
  return Math.round(clamp(Number(care?.actionCounts?.careCombo) || 0, 0, 999999));
}

function petHabitProgress(care, habit) {
  const counts = care?.actionCounts && typeof care.actionCounts === "object" ? care.actionCounts : {};
  const value = Object.entries(habit?.sources || {}).reduce((sum, [key, weight]) => {
    return sum + (Number(counts[key]) || 0) * finiteNumber(weight, 1);
  }, 0);
  const target = Math.max(1, Math.round(habit?.target || 1));
  return {
    value: Math.round(clamp(value, 0, 999999)),
    target,
    done: value >= target,
    percent: clamp((value / target) * 100, 0, 100),
  };
}

function petHabitUnlocked(care, habit) {
  return petHabitProgress(care, habit).done;
}

function activePetHabits(care = null) {
  return PET_HABIT_IDS
    .map((id) => ({ id, ...PET_HABITS[id] }))
    .filter((habit) => petHabitUnlocked(care, habit));
}

function totalPetHabits(care = null) {
  return activePetHabits(care).length;
}

function petHabitEffects(care = null) {
  const effects = { speed: 1, xp: 1, care: {} };
  for (const habit of activePetHabits(care)) {
    const effect = habit.effect || {};
    if (Number.isFinite(effect.speed)) effects.speed *= effect.speed;
    if (Number.isFinite(effect.xp)) effects.xp *= effect.xp;
    for (const [actionId, bonus] of Object.entries(effect.care || {})) {
      effects.care[actionId] = effects.care[actionId] || {};
      for (const [key, value] of Object.entries(bonus || {})) {
        if (!Number.isFinite(value)) continue;
        effects.care[actionId][key] = (effects.care[actionId][key] || 0) + value;
      }
    }
  }
  effects.speed = clamp(effects.speed, 0.94, 1.12);
  effects.xp = clamp(effects.xp, 1, 1.14);
  return effects;
}

function petHabitEffectText(habit) {
  const effect = habit?.effect || {};
  const parts = [];
  if (Number.isFinite(effect.speed)) {
    const percent = Math.round((effect.speed - 1) * 100);
    if (percent) parts.push(`${percent > 0 ? "+" : ""}${percent}% ${careText("roam")}`);
  }
  if (Number.isFinite(effect.xp)) {
    parts.push(`+${Math.round((effect.xp - 1) * 100)}% ${careText("xp")}`);
  }
  for (const [actionId, bonus] of Object.entries(effect.care || {})) {
    for (const [key, value] of Object.entries(bonus || {})) {
      if (!Number.isFinite(value) || value === 0) continue;
      parts.push(`${careText(actionId)} +${value} ${careText(key)}`);
    }
  }
  return parts.join(" · ") || careText("petHabitEffect");
}

function petHabitCareLine(care, actionId) {
  const matching = activePetHabits(care)
    .filter((habit) => habit.effect?.care?.[actionId])
    .map((habit) => careText(habit.labelKey))
    .slice(0, 2);
  if (!matching.length) return "";
  return currentLanguage() === "ko"
    ? ` ${careText("petHabitsTitle")} ${matching.join(" · ")} 보너스.`
    : ` ${careText("petHabitsTitle")} bonus: ${matching.join(" · ")}.`;
}

function careQuirkSourceValue(care, sourceId) {
  const counts = care?.actionCounts && typeof care.actionCounts === "object" ? care.actionCounts : {};
  if (sourceId === "expedition") return totalExpeditionRuns(care);
  if (sourceId === "memories") return (care?.memories || []).length;
  return Math.round(clamp(Number(counts[sourceId]) || 0, 0, 999999));
}

function careQuirkProgress(care, quirk) {
  const value = typeof quirk?.value === "function"
    ? finiteNumber(quirk.value({ care }), 0)
    : Object.entries(quirk?.sources || {}).reduce((sum, [sourceId, weight]) => {
      return sum + careQuirkSourceValue(care, sourceId) * finiteNumber(weight, 1);
    }, 0);
  const target = Math.max(1, Math.round(quirk?.target || 1));
  return {
    value: Math.round(clamp(value, 0, 999999)),
    target,
    done: value >= target,
    percent: clamp((value / target) * 100, 0, 100),
  };
}

function activeCareQuirks(care = null) {
  return CARE_QUIRK_IDS
    .map((id) => ({ id, ...CARE_QUIRKS[id] }))
    .filter((quirk) => careQuirkProgress(care, quirk).done);
}

function totalCareQuirks(care = null) {
  return activeCareQuirks(care).length;
}

function careQuirkEffects(care = null) {
  const effects = { speed: 1, xp: 1, care: {}, burst: 0, idle: 0, motion: 0, colors: [] };
  for (const quirk of activeCareQuirks(care)) {
    const effect = quirk.effect || {};
    if (Number.isFinite(effect.speed)) effects.speed *= effect.speed;
    if (Number.isFinite(effect.xp)) effects.xp *= effect.xp;
    if (Number.isFinite(effect.burst)) effects.burst += effect.burst;
    if (Number.isFinite(effect.idle)) effects.idle += effect.idle;
    if (Number.isFinite(effect.motion)) effects.motion += effect.motion;
    if (quirk.color) effects.colors.push(quirk.color);
    for (const [actionId, bonus] of Object.entries(effect.care || {})) {
      effects.care[actionId] = effects.care[actionId] || {};
      for (const [key, value] of Object.entries(bonus || {})) {
        if (!Number.isFinite(value)) continue;
        effects.care[actionId][key] = (effects.care[actionId][key] || 0) + value;
      }
    }
  }
  effects.speed = clamp(effects.speed, 0.94, 1.16);
  effects.xp = clamp(effects.xp, 1, 1.14);
  effects.burst = Math.round(clamp(effects.burst, 0, 12));
  effects.idle = clamp(effects.idle, 0, 0.65);
  effects.motion = clamp(effects.motion, 0, 1.1);
  effects.colors = Array.from(new Set(effects.colors)).slice(0, 6);
  return effects;
}

function careQuirkEffectText(quirk) {
  const effect = quirk?.effect || {};
  const parts = [];
  if (Number.isFinite(effect.speed)) {
    const percent = Math.round((effect.speed - 1) * 100);
    if (percent) parts.push(`${percent > 0 ? "+" : ""}${percent}% ${careText("roam")}`);
  }
  if (Number.isFinite(effect.xp)) {
    const percent = Math.round((effect.xp - 1) * 100);
    if (percent) parts.push(`${percent > 0 ? "+" : ""}${percent}% ${careText("xp")}`);
  }
  if (Number.isFinite(effect.burst) && effect.burst > 0) {
    parts.push(`+${Math.round(effect.burst)} ${careText("growthRewardBurst")}`);
  }
  if (Number.isFinite(effect.motion) && effect.motion > 0) {
    parts.push(careText("growthRewardMotion"));
  }
  for (const [actionId, bonus] of Object.entries(effect.care || {})) {
    for (const [key, value] of Object.entries(bonus || {})) {
      if (!Number.isFinite(value) || value === 0) continue;
      parts.push(`${careText(actionId)} +${value} ${careText(key)}`);
    }
  }
  return parts.join(" · ") || careText("quirkEffect");
}

function careQuirkCareLine(care, actionId) {
  const matching = activeCareQuirks(care)
    .filter((quirk) => quirk.effect?.care?.[actionId])
    .map((quirk) => careText(quirk.labelKey))
    .slice(0, 2);
  if (!matching.length) return "";
  return currentLanguage() === "ko"
    ? ` ${careText("quirksTitle")} ${matching.join(" · ")} 반응.`
    : ` ${careText("quirksTitle")} reaction: ${matching.join(" · ")}.`;
}

function careQuirkIdleLine(pet, quirk) {
  const character = characterFor(pet?.characterId);
  const label = careText(quirk.labelKey);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${label} 개성이 살짝 튀어나왔어.`;
  }
  return `${localStyleFor(character.id)} ${label} quirk is showing.`;
}

function careQuirkComboUnlocked(care, combo) {
  const activeIds = new Set(activeCareQuirks(care).map((quirk) => quirk.id));
  return (combo?.requires || []).every((quirkId) => activeIds.has(quirkId));
}

function activeCareQuirkCombos(care = null) {
  const activeIds = new Set(activeCareQuirks(care).map((quirk) => quirk.id));
  return CARE_QUIRK_COMBO_IDS
    .map((id) => ({ id, ...CARE_QUIRK_COMBOS[id] }))
    .filter((combo) => (combo.requires || []).every((quirkId) => activeIds.has(quirkId)));
}

function totalCareQuirkCombos(care = null) {
  return activeCareQuirkCombos(care).length;
}

function careQuirkComboEffects(care = null) {
  const effects = { speed: 1, xp: 1, care: {}, burst: 0, idle: 0, motion: 0, colors: [] };
  for (const combo of activeCareQuirkCombos(care)) {
    const effect = combo.effect || {};
    if (Number.isFinite(effect.speed)) effects.speed *= effect.speed;
    if (Number.isFinite(effect.xp)) effects.xp *= effect.xp;
    if (Number.isFinite(effect.burst)) effects.burst += effect.burst;
    if (Number.isFinite(effect.idle)) effects.idle += effect.idle;
    if (Number.isFinite(effect.motion)) effects.motion += effect.motion;
    if (combo.color) effects.colors.push(combo.color);
    for (const [actionId, bonus] of Object.entries(effect.care || {})) {
      effects.care[actionId] = effects.care[actionId] || {};
      for (const [key, value] of Object.entries(bonus || {})) {
        if (!Number.isFinite(value)) continue;
        effects.care[actionId][key] = (effects.care[actionId][key] || 0) + value;
      }
    }
  }
  effects.speed = clamp(effects.speed, 0.94, 1.14);
  effects.xp = clamp(effects.xp, 1, 1.14);
  effects.burst = Math.round(clamp(effects.burst, 0, 12));
  effects.idle = clamp(effects.idle, 0, 0.65);
  effects.motion = clamp(effects.motion, 0, 1.1);
  effects.colors = Array.from(new Set(effects.colors)).slice(0, 6);
  return effects;
}

function careQuirkComboEffectText(combo) {
  const effect = combo?.effect || {};
  const parts = [];
  if (Number.isFinite(effect.speed)) {
    const percent = Math.round((effect.speed - 1) * 100);
    if (percent) parts.push(`${percent > 0 ? "+" : ""}${percent}% ${careText("roam")}`);
  }
  if (Number.isFinite(effect.xp)) {
    const percent = Math.round((effect.xp - 1) * 100);
    if (percent) parts.push(`${percent > 0 ? "+" : ""}${percent}% ${careText("xp")}`);
  }
  if (Number.isFinite(effect.burst) && effect.burst > 0) {
    parts.push(`+${Math.round(effect.burst)} ${careText("growthRewardBurst")}`);
  }
  if (Number.isFinite(effect.motion) && effect.motion > 0) {
    parts.push(careText("growthRewardMotion"));
  }
  for (const [actionId, bonus] of Object.entries(effect.care || {})) {
    for (const [key, value] of Object.entries(bonus || {})) {
      if (!Number.isFinite(value) || value === 0) continue;
      parts.push(`${careText(actionId)} +${value} ${careText(key)}`);
    }
  }
  return parts.join(" · ") || careText("quirkComboEffect");
}

function careQuirkComboNeedText(combo) {
  return (combo?.requires || [])
    .map((quirkId) => careText(CARE_QUIRKS[quirkId]?.labelKey) || quirkId)
    .join(" + ");
}

function careQuirkComboCareLine(care, actionId) {
  const matching = activeCareQuirkCombos(care)
    .filter((combo) => combo.effect?.care?.[actionId])
    .map((combo) => careText(combo.labelKey))
    .slice(0, 2);
  if (!matching.length) return "";
  return currentLanguage() === "ko"
    ? ` ${careText("quirkCombosTitle")} ${matching.join(" · ")} 보너스.`
    : ` ${careText("quirkCombosTitle")} bonus: ${matching.join(" · ")}.`;
}

function careQuirkComboIdleLine(pet, combo) {
  const character = characterFor(pet?.characterId);
  const label = careText(combo.labelKey);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${label} 조합이 켜져서 움직임이 더 살아났어.`;
  }
  return `${localStyleFor(character.id)} ${label} combo is kicking in.`;
}

function animalInstinctForPet(pet) {
  const characterId = pet?.characterId || "";
  const instinct = ANIMAL_INSTINCTS[characterId];
  return instinct ? { id: characterId, ...instinct } : null;
}

function animalInstinctSourceValue(care, game, sourceId) {
  const counts = care?.actionCounts && typeof care.actionCounts === "object" ? care.actionCounts : {};
  if (sourceId === "expedition") return totalExpeditionRuns(care);
  if (sourceId === "collections") return collectionUniqueCount(game);
  return Math.round(clamp(Number(counts[sourceId]) || 0, 0, 999999));
}

function animalInstinctProgress(pet, care, game = settings?.game || null) {
  const instinct = animalInstinctForPet(pet);
  if (!instinct) return { value: 0, target: 1, done: false, percent: 0, instinct: null };
  const safeGame = normalizeGame(game);
  const value = Object.entries(instinct.sources || {}).reduce((sum, [sourceId, weight]) => {
    return sum + animalInstinctSourceValue(care, safeGame, sourceId) * finiteNumber(weight, 1);
  }, 0);
  const target = Math.max(1, Math.round(instinct.target || 1));
  return {
    value: Math.round(clamp(value, 0, 999999)),
    target,
    done: value >= target,
    percent: clamp((value / target) * 100, 0, 100),
    instinct,
  };
}

function animalInstinctUnlocked(pet, care, game = settings?.game || null) {
  return animalInstinctProgress(pet, care, game).done;
}

function totalAnimalInstincts(pet, care = careForPet(pet), game = settings?.game || null) {
  return animalInstinctUnlocked(pet, care, game) ? 1 : 0;
}

function animalInstinctEffects(pet, care = careForPet(pet), game = settings?.game || null) {
  const progress = animalInstinctProgress(pet, care, game);
  const instinct = progress.instinct;
  const effects = { speed: 1, xp: 1, care: {} };
  if (!instinct || !progress.done) return effects;
  const effect = instinct.effect || {};
  if (Number.isFinite(effect.speed)) effects.speed = clamp(effect.speed, 0.96, 1.1);
  if (Number.isFinite(effect.xp)) effects.xp = clamp(effect.xp, 1, 1.1);
  for (const [actionId, bonus] of Object.entries(effect.care || {})) {
    effects.care[actionId] = {};
    for (const [key, value] of Object.entries(bonus || {})) {
      if (!Number.isFinite(value)) continue;
      effects.care[actionId][key] = value;
    }
  }
  return effects;
}

function animalInstinctEffectText(instinct) {
  const effect = instinct?.effect || {};
  const parts = [];
  if (Number.isFinite(effect.speed)) {
    const percent = Math.round((effect.speed - 1) * 100);
    if (percent) parts.push(`${percent > 0 ? "+" : ""}${percent}% ${careText("roam")}`);
  }
  if (Number.isFinite(effect.xp)) {
    parts.push(`+${Math.round((effect.xp - 1) * 100)}% ${careText("xp")}`);
  }
  for (const [actionId, bonus] of Object.entries(effect.care || {})) {
    for (const [key, value] of Object.entries(bonus || {})) {
      if (!Number.isFinite(value) || value === 0) continue;
      parts.push(`${careText(actionId)} +${value} ${careText(key)}`);
    }
  }
  return parts.join(" · ") || careText("animalInstinctEffect");
}

function animalInstinctCareLine(pet, care, actionId) {
  const progress = animalInstinctProgress(pet, care, settings?.game || null);
  if (!progress.done || !progress.instinct?.effect?.care?.[actionId]) return "";
  const label = careText(progress.instinct.labelKey);
  return currentLanguage() === "ko"
    ? ` ${careText("animalInstinctTitle")} ${label} 보너스.`
    : ` ${careText("animalInstinctTitle")} bonus: ${label}.`;
}

function firstCareActionFromSources(sources = {}) {
  return CARE_ACTION_IDS.find((actionId) => Number(sources?.[actionId]) > 0) || "";
}

function addCareCoachCandidate(candidates, candidate) {
  const actionId = candidate?.actionId || "";
  if (!CARE_ACTIONS[actionId]) return;
  const score = finiteNumber(candidate.score, 0);
  if (score <= 0) return;
  const normalized = {
    id: candidate.id || actionId,
    actionId,
    icon: candidate.icon || CARE_ACTIONS[actionId].icon,
    labelKey: candidate.labelKey || actionId,
    descKey: candidate.descKey || "careCoachTitle",
    detail: candidate.detail || "",
    color: candidate.color || "#42d7c5",
    score,
  };
  const existingIndex = candidates.findIndex((item) => item.actionId === actionId);
  if (existingIndex >= 0) {
    if (score > candidates[existingIndex].score) candidates[existingIndex] = normalized;
    return;
  }
  candidates.push(normalized);
}

function careCoachProgressDetail(groupKey, item, progress) {
  if (!item || !progress) return "";
  const value = Math.min(progress.value, progress.target);
  return `${careText(groupKey)} · ${careText(item.labelKey)} ${value}/${progress.target}`;
}

function careCoachSuggestions(pet, care = careForPet(pet), character = characterFor(pet?.characterId)) {
  const candidates = [];
  const counts = care?.actionCounts && typeof care.actionCounts === "object" ? care.actionCounts : {};
  const moodId = careMood(care);

  if (care.hunger < 82) {
    addCareCoachCandidate(candidates, {
      id: "hungry",
      actionId: "feed",
      icon: "FD",
      labelKey: "coachHungry",
      descKey: "coachHungryDesc",
      color: "#fb923c",
      detail: `${careText("hunger")} ${Math.round(care.hunger)}/100`,
      score: 112 - care.hunger,
    });
  }
  if (care.energy < 74) {
    addCareCoachCandidate(candidates, {
      id: "sleepy",
      actionId: "nap",
      icon: "ZZ",
      labelKey: "coachSleepy",
      descKey: "coachSleepyDesc",
      color: "#a78bfa",
      detail: `${careText("energy")} ${Math.round(care.energy)}/100`,
      score: 104 - care.energy,
    });
  }
  if (care.hygiene < 82) {
    addCareCoachCandidate(candidates, {
      id: "messy",
      actionId: "clean",
      icon: "CL",
      labelKey: "coachMessy",
      descKey: "coachMessyDesc",
      color: "#42d7c5",
      detail: `${careText("hygiene")} ${Math.round(care.hygiene)}/100`,
      score: 98 - care.hygiene,
    });
  }
  if (care.happiness < 78) {
    const actionId = care.energy < 30 ? "pet" : "play";
    addCareCoachCandidate(candidates, {
      id: care.energy < 30 ? "lonely" : "playful",
      actionId,
      icon: care.energy < 30 ? "HT" : "PL",
      labelKey: care.energy < 30 ? "coachLonely" : "coachPlayful",
      descKey: care.energy < 30 ? "coachLonelyDesc" : "coachPlayfulDesc",
      color: care.energy < 30 ? "#fb7185" : "#38bdf8",
      detail: `${careText("happiness")} ${Math.round(care.happiness)}/100`,
      score: 94 - care.happiness + (care.energy < 30 ? 8 : 0),
    });
  }
  if (care.training < 68 && care.energy >= 26) {
    addCareCoachCandidate(candidates, {
      id: "training",
      actionId: "train",
      icon: "SK",
      labelKey: "coachTraining",
      descKey: "coachTrainingDesc",
      color: "#3a87ff",
      detail: `${careText("training")} ${Math.round(care.training)}/100`,
      score: 76 - care.training + Math.min(12, care.level),
    });
  }

  const personality = personalityForPet(pet);
  const likedAction = (personality.likes || [])
    .filter((actionId) => CARE_ACTIONS[actionId])
    .sort((a, b) => (Number(counts[a]) || 0) - (Number(counts[b]) || 0))[0];
  if (likedAction) {
    addCareCoachCandidate(candidates, {
      id: `personality:${likedAction}`,
      actionId: likedAction,
      icon: personality.icon || CARE_ACTIONS[likedAction].icon,
      labelKey: "coachPersonality",
      descKey: "coachPersonalityDesc",
      color: personality.color || "#facc15",
      detail: `${careText(personality.labelKey)} · ${careText(likedAction)}`,
      score: 34 + Math.max(0, 8 - (Number(counts[likedAction]) || 0)),
    });
  }

  const nextHabit = PET_HABIT_IDS
    .map((habitId) => {
      const habit = { id: habitId, ...PET_HABITS[habitId] };
      const progress = petHabitProgress(care, habit);
      return { habit, progress, actionId: firstCareActionFromSources(habit.sources) };
    })
    .filter((item) => item.actionId && !item.progress.done)
    .sort((a, b) => b.progress.percent - a.progress.percent)[0];
  if (nextHabit) {
    addCareCoachCandidate(candidates, {
      id: `habit:${nextHabit.habit.id}`,
      actionId: nextHabit.actionId,
      icon: nextHabit.habit.icon,
      labelKey: "coachHabit",
      descKey: "coachHabitDesc",
      color: nextHabit.habit.color,
      detail: careCoachProgressDetail("petHabitsTitle", nextHabit.habit, nextHabit.progress),
      score: 42 + nextHabit.progress.percent * 0.42,
    });
  }

  const instinctProgress = animalInstinctProgress(pet, care, settings?.game || null);
  const instinctActionId = firstCareActionFromSources(instinctProgress.instinct?.sources || {});
  if (instinctProgress.instinct && instinctActionId && !instinctProgress.done) {
    addCareCoachCandidate(candidates, {
      id: `instinct:${instinctProgress.instinct.id}`,
      actionId: instinctActionId,
      icon: instinctProgress.instinct.icon,
      labelKey: "coachInstinct",
      descKey: "coachInstinctDesc",
      color: instinctProgress.instinct.color,
      detail: careCoachProgressDetail("animalInstinctTitle", instinctProgress.instinct, instinctProgress),
      score: 44 + instinctProgress.percent * 0.48,
    });
  }

  if (!candidates.length) {
    const fallbackAction = moodId === "bright" || moodId === "calm" ? "play" : "pet";
    addCareCoachCandidate(candidates, {
      id: "fallback",
      actionId: fallbackAction,
      icon: character?.icon || CARE_ACTIONS[fallbackAction].icon,
      labelKey: fallbackAction === "play" ? "coachPlayful" : "coachLonely",
      descKey: fallbackAction === "play" ? "coachPlayfulDesc" : "coachLonelyDesc",
      color: "#facc15",
      detail: `${careText("mood")} ${careText(moodId)}`,
      score: 24,
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
}

function careMovementFactor(care, personality = null, pet = null) {
  if (!care) return 1;
  let factor = 1;
  const toy = toyForCare(care);
  if (care.energy < 24) factor *= 0.58;
  else if (care.energy < 42) factor *= 0.78;
  if (care.hunger < 26) factor *= 0.72;
  if (care.happiness > 84) factor *= 1.1;
  if (care.training > 65) factor *= 1.06;
  factor *= 1 + talentLevel(care, "agility") * 0.025;
  const charm = charmForCare(care);
  if (charm) factor *= finiteNumber(charm.speed, 1);
  const path = growthPathFor(care, settings?.game || null);
  if (path.score >= 40) factor *= finiteNumber(path.def.speed, 1);
  factor *= growthRewardEffects(care).speed;
  factor *= careQuirkEffects(care).speed;
  factor *= careQuirkComboEffects(care).speed;
  factor *= petHabitEffects(care).speed;
  factor *= moodPatternEffects(care).speed;
  if (pet) factor *= animalInstinctEffects(pet, care, settings?.game || null).speed;
  factor *= bondPerkEffects(care, settings?.game || null).speed;
  if (pet) factor *= petSynergyEffects(pet, care, settings?.game || null).speed;
  const medal = medalForCare(care, settings?.game || null);
  if (medal) factor *= finiteNumber(medal.perk?.speed, 1);
  if (personality) factor *= finiteNumber(personality.speed, 1);
  if (toy) factor *= finiteNumber(toy.speed, 1);
  return clamp(factor, 0.42, 1.55);
}

// careMovementFactor() fans out into ~12 care/game lookups (bond perks, synergy
// → caretakerStats, growth, mood patterns, …) that only change on care actions
// or slow decay — yet the motion loop needs it every pet every frame. Recomputing
// it 120x/s per pet was ~50% of all overlay CPU. Cache per pet with a short TTL;
// a speed factor that lags a fraction of a second is imperceptible.
const CARE_FACTOR_TTL_MS = 600;
function cachedCareMovementFactor(pet, now) {
  if (pet._careFactor !== undefined && now - (pet._careFactorAt || 0) < CARE_FACTOR_TTL_MS) {
    return pet._careFactor;
  }
  pet._careFactorAt = now;
  pet._careFactor = careMovementFactor(pet.care || careForPet(pet), personalityForPet(pet), pet);
  return pet._careFactor;
}

function trickUnlocked(care, trick) {
  return care.level >= trick.level && care.training >= trick.training && care.bond >= trick.bond;
}

function expeditionUnlocked(care, expedition) {
  return care.level >= expedition.level && care.training >= expedition.training && care.bond >= expedition.bond;
}

function trickRequirementText(trick) {
  const language = currentLanguage();
  const parts = language === "ko"
    ? [`레벨 ${trick.level}`, `훈련 ${trick.training}`, `친밀도 ${trick.bond}`]
    : [`Lv ${trick.level}`, `Skill ${trick.training}`, `Bond ${trick.bond}`];
  return `${careText("trickNeed")} ${parts.join(" · ")}`;
}

function expeditionRequirementText(expedition) {
  const language = currentLanguage();
  const parts = language === "ko"
    ? [`레벨 ${expedition.level}`, `훈련 ${expedition.training}`, `친밀도 ${expedition.bond}`]
    : [`Lv ${expedition.level}`, `Skill ${expedition.training}`, `Bond ${expedition.bond}`];
  return `${careText("expeditionNeed")} ${parts.join(" · ")}`;
}

function totalTrickUses(care) {
  return PET_TRICK_IDS.reduce((sum, trickId) => sum + (care.actionCounts?.[`trick:${trickId}`] || 0), 0);
}

function trickUseCount(care, trickId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`trick:${trickId}`]) || 0, 0, 999999));
}

function trickMasteryLevel(care, trickId) {
  const count = trickUseCount(care, trickId);
  return TRICK_MASTERY_THRESHOLDS.reduce((level, target) => (count >= target ? level + 1 : level), 0);
}

function trickMasteryTarget(care, trickId) {
  const count = trickUseCount(care, trickId);
  return TRICK_MASTERY_THRESHOLDS.find((target) => count < target) || TRICK_MASTERY_THRESHOLDS[TRICK_MASTERY_THRESHOLDS.length - 1];
}

function trickMasteryLabel(care, trickId) {
  const level = trickMasteryLevel(care, trickId);
  return careText(TRICK_MASTERY_LABEL_KEYS[level] || TRICK_MASTERY_LABEL_KEYS[0]);
}

function totalTrickMastery(care) {
  return PET_TRICK_IDS.reduce((sum, trickId) => sum + trickMasteryLevel(care, trickId), 0);
}

function masteredTrickCount(care) {
  return PET_TRICK_IDS.filter((trickId) => trickMasteryLevel(care, trickId) >= TRICK_MASTERY_THRESHOLDS.length).length;
}

function trickMasteryReward(level) {
  return {
    xp: 3 + level * 2,
    training: level >= 2 ? 1 : 0,
    bond: level >= 3 ? 1 : 0,
    happiness: 2 + level,
  };
}

function trickMasteryLine(trick, level) {
  const label = careText(TRICK_MASTERY_LABEL_KEYS[level] || "masteryMaster");
  const name = careText(trick.labelKey);
  if (currentLanguage() === "ko") return ` ${name} 숙련도가 ${label} 단계로 올랐어.`;
  return ` ${name} mastery reached ${label}.`;
}

function totalExpeditionRuns(care) {
  return EXPEDITION_IDS.reduce((sum, expeditionId) => sum + (care.actionCounts?.[`expedition:${expeditionId}`] || 0), 0);
}

function signatureActionIdFor(pet) {
  return SIGNATURE_ACTIONS[pet?.characterId] ? pet.characterId : "custom";
}

function signatureActionFor(pet) {
  return SIGNATURE_ACTIONS[signatureActionIdFor(pet)] || SIGNATURE_ACTIONS.custom;
}

function signatureActionKeyFor(pet) {
  return `signature:${signatureActionIdFor(pet)}`;
}

function signatureName(action) {
  return action?.name?.[currentLanguage()] || action?.name?.en || careText("specialTitle");
}

function signatureDesc(action) {
  return action?.desc?.[currentLanguage()] || action?.desc?.en || "";
}

function totalSignatureActions(care) {
  return Object.entries(care?.actionCounts || {}).reduce(
    (sum, [key, value]) => (String(key).startsWith("signature:") ? sum + Math.round(clamp(Number(value) || 0, 0, 999999)) : sum),
    0,
  );
}

function totalFriendshipScore(care) {
  return Object.values(care?.friendships || {}).reduce((sum, value) => sum + Math.round(clamp(Number(value) || 0, 0, 9999)), 0);
}

function totalPlaydates(care) {
  return Math.round(clamp(Number(care?.actionCounts?.playdate) || 0, 0, 999999));
}

function totalDuoMoves(care) {
  return Math.round(clamp(Number(care?.actionCounts?.duoMove) || 0, 0, 999999));
}

function totalPackEvents(care) {
  return Math.round(clamp(Number(care?.actionCounts?.packEvent) || 0, 0, 999999));
}

function packEventCount(care, eventId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`pack:${eventId}`]) || 0, 0, 999999));
}

function totalContestRuns(care) {
  return Math.round(clamp(Number(care?.actionCounts?.contestRun) || 0, 0, 999999));
}

function contestRunCount(care, contestId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`contest:${contestId}`]) || 0, 0, 999999));
}

function contestBestScore(care, contestId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`contestBest:${contestId}`]) || 0, 0, 999999));
}

function contestScoreFor(care, contest, options = {}) {
  const weights = contest?.weights || {};
  const safeCare = care || normalizeCare(null);
  const score =
    safeCare.training * (weights.training || 0) +
    safeCare.energy * (weights.energy || 0) +
    safeCare.happiness * (weights.happiness || 0) +
    safeCare.hygiene * (weights.hygiene || 0) +
    Math.min(safeCare.bond || 0, 260) * (weights.bond || 0) +
    safeCare.level * (weights.level || 0) +
    Math.min(totalPetCommands(safeCare), 32) * (weights.commands || 0) +
    Math.min(totalTrickUses(safeCare), 32) * (weights.tricks || 0) +
    Math.min(totalTrickMastery(safeCare), 32) * (weights.mastery || 0) +
    Math.min(totalCareRoutines(safeCare), 32) * (weights.routines || 0) +
    Math.min(totalFavoriteSnacks(safeCare), 32) * (weights.snacks || 0) +
    Math.min(totalFriendshipScore(safeCare), 360) * (weights.friendship || 0) +
    Math.min(totalDuoMoves(safeCare), 32) * (weights.duo || 0) +
    Math.min(totalPackEvents(safeCare), 32) * (weights.pack || 0) +
    Math.min(totalPlaydates(safeCare), 32) * (weights.playdates || 0);
  const variance = options.random ? rand(-6, 18) : 0;
  return Math.round(clamp(score + variance, 0, 260));
}

function contestTierFor(score) {
  if (score >= 180) return { id: "master", key: "contestMaster", multiplier: 2.3, color: "#a78bfa" };
  if (score >= 130) return { id: "gold", key: "contestGold", multiplier: 1.8, color: "#facc15" };
  if (score >= 85) return { id: "silver", key: "contestSilver", multiplier: 1.35, color: "#94a3b8" };
  return { id: "bronze", key: "contestBronze", multiplier: 1, color: "#fb923c" };
}

function contestReady(pet, contest) {
  const care = careForPet(pet);
  if ((care.level || 1) < contest.minLevel) return { ok: false, reason: "level", care };
  if ((care.energy || 0) < contest.energyCost + 2) return { ok: false, reason: "energy", care };
  return { ok: true, care };
}

function contestRewardFor(contest, score, tier) {
  const base = contest?.reward || {};
  const multiplier = tier?.multiplier || 1;
  return {
    coins: Math.round((base.coins || 0) * multiplier + score / 14),
    xp: Math.round((base.xp || 0) * multiplier + score / 20),
    happiness: Math.round((base.happiness || 0) * multiplier),
    hygiene: Math.round((base.hygiene || 0) * multiplier),
    training: Math.round((base.training || 0) * multiplier),
    bond: Math.round((base.bond || 0) * multiplier),
  };
}

function contestLine(character, contest, score, tier, reward, completedQuests) {
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(contest.labelKey)} 결과 ${careText(tier.key)}. ${careText("contestScore")} ${score}. ${careText("contestReward")} ${packRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} ${careText(contest.labelKey)} finished at ${careText(tier.key)}. ${careText("contestScore")} ${score}. ${careText("contestReward")} ${packRewardText(reward)}${quest}`;
}

function totalDesktopObjects(care) {
  return Math.round(clamp(Number(care?.actionCounts?.desktopObject) || 0, 0, 999999));
}

function desktopObjectCount(care, objectId) {
  return Math.round(clamp(Number(care?.actionCounts?.[`desktopObject:${objectId}`]) || 0, 0, 999999));
}

function duoMoveReady(pet, other, move) {
  const friendship = friendshipScore(pet, other);
  const care = careForPet(pet);
  const otherCare = careForPet(other);
  if (friendship < move.minFriendship) return { ok: false, reason: "friendship", friendship };
  if (care.energy < move.energyCost + 3 || otherCare.energy < move.energyCost + 3) return { ok: false, reason: "energy", friendship };
  return { ok: true, friendship };
}

function duoRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function packRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function activePackMembers(anchorPet, event = null) {
  const members = pets
    .filter((pet) => pet?.enabled)
    .map((pet) => ({
      pet,
      score: pet.slotIndex === anchorPet?.slotIndex ? 99999 : friendshipScore(anchorPet, pet),
      energy: careForPet(pet).energy,
    }))
    .sort((a, b) => b.score - a.score || b.energy - a.energy)
    .map((item) => item.pet);
  const limit = event?.minMembers >= 3 ? 4 : 3;
  return members.slice(0, limit);
}

function packEventReady(anchorPet, event) {
  const members = activePackMembers(anchorPet, event);
  if (members.length < event.minMembers) return { ok: false, reason: "members", members };
  const tired = members.find((member) => careForPet(member).energy < event.energyCost + 2);
  if (tired) return { ok: false, reason: "energy", members };
  return { ok: true, members };
}

function packEventLine(character, event, members, reward, completedQuests) {
  const quest = questRewardLine(completedQuests);
  const memberNames = members.map((member) => characterFor(member.characterId).name).join(", ");
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(event.labelKey)} 완료. ${careText("packMembers")} ${members.length}: ${memberNames}. ${careText("packReward")} ${packRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} ${careText(event.labelKey)} complete. ${careText("packMembers")} ${members.length}: ${memberNames}. ${careText("packReward")} ${packRewardText(reward)}${quest}`;
}

function duoUnavailableLine(character, otherCharacter, move, reason, friendship = 0) {
  if (currentLanguage() === "ko") {
    if (reason === "friendship") {
      return `${localStyleFor(character.id)} ${otherCharacter.name}와 ${careText(move.labelKey)} 하려면 친밀도 ${move.minFriendship} 필요. 지금 ${friendship}.`;
    }
    return `${localStyleFor(character.id)} ${careText("duoNeedEnergy")} · ${careText(move.labelKey)} -${move.energyCost}.`;
  }
  if (reason === "friendship") {
    return `${localStyleFor(character.id)} Need bond ${move.minFriendship} with ${otherCharacter.name} for ${careText(move.labelKey)}. Now ${friendship}.`;
  }
  return `${localStyleFor(character.id)} ${careText("duoNeedEnergy")} · ${careText(move.labelKey)} -${move.energyCost}.`;
}

function duoMoveLine(character, otherCharacter, move, friendship, reward, completedQuests) {
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${otherCharacter.name}와 ${careText(move.labelKey)} 성공. 관계 ${friendshipLabel(friendship)} ${friendship}. ${duoRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} ${careText(move.labelKey)} with ${otherCharacter.name}. Friendship ${friendshipLabel(friendship)} ${friendship}. ${duoRewardText(reward)}${quest}`;
}

function desktopObjectRewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.hunger) parts.push(`+${reward.hunger} ${careText("hunger")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`${reward.energy > 0 ? "+" : ""}${reward.energy} ${careText("energy")}`);
  if (reward.hygiene) parts.push(`+${reward.hygiene} ${careText("hygiene")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function desktopObjectThrowLine(character, object) {
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(object.labelKey)} 던졌어. 잡으러 간다.`;
  }
  return `${localStyleFor(character.id)} Threw ${careText(object.labelKey)}. Going to catch it.`;
}

function desktopObjectCatchLine(character, object, reward, completedQuests) {
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(object.labelKey)} 잡았어. ${desktopObjectRewardText(reward)}${quest}`;
  }
  return `${localStyleFor(character.id)} Caught ${careText(object.labelKey)}. ${desktopObjectRewardText(reward)}${quest}`;
}

function claimedGrowthRewardSet(care) {
  return new Set(Array.isArray(care?.growthRewards) ? care.growthRewards : []);
}

function totalGrowthRewards(care) {
  return claimedGrowthRewardSet(care).size;
}

function growthRewardEffects(care = null) {
  const effects = { speed: 1, xp: 1, care: {}, burst: 0, colors: [], motion: { playKick: 0, trainKick: 0 } };
  for (const rewardId of claimedGrowthRewardSet(care)) {
    const effect = GROWTH_REWARDS[rewardId]?.effect || {};
    if (Number.isFinite(effect.speed)) effects.speed *= effect.speed;
    if (Number.isFinite(effect.xp)) effects.xp *= effect.xp;
    if (Number.isFinite(effect.burst)) effects.burst += effect.burst;
    for (const color of Array.isArray(effect.colors) ? effect.colors : []) {
      if (typeof color === "string" && color) effects.colors.push(color);
    }
    for (const [key, value] of Object.entries(effect.motion || {})) {
      if (!Number.isFinite(value)) continue;
      effects.motion[key] = (effects.motion[key] || 0) + value;
    }
    for (const [actionId, bonus] of Object.entries(effect.care || {})) {
      effects.care[actionId] = effects.care[actionId] || {};
      for (const [key, value] of Object.entries(bonus || {})) {
        if (!Number.isFinite(value)) continue;
        effects.care[actionId][key] = (effects.care[actionId][key] || 0) + value;
      }
    }
  }
  effects.speed = clamp(effects.speed, 0.96, 1.16);
  effects.xp = clamp(effects.xp, 1, 1.14);
  effects.burst = Math.round(clamp(effects.burst, 0, 12));
  effects.motion.playKick = clamp(effects.motion.playKick || 0, 0, 1.2);
  effects.motion.trainKick = clamp(effects.motion.trainKick || 0, 0, 1.2);
  effects.colors = Array.from(new Set(effects.colors)).slice(0, 6);
  return effects;
}

function growthRewardProgress(reward, pet, care = careForPet(pet), game = ensureGame()) {
  const value = Math.round(clamp(Number(reward.value({ pet, care, game })) || 0, 0, 999999));
  const target = Math.max(1, Math.round(reward.target || 1));
  return {
    value,
    target,
    done: value >= target,
    percent: clamp((value / target) * 100, 0, 100),
  };
}

function growthRewardText(reward) {
  const data = reward.reward || {};
  const parts = [];
  if (data.coins) parts.push(`+${data.coins} ${careText("coins")}`);
  if (data.xp) parts.push(`+${data.xp} ${careText("xp")}`);
  if (data.happiness) parts.push(`+${data.happiness} ${careText("happiness")}`);
  if (data.energy) parts.push(`+${data.energy} ${careText("energy")}`);
  if (data.training) parts.push(`+${data.training} ${careText("training")}`);
  if (data.bond) parts.push(`+${data.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function growthRewardEffectText(reward) {
  const effect = reward?.effect || {};
  const parts = [];
  if (Number.isFinite(effect.speed)) {
    const percent = Math.round((effect.speed - 1) * 100);
    if (percent) parts.push(`${percent > 0 ? "+" : ""}${percent}% ${careText("roam")}`);
  }
  if (Number.isFinite(effect.xp)) {
    const percent = Math.round((effect.xp - 1) * 100);
    if (percent) parts.push(`${percent > 0 ? "+" : ""}${percent}% ${careText("xp")}`);
  }
  if (Number.isFinite(effect.burst) && effect.burst > 0) {
    parts.push(`+${Math.round(effect.burst)} ${careText("growthRewardBurst")}`);
  }
  const motion = effect.motion || {};
  if ((Number(motion.playKick) || 0) > 0 || (Number(motion.trainKick) || 0) > 0) {
    parts.push(careText("growthRewardMotion"));
  }
  for (const [actionId, bonus] of Object.entries(effect.care || {})) {
    for (const [key, value] of Object.entries(bonus || {})) {
      if (!Number.isFinite(value) || value === 0) continue;
      parts.push(`${careText(actionId)} +${value} ${careText(key)}`);
    }
  }
  return parts.join(" · ") || growthRewardText(reward);
}

function growthRewardCareLine(care, actionId) {
  const matching = Array.from(claimedGrowthRewardSet(care))
    .map((rewardId) => ({ id: rewardId, ...GROWTH_REWARDS[rewardId] }))
    .filter((reward) => reward.effect?.care?.[actionId])
    .map((reward) => careText(reward.labelKey))
    .slice(0, 2);
  if (!matching.length) return "";
  return currentLanguage() === "ko"
    ? ` ${careText("growthRewardsTitle")} ${matching.join(" · ")} 해금 효과.`
    : ` ${careText("growthRewardsTitle")} unlock: ${matching.join(" · ")}.`;
}

function growthRewardClaimLine(character, reward, leveled, care) {
  const label = careText(reward.labelKey);
  const rewardText = growthRewardText(reward);
  const unlockText = growthRewardEffectText(reward);
  if (currentLanguage() === "ko") {
    const levelText = leveled ? ` 레벨 ${care.level} 달성!` : "";
    return `${localStyleFor(character.id)} ${label} 성장 보상 받았어. ${rewardText}. ${careText("growthRewardUnlock")} ${unlockText}${levelText}`;
  }
  const levelText = leveled ? ` Reached level ${care.level}!` : "";
  return `${localStyleFor(character.id)} Claimed ${label}. ${rewardText}. ${careText("growthRewardUnlock")} ${unlockText}${levelText}`;
}

function claimGrowthReward(pet, rewardId) {
  const reward = GROWTH_REWARDS[rewardId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!reward || !slot) return;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const claimed = claimedGrowthRewardSet(care);
  const progress = growthRewardProgress(reward, pet, care, game);
  if (claimed.has(rewardId) || !progress.done) {
    showPetThought(pet, `${careText(reward.labelKey)} · ${progress.value}/${progress.target}`, { durationMs: 3200 });
    return;
  }

  const data = reward.reward || {};
  game.coins = Math.round(clamp(game.coins + (data.coins || 0), 0, 999999));
  if (data.happiness) care.happiness = Math.round(clamp(care.happiness + data.happiness, 0, 100));
  if (data.energy) care.energy = Math.round(clamp(care.energy + data.energy, 0, 100));
  if (data.training) care.training = Math.round(clamp(care.training + data.training, 0, 100));
  if (data.bond) care.bond = Math.round(clamp(care.bond + data.bond, 0, 9999));
  const leveled = data.xp ? addCareXp(care, data.xp) : false;
  care.growthRewards = [...claimed, rewardId].filter(
    (id, index, list) => GROWTH_REWARD_IDS.includes(id) && list.indexOf(id) === index,
  );
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  settings.game = normalizeGame(game);
  pet.care = slot.care;
  spawnMilestoneBurst(pet);
  const line = growthRewardClaimLine(characterFor(pet.characterId), reward, leveled, slot.care);
  recordMemory(pet, reward.icon, line);
  showPetThought(pet, line, { durationMs: 4800 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function claimedMilestoneSet(game) {
  return new Set(Array.isArray(game?.claimedMilestones) ? game.claimedMilestones : []);
}

function milestoneProgress(milestone, pet, care = careForPet(pet), game = ensureGame()) {
  const value = Math.round(clamp(Number(milestone.value({ pet, care, game })) || 0, 0, 999999));
  const target = Math.max(1, Math.round(milestone.target || 1));
  const done = typeof milestone.done === "function" ? milestone.done({ pet, care, game }) : value >= target;
  return {
    value,
    target,
    done,
    percent: clamp((value / target) * 100, 0, 100),
  };
}

function milestoneRewardText(milestone) {
  const reward = milestone.reward || {};
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} ${careText("coins")}`);
  if (reward.xp) parts.push(`+${reward.xp} ${careText("xp")}`);
  if (reward.bond) parts.push(`+${reward.bond} ${careText("bond")}`);
  if (reward.happiness) parts.push(`+${reward.happiness} ${careText("happiness")}`);
  if (reward.energy) parts.push(`+${reward.energy} ${careText("energy")}`);
  if (reward.training) parts.push(`+${reward.training} ${careText("training")}`);
  return parts.join(" · ");
}

function milestoneClaimLine(character, milestone) {
  const reward = milestoneRewardText(milestone);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${careText(milestone.labelKey)} 목표 보상 받았어. ${reward}`;
  }
  return `${localStyleFor(character.id)} Claimed ${careText(milestone.labelKey)}. ${reward}`;
}

function claimMilestone(pet, milestoneId) {
  const milestone = MILESTONE_DEFS.find((item) => item.id === milestoneId);
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!milestone || !slot) return;
  const game = ensureGame();
  const claimed = claimedMilestoneSet(game);
  const care = careForPet(pet, { decay: true });
  const progress = milestoneProgress(milestone, pet, care, game);
  if (claimed.has(milestoneId) || !progress.done) {
    showPetThought(pet, `${careText(milestone.labelKey)} · ${progress.value}/${progress.target}`, { durationMs: 3200 });
    return;
  }

  const reward = milestone.reward || {};
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  if (reward.bond) care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
  if (reward.happiness) care.happiness = Math.round(clamp(care.happiness + reward.happiness, 0, 100));
  if (reward.training) care.training = Math.round(clamp(care.training + reward.training, 0, 100));
  if (reward.xp) addCareXp(care, reward.xp);
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  game.claimedMilestones = [...game.claimedMilestones, milestoneId].filter(
    (id, index, list) => MILESTONE_IDS.includes(id) && list.indexOf(id) === index,
  );
  slot.care = normalizeCare(care);
  settings.game = normalizeGame(game);
  pet.care = slot.care;
  spawnMilestoneBurst(pet);
  const line = milestoneClaimLine(characterFor(pet.characterId), milestone);
  recordMemory(pet, milestone.icon, line);
  showPetThought(pet, line, { durationMs: 4600 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function trickReply(character, trick, care, leveled, extra = "") {
  const trickName = careText(trick.labelKey);
  const stage = careText(careStage(care));
  if (currentLanguage() === "ko") {
    const levelText = leveled ? ` 레벨 ${care.level} 달성!` : "";
    return `${localStyleFor(character.id)} ${stage} ${character.name}가 ${trickName} 성공.${levelText}${extra}`;
  }
  const levelText = leveled ? ` Reached level ${care.level}!` : "";
  return `${localStyleFor(character.id)} ${stage} ${character.name} performed ${trickName}.${levelText}${extra}`;
}

function expeditionReply(character, expedition, care, leveled, extra = "") {
  const expeditionName = careText(expedition.labelKey);
  const stage = careText(careStage(care));
  if (currentLanguage() === "ko") {
    const levelText = leveled ? ` 레벨 ${care.level} 달성!` : "";
    return `${localStyleFor(character.id)} ${stage} ${character.name}가 ${expeditionName} 완료.${levelText}${extra}`;
  }
  const levelText = leveled ? ` Reached level ${care.level}!` : "";
  return `${localStyleFor(character.id)} ${stage} ${character.name} completed ${expeditionName}.${levelText}${extra}`;
}

function signatureRewardText(action) {
  const parts = [];
  if (action.xp) parts.push(`+${action.xp} ${careText("xp")}`);
  if (action.happiness) parts.push(`+${action.happiness} ${careText("happiness")}`);
  if (action.training) parts.push(`+${action.training} ${careText("training")}`);
  if (action.bond) parts.push(`+${action.bond} ${careText("bond")}`);
  return parts.join(" · ");
}

function signatureReply(character, action, care, leveled, completedQuests) {
  const stage = careText(careStage(care));
  const quest = questRewardLine(completedQuests);
  const levelText = leveled
    ? currentLanguage() === "ko" ? ` 레벨 ${care.level} 달성!` : ` Reached level ${care.level}!`
    : "";
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} ${stage} ${character.name}가 ${signatureName(action)} 성공. ${signatureRewardText(action)}.${levelText}${quest}`;
  }
  return `${localStyleFor(character.id)} ${stage} ${character.name} used ${signatureName(action)}. ${signatureRewardText(action)}.${levelText}${quest}`;
}

function applyCareDecay(care, now = Date.now()) {
  const last = Number(care.lastCareAt) || now;
  const hours = clamp((now - last) / 3600000, 0, 72);
  if (hours < 0.03) {
    care.lastCareAt = now;
    return false;
  }
  care.hunger = Math.round(clamp(care.hunger - hours * 7.5, 0, 100));
  care.happiness = Math.round(clamp(care.happiness - hours * 4.2, 0, 100));
  care.hygiene = Math.round(clamp(care.hygiene - hours * 3.6, 0, 100));
  care.energy = Math.round(clamp(care.energy + hours * 5.5, 0, 100));
  care.lastCareAt = now;
  return true;
}

function careForPet(pet, options = {}) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return normalizeCare(null);
  slot.care = normalizeCare(slot.care);
  if (options.decay) applyCareDecay(slot.care, Date.now());
  return slot.care;
}

function recordMemory(pet, icon, text) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot || !text) return;
  const care = careForPet(pet);
  const memory = normalizeMemory({ at: Date.now(), icon, text });
  if (!memory) return;
  care.memories = [memory, ...(care.memories || [])].slice(0, CARE_MEMORY_LIMIT);
  slot.care = normalizeCare(care);
  pet.care = slot.care;
}

function friendshipScore(pet, other) {
  const care = careForPet(pet);
  return Math.round(clamp(care.friendships?.[friendshipKey(other.slotIndex)] || 0, 0, 9999));
}

function friendshipLabel(score) {
  if (score >= 120) return careText("friendBest");
  if (score >= 64) return careText("friendClose");
  if (score >= 24) return careText("friendPal");
  return careText("friendNew");
}

function boostFriendship(a, b, amount) {
  if (!a || !b || a.slotIndex === b.slotIndex) return 0;
  const gain = Math.round(clamp(amount, 1, 40));
  for (const [pet, other] of [[a, b], [b, a]]) {
    const slot = settings?.slots?.[pet.slotIndex];
    if (!slot) continue;
    const care = careForPet(pet);
    const key = friendshipKey(other.slotIndex);
    care.friendships[key] = Math.round(clamp((care.friendships[key] || 0) + gain, 0, 9999));
    slot.care = normalizeCare(care);
    pet.care = slot.care;
  }
  return friendshipScore(a, b);
}

function bestSynergyFriend(pet) {
  if (!pet) return null;
  return pets
    .filter((other) => other?.enabled && other.slotIndex !== pet.slotIndex)
    .map((other) => ({
      pet: other,
      character: characterFor(other.characterId),
      score: friendshipScore(pet, other),
    }))
    .sort((a, b) => b.score - a.score || a.character.name.localeCompare(b.character.name))[0] || null;
}

function petSynergyRequirementValues(pet, care, game, synergy) {
  const safeCare = care || careForPet(pet);
  const safeGame = normalizeGame(game);
  const friend = bestSynergyFriend(pet);
  return {
    friend,
    friendship: friend?.score || 0,
    careActions: totalCareActions(safeCare),
    training: safeCare.training || 0,
    commands: totalPetCommands(safeCare),
    roomComfort: habitatComfortScore(safeGame),
    routines: totalCareRoutines(safeCare),
    patrols: totalPatrolRuns(safeCare),
    collections: collectionUniqueCount(safeGame),
    duo: totalDuoMoves(safeCare),
    pack: totalPackEvents(safeCare),
    caretaker: caretakerRankFor(safeGame).stats.score,
    requirement: synergy?.requirement || {},
  };
}

function petSynergyUnlocked(pet, care, game, synergy) {
  const values = petSynergyRequirementValues(pet, care, game, synergy);
  return Object.entries(values.requirement).every(([key, target]) => (values[key] || 0) >= target);
}

function petSynergyRequirementText(pet, care, game, synergy) {
  const values = petSynergyRequirementValues(pet, care, game, synergy);
  const labels = {
    friendship: careText("friendClose"),
    careActions: careText("careTitle"),
    training: careText("training"),
    commands: careText("commandTitle"),
    roomComfort: careText("habitatComfort"),
    routines: careText("routineTitle"),
    patrols: careText("patrolTimes"),
    collections: careText("collectionFound"),
    duo: careText("duoTitle"),
    pack: careText("packTitle"),
    caretaker: careText("caretakerRankScore"),
  };
  return Object.entries(values.requirement)
    .map(([key, target]) => `${labels[key] || key} ${Math.min(target, Math.round(values[key] || 0))}/${target}`)
    .join(" · ");
}

function petSynergyEffectText(synergy) {
  const effect = synergy?.effect || {};
  const parts = [];
  if (Number.isFinite(effect.speed)) {
    parts.push(`+${Math.round((effect.speed - 1) * 100)}% ${careText("roam")}`);
  }
  if (Number.isFinite(effect.xp)) {
    parts.push(`+${Math.round((effect.xp - 1) * 100)}% ${careText("xp")}`);
  }
  for (const [key, value] of Object.entries(effect.care || {})) {
    if (!Number.isFinite(value) || value === 0) continue;
    parts.push(`+${value} ${careText(key)}`);
  }
  return parts.join(" · ") || careText("petSynergyEffect");
}

function activePetSynergies(pet, care = careForPet(pet), game = settings?.game || null) {
  return PET_SYNERGY_IDS
    .map((id) => ({ id, ...PET_SYNERGIES[id] }))
    .filter((synergy) => petSynergyUnlocked(pet, care, game, synergy));
}

function totalPetSynergies(pet, care = careForPet(pet), game = settings?.game || null) {
  return activePetSynergies(pet, care, game).length;
}

function petSynergyEffects(pet, care = careForPet(pet), game = settings?.game || null) {
  const effects = { speed: 1, xp: 1, care: {} };
  for (const synergy of activePetSynergies(pet, care, game)) {
    const effect = synergy.effect || {};
    if (Number.isFinite(effect.speed)) effects.speed *= effect.speed;
    if (Number.isFinite(effect.xp)) effects.xp *= effect.xp;
    for (const [key, value] of Object.entries(effect.care || {})) {
      if (!Number.isFinite(value)) continue;
      effects.care[key] = (effects.care[key] || 0) + value;
    }
  }
  effects.speed = clamp(effects.speed, 0.9, 1.12);
  effects.xp = clamp(effects.xp, 1, 1.12);
  return effects;
}

function lifeStoryRequirementValues(pet, care, game, chapter) {
  const safeCare = care || careForPet(pet);
  const safeGame = normalizeGame(game);
  const path = growthPathFor(safeCare, safeGame);
  return {
    level: safeCare.level || 1,
    bond: safeCare.bond || 0,
    training: safeCare.training || 0,
    careActions: totalCareActions(safeCare),
    memories: (safeCare.memories || []).length,
    tricks: totalTrickUses(safeCare),
    commands: totalPetCommands(safeCare),
    roomComfort: habitatComfortScore(safeGame),
    collections: collectionUniqueCount(safeGame),
    synergies: totalPetSynergies(pet, safeCare, safeGame),
    growthScore: path.score,
    forms: totalEvolutionForms(safeCare),
    specials: totalSignatureActions(safeCare),
    requirement: chapter?.requirement || {},
  };
}

function lifeStoryChapterUnlocked(pet, care, game, chapter) {
  const values = lifeStoryRequirementValues(pet, care, game, chapter);
  return Object.entries(values.requirement).every(([key, target]) => (values[key] || 0) >= target);
}

function lifeStoryRequirementText(pet, care, game, chapter) {
  const values = lifeStoryRequirementValues(pet, care, game, chapter);
  const labels = {
    level: careText("level"),
    bond: careText("bond"),
    training: careText("training"),
    careActions: careText("careTitle"),
    memories: careText("memoriesTitle"),
    tricks: careText("tricksTitle"),
    commands: careText("commandTitle"),
    roomComfort: careText("habitatComfort"),
    collections: careText("collectionFound"),
    synergies: careText("petSynergyTitle"),
    growthScore: careText("growthScore"),
    forms: careText("evolutionTitle"),
    specials: careText("specialTitle"),
  };
  return Object.entries(values.requirement)
    .map(([key, target]) => `${labels[key] || key} ${Math.min(target, Math.round(values[key] || 0))}/${target}`)
    .join(" · ");
}

function activeLifeStoryChapters(pet, care = careForPet(pet), game = settings?.game || null) {
  return LIFE_STORY_CHAPTER_IDS
    .map((id) => ({ id, ...LIFE_STORY_CHAPTERS[id] }))
    .filter((chapter) => lifeStoryChapterUnlocked(pet, care, game, chapter));
}

function currentLifeStoryChapter(pet, care = careForPet(pet), game = settings?.game || null) {
  return activeLifeStoryChapters(pet, care, game).pop() || { id: "firstSteps", ...LIFE_STORY_CHAPTERS.firstSteps };
}

function totalLifeStoryChapters(pet, care = careForPet(pet), game = settings?.game || null) {
  return activeLifeStoryChapters(pet, care, game).length;
}

function addCareXp(care, amount) {
  let leveled = false;
  care.xp += Math.max(0, Math.round(amount));
  while (care.xp >= careThreshold(care.level) && care.level < 99) {
    care.xp -= careThreshold(care.level);
    care.level += 1;
    care.bond = Math.round(clamp(care.bond + 3, 0, 9999));
    care.happiness = Math.round(clamp(care.happiness + 8, 0, 100));
    leveled = true;
  }
  return leveled;
}

function carePhrase(actionId) {
  const lines = CARE_LINE_PARTS[actionId]?.[currentLanguage()] || CARE_LINE_PARTS[actionId]?.en || [];
  return lines[Math.floor(Math.random() * lines.length)] || actionId;
}

function careReply(character, actionId, care, leveled, personality = null) {
  const language = currentLanguage();
  const phrase = carePhrase(actionId);
  const mood = careText(careMood(care));
  const stage = careText(careStage(care));
  const bonus = personalityBonusLine(personality, actionId);
  if (language === "ko") {
    const levelText = leveled ? ` 레벨 ${care.level} 됐어!` : "";
    return `${localStyleFor(character.id)} ${phrase}. ${stage} ${character.name} 기분은 ${mood}.${bonus}${levelText}`;
  }
  const levelText = leveled ? ` Reached level ${care.level}!` : "";
  return `${localStyleFor(character.id)} ${phrase}. ${stage} ${character.name} feels ${mood}.${bonus}${levelText}`;
}

function spawnCareBurst(pet, actionId) {
  const palette = {
    feed: "#facc15",
    play: "#38bdf8",
    pet: "#fb7185",
    clean: "#7dd3fc",
    train: "#a78bfa",
    nap: "#c4b5fd",
  };
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10 + rand(-0.2, 0.2);
    pushEffectParticle({
      type: actionId === "clean" ? "bubble" : "spark",
      x: cx + rand(-5, 5),
      y: cy + rand(-5, 5),
      dx: Math.cos(angle) * rand(24, 54),
      dy: Math.sin(angle) * rand(18, 48),
      size: rand(5, 9),
      color: palette[actionId] || "#ffe76b",
      alpha: 0.9,
      born: now,
      life: actionId === "nap" ? 780 : 560,
    });
  }
  spawnGrowthRewardBurst(pet, actionId, now);
  spawnCareQuirkBurst(pet, actionId, now);
  spawnCareQuirkComboBurst(pet, actionId, now);
}

function spawnGrowthRewardBurst(pet, actionId, born = performance.now()) {
  const effects = growthRewardEffects(pet?.care || careForPet(pet));
  if (!effects.burst) return;
  const baseColors = {
    feed: "#facc15",
    play: "#38bdf8",
    pet: "#fb7185",
    clean: "#7dd3fc",
    train: "#a78bfa",
    nap: "#c4b5fd",
  };
  const colors = effects.colors.length ? effects.colors : [baseColors[actionId] || "#ffe76b"];
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const count = Math.min(12, effects.burst);
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + rand(-0.85, 0.85);
    pushEffectParticle({
      type: i % 3 === 0 ? "pixel" : "spark",
      x: cx + rand(-7, 7),
      y: cy + rand(-6, 8),
      dx: Math.cos(angle) * rand(18, 44),
      dy: Math.sin(angle) * rand(26, 62),
      size: rand(4, 7),
      color: colors[i % colors.length],
      alpha: 0.78,
      born,
      life: rand(520, 820),
    });
  }
}

function spawnCareQuirkBurst(pet, actionId = "", born = performance.now(), quirk = null) {
  const effects = careQuirkEffects(pet?.care || careForPet(pet));
  if (!effects.burst && !quirk) return;
  const colors = quirk?.color ? [quirk.color] : effects.colors.length ? effects.colors : ["#42d7c5"];
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const count = quirk ? 7 : Math.min(12, effects.burst);
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / Math.max(1, count) + rand(-0.22, 0.22);
    pushEffectParticle({
      type: actionId === "clean" || i % 4 === 0 ? "bubble" : "pixel",
      x: cx + rand(-8, 8),
      y: cy + rand(-8, 8),
      dx: Math.cos(angle) * rand(18, 48),
      dy: Math.sin(angle) * rand(18, 48),
      size: rand(4, 7),
      color: colors[i % colors.length],
      alpha: 0.76,
      born,
      life: rand(540, 840),
    });
  }
}

function spawnCareQuirkComboBurst(pet, actionId = "", born = performance.now(), combo = null) {
  const effects = careQuirkComboEffects(pet?.care || careForPet(pet));
  if (!effects.burst && !combo) return;
  const colors = combo?.color ? [combo.color] : effects.colors.length ? effects.colors : ["#facc15"];
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const count = combo ? 9 : Math.min(12, effects.burst);
  for (let i = 0; i < count; i += 1) {
    const spread = (i - (count - 1) / 2) / Math.max(1, count - 1);
    pushEffectParticle({
      type: i % 2 === 0 ? "spark" : "pixel",
      x: cx + rand(-8, 8),
      y: cy + rand(-6, 9),
      dx: spread * rand(34, 72),
      dy: -rand(24, 62) + Math.abs(spread) * rand(8, 26),
      size: rand(4, 8),
      color: colors[i % colors.length],
      alpha: 0.8,
      born,
      life: rand(560, 920),
    });
  }
}

function spawnMoodAuraBurst(pet, moodId) {
  const aura = moodAuraFor(moodId);
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const count = moodId === "bright" ? 18 : 14;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.18, 0.18);
    const radius = rand(size * 0.24, size * 0.68);
    pushEffectParticle({
      type: aura.particle || "spark",
      x: cx + Math.cos(angle) * rand(4, 10),
      y: cy + Math.sin(angle) * rand(4, 10),
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
      size: rand(4, 9),
      color: aura.color,
      alpha: moodId === "calm" || moodId === "sleepy" ? 0.76 : 0.9,
      born: now,
      life: moodId === "sleepy" ? 920 : 680,
    });
  }
  showPetThinking(pet, aura.icon, { durationMs: 980 });
}

function spawnTalentBurst(pet, talentId) {
  const talent = talentFor(talentId);
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI * 2 * i) / 16 + rand(-0.16, 0.16);
    const power = talentId === "agility" ? rand(28, 72) : talentId === "focus" ? rand(18, 48) : rand(20, 58);
    pushEffectParticle({
      type: talentId === "focus" ? "pixel" : i % 3 === 0 ? "spark" : "burst",
      x: cx + rand(-7, 7),
      y: cy + rand(-7, 7),
      dx: Math.cos(angle) * power,
      dy: Math.sin(angle) * power,
      size: rand(4, 8),
      color: talent.color,
      alpha: 0.88,
      born: now,
      life: talentId === "focus" ? 820 : 650,
    });
  }
  showPetThinking(pet, talent.icon, { durationMs: 900 });
}

function runTalentMotion(pet, talentId) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 1500;
  if (talentId === "agility") {
    const dir = pet.direction >= 0 ? 1 : -1;
    pet.vx += dir * rand(2.4, 3.8);
    pet.vy += rand(-1.6, 1.6);
    pet.spinVelocity += rand(-18, 18);
    pet.targetX = clamp(pet.x + dir * rand(150, 260), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-120, 120), 0, maxY);
  } else if (talentId === "focus") {
    pet.vx *= 0.42;
    pet.vy *= 0.42;
    pet.spinVelocity += rand(-6, 6);
    pet.replySlowUntil = now + 1900;
  } else {
    pet.vx += rand(-1.3, 1.3);
    pet.vy += rand(-1.0, 1.0);
    pet.spinVelocity += rand(-12, 12);
    pet.targetX = clamp(pet.x + rand(-130, 130), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-90, 90), 0, maxY);
  }
}

function spawnTinyJobBurst(pet, jobId, foundItem = null) {
  const job = tinyJobFor(jobId);
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const count = foundItem ? 22 : 16;
  for (let i = 0; i < count; i += 1) {
    const angle = jobId === "joyShow"
      ? (Math.PI * 2 * i) / count + rand(-0.12, 0.12)
      : -Math.PI / 2 + rand(-0.9, 0.9);
    const power = jobId === "deskHelper" ? rand(16, 44) : rand(24, 68);
    pushEffectParticle({
      type: foundItem && i % 4 === 0 ? "spark" : jobId === "deskHelper" ? "pixel" : "burst",
      x: cx + rand(-8, 8),
      y: cy + rand(-8, 8),
      dx: Math.cos(angle) * power,
      dy: Math.sin(angle) * power,
      size: rand(4, foundItem ? 10 : 8),
      color: foundItem && i % 4 === 0 ? "#facc15" : job.color,
      alpha: 0.9,
      born: now,
      life: foundItem ? 820 : 660,
    });
  }
  showPetThinking(pet, foundItem?.icon || job.icon, { durationMs: foundItem ? 1250 : 900 });
}

function runTinyJobMotion(pet, jobId) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 1700;
  if (jobId === "pocketScout") {
    const dir = pet.direction >= 0 ? 1 : -1;
    pet.vx += dir * rand(1.8, 3.2);
    pet.vy += rand(-0.8, 0.8);
    pet.spinVelocity += rand(-8, 8);
    pet.targetX = clamp(pet.x + dir * rand(180, 320), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-80, 80), 0, maxY);
  } else if (jobId === "deskHelper") {
    pet.vx *= 0.35;
    pet.vy *= 0.35;
    pet.spinVelocity += rand(-5, 5);
    pet.replySlowUntil = now + 1800;
    pet.targetX = clamp(pet.x + rand(-60, 60), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-40, 40), 0, maxY);
  } else {
    pet.vx += rand(-1.8, 1.8);
    pet.vy -= rand(0.7, 2.0);
    pet.spinVelocity += rand(-24, 24);
    pet.targetX = clamp(pet.x + rand(-150, 150), 0, maxX);
    pet.targetY = clamp(pet.y - rand(40, 130), 0, maxY);
  }
  pet.nextTargetAt = now + 2200;
}

function spawnToyBurst(pet, toyId) {
  const toy = TOYS[toyId];
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 14; i += 1) {
    const angle = -Math.PI / 2 + rand(-1.1, 1.1);
    const distance = rand(18, 58);
    pushEffectParticle({
      type: i % 3 === 0 ? "spark" : "pixel",
      x: cx + rand(-6, 6),
      y: cy + rand(-6, 6),
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: rand(4, 8),
      color: toy?.effect || "#ffe76b",
      alpha: 0.92,
      born: now,
      life: 680,
    });
  }
}

function spawnEffectBurst(pet, effectId) {
  const effect = TRAIL_STYLES[effectId] || TRAIL_STYLES.normal;
  const colors = effect.colors?.length ? effect.colors : ["#42d7c5"];
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 18; i += 1) {
    const angle = -Math.PI / 2 + rand(-1.6, 1.6);
    pushEffectParticle({
      type: effect.mode === "bubble" ? "bubble" : effect.mode === "rainbow" ? "rainbow" : i % 2 === 0 ? "spark" : "pixel",
      x: cx + rand(-10, 10),
      y: cy + rand(-10, 10),
      dx: Math.cos(angle) * rand(20, 68),
      dy: Math.sin(angle) * rand(22, 82),
      size: rand(4, 9),
      color: colors[i % colors.length],
      alpha: 0.86,
      born: now,
      life: rand(680, 1050),
    });
  }
}

function runToyPlayMotion(pet, toyId) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  pet.pausedByPanel = false;
  if (toyId === "ball") {
    pet.vx += rand(-3.0, 3.0);
    pet.vy -= rand(2.2, 4.0);
    pet.spinVelocity += rand(-36, 36);
    pet.targetX = clamp(pet.x + rand(-230, 230), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-160, 120), 0, maxY);
  } else if (toyId === "rocketSnack") {
    const dir = pet.direction >= 0 ? 1 : -1;
    pet.vx += dir * 4.4;
    pet.vy += rand(-1.4, 1.4);
    pet.targetX = clamp(pet.x + dir * 320, 0, maxX);
    pet.targetY = clamp(pet.y + rand(-120, 120), 0, maxY);
  } else if (toyId === "starBlanket") {
    pet.vx *= 0.35;
    pet.vy *= 0.35;
    pet.replySlowUntil = now + 2600;
    pet.targetX = clamp(pet.x + rand(-70, 70), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-50, 50), 0, maxY);
  } else if (toyId === "brush") {
    pet.spinVelocity += rand(-12, 12);
    pet.vx += rand(-0.8, 0.8);
    pet.vy += rand(-0.8, 0.8);
  } else if (toyId === "bell") {
    pet.spinVelocity += rand(-28, 28);
    pet.vx += rand(-1.8, 1.8);
    pet.vy += rand(-1.5, 1.5);
    pet.targetX = clamp(pet.x + rand(-170, 170), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-110, 110), 0, maxY);
  } else {
    pet.vx += rand(-1.5, 1.5);
    pet.vy += rand(-1.5, 1.5);
    pet.spinVelocity += rand(-22, 22);
  }
  pet.nextTargetAt = now + 2400;
}

function steerPetToDesktopObject(pet, object, now = performance.now()) {
  if (!pet || !object) return;
  const size = getPetSize(pet);
  const { w, h } = viewport();
  pet.pausedByPanel = false;
  pet.aiControlledUntil = Math.max(pet.aiControlledUntil || 0, now + 260);
  pet.targetX = clamp(object.x - size / 2, 0, Math.max(0, w - size));
  pet.targetY = clamp(object.y - size / 2, 0, Math.max(0, h - size));
  pet.nextTargetAt = Math.max(pet.nextTargetAt || 0, now + 320);
}

function spawnDesktopObjectBurst(pet, object) {
  const def = DESKTOP_OBJECTS[object.objectId] || DESKTOP_OBJECTS.bounceBall;
  const now = performance.now();
  const color = def.color || "#42d7c5";
  const x = Number(object.x) || pet.x + getPetSize(pet) / 2;
  const y = Number(object.y) || pet.y + getPetSize(pet) / 2;
  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI * 2 * i) / 16 + rand(-0.16, 0.16);
    pushEffectParticle({
      type: def.kind === "bubble" ? "bubble" : i % 3 === 0 ? "spark" : "pixel",
      x: x + rand(-5, 5),
      y: y + rand(-5, 5),
      dx: Math.cos(angle) * rand(18, 62),
      dy: Math.sin(angle) * rand(16, 54),
      size: rand(4, 8),
      color: i % 2 === 0 ? color : "#facc15",
      alpha: 0.9,
      born: now,
      life: rand(620, 900),
    });
  }
}

function performDesktopObject(pet, objectId) {
  const object = DESKTOP_OBJECTS[objectId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!object || !slot) return;
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  if (care.energy < object.energyCost + 2) {
    showPetThought(pet, `${localStyleFor(character.id)} ${careText("deskObjectNeedEnergy")} · -${object.energyCost}`, {
      durationMs: 3200,
    });
    showPetThinking(pet, object.icon, { durationMs: 900 });
    return;
  }

  const size = getPetSize(pet);
  const { w, h } = viewport();
  const dir = pet.direction >= 0 ? 1 : -1;
  const x = clamp(pet.x + size / 2 + dir * rand(56, 116), 18, Math.max(18, w - 18));
  const y = clamp(pet.y + size / 2 + rand(-56, 48), 18, Math.max(18, h - 18));
  const thrown = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    objectId,
    ownerSlot: pet.slotIndex,
    x,
    y,
    vx: dir * rand(1.2, 2.8),
    vy: object.kind === "bubble" ? rand(-1.6, -0.4) : rand(-2.0, -0.5),
    size: object.kind === "treat" ? 18 : object.kind === "bubble" ? 24 : 22,
    born: performance.now(),
    life: 12000,
    claimed: false,
  };
  desktopObjects.push(thrown);
  if (desktopObjects.length > 8) desktopObjects.splice(0, desktopObjects.length - 8);
  pet.pausedByPanel = false;
  pet.aiControlledUntil = performance.now() + 4200;
  steerPetToDesktopObject(pet, thrown);
  spawnDesktopObjectBurst(pet, thrown);
  showPetThinking(pet, object.icon, { durationMs: 1000 });
  showPetThought(pet, desktopObjectThrowLine(character, object), { durationMs: 2600 });
  effectsDirty = true;
}

function completeDesktopObject(pet, object) {
  if (!pet || !object || object.claimed) return;
  const def = DESKTOP_OBJECTS[object.objectId];
  const slot = settings?.slots?.[pet.slotIndex];
  if (!def || !slot) return;
  object.claimed = true;
  desktopObjects = desktopObjects.filter((item) => item !== object);

  const care = careForPet(pet, { decay: true });
  const reward = def.reward || {};
  care.energy = Math.round(clamp(care.energy - def.energyCost + (reward.energy || 0), 0, 100));
  for (const key of ["hunger", "happiness", "hygiene", "training"]) {
    if (!Number.isFinite(reward[key])) continue;
    care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  care.actionCounts.desktopObject = (care.actionCounts.desktopObject || 0) + 1;
  care.actionCounts[`desktopObject:${object.objectId}`] = (care.actionCounts[`desktopObject:${object.objectId}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  const leveled = addCareXp(care, reward.xp || 0);
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  const game = ensureGame();
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("desktopObject");
  const character = characterFor(pet.characterId);
  const levelText = leveled
    ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!`
    : "";
  const line = `${desktopObjectCatchLine(character, def, reward, completedQuests)}${levelText}`;
  pet.vx += rand(-1.6, 1.6);
  pet.vy -= rand(0.6, 1.8);
  pet.spinVelocity += rand(-24, 24);
  spawnDesktopObjectBurst(pet, object);
  showPetThinking(pet, def.icon, { durationMs: 950 });
  showPetThought(pet, line, { durationMs: 5000 });
  recordMemory(pet, def.icon, line);
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function updateDesktopObjects(now, step) {
  if (!desktopObjects.length) return;
  const { w, h } = viewport();
  for (let index = desktopObjects.length - 1; index >= 0; index -= 1) {
    const object = desktopObjects[index];
    const def = DESKTOP_OBJECTS[object.objectId] || DESKTOP_OBJECTS.bounceBall;
    if (!object || object.claimed || now - object.born > object.life) {
      desktopObjects.splice(index, 1);
      continue;
    }
    const radius = Math.max(8, object.size / 2);
    const gravity = def.kind === "bubble" ? -0.004 : def.kind === "star" ? 0.006 : 0.018;
    object.vy += gravity * step;
    object.vx *= Math.pow(0.992, step);
    object.vy *= Math.pow(def.kind === "bubble" ? 0.992 : 0.986, step);
    object.x += object.vx * step;
    object.y += object.vy * step;

    if (object.x < radius) {
      object.x = radius;
      object.vx = Math.abs(object.vx) * 0.76;
    }
    if (object.x > w - radius) {
      object.x = w - radius;
      object.vx = -Math.abs(object.vx) * 0.76;
    }
    if (object.y < radius) {
      object.y = radius;
      object.vy = Math.abs(object.vy) * 0.72;
    }
    if (object.y > h - radius) {
      object.y = h - radius;
      object.vy = -Math.abs(object.vy) * (def.kind === "ball" ? 0.82 : 0.5);
    }

    const owner = pets.find((pet) => pet.enabled && pet.slotIndex === object.ownerSlot);
    if (!owner) continue;
    steerPetToDesktopObject(owner, object, now);
    const petSize = getPetSize(owner);
    const px = owner.x + petSize / 2;
    const py = owner.y + petSize / 2;
    if (Math.hypot(px - object.x, py - object.y) < Math.max(24, petSize * 0.42 + radius)) {
      completeDesktopObject(owner, object);
    }
  }
  effectsDirty = true;
}

function spawnTrickBurst(pet, trickId) {
  const trick = PET_TRICKS[trickId];
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const color = trickId === "seek" ? "#facc15" : trickId === "dash" ? "#38bdf8" : "#a78bfa";
  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI * 2 * i) / 16;
    pushEffectParticle({
      type: i % 4 === 0 ? "pixel" : "spark",
      x: cx + rand(-7, 7),
      y: cy + rand(-7, 7),
      dx: Math.cos(angle) * rand(18, 62),
      dy: Math.sin(angle) * rand(16, 54),
      size: rand(4, 8),
      color,
      alpha: 0.9,
      born: now,
      life: trickId === "parade" ? 820 : 620,
    });
  }
  if (trick?.icon) {
    showPetThinking(pet, trick.icon, { durationMs: 900 });
  }
}

function spawnExpeditionBurst(pet, expeditionId) {
  const expedition = EXPEDITIONS[expeditionId];
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const color = expeditionId === "treasureRoute" ? "#facc15" : expeditionId === "buddyPatrol" ? "#42d7c5" : "#3a87ff";
  for (let i = 0; i < 14; i += 1) {
    const angle = -Math.PI / 2 + (i / 13) * Math.PI + rand(-0.12, 0.12);
    pushEffectParticle({
      type: i % 3 === 0 ? "spark" : "pixel",
      x: cx + rand(-8, 8),
      y: cy + rand(-8, 8),
      dx: Math.cos(angle) * rand(18, 58),
      dy: Math.sin(angle) * rand(18, 54),
      size: rand(4, 8),
      color,
      alpha: 0.88,
      born: now,
      life: 720,
    });
  }
  if (expedition?.icon) showPetThinking(pet, expedition.icon, { durationMs: 950 });
}

function spawnSignatureBurst(pet, action = signatureActionFor(pet)) {
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const color = action.color || "#42d7c5";
  const count = action.motion === "pulse" ? 20 : 16;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.12, 0.12);
    const power = action.motion === "charge" ? rand(34, 72) : rand(18, 62);
    pushEffectParticle({
      type: i % 4 === 0 ? "burst" : i % 3 === 0 ? "pixel" : "spark",
      x: cx + rand(-8, 8),
      y: cy + rand(-8, 8),
      dx: Math.cos(angle) * power,
      dy: Math.sin(angle) * power,
      size: rand(4, 9),
      color,
      alpha: 0.92,
      born: now,
      life: action.motion === "pulse" ? 760 : 640,
    });
  }
  showPetThinking(pet, action.icon || "SP", { durationMs: 900 });
}

function runSignatureMotion(pet, action = signatureActionFor(pet)) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  const currentSpeed = Math.hypot(pet.vx, pet.vy);
  const baseDirection = currentSpeed > 0.08
    ? { x: pet.vx / currentSpeed, y: pet.vy / currentSpeed }
    : { x: pet.direction >= 0 ? 1 : -1, y: rand(-0.3, 0.3) };
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 1900;

  if (action.motion === "warp") {
    pet.targetX = clamp(pet.x + rand(-320, 320), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-220, 220), 0, maxY);
    pet.x = clamp(pet.targetX + rand(-30, 30), 0, maxX);
    pet.y = clamp(pet.targetY + rand(-30, 30), 0, maxY);
    pet.vx += rand(-2.4, 2.4);
    pet.vy += rand(-1.8, 1.8);
  } else if (action.motion === "launch") {
    pet.targetX = clamp(pet.x + baseDirection.x * 360, 0, maxX);
    pet.targetY = clamp(pet.y + baseDirection.y * 220 - 60, 0, maxY);
    pet.vx += baseDirection.x * 5.4;
    pet.vy += baseDirection.y * 3.4 - 1.8;
    pet.spinVelocity += 10;
  } else if (action.motion === "dash") {
    pet.targetX = clamp(pet.x + baseDirection.x * 300 + rand(-80, 80), 0, maxX);
    pet.targetY = clamp(pet.y + baseDirection.y * 160 + rand(-80, 80), 0, maxY);
    pet.vx += baseDirection.x * 4.2;
    pet.vy += baseDirection.y * 2.6;
  } else if (action.motion === "zigzag") {
    pet.targetX = clamp(pet.x + baseDirection.x * 240 + rand(-90, 90), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-180, 180), 0, maxY);
    pet.vx += baseDirection.x * 3.1;
    pet.vy += rand(-3.2, 3.2);
    pet.spinVelocity += rand(-18, 18);
  } else if (action.motion === "bounce") {
    pet.targetX = clamp(pet.x + rand(-160, 160), 0, maxX);
    pet.targetY = clamp(pet.y - rand(70, 150), 0, maxY);
    pet.vx += rand(-1.5, 1.5);
    pet.vy -= rand(2.4, 4.2);
  } else if (action.motion === "orbit") {
    pet.targetX = clamp(pet.x + rand(-160, 160), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-120, 120), 0, maxY);
    pet.vx += -baseDirection.y * 2.8;
    pet.vy += baseDirection.x * 2.8;
    pet.spinVelocity += 42;
  } else if (action.motion === "spin") {
    pet.targetX = clamp(pet.x + rand(-100, 100), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-90, 90), 0, maxY);
    pet.vx += rand(-1.4, 1.4);
    pet.vy += rand(-1.2, 1.2);
    pet.spinVelocity += 76;
  } else if (action.motion === "scan") {
    pet.targetX = clamp(pet.x + rand(-220, 220), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-150, 150), 0, maxY);
    pet.vx += rand(-1.2, 1.2);
    pet.vy += rand(-1.2, 1.2);
    pet.spinVelocity += 22;
  } else if (action.motion === "climb") {
    const edgeY = Math.random() < 0.5 ? rand(8, Math.max(12, maxY * 0.22)) : rand(Math.max(12, maxY * 0.72), maxY);
    pet.targetX = clamp(pet.x + baseDirection.x * 230 + rand(-70, 70), 0, maxX);
    pet.targetY = clamp(edgeY, 0, maxY);
    pet.vx += baseDirection.x * 2.4;
    pet.vy += (pet.targetY > pet.y ? 1 : -1) * 2.1;
    pet.spinVelocity += rand(-12, 12);
  } else if (action.motion === "charge") {
    pet.targetX = clamp(pet.x + baseDirection.x * 260, 0, maxX);
    pet.targetY = clamp(pet.y + baseDirection.y * 120, 0, maxY);
    pet.vx += baseDirection.x * 3.5;
    pet.vy += baseDirection.y * 1.6;
    pet.spinVelocity += baseDirection.x * 9;
  } else {
    pet.targetX = clamp(pet.x + rand(-120, 120), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-90, 90), 0, maxY);
    pet.spinVelocity += 30;
  }

  pet.nextTargetAt = now + 2300;
}

function runTrickMotion(pet, trickId) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  const direction = Math.hypot(pet.vx, pet.vy) > 0.08
    ? { x: pet.vx, y: pet.vy }
    : { x: rand(-1, 1) || 1, y: rand(-0.4, 0.4) };
  const length = Math.hypot(direction.x, direction.y) || 1;
  const dx = direction.x / length;
  const dy = direction.y / length;
  pet.pausedByPanel = false;

  if (trickId === "hop") {
    pet.vx += rand(-0.5, 0.5);
    pet.vy -= 2.35;
    pet.targetY = clamp(pet.y - 80, 0, maxY);
  } else if (trickId === "spin") {
    pet.spinVelocity += 74;
    pet.vx += rand(-1.1, 1.1);
    pet.vy += rand(-0.8, 0.8);
  } else if (trickId === "dash") {
    pet.targetX = clamp(pet.x + dx * 280, 0, maxX);
    pet.targetY = clamp(pet.y + dy * 180, 0, maxY);
    pet.vx += dx * 4.1;
    pet.vy += dy * 3.2;
  } else if (trickId === "circle") {
    pet.spinVelocity += 46;
    pet.targetX = clamp(pet.x + rand(-170, 170), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-120, 120), 0, maxY);
    pet.vx += -dy * 2.2;
    pet.vy += dx * 2.2;
  } else if (trickId === "seek") {
    pet.targetX = clamp(pet.x + rand(-220, 220), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-160, 160), 0, maxY);
    pet.vx += rand(-1.8, 1.8);
    pet.vy += rand(-1.3, 1.3);
  } else if (trickId === "parade") {
    pet.targetX = clamp(pet.x + dx * 180 + rand(-90, 90), 0, maxX);
    pet.targetY = clamp(pet.y + dy * 110 + rand(-70, 70), 0, maxY);
    pet.vx += dx * 2.2;
    pet.vy += dy * 1.6;
    pet.spinVelocity += 24;
  }
  pet.nextTargetAt = now + 2400;
}

function runExpeditionMotion(pet, expeditionId) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  pet.pausedByPanel = false;

  if (expeditionId === "gardenWalk") {
    pet.targetX = clamp(pet.x + rand(-180, 180), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-100, 100), 0, maxY);
    pet.vx += rand(-1.4, 1.4);
    pet.vy += rand(-1.0, 1.0);
  } else if (expeditionId === "skylineScout") {
    pet.targetX = clamp(pet.x + rand(-260, 260), 0, maxX);
    pet.targetY = clamp(rand(20, Math.max(24, maxY * 0.35)), 0, maxY);
    pet.vx += rand(-2.2, 2.2);
    pet.vy -= rand(1.0, 2.3);
  } else if (expeditionId === "buddyPatrol") {
    pet.targetX = clamp(pet.x + rand(-220, 220), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-160, 160), 0, maxY);
    pet.spinVelocity += 18;
    pet.vx += rand(-1.7, 1.7);
    pet.vy += rand(-1.2, 1.2);
  } else if (expeditionId === "treasureRoute") {
    pet.targetX = clamp(pet.x + rand(-300, 300), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-200, 200), 0, maxY);
    pet.spinVelocity += 32;
    pet.vx += rand(-2.4, 2.4);
    pet.vy += rand(-1.8, 1.8);
  }
  pet.nextTargetAt = now + 3000;
}

function toyEquipLine(character, toy, wasOwned) {
  const toyName = careText(toy.labelKey);
  if (currentLanguage() === "ko") {
    return wasOwned
      ? `${localStyleFor(character.id)} ${toyName} 장착했어. 움직임이 조금 달라질 거야.`
      : `${localStyleFor(character.id)} ${toyName} 샀어! 이제 장착하고 같이 돌아다닐게.`;
  }
  return wasOwned
    ? `${localStyleFor(character.id)} Equipped ${toyName}. Movement will feel a little different.`
    : `${localStyleFor(character.id)} Bought ${toyName}. I will roam with it now.`;
}

function buyOrEquipToy(pet, toyId) {
  const toy = TOYS[toyId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!toy || !slot) return;
  const game = ensureGame();
  const owned = game.inventory.includes(toyId);
  if (!owned && game.coins < toy.cost) {
    showPetThought(pet, `${careText("notEnoughCoins")} · ${game.coins}/${toy.cost}`, { durationMs: 3600 });
    spawnToyBurst(pet, toyId);
    return;
  }

  const care = careForPet(pet, { decay: true });
  if (!owned) {
    game.coins = Math.round(clamp(game.coins - toy.cost, 0, 999999));
    game.inventory = [...game.inventory, toyId].filter((id, index, list) => TOY_IDS.includes(id) && list.indexOf(id) === index);
  }
  care.equippedToy = toyId;
  for (const key of ["happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(toy[key])) continue;
    care[key] = Math.round(clamp(care[key] + toy[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + (owned ? 1 : 3), 0, 9999));
  addCareXp(care, owned ? 3 : 10);
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  settings.game = normalizeGame(game);
  pet.care = slot.care;
  pet.pausedByPanel = false;
  pet.vx += rand(-0.6, 0.6);
  pet.vy += rand(-0.6, 0.6);
  spawnToyBurst(pet, toyId);
  const reply = toyEquipLine(characterFor(pet.characterId), toy, owned);
  recordMemory(pet, toy.icon, reply);
  showPetThought(pet, reply, { durationMs: 4400 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function buyOrEquipEffect(pet, effectId) {
  const effect = TRAIL_STYLES[effectId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!effect || !slot) return;
  const game = ensureGame();
  const inventory = normalizeEffectInventory(game.effectInventory);
  const owned = inventory.includes(effectId);
  const character = characterFor(pet.characterId);
  if (!owned && game.coins < effect.cost) {
    showPetThought(pet, `${careText("effectNeedCoins")} · ${game.coins}/${effect.cost}`, { durationMs: 3200 });
    spawnEffectBurst(pet, effectId);
    return;
  }

  if (!owned) {
    game.coins = Math.round(clamp(game.coins - effect.cost, 0, 999999));
    game.effectInventory = normalizeEffectInventory([...inventory, effectId]);
  }

  const care = careForPet(pet, { decay: true });
  care.equippedEffect = effectId;
  care.actionCounts.effectEquip = (care.actionCounts.effectEquip || 0) + 1;
  care.actionCounts[`effect:${effectId}`] = (care.actionCounts[`effect:${effectId}`] || 0) + 1;
  for (const key of ["happiness", "energy", "training"]) {
    if (!Number.isFinite(effect[key])) continue;
    care[key] = Math.round(clamp(care[key] + effect[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + (effect.bond || 0), 0, 9999));
  const leveled = addCareXp(care, owned ? 3 : 9);
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  slot.behavior = behaviorFor(slot);
  slot.behavior.effectMode = effect.mode;
  slot.behavior.effectIntensity = effect.intensity;
  pet.care = slot.care;
  pet.behavior = behaviorFor(slot);
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("effect");
  spawnEffectBurst(pet, effectId);
  const levelText = leveled
    ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!`
    : "";
  const line = `${effectEquipLine(character, effect, owned, completedQuests)}${levelText}`;
  recordMemory(pet, effect.icon, line);
  showPetThought(pet, line, { durationMs: 4600 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function craftOrEquipCharm(pet, charmId) {
  const charm = CHARMS[charmId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!charm || !slot) return;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  const inventory = charmInventoryFor(game);
  const owned = inventory.includes(charmId);

  if (!owned) {
    if (!charmCraftable(game, charm)) {
      showPetThought(
        pet,
        `${localStyleFor(character.id)} ${careText("charmNeedItems")} · ${charmRecipeText(charm, game)}`,
        { durationMs: 3800 },
      );
      spawnCharmBurst(pet, charmId);
      return;
    }
    const collections = normalizeCollections(game.collections);
    for (const [itemId, need] of Object.entries(charm.recipe || {})) {
      collections[itemId] = Math.max(0, Math.round((collections[itemId] || 0) - need));
      if (collections[itemId] <= 0) delete collections[itemId];
    }
    game.collections = collections;
    game.charmInventory = [...inventory, charmId].filter((id, index, list) => CHARM_IDS.includes(id) && list.indexOf(id) === index);
    care.actionCounts.charmCraft = (care.actionCounts.charmCraft || 0) + 1;
    care.actionCounts[`charm:${charmId}`] = (care.actionCounts[`charm:${charmId}`] || 0) + 1;
    care.happiness = Math.round(clamp(care.happiness + 5, 0, 100));
    care.training = Math.round(clamp(care.training + 2, 0, 100));
    care.bond = Math.round(clamp(care.bond + 1, 0, 9999));
    addCareXp(care, 8);
    const completedQuests = updateDailyQuests("charm");
    care.equippedCharm = charmId;
    care.lastActionAt = Date.now();
    care.lastCareAt = Date.now();
    slot.care = normalizeCare(care);
    pet.care = slot.care;
    settings.game = normalizeGame(game);
    spawnCharmBurst(pet, charmId);
    spawnMilestoneBurst(pet);
    const line = `${localStyleFor(character.id)} ${charmActionLine(charm, "craft")}${questRewardLine(completedQuests)}`;
    recordMemory(pet, charm.icon, line);
    showPetThought(pet, line, { durationMs: 5000 });
    api.updateSettings(settings).then((next) => {
      settings = next;
      syncPets();
      if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
    });
    return;
  }

  care.equippedCharm = charmId;
  care.lastActionAt = Date.now();
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("charm");
  spawnCharmBurst(pet, charmId);
  const line = `${localStyleFor(character.id)} ${charmActionLine(charm, "equip")}${questRewardLine(completedQuests)}`;
  recordMemory(pet, charm.icon, line);
  showPetThought(pet, line, { durationMs: 3600 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performEggCare(pet) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return;
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  if (care.energy < 6) {
    showPetThought(pet, `${localStyleFor(character.id)} ${careText("nurseryNeedEnergy")}`, { durationMs: 3200 });
    return;
  }

  const game = ensureGame();
  const nest = eggNestFor(game);
  const personality = personalityForPet(pet);
  const count = eggCareCount(care);
  const gain = Math.round(
    clamp(20 + Math.floor(care.bond / 18) + Math.floor(care.happiness / 32) + (personality?.likes?.includes("pet") ? 3 : 0), 18, 34),
  );
  const reward = {
    coins: 3 + Math.floor(count / 6),
    xp: 7,
    happiness: 3,
    bond: count > 0 && count % 5 === 0 ? 1 : 0,
  };
  care.energy = Math.round(clamp(care.energy - 6, 0, 100));
  care.happiness = Math.round(clamp(care.happiness + reward.happiness, 0, 100));
  care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
  care.actionCounts.eggCare = (care.actionCounts.eggCare || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  let leveled = addCareXp(care, reward.xp);
  game.coins = Math.round(clamp(game.coins + reward.coins, 0, 999999));
  nest.progress = Math.round(clamp(nest.progress + gain, 0, 100));
  const completedQuests = updateDailyQuests("eggCare");
  let line = nurseryWarmLine(character, nest.progress, gain, reward, completedQuests);

  if (nest.progress >= 100) {
    const hatchedId = nextHatchCharacterId();
    const targetSlotIndex = firstDisabledSlotIndex();
    const hatchReward = {
      coins: targetSlotIndex >= 0 ? 18 : 36,
      xp: targetSlotIndex >= 0 ? 16 : 24,
      happiness: 7,
      bond: 2,
    };
    if (targetSlotIndex >= 0) {
      const targetSlot = settings.slots[targetSlotIndex];
      targetSlot.character = hatchedId;
      targetSlot.enabled = true;
      targetSlot.behavior = behaviorFor(targetSlot);
      targetSlot.care = normalizeCare({
        level: 1,
        xp: 0,
        bond: 4,
        hunger: 76,
        happiness: 84,
        energy: 82,
        hygiene: 86,
        training: 0,
        memories: [],
      });
    }
    nest.progress = 0;
    nest.hatchedCount += 1;
    nest.lastHatched = hatchedId;
    recordPetAlbumEntry(game, hatchedId, { bestLevel: 1, hatchDelta: 1 });
    game.coins = Math.round(clamp(game.coins + hatchReward.coins, 0, 999999));
    care.happiness = Math.round(clamp(care.happiness + hatchReward.happiness, 0, 100));
    care.bond = Math.round(clamp(care.bond + hatchReward.bond, 0, 9999));
    leveled = addCareXp(care, hatchReward.xp) || leveled;
    line = nurseryHatchLine(character, hatchedId, hatchReward, completedQuests, targetSlotIndex >= 0);
    spawnMilestoneBurst(pet);
  }

  game.eggNest = normalizeEggNest(nest);
  slot.care = normalizeCare(care);
  settings.game = normalizeGame(game);
  pet.care = slot.care;
  pet.pausedByPanel = false;
  pet.vx += rand(-1.0, 1.0);
  pet.vy -= rand(0.6, 1.5);
  pet.spinVelocity += rand(-22, 22);
  spawnEffectBurst(pet, care.equippedEffect || "spark");
  if (leveled) line += currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!`;
  recordMemory(pet, "EG", line);
  showPetThought(pet, line, { durationMs: 5200 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function buyOrServeSnack(pet, snackId) {
  const snack = SNACKS[snackId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!snack || !slot) return;
  const game = ensureGame();
  const inventory = snackInventoryFor(game);
  const owned = snackOwnedCount(game, snackId);
  const character = characterFor(pet.characterId);

  if (owned <= 0) {
    if (game.coins < snack.cost) {
      showPetThought(pet, `${careText("snackNeedCoins")} · ${game.coins}/${snack.cost}`, { durationMs: 3200 });
      showPetThinking(pet, snack.icon, { durationMs: 900 });
      return;
    }
    game.coins = Math.round(clamp(game.coins - snack.cost, 0, 999999));
    inventory[snackId] = 1;
    game.snackInventory = normalizeSnackInventory(inventory);
    settings.game = normalizeGame(game);
    const line = snackBuyLine(character, snack, 1);
    recordMemory(pet, snack.icon, line);
    showPetThinking(pet, snack.icon, { durationMs: 900 });
    showPetThought(pet, line, { durationMs: 3400 });
    api.updateSettings(settings).then((next) => {
      settings = next;
      syncPets();
      if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
    });
    return;
  }

  const care = careForPet(pet, { decay: true });
  const favorite = snackIsFavorite(pet, snackId);
  const reward = snackReward(snack, favorite);
  inventory[snackId] = Math.max(0, owned - 1);
  game.snackInventory = normalizeSnackInventory(inventory);
  care.actionCounts.snackUse = (care.actionCounts.snackUse || 0) + 1;
  care.actionCounts[`snack:${snackId}`] = (care.actionCounts[`snack:${snackId}`] || 0) + 1;
  if (favorite) care.actionCounts[`snackFavorite:${snackId}`] = (care.actionCounts[`snackFavorite:${snackId}`] || 0) + 1;
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(reward[key])) continue;
    care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
  const leveled = addCareXp(care, reward.xp);
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  settings.game = normalizeGame(game);
  pet.care = slot.care;
  pet.pausedByPanel = false;
  pet.vx += rand(-0.8, 0.8);
  pet.vy -= rand(0.4, 1.1);
  pet.spinVelocity += favorite ? rand(-18, 18) : rand(-10, 10);
  const completedQuests = updateDailyQuests("snack");
  spawnEffectBurst(pet, favorite ? "rainbow" : "spark");
  showPetThinking(pet, snack.icon, { durationMs: 1000 });
  const levelText = leveled
    ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!`
    : "";
  const line = `${snackServeLine(character, snack, reward, favorite, completedQuests)}${levelText}`;
  recordMemory(pet, snack.icon, line);
  showPetThought(pet, line, { durationMs: 5000 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performToyPlay(pet) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return;
  const care = careForPet(pet, { decay: true });
  const toyId = care.equippedToy;
  const toy = TOYS[toyId];
  const character = characterFor(pet.characterId);
  if (!toy) {
    showPetThought(pet, `${localStyleFor(character.id)} ${careText("toyPlayNeed")}`, { durationMs: 3300 });
    return;
  }

  const previewLevel = toyPlayMasteryLevel(care, toyId);
  const previewReward = toyPlayReward(toy, previewLevel);
  const energyCost = Math.max(0, -previewReward.energy);
  if (energyCost > 0 && care.energy < energyCost + 4) {
    const line = currentLanguage() === "ko"
      ? `${localStyleFor(character.id)} 에너지가 부족해서 ${careText(toy.labelKey)}로 놀기 어려워.`
      : `${localStyleFor(character.id)} Energy is too low to play with ${careText(toy.labelKey)}.`;
    showPetThought(pet, line, { durationMs: 3400 });
    return;
  }

  care.actionCounts.toyPlay = (care.actionCounts.toyPlay || 0) + 1;
  care.actionCounts[`toyPlay:${toyId}`] = (care.actionCounts[`toyPlay:${toyId}`] || 0) + 1;
  const masteryLevel = toyPlayMasteryLevel(care, toyId);
  const reward = toyPlayReward(toy, masteryLevel);
  for (const key of ["happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(reward[key])) continue;
    care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
  const leveled = addCareXp(care, reward.xp);
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  const game = ensureGame();
  game.coins = Math.round(clamp(game.coins + reward.coins, 0, 999999));
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("toyPlay");
  runToyPlayMotion(pet, toyId);
  spawnToyBurst(pet, toyId);
  if (masteryLevel > previewLevel) spawnMilestoneBurst(pet);
  const levelText = leveled
    ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!`
    : "";
  const reply = `${toyPlayLine(character, toy, reward, masteryLevel)}${levelText}${questRewardLine(completedQuests)}`;
  recordMemory(pet, toy.icon, reply);
  showPetThought(pet, reply, { durationMs: 5000 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function habitatActionLine(character, item, action) {
  const name = careText(item.labelKey);
  if (currentLanguage() === "ko") {
    if (action === "buy") return `${localStyleFor(character.id)} ${name} 샀어. 픽셀 방에 놓아둘게.`;
    if (action === "place") return `${localStyleFor(character.id)} ${name} 배치했어. 쉬는 보너스가 좋아졌어.`;
    return `${localStyleFor(character.id)} ${name} 잠깐 빼둘게.`;
  }
  if (action === "buy") return `${localStyleFor(character.id)} Bought ${name}. It is in the Pixel Room now.`;
  if (action === "place") return `${localStyleFor(character.id)} Placed ${name}. Rest bonuses improved.`;
  return `${localStyleFor(character.id)} Removed ${name} for now.`;
}

function buyOrToggleHabitatItem(pet, itemId) {
  const item = HABITAT_ITEMS[itemId];
  if (!item || !settings) return;
  const game = ensureGame();
  const owned = game.habitatInventory.includes(itemId);
  const placed = game.habitatLayout.includes(itemId);
  const character = characterFor(pet.characterId);
  if (!owned && game.coins < item.cost) {
    showPetThought(pet, `${careText("notEnoughCoins")} · ${game.coins}/${item.cost}`, { durationMs: 3200 });
    spawnHabitatBurst(pet);
    return;
  }

  let action = "place";
  if (!owned) {
    game.coins = Math.round(clamp(game.coins - item.cost, 0, 999999));
    game.habitatInventory = [...game.habitatInventory, itemId].filter(
      (id, index, list) => HABITAT_IDS.includes(id) && list.indexOf(id) === index,
    );
    action = "buy";
  }

  if (placed) {
    game.habitatLayout = game.habitatLayout.filter((id) => id !== itemId);
    action = "remove";
  } else if (game.habitatLayout.length < HABITAT_SLOT_LIMIT) {
    game.habitatLayout = [...game.habitatLayout, itemId].filter(
      (id, index, list) => HABITAT_IDS.includes(id) && list.indexOf(id) === index,
    );
  } else if (owned) {
    showPetThought(pet, `${localStyleFor(character.id)} ${careText("habitatFull")}`, { durationMs: 3000 });
    spawnHabitatBurst(pet);
    return;
  }

  const care = careForPet(pet, { decay: true });
  care.happiness = Math.round(clamp(care.happiness + (action === "remove" ? 0 : 3), 0, 100));
  care.bond = Math.round(clamp(care.bond + (action === "buy" ? 2 : action === "place" ? 1 : 0), 0, 9999));
  if (action !== "remove") addCareXp(care, action === "buy" ? 8 : 3);
  const slot = settings?.slots?.[pet?.slotIndex];
  if (slot) {
    slot.care = normalizeCare(care);
    pet.care = slot.care;
  }
  settings.game = normalizeGame(game);
  spawnHabitatBurst(pet);
  const line = habitatActionLine(character, item, action);
  recordMemory(pet, item.icon, line);
  showPetThought(pet, line, { durationMs: 3800 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function habitatRestLine(character, care, gains, completedQuests) {
  const quest = questRewardLine(completedQuests);
  if (currentLanguage() === "ko") {
    return `${localStyleFor(character.id)} 픽셀 방에서 쉬었어. 에너지 +${gains.energy}, 즐거움 +${gains.happiness}, 안락도 ${gains.comfort}.${quest}`;
  }
  return `${localStyleFor(character.id)} Rested in the Pixel Room. Energy +${gains.energy}, Joy +${gains.happiness}, Comfort ${gains.comfort}.${quest}`;
}

function restInHabitat(pet) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const items = habitatPlacedItems(game);
  const totals = items.reduce(
    (sum, item) => ({
      energy: sum.energy + (item.energy || 0),
      hunger: sum.hunger + (item.hunger || 0),
      happiness: sum.happiness + (item.happiness || 0),
      hygiene: sum.hygiene + (item.hygiene || 0),
      training: sum.training + (item.training || 0),
      bond: sum.bond + (item.bond || 0),
    }),
    { energy: 0, hunger: 0, happiness: 0, hygiene: 0, training: 0, bond: 0 },
  );
  const comfort = habitatComfortScore(game);
  const gains = {
    comfort,
    energy: Math.round(clamp(10 + totals.energy + comfort * 0.08, 8, 42)),
    hunger: Math.round(clamp(2 + totals.hunger, 0, 18)),
    happiness: Math.round(clamp(4 + totals.happiness + comfort * 0.05, 3, 28)),
    hygiene: Math.round(clamp(totals.hygiene, 0, 16)),
    training: Math.round(clamp(totals.training, 0, 14)),
    bond: Math.round(clamp(1 + totals.bond + Math.floor(comfort / 36), 1, 8)),
  };
  care.energy = Math.round(clamp(care.energy + gains.energy, 0, 100));
  care.hunger = Math.round(clamp(care.hunger + gains.hunger, 0, 100));
  care.happiness = Math.round(clamp(care.happiness + gains.happiness, 0, 100));
  care.hygiene = Math.round(clamp(care.hygiene + gains.hygiene, 0, 100));
  care.training = Math.round(clamp(care.training + gains.training, 0, 100));
  care.bond = Math.round(clamp(care.bond + gains.bond, 0, 9999));
  care.actionCounts.habitatRest = (care.actionCounts.habitatRest || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  const leveled = addCareXp(care, 6 + Math.round(comfort / 5));
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  pet.pausedByPanel = false;
  pet.vx *= 0.28;
  pet.vy *= 0.28;
  pet.replySlowUntil = performance.now() + 2600;
  const completedQuests = updateDailyQuests("nap");
  const character = characterFor(pet.characterId);
  const reply = `${habitatRestLine(character, slot.care, gains, completedQuests)}${
    leveled ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!` : ""
  }`;
  recordMemory(pet, "▤", reply);
  spawnHabitatBurst(pet);
  showPetThought(pet, reply, { durationMs: 5000 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function switchHabitatTheme(pet, themeId) {
  const theme = HABITAT_THEMES[themeId];
  if (!theme || !settings) return;
  const game = ensureGame();
  const character = characterFor(pet.characterId);
  if (!habitatThemeUnlocked(game, theme)) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("habitatThemeLocked")} ${theme.unlockComfort}`,
      { durationMs: 3200 },
    );
    spawnHabitatBurst(pet, theme.color);
    return;
  }
  game.habitatTheme = themeId;
  settings.game = normalizeGame(game);
  const line = currentLanguage() === "ko"
    ? `${localStyleFor(character.id)} ${careText(theme.labelKey)} 테마로 바꿨어.`
    : `${localStyleFor(character.id)} Switched to the ${careText(theme.labelKey)} theme.`;
  recordMemory(pet, theme.icon, line);
  spawnHabitatBurst(pet, theme.color);
  showPetThought(pet, line, { durationMs: 3600 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function runHabitatRoomMotion(pet) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  pet.pausedByPanel = false;
  pet.targetX = clamp(pet.x + rand(-130, 130), 0, maxX);
  pet.targetY = clamp(pet.y + rand(-90, 70), 0, maxY);
  pet.vx += rand(-1.2, 1.2);
  pet.vy -= rand(0.4, 1.5);
  pet.spinVelocity += rand(-20, 20);
  pet.nextTargetAt = now + 2200;
}

function spawnRoomEventBurst(pet, eventId, foundItem = null) {
  const event = roomEventFor(eventId);
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const count = foundItem ? 22 : 15;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.16, 0.16);
    const power = eventId === "cozyReset" ? rand(12, 34) : rand(22, 58);
    pushEffectParticle({
      type: foundItem && i % 4 === 0 ? "spark" : eventId === "studySession" || eventId === "lampFocus" ? "pixel" : "bubble",
      x: cx + rand(-7, 7),
      y: cy + rand(-7, 7),
      dx: Math.cos(angle) * power,
      dy: Math.sin(angle) * power,
      size: rand(4, foundItem ? 10 : 8),
      color: foundItem && i % 4 === 0 ? "#facc15" : event.color,
      alpha: eventId === "cozyReset" ? 0.74 : 0.9,
      born: now,
      life: foundItem ? 840 : 700,
    });
  }
  showPetThinking(pet, foundItem?.icon || event.icon, { durationMs: foundItem ? 1200 : 900 });
}

function spawnCharmBurst(pet, charmId) {
  const charm = CHARMS[charmId] || CHARMS.luckyLeaf;
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18 + rand(-0.18, 0.18);
    const power = rand(18, 54);
    pushEffectParticle({
      type: i % 3 === 0 ? "spark" : "pixel",
      x: cx + rand(-7, 7),
      y: cy + rand(-7, 7),
      dx: Math.cos(angle) * power,
      dy: Math.sin(angle) * power,
      size: rand(4, 9),
      color: charm.color,
      alpha: 0.9,
      born: now,
      life: 720,
    });
  }
  showPetThinking(pet, charm.icon, { durationMs: 980 });
}

function spawnFocusBurst(pet) {
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 18; i += 1) {
    const angle = -Math.PI / 2 + rand(-0.8, 0.8);
    pushEffectParticle({
      type: i % 4 === 0 ? "spark" : "pixel",
      x: cx + rand(-10, 10),
      y: cy + rand(-4, 8),
      dx: Math.cos(angle) * rand(12, 42),
      dy: Math.sin(angle) * rand(22, 64),
      size: rand(4, 8),
      color: i % 3 === 0 ? "#3a87ff" : i % 3 === 1 ? "#42d7c5" : "#facc15",
      alpha: 0.88,
      born: now,
      life: 760,
    });
  }
  showPetThinking(pet, "FO", { durationMs: 980 });
}

function spawnMicroEventBurst(pet, eventId) {
  const event = microEventFor(eventId);
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI * 2 * i) / 16 + rand(-0.22, 0.22);
    const power = rand(14, 48);
    pushEffectParticle({
      type: i % 5 === 0 ? "spark" : i % 2 === 0 ? "pixel" : "bubble",
      x: cx + rand(-8, 8),
      y: cy + rand(-8, 8),
      dx: Math.cos(angle) * power,
      dy: Math.sin(angle) * power,
      size: rand(4, 9),
      color: event.color,
      alpha: 0.86,
      born: now,
      life: rand(620, 880),
    });
  }
  showPetThinking(pet, event.icon, { durationMs: 980 });
}

function runMicroEventMotion(pet, eventId) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 1500;
  if (eventId === "pixelStretch") {
    pet.vx *= 0.42;
    pet.vy *= 0.42;
    pet.spinVelocity += rand(-6, 6);
    pet.replySlowUntil = now + 1500;
  } else if (eventId === "bravePeek") {
    pet.targetX = clamp(pet.x + rand(-210, 210), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-130, 120), 0, maxY);
    pet.vx += rand(-1.8, 1.8);
    pet.vy += rand(-1.4, 1.4);
    pet.spinVelocity += rand(-22, 22);
  } else if (eventId === "tidyTap") {
    pet.targetX = clamp(pet.x + rand(-90, 90), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-70, 70), 0, maxY);
    pet.vx += rand(-0.8, 0.8);
    pet.vy -= rand(0.2, 1.0);
  } else {
    pet.targetX = clamp(pet.x + rand(-145, 145), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-95, 80), 0, maxY);
    pet.vx += rand(-1.25, 1.25);
    pet.vy += rand(-1.1, 0.8);
    pet.spinVelocity += rand(-14, 14);
  }
  pet.nextTargetAt = now + 1900;
}

function runRoomEventMotion(pet, eventId) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 1700;
  if (eventId === "cozyReset") {
    pet.vx *= 0.24;
    pet.vy *= 0.24;
    pet.replySlowUntil = now + 2200;
  } else if (eventId === "studySession" || eventId === "lampFocus") {
    pet.vx *= 0.48;
    pet.vy *= 0.48;
    pet.spinVelocity += rand(-5, 5);
    pet.targetX = clamp(pet.x + rand(-70, 70), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-55, 55), 0, maxY);
  } else {
    pet.vx += rand(-1.5, 1.5);
    pet.vy -= rand(0.6, 1.8);
    pet.spinVelocity += rand(-18, 18);
    pet.targetX = clamp(pet.x + rand(-150, 150), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-90, 60), 0, maxY);
  }
  pet.nextTargetAt = now + 2200;
}

function runMiniGameMotion(pet, gameId) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  pet.pausedByPanel = false;
  if (gameId === "starCatch") {
    pet.targetX = clamp(pet.x + rand(-180, 180), 0, maxX);
    pet.targetY = clamp(pet.y - rand(70, 160), 0, maxY);
    pet.vx += rand(-1.4, 1.4);
    pet.vy -= rand(2.2, 4.0);
    pet.spinVelocity += rand(-22, 22);
  } else if (gameId === "bubbleDodge") {
    pet.targetX = clamp(pet.x + rand(-240, 240), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-140, 140), 0, maxY);
    pet.vx += rand(-3.4, 3.4);
    pet.vy += rand(-2.4, 2.4);
    pet.spinVelocity += rand(-34, 34);
  } else {
    pet.targetX = clamp(pet.x + rand(-140, 140), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-120, 120), 0, maxY);
    pet.vx += rand(-1.8, 1.8);
    pet.vy += rand(-1.4, 1.4);
    pet.spinVelocity += 44;
  }
  pet.nextTargetAt = now + 2400;
}

function performRoomPlay(pet) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return;
  const game = ensureGame();
  if (habitatPlacedCount(game) <= 0) {
    const character = characterFor(pet.characterId);
    showPetThought(pet, `${localStyleFor(character.id)} ${careText("habitatRoomPlayNeed")}`, { durationMs: 3200 });
    spawnHabitatBurst(pet);
    return;
  }

  const care = careForPet(pet, { decay: true });
  const reward = habitatRoomReward(game);
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(reward[key])) continue;
    care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  care.actionCounts.roomPlay = (care.actionCounts.roomPlay || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  let leveled = addCareXp(care, reward.xp || 0);
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("roomPlay");
  const character = characterFor(pet.characterId);
  const reply = `${habitatRoomLine(character, game, reward, completedQuests)}${
    leveled ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!` : ""
  }`;
  recordMemory(pet, habitatThemeFor(game).icon, reply);
  runHabitatRoomMotion(pet);
  spawnHabitatBurst(pet, habitatThemeFor(game).color);
  showPetThought(pet, reply, { durationMs: 5400 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performRoomEvent(pet, eventId) {
  const event = ROOM_EVENTS[eventId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!event || !slot) return;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  if (!roomEventUnlocked(game, event)) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("roomEventNeedItems")} · ${roomEventItemsText(event)}`,
      { durationMs: 3400 },
    );
    spawnRoomEventBurst(pet, eventId);
    return;
  }
  if (care.energy < event.energyCost + 4) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("roomEventNeedEnergy")} · ${careText("energy")} ${care.energy}/${event.energyCost + 4}`,
      { durationMs: 3400 },
    );
    spawnRoomEventBurst(pet, eventId);
    return;
  }

  const reward = roomEventReward(game, event);
  care.energy = Math.round(clamp(care.energy - event.energyCost + (reward.energy || 0), 0, 100));
  for (const key of ["hunger", "happiness", "hygiene", "training"]) {
    if (!Number.isFinite(reward[key])) continue;
    care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
  }
  if (reward.bond) care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
  let leveled = addCareXp(care, reward.xp || 0);
  care.actionCounts.roomEvent = (care.actionCounts.roomEvent || 0) + 1;
  care.actionCounts[`roomEvent:${eventId}`] = (care.actionCounts[`roomEvent:${eventId}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();

  let foundItem = null;
  if (event.discovery && Math.random() < 0.24 + habitatComfortScore(game) / 420) {
    const item = pickDiscoveryItem(care);
    const find = addDiscoveryToCollection(game, care, item, (firstFound) => item.reward + (firstFound ? 1 : 0));
    foundItem = find.item;
    game.coins = Math.round(clamp(game.coins + find.reward, 0, 999999));
    if (find.charmBonus?.xp) leveled = addCareXp(care, find.charmBonus.xp) || leveled;
  }
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("roomEvent");
  settings.game = normalizeGame(settings.game);
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  runRoomEventMotion(pet, eventId);
  spawnRoomEventBurst(pet, eventId, foundItem);
  if (foundItem) spawnMilestoneBurst(pet);
  const levelText = leveled ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!` : "";
  const reply = `${roomEventLine(character, event, reward, completedQuests, foundItem)}${levelText}`;
  recordMemory(pet, event.icon, reply);
  showPetThought(pet, reply, { durationMs: 5400 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performMicroEvent(pet, eventId) {
  const event = microEventFor(eventId);
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!event || !slot) return;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  if (care.energy < event.energyCost + 2) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("microEventNeedEnergy")} · ${careText("energy")} ${care.energy}/${event.energyCost + 2}`,
      { durationMs: 3200 },
    );
    spawnMicroEventBurst(pet, eventId);
    return;
  }

  const reward = microEventReward(pet, care, game, { id: eventId, ...event });
  care.energy = Math.round(clamp(care.energy - event.energyCost + (reward.energy || 0), 0, 100));
  for (const key of ["hunger", "happiness", "hygiene", "training"]) {
    if (!Number.isFinite(reward[key])) continue;
    care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  care.actionCounts.microEvent = (care.actionCounts.microEvent || 0) + 1;
  care.actionCounts[`microEvent:${eventId}`] = (care.actionCounts[`microEvent:${eventId}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  const leveled = addCareXp(care, reward.xp || 0);
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("microEvent");
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  runMicroEventMotion(pet, eventId);
  spawnMicroEventBurst(pet, eventId);
  const levelText = leveled ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!` : "";
  const reply = `${microEventLine(pet, character, { id: eventId, ...event }, reward, completedQuests)}${levelText}`;
  recordMemory(pet, event.icon, reply);
  showPetThought(pet, reply, { durationMs: 5400 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function triggerAutoMicroEvent(pet, eventId) {
  const event = microEventFor(eventId);
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!event || !slot) return false;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  if (care.energy < event.energyCost + 8) return false;

  const reward = scaleMicroEventReward(microEventReward(pet, care, game, { id: eventId, ...event }), 0.55);
  care.energy = Math.round(clamp(care.energy - Math.ceil(event.energyCost / 2) + (reward.energy || 0), 0, 100));
  for (const key of ["hunger", "happiness", "hygiene", "training"]) {
    if (!Number.isFinite(reward[key])) continue;
    care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  care.actionCounts.microEvent = (care.actionCounts.microEvent || 0) + 1;
  care.actionCounts.microEventAuto = (care.actionCounts.microEventAuto || 0) + 1;
  care.actionCounts[`microEvent:${eventId}`] = (care.actionCounts[`microEvent:${eventId}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  const leveled = addCareXp(care, reward.xp || 0);
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("microEvent");
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  runMicroEventMotion(pet, eventId);
  spawnMicroEventBurst(pet, eventId);
  const levelText = leveled ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!` : "";
  const autoText = currentLanguage() === "ko" ? " 스스로 만든 작은 순간." : " Auto tiny moment.";
  const reply = `${microEventLine(pet, character, { id: eventId, ...event }, reward, completedQuests)}${autoText}${levelText}`;
  recordMemory(pet, event.icon, reply);
  showPetThought(pet, reply, { durationMs: 4800 });
  saveSettingsSoon(1300);
  return true;
}

function performMiniGame(pet, gameId) {
  const gameDef = MINI_GAMES[gameId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!gameDef || !slot) return;
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  if (care.energy < gameDef.energyCost + 4) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("miniGameNeed")} ${gameDef.energyCost}`,
      { durationMs: 3200 },
    );
    spawnMiniGameBurst(pet, gameId);
    return;
  }

  const previousBest = miniGameBest(care, gameId);
  const score = miniGameScore(pet, gameDef, care);
  const isBest = score > previousBest;
  const best = Math.max(previousBest, score);
  const reward = miniGameReward(gameDef, score, isBest);
  care.actionCounts.miniGame = (care.actionCounts.miniGame || 0) + 1;
  care.actionCounts[`miniGame:${gameId}`] = (care.actionCounts[`miniGame:${gameId}`] || 0) + 1;
  care.actionCounts[`miniBest:${gameId}`] = best;
  for (const key of ["happiness", "energy", "training"]) {
    if (!Number.isFinite(reward[key])) continue;
    care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
  const leveled = addCareXp(care, reward.xp);
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  const game = ensureGame();
  game.coins = Math.round(clamp(game.coins + reward.coins, 0, 999999));
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("miniGame");
  const reply = `${miniGameLine(character, gameDef, score, best, reward, completedQuests)}${
    leveled ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!` : ""
  }`;
  recordMemory(pet, gameDef.icon, reply);
  runMiniGameMotion(pet, gameId);
  spawnMiniGameBurst(pet, gameId);
  showPetThought(pet, reply, { durationMs: 5200 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performCareAction(pet, actionId) {
  const action = CARE_ACTIONS[actionId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!action || !slot) return;
  const care = careForPet(pet, { decay: true });
  const personality = personalityForPet(pet);
  const bonus = personalityCareBonus(personality, actionId);
  const charmBonus = charmCareBonus(charmForCare(care), actionId);
  const perkEffects = bondPerkEffects(care, settings?.game || null);
  const synergyEffects = petSynergyEffects(pet, care, settings?.game || null);
  const growthEffects = growthRewardEffects(care);
  const quirkEffects = careQuirkEffects(care);
  const quirkComboEffects = careQuirkComboEffects(care);
  const habitEffects = petHabitEffects(care);
  const patternEffects = moodPatternEffects(care);
  const instinctEffects = animalInstinctEffects(pet, care, settings?.game || null);
  const caretakerRank = caretakerRankFor(settings?.game || null);
  const now = Date.now();
  const combo = careComboFor(care, actionId, now);
  const lowEnergyPenalty = ["play", "train"].includes(actionId) && care.energy < 18 ? 0.55 : 1;
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(action[key])) continue;
    care[key] = Math.round(clamp(care[key] + action[key] * lowEnergyPenalty, 0, 100));
  }
  if (bonus) {
    for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
      if (!Number.isFinite(bonus[key])) continue;
      care[key] = Math.round(clamp(care[key] + bonus[key], 0, 100));
    }
  }
  if (charmBonus) {
    for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
      if (!Number.isFinite(charmBonus[key])) continue;
      care[key] = Math.round(clamp(care[key] + charmBonus[key], 0, 100));
    }
  }
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(perkEffects.care[key])) continue;
    care[key] = Math.round(clamp(care[key] + perkEffects.care[key], 0, 100));
  }
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(synergyEffects.care[key])) continue;
    care[key] = Math.round(clamp(care[key] + synergyEffects.care[key], 0, 100));
  }
  const habitCareBonus = habitEffects.care[actionId] || {};
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(habitCareBonus[key])) continue;
    care[key] = Math.round(clamp(care[key] + habitCareBonus[key], 0, 100));
  }
  const growthCareBonus = growthEffects.care[actionId] || {};
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(growthCareBonus[key])) continue;
    care[key] = Math.round(clamp(care[key] + growthCareBonus[key], 0, 100));
  }
  const quirkCareBonus = quirkEffects.care[actionId] || {};
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(quirkCareBonus[key])) continue;
    care[key] = Math.round(clamp(care[key] + quirkCareBonus[key], 0, 100));
  }
  const quirkComboCareBonus = quirkComboEffects.care[actionId] || {};
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(quirkComboCareBonus[key])) continue;
    care[key] = Math.round(clamp(care[key] + quirkComboCareBonus[key], 0, 100));
  }
  const patternCareBonus = patternEffects.care[actionId] || {};
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(patternCareBonus[key])) continue;
    care[key] = Math.round(clamp(care[key] + patternCareBonus[key], 0, 100));
  }
  const instinctCareBonus = instinctEffects.care[actionId] || {};
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(instinctCareBonus[key])) continue;
    care[key] = Math.round(clamp(care[key] + instinctCareBonus[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + (action.bond || 0), 0, 9999));
  if (bonus?.bond) care.bond = Math.round(clamp(care.bond + bonus.bond, 0, 9999));
  if (charmBonus?.bond) care.bond = Math.round(clamp(care.bond + charmBonus.bond, 0, 9999));
  if (perkEffects.care.bond) care.bond = Math.round(clamp(care.bond + perkEffects.care.bond, 0, 9999));
  if (synergyEffects.care.bond) care.bond = Math.round(clamp(care.bond + synergyEffects.care.bond, 0, 9999));
  if (habitCareBonus.bond) care.bond = Math.round(clamp(care.bond + habitCareBonus.bond, 0, 9999));
  if (growthCareBonus.bond) care.bond = Math.round(clamp(care.bond + growthCareBonus.bond, 0, 9999));
  if (quirkCareBonus.bond) care.bond = Math.round(clamp(care.bond + quirkCareBonus.bond, 0, 9999));
  if (quirkComboCareBonus.bond) care.bond = Math.round(clamp(care.bond + quirkComboCareBonus.bond, 0, 9999));
  if (patternCareBonus.bond) care.bond = Math.round(clamp(care.bond + patternCareBonus.bond, 0, 9999));
  if (instinctCareBonus.bond) care.bond = Math.round(clamp(care.bond + instinctCareBonus.bond, 0, 9999));
  applyCareComboReward(care, combo);
  const comboChain = combo ? Math.max(2, (normalizeCareCombo(care.combo).chain || 1) + 1) : 1;
  const baseXp = (action.xp || 0) * lowEnergyPenalty + (bonus?.xp || 0) + (charmBonus?.xp || 0) + (combo?.xp || 0);
  const leveled = addCareXp(care, baseXp * instinctEffects.xp * growthEffects.xp * quirkEffects.xp * quirkComboEffects.xp * habitEffects.xp * patternEffects.xp * perkEffects.xp * synergyEffects.xp * (caretakerRank.xp || 1));
  const instinctLine = animalInstinctCareLine(pet, care, actionId);
  const growthLine = growthRewardCareLine(care, actionId);
  const quirkLine = careQuirkCareLine(care, actionId);
  const quirkComboLine = careQuirkComboCareLine(care, actionId);
  const habitLine = petHabitCareLine(care, actionId);
  const patternLine = moodPatternCareLine(care, actionId);
  care.actionCounts[actionId] = (care.actionCounts[actionId] || 0) + 1;
  if (combo) {
    care.actionCounts.careCombo = (care.actionCounts.careCombo || 0) + 1;
    care.actionCounts[`combo:${combo.id}`] = (care.actionCounts[`combo:${combo.id}`] || 0) + 1;
  }
  care.combo = { lastAction: actionId, lastAt: now, chain: comboChain };
  care.lastActionAt = now;
  care.lastCareAt = now;
  slot.care = normalizeCare(care);
  const completedQuests = combo ? [...updateDailyQuests(actionId), ...updateDailyQuests("combo")] : updateDailyQuests(actionId);
  pet.care = slot.care;
  pet.pausedByPanel = false;
  const quirkMotion = quirkEffects.motion + quirkComboEffects.motion;
  if (actionId === "play") {
    pet.vx += rand(-2.4, 2.4) * (1 + growthEffects.motion.playKick + quirkMotion * 0.6);
    pet.vy += rand(-1.8, 1.8) * (1 + growthEffects.motion.playKick * 0.7 + quirkMotion * 0.35);
    pet.spinVelocity += rand(-16, 16);
  } else if (actionId === "train") {
    pet.targetX = clamp(pet.x + rand(-220, 220), 0, Math.max(0, viewport().w - getPetSize(pet)));
    pet.targetY = clamp(pet.y + rand(-140, 140), 0, Math.max(0, viewport().h - getPetSize(pet)));
    pet.vx += rand(-1.3, 1.3) * (1 + growthEffects.motion.trainKick + quirkMotion * 0.45);
    pet.vy += rand(-1.3, 1.3) * (1 + growthEffects.motion.trainKick * 0.7 + quirkMotion * 0.3);
  } else if (actionId === "nap") {
    pet.vx *= 0.25;
    pet.vy *= 0.25;
    pet.replySlowUntil = performance.now() + 2600;
  }
  spawnCareBurst(pet, actionId);
  if (combo) {
    const game = ensureGame();
    game.coins = Math.round(clamp(game.coins + (combo.coins || 0), 0, 999999));
    settings.game = normalizeGame(game);
    spawnMilestoneBurst(pet);
  }
  const reply = `${careReply(characterFor(pet.characterId), actionId, slot.care, leveled, personality)}${instinctLine}${growthLine}${quirkLine}${quirkComboLine}${habitLine}${patternLine}${careComboLine(combo, comboChain)}${questRewardLine(completedQuests)}`;
  recordMemory(pet, action.icon, reply);
  showPetThought(pet, reply, { durationMs: 5600 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function simpleCareLine(actionId, care, leveled) {
  const actionName = careText(actionId);
  if (currentLanguage() === "ko") {
    return `${actionName} 완료. 레벨 ${care.level}${leveled ? " 업!" : "."}`;
  }
  return `${actionName} done. Level ${care.level}${leveled ? " up!" : "."}`;
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes <= 0) return "0 GB";
  const gb = bytes / 1024 ** 3;
  if (gb >= 999) return `${(gb / 1024).toFixed(1)} TB`;
  return `${gb.toFixed(gb >= 100 ? 0 : 1)} GB`;
}

function systemMetricValue(sample, key) {
  if (!sample) return 0;
  if (key === "cpu") return Number(sample.cpu?.percent) || 0;
  if (key === "memory") return Number(sample.memory?.percent) || 0;
  if (key === "storage") return Number(sample.storage?.percent) || 0;
  return 0;
}

function systemBenchmarkLine() {
  if (!systemStats) return "";
  const language = currentLanguage();
  const choices = [
    {
      key: "cpu",
      ko: `지금 CPU ${Math.round(systemStats.cpu?.percent || 0)}% 사용중이네.`,
      en: `CPU is at ${Math.round(systemStats.cpu?.percent || 0)}%.`,
    },
    {
      key: "memory",
      ko: `RAM은 ${Math.round(systemStats.memory?.percent || 0)}% 정도 쓰고 있어.`,
      en: `RAM is around ${Math.round(systemStats.memory?.percent || 0)}%.`,
    },
    {
      key: "storage",
      ko: `용량은 ${Math.round(systemStats.storage?.percent || 0)}% 사용중이야.`,
      en: `Storage is ${Math.round(systemStats.storage?.percent || 0)}% used.`,
    },
  ];
  const choice = choices[Math.floor(Math.random() * choices.length)];
  return language === "ko" ? choice.ko : choice.en;
}

async function refreshSystemStats(options = {}) {
  const now = performance.now();
  if (systemStatsBusy || (!options.force && now < nextSystemStatsAt)) return;
  systemStatsBusy = true;
  nextSystemStatsAt = now + 5000;
  try {
    const next = await api.getSystemStats();
    if (next?.at) {
      systemStats = next;
      systemStatsHistory.push(next);
      systemStatsHistory = systemStatsHistory.slice(-28);
      const shouldRefreshCarePanel =
        activePet &&
        !panel.hidden &&
        panel.dataset.view === "care" &&
        (options.force || now - lastCareStatsPanelRefreshAt >= 5000);
      if (shouldRefreshCarePanel) {
        lastCareStatsPanelRefreshAt = now;
        openPanel(activePet, { noBurst: true, view: "care" });
      }
    }
  } catch {
    /* System stats are optional. */
  } finally {
    systemStatsBusy = false;
  }
}

function runRoutineMotion(pet, actionId, routine) {
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 1300;
  if (actionId === "play") {
    pet.targetX = clamp(pet.x + rand(-190, 190), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-130, 110), 0, maxY);
    pet.vx += rand(-2.0, 2.0);
    pet.vy -= rand(0.7, 1.8);
    pet.spinVelocity += rand(-18, 18);
  } else if (actionId === "train") {
    pet.targetX = clamp(pet.x + rand(-230, 230), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-150, 150), 0, maxY);
    pet.vx += rand(-1.6, 1.6);
    pet.vy += rand(-1.4, 1.4);
    pet.spinVelocity += rand(-14, 14);
  } else if (actionId === "nap") {
    pet.vx *= 0.28;
    pet.vy *= 0.28;
    pet.replySlowUntil = now + 2300;
  } else if (actionId === "clean") {
    pet.vx += rand(-0.8, 0.8);
    pet.vy -= rand(0.3, 1.0);
    pet.spinVelocity += rand(-10, 10);
  } else {
    pet.vx += rand(-1.1, 1.1);
    pet.vy += rand(-0.9, 0.9);
  }
  if (routine?.color) {
    for (let i = 0; i < 8; i += 1) {
      pushEffectParticle({
        type: i % 3 === 0 ? "spark" : "pixel",
        x: pet.x + size / 2 + rand(-8, 8),
        y: pet.y + size / 2 + rand(-8, 8),
        dx: rand(-32, 32),
        dy: rand(-34, 28),
        size: rand(4, 7),
        color: routine.color,
        alpha: 0.82,
        born: now,
        life: rand(520, 760),
      });
    }
  }
  pet.nextTargetAt = now + 1800;
}

function performRoutineStep(pet, routineId) {
  const routine = CARE_ROUTINES[routineId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!routine || !slot) return;
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  const today = currentDayKey();
  let state = normalizeCareRoutine(care.routine);
  if (state.id !== routineId || state.dayKey !== today) {
    state = { id: routineId, step: 0, dayKey: today, completedToday: false };
  }
  if (state.completedToday && state.dayKey === today) {
    showPetThought(pet, `${localStyleFor(character.id)} ${careText(routine.labelKey)} ${careText("routineDoneToday")}`, {
      durationMs: 3000,
    });
    showPetThinking(pet, routine.icon, { durationMs: 900 });
    return;
  }

  const stepIndex = clamp(state.step, 0, routine.steps.length - 1);
  const actionId = routine.steps[stepIndex];
  const action = CARE_ACTIONS[actionId];
  if (!action) return;
  const energyNeed = Math.max(0, -(action.energy || 0));
  if (energyNeed > 0 && care.energy < energyNeed + 3) {
    showPetThought(pet, `${localStyleFor(character.id)} ${careText("routineNeedEnergy")} · ${careText(actionId)} -${energyNeed}`, {
      durationMs: 3300,
    });
    showPetThinking(pet, routine.icon, { durationMs: 900 });
    return;
  }

  const personality = personalityForPet(pet);
  const bonus = personalityCareBonus(personality, actionId);
  const charmBonus = charmCareBonus(charmForCare(care), actionId);
  const lowEnergyPenalty = ["play", "train"].includes(actionId) && care.energy < 18 ? 0.55 : 1;
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (Number.isFinite(action[key])) care[key] = Math.round(clamp(care[key] + action[key] * lowEnergyPenalty, 0, 100));
    if (Number.isFinite(bonus?.[key])) care[key] = Math.round(clamp(care[key] + bonus[key], 0, 100));
    if (Number.isFinite(charmBonus?.[key])) care[key] = Math.round(clamp(care[key] + charmBonus[key], 0, 100));
  }
  care.bond = Math.round(clamp(care.bond + (action.bond || 0) + (bonus?.bond || 0) + (charmBonus?.bond || 0), 0, 9999));
  const xpGain = (action.xp || 0) * lowEnergyPenalty + (bonus?.xp || 0) + (charmBonus?.xp || 0);
  let leveled = addCareXp(care, xpGain);
  care.actionCounts[actionId] = (care.actionCounts[actionId] || 0) + 1;
  care.actionCounts.routineStep = (care.actionCounts.routineStep || 0) + 1;
  const nextStep = state.step + 1;
  const completed = nextStep >= routine.steps.length;
  let completedQuests = [];
  let reward = null;
  if (completed) {
    reward = routine.reward || {};
    for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
      if (!Number.isFinite(reward[key])) continue;
      care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
    }
    care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
    leveled = addCareXp(care, reward.xp || 0) || leveled;
    care.actionCounts.routine = (care.actionCounts.routine || 0) + 1;
    care.actionCounts[`routine:${routineId}`] = (care.actionCounts[`routine:${routineId}`] || 0) + 1;
    const game = ensureGame();
    game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
    settings.game = normalizeGame(game);
    completedQuests = updateDailyQuests("routine");
  }

  care.routine = {
    id: routineId,
    step: completed ? routine.steps.length : nextStep,
    dayKey: today,
    completedToday: completed,
  };
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  runRoutineMotion(pet, actionId, routine);
  spawnCareBurst(pet, actionId);
  showPetThinking(pet, completed ? routine.icon : CARE_ACTIONS[actionId].icon, { durationMs: 900 });

  const levelText = leveled
    ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!`
    : "";
  const line = completed
    ? `${routineCompleteLine(character, routine, reward, completedQuests)}${levelText}`
    : `${routineStepLine(character, routine, actionId, nextStep, routine.steps.length)}${levelText}`;
  if (completed) {
    spawnMilestoneBurst(pet);
    recordMemory(pet, routine.icon, line);
  } else {
    recordMemory(pet, CARE_ACTIONS[actionId].icon, line);
  }
  showPetThought(pet, line, { durationMs: completed ? 5200 : 3800 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function commandMovementFor(pet, commandId) {
  const dir = pet?.direction >= 0 ? 1 : -1;
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const cursorVisible = mouseX >= 0 && mouseX <= w && mouseY >= 0 && mouseY <= h;
  const currentSpeed = Math.hypot(pet?.vx || 0, pet?.vy || 0);
  const dx = currentSpeed > 0.08 ? (pet.vx / currentSpeed) : dir;
  const dy = currentSpeed > 0.08 ? (pet.vy / currentSpeed) : 0;

  if (commandId === "comeHere") {
    if (cursorVisible) {
      const tx = clamp(mouseX - (pet.x + size / 2), -1, 1);
      const ty = clamp(mouseY - (pet.y + size / 2), -1, 1);
      return { target: { x: tx, y: ty }, distance: clamp(Math.hypot(mouseX - pet.x, mouseY - pet.y), 90, 420), speed: 1.45, aiHoldMs: 2800 };
    }
    return { target: { center: true }, speed: 1.25, aiHoldMs: 2800 };
  }
  if (commandId === "slowDrift") {
    return { speed: 0.55, target: { x: rand(-0.8, 0.8), y: rand(-0.45, 0.45) }, distance: 110, aiHoldMs: 6400 };
  }
  if (commandId === "quickDash") {
    return { target: { x: dir, y: rand(-0.25, 0.25) }, distance: 390, speed: 2.35, aiHoldMs: 2600 };
  }
  if (commandId === "spinAround") {
    return { spin: dir * 78, speed: 1.1, aiHoldMs: 2200 };
  }
  if (commandId === "hidePeek") {
    const edgeX = pet.x < w / 2 ? -1 : 1;
    const edgeY = pet.y < h * 0.22 ? 1 : pet.y > h * 0.78 ? -1 : rand(-0.25, 0.25);
    const distance = edgeX < 0 ? pet.x + 34 : maxX - pet.x + 34;
    return { target: { x: edgeX, y: edgeY }, distance: clamp(distance, 120, 430), speed: 1.28, aiHoldMs: 4200 };
  }
  if (commandId === "orbitSpot") {
    return { target: { x: -dy || -dir, y: dx || 0.25 }, distance: 170, speed: 1.55, spin: dir * 46, aiHoldMs: 3400 };
  }
  return { target: { x: dir, y: 0 }, distance: 160, speed: 1.1, aiHoldMs: 2200 };
}

function runPetCommandMotion(pet, commandId) {
  if (!pet) return null;
  const command = commandMovementFor(pet, commandId);
  const character = characterFor(pet.characterId);
  const applied = applyMovementAction(pet, command, character, { source: "ai" });
  const now = performance.now();
  if (commandId === "slowDrift") {
    pet.vx *= 0.36;
    pet.vy *= 0.36;
    pet.replySlowUntil = now + 3000;
  } else if (commandId === "quickDash") {
    const dir = pet.direction >= 0 ? 1 : -1;
    pet.vx += dir * rand(3.2, 4.8);
    pet.vy += rand(-0.8, 0.8);
  } else if (commandId === "spinAround") {
    pet.vx *= 0.42;
    pet.vy *= 0.42;
  } else if (commandId === "hidePeek") {
    pet.vx += (pet.targetX > pet.x ? 1 : -1) * 1.4;
    pet.vy += rand(-0.5, 0.5);
    pet.replySlowUntil = now + 1100;
  } else if (commandId === "orbitSpot") {
    pet.spinVelocity += (pet.direction >= 0 ? 1 : -1) * rand(24, 42);
  }
  pet.pausedByPanel = false;
  pet.nextTargetAt = now + 2400;
  return applied;
}

function spawnCommandBurst(pet, commandId) {
  const command = PET_COMMANDS[commandId] || PET_COMMANDS.comeHere;
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 18; i += 1) {
    const angle = commandId === "quickDash"
      ? (pet.direction >= 0 ? 0 : Math.PI) + rand(-0.38, 0.38)
      : (Math.PI * 2 * i) / 18 + rand(-0.18, 0.18);
    const power = commandId === "slowDrift" ? rand(10, 28) : rand(24, 72);
    pushEffectParticle({
      type: i % 4 === 0 ? "spark" : commandId === "orbitSpot" ? "rainbow" : "pixel",
      x: cx + rand(-8, 8),
      y: cy + rand(-8, 8),
      dx: Math.cos(angle) * power,
      dy: Math.sin(angle) * power,
      size: rand(4, 8),
      color: command.color,
      alpha: 0.9,
      born: now,
      life: commandId === "orbitSpot" ? rand(820, 1180) : rand(560, 900),
    });
  }
  showPetThinking(pet, command.icon, { durationMs: 980 });
}

function performPetCommand(pet, commandId) {
  const command = PET_COMMANDS[commandId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!command || !slot) return;
  const character = characterFor(pet.characterId);
  const care = careForPet(pet, { decay: true });
  if (care.energy < command.energyCost + 2) {
    showPetThought(pet, `${localStyleFor(character.id)} ${careText("commandNeedEnergy")} · ${careText(command.labelKey)} -${command.energyCost}`, {
      durationMs: 3300,
    });
    spawnCommandBurst(pet, commandId);
    return;
  }

  const reward = command.reward || {};
  care.energy = Math.round(clamp(care.energy - command.energyCost + (reward.energy || 0), 0, 100));
  care.hunger = Math.round(clamp(care.hunger + (reward.hunger || 0), 0, 100));
  care.happiness = Math.round(clamp(care.happiness + (reward.happiness || 0), 0, 100));
  care.hygiene = Math.round(clamp(care.hygiene + (reward.hygiene || 0), 0, 100));
  care.training = Math.round(clamp(care.training + (reward.training || 0), 0, 100));
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  const leveled = addCareXp(care, reward.xp || 0);
  care.actionCounts.command = (care.actionCounts.command || 0) + 1;
  care.actionCounts[`command:${commandId}`] = (care.actionCounts[`command:${commandId}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  runPetCommandMotion(pet, commandId);
  spawnCommandBurst(pet, commandId);
  const completedQuests = updateDailyQuests("command");
  const levelText = leveled
    ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!`
    : "";
  const line = `${petCommandLine(character, command, reward, completedQuests)}${levelText}`;
  recordMemory(pet, command.icon, line);
  showPetThought(pet, line, { durationMs: 4300 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function spawnEvolutionBurst(pet, formId) {
  const form = EVOLUTION_FORMS[formId] || EVOLUTION_FORMS.sprout;
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let ring = 0; ring < 2; ring += 1) {
    const count = ring ? 18 : 12;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + rand(-0.12, 0.12);
      const power = rand(ring ? 36 : 20, ring ? 92 : 54);
      pushEffectParticle({
        type: ring ? "spark" : "pixel",
        x: cx + rand(-9, 9),
        y: cy + rand(-9, 9),
        dx: Math.cos(angle) * power,
        dy: Math.sin(angle) * power,
        size: rand(4, ring ? 10 : 8),
        color: form.color,
        alpha: 0.9,
        born: now,
        life: rand(780, 1180),
      });
    }
  }
  showPetThinking(pet, form.icon, { durationMs: 1200 });
}

function claimEvolutionForm(pet, formId) {
  const form = EVOLUTION_FORMS[formId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!form || !slot) return;
  const character = characterFor(pet.characterId);
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  if (!evolutionFormUnlocked(care, game, { id: formId, ...form })) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("evolutionNeed")} · ${evolutionRequirementText(care, game, form)}`,
      { durationMs: 4200 },
    );
    spawnEvolutionBurst(pet, formId);
    return;
  }
  if (evolutionFormClaimed(care, formId)) {
    showPetThought(pet, `${localStyleFor(character.id)} ${careText(form.labelKey)} ${careText("evolutionClaimed")}`, {
      durationMs: 2800,
    });
    spawnEvolutionBurst(pet, formId);
    return;
  }

  const reward = form.reward || {};
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  care.happiness = Math.round(clamp(care.happiness + (reward.happiness || 0), 0, 100));
  care.energy = Math.round(clamp(care.energy + (reward.energy || 0), 0, 100));
  care.training = Math.round(clamp(care.training + (reward.training || 0), 0, 100));
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  const leveled = addCareXp(care, reward.xp || 0);
  care.actionCounts[`form:${formId}`] = 1;
  care.actionCounts.formClaim = EVOLUTION_FORM_IDS.filter((id) => id === formId || evolutionFormClaimed(care, id)).length;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  settings.game = normalizeGame(game);

  const levelText = leveled
    ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!`
    : "";
  const line = `${evolutionClaimLine(character, form, reward)}${levelText}`;
  recordMemory(pet, form.icon, line);
  spawnEvolutionBurst(pet, formId);
  spawnMilestoneBurst(pet);
  showPetThought(pet, line, { durationMs: 5000 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performCareRequest(pet) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return;
  const care = careForPet(pet, { decay: true });
  const request = ensureCareRequest(pet, care);
  const actionId = request.action;
  const action = CARE_ACTIONS[actionId];
  if (!action) return;
  const character = characterFor(pet.characterId);
  if (request.done) {
    showPetThought(pet, `${localStyleFor(character.id)} ${careText("requestDone")}`, { durationMs: 3000 });
    return;
  }

  const personality = personalityForPet(pet);
  const bonus = personalityCareBonus(personality, actionId);
  const charmBonus = charmCareBonus(charmForCare(care), actionId);
  const requestBonus = requestBonusFor(care, actionId);
  const now = Date.now();
  const combo = careComboFor(care, actionId, now);
  const lowEnergyPenalty = ["play", "train"].includes(actionId) && care.energy < 18 ? 0.55 : 1;
  for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
    if (!Number.isFinite(action[key])) continue;
    care[key] = Math.round(clamp(care[key] + action[key] * lowEnergyPenalty, 0, 100));
  }
  if (bonus) {
    for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
      if (!Number.isFinite(bonus[key])) continue;
      care[key] = Math.round(clamp(care[key] + bonus[key], 0, 100));
    }
  }
  if (charmBonus) {
    for (const key of ["hunger", "happiness", "energy", "hygiene", "training"]) {
      if (!Number.isFinite(charmBonus[key])) continue;
      care[key] = Math.round(clamp(care[key] + charmBonus[key], 0, 100));
    }
  }
  care.happiness = Math.round(clamp(care.happiness + requestBonus.happiness, 0, 100));
  care.bond = Math.round(clamp(care.bond + (action.bond || 0) + (bonus?.bond || 0) + requestBonus.bond, 0, 9999));
  if (charmBonus?.bond) care.bond = Math.round(clamp(care.bond + charmBonus.bond, 0, 9999));
  applyCareComboReward(care, combo);
  const comboChain = combo ? Math.max(2, (normalizeCareCombo(care.combo).chain || 1) + 1) : 1;
  const leveled = addCareXp(care, (action.xp || 0) * lowEnergyPenalty + (bonus?.xp || 0) + (charmBonus?.xp || 0) + requestBonus.xp + (combo?.xp || 0));
  care.actionCounts[actionId] = (care.actionCounts[actionId] || 0) + 1;
  care.actionCounts.careRequest = (care.actionCounts.careRequest || 0) + 1;
  care.actionCounts[`request:${actionId}`] = (care.actionCounts[`request:${actionId}`] || 0) + 1;
  if (combo) {
    care.actionCounts.careCombo = (care.actionCounts.careCombo || 0) + 1;
    care.actionCounts[`combo:${combo.id}`] = (care.actionCounts[`combo:${combo.id}`] || 0) + 1;
  }
  care.request = { ...request, done: true };
  care.combo = { lastAction: actionId, lastAt: now, chain: comboChain };
  care.lastActionAt = now;
  care.lastCareAt = now;

  const game = ensureGame();
  game.coins = Math.round(clamp(game.coins + requestBonus.coins + (combo?.coins || 0), 0, 999999));
  settings.game = normalizeGame(game);
  const completedQuests = combo
    ? [...updateDailyQuests(actionId), ...updateDailyQuests("request"), ...updateDailyQuests("combo")]
    : [...updateDailyQuests(actionId), ...updateDailyQuests("request")];
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  pet.pausedByPanel = false;
  if (actionId === "play" || actionId === "train") {
    pet.vx += rand(-2.1, 2.1);
    pet.vy += rand(-1.4, 1.4);
    pet.spinVelocity += rand(-14, 14);
  } else if (actionId === "nap") {
    pet.vx *= 0.25;
    pet.vy *= 0.25;
    pet.replySlowUntil = performance.now() + 2400;
  }
  spawnCareBurst(pet, actionId);
  spawnMilestoneBurst(pet);
  const reply = `${careReply(character, actionId, slot.care, leveled, personality)} ${requestCompleteLine(character, actionId, requestBonus)}${careComboLine(combo, comboChain)}${questRewardLine(completedQuests)}`;
  recordMemory(pet, "RQ", reply);
  showPetThought(pet, reply, { durationMs: 5800 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performMoodCheck(pet) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return;
  const care = careForPet(pet, { decay: true });
  const moodId = careMood(care);
  const aura = moodAuraFor(moodId);
  const reward = moodAuraReward(care, moodId);
  const character = characterFor(pet.characterId);
  const game = ensureGame();
  const moments = normalizeMoodMoments(game.moodMoments);

  if (reward.hunger) care.hunger = Math.round(clamp(care.hunger + reward.hunger, 0, 100));
  if (reward.happiness) care.happiness = Math.round(clamp(care.happiness + reward.happiness, 0, 100));
  if (reward.energy) care.energy = Math.round(clamp(care.energy + reward.energy, 0, 100));
  if (reward.hygiene) care.hygiene = Math.round(clamp(care.hygiene + reward.hygiene, 0, 100));
  if (reward.training) care.training = Math.round(clamp(care.training + reward.training, 0, 100));
  if (reward.bond) care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
  let leveled = addCareXp(care, reward.xp || 0);
  care.actionCounts.moodCheck = (care.actionCounts.moodCheck || 0) + 1;
  care.actionCounts[`mood:${moodId}`] = (care.actionCounts[`mood:${moodId}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();

  moments.counts[moodId] = Math.round(clamp((moments.counts[moodId] || 0) + 1, 0, 9999));
  moments.lastAt = Date.now();
  moments.lastMood = moodId;
  game.moodMoments = normalizeMoodMoments(moments);
  if (reward.coins) game.coins = Math.round(clamp(game.coins + reward.coins, 0, 999999));
  const completedQuests = updateDailyQuests("mood");
  settings.game = normalizeGame(game);
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  pet.pausedByPanel = false;
  if (moodId === "bright") {
    wakePet(pet, 1.2);
    pet.spinVelocity += rand(-9, 9);
  } else if (moodId === "sleepy") {
    pet.vx *= 0.32;
    pet.vy *= 0.32;
    pet.replySlowUntil = performance.now() + 2500;
  } else if (moodId === "hungry" || moodId === "lonely") {
    pet.vx += rand(-1.4, 1.4);
    pet.vy += rand(-1.0, 1.0);
  }

  spawnMoodAuraBurst(pet, moodId);
  const levelText = leveled ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!` : "";
  const line = `${moodAuraLine(character, moodId, reward, completedQuests)}${levelText}`;
  recordMemory(pet, aura.icon, line);
  showPetThought(pet, line, { durationMs: 5200 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performTalentTraining(pet, talentId) {
  const talent = TALENTS[talentId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!talent || !slot) return;
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  if (care.training < talent.trainingNeed) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("talentNeedSkill")} · ${careText("training")} ${care.training}/${talent.trainingNeed}`,
      { durationMs: 3300 },
    );
    return;
  }
  if (care.energy < talent.energyCost + 4) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("talentNeedEnergy")} · ${careText("energy")} ${care.energy}/${talent.energyCost + 4}`,
      { durationMs: 3300 },
    );
    return;
  }

  const levelBefore = talentLevel(care, talentId);
  const reward = talentReward(care, talent, levelBefore);
  const charmBonus = charmCareBonus(charmForCare(care), "talent");
  care.energy = Math.round(clamp(care.energy - talent.energyCost + (reward.energy || 0) + (charmBonus?.energy || 0), 0, 100));
  for (const key of ["hunger", "happiness", "hygiene", "training"]) {
    if (!Number.isFinite(reward[key])) continue;
    care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
  }
  if (charmBonus) {
    for (const key of ["hunger", "happiness", "hygiene", "training"]) {
      if (!Number.isFinite(charmBonus[key])) continue;
      care[key] = Math.round(clamp(care[key] + charmBonus[key], 0, 100));
    }
  }
  if (reward.bond) care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
  if (charmBonus?.bond) care.bond = Math.round(clamp(care.bond + charmBonus.bond, 0, 9999));
  const leveled = addCareXp(care, (reward.xp || 0) + (charmBonus?.xp || 0));
  care.actionCounts.talentTrain = (care.actionCounts.talentTrain || 0) + 1;
  care.actionCounts[`talent:${talentId}`] = (care.actionCounts[`talent:${talentId}`] || 0) + 1;
  const levelAfter = talentLevel(care, talentId);
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();

  const game = ensureGame();
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("talent");
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  runTalentMotion(pet, talentId);
  spawnTalentBurst(pet, talentId);
  if (levelAfter > levelBefore) spawnMilestoneBurst(pet);
  const levelText = leveled ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!` : "";
  const line = `${talentPracticeLine(character, talent, levelBefore, levelAfter, reward, completedQuests)}${levelText}`;
  recordMemory(pet, talent.icon, line);
  showPetThought(pet, line, { durationMs: 5200 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performTinyJob(pet, jobId) {
  const job = TINY_JOBS[jobId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!job || !slot) return;
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  if (care.level < job.level) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("jobNeedLevel")} · ${careText("level")} ${care.level}/${job.level}`,
      { durationMs: 3300 },
    );
    return;
  }
  if (care.training < job.training) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("jobNeedSkill")} · ${careText("training")} ${care.training}/${job.training}`,
      { durationMs: 3300 },
    );
    return;
  }
  if (care.energy < job.energyCost + 4) {
    showPetThought(
      pet,
      `${localStyleFor(character.id)} ${careText("jobNeedEnergy")} · ${careText("energy")} ${care.energy}/${job.energyCost + 4}`,
      { durationMs: 3300 },
    );
    return;
  }

  const repBefore = tinyJobReputation(care, jobId);
  const reward = tinyJobReward(care, job, repBefore);
  care.energy = Math.round(clamp(care.energy - job.energyCost + (reward.energy || 0), 0, 100));
  for (const key of ["hunger", "happiness", "hygiene", "training"]) {
    if (!Number.isFinite(reward[key])) continue;
    care[key] = Math.round(clamp(care[key] + reward[key], 0, 100));
  }
  if (reward.bond) care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
  let leveled = addCareXp(care, reward.xp || 0);
  care.actionCounts.jobRun = (care.actionCounts.jobRun || 0) + 1;
  care.actionCounts[`job:${jobId}`] = (care.actionCounts[`job:${jobId}`] || 0) + 1;
  const repAfter = tinyJobReputation(care, jobId);
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();

  const game = ensureGame();
  let foundItem = null;
  if (job.collection && Math.random() < 0.22 + talentLevel(care, job.talent) * 0.04 + repBefore * 0.025) {
    const item = pickDiscoveryItem(care);
    const find = addDiscoveryToCollection(game, care, item, (firstFound) => item.reward + (firstFound ? 1 : 0));
    foundItem = find.item;
    game.coins = Math.round(clamp(game.coins + find.reward, 0, 999999));
    if (find.charmBonus?.xp) leveled = addCareXp(care, find.charmBonus.xp) || leveled;
  }
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("job");
  settings.game = normalizeGame(settings.game);
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  runTinyJobMotion(pet, jobId);
  spawnTinyJobBurst(pet, jobId, foundItem);
  if (repAfter > repBefore || foundItem) spawnMilestoneBurst(pet);
  const levelText = leveled ? currentLanguage() === "ko" ? ` 레벨 ${slot.care.level} 달성!` : ` Reached level ${slot.care.level}!` : "";
  const line = `${tinyJobLine(character, job, reward, repBefore, repAfter, completedQuests, foundItem)}${levelText}`;
  recordMemory(pet, job.icon, line);
  showPetThought(pet, line, { durationMs: 5400 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performSignatureAction(pet) {
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!slot) return;
  const action = signatureActionFor(pet);
  const character = characterFor(pet.characterId);
  const care = careForPet(pet, { decay: true });
  const energyCost = Math.round(clamp(action.energyCost || 8, 1, 40));
  if (care.energy < energyCost) {
    const line = currentLanguage() === "ko"
      ? `${localStyleFor(character.id)} ${careText("specialNeedEnergy")} · ${care.energy}/${energyCost}`
      : `${localStyleFor(character.id)} ${careText("specialNeedEnergy")} · ${care.energy}/${energyCost}`;
    spawnSignatureBurst(pet, action);
    showPetThought(pet, line, { durationMs: 3400 });
    return;
  }

  care.energy = Math.round(clamp(care.energy - energyCost, 0, 100));
  const charmBonus = charmCareBonus(charmForCare(care), "special");
  care.hunger = Math.round(clamp(care.hunger - 2, 0, 100));
  care.happiness = Math.round(clamp(care.happiness + action.happiness + (charmBonus?.happiness || 0), 0, 100));
  care.training = Math.round(clamp(care.training + action.training + (charmBonus?.training || 0), 0, 100));
  care.energy = Math.round(clamp(care.energy + (charmBonus?.energy || 0), 0, 100));
  care.hygiene = Math.round(clamp(care.hygiene + (charmBonus?.hygiene || 0), 0, 100));
  care.bond = Math.round(clamp(care.bond + action.bond + (charmBonus?.bond || 0), 0, 9999));
  care.actionCounts[signatureActionKeyFor(pet)] = (care.actionCounts[signatureActionKeyFor(pet)] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  const completedQuests = updateDailyQuests("special");
  const leveled = addCareXp(care, (action.xp || 0) + (charmBonus?.xp || 0));
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  runSignatureMotion(pet, action);
  spawnSignatureBurst(pet, action);
  const reply = signatureReply(character, action, slot.care, leveled, completedQuests);
  recordMemory(pet, action.icon, reply);
  showPetThought(pet, reply, { durationMs: 5200 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performTrick(pet, trickId) {
  const trick = PET_TRICKS[trickId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!trick || !slot) return;
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  if (!trickUnlocked(care, trick)) {
    showPetThought(pet, `${localStyleFor(character.id)} ${trickRequirementText(trick)}`, { durationMs: 3800 });
    return;
  }
  const energyCost = Math.max(0, -(trick.energy || 0));
  if (care.energy < energyCost + 4) {
    const line = currentLanguage() === "ko"
      ? `${localStyleFor(character.id)} 에너지가 조금 부족해. 낮잠 후에 ${careText(trick.labelKey)} 할게.`
      : `${localStyleFor(character.id)} Energy is low. I can ${careText(trick.labelKey)} after a nap.`;
    showPetThought(pet, line, { durationMs: 3600 });
    return;
  }

  const masteryBefore = trickMasteryLevel(care, trickId);
  care.energy = Math.round(clamp(care.energy + (trick.energy || 0), 0, 100));
  care.happiness = Math.round(clamp(care.happiness + trick.happiness, 0, 100));
  care.training = Math.round(clamp(care.training + (trickId === "parade" ? 2 : 1), 0, 100));
  care.bond = Math.round(clamp(care.bond + 1, 0, 9999));
  care.actionCounts[`trick:${trickId}`] = (care.actionCounts[`trick:${trickId}`] || 0) + 1;
  const masteryAfter = trickMasteryLevel(care, trickId);
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  let completedQuests = [];
  let extra = "";
  let masteryXp = 0;
  let discoveryBonusXp = 0;

  if (trickId === "seek") {
    const game = ensureGame();
    const item = pickDiscoveryItem(care);
    const find = addDiscoveryToCollection(game, care, item, (firstFound) => item.reward + (firstFound ? 3 : 1), {
      min: 1,
      max: 10,
    });
    const firstFound = find.firstFound;
    const reward = find.reward;
    game.coins = Math.round(clamp(game.coins + reward, 0, 999999));
    settings.game = normalizeGame(game);
    completedQuests = updateDailyQuests("discover");
    extra = currentLanguage() === "ko"
      ? ` ${discoveryLabel(item)} 찾기 성공. +${reward} ${careText("coins")}.`
      : ` Found ${discoveryLabel(item)}. +${reward} ${careText("coins")}.`;
    if (firstFound) extra += currentLanguage() === "ko" ? " 새 도감 등록." : " New collection entry.";
    extra += questRewardLine(completedQuests);
    if (find.charmBonus?.xp) discoveryBonusXp += find.charmBonus.xp;
    spawnDiscoveryBurst(pet);
  }

  if (masteryAfter > masteryBefore) {
    const reward = trickMasteryReward(masteryAfter);
    care.happiness = Math.round(clamp(care.happiness + reward.happiness, 0, 100));
    care.training = Math.round(clamp(care.training + reward.training, 0, 100));
    care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
    masteryXp = reward.xp;
    extra += trickMasteryLine(trick, masteryAfter);
  }

  const leveled = addCareXp(care, trick.xp + masteryXp + discoveryBonusXp);
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  pet.pausedByPanel = false;
  runTrickMotion(pet, trickId);
  spawnTrickBurst(pet, trickId);
  const reply = trickReply(character, trick, slot.care, leveled, extra);
  recordMemory(pet, trick.icon, reply);
  showPetThought(pet, reply, { durationMs: trickId === "seek" ? 5600 : 4400 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function bestFriendForExpedition(pet) {
  return pets
    .filter((other) => other.enabled && other.slotIndex !== pet.slotIndex)
    .map((other) => ({ pet: other, score: friendshipScore(pet, other) }))
    .sort((a, b) => b.score - a.score)[0]?.pet || null;
}

function performExpedition(pet, expeditionId) {
  const expedition = EXPEDITIONS[expeditionId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!expedition || !slot) return;
  const care = careForPet(pet, { decay: true });
  const character = characterFor(pet.characterId);
  if (!expeditionUnlocked(care, expedition)) {
    showPetThought(pet, `${localStyleFor(character.id)} ${expeditionRequirementText(expedition)}`, { durationMs: 3900 });
    return;
  }
  if (care.energy < expedition.energyCost) {
    const line = currentLanguage() === "ko"
      ? `${localStyleFor(character.id)} 원정 에너지가 부족해. 낮잠으로 충전하면 좋아.`
      : `${localStyleFor(character.id)} Not enough expedition energy. A nap would help.`;
    showPetThought(pet, line, { durationMs: 3600 });
    return;
  }

  const game = ensureGame();
  const completedQuests = updateDailyQuests("expedition");
  let coins = expedition.coins;
  let extra = "";
  let discoveryBonusXp = 0;
  care.energy = Math.round(clamp(care.energy - expedition.energyCost, 0, 100));
  care.happiness = Math.round(clamp(care.happiness + expedition.happiness, 0, 100));
  care.training = Math.round(clamp(care.training + expedition.trainingGain, 0, 100));
  care.bond = Math.round(clamp(care.bond + 2, 0, 9999));
  care.actionCounts[`expedition:${expeditionId}`] = (care.actionCounts[`expedition:${expeditionId}`] || 0) + 1;
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();

  if (expedition.collection) {
    const item = pickDiscoveryItem(care);
    const find = addDiscoveryToCollection(game, care, item, (firstFound) => item.reward + (firstFound ? 2 : 0));
    coins += find.reward;
    extra += currentLanguage() === "ko"
      ? ` ${discoveryLabel(item)} 수집.`
      : ` Collected ${discoveryLabel(item)}.`;
    if (find.firstFound) extra += currentLanguage() === "ko" ? " 새 도감 등록." : " New collection entry.";
    if (find.charmBonus?.xp) {
      discoveryBonusXp += find.charmBonus.xp;
      extra += currentLanguage() === "ko" ? ` 참 보너스 +${find.charmBonus.xp} ${careText("xp")}.` : ` Charm bonus +${find.charmBonus.xp} ${careText("xp")}.`;
    }
  }

  if (expedition.friendship) {
    const friend = bestFriendForExpedition(pet);
    if (friend) {
      const score = boostFriendship(pet, friend, expedition.friendship);
      extra += currentLanguage() === "ko"
        ? ` ${characterFor(friend.characterId).name}와 ${friendshipLabel(score)} ${score}.`
        : ` ${characterFor(friend.characterId).name}: ${friendshipLabel(score)} ${score}.`;
    }
  }

  game.coins = Math.round(clamp(game.coins + coins, 0, 999999));
  settings.game = normalizeGame(game);
  const leveled = addCareXp(care, expedition.xp + discoveryBonusXp);
  slot.care = normalizeCare(care);
  pet.care = slot.care;
  runExpeditionMotion(pet, expeditionId);
  spawnExpeditionBurst(pet, expeditionId);
  extra += ` +${coins} ${careText("coins")}.`;
  extra += questRewardLine(completedQuests);
  const reply = expeditionReply(character, expedition, slot.care, leveled, extra);
  recordMemory(pet, expedition.icon, reply);
  showPetThought(pet, reply, { durationMs: 5600 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function saveSettingsSoon(delay = 1400) {
  if (pendingSettingsSaveTimer) window.clearTimeout(pendingSettingsSaveTimer);
  pendingSettingsSaveTimer = window.setTimeout(() => {
    pendingSettingsSaveTimer = null;
    api.updateSettings(settings).then((next) => {
      settings = next;
    });
  }, delay);
}

function weightedSocialType(a, b) {
  const averageEnergy = ((a.care?.energy || 60) + (b.care?.energy || 60)) / 2;
  const averageHappy = ((a.care?.happiness || 60) + (b.care?.happiness || 60)) / 2;
  const aPersonality = personalityForPet(a);
  const bPersonality = personalityForPet(b);
  const pool = SOCIAL_INTERACTIONS.map((item) => {
    let weight = item.weight;
    if (item.id === "nap" && averageEnergy < 42) weight += 4;
    if (item.id === "play" && averageEnergy > 62 && averageHappy > 52) weight += 3;
    if (item.id === "share" && (a.care?.hunger || 60) < 42) weight += 2;
    if (item.id === "follow" && ((a.care?.training || 0) + (b.care?.training || 0)) > 80) weight += 2;
    weight += aPersonality.socialWeight?.[item.id] || 0;
    weight += bPersonality.socialWeight?.[item.id] || 0;
    return { ...item, weight: Math.max(1, weight) };
  });
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = rand(0, total);
  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return pool[0];
}

function socialPhrase(type) {
  const lines = SOCIAL_LINE_PARTS[type]?.[currentLanguage()] || SOCIAL_LINE_PARTS[type]?.en || [];
  return lines[Math.floor(Math.random() * lines.length)] || type;
}

function socialLine(actor, other, type) {
  const actorCharacter = characterFor(actor.characterId);
  const otherCharacter = characterFor(other.characterId);
  const actorCare = actor.care || careForPet(actor);
  const actorPersonality = personalityForPet(actor);
  const phrase = socialPhrase(type);
  const mood = careText(careMood(actorCare));
  const stage = careText(careStage(actorCare));
  const toy = toyForCare(actorCare);
  const seed = [
    actor.characterId,
    other.characterId,
    type,
    actorPersonality.labelKey,
    actorCare.level,
    actorCare.equippedToy,
    Math.floor(performance.now() / 5000),
  ].join(":");
  const detail = buildSocialDetail({
    language: currentLanguage(),
    type,
    actorName: actorCharacter.name,
    otherName: otherCharacter.name,
    phrase,
    mood,
    stage,
    toyName: toy ? careText(toy.labelKey) : "",
    seed,
  });
  if (currentLanguage() === "ko") {
    return `${actorCharacter.name}와 ${otherCharacter.name}가 ${detail} ${careText(actorPersonality.labelKey)} 리듬.`;
  }
  return `${actorCharacter.name} and ${otherCharacter.name}: ${detail} ${careText(actorPersonality.labelKey)} rhythm.`;
}

function boostCareForSocial(pet, interaction) {
  const slot = settings?.slots?.[pet.slotIndex];
  if (!slot) return;
  const care = careForPet(pet, { decay: true });
  const personality = personalityForPet(pet);
  const socialBonus = personality.socialWeight?.[interaction.id] ? 1 : 0;
  care.happiness = Math.round(clamp(care.happiness + interaction.happiness, 0, 100));
  care.energy = Math.round(clamp(care.energy + interaction.energy, 0, 100));
  care.training = Math.round(clamp(care.training + interaction.training, 0, 100));
  care.bond = Math.round(clamp(care.bond + interaction.bond + socialBonus, 0, 9999));
  addCareXp(care, (interaction.id === "nap" ? 2 : 4) + socialBonus);
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  pet.care = slot.care;
}

function spawnSocialBurst(a, b, interaction) {
  const now = performance.now();
  const ax = a.x + getPetSize(a) / 2;
  const ay = a.y + getPetSize(a) / 2;
  const bx = b.x + getPetSize(b) / 2;
  const by = b.y + getPetSize(b) / 2;
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    pushEffectParticle({
      type: interaction.id === "nap" ? "bubble" : "spark",
      x: cx,
      y: cy,
      dx: Math.cos(angle) * rand(16, 42),
      dy: Math.sin(angle) * rand(14, 38),
      size: rand(4, 8),
      color: interaction.color,
      alpha: 0.86,
      born: now,
      life: 620,
    });
  }
}

function spawnDiscoveryBurst(pet) {
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    pushEffectParticle({
      type: i % 2 === 0 ? "spark" : "bubble",
      x: cx + rand(-5, 5),
      y: cy + rand(-5, 5),
      dx: Math.cos(angle) * rand(14, 44),
      dy: Math.sin(angle) * rand(12, 38),
      size: rand(4, 8),
      color: i % 2 === 0 ? "#facc15" : "#42d7c5",
      alpha: 0.88,
      born: now,
      life: 640,
    });
  }
}

function spawnMilestoneBurst(pet) {
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI * 2 * i) / 16;
    pushEffectParticle({
      type: i % 3 === 0 ? "spark" : "pixel",
      x: cx + rand(-4, 4),
      y: cy + rand(-4, 4),
      dx: Math.cos(angle) * rand(18, 58),
      dy: Math.sin(angle) * rand(18, 52),
      size: rand(4, 8),
      color: i % 2 === 0 ? "#facc15" : "#42d7c5",
      alpha: 0.9,
      born: now,
      life: 760,
    });
  }
}

function spawnHabitatBurst(pet, color = null) {
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const accent = color || habitatThemeFor(ensureGame()).color || "#42d7c5";
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + rand(-0.85, 0.85);
    pushEffectParticle({
      type: i % 2 === 0 ? "bubble" : "spark",
      x: cx + rand(-8, 8),
      y: cy + rand(-5, 9),
      dx: Math.cos(angle) * rand(12, 30),
      dy: Math.sin(angle) * rand(16, 44),
      size: rand(4, 8),
      color: i % 2 === 0 ? accent : "#facc15",
      alpha: 0.82,
      born: now,
      life: 720,
    });
  }
}

function spawnMiniGameBurst(pet, gameId) {
  const gameDef = MINI_GAMES[gameId] || MINI_GAMES.starCatch;
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 16; i += 1) {
    const angle = -Math.PI / 2 + rand(-1.55, 1.55);
    pushEffectParticle({
      type: i % 4 === 0 ? "spark" : i % 4 === 1 ? "pixel" : "bubble",
      x: cx + rand(-10, 10),
      y: cy + rand(-8, 10),
      dx: Math.cos(angle) * rand(18, 62),
      dy: Math.sin(angle) * rand(22, 76),
      size: rand(3, 8),
      color: i % 3 === 0 ? gameDef.color : i % 3 === 1 ? "#facc15" : "#42d7c5",
      alpha: 0.86,
      born: now,
      life: rand(620, 920),
    });
  }
}

function spawnDuoBurst(a, b, move) {
  const now = performance.now();
  const color = move?.color || "#42d7c5";
  for (const [from, to] of [[a, b], [b, a]]) {
    const fromSize = getPetSize(from);
    const toSize = getPetSize(to);
    const sx = from.x + fromSize / 2;
    const sy = from.y + fromSize / 2;
    const tx = to.x + toSize / 2;
    const ty = to.y + toSize / 2;
    const angle = Math.atan2(ty - sy, tx - sx);
    for (let i = 0; i < 10; i += 1) {
      pushEffectParticle({
        type: i % 3 === 0 ? "spark" : "pixel",
        x: sx + rand(-7, 7),
        y: sy + rand(-7, 7),
        dx: Math.cos(angle + rand(-0.5, 0.5)) * rand(18, 58),
        dy: Math.sin(angle + rand(-0.5, 0.5)) * rand(18, 58),
        size: rand(4, 8),
        color: i % 2 === 0 ? color : "#facc15",
        alpha: 0.88,
        born: now,
        life: rand(620, 880),
      });
    }
    showPetThinking(from, move?.icon || "DU", { durationMs: 950 });
  }
}

function spawnPackBurst(members, event) {
  const team = Array.isArray(members) ? members.filter(Boolean) : [];
  const now = performance.now();
  const color = event?.color || "#42d7c5";
  for (const pet of team) {
    const size = getPetSize(pet);
    const cx = pet.x + size / 2;
    const cy = pet.y + size / 2;
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10 + rand(-0.18, 0.18);
      pushEffectParticle({
        type: i % 4 === 0 ? "spark" : i % 4 === 1 ? "rainbow" : "pixel",
        x: cx + rand(-8, 8),
        y: cy + rand(-8, 8),
        dx: Math.cos(angle) * rand(18, 64),
        dy: Math.sin(angle) * rand(18, 64),
        size: rand(4, 8),
        color: i % 2 === 0 ? color : "#facc15",
        alpha: 0.88,
        born: now,
        life: rand(620, 980),
      });
    }
    showPetThinking(pet, event?.icon || "PK", { durationMs: 950 });
  }
}

function runPackMotion(members, event) {
  const team = Array.isArray(members) ? members.filter(Boolean) : [];
  if (!team.length) return;
  const { w, h } = viewport();
  const now = performance.now();
  const centerX = clamp(team.reduce((sum, pet) => sum + pet.x, 0) / team.length + rand(-80, 80), 70, Math.max(80, w - 70));
  const centerY = clamp(team.reduce((sum, pet) => sum + pet.y, 0) / team.length + rand(-60, 60), 70, Math.max(80, h - 70));
  team.forEach((pet, index) => {
    const size = getPetSize(pet);
    const maxX = Math.max(0, w - size);
    const maxY = Math.max(0, h - size);
    const angle = (Math.PI * 2 * index) / Math.max(1, team.length) + rand(-0.28, 0.28);
    const radius = event?.minMembers >= 3 ? 76 : 56;
    pet.pausedByPanel = false;
    pet.aiControlledUntil = now + 2600;
    pet.targetX = clamp(centerX + Math.cos(angle) * radius - size / 2, 0, maxX);
    pet.targetY = clamp(centerY + Math.sin(angle) * radius - size / 2, 0, maxY);
    pet.vx += Math.cos(angle) * rand(1.2, 2.6);
    pet.vy += Math.sin(angle) * rand(1.0, 2.2);
    pet.spinVelocity += rand(-18, 18);
    pet.nextTargetAt = now + 2600;
  });
}

function spawnContestBurst(pet, contest, tier) {
  if (!pet) return;
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const color = tier?.color || contest?.color || "#facc15";
  for (let i = 0; i < 18; i += 1) {
    const angle = -Math.PI / 2 + rand(-1.7, 1.7);
    pushEffectParticle({
      type: i % 5 === 0 ? "spark" : i % 5 === 1 ? "rainbow" : "pixel",
      x: cx + rand(-10, 10),
      y: cy + rand(-8, 12),
      dx: Math.cos(angle) * rand(22, 78),
      dy: Math.sin(angle) * rand(26, 88),
      size: rand(4, 9),
      color: i % 2 === 0 ? color : contest?.color || "#42d7c5",
      alpha: 0.9,
      born: now,
      life: rand(680, 1080),
    });
  }
  showPetThinking(pet, contest?.icon || "LG", { durationMs: 980 });
}

function runContestMotion(pet, contest) {
  if (!pet) return;
  const { w, h } = viewport();
  const size = getPetSize(pet);
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  const route = contest?.icon === "SP" || contest?.icon === "FR" ? "dash" : contest?.icon === "TS" ? "stage" : "show";
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 3000;
  if (route === "dash") {
    const direction = pet.x < w / 2 ? 1 : -1;
    pet.targetX = clamp(pet.x + direction * rand(160, 320), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-70, 70), 0, maxY);
    pet.vx += direction * rand(2.5, 4.2);
    pet.vy += rand(-1.2, 1.2);
    pet.spinVelocity += rand(-10, 10);
  } else if (route === "stage") {
    pet.targetX = clamp(pet.x + rand(-90, 90), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-70, 40), 0, maxY);
    pet.vx += rand(-1.5, 1.5);
    pet.vy += rand(-1.2, 0.7);
    pet.spinVelocity += rand(22, 38) * (Math.random() < 0.5 ? -1 : 1);
  } else {
    pet.targetX = clamp(pet.x + rand(-80, 80), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-35, 35), 0, maxY);
    pet.vx *= 0.6;
    pet.vy *= 0.6;
    pet.spinVelocity += rand(-7, 7);
  }
  pet.nextTargetAt = now + 2600;
}

function spawnMedalTrialBurst(pet, medal, tired = false) {
  if (!pet) return;
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const color = tired ? "#94a3b8" : medal?.color || "#facc15";
  const count = tired ? 8 : 20;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.2, 0.2);
    pushEffectParticle({
      type: tired ? "bubble" : i % 4 === 0 ? "rainbow" : i % 4 === 1 ? "spark" : "pixel",
      x: cx + rand(-10, 10),
      y: cy + rand(-10, 10),
      dx: Math.cos(angle) * rand(tired ? 8 : 24, tired ? 28 : 82),
      dy: Math.sin(angle) * rand(tired ? 8 : 24, tired ? 28 : 82),
      size: rand(4, tired ? 7 : 10),
      color: i % 2 === 0 ? color : "#facc15",
      alpha: tired ? 0.62 : 0.9,
      born: now,
      life: rand(tired ? 520 : 680, tired ? 780 : 1120),
    });
  }
  showPetThinking(pet, medal?.icon || "MD", { durationMs: tired ? 760 : 1050 });
}

function runMedalTrialMotion(pet, medal) {
  if (!pet) return;
  const { w, h } = viewport();
  const size = getPetSize(pet);
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  const medalId = medal?.id || "";
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 2800;
  if (medalId === "sprinter" || medalId === "relayHero") {
    const direction = pet.x < w / 2 ? 1 : -1;
    pet.targetX = clamp(pet.x + direction * rand(180, 340), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-70, 70), 0, maxY);
    pet.vx += direction * rand(3.0, 4.6);
    pet.vy += rand(-1.4, 1.4);
    pet.spinVelocity += rand(-12, 12);
  } else if (medalId === "trickAce" || medalId === "seasonStar") {
    pet.targetX = clamp(pet.x + rand(-110, 110), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-95, 45), 0, maxY);
    pet.vx += rand(-1.8, 1.8);
    pet.vy += rand(-1.8, 0.6);
    pet.spinVelocity += rand(28, 48) * (Math.random() < 0.5 ? -1 : 1);
  } else {
    pet.targetX = clamp(pet.x + rand(-95, 95), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-50, 50), 0, maxY);
    pet.vx += rand(-1.4, 1.4);
    pet.vy += rand(-1.0, 1.0);
    pet.spinVelocity += rand(-8, 8);
  }
  pet.nextTargetAt = now + 2500;
}

function spawnPetWalkBurst(pet, walk, tired = false) {
  if (!pet) return;
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const color = tired ? "#94a3b8" : walk?.color || "#42d7c5";
  const count = tired ? 8 : 18;
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + rand(-1.5, 1.5);
    pushEffectParticle({
      type: tired ? "bubble" : i % 4 === 0 ? "spark" : i % 4 === 1 ? "pixel" : "bubble",
      x: cx + rand(-10, 10),
      y: cy + rand(-8, 12),
      dx: Math.cos(angle) * rand(tired ? 8 : 18, tired ? 28 : 72),
      dy: Math.sin(angle) * rand(tired ? 10 : 20, tired ? 34 : 82),
      size: rand(3, tired ? 7 : 9),
      color: i % 2 === 0 ? color : "#facc15",
      alpha: tired ? 0.62 : 0.88,
      born: now,
      life: rand(tired ? 520 : 660, tired ? 820 : 1050),
    });
  }
  showPetThinking(pet, walk?.icon || "WK", { durationMs: tired ? 780 : 980 });
}

function runPetWalkMotion(pet, walk) {
  if (!pet) return;
  const { w, h } = viewport();
  const size = getPetSize(pet);
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  const animal = isAnimalPet(pet);
  const distance = animal ? rand(140, 260) : rand(100, 210);
  const direction = pet.x < w / 2 ? 1 : -1;
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 3000;
  if (walk?.id === "trainingTrack") {
    pet.targetX = clamp(pet.x + direction * distance, 0, maxX);
    pet.targetY = clamp(pet.y + rand(-46, 46), 0, maxY);
    pet.vx += direction * rand(2.1, animal ? 3.7 : 3.0);
    pet.vy += rand(-1.1, 1.1);
    pet.spinVelocity += rand(-8, 8);
  } else if (walk?.id === "nightStroll") {
    pet.targetX = clamp(pet.x + rand(-90, 90), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-55, 55), 0, maxY);
    pet.vx *= 0.72;
    pet.vy *= 0.72;
    pet.spinVelocity += rand(-5, 5);
  } else {
    pet.targetX = clamp(pet.x + direction * distance * 0.72, 0, maxX);
    pet.targetY = clamp(pet.y + rand(-78, 78), 0, maxY);
    pet.vx += direction * rand(1.4, animal ? 2.8 : 2.2);
    pet.vy += rand(-1.4, 1.4);
    pet.spinVelocity += rand(-10, 10);
  }
  pet.nextTargetAt = now + 2800;
}

function spawnTrainingYardBurst(pet, course, tired = false) {
  if (!pet) return;
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const color = tired ? "#94a3b8" : course?.color || "#38bdf8";
  const count = tired ? 8 : 22;
  for (let i = 0; i < count; i += 1) {
    const angle = tired
      ? -Math.PI / 2 + rand(-1.1, 1.1)
      : (Math.PI * 2 * i) / count + rand(-0.28, 0.28);
    pushEffectParticle({
      type: tired ? "bubble" : i % 5 === 0 ? "rainbow" : i % 3 === 0 ? "spark" : "pixel",
      x: cx + rand(-12, 12),
      y: cy + rand(-10, 12),
      dx: Math.cos(angle) * rand(tired ? 8 : 18, tired ? 30 : 78),
      dy: Math.sin(angle) * rand(tired ? 10 : 18, tired ? 36 : 84),
      size: rand(3, tired ? 7 : 10),
      color: i % 2 === 0 ? color : "#facc15",
      alpha: tired ? 0.62 : 0.9,
      born: now,
      life: rand(tired ? 520 : 660, tired ? 820 : 1080),
    });
  }
  showPetThinking(pet, course?.icon || "YD", { durationMs: tired ? 780 : 1040 });
}

function runTrainingYardMotion(pet, course) {
  if (!pet) return;
  const { w, h } = viewport();
  const size = getPetSize(pet);
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  const direction = pet.x < w / 2 ? 1 : -1;
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 3200;
  if (course?.id === "agilityTunnel") {
    pet.targetX = clamp(pet.x + direction * rand(170, 310), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-88, 88), 0, maxY);
    pet.vx += direction * rand(2.8, 4.5);
    pet.vy += rand(-1.8, 1.8);
    pet.spinVelocity += rand(-14, 14);
  } else if (course?.id === "recallDrill") {
    pet.targetX = clamp(w / 2 - size / 2 + rand(-80, 80), 0, maxX);
    pet.targetY = clamp(h / 2 - size / 2 + rand(-70, 70), 0, maxY);
    pet.vx += (pet.targetX > pet.x ? 1 : -1) * rand(1.8, 3.2);
    pet.vy += (pet.targetY > pet.y ? 1 : -1) * rand(0.8, 1.7);
    pet.spinVelocity += rand(-6, 6);
  } else if (course?.id === "balanceBeam") {
    pet.targetX = clamp(pet.x + direction * rand(90, 170), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-22, 22), 0, maxY);
    pet.vx += direction * rand(1.2, 2.1);
    pet.vy *= 0.45;
    pet.spinVelocity += rand(-4, 4);
  } else {
    pet.targetX = clamp(pet.x + rand(-115, 115), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-105, 48), 0, maxY);
    pet.vx += rand(-1.8, 1.8);
    pet.vy += rand(-2.1, 0.8);
    pet.spinVelocity += rand(26, 48) * (Math.random() < 0.5 ? -1 : 1);
  }
  pet.nextTargetAt = now + 3000;
}

function spawnPatrolBurst(pet, route, tired = false) {
  if (!pet) return;
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const color = tired ? "#94a3b8" : route?.color || "#42d7c5";
  const count = tired ? 7 : 16;
  for (let i = 0; i < count; i += 1) {
    const angle = route?.id === "edgeSweep"
      ? (pet.x < viewport().w / 2 ? 0 : Math.PI) + rand(-0.7, 0.7)
      : -Math.PI / 2 + rand(-1.35, 1.35);
    pushEffectParticle({
      type: tired ? "bubble" : i % 4 === 0 ? "spark" : i % 4 === 1 ? "pixel" : "bubble",
      x: cx + rand(-10, 10),
      y: cy + rand(-8, 12),
      dx: Math.cos(angle) * rand(tired ? 6 : 12, tired ? 22 : 58),
      dy: Math.sin(angle) * rand(tired ? 8 : 12, tired ? 28 : 66),
      size: rand(3, tired ? 6 : 8),
      color: i % 2 === 0 ? color : "#facc15",
      alpha: tired ? 0.58 : 0.84,
      born: now,
      life: rand(tired ? 460 : 620, tired ? 760 : 980),
    });
  }
  showPetThinking(pet, route?.icon || "PT", { durationMs: tired ? 720 : 940 });
}

function runPatrolMotion(pet, route) {
  if (!pet) return;
  const { w, h } = viewport();
  const size = getPetSize(pet);
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const now = performance.now();
  const direction = pet.x < w / 2 ? 1 : -1;
  pet.pausedByPanel = false;
  pet.aiControlledUntil = now + 2600;
  if (route?.id === "edgeSweep") {
    const edgeY = pet.y < h / 2 ? rand(20, 90) : rand(Math.max(20, h - 120), Math.max(20, h - 55));
    pet.targetX = clamp(pet.x + direction * rand(120, 240), 0, maxX);
    pet.targetY = clamp(edgeY, 0, maxY);
    pet.vx += direction * rand(1.5, 2.7);
    pet.vy += (pet.targetY > pet.y ? 1 : -1) * rand(0.4, 1.2);
  } else if (route?.id === "cursorTrail") {
    const hasMouse = mouseX > -100 && mouseY > -100;
    pet.targetX = clamp((hasMouse ? mouseX : w / 2) - size / 2 + rand(-70, 70), 0, maxX);
    pet.targetY = clamp((hasMouse ? mouseY : h / 2) - size / 2 + rand(-60, 60), 0, maxY);
    pet.vx += (pet.targetX > pet.x ? 1 : -1) * rand(1.2, 2.4);
    pet.vy += (pet.targetY > pet.y ? 1 : -1) * rand(0.6, 1.5);
  } else if (route?.id === "iconWatch") {
    pet.targetX = clamp(pet.x + rand(-85, 85), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-70, 70), 0, maxY);
    pet.vx += rand(-1.0, 1.0);
    pet.vy += rand(-0.8, 0.8);
    pet.spinVelocity += rand(-9, 9);
  } else {
    pet.targetX = clamp(pet.x + rand(-70, 70), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-45, 45), 0, maxY);
    pet.vx *= 0.62;
    pet.vy *= 0.62;
    pet.spinVelocity += rand(-4, 4);
  }
  pet.nextTargetAt = now + 2500;
}

function spawnAmbientBurst(pet, event) {
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  const color = event?.color || TIME_BANDS[currentTimeBandId()]?.color || "#42d7c5";
  for (let i = 0; i < 14; i += 1) {
    const angle = -Math.PI / 2 + rand(-1.2, 1.2);
    pushEffectParticle({
      type: i % 3 === 0 ? "bubble" : i % 3 === 1 ? "spark" : "pixel",
      x: cx + rand(-10, 10),
      y: cy + rand(-8, 10),
      dx: Math.cos(angle) * rand(8, 38),
      dy: Math.sin(angle) * rand(16, 58),
      size: rand(3, 8),
      color,
      alpha: 0.84,
      born: now,
      life: rand(620, 920),
    });
  }
}

function triggerAmbientEvent(pet, now = performance.now()) {
  const slot = settings?.slots?.[pet.slotIndex];
  if (!slot) return;
  const date = new Date();
  const game = ensureGame();
  const ambient = normalizeAmbientEvents(game.ambientEvents);
  const key = ambientKey(date);
  if (ambient.lastKey === key && Date.now() - ambient.lastAt < 20 * 60 * 1000) return;

  const event = pickAmbientEvent(pet, date);
  const care = careForPet(pet, { decay: true });
  const reward = event.reward || {};
  if (reward.hunger) care.hunger = Math.round(clamp(care.hunger + reward.hunger, 0, 100));
  if (reward.happiness) care.happiness = Math.round(clamp(care.happiness + reward.happiness, 0, 100));
  if (reward.energy) care.energy = Math.round(clamp(care.energy + reward.energy, 0, 100));
  if (reward.hygiene) care.hygiene = Math.round(clamp(care.hygiene + reward.hygiene, 0, 100));
  if (reward.training) care.training = Math.round(clamp(care.training + reward.training, 0, 100));
  if (reward.bond) care.bond = Math.round(clamp(care.bond + reward.bond, 0, 9999));
  if (reward.xp) addCareXp(care, reward.xp);
  if (reward.coins) game.coins = Math.round(clamp(game.coins + reward.coins, 0, 999999));
  care.lastCareAt = Date.now();

  ambient.counts[event.id] = Math.round(clamp((ambient.counts[event.id] || 0) + 1, 0, 9999));
  ambient.lastAt = Date.now();
  ambient.lastId = event.id;
  ambient.lastKey = key;
  game.ambientEvents = normalizeAmbientEvents(ambient);
  slot.care = normalizeCare(care);
  settings.game = normalizeGame(game);
  pet.care = slot.care;

  const line = ambientLine(pet, event, date);
  recordMemory(pet, event.icon, line);
  spawnAmbientBurst(pet, event);
  pet.vx += rand(-0.7, 0.7);
  pet.vy += rand(-0.6, 0.6);
  pet.spinVelocity += rand(-5, 5);
  showPetThought(pet, line, { durationMs: 4800 });
  if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  saveSettingsSoon(1200);
  pet.nextAmbientAt = now + rand(70000, 150000);
}

function triggerPetInteraction(a, b, now) {
  const interaction = weightedSocialType(a, b);
  a.lastSocialAt = now;
  b.lastSocialAt = now + rand(250, 900);
  boostCareForSocial(a, interaction);
  boostCareForSocial(b, interaction);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1;
  const impulse = interaction.impulse;
  if (interaction.id === "follow") {
    a.targetX = b.x;
    a.targetY = b.y;
    b.targetX = clamp(b.x + (dx / distance) * 90, 0, Math.max(0, viewport().w - getPetSize(b)));
    b.targetY = clamp(b.y + (dy / distance) * 70, 0, Math.max(0, viewport().h - getPetSize(b)));
  } else if (interaction.id === "nap") {
    a.vx *= 0.35;
    a.vy *= 0.35;
    b.vx *= 0.35;
    b.vy *= 0.35;
    a.replySlowUntil = now + 2200;
    b.replySlowUntil = now + 2200;
  } else {
    a.vx -= (dx / distance) * impulse;
    a.vy -= (dy / distance) * impulse;
    b.vx += (dx / distance) * impulse;
    b.vy += (dy / distance) * impulse;
  }
  a.spinVelocity += rand(-8, 8);
  b.spinVelocity += rand(-8, 8);
  spawnSocialBurst(a, b, interaction);
  const friendship = boostFriendship(a, b, interaction.id === "play" ? 5 : interaction.id === "share" ? 6 : 3);
  const completedQuests = updateDailyQuests("social");
  const friendshipPart = currentLanguage() === "ko"
    ? ` 관계는 ${friendshipLabel(friendship)} ${friendship}.`
    : ` Friendship: ${friendshipLabel(friendship)} ${friendship}.`;
  const line = `${socialLine(a, b, interaction.id)}${friendshipPart}${questRewardLine(completedQuests)}`;
  recordMemory(a, "◆", line);
  recordMemory(b, "◆", line);
  if (!activePet || panel.hidden) {
    showPetThought(Math.random() < 0.5 ? a : b, line, { durationMs: 4200 });
  }
  saveSettingsSoon();
}

function playdateUnavailableLine(pet, other, reason) {
  const character = characterFor(pet.characterId);
  const otherCharacter = characterFor(other.characterId);
  if (currentLanguage() === "ko") {
    const text = reason === "energy" ? careText("playdateNeedEnergy") : careText("playdateCooldown");
    return `${localStyleFor(character.id)} ${otherCharacter.name}와 만나고 싶지만 ${text}.`;
  }
  const text = reason === "energy" ? careText("playdateNeedEnergy") : careText("playdateCooldown");
  return `${localStyleFor(character.id)} Wants to meet ${otherCharacter.name}, but ${text}.`;
}

function performPlaydate(pet, other) {
  if (!pet || !other || pet.slotIndex === other.slotIndex) return;
  const now = performance.now();
  if (now - (pet.lastPlaydateAt || 0) < PLAYDATE_COOLDOWN_MS || now - (other.lastPlaydateAt || 0) < PLAYDATE_COOLDOWN_MS) {
    showPetThought(pet, playdateUnavailableLine(pet, other, "cooldown"), { durationMs: 3200 });
    return;
  }
  const slot = settings?.slots?.[pet.slotIndex];
  const otherSlot = settings?.slots?.[other.slotIndex];
  if (!slot || !otherSlot) return;
  const care = careForPet(pet, { decay: true });
  const otherCare = careForPet(other, { decay: true });
  if (care.energy < PLAYDATE_ENERGY_COST || otherCare.energy < PLAYDATE_ENERGY_COST) {
    showPetThought(pet, playdateUnavailableLine(pet, other, "energy"), { durationMs: 3400 });
    return;
  }

  const interaction = weightedSocialType(pet, other);
  care.energy = Math.round(clamp(care.energy - PLAYDATE_ENERGY_COST, 0, 100));
  otherCare.energy = Math.round(clamp(otherCare.energy - PLAYDATE_ENERGY_COST, 0, 100));
  care.happiness = Math.round(clamp(care.happiness + 4, 0, 100));
  otherCare.happiness = Math.round(clamp(otherCare.happiness + 4, 0, 100));
  care.bond = Math.round(clamp(care.bond + 1, 0, 9999));
  otherCare.bond = Math.round(clamp(otherCare.bond + 1, 0, 9999));
  addCareXp(care, 5);
  addCareXp(otherCare, 5);
  care.actionCounts.playdate = (care.actionCounts.playdate || 0) + 1;
  otherCare.actionCounts.playdate = (otherCare.actionCounts.playdate || 0) + 1;
  care.lastActionAt = Date.now();
  otherCare.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  otherCare.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  otherSlot.care = normalizeCare(otherCare);
  pet.care = slot.care;
  other.care = otherSlot.care;

  pet.lastPlaydateAt = now;
  other.lastPlaydateAt = now;
  pet.lastSocialAt = now;
  other.lastSocialAt = now + rand(250, 900);
  pet.pausedByPanel = false;
  other.pausedByPanel = false;
  pet.aiControlledUntil = now + 2600;
  other.aiControlledUntil = now + 2600;
  const friendship = boostFriendship(pet, other, interaction.id === "share" ? 10 : interaction.id === "play" ? 9 : 7);
  const completedQuests = updateDailyQuests("social");
  const friendshipPart = currentLanguage() === "ko"
    ? ` 플레이데이트 후 관계는 ${friendshipLabel(friendship)} ${friendship}.`
    : ` After the playdate: ${friendshipLabel(friendship)} ${friendship}.`;
  const line = `${socialLine(pet, other, interaction.id)}${friendshipPart}${questRewardLine(completedQuests)}`;

  const dx = other.x - pet.x;
  const dy = other.y - pet.y;
  const distance = Math.hypot(dx, dy) || 1;
  pet.targetX = clamp(other.x - (dx / distance) * 48, 0, Math.max(0, viewport().w - getPetSize(pet)));
  pet.targetY = clamp(other.y - (dy / distance) * 36, 0, Math.max(0, viewport().h - getPetSize(pet)));
  other.targetX = clamp(pet.x + (dx / distance) * 48, 0, Math.max(0, viewport().w - getPetSize(other)));
  other.targetY = clamp(pet.y + (dy / distance) * 36, 0, Math.max(0, viewport().h - getPetSize(other)));
  pet.vx += rand(-1.1, 1.1);
  pet.vy += rand(-0.9, 0.9);
  other.vx += rand(-1.1, 1.1);
  other.vy += rand(-0.9, 0.9);
  pet.spinVelocity += rand(-10, 10);
  other.spinVelocity += rand(-10, 10);
  spawnSocialBurst(pet, other, interaction);
  recordMemory(pet, "PD", line);
  recordMemory(other, "PD", line);
  showPetThought(pet, line, { durationMs: 4600 });
  saveSettingsSoon(900);
}

function performDuoMove(pet, other, moveId) {
  const move = DUO_MOVES[moveId];
  const slot = settings?.slots?.[pet?.slotIndex];
  const otherSlot = settings?.slots?.[other?.slotIndex];
  if (!move || !slot || !otherSlot || pet.slotIndex === other.slotIndex) return;
  const character = characterFor(pet.characterId);
  const otherCharacter = characterFor(other.characterId);
  const readiness = duoMoveReady(pet, other, move);
  if (!readiness.ok) {
    const line = duoUnavailableLine(character, otherCharacter, move, readiness.reason, readiness.friendship);
    showPetThought(pet, line, { durationMs: 3600 });
    spawnDuoBurst(pet, other, move);
    return;
  }

  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const otherCare = careForPet(other, { decay: true });
  const reward = move.reward || {};
  for (const targetCare of [care, otherCare]) {
    targetCare.energy = Math.round(clamp(targetCare.energy - move.energyCost + (reward.energy || 0), 0, 100));
    targetCare.hunger = Math.round(clamp(targetCare.hunger + (reward.hunger || 0), 0, 100));
    targetCare.happiness = Math.round(clamp(targetCare.happiness + (reward.happiness || 0), 0, 100));
    targetCare.training = Math.round(clamp(targetCare.training + (reward.training || 0), 0, 100));
    targetCare.bond = Math.round(clamp(targetCare.bond + (reward.bond || 0), 0, 9999));
    targetCare.actionCounts.duoMove = (targetCare.actionCounts.duoMove || 0) + 1;
    targetCare.actionCounts[`duo:${moveId}`] = (targetCare.actionCounts[`duo:${moveId}`] || 0) + 1;
    targetCare.lastActionAt = Date.now();
    targetCare.lastCareAt = Date.now();
    addCareXp(targetCare, reward.xp || 0);
  }
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  settings.game = normalizeGame(game);
  slot.care = normalizeCare(care);
  otherSlot.care = normalizeCare(otherCare);
  pet.care = slot.care;
  other.care = otherSlot.care;
  const friendship = boostFriendship(pet, other, reward.friendship || 6);
  const completedQuests = updateDailyQuests("duo");
  settings.game = normalizeGame(settings.game);

  const now = performance.now();
  pet.lastSocialAt = now;
  other.lastSocialAt = now + rand(250, 900);
  pet.pausedByPanel = false;
  other.pausedByPanel = false;
  pet.aiControlledUntil = now + 2600;
  other.aiControlledUntil = now + 2600;
  const dx = other.x - pet.x;
  const dy = other.y - pet.y;
  const distance = Math.hypot(dx, dy) || 1;
  const { w, h } = viewport();
  pet.targetX = clamp(pet.x + (dx / distance) * rand(46, 92), 0, Math.max(0, w - getPetSize(pet)));
  pet.targetY = clamp(pet.y + (dy / distance) * rand(32, 72), 0, Math.max(0, h - getPetSize(pet)));
  other.targetX = clamp(other.x - (dx / distance) * rand(46, 92), 0, Math.max(0, w - getPetSize(other)));
  other.targetY = clamp(other.y - (dy / distance) * rand(32, 72), 0, Math.max(0, h - getPetSize(other)));
  pet.vx += rand(-1.7, 1.7);
  pet.vy += rand(-1.2, 1.2);
  other.vx += rand(-1.7, 1.7);
  other.vy += rand(-1.2, 1.2);
  pet.spinVelocity += rand(-15, 15);
  other.spinVelocity += rand(-15, 15);

  const line = duoMoveLine(character, otherCharacter, move, friendship, reward, completedQuests);
  recordMemory(pet, move.icon, line);
  recordMemory(other, move.icon, line);
  spawnDuoBurst(pet, other, move);
  spawnMilestoneBurst(pet);
  showPetThought(pet, line, { durationMs: 5000 });
  showPetThought(other, line, { durationMs: 3600 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performPackEvent(pet, eventId) {
  const event = PACK_EVENTS[eventId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!event || !slot) return;
  const readiness = packEventReady(pet, event);
  const character = characterFor(pet.characterId);
  if (!readiness.ok) {
    const line = readiness.reason === "members"
      ? `${localStyleFor(character.id)} ${careText("packNeedMembers")} · ${readiness.members.length}/${event.minMembers}`
      : `${localStyleFor(character.id)} ${careText("packNeedEnergy")} · -${event.energyCost} ${careText("energy")}`;
    showPetThought(pet, line, { durationMs: 3400 });
    spawnPackBurst(readiness.members.length ? readiness.members : [pet], event);
    return;
  }

  const members = readiness.members;
  const reward = event.reward || {};
  const game = ensureGame();
  let leveled = false;
  let discoveryExtra = "";
  for (const member of members) {
    const memberSlot = settings?.slots?.[member.slotIndex];
    if (!memberSlot) continue;
    const memberCare = careForPet(member, { decay: true });
    memberCare.energy = Math.round(clamp(memberCare.energy - event.energyCost + (reward.energy || 0), 0, 100));
    memberCare.hunger = Math.round(clamp(memberCare.hunger + (reward.hunger || 0), 0, 100));
    memberCare.happiness = Math.round(clamp(memberCare.happiness + (reward.happiness || 0), 0, 100));
    memberCare.hygiene = Math.round(clamp(memberCare.hygiene + (reward.hygiene || 0), 0, 100));
    memberCare.training = Math.round(clamp(memberCare.training + (reward.training || 0), 0, 100));
    memberCare.bond = Math.round(clamp(memberCare.bond + (reward.bond || 0), 0, 9999));
    memberCare.actionCounts.packEvent = (memberCare.actionCounts.packEvent || 0) + 1;
    memberCare.actionCounts[`pack:${eventId}`] = (memberCare.actionCounts[`pack:${eventId}`] || 0) + 1;
    memberCare.lastActionAt = Date.now();
    memberCare.lastCareAt = Date.now();
    leveled = addCareXp(memberCare, reward.xp || 0) || leveled;
    memberSlot.care = normalizeCare(memberCare);
    member.care = memberSlot.care;
  }

  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  if (reward.discover) {
    const anchorCare = careForPet(pet);
    const item = pickDiscoveryItem(anchorCare);
    const find = addDiscoveryToCollection(
      game,
      anchorCare,
      item,
      (firstFound) => item.reward + (firstFound ? 3 : 1),
      { min: 1, max: 12 },
    );
    game.coins = Math.round(clamp(game.coins + find.reward, 0, 999999));
    discoveryExtra = currentLanguage() === "ko"
      ? ` ${discoveryLabel(item)} 발견. +${find.reward} ${careText("coins")}.`
      : ` Found ${discoveryLabel(item)}. +${find.reward} ${careText("coins")}.`;
    if (find.firstFound) discoveryExtra += currentLanguage() === "ko" ? " 새 도감 등록." : " New collection entry.";
    if (find.charmBonus?.xp) leveled = addCareXp(anchorCare, find.charmBonus.xp) || leveled;
    const anchorSlot = settings?.slots?.[pet.slotIndex];
    if (anchorSlot) {
      anchorSlot.care = normalizeCare(anchorCare);
      pet.care = anchorSlot.care;
    }
  }

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      boostFriendship(members[i], members[j], reward.friendship || 5);
    }
  }
  for (const member of members) {
    const memberSlot = settings?.slots?.[member.slotIndex];
    if (!memberSlot) continue;
    memberSlot.care = normalizeCare(member.care || memberSlot.care);
    member.care = memberSlot.care;
  }

  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("pack");
  settings.game = normalizeGame(settings.game);
  runPackMotion(members, event);
  spawnPackBurst(members, event);
  if (reward.discover) spawnDiscoveryBurst(pet);
  const levelText = leveled ? (currentLanguage() === "ko" ? " 팀 레벨업도 있었어!" : " Team level up!") : "";
  const line = `${packEventLine(character, event, members, reward, completedQuests)}${discoveryExtra}${levelText}`;
  for (const member of members) recordMemory(member, event.icon, line);
  showPetThought(pet, line, { durationMs: 5600 });
  for (const member of members) {
    if (member !== pet) showPetThought(member, line, { durationMs: 3600 });
  }
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function performContest(pet, contestId) {
  const contest = PET_CONTESTS[contestId];
  const slot = settings?.slots?.[pet?.slotIndex];
  if (!contest || !slot) return;
  const readiness = contestReady(pet, contest);
  const character = characterFor(pet.characterId);
  if (!readiness.ok) {
    const line = readiness.reason === "level"
      ? `${localStyleFor(character.id)} ${careText("contestNeedLevel")} ${contest.minLevel}.`
      : `${localStyleFor(character.id)} ${careText("contestNeedEnergy")} · -${contest.energyCost} ${careText("energy")}.`;
    showPetThought(pet, line, { durationMs: 3400 });
    spawnContestBurst(pet, contest, contestTierFor(contestScoreFor(readiness.care, contest)));
    return;
  }

  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const score = contestScoreFor(care, contest, { random: true });
  const tier = contestTierFor(score);
  const reward = contestRewardFor(contest, score, tier);
  let leveled = false;
  care.energy = Math.round(clamp(care.energy - contest.energyCost, 0, 100));
  care.happiness = Math.round(clamp(care.happiness + (reward.happiness || 0), 0, 100));
  care.hygiene = Math.round(clamp(care.hygiene + (reward.hygiene || 0), 0, 100));
  care.training = Math.round(clamp(care.training + (reward.training || 0), 0, 100));
  care.bond = Math.round(clamp(care.bond + (reward.bond || 0), 0, 9999));
  care.actionCounts.contestRun = (care.actionCounts.contestRun || 0) + 1;
  care.actionCounts[`contest:${contestId}`] = (care.actionCounts[`contest:${contestId}`] || 0) + 1;
  care.actionCounts[`contestBest:${contestId}`] = Math.max(contestBestScore(care, contestId), score);
  care.lastActionAt = Date.now();
  care.lastCareAt = Date.now();
  leveled = addCareXp(care, reward.xp || 0) || leveled;
  game.coins = Math.round(clamp(game.coins + (reward.coins || 0), 0, 999999));
  slot.care = normalizeCare(care);
  pet.care = slot.care;

  if (contestId === "friendRelay") {
    const friends = activePackMembers(pet, { minMembers: 2 }).filter((member) => member.slotIndex !== pet.slotIndex).slice(0, 3);
    for (const friend of friends) {
      const scoreNow = boostFriendship(pet, friend, tier.id === "master" ? 8 : tier.id === "gold" ? 6 : 4);
      showPetThinking(friend, `${scoreNow}`, { durationMs: 800 });
    }
  }

  const seasonGain = addLeagueSeasonPoints(game, score, tier);
  settings.game = normalizeGame(game);
  const completedQuests = updateDailyQuests("contest");
  settings.game = normalizeGame(settings.game);
  const levelText = leveled ? (currentLanguage() === "ko" ? " 레벨업!" : " Level up!") : "";
  const seasonText = currentLanguage() === "ko"
    ? ` ${careText("leagueSeasonGain")} +${seasonGain}.`
    : ` ${careText("leagueSeasonGain")} +${seasonGain}.`;
  const line = `${contestLine(character, contest, score, tier, reward, completedQuests)}${seasonText}${levelText}`;
  recordMemory(pet, contest.icon, line);
  runContestMotion(pet, contest);
  spawnContestBurst(pet, contest, tier);
  showPetThought(pet, line, { durationMs: 5400 });
  api.updateSettings(settings).then((next) => {
    settings = next;
    syncPets();
    if (activePet === pet && !panel.hidden) openPanel(pet, { noBurst: true });
  });
}

function discoveryLine(pet, item, reward, firstFound) {
  const character = characterFor(pet.characterId);
  const care = pet.care || careForPet(pet);
  const toy = toyForCare(care);
  const seed = [
    pet.characterId,
    care.level,
    care.equippedToy,
    item?.id || "",
    Math.floor(performance.now() / 7000),
    reward,
  ].join(":");
  const base = buildDiscoveryDetail({
    language: currentLanguage(),
    characterName: character.name,
    mood: careText(careMood(care)),
    stage: careText(careStage(care)),
    toyName: toy ? careText(toy.labelKey) : "",
    findName: discoveryLabel(item),
    reward,
    coinText: careText("coins"),
    seed,
  });
  if (!firstFound) return base;
  return currentLanguage() === "ko"
    ? `${base} 새 도감에 등록했어.`
    : `${base} Added to the collection.`;
}

function triggerDiscovery(pet) {
  const slot = settings?.slots?.[pet.slotIndex];
  if (!slot) return;
  const game = ensureGame();
  const care = careForPet(pet, { decay: true });
  const item = pickDiscoveryItem(care);
  const toyBonus = toyForCare(care) ? 1 : 0;
  const find = addDiscoveryToCollection(
    game,
    care,
    item,
    (firstFound) => 1 + Math.floor(rand(0, 3)) + Math.floor(care.level / 4) + toyBonus + item.reward + (firstFound ? 2 : 0),
    { min: 1, max: 14 },
  );
  const firstFound = find.firstFound;
  const reward = find.reward;
  game.coins = Math.round(clamp(game.coins + reward, 0, 999999));
  care.happiness = Math.round(clamp(care.happiness + 3 + toyBonus, 0, 100));
  care.training = Math.round(clamp(care.training + (careStage(care) === "ace" ? 2 : 1), 0, 100));
  care.bond = Math.round(clamp(care.bond + 1, 0, 9999));
  addCareXp(care, 4 + reward + (find.charmBonus?.xp || 0));
  care.lastCareAt = Date.now();
  slot.care = normalizeCare(care);
  settings.game = normalizeGame(game);
  pet.care = slot.care;
  const completedQuests = updateDailyQuests("discover");
  const line = `${discoveryLine(pet, item, reward, firstFound)}${questRewardLine(completedQuests)}`;
  recordMemory(pet, item.icon, line);
  spawnDiscoveryBurst(pet);
  showPetThought(pet, line, { durationMs: 4700 });
  saveSettingsSoon(1100);
}

function clampMagnitude(x, y, max) {
  const length = Math.hypot(x, y);
  if (!length || length <= max) return { x, y };
  return { x: (x / length) * max, y: (y / length) * max };
}

function trackMouse(x, y, now = performance.now()) {
  const validPrevious = mouseLastAt > 0 && mouseLastX > -9990 && mouseLastY > -9990;
  if (validPrevious) {
    const dt = Math.max(8, now - mouseLastAt);
    const velocity = clampMagnitude(((x - mouseLastX) / dt) * 16.67, ((y - mouseLastY) / dt) * 16.67, 12);
    mouseVx = mouseVx * 0.6 + velocity.x * 0.4;
    mouseVy = mouseVy * 0.6 + velocity.y * 0.4;
  } else {
    mouseVx = 0;
    mouseVy = 0;
  }
  mouseX = x;
  mouseY = y;
  mouseLastX = x;
  mouseLastY = y;
  mouseLastAt = now;
}

function syncGhostBubbleState(hidden = ghostHidden) {
  for (const pet of pets) {
    for (const bubble of [pet.thoughtEl, pet.thinkingEl]) {
      if (bubble) bubble.classList.toggle("is-ghost-hidden", hidden);
    }
  }
}

function setGhostHidden(hidden) {
  if (ghostHidden === hidden) {
    syncGhostBubbleState(hidden);
    return;
  }
  const wasHidden = ghostHidden;
  const now = performance.now();
  ghostHidden = hidden;
  ghostHiddenAt = hidden ? now : 0;
  document.body.classList.toggle("ghost-hidden", hidden);
  syncGhostBubbleState(hidden);
  if (hidden) {
    effectParticles = [];
    effectsDirty = true;
  }
  for (const pet of pets) {
    pet.el.classList.remove("ghost-in", "ghost-out");
    void pet.el.offsetWidth;
    pet.el.classList.toggle("is-ghosted", hidden);
    pet.el.classList.add(hidden ? "ghost-out" : "ghost-in");
    if (!hidden && wasHidden && pet.enabled && !pet.dragging && !pet.pausedByPanel) {
      pickTarget(pet, now);
      wakePet(pet, 0.76);
    }
  }
  // Tell main to ease off the high-frequency cursor poll while pets are hidden
  // (you are working) — they don't follow/avoid the cursor when hidden.
  if (typeof api.setOverlayIdle === "function") api.setOverlayIdle(hidden);
}

function ghostShowDelayMs() {
  return clamp(Number(settings?.ghostDelaySeconds || DEFAULT_GHOST_SHOW_DELAY_MS / 1000), 1, 15) * 1000;
}

function ghostOpacity() {
  return 0;
}

function syncGhostSettings() {
  document.body.style.setProperty("--ghost-opacity", String(ghostOpacity()));
}

function freezePetForGhost(pet, now = performance.now()) {
  pet.vx = 0;
  pet.vy = 0;
  pet.spinVelocity = 0;
  pet.targetX = pet.x;
  pet.targetY = pet.y;
  pet.nextTargetAt = now + 1200;
}

function ghostMotionFrozen(now = performance.now()) {
  return ghostHidden && ghostHiddenAt > 0 && now - ghostHiddenAt >= GHOST_FREEZE_DELAY_MS;
}

function updateGhostMode(now = performance.now()) {
  if (!settings?.ghostMode || activePet || areaPicker) {
    setGhostHidden(false);
    return;
  }
  if (ghostHidden && ghostLastMotionAt > 0 && now - ghostLastMotionAt >= ghostShowDelayMs()) {
    setGhostHidden(false);
  }
}

function ghostTriggerEnabled(source) {
  if (source === "mouse") return settings?.ghostTriggerMouse !== false;
  if (source === "keyboard") return settings?.ghostTriggerKeyboard !== false;
  if (source === "wheel") return settings?.ghostTriggerWheel !== false;
  if (source === "global") return settings?.ghostTriggerKeyboard !== false || settings?.ghostTriggerWheel !== false;
  return true;
}

function registerUserActivity(now = performance.now(), source = "mouse") {
  if (!ghostTriggerEnabled(source)) return;
  if (settings?.ghostMode && !activePet && !areaPicker) {
    ghostLastMotionAt = now;
    setGhostHidden(true);
  }
}

function registerSystemIdle(idleMs, source = "keyboard", now = performance.now()) {
  const idle = Number(idleMs);
  if (!Number.isFinite(idle) || idle < 0 || !settings?.ghostMode || activePet || areaPicker) return;
  if (!ghostTriggerEnabled(source)) return;
  if (idle < ghostShowDelayMs()) {
    ghostLastMotionAt = now - idle;
    setGhostHidden(true);
  }
}

function registerPointerPoint(x, y, now = performance.now()) {
  const validPrevious = mouseLastAt > 0 && mouseLastX > -9990 && mouseLastY > -9990;
  const moved = validPrevious && Math.hypot(x - mouseLastX, y - mouseLastY) >= GHOST_MOVE_THRESHOLD;
  if (moved) registerUserActivity(now, "mouse");
  trackMouse(x, y, now);
  return moved;
}

function characterFor(id) {
  const custom = customCharacterFor(id);
  if (custom) {
    return {
      id: custom.id,
      name: custom.name || "Custom",
      concept: String(custom.concept || "").trim(),
      frames: 1,
      movement: DEFAULT_MOVEMENT,
      render: (ctx) => renderCustomSprite(ctx, custom),
    };
  }
  return CHARACTERS[id] || CHARACTERS[DEFAULT_CHARACTER];
}

function customCharacterFor(id) {
  return Array.isArray(settings?.customCharacters)
    ? settings.customCharacters.find((character) => character?.id === id) || null
    : null;
}

function customHasImage(custom) {
  return !!String(custom?.imagePath || "").trim();
}

function spriteResolutionFor(pet) {
  return customHasImage(customCharacterFor(pet.characterId)) ? IMAGE_SPRITE_RES : SPRITE_RES;
}

function drawContainedImage(ctx, image, width, height) {
  const sourceW = image.naturalWidth || image.width || width;
  const sourceH = image.naturalHeight || image.height || height;
  const scale = Math.min(width / sourceW, height / sourceH);
  const drawW = Math.max(1, Math.round(sourceW * scale));
  const drawH = Math.max(1, Math.round(sourceH * scale));
  const x = Math.round((width - drawW) / 2);
  const y = Math.round((height - drawH) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, x, y, drawW, drawH);
}

function invalidateCustomSprites(imagePath) {
  for (const pet of pets) {
    const custom = customCharacterFor(pet.characterId);
    if (custom?.imagePath !== imagePath) continue;
    pet._lastFrame = null;
    pet._lastCharacter = null;
    renderSprite(pet, true);
  }
}

function spriteImageRecord(imagePath) {
  const value = String(imagePath || "").trim();
  if (!value) return null;
  const cached = spriteImageCache.get(value);
  if (cached) return cached;
  const record = { image: new Image(), ready: false, failed: false };
  record.image.decoding = "async";
  record.image.onload = () => {
    record.ready = true;
    invalidateCustomSprites(value);
  };
  record.image.onerror = () => {
    record.failed = true;
  };
  record.image.src = fileUrlFromPath(value);
  spriteImageCache.set(value, record);
  return record;
}

function renderCustomSprite(ctx, custom) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);
  const record = spriteImageRecord(custom?.imagePath);
  if (record?.ready) {
    drawContainedImage(ctx, record.image, width, height);
    return;
  }
  ctx.imageSmoothingEnabled = false;
  const pixels = Array.isArray(custom?.pixels) ? custom.pixels : [];
  const cell = Math.max(1, Math.floor(Math.min(width, height) / CUSTOM_GRID_SIZE));
  const offsetX = Math.floor((width - cell * CUSTOM_GRID_SIZE) / 2);
  const offsetY = Math.floor((height - cell * CUSTOM_GRID_SIZE) / 2);
  for (let index = 0; index < CUSTOM_GRID_SIZE * CUSTOM_GRID_SIZE; index += 1) {
    const color = pixels[index];
    if (!color) continue;
    const x = index % CUSTOM_GRID_SIZE;
    const y = Math.floor(index / CUSTOM_GRID_SIZE);
    ctx.fillStyle = color;
    ctx.fillRect(offsetX + x * cell, offsetY + y * cell, cell, cell);
  }
}

function fileUrlFromPath(filePath) {
  const value = String(filePath || "").trim();
  if (!value) return "";
  return `file://${value.split("/").map(encodeURIComponent).join("/")}`;
}

function fileNameFromPath(filePath) {
  return String(filePath || "").split("/").filter(Boolean).pop() || "";
}

function behaviorFor(slot) {
  return {
    movementStyle: "free",
    orientationMode: "smart",
    mouseMode: "avoid",
    areaPreset: "all",
    area: AREA_PRESETS.all,
    speedMultiplier: 1,
    scale: 1,
    effectMode: "normal",
    effectIntensity: 1,
    ...(slot?.behavior || {}),
  };
}

function effectiveBehaviorForPet(pet, now = performance.now()) {
  const base = pet?.behavior || behaviorFor(null);
  if (!pet?.aiBehaviorOverride || now >= (pet.aiControlledUntil || 0)) return base;
  return {
    ...base,
    ...pet.aiBehaviorOverride,
    area: pet.aiBehaviorOverride.area || base.area,
  };
}

function getPetSize(pet) {
  return Math.round(BASE_SIZE * (pet.behavior?.scale || 1));
}

function viewport() {
  return viewportCache;
}

function performanceProfile() {
  const mode = settings?.performanceMode || "saver";
  const fps = clamp(Math.round(Number(settings?.fps || 16)), 10, 120);
  const signature = `${mode}:${fps}`;
  if (performanceProfileCache && performanceProfileSignature === signature) return performanceProfileCache;
  const base = PERFORMANCE_PROFILES[mode] || PERFORMANCE_PROFILES.saver;
  performanceProfileSignature = signature;
  performanceProfileCache = {
    ...base,
    frameMs: 1000 / fps,
    heavyFrameMs: 1000 / Math.max(10, Math.round(fps * 0.75)),
  };
  return performanceProfileCache;
}

function stutterGuardActive(now = performance.now()) {
  return now < stutterGuardUntil;
}

function recordFrameHealth(now, dt, profile) {
  const longFrameMs = Math.max(STUTTER_FRAME_MS, profile.frameMs * 4);
  if (dt <= longFrameMs) return;
  stutterGuardUntil = Math.max(stutterGuardUntil, now + STUTTER_GUARD_MS);
}

function hasActiveRainbow() {
  return pets.some((pet) => pet.enabled && pet.behavior?.effectMode === "rainbow");
}

function activeRainbowCount() {
  return pets.filter((pet) => pet.enabled && pet.behavior?.effectMode === "rainbow").length;
}

function maxEffectParticles() {
  if (!hasActiveRainbow()) return performanceProfile().maxParticles;
  const mode = settings?.performanceMode || "saver";
  if (stutterGuardActive()) {
    if (mode === "smooth") return 84;
    if (mode === "balanced") return 64;
    return 42;
  }
  if (mode === "smooth") return 120;
  if (mode === "balanced") return 90;
  return 60;
}

function resizeEffectsCanvas() {
  if (!effectsCanvas || !effectsCtx) return;
  const { w, h } = viewport();
  const nextDpr = Math.min(window.devicePixelRatio || 1, performanceProfile().dpr);
  const signature = `${w}x${h}@${nextDpr}`;
  if (effectsCanvasSignature === signature) return;
  effectsCanvasSignature = signature;
  effectsDpr = nextDpr;
  effectsCanvas.width = Math.max(1, Math.ceil(w * effectsDpr));
  effectsCanvas.height = Math.max(1, Math.ceil(h * effectsDpr));
  effectsCanvas.style.width = `${w}px`;
  effectsCanvas.style.height = `${h}px`;
  effectsCtx.setTransform(effectsDpr, 0, 0, effectsDpr, 0, 0);
}

function pushEffectParticle(particle) {
  if (!effectsCtx) return;
  effectParticles.push(particle);
  effectsDirty = true;
  const overflow = effectParticles.length - maxEffectParticles();
  if (overflow > 0) effectParticles.splice(0, overflow);
}

function drawDiamond(ctx, x, y, size) {
  const half = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y - half);
  ctx.lineTo(x + half, y);
  ctx.lineTo(x, y + half);
  ctx.lineTo(x - half, y);
  ctx.closePath();
  ctx.fill();
}

function drawDesktopObject(ctx, object, now) {
  const def = DESKTOP_OBJECTS[object.objectId] || DESKTOP_OBJECTS.bounceBall;
  const pulse = 1 + Math.sin(now / 120 + object.x * 0.01) * 0.08;
  const size = Math.max(12, object.size * pulse);
  const x = object.x;
  const y = object.y;
  ctx.save();
  ctx.globalAlpha = clamp(1 - Math.max(0, now - object.born - object.life + 1500) / 1500, 0, 1);
  ctx.fillStyle = def.color;
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.imageSmoothingEnabled = false;

  if (def.kind === "ball") {
    ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
    ctx.strokeRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(Math.round(x - size * 0.18), Math.round(y - size * 0.34), Math.max(2, Math.round(size * 0.18)), Math.max(2, Math.round(size * 0.18)));
  } else if (def.kind === "treat") {
    ctx.fillRect(Math.round(x - size * 0.48), Math.round(y - size * 0.25), Math.round(size * 0.96), Math.round(size * 0.5));
    ctx.strokeRect(Math.round(x - size * 0.48), Math.round(y - size * 0.25), Math.round(size * 0.96), Math.round(size * 0.5));
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(Math.round(x - size * 0.12), Math.round(y - size * 0.12), Math.max(2, Math.round(size * 0.24)), Math.max(2, Math.round(size * 0.24)));
  } else if (def.kind === "bubble") {
    ctx.globalAlpha *= 0.78;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(17, 24, 39, 0.48)";
    ctx.stroke();
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(Math.round(x - size * 0.18), Math.round(y - size * 0.24), Math.max(2, Math.round(size * 0.18)), Math.max(2, Math.round(size * 0.18)));
  } else {
    ctx.fillStyle = def.color;
    drawDiamond(ctx, x, y, size);
    ctx.fillStyle = "#fff8e8";
    drawDiamond(ctx, x, y, size * 0.42);
  }
  ctx.restore();
}

function drawDesktopObjects(ctx, now) {
  for (const object of desktopObjects) {
    if (!object || object.claimed) continue;
    drawDesktopObject(ctx, object, now);
  }
}

function hasRibbonTrails() {
  return pets.some((pet) => pet.enabled && pet.ribbonTrail?.length > 1);
}

function drawRibbonTrail(ctx, pet, now) {
  const trail = pet.ribbonTrail || [];
  if (trail.length < 2) return;
  const profile = performanceProfile();
  const fancy = (settings?.performanceMode || "saver") === "smooth";
  const intensity = clamp(pet.behavior.effectIntensity || 1, 0.3, 2);
  const life = 1250 + intensity * 520;
  const maxWidth = getPetSize(pet) * (0.22 + intensity * 0.07);
  ctx.save();
  ctx.globalCompositeOperation = fancy ? "lighter" : "source-over";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const step = stutterGuardActive(now) ? 3 : profile.ribbonPoints > 24 ? 1 : 2;
  for (let index = trail.length - 1; index > 0; index -= step) {
    const head = trail[index];
    const tail = trail[index - 1];
    const age = clamp((now - head.t) / life, 0, 1);
    const position = index / trail.length;
    const alpha = (1 - age) * position * 0.82;
    if (alpha <= 0.01) continue;
    const hue = (head.hue + index * 13) % 360;
    const width = Math.max(2, maxWidth * position * (1 - age * 0.5));
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `hsl(${hue} 96% 62%)`;
    ctx.lineWidth = width;
    ctx.shadowBlur = fancy ? width * 1.2 : 0;
    ctx.shadowColor = fancy ? `hsl(${hue} 96% 62% / 0.58)` : "transparent";
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    const midX = (tail.x + head.x) / 2;
    const midY = (tail.y + head.y) / 2;
    ctx.quadraticCurveTo(midX, midY, head.x, head.y);
    ctx.stroke();

    if (fancy && index % 3 === 0) {
      ctx.globalAlpha = alpha * 0.75;
      ctx.fillStyle = `hsl(${(hue + 46) % 360} 100% 72%)`;
      drawDiamond(ctx, head.x + Math.sin(now / 90 + index) * 5, head.y + Math.cos(now / 110 + index) * 4, width * 0.45);
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function setEffectsCanvasShown(shown) {
  if (effectsCanvasShown === shown || !effectsCanvas) return;
  effectsCanvasShown = shown;
  // display:none removes the full-screen canvas from the compositor entirely;
  // visibility/opacity would still keep the GPU blending a full-screen layer.
  effectsCanvas.style.display = shown ? "" : "none";
}

function drawEffects(now) {
  if (!effectsCtx) return;
  const profile = performanceProfile();
  // Cap the effects-canvas redraw rate (independent of the motion FPS). During a
  // stutter, back off to the heavier interval; otherwise hold to the per-mode
  // effect cap so a 120 Hz motion setting doesn't redraw particles 120x/s.
  const minEffectMs = stutterGuardActive(now)
    ? Math.max(profile.effectFrameMs || profile.heavyFrameMs, profile.heavyFrameMs)
    : profile.effectFrameMs || profile.heavyFrameMs;
  if (now - lastEffectDrawAt < minEffectMs) return;
  lastEffectDrawAt = now;
  const liveRibbon = hasRibbonTrails();
  const liveObjects = desktopObjects.length > 0;
  if (!effectParticles.length && !effectsDirty && !liveRibbon && !liveObjects) {
    // Nothing to draw. After a short grace period, drop the full-screen canvas
    // out of compositing — an empty transparent full-screen layer is still
    // blended by the GPU every frame. It is re-shown instantly when effects
    // return, so pet movement is unaffected.
    if (effectsCanvasShown) {
      if (effectsEmptyAt === 0) effectsEmptyAt = now;
      else if (now - effectsEmptyAt > 400) setEffectsCanvasShown(false);
    }
    return;
  }
  effectsEmptyAt = 0;
  setEffectsCanvasShown(true);
  const { w, h } = viewport();
  effectsCtx.clearRect(0, 0, w, h);

  for (const pet of pets) drawRibbonTrail(effectsCtx, pet, now);
  drawDesktopObjects(effectsCtx, now);

  if (!effectParticles.length) {
    effectsDirty = liveObjects;
    return;
  }

  for (let index = effectParticles.length - 1; index >= 0; index -= 1) {
    const particle = effectParticles[index];
    const age = (now - particle.born) / particle.life;
    if (age >= 1) {
      effectParticles.splice(index, 1);
      continue;
    }

    const ease = 1 - (1 - age) * (1 - age);
    const x = particle.x + particle.dx * ease;
    const y = particle.y + particle.dy * ease;
    const size = Math.max(1, particle.size * (1 - age * 0.55));
    // Ease-out fade: particles stay fuller through mid-life, then dissolve
    // smoothly at the end (nicer trails) instead of a flat linear fade.
    effectsCtx.globalAlpha = particle.alpha * (1 - age * age);
    effectsCtx.fillStyle = particle.color;

    if (particle.type === "bubble") {
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      effectsCtx.fill();
      effectsCtx.lineWidth = 2;
      effectsCtx.strokeStyle = "rgba(36, 160, 190, 0.55)";
      effectsCtx.stroke();
    } else if (particle.type === "rainbow") {
      effectsCtx.globalAlpha = particle.alpha * (1 - age) * 0.22;
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, size * 0.72, 0, Math.PI * 2);
      effectsCtx.fill();
      effectsCtx.globalAlpha = particle.alpha * (1 - age) * 0.82;
      effectsCtx.beginPath();
      effectsCtx.arc(x, y, size * 0.34, 0, Math.PI * 2);
      effectsCtx.fill();
    } else if (particle.type === "spark" || particle.type === "burst") {
      drawDiamond(effectsCtx, x, y, size);
    } else if (particle.type === "star") {
      // 4-point sparkle: two crossing slim diamonds.
      effectsCtx.beginPath();
      effectsCtx.moveTo(x, y - size);
      effectsCtx.lineTo(x + size * 0.3, y);
      effectsCtx.lineTo(x, y + size);
      effectsCtx.lineTo(x - size * 0.3, y);
      effectsCtx.closePath();
      effectsCtx.moveTo(x - size, y);
      effectsCtx.lineTo(x, y - size * 0.3);
      effectsCtx.lineTo(x + size, y);
      effectsCtx.lineTo(x, y + size * 0.3);
      effectsCtx.closePath();
      effectsCtx.fill();
    } else if (particle.type === "ring") {
      // Shock ring: expands and thins out as it ages (stays put, ignores dx/dy).
      const radius = particle.size * (0.5 + age * 1.9);
      effectsCtx.lineWidth = Math.max(1, 3 * (1 - age));
      effectsCtx.strokeStyle = particle.color;
      effectsCtx.beginPath();
      effectsCtx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
      effectsCtx.stroke();
    } else if (particle.type === "heart") {
      const s = size;
      effectsCtx.beginPath();
      effectsCtx.arc(x - s * 0.26, y - s * 0.12, s * 0.34, 0, Math.PI * 2);
      effectsCtx.arc(x + s * 0.26, y - s * 0.12, s * 0.34, 0, Math.PI * 2);
      effectsCtx.fill();
      effectsCtx.beginPath();
      effectsCtx.moveTo(x - s * 0.56, y);
      effectsCtx.lineTo(x + s * 0.56, y);
      effectsCtx.lineTo(x, y + s * 0.66);
      effectsCtx.closePath();
      effectsCtx.fill();
    } else {
      effectsCtx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
    }
  }

  effectsCtx.globalAlpha = 1;
  effectsDirty = true;
}

function renderSprite(pet, force = false) {
  const custom = customCharacterFor(pet.characterId);
  const spriteImagePath = custom && customHasImage(custom) ? String(custom.imagePath || "") : "";

  // Image-based custom sprites render through a real <img> element (CSS hides
  // the canvas) so animated GIFs actually play and SVGs stay crisp; drawing
  // them to the canvas only ever captures the first frame.
  if (spriteImagePath) {
    if (pet.el.dataset.spriteType !== "image") pet.el.dataset.spriteType = "image";
    if (pet._imgSrcPath !== spriteImagePath) {
      pet._imgSrcPath = spriteImagePath;
      pet.imgEl.src = fileUrlFromPath(spriteImagePath);
    }
    return;
  }
  if (pet.el.dataset.spriteType !== "pixel") pet.el.dataset.spriteType = "pixel";
  if (pet._imgSrcPath) {
    pet._imgSrcPath = "";
    pet.imgEl.removeAttribute("src");
  }

  const character = characterFor(pet.characterId);
  const resolution = spriteResolutionFor(pet);
  if (pet.canvas.width !== resolution || pet.canvas.height !== resolution) {
    pet.canvas.width = resolution;
    pet.canvas.height = resolution;
    pet.ctx = pet.canvas.getContext("2d", { alpha: true });
    pet._lastFrame = null;
    pet._lastCharacter = null;
  }
  if (!force && pet._lastFrame === pet.frame && pet._lastCharacter === pet.characterId) return;
  pet._lastFrame = pet.frame;
  pet._lastCharacter = pet.characterId;
  pet.ctx.clearRect(0, 0, pet.canvas.width, pet.canvas.height);
  character.render(pet.ctx, pet.frame, "walk", { mouseX, mouseY });
}

function syncPetSize(pet) {
  const size = getPetSize(pet);
  if (pet._size === size) return;
  pet._size = size;
  pet.el.style.width = `${size}px`;
  pet.el.style.height = `${size}px`;
}

function pickTarget(pet, now) {
  const { w, h } = viewport();
  const size = getPetSize(pet);
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const behavior = effectiveBehaviorForPet(pet, now);
  const area = behavior.areaPreset && AREA_PRESETS[behavior.areaPreset] ? AREA_PRESETS[behavior.areaPreset] : behavior.area;
  if (behavior.movementStyle === "stay") {
    pet.targetX = clamp(pet.x + rand(-36, 36), 0, maxX);
    pet.targetY = clamp(pet.y + rand(-28, 28), 0, maxY);
    pet.nextTargetAt = now + rand(1800, 3600);
    return;
  }
  pet.targetX = clamp(w * rand(area.left, area.right), 0, maxX);
  pet.targetY = clamp(h * rand(area.top, area.bottom), 0, maxY);
  const changeMs = pet.movement.changeMs || DEFAULT_MOVEMENT.changeMs;
  pet.nextTargetAt = now + rand(changeMs[0], changeMs[1]);
}

function wakePet(pet, strength = 0.45) {
  if (!pet.enabled || pet.dragging || pet.pausedByPanel) return;
  if (effectiveBehaviorForPet(pet)?.movementStyle === "stay") return;
  const dx = pet.targetX - pet.x;
  const dy = pet.targetY - pet.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 10) return;
  pet.vx += (dx / distance) * strength;
  pet.vy += (dy / distance) * strength;
}

function activeAiDriveForPet(pet, now = performance.now()) {
  const drive = pet?.aiDrive;
  if (!drive) return null;
  if (now >= drive.until) {
    pet.aiDrive = null;
    return null;
  }
  const dx = Number(drive.dx) || 0;
  const dy = Number(drive.dy) || 0;
  const spin = Number(drive.spin) || 0;
  if (Math.hypot(dx, dy) < 0.05 && Math.abs(spin) < 0.05) return null;
  return drive;
}

function createPet(slotIndex) {
  const el = document.createElement("button");
  el.className = "pet interactive";
  el.type = "button";
  el.dataset.slot = String(slotIndex);

  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_RES;
  canvas.height = SPRITE_RES;
  el.appendChild(canvas);

  // Real <img> layer for image-based custom sprites so animated GIFs play
  // (a GIF drawn onto the canvas only ever shows its first frame in Chromium).
  const spriteImg = document.createElement("img");
  spriteImg.className = "pet-sprite-img";
  spriteImg.alt = "";
  spriteImg.draggable = false;
  el.appendChild(spriteImg);

  const label = document.createElement("span");
  label.className = "pet-label";
  el.appendChild(label);

  stage.appendChild(el);

  const pet = {
    slotIndex,
    el,
    canvas,
    imgEl: spriteImg,
    label,
    ctx: canvas.getContext("2d"),
    characterId: DEFAULT_CHARACTER,
    behavior: behaviorFor(null),
    movement: { ...DEFAULT_MOVEMENT },
    x: 80 + slotIndex * 74,
    y: 140 + slotIndex * 24,
    vx: 0,
    vy: 0,
    targetX: 120,
    targetY: 160,
    direction: 1,
    rotation: 0,
    frame: 0,
    lastFrameAt: 0,
    nextTargetAt: 0,
    dragging: false,
    didDrag: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragStartX: 0,
    dragStartY: 0,
    dragLastX: 0,
    dragLastY: 0,
    dragLastT: 0,
    dragVx: 0,
    dragVy: 0,
    lastTrailAt: 0,
    lastRibbonAt: 0,
    lastSocialAt: 0,
    ribbonTrail: [],
    spin: 0,
    spinVelocity: 0,
    impactUntil: 0,
    aiControlledUntil: 0,
    aiBehaviorOverride: null,
    aiDrive: null,
    nextDiscoveryAt: 0,
    nextMicroEventAt: 0,
    nextQuirkAt: 0,
    pausedByPanel: false,
    enabled: true,
  };

  el.addEventListener("pointerdown", (event) => startDrag(event, pet));
  el.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!pet.didDrag) openPanel(pet);
  });

  return pet;
}

function startDrag(event, pet) {
  if (event.button !== 0 || !pet.enabled) return;
  api.setClickThrough(false);
  pet.dragging = true;
  pet.didDrag = false;
  const rect = pet.el.getBoundingClientRect();
  pet.dragOffsetX = event.clientX - rect.left;
  pet.dragOffsetY = event.clientY - rect.top;
  pet.dragStartX = event.clientX;
  pet.dragStartY = event.clientY;
  pet.dragLastX = event.clientX;
  pet.dragLastY = event.clientY;
  pet.dragLastT = performance.now();
  pet.dragVx = 0;
  pet.dragVy = 0;
  pet.vx = 0;
  pet.vy = 0;
  pet.el.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

window.addEventListener("pointermove", (event) => {
  if (areaPicker) return;
  registerPointerPoint(event.clientX, event.clientY);
  if (panelDrag?.pointerId === event.pointerId) {
    const { w, h } = viewport();
    const dx = event.clientX - panelDrag.startX;
    const dy = event.clientY - panelDrag.startY;
    if (!panelDrag.active && Math.hypot(dx, dy) < 4) return;
    panelDrag.active = true;
    const width = panelManual?.width || panelDrag.width;
    const height = panelManual?.height || panelDrag.height;
    panelManual = {
      x: clamp(event.clientX - panelDrag.offsetX, 12, Math.max(12, w - width - 12)),
      y: clamp(event.clientY - panelDrag.offsetY, 12, Math.max(12, h - height - 12)),
      width,
      height,
    };
    positionPanel();
    event.preventDefault();
    return;
  }
  if (panelResize?.pointerId === event.pointerId) {
    const { w, h } = viewport();
    panelManual = {
      x: panelResize.x,
      y: panelResize.y,
      width: clamp(panelResize.width + event.clientX - panelResize.startX, 280, Math.min(560, w - panelResize.x - 12), panelResize.width),
      height: clamp(panelResize.height + event.clientY - panelResize.startY, 190, Math.min(680, h - panelResize.y - 12), panelResize.height),
    };
    positionPanel();
    event.preventDefault();
    return;
  }
  if (!pets.some((pet) => pet.dragging)) return;
  for (const pet of pets) {
    if (!pet.dragging) continue;
    const size = getPetSize(pet);
    const { w, h } = viewport();
    if (Math.abs(event.clientX - pet.dragStartX) > 3 || Math.abs(event.clientY - pet.dragStartY) > 3) {
      pet.didDrag = true;
    }
    const now = performance.now();
    const dt = Math.max(8, now - pet.dragLastT);
    const frameVelocity = clampMagnitude(
      ((event.clientX - pet.dragLastX) / dt) * 16.67,
      ((event.clientY - pet.dragLastY) / dt) * 16.67,
      MAX_THROW_SPEED,
    );
    pet.dragVx = pet.dragVx * 0.45 + frameVelocity.x * 0.55;
    pet.dragVy = pet.dragVy * 0.45 + frameVelocity.y * 0.55;
    pet.dragLastX = event.clientX;
    pet.dragLastY = event.clientY;
    pet.dragLastT = now;
    pet.x = clamp(event.clientX - pet.dragOffsetX, 0, w - size);
    pet.y = clamp(event.clientY - pet.dragOffsetY, 0, h - size);
    applyPetTransform(pet);
  }
  positionPanel();
});

function finishPanelPointer(pointerId) {
  if (panelDrag?.pointerId === pointerId) {
    const drag = panelDrag;
    panelDrag = null;
    panel.classList.remove("is-dragging");
    try {
      drag.handle?.releasePointerCapture(pointerId);
    } catch {
      /* pointer already released */
    }
  }
  if (panelResize?.pointerId === pointerId) {
    const resize = panelResize;
    panelResize = null;
    panel.classList.remove("is-resizing");
    try {
      resize.handle?.releasePointerCapture(pointerId);
    } catch {
      /* pointer already released */
    }
  }
}

window.addEventListener("pointerup", (event) => {
  finishPanelPointer(event.pointerId);
  const now = performance.now();
  for (const pet of pets) {
    if (!pet.dragging) continue;
    pet.dragging = false;
    try {
      pet.el.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
    if (pet.didDrag) {
      const velocity = clampMagnitude(pet.dragVx * THROW_POWER, pet.dragVy * THROW_POWER, MAX_THROW_SPEED);
      pet.vx = velocity.x;
      pet.vy = velocity.y;
      pet.spinVelocity += clamp((velocity.x - velocity.y) * 2.8, -36, 36);
      pet.impactUntil = now + 2600;
      pet.nextTargetAt = now + rand(2300, 3200);
      pet.targetX = pet.x + velocity.x * 110;
      pet.targetY = pet.y + velocity.y * 110;
    }
  }
});

window.addEventListener("pointercancel", (event) => {
  finishPanelPointer(event.pointerId);
});

window.addEventListener("blur", () => {
  panelDrag = null;
  panelResize = null;
  panel.classList.remove("is-dragging", "is-resizing");
});

window.addEventListener(
  "pointerdown",
  (event) => {
    if (areaPicker || !activePet || panel.hidden) return;
    if (event.target.closest(".pet-panel") || event.target.closest(".pet")) return;
    if (panelPinned) return;
    closePanel();
    api.setClickThrough(true);
  },
  true,
);

function updateMotion(pet, now, step) {
  if (!pet.enabled || pet.dragging) return;
  const behavior = effectiveBehaviorForPet(pet, now);
  const movement = pet.movement;
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  const flying = now < pet.impactUntil;
  const aiDrive = activeAiDriveForPet(pet, now);
  const aiControlled = !!aiDrive || now < (pet.aiControlledUntil || 0);
  const replySlow = !aiControlled && now < (pet.replySlowUntil || 0);
  const replyFactor = replySlow ? 0.34 : 1;

  if (pet.pausedByPanel && !aiControlled) {
    pet.vx = 0;
    pet.vy = 0;
    pet.x = clamp(pet.x, 0, maxX);
    pet.y = clamp(pet.y, 0, maxY);
    pet.targetX = pet.x;
    pet.targetY = pet.y;
    pet.nextTargetAt = now + 1200;
    return;
  }

  // Mouse "follow": aim for an invisible circle around the cursor rather than
  // the exact point. Head into the circle when outside it, then drift gently to
  // a randomized anchor inside it — smoother than pinpoint chasing.
  const followRadius = clamp(size * 1.7, 90, 160);
  const mcx = pet.x + size / 2;
  const mcy = pet.y + size / 2;
  const mdx = mouseX - mcx;
  const mdy = mouseY - mcy;
  const mdist = Math.hypot(mdx, mdy) || 1;
  const mouseOnScreen = mouseX > -60 && mouseY > -60 && mouseX < w + 60 && mouseY < h + 60;
  const followMode = !flying && !aiDrive && behavior.mouseMode === "follow" && mouseOnScreen;
  const followFar = followMode && mdist > followRadius;
  if (followMode) {
    if (followFar) {
      const enter = followRadius * 0.82;
      pet.targetX = clamp(mouseX - (mdx / mdist) * enter - size / 2, 0, maxX);
      pet.targetY = clamp(mouseY - (mdy / mdist) * enter - size / 2, 0, maxY);
    } else {
      if (!pet.followWanderAt || now > pet.followWanderAt) {
        const angle = rand(0, Math.PI * 2);
        const radius = rand(0, followRadius * 0.6);
        pet.followAnchorX = Math.cos(angle) * radius;
        pet.followAnchorY = Math.sin(angle) * radius;
        pet.followWanderAt = now + rand(800, 1600);
      }
      pet.targetX = clamp(mouseX + (pet.followAnchorX || 0) - size / 2, 0, maxX);
      pet.targetY = clamp(mouseY + (pet.followAnchorY || 0) - size / 2, 0, maxY);
    }
    pet.nextTargetAt = now + 500;
  }

  const reachedTarget = Math.hypot(pet.targetX - pet.x, pet.targetY - pet.y) < 12;
  if (!flying && !aiControlled && !followMode && (now > pet.nextTargetAt || reachedTarget)) {
    pickTarget(pet, now);
  } else if (!flying && aiControlled && reachedTarget) {
    pet.nextTargetAt = Math.max(pet.nextTargetAt, now + 180);
  }
  if (!flying && !aiDrive && behavior.movementStyle !== "stay" && Math.hypot(pet.vx, pet.vy) < 0.015) {
    wakePet(pet, 0.28);
  }

  if (!flying && aiDrive) {
    const dx = Number(aiDrive.dx) || 0;
    const dy = Number(aiDrive.dy) || 0;
    const dist = Math.hypot(dx, dy) || 1;
    const driveSpeed = clamp(Number(aiDrive.speed) || Number(behavior.speedMultiplier) || 1, 0.35, 3);
    const accel = (movement.accel || DEFAULT_MOVEMENT.accel) * driveSpeed * 2.4;
    if (Math.hypot(dx, dy) >= 0.05) {
      pet.vx += (dx / dist) * accel * step;
      pet.vy += (dy / dist) * accel * step;
    }
    if (Number.isFinite(aiDrive.spin) && Math.abs(aiDrive.spin) >= 0.05) {
      pet.spinVelocity += clamp(aiDrive.spin, -110, 110) * 0.012 * step;
    }
    pet.vx += rand(-1, 1) * (movement.wobble || DEFAULT_MOVEMENT.wobble) * 0.35 * step;
    pet.vy += rand(-1, 1) * (movement.wobble || DEFAULT_MOVEMENT.wobble) * 0.35 * step;
  } else if (!flying && (behavior.movementStyle !== "stay" || followMode)) {
    const dx = pet.targetX - pet.x;
    const dy = pet.targetY - pet.y;
    const dist = Math.hypot(dx, dy) || 1;
    let accelMul = behavior.speedMultiplier * replyFactor;
    if (followFar) {
      // The farther outside the circle, the harder it accelerates, so it
      // actually catches a moving cursor instead of lagging behind.
      accelMul *= 2 + clamp(mdist / followRadius - 1, 0, 1.5) * 1.8;
    } else if (followMode) {
      accelMul *= 0.85;
    }
    const accel = (movement.accel || DEFAULT_MOVEMENT.accel) * accelMul;
    pet.vx += (dx / dist) * accel * step;
    pet.vy += (dy / dist) * accel * step;
    const wobbleMul = followMode ? 0.3 : 1;
    pet.vx += rand(-1, 1) * (movement.wobble || DEFAULT_MOVEMENT.wobble) * replyFactor * wobbleMul * step;
    pet.vy += rand(-1, 1) * (movement.wobble || DEFAULT_MOVEMENT.wobble) * replyFactor * wobbleMul * step;
  } else if (!flying) {
    pet.vx += (pet.targetX - pet.x) * 0.002 * step;
    pet.vy += (pet.targetY - pet.y) * 0.002 * step;
  }

  if (!flying && !aiDrive && behavior.mouseMode === "avoid" && mdist < MOUSE_PROXIMITY && mdist > Math.max(30, size * 0.7)) {
    const grabHalo = Math.max(30, size * 0.7);
    const range = Math.max(1, MOUSE_PROXIMITY - grabHalo);
    const force = (1 - (mdist - grabHalo) / range) * 0.18;
    pet.vx -= (mdx / mdist) * force * step;
    pet.vy -= (mdy / mdist) * force * step;
  }

  const speed = Math.hypot(pet.vx, pet.vy);
  const aiSpeedBoost = aiDrive ? clamp(Number(aiDrive.speed) || Number(behavior.speedMultiplier) || 1, 1, 3) * 1.25 : 1;
  const careFactor = cachedCareMovementFactor(pet, now);
  const baseMaxSpeed = (movement.speed || DEFAULT_MOVEMENT.speed) * behavior.speedMultiplier * replyFactor * aiSpeedBoost * careFactor;
  let maxSpeed = flying ? Math.max(baseMaxSpeed, MAX_THROW_SPEED) : baseMaxSpeed;
  if (followFar) maxSpeed *= 1.7;
  if (speed > maxSpeed) {
    pet.vx *= maxSpeed / speed;
    pet.vy *= maxSpeed / speed;
  }

  const damping = flying ? 0.992 : movement.damping || DEFAULT_MOVEMENT.damping;
  pet.vx *= Math.pow(damping, step);
  pet.vy *= Math.pow(damping, step);
  pet.x += pet.vx * step;
  pet.y += pet.vy * step;

  if (pet.x < 0) {
    pet.x = 0;
    pet.vx = Math.abs(pet.vx) * WALL_BOUNCE;
    pet.spinVelocity += Math.abs(pet.vy) * 2.2 + 9;
    pet.impactUntil = Math.max(pet.impactUntil, now + 760);
  }
  if (pet.x > maxX) {
    pet.x = maxX;
    pet.vx = -Math.abs(pet.vx) * WALL_BOUNCE;
    pet.spinVelocity -= Math.abs(pet.vy) * 2.2 + 9;
    pet.impactUntil = Math.max(pet.impactUntil, now + 760);
  }
  if (pet.y < 0) {
    pet.y = 0;
    pet.vy = Math.abs(pet.vy) * WALL_BOUNCE;
    pet.spinVelocity -= Math.abs(pet.vx) * 2.2 + 9;
    pet.impactUntil = Math.max(pet.impactUntil, now + 760);
  }
  if (pet.y > maxY) {
    pet.y = maxY;
    pet.vy = -Math.abs(pet.vy) * WALL_BOUNCE;
    pet.spinVelocity += Math.abs(pet.vx) * 2.2 + 9;
    pet.impactUntil = Math.max(pet.impactUntil, now + 760);
  }
  if (Math.abs(pet.vx) > 0.08) {
    pet.direction = pet.vx >= 0 ? 1 : -1;
  }

  pet.spin += pet.spinVelocity * step;
  pet.spinVelocity *= Math.pow(0.86, step);
  if (Math.abs(pet.spinVelocity) < 0.02) pet.spinVelocity = 0;
  if (Math.abs(pet.spin) > 360) pet.spin = ((pet.spin + 540) % 720) - 360;
  if (pet.spinVelocity === 0 && Math.abs(pet.spin) > 0.1) pet.spin *= Math.pow(0.9, step);
}

function isSideViewCharacter(pet) {
  return SIDE_VIEW_CHARACTER_IDS.has(pet.characterId);
}

function orientationModeFor(pet) {
  return ["smart", "turn", "fixed"].includes(pet.behavior?.orientationMode) ? pet.behavior.orientationMode : "smart";
}

function shouldOrient(pet) {
  const mode = orientationModeFor(pet);
  if (mode === "fixed") return false;
  if (mode === "turn") return true;
  if (isSideViewCharacter(pet)) return false;
  if (customCharacterFor(pet.characterId)) return true;
  const character = characterFor(pet.characterId);
  return character.orientToMovement || ["rocket", "bug", "tank", "car", "comet"].includes(pet.characterId);
}

function setPetTransform(pet, transform) {
  if (pet._lastTransform === transform) return;
  pet._lastTransform = transform;
  pet.el.style.transform = transform;
}

function applyPetTransform(pet) {
  syncPetSize(pet);
  let rotation = pet.rotation || 0;
  const speed = Math.hypot(pet.vx, pet.vy);
  const spin = pet.spin || 0;
  const mode = orientationModeFor(pet);
  if (mode === "fixed") {
    pet.rotation = 0;
    const rotate = Math.abs(spin) > 0.1 ? ` rotate(${spin.toFixed(2)}deg)` : "";
    setPetTransform(pet, `translate3d(${pet.x.toFixed(2)}px, ${pet.y.toFixed(2)}px, 0)${rotate}`);
    return;
  }
  if (mode === "smart" && isSideViewCharacter(pet)) {
    const desiredTilt = clamp(pet.vy * 7 * pet.direction, -10, 10);
    rotation += (desiredTilt - rotation) * 0.18;
    pet.rotation = rotation;
    const flip = pet.direction < 0 ? " scaleX(-1)" : "";
    setPetTransform(pet, `translate3d(${pet.x.toFixed(2)}px, ${pet.y.toFixed(2)}px, 0) rotate(${(rotation + spin).toFixed(2)}deg)${flip}`);
    return;
  }
  if (shouldOrient(pet) && speed > 0.08) {
    const desired = (Math.atan2(pet.vy, pet.vx) * 180) / Math.PI + 90;
    const diff = ((desired - rotation + 540) % 360) - 180;
    rotation += diff * 0.26;
    pet.rotation = rotation;
  }
  const flip = shouldOrient(pet) ? "" : pet.direction < 0 ? " scaleX(-1)" : "";
  const rotate = shouldOrient(pet) || Math.abs(spin) > 0.1 ? ` rotate(${(rotation + spin).toFixed(2)}deg)` : "";
  setPetTransform(pet, `translate3d(${pet.x.toFixed(2)}px, ${pet.y.toFixed(2)}px, 0)${rotate}${flip}`);
}

function resolvePetPointerCollision(pet, now, step) {
  if (!pet.enabled || pet.dragging || pet.pausedByPanel) return;
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const dx = cx - mouseX;
  const dy = cy - mouseY;
  const distance = Math.hypot(dx, dy);
  const minDistance = size * 0.46 + MOUSE_COLLISION_RADIUS;
  const grabHalo = Math.max(30, size * 0.66);
  const mouseSpeed = Math.hypot(mouseVx, mouseVy);
  if (!Number.isFinite(distance) || distance <= 0.001 || distance >= minDistance) return;
  if (distance < grabHalo || mouseSpeed < MOUSE_BUMP_SPEED) return;
  const nx = dx / distance;
  const ny = dy / distance;
  const impact = clamp(mouseSpeed / 4.5, 0.25, 1.35);
  const push = (minDistance - distance) * 0.2 * impact;
  pet.x += nx * push;
  pet.y += ny * push;
  const impulse = (1 - distance / minDistance) * 1.55 * impact * step;
  pet.vx += nx * impulse;
  pet.vy += ny * impulse;
  pet.spinVelocity += clamp((ny - nx) * impulse * 8, -14, 14);
  pet.impactUntil = Math.max(pet.impactUntil, now + 260);
}

// Varied "pop" when two pets bump. Picks one of several looks at random (never
// the same one twice in a row) so collisions feel lively, scaled down in saver
// mode and skipped while pets are ghost-hidden.
let lastCollisionStyle = -1;
const COLLISION_STYLES = [
  { type: "spark", colors: ["#fff7ad", "#ffd166", "#ffe66b"], count: 8, speed: [30, 54], size: [4, 8], life: 440, lift: 0 },
  { type: "confetti", colors: ["#ff4d6d", "#ffd166", "#39d98a", "#4dabf7", "#a78bfa", "#fb923c"], count: 9, speed: [26, 48], size: [4, 7], life: 640, lift: -6 },
  { type: "bubble", colors: ["rgba(157,234,255,0.62)", "rgba(125,211,252,0.58)"], count: 6, speed: [16, 30], size: [6, 12], life: 600, lift: -10 },
  { type: "heart", colors: ["#ff8fab", "#ff5d8f", "#ffc2e7"], count: 5, speed: [18, 34], size: [8, 12], life: 760, lift: -14 },
  { type: "star", colors: ["#ffe66b", "#fff7ad", "#a5f3fc"], count: 7, speed: [30, 50], size: [5, 9], life: 500, lift: 0 },
  { type: "ring", colors: ["#a5f3fc", "#93c5fd", "#fcd34d"], count: 1, speed: [0, 0], size: [10, 14], life: 400, lift: 0, ring: true },
];
function spawnCollisionBurst(x, y, now, energy) {
  if (ghostHidden || !performanceProfile().trails) return;
  const e = clamp(energy, 0.55, 1.7);
  const density = (settings?.performanceMode || "saver") === "saver" ? 0.6 : 1;
  const pick = (arr) => arr[Math.floor(rand(0, arr.length))];
  let idx = Math.floor(rand(0, COLLISION_STYLES.length));
  if (idx === lastCollisionStyle) idx = (idx + 1) % COLLISION_STYLES.length;
  lastCollisionStyle = idx;
  const style = COLLISION_STYLES[idx];
  if (style.ring) {
    pushEffectParticle({ type: "ring", x, y, dx: 0, dy: 0, size: rand(style.size[0], style.size[1]) + e * 6, color: pick(style.colors), alpha: 0.72, born: now, life: style.life });
    const extra = Math.round(4 * density);
    for (let i = 0; i < extra; i += 1) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(24, 44) * e;
      pushEffectParticle({ type: "spark", x, y, dx: Math.cos(a) * sp, dy: Math.sin(a) * sp, size: rand(4, 7), color: "#fff7ad", alpha: 0.9, born: now, life: 360 });
    }
    return;
  }
  const count = Math.max(3, Math.round(style.count * e * density));
  for (let i = 0; i < count; i += 1) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(style.speed[0], style.speed[1]) * e;
    pushEffectParticle({
      type: style.type,
      x: x + rand(-3, 3),
      y: y + rand(-3, 3),
      dx: Math.cos(a) * sp,
      dy: Math.sin(a) * sp + style.lift,
      size: rand(style.size[0], style.size[1]),
      color: pick(style.colors),
      alpha: style.type === "bubble" ? 0.6 : 0.92,
      born: now,
      life: style.life,
    });
  }
}

function resolvePetCollisions(now) {
  for (let i = 0; i < pets.length; i += 1) {
    const a = pets[i];
    if (!a.enabled || a.dragging) continue;
    const sizeA = getPetSize(a);
    const radiusA = sizeA * 0.43;
    for (let j = i + 1; j < pets.length; j += 1) {
      const b = pets[j];
      if (!b.enabled || b.dragging) continue;
      const sizeB = getPetSize(b);
      const radiusB = sizeB * 0.43;
      const ax = a.x + sizeA / 2;
      const ay = a.y + sizeA / 2;
      const bx = b.x + sizeB / 2;
      const by = b.y + sizeB / 2;
      let dx = bx - ax;
      let dy = by - ay;
      let distance = Math.hypot(dx, dy);
      const minDistance = radiusA + radiusB;
      if (distance >= minDistance) continue;
      if (distance < 0.001) {
        dx = rand(-1, 1);
        dy = rand(-1, 1);
        distance = Math.hypot(dx, dy) || 1;
      }
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = minDistance - distance;
      const aStatic = a.pausedByPanel;
      const bStatic = b.pausedByPanel;
      if (!aStatic && !bStatic) {
        a.x -= nx * overlap * 0.52;
        a.y -= ny * overlap * 0.52;
        b.x += nx * overlap * 0.52;
        b.y += ny * overlap * 0.52;
      } else if (aStatic && !bStatic) {
        b.x += nx * overlap;
        b.y += ny * overlap;
      } else if (!aStatic && bStatic) {
        a.x -= nx * overlap;
        a.y -= ny * overlap;
      }

      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const separatingSpeed = rvx * nx + rvy * ny;
      const impulse = Math.max(0.9, -separatingSpeed * 0.75 + 0.7);
      if (!aStatic) {
        a.vx -= nx * impulse;
        a.vy -= ny * impulse;
        a.spinVelocity -= clamp((ny - nx) * impulse * 5, -18, 18);
        a.impactUntil = Math.max(a.impactUntil, now + 420);
      }
      if (!bStatic) {
        b.vx += nx * impulse;
        b.vy += ny * impulse;
        b.spinVelocity += clamp((ny - nx) * impulse * 5, -18, 18);
        b.impactUntil = Math.max(b.impactUntil, now + 420);
      }

      // Pop a varied effect on a real bump (approaching, not a resting overlap),
      // throttled per pet so a lingering contact doesn't spam particles.
      if (separatingSpeed < -0.5 && now - (a.lastCollisionFxAt || 0) > 280 && now - (b.lastCollisionFxAt || 0) > 280) {
        a.lastCollisionFxAt = now;
        b.lastCollisionFxAt = now;
        spawnCollisionBurst(ax + nx * radiusA, ay + ny * radiusA, now, clamp(0.6 + Math.abs(separatingSpeed) * 0.35, 0.55, 1.7));
      }
    }
  }
}

function updateAnimation(pet, now) {
  const character = characterFor(pet.characterId);
  const speed = Math.min(1, Math.hypot(pet.vx, pet.vy) / 2.5);
  const interval = 360 - speed * 240;
  if (now - pet.lastFrameAt >= interval) {
    pet.frame = (pet.frame + 1) % character.frames;
    pet.lastFrameAt = now;
  }
  renderSprite(pet);
}

function effectAnchorFor(pet) {
  const custom = customCharacterFor(pet.characterId);
  const character = characterFor(pet.characterId);
  return pet.behavior?.effectAnchor || custom?.effectAnchor || character.effectAnchor || { x: 0.5, y: 0.56 };
}

function effectDirectionFor(pet) {
  const custom = customCharacterFor(pet.characterId);
  const character = characterFor(pet.characterId);
  return pet.behavior?.effectDirection || custom?.effectDirection || character.effectDirection || "back";
}

function effectOrigin(pet, size) {
  const anchor = effectAnchorFor(pet);
  const anchorX = Number(anchor.x);
  const anchorY = Number(anchor.y);
  const xRatio = clamp(Number.isFinite(anchorX) ? anchorX : 0.5, 0, 1);
  const yRatio = clamp(Number.isFinite(anchorY) ? anchorY : 0.56, 0, 1);
  const centerX = pet.x + size * 0.5;
  const centerY = pet.y + size * 0.5;
  const visualRotation = (shouldOrient(pet) ? pet.rotation || 0 : 0) + (pet.spin || 0);
  if (Math.abs(visualRotation) > 0.01) {
    const radians = (visualRotation * Math.PI) / 180;
    const localX = (xRatio - 0.5) * size;
    const localY = (yRatio - 0.5) * size;
    return {
      x: centerX + localX * Math.cos(radians) - localY * Math.sin(radians),
      y: centerY + localX * Math.sin(radians) + localY * Math.cos(radians),
    };
  }
  return {
    x: pet.x + size * xRatio,
    y: pet.y + size * yRatio,
  };
}

function effectVector(pet) {
  const direction = effectDirectionFor(pet);
  if (direction === "left") return { x: -1, y: 0 };
  if (direction === "right") return { x: 1, y: 0 };
  if (direction === "up") return { x: 0, y: -1 };
  if (direction === "down") return { x: 0, y: 1 };
  const speed = Math.hypot(pet.vx, pet.vy);
  if (speed > 0.05) {
    const sign = direction === "auto" ? 1 : -1;
    return { x: (pet.vx / speed) * sign, y: (pet.vy / speed) * sign };
  }
  const fallback = pet.direction >= 0 ? 1 : -1;
  return { x: direction === "auto" ? fallback : -fallback, y: 0 };
}

function spawnTrail(pet, now) {
  const mode = pet.behavior.effectMode || "off";
  const profile = performanceProfile();
  if (!profile.trails) return;
  if (mode === "off") return;
  const intensity = clamp(pet.behavior.effectIntensity || 1, 0.3, 2);
  const speed = Math.hypot(pet.vx, pet.vy);
  if (speed < 0.18 && !pet.dragging) return;
  if (mode === "rainbow") {
    const rainbowCount = Math.max(1, activeRainbowCount());
    const interval = clamp(22 + rainbowCount * 11, 34, 72);
    if (now - pet.lastTrailAt < interval) return;
    pet.lastTrailAt = now;
    const size = getPetSize(pet);
    const origin = effectOrigin(pet, size);
    const vector = effectVector(pet);
    const sizeMul = 0.9 + (pet.behavior.scale || 1) * 0.2;
    const hue = (now / 5) % 360;
    pushEffectParticle({
      type: "rainbow",
      x: origin.x - 4 + rand(-2, 2),
      y: origin.y - 4 + rand(-2, 2),
      dx: vector.x * 42 + rand(-5, 5),
      dy: vector.y * 42 + rand(-5, 5),
      size: Math.round(7 * sizeMul * Math.min(intensity, 1.35)),
      color: `hsl(${hue} 95% 60%)`,
      alpha: 0.78,
      born: now,
      life: 1100 + intensity * 220,
    });
    return;
  }
  const interval = Math.max(profile.trailMs * 0.72, profile.trailMs / intensity);
  if (now - pet.lastTrailAt < interval) return;
  pet.lastTrailAt = now;

  const size = getPetSize(pet);
  const origin = effectOrigin(pet, size);
  const vector = effectVector(pet);
  const x = origin.x + rand(-size * 0.08, size * 0.08);
  const y = origin.y + rand(-size * 0.08, size * 0.08);
  const pixelSize = mode === "spark" ? rand(5, 9) : rand(7, 15) * Math.min(intensity, 1.35);
  let color = "#42d7c5";
  let alpha = 0.72;

  if (mode === "rainbow" || mode === "normal") {
    trailHue = (trailHue + 23) % 360;
    const hue = mode === "normal" ? 172 : trailHue;
    color = `hsl(${hue} 96% 64%)`;
    alpha = mode === "rainbow" ? 0.52 : alpha;
  } else if (mode === "pixel") {
    const colors = ["#ff4d6d", "#ffd166", "#39d98a", "#4dabf7", "#a78bfa"];
    color = colors[Math.floor(Math.random() * colors.length)];
  } else if (mode === "spark") {
    color = "#ffe76b";
    alpha = 0.9;
  } else if (mode === "bubble") {
    color = "rgba(157, 234, 255, 0.42)";
    alpha = 0.86;
  }

  pushEffectParticle({
    type: mode,
    x,
    y,
    dx: vector.x * rand(18, 34) + rand(-8, 8),
    dy: vector.y * rand(18, 34) + rand(-8, 8),
    size: pixelSize,
    color,
    alpha,
    born: now,
    life: mode === "spark" ? 520 : 760,
  });
}

function spawnClickBurst(pet) {
  const size = getPetSize(pet);
  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const now = performance.now();
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    const distance = rand(24, 58);
    pushEffectParticle({
      type: "burst",
      x: cx,
      y: cy,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: 7,
      color: "#ffe76b",
      alpha: 0.92,
      born: now,
      life: 520,
    });
  }
}

function shortcutKind(shortcut) {
  return shortcut?.type === "app" ? "app" : "web";
}

function shortcutIcon(shortcut) {
  const icon = document.createElement("span");
  icon.className = `shortcut-icon ${shortcutKind(shortcut)}`;
  icon.textContent = shortcutKind(shortcut) === "app" ? "◆" : "↗";
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function shortcutImage(shortcut) {
  if (shortcut?.imagePath) return fileUrlFromPath(shortcut.imagePath);
  return "";
}

function applyMovementAction(pet, command, character = characterFor(pet?.characterId), options = {}) {
  if (!pet || !command) return null;
  const slot = settings.slots?.[pet.slotIndex];
  if (!slot) return null;
  const fromAi = options.source === "ai";
  const behavior = fromAi ? { ...effectiveBehaviorForPet(pet) } : behaviorFor(slot);
  const now = performance.now();
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const maxX = Math.max(0, w - size);
  const maxY = Math.max(0, h - size);
  let settingsChanged = false;
  let aiHoldUntil = now;

  if (fromAi) {
    const defaultHoldMs = command.target || command.spin ? 3600 : 12000;
    aiHoldUntil = now + (Number.isFinite(command.aiHoldMs) ? command.aiHoldMs : defaultHoldMs);
    pet.pausedByPanel = false;
    pet.replySlowUntil = 0;
    pet.aiControlledUntil = aiHoldUntil;
    pet.aiDrive = null;
  }

  if (command.stop) {
    behavior.movementStyle = "stay";
    pet.pausedByPanel = !fromAi;
    pet.vx = 0;
    pet.vy = 0;
    pet.targetX = pet.x;
    pet.targetY = pet.y;
    settingsChanged = true;
  }
  if (command.roam) {
    behavior.movementStyle = "free";
    pet.pausedByPanel = false;
    settingsChanged = true;
  }
  if (command.follow) {
    behavior.mouseMode = "follow";
    pet.pausedByPanel = false;
    settingsChanged = true;
  }
  if (command.avoid) {
    behavior.mouseMode = "avoid";
    settingsChanged = true;
  }
  if (command.mouseMode) {
    behavior.mouseMode = ["follow", "avoid", "ignore"].includes(command.mouseMode) ? command.mouseMode : behavior.mouseMode;
    settingsChanged = true;
  }
  if (Number.isFinite(command.speed)) {
    behavior.speedMultiplier = clamp(command.speed, 0.25, 3);
    settingsChanged = true;
  }
  if (Number.isFinite(command.speedFactor)) {
    behavior.speedMultiplier = clamp((Number(behavior.speedMultiplier) || 1) * command.speedFactor, 0.25, 3);
    settingsChanged = true;
  }
  if (command.area) {
    behavior.areaPreset = "custom";
    behavior.area = command.area;
    if (fromAi) behavior.movementStyle = "free";
    settingsChanged = true;
  }
  if (fromAi && !command.stop && behavior.movementStyle === "stay") {
    behavior.movementStyle = "free";
    settingsChanged = true;
  }

  if (command.target) {
    const distance = Number.isFinite(command.distance)
      ? clamp(command.distance, fromAi ? 0 : 80, fromAi ? 520 : 420)
      : command.speed >= 1.7
        ? 340
        : command.speed <= 0.55
          ? 150
          : 230;
    behavior.movementStyle = "free";
    pet.pausedByPanel = false;
    if (command.target.center) {
      pet.targetX = maxX / 2;
      pet.targetY = maxY / 2;
    } else {
      const dx = command.target.x || 0;
      const dy = command.target.y || 0;
      const length = Math.hypot(dx, dy) || 1;
      if (fromAi) {
        pet.aiDrive = {
          dx: dx / length,
          dy: dy / length,
          speed: Number.isFinite(command.speed) ? command.speed : Number(behavior.speedMultiplier) || 1,
          spin: Number.isFinite(command.spin) ? command.spin : 0,
          until: aiHoldUntil,
        };
      }
      pet.targetX = clamp(pet.x + (dx / length) * distance, 0, maxX);
      pet.targetY = clamp(pet.y + (dy / length) * distance, 0, maxY);
      pet.vx += (dx / length) * 1.8;
      pet.vy += (dy / length) * 1.8;
    }
    pet.nextTargetAt = now + 3200;
    settingsChanged = true;
  }

  if (command.spin) {
    if (!command.target && !command.roam) {
      behavior.movementStyle = "stay";
      pet.vx = 0;
      pet.vy = 0;
      pet.targetX = pet.x;
      pet.targetY = pet.y;
    }
    pet.pausedByPanel = false;
    pet.spinVelocity += command.spin;
    if (fromAi && !pet.aiDrive) {
      pet.aiDrive = {
        dx: 0,
        dy: 0,
        speed: Number(behavior.speedMultiplier) || 1,
        spin: command.spin,
        until: aiHoldUntil,
      };
    }
    pet.nextTargetAt = now + 1800;
    settingsChanged = true;
  }

  if (fromAi) {
    pet.aiBehaviorOverride = behavior;
  } else {
    slot.behavior = behavior;
    pet.behavior = behaviorFor(slot);
  }
  if (!command.target && !command.spin && !command.stop) pickTarget(pet, now);
  if (settingsChanged && !fromAi) {
    api.updateSettings(settings).then((next) => {
      settings = next;
      syncPets();
    });
  }
  return { ok: true, reply: movementCommandReply(character, command), command };
}

function showPetThought(pet, text, options = {}) {
  if (options.kind !== "system-benchmark") return;
  if (!pet?.el || !stage || !text) return;
  const old = pet.thoughtEl;
  if (old) hidePetBubble(pet, old, "thoughtEl", { immediate: true });
  pet.el.classList.add("pet-talking");
  const bubble = document.createElement("div");
  bubble.className = "pet-thought pet-floating-bubble";
  bubble.classList.toggle("is-ghost-hidden", ghostHidden);
  bubble.textContent = String(text).slice(0, 180);
  stage.appendChild(bubble);
  pet.thoughtEl = bubble;
  positionPetBubble(pet, bubble);
  window.requestAnimationFrame(() => bubble.classList.add("is-visible"));
  const fallbackDuration = Math.min(24000, 7000 + Math.max(0, String(text).length - 36) * 80);
  const duration = Number.isFinite(options.durationMs) ? Math.max(800, options.durationMs) : fallbackDuration;
  bubble._hideTimer = window.setTimeout(() => hidePetBubble(pet, bubble, "thoughtEl"), duration);
}

function showPetThinking(pet, text = "", options = {}) {
  if (options.kind !== "system-benchmark") return;
  if (!pet?.el || !stage) return;
  const old = pet.thinkingEl;
  if (old) hidePetBubble(pet, old, "thinkingEl", { immediate: true });
  pet.el.classList.add("pet-talking");
  const bubble = document.createElement("div");
  bubble.className = "pet-thinking pet-floating-bubble";
  bubble.classList.toggle("is-ghost-hidden", ghostHidden);
  if (text) {
    const label = document.createElement("span");
    label.textContent = String(text).slice(0, 4);
    bubble.appendChild(label);
  } else {
    bubble.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
  }
  stage.appendChild(bubble);
  pet.thinkingEl = bubble;
  positionPetBubble(pet, bubble);
  window.requestAnimationFrame(() => bubble.classList.add("is-visible"));
  const duration = Number.isFinite(options.durationMs) ? Math.max(500, options.durationMs) : 1100;
  bubble._hideTimer = window.setTimeout(() => hidePetBubble(pet, bubble, "thinkingEl"), duration);
}

function hidePetBubble(pet, bubble, slotName, options = {}) {
  if (!bubble) return;
  window.clearTimeout(bubble._hideTimer);
  const finish = () => {
    if (pet?.[slotName] === bubble) pet[slotName] = null;
    bubble.remove();
    if (pet?.el && !pet.thoughtEl && !pet.thinkingEl) pet.el.classList.remove("pet-talking");
  };
  if (options.immediate || !bubble.isConnected) {
    finish();
    return;
  }
  bubble.classList.remove("is-visible");
  bubble.classList.add("is-hiding");
  window.setTimeout(finish, FLOATING_BUBBLE_HIDE_MS);
}

function positionPetBubble(pet, bubble) {
  if (!pet?.enabled || !bubble) return;
  const size = getPetSize(pet);
  const { w, h } = viewport();
  const x = clamp(pet.x + size / 2, 14, Math.max(14, w - 14));
  const isThinking = bubble.classList.contains("pet-thinking");
  const y = isThinking ? clamp(pet.y + size + 8, 14, Math.max(14, h - 18)) : Math.max(14, pet.y - 8);
  bubble.style.left = `${Math.round(x)}px`;
  bubble.style.top = `${Math.round(y)}px`;
}

function positionPetBubbles() {
  for (const pet of pets) {
    if (!pet.enabled) {
      hidePetBubble(pet, pet.thoughtEl, "thoughtEl", { immediate: true });
      hidePetBubble(pet, pet.thinkingEl, "thinkingEl", { immediate: true });
      pet.thoughtEl = null;
      pet.thinkingEl = null;
      pet.el.classList.remove("pet-talking");
      continue;
    }
    positionPetBubble(pet, pet.thoughtEl);
    positionPetBubble(pet, pet.thinkingEl);
  }
}

async function maybeAutoTalk(now) {
  if (autoTalkBusy || now < nextAutoTalkAt) return;
  if (!systemStats) {
    nextAutoTalkAt = now + 5000;
    return;
  }
  const candidates = pets.filter((pet) => pet.enabled && !pet.dragging);
  if (!candidates.length) return;
  autoTalkBusy = true;
  nextAutoTalkAt = now + rand(16000, 30000);
  const pet = candidates[Math.floor(Math.random() * candidates.length)];
  const line = systemBenchmarkLine();
  showPetThought(pet, line, { durationMs: 4300, kind: "system-benchmark" });
  autoTalkBusy = false;
}

function closePanel(force = false) {
  if (panelPinned && !force) return;
  if (activePet) {
    activePet.pausedByPanel = false;
    pickTarget(activePet, performance.now());
  }
  panel.hidden = true;
  activePet = null;
  panelManual = null;
  if (force) panelPinned = false;
}

function activatePanelSection(sectionId) {
  const nextSectionId = PANEL_SECTION_IDS.includes(sectionId) ? sectionId : PANEL_SECTION_IDS[0];
  panel.dataset.activeSection = nextSectionId;
  panel.querySelectorAll(".panel-tab").forEach((tab) => {
    const active = tab.dataset.panelSection === nextSectionId;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  panel.querySelectorAll(".panel-section").forEach((section) => {
    const active = section.dataset.panelSection === nextSectionId;
    section.hidden = !active;
    section.setAttribute("aria-hidden", String(!active));
  });
}

function renderPanelTabs(sections, activeSectionId) {
  const tabs = document.createElement("div");
  tabs.className = "panel-tabs";
  tabs.setAttribute("role", "tablist");
  for (const section of sections) {
    const button = document.createElement("button");
    button.className = "panel-tab";
    button.type = "button";
    button.dataset.panelSection = section.id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `panel-section-${section.id}`);
    button.textContent = section.label;
    const active = section.id === activeSectionId;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      activatePanelSection(section.id);
    });
    tabs.appendChild(button);
  }
  return tabs;
}

function renderPanelSection(section, activeSectionId) {
  const node = document.createElement("section");
  node.id = `panel-section-${section.id}`;
  node.className = "panel-section";
  node.dataset.panelSection = section.id;
  node.setAttribute("role", "tabpanel");
  const active = section.id === activeSectionId;
  node.hidden = !active;
  node.setAttribute("aria-hidden", String(!active));

  const heading = document.createElement("div");
  heading.className = "panel-section-title";
  const title = document.createElement("strong");
  title.textContent = section.label;
  const count = document.createElement("span");
  count.textContent = `${section.cards.length}`;
  heading.append(title, count);
  node.appendChild(heading);

  for (const card of section.cards) node.appendChild(card);
  return node;
}

function currentShortcuts() {
  return Array.isArray(settings?.shortcuts)
    ? settings.shortcuts.filter((item) => item?.name && (item.type === "app" ? item.appPath : item.url))
    : [];
}

function renderShortcutButton(shortcut, displayMode) {
  const kind = shortcutKind(shortcut);
  const imageOnly = displayMode === "image" || kind === "app";
  const button = document.createElement("button");
  button.className = "shortcut";
  button.type = "button";
  button.title = shortcut.name;
  button.dataset.kind = kind;
  button.classList.toggle("name-only", displayMode === "name" && kind !== "app");
  button.classList.toggle("image-only", imageOnly);
  button.classList.toggle("app-only", kind === "app");

  if (displayMode !== "name" || kind === "app") {
    let icon = shortcutIcon(shortcut);
    const imageUrl = shortcutImage(shortcut);
    if (imageUrl) {
      icon = document.createElement("img");
      icon.alt = "";
      icon.src = imageUrl;
      icon.addEventListener("error", () => {
        icon.replaceWith(shortcutIcon(shortcut));
      });
    }
    button.appendChild(icon);
  }

  if (!imageOnly) {
    const label = document.createElement("span");
    label.textContent = shortcut.name;
    button.appendChild(label);
  }

  button.addEventListener("click", () => api.openShortcut(shortcut));
  return button;
}

function renderShortcutGroup(titleText, shortcuts, displayMode, className) {
  if (!shortcuts.length) return null;
  const section = document.createElement("section");
  section.className = `shortcut-group ${className || ""}`.trim();

  const title = document.createElement("strong");
  title.className = "shortcut-group-title";
  title.textContent = titleText;
  section.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "shortcut-grid";
  grid.classList.add(`shortcut-grid--${displayMode}`);
  grid.classList.toggle(
    "image-only-grid",
    displayMode === "image" || shortcuts.every((shortcut) => shortcutKind(shortcut) === "app"),
  );
  for (const shortcut of shortcuts) {
    grid.appendChild(renderShortcutButton(shortcut, displayMode));
  }
  section.appendChild(grid);
  return section;
}

function renderRadialBubble(shortcut, displayMode) {
  const kind = shortcutKind(shortcut);
  const button = document.createElement("button");
  button.className = "radial-bubble";
  button.dataset.kind = kind;
  button.type = "button";
  button.setAttribute("aria-label", shortcut.name);

  let icon = shortcutIcon(shortcut);
  const imageUrl = shortcutImage(shortcut);
  if (imageUrl) {
    const img = document.createElement("img");
    img.alt = "";
    img.src = imageUrl;
    img.addEventListener("error", () => {
      const fallback = shortcutIcon(shortcut);
      fallback.classList.add("radial-bubble__icon");
      img.replaceWith(fallback);
    });
    icon = img;
  }
  icon.classList.add("radial-bubble__icon");
  button.appendChild(icon);

  // The name (the one you set) appears only on hover, so the panel stays a
  // clean set of logos/photos.
  const tip = document.createElement("span");
  tip.className = "radial-bubble__tip";
  tip.textContent = shortcut.name;
  button.appendChild(tip);

  button.addEventListener("click", () => api.openShortcut(shortcut));
  return button;
}

function renderRadialSide(kind, list, displayMode) {
  const side = document.createElement("div");
  side.className = `radial-side radial-side--${kind}`;
  list.slice(0, 12).forEach((shortcut, index) => {
    const bubble = renderRadialBubble(shortcut, displayMode);
    bubble.style.setProperty("--i", String(index));
    side.appendChild(bubble);
  });
  return side;
}

function makeToolBubble(icon, label, className, onClick) {
  const button = document.createElement("button");
  button.className = `radial-tool ${className || ""}`.trim();
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  const glyph = document.createElement("span");
  glyph.className = "radial-tool__icon";
  glyph.textContent = icon;
  const caption = document.createElement("span");
  caption.className = "radial-tool__label";
  caption.textContent = label;
  button.append(glyph, caption);
  button.addEventListener("click", onClick);
  return button;
}

function renderRadialTools(pet) {
  const tools = document.createElement("div");
  tools.className = "radial-tools";

  const settingsBtn = makeToolBubble("⚙", panelText("settings"), "radial-tool--settings", () => api.openSettings());
  settingsBtn.style.setProperty("--i", "0");

  tools.append(settingsBtn);
  return tools;
}

function renderSystemStrip() {
  const strip = document.createElement("div");
  strip.className = "radial-system";
  const stats = systemStats;
  if (!stats) {
    const waiting = document.createElement("span");
    waiting.className = "radial-system__wait";
    waiting.textContent = panelText("systemWaiting");
    strip.appendChild(waiting);
    return strip;
  }
  const metrics = [
    ["systemCpu", stats.cpu?.percent || 0, "#ff8f6b"],
    ["systemRam", stats.memory?.percent || 0, "#5fb6e8"],
    ["systemStorage", stats.storage?.percent || 0, "#8be0a4"],
  ];
  metrics.forEach(([key, pct, color], index) => {
    const meter = document.createElement("div");
    meter.className = "radial-meter";
    meter.style.setProperty("--i", String(index));
    meter.style.setProperty("--value", String(Math.round(clamp(pct, 0, 100))));
    meter.style.setProperty("--ring", color);
    const inner = document.createElement("div");
    inner.className = "radial-meter__inner";
    const value = document.createElement("strong");
    value.textContent = `${Math.round(pct)}%`;
    const label = document.createElement("span");
    label.textContent = panelText(key);
    inner.append(value, label);
    meter.appendChild(inner);
    strip.appendChild(meter);
  });
  return strip;
}

function renderShortcutPanel(pet) {
  const root = document.createElement("div");
  root.className = "pet-radial";

  const shortcuts = currentShortcuts();
  const displayMode = ["both", "image", "name"].includes(settings?.shortcutDisplayMode)
    ? settings.shortcutDisplayMode
    : "both";
  const visible = shortcuts.slice(0, 24);
  const appShortcuts = visible.filter((shortcut) => shortcutKind(shortcut) === "app");
  const webShortcuts = visible.filter((shortcut) => shortcutKind(shortcut) !== "app");

  // apps fan out to the LEFT, web links to the RIGHT, with the pet showing
  // through the transparent core in the middle.
  root.appendChild(renderRadialSide("apps", appShortcuts, displayMode));
  const core = document.createElement("div");
  core.className = "radial-core";
  core.style.setProperty("--core", `${getPetSize(pet)}px`);
  root.appendChild(core);
  root.appendChild(renderRadialSide("links", webShortcuts, displayMode));

  root.appendChild(renderRadialTools(pet));
  return root;
}

function renderSystemMetricCard(labelText, key, percentValue, detailText) {
  const card = document.createElement("section");
  card.className = "system-metric-card";
  card.dataset.metric = key;

  const head = document.createElement("div");
  head.className = "system-metric-head";
  const label = document.createElement("strong");
  label.textContent = labelText;
  const value = document.createElement("span");
  value.textContent = `${Math.round(percentValue)}%`;
  head.append(label, value);

  const meter = document.createElement("i");
  meter.className = "system-meter";
  meter.style.setProperty("--value", `${clamp(percentValue, 0, 100)}%`);

  const graph = document.createElement("div");
  graph.className = "system-graph";
  const samples = systemStatsHistory.length ? systemStatsHistory : [systemStats].filter(Boolean);
  for (const sample of samples.slice(-24)) {
    const bar = document.createElement("span");
    bar.style.setProperty("--value", `${clamp(systemMetricValue(sample, key), 3, 100)}%`);
    graph.appendChild(bar);
  }
  while (graph.children.length < 12) {
    const bar = document.createElement("span");
    bar.style.setProperty("--value", "4%");
    graph.prepend(bar);
  }

  const detail = document.createElement("em");
  detail.textContent = detailText;
  card.append(head, meter, graph, detail);
  return card;
}

function renderSimpleCarePage() {
  const stats = systemStats;
  const wrap = document.createElement("div");
  wrap.className = "simple-care-page system-page";

  const summary = document.createElement("section");
  summary.className = "simple-care-summary system-summary";
  const name = document.createElement("strong");
  name.textContent = panelText("carePage");
  const note = document.createElement("span");
  note.textContent = stats ? panelText("simpleCareNote") : panelText("systemWaiting");
  summary.append(name, note);
  wrap.appendChild(summary);

  if (!stats) return wrap;

  const memoryDetail = `${formatBytes(stats.memory?.used)} / ${formatBytes(stats.memory?.total)} ${panelText("systemUsed")}`;
  const storageDetail = `${formatBytes(stats.storage?.used)} / ${formatBytes(stats.storage?.total)} ${panelText("systemUsed")}`;
  const cpuDetail = `${Math.round(stats.cpu?.cores || 0)} ${panelText("systemCores")}`;
  wrap.append(
    renderSystemMetricCard(panelText("systemCpu"), "cpu", stats.cpu?.percent || 0, cpuDetail),
    renderSystemMetricCard(panelText("systemRam"), "memory", stats.memory?.percent || 0, memoryDetail),
    renderSystemMetricCard(panelText("systemStorage"), "storage", stats.storage?.percent || 0, storageDetail),
  );
  return wrap;
}

function renderPanelActions(pet, view) {
  const actions = document.createElement("div");
  actions.className = "panel-actions";

  if (view === "care") {
    const backButton = document.createElement("button");
    backButton.className = "pixel-button";
    backButton.type = "button";
    backButton.textContent = `← ${panelText("back")}`;
    backButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPanel(pet, { noBurst: true, view: "shortcuts" });
    });
    actions.appendChild(backButton);
  }

  const careButton = document.createElement("button");
  careButton.className = "pixel-button";
  careButton.type = "button";
  careButton.textContent = `✚ ${panelText("carePage")}`;
  careButton.disabled = view === "care";
  careButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPanel(pet, { noBurst: true, view: "care" });
  });

  const settingsButton = document.createElement("button");
  settingsButton.className = "pixel-button";
  settingsButton.type = "button";
  settingsButton.textContent = `⚙ ${panelText("settings")}`;
  settingsButton.addEventListener("click", () => api.openSettings());

  if (view === "shortcuts") actions.append(careButton, settingsButton);
  else actions.append(settingsButton);
  return actions;
}

function openPanel(pet, options = {}) {
  api.setClickThrough(false);
  if (!options.noBurst) panelManual = null;
  if (activePet && activePet !== pet) {
    activePet.pausedByPanel = false;
    pickTarget(activePet, performance.now());
  }
  activePet = pet;
  panelPinned = false;
  pet.pausedByPanel = true;
  pet.vx = 0;
  pet.vy = 0;
  pet.targetX = pet.x;
  pet.targetY = pet.y;
  if (!options.noBurst) spawnClickBurst(pet);

  // Radial layout that bubbles out of the character: apps left, links right,
  // settings below. The panel itself is transparent (no card) and only
  // the bubbles capture clicks, so clicking the gaps closes it.
  panel.className = "pet-panel pet-panel--radial";
  panel.dataset.view = "shortcuts";
  panel.dataset.system = "off";
  panel.setAttribute("aria-label", panelText("shortcuts"));
  panel.style.width = "";
  panel.style.minHeight = "";
  panel.innerHTML = "";
  panel.appendChild(renderShortcutPanel(pet));

  panel.hidden = false;
  panel._lastTransform = "";
  positionPanel();
}

function beginPanelMove(event, handle) {
  const rect = panel.getBoundingClientRect();
  panelDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
    active: false,
    handle,
  };
  panelManual = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  panel.classList.add("is-dragging");
  try {
    handle.setPointerCapture(event.pointerId);
  } catch {
    /* pointer capture is best effort */
  }
  event.preventDefault();
  event.stopPropagation();
}

function bindPanelMove(handle, options = {}) {
  if (handle.dataset.panelMoveBound === "true") return;
  handle.dataset.panelMoveBound = "true";
  handle.addEventListener("lostpointercapture", (event) => {
    finishPanelPointer(event.pointerId);
  });
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || panel.hidden) return;
    if (options.body && event.target.closest(PANEL_DRAG_BLOCK_SELECTOR)) return;
    if (!options.body && event.target.closest("button")) return;
    beginPanelMove(event, handle);
  });
}

function bindPanelResize(handle) {
  if (handle.dataset.panelResizeBound === "true") return;
  handle.dataset.panelResizeBound = "true";
  handle.addEventListener("lostpointercapture", (event) => {
    finishPanelPointer(event.pointerId);
  });
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    panelResize = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      handle,
    };
    panelManual = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    panel.classList.add("is-resizing");
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is best effort */
    }
    event.preventDefault();
    event.stopPropagation();
  });
}

function positionPanel() {
  if (!activePet || panel.hidden) return;
  const size = getPetSize(activePet);
  const { w, h } = viewport();
  const rectW = panel.offsetWidth || 240;
  const rectH = panel.offsetHeight || 160;
  // Align the transparent core (which the pet shows through) with the pet so the
  // bubbles fan out around the character. Falls back to the panel centre.
  const core = panel.querySelector(".radial-core");
  const coreCX = core ? core.offsetLeft + core.offsetWidth / 2 : rectW / 2;
  const coreCY = core ? core.offsetTop + core.offsetHeight / 2 : rectH / 2;
  const petCX = activePet.x + size / 2;
  const petCY = activePet.y + size / 2;
  let x = clamp(petCX - coreCX, 12, Math.max(12, w - rectW - 12));
  let y = clamp(petCY - coreCY, 12, Math.max(12, h - rectH - 12));
  const transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  if (panel._lastTransform === transform) return;
  panel._lastTransform = transform;
  panel.style.transform = transform;
}

function syncPets() {
  if (!settings) return;
  document.body.dataset.performance = settings.performanceMode || "saver";
  syncGhostSettings();
  syncUpdatePill();
  if (!settings.ghostMode) setGhostHidden(false);
  while (pets.length < MAX_SLOTS) pets.push(createPet(pets.length));
  const slots = settings.slots || [];
  const now = performance.now();
  for (let index = 0; index < pets.length; index += 1) {
    const slot = slots[index] || {};
    const pet = pets[index];
    const previousCharacterId = pet.characterId;
    pet.enabled = settings.enabled && slot.enabled !== false;
    pet.el.hidden = !pet.enabled;
    pet.characterId = CHARACTERS[slot.character] || customCharacterFor(slot.character) ? slot.character : DEFAULT_CHARACTER;
    const characterChanged = previousCharacterId !== pet.characterId;
    if (characterChanged) {
      pet.frame = 0;
      pet.rotation = 0;
      pet.vx = 0;
      pet.vy = 0;
      pet._lastFrame = null;
      pet._lastCharacter = null;
    }
    pet.behavior = behaviorFor(slot);
    pet.care = careForPet(pet);
    const character = characterFor(pet.characterId);
    pet.movement = { ...DEFAULT_MOVEMENT, ...(character.movement || {}) };
    const medal = medalForCare(pet.care, settings.game || null);
    pet.label.textContent = medal ? `${character.name} · ${medal.icon}` : character.name;
    pet.label.title = medal ? `${character.name} · ${careText(medal.labelKey)}` : character.name;
    pet.el.dataset.medal = medal ? medal.id : "";
    pet.el.style.setProperty("--medal-color", medal?.color || "transparent");
    pet.el.dataset.spriteType = customHasImage(customCharacterFor(pet.characterId)) ? "image" : "pixel";
    const moodId = careMood(pet.care);
    const aura = moodAuraFor(moodId);
    const form = evolutionCurrentForm(pet.care, settings.game || null);
    pet.el.dataset.mood = moodId;
    pet.el.dataset.form = form.id;
    pet.el.style.setProperty("--mood-color", aura.color);
    pet.el.style.setProperty("--form-color", form.color);
    pet.el.setAttribute("aria-label", `${character.name} companion`);
    syncPetSize(pet);
    // Only force a full canvas redraw when the character actually changed;
    // otherwise route through the guarded path (saves redundant redraws).
    if (characterChanged) renderSprite(pet, true);
    else renderSprite(pet);
    if (!pet.nextTargetAt || characterChanged) pickTarget(pet, now);
    if (characterChanged || Math.hypot(pet.vx, pet.vy) < 0.02) wakePet(pet, 0.5);
    if (characterChanged && activePet === pet && !panel.hidden) {
      openPanel(pet);
    }
  }
  if (activePet && !activePet.enabled) {
    closePanel(true);
  }
}

function syncUpdatePill() {
  if (!updatePill) return;
  const update = settings?.update || {};
  const available = update.available === true;
  updatePill.hidden = !available;
  if (!available) return;
  const ko = settings?.language === "ko";
  const label = ko ? "업데이트" : "Update";
  const version = update.latestVersion ? `v${String(update.latestVersion).replace(/^v/i, "")}` : "";
  updatePill.querySelector(".update-pill__text").textContent = label;
  updatePill.querySelector(".update-pill__version").textContent = version;
  updatePill.title = version ? `${label} ${version}` : label;
  updatePill.setAttribute("aria-label", updatePill.title);
}

function handleCursorPoint(point) {
  if (areaPicker) return;
  const now = performance.now();
  const validPrevious = mouseLastAt > 0 && mouseLastX > -9990 && mouseLastY > -9990;
  const moved = validPrevious && Math.hypot(point.x - mouseLastX, point.y - mouseLastY) >= GHOST_MOVE_THRESHOLD;
  registerSystemIdle(point.idleMs, moved ? "mouse" : "global", now);
  registerPointerPoint(point.x, point.y, now, moved);
  const target = document.elementFromPoint(point.x, point.y);
  const panelOpen = activePet && !panel.hidden;
  const overInteractive = !!target?.closest(".interactive");
  const interactive = panelOpen || overInteractive;
  if (interactive !== lastInteractive) {
    lastInteractive = interactive;
    api.setClickThrough(!interactive);
  }
}

function normalizePickedArea(x1, y1, x2, y2) {
  const { w, h } = viewport();
  const left = clamp(Math.min(x1, x2) / w, 0, 0.95);
  const top = clamp(Math.min(y1, y2) / h, 0, 0.95);
  const right = clamp(Math.max(x1, x2) / w, 0.05, 1);
  const bottom = clamp(Math.max(y1, y2) / h, 0.05, 1);
  return { left, top, right, bottom };
}

function finishAreaPick(result) {
  if (!areaPicker) return;
  areaPicker.el.remove();
  areaPicker = null;
  api.completeAreaPick(result);
}

function startAreaPicker(payload) {
  if (areaPicker) finishAreaPick({ ok: false, cancelled: true });
  closePanel(true);

  const overlay = document.createElement("div");
  overlay.className = "area-picker interactive";

  const hint = document.createElement("div");
  hint.className = "area-picker__hint";
  hint.textContent = `#${Number(payload?.slotIndex || 0) + 1} movement area: drag on the screen`;

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    finishAreaPick({ ok: false, cancelled: true });
  });
  hint.appendChild(cancel);

  const rect = document.createElement("div");
  rect.className = "area-picker__rect";
  overlay.append(hint, rect);
  stage.appendChild(overlay);

  areaPicker = {
    el: overlay,
    rect,
    dragging: false,
    startX: 0,
    startY: 0,
  };

  overlay.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    areaPicker.dragging = true;
    areaPicker.startX = event.clientX;
    areaPicker.startY = event.clientY;
    rect.style.display = "block";
    rect.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    rect.style.width = "0px";
    rect.style.height = "0px";
    overlay.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  overlay.addEventListener("pointermove", (event) => {
    if (!areaPicker?.dragging) return;
    const x = Math.min(areaPicker.startX, event.clientX);
    const y = Math.min(areaPicker.startY, event.clientY);
    const width = Math.abs(event.clientX - areaPicker.startX);
    const height = Math.abs(event.clientY - areaPicker.startY);
    rect.style.transform = `translate(${x}px, ${y}px)`;
    rect.style.width = `${width}px`;
    rect.style.height = `${height}px`;
  });

  overlay.addEventListener("pointerup", (event) => {
    if (!areaPicker?.dragging) return;
    areaPicker.dragging = false;
    const width = Math.abs(event.clientX - areaPicker.startX);
    const height = Math.abs(event.clientY - areaPicker.startY);
    if (width < 80 || height < 80) {
      rect.style.display = "none";
      return;
    }
    const area = normalizePickedArea(areaPicker.startX, areaPicker.startY, event.clientX, event.clientY);
    finishAreaPick({ ok: true, area });
  });
}

function wakeTick() {
  tickTimer = null;
  tick(performance.now());
}

// The loop used to re-request an animation frame every display refresh
// (60-120 Hz) no matter the FPS setting, and kept running at full rate even
// while every pet was ghost-hidden (i.e. while you are actively working). Pace
// it instead: poll slowly when nothing is animating, run at the chosen frame
// rate for low FPS, and only fall back to rAF for high FPS. Motion is dt-scaled
// so speed is unchanged.
function scheduleTick() {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (tickTimer) {
    window.clearTimeout(tickTimer);
    tickTimer = null;
  }
  const live = effectParticles.length > 0 || desktopObjects.length > 0 || activePet || areaPicker;
  const petsActive = !ghostHidden && pets.some((pet) => pet.enabled);
  if (!live && !petsActive) {
    // Idle: just poll often enough to notice ghost reappear / new activity.
    tickTimer = window.setTimeout(wakeTick, 160);
    return;
  }
  const frameMs = performanceProfile().frameMs;
  if (frameMs >= 21) {
    tickTimer = window.setTimeout(wakeTick, frameMs);
  } else {
    animationFrameId = window.requestAnimationFrame(tick);
  }
}

function tick(now) {
  animationFrameId = null;
  const profile = performanceProfile();
  refreshSystemStats();
  updateGhostMode(now);
  const dt = now - lastTick;
  recordFrameHealth(now, dt, profile);
  const motionDue = dt >= Math.max(8, profile.frameMs * 0.82);
  if (motionDue) {
    lastTick = now;
    const step = clamp(dt / 16.67, 0.2, 2.4);
    const freezeGhostMotion = ghostMotionFrozen(now);
    if (freezeGhostMotion) {
      for (const pet of pets) {
        if (pet.enabled) freezePetForGhost(pet, now);
      }
    } else {
      updateDesktopObjects(now, step);
      for (const pet of pets) {
        if (!pet.enabled) continue;
        updateMotion(pet, now, step);
        resolvePetPointerCollision(pet, now, step);
      }
      resolvePetCollisions(now);
      for (const pet of pets) {
        if (!pet.enabled) continue;
        updateAnimation(pet, now);
        applyPetTransform(pet);
        if (!ghostHidden) spawnTrail(pet, now);
      }
    }
    positionPetBubbles();
  } else if (!ghostHidden && hasActiveRainbow()) {
    for (const pet of pets) {
      if (pet.enabled && pet.behavior?.effectMode === "rainbow") spawnTrail(pet, now);
    }
  }
  drawEffects(now);
  if (!motionDue) positionPetBubbles();
  if (motionDue || activePet) positionPanel();
  maybeAutoTalk(now);
  scheduleTick();
}

async function init() {
  resizeEffectsCanvas();
  settings = await api.getSettings();
  syncPets();
  api.onSettingsChanged((next) => {
    settings = next;
    resizeEffectsCanvas();
    syncPets();
  });
  api.onCursorPoint(handleCursorPoint);
  api.onAreaPickStart(startAreaPicker);
  api.setClickThrough(true);
  refreshSystemStats({ force: true });
  lastTick = performance.now();
  scheduleTick();
}

window.addEventListener("resize", () => {
  viewportCache.w = window.innerWidth;
  viewportCache.h = window.innerHeight;
  resizeEffectsCanvas();
  const { w, h } = viewport();
  for (const pet of pets) {
    const size = getPetSize(pet);
    pet.x = clamp(pet.x, 0, Math.max(0, w - size));
    pet.y = clamp(pet.y, 0, Math.max(0, h - size));
  }
});

for (const [eventName, source] of [
  ["wheel", "wheel"],
  ["scroll", "wheel"],
  ["keydown", "keyboard"],
]) {
  window.addEventListener(
    eventName,
    () => {
      registerUserActivity(performance.now(), source);
    },
    { passive: true, capture: true },
  );
}

updatePill?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  api.setClickThrough(false);
  api.openUpdate();
});

init();
