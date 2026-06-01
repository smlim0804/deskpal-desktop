import { CHARACTERS, DEFAULT_CHARACTER } from "./characters.js";

const api = window.busyPet;
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
const SIDE_VIEW_CHARACTER_IDS = new Set(["car"]);
const PERFORMANCE_PROFILES = Object.freeze({
  saver: { frameMs: 1000 / 18, heavyFrameMs: 1000 / 16, maxParticles: 36, trailMs: 220, dpr: 1, trails: true, ribbonPoints: 18 },
  balanced: { frameMs: 1000 / 30, heavyFrameMs: 1000 / 24, maxParticles: 100, trailMs: 118, dpr: 1, trails: true, ribbonPoints: 28 },
  smooth: { frameMs: 1000 / 45, heavyFrameMs: 1000 / 34, maxParticles: 160, trailMs: 76, dpr: 1.35, trails: true, ribbonPoints: 42 },
});
const DEFAULT_MOVEMENT = {
  speed: 1.6,
  accel: 0.08,
  damping: 0.92,
  changeMs: [1800, 5000],
  wobble: 0.08,
};

const stage = document.getElementById("stage");
const aquarium = document.getElementById("aquarium");
const ground = document.getElementById("ground");
const effectsCanvas = document.getElementById("effects-canvas");
const effectsCtx = effectsCanvas?.getContext("2d", { alpha: true }) || null;
const panel = document.getElementById("pet-panel");
const quickChat = document.getElementById("quick-chat");

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
let lastTick = performance.now();
let lastInteractive = false;
let trailHue = 0;
let areaPicker = null;
let effectsDpr = 1;
let effectsCanvasSignature = "";
let effectParticles = [];
let effectsDirty = false;
let animationFrameId = null;
let aquariumSignature = "";
let autoTalkBusy = false;
let nextAutoTalkAt = 0;
let quickChatSlotIndex = 0;
let quickChatBusy = false;
let quickChatCloseTimer = null;
let panelPinned = false;
let panelDrag = null;
let panelResize = null;
let panelManual = null;
const spriteImageCache = new Map();
const CHAT_HISTORY_KEY = "busypet.chatHistory.v1";
const CHAT_HISTORY_LIMIT = 48;
const FLOATING_BUBBLE_HIDE_MS = 460;
const QUICK_CHAT_HIDE_MS = 280;
const PANEL_DRAG_BLOCK_SELECTOR = [
  "button",
  "input",
  "textarea",
  "select",
  "a",
  "[role='button']",
  ".panel-resize",
  ".shortcut-grid",
  ".ai-chat",
  ".panel-actions",
].join(",");

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
    roam: "Roam",
    stay: "Stay",
    aiPlaceholder: "Talk to this character",
    aiSend: "Send",
    aiThinking: "Thinking...",
    aiDisabled: "Say hi. Local character chat works even when AI is off.",
    aiAttach: "Image",
    aiClearImage: "Remove image",
    movementApplied: "Movement updated.",
    quickTitle: "Talk to a character",
    quickPlaceholder: "Message BusyPet",
    quickHint: "⌘⇧Y",
  },
  ko: {
    note: "바로가기와 움직임 설정.",
    close: "닫기",
    settings: "설정",
    roam: "움직임",
    stay: "멈춤",
    aiPlaceholder: "캐릭터에게 말 걸기",
    aiSend: "전송",
    aiThinking: "생각 중...",
    aiDisabled: "말 걸어봐. AI가 꺼져도 캐릭터가 맥락에 맞춰 짧게 대답해.",
    aiAttach: "사진",
    aiClearImage: "사진 제거",
    movementApplied: "움직임 반영했어.",
    quickTitle: "캐릭터와 대화",
    quickPlaceholder: "BusyPet에게 메시지",
    quickHint: "⌘⇧Y",
  },
};

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

const AI_CONNECT_LINES = Object.freeze({
  ufo: {
    ko: "삐빅, 통신 코어가 아직 비어 있어. 설정 메뉴에서 AI를 연결해주면 제대로 대화할게.",
    en: "Beep. My comms core is empty. Connect AI in Settings and I can really talk.",
  },
  car: {
    ko: "네비게이션 AI가 꺼져 있어. 설정에서 AI를 연결해주면 제대로 달리면서 대답할게.",
    en: "My navigation AI is off. Connect AI in Settings and I can answer properly.",
  },
  slime: {
    ko: "말랑한 귀는 열려 있는데 생각 엔진이 아직 없어. 설정에서 AI를 연결해줘.",
    en: "My soft ears are open, but my thinking engine is missing. Connect AI in Settings.",
  },
  comet: {
    ko: "별꼬리는 준비됐는데 생각 궤도가 비어 있어. 설정에서 AI를 연결해주면 반짝 대답할게.",
    en: "My tail is ready, but the thought orbit is empty. Connect AI in Settings.",
  },
  star: {
    ko: "별빛은 켜졌지만 지성 코어는 아직 꺼져 있어. 설정에서 AI를 연결해줘.",
    en: "My light is on, but my mind core is off. Connect AI in Settings.",
  },
  rocket: {
    ko: "연료는 있는데 관제 AI가 연결 안 됐어. 설정 메뉴에서 AI를 연결해주면 바로 응답 발사할게.",
    en: "Fuel is ready, but mission AI is not connected. Connect AI in Settings.",
  },
  saturn: {
    ko: "고리는 돌고 있지만 생각 위성이 아직 없어. 설정에서 AI를 연결해줘.",
    en: "My rings are orbiting, but my thought satellite is missing. Connect AI in Settings.",
  },
  gem: {
    ko: "반짝임은 준비됐고 판단 코어만 비어 있어. 설정에서 AI를 연결해줘.",
    en: "The shine is ready; the judgment core is empty. Connect AI in Settings.",
  },
  donut: {
    ko: "달콤한 마음은 있는데 똑똑한 크림이 아직 없어. 설정에서 AI를 연결해줘.",
    en: "Sweetness is here, but the smart filling is missing. Connect AI in Settings.",
  },
  skull: {
    ko: "으스스한 껍데기는 켜졌는데 두뇌가 비어 있어. 설정에서 AI를 연결해줘.",
    en: "Spooky shell online, brain missing. Connect AI in Settings.",
  },
  eyeball: {
    ko: "눈은 뜨고 있지만 생각 렌즈가 아직 없어. 설정에서 AI를 연결해줘.",
    en: "Eye open, thinking lens missing. Connect AI in Settings.",
  },
  energyball: {
    ko: "파직, 에너지는 있는데 지능 회로가 아직 연결 안 됐어. 설정에서 AI를 연결해줘.",
    en: "Zap. Energy is here, intelligence circuit is not. Connect AI in Settings.",
  },
  bug: {
    ko: "사사삭, 정찰은 가능하지만 판단용 AI 더듬이가 없어. 설정에서 AI를 연결해줘.",
    en: "Skitter. I can scout, but my AI antenna is missing. Connect AI in Settings.",
  },
  tank: {
    ko: "차체는 든든한데 작전 AI가 비어 있어. 설정에서 AI를 연결해주면 명령을 더 잘 이해할게.",
    en: "Armor ready, tactical AI empty. Connect AI in Settings and I will understand better.",
  },
  custom: {
    ko: "내 컨셉은 준비됐어. 설정에서 AI를 연결해주면 네가 정한 성격대로 말할게.",
    en: "My concept is ready. Connect AI in Settings and I will speak with your custom personality.",
  },
});

const LOCAL_INTENT_REPLIES = Object.freeze({
  ko: {
    empty: ["한 문장만 더 던져줘. 내가 핵심을 잡아서 짧게 받아줄게."],
    thanks: ["나도 고마워. 지금 흐름은 기억해두고 다음 말에 이어서 반응할게."],
    greeting: ["안녕. 그냥 랜덤으로 떠드는 대신, 네가 말한 내용에 맞춰 대답해볼게."],
    input: ["입력 문제로 들려. 한글 조합, 포커스, 전송 타이밍이 서로 부딪히는지 먼저 보는 게 맞아."],
    performance: ["성능 문제로 들려. 효과 수, 프레임 제한, 움직임 계산을 나눠서 줄이면 체감이 바로 좋아질 수 있어."],
    bug: ["버그 얘기로 이해했어. 방금 한 행동, 기대한 동작, 실제 결과를 순서대로 보면 원인을 빨리 좁힐 수 있어."],
    design: ["디자인 요청으로 들려. 예쁘게만 바꾸기보다 시선 흐름, 버튼 위치, 여백을 같이 맞추는 게 좋아."],
    shortcut: ["바로가기 쪽이면 이름, 링크나 앱 경로, 아이콘 표시 방식을 따로 보면 덜 꼬여."],
    ai: ["AI 연결 얘기라면 내장 AI처럼 보이게 할 수는 있지만, 실제 지능은 로컬 모델이나 사용자의 API 연결이 필요해."],
    code: ["구현 얘기로 들려. 상태 저장, 이벤트 처리, 렌더 갱신이 어디서 엇갈리는지 나눠서 보는 게 좋아."],
    conversation: ["대화 품질 얘기로 이해했어. 캐릭터성은 살리되, 네 문장의 의도를 먼저 따라가는 쪽이 더 자연스러워."],
    how: ["방법을 묻는 걸로 이해했어. 지금은 큰 설명보다 첫 단계, 확인할 것, 다음 수정 순서로 보면 돼."],
    request: ["수정 요청으로 이해했어. 원하는 결과를 먼저 고정하고, 기존 기능이 깨지지 않게 작은 단위로 바꾸는 게 좋아."],
    stop: ["멈춤으로 이해했어. 움직임은 줄이고 네 입력을 우선 듣는 상태로 있는 게 맞아."],
    default: ["말의 핵심은 잡았어. 지금은 네가 원하는 결과와 현재 어긋난 지점을 나눠서 생각하면 더 잘 맞출 수 있어."],
  },
  en: {
    empty: ["Give me one more sentence and I will respond to the actual point."],
    thanks: ["Thanks too. I will keep the thread and respond from here."],
    greeting: ["Hi. I will answer the point instead of throwing random flavor text."],
    input: ["That sounds like an input issue. Composition, focus, and submit timing are the first things to check."],
    performance: ["That sounds like performance. Effects count, FPS limits, and movement calculations should be tuned separately."],
    bug: ["I read that as a bug. Last action, expected behavior, and actual result will narrow it down quickly."],
    design: ["That is a design request. Layout rhythm, button placement, and spacing matter as much as the style."],
    shortcut: ["For shortcuts, separate the name, URL or app path, and icon display mode so the state stays clean."],
    ai: ["For AI, it can feel built in, but real intelligence still needs a local model or the user's API connection."],
    code: ["That sounds implementation-related. State, events, and render updates are the first places to inspect."],
    conversation: ["I read that as conversation quality. Personality should stay, but the reply should follow your intent first."],
    how: ["I read that as a how-to question. Start with the first step, what to verify, and the next change."],
    request: ["I read that as a change request. Lock the desired result first, then patch it in small safe steps."],
    stop: ["I read that as pause or stay. I should slow down and prioritize your input."],
    default: ["I get the main point. The useful split is desired result versus what currently feels off."],
  },
});

function panelText(key) {
  const language = ["en", "ko"].includes(settings?.language) ? settings.language : "en";
  return PANEL_I18N[language]?.[key] || PANEL_I18N.en[key] || key;
}

function currentLanguage() {
  return settings?.language === "ko" ? "ko" : "en";
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function localLinesFor(characterId) {
  const key = LOCAL_CHARACTER_LINES[characterId] ? characterId : customCharacterFor(characterId) ? "custom" : "star";
  return LOCAL_CHARACTER_LINES[key]?.[currentLanguage()] || LOCAL_CHARACTER_LINES.star.en;
}

function pickLocalLine(characterId) {
  const lines = localLinesFor(characterId);
  return lines[Math.floor(Math.random() * lines.length)] || lines[0];
}

function localStyleFor(characterId) {
  const key = LOCAL_CHARACTER_STYLES[characterId] ? characterId : customCharacterFor(characterId) ? "custom" : "star";
  return LOCAL_CHARACTER_STYLES[key]?.[currentLanguage()] || LOCAL_CHARACTER_STYLES.star.en;
}

function detectLocalIntent(message) {
  const clean = String(message || "").trim();
  const lower = clean.toLowerCase();
  if (!clean) return "empty";
  if (/고마|ㄳ|thank/.test(lower)) return "thanks";
  if (/안녕|하이|hello|hi\b/.test(lower)) return "greeting";
  if (/한글|입력|타자|키보드|복붙|붙여넣|안쳐|안 쳐|ime|keyboard|typing|paste|composition/.test(lower)) return "input";
  if (/렉|느려|버벅|프레임|fps|최적|무거|lag|slow|stutter|performance|frame/.test(lower)) return "performance";
  if (/디자인|색|여백|아이콘|픽셀|예쁘|ui|ux|design|layout|icon|spacing/.test(lower)) return "design";
  if (/바로가기|링크|url|사이트|앱|경로|shortcut|link|site|path/.test(lower)) return "shortcut";
  if (/ai|지피티|gpt|클로드|claude|ollama|api|모델|model/.test(lower)) return "ai";
  if (/코드|함수|파일|스크립트|빌드|패키|깃허브|github|electron|cli|code|function|build|package/.test(lower)) return "code";
  if (/말이|말 안|안통|대답|엉뚱|랜덤|이해|conversation|reply|random|context/.test(lower)) return "conversation";
  if (/버그|오류|에러|안돼|안되|안됨|문제|고장|이상|failed|fail|broken|error|bug/.test(lower)) return "bug";
  if (/어케|어떻게|왜|뭐야|가능|방법|how|why|can\b|possible/.test(lower)) return "how";
  if (/해줘|바꿔|수정|고쳐|넣어|빼|없애|만들|추가|삭제|remove|add|fix|change|make|update/.test(lower)) return "request";
  if (/멈|가만|정지|stop|stay|pause/.test(lower)) return "stop";
  return "default";
}

function localCharacterReply(character, message) {
  const clean = String(message || "").trim();
  const language = currentLanguage();
  const intent = detectLocalIntent(clean);
  const replies = LOCAL_INTENT_REPLIES[language]?.[intent] || LOCAL_INTENT_REPLIES.en.default;
  const reply = replies[Math.floor(Math.random() * replies.length)] || replies[0];
  return `${localStyleFor(character.id)} ${reply}`;
}

function aiConnectReply(character) {
  const key = AI_CONNECT_LINES[character?.id] ? character.id : customCharacterFor(character?.id) ? "custom" : "star";
  const language = currentLanguage();
  return AI_CONNECT_LINES[key]?.[language] || AI_CONNECT_LINES.star.en;
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

function normalizedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

function normalizeAiMovementAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = String(value.type || "").trim().toLowerCase();
  if (type === "motion") {
    const dx = normalizedNumber(value.dx, 0, -1, 1);
    const dy = normalizedNumber(value.dy, 0, -1, 1);
    const spin = normalizedNumber(value.spin, 0, -3, 3);
    if (Math.hypot(dx, dy) < 0.05 && Math.abs(spin) < 0.05 && !Number.isFinite(Number(value.speed))) return null;
    return {
      type: "motion",
      dx,
      dy,
      distance: normalizedNumber(value.distance, 220, 0, 520),
      speed: Number.isFinite(Number(value.speed)) ? normalizedNumber(value.speed, 1, 0.35, 2.5) : null,
      spin,
      holdMs: Math.round(normalizedNumber(value.holdMs, 2600, 600, 8000)),
    };
  }
  if (type === "speed") {
    const factor = Number(value.factor);
    if (Number.isFinite(factor)) return { type: "speed", factor: normalizedNumber(factor, 1, 0.25, 4) };
    const speed = Number(value.value);
    return Number.isFinite(speed) ? { type: "speed", value: normalizedNumber(speed, 1, 0.35, 2.5) } : null;
  }
  if (type === "mode") {
    const movement = String(value.movement || "").trim().toLowerCase();
    const mouse = String(value.mouse || "").trim().toLowerCase();
    const action = { type: "mode" };
    if (["free", "stay"].includes(movement)) action.movement = movement;
    if (["follow", "avoid", "ignore"].includes(mouse)) action.mouse = mouse;
    return action.movement || action.mouse ? action : null;
  }
  return null;
}

function aiActionToMovementCommand(action) {
  const command = createMovementCommand();
  if (!action) return null;
  if (action.type === "motion") {
    if (Math.hypot(action.dx, action.dy) >= 0.05 && action.distance > 0) {
      command.target = { x: action.dx, y: action.dy };
      command.distance = action.distance;
    }
    if (Number.isFinite(action.speed)) command.speed = action.speed;
    if (Number.isFinite(action.spin) && Math.abs(action.spin) >= 0.05) command.spin = action.spin * 34;
    command.aiHoldMs = action.holdMs;
    command.changed = true;
  } else if (action.type === "speed") {
    if (Number.isFinite(action.factor)) command.speedFactor = action.factor;
    else command.speed = action.value;
    command.changed = true;
  } else if (action.type === "mode") {
    if (action.movement === "stay") command.stop = true;
    else if (action.movement === "free") command.roam = true;
    if (action.mouse) command.mouseMode = action.mouse;
    command.changed = true;
  }
  return command.changed ? command : null;
}

function applyAiActionResult(pet, character, result) {
  if (!result?.ok) return result;
  const visibleText = String(result.text || "").trim();
  const resultAction = normalizeAiMovementAction(result.action);
  const action = resultAction;
  if (!action) {
    return { ...result, text: visibleText || movementCommandReply(character, createMovementCommand()) };
  }
  const command = aiActionToMovementCommand(action);
  const applied = command ? applyMovementAction(pet, command, character, { source: "ai" }) : null;
  return {
    ...result,
    actionApplied: !!applied,
    text: visibleText || applied?.reply || movementCommandReply(character, command || createMovementCommand()),
  };
}

async function answerAsCharacter(pet, character, payload) {
  if (settings?.ai?.enabled) {
    try {
      const result = await api.chatWithAi(payload);
      if (result?.ok) return result;
    } catch {
      // Below, ask the user to connect AI instead of pretending to be intelligent.
    }
  }
  await wait(rand(220, 420));
  return { ok: true, provider: "needs-ai", text: aiConnectReply(character) };
}

function loadChatStore() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHAT_HISTORY_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveChatStore(store) {
  try {
    window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(store));
  } catch {
    /* storage may be unavailable */
  }
}

function historyKey(characterId) {
  return String(characterId || DEFAULT_CHARACTER);
}

function getChatHistory(characterId) {
  const store = loadChatStore();
  const list = Array.isArray(store[historyKey(characterId)]) ? store[historyKey(characterId)] : [];
  return list.filter((item) => item && item.role && typeof item.text === "string").slice(-CHAT_HISTORY_LIMIT);
}

function pushChatHistory(characterId, role, text) {
  const clean = String(text || "").trim();
  if (!clean) return;
  const store = loadChatStore();
  const key = historyKey(characterId);
  const list = Array.isArray(store[key]) ? store[key] : [];
  list.push({ role, text: clean.slice(0, 1600), at: Date.now() });
  store[key] = list.slice(-CHAT_HISTORY_LIMIT);
  saveChatStore(store);
}

function petForSlot(slotIndex) {
  return pets.find((pet) => pet.slotIndex === slotIndex && pet.enabled) || pets.find((pet) => pet.enabled) || null;
}

function petForCharacter(characterId) {
  return pets.find((pet) => pet.enabled && pet.characterId === characterId) || pets.find((pet) => pet.enabled) || null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
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
  return { w: window.innerWidth, h: window.innerHeight };
}

function performanceProfile() {
  const base = PERFORMANCE_PROFILES[settings?.performanceMode] || PERFORMANCE_PROFILES.saver;
  const fps = clamp(Math.round(Number(settings?.fps || 16)), 10, 60);
  return {
    ...base,
    frameMs: 1000 / fps,
    heavyFrameMs: 1000 / Math.max(10, Math.round(fps * 0.75)),
  };
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

  const step = profile.ribbonPoints > 24 ? 1 : 2;
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

function drawEffects(now) {
  if (!effectsCtx) return;
  const liveRibbon = hasRibbonTrails();
  if (!effectParticles.length && !effectsDirty && !liveRibbon) return;
  const { w, h } = viewport();
  effectsCtx.clearRect(0, 0, w, h);

  for (const pet of pets) drawRibbonTrail(effectsCtx, pet, now);

  if (!effectParticles.length) {
    effectsDirty = false;
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
    effectsCtx.globalAlpha = particle.alpha * (1 - age);
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
    } else {
      effectsCtx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
    }
  }

  effectsCtx.globalAlpha = 1;
  effectsDirty = true;
}

function renderSprite(pet, force = false) {
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

  const label = document.createElement("span");
  label.className = "pet-label";
  el.appendChild(label);

  stage.appendChild(el);

  const pet = {
    slotIndex,
    el,
    canvas,
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
    ribbonTrail: [],
    spin: 0,
    spinVelocity: 0,
    impactUntil: 0,
    aiControlledUntil: 0,
    aiBehaviorOverride: null,
    aiDrive: null,
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
  trackMouse(event.clientX, event.clientY);
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

  const reachedTarget = Math.hypot(pet.targetX - pet.x, pet.targetY - pet.y) < 12;
  if (!flying && !aiControlled && (now > pet.nextTargetAt || reachedTarget)) {
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
  } else if (!flying && behavior.movementStyle !== "stay") {
    const dx = pet.targetX - pet.x;
    const dy = pet.targetY - pet.y;
    const dist = Math.hypot(dx, dy) || 1;
    const accel = (movement.accel || DEFAULT_MOVEMENT.accel) * behavior.speedMultiplier * replyFactor;
    pet.vx += (dx / dist) * accel * step;
    pet.vy += (dy / dist) * accel * step;
    pet.vx += rand(-1, 1) * (movement.wobble || DEFAULT_MOVEMENT.wobble) * replyFactor * step;
    pet.vy += rand(-1, 1) * (movement.wobble || DEFAULT_MOVEMENT.wobble) * replyFactor * step;
  } else if (!flying) {
    pet.vx += (pet.targetX - pet.x) * 0.002 * step;
    pet.vy += (pet.targetY - pet.y) * 0.002 * step;
  }

  const cx = pet.x + size / 2;
  const cy = pet.y + size / 2;
  const mdx = mouseX - cx;
  const mdy = mouseY - cy;
  const mdist = Math.hypot(mdx, mdy);

  if (!flying && !aiDrive && behavior.mouseMode === "follow" && mdist > 1) {
    pet.vx += (mdx / mdist) * 0.16 * step;
    pet.vy += (mdy / mdist) * 0.16 * step;
  } else if (!flying && !aiDrive && behavior.mouseMode === "avoid" && mdist < MOUSE_PROXIMITY && mdist > Math.max(30, size * 0.7)) {
    const grabHalo = Math.max(30, size * 0.7);
    const range = Math.max(1, MOUSE_PROXIMITY - grabHalo);
    const force = (1 - (mdist - grabHalo) / range) * 0.18;
    pet.vx -= (mdx / mdist) * force * step;
    pet.vy -= (mdy / mdist) * force * step;
  }

  const speed = Math.hypot(pet.vx, pet.vy);
  const aiSpeedBoost = aiDrive ? clamp(Number(aiDrive.speed) || Number(behavior.speedMultiplier) || 1, 1, 3) * 1.25 : 1;
  const baseMaxSpeed = (movement.speed || DEFAULT_MOVEMENT.speed) * behavior.speedMultiplier * replyFactor * aiSpeedBoost;
  const maxSpeed = flying ? Math.max(baseMaxSpeed, MAX_THROW_SPEED) : baseMaxSpeed;
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
    rotation += diff * 0.18;
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

function updateRainbowRibbon(pet, now) {
  pet.ribbonTrail = [];
}

function effectAnchorFor(pet) {
  const custom = customCharacterFor(pet.characterId);
  return custom?.effectAnchor || pet.behavior?.effectAnchor || { x: 0.5, y: 0.56 };
}

function effectDirectionFor(pet) {
  const custom = customCharacterFor(pet.characterId);
  return custom?.effectDirection || pet.behavior?.effectDirection || "back";
}

function effectOrigin(pet, size) {
  const anchor = effectAnchorFor(pet);
  const anchorX = Number(anchor.x);
  const anchorY = Number(anchor.y);
  return {
    x: pet.x + size * clamp(Number.isFinite(anchorX) ? anchorX : 0.5, 0, 1),
    y: pet.y + size * clamp(Number.isFinite(anchorY) ? anchorY : 0.56, 0, 1),
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

function faviconUrl(url) {
  try {
    const host = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${host}.ico`;
  } catch {
    return "";
  }
}

function shortcutKind(shortcut) {
  return shortcut?.type === "app" ? "app" : "web";
}

function shortcutIcon(shortcut) {
  const icon = document.createElement("span");
  icon.className = `shortcut-icon ${shortcutKind(shortcut)}`;
  icon.textContent = shortcutKind(shortcut) === "app" ? "APP" : "URL";
  return icon;
}

function shortcutImage(shortcut) {
  if (shortcut?.imagePath) return fileUrlFromPath(shortcut.imagePath);
  return shortcutKind(shortcut) === "web" ? faviconUrl(shortcut.url) : "";
}

function hasCustomShortcutImage(shortcut) {
  return !!String(shortcut?.imagePath || "").trim();
}

function appendChatMessage(history, role, text) {
  const message = document.createElement("div");
  const classes = ["chat-message"];
  for (const token of String(role || "").split(/\s+/)) {
    if (token === "pet") classes.push("from-pet");
    else if (token === "user") classes.push("from-user");
    else if (token === "error") classes.push("from-error");
    else if (token) classes.push(token);
  }
  message.className = classes.join(" ");
  message.textContent = text;
  history.appendChild(message);
  history.scrollTop = history.scrollHeight;
  positionPanel();
}

function renderChatHistory(history, character) {
  const entries = getChatHistory(character.id);
  if (!entries.length) {
    appendChatMessage(history, "pet", panelText("aiDisabled"));
    return;
  }
  for (const item of entries) {
    appendChatMessage(history, item.role === "user" ? "user" : item.role === "error" ? "error" : "pet", item.text);
  }
}

function slowPetForReply(pet) {
  if (!pet) return () => {};
  pet.replySlowUntil = performance.now() + 16000;
  return () => {
    pet.replySlowUntil = Math.max(performance.now() + 3000, pet.replySlowUntil || 0);
  };
}

function movementStateForPet(pet) {
  if (!pet) return {};
  const { w, h } = viewport();
  const behavior = effectiveBehaviorForPet(pet) || {};
  const now = performance.now();
  return {
    viewport: { width: Math.round(w), height: Math.round(h) },
    position: { x: Math.round(pet.x), y: Math.round(pet.y) },
    target: { x: Math.round(pet.targetX), y: Math.round(pet.targetY) },
    velocity: { x: Number(pet.vx.toFixed(2)), y: Number(pet.vy.toFixed(2)) },
    behavior: {
      movementStyle: behavior.movementStyle || "free",
      mouseMode: behavior.mouseMode || "avoid",
      areaPreset: behavior.areaPreset || "all",
      speedMultiplier: Number(Number(behavior.speedMultiplier || 1).toFixed(2)),
    },
    panelPaused: pet.pausedByPanel === true,
    aiControlled: now < (pet.aiControlledUntil || 0),
  };
}

function showThinking(pet) {
  if (!pet?.el || !stage) return () => {};
  const old = pet.thinkingEl;
  if (old) hidePetBubble(pet, old, "thinkingEl", { immediate: true });
  pet.el.classList.add("pet-talking");
  const bubble = document.createElement("div");
  bubble.className = "pet-thinking pet-floating-bubble";
  bubble.innerHTML = "<i></i><i></i><i></i>";
  stage.appendChild(bubble);
  pet.thinkingEl = bubble;
  positionPetBubble(pet, bubble);
  window.requestAnimationFrame(() => bubble.classList.add("is-visible"));
  pet.replySlowUntil = performance.now() + 16000;
  return () => {
    hidePetBubble(pet, bubble, "thinkingEl");
    pet.replySlowUntil = Math.max(performance.now() + 3500, pet.replySlowUntil || 0);
  };
}

function createAiChat(character, pet) {
  const wrap = document.createElement("form");
  wrap.className = "ai-chat";
  let attachedImagePath = "";
  wrap.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    api.setClickThrough(false);
  });

  const history = document.createElement("div");
  history.className = "chat-history";
  renderChatHistory(history, character);

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 800;
  input.placeholder = panelText("aiPlaceholder");
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("enterkeyhint", "send");
  let composing = false;
  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.isComposing || composing)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
  input.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    api.setClickThrough(false);
    window.requestAnimationFrame(() => input.focus());
  });

  const send = document.createElement("button");
  send.className = "pixel-button";
  send.type = "submit";
  send.textContent = panelText("aiSend");
  send.addEventListener("pointerdown", (event) => event.stopPropagation());

  const attach = document.createElement("button");
  attach.className = "chat-attach";
  attach.type = "button";
  attach.textContent = panelText("aiAttach");
  attach.addEventListener("pointerdown", (event) => event.stopPropagation());

  const preview = document.createElement("div");
  preview.className = "chat-attachment";
  preview.hidden = true;

  function renderAttachment() {
    preview.innerHTML = "";
    preview.hidden = !attachedImagePath;
    if (!attachedImagePath) return;
    const image = document.createElement("img");
    image.alt = "";
    image.src = fileUrlFromPath(attachedImagePath);
    const name = document.createElement("span");
    name.textContent = fileNameFromPath(attachedImagePath);
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "×";
    clear.title = panelText("aiClearImage");
    clear.addEventListener("click", () => {
      attachedImagePath = "";
      renderAttachment();
      input.focus();
    });
    preview.append(image, name, clear);
    positionPanel();
  }

  attach.addEventListener("click", async () => {
    const result = await api.pickChatImage();
    if (!result?.ok) return;
    attachedImagePath = result.imagePath;
    renderAttachment();
  });

  wrap.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.isComposing || composing) return;
    const text = input.value.trim();
    if (!text || send.disabled) return;
    const movementCommand = settings?.ai?.enabled ? null : applyMovementCommand(pet, text, character);
    appendChatMessage(history, "user", text);
    pushChatHistory(character.id, "user", text);
    const imagePaths = attachedImagePath ? [attachedImagePath] : [];
    attachedImagePath = "";
    renderAttachment();
    input.value = "";
    send.disabled = true;
    send.textContent = "...";
    const stopThinking = movementCommand ? () => {} : showThinking(pet);
    const keepSlow = movementCommand ? () => {} : slowPetForReply(pet);
    if (!movementCommand) appendChatMessage(history, "pet pending", panelText("aiThinking"));
    const pending = movementCommand ? null : history.querySelector(".chat-message.pending:last-child");
    let result = null;
    try {
      result = movementCommand
        ? { ok: true, provider: "command", text: movementCommand.reply }
        : await answerAsCharacter(pet, character, {
            characterId: pet.characterId,
            characterName: character.name,
            customConcept: character.concept || "",
            message: text,
            imagePaths,
            includeScreen: settings?.ai?.screenAwareness === true,
            movementState: movementStateForPet(pet),
          });
      result = applyAiActionResult(pet, character, result);
    } catch (error) {
      result = { ok: false, error: String(error?.message || error || "AI error") };
    }
    if (pending) pending.remove();
    stopThinking();
    keepSlow();
    if (result?.actionApplied) pet.replySlowUntil = 0;
    const replyText = result?.ok ? result.text : result?.error || "AI error";
    appendChatMessage(history, result?.ok ? "pet" : "error", replyText);
    pushChatHistory(character.id, result?.ok ? "pet" : "error", replyText);
    if (result?.ok) showPetThought(pet, replyText);
    send.disabled = false;
    send.textContent = panelText("aiSend");
    input.focus();
  });

  const row = document.createElement("div");
  row.className = "chat-row";
  row.append(input, attach, send);
  wrap.append(history, preview, row);
  window.requestAnimationFrame(() => {
    if (!input.disabled && !panel.hidden) input.focus();
  });
  return wrap;
}

function applyMovementCommand(pet, text, character = characterFor(pet?.characterId)) {
  if (!pet) return null;
  const command = parseLocalMovementCommand(text);
  if (!command) return null;
  return applyMovementAction(pet, command, character);
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
  if (!pet?.el || !stage || !text) return;
  const old = pet.thoughtEl;
  if (old) hidePetBubble(pet, old, "thoughtEl", { immediate: true });
  pet.el.classList.add("pet-talking");
  const bubble = document.createElement("div");
  bubble.className = "pet-thought pet-floating-bubble";
  bubble.textContent = String(text).slice(0, 180);
  stage.appendChild(bubble);
  pet.thoughtEl = bubble;
  positionPetBubble(pet, bubble);
  window.requestAnimationFrame(() => bubble.classList.add("is-visible"));
  const fallbackDuration = Math.min(24000, 7000 + Math.max(0, String(text).length - 36) * 80);
  const duration = Number.isFinite(options.durationMs) ? Math.max(800, options.durationMs) : fallbackDuration;
  bubble._hideTimer = window.setTimeout(() => hidePetBubble(pet, bubble, "thoughtEl"), duration);
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

function enabledCharacterChoices() {
  return pets
    .filter((pet) => pet.enabled)
    .map((pet) => {
      const character = characterFor(pet.characterId);
      return { slotIndex: pet.slotIndex, id: character.id, name: character.name };
    });
}

function closeQuickChat() {
  if (!quickChat || quickChat.hidden) return;
  window.clearTimeout(quickChatCloseTimer);
  quickChat.classList.remove("is-visible");
  quickChat.classList.add("is-hiding");
  if (!activePet || panel.hidden) api.setClickThrough(true);
  quickChatCloseTimer = window.setTimeout(() => {
    quickChat.hidden = true;
    quickChat.innerHTML = "";
    quickChat.classList.remove("is-hiding", "is-visible");
  }, QUICK_CHAT_HIDE_MS);
}

function openQuickChat() {
  if (!quickChat) return;
  window.clearTimeout(quickChatCloseTimer);
  const choices = enabledCharacterChoices();
  if (!choices.length) {
    quickChat.hidden = true;
    quickChat.innerHTML = "";
    quickChat.classList.remove("is-hiding", "is-visible");
    api.setClickThrough(true);
    lastInteractive = false;
    return;
  }
  api.setClickThrough(false);
  lastInteractive = true;
  if (!choices.some((choice) => choice.slotIndex === quickChatSlotIndex)) quickChatSlotIndex = choices[0].slotIndex;
  quickChat.innerHTML = "";

  const form = document.createElement("form");
  form.className = "quick-chat__form";

  const select = document.createElement("select");
  select.setAttribute("aria-label", "Character");
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = String(choice.slotIndex);
    option.textContent = choice.name;
    option.selected = choice.slotIndex === quickChatSlotIndex;
    select.appendChild(option);
  }

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 800;
  input.placeholder = panelText("quickPlaceholder");
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("enterkeyhint", "send");
  let composing = false;
  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.isComposing || composing)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  const send = document.createElement("button");
  send.type = "submit";
  send.textContent = panelText("aiSend");
  send.disabled = quickChatBusy;
  form.append(select, input, send);

  select.addEventListener("change", () => {
    quickChatSlotIndex = Number(select.value) || 0;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.isComposing || composing) return;
    const text = input.value.trim();
    const targetPet = petForSlot(Number(select.value) || 0);
    if (!text || !targetPet || quickChatBusy) return;
    quickChatBusy = true;
    input.value = "";
    send.disabled = true;
    const targetCharacter = characterFor(targetPet.characterId);
    const movementCommand = settings?.ai?.enabled ? null : applyMovementCommand(targetPet, text, targetCharacter);
    pushChatHistory(targetCharacter.id, "user", text);
    const stopThinking = movementCommand ? () => {} : showThinking(targetPet);
    const keepSlow = movementCommand ? () => {} : slowPetForReply(targetPet);
    let result = null;
    try {
      result = movementCommand
        ? { ok: true, provider: "command", text: movementCommand.reply }
        : await answerAsCharacter(targetPet, targetCharacter, {
            characterId: targetPet.characterId,
            characterName: targetCharacter.name,
            customConcept: targetCharacter.concept || "",
            message: text,
            includeScreen: settings?.ai?.screenAwareness === true,
            movementState: movementStateForPet(targetPet),
          });
      result = applyAiActionResult(targetPet, targetCharacter, result);
    } catch (error) {
      result = { ok: false, error: String(error?.message || error || "AI error") };
    }
    stopThinking();
    keepSlow();
    if (result?.actionApplied) targetPet.replySlowUntil = 0;
    const reply = result?.ok ? result.text : result?.error || "AI error";
    pushChatHistory(targetCharacter.id, result?.ok ? "pet" : "error", reply);
    showPetThought(targetPet, reply);
    quickChatBusy = false;
    send.disabled = false;
    window.requestAnimationFrame(() => input.focus());
  });

  quickChat.append(form);
  quickChat.hidden = false;
  quickChat.classList.remove("is-hiding");
  window.requestAnimationFrame(() => {
    quickChat.classList.add("is-visible");
    input.focus();
  });
}

function toggleQuickChat() {
  if (!quickChat || quickChat.hidden) openQuickChat();
  else closeQuickChat();
}

async function maybeAutoTalk(now) {
  const ai = settings?.ai;
  if (autoTalkBusy || now < nextAutoTalkAt) return;
  const candidates = pets.filter((pet) => pet.enabled && !pet.dragging);
  if (!candidates.length) return;
  autoTalkBusy = true;
  nextAutoTalkAt = now + rand(16000, 30000);
  const pet = candidates[Math.floor(Math.random() * candidates.length)];
  const character = characterFor(pet.characterId);
  if (!ai?.enabled || !ai?.autoSpeak) {
    showPetThought(pet, pickLocalLine(pet.characterId), { durationMs: 4000 });
    autoTalkBusy = false;
    return;
  }
  const stopThinking = showThinking(pet);
  try {
    const result = await answerAsCharacter(pet, character, {
      characterId: pet.characterId,
      characterName: character.name,
      customConcept: character.concept || "",
      message: "Look at the current screen and say one very short spontaneous thought as this character.",
      includeScreen: ai.screenAwareness === true,
      movementState: movementStateForPet(pet),
      auto: true,
    });
    const cleanResult = applyAiActionResult(pet, character, result);
    if (cleanResult?.actionApplied) pet.replySlowUntil = 0;
    if (cleanResult?.ok) showPetThought(pet, cleanResult.text, { durationMs: 4000 });
  } finally {
    stopThinking();
    autoTalkBusy = false;
  }
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

function openPanel(pet) {
  api.setClickThrough(false);
  if (activePet && activePet !== pet) {
    activePet.pausedByPanel = false;
    pickTarget(activePet, performance.now());
  }
  activePet = pet;
  pet.pausedByPanel = true;
  pet.vx = 0;
  pet.vy = 0;
  pet.targetX = pet.x;
  pet.targetY = pet.y;
  spawnClickBurst(pet);
  const character = characterFor(pet.characterId);
  const shortcuts = Array.isArray(settings?.shortcuts)
    ? settings.shortcuts.filter((item) => item?.name && (item.type === "app" ? item.appPath : item.url))
    : [];
  panel.innerHTML = "";
  panel.setAttribute("aria-label", character.name);

  const header = document.createElement("div");
  header.className = "panel-header";
  const title = document.createElement("strong");
  title.textContent = character.name;
  const pin = document.createElement("button");
  pin.className = "panel-pin";
  pin.type = "button";
  pin.textContent = panelPinned ? "고정됨" : "고정";
  pin.setAttribute("aria-pressed", String(panelPinned));
  pin.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    panelPinned = !panelPinned;
    pin.textContent = panelPinned ? "고정됨" : "고정";
    pin.setAttribute("aria-pressed", String(panelPinned));
  });
  const close = document.createElement("button");
  close.className = "panel-close";
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", panelText("close"));
  close.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closePanel(true);
    api.setClickThrough(true);
  });
  const controls = document.createElement("div");
  controls.className = "panel-header__controls";
  controls.append(pin, close);
  header.append(title, controls);
  panel.appendChild(header);
  bindPanelMove(header);

  const grid = document.createElement("div");
  grid.className = "shortcut-grid";
  const displayMode = ["both", "image", "name"].includes(settings?.shortcutDisplayMode)
    ? settings.shortcutDisplayMode
    : "both";
  grid.classList.toggle("image-only-grid", displayMode === "image");
  const visibleShortcuts = (displayMode === "image" ? shortcuts.filter(hasCustomShortcutImage) : shortcuts).slice(
    0,
    displayMode === "image" ? 12 : 6,
  );
  for (const shortcut of visibleShortcuts) {
    const button = document.createElement("button");
    button.className = "shortcut";
    button.type = "button";
    if (displayMode !== "name") {
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
    if (displayMode !== "image") {
      const label = document.createElement("span");
      label.textContent = shortcut.name;
      button.appendChild(label);
    } else {
      button.classList.add("image-only");
      button.title = shortcut.name;
    }
    button.addEventListener("click", () => api.openShortcut(shortcut));
    grid.appendChild(button);
  }
  panel.appendChild(grid);
  panel.appendChild(createAiChat(character, pet));

  const actions = document.createElement("div");
  actions.className = "panel-actions";
  const settingsButton = document.createElement("button");
  settingsButton.className = "pixel-button";
  settingsButton.type = "button";
  settingsButton.textContent = `⚙ ${panelText("settings")}`;
  settingsButton.addEventListener("click", () => api.openSettings());
  actions.append(settingsButton);
  panel.appendChild(actions);

  const resize = document.createElement("div");
  resize.className = "panel-resize";
  resize.setAttribute("aria-hidden", "true");
  panel.appendChild(resize);
  bindPanelResize(resize);

  panel.hidden = false;
  positionPanel();
  bindPanelMove(panel, { body: true });
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
  const rectW = panel.offsetWidth || 320;
  const rectH = panel.offsetHeight || 112;
  if (panelManual) {
    const width = clamp(panelManual.width || rectW, 280, Math.min(560, w - 24), rectW);
    const height = clamp(panelManual.height || rectH, 190, Math.min(680, h - 24), rectH);
    const x = clamp(panelManual.x, 12, Math.max(12, w - width - 12));
    const y = clamp(panelManual.y, 12, Math.max(12, h - height - 12));
    panel.style.width = `${Math.round(width)}px`;
    panel.style.minHeight = `${Math.round(height)}px`;
    panel.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    return;
  }
  panel.style.width = "";
  panel.style.minHeight = "";
  let x = activePet.x + size / 2 - rectW / 2;
  let y = activePet.y - rectH - 4;
  if (y < 12) y = activePet.y + size + 4;
  x = clamp(x, 12, Math.max(12, w - rectW - 12));
  y = clamp(y, 12, Math.max(12, h - rectH - 12));
  panel.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function syncGround() {
  ground.hidden = true;
  ground.innerHTML = "";
}

function syncAquarium() {
  if (!aquarium) return;
  if (aquariumSignature === "disabled") return;
  aquariumSignature = "disabled";
  aquarium.hidden = true;
  aquarium.innerHTML = "";
}

function syncPets() {
  if (!settings) return;
  document.body.dataset.performance = settings.performanceMode || "saver";
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
    const character = characterFor(pet.characterId);
    pet.movement = { ...DEFAULT_MOVEMENT, ...(character.movement || {}) };
    pet.label.textContent = character.name;
    pet.el.dataset.spriteType = customHasImage(customCharacterFor(pet.characterId)) ? "image" : "pixel";
    pet.el.setAttribute("aria-label", `${character.name} companion`);
    syncPetSize(pet);
    renderSprite(pet, true);
    if (!pet.nextTargetAt || characterChanged) pickTarget(pet, now);
    if (characterChanged || Math.hypot(pet.vx, pet.vy) < 0.02) wakePet(pet, 0.5);
    if (characterChanged && activePet === pet && !panel.hidden) {
      openPanel(pet);
    }
  }
  if (quickChat && !quickChat.hidden) openQuickChat();
  syncGround();
  syncAquarium();
  if (activePet && !activePet.enabled) {
    closePanel(true);
  }
}

function handleCursorPoint(point) {
  if (areaPicker) return;
  trackMouse(point.x, point.y);
  const target = document.elementFromPoint(point.x, point.y);
  const panelOpen = activePet && !panel.hidden;
  const quickOpen = quickChat && !quickChat.hidden;
  const overInteractive = !!target?.closest(".interactive");
  const overQuickChat = !!target?.closest(".quick-chat");
  const interactive = panelOpen || overInteractive;
  if (interactive !== lastInteractive) {
    lastInteractive = interactive;
    api.setClickThrough(!interactive, { preserveFocus: quickOpen && !overQuickChat });
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

function scheduleTick() {
  if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
  animationFrameId = window.requestAnimationFrame(tick);
}

function tick(now) {
  animationFrameId = null;
  const profile = performanceProfile();
  const dt = now - lastTick;
  const motionDue = dt >= Math.max(8, profile.frameMs * 0.82);
  if (motionDue) {
    lastTick = now;
    const step = clamp(dt / 16.67, 0.2, 2.4);
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
      spawnTrail(pet, now);
    }
    positionPetBubbles();
  } else if (hasActiveRainbow()) {
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
  api.onQuickChatToggle(toggleQuickChat);
  api.setClickThrough(true);
  lastTick = performance.now();
  scheduleTick();
}

window.addEventListener("resize", () => {
  resizeEffectsCanvas();
  const { w, h } = viewport();
  for (const pet of pets) {
    const size = getPetSize(pet);
    pet.x = clamp(pet.x, 0, Math.max(0, w - size));
    pet.y = clamp(pet.y, 0, Math.max(0, h - size));
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && quickChat && !quickChat.hidden) {
    closeQuickChat();
  }
});

init();
